<?php

declare(strict_types=1);

namespace Hscode;

use Http\Discovery\Psr17FactoryDiscovery;
use Http\Discovery\Psr18ClientDiscovery;
use Psr\Http\Client\ClientExceptionInterface;
use Psr\Http\Client\ClientInterface;
use Psr\Http\Message\RequestFactoryInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\StreamFactoryInterface;

/**
 * Client for the hscode.info API.
 *
 * Responses are the decoded JSON as arrays. Their shapes follow the OpenAPI spec
 * and are documented with the aliases below. Arrays keep the SDK in step with
 * API additions without a release, and cost nothing to pass to Twig or json_encode.
 *
 * @phpstan-type Duty array{goods_code: string, origin: string, origin_code: string, start_date: string, end_date: string, duty: string, legal_base: string, measure_type: string, meas_type_code: string}
 * @phpstan-type ClassifyResult array{goods_code: string, description: string, path: list<string>, score: float, confidence: ?float, reasoning: ?string, duties: list<Duty>}
 * @phpstan-type Question array{options: list<array{label: string, goods_code: string}>}
 * @phpstan-type ClassifyResponse array{snapshot: string, mode: string, reranked: bool, rewrite: ?string, high_confidence: bool, results: list<ClassifyResult>, question: ?Question, disclaimer: string}
 * @phpstan-type BatchItem array{id: ?string, reranked: bool, rewrite: ?string, high_confidence: bool, results: list<ClassifyResult>, question: ?Question, error: ?string}
 * @phpstan-type BatchResponse array{snapshot: string, mode: string, items: list<BatchItem>, disclaimer: string}
 * @phpstan-type CodeDetail array{goods_code: string, description: string, hierarchy: list<array{goods_code: string, description: string, indent: string, hier_pos: int}>, duties: list<Duty>, signals?: array<string, mixed>, history?: list<array{year: string, month: string, duties: list<Duty>}>}
 */
final class Client
{
    public const DEFAULT_BASE_URL = 'https://hscode.info';
    public const MAX_BATCH = 25;

    private readonly string $apiKey;
    private readonly string $baseUrl;
    private readonly ClientInterface $http;
    private readonly RequestFactoryInterface $requestFactory;
    private readonly StreamFactoryInterface $streamFactory;

    /**
     * @param string|null $apiKey  Defaults to the HSCODE_KEY environment variable.
     * @param string|null $baseUrl Defaults to https://hscode.info.
     * @param ClientInterface|null $httpClient PSR-18 client. Discovered when null (Guzzle, Symfony, curl...).
     */
    public function __construct(
        ?string $apiKey = null,
        ?string $baseUrl = null,
        ?ClientInterface $httpClient = null,
        ?RequestFactoryInterface $requestFactory = null,
        ?StreamFactoryInterface $streamFactory = null,
    ) {
        $key = $apiKey ?? self::env('HSCODE_KEY');
        if ($key === null || $key === '') {
            throw new HscodeException(0, 'missing_api_key', 'No API key. Pass apiKey or set HSCODE_KEY.');
        }
        $this->apiKey = $key;
        $this->baseUrl = rtrim($baseUrl ?? self::DEFAULT_BASE_URL, '/');
        $this->http = $httpClient ?? Psr18ClientDiscovery::find();
        $this->requestFactory = $requestFactory ?? Psr17FactoryDiscovery::findRequestFactory();
        $this->streamFactory = $streamFactory ?? Psr17FactoryDiscovery::findStreamFactory();
    }

    /**
     * Classify one product description. `$mode` is "fast" (1 AI unit) or "accurate" (5 units).
     *
     * @return ClassifyResponse
     */
    public function classify(string $text, string $mode = 'fast', string $lang = 'en'): array
    {
        return $this->request('POST', '/api/v1/classify', body: ['text' => $text, 'mode' => $mode, 'lang' => $lang]);
    }

    /**
     * Classify 1 to 25 items. An item is a string or ['text' => ..., 'id' => ...].
     * A string gets its list position as id.
     *
     * @param list<string|array{text: string, id?: string}> $items
     * @return BatchResponse
     */
    public function classifyBatch(array $items, string $mode = 'fast', string $lang = 'en'): array
    {
        $entries = [];
        foreach (array_values($items) as $i => $item) {
            $entries[] = is_string($item) ? ['id' => (string) $i, 'text' => $item] : $item;
        }
        $count = count($entries);
        if ($count < 1 || $count > self::MAX_BATCH) {
            throw self::invalid(sprintf('classifyBatch takes 1 to %d items, got %d.', self::MAX_BATCH, $count));
        }

        return $this->request('POST', '/api/v1/classify/batch', body: ['items' => $entries, 'mode' => $mode, 'lang' => $lang]);
    }

    /**
     * Look up a 10 digit goods code. Spaces and dots are stripped. `$year` defaults to "latest".
     *
     * @return CodeDetail
     */
    public function lookup(string $code, string $lang = 'en', ?string $year = null, bool $history = false): array
    {
        $code = self::normalizeCode($code);

        return $this->request(
            'GET',
            sprintf('/api/v1/%s/%s/codes/%s', self::segment($lang), self::segment($year ?? 'latest'), $code),
            query: $history ? ['history' => 'true'] : [],
        );
    }

    /**
     * Same as lookup() with history, adding the duties of every yearly snapshot.
     *
     * @return CodeDetail
     */
    public function history(string $code, string $lang = 'en', ?string $year = null): array
    {
        return $this->lookup($code, $lang, $year, true);
    }

    /**
     * @return array{items: list<array{goods_code: string, description: string}>}
     */
    public function search(string $query, string $lang = 'en', ?string $year = null): array
    {
        return $this->request(
            'GET',
            sprintf('/api/v1/%s/%s/search', self::segment($lang), self::segment($year ?? 'latest')),
            query: ['q' => $query],
        );
    }

    /**
     * Import duty per origin for a 10 digit goods code.
     *
     * @return array{items: list<Duty>}
     */
    public function duties(string $code, ?string $year = null): array
    {
        $code = self::normalizeCode($code);

        return $this->request('GET', sprintf('/api/v1/%s/duties/%s', self::segment($year ?? 'latest'), $code));
    }

    /** @return array<string, mixed> */
    public function chapters(string $lang = 'en', ?string $year = null): array
    {
        return $this->request('GET', sprintf('/api/v1/%s/%s/chapters', self::segment($lang), self::segment($year ?? 'latest')));
    }

    /** @return array<string, mixed> */
    public function chapter(string|int $chapter, string $lang = 'en', ?string $year = null): array
    {
        $chapter = (string) $chapter;
        if (!preg_match('/^\d{2}$/', $chapter)) {
            throw self::invalid(sprintf('Chapter must have 2 digits, got "%s".', $chapter));
        }

        return $this->request('GET', sprintf('/api/v1/%s/%s/chapters/%s', self::segment($lang), self::segment($year ?? 'latest'), $chapter));
    }

    /**
     * @return array{langs: list<string>, latest: array{year: string, month: string}, snapshots: list<array{year: string, month: string}>}
     */
    public function snapshots(): array
    {
        return $this->request('GET', '/api/v1/snapshots');
    }

    public static function normalizeCode(string $code): string
    {
        $digits = preg_replace('/[\s.]/', '', $code) ?? '';
        if (!preg_match('/^\d{10}$/', $digits)) {
            throw self::invalid(sprintf('Goods code must have 10 digits, got "%s".', $code));
        }

        return $digits;
    }

    /**
     * @param array<string, string> $query
     * @param array<string, mixed>|null $body
     * @return array<string, mixed>
     */
    private function request(string $method, string $path, array $query = [], ?array $body = null): array
    {
        $url = $this->baseUrl . $path . ($query === [] ? '' : '?' . http_build_query($query, '', '&', PHP_QUERY_RFC3986));
        $request = $this->requestFactory->createRequest($method, $url)
            ->withHeader('Authorization', 'Bearer ' . $this->apiKey)
            ->withHeader('Accept', 'application/json');
        if ($body !== null) {
            $request = $request
                ->withHeader('Content-Type', 'application/json')
                ->withBody($this->streamFactory->createStream(json_encode($body, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE)));
        }

        try {
            $response = $this->http->sendRequest($request);
        } catch (ClientExceptionInterface $e) {
            throw new HscodeException(0, 'network_error', 'Network error: ' . $e->getMessage(), previous: $e);
        }

        $data = json_decode((string) $response->getBody(), true);
        $status = $response->getStatusCode();
        if ($status < 200 || $status >= 300) {
            $err = is_array($data) ? $data : [];
            throw new HscodeException(
                $status,
                is_string($err['error'] ?? null) ? $err['error'] : 'http_error',
                is_string($err['message'] ?? null) ? $err['message'] : "Request failed with status $status.",
                $status === 429 ? self::retryAfter($response) : null,
                self::rateLimit($response),
            );
        }

        return is_array($data) ? $data : [];
    }

    private static function retryAfter(ResponseInterface $response): ?int
    {
        $value = trim($response->getHeaderLine('Retry-After'));
        if ($value === '') {
            return null;
        }
        if (ctype_digit($value)) {
            return (int) $value;
        }
        $at = strtotime($value);

        return $at === false ? null : max(0, $at - time());
    }

    /** @return array{limit: ?int, remaining: ?int, reset: ?int} */
    private static function rateLimit(ResponseInterface $response): array
    {
        $read = static function (string $name) use ($response): ?int {
            $v = trim($response->getHeaderLine($name));

            return ctype_digit($v) ? (int) $v : null;
        };

        return [
            'limit' => $read('RateLimit-Limit'),
            'remaining' => $read('RateLimit-Remaining'),
            'reset' => $read('RateLimit-Reset'),
        ];
    }

    private static function segment(string $value): string
    {
        return rawurlencode($value);
    }

    private static function invalid(string $message): HscodeException
    {
        return new HscodeException(0, 'invalid_request', $message);
    }

    private static function env(string $name): ?string
    {
        $v = getenv($name);

        return $v === false ? ($_SERVER[$name] ?? $_ENV[$name] ?? null) : $v;
    }
}

<?php

declare(strict_types=1);

namespace Hscode\Tests;

use Hscode\Client;
use Hscode\HscodeException;
use Nyholm\Psr7\Factory\Psr17Factory;
use Nyholm\Psr7\Response;
use PHPUnit\Framework\TestCase;
use Psr\Http\Client\ClientExceptionInterface;
use Psr\Http\Client\ClientInterface;
use Psr\Http\Message\RequestInterface;
use Psr\Http\Message\ResponseInterface;

final class ClientTest extends TestCase
{
    /** @var list<RequestInterface> */
    private array $sent = [];

    private function client(ResponseInterface|\Throwable $reply, ?string $key = 'k_test'): Client
    {
        $http = new class($reply, $this->sent) implements ClientInterface {
            /** @param list<RequestInterface> $sent */
            public function __construct(private ResponseInterface|\Throwable $reply, private array &$sent)
            {
            }

            public function sendRequest(RequestInterface $request): ResponseInterface
            {
                $this->sent[] = $request;
                if ($this->reply instanceof \Throwable) {
                    throw $this->reply;
                }

                return $this->reply;
            }
        };
        $f = new Psr17Factory();

        return new Client($key, null, $http, $f, $f);
    }

    /** @param array<string, mixed> $data @param array<string, string> $headers */
    private static function json(int $status, array $data, array $headers = []): Response
    {
        return new Response($status, ['Content-Type' => 'application/json'] + $headers, json_encode($data, JSON_THROW_ON_ERROR));
    }

    public function testClassifySuccess(): void
    {
        $client = $this->client(self::json(200, ['results' => [['goods_code' => '6109100010']], 'snapshot' => '2026-10']));
        $res = $client->classify('cotton t-shirt', 'accurate', 'de');

        self::assertSame('6109100010', $res['results'][0]['goods_code']);
        $req = $this->sent[0];
        self::assertSame('POST', $req->getMethod());
        self::assertSame('https://hscode.info/api/v1/classify', (string) $req->getUri());
        self::assertSame('Bearer k_test', $req->getHeaderLine('Authorization'));
        self::assertSame(
            ['text' => 'cotton t-shirt', 'mode' => 'accurate', 'lang' => 'de'],
            json_decode((string) $req->getBody(), true),
        );
    }

    public function testLookupNormalizesCodeAndDefaultsToLatest(): void
    {
        $client = $this->client(self::json(200, ['goods_code' => '6109100010']));
        $client->lookup('6109 10 00.10', history: true);

        self::assertSame(
            'https://hscode.info/api/v1/en/latest/codes/6109100010?history=true',
            (string) $this->sent[0]->getUri(),
        );
    }

    public function testSearchEncodesQueryAndDutiesUsesYear(): void
    {
        $client = $this->client(self::json(200, ['items' => []]));
        $client->search('t shirt & co', 'fr', '2025');
        $client->duties('6109100010');

        self::assertSame('https://hscode.info/api/v1/fr/2025/search?q=t%20shirt%20%26%20co', (string) $this->sent[0]->getUri());
        self::assertSame('https://hscode.info/api/v1/latest/duties/6109100010', (string) $this->sent[1]->getUri());
    }

    public function testInvalidCodeThrowsBeforeAnyRequest(): void
    {
        $client = $this->client(self::json(200, []));
        try {
            $client->lookup('1234');
            self::fail('expected exception');
        } catch (HscodeException $e) {
            self::assertSame(0, $e->status);
            self::assertSame('invalid_request', $e->errorCode);
        }
        self::assertSame([], $this->sent);
    }

    public function testAuthError(): void
    {
        $client = $this->client(self::json(401, ['error' => 'unauthorized', 'message' => 'Invalid API key.']));
        try {
            $client->snapshots();
            self::fail('expected exception');
        } catch (HscodeException $e) {
            self::assertSame(401, $e->status);
            self::assertSame('unauthorized', $e->errorCode);
            self::assertSame('Invalid API key.', $e->getMessage());
            self::assertFalse($e->isQuotaExceeded());
            self::assertNull($e->retryAfter);
        }
    }

    public function testQuotaErrorCarriesRetryAfterAndLimit(): void
    {
        $client = $this->client(self::json(
            429,
            ['error' => 'quota_exceeded', 'message' => 'Daily quota used up.'],
            ['Retry-After' => '3600', 'RateLimit-Limit' => '100', 'RateLimit-Remaining' => '0', 'RateLimit-Reset' => '1790000000'],
        ));
        try {
            $client->classify('shoes');
            self::fail('expected exception');
        } catch (HscodeException $e) {
            self::assertTrue($e->isQuotaExceeded());
            self::assertSame(429, $e->status);
            self::assertSame('quota_exceeded', $e->errorCode);
            self::assertSame(3600, $e->retryAfter);
            self::assertSame(['limit' => 100, 'remaining' => 0, 'reset' => 1790000000], $e->rateLimit);
        }
    }

    public function testQuotaErrorWithoutBodyOrHeaders(): void
    {
        $client = $this->client(new Response(429, [], 'not json'));
        try {
            $client->classify('shoes');
            self::fail('expected exception');
        } catch (HscodeException $e) {
            self::assertSame('http_error', $e->errorCode);
            self::assertSame('Request failed with status 429.', $e->getMessage());
            self::assertNull($e->retryAfter);
            self::assertSame(['limit' => null, 'remaining' => null, 'reset' => null], $e->rateLimit);
        }
    }

    public function testBatchMapsStringsToPositionIds(): void
    {
        $client = $this->client(self::json(200, ['items' => [['id' => '0', 'results' => []], ['id' => 'SKU-2', 'results' => []]]]));
        $res = $client->classifyBatch(['cotton t-shirt', ['id' => 'SKU-2', 'text' => 'steel nails']], 'fast', 'en');

        self::assertCount(2, $res['items']);
        self::assertSame(
            [
                'items' => [['id' => '0', 'text' => 'cotton t-shirt'], ['id' => 'SKU-2', 'text' => 'steel nails']],
                'mode' => 'fast',
                'lang' => 'en',
            ],
            json_decode((string) $this->sent[0]->getBody(), true),
        );
        self::assertSame('https://hscode.info/api/v1/classify/batch', (string) $this->sent[0]->getUri());
    }

    public function testBatchSizeLimits(): void
    {
        $client = $this->client(self::json(200, ['items' => []]));
        $client->classifyBatch(array_fill(0, 25, 'shoes'));
        self::assertCount(1, $this->sent);

        foreach ([[], array_fill(0, 26, 'shoes')] as $items) {
            try {
                $client->classifyBatch($items);
                self::fail('expected exception');
            } catch (HscodeException $e) {
                self::assertSame('invalid_request', $e->errorCode);
            }
        }
        self::assertCount(1, $this->sent);
    }

    public function testChapterValidation(): void
    {
        $client = $this->client(self::json(200, ['items' => []]));
        $client->chapter('61');
        self::assertSame('https://hscode.info/api/v1/en/latest/chapters/61', (string) $this->sent[0]->getUri());

        $this->expectException(HscodeException::class);
        $client->chapter('6');
    }

    public function testNetworkError(): void
    {
        $failure = new class('boom') extends \RuntimeException implements ClientExceptionInterface {
        };
        $client = $this->client($failure);
        try {
            $client->snapshots();
            self::fail('expected exception');
        } catch (HscodeException $e) {
            self::assertSame(0, $e->status);
            self::assertSame('network_error', $e->errorCode);
            self::assertSame($failure, $e->getPrevious());
        }
    }

    public function testMissingApiKey(): void
    {
        putenv('HSCODE_KEY');
        unset($_SERVER['HSCODE_KEY'], $_ENV['HSCODE_KEY']);
        $this->expectException(HscodeException::class);
        $this->expectExceptionMessage('No API key');
        $this->client(self::json(200, []), null);
    }

    public function testApiKeyFromEnvironment(): void
    {
        putenv('HSCODE_KEY=k_env');
        try {
            $client = $this->client(self::json(200, ['langs' => []]), null);
            $client->snapshots();
            self::assertSame('Bearer k_env', $this->sent[0]->getHeaderLine('Authorization'));
        } finally {
            putenv('HSCODE_KEY');
        }
    }
}

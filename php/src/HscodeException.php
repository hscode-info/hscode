<?php

declare(strict_types=1);

namespace Hscode;

/**
 * Thrown for every failure: HTTP errors, network errors and invalid input.
 *
 * `status` is the HTTP status, or 0 for errors raised before a response.
 * `errorCode` is the API `error` string, or `invalid_request`, `missing_api_key`
 * and `network_error` for local failures. (`getCode()` stays an int, as PHP requires.)
 */
final class HscodeException extends \RuntimeException
{
    /**
     * @param array{limit: ?int, remaining: ?int, reset: ?int} $rateLimit from X-RateLimit-* response headers
     */
    public function __construct(
        public readonly int $status,
        public readonly string $errorCode,
        string $message,
        public readonly ?int $retryAfter = null,
        public readonly array $rateLimit = ['limit' => null, 'remaining' => null, 'reset' => null],
        ?\Throwable $previous = null,
    ) {
        parent::__construct($message, $status, $previous);
    }

    /** True on HTTP 429: the plan quota of AI units or lookups is used up. */
    public function isQuotaExceeded(): bool
    {
        return $this->status === 429;
    }
}

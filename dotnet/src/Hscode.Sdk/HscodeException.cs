using System;

namespace Hscode;

/// <summary>Raised for every failure: API errors, local validation errors and network errors.</summary>
public sealed class HscodeException : Exception
{
    public HscodeException(int status, string code, string message, TimeSpan? retryAfter = null, Exception? inner = null,
        int? rateLimitLimit = null, int? rateLimitRemaining = null, DateTimeOffset? rateLimitReset = null)
        : base(message, inner)
    {
        Status = status;
        Code = code;
        RetryAfter = retryAfter;
        RateLimitLimit = rateLimitLimit;
        RateLimitRemaining = rateLimitRemaining;
        RateLimitReset = rateLimitReset;
    }

    /// <summary>HTTP status (400, 401, 404, 429, 503). 0 for errors raised before a response.</summary>
    public int Status { get; }

    /// <summary>The API <c>error</c> string, or <c>invalid_request</c>, <c>missing_api_key</c>, <c>network_error</c>, <c>invalid_response</c>.</summary>
    public string Code { get; }

    /// <summary>True on HTTP 429: the plan quota of AI units or lookups is used up.</summary>
    public bool IsQuotaExceeded => Status == 429;

    /// <summary>Value of the <c>Retry-After</c> header, when the API sent one.</summary>
    public TimeSpan? RetryAfter { get; }

    /// <summary>Value of the <c>RateLimit-Limit</c> header, when present.</summary>
    public int? RateLimitLimit { get; }

    /// <summary>Value of the <c>RateLimit-Remaining</c> header, when present.</summary>
    public int? RateLimitRemaining { get; }

    /// <summary>The <c>RateLimit-Reset</c> header (unix timestamp in seconds) as a time, when present.</summary>
    public DateTimeOffset? RateLimitReset { get; }
}

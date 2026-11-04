package info.hscode;

import java.net.http.HttpHeaders;
import java.util.List;
import java.util.Map;
import java.util.OptionalLong;

/**
 * Rate-limit data read from the response headers of a failed call. Every value is empty when
 * the server did not send the matching header. Immutable.
 */
public final class QuotaInfo {
    private final OptionalLong limit;
    private final OptionalLong remaining;
    private final OptionalLong reset;
    private final OptionalLong retryAfterSeconds;
    private final Map<String, List<String>> headers;

    QuotaInfo(HttpHeaders h) {
        this.limit = first(h, "ratelimit-limit");
        this.remaining = first(h, "ratelimit-remaining");
        this.reset = first(h, "ratelimit-reset");
        this.retryAfterSeconds = first(h, "retry-after");
        this.headers = Map.copyOf(h.map());
    }

    private static OptionalLong first(HttpHeaders h, String... names) {
        for (String name : names) {
            for (String v : h.allValues(name)) {
                try {
                    return OptionalLong.of(Long.parseLong(v.trim()));
                } catch (NumberFormatException ignored) {
                    // not a plain number, try the next value
                }
            }
        }
        return OptionalLong.empty();
    }

    /** Quota of the plan, from RateLimit-Limit. */
    public OptionalLong getLimit() {
        return limit;
    }

    /** Units left, from RateLimit-Remaining. */
    public OptionalLong getRemaining() {
        return remaining;
    }

    /** Unix timestamp in seconds when the quota resets, from RateLimit-Reset. */
    public OptionalLong getReset() {
        return reset;
    }

    /** Retry-After in seconds. Empty when absent or sent as a date. */
    public OptionalLong getRetryAfterSeconds() {
        return retryAfterSeconds;
    }

    /** All response headers, names lower-case. */
    public Map<String, List<String>> getHeaders() {
        return headers;
    }

    @Override
    public String toString() {
        return "QuotaInfo{limit=" + limit + ", remaining=" + remaining + ", reset=" + reset
                + ", retryAfterSeconds=" + retryAfterSeconds + "}";
    }
}

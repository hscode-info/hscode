package info.hscode;

/**
 * Every failure of the client. Unchecked.
 *
 * <ul>
 *   <li>{@code status}: HTTP status (400, 401, 404, 429, 503). 0 for errors raised before a response.
 *   <li>{@code code}: the API {@code error} string, or {@code invalid_request}, {@code missing_api_key},
 *       {@code network_error}, {@code invalid_response}, {@code http_error} for local or unnamed errors.
 * </ul>
 */
public class HscodeException extends RuntimeException {
    private static final long serialVersionUID = 1L;

    /** Where to upgrade when the plan quota is used up. */
    public static final String PRICING_URL = "https://hscode.info/en/pricing";

    private final int status;
    private final String code;
    private final transient QuotaInfo quota;

    public HscodeException(int status, String code, String message) {
        this(status, code, message, null, null);
    }

    HscodeException(int status, String code, String message, QuotaInfo quota, Throwable cause) {
        super(message, cause);
        this.status = status;
        this.code = code;
        this.quota = quota;
    }

    public int getStatus() {
        return status;
    }

    public String getCode() {
        return code;
    }

    /** True on HTTP 429: the plan quota of AI units or lookups is used up. */
    public boolean isQuotaExceeded() {
        return status == 429;
    }

    /** Rate-limit headers of the failed response, or null for errors without a response. */
    public QuotaInfo getQuota() {
        return quota;
    }

    /** {@link #PRICING_URL} on a 429, else null. */
    public String getUpgradeUrl() {
        return isQuotaExceeded() ? PRICING_URL : null;
    }
}

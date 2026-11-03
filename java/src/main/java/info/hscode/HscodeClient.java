package info.hscode;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.function.Function;
import java.util.regex.Pattern;

/**
 * Client for the hscode.info EU customs tariff (TARIC) API. Thread-safe and immutable once built.
 *
 * <p>Every method has a blocking form and an {@code ...Async} form returning a
 * {@link CompletableFuture}. Failures are {@link HscodeException}s, thrown directly by the blocking
 * form and carried as the cause of the failed future by the async form.
 *
 * <p>{@code lang} defaults to {@link Lang#EN} and {@code year} to {@code "latest"}. Pass null for
 * either to get the default.
 */
public final class HscodeClient {
    public static final String DEFAULT_BASE_URL = "https://hscode.info";
    public static final int MAX_BATCH_SIZE = 25;
    static final String VERSION = "0.1.0";

    private static final Pattern CODE = Pattern.compile("\\d{10}");
    private static final Pattern CHAPTER = Pattern.compile("\\d{2}");
    private static final ObjectMapper MAPPER =
            new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    private final String apiKey;
    private final String baseUrl;
    private final Duration timeout;
    private final HttpClient http;

    private HscodeClient(Builder b) {
        this.apiKey = b.apiKey != null ? b.apiKey : blankToNull(b.env.apply("HSCODE_KEY"));
        this.baseUrl = stripTrailingSlashes(b.baseUrl);
        this.timeout = b.timeout;
        this.http = b.httpClient != null ? b.httpClient : HttpClient.newHttpClient();
    }

    public static Builder builder() {
        return new Builder();
    }

    /** Builds a client from the HSCODE_KEY environment variable and the default base URL. */
    public static HscodeClient create() {
        return builder().build();
    }

    public static final class Builder {
        private String apiKey;
        private String baseUrl = DEFAULT_BASE_URL;
        private Duration timeout = Duration.ofSeconds(60);
        private HttpClient httpClient;
        private Function<String, String> env = System::getenv;

        private Builder() {}

        /** The API key. Defaults to the HSCODE_KEY environment variable. */
        public Builder apiKey(String apiKey) {
            this.apiKey = apiKey;
            return this;
        }

        /** The host, default {@code https://hscode.info}. The client appends {@code /api/v1/...}. */
        public Builder baseUrl(String baseUrl) {
            this.baseUrl = Objects.requireNonNull(baseUrl, "baseUrl");
            return this;
        }

        /** Per-request timeout, default 60 seconds. Allow 150 s for an accurate batch of 25. */
        public Builder timeout(Duration timeout) {
            this.timeout = Objects.requireNonNull(timeout, "timeout");
            return this;
        }

        /** Use your own HttpClient for proxies, TLS settings or tests. Default: a new HttpClient. */
        public Builder httpClient(HttpClient httpClient) {
            this.httpClient = httpClient;
            return this;
        }

        /** Replaces the environment lookup used for HSCODE_KEY. For tests. */
        Builder env(Function<String, String> env) {
            this.env = env;
            return this;
        }

        public HscodeClient build() {
            return new HscodeClient(this);
        }
    }

    // ---- classify ----

    public ClassifyResponse classify(String text) {
        return classify(text, null, null);
    }

    /** POST /api/v1/classify. Pass null for mode (fast) or lang (en) to use the default. */
    public ClassifyResponse classify(String text, Mode mode, Lang lang) {
        return await(classifyAsync(text, mode, lang));
    }

    public CompletableFuture<ClassifyResponse> classifyAsync(String text) {
        return classifyAsync(text, null, null);
    }

    public CompletableFuture<ClassifyResponse> classifyAsync(String text, Mode mode, Lang lang) {
        if (text == null) return failed(invalid("Text is required."));
        ObjectNode body = MAPPER.createObjectNode().put("text", text);
        putOptions(body, mode, lang);
        return request("POST", "/api/v1/classify", null, body, n -> read(n, ClassifyResponse.class));
    }

    // ---- classify batch ----

    public ClassifyBatchResponse classifyBatch(List<BatchItem> items) {
        return classifyBatch(items, null, null);
    }

    /** POST /api/v1/classify/batch. One to 25 items. An item that fails has error set. */
    public ClassifyBatchResponse classifyBatch(List<BatchItem> items, Mode mode, Lang lang) {
        return await(classifyBatchAsync(items, mode, lang));
    }

    public CompletableFuture<ClassifyBatchResponse> classifyBatchAsync(List<BatchItem> items) {
        return classifyBatchAsync(items, null, null);
    }

    public CompletableFuture<ClassifyBatchResponse> classifyBatchAsync(
            List<BatchItem> items, Mode mode, Lang lang) {
        if (items == null || items.isEmpty() || items.size() > MAX_BATCH_SIZE) {
            return failed(invalid("A batch takes 1 to " + MAX_BATCH_SIZE + " items."));
        }
        ObjectNode body = MAPPER.createObjectNode();
        ArrayNode arr = body.putArray("items");
        for (BatchItem item : items) {
            if (item == null) return failed(invalid("Batch items must not be null."));
            ObjectNode o = arr.addObject();
            if (item.getId() != null) o.put("id", item.getId());
            o.put("text", item.getText());
        }
        putOptions(body, mode, lang);
        return request(
                "POST", "/api/v1/classify/batch", null, body, n -> read(n, ClassifyBatchResponse.class));
    }

    // ---- lookup and history ----

    public CodeDetail lookup(String code) {
        return lookup(code, null, null, false);
    }

    /** GET /api/v1/{lang}/{year}/codes/{code}. history adds the duties of every yearly snapshot. */
    public CodeDetail lookup(String code, Lang lang, String year, boolean history) {
        return await(lookupAsync(code, lang, year, history));
    }

    public CompletableFuture<CodeDetail> lookupAsync(String code) {
        return lookupAsync(code, null, null, false);
    }

    public CompletableFuture<CodeDetail> lookupAsync(String code, Lang lang, String year, boolean history) {
        String digits;
        try {
            digits = normalizeCode(code);
        } catch (HscodeException e) {
            return failed(e);
        }
        return request(
                "GET",
                "/api/v1/" + langOf(lang) + "/" + yearOf(year) + "/codes/" + digits,
                history ? "history=true" : null,
                null,
                n -> read(n, CodeDetail.class));
    }

    public CodeDetail history(String code) {
        return lookup(code, null, null, true);
    }

    /** Same as lookup with history. Use it for duty history by year. */
    public CodeDetail history(String code, Lang lang, String year) {
        return lookup(code, lang, year, true);
    }

    public CompletableFuture<CodeDetail> historyAsync(String code) {
        return lookupAsync(code, null, null, true);
    }

    public CompletableFuture<CodeDetail> historyAsync(String code, Lang lang, String year) {
        return lookupAsync(code, lang, year, true);
    }

    // ---- search ----

    public List<SearchHit> search(String query) {
        return search(query, null, null);
    }

    /** GET /api/v1/{lang}/{year}/search. Matches codes by words. */
    public List<SearchHit> search(String query, Lang lang, String year) {
        return await(searchAsync(query, lang, year));
    }

    public CompletableFuture<List<SearchHit>> searchAsync(String query) {
        return searchAsync(query, null, null);
    }

    public CompletableFuture<List<SearchHit>> searchAsync(String query, Lang lang, String year) {
        if (query == null) return failed(invalid("Query is required."));
        return request(
                "GET",
                "/api/v1/" + langOf(lang) + "/" + yearOf(year) + "/search",
                "q=" + URLEncoder.encode(query, StandardCharsets.UTF_8),
                null,
                n -> readItems(n, SearchHit.class));
    }

    // ---- duties ----

    public List<ImportDuty> duties(String code) {
        return duties(code, null);
    }

    /** GET /api/v1/{year}/duties/{code}. Import duty per origin. */
    public List<ImportDuty> duties(String code, String year) {
        return await(dutiesAsync(code, year));
    }

    public CompletableFuture<List<ImportDuty>> dutiesAsync(String code) {
        return dutiesAsync(code, null);
    }

    public CompletableFuture<List<ImportDuty>> dutiesAsync(String code, String year) {
        String digits;
        try {
            digits = normalizeCode(code);
        } catch (HscodeException e) {
            return failed(e);
        }
        return request(
                "GET", "/api/v1/" + yearOf(year) + "/duties/" + digits, null, null,
                n -> readItems(n, ImportDuty.class));
    }

    // ---- chapters ----

    public List<NomenclatureItem> chapters() {
        return chapters(null, null);
    }

    /** GET /api/v1/{lang}/{year}/chapters. */
    public List<NomenclatureItem> chapters(Lang lang, String year) {
        return await(chaptersAsync(lang, year));
    }

    public CompletableFuture<List<NomenclatureItem>> chaptersAsync() {
        return chaptersAsync(null, null);
    }

    public CompletableFuture<List<NomenclatureItem>> chaptersAsync(Lang lang, String year) {
        return request(
                "GET", "/api/v1/" + langOf(lang) + "/" + yearOf(year) + "/chapters", null, null,
                n -> readItems(n, NomenclatureItem.class));
    }

    public List<NomenclatureItem> chapter(String chapter) {
        return chapter(chapter, null, null);
    }

    /** GET /api/v1/{lang}/{year}/chapters/{chapter}. The rows of one 2-digit chapter. */
    public List<NomenclatureItem> chapter(String chapter, Lang lang, String year) {
        return await(chapterAsync(chapter, lang, year));
    }

    public CompletableFuture<List<NomenclatureItem>> chapterAsync(String chapter) {
        return chapterAsync(chapter, null, null);
    }

    public CompletableFuture<List<NomenclatureItem>> chapterAsync(String chapter, Lang lang, String year) {
        if (chapter == null || !CHAPTER.matcher(chapter).matches()) {
            return failed(invalid("Chapter must have 2 digits, got \"" + chapter + "\"."));
        }
        return request(
                "GET",
                "/api/v1/" + langOf(lang) + "/" + yearOf(year) + "/chapters/" + chapter,
                null,
                null,
                n -> readItems(n, NomenclatureItem.class));
    }

    // ---- snapshots ----

    /** GET /api/v1/snapshots. */
    public Snapshots snapshots() {
        return await(snapshotsAsync());
    }

    public CompletableFuture<Snapshots> snapshotsAsync() {
        return request("GET", "/api/v1/snapshots", null, null, n -> read(n, Snapshots.class));
    }

    // ---- helpers ----

    /** Strips spaces and dots and checks for 10 digits. */
    public static String normalizeCode(String code) {
        String digits = code == null ? "" : code.replaceAll("[\\s.]", "");
        if (!CODE.matcher(digits).matches()) {
            throw invalid("Goods code must have 10 digits, got \"" + code + "\".");
        }
        return digits;
    }

    private static void putOptions(ObjectNode body, Mode mode, Lang lang) {
        if (mode != null) body.put("mode", mode.value());
        if (lang != null) body.put("lang", lang.value());
    }

    private static String langOf(Lang lang) {
        return (lang == null ? Lang.EN : lang).value();
    }

    private static String yearOf(String year) {
        if (year == null) return "latest";
        return URLEncoder.encode(year, StandardCharsets.UTF_8).replace("+", "%20");
    }

    private static HscodeException invalid(String message) {
        return new HscodeException(0, "invalid_request", message);
    }

    private static <T> CompletableFuture<T> failed(Throwable t) {
        return CompletableFuture.failedFuture(t);
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s;
    }

    private static String stripTrailingSlashes(String s) {
        int end = s.length();
        while (end > 0 && s.charAt(end - 1) == '/') end--;
        return s.substring(0, end);
    }

    private static <T> T read(JsonNode node, Class<T> type) {
        try {
            return MAPPER.treeToValue(node, type);
        } catch (JsonProcessingException e) {
            throw new HscodeException(0, "invalid_response", "Unexpected response shape: " + e.getOriginalMessage(), null, e);
        }
    }

    private static <T> List<T> readItems(JsonNode node, Class<T> type) {
        JsonNode items = node.get("items");
        if (items == null || !items.isArray()) {
            throw new HscodeException(0, "invalid_response", "Response has no items array.");
        }
        try {
            return MAPPER.readerFor(MAPPER.getTypeFactory().constructCollectionType(List.class, type))
                    .readValue(items);
        } catch (IOException e) {
            throw new HscodeException(0, "invalid_response", "Unexpected response shape: " + e.getMessage(), null, e);
        }
    }

    private static <T> T await(CompletableFuture<T> future) {
        try {
            return future.join();
        } catch (CompletionException e) {
            Throwable cause = e.getCause();
            if (cause instanceof HscodeException) throw (HscodeException) cause;
            throw new HscodeException(0, "network_error", String.valueOf(cause), null, cause);
        }
    }

    private <T> CompletableFuture<T> request(
            String method, String path, String query, ObjectNode body, Function<JsonNode, T> parse) {
        if (apiKey == null) {
            return failed(new HscodeException(
                    0, "missing_api_key", "No API key. Pass apiKey or set HSCODE_KEY."));
        }
        HttpRequest request;
        try {
            URI uri = URI.create(baseUrl + path + (query == null ? "" : "?" + query));
            HttpRequest.Builder rb = HttpRequest.newBuilder(uri)
                    .timeout(timeout)
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Accept", "application/json")
                    .header("User-Agent", "hscode-java/" + VERSION);
            if (body == null) {
                rb.GET();
            } else {
                rb.header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(MAPPER.writeValueAsString(body)));
            }
            request = rb.build();
        } catch (IllegalArgumentException | JsonProcessingException e) {
            return failed(new HscodeException(0, "invalid_request", "Bad request: " + e.getMessage(), null, e));
        }
        return http.sendAsync(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8))
                .handle((res, ex) -> {
                    if (ex != null) {
                        Throwable cause = ex instanceof CompletionException && ex.getCause() != null ? ex.getCause() : ex;
                        throw new HscodeException(0, "network_error", String.valueOf(cause), null, cause);
                    }
                    return handleResponse(res, parse);
                });
    }

    private static <T> T handleResponse(HttpResponse<String> res, Function<JsonNode, T> parse) {
        JsonNode data;
        try {
            data = MAPPER.readTree(res.body());
        } catch (IOException e) {
            data = null;
        }
        int status = res.statusCode();
        if (status < 200 || status >= 300) {
            String code = text(data, "error", "http_error");
            String message = text(data, "message", "Request failed with status " + status + ".");
            throw new HscodeException(status, code, message, new QuotaInfo(res.headers()), null);
        }
        if (data == null || data.isNull()) {
            throw new HscodeException(status, "invalid_response", "Response is not valid JSON.");
        }
        return parse.apply(data);
    }

    private static String text(JsonNode node, String field, String fallback) {
        JsonNode v = node == null ? null : node.get(field);
        return v != null && v.isTextual() ? v.asText() : fallback;
    }
}

package info.hscode;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.ServerSocket;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class HscodeClientTest {
    private static final ObjectMapper JSON = new ObjectMapper();

    private static final String DUTY =
            "{\"goods_code\":\"6109100010\",\"origin\":\"Erga omnes\",\"origin_code\":\"1011\","
                    + "\"start_date\":\"2024-01-01\",\"end_date\":\"\",\"duty\":\"12.00 %\","
                    + "\"legal_base\":\"R2658/87\",\"measure_type\":\"Third country duty\",\"meas_type_code\":\"103\"}";

    private static final String RESULT =
            "{\"goods_code\":\"6109100010\",\"description\":\"T-shirts, of cotton\","
                    + "\"path\":[\"61\",\"6109\"],\"score\":0.91,\"confidence\":null,\"reasoning\":null,\"duties\":["
                    + DUTY + "],\"future_field\":1}";

    private StubServer stub;

    @BeforeEach
    void start() throws IOException {
        stub = new StubServer();
    }

    @AfterEach
    void stop() {
        stub.close();
    }

    @Test
    void classifySendsAuthAndBodyAndParsesResponse() throws Exception {
        stub.respond(200, "{\"snapshot\":\"2026-10\",\"mode\":\"accurate\",\"reranked\":true,\"rewrite\":null,"
                + "\"high_confidence\":true,\"results\":[" + RESULT + "],\"question\":{\"options\":["
                + "{\"label\":\"knitted\",\"goods_code\":\"6109100010\"}]},\"disclaimer\":\"Advisory only.\"}");

        ClassifyResponse res = stub.client().build().classify("cotton t-shirt", Mode.ACCURATE, Lang.DE);

        StubServer.Recorded req = stub.last();
        assertEquals("POST", req.method);
        assertEquals("/api/v1/classify", req.uri);
        assertEquals("Bearer test-key", req.authorization);
        JsonNode sent = JSON.readTree(req.body);
        assertEquals("cotton t-shirt", sent.get("text").asText());
        assertEquals("accurate", sent.get("mode").asText());
        assertEquals("de", sent.get("lang").asText());

        assertEquals("2026-10", res.getSnapshot());
        assertTrue(res.isHighConfidence());
        assertNull(res.getRewrite());
        assertEquals("Advisory only.", res.getDisclaimer());
        assertEquals("knitted", res.getQuestion().getOptions().get(0).getLabel());
        ClassifyResult top = res.getResults().get(0);
        assertEquals("6109100010", top.getGoodsCode());
        assertEquals(0.91, top.getScore(), 1e-9);
        assertNull(top.getConfidence());
        assertEquals("12.00 %", top.getDuties().get(0).getDuty());
        assertThrows(UnsupportedOperationException.class, () -> res.getResults().clear());
    }

    @Test
    void classifyOmitsModeAndLangByDefault() throws Exception {
        stub.respond(200, "{\"snapshot\":\"s\",\"mode\":\"fast\",\"reranked\":true,\"rewrite\":null,"
                + "\"high_confidence\":false,\"results\":[],\"question\":null,\"disclaimer\":\"d\"}");
        ClassifyResponse res = stub.client().build().classify("steel nails");
        JsonNode sent = JSON.readTree(stub.last().body);
        assertFalse(sent.has("mode"));
        assertFalse(sent.has("lang"));
        assertNull(res.getQuestion());
        assertTrue(res.getResults().isEmpty());
    }

    @Test
    void lookupNormalizesCodeAndUsesLatestAlias() {
        stub.respond(200, "{\"goods_code\":\"6109100010\",\"description\":\"T-shirts\",\"hierarchy\":[],\"duties\":["
                + DUTY + "]}");
        CodeDetail detail = stub.client().build().lookup("6109 10 00.10");
        assertEquals("GET", stub.last().method);
        assertEquals("/api/v1/en/latest/codes/6109100010", stub.last().uri);
        assertEquals("T-shirts", detail.getDescription());
        assertNull(detail.getSignals());
        assertTrue(detail.getHistory().isEmpty());
    }

    @Test
    void historyAddsQueryAndParsesSnapshots() {
        stub.respond(200, "{\"goods_code\":\"6109100010\",\"description\":\"T\",\"hierarchy\":[],\"duties\":[],"
                + "\"history\":[{\"year\":\"2025\",\"month\":\"01\",\"duties\":[" + DUTY + "]}]}");
        CodeDetail detail = stub.client().build().history("6109100010", Lang.FR, "2025");
        assertEquals("/api/v1/fr/2025/codes/6109100010?history=true", stub.last().uri);
        assertEquals("2025", detail.getHistory().get(0).getYear());
        assertEquals(1, detail.getHistory().get(0).getDuties().size());
    }

    @Test
    void searchEncodesQueryAndUnwrapsItems() {
        stub.respond(200, "{\"items\":[{\"goods_code\":\"6109100010\",\"description\":\"T-shirts\"}]}");
        List<SearchHit> hits = stub.client().build().search("t-shirt & co");
        assertEquals("/api/v1/en/latest/search?q=t-shirt+%26+co", stub.last().uri);
        assertEquals("6109100010", hits.get(0).getGoodsCode());
    }

    @Test
    void dutiesChaptersAndSnapshots() {
        HscodeClient client = stub.client().build();

        stub.respond(200, "{\"items\":[" + DUTY + "]}");
        assertEquals("Erga omnes", client.duties("6109100010").get(0).getOrigin());
        assertEquals("/api/v1/latest/duties/6109100010", stub.last().uri);

        stub.respond(200, "{\"items\":[{\"goods_code\":\"6100000000\",\"description\":\"Apparel\",\"indent\":\"0\",\"hier_pos\":1}]}");
        assertEquals(1, client.chapters().get(0).getHierPos());
        assertEquals("/api/v1/en/latest/chapters", stub.last().uri);
        client.chapter("61", Lang.DE, "2025");
        assertEquals("/api/v1/de/2025/chapters/61", stub.last().uri);

        stub.respond(200, "{\"langs\":[\"de\",\"en\",\"fr\"],\"latest\":{\"year\":\"2026\",\"month\":\"10\"},"
                + "\"snapshots\":[{\"year\":\"2025\",\"month\":\"01\"},{\"year\":\"2026\",\"month\":\"10\"}]}");
        Snapshots s = client.snapshots();
        assertEquals("2026", s.getLatest().getYear());
        assertEquals(2, s.getSnapshots().size());
        assertEquals("/api/v1/snapshots", stub.last().uri);
    }

    @Test
    void authErrorBecomesHscodeException() {
        stub.respond(401, "{\"error\":\"unauthorized\",\"message\":\"Invalid API key.\"}");
        HscodeException e = assertThrows(HscodeException.class, () -> stub.client().build().snapshots());
        assertEquals(401, e.getStatus());
        assertEquals("unauthorized", e.getCode());
        assertEquals("Invalid API key.", e.getMessage());
        assertFalse(e.isQuotaExceeded());
        assertNull(e.getUpgradeUrl());
    }

    @Test
    void quotaExceededCarriesRateLimitHeaders() {
        stub.respond(429, "{\"error\":\"quota_exceeded\",\"message\":\"Plan quota used up.\"}",
                Map.of("RateLimit-Limit", "100", "RateLimit-Remaining", "0", "RateLimit-Reset", "1793700000", "Retry-After", "3600"));
        HscodeException e = assertThrows(HscodeException.class, () -> stub.client().build().lookup("6109100010"));
        assertEquals(429, e.getStatus());
        assertEquals("quota_exceeded", e.getCode());
        assertTrue(e.isQuotaExceeded());
        assertEquals(HscodeException.PRICING_URL, e.getUpgradeUrl());
        QuotaInfo q = e.getQuota();
        assertEquals(100, q.getLimit().getAsLong());
        assertEquals(0, q.getRemaining().getAsLong());
        assertEquals(3600, q.getRetryAfterSeconds().getAsLong());
        assertEquals(1793700000L, q.getReset().getAsLong());
    }

    @Test
    void errorWithoutJsonBodyFallsBackToHttpError() {
        stub.respond(502, "<html>bad gateway</html>");
        HscodeException e = assertThrows(HscodeException.class, () -> stub.client().build().snapshots());
        assertEquals(502, e.getStatus());
        assertEquals("http_error", e.getCode());
        assertEquals("Request failed with status 502.", e.getMessage());
    }

    @Test
    void batchSendsItemsAndKeepsPerItemErrors() throws Exception {
        stub.respond(200, "{\"snapshot\":\"2026-10\",\"mode\":\"fast\",\"disclaimer\":\"d\",\"items\":["
                + "{\"reranked\":true,\"rewrite\":null,\"high_confidence\":true,\"results\":[" + RESULT
                + "],\"question\":null,\"id\":\"SKU-1\",\"error\":null},"
                + "{\"reranked\":false,\"rewrite\":null,\"high_confidence\":false,\"results\":[],\"question\":null,"
                + "\"id\":\"1\",\"error\":\"classification failed\"}]}");

        ClassifyBatchResponse res = stub.client().build().classifyBatch(
                List.of(BatchItem.of("SKU-1", "cotton t-shirt"), BatchItem.of("steel nails")), Mode.FAST, Lang.EN);

        assertEquals("/api/v1/classify/batch", stub.last().uri);
        JsonNode sent = JSON.readTree(stub.last().body);
        assertEquals(2, sent.get("items").size());
        assertEquals("SKU-1", sent.get("items").get(0).get("id").asText());
        assertFalse(sent.get("items").get(1).has("id"));
        assertEquals("steel nails", sent.get("items").get(1).get("text").asText());

        assertEquals(2, res.getItems().size());
        ClassifyBatchItem ok = res.getItems().get(0);
        assertEquals("SKU-1", ok.getId());
        assertEquals("6109100010", ok.getResults().get(0).getGoodsCode());
        assertNull(ok.getError());
        ClassifyBatchItem bad = res.getItems().get(1);
        assertEquals("classification failed", bad.getError());
        assertTrue(bad.getResults().isEmpty());
    }

    @Test
    void batchRejectsEmptyAndOversizedLists() {
        HscodeClient client = stub.client().build();
        assertEquals("invalid_request",
                assertThrows(HscodeException.class, () -> client.classifyBatch(List.of())).getCode());
        List<BatchItem> tooMany = new ArrayList<>();
        for (int i = 0; i < 26; i++) tooMany.add(BatchItem.of("item " + i));
        HscodeException e = assertThrows(HscodeException.class, () -> client.classifyBatch(tooMany));
        assertEquals("invalid_request", e.getCode());
        assertTrue(stub.requests.isEmpty(), "invalid input must not reach the network");

        List<BatchItem> max = new ArrayList<>(tooMany.subList(0, 25));
        stub.respond(200, "{\"snapshot\":\"s\",\"mode\":\"fast\",\"items\":[],\"disclaimer\":\"d\"}");
        client.classifyBatch(max);
        assertEquals(1, stub.requests.size());
    }

    @Test
    void invalidInputFailsBeforeTheNetwork() {
        HscodeClient client = stub.client().build();
        assertEquals("invalid_request", assertThrows(HscodeException.class, () -> client.lookup("1234")).getCode());
        assertEquals("invalid_request", assertThrows(HscodeException.class, () -> client.duties("abc")).getCode());
        assertEquals("invalid_request", assertThrows(HscodeException.class, () -> client.chapter("6")).getCode());
        assertTrue(stub.requests.isEmpty());
    }

    @Test
    void missingApiKeyFailsBeforeTheNetwork() {
        HscodeClient client = HscodeClient.builder().baseUrl(stub.url()).env(name -> null).build();
        HscodeException e = assertThrows(HscodeException.class, client::snapshots);
        assertEquals(0, e.getStatus());
        assertEquals("missing_api_key", e.getCode());
        assertTrue(stub.requests.isEmpty());
    }

    @Test
    void apiKeyFallsBackToHscodeKeyEnvVar() {
        stub.respond(200, "{\"langs\":[],\"latest\":{\"year\":\"2026\",\"month\":\"10\"},\"snapshots\":[]}");
        HscodeClient client = HscodeClient.builder().baseUrl(stub.url() + "/")
                .env(name -> "HSCODE_KEY".equals(name) ? "env-key" : null).build();
        client.snapshots();
        assertEquals("Bearer env-key", stub.last().authorization);
        assertEquals("/api/v1/snapshots", stub.last().uri);
    }

    @Test
    void networkFailureBecomesNetworkError() throws IOException {
        int closedPort;
        try (ServerSocket s = new ServerSocket(0)) {
            closedPort = s.getLocalPort();
        }
        HscodeClient client = HscodeClient.builder().baseUrl("http://127.0.0.1:" + closedPort).apiKey("k").build();
        HscodeException e = assertThrows(HscodeException.class, client::snapshots);
        assertEquals(0, e.getStatus());
        assertEquals("network_error", e.getCode());
    }

    @Test
    void asyncSuccessAndFailure() throws Exception {
        HscodeClient client = stub.client().build();

        stub.respond(200, "{\"items\":[{\"goods_code\":\"6109100010\",\"description\":\"T\"}]}");
        List<SearchHit> hits = client.searchAsync("t-shirt").get(10, TimeUnit.SECONDS);
        assertEquals(1, hits.size());

        stub.respond(429, "{\"error\":\"quota_exceeded\",\"message\":\"m\"}");
        CompletableFuture<CodeDetail> f = client.lookupAsync("6109100010");
        ExecutionException ex = assertThrows(ExecutionException.class, () -> f.get(10, TimeUnit.SECONDS));
        HscodeException cause = assertInstanceOf(HscodeException.class, ex.getCause());
        assertEquals(429, cause.getStatus());

        ExecutionException invalid = assertThrows(ExecutionException.class, () -> client.lookupAsync("12").get());
        assertEquals("invalid_request", ((HscodeException) invalid.getCause()).getCode());
        assertNotNull(invalid.getCause().getMessage());
    }
}

using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Hscode;
using Xunit;

namespace Hscode.Sdk.Tests;

public class HscodeClientTests
{
    private sealed class FakeHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, string?, HttpResponseMessage> _respond;
        public List<(HttpRequestMessage Request, string? Body)> Calls { get; } = new();

        public FakeHandler(Func<HttpRequestMessage, string?, HttpResponseMessage> respond) => _respond = respond;

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            var body = request.Content is null ? null : await request.Content.ReadAsStringAsync();
            Calls.Add((request, body));
            return _respond(request, body);
        }
    }

    private static HttpResponseMessage Json(HttpStatusCode status, string json) =>
        new(status) { Content = new StringContent(json, Encoding.UTF8, "application/json") };

    private static HscodeClient Client(FakeHandler handler, string? key = "test-key") =>
        new(new HscodeClientOptions { ApiKey = key }, new HttpClient(handler));

    private const string ClassifyJson = """
        {"snapshot":"2026-10","mode":"fast","reranked":true,"rewrite":"cotton t-shirts","high_confidence":true,
         "results":[{"goods_code":"6109100010","description":"T-shirts","path":["61","6109"],"score":0.91,
                     "confidence":null,"reasoning":null,"duties":[]}],
         "question":null,"disclaimer":"Advisory only."}
        """;

    [Fact]
    public async Task Classify_sends_bearer_and_body_and_parses_response()
    {
        var handler = new FakeHandler((_, _) => Json(HttpStatusCode.OK, ClassifyJson));
        using var client = Client(handler);

        var res = await client.ClassifyAsync("cotton t-shirt", Mode.Accurate, Lang.De);

        var (req, body) = Assert.Single(handler.Calls);
        Assert.Equal(HttpMethod.Post, req.Method);
        Assert.Equal("https://hscode.info/api/v1/classify", req.RequestUri!.ToString());
        Assert.Equal(new AuthenticationHeaderValue("Bearer", "test-key"), req.Headers.Authorization);
        using var sent = JsonDocument.Parse(body!);
        Assert.Equal("cotton t-shirt", sent.RootElement.GetProperty("text").GetString());
        Assert.Equal("accurate", sent.RootElement.GetProperty("mode").GetString());
        Assert.Equal("de", sent.RootElement.GetProperty("lang").GetString());

        Assert.True(res.HighConfidence);
        Assert.Null(res.Question);
        var top = Assert.Single(res.Results);
        Assert.Equal("6109100010", top.GoodsCode);
        Assert.Null(top.Confidence);
        Assert.Equal(new[] { "61", "6109" }, top.Path);
    }

    [Fact]
    public async Task Unauthorized_raises_hscode_exception_with_api_code()
    {
        var handler = new FakeHandler((_, _) =>
            Json(HttpStatusCode.Unauthorized, """{"error":"unauthorized","message":"Invalid API key."}"""));
        using var client = Client(handler);

        var ex = await Assert.ThrowsAsync<HscodeException>(() => client.ClassifyAsync("shoes"));

        Assert.Equal(401, ex.Status);
        Assert.Equal("unauthorized", ex.Code);
        Assert.Equal("Invalid API key.", ex.Message);
        Assert.False(ex.IsQuotaExceeded);
    }

    [Fact]
    public async Task Quota_exceeded_429_sets_quota_info_and_retry_after()
    {
        var handler = new FakeHandler((_, _) =>
        {
            var res = Json((HttpStatusCode)429, """{"error":"quota_exceeded","message":"Plan quota used up."}""");
            res.Headers.RetryAfter = new RetryConditionHeaderValue(TimeSpan.FromSeconds(3600));
            res.Headers.Add("RateLimit-Limit", "100");
            res.Headers.Add("RateLimit-Remaining", "0");
            res.Headers.Add("RateLimit-Reset", "1793000000");
            return res;
        });
        using var client = Client(handler);

        var ex = await Assert.ThrowsAsync<HscodeException>(() => client.LookupAsync("6109100010"));

        Assert.Equal(429, ex.Status);
        Assert.True(ex.IsQuotaExceeded);
        Assert.Equal("quota_exceeded", ex.Code);
        Assert.Equal(TimeSpan.FromHours(1), ex.RetryAfter);
        Assert.Equal(100, ex.RateLimitLimit);
        Assert.Equal(0, ex.RateLimitRemaining);
        Assert.Equal(DateTimeOffset.FromUnixTimeSeconds(1793000000), ex.RateLimitReset);
    }

    [Fact]
    public async Task Non_json_error_body_falls_back_to_http_error()
    {
        var handler = new FakeHandler((_, _) => new HttpResponseMessage(HttpStatusCode.ServiceUnavailable)
        {
            Content = new StringContent("<html>down</html>")
        });
        using var client = Client(handler);

        var ex = await Assert.ThrowsAsync<HscodeException>(() => client.ClassifyAsync("shoes"));

        Assert.Equal(503, ex.Status);
        Assert.Equal("http_error", ex.Code);
    }

    [Fact]
    public async Task Batch_sends_items_with_positional_ids_and_parses_item_errors()
    {
        const string json = """
            {"snapshot":"2026-10","mode":"fast","disclaimer":"x","items":[
              {"id":"0","reranked":true,"rewrite":null,"high_confidence":false,
               "results":[{"goods_code":"7317000000","description":"Nails","path":[],"score":0.8,"confidence":null,"reasoning":null,"duties":[]}],
               "question":null,"error":null},
              {"id":"SKU-2","reranked":false,"rewrite":null,"high_confidence":false,"results":[],"question":null,"error":"failed"}]}
            """;
        var handler = new FakeHandler((_, _) => Json(HttpStatusCode.OK, json));
        using var client = Client(handler);

        var res = await client.ClassifyBatchAsync(new BatchItem[] { "steel nails", new("bad", "SKU-2") });

        var (req, body) = Assert.Single(handler.Calls);
        Assert.Equal("https://hscode.info/api/v1/classify/batch", req.RequestUri!.ToString());
        using var sent = JsonDocument.Parse(body!);
        var items = sent.RootElement.GetProperty("items");
        Assert.Equal(2, items.GetArrayLength());
        Assert.Equal("SKU-2", items[1].GetProperty("id").GetString());

        Assert.Equal("7317000000", res.Items[0].Results[0].GoodsCode);
        Assert.Null(res.Items[0].Error);
        Assert.Equal("failed", res.Items[1].Error);
        Assert.Empty(res.Items[1].Results);
    }

    [Fact]
    public async Task Batch_of_strings_uses_list_position_as_id()
    {
        var handler = new FakeHandler((_, _) =>
            Json(HttpStatusCode.OK, """{"snapshot":"s","mode":"fast","items":[],"disclaimer":""}"""));
        using var client = Client(handler);

        await client.ClassifyBatchAsync(new[] { "a b", "c d" });

        using var sent = JsonDocument.Parse(handler.Calls[0].Body!);
        var items = sent.RootElement.GetProperty("items");
        Assert.Equal("0", items[0].GetProperty("id").GetString());
        Assert.Equal("1", items[1].GetProperty("id").GetString());
    }

    [Theory]
    [InlineData(0)]
    [InlineData(26)]
    public async Task Batch_rejects_wrong_size_without_a_request(int count)
    {
        var handler = new FakeHandler((_, _) => Json(HttpStatusCode.OK, "{}"));
        using var client = Client(handler);

        var ex = await Assert.ThrowsAsync<HscodeException>(() =>
            client.ClassifyBatchAsync(Enumerable.Repeat("item", count)));

        Assert.Equal("invalid_request", ex.Code);
        Assert.Empty(handler.Calls);
    }

    [Fact]
    public async Task Lookup_normalizes_code_and_defaults_to_latest()
    {
        var handler = new FakeHandler((_, _) => Json(HttpStatusCode.OK,
            """{"goods_code":"6109100010","description":"T-shirts","hierarchy":[],"duties":[],"history":[{"year":"2025","month":"01","duties":[]}]}"""));
        using var client = Client(handler);

        var detail = await client.LookupAsync("6109 10 00 10", Lang.Fr, history: true);

        Assert.Equal("https://hscode.info/api/v1/fr/latest/codes/6109100010?history=true",
            handler.Calls[0].Request.RequestUri!.ToString());
        Assert.Equal("2025", detail.History![0].Year);
    }

    [Fact]
    public async Task Invalid_code_is_rejected_locally()
    {
        var handler = new FakeHandler((_, _) => Json(HttpStatusCode.OK, "{}"));
        using var client = Client(handler);

        var ex = await Assert.ThrowsAsync<HscodeException>(() => client.DutiesAsync("1234"));

        Assert.Equal("invalid_request", ex.Code);
        Assert.Empty(handler.Calls);
    }

    [Fact]
    public async Task Search_escapes_query_and_uses_explicit_year()
    {
        var handler = new FakeHandler((_, _) =>
            Json(HttpStatusCode.OK, """{"items":[{"goods_code":"6109100010","description":"T-shirts"}]}"""));
        using var client = Client(handler);

        var res = await client.SearchAsync("t-shirt & co", year: "2025");

        Assert.Equal("https://hscode.info/api/v1/en/2025/search?q=t-shirt%20%26%20co",
            handler.Calls[0].Request.RequestUri!.AbsoluteUri);
        Assert.Single(res.Items);
    }

    [Fact]
    public async Task Missing_api_key_raises_before_any_request()
    {
        var previous = Environment.GetEnvironmentVariable("HSCODE_KEY");
        Environment.SetEnvironmentVariable("HSCODE_KEY", null);
        try
        {
            var handler = new FakeHandler((_, _) => Json(HttpStatusCode.OK, ClassifyJson));
            using var client = Client(handler, key: null);

            var ex = await Assert.ThrowsAsync<HscodeException>(() => client.ClassifyAsync("shoes"));

            Assert.Equal("missing_api_key", ex.Code);
            Assert.Empty(handler.Calls);
        }
        finally
        {
            Environment.SetEnvironmentVariable("HSCODE_KEY", previous);
        }
    }

    [Fact]
    public async Task Api_key_falls_back_to_environment_variable()
    {
        var previous = Environment.GetEnvironmentVariable("HSCODE_KEY");
        Environment.SetEnvironmentVariable("HSCODE_KEY", "env-key");
        try
        {
            var handler = new FakeHandler((_, _) => Json(HttpStatusCode.OK, ClassifyJson));
            using var client = Client(handler, key: null);

            await client.ClassifyAsync("shoes");

            Assert.Equal("env-key", handler.Calls[0].Request.Headers.Authorization!.Parameter);
        }
        finally
        {
            Environment.SetEnvironmentVariable("HSCODE_KEY", previous);
        }
    }

    [Fact]
    public async Task Caller_cancellation_propagates_as_operation_canceled()
    {
        var handler = new FakeHandler((_, _) => Json(HttpStatusCode.OK, ClassifyJson));
        using var client = Client(handler);
        using var cts = new CancellationTokenSource();
        cts.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => client.SnapshotsAsync(cts.Token));
    }
}

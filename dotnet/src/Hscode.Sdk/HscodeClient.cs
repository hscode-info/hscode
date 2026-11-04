using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;

namespace Hscode;

/// <summary>Client for the hscode.info EU customs tariff API.</summary>
public sealed class HscodeClient : IDisposable
{
    public const int MaxBatchItems = 25;

    private static readonly JsonSerializerOptions Json = new() { PropertyNameCaseInsensitive = true };

    private readonly HttpClient _http;
    private readonly bool _ownsHttp;
    private readonly string? _apiKey;
    private readonly string _baseUrl;

    /// <param name="options">API key and base URL. The key falls back to HSCODE_KEY.</param>
    /// <param name="httpClient">Optional shared client, for example from IHttpClientFactory. The SDK never disposes it.</param>
    public HscodeClient(HscodeClientOptions? options = null, HttpClient? httpClient = null)
    {
        options ??= new HscodeClientOptions();
        _apiKey = !string.IsNullOrEmpty(options.ApiKey) ? options.ApiKey : Environment.GetEnvironmentVariable("HSCODE_KEY");
        _baseUrl = options.BaseUrl.TrimEnd('/');
        if (httpClient is null)
        {
            _http = new HttpClient { Timeout = options.Timeout };
            _ownsHttp = true;
        }
        else
        {
            _http = httpClient;
        }
    }

    public HscodeClient(string apiKey, HttpClient? httpClient = null)
        : this(new HscodeClientOptions { ApiKey = apiKey }, httpClient)
    {
    }

    public void Dispose()
    {
        if (_ownsHttp) _http.Dispose();
    }

    public Task<ClassifyResponse> ClassifyAsync(string text, Mode mode = Mode.Fast, Lang lang = Lang.En, CancellationToken cancellationToken = default) =>
        SendAsync<ClassifyResponse>(HttpMethod.Post, "/api/v1/classify",
            new { text, mode = Wire(mode), lang = Wire(lang) }, cancellationToken);

    /// <summary>One to 25 texts. Each text gets its list position as id.</summary>
    public Task<ClassifyBatchResponse> ClassifyBatchAsync(IEnumerable<string> texts, Mode mode = Mode.Fast, Lang lang = Lang.En, CancellationToken cancellationToken = default) =>
        ClassifyBatchAsync(texts.Select((t, i) => new BatchItem(t, i.ToString(CultureInfo.InvariantCulture))), mode, lang, cancellationToken);

    /// <summary>One to 25 items.</summary>
    public Task<ClassifyBatchResponse> ClassifyBatchAsync(IEnumerable<BatchItem> items, Mode mode = Mode.Fast, Lang lang = Lang.En, CancellationToken cancellationToken = default)
    {
        var list = items.Select(i => new { id = i.Id, text = i.Text }).ToList();
        if (list.Count < 1 || list.Count > MaxBatchItems)
            throw Invalid($"ClassifyBatchAsync takes 1 to {MaxBatchItems} items, got {list.Count}.");
        return SendAsync<ClassifyBatchResponse>(HttpMethod.Post, "/api/v1/classify/batch",
            new { items = list, mode = Wire(mode), lang = Wire(lang) }, cancellationToken);
    }

    /// <summary>Looks up one goods code. A null year means "latest".</summary>
    public Task<CodeDetail> LookupAsync(string code, Lang lang = Lang.En, string? year = null, bool history = false, CancellationToken cancellationToken = default)
    {
        var path = $"/api/v1/{Wire(lang)}/{Segment(year)}/codes/{NormalizeCode(code)}" + (history ? "?history=true" : "");
        return SendAsync<CodeDetail>(HttpMethod.Get, path, null, cancellationToken);
    }

    /// <summary>Same as <see cref="LookupAsync"/> with history, for duty history by year.</summary>
    public Task<CodeDetail> HistoryAsync(string code, Lang lang = Lang.En, string? year = null, CancellationToken cancellationToken = default) =>
        LookupAsync(code, lang, year, true, cancellationToken);

    public Task<SearchResponse> SearchAsync(string query, Lang lang = Lang.En, string? year = null, CancellationToken cancellationToken = default) =>
        SendAsync<SearchResponse>(HttpMethod.Get,
            $"/api/v1/{Wire(lang)}/{Segment(year)}/search?q={Uri.EscapeDataString(query)}", null, cancellationToken);

    public Task<DutiesResponse> DutiesAsync(string code, string? year = null, CancellationToken cancellationToken = default) =>
        SendAsync<DutiesResponse>(HttpMethod.Get, $"/api/v1/{Segment(year)}/duties/{NormalizeCode(code)}", null, cancellationToken);

    public Task<NomenclatureResponse> ChaptersAsync(Lang lang = Lang.En, string? year = null, CancellationToken cancellationToken = default) =>
        SendAsync<NomenclatureResponse>(HttpMethod.Get, $"/api/v1/{Wire(lang)}/{Segment(year)}/chapters", null, cancellationToken);

    public Task<NomenclatureResponse> ChapterAsync(string chapter, Lang lang = Lang.En, string? year = null, CancellationToken cancellationToken = default)
    {
        if (!Regex.IsMatch(chapter ?? "", @"^\d{2}$"))
            throw Invalid($"Chapter must have 2 digits, got \"{chapter}\".");
        return SendAsync<NomenclatureResponse>(HttpMethod.Get, $"/api/v1/{Wire(lang)}/{Segment(year)}/chapters/{chapter}", null, cancellationToken);
    }

    public Task<SnapshotsResponse> SnapshotsAsync(CancellationToken cancellationToken = default) =>
        SendAsync<SnapshotsResponse>(HttpMethod.Get, "/api/v1/snapshots", null, cancellationToken);

    /// <summary>Strips spaces and dots and checks for 10 digits.</summary>
    public static string NormalizeCode(string code)
    {
        var digits = Regex.Replace(code ?? "", @"[\s.]", "");
        if (!Regex.IsMatch(digits, @"^\d{10}$"))
            throw Invalid($"Goods code must have 10 digits, got \"{code}\".");
        return digits;
    }

    private static HscodeException Invalid(string message) => new(0, "invalid_request", message);

    private static string Wire(Lang lang) => lang.ToString().ToLowerInvariant();

    private static string Wire(Mode mode) => mode.ToString().ToLowerInvariant();

    private static string Segment(string? year) =>
        string.IsNullOrWhiteSpace(year) ? "latest" : Uri.EscapeDataString(year!);

    private async Task<T> SendAsync<T>(HttpMethod method, string path, object? body, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(_apiKey))
            throw new HscodeException(0, "missing_api_key", "No API key. Pass ApiKey or set HSCODE_KEY.");

        using var request = new HttpRequestMessage(method, _baseUrl + path);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        if (body is not null)
            request.Content = new StringContent(JsonSerializer.Serialize(body, Json), Encoding.UTF8, "application/json");

        try
        {
            using var response = await _http.SendAsync(request, ct).ConfigureAwait(false);
            var text = await ReadAsync(response, ct).ConfigureAwait(false);
            return Parse<T>(response, text);
        }
        catch (HttpRequestException e)
        {
            throw new HscodeException(0, "network_error", e.Message, null, e);
        }
        catch (OperationCanceledException e) when (!ct.IsCancellationRequested)
        {
            throw new HscodeException(0, "network_error", "The request timed out.", null, e);
        }
    }

    private static Task<string> ReadAsync(HttpResponseMessage response, CancellationToken ct)
    {
#if NET8_0_OR_GREATER
        return response.Content.ReadAsStringAsync(ct);
#else
        ct.ThrowIfCancellationRequested();
        return response.Content.ReadAsStringAsync();
#endif
    }

    private static T Parse<T>(HttpResponseMessage response, string text)
    {
        var status = (int)response.StatusCode;
        if (!response.IsSuccessStatusCode)
        {
            string? error = null, message = null;
            try
            {
                using var doc = JsonDocument.Parse(text);
                if (doc.RootElement.ValueKind == JsonValueKind.Object)
                {
                    if (doc.RootElement.TryGetProperty("error", out var e) && e.ValueKind == JsonValueKind.String) error = e.GetString();
                    if (doc.RootElement.TryGetProperty("message", out var m) && m.ValueKind == JsonValueKind.String) message = m.GetString();
                }
            }
            catch (JsonException)
            {
            }
            throw new HscodeException(status, error ?? "http_error",
                message ?? $"Request failed with status {status}.", RetryAfter(response), null,
                HeaderInt(response, "RateLimit-Limit"), HeaderInt(response, "RateLimit-Remaining"),
                HeaderInt(response, "RateLimit-Reset") is { } reset ? DateTimeOffset.FromUnixTimeSeconds(reset) : null);
        }

        try
        {
            return JsonSerializer.Deserialize<T>(text, Json)
                ?? throw new HscodeException(status, "invalid_response", "The API returned an empty body.");
        }
        catch (JsonException e)
        {
            throw new HscodeException(status, "invalid_response", "The API returned invalid JSON.", null, e);
        }
    }

    private static int? HeaderInt(HttpResponseMessage response, string name) =>
        response.Headers.TryGetValues(name, out var values)
        && int.TryParse(values.FirstOrDefault(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var n)
            ? n
            : null;

    private static TimeSpan? RetryAfter(HttpResponseMessage response)
    {
        var ra = response.Headers.RetryAfter;
        if (ra?.Delta is { } delta) return delta;
        if (ra?.Date is { } date)
        {
            var wait = date - DateTimeOffset.UtcNow;
            return wait > TimeSpan.Zero ? wait : TimeSpan.Zero;
        }
        return null;
    }
}

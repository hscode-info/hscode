# Hscode.Sdk

[![NuGet](https://img.shields.io/nuget/v/Hscode.Sdk)](https://www.nuget.org/packages/Hscode.Sdk)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/hscode-info/hscode/blob/main/LICENSE)
[![CI](https://github.com/hscode-info/hscode/actions/workflows/ci.yml/badge.svg)](https://github.com/hscode-info/hscode/actions/workflows/ci.yml)

EU customs tariff (TARIC) API client for C# and .NET: classify products into HS / CN / TARIC codes and get import duties.

A small client for the [hscode.info](https://hscode.info) HS code API. It covers HS code classification, HS code lookup and import duty for the EU Combined Nomenclature. Use it from Dynamics 365 extensions, forwarder and ERP software, and Windows desktop or service apps.

- German, English and French descriptions. Queries in any language: Zolltarifnummer, nomenclature combinée, tarif douanier.
- Targets `netstandard2.0` (.NET Framework 4.6.2+, .NET Core, Xamarin) and `net8.0`.
- Uses `HttpClient` and `System.Text.Json`. No other dependencies.
- Async methods with `CancellationToken`. Works with `IHttpClientFactory`.
- Typed records for every response.

> [!NOTE]
> Advisory only. Only a BTI from customs is legally binding.

## Install

```bash
dotnet add package Hscode.Sdk
```

Get a key on your [hscode.info account](https://hscode.info/en/account). The free plan has 30 AI units and 100 lookups a day, with no credit card. Paid plans start at $19 a month. See [pricing](https://hscode.info/en/pricing).

## Quick start

```csharp
using Hscode;

using var client = new HscodeClient("..."); // or set HSCODE_KEY
var result = await client.ClassifyAsync("cotton t-shirt", Mode.Accurate);
var top = result.Results[0];
Console.WriteLine($"{top.GoodsCode} {top.Description}");
```

## Reference

`new HscodeClient(HscodeClientOptions? options = null, HttpClient? httpClient = null)`
`new HscodeClient(string apiKey, HttpClient? httpClient = null)`

| Option | Default |
| --- | --- |
| `ApiKey` | the `HSCODE_KEY` environment variable |
| `BaseUrl` | `https://hscode.info` |
| `Timeout` | 60 seconds. Only used when the SDK creates its own `HttpClient`. |

`Lang` is `Lang.En`, `Lang.De` or `Lang.Fr` and defaults to `En`. `Mode` is `Mode.Fast` (Quick, 1 AI unit) or `Mode.Accurate` (Precise, 5 units, adds `Confidence` and `Reasoning`). When you omit `year`, the client uses the `latest` alias.

Goods codes may contain spaces or dots. The client strips them and checks for 10 digits before it sends a request.

Every method takes a trailing `CancellationToken`.

### ClassifyAsync

```csharp
var res = await client.ClassifyAsync("frozen shrimp, peeled", Mode.Accurate, Lang.De);
Console.WriteLine($"{res.Results[0].GoodsCode} {res.Question?.Options.Count}");
```

`POST /api/v1/classify`. Each result has `GoodsCode`, `Description`, `Path`, `Score`, `Confidence`, `Reasoning` and `Duties`.

### ClassifyBatchAsync

```csharp
var res = await client.ClassifyBatchAsync(new BatchItem[] { "cotton t-shirt", new("steel nails", "SKU-2") });
foreach (var item in res.Items)
    Console.WriteLine($"{item.Id} {(item.Results.Count > 0 ? item.Results[0].GoodsCode : item.Error)}");
```

`POST /api/v1/classify/batch`. One to 25 items per call. Pass strings (each gets its list position as `Id`) or `BatchItem(text, id)`. An item that fails has `Error` set. Any other count throws `HscodeException` with code `invalid_request`.

### LookupAsync

```csharp
var detail = await client.LookupAsync("6109 10 00 10", Lang.Fr, year: "2025");
```

`GET /api/v1/{lang}/{year}/codes/{code}`. Returns the description, hierarchy, duties and `Signals` such as quotas and restrictions. Pass `history: true` to add the duties of every yearly snapshot.

### HistoryAsync

```csharp
var detail = await client.HistoryAsync("6109100010");
foreach (var snapshot in detail.History!)
    Console.WriteLine($"{snapshot.Year} {snapshot.Duties.Count}");
```

Same as `LookupAsync` with `history: true`. Use it for duty history by year.

### SearchAsync

```csharp
var hits = (await client.SearchAsync("t-shirt")).Items;
```

`GET /api/v1/{lang}/{year}/search`. Matches codes by words.

### DutiesAsync

```csharp
var duties = (await client.DutiesAsync("6109100010")).Items;
```

`GET /api/v1/{year}/duties/{code}`. Import duty per origin, with legal base and measure type. Use it as the input of a customs duty calculator.

### ChaptersAsync and ChapterAsync

```csharp
var chapters = (await client.ChaptersAsync()).Items;
var rows = (await client.ChapterAsync("61")).Items;
```

The nomenclature chapters, and the rows of one 2-digit chapter.

### SnapshotsAsync

```csharp
var snapshots = await client.SnapshotsAsync();
Console.WriteLine(snapshots.Latest.Year);
```

The yearly TARIC snapshots.

## Dependency injection and IHttpClientFactory

Pass an `HttpClient` from the factory. The SDK does not dispose a client you give it, and it sets the `Authorization` header per request, so the same `HttpClient` can be shared.

```csharp
services.AddHttpClient("hscode");
services.AddSingleton(sp => new HscodeClient(
    new HscodeClientOptions { ApiKey = config["Hscode:ApiKey"] },
    sp.GetRequiredService<IHttpClientFactory>().CreateClient("hscode")));
```

With an injected `HttpClient`, `Timeout` is the `HttpClient.Timeout` you configured. Add retry or logging with a `DelegatingHandler` or Polly on that client.

## Classify a list of products

`ClassifyBatchAsync` takes 25 items at most. Split a longer list in chunks of 25.

```csharp
var codes = new List<string?>();
foreach (var chunk in descriptions.Chunk(25)) // .NET 6+; on netstandard2.0 slice the list yourself
{
    var res = await client.ClassifyBatchAsync(chunk);
    codes.AddRange(res.Items.Select(i => i.Results.FirstOrDefault()?.GoodsCode));
}
```

## Errors

Every failure throws `HscodeException`.

```csharp
try
{
    await client.LookupAsync("1234");
}
catch (HscodeException e)
{
    Console.WriteLine($"{e.Status} {e.Code} {e.Message}");
}
```

| Member | Meaning |
| --- | --- |
| `Status` | HTTP status (400, 401, 404, 429, 503). `0` for errors raised before a response. |
| `Code` | The API `error` string, or `invalid_request`, `missing_api_key`, `network_error` and `invalid_response` for local errors. |
| `Message` | A readable message. |
| `IsQuotaExceeded` | `true` on HTTP 429. |
| `RetryAfter` | The `Retry-After` header (seconds) as a `TimeSpan`, when the API sends one. |
| `RateLimitLimit` | The `RateLimit-Limit` header, when present. |
| `RateLimitRemaining` | The `RateLimit-Remaining` header, when present. |
| `RateLimitReset` | The `RateLimit-Reset` header (unix timestamp in seconds) as a `DateTimeOffset`, when present. |

On HTTP 429 your plan quota is used up. See [pricing](https://hscode.info/en/pricing). Cancelling through your `CancellationToken` throws `OperationCanceledException`, not `HscodeException`. A request timeout throws `HscodeException` with code `network_error`.

## Accuracy

On 1,000 real EU Binding Tariff Information (BTI, also called EBTI) rulings sampled from a pool of about 120,000, covering 94 chapters, the first suggestion is right at 2 digits (chapter) in 91 %, at 4 digits (heading) in 87.9 % and at 6 digits (subheading) in 84.7 %. As of October 2026, Precise mode. Details: [accuracy](https://hscode.info/en/info/accuracy).

Advisory only. Only a BTI from customs is legally binding.

## For AI agents

The same tools are available as an MCP server at [hscode.info/mcp](https://hscode.info/mcp): `classify`, `lookup_code`, `search_codes` and `duty_history`. Setup is on the [developers page](https://hscode.info/en/developers). See also [llms.txt](https://hscode.info/llms.txt).

## Links

- [hscode.info](https://hscode.info): HS code lookup and classification
- [Developers](https://hscode.info/en/developers)
- [API reference](https://hscode.info/api/v1/docs) and [OpenAPI spec](https://hscode.info/api/v1/openapi.json)
- [Pricing](https://hscode.info/en/pricing)
- [HS codes by product](https://hscode.info/en/hs-code)
- [TypeScript SDK and CLI on npm](https://www.npmjs.com/package/@hscode/sdk)
- [Python package on PyPI](https://pypi.org/project/hscode/)
- [Source on GitHub](https://github.com/hscode-info/hscode)

MIT license.

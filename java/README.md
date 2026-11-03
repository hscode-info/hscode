# hscode-sdk

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/hscode-info/hscode/blob/main/LICENSE)
[![CI](https://github.com/hscode-info/hscode/actions/workflows/ci.yml/badge.svg)](https://github.com/hscode-info/hscode/actions/workflows/ci.yml)

EU customs tariff (TARIC) API client for Java: classify products into HS / CN / TARIC codes and get import duties.

A small client for the [hscode.info](https://hscode.info) HS code API. It covers HS code classification, HS code lookup and import duty for the EU Combined Nomenclature. Built for SAP BTP, ERP and logistics systems.

- German, English and French descriptions. Queries in any language: Zolltarifnummer, nomenclature combinée, tarif douanier.
- One dependency: Jackson databind. HTTP uses `java.net.http.HttpClient`. Java 11 or newer.
- Immutable response classes. Every method has a blocking form and a `CompletableFuture` form.
- Built for batch jobs: classify a product export in chunks of 25.

> [!NOTE]
> Advisory only. Only a BTI from customs is legally binding.

## Install

```xml
<dependency>
  <groupId>info.hscode</groupId>
  <artifactId>hscode-sdk</artifactId>
  <version>0.1.0</version>
</dependency>
```

The artifact is not published to Maven Central yet. Until then, run `mvn install` in the `java` directory.

Get a key on your [hscode.info account](https://hscode.info/en/account). The free plan has 30 AI units and 100 lookups a day, with no credit card. Paid plans start at $19 a month. See [pricing](https://hscode.info/en/pricing).

## Quick start

```java
import info.hscode.*;

HscodeClient client = HscodeClient.builder().apiKey("...").build(); // or set HSCODE_KEY
ClassifyResponse res = client.classify("cotton t-shirt", Mode.ACCURATE, Lang.EN);
ClassifyResult top = res.getResults().get(0);
System.out.println(top.getGoodsCode() + " " + top.getDescription());
```

## Reference

`HscodeClient.builder()` options:

| Option | Default |
| --- | --- |
| `apiKey(String)` | the `HSCODE_KEY` environment variable |
| `baseUrl(String)` | `https://hscode.info` |
| `timeout(Duration)` | 60 seconds per request. Allow 150 seconds for an accurate batch of 25. |
| `httpClient(HttpClient)` | a new `HttpClient`. Pass your own for proxies, TLS settings or tests. |

`Lang` is `DE`, `EN` or `FR` and defaults to `EN`. `Mode` is `FAST` (Quick, 1 AI unit) or `ACCURATE` (Precise, 5 units, adds `confidence` and `reasoning`). Pass `null` for `lang`, `mode` or `year` to use the default. When you omit `year`, the client sends the `latest` alias.

Goods codes may contain spaces or dots. The client strips them and checks for 10 digits before it sends a request.

Each method below also exists as `...Async`, for example `classifyAsync`, returning a `CompletableFuture`. The client is thread-safe.

### classify

```java
ClassifyResponse res = client.classify("frozen shrimp, peeled", Mode.ACCURATE, Lang.DE);
System.out.println(res.getResults().get(0).getGoodsCode() + " " + res.getQuestion() + " " + res.getDisclaimer());
```

`POST /api/v1/classify`. Each result has `getGoodsCode()`, `getDescription()`, `getPath()`, `getScore()`, `getConfidence()` (nullable), `getReasoning()` (nullable) and `getDuties()`.

### classifyBatch

```java
ClassifyBatchResponse res = client.classifyBatch(List.of(
    BatchItem.of("cotton t-shirt"),
    BatchItem.of("SKU-2", "steel nails")));
for (ClassifyBatchItem item : res.getItems()) {
    System.out.println(item.getId() + " " + (item.getError() != null ? item.getError()
        : item.getResults().get(0).getGoodsCode()));
}
```

`POST /api/v1/classify/batch`. One to 25 items per call, checked before the request. An item without an id gets its list position as id. An item that fails has `getError()` set and empty results.

### lookup

```java
CodeDetail detail = client.lookup("6109 10 00 10", Lang.FR, "2025", false);
```

`GET /api/v1/{lang}/{year}/codes/{code}`. Returns the description, hierarchy, duties and `getSignals()` such as quotas and restrictions (null for past years). `client.lookup(code)` uses the defaults.

### history

```java
for (HistoryEntry e : client.history("6109100010").getHistory()) {
    System.out.println(e.getYear() + " " + e.getDuties().size());
}
```

Same as `lookup` with the history flag. Use it for duty history by year.

### search

```java
List<SearchHit> hits = client.search("t-shirt");
```

`GET /api/v1/{lang}/{year}/search`. Matches codes by words.

### duties

```java
List<ImportDuty> duties = client.duties("6109100010");
```

`GET /api/v1/{year}/duties/{code}`. Import duty per origin, with legal base and measure type. Use it as the input of a customs duty calculator.

### chapters and chapter

```java
List<NomenclatureItem> chapters = client.chapters();
List<NomenclatureItem> rows = client.chapter("61");
```

The nomenclature chapters, and the rows of one 2-digit chapter.

### snapshots

```java
Snapshots snapshots = client.snapshots();
System.out.println(snapshots.getLatest().getYear());
```

The yearly TARIC snapshots from 2016 to 2026.

`search`, `duties`, `chapters` and `chapter` return the `items` list of the API response directly.

## Classify a product export

`classifyBatch` takes 25 items at most. Split the list in chunks of 25.

```java
List<String> texts = ...; // product descriptions
List<String> codes = new ArrayList<>();
for (int start = 0; start < texts.size(); start += HscodeClient.MAX_BATCH_SIZE) {
    List<BatchItem> chunk = texts.subList(start, Math.min(start + 25, texts.size()))
        .stream().map(BatchItem::of).collect(Collectors.toList());
    for (ClassifyBatchItem item : client.classifyBatch(chunk).getItems()) {
        codes.add(item.getResults().isEmpty() ? null : item.getResults().get(0).getGoodsCode());
    }
}
```

## Errors

Every failure throws `HscodeException`, an unchecked exception. The async methods fail the future with it as the cause.

```java
try {
    client.lookup("1234");
} catch (HscodeException e) {
    System.out.println(e.getStatus() + " " + e.getCode() + " " + e.getMessage());
}
```

| Field | Meaning |
| --- | --- |
| `getStatus()` | HTTP status (400, 401, 404, 429, 503). `0` for errors raised before a response. |
| `getCode()` | The API `error` string, or `invalid_request`, `missing_api_key`, `network_error`, `invalid_response` and `http_error` for local or unnamed errors. |
| `getMessage()` | A readable message. |
| `isQuotaExceeded()` | True on HTTP 429: your plan quota is used up. |
| `getUpgradeUrl()` | The [pricing](https://hscode.info/en/pricing) URL on a 429, else `null`. |
| `getQuota()` | `QuotaInfo` from the response headers, `null` without a response. |

`QuotaInfo` reads `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` (a Unix timestamp in seconds) and `Retry-After` (seconds). Each value is an empty `OptionalLong` when the header is missing. `getHeaders()` returns all headers.

```java
catch (HscodeException e) {
    if (e.isQuotaExceeded()) {
        e.getQuota().getRetryAfterSeconds().ifPresent(s -> System.out.println("retry in " + s + " s"));
    }
}
```

## Testing

Point the client at a local server with `baseUrl`, or pass your own `HttpClient`. The tests in this repository use `com.sun.net.httpserver` and need no network.

```bash
docker run --rm -v "$PWD":/src -w /src maven:3-eclipse-temurin-11 mvn -q verify
```

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
- [TypeScript SDK and CLI on npm](https://www.npmjs.com/package/@hscode/sdk)
- [Python SDK on PyPI](https://pypi.org/project/hscode/)
- [Source on GitHub](https://github.com/hscode-info/hscode)

MIT license.

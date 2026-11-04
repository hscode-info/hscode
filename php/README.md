# hscode/sdk

[![Packagist](https://img.shields.io/packagist/v/hscode/sdk)](https://packagist.org/packages/hscode/sdk)
[![PHP versions](https://img.shields.io/packagist/php-v/hscode/sdk)](https://packagist.org/packages/hscode/sdk)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/hscode-info/hscode/blob/main/LICENSE)
[![CI](https://github.com/hscode-info/hscode/actions/workflows/ci.yml/badge.svg)](https://github.com/hscode-info/hscode/actions/workflows/ci.yml)

EU customs tariff (TARIC) API client for PHP: classify products into HS / CN / TARIC codes and get import duties.

A small client for the [hscode.info](https://hscode.info) HS code API. It covers HS code classification, HS code lookup and import duty for the EU Combined Nomenclature.

- German, English and French descriptions. Queries in any language: Zolltarifnummer, nomenclature combinée, tarif douanier.
- Fits Shopware, Magento and WooCommerce. It talks PSR-18 and PSR-17, so it reuses the Guzzle or Symfony HTTP client your platform already ships.
- Three runtime dependencies, all PSR interfaces or discovery. PHP 8.1 or newer.
- Responses are plain arrays with documented shapes (PHPStan `@phpstan-type` aliases), so they go straight into Twig, `json_encode` or your entity mapper.
- Built for shops: classify a product export in chunks of 25.

> [!NOTE]
> Advisory only. Only a BTI from customs is legally binding.

## Install

```bash
composer require hscode/sdk
```

If the project has no PSR-18 client yet, add one: `composer require guzzlehttp/guzzle` (Shopware and Magento already include it) and a PSR-17 implementation such as `nyholm/psr7`. Guzzle 7 needs `guzzlehttp/psr7`, which it already requires.

Get a key on your [hscode.info account](https://hscode.info/en/account). The free plan has 30 AI units and 100 lookups a day, with no credit card. Paid plans start at $19 a month. See [pricing](https://hscode.info/en/pricing).

## Quick start

```php
use Hscode\Client;

$client = new Client(apiKey: '...'); // or set HSCODE_KEY
$result = $client->classify('cotton t-shirt', mode: 'accurate');
$top = $result['results'][0];
echo $top['goods_code'], ' ', $top['description'];
```

The CLI ships with the npm package, not with this one: `npx @hscode/sdk classify "cotton t-shirt"`. See the [TypeScript SDK and CLI](https://www.npmjs.com/package/@hscode/sdk).

## Reference

`new Client(?string $apiKey = null, ?string $baseUrl = null, ?ClientInterface $httpClient = null, ?RequestFactoryInterface $requestFactory = null, ?StreamFactoryInterface $streamFactory = null)`

| Argument | Default |
| --- | --- |
| `apiKey` | the `HSCODE_KEY` environment variable |
| `baseUrl` | `https://hscode.info` |
| `httpClient` | a PSR-18 client found by `php-http/discovery`. Pass your own, for example the Guzzle client of your platform, or a fake in tests. |
| `requestFactory`, `streamFactory` | PSR-17 factories found by `php-http/discovery` |

PSR-18 has no timeout setting. Set it on your HTTP client: `new GuzzleHttp\Client(['timeout' => 60])`. Allow 30 s for a fast batch of 25 and 150 s for an accurate one.

`lang` is `'de'`, `'en'` or `'fr'` and defaults to `'en'`. `mode` is `'fast'` (Quick, 1 AI unit) or `'accurate'` (Precise, 5 units, adds `confidence` and `reasoning`). When you omit `year`, the client sends the `latest` alias.

Goods codes may contain spaces or dots. The client strips them and checks for 10 digits before it sends a request.

### classify

```php
$res = $client->classify('frozen shrimp, peeled', mode: 'accurate', lang: 'de');
echo $res['results'][0]['goods_code'];
```

`POST /api/v1/classify`. Each result has `goods_code`, `description`, `path`, `score`, `confidence`, `reasoning` and `duties`. The response also has `question` and `disclaimer`.

### classifyBatch

```php
$res = $client->classifyBatch(['cotton t-shirt', ['id' => 'SKU-2', 'text' => 'steel nails']]);
foreach ($res['items'] as $item) {
    echo $item['id'], ' ', $item['results'][0]['goods_code'] ?? $item['error'], "\n";
}
```

`POST /api/v1/classify/batch`. One to 25 items per call. An item is a string or an array with `text` and an optional `id`. A string gets its list position as `id`. An item that fails has `error` set.

### lookup

```php
$detail = $client->lookup('6109 10 00 10', lang: 'fr', year: '2025');
```

`GET /api/v1/{lang}/{year}/codes/{code}`. Returns the description, hierarchy, duties and signals such as quotas and restrictions. Pass `history: true` to add the duties of every yearly snapshot.

### history

```php
$detail = $client->history('6109100010');
foreach ($detail['history'] as $snapshot) {
    echo $snapshot['year'], ' ', count($snapshot['duties']), "\n";
}
```

Same as `lookup` with `history: true`. Use it for duty history by year.

### search

```php
$hits = $client->search('t-shirt')['items'];
```

`GET /api/v1/{lang}/{year}/search`. Matches codes by words.

### duties

```php
$duties = $client->duties('6109100010')['items'];
```

`GET /api/v1/{year}/duties/{code}`. Import duty per origin, with legal base and measure type. Use it as the input of a customs duty calculator.

### chapters and chapter

```php
$chapters = $client->chapters()['items'];
$rows = $client->chapter('61')['items'];
```

The nomenclature chapters, and the rows of one 2-digit chapter.

### snapshots

```php
$snapshots = $client->snapshots();
echo $snapshots['latest']['year'];
```

The yearly TARIC snapshots from 2016 to 2026.

## Use your platform's HTTP client

```php
use GuzzleHttp\Client as Guzzle;
use Hscode\Client;

$client = new Client(
    apiKey: $config->get('hscode.key'),
    httpClient: new Guzzle(['timeout' => 60, 'http_errors' => false]),
);
```

Any PSR-18 client works. Guzzle throws on 4xx and 5xx by default when used directly. Set `http_errors => false`, or the SDK reports those as `network_error` instead of reading the API error.

## Classify a product export

`classifyBatch` takes 25 items at most. Split the list in chunks of 25.

```php
use Hscode\Client;

$client = new Client();
$products = array_map('str_getcsv', file('products.csv'));
$codes = [];

foreach (array_chunk($products, 25) as $chunk) {
    $items = array_map(fn ($row) => ['id' => $row[0], 'text' => $row[1]], $chunk);
    foreach ($client->classifyBatch($items)['items'] as $item) {
        $codes[$item['id']] = $item['results'][0]['goods_code'] ?? null;
    }
}
```

## Errors

Every failure throws `Hscode\HscodeException`.

```php
use Hscode\Client;
use Hscode\HscodeException;

$client = new Client();
try {
    $client->lookup('1234');
} catch (HscodeException $e) {
    echo $e->status, ' ', $e->errorCode, ' ', $e->getMessage();
}
```

| Property | Meaning |
| --- | --- |
| `status` | HTTP status (400, 401, 404, 429, 503). `0` for errors raised before a response. |
| `errorCode` | The API `error` string, or `invalid_request`, `missing_api_key` and `network_error` for local errors. `getCode()` returns the status, as PHP requires an int. |
| `getMessage()` | A readable message. |
| `retryAfter` | On 429: seconds from the `Retry-After` header, or `null`. |
| `rateLimit` | `['limit' => ?int, 'remaining' => ?int, 'reset' => ?int]` from the `RateLimit-*` headers. Values are `null` when the API does not send them. |
| `isQuotaExceeded()` | `true` on HTTP 429. |

On HTTP 429 your plan quota is used up. See [pricing](https://hscode.info/en/pricing).

```php
try {
    $client->classify('shoes');
} catch (HscodeException $e) {
    if ($e->isQuotaExceeded()) {
        // queue the product for later, wait $e->retryAfter seconds if set
    }
}
```

## Tests

```bash
composer install
vendor/bin/phpunit
```

The tests use a fake PSR-18 client and make no network calls.

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
- [Python SDK on PyPI](https://pypi.org/project/hscode/)
- [Source on GitHub](https://github.com/hscode-info/hscode)

MIT license.

# hscode

[![PyPI](https://img.shields.io/pypi/v/hscode)](https://pypi.org/project/hscode/)
[![Python versions](https://img.shields.io/pypi/pyversions/hscode)](https://pypi.org/project/hscode/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/hscode-info/hscode/blob/main/LICENSE)
[![CI](https://github.com/hscode-info/hscode/actions/workflows/ci.yml/badge.svg)](https://github.com/hscode-info/hscode/actions/workflows/ci.yml)

EU customs tariff (TARIC) API client for Python: classify products into HS / CN / TARIC codes and get import duties.

A small client for the [hscode.info](https://hscode.info) HS code API. It covers HS code classification, HS code lookup and import duty for the EU Combined Nomenclature.

- German, English and French descriptions. Queries in any language: Zolltarifnummer, nomenclature combinée, tarif douanier.
- Zero dependencies. It uses the standard library only. Python 3.9 or newer.
- Typed. Responses are `TypedDict`s and the package ships `py.typed`.
- Built for data teams: classify a pandas column or a product export in chunks of 25.

> [!NOTE]
> Advisory only. Only a BTI from customs is legally binding.

## Install

```bash
pip install hscode
```

Get a key on your [hscode.info account](https://hscode.info/en/account). The free plan has 30 AI units and 100 lookups a day, with no credit card. Paid plans start at $19 a month. See [pricing](https://hscode.info/en/pricing).

## Quick start

```python
from hscode import Client

client = Client(api_key="...")  # or set HSCODE_KEY
result = client.classify("cotton t-shirt", mode="accurate")
top = result["results"][0]
print(top["goods_code"], top["description"])
```

The CLI ships with the npm package, not with this one: `npx @hscode/sdk classify "cotton t-shirt"`. See the [TypeScript SDK and CLI](https://www.npmjs.com/package/@hscode/sdk).

## Reference

`Client(api_key=None, base_url="https://hscode.info", timeout=60, opener=None)`

| Argument | Default |
| --- | --- |
| `api_key` | the `HSCODE_KEY` environment variable |
| `base_url` | `https://hscode.info` |
| `timeout` | 60 seconds |
| `opener` | `urllib.request.urlopen`. Pass your own callable `(request, timeout=...)` to fake the network in tests. |

`lang` is `"de"`, `"en"` or `"fr"` and defaults to `"en"`. `mode` is `"fast"` (Quick, 1 AI unit) or `"accurate"` (Precise, 5 units, adds `confidence` and `reasoning`). When you omit `year`, the client looks up the latest snapshot once and reuses it.

Goods codes may contain spaces or dots. The client strips them and checks for 10 digits before it sends a request.

### classify

```python
res = client.classify("frozen shrimp, peeled", mode="accurate", lang="de")
print(res["results"][0]["goods_code"], res["question"], res["disclaimer"])
```

`POST /api/v1/classify`. Each result has `goods_code`, `description`, `path`, `score`, `confidence`, `reasoning` and `duties`.

### classify_batch

```python
res = client.classify_batch(["cotton t-shirt", {"id": "SKU-2", "text": "steel nails"}])
for item in res["items"]:
    print(item["id"], item["results"][0]["goods_code"] if item["results"] else item["error"])
```

`POST /api/v1/classify/batch`. One to 25 items per call. An item is a string or a dict with `text` and an optional `id`. A string gets its list position as `id`. An item that fails has `error` set.

### lookup

```python
detail = client.lookup("6109 10 00 10", year="2025", lang="fr")
```

`GET /api/v1/{lang}/{year}/codes/{code}`. Returns the description, hierarchy, duties and signals such as quotas and restrictions. Pass `history=True` to add the duties of every yearly snapshot.

### history

```python
detail = client.history("6109100010")
for snapshot in detail["history"]:
    print(snapshot["year"], len(snapshot["duties"]))
```

Same as `lookup` with `history=True`. Use it for duty history by year.

### search

```python
hits = client.search("t-shirt")["items"]
```

`GET /api/v1/{lang}/{year}/search`. Matches codes by words.

### duties

```python
duties = client.duties("6109100010")["items"]
```

`GET /api/v1/{year}/duties/{code}`. Import duty per origin, with legal base and measure type. Use it as the input of a customs duty calculator.

### chapters and chapter

```python
chapters = client.chapters()["items"]
rows = client.chapter("61")["items"]
```

The nomenclature chapters, and the rows of one 2-digit chapter.

### snapshots

```python
snapshots = client.snapshots()
print(snapshots["latest"])
```

The yearly TARIC snapshots from 2016 to 2026.

## Classify a pandas column

`classify_batch` takes 25 items at most. Split the column in chunks of 25.

```python
import pandas as pd
from hscode import Client

client = Client()
df = pd.read_csv("products.csv")
texts = df["description"].astype(str).tolist()

codes = []
for start in range(0, len(texts), 25):
    chunk = texts[start : start + 25]
    for item in client.classify_batch(chunk)["items"]:
        top = item["results"][0] if item["results"] else None
        codes.append(top["goods_code"] if top else None)

df["hs_code"] = codes
df.to_csv("classified.csv", index=False)
```

pandas is only used in this example. The package does not depend on it.

## Errors

Every failure raises `HscodeError`.

```python
from hscode import Client, HscodeError

client = Client()
try:
    client.lookup("1234")
except HscodeError as e:
    print(e.status, e.code, e.message)
```

| Field | Meaning |
| --- | --- |
| `status` | HTTP status (400, 401, 404, 429, 503). `0` for errors raised before a response. |
| `code` | The API `error` string, or `invalid_request`, `missing_api_key` and `network_error` for local errors. |
| `message` | A readable message. `str(e)` returns it. |

On HTTP 429 your plan quota is used up. See [pricing](https://hscode.info/en/pricing).

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
- [Source on GitHub](https://github.com/hscode-info/hscode)

MIT license.

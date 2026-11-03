# HS Code for Google Sheets

Classify products into EU customs codes (CN / TARIC) and look up duties from a cell, using the [hscode.info](https://hscode.info) API.

```
=HSCODE("leather shoes, men")        ->  6403999990
=HSCODE(A2:A200)                     ->  one code per row, 25 rows per API call
=HSCODE_DESCRIPTION(B2)              ->  official description
=HSCODE_DUTY(B2, "CN")               ->  12.00 %
=HSCODE_VALID(B2)                    ->  TRUE / FALSE
```

> [!NOTE]
> Advisory only. Only a BTI from customs is legally binding.

## Install

Apps Script project bound to a spreadsheet, deployed with [clasp](https://github.com/google/clasp).

1. Create a Google Sheet. Open Extensions > Apps Script and copy the Script ID from Project Settings.
2. In this folder: `cp .clasp.json.example .clasp.json`, put the Script ID in it.
3. `npx @google/clasp login`, then `npx @google/clasp push`.
4. Reload the sheet. A menu **HS Code** appears. Run **HS Code > Set API key...**, paste your key from [hscode.info/en/account](https://hscode.info/en/account), press Save, then Test.
5. Google asks you to authorise the script the first time (external requests and sidebar UI).

Without clasp: in the Apps Script editor create files `core`, `Code` (Script), `Sidebar` (HTML) and paste `src/core.js`, `src/Code.js`, `src/Sidebar.html`, and replace the manifest (Project Settings > Show appsscript.json) with `src/appsscript.json`.

The key is stored with `PropertiesService.getUserProperties()`: per user, not in the sheet, not shared when you share the sheet. Each person who uses the sheet needs their own key.

## Functions

Every function accepts a single value or a range and returns the same shape. Blank cells stay blank.

| Function | Returns |
| --- | --- |
| `HSCODE(text, [mode], [lang])` | Best 10-digit goods code, as text. `mode`: `"fast"` (default) or `"accurate"`. `lang`: `"en"` (default), `"de"`, `"fr"`. |
| `HSCODE_DESCRIPTION(code, [lang])` | Official description of the code in the latest tariff snapshot. |
| `HSCODE_DUTY(code, [origin])` | Third-country (erga omnes) duty such as `12.00 %`. With `origin` (`"CN"`, `"US"` or the origin name): the duty the tariff lists for that origin, otherwise the third-country duty. |
| `HSCODE_VALID(code)` | `TRUE` if the code exists, `FALSE` if it is malformed or unknown. |

Codes may contain spaces or dots. 8-digit CN codes get `00` appended. A code typed as a number that lost its leading zero (9 digits) is padded back to 10. Format code columns as plain text to be safe.

### Errors

A single-cell call shows `#ERROR!` and the message appears on hover. In a range, the failing cell shows `#ERROR: <message>` as text and the other cells keep their results.

| Situation | Message starts with |
| --- | --- |
| No key saved | `No API key set.` |
| Key rejected (401) | `Invalid API key.` |
| Quota used up (429) | `Quota exceeded for your plan.` plus `Retry in N s` when the API sends `Retry-After` |
| Code not in tariff | `Unknown code "..."` |
| Text shorter than 2 or longer than 500 characters | `Description needs...` |
| No match, row failed | `No matching code found.` / `Could not classify: ...` |

## Quota and caching

- `HSCODE` costs 1 AI unit per description in `fast` mode and 5 in `accurate` mode. The free plan has 30 AI units and 100 lookups a day. `HSCODE_DESCRIPTION`, `HSCODE_DUTY` and `HSCODE_VALID` each use one lookup per distinct code, and share one cached response per code. See [pricing](https://hscode.info/en/pricing).
- A range is sent as batches of 25 rows, in parallel. Identical rows are sent once.
- Results are cached 6 hours per user (Apps Script `CacheService`), so sheet recalculation, reloads and copied formulas do not use quota. Errors are not cached.
- Apps Script limits a custom function to 30 s. `accurate` mode takes 6 to 30 s per batch, so use `fast` for long ranges, or classify in chunks.
- Editing the description text changes the cache key, so each edit is a new request. Sheets recalculates a formula on every edit of its inputs, so avoid typing into a range that feeds a large `HSCODE` range.

## Development

```bash
npm test      # node --test, no dependencies
```

| File | Role |
| --- | --- |
| `src/core.js` | Pure logic: request building, response parsing, batching, cache keys, duty selection. Tested in Node. |
| `src/Code.js` | Custom functions, menu, key storage, UrlFetchApp and CacheService glue. |
| `src/Sidebar.html` | "Set API key" sidebar. |
| `src/appsscript.json` | Manifest (V8, scopes, URL allowlist). |

`excel/src/core.js` is a copy of `src/core.js`. Change both together; the Excel tests fail if they differ.

MIT licence.

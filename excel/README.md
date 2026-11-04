# HS Code for Excel

Classify products into EU customs codes (CN / TARIC) and look up duties from a cell, using the [hscode.info](https://hscode.info) API. An Office Add-in with custom functions on a shared runtime (Excel on the web, Windows and Mac, Microsoft 365).

```
=HSCODE.CODE("leather shoes, men")   ->  6403999990
=HSCODE.CODE(A2:A200)                ->  one code per row, batched 25 per API call
=HSCODE.DESCRIPTION(B2)              ->  official description
=HSCODE.DUTY(B2, "CN")               ->  12.00 %
=HSCODE.VALID(B2)                    ->  TRUE / FALSE
```

Excel puts every custom function behind a namespace, so the functions are `HSCODE.CODE`, `HSCODE.DESCRIPTION`, `HSCODE.DUTY` and `HSCODE.VALID`.

> [!NOTE]
> Advisory only. Only a BTI from customs is legally binding.

## Install (sideload)

The manifest points at `https://hscode.info/excel/`, so the files must be hosted there first (see Hosting).

- **Excel on the web:** Insert > Add-ins > More Add-ins > My Add-ins > Upload My Add-in, choose `manifest.xml`.
- **Windows:** put `manifest.xml` in a shared folder, add the folder under File > Options > Trust Center > Trusted Add-in Catalogs, then Insert > My Add-ins > Shared Folder.
- **Mac:** copy `manifest.xml` to `~/Library/Containers/com.microsoft.Excel/Data/Documents/wef/`, restart Excel, Insert > My Add-ins.

Then open Home > **HS Code** > **API key**, paste your key from [hscode.info/en/account](https://hscode.info/en/account), Save, Test. The key is stored in `OfficeRuntime.storage` of your Office profile, not in the workbook.

## Functions

Arguments can be a cell or a range; results spill into the same shape. Blank cells stay blank.

| Function | Returns |
| --- | --- |
| `HSCODE.CODE(text, [mode], [lang])` | Best 10-digit goods code, as text. `mode`: `"fast"` (default) or `"accurate"`. `lang`: `"en"` (default), `"de"`, `"fr"`. |
| `HSCODE.DESCRIPTION(code, [lang])` | Official description of the code in the latest tariff snapshot. |
| `HSCODE.DUTY(code, [origin])` | Third-country (erga omnes) duty such as `12.00 %`. With `origin` (`"CN"`, `"US"` or the origin name): the duty the tariff lists for that origin, otherwise the third-country duty. |
| `HSCODE.VALID(code)` | `TRUE` if the code exists, `FALSE` if malformed or unknown. |

Codes may contain spaces or dots. 8-digit CN codes get `00` appended; a number that lost its leading zero (9 digits) is padded back to 10.

### Errors

Each failing cell shows an Excel error with the message in the error details. Other cells in a range keep their results.

| Situation | Error | Message starts with |
| --- | --- | --- |
| No key saved | `#VALUE!` | `No API key set.` |
| Key rejected (401) | `#VALUE!` | `Invalid API key.` |
| Quota used up (429) | `#N/A` | `Quota exceeded for your plan.` plus `Retry in N s` when the API sends `Retry-After` |
| Code not in tariff | `#N/A` | `Unknown code "..."` |
| Malformed code or bad mode, lang, text | `#VALUE!` | the reason |
| No match | `#N/A` | `No matching code found.` |

## Quota and caching

- `HSCODE.CODE` costs 1 AI unit per description in `fast` mode and 5 in `accurate` mode. The free plan has 30 AI units and 100 lookups a day. The other three functions use one lookup per distinct code and share one cached response. See [pricing](https://hscode.info/en/pricing).
- Excel calls a function once per cell. Calls made within about 40 ms are merged into batches of 25, and identical descriptions are sent once.
- Results are cached in memory for 6 hours while the workbook session runs. Closing Excel or reloading the add-in clears the cache. Errors are not cached.

## Hosting

Host these files at `https://hscode.info/excel/` (same names, same layout): `functions.js`, `functions.json`, `taskpane.html`, `taskpane.js`, `core.js` (from `src/core.js`), `assets/icon-*.png`. `manifest.xml` is only needed by the person installing, but may be published there too.

Requirements:

- HTTPS, served with `Content-Type` `text/javascript`, `application/json`, `text/html`.
- The API must answer CORS for `https://hscode.info` (the add-in runs on that origin when hosted there, so same-origin calls to `/api/v1` need no CORS; cross-origin hosting does). Preflight must allow the `Authorization` and `Content-Type` headers and the `POST` method.
- No cache for `functions.js` and `functions.json`, or a short max-age, so updates reach users.

Changing the host: replace `https://hscode.info/excel` in `manifest.xml` and add the new origin to `<AppDomains>`.

## Development

```bash
npm run build   # regenerate functions.js from src/core.js + src/glue.js
npm test        # node --test, no dependencies
npx office-addin-manifest validate manifest.xml   # needs network
```

| File | Role |
| --- | --- |
| `src/core.js` | Pure logic shared with the Sheets project (copy of `sheets/src/core.js`). |
| `src/glue.js` | Custom functions: fetch, `OfficeRuntime.storage`, memory cache, batching queue. |
| `functions.js` | Generated: `core.js` + `glue.js`. Commit it; the test fails when stale. |
| `functions.json` | Custom function metadata (autocomplete, argument help). |
| `taskpane.html`, `taskpane.js` | API key task pane. |
| `manifest.xml` | Add-in manifest with shared runtime (V1_1 override). |

MIT licence.

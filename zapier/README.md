# hscode.info for Zapier

Zapier Platform CLI app (JavaScript). API key auth, one create and two searches.

| Type | Key | Endpoint |
| --- | --- | --- |
| Create | `classify` (Classify Product) | `POST /api/v1/classify` |
| Search | `lookup_code` (Look Up Code) | `GET /api/v1/{lang}/{year}/codes/{code}` |
| Search | `search_codes` (Search Codes) | `GET /api/v1/{lang}/{year}/search?q=` |

Classify returns the top match flattened (`goods_code`, `description`, `confidence`) plus the full `results` list. Fast mode costs 1 AI unit, accurate 5.

The auth test calls `GET /api/v1/snapshots`. It spends no AI units (one lookup) and returns 401 for a bad key.

## Develop

```bash
npm install
npm test                # nock-based, no network
npx zapier-platform validate   # local schema checks, no login
```

## Publish

Account needed: a Zapier developer account (free).

```bash
npx zapier-platform login
npx zapier-platform register "hscode.info"
npx zapier-platform push
npx zapier-platform invite you@example.com     # private testing
npx zapier-platform promote 0.1.0              # needs Zapier review for public listing
```

Public listing needs an icon (256x256 PNG), a description and a review by Zapier.

## License

MIT

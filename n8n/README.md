# n8n-nodes-hscode

n8n community node for [hscode.info](https://hscode.info): classify products into EU customs CN codes, look up codes and duties.

| Resource | Operation | Endpoint |
| --- | --- | --- |
| Classification | Classify Product (text, mode fast/accurate, lang de/en/fr) | `POST /api/v1/classify` |
| Classification | Classify Batch (up to 25 input items in one request) | `POST /api/v1/classify/batch` |
| Code | Look Up (code, year default latest, lang) | `GET /api/v1/{lang}/{year}/codes/{code}` |
| Code | Search | `GET /api/v1/{lang}/{year}/search?q=` |
| Code | Duty History (duty in every yearly snapshot) | `GET .../codes/{code}?history=true` |
| Code | Validate (returns `valid: true/false`, 404 means false) | `GET .../codes/{code}` |

Fast mode costs 1 AI unit, accurate 5. Classify Batch emits one output item per input item, with the `id` you supplied.

## Credentials

Create an API key on your [hscode.info account](https://hscode.info/en/account) and add an "hscode.info API" credential. The credential test calls `GET /api/v1/snapshots`, which spends no AI units (one lookup) and returns 401 for a bad key.

## Install

In n8n: Settings, Community Nodes, Install, `n8n-nodes-hscode`. For local use, `npm run build` and link the package into `~/.n8n/custom`.

## Develop

```bash
npm install
npm run build
npm test
```

## Publish

Account needed: an npm account that owns the `n8n-nodes-hscode` name.

```bash
npm run build
npm publish --access public
```

n8n verification (listing without the "unverified" warning) is a separate submission through the n8n Creator Portal. `npx @n8n/scan-community-package n8n-nodes-hscode` works only after the package is on npm.

## License

MIT

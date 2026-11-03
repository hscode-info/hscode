# hscode.info for Make

Custom app definition for Make (Integromat) with a connection and three modules: Classify Product, Look Up Code (action), Search Codes (search).

## Layout

```
general/base.json, groups.json      base URL, Bearer header, error format
connections/hscode/                 API key connection; test call is GET /snapshots
modules/classify/                   POST /classify
modules/lookupCode/                 GET /{lang}/{year}/codes/{code}
modules/searchCodes/                GET /{lang}/{year}/search?q=
```

Each module folder has `<name>.json` (metadata), `.communication.json` (IML request), `.parameters.json` (mappable parameters) and `.interface.json` (output). This mirrors the Make Apps Editor extension for VS Code. The files were not run against Make; they are validated only as JSON.

## Credential test

The connection calls `GET /api/v1/snapshots`. It spends no AI units (one lookup) and returns 401 for a bad key.

## Import

Account needed: a Make account with permission to create custom apps (any plan, including Free).

1. Install the "Make Apps Editor" extension in VS Code and sign in with a Make API token (scopes `apps:read`, `apps:write`).
2. Create the app in Make (Create a new app, name `hscode`, label `hscode.info`, theme colour as you like), or via the extension's "Create a new app".
3. Open this folder in VS Code and use "Deploy to Make" per component, or paste each JSON into the matching tab in the web Apps Editor (Base, Connections, Modules: Communication, Parameters, Interface).
4. Add an icon (512x512 PNG) in the app settings.
5. Create a scenario, add a module from the app, create a connection with your key and run once to test.

Publishing to the public Make app directory goes through Make's review. Until then the app can be shared with an invite link.

## License

MIT

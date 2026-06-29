# firstsales-cli

CLI for the FirstSales Developer API.

```bash
npm install -g firstsales-cli
firstsales whoami --json
```

Configure auth with `FIRSTSALES_API_KEY`, `--api-key`, or a profile JSON file:

```json
{
  "currentProfile": "prod",
  "profiles": {
    "prod": {
      "apiKey": "fs_...",
      "baseUrl": "https://api.app.firstsales.io"
    }
  }
}
```

# SvelteKit — Scaffold Instructions

## Scaffold Location

Scaffold directly into `client/` from the repo root:

```bash
npx sv create client --template minimal --types ts --no-add-ons --no-install
cd client && npm install
```

## Expected Structure After Scaffold

```
client/
  src/
    lib/
      index.ts
    routes/
      +page.svelte
    app.html
    app.d.ts
  static/
  svelte.config.js
  vite.config.ts
  package.json
  tsconfig.json
```

## Update .scaffold/.paths.json

```json
{
  "client": {
    "typesDir": {
      "expected": "client/src/lib/types",
      "current": "client/src/lib/types",
      "status": "verified"
    }
  }
}
```

Create `client/src/lib/types/` — this is where shared types live.

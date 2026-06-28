# Remix — Scaffold Instructions

## Scaffold Location

Scaffold directly into `client/` from the repo root:

```bash
npx create-remix@latest client --no-install --no-git-init --template remix
cd client && npm install
```

## Expected Structure After Scaffold

```
client/
  app/
    routes/
      _index.tsx
    root.tsx
    entry.client.tsx
    entry.server.tsx
    tailwind.css
  public/
  package.json
  tsconfig.json
  vite.config.ts
  remix.config.js
```

## Update .scaffold/.paths.json

```json
{
  "client": {
    "typesDir": {
      "expected": "client/app/types",
      "current": "client/app/types",
      "status": "verified"
    }
  }
}
```

Create `client/app/types/` — this is where shared types live.

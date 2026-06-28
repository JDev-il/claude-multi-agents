# Vite + React — Scaffold Instructions

## Scaffold Location

Scaffold directly into `client/` from the repo root:

```bash
npm create vite@latest client -- --template react-ts
cd client && npm install
```

## Expected Structure After Scaffold

```
client/
  src/
    assets/
    App.tsx
    App.css
    main.tsx
    index.css
    vite-env.d.ts
  public/
  index.html
  package.json
  tsconfig.json
  tsconfig.node.json
  vite.config.ts
```

## Update .scaffold/.paths.json

```json
{
  "client": {
    "typesDir": {
      "expected": "client/src/types",
      "current": "client/src/types",
      "status": "verified"
    }
  }
}
```

Create `client/src/types/` — this is where shared types live.

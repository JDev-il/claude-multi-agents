# Nuxt — Scaffold Instructions

## Scaffold Location

Scaffold directly into `client/` from the repo root:

```bash
npx nuxi@latest init client --no-install --no-gitInit
cd client && npm install
```

## Expected Structure After Scaffold

```
client/
  assets/
  components/
  composables/
  layouts/
  pages/
    index.vue
  plugins/
  public/
  server/
  app.vue
  nuxt.config.ts
  package.json
  tsconfig.json
```

## Update .scaffold/.paths.json

```json
{
  "client": {
    "typesDir": {
      "expected": "client/types",
      "current": "client/types",
      "status": "verified"
    }
  }
}
```

Create `client/types/` — this is where shared types live.

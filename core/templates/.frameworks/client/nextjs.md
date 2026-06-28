# Next.js — Scaffold Instructions

## Scaffold Location

Scaffold directly into `client/` from the repo root:

```bash
npx create-next-app@latest client --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-git
```

## Expected Structure After Scaffold

```
client/
  src/
    app/
      layout.tsx
      page.tsx
      globals.css
    lib/
  public/
  next.config.ts
  package.json
  tsconfig.json
  tailwind.config.ts
  postcss.config.mjs
```

## Post-Scaffold

Dependencies are installed automatically by create-next-app.

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

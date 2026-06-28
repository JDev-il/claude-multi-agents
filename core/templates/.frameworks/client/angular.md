# Angular — Scaffold Instructions

## Critical: Scaffold Location

You are working inside a git worktree. Your root is the **repo root**, not `client/`.
All Angular files MUST live under `client/`. Do NOT scaffold at the repo root.

Angular's `ng new` creates a subfolder by default. To scaffold correctly:

```bash
# From the REPO ROOT — create a temp app, then move files into client/
ng new temp-app --directory client --skip-git --routing --style=scss
```

OR using the `--directory` flag directly:

```bash
ng new my-app --directory client --skip-git --routing --style=scss
```

This places all Angular files inside `client/` at the correct level.

## Expected Structure After Scaffold

```
client/
  src/
    app/
      app.component.ts
      app.component.html
      app.config.ts
      app.routes.ts
    assets/
    index.html
    main.ts
    styles.scss
  angular.json
  package.json
  tsconfig.json
  tsconfig.app.json
```

## Verify Location

After scaffolding, confirm:
```bash
ls client/src/app/   # should show app.component.ts
ls client/angular.json  # should exist
```

If files landed at `client/my-app/` instead of `client/` — move them up:
```bash
mv client/my-app/* client/
mv client/my-app/.* client/ 2>/dev/null || true
rmdir client/my-app
```

## Post-Scaffold

```bash
cd client
npm install
```

## Update .scaffold/.paths.json

After scaffolding, update `current` paths and set `status: verified`:
```json
{
  "client": {
    "typesDir": {
      "expected": "client/src/app/core/types",
      "current": "client/src/app/core/types",
      "status": "verified"
    }
  }
}
```

Create `client/src/app/core/types/` if it doesn't exist — this is where shared types live.

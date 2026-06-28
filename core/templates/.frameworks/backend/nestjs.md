# NestJS — Scaffold Instructions

## Critical: Scaffold Location

You are working inside a git worktree. Your root is the **repo root**, not `backend/`.
All NestJS files MUST live under `backend/`. Do NOT scaffold at the repo root.

NestJS's `nest new` creates a subfolder by default. To scaffold in place:

```bash
# From the REPO ROOT — scaffold directly into backend/
nest new . --directory backend --skip-git --package-manager npm
```

OR scaffold with period to use current directory:
```bash
cd backend
nest new . --skip-git --package-manager npm
```

## Expected Structure After Scaffold

```
backend/
  src/
    app.controller.ts
    app.controller.spec.ts
    app.module.ts
    app.service.ts
    main.ts
  test/
  nest-cli.json
  package.json
  tsconfig.json
  tsconfig.build.json
```

## Verify Location

After scaffolding, confirm:
```bash
ls backend/src/main.ts     # should exist
ls backend/nest-cli.json   # should exist
```

If files landed at `backend/my-app/` instead of `backend/` — move them up:
```bash
mv backend/my-app/* backend/
mv backend/my-app/.* backend/ 2>/dev/null || true
rmdir backend/my-app
```

## Post-Scaffold

```bash
cd backend
npm install
```

## Update .scaffold/.paths.json

After scaffolding, update `current` paths and set `status: verified`:
```json
{
  "backend": {
    "dtoDir": {
      "expected": "backend/src/dto",
      "current": "backend/src/dto",
      "status": "verified"
    }
  }
}
```

Create `backend/src/dto/` if it doesn't exist.

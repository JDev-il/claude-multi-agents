# multi-agents-cli

A structured workflow tool that orchestrates multiple Claude Code agents working in parallel - each isolated in its own git worktree, owning a specific scope of the codebase.

Instead of one agent doing everything in a single bloated session, each agent stays focused, token-efficient, and conflict-free. Shared state files keep them coordinated without manual intervention.

**The result:** faster builds, lower token spend, and a clean git history - without sacrificing reliability or context.

---

## Install

```bash
npm install -g multi-agents-cli
```

---

## Quickstart

```bash
multi-agents init my-project
cd my-project
npm run agent
```

`multi-agents init` will:
- Guide you through project name, stack, IDE, and build trajectory using arrow-key selection
- Generate `BUILD_STATE.md`, `CONTRACTS.md`, `CLAUDE.md`, `CLOUD_STATE.md`
- Generate `shared/wiring.config.json` with client/backend env var conventions
- Write `.scaffold/.config.json`, `.scaffold/.tracking.json`, `.scaffold/scope-policy.json`
- Copy agent instruction files and framework scaffold guides from the bundled `core/`
- Initialize git, install pre-commit hook, and create the initial commit

---

## Commands

| Command | Purpose |
|---------|---------|
| `npm run agent` | Start a new task with an agent |
| `npm run complete` | Merge agent work into main and update project state |
| `npm run restart` | Wipe and relaunch a specific agent |
| `npm run reset` | Nuclear wipe - removes all worktrees and resets project state |
| `npm run init` | Re-run initialization (locked after first run) |

All commands self-relocate to the repo root via `git rev-parse --git-common-dir`. Run them from the worktree terminal, the repo root, or anywhere inside the git tree.

---

## Workflow

### 1. Start a task

```bash
npm run agent
```

Select scope (client / backend / shared), then agent, then describe the task.
The workspace opens in your IDE and Claude Code CLI launches automatically.

The agent reads `TASK.md` and executes autonomously.

### 2. Complete a task

```bash
npm run complete
```

Validates scope boundaries via `git diff`, merges the branch into main, updates `BUILD_STATE.md` and `TASKS_HISTORY.md`, and clears the tracking slot.

### 3. Repeat

Pick the next agent and continue building.

---

## Build Trajectories

Choose during `multi-agents init`:

**Multi-Agent Driven Orchestration** *(recommended)*
Every task starts with `npm run agent`. Each agent works in its own git worktree - an isolated branch and folder that merges back into main via `npm run complete`. Faster builds and lower token spend than a single long session.

**Shared Orchestration**
You and agents co-build - each owning a defined part of the codebase. Agent tasks run in git worktrees; your work happens directly in the project. Define boundaries before work begins.

---

## Supported Frameworks

### Client
Next.js - Angular - Vue/Nuxt - SvelteKit - Vite+React - Remix

### Backend (separate)
Express - NestJS - Fastify - FastAPI - Django - Laravel - Rails

Each framework has a dedicated scaffold instruction file in `.frameworks/client/` and `.frameworks/backend/` - agents read these before scaffolding to ensure files land in the correct location.

---

## Agent Roster

### Client

| Agent | Default task | Requires |
|-------|-------------|---------|
| `UI` | Scaffolds full project structure + client wiring config | - |
| `LOGIC` | State management, API integration, hooks | UI done |
| `FORMS` | Form components, validation, submission | UI done |
| `ROUTING` | Page routing, navigation, URL structure | UI done |
| `TESTING` | Unit and integration tests | UI done |
| `ACCESSIBILITY` | a11y compliance, keyboard navigation | UI done |

### Backend (separate only)

| Agent | Default task | Requires |
|-------|-------------|---------|
| `INIT` | Scaffolds backend structure, wiring config, CONTRACTS.md | - |
| `API` | REST/GraphQL endpoint implementation | INIT done |
| `LOGIC` | Business logic, services, data processing | API done |
| `AUTH` | Authentication, authorization, sessions | API done |
| `DB` | Database schemas, migrations, queries | INIT done |
| `EVENTS` | Event queues, pub/sub, webhooks | API done |
| `JOBS` | Background jobs, scheduled tasks | API done |
| `TESTING` | API and integration tests | API done |

### Shared

| Agent | Default task | Requires |
|-------|-------------|---------|
| `CLOUD` | Deployment config, CI/CD, environment wiring | Client + backend done |
| `SECURITY` | Shared auth utilities, encryption, validation | - |

Start with `UI` (client) or `INIT` (backend). The launcher recommends the correct next agent dynamically based on what is already completed.

---

## Scope Validation

Every agent merge is validated before it touches main.

When a worktree is created, `agent.js` writes a `scope.json` file declaring the agent's identity and policy. When `npm run complete` runs, it:

1. Reads `scope.json` from the worktree
2. Loads `.scaffold/scope-policy.json` (written at init time)
3. Runs `git diff --name-only main...HEAD` to get every changed file
4. Blocks the merge if any file falls outside the allowed paths for that scope

**Policy summary:**

| Scope | Allowed | Blocked |
|-------|---------|---------|
| client | `client/**` | `backend/**`, `shared/**`, `CONTRACTS.md` |
| client/UI (scaffold only) | `client/**`, `shared/wiring.config.json` | `backend/**`, `CONTRACTS.md` |
| backend | `backend/**` | `client/**`, `shared/**`, `CONTRACTS.md` |
| backend/INIT (scaffold only) | `backend/**`, `shared/wiring.config.json`, `CONTRACTS.md` | `client/**` |
| shared/CLOUD | deployment files only | `client/**`, `backend/**`, `CONTRACTS.md` |

Scaffold-only overrides expire automatically after the first successful merge for that scope.

---

## Wiring Config

`shared/wiring.config.json` is the client-backend interface contract for environment variables. It contains conventional variable names only - no values, no ports.

```json
{
  "client": {
    "apiBaseUrlVar": "API_BASE_URL",
    "environments": {
      "development": {},
      "staging": {},
      "production": {}
    }
  },
  "backend": {
    "portVar": "PORT",
    "corsOriginVar": "CORS_ORIGIN",
    "environments": {
      "development": {},
      "staging": {},
      "production": {}
    }
  }
}
```

The `UI` agent populates the client section on first scaffold. The `INIT` agent populates the backend section. The `CLOUD` agent reads both sections to wire per-environment values correctly.

---

## Remote Setup

`multi-agents init` does not configure a GitHub remote. The first agent session handles remote setup automatically:

1. Checks SSH, gh CLI, and HTTPS credentials in order
2. If a remote repo exists - evaluates its state (orphaned branches, completion status, age)
3. Auto-clears old sessions or surfaces a decision when unfinished work is detected
4. If no remote - opens your browser to `github.com/new` with the repo name pre-filled

---

## Key Files

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Global coordination rules - every agent reads this first |
| `BUILD_STATE.md` | Living project state - what is built, what is next |
| `CONTRACTS.md` | Shared types and interfaces - single source of truth |
| `TASKS_HISTORY.md` | Full audit trail of all agent sessions |
| `CLOUD_STATE.md` | Cloud deployment state and prereq checklist |
| `shared/wiring.config.json` | Client-backend env var name conventions |
| `TASK.md` | Per-task instructions - lives in the agent worktree |
| `.scaffold/.config.json` | Project config written at init time |
| `.scaffold/.tracking.json` | Active agent state - managed by workflow scripts |
| `.scaffold/scope-policy.json` | Allowed/blocked path rules per scope and agent |

Never edit `BUILD_STATE.md` or `TASKS_HISTORY.md` directly. Workflow scripts own all updates.

---

## Guard System

The launcher enforces structural rules before any worktree is created:

- **Skeleton guard** - LOGIC/FORMS/ROUTING/TESTING require UI completed first (client), API requires INIT completed first (backend)
- **Prerequisite check** - surfaces unmet dependencies, lets you proceed or repick
- **Active agent gate** - if the same agent is already running, offers Resume / Restart / Cancel with cascade warnings
- **MISSING gate** - if a worktree was deleted without completing, mandatory Recover or Reset decision
- **CLOUD gate** - CLOUD agent is only selectable when client and/or backend prerequisites are met, shows readiness table

---

## Architecture

```
my-project/
├── .agents/                        <- agent instruction files (bundled in core/)
│   ├── client/                     <- UI.md, LOGIC.md, FORMS.md, ROUTING.md, TESTING.md, ACCESSIBILITY.md
│   ├── backend/                    <- INIT.md, API.md, DB.md, AUTH.md, LOGIC.md, EVENTS.md, JOBS.md, TESTING.md
│   └── shared/                     <- CLOUD.md, SECURITY.md, CLOUD_TEARDOWN.md
├── .frameworks/                    <- framework scaffold instructions (bundled in core/)
│   ├── client/                     <- nextjs.md, angular.md, vite-react.md, nuxt.md, sveltekit.md, remix.md
│   └── backend/                    <- express.md, nestjs.md, fastify.md, fastapi.md, django.md
├── .workflow/                      <- workflow scripts (agent.js, complete.js, guards.js, reset.js, restart.js)
├── .scaffold/                      <- runtime state (.config.json, .tracking.json, scope-policy.json, .initialized)
├── client/                         <- built by client agents
├── backend/                        <- built by backend agents (if separate)
├── shared/
│   └── wiring.config.json          <- client-backend env var conventions
├── worktrees/                      <- local only, gitignored
├── CLAUDE.md
├── BUILD_STATE.md
├── CONTRACTS.md
├── TASKS_HISTORY.md
└── CLOUD_STATE.md
```

Each agent works in its own `worktrees/` folder on a dedicated branch.
On completion, scope is validated and work merges into `main`. The final `main` branch is a complete, runnable application.

---

## Tracking

`.scaffold/.tracking.json` is the runtime state ledger:

```json
{
  "client": {
    "UI": {
      "branch": "agent/client/ui/1780403456467",
      "status": "ACTIVE",
      "launchedAt": "2026-06-04T10:21:00Z",
      "missingCount": 0,
      "worktreePath": "/path/to/worktrees/..."
    }
  }
}
```

**Status values:** `null` (never launched) - `ACTIVE` (running) - `COMPLETED` (merged into main) - `MISSING` (worktree deleted without completing)

Managed entirely by `agent.js` and `complete.js`. Never edit manually.

---

## What's new in v1.1.0

**Init flow**
- Step counter (`Step N of 12`) shown throughout the configuration flow
- Back-navigation fully wired — go back to any previous step and resume without re-answering everything

**After merge**
- `npm run complete` now surfaces the next recommended agent explicitly based on tracking state
- `start:client` script written into `package.json` after `client/UI` merges
- `start:backend` script written into `package.json` after `backend/INIT` merges

**Agent templates**
- Every agent now includes a `Session Close` block — explicit next-step instructions after Definition of Done

# {{PROJECT_NAME}} - Backend Agent Instructions
#
# ╔══════════════════════════════════════════════════════════════════╗
# ║                        @config BLOCK                            ║
# ║  Audited before every task. Missing required values = hard stop. ║
# ║  Confirmed values are written back here immediately.            ║
# ╚══════════════════════════════════════════════════════════════════╝
#
# @config PROJECT_NAME  :          ← [required]
# @config FRAMEWORK     :          ← [required if LANGUAGE blank] e.g. NestJS, Django, Laravel
# @config FRAMEWORK_VERSION :      ← [optional] e.g. 11, 10 — set at init time
# @config FRAMEWORK_VERSION :      ← [optional] e.g. 11, 10 — set at init time
# @config LANGUAGE      :          ← [required if FRAMEWORK blank] e.g. TypeScript, Python, C#
# @config ORM           :          ← [optional] derived from FRAMEWORK if blank
# @config AUTH          :          ← [optional] derived from FRAMEWORK if blank
#
# ── Write-back rule ─────────────────────────────────────────────────
# Every confirmed config value must be written into its @config line
# above before the agent proceeds. No exceptions.
# ────────────────────────────────────────────────────────────────────
#
# Inherits from root CLAUDE.md. Do not duplicate global rules here.

---

## Config Audit

Runs before any task, exploration, or code. No exceptions.

### Resolution priority

```
FRAMEWORK set                     → language derived from it. Proceed.
FRAMEWORK blank, LANGUAGE set     → trigger Level 2 framework proposal.
FRAMEWORK blank, LANGUAGE blank   → hard stop.
PROJECT_NAME blank                → hard stop.
```

### Required configs

| @config      | Rule                                               | If missing                  |
|--------------|----------------------------------------------------|---------------------------  |
| PROJECT_NAME | Must always be set                                 | Hard stop                   |
| FRAMEWORK    | Must be set, OR LANGUAGE must be set to resolve it | See resolution priority     |
| LANGUAGE     | Required only if FRAMEWORK is blank                | Hard stop if both are blank |

### Optional configs

| @config | Derives from                          | Triggers when                  |
|---------|---------------------------------------|--------------------------------|
| ORM     | FRAMEWORK first, LANGUAGE as fallback | Any database or migration task |
| AUTH    | FRAMEWORK first, LANGUAGE as fallback | Any auth, guard, or token task |

When FRAMEWORK strongly implies a default (e.g. Django → Django ORM),
the agent surfaces that default for confirmation rather than proposing a full list.
If FRAMEWORK is agnostic, agent proposes up to 3 options derived from LANGUAGE.

### Hard stop alert

```
## CONFIG AUDIT FAILED - CANNOT PROCEED

Missing:
  [ ] @config PROJECT_NAME  - agent cannot scope output without it.
  [ ] @config FRAMEWORK / LANGUAGE - at least one required.
                              No code can be written without either.

Open this file, fill in the missing values, and restart the task.
```

Only list what is actually missing.

### Optional config alert

```
## CONFIG INCOMPLETE - LIMITED PROCEED

@config {{TOKEN}} is not set. This affects:
  - <specific consequence for this task>

Derived recommendation (from @config FRAMEWORK / LANGUAGE):
  → <recommended value and one-line reason>

Options:
  1. Accept - agent writes to @config and proceeds
  2. Override - agent offers up to 3 alternatives, waits for selection
  3. Skip - agent marks affected decisions as <!-- @unresolved --> and continues

Awaiting your choice.
```

---

## Stack Resolution

Runs after Config Audit passes.

### Level 1 - Framework set
Use it directly. Language is derived. Proceed.

### Level 2 - Language set, framework blank

```
## FRAMEWORK SELECTION REQUIRED
Language  : {{LANGUAGE}}
Options   :
  1. <Framework A> - <one-line reason>
  2. <Framework B> - <one-line reason>
  3. <Framework C> - <one-line reason>
Awaiting  : selection - agent writes confirmed value to @config FRAMEWORK
```

### Level 3 - Both blank
Hard stop. Config Audit already surfaced the alert.

**Rules:**
- Surface each proposal once. Never repeat.
- Do not infer stack from existing code - confirm if config is missing.
- Write every confirmed value back to its `@config` line before proceeding.

---

## Framework Scaffold Instructions

Before scaffolding ANY project structure, read the framework-specific instruction file:

```
.frameworks/backend/{{FRAMEWORK_FILE}}
```

Where `{{FRAMEWORK_FILE}}` maps to:
- Express → `express.md`
- NestJS → `nestjs.md`
- Fastify → `fastify.md`
- FastAPI → `fastapi.md`
- Django → `django.md`

The file contains:
- Exact scaffold command and flags
- Where to run it (always from repo root)
- Expected directory structure after scaffold
- How to recover if files land in the wrong location
- How to update `.scaffold/.paths.json` after scaffold

**This is mandatory before writing any files.** Scaffolding without reading this file
will result in files being created in the wrong location.

## Environment Variables

```
## ENV VAR REQUIRED
Name      : <VAR_NAME>
Purpose   : <what it's used for>
Awaiting  : confirmation it exists in the environment
```

<!-- @annotation: List known env vars here for agent reference. -->

---

## Safety Rules

- Never proceed if Config Audit has not passed
- Always write back confirmed config values before proceeding
- Never write to `client/`, `shared/`, or `CONTRACTS.md` unilaterally
- Surface best-practice observations once - never loop on them

---

## Scope Boundaries

**In scope (backend agents own these):**
- Database schemas, migrations, entities, queries
- Backend architecture, folder structure, DB setup, wiring config - belongs to backend/INIT
- API endpoint definitions, request/response handling
- Server-side authentication, authorization, sessions
- Business logic, services, data processing
- Event queues, pub/sub, webhooks
- Background jobs, scheduled tasks
- Backend unit and integration tests

**Out of scope (redirect to correct agent or scope):**
- UI components, layouts, styling - belongs to client/UI
- Client-side state management - belongs to client/LOGIC
- Form components and validation - belongs to client/FORMS
- Route definitions and navigation - belongs to client/ROUTING
- Client-side auth token handling - belongs to client/LOGIC
- Shared types crossing client/backend boundary - propose CONTRACTS change
- Infrastructure, deployment, environment config - belongs to CLOUD agent

If a task crosses into out-of-scope territory, apply the Scope Mismatch Protocol from root CLAUDE.md.

---

## Scaffolding Into Existing Directories

When any agent initializes a framework or installs dependencies into `backend/`,
the directory already contains coordination files (`CLAUDE.md`, `agents/`).

Rules:
- Never overwrite or delete `CLAUDE.md`, `.agents/backend/` or `.frameworks/backend/`
- When using framework CLI tools (e.g. nest new, django-admin startproject),
  use the appropriate flags or scaffold into a temp directory first,
  then move generated files into `backend/` preserving existing files
- If a conflict is detected - resolve by moving generated files manually,
  never by deleting coordination files
- Verify `CLAUDE.md` and `agents/` still exist after any scaffold operation
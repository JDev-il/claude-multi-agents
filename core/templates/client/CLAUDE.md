# {{PROJECT_NAME}} - Client Agent Instructions
#
# ╔══════════════════════════════════════════════════════════════════╗
# ║                        @config BLOCK                            ║
# ║  Audited before every task. Missing required values = hard stop. ║
# ║  Confirmed values are written back here immediately.            ║
# ╚══════════════════════════════════════════════════════════════════╝
#
# @config PROJECT_NAME  :          ← [required]
# @config FRAMEWORK     :          ← [required if LANGUAGE blank] e.g. Next.js, Angular, SvelteKit
# @config FRAMEWORK_VERSION :      ← [optional] e.g. 22, 21, 20 — set at init time
# @config FRAMEWORK_VERSION :      ← [optional] e.g. 22, 21, 20 — set at init time
# @config LANGUAGE      :          ← [required if FRAMEWORK blank] e.g. TypeScript, JavaScript
# @config UI_LIBRARY    :          ← [optional] derived from FRAMEWORK if blank
# @config STATE         :          ← [optional] derived from FRAMEWORK if blank
# @config STYLING       :          ← [optional] derived from FRAMEWORK if blank
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

| @config    | Derives from                          | Triggers when                |
|------------|---------------------------------------|------------------------------|
| UI_LIBRARY | FRAMEWORK first, LANGUAGE as fallback | Any component or layout task |
| STATE      | FRAMEWORK first, LANGUAGE as fallback | Any state management task    |
| STYLING    | FRAMEWORK first, LANGUAGE as fallback | Any styling or theming task  |

When FRAMEWORK strongly implies a default (e.g. Angular → Angular CDK / Material),
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

---

## Framework Scaffold Instructions

Before scaffolding ANY project structure, read the framework-specific instruction file:

```
.frameworks/client/{{FRAMEWORK_FILE}}
```

Where `{{FRAMEWORK_FILE}}` maps to:
- Next.js → `nextjs.md`
- Angular → `angular.md`
- Vue / Nuxt → `nuxt.md`
- SvelteKit → `sveltekit.md`
- Vite + React → `vite-react.md`
- Remix → `remix.md`

The file contains:
- Exact scaffold command and flags
- Where to run it (always from repo root)
- Expected directory structure after scaffold
- How to recover if files land in the wrong location
- How to update `.scaffold/.paths.json` after scaffold

**This is mandatory before writing any files.** Scaffolding without reading this file
will result in files being created in the wrong location.

**Rules:**
- Surface each proposal once. Never repeat.
- Do not infer stack from existing code - confirm if config is missing.
- Write every confirmed value back to its `@config` line before proceeding.

---

## Environment Variables

Public env var prefixes derive from `{{FRAMEWORK}}` - agent applies correct
prefix convention once FRAMEWORK is resolved. No hardcoded prefixes here.

```
## ENV VAR REQUIRED
Name      : <VAR_NAME>
Purpose   : <what it's used for>
Public    : yes / no
Awaiting  : confirmation it exists in the environment
```

<!-- @annotation: List known env vars here for agent reference. -->

---

## Safety Rules

- Never proceed if Config Audit has not passed
- Always write back confirmed config values before proceeding
- Never write to `backend/`, `shared/`, or `CONTRACTS.md` unilaterally
- Never redeclare types that belong in `shared/` - propose a CONTRACTS change instead
- Surface best-practice observations once - never loop on them

---

## Scope Boundaries

**In scope (client agents own these):**
- UI components, layouts, pages, styling
- State management, custom hooks, API client calls
- Form components, validation, submission handling
- Route definitions, navigation, URL structure
- Client-side authentication (tokens, session storage)
- Accessibility compliance, keyboard navigation
- Unit and integration tests for client code

**Out of scope (redirect to correct agent or scope):**
- Database schemas, migrations, queries - belongs to backend/DB
- API endpoint definitions - belongs to backend/API
- Server-side authentication logic - belongs to backend/AUTH
- Business rules and server-side processing - belongs to backend/LOGIC
- Shared types crossing client/backend boundary - propose CONTRACTS change
- Infrastructure, deployment, environment config - belongs to CLOUD agent

If a task crosses into out-of-scope territory, apply the Scope Mismatch Protocol from root CLAUDE.md.

---

## Scaffolding Into Existing Directories

When initializing a framework into `client/`, the directory already contains
`CLAUDE.md` and `agents/`. These must always be preserved.

**Rules:**
- Never use CLI scaffold tools (create-next-app, nuxi, etc.) — they refuse non-empty directories
- Always create the project structure manually: package.json, tsconfig.json, config files, src/ folders
- Never create temp directories of any kind
- Never overwrite or delete `CLAUDE.md`, `.agents/client/` or `.frameworks/client/`
- Delete any leftover temp folders from previous runs before starting
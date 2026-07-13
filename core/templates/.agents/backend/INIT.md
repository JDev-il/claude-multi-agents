# INIT Agent
# Scope: backend/
# Loaded by: manual reference in prompt
# Example: `Use .agents/backend/INIT.md. Task: scaffold the backend for a job board API using Express and PostgreSQL.`

---

## Mission

Scaffold the entire backend architecture for this project. This agent owns
all structural decisions: folder layout, design pattern (MVC, service-repository,
layered architecture), framework configuration, database connection setup,
environment variable conventions, and initial shared type definitions.

This agent does not implement business logic, endpoints, authentication strategies,
database queries, or background jobs. Those belong to their respective agents.
This agent creates the structure those agents will build inside.

---

## Pre-flight Checks

Runs in order before any file is created or modified. All checks must pass.

### 1. Task Clarity Check

Is the task specific enough to act on?

- Identify: what framework and language are in use (from `.scaffold/.config.json`)
- Identify: what database type is configured, if any
- Identify: whether this is a REST, GraphQL, or hybrid API surface

If any of these cannot be determined from config or task:
```
## CLARIFICATION NEEDED - [Round 1 or 2]
The following is unclear:
  - <specific ambiguity>
Please provide more detail before this agent proceeds.
```

Maximum 2 rounds. If ambiguity remains after round 2, halt and request task rephrasing.

### 2. Scope Integrity Check

Does this task stay within INIT concerns?

If the task requires:
- Endpoint implementation → redirect to `.agents/backend/API.md`
- Business logic or services → redirect to `.agents/backend/LOGIC.md`
- Auth strategy implementation → redirect to `.agents/backend/AUTH.md`
- Database schema or migrations → redirect to `.agents/backend/DB.md`

```
## SCOPE REDIRECT
This task includes concerns outside INIT.md scope:
  - <concern> → belongs to <agent>
Proceed with scaffolding concerns only, or reassign the full task.
Awaiting your direction.
```

### 3. Config Check

Read `.scaffold/.config.json` before making any architectural decision.

- Confirm framework, language, and backend type
- Confirm database type if configured
- Confirm any IDE or tooling preferences that affect folder conventions

### 4. Size & Atomicity Check

Is this task too large for one reliable pass?

If the scaffold spans multiple unrelated subsystems:
```
## TASK BREAKDOWN PROPOSED
This task is too large for one pass. Suggested sequence:
  1. <subtask A - e.g. folder structure + framework config>
  2. <subtask B - e.g. DB connection + environment setup>
  3. <subtask C - e.g. wiring.config.json + CONTRACTS.md bootstrap>
Proceeding with subtask 1. Confirm to continue after each step.
```

---

## Operating Principles

These apply to every INIT task regardless of framework or language.

- **Derive patterns from resolved stack** - apply `{{FRAMEWORK}}` idiomatic
  folder conventions and architecture without needing explicit instruction.
  Examples: NestJS modules/controllers/services structure, Express
  src/routes/controllers/services layout, FastAPI routers/schemas/services,
  Django apps/views/serializers pattern.

- **Architecture is a decision, not a default** - choose MVC, service-repository,
  or layered architecture based on the project's complexity and framework idiom.
  Document the choice in a brief comment in the root config or README section.

- **Environment variables are named, never valued** - create `.env.example`
  with all required variable names and descriptions. Never write actual values.
  Write `wiring.config.json` with the agreed variable names per the conventions
  below.

- **wiring.config.json is this agent's primary output** - read the existing
  `shared/wiring.config.json` skeleton, extend the backend section with all
  runtime vars this stack requires per environment (development, staging,
  production). Add database, session, queue, and any other runtime vars the
  framework needs. Never add values — names only.

- **CONTRACTS.md bootstrap is mandatory** - create the initial shared type
  definitions that the API and LOGIC agents will build against. At minimum:
  define the base error response shape, pagination shape if applicable, and
  any domain entities visible from the task description.

- **No implementation** - shell files, index files, and config files only.
  Controllers, services, repositories, and middleware are empty shells with
  clear TODO comments indicating which agent owns the implementation.

- **Framework best practices are non-negotiable** - apply the framework's
  idiomatic patterns for dependency injection, middleware registration, error
  handling, and module organisation from the start. Do not scaffold in a way
  that requires structural refactoring later.

<!-- @annotation
  Add project-specific backend architecture conventions here.
  Examples: monorepo vs single-app, microservice boundaries,
  API versioning strategy, logging framework preference.
-->

---

## wiring.config.json Protocol

Read `shared/wiring.config.json` on entry. Extend the backend section:

```json
{
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

Add vars based on what this stack requires:
- Database → `dbUrlVar`, `dbNameVar` etc.
- Sessions → `sessionSecretVar`
- Queue/Redis → `redisUrlVar`
- JWT → `jwtSecretVar`, `jwtExpiryVar`
- External services → one var entry per service credential name

Never add values. Names only. The agent running in each environment
is responsible for populating the actual values in `.env.*` files.

---

## Progress Narration

Before starting each major build phase, emit one plain-English status line:

```
▶ [Phase name] — [what is being built and why, one line]
```

Examples:
- `▶ Exploring existing components — checking current patterns before writing anything`
- `▶ Building UI primitives — Button, Badge, Card as presentational shells`
- `▶ Validating output — running tsc and dev server to confirm zero errors`

This is mandatory. It is the only human-readable signal the user gets while
the agent is working. Keep it specific and honest — not generic filler.

### Output Mode

Read `output_mode` from `.claude-scope` at session start. Honor it for the entire session:

- `full` — no restrictions, behave normally
- `insights` — exactly three output types are permitted. Any text outside these is a violation of the output mode contract and must not be emitted:
  1. Before each phase, output this exact string (replace placeholders): `\033[1;33m▶\033[0m [phase] — [what and why, one line]`
  2. After each phase completes, output this exact string (replace placeholder): `\033[1;32m✔\033[0m [result — outcome in 10 words or fewer, stated as fact, no first-person narration]`
  3. When action is blocked or a decision is required, output this exact string (replace placeholder): `\033[38;5;208m\033[1m⚠\033[0m [blocker or decision]`
- `silent` — show `✢ working...` between phases; emit only `\033[1;32m✔\033[0m` git operations, errors, and verification results; no other output

---

## Workflow

```
read-config → decide → plan → scaffold → wire → validate
```

**Read config**
Read `.scaffold/.config.json` to confirm stack, database, and tooling.
Read `shared/wiring.config.json` to understand what is already defined.
Read `CONTRACTS.md` if it exists to understand any existing shared types.

**Decide**
Choose folder structure and design pattern based on framework idiom and
project complexity. State the decision explicitly before creating files.

**Plan**
List every file and folder being created:
- Path and purpose
- Which agent owns its implementation
- Any config values being set

Confirm the plan before proceeding — structural decisions are hard to reverse.

**Scaffold**
Create folder structure, entry point, framework config, middleware registration
shells, and empty controller/service/repository shells with TODO comments.

**Wire**
Write `shared/wiring.config.json` backend section with all required runtime vars.
Create `.env.example` with all variable names and inline descriptions.
Bootstrap `CONTRACTS.md` with initial shared types.

**Validate**
After scaffolding:
- Confirm the app starts without errors (entry point only, no implementation)
- Confirm `.env.example` covers every var referenced in the codebase
- Confirm `wiring.config.json` backend section is complete
- Confirm `CONTRACTS.md` has at minimum the base error response shape

---

## Safety Rules

- Never implement business logic, endpoints, or queries
- Never write actual environment variable values anywhere
- Never define types locally that belong in `CONTRACTS.md`
- Never scaffold in a pattern that conflicts with the resolved framework idiom
- Never leave wiring.config.json or CONTRACTS.md untouched — both must be updated
- Surface best-practice observations once — never loop on them

---

## Communication

| Situation                          | Action                                         |
|------------------------------------|------------------------------------------------|
| Task is ambiguous                  | Clarification request (max 2 rounds)           |
| Task bleeds into another domain    | Scope redirect, await direction                |
| Config is missing or incomplete    | Config alert, await resolution                 |
| Architectural decision is unclear  | State options, await direction                 |
| Task is too large                  | Breakdown proposal, execute one step at a time |
| Best practice deviation found      | Surface once, await confirmation, move on      |

---

## Definition of Done

An INIT task is complete when:

- [ ] Folder structure matches `{{FRAMEWORK}}` idiomatic conventions
- [ ] Entry point starts without errors
- [ ] All controller, service, and repository shells exist with TODO comments
- [ ] `.env.example` lists every required environment variable with descriptions
- [ ] `shared/wiring.config.json` backend section is fully populated with var names per environment
- [ ] `CONTRACTS.md` bootstrapped with base error shape and initial domain types
- [ ] No actual environment variable values exist anywhere in the codebase
- [ ] No implementation exists in any shell file
- [ ] Pre-flight checks all passed and documented if any flags were raised

---

## Session Close

When all Definition of Done items are checked:

1. Mark TASK.md complete: change `[ ] COMPLETED` to `[x] COMPLETED` at the top of TASK.md
2. Run: `npm run complete`

**Next recommended agent:** backend/API

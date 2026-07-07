# LOGIC Agent
# Scope: backend/
# Loaded by: manual reference in prompt
# Example: `Use .agents/backend/LOGIC.md. Task: implement the email classification service.`

---

## Mission

Own all business logic, domain rules, and service layer implementations
for the backend project. This agent is responsible for what the application
decides and does - the rules, workflows, transformations, and orchestrations
that define the system's behavior.

This agent does not own endpoint definitions, DTO validation, database schema,
authentication strategies, background jobs, event handling, or security
compliance. Those belong to their respective agents.

---

## Pre-flight Checks

Runs in order before any file is created or modified. All checks must pass.

### 1. Task Clarity Check

Is the task specific enough to act on?

- Identify: which service, domain rule, or workflow is being built or changed
- Identify: what triggers it, what it processes, and what it produces
- Identify: which other services, repositories, or agents it depends on

**If TASK.md contains an Agent Context section:**
Read it before assessing clarity. Provided fields reduce or eliminate clarification
rounds. Missing fields (marked ⚠) must be surfaced as explicit assumptions before
proceeding — never guess silently:

```
## INCOMPLETE CONTEXT - ASSUMPTIONS DECLARED
The following context was not provided. Proceeding with these assumptions:
  - <field>: assumed <value> because <reasoning>
  - <field>: assumed <value> because <reasoning>
Confirm assumptions to proceed, or provide the missing context.
```

If any of the core clarity criteria cannot be determined from the task AND the Agent
Context section:
```
## CLARIFICATION NEEDED - [Round 1 or 2]
The following is unclear:
  - <specific ambiguity>
Please provide more detail before this agent proceeds.
```

Maximum 2 rounds. If ambiguity remains after round 2:
```
## TASK TOO AMBIGUOUS - CANNOT PROCEED
Two clarification rounds reached. Please rephrase the task with:
  - explicit service or domain rule name
  - what triggers it and what it returns or produces
  - which services or repositories it depends on
```

### 2. Scope Integrity Check

Does this task stay within backend business logic concerns?

If the task requires:
- Endpoint or DTO definition → redirect to `.agents/backend/API.md`
- Database schema or query implementation → redirect to `.agents/backend/DB.md`
- Auth strategy or guard implementation → redirect to `.agents/backend/AUTH.md`
- Background job or scheduled task → redirect to `.agents/backend/JOBS.md`
- Event emission or subscription handling → redirect to `.agents/backend/EVENTS.md`
- Client-side logic or state → redirect to `client/.agents/backend/LOGIC.md`

```
## SCOPE REDIRECT
This task includes concerns outside LOGIC.md scope:
  - <concern> → belongs to <agent>
Proceed with backend logic concerns only, or reassign the full task.
Awaiting your direction.
```

### 3. Dependency Check

Does this task depend on something that doesn't exist yet?

- Repository or data access layer not yet implemented
- External service or integration not yet configured
- Shared types from `CONTRACTS.md` not yet present
- Another service this one orchestrates not yet built
- Auth guard this logic needs to enforce not yet in `.agents/backend/AUTH.md`

If yes:
```
## DEPENDENCY MISSING
Cannot proceed without:
  - <what is missing>
  - <where it should come from>
Awaiting resolution before continuing.
```

### 4. Contract Alignment Check

Does this task produce or consume types that cross the client/backend boundary?

- If yes → verify the relevant types exist in `CONTRACTS.md`
- If missing → stop and emit a CONTRACTS CHANGE PROPOSAL
- Never redefine shared types locally inside a service

**Classify every type before creating it:**

| Scope | Definition | Action |
|-------|-----------|--------|
| **Local** | Used only within this backend service or domain unit | Define locally in a domain types file |
| **Shared** | Crosses the client/backend boundary, OR represents a domain entity (User, Order, etc.), OR is a DTO consumed by API endpoints | Emit a CONTRACTS CHANGE PROPOSAL — do not define locally |
| **Uncertain** | Cannot be clearly classified from available context | Default to shared scope — propose via CONTRACTS CHANGE PROPOSAL |

```
## CONTRACTS CHANGE PROPOSAL
Type classification: SHARED
The following types are required and do not exist in CONTRACTS.md:
  - <TypeName>: <description and shape>
  - <TypeName>: <description and shape>
Reason: <why these cross the boundary or represent a domain entity>
Adding these to CONTRACTS.md now and proceeding. No approval needed in agent sessions.
```

### 5. Destructive Action Check

Does this task modify or replace existing service logic?

If yes, before touching any file:
```
## DESTRUCTIVE ACTION - CONFIRMATION REQUIRED
This task will modify:
  - <service or domain unit>
  - <what rules or workflows will change>
  - <what downstream services or endpoints are affected>
Awaiting explicit confirmation to proceed.
```

### 6. Size & Atomicity Check

Is this task too large for one reliable pass?

If the task spans multiple unrelated services or combines service
implementation with orchestration across other agents:
```
## TASK BREAKDOWN PROPOSED
This task is too large for one pass. Suggested sequence:
  1. <subtask A>
  2. <subtask B>
  3. <subtask C>
Proceeding with subtask 1. Confirm to continue after each step.
```

---

## Operating Principles

These apply to every backend logic task regardless of framework.

- **Derive service patterns from resolved stack** - apply `{{FRAMEWORK}}`
  idiomatic service and dependency injection conventions without needing
  explicit instruction per task.
  Examples: NestJS injectable services, Django service classes,
  Laravel service providers, Express middleware chains.

- **Services own decisions, not controllers** - all domain rules,
  conditional logic, and business decisions live here. Controllers
  delegate to services - they never decide.

- **One service, one domain** - a service owns one bounded concern.
  Never bundle unrelated business rules into the same service unit.

- **Services do not own persistence** - data access is delegated to
  the repository or ORM layer owned by `.agents/backend/DB.md`. Services
  receive data and return results - they do not write queries.

- **Services do not own HTTP** - no request or response objects inside
  a service. Services are HTTP-agnostic by design.

- **Orchestration is explicit** - when a service coordinates multiple
  other services, the orchestration flow is documented inline.
  No hidden side effects.

- **Error handling is domain-aware** - services throw or return
  domain-specific errors, not HTTP errors. The controller layer
  maps domain errors to HTTP responses.

- **Shared types from CONTRACTS.md** - never redefine cross-boundary
  types locally inside a service. Always consume from `shared/types/`.

<!-- @annotation
  Add project-specific logic conventions here.
  Examples: service naming conventions, error type definitions,
  transaction handling patterns, external API client usage,
  LLM or AI integration patterns.
-->

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

---

## Workflow

```
explore → summarize → plan → execute → validate
```

**Explore**
Read `TASK.md` fully before anything else — including the Agent Context section if
present. Provided context (entities, endpoints, domain rules, contracts) directly
informs the explore pass. Missing context fields must be declared as assumptions
before writing any code.
Read existing services and their dependencies before writing anything.
Understand current domain rules, naming conventions, and service boundaries.

**Summarize**
In 2-3 sentences, state what logic exists, what is missing, and what
will be built. Surface this before writing any code.

**Plan**
List the services being created or modified, their dependencies,
and the domain rules they enforce.
Confirm the plan before proceeding if the task involves more than
one service or cross-service orchestration.

**Execute**
Build one service at a time. Do not jump between unrelated domain units.
Apply `{{FRAMEWORK}}` idiomatic service patterns throughout.
Delegate persistence to the DB layer - never write queries here.

**Validate**
After each service:
- Confirm it enforces the correct domain rules for the expected inputs
- Confirm it delegates persistence correctly without owning queries
- Confirm it returns domain errors, not HTTP errors
- Confirm downstream services and endpoints are unaffected if outside scope

---

## Safety Rules

- **No `.tsx` or `.jsx` files** — backend LOGIC agent never creates UI or
  controller-layer code. Services are HTTP-agnostic. If an endpoint needs
  new service logic, create the service and stop. The API agent wires it
  into the controller. This is the explicit handoff boundary:
  ```
  LOGIC agent creates  →  services/feature.service.ts
  API agent consumes   →  controllers/feature.controller.ts calls FeatureService
  ```
- Never implement HTTP or request/response logic inside a service
- Never write database queries directly in a service - delegate to DB layer
- Never redefine types that belong in `shared/` - use `CONTRACTS.md`
- Never bundle unrelated domain rules into one service
- Never produce hidden side effects - all orchestration is explicit
- Never modify service logic outside the current task's stated scope
- Surface best-practice observations once - never loop on them

---

## Communication

| Situation                          | Action                                         |
|------------------------------------|------------------------------------------------|
| Task is ambiguous                  | Clarification request (max 2 rounds)           |
| TASK.md has incomplete context     | Declare assumptions explicitly before proceeding |
| Task bleeds into another domain    | Scope redirect, await direction                |
| Dependency is missing              | Dependency alert, await resolution             |
| Type classification uncertain      | Default to shared scope, emit CONTRACTS CHANGE PROPOSAL |
| Contract type missing              | CONTRACTS CHANGE PROPOSAL, write and proceed      |
| Existing service logic will change | Destructive action confirmation                |
| Task is too large                  | Breakdown proposal, execute one step at a time |
| Best practice deviation found      | Surface once, await confirmation, move on      |

---

## Definition of Done

A backend logic task is complete when:

- [ ] All planned services exist and enforce the correct domain rules
- [ ] No HTTP or request/response objects inside any service
- [ ] No database queries written directly in services - all delegated
- [ ] All shared types consumed from `CONTRACTS.md` - none redeclared locally
- [ ] Domain errors are thrown, not HTTP errors
- [ ] All orchestration flows are explicit - no hidden side effects
- [ ] No unrelated domain rules bundled into the same service
- [ ] No service logic outside task scope is affected
- [ ] Code follows `{{FRAMEWORK}}` idiomatic service patterns
- [ ] Pre-flight checks all passed and documented if any flags were raised

---

## Session Close

When all Definition of Done items are checked:

1. Mark TASK.md complete: change `[ ] COMPLETED` to `[x] COMPLETED` at the top of TASK.md
2. Run: `npm run complete`

**Next recommended agent:** backend/EVENTS

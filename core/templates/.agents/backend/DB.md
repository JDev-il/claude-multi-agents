# DB Agent
# Scope: backend/
# Loaded by: manual reference in prompt
# Example: `Use .agents/backend/DB.md. Task: design the job applications schema and generate the migration.`

---

## Mission

Own all database schema design, entity or model definitions, query
implementation, repository patterns, and migration generation for the
backend project. This agent is responsible for how data is structured,
stored, and retrieved - schema decisions, query efficiency, and the
integrity of the data layer.

This agent does not own business logic that uses retrieved data, API
endpoint definitions, authentication strategies, background job processing,
or event handling. Those belong to their respective agents.

---

## Pre-flight Checks

Runs in order before any file is created or modified. All checks must pass.

### 1. Task Clarity Check

Is the task specific enough to act on?

- Identify: which entity, model, or table is being built or modified
- Identify: what fields, types, constraints, and relationships apply
- Identify: whether a migration is required and what it changes

If any of these cannot be determined from the task as given:
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
  - explicit entity or table name
  - field list with types and constraints
  - relationship definitions if applicable
```

### 2. Scope Integrity Check

Does this task stay within data layer concerns?

If the task requires:
- Business logic using retrieved data → redirect to `.agents/backend/LOGIC.md`
- API endpoint or DTO definition → redirect to `.agents/backend/API.md`
- Auth-related schema decisions → coordinate with `.agents/backend/AUTH.md`
- Background job data patterns → coordinate with `.agents/backend/JOBS.md`
- Event sourcing schema → coordinate with `.agents/backend/EVENTS.md`

```
## SCOPE REDIRECT
This task includes concerns outside DB.md scope:
  - <concern> → belongs to <agent>
Proceed with data layer concerns only, or reassign the full task.
Awaiting your direction.
```

### 3. Dependency Check

Does this task depend on something that doesn't exist yet?

- Related entities this schema references not yet defined
- Shared types for entity fields not yet in `CONTRACTS.md`
- ORM or database connection not yet configured
- Migration tooling not yet set up

If yes:
```
## DEPENDENCY MISSING
Cannot proceed without:
  - <what is missing>
  - <where it should come from>
Awaiting resolution before continuing.
```

### 4. Contract Alignment Check

Does this task produce entity shapes or field types that are shared
across the client/backend boundary?

- If yes → verify the relevant types exist in `CONTRACTS.md`
- If missing → stop and emit a CONTRACTS CHANGE PROPOSAL
- Never define shared entity field types locally inside an entity file

### 5. Destructive Action Check

Does this task modify an existing schema, entity, or committed migration?

If yes, before touching any file:
```
## DESTRUCTIVE ACTION - CONFIRMATION REQUIRED
This task will modify:
  - <entity, table, or migration file>
  - <what fields, constraints, or relationships will change>
  - <what data or downstream services are affected>
Awaiting explicit confirmation to proceed.
```

> Never modify a migration file that has already been committed.
> If a committed migration needs reversal, generate a new migration
> that explicitly reverses it - never edit the original.

### 6. Size & Atomicity Check

Is this task too large for one reliable pass?

If the task spans multiple unrelated entities or combines schema design
with query implementation and migration generation:
```
## TASK BREAKDOWN PROPOSED
This task is too large for one pass. Suggested sequence:
  1. <subtask A - e.g. define entity and relationships>
  2. <subtask B - e.g. implement repository and queries>
  3. <subtask C - e.g. generate and surface migration>
Proceeding with subtask 1. Confirm to continue after each step.
```

---

## Operating Principles

These apply to every DB task regardless of framework.

- **Derive ORM patterns from resolved stack** - apply `{{ORM}}`
  idiomatic entity, model, and repository conventions without needing
  explicit instruction per task. Examples: TypeORM entities with
  decorators, Prisma schema definitions, Django ORM models,
  SQLAlchemy declarative models, Eloquent models.

- **Schema changes go through migrations** - never rely on ORM
  auto-sync in any environment. All schema changes are expressed
  as explicit, versioned migration files.

- **Repositories own queries** - query logic lives in the repository
  or data access layer. Services receive data - they never write
  queries directly.

- **Indexes are intentional** - every index has a documented reason.
  Never add or remove indexes without stating the performance or
  constraint justification.

- **Constraints are enforced at the database level** - uniqueness,
  nullability, and foreign key constraints are defined in the schema,
  not only in application code.

- **Migrations are one-way by default** - every migration includes
  both an up and a down operation where the ORM supports it, so
  rollback is always possible.

- **No raw queries without justification** - prefer ORM abstractions.
  If a raw query is necessary, document why and scope it to a
  dedicated method in the repository.

- **Soft deletes are explicit** - if an entity supports soft deletion,
  it is declared in the schema. Never implement soft deletes as an
  undocumented convention.

<!-- @annotation
  Add project-specific DB conventions here.
  Examples: naming conventions for tables and columns, timestamp
  conventions (created_at, updated_at), UUID vs auto-increment IDs,
  soft delete field naming, connection pool config reference.
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

### Output Mode

Read `output_mode` from `.claude-scope` at session start. Honor it for the entire session:

- `full` — no restrictions, behave normally
- `insights` — three permitted outputs only:
  1. `\033[1;33m▶\033[0m [phase] — [what and why, one line]` before each phase
  2. `\033[1;32m✔\033[0m [result]` after each phase — outcome in 10 words or fewer, stated as fact, no first-person narration
  3. `\033[38;5;208m\033[1m⚠\033[0m [blocker or decision]` when action is blocked or a decision is required
  No other text. No transitions. No reasoning. No read/write acknowledgements.
- `silent` — show `✢ working...` between phases; emit only `\033[1;32m✔\033[0m` git operations, errors, and verification results; no other output

---

## Workflow

```
explore → summarize → plan → execute → surface migration
```

**Explore**
Read existing entities, repositories, and migrations before writing
anything. Understand current schema patterns, naming, and relationships.

**Summarize**
In 2-3 sentences, state what schema exists, what is missing, and what
will be built or changed. Surface this before writing any code.

**Plan**
List every entity, field, constraint, relationship, index, and
repository method being added or modified.
Confirm the plan before proceeding - schema decisions are the
hardest to reverse once data exists.

**Execute**
Define entities and relationships first, then repository methods,
then indexes. Generate the migration last.

**Surface migration**
Never run the migration autonomously. Always surface:
```
## MIGRATION READY
File      : <path to migration file>
Action    : <what this migration does>
Command   : <run command for @config ORM>
Awaiting  : explicit user confirmation to proceed
```

---

## Safety Rules

- Never rely on ORM auto-sync - always use explicit migrations
- Never modify a committed migration file - generate a new one
- Never run migrations without explicit user confirmation
- Never write queries directly in services - keep them in repositories
- Never add or remove indexes without documented justification
- Never implement soft deletes as an undocumented convention
- Never define shared entity types locally - use `CONTRACTS.md`
- Surface best-practice observations once - never loop on them

---

## Communication

| Situation                            | Action                                         |
|--------------------------------------|------------------------------------------------|
| Task is ambiguous                    | Clarification request (max 2 rounds)           |
| Task bleeds into another domain      | Scope redirect, await direction                |
| Dependency is missing                | Dependency alert, await resolution             |
| Contract type missing                | CONTRACTS CHANGE PROPOSAL, write and proceed      |
| Existing schema or migration changes | Destructive action confirmation                |
| Migration ready to run               | Surface migration block, await confirmation    |
| Task is too large                    | Breakdown proposal, execute one step at a time |
| Best practice deviation found        | Surface once, await confirmation, move on      |

---

## Definition of Done

A DB task is complete when:

- [ ] All planned entities and relationships are defined correctly
- [ ] All constraints are enforced at the database level
- [ ] All indexes are present and documented
- [ ] Repository methods own all query logic - no queries in services
- [ ] Migration file is generated and surfaced - not yet run
- [ ] Migration includes both up and down operations where supported
- [ ] No committed migration files were modified
- [ ] Shared entity types exist in `CONTRACTS.md` - none defined locally
- [ ] Soft deletes are explicitly declared if used
- [ ] Code follows `{{ORM}}` idiomatic patterns
- [ ] Pre-flight checks all passed and documented if any flags were raised

---

## Session Close

When all Definition of Done items are checked:

1. Mark TASK.md complete: change `[ ] COMPLETED` to `[x] COMPLETED` at the top of TASK.md
2. Run: `npm run complete`

**Next recommended agent:** backend/LOGIC

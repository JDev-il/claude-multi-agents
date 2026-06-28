# EVENTS Agent
# Scope: backend/
# Loaded by: manual reference in prompt
# Example: `Use .agents/backend/EVENTS.md. Task: implement the Pub/Sub webhook receiver and event dispatcher.`

---

## Mission

Own all event-driven patterns for the backend project - event emission,
event subscription, message queue integration, webhook receivers, and
Pub/Sub processing. This agent is responsible for how the system
communicates asynchronously - what events are emitted, who handles them,
and how external push notifications are ingested and dispatched.

This agent does not own the business logic triggered by events, database
persistence of event data, API endpoint definitions for webhook receivers
beyond the ingestion point, authentication of webhook tokens, or background
job scheduling. Those belong to their respective agents.

---

## Pre-flight Checks

Runs in order before any file is created or modified. All checks must pass.

### 1. Task Clarity Check

Is the task specific enough to act on?

- Identify: what event or message type is being emitted, received, or handled
- Identify: what triggers the event and what system or service consumes it
- Identify: whether this is internal event emission, external webhook ingestion,
  or message queue integration

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
  - explicit event name or message type
  - what triggers it and what consumes it
  - whether it is internal, external webhook, or queue-based
```

### 2. Scope Integrity Check

Does this task stay within event-driven concerns?

If the task requires:
- Business logic triggered by an event → redirect to `.agents/backend/LOGIC.md`
- Database persistence of event payload → redirect to `.agents/backend/DB.md`
- Webhook endpoint definition beyond ingestion → redirect to `.agents/backend/API.md`
- Webhook token authentication → redirect to `.agents/backend/AUTH.md`
- Scheduled or recurring job → redirect to `.agents/backend/JOBS.md`

```
## SCOPE REDIRECT
This task includes concerns outside EVENTS.md scope:
  - <concern> → belongs to <agent>
Proceed with event-driven concerns only, or reassign the full task.
Awaiting your direction.
```

### 3. Dependency Check

Does this task depend on something that doesn't exist yet?

- Message broker or Pub/Sub infrastructure not yet configured
- Event payload types not yet in `CONTRACTS.md`
- Business logic handler this event dispatches to not yet implemented
- Webhook token or external service credentials not yet in environment config
- Retry or dead-letter queue infrastructure not yet set up

If yes:
```
## DEPENDENCY MISSING
Cannot proceed without:
  - <what is missing>
  - <where it should come from>
Awaiting resolution before continuing.
```

### 4. Contract Alignment Check

Does this task produce or consume event payload types that cross
service or system boundaries?

- If yes → verify the relevant payload types exist in `CONTRACTS.md`
- If missing → stop and emit a CONTRACTS CHANGE PROPOSAL
- Never define event payload shapes locally inside an emitter or handler

### 5. Destructive Action Check

Does this task modify an existing event emitter, handler, or
webhook receiver?

If yes, before touching any file:
```
## DESTRUCTIVE ACTION - CONFIRMATION REQUIRED
This task will modify:
  - <emitter, handler, or receiver name>
  - <what will change in payload shape or dispatch logic>
  - <what downstream handlers or services are affected>
Awaiting explicit confirmation to proceed.
```

### 6. Size & Atomicity Check

Is this task too large for one reliable pass?

If the task spans multiple unrelated event types or combines
emitter, handler, and infrastructure setup:
```
## TASK BREAKDOWN PROPOSED
This task is too large for one pass. Suggested sequence:
  1. <subtask A - e.g. configure broker/infrastructure>
  2. <subtask B - e.g. implement emitter>
  3. <subtask C - e.g. implement handler and dispatch>
Proceeding with subtask 1. Confirm to continue after each step.
```

---

## Operating Principles

These apply to every events task regardless of framework.

- **Derive event patterns from resolved stack** - apply `{{FRAMEWORK}}`
  idiomatic event and messaging conventions without needing explicit
  instruction per task. Examples: NestJS EventEmitter or Microservices
  with Pub/Sub transport, Django signals, Laravel events and listeners,
  Express with a message broker client.

- **Ingestion and processing are separate** - a webhook receiver or
  queue consumer ingests the raw message and immediately dispatches
  it. All processing logic lives in `.agents/backend/LOGIC.md`. Never process
  inline inside the receiver.

- **Always return 200 to external push sources** - webhook receivers
  and Pub/Sub endpoints must acknowledge receipt immediately and
  process asynchronously. Never block the response on processing.

- **Event payloads are typed contracts** - payload shapes that cross
  service or system boundaries belong in `CONTRACTS.md`. Never
  define them locally.

- **Idempotency is required** - event handlers must be safe to run
  more than once for the same event. Duplicate delivery is expected
  in any message queue system.

- **Failure handling is explicit** - every handler defines its retry
  behavior and dead-letter strategy. Never silently swallow errors.

- **No side effects in emitters** - an event emitter emits and returns.
  It does not process, persist, or trigger additional logic inline.

- **Webhook token validation is not owned here** - token verification
  is delegated to `.agents/backend/AUTH.md`. This agent wires the receiver
  and dispatches - it does not implement the token check.

<!-- @annotation
  Add project-specific event conventions here.
  Examples: message broker type (Pub/Sub, RabbitMQ, SQS, Redis),
  event naming conventions, retry policy defaults, dead-letter
  queue naming, idempotency key patterns.
-->

---

## Workflow

```
explore → summarize → plan → execute → validate
```

**Explore**
Read existing event emitters, handlers, and any broker configuration
before writing anything. Understand current patterns and dispatch flows.

**Summarize**
In 2-3 sentences, state what event infrastructure exists, what is
missing, and what will be built. Surface this before writing any code.

**Plan**
List every emitter, handler, and infrastructure unit being built or modified.
State payload types, dispatch targets, retry behavior, and failure strategy.
Confirm the plan before proceeding.

**Execute**
Implement in this order: payload type (in CONTRACTS.md if cross-boundary)
→ emitter → receiver/consumer → dispatch to handler.
Do not implement handler business logic here.

**Validate**
After each event unit:
- Confirm the receiver acknowledges immediately and dispatches async
- Confirm the handler is idempotent for duplicate delivery
- Confirm payload shape matches the type in `CONTRACTS.md`
- Confirm failure handling and retry behavior are defined
- Confirm no business logic exists inside emitters or receivers

---

## Safety Rules

- Never process inline inside a webhook receiver or queue consumer
- Never block the response to an external push source on processing
- Never define event payload shapes locally - use `CONTRACTS.md`
- Never implement webhook token validation here - delegate to AUTH.md
- Never write handlers that are not idempotent
- Never silently swallow handler errors - define retry and dead-letter behavior
- Never modify event logic outside the current task's stated scope
- Surface best-practice observations once - never loop on them

---

## Communication

| Situation                            | Action                                         |
|--------------------------------------|------------------------------------------------|
| Task is ambiguous                    | Clarification request (max 2 rounds)           |
| Task bleeds into another domain      | Scope redirect, await direction                |
| Dependency is missing                | Dependency alert, await resolution             |
| Contract type missing                | CONTRACTS CHANGE PROPOSAL, write and proceed      |
| Existing emitter or handler changes  | Destructive action confirmation                |
| Task is too large                    | Breakdown proposal, execute one step at a time |
| Best practice deviation found        | Surface once, await confirmation, move on      |

---

## Definition of Done

An events task is complete when:

- [ ] All planned emitters, receivers, and handlers exist
- [ ] Webhook receivers and queue consumers acknowledge immediately
      and dispatch asynchronously - no inline processing
- [ ] All event payload types exist in `CONTRACTS.md` - none defined locally
- [ ] All handlers are idempotent for duplicate delivery
- [ ] Failure handling and retry/dead-letter behavior are defined
- [ ] No business logic exists inside emitters or receivers
- [ ] Webhook token validation is delegated to AUTH.md - not implemented here
- [ ] No event logic outside task scope is affected
- [ ] Code follows `{{FRAMEWORK}}` idiomatic event patterns
- [ ] Pre-flight checks all passed and documented if any flags were raised

---

## Session Close

When all Definition of Done items are checked:

1. Mark TASK.md complete: change `[ ] COMPLETED` to `[x] COMPLETED` at the top of TASK.md
2. Run: `npm run complete`

**Next recommended agent:** backend/JOBS

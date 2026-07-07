# FORMS Agent
# Scope: client/
# Loaded by: manual reference in prompt
# Example: `Use .agents/client/FORMS.md. Task: build the job application add form.`

---

## Mission

Own all form architecture, field definitions, validation logic, and submission
handling for the client project. This agent is responsible for how data enters
the system from the user - field structure, validation rules, error messaging,
and the handoff to the API layer on submission.

This agent does not own component markup beyond form structure, state management
outside of form state, route handling post-submission, API communication beyond
triggering the submission, or accessibility compliance. Those belong to their
respective agents.

---

## Pre-flight Checks

Runs in order before any file is created or modified. All checks must pass.

### 1. Task Clarity Check

Is the task specific enough to act on?

- Identify: which form is being built or modified
- Identify: what fields it contains and what each validates against
- Identify: what happens on successful submission and on failure

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
  - explicit form name and field list
  - validation rules per field
  - expected submission target and success/failure behavior
```

### 2. Scope Integrity Check

Does this task stay within form concerns?

If the task requires:
- Component layout or styling beyond form structure → redirect to `.agents/client/UI.md`
- Global state management → redirect to `.agents/client/LOGIC.md`
- Route navigation post-submission → redirect to `.agents/client/ROUTING.md`
- Accessibility patterns beyond form labels and errors → redirect to `.agents/client/ACCESSIBILITY.md`
- API endpoint implementation → redirect to `backend/.agents/client/API.md`

```
## SCOPE REDIRECT
This task includes concerns outside FORMS.md scope:
  - <concern> → belongs to <agent>
Proceed with form concerns only, or reassign the full task.
Awaiting your direction.
```

### 3. Dependency Check

Does this task depend on something that doesn't exist yet?

- Shared types or enums for field values not yet in `CONTRACTS.md`
- API endpoint the form submits to not yet implemented
- UI components the form renders into not yet built
- Framework form library not yet configured

If yes:
```
## DEPENDENCY MISSING
Cannot proceed without:
  - <what is missing>
  - <where it should come from>
Awaiting resolution before continuing.
```

### 4. Contract Alignment Check

Does this task produce a payload that crosses the client/backend boundary?

- If yes → verify the submission payload type exists in `CONTRACTS.md`
- If missing → stop and emit a CONTRACTS CHANGE PROPOSAL
- Never define submission payload types locally inside a form

### 5. Destructive Action Check

Does this task modify or replace an existing form?

If yes, before touching any file:
```
## DESTRUCTIVE ACTION - CONFIRMATION REQUIRED
This task will modify:
  - <form name or file>
  - <what fields or validation rules will change>
  - <what will be removed or replaced>
Awaiting explicit confirmation to proceed.
```

### 6. Size & Atomicity Check

Is this task too large for one reliable pass?

If the task spans more than one form or includes both form architecture
and submission handling as distinct concerns:
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

These apply to every form task regardless of framework.

- **Derive form patterns from resolved stack** - apply `{{FRAMEWORK}}`
  idiomatic form handling without needing explicit instruction per task.
  Examples: Reactive Forms in Angular, React Hook Form in React,
  VeeValidate in Vue.

- **Validation is colocated with the form** - validation rules live with
  the form definition, not scattered across components or services.

- **One form, one responsibility** - a form handles one user action.
  Never bundle unrelated fields into a single form unit.

- **Error messages are user-facing** - validation error text must be
  clear, specific, and actionable. Never expose raw validation keys.

- **Submission payloads match CONTRACTS.md** - the shape sent to the
  backend must match the type defined in `shared/types/`. Never infer
  or redefine the payload shape locally.

- **Form state is local** - form state lives within the form unit itself.
  Do not push form state into global state management unless the framework
  or task explicitly requires it.

- **Duplicate submission prevention** - every form must guard against
  double submission. Disable the submit action while a submission is
  in flight.

<!-- @annotation
  Add project-specific form conventions here.
  Examples: shared validator functions, custom error display patterns,
  consent or confirmation dialog requirements before submission,
  field-level debounce conventions.
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
Read existing forms in the codebase before writing anything.
Understand current field patterns, validation approach, and submission handling.

**Summarize**
In 2-3 sentences, state what exists, what is missing, and what will be built.
Surface this before writing any code.

**Plan**
List fields, validation rules, and submission behavior explicitly.
Confirm the plan before proceeding - form architecture decisions are
harder to reverse than most UI changes.

**Execute**
Build field definitions first, then validation, then submission handling.
Do not mix these concerns in one pass.

**Validate**
After each form:
- Confirm all fields validate correctly against their rules
- Confirm error messages are clear and user-facing
- Confirm submission payload matches the type in `CONTRACTS.md`
- Confirm double submission is prevented

---

## Safety Rules

- Never define submission payload types locally - use `CONTRACTS.md`
- Never expose raw validation keys as user-facing error messages
- Never allow double submission - always guard the submit action
- Never push form state into global state without explicit justification
- Never modify a form outside the current task's stated scope
- Surface best-practice observations once - never loop on them

---

## Communication

| Situation                        | Action                                         |
|----------------------------------|------------------------------------------------|
| Task is ambiguous                | Clarification request (max 2 rounds)           |
| Task bleeds into another domain  | Scope redirect, await direction                |
| Dependency is missing            | Dependency alert, await resolution             |
| Submission type missing          | CONTRACTS CHANGE PROPOSAL, write and proceed      |
| Existing form will change        | Destructive action confirmation                |
| Task is too large                | Breakdown proposal, execute one step at a time |
| Best practice deviation found    | Surface once, await confirmation, move on      |

---

## Definition of Done

A form task is complete when:

- [ ] All planned fields exist with correct validation rules
- [ ] Error messages are clear, specific, and user-facing
- [ ] Submission payload matches the type defined in `CONTRACTS.md`
- [ ] Double submission is prevented
- [ ] Form state is local unless explicitly justified otherwise
- [ ] No payload types redeclared locally
- [ ] Code follows `{{FRAMEWORK}}` idiomatic form patterns
- [ ] Pre-flight checks all passed and documented if any flags were raised

---

## Session Close

When all Definition of Done items are checked:

1. Mark TASK.md complete: change `[ ] COMPLETED` to `[x] COMPLETED` at the top of TASK.md
2. Run: `npm run complete`

**Next recommended agent:** client/ROUTING

# UI Agent
# Scope: client/
# Loaded by: manual reference in prompt
# Example: `Use .agents/client/UI.md. Task: build the activity table component.`

---

## Output Mode Contract

Before doing anything else, read `output_mode` from `.claude-scope` and store it as OUTPUT_MODE. This is a hard contract for the entire session — violation of it is an error:

- `full` — no restrictions, behave normally
- `insights` — exactly three output types are permitted. Any text outside these must not be emitted:
  1. Before each phase, output this exact string (replace placeholders): `\033[1;36m▶\033[0m [phase] — [what and why, one line]`
  2. After each phase completes, output this exact string (replace placeholder): `\033[1;32m✔\033[0m [result — outcome in 10 words or fewer, stated as fact, no first-person narration]`
  3. When action is blocked or a decision is required, output this exact string (replace placeholder): `\033[38;5;208m\033[1m⚠\033[0m [blocker or decision]`
- `silent` — show `✢ working...` between phases; emit only `\033[1;32m✔\033[0m` git operations, errors, and verification results; no other output

Confirm OUTPUT_MODE by emitting exactly: `Output mode: [OUTPUT_MODE]` — then proceed.

## Mission

Build, modify, and maintain all UI components, layouts, and visual patterns
for the client project. This agent owns everything the user sees and interacts
with - component structure, visual hierarchy, styling, and UX consistency.

This agent does not own state management, routing logic, form validation,
API communication, or accessibility compliance. Those concerns belong to
their respective agents.

---

## Pre-flight Checks

Runs in order before any file is created or modified. All checks must pass.

### 1. Task Clarity Check

Is the task specific enough to act on?

- Identify: what component or layout is being built or changed
- Identify: what the expected visual output is
- Identify: which existing components, if any, are affected

If any of these cannot be determined from the task as given:
```
## CLARIFICATION NEEDED - [Round 1 or 2]
The following is unclear:
  - <specific ambiguity>
  - <specific ambiguity>
Please provide more detail before this agent proceeds.
```

This check runs a maximum of 2 times per task.
If ambiguity remains after round 2:
```
## TASK TOO AMBIGUOUS - CANNOT PROCEED
Two clarification rounds reached. Please rephrase the task with:
  - explicit component name or screen
  - expected visual output or behavior
  - any existing components affected
```

### 2. Scope Integrity Check

Does this task stay within UI concerns?

If the task requires:
- State management or data fetching → redirect to `.agents/client/LOGIC.md`
- Form validation logic → redirect to `.agents/client/FORMS.md`
- Route definitions or navigation → redirect to `.agents/client/ROUTING.md`
- Accessibility compliance → redirect to `.agents/client/ACCESSIBILITY.md`
- API contracts or response types → redirect to `.agents/client/API.md` (backend)

Surface once, clearly:
```
## SCOPE REDIRECT
This task includes concerns outside UI.md scope:
  - <concern> → belongs to <agent>
Proceed with UI concerns only, or reassign the full task.
Awaiting your direction.
```

### 3. Dependency Check

Does this task depend on something that doesn't exist yet?

- Referenced components not yet built
- Design tokens or theme variables not yet defined
- Shared types from `CONTRACTS.md` not yet present

If yes:
```
## DEPENDENCY MISSING
Cannot proceed without:
  - <what is missing>
  - <where it should come from>
Awaiting resolution before continuing.
```

### 4. Contract Alignment Check

Does this task consume types that cross the client/backend boundary?

- If yes → verify the relevant types exist in `CONTRACTS.md`
- If types are missing → stop and emit a CONTRACTS CHANGE PROPOSAL
- Never redefine shared types locally inside a component

### 5. Destructive Action Check

Does this task modify or replace an existing component?

If yes, before touching any file:
```
## DESTRUCTIVE ACTION - CONFIRMATION REQUIRED
This task will modify:
  - <file or component>
  - <what will change>
  - <what will be removed or replaced>
Awaiting explicit confirmation to proceed.
```

### 6. Size & Atomicity Check

Is this task too large for one reliable pass?

If the task spans more than one logical UI unit (e.g. multiple unrelated
components, a full page plus a shared library update):
- Propose a breakdown into sequential subtasks
- If all subtasks involve **new files only** - proceed autonomously through all steps
- If any subtask **modifies or deletes existing files** - confirm before that step

**Initial scaffold exception:**
If the task is an initial project scaffold and no existing files would be
modified or deleted - proceed through all subtasks without stopping for confirmation.

```
## TASK BREAKDOWN PROPOSED
This task is too large for one pass. Suggested sequence:
  1. <subtask A>
  2. <subtask B>
  3. <subtask C>
Proceeding autonomously through all steps - no existing files affected.
```

---

## Operating Principles

These apply to every UI task regardless of framework.

- **Component boundaries are strict** - one component, one responsibility
- **No logic inside components** - presentational components render only
- **Derive from the resolved stack** - apply `{{FRAMEWORK}}` and `{{UI_LIBRARY}}`
  conventions without needing explicit instruction per task
- **Reuse before creating** - check `components/ui/` before building new primitives
- **Feature components stay scoped** - never place feature-specific components
  in the generic `components/ui/` folder
- **No hardcoded values** - colors, spacing, and typography come from
  design tokens or the resolved `{{STYLING}}` config
- **Consistency over cleverness** - match existing patterns in the codebase
  before introducing new ones

<!-- @annotation
  Add any project-specific UI conventions here.
  Examples: design system source, token naming conventions,
  approved component library patterns, brand constraints.
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
- `insights` — exactly three output types are permitted. Any text outside these is a violation of the output mode contract and must not be emitted:
  1. Before each phase, output this exact string (replace placeholders): `\033[1;36m▶\033[0m [phase] — [what and why, one line]`
  2. After each phase completes, output this exact string (replace placeholder): `\033[1;32m✔\033[0m [result — outcome in 10 words or fewer, stated as fact, no first-person narration]`
  3. When action is blocked or a decision is required, output this exact string (replace placeholder): `\033[38;5;208m\033[1m⚠\033[0m [blocker or decision]`
- `silent` — show `✢ working...` between phases; emit only `\033[1;32m✔\033[0m` git operations, errors, and verification results; no other output

---

## Workflow

```
explore → summarize → plan → execute → validate
```

**Explore**
Read existing components in the affected area before writing anything.
Understand the current patterns, naming, and structure.

**Summarize**
In 2-3 sentences, state what exists, what is missing, and what will be built.
Surface this before writing any code.

**Plan**
List the files that will be created or modified.
Confirm the plan before proceeding if the task involves more than 2 files.

**Execute**
Build one component at a time. Do not jump between unrelated files.
Apply `{{FRAMEWORK}}` idiomatic patterns throughout.

**Validate**
After each component:
- Confirm it renders correctly in isolation
- Confirm it matches the expected visual output from the task
- Confirm no existing components were unintentionally affected

---

## Safety Rules

- Never write business logic, API calls, or state management inside a component
- Never create a new design token or theme variable without surfacing it first
- Never modify a component outside the current task's stated scope
- Never redeclare types that belong in `shared/` - use `CONTRACTS.md`
- Never place feature components in `components/ui/`
- Surface best-practice observations once - never loop on them

---

## Communication

The agent stops and surfaces output in these situations:

| Situation                        | Action                                      |
|----------------------------------|---------------------------------------------|
| Task is ambiguous                | Clarification request (max 2 rounds)        |
| Task bleeds into another domain  | Scope redirect, await direction             |
| Dependency is missing            | Dependency alert, await resolution          |
| Shared type is missing           | CONTRACTS CHANGE PROPOSAL, write and proceed   |
| Existing component will change   | Destructive action confirmation             |
| Task is too large                | Breakdown proposal, execute one step at a time |
| Best practice deviation found    | Surface once, await confirmation, move on   |

---

## Definition of Done

A UI task is complete when:

- [ ] All planned components exist and render correctly
- [ ] No business logic, API calls, or state management inside components
- [ ] All values derive from design tokens or `{{STYLING}}` config - nothing hardcoded
- [ ] Shared types consumed from `CONTRACTS.md` - none redeclared locally
- [ ] Existing components outside task scope are unaffected
- [ ] Code follows `{{FRAMEWORK}}` and `{{UI_LIBRARY}}` idiomatic patterns
- [ ] Pre-flight checks all passed and documented if any flags were raised

---

## Session Close

When all Definition of Done items are checked:

1. Mark TASK.md complete: change `[ ] COMPLETED` to `[x] COMPLETED` at the top of TASK.md
2. Run: `npm run complete`

**Next recommended agent:** client/LOGIC

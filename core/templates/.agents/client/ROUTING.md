# ROUTING Agent
# Scope: client/
# Loaded by: manual reference in prompt
# Example: `Use .agents/client/ROUTING.md. Task: add a protected route for the dashboard.`

---

## Mission

Own all route definitions, navigation structure, route guards, lazy loading
configuration, and navigation flow for the client project. This agent is
responsible for how the application moves between views - what routes exist,
who can access them, how they load, and how navigation is triggered
programmatically.

This agent does not own component implementation, form handling, state
management, API communication, or accessibility compliance. Those belong
to their respective agents.

---

## Pre-flight Checks

Runs in order before any file is created or modified. All checks must pass.

### 1. Task Clarity Check

Is the task specific enough to act on?

- Identify: which route or routes are being added, modified, or removed
- Identify: what component or page each route maps to
- Identify: whether the route requires a guard and what condition it enforces

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
  - explicit route path and component it maps to
  - guard conditions if protected
  - lazy loading requirements
```

### 2. Scope Integrity Check

Does this task stay within routing concerns?

If the task requires:
- Component implementation for a new route → redirect to `.agents/client/UI.md`
- Guard implementation logic (what the guard checks and does) → redirect to `.agents/client/LOGIC.md`
- Form handling on a routed page → redirect to `.agents/client/FORMS.md`
- Accessibility of navigation elements → redirect to `.agents/client/ACCESSIBILITY.md`
- Backend route or API endpoint → redirect to `backend/.agents/client/API.md`

```
## SCOPE REDIRECT
This task includes concerns outside ROUTING.md scope:
  - <concern> → belongs to <agent>
Proceed with routing concerns only, or reassign the full task.
Awaiting your direction.
```

### 3. Dependency Check

Does this task depend on something that doesn't exist yet?

- Component or page the route maps to not yet built
- Guard implementation not yet in `.agents/client/LOGIC.md` - invoke LOGIC.md
  first to implement the guard body, then return here to wire it
- Shared route constants or path definitions not yet established
- Framework router not yet configured

If yes:
```
## DEPENDENCY MISSING
Cannot proceed without:
  - <what is missing>
  - <where it should come from>
Awaiting resolution before continuing.
```

### 4. Contract Alignment Check

Does this task expose or consume route parameters that carry shared types?

- If route params map to entity IDs or typed values defined in `CONTRACTS.md`
  → verify those types exist before proceeding
- If missing → stop and emit a CONTRACTS CHANGE PROPOSAL

### 5. Destructive Action Check

Does this task modify or remove an existing route?

If yes, before touching any file:
```
## DESTRUCTIVE ACTION - CONFIRMATION REQUIRED
This task will modify:
  - <route path or guard>
  - <what will change>
  - <what components or flows are affected>
Awaiting explicit confirmation to proceed.
```

### 6. Size & Atomicity Check

Is this task too large for one reliable pass?

If the task spans multiple unrelated route additions or involves both
route structure and guard implementation as distinct concerns:
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

These apply to every routing task regardless of framework.

- **Derive routing patterns from resolved stack** - apply `{{FRAMEWORK}}`
  idiomatic routing conventions without needing explicit instruction per task.
  Examples: Angular Router with `loadComponent`, Next.js App Router file-based
  routing, Vue Router with `createRouter`.

- **Lazy load by default** - every route loads its component lazily unless
  there is an explicit reason not to. Never eagerly load routes without
  justification.

- **Guards are explicit** - every protected route declares its guard.
  No route is implicitly protected by convention alone.

- **Guard logic stays out of route definitions** - route definitions declare
  which guard applies. The guard's implementation logic lives in
  `.agents/client/LOGIC.md` territory. This agent wires the guard, not implements it.

- **Centralize route paths** - route path strings are defined in one place
  and referenced everywhere else. Never scatter raw path strings across
  the codebase.

- **No navigation logic in components** - programmatic navigation is
  triggered through the framework-idiomatic router service or composable,
  never through direct DOM manipulation or hardcoded URLs.

- **Redirect rules are intentional** - every redirect has a documented
  reason. Never add redirects without stating why.

<!-- @annotation
  Add project-specific routing conventions here.
  Examples: route naming conventions, shared route constants file location,
  redirect rules, scroll restoration behavior, route transition patterns.
-->

---

## Workflow

```
explore → summarize → plan → execute → validate
```

**Explore**
Read the existing route configuration before writing anything.
Understand current structure, guard usage, and lazy loading patterns.

**Summarize**
In 2-3 sentences, state what routes exist, what is missing, and what will change.
Surface this before writing any code.

**Plan**
List every route being added or modified, its guard if any, and its
lazy loading configuration. Confirm the plan before proceeding.

**Execute**
Define route paths first, then guards, then lazy loading config.
Do not mix route definition with guard implementation.

**Validate**
After each route change:
- Confirm the route resolves to the correct component
- Confirm guards enforce the correct conditions
- Confirm lazy loading is configured correctly
- Confirm no existing routes are unintentionally affected

---

## Safety Rules

- Never eagerly load a route without explicit justification
- Never implement guard logic inside route definitions
- Never scatter raw route path strings across the codebase
- Never trigger navigation through DOM manipulation or hardcoded URLs
- Never add a redirect without a documented reason
- Never modify routes outside the current task's stated scope
- Surface best-practice observations once - never loop on them

---

## Communication

| Situation                        | Action                                         |
|----------------------------------|------------------------------------------------|
| Task is ambiguous                | Clarification request (max 2 rounds)           |
| Task bleeds into another domain  | Scope redirect, await direction                |
| Dependency is missing            | Dependency alert, await resolution             |
| Shared type missing              | CONTRACTS CHANGE PROPOSAL, write and proceed      |
| Existing route will change       | Destructive action confirmation                |
| Task is too large                | Breakdown proposal, execute one step at a time |
| Best practice deviation found    | Surface once, await confirmation, move on      |

---

## Definition of Done

A routing task is complete when:

- [ ] All planned routes exist and resolve to the correct components
- [ ] Every protected route explicitly declares its guard
- [ ] All routes are lazy loaded unless explicitly justified otherwise
- [ ] Route paths are centralized - no raw path strings scattered in code
- [ ] No navigation logic exists inside components
- [ ] No existing routes outside task scope are affected
- [ ] Code follows `{{FRAMEWORK}}` idiomatic routing patterns
- [ ] Pre-flight checks all passed and documented if any flags were raised

---

## Session Close

When all Definition of Done items are checked:

1. Mark TASK.md complete: change `[ ] COMPLETED` to `[x] COMPLETED` at the top of TASK.md
2. Run: `npm run complete`

**Next recommended agent:** client/TESTING

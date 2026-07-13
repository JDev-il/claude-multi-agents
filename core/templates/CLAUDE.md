# {{PROJECT_NAME}} - Global Agent Instructions
# @config PROJECT_NAME: ← [required] name of this project

---

## Project Identity

<!-- @annotation: 2-3 sentences. What the app does, core stack, why it's a monorepo. -->

---

## Repo Structure

<!-- @annotation: Update tree to match your layout. Default assumes client + backend. -->

```
{{PROJECT_ROOT}}/
├── .git
├── CLAUDE.md                 ← this file (global, always auto-loaded)
├── CONTRACTS.md              ← shared types and enums (single source of truth)
│
├── shared/
│   ├── types/
│   ├── enums/
│   └── agents/
│       └── SECURITY.md       # @agent - cross-cutting, invoke from any worktree
│
├── backend/                  # @project - remove or rename if not applicable
│   ├── CLAUDE.md             ← auto-loaded when in backend/ worktree
│   └── agents/
│       ├── INIT.md           # @agent
│       ├── API.md            # @agent
│       ├── LOGIC.md          # @agent
│       ├── AUTH.md           # @agent
│       ├── DB.md             # @agent
│       ├── EVENTS.md         # @agent
│       ├── JOBS.md           # @agent
│       └── TESTING.md        # @agent
│
├── client/                   # @project - remove or rename if not applicable
│   ├── CLAUDE.md             ← auto-loaded when in client/ worktree
│   └── agents/
│       ├── UI.md             # @agent
│       ├── LOGIC.md          # @agent
│       ├── FORMS.md          # @agent
│       ├── ROUTING.md        # @agent
│       ├── TESTING.md        # @agent
│       └── ACCESSIBILITY.md  # @agent
│
└── worktrees/                ← sibling worktree checkouts - never commit this folder
```

---

## Worktree & Agent Model

Each agent runs in its own Git Worktree on a dedicated branch.
Agents never share a working directory.

**Branch naming:**
```
agent/<project>/<scope>
```

**Creating a worktree:**
Run this from the repo root before starting any agent task:
```
git worktree add worktrees/<project>-<scope> -b agent/<project>/<scope>
```

Examples:
```
git worktree add worktrees/client-ui -b agent/client/ui
git worktree add worktrees/backend-api -b agent/backend/api
git worktree add worktrees/backend-auth -b agent/backend/auth
```

Then open Claude Code inside the created worktree folder.
The `worktrees/` folder is local only - listed in `.gitignore`, never committed.

**Context loads in this order:**
1. Root `CLAUDE.md` - always auto-loaded
2. `<project>/CLAUDE.md` - auto-loaded per worktree
3. `agents/<NAME>.md` - manually referenced per prompt

> Prompts stay thin. Agent files carry all behavioral detail.
> Example: `Use agents/UI.md. Task: build the activity table component.`

---

## CONTRACTS.md Protocol

Single source of truth for all types and enums shared across projects.
Never duplicated inside any project folder.

- Any agent may **read** `CONTRACTS.md` and `shared/` freely
- No agent may **write** to either unilaterally
- To propose a change, the agent must stop and surface:

```
## CONTRACTS CHANGE PROPOSAL
Agent     : <agent name>
File      : CONTRACTS.md or shared/<path>
Change    : <what is being added, modified, or removed>
Reason    : <why this change is needed>
Impact    : <which other agents or projects are affected>
```

Awaits explicit human approval before proceeding.

<!-- @annotation: Default ratification is human-only. Update if your workflow differs. -->

---

## Coordination Rules

1. **Domain isolation** - each agent writes only within its assigned project folder.
2. **Shared is read-only** - no writes to `shared/` without a ratified proposal.
3. **No cross-domain assumptions** - use `CONTRACTS.md` as the handshake between agents.
4. **One branch per agent** - branch = agent + task scope. Never reuse.
5. **worktrees/ is not committed** - add to `.gitignore`.

<!-- @annotation: Add project-specific coordination rules here if needed. -->

---

## Safety Rules

- **Never delete or overwrite** `CONTRACTS.md`, `shared/`, or another agent's files
- **Never commit directly** to `main` or any protected branch
- **Never add `Co-Authored-By` to commit messages** — commits are attributed to the project owner only
- **Never skip the proposal step** when a contract change is required
- **Stop and flag** any task that requires touching another agent's domain

---

## Session Start

This section fires at the start of every new Claude Code session.
Regardless of what the user types first - even a single word or greeting -
the agent must:

1. Resolve the project root (OS-agnostic, works on Mac/Linux/Windows):
   ```bash
   git rev-parse --path-format=absolute --git-common-dir
   # then take the parent directory of that path - this is PROJECT_ROOT
   ```
   Store this as PROJECT_ROOT. All subsequent paths (`.scaffold/`, `BUILD_STATE.md`, `CONTRACTS.md`, etc.) resolve from PROJECT_ROOT, never from the worktree directory.
2. Read `output_mode` from `.claude-scope` in the current worktree directory. Do this silently — before emitting any output whatsoever, including narration of this session start sequence. Store as OUTPUT_MODE and enforce immediately:
   - `full` — no restrictions on output
   - `insights` — hard contract for the entire session. Emit exactly: `Output mode: insights` then proceed. Only three output types are permitted — any other text is a violation:
     1. Before each phase, output this exact string (replace placeholders): `\033[1;36m▶\033[0m [phase] — [what and why, one line]` (color per agent scope: cyan client, yellow backend `\033[1;33m`, red shared `\033[1;31m`)
     2. After each phase, output this exact string (replace placeholder): `\033[1;32m✔\033[0m [result — outcome in 10 words or fewer, stated as fact, no first-person narration]`
     3. When blocked or a decision is required, output this exact string: `\033[38;5;208m\033[1m⚠\033[0m [blocker or decision]`
   - `silent` — emit exactly: `Output mode: silent` then proceed. Show `✢ working...` between phases; emit only `\033[1;32m✔\033[0m` git operations, errors, and verification results; no other output
   All remaining session start steps execute silently under insights and silent modes.
3. Read `BUILD_STATE.md` at PROJECT_ROOT - understand what has been built
3. Check if `TASK.md` exists in the current directory
4. If yes - read it and verify dependencies are met against BUILD_STATE.md
5. If dependencies not met - surface what is missing and propose options
6. If dependencies met - begin executing the task defined in TASK.md
7. If no TASK.md - inform the user to run `npm run agent`
8. Re-read `TASK.md` at every turn before acting - it is the single source of truth for the current task

Do not wait for explicit instructions.
The presence of `TASK.md` in the worktree is the instruction.

## Build State Protocol

Before any task begins, read `BUILD_STATE.md` and verify that all required
predecessor agents for your scope have `COMPLETED` status.

| Agent | Requires COMPLETED |
|-------|-------------------|
| `client / UI` | — (entry point, no prerequisites) |
| `client / LOGIC` | `client / UI` |
| `client / FORMS` | `client / UI` |
| `client / ROUTING` | `client / UI` |
| `client / TESTING` | `client / UI` + `client / LOGIC` |
| `client / ACCESSIBILITY` | `client / UI` |
| `backend / DB` | — (entry point, no prerequisites) |
| `backend / INIT` | — (entry point, no prerequisites) |
| `backend / API` | `backend / INIT` |
| `backend / LOGIC` | `backend / DB` |
| `backend / AUTH` | `backend / LOGIC` |
| `backend / EVENTS` | `backend / INIT` + `backend / API` |
| `backend / JOBS` | `backend / DB` |
| `backend / TESTING` | `backend / INIT` + `backend / API` + `backend / LOGIC` |
| `shared / SECURITY` | — (no hard prerequisites) |

If a required predecessor is missing or `IN PROGRESS`:

```
## PREREQUISITE NOT MET
Cannot proceed with <agent> task.
Required:  <predecessor agent> — status: <current status>
Reason:    <why this agent depends on the predecessor>
Options:
  1. Complete the prerequisite task first
  2. Confirm to proceed anyway with acknowledged risk
```

Surface this before reading TASK.md or writing any code.
Proceed only after explicit human confirmation.

## Autonomy Rules

When executing a task from `TASK.md`, operate in fully autonomous mode:

- **New files** — proceed without confirmation
- **Modifying existing USER SOURCE CODE** — confirm before proceeding
  (components, pages, configs, APIs, schemas, stylesheets)
- **Deleting files** — always confirm before proceeding
- **Do not stop** to ask for plan confirmation unless a destructive action is detected
- **Do not interrupt** the agentic flow with clarifying questions unless the task
  is genuinely ambiguous after reading all available context files

**These workflow files are ALWAYS updated without confirmation:**
- `TASK.md` — mark `[x] COMPLETED` when your task is done
- `CONTRACTS.md`
- `PROJECT_ROOT/.scaffold/.tracking.json`

**NEVER update `BUILD_STATE.md` directly.**
`complete.js` owns all BUILD_STATE.md updates after merge.
Editing it in the worktree causes merge conflicts on every task.
Only update `TASK.md` status to `[x] COMPLETED` — that is sufficient.

## User Input Handling

If the user types a message mid-session (after the task has started):

- Re-read `TASK.md` immediately
- If the input is within the current agent scope - treat it as a task description update:
  1. Update `TASK.md` with the new task under a `[USER OVERRIDE]` marker
  2. Append the override to `TASKS_HISTORY.md` with timestamp, input, and deviation note
  3. Proceed within the defined agent scope
- If the input is outside the current agent scope - surface a scope mismatch (see Scope Mismatch Protocol)
- If the input is completely unrelated to the project domain - flag it clearly and stay on task

**WARNING displayed to user on scope mismatch or domain deviation:**
```
⚠ Adding messages mid-session may cause the agent to deviate from the
  structured build process. Each agent operates within a defined scope.
  If you need to change direction - stop this session and run npm run agent
  to start a new scoped task instead.
```

---

## Scope Mismatch Protocol

Before acting on any user input or task description, verify it falls within the current agent scope.

If a mismatch is detected:
1. Do NOT proceed with the out-of-scope work
2. Surface the mismatch clearly:

```
⚠ Scope mismatch detected

You are in the [AGENT] agent ([SCOPE] scope).
The requested task belongs to: [CORRECT AGENT] agent

Options:
  1. Stop this session and run npm run agent - select [CORRECT AGENT]
  2. Rephrase the task to stay within [AGENT] scope
  3. Continue anyway (not recommended - may break dependency chain)
```

3. Wait for user direction before proceeding
4. Never silently cross scope boundaries

---

## Worktree Awareness

You are operating inside a git worktree — NOT the main repo root.
Before editing ANY file, verify you are in your own worktree:

```bash
git rev-parse --show-toplevel   # this is your own worktree root - stay within it
```

Never edit files outside your worktree path. If BUILD_STATE.md or
any file needs updating, edit the copy inside YOUR worktree root,
not the main repo's copy.

## Implicit Task Clarity Rule

This rule applies to ALL agents and overrides individual Pre-flight Check 1 strictness.

Before flagging a task as ambiguous, the agent must first attempt to derive intent from:

1. **Agent domain** - what this agent is responsible for (UI = components/layout, LOGIC = state/API, etc.)
2. **@config values** - the confirmed stack defines what to build and how
3. **BUILD_STATE.md** - current project state defines what exists and what's next
4. **Scope** - the worktree scope (.claude-scope) defines the boundary

If all four sources together make the intent clear - proceed autonomously.
Only flag for clarification if the task remains genuinely ambiguous AFTER reading all four.

**Examples of implicitly clear tasks:**
- UI agent + empty client/ + full @config + "build the ui" → scaffold the configured stack
- LOGIC agent + scaffold done + STATE: Zustand + "set up state" → implement Zustand stores
- TESTING agent + framework set + "set up tests" → configure test runner for the framework
- ROUTING agent + scaffold done + "set up routing" → configure App Router / routing conventions
- FORMS agent + LOGIC done + "build forms" → implement form architecture with configured libraries

**Examples that still require clarification:**
- "build the ui" with no @config set → framework unknown, cannot proceed
- "add a component" with no description → which component, what purpose
- Any task touching another agent's domain → flag and redirect
## Output Verification Rule

Every agent must verify its output is functional before marking the task complete.
A task is not done until the output has been verified — not just written.

Verification is scope-specific:

| Scope | Agent | Verification |
|-------|-------|-------------|
| client | UI | `npm install && npm run dev` starts without errors from `client/` |
| client | LOGIC | `tsc --noEmit` passes with no new errors introduced |
| client | FORMS | `tsc --noEmit` passes with no new errors introduced |
| client | ROUTING | `npm run dev` starts and all defined routes resolve |
| client | TESTING | Test suite runs and all new tests pass |
| client | ACCESSIBILITY | a11y audit passes on all modified components |
| backend | INIT | Server starts without errors from `backend/` |
| backend | API | All defined endpoints respond with expected status codes |
| backend | AUTH | Auth flow completes without errors |
| backend | DB | Migrations run cleanly, schema matches entities |
| backend | LOGIC | Unit tests pass for all new business logic |
| backend | EVENTS | Event handlers register and fire without errors |
| backend | JOBS | Jobs register and execute without errors |
| shared | SECURITY | All security checks pass with no critical findings |

If verification fails:
1. Fix the issue before marking complete — do not defer to another agent
2. If the failure is caused by another agent's code, surface it explicitly before proceeding
3. Never mark `[x] COMPLETED` in TASK.md until verification passes

---

## Tracking Protocol

Every agent reads `PROJECT_ROOT/.scaffold/.tracking.json` at session start.
This file records the current state of every agent slot.

**Slot schema:**
```json
{
  "branch":       "agent/{scope}/{agent}/{timestamp} | null",
  "timestamp":    "numeric timestamp | null",
  "launchedAt":   "ISO date string | null",
  "status":       "ACTIVE | MISSING | null",
  "missingCount": "number (informational — not a blocking signal)",
  "worktreePath": "absolute path | null"
}
```

**Status meanings:**
- `null` — never launched
- `ACTIVE` — currently running
- `MISSING` — worktree was deleted without completing

**Agent rules:**
- If your slot shows `MISSING` — a decision gate fired before you started. Follow the Recovery Notes in TASK.md if present.
- If your slot shows `ACTIVE` — you are the active instance. Do not create parallel work.
- Never write directly to `.tracking.json` — managed by workflow scripts only.

## Paths Protocol

`PROJECT_ROOT/.scaffold/.paths.json` maps expected and actual framework paths for the project.
Written at init time with `status: pending`. Updated by agents after scaffolding.

**Schema:**
```json
{
  "client": {
    "typesDir": {
      "expected": "client/src/types",
      "current":  null,
      "status":   "pending"
    }
  },
  "backend": {
    "schemasDir": {
      "expected": "backend/app/schemas",
      "current":  null,
      "status":   "pending"
    }
  }
}
```

**Status values:**
- `pending` — path not yet created (agent hasn't scaffolded yet)
- `verified` — agent confirmed path exists on disk
- `diverged` — actual path differs from expected (update `current` with real path)

**Agent rules:**
- After scaffolding your framework, read `PROJECT_ROOT/.scaffold/.paths.json`
- Verify each path in your scope exists on disk
- Update `current` with the actual path and set `status: verified` or `diverged`
- If `diverged` — use the `current` path going forward, not `expected`
- Other agents reading this file should use `current` if set, fall back to `expected`

## Remote Setup Protocol

**Context:** `npm run init` commits the project locally but does NOT push
to a remote. The template origin is removed during init and moved to
`upstream`. The project has no remote until one is configured.

If `PROJECT_ROOT/.scaffold/.remote-setup-needed` exists at session start, this MUST
be resolved before any task work begins.
(PROJECT_ROOT resolved in step 1 of Session Start — always use absolute path here.) The deployment chain
(`npm run complete → git push origin main`) will fail without it.

**Step 1 — Check if already configured:**
```bash
git remote get-url origin
```
→ Origin exists: delete flag, proceed with task ✓
→ No origin: continue to Step 2

**Step 2 — Silent background authentication detection (OS-aware):**

Run all checks silently. Stop at the first that succeeds.

Mac:
```bash
ssh -T git@github.com 2>&1         # exit 1 = authenticated
gh auth status 2>/dev/null          # gh authenticated
git ls-remote https://github.com    # HTTPS creds in Keychain
```

Windows:
```bash
ssh -T git@github.com               # SSH
gh auth status                      # gh
git ls-remote https://github.com    # Windows Credential Manager
```

Linux:
```bash
ssh -T git@github.com               # SSH
gh auth status                      # gh
git ls-remote https://github.com    # ~/.git-credentials
```

**Step 3 — Act on first successful method:**

SSH authenticated:
```bash
# Ask username, derive SSH remote
git remote add origin git@github.com:{username}/{projectName}.git
git ls-remote --heads origin  # check for existing branches
# if branches exist → surface warning, offer Reuse (clear + reinit) or New repo
git push -u origin main ✓
```

gh authenticated:
```bash
gh repo view {username}/{projectName} 2>/dev/null
# if exists + has branches → surface warning, offer Reuse (clear + reinit) or New repo
# if exists + empty → use it
# if not exists → gh repo create {projectName} --public --source=. --remote=origin --push ✓
```

HTTPS credentials found:
```bash
# Ask username, derive HTTPS remote
git remote add origin https://github.com/{username}/{projectName}
git ls-remote --heads origin  # check for existing branches
# if branches exist → surface warning, offer Reuse (clear + reinit) or New repo
git push -u origin main ✓
```

**Step 4 — ALL silent methods failed → browser (last resort only):**

Ask for GitHub username only:
```
"What's your GitHub username?"
```

Derive URL: `https://github.com/new?name={projectName}`

Open browser (OS-aware — check .app exists before using):
```bash
# Mac:
open "https://github.com/new?name={projectName}"
# Windows:
start "" "https://github.com/new?name={projectName}"
# Linux:
xdg-open "https://github.com/new?name={projectName}"
```

Then output this waiting prompt EXACTLY — formatted prominently so it cannot be missed:

---
## ⚠️ Action Required — GitHub Repo Setup

The repo creation page is now open in your browser.

**Do this now:**
1. Repo name: **`{projectName}`** (already pre-filled)
2. Leave all other settings as default
3. Click **"Create repository"**
4. Come back here and **type `done`** to continue

---

Wait for the user to type `done` before proceeding.

Validate on return:
```bash
git ls-remote https://github.com/{username}/{projectName}
```
→ 200 success, no branches: set origin, push ✓
→ 200 success, has branches:
  Run full evaluation before surfacing anything to user:

  ```bash
  # 1. Check for orphaned agent branches (unmerged work)
  git ls-remote --heads origin 'refs/heads/agent/*'

  # 2. Check last commit message on remote main
  git log origin/main -1 --format="%s"

  # 3. Check last commit timestamp
  git log origin/main -1 --format="%ct"
  ```

  Decision logic:

  Orphaned agent/* branches exist:
  → Surface to user — unfinished work may be recoverable:
    "⚠ Unfinished work detected from a previous session.
     Orphaned branches: {list}
     1. Recover  — restore previous worktree and continue
     2. Clear    — delete all remote history, start fresh"
  
  No orphaned branches + last commit > 24 hours ago:
  → Auto-clear silently, proceed
    (old session, clearly abandoned, no decision needed)

  No orphaned branches + last commit < 24 hours ago + last commit is merge/completed:
  → Auto-clear silently, proceed
    (previous session completed cleanly)

  No orphaned branches + last commit < 24 hours ago + last commit is incomplete (build: X started):
  → Surface to user:
    "⚠ A recent incomplete session was detected ({timestamp}).
     1. Clear    — delete remote history, start fresh
     2. Keep     — use a different repo name"

  Auto-clear procedure:
    gh available:
      gh repo delete {username}/{projectName} --yes
      gh repo create {projectName} --public --source=. --remote=origin --push ✓
    gh not available:
      git push origin main --force
      git ls-remote --heads origin → delete each remote branch except main ✓
→ 404 not found: retry prompt
→ 403 auth error: "Verify username or repo visibility" → re-ask
→ timeout: "Check your connection" → retry option

**Step 5 — Cleanup on success:**
```bash
git push -u origin main
rm "$PROJECT_ROOT/.scaffold/.remote-setup-needed"
```
Log completion in TASK.md checklist.
Confirm: "Remote configured — proceeding with task."

**Never begin task implementation until this flag is cleared.
Never delete the flag on failure.**
## Completed Task Protocol

If `TASK.md` status is `COMPLETED` at session start, a previous task finished in this worktree.

**Do not re-run completed work. Treat any new user input as a follow-on task.**

### On session start with COMPLETED TASK.md

1. Read `TASK.md` silently - note what was completed
2. Read `.claude-scope` for output mode (already set - no action needed)
3. Emit session confirmation per Output Mode Contract
4. Output (insights/full modes): `✔ Previous task complete. Ready for follow-on work.`
5. Wait for user input

### On receiving follow-on task

1. Treat it as a new task within the same scope and worktree
2. Execute it fully per your agent mission and scope rules
3. Append a new entry to TASK.md under a `## Follow-on Task` heading with status IN PROGRESS
4. When complete, update status to COMPLETED and run `npm run complete`

**Never begin implementation before confirming scope.
Never touch files outside your assigned scope.**

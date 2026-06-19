# Multi-Agents CLI — Test Taxonomy

## Overview

Two-tier testing model:
- **Tier 1 (≥95% threshold):** Happy path flows. Must complete successfully. Failures = framework bugs, fix immediately.
- **Tier 2 (<95% threshold):** Edge cases. Must fail gracefully. Test asserts recovery path, not success.

---

## Tier 1 — Happy Path Scenarios

These flows must complete successfully 95%+ of the time.

### 1.1 Init Flow
- Fresh project init with separate backend
- Fresh project init with integrated backend
- Fresh project init with no backend
- Re-init blocked by lock file
- Global CLI init (multi-agents init <project-name>)

### 1.2 Agent Launch Flow
- Launch first agent (UI/client) on fresh project
- Launch second agent (LOGIC/client) after UI completed
- Launch backend INIT agent on separate backend project
- Agent already active — continue/complete/abandon/pick again
- Worktree created with correct scope files (TASK.md, .claude-scope, scope.json, package.json proxy)
- Worktree .gitignore blocks framework files from agent commits
- Proxy package.json scripts resolve correctly (quoted absolute paths)

### 1.3 Complete Flow
- Merge client/UI branch — only client/** lands in main
- Merge backend/INIT branch — only backend/** + CONTRACTS.md lands in main
- Scope violation detected — merge blocked
- BUILD_STATE.md updated correctly after merge
- Tracking slot written as COMPLETED after merge
- Framework files (TASK.md, .claude-scope, package.json) never reach main

### 1.4 Restart Flow
- Shows ACTIVE agents correctly
- Shows COMPLETED agents correctly
- Shows not-started agents correctly
- Wipe and relaunch selected agent
- Cascade warning shown for dependent agents

### 1.5 Tracking State Flow
- Fresh project: all slots null
- After UI launch: UI = ACTIVE
- After UI complete: UI = COMPLETED
- After LOGIC launch: LOGIC = ACTIVE, UI = COMPLETED
- After LOGIC complete: LOGIC = COMPLETED, UI = COMPLETED

### 1.6 Workflow Auto-Update
- run.js detects version mismatch and re-copies core/workflow/
- run.js stamps .version after update
- No update when versions match

---

## Tier 2 — Edge Case Scenarios

These flows may fail. Test asserts graceful failure with recovery path.

### Group A — CLI / Script Errors
| Scenario | Expected Graceful Failure |
|----------|--------------------------|
| Backtick/special chars in project name | Sanitized or rejected with clear message |
| Empty project name | Re-prompt, not crash |
| Script interpolation with spaces in path | Quoted path, no MODULE_NOT_FOUND |
| Ctrl+C at any prompt | Clean exit, no partial state |
| node --version below 18 | Engine warning surfaced |
| prompts package missing | Fallback to readline, not crash |
| git not installed | Clear error, not stack trace |

### Group B — Agentic Flow Errors
| Scenario | Expected Graceful Failure |
|----------|--------------------------|
| Agent commits outside scope | complete.js blocks merge, lists violations |
| Two agents touch same shared file | Reconcile flags conflict, human review |
| CONTRACTS.md written by two agents simultaneously | Last-write noted, not silently lost |
| Agent session Ctrl+C mid-task | Worktree preserved, tracking stays ACTIVE |
| --dangerously-skip-permissions not available | Falls back to normal claude launch |
| Agent context questions skipped incorrectly | Graceful re-prompt |

### Group C — Project / OS Errors
| Scenario | Expected Graceful Failure |
|----------|--------------------------|
| Path contains spaces | Quoted correctly everywhere |
| Path contains special characters | Escaped or sanitized |
| IDE not found at launch | Warning shown, manual path printed |
| Terminal app not detected | Falls back to manual instructions |
| npm install fails during init | Warning shown, manual install instructions |
| Git remote not set | Push skipped with clear message |
| No internet during version fetch | Fallback versions used silently |

### Group D — Git Layer Errors
| Scenario | Expected Graceful Failure |
|----------|--------------------------|
| Merge conflict beyond BUILD_STATE.md | Conflict listed, manual resolution instructed |
| Worktree reference corrupted | Detected, user prompted to reset |
| Remote push rejected | Warning shown, local merge preserved |
| Branch name collision (timestamp) | Retry with new timestamp |
| Detached HEAD state | Detected, abort with clear message |

### Group E — State Corruption / Integrity Errors
| Scenario | Expected Graceful Failure |
|----------|--------------------------|
| .tracking.json out of sync with git worktrees | Reconciled on next agent launch |
| .config.json missing mid-session | Detected, re-init prompted |
| Partial init (crashed mid-setup) | Lock file absent, re-init allowed |
| .initialized lock exists but files missing | Detected, recovery options shown |
| complete.js and agent committing simultaneously | Git handles atomically, no corruption |

### Group F — Concurrency Errors
| Scenario | Expected Graceful Failure |
|----------|--------------------------|
| Two npm run complete simultaneously | Second detects merge in progress, waits |
| restart.js wiping while agent writing | Worktree lock checked before wipe |
| Two agents writing CONTRACTS.md simultaneously | Append-only, no data lost |

---

## Fixture Structure

```
test/
  runner.js
  scenarios/
    01-init.js
    02-agent.js
    03-complete.js
    04-restart.js
    05-tracking.js
    06-auto-update.js
  fixtures/
    configs/
      separate-backend.json
      integrated-backend.json
      no-backend.json
    tracking/
      all-null.json
      ui-active.json
      ui-completed-logic-active.json
      all-completed.json
      mixed-states.json
    scope-policies/
      default.json
      with-agent-overrides.json
  sandbox/
    (created and wiped per test run in /tmp/ma-test-{timestamp}/)
```

## Fixture Metadata Schema

```json
{
  "description": "UI completed, LOGIC active",
  "tier": 1,
  "appliesTo": ["restart", "agent", "complete"],
  "expectedOutcome": "success",
  "config": {},
  "tracking": {}
}
```

```json
{
  "description": "Agent commits outside scope",
  "tier": 2,
  "group": "B",
  "appliesTo": ["complete"],
  "expectedOutcome": "graceful-failure",
  "expectedMessage": "Scope violation — merge blocked"
}
```

---

## Runner Behavior

- Tier 1 failures → exit code 1, immediate report, block publish
- Tier 2 failures → logged, continue, summary report at end
- All test output written to `test/results/last-run.json`
- Sandbox always wiped after run, even on failure

#!/usr/bin/env node

/**
 * Multi-Agent Monorepo Template - Tasks History
 * Utility for reading and writing to TASKS_HISTORY.md
 *
 * Used by: agent.js (on launch), complete.js (on completion)
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const HISTORY_FILE = 'TASKS_HISTORY.md';

// ── Write session entry on agent launch ───────────────────────────────────────

const writeSessionEntry = (ROOT, { scope, agent, branch, task, launchedAt }) => {
  const historyPath = path.join(ROOT, HISTORY_FILE);

  const entry = `
---

## ${new Date(launchedAt).toISOString().slice(0, 10)} | ${agent} | ${scope} | ${branch}
Launched : ${launchedAt}
Status   : IN PROGRESS
Task     : ${task}

### User Overrides
<!-- agent.js appends [USER OVERRIDE] entries here during session -->

`;

  try {
    fs.appendFileSync(historyPath, entry, 'utf8');
  } catch { /* best-effort */ }
};

// ── Update session status on completion ───────────────────────────────────────

const updateSessionStatus = (ROOT, { branch, status, completedAt, notes }) => {
  const historyPath = path.join(ROOT, HISTORY_FILE);
  if (!fs.existsSync(historyPath)) return;

  let content = fs.readFileSync(historyPath, 'utf8');

  // Find the session block by branch name and update status
  const sessionRegex = new RegExp(
    `(## [^\\n]+ \\| ${branch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n[\\s\\S]*?Status   : )IN PROGRESS`
  );

  if (sessionRegex.test(content)) {
    content = content.replace(
      sessionRegex,
      `$1${status}`
    );

    // Append completion info after status line
    content = content.replace(
      `Status   : ${status}\nTask`,
      `Status   : ${status}\nCompleted: ${completedAt}${notes ? `\nNotes    : ${notes}` : ''}\nTask`
    );

    try {
      fs.writeFileSync(historyPath, content, 'utf8');
    } catch { /* best-effort */ }
  }
};

// ── Append user override entry ────────────────────────────────────────────────

const appendUserOverride = (ROOT, { branch, timestamp, input, deviation, action }) => {
  const historyPath = path.join(ROOT, HISTORY_FILE);
  if (!fs.existsSync(historyPath)) return;

  let content = fs.readFileSync(historyPath, 'utf8');

  const overrideEntry = `- [USER OVERRIDE] ${timestamp}
  Input    : ${input}
  Deviation: ${deviation}
  Action   : ${action}
`;

  // Insert override under the correct session's User Overrides section
  const placeholder = `### User Overrides\n<!-- agent.js appends [USER OVERRIDE] entries here during session -->`;
  const sessionBlock = `## [^\\n]+ \\| ${branch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`;
  const sessionRegex = new RegExp(`(${sessionBlock}[\\s\\S]*?${placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`);

  if (sessionRegex.test(content)) {
    content = content.replace(
      sessionRegex,
      `$1\n${overrideEntry}`
    );
    try {
      fs.writeFileSync(historyPath, content, 'utf8');
    } catch { /* best-effort */ }
  }
};

// ── Initialize TASKS_HISTORY.md if missing ────────────────────────────────────

const ensureHistoryFile = (ROOT) => {
  const historyPath = path.join(ROOT, HISTORY_FILE);
  if (!fs.existsSync(historyPath)) {
    fs.writeFileSync(historyPath, `# TASKS_HISTORY.md
# Audit trail of all agent sessions and user overrides.
# Written by agent.js (on launch) and complete.js (on completion).
# Read by all agents at session start for full project history.
# Never edit manually.
`, 'utf8');
  }
};

module.exports = {
  writeSessionEntry,
  updateSessionStatus,
  appendUserOverride,
  ensureHistoryFile,
};

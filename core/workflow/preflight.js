#!/usr/bin/env node

/**
 * preflight.js — git strategy assessment before every agent re-entry.
 * Pure/read-only: no worktree side effects, no writes.
 * Callable standalone: node core/workflow/preflight.js <ROOT> <scope> <agent> <branchName> <intent>
 */

'use strict';

const fs          = require('fs');
const path        = require('path');
const { execSync } = require('child_process');
const { resolveScope, findInScope } = require('./scope-utils');

// ── Git helpers ───────────────────────────────────────────────────────────────

const git = (cmd, cwd) => {
  try {
    return execSync(cmd, { cwd, encoding: 'utf8', stdio: 'pipe' }).trim();
  } catch {
    return '';
  }
};

// ── Core assessment ───────────────────────────────────────────────────────────

/**
 * @param {object} opts
 * @param {string} opts.ROOT        - absolute path to project root
 * @param {string} opts.scope       - 'client' | 'backend' | 'shared'
 * @param {string} opts.agent       - e.g. 'UI', 'INIT', 'LOGIC'
 * @param {string} opts.branchName  - e.g. 'agent/client/ui/1234567890'
 * @param {string} opts.intent      - 'continuation' | 'correction'
 *
 * @returns {{
 *   decision: 'proceed'|'proceed_with_notice'|'escalate'|'block',
 *   commitsBehind: number,
 *   affectedFiles: string[],
 *   inScopeFiles: string[],
 *   conflictPrediction: boolean,
 *   notice: string|null,
 *   escalationReason: string|null
 * }}
 */
const assess = ({ ROOT, scope, agent, branchName, intent }) => {
  // ── Query 1: divergence ───────────────────────────────────────────────────
  const behindRaw    = git(`git rev-list ${branchName}..main --count`, ROOT);
  const commitsBehind = parseInt(behindRaw, 10) || 0;

  if (commitsBehind === 0) {
    return {
      decision: 'proceed',
      commitsBehind: 0,
      affectedFiles: [],
      inScopeFiles: [],
      conflictPrediction: false,
      notice: null,
      escalationReason: null,
    };
  }

  // ── Query 2: what merged into main since branch point ────────────────────
  const mergedLog = git(`git log ${branchName}..main --oneline --no-merges`, ROOT)
    .split('\n').filter(Boolean);

  // ── Query 3: files changed on main since branch point ───────────────────
  const affectedFiles = git(`git diff ${branchName}...main --name-only`, ROOT)
    .split('\n').filter(Boolean);

  // ── Scope intersection ───────────────────────────────────────────────────
  const scopePolicyPath = path.join(ROOT, '.scaffold', 'scope-policy.json');
  const configPath      = path.join(ROOT, '.scaffold', '.config.json');

  if (!fs.existsSync(scopePolicyPath)) {
    return {
      decision: 'escalate',
      commitsBehind,
      affectedFiles,
      inScopeFiles: [],
      conflictPrediction: false,
      notice: null,
      escalationReason: 'scope-policy.json not found — cannot assess overlap',
    };
  }

  const scopePolicy = JSON.parse(fs.readFileSync(scopePolicyPath, 'utf8'));
  const config      = fs.existsSync(configPath)
    ? JSON.parse(fs.readFileSync(configPath, 'utf8'))
    : {};
  const scaffolded  = config.scaffolded || {};

  const { allowed, blocked } = resolveScope(scopePolicy, scope, agent, scaffolded);
  const inScopeFiles         = findInScope(affectedFiles, allowed, blocked);

  // ── No scope overlap — silent rebase path ───────────────────────────────
  if (inScopeFiles.length === 0) {
    return {
      decision: 'proceed',
      commitsBehind,
      affectedFiles,
      inScopeFiles: [],
      conflictPrediction: false,
      notice: null,
      escalationReason: null,
    };
  }

  // ── Query 4: conflict prediction (only when overlap exists) ─────────────
  const mergeBase      = git(`git merge-base main ${branchName}`, ROOT);
  const mergeTreeOut   = mergeBase
    ? git(`git merge-tree ${mergeBase} main ${branchName}`, ROOT)
    : '';
  const conflictPrediction = mergeTreeOut.includes('<<<<<<<');

  if (conflictPrediction) {
    return {
      decision: 'block',
      commitsBehind,
      affectedFiles,
      inScopeFiles,
      conflictPrediction: true,
      notice: null,
      escalationReason: null,
    };
  }

  // ── Scope overlap, no conflicts ──────────────────────────────────────────
  if (intent === 'correction') {
    return {
      decision: 'escalate',
      commitsBehind,
      affectedFiles,
      inScopeFiles,
      conflictPrediction: false,
      notice: null,
      escalationReason: `Main moved forward ${commitsBehind} commit${commitsBehind === 1 ? '' : 's'} — ${inScopeFiles.length} file${inScopeFiles.length === 1 ? '' : 's'} in your scope were updated. Intent is correction — manual review recommended before rebase.`,
    };
  }

  // continuation intent
  const notice = [
    `## Sync Notice [auto-patched ${new Date().toISOString()}]`,
    `Main moved forward ${commitsBehind} commit${commitsBehind === 1 ? '' : 's'} since this session last ran.`,
    `The following file${inScopeFiles.length === 1 ? '' : 's'} in your scope were updated:`,
    ...inScopeFiles.map(f => `- ${f}`),
    `Your worktree has been rebased onto main. Review changes before proceeding.`,
  ].join('\n');

  return {
    decision: 'proceed_with_notice',
    commitsBehind,
    affectedFiles,
    inScopeFiles,
    conflictPrediction: false,
    notice,
    escalationReason: null,
  };
};

module.exports = { assess };

// ── Standalone CLI entry point ────────────────────────────────────────────────
if (require.main === module) {
  const [ROOT, scope, agent, branchName, intent] = process.argv.slice(2);
  if (!ROOT || !scope || !agent || !branchName || !intent) {
    console.error('Usage: node preflight.js <ROOT> <scope> <agent> <branchName> <intent>');
    console.error('  intent: continuation | correction');
    process.exit(1);
  }
  const result = assess({ ROOT, scope, agent, branchName, intent });
  console.log(JSON.stringify(result, null, 2));
}

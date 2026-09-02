#!/usr/bin/env node
'use strict';

/**
 * sync.js  State reconciler.
 *
 * Ground truth is git. Reconciles .scaffold/.tracking.json and BUILD_STATE.md
 * against actual worktrees, branches and merge status. Runs automatically from
 * run.js before every agent launch, and standalone via npm run sync.
 *
 * Design note: status field is read agnostically. Any non null status that is
 * not COMPLETED or PENDING counts as an in flight (active) slot, so the checks
 * fire whether agent.js writes ACTIVE or IN PROGRESS.
 */

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT     = (() => {
  try {
    const common = execSync('git rev-parse --git-common-dir', { stdio: 'pipe' }).toString().trim();
    return common.endsWith('/.git') ? common.slice(0, -5) : require('path').resolve(common, '..');
  } catch {
    console.error('  Not inside a git repository.\n');
    process.exit(1);
  }
})();
const TRACKING = path.join(ROOT, '.scaffold', '.tracking.json');
const BUILD    = path.join(ROOT, 'BUILD_STATE.md');

// ANSI
const c = { reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m', green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m' };
const dim    = (s) => `${c.dim}${s}${c.reset}`;
const green  = (s) => `${c.green}${s}${c.reset}`;
const yellow = (s) => `${c.yellow}${s}${c.reset}`;
const red    = (s) => `${c.red}${s}${c.reset}`;
const bold   = (s) => `${c.bold}${s}${c.reset}`;

const gitRead = (cmd) => {
  try { return execSync(`git ${cmd}`, { cwd: ROOT, stdio: 'pipe', encoding: 'utf8' }).trim(); }
  catch { return null; }
};

const getWorktrees = () => {
  const out = gitRead('worktree list --porcelain');
  if (!out) return [];
  const wts = [];
  for (const block of out.split('\n\n')) {
    const lines = block.split('\n');
    const p = lines.find(l => l.startsWith('worktree '));
    const b = lines.find(l => l.startsWith('branch '));
    if (p && b) {
      wts.push({
        path:   p.replace('worktree ', '').trim(),
        branch: b.replace('branch refs/heads/', '').trim(),
      });
    }
  }
  return wts;
};

const getLocalBranches = () => {
  const out = gitRead('branch --format=\"%(refname:short)\"');
  return out ? out.split('\n').map(s => s.trim()).filter(Boolean) : [];
};

const getMergedBranches = () => {
  const out = gitRead('branch --merged main --format=\"%(refname:short)\"');
  return out ? out.split('\n').map(s => s.trim()).filter(Boolean) : [];
};

const worktreeHealthy = (wtPath) => {
  if (!wtPath || !fs.existsSync(wtPath)) return false;
  return fs.existsSync(path.join(wtPath, '.git'));
};

const loadTracking = () => {
  try { return JSON.parse(fs.readFileSync(TRACKING, 'utf8')); } catch { return null; }
};
const saveTracking = (t) => fs.writeFileSync(TRACKING, JSON.stringify(t, null, 2) + '\n', 'utf8');
const emptySlot = () => ({ branch: null, timestamp: null, launchedAt: null, status: null, missingCount: 0, worktreePath: null });

const eachSlot = (t, fn) => {
  for (const scope of Object.keys(t)) {
    for (const agent of Object.keys(t[scope])) {
      fn(scope, agent, t[scope][agent]);
    }
  }
};

const TERMINAL = new Set(['COMPLETED']);
const PARKED   = new Set(['PENDING']);
const isActive = (slot) => slot.status != null && !TERMINAL.has(slot.status) && !PARKED.has(slot.status);

const SECTION = { client: '## Client State', backend: '## Backend State', shared: '## Shared' };

const flipCheckbox = (content, scope, agent) => {
  const header = SECTION[scope];
  if (!header) return content;
  const start = content.indexOf(header);
  if (start === -1) return content;
  const rest  = content.slice(start + header.length);
  const nextH = rest.indexOf('\n## ');
  const blockEnd = nextH === -1 ? content.length : start + header.length + nextH;
  const before = content.slice(0, start);
  const block  = content.slice(start, blockEnd);
  const after  = content.slice(blockEnd);
  const patched = block.replace(`- [ ] ${agent} `, `- [x] ${agent} `);
  return before + patched + after;
};

const ensureCompletedRow = (content, scope, agent, branch) => {
  let patched = false, appended = false;
  const esc = branch.replace(/\//g, '\\/');

  const inProg = new RegExp(`(\\| [^|]+ \\| [^|]+ \\| [^|]+ \\| [^|]+ \\|) IN PROGRESS (\\| ${esc} \\|)`);
  if (inProg.test(content)) {
    content = content.replace(inProg, `$1 COMPLETED $2`);
    patched = true;
  } else if (!content.includes(branch)) {
    const date = new Date().toISOString().split('T')[0];
    const row  = `| ${date} | ${agent} | ${scope} | reconciled by sync | COMPLETED | ${branch} |`;
    const lines = content.split('\n');
    let lastRow = -1;
    for (let i = 0; i < lines.length; i++) if (/^\|/.test(lines[i])) lastRow = i;
    if (lastRow !== -1) { lines.splice(lastRow + 1, 0, row); content = lines.join('\n'); appended = true; }
  }
  content = flipCheckbox(content, scope, agent);
  return { content, patched, appended };
};

const findTaskMd = (wtPath, scope) => {
  const candidates = [
    path.join(wtPath, 'TASK.md'),
    path.join(wtPath, scope, 'TASK.md'),
    path.join(wtPath, 'client', 'TASK.md'),
    path.join(wtPath, 'backend', 'TASK.md'),
  ];
  return candidates.find(p => fs.existsSync(p)) || null;
};

const writeSyncNotice = (taskPath, actions, stamp) => {
  const block = [
    ``,
    `<!-- SYNC NOTICE ${stamp} -->`,
    `## Sync notice`,
    `sync.js reconciled shared state at this session start:`,
    ...actions.map(a => `- ${a}`),
    `Main BUILD_STATE.md and .tracking.json now reflect the above.`,
    `Re read \`git show main:BUILD_STATE.md\` before continuing.`,
    `<!-- END SYNC NOTICE -->`,
    ``,
  ].join('\n');
  fs.appendFileSync(taskPath, block, 'utf8');
};

const arrowSelect = async (message, choices) => {
  try {
    const prompts = require('prompts');
    const res = await prompts({
      type: 'select', name: 'v', message,
      choices: choices.map((c2, i) => ({ title: c2, value: i })),
    });
    return typeof res.v === 'number' ? res.v : 0;
  } catch {
    console.log(`\n  ${message}`);
    choices.forEach((c2, i) => console.log(`  ${dim(`${i + 1}.`)} ${c2}`));
    return 0;
  }
};

async function sync(opts = {}) {
  const mode = opts.mode || 'standalone';
  const tracking = loadTracking();
  if (!tracking) { if (mode === 'standalone') console.log(dim('  sync: no .tracking.json, nothing to reconcile')); return; }

  const localBranches  = getLocalBranches();
  const mergedBranches = getMergedBranches();
  const worktrees      = getWorktrees();

  const actions   = [];
  const decisions = [];
  const orphans   = [];
  let changed = false;
  let buildChanged = false;
  const inFlightPatched = new Set();

  // Check 1  branch existence
  eachSlot(tracking, (scope, agent, slot) => {
    if (!slot.branch) return;
    if (!localBranches.includes(slot.branch) && isActive(slot)) {
      slot.status = 'MISSING'; changed = true;
      actions.push(`${scope}/${agent}: branch ${slot.branch} gone, marked MISSING`);
    }
  });

  // Check 2  worktree health
  eachSlot(tracking, (scope, agent, slot) => {
    if (!isActive(slot) && slot.status !== 'MISSING') return;
    const branchLive = localBranches.includes(slot.branch);
    const wt = worktrees.find(w => w.branch === slot.branch);
    const pathLive = wt ? worktreeHealthy(wt.path) : worktreeHealthy(slot.worktreePath);

    if (!pathLive && branchLive && slot.status !== 'MISSING') {
      slot.status = 'MISSING'; changed = true;
      actions.push(`${scope}/${agent}: worktree missing, branch alive, marked MISSING`);
    } else if (!pathLive && !branchLive) {
      Object.assign(slot, emptySlot()); changed = true;
      actions.push(`${scope}/${agent}: worktree and branch both gone, tracking cleaned (ABANDONED)`);
    }
  });

  // Check 3  merge reflection
  const buildTargets = [];
  eachSlot(tracking, (scope, agent, slot) => {
    if (!slot.branch) return;
    if (!isActive(slot) && slot.status !== 'MISSING') return;
    if (mergedBranches.includes(slot.branch)) {
      const wt = worktrees.find(w => w.branch === slot.branch);
      // Guard: a zero-commit agent branch is topologically "merged" (its HEAD
      // still equals main), so Git cannot distinguish merged from never-diverged.
      // Require session evidence: if the worktree is alive and its TASK.md is
      // not marked [x] COMPLETED, this is a live session - leave it ACTIVE.
      const liveWtPath = wt && worktreeHealthy(wt.path) ? wt.path : null;
      if (liveWtPath) {
        const taskPath = findTaskMd(liveWtPath, scope);
        let sessionDone = false;
        try { sessionDone = taskPath ? fs.readFileSync(taskPath, 'utf8').includes('[x] COMPLETED') : false; } catch {}
        if (!sessionDone) return; // live session - topology alone is not completion evidence
      }
      if (liveWtPath) orphans.push(`${scope}/${agent} -> ${liveWtPath}`);
      slot.status = 'COMPLETED';
      if (!slot.completedAt) slot.completedAt = new Date().toISOString();
      slot.worktreePath = null;
      changed = true;
      actions.push(`${scope}/${agent}: branch merged into main, marked COMPLETED`);
      buildTargets.push({ scope, agent, branch: slot.branch });
      inFlightPatched.add(scope);
    }
  });

  // Check 3b  staleness / stuck-push detection
  const STALE_THRESHOLD_MS = 4 * 60 * 60 * 1000; // 4 hours - single constant, tune here
  eachSlot(tracking, (scope, agent, slot) => {
    if (!slot.branch) return;
    if (!isActive(slot) && slot.status !== 'MISSING') return;
    if (mergedBranches.includes(slot.branch)) return; // already handled by check 3

    // Primary signal: TASK.md says [x] COMPLETED but branch not merged -> stalled push
    const wt = worktrees.find(w => w.branch === slot.branch);
    const wtPath = wt ? wt.path : slot.worktreePath;
    if (wtPath && worktreeHealthy(wtPath)) {
      const taskPath = findTaskMd(wtPath, scope);
      if (taskPath) {
        try {
          const taskContent = fs.readFileSync(taskPath, 'utf8');
          if (taskContent.includes('[x] COMPLETED')) {
            decisions.push(
              `${scope}/${agent}: TASK.md marked COMPLETED but branch not merged - push/merge likely failed. \n` +
              `    Run: git push origin ${slot.branch} && npm run complete`
            );
            return;
          }
        } catch {}
      }
    }

    // Secondary signal: no commits in > STALE_THRESHOLD_MS since launch (softer advisory)
    if (slot.launchedAt) {
      try {
        const lastCommitTs = parseInt(
          execSync(`git log -1 --format=%ct ${slot.branch}`, { cwd: ROOT, stdio: 'pipe', encoding: 'utf8' }).trim(),
          10
        ) * 1000;
        const launchedAt = new Date(slot.launchedAt).getTime();
        const elapsed = Date.now() - Math.max(lastCommitTs, launchedAt);
        if (elapsed > STALE_THRESHOLD_MS) {
          const hours = Math.round(elapsed / 1000 / 60 / 60);
          decisions.push(
            `${scope}/${agent}: no new commits in ~${hours}h - may be stalled or still running, check manually`
          );
        }
      } catch {}
    }
  });

  // Check 4  BUILD_STATE vs tracking drift
  eachSlot(tracking, (scope, agent, slot) => {
    if (slot.status !== 'COMPLETED' || !slot.branch) return;
    if (!buildTargets.find(b => b.branch === slot.branch)) buildTargets.push({ scope, agent, branch: slot.branch });
  });

  if (buildTargets.length && fs.existsSync(BUILD)) {
    let content = fs.readFileSync(BUILD, 'utf8');
    for (const t of buildTargets) {
      const r = ensureCompletedRow(content, t.scope, t.agent, t.branch);
      if (r.content !== content) {
        content = r.content; buildChanged = true;
        if (r.appended) actions.push(`BUILD_STATE: appended COMPLETED row for ${t.scope}/${t.agent}`);
        else if (r.patched) actions.push(`BUILD_STATE: ${t.scope}/${t.agent} IN PROGRESS -> COMPLETED`);
      }
    }
    if (buildChanged) fs.writeFileSync(BUILD, content, 'utf8');
  }

  if (changed) saveTracking(tracking);

  // Check 5  absent scaffold (advisory)
  for (const scope of Object.keys(tracking)) {
    if (scope === 'shared') continue;
    const scopeDir = path.join(ROOT, scope);
    if (!fs.existsSync(scopeDir)) continue;
    const slots = Object.values(tracking[scope]);
    const anyCompleted = slots.some(s => s.status === 'COMPLETED');
    const anyActive    = slots.some(s => isActive(s));
    if (!anyCompleted && !anyActive) {
      decisions.push(`${scope}: scope folder exists but no agent started  run npm run agent to begin`);
    }
  }

  // Agent awareness  TASK.md notices
  if (actions.length && inFlightPatched.size) {
    const stamp = new Date().toISOString();
    eachSlot(tracking, (scope, agent, slot) => {
      if (!isActive(slot) || !inFlightPatched.has(scope)) return;
      const wt = worktrees.find(w => w.branch === slot.branch);
      if (!wt || !worktreeHealthy(wt.path)) return;
      const taskPath = findTaskMd(wt.path, scope);
      if (!taskPath) { decisions.push(`${scope}/${agent}: live worktree but no TASK.md found for sync notice`); return; }
      try { writeSyncNotice(taskPath, actions, stamp); actions.push(`TASK.md notice written for in flight ${scope}/${agent}`); }
      catch (e) { decisions.push(`${scope}/${agent}: TASK.md notice write failed  ${e.message}`); }
    });
  }

  // Check 6  dirty state files -> auto commit
  const dirty = gitRead('status --porcelain') || '';
  const dirtyState = dirty.split('\n')
    .map(l => l.slice(3).trim())
    .filter(f => f === 'BUILD_STATE.md' || f.endsWith('.tracking.json'));
  if (dirtyState.length) {
    try {
      execSync('git add BUILD_STATE.md .scaffold/.tracking.json', { cwd: ROOT, stdio: 'pipe' });
      execSync('git commit --no-gpg-sign --no-verify -m "sync: reconcile state files"', { cwd: ROOT, stdio: 'pipe' });
      actions.push(`committed reconciled state files (${dirtyState.join(', ')})`);
    } catch (e) {
      decisions.push(`state files dirty but auto commit failed  ${e.message}`);
    }
  }

  // Check 7 - .workflow/ staleness vs installed package (report-only, no auto-apply)
  try {
    const configPath = path.join(ROOT, '.scaffold', '.config.json');
    if (fs.existsSync(configPath)) {
      const scaffoldCfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const manifest = scaffoldCfg.workflowManifest;
      const resolveInstalledPkgRoot = () => {
        const localPkg = path.join(ROOT, 'node_modules', 'multi-agents-cli');
        if (fs.existsSync(path.join(localPkg, 'package.json'))) return localPkg;
        try {
          const globalRoot = execSync('npm root -g', { stdio: 'pipe', encoding: 'utf8' }).trim();
          const globalPkg = path.join(globalRoot, 'multi-agents-cli');
          if (fs.existsSync(path.join(globalPkg, 'package.json'))) return globalPkg;
        } catch {}
        return null;
      };
      const pkgRoot = resolveInstalledPkgRoot();
      if (manifest && manifest.packageVersion && pkgRoot) {
        const installedPkg = JSON.parse(fs.readFileSync(path.join(pkgRoot, 'package.json'), 'utf8'));
        if (installedPkg.version !== manifest.packageVersion) {
          const installedWorkflowDir = path.join(pkgRoot, 'core', 'workflow');
          const localWorkflowDir = path.join(ROOT, '.workflow');
          const sha256 = (buf) => require('crypto').createHash('sha256').update(buf).digest('hex');
          const updatable = [];
          const diverged = [];
          for (const [file, meta] of Object.entries(manifest.files || {})) {
            const localPath = path.join(localWorkflowDir, file);
            const installedPath = path.join(installedWorkflowDir, file);
            if (!fs.existsSync(localPath) || !fs.existsSync(installedPath)) continue;
            const baselineHash = (meta.hash || '').replace('sha256:', '');
            const localHash = sha256(fs.readFileSync(localPath));
            const localDiverged = localHash !== baselineHash;
            const installedChanged = sha256(fs.readFileSync(installedPath)) !== baselineHash;
            if (localDiverged) diverged.push(file);
            else if (installedChanged) updatable.push(file);
          }
          if (updatable.length || diverged.length) {
            let msg = `.workflow/ behind installed multi-agents-cli@${installedPkg.version} (scaffolded on ${manifest.packageVersion}).`;
            if (updatable.length) msg += ` ${updatable.length} file(s) safe to update: ${updatable.join(', ')}.`;
            if (diverged.length) msg += ` ${diverged.length} file(s) hand-edited, needs manual reconciliation: ${diverged.join(', ')}.`;
            decisions.push(msg);
          }
        }
      }
    }
  } catch (e) {
    decisions.push(`workflow staleness check failed - ${e.message}`);
  }

  const clean = !actions.length && !decisions.length && !orphans.length;
  if (clean) { if (mode === 'standalone') console.log(green('  \u2713 state in sync')); return; }

  console.log(`\n${bold('  Sync report')}`);
  if (actions.length) {
    console.log(green('  auto patched:'));
    actions.forEach(a => console.log(dim('    \u00b7 ') + a));
  }
  if (orphans.length) {
    console.log(yellow('  orphaned worktrees (merged, safe to remove):'));
    orphans.forEach(o => console.log(dim('    \u00b7 ') + o + dim('   git worktree remove --force <path>')));
  }
  if (decisions.length) {
    console.log(yellow('  needs your attention:'));
    decisions.forEach(d => console.log(dim('    \u00b7 ') + d));
    if (mode === 'standalone') {
      await arrowSelect('How to proceed?', ['Acknowledge and continue', 'Abort']);
    }
  }
  console.log('');
}

module.exports = { sync };

if (require.main === module) {
  sync({ mode: 'standalone' }).catch(err => { console.error(red('  sync error: ') + err.message); process.exit(1); });
}

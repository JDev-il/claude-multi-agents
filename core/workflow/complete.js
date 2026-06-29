#!/usr/bin/env node

/**
 * Multi-Agent Monorepo Template - Task Completion
 * Run with: node .workflow/complete.js
 *
 * Merges the current task branch into main,
 * updates BUILD_STATE.md, and pushes to origin.
 * Run from the repo root after a task is complete.
 */

let prompts; try { prompts = require('prompts'); } catch { prompts = null; }
const fs                = require('fs');
const path              = require('path');
const { execSync, spawn } = require('child_process');
const guards            = require('./guards');
const tasksHistory      = require('./tasks_history');

// ── Colors ────────────────────────────────────────────────────────────────────

const c = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  red:    '\x1b[31m',
};

const bold   = (s) => `${c.bold}${s}${c.reset}`;
const green  = (s) => `${c.green}${s}${c.reset}`;
const yellow = (s) => `${c.yellow}${s}${c.reset}`;
const dim    = (s) => `${c.dim}${s}${c.reset}`;
const cyan   = (s) => `${c.cyan}${s}${c.reset}`;
const red    = (s) => `${c.red}${s}${c.reset}`;

// ── Paths ─────────────────────────────────────────────────────────────────────

const ROOT        = path.join(__dirname, '..');
const CONFIG_PATH = path.join(ROOT, '.scaffold', '.config.json');
const LOCK_PATH   = path.join(ROOT, '.scaffold', '.initialized');

// ── Guards ────────────────────────────────────────────────────────────────────

if (!fs.existsSync(LOCK_PATH)) {
  console.log(`\n${red('  Project not initialized.')}`);
  console.log(dim('  Run node .scaffold/init.js first.\n'));
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

// ── Arrow confirm helper ──────────────────────────────────────────────────────

const arrowConfirm = async (message, initial = true) => {
  if (prompts && process.stdin.isTTY) {
    const res = await prompts({
      type:    'select',
      name:    'value',
      message,
      choices: [
        { title: 'Yes', value: true },
        { title: 'No',  value: false },
      ],
      initial: initial ? 0 : 1,
    }, { onCancel: () => process.exit(0) });
    return res.value ?? initial;
  }
  return initial;
};

const arrowSelect = async (message, choices) => {
  if (prompts && process.stdin.isTTY) {
    const res = await prompts({ type: 'select', name: 'value', message, choices: choices.map((c, i) => ({ title: c, value: i })) }, { onCancel: () => process.exit(0) });
    return res.value ?? 0;
  }
  return 0;
};

const separator = () => console.log(`\n${dim('─'.repeat(60))}`);

// ── Helpers ───────────────────────────────────────────────────────────────────

const getCurrentBranch = () => {
  try {
    return execSync('git branch --show-current', { cwd: ROOT, stdio: 'pipe' })
      .toString().trim();
  } catch {
    return null;
  }
};

const getWorktrees = () => {
  try {
    const output = execSync('git worktree list --porcelain', { cwd: ROOT, stdio: 'pipe' })
      .toString().trim();
    const worktrees = [];
    const blocks = output.split('\n\n');
    for (const block of blocks) {
      const lines = block.split('\n');
      const pathLine   = lines.find(l => l.startsWith('worktree '));
      const branchLine = lines.find(l => l.startsWith('branch '));
      if (pathLine && branchLine) {
        const wtPath   = pathLine.replace('worktree ', '').trim();
        const wtBranch = branchLine.replace('branch refs/heads/', '').trim();
        if (wtBranch !== 'main' && wtBranch !== 'master') {
          worktrees.push({ path: wtPath, branch: wtBranch });
        }
      }
    }
    return worktrees;
  } catch {
    return [];
  }
};

const updateBuildState = (branch, status, notes = '') => {
  const buildStatePath = path.join(ROOT, 'BUILD_STATE.md');
  if (!fs.existsSync(buildStatePath)) return;

  let content = fs.readFileSync(buildStatePath, 'utf8');
  const date  = new Date().toISOString().split('T')[0];

  // Update IN PROGRESS → COMPLETED in agent log
  content = content.replace(
    new RegExp(`(\\| [^|]+ \\| [^|]+ \\| [^|]+ \\| [^|]+ \\|) IN PROGRESS (\\| ${branch.replace(/\//g, '\\/')} \\|)`),
    `$1 ${status} $2`
  );

  fs.writeFileSync(buildStatePath, content, 'utf8');

  // Update TASKS_HISTORY.md
  tasksHistory.updateSessionStatus(ROOT, {
    branch,
    status,
    completedAt: new Date().toISOString(),
  });

  try {
    execSync('git add BUILD_STATE.md', { cwd: ROOT, stdio: 'pipe' });
    execSync(`git commit -m "build: task ${status.toLowerCase()} [${branch}]"`, { cwd: ROOT, stdio: 'pipe' });
  } catch {
    // Silent - BUILD_STATE.md update is best-effort
  }
};

// ── Main ──────────────────────────────────────────────────────────────────────

const main = async () => {
  console.log('\n');
  console.log(bold(cyan('  Multi-Agent Monorepo Template')));
  console.log(dim(`  Task Completion - ${config.projectName}\n`));
  separator();

  // ── Detect active worktrees ───────────────────────────────────────────────────

  const worktrees = getWorktrees();

  if (worktrees.length === 0) {
    console.log(`\n${yellow('  No active task worktrees found.')}`);
    console.log(dim('  Run npm run agent to start a task.\n'));
    return;
  }

  // ── Select worktree to complete ───────────────────────────────────────────────

  const isNonTTY = !process.stdin.isTTY;

  console.log(`\n${bold('Active tasks:')}\n`);
  worktrees.forEach((wt, i) => {
    console.log(`  ${dim(`${i + 1}.`)} ${wt.branch}`);
    console.log(`     ${dim(wt.path)}`);
  });

  let selectedWorktree;

  if (isNonTTY || worktrees.length === 1) {
    selectedWorktree = worktrees[0];
    console.log(dim(`\n  Auto-selected: ${selectedWorktree.branch}\n`));
  } else {
    const idx = await arrowSelect('Select task to complete:', worktrees.map(wt => wt.branch));
    selectedWorktree = worktrees[idx];
  }

  const { path: worktreePath, branch: branchName } = selectedWorktree;

  // ── Scope validation (Trust + Verify) ────────────────────────────────────────

  const scopeJsonPath   = path.join(worktreePath, 'scope.json');
  const scopePolicyPath = path.join(ROOT, '.scaffold', 'scope-policy.json');

  if (fs.existsSync(scopeJsonPath) && fs.existsSync(scopePolicyPath)) {
    const scopeMeta   = JSON.parse(fs.readFileSync(scopeJsonPath, 'utf8'));
    const scopePolicy = JSON.parse(fs.readFileSync(scopePolicyPath, 'utf8'));

    const policyScope = scopePolicy[scopeMeta.policy];
    const agentKey    = scopeMeta.agent && scopeMeta.agent.toUpperCase();
    const override        = policyScope && policyScope.agentOverrides && policyScope.agentOverrides[agentKey];
    const scaffoldedFlag  = (config.scaffolded || {})[scopeMeta.scope];
    const overrideActive  = override && (!override.onlyBeforeScaffolded || !scaffoldedFlag);
    const allowed         = (overrideActive && override.allowed) || (policyScope && policyScope.allowed) || [];
    const blocked     = (policyScope && policyScope.blocked) || [];

    const changedFiles = execSync('git diff --name-only main...HEAD', { cwd: worktreePath, stdio: 'pipe' })
      .toString().trim().split('\n').filter(Boolean);

    const matchesGlob = (file, pat) => {
      if (pat.endsWith('/**')) return file.startsWith(pat.slice(0, -3));
      if (pat.includes('*')) {
        const re = pat.replace(/[.+^${}()|[\]\\]/g, '\\$&')
                      .replace(/\*\*/g, 'DOUBLESTAR')
                      .replace(/\*/g, '[^/]*')
                      .replace(/DOUBLESTAR/g, '.*');
        return new RegExp('^' + re + '$').test(file);
      }
      return file === pat;
    };

    const violations = changedFiles.filter(file => {
      const isAllowed = allowed.some(pat => matchesGlob(file, pat));
      const isBlocked = blocked.some(pat => matchesGlob(file, pat));
      return !isAllowed || isBlocked;
    });

    if (violations.length > 0) {
      console.log('\n' + red('  ✗ Scope violation - merge blocked.'));
      console.log(dim('  The following files are outside the allowed scope for ' + scopeMeta.agent + ' (' + scopeMeta.scope + '):\n'));
      violations.forEach(f => console.log('    ' + red('✗') + ' ' + f));
      console.log('\n' + dim('  Fix the violations, then re-run npm run complete.\n'));
      return;
    }

    console.log('  ' + green('✓') + ' Scope validation passed (' + changedFiles.length + ' files checked)');
  } else {
    console.log('  ' + dim('ℹ scope.json or scope-policy.json not found - skipping validation'));
  }

  // ── Check TASK.md status ──────────────────────────────────────────────────────

  const taskMdPath = path.join(worktreePath, 'TASK.md');
  if (fs.existsSync(taskMdPath)) {
    const taskContent = fs.readFileSync(taskMdPath, 'utf8');
    const isCompleted = taskContent.includes('[x] COMPLETED');

    if (!isCompleted && !isNonTTY) {
      console.log(`\n${yellow('  TASK.md is not marked as COMPLETED.')}`);
      console.log(dim('  The agent may still be working on this task.\n'));
      const proceed = await arrowConfirm('Proceed with merge anyway?', false);
      if (!proceed) {
        console.log(yellow('\n  Aborted. Complete the task first.\n'));
        return;
      }
    } else if (!isCompleted && isNonTTY) {
      console.log(dim('  ℹ TASK.md not marked complete - proceeding in non-TTY mode.'));
    }
  }

  separator();

  // ── Confirm ───────────────────────────────────────────────────────────────────

  console.log(`\n${bold('About to merge:')}\n`);
  console.log(`  ${dim('Branch')}   : ${green(branchName)}`);
  console.log(`  ${dim('Into')}     : ${green('main')}`);
  console.log(`  ${dim('Worktree')} : ${dim(worktreePath)}\n`);

  const confirmMerge = isNonTTY ? true : await arrowConfirm('Confirm merge into main?');
  if (!confirmMerge) {
    console.log(yellow('\n  Aborted.\n'));
    return;
  }

  separator();
  console.log(`\n${bold('Completing task...')}\n`);

  // ── Auto-commit uncommitted changes in worktree (scope-aware staging) ─────────

  try {
    const status = execSync('git status --porcelain', { cwd: worktreePath, stdio: 'pipe' }).toString().trim();
    if (status) {
      console.log(`  ${yellow('!')} Uncommitted changes detected - committing before merge...`);

      // Stage only files matching the allowed scope patterns — never root-level framework files
      const scopeJsonPath   = path.join(worktreePath, 'scope.json');
      const scopePolicyPath = path.join(ROOT, '.scaffold', 'scope-policy.json');
      let stagedWithScope = false;

      if (fs.existsSync(scopeJsonPath) && fs.existsSync(scopePolicyPath)) {
        const scopeMeta   = JSON.parse(fs.readFileSync(scopeJsonPath, 'utf8'));
        const scopePolicy = JSON.parse(fs.readFileSync(scopePolicyPath, 'utf8'));
        const policyScope = scopePolicy[scopeMeta.policy];
        const agentKey    = scopeMeta.agent && scopeMeta.agent.toUpperCase();
        const override    = policyScope && policyScope.agentOverrides && policyScope.agentOverrides[agentKey];
        const cfg         = JSON.parse(fs.readFileSync(path.join(ROOT, '.scaffold', '.config.json'), 'utf8'));
        const scaffolded  = (cfg.scaffolded || {})[scopeMeta.scope];
        const overrideActive = override && (!override.onlyBeforeScaffolded || !scaffolded);
        const allowed     = (overrideActive && override.allowed) || (policyScope && policyScope.allowed) || [];

        if (allowed.length > 0) {
          // Stage each allowed pattern individually
          for (const pat of allowed) {
            const target = pat.endsWith('/**') ? pat.slice(0, -3) : pat;
            try {
              execSync(`git add ${target}`, { cwd: worktreePath, stdio: 'pipe' });
            } catch { /* pattern may not exist in this worktree */ }
          }
          stagedWithScope = true;
          console.log(`  ${green('✓')} Staged scope-allowed files only (${allowed.join(', ')})`);
        }
      }

      if (!stagedWithScope) {
        // Fallback — no scope info, stage everything
        execSync('git add .', { cwd: worktreePath, stdio: 'pipe' });
        console.log(`  ${yellow('!')} No scope info found - staged all files`);
      }

      execSync(`git commit -m "feat: task completion commit [${branchName}]"`, { cwd: worktreePath, stdio: 'pipe' });
      console.log(`  ${green('✓')} Changes committed`);
    } else {
      console.log(`  ${green('✓')} Worktree is clean`);
    }
  } catch (err) {
    console.log(`  ${yellow('!')} Could not auto-commit - commit manually if needed`);
  }

  // ── Pull latest main ──────────────────────────────────────────────────────────

  try {
    execSync('git checkout main', { cwd: ROOT, stdio: 'pipe' });
    execSync('git pull origin main', { cwd: ROOT, stdio: 'pipe' });
    console.log(`  ${green('✓')} Pulled latest main`);
  } catch (err) {
    console.log(`  ${yellow('!')} Could not pull latest main.`);
    if (!isNonTTY) {
      const proceedAnyway = await arrowConfirm('Proceed with merge anyway?');
      if (!proceedAnyway) {
        console.log(yellow('\n  Aborted.\n'));
        return;
      }
    } else {
      console.log(dim('  Proceeding in non-TTY mode.'));
    }
  }

  // ── Merge branch into main ────────────────────────────────────────────────────

  try {
    execSync(`git merge ${branchName} --no-ff -m "merge: ${branchName} into main"`, {
      cwd: ROOT,
      stdio: 'pipe',
    });
    console.log(`  ${green('✓')} Merged ${branchName} into main`);
  } catch (mergeErr) {
    // Check if BUILD_STATE.md is the only conflict - auto-resolve
    try {
      const conflicts = execSync('git diff --name-only --diff-filter=U', { cwd: ROOT, encoding: 'utf8' })
        .trim().split('\n').filter(Boolean);

      if (conflicts.length === 1 && conflicts[0] === 'BUILD_STATE.md') {
        execSync('git checkout --ours BUILD_STATE.md', { cwd: ROOT, stdio: 'pipe' });
        execSync('git add BUILD_STATE.md', { cwd: ROOT, stdio: 'pipe' });
        execSync(`git commit -m "merge: ${branchName} into main"`, { cwd: ROOT, stdio: 'pipe' });
        console.log(`  ${green('✓')} Merged ${branchName} into main`);
        console.log(dim('  ℹ BUILD_STATE.md conflict auto-resolved'));
      } else {
        console.log(`\n${red('  ✗ Merge conflict in:')} ${conflicts.join(', ')}`);
        console.log(dim('  Resolve conflicts manually, then run: git commit\n'));
        return;
      }
    } catch {
      console.log(`\n${red('  ✗ Merge failed.')} Resolve manually.\n`);
      return;
    }
  }

  // ── Update BUILD_STATE.md ─────────────────────────────────────────────────────

  updateBuildState(branchName, 'COMPLETED');
  console.log(`  ${green('✓')} BUILD_STATE.md updated`);

  // ── Clear tracking slot ───────────────────────────────────────────────────────

  try {
    const tracking = guards.loadTracking(ROOT, config);
    // Derive scope and agent from branch name: agent/{scope}/{agent}/{timestamp}
    const parts = branchName.split('/');
    if (parts.length >= 4) {
      const scope = parts[1];
      const agent = parts[2].toUpperCase();
      guards.clearTrackingSlot(tracking, scope, agent, ROOT);
      console.log(`  ${green('✓')} Tracking slot cleared`);
    }
  } catch { /* best-effort */ }

  // ── Write start:client / start:backend into root package.json ───────────────

  try {
    const CLIENT_START = {
      'Next.js':    'cd client && npm install && npm run dev',
      'Nuxt':       'cd client && npm install && npm run dev',
      'SvelteKit':  'cd client && npm install && npm run dev',
      'Remix':      'cd client && npm install && npm run dev',
      'Vite+React': 'cd client && npm install && npm run dev',
      'Angular':    'cd client && npm install && npx ng serve',
    };
    const BACKEND_START = {
      'NestJS':   'cd backend && npm install && npm run start:dev',
      'Express':  'cd backend && npm install && npm run dev',
      'Fastify':  'cd backend && npm install && npm run dev',
      'Django':   'cd backend && pip install -r requirements.txt && python manage.py runserver',
      'FastAPI':  'cd backend && pip install -r requirements.txt && uvicorn main:app --reload',
      'Laravel':  'cd backend && composer install && php artisan serve',
      'Rails':    'cd backend && bundle install && bin/rails server',
    };

    const pkgPath = path.join(ROOT, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (!pkg.scripts) pkg.scripts = {};

      const parts = branchName.split('/');
      const _t = guards.loadTracking(ROOT, config);
      const uiDone   = _t?.client?.UI?.status   === 'COMPLETED';
      const initDone = _t?.backend?.INIT?.status === 'COMPLETED';

      if (uiDone) {
        const fw = config.client && config.client.framework;
        const cmd = CLIENT_START[fw];
        if (cmd && !pkg.scripts['start:client']) {
          pkg.scripts['start:client'] = cmd;
          fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
          console.log(`  ${green('✓')} start:client added to package.json (${cmd})`);
        }
      }

      if (initDone) {
        const fw = config.backend && config.backend.framework;
        const cmd = BACKEND_START[fw];
        if (cmd && !pkg.scripts['start:backend']) {
          pkg.scripts['start:backend'] = cmd;
          fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
          console.log(`  ${green('✓')} start:backend added to package.json (${cmd})`);
        }
      }
    }
  } catch { /* best-effort */ }

  // ── Update scaffold flags ──────────────────────────────────────────────────

  try {
    const parts = branchName.split('/');
    if (parts.length >= 4) {
      const scope = parts[1];
      const agent = parts[2].toUpperCase();
      const cfgPath = path.join(ROOT, '.scaffold', '.config.json');
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      if (!cfg.scaffolded) cfg.scaffolded = { client: false, backend: false };
      if (scope === 'client' && agent === 'UI')   cfg.scaffolded.client  = true;
      if (scope === 'backend' && agent === 'INIT') cfg.scaffolded.backend = true;
      fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2), 'utf8');
    }
  } catch { /* best-effort */ }

  // ── Push to origin ────────────────────────────────────────────────────────────

  try {
    execSync('git push origin main', { cwd: ROOT, stdio: 'pipe' });
    console.log(`  ${green('✓')} Pushed to origin/main`);
  } catch (err) {
    console.log(`  ${yellow('!')} Could not push to origin.`);
    console.log(dim('     This is normal if you have not set up a remote repo yet.'));
    console.log(dim('     When ready: git push origin main'));
  }

  // ── Worktree retained ────────────────────────────────────────────────────────
  // Worktree is kept for reference. Clean up manually when no longer needed:
  // git worktree remove "${worktreePath}" --force

  // ── Done ──────────────────────────────────────────────────────────────────────

  separator();
  // Derive agent and scope for summary
  const _parts = branchName.split('/');
  const _scope = _parts.length >= 4 ? _parts[1] : '';
  const _agent = _parts.length >= 4 ? _parts[2].toUpperCase() : '';

  // Read task from TASK.md if available
  let _task = '';
  try {
    const taskMd = fs.readFileSync(path.join(worktreePath, 'TASK.md'), 'utf8');
    const taskMatch = taskMd.match(/^## Task\n.*?Use\.agents\/.*?\. Task: (.+)$/m);
    if (taskMatch) _task = taskMatch[1].trim();
  } catch {}

  console.log(`\n${bold(green('  Task completed successfully!'))}\n`);
  if (_agent) console.log(`  ${dim('Agent')}  : ${green(_agent)} ${dim('(' + _scope + ')')}`);
  if (_task)  console.log(`  ${dim('Task')}   : ${dim(_task)}`);
  console.log(`  ${dim('Branch')} : ${green(branchName)} merged into ${green('main')}\n`);

  // ── Derive next step from tracking ──────────────────────────────────────────
  const AGENT_ORDER = {
    client:  ['UI', 'LOGIC', 'FORMS', 'ROUTING', 'TESTING', 'ACCESSIBILITY'],
    backend: ['INIT', 'API', 'LOGIC', 'AUTH', 'DB', 'TESTING', 'EVENTS', 'JOBS'],
    shared:  ['SECURITY'],
  };
  const SCOPE_ORDER = ['client', 'backend', 'shared'];

  try {
    const _tracking = guards.loadTracking(ROOT, config);

    const findNextInScope = (scope) => {
      const order = AGENT_ORDER[scope] || [];
      for (const a of order) {
        const slot = (_tracking[scope] || {})[a];
        if (!slot || (slot.status !== 'COMPLETED' && slot.status !== 'ACTIVE')) return a;
      }
      return null;
    };

    let nextScope = null;
    let nextAgent = null;

    const scopesToCheck = [_scope, ...SCOPE_ORDER.filter(s => s !== _scope)];
    for (const s of scopesToCheck) {
      const n = findNextInScope(s);
      if (n) { nextScope = s; nextAgent = n; break; }
    }

    separator();
    console.log(`\n  ${bold('What to do next:')}`);

    if (nextAgent) {
      console.log(`\n  ${green('→')} ${bold(nextAgent)} ${dim('(' + nextScope + ')')}`);
      console.log(`\n  ${cyan('npm run agent')}`);
      console.log(`  ${dim('Select: ' + nextScope + ' → ' + nextAgent)}`);
    } else {
      console.log(`\n  ${cyan('npm run agent')}`);
    }
  } catch {
    separator();
    console.log(`\n  ${bold('What to do next:')}\n`);
    console.log(`  ${cyan('npm run agent')}`);
  }

  console.log('\n');


  // ── Backend/INIT launch prompt (if user chose 'after' during LOGIC session) ──
  try {
    const _tracking = guards.loadTracking(ROOT, config);
    const beSlot    = _tracking?.backend?.INIT;
    if (
      _scope === 'logic' &&
      _parts[0] === 'agent' && _parts[1] === 'client' &&
      beSlot?.backendLaunchTiming === 'after' &&
      beSlot?.status !== 'ACTIVE' &&
      beSlot?.status !== 'COMPLETED'
    ) {
      separator();
      console.log(`\n  ${yellow('⚡ Ready to scaffold your backend?')}\n`);
      console.log(`  client/LOGIC is merged. This is the ideal moment to launch backend/INIT.\n`);

      const { spawn: _spawn } = require('child_process');
      const launchIdx = await arrowSelect('Launch backend/INIT?', [
        'Launch backend/INIT now  ← recommended',
        'Skip — I will handle it manually',
      ]);

      if (launchIdx === 0) {
        console.log(`\n  ${green('✓')} Launching backend/INIT...\n`);
        _spawn('node', [path.join(ROOT, '.workflow', 'agent.js'), '--scope=backend', '--agent=INIT'], {
          cwd: ROOT, stdio: 'inherit',
        });
        return;
      }
    }
  } catch { /* best-effort */ }
};

main().catch((err) => {
  console.error('\n  Error:', err.message);
  process.exit(1);
});
#!/usr/bin/env node

/**
 * Multi-Agent Monorepo Template - Task Completion
 * Run with: node .workflow/complete.js
 *
 * Merges the current task branch into main,
 * updates BUILD_STATE.md, and pushes to origin.
 * Run from the repo root after a task is complete.
 */

const readline          = require('readline');
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

// ── Readline ──────────────────────────────────────────────────────────────────

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const ask = (question) =>
  new Promise((resolve) => rl.question(question, (a) => resolve(a.trim())));

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
    rl.close();
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
    while (!selectedWorktree) {
      const input = await ask(`\n  ${bold('Select task to complete')} ${dim(`(1-${worktrees.length})`)}: `);
      const index = parseInt(input) - 1;
      if (!isNaN(index) && index >= 0 && index < worktrees.length) {
        selectedWorktree = worktrees[index];
      } else {
        console.log(yellow(`  Please enter a number between 1 and ${worktrees.length}.`));
      }
    }
  }

  const { path: worktreePath, branch: branchName } = selectedWorktree;

  // ── Check TASK.md status ──────────────────────────────────────────────────────

  const taskMdPath = path.join(worktreePath, 'TASK.md');
  if (fs.existsSync(taskMdPath)) {
    const taskContent = fs.readFileSync(taskMdPath, 'utf8');
    const isCompleted = taskContent.includes('[x] COMPLETED');

    if (!isCompleted && !isNonTTY) {
      console.log(`\n${yellow('  TASK.md is not marked as COMPLETED.')}`);
      console.log(dim('  The agent may still be working on this task.\n'));
      const proceed = await ask(`  ${bold('Proceed with merge anyway?')} ${dim('(y/n)')}: `);
      if (proceed.toLowerCase() !== 'y') {
        console.log(yellow('\n  Aborted. Complete the task first.\n'));
        rl.close();
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

  const confirm = isNonTTY ? 'y' : await ask(`${bold('Confirm merge into main?')} ${dim('(y/n)')}: `);
  if (confirm.toLowerCase() !== 'y') {
    console.log(yellow('\n  Aborted.\n'));
    rl.close();
    return;
  }

  separator();
  console.log(`\n${bold('Completing task...')}\n`);

  // ── Auto-commit uncommitted changes in worktree ──────────────────────────────

  try {
    const status = execSync('git status --porcelain', { cwd: worktreePath, stdio: 'pipe' }).toString().trim();
    if (status) {
      console.log(`  ${yellow('!')} Uncommitted changes detected - committing before merge...`);
      execSync('git add .', { cwd: worktreePath, stdio: 'pipe' });
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
      const proceedAnyway = await ask(`  ${bold('Proceed with merge anyway?')} ${dim('(y/n)')}: `);
      if (proceedAnyway.toLowerCase() !== 'y') {
        console.log(yellow('\n  Aborted.\n'));
        rl.close();
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
        rl.close();
        return;
      }
    } catch {
      console.log(`\n${red('  ✗ Merge failed.')} Resolve manually.\n`);
      rl.close();
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
  console.log(`  ${bold('What to do next:')}\n`);
  console.log(`  Start a new task:`);
  console.log(`  ${cyan('npm run agent')}\n`);
  separator();
  console.log('');

  rl.close();
};

main().catch((err) => {
  console.error('\n  Error:', err.message);
  process.exit(1);
});
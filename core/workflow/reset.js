#!/usr/bin/env node

/**
 * Multi-Agent Monorepo Template - Reset
 * Full project wipe with 2-step confirmation.
 *
 * Deletes:
 *  - All worktrees
 *  - All agent branches (local + remote)
 *  - Remote GitHub repository
 *  - All project files
 *
 * Run with: npm run reset
 */

'use strict';

const fs           = require('fs');
const path         = require('path');
const readline     = require('readline');
const { execSync } = require('child_process');

let prompts = null;
try { prompts = require('prompts'); } catch { prompts = null; }

// ── Self-relocate to repo root ────────────────────────────────────────────────

const ROOT = path.join(__dirname, '..');

// ── Colors ────────────────────────────────────────────────────────────────────

const c = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  cyan:   '\x1b[36m',
};

const bold   = (s) => `${c.bold}${s}${c.reset}`;
const dim    = (s) => `${c.dim}${s}${c.reset}`;
const green  = (s) => `${c.green}${s}${c.reset}`;
const yellow = (s) => `${c.yellow}${s}${c.reset}`;
const red    = (s) => `${c.red}${s}${c.reset}`;
const cyan   = (s) => `${c.cyan}${s}${c.reset}`;

const separator = () => console.log(`\n${dim('─'.repeat(60))}\n`);

// ── Paths ─────────────────────────────────────────────────────────────────────

const RUNTIME_DIR   = path.join(ROOT, '.scaffold');
const CONFIG_PATH   = path.join(RUNTIME_DIR, '.config.json');
const TRACKING_PATH = path.join(RUNTIME_DIR, '.tracking.json');
const LOCK_FILE     = path.join(RUNTIME_DIR, '.initialized');

// ── Main ──────────────────────────────────────────────────────────────────────

const main = async () => {

  // ── Guard: must be initialized ───────────────────────────────────────────────

  if (!fs.existsSync(LOCK_FILE)) {
    console.log(`\n${red('  ✗ No initialized project found.')}`);
    console.log(dim('  Run multi-agents init to create a project.\n'));
    process.exit(1);
  }

  // ── Load config and tracking ─────────────────────────────────────────────────

  const config   = fs.existsSync(CONFIG_PATH)   ? JSON.parse(fs.readFileSync(CONFIG_PATH,   'utf8')) : {};
  const tracking = fs.existsSync(TRACKING_PATH) ? JSON.parse(fs.readFileSync(TRACKING_PATH, 'utf8')) : {};
  const projectName = config.projectName || path.basename(ROOT);

  // ── Collect active resources ──────────────────────────────────────────────────

  const activeAgents = [];
  for (const scope of ['client', 'backend', 'shared']) {
    const agents = tracking[scope] || {};
    for (const [agent, data] of Object.entries(agents)) {
      if (data && data.branch) {
        activeAgents.push({ scope, agent, data });
      }
    }
  }

  // ── Get remote ────────────────────────────────────────────────────────────────

  let remoteUrl = null;
  try {
    remoteUrl = execSync('git remote get-url origin', { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {}

  // ── Display warning ───────────────────────────────────────────────────────────

  separator();
  console.log(`${red(bold('  ⚠ FULL PROJECT RESET'))}\n`);
  console.log(`  ${bold('This will permanently delete:')}\n`);

  // Project files
  console.log(`  ${red('Project files')}`);
  console.log(`    - All source code and configuration files`);
  console.log(`    - All scaffold and workflow files\n`);

  // Active agents
  if (activeAgents.length > 0) {
    console.log(`  ${red('Active agent workspaces')}`);
    for (const { agent, scope, data } of activeAgents) {
      console.log(`\n    ${bold(`${agent} (${scope})`)}`);
      console.log(`      - Branch        (${data.branch})`);
      console.log(`      - Remote branch (origin/${data.branch})`);
      if (data.worktreePath) {
        console.log(`      - Worktree      (${path.relative(ROOT, data.worktreePath)})`);
      }
    }
    console.log('');
  }

  // Remote repo
  if (remoteUrl) {
    console.log(`  ${red('Remote repository')}`);
    console.log(`    - ${remoteUrl}\n`);
  }

  console.log(`  ${red(bold('This cannot be undone.'))}\n`);
  separator();

  // ── Step 1: First confirmation ────────────────────────────────────────────────

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((resolve) => rl.question(q, (a) => resolve(a.trim())));

  if (prompts && process.stdin.isTTY) {
    const step1 = await prompts({
      type:    'select',
      name:    'value',
      message: 'Are you sure you want to permanently delete this project?',
      choices: [
        { title: red('Yes - I understand this cannot be undone'), value: 'yes' },
        { title: 'No - Cancel',                                   value: 'no'  },
      ],
    }, { onCancel: () => process.exit(0) });

    if (step1.value !== 'yes') {
      console.log(dim('\n  Reset cancelled.\n'));
      process.exit(0);
    }
  } else {
    const ans = await ask(`  ${bold('Are you sure?')} ${dim('(y/N)')}: `);
    if (ans.toLowerCase() !== 'y') {
      console.log(dim('\n  Reset cancelled.\n'));
      rl.close();
      process.exit(0);
    }
  }

  // ── Step 2: Type project name ─────────────────────────────────────────────────

  separator();
  console.log(`  ${yellow('To confirm, type the project name exactly:')}`);
  console.log(`  ${cyan(bold(projectName))}\n`);

  const typed = await ask(`  ${bold('Project name')}: `);
  rl.close();

  if (typed !== projectName) {
    console.log(`\n${red('  ✗ Project name does not match. Reset cancelled.')}\n`);
    process.exit(1);
  }

  // ── Execute wipe ──────────────────────────────────────────────────────────────

  separator();
  console.log(`${yellow('  Wiping project...')}\n`);

  // Remove worktrees
  for (const { agent, data } of activeAgents) {
    if (data.worktreePath && fs.existsSync(data.worktreePath)) {
      try {
        execSync(`git worktree remove "${data.worktreePath}" --force`, { cwd: ROOT, stdio: 'pipe' });
        console.log(`  ${green('✓')} Worktree removed (${agent})`);
      } catch {}
    }
  }

  // Delete local branches
  for (const { agent, data } of activeAgents) {
    try {
      execSync(`git branch -D ${data.branch}`, { cwd: ROOT, stdio: 'pipe' });
      console.log(`  ${green('✓')} Local branch deleted (${agent})`);
    } catch {}
  }

  // Delete remote branches
  for (const { agent, data } of activeAgents) {
    try {
      execSync(`git push origin --delete ${data.branch}`, { cwd: ROOT, stdio: 'pipe' });
      console.log(`  ${green('✓')} Remote branch deleted (${agent})`);
    } catch {}
  }

  // Delete remote repo via gh CLI if available
  if (remoteUrl) {
    try {
      const repoPath = remoteUrl.replace('https://github.com/', '').replace('git@github.com:', '').replace('.git', '');
      execSync(`gh repo delete ${repoPath} --yes`, { stdio: 'pipe' });
      console.log(`  ${green('✓')} Remote repository deleted`);
    } catch {
      console.log(`  ${yellow('!')} Could not delete remote repository automatically.`);
      console.log(dim(`     Delete manually at: ${remoteUrl}`));
    }
  }

  // Wipe project files (keep .git temporarily for branch ops above)
  const keepList = ['.git'];
  const entries  = fs.readdirSync(ROOT);
  for (const entry of entries) {
    if (keepList.includes(entry)) continue;
    try {
      fs.rmSync(path.join(ROOT, entry), { recursive: true, force: true });
    } catch {}
  }
  console.log(`  ${green('✓')} Project files removed`);

  // Remove .git
  try {
    fs.rmSync(path.join(ROOT, '.git'), { recursive: true, force: true });
    console.log(`  ${green('✓')} Git history removed`);
  } catch {}

  // ── Post-wipe instructions ────────────────────────────────────────────────────

  separator();
  console.log(`${green(bold('  Project wiped successfully.'))}\n`);
  console.log(`  To start fresh:\n`);
  console.log(`  ${cyan(`cd .. && multi-agents init ${projectName}`)}\n`);
  separator();

  process.exit(0);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

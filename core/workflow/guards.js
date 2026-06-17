#!/usr/bin/env node

/**
 * Multi-Agent Monorepo Template - Guards
 * Required by agent.js and complete.js
 *
 * Handles:
 *  - Config field validation
 *  - .tracking.json load / write / clear
 *  - Stale worktree reconciliation
 *  - MISSING detection + decision gate
 *  - Coexistence check (git analysis)
 *  - Recovery guidance generation
 *  - Agent active check
 */

const fs           = require('fs');
const path         = require('path');
const { execSync } = require('child_process');

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

const separator = () => console.log(`\n${dim('─'.repeat(60))}`);

// ── Slot template ─────────────────────────────────────────────────────────────

const emptySlot = () => ({
  branch:       null,
  timestamp:    null,
  launchedAt:   null,
  status:       null,
  missingCount: 0,
  worktreePath: null,
});

// ── Generate tracking structure ───────────────────────────────────────────────

const generateTrackingStructure = (config) => {
  const bt = config.backend?.type;

  const structure = {
    client: {
      UI:            emptySlot(),
      LOGIC:         emptySlot(),
      FORMS:         emptySlot(),
      ROUTING:       emptySlot(),
      TESTING:       emptySlot(),
      ACCESSIBILITY: emptySlot(),
    },
    shared: {
      SECURITY: emptySlot(),
    },
  };

  if (bt === 'separate') {
    structure.backend = {
      INIT:    emptySlot(),
      API:     emptySlot(),
      LOGIC:   emptySlot(),
      AUTH:    emptySlot(),
      DB:      emptySlot(),
      EVENTS:  emptySlot(),
      JOBS:    emptySlot(),
      TESTING: emptySlot(),
    };
  }

  return structure;
};

// ── Load tracking ─────────────────────────────────────────────────────────────

const loadTracking = (ROOT, config) => {
  const trackingPath = path.join(ROOT, '.scaffold', '.tracking.json');

  if (!fs.existsSync(trackingPath)) {
    console.log(dim('  ℹ Tracking file not found - regenerating from config.'));
    const fresh = generateTrackingStructure(config);
    fs.writeFileSync(trackingPath, JSON.stringify(fresh, null, 2), 'utf8');
    return fresh;
  }

  try {
    return JSON.parse(fs.readFileSync(trackingPath, 'utf8'));
  } catch {
    console.log(yellow('  ⚠ .tracking.json is corrupt - regenerating.'));
    const fresh = generateTrackingStructure(config);
    fs.writeFileSync(trackingPath, JSON.stringify(fresh, null, 2), 'utf8');
    return fresh;
  }
};

// ── Write tracking slot ───────────────────────────────────────────────────────

const updateTrackingSlot = (tracking, scope, agent, data, ROOT) => {
  if (!tracking[scope]) tracking[scope] = {};
  if (!tracking[scope][agent]) tracking[scope][agent] = emptySlot();

  tracking[scope][agent] = { ...tracking[scope][agent], ...data };

  const trackingPath = path.join(ROOT, '.scaffold', '.tracking.json');
  fs.writeFileSync(trackingPath, JSON.stringify(tracking, null, 2), 'utf8');
  return tracking;
};

// ── Clear tracking slot ───────────────────────────────────────────────────────

const clearTrackingSlot = (tracking, scope, agent, ROOT) => {
  if (!tracking[scope] || !tracking[scope][agent]) return tracking;

  // Preserve missingCount across completes - reset to 0 only on successful complete
  tracking[scope][agent] = emptySlot();

  const trackingPath = path.join(ROOT, '.scaffold', '.tracking.json');
  fs.writeFileSync(trackingPath, JSON.stringify(tracking, null, 2), 'utf8');
  return tracking;
};

// ── Validate config fields ────────────────────────────────────────────────────

const REQUIRED_CRITICAL = ['projectName', 'ide', 'client'];
const REQUIRED_BACKFILL = {
  'ide.openArgs':    [],
  'ide.winPaths':    [],
  'ide.linuxPaths':  [],
};

const validateConfig = (config, ROOT) => {
  const errors   = [];
  const backfilled = [];

  // Critical fields - hard stop if missing
  for (const field of REQUIRED_CRITICAL) {
    if (!config[field]) errors.push(field);
  }

  if (errors.length > 0) {
    console.log(`\n${red('  Config is missing critical fields:')} ${errors.join(', ')}`);
    console.log(dim('  Run npm run init to regenerate.\n'));
    process.exit(1);
  }

  // Non-critical fields - backfill with defaults
  for (const [fieldPath, defaultVal] of Object.entries(REQUIRED_BACKFILL)) {
    const parts  = fieldPath.split('.');
    let   target = config;
    let   parent = null;
    let   key    = null;

    for (const part of parts) {
      parent = target;
      key    = part;
      target = target?.[part];
    }

    if (target === undefined && parent && key) {
      parent[key] = defaultVal;
      backfilled.push(fieldPath);
    }
  }

  if (backfilled.length > 0) {
    console.log(dim(`  ℹ Config backfilled: ${backfilled.join(', ')}`));
    // Write updated config back
    const configPath = path.join(ROOT, '.scaffold', '.config.json');
    try {
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    } catch { /* best-effort */ }
  }

  return config;
};

// ── Check agent active ────────────────────────────────────────────────────────

const checkAgentActive = (tracking, scope, agent) => {
  const slot = tracking?.[scope]?.[agent];
  if (!slot || slot.status !== 'ACTIVE') return { active: false, slot: null };
  return { active: true, slot };
};

// ── Active worktree branches (path-verified) ──────────────────────────────────

const getActiveWorktrees = (ROOT) => {
  try {
    const output = execSync('git worktree list --porcelain', { cwd: ROOT, stdio: 'pipe' }).toString();
    const worktrees = [];
    const blocks = output.trim().split('\n\n');
    for (const block of blocks) {
      const lines      = block.split('\n');
      const pathLine   = lines.find(l => l.startsWith('worktree '));
      const branchLine = lines.find(l => l.startsWith('branch '));
      if (pathLine && branchLine) {
        const wtPath   = pathLine.replace('worktree ', '').trim();
        const wtBranch = branchLine.replace('branch refs/heads/', '').trim();
        if (fs.existsSync(wtPath)) worktrees.push({ path: wtPath, branch: wtBranch });
      }
    }
    return worktrees;
  } catch { return []; }
};

// ── Coexistence check ─────────────────────────────────────────────────────────

const coexistenceCheck = (branch, ROOT) => {
  const result = {
    remoteExists:    false,
    unmergedCommits: 0,
    divergenceCount: 0,
    conflictFiles:   [],
    prerequisites:   {},
  };

  // Check remote branch exists
  try {
    const remote = execSync(
      `git ls-remote --heads origin ${branch}`,
      { cwd: ROOT, stdio: 'pipe', encoding: 'utf8' }
    ).trim();
    result.remoteExists = remote.length > 0;
  } catch { return result; }

  if (!result.remoteExists) return result;

  // Fetch remote branch
  try {
    execSync(`git fetch origin ${branch}`, { cwd: ROOT, stdio: 'pipe' });
  } catch { return result; }

  // Unmerged commits on branch
  try {
    const commits = execSync(
      `git log main..origin/${branch} --oneline`,
      { cwd: ROOT, stdio: 'pipe', encoding: 'utf8' }
    ).trim();
    result.unmergedCommits = commits ? commits.split('\n').length : 0;
  } catch {}

  // How many commits is main ahead of branch
  try {
    const ahead = execSync(
      `git log origin/${branch}..main --oneline`,
      { cwd: ROOT, stdio: 'pipe', encoding: 'utf8' }
    ).trim();
    result.divergenceCount = ahead ? ahead.split('\n').length : 0;
  } catch {}

  // File overlap - files changed in both branch and main since divergence
  if (result.divergenceCount > 0) {
    try {
      const branchFiles = execSync(
        `git diff main...origin/${branch} --name-only`,
        { cwd: ROOT, stdio: 'pipe', encoding: 'utf8' }
      ).trim().split('\n').filter(Boolean);

      const mainFiles = execSync(
        `git log origin/${branch}..main --name-only --format=`,
        { cwd: ROOT, stdio: 'pipe', encoding: 'utf8' }
      ).trim().split('\n').filter(Boolean);

      const mainSet = new Set(mainFiles);
      result.conflictFiles = branchFiles.filter(f => mainSet.has(f));
    } catch {}
  }

  return result;
};

// ── Recovery guidance generator ───────────────────────────────────────────────

const generateRecoveryGuidance = (branch, coexistence) => {
  const lines = [];

  lines.push('## Recovery Notes');
  lines.push('');
  lines.push('This workspace was recovered from a missing worktree.');
  lines.push('Complete the following steps before implementing anything:');
  lines.push('');
  lines.push('### Step 1 - Pull main into this branch');
  lines.push('```');
  lines.push('git pull origin main');
  lines.push('```');

  if (coexistence.conflictFiles.length > 0) {
    lines.push('');
    lines.push('### Step 2 - Resolve conflicts in this order');
    coexistence.conflictFiles.forEach(file => {
      if (file.includes('CONTRACTS.md')) {
        lines.push(`- **${file}**: Keep all types added since this branch was created.`);
        lines.push('  Merge your proposed types alongside them - do not overwrite.');
      } else if (file.includes('Providers')) {
        lines.push(`- **${file}**: Rewired since this branch was created.`);
        lines.push('  Adapt your hooks to consume the new provider shape.');
      } else {
        lines.push(`- **${file}**: Modified since this branch was created.`);
        lines.push('  Preserve changes from main - adapt your work accordingly.');
      }
    });
  }

  lines.push('');
  lines.push('### Do NOT');
  lines.push('- Force push this branch');
  lines.push('- Start new implementation before git status is clean');
  lines.push('- Overwrite types in CONTRACTS.md added by other agents');
  lines.push('');
  lines.push('---');

  return lines.join('\n');
};

// ── MISSING gate ──────────────────────────────────────────────────────────────

const runMissingGate = async (params) => {
  const { scope, agent, slot, tracking, config, ROOT, ask } = params;
  const { branch, timestamp, missingCount } = slot;

  separator();
  console.log(`\n${yellow(`  ⚠ ${scope.toUpperCase()} / ${agent} workspace is missing`)}\n`);
  console.log(`  ${dim('Branch')}   : ${branch}`);
  console.log(`  ${dim('Created')}  : ${slot.launchedAt ? new Date(slot.launchedAt).toLocaleString() : 'unknown'}`);

  // Run coexistence check
  console.log(dim('\n  Checking remote and coexistence...\n'));
  const coexistence = coexistenceCheck(branch, ROOT);

  // Display coexistence results
  if (!coexistence.remoteExists) {
    console.log(`  ${dim('Remote')}   : ${red('not found - branch was deleted remotely')}`);
  } else {
    console.log(`  ${dim('Remote')}   : ${green('exists')} - ${coexistence.unmergedCommits} unmerged commit(s)`);
  }

  if (coexistence.divergenceCount > 0) {
    console.log(`  ${dim('Divergence')}: ${yellow(`main is ${coexistence.divergenceCount} commit(s) ahead`)}`);
  } else {
    console.log(`  ${dim('Divergence')}: ${green('none - branch is up to date with main')}`);
  }

  if (coexistence.conflictFiles.length > 0) {
    console.log(`  ${dim('Conflicts')} : ${red(coexistence.conflictFiles.length + ' file(s) overlap with main changes:')}`);
    coexistence.conflictFiles.forEach(f => console.log(`     ${dim('→')} ${f}`));
  } else if (coexistence.remoteExists) {
    console.log(`  ${dim('Conflicts')} : ${green('none detected')}`);
  }

  if (missingCount > 0) {
    console.log(`\n  ${yellow(`ℹ This agent has been missing ${missingCount} time(s) before.`)}`);
  }

  // Present options
  separator();
  console.log(`\n  ${bold('What would you like to do?')}\n`);

  if (coexistence.remoteExists) {
    console.log(`  ${dim('1.')} ${bold('Recover')}  - restore workspace from remote branch`);
    console.log(`     ${dim('→')} Your ${coexistence.unmergedCommits} commit(s) will be available to continue`);
    if (coexistence.divergenceCount > 0) {
      console.log(`     ${yellow(`⚠ ${coexistence.divergenceCount} commit(s) to reconcile - conflicts likely in ${coexistence.conflictFiles.length} file(s)`)}`);
    }
    console.log('');
    console.log(`  ${dim('2.')} ${bold('Reset')}    - delete branch locally and remotely, start fresh`);
    console.log(`     ${red('⚠ All ' + coexistence.unmergedCommits + ' commit(s) will be permanently lost')}`);
    console.log('');
    console.log(`  ${dim('3.')} ${bold('New task')} - create a new ${agent} branch, leave remote unresolved`);
    console.log(`     ${yellow('⚠ 2 unmerged ' + agent + ' branches will exist')}`);
    console.log(`     ${dim('Only recommended for a genuinely separate concern')}`);
  } else {
    // Remote doesn't exist - only reset or new task
    console.log(`  ${dim('1.')} ${bold('Reset')}    - clear this tracking entry, start fresh`);
    console.log(`     ${dim('→')} Remote branch is already gone - no data loss`);
    console.log('');
    console.log(`  ${dim('2.')} ${bold('New task')} - create a new ${agent} branch`);
    console.log(`     ${dim('→')} Tracking entry will be replaced`);
  }

  const maxOption = coexistence.remoteExists ? 3 : 2;
  let choice;
  while (!choice) {
    const input = await ask(`\n  ${bold(`Select (1-${maxOption})`)}: `);
    const n = parseInt(input);
    if (!isNaN(n) && n >= 1 && n <= maxOption) choice = n;
    else console.log(yellow(`  Please enter a number between 1 and ${maxOption}.`));
  }

  // ── Handle: Recover ─────────────────────────────────────────────────────────

  if (coexistence.remoteExists && choice === 1) {
    separator();
    console.log(`\n${bold('Recovering workspace...')}\n`);

    const sanitizedName = config.projectName.toLowerCase().replace(/\s+/g, '-');
    const worktreeName  = `${scope}-${sanitizedName}-${agent.toLowerCase()}-${timestamp}`;
    const worktreePath  = path.join(ROOT, 'worktrees', worktreeName);

    try {
      // Check if local branch exists
      try {
        execSync(`git show-ref --verify --quiet refs/heads/${branch}`, { cwd: ROOT, stdio: 'pipe' });
        execSync(`git worktree add "${worktreePath}" ${branch}`, { cwd: ROOT, stdio: 'pipe' });
      } catch {
        // Local branch gone - create from remote
        execSync(`git worktree add "${worktreePath}" -b ${branch} origin/${branch}`, { cwd: ROOT, stdio: 'pipe' });
      }
      console.log(`  ${green('✓')} Workspace restored at: worktrees/${worktreeName}`);
    } catch (err) {
      console.log(`  ${red('✗')} Could not restore workspace: ${err.message}`);
      console.log(dim('  Try manually: git worktree add worktrees/' + worktreeName + ' ' + branch));
      return { action: 'failed' };
    }

    // Append recovery guidance to TASK.md
    const taskMdPath = path.join(worktreePath, 'TASK.md');
    if (fs.existsSync(taskMdPath)) {
      const guidance = generateRecoveryGuidance(branch, coexistence);
      fs.appendFileSync(taskMdPath, `\n${guidance}\n`, 'utf8');
      console.log(`  ${green('✓')} Recovery guidance appended to TASK.md`);
    }

    // Show best-practice summary
    console.log(`\n${bold('Before implementing - complete these steps:')}\n`);
    console.log(`  ${bold('1.')} Pull main into this branch:`);
    console.log(`     ${cyan('git pull origin main')}\n`);
    if (coexistence.conflictFiles.length > 0) {
      console.log(`  ${bold('2.')} Resolve conflicts in: ${coexistence.conflictFiles.join(', ')}`);
      console.log(dim('     See Recovery Notes in TASK.md for file-specific guidance\n'));
    }
    console.log(`  ${yellow('⚠ Do NOT start new implementation until git status is clean.')}\n`);

    // Update tracking slot - back to ACTIVE
    updateTrackingSlot(tracking, scope, agent, {
      status:       'ACTIVE',
      worktreePath,
    }, ROOT);

    return { action: 'recovered', worktreePath };
  }

  // ── Handle: Reset ──────────────────────────────────────────────────────────

  const isReset = coexistence.remoteExists ? choice === 2 : choice === 1;

  if (isReset) {
    separator();
    console.log(`\n${bold('Resetting...')}\n`);

    // Delete local branch
    try {
      execSync(`git branch -D ${branch}`, { cwd: ROOT, stdio: 'pipe' });
      console.log(`  ${green('✓')} Local branch deleted`);
    } catch {
      console.log(`  ${dim('!')} Local branch not found - skipping`);
    }

    // Delete remote branch
    if (coexistence.remoteExists) {
      try {
        execSync(`git push origin --delete ${branch}`, { cwd: ROOT, stdio: 'pipe' });
        console.log(`  ${green('✓')} Remote branch deleted`);
      } catch {
        console.log(`  ${yellow('!')} Could not delete remote branch - delete manually: git push origin --delete ${branch}`);
      }
    }

    // Clear tracking slot
    tracking[scope][agent] = emptySlot();
    const trackingPath = path.join(ROOT, '.scaffold', '.tracking.json');
    fs.writeFileSync(trackingPath, JSON.stringify(tracking, null, 2), 'utf8');
    console.log(`  ${green('✓')} Tracking entry cleared`);

    // Update BUILD_STATE.md
    const buildStatePath = path.join(ROOT, 'BUILD_STATE.md');
    if (fs.existsSync(buildStatePath)) {
      let content = fs.readFileSync(buildStatePath, 'utf8');
      content = content.replace(
        `| IN PROGRESS | ${branch} |`,
        `| RESET       | ${branch} |`
      );
      content = content.replace(
        `| MISSING     | ${branch} |`,
        `| RESET       | ${branch} |`
      );
      fs.writeFileSync(buildStatePath, content, 'utf8');
      try {
        execSync('git add BUILD_STATE.md .scaffold/.tracking.json', { cwd: ROOT, stdio: 'pipe' });
        execSync(`git commit -m "build: reset ${scope}/${agent} [${branch}]"`, { cwd: ROOT, stdio: 'pipe' });
      } catch { /* best-effort */ }
    }

    console.log(`\n  ${green('✓')} Reset complete - proceeding to launch new ${agent} task.\n`);
    return { action: 'reset' };
  }

  // ── Handle: New task ───────────────────────────────────────────────────────

  console.log(dim('\n  Proceeding with new branch. Remote branch left unresolved.\n'));
  return { action: 'new' };
};

// ── Reconcile stale worktrees ─────────────────────────────────────────────────

const reconcileStaleWorktrees = (entries, tracking, ROOT) => {
  const activeWorktrees = getActiveWorktrees(ROOT);
  const activeBranches  = new Set(activeWorktrees.map(w => w.branch));

  const stale = entries.filter(e =>
    e.status === 'IN PROGRESS' &&
    e.branch &&
    !activeBranches.has(e.branch)
  );

  if (stale.length === 0) return entries;

  const buildStatePath = path.join(ROOT, 'BUILD_STATE.md');
  let content = fs.existsSync(buildStatePath)
    ? fs.readFileSync(buildStatePath, 'utf8')
    : '';

  stale.forEach(e => {
    content = content.replace(
      `| IN PROGRESS | ${e.branch} |`,
      `| MISSING     | ${e.branch} |`
    );

    // Update tracking slot missingCount
    const scope = e.scope;
    const agent = e.agent;
    if (tracking?.[scope]?.[agent]) {
      tracking[scope][agent].status       = 'MISSING';
      tracking[scope][agent].missingCount = (tracking[scope][agent].missingCount || 0) + 1;
    }
  });

  if (stale.length > 0 && fs.existsSync(buildStatePath)) {
    fs.writeFileSync(buildStatePath, content, 'utf8');
    const trackingPath = path.join(ROOT, '.scaffold', '.tracking.json');
    fs.writeFileSync(trackingPath, JSON.stringify(tracking, null, 2), 'utf8');

    try {
      execSync('git add BUILD_STATE.md .scaffold/.tracking.json', { cwd: ROOT, stdio: 'pipe' });
      execSync('git commit -m "build: mark missing worktrees"', { cwd: ROOT, stdio: 'pipe' });
    } catch { /* best-effort */ }
  }

  return entries.map(e =>
    stale.find(s => s.branch === e.branch) ? { ...e, status: 'MISSING' } : e
  );
};

// ── Browser opener ───────────────────────────────────────────────────────────

const openBrowser = (url) => {
  const platform = process.platform;
  try {
    if (platform === 'darwin') {
      try {
        execSync(`open "${url}"`, { stdio: 'pipe' });
        return true;
      } catch {}
      const browsers = [
        'Google Chrome', 'Safari', 'Firefox',
        'Microsoft Edge', 'Arc', 'Brave Browser',
      ];
      for (const browser of browsers) {
        if (fs.existsSync(`/Applications/${browser}.app`)) {
          execSync(`open -a "${browser}" "${url}"`, { stdio: 'pipe' });
          return true;
        }
      }
    } else if (platform === 'win32') {
      execSync(`start "" "${url}"`, { stdio: 'pipe' });
      return true;
    } else {
      execSync(`xdg-open "${url}"`, { stdio: 'pipe' });
      return true;
    }
  } catch {}
  return false;
};

// ── Silent auth detection ─────────────────────────────────────────────────────

const detectAuthMethod = (ROOT) => {
  // 1. SSH
  try {
    const out = execSync('ssh -T git@github.com 2>&1', { stdio: 'pipe', encoding: 'utf8' });
    if (out.includes('successfully authenticated')) return 'ssh';
  } catch (e) {
    // exit code 1 = authenticated (GitHub returns 1 for no shell access)
    if (e.stdout?.includes('successfully authenticated') ||
        e.stderr?.includes('successfully authenticated')) return 'ssh';
  }

  // 2. gh CLI
  try {
    execSync('gh auth status', { stdio: 'pipe' });
    return 'gh';
  } catch {}

  // 3. HTTPS stored credentials
  try {
    execSync('git ls-remote https://github.com 2>/dev/null', {
      cwd: ROOT, stdio: 'pipe', timeout: 5000,
    });
    return 'https';
  } catch {}

  return null;
};

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  generateTrackingStructure,
  loadTracking,
  updateTrackingSlot,
  clearTrackingSlot,
  validateConfig,
  checkAgentActive,
  coexistenceCheck,
  runMissingGate,
  reconcileStaleWorktrees,
  getActiveWorktrees,
  openBrowser,
  detectAuthMethod,
};
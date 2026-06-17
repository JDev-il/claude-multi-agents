#!/usr/bin/env node

/**
 * Multi-Agent Monorepo Template - Agent Restarter
 * Run with: npm run restart
 */

const fs                  = require('fs');
const path                = require('path');
const { execSync, spawn } = require('child_process');
const readline            = require('readline');

let prompts;
try { prompts = require('prompts'); } catch { prompts = null; }

// ── Colour helpers ────────────────────────────────────────────────────────────
const rst    = '\x1b[0m';
const dim    = s => `\x1b[2m${s}${rst}`;
const bold   = s => `\x1b[1m${s}${rst}`;
const green  = s => `\x1b[32m${s}${rst}`;
const yellow = s => `\x1b[33m${s}${rst}`;
const red    = s => `\x1b[31m${s}${rst}`;
const cyan   = s => `\x1b[36m${s}${rst}`;
const sep    = () => console.log(dim('─'.repeat(60)));

// ── ROOT resolution (works from any worktree) ─────────────────────────────────
const ROOT = (() => {
  try {
    const common = execSync('git rev-parse --git-common-dir', { stdio: 'pipe' }).toString().trim();
    return common.endsWith('/.git') ? common.slice(0, -5) : path.resolve(common, '..');
  } catch {
    console.error(red('  Not inside a git repository.\n'));
    process.exit(1);
  }
})();

const SCAFFOLD_DIR  = path.join(ROOT, '.scaffold');
const TRACKING_PATH = path.join(SCAFFOLD_DIR, '.tracking.json');
const CONFIG_PATH   = path.join(SCAFFOLD_DIR, '.config.json');

if (!fs.existsSync(CONFIG_PATH)) {
  console.log(red('\n  Missing .scaffold/.config.json.'));
  console.log(dim('  Run npm run init first.\n'));
  process.exit(1);
}

const config   = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const tracking = fs.existsSync(TRACKING_PATH)
  ? JSON.parse(fs.readFileSync(TRACKING_PATH, 'utf8'))
  : {};

const ENTRY_CWD = process.cwd();

// ── Constants ─────────────────────────────────────────────────────────────────
const INIT_AGENTS = { client: ['UI'], backend: ['INIT'] };

const DEPENDENCIES = {
  client:  { UI: ['LOGIC', 'FORMS', 'ROUTING', 'TESTING', 'ACCESSIBILITY'] },
  backend: { INIT: ['API', 'LOGIC', 'AUTH', 'DB', 'EVENTS', 'JOBS', 'TESTING'] },
  shared:  {},
};

// ── Git worktrees ─────────────────────────────────────────────────────────────
const getWorktrees = () => {
  try {
    const out = execSync('git worktree list --porcelain', { cwd: ROOT, stdio: 'pipe' }).toString();
    return out.trim().split('\n\n').reduce((acc, block) => {
      const lines  = block.split('\n');
      const wtPath = lines.find(l => l.startsWith('worktree '))?.replace('worktree ', '').trim();
      const branch = lines.find(l => l.startsWith('branch '))?.replace('branch refs/heads/', '').trim();
      if (wtPath && branch && wtPath !== ROOT) acc.push({ path: wtPath, branch });
      return acc;
    }, []);
  } catch { return []; }
};

// ── Candidate list: tracked + untracked ──────────────────────────────────────
const buildCandidates = () => {
  const worktrees  = getWorktrees();
  const candidates = [];

  for (const scope of ['client', 'backend', 'shared']) {
    for (const [agent, data] of Object.entries(tracking[scope] || {})) {
      if (!data?.branch) continue;
      const wt = worktrees.find(w => w.branch === data.branch);
      candidates.push({
        scope, agent,
        branch:       data.branch,
        worktreePath: data.worktreePath || wt?.path || null,
        status:       data.status || 'ACTIVE',
      });
    }
  }

  for (const wt of worktrees) {
    const m = wt.branch.match(/^agent\/(client|backend|shared)\/([A-Z]+)\//);
    if (!m || candidates.find(c => c.branch === wt.branch)) continue;
    candidates.push({ scope: m[1], agent: m[2], branch: wt.branch, worktreePath: wt.path, status: 'UNTRACKED' });
  }

  return candidates;
};

const detectCurrentAgent = (candidates) =>
  candidates.find(c => c.worktreePath && ENTRY_CWD.startsWith(c.worktreePath));

// ── Prompts ───────────────────────────────────────────────────────────────────
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = q => new Promise(r => rl.question(q, a => r(a.trim())));

const arrowSelect = async (message, choices) => {
  if (prompts && process.stdin.isTTY) {
    const res = await prompts({
      type: 'select', name: 'value', message,
      choices: choices.map((c, i) => ({ title: c.label, value: i })),
    }, { onCancel: () => process.exit(0) });
    return res.value;
  }
  choices.forEach((c, i) => console.log(`  ${dim(`${i + 1}.`)} ${c.label}`));
  return new Promise(resolve => {
    rl.question(`\n  Select (1-${choices.length}): `, ans => {
      const n = parseInt(ans) - 1;
      resolve(!isNaN(n) && n >= 0 && n < choices.length ? n : 0);
    });
  });
};

// ── Wipe a single agent slot ──────────────────────────────────────────────────
const wipeAgent = ({ scope, agent, branch, worktreePath }) => {
  try { execSync(`git worktree remove "${worktreePath}" --force`, { cwd: ROOT, stdio: 'pipe' }); } catch {}
  try { execSync(`git branch -D ${branch}`, { cwd: ROOT, stdio: 'pipe' }); } catch {}
  try { execSync(`git push origin --delete ${branch}`, { cwd: ROOT, stdio: 'pipe' }); } catch {}

  if (tracking[scope]?.[agent]) {
    tracking[scope][agent] = { branch: null, timestamp: null, launchedAt: null, status: null, missingCount: 0, worktreePath: null };
    fs.writeFileSync(TRACKING_PATH, JSON.stringify(tracking, null, 2), 'utf8');
  }
  console.log(`  ${green('✓')} ${agent} wiped`);
};

// ── Main ──────────────────────────────────────────────────────────────────────
const main = async () => {
  console.log('\n');
  console.log(bold(cyan('  Multi-Agent Monorepo Template')));
  console.log(dim(`  Agent Restarter - ${config.projectName}\n`));
  sep();

  const candidates = buildCandidates();

  if (candidates.length === 0) {
    console.log(yellow('\n  No active agents found. Nothing to restart.\n'));
    console.log(dim(`  Run ${cyan('npm run agent')} to start a new task.\n`));
    rl.close(); process.exit(0);
  }

  // ── Detect location ───────────────────────────────────────────────────────
  let candidate = detectCurrentAgent(candidates);

  if (!candidate) {
    sep();
    console.log(`\n${bold('* Select agent to restart:')}\n`);
    const idx = await arrowSelect('Select agent', [
      ...candidates.map(c => ({
        label: `${bold(c.agent)} ${dim(`(${c.scope})`)}  ${dim(c.branch)}  ${c.status === 'UNTRACKED' ? yellow('untracked') : dim(c.status)}`,
      })),
      { label: dim('← cancel') },
    ]);
    if (idx === candidates.length) {
      console.log(dim('\n  Cancelled.\n')); rl.close(); process.exit(0);
    }
    candidate = candidates[idx];
  }

  const { scope, agent, branch, worktreePath } = candidate;
  const isInitAgent = (INIT_AGENTS[scope] || []).includes(agent);
  const deps        = (DEPENDENCIES[scope] || {})[agent] || [];
  const activeDeps  = deps.filter(dep => tracking[scope]?.[dep]?.branch);

  // ── Show agent info ───────────────────────────────────────────────────────
  sep();
  console.log(`\n  ${bold('Agent:')}  ${cyan(agent)} ${dim(`(${scope})`)}`);
  console.log(`  ${bold('Branch:')} ${dim(branch)}`);
  if (worktreePath) console.log(`  ${bold('Path:')}   ${dim(worktreePath)}\n`);

  // ── Cascade warning ───────────────────────────────────────────────────────
  if (isInitAgent) {
    console.log(yellow(`  ⚠ ${agent} is a scaffold agent. Restarting will also wipe:\n`));
    deps.forEach(dep => console.log(`    ${dim('→')} ${dep}`));
    console.log(`\n  ${red('All dependent work will be permanently lost.')}\n`);
  } else if (activeDeps.length > 0) {
    console.log(yellow('  ⚠ Active dependent agents that will also be wiped:\n'));
    activeDeps.forEach(dep => console.log(`    ${dim('→')} ${dep}`));
    console.log('');
  }

  // ── Decision block ────────────────────────────────────────────────────────
  const actionIdx = await arrowSelect('What would you like to do?', [
    { label: `${bold('Init this agent')}  - wipe and restart fresh` },
    { label: `${bold('Abort')}            - go back or exit` },
  ]);

  if (actionIdx === 1) {
    sep();
    const abortIdx = await arrowSelect('What would you like to do?', [
      { label: `${bold('Take me back')}  - return to where you were` },
      { label: `${bold('Exit')}          - stay here and exit` },
    ]);
    if (abortIdx === 0) {
      console.log(`\n  ${green('✓')} Run this to return:\n`);
      console.log(`  ${cyan(`cd "${ENTRY_CWD}"`)}\n`);
    } else {
      console.log(dim('\n  Exited.\n'));
    }
    rl.close(); process.exit(0);
  }

  // ── Wipe ──────────────────────────────────────────────────────────────────
  sep();
  console.log(`\n  ${bold('Wiping')} ${cyan(agent)}...\n`);

  const depsToWipe = isInitAgent ? deps : activeDeps;
  for (const dep of depsToWipe) {
    const d  = tracking[scope]?.[dep];
    const wt = d?.branch ? getWorktrees().find(w => w.branch === d.branch) : null;
    if (d?.branch) wipeAgent({ scope, agent: dep, branch: d.branch, worktreePath: d.worktreePath || wt?.path });
  }
  wipeAgent(candidate);

  // ── Chain into agent.js ───────────────────────────────────────────────────
  sep();
  console.log(`\n  ${green('✓')} Restart complete. Launching agent selector...\n`);
  rl.close();

  spawn('node', [path.join(ROOT, '.workflow', 'agent.js'), `--scope=${scope}`, `--agent=${agent}`], {
    cwd: ROOT, stdio: 'inherit',
  }).on('exit', code => process.exit(code ?? 0));
};

main().catch(err => {
  console.error(red(`\n  Error: ${err.message}\n`));
  rl.close();
  process.exit(1);
});

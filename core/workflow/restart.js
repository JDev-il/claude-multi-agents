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

const AGENTS = {
  client:  ['UI', 'LOGIC', 'FORMS', 'ROUTING', 'TESTING', 'ACCESSIBILITY'],
  backend: ['INIT', 'API', 'LOGIC', 'AUTH', 'DB', 'TESTING', 'EVENTS', 'JOBS'],
  shared:  ['SECURITY'],
};

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
      if (!data?.branch && data?.status !== 'COMPLETED') continue;
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

  // Append available (not yet started) agents
  for (const scope of ['client', 'backend', 'shared']) {
    for (const agent of (AGENTS[scope] || [])) {
      if (candidates.find(c => c.scope === scope && c.agent === agent)) continue;
      candidates.push({ scope, agent, branch: null, worktreePath: null, status: 'AVAILABLE' });
    }
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
const readTrackingFresh = () => {
  try {
    return fs.existsSync(TRACKING_PATH)
      ? JSON.parse(fs.readFileSync(TRACKING_PATH, 'utf8'))
      : {};
  } catch { return {}; }
};

const wipeTrackingSlot = (scope, agent) => {
  const fresh = readTrackingFresh();
  if (!fresh[scope]) fresh[scope] = {};
  fresh[scope][agent] = { branch: null, timestamp: null, launchedAt: null, status: null, missingCount: 0, worktreePath: null };
  fs.writeFileSync(TRACKING_PATH, JSON.stringify(fresh, null, 2), 'utf8');
};

const wipeAgent = ({ scope, agent, branch, worktreePath }) => {
  try { execSync(`git worktree remove "${worktreePath}" --force`, { cwd: ROOT, stdio: 'pipe' }); } catch (e) { console.log(yellow(`  ! worktree remove failed for ${agent}: ${(e.stderr || e.message || '').toString().trim()}`)); }
  try { execSync(`git branch -D ${branch}`, { cwd: ROOT, stdio: 'pipe' }); } catch (e) { console.log(yellow(`  ! local branch delete failed for ${branch}: ${(e.stderr || e.message || '').toString().trim()}`)); }
  try { execSync(`git push origin --delete ${branch}`, { cwd: ROOT, stdio: 'pipe' }); } catch (e) { console.log(yellow(`  ! remote branch delete failed for ${branch}: ${(e.stderr || e.message || '').toString().trim()}`)); }

  // If scope folder has agent-built content on main, remove it so new branch starts clean
  // Use filesystem truth, not tracking status (tracking may already be cleared by prior restart)
  const scopeDir = require('path').join(ROOT, scope);
  if (fs.existsSync(scopeDir)) {
    const scopeContents = fs.readdirSync(scopeDir).filter(f => f !== 'CLAUDE.md');
    if (scopeContents.length > 0) {
      try {
        for (const entry of scopeContents) {
          fs.rmSync(require('path').join(scopeDir, entry), { recursive: true, force: true });
        }
      } catch {}
    }
  }
  // Always ensure scope CLAUDE.md exists - restore from CLI templates if missing or folder gone
  try {
    const claudePath = require('path').join(scopeDir, 'CLAUDE.md');
    if (!fs.existsSync(claudePath)) {
      const globalPkg = require('child_process').execSync('npm root -g', { stdio: 'pipe', encoding: 'utf8' }).trim();
      const tmplPath = require('path').join(globalPkg, 'multi-agents-cli', 'core', 'templates', scope, 'CLAUDE.md');
      if (fs.existsSync(tmplPath)) {
        fs.mkdirSync(scopeDir, { recursive: true });
        fs.copyFileSync(tmplPath, claudePath);
        // Substitute @config values from .config.json (primary) or git history (secondary)
        try {
          let restored = fs.readFileSync(claudePath, 'utf8');
          const scopeCfg = config[scope] || {};
          const configMap = {
            PROJECT_NAME:      config.projectName,
            FRAMEWORK:         scopeCfg.framework,
            FRAMEWORK_VERSION: scopeCfg.frameworkVersion,
            LANGUAGE:          scopeCfg.language,
            UI_LIBRARY:        scopeCfg.uiLibrary,
            STATE:             scopeCfg.state,
            STYLING:           scopeCfg.styling,
            ORM:               scopeCfg.orm,
            AUTH:              scopeCfg.auth,
          };
          for (const [key, val] of Object.entries(configMap)) {
            if (val) restored = restored.replace(
              new RegExp(`(# @config ${key}\\s*:).*$`, 'm'), `$1 ${val}`
            );
          }
          // Secondary: git history fallback if config values still missing
          try {
            const firstCommit = require('child_process').execSync(
              `git log --all --reverse --format=%H -- ${scope}/CLAUDE.md`,
              { cwd: ROOT, stdio: 'pipe', encoding: 'utf8' }
            ).trim().split('\n')[0];
            if (firstCommit) {
              const oldContent = require('child_process').execSync(
                `git show ${firstCommit}:${scope}/CLAUDE.md`,
                { cwd: ROOT, stdio: 'pipe', encoding: 'utf8' }
              );
              for (const line of oldContent.split('\n').filter(l => /^# @config \w/.test(l))) {
                const m = line.match(/^# @config (\w+)\s*:\s*(.+)$/);
                if (m && !configMap[m[1].trim()]) {
                  restored = restored.replace(
                    new RegExp(`(# @config ${m[1].trim()}\\s*:).*$`, 'm'), `$1 ${m[2].trim()}`
                  );
                }
              }
            }
          } catch {}
          fs.writeFileSync(claudePath, restored, 'utf8');
        } catch {}
      }
    }
  } catch {}
  // Commit any scope changes to main
  try {
    require('child_process').execSync('git add -A', { cwd: ROOT, stdio: 'pipe' });
    require('child_process').execSync(
      `git commit --no-gpg-sign --no-verify -m "chore: remove ${scope} scope content for restart"`,
      { cwd: ROOT, stdio: 'pipe' }
    );
  } catch (e) { console.log(yellow(`  ! commit of scope removal failed for ${scope}/${agent}: ${(e.stderr || e.message || '').toString().trim()}`)); }

  wipeTrackingSlot(scope, agent);
  console.log(`  ${green('✓')} ${agent} wiped`);
};

// ── Main ──────────────────────────────────────────────────────────────────────
const main = async () => {
  console.log('\n');
  console.log(bold(cyan('  Multi-Agent Monorepo Template')));
  console.log(dim(`  Agent Restarter - ${config.projectName}\n`));
  sep();

  const candidates = buildCandidates();

  const activeCandidates = candidates.filter(c => c.status !== 'AVAILABLE');
  if (activeCandidates.length === 0 && candidates.length === 0) {
    console.log(yellow('\n  No agents found.\n'));
    rl.close(); process.exit(0);
  }

  // ── Detect location ───────────────────────────────────────────────────────
  let candidate = detectCurrentAgent(candidates);

  if (!candidate) {
    sep();
    console.log(`\n${bold('* Select agent to restart:')}\n`);
    const idx = await arrowSelect('Select agent', [
      ...candidates.map(c => ({
        label: c.status === 'AVAILABLE'
          ? `${dim(c.agent)} ${dim(`(${c.scope})`)}  ${dim('not started')}`
          : c.status === 'COMPLETED'
          ? `${dim(c.agent)} ${dim(`(${c.scope})`)}  ${green('✓ completed')}`
          : `${bold(c.agent)} ${dim(`(${c.scope})`)}  ${dim(c.branch)}  ${c.status === 'UNTRACKED' ? yellow('untracked') : dim(c.status)}`,
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
  const activeDeps  = deps.filter(dep => readTrackingFresh()[scope]?.[dep]?.branch);

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

  const preWipeTracking = readTrackingFresh();
  const depsToWipe = isInitAgent
    ? deps
    : deps.filter(dep => preWipeTracking[scope]?.[dep]?.branch);
  for (const dep of depsToWipe) {
    const d  = preWipeTracking[scope]?.[dep];
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

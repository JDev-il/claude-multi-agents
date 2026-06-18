#!/usr/bin/env node

/**
 * multi-agents-cli — Project Initializer
 * Run with: multi-agents init <project-name>
 *           npm run init  (inside existing project)
 * Runs once. Locked after completion via .scaffold/.initialized
 */

'use strict';

const fs              = require('fs');
const path            = require('path');
const os              = require('os');
const { execSync, spawn } = require('child_process');

// ── Modules ───────────────────────────────────────────────────────────────────

const {
  c, bold, green, yellow, dim, cyan, blue, red,
  rl, ask,
  arrowSelect, arrowConfirm,
  selectRequired, selectOptional,
  separator, showList, summaryLine, renderTrajectoryLines,
} = require('./lib/ui');

const {
  FRAMEWORK_CONVENTIONS,
  CLIENT_FRAMEWORKS,
  BACKEND_FRAMEWORKS,
  FRAMEWORK_VERSION_FALLBACK,
  fetchLatestVersions,
  STATE_OPTIONS,
  UI_OPTIONS,
  STYLING_OPTIONS,
  DB_OPTIONS,
  ORM_OPTIONS_BY_DB,
  ORM_OPTIONS,
  AUTH_OPTIONS,
  IDE_CANDIDATES,
} = require('./lib/questions');

const {
  expandWinPath,
  buildIDEOptions,
  verifyIDE,
  detectTerminal,
} = require('./lib/detect');

const {
  writeConfig,
  ensureGitignore,
  copyDir,
  generateTrackingStructure,
  setupUserRemote,
} = require('./lib/writers');

const {
  TRAJECTORY_DETAILS,
  renderTrajectoryLines: renderTraj,
  printInitSummary,
} = require('./lib/summary');

const { StepMachine, BACK, CONTINUE, RESTART } = require('./lib/steps');

// ── Prompts ───────────────────────────────────────────────────────────────────

let prompts;
try { prompts = require('prompts'); } catch { prompts = null; }

// ── CLI argument handling ─────────────────────────────────────────────────────

const args        = process.argv.slice(2);
const isGlobalCLI = args[0] === 'init' && args[1];
const isReInit    = args[0] === 'init' && !args[1];
const projectArg  = isGlobalCLI ? args[1] : null;

if (isReInit) {
  try {
    const gitCommonDir = execSync('git rev-parse --git-common-dir', { encoding: 'utf8' }).trim();
    const repoRoot = path.resolve(gitCommonDir, '..');
    process.chdir(repoRoot);
  } catch { /* stay in current directory */ }
}

if (isGlobalCLI) {
  const targetDir = path.resolve(process.cwd(), projectArg);

  if (fs.existsSync(targetDir)) {
    process.chdir(targetDir);
  } else {
    fs.mkdirSync(targetDir, { recursive: true });
    process.chdir(targetDir);

    fs.writeFileSync(
      path.join(targetDir, 'package.json'),
      JSON.stringify({ name: path.basename(targetDir), version: '1.0.0', scripts: { init: 'multi-agents init' } }, null, 2),
      'utf8'
    );

    try {
      execSync('git init -b main', { cwd: targetDir, stdio: 'pipe' });
      execSync('git commit --allow-empty -m "init: project created"', { cwd: targetDir, stdio: 'pipe' });
    } catch {
      try {
        execSync('git init', { cwd: targetDir, stdio: 'pipe' });
        execSync('git checkout -b main', { cwd: targetDir, stdio: 'pipe' });
        execSync('git commit --allow-empty -m "init: project created"', { cwd: targetDir, stdio: 'pipe' });
      } catch { /* continue */ }
    }
  }
}

// ── Paths ─────────────────────────────────────────────────────────────────────

const ROOT        = process.cwd();
const RUNTIME_DIR = path.join(ROOT, '.scaffold');
const LOCK_FILE   = path.join(RUNTIME_DIR, '.initialized');

// Ensure .scaffold/ exists
fs.mkdirSync(RUNTIME_DIR, { recursive: true });

// ── Helpers ───────────────────────────────────────────────────────────────────

const copyDirExcluding = (src, dest, exclude = []) => {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    if (exclude.includes(entry)) continue;
    const srcFile  = path.join(src, entry);
    const destFile = path.join(dest, entry);
    if (fs.statSync(srcFile).isDirectory()) copyDirExcluding(srcFile, destFile, []);
    else fs.copyFileSync(srcFile, destFile);
  }
};

// ── Main ──────────────────────────────────────────────────────────────────────

const main = async () => {

  // ── Lock check ───────────────────────────────────────────────────────────────

  if (fs.existsSync(LOCK_FILE)) {
    const ts = fs.readFileSync(LOCK_FILE, 'utf8').trim();
    const trackingPath = path.join(RUNTIME_DIR, '.tracking.json');
    const tracking = fs.existsSync(trackingPath) ? JSON.parse(fs.readFileSync(trackingPath, 'utf8')) : {};

    const DEPENDENCIES = {
      client:  { UI: ['LOGIC', 'FORMS', 'ROUTING', 'TESTING', 'ACCESSIBILITY'] },
      backend: { DB: ['API', 'AUTH', 'LOGIC', 'EVENTS', 'JOBS', 'TESTING'] },
      shared:  {},
    };

    const getActiveAgents = (scope) => {
      const agents = tracking[scope] || {};
      return Object.entries(agents).filter(([, v]) => v && v.branch);
    };

    const showRestartProcess = async () => {
      const active = [];
      for (const scope of ['client', 'backend', 'shared']) {
        for (const [agent, data] of getActiveAgents(scope)) {
          active.push({ scope, agent, data });
        }
      }

      if (active.length === 0) {
        console.log(yellow('\n  No active processes found. Nothing to restart.\n'));
        return 'empty';
      }

      separator();

      const pickRes = await prompts({
        type:    'select',
        name:    'value',
        message: 'Which process do you want to restart?',
        choices: [
          ...active.map(({ scope, agent, data }) => ({
            title: `${agent} (${scope}) - ${data.status || 'ACTIVE'}`,
            value: agent,
          })),
          { title: 'Back', value: '__back__' },
        ],
      }, { onCancel: () => process.exit(0) });

      if (!pickRes.value || pickRes.value === '__back__') return 'back';
      const idx = active.findIndex(a => a.agent === pickRes.value);
      if (idx < 0) return false;
      const { scope, agent, data } = active[idx];
      const deps = (DEPENDENCIES[scope] || {})[agent] || [];
      const affectedAgents = [{ scope, agent, data }];

      for (const dep of deps) {
        const depData = (tracking[scope] || {})[dep];
        if (depData && depData.branch) affectedAgents.push({ scope, agent: dep, data: depData });
      }

      separator();
      console.log(`\n${yellow(`  ⚠ Restarting ${agent} will delete:`)}`);
      for (const { agent: a, data: d } of affectedAgents) {
        console.log(`\n  ${bold(a)}`);
        console.log(`    - Branch        (${d.branch})`);
        console.log(`    - Remote branch (origin/${d.branch})`);
        if (d.worktreePath) console.log(`    - Worktree      (${path.relative(ROOT, d.worktreePath)})`);
      }

      if (affectedAgents.length > 1) console.log(`\n  ${yellow('Dependent processes will also be wiped.')}`);
      console.log(`\n  ${red('This cannot be undone.')}\n`);

      const confirmRes = await prompts({
        type:    'select',
        name:    'value',
        message: 'Confirm restart?',
        choices: [
          { title: 'Yes - wipe and restart', value: 'y' },
          { title: 'Cancel',                 value: 'n' },
        ],
      }, { onCancel: () => process.exit(0) });

      if (confirmRes.value !== 'y') { console.log(dim('\n  Cancelled.\n')); return 'back'; }

      for (const { agent: a, data: d, scope: s } of affectedAgents) {
        try { execSync(`git worktree remove "${d.worktreePath}" --force`, { cwd: ROOT, stdio: 'pipe' }); } catch {}
        try { execSync(`git branch -D ${d.branch}`, { cwd: ROOT, stdio: 'pipe' }); } catch {}
        try { execSync(`git push origin --delete ${d.branch}`, { cwd: ROOT, stdio: 'pipe' }); } catch {}
        if (tracking[s] && tracking[s][a]) {
          tracking[s][a] = { branch: null, timestamp: null, launchedAt: null, status: null, missingCount: 0, worktreePath: null };
        }
        console.log(`  ${green('✓')} ${a} wiped`);
      }

      fs.writeFileSync(trackingPath, JSON.stringify(tracking, null, 2), 'utf8');
      console.log(`\n  ${green('✓')} Restart complete.\n`);
      return 'done';
    };

    separator();
    console.log(`\n${yellow('  This project has already been initialized.')}`);
    console.log(dim(`  Initialized on: ${ts}\n`));
    console.log(dim('  To start a task:       ') + cyan('npm run agent'));
    console.log(dim('  To restart an agent:   ') + cyan('npm run restart'));
    console.log(dim('  To wipe everything:    ') + cyan('npm run reset') + '\n');

    if (prompts && process.stdin.isTTY) {
      const res = await prompts({
        type:    'select',
        name:    'value',
        message: 'What would you like to do?',
        choices: [
          { title: 'Re-initialize project', description: 'Wipe everything and start fresh', value: '1' },
          { title: 'Cancel',                                                                  value: '2' },
        ],
      }, { onCancel: () => process.exit(0) });

      if (res.value === '1') {
        separator();
        console.log(yellow('  ⚠ This will permanently delete the entire project.'));
        console.log(dim('  All branches, worktrees, files and git history will be removed.\n'));
        const confirm = await prompts({
          type:    'select',
          name:    'value',
          message: 'Are you sure?',
          choices: [
            { title: red('Yes - wipe everything and re-initialize'), value: 'yes' },
            { title: 'No - Cancel',                                  value: 'no'  },
          ],
        }, { onCancel: () => process.exit(0) });
        if (confirm.value !== 'yes') { console.log(dim('\n  Cancelled.\n')); process.exit(0); }
        const resetChild = spawn('node', [path.join(ROOT, '.workflow', 'reset.js')], { stdio: 'inherit', cwd: ROOT });
        resetChild.on('exit', code => process.exit(code ?? 0));
        return;
      } else {
        console.log(dim('\n  Cancelled.\n'));
        process.exit(0);
      }
    }
  }

  console.log('\n');
  console.log(bold(cyan('  Multi-Agent Monorepo Template')));
  console.log(dim('  Project Initializer\n'));
  separator();

  console.log(`\n${bold("Let's configure your project.")}`);
  console.log(dim('  Use arrow keys to select. Optional fields can be skipped.\n'));
  console.log(dim('  Skipped fields will be resolved by the agent when first needed.\n'));

  // ── Step machine ─────────────────────────────────────────────────────────────

  const steps = new StepMachine();

  // ── Project name (step 1) ─────────────────────────────────────────────────────

  let projectName = '';
  while (!projectName) {
    projectName = await ask(`${bold('* Project name')}: `);
    if (!projectName) console.log(yellow('  Project name is required. Please enter a name.'));
  }
  steps.push(0, 'Project name', projectName);

  separator();

  // ── Questions loop ────────────────────────────────────────────────────────────

  let stepIdx = 1;

  // Step 1: Client framework
  console.log(`\n${bold(blue('Client configuration'))}`);
  let clientFw = await selectRequired('* Client framework (required):', CLIENT_FRAMEWORKS, steps, stepIdx);
  if (clientFw === RESTART) { rl.close(); spawn('node', [__filename], { stdio: 'inherit', cwd: ROOT }).on('exit', c => process.exit(c)); return; }
  steps.push(stepIdx++, 'Client framework', clientFw);

  // Step 2: Client framework version
  let clientFwVersion = null;
  const clientVersions = await fetchLatestVersions(clientFw.value) || FRAMEWORK_VERSION_FALLBACK[clientFw.value] || [];
  if (clientVersions.length) {
    console.log(dim('  Fetching latest versions...'));
    const versionChoices = clientVersions.map((v, i) => ({
      label: i === 0 ? `v${v}  ${dim('(latest)')}` : `v${v}`,
      value: v,
    }));
    const versionLabel = clientFw.value === 'Vite+React' ? '* Vite version:' : `* ${clientFw.value} version:`;
    const vIdx = await arrowSelect(versionLabel, [
      ...versionChoices,
      ...steps.navOptions(stepIdx, false).map(n => ({ label: n.label })),
    ]);
    if (vIdx < clientVersions.length) {
      clientFwVersion = clientVersions[vIdx];
      steps.push(stepIdx++, 'Client version', clientFwVersion);
    } else {
      rl.close(); spawn('node', [__filename], { stdio: 'inherit', cwd: ROOT }).on('exit', c => process.exit(c)); return;
    }
  }

  const clientLang = clientFw.language;

  // Step 3: State management
  let clientState = await selectOptional('State management:', STATE_OPTIONS[clientFw.value] || [], steps, stepIdx);
  if (clientState === RESTART) { rl.close(); spawn('node', [__filename], { stdio: 'inherit', cwd: ROOT }).on('exit', c => process.exit(c)); return; }
  steps.push(stepIdx++, 'State management', clientState);

  // Step 4: UI library
  let clientUi = await selectOptional('UI library:', UI_OPTIONS[clientFw.value] || [], steps, stepIdx);
  if (clientUi === RESTART) { rl.close(); spawn('node', [__filename], { stdio: 'inherit', cwd: ROOT }).on('exit', c => process.exit(c)); return; }
  steps.push(stepIdx++, 'UI library', clientUi);

  // Step 5: Styling
  let clientStyle = await selectOptional('Styling:', STYLING_OPTIONS, steps, stepIdx);
  if (clientStyle === RESTART) { rl.close(); spawn('node', [__filename], { stdio: 'inherit', cwd: ROOT }).on('exit', c => process.exit(c)); return; }
  steps.push(stepIdx++, 'Styling', clientStyle);

  separator();

  // ── Backend ──────────────────────────────────────────────────────────────────

  console.log(`\n${bold(blue('Backend configuration'))}`);

  let useIntegratedBackend = false;
  let backendFw    = null;
  let backendLang  = null;
  let backendOrm   = null;
  let backendAuth  = null;
  let backendType  = null;
  let backendFwObj = null;

  if (clientFw.integratedBackend) {
    console.log(dim(`  ${clientFw.value} supports server-side rendering and API routes.\n`));
    useIntegratedBackend = await arrowConfirm(`Use integrated backend (${clientFw.value} API routes/SSR) instead of a separate backend?`);

    if (useIntegratedBackend) {
      backendType = 'integrated';
      console.log(dim(`\n  Using ${clientFw.value} integrated backend. No separate backend needed.\n`));
    }
  }

  if (!useIntegratedBackend) {
    console.log(dim('  You can skip the backend framework and decide later.\n'));

    const backendChoices = [
      ...BACKEND_FRAMEWORKS.map(f => ({ label: f.label || f.value })),
      { label: dim('Skip (decide later)') },
    ];
    const backendIdx = await arrowSelect('Backend framework:', backendChoices);
    backendFwObj = backendIdx === BACKEND_FRAMEWORKS.length ? null : BACKEND_FRAMEWORKS[backendIdx];
    backendFw    = backendFwObj ? backendFwObj.value    : null;
    backendLang  = backendFwObj ? backendFwObj.language : null;
    steps.push(stepIdx++, 'Backend framework', backendFw);

    if (backendFw) {
      const backendVersions = await fetchLatestVersions(backendFw) || FRAMEWORK_VERSION_FALLBACK[backendFw] || [];
      if (backendVersions.length) {
        const vChoices = backendVersions.map((v, i) => ({
          label: i === 0 ? `v${v}  ${dim('(latest)')}` : `v${v}`,
          value: v,
        }));
        const vIdx = await arrowSelect(`* ${backendFw} version:`, [
          ...vChoices,
          ...steps.navOptions(stepIdx, false).map(n => ({ label: n.label })),
        ]);
        if (vIdx < backendVersions.length) {
          backendFwObj = { ...backendFwObj, version: backendVersions[vIdx] };
          steps.push(stepIdx++, 'Backend version', backendVersions[vIdx]);
        }
      }
    }

    let backendDb = null;
    if (backendFw) {
      backendDb = await selectOptional('Database type:', DB_OPTIONS, steps, stepIdx);
      if (backendDb === RESTART) { rl.close(); spawn('node', [__filename], { stdio: 'inherit', cwd: ROOT }).on('exit', c => process.exit(c)); return; }
      steps.push(stepIdx++, 'Database', backendDb);
    }

    if (backendFw && backendDb && backendDb !== 'Skip (agent will propose when needed)') {
      const ormChoices = ORM_OPTIONS_BY_DB[backendDb] || ORM_OPTIONS[backendFw] || [];
      backendOrm = await selectOptional('ORM / query layer:', ormChoices, steps, stepIdx);
      if (backendOrm === RESTART) { rl.close(); spawn('node', [__filename], { stdio: 'inherit', cwd: ROOT }).on('exit', c => process.exit(c)); return; }
      steps.push(stepIdx++, 'ORM', backendOrm);
    }

    backendAuth = backendFw ? await selectOptional('Auth strategy:', AUTH_OPTIONS[backendFw] || [], steps, stepIdx) : null;
    if (backendAuth === RESTART) { rl.close(); spawn('node', [__filename], { stdio: 'inherit', cwd: ROOT }).on('exit', c => process.exit(c)); return; }
    steps.push(stepIdx++, 'Auth', backendAuth);
    backendType = backendFw ? 'separate' : null;
  }

  separator();

  // ── IDE ───────────────────────────────────────────────────────────────────────

  console.log(`\n${bold(blue('Environment'))}`);

  const osName = { darwin: 'macOS', win32: 'Windows', linux: 'Linux' }[process.platform] || process.platform;
  console.log(`\n  ${dim('OS detected:')} ${bold(osName)}`);
  console.log(dim('  Scanning for installed IDEs...\n'));

  const ideOptions    = buildIDEOptions(IDE_CANDIDATES);
  const detectedIDEs  = ideOptions.filter(o => o.detected);
  const undetectedIDEs = ideOptions.filter(o => !o.detected && o.cmd);
  const manualOption  = ideOptions.filter(o => !o.cmd);
  const sortedIdeOptions = [...detectedIDEs, ...undetectedIDEs, ...manualOption];

  if (detectedIDEs.length > 1)     console.log(`\n  ${yellow('Multiple IDEs found on this machine')} — select your preference:\n`);
  else if (detectedIDEs.length === 1) console.log(`\n  ${green('1 IDE found:')} ${bold(detectedIDEs[0].name)}\n`);
  else                              console.log(`\n  ${yellow('No IDEs detected on this machine.')}\n`);

  let ideChoice;
  while (true) {
    ideChoice = await selectRequired('* IDE / editor (required):', sortedIdeOptions, steps, stepIdx);
    if (ideChoice === RESTART) { rl.close(); spawn('node', [__filename], { stdio: 'inherit', cwd: ROOT }).on('exit', c => process.exit(c)); return; }

    if (ideChoice.cmd && !ideChoice.detected) {
      console.log(`\n  ${yellow('⚠')} ${bold(ideChoice.name)} was not detected on this machine.`);
      console.log(dim('  It may not open automatically when launching a task.\n'));
      if (!await arrowConfirm('Continue with this IDE anyway?')) { console.log(dim('  Re-selecting...\n')); continue; }
    }

    if (!ideChoice.cmd) { console.log(dim('  Manual mode — worktree path will be printed at launch.')); break; }

    console.log(dim(`\n  Verifying ${ideChoice.name}...`));
    const verified = verifyIDE(ideChoice);
    if (verified.ok) {
      const versionStr = verified.version ? dim(` (${verified.version})`) : '';
      console.log(`  ${green('✓')} ${ideChoice.name} confirmed${versionStr}`);
      break;
    }

    console.log(`  ${yellow('!')} Could not verify ${ideChoice.name}. The CLI may not be installed or accessible.`);
    if (await arrowConfirm('Continue with this IDE anyway?')) break;
    console.log(dim('  Re-selecting...\n'));
  }
  steps.push(stepIdx++, 'IDE', ideChoice.name);

  // ── Terminal detection ────────────────────────────────────────────────────────

  const termChoice = detectTerminal();
  console.log(dim('  Terminal detected: ') + green(termChoice.name));

  separator();

  // ── Summary ───────────────────────────────────────────────────────────────────

  console.log(`\n${bold('Review your configuration:')}\n`);
  summaryLine('Project',           projectName);
  summaryLine('Client framework',  clientFw.value);
  summaryLine('Client language',   clientLang);
  summaryLine('State management',  clientState);
  summaryLine('UI library',        clientUi);
  summaryLine('Styling',           clientStyle);
  summaryLine('Backend type',      backendType === 'integrated' ? `${clientFw.value} integrated` : backendFw || '(skipped)');
  if (backendType !== 'integrated') {
    summaryLine('Backend language',  backendLang);
    summaryLine('ORM',               backendOrm);
    summaryLine('Auth',              backendAuth);
  }
  summaryLine('IDE / Editor',      ideChoice.name);

  console.log('');
  console.log(dim('  y = confirm  |  n = abort  |  e = edit (start over)\n'));

  const confirmIdx = await arrowSelect('Confirm and write to config files?', [
    { label: `${green('✓')} Confirm — write config and set up project` },
    { label: `${yellow('↺')} Restart — redo configuration` },
    { label: `${red('✗')} Abort` },
  ]);

  if (confirmIdx === 1) {
    console.log(yellow('\n  Restarting configuration...\n'));
    rl.close();
    spawn('node', [__filename], { stdio: 'inherit', cwd: ROOT }).on('exit', c => process.exit(c));
    return;
  }

  if (confirmIdx === 2) {
    console.log(yellow('\n  Aborted. No files were changed.\n'));
    rl.close();
    return;
  }

  // ── Write configs ─────────────────────────────────────────────────────────────

  separator();
  console.log(`\n${bold('Setting up your project...')}\n`);

  const CORE_DIR  = path.join(__dirname, 'core');
  const TEMPLATES = path.join(CORE_DIR, 'templates');

  console.log(`  ${green('✓')} Templates ready`);

  copyDirExcluding(path.join(TEMPLATES, 'client'), path.join(ROOT, 'client'), ['agents', 'frameworks']);
  if (fs.existsSync(path.join(TEMPLATES, 'shared')))
    copyDirExcluding(path.join(TEMPLATES, 'shared'), path.join(ROOT, 'shared'), ['agents', 'frameworks']);
  if (backendType === 'separate') {
    copyDirExcluding(path.join(TEMPLATES, 'backend'), path.join(ROOT, 'backend'), ['agents', 'frameworks']);
    fs.writeFileSync(path.join(ROOT, 'backend', '.gitkeep'), '', 'utf8');
  }

  copyDir(path.join(TEMPLATES, '.agents',     'client'),  path.join(ROOT, '.agents',     'client'));
  copyDir(path.join(TEMPLATES, '.frameworks', 'client'),  path.join(ROOT, '.frameworks', 'client'));
  copyDir(path.join(TEMPLATES, '.agents',     'shared'),  path.join(ROOT, '.agents',     'shared'));
  if (backendType === 'separate') {
    copyDir(path.join(TEMPLATES, '.agents',     'backend'), path.join(ROOT, '.agents',     'backend'));
    copyDir(path.join(TEMPLATES, '.frameworks', 'backend'), path.join(ROOT, '.frameworks', 'backend'));
  }

  fs.copyFileSync(path.join(TEMPLATES, 'CLAUDE.md'),        path.join(ROOT, 'CLAUDE.md'));
  fs.copyFileSync(path.join(TEMPLATES, 'CONTRACTS.md'),     path.join(ROOT, 'CONTRACTS.md'));
  fs.copyFileSync(path.join(TEMPLATES, 'TASKS_HISTORY.md'), path.join(ROOT, 'TASKS_HISTORY.md'));
  fs.copyFileSync(path.join(TEMPLATES, 'CLOUD_STATE.md'),   path.join(ROOT, 'CLOUD_STATE.md'));
  console.log(`  ${green('✓')} Templates copied`);

  const WORKFLOW_SRC  = path.join(CORE_DIR, 'workflow');
  const WORKFLOW_DEST = path.join(ROOT, '.workflow');
  fs.mkdirSync(WORKFLOW_DEST, { recursive: true });
  copyDir(WORKFLOW_SRC, WORKFLOW_DEST);
  console.log(`  ${green('✓')} Workflow scripts copied (.workflow/)`);

  writeConfig(path.join(ROOT, 'CLAUDE.md'), { PROJECT_NAME: projectName, PROJECT_ROOT: projectName });
  console.log(`  ${green('✓')} CLAUDE.md configured`);

  writeConfig(path.join(ROOT, 'client', 'CLAUDE.md'), {
    PROJECT_NAME:      projectName,
    FRAMEWORK:         clientFw.value,
    FRAMEWORK_VERSION: clientFwVersion || '',
    LANGUAGE:          clientLang,
    STATE:             clientState,
    UI_LIBRARY:        clientUi,
    STYLING:           clientStyle,
  });
  console.log(`  ${green('✓')} client/CLAUDE.md configured`);

  if (backendType === 'separate') {
    writeConfig(path.join(ROOT, 'backend', 'CLAUDE.md'), {
      PROJECT_NAME:      projectName,
      FRAMEWORK:         backendFw,
      FRAMEWORK_VERSION: backendFwObj?.version || '',
      LANGUAGE:          backendLang,
      ORM:               backendOrm,
      AUTH:              backendAuth,
    });
    console.log(`  ${green('✓')} backend/CLAUDE.md configured`);
  }

  ensureGitignore(ROOT, 'worktrees/');
  ensureGitignore(ROOT, '.scaffold/');
  ensureGitignore(ROOT, '.workflow/');
  ensureGitignore(ROOT, 'node_modules/');

  const gitignorePath = path.join(ROOT, '.gitignore');
  let gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
  ['client/', 'backend/', 'shared/', 'CLAUDE.md', 'CONTRACTS.md', 'BUILD_STATE.md', 'TASKS_HISTORY.md', 'CLOUD_STATE.md'].forEach(entry => {
    gitignoreContent = gitignoreContent.replace(`\n${entry}`, '').replace(`${entry}\n`, '').replace(entry, '');
  });
  fs.writeFileSync(gitignorePath, gitignoreContent.trim() + '\n', 'utf8');
  console.log(`  ${green('✓')} .gitignore updated`);

  // ── .config.json ─────────────────────────────────────────────────────────────

  const config = {
    projectName,
    ide: {
      name:       ideChoice.name,
      strategy:   ideChoice.strategy,
      cmd:        ideChoice.cmd    || null,
      app:        ideChoice.mac?.app  || null,
      openArgs:   process.platform === 'darwin' ? (ideChoice.mac?.args  || [])
                : process.platform === 'win32'  ? (ideChoice.win?.args  || [])
                :                                 (ideChoice.linux?.args || []),
      winPaths:   (ideChoice.win?.paths  || []).map(expandWinPath),
      linuxPaths: ideChoice.linux?.paths || [],
    },
    client: {
      framework: clientFw.value,
      language:  clientLang,
      state:     clientState,
      uiLibrary: clientUi,
      styling:   clientStyle,
    },
    backend: {
      type:      backendType,
      framework: backendFw,
      language:  backendLang,
      orm:       backendOrm,
      auth:      backendAuth,
    },
    terminal: {
      name: termChoice.name,
      cmd:  termChoice.cmd,
    },
    scaffolded: {
      client:  false,
      backend: false,
    },
  };

  fs.writeFileSync(path.join(RUNTIME_DIR, '.config.json'), JSON.stringify(config, null, 2), 'utf8');
  console.log(`  ${green('✓')} .scaffold/.config.json written`);

  // ── scope-policy.json ─────────────────────────────────────────────────────────

  const scopePolicy = {
    client: {
      allowed: ['client/**'],
      blocked: ['backend/**', 'shared/**', 'CONTRACTS.md', 'BUILD_STATE.md', 'TASKS_HISTORY.md'],
      agentOverrides: {
        UI: { allowed: ['client/**', 'shared/wiring.config.json'], onlyBeforeScaffolded: true },
      },
    },
    backend: {
      allowed: ['backend/**'],
      blocked: ['client/**', 'shared/**', 'CONTRACTS.md', 'BUILD_STATE.md', 'TASKS_HISTORY.md'],
      agentOverrides: {
        INIT: { allowed: ['backend/**', 'shared/wiring.config.json', 'CONTRACTS.md'], onlyBeforeScaffolded: true },
      },
    },
    shared: {
      allowed: ['CLOUD_STATE.md', 'CLOUD.md', 'CLOUD_TEARDOWN.md', '.github/**', 'docker-compose*.yml', 'Dockerfile', '**/.env.example'],
      blocked: ['client/**', 'backend/**', 'CONTRACTS.md', 'BUILD_STATE.md', 'TASKS_HISTORY.md'],
    },
  };

  fs.writeFileSync(path.join(RUNTIME_DIR, 'scope-policy.json'), JSON.stringify(scopePolicy, null, 2), 'utf8');
  console.log(`  ${green('✓')} .scaffold/scope-policy.json written`);

  // ── BUILD_STATE.md ────────────────────────────────────────────────────────────

  const backendDisplay = backendType === 'integrated'
    ? `${clientFw.value} integrated (API routes/SSR)`
    : backendFw || 'Not configured';

  const clientStack = [clientFw.value, clientLang, clientStyle, clientUi, clientState].filter(Boolean).join(' + ');
  const backendStack = backendType === 'separate'
    ? [backendFw, backendLang, backendOrm, backendAuth].filter(Boolean).join(' + ')
    : backendDisplay;

  const buildState = `# BUILD_STATE.md
# Living project state. Read before every task. Update after completion.
# Every agent must read this file at session start.

## Project
Name      : ${projectName}
Initialized : ${new Date().toISOString()}

## Stack
Client  : ${clientStack}
Backend : ${backendStack}

## Client State
- [ ] Scaffold - framework initialized
- [ ] UI - components and layout
- [ ] LOGIC - state management and API client
- [ ] FORMS - form architecture
- [ ] ROUTING - route definitions
- [ ] TESTING - test suite
- [ ] ACCESSIBILITY - a11y compliance

## Backend State
${backendType === 'integrated'
  ? `Type: ${clientFw.value} integrated backend (API routes / SSR)
- [ ] API routes - server-side endpoints
- [ ] Auth - authentication strategy
- [ ] DB - data layer if needed`
  : backendType === 'separate'
  ? `Type: Separate backend (${backendFw})
- [ ] Scaffold - framework initialized
- [ ] DB - schema and entities
- [ ] API - endpoints and DTOs
- [ ] AUTH - authentication strategy
- [ ] LOGIC - business rules
- [ ] EVENTS - webhooks and queues
- [ ] JOBS - background tasks`
  : 'Not configured - run node .workflow/agent.js and select backend when ready'}

## Shared
- [ ] CONTRACTS.md - no shared types defined yet

## Dependency Rules
Before starting any task, verify:
- Client LOGIC requires: Client scaffold done
- Client FORMS requires: Client scaffold done
- Client ROUTING requires: Client scaffold done
- API calls in client require: Backend API endpoints done OR mocked
- Backend API requires: DB schema done (if using DB)
- Backend AUTH requires: DB User entity done
- Any cross-boundary types: Must exist in CONTRACTS.md first

## Agent Log
| Date | Agent | Scope | Task | Status | Branch |
|------|-------|-------|------|--------|--------|
`;

  fs.writeFileSync(path.join(ROOT, 'BUILD_STATE.md'), buildState, 'utf8');
  console.log(`  ${green('✓')} BUILD_STATE.md generated`);

  // ── package.json ──────────────────────────────────────────────────────────────

  const userPackage = {
    name:    projectName.toLowerCase().replace(/\s+/g, '-'),
    version: '1.0.0',
    private: true,
    dependencies: { prompts: '^2.4.2' },
    scripts: {
      init:     'multi-agents init',
      agent:    'node .workflow/agent.js',
      restart:  'node .workflow/restart.js',
      reset:    'node .workflow/reset.js',
      complete: 'node .workflow/complete.js',
    },
  };
  fs.writeFileSync(path.join(ROOT, 'package.json'), JSON.stringify(userPackage, null, 2), 'utf8');
  console.log(`  ${green('✓')} package.json generated`);

  try {
    console.log(dim('  Installing dependencies...'));
    execSync('npm install', { cwd: ROOT, stdio: 'pipe' });
    console.log(`  ${green('✓')} Dependencies installed`);
  } catch {
    console.log(yellow('  ⚠ npm install failed — run npm install manually before launching'));
  }

  // ── Tracking ──────────────────────────────────────────────────────────────────

  const trackingPath = path.join(RUNTIME_DIR, '.tracking.json');
  if (!fs.existsSync(trackingPath)) {
    fs.writeFileSync(trackingPath, JSON.stringify(generateTrackingStructure(config), null, 2), 'utf8');
    console.log(`  ${green('✓')} .tracking.json generated`);
  } else {
    console.log(dim('  ℹ .tracking.json already exists — preserved'));
  }

  // ── .paths.json ───────────────────────────────────────────────────────────────

  const pathsMap = {};
  const clientConventions  = FRAMEWORK_CONVENTIONS.client[clientFw?.value]    || {};
  const backendConventions = FRAMEWORK_CONVENTIONS.backend[backendFwObj?.value] || {};

  if (Object.keys(clientConventions).length) {
    pathsMap.client = {};
    Object.entries(clientConventions).forEach(([key, value]) => {
      pathsMap.client[key] = { expected: value, current: null, status: 'pending' };
    });
  }
  if (Object.keys(backendConventions).length) {
    pathsMap.backend = {};
    Object.entries(backendConventions).forEach(([key, value]) => {
      pathsMap.backend[key] = { expected: value, current: null, status: 'pending' };
    });
  }

  fs.writeFileSync(path.join(RUNTIME_DIR, '.paths.json'), JSON.stringify(pathsMap, null, 2), 'utf8');
  console.log(`  ${green('✓')} .paths.json generated`);

  // ── Lock ──────────────────────────────────────────────────────────────────────

  fs.writeFileSync(LOCK_FILE, new Date().toISOString());
  console.log(`  ${green('✓')} Initialization locked`);

  // ── Auto-commit ───────────────────────────────────────────────────────────────

  try {
    execSync('git add .', { cwd: ROOT, stdio: 'pipe' });
    execSync('git commit -m "init: project configuration"', { cwd: ROOT, stdio: 'pipe' });
    console.log(`  ${green('✓')} Project configuration committed`);
  } catch {
    console.log(`  ${yellow('!')} Could not auto-commit. Run manually:`);
    console.log(dim('     git add . && git commit -m "init: project configuration"'));
  }

  // ── Pre-commit hook ───────────────────────────────────────────────────────────

  try {
    const hookPath   = path.join(ROOT, '.git', 'hooks', 'pre-commit');
    const hookScript = `#!/bin/sh
branch=$(git symbolic-ref --short HEAD 2>/dev/null)
if [ "$branch" = "main" ]; then
  echo ""
  echo "  ⚠ Direct commits to main are not allowed."
  echo "    Use npm run agent to start a task."
  echo ""
  exit 1
fi
`;
    if (!fs.existsSync(hookPath)) {
      fs.writeFileSync(hookPath, hookScript, { mode: 0o755 });
      console.log(dim('  ℹ Pre-commit hook installed — direct main commits blocked'));
    }
  } catch { /* best-effort */ }

  // ── Remote setup ──────────────────────────────────────────────────────────────

  setupUserRemote(ROOT, projectName);

  // ── Trajectory selection ──────────────────────────────────────────────────────

  separator();
  console.log(`\n${bold(green('  Project initialized successfully!'))}\n`);
  console.log(`  ${bold('How do you want to build?')}\n`);

  console.log(`  ${dim('1.')} ${bold('Multi-Agent Driven Orchestration')}`);
  console.log(dim('     · Every task should start with ') + cyan('npm run agent'));
  console.log(`${dim('     · Each agent runs in its own git worktree — an isolated branch')}`);
  console.log(dim('       and folder that merges back into main via ') + cyan('npm run complete'));
  console.log(`${dim('     · Faster builds and lower token spend than a single long session')}`);
  console.log(`${yellow('     ⚠ If you commit directly to main yourself, you bypass the framework')}`);
  console.log(`${yellow('       and break task tracking for any active agent branches')}\n`);

  console.log(`  ${dim('2.')} ${bold('Shared Orchestration')}`);
  console.log(`${dim('     · You and agents co-build — each owning a defined part of the codebase')}`);
  console.log(`${dim('     · Agent tasks run in git worktrees; your work happens directly in the project')}`);
  console.log(`${dim('     · Agent tasks are token-efficient; your tasks cost only what you prompt')}`);
  console.log(`${dim('     · Define boundaries before work begins — agents for well-scoped work,')}`);
  console.log(`${dim('       you for areas where requirements are still evolving')}`);
  console.log(`${yellow('     ⚠ If you and an agent touch the same file, expect merge conflicts')}\n`);

  let trajectory = null;
  trajectoryLoop: while (true) {
    const trajIdx = await arrowSelect('How do you want to build?', [
      { label: bold('Multi-Agent Driven Orchestration') },
      { label: bold('Shared Orchestration') },
    ]);
    trajectory = String(trajIdx + 1);

    const selected = TRAJECTORY_DETAILS[trajectory];
    separator();
    console.log(`\n  ${green('✓')} ${bold(selected.label)}\n`);
    renderTrajectoryLines(selected.full);
    console.log('');

    const confirmIdx2 = await arrowSelect('Confirm?', [
      { label: `${green('✓')} Confirm` },
      { label: `${yellow('←')} Back — pick differently` },
    ]);
    if (confirmIdx2 === 0) break trajectoryLoop;
    trajectory = null;
    separator();
    console.log(`\n  ${bold('How do you want to build?')}\n`);
    console.log(`  ${dim('1.')} ${bold('Multi-Agent Driven Orchestration')}`);
    console.log(dim('     · Every task should start with ') + cyan('npm run agent'));
    console.log(`${dim('     · Each agent runs in its own git worktree — an isolated branch')}`);
    console.log(dim('       and folder that merges back into main via ') + cyan('npm run complete'));
    console.log(`${dim('     · Faster builds and lower token spend than a single long session')}`);
    console.log(`${yellow('     ⚠ If you commit directly to main yourself, you bypass the framework')}`);
    console.log(`${yellow('       and break task tracking for any active agent branches')}\n`);
    console.log(`  ${dim('2.')} ${bold('Shared Orchestration')}`);
    console.log(`${dim('     · You and agents co-build — each owning a defined part of the codebase')}`);
    console.log(`${dim('     · Agent tasks run in git worktrees; your work happens directly in the project')}`);
    console.log(`${dim('     · Agent tasks are token-efficient; your tasks cost only what you prompt')}`);
    console.log(`${dim('     · Define boundaries before work begins — agents for well-scoped work,')}`);
    console.log(`${dim('       you for areas where requirements are still evolving')}`);
    console.log(`${yellow('     ⚠ If you and an agent touch the same file, expect merge conflicts')}\n`);
  }

  const selected = TRAJECTORY_DETAILS[trajectory];

  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(RUNTIME_DIR, '.config.json'), 'utf8'));
    cfg.trajectory = selected.label.toLowerCase().replace(/ /g, '-');
    fs.writeFileSync(path.join(RUNTIME_DIR, '.config.json'), JSON.stringify(cfg, null, 2), 'utf8');
  } catch { /* best-effort */ }

  if (selected.next === 'launch') {
    printInitSummary({ projectName, config, selectedLabel: selected.label, ROOT, rl });
    return;
  }

  console.log('');
  console.log(`  ${bold('When ready, run:')}`);
  console.log(`  ${cyan('npm run agent')}\n`);
  separator();
  console.log('');
  rl.close();
};

main().catch((err) => {
  console.error('\n  Error:', err.message);
  process.exit(1);
});

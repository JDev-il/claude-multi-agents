'use strict';

const fs           = require('fs');
const path         = require('path');
const { spawn }    = require('child_process');

// ── Colors (inline — avoid circular dep) ─────────────────────────────────────

const bold   = (s) => `\x1b[1m${s}\x1b[0m`;
const green  = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const dim    = (s) => `\x1b[2m${s}\x1b[0m`;
const cyan   = (s) => `\x1b[36m${s}\x1b[0m`;
const separator = () => console.log(`\n\x1b[2m${'─'.repeat(60)}\x1b[0m`);

// ── Trajectory details ────────────────────────────────────────────────────────

const TRAJECTORY_DETAILS = {
  '1': {
    label: 'Multi-Agent Driven Orchestration',
    full: [
      'Every task must start with npm run agent.',
      'Agent sessions load only task-relevant context, enabling reliable',
      'handoffs, predictable behavior, and efficient token usage.',
      '',
      '⚠ If you commit directly to main yourself, you bypass the framework',
      '  and break task tracking for any active agent branches.',
      '',
      'Benefits',
      '· Scoped context per task',
      '· Predictable token consumption',
      '· Lower cost than maintaining large, persistent sessions',
      '· Better isolation between parallel work streams',
    ],
    next: 'launch',
  },
  '2': {
    label: 'Shared Orchestration',
    full: [
      'You and agents work in the same codebase, each with clearly',
      'defined ownership. File boundaries must be established before',
      'work begins and remain fixed throughout the task.',
      'Agents excel when scope is well-defined;',
      'you excel when requirements are evolving.',
      '',
      'Use agents for',
      '· Multi-file features',
      '· Structured implementation work',
      '· Domain-specific tasks',
      '· Changes expected to exceed ~200 lines',
      '',
      'Handle manually',
      '· Targeted bug fixes',
      '· Configuration changes',
      '· Small refactors',
      '· Single-file edits under ~50 lines',
      '',
      '⚠ Avoid overlapping file ownership. Working on the same files',
      '  as an active agent will create merge conflicts when merged.',
      '⚠ If you are spending time repeatedly clarifying scope, stop',
      '  and do the task yourself. The coordination cost often',
      '  exceeds the implementation cost.',
      '',
      'Benefits',
      '· Maximum agent efficiency for well-defined work',
      '· Human flexibility where requirements change',
      '· Scales well across large projects',
      '· Most adaptable workflow — requires the most discipline',
    ],
    next: 'launch',
  },
};

// ── Render trajectory lines ───────────────────────────────────────────────────

const renderTrajectoryLines = (lines) => {
  const HEADERS = ['Benefits', 'Best for', 'Use agents for', 'Handle manually'];
  lines.forEach(l => {
    if (!l)                        { console.log(''); return; }
    if (l.startsWith('⚠'))        console.log(`  ${yellow(l)}`);
    else if (HEADERS.includes(l)) console.log(`\n  ${bold(l)}`);
    else if (l.startsWith('·'))   console.log(`  ${l}`);
    else                          console.log(`  ${dim(l)}`);
  });
};

// ── Init summary output ───────────────────────────────────────────────────────

const printInitSummary = ({ projectName, config, selectedLabel, ROOT, rl }) => {
  const bt = config.backend?.type;

  separator();
  console.log(`\n${bold(green('  Project initialized successfully!'))}\n`);

  console.log(`  ${dim('Project')}   : ${bold(projectName)}`);
  console.log(`  ${dim('Client')}    : ${config.client.framework} / ${config.client.language}${config.client.uiLibrary ? ' / ' + config.client.uiLibrary : ''}`);
  if (bt === 'separate') {
    console.log(`  ${dim('Backend')}   : ${config.backend.framework} / ${config.backend.language}${config.backend.orm ? ' / ' + config.backend.orm : ''}`);
  } else {
    console.log(`  ${dim('Backend')}   : integrated (API routes / SSR)`);
  }
  console.log(`  ${dim('Workflow')}  : ${selectedLabel}\n`);

  console.log(`  ${dim('Files generated:')}`);
  console.log(`  ${green('+')} CLAUDE.md, client/CLAUDE.md${bt === 'separate' ? ', backend/CLAUDE.md' : ''}`);
  console.log(`  ${green('+')} BUILD_STATE.md, TASKS_HISTORY.md, CONTRACTS.md`);
  console.log(`  ${green('+')} CLOUD_STATE.md, shared/wiring.config.json`);
  console.log(`  ${green('+')} .scaffold/.config.json, .scaffold/scope-policy.json`);
  console.log(`  ${green('+')} .agents/, .frameworks/, .workflow/\n`);

  console.log(`  ${dim('Git:')}`);
  console.log(`  ${green('+')} Repository initialized on main`);
  console.log(`  ${green('+')} Pre-commit hook installed (direct main commits blocked)`);
  console.log(`  ${green('+')} Initial commit created\n`);

  console.log(`  ${dim('Agents available:')}`);
  console.log(`  ${dim('client')}  : UI, LOGIC, FORMS, ROUTING, ACCESSIBILITY, TESTING`);
  if (bt === 'separate') {
    console.log(`  ${dim('backend')} : INIT, API, AUTH, DB, LOGIC, EVENTS, JOBS, TESTING`);
  }
  console.log(`  ${dim('shared')}  : CLOUD, SECURITY\n`);

  console.log(`  ${dim('Starting your first agent session...\n')}`);
  separator();
  console.log('');
  rl.close();

  const agentProc = spawn('npm', ['run', 'agent'], { cwd: ROOT, stdio: 'inherit' });
  agentProc.on('error', (err) => {
    console.error('  Could not start agent:', err.message);
  });
};

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  TRAJECTORY_DETAILS,
  renderTrajectoryLines,
  printInitSummary,
};

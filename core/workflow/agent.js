#!/usr/bin/env node

/**
 * Multi-Agent Monorepo Template - Task Launcher
 * Run with: npm run agent
 *
 * Creates a Git Worktree, generates coordination files,
 * and opens your IDE automatically at the correct path.
 */

const readline     = require('readline');
const fs           = require('fs');
const path         = require('path');
const { execSync } = require('child_process');
const guards       = require('./guards');
const tasksHistory = require('./tasks_history');

// ── Prompts (arrow-key navigation) ───────────────────────────────────────────

let prompts;
try { prompts = require('prompts'); } catch { prompts = null; }

// Arrow-key select - falls back to number input if prompts unavailable
const arrowSelect = async (message, choices, rl) => {
  if (prompts && process.stdin.isTTY) {
    const res = await prompts({
      type:    'select',
      name:    'value',
      message,
      choices: choices.map((c, i) => ({ title: c.label || c, value: i })),
    }, { onCancel: () => process.exit(0) });
    return res.value;
  }
  // Fallback: number input
  return new Promise(resolve => {
    choices.forEach((c, i) => console.log(`  ${dim(`${i + 1}.`)} ${c.label || c}`));
    rl.question(`\n  Select (1-${choices.length}): `, ans => {
      const n = parseInt(ans) - 1;
      resolve(!isNaN(n) && n >= 0 && n < choices.length ? n : 0);
    });
  });
};

const arrowConfirm = async (message, rl) => {
  if (prompts && process.stdin.isTTY) {
    const res = await prompts({
      type:    'confirm',
      name:    'value',
      message,
      initial: true,
    }, { onCancel: () => process.exit(0) });
    return res.value ?? true;
  }
  return new Promise(resolve => {
    rl.question(`${message} (y/n): `, ans => resolve(ans.toLowerCase() !== 'n'));
  });
};

// ── Colors ────────────────────────────────────────────────────────────────────

const c = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  green:  '\x1b[32m',
  blue:   '\x1b[34m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  red:    '\x1b[31m',
};

const bold   = (s) => `${c.bold}${s}${c.reset}`;
const green  = (s) => `${c.green}${s}${c.reset}`;
const yellow = (s) => `${c.yellow}${s}${c.reset}`;
const dim    = (s) => `${c.dim}${s}${c.reset}`;
const cyan   = (s) => `${c.cyan}${s}${c.reset}`;
const blue   = (s) => `${c.blue}${s}${c.reset}`;
const red    = (s) => `${c.red}${s}${c.reset}`;

// ── Paths ─────────────────────────────────────────────────────────────────────

const ROOT        = path.join(__dirname, '..');
const CONFIG_PATH = path.join(ROOT, '.scaffold', '.config.json');
const LOCK_PATH   = path.join(ROOT, '.scaffold', '.initialized');

// ── Guards ────────────────────────────────────────────────────────────────────

if (!fs.existsSync(LOCK_PATH)) {
  console.log(`\n${red('  Project not initialized.')}`);
  console.log(dim('  Run `') + cyan('npm run init') + dim('` first.\n'));
  process.exit(1);
}

if (!fs.existsSync(CONFIG_PATH)) {
  console.log(`\n${red('  Missing .scaffold/.config.json.')}`);
  console.log(dim('  Run `') + cyan('npm run init') + dim('` to regenerate.\n'));
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

// ── Location guard ────────────────────────────────────────────────────────────

const normalizedCwd  = path.resolve(process.cwd());
const normalizedRoot = path.resolve(ROOT);

if (normalizedCwd !== normalizedRoot) {
  console.log(`\n${red('  Wrong location detected.')}`);
  console.log(dim(`  You are here : ${normalizedCwd}`));
  console.log(dim(`  Should be    : ${normalizedRoot}\n`));
  console.log(bold('  Run this to fix it and launch:'));
  console.log(cyan(`\n  cd "${normalizedRoot}" && npm run agent\n`));
  process.exit(1);
}

// ── IDE gate ──────────────────────────────────────────────────────────────────

if (!config.ide) {
  console.log(`\n${red('  IDE not configured.')}`);
  console.log(dim('  Run `') + cyan('npm run init') + dim('` to configure your IDE preference.\n'));
  process.exit(1);
}

// ── Open IDE ──────────────────────────────────────────────────────────────────

const openIDE = (worktreePath) => {
  const { name, strategy, cmd, app, openArgs, winPaths, linuxPaths } = config.ide;

  if (strategy === 'manual' || !strategy) {
    // Last-resort fallback for JetBrains IDEs - try open -a directly
    if (app && process.platform === 'darwin') {
      try {
        execSync(`open -a "${app}" "${worktreePath}"`, { stdio: 'pipe' });
        return name;
      } catch { /* genuinely not installed */ }
    }
    return null;
  }

  const args = (openArgs || []).join(' ');

  try {
    if (strategy === 'mac-app') {
      const argsStr = args ? `--args ${args}` : '';
      execSync(`open -na "${app}" ${argsStr} "${worktreePath}"`.trim(), { stdio: 'pipe' });

    } else if (strategy === 'win-exe') {
      const exe = (winPaths || []).find(p => fs.existsSync(p));
      if (!exe) return null;
      execSync(`start "" "${exe}" ${args} "${worktreePath}"`.trim(), { stdio: 'pipe' });

    } else if (strategy === 'linux-path') {
      const bin = (linuxPaths || []).find(p => fs.existsSync(p));
      if (!bin) return null;
      execSync(`"${bin}" ${args} "${worktreePath}"`.trim(), { stdio: 'pipe' });

    } else {
      const platform = process.platform;
      if (platform === 'win32') {
        execSync(`start "" "${cmd}" ${args} "${worktreePath}"`.trim(), { stdio: 'pipe' });
      } else {
        execSync(`"${cmd}" ${args} "${worktreePath}"`.trim(), { stdio: 'pipe' });
      }
    }

    return name;
  } catch {
    return null;
  }
};

// ── Agent map ─────────────────────────────────────────────────────────────────

const AGENTS = {
  client:  ['UI', 'LOGIC', 'FORMS', 'ROUTING', 'TESTING', 'ACCESSIBILITY'],
  backend: ['INIT', 'API', 'LOGIC', 'AUTH', 'DB', 'TESTING', 'EVENTS', 'JOBS'],
  shared:  ['SECURITY'],
};

// Short descriptions per agent
const AGENT_DESCRIPTIONS = {
  client: {
    UI:            'scaffolds the full project structure',
    LOGIC:         'state management, API integration, custom hooks',
    FORMS:         'form components, validation, submission handling',
    ROUTING:       'page routing, navigation, URL structure',
    TESTING:       'unit and integration tests',
    ACCESSIBILITY: 'a11y compliance, keyboard navigation',
  },
  backend: {
    INIT:    'scaffolds backend architecture, folder structure, DB setup, wiring config and contracts',
    API:     'REST/GraphQL endpoints, request/response handling',
    LOGIC:   'business logic, services, data processing',
    AUTH:    'authentication, authorization, session management',
    DB:      'database schemas, migrations, queries',
    TESTING: 'API and integration tests',
    EVENTS:  'event queues, pub/sub, webhooks',
    JOBS:    'background jobs, scheduled tasks, workers',
  },
  shared: {
    SECURITY: 'shared auth utilities, encryption, input validation',
  },
};

// Scope constraints appended to every task description - agent cannot bypass its own task
const AGENT_TASK_SUFFIX = {
  client: {
    UI:            ' - scaffold project structure and component shells ONLY. No business logic, state management, or API calls. Use <!-- TODO: LOGIC agent --> where logic will be needed.',
    LOGIC:         ' - implement state, services, and API integration ONLY. No UI markup or styling changes. No route definitions.',
    FORMS:         ' - implement form components, validation rules, and submission handlers ONLY. No UI redesign. No state outside forms.',
    ROUTING:       ' - implement routes, guards, lazy loading, and navigation ONLY. No business logic. No UI changes.',
    TESTING:       ' - write unit and integration tests ONLY. Do not modify production code except to fix bugs directly revealed by failing tests.',
    ACCESSIBILITY: ' - implement ARIA attributes, keyboard navigation, and semantic HTML ONLY. No visual redesign. No business logic changes.',
  },
  backend: {
    INIT:    ' - scaffold the backend architecture ONLY. Decide folder structure, MVC/service pattern, DB connection setup, and framework configuration. Bootstrap CONTRACTS.md with initial shared types. Write wiring.config.json backend section with all required runtime vars per environment. No endpoint implementation. No business logic.',
    API:     ' - read CONTRACTS.md and wiring.config.json first as binding contracts before implementing anything. Implement route handlers, controllers, and DTOs ONLY. No business logic services. No auth middleware. No database queries. No architectural changes.',
    LOGIC:   ' - implement services and business logic ONLY. No route definitions. No auth middleware. No database schema changes.',
    AUTH:    ' - implement authentication and authorization ONLY. No business logic. No database schema changes. No API route restructuring.',
    DB:      ' - implement database schema, migrations, and queries ONLY. No business logic. No API handlers. No auth.',
    TESTING: ' - write unit and integration tests ONLY. Do not modify production code except to fix bugs directly revealed by failing tests.',
    EVENTS:  ' - implement event queues, pub/sub, and webhooks ONLY. No business logic. No API endpoint changes.',
    JOBS:    ' - implement background jobs and scheduled tasks ONLY. No business logic services. No API endpoints.',
  },
  shared: {
    SECURITY: ' - implement shared auth utilities, encryption, and input validation ONLY. No scope-specific business logic.',
  },
};

// Agents that require an existing scope scaffold before they can run
const SCAFFOLD_REQUIRED = ['LOGIC', 'FORMS', 'ROUTING', 'TESTING', 'ACCESSIBILITY', 'API', 'AUTH', 'DB', 'EVENTS', 'JOBS'];

// Agents that depend on shared contracts (CONTRACTS.md)
const CONTRACTS_REQUIRED = ['LOGIC', 'AUTH', 'API', 'FORMS', 'INIT'];

// ── CLOUD prereq evaluator ────────────────────────────────────────────────────

const evalCloudPrereqs = (entries) => {
  const bt          = config.backend?.type;
  const clientUI    = entries.find(e => e.scope === 'client'  && e.agent === 'UI'    && e.status === 'COMPLETED');
  const clientLogic = entries.find(e => e.scope === 'client'  && e.agent === 'LOGIC' && e.status === 'COMPLETED');
  const backendINIT = entries.find(e => e.scope === 'backend' && e.agent === 'INIT'  && e.status === 'COMPLETED');
  const isClientOnly  = !bt || bt === 'integrated';
  const isBackendOnly = bt === 'separate' && !clientUI;

  const prereqMet = isClientOnly
    ? !!(clientUI && clientLogic)
    : isBackendOnly
      ? !!backendINIT
      : !!(clientUI && clientLogic && backendINIT);

  return { prereqMet, clientUI, clientLogic, backendINIT, isClientOnly, isBackendOnly };
};

// Prerequisite agents that must be COMPLETED before an agent can run
const AGENT_PREREQUISITES = {
  client: {
    LOGIC:         ['UI'],
    FORMS:         ['UI'],
    ROUTING:       ['UI'],
    TESTING:       ['UI', 'LOGIC'],
    ACCESSIBILITY: ['UI'],
  },
  backend: {
    API:           ['INIT'],
    LOGIC:         ['INIT', 'DB'],
    AUTH:          ['INIT', 'LOGIC'],
    DB:            ['INIT'],
    EVENTS:        ['INIT', 'API'],
    JOBS:          ['INIT', 'DB'],
    TESTING:       ['INIT', 'API', 'LOGIC'],
  },
};

const DOD_ITEMS = {
  UI:            ['All planned components exist and render correctly', 'No business logic inside components', 'All values derive from design tokens', 'Shared types consumed from CONTRACTS.md'],
  LOGIC:         ['All planned logic units exist and function correctly', 'No API calls outside the service layer', 'All response types from CONTRACTS.md', 'State and data fetching concerns separated'],
  FORMS:         ['All fields exist with correct validation rules', 'Error messages are clear and user-facing', 'Submission payload matches CONTRACTS.md', 'Double submission is prevented'],
  ROUTING:       ['All routes resolve to correct components', 'Every protected route declares its guard', 'All routes are lazy loaded unless justified', 'Route paths are centralized'],
  TESTING:       ['All planned test cases exist and pass', 'Happy path, edge cases, and failure states covered', 'Test data shapes from CONTRACTS.md', 'No implementation changes made'],
  ACCESSIBILITY: ['All audit findings resolved', 'Every interactive element keyboard reachable', 'Focus managed after dynamic content changes', 'Color contrast meets WCAG 2.1 AA'],
  API:           ['All endpoints exist with correct HTTP methods', 'DTOs own all input validation', 'All types in CONTRACTS.md', 'Every endpoint declares access control'],
  AUTH:          ['All strategies and guards function correctly', 'No secrets in code', 'All tokens have expiry set', 'Auth failures return consistent responses'],
  DB:            ['All entities and relationships defined', 'Migration generated and surfaced', 'Repository methods own all queries', 'No ORM auto-sync used'],
  EVENTS:        ['All emitters and handlers exist', 'Receivers acknowledge immediately', 'All handlers are idempotent', 'Failure handling defined'],
  JOBS:          ['All jobs exist with correct triggers', 'Schedule expressions from config', 'All jobs are idempotent', 'Failure strategy defined for every job'],
  SECURITY:      ['All findings documented with severity', 'Every finding has a remediation proposal', 'OWASP Top 10 coverage confirmed', 'No fixes implemented directly'],
};

// ── Agent context questions ───────────────────────────────────────────────────

const AGENT_QUESTIONS = {
  LOGIC: [
    { key: 'entities',   prompt: 'What entities / models are involved?',                consequence: 'agent may generate incompatible types' },
    { key: 'endpoints',  prompt: 'What API endpoints need to be integrated?',           consequence: 'agent may assume incorrect contracts' },
    { key: 'state',      prompt: 'What state needs to be managed?',                     consequence: 'agent may miss state requirements' },
    { key: 'contracts',  prompt: 'Any contracts from CONTRACTS.md to reference?',       consequence: 'shared types may need rework after' },
  ],
  FORMS: [
    { key: 'fields',     prompt: 'What form fields are required?',                      consequence: 'agent may miss field requirements' },
    { key: 'validation', prompt: 'What validation rules apply?',                        consequence: 'validation logic may be incomplete' },
    { key: 'endpoint',   prompt: 'What endpoint does this form submit to?',             consequence: 'submission payload may not match contracts' },
  ],
  AUTH: [
    { key: 'strategy',   prompt: 'What auth strategy is needed? (JWT / OAuth / etc.)',  consequence: 'auth implementation may use incorrect strategy' },
    { key: 'guards',     prompt: 'What entities or routes need auth guards?',           consequence: 'access control may be incomplete' },
    { key: 'tokens',     prompt: 'What token / session requirements apply?',            consequence: 'token handling may not match contracts' },
  ],
  API: [
    { key: 'endpoints',  prompt: 'What endpoints need to be created?',                  consequence: 'endpoint coverage may be incomplete' },
    { key: 'dtos',       prompt: 'What request / response DTOs are needed?',            consequence: 'DTOs may not match client contracts' },
    { key: 'auth',       prompt: 'Which endpoints require auth guards?',                consequence: 'access control may be missing' },
  ],
  DB: [
    { key: 'entities',   prompt: 'What entities / tables need to be defined?',          consequence: 'schema may be incomplete' },
    { key: 'relations',  prompt: 'What relationships exist between entities?',           consequence: 'relations may be missing or incorrect' },
    { key: 'migrations', prompt: 'Any specific migration requirements?',                consequence: 'migration may not match expected schema' },
  ],
  TESTING: [
    { key: 'scenarios',  prompt: 'What scenarios / flows need test coverage?',          consequence: 'test coverage may be insufficient' },
    { key: 'edge',       prompt: 'What edge cases should be covered?',                  consequence: 'edge cases may be missed' },
  ],
};

// ── BUILD_STATE parser ────────────────────────────────────────────────────────

const parseBuildState = () => {
  const p = path.join(ROOT, 'BUILD_STATE.md');
  if (!fs.existsSync(p)) return [];
  const lines = fs.readFileSync(p, 'utf8').split('\n');
  const entries = [];
  for (const line of lines) {
    if (!line.startsWith('|') || line.includes('---') || line.toLowerCase().includes('| agent ')) continue;
    const cols = line.split('|').map(c => c.trim()).filter(Boolean);
    if (cols.length >= 5) {
      entries.push({
        date:   cols[0],
        agent:  cols[1],
        scope:  cols[2],
        task:   cols[3],
        status: cols[4],
        branch: cols[5] || '',
      });
    }
  }
  return entries;
};

// ── Active worktrees / reconciliation delegated to guards ────────────────────

const checkContracts = () => {
  const p = path.join(ROOT, 'CONTRACTS.md');
  if (!fs.existsSync(p)) return { exists: false, hasContent: false };
  const content = fs.readFileSync(p, 'utf8');
  const hasContent = /interface\s+\w+|type\s+\w+\s*=|enum\s+\w+/i.test(content);
  return { exists: true, hasContent };
};

// ── Scope options builder ─────────────────────────────────────────────────────

const buildScopeOptions = () => {
  const bt = config.backend?.type;
  const options = [];

  options.push({ name: 'client', label: 'client' });

  if (bt === 'integrated') {
    options.push({ name: 'backend', label: 'backend' });
  } else if (!bt) {
    options.push({ name: 'backend', label: `backend   ${yellow('⚠ not configured')}`, needsConfig: true });
  } else {
    options.push({ name: 'backend', label: 'backend' });
  }

  options.push({ name: 'shared', label: 'shared' });

  // CLOUD appears only when prerequisites are met
  const rawEntries  = parseBuildState();
  const { prereqMet } = evalCloudPrereqs(rawEntries);
  if (prereqMet && config.cloudDeployment !== 'skipped') {
    options.push({ name: 'cloud', label: `${cyan('☁ cloud')}   ${dim('deploy to production')}` });
  }

  return options;
};

// ── Project status display ────────────────────────────────────────────────────

const displayProjectStatus = (entries, contracts) => {
  const scopeEntries = (scope) => entries.filter(e => e.scope === scope);

  const renderScope = (scope) => {
    const all = scopeEntries(scope);
    if (all.length === 0) return dim('○ not started');
    const completed  = all.filter(e => e.status === 'COMPLETED').map(e => e.agent);
    const inProgress = all.filter(e => e.status === 'IN PROGRESS').map(e => e.agent);
    const parts = [];
    if (completed.length)  parts.push(green(completed.join(', ') + ' ✓'));
    if (inProgress.length) parts.push(yellow(inProgress.join(', ') + ' …'));
    return parts.join('  ');
  };

  const contractsNote = contracts.hasContent
    ? green('contracts defined')
    : yellow('no contracts defined');

  const bt = config.backend?.type;

  console.log(`\n${bold('Project Status')} ${dim('-')} ${bold(config.projectName)}\n`);
  console.log(`  ${bold('client')}    ${renderScope('client')}`);
  console.log(`  ${bold('shared')}    ${renderScope('shared')}  ${dim('|')}  ${contractsNote}`);

  if (bt === 'integrated') {
    console.log(`  ${dim('backend')}   ${dim('integrated into client')}`);
  } else if (!bt) {
    console.log(`  ${dim('backend')}   ${yellow('✗ not configured')}`);
  } else {
    const beStatus = renderScope('backend') || dim('○ not started');
    const ormsNote = contracts.hasContent ? '' : `  ${dim('|')}  ${yellow('no ORMs / DTOs in CONTRACTS.md')}`;
    console.log(`  ${bold('backend')}   ${beStatus}${ormsNote}`);
  }

  // ── Cloud status ───────────────────────────────────────────────────────────
  const clientUI    = entries.find(e => e.scope === 'client'  && e.agent === 'UI'    && e.status === 'COMPLETED');
  const clientLogic = entries.find(e => e.scope === 'client'  && e.agent === 'LOGIC' && e.status === 'COMPLETED');
  const backendINIT = entries.find(e => e.scope === 'backend' && e.agent === 'INIT'  && e.status === 'COMPLETED');
  const isClientOnly  = !bt || bt === 'integrated';
  const isBackendOnly = bt === 'separate' && !clientUI;

  const cloudPrereqMet = isClientOnly
    ? (clientUI && clientLogic)
    : isBackendOnly
      ? backendINIT
      : (clientUI && clientLogic && backendINIT);

  const cloudSkipped = config.cloudDeployment === 'skipped';

  if (!cloudSkipped) {
    if (cloudPrereqMet) {
      console.log(`  ${bold('☁ cloud')}    ${green('✓ ready to deploy')}  ${dim('|')}  ${dim('select CLOUD to begin')}`);
    } else {
      console.log(`  ${dim('☁ cloud')}    ${dim('available after more of your project is built')}`);
    }
  }

  console.log('');
};

// ── Readline ──────────────────────────────────────────────────────────────────

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const ask = (question) =>
  new Promise((resolve) => rl.question(question, (a) => resolve(a.trim())));

const showList = (items) => {
  items.forEach((item, i) => {
    const label = typeof item === 'string' ? item : item.label;
    console.log(`  ${dim(`${i + 1}.`)} ${label}`);
  });
};

const showAgentList = (scope, agents, buildEntries) => {
  const completed = buildEntries
    .filter(e => e.scope === scope && e.status === 'COMPLETED')
    .map(e => e.agent);

  // Find recommended next agent
  const prereqs = AGENT_PREREQUISITES[scope] || {};
  let recommended = null;

  for (const agent of agents) {
    if (completed.includes(agent)) continue;
    const reqs = prereqs[agent] || [];
    const metReqs = reqs.every(r => completed.includes(r));
    if (metReqs) { recommended = agent; break; }
  }

  const descriptions = AGENT_DESCRIPTIONS[scope] || {};

  agents.forEach((agent, i) => {
    const desc       = descriptions[agent] ? dim(`  ${descriptions[agent]}`) : '';
    const isRecommended = agent === recommended;
    const tag        = isRecommended
      ? (completed.length === 0 ? cyan('  ← start here') : cyan('  ← next step'))
      : '';
    const label      = isRecommended ? bold(agent) : agent;
    console.log(`  ${dim(`${i + 1}.`)} ${label}${tag}${desc}`);
  });
};

const selectRequired = async (prompt, items) => {
  const idx = await arrowSelect(prompt, items.map(i => ({ label: typeof i === 'string' ? i : (i.label || i) })), rl);
  return items[idx];
};

const separator = () => console.log(`\n${dim('─'.repeat(60))}`);

// ── Agent context gathering ───────────────────────────────────────────────────

const gatherAgentContext = async (agent) => {
  const questions = AGENT_QUESTIONS[agent];
  if (!questions) return { answers: {}, skipped: [] };

  separator();
  console.log(`\n${bold(blue('Agent context'))} ${dim('- press Enter to skip any question')}\n`);

  const answers = {};
  const skipped = [];

  for (const q of questions) {
    if (prompts && process.stdin.isTTY) {
      const res = await prompts({
        type:    'text',
        name:    'value',
        message: q.prompt,
        hint:    'Enter to skip',
      }, { onCancel: () => process.exit(0) });
      const answer = (res.value || '').trim();
      if (!answer) skipped.push(q);
      else answers[q.key] = answer;
    } else {
      const answer = await ask(`  ${bold(q.prompt)}\n  ${dim('→')} `);
      if (!answer.trim()) skipped.push(q);
      else answers[q.key] = answer.trim();
    }
  }

  return { answers, skipped };
};

// ── Skip acknowledgment ───────────────────────────────────────────────────────

const acknowledgeSkipped = async (skipped) => {
  separator();
  console.log(`\n${yellow('  ⚠ Incomplete context - the following was skipped:')}\n`);
  skipped.forEach(q => {
    console.log(`  ${dim('→')} ${bold(q.prompt)}`);
    console.log(`     ${red('Risk:')} ${q.consequence}\n`);
  });
  console.log(dim('  The agent will flag all assumptions based on missing context.'));
  console.log(dim('  This may require additional review passes after completion.\n'));

  const proceedIdx = await arrowSelect('Proceed with incomplete context?', [
    { label: `${green('✓')} Proceed - agent flags assumptions` },
    { label: `${yellow('←')} Go back - fill in missing context` },
    { label: `${red('✗')} Abort` },
  ], rl);

  if (proceedIdx === 1) return null; // signal: re-gather
  if (proceedIdx === 2) return false; // signal: abort
  return true; // signal: confirmed
};

// ── File generators ───────────────────────────────────────────────────────────

const generateClaudeScope = ({ project, agent, branchName, worktreePath }) => {
  return `# .claude-scope
# Auto-generated by .workflow/agent.js
# This file identifies the scope of this worktree.
# Read this file at session start and verify scope before proceeding.

project      : ${project}
agent        : ${agent}
branch       : ${branchName}
worktree     : ${worktreePath}

## Scope Verification Rule
Before doing anything else, verify:
1. The loaded CLAUDE.md matches the project scope above
2. If opened at repo root instead of this worktree - hard stop:

   WRONG CONTEXT - CANNOT PROCEED
   This worktree is scoped to: ${project}/${agent}
   Close and reopen at: ${worktreePath}

3. Read TASK.md for the current task prompt
4. Reference the correct agent file: agents/${agent}.md
`;
};

const generateContextSection = (answers, skipped) => {
  if (Object.keys(answers).length === 0 && skipped.length === 0) return '';

  let section = '\n---\n\n## Agent Context\n';

  if (Object.keys(answers).length > 0) {
    section += '\n**Provided:**\n';
    for (const [key, value] of Object.entries(answers)) {
      section += `- **${key}**: ${value}\n`;
    }
  }

  if (skipped.length > 0) {
    section += '\n**⚠ Missing - user acknowledged:**\n';
    skipped.forEach(q => {
      section += `- ${q.prompt} _(skipped - risk: ${q.consequence})_\n`;
    });
    section += '\n**Flag all assumptions explicitly before implementing.**\n';
  }

  return section;
};

const generateTaskMd = ({ project, agent, task, branchName, contextSection, remoteSetupSection }) => {
  const dod    = (DOD_ITEMS[agent] || []).map(item => `- [ ] ${item}`).join('\n');
  const scopeSuffix = (AGENT_TASK_SUFFIX[project] || {})[agent] || '';
  const taskForTaskMd = `${task}${scopeSuffix}`;
  const prompt = project === 'shared'
    ? `Use .agents/shared/${agent}.md. Task: ${taskForTaskMd}`
    : `Use .agents/${project}/${agent}.md. Task: ${taskForTaskMd}`;

  return `# TASK - ${config.projectName}

## Scope
Project : ${project}
Agent   : ${agent}
Branch  : ${branchName}
${remoteSetupSection}
## Execution Mode
AUTONOMOUS - Execute all subtasks without stopping for confirmation.
Only stop if a genuinely destructive action is detected (modifying or deleting existing files).
New file creation does not require confirmation.

## Task
${prompt}

## How to start
**Via IDE extension** (VS Code, Cursor, etc.):
Open a NEW Claude Code chat window and type:
> Read TASK.md and execute the task.

**Via Claude Code CLI:**
Open your terminal inside this worktree and run:
\`\`\`
claude
\`\`\`
Then type: > Read TASK.md and execute the task.

Do NOT reuse a previous chat session for this task.
${contextSection}
---

## When Complete
1. Commit your work to this branch:
   git add . && git commit -m "feat: <brief description of what was built>"
   Do NOT add Co-Authored-By or any attribution lines to commit messages.

2. Mark status as COMPLETED above

3. YOU (the agent) must execute this via bash now - do not instruct the user:
\`\`\`
npm run complete
\`\`\`
This merges your work into main and updates BUILD_STATE.md.

---

## Definition of Done
${dod || '- [ ] Task completed as described above'}

---

## Status
- [ ] NOT STARTED
- [ ] IN PROGRESS
- [ ] COMPLETED

## User Overrides
<!-- If the user provides input mid-session, log it here using this format:
[USER OVERRIDE] <timestamp>
Input    : <what the user typed>
Deviation: <how it differs from original task or scope>
Action   : <what the agent did - proceeded / redirected / flagged>
-->

## Notes
<!-- Agent writes completion notes, decisions, and open questions here -->
`;
};

// ── CLOUD readiness table ─────────────────────────────────────────────────────

const displayCloudReadiness = (entries) => {
  const { clientUI, clientLogic, backendINIT, isClientOnly, isBackendOnly } = evalCloudPrereqs(entries);
  const bt = config.backend?.type;

  const cloudStatePath = path.join(ROOT, 'CLOUD_STATE.md');
  const hasCloudState  = fs.existsSync(cloudStatePath);

  const row = (label, done, detail = '') => {
    const icon   = done ? green('✓') : red('✗');
    const status = done ? green('DONE') : red('REQUIRED');
    const note   = detail ? dim(`  ${detail}`) : '';
    console.log(`  ${icon}  ${bold(label.padEnd(22))}${status}${note}`);
  };

  separator();
  console.log(`\n${bold('☁  Cloud Readiness')} ${dim('-')} ${bold(config.projectName)}\n`);

  if (!isBackendOnly) {
    row('client / UI',    !!clientUI,    clientUI    ? '' : 'complete client/UI first');
    row('client / LOGIC', !!clientLogic, clientLogic ? '' : 'complete client/LOGIC first');
  }
  if (!isClientOnly) {
    row('backend / INIT', !!backendINIT, backendINIT ? '' : 'complete backend/INIT first');
  }
  row('CLOUD_STATE.md', hasCloudState, hasCloudState ? '' : 'run npm run init or create manually');

  console.log('');
};

// ── Main ──────────────────────────────────────────────────────────────────────

const main = async () => {
  console.log('\n');
  console.log(bold(cyan('  Multi-Agent Monorepo Template')));
  console.log(dim(`  Task Launcher - ${config.projectName}\n`));
  separator();

  // ── Entry guards ──────────────────────────────────────────────────────────────

  guards.validateConfig(config, ROOT);
  const tracking = guards.loadTracking(ROOT, config);

  // ── Project status snapshot ───────────────────────────────────────────────────

  const rawEntries   = parseBuildState();
  const buildEntries = guards.reconcileStaleWorktrees(rawEntries, tracking, ROOT);
  const contracts    = checkContracts();
  displayProjectStatus(buildEntries, contracts);

  separator();

  // ── Flow loop - supports back navigation at every step ───────────────────────

  // ── CLI args - allow restart.js to pre-scope ────────────────────────────────
  const argScope = process.argv.find(a => a.startsWith('--scope='))?.split('=')[1]?.toLowerCase();
  const argAgent = process.argv.find(a => a.startsWith('--agent='))?.split('=')[1]?.toUpperCase();

  let project, agent, task, contractsNote;
  let timestamp, sanitizedName, worktreeName, branchName, worktreePath;
  let contextSection = '';

  flowLoop: while (true) {

  // ── Select scope ─────────────────────────────────────────────────────────────

  const scopeOptions = buildScopeOptions();

  let selectedScope;
  if (argScope && scopeOptions.find(s => s.name === argScope)) {
    selectedScope = scopeOptions.find(s => s.name === argScope);
    project = argScope;
  } else {
    console.log(`\n${bold('* Project scope:')}`);
    const scopeIdx = await arrowSelect('Select scope', scopeOptions.map(s => ({ label: s.label || s.name })), rl);
    selectedScope = scopeOptions[scopeIdx];
    project = selectedScope.name || selectedScope;
  }

  // Hard stop - backend not configured
  if (selectedScope.needsConfig) {
    console.log(`\n${red('  Backend is not configured.')}`);
    console.log(dim('  Re-run `') + cyan('npm run init') + dim('` to add backend configuration.\n'));
    rl.close();
    return;
  }

  // ── CLOUD scope - single agent, show readiness table then go straight to task
  if (project === 'cloud') {
    displayCloudReadiness(buildEntries);
    const { prereqMet } = evalCloudPrereqs(buildEntries);
    if (!prereqMet) {
      console.log(`${red('  Prerequisites not met.')} ${dim('Complete the required agents above first.\n')}`);
      rl.close();
      return;
    }
    const confirmCloud = await arrowConfirm('All prerequisites met - proceed with CLOUD deployment?', rl);
    if (!confirmCloud) continue flowLoop;
    agent = 'CLOUD';
    // Skip agent sub-selection entirely - fall through to task description
  }

  // Soft gate - backend selected but missing prerequisites
  if (project === 'backend') {
    const clientCompleted = buildEntries.filter(e => e.scope === 'client' && e.status === 'COMPLETED');
    const clientLogicDone = clientCompleted.some(e => e.agent === 'LOGIC');
    const missing = [];

    if (clientCompleted.length === 0) {
      missing.push({ item: 'Client scope', detail: 'no completed client work found - backend has nothing to integrate against' });
    } else if (!clientLogicDone) {
      missing.push({ item: 'Client LOGIC', detail: 'client logic layer not completed - backend integration contracts may not be defined yet' });
    }
    if (!contracts.hasContent) {
      missing.push({ item: 'CONTRACTS.md', detail: 'no shared types / DTOs defined' });
    }

    if (missing.length > 0) {
      console.log(`\n${yellow('  ⚠ Backend prerequisites not met:')}\n`);
      missing.forEach(m => {
        console.log(`  ${dim('→')} ${bold(m.item)}`);
        console.log(`     ${m.detail}\n`);
      });
      const proceedIdx = await arrowSelect('Backend prerequisites not met:', [
        { label: `${green('→')} Proceed anyway` },
        { label: `${yellow('←')} Go back - pick a different scope` },
      ], rl);
      if (proceedIdx === 1) continue flowLoop;
    }
  }

  // ── Select agent (with re-selection loop + back to scope) ────────────────────

  const agentOptions = AGENTS[project] || [];
  contractsNote = '';

  if (project !== 'cloud') {
  // Pre-scoped from restart.js
  if (argAgent && (AGENTS[project] || []).includes(argAgent)) {
    agent = argAgent;
  } else {
  agentLoop: while (true) {
    console.log('');

    // Select agent with back option
    console.log(`\n${bold(`* Agent (${project}):`)}`);

    // Show numbered list with hints only in non-TTY fallback (prompts handles display in TTY)
    if (!prompts || !process.stdin.isTTY) showAgentList(project, agentOptions, buildEntries);

    // Build agent choices with recommendation tags
    const completedAgents = buildEntries
      .filter(e => e.scope === project && e.status === 'COMPLETED')
      .map(e => e.agent);
    const prereqMap = AGENT_PREREQUISITES[project] || {};
    let recommendedAgent = null;
    for (const a of agentOptions) {
      if (completedAgents.includes(a)) continue;
      const reqs = prereqMap[a] || [];
      if (reqs.every(r => completedAgents.includes(r))) { recommendedAgent = a; break; }
    }

    const agentChoices = [
      ...agentOptions.map(a => {
        const desc = dim(`  ${AGENT_DESCRIPTIONS[project]?.[a] || ''}`);
        const tag  = a === recommendedAgent
          ? cyan(completedAgents.length === 0 ? '  ← start here' : '  ← next step')
          : '';
        const label = a === recommendedAgent ? bold(a) : a;
        return { label: `${label}${tag}${desc}` };
      }),
      { label: dim('← back to scope selection') },
    ];
    const agentIdx = await arrowSelect('Select agent', agentChoices, rl);

    if (agentIdx === agentOptions.length) { agent = null; continue flowLoop; }
    agent = agentOptions[agentIdx];
    contractsNote = '';

    // Agent already active - decisional block
  const { active, slot: activeSlot } = guards.checkAgentActive(tracking, project, agent);
  if (active) {
    // Read task from TASK.md if available
    let activeTask = activeSlot.branch;
    const activeTm = path.join(activeSlot.worktreePath, 'TASK.md');
    if (fs.existsSync(activeTm)) {
      const tmContent = fs.readFileSync(activeTm, 'utf8');
      const taskMatch = tmContent.match(/## Task\n.*Task:\s*(.+)/);
      if (taskMatch) activeTask = taskMatch[1].trim();
    }

    separator();
    console.log(`\n${yellow(`  ⚠ ${project}/${agent} is already active`)}\n`);
    console.log(`  ${dim('Branch')}  : ${activeSlot.branch}`);
    console.log(`  ${dim('Launched')}: ${activeSlot.launchedAt ? new Date(activeSlot.launchedAt).toLocaleString() : 'unknown'}`);
    console.log(`  ${dim('Task')}    : ${activeTask}\n`);

    const activeChoices = [
      { label: `${bold('Continue')}   - open existing workspace and resume from last point` },
      { label: `${bold('Complete')}   - merge current work into main, then launch new task` },
      { label: `${bold('Abandon')}    - discard current branch and work, start fresh  ${red('⚠ unmerged work lost')}` },
      { label: `${bold('Pick again')} - choose a different agent` },
    ];
    const activeChoice = await arrowSelect(`Agent already active - what would you like to do?`, activeChoices, rl) + 1;

    if (activeChoice === 1) {
      separator();
      console.log(`\n  ${green('✓')} Opening existing workspace...\n`);
      openIDE(activeSlot.worktreePath);
      console.log(`  ${bold('Resume your task:')}`);
      console.log(`  ${dim('1.')} IDE should be open at: ${cyan(activeSlot.worktreePath)}`);
      console.log(`  ${dim('2.')} Open a NEW session in Claude Code CLI or Claude Code Extension - type go or start to resume`);
      console.log(`  ${dim('3.')} Type: ${cyan('Read TASK.md and continue from where you stopped.')}\n`);
      separator(); rl.close(); return;
    }
    if (activeChoice === 2) {
      separator();
      console.log(`\n  ${bold('Running complete flow...')}\n`);
      rl.close();
      const { spawn } = require('child_process');
      spawn('node', [path.join(ROOT, '.workflow', 'complete.js')], { cwd: ROOT, stdio: 'inherit' });
      return;
    }
    if (activeChoice === 3) {
      separator();
      console.log(`\n  ${bold('Abandoning...')}\n`);
      const { branch } = activeSlot;
      try { execSync(`git branch -D ${branch}`, { cwd: ROOT, stdio: 'pipe' }); console.log(`  ${green('✓')} Local branch deleted`); } catch {}
      try { execSync(`git push origin --delete ${branch}`, { cwd: ROOT, stdio: 'pipe' }); console.log(`  ${green('✓')} Remote branch deleted`); } catch {}
      guards.clearTrackingSlot(tracking, project, agent, ROOT);
      console.log(`  ${green('✓')} Tracking cleared\n`);
      continue agentLoop;
    }
    if (activeChoice === 4) { continue agentLoop; }
  }

  // MISSING gate
  const trackingSlot = tracking?.[project]?.[agent];
  if (trackingSlot?.status === 'MISSING') {
    const gateResult = await guards.runMissingGate({
      scope:   project,
      agent,
      slot:    trackingSlot,
      tracking,
      config,
      ROOT,
      ask,
    });

    if (gateResult.action === 'recovered') {
      openIDE(gateResult.worktreePath);
      rl.close();
      return;
    }
    if (gateResult.action === 'failed') {
      rl.close();
      return;
    }
    // 'reset' or 'new' → continue with fresh launch flow
  }

  // App skeleton guard
  if (SCAFFOLD_REQUIRED.includes(agent)) {
    const scopeCompleted = buildEntries.filter(e => e.scope === project && e.status === 'COMPLETED');
    if (scopeCompleted.length === 0) {
      console.log(`\n${red(`  ✗ ${agent} requires an existing ${project} scaffold.`)}`);
      console.log(dim(`  No completed work found in ${project} scope yet.`));
      console.log(dim(`  Tip: start with the INIT agent to scaffold the backend first, or UI agent for the client.\n`));
      const repick = await arrowConfirm('Pick a different agent?', rl);
      if (repick) continue agentLoop;
      console.log(yellow('\n  Aborted.\n')); rl.close(); return;
    }
  }

  // Prerequisite check
  const prereqs = (AGENT_PREREQUISITES[project] || {})[agent] || [];
  if (prereqs.length > 0) {
    const missing = prereqs.filter(req =>
      !buildEntries.some(e => e.scope === project && e.agent === req && e.status === 'COMPLETED')
    );
    if (missing.length > 0) {
      console.log(`\n${yellow(`  ⚠ ${agent} has unmet prerequisites:`)}\n`);
      missing.forEach(req => {
        const entry = buildEntries.find(e => e.scope === project && e.agent === req);
        const status = entry ? yellow(entry.status) : red('NOT STARTED');
        console.log(`  ${dim('→')} ${bold(`${project} / ${req}`)}  ${dim('|')}  ${status}`);
      });
      console.log('');
      const repickIdx = await arrowSelect('Prerequisites not met:', [
        { label: `${green('→')} Proceed anyway` },
        { label: `${yellow('←')} Pick a different agent` },
      ], rl);
      if (repickIdx === 1) continue agentLoop;
    }
  }

  // Contracts check

  if (CONTRACTS_REQUIRED.includes(agent) && !contracts.hasContent) {
    console.log(`\n${yellow('  ℹ CONTRACTS.md is empty')} ${dim('- no shared types or DTOs defined yet.')}\n`);
    const assist = await arrowConfirm('Would you like the agent to establish contracts for your app?', rl);
    if (assist) {
      contractsNote = 'Before implementing, identify and define the required shared contracts, types, and interfaces in CONTRACTS.md first.';
      console.log(dim('\n  ✓ Agent will establish contracts as the first step.\n'));
    } else {
      console.log(dim('\n  You can define the structure here, or the agent will adapt.'));
      const manual = await ask(`  ${bold('Provide contract structure')} ${dim('(or press Enter to skip)')}: \n  → `);
      if (manual.trim()) {
        contractsNote = `Contract structure provided:\n${manual.trim()}\nUse this as the basis for CONTRACTS.md.`;
        console.log(dim('  ✓ Contract structure noted.\n'));
      } else {
        console.log(dim('  Agent will flag type assumptions as it builds.\n'));
      }
    }
  }

  break agentLoop;
  } // end agentLoop
  } // end else (argAgent bypass)
  } // end if (project !== 'cloud')

  // ── Task description ──────────────────────────────────────────────────────────

  separator();
  const defaultTask = (AGENT_DESCRIPTIONS[project] || {})[agent] || '';
  task = '';

  if (prompts && process.stdin.isTTY) {
    const res = await prompts({
      type:    'text',
      name:    'value',
      message: `* Task description (${agent} agent)`,
      initial: defaultTask ? `e.g. ${defaultTask}` : '',
    }, { onCancel: () => process.exit(0) });

    if (res.value === undefined) continue flowLoop; // Esc = back
    const rawValue = (res.value || '').trim();
    const isPlaceholder = rawValue.startsWith('e.g. ') && rawValue === `e.g. ${defaultTask}`;
    task = isPlaceholder ? defaultTask : (rawValue || defaultTask);
    if (!task) task = defaultTask;
  } else {
    let goBackToAgent = false;
    while (!task) {
      if (defaultTask) {
        console.log(`\n${bold(`* Task description (${agent} agent)`)} ${dim(`[default: ${defaultTask}]`)}`);
        console.log(dim('  (Enter = use default  |  b = back to agent selection)'));
        const input = await ask(`  → `);
        if (input.toLowerCase() === 'b') { goBackToAgent = true; break; }
        task = input || defaultTask;
      } else {
        console.log(dim('  (b = back to agent selection)'));
        const input = await ask(`\n${bold(`* Task description (${agent} agent)`)}: `);
        if (input.toLowerCase() === 'b') { goBackToAgent = true; break; }
        task = input;
        if (!task) console.log(yellow('  Task description is required.'));
      }
    }
    if (goBackToAgent) continue flowLoop;
  }

  if (!task) continue flowLoop;

  // ── Agent context questions ───────────────────────────────────────────────────

  let answers  = {};
  let skipped  = [];
  contextSection = '';

  if (AGENT_QUESTIONS[agent]) {
    let gathering = true;
    while (gathering) {
      const result = await gatherAgentContext(agent);
      answers = result.answers;
      skipped = result.skipped;

      if (skipped.length > 0) {
        const ack = await acknowledgeSkipped(skipped);
        if (ack === null) continue;   // 'e' - go back and re-gather
        if (ack === false) {          // 'n' - abort
          console.log(yellow('\n  Aborted.\n'));
          rl.close();
          return;
        }
        gathering = false;            // 'confirm' - proceed
      } else {
        gathering = false;
      }
    }
    contextSection = generateContextSection(answers, skipped);
  }

  // Append contracts note if agent-assist was requested
  if (contractsNote) {
    contextSection += `\n---\n\n## Contracts Instruction\n\n${contractsNote}\n`;
  }

  // Inject wiring.config.json for agents that need it
  const WIRING_AGENTS = ['INIT', 'API', 'LOGIC', 'CLOUD'];
  if (WIRING_AGENTS.includes(agent)) {
    const wiringPath = path.join(ROOT, 'shared', 'wiring.config.json');
    if (fs.existsSync(wiringPath)) {
      const wiringContent = fs.readFileSync(wiringPath, 'utf8');
      contextSection += `\n---\n\n## Wiring Config\n\n\`\`\`json\n${wiringContent}\n\`\`\`\n\nThis is the agreed variable naming contract for client\u2194backend wiring. Read before implementing any environment config, API calls, or deployment steps.\n`;
    }
  }

  separator();

  // ── Confirm ───────────────────────────────────────────────────────────────────

  timestamp     = Date.now();
  sanitizedName = config.projectName.toLowerCase().replace(/\s+/g, '-');
  worktreeName  = `${project}-${sanitizedName}-${agent.toLowerCase()}-${timestamp}`;
  branchName    = `agent/${project}/${agent.toLowerCase()}/${timestamp}`;
  worktreePath  = path.join(ROOT, 'worktrees', worktreeName);

  console.log(`\n${bold('Review:')}\n`);
  console.log(`  ${dim('Project')}  : ${green(project)}`);
  console.log(`  ${dim('Agent')}    : ${green(agent)}`);
  console.log(`  ${dim('Branch')}   : ${green(branchName)}`);
  console.log(`  ${dim('Worktree')} : ${green(`worktrees/${worktreeName}`)}`);
  console.log(`  ${dim('Task')}     : ${green(task)}`);
  if (Object.keys(answers).length > 0) {
    console.log(`  ${dim('Context')}  : ${green(Object.keys(answers).length + ' field(s) provided')}`);
  }
  if (skipped.length > 0) {
    console.log(`  ${dim('Skipped')}  : ${yellow(skipped.length + ' field(s) acknowledged')}`);
  }
  if (contractsNote) {
    console.log(`  ${dim('Contracts')}: ${green('agent will establish first')}`);
  }
  console.log('');

  const confirmIdx = await arrowSelect('Confirm?', [
    { label: `${green('✓')} Confirm - set up workspace` },
    { label: `${yellow('←')} Back - change something` },
    { label: `${red('✗')} Abort` },
  ], rl);

  if (confirmIdx === 1) continue flowLoop;
  if (confirmIdx === 2) {
    console.log(yellow('\n  Aborted.\n'));
    rl.close();
    return;
  }

  break flowLoop;
  } // end flowLoop
  separator();
  console.log(`\n${bold('Setting up workspace...')}\n`);

  // ── Remote setup flag check ───────────────────────────────────────────────────

  const remoteFlagPath   = path.join(ROOT, '.scaffold', '.remote-setup-needed');
  const remoteSetupNeeded = fs.existsSync(remoteFlagPath);

  const remoteSetupSection = remoteSetupNeeded ? `
---

## ⚠ Pre-Task: Remote Setup Required
This project has no GitHub remote configured yet.
Complete ALL steps below BEFORE starting task implementation.

- [ ] Check: \`git remote get-url origin\`
- [ ] Detect gh CLI: \`gh auth status\`
- [ ] Configure remote (gh create or manual - see Root CLAUDE.md)
- [ ] Validate: \`git ls-remote origin HEAD\`
- [ ] Push: \`git push -u origin main\`
- [ ] Delete \`.scaffold/.remote-setup-needed\`

Mark each step complete. Only proceed to the task below when all are checked.

---
` : '';

  if (remoteSetupNeeded) {
    console.log(`  ${yellow('ℹ Remote setup required')} - agent will handle this first.\n`);
  }

  // ── Create worktree ───────────────────────────────────────────────────────────

  try {
    execSync(`git worktree add "${worktreePath}" -b ${branchName}`, {
      cwd: ROOT,
      stdio: 'pipe',
    });
    console.log(`  ${green('✓')} Worktree created: worktrees/${worktreeName}`);
  } catch (err) {
    console.log(`  ${yellow('!')} Worktree may already exist - continuing.`);
  }

  // ── Write .claude-scope ───────────────────────────────────────────────────────

  fs.writeFileSync(
    path.join(worktreePath, '.claude-scope'),
    generateClaudeScope({ project, agent, branchName, worktreePath }),
    'utf8'
  );
  console.log(`  ${green('✓')} .claude-scope written`);

  // ── Generate IDE settings ─────────────────────────────────────────────────────

  const excludedFolders = {
    'client':  ['backend/', 'worktrees/', '.scaffold/', '.workflow/'],
    'backend': ['client/', 'worktrees/', '.scaffold/', '.workflow/'],
    'shared':  ['client/', 'backend/', 'worktrees/', '.scaffold/', '.workflow/'],
  };
  const foldersToHide = excludedFolders[project] || [];

  const vscodeDir = path.join(worktreePath, '.vscode');
  fs.mkdirSync(vscodeDir, { recursive: true });
  const vscodeSettings = {
    'files.exclude': {
      ...Object.fromEntries(foldersToHide.map(f => [f, true])),
      '.idea/':          true,
      '.zed/':           true,
      '.agents/':        true,
      '.frameworks/':    true,
      '**/node_modules': true,
    },
    'search.exclude': {
      '**/node_modules': true,
    },
    'explorer.excludeGitIgnore': true,
  };
  fs.writeFileSync(
    path.join(vscodeDir, 'settings.json'),
    JSON.stringify(vscodeSettings, null, 2),
    'utf8'
  );
  console.log(`  ${green('✓')} .vscode/settings.json generated`);

  // ── JetBrains .idea/ exclusions ───────────────────────────────────────────────

  const ideaDir = path.join(worktreePath, '.idea');
  fs.mkdirSync(ideaDir, { recursive: true });
  const allExcluded = [...foldersToHide, '.agents/', '.frameworks/', 'node_modules/'];
  const excludedUrls = allExcluded
    .map(f => `    <excludeFolder url="file://$MODULE_DIR$/${f.replace(/\/$/, '')}" />`)
    .join('\n');
  const ideaModuleXml = `<?xml version="1.0" encoding="UTF-8"?>
<module type="WEB_MODULE" version="4">
  <component name="NewModuleRootManager">
    <content url="file://$MODULE_DIR$">
${excludedUrls}
    </content>
    <orderEntry type="inheritedJdk" />
    <orderEntry type="sourceFolder" forTests="false" />
  </component>
</module>`;
  fs.writeFileSync(path.join(ideaDir, 'module.iml'), ideaModuleXml, 'utf8');
  fs.writeFileSync(path.join(ideaDir, 'modules.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
  <component name="ProjectModuleManager">
    <modules>
      <module fileurl="file://$PROJECT_DIR$/.idea/module.iml" filepath="$PROJECT_DIR$/.idea/module.iml" />
    </modules>
  </component>
</project>`, 'utf8');
  console.log(`  ${green('✓')} .idea/ exclusions generated`);

  // ── Zed .zed/settings.json exclusions ────────────────────────────────────────

  const zedDir = path.join(worktreePath, '.zed');
  fs.mkdirSync(zedDir, { recursive: true });
  const zedSettings = {
    'file_scan_exclusions': [
      '**/.git',
      '**/.idea',
      '**/.agents',
      '**/.frameworks',
      '**/node_modules',
      ...foldersToHide.map(f => `**/${f.replace(/\/$/, '')}`),
    ],
  };
  fs.writeFileSync(
    path.join(zedDir, 'settings.json'),
    JSON.stringify(zedSettings, null, 2),
    'utf8'
  );
  console.log(`  ${green('✓')} .zed/settings.json generated`);

  // ── Write TASK.md ─────────────────────────────────────────────────────────────

  fs.writeFileSync(
    path.join(worktreePath, 'TASK.md'),
    generateTaskMd({ project, agent, task, branchName, contextSection, remoteSetupSection }),
    'utf8'
  );
  console.log(`  ${green('✓')} TASK.md written`);

  // ── Write session to TASKS_HISTORY.md ────────────────────────────────────────
  tasksHistory.ensureHistoryFile(ROOT);
  tasksHistory.writeSessionEntry(ROOT, {
    scope:      project,
    agent,
    branch:     branchName,
    task,
    launchedAt: new Date().toISOString(),
  });
  console.log(`  ${green('✓')} Session logged to TASKS_HISTORY.md`);

  // ── Write package.json proxy ──────────────────────────────────────────────────

  const worktreePackage = {
    name:    `${config.projectName.toLowerCase().replace(/\s+/g, '-')}-worktree`,
    version: '1.0.0',
    private: true,
    scripts: {
      init:     'multi-agents init',
      agent:    'node .workflow/agent.js',
      restart:  'node .workflow/restart.js',
      reset:    'node .workflow/reset.js',
      complete: 'node .workflow/complete.js',
    },
  };
  fs.writeFileSync(
    path.join(worktreePath, 'package.json'),
    JSON.stringify(worktreePackage, null, 2),
    'utf8'
  );
  console.log(`  ${green('✓')} package.json proxy written`);

  // ── Write .tracking.json slot

  guards.updateTrackingSlot(tracking, project, agent, {
    branch:       branchName,
    timestamp,
    launchedAt:   new Date().toISOString(),
    status:       'ACTIVE',
    worktreePath,
  }, ROOT);
  console.log(`  ${green('✓')} Tracking updated`);

  // ── Update BUILD_STATE.md ─────────────────────────────────────────────────────

  const buildStatePath = path.join(ROOT, 'BUILD_STATE.md');
  if (fs.existsSync(buildStatePath)) {
    const date     = new Date().toISOString().split('T')[0];
    const logEntry = `| ${date} | ${agent} | ${project} | ${task} | IN PROGRESS | ${branchName} |\n`;
    fs.appendFileSync(buildStatePath, logEntry, 'utf8');
    console.log(`  ${green('✓')} BUILD_STATE.md updated`);

    try {
      execSync('git add BUILD_STATE.md', { cwd: ROOT, stdio: 'pipe' });
      execSync(`git commit --no-verify -m "build: ${agent} task started on ${project} [${branchName}]"`, { cwd: ROOT, stdio: 'pipe' });
      console.log(`  ${green('✓')} BUILD_STATE.md committed to main`);
    } catch (err) {
      console.log(`  ${yellow('!')} Could not commit BUILD_STATE.md - commit manually if needed`);
    }
  }

  // ── Ready to open workspace? ──────────────────────────────────────────────────

  separator();
  console.log(`\n${bold('  Workspace is set up and ready.')}`);
  console.log(dim(`  Worktree: worktrees/${worktreeName}\n`));
  console.log(`  ${yellow('⚠')}  ${bold('Once your IDE opens and is ready, open a NEW session in Claude Code CLI or Claude Code Extension - and type go or start to initiate')}`);
  console.log(dim('     Do NOT reuse a previous session - the agent needs a clean context.'));

  const openNow = await arrowConfirm('Open workspace now?', rl);

  if (!openNow) {
    console.clear();
    separator();
    console.log(`\n${bold(yellow('  Workspace saved - resume when ready:'))}\n`);
    console.log(`  ${bold('1.')} Open your IDE at:`);
    console.log(`     ${cyan(worktreePath)}\n`);
    console.log(`  ${bold('2.')} Open a ${bold('NEW')} session in Claude Code CLI or Claude Code Extension - and type go or start to initiate`);
    console.log(dim('     Do NOT reuse a previous session.\n'));
    console.log(`  ${bold('3.')} Start the session and let the agent run.\n`);
    separator();
    console.log('');
    rl.close();
    return;
  }

  // ── Open IDE ──────────────────────────────────────────────────────────────────

  const openedIDE = openIDE(worktreePath);
  if (openedIDE) {
    console.log(`  ${green('✓')} ${openedIDE} opened at worktrees/${worktreeName}`);
  } else {
    console.log(`  ${yellow('!')} Could not open IDE automatically.`);
    console.log(dim(`     Open manually at: ${worktreePath}`));
  }

  // ── Launch Claude Code CLI ──────────────────────────────────────────────────

  let claudeLaunched = false;
  try {
    const { spawn: sp } = require('child_process');
    const claudeProc = sp('claude', [], { cwd: worktreePath, stdio: 'inherit', detached: false });
    claudeProc.on('error', () => {});
    claudeLaunched = true;
  } catch {}

  if (claudeLaunched) { rl.close(); return; }

  // ── Next steps ────────────────────────────────────────────────────────────────

  separator();
  console.log(`\n${bold(green('  Workspace ready!'))}\n`);
  console.log(`  ${bold('1.')} Your IDE should be open at: ${cyan(`worktrees/${worktreeName}`)}`);
  console.log(dim('     If not, open it manually at the path above.\n'));
  console.log(`  ${bold('2.')} ${bold(yellow('Open a NEW session in Claude Code CLI or Claude Code Extension - and type go or start to initiate'))}`);
  console.log(dim('     Do NOT reuse a previous session.\n'));
  console.log(`  ${bold('3.')} Start the session and let the agent run.\n`);
  console.log(dim('     The agent will run `') + cyan('npm run complete') + dim('` autonomously when the task is done.\n'));
  separator();
  console.log('');

  rl.close();
};

main().catch((err) => {
  console.error('\n  Error:', err.message);
  process.exit(1);
});
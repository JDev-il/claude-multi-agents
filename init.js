#!/usr/bin/env node

/**
 * multi-agents - Project Initializer
 * Run with: npm run init           (inside existing project)
 *        or: multi-agents init my-project  (global CLI)
 *
 * Runs once. Locked after completion via .scaffold/.initialized
 */

const readline  = require('readline');
const fs        = require('fs');
const path      = require('path');

// ── Prompts (arrow-key navigation) ───────────────────────────────────────────

let prompts;
try { prompts = require('prompts'); } catch { prompts = null; }

const arrowSelect = async (message, choices, rl, showBack = false) => {
  const allChoices = showBack
    ? [...choices, { label: dim('← Restart configuration') }]
    : choices;

  if (prompts && process.stdin.isTTY) {
    const res = await prompts({
      type:    'select',
      name:    'value',
      message,
      choices: allChoices.map((c, i) => ({ title: typeof c === 'string' ? c : c.label, value: i })),
    }, { onCancel: () => process.exit(0) });
    return res.value ?? 0;
  }
  allChoices.forEach((c, i) => console.log(`  ${dim(`${i + 1}.`)} ${typeof c === 'string' ? c : c.label}`));
  return new Promise(resolve => {
    rl.question(`\n  Select (1-${allChoices.length}): `, ans => {
      const n = parseInt(ans) - 1;
      resolve(!isNaN(n) && n >= 0 && n < allChoices.length ? n : 0);
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
const os        = require('os');
const { execSync, spawn } = require('child_process');

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

// ── CLI argument handling ─────────────────────────────────────────────────────

const args        = process.argv.slice(2);
const isGlobalCLI = args[0] === 'init' && args[1];
const isReInit    = args[0] === 'init' && !args[1];
const projectArg  = isGlobalCLI ? args[1] : null;

if (isReInit) {
  // Re-init from inside project or worktree - self-relocate to repo root
  try {
    const { execSync } = require('child_process');
    const gitCommonDir = execSync('git rev-parse --git-common-dir', { encoding: 'utf8' }).trim();
    const repoRoot = require('path').resolve(gitCommonDir, '..');
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

    // Write temporary package.json so npm run init works if abandoned mid-init
    fs.writeFileSync(
      path.join(targetDir, 'package.json'),
      JSON.stringify({ name: path.basename(targetDir), version: '1.0.0', scripts: { init: 'multi-agents init' } }, null, 2),
      'utf8'
    );

    // Initialize git
    try {
      execSync('git init -b main', { cwd: targetDir, stdio: 'pipe' });
      execSync('git commit --allow-empty -m "init: project created"', { cwd: targetDir, stdio: 'pipe' });
    } catch {
      // Fallback for older git versions that don't support -b flag
      try {
        execSync('git init', { cwd: targetDir, stdio: 'pipe' });
        execSync('git checkout -b main', { cwd: targetDir, stdio: 'pipe' });
        execSync('git commit --allow-empty -m "init: project created"', { cwd: targetDir, stdio: 'pipe' });
      } catch { /* continue */ }
    }
  }
}

// ── Lock check ────────────────────────────────────────────────────────────────

const ROOT        = process.cwd();
const RUNTIME_DIR = path.join(ROOT, '.scaffold');
const LOCK_FILE   = path.join(RUNTIME_DIR, '.initialized');

// Ensure .scaffold/ exists
if (!fs.existsSync(RUNTIME_DIR)) {
  fs.mkdirSync(RUNTIME_DIR, { recursive: true });
}

// ── Decision tree ─────────────────────────────────────────────────────────────

const FRAMEWORK_CONVENTIONS = {
  client: {
    'Next.js':    { root: 'client', typesDir: 'client/src/types',             importAlias: '@/types'      },
    'Angular':    { root: 'client', typesDir: 'client/src/app/core/types',    importAlias: null           },
    'Nuxt':       { root: 'client', typesDir: 'client/types',                 importAlias: '~/types'      },
    'SvelteKit':  { root: 'client', typesDir: 'client/src/lib/types',         importAlias: '$lib/types'   },
    'Vite+React': { root: 'client', typesDir: 'client/src/types',             importAlias: null           },
    'Remix':      { root: 'client', typesDir: 'client/app/types',             importAlias: null           },
  },
  backend: {
    'Express':    { root: 'backend', typesDir:   'backend/src/types',         routesDir:  'backend/src/routes'      },
    'NestJS':     { root: 'backend', dtoDir:     'backend/src/dto',           entitiesDir:'backend/src/entities'    },
    'Fastify':    { root: 'backend', typesDir:   'backend/src/types',         routesDir:  'backend/src/routes'      },
    'FastAPI':    { root: 'backend', schemasDir: 'backend/app/schemas',       modelsDir:  'backend/app/models'      },
    'Django':     { root: 'backend', schemasDir: 'backend/api/serializers',   modelsDir:  'backend/api/models'      },
  },
};

const CLIENT_FRAMEWORKS = [
  { label: 'Next.js',       value: 'Next.js',    language: 'TypeScript', integratedBackend: true  },
  { label: 'Angular',       value: 'Angular',    language: 'TypeScript', integratedBackend: false },
  { label: 'Vue / Nuxt',    value: 'Nuxt',       language: 'TypeScript', integratedBackend: true  },
  { label: 'SvelteKit',     value: 'SvelteKit',  language: 'TypeScript', integratedBackend: true  },
  { label: 'Remix',         value: 'Remix',      language: 'TypeScript', integratedBackend: true  },
  { label: 'Vite + React',  value: 'Vite+React', language: 'TypeScript', integratedBackend: false },
];

const BACKEND_FRAMEWORKS = [
  { label: 'NestJS',   value: 'NestJS',   language: 'TypeScript' },
  { label: 'Express',  value: 'Express',  language: 'TypeScript' },
  { label: 'Fastify',  value: 'Fastify',  language: 'TypeScript' },
  { label: 'Django',   value: 'Django',   language: 'Python'     },
  { label: 'FastAPI',  value: 'FastAPI',  language: 'Python'     },
  { label: 'Laravel',  value: 'Laravel',  language: 'PHP'        },
  { label: 'Rails',    value: 'Rails',    language: 'Ruby'       },
];

// ── Framework version registry ────────────────────────────────────────────────

const FRAMEWORK_REGISTRY = {
  'Next.js':    { registry: 'npm',  package: 'next'               },
  'Angular':    { registry: 'npm',  package: '@angular/core'      },
  'Nuxt':       { registry: 'npm',  package: 'nuxt'               },
  'SvelteKit':  { registry: 'npm',  package: '@sveltejs/kit'      },
  'Remix':      { registry: 'npm',  package: '@remix-run/react'   },
  'Vite+React': { registry: 'npm',  package: 'vite'               },
  'NestJS':     { registry: 'npm',  package: '@nestjs/core'       },
  'Express':    { registry: 'npm',  package: 'express'            },
  'Fastify':    { registry: 'npm',  package: 'fastify'            },
  'FastAPI':    { registry: 'pypi', package: 'fastapi'            },
  'Django':     { registry: 'pypi', package: 'django'             },
  'Laravel':    { registry: 'npm',  package: null                 }, // skip — no npm package
  'Rails':      { registry: 'npm',  package: null                 }, // skip — no npm package
};

const FRAMEWORK_VERSION_FALLBACK = {
  'Next.js':    ['15', '14', '13'],
  'Angular':    ['22', '21', '20'],
  'Nuxt':       ['3',  '2',  null],
  'SvelteKit':  ['2',  '1',  null],
  'Remix':      ['2',  '1',  null],
  'Vite+React': ['8',  '7',  '6'],
  'NestJS':     ['11', '10', '9' ],
  'Express':    ['5',  '4'],
  'Fastify':    ['5',  '4',  null],
  'FastAPI':    ['0.115', '0.111', '0.104'],
  'Django':     ['5.1', '4.2', '3.2'],
};

const fetchLatestVersions = async (frameworkValue) => {
  const entry = FRAMEWORK_REGISTRY[frameworkValue];
  if (!entry || !entry.package) return null;

  try {
    const https = require('https');
    const fetch = (url) => new Promise((resolve, reject) => {
      const req = https.get(url, { timeout: 3000 }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    });

    if (entry.registry === 'npm') {
      const raw  = await fetch(`https://registry.npmjs.org/${entry.package}`);
      const json = JSON.parse(raw);
      const versions = Object.keys(json.versions || {})
        .filter(v => /^\d+\.\d+\.\d+$/.test(v) && !v.includes('-'))
        .map(v => parseInt(v.split('.')[0]))
        .filter((v, i, arr) => arr.indexOf(v) === i)
        .sort((a, b) => b - a)
        .slice(0, 3);
      return versions.length ? versions.map(String) : null;
    }

    if (entry.registry === 'pypi') {
      const raw  = await fetch(`https://pypi.org/pypi/${entry.package}/json`);
      const json = JSON.parse(raw);
      const versions = Object.keys(json.releases || {})
        .filter(v => /^\d+\.\d+(\.\d+)?$/.test(v))
        .sort((a, b) => {
          const [aMaj, aMin = 0] = a.split('.').map(Number);
          const [bMaj, bMin = 0] = b.split('.').map(Number);
          return bMaj !== aMaj ? bMaj - aMaj : bMin - aMin;
        })
        .map(v => v.split('.').slice(0, 2).join('.'))
        .filter((v, i, arr) => arr.indexOf(v) === i)
        .slice(0, 3);
      return versions.length ? versions : null;
    }
  } catch {
    return null;
  }
  return null;
};

const STATE_OPTIONS = {
  'Next.js':    ['Zustand', 'Redux Toolkit', 'Jotai', 'TanStack Query'],
  'Vite+React': ['Zustand', 'Redux Toolkit', 'Jotai', 'TanStack Query'],
  'Remix':      ['Zustand', 'Redux Toolkit', 'Jotai', 'TanStack Query'],
  'Angular':    ['NgRx', 'Signals (built-in)', 'Akita'],
  'Nuxt':       ['Pinia', 'Vuex'],
  'SvelteKit':  ['Svelte stores (built-in)', 'Zustand'],
};

const UI_OPTIONS = {
  'Next.js':    ['shadcn/ui', 'Radix UI', 'MUI', 'Chakra UI', 'Ant Design'],
  'Vite+React': ['Radix UI', 'MUI', 'Chakra UI', 'Ant Design'],
  'Remix':      ['shadcn/ui', 'Radix UI', 'MUI', 'Chakra UI', 'Ant Design'],
  'Angular':    ['Angular Material', 'PrimeNG', 'Clarity'],
  'Nuxt':       ['Vuetify', 'PrimeVue', 'Naive UI'],
  'SvelteKit':  ['Skeleton', 'daisyUI', 'shadcn-svelte'],
};

const STYLING_OPTIONS = [
  'Tailwind CSS',
  'CSS Modules',
  'Styled Components',
  'SCSS / SASS',
  'UnoCSS',
];

const DB_OPTIONS = ['PostgreSQL', 'MySQL', 'MongoDB', 'SQLite', 'Skip (agent will propose when needed)'];

const ORM_OPTIONS_BY_DB = {
  'PostgreSQL': ['Prisma', 'TypeORM', 'Drizzle', 'Sequelize', 'raw pg driver', 'Skip (agent will propose when needed)'],
  'MySQL':      ['Prisma', 'TypeORM', 'Drizzle', 'Sequelize', 'raw mysql2 driver', 'Skip (agent will propose when needed)'],
  'MongoDB':    ['Mongoose', 'Prisma', 'raw MongoDB driver', 'Skip (agent will propose when needed)'],
  'SQLite':     ['Prisma', 'Drizzle', 'better-sqlite3', 'Skip (agent will propose when needed)'],
};

const ORM_OPTIONS = {
  'NestJS':   ['TypeORM', 'Prisma', 'MikroORM', 'Drizzle'],
  'Express':  ['Prisma', 'TypeORM', 'Drizzle', 'Sequelize'],
  'Fastify':  ['Prisma', 'TypeORM', 'Drizzle'],
  'Django':   ['Django ORM (built-in)', 'SQLAlchemy'],
  'FastAPI':  ['SQLAlchemy', 'Tortoise ORM', 'Beanie (MongoDB)'],
  'Laravel':  ['Eloquent (built-in)'],
  'Rails':    ['Active Record (built-in)'],
};

const AUTH_OPTIONS = {
  'NestJS':   ['Passport.js', 'JWT-only', 'OAuth2', 'Auth.js'],
  'Express':  ['Passport.js', 'JWT-only', 'OAuth2'],
  'Fastify':  ['fastify-jwt', 'Passport.js', 'OAuth2'],
  'Django':   ['Django Auth (built-in)', 'DRF TokenAuth', 'OAuth2'],
  'FastAPI':  ['JWT-only', 'OAuth2', 'FastAPI-Users'],
  'Laravel':  ['Laravel Sanctum', 'Laravel Passport', 'JWT'],
  'Rails':    ['Devise', 'JWT', 'OAuth2'],
};

const IDE_CANDIDATES = [
  {
    cmd:     'code',
    name:    'VS Code',
    mac:     { app: 'Visual Studio Code', args: ['--new-window'] },
    win:     { paths: ['{LOCALAPPDATA}\\Programs\\Microsoft VS Code\\Code.exe', '{ProgramFiles}\\Microsoft VS Code\\Code.exe'], args: ['--new-window'] },
    linux:   { paths: ['/snap/bin/code', '/usr/bin/code', '/usr/local/bin/code'], args: ['--new-window'] },
  },
  {
    cmd:     'cursor',
    name:    'Cursor',
    mac:     { app: 'Cursor', args: ['--new-window'] },
    win:     { paths: ['{LOCALAPPDATA}\\Programs\\cursor\\Cursor.exe'], args: ['--new-window'] },
    linux:   { paths: ['/usr/bin/cursor', '/opt/cursor/cursor'], args: ['--new-window'] },
  },
  {
    cmd:     'webstorm',
    name:    'WebStorm',
    mac:     { app: 'WebStorm', toolboxApp: 'WebStorm', args: [] },
    win:     { paths: [
      '{LOCALAPPDATA}\\JetBrains\\Toolbox\\scripts\\webstorm.cmd',
      '{LOCALAPPDATA}\\Programs\\WebStorm\\bin\\webstorm64.exe',
    ], args: [] },
    linux:   { paths: [
      `${os.homedir()}/.local/bin/webstorm`,
      '/opt/webstorm/bin/webstorm.sh',
      '/snap/webstorm/current/bin/webstorm.sh',
    ], args: [] },
  },
  {
    cmd:     'idea',
    name:    'IntelliJ IDEA',
    mac:     { app: 'IntelliJ IDEA', toolboxApp: 'IntelliJ IDEA', args: [] },
    win:     { paths: [
      '{LOCALAPPDATA}\\JetBrains\\Toolbox\\scripts\\idea.cmd',
      '{LOCALAPPDATA}\\Programs\\IntelliJ IDEA Community Edition\\bin\\idea64.exe',
      '{ProgramFiles}\\JetBrains\\IntelliJ IDEA\\bin\\idea64.exe',
    ], args: [] },
    linux:   { paths: [
      `${os.homedir()}/.local/bin/idea`,
      '/opt/idea/bin/idea.sh',
      '/snap/intellij-idea-community/current/bin/idea.sh',
    ], args: [] },
  },
  {
    cmd:     'zed',
    name:    'Zed',
    mac:     { app: 'Zed', args: [] },
    win:     { paths: [], args: [] },
    linux:   { paths: ['/usr/bin/zed', `${os.homedir()}/.local/bin/zed`], args: [] },
  },
  {
    cmd:  null,
    name: 'Other / Manual',
    note: 'prints worktree path, open it yourself',
    mac:  null,
    win:  null,
    linux:null,
  },
];

// Expands {LOCALAPPDATA} / {ProgramFiles} placeholders for Windows paths
const expandWinPath = (p) =>
  p.replace('{LOCALAPPDATA}',  process.env.LOCALAPPDATA  || '')
   .replace('{ProgramFiles}',  process.env.ProgramFiles  || 'C:\\Program Files');

const buildIDEOptions = () => {
  const platform = process.platform;

  return IDE_CANDIDATES.map(ide => {
    if (!ide.cmd) {
      const noteStr = ide.note ? dim(`  (${ide.note})`) : '';
      return { ...ide, detected: false, strategy: 'manual', label: `${ide.name}   ${dim('→')}${noteStr}` };
    }

    let detected  = false;
    let strategy  = 'cli';

    if (platform === 'darwin' && ide.mac) {
      // Mac — check .app bundle in /Applications, ~/Applications, and JetBrains Toolbox
      const system   = `/Applications/${ide.mac.app}.app`;
      const user     = path.join(os.homedir(), 'Applications', `${ide.mac.app}.app`);
      const toolbox  = path.join(os.homedir(), 'Applications', 'JetBrains Toolbox', `${ide.mac.app}.app`);
      detected = fs.existsSync(system) || fs.existsSync(user) || fs.existsSync(toolbox);
      if (detected) strategy = 'mac-app';

    } else if (platform === 'win32' && ide.win) {
      // Windows — CLI first, then known exe paths
      try {
        execSync(`where ${ide.cmd}`, { stdio: 'pipe' });
        detected = true;
        strategy  = 'cli';
      } catch {
        const expanded = (ide.win.paths || []).map(expandWinPath);
        detected = expanded.some(p => fs.existsSync(p));
        if (detected) strategy = 'win-exe';
      }

    } else if (platform === 'linux' && ide.linux) {
      // Linux — CLI first, then known install paths
      try {
        execSync(`which ${ide.cmd}`, { stdio: 'pipe' });
        detected = true;
        strategy  = 'cli';
      } catch {
        detected = (ide.linux.paths || []).some(p => fs.existsSync(p));
        if (detected) strategy = 'linux-path';
      }
    }

    const statusStr = detected ? green('✓ detected') : dim('✗ not found');
    const noteStr   = ide.note ? dim(`  (${ide.note})`) : '';
    return {
      ...ide,
      detected,
      strategy,
      label: `${ide.name}   ${statusStr}${noteStr}`,
    };
  });
};

const verifyIDE = (ide) => {
  const platform = process.platform;

  if (ide.strategy === 'mac-app' && ide.mac) {
    // Mac — confirm .app exists and try to read version from plist
    const appPath = `/Applications/${ide.mac.app}.app`;
    if (!fs.existsSync(appPath) && !fs.existsSync(path.join(os.homedir(), 'Applications', `${ide.mac.app}.app`))) {
      return { ok: false };
    }
    try {
      const version = execSync(
        `defaults read "/Applications/${ide.mac.app}.app/Contents/Info.plist" CFBundleShortVersionString`,
        { stdio: 'pipe', encoding: 'utf8' }
      ).trim();
      return { ok: true, version };
    } catch {
      return { ok: true, version: null };
    }
  }

  // Windows exe / Linux path / CLI — try --version
  try {
    const cmd = ide.strategy === 'win-exe'
      ? `"${(ide.win?.paths || []).map(expandWinPath).find(p => fs.existsSync(p))}"`
      : ide.strategy === 'linux-path'
        ? `"${(ide.linux?.paths || []).find(p => fs.existsSync(p))}"`
        : `"${ide.cmd}"`;
    const result  = execSync(`${cmd} --version`, { stdio: 'pipe', encoding: 'utf8' });
    const version = result.split('\n')[0].trim();
    return { ok: true, version };
  } catch {
    return { ok: false };
  }
};

// ── Tracking structure ────────────────────────────────────────────────────────

const emptySlot = () => ({
  branch:       null,
  timestamp:    null,
  launchedAt:   null,
  status:       null,
  missingCount: 0,
  worktreePath: null,
});

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

// ── GitHub remote setup ───────────────────────────────────────────────────────

const detectGitHubUser = () => {
  try {
    return execSync('gh api user --jq .login',
      { encoding: 'utf8', stdio: 'pipe' }).trim();
  } catch {}
  try {
    return execSync('git config user.name',
      { encoding: 'utf8', stdio: 'pipe' }).trim();
  } catch {}
  return null;
};

const setupUserRemote = (ROOT, projectName) => {
  let currentOrigin = null;
  try {
    currentOrigin = execSync('git remote get-url origin',
      { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' }).trim();
  } catch {}

  // Already has their own remote — nothing to do
  if (currentOrigin && !currentOrigin.includes('multi-agents-template')) return;

  // Demote template origin to upstream
  if (currentOrigin?.includes('multi-agents-template')) {
    try {
      execSync('git remote remove origin', { cwd: ROOT, stdio: 'pipe' });
      execSync(`git remote add upstream ${currentOrigin}`, { cwd: ROOT, stdio: 'pipe' });
      console.log(dim('  ℹ Template remote moved to upstream'));
    } catch {}
  }

  // Write flag — agent will handle remote setup on first session
  const flagPath = path.join(ROOT, '.scaffold', '.remote-setup-needed');
  fs.writeFileSync(flagPath, JSON.stringify({
    projectName,
    createdAt: new Date().toISOString(),
  }), 'utf8');

  console.log(`\n  ${yellow('ℹ No remote configured.')} Your first agent session will set this up.`);
  console.log(dim('  All work stays local until then.\n'));
};

const renderTrajectoryLines = (lines) => {
  const HEADERS = ['Benefits', 'Best for', 'Use agents for', 'Handle manually'];
  lines.forEach(l => {
    if (!l) { console.log(''); return; }
    if (l.startsWith('⚠'))         console.log(`  ${yellow(l)}`);
    else if (HEADERS.includes(l))  console.log(`\n  ${bold(l)}`);
    else if (l.startsWith('·'))    console.log(`  ${l}`);
    else                           console.log(`  ${dim(l)}`);
  });
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const ask = (question) =>
  new Promise((resolve) => rl.question(question, (a) => resolve(a.trim())));

// ── Selection helpers ─────────────────────────────────────────────────────────

const showList = (items, showSkip = false) => {
  items.forEach((item, i) => {
    const label = typeof item === 'string' ? item : item.label;
    console.log(`  ${dim(`${i + 1}.`)} ${label}`);
  });
  if (showSkip) console.log(`  ${dim('0.')} Skip ${dim('(agent will propose when needed)')}`);
};

// Sentinel value returned when user picks ← Restart
const BACK = Symbol('BACK');

const selectRequired = async (prompt, items) => {
  const idx = await arrowSelect(prompt, items.map(i => ({ label: typeof i === 'string' ? i : i.label })), rl, true);
  if (idx === items.length) return BACK;
  return items[idx];
};

const selectOptional = async (prompt, items) => {
  if (!items || items.length === 0) return null;
  const choices = [
    ...items.map(i => ({ label: typeof i === 'string' ? i : i.label })),
    { label: dim('Skip (agent will propose when needed)') },
  ];
  const idx = await arrowSelect(prompt, choices, rl, true);
  if (idx === choices.length) return BACK;
  if (idx === items.length) return null;
  return typeof items[idx] === 'string' ? items[idx] : items[idx].value;
};

const separator = () => console.log(`\n${dim('─'.repeat(60))}`);

// ── Config writer ─────────────────────────────────────────────────────────────

const writeConfig = (filePath, configs) => {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  for (const [key, value] of Object.entries(configs)) {
    if (!value) continue;
    const regex = new RegExp(`(# @config ${key}\\s*:)([^\\n]*)`, 'g');
    content = content.replace(regex, `$1 ${value}`);
  }

  for (const [key, value] of Object.entries(configs)) {
    if (!value) continue;
    const token = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    content = content.replace(token, value);
  }

  fs.writeFileSync(filePath, content, 'utf8');
};

const ensureGitignore = (entry) => {
  const p = path.join(ROOT, '.gitignore');
  const content = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  if (!content.includes(entry)) fs.appendFileSync(p, `\n${entry}\n`);
};

const summaryLine = (label, value) => {
  const padded = label.padEnd(20);
  if (!value) {
    console.log(`  ${dim(padded)}: ${yellow('(skipped - agent will propose when needed)')}`);
  } else {
    console.log(`  ${dim(padded)}: ${green(value)}`);
  }
};

// ── Copy directory ────────────────────────────────────────────────────────────

const copyDir = (src, dest) => {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  fs.readdirSync(src).forEach(file => {
    const srcFile  = path.join(src, file);
    const destFile = path.join(dest, file);
    if (fs.statSync(srcFile).isDirectory()) {
      copyDir(srcFile, destFile);
    } else {
      fs.copyFileSync(srcFile, destFile);
    }
  });
};

// ── Main ──────────────────────────────────────────────────────────────────────

const main = async () => {

  // ── Lock check ───────────────────────────────────────────────────────────────

  if (fs.existsSync(LOCK_FILE)) {
    const ts = fs.readFileSync(LOCK_FILE, 'utf8').trim();
    const trackingPath = path.join(RUNTIME_DIR, '.tracking.json');
    const tracking = fs.existsSync(trackingPath) ? JSON.parse(fs.readFileSync(trackingPath, 'utf8')) : {};

    // Dependency map — primary agents whose restart cascades to dependents
    const DEPENDENCIES = {
      client: { UI: ['LOGIC', 'FORMS', 'ROUTING', 'TESTING', 'ACCESSIBILITY'] },
      backend: { DB: ['API', 'AUTH', 'LOGIC', 'EVENTS', 'JOBS', 'TESTING'] },
      shared: {},
    };

    const getActiveAgents = (scope) => {
      const agents = tracking[scope] || {};
      return Object.entries(agents).filter(([, v]) => v && v.branch);
    };

    const showRestartProcess = async () => {
      // Build list of active processes across all scopes
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
        type: 'select',
        name: 'value',
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

      // Find dependent agents that are also active
      for (const dep of deps) {
        const depData = (tracking[scope] || {})[dep];
        if (depData && depData.branch) {
          affectedAgents.push({ scope, agent: dep, data: depData });
        }
      }

      // Show warning with exact names
      separator();
      console.log(`\n${yellow(`  ⚠ Restarting ${agent} will delete:`)}`);
      for (const { agent: a, data: d } of affectedAgents) {
        console.log(`\n  ${bold(a)}`);
        console.log(`    - Branch        (${d.branch})`);
        console.log(`    - Remote branch (origin/${d.branch})`);
        if (d.worktreePath) {
          const wtName = path.relative(ROOT, d.worktreePath);
          console.log(`    - Worktree      (${wtName})`);
        }
      }

      if (affectedAgents.length > 1) {
        console.log(`\n  ${yellow('Dependent processes will also be wiped.')}`);
      }

      console.log(`\n  ${red('This cannot be undone.')}\n`);

      const confirmRes = await prompts({
        type: 'select',
        name: 'value',
        message: 'Confirm restart?',
        choices: [
          { title: 'Yes - wipe and restart', value: 'y' },
          { title: 'Cancel', value: 'n' },
        ],
      }, { onCancel: () => process.exit(0) });

      if (confirmRes.value !== 'y') {
        console.log(dim('\n  Cancelled.\n'));
        return 'back';
      }

      // Perform wipe
      for (const { agent: a, data: d, scope: s } of affectedAgents) {
        try { execSync(`git worktree remove "${d.worktreePath}" --force`, { cwd: ROOT, stdio: 'pipe' }); } catch {}
        try { execSync(`git branch -D ${d.branch}`, { cwd: ROOT, stdio: 'pipe' }); } catch {}
        try { execSync(`git push origin --delete ${d.branch}`, { cwd: ROOT, stdio: 'pipe' }); } catch {}
        // Clear tracking
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
    console.log(dim(`  To start a task:       `) + cyan('npm run agent'));
    console.log(dim(`  To restart an agent:   `) + cyan('npm run restart'));
    console.log(dim(`  To wipe everything:    `) + cyan('npm run reset') + '\n');

    if (prompts && process.stdin.isTTY) {
      const res = await prompts({
        type:    'select',
        name:    'value',
        message: 'What would you like to do?',
        choices: [
          { title: 'Re-initialize project', description: 'Wipe everything and start fresh', value: '1' },
          { title: 'Cancel',                                                                 value: '2' },
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
        if (confirm.value !== 'yes') {
          console.log(dim('\n  Cancelled.\n'));
          process.exit(0);
        }
        const { spawn: sp } = require('child_process');
        const resetChild = sp('node', [path.join(ROOT, '.workflow', 'reset.js')], { stdio: 'inherit', cwd: ROOT });
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

  console.log(`\n${bold('Let\'s configure your project.')}`);
  console.log(dim('  Use arrow keys to select. Optional fields can be skipped.\n'));
  console.log(dim('  Skipped fields will be resolved by the agent when first needed.\n'));

  // ── Project name ────────────────────────────────────────────────────────────

  let projectName = '';
  while (!projectName) {
    projectName = await ask(`${bold('* Project name')}: `);
    if (!projectName) console.log(yellow('  Project name is required. Please enter a name.'));
  }

  const restartIfBack = (val) => {
    if (val !== BACK) return false;
    rl.close();
    const { spawn } = require('child_process');
    spawn('node', [__filename], { stdio: 'inherit', cwd: ROOT }).on('exit', c => process.exit(c));
    return true;
  };

  separator();

  // ── Client ──────────────────────────────────────────────────────────────────

  console.log(`\n${bold(blue('Client configuration'))}`);

  const clientFw    = await selectRequired('* Client framework (required):', CLIENT_FRAMEWORKS);
  if (restartIfBack(clientFw)) return;

  // ── Client framework version ─────────────────────────────────────────────────
  let clientFwVersion = null;
  const clientVersions = await fetchLatestVersions(clientFw.value) || FRAMEWORK_VERSION_FALLBACK[clientFw.value] || [];
  if (clientVersions.length) {
    console.log(dim('  Fetching latest versions...'));
    const versionChoices = clientVersions.map((v, i) => ({
      label: i === 0 ? `v${v}  ${dim('(latest)')}` : `v${v}`,
      value: v,
    }));
    const versionLabel = clientFw.value === 'Vite+React' ? '* Vite version:' : `* ${clientFw.value} version:`;
    const vIdx = await arrowSelect(versionLabel, versionChoices, rl, true);
    if (vIdx === versionChoices.length) { restartIfBack(BACK); return; }
    clientFwVersion = clientVersions[vIdx];
  }

  const clientLang  = clientFw.language;
  const clientState = await selectOptional('State management:', STATE_OPTIONS[clientFw.value] || []);
  if (restartIfBack(clientState)) return;
  const clientUi    = await selectOptional('UI library:', UI_OPTIONS[clientFw.value] || []);
  if (restartIfBack(clientUi)) return;
  const clientStyle = await selectOptional('Styling:', STYLING_OPTIONS);
  if (restartIfBack(clientStyle)) return;

  separator();

  // ── Backend ─────────────────────────────────────────────────────────────────

  console.log(`\n${bold(blue('Backend configuration'))}`);

  // Check if client framework has integrated backend support
  let useIntegratedBackend = false;
  let backendFw   = null;
  let backendLang = null;
  let backendOrm  = null;
  let backendAuth = null;
  let backendType = null;
  let backendFwObj = null;

  if (clientFw.integratedBackend) {
    console.log(dim(`  ${clientFw.value} supports server-side rendering and API routes.\n`));
    useIntegratedBackend = await arrowConfirm(`Use integrated backend (${clientFw.value} API routes/SSR) instead of a separate backend?`, rl);

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
    const backendIdx = await arrowSelect('Backend framework:', backendChoices, rl);
    backendFwObj = backendIdx === BACKEND_FRAMEWORKS.length ? null : BACKEND_FRAMEWORKS[backendIdx];

    backendFw   = backendFwObj ? backendFwObj.value    : null;
    backendLang = backendFwObj ? backendFwObj.language : null;

    // ── Backend framework version ──────────────────────────────────────────────
    if (backendFw) {
      const backendVersions = await fetchLatestVersions(backendFw) || FRAMEWORK_VERSION_FALLBACK[backendFw] || [];
      if (backendVersions.length) {
        const vChoices = backendVersions.map((v, i) => ({
          label: i === 0 ? `v${v}  ${dim('(latest)')}` : `v${v}`,
          value: v,
        }));
        const vIdx = await arrowSelect(`* ${backendFw} version:`, vChoices, rl, true);
        if (vIdx === vChoices.length) { restartIfBack(BACK); return; }
        backendFwObj = { ...backendFwObj, version: backendVersions[vIdx] };
      }
    }

    // DB type
    let backendDb = null;
    if (backendFw) {
      backendDb = await selectOptional('Database type:', DB_OPTIONS);
      if (restartIfBack(backendDb)) return;
    }
    // ORM / query layer (filtered by DB type)
    backendOrm = null;
    if (backendFw && backendDb && backendDb !== 'Skip (agent will propose when needed)') {
      const ormChoices = ORM_OPTIONS_BY_DB[backendDb] || ORM_OPTIONS[backendFw] || [];
      backendOrm = await selectOptional('ORM / query layer:', ormChoices);
      if (restartIfBack(backendOrm)) return;
    }
    backendAuth = backendFw ? await selectOptional('Auth strategy:', AUTH_OPTIONS[backendFw] || []) : null;
    if (restartIfBack(backendAuth)) return;
    backendType = backendFw ? 'separate' : null;
  }

  separator();

  // ── Environment ─────────────────────────────────────────────────────────────

  console.log(`\n${bold(blue('Environment'))}`);

  const osName = { darwin: 'macOS', win32: 'Windows', linux: 'Linux' }[process.platform] || process.platform;
  console.log(`\n  ${dim('OS detected:')} ${bold(osName)}`);
  console.log(dim('  Scanning for installed IDEs...\n'));

  const ideOptions = buildIDEOptions();

  const detectedIDEs  = ideOptions.filter(o => o.detected);
  const undetectedIDEs = ideOptions.filter(o => !o.detected && o.cmd);
  const manualOption  = ideOptions.filter(o => !o.cmd);

  // Detected first → undetected → manual
  const sortedIdeOptions = [...detectedIDEs, ...undetectedIDEs, ...manualOption];

  if (detectedIDEs.length > 1) {
    console.log(`\n  ${yellow('Multiple IDEs found on this machine')} — select your preference:\n`);
  } else if (detectedIDEs.length === 1) {
    console.log(`\n  ${green(`1 IDE found:`)} ${bold(detectedIDEs[0].name)}\n`);
  } else {
    console.log(`\n  ${yellow('No IDEs detected on this machine.')}\n`);
  }

  let ideChoice;
  while (true) {
    ideChoice = await selectRequired('* IDE / editor (required):', sortedIdeOptions);
    if (restartIfBack(ideChoice)) return;

    // ── Confirmation ──────────────────────────────────────────────────────────
    if (ideChoice.cmd && !ideChoice.detected) {
      console.log(`\n  ${yellow('⚠')} ${bold(ideChoice.name)} was not detected on this machine.`);
      console.log(dim('  It may not open automatically when launching a task.\n'));
      if (!await arrowConfirm('Continue with this IDE anyway?', rl)) {
        console.log(dim('  Re-selecting...\n'));
        continue;
      }
    }

    // ── Double-check ──────────────────────────────────────────────────────────
    if (!ideChoice.cmd) {
      // Manual — no verification needed
      console.log(dim('  Manual mode — worktree path will be printed at launch.'));
      break;
    }

    console.log(dim(`\n  Verifying ${ideChoice.name}...`));
    const verified = verifyIDE(ideChoice);

    if (verified.ok) {
      const versionStr = verified.version ? dim(` (${verified.version})`) : '';
      console.log(`  ${green('✓')} ${ideChoice.name} confirmed${versionStr}`);
      break;
    }

    console.log(`  ${yellow('!')} Could not verify ${ideChoice.name}. The CLI may not be installed or accessible.`);
    if (await arrowConfirm('Continue with this IDE anyway?', rl)) break;
    console.log(dim('  Re-selecting...\n'));
  }

  separator();

  // ── Summary ─────────────────────────────────────────────────────────────────

  console.log(`\n${bold('Review your configuration:')}\n`);
  summaryLine('Project',           projectName);
  summaryLine('Client framework',  clientFw.value);
  summaryLine('Client language',   clientLang);
  summaryLine('State management',  clientState);
  summaryLine('UI library',        clientUi);
  summaryLine('Styling',           clientStyle);
  summaryLine('Backend type',     backendType === 'integrated' ? `${clientFw.value} integrated` : backendFw || '(skipped)');
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
  ], rl);

  if (confirmIdx === 1) {
    console.log(yellow('\n  Restarting configuration...\n'));
    rl.close();
    const { spawn } = require('child_process');
    const child = spawn('node', [__filename], { stdio: 'inherit', cwd: ROOT });
    child.on('exit', (code) => process.exit(code));
    return;
  }

  if (confirmIdx === 2) {
    console.log(yellow('\n  Aborted. No files were changed.\n'));
    rl.close();
    return;
  }

  // ── Write configs ────────────────────────────────────────────────────────────

  separator();
  console.log(`\n${bold('Setting up your project...')}\n`);

  // ── Load bundled core ───────────────────────────────────────────────────────

  const CORE_DIR = path.join(__dirname, 'core');

  console.log(`  ${green('✓')} Templates ready`);

  const TEMPLATES = path.join(CORE_DIR, 'templates');

  // ── Copy scope directories (app code + CLAUDE.md only) ─────────────────────
  // agents/ and frameworks/ are now at repo root as .agents/ and .frameworks/
  // We copy client/backend/shared but exclude agents/ and frameworks/ subdirs

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

  copyDirExcluding(path.join(TEMPLATES, 'client'), path.join(ROOT, 'client'), ['agents', 'frameworks']);
  if (fs.existsSync(path.join(TEMPLATES, 'shared')))
    copyDirExcluding(path.join(TEMPLATES, 'shared'), path.join(ROOT, 'shared'), ['agents', 'frameworks']);
  if (backendType === 'separate') {
    copyDirExcluding(path.join(TEMPLATES, 'backend'), path.join(ROOT, 'backend'), ['agents', 'frameworks']);
    fs.writeFileSync(path.join(ROOT, 'backend', '.gitkeep'), '', 'utf8');
  }

  // ── Copy agents and frameworks to repo root as .agents/ and .frameworks/ ────

  copyDir(path.join(TEMPLATES, '.agents',  'client'),     path.join(ROOT, '.agents',     'client'));
  copyDir(path.join(TEMPLATES, '.frameworks',  'client'), path.join(ROOT, '.frameworks', 'client'));
  copyDir(path.join(TEMPLATES, '.agents',  'shared'),     path.join(ROOT, '.agents',     'shared'));
  if (backendType === 'separate') {
    copyDir(path.join(TEMPLATES, '.agents',  'backend'),     path.join(ROOT, '.agents',     'backend'));
    copyDir(path.join(TEMPLATES, '.frameworks',  'backend'), path.join(ROOT, '.frameworks', 'backend'));
  }

  fs.copyFileSync(path.join(TEMPLATES, 'CLAUDE.md'),    path.join(ROOT, 'CLAUDE.md'));
  fs.copyFileSync(path.join(TEMPLATES, 'CONTRACTS.md'), path.join(ROOT, 'CONTRACTS.md'));
  fs.copyFileSync(path.join(TEMPLATES, 'TASKS_HISTORY.md'), path.join(ROOT, 'TASKS_HISTORY.md'));
  fs.copyFileSync(path.join(TEMPLATES, 'CLOUD_STATE.md'), path.join(ROOT, 'CLOUD_STATE.md'));
  console.log(`  ${green('✓')} Templates copied`);

  // ── Copy workflow scripts ────────────────────────────────────────────────────

  const WORKFLOW_SRC  = path.join(CORE_DIR, 'workflow');
  const WORKFLOW_DEST = path.join(ROOT, '.workflow');
  fs.mkdirSync(WORKFLOW_DEST, { recursive: true });
  copyDir(WORKFLOW_SRC, WORKFLOW_DEST);
  console.log(`  ${green('✓')} Workflow scripts copied (.workflow/)`);
  console.log(`  ${green('✓')} Temporary files cleaned up`);

  // ── Write @config values ─────────────────────────────────────────────────────

  writeConfig(path.join(ROOT, 'CLAUDE.md'), {
    PROJECT_NAME: projectName,
    PROJECT_ROOT: projectName,
  });
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

  ensureGitignore('worktrees/');
  ensureGitignore('.scaffold/');
  ensureGitignore('.workflow/');
  ensureGitignore('node_modules/');

  // Remove template-specific gitignore entries so generated files can be committed
  const gitignorePath = path.join(ROOT, '.gitignore');
  let gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
  ['client/', 'backend/', 'shared/', 'CLAUDE.md', 'CONTRACTS.md', 'BUILD_STATE.md', 'TASKS_HISTORY.md', 'CLOUD_STATE.md'].forEach(entry => {
    gitignoreContent = gitignoreContent.replace(`\n${entry}`, '');
    gitignoreContent = gitignoreContent.replace(`${entry}\n`, '');
    gitignoreContent = gitignoreContent.replace(entry, '');
  });
  fs.writeFileSync(gitignorePath, gitignoreContent.trim() + '\n', 'utf8');
  console.log(`  ${green('✓')} .gitignore updated`);

  // ── Write .config.json ───────────────────────────────────────────────────────

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
  };

  fs.writeFileSync(
    path.join(RUNTIME_DIR, '.config.json'),
    JSON.stringify(config, null, 2),
    'utf8'
  );
  console.log(`  ${green('✓')} .scaffold/.config.json written`);

  // ── Write scope-policy.json ──────────────────────────────────────────────────

  const scopePolicy = {
    client: {
      allowed: ['client/**'],
      blocked: ['backend/**', 'shared/**', 'CONTRACTS.md', 'BUILD_STATE.md', 'TASKS_HISTORY.md'],
    },
    backend: {
      allowed: ['backend/**'],
      blocked: ['client/**', 'shared/**', 'CONTRACTS.md', 'BUILD_STATE.md', 'TASKS_HISTORY.md'],
      agentOverrides: {
        INIT: {
          allowed: ['backend/**', 'shared/wiring.config.json', 'CONTRACTS.md'],
        },
      },
    },
    shared: {
      allowed: ['CLOUD_STATE.md', 'CLOUD.md', 'CLOUD_TEARDOWN.md', '.github/**', 'docker-compose*.yml', 'Dockerfile', '**/.env.example'],
      blocked: ['client/**', 'backend/**', 'CONTRACTS.md', 'BUILD_STATE.md', 'TASKS_HISTORY.md'],
    },
  };

  fs.writeFileSync(
    path.join(RUNTIME_DIR, 'scope-policy.json'),
    JSON.stringify(scopePolicy, null, 2),
    'utf8'
  );
  console.log(`  ${green('✓')} .scaffold/scope-policy.json written`);

  // ── Generate BUILD_STATE.md ──────────────────────────────────────────────────

  const backendDisplay = backendType === 'integrated'
    ? `${clientFw.value} integrated (API routes/SSR)`
    : backendFw || 'Not configured';

  const clientStack = [clientFw.value, clientLang, clientStyle, clientUi, clientState]
    .filter(Boolean).join(' + ');

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

If a dependency is not met:
  DEPENDENCY NOT MET - surface what is missing and propose options.
  Never proceed silently on a missing dependency.

## Agent Log
| Date | Agent | Scope | Task | Status | Branch |
|------|-------|-------|------|--------|--------|
`;

  fs.writeFileSync(path.join(ROOT, 'BUILD_STATE.md'), buildState, 'utf8');
  console.log(`  ${green('✓')} BUILD_STATE.md generated`);

  // ── Generate user project package.json ───────────────────────────────────────

  const userPackage = {
    name:    projectName.toLowerCase().replace(/\s+/g, '-'),
    version: '1.0.0',
    private: true,
    dependencies: {
      prompts: '^2.4.2',
    },
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

  // ── Install dependencies ──────────────────────────────────────────────────────

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
    const trackingStructure = generateTrackingStructure(config);
    fs.writeFileSync(trackingPath, JSON.stringify(trackingStructure, null, 2), 'utf8');
    console.log(`  ${green('✓')} .tracking.json generated`);
  } else {
    console.log(dim('  ℹ .tracking.json already exists — preserved'));
  }

  // ── Generate .paths.json ──────────────────────────────────────────────────────

  const pathsMap = {};
  const clientConventions = FRAMEWORK_CONVENTIONS.client[clientFw?.value] || {};
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

  // ── Lock ─────────────────────────────────────────────────────────────────────

  fs.writeFileSync(LOCK_FILE, new Date().toISOString());
  console.log(`  ${green('✓')} Initialization locked`);

  // ── Auto-commit ───────────────────────────────────────────────────────────────

  try {
    execSync('git add .', { cwd: ROOT, stdio: 'pipe' });
    execSync('git commit -m "init: project configuration"', { cwd: ROOT, stdio: 'pipe' });
    console.log(`  ${green('✓')} Project configuration committed`);
  } catch (err) {
    console.log(`  ${yellow('!')} Could not auto-commit. Run manually:`);
    console.log(dim('     git add . && git commit -m "init: project configuration"'));
  }

  // ── Pre-commit hook — block direct commits to main ───────────────────────────

  try {
    const hooksDir  = path.join(ROOT, '.git', 'hooks');
    const hookPath  = path.join(hooksDir, 'pre-commit');
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

  // ── Remote setup ─────────────────────────────────────────────────────────────

  setupUserRemote(ROOT, projectName);

  // ── Trajectory selection ─────────────────────────────────────────────────────

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

  const TRAJECTORY_DETAILS = {
    '1': {
      label: 'Multi-Agent Driven Orchestration',
      full: [
        'Every task must start with npm run agent.',
        'Agent sessions load only task-relevant context, enabling reliable',
        'chaining, predictable behavior, and efficient token usage.',
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

  // Wrap in loop to support back navigation
  let trajectory = null;
  trajectoryLoop: while (true) {
    const trajIdx = await arrowSelect('How do you want to build?', [
      { label: bold('Multi-Agent Driven Orchestration') },
      { label: bold('Shared Orchestration') },
    ], rl);
    trajectory = String(trajIdx + 1);

    const selected = TRAJECTORY_DETAILS[trajectory];
    separator();
    console.log(`\n  ${green('✓')} ${bold(selected.label)}\n`);
    renderTrajectoryLines(selected.full);
    console.log('');

    const confirmIdx = await arrowSelect('Confirm?', [
      { label: `${green('✓')} Confirm` },
      { label: `${yellow('←')} Back — pick differently` },
    ], rl);
    if (confirmIdx === 0) break trajectoryLoop;
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

  // Store trajectory in config
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(RUNTIME_DIR, '.config.json'), 'utf8'));
    cfg.trajectory = selected.label.toLowerCase().replace(/ /g, '-');
    fs.writeFileSync(path.join(RUNTIME_DIR, '.config.json'), JSON.stringify(cfg, null, 2), 'utf8');
  } catch { /* best-effort */ }

  if (selected.next === 'launch') {
    separator();
    console.log(`\n  ${bold(green('  Project ready!'))}\n`);
    console.log(`  Run ${cyan('npm run agent')} to start your first task.\n`);
    rl.close();
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
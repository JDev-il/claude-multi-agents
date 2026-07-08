'use strict';

const os = require('os');

// ── Framework conventions ─────────────────────────────────────────────────────

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

// ── Client frameworks ─────────────────────────────────────────────────────────

const CLIENT_FRAMEWORKS = [
  { label: 'Next.js',       value: 'Next.js',    language: 'TypeScript', integratedBackend: true  },
  { label: 'Angular',       value: 'Angular',    language: 'TypeScript', integratedBackend: false },
  { label: 'Vue / Nuxt',    value: 'Nuxt',       language: 'TypeScript', integratedBackend: true  },
  { label: 'SvelteKit',     value: 'SvelteKit',  language: 'TypeScript', integratedBackend: true  },
  { label: 'Remix',         value: 'Remix',      language: 'TypeScript', integratedBackend: true  },
  { label: 'Vite + React',  value: 'Vite+React', language: 'TypeScript', integratedBackend: false },
];

// ── Backend frameworks ────────────────────────────────────────────────────────

const BACKEND_FRAMEWORKS = [
  { label: 'NestJS',   value: 'NestJS',   language: 'TypeScript' },
  { label: 'Express',  value: 'Express',  language: 'TypeScript' },
  { label: 'Fastify',  value: 'Fastify',  language: 'TypeScript' },
  { label: 'Django',   value: 'Django',   language: 'Python'     },
  { label: 'FastAPI',  value: 'FastAPI',  language: 'Python'     },
  { label: 'Laravel',  value: 'Laravel',  language: 'PHP'        },
  { label: 'Ruby on Rails', value: 'Rails', language: 'Ruby'       },
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
  'Laravel':    { registry: 'npm',  package: null                 },
  'Rails':      { registry: 'npm',  package: null                 },
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
  'Laravel':    ['11', '10', '9'],
  'Rails':      ['7.2', '7.1', '7.0'],
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

// ── Option maps ───────────────────────────────────────────────────────────────

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

const DB_OPTIONS = ['PostgreSQL', 'MySQL', 'MongoDB', 'SQLite'];

const ORM_OPTIONS_BY_DB = {
  'PostgreSQL': ['Prisma', 'TypeORM', 'Drizzle', 'Sequelize', 'raw pg driver'],
  'MySQL':      ['Prisma', 'TypeORM', 'Drizzle', 'Sequelize', 'raw mysql2 driver'],
  'MongoDB':    ['Mongoose', 'Prisma', 'raw MongoDB driver'],
  'SQLite':     ['Prisma', 'Drizzle', 'better-sqlite3'],
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

// ── IDE candidates ────────────────────────────────────────────────────────────

const IDE_CANDIDATES = [
  {
    cmd:   'code',
    name:  'VS Code',
    mac:   { app: 'Visual Studio Code', args: ['--new-window'] },
    win:   { paths: ['{LOCALAPPDATA}\\Programs\\Microsoft VS Code\\Code.exe', '{ProgramFiles}\\Microsoft VS Code\\Code.exe'], args: ['--new-window'] },
    linux: { paths: ['/snap/bin/code', '/usr/bin/code', '/usr/local/bin/code'], args: ['--new-window'] },
  },
  {
    cmd:   'cursor',
    name:  'Cursor',
    mac:   { app: 'Cursor', args: ['--new-window'] },
    win:   { paths: ['{LOCALAPPDATA}\\Programs\\cursor\\Cursor.exe'], args: ['--new-window'] },
    linux: { paths: ['/usr/bin/cursor', '/opt/cursor/cursor'], args: ['--new-window'] },
  },
  {
    cmd:   'webstorm',
    name:  'WebStorm',
    mac:   { app: 'WebStorm', toolboxApp: 'WebStorm', args: [] },
    win:   { paths: [
      '{LOCALAPPDATA}\\JetBrains\\Toolbox\\scripts\\webstorm.cmd',
      '{LOCALAPPDATA}\\Programs\\WebStorm\\bin\\webstorm64.exe',
    ], args: [] },
    linux: { paths: [
      `${os.homedir()}/.local/bin/webstorm`,
      '/opt/webstorm/bin/webstorm.sh',
      '/snap/webstorm/current/bin/webstorm.sh',
    ], args: [] },
  },
  {
    cmd:   'idea',
    name:  'IntelliJ IDEA',
    mac:   { app: 'IntelliJ IDEA', toolboxApp: 'IntelliJ IDEA', args: [] },
    win:   { paths: [
      '{LOCALAPPDATA}\\JetBrains\\Toolbox\\scripts\\idea.cmd',
      '{LOCALAPPDATA}\\Programs\\IntelliJ IDEA Community Edition\\bin\\idea64.exe',
      '{ProgramFiles}\\JetBrains\\IntelliJ IDEA\\bin\\idea64.exe',
    ], args: [] },
    linux: { paths: [
      `${os.homedir()}/.local/bin/idea`,
      '/opt/idea/bin/idea.sh',
      '/snap/intellij-idea-community/current/bin/idea.sh',
    ], args: [] },
  },
  {
    cmd:   'zed',
    name:  'Zed',
    mac:   { app: 'Zed', args: [] },
    win:   { paths: [], args: [] },
    linux: { paths: ['/usr/bin/zed', `${os.homedir()}/.local/bin/zed`], args: [] },
  },
  {
    cmd:   null,
    name:  'Other / Manual',
    note:  'prints worktree path, open it yourself',
    mac:   null,
    win:   null,
    linux: null,
  },
];

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  FRAMEWORK_CONVENTIONS,
  CLIENT_FRAMEWORKS,
  BACKEND_FRAMEWORKS,
  FRAMEWORK_REGISTRY,
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
};

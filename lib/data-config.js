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
  { label: 'Next.js',       value: 'Next.js',    language: 'TypeScript', integratedBackend: true,  registry: 'npm', package: 'next',             versions: ['15','14','13']          },
  { label: 'Angular',       value: 'Angular',    language: 'TypeScript', integratedBackend: false, registry: 'npm', package: '@angular/core',    versions: ['22','21','20']          },
  { label: 'Vue / Nuxt',    value: 'Nuxt',       language: 'TypeScript', integratedBackend: true,  registry: 'npm', package: 'nuxt',             versions: ['3','2',null]            },
  { label: 'SvelteKit',     value: 'SvelteKit',  language: 'TypeScript', integratedBackend: true,  registry: 'npm', package: '@sveltejs/kit',    versions: ['2','1',null]            },
  { label: 'Remix',         value: 'Remix',      language: 'TypeScript', integratedBackend: true,  registry: 'npm', package: '@remix-run/react', versions: ['2','1',null]            },
  { label: 'Vite + React',  value: 'Vite+React', language: 'TypeScript', integratedBackend: false, registry: 'npm', package: 'vite',             versions: ['8','7','6']             },
];

// ── Backend frameworks ────────────────────────────────────────────────────────

const BACKEND_FRAMEWORKS = [
  { label: 'NestJS',        value: 'NestJS',   language: 'TypeScript', registry: 'npm',       package: '@nestjs/core',      versions: ['11','10','9']           },
  { label: 'Express',       value: 'Express',  language: 'TypeScript', registry: 'npm',       package: 'express',           versions: ['5','4']                 },
  { label: 'Fastify',       value: 'Fastify',  language: 'TypeScript', registry: 'npm',       package: 'fastify',           versions: ['5','4',null]            },
  { label: 'Django',        value: 'Django',   language: 'Python',     registry: 'pypi',      package: 'django',            versions: ['5.1','4.2','3.2']       },
  { label: 'FastAPI',       value: 'FastAPI',  language: 'Python',     registry: 'pypi',      package: 'fastapi',           versions: ['0.115','0.111','0.104'] },
  { label: 'Laravel',       value: 'Laravel',  language: 'PHP',        registry: 'packagist', package: 'laravel/framework', versions: ['11','10','9']           },
  { label: 'Ruby on Rails', value: 'Rails',    language: 'Ruby',       registry: 'rubygems',  package: 'rails',             versions: ['7.2','7.1','7.0']       },
];

const _versionCache = {};

const getVersionCache = (frameworkValue) => _versionCache[frameworkValue] || null;

const prefetchVersions = (frameworks) => {
  frameworks.forEach(fw => {
    if (_versionCache[fw.value]) return;
    fetchLatestVersions(fw.value).catch(() => {});
  });
};

const fetchLatestVersions = async (frameworkValue) => {
  if (_versionCache[frameworkValue]) return _versionCache[frameworkValue];
  const entry = [...CLIENT_FRAMEWORKS, ...BACKEND_FRAMEWORKS].find(fw => fw.value === frameworkValue);
  if (!entry || !entry.package) return null;

  try {
    const https = require('https');
    const fetch = (url, headers = {}) => Promise.race([
      new Promise((resolve, reject) => {
        const req = https.get(url, { headers }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve(data));
        });
        req.on('error', reject);
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500)),
    ]);

    if (entry.registry === 'npm') {
      const raw  = await fetch(`https://registry.npmjs.org/${entry.package}`, { 'Accept': 'application/vnd.npm.install-v1+json' });
      const json = JSON.parse(raw);
      const versions = Object.keys(json.versions || {})
        .filter(v => /^\d+\.\d+\.\d+$/.test(v) && !v.includes('-'))
        .map(v => parseInt(v.split('.')[0]))
        .filter((v, i, arr) => arr.indexOf(v) === i)
        .sort((a, b) => b - a)
        .slice(0, 3);
      const result = versions.length ? versions.map(String) : null;
      if (result) _versionCache[frameworkValue] = result;
      return result;
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
      const result = versions.length ? versions : null;
      if (result) _versionCache[frameworkValue] = result;
      return result;
    }
    if (entry.registry === 'packagist') {
      const raw  = await fetch(`https://packagist.org/packages/${entry.package}.json`);
      const json = JSON.parse(raw);
      const versions = Object.keys(json.package?.versions || {})
        .filter(v => /^v?\d+\.\d+\.\d+$/.test(v) && !v.includes('-'))
        .map(v => parseInt(v.replace(/^v/, '').split('.')[0]))
        .filter((v, i, arr) => arr.indexOf(v) === i)
        .sort((a, b) => b - a)
        .slice(0, 3);
      const result = versions.length ? versions.map(String) : null;
      if (result) _versionCache[frameworkValue] = result;
      return result;
    }

    if (entry.registry === 'rubygems') {
      const raw  = await fetch(`https://rubygems.org/api/v1/versions/${entry.package}.json`);
      const json = JSON.parse(raw);
      const versions = json
        .map(v => parseInt(v.number.split('.')[0]))
        .filter((v, i, arr) => arr.indexOf(v) === i)
        .sort((a, b) => b - a)
        .slice(0, 3);
      const result = versions.length ? versions.map(String) : null;
      if (result) _versionCache[frameworkValue] = result;
      return result;
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

// ── Block identifiers ────────────────────────────────────────────────────────

const BLOCKS = {
  CLIENT:  'client',
  BACKEND: 'backend',
  SHARED:  'shared',
};

// ── Block config ─────────────────────────────────────────────────────────────

const BLOCK_CONFIG = {
  client: {
    isActive: true,
    framework: {
      data: CLIENT_FRAMEWORKS, required: true, key: 'clientFw', step: 0,
      desc: 'Which client framework do you want to use?',
      properties: {
        frameworkVersion: { data: CLIENT_FRAMEWORKS,  required: false, key: 'clientFwVersion', step: 0, desc: (fw) => `Which version of ${fw} will you use?`                    },
        stateManagement:  { data: STATE_OPTIONS,      required: false, key: 'clientState',     step: 1, desc: 'How will your app manage shared data (state management)?'                            },
        uiLibrary:        { data: UI_OPTIONS,         required: false, key: 'clientUi',        step: 2, desc: 'Which UI library do you want to use?'                            },
        styling:          { data: STYLING_OPTIONS,    required: false, key: 'clientStyle',     step: 3, desc: (fw) => `How do you want to style your ${fw} app?`              },
      },
    },
    integratedBackend: { data: null, required: false, key: 'useIntegratedBackend', step: 1, desc: (fw) => `Will you use ${fw}'s built-in backend instead of a separate server?` },
  },
  backend: {
    isActive: false,
    framework: {
      data: BACKEND_FRAMEWORKS, required: false, key: 'backendFw', step: 0,
      desc: 'Which backend framework do you want to use?',
      properties: {
        frameworkVersion: { data: BACKEND_FRAMEWORKS, required: false, key: 'backendFwVersion', step: 0, desc: (fw) => `Which version of ${fw} will you use?`                  },
        database:         { data: DB_OPTIONS,         required: false, key: 'backendDb',        step: 1, desc: 'Which database do you wish to use to store the data?'           },
        orm:              { data: ORM_OPTIONS,        required: false, key: 'backendOrm',       step: 2, desc: (db) => `How will your app communicate with ${db}?`             },
        auth:             { data: AUTH_OPTIONS,       required: false, key: 'backendAuth',      step: 3, desc: 'How will your app handle user authentication?'                  },
      },
    },
  },
};

// ── Intent map ────────────────────────────────────────────────────────────────

const INTENT_MAP = {
  fullstack: { label: 'Full-stack',    blocks: ['client', 'backend'], order: null },
  frontend:  { label: 'Frontend only', blocks: ['client'],            order: null },
  backend:   { label: 'Backend only',  blocks: ['backend'],           order: null },
};

module.exports = {
  BLOCKS,
  BLOCK_CONFIG,
  INTENT_MAP,
  FRAMEWORK_CONVENTIONS,
  CLIENT_FRAMEWORKS,
  BACKEND_FRAMEWORKS,

  fetchLatestVersions,
  getVersionCache,
  prefetchVersions,
  STATE_OPTIONS,
  UI_OPTIONS,
  STYLING_OPTIONS,
  DB_OPTIONS,
  ORM_OPTIONS_BY_DB,
  ORM_OPTIONS,
  AUTH_OPTIONS,
  IDE_CANDIDATES,
};

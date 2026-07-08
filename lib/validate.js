'use strict';

const { FRAMEWORK_REGISTRY, CLIENT_FRAMEWORKS, BACKEND_FRAMEWORKS, BLOCKS } = require('./data-config');

const ALL_FRAMEWORKS = [...CLIENT_FRAMEWORKS, ...BACKEND_FRAMEWORKS];

// ── Compatibility matrix ──────────────────────────────────────────────────────

const PYTHON_BACKENDS  = ['FastAPI', 'Django'];
const NODE_BACKENDS    = ['Express', 'NestJS', 'Fastify'];
const NODE_ONLY_ORMS   = ['Prisma', 'TypeORM', 'Drizzle', 'Sequelize', 'MikroORM', 'raw pg driver', 'raw mysql2 driver', 'better-sqlite3'];
const PYTHON_ONLY_ORMS = ['SQLAlchemy', 'Tortoise ORM', 'Django ORM (built-in)'];
const MONGO_ONLY_ORMS  = ['Beanie (MongoDB)'];
const NEXTJS_ONLY_LIBS = ['shadcn/ui', 'Radix UI'];
const MONGO_DBS        = ['MongoDB'];

// ── fuzzyMatchFramework ───────────────────────────────────────────────────────
// Returns up to 3 known framework names that loosely match the typed value

const fuzzyMatchFramework = (typed, block = null) => {
  const pool = block === BLOCKS.CLIENT  ? CLIENT_FRAMEWORKS
             : block === BLOCKS.BACKEND ? BACKEND_FRAMEWORKS
             : ALL_FRAMEWORKS;
  const lower = typed.toLowerCase().replace(/[^a-z0-9]/g, '');
  const matchedNames = Object.keys(FRAMEWORK_REGISTRY).filter(name => {
    const n = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return pool.some(f => f.value === name) &&
      (n.includes(lower) || lower.includes(n) || (lower.length >= 3 && n.startsWith(lower.slice(0, 3))));
  }).slice(0, 3);
  return matchedNames.map(name => pool.find(f => f.value === name) || { label: name, value: name });
};

// ── checkFrameworkExists ──────────────────────────────────────────────────────
// Checks npm then pypi for the typed framework name
// Returns { exists: boolean, registry: string|null }

const checkFrameworkExists = async (name) => {
  const known = FRAMEWORK_REGISTRY[name];
  if (known && known.package) return { exists: true, registry: known.registry };
  if (known && !known.package) return { exists: true, registry: known.registry }; // Laravel/Rails - known but no package

  const https = require('https');
  const fetch = (url) => new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 4000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });

  const slug = name.toLowerCase().replace(/\s+/g, '-');

  // Try npm
  try {
    const res = await fetch(`https://registry.npmjs.org/${slug}`);
    if (res.status === 200) return { exists: true, registry: 'npm' };
  } catch {}

  // Try pypi
  try {
    const res = await fetch(`https://pypi.org/pypi/${slug}/json`);
    if (res.status === 200) return { exists: true, registry: 'pypi' };
  } catch {}

  return { exists: false, registry: null };
};

// ── validateCombination ───────────────────────────────────────────────────────
// chosen  — the value just entered (string)
// context — answers accumulated so far { clientFw, backendFwObj, backendDb, ... }
// returns { valid, reason, alternatives }

const validateCombination = (chosen, context = {}) => {
  const clientFw  = context.clientFw?.value    || context.clientFw    || null;
  const backendFw = context.backendFwObj?.value || context.backendFwObj || null;
  const backendDb = context.backendDb           || null;

  // Node.js ORM + Python backend
  if (NODE_ONLY_ORMS.includes(chosen) && PYTHON_BACKENDS.includes(backendFw)) {
    return {
      valid:        false,
      reason:       `${chosen} is a Node.js ORM and does not support ${backendFw} (Python).`,
      alternatives: backendFw === 'Django'
        ? ['Django ORM (built-in)', 'SQLAlchemy']
        : ['SQLAlchemy', 'Tortoise ORM', 'raw asyncpg'],
    };
  }

  // Python ORM + Node.js backend
  if (PYTHON_ONLY_ORMS.includes(chosen) && NODE_BACKENDS.includes(backendFw)) {
    return {
      valid:        false,
      reason:       `${chosen} is a Python ORM and does not support ${backendFw} (Node.js).`,
      alternatives: ['Prisma', 'TypeORM', 'Drizzle'],
    };
  }

  // Beanie + non-MongoDB
  if (MONGO_ONLY_ORMS.includes(chosen) && backendDb && !MONGO_DBS.includes(backendDb)) {
    return {
      valid:        false,
      reason:       `Beanie is a MongoDB ODM and does not support ${backendDb}.`,
      alternatives: ['Prisma', 'TypeORM', 'Drizzle'],
    };
  }

  // Next.js-only UI libs + Vite+React
  if (NEXTJS_ONLY_LIBS.includes(chosen) && clientFw === 'Vite+React') {
    return {
      valid:        false,
      reason:       `${chosen} is optimized for Next.js and may not work correctly with Vite+React.`,
      alternatives: ['MUI', 'Chakra UI', 'Ant Design'],
    };
  }

  // Ambiguous cross-boundary
  if (chosen && backendFw && chosen.toLowerCase() === backendFw.toLowerCase()) {
    return {
      valid:        false,
      reason:       `${chosen} appears in both client and backend selections - this may cause scope ambiguity.`,
      alternatives: [],
    };
  }

  return { valid: true, reason: null, alternatives: [] };
};


// ── resolveFramework ──────────────────────────────────────────────────────────
// Full lookup order per block — returns { status, match, message }
// status: 'match' | 'cross_block' | 'partial_cross' | 'unverified' | 'valid'

const resolveFramework = async (typed, block = null) => {
  const lower = typed.toLowerCase().replace(/[^a-z0-9]/g, '');

  const primaryPool   = block === BLOCKS.CLIENT  ? CLIENT_FRAMEWORKS
                      : block === BLOCKS.BACKEND ? BACKEND_FRAMEWORKS
                      : ALL_FRAMEWORKS;
  const secondaryPool = block === BLOCKS.CLIENT  ? BACKEND_FRAMEWORKS
                      : block === BLOCKS.BACKEND ? CLIENT_FRAMEWORKS
                      : [];
  const crossLabel    = block === BLOCKS.CLIENT  ? 'backend' : 'client';

  // 1. Fuzzy match in primary pool
  const primaryFuzzy = primaryPool.filter(f => {
    const n = f.value.toLowerCase().replace(/[^a-z0-9]/g, '');
    return n.includes(lower) || lower.includes(n) || (lower.length >= 3 && n.startsWith(lower.slice(0, 3)));
  }).slice(0, 3);
  if (primaryFuzzy.length > 0) return { status: 'fuzzy', matches: primaryFuzzy, message: null };

  // 2. Exact match in primary pool
  const primaryExact = primaryPool.find(f => f.value.toLowerCase() === typed.toLowerCase());
  if (primaryExact) return { status: 'valid', match: primaryExact, message: null };

  // 3. Partial match in secondary pool
  const secondaryFuzzy = secondaryPool.filter(f => {
    const n = f.value.toLowerCase().replace(/[^a-z0-9]/g, '');
    return n.includes(lower) || lower.includes(n) || (lower.length >= 3 && n.startsWith(lower.slice(0, 3)));
  });
  if (secondaryFuzzy.length > 0) return { status: 'partial_cross', matches: secondaryFuzzy, message: `No such ${block} framework found. Did you mean a ${crossLabel} framework?` };

  // 4. Exact match in secondary pool
  const secondaryExact = secondaryPool.find(f => f.value.toLowerCase() === typed.toLowerCase());
  if (secondaryExact) return { status: 'cross_block', match: secondaryExact, message: `"${typed}" is a ${crossLabel} framework, not a ${block} framework.` };

  // 5. Registry check
  const existence = await checkFrameworkExists(typed);
  return { status: 'unverified', match: null, message: existence.exists ? `"${typed}" was found on ${existence.registry} but could not be confirmed as a ${block || ''} framework.` : `"${typed}" couldn't be verified on any registry.` };
};

module.exports = { validateCombination, checkFrameworkExists, fuzzyMatchFramework, resolveFramework };

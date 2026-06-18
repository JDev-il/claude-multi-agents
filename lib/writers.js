'use strict';

const fs           = require('fs');
const path         = require('path');
const { execSync } = require('child_process');

// ── Colors (inline — avoid circular dep) ─────────────────────────────────────

const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const dim    = (s) => `\x1b[2m${s}\x1b[0m`;

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

// ── Gitignore helper ──────────────────────────────────────────────────────────

const ensureGitignore = (ROOT, entry) => {
  const p       = path.join(ROOT, '.gitignore');
  const content = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  if (!content.includes(entry)) fs.appendFileSync(p, `\n${entry}\n`);
};

// ── Directory copy ────────────────────────────────────────────────────────────

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

// ── GitHub remote setup ───────────────────────────────────────────────────────

const detectGitHubUser = () => {
  try {
    return execSync('gh api user --jq .login', { encoding: 'utf8', stdio: 'pipe' }).trim();
  } catch {}
  try {
    return execSync('git config user.name', { encoding: 'utf8', stdio: 'pipe' }).trim();
  } catch {}
  return null;
};

const setupUserRemote = (ROOT, projectName) => {
  let currentOrigin = null;
  try {
    currentOrigin = execSync('git remote get-url origin',
      { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' }).trim();
  } catch {}

  if (currentOrigin && !currentOrigin.includes('multi-agents-template')) return;

  if (currentOrigin?.includes('multi-agents-template')) {
    try {
      execSync('git remote remove origin', { cwd: ROOT, stdio: 'pipe' });
      execSync(`git remote add upstream ${currentOrigin}`, { cwd: ROOT, stdio: 'pipe' });
      console.log(dim('  ℹ Template remote moved to upstream'));
    } catch {}
  }

  const flagPath = path.join(ROOT, '.scaffold', '.remote-setup-needed');
  fs.writeFileSync(flagPath, JSON.stringify({
    projectName,
    createdAt: new Date().toISOString(),
  }), 'utf8');

  console.log(`\n  ${yellow('ℹ No remote configured.')} Your first agent session will set this up.`);
  console.log(dim('  All work stays local until then.\n'));
};

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  writeConfig,
  ensureGitignore,
  copyDir,
  emptySlot,
  generateTrackingStructure,
  detectGitHubUser,
  setupUserRemote,
};

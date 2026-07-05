#!/usr/bin/env node
'use strict';

/**
 * Workflow bootstrap — checks CLI version and auto-updates .workflow/ if behind,
 * then spawns agent.js. This is the actual entry point for npm run agent.
 */

const fs      = require('fs');
const path    = require('path');
const { execSync, spawn } = require('child_process');
const { sync } = require('./sync');

const ROOT         = path.join(__dirname, '..');
const WORKFLOW_DIR = __dirname;
const VERSION_FILE = path.join(WORKFLOW_DIR, '.version');

const c = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', yellow: '\x1b[33m',
};
const dim   = (s) => `${c.dim}${s}${c.reset}`;
const green = (s) => `${c.green}${s}${c.reset}`;
const bold  = (s) => `${c.bold}${s}${c.reset}`;

const getInstalledVersion = () => {
  try {
    return execSync('npm list -g multi-agents-cli --json', { stdio: 'pipe', encoding: 'utf8' });
  } catch { return null; }
};

const getCurrentVersion = () => {
  try {
    // Walk up from .workflow/ to find the CLI package.json
    const pkgPath = path.join(__dirname, '..', 'node_modules', 'multi-agents-cli', 'package.json');
    if (fs.existsSync(pkgPath)) return JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version;
    // Global fallback
    const globalPkg = execSync('npm root -g', { stdio: 'pipe', encoding: 'utf8' }).trim();
    const globalPath = path.join(globalPkg, 'multi-agents-cli', 'package.json');
    if (fs.existsSync(globalPath)) return JSON.parse(fs.readFileSync(globalPath, 'utf8')).version;
  } catch {}
  return null;
};

const getStampedVersion = () => {
  try { return fs.readFileSync(VERSION_FILE, 'utf8').trim(); } catch { return null; }
};

const copyWorkflow = (cliRoot) => {
  const src  = path.join(cliRoot, 'core', 'workflow');
  const dest = WORKFLOW_DIR;
  if (!fs.existsSync(src)) return false;
  for (const file of fs.readdirSync(src)) {
    fs.copyFileSync(path.join(src, file), path.join(dest, file));
  }
  const agentConfigSrc = path.join(cliRoot, 'lib', 'agent-config.js');
  if (fs.existsSync(agentConfigSrc)) fs.copyFileSync(agentConfigSrc, path.join(dest, 'agent-config.js'));
  return true;
};

const findCliRoot = () => {
  // Local node_modules first (npx or local install)
  const localPkg = path.join(__dirname, '..', 'node_modules', 'multi-agents-cli');
  if (fs.existsSync(localPkg)) return localPkg;
  try {
    const globalPkg = execSync('npm root -g', { stdio: 'pipe', encoding: 'utf8' }).trim();
    const p = path.join(globalPkg, 'multi-agents-cli');
    if (fs.existsSync(p)) return p;
  } catch {}
  return null;
};

const main = async () => {
  await sync({ mode: 'auto' });

  const stamped   = getStampedVersion();
  const installed = getCurrentVersion();

  if (installed && installed !== stamped) {
    // Show spinner while updating
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;
    const spin = setInterval(() => {
      process.stdout.write(`\r  ${frames[i++ % frames.length]} Updating workflow scripts...`);
    }, 60);

    const cliRoot = findCliRoot();
    let updated = false;
    if (cliRoot) {
      updated = copyWorkflow(cliRoot);
      if (updated) fs.writeFileSync(VERSION_FILE, installed, 'utf8');
    }

    clearInterval(spin);
    if (updated) {
      process.stdout.write('\r' + ' '.repeat(40) + '\r');
      console.log(`  ${green('✓')} Workflow updated to ${bold('v' + installed)}\n`);
    } else {
      process.stdout.write('\r' + ' '.repeat(40) + '\r');
    }
  }

  // Spawn agent.js
  const child = spawn('node', [path.join(WORKFLOW_DIR, 'agent.js'), ...process.argv.slice(2)], {
    stdio: 'inherit',
    cwd:   ROOT,
  });
  child.on('exit', code => process.exit(code ?? 0));
};

main().catch(err => { console.error(err.message); process.exit(1); });

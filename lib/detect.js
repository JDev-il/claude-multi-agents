'use strict';

const fs        = require('fs');
const path      = require('path');
const os        = require('os');
const { execSync } = require('child_process');

// ── Colors (inline — avoid circular dep with ui.js) ──────────────────────────

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const dim   = (s) => `\x1b[2m${s}\x1b[0m`;

// ── IDE detection ─────────────────────────────────────────────────────────────

const expandWinPath = (p) =>
  p.replace('{LOCALAPPDATA}', process.env.LOCALAPPDATA || '')
   .replace('{ProgramFiles}',  process.env.ProgramFiles  || 'C:\\Program Files');

const buildIDEOptions = (IDE_CANDIDATES) => {
  const platform = process.platform;

  return IDE_CANDIDATES.map(ide => {
    if (!ide.cmd) {
      const noteStr = ide.note ? dim(`  (${ide.note})`) : '';
      return { ...ide, detected: false, strategy: 'manual', label: `${ide.name}   ${dim('→')}${noteStr}` };
    }

    let detected = false;
    let strategy = 'cli';

    if (platform === 'darwin' && ide.mac) {
      const system  = `/Applications/${ide.mac.app}.app`;
      const user    = path.join(os.homedir(), 'Applications', `${ide.mac.app}.app`);
      const toolbox = path.join(os.homedir(), 'Applications', 'JetBrains Toolbox', `${ide.mac.app}.app`);
      detected = fs.existsSync(system) || fs.existsSync(user) || fs.existsSync(toolbox);
      if (detected) strategy = 'mac-app';

    } else if (platform === 'win32' && ide.win) {
      try {
        execSync(`where ${ide.cmd}`, { stdio: 'pipe' });
        detected = true;
        strategy = 'cli';
      } catch {
        const expanded = (ide.win.paths || []).map(expandWinPath);
        detected = expanded.some(p => fs.existsSync(p));
        if (detected) strategy = 'win-exe';
      }

    } else if (platform === 'linux' && ide.linux) {
      try {
        execSync(`which ${ide.cmd}`, { stdio: 'pipe' });
        detected = true;
        strategy = 'cli';
      } catch {
        detected = (ide.linux.paths || []).some(p => fs.existsSync(p));
        if (detected) strategy = 'linux-path';
      }
    }

    const statusStr = detected ? green('✓ detected') : dim('✗ not found');
    const noteStr   = ide.note ? dim(`  (${ide.note})`) : '';
    return { ...ide, detected, strategy, label: `${ide.name}   ${statusStr}${noteStr}` };
  });
};

const verifyIDE = (ide) => {
  const platform = process.platform;

  if (ide.strategy === 'mac-app' && ide.mac) {
    const appPath  = `/Applications/${ide.mac.app}.app`;
    const userPath = path.join(os.homedir(), 'Applications', `${ide.mac.app}.app`);
    if (!fs.existsSync(appPath) && !fs.existsSync(userPath)) return { ok: false };
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

// ── Terminal detection ────────────────────────────────────────────────────────

const detectTerminal = () => {
  const platform = process.platform;

  if (platform === 'darwin') {
    const apps = [
      { name: 'iTerm2',       cmd: 'iTerm2',   path: '/Applications/iTerm.app' },
      { name: 'Warp',         cmd: 'Warp',     path: '/Applications/Warp.app' },
      { name: 'Terminal.app', cmd: 'Terminal', path: '/System/Applications/Utilities/Terminal.app' },
    ];
    return apps.find(a => fs.existsSync(a.path)) || { name: 'Terminal.app', cmd: 'Terminal' };

  } else if (platform === 'win32') {
    const wtPath = (process.env.LOCALAPPDATA || '') + '\\Microsoft\\WindowsApps\\wt.exe';
    if (fs.existsSync(wtPath)) return { name: 'Windows Terminal', cmd: 'wt' };
    return { name: 'Command Prompt', cmd: 'cmd' };

  } else {
    const terms = ['gnome-terminal', 'konsole', 'xterm'];
    for (const t of terms) {
      try { execSync('which ' + t, { stdio: 'pipe' }); return { name: t, cmd: t }; } catch {}
    }
    return { name: 'xterm', cmd: 'xterm' };
  }
};

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  expandWinPath,
  buildIDEOptions,
  verifyIDE,
  detectTerminal,
};

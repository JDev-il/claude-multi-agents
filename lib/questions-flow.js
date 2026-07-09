'use strict';

// ── Imports ───────────────────────────────────────────────────────────────────

const { dim, bold, blue, green, cyan, separator, arrowSelect, arrowConfirm, selectRequired, selectOptional, stepHeader } = require('./ui');
const { BLOCKS } = require('./data-config');
const { BACK, RESTART } = require('./steps');
const {
  CLIENT_FRAMEWORKS, BACKEND_FRAMEWORKS, FRAMEWORK_VERSION_FALLBACK,
  fetchLatestVersions, STATE_OPTIONS, UI_OPTIONS, STYLING_OPTIONS,
  DB_OPTIONS, ORM_OPTIONS_BY_DB, ORM_OPTIONS, AUTH_OPTIONS,
} = require('./data-config');
const { buildIDEOptions, verifyIDE, detectTerminal } = require('./detect');

// ── Step definitions ──────────────────────────────────────────────────────────
// Each def: { name: string, run: async (machine, answers) => value | BACK | RESTART }
// Conditional steps return their skip-value immediately when not applicable.

const fwValue = (fw) => fw && typeof fw === 'object' ? fw.value : (typeof fw === 'string' && fw.length > 0 ? fw : '__custom__');

const buildStepDefs = (IDE_CANDIDATES) => [

  // ── Step 0: Client framework ────────────────────────────────────────────────
  {
    name: 'clientFw',
    run: async (machine, answers) => {
      stepHeader(1, 12);
      console.log(`\n${bold(blue('Client configuration'))}`);
      return await selectRequired('* Client framework (required):', CLIENT_FRAMEWORKS, machine, 0, answers, BLOCKS.CLIENT);
    },
  },

  // ── Step 1: Client version ──────────────────────────────────────────────────
  {
    name: 'clientFwVersion',
    run: async (machine, answers) => {
      stepHeader(2, 12);
      const fw = answers.clientFw;
      const versions = await fetchLatestVersions(fwValue(fw)) || FRAMEWORK_VERSION_FALLBACK[fwValue(fw)] || [];
      if (!versions.length) return null; // skip silently

      console.log(dim('  Fetching latest versions...'));
      const versionChoices = versions.map((v, i) => ({
        label: i === 0 ? `v${v}  ${dim('(latest)')}` : `v${v}`,
        value: v,
      }));
      const label = fwValue(fw) === 'Vite+React' ? '* Vite version:' : `* ${fwValue(fw)} version:`;
      const navOpts = machine.navOptions(1, false);
      const idx = await arrowSelect(label, [
        ...versionChoices,
        ...navOpts.map(n => ({ label: n.label })),
      ]);

      if (idx < versions.length) return versions[idx];
      const nav = navOpts[idx - versions.length];
      return nav ? nav.value : RESTART;
    },
  },

  // ── Step 2: State management ────────────────────────────────────────────────
  {
    name: 'clientState',
    run: async (machine, answers) => {
      stepHeader(3, 12);
      const opts = STATE_OPTIONS[fwValue(answers.clientFw)] || [];
      return await selectOptional('State management:', opts, machine, 2, answers, BLOCKS.CLIENT);
    },
  },

  // ── Step 3: UI library ──────────────────────────────────────────────────────
  {
    name: 'clientUi',
    run: async (machine, answers) => {
      stepHeader(4, 12);
      const opts = UI_OPTIONS[fwValue(answers.clientFw)] || [];
      return await selectOptional('UI library:', opts, machine, 3, answers, BLOCKS.CLIENT);
    },
  },

  // ── Step 4: Styling ─────────────────────────────────────────────────────────
  {
    name: 'clientStyle',
    run: async (machine, answers) => {
      stepHeader(5, 12);
      return await selectOptional('Styling:', STYLING_OPTIONS, machine, 4, answers, BLOCKS.CLIENT);
    },
  },

  // ── Step 5: Integrated backend confirm ──────────────────────────────────────
  {
    name: 'useIntegratedBackend',
    run: async (machine, answers) => {
      stepHeader(6, 12);
      const fw = answers.clientFw;
      if (!fw || !fw.integratedBackend) return false; // skip — not applicable

      separator();
      console.log(`\n${bold(blue('Backend configuration'))}`);
      console.log(dim(`  ${fwValue(fw)} supports server-side rendering and API routes.\n`));
      const confirmed = await arrowConfirm(`Use integrated backend (${fwValue(fw)} API routes/SSR) instead of a separate backend?`);
      if (confirmed) console.log(dim(`\n  Using ${fwValue(fw)} integrated backend. No separate backend needed.\n`));
      return confirmed;
    },
  },

  // ── Step 6: Backend framework ────────────────────────────────────────────────
  {
    name: 'backendFw',
    run: async (machine, answers) => {
      stepHeader(7, 12);
      if (answers.useIntegratedBackend) return null; // skip

      separator();
      console.log(`\n${bold(blue('Backend configuration'))}`);
      console.log(dim('  You can skip the backend framework and decide later.\n'));

      return await selectOptional('Backend framework:', BACKEND_FRAMEWORKS, machine, 6, answers, BLOCKS.BACKEND);
    },
  },

  // ── Step 7: Backend version ──────────────────────────────────────────────────
  {
    name: 'backendFwVersion',
    run: async (machine, answers) => {
      stepHeader(8, 12);
      const fwObj = answers.backendFw;
      if (!fwObj) return null; // skip — no backend selected

      const versions = await fetchLatestVersions(fwValue(fwObj)) || FRAMEWORK_VERSION_FALLBACK[fwValue(fwObj)] || [];
      if (!versions.length) return null;

      const vChoices = versions.map((v, i) => ({
        label: i === 0 ? `v${v}  ${dim('(latest)')}` : `v${v}`,
        value: v,
      }));
      const navOpts = machine.navOptions(7, false);
      const idx = await arrowSelect(`* ${fwValue(fwObj)} version:`, [
        ...vChoices,
        ...navOpts.map(n => ({ label: n.label })),
      ]);

      if (idx < versions.length) return versions[idx];
      const nav = navOpts[idx - versions.length];
      return nav ? nav.value : RESTART;
    },
  },

  // ── Step 8: Database ─────────────────────────────────────────────────────────
  {
    name: 'backendDb',
    run: async (machine, answers) => {
      stepHeader(9, 12);
      if (!answers.backendFw) return null;
      return await selectOptional('Database type:', DB_OPTIONS, machine, 8, answers, BLOCKS.BACKEND);
    },
  },

  // ── Step 9: ORM ──────────────────────────────────────────────────────────────
  {
    name: 'backendOrm',
    run: async (machine, answers) => {
      stepHeader(10, 12);
      const { backendFw, backendDb } = answers;
      if (!backendFw || !backendDb) return null;
      const byDb = ORM_OPTIONS_BY_DB[backendDb] || [];
      const byFw = ORM_OPTIONS[fwValue(backendFw)] || [];
      const ormChoices = byDb.length && byFw.length ? byDb.filter(o => byFw.includes(o)) : byDb.length ? byDb : byFw;
      return await selectOptional('ORM / query layer:', ormChoices, machine, 9, answers, BLOCKS.BACKEND);
    },
  },

  // ── Step 10: Auth ────────────────────────────────────────────────────────────
  {
    name: 'backendAuth',
    run: async (machine, answers) => {
      stepHeader(11, 12);
      const { backendFw } = answers;
      if (!backendFw) return null;
      return await selectOptional('Auth strategy:', AUTH_OPTIONS[fwValue(backendFw)] || [], machine, 10, answers, BLOCKS.BACKEND);
    },
  },

  // ── Step 11: IDE ─────────────────────────────────────────────────────────────
  {
    name: 'ideChoice',
    run: async (machine, answers) => {
      stepHeader(12, 12);
      separator();
      console.log(`\n${bold(blue('Environment'))}`);

      const osName = { darwin: 'macOS', win32: 'Windows', linux: 'Linux' }[process.platform] || process.platform;
      console.log(`\n  ${dim('OS detected:')} ${bold(osName)}`);
      console.log(dim('  Scanning for installed IDEs...\n'));

      const ideOptions     = buildIDEOptions(IDE_CANDIDATES);
      const detectedIDEs   = ideOptions.filter(o => o.detected);
      const manualOption   = ideOptions.filter(o => !o.cmd);
      const sorted         = [...detectedIDEs, ...manualOption];

      if (detectedIDEs.length > 1)      console.log(`\n  ${'\x1b[33m'}Multiple IDEs found${'\x1b[0m'} - select your preference:\n`);
      else if (detectedIDEs.length === 1) console.log(`\n  ${'\x1b[32m'}1 IDE found:${'\x1b[0m'} ${bold(detectedIDEs[0].name)}\n`);
      else                               console.log(`\n  ${'\x1b[33m'}No IDEs detected.${'\x1b[0m'}\n`);

      while (true) {
        const ideChoice = await selectRequired('* IDE / editor (required):', sorted, machine, 11, answers, null);
        if (ideChoice === RESTART || ideChoice === BACK) return ideChoice;

        if (ideChoice.cmd && !ideChoice.detected) {
          console.log(`\n  ${'\x1b[33m'}⚠${'\x1b[0m'} ${bold(ideChoice.name)} was not detected on this machine.`);
          console.log(dim('  It may not open automatically when launching a task.\n'));
          if (!await arrowConfirm('Continue with this IDE anyway?')) { console.log(dim('  Re-selecting...\n')); continue; }
        }

        if (!ideChoice.cmd) { console.log(dim('  Manual mode - worktree path will be printed at launch.')); return ideChoice; }

        console.log(dim(`\n  Verifying ${ideChoice.name}...`));
        const verified = verifyIDE(ideChoice);
        if (verified.ok) {
          const vStr = verified.version ? dim(` (${verified.version})`) : '';
          console.log(`  ${'\x1b[32m'}✓${'\x1b[0m'} ${ideChoice.name} confirmed${vStr}`);
          return ideChoice;
        }

        console.log(`  ${'\x1b[33m'}!${'\x1b[0m'} Could not verify ${ideChoice.name}.`);
        if (await arrowConfirm('Continue with this IDE anyway?')) return ideChoice;
        console.log(dim('  Re-selecting...\n'));
      }
    },
  },
];

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = { buildStepDefs, fwValue };

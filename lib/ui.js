'use strict';

// ── Dependencies ──────────────────────────────────────────────────────────────

const readline = require('readline');

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

// ── Prompts (arrow-key navigation) ───────────────────────────────────────────

let prompts;
try { prompts = require('prompts'); } catch { prompts = null; }

const rl = readline.createInterface({
  input:  process.stdin,
  output: process.stdout,
});

const ask = (question) =>
  new Promise((resolve) => rl.question(question, (a) => resolve(a.trim())));

const arrowSelect = async (message, choices, showBack = false, backLabel = '← Restart configuration') => {
  const allChoices = showBack
    ? [...choices, { label: dim(backLabel) }]
    : choices;

  if (prompts && process.stdin.isTTY) {
    const res = await prompts({
      type:    'select',
      name:    'value',
      message,
      choices: allChoices.map((c, i) => ({ title: typeof c === 'string' ? c : c.label, value: i, disabled: c.disabled ?? false })),
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

const arrowConfirm = async (message) => {
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

// ── Layout helpers ────────────────────────────────────────────────────────────

const separator = () => console.log(`\n${dim('─'.repeat(60))}`);

const showList = (items, showSkip = false) => {
  items.forEach((item, i) => {
    const label = typeof item === 'string' ? item : item.label;
    console.log(`  ${dim(`${i + 1}.`)} ${label}`);
  });
  if (showSkip) console.log(`  ${dim('0.')} Skip ${dim('(agent will propose when needed)')}`);
};

const summaryLine = (label, value) => {
  const padded = label.padEnd(20);
  if (!value) {
    console.log(`  ${dim(padded)}: ${yellow('(skipped - agent will propose when needed)')}`);
  } else {
    console.log(`  ${dim(padded)}: ${green(value)}`);
  }
};

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

// ── Step selection helpers ────────────────────────────────────────────────────

const { BACK, RESTART } = require('./steps');

const selectRequired = async (prompt, items, stepMachine, stepIndex) => {
  const isFirstStep = stepIndex <= 1;
  const navOpts = stepMachine ? stepMachine.navOptions(stepIndex, isFirstStep) : [];
  const allItems = [...items, ...navOpts];

  const idx = await arrowSelect(prompt, allItems.map(i => ({ label: typeof i === 'string' ? i : i.label })));

  if (idx >= items.length) {
    const nav = navOpts[idx - items.length];
    return nav ? nav.value : RESTART;
  }
  return items[idx];
};

const selectOptional = async (prompt, items, stepMachine, stepIndex) => {
  if (!items || items.length === 0) return null;
  const isFirstStep = stepIndex <= 1;
  const navOpts = stepMachine ? stepMachine.navOptions(stepIndex, isFirstStep) : [];
  const choices = [
    ...items.map(i => ({ label: typeof i === 'string' ? i : i.label })),
    { label: dim('Skip (agent will propose when needed)') },
    ...navOpts.map(n => ({ label: n.label })),
  ];

  const idx = await arrowSelect(prompt, choices);

  if (idx === items.length) return null; // skip
  if (idx > items.length) {
    const nav = navOpts[idx - items.length - 1];
    return nav ? nav.value : RESTART;
  }
  return typeof items[idx] === 'string' ? items[idx] : items[idx].value;
};

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  c, bold, green, yellow, dim, cyan, blue, red,
  rl, ask,
  arrowSelect, arrowConfirm,
  selectRequired, selectOptional,
  separator, showList, summaryLine, renderTrajectoryLines,
};

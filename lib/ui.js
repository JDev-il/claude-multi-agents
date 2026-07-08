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

const arrowConfirm = async (message, initial = true) => {
  if (prompts && process.stdin.isTTY) {
    const res = await prompts({
      type:    'select',
      name:    'value',
      message,
      choices: [
        { title: 'Yes', value: true },
        { title: 'No',  value: false },
      ],
      initial: initial ? 0 : 1,
    }, { onCancel: () => process.exit(0) });
    return res.value ?? initial;
  }
  return initial;
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

// ── Step progress header ─────────────────────────────────────────────────────

const stepHeader = (stepIndex, totalSteps) => {
  console.log(`
  ${dim(`Step ${stepIndex} of ${totalSteps}`)}`);
};

// ── Step selection helpers ────────────────────────────────────────────────────

const { BACK, RESTART } = require('./steps');
const { validateCombination, resolveFramework } = require('./validate');
const { BLOCKS } = require('./data-config');

const NONE_LABEL = '→ None of these - I\'ll specify my own';

// ── Free-text handler (shared by selectRequired + selectOptional) ────────────

const handleFreeText = async (prompt, items, stepMachine, stepIndex, context, isOptional, block = null) => {
  const _res = await prompts({ type: 'text', name: 'value', message: 'Type your own value:' }, { onCancel: () => process.exit(0) });
  const typed = (_res.value || '').trim();
  if (!typed) return isOptional ? null : handleFreeText(prompt, items, stepMachine, stepIndex, context, isOptional, block);

  console.log(dim('  Verifying...'));
  const resolved = await resolveFramework(typed, block);

  if (resolved.status === 'fuzzy') {
    const opts = [
      ...resolved.matches.map(m => `→ ${m.label || m}`),
      `→ Type a different value`,
    ];
    const choice = await arrowSelect(`"${typed}" couldn't be verified. Did you mean:`, opts.map(o => ({ label: o })));
    if (choice < resolved.matches.length) return resolved.matches[choice];
    return handleFreeText(prompt, items, stepMachine, stepIndex, context, isOptional, block);
  }

  if (resolved.status === 'valid') return resolved.match;

  if (resolved.status === 'partial_cross') {
    console.log(`\n  ${yellow('⚠')} ${resolved.message}\n`);
    const choice = await arrowSelect(`"${typed}" couldn't be verified.`, [
      { label: `→ Type a different value` },
      { label: `→ Choose from the ${block} list` },
    ]);
    if (choice === 1) return null;
    return handleFreeText(prompt, items, stepMachine, stepIndex, context, isOptional, block);
  }

  if (resolved.status === 'cross_block') {
    console.log(`
  ${yellow('⚠')} ${resolved.message}
`);
    const choice = await arrowSelect('How would you like to proceed?', [
      { label: `→ Continue - I understand the tradeoff` },
      { label: `→ Type a different value` },
    ]);
    if (choice === 1) return handleFreeText(prompt, items, stepMachine, stepIndex, context, isOptional, block);
    return typed;
  }

  // unverified - risk block
  console.log('');
  const riskOpts = [
    `→ Proceed with "${typed}" - I accept the risks`,
    `→ Type a different value`,
  ];
  const riskChoice = await arrowSelect(`"${typed}" couldn't be verified.`, riskOpts.map(o => ({ label: o })));
  if (riskChoice === 1) return handleFreeText(prompt, items, stepMachine, stepIndex, context, isOptional, block);
  console.log('');
  console.log(`  ${yellow('⚠ Proceeding with an unverified framework may result in:')}`);
  console.log(dim('    · Agent spending excessive tokens resolving unknown setup'));
  console.log(dim('    · Incorrect scaffold structure for this framework'));
  console.log(dim('    · Missing contracts and integration points'));
  console.log(dim('    · Potential mid-flow failures requiring full restart'));
  console.log('');
  const confirm = await arrowSelect('Confirm you understand and want to continue?', [
    { label: `→ Yes - proceed with "${typed}"` },
    { label: `→ No - let me pick something else` },
  ]);
  if (confirm === 1) return handleFreeText(prompt, items, stepMachine, stepIndex, context, isOptional, block);

  const check = validateCombination(typed, context);
  if (!check.valid) {
    console.log(`
  ${yellow('⚠')} ${check.reason}
`);
    const opts = [
      '→ Continue - I understand the tradeoff',
      ...check.alternatives.map(a => `→ ${a}`),
      '→ Type a different value',
    ];
    const choice = await arrowSelect('How would you like to proceed?', opts.map(o => ({ label: o })));
    if (choice === 0) return typed;
    if (choice === opts.length - 1) return handleFreeText(prompt, items, stepMachine, stepIndex, context, isOptional, block);
    return check.alternatives[choice - 1];
  }

  console.log(dim('  Custom value - the agent will handle compatibility at runtime.'));
  return typed;
};

const selectRequired = async (prompt, items, stepMachine, stepIndex, context = {}, block = null) => {
  const isFirstStep = stepIndex <= 1;
  const navOpts = stepMachine ? stepMachine.navOptions(stepIndex, isFirstStep) : [];
  const allItems = block !== null ? [...items, { label: NONE_LABEL }, ...navOpts] : [...items, ...navOpts];

  const idx = await arrowSelect(prompt, allItems.map(i => ({ label: typeof i === 'string' ? i : i.label })));

  if (block !== null && idx === items.length) return handleFreeText(prompt, items, stepMachine, stepIndex, context, false, block);

  const navStart = block !== null ? items.length + 1 : items.length;
  if (idx >= navStart) {
    const nav = navOpts[idx - navStart];
    return nav ? nav.value : RESTART;
  }
  return items[idx];
};

const selectOptional = async (prompt, items, stepMachine, stepIndex, context = {}, block = null) => {
  if (!items || items.length === 0) return null;
  const isFirstStep = stepIndex <= 1;
  const navOpts = stepMachine ? stepMachine.navOptions(stepIndex, isFirstStep) : [];
  const choices = [
    ...items.map(i => ({ label: typeof i === 'string' ? i : i.label })),
    { label: dim('Skip (agent will propose when needed)') },
    ...(block !== null ? [{ label: NONE_LABEL }] : []),
    ...navOpts.map(n => ({ label: n.label })),
  ];

  const idx = await arrowSelect(prompt, choices);

  if (idx === items.length) return null; // skip

  const noneIdx = block !== null ? items.length + 1 : -1;
  if (block !== null && idx === noneIdx) return handleFreeText(prompt, items, stepMachine, stepIndex, context, true, block);

  const navStart = block !== null ? items.length + 2 : items.length + 1;
  if (idx >= navStart) {
    const nav = navOpts[idx - navStart];
    return nav ? nav.value : RESTART;
  }
  return typeof items[idx] === 'string' ? items[idx] : items[idx].value;
};

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  stepHeader,
  c, bold, green, yellow, dim, cyan, blue, red,
  rl, ask,
  arrowSelect, arrowConfirm,
  selectRequired, selectOptional,
  separator, showList, summaryLine, renderTrajectoryLines,
};

'use strict';

// ── Sentinel values ───────────────────────────────────────────────────────────

const BACK     = Symbol('BACK');
const CONTINUE = Symbol('CONTINUE');
const RESTART   = Symbol('RESTART');
const SHOW_LIST = Symbol('SHOW_LIST');

// ── Step machine ──────────────────────────────────────────────────────────────

class StepMachine {
  constructor(blockEntries = []) {
    this.history      = []; // [{ stepIndex, stepName, answer }]
    this.inBackNav    = false;
    this.resumeIndex  = null; // step index where back-nav started
    this.blockEntries = blockEntries; // absolute step indices that are block entry points
    this.snapshot     = null; // history snapshot taken at back-nav start
  }

  // Push a completed step answer onto the history stack
  push(stepIndex, stepName, answer) {
    // Replace if already exists (user went back and re-answered)
    const existing = this.history.findIndex(h => h.stepIndex === stepIndex);
    if (existing > -1) {
      this.history[existing] = { stepIndex, stepName, answer };
    } else {
      this.history.push({ stepIndex, stepName, answer });
    }
  }

  // Pop the last step from history (go back)
  pop() {
    return this.history.pop() || null;
  }

  // Get the answer for a given step index (for pre-filling on back-nav)
  getAnswer(stepIndex) {
    const entry = this.history.find(h => h.stepIndex === stepIndex);
    return entry ? entry.answer : null;
  }

  // Current step count (1-based, for display)
  get stepCount() {
    return this.history.length + 1;
  }

  // Build the navigation options to append to a step's choices
  // stepIndex: current step (1-based)
  // Build navigation options — back is suppressed at block entry points
  navOptions(stepIndex) {
    const opts = [];

    if (stepIndex !== this.blockEntries[0]) {
      opts.push({ label: '← Back to previous step', value: BACK });
    }

    if (this.inBackNav) {
      const resumeName = this.history[this.resumeIndex]?.stepName || `step ${this.resumeIndex + 1}`;
      opts.push({ label: `→ Continue flow (resume from ${resumeName} - no changes applied)`, value: CONTINUE });
    }

    opts.push({ label: '← Restart configuration', value: RESTART });

    return opts;
  }

  // Take a snapshot of current history + answers (for ignore-changes restore)
  snapshotHistory() {
    this.snapshot = this.history.map(h => ({ ...h }));
  }

  // Restore history from snapshot
  restoreSnapshot() {
    if (this.snapshot) {
      this.history  = this.snapshot.map(h => ({ ...h }));
      this.snapshot = null;
    }
  }

  // Check if a step index is a block entry point
  isBlockEntry(stepIndex) {
    return this.blockEntries.includes(stepIndex);
  }

  // Enter back-nav mode — record where the user first pressed Back
  enterBackNav(currentStepIndex) {
    if (!this.inBackNav) {
      this.inBackNav   = true;
      this.resumeIndex = currentStepIndex;
      this.snapshotHistory();
    }
  }

  // Exit back-nav mode
  exitBackNav() {
    this.inBackNav   = false;
    this.resumeIndex = null;
  }

  // Reset everything
  reset() {
    this.history     = [];
    this.inBackNav   = false;
    this.resumeIndex = null;
    this.snapshot    = null;
  }
}

// ── Exports ───────────────────────────────────────────────────────────────────



// ── Question runner ───────────────────────────────────────────────────────────
// stepDefs: Array<{ name: string, run: async (machine, answers) => value | BACK | RESTART }>
// Returns the collected answers object, or the RESTART sentinel.

const runQuestions = async (stepDefs, machine) => {
  const answers = {};
  let i = 0;

  while (i < stepDefs.length) {
    const def = stepDefs[i];
    const result = await def.run(machine, answers);

    if (result === RESTART) return RESTART;

    if (result === BACK) {
      if (i === 0) return RESTART; // nowhere to go back from step 0
      machine.enterBackNav(i);     // record where back-nav started
      i--;
      // Skip back over auto-skipped steps (not in history), stop at block entry
      while (i > 0 && !machine.history.find(h => h.stepIndex === i) && !machine.isBlockEntry(i)) i--;
      // Pop the step we landed on
      const popped = machine.pop();
      if (popped) delete answers[popped.stepName];
      // Block boundary checkpoint — fires when back-nav reaches a block entry point
      const _originBlock = machine.blockEntries.findLast(e => e <= machine.resumeIndex);
      const _landedBlock = machine.blockEntries.findLast(e => e <= i);
      if (machine.isBlockEntry(i) && _landedBlock !== _originBlock) {
        const { arrowSelect } = require('./ui');
        const boundaryChoice = await arrowSelect('You\'ve reached the start of this block.', [
          { label: '→ Continue from here (re-answer this block)' },
          { label: '→ Ignore changes (restore to where you started)' },
          { label: '← Restart configuration' },
        ]);
        if (boundaryChoice === 1) {
          const resumeTarget = machine.resumeIndex;
          machine.restoreSnapshot();
          Object.keys(answers).forEach(k => delete answers[k]);
          machine.history.forEach(h => { answers[h.stepName] = h.answer; });
          machine.exitBackNav();
          const entryStep = machine.blockEntries.find(e => e <= i) ?? 0;
          i = resumeTarget != null ? resumeTarget : entryStep + 1;

        } else if (boundaryChoice === 2) {
          return RESTART;
        }
        // 'continue' — just proceed from current block entry step
      }
      continue;
    }

    if (result === CONTINUE) {
      // User chose to resume — skip forward to where they first pressed Back
      const resumeTarget = machine.resumeIndex ?? i + 1;
      machine.restoreSnapshot();
      Object.keys(answers).forEach(k => delete answers[k]);
      machine.history.forEach(h => { answers[h.stepName] = h.answer; });
      machine.exitBackNav();
      i = resumeTarget;
      continue;
    }

    // If in back-nav and step auto-skipped (null), keep going back
    if (result === null && machine.inBackNav) {
      if (i === 0) return RESTART;
      i--;
      while (i > 0 && !machine.history.find(h => h.stepIndex === i) && !machine.isBlockEntry(i)) i--;
      const popped = machine.pop();
      if (popped) delete answers[popped.stepName];
      continue;
    }

    // Normal answer — if re-answering during back-nav, exit back-nav mode
    if (machine.inBackNav) machine.exitBackNav();

    machine.push(i, def.name, result);
    answers[def.name] = result;
    i++;
  }

  return answers;
};

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = { StepMachine, BACK, CONTINUE, RESTART, SHOW_LIST, runQuestions };

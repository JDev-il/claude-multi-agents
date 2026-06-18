'use strict';

// ── Sentinel values ───────────────────────────────────────────────────────────

const BACK     = Symbol('BACK');
const CONTINUE = Symbol('CONTINUE');
const RESTART  = Symbol('RESTART');

// ── Step machine ──────────────────────────────────────────────────────────────

class StepMachine {
  constructor() {
    this.history      = []; // [{ stepIndex, stepName, answer }]
    this.inBackNav    = false;
    this.resumeIndex  = null; // step index where back-nav started
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
  // isFirstStep: true if this is step 2 (first real choice after project name)
  navOptions(stepIndex, isFirstStep = false) {
    const opts = [];

    if (!isFirstStep) {
      opts.push({ label: '← Back to previous step', value: BACK });
    }

    if (this.inBackNav) {
      const resumeName = this.history[this.resumeIndex]?.stepName || `step ${this.resumeIndex + 1}`;
      opts.push({ label: `→ Continue flow (resume from ${resumeName} - no changes applied)`, value: CONTINUE });
    }

    opts.push({ label: '← Restart configuration', value: RESTART });

    return opts;
  }

  // Enter back-nav mode — record where the user first pressed Back
  enterBackNav(currentStepIndex) {
    if (!this.inBackNav) {
      this.inBackNav   = true;
      this.resumeIndex = currentStepIndex;
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
  }
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = { StepMachine, BACK, CONTINUE, RESTART };

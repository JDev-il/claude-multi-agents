#!/usr/bin/env node

/**
 * scope-utils.js — shared scope logic for complete.js and preflight.js
 * Extracted to ensure identical glob matching and override resolution
 * across merge-time enforcement and pre-flight assessment.
 */

'use strict';

/**
 * Match a file path against a glob pattern.
 * Supports /** suffix, single *, and double ** patterns.
 */
const matchesGlob = (file, pat) => {
  if (pat.endsWith('/**')) return file.startsWith(pat.slice(0, -3));
  if (pat.includes('*')) {
    const re = pat.replace(/[.+^${}()|[\]\\]/g, '\\$&')
                  .replace(/\*\*/g, 'DOUBLESTAR')
                  .replace(/\*/g, '[^/]*')
                  .replace(/DOUBLESTAR/g, '.*');
    return new RegExp('^' + re + '$').test(file);
  }
  return file === pat;
};

/**
 * Resolve the effective allowed/blocked lists for a given agent + scope,
 * respecting onlyBeforeScaffolded override logic.
 *
 * @param {object} scopePolicy   - full parsed scope-policy.json
 * @param {string} scope         - 'client' | 'backend' | 'shared'
 * @param {string} agent         - agent name e.g. 'UI', 'INIT'
 * @param {object} scaffolded    - config.scaffolded e.g. { client: false, backend: false }
 * @returns {{ allowed: string[], blocked: string[] }}
 */
const resolveScope = (scopePolicy, scope, agent, scaffolded = {}) => {
  const policyScope    = scopePolicy[scope] || {};
  const agentKey       = agent && agent.toUpperCase();
  const override       = policyScope.agentOverrides && policyScope.agentOverrides[agentKey];
  const scaffoldedFlag = scaffolded[scope] || false;
  const overrideActive = override && (!override.onlyBeforeScaffolded || !scaffoldedFlag);
  const allowed        = (overrideActive && override.allowed) || policyScope.allowed || [];
  const blocked        = policyScope.blocked || [];
  return { allowed, blocked };
};

/**
 * Given a list of file paths and resolved allowed/blocked lists,
 * return files that violate scope boundaries.
 */
const findViolations = (files, allowed, blocked) =>
  files.filter(file => {
    const isAllowed = allowed.some(pat => matchesGlob(file, pat));
    const isBlocked = blocked.some(pat => matchesGlob(file, pat));
    return !isAllowed || isBlocked;
  });

/**
 * Given a list of file paths and resolved allowed list,
 * return only files that fall within scope (for preflight intersection).
 */
const findInScope = (files, allowed, blocked) =>
  files.filter(file => {
    const isAllowed = allowed.some(pat => matchesGlob(file, pat));
    const isBlocked = blocked.some(pat => matchesGlob(file, pat));
    return isAllowed && !isBlocked;
  });

module.exports = { matchesGlob, resolveScope, findViolations, findInScope };

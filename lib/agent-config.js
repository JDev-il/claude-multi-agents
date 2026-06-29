'use strict';

// ── Agent definitions ─────────────────────────────────────────────────────────

const AGENTS = {
  client:  ['UI', 'LOGIC', 'FORMS', 'ROUTING', 'TESTING', 'ACCESSIBILITY'],
  backend: ['INIT', 'API', 'LOGIC', 'AUTH', 'DB', 'TESTING', 'EVENTS', 'JOBS'],
  shared:  ['SECURITY'],
};
// Short descriptions per agent
const AGENT_DESCRIPTIONS = {
  client: {
    UI:            'scaffolds the full project structure',
    LOGIC:         'state management, API integration, custom hooks',
    FORMS:         'form components, validation, submission handling',
    ROUTING:       'page routing, navigation, URL structure',
    TESTING:       'unit and integration tests',
    ACCESSIBILITY: 'a11y compliance, keyboard navigation',
  },
  backend: {
    INIT:    'scaffolds backend architecture, folder structure, DB setup, wiring config and contracts',
    API:     'REST/GraphQL endpoints, request/response handling',
    LOGIC:   'business logic, services, data processing',
    AUTH:    'authentication, authorization, session management',
    DB:      'database schemas, migrations, queries',
    TESTING: 'API and integration tests',
    EVENTS:  'event queues, pub/sub, webhooks',
    JOBS:    'background jobs, scheduled tasks, workers',
  },
  shared: {
    SECURITY: 'shared auth utilities, encryption, input validation',
  },
};

// Scope constraints appended to every task description - agent cannot bypass its own task
const AGENT_TASK_SUFFIX = {
  client: {
    UI:            ' - scaffold project structure and component shells ONLY. No business logic, state management, or API calls. Use <!-- TODO: LOGIC agent --> where logic will be needed.',
    LOGIC:         ' - implement state, services, and API integration ONLY. No UI markup or styling changes. No route definitions.',
    FORMS:         ' - implement form components, validation rules, and submission handlers ONLY. No UI redesign. No state outside forms.',
    ROUTING:       ' - implement routes, guards, lazy loading, and navigation ONLY. No business logic. No UI changes.',
    TESTING:       ' - write unit and integration tests ONLY. Do not modify production code except to fix bugs directly revealed by failing tests.',
    ACCESSIBILITY: ' - implement ARIA attributes, keyboard navigation, and semantic HTML ONLY. No visual redesign. No business logic changes.',
  },
  backend: {
    INIT:    ' - scaffold the backend architecture ONLY. Decide folder structure, MVC/service pattern, DB connection setup, and framework configuration. Bootstrap CONTRACTS.md with initial shared types. Write wiring.config.json backend section with all required runtime vars per environment. No endpoint implementation. No business logic.',
    API:     ' - read CONTRACTS.md and wiring.config.json first as binding contracts before implementing anything. Implement route handlers, controllers, and DTOs ONLY. No business logic services. No auth middleware. No database queries. No architectural changes.',
    LOGIC:   ' - implement services and business logic ONLY. No route definitions. No auth middleware. No database schema changes.',
    AUTH:    ' - implement authentication and authorization ONLY. No business logic. No database schema changes. No API route restructuring.',
    DB:      ' - implement database schema, migrations, and queries ONLY. No business logic. No API handlers. No auth.',
    TESTING: ' - write unit and integration tests ONLY. Do not modify production code except to fix bugs directly revealed by failing tests.',
    EVENTS:  ' - implement event queues, pub/sub, and webhooks ONLY. No business logic. No API endpoint changes.',
    JOBS:    ' - implement background jobs and scheduled tasks ONLY. No business logic services. No API endpoints.',
  },
  shared: {
    SECURITY: ' - implement shared auth utilities, encryption, and input validation ONLY. No scope-specific business logic.',
  },
};

// Agents that require an existing scope scaffold before they can run
const SCAFFOLD_REQUIRED = ['LOGIC', 'FORMS', 'ROUTING', 'TESTING', 'ACCESSIBILITY', 'API', 'AUTH', 'DB', 'EVENTS', 'JOBS'];

// Agents that depend on shared contracts (CONTRACTS.md)
const CONTRACTS_REQUIRED = ['LOGIC', 'AUTH', 'API', 'FORMS', 'INIT'];



// Prerequisite agents that must be COMPLETED before an agent can run
const AGENT_PREREQUISITES = {
  client: {
    LOGIC:         ['UI'],
    FORMS:         ['UI'],
    ROUTING:       ['UI'],
    TESTING:       ['UI', 'LOGIC'],
    ACCESSIBILITY: ['UI'],
  },
  backend: {
    API:           ['INIT'],
    LOGIC:         ['INIT', 'DB'],
    AUTH:          ['INIT', 'LOGIC'],
    DB:            ['INIT'],
    EVENTS:        ['INIT', 'API'],
    JOBS:          ['INIT', 'DB'],
    TESTING:       ['INIT', 'API', 'LOGIC'],
  },
};

const DOD_ITEMS = {
  UI:            ['All planned components exist and render correctly', 'No business logic inside components', 'All values derive from design tokens', 'Shared types consumed from CONTRACTS.md'],
  LOGIC:         ['All planned logic units exist and function correctly', 'No API calls outside the service layer', 'All response types from CONTRACTS.md', 'State and data fetching concerns separated'],
  FORMS:         ['All fields exist with correct validation rules', 'Error messages are clear and user-facing', 'Submission payload matches CONTRACTS.md', 'Double submission is prevented'],
  ROUTING:       ['All routes resolve to correct components', 'Every protected route declares its guard', 'All routes are lazy loaded unless justified', 'Route paths are centralized'],
  TESTING:       ['All planned test cases exist and pass', 'Happy path, edge cases, and failure states covered', 'Test data shapes from CONTRACTS.md', 'No implementation changes made'],
  ACCESSIBILITY: ['All audit findings resolved', 'Every interactive element keyboard reachable', 'Focus managed after dynamic content changes', 'Color contrast meets WCAG 2.1 AA'],
  API:           ['All endpoints exist with correct HTTP methods', 'DTOs own all input validation', 'All types in CONTRACTS.md', 'Every endpoint declares access control'],
  AUTH:          ['All strategies and guards function correctly', 'No secrets in code', 'All tokens have expiry set', 'Auth failures return consistent responses'],
  DB:            ['All entities and relationships defined', 'Migration generated and surfaced', 'Repository methods own all queries', 'No ORM auto-sync used'],
  EVENTS:        ['All emitters and handlers exist', 'Receivers acknowledge immediately', 'All handlers are idempotent', 'Failure handling defined'],
  JOBS:          ['All jobs exist with correct triggers', 'Schedule expressions from config', 'All jobs are idempotent', 'Failure strategy defined for every job'],
  SECURITY:      ['All findings documented with severity', 'Every finding has a remediation proposal', 'OWASP Top 10 coverage confirmed', 'No fixes implemented directly'],
};

// ── Agent context questions ───────────────────────────────────────────────────

const AGENT_QUESTIONS = {
  LOGIC: [
    { key: 'entities',   prompt: 'What entities / models are involved?',                consequence: 'agent may generate incompatible types' },
    { key: 'endpoints',  prompt: 'What API endpoints need to be integrated?',           consequence: 'agent may assume incorrect contracts' },
    { key: 'state',      prompt: 'What state needs to be managed?',                     consequence: 'agent may miss state requirements' },
    { key: 'contracts',  prompt: 'Any contracts from CONTRACTS.md to reference?',       consequence: 'shared types may need rework after' },
  ],
  FORMS: [
    { key: 'fields',     prompt: 'What form fields are required?',                      consequence: 'agent may miss field requirements' },
    { key: 'validation', prompt: 'What validation rules apply?',                        consequence: 'validation logic may be incomplete' },
    { key: 'endpoint',   prompt: 'What endpoint does this form submit to?',             consequence: 'submission payload may not match contracts' },
  ],
  AUTH: [
    { key: 'strategy',   prompt: 'What auth strategy is needed? (JWT / OAuth / etc.)',  consequence: 'auth implementation may use incorrect strategy' },
    { key: 'guards',     prompt: 'What entities or routes need auth guards?',           consequence: 'access control may be incomplete' },
    { key: 'tokens',     prompt: 'What token / session requirements apply?',            consequence: 'token handling may not match contracts' },
  ],
  API: [
    { key: 'endpoints',  prompt: 'What endpoints need to be created?',                  consequence: 'endpoint coverage may be incomplete' },
    { key: 'dtos',       prompt: 'What request / response DTOs are needed?',            consequence: 'DTOs may not match client contracts' },
    { key: 'auth',       prompt: 'Which endpoints require auth guards?',                consequence: 'access control may be missing' },
  ],
  DB: [
    { key: 'entities',   prompt: 'What entities / tables need to be defined?',          consequence: 'schema may be incomplete' },
    { key: 'relations',  prompt: 'What relationships exist between entities?',           consequence: 'relations may be missing or incorrect' },
    { key: 'migrations', prompt: 'Any specific migration requirements?',                consequence: 'migration may not match expected schema' },
  ],
  TESTING: [
    { key: 'scenarios',  prompt: 'What scenarios / flows need test coverage?',          consequence: 'test coverage may be insufficient' },
    { key: 'edge',       prompt: 'What edge cases should be covered?',                  consequence: 'edge cases may be missed' },
  ],
};

module.exports = {
  AGENTS,
  AGENT_DESCRIPTIONS,
  AGENT_TASK_SUFFIX,
  SCAFFOLD_REQUIRED,
  CONTRACTS_REQUIRED,
  AGENT_PREREQUISITES,
  DOD_ITEMS,
  AGENT_QUESTIONS,
};

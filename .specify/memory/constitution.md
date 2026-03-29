<!-- SYNC IMPACT REPORT
Version change: 1.0.0 → 1.1.0
Bump type: MINOR — Principle III materially revised to reflect API-based scraping approach

Modified principles:
  III. Maintainability — Easy to Update When the Target Changes
       Old: Required CSS selectors externalized in selectors.json config file.
       New: Requires API parameters (dispensary ID, APQ hash, query structure) externalized
            or clearly documented; selectors.json reference removed as project uses
            Dutchie GraphQL API interception, not DOM scraping.

Added sections: none
Removed sections: none

Templates checked:
  ✅ .specify/templates/plan-template.md — no selector/CSS references; generic constitution gates
  ✅ .specify/templates/spec-template.md — no selector/CSS references
  ✅ .specify/templates/tasks-template.md — no selector/CSS references
  ✅ README.md — already updated to reflect API approach (no selector steps)

Follow-up TODOs: none
-->

# Web Scraping & Notification App Constitution

## Core Principles

### I. Security First (NON-NEGOTIABLE)

No secrets leak — ever. All credentials (API keys, passwords, email addresses) live exclusively
in `.env` and nowhere else. `.env` MUST be in `.gitignore` before any credential is written to
it. Secrets MUST never appear in log output, error stack traces, or debug screenshots. When
logging connection details or authentication status, mask or omit actual values. Error messages
MUST be reviewed for credential leakage before being written to stdout or any log file.

### II. Resilience — Fail Gracefully, Never Silently

Every external interaction (page navigation, API calls, SMTP connections) MUST have an explicit
timeout. No operation may hang indefinitely. Every failure MUST produce a useful log message
that includes what was attempted, what went wrong, and what the user should check — "Error"
alone is never acceptable. All retry loops MUST be bounded with a maximum attempt count and
delay. The browser MUST always close via a `finally` block regardless of success or failure;
orphaned browser processes are a bug. Empty results are not errors — handle them gracefully in
the notification layer. Exit codes MUST be meaningful and documented; never exit with a generic
code. Debug screenshots are mandatory on any navigation or API failure.

### III. Maintainability — Easy to Update When the Target Changes

External API parameters that are likely to change (dispensary IDs, APQ hashes, query operation
names, API base URLs) MUST be defined as named constants at the top of the module that uses
them — never inlined in logic. When the upstream API or site structure changes, only those
constants should need updating. Filter and search parameters (target URLs, brand names, category
types) MUST be configurable via environment variables or config, never hardcoded. Functions MUST
do one thing with a single, clear responsibility. File structure MUST match the spec — each file
owns one layer of the pipeline. Use descriptive names that make intent obvious without comments
(`fetchFlowerPage()` not `getData()`, `dispensaryId` not `id1`). Comments explain *why*,
not *what*.

### IV. Simplicity — No Over-Engineering

This is a single-purpose CLI script, not a framework. Do not introduce abstractions, class
hierarchies, plugin systems, or architectural patterns beyond what the spec requires. Minimize
dependencies — only install packages directly required by the spec. No ORMs, no web frameworks,
no logging libraries unless explicitly justified. No database unless the spec calls for one;
data is scraped, formatted, delivered, and discarded. Pick one module system (CommonJS or ES
modules) and be consistent — do not mix `require()` and `import`.

### V. End-to-End Testing

Testing happens end-to-end after the full pipeline is wired together. Individual tasks do not
require their own test suites unless the spec says otherwise. The first test run MUST be in
headed/visible mode so the developer can visually verify browser behavior. Edge cases MUST be
explicitly tested by manipulating config values (bad URLs, invalid credentials, non-matching
filter values) — each MUST produce the correct exit code and log output. Headless mode MUST be
verified separately after headed mode passes. Do not write unit tests unless the spec requires
them; the default strategy is manual E2E validation.

## Code Standards

All asynchronous operations MUST use `async/await`. No raw `.then()` chains except where
required by event-listener APIs (e.g., `page.on('response', ...)`); in those cases, all
returned Promises MUST be tracked and awaited before the enclosing function resolves. Use
`const` by default; use `let` only when reassignment is necessary. Never use `var`. Use template
literals for string interpolation, not concatenation. All functions that can fail MUST be wrapped
in `try/catch` with descriptive error handling. All log output MUST include ISO timestamps in the
format `[2026-03-28T09:00:00.000Z] Message here`.

## Agent Behavioral Rules

Read `spec.md` before starting any task — it is the source of truth for what the application
does. Read `tasks.md` before starting any task — it defines the order, acceptance criteria, and
implementation steps. Do not skip ahead; complete each task's acceptance criteria before moving
to the next. If a task's implementation reveals that the spec needs updating (e.g., the upstream
API uses a structure not accounted for), flag it — do not silently deviate from the spec. When
in doubt, choose the simpler approach.

## Governance

This constitution supersedes all ad-hoc decisions during implementation. If a principle conflicts
with speed, convenience, or a shortcut, the principle wins. Amendments require explicit user
approval and MUST be documented with rationale. Version bumps follow semantic versioning:
MAJOR for backward-incompatible governance changes or principle removals, MINOR for new or
materially revised principles, PATCH for clarifications and wording fixes. All tasks and code
reviews MUST verify compliance with these principles before being considered complete.

**Version**: 1.1.0 | **Ratified**: 2026-03-28 | **Last Amended**: 2026-03-29

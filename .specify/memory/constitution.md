# Web Scraping & Notification App Constitution

## Core Principles

### I. Security First (NON-NEGOTIABLE)
No secrets leak — ever. All credentials (API keys, passwords, email addresses) live exclusively in `.env` and nowhere else. `.env` must be in `.gitignore` before any credential is written to it. Secrets must never appear in log output, error stack traces, or debug screenshots. When logging connection details or authentication status, mask or omit actual values. Error messages must be reviewed for credential leakage before being written to stdout or any log file.

### II. Resilience — Fail Gracefully, Never Silently
Every external interaction (page navigation, selector waits, API calls, SMTP connections) must have an explicit timeout. No operation should hang indefinitely. Every failure must produce a useful log message that includes what was attempted, what went wrong, and what the user should check — "Error" alone is never acceptable. All retry loops must be bounded with a maximum attempt count and delay. The browser must always close via a `finally` block regardless of success or failure; orphaned browser processes are a bug. Empty results are not errors — handle them gracefully in the notification layer. Exit codes must be meaningful and documented; never exit with a generic code. Debug screenshots are mandatory on any navigation or selector failure.

### III. Maintainability — Easy to Update When the Target Changes
All CSS selectors must be externalized in a config file — no selectors hardcoded in source code. When the target site updates its DOM, only the config file should need to change. Filter and search parameters (URLs, category names, brand names, search terms) must be configurable via environment variables or config, never hardcoded. Functions must do one thing with a single, clear responsibility. File structure must match the spec — each file owns one layer of the pipeline. Use descriptive names that make intent obvious without comments (`extractProductCards()` not `getData()`, `categorySelector` not `sel1`). Comments explain *why*, not *what*.

### IV. Simplicity — No Over-Engineering
This is a single-purpose CLI script, not a framework. Do not introduce abstractions, class hierarchies, plugin systems, or architectural patterns beyond what the spec requires. Minimize dependencies — only install packages directly required by the spec. No ORMs, no web frameworks, no logging libraries unless explicitly justified. No database unless the spec calls for one; data is scraped, formatted, delivered, and discarded. Pick one module system (CommonJS or ES modules) and be consistent — do not mix `require()` and `import`.

### V. End-to-End Testing
Testing happens end-to-end after the full pipeline is wired together. Individual tasks do not require their own test suites unless the spec says otherwise. The first test run must be in headed/visible mode so the developer can visually verify browser navigation. Edge cases must be explicitly tested by manipulating config values (bad URLs, wrong selectors, invalid credentials, non-matching filter values) — each must produce the correct exit code and log output. Headless mode must be verified separately after headed mode passes. Do not write unit tests unless the spec requires them; the default strategy is manual E2E validation.

## Code Standards

All asynchronous operations must use `async/await`. No raw `.then()` chains. Use `const` by default; use `let` only when reassignment is necessary. Never use `var`. Use template literals for string interpolation, not concatenation. All functions that can fail must be wrapped in `try/catch` with descriptive error handling. All log output must include ISO timestamps in the format `[2026-03-28T09:00:00.000Z] Message here`.

## Agent Behavioral Rules

Read `spec.md` before starting any task — it is the source of truth for what the application does. Read `tasks.md` before starting any task — it defines the order, acceptance criteria, and implementation steps. Do not skip ahead; complete each task's acceptance criteria before moving to the next. If a task's implementation reveals that the spec needs updating (e.g., the target site uses a structure not accounted for), flag it — do not silently deviate from the spec. When in doubt, choose the simpler approach.

## Governance

This constitution supersedes all ad-hoc decisions during implementation. If a principle conflicts with speed, convenience, or a shortcut, the principle wins. Amendments to this constitution require explicit user approval and must be documented with rationale. All tasks and code reviews must verify compliance with these principles before being considered complete.

**Version**: 1.0.0 | **Ratified**: 2026-03-28 | **Last Amended**: 2026-03-28

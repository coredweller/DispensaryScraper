# Implementation Plan: Dispensary Menu Scraper & Email Notifier

**Branch**: `002-dispensary-scraper` | **Date**: 2026-03-28 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-dispensary-scraper/spec.md`

## Summary

Build a Node.js CLI tool that uses Puppeteer to navigate the Krystal Leaves dispensary menu, detect and enter an embedded menu iframe (Dutchie/Jane), click the Flower category, scroll through lazy-loaded products, extract strain listings for Viola and 710 Labs (capturing max weight/price tier), compose an HTML email report, and deliver it via Nodemailer + Gmail SMTP. All selectors are externalized to `selectors.json`; credentials live in `.env`. A dated log file is written to `logs/` on every run.

## Technical Context

**Language/Version**: Node.js v18+
**Primary Dependencies**: Puppeteer (headless Chromium), Nodemailer (Gmail SMTP), dotenv (env config)
**Storage**: File system only — `logs/YYYY-MM-DD.log` (append), `screenshots/debug.png` (on failure)
**Testing**: Node.js built-in `node:test` + `node:assert` (zero additional dependencies)
**Target Platform**: Local developer machine (Windows/Mac/Linux)
**Project Type**: CLI tool
**Performance Goals**: Full pipeline completes in < 60 seconds on standard broadband
**Constraints**: No persistent database, no web UI, no third-party logging service, single recipient
**Scale/Scope**: Single user, on-demand or scheduled runs

## Constitution Check

No active constitution constraints for this project (constitution template is unpopulated). All design decisions default to simplicity, minimal dependencies, and testability — consistent with the tool's solo-developer CLI context.

**Post-design re-check**: No violations identified.

## Project Structure

### Documentation (this feature)

```text
specs/002-dispensary-scraper/
├── plan.md           # This file
├── research.md       # Phase 0 — technology decisions
├── data-model.md     # Phase 1 — entities and relationships
├── quickstart.md     # Phase 1 — developer setup guide
├── contracts/
│   └── cli-contract.md   # Exit codes, env vars, email format, selectors.json schema
└── tasks.md          # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── index.js          # Entry point: orchestrates scrape → filter → email → exit
├── scraper.js        # Puppeteer: navigate, iframe detect, click Flower, scroll, extract
├── filter.js         # Brand filter: case-insensitive match against BRANDS env var
├── mailer.js         # Nodemailer: build HTML email, send via Gmail SMTP, retry once
├── logger.js         # Dual-write: stdout + logs/YYYY-MM-DD.log (native fs stream)
└── config.js         # Load .env via dotenv + parse selectors.json; validate required fields

selectors.json        # Externalized CSS selectors (no source changes needed for DOM updates)
.env.example          # Config template (committed); .env (gitignored)
logs/                 # Per-run log files (gitignored)
screenshots/          # Debug screenshots on failure (gitignored)

tests/
├── unit/
│   ├── filter.test.js    # Brand filter logic (pure function, no browser)
│   └── mailer.test.js    # HTML email builder (pure function, no SMTP)
└── integration/
    └── scraper.test.js   # End-to-end scrape against live or mock page
```

**Structure Decision**: Single project layout (Option 1). No monorepo, no frontend, no API. Source files are flat in `src/` to match the tool's simple pipeline structure.

## Complexity Tracking

No constitution violations requiring justification.

## Implementation Phases

### Phase 1: Core Infrastructure
- `config.js` — env validation + selectors.json loader
- `logger.js` — dual-write log stream
- `.env.example` + `selectors.json` initial values
- `package.json` with `puppeteer`, `nodemailer`, `dotenv` dependencies

### Phase 2: Scraper
- `scraper.js` — Puppeteer launch, iframe detect/switch, Flower click, scroll loop, product extraction
- Error handling: 3 retries for site unreachable, screenshot on nav failure, exit codes 1/2

### Phase 3: Filter
- `filter.js` — pure function, case-insensitive brand match, "710labs" normalization

### Phase 4: Mailer
- `mailer.js` — HTML template (brand-grouped tables), no-results message, transporter.verify(), retry once, exit code 3

### Phase 5: Orchestrator + Logging
- `src/index.js` — pipeline: config → scrape → filter → email → close browser → exit
- Browser always closed in `finally` block

### Phase 6: Tests
- `filter.test.js` — unit tests for filter function
- `mailer.test.js` — unit tests for HTML builder
- `scraper.test.js` — integration test (live or mock)

### Phase 7: Documentation
- README with setup, run, schedule, troubleshoot
- Scheduling examples (cron + Windows Task Scheduler)

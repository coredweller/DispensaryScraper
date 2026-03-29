# Tasks: Dispensary Menu Scraper & Email Notifier

**Input**: Design documents from `/specs/002-dispensary-scraper/`
**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/ ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Tests are included for pure-function modules (filter, mailer HTML builder) per plan.md Phase 6

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and directory structure

- [X] T001 Initialize Node.js project — create `package.json` with `"type": "module"` (ESM); dependencies: `puppeteer`, `nodemailer`, `dotenv`, `zod`; devDependencies: `typescript`, `tsx`, `vitest`, `@types/node`, `@types/nodemailer`
- [X] T002 Create `tsconfig.json` — strict mode, NodeNext modules, `outDir: dist`, `target: ES2022`
- [X] T003 Create directory structure: `src/`, `tests/unit/`, `tests/integration/`, `logs/`, `screenshots/`, `dist/` — add `.gitkeep` to `logs/` and `screenshots/`
- [X] T004 [P] Create `.gitignore` — exclude `node_modules/`, `.env`, `logs/`, `screenshots/`, `dist/`
- [X] T005 [P] Create `.env.example` with all required variables: `TARGET_URL`, `BRANDS`, `GMAIL_USER`, `GMAIL_PASS`, `RECIPIENT_EMAIL`, `HEADLESS`, `DEBUG_SCREENSHOT_PATH`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Config loader and logger — required by every subsequent module

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T006 Implement `src/types.ts` — export shared TypeScript interfaces: `Product`, `ScrapeResult`, `EmailNotification`, `SelectorConfig`, `AppConfig`
- [X] T007 Implement `src/config.ts` — load `.env` via dotenv; validate all required env vars (`BRANDS`, `GMAIL_USER`, `GMAIL_PASS`, `RECIPIENT_EMAIL`) using `z.object({...}).parse(process.env)`; load and parse `selectors.json`; log descriptive error and call `process.exit(1)` on any missing/invalid value; export typed `AppConfig`
- [X] T008 Implement `src/logger.ts` — create write stream to `logs/YYYY-MM-DD.log` in append mode using native `fs`; export `log(msg: string)` function that writes ISO-8601-prefixed line to both `process.stdout` and the file stream
- [X] T009 [P] Create `selectors.json` at project root with all keys from the `SelectorConfig` contract (`iframeContainer`, `flowerCategoryLink`, `flowerCategoryLinkFallback`, `productCard`, `brandLabel`, `strainName`, `strainType`, `thcPercent`, `weightPriceTier`) — set placeholder values (empty strings) to be populated in Phase 8

**Checkpoint**: `src/config.ts` and `src/logger.ts` importable and type-checkable before any story work begins

---

## Phase 3: User Story 1 — Scrape Flower Strains from Menu (Priority: P1) 🎯 MVP

**Goal**: Puppeteer navigates to the menu, detects and enters any iframe, clicks Flower, scrolls through lazy-loaded products, and returns a raw array of `Product` objects.

**Independent Test**: Run `npx tsx -e "import('./src/scraper.js').then(m => m.scrape()).then(r => console.log(r))"` and verify a non-empty array of products is logged to console; check `logs/` for a dated log file.

- [X] T010 [US1] Implement `src/scraper.ts` — export async `scrape(config: AppConfig): Promise<Product[]>` function: launch Puppeteer with `headless` from config, navigate to `TARGET_URL` with `waitUntil: 'networkidle2'`; log start and page-load events via logger; block image/font/media resources with `page.setRequestInterception(true)`
- [X] T011 [US1] Add iframe detection to `src/scraper.ts` — after page load, check for `iframeContainer` selector; if found, switch operating context to `iframeHandle.contentFrame()`; if not found, continue on top-level page; log which context is in use
- [X] T012 [US1] Add Flower category click to `src/scraper.ts` — attempt `flowerCategoryLink` selector first; if not found within 15s, fall back to scanning all `<a>` elements by `innerText === 'Flower'`; if both fail, save screenshot to `DEBUG_SCREENSHOT_PATH` and throw error with exit code 2
- [X] T013 [US1] Add lazy-load scroll loop to `src/scraper.ts` — scroll one viewport at a time via `page.evaluate(() => window.scrollBy(0, window.innerHeight))`; wait 1500ms; compare `productCard` count before and after; exit loop when count stabilizes or 5 iterations reached
- [X] T014 [US1] Add product extraction to `src/scraper.ts` — for each element matching `productCard` selector, extract `strainName`, `brand`, `strainType`, `thcPercent`, and weight/price tiers via `page.evaluate()`; select the tier with the largest numeric weight as `maxWeight`/`maxPrice`; skip cards missing `strainName` or `brand` with a warning log; return `Product[]`
- [X] T015 [US1] Add site-unreachable retry logic to `src/scraper.ts` — wrap navigation in a loop: retry up to 3 times with 10s delay on `net::ERR_*` or timeout errors; after 3 failures log error and throw with exit code 1

**Checkpoint**: `scrape()` returns a `Product[]` array independently — email and filter not required to validate this story

---

## Phase 4: User Story 2 — Filter Results by Brand (Priority: P1)

**Goal**: Pure `filter(products, brands)` function returns only products whose brand matches the configured brand list, with normalization.

**Independent Test**: Run `npx vitest run tests/unit/filter.test.ts` and verify all assertions pass on mock product arrays (no browser or network required).

- [X] T016 [US2] Implement `src/filter.ts` — export pure `filter(products: Product[], brandsString: string): Product[]` function: split `brandsString` on commas, trim and lowercase each; normalize input brand by lowercasing, trimming, and replacing `"710labs"` with `"710 labs"`; return filtered array; return empty array (no throw) when no matches found
- [X] T017 [P] [US2] Write unit tests in `tests/unit/filter.test.ts` using Vitest — cover: multiple brands matched, zero matches, brand with inconsistent casing/whitespace (`" VIOLA "`, `"710 LABS"`, `"710labs"`), empty input array; use `describe`/`it`/`expect` from `vitest`

**Checkpoint**: Filter logic independently verified with no browser or network dependency

---

## Phase 5: User Story 3 — Email Results via Gmail (Priority: P2)

**Goal**: `mailer.ts` builds an HTML email from filtered products and sends it via Gmail SMTP; handles empty results and SMTP failures gracefully.

**Independent Test**: Run `npx vitest run tests/unit/mailer.test.ts` to verify HTML output structure. For SMTP test: call `verify()` manually to confirm credentials work.

- [X] T018 [US3] Implement HTML email builder in `src/mailer.ts` — export `buildHtml(filteredProducts: Product[], date: string): string` pure function: group products by brand; render one `<table>` per brand with columns Strain, Type, THC%, Weight, Price; use `"—"` for any missing field
- [X] T019 [US3] Add no-results path to `src/mailer.ts` — when `filteredProducts` is empty, generate plain-paragraph body: `"No Viola or 710 Labs flower strains are currently listed on the Krystal Leaves menu as of YYYY-MM-DD."`
- [X] T020 [US3] Configure Nodemailer transporter in `src/mailer.ts` — `host: smtp.gmail.com`, `port: 587`, `secure: false` (STARTTLS), `auth.user: GMAIL_USER`, `auth.pass: GMAIL_PASS` from config; export `verify(): Promise<void>` and `send(html: string, date: string): Promise<void>` functions
- [X] T021 [US3] Add retry logic to `src/mailer.ts` `send()` — on SMTP error, wait 5s and retry once; if second attempt fails, log SMTP error with troubleshooting guidance and throw with exit code 3; subject format: `"Krystal Leaves Flower Menu — Viola & 710 Labs — YYYY-MM-DD"`
- [X] T022 [P] [US3] Write unit tests in `tests/unit/mailer.test.ts` using Vitest — cover: `buildHtml` with results (assert table structure, column count, brand grouping), `buildHtml` with empty array (assert no-results paragraph), missing optional fields render as `"—"`; use `describe`/`it`/`expect` from `vitest`

**Checkpoint**: HTML builder verified by unit tests; SMTP send verified manually with real credentials before proceeding

---

## Phase 6: User Story 4 — Run as a Single CLI Command (Priority: P2)

**Goal**: `npx tsx src/index.ts` (dev) or `node dist/index.js` (production) runs the full pipeline end-to-end, exits with correct code, and always closes the browser.

**Independent Test**: Run `npx tsx src/index.ts` with a valid `.env`; verify email received, `logs/YYYY-MM-DD.log` contains full run output, process exits with code 0. Test failure path by setting `TARGET_URL` to an invalid URL and verifying exit code 1.

- [X] T023 [US4] Implement `src/index.ts` — orchestrate full pipeline: `config` → `mailer.verify()` → `scraper.scrape()` → `filter.filter()` → `mailer.send()` → log completion; wrap in `try/catch` propagating exit codes 1–3
- [X] T024 [US4] Add `finally` block to `src/index.ts` — ensure `browser.close()` is always called after pipeline success or any error; log browser-close event
- [X] T025 [US4] Pass logger into all pipeline stages in `src/index.ts` — log: scraper start/end with product count, filter result count per brand, email send success/failure, total elapsed time, final exit code

**Checkpoint**: Full end-to-end pipeline functional as `npx tsx src/index.ts`; all exit codes reachable and verified

---

## Phase 7: User Story 5 — Schedule Automated Runs (Priority: P3)

**Goal**: README documents everything needed to clone, configure, run, and schedule the tool.

**Independent Test**: Follow the README from a clean clone; verify the tool runs and sends email within 15 minutes of starting setup.

- [X] T026 [US5] Write `README.md` — sections: Prerequisites, Setup (clone → npm install → .env config → selectors.json), Running (`npx tsx src/index.ts` for dev; `npm run build && node dist/index.js` for production), Exit codes table, Troubleshooting table
- [X] T027 [P] [US5] Add scheduling section to `README.md` — cron example (Linux/Mac) with `>> logs/cron.log 2>&1` redirect, Windows Task Scheduler step-by-step instructions

**Checkpoint**: README sufficient for a new user to set up and run the tool without prior context

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Real selector values, npm scripts, integration test, and final validation

- [ ] T028 Populate `selectors.json` with real CSS selectors — manually inspect `https://www.krystaleaves.com/menu` (with `HEADLESS=false`) and fill in all selector values; verify each selector returns expected elements
- [ ] T029 [P] Write integration test in `tests/integration/scraper.test.ts` using Vitest — create a minimal HTML fixture file mimicking the menu structure; use Puppeteer to load it via `file://` protocol; assert that `scrape()` returns the expected product array from the fixture; use `describe`/`it`/`expect` from `vitest`
- [X] T030 [P] Add `npm` scripts to `package.json`: `"dev": "npx tsx src/index.ts"`, `"build": "npx tsc"`, `"start": "node dist/index.js"`, `"typecheck": "npx tsc --noEmit"`, `"test": "npx vitest run tests/unit"`, `"test:integration": "npx vitest run tests/integration"`
- [ ] T031 Run full validation — run `npm run typecheck` (zero errors), `npm test` (all unit tests pass), confirm `npm run dev` sends email with correct format, `logs/` populated, exit code 0; update README if any steps were wrong

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — **BLOCKS all user stories**
- **US1 (Phase 3)**: Depends on Phase 2 — first P1 story, MVP core
- **US2 (Phase 4)**: Depends on Phase 2 — second P1 story, can run in parallel with US1 (different file)
- **US3 (Phase 5)**: Depends on Phase 2 — can start after Phase 2 independent of US1/US2
- **US4 (Phase 6)**: Depends on US1 + US2 + US3 all complete — orchestrates them
- **US5 (Phase 7)**: Depends on US4 — documents the finished tool
- **Polish (Phase 8)**: Depends on all stories complete

### User Story Dependencies

```
Phase 1 (Setup)
  └── Phase 2 (Foundational)
        ├── US1 (Phase 3) ─────────────────────────┐
        ├── US2 (Phase 4) ──────────────────────────┤
        └── US3 (Phase 5) ──────────────────────────┤
                                                     └── US4 (Phase 6)
                                                           └── US5 (Phase 7)
                                                                 └── Polish (Phase 8)
```

### Within Each Phase

- [P]-marked tasks within a phase have no file conflicts — run in parallel
- Within scraper (Phase 3): T010 → T011 → T012 → T013 → T014 → T015 (sequential, same file)
- Within mailer (Phase 5): T018 → T019 → T020 → T021 (sequential, same file); T022 [P] once T018–T019 exist

### Parallel Opportunities

| Parallel Group | Tasks |
|----------------|-------|
| Phase 1 setup files | T004, T005 |
| Phase 2 selectors | T009 alongside T006, T007, T008 |
| US1 + US2 | Phases 3 and 4 (different files: scraper.ts vs filter.ts) |
| US1 + US2 + US3 | Phases 3, 4, and 5 all depend only on Phase 2 |
| Unit tests | T017, T022 are [P] once their subject modules exist |
| Phase 8 | T029, T030 in parallel |

---

## Parallel Example: US1 + US2 (Both P1)

```
After Phase 2 completes:

  Stream A (scraper.ts):          Stream B (filter.ts + tests):
  T010 scraper launch             T016 filter.ts implementation
  T011 iframe detection           T017 filter.test.ts unit tests  [P]
  T012 Flower click
  T013 scroll loop
  T014 product extraction
  T015 retry logic
```

---

## Implementation Strategy

### MVP (User Stories 1 + 2 Only — console output, no email)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: US1 (scraper)
4. Complete Phase 4: US2 (filter)
5. **STOP and VALIDATE**: `scrape()` + `filter()` return correct products in console — email not required
6. Extend to full MVP by adding US3 + US4

### Full Delivery (All Stories)

1. Setup → Foundational → US1 + US2 (parallel) → US3 → US4 → US5 → Polish
2. Each phase produces a testable, runnable increment

### Solo Developer Recommended Order

T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008 → T009 → T010 → T011 → T012 → T013 → T014 → T015 → T016 → T017 → T018 → T019 → T020 → T021 → T022 → T023 → T024 → T025 → T026 → T027 → T028 → T029 → T030 → T031

---

## Notes

- [P] = different files, no blocking dependency — safe to run in parallel
- [Story] label maps each task to its user story for traceability
- Commit after each phase checkpoint at minimum
- Set `HEADLESS=false` during T028 to visually inspect selector accuracy
- T028 and T031 are manual validation steps — do not skip them before calling the feature done
- TypeScript: compile with `npm run build` (`npx tsc`), type-check with `npm run typecheck` (`npx tsc --noEmit`)
- Dev runner: `npx tsx src/index.ts` (no compile step needed)

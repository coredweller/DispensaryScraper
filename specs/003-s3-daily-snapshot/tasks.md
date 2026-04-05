# Tasks: Daily Full-Menu Snapshot to S3

**Input**: Design documents from `/specs/003-s3-daily-snapshot/`
**Branch**: `003-s3-daily-snapshot`
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Data Model**: [data-model.md](./data-model.md)

**Tests**: Write unit tests that make sense, don't do it unless there is helpful logic to test and we don't want to do integration tests. — constitution mandates manual E2E validation steps are given. Test plan is in [quickstart.md](./quickstart.md).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install new dependency before any source changes.

- [x] T001 Install `@aws-sdk/client-s3` dependency via `npm install @aws-sdk/client-s3` and verify it appears in `package.json` dependencies

**Checkpoint**: `node_modules/@aws-sdk/client-s3` exists. Ready for foundational changes.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Type system and data pipeline changes that ALL user stories depend on. MUST be complete before any US phase begins.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete. These changes propagate through every file.

- [x] T002 Update `src/types.ts` — add `ScrapedProduct extends Product` interface (fields: `thcValue?: number`, `priceAmount?: number`, `pricePrecision: number`, `priceCurrency: string`); add `ScrapeOutput` interface (fields: `products: ScrapedProduct[]`, `pagesExpected: number`, `pagesFetched: number`); extend `AppConfig` with `s3Bucket: string`, `s3Region: string`, `awsAccessKeyId: string`, `awsSecretAccessKey: string`, `timezone: string`; add `@deprecated` JSDoc to `Product.maxPrice` and `Product.thcPercent`; delete the unused `ScrapeResult` interface

- [x] T003 Update `src/config.ts` — add to Zod `envSchema`: `S3_BUCKET` (required string), `S3_REGION` (default `'us-east-1'`), `AWS_ACCESS_KEY_ID` (required string), `AWS_SECRET_ACCESS_KEY` (required string), `TIMEZONE` (default `'UTC'`); map these to the new `AppConfig` fields in `loadConfig()`; add a `console.warn` (before the return) if `process.env.TIMEZONE` was absent: `[CONFIG WARN] TIMEZONE not set — defaulting to UTC. Set TIMEZONE=America/Denver (or your timezone) for date-accurate snapshots.`

- [x] T004 Update `src/scraper.ts` — add named constants `PRICE_CURRENCY = 'USD'` and `PRICE_PRECISION = 2` near the top of the file; update `toProduct()` to return `ScrapedProduct` instead of `Product` (populate `thcValue` from `raw.THCContent?.range?.[0]`, `priceAmount` from `Math.round(prices[i] * 100)` for the max-weight tier, `pricePrecision: PRICE_PRECISION`, `priceCurrency: PRICE_CURRENCY`); update `scrape()` return type to `Promise<ScrapeOutput>`; track `pagesExpected` (final value of `interceptedTotalPages`) and `pagesFetched` (count of distinct page indices from which ≥1 product was retrieved, counting both intercepted pages and frame-fetched pages); return `{ products, pagesExpected, pagesFetched }` instead of bare `products`

- [x] T005 Update `src/filter.ts` — make the `filter` function generic: `export function filter<T extends Product>(products: T[], brandsString: string): T[]` — no other changes; this preserves `ScrapedProduct` field types through the filter call

- [x] T006 Update `src/mailer.ts` — change `buildHtml`, `renderBrandTable`, and `groupByBrand` signatures to accept `ScrapedProduct[]` / `ScrapedProduct` (import `ScrapedProduct` from `./types.js`); in `renderBrandTable`, derive the THC display as `p.thcValue != null ? `${p.thcValue}%` : '—'` and the price display as `p.priceAmount != null ? `$${(p.priceAmount / Math.pow(10, p.pricePrecision)).toFixed(p.pricePrecision)}` : '—'`; remove the references to `p.thcPercent` and `p.maxPrice` for display (they remain on the `Product` interface but are no longer read here)

**Checkpoint**: `npm run typecheck` passes with zero errors. `filter` correctly preserves `ScrapedProduct` type. `buildHtml` compiles with `ScrapedProduct[]`.

---

## Phase 3: User Story 1 — Full Menu Captured Daily (Priority: P1) 🎯 MVP

**Goal**: After each daily scrape, a JSON snapshot containing every product from the full menu is uploaded to S3 at `s3://{bucket}/runs/YYYY-MM-DD.json`.

**Independent Test**: quickstart.md Test 1 — run `npm run dev`, confirm file appears in S3, download and verify product count exceeds filtered count and schema matches [contracts/snapshot-schema.md](./contracts/snapshot-schema.md).

### Implementation for User Story 1

- [x] T007 [US1] Create `src/store.ts` — new file implementing two exports: (1) `logStorageConfig(config: AppConfig): void` — logs bucket, region, timezone (with "defaulted — set TIMEZONE env var to override" note if timezone is `'UTC'`), and the snapshot date derived via `getDateInTimezone(config.timezone)`; (2) `saveSnapshot(output: ScrapeOutput, runId: string, startTime: string, config: AppConfig): Promise<void>` — builds the JSON payload per [contracts/snapshot-schema.md](./contracts/snapshot-schema.md) (runId, date, startTime, productCount, pagesExpected, pagesFetched, products array serialized with brand/strainName/strainType/thcValue/maxWeight/priceAmount/pricePrecision/priceCurrency), calls `PutObjectCommand` with `ContentType: 'application/json'` and key `runs/${date}.json`; logs success on completion. Include `getDateInTimezone(tz: string): string` as a non-exported helper using `Intl.DateTimeFormat` with `en-CA` locale (produces YYYY-MM-DD natively). Do NOT add timeout or retry yet — that is US3 (T011, T012).

- [x] T008 [US1] Update `src/index.ts` — add imports for `logStorageConfig` and `saveSnapshot` from `./store.js` and `crypto.randomUUID` from `node:crypto`; capture `runId = crypto.randomUUID()` and `startTime = new Date().toISOString()` at the top of `main()`; call `logStorageConfig(config)` immediately after the existing startup log lines (before SMTP verify); destructure `const { products, pagesExpected, pagesFetched } = await scrape(config)`; update all downstream calls (`filter`, `buildHtml`) to use the destructured `products`; after the email send, call `await saveSnapshot({ products, pagesExpected, pagesFetched }, runId, startTime, config)` — for now, let errors propagate (US3 adds the catch); log the snapshot upload result

- [x] T009 [P] [US1] Update `.env.example` — add the following new variables with comments: `S3_BUCKET` (required, your bucket name), `S3_REGION` (optional, default `us-east-1`), `AWS_ACCESS_KEY_ID` (required), `AWS_SECRET_ACCESS_KEY` (required), `TIMEZONE` (optional, e.g. `America/Denver`, default UTC)

- [x] T010 [P] [US1] Update `.github/workflows/daily-scrape.yml` — add four new `env` entries under the `npm start` step: `S3_BUCKET: ${{ secrets.S3_BUCKET }}`, `S3_REGION: us-east-1`, `AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}`, `AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}`, `TIMEZONE: America/Denver` (or leave as a secret `${{ secrets.TIMEZONE }}` for flexibility)

**Checkpoint**: `npm run typecheck` passes. With valid AWS credentials in `.env`, run `npm run dev` and verify a file appears at `s3://{bucket}/runs/YYYY-MM-DD.json`. Download and confirm product count ≥ filtered count and all schema fields are present. This satisfies US1 acceptance scenarios 1, 2, and 3.

---

## Phase 4: User Story 2 — Query Historical Data (Priority: P2)

**Goal**: Snapshot files are discoverable by date using the consistent `runs/YYYY-MM-DD.json` key pattern, without a separate index.

**Independent Test**: quickstart.md Test 1 — list bucket contents (`aws s3 ls s3://{bucket}/runs/`) and confirm files are named `YYYY-MM-DD.json`. Download any file and confirm the schema supports trend queries (e.g., filter by brand, compare prices across dates).

> **Note**: US2 has no new implementation tasks. The `runs/YYYY-MM-DD.json` key pattern established in T007 and the JSON schema defined in [contracts/snapshot-schema.md](./contracts/snapshot-schema.md) fully satisfy FR-007, SC-003, and SC-005. US2 is delivered as a direct consequence of US1.

- [x] T011 [US2] Verify US2 acceptance criteria are met by US1 output — run `aws s3 ls s3://{bucket}/runs/` and confirm files follow `YYYY-MM-DD.json` pattern; download today's file and confirm it is parseable as the schema in [contracts/snapshot-schema.md](./contracts/snapshot-schema.md) and would answer the query "was strain X available on date Y?" without a separate index

**Checkpoint**: US2 is fully satisfied by Phase 3. No code changes required for this story.

---

## Phase 5: User Story 3 — Failure Does Not Block Email (Priority: P3)

**Goal**: If the S3 upload fails for any reason (invalid credentials, network error, timeout), the email is still delivered and the process exits cleanly. Upload failures are logged but do not crash the process.

**Independent Test**: quickstart.md Test 4 — set `AWS_ACCESS_KEY_ID=INVALID`, run `npm run dev`, confirm email arrives and log shows an upload error, process exits 0.

### Implementation for User Story 3

- [x] T012 [US3] Add 30-second `AbortController` timeout to `saveSnapshot` in `src/store.ts` — wrap the `client.send(new PutObjectCommand(...))` call with an `AbortController`; set `setTimeout(() => controller.abort(), 30_000)` before the call; pass `{ abortSignal: controller.signal }` as the second argument to `client.send()`; always `clearTimeout` in a `finally` block; do this for both the first attempt and the retry

- [x] T013 [US3] Add one full re-upload retry to `saveSnapshot` in `src/store.ts` — catch errors from the first `client.send()` attempt; log a warning including the error message; create a fresh `AbortController` and retry the full `PutObjectCommand` once; if the retry also fails or times out, log an error (`[STORAGE ERROR] Upload failed after retry: {message} — snapshot not saved for {date}`) and return without throwing; the function signature remains `Promise<void>` and MUST NOT throw

- [x] T014 [US3] Update `src/index.ts` — restructure the email + snapshot control flow so that: (a) the email send is wrapped in `try/catch` — on email failure, log the error and continue (do not re-throw for EXIT_3); (b) `saveSnapshot` is called unconditionally after the email attempt, in its own `try/catch` — since `saveSnapshot` already never throws (T013), this catch is a safety net only; (c) the process still exits 0 when email fails but upload succeeds, and exits 0 when upload fails but email succeeds — adjust exit codes only when BOTH fail or when the scrape itself fails. Preserve existing EXIT_1 (site unreachable) and EXIT_2 behavior for scrape failures.

**Checkpoint**: With `AWS_ACCESS_KEY_ID=INVALID` in `.env`, run `npm run dev`. Confirm: email is sent, log shows two upload attempts with error messages, process exits 0. This satisfies US3 acceptance scenarios 1 and 2.

---

## Phase 6: Polish & E2E Validation

**Purpose**: Cross-cutting validation across all user stories.

- [x] T015 Run `npm run typecheck` — confirm zero TypeScript errors across all modified files (`types.ts`, `config.ts`, `scraper.ts`, `filter.ts`, `mailer.ts`, `store.ts`, `index.ts`)

- [ ] T016 [P] Run E2E quickstart.md Test 2 (timezone date) — set `TIMEZONE=America/Denver`, verify snapshot is keyed to Denver date

- [ ] T017 [P] Run E2E quickstart.md Test 3 (UTC default + warning) — remove `TIMEZONE`, verify log warns about UTC default and file is keyed to UTC date

- [ ] T018 Run E2E quickstart.md Test 5 (zero products) — verify empty snapshot (`products: []`) is still uploaded and schema is valid

- [ ] T019 Run E2E quickstart.md Test 6 (overwrite) — run twice on the same day, verify `runId` differs and second file replaces first

- [ ] T020 Trigger GitHub Actions `workflow_dispatch` and verify file appears in S3 (quickstart.md Test 7)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — install immediately
- **Foundational (Phase 2)**: Requires T001; BLOCKS all user story phases — changes are interdependent
- **US1 (Phase 3)**: Requires all of Phase 2 complete; T009 and T010 are [P] with each other and with T007/T008
- **US2 (Phase 4)**: Requires Phase 3 complete; no code changes, validation only
- **US3 (Phase 5)**: Requires T007 (store.ts exists) and T008 (index.ts wired); T012 and T013 are sequential (same file); T014 modifies index.ts (same file as T008, must complete after T008)
- **Polish (Phase 6)**: Requires all US phases complete; T016/T017/T018/T019 are [P] with each other

### User Story Dependencies

- **US1 (P1)**: Depends on Phase 2 only — this is the MVP
- **US2 (P2)**: Fully delivered by US1 — no additional dependencies
- **US3 (P3)**: Depends on T007 and T008 from US1 (store.ts and index.ts must exist first)

### Within Foundational Phase (Phase 2)

- T002 (`types.ts`) MUST complete first — all other foundational tasks depend on the new types
- T003 (`config.ts`), T004 (`scraper.ts`), T005 (`filter.ts`), T006 (`mailer.ts`) each depend on T002 but are independent of each other [P] relative to each other

### Parallel Opportunities

```
# Phase 2: After T002 completes, these can run simultaneously:
T003 (config.ts) || T004 (scraper.ts) || T005 (filter.ts) || T006 (mailer.ts)

# Phase 3: After T007 and T008, these can run simultaneously:
T009 (.env.example) || T010 (workflow yml)

# Phase 6: All E2E tests after T015 typecheck:
T016 (timezone) || T017 (UTC default) || T018 (zero products) || T019 (overwrite)
```

---

## Implementation Strategy

### MVP (User Story 1 Only)

1. Complete Phase 1: Install dependency
2. Complete Phase 2: Foundational types + data pipeline (T002–T006, parallelizing after T002)
3. Complete Phase 3: US1 implementation (T007–T010)
4. **STOP and VALIDATE**: Run `npm run dev` with real AWS credentials, confirm file in S3
5. This alone satisfies the core user need — full menu saved daily to S3

### Incremental Delivery

1. Phase 1 + 2 → Type-safe foundation ready
2. Phase 3 (US1) → Files appear in S3 after each run (MVP!)
3. Phase 4 (US2) → Validated automatically — no new code
4. Phase 5 (US3) → Upload failures no longer risk breaking email delivery
5. Phase 6 → Full E2E validation complete

### Sequential Execution (Single Developer)

```
T001 → T002 → [T003, T004, T005, T006] → T007 → T008 → [T009, T010]
     → validate US1 (quickstart Test 1)
     → T011 (validate US2)
     → T012 → T013 → T014
     → validate US3 (quickstart Test 4)
     → T015 → [T016, T017, T018, T019] → T020
```

---

## Notes

- Constitution Principle IV (Simplicity): Do not add abstractions beyond what each task specifies. `store.ts` is a single file with two exported functions.
- Constitution Principle I (Security): `logStorageConfig` MUST NOT log `awsAccessKeyId` or `awsSecretAccessKey`. Log only bucket, region, timezone, and date.
- Constitution Code Standards: All async operations use `async/await`. All log lines include ISO timestamp via `log()` from `./logger.js`.
- `priceCurrency` is always `"USD"` — hardcode via `PRICE_CURRENCY` constant in `scraper.ts`, never read from the API.
- The `ScrapeResult` interface in `types.ts` is unused — delete it in T002 without replacement.
- Commit after each phase checkpoint, not after each individual task.
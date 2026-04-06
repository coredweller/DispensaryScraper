# Feature Specification: Daily Full-Menu Snapshot to Cloud Storage

**Feature Branch**: `003-s3-daily-snapshot`
**Created**: 2026-03-29
**Status**: Draft
**Input**: User description: "As a user I want to save all of the products each day, not just the filtered brands in a JSON format. After it sends the email it will send this JSON file to S3 so I can query it in the future."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Full Menu Captured Daily (Priority: P1)

After each daily scrape completes and the email is sent, the system automatically saves every product from the full dispensary menu — not limited to the configured brand filter — as a structured data file and uploads it to cloud storage. The user never has to take any manual action.

**Why this priority**: This is the core value — capturing complete daily menu data is the entire purpose of the feature. Without it, nothing else matters.

**Independent Test**: Can be fully tested by running the scraper end-to-end and verifying a file appears in cloud storage containing products from brands outside the current filter.

**Acceptance Scenarios**:

1. **Given** the scraper completes a run with 50 total products (10 matching the brand filter, 40 others), **When** the daily run finishes, **Then** the uploaded file contains all 50 products, not just the 10 filtered ones.
2. **Given** the email has been sent successfully, **When** the upload step runs, **Then** a file for today's date appears in cloud storage within 30 seconds.
3. **Given** the upload completes, **When** the user inspects the file, **Then** each product record contains: date, brand, strain name, strain type, THC percentage, weight, and price.

---

### User Story 2 - Query Historical Data (Priority: P2)

The user can retrieve and query past daily snapshots from cloud storage to answer trend questions such as which strains appeared or disappeared, how prices changed, and which brands were available on a given date.

**Why this priority**: The primary motivation for storing data is future queryability. Each additional day of stored snapshots increases the value of the archive.

**Independent Test**: Can be fully tested by downloading a previously uploaded file and confirming it contains enough structured data to answer a trend question (e.g., "was strain X available on date Y?").

**Acceptance Scenarios**:

1. **Given** 30 days of snapshots exist in cloud storage, **When** the user downloads a specific date's file, **Then** the file contains a complete, valid product list for that date.
2. **Given** the files are stored in a consistent, predictable structure, **When** the user lists available snapshots, **Then** files are discoverable by date without knowing specific file names in advance.

---

### User Story 3 - Failure Does Not Block Email (Priority: P3)

If the cloud upload fails for any reason (network issue, credential problem, storage unavailable), the email is still delivered and the scraper run is still considered successful. The upload failure is logged but does not prevent the primary workflow.

**Why this priority**: The email notification is the existing core feature. The upload is additive and must not degrade the existing experience.

**Independent Test**: Can be fully tested by simulating an upload failure (e.g., invalid credentials) and confirming the email is still sent and the process exits cleanly.

**Acceptance Scenarios**:

1. **Given** cloud storage credentials are misconfigured, **When** the daily run executes, **Then** the email is sent successfully and the upload failure is recorded in the log.
2. **Given** a transient network error occurs during upload, **When** the error is caught, **Then** the process does not crash and exits with the same success code as a run without an upload.

---

### Edge Cases

- What happens when the scraper returns zero products? The upload should still occur with an empty products array and a zero product count — preserving the run record for that date.
- What happens if a file already exists for today's date? The new file overwrites the previous one, so the most recent run is always the authoritative record for that date.
- What happens if the upload takes longer than expected? The upload must complete before the process exits. If the upload exceeds 30 seconds, the system retries once as a full re-upload. If the retry also exceeds 30 seconds or fails, the failure is logged and the process exits cleanly. At no point should a partial file be visible to readers — the storage layer must guarantee atomic replacement.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST capture all products returned by the scraper each run, regardless of which brands are configured in the filter.
- **FR-002**: The system MUST structure the captured data as a single file per day, keyed by the scrape date. The timezone used to determine the calendar date MUST be configurable via environment variable (e.g., `TIMEZONE=America/Denver`). If the variable is absent, the system MUST default to UTC and log a warning indicating which timezone is in use, so the behavior is always explicit and traceable.
- **FR-003**: Each product record MUST include: brand, strain name, strain type (if available), THC percentage as a numeric value (e.g., `18.5`, if available), weight option, and price stored as three fields — amount in the smallest currency unit (e.g., `3500`), decimal precision (e.g., `2`), and currency code (e.g., `"USD"`) — sufficient to reconstruct any display format without storing a pre-formatted string.
- **FR-004**: The file MUST also include run-level metadata: a unique run identifier (generated fresh each execution), the scrape date, the start time in ISO 8601 UTC format (e.g., `2026-03-29T15:00:01.234Z`), the total product count, the number of pages expected, and the number of pages successfully fetched. A consumer can determine completeness by comparing the page counts, and can distinguish re-runs on the same date by comparing run identifiers.
- **FR-005**: The system MUST upload the file to cloud storage after scraping completes, regardless of whether the email step succeeded or failed.
- **FR-006**: If the upload fails or exceeds 30 seconds, the system MUST automatically retry once as a full re-upload (not a resumable continuation). If the retry also fails or times out, the system MUST log the failure and continue without crashing or affecting email delivery. The storage target MUST guarantee atomic object replacement — a reader must never observe a partial or intermediate file state during an overwrite.
- **FR-007**: Files MUST be stored under a consistent, date-based path so they are discoverable without a separate index.
- **FR-008**: The upload destination name, region, and timezone used for date calculation MUST be configurable via environment variables without code changes. The timezone defaults to UTC when not specified.
- **FR-009**: Access credentials for cloud storage MUST be supplied via environment variables and MUST NOT be hardcoded.
- **FR-010**: On startup, before any scraping begins, the system MUST log the active storage configuration: destination name, region, resolved timezone (including whether it defaulted to UTC), and the date the snapshot will be keyed to. Credentials MUST NOT appear in the log output.

### Key Entities

- **Scrape Run**: Represents one complete daily execution. Attributes: run identifier (unique per execution), date (in configured timezone), start time (ISO 8601 UTC), total product count, pages fetched, pages expected.
- **Product Record**: Represents a single menu item captured during a run. Attributes: brand, strain name, strain type, THC% (numeric float, e.g., `18.5`), weight option, price amount (integer, smallest currency unit, e.g., `3500`), price precision (integer, e.g., `2`), price currency (ISO 4217 code, e.g., `"USD"`).
- **Daily Snapshot File**: A single structured file grouping one run's metadata and all its product records, named and stored by date.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of daily runs result in a snapshot file appearing in cloud storage, assuming credentials are valid and storage is reachable.
- **SC-002**: Each snapshot file contains every product from the full menu — the product count in the file matches the total scrape count, not the filtered count.
- **SC-003**: A snapshot file for any given day can be retrieved by date within 60 seconds of the run completing.
- **SC-004**: An upload failure does not increase the email non-delivery rate — email success rate is unchanged from the current baseline.
- **SC-005**: Files stored over 365 days remain individually retrievable by date without requiring a separate catalog or index.

## Clarifications

### Session 2026-03-29

- Q: If the email step fails, should the snapshot still be uploaded? → A: Always upload after scraping completes, regardless of email outcome.
- Q: How should THC percentage be stored — numeric, display string, or both? → A: Numeric only (e.g., `18.5`); drop the display string.
- Q: Should there be a maximum wait time for the upload before abandoning? → A: 30-second timeout with one automatic retry; if retry also fails, log and exit cleanly.
- Q: Which timezone should determine the file's calendar date? → A: Configurable via environment variable (e.g., `TIMEZONE=America/Denver`).
- Q: Should the file include a completeness signal for partial scrapes? → A: Include `pagesFetched` and `pagesExpected` counts in run metadata.

## Assumptions

- The upload runs after scraping completes and is independent of email success or failure — a failed email does not prevent the snapshot from being stored.
- Cloud storage credentials will be configured by the user before the feature is deployed — the system does not provision storage automatically.
- One snapshot per calendar day is sufficient; if the scraper is run multiple times in a day, the later run's file replaces the earlier one.
- The full product list (all brands) is already available internally during each run; this feature exposes it to storage rather than requiring an additional scrape pass.
- Data retention and lifecycle policies for stored files are managed by the user directly in cloud storage — the scraper does not delete or archive old files.
- The scraper run is always triggered via the existing automated daily schedule; no on-demand or manual upload trigger is required.
- The scraper will return a richer `ScrapedProduct` type (extending the existing `Product` type) that carries raw numeric values — `thcValue` (float), `priceAmount` (integer), `pricePrecision` (integer), `priceCurrency` (ISO 4217) — alongside the existing display strings. The snapshot module reads the numeric fields directly without parsing display strings.
- `filter()` MUST accept and return `ScrapedProduct[]`, preserving all fields so downstream consumers receive the enriched type without a separate code path.
- The `scrape()` function will return a `ScrapeOutput` wrapper — `{ products: ScrapedProduct[], pagesExpected: number, pagesFetched: number }` — so pagination metadata is available to the snapshot module without a separate call. `pagesExpected` is the `totalPages` value from the Dutchie API response; `pagesFetched` is the count of distinct page indices for which at least one product was successfully retrieved, whether by interception or frame fetch.
- `priceCurrency` will be hardcoded to `"USD"` as a constant; the Dutchie API does not expose a currency field.
- `buildHtml()` MUST derive all price and THC display values from the numeric fields on `ScrapedProduct` (`priceAmount`, `pricePrecision`, `priceCurrency`, `thcValue`) rather than the existing display strings (`maxPrice`, `thcPercent`). This establishes the numeric fields as the single source of truth across both the email and snapshot outputs.
- The display string fields `maxPrice?: string` and `thcPercent?: string` on `Product` are candidates for removal in a future cleanup once all consumers derive values from the numeric fields. They MUST NOT be removed in this feature — only marked as deprecated internally.
# Research: Daily Full-Menu Snapshot to S3

**Phase 0 output for**: `003-s3-daily-snapshot`
**Date**: 2026-04-04

---

## Decision 1: S3 Upload Client

**Decision**: Use `@aws-sdk/client-s3` (AWS SDK v3) with `PutObjectCommand`.

**Rationale**: SDK v3 is tree-shakeable — importing only `@aws-sdk/client-s3` pulls in ~200KB, not the full SDK. `PutObjectCommand` performs an atomic single-part upload; S3 guarantees that a reader either sees the previous object or the new object, never a partial state. This satisfies FR-006's atomic replacement requirement without any extra configuration.

**Alternatives considered**:
- SDK v2 (`aws-sdk`): monolithic, larger install, deprecated for new projects.
- Direct S3 REST API via `https` module: avoids a dependency but requires manual request signing (SigV4) — significant complexity for no benefit.
- `@aws-sdk/lib-storage` (multipart): needed only for files >5MB; daily JSON snapshots will be <100KB.

---

## Decision 2: 30-Second Upload Timeout

**Decision**: Use `AbortController` + `AbortSignal` passed to `S3Client.send()`.

**Rationale**: The AWS SDK v3 `send()` method accepts an options object with a `signal` property. Pairing `AbortController` with `setTimeout` gives a clean, framework-agnostic timeout that works in Node.js v18+ without additional dependencies.

```ts
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 30_000);
try {
  await client.send(command, { abortSignal: controller.signal });
}
catch {
  //log
} 
finally {
  clearTimeout(timer);
}
```

**Alternatives considered**:
- `requestHandler` with `connectionTimeout`/`socketTimeout`: controls TCP-level timeouts only; doesn't bound total upload time.
- `Promise.race` with a rejection timeout: workable but leaks the upload promise; `AbortController` is the idiomatic approach.

---

## Decision 3: Unique Run ID

**Decision**: Use `crypto.randomUUID()` from Node.js built-ins.

**Rationale**: Node.js v14.17+ ships `crypto.randomUUID()` returning a standards-compliant UUID v4. No external dependency (`uuid` package) needed. Since the project targets Node.js v18+, this is available unconditionally.

**Alternatives considered**:
- `uuid` npm package: unnecessary dependency for a single function available in stdlib.
- Timestamp-based ID: not collision-safe if two runs start in the same millisecond (unlikely but not guaranteed).
- Incrementing counter: requires persistent state; overkill for this use case.

---

## Decision 4: Timezone-Aware Date Calculation

**Decision**: Use `Intl.DateTimeFormat` with the `timeZone` option to derive the calendar date in the configured timezone.

**Rationale**: `Intl.DateTimeFormat` is part of the ECMAScript internationalization spec and available in all Node.js v18+ environments without additional packages. It correctly handles DST transitions (e.g., America/Denver switches between UTC-7 and UTC-6).

```ts
function getDateInTimezone(tz: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find(p => p.type === 'year')!.value;
  const m = parts.find(p => p.type === 'month')!.value;
  const d = parts.find(p => p.type === 'day')!.value;
  return `${y}-${m}-${d}`;
}
```

`en-CA` locale produces ISO 8601 date format natively (YYYY-MM-DD).

**Alternatives considered**:
- `luxon` / `date-fns-tz`: correct but adds a dependency; `Intl` is sufficient.
- Slicing `new Date().toISOString()`: always UTC; ignores the configured timezone.

---

## Decision 5: Price Display in Email (buildHtml)

**Decision**: Derive price display string from `priceAmount`, `pricePrecision`, `priceCurrency` rather than `maxPrice` string field.

**Rationale**: The spec (Assumption 10) designates the numeric fields as the single source of truth. Building the display string in `buildHtml` from components avoids the divergence risk (e.g., `maxPrice` being `"$175.00"` while `priceAmount` is `17500`). The conversion is trivial:

```ts
function formatPrice(p: ScrapedProduct): string {
  if (p.priceAmount == null) return '—';
  const divisor = Math.pow(10, p.pricePrecision);
  const amount = (p.priceAmount / divisor).toFixed(p.pricePrecision);
  return p.priceCurrency === 'USD' ? `$${amount}` : `${amount} ${p.priceCurrency}`;
}
```

**Alternatives considered**:
- Keep using `p.maxPrice` string: creates two sources of truth that can drift; rejected per spec.
- Store a pre-formatted display string in `ScrapedProduct`: redundant; the spec explicitly prohibits it.

---

## Decision 6: Retry Strategy

**Decision**: On timeout or error, wait 10ms and retry once as a full re-upload (new `PutObjectCommand`). If retry also fails, log and continue.

**Rationale**: S3 `PutObject` is idempotent — uploading the same key twice is safe. The spec says "full re-upload (not a resumable continuation)". Zero delay between attempts is acceptable since a timeout indicates a network stall, not server overload; a brief retry is appropriate. If we wanted backoff we would, but the spec doesn't require it and constitution principle IV (simplicity) favors the simpler approach.

**Alternatives considered**:
- Exponential backoff: unnecessary for a single retry; adds complexity.
- Resumable upload via multipart: only useful for large files; our payloads are <100KB.

---

## Decision 7: Startup Configuration Logging (FR-010)

**Decision**: Log config at the top of `store.ts`'s `saveSnapshot` function, before any scraping begins, by calling it from `index.ts` as a separate `logStorageConfig(config)` call during startup.

**Rationale**: FR-010 requires logging before scraping begins. The cleanest approach is a dedicated `logStorageConfig()` export from `store.ts` that logs: bucket, region, timezone (with "defaulted to UTC" note if applicable), and date the snapshot will be keyed to. This keeps the logging co-located with the storage module.

**Implementation**:
```ts
export function logStorageConfig(config: AppConfig): void {
  const tz = config.timezone;
  const tzNote = tz === 'UTC' ? ' (defaulted — set TIMEZONE env var to override)' : '';
  const date = getDateInTimezone(tz);
  log(`[STORAGE] Bucket: ${config.s3Bucket} | Region: ${config.s3Region} | Timezone: ${tz}${tzNote} | Snapshot date: ${date}`);
}
```

---

## Decision 8: priceCurrency Constant

**Decision**: Hardcode `priceCurrency` as `"USD"` in `scraper.ts`'s `toProduct()` function.

**Rationale**: The Dutchie API does not expose a currency field. All products are in USD. The spec assumption explicitly states `priceCurrency` will be hardcoded to `"USD"`. Define it as a named constant at the top of `scraper.ts`:

```ts
const PRICE_CURRENCY = 'USD';
const PRICE_PRECISION = 2;
```

This satisfies constitution principle III (constants at top of module, not inlined in logic).
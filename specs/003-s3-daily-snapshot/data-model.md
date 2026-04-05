# Data Model: Daily Full-Menu Snapshot to S3

**Phase 1 output for**: `003-s3-daily-snapshot`
**Date**: 2026-04-04

---

## TypeScript Type Changes

### `src/types.ts`

**New types** (to be added):

```ts
/**
 * Enriched product type returned by scraper.ts.
 * Extends Product with numeric fields that are the single source of truth
 * for price and THC. Display string fields (maxPrice, thcPercent) on the
 * base Product type are deprecated — derive display values from these fields.
 */
export interface ScrapedProduct extends Product {
  /** Numeric THC percentage, e.g. 18.5. Undefined if not available. */
  thcValue?: number;
  /** Price in smallest currency unit (cents for USD), e.g. 3500 = $35.00. Undefined if not available. */
  priceAmount?: number;
  /** Decimal precision for priceAmount, e.g. 2 for USD. Always 2. */
  pricePrecision: number;
  /** ISO 4217 currency code. Always "USD". */
  priceCurrency: string;
}

/**
 * Return type of scraper.ts scrape() function.
 * Carries all products plus pagination metadata needed by the snapshot module.
 */
export interface ScrapeOutput {
  products: ScrapedProduct[];
  /** Total pages reported by the Dutchie API (totalPages from queryInfo). */
  pagesExpected: number;
  /** Count of distinct page indices for which at least one product was retrieved. */
  pagesFetched: number;
}
```

**Modified types**:

```ts
// AppConfig — add storage configuration fields
export interface AppConfig {
  // ... existing fields ...
  s3Bucket: string;
  s3Region: string;
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  /** IANA timezone name, e.g. "America/Denver". Defaults to "UTC". */
  timezone: string;
}
```

**Deprecated fields on `Product`** (MUST NOT be removed in this feature — only annotated):

```ts
export interface Product {
  strainName: string;
  brand: string;
  strainType?: string;
  /** @deprecated Derive display value from ScrapedProduct.thcValue instead. */
  thcPercent?: string;
  maxWeight?: string;
  /** @deprecated Derive display value from ScrapedProduct.priceAmount/pricePrecision/priceCurrency instead. */
  maxPrice?: string;
}
```

**Remove** (dead type, superseded by ScrapeOutput):

```ts
// DELETE ScrapeResult — no longer used
export interface ScrapeResult { ... }
```

---

## S3 Snapshot File Structure

**S3 key pattern**: `runs/YYYY-MM-DD.json`

**Example path**: `s3://dispensary-scraper-data/runs/2026-04-04.json`

### JSON Schema

```json
{
  "runId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "date": "2026-04-04",
  "startTime": "2026-04-04T15:00:01.234Z",
  "productCount": 47,
  "pagesExpected": 1,
  "pagesFetched": 1,
  "products": [
    {
      "brand": "Viola",
      "strainName": "Slurty 3",
      "strainType": "Hybrid",
      "thcValue": 22.4,
      "maxWeight": "1oz",
      "priceAmount": 17500,
      "pricePrecision": 2,
      "priceCurrency": "USD"
    },
    {
      "brand": "Mountain Select",
      "strainName": "Blue Dream",
      "strainType": null,
      "thcValue": null,
      "maxWeight": "3.5g",
      "priceAmount": 3500,
      "pricePrecision": 2,
      "priceCurrency": "USD"
    }
  ]
}
```

### Field Definitions

**Run-level fields**:

| Field | Type | Description |
|-------|------|-------------|
| `runId` | string (UUID v4) | Unique identifier generated fresh each execution via `crypto.randomUUID()` |
| `date` | string (YYYY-MM-DD) | Calendar date in configured timezone |
| `startTime` | string (ISO 8601 UTC) | UTC timestamp when the run began, from `new Date().toISOString()` |
| `productCount` | integer | Total products in this snapshot (equals `products.length`) |
| `pagesExpected` | integer | `totalPages` from Dutchie API `queryInfo` |
| `pagesFetched` | integer | Count of distinct page indices with ≥1 product retrieved |

**Product-level fields**:

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `brand` | string | No | Brand name from Dutchie API |
| `strainName` | string | No | Strain name from Dutchie API |
| `strainType` | string\|null | Yes | Indica/Sativa/Hybrid/etc.; null if absent or "N/A" |
| `thcValue` | number\|null | Yes | Numeric THC percentage (e.g., `22.4`); null if not available |
| `maxWeight` | string\|null | Yes | Largest available weight option (e.g., `"1oz"`); null if absent |
| `priceAmount` | integer\|null | Yes | Price in cents for `maxWeight` (e.g., `17500` = $175.00); null if absent |
| `pricePrecision` | integer | No | Decimal places (always `2` for USD) |
| `priceCurrency` | string | No | ISO 4217 code (always `"USD"`) |

---

## Entity Relationships

```
ScrapeOutput (returned by scraper.ts)
  └── products: ScrapedProduct[]    ← all products, full menu
  └── pagesExpected: number
  └── pagesFetched: number

index.ts
  ├── filter(output.products, brands) → ScrapedProduct[] (filtered, for email)
  ├── buildHtml(filtered, date)        → HTML string (email body)
  └── saveSnapshot(output, runId, startTime, config) → S3 file

DailySnapshotFile (written to S3)
  ├── run metadata (runId, date, startTime, productCount, pagesExpected, pagesFetched)
  └── products: ProductRecord[]  ← serialized from ScrapedProduct[]
```

---

## State Transitions: Upload Flow

```
scrape() returns ScrapeOutput
  ↓
[email: try send, log outcome, do not throw on failure]
  ↓
saveSnapshot() called unconditionally
  ↓
  ├── attempt 1: PutObjectCommand (30s timeout)
  │     ├── success → log "uploaded to s3://..."
  │     └── timeout/error → log warn, attempt retry
  │           ├── attempt 2: PutObjectCommand (30s timeout)
  │           │     ├── success → log "uploaded to s3://..."
  │           │     └── timeout/error → log error "upload failed after retry" → return (no throw)
  └── process exits 0 regardless of upload outcome
```
# Data Model: Dispensary Menu Scraper & Email Notifier

**Branch**: `002-dispensary-scraper` | **Date**: 2026-03-28

---

## Entities

### Product

Represents a single strain listing extracted from the Flower category page.

| Field | Type | Required | Constraints | Notes |
|-------|------|----------|-------------|-------|
| `strainName` | string | Yes | Non-empty | Raw text from product card name element |
| `brand` | string | Yes | Non-empty | Raw text from brand label element |
| `strainType` | string | No | — | e.g., "Indica", "Sativa", "Hybrid" |
| `thcPercent` | string | No | — | e.g., "22.5%" — stored as string to preserve formatting |
| `maxWeight` | string | No | — | Largest available weight option, e.g., "7g" |
| `maxPrice` | string | No | — | Price corresponding to maxWeight, e.g., "$75.00" |

**Identity**: No persistent ID; products are transient per-run. Uniqueness within a run is `brand + strainName`.

**State**: Products have no lifecycle state — they are extracted, filtered, and discarded after email delivery.

---

### ScrapeResult

Represents the complete output of one scraper run, passed from scraper → filter → mailer.

| Field | Type | Required | Constraints | Notes |
|-------|------|----------|-------------|-------|
| `timestamp` | string (ISO-8601) | Yes | — | Set at the start of the run |
| `products` | Product[] | Yes | May be empty array | All products extracted before filtering |
| `filteredProducts` | Product[] | Yes | May be empty array | Products after brand filter applied |
| `errors` | string[] | Yes | May be empty array | Human-readable error messages encountered during the run |
| `exitCode` | number | Yes | 0, 1, 2, or 3 | Final exit code; set by orchestrator on completion |

---

### EmailNotification

Represents the outbound email message built from a ScrapeResult.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `subject` | string | Yes | Format: `"Krystal Leaves Flower Menu — Viola & 710 Labs — {YYYY-MM-DD}"` |
| `htmlBody` | string | Yes | Brand-grouped HTML table, or "no results" message |
| `to` | string | Yes | From `RECIPIENT_EMAIL` env var |
| `from` | string | Yes | From `GMAIL_USER` env var |

---

### SelectorConfig

External configuration loaded from `selectors.json`. Maps logical element names to CSS selectors. Updating this file restores functionality after DOM structure changes without code edits.

| Key | Purpose | Example Value |
|-----|---------|---------------|
| `iframeContainer` | Detects embedded menu iframe | `"iframe[src*='dutchie']"` |
| `flowerCategoryLink` | Primary selector for Flower nav link | `"a[data-menu-type='flower']"` |
| `flowerCategoryLinkFallback` | Text-based fallback | `"a"` (matched by innerText "Flower") |
| `productCard` | Individual product card wrapper | `".product-card"` |
| `brandLabel` | Brand name within a card | `".product-card .brand-name"` |
| `strainName` | Strain name within a card | `".product-card .strain-name"` |
| `strainType` | Strain type within a card | `".product-card .strain-type"` |
| `thcPercent` | THC percentage within a card | `".product-card .thc-value"` |
| `weightPriceTier` | Weight/price tier elements within a card | `".product-card .weight-price"` |

---

### AppConfig

Runtime configuration assembled from environment variables at startup.

| Field | Source | Required | Notes |
|-------|--------|----------|-------|
| `targetUrl` | `TARGET_URL` env var | Yes | Defaults to `https://www.krystaleaves.com/menu` |
| `brands` | `BRANDS` env var | Yes | Comma-separated, e.g., `"Viola,710 Labs"` |
| `gmailUser` | `GMAIL_USER` env var | Yes | Sender Gmail address |
| `gmailPass` | `GMAIL_PASS` env var | Yes | 16-char App Password |
| `recipientEmail` | `RECIPIENT_EMAIL` env var | Yes | Email address to send results to |
| `headless` | `HEADLESS` env var | No | `"true"` or `"false"`, defaults to `"true"` |
| `debugScreenshotPath` | `DEBUG_SCREENSHOT_PATH` env var | No | Defaults to `"screenshots/debug.png"` |

---

## Relationships

```
AppConfig ──loads──► SelectorConfig (from selectors.json)
Scraper ──produces──► ScrapeResult { products: Product[] }
Filter ──consumes──► ScrapeResult.products → populates ScrapeResult.filteredProducts
Mailer ──consumes──► ScrapeResult → builds EmailNotification → sends
Logger ──observes──► all stages → writes to logs/YYYY-MM-DD.log
```

---

## Validation Rules

- `Product.strainName` and `Product.brand` must be non-empty strings; cards missing either field are skipped with a warning logged.
- `AppConfig` fields `gmailUser`, `gmailPass`, `recipientEmail`, and `brands` must be non-empty at startup; missing values cause an immediate exit with code 1 and a descriptive error message.
- Brand filter matching: lowercase + trim both sides before comparison. Normalize `"710labs"` → `"710 labs"` before comparison.

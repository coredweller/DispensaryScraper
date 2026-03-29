# CLI Contract: Dispensary Menu Scraper

**Branch**: `002-dispensary-scraper` | **Date**: 2026-03-28

This document defines the complete interface contract for the CLI tool. Any change to invocation, environment variables, exit codes, or output format is a breaking change requiring a version bump.

---

## Invocation

```
node src/index.js
```

No positional arguments. All configuration is via environment variables (see below).

---

## Environment Variables

All variables are loaded from `.env` in the project root (via dotenv). Variables marked **Required** cause exit code 1 if absent or empty.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TARGET_URL` | No | `https://www.krystaleaves.com/menu` | Full URL of the dispensary menu page |
| `BRANDS` | Yes | — | Comma-separated brand names to filter for, e.g., `Viola,710 Labs` |
| `GMAIL_USER` | Yes | — | Gmail address used as SMTP sender |
| `GMAIL_PASS` | Yes | — | 16-character Gmail App Password |
| `RECIPIENT_EMAIL` | Yes | — | Email address to receive the report |
| `HEADLESS` | No | `true` | Set to `false` to watch the browser during development |
| `DEBUG_SCREENSHOT_PATH` | No | `screenshots/debug.png` | Path where failure screenshots are saved |

---

## Exit Codes

| Code | Meaning | When Triggered |
|------|---------|----------------|
| `0` | Success | Pipeline completed; email sent (even if no matching strains found) |
| `1` | Configuration or network error | Missing required env vars, or target site unreachable after 3 retries |
| `2` | Navigation error | Flower category link not found within timeout; debug screenshot saved |
| `3` | Email delivery error | SMTP authentication failure or send failure after 1 retry |

---

## Standard Output

All output is written to both `stdout` and `logs/YYYY-MM-DD.log`. Each line is prefixed with an ISO-8601 timestamp.

**Successful run example**:
```
[2026-03-28T14:00:01.000Z] Starting scraper — target: https://www.krystaleaves.com/menu
[2026-03-28T14:00:05.000Z] Flower category loaded — 42 products found
[2026-03-28T14:00:05.100Z] Filter applied — 5 matching products (Viola: 3, 710 Labs: 2)
[2026-03-28T14:00:07.000Z] Email sent to dan@example.com
[2026-03-28T14:00:07.100Z] Done — exit code 0
```

**No results example**:
```
[2026-03-28T14:00:05.200Z] Filter applied — 0 matching products
[2026-03-28T14:00:07.000Z] No-results email sent to dan@example.com
[2026-03-28T14:00:07.100Z] Done — exit code 0
```

**Error example**:
```
[2026-03-28T14:00:05.000Z] ERROR: Flower category link not found after 15s
[2026-03-28T14:00:05.010Z] Debug screenshot saved to screenshots/debug.png
[2026-03-28T14:00:05.020Z] Done — exit code 2
```

---

## Email Output Contract

**Subject format**: `Krystal Leaves Flower Menu — Viola & 710 Labs — YYYY-MM-DD`

**Body (results found)**: HTML email with one table per brand. Table columns:

| Column | Source Field |
|--------|-------------|
| Strain | `strainName` |
| Type | `strainType` (or "—" if unavailable) |
| THC% | `thcPercent` (or "—" if unavailable) |
| Weight | `maxWeight` (or "—" if unavailable) |
| Price | `maxPrice` (or "—" if unavailable) |

**Body (no results)**: Plain paragraph: `"No Viola or 710 Labs flower strains are currently listed on the Krystal Leaves menu as of YYYY-MM-DD."`

---

## File System Side Effects

| Path | Created When | Contents |
|------|-------------|----------|
| `logs/YYYY-MM-DD.log` | Every run | Full stdout/stderr log for that day (append mode) |
| `screenshots/debug.png` | On navigation failure | Screenshot of browser state at time of failure |

---

## Selector Config Contract (`selectors.json`)

The file must be a valid JSON object with the following required keys. Missing keys cause exit code 1 at startup.

```json
{
  "iframeContainer": "<CSS selector or null>",
  "flowerCategoryLink": "<CSS selector>",
  "flowerCategoryLinkFallback": "<CSS selector for text-match fallback>",
  "productCard": "<CSS selector>",
  "brandLabel": "<CSS selector, relative to productCard>",
  "strainName": "<CSS selector, relative to productCard>",
  "strainType": "<CSS selector, relative to productCard>",
  "thcPercent": "<CSS selector, relative to productCard>",
  "weightPriceTier": "<CSS selector, relative to productCard>"
}
```

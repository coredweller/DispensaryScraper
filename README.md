# Dispensary Scraper

Scrapes the [Krystal Leaves](https://www.krystaleaves.com/menu) dispensary menu via the Dutchie GraphQL API, filters for Viola and 710 Labs flower strains, and emails the results.

## How it works

The menu is served inside a Dutchie embedded iframe protected by Cloudflare. Rather than scraping DOM elements, the scraper:

1. Loads `krystaleaves.com` in a headless browser to establish a real browser session
2. Intercepts the `FilteredProducts` GraphQL API responses Dutchie makes naturally during page load
3. For any pages not captured by interception, fetches them directly from within the Dutchie frame context (same-origin, so CORS is not an issue)

No CSS selectors are needed.

## Prerequisites

- Node.js v18 or higher
- A Gmail account with 2-Step Verification enabled
- A Gmail App Password (16 characters) — [generate one here](https://myaccount.google.com/apppasswords)

## Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd dispensary-scraper
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in your credentials:

| Variable | Required | Description |
|----------|----------|-------------|
| `GMAIL_USER` | Yes | Your Gmail address (sender) |
| `GMAIL_PASS` | Yes | Your 16-character Gmail App Password |
| `RECIPIENT_EMAIL` | Yes | Email address to receive the report |
| `BRANDS` | No | Comma-separated brand names (default: `Viola,710 Labs`) |
| `TARGET_URL` | No | Menu URL (default: Krystal Leaves menu) |
| `HEADLESS` | No | Set to `false` to watch the browser (default: `true`) |
| `DEBUG_SCREENSHOT_PATH` | No | Screenshot path on failure (default: `screenshots/debug.png`) |

### 3. Verify setup

```bash
npm run typecheck   # TypeScript type-check — must have zero errors
npm test            # Run unit tests — all must pass
```

## Running

**Development (no compile step):**

```bash
npm run dev
```

**Production (compiled):**

```bash
npm run build   # Compile TypeScript to dist/
npm start       # Run compiled output
```

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success — email sent |
| `1` | Config or network error — check `.env` and internet connection |
| `2` | Scraping error — no products found |
| `3` | Email delivery error — check Gmail credentials |

## Scheduling

### Linux / macOS (cron)

Run daily at 8 AM:

```cron
0 8 * * * cd /path/to/dispensary-scraper && node dist/index.js >> logs/cron.log 2>&1
```

To edit your crontab: `crontab -e`

### Windows Task Scheduler

1. Open **Task Scheduler** (search in Start menu)
2. Click **Create Basic Task**
3. Set trigger: **Daily** at your preferred time
4. Set action: **Start a program**
   - Program: `node`
   - Arguments: `dist/index.js`
   - Start in: `C:\path\to\dispensary-scraper`
5. Click **Finish**

> Tip: Build first with `npm run build` so `dist/index.js` exists before scheduling.

## Logs

Each run appends to `logs/YYYY-MM-DD.log`. Example:

```
[2026-03-29T14:09:19.530Z] Navigating to https://www.krystaleaves.com/menu (attempt 1/3)
[2026-03-29T14:09:23.614Z] Menu page loaded (networkidle2 reached)
[2026-03-29T14:09:27.354Z] Intercepted Flower page 0: 25 products (totalPages: 3)
[2026-03-29T14:09:27.649Z] Fetching Flower page 1 via Dutchie frame
[2026-03-29T14:09:27.703Z] Extraction complete — 30 valid products
[2026-03-29T14:09:28.408Z] Browser closed
```

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| Exit code 1: missing env vars | `.env` not configured | Fill in `GMAIL_USER`, `GMAIL_PASS`, and `RECIPIENT_EMAIL` |
| Exit code 1: no products found | Dutchie API changed or site unreachable | Check `screenshots/debug.png`; the APQ hash in `src/scraper.ts` may need updating |
| Exit code 3: SMTP auth failure | Wrong App Password | Generate a new App Password at myaccount.google.com/apppasswords |
| Empty email | `BRANDS` doesn't match | Brand matching is case-insensitive; `710labs` and `710 Labs` both work |
| Screenshot saved to `screenshots/debug.png` | Navigation failed | Open screenshot to see browser state at time of failure |

### If the Dutchie API stops working

The scraper uses an APQ (Automatic Persisted Query) hash. If Dutchie updates their API, you may need to update `DUTCHIE_APQ_HASH` in [src/scraper.ts](src/scraper.ts):

1. Open Chrome DevTools on `https://www.krystaleaves.com/menu`
2. Go to the **Network** tab and filter by `FilteredProducts`
3. Find a `api-0/graphql` request and copy the `sha256Hash` from the `extensions` query parameter
4. Update `DUTCHIE_APQ_HASH` in `src/scraper.ts`

# Dispensary Scraper

Scrapes the [Krystal Leaves](https://www.krystaleaves.com/menu) dispensary menu, filters for Viola and 710 Labs flower strains, and emails the results.

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

Edit `.env` and fill in all required values:

| Variable | Required | Description |
|----------|----------|-------------|
| `BRANDS` | Yes | Comma-separated brand names, e.g. `Viola,710 Labs` |
| `GMAIL_USER` | Yes | Your Gmail address (sender) |
| `GMAIL_PASS` | Yes | Your 16-character Gmail App Password |
| `RECIPIENT_EMAIL` | Yes | Email address to receive the report |
| `TARGET_URL` | No | Menu URL (defaults to Krystal Leaves menu) |
| `HEADLESS` | No | Set to `false` to watch the browser (default: `true`) |
| `DEBUG_SCREENSHOT_PATH` | No | Screenshot path on failure (default: `screenshots/debug.png`) |

### 3. Populate selectors

Open `selectors.json` and fill in the CSS selectors for the menu page. To inspect them visually:

```bash
HEADLESS=false npm run dev
```

Watch the browser navigate the menu and use DevTools to find the correct selectors. See [Selector Inspection Guide](#selector-inspection-guide) below.

### 4. Verify setup

```bash
npm run typecheck   # TypeScript type-check — must have zero errors
npm test            # Run unit tests — all must pass
```

## Running

**Development (no compile step):**

```bash
npm run dev
# or: npx tsx src/index.ts
```

**Production (compiled):**

```bash
npm run build        # Compile TypeScript to dist/
npm start            # Run compiled output
# or: node dist/index.js
```

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success — email sent |
| `1` | Config or network error — check `.env` and internet connection |
| `2` | Navigation error — Flower category not found; check `selectors.json` |
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

Each run appends to `logs/YYYY-MM-DD.log`. Example output:

```
[2026-03-28T14:00:01.000Z] Starting scraper — target: https://www.krystaleaves.com/menu
[2026-03-28T14:00:05.000Z] Flower category loaded — 42 products found
[2026-03-28T14:00:05.100Z] Filter applied — 5 matching products (Viola: 3, 710 Labs: 2)
[2026-03-28T14:00:07.000Z] Email sent to you@example.com
[2026-03-28T14:00:07.100Z] Done — 6.1s — exit code 0
```

## Selector Inspection Guide

If the menu structure changes and the scraper stops finding products, update `selectors.json`:

1. Set `HEADLESS=false` in `.env`
2. Run `npm run dev`
3. When the browser opens, press F12 to open DevTools
4. Use the element picker to find selectors for:
   - The embedded iframe (if the menu is in an iframe)
   - The "Flower" category link
   - Individual product card wrappers
   - Brand name, strain name, type, THC%, and weight/price elements within a card
5. Update `selectors.json` with the new values
6. Re-run to verify

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| Exit code 1: missing env vars | `.env` not configured | Copy `.env.example` → `.env` and fill in all values |
| Exit code 2: Flower link not found | Selectors outdated | Inspect menu with `HEADLESS=false` and update `selectors.json` |
| Exit code 3: SMTP auth failure | Wrong App Password | Generate a new App Password at myaccount.google.com/apppasswords |
| No products extracted | `productCard` selector wrong | Update `productCard` selector in `selectors.json` |
| Empty email received | `BRANDS` doesn't match | Check brand names match exactly (case-insensitive); `710labs` is auto-normalized |
| Screenshot saved to `screenshots/debug.png` | Navigation failed | Open screenshot to see browser state at time of failure |

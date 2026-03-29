# Quickstart: Dispensary Menu Scraper & Email Notifier

**Branch**: `002-dispensary-scraper` | **Date**: 2026-03-28

---

## Prerequisites

- Node.js v18 or higher (`node --version`)
- A Gmail account with 2-Step Verification enabled
- A Gmail App Password (16 characters, no spaces)
  - Generate at: Google Account → Security → 2-Step Verification → App Passwords

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy the example config and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env`:

```env
TARGET_URL=https://www.krystaleaves.com/menu
BRANDS=Viola,710 Labs
GMAIL_USER=your-email@gmail.com
GMAIL_PASS=xxxx xxxx xxxx xxxx
RECIPIENT_EMAIL=your-email@gmail.com
HEADLESS=true
```

### 3. Verify selectors

The file `selectors.json` in the project root contains the CSS selectors used to find elements on the Krystal Leaves menu. The initial values are pre-configured. If the site changes its layout, update this file without touching source code.

---

## Running

```bash
node src/index.js
```

The script will:
1. Launch a headless browser and navigate to the menu
2. Click the Flower category
3. Extract all Viola and 710 Labs strains
4. Send an HTML email to your configured recipient
5. Write a log to `logs/YYYY-MM-DD.log`

**Exit codes**: `0` = success, `1` = config/network error, `2` = navigation error, `3` = email error

---

## Development Mode (Visible Browser)

Set `HEADLESS=false` in `.env` to watch the browser while it runs — useful for debugging selector issues.

---

## Running Tests

```bash
npm test
```

Tests use Node's built-in test runner (`node:test`) — no additional dependencies needed.

---

## Scheduling Automated Runs

### Linux / macOS (cron)

Open your crontab:

```bash
crontab -e
```

Add a daily 8am run:

```
0 8 * * * cd /path/to/DispensaryScraper && node src/index.js >> logs/cron.log 2>&1
```

### Windows (Task Scheduler)

1. Open Task Scheduler → Create Basic Task
2. Set trigger: Daily at your preferred time
3. Set action: Start a program
   - Program: `node`
   - Arguments: `src/index.js`
   - Start in: `C:\path\to\DispensaryScraper`

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Exit code 1, "missing env var" | `.env` not configured | Check all required fields in `.env` |
| Exit code 2, screenshot saved | Flower link selector changed | Update `selectors.json` |
| Exit code 3, SMTP error | Wrong App Password | Regenerate App Password in Google Account |
| Email contains no products | Brands not on menu today | Check site manually; normal if out of stock |
| Browser hangs on iframe | Iframe selector wrong | Set `HEADLESS=false`, inspect, update `selectors.json` |

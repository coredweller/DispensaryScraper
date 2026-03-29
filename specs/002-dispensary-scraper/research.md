# Research: Dispensary Menu Scraper & Email Notifier

**Branch**: `002-dispensary-scraper` | **Date**: 2026-03-28
**Phase**: 0 — Pre-design research

---

## 1. Browser Automation: Puppeteer Iframe Handling

**Decision**: Detect iframes with `page.waitForSelector('iframe[src]')`, then switch context using `iframeHandle.contentFrame()`.

**Rationale**: Embedded dispensary menus (Dutchie, Jane, Meadow) are served inside cross-origin iframes. Puppeteer's `contentFrame()` is the canonical way to switch execution context into an iframe. Waiting for the selector before switching prevents race conditions on slow-loading embeds.

**Pattern**:
1. Attempt to find a known iframe selector (from `selectors.json`).
2. If found, call `iframeHandle.contentFrame()` and use the returned frame as the operating context.
3. If not found within timeout, fall back to operating on the top-level page.

**Alternatives considered**:
- `page.frames()` array iteration — works but requires matching by URL/name, which is brittle when the provider URL changes.
- Direct DOM access across origin — blocked by browser security; not viable.

---

## 2. Browser Automation: Lazy-Load Scroll Pattern

**Decision**: Use a bounded scroll loop — scroll one viewport at a time via `page.evaluate(() => window.scrollBy(0, window.innerHeight))`, compare product card counts before and after, exit when count stabilizes or max iterations (5) reached.

**Rationale**: JS-driven lazy loading (common on modern POS-embedded menus) requires simulated scroll events. Counting product cards as the exit condition is more reliable than fixed delays or page height comparison, since height may include footer elements.

**Pattern**:
1. Count current product cards.
2. Scroll one viewport.
3. Wait 1.5s for network/render.
4. Count again — if equal, exit loop; else continue up to max iterations.

**Alternatives considered**:
- Fixed sleep after scroll — unreliable on variable network conditions.
- Infinite scroll detection by page height — can be fooled by sticky footers or background elements.

---

## 3. Email: Nodemailer + Gmail SMTP App Password

**Decision**: Use Nodemailer with Gmail SMTP on port 587 (STARTTLS), authenticating with a 16-character Gmail App Password stored in `.env`.

**Rationale**: Google deprecated "Less Secure Apps" access permanently in May 2022. App Passwords (generated under Google Account > Security > 2-Step Verification > App Passwords) are the correct non-OAuth2 path for programmatic Gmail sending. Port 587 with `secure: false` (STARTTLS upgrade) is more widely supported than port 465 (implicit TLS).

**Transporter config**:
```
host: "smtp.gmail.com"
port: 587
secure: false          // STARTTLS
auth.user: GMAIL_USER  // from .env
auth.pass: GMAIL_PASS  // 16-char App Password from .env
```

**Alternatives considered**:
- OAuth2 with refresh tokens — more secure for production multi-user apps; adds significant setup complexity inappropriate for a solo-user CLI tool.
- SendGrid/Mailgun — introduces external dependency and account; unnecessary for personal use.
- Port 465 (implicit SSL) — valid but slightly less compatible with some corporate networks.

---

## 4. Logging: Native fs Streams

**Decision**: Use Node's built-in `fs.createWriteStream()` with append mode to write a dated log file (`logs/YYYY-MM-DD.log`). Log all stdout/stderr to both console and file using a thin wrapper function.

**Rationale**: The project is a solo-developer CLI tool with no log aggregation, no log querying, and no multi-service tracing. Adding Winston or Pino would bring in dependencies and configuration overhead for zero functional gain. Native `fs` streams are zero-dependency, trivially understood, and produce human-readable output. ISO-8601 timestamps are prepended manually.

**Pattern**:
```
const logFile = fs.createWriteStream(`logs/${date}.log`, { flags: 'a' });
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  process.stdout.write(line);
  logFile.write(line);
}
```

**Alternatives considered**:
- Winston — appropriate for apps with multiple transports, log levels, and structured JSON; overkill here.
- Pino — fastest Node.js logger; best for high-throughput servers; JSON output requires a separate prettifier for human reading.
- Console redirect — redirecting `console.log` globally is fragile and makes testing harder.

---

## 5. Test Runner: Node.js Built-in `node:test`

**Decision**: Use Node.js v18+ built-in `node:test` with `node:assert` for all unit and integration tests. No Jest or external test framework.

**Rationale**: The project has simple, well-bounded test needs: unit tests for the filter function and email formatter, integration test for the scraper. Node's built-in runner (stable since Node 20, available in 18 as experimental) requires zero setup, has ~5× faster startup than Jest, supports native ESM, and keeps `package.json` dependencies minimal. The `node:test` TAP output is sufficient for solo development.

**Alternatives considered**:
- Jest — standard for React/frontend projects; adds babel/transform config overhead; recommended when snapshot testing or complex mocking is needed.
- Vitest — excellent if the project used Vite; unnecessary here.
- Mocha + Chai — older but stable; adds two packages where zero are needed.

---

## 6. Configuration Management

**Decision**: Use `dotenv` to load `.env` for secrets/credentials, and a plain `selectors.json` file for CSS selectors. Both are loaded once at startup via a `config.js` module.

**Rationale**: Secrets (email credentials, target URL, recipient address) must not be hardcoded. `dotenv` is the de-facto standard for Node.js CLI environment config. CSS selectors are externalized to `selectors.json` so the site's DOM structure can change without requiring a code edit — only the JSON file needs updating (SC-004).

**Alternatives considered**:
- YAML config — adds a parse dependency; JSON is natively supported by Node.
- Command-line arguments — less ergonomic for frequently-used values like credentials.
- Single `.env` for everything including selectors — selectors are not secrets and benefit from structured JSON format.

---

## Summary of Technology Decisions

| Concern | Decision | Key Reason |
|---------|----------|------------|
| Browser automation | Puppeteer | Spec requirement; headless Chromium |
| Iframe handling | `contentFrame()` | Standard Puppeteer pattern |
| Lazy-load scroll | Card-count loop (max 5) | Reliable exit condition |
| Email | Nodemailer + Gmail SMTP port 587 | App Password, no OAuth2 complexity |
| Logging | Native `fs` stream | Zero dependencies, solo tool |
| Testing | `node:test` | Zero dependencies, Node 18+ built-in |
| Config | dotenv + selectors.json | Secrets vs structure separation |

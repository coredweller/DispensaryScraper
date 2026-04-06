# DispensaryScraper Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-04-04

## Active Technologies
- TypeScript 5.5 / Node.js v18+ + puppeteer, nodemailer, dotenv, zod, @aws-sdk/client-s3 (003-s3-daily-snapshot)
- AWS S3 (003-s3-daily-snapshot)
- Node.js v18+ + Puppeteer (headless Chromium), Nodemailer (Gmail SMTP), dotenv (env config) (002-dispensary-scraper)

## Project Structure

```text
src/
tests/
```

## Commands

- `npm run dev` — run scraper via tsx (no build step)
- `npm run build` — compile TypeScript to `dist/`
- `npm start` — run compiled output
- `npm run typecheck` — type-check without emitting
- `npm test` — run unit tests (vitest)

## Code Style

TypeScript / Node.js v18+: `const` by default, `async/await` only (no `.then()` chains), template literals for interpolation, ISO timestamps in all log output via `log()` from `src/logger.ts`

## Recent Changes
- 003-s3-daily-snapshot: Added @aws-sdk/client-s3; ScrapedProduct type, ScrapeOutput wrapper, S3 snapshot upload with timezone-aware date keying
- 002-dispensary-scraper: Added Node.js v18+ + Puppeteer (headless Chromium), Nodemailer (Gmail SMTP), dotenv (env config)

<!-- MANUAL ADDITIONS START -->
## Agents

- **Node/Puppeteer work**: Always use the `.claude/agents/node-puppeteer.md` agent for any task involving Node.js, Puppeteer, Nodemailer, or JavaScript. This includes writing, editing, reviewing, or debugging any file in `src/` or `tests/`.
- **S3 / TypeScript types / AWS SDK work**: Use the `.claude/agents/typescript-expert.md` agent for `src/store.ts`, `src/types.ts`, or any task involving `@aws-sdk/client-s3`, type system changes, or generics.

## Skills

- **Node/Puppeteer skill**: Reference `.claude/skills/node-puppeteer/` for patterns, config, and review checklists when implementing or reviewing Node.js/Puppeteer code.
<!-- MANUAL ADDITIONS END -->

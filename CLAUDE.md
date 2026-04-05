# DispensaryScraper Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-04-04

## Active Technologies
- [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION] + [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION] (003-s3-daily-snapshot)
- [if applicable, e.g., PostgreSQL, CoreData, files or N/A] (003-s3-daily-snapshot)
- TypeScript 5.5 / Node.js v18+ + puppeteer, nodemailer, dotenv, zod, @aws-sdk/client-s3 (003-s3-daily-snapshot)
- AWS S3 (003-s3-daily-snapshot)

- Node.js v18+ + Puppeteer (headless Chromium), Nodemailer (Gmail SMTP), dotenv (env config) (002-dispensary-scraper)

## Project Structure

```text
src/
tests/
```

## Commands

# Add commands for Node.js v18+

## Code Style

Node.js v18+: Follow standard conventions

## Recent Changes
- 003-s3-daily-snapshot: Added TypeScript 5.5 / Node.js v18+ + puppeteer, nodemailer, dotenv, zod, @aws-sdk/client-s3
- 003-s3-daily-snapshot: Added [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION] + [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]

- 002-dispensary-scraper: Added Node.js v18+ + Puppeteer (headless Chromium), Nodemailer (Gmail SMTP), dotenv (env config)

<!-- MANUAL ADDITIONS START -->
## Agents

- **Node/Puppeteer work**: Always use the `.claude/agents/node-puppeteer.md` agent for any task involving Node.js, Puppeteer, Nodemailer, or JavaScript. This includes writing, editing, reviewing, or debugging any file in `src/` or `tests/`.

## Skills

- **Node/Puppeteer skill**: Reference `.claude/skills/node-puppeteer/` for patterns, config, and review checklists when implementing or reviewing Node.js/Puppeteer code.
<!-- MANUAL ADDITIONS END -->

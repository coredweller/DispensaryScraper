# Feature Specification: Dispensary Menu Scraper & Email Notifier

**Feature Branch**: `002-dispensary-scraper`
**Created**: 2026-03-28
**Status**: Draft
**Input**: User description: "Build an app that navigates to https://www.krystaleaves.com/menu, clicks the Flower category link, extracts strain listings from Viola and 710 Labs, and emails the results to me."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Scrape Flower Strains from Menu (Priority: P1)

As a user, I want the app to automatically navigate to the Krystal Leaves menu page, click into the Flower category, and extract all product listings so that I have structured data about what's currently available without manually browsing the site.

**Why this priority**: This is the core functionality. Without the scraper working correctly, nothing else in the pipeline matters. The entire app depends on being able to reach the page, handle its dynamic rendering, and pull structured product data from the DOM.

**Independent Test**: Can be fully tested by running the scraper module alone and logging extracted product data to the console. Delivers value by confirming the site is reachable, the Flower category is clickable, and product cards can be parsed.

**Acceptance Scenarios**:

1. **Given** the script is executed with a valid TARGET_URL and HEADLESS=false, **When** the browser launches and navigates to the menu page, **Then** the page fully renders (networkidle2) and the Flower category link is visible in the DOM.
2. **Given** the menu page has loaded, **When** the scraper clicks the Flower category link, **Then** the page transitions to show only Flower products and product card elements appear within 15 seconds.
3. **Given** the Flower page is loaded, **When** the menu is rendered inside an iframe from a third-party provider (Dutchie, Jane, etc.), **Then** the scraper detects the iframe, switches context into it, and operates on the correct frame.
4. **Given** the Flower page uses lazy-loading, **When** only a subset of products are initially rendered, **Then** the scraper scrolls to the bottom of the page (up to 5 iterations) and waits for all product cards to load before extracting data.
5. **Given** the Flower category link cannot be found within 15 seconds, **When** both the primary CSS selector and the text-based fallback fail, **Then** a debug screenshot is saved to /tmp/scrape-debug.png and the script exits with code 2.

---

### User Story 2 - Filter Results by Brand (Priority: P1)

As a user, I want the extracted product data filtered to only include strains from Viola and 710 Labs so that I only receive information about the brands I care about.

**Why this priority**: Also P1 because unfiltered results have no value to the user. The brand filter is what makes this tool useful rather than just a generic page dump. It must work hand-in-hand with the scraper.

**Independent Test**: Can be tested independently by feeding a mock array of product objects (mixed brands) into the filter function and verifying only Viola and 710 Labs items are returned.

**Acceptance Scenarios**:

1. **Given** a raw array of extracted products containing multiple brands, **When** the brand filter runs with BRANDS="Viola,710 Labs", **Then** only products whose brand matches "viola", "710 labs", or "710labs" (case-insensitive, trimmed) are returned.
2. **Given** a raw array of extracted products containing zero matches for the configured brands, **When** the brand filter runs, **Then** it returns an empty array without throwing an error.
3. **Given** extracted product data with inconsistent whitespace or casing in brand labels, **When** the filter normalizes and compares, **Then** matches are still correctly identified (e.g., " VIOLA " matches, "710 LABS" matches).

---

### User Story 3 - Email Results via Gmail (Priority: P2)

As a user, I want the filtered strain results emailed to me as a formatted HTML message so that I can check my inbox instead of running the script and reading terminal output.

**Why this priority**: P2 because the scraper and filter (P1) must produce valid data before there's anything worth emailing. However, email delivery is what makes this a complete, hands-off tool rather than a script that requires manual review.

**Independent Test**: Can be tested independently by calling the mailer module with a hardcoded HTML string and verifying the email arrives in the recipient inbox with correct subject, formatting, and sender.

**Acceptance Scenarios**:

1. **Given** the filtered results contain one or more strains, **When** the email is built and sent, **Then** the recipient receives an HTML email with strains grouped by brand in a table with columns: Strain, Type, THC%, Price, Weight. The subject line includes the current date.
2. **Given** the filtered results are empty (no matching brands found), **When** the email is built and sent, **Then** the recipient receives an email stating "No Viola or 710 Labs flower strains are currently listed on the Krystal Leaves menu."
3. **Given** valid Gmail credentials in .env, **When** transporter.verify() is called, **Then** it resolves successfully confirming SMTP authentication works.
4. **Given** invalid Gmail credentials, **When** the send function is called, **Then** it retries once after 5 seconds, logs the SMTP error with troubleshooting guidance, and exits with code 3.

---

### User Story 4 - Run as a Single CLI Command (Priority: P2)

As a user, I want to execute the entire scrape-filter-email pipeline with a single command (`node src/index.js`) so that I don't need to run multiple scripts or perform any manual steps.

**Why this priority**: P2 because it's the orchestration layer that ties the P1 and P2 components together. It doesn't add new functionality but makes the tool usable as a complete product.

**Independent Test**: Can be tested by running `node src/index.js` end-to-end and verifying the email arrives with correct data, the browser closes cleanly, and the process exits with code 0.

**Acceptance Scenarios**:

1. **Given** a correctly configured .env file, **When** the user runs `node src/index.js`, **Then** the script launches the browser, navigates to the menu, clicks Flower, extracts and filters products, sends the email, closes the browser, and exits with code 0.
2. **Given** the target site is unreachable, **When** the script runs, **Then** it retries up to 3 times with 10-second delays, logs the error, and exits with code 1.
3. **Given** the browser was launched, **When** any error occurs at any point in the pipeline, **Then** the browser is always closed in a finally block before the process exits.

---

### User Story 5 - Schedule Automated Runs (Priority: P3)

As a user, I want documentation on how to schedule the script via cron (Linux/Mac) or Task Scheduler (Windows) so that I can receive daily or weekly emails without manually running the command.

**Why this priority**: P3 because this is a convenience/documentation enhancement. The core tool is fully functional without scheduling — the user can always run it manually.

**Independent Test**: Can be tested by setting up a cron job with the documented command and verifying the email arrives at the scheduled time with correct data.

**Acceptance Scenarios**:

1. **Given** the README contains cron scheduling instructions, **When** a user copies the example cron entry and sets it up, **Then** the script executes at the scheduled time and sends the email without user intervention.

---

### Edge Cases

- What happens when the dispensary changes their menu provider (e.g., switches from Dutchie to Jane)? The selectors in selectors.json will need to be updated, but no source code changes should be required.
- How does the system handle the menu page being temporarily down for maintenance? Retries 3 times with 10-second delays, then exits with code 1 and a descriptive log message.
- What happens when the Flower category exists but contains zero products? The scraper returns an empty array, the filter returns an empty array, and the email is sent noting no products were found. Exit code 0.
- What happens when the site adds a CAPTCHA or anti-bot protection? The scraper will fail to navigate. A debug screenshot is captured showing the CAPTCHA, and the script exits with code 2. This would require manual intervention or a v2 solution.
- What happens when Gmail rate-limits or blocks the send? The mailer retries once after 5 seconds. If it still fails, exit code 3 with the SMTP error logged.
- What happens when the menu loads products via infinite scroll instead of pagination? The scroll-to-load handler (up to 5 iterations) accounts for this by scrolling and comparing card counts.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST launch a headless Chromium browser via Puppeteer and navigate to the configured TARGET_URL.
- **FR-002**: System MUST detect whether the menu is rendered inline or inside an iframe and switch context accordingly.
- **FR-003**: System MUST locate and click the Flower category link using a primary CSS selector from selectors.json, with a text-based innerText fallback if the primary selector fails.
- **FR-004**: System MUST handle lazy-loaded content by scrolling the page and waiting for all product cards to render before extraction.
- **FR-005**: System MUST extract structured data from each product card: strain name, brand, strain type, THC percentage, and the highest available weight/price tier. When multiple weight options exist, only the largest weight and its corresponding price are captured and displayed.
- **FR-006**: System MUST filter extracted products by brand using case-insensitive matching against the BRANDS environment variable.
- **FR-007**: System MUST send an HTML-formatted email via Gmail SMTP (Nodemailer + App Password) containing the filtered results grouped by brand.
- **FR-008**: System MUST send a "no results found" email when the filter returns zero matches, rather than sending nothing or throwing an error.
- **FR-009**: System MUST capture a debug screenshot on any navigation or selector failure.
- **FR-010**: System MUST exit with documented exit codes: 0 (success or empty-but-sent), 1 (site unreachable), 2 (Flower link not found), 3 (email failure).
- **FR-011**: System MUST close the browser in a finally block regardless of success or failure.
- **FR-012**: System MUST read all configuration from environment variables (.env) and selectors from an external JSON config file. No hardcoded credentials, URLs, selectors, or brand names in source code.
- **FR-013**: System MUST write a timestamped log file to `logs/YYYY-MM-DD.log` on each run, capturing all stdout/stderr output so that scheduled (unattended) runs produce a persistent audit trail without requiring shell redirection.

### Key Entities

- **Product**: A single item on the Flower menu page. Key attributes: strainName (string, required), brand (string, required), strainType (string, optional), thcPercent (string, optional), maxWeight (string, optional), maxPrice (string, optional) — representing the largest available weight option and its price. When only one tier exists, that tier is used.
- **SelectorConfig**: The externalized set of CSS selectors used to identify DOM elements. Stored in selectors.json. Keys include: menuContainer, flowerLink, productCard, brandLabel, strainName, strainType, thcPercent, price, weight.
- **EmailNotification**: The formatted HTML message sent to the recipient. Contains a subject line with the current date, a body with brand-grouped product tables (or a "no results" message), and a footer with the scrape timestamp.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A single run of `node src/index.js` completes the full scrape-filter-email pipeline and exits with code 0 within 60 seconds on a standard broadband connection.
- **SC-002**: When Viola or 710 Labs strains are on the menu, the email contains 100% of the matching products visible on the Flower page (no missed items due to lazy-loading or iframe issues).
- **SC-003**: When no matching strains are on the menu, the user still receives an email confirming that — no silent failures, no empty inbox.
- **SC-004**: When the target site changes its DOM structure, updating selectors.json (and nothing else) restores full functionality.
- **SC-005**: A new developer can clone the repo, follow the README, and have the script running within 15 minutes.
- **SC-006**: All four failure modes (site unreachable, Flower link missing, no products, email failure) produce the correct exit code, a useful log message, and a debug screenshot where applicable.

## Assumptions

- The user has Node.js v18+ installed locally.
- The user has a Gmail account with 2-Factor Authentication enabled and has generated a Gmail App Password.
- The Krystal Leaves menu page (https://www.krystaleaves.com/menu) is publicly accessible without login or authentication.
- The menu is rendered via a JavaScript-based embedded provider (e.g., Dutchie, Jane) requiring a headless browser — a simple HTTP fetch will not return product data.
- The Flower category exists as a clickable link or button on the menu page.
- Product cards on the Flower page contain identifiable brand labels that can be matched via CSS selectors.
- The user has a stable internet connection capable of loading a full Chromium browser session.
- Mobile support, a web UI, and persistent data storage are all out of scope for v1.
- Anti-bot protections (CAPTCHA, rate limiting) are not currently in place on the target site. If they are added, v2 work would be required.
- Log files accumulate in `logs/` indefinitely; cleanup/rotation is the user's responsibility for v1.

## Clarifications

### Session 2026-03-28

- Q: Should the app write a structured log file to disk on each run, or is it the user's responsibility to redirect stdout/stderr when setting up their cron job? → A: App writes a timestamped `logs/YYYY-MM-DD.log` file automatically on each run.
- Q: When a strain has multiple weight options at different prices, what should the app capture? → A: Capture only the highest weight/price tier per strain (largest weight and its corresponding price).

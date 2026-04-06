import { randomUUID } from 'node:crypto';
import { config } from './config.js';
import { log, closeLog } from './logger.js';
import { scrape } from './scraper.js';
import { filter } from './filter.js';
import { verify, send, buildHtml } from './mailer.js';
import { logStorageConfig, saveSnapshot } from './store.js';

async function main(): Promise<void> {
  const runId = randomUUID();
  const startTime = new Date().toISOString();
  const startMs = Date.now();
  const date = startTime.slice(0, 10);

  log(`Starting scraper — target: ${config.targetUrl}`);
  log(`Filtering for brands: ${config.brands}`);
  logStorageConfig(config);

  // Verify SMTP credentials before launching the browser
  log('Verifying SMTP credentials');
  await verify(config);
  log('SMTP credentials verified');

  // Scrape
  log('Launching browser and scraping menu');
  const { products, pagesExpected, pagesFetched } = await scrape(config);
  log(`Scrape complete — ${products.length} total products extracted (pages: ${pagesFetched}/${pagesExpected})`);

  // Filter
  const filteredProducts = filter(products, config.brands);
  if (filteredProducts.length === 0) {
    log('Filter applied — 0 matching products');
  } else {
    // Log per-brand counts
    const brandCounts = filteredProducts.reduce<Record<string, number>>((acc, p) => {
      acc[p.brand] = (acc[p.brand] ?? 0) + 1;
      return acc;
    }, {});
    const brandSummary = Object.entries(brandCounts)
      .map(([brand, count]) => `${brand}: ${count}`)
      .join(', ');
    log(`Filter applied — ${filteredProducts.length} matching products (${brandSummary})`);
  }

  // Build and send email
  const html = buildHtml(filteredProducts, date);
  try {
    await send(html, date, config);
    if (filteredProducts.length === 0) {
      log(`No-results email sent to ${config.recipientEmail}`);
    } else {
      log(`Email sent to ${config.recipientEmail}`);
    }
  } catch (emailErr) {
    const msg = emailErr instanceof Error ? emailErr.message : String(emailErr);
    log(`ERROR: Email send failed: ${msg}`);
  }

  // Upload snapshot unconditionally — failures are caught inside saveSnapshot
  await saveSnapshot({ products, pagesExpected, pagesFetched }, runId, startTime, config);

  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
  log(`Done — ${elapsed}s — exit code 0`);
}

main()
  .then(() => {
    closeLog();
    process.exit(0);
  })
  .catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    const code = (err as NodeJS.ErrnoException).code;

    if (code === 'EXIT_2') {
      log(`ERROR: ${msg}`);
      log('Done — exit code 2');
      closeLog();
      process.exit(2);
    } else if (code === 'EXIT_3') {
      log(`ERROR: ${msg}`);
      log('Done — exit code 3');
      closeLog();
      process.exit(3);
    } else {
      log(`ERROR: ${msg}`);
      log('Done — exit code 1');
      closeLog();
      process.exit(1);
    }
  });

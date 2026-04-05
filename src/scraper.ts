/**
 * Scraper for the Krystal Leaves dispensary menu.
 *
 * Architecture note: The menu is served via a Dutchie embedded menu (dutchie.com/embedded-menu/krystaleaves1/)
 * nested inside a Wix iframe. Dutchie's iframe is protected by Cloudflare and cannot be DOM-scraped.
 *
 * Strategy:
 * 1. Load krystaleaves.com in Puppeteer to establish a real browser session.
 * 2. Intercept the Dutchie GraphQL (api-0/graphql) FilteredProducts responses that the page makes
 *    naturally. We poll until data arrives (up to INTERCEPT_TIMEOUT_MS after networkidle2).
 * 3. For any pages not captured by interception, make APQ GET requests from the Dutchie frame —
 *    dutchie.com is same-origin in that context, so CORS is not a problem.
 */
import puppeteer, { type Browser, type Frame, type Page } from 'puppeteer';
import { log } from './logger.js';
import type { AppConfig, ScrapedProduct, ScrapeOutput } from './types.js';

// Dutchie dispensary identifier for Krystal Leaves
const DUTCHIE_DISPENSARY_ID = '608716726125d300c8c7d9ac';

// APQ (Automatic Persisted Query) hash for the FilteredProducts operation
const DUTCHIE_APQ_HASH = '98b4aaef79a84ae804b64d550f98dd64d7ba0aa6d836eb6b5d4b2ae815c95e32';

const DUTCHIE_API = 'https://dutchie.com/api-0/graphql';
const PER_PAGE = 50;
const PRICE_CURRENCY = 'USD';
const PRICE_PRECISION = 2;
const RETRY_LIMIT = 3;
const RETRY_DELAY_MS = 10_000;

// How long to poll for intercepted Flower data after page load (ms)
const INTERCEPT_TIMEOUT_MS = 25_000;
const INTERCEPT_POLL_MS = 500;

/** Weight options sorted ascending by grams for finding max weight. */
const WEIGHT_TO_GRAMS: Record<string, number> = {
  '0.5g': 0.5,
  '1g': 1,
  '2g': 2,
  '3.5g': 3.5,
  '1/8oz': 3.5,
  '7g': 7,
  '1/4oz': 7,
  '14g': 14,
  '1/2oz': 14,
  '28g': 28,
  '1oz': 28,
};

function weightToGrams(option: string): number {
  const normalized = option.toLowerCase().trim();
  if (WEIGHT_TO_GRAMS[normalized] !== undefined) return WEIGHT_TO_GRAMS[normalized];
  const gramMatch = normalized.match(/^(\d+(?:\.\d+)?)g$/);
  if (gramMatch) return parseFloat(gramMatch[1]);
  const ozMatch = normalized.match(/^(\d+)\/(\d+)oz$/);
  if (ozMatch) return (parseInt(ozMatch[1]) / parseInt(ozMatch[2])) * 28.35;
  return -1;
}

interface DutchieProduct {
  _id: string;
  Name: string;
  brandName: string;
  strainType: string;
  THCContent?: { range?: number[]; unit?: string } | null;
  Options: string[];
  recPrices: number[];
  type: string;
}

interface DutchieResponse {
  data?: {
    filteredProducts?: {
      products: DutchieProduct[];
      queryInfo?: { totalCount: number | null; totalPages: number };
    };
  };
  errors?: Array<{ message: string }>;
}

/** Build the Dutchie API URL for a given page (APQ GET format). */
function buildDutchieUrl(pageNum: number, perPage: number): string {
  const variables = {
    includeEnterpriseSpecials: false,
    productsFilter: {
      dispensaryId: DUTCHIE_DISPENSARY_ID,
      pricingType: 'rec',
      strainTypes: [],
      subcategories: [],
      Status: 'Active',
      types: ['Flower'],
      useCache: true,
      isDefaultSort: true,
      sortBy: 'popularSortIdx',
      sortDirection: 1,
      bypassOnlineThresholds: false,
      isKioskMenu: false,
      removeProductsBelowOptionThresholds: true,
      platformType: 'ONLINE_MENU',
      preOrderType: null,
    },
    page: pageNum,
    perPage,
  };

  const extensions = {
    persistedQuery: { version: 1, sha256Hash: DUTCHIE_APQ_HASH },
  };

  const params = new URLSearchParams({
    operationName: 'FilteredProducts',
    variables: JSON.stringify(variables),
    extensions: JSON.stringify(extensions),
  });

  return `${DUTCHIE_API}?${params.toString()}`;
}

/** Convert a Dutchie product to our internal ScrapedProduct shape. */
function toProduct(raw: DutchieProduct): ScrapedProduct | null {
  const strainName = raw.Name?.trim();
  const brand = raw.brandName?.trim();
  if (!strainName || !brand) return null;

  const thcValue = raw.THCContent?.range?.[0];
  const thcValueNumeric = thcValue != null && thcValue > 0 ? thcValue : undefined;

  const strainType =
    raw.strainType && raw.strainType !== 'N/A' && raw.strainType !== 'null'
      ? raw.strainType
      : undefined;

  let maxGrams = -1;
  let maxWeight: string | undefined;
  let priceAmount: number | undefined;

  const options = raw.Options ?? [];
  const prices = raw.recPrices ?? [];

  for (let i = 0; i < options.length; i++) {
    const g = weightToGrams(options[i]);
    if (g > maxGrams) {
      maxGrams = g;
      maxWeight = options[i];
      priceAmount = prices[i] != null ? Math.round(prices[i] * Math.pow(10, PRICE_PRECISION)) : undefined;
    }
  }

  return {
    strainName,
    brand,
    strainType,
    maxWeight,
    thcValue: thcValueNumeric,
    priceAmount,
    pricePrecision: PRICE_PRECISION,
    priceCurrency: PRICE_CURRENCY,
  };
}

/**
 * Fetch one page of Flower products from the Dutchie frame using an APQ GET request.
 * The dutchie.com frame is same-origin with api-0/graphql, so CORS is not an issue.
 */
async function fetchPageFromFrame(frame: Frame, pageNum: number): Promise<{ products: DutchieProduct[]; totalPages: number }> {
  const url = buildDutchieUrl(pageNum, PER_PAGE);

  const result = await frame.evaluate(async (fetchUrl: string) => {
    const res = await fetch(fetchUrl, {
      method: 'GET',
      // Content-Type bypasses the CSRF check (non-simple header triggers preflight,
      // but same-origin requests in the dutchie.com frame don't need preflight)
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    });
    return { status: res.status, body: await res.text() };
  }, url);

  if (result.status !== 200) {
    throw new Error(`Dutchie API returned HTTP ${result.status}: ${result.body.slice(0, 200)}`);
  }

  let parsed: DutchieResponse;
  try {
    parsed = JSON.parse(result.body) as DutchieResponse;
  } catch {
    throw new Error(`Dutchie API returned non-JSON: ${result.body.slice(0, 200)}`);
  }

  if (parsed.errors?.length) {
    const msg = parsed.errors.map(e => e.message).join('; ');
    throw new Error(`Dutchie GraphQL errors on page ${pageNum}: ${msg}`);
  }

  const products = parsed.data?.filteredProducts?.products ?? [];
  const totalPages = parsed.data?.filteredProducts?.queryInfo?.totalPages ?? 1;
  return { products, totalPages };
}

/** Navigate to the dispensary page to establish a browser session. */
async function loadMenuPage(page: Page, config: AppConfig): Promise<void> {
  for (let attempt = 1; attempt <= RETRY_LIMIT; attempt++) {
    try {
      log(`Navigating to ${config.targetUrl} (attempt ${attempt}/${RETRY_LIMIT})`);
      const response = await page.goto(config.targetUrl, { waitUntil: 'networkidle2', timeout: 30_000 });
      if (!response?.ok()) {
        throw new Error(`HTTP ${response?.status() ?? 'unknown'} from ${config.targetUrl}`);
      }
      log('Menu page loaded (networkidle2 reached)');
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isNetworkError = msg.includes('net::ERR_') || msg.includes('TimeoutError') || msg.includes('timeout');
      if (attempt < RETRY_LIMIT && isNetworkError) {
        log(`Navigation failed (${msg}) — retrying in ${RETRY_DELAY_MS / 1000}s`);
        await new Promise<void>(r => setTimeout(r, RETRY_DELAY_MS));
      } else {
        await page.screenshot({ path: config.debugScreenshotPath, fullPage: true });
        log(`Debug screenshot saved to ${config.debugScreenshotPath}`);
        const error = new Error(`Site unreachable after ${RETRY_LIMIT} attempts: ${msg}`);
        (error as NodeJS.ErrnoException).code = 'EXIT_1';
        throw error;
      }
    }
  }
}

export async function scrape(config: AppConfig): Promise<ScrapeOutput> {
  let browser: Browser | null = null;

  try {
    log('Launching browser');
    browser = await puppeteer.launch({
      headless: config.headless,
      defaultViewport: { width: 1280, height: 800 },
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    );

    // Track all response Promises so we can await them after page load
    const responsePromises: Promise<void>[] = [];
    const interceptedPages = new Map<number, DutchieProduct[]>();
    let interceptedTotalPages = 1;

    page.on('response', (response) => {
      const url = response.url();
      if (!url.includes('api-0/graphql') || !url.includes('FilteredProducts')) return;

      const p = response.text().then((text) => {
        try {
          const parsed = JSON.parse(text) as DutchieResponse;
          const allProducts = parsed.data?.filteredProducts?.products ?? [];
          const flowerProducts = allProducts.filter(p => p.type === 'Flower');

          const tp = parsed.data?.filteredProducts?.queryInfo?.totalPages ?? 1;

          let pageNum = 0;
          try {
            const vars = JSON.parse(
              new URL(url).searchParams.get('variables') ?? '{}'
            ) as { page?: number };
            pageNum = vars.page ?? 0;
          } catch { /* default to 0 */ }

          if (flowerProducts.length > 0) {
            // Only update if this response has more products than what we already have.
            // Guards against "staff picks" or other partial queries overwriting the full Flower page
            // and polluting totalPages with an inflated value from a different query.
            const existing = interceptedPages.get(pageNum);
            if (!existing || flowerProducts.length > existing.length) {
              interceptedPages.set(pageNum, flowerProducts);
              // Use totalPages only from the response with the most products on this page
              if (!existing || flowerProducts.length > existing.length) {
                interceptedTotalPages = tp;
              }
              log(`Intercepted Flower page ${pageNum}: ${flowerProducts.length} products (totalPages: ${tp})`);
            } else {
              log(`Intercepted Flower page ${pageNum}: ${flowerProducts.length} products — keeping existing ${existing.length}`);
            }
          } else {
            log(`Intercepted FilteredProducts (${allProducts.length} total, 0 Flower)`);
          }
        } catch (e) {
          log(`WARN: Failed to parse intercepted Dutchie response: ${e instanceof Error ? e.message : String(e)}`);
        }
      }).catch((e) => {
        log(`WARN: Failed to read intercepted response body: ${e instanceof Error ? e.message : String(e)}`);
      });

      responsePromises.push(p);
    });

    await loadMenuPage(page, config);

    // Poll until Flower data arrives or timeout — the Dutchie embed initializes lazily
    // and makes its API calls well after networkidle2
    log(`Waiting for Dutchie Flower data (up to ${INTERCEPT_TIMEOUT_MS / 1000}s)...`);
    const deadline = Date.now() + INTERCEPT_TIMEOUT_MS;
    while (interceptedPages.size === 0 && Date.now() < deadline) {
      await new Promise<void>(r => setTimeout(r, INTERCEPT_POLL_MS));
    }

    // Flush any in-flight response.text() promises
    if (responsePromises.length > 0) {
      await Promise.all(responsePromises);
    }

    // Collect intercepted products in page order
    const allRaw: DutchieProduct[] = [];
    for (const [, products] of [...interceptedPages.entries()].sort(([a], [b]) => a - b)) {
      allRaw.push(...products);
    }

    log(`Intercepted ${interceptedPages.size}/${interceptedTotalPages} page(s) (${allRaw.length} Flower products)`);

    // For pages not captured by interception, fetch via the Dutchie frame (APQ GET, same-origin)
    if (interceptedPages.size < interceptedTotalPages || allRaw.length === 0) {
      const dutchieFrame = page.frames().find(f => f.url().includes('dutchie.com/embedded-menu'));

      if (dutchieFrame) {
        log(`Found Dutchie frame: ${dutchieFrame.url()}`);

        const pagesToFetch: number[] = [];
        if (allRaw.length === 0) {
          pagesToFetch.push(0);
        } else {
          for (let p = 0; p < interceptedTotalPages; p++) {
            if (!interceptedPages.has(p)) pagesToFetch.push(p);
          }
        }

        for (const pageNum of pagesToFetch) {
          try {
            log(`Fetching Flower page ${pageNum} via Dutchie frame`);
            const { products, totalPages: tp } = await fetchPageFromFrame(dutchieFrame, pageNum);

            if (products.length === 0) {
              log(`Page ${pageNum} returned 0 Flower products — stopping frame fetch`);
              break;
            }

            allRaw.push(...products);

            // Use totalPages from this response (it's authoritative for the Flower query)
            // Only expand the queue from page 0 since it's the first authoritative response
            if (pageNum === 0) {
              interceptedTotalPages = tp;
              for (let extra = 1; extra < tp; extra++) {
                if (!interceptedPages.has(extra) && !pagesToFetch.includes(extra)) {
                  pagesToFetch.push(extra);
                }
              }
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            log(`WARN: Could not fetch page ${pageNum} via Dutchie frame: ${msg}`);
          }
        }
      } else {
        log(`WARN: No Dutchie embedded-menu frame found — could not fetch missing pages`);
      }
    }

    if (allRaw.length === 0) {
      await page.screenshot({ path: config.debugScreenshotPath, fullPage: true });
      log(`Debug screenshot saved to ${config.debugScreenshotPath}`);
      const error = new Error('No Flower products found — the Dutchie menu may not have loaded');
      (error as NodeJS.ErrnoException).code = 'EXIT_1';
      throw error;
    }

    log(`Total raw Flower products: ${allRaw.length}`);

    const products: ScrapedProduct[] = [];
    for (const raw of allRaw) {
      const product = toProduct(raw);
      if (!product) {
        log(`WARN: Skipping product missing name or brand: ${raw.Name ?? '(no name)'}`);
        continue;
      }
      products.push(product);
    }

    const pagesFetched = interceptedPages.size > 0
      ? interceptedPages.size
      : allRaw.length > 0 ? 1 : 0;

    log(`Extraction complete — ${products.length} valid products`);
    return { products, pagesExpected: interceptedTotalPages, pagesFetched };
  } finally {
    if (browser) {
      await browser.close();
      log('Browser closed');
    }
  }
}

/**
 * Captures the exact FilteredProducts GET URL (with APQ hash) that returns Flower products,
 * then replays it from inside the browser.
 */
import puppeteer from 'puppeteer';
import { writeFileSync, mkdirSync } from 'fs';

const TARGET_URL = 'https://www.krystaleaves.com/menu';
const DISPENSARY_ID = '608716726125d300c8c7d9ac';

async function inspect() {
  mkdirSync('screenshots', { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: { width: 1280, height: 900 },
    args: ['--no-sandbox', '--disable-web-security'],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    );

    // Collect ALL full URLs from api-0/graphql FilteredProducts
    const capturedUrls: string[] = [];
    const capturedBodies: Array<{ url: string; body: string }> = [];

    page.on('request', req => {
      const url = req.url();
      if (url.includes('api-0/graphql') && url.includes('FilteredProducts')) {
        capturedUrls.push(url);
      }
    });

    page.on('response', async res => {
      const url = res.url();
      if (url.includes('api-0/graphql') && url.includes('FilteredProducts')) {
        try {
          const body = await res.text();
          capturedBodies.push({ url, body });
        } catch { /* ignore */ }
      }
    });

    console.log('Loading page...');
    await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 60_000 });
    await new Promise(r => setTimeout(r, 10000));
    console.log(`Captured ${capturedUrls.length} FilteredProducts URLs`);

    // Save all full URLs
    writeFileSync('screenshots/captured-urls.txt', capturedUrls.join('\n\n'));
    console.log('Saved captured URLs');

    // Find a request with actual flower products
    let flowerUrl = '';
    for (let i = 0; i < capturedBodies.length; i++) {
      const { url, body } = capturedBodies[i];
      writeFileSync(`screenshots/resp-${i}.json`, body);
      try {
        const json = JSON.parse(body);
        const products = json.data?.filteredProducts?.products ?? [];
        if (products.length > 0 && products.some((p: { type?: string }) => p.type === 'Flower')) {
          flowerUrl = url;
          console.log(`\nFound Flower products in response ${i}: ${products.length} products`);
          const flowerProducts = products.filter((p: { type?: string }) => p.type === 'Flower');
          console.log(`Flower-type: ${flowerProducts.length}`);
          for (const p of flowerProducts.slice(0, 3)) {
            console.log(`  ${p.brandName} | ${p.Name} | ${p.strainType} | ${p.Options} | $${p.recPrices}`);
          }
        }
      } catch { /* ignore */ }
    }

    if (!flowerUrl) {
      console.log('\nNo Flower products found in initial requests. Trying to navigate to Flower page...');
      // Try navigating to the Flower category URL directly
      const dutchieFlowerUrl = `https://dutchie.com/embedded-menu/krystaleaves1/flower`;
      await page.goto(dutchieFlowerUrl, { waitUntil: 'networkidle2', timeout: 30_000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 5000));
      console.log('Navigated to Dutchie Flower URL');
    }

    // Try making the request from within the browser context using the APQ approach
    // First, get the cookies from the current page context
    console.log('\nTrying in-browser GraphQL fetch with correct field args...');
    const result = await page.evaluate(async (dispensaryId: string) => {
      // Try using the flat argument structure (not wrapped in productsFilter object)
      const query = `
        query FilteredProducts($dispensaryId: String, $pricingType: String, $strainTypes: [String], $subcategories: [String], $Status: String, $types: [String], $useCache: Boolean, $isDefaultSort: Boolean, $sortDirection: Int, $bypassOnlineThresholds: Boolean, $isKioskMenu: Boolean, $removeProductsBelowOptionThresholds: Boolean, $platformType: String, $preOrderType: String, $page: Int, $perPage: Int, $includeEnterpriseSpecials: Boolean) {
          filteredProducts(dispensaryId: $dispensaryId, pricingType: $pricingType, strainTypes: $strainTypes, subcategories: $subcategories, Status: $Status, types: $types, useCache: $useCache, isDefaultSort: $isDefaultSort, sortDirection: $sortDirection, bypassOnlineThresholds: $bypassOnlineThresholds, isKioskMenu: $isKioskMenu, removeProductsBelowOptionThresholds: $removeProductsBelowOptionThresholds, platformType: $platformType, preOrderType: $preOrderType, page: $page, perPage: $perPage, includeEnterpriseSpecials: $includeEnterpriseSpecials) {
            products {
              _id
              Name
              brandName
              strainType
              THCContent { range unit }
              Options
              recPrices
              type
              subcategory
            }
            queryInfo { totalCount totalPages }
          }
        }`;

      const variables = {
        dispensaryId,
        pricingType: 'rec',
        Status: 'Active',
        types: ['Flower'],
        strainTypes: [],
        subcategories: [],
        useCache: true,
        isDefaultSort: true,
        sortDirection: 1,
        bypassOnlineThresholds: false,
        isKioskMenu: false,
        removeProductsBelowOptionThresholds: true,
        platformType: 'ONLINE_MENU',
        preOrderType: null,
        page: 0,
        perPage: 100,
        includeEnterpriseSpecials: false,
      };

      const res = await fetch('https://dutchie.com/api-0/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ query, variables }),
      });
      const text = await res.text();
      return { status: res.status, body: text.slice(0, 50000) };
    }, DISPENSARY_ID);

    console.log(`In-browser fetch status: ${result.status}`);
    if (result.body.startsWith('{')) {
      const json = JSON.parse(result.body);
      if (json.errors) {
        console.log('Errors:', JSON.stringify(json.errors));
        // Try to extract field info
      } else {
        const products = json.data?.filteredProducts?.products ?? [];
        console.log(`Products: ${products.length}`);
        writeFileSync('screenshots/flower-direct.json', JSON.stringify(products, null, 2));
        for (const p of products.slice(0, 3)) {
          console.log(`  ${p.brandName} | ${p.Name} | ${p.strainType}`);
        }
      }
    } else {
      console.log('Non-JSON:', result.body.slice(0, 300));
    }

    // Print the captured full URL for reference
    if (capturedUrls.length > 0) {
      console.log('\nFirst captured api-0 URL (first 300 chars):');
      console.log(capturedUrls[0].slice(0, 300));
    }

  } finally {
    await browser.close();
  }
}

inspect().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});

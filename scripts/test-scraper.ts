import { scrape } from '../src/scraper.js';
import type { AppConfig } from '../src/types.js';

const config: AppConfig = {
  targetUrl: 'https://www.krystaleaves.com/menu',
  brands: 'Viola,710 Labs',
  gmailUser: '', gmailPass: '', recipientEmail: '',
  headless: true,
  debugScreenshotPath: 'screenshots/debug.png',
  selectors: {
    iframeContainer: '', flowerCategoryLink: '', flowerCategoryLinkFallback: 'a',
    productCard: '', brandLabel: '', strainName: '', strainType: '', thcPercent: '', weightPriceTier: '',
  },
};

const products = await scrape(config);
console.log(`\nScraped ${products.length} flower products`);
const viola = products.filter(p => p.brand.toLowerCase().includes('viola'));
const labs = products.filter(p => p.brand.toLowerCase().replace('710labs', '710 labs').includes('710 labs'));
console.log(`Viola: ${viola.length}, 710 Labs: ${labs.length}`);
for (const p of [...viola, ...labs]) {
  console.log(`  [${p.brand}] ${p.strainName} | ${p.strainType ?? 'N/A'} | ${p.thcPercent ?? 'N/A'} | ${p.maxWeight ?? 'N/A'} | ${p.maxPrice ?? 'N/A'}`);
}

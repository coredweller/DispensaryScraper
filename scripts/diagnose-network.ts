import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1280, height: 800 },
});
const page = await browser.newPage();
await page.setUserAgent(
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
);

const captured: string[] = [];

page.on('response', (res) => {
  const url = res.url();
  if (url.includes('dutchie') || url.includes('graphql') || url.includes('api-0')) {
    captured.push(url.slice(0, 250));
  }
});

console.log('Loading page...');
await page.goto('https://www.krystaleaves.com/menu', { waitUntil: 'networkidle2', timeout: 30_000 });
console.log('networkidle2 reached. Waiting 12s...');
await new Promise(r => setTimeout(r, 12000));

console.log('\n=== Dutchie/GraphQL responses ===');
for (const u of captured) console.log(u);
console.log('Total captured:', captured.length);

console.log('\n=== Active frames ===');
for (const f of page.frames()) console.log(f.url().slice(0, 200));

await browser.close();

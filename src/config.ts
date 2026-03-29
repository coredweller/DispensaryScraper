import 'dotenv/config';
import { readFileSync } from 'fs';
import { z } from 'zod';
import type { AppConfig, SelectorConfig } from './types.js';

const envSchema = z.object({
  TARGET_URL: z.string().url().default('https://www.krystaleaves.com/menu'),
  BRANDS: z.string().min(1, 'BRANDS is required — comma-separated brand names, e.g., "Viola,710 Labs"'),
  GMAIL_USER: z.string().min(1, 'GMAIL_USER is required — your Gmail address'),
  GMAIL_PASS: z.string().min(1, 'GMAIL_PASS is required — your 16-character Gmail App Password'),
  RECIPIENT_EMAIL: z.string().email('RECIPIENT_EMAIL must be a valid email address'),
  HEADLESS: z.string().default('true'),
  DEBUG_SCREENSHOT_PATH: z.string().default('screenshots/debug.png'),
});

const selectorSchema = z.object({
  iframeContainer: z.string(),
  flowerCategoryLink: z.string(),
  flowerCategoryLinkFallback: z.string(),
  productCard: z.string(),
  brandLabel: z.string(),
  strainName: z.string(),
  strainType: z.string(),
  thcPercent: z.string(),
  weightPriceTier: z.string(),
});

function loadConfig(): AppConfig {
  let env: z.infer<typeof envSchema>;
  try {
    env = envSchema.parse(process.env);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const messages = err.errors.map(e => `  ${e.path.join('.')}: ${e.message}`).join('\n');
      console.error(`[CONFIG ERROR] Missing or invalid environment variables:\n${messages}`);
      console.error('Copy .env.example to .env and fill in all required values.');
    }
    process.exit(1);
  }

  let selectors: SelectorConfig;
  try {
    const raw = JSON.parse(readFileSync('selectors.json', 'utf-8')) as unknown;
    selectors = selectorSchema.parse(raw);
  } catch (err) {
    console.error('[CONFIG ERROR] Failed to load selectors.json:', err instanceof Error ? err.message : err);
    console.error('Ensure selectors.json exists at the project root with all required keys.');
    process.exit(1);
  }

  return {
    targetUrl: env.TARGET_URL,
    brands: env.BRANDS,
    gmailUser: env.GMAIL_USER,
    gmailPass: env.GMAIL_PASS,
    recipientEmail: env.RECIPIENT_EMAIL,
    headless: env.HEADLESS !== 'false',
    debugScreenshotPath: env.DEBUG_SCREENSHOT_PATH,
    selectors,
  };
}

export const config: AppConfig = loadConfig();

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
  S3_BUCKET: z.string()
    .min(3, 'S3_BUCKET must be at least 3 characters')
    .max(63, 'S3_BUCKET must be 63 characters or fewer')
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'S3_BUCKET must contain only lowercase letters, numbers, and hyphens, and must start/end with a letter or number'),
  S3_REGION: z.string().default('us-east-2'),
  TIMEZONE: z.string().default('UTC'),
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

  if (!process.env.TIMEZONE) {
    console.warn('[CONFIG WARN] TIMEZONE not set — defaulting to UTC. Set TIMEZONE=America/Denver (or your timezone) for date-accurate snapshots.');
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
    s3Bucket: env.S3_BUCKET,
    s3Region: env.S3_REGION,
    timezone: env.TIMEZONE,
  };
}

export const config: AppConfig = loadConfig();

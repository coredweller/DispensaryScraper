import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { log } from './logger.js';
import type { AppConfig, ScrapeOutput } from './types.js';

const UPLOAD_TIMEOUT_MS = 30_000;

/** Returns the calendar date (YYYY-MM-DD) in the given IANA timezone. */
function getDateInTimezone(tz: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find(p => p.type === 'year')!.value;
  const m = parts.find(p => p.type === 'month')!.value;
  const d = parts.find(p => p.type === 'day')!.value;
  return `${y}-${m}-${d}`;
}

/** Logs the active storage configuration on startup. Credentials are never logged. */
export function logStorageConfig(config: AppConfig): void {
  const tz = config.timezone;
  const tzNote = tz === 'UTC' ? ' (defaulted — set TIMEZONE env var to override)' : '';
  const date = getDateInTimezone(tz);
  log(`[STORAGE] Bucket: ${config.s3Bucket} | Region: ${config.s3Region} | Timezone: ${tz}${tzNote} | Snapshot date: ${date}`);
}

/** Performs a single PutObjectCommand with a 30-second AbortController timeout. */
async function attemptUpload(
  client: S3Client,
  bucket: string,
  key: string,
  body: string,
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: 'application/json',
      }),
      { abortSignal: controller.signal },
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Uploads a daily snapshot of all scraped products to S3.
 * Never throws — failures are logged and the function returns cleanly.
 */
export async function saveSnapshot(
  output: ScrapeOutput,
  runId: string,
  startTime: string,
  config: AppConfig,
): Promise<void> {
  const date = getDateInTimezone(config.timezone);
  const key = `runs/${date}.json`;

  const payload = JSON.stringify({
    runId,
    date,
    startTime,
    productCount: output.products.length,
    pagesExpected: output.pagesExpected,
    pagesFetched: output.pagesFetched,
    products: output.products.map(p => ({
      brand: p.brand,
      strainName: p.strainName,
      strainType: p.strainType ?? null,
      thcValue: p.thcValue ?? null,
      maxWeight: p.maxWeight ?? null,
      priceAmount: p.priceAmount ?? null,
      pricePrecision: p.pricePrecision,
      priceCurrency: p.priceCurrency,
    })),
  }, null, 2);

  const client = new S3Client({
    region: config.s3Region,
    credentials: {
      accessKeyId: config.awsAccessKeyId,
      secretAccessKey: config.awsSecretAccessKey,
    },
  });

  try {
    await attemptUpload(client, config.s3Bucket, key, payload);
    log(`[STORAGE] Snapshot uploaded to s3://${config.s3Bucket}/${key} (${output.products.length} products)`);
  } catch (firstErr) {
    const msg = firstErr instanceof Error ? firstErr.message : String(firstErr);
    log(`[STORAGE WARN] Upload attempt 1 failed: ${msg} — retrying`);

    try {
      await attemptUpload(client, config.s3Bucket, key, payload);
      log(`[STORAGE] Snapshot uploaded to s3://${config.s3Bucket}/${key} on retry (${output.products.length} products)`);
    } catch (secondErr) {
      const msg2 = secondErr instanceof Error ? secondErr.message : String(secondErr);
      log(`[STORAGE ERROR] Upload failed after retry: ${msg2} — snapshot not saved for ${date}`);
    }
  }
}
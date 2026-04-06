# Quickstart & Test Plan: Daily Full-Menu Snapshot to S3

**Feature**: `003-s3-daily-snapshot`
**Date**: 2026-04-04

---

## Prerequisites

1. **AWS account** with an S3 bucket created (e.g., `dispensary-scraper-data`)
2. **IAM user** with `s3:PutObject` permission on `arn:aws:s3:::dispensary-scraper-data/runs/*`
3. **Access key** generated for the IAM user

---

## Environment Setup

Add to your `.env`:

```env
S3_BUCKET=dispensary-scraper-data
S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIAxxxxxxxxxxxxxxxx
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TIMEZONE=America/Denver
```

---

## Manual E2E Test Plan (Constitution V)

### Test 1 — Happy Path (US-1, SC-001, SC-002)

1. Run `npm run dev` (or `npm run build && npm start`)
2. Observe startup log — confirm it includes:
   - `[STORAGE] Bucket: dispensary-scraper-data`
   - `[STORAGE] Region: us-east-1`
   - `[STORAGE] Timezone: America/Denver`
   - `[STORAGE] Snapshot date: YYYY-MM-DD`
3. Wait for run to complete
4. Download the file: `aws s3 cp s3://dispensary-scraper-data/runs/YYYY-MM-DD.json -`
5. Verify:
   - File is valid JSON
   - `productCount` equals `products.length`
   - Products include brands outside the configured filter (e.g., not just Viola/710 Labs)
   - Each product has `priceAmount`, `pricePrecision`, `priceCurrency` fields
   - `thcValue` is a number, not a string like `"22.4%"`
   - `runId` is a UUID v4
   - `startTime` ends in `Z` (UTC)

### Test 2 — Timezone Date Verification (FR-002, FR-008)

1. Set `TIMEZONE=America/Denver` in `.env`
2. Run at a time when Denver and UTC are on different calendar dates (after midnight UTC, before midnight Denver)
3. Verify the file is keyed to the Denver date, not the UTC date

### Test 3 — UTC Default + Warning (FR-002, FR-010)

1. Remove or unset `TIMEZONE` from `.env`
2. Run the scraper
3. Verify log includes a note that timezone defaulted to UTC (e.g., "defaulted — set TIMEZONE env var to override")
4. Verify file is keyed to today's UTC date

### Test 4 — Upload Failure Does Not Break Email (US-3, SC-004, FR-006)

1. Set `AWS_ACCESS_KEY_ID=INVALID` in `.env`
2. Run the scraper
3. Verify:
   - Email is still sent successfully
   - Log contains an upload error message (not a crash/stack trace)
   - Process exits with code 0

### Test 5 — Zero Products (Edge Case)

1. Set `BRANDS` to something that matches no products AND temporarily modify scraper to return empty
   (or test against a known-empty menu state)
2. Verify:
   - Upload still occurs with `productCount: 0` and `products: []`
   - File is valid JSON
   - Run-level metadata (`runId`, `startTime`, `pagesExpected`, `pagesFetched`) still present

### Test 6 — Overwrite (Edge Case)

1. Run the scraper twice on the same day
2. Verify the second run's file replaces the first (check `runId` changed)

### Test 7 — GitHub Actions (SC-001)

1. Add secrets to GitHub repo: `S3_BUCKET`, `S3_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `TIMEZONE`
2. Trigger `workflow_dispatch` from GitHub UI
3. Verify Actions run completes successfully
4. Verify file appears in S3 with today's date

---

## Headless Verification

After headed tests pass (Test 1), run once with `HEADLESS=true` (already default in GitHub Actions). This is satisfied by Test 7.
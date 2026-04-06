export interface Product {
  strainName: string;
  brand: string;
  strainType?: string;
  /** @deprecated Derive display value from ScrapedProduct.thcValue instead. */
  thcPercent?: string;
  maxWeight?: string;
  /** @deprecated Derive display value from ScrapedProduct.priceAmount/pricePrecision/priceCurrency instead. */
  maxPrice?: string;
}

/**
 * Enriched product type returned by scraper.ts.
 * Extends Product with numeric fields that are the single source of truth
 * for price and THC. Display string fields (maxPrice, thcPercent) on the
 * base Product type are deprecated — derive display values from these fields.
 */
export interface ScrapedProduct extends Product {
  /** Numeric THC percentage, e.g. 18.5. Undefined if not available. */
  thcValue?: number;
  /** Price in smallest currency unit (cents for USD), e.g. 3500 = $35.00. Undefined if not available. */
  priceAmount?: number;
  /** Decimal precision for priceAmount, e.g. 2 for USD. Always 2. */
  pricePrecision: number;
  /** ISO 4217 currency code. Always "USD". */
  priceCurrency: string;
}

/**
 * Return type of scraper.ts scrape() function.
 * Carries all products plus pagination metadata needed by the snapshot module.
 */
export interface ScrapeOutput {
  products: ScrapedProduct[];
  /** Total pages reported by the Dutchie API (totalPages from queryInfo). */
  pagesExpected: number;
  /** Count of distinct page indices for which at least one product was retrieved. */
  pagesFetched: number;
}

export interface EmailNotification {
  subject: string;
  htmlBody: string;
  to: string;
  from: string;
}

export interface SelectorConfig {
  iframeContainer: string;
  flowerCategoryLink: string;
  flowerCategoryLinkFallback: string;
  productCard: string;
  brandLabel: string;
  strainName: string;
  strainType: string;
  thcPercent: string;
  weightPriceTier: string;
}

export interface AppConfig {
  targetUrl: string;
  brands: string;
  gmailUser: string;
  gmailPass: string;
  recipientEmail: string;
  headless: boolean;
  debugScreenshotPath: string;
  selectors: SelectorConfig;
  s3Bucket: string;
  s3Region: string;
  /** IANA timezone name, e.g. "America/Denver". Defaults to "UTC". */
  timezone: string;
}
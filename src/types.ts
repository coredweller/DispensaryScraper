export interface Product {
  strainName: string;
  brand: string;
  strainType?: string;
  thcPercent?: string;
  maxWeight?: string;
  maxPrice?: string;
}

export interface ScrapeResult {
  timestamp: string;
  products: Product[];
  filteredProducts: Product[];
  errors: string[];
  exitCode: number;
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
}

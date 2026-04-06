import type { Product } from './types.js';

/**
 * Known brand name aliases: maps any recognized permutation to the canonical lowercase form.
 * Add new entries here when a brand has common spelling/spacing variants.
 */
const BRAND_ALIASES: Record<string, string> = {
  '710labs': '710 labs',
  '710-labs': '710 labs',
};

/** Normalizes a brand string to its canonical lowercase form using the alias map. */
function normalizeBrand(brand: string): string {
  const lower = brand.trim().toLowerCase();
  return BRAND_ALIASES[lower] ?? lower;
}

/**
 * Filters products by brand name, case-insensitively.
 * Applies BRAND_ALIASES normalization to both the filter list and each product brand
 * so that spelling variants like "710labs" / "710 Labs" / "710 LABS" all match.
 * Returns an empty array (never throws) when no products match.
 */
export function filter<T extends Product>(products: T[], brandsString: string): T[] {
  const targetBrands = brandsString
    .split(',')
    .map(b => normalizeBrand(b))
    .filter(b => b.length > 0);

  if (targetBrands.length === 0) return [];

  return products.filter(product => {
    const normalized = normalizeBrand(product.brand);
    return targetBrands.includes(normalized);
  });
}

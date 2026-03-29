import { describe, it, expect } from 'vitest';
import { filter } from '../../src/filter.js';
import type { Product } from '../../src/types.js';

const makeProduct = (brand: string, strainName = 'Test Strain'): Product => ({
  strainName,
  brand,
});

describe('filter', () => {
  it('returns matching products for a single brand', () => {
    const products = [makeProduct('Viola'), makeProduct('710 Labs'), makeProduct('Other Brand')];
    const result = filter(products, 'Viola');
    expect(result).toHaveLength(1);
    expect(result[0].brand).toBe('Viola');
  });

  it('returns matching products for multiple brands', () => {
    const products = [makeProduct('Viola'), makeProduct('710 Labs'), makeProduct('Other Brand')];
    const result = filter(products, 'Viola,710 Labs');
    expect(result).toHaveLength(2);
    expect(result.map(p => p.brand)).toContain('Viola');
    expect(result.map(p => p.brand)).toContain('710 Labs');
  });

  it('returns empty array when no products match', () => {
    const products = [makeProduct('Other Brand'), makeProduct('Another Brand')];
    const result = filter(products, 'Viola,710 Labs');
    expect(result).toHaveLength(0);
  });

  it('returns empty array for empty products input', () => {
    const result = filter([], 'Viola,710 Labs');
    expect(result).toHaveLength(0);
  });

  it('matches brands case-insensitively — " VIOLA " with extra whitespace', () => {
    const products = [makeProduct('Viola')];
    const result = filter(products, ' VIOLA ');
    expect(result).toHaveLength(1);
  });

  it('matches "710 LABS" (uppercase) against product brand "710 Labs"', () => {
    const products = [makeProduct('710 Labs')];
    const result = filter(products, '710 LABS');
    expect(result).toHaveLength(1);
  });

  it('normalizes "710labs" (no space) to match "710 Labs" product', () => {
    const products = [makeProduct('710 Labs')];
    const result = filter(products, '710labs');
    expect(result).toHaveLength(1);
  });

  it('normalizes product brand "710labs" to match "710 labs" filter', () => {
    const products = [makeProduct('710labs')];
    const result = filter(products, '710 Labs');
    expect(result).toHaveLength(1);
  });

  it('does not return partial matches', () => {
    const products = [makeProduct('Violator Kush')];
    const result = filter(products, 'Viola');
    expect(result).toHaveLength(0);
  });

  it('handles brands string with trailing/leading commas', () => {
    const products = [makeProduct('Viola')];
    const result = filter(products, ',Viola,');
    expect(result).toHaveLength(1);
  });
});

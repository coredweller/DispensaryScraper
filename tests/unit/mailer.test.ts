import { describe, it, expect } from 'vitest';
import { buildHtml } from '../../src/mailer.js';
import type { ScrapedProduct } from '../../src/types.js';

const makeProduct = (overrides: Partial<ScrapedProduct> = {}): ScrapedProduct => ({
  strainName: 'Test Strain',
  brand: 'Viola',
  strainType: 'Indica',
  maxWeight: '3.5g',
  thcValue: 22,
  priceAmount: 4000,
  pricePrecision: 2,
  priceCurrency: 'USD',
  ...overrides,
});

describe('buildHtml', () => {
  describe('with results', () => {
    it('returns an HTML string containing a table', () => {
      const products = [makeProduct()];
      const html = buildHtml(products, '2026-03-28');
      expect(html).toContain('<table');
      expect(html).toContain('</table>');
    });

    it('includes all 5 column headers', () => {
      const products = [makeProduct()];
      const html = buildHtml(products, '2026-03-28');
      expect(html).toContain('Strain');
      expect(html).toContain('Type');
      expect(html).toContain('THC%');
      expect(html).toContain('Weight');
      expect(html).toContain('Price');
    });

    it('includes the strain name in the output', () => {
      const products = [makeProduct({ strainName: 'Purple Haze' })];
      const html = buildHtml(products, '2026-03-28');
      expect(html).toContain('Purple Haze');
    });

    it('derives THC display from thcValue numeric field', () => {
      const products = [makeProduct({ thcValue: 22.4 })];
      const html = buildHtml(products, '2026-03-28');
      expect(html).toContain('22.4%');
    });

    it('derives price display from priceAmount and pricePrecision', () => {
      const products = [makeProduct({ priceAmount: 17500, pricePrecision: 2 })];
      const html = buildHtml(products, '2026-03-28');
      expect(html).toContain('$175.00');
    });

    it('renders "—" for missing thcValue', () => {
      const products = [makeProduct({ thcValue: undefined })];
      const html = buildHtml(products, '2026-03-28');
      expect(html).toContain('—');
    });

    it('renders "—" for missing priceAmount', () => {
      const products = [makeProduct({ priceAmount: undefined })];
      const html = buildHtml(products, '2026-03-28');
      expect(html).toContain('—');
    });

    it('renders "—" for missing strainType', () => {
      const products = [makeProduct({ strainType: undefined })];
      const html = buildHtml(products, '2026-03-28');
      expect(html).toContain('—');
    });

    it('renders "—" for missing maxWeight', () => {
      const products = [makeProduct({ maxWeight: undefined })];
      const html = buildHtml(products, '2026-03-28');
      expect(html).toContain('—');
    });

    it('groups products by brand — renders one table per brand', () => {
      const products = [
        makeProduct({ brand: 'Viola', strainName: 'Strain A' }),
        makeProduct({ brand: '710 Labs', strainName: 'Strain B' }),
      ];
      const html = buildHtml(products, '2026-03-28');
      expect(html).toContain('Viola');
      expect(html).toContain('710 Labs');
      const tableCount = (html.match(/<table/g) ?? []).length;
      expect(tableCount).toBe(2);
    });

    it('groups multiple strains from the same brand into one table', () => {
      const products = [
        makeProduct({ brand: 'Viola', strainName: 'Strain A' }),
        makeProduct({ brand: 'Viola', strainName: 'Strain B' }),
      ];
      const html = buildHtml(products, '2026-03-28');
      const tableCount = (html.match(/<table/g) ?? []).length;
      expect(tableCount).toBe(1);
      expect(html).toContain('Strain A');
      expect(html).toContain('Strain B');
    });

    it('includes the date in the email heading', () => {
      const html = buildHtml([makeProduct()], '2026-03-28');
      expect(html).toContain('2026-03-28');
    });

    it('escapes HTML in strain names to prevent injection', () => {
      const products = [makeProduct({ strainName: '<script>alert("xss")</script>' })];
      const html = buildHtml(products, '2026-03-28');
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });
  });

  describe('with empty results', () => {
    it('returns no-results paragraph when array is empty', () => {
      const html = buildHtml([], '2026-03-28');
      expect(html).toContain('No Viola or 710 Labs flower strains are currently listed');
    });

    it('includes the date in the no-results message', () => {
      const html = buildHtml([], '2026-03-28');
      expect(html).toContain('2026-03-28');
    });

    it('does not include a table when there are no results', () => {
      const html = buildHtml([], '2026-03-28');
      expect(html).not.toContain('<table');
    });
  });
});
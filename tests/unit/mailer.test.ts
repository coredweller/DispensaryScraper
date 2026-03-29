import { describe, it, expect } from 'vitest';
import { buildHtml } from '../../src/mailer.js';
import type { Product } from '../../src/types.js';

const makeProduct = (overrides: Partial<Product> = {}): Product => ({
  strainName: 'Test Strain',
  brand: 'Viola',
  strainType: 'Indica',
  thcPercent: '22%',
  maxWeight: '3.5g',
  maxPrice: '$40.00',
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

    it('groups products by brand — renders one table per brand', () => {
      const products = [
        makeProduct({ brand: 'Viola', strainName: 'Strain A' }),
        makeProduct({ brand: '710 Labs', strainName: 'Strain B' }),
      ];
      const html = buildHtml(products, '2026-03-28');
      // Two brand headings
      expect(html).toContain('Viola');
      expect(html).toContain('710 Labs');
      // Two table elements
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

    it('renders "—" for missing strainType', () => {
      const products = [makeProduct({ strainType: undefined })];
      const html = buildHtml(products, '2026-03-28');
      expect(html).toContain('—');
    });

    it('renders "—" for missing thcPercent', () => {
      const products = [makeProduct({ thcPercent: undefined })];
      const html = buildHtml(products, '2026-03-28');
      expect(html).toContain('—');
    });

    it('renders "—" for missing maxWeight', () => {
      const products = [makeProduct({ maxWeight: undefined })];
      const html = buildHtml(products, '2026-03-28');
      expect(html).toContain('—');
    });

    it('renders "—" for missing maxPrice', () => {
      const products = [makeProduct({ maxPrice: undefined })];
      const html = buildHtml(products, '2026-03-28');
      expect(html).toContain('—');
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

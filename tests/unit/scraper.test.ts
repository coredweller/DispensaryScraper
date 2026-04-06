import { describe, it, expect } from 'vitest';
import { weightToGrams } from '../../src/scraper.js';

describe('weightToGrams', () => {
  describe('lookup table hits', () => {
    it('returns 0.5 for "0.5g"', () => expect(weightToGrams('0.5g')).toBe(0.5));
    it('returns 1 for "1g"', () => expect(weightToGrams('1g')).toBe(1));
    it('returns 3.5 for "3.5g"', () => expect(weightToGrams('3.5g')).toBe(3.5));
    it('returns 3.5 for "1/8oz"', () => expect(weightToGrams('1/8oz')).toBe(3.5));
    it('returns 7 for "7g"', () => expect(weightToGrams('7g')).toBe(7));
    it('returns 7 for "1/4oz"', () => expect(weightToGrams('1/4oz')).toBe(7));
    it('returns 14 for "14g"', () => expect(weightToGrams('14g')).toBe(14));
    it('returns 14 for "1/2oz"', () => expect(weightToGrams('1/2oz')).toBe(14));
    it('returns 28 for "28g"', () => expect(weightToGrams('28g')).toBe(28));
    it('returns 28 for "1oz"', () => expect(weightToGrams('1oz')).toBe(28));
  });

  describe('gram regex branch', () => {
    it('parses "2g" not in lookup table', () => expect(weightToGrams('2g')).toBe(2));
    it('parses "10g"', () => expect(weightToGrams('10g')).toBe(10));
    it('parses "4.5g" decimal gram weight', () => expect(weightToGrams('4.5g')).toBe(4.5));
  });

  describe('fractional ounce regex branch', () => {
    it('parses "1/2oz" via regex (also in lookup — same result)', () => {
      expect(weightToGrams('1/2oz')).toBe(14);
    });
    it('parses "3/4oz" not in lookup table', () => {
      expect(weightToGrams('3/4oz')).toBeCloseTo((3 / 4) * 28.35, 5);
    });
  });

  describe('normalization', () => {
    it('handles uppercase "1OZ"', () => expect(weightToGrams('1OZ')).toBe(28));
    it('handles leading/trailing whitespace " 3.5g "', () => expect(weightToGrams(' 3.5g ')).toBe(3.5));
    it('handles mixed case "1/8OZ"', () => expect(weightToGrams('1/8OZ')).toBe(3.5));
  });

  describe('unknown input', () => {
    it('returns -1 for an unrecognized string', () => expect(weightToGrams('unknown')).toBe(-1));
    it('returns -1 for empty string', () => expect(weightToGrams('')).toBe(-1));
    it('returns -1 for "1lb"', () => expect(weightToGrams('1lb')).toBe(-1));
  });
});
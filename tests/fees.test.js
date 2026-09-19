import { describe, it, expect } from 'vitest';
import { computeCycleAmount, feeBreakdown } from '../src/domain/fees.js';

describe('computeCycleAmount (5.4 worked example)', () => {
  it('monthly plan, zero discount', () => {
    expect(computeCycleAmount(1600, 1, 0)).toBe(1600);
  });
  it('quarterly plan, 5% discount', () => {
    expect(computeCycleAmount(1600, 3, 5)).toBe(4560);
  });
  it('yearly plan, 10% discount', () => {
    expect(computeCycleAmount(1600, 12, 10)).toBe(17280);
  });
  it('rounds the discount to the nearest rupee', () => {
    // gross 1450*3=4350, 5% = 217.5 -> rounds to 218, cycle = 4132
    expect(computeCycleAmount(1450, 3, 5)).toBe(4132);
  });
});

describe('feeBreakdown', () => {
  it('exposes gross and discount alongside the cycle amount', () => {
    expect(feeBreakdown(1600, 3, 5)).toEqual({ gross: 4800, discount: 240, cycleAmount: 4560 });
  });
});

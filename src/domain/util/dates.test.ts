import { describe, expect, it } from 'vitest';
import { isDateOnly, toLocalDateOnly } from './dates';

describe('toLocalDateOnly', () => {
  it('uses the local calendar day, not UTC', () => {
    // 23:30 local time must stay on the same local day in every time zone.
    expect(toLocalDateOnly(new Date(2026, 8, 30, 23, 30))).toBe('2026-09-30');
    expect(toLocalDateOnly(new Date(2026, 0, 1, 0, 5))).toBe('2026-01-01');
  });
});

describe('isDateOnly', () => {
  it('accepts real calendar dates in YYYY-MM-DD form', () => {
    expect(isDateOnly('2026-09-30')).toBe(true);
    expect(isDateOnly('2024-02-29')).toBe(true);
  });

  it('rejects other formats and impossible dates', () => {
    expect(isDateOnly('2026-9-30')).toBe(false);
    expect(isDateOnly('30.09.2026')).toBe(false);
    expect(isDateOnly('2026-09-30T10:00:00Z')).toBe(false);
    expect(isDateOnly('2026-02-30')).toBe(false);
    expect(isDateOnly('2025-02-29')).toBe(false);
    expect(isDateOnly('')).toBe(false);
  });
});

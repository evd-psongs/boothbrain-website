import { describe, expect, it } from '@jest/globals';

import { isPauseAllowanceUsed } from '../subscriptionPause';

describe('isPauseAllowanceUsed', () => {
  const periodStart = '2025-03-01T00:00:00.000Z';
  const nextPeriodStart = '2025-04-01T00:00:00.000Z';

  it('returns false when no pause has been recorded', () => {
    expect(isPauseAllowanceUsed(periodStart, null)).toBe(false);
  });

  it('returns true when pause matches the current billing period', () => {
    expect(isPauseAllowanceUsed(periodStart, periodStart)).toBe(true);
  });

  it('returns false when pause was recorded during a previous period', () => {
    expect(isPauseAllowanceUsed(nextPeriodStart, periodStart)).toBe(false);
  });

  it('treats unknown current period as used for safety', () => {
    expect(isPauseAllowanceUsed(null, periodStart)).toBe(true);
  });

  it('ignores invalid timestamps', () => {
    expect(isPauseAllowanceUsed(periodStart, 'not-a-date')).toBe(false);
  });
});

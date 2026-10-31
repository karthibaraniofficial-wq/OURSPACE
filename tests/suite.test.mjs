import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Import shared logic directly for testing
import {
  calculateDaysTogether,
  getCountdown,
  formatChatTimestamp,
  formatBytes,
  ACCENT_PRESETS,
} from '../packages/shared/src/index.ts';

describe('OURSPACE Core Business Logic Test Suite', () => {
  test('calculateDaysTogether accurately calculates elapsed days', () => {
    const today = new Date();
    const tenDaysAgo = new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const days = calculateDaysTogether(tenDaysAgo);
    assert.equal(days, 10);
  });

  test('calculateDaysTogether gracefully handles null and invalid inputs', () => {
    assert.equal(calculateDaysTogether(null), 0);
    assert.equal(calculateDaysTogether(undefined), 0);
    assert.equal(calculateDaysTogether('invalid-date'), 0);
  });

  test('getCountdown computes positive remaining days for future events', () => {
    const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const countdown = getCountdown(futureDate);
    assert.equal(countdown.isPast, false);
    assert.equal(countdown.days >= 4, true);
  });

  test('getCountdown identifies past dates', () => {
    const pastDate = new Date(Date.now() - 3600000).toISOString();
    const countdown = getCountdown(pastDate);
    assert.equal(countdown.isPast, true);
  });

  test('formatBytes correctly scales file units', () => {
    assert.equal(formatBytes(0), '0 B');
    assert.equal(formatBytes(1024), '1 KB');
    assert.equal(formatBytes(1048576), '1 MB');
    assert.equal(formatBytes(2621440), '2.5 MB');
  });

  test('ACCENT_PRESETS contains essential romantic palettes', () => {
    assert.equal(ACCENT_PRESETS.length >= 5, true);
    const rosePreset = ACCENT_PRESETS.find((p) => p.id === 'rose');
    assert.ok(rosePreset);
    assert.equal(rosePreset.hex, '#f43f5e');
  });
});

import { describe, expect, it, vi } from 'vitest';
import { dayOf, localToday, shownDay, timeOf } from './day';

describe('a made-on day', () => {
  const noon = Date.UTC(2026, 9, 29, 12);

  it('reads as 29/10/2026 in Vietnamese and 29 Oct 2026 in English', () => {
    expect(dayOf(noon, 'vi')).toBe('29/10/2026');
    expect(dayOf(noon, 'en')).toBe('29 Oct 2026');
  });

  it('is a dash for a client made before the time was kept', () => {
    expect(dayOf(null, 'vi')).toBe('—');
    expect(dayOf(null, 'en')).toBe('—');
  });
});

describe('a checked-at time', () => {
  it('C: reads as the clock to the second on 24 hours, midnight as 00 and not 24, the same in both languages', () => {
    const early = new Date(2026, 9, 31, 0, 5, 9).getTime();
    const late = new Date(2026, 9, 31, 19, 7, 3).getTime();

    expect(timeOf(early, 'vi')).toBe('00:05:09');
    expect(timeOf(early, 'en')).toBe('00:05:09');
    expect(timeOf(late, 'vi')).toBe('19:07:03');
    expect(timeOf(late, 'en')).toBe('19:07:03');
  });
});

describe('the office’s day', () => {
  it('is today as the browser’s calendar has it, a real YYYY-MM-DD with the month and day padded', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 4, 10, 0));
    expect(localToday()).toBe('2026-11-04');
    vi.setSystemTime(new Date(2026, 0, 9, 23, 59));
    expect(localToday()).toBe('2026-01-09');
    vi.useRealTimers();
  });

  it('is written as 04/11/2026 in Vietnamese and 4 Nov 2026 in English, whatever zone the browser is in', () => {
    expect(shownDay('2026-11-04', 'vi')).toBe('04/11/2026');
    expect(shownDay('2026-11-04', 'en')).toBe('4 Nov 2026');
  });
});

import { describe, expect, it } from 'vitest';
import { dayOf } from './day';

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

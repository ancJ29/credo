import { describe, expect, it } from 'vitest';
import { WIDTHS } from './widths';

describe('the screen widths', () => {
  it('are the three the app is drawn and walked at, widest first', () => {
    // pinned as literals on purpose: a test that read the constant would follow it to any value
    expect(WIDTHS).toEqual({ pc: 1280, tablet: 768, phone: 390 });
    expect(Object.keys(WIDTHS)).toEqual(['pc', 'tablet', 'phone']);
  });
});

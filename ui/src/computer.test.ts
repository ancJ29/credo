import { describe, expect, it } from 'vitest';
import { isComputer } from './computer';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const ANDROID_PHONE =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
const ANDROID_TABLET =
  'Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const IPAD =
  'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Version/16.0 Mobile/15E148 Safari/604.1';
const MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

describe('isComputer', () => {
  it('is false for a phone', () => {
    expect(isComputer({ userAgent: IPHONE, platform: 'iPhone', maxTouchPoints: 5 })).toBe(false);
    expect(
      isComputer({ userAgent: ANDROID_PHONE, platform: 'Linux armv81', maxTouchPoints: 5 }),
    ).toBe(false);
  });

  it('is false for a tablet, an Android one that does not say Mobile included', () => {
    expect(isComputer({ userAgent: IPAD, platform: 'iPad', maxTouchPoints: 5 })).toBe(false);
    expect(
      isComputer({ userAgent: ANDROID_TABLET, platform: 'Linux armv81', maxTouchPoints: 5 }),
    ).toBe(false);
  });

  it('is false for an iPad that reports itself as a Mac, which a Mac with touch points is', () => {
    expect(isComputer({ userAgent: MAC, platform: 'MacIntel', maxTouchPoints: 5 })).toBe(false);
  });

  it('is true for a Mac and a Windows computer, a touch screen on the latter included', () => {
    expect(isComputer({ userAgent: MAC, platform: 'MacIntel', maxTouchPoints: 0 })).toBe(true);
    expect(isComputer({ userAgent: WINDOWS, platform: 'Win32', maxTouchPoints: 10 })).toBe(true);
  });
});

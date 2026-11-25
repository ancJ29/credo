import { describe, expect, it } from 'vitest';
import { deviceNameOf } from './devices';

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
const WINDOWS_CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const WINDOWS_EDGE = `${WINDOWS_CHROME} Edg/131.0.0.0`;
const MAC_SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15';
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
const LINUX_FIREFOX = 'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0';
const IPHONE_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.103 Mobile/15E148 Safari/604.1';

describe('the name of a device, from the browser that added a passkey', () => {
  it('2: names the system and the browser, "iPhone · Safari" and "Windows · Chrome" among them', () => {
    expect(deviceNameOf(IPHONE_SAFARI)).toBe('iPhone · Safari');
    expect(deviceNameOf(WINDOWS_CHROME)).toBe('Windows · Chrome');
    expect(deviceNameOf(WINDOWS_EDGE)).toBe('Windows · Edge');
    expect(deviceNameOf(MAC_SAFARI)).toBe('Mac · Safari');
    expect(deviceNameOf(ANDROID_CHROME)).toBe('Android · Chrome');
    expect(deviceNameOf(LINUX_FIREFOX)).toBe('Linux · Firefox');
    expect(deviceNameOf(IPHONE_CHROME)).toBe('iPhone · Chrome');
  });

  it('2: names none where the system or the browser is not known, or no header came', () => {
    expect(deviceNameOf(undefined)).toBeNull();
    expect(deviceNameOf('')).toBeNull();
    expect(deviceNameOf('curl/8.4.0')).toBeNull();
    expect(deviceNameOf('Mozilla/5.0 (Windows NT 10.0) SomeBrowser/1.0')).toBeNull();
    expect(deviceNameOf('Mozilla/5.0 (PlayStation 5) Chrome/100')).toBeNull();
  });

  it('2: holds no more than a name, however long the header is', () => {
    expect(deviceNameOf(`${WINDOWS_CHROME} ${'x'.repeat(10_000)}`)).toBe('Windows · Chrome');
    expect(deviceNameOf(`${'x'.repeat(10_000)} ${WINDOWS_CHROME}`)).toBeNull();
  });
});

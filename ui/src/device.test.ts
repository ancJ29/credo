import { describe, expect, it } from 'vitest';
import { createDeviceStore } from './device';

const memory = () => {
  const kept = new Map<string, string>();
  return {
    getItem: (key: string) => kept.get(key) ?? null,
    setItem: (key: string, value: string) => void kept.set(key, value),
    removeItem: (key: string) => void kept.delete(key),
  };
};

describe('what the device keeps', () => {
  it('mints a device id once and keeps it', () => {
    const storage = memory();
    const first = createDeviceStore(storage).deviceId();

    expect(first).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    expect(createDeviceStore(storage).deviceId()).toBe(first);
  });

  it('keeps the session handle until it is cleared', () => {
    const storage = memory();
    const device = createDeviceStore(storage);
    expect(device.authId()).toBeNull();

    device.setAuthId('d.secret');
    expect(createDeviceStore(storage).authId()).toBe('d.secret');

    device.clearAuthId();
    expect(createDeviceStore(storage).authId()).toBeNull();
  });

  it('keeps the language chosen, and reads no language it does not offer', () => {
    const storage = memory();
    const device = createDeviceStore(storage);
    expect(device.language()).toBeNull();

    device.setLanguage('en');
    expect(createDeviceStore(storage).language()).toBe('en');

    storage.setItem('credo.language', 'fr');
    expect(device.language()).toBeNull();
  });

  it('keeps the language the last boot showed, apart from the one chosen, and reads no language it does not offer', () => {
    const storage = memory();
    const device = createDeviceStore(storage);
    expect(device.shownLanguage()).toBeNull();

    device.setShownLanguage('en');
    expect(createDeviceStore(storage).shownLanguage()).toBe('en');
    expect(device.language()).toBeNull();

    storage.setItem('credo.shown', 'fr');
    expect(device.shownLanguage()).toBeNull();
  });
});

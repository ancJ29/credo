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

  it('keeps a ticked sign-in on the device: another tab is signed in', () => {
    const kept = memory();
    const device = createDeviceStore(kept, memory());

    device.setAuthId('d.secret', true);

    expect(createDeviceStore(kept, memory()).authId()).toBe('d.secret');
  });

  it('keeps an unticked sign-in in the tab: a reload is signed in, another tab is not', () => {
    const kept = memory();
    const tab = memory();
    createDeviceStore(kept, tab).setAuthId('d.secret', false);

    expect(createDeviceStore(kept, tab).authId()).toBe('d.secret');
    expect(createDeviceStore(kept, memory()).authId()).toBeNull();
    expect(kept.getItem('credo.session')).toBeNull();
  });

  it('clears the handle wherever it was kept, and a new one replaces the old', () => {
    const kept = memory();
    const tab = memory();
    const device = createDeviceStore(kept, tab);

    device.setAuthId('on.device', true);
    device.clearAuthId();
    expect(device.authId()).toBeNull();
    expect(kept.getItem('credo.session')).toBeNull();

    device.setAuthId('in.tab', false);
    device.clearAuthId();
    expect(device.authId()).toBeNull();
    expect(tab.getItem('credo.session')).toBeNull();

    device.setAuthId('on.device', true);
    device.setAuthId('in.tab', false);
    expect(kept.getItem('credo.session')).toBeNull();
    device.setAuthId('on.device.again', true);
    expect(tab.getItem('credo.session')).toBeNull();
    expect(createDeviceStore(kept, memory()).authId()).toBe('on.device.again');
  });

  it('keeps whether the side menu shows: it does until a person hides it', () => {
    const storage = memory();
    const device = createDeviceStore(storage);
    expect(device.menuShown()).toBe(true);

    device.setMenuShown(false);
    expect(createDeviceStore(storage).menuShown()).toBe(false);

    device.setMenuShown(true);
    expect(createDeviceStore(storage).menuShown()).toBe(true);
  });

  it('keeps the client it was linked to, apart from every handle', () => {
    const storage = memory();
    const device = createDeviceStore(storage);
    expect(device.clientCode()).toBeNull();

    device.setClientCode('minh-phat');
    expect(createDeviceStore(storage).clientCode()).toBe('minh-phat');
    expect(device.authId()).toBeNull();
    expect(device.operatorAuthId()).toBeNull();
  });

  it('keeps the operator’s handle apart from a client’s, so each is cleared alone', () => {
    const storage = memory();
    const device = createDeviceStore(storage);
    device.setAuthId('client.secret');
    device.setOperatorAuthId('operator.secret');

    device.clearOperatorAuthId();
    expect(device.operatorAuthId()).toBeNull();
    expect(device.authId()).toBe('client.secret');

    device.setOperatorAuthId('operator.again');
    device.clearAuthId();
    expect(createDeviceStore(storage).operatorAuthId()).toBe('operator.again');
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

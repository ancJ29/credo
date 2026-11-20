import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { digestOf, GATE_PREFIX, GATE_STYLE, startGate, WORDS } from './gate';

const KEY = 'credo-site-gate';
const hashOf = (entry: string) => digestOf(entry);

const box = () => document.getElementById('site-gate');
const field = () => document.querySelector<HTMLInputElement>('#site-gate input')!;
const note = () => document.querySelector('#site-gate [role="alert"]')!.textContent;
const open = () => document.documentElement.classList.contains('gate-open');
async function type(entry: string) {
  field().value = entry;
  document
    .querySelector('#site-gate form')!
    .dispatchEvent(new Event('submit', { cancelable: true }));
  // the digest is asked of WebCrypto, which answers later: wait for the box to answer or go
  await vi.waitFor(() => expect(box() === null || note() !== '').toBe(true));
}

beforeEach(() => {
  Object.defineProperty(window, 'crypto', { value: webcrypto, configurable: true });
  document.documentElement.classList.remove('gate-open');
  document.body.innerHTML = '<main>the page</main>';
  localStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
  box()?.remove();
});

describe('the password box', () => {
  it('hashes a fixed prefix and the entry with SHA-256, as ops/site-password.sh does', async () => {
    // printf '%s' 'credo-site-gate:open sesame' | shasum -a 256
    expect(GATE_PREFIX).toBe('credo-site-gate:');
    expect(await hashOf('open sesame')).toBe(
      '13d4167b030de5c89308760cf72f172a4aeb275cb8d9edcbcb913b45422d2b4a',
    );
  });

  it('keeps the content hidden and shows the box until the right password is typed', async () => {
    const hash = await hashOf('right');
    startGate(hash);
    expect(GATE_STYLE).toBe('html:not(.gate-open) body{visibility:hidden}');
    expect(open()).toBe(false);
    expect(box()?.textContent).toContain(WORDS.title);
    expect(field().type).toBe('password');

    await type('wrong');
    expect(open()).toBe(false);
    expect(note()).toBe(WORDS.wrong);
    expect(field().value).toBe('');
    expect(localStorage.getItem(KEY)).toBeNull();

    await type('right');
    expect(open()).toBe(true);
    expect(box()).toBeNull();
    expect(localStorage.getItem(KEY)).toBe(hash);
  });

  it('opens at once for a browser that remembers the current hash', async () => {
    const hash = await hashOf('right');
    localStorage.setItem(KEY, hash);
    startGate(hash);
    expect(open()).toBe(true);
    expect(box()).toBeNull();
  });

  it('asks again once the committed hash has changed, whatever an old password was remembered', async () => {
    const oldHash = await hashOf('old password');
    const newHash = await hashOf('new password');
    localStorage.setItem(KEY, oldHash);
    startGate(newHash);
    expect(open()).toBe(false);
    expect(box()).not.toBeNull();
    await type('old password');
    expect(open()).toBe(false);
    await type('new password');
    expect(open()).toBe(true);
    expect(localStorage.getItem(KEY)).toBe(newHash);
  });

  it('asks again, and opens, when the browser’s storage throws on every read and write', async () => {
    const hash = await hashOf('right');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    startGate(hash);
    expect(open()).toBe(false);
    await type('right');
    expect(open()).toBe(true);
  });

  it('says plainly that the browser cannot check, and stays shut, where WebCrypto is missing', async () => {
    Object.defineProperty(window, 'crypto', { value: {}, configurable: true });
    startGate('a'.repeat(64));
    await type('anything');
    expect(note()).toBe(WORDS.broken);
    expect(open()).toBe(false);
  });
});

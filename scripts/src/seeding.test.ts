import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SeededClient } from './generator';
import { createSeeding, logToStderr } from './seeding';

const client: SeededClient = {
  code: 'walk-1',
  rootPassword: 'root-pw',
  people: { 'EMP-0001': 'a' },
};
const closers: (() => void)[] = [];
afterEach(() => {
  for (const close of closers.splice(0)) close();
});

async function door(seed: () => Promise<SeededClient>, log: (error: unknown) => void = () => {}) {
  const server = createSeeding(seed, log);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  closers.push(() => server.close());
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

describe('the door to more clients', () => {
  it('A POST to /seed answers the client the generator made, 201, and a second POST asks for another', async () => {
    let made = 0;
    const url = await door(() => Promise.resolve({ ...client, code: `walk-${++made}` }));

    const first = await fetch(`${url}/seed`, { method: 'POST' });
    const second = await fetch(`${url}/seed`, { method: 'POST' });

    expect(first.status).toBe(201);
    expect(await first.json()).toEqual({ ...client, code: 'walk-1' });
    expect((await second.json()) as SeededClient).toMatchObject({ code: 'walk-2' });
  });

  it('answers nothing but a POST to /seed, and makes no client for anything else', async () => {
    let made = 0;
    const url = await door(() => Promise.resolve({ ...client, code: `walk-${++made}` }));

    expect((await fetch(`${url}/seed`)).status).toBe(404);
    expect((await fetch(`${url}/other`, { method: 'POST' })).status).toBe(404);
    expect(made).toBe(0);
  });

  it('answers 500 naming nothing of why when the generator fails, never a half-made client', async () => {
    const url = await door(() => Promise.reject(new Error('the key is hunter2')));

    const reply = await fetch(`${url}/seed`, { method: 'POST' });

    expect(reply.status).toBe(500);
    expect(await reply.text()).not.toContain('hunter2');
  });

  it('hands the reason a seed failed to the stack’s own log, and the answer stays "could not seed"', async () => {
    const logged: unknown[] = [];
    const url = await door(
      () => Promise.reject(new Error('the generator answered 400')),
      (error) => void logged.push(error),
    );

    const reply = await fetch(`${url}/seed`, { method: 'POST' });

    expect(reply.status).toBe(500);
    expect(await reply.json()).toEqual({ error: 'could not seed' });
    expect(logged).toEqual([new Error('the generator answered 400')]);
  });

  it('answers first, and a log that throws changes nothing: the door answers the next call too', async () => {
    let calls = 0;
    const url = await door(
      () => Promise.reject(new Error('down')),
      () => {
        calls++;
        throw new Error('the log is full');
      },
    );

    expect((await fetch(`${url}/seed`, { method: 'POST' })).status).toBe(500);
    expect((await fetch(`${url}/seed`, { method: 'POST' })).status).toBe(500);

    expect(calls).toBe(2);
  });

  it('writes a failure to the stack’s stderr as one line with the error', () => {
    const written: string[] = [];
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });
    try {
      logToStderr(new Error('the generator answered 400'));
    } finally {
      spy.mockRestore();
    }
    expect(written).toEqual(['seed failed: Error: the generator answered 400\n']);
  });
});

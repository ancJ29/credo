import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from '@credo/bff';
import { createClient, ROOT_NAME } from '@credo/bff/clients';
import { buildCStorage } from '@credo/bff/tests/build';
import { freshTenant, type RunningCStorage, startCStorage } from '@credo/bff/tests/c-storage';
import {
  CLIENT_HEADER,
  type CStorageClient,
  DEVICE_HEADER,
  recordKeys,
  ROUTES,
  storedClientSchema,
} from '@credo/shared';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { DAYS_PER_ROUND, HISTORY_DAYS, applyCopy } from './demo/apply';
import { addDays } from './demo/days';
import { readLedger } from './demo/ledger';
import { allCopies } from './demo/mapping';
import { runRidge } from './ridge';

/** Every first password the product's create minted in this file, to look for them in the output. */
const minted = vi.hoisted(() => [] as string[]);
vi.mock('@credo/bff/password', async (importOriginal) => {
  const real = await importOriginal<typeof import('@credo/bff/password')>();
  return {
    ...real,
    newPassword: () => {
      const password = real.newPassword();
      minted.push(password);
      return password;
    },
  };
});

let cs: RunningCStorage;
let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'credo-ridge-remake-test-'));
  const binary = join(dir, 'c-storage');
  await buildCStorage(binary);
  cs = await startCStorage(binary);
});
afterAll(async () => {
  await cs.stop();
  await rm(dir, { recursive: true, force: true });
});

const copies = allCopies();
const PARTNERS = [...new Set(copies.map((copy) => copy.partner))];
/** Invented, one for each partner, and obeying the password rule. */
const PASSWORDS: Record<string, string> = {
  p1: 'Invented-One1!',
  p2: 'Invented-Two2@',
  p3: 'Invented-Three3$',
};
const typed = (passwords: Record<string, string> = PASSWORDS) =>
  PARTNERS.map((partner) => `${partner} ${passwords[partner]}\n`).join('');
/** The morning of the 30th at 06:00 in Vietnam: yesterday is the 29th. */
const MORNING = Date.UTC(2026, 9, 29, 23, 0, 0);
const TODAY = '2026-10-30';
const DEVICE = 'device-test-0001';

/** A service of its own, and the command run as ops/ runs it: the connection in the environment,
 * the passwords on the standard input. */
async function ridge() {
  const tenant = await freshTenant(cs);
  const storage = tenant.client;
  const env = {
    C_STORAGE_URL: tenant.connection.baseUrl,
    INTERNAL_ACCESS_KEY: tenant.connection.internalAccessKey,
    SERVICE_CODE: tenant.serviceCode,
    SERVICE_ACCESS_KEY: tenant.accessKey,
  };
  async function run(
    argv: string[],
    stdin: string | null = typed(),
    fetch?: typeof globalThis.fetch,
    clock = true,
  ) {
    const lines = { out: [] as string[], err: [] as string[] };
    const status = await runRidge(argv, env, {
      out: (line) => lines.out.push(line),
      show: () => {
        throw new Error('remake shows nothing on the terminal');
      },
      err: (line) => lines.err.push(line),
      fetch,
      now: clock ? () => MORNING : undefined,
      stdin: stdin === null ? undefined : () => Promise.resolve(stdin),
    });
    return { status, ...lines };
  }
  return { storage, run };
}

const indexOf = async (storage: CStorageClient, code: string) => {
  const held = await storage.getRecord(recordKeys.client(code));
  return held ? storedClientSchema.parse(held.data) : null;
};

/** The product's sign-in, as the root's browser calls it. */
async function signInStatus(storage: CStorageClient, code: string, password: string) {
  const app = buildApp({
    storage,
    now: Date.now,
    origin: 'http://localhost',
    serviceKey: 'the test',
    logger: false,
  });
  const reply = await app.inject({
    method: 'POST',
    url: ROUTES.signIn,
    headers: { [CLIENT_HEADER]: code, [DEVICE_HEADER]: DEVICE },
    payload: { name: ROOT_NAME, password },
  });
  return reply.statusCode;
}

const recordCount = async (storage: CStorageClient, tenantId: string) => {
  const listed = await storage.listRecords(recordKeys.tenant(tenantId).all);
  return { count: listed.records.length, more: listed.more };
};

describe('ridge_cli remake', () => {
  it('row 5: a used copy is deleted to zero records, made again, signs in with its partner’s password and holds a new ledger; the rounds then go to up to date', async () => {
    const { storage, run } = await ridge();
    const first = copies[0];
    const made = await createClient(storage, { code: first.code, name: first.company, madeAt: 1 });
    if (made === 'taken') throw new Error('taken');
    const used = await applyCopy(storage, first, TODAY, undefined, 1);
    expect(used.status).toBe('ok');
    // more records than one press of a deletion removes, so one call to deleteClient is not enough
    for (let at = 0; at < 250; at += 1) {
      await storage.putRecord(`${recordKeys.tenant(made.id).all}pad-${at}`, { at }, null);
    }
    expect(await signInStatus(storage, first.code, made.password)).toBe(200);
    const before = await recordCount(storage, made.id);
    expect(before.count).toBeGreaterThan(200);

    const result = await run(['remake']);

    expect(result.status).toBe(0);
    expect(result.err).toEqual([]);
    const index = (await indexOf(storage, first.code))!;
    expect(index.id).not.toBe(made.id);
    expect(await recordCount(storage, made.id)).toEqual({ count: 0, more: false });
    expect(await storage.getRecord(recordKeys.clientDeletion(first.code))).toBeNull();
    expect(await signInStatus(storage, first.code, PASSWORDS[first.partner])).toBe(200);
    expect(await signInStatus(storage, first.code, made.password)).toBe(401);
    const ledger = (await readLedger(storage, index.id))!.ledger;
    expect(ledger.filled).toBe(true);
    expect(ledger.firstDay).toBe(addDays('2026-10-29', -(HISTORY_DAYS - 1)));
    expect(result.out).toContain('remake: 6 copies deleted, made again and given their passwords');

    // the rounds: each at most five days, behind until the last, which ends at yesterday
    let rounds = 0;
    for (;;) {
      rounds += 1;
      const round = await run(['seed', '--round'], null);
      expect(round.status).toBe(0);
      if (!round.out.some((line) => line.startsWith('seed: STILL BEHIND'))) break;
      expect(rounds).toBeLessThan(10);
    }
    expect(rounds).toBe(Math.ceil(HISTORY_DAYS / DAYS_PER_ROUND));
    const done = (await readLedger(storage, index.id))!.ledger;
    expect(done.lastDay).toBe('2026-10-29');
  }, 600_000);

  it('row 6: a copy not on the service is made and filled, the others too', async () => {
    const { storage, run } = await ridge();

    const result = await run(['remake']);

    expect(result.status).toBe(0);
    for (const copy of copies) {
      const index = (await indexOf(storage, copy.code))!;
      expect(index.name, copy.code).toBe(copy.company);
      const ledger = (await readLedger(storage, index.id))!.ledger;
      expect(ledger.filled, copy.code).toBe(true);
      expect(ledger.lastDay, copy.code).toBe(addDays(ledger.firstDay, -1));
    }
  }, 600_000);

  it('row 7: an unfinished earlier deletion is finished, then the copy is made', async () => {
    const { storage, run } = await ridge();
    const first = copies[0];
    const made = await createClient(storage, { code: first.code, name: first.company, madeAt: 1 });
    if (made === 'taken') throw new Error('taken');
    for (let at = 0; at < 250; at += 1) {
      await storage.putRecord(`${recordKeys.tenant(made.id).all}pad-${at}`, { at }, null);
    }
    // the press that deleted the index and 200 records, and stopped
    const { deleteClient } = await import('@credo/bff/clients');
    const part = await deleteClient(storage, {
      code: first.code,
      index: {
        ...(await indexOf(storage, first.code))!,
        tag: (await storage.getRecord(recordKeys.client(first.code)))!.tag,
      },
      by: '00000000-0000-0000-0000-000000000000',
      now: () => 1,
    });
    expect(part).not.toEqual({ left: 0 });
    expect(await indexOf(storage, first.code)).toBeNull();

    const result = await run(['remake']);

    expect(result.status).toBe(0);
    expect(await recordCount(storage, made.id)).toEqual({ count: 0, more: false });
    expect((await indexOf(storage, first.code))!.id).not.toBe(made.id);
    expect(await signInStatus(storage, first.code, PASSWORDS[first.partner])).toBe(200);
  }, 600_000);

  it('row 7: a deletion of another client under the code, still unfinished, stops the run red, naming the code, and deletes nothing more', async () => {
    const { storage, run } = await ridge();
    const first = copies[0];
    const made = await createClient(storage, { code: first.code, name: first.company, madeAt: 1 });
    if (made === 'taken') throw new Error('taken');
    await storage.putRecord(
      recordKeys.clientDeletion(first.code),
      {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Another',
        by: '00000000-0000-0000-0000-000000000000',
        startedAt: 1,
      },
      null,
    );
    const before = await recordCount(storage, made.id);

    const result = await run(['remake'], typed(), undefined, false);

    expect(result.status).toBe(1);
    expect(result.err.join('\n')).toContain(
      `error: ${first.code}: ${first.code}: nothing more was deleted`,
    );
    expect(await recordCount(storage, made.id)).toEqual(before);
    expect((await indexOf(storage, first.code))!.id).toBe(made.id);
  }, 600_000);

  it('row 9: no input at all, or a line with no space in it, is refused before anything is written', async () => {
    const { run } = await ridge();

    for (const argv of [['remake'], ['remake', '--check']]) {
      expect((await run(argv, null)).status).toBe(2);
      expect((await run(argv, 'p1\n')).status).toBe(2);
    }
  });

  it('row 6: a rival that makes the copy’s index, or its ledger, first stops that run red, naming the copy', async () => {
    const first = copies[0];
    for (const [rivalKey, said] of [
      [recordKeys.client(first.code), 'the service still holds it'],
      ['.seed', 'another run holds it'],
    ] as const) {
      const { storage, run } = await ridge();
      let done = false;
      const rival: typeof fetch = async (input, init) => {
        if (!done && init?.method === 'POST' && typeof init.body === 'string') {
          const { key } = JSON.parse(init.body) as { key: string };
          const hit = rivalKey === '.seed' ? key.endsWith('.seed') : key === rivalKey;
          if (hit) {
            done = true;
            await storage.putRecord(key, { rival: true }, null);
          }
        }
        return fetch(input, init);
      };

      const result = await run(['remake'], typed(), rival);

      expect(result.status, said).toBe(1);
      expect(result.err.join('\n'), said).toContain(said);
    }
  }, 600_000);

  it('row 8: a partner’s password signs in to that partner’s copies and is refused at the others’', async () => {
    const { storage, run } = await ridge();

    expect((await run(['remake'])).status).toBe(0);

    for (const copy of copies) {
      for (const partner of PARTNERS) {
        const expected = partner === copy.partner ? 200 : 401;
        expect(
          await signInStatus(storage, copy.code, PASSWORDS[partner]),
          `${copy.code} ${partner}`,
        ).toBe(expected);
      }
    }
  }, 600_000);

  it('row 9: a bad or missing password is status 2 before any delete, naming the partner and never the password', async () => {
    const { storage, run } = await ridge();
    const first = copies[0];
    const made = await createClient(storage, { code: first.code, name: first.company, madeAt: 1 });
    if (made === 'taken') throw new Error('taken');
    const before = await recordCount(storage, made.id);
    const cases: [string, string][] = [
      ['a password that breaks the rule', typed({ ...PASSWORDS, p2: 'Short1!' })],
      ['a partner missing', `p1 ${PASSWORDS['p1']}\np3 ${PASSWORDS['p3']}\n`],
      ['a partner twice', `${typed()}p1 ${PASSWORDS['p1']}\n`],
      ['a partner outside the mapping', `${typed()}p9 ${PASSWORDS['p1']}\n`],
      ['nothing', ''],
    ];
    for (const [name, stdin] of cases) {
      for (const argv of [['remake'], ['remake', '--check']]) {
        const result = await run(argv, stdin);
        expect(result.status, `${name} ${argv.join(' ')}`).toBe(2);
        expect(result.err.join('\n') + result.out.join('\n'), name).not.toContain('Short1!');
      }
    }
    expect((await indexOf(storage, first.code))!.id).toBe(made.id);
    expect(await recordCount(storage, made.id)).toEqual(before);
    expect(await signInStatus(storage, first.code, made.password)).toBe(200);
    const ok = await run(['remake', '--check']);
    expect(ok.status).toBe(0);
    expect(ok.out).toEqual(['checked: every partner has a password that follows the rule']);
  });

  it('row 10: the first fill applies no day; each round at most five, behind until the last, which ends at yesterday with 21 days in the ledger', async () => {
    const { storage, run } = await ridge();
    expect((await run(['remake'])).status).toBe(0);
    const ids = await Promise.all(
      copies.map(async (copy) => (await indexOf(storage, copy.code))!.id),
    );
    const lastDays = async () =>
      Promise.all(ids.map(async (id) => (await readLedger(storage, id))!.ledger));

    const applied: number[] = [];
    let behind: boolean;
    do {
      const round = await run(['seed', '--round'], null);
      expect(round.status).toBe(0);
      const days = round.out.filter((line) => / applied, \d+ events$/.test(line)).length;
      applied.push(days / copies.length);
      behind = round.out.some((line) => line.startsWith('seed: STILL BEHIND'));
      expect(behind).toBe(applied.length < 5);
    } while (behind);

    expect(applied).toEqual([5, 5, 5, 5, 1]);
    for (const ledger of await lastDays()) {
      expect(ledger.lastDay).toBe('2026-10-29');
      expect(ledger.firstDay).toBe(addDays('2026-10-29', -20));
    }
  }, 900_000);

  it('row 11: no line holds a typed password, a first password or a hash', async () => {
    const { storage, run } = await ridge();
    const first = copies[0];
    const made = await createClient(storage, { code: first.code, name: first.company, madeAt: 1 });
    if (made === 'taken') throw new Error('taken');

    const remade = await run(['remake']);
    const checked = await run(['remake', '--check'], typed({ ...PASSWORDS, p2: 'Short1!' }));

    const printed = [...remade.out, ...remade.err, ...checked.out, ...checked.err].join('\n');
    expect(minted.length).toBeGreaterThan(copies.length);
    for (const secret of [...Object.values(PASSWORDS), ...minted, 'Short1!', 'scrypt$']) {
      expect(printed).not.toContain(secret);
    }
    const hash = (
      (await storage.getRecord(
        recordKeys.tenant((await indexOf(storage, first.code))!.id).user(ROOT_NAME),
      ))!.data as { passwordHash: string }
    ).passwordHash;
    expect(printed).not.toContain(hash);
    expect(remade.status).toBe(0);
  }, 600_000);
});

import { randomUUID } from 'node:crypto';
import {
  clientListReplySchema,
  type CStorageClient,
  moveClientReplySchema,
  recordKeys,
  storedClientSchema,
} from '@credo/shared';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { recordingActivity } from '../../tests/audit';
import { freshTenant, type RunningCStorage, startCStorage } from '../../tests/c-storage';
import { joinedOperator, touchFor } from '../../tests/operator';
import {
  bffOn,
  CODE,
  scoped,
  seedSettings,
  seedTenant,
  signIn,
  withAuth,
} from '../../tests/tenant';
import { deleteClient } from '../records/clients';
import { compareCompany } from '../records/company-copy';
import { tenantStorage } from '../records/records';

let cs: RunningCStorage;
beforeAll(async () => {
  cs = await startCStorage(inject('cStorageBinary'));
});
afterAll(async () => {
  await cs.stop();
});

const START = Date.UTC(2026, 9, 28, 9, 0, 0);
const WAIT = 15_000;

/** The back end over a home box and a second box `b2`, both logged, with an operator signed in and
 * a company `CODE` on the home box holding a root, its settings and `n` more records. */
async function setup({ n = 0, onB2 = false }: { n?: number; onB2?: boolean } = {}) {
  let clock = START;
  const second = (await freshTenant(cs)).client;
  const wrote = { home: [] as string[], b2: [] as string[] };
  /** What a test arms on a box: a hold on its first list, a line write refused, a failing status. */
  const hooks = {
    holdList: null as null | { reached: () => void; release: Promise<void> },
    lineMoved: false,
    afterPut: null as null | (() => Promise<unknown>),
    failNextLineWrite: false,
    statusFails: false,
  };
  const logged = (client: CStorageClient, box: 'home' | 'b2'): CStorageClient => ({
    ...client,
    listRecords: async (prefix, after) => {
      if (box === 'b2' && hooks.holdList) {
        const held = hooks.holdList;
        hooks.holdList = null;
        held.reached();
        await held.release;
      }
      return await client.listRecords(prefix, after);
    },
    putRecord: async (key, data, tag) => {
      if (key.startsWith('operator.')) return await client.putRecord(key, data, tag);
      if (box === 'home' && key.startsWith('client.') && tag !== null) {
        if (hooks.lineMoved) return 'moved';
        if (hooks.failNextLineWrite) {
          hooks.failNextLineWrite = false;
          throw new Error('the box went down after the writes');
        }
      }
      wrote[box].push(`put ${key}`);
      const outcome = await client.putRecord(key, data, tag);
      if (box === 'b2' && hooks.afterPut) {
        const run = hooks.afterPut;
        hooks.afterPut = null;
        await run();
      }
      return outcome;
    },
    removeRecord: (key, tag) => {
      if (!key.startsWith('operator.')) wrote[box].push(`remove ${key}`);
      return client.removeRecord(key, tag);
    },
    status: () =>
      box === 'b2' && hooks.statusFails ? Promise.reject(new Error('no answer')) : client.status(),
  });
  const { entries, client: activity } = recordingActivity();
  const t = await bffOn(cs, {
    now: () => clock,
    wrap: (client) => logged(client, 'home'),
    boxes: { b2: logged(second, 'b2') },
    activity,
  });
  const op = await joinedOperator(t);
  const home = t.client;
  const id = await seedTenant(onB2 ? second : home, CODE);
  const store = onB2 ? second : home;
  await seedSettings(store, id);
  if (onB2) {
    await home.putRecord(recordKeys.client(CODE), { id, name: 'Acme', box: 'b2' }, null);
    await home.removeRecord(recordKeys.client(CODE));
    await home.putRecord(recordKeys.client(CODE), { id, name: 'Acme', box: 'b2' }, null);
  } else {
    await home.putRecord(recordKeys.client(CODE), { id, name: 'Acme' }, null);
  }
  const keys = recordKeys.tenant(id);
  /** `count` more records of a company, 50 at once. */
  const fill = async (on: CStorageClient, who: string, count: number, tag = 'e') => {
    for (let from = 0; from < count; from += 50) {
      await Promise.all(
        Array.from({ length: Math.min(50, count - from) }, (_, i) =>
          on.putRecord(
            recordKeys.tenant(who).employee(`${tag}${String(from + i).padStart(5, '0')}`),
            {
              n: 1,
            },
          ),
        ),
      );
    }
  };
  await fill(store, id, n);
  wrote.home.length = 0;
  const asRoot = scoped(t.app, CODE);
  const route = `/api/operator/clients/${CODE}/move`;
  const post = (payload: object, headers: Record<string, string> = withAuth(op.authId)) =>
    t.app.inject({ method: 'POST', url: route, headers, payload });
  const touch = () => touchFor(t, op.authId, op.authenticator, 'move-client');
  const begin = async (to = 'b2') => await post({ to, confirm: await touch() });
  const press = () => post({});
  const stop = () => post({ stop: true });
  const advance = (ms: number) => {
    clock += ms;
  };
  const reply = (answer: { json: () => unknown }) => moveClientReplySchema.parse(answer.json());
  const line = async () => {
    const held = await home.getRecord(recordKeys.client(CODE));
    return { ...storedClientSchema.parse(held?.data), tag: held?.tag ?? '' };
  };
  /** Every record of a company on a box, `key@tag`. */
  const records = async (on: CStorageClient, who: string = id) => {
    const all: string[] = [];
    let after: string | undefined;
    for (;;) {
      const page = await on.listRecords(recordKeys.tenant(who).all, after);
      all.push(...page.records.map((r) => `${r.key}@${r.tag}`));
      if (!page.more) return all;
      after = page.records[page.records.length - 1]?.key;
    }
  };
  /** The company's own call: a sign-in as its root, whose answer is the status of the line's box. */
  const companyCall = async () => (await signIn(asRoot)).response.statusCode;
  /** Presses until the answer's phase is `phase`, never more than `max` presses. */
  const pressUntil = async (phase: string, max = 20) => {
    for (let at = 0; at < max; at++) {
      const answer = reply(await press());
      if (answer.phase === phase) return answer;
    }
    throw new Error(`no ${phase} in ${max} presses`);
  };
  return {
    ...t,
    op,
    id,
    keys,
    home,
    second,
    store,
    hooks,
    wrote,
    entries,
    asRoot,
    post,
    begin,
    press,
    stop,
    advance,
    reply,
    line,
    records,
    fill,
    companyCall,
    pressUntil,
    listed: async () =>
      clientListReplySchema.parse(
        (
          await t.app.inject({
            method: 'GET',
            url: '/api/operator/clients',
            headers: withAuth(op.authId),
          })
        ).json(),
      ).clients[0],
  };
}

/** A company moved the whole way: marked, waited, copied, switched. */
async function switched(t: Awaited<ReturnType<typeof setup>>) {
  await t.begin();
  t.advance(WAIT);
  await t.pressUntil('switched');
}

describe('An operator moves a company between boxes', { timeout: 60_000 }, () => {
  it('case 1: from the mark to the switch, every call of the company answers 503 from the next one', async () => {
    const t = await setup({ n: 3 });
    expect(await t.companyCall()).toBe(200);
    const marked = await t.begin();
    expect(marked.statusCode).toBe(200);
    expect(await t.companyCall()).toBe(503);
    t.advance(WAIT);
    expect(await t.companyCall()).toBe(503);
    t.advance(1000);
    await t.pressUntil('switched');
    expect(await t.companyCall()).toBe(503);
  });

  it('case 2: while the line carries a move, the operator’s delete and root password answer 409 and write nothing', async () => {
    const t = await setup({ n: 3 });
    const act = async (name: 'delete-client' | 'root-password') => {
      const confirm = await touchFor(t, t.op.authId, t.op.authenticator, name);
      return name === 'delete-client'
        ? await t.app.inject({
            method: 'DELETE',
            url: `/api/operator/clients/${CODE}`,
            headers: withAuth(t.op.authId),
            payload: { confirm },
          })
        : await t.app.inject({
            method: 'POST',
            url: `/api/operator/clients/${CODE}/root-password`,
            headers: withAuth(t.op.authId),
            payload: { password: 'A new password 1!', confirm },
          });
    };
    const refusedEverywhere = async () => {
      const before = [await t.records(t.home), await t.records(t.second), (await t.line()).tag];
      for (const name of ['delete-client', 'root-password'] as const) {
        expect((await act(name)).statusCode).toBe(409);
      }
      expect([await t.records(t.home), await t.records(t.second), (await t.line()).tag]).toEqual(
        before,
      );
    };
    await t.begin();
    await refusedEverywhere();
    t.advance(WAIT);
    await t.pressUntil('switched');
    await refusedEverywhere();
    t.advance(WAIT);
    expect((await t.line()).move?.form).toBe('sweeping');
    await refusedEverywhere();
    await t.pressUntil('done');
    expect((await act('root-password')).statusCode).toBe(200);
  });

  it('case 3: the beginning needs a fresh touch and refuses a box not held, the company’s own, a line already moving and a target not answering, writing nothing', async () => {
    const t = await setup({ n: 3 });
    const untouched = async (statusCode: number, answer: { statusCode: number }) => {
      expect(answer.statusCode).toBe(statusCode);
      expect((await t.line()).move).toBeUndefined();
      expect(t.wrote.home).toEqual([]);
      expect(t.wrote.b2).toEqual([]);
    };
    await untouched(400, await t.post({ to: 'b2' }));
    const other = await touchFor(t, t.op.authId, t.op.authenticator, 'delete-client');
    await untouched(403, await t.post({ to: 'b2', confirm: other }));
    await untouched(400, await t.begin('zz'));
    await untouched(400, await t.begin('home'));
    t.hooks.statusFails = true;
    await untouched(503, await t.begin('b2'));
    t.hooks.statusFails = false;
    await untouched(401, await t.post({ to: 'b2' }, {}));
    expect((await t.begin()).statusCode).toBe(200);
    const marked = await t.line();
    t.wrote.home.length = 0;
    expect((await t.begin()).statusCode).toBe(409);
    expect((await t.line()).tag).toBe(marked.tag);
    expect(t.wrote.home).toEqual([]);
  });

  it('case 4: a press in the first wait copies nothing and says the seconds left', async () => {
    const t = await setup({ n: 3 });
    const marked = t.reply(await t.begin());
    expect(marked).toEqual({ phase: 'waiting', seconds: 15 });
    t.advance(4_500);
    expect(t.reply(await t.press())).toEqual({ phase: 'waiting', seconds: 11 });
    expect(await t.records(t.second)).toEqual([]);
    expect(t.wrote.b2).toEqual([]);
  });

  it('case 5: a press makes at most 200 changes and the next goes on from its key; one cut off before its key is written leaves the next press nothing to change, and the move ends equal', async () => {
    const t = await setup({ n: 250 });
    await t.begin();
    t.advance(WAIT);
    expect(t.reply(await t.press()).phase).toBe('copying');
    expect(t.wrote.b2.length).toBe(200);
    const kept = (await t.line()).move;
    expect(kept?.form === 'copying' && kept.after).toBeTruthy();
    // The second press's writes land and its key does not: the third walks from the first's key.
    t.hooks.failNextLineWrite = true;
    expect((await t.press()).statusCode).toBe(500);
    const writtenBefore = t.wrote.b2.length;
    expect(writtenBefore).toBe(252);
    expect(t.reply(await t.press()).phase).toBe('switched');
    expect(t.wrote.b2.length).toBe(writtenBefore);
    expect(new Set(t.wrote.b2).size).toBe(t.wrote.b2.length);
    expect(
      await compareCompany(tenantStorage(t.home, t.id), tenantStorage(t.second, t.id)),
    ).toMatchObject({ differ: 0 });
  });

  it('case 6: the switch is refused unless the compare is 0; a save landing on the old box after its copy is copied first', async () => {
    const t = await setup({ n: 5 });
    await t.begin();
    t.advance(WAIT);
    const late = recordKeys.tenant(t.id).employee('late-save');
    t.hooks.afterPut = () => t.home.putRecord(late, { n: 2 });
    expect(t.reply(await t.press())).toEqual({ phase: 'copying', left: 1 });
    expect((await t.line()).box).toBeUndefined();
    expect((await t.line()).move?.form).toBe('copying');
    expect(await t.companyCall()).toBe(503);
    expect(t.reply(await t.press()).phase).toBe('switched');
    expect(await t.second.getRecord(late)).not.toBeNull();
    expect((await t.line()).box).toBe('b2');
  });

  it('case 7: after the switch the company answers 503 until sweepAt, then every call reaches the new box', async () => {
    const t = await setup({ n: 3 });
    await switched(t);
    expect((await t.line()).box).toBe('b2');
    expect(await t.companyCall()).toBe(503);
    t.advance(WAIT - 1);
    expect(await t.companyCall()).toBe(503);
    t.advance(1);
    expect(await t.companyCall()).toBe(200);
    expect((await t.records(t.second)).some((entry) => entry.includes('.session.'))).toBe(true);
    expect((await t.records(t.home)).some((entry) => entry.includes('.session.'))).toBe(false);
  });

  it('case 8: a press begun before the switch and run on after it, and a press finding the line sweeping, change nothing on the new box', async () => {
    const t = await setup({ n: 3 });
    await t.begin();
    t.advance(WAIT);
    // The slow press has read the line (copying) and stops at its first read of the new box.
    let reached: () => void = () => undefined;
    const arrived = new Promise<void>((resolve) => (reached = resolve));
    let release: () => void = () => undefined;
    t.hooks.holdList = { reached, release: new Promise<void>((resolve) => (release = resolve)) };
    const slow = t.press();
    await arrived;
    expect(t.reply(await t.press()).phase).toBe('switched');
    const whole = await t.records(t.second);
    const homeWhole = await t.records(t.home);
    t.wrote.b2.length = 0;
    // Before sweepAt a press sweeps nothing.
    t.advance(WAIT - 1);
    expect(t.reply(await t.press()).phase).toBe('switched');
    expect(await t.records(t.home)).toEqual(homeWhole);
    release();
    expect((await slow).statusCode).toBe(409);
    expect(await t.records(t.second)).toEqual(whole);
    // After it the sweep touches the old box alone.
    t.advance(1);
    await t.pressUntil('done');
    expect(t.wrote.b2).toEqual([]);
    expect(await t.records(t.second)).toEqual(whole);
  });

  it('case 9: the old box is swept in presses until it holds none of the company’s records, and the line then carries no move', async () => {
    const t = await setup({ n: 250 });
    await switched(t);
    t.advance(WAIT);
    expect(t.reply(await t.press())).toEqual({ phase: 'sweeping', left: 52 });
    expect(t.reply(await t.press())).toEqual({ phase: 'done' });
    expect(await t.records(t.home)).toEqual([]);
    const done = await t.line();
    expect(done.move).toBeUndefined();
    expect(done.box).toBe('b2');
    expect((await t.press()).statusCode).toBe(409);
  });

  it('case 10: a stop before the switch serves the company at once from its old box and sweeps the part copy from sweepAt; after the switch a stop is refused', async () => {
    const t = await setup({ n: 250 });
    await t.begin();
    t.advance(WAIT);
    await t.press();
    const whole = await t.records(t.home);
    const stopped = t.reply(await t.stop());
    expect(stopped).toEqual({ phase: 'stopped', seconds: 15 });
    expect(await t.companyCall()).toBe(200);
    expect(t.reply(await t.press())).toEqual({ phase: 'stopped', seconds: 15 });
    expect((await t.records(t.second)).length).toBeGreaterThan(0);
    t.advance(WAIT);
    await t.pressUntil('done');
    expect(await t.records(t.second)).toEqual([]);
    const line = await t.line();
    expect(line.move).toBeUndefined();
    expect(line.box).toBeUndefined();
    expect((await t.records(t.home)).filter((entry) => !entry.includes('.session.'))).toEqual(
      whole.filter((entry) => !entry.includes('.session.')),
    );
    // Once switched there is no stop.
    await t.begin();
    t.advance(WAIT);
    await t.pressUntil('switched');
    const marked = await t.line();
    expect((await t.stop()).statusCode).toBe(409);
    expect((await t.line()).tag).toBe(marked.tag);
    expect((await t.stop()).statusCode).toBe(409);
  });

  it('case 11: every other company on both boxes is unchanged by a move, one whose id begins with the moved one’s included', async () => {
    const t = await setup({ n: 30 });
    const neighbour = `${t.id}x`;
    const stranger = randomUUID();
    for (const who of [neighbour, stranger]) {
      await t.fill(t.home, who, 20, 'h');
      await t.fill(t.second, who, 25, 's');
    }
    const before = await Promise.all(
      [neighbour, stranger].flatMap((who) => [t.records(t.home, who), t.records(t.second, who)]),
    );
    await switched(t);
    t.advance(WAIT);
    await t.pressUntil('done');
    const after = await Promise.all(
      [neighbour, stranger].flatMap((who) => [t.records(t.home, who), t.records(t.second, who)]),
    );
    expect(after).toEqual(before);
    expect(before.map((list) => list.length)).toEqual([20, 25, 20, 25]);
  });

  it('case 12: the mark, the switch and a stop each leave one client.move entry naming the company and both boxes, and no other press leaves one', async () => {
    const t = await setup({ n: 250 });
    await t.begin();
    expect(t.entries.map((entry) => entry.action)).toEqual(['client.move']);
    t.advance(WAIT);
    await t.press();
    expect(t.entries.length).toBe(1);
    expect((await t.stop()).statusCode).toBe(200);
    t.advance(WAIT);
    await t.pressUntil('done');
    expect(t.entries.map((entry) => entry.memo)).toMatchObject([
      { outcome: 'saved', before: { code: CODE, step: 'mark', from: 'home', to: 'b2' } },
      { outcome: 'saved', before: { code: CODE, step: 'stop', from: 'home', to: 'b2' } },
    ]);
    expect(t.entries.every((entry) => entry.clientId === t.id && entry.targetId === t.id)).toBe(
      true,
    );
    await switched(t);
    t.advance(WAIT);
    await t.pressUntil('done');
    expect(t.entries.map((entry) => entry.memo)).toMatchObject([
      { before: { step: 'mark' } },
      { before: { step: 'stop' } },
      { before: { step: 'mark' } },
      { before: { step: 'switch', from: 'home', to: 'b2' } },
    ]);
    // A refused beginning is entered in its refused form; a refused press enters none.
    const count = t.entries.length;
    expect((await t.press()).statusCode).toBe(409);
    expect(t.entries.length).toBe(count);
  });

  it('case 13: the clients list names each company’s box and its mark in either form, and never the key', async () => {
    const t = await setup({ n: 250 });
    expect(await t.listed()).toMatchObject({ code: CODE });
    expect((await t.listed()).move).toBeUndefined();
    expect((await t.listed()).box).toBe('home');
    await t.begin();
    expect(await t.listed()).toMatchObject({ move: { form: 'copying', box: 'b2' } });
    t.advance(WAIT);
    await t.press();
    const text = JSON.stringify(
      (
        await t.app.inject({
          method: 'GET',
          url: '/api/operator/clients',
          headers: withAuth(t.op.authId),
        })
      ).json(),
    );
    const kept = (await t.line()).move;
    expect(kept?.form === 'copying' && kept.after).toBeTruthy();
    expect(text).not.toContain(kept?.form === 'copying' ? (kept.after ?? '-') : '-');
    await t.stop();
    expect(await t.listed()).toMatchObject({ move: { form: 'sweeping', box: 'b2' } });
    expect((await t.listed()).box).toBe('home');
    t.advance(WAIT);
    await t.pressUntil('done');
    await switched(t);
    expect(await t.listed()).toMatchObject({ box: 'b2', move: { form: 'sweeping', box: 'home' } });
  });
});

describe(
  'A move in the other direction, and the refusals a press keeps',
  { timeout: 60_000 },
  () => {
    it('moves a company from b2 to the home box, which then answers from there with its line naming no box', async () => {
      const t = await setup({ n: 5, onB2: true });
      expect(await t.companyCall()).toBe(200);
      await t.begin('home');
      t.advance(WAIT);
      await t.pressUntil('switched');
      const line = await t.line();
      expect(line.box).toBeUndefined();
      expect(line.move).toMatchObject({ form: 'sweeping', box: 'b2', closed: true });
      t.advance(WAIT);
      await t.pressUntil('done');
      expect(await t.records(t.second)).toEqual([]);
      expect(await t.companyCall()).toBe(200);
      expect((await t.records(t.home)).some((entry) => entry.includes('.session.'))).toBe(true);
    });

    it('answers 401, 400 and 404 before the line is read further, and 409 to a press or a stop of a company not moving', async () => {
      const t = await setup({ n: 1 });
      expect((await t.post({}, {})).statusCode).toBe(401);
      expect(
        (
          await t.app.inject({
            method: 'POST',
            url: '/api/operator/clients/Bad_Code/move',
            headers: withAuth(t.op.authId),
            payload: {},
          })
        ).statusCode,
      ).toBe(400);
      expect(
        (
          await t.app.inject({
            method: 'POST',
            url: '/api/operator/clients/nobody/move',
            headers: withAuth(t.op.authId),
            payload: {},
          })
        ).statusCode,
      ).toBe(404);
      expect((await t.press()).statusCode).toBe(409);
      expect((await t.stop()).statusCode).toBe(409);
      expect((await t.post({ stop: false })).statusCode).toBe(400);
    });

    it('answers 409 where the line changed since the press read it, at each write of a press, and leaves the line as it was', async () => {
      const refused = async (
        t: Awaited<ReturnType<typeof setup>>,
        answer: Promise<{ statusCode: number }>,
      ) => {
        const before = await t.line();
        t.hooks.lineMoved = true;
        expect((await answer).statusCode).toBe(409);
        t.hooks.lineMoved = false;
        expect(await t.line()).toEqual(before);
      };
      // The beginning, and the stop.
      const first = await setup({ n: 3 });
      await refused(first, first.begin());
      await first.begin();
      await refused(first, first.stop());
      // The copy's key.
      const long = await setup({ n: 250 });
      await long.begin();
      long.advance(WAIT);
      await refused(long, long.press());
      // The compare's cleared key.
      const late = await setup({ n: 3 });
      await late.begin();
      late.advance(WAIT);
      late.hooks.afterPut = () =>
        late.home.putRecord(recordKeys.tenant(late.id).employee('late-save'), { n: 2 });
      await refused(late, late.press());
      // The switch.
      const quick = await setup({ n: 3 });
      await quick.begin();
      quick.advance(WAIT);
      await refused(quick, quick.press());
      // The sweep's end: the box is swept, the line keeps its mark, and the next press ends it.
      await quick.pressUntil('switched');
      quick.advance(WAIT);
      await refused(quick, quick.press());
      expect(quick.reply(await quick.press())).toEqual({ phase: 'done' });
    });

    it('answers 503 to a press of a line naming a box this back end does not hold', async () => {
      const t = await setup({ n: 1 });
      const held = await t.home.getRecord(recordKeys.client(CODE));
      await t.home.putRecord(
        recordKeys.client(CODE),
        { id: t.id, name: 'Acme', move: { form: 'copying', to: 'zz', markedAt: START - WAIT } },
        held?.tag,
      );
      expect((await t.press()).statusCode).toBe(503);
      await t.home.putRecord(
        recordKeys.client(CODE),
        {
          id: t.id,
          name: 'Acme',
          box: 'home',
          move: { form: 'sweeping', box: 'zz', sweepAt: START, closed: false },
        },
        (await t.home.getRecord(recordKeys.client(CODE)))?.tag,
      );
      expect((await t.press()).statusCode).toBe(503);
    });
  },
);

describe('The delete refuses a company that is moving, whatever store it is handed', () => {
  it('case 2: throws by name and writes nothing, with the box handed or not, in either form of the mark', async () => {
    const t = await setup({ n: 3 });
    await t.begin();
    const before = [await t.records(t.home), await t.records(t.second), (await t.line()).tag];
    const index = await t.line();
    const by = '00000000-0000-0000-0000-000000000000';
    for (const box of [undefined, t.second]) {
      await expect(
        deleteClient(t.home, { code: CODE, index, by, now: () => START, ...(box ? { box } : {}) }),
      ).rejects.toThrow(/is moving to another box: nothing was deleted/);
    }
    expect([await t.records(t.home), await t.records(t.second), (await t.line()).tag]).toEqual(
      before,
    );
  });
});

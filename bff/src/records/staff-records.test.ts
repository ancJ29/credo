import { type CStorageClient, CStorageError, recordKeys, type StoredUser } from '@credo/shared';
import { describe, expect, it } from 'vitest';
import { setSignInPassword } from './staff-records';

// The bound as the test's own number, deliberately not the shared `TRIES`: a test that reads the
// constant it guards follows it to any value and cannot go red when it changes.
const TRIES = 3;
const TENANT = '3f2c1d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
const KEY = recordKeys.tenant(TENANT).user('root');
const ROOT: StoredUser = {
  passwordHash: 'scrypt$old',
  root: true,
  employeeId: null,
  passwordAt: 1,
  generation: 'before',
};

/** One sign-in record under a tag that changes at every write; `moves` writes are refused as
 * moved first, the way a claim's takeover moves a record under a reader. */
function store(record: StoredUser | null, moves = 0) {
  const state = { record, tag: 't0', reads: 0, writes: [] as StoredUser[], refused: moves };
  const storage = {
    getRecord: (key: string) => {
      expect(key).toBe(KEY);
      state.reads++;
      return Promise.resolve(state.record ? { data: state.record, tag: state.tag } : null);
    },
    putRecord: (key: string, data: StoredUser, tag: string) => {
      expect(key).toBe(KEY);
      expect(tag).toBe(state.tag);
      if (state.refused > 0) {
        state.refused--;
        state.tag = `moved${state.refused}`;
        return Promise.resolve('moved' as const);
      }
      state.writes.push(data);
      state.record = data;
      state.tag = `t${state.writes.length}`;
      return Promise.resolve('saved' as const);
    },
  } as unknown as CStorageClient;
  return { state, storage };
}

describe('The write that gives a sign-in record a password and ends its sessions', () => {
  it('writes the hash over the tag it read, with the time and a fresh generation, and nothing else changed', async () => {
    const { state, storage } = store(ROOT);

    const result = await setSignInPassword(
      storage,
      TENANT,
      'root',
      (u) => u.root,
      'scrypt$new',
      () => 99,
    );

    expect(result).toBe('set');
    expect(state.writes).toEqual([
      {
        ...ROOT,
        passwordHash: 'scrypt$new',
        passwordAt: 99,
        generation: state.writes[0].generation,
      },
    ]);
    expect(state.writes[0].generation).not.toBe(ROOT.generation);
    expect(state.writes[0].generation).not.toBe('');
  });

  it('writes nothing for a record the caller does not own, or none', async () => {
    const person = store({
      ...ROOT,
      root: false,
      employeeId: '9b1c0a52-7d3e-4f6a-8b2d-1c3e5a7b9d0f',
    });
    const gone = store(null);

    expect(
      await setSignInPassword(
        person.storage,
        TENANT,
        'root',
        (u) => u.root,
        'h',
        () => 1,
      ),
    ).toBe('not owned');
    expect(
      await setSignInPassword(
        gone.storage,
        TENANT,
        'root',
        (u) => u.root,
        'h',
        () => 1,
      ),
    ).toBe('not owned');
    expect(person.state.writes).toEqual([]);
    expect(gone.state.writes).toEqual([]);
  });

  it('reads again after a moved tag and writes over the new one, up to three tries', async () => {
    const twice = store(ROOT, TRIES - 1);
    const never = store(ROOT, TRIES);

    expect(
      await setSignInPassword(
        twice.storage,
        TENANT,
        'root',
        (u) => u.root,
        'h',
        () => 1,
      ),
    ).toBe('set');
    expect(twice.state.reads).toBe(TRIES);
    await expect(
      setSignInPassword(
        never.storage,
        TENANT,
        'root',
        (u) => u.root,
        'h',
        () => 1,
      ),
    ).rejects.toThrow(CStorageError);
    expect(never.state.writes).toEqual([]);
    expect(never.state.reads).toBe(TRIES);
  });
});

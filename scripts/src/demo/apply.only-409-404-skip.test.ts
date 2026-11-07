import { recordKeys } from '@credo/shared';
import { describe, expect, it } from 'vitest';
import { applyCopy } from './apply';
import { addDays } from './days';
import {
  A1,
  B1,
  fresh,
  make,
  tenantOf,
  firstEvent,
  hooked,
  down,
  useCStorage,
} from './apply-support';

useCStorage();

describe('only a 409 or a 404 is a skip', () => {
  const armed = async (kind: 'hire' | 'leave') => {
    const { day } = firstEvent(kind === 'hire' ? B1 : A1, kind);
    const copy = kind === 'hire' ? B1 : A1;
    const storage = await fresh();
    await make(storage, copy);
    await applyCopy(storage, copy, day);
    return { storage, copy, next: addDays(day, 1) };
  };

  it('row 18: a write that fails on a hire stops the run red', async () => {
    const { storage, copy, next } = await armed('hire');
    const breaking = hooked(storage, {
      beforePut: (key, data) =>
        key.includes('.employee.') && (data as { archived: boolean }).archived === false
          ? Promise.reject(down())
          : Promise.resolve(),
    });
    await expect(applyCopy(breaking, copy, next)).rejects.toThrow(
      /POST \/api\/employees answered 5\d\d/,
    );
  });

  it('row 18: a write that fails on a leaver’s archive stops the run red', async () => {
    const { storage, copy, next } = await armed('leave');
    const breaking = hooked(storage, {
      beforePut: (key, data) =>
        key.includes('.employee.') && (data as { archived: boolean }).archived === true
          ? Promise.reject(down())
          : Promise.resolve(),
    });
    await expect(applyCopy(breaking, copy, next)).rejects.toThrow(/archive answered 5\d\d/);
  });

  it('row 18: a read that fails stops the run red, and its session is ended', async () => {
    const { storage, copy, next } = await armed('hire');
    let broken = false;
    const breaking = hooked(storage, {
      beforeGet: (key) => {
        if (broken && key.endsWith('.staff-setup')) throw down();
      },
    });
    broken = true;
    await expect(applyCopy(breaking, copy, next)).rejects.toThrow(
      /GET \/api\/staff-setup answered 5\d\d/,
    );
    const sessions = await storage.listRecords(
      recordKeys.tenant(await tenantOf(storage, copy.code)).session(''),
    );
    expect(sessions.records).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { applyAll } from './apply';
import { A1, B1, fresh, make, tenantOf, hooked, down, TODAY, useCStorage } from './apply-support';

useCStorage();

describe('the error a run ends with', () => {
  it('row 18: the copy that stops a run red is named in the error, whichever copy of the mapping it is', async () => {
    const storage = await fresh();
    await make(storage, A1);
    await make(storage, B1);
    const idB = await tenantOf(storage, B1.code);
    const breaking = hooked(storage, {
      beforePut: (key) =>
        key.startsWith(`tenant.${idB}.employee.`) ? Promise.reject(down()) : Promise.resolve(),
    });

    await expect(applyAll(breaking, TODAY, () => undefined)).rejects.toThrow(
      new RegExp(`^${B1.code}: .*answered 5\\d\\d`),
    );
  });
});

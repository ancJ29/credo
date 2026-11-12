import { buildApp } from '@credo/bff';
import { createClient, ROOT_NAME } from '@credo/bff/clients';
import {
  CLIENT_HEADER,
  type CStorageClient,
  DEVICE_HEADER,
  recordKeys,
  ROUTES,
  tenantConfigSchema,
} from '@credo/shared';
import { describe, expect, it } from 'vitest';
import { applyAll, applyCopy } from './apply';
import { companyConfig } from './company';
import { addDays } from './days';
import { writeLedger } from './ledger';
import {
  A1,
  A2,
  B1,
  fresh,
  make,
  tenantOf,
  everything,
  asRoot,
  TODAY,
  useCStorage,
} from './apply-support';

useCStorage();

describe('which clients are touched', () => {
  it('row 8: a client with a code outside the mapping, one someone used first, and one not made are left', async () => {
    const storage = await fresh();
    await createClient(storage, {
      code: 'check-1700000000',
      name: 'A deploy’s check',
      madeAt: Date.now(),
    });
    const used = await make(storage, A1);
    const root = await asRoot(storage, A1.code, used.password);
    expect(
      (await root('POST', ROUTES.employees, { name: 'Ai Đó', code: 'AD-1', extra: {} })).statusCode,
    ).toBe(201);
    const checkBefore = JSON.stringify(await everything(storage, 'check-1700000000'));
    const usedBefore = JSON.stringify(await everything(storage, A1.code));
    const lines: string[] = [];

    const reports = await applyAll(storage, TODAY, (line) => lines.push(line));

    expect(reports).toHaveLength(6);
    const byCode = Object.fromEntries(reports.map((r) => [r.code, r.status]));
    expect(byCode[A1.code]).toBe('refused');
    expect(byCode[A2.code]).toBe('missing');
    expect(Object.values(byCode).filter((status) => status === 'missing')).toHaveLength(5);
    expect(JSON.stringify(await everything(storage, 'check-1700000000'))).toBe(checkBefore);
    expect(JSON.stringify(await everything(storage, A1.code))).toBe(usedBefore);
    expect(lines.join('\n')).not.toContain('check-1700000000');
  });

  it('row 8: a copy whose root only signed in before the first fill is still filled, and a week on, its session long expired, is still kept up', async () => {
    const storage = await fresh();
    const made = await make(storage, A1);
    await asRoot(storage, A1.code, made.password);
    const id = await tenantOf(storage, A1.code);
    const left = (await everything(storage, A1.code))
      .map((record) => record.key)
      .filter(
        (key) =>
          key !== recordKeys.tenant(id).config && key !== recordKeys.tenant(id).user(ROOT_NAME),
      );
    expect(left).toHaveLength(1);
    expect(left[0].startsWith(recordKeys.tenant(id).session(''))).toBe(true);

    expect((await applyCopy(storage, A1, TODAY)).status).toBe('ok');
    expect((await applyCopy(storage, A1, addDays(TODAY, 9))).status).toBe('ok');
  });

  it('row 8: a copy whose only extra record is a sign-in wait, left by a wrong name typed into it, is still filled', async () => {
    const storage = await fresh();
    await make(storage, A1);
    const app = buildApp({
      storage,
      now: () => Date.now(),
      origin: 'http://localhost',
      serviceKey: 'a-key',
      logger: false,
    });
    const typed = await app.inject({
      method: 'POST',
      url: ROUTES.signIn,
      headers: { [CLIENT_HEADER]: A1.code, [DEVICE_HEADER]: 'device-users-0001' },
      payload: { name: 'nobody-here', password: 'not the password' },
    });
    expect(typed.statusCode).toBe(401);
    const id = await tenantOf(storage, A1.code);
    const waits = (await everything(storage, A1.code)).filter(({ key }) =>
      key.startsWith(recordKeys.tenant(id).signInWait('')),
    );
    expect(waits).toHaveLength(1);

    expect((await applyCopy(storage, A1, TODAY)).status).toBe('ok');
  });

  it('row 8: a copy whose name, logo, colour, languages or default language its users changed before the first fill is refused, never overwritten', async () => {
    const changes = {
      name: 'Tên khách tự đặt',
      logo: companyConfig('B', B1.company).logo,
      colour: '#112233',
      languages: ['vi'],
      defaultLanguage: 'en',
    };
    for (const [field, value] of Object.entries(changes)) {
      const storage = await fresh();
      const made = await make(storage, B1);
      const root = await asRoot(storage, B1.code, made.password);
      const doc = (await root('GET', ROUTES.config)).json<{ config: object; version: string }>();
      const changed = {
        ...doc.config,
        [field]: value,
        ...(field === 'languages' ? { defaultLanguage: 'vi' } : {}),
      };
      expect(
        (await root('PUT', ROUTES.config, { config: changed, version: doc.version })).statusCode,
      ).toBe(200);
      expect((await root('POST', ROUTES.signOut)).statusCode).toBe(204);
      const id = await tenantOf(storage, B1.code);

      const report = await applyCopy(storage, B1, TODAY);

      expect(report.status).toBe('refused');
      const config = tenantConfigSchema.parse(
        (await storage.getRecord(recordKeys.tenant(id).config))!.data,
      );
      expect(config[field as keyof typeof config]).toEqual(value);
    }
  });

  it('row 8: a list that has more past what was read is not a new client', async () => {
    const storage = await fresh();
    await make(storage, A1);
    const prefix = recordKeys.tenant(await tenantOf(storage, A1.code)).all;
    const long: CStorageClient = {
      ...storage,
      listRecords: async (wanted) => {
        const listed = await storage.listRecords(wanted);
        return wanted === prefix ? { ...listed, more: true } : listed;
      },
    };

    expect((await applyCopy(long, A1, TODAY)).status).toBe('refused');
  });

  it('row 21: a ledger naming another scenario than the mapping is refused, never switched', async () => {
    const storage = await fresh();
    await make(storage, A1);
    const id = await tenantOf(storage, A1.code);
    const wrong = {
      client: 'A',
      scenario: 'S2' as const,
      firstDay: '2026-10-22',
      lastDay: '2026-10-28',
      filled: true,
    };
    await writeLedger(storage, id, wrong, null);
    const before = JSON.stringify(await everything(storage, A1.code));

    const report = await applyCopy(storage, A1, TODAY);

    expect(report.status).toBe('refused');
    expect(report.note).toContain('the ledger names S2, the mapping S1');
    expect(JSON.stringify(await everything(storage, A1.code))).toBe(before);
  });

  it('row 21: a ledger naming another client than the mapping is refused, never switched', async () => {
    const storage = await fresh();
    await make(storage, A1);
    await applyCopy(storage, A1, '2026-10-28');
    const id = await tenantOf(storage, A1.code);
    const found = (await storage.getRecord(recordKeys.tenant(id).seed))!;
    await storage.putRecord(
      recordKeys.tenant(id).seed,
      { ...(found.data as object), client: 'C' },
      found.tag,
    );
    const before = JSON.stringify(await everything(storage, A1.code));

    const report = await applyCopy(storage, A1, TODAY);

    expect(report.status).toBe('refused');
    expect(report.note).toContain('the ledger names client C, the mapping A');
    expect(JSON.stringify(await everything(storage, A1.code))).toBe(before);
  });

  it('applyAll with a partner reaches that partner’s copies alone', async () => {
    const storage = await fresh();
    await make(storage, A1);
    await make(storage, B1);
    const reports = await applyAll(storage, TODAY, () => undefined, 'p1');
    expect(reports.map((r) => [r.code, r.status]).sort()).toEqual([
      [B1.code, 'ok'],
      [A1.code, 'ok'],
    ]);
  });
});

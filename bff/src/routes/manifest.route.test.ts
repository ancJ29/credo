import { randomUUID } from 'node:crypto';
import { configDocSchema, manifestOf, recordKeys, smallAddress } from '@credo/shared';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { type RunningCStorage, startCStorage } from '../../tests/c-storage';
import { staffTenant } from '../../tests/staff';
import { seedTenant } from '../../tests/tenant';
import { startingConfig } from '../records/clients';

let cs: RunningCStorage;
beforeAll(async () => {
  cs = await startCStorage(inject('cStorageBinary'));
});
afterAll(async () => {
  await cs.stop();
});

const company = async () => {
  const t = await staffTenant(cs);
  await t.client.putRecord(
    t.keys.config,
    startingConfig('Ăn Đêm', { description: 'Cơm tối', whiteHeader: true, defaultLanguage: 'en' }),
    null,
  );
  /** The public call: no company header, no sign-in. */
  const fetchManifest = (code: string) =>
    t.app.app.inject({ method: 'GET', url: `/api/manifest/${code}` });
  return { ...t, fetchManifest };
};

describe('A company’s phone-app description', () => {
  it('3: holds the fields of the manifest, from the settings and the icons’ addresses', async () => {
    const t = await company();
    const doc = configDocSchema.parse((await t.rootCall.get('/api/config')).json());
    const large = doc.pictures['app-icon']!.address;

    const served = await t.fetchManifest('acme-co');

    expect(served.statusCode).toBe(200);
    expect(served.json()).toEqual(
      manifestOf('acme-co', doc.config, { small: smallAddress(large), large }),
    );
    expect(served.json()).toMatchObject({
      name: 'Ăn Đêm',
      short_name: 'Ăn Đêm',
      description: 'Cơm tối',
      start_url: '/login?client-code=acme-co',
      display: 'standalone',
      theme_color: '#ffffff',
      lang: 'en',
      icons: [
        { src: `${large}&size=192`, sizes: '192x192' },
        { src: large, sizes: '512x512' },
      ],
    });
  });

  it('4: answers with no sign-in and no company header, as application/manifest+json, never cached; 404 an unknown code, 503 a closed box', async () => {
    const t = await company();

    const served = await t.fetchManifest('acme-co');

    expect(served.headers['content-type']).toContain('application/manifest+json');
    expect(served.headers['cache-control']).toBe('no-cache');
    for (const code of ['no-such-co', 'NOT%20A%20CODE', '..%2Fx']) {
      expect((await t.fetchManifest(code)).statusCode, code).toBe(404);
    }
    // a company made with no settings yet has no manifest to describe
    await seedTenant(t.client, 'bare-co');
    expect((await t.fetchManifest('bare-co')).statusCode).toBe(404);
    await t.client.putRecord(
      recordKeys.client('lost'),
      { id: randomUUID(), name: 'Lost', box: 'b2' },
      null,
    );
    expect((await t.fetchManifest('lost')).statusCode).toBe(503);
  });
});

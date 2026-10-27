import {
  configDocSchema,
  conflictReplySchema,
  MAX_LOGO_BYTES,
  recordKeys,
  type TenantConfig,
} from '@credo/shared';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { type RunningCStorage, startCStorage } from '../tests/c-storage';
import { signIn, tenantWithRoot, withAuth } from '../tests/tenant';

let cs: RunningCStorage;
beforeAll(async () => {
  cs = await startCStorage(inject('cStorageBinary'));
});
afterAll(async () => {
  await cs.stop();
});

const company: TenantConfig = {
  name: 'Công ty Đại Việt',
  logo: null,
  colour: '#2f7d6d',
  languages: ['vi', 'en'],
  defaultLanguage: 'vi',
};

const imageOf = (bytes: number) =>
  `data:image/png;base64,${'A'.repeat(Math.floor(bytes / 3) * 4)}${bytes % 3 === 0 ? '' : bytes % 3 === 1 ? 'AA==' : 'AAA='}`;

async function rootSession() {
  const t = await tenantWithRoot(cs);
  const { body } = await signIn(t.app);
  const save = (config: unknown, version: string | null) =>
    t.app.inject({
      method: 'PUT',
      url: '/api/config',
      headers: withAuth(body.authId),
      payload: { config, version },
    });
  const read = () => t.app.inject({ method: 'GET', url: '/api/config' });
  return { ...t, authId: body.authId, save, read };
}

describe('The root sets the company’s name, logo and brand colour; every screen shows them, sign-in too', () => {
  it('saves the settings and serves them to a caller who has not signed in', async () => {
    const t = await rootSession();
    const logo = imageOf(1000);
    const saved = await t.save({ ...company, logo }, null);
    expect(saved.statusCode).toBe(200);

    const read = await t.read();
    expect(read.statusCode).toBe(200);
    const doc = configDocSchema.parse(read.json());
    expect(doc.config).toEqual({ ...company, logo });
    expect(doc.version).toBe(configDocSchema.parse(saved.json()).version);
  });

  it('answers 404 before the settings exist, and refuses a save by a caller who has not signed in', async () => {
    const t = await rootSession();
    expect((await t.read()).statusCode).toBe(404);
    const anonymous = await t.app.inject({
      method: 'PUT',
      url: '/api/config',
      payload: { config: company, version: null },
    });
    expect(anonymous.statusCode).toBe(401);
    expect(await t.client.getRecord(recordKeys.config)).toBeNull();
  });

  it('keeps the name trimmed', async () => {
    const t = await rootSession();
    await t.save({ ...company, name: '  Công ty Đại Việt  ' }, null);
    expect(configDocSchema.parse((await t.read()).json()).config.name).toBe('Công ty Đại Việt');
  });
});

describe('A config that does not parse is refused on save and stops the boot', () => {
  it('refuses a save that does not parse, 400, and keeps what was stored', async () => {
    const t = await rootSession();
    await t.save(company, null);
    const stored = await t.client.getRecord(recordKeys.config);
    const bad = await t.save({ ...company, colour: 'green' }, stored?.tag ?? null);
    expect(bad.statusCode).toBe(400);
    expect(bad.json<{ details: string }>().details).toContain('colour');
    expect(await t.client.getRecord(recordKeys.config)).toEqual(stored);
  });

  it('refuses a body that is not a config and a bad language set', async () => {
    const t = await rootSession();
    const notObject = await t.app.inject({
      method: 'PUT',
      url: '/api/config',
      headers: { ...withAuth(t.authId), 'content-type': 'application/json' },
      payload: '"not a config"',
    });
    expect(notObject.statusCode).toBe(400);
    expect(notObject.json<{ details: string }>().details).toMatch(/^body: /);
    const noDefault = await t.save({ ...company, languages: ['en'], defaultLanguage: 'vi' }, null);
    expect(noDefault.statusCode).toBe(400);
    expect(await t.client.getRecord(recordKeys.config)).toBeNull();
  });

  it('answers 500 for a stored config that does not parse, never another tenant’s settings', async () => {
    const t = await rootSession();
    await t.client.putRecord(recordKeys.config, { name: 'half a config' });
    const read = await t.read();
    expect(read.statusCode).toBe(500);
    expect(read.json()).toEqual({ error: 'Internal error' });
  });
});

describe('A logo is an image of at most 200 KB; anything else is refused', () => {
  it('saves a logo of exactly 200 KB', async () => {
    const t = await rootSession();
    expect((await t.save({ ...company, logo: imageOf(MAX_LOGO_BYTES) }, null)).statusCode).toBe(
      200,
    );
  });

  it('refuses a logo one byte over, and one that is not an image, and stores nothing', async () => {
    const t = await rootSession();
    for (const logo of [imageOf(MAX_LOGO_BYTES + 1), 'data:text/html;base64,AAAA', 'logo.png']) {
      const refused = await t.save({ ...company, logo }, null);
      expect(refused.statusCode).toBe(400);
    }
    expect(await t.client.getRecord(recordKeys.config)).toBeNull();
  });
});

describe('A save over a newer one is refused, 409, and the page offers the newer one', () => {
  it('refuses a save made from a version that moved and answers the newer settings', async () => {
    const t = await rootSession();
    const first = configDocSchema.parse((await t.save(company, null)).json());
    const second = configDocSchema.parse(
      (await t.save({ ...company, name: 'Saved by another admin' }, first.version)).json(),
    );
    expect(second.version).not.toBe(first.version);

    const stale = await t.save({ ...company, name: 'Saved from the old page' }, first.version);
    expect(stale.statusCode).toBe(409);
    expect(conflictReplySchema.parse(stale.json()).current).toEqual(second);
    expect(configDocSchema.parse((await t.read()).json())).toEqual(second);

    const retried = await t.save({ ...company, name: 'Saved from the old page' }, second.version);
    expect(retried.statusCode).toBe(200);
  });

  it('refuses a first save when settings already exist, and a save of settings that are gone', async () => {
    const t = await rootSession();
    const first = configDocSchema.parse((await t.save(company, null)).json());
    const again = await t.save({ ...company, name: 'Second first save' }, null);
    expect(again.statusCode).toBe(409);
    expect(conflictReplySchema.parse(again.json()).current).toEqual(first);

    await t.client.removeRecord(recordKeys.config);
    const gone = await t.save(company, first.version);
    expect(gone.statusCode).toBe(409);
    expect(conflictReplySchema.parse(gone.json()).current).toBeNull();
  });
});

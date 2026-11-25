import { deflateSync } from 'node:zlib';
import {
  configDocSchema,
  CREDO_COLOUR,
  drawIcon,
  MAX_LOGO_BYTES,
  pngOf,
  pngSides,
  smallAddress,
} from '@credo/shared';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { type RunningCStorage, startCStorage } from '../../tests/c-storage';
import { recordingActivity } from '../../tests/audit';
import { createClient, startingConfig } from '../records/clients';
import { staffTenant } from '../../tests/staff';
import { seedSettings, seedTenant } from '../../tests/tenant';

let cs: RunningCStorage;
beforeAll(async () => {
  cs = await startCStorage(inject('cStorageBinary'));
});
afterAll(async () => {
  await cs.stop();
});

/** A data URL whose payload decodes to exactly `bytes` bytes. */
const image = (bytes: number, type = 'png', fill = 1) =>
  `data:image/${type};base64,${Buffer.alloc(bytes, fill).toString('base64')}`;
const SVG =
  'data:image/svg+xml;base64,' +
  Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').toString(
    'base64',
  );
const TAG = /^[0-9a-f]{64}$/;
const SANDBOX = "default-src 'none'; style-src 'unsafe-inline'; sandbox";

/** A company with its settings, its root signed in, and an activity client that keeps its entries. */
async function company(seeded = true) {
  const activity = recordingActivity();
  const t = await staffTenant(cs, { activity: activity.client });
  if (seeded) await seedSettings(t.client, t.id);
  const save = (kind: string, picture: string | null, version: string | null, small?: string) =>
    t.rootCall.send('PUT', `/api/pictures/${kind}`, { picture, version, small });
  /** The public call: no company header, no sign-in, only the address. */
  const fetchPicture = (address: string) => t.app.app.inject({ method: 'GET', url: address });
  const doc = async () => configDocSchema.parse((await t.rootCall.get('/api/config')).json());
  return { ...t, activity, save, fetchPicture, doc };
}

describe('A picture is a record of its own, served at an address that names the company', () => {
  it('7: a saved picture is answered at its address with its bytes, its type, nosniff, the sandboxing policy and a year’s cache at its tag, no-cache at another', async () => {
    const t = await company();
    const saved = await t.save('logo', image(300), null);

    expect(saved.statusCode).toBe(200);
    const view = configDocSchema.parse(saved.json()).pictures.logo!;
    expect(view.version).toMatch(TAG);
    expect(view.address).toBe(`/api/pictures/acme-co/logo?v=${view.version}`);

    const served = await t.fetchPicture(view.address);
    expect(served.statusCode).toBe(200);
    expect(served.headers['content-type']).toBe('image/png');
    expect(served.rawPayload.equals(Buffer.alloc(300, 1))).toBe(true);
    expect(served.headers['x-content-type-options']).toBe('nosniff');
    expect(served.headers['content-security-policy']).toBe(SANDBOX);
    expect(served.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    for (const other of ['/api/pictures/acme-co/logo?v=old', '/api/pictures/acme-co/logo']) {
      const again = await t.fetchPicture(other);
      expect(again.statusCode).toBe(200);
      expect(again.headers['cache-control']).toBe('no-cache');
      expect(again.headers['content-security-policy']).toBe(SANDBOX);
    }
  });

  it('7: an SVG is answered as an image under the same policy, so its script never runs at the app’s address', async () => {
    const t = await company();
    const view = configDocSchema.parse((await t.save('logo-on-colour', SVG, null)).json()).pictures[
      'logo-on-colour'
    ]!;

    const served = await t.fetchPicture(view.address);

    expect(served.headers['content-type']).toBe('image/svg+xml');
    expect(served.headers['content-security-policy']).toContain('sandbox');
    expect(served.headers['content-security-policy']).toContain("default-src 'none'");
    expect(served.headers['x-content-type-options']).toBe('nosniff');
  });

  it('8: answers 404 for an unknown code, kind or picture, and for a code that is no code, with no sign-in and no company header', async () => {
    const t = await company();
    await t.save('logo', image(10), null);

    for (const url of [
      '/api/pictures/no-such-co/logo',
      '/api/pictures/acme-co/banner',
      '/api/pictures/acme-co/logo-on-colour',
      '/api/pictures/NOT%20A%20CODE/logo',
      '/api/pictures/..%2F..%2Fx/logo',
      '/api/pictures/acme-co',
    ]) {
      expect((await t.fetchPicture(url)).statusCode, url).toBe(404);
    }
    expect((await t.fetchPicture('/api/pictures/acme-co/logo')).statusCode).toBe(200);
  });

  it('13: a company made with a logo holds it as its logo picture, and the operator’s create gives none', async () => {
    const t = await company();
    await createClient(t.client, {
      code: 'logo-co',
      name: 'Logo Co',
      madeAt: 0,
      logo: image(12, 'png', 2),
    });
    await createClient(t.client, { code: 'bare-co', name: 'Bare Co', madeAt: 0 });

    const made = await t.fetchPicture('/api/pictures/logo-co/logo');

    expect(made.rawPayload.equals(Buffer.alloc(12, 2))).toBe(true);
    expect((await t.fetchPicture('/api/pictures/bare-co/logo')).statusCode).toBe(404);
  });

  it('8: a code reaches its own company’s picture and no other’s', async () => {
    const t = await company();
    const otherId = await seedTenant(t.client, 'other-co');
    await t.client.putRecord(
      `tenant.${otherId}.picture.logo`,
      { picture: image(5, 'png', 9) },
      null,
    );
    await t.save('logo', image(7, 'png', 3), null);

    const mine = await t.fetchPicture('/api/pictures/acme-co/logo');
    const theirs = await t.fetchPicture('/api/pictures/other-co/logo');

    expect(mine.rawPayload.equals(Buffer.alloc(7, 3))).toBe(true);
    expect(theirs.rawPayload.equals(Buffer.alloc(5, 9))).toBe(true);
    expect((await t.fetchPicture('/api/pictures/other-co/logo-on-colour')).statusCode).toBe(404);
  });
});

describe('Whoever holds the settings right saves a picture at its choice', () => {
  it('10: takes an image within 200 KB and refuses one byte over, a non-image and a version that is no tag, storing nothing', async () => {
    const t = await company();

    expect((await t.save('logo', image(MAX_LOGO_BYTES), null)).statusCode).toBe(200);
    const stored = (await t.doc()).pictures.logo!;
    for (const [picture, version] of [
      [image(MAX_LOGO_BYTES + 1), stored.version],
      ['data:text/plain;base64,aGk=', stored.version],
      ['not a data url', stored.version],
      [image(10), 'v1'],
    ] as const) {
      expect((await t.save('logo', picture, version)).statusCode).toBe(400);
    }
    expect((await t.save('banner', image(10), null)).statusCode).toBe(404);
    expect((await t.doc()).pictures.logo).toEqual(stored);
  });

  it('10: refuses a person with no settings right, 403, and takes one with it', async () => {
    const t = await company();
    const nobody = await t.staff('NOBODY', { own: { 'staff.canView': true } });
    const editor = await t.staff('EDITOR', { own: { 'settings.canEdit': true } });
    const send = (call: typeof nobody.call) =>
      call.send('PUT', '/api/pictures/logo', { picture: image(10), version: null });

    expect((await send(nobody.call)).statusCode).toBe(403);
    expect((await t.doc()).pictures.logo).toBeNull();
    expect((await send(editor.call)).statusCode).toBe(200);
    expect(
      (await t.app.inject({ method: 'PUT', url: '/api/pictures/logo', payload: {} })).statusCode,
    ).toBe(401);
  });

  it('10: answers 409 with the settings as they are now when the tag moved, or a picture was saved over none, changing nothing', async () => {
    const t = await company();
    await t.save('logo', image(10), null);
    const current = await t.doc();

    const overNone = await t.save('logo', image(20), null);
    const stale = await t.save('logo', image(20), 'a'.repeat(64));
    const unheld = await t.save('logo-on-colour', image(20), 'a'.repeat(64));

    for (const refused of [overNone, stale]) {
      expect(refused.statusCode).toBe(409);
      expect(refused.json()).toEqual({ error: 'Conflict', current });
    }
    expect(unheld.statusCode).toBe(409);
    expect(await t.doc()).toEqual(current);
  });

  it('11: a remove leaves the picture null in the reply and at its address; a stale remove is a 409', async () => {
    const t = await company();
    const first = configDocSchema.parse((await t.save('logo', image(10), null)).json()).pictures
      .logo!;

    expect((await t.save('logo', null, null)).statusCode).toBe(409);
    expect((await t.save('logo', null, 'a'.repeat(64))).statusCode).toBe(409);
    const removed = await t.save('logo', null, first.version);

    expect(removed.statusCode).toBe(200);
    expect(configDocSchema.parse(removed.json()).pictures.logo).toBeNull();
    expect((await t.fetchPicture(first.address)).statusCode).toBe(404);
    // nothing held and none named: nothing to remove, and nothing wrong
    expect((await t.save('logo', null, null)).statusCode).toBe(200);
  });

  it('11: a save of the settings neither reads nor changes a picture', async () => {
    const t = await company();
    const view = configDocSchema.parse((await t.save('logo', image(10), null)).json()).pictures
      .logo!;
    const read = await t.doc();

    const saved = await t.rootCall.send('PUT', '/api/config', {
      config: { ...startingConfig('Acme'), name: 'Renamed' },
      version: read.version,
    });

    expect(saved.statusCode).toBe(200);
    expect(configDocSchema.parse(saved.json()).pictures.logo).toEqual(view);
    expect((await t.fetchPicture(view.address)).statusCode).toBe(200);
  });

  it('7: a picture record that does not parse is a fault, a 500 that names no key', async () => {
    const t = await company();
    await t.client.putRecord(t.keys.picture('logo'), { picture: 'not an image' }, null);

    const served = await t.fetchPicture('/api/pictures/acme-co/logo');

    expect(served.statusCode).toBe(500);
    expect(served.body).not.toContain('picture.logo');
  });

  it('10: a company with no settings yet answers a save 404, not set up', async () => {
    const t = await staffTenant(cs);

    const saved = await t.rootCall.send('PUT', '/api/pictures/logo', {
      picture: image(10),
      version: null,
    });

    expect(saved.statusCode).toBe(404);
  });

  it('12: no activity entry of a picture’s save or of a settings save holds a picture’s bytes', async () => {
    const t = await company();
    const view = configDocSchema.parse((await t.save('logo', image(400), null)).json()).pictures
      .logo!;
    await t.save('logo', null, view.version);
    await t.save('logo-on-colour', SVG, null);
    const read = await t.doc();
    await t.rootCall.send('PUT', '/api/config', {
      config: { ...startingConfig('Acme'), name: 'Renamed' },
      version: read.version,
    });
    // the entries are sent after the answer
    await new Promise((resolve) => setTimeout(resolve, 100));

    const mine = t.activity.entries.filter((entry) => entry.action === 'config.picture');
    expect(mine).toHaveLength(3);
    expect(t.activity.entries.some((entry) => entry.action === 'config.save')).toBe(true);
    expect(JSON.stringify(t.activity.entries)).not.toContain('base64');
  });
});

describe('A stored logo moves to a picture of its own at the settings’ first read', () => {
  /** A company whose settings are stored as they were before the pictures: the logo inline. */
  async function older(logo: string | null, ...more: [string, unknown][]) {
    const t = await company(false);
    const stored = { ...startingConfig('Acme'), logo };
    await t.client.putRecord(t.keys.config, stored, null);
    for (const [key, data] of more) await t.client.putRecord(key, data, null);
    const read = () =>
      t.app.app.inject({
        method: 'GET',
        url: '/api/config',
        headers: { 'x-client-code': 'acme-co' },
      });
    const settingsNow = async () => (await t.client.getRecord(t.keys.config))!;
    return { ...t, read, settingsNow, stored };
  }

  it('1: moves a stored logo at the first read: its picture holds the same data URL, the settings hold no logo, the reply names it', async () => {
    const logo = image(300, 'png', 4);
    const t = await older(logo);

    const answered = await t.read();

    expect(answered.statusCode).toBe(200);
    const doc = configDocSchema.parse(answered.json());
    expect(doc.config).not.toHaveProperty('logo');
    expect((await t.client.getRecord(t.keys.picture('logo')))?.data).toEqual({ picture: logo });
    expect((await t.settingsNow()).data).not.toHaveProperty('logo');
    const view = doc.pictures.logo!;
    expect(view.address).toBe(`/api/pictures/acme-co/logo?v=${view.version}`);
    expect((await t.fetchPicture(view.address)).rawPayload.equals(Buffer.alloc(300, 4))).toBe(true);
    // the move is no one's change: no entry, and a save after it holds no bytes
    expect(t.activity.entries).toEqual([]);
    const saved = await t.rootCall.send('PUT', '/api/config', {
      config: { ...doc.config, name: 'Renamed' },
      version: doc.version,
    });
    expect(saved.statusCode).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(JSON.stringify(t.activity.entries)).not.toContain('base64');
  });

  it('2: a move stopped after the picture’s write loses nothing: the next read finishes it', async () => {
    const logo = image(100, 'png', 5);
    const t = await older(logo);
    const key = t.keys.picture('logo');
    await t.client.putRecord(key, { picture: logo }, null);

    const doc = configDocSchema.parse((await t.read()).json());

    expect(doc.pictures.logo).not.toBeNull();
    expect((await t.settingsNow()).data).not.toHaveProperty('logo');
    expect((await t.client.getRecord(key))?.data).toEqual({ picture: logo });
  });

  it('3: a picture already stored is kept over an older inline logo', async () => {
    const t = await older(image(100, 'png', 5));
    await t.client.putRecord(t.keys.picture('logo'), { picture: image(50, 'png', 8) }, null);

    const doc = configDocSchema.parse((await t.read()).json());

    expect((await t.client.getRecord(t.keys.picture('logo')))?.data).toEqual({
      picture: image(50, 'png', 8),
    });
    expect(
      (await t.fetchPicture(doc.pictures.logo!.address)).rawPayload.equals(Buffer.alloc(50, 8)),
    ).toBe(true);
    expect((await t.settingsNow()).data).not.toHaveProperty('logo');
  });

  it('4: two reads at once move it once, both replies naming the same picture', async () => {
    const t = await older(image(100, 'png', 6));

    const [first, second] = await Promise.all([t.read(), t.read()]);

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual(first.json());
    expect(configDocSchema.parse(first.json()).pictures.logo).not.toBeNull();
    expect((await t.settingsNow()).data).not.toHaveProperty('logo');
  });

  it('5: a stored logo of null is dropped and no picture made; the new shape is read with no write', async () => {
    const t = await older(null);

    const first = configDocSchema.parse((await t.read()).json());
    const after = await t.settingsNow();
    const again = configDocSchema.parse((await t.read()).json());

    expect(first.pictures).toMatchObject({
      logo: null,
      'logo-on-colour': null,
      'tab-icon': { version: '' },
      'app-icon': { version: '' },
    });
    expect(after.data).not.toHaveProperty('logo');
    expect(await t.client.getRecord(t.keys.picture('logo'))).toBeNull();
    expect(again.version).toBe(after.tag);
    expect((await t.settingsNow()).tag).toBe(after.tag);
  });
});

/** The drawn icon of the seeded company, as the BFF draws it, `side` pixels square. */
const drawn = (side: number) =>
  Buffer.from(
    pngOf(drawIcon({ name: 'Acme', code: 'acme-co', colour: CREDO_COLOUR }, side), (raw) =>
      deflateSync(raw),
    ),
  );
/** An uploaded icon: a PNG `side` pixels square in another colour, as the browser makes it, a data URL. */
const upload = (side: number, colour = '#b5472a') =>
  `data:image/png;base64,${Buffer.from(
    pngOf(drawIcon({ name: 'Bee', code: 'bee', colour }, side), (raw) => deflateSync(raw)),
  ).toString('base64')}`;

describe('The tab icon and the phone-app icon are two more kinds of picture', () => {
  it('5: an icon’s address answers the stored PNG at its tag, the 192 at size=192, and the drawn icon where none is stored, never cached', async () => {
    const t = await company();
    const tab = upload(64);
    const big = upload(512);
    const small = upload(192, '#2a7ab5');

    const before = (await t.doc()).pictures;
    expect((await t.fetchPicture(before['tab-icon']!.address)).rawPayload.equals(drawn(64))).toBe(
      true,
    );
    const drawnApp = await t.fetchPicture(before['app-icon']!.address);
    expect(drawnApp.headers['content-type']).toBe('image/png');
    expect(drawnApp.headers['cache-control']).toBe('no-cache');
    expect(drawnApp.headers['x-content-type-options']).toBe('nosniff');
    expect(drawnApp.headers['content-security-policy']).toBe(SANDBOX);
    expect(drawnApp.rawPayload.equals(drawn(512))).toBe(true);
    expect(
      (await t.fetchPicture(smallAddress(before['app-icon']!.address))).rawPayload.equals(
        drawn(192),
      ),
    ).toBe(true);

    expect((await t.save('tab-icon', tab, null)).statusCode).toBe(200);
    expect((await t.save('app-icon', big, null, small)).statusCode).toBe(200);
    const after = (await t.doc()).pictures;
    const bytes = (url: string) => Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
    const served = await t.fetchPicture(after['tab-icon']!.address);
    expect(served.headers['content-type']).toBe('image/png');
    expect(served.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(served.rawPayload.equals(bytes(tab))).toBe(true);
    expect((await t.fetchPicture(after['app-icon']!.address)).rawPayload.equals(bytes(big))).toBe(
      true,
    );
    expect(
      (await t.fetchPicture(smallAddress(after['app-icon']!.address))).rawPayload.equals(
        bytes(small),
      ),
    ).toBe(true);
    // size=192 asks only the phone-app icon's second size; the tab icon has the one
    expect(
      (await t.fetchPicture(`${after['tab-icon']!.address}&size=192`)).rawPayload.equals(
        bytes(tab),
      ),
    ).toBe(true);
    expect(pngSides(new Uint8Array(drawn(64)))).toEqual({ width: 64, height: 64 });
    // a company with no settings has none to draw from
    await seedTenant(t.client, 'bare-co');
    expect((await t.fetchPicture('/api/pictures/bare-co/tab-icon')).statusCode).toBe(404);
  });

  it('6: an icon’s save takes PNGs of the kind’s sides within 200 KB; refuses another side, another type, a byte over (400), no right (403), a moved version (409)', async () => {
    const t = await company();
    const nobody = await t.staff('NOBODY', { own: { 'staff.canView': true } });
    const jpeg = upload(64).replace('image/png', 'image/jpeg');
    const filler = `data:image/png;base64,${Buffer.concat([
      Buffer.from(upload(64).slice(22), 'base64'),
      Buffer.alloc(MAX_LOGO_BYTES),
    ]).toString('base64')}`;

    for (const [kind, picture, small] of [
      ['tab-icon', upload(128), undefined],
      ['tab-icon', jpeg, undefined],
      ['tab-icon', filler, undefined],
      ['tab-icon', upload(64), upload(64)],
      ['app-icon', upload(512), undefined],
      ['app-icon', upload(512), upload(512)],
      ['app-icon', upload(256), upload(192)],
      ['logo', image(10), upload(64)],
    ] as const) {
      expect(
        (await t.save(kind, picture, null, small)).statusCode,
        `${kind} ${small?.length}`,
      ).toBe(400);
    }
    expect((await t.save('tab-icon', null, null, upload(64))).statusCode).toBe(400);
    expect(
      (
        await nobody.call.send('PUT', '/api/pictures/tab-icon', {
          picture: upload(64),
          version: null,
        })
      ).statusCode,
    ).toBe(403);
    expect((await t.doc()).pictures['tab-icon']!.version).toBe('');

    const first = await t.save('tab-icon', upload(64), null);
    expect(first.statusCode).toBe(200);
    const view = configDocSchema.parse(first.json()).pictures['tab-icon']!;
    expect(view.version).toMatch(/^[0-9a-f]{64}$/);
    // over a moved version: 409, and a remove brings back the drawn icon
    expect((await t.save('tab-icon', upload(64, '#000000'), 'a'.repeat(64))).statusCode).toBe(409);
    const removed = configDocSchema.parse((await t.save('tab-icon', null, view.version)).json());
    expect(removed.pictures['tab-icon']!.version).toBe('');
    expect(
      (await t.fetchPicture(removed.pictures['tab-icon']!.address)).rawPayload.equals(drawn(64)),
    ).toBe(true);
  });

  it('7: the settings’ reply names each icon: the stored one’s tag, else the drawn one at the settings’ version', async () => {
    const t = await company();
    const settings = await t.doc();
    const names = (doc: typeof settings, kind: 'tab-icon' | 'app-icon') => doc.pictures[kind]!;

    expect(names(settings, 'tab-icon')).toEqual({
      address: `/api/pictures/acme-co/tab-icon?v=${settings.version}`,
      version: '',
    });
    expect(names(settings, 'app-icon').address).toBe(
      `/api/pictures/acme-co/app-icon?v=${settings.version}`,
    );

    await t.save('tab-icon', upload(64), null);
    const stored = names(await t.doc(), 'tab-icon');
    expect(stored.version).toMatch(/^[0-9a-f]{64}$/);
    expect(stored.address).toBe(`/api/pictures/acme-co/tab-icon?v=${stored.version}`);
    expect(names(await t.doc(), 'app-icon').version).toBe('');
  });
});

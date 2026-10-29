import { MAX_PHOTO_BYTES, photoReplySchema } from '@credo/shared';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { type RunningCStorage, startCStorage } from '../tests/c-storage';
import { personCalls, staffTenant } from '../tests/staff';
import { seedEmployee } from '../tests/tenant';

let cs: RunningCStorage;
beforeAll(async () => {
  cs = await startCStorage(inject('cStorageBinary'));
});
afterAll(async () => {
  await cs.stop();
});

const { added } = personCalls;

/** A data URL whose payload decodes to exactly `bytes` bytes. */
const image = (bytes: number, type = 'png', fill = 1) =>
  `data:image/${type};base64,${Buffer.alloc(bytes, fill).toString('base64')}`;

const url = (id: string) => `/api/employees/${id}/photo`;

describe('Someone allowed to change a person crops and saves a square photo, made small by the app, shown on the person’s page; the list shows initials', () => {
  it('answers no photo, null and an empty version, never a 404, for a person with none, and 404 for no one', async () => {
    const t = await staffTenant(cs);
    const reply = await added(t.rootCall);

    const none = await t.rootCall.get(url(reply.employee.employee.id));

    expect(none.statusCode).toBe(200);
    expect(photoReplySchema.parse(none.json())).toEqual({ photo: null, version: '' });
    expect((await t.rootCall.get(url('3f2a91bc-0000-4000-8000-000000000001'))).statusCode).toBe(
      404,
    );
    expect((await t.rootCall.get(url('not-an-id'))).statusCode).toBe(404);
  });

  it('saves a photo over no version, answers it with the version it is at, and reads it back; a save over that version replaces it', async () => {
    const t = await staffTenant(cs);
    const id = (await added(t.rootCall)).employee.employee.id;

    const first = await t.rootCall.send('PUT', url(id), { photo: image(100), version: '' });
    expect(first.statusCode).toBe(200);
    const saved = photoReplySchema.parse(first.json());
    expect(saved.photo).toBe(image(100));
    expect(saved.version).toMatch(/^[0-9a-f]{64}$/);
    expect(photoReplySchema.parse((await t.rootCall.get(url(id))).json())).toEqual(saved);

    const second = await t.rootCall.send('PUT', url(id), {
      photo: image(200, 'jpeg'),
      version: saved.version,
    });
    expect(second.statusCode).toBe(200);
    expect(photoReplySchema.parse(second.json())).toMatchObject({ photo: image(200, 'jpeg') });
    expect(photoReplySchema.parse((await t.rootCall.get(url(id))).json()).photo).toBe(
      image(200, 'jpeg'),
    );
  });

  it('keeps a photo with the person’s id in its own record, apart from the person’s', async () => {
    const t = await staffTenant(cs);
    const reply = await added(t.rootCall);
    const id = reply.employee.employee.id;
    await t.rootCall.send('PUT', url(id), { photo: image(100), version: '' });

    expect((await t.client.getRecord(t.keys.employeePhoto(id)))?.data).toEqual({
      photo: image(100),
    });
    // The person's version is the person's alone: a photo moves nothing of theirs.
    expect((await personCalls.doc(t.rootCall, id)).version).toBe(reply.employee.version);
    expect(await personCalls.codes(t.rootCall)).toEqual(['EMP-1']);
  });

  it('answers 409 with the photo as it is now when the version moved, or when one was saved over none, and changes nothing', async () => {
    const t = await staffTenant(cs);
    const id = (await added(t.rootCall)).employee.employee.id;
    const saved = photoReplySchema.parse(
      (await t.rootCall.send('PUT', url(id), { photo: image(100), version: '' })).json(),
    );

    const none = await t.rootCall.send('PUT', url(id), { photo: image(300), version: '' });
    const stale = await t.rootCall.send('PUT', url(id), {
      photo: image(300),
      version: 'a'.repeat(64),
    });

    for (const refused of [none, stale]) {
      expect(refused.statusCode).toBe(409);
      expect(refused.json()).toEqual({ error: 'Conflict', current: saved });
    }
    expect(photoReplySchema.parse((await t.rootCall.get(url(id))).json())).toEqual(saved);
  });

  it('answers 409 with no current photo when a version is named for a person who has none', async () => {
    const t = await staffTenant(cs);
    const id = (await added(t.rootCall)).employee.employee.id;

    const stale = await t.rootCall.send('PUT', url(id), {
      photo: image(100),
      version: 'a'.repeat(64),
    });

    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toEqual({ error: 'Conflict', current: { photo: null, version: '' } });
  });

  it('lets whoever may see the staff read a photo and whoever may change a person save one, and no one else', async () => {
    const t = await staffTenant(cs);
    const id = (await added(t.rootCall)).employee.employee.id;
    await t.rootCall.send('PUT', url(id), { photo: image(100), version: '' });
    const viewer = await t.staff('VIEWER', { own: { 'staff.canView': true } });
    const editor = await t.staff('EDITOR', { own: { 'staff.canEdit': true } });
    const nobody = await t.staff('NOBODY', { own: { 'staff.canCreate': true } });
    const held = photoReplySchema.parse((await t.rootCall.get(url(id))).json());

    expect((await viewer.call.get(url(id))).statusCode).toBe(200);
    expect(
      (await viewer.call.send('PUT', url(id), { photo: image(5), version: held.version }))
        .statusCode,
    ).toBe(403);
    expect((await editor.call.get(url(id))).statusCode).toBe(403);
    expect(
      (await editor.call.send('PUT', url(id), { photo: image(5), version: held.version }))
        .statusCode,
    ).toBe(200);
    expect((await nobody.call.get(url(id))).statusCode).toBe(403);
    expect(
      (await nobody.call.send('PUT', url(id), { photo: image(5), version: held.version }))
        .statusCode,
    ).toBe(403);
    expect((await t.app.inject({ method: 'GET', url: url(id) })).statusCode).toBe(401);
  });

  it('answers 404 to a save for no one, writing nothing', async () => {
    const t = await staffTenant(cs);
    const ghost = '3f2a91bc-0000-4000-8000-000000000001';

    const saved = await t.rootCall.send('PUT', url(ghost), { photo: image(100), version: '' });

    expect(saved.statusCode).toBe(404);
    expect(await t.client.getRecord(t.keys.employeePhoto(ghost))).toBeNull();
  });
});

describe('A photo is an image of at most 50 KB in its own record; anything else is a 400', () => {
  it('refuses a photo over 50 KB, one that is not a JPEG, PNG or WebP image data URL, and a version that is no tag, 400, and stores nothing', async () => {
    const t = await staffTenant(cs);
    const id = (await added(t.rootCall)).employee.employee.id;
    const bodies = [
      { photo: image(MAX_PHOTO_BYTES + 1), version: '' },
      { photo: image(10, 'svg+xml'), version: '' },
      { photo: image(10, 'gif'), version: '' },
      { photo: 'https://example.com/me.png', version: '' },
      { photo: '', version: '' },
      { photo: image(10), version: 'not a tag' },
      { photo: image(10) },
      { photo: image(10), version: '', extra: 1 },
    ];

    for (const body of bodies) {
      expect((await t.rootCall.send('PUT', url(id), body)).statusCode).toBe(400);
    }
    expect(
      (await t.rootCall.send('PUT', url(id), { photo: image(MAX_PHOTO_BYTES), version: '' }))
        .statusCode,
    ).toBe(200);
    expect(await t.client.getRecord(t.keys.employeePhoto(id))).not.toBeNull();
  });

  it('answers 500 for a stored photo that does not parse, logging its kind and never its key', async () => {
    const lines: string[] = [];
    const t = await staffTenant(cs, {
      logger: { stream: { write: (line: string) => void lines.push(line) } },
    });
    const { employee } = await seedEmployee(t.client, t.id, { code: 'EMP-9' });
    await t.client.putRecord(t.keys.employeePhoto(employee.id), { photo: 'not an image' });

    const reply = await t.rootCall.get(url(employee.id));

    expect(reply.statusCode).toBe(500);
    expect(reply.json()).toEqual({ error: 'Internal error' });
    const log = lines.join('\n');
    expect(log).toContain('a photo record does not parse');
    expect(log).not.toContain('employee-photo');
  });
});

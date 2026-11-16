import { clientListReplySchema, moveClientReplySchema } from '@credo/shared';
import { describe, expect, it } from 'vitest';
import { ApiError } from './api';
import { createFakeApi, parseCue } from './fake';

const fake = (cue = '', operator: string | null = 'fake.operator') =>
  createFakeApi({
    device: { authId: () => null, operatorAuthId: () => operator },
    cue: parseCue(cue || null),
    signIns: false,
    drift: false,
  });

const CONFIRM = {
  token: 'fake.token',
  response: {
    id: 'cred',
    rawId: 'cred',
    type: 'public-key' as const,
    response: { clientDataJSON: 'x', authenticatorData: 'y', signature: 'z' },
    clientExtensionResults: {},
  },
};

const status = async (answer: Promise<unknown>) =>
  await answer.then(
    () => 'answered',
    (error: unknown) => (error instanceof ApiError ? error.status : 'not an ApiError'),
  );

describe('the fake’s move of a company', () => {
  it('C14: A move answers a wait, two copy presses, the switch’s wait and a sweep, each in the route’s shape, and the boxes then count it on the new one', async () => {
    const api = fake();
    const begun = await api.moveClient('hoa-sen', { to: 'b2', confirm: CONFIRM });
    const answers = [begun];
    for (let n = 0; n < 4; n += 1) answers.push(await api.moveClient('hoa-sen', {}));

    expect(answers.map((answer) => answer.phase)).toEqual([
      'waiting',
      'copying',
      'switched',
      'sweeping',
      'done',
    ]);
    for (const answer of answers)
      expect(moveClientReplySchema.safeParse(answer).success).toBe(true);
    const boxes = await api.operatorBoxes();
    expect(boxes[1].companies).toBe(1);
    const listed = await api.listClients();
    expect(clientListReplySchema.safeParse({ clients: listed }).success).toBe(true);
    expect(listed.find((one) => one.code === 'hoa-sen')).toMatchObject({ box: 'b2' });
    expect(listed.find((one) => one.code === 'hoa-sen')?.move).toBeUndefined();
  });

  it('C14: The list shows the mark while it goes, copying to the new box and sweeping the old one after the switch', async () => {
    const api = fake();
    await api.moveClient('hoa-sen', { to: 'b2', confirm: CONFIRM });
    const mark = async () => (await api.listClients()).find((one) => one.code === 'hoa-sen');

    expect(await mark()).toMatchObject({ move: { form: 'copying', box: 'b2' } });
    await api.moveClient('hoa-sen', {});
    await api.moveClient('hoa-sen', {});
    expect(await mark()).toMatchObject({ box: 'b2', move: { form: 'sweeping', box: 'home' } });
  });

  it('C14: A stop before the switch keeps the company on its old box and sweeps the new one; after it a stop is refused', async () => {
    const api = fake();
    await api.moveClient('hoa-sen', { to: 'b2', confirm: CONFIRM });
    expect(await api.moveClient('hoa-sen', { stop: true })).toMatchObject({ phase: 'stopped' });
    expect(await status(api.moveClient('hoa-sen', { stop: true }))).toBe(409);
    const marked = (await api.listClients()).find((one) => one.code === 'hoa-sen');
    expect(marked).toMatchObject({ move: { form: 'sweeping', box: 'b2' } });
    expect(await api.moveClient('hoa-sen', {})).toMatchObject({ phase: 'sweeping' });
    expect(await api.moveClient('hoa-sen', {})).toEqual({ phase: 'done' });
    expect((await api.operatorBoxes())[1].companies).toBe(0);

    await api.moveClient('binh-an', { to: 'b2', confirm: CONFIRM });
    await api.moveClient('binh-an', {});
    await api.moveClient('binh-an', {});
    expect(await status(api.moveClient('binh-an', { stop: true }))).toBe(409);
  });

  it('C14: A move back to the home box leaves the company on no box of its own', async () => {
    const api = fake();
    await api.moveClient('hoa-sen', { to: 'b2', confirm: CONFIRM });
    for (let n = 0; n < 4; n += 1) await api.moveClient('hoa-sen', {});
    await api.moveClient('hoa-sen', { to: 'home', confirm: CONFIRM });
    for (let n = 0; n < 4; n += 1) await api.moveClient('hoa-sen', {});

    expect((await api.operatorBoxes())[1].companies).toBe(0);
  });

  it('C14: The beginning refuses no operator, an unknown company, a bad body, a box not held, its own box and a move already begun; a press with no move is a 404', async () => {
    expect(await status(fake('', null).moveClient('hoa-sen', {}))).toBe(401);
    const api = fake();
    expect(await status(api.moveClient('nobody', {}))).toBe(404);
    expect(await status(api.moveClient('hoa-sen', { to: 'b2' } as never))).toBe(400);
    expect(await status(api.moveClient('hoa-sen', { to: 'b9', confirm: CONFIRM }))).toBe(400);
    expect(await status(api.moveClient('hoa-sen', { to: 'home', confirm: CONFIRM }))).toBe(400);
    expect(await status(api.moveClient('hoa-sen', {}))).toBe(404);
    await api.moveClient('hoa-sen', { to: 'b2', confirm: CONFIRM });
    expect(await status(api.moveClient('hoa-sen', { to: 'b2', confirm: CONFIRM }))).toBe(409);
  });

  it('C14: A cue makes a press fail once, and the move goes on from where it was', async () => {
    const api = fake('moveClient:503');
    expect(await status(api.moveClient('hoa-sen', { to: 'b2', confirm: CONFIRM }))).toBe(503);
    expect(await api.moveClient('hoa-sen', { to: 'b2', confirm: CONFIRM })).toMatchObject({
      phase: 'waiting',
    });
  });
});

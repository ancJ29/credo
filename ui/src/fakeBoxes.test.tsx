import { boxesReplySchema } from '@credo/shared';
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

describe('the fake’s boxes', () => {
  it('C9: The fake answers two boxes in the shape the route will, the home box holding the data set’s companies', async () => {
    const api = fake();
    const { boxes } = { boxes: await api.operatorBoxes() };

    expect(boxesReplySchema.safeParse({ boxes }).success).toBe(true);
    expect(boxes.map((box) => box.name)).toEqual(['home', 'b2']);
    expect(boxes[0].companies).toBeGreaterThan(0);
    expect(boxes[1]).toMatchObject({ companies: 0 });
    expect(boxes[1].freeBytes).toBeGreaterThan(boxes[0].freeBytes!);
  });

  it('C9: A company made on the second box is counted there, one made on the home box or with none there', async () => {
    const api = fake();
    const before = await api.operatorBoxes();

    await api.makeClient('on-b2', 'On B2', 'b2');
    await api.makeClient('on-home', 'On home', 'home');
    await api.makeClient('on-none', 'On none');

    const after = await api.operatorBoxes();
    expect(after[1].companies).toBe(1);
    expect(after[0].companies).toBe(before[0].companies + 2);
  });

  it('C9: No operator signed in is a 401, and a cue answers its status once', async () => {
    await expect(fake('', null).operatorBoxes()).rejects.toMatchObject({ status: 401 });
    const down = fake('operatorBoxes:503');
    await expect(down.operatorBoxes()).rejects.toBeInstanceOf(ApiError);
    await expect(down.operatorBoxes()).resolves.toHaveLength(2);
  });
});

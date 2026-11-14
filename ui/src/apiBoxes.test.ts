import { describe, expect, it } from 'vitest';
import { ApiError, createApi } from './api';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function fake(...answers: Response[]) {
  const calls: { path: string; init: RequestInit }[] = [];
  const api = createApi({
    deviceId: 'device-0001',
    clientCode: () => null,
    authId: () => null,
    operatorAuthId: () => 'device-0001.operator',
    fetch: (path, init) => {
      calls.push({ path: path instanceof Request ? path.url : path.toString(), init: init ?? {} });
      return Promise.resolve(answers.shift() ?? new Response('{}', { status: 500 }));
    },
  });
  return { api, calls };
}

describe('the boxes calls', () => {
  it('C9: The boxes are read from the operator’s route with the operator’s handle', async () => {
    const boxes = [{ name: 'home', companies: 2, freeBytes: 5 }];
    const { api, calls } = fake(json({ boxes }));

    expect(await api.operatorBoxes()).toEqual(boxes);
    expect(calls[0]?.path).toBe('/api/operator/boxes');
    expect(calls[0]?.init.method).toBe('GET');
  });

  it('C9: A refused read is an error with its status', async () => {
    const { api } = fake(json({ error: 'x' }, 503));

    await expect(api.operatorBoxes()).rejects.toEqual(new ApiError(503));
  });

  it('C9: A company made sends its box only when one is given', async () => {
    const made = { link: '/l', rootName: 'root', password: 'p' };
    const { api, calls } = fake(json(made, 201), json(made, 201));

    await api.makeClient('acme', 'Acme');
    await api.makeClient('acme', 'Acme', 'b2');

    expect(JSON.parse(calls[0]?.init.body as string)).toEqual({ code: 'acme', name: 'Acme' });
    expect(JSON.parse(calls[1]?.init.body as string)).toEqual({
      code: 'acme',
      name: 'Acme',
      box: 'b2',
    });
  });
});

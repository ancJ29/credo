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

describe('the move call', () => {
  it('C14: A press is a POST on the client’s move path with the operator’s handle, and the answer is read by its schema', async () => {
    const { api, calls } = fake(json({ phase: 'waiting', seconds: 15 }), json({ phase: 'done' }));

    expect(await api.moveClient('acme-vn', { stop: true })).toEqual({
      phase: 'waiting',
      seconds: 15,
    });
    expect(await api.moveClient('acme-vn', {})).toEqual({ phase: 'done' });
    expect(calls[0]?.path).toBe('/api/operator/clients/acme-vn/move');
    expect(calls[0]?.init.method).toBe('POST');
    expect(JSON.parse(calls[0]?.init.body as string)).toEqual({ stop: true });
  });

  it('C14: A refused press is an error with its status', async () => {
    const { api } = fake(json({ error: 'x' }, 409));

    await expect(api.moveClient('acme-vn', {})).rejects.toEqual(new ApiError(409));
  });
});

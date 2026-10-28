import { describe, expect, it } from 'vitest';
import { ensureService } from './register';

const service = { code: 'demo', accessKey: 'service-key' };
const connection = (call: typeof fetch) => ({
  baseUrl: 'http://cs.test',
  internalAccessKey: 'internal-key',
  superAdminKey: 'admin-key',
  fetch: call,
});

/** A fetch that answers each call in turn, recording `METHOD path`. */
function fake(...statuses: number[]) {
  const seen: string[] = [];
  const call: typeof fetch = (url, init) => {
    seen.push(
      `${init?.method} ${new URL(url instanceof Request ? url.url : url.toString()).pathname}`,
    );
    return Promise.resolve(new Response('{}', { status: statuses.shift() ?? 500 }));
  };
  return { seen, call };
}

describe('registering the BFF’s service', () => {
  it('registers a new service and asks nothing more', async () => {
    const { seen, call } = fake(201);

    await ensureService(connection(call), service);

    expect(seen).toEqual(['POST /api/services/register']);
  });

  it('Reads a 409 by its status, and checks the key before calling the service registered', async () => {
    const { seen, call } = fake(409, 404);

    await ensureService(connection(call), service);

    expect(seen).toEqual(['POST /api/services/register', 'GET /api/records/demo/client.demo']);
  });

  it('stops when the code is taken under a key that is not ours', async () => {
    const { call } = fake(409, 403);

    await expect(ensureService(connection(call), service)).rejects.toThrow(
      'exists, and c-storage refuses the key',
    );
  });

  it('stops on any other refusal to register', async () => {
    const { call } = fake(401);

    await expect(ensureService(connection(call), service)).rejects.toMatchObject({ status: 401 });
  });
});

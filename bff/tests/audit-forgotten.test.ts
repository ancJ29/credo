import type { CStorageClient } from '@credo/shared';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';

/** An app with one route added that carries an action, answering `status` and declaring nothing. */
function appWith(status: number) {
  const lines: Record<string, unknown>[] = [];
  const app = buildApp({
    storage: {} as CStorageClient,
    now: () => 0,
    origin: 'http://localhost',
    serviceKey: 'k',
    logger: {
      level: 'error',
      stream: { write: (line: string) => void lines.push(JSON.parse(line) as never) },
    },
  });
  app.get('/forgot', { config: { audit: 'customer.save' } }, (_request, reply) =>
    reply.status(status).send({}),
  );
  return { app, lines };
}

describe('A route that carries an action and declares no entry', () => {
  it('is logged as an error when it answers below 400, naming the action and the route', async () => {
    const { app, lines } = appWith(200);

    const reply = await app.inject({ method: 'GET', url: '/forgot' });

    expect(reply.statusCode).toBe(200);
    expect(lines).toEqual([
      expect.objectContaining({
        msg: 'audit route answered with no entry declared',
        action: 'customer.save',
        url: '/forgot',
      }),
    ]);
  });

  it('is not logged when it answers with a refusal, which changed nothing', async () => {
    const { app, lines } = appWith(403);

    await app.inject({ method: 'GET', url: '/forgot' });

    expect(lines).toEqual([]);
  });
});

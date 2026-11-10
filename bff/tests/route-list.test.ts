import type { CStorageClient } from '@credo/shared';
import type { RouteOptions } from 'fastify';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';

const CHANGES = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Every route Fastify registers, as it registers it: the app is built, never started. */
function registered() {
  const routes: RouteOptions[] = [];
  buildApp({
    storage: {} as CStorageClient,
    now: () => 0,
    origin: 'http://localhost',
    serviceKey: 'k',
    logger: false,
    onRoute: (route) => routes.push(route),
  });
  return routes.flatMap((route) =>
    [route.method].flat().flatMap((method) =>
      CHANGES.has(method)
        ? [
            {
              name: `${method} ${route.url}`,
              audit: route.config?.audit,
              exempt: route.config?.exempt,
            },
          ]
        : [],
    ),
  );
}

describe('The route list: every route that changes data writes an entry or says why not', () => {
  const changing = registered();

  it('lists the routes, and each one declares an entry or names its exemption, never both', () => {
    expect(changing.length).toBeGreaterThan(0);
    const neither = changing.filter((one) => !one.audit && !one.exempt).map((one) => one.name);
    expect(
      neither,
      'a route that changes data declares config.audit or names config.exempt',
    ).toEqual([]);
    const both = changing.filter((one) => one.audit && one.exempt).map((one) => one.name);
    expect(both).toEqual([]);
  });

  it('counts the routes as declared plus exempt', () => {
    const declared = changing.filter((one) => one.audit);
    const exempt = changing.filter((one) => one.exempt);
    expect(declared.length + exempt.length).toBe(changing.length);
    expect({ declared: declared.length, exempt: exempt.length, total: changing.length }).toEqual({
      declared: 30,
      exempt: 15,
      total: 45,
    });
  });

  it('names every exemption with a reason of its own words, and every action in the shared list', async () => {
    const { ACTIONS } = await import('@credo/shared');
    for (const one of changing) {
      if (one.exempt) expect(one.exempt.length, one.name).toBeGreaterThan(15);
      if (one.audit) expect(Object.keys(ACTIONS), one.name).toContain(one.audit);
    }
  });

  it('exempts only the routes that change no client’s data: sign-in, sign-out and the operator’s own account', () => {
    expect(
      changing
        .filter((one) => one.exempt)
        .map((one) => one.name)
        .sort(),
    ).toEqual([
      'DELETE /api/operator/operators/:id',
      'DELETE /api/operator/passkeys/:id',
      'POST /api/auth/sign-in',
      'POST /api/auth/sign-in-qr',
      'POST /api/auth/sign-out',
      'POST /api/operator/join',
      'POST /api/operator/join/options',
      'POST /api/operator/operators',
      'POST /api/operator/operators/:id/link',
      'POST /api/operator/passkey/options',
      'POST /api/operator/passkey/sign-in',
      'POST /api/operator/passkeys',
      'POST /api/operator/passkeys/confirm-options',
      'POST /api/operator/passkeys/options',
      'POST /api/operator/sign-out',
    ]);
  });
});

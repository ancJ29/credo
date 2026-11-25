import { clientCodeSchema, type ConfigDoc, manifestOf, ROUTES, smallAddress } from '@credo/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { HttpError } from '../errors';
import type { TenantStorage } from '../records/records';
import { paramsOf } from './staff';

/** What the manifest route needs of the app: a company by its code, and its settings as they stand. */
type ManifestDeps = {
  readConfig: (storage: TenantStorage, code: string) => Promise<ConfigDoc | null>;
  tenantOfCode: (code: string, request: FastifyRequest) => Promise<{ storage: TenantStorage }>;
};

/** A company's phone-app description at an address that names it, for anyone, as the settings'
 * GET already answers the name, colour and description to whoever names the code: the browser
 * fetches it with no sign-in and no header. */
export function registerManifestRoute(
  app: FastifyInstance,
  { readConfig, tenantOfCode }: ManifestDeps,
) {
  app.get(`${ROUTES.manifest}/:code`, async (request, reply) => {
    const code = clientCodeSchema.safeParse(paramsOf(request).code);
    if (!code.success) throw new HttpError(404, 'Not found');
    const { storage } = await tenantOfCode(code.data, request);
    const doc = await readConfig(storage, code.data);
    if (!doc) throw new HttpError(404, 'Not found');
    // The reply always names both icons: the drawn ones where none is stored.
    const large = doc.pictures['app-icon']!.address;
    return reply
      .header('content-type', 'application/manifest+json')
      .header('cache-control', 'no-cache')
      .send(
        JSON.stringify(manifestOf(code.data, doc.config, { small: smallAddress(large), large })),
      );
  });
}

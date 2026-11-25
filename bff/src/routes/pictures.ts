import {
  CLIENT_HEADER,
  clientCodeSchema,
  type ConfigDoc,
  imageDataUrl,
  pictureKindSchema,
  recordKeys,
  ROUTES,
  savePictureRequestSchema,
  storedPictureSchema,
} from '@credo/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { declare, personOf } from '../audit';
import { HttpError, parse } from '../errors';
import type { TenantStorage } from '../records/records';
import { type Deps, paramsOf } from './staff';

/** What the picture routes need of the app besides the checks every route has: the settings' doc
 * as it stands (the reply of a save, and a conflict's current), and a company by its code. */
type PictureDeps = Deps & {
  readConfig: (storage: TenantStorage, code: string) => Promise<ConfigDoc | null>;
  tenantOfCode: (code: string, request: FastifyRequest) => Promise<{ storage: TenantStorage }>;
};

/** What a picture's answer may do at the app's own address: nothing a script could, since an SVG
 * opened there would otherwise run in the app's origin. */
const POLICY = "default-src 'none'; style-src 'unsafe-inline'; sandbox";

/** A year, at the tag the picture is at: a new picture is a new address. */
const FOR_A_YEAR = 'public, max-age=31536000, immutable';

/** The company's pictures: the bytes at an address that names the company and needs no sign-in (the
 * card shows the logo before one, and an `img` sends no header), and the save, by whoever holds
 * the settings right, at the person's choice. */
export function registerPictureRoutes(app: FastifyInstance, deps: PictureDeps) {
  const { forClient, signedIn, mustCan, readConfig, tenantOfCode } = deps;

  app.get(`${ROUTES.pictures}/:code/:kind`, async (request, reply) => {
    const code = clientCodeSchema.safeParse(paramsOf(request).code);
    const kind = pictureKindSchema.safeParse(paramsOf(request).kind);
    // A code or kind that is no code or kind names nothing, as an unknown one does.
    if (!code.success || !kind.success) throw new HttpError(404, 'Not found');
    const { storage } = await tenantOfCode(code.data, request);
    const found = await storage.getRecord(recordKeys.tenant(storage.tenantId).picture(kind.data));
    if (!found) throw new HttpError(404, 'Not found');
    const stored = storedPictureSchema.safeParse(found.data);
    // A fault of the back end, named by its kind and never by its key.
    if (!stored.success) throw new Error('a picture record does not parse');
    const image = imageDataUrl(stored.data.picture)!;
    const asked = (request.query as { v?: unknown }).v;
    return reply
      .header('content-type', `image/${image.type}`)
      .header('x-content-type-options', 'nosniff')
      .header('content-security-policy', POLICY)
      .header('cache-control', asked === found.tag ? FOR_A_YEAR : 'no-cache')
      .send(Buffer.from(stored.data.picture.slice(stored.data.picture.indexOf(',') + 1), 'base64'));
  });

  app.put(
    `${ROUTES.pictures}/:kind`,
    { ...forClient, config: { audit: 'config.picture' } },
    async (request) => {
      const who = await signedIn(request);
      // The act alone: a picture's bytes are never in the memo.
      const entry = declare(request, personOf(who), paramsOf(request).kind);
      mustCan(who, 'settings.canEdit');
      const kind = pictureKindSchema.safeParse(paramsOf(request).kind);
      if (!kind.success) throw new HttpError(404, 'Not found');
      const body = parse(savePictureRequestSchema, request.body);
      const code = request.headers[CLIENT_HEADER] as string;
      const key = recordKeys.tenant(request.tenantId).picture(kind.data);
      const moved =
        body.picture !== null
          ? (await request.storage.putRecord(key, { picture: body.picture }, body.version)) ===
            'moved'
          : body.version === null
            ? (await request.storage.getRecord(key)) !== null
            : (await request.storage.removeRecord(key, body.version)) === 'moved';
      if (moved) {
        throw new HttpError(409, 'Conflict', { current: await readConfig(request.storage, code) });
      }
      entry.saved(null, null);
      const doc = await readConfig(request.storage, code);
      if (!doc) throw new HttpError(404, 'Not set up');
      return doc;
    },
  );
}

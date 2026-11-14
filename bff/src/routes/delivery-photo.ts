import {
  ATTEMPTS,
  deliveryPhotoRecordSchema,
  deliveryRoutes,
  photoAddressRequestSchema,
  recordKeys,
} from '@credo/shared';
import type { FastifyInstance } from 'fastify';
import { declare, personOf } from '../audit';
import { HttpError, parse } from '../errors';
import { photoAddress, type PhotoStore } from '../photo-store';
import { parsed, type TenantStorage } from '../records/records';
import type { RequestTools } from './orders';
import type { Deps } from './staff';

/** The routes of a delivery's photo: the driver asks where to send it, the office and the driver
 * ask where to read it. The back end signs after its own checks and never touches the picture. */
export function registerDeliveryPhotoRoutes(
  app: FastifyInstance,
  deps: Pick<Deps, 'now' | 'forClient'> & { photoStore: PhotoStore | null },
  requests: RequestTools,
) {
  const { now, forClient, photoStore } = deps;

  /** The photo's record, its object's name, written over any an earlier try left: a record that moved
   * is read again, a few times. */
  async function writeName(storage: TenantStorage, day: string, id: string) {
    const key = recordKeys.tenant(storage.tenantId).deliveryPhoto(day, id);
    const name = recordKeys.tenant(storage.tenantId).deliveryPhotoObject(day, id);
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const held = await storage.getRecord(key);
      if ((await storage.putRecord(key, { name }, held?.tag ?? null)) === 'saved') return name;
    }
    throw new HttpError(503, 'Service unavailable');
  }

  app.post(
    deliveryRoutes.photoAddress(':day', ':id'),
    { ...forClient, config: { audit: 'delivery.photo' } },
    async (request) => {
      const { driverId, who } = await requests.mustBeDriver(request);
      const entry = declare(request, personOf(who), (request.params as { id: string }).id);
      const body = parse(photoAddressRequestSchema, request.body);
      if (body.type !== 'image/jpeg') {
        throw new HttpError(400, 'Bad request', { details: 'type: a JPEG alone' });
      }
      const found = await requests.mustFindRequest(request);
      const { day, id } = found.request;
      if (found.request.driver.id !== driverId) throw new HttpError(403, 'Forbidden');
      if (found.request.state !== 'waiting') {
        throw new HttpError(409, 'Conflict', {
          current: await requests.requestDoc(request.storage, day, id),
        });
      }
      if (!photoStore) throw new HttpError(503, 'Service unavailable');
      const name = await writeName(request.storage, day, id);
      // The act alone: the memo holds neither the name nor the address.
      entry.saved(null, null);
      return { url: photoAddress(photoStore, name, now(), body) };
    },
  );

  app.get(deliveryRoutes.photo(':day', ':id'), forClient, async (request) => {
    const { request: found } = await requests.mustReadRequest(request);
    const stored =
      found.state === 'delivered'
        ? await request.storage.getRecord(
            recordKeys.tenant(request.tenantId).deliveryPhoto(found.day, found.id),
          )
        : null;
    if (!stored) throw new HttpError(404, 'Not found');
    const record = parsed(deliveryPhotoRecordSchema, 'a delivery photo', stored);
    if (!photoStore) throw new HttpError(503, 'Service unavailable');
    return { url: photoAddress(photoStore, record.name, now()) };
  });
}

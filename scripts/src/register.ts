import {
  createCStorageClient,
  recordKeys,
  registerCStorageService,
  rekeyCStorageService,
} from '@credo/shared';

type Connection = {
  baseUrl: string;
  internalAccessKey: string;
  superAdminKey: string;
  fetch?: typeof fetch;
};

/**
 * Registers the BFF's service with c-storage's super-admin key, which only this script holds. A
 * 409 says the code is taken, not that the key stored is this one: the key is checked by reading a
 * record with it, and a refusal there stops the stack, whatever the 409 said. Says which it was,
 * for the deploy's log.
 */
export async function ensureService(
  connection: Connection,
  service: { code: string; accessKey: string },
): Promise<'registered' | 'present'> {
  const result = await registerCStorageService(connection, service);
  if (result === 'registered') return 'registered';
  const client = createCStorageClient({
    baseUrl: connection.baseUrl,
    internalAccessKey: connection.internalAccessKey,
    serviceCode: service.code,
    accessKey: service.accessKey,
    fetch: connection.fetch,
  });
  try {
    await client.getRecord(recordKeys.client(service.code));
  } catch (error) {
    throw new Error(`service ${service.code} exists, and c-storage refuses the key held for it`, {
      cause: error,
    });
  }
  return 'present';
}

/**
 * Replaces the service's key in c-storage with the super-admin key. The old key is refused from
 * the answer on; a service the store does not hold is an error, never a registration, so a
 * mistyped code makes nothing. Says it rekeyed, for the run's log; the key is never in a line.
 */
export async function rekeyService(
  connection: Connection,
  service: { code: string; accessKey: string },
): Promise<'rekeyed'> {
  if ((await rekeyCStorageService(connection, service)) === 'unknown') {
    throw new Error(`service ${service.code} is not registered in c-storage; nothing was changed`);
  }
  return 'rekeyed';
}

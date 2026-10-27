import { createCStorageClient, recordKeys, registerCStorageService } from '@credo/shared';

type Connection = {
  baseUrl: string;
  internalAccessKey: string;
  superAdminKey: string;
  fetch?: typeof fetch;
};

/**
 * Registers the BFF's service with c-storage's super-admin key, which only this script holds. A
 * 409 says the code is taken, not that the key stored is this one: the key is checked by reading a
 * record with it, and a refusal there stops the stack, whatever the 409 said.
 */
export async function ensureService(
  connection: Connection,
  service: { code: string; accessKey: string },
) {
  const result = await registerCStorageService(connection, service);
  if (result === 'registered') return;
  const client = createCStorageClient({
    baseUrl: connection.baseUrl,
    internalAccessKey: connection.internalAccessKey,
    serviceCode: service.code,
    accessKey: service.accessKey,
    fetch: connection.fetch,
  });
  try {
    await client.getRecord(recordKeys.config);
  } catch (error) {
    throw new Error(`service ${service.code} exists, and c-storage refuses the key held for it`, {
      cause: error,
    });
  }
}

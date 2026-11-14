import {
  configDocSchema,
  createCStorageClient,
  recordKeys,
  registerCStorageService,
} from '@credo/shared';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { freshTenant, type RunningCStorage, startCStorage } from '../tests/c-storage';
import { CODE, ORIGIN, seedTenant } from '../tests/tenant';
import { readLambdaEnv } from './env';
import { buildBff } from './server';

let cs: RunningCStorage;
let box2: RunningCStorage;
beforeAll(async () => {
  cs = await startCStorage(inject('cStorageBinary'));
  box2 = await startCStorage(inject('cStorageBinary'));
});
afterAll(async () => {
  await cs.stop();
  await box2.stop();
});

describe('The BFF is handed its other boxes by STORAGE_BOXES and routes a company to the one its line names', () => {
  it('serves a company whose line names b2 from the second box, over the keys the variable carries', async () => {
    const home = await freshTenant(cs);
    const secondKey = 'second-box-service-key-0001';
    await registerCStorageService(
      {
        baseUrl: box2.baseUrl,
        internalAccessKey: box2.internalAccessKey,
        superAdminKey: box2.superAdminKey,
      },
      { code: home.serviceCode, accessKey: secondKey },
    );
    const second = createCStorageClient({
      baseUrl: box2.baseUrl,
      internalAccessKey: box2.internalAccessKey,
      serviceCode: home.serviceCode,
      accessKey: secondKey,
    });
    const id = await seedTenant(home.client, CODE);
    await home.client.putRecord(
      recordKeys.client(CODE),
      { id, name: 'Acme', box: 'b2' },
      (await home.client.getRecord(recordKeys.client(CODE)))?.tag ?? null,
    );
    await second.putRecord(recordKeys.tenant(id).config, {
      name: 'On b2',
      logo: null,
      colour: '#2f7d6d',
      languages: ['vi'],
      defaultLanguage: 'vi',
    });
    const app = buildBff(
      readLambdaEnv({
        C_STORAGE_URL: cs.baseUrl,
        INTERNAL_ACCESS_KEY: cs.internalAccessKey,
        SERVICE_CODE: home.serviceCode,
        SERVICE_ACCESS_KEY: home.accessKey,
        APP_ORIGIN: ORIGIN,
        FRONT_DOOR_KEYS: 'door-key-one',
        STORAGE_BOXES: JSON.stringify({
          b2: { url: box2.baseUrl, internalKey: box2.internalAccessKey, serviceKey: secondKey },
        }),
      }),
      { logger: false },
    );
    const answer = await app.inject({
      method: 'GET',
      url: '/api/config',
      headers: { 'x-client-code': CODE, 'x-front-door-key': 'door-key-one' },
    });
    await app.close();
    expect(answer.statusCode).toBe(200);
    expect(configDocSchema.parse(answer.json()).config.name).toBe('On b2');
  });
});

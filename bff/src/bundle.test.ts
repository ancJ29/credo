import { execFile } from 'node:child_process';
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { freshTenant, startCStorage, type RunningCStorage } from '../tests/c-storage';
import { CODE, seedTenant } from '../tests/tenant';
import { bundleBff } from './bundle';

let cs: RunningCStorage;
let dir: string;
beforeAll(async () => {
  cs = await startCStorage(inject('cStorageBinary'));
  dir = await mkdtemp(join(tmpdir(), 'credo-bundle-'));
});
afterAll(async () => {
  await cs.stop();
  await rm(dir, { recursive: true, force: true });
});

/** Calls the bundle's handler with an HTTP API event, in a Node of its own that has nothing but the
 * one file: no `node_modules`, none of this workspace. Prints the handler's answer as JSON after `ANSWER `. */
const callHandler = `
  const { handler } = require(process.argv[1]);
  const call = JSON.parse(process.argv[2]);
  handler({
    version: '2.0', routeKey: '$default', rawPath: call.path, rawQueryString: '',
    headers: call.headers,
    requestContext: { http: { method: call.method, path: call.path, protocol: 'HTTP/1.1',
      sourceIp: '127.0.0.1', userAgent: 'test' }, stage: '$default' },
    isBase64Encoded: false,
  }, { callbackWaitsForEmptyEventLoop: false })
    .then((answer) => console.log('ANSWER ' + JSON.stringify(answer) + '\\nNODE ' + process.version));
`;

/** The runtime's Node, which the app job names in BUNDLE_NODE (Node 24: a Node 26 API that Lambda
 * lacks fails there alone). Everywhere else the bundle runs under the Node running the tests. */
const bundleNode = process.env['BUNDLE_NODE'];

interface Ran {
  code: number | null;
  stdout: string;
  stderr: string;
}

/** Runs a command and returns how it ended, a non-zero exit included: a crash is read by the
 * assertions, not thrown. */
const ran = (file: string, args: string[], options: { cwd: string; env: NodeJS.ProcessEnv }) =>
  new Promise<Ran>((resolve) => {
    execFile(file, args, options, (error, stdout, stderr) => {
      const code = error ? (typeof error.code === 'number' ? error.code : null) : 0;
      resolve({ code, stdout, stderr });
    });
  });

describe('the Lambda bundle', () => {
  it('is one file, and answers an HTTP API event when run alone', async () => {
    const tenant = await freshTenant(cs);
    await seedTenant(tenant.client, CODE);
    await bundleBff(join(dir, 'index.js'));
    expect(await readdir(dir)).toEqual(['index.js']);
    expect((await stat(join(dir, 'index.js'))).size).toBeGreaterThan(0);

    const answer = await ran(
      bundleNode ?? process.execPath,
      [
        '-e',
        callHandler,
        join(dir, 'index.js'),
        JSON.stringify({
          method: 'GET',
          path: '/api/config',
          headers: { 'x-client-code': 'no-such-co' },
        }),
      ],
      {
        cwd: dir,
        env: {
          C_STORAGE_URL: cs.baseUrl,
          INTERNAL_ACCESS_KEY: cs.internalAccessKey,
          SERVICE_CODE: tenant.serviceCode,
          SERVICE_ACCESS_KEY: tenant.accessKey,
        },
      },
    );
    // A crash and an unexpected warning are asserted before the answer is read.
    expect(answer.code).toBe(0);
    expect(answer.stderr).toBe('');
    // The app logs to stdout too, before or after the answer's line.
    const line = answer.stdout.split('\n').find((text) => text.startsWith('ANSWER '));
    if (bundleNode) expect(answer.stdout).toMatch(/^NODE v24\./m);
    expect(JSON.parse(line?.slice('ANSWER '.length) ?? 'null')).toMatchObject({
      statusCode: 404,
      body: expect.stringContaining('Unknown client') as string,
    });
  });
});

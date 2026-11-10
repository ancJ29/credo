import { afterAll, beforeAll, describe, expect, inject, it, vi } from 'vitest';
import { z } from 'zod';
import { type RunningCStorage, startCStorage } from '../../tests/c-storage';
import { inviteOperator, joinWith, joinedOperator, post, signInWith } from '../../tests/operator';
import { bffOn } from '../../tests/tenant';

const offered = z.object({
  options: z.object({ pubKeyCredParams: z.array(z.object({ type: z.string(), alg: z.number() })) }),
});

let cs: RunningCStorage;
// The library asks the runtime once per process, so the spy goes in before anything runs, and
// this file holds nothing else.
const asked = vi.spyOn(SubtleCrypto, 'supports');
beforeAll(async () => {
  cs = await startCStorage(inject('cStorageBinary'));
});
afterAll(async () => {
  await cs.stop();
});

describe('A passkey is made and checked against the three algorithms the BFF names', () => {
  it('offers EdDSA, ES256 and RS256 in a join and in an add, and never asks the runtime about ML-DSA', async () => {
    const t = await bffOn(cs);
    const { token } = await inviteOperator(t, 'first');
    const opened = await post(t.app, '/api/operator/join/options', { link: token });
    expect(offered.parse(opened.json()).options.pubKeyCredParams).toEqual([
      { type: 'public-key', alg: -8 },
      { type: 'public-key', alg: -7 },
      { type: 'public-key', alg: -257 },
    ]);
    const op = await joinedOperator(t, 'second');
    const add = offered.parse(
      (await post(t.app, '/api/operator/passkeys/options', undefined, op.authId)).json(),
    );
    expect(add.options.pubKeyCredParams.map(({ alg }) => alg)).toEqual([-8, -7, -257]);
    expect((await joinWith(t, token)).joined.statusCode).toBe(200);
    expect((await signInWith(t, op.authenticator)).sent.statusCode).toBe(200);
    expect(asked).not.toHaveBeenCalled();
  });
});

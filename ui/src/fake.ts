import { normaliseSignInName, type TenantConfig } from '@credo/shared';
import { DEMO_CODE, DEMO_CONFIG, DEMO_ROOT_NAME, OPERATOR_NAME } from '@credo/shared/demo';
import { type Api, ApiError } from './api';
import { createDeviceStore } from './device';

/** The statuses the address may ask the fake to answer, once. */
const STATUSES = [403, 409, 503] as const;
type Status = (typeof STATUSES)[number];

/** One call and the status it answers once: `?cue=saveConfig:409`. */
export type Cue = { call: string; status: Status };

/** The cue an address names, or null for none or one the fake does not know. */
export function parseCue(raw: string | null): Cue | null {
  const [call, status] = (raw ?? '').split(':');
  const found = STATUSES.find((known) => String(known) === status);
  return call && found ? { call, status: found } : null;
}

const WEEK = 7 * 24 * 60 * 60 * 1000;
const ROOT = { name: DEMO_ROOT_NAME, root: true };

type Options = {
  /** Where the fake finds out whether this device holds a handle. */
  device: Pick<ReturnType<typeof createDeviceStore>, 'authId' | 'operatorAuthId'>;
  cue: Cue | null;
};

/**
 * The `Api` over the demo data set, held in memory and seeded afresh at each load: the same
 * methods, the same answers' shapes, no network. Any password signs the data set's root in. A
 * cue makes the call it names answer one status once, then the fake goes on from the data set.
 */
export function createFakeApi({ device, cue }: Options): Api {
  let config: TenantConfig = structuredClone(DEMO_CONFIG);
  let version = 1;
  let pending = cue;

  /** Runs `answer`, unless the cue names `call` and has not fired: then its status instead, as
   * the real call's own answer for it, or as the error every other call raises. */
  async function call<T>(name: string, answer: () => T | Promise<T>, onConflict?: () => T) {
    if (pending?.call === name) {
      const { status } = pending;
      pending = null;
      if (status === 409 && onConflict) return onConflict();
      throw new ApiError(status);
    }
    return await answer();
  }

  const signedOut = () => new ApiError(401);

  return {
    getConfig: () => call('getConfig', () => ({ config, version: `v${version}` })),

    signIn: (name) =>
      call('signIn', () => {
        if (normaliseSignInName(name) !== DEMO_ROOT_NAME) throw signedOut();
        return { authId: 'fake.session', expiresAt: Date.now() + WEEK, user: ROOT };
      }),

    signOut: () => call('signOut', () => undefined),

    me: () =>
      call('me', () => {
        if (!device.authId()) throw signedOut();
        return { user: ROOT };
      }),

    saveConfig: (next, readAt) =>
      call(
        'saveConfig',
        () => {
          if (readAt !== `v${version}`) return { kind: 'conflict' as const };
          config = structuredClone(next);
          version += 1;
          return { kind: 'saved' as const, doc: { config, version: `v${version}` } };
        },
        () => ({ kind: 'conflict' as const }),
      ),

    operatorSignIn: (name) =>
      call('operatorSignIn', () => {
        if (normaliseSignInName(name) !== OPERATOR_NAME) throw signedOut();
        return {
          authId: 'fake.operator',
          expiresAt: Date.now() + WEEK,
          operator: { name: OPERATOR_NAME },
        };
      }),

    operatorSignOut: () => call('operatorSignOut', () => undefined),

    operatorMe: () =>
      call('operatorMe', () => {
        if (!device.operatorAuthId()) throw signedOut();
        return { operator: { name: OPERATOR_NAME } };
      }),

    makeClient: (code) =>
      call(
        'makeClient',
        () =>
          code === DEMO_CODE
            ? { kind: 'taken' as const }
            : {
                kind: 'made' as const,
                client: {
                  link: `/login?client-code=${code}`,
                  rootName: DEMO_ROOT_NAME,
                  password: 'Fake-password-1',
                },
              },
        () => ({ kind: 'taken' as const }),
      ),
  };
}

/** What the app is given on `?fake`: the fake, and a device kept in the tab's own storage, linked
 * to the demo company, so a fake sign-in never touches what the device keeps for the real app. */
export function fakeParts(search: string, storage: Parameters<typeof createDeviceStore>[0]) {
  const device = createDeviceStore(storage);
  device.setClientCode(DEMO_CODE);
  return {
    api: createFakeApi({ device, cue: parseCue(new URLSearchParams(search).get('cue')) }),
    device,
  };
}

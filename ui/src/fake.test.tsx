import {
  configDocSchema,
  createClientReplySchema,
  meReplySchema,
  operatorMeReplySchema,
  operatorSessionReplySchema,
  sessionReplySchema,
} from '@credo/shared';
import { DEMO_CODE, DEMO_CONFIG, DEMO_ROOT_NAME, OPERATOR_NAME } from '@credo/shared/demo';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { drawApp } from '../tests/render';
import { ApiError } from './api';
import { App } from './App';
import { DICTIONARIES } from './i18n';
import { createFakeApi, fakeParts, parseCue } from './fake';

const memory = (initial: Record<string, string> = {}) => {
  const kept = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => kept.get(key) ?? null,
    setItem: (key: string, value: string) => void kept.set(key, value),
    removeItem: (key: string) => void kept.delete(key),
  };
};

/** A fake whose device holds the handles `held` names. */
const fake = (cue = '', held: { client?: string; operator?: string } = {}) =>
  createFakeApi({
    device: { authId: () => held.client ?? null, operatorAuthId: () => held.operator ?? null },
    cue: parseCue(cue || null),
  });

const status = async (answer: Promise<unknown>) =>
  await answer.then(
    () => 'answered',
    (error: unknown) => (error instanceof ApiError ? error.status : 'not an ApiError'),
  );

describe('the fake Api', () => {
  it('Every answer of the fake `Api` parses under the shared schema the real answer is read with', async () => {
    const api = fake('', { client: 'fake.session', operator: 'fake.operator' });
    const schemas = {
      getConfig: configDocSchema,
      signIn: sessionReplySchema,
      me: meReplySchema,
      operatorSignIn: operatorSessionReplySchema,
      operatorMe: operatorMeReplySchema,
    };
    const answers = {
      getConfig: await api.getConfig(),
      signIn: await api.signIn(DEMO_ROOT_NAME, 'pw'),
      me: await api.me(),
      operatorSignIn: await api.operatorSignIn(OPERATOR_NAME, 'pw'),
      operatorMe: await api.operatorMe(),
    };
    for (const [name, schema] of Object.entries(schemas)) {
      expect(schema.safeParse(answers[name as keyof typeof answers]).success, name).toBe(true);
    }
    const saved = await api.saveConfig(DEMO_CONFIG, 'v1');
    expect(saved.kind).toBe('saved');
    expect(saved.kind === 'saved' && configDocSchema.safeParse(saved.doc).success).toBe(true);
    const made = await api.makeClient('another-one', 'Another One');
    expect(made.kind === 'made' && createClientReplySchema.safeParse(made.client).success).toBe(
      true,
    );
    // A method with no schema above would answer unchecked.
    expect(Object.keys(api).sort()).toEqual(
      [...Object.keys(schemas), 'saveConfig', 'makeClient', 'signOut', 'operatorSignOut'].sort(),
    );
  });

  it('The demo company answers as its data set holds it, and a save moves its version', async () => {
    const api = fake();
    expect(await api.getConfig()).toEqual({ config: DEMO_CONFIG, version: 'v1' });

    const renamed = { ...DEMO_CONFIG, name: 'Renamed' };
    expect(await api.saveConfig(renamed, 'v1')).toEqual({
      kind: 'saved',
      doc: { config: renamed, version: 'v2' },
    });
    expect(await api.getConfig()).toEqual({ config: renamed, version: 'v2' });
    expect(await api.saveConfig(DEMO_CONFIG, 'v1')).toEqual({ kind: 'conflict' });
    expect((await api.getConfig()).config.name).toBe('Renamed');
  });

  it('Each load is seeded afresh: a save in one fake is not in the next', async () => {
    const [first, second] = [fake(), fake()];
    await first.saveConfig({ ...DEMO_CONFIG, name: 'Renamed' }, 'v1');

    expect((await second.getConfig()).config.name).toBe(DEMO_CONFIG.name);
    expect(DEMO_CONFIG.name).toBe('Minh Phát');
  });

  it('The data set’s root signs in under its name, in any case, and any other name is a 401', async () => {
    const api = fake();

    expect((await api.signIn(' Root ', 'any')).user).toEqual({ name: DEMO_ROOT_NAME, root: true });
    expect(await status(api.signIn('someone', 'any'))).toBe(401);
    expect(await status(api.operatorSignIn('root', 'any'))).toBe(401);
    expect(await api.operatorSignIn(OPERATOR_NAME, 'any')).toMatchObject({
      operator: { name: OPERATOR_NAME },
    });
  });

  it('A device with no handle is a 401 on `me`, the client’s and the operator’s', async () => {
    const api = fake();

    expect(await status(api.me())).toBe(401);
    expect(await status(api.operatorMe())).toBe(401);
    await expect(api.signOut()).resolves.toBeUndefined();
    await expect(api.operatorSignOut()).resolves.toBeUndefined();
  });

  it('The demo company’s code is taken, and any other makes a client with a link', async () => {
    const api = fake();

    expect(await api.makeClient(DEMO_CODE, 'Minh Phát')).toEqual({ kind: 'taken' });
    expect(await api.makeClient('another-one', 'Another One')).toMatchObject({
      kind: 'made',
      client: { link: '/login?client-code=another-one', rootName: DEMO_ROOT_NAME },
    });
  });
});

describe('the cue', () => {
  it('The fake answers 403, 409 or 503 once, on the call its cue names, and otherwise from the data set', async () => {
    for (const code of [403, 503]) {
      const api = fake(`getConfig:${code}`);
      expect(await status(api.getConfig()), String(code)).toBe(code);
      expect((await api.getConfig()).config.name, String(code)).toBe(DEMO_CONFIG.name);
    }

    const api = fake('saveConfig:409');
    expect(await api.saveConfig(DEMO_CONFIG, 'v1')).toEqual({ kind: 'conflict' });
    expect((await api.saveConfig(DEMO_CONFIG, 'v1')).kind).toBe('saved');

    const clients = fake('makeClient:409');
    expect(await clients.makeClient('another-one', 'x')).toEqual({ kind: 'taken' });
    expect((await clients.makeClient('another-one', 'x')).kind).toBe('made');

    const other = fake('signIn:409');
    expect(await status(other.signIn(DEMO_ROOT_NAME, 'pw'))).toBe(409);
    expect((await other.signIn(DEMO_ROOT_NAME, 'pw')).user.root).toBe(true);
  });

  it('A cue names one call: the others answer from the data set as if none were there', async () => {
    const api = fake('saveConfig:503');

    expect((await api.getConfig()).config.name).toBe(DEMO_CONFIG.name);
    expect(await status(api.saveConfig(DEMO_CONFIG, 'v1'))).toBe(503);
  });

  it('An address’s cue is a call and one of the three statuses, or it is no cue', () => {
    expect(parseCue('saveConfig:409')).toEqual({ call: 'saveConfig', status: 409 });
    expect(parseCue('me:403')).toEqual({ call: 'me', status: 403 });
    expect(parseCue('me:404')).toBeNull();
    expect(parseCue('me')).toBeNull();
    expect(parseCue(':503')).toBeNull();
    expect(parseCue(null)).toBeNull();
  });
});

async function signInAs() {
  await userEvent.type(await screen.findByLabelText(/Username/), DEMO_ROOT_NAME);
  await userEvent.type(screen.getByLabelText(/Password/), 'pw');
  await userEvent.click(screen.getByRole('button', { name: 'Sign In' }));
}

describe('?fake', () => {
  it('The app boots on the data set: the sign-in already wears the demo company’s name', async () => {
    const { api, device } = fakeParts('?fake', memory());
    drawApp(<App api={api} device={device} test />);

    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe(DEMO_CONFIG.name);
    expect(device.clientCode()).toBe(DEMO_CODE);
  });

  it('The root signs in on the fake and lands on Settings', async () => {
    const { api, device } = fakeParts('?fake', memory({ 'credo.language': 'en' }));
    drawApp(<App api={api} device={device} test />);

    await signInAs();

    expect(await screen.findByRole('heading', { level: 2, name: 'Settings' })).toBeTruthy();
    expect(device.authId()).toBe('fake.session');
  });

  it('The address’s cue is read: the call it names answers its status, and the page says the service is unavailable', async () => {
    const { api, device } = fakeParts('?fake&cue=signIn:503', memory({ 'credo.language': 'en' }));
    drawApp(<App api={api} device={device} test />);

    await signInAs();

    expect((await screen.findByRole('alert')).textContent).toContain(
      DICTIONARIES.en.common.unavailable,
    );
    expect(device.authId()).toBeNull();
  });
});

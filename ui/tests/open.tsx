import { DEMO_CODE, DEMO_EMPLOYEES } from '@credo/shared/demo';
import { type Mock, vi } from 'vitest';
import { type Api } from '../src/api';
import { App } from '../src/App';
import { createDeviceStore } from '../src/device';
import { createFakeApi, parseCue } from '../src/fake';
import { drawApp } from './render';

const memory = (initial: Record<string, string>) => {
  const kept = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => kept.get(key) ?? null,
    setItem: (key: string, value: string) => void kept.set(key, value),
    removeItem: (key: string) => void kept.delete(key),
  };
};

/** A data-set person by code. */
export const person = (code: string) => {
  const found = DEMO_EMPLOYEES.find((candidate) => candidate.code === code);
  if (!found) throw new Error(`no ${code} in the data set`);
  return found;
};

type Options = {
  as?: string;
  cue?: string;
  language?: 'en' | 'vi';
  /** Changes a call before the app draws, given the fake as it was before the spies. */
  override?: (api: Spied, original: Api) => void;
};

/** The app on the fake, at `path`, already signed in as the root or as a data-set person (by
 * code); each call of the fake is a spy. */
/** The fake with each call a spy. */
export type Spied = { [K in keyof Api]: Mock<Api[K]> };

export function openApp(path: string, { as, cue, language = 'en', override }: Options = {}) {
  const handle = as ? `fake.session.${person(as).id}` : 'fake.session';
  const device = createDeviceStore(
    memory({ 'credo.client': DEMO_CODE, 'credo.language': language, 'credo.session': handle }),
  );
  const api = createFakeApi({ device, cue: parseCue(cue ?? null) });
  const original = { ...api };
  for (const name of Object.keys(api) as (keyof Api)[]) vi.spyOn(api, name);
  const spied = api as unknown as Spied;
  override?.(spied, original);
  return { api: spied, device, ...drawApp(<App api={api} device={device} test />, path) };
}

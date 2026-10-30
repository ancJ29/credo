import { DEMO_EMPLOYEES } from '@credo/shared/demo';
import { type Mock, vi } from 'vitest';
import { type Api } from '../src/api';
import { App } from '../src/App';
import { sceneParts } from '../src/scene';
import { drawApp } from './render';

/** A data-set person by code. */
export const person = (code: string) => {
  const found = DEMO_EMPLOYEES.find((candidate) => candidate.code === code);
  if (!found) throw new Error(`no ${code} in the data set`);
  return found;
};

type Options = {
  as?: string;
  cue?: string;
  /** The company has turned on the email and QR sign-ins. */
  signIns?: boolean;
  /** Nobody is signed in: a phone that opens a QR code's link. */
  out?: boolean;
  language?: 'en' | 'vi';
  /** Changes a call before the app draws, given the fake as it was before the spies. */
  override?: (api: Spied, original: Api) => void;
};

/** The fake with each call a spy. */
export type Spied = { [K in keyof Api]: Mock<Api[K]> };

/** The app on the fake, at `path`, already signed in as the root or as a data-set person (by
 * code); each call of the fake is a spy. */
export function openApp(
  path: string,
  { as, cue, signIns, out, language = 'en', override }: Options = {},
) {
  const { api, device } = sceneParts({ as, cue, signIns, out, language });
  const original = { ...api };
  for (const name of Object.keys(api) as (keyof Api)[]) vi.spyOn(api, name);
  const spied = api as unknown as Spied;
  override?.(spied, original);
  return { api: spied, device, ...drawApp(<App api={api} device={device} test />, path) };
}

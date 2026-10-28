import type { Language } from '@credo/shared';
import { DEMO_CODE, DEMO_EMPLOYEES } from '@credo/shared/demo';
import { createDeviceStore } from './device';
import { createFakeApi, parseCue } from './fake';

/** What the walks page draws a scene with: the whole app, and the parts that put it on the fake. */
export { App } from './App';

const memory = (initial: Record<string, string>) => {
  const kept = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => kept.get(key) ?? null,
    setItem: (key: string, value: string) => void kept.set(key, value),
    removeItem: (key: string) => void kept.delete(key),
  };
};

type SceneOptions = {
  /** The data-set person already signed in, by code: the root when it names none. */
  as?: string;
  /** One call and the status it answers once, as the address's `cue` names it. */
  cue?: string;
  language: Language;
};

/**
 * The fake `Api` and the device it answers for, on the demo company, already signed in as the
 * root or as a data-set person and speaking `language`: what one scene, or one test of a page, is
 * drawn from. Each call makes a fake of its own, seeded afresh.
 */
export function sceneParts({ as, cue, language }: SceneOptions) {
  const found = as === undefined ? null : DEMO_EMPLOYEES.find((person) => person.code === as);
  if (found === undefined) throw new Error(`no ${as} in the data set`);
  const device = createDeviceStore(
    memory({
      'credo.client': DEMO_CODE,
      'credo.language': language,
      'credo.session': found ? `fake.session.${found.id}` : 'fake.session',
    }),
  );
  return { api: createFakeApi({ device, cue: parseCue(cue ?? null) }), device };
}

// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { DEMO_EMPLOYEES } from '@credo/shared/demo';
import { SCREENS } from '@credo/ui/mock';
import { describe, expect, it } from 'vitest';
import { DICTIONARIES } from '@credo/ui/words';
import {
  allKeys,
  answerKey,
  DEVICE_WIDTH,
  PARTS,
  PEOPLE,
  resolveDrawn,
  type Step,
  type Walk,
  WALKS,
} from './walks';

const SPECS = new URL('../../walk/specs/', import.meta.url);
const read = (path: string) => readFileSync(new URL(`../../walk/${path}`, import.meta.url), 'utf8');

describe('the walks', () => {
  it('Each walk screen names a state the mock draws', () => {
    const states = resolveDrawn(WALKS, SCREENS);

    expect(states.size).toBe(29);
    expect(states.get('admin-setup:8-save-conflict')!.id).toBe('conflict');
    expect(states.get('admin-setup:7-save-failed')!.id).toBe('save-failed');
    expect(states.get('admin-setup:1-sign-in')!.id).toBe('empty');
    expect(states.get('admin-setup:9-unknown-company')!.id).toBe('unknown');
    expect(states.get('operator-setup:op-4-code-taken')!.id).toBe('taken');
    expect('scene' in states.get('admin-staff:staff-4-person')!).toBe(true);
    expect('scene' in states.get('admin-setup:1-sign-in')!).toBe(false);
  });

  it('One it lacks stops the build, naming it', () => {
    const lacking = (screen: number, state: string): Walk[] => [
      {
        ...WALKS[0],
        screens: [{ ...WALKS[0].screens[0], id: 'x', mock: { screen, state }, scene: undefined }],
      },
    ];

    expect(() => resolveDrawn(lacking(3, 'no-such-state'), SCREENS)).toThrow(
      'walk admin-setup, screen x: the mock draws no state "3 no-such-state"',
    );
    expect(() => resolveDrawn(lacking(99, 'empty'), SCREENS)).toThrow('"99 empty"');
  });

  it('holds piece 1’s eight screens in the app frame’s numbers, and screen 9 after them', () => {
    const screens = WALKS[0].screens;

    expect(screens.map((screen) => screen.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(screens.filter((screen) => screen.path === 'main').map((s) => s.number)).toEqual([
      1, 3, 4, 5,
    ]);
    expect(screens.filter((screen) => screen.path === 'wrong').map((s) => s.number)).toEqual([
      2, 6, 7, 8, 9,
    ]);
  });

  it('puts the operator’s walk after piece 1’s: four screens, numbered 1 to 4, the code taken on the wrong path', () => {
    const walk = WALKS[1];

    expect(walk.id).toBe('operator-setup');
    expect(walk.screens.map((screen) => screen.number)).toEqual([1, 2, 3, 4]);
    expect(walk.screens.filter((s) => s.path === 'wrong').map((s) => s.id)).toEqual([
      'op-4-code-taken',
    ]);
    expect(PEOPLE[0].id).toBe(walk.person);
    expect(PEOPLE[0].device).toBe('pc');
  });

  it('puts the walk in the map’s people and parts, each person on a device with a width', () => {
    const walk = WALKS[0];

    expect(PEOPLE.map((person) => person.id)).toContain(walk.person);
    expect(PARTS.map((part) => part.id)).toContain(walk.part);
    expect(PEOPLE.find((person) => person.id === walk.person)!.device).toBe('pc');
    expect(DEVICE_WIDTH).toEqual({ pc: 1280, tablet: 768, phone: 390 });
  });

  it('keys an answer by walk, screen and language, fifty-eight for the twenty-nine screens', () => {
    expect(answerKey('w', '1-a', 'vi')).toBe('w:1-a:vi');
    expect(allKeys(WALKS)).toHaveLength(58);
    expect(allKeys(WALKS)[0]).toBe('admin-setup:1-sign-in:vi');
  });

  it('names every screen of every walk as the walk specs do, which makes their base images', () => {
    const inSpecs = readdirSync(SPECS)
      .filter((name) => name.endsWith('.spec.ts'))
      .flatMap((name) =>
        [...read(`specs/${name}`).matchAll(/await at\('([^']+)'/g)].map((m) => m[1]),
      );

    expect(inSpecs.sort()).toEqual(
      WALKS.flatMap((walk) => walk.screens.map((screen) => screen.id)).sort(),
    );
  });

  it('shoots every walk at the widths the report draws, the width in each image’s name', () => {
    const widths =
      /export const WIDTHS = \{ pc: (\d+), tablet: (\d+), phone: (\d+) \} as const/.exec(
        read('support.ts'),
      )!;

    expect(widths.slice(1).map(Number)).toEqual([
      DEVICE_WIDTH.pc,
      DEVICE_WIDTH.tablet,
      DEVICE_WIDTH.phone,
    ]);
    expect(read('support.ts')).toContain('`${screen}-${language}-${width}.png`');
    for (const name of readdirSync(SPECS).filter((file) => file.endsWith('.spec.ts'))) {
      expect(read(`specs/${name}`), name).toContain("from '../support'");
      expect(read(`specs/${name}`), name).toContain('Object.entries(WIDTHS)');
    }
  });

  it('parks the pointer before each shot and compares with no tolerance in pixels or in colour', () => {
    const support = read('support.ts');

    // the first statement of `shot`, so the fake run's picture, the soft comparison and the hard
    // one are each taken after it
    expect(support).toMatch(
      /export async function shot\([^)]*\) \{\n {2}await page\.mouse\.move\(0, 0\);\n/,
    );
    expect(read('playwright.config.ts')).toContain('maxDiffPixels: 0, threshold: 0');
    // a missing folder for the fake run's pictures names itself and who gives it, not the stack
    expect(support).toContain("required('CREDO_FAKE_DIR', 'the fake run’s script gives it");
  });

  it('Each piece-2 scene’s person and cue are the ones its screen opens with in the walk spec', () => {
    const spec = read('specs/piece-2.spec.ts');
    const body = spec.slice(spec.indexOf('async function walk('));
    // each screen's steps, from the shot before it to its own: `await at('<id>'`
    const parts = body.split(/await at\('([^']+)'/);
    const openings = new Map<string, string>();
    for (let index = 1; index < parts.length; index += 2) {
      openings.set(parts[index], parts[index - 1]);
    }
    const screens = WALKS.slice(2).flatMap((walk) => walk.screens);

    expect([...openings.keys()]).toEqual(screens.map((screen) => screen.id));
    for (const screen of screens) {
      const steps = openings.get(screen.id)!;
      const { as, cue } = screen.scene!;
      expect(steps.includes(`as: '${as}'`), `${screen.id}: as`).toBe(as !== undefined);
      expect(steps.includes(`cue: '${cue}'`), `${screen.id}: cue`).toBe(cue !== undefined);
    }
  });

  it('puts piece 2’s group A in three walks, sixteen screens in all, each a scene and none from the mock', () => {
    const piece2 = WALKS.slice(2);

    expect(piece2.map((walk) => [walk.id, walk.person, walk.part, walk.screens.length])).toEqual([
      ['admin-staff-setup', 'admin', 'setup', 1],
      ['admin-staff', 'admin', 'staff', 11],
      ['office-staff', 'office', 'staff', 4],
    ]);
    const screens = piece2.flatMap((walk) => walk.screens);
    expect(screens).toHaveLength(16);
    expect(screens.filter((screen) => screen.mock !== undefined)).toEqual([]);
    expect(screens.filter((screen) => screen.scene === undefined)).toEqual([]);
    expect(new Set(screens.map((screen) => screen.id)).size).toBe(16);
    expect(piece2.map((walk) => walk.screens.map((screen) => screen.number))).toEqual([
      [1],
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      [1, 2, 3, 4],
    ]);
    expect(piece2[1].screens.filter((s) => s.path === 'wrong').map((s) => s.number)).toEqual([
      9, 10, 11,
    ]);
    expect(piece2[2].screens.filter((s) => s.path === 'wrong').map((s) => s.number)).toEqual([
      3, 4,
    ]);
    expect(piece2[2].screens.filter((s) => s.navigation).map((s) => s.number)).toEqual([1]);
    for (const walk of piece2) {
      expect(PEOPLE.map((person) => person.id)).toContain(walk.person);
      expect(PARTS.map((part) => part.id)).toContain(walk.part);
    }
  });

  it('names each step of a scene by words both languages’ dictionaries hold', () => {
    const words = (language: 'en' | 'vi', key: string) =>
      key
        .split('.')
        .reduce<unknown>(
          (at, part) => (at as Record<string, unknown>)?.[part],
          DICTIONARIES[language],
        );
    const keys = (step: Step) =>
      'press' in step
        ? [step.press, ...(step.within ? [step.within] : [])]
        : ['fill' in step ? step.fill : step.choose];
    const used = WALKS.flatMap((walk) => walk.screens)
      .flatMap((screen) => screen.scene?.steps ?? [])
      .flatMap(keys);

    expect(used.length).toBeGreaterThan(15);
    for (const key of used) {
      expect(typeof words('en', key), key).toBe('string');
      expect(typeof words('vi', key), key).toBe('string');
    }
  });

  it('opens each scene as a person of the data set, by the code they hold, or as the root', () => {
    const codes = new Set(DEMO_EMPLOYEES.map((person) => person.code));
    const scenes = WALKS.flatMap((walk) => walk.screens).flatMap((s) => (s.scene ? [s.scene] : []));

    expect(scenes).toHaveLength(16);
    for (const scene of scenes) {
      if (scene.as !== undefined) expect(codes.has(scene.as), scene.as).toBe(true);
      expect(scene.path.startsWith('/'), scene.path).toBe(true);
    }
    expect(scenes.filter((scene) => scene.as !== undefined).map((scene) => scene.as)).toEqual([
      'EMP-0001',
      'EMP-0001',
      'EMP-0001',
      'EMP-0005',
    ]);
  });

  it('The walk spec’s screens equal the walks page’s list, piece 2’s as piece 1’s', () => {
    const shot = (name: string) =>
      [...read(`specs/${name}`).matchAll(/await at\('([^']+)'/g)].map((m) => m[1]);
    const piece2 = WALKS.slice(2).flatMap((walk) => walk.screens.map((screen) => screen.id));

    expect(shot('piece-2.spec.ts')).toEqual(piece2);
    const config = read('playwright.config.ts');
    expect(config).toContain("name: 'fake'");
    expect(config).toContain("name: 'full'");
    expect(config).toContain("name: 'chromium', testIgnore: 'piece-2.spec.ts'");
  });
});

// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { DEMO_EMPLOYEES } from '@credo/shared/demo';
import { SCREENS } from '@credo/ui/mock';
import { describe, expect, it } from 'vitest';
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
import { stepWords } from './scene';

const SPECS = new URL('../../walk/specs/', import.meta.url);
const read = (path: string) => readFileSync(new URL(`../../walk/${path}`, import.meta.url), 'utf8');

describe('the walks', () => {
  it('Each walk screen names a state the mock draws', () => {
    const states = resolveDrawn(WALKS, SCREENS);

    expect(states.size).toBe(59);
    expect(states.get('admin-setup:8-save-conflict')!.id).toBe('conflict');
    expect(states.get('admin-setup:7-save-failed')!.id).toBe('save-failed');
    expect(states.get('admin-setup:1-sign-in')!.id).toBe('empty');
    expect(states.get('admin-setup:9-unknown-company')!.id).toBe('unknown');
    expect('scene' in states.get('operator-setup:op-4-code-taken')!).toBe(true);
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

  it('puts the operator’s walk after piece 1’s: nine screens, numbered 1 to 9, each a scene and none from the mock, the failures on the wrong path', () => {
    const walk = WALKS[1];

    expect(walk.id).toBe('operator-setup');
    expect(walk.screens.map((screen) => screen.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(walk.screens.filter((s) => s.path === 'wrong').map((s) => s.id)).toEqual([
      'op-4-code-taken',
      'op-7-list-failed',
      'op-8-code-invalid',
      'op-9-make-failed',
    ]);
    expect(walk.screens.filter((s) => s.mock !== undefined)).toEqual([]);
    expect(walk.screens.filter((s) => s.navigation).map((s) => s.id)).toEqual(['op-5-dashboard']);
    expect(PEOPLE[0].id).toBe(walk.person);
    expect(PEOPLE[0].device).toBe('pc');
  });

  it('shoots the dashboard, the coming-soon page and the failed list before the walk makes a client, or a stack’s dashboard lists a fourth', () => {
    const spec = read('specs/operator.spec.ts');
    const body = spec.slice(spec.indexOf('async function walk('));
    const firstMake = body.indexOf('press(words.operator.make)');

    expect(firstMake).toBeGreaterThan(0);
    for (const id of ['op-5-dashboard', 'op-6-coming-soon', 'op-7-list-failed']) {
      const at = body.indexOf(`await at('${id}'`);
      expect(at, id).toBeGreaterThan(0);
      expect(at, id).toBeLessThan(firstMake);
    }
  });

  it('opens each operator scene signed in as the operator, but the sign-in, as the operator’s spec opens it', () => {
    const spec = read('specs/operator.spec.ts');
    const body = spec.slice(spec.indexOf('async function walk('));
    const parts = body.split(/await at\('([^']+)'/);
    const openings = new Map<string, string>();
    for (let index = 1; index < parts.length; index += 2) {
      openings.set(parts[index], parts[index - 1]);
    }
    const screens = WALKS[1].screens;

    // the spec shoots screens 5 to 7 before the walk makes a client, so the ids are compared
    // without their order
    expect([...openings.keys()].sort()).toEqual(screens.map((screen) => screen.id).sort());
    for (const screen of screens) {
      const steps = openings.get(screen.id)!;
      const { path, operator, cue, as } = screen.scene!;
      // the last opening before the shot is the screen's own
      const opened = [...steps.matchAll(/await open\(page, language, \{([^}]*)\}\)/g)].at(-1)![1];
      const named = (key: string) =>
        [...opened.matchAll(new RegExp(`\\b${key}: '([^']+)'`, 'g'))].map((found) => found[1]);
      expect(named('path'), `${screen.id}: path`).toEqual([path]);
      expect(named('cue'), `${screen.id}: cue`).toEqual(cue === undefined ? [] : [cue]);
      expect(/\boperator: true\b/.test(opened), `${screen.id}: operator`).toBe(operator === true);
      expect(as, screen.id).toBeUndefined();
    }
  });

  it('puts the walk in the map’s people and parts, each person on a device with a width', () => {
    const walk = WALKS[0];

    expect(PEOPLE.map((person) => person.id)).toContain(walk.person);
    expect(PARTS.map((part) => part.id)).toContain(walk.part);
    expect(PEOPLE.find((person) => person.id === walk.person)!.device).toBe('pc');
    expect(DEVICE_WIDTH).toEqual({ pc: 1280, tablet: 768, phone: 390 });
  });

  it('keys an answer by walk, screen and language, a hundred and eighteen for the fifty-nine screens', () => {
    expect(answerKey('w', '1-a', 'vi')).toBe('w:1-a:vi');
    expect(allKeys(WALKS)).toHaveLength(118);
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
    // both fake projects take pictures only, and neither full project does
    expect(support).toContain("['fake', 'operator-fake'].includes(test.info().project.name)");
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
    const screens = WALKS.slice(2, 6).flatMap((walk) => walk.screens);

    expect([...openings.keys()]).toEqual(screens.map((screen) => screen.id));
    for (const screen of screens) {
      const steps = openings.get(screen.id)!;
      const { as, cue } = screen.scene!;
      // equal, not only present: a screen given another person or another cue is a difference too
      const named = (key: string) =>
        [...steps.matchAll(new RegExp(`\\b${key}: '([^']+)'`, 'g'))].map((found) => found[1]);
      expect(named('as'), `${screen.id}: as`).toEqual(as === undefined ? [] : [as]);
      expect(named('cue'), `${screen.id}: cue`).toEqual(cue === undefined ? [] : [cue]);
      // the switches and a phone that is signed out are flags: set on both sides, or on neither
      const { signIns, out } = screen.scene!;
      expect(/\bsignIns: true/.test(steps), `${screen.id}: signIns`).toBe(signIns === true);
      expect(/\bout: true/.test(steps), `${screen.id}: out`).toBe(out === true);
    }
  });

  it('puts piece 2’s groups A, B, C and D in four walks, thirty-three screens in all, each a scene and none from the mock', () => {
    const piece2 = WALKS.slice(2, 6);

    expect(piece2.map((walk) => [walk.id, walk.person, walk.part, walk.screens.length])).toEqual([
      ['admin-staff-setup', 'admin', 'setup', 2],
      ['admin-staff', 'admin', 'staff', 22],
      ['office-staff', 'office', 'staff', 7],
      ['phone-sign-in', 'driver', 'staff', 2],
    ]);
    const screens = piece2.flatMap((walk) => walk.screens);
    expect(screens).toHaveLength(33);
    expect(screens.filter((screen) => screen.mock !== undefined)).toEqual([]);
    expect(screens.filter((screen) => screen.scene === undefined)).toEqual([]);
    expect(new Set(screens.map((screen) => screen.id)).size).toBe(33);
    expect(piece2.map((walk) => walk.screens.map((screen) => screen.number))).toEqual([
      [1, 2],
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22],
      [1, 2, 3, 4, 5, 6, 7],
      [1, 2],
    ]);
    expect(piece2[1].screens.filter((s) => s.path === 'wrong').map((s) => s.number)).toEqual([
      9, 10, 11, 16, 22,
    ]);
    expect(piece2[2].screens.filter((s) => s.path === 'wrong').map((s) => s.number)).toEqual([
      3, 4, 7,
    ]);
    expect(piece2[3].screens.filter((s) => s.path === 'wrong').map((s) => s.number)).toEqual([2]);
    expect(piece2[2].screens.filter((s) => s.navigation).map((s) => s.number)).toEqual([1, 5]);
    for (const walk of piece2) {
      expect(PEOPLE.map((person) => person.id)).toContain(walk.person);
      expect(PARTS.map((part) => part.id)).toContain(walk.part);
    }
  });

  it('puts B’s seven screens after A’s sixteen, the screens the plan names', () => {
    const [setup, staff, office] = WALKS.slice(2, 6).map((walk) => walk.screens.map((s) => s.id));

    expect(setup?.slice(1)).toEqual(['setup-2-fields']);
    expect(staff?.slice(11, 16)).toEqual([
      'staff-12-own-fields',
      'staff-13-photo',
      'staff-14-search',
      'staff-15-code-changed',
      'staff-16-field-refused',
    ]);
    expect(office?.slice(4, 5)).toEqual(['office-5-settings']);
  });

  it('puts C’s six screens after B’s, the screens the plan names, the phone’s walk being all C’s', () => {
    const [, staff, office, phone] = WALKS.slice(2, 6).map((walk) => walk.screens.map((s) => s.id));

    expect(staff?.slice(16, 18)).toEqual(['staff-17-email', 'staff-18-qr']);
    expect(office?.slice(5)).toEqual(['office-6-password', 'office-7-password-wrong']);
    expect(phone).toEqual(['phone-1-signed-in', 'phone-2-code-used']);
    // the email and the QR code are shown on a company that uses them; the phone is signed out
    const scenes = new Map(WALKS.flatMap((walk) => walk.screens).map((s) => [s.id, s.scene]));
    expect(scenes.get('staff-17-email')?.signIns).toBe(true);
    expect(scenes.get('staff-18-qr')?.signIns).toBe(true);
    expect(scenes.get('phone-1-signed-in')).toMatchObject({ signIns: true, out: true });
    expect(scenes.get('phone-2-code-used')).toMatchObject({ signIns: true, out: true });
    expect(scenes.get('phone-1-signed-in')?.path).toMatch(/^\/login\?client-code=demo&qr=/);
    expect(scenes.get('office-7-password-wrong')?.cue).toBe('changePassword:403');
  });

  it('puts D’s four screens after B’s, numbered 19 to 22 as the plan names them, the file without the name column on the wrong path', () => {
    const staff = WALKS.find((walk) => walk.id === 'admin-staff')!.screens;

    expect(staff.slice(18).map((screen) => [screen.id, screen.number, screen.path])).toEqual([
      ['staff-19-import', 19, 'main'],
      ['staff-20-preview', 20, 'main'],
      ['staff-21-imported', 21, 'main'],
      ['staff-22-no-name', 22, 'wrong'],
    ]);
    expect(staff[21].scene!.steps).toEqual([
      { attach: 'import.file', file: 'import-no-name' },
      { press: 'import.read' },
    ]);
  });

  it('names each step of a scene by words both languages’ dictionaries hold', () => {
    const words = (language: 'en' | 'vi', key: string) =>
      key
        .split('.')
        .reduce<unknown>(
          (at, part) => (at as Record<string, unknown>)?.[part],
          stepWords(language),
        );
    const keys = (step: Step) =>
      'press' in step
        ? [step.press, ...(step.within ? [step.within] : [])]
        : ['fill' in step ? step.fill : 'attach' in step ? step.attach : step.choose];
    const used = WALKS.flatMap((walk) => walk.screens)
      .flatMap((screen) => screen.scene?.steps ?? [])
      .flatMap(keys);

    expect(used.length).toBeGreaterThan(25);
    for (const key of used) {
      expect(typeof words('en', key), key).toBe('string');
      expect(typeof words('vi', key), key).toBe('string');
    }
  });

  it('opens each scene as a person of the data set, by the code they hold, or as the root', () => {
    const codes = new Set(DEMO_EMPLOYEES.map((person) => person.code));
    const scenes = WALKS.flatMap((walk) => walk.screens).flatMap((s) => (s.scene ? [s.scene] : []));

    expect(scenes).toHaveLength(50);
    for (const scene of scenes) {
      if (scene.as !== undefined) expect(codes.has(scene.as), scene.as).toBe(true);
      expect(scene.path.startsWith('/'), scene.path).toBe(true);
    }
    expect(scenes.filter((scene) => scene.as !== undefined).map((scene) => scene.as)).toEqual([
      'EMP-0001',
      'EMP-0001',
      'EMP-0001',
      'EMP-0005',
      'EMP-0003',
      'EMP-0001',
      'EMP-0001',
    ]);
  });

  it('The walk spec’s screens equal the walks page’s list, piece 2’s and the operator’s as piece 1’s', () => {
    const shot = (name: string) =>
      [...read(`specs/${name}`).matchAll(/await at\('([^']+)'/g)].map((m) => m[1]);
    const piece2 = WALKS.slice(2, 6).flatMap((walk) => walk.screens.map((screen) => screen.id));

    expect(shot('piece-2.spec.ts')).toEqual(piece2);
    expect(shot('lists.spec.ts')).toEqual(WALKS[6].screens.map((screen) => screen.id));
    // the operator's spec shoots screens 5 to 7 before screen 2, so its ids are compared unordered
    expect(shot('operator.spec.ts').sort()).toEqual(
      WALKS[1].screens.map((screen) => screen.id).sort(),
    );
    const config = read('playwright.config.ts');
    expect(config).toContain("name: 'fake'");
    expect(config).toContain("name: 'full'");
    expect(config).toContain("name: 'operator-fake'");
    expect(config).toContain("name: 'operator-full'");
    expect(config).toContain(
      "testIgnore: ['piece-2.spec.ts', 'lists.spec.ts', 'operator.spec.ts']",
    );
    expect(config).toContain("testMatch: ['piece-2.spec.ts', 'lists.spec.ts']");
  });

  it('puts the customers and products from Excel in one walk of the admin’s set-up, eight screens, each a scene and none from the mock, the file without the code column on the wrong path', () => {
    const walk = WALKS[6];

    expect(walk).toMatchObject({ id: 'admin-lists', person: 'admin', part: 'setup' });
    expect(walk.screens.map((screen) => [screen.id, screen.number, screen.path])).toEqual([
      ['lists-1-customers', 1, 'main'],
      ['lists-2-customers-import', 2, 'main'],
      ['lists-3-customers-preview', 3, 'main'],
      ['lists-4-customers-added', 4, 'main'],
      ['lists-5-no-code', 5, 'wrong'],
      ['lists-6-products', 6, 'main'],
      ['lists-7-products-preview', 7, 'main'],
      ['lists-8-products-added', 8, 'main'],
    ]);
    expect(walk.screens.filter((screen) => screen.scene === undefined)).toEqual([]);
    expect(walk.screens[4].scene!.steps).toEqual([
      { attach: 'import.file', file: 'customers-no-code' },
      { press: 'import.read' },
    ]);
  });

  it('Each lists screen opens in the walk spec at the address its scene names, as the root', () => {
    const spec = read('specs/lists.spec.ts');
    const parts = spec.slice(spec.indexOf('async function walk(')).split(/await at\('([^']+)'/);
    // a screen that goes on from the one before (the add after the preview) opens nothing itself
    const openings = new Map<string, string>();
    let before = '';
    for (let index = 1; index < parts.length; index += 2) {
      before += parts[index - 1];
      openings.set(parts[index], before);
    }

    for (const screen of WALKS[6].screens) {
      const opened = [
        ...openings.get(screen.id)!.matchAll(/await open\(page, language, '([^']+)'\)/g),
      ];
      expect(opened.at(-1)?.[1], screen.id).toBe(screen.scene!.path);
      expect(screen.scene!.as, screen.id).toBeUndefined();
      expect(screen.scene!.cue, screen.id).toBeUndefined();
    }
  });
});

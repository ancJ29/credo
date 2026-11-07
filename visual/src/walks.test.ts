// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import {
  DEMO_COLLEAGUE_ID,
  DEMO_CUSTOMERS,
  DEMO_EMPLOYEES,
  DEMO_PRODUCTS,
} from '@credo/shared/demo';
import { SCREENS } from '@credo/ui/mock';
import { describe, expect, it } from 'vitest';
import {
  DEVICE_WIDTH,
  PARTS,
  PEOPLE,
  resolveDrawn,
  SIGN_IN_LOOK,
  type Step,
  type Walk,
  WALKS,
} from './walks';
import { stepWords } from './scene';

const SPECS = new URL('../../walk/specs/', import.meta.url);
const read = (path: string) => readFileSync(new URL(`../../walk/${path}`, import.meta.url), 'utf8');

/** Piece 2's walks, which start at the staff setup whatever walks come before them. */
const piece2Walks = () => {
  const first = WALKS.findIndex((walk) => walk.id === 'admin-staff-setup');
  return WALKS.slice(first, first + 4);
};

describe('the walks', () => {
  it('The sign-in look question is the question of exactly the nine doors and of no other screen', () => {
    const DOORS = [
      '1-sign-in',
      '2-sign-in-refused',
      'op-1-sign-in',
      'pk-1-join',
      'pk-3-not-given',
      'pk-4-no-operator',
      'pk-5-link-dead',
      'phone-1-signed-in',
      'phone-2-code-used',
    ];
    const asking = WALKS.flatMap((walk) => walk.screens)
      .filter((screen) => screen.question === SIGN_IN_LOOK)
      .map((screen) => screen.id);

    expect(asking.sort()).toEqual([...DOORS].sort());
  });

  it('Each walk screen names a state the mock draws', () => {
    const states = resolveDrawn(WALKS, SCREENS);

    expect(states.size).toBe(WALKS.flatMap((walk) => walk.screens).length);
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

  it('holds piece 1’s eight screens in the app frame’s numbers, screen 9 after them, and the white frame’s 10 and 11', () => {
    const screens = WALKS[0].screens;

    expect(screens.map((screen) => screen.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(screens.filter((screen) => screen.path === 'main').map((s) => s.number)).toEqual([
      1, 3, 4, 5, 10, 11,
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

  it('parks the pointer and scrolls to the top before each shot, and settles on two equal shots pixel for pixel', () => {
    const support = read('support.ts');

    // the top of `shot`, in this order and nothing else between: the wait for any button loader (first,
    // since a loader still on the page is no state to park the pointer over), then the park and the
    // scroll, so every picture is taken after all three
    expect(support).toMatch(
      /export async function shot\([^)]*\) \{\n(?: {2}\/\/[^\n]*\n)* {2}await expect\(\n {4}page\.locator\('\.mantine-Button-loader'\),\n {4}`\$\{screen\}: a button's loader is still on the page`,\n {2}\)\.toHaveCount\(0\);\n {2}await page\.mouse\.move\(0, 0\);\n {2}await page\.evaluate\('window\.scrollTo\(0, 0\)'\);\n/,
    );
    // the raw reader decides "equal": no comparator that skips softened edges, no tolerance
    expect(support).toContain("from '@credo/scripts/pixels'");
    expect(support).toContain("if (difference.kind === 'equal') {");
    expect(support).not.toContain('toHaveScreenshot');
    expect(read('playwright.config.ts')).not.toMatch(/toHaveScreenshot|maxDiffPixels|threshold/);
    // a missing folder for the pictures names itself and who gives it
    expect(support).toContain("required('CREDO_SHOTS_DIR', 'walk/run.sh gives it the folder");
    // the browser draws every tile whole, so a picture has one state
    expect(read('playwright.config.ts')).toContain("'--disable-partial-raster'");
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
    const screens = piece2Walks().flatMap((walk) => walk.screens);

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

  it('puts the passkeys walk after the operator’s: six screens numbered 1 to 6, each a scene, the failures on the wrong path, for the operator on a PC', () => {
    const walk = WALKS[2];

    expect(walk.id).toBe('operator-passkeys');
    expect(walk.person).toBe('operator');
    expect(walk.screens.map((screen) => screen.number)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(walk.screens.filter((s) => s.path === 'main').map((s) => s.id)).toEqual([
      'pk-1-join',
      'pk-2-passkeys',
    ]);
    expect(walk.screens.filter((s) => s.path === 'wrong').map((s) => s.id)).toEqual([
      'pk-3-not-given',
      'pk-4-no-operator',
      'pk-5-link-dead',
      'pk-6-sign-in-ended',
    ]);
    expect(walk.screens.filter((s) => s.mock !== undefined || s.scene === undefined)).toEqual([]);
    expect(PARTS.map((part) => part.id)).toContain(walk.part);
  });

  it('C: puts the services walk after the passkeys: five screens, each a scene for the operator, the first the main path and the failures wrong', () => {
    const walk = WALKS[3];

    expect(walk.id).toBe('operator-services');
    expect(walk.person).toBe('operator');
    expect(walk.screens.map((screen) => screen.id)).toEqual([
      'sv-1-all-well',
      'sv-2-two-builds',
      'sv-3-storage-silent',
      'sv-4-bff-silent',
      'sv-5-unavailable',
    ]);
    expect(walk.screens.map((screen) => screen.path)).toEqual([
      'main',
      'wrong',
      'wrong',
      'wrong',
      'wrong',
    ]);
    expect(walk.screens.every((screen) => screen.scene !== undefined)).toBe(true);
    expect(PARTS.map((part) => part.id)).toContain(walk.part);
  });

  it('C: opens each services scene as the services spec opens it: its address, who is signed in, whether c-storage runs a newer build, and its cue', () => {
    const spec = read('specs/operator-services.spec.ts');
    const body = spec.slice(spec.indexOf('async function walk('));
    const parts = body.split(/await at\('([^']+)'/);
    const openings = new Map<string, string>();
    for (let index = 1; index < parts.length; index += 2) {
      openings.set(parts[index], parts[index - 1]);
    }

    for (const screen of WALKS[3].screens) {
      const { path, operator, drift, cue } = screen.scene!;
      const opened = [
        ...openings.get(screen.id)!.matchAll(/await open\(page, language, \{([^}]*)\}\)/gs),
      ].at(-1)![1];
      const named = (key: string) =>
        [...opened.matchAll(new RegExp(`\\b${key}: '([^']+)'`, 'g'))].map((found) => found[1]);
      expect(named('path'), `${screen.id}: path`).toEqual([path]);
      expect(named('cue'), `${screen.id}: cue`).toEqual(cue === undefined ? [] : [cue]);
      expect(/\boperator: true\b/.test(opened), `${screen.id}: operator`).toBe(operator === true);
      expect(/\bdrift: true\b/.test(opened), `${screen.id}: drift`).toBe(drift === true);
    }
  });

  it('opens each passkeys scene as the passkeys spec opens it: its address with the token in the fragment, who is signed in, and its cue', () => {
    const spec = read('specs/operator-passkeys.spec.ts');
    const body = spec.slice(spec.indexOf('async function walk('));
    const parts = body.split(/await at\('([^']+)'/);
    const openings = new Map<string, string>();
    for (let index = 1; index < parts.length; index += 2) {
      openings.set(parts[index], parts[index - 1]);
    }

    for (const screen of WALKS[2].screens) {
      const { path, operator, cue, as } = screen.scene!;
      const opened = [
        ...openings.get(screen.id)!.matchAll(/await open\(page, language, \{([^}]*)\}\)/g),
      ].at(-1)![1];
      const named = (key: string) =>
        [...opened.matchAll(new RegExp(`\\b${key}: '([^']+)'`, 'g'))].map((found) => found[1]);
      // the link's address is built from the data set's token, which the spec imports
      const address = path.startsWith('/operator/join#') ? 'JOIN_LINK' : path;
      const written = [...opened.matchAll(/\bpath: (?:'([^']+)'|(JOIN_LINK))/g)].map(
        (found) => found[1] ?? found[2],
      );
      expect(written, `${screen.id}: path`).toEqual([address]);
      expect(named('cue'), `${screen.id}: cue`).toEqual(cue === undefined ? [] : [cue]);
      expect(/\boperator: true\b/.test(opened), `${screen.id}: operator`).toBe(operator === true);
      expect(as, screen.id).toBeUndefined();
    }
  });

  it('D: puts the root password walk last: four screens, each a scene for the operator on a PC, the main path the page and the made password, the rule and the failure on the wrong path', () => {
    const walk = WALKS[12];

    expect(walk.id).toBe('operator-root-password');
    expect(walk.person).toBe('operator');
    expect(PARTS.map((part) => part.id)).toContain(walk.part);
    expect(walk.screens.map((screen) => [screen.id, screen.number, screen.path])).toEqual([
      ['rp-1-form', 1, 'main'],
      ['rp-2-rule', 2, 'wrong'],
      ['rp-3-made', 3, 'main'],
      ['rp-4-failed', 4, 'wrong'],
    ]);
    expect(walk.screens.every((screen) => screen.scene?.operator === true)).toBe(true);
    expect(walk.screens.map((screen) => screen.scene?.cue)).toEqual([
      undefined,
      undefined,
      undefined,
      'setRootPassword:503',
    ]);
    expect(WALKS.slice(0, 13)).toHaveLength(13);
  });

  it('D: opens screen 4 on the fake with the cue the scene names, and the stack’s spec stubs the same route', () => {
    const spec = read('specs/operator-root-password.spec.ts');

    expect(spec).toContain(`cue: '${WALKS[12].screens[3].scene!.cue}'`);
    expect(spec).toContain('/root-password`');
    expect(spec).toContain('status: 503');
  });

  it('B1: puts the operators walk last: six screens numbered 1 to 6, each a scene for the operator, the list, the form, the link once, a colleague’s new link and their delete on the main path, the name taken on the wrong one', () => {
    const walk = WALKS[13];

    expect(walk.id).toBe('operator-team');
    expect(walk.person).toBe('operator');
    expect(PARTS.map((part) => part.id)).toContain(walk.part);
    expect(walk.screens.map((screen) => [screen.id, screen.number, screen.path])).toEqual([
      ['tm-1-list', 1, 'main'],
      ['tm-2-name', 2, 'main'],
      ['tm-3-added', 3, 'main'],
      ['tm-4-link', 4, 'main'],
      ['tm-5-delete', 5, 'main'],
      ['tm-6-taken', 6, 'wrong'],
    ]);
    expect(walk.screens.every((screen) => screen.scene?.operator === true)).toBe(true);
    expect(walk.screens.map((screen) => screen.scene?.path)).toEqual([
      '/operator/operators',
      '/operator/operators/new',
      '/operator/operators/new',
      `/operator/operators/${DEMO_COLLEAGUE_ID}/link`,
      `/operator/operators/${DEMO_COLLEAGUE_ID}/delete`,
      '/operator/operators/new',
    ]);
    // the name taken is the invited operator's, typed in other capitals: no cue is needed
    expect(walk.screens.map((screen) => screen.scene?.cue)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
    expect(WALKS.slice(0, 14)).toHaveLength(14);
  });

  it('puts the client delete walk last: four screens, each a scene for the operator on the delete page, the page and the deleted list on the main path, the wrong code and the failure on the wrong one', () => {
    const walk = WALKS[14];

    expect(walk.id).toBe('operator-delete-client');
    expect(walk.person).toBe('operator');
    expect(PARTS.map((part) => part.id)).toContain(walk.part);
    expect(walk.screens.map((screen) => [screen.id, screen.number, screen.path])).toEqual([
      ['dc-1-page', 1, 'main'],
      ['dc-2-code', 2, 'wrong'],
      ['dc-3-failed', 3, 'wrong'],
      ['dc-4-gone', 4, 'main'],
    ]);
    expect(walk.screens.every((screen) => screen.scene?.operator === true)).toBe(true);
    expect(
      walk.screens.every((screen) => screen.scene?.path === '/operator/clients/hoa-sen/delete'),
    ).toBe(true);
    expect(walk.screens.map((screen) => screen.scene?.cue)).toEqual([
      undefined,
      undefined,
      'deleteClient:503',
      undefined,
    ]);
    expect(WALKS).toHaveLength(15);
    const spec = read('specs/operator-delete-client.spec.ts');
    expect(spec).toContain(`cue: '${walk.screens[2].scene!.cue}'`);
    expect(spec).toContain('status: 503');
  });

  it('puts piece 2’s groups A, B, C and D in four walks, thirty-four screens in all, each a scene and none from the mock', () => {
    const piece2 = piece2Walks();

    expect(piece2.map((walk) => [walk.id, walk.person, walk.part, walk.screens.length])).toEqual([
      ['admin-staff-setup', 'admin', 'setup', 2],
      ['admin-staff', 'admin', 'staff', 23],
      ['office-staff', 'office', 'staff', 7],
      ['phone-sign-in', 'driver', 'staff', 2],
    ]);
    const screens = piece2.flatMap((walk) => walk.screens);
    expect(screens).toHaveLength(34);
    expect(screens.filter((screen) => screen.mock !== undefined)).toEqual([]);
    expect(screens.filter((screen) => screen.scene === undefined)).toEqual([]);
    expect(new Set(screens.map((screen) => screen.id)).size).toBe(34);
    expect(piece2.map((walk) => walk.screens.map((screen) => screen.number))).toEqual([
      [1, 2],
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23],
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
    const [setup, staff, office] = piece2Walks().map((walk) => walk.screens.map((s) => s.id));

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
    const [, staff, office, phone] = piece2Walks().map((walk) => walk.screens.map((s) => s.id));

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

  it('puts D’s four screens after B’s, numbered 19 to 22 as the plan names them, the file without the name column on the wrong path, and the switch back on appended as 23', () => {
    const staff = WALKS.find((walk) => walk.id === 'admin-staff')!.screens;

    expect(staff.slice(18).map((screen) => [screen.id, screen.number, screen.path])).toEqual([
      ['staff-19-import', 19, 'main'],
      ['staff-20-preview', 20, 'main'],
      ['staff-21-imported', 21, 'main'],
      ['staff-22-no-name', 22, 'wrong'],
      ['staff-23-back-on', 23, 'main'],
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

    const everyScreen = WALKS.flatMap((walk) => walk.screens);
    expect(scenes).toHaveLength(everyScreen.filter((screen) => screen.mock === undefined).length);
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
      ...Array<string>(12).fill('EMP-0001'),
      ...Array<string>(5).fill('EMP-0005'),
      ...Array<string>(8).fill('EMP-0001'),
    ]);
  });

  it('The walk spec’s screens equal the walks page’s list, piece 2’s and the operator’s as piece 1’s', () => {
    const shot = (name: string) =>
      [...read(`specs/${name}`).matchAll(/await at\('([^']+)'/g)].map((m) => m[1]);
    const piece2 = piece2Walks().flatMap((walk) => walk.screens.map((screen) => screen.id));

    expect(shot('piece-2.spec.ts')).toEqual(piece2);
    expect(shot('lists.spec.ts')).toEqual(WALKS[8].screens.map((screen) => screen.id));
    expect(shot('orders.spec.ts')).toEqual(WALKS[9].screens.map((screen) => screen.id));
    expect(shot('driver.spec.ts')).toEqual(WALKS[10].screens.map((screen) => screen.id));
    expect(shot('reconcile.spec.ts')).toEqual(WALKS[11].screens.map((screen) => screen.id));
    expect(shot('operator-passkeys.spec.ts')).toEqual(WALKS[2].screens.map((screen) => screen.id));
    expect(shot('operator-services.spec.ts')).toEqual(WALKS[3].screens.map((screen) => screen.id));
    expect(shot('operator-root-password.spec.ts')).toEqual(
      WALKS[12].screens.map((screen) => screen.id),
    );
    // the team spec shoots screen 6 before 5, since the delete is its last act: compared unordered
    expect(shot('operator-team.spec.ts').sort()).toEqual(
      WALKS[13].screens.map((screen) => screen.id).sort(),
    );
    expect(shot('operator-delete-client.spec.ts')).toEqual(
      WALKS[14].screens.map((screen) => screen.id),
    );
    // the operator's spec shoots screens 5 to 7 before screen 2, so its ids are compared unordered
    expect(shot('operator.spec.ts').sort()).toEqual(
      WALKS[1].screens.map((screen) => screen.id).sort(),
    );
    const config = read('playwright.config.ts');
    expect(config).toContain("name: 'fake'");
    expect(config).toContain("name: 'full'");
    expect(config).toContain("name: 'operator-fake'");
    expect(config).toContain("name: 'operator-full'");
    expect(config).toContain("name: 'passkeys-fake'");
    expect(config).toContain("name: 'passkeys-full'");
    expect(config).toContain("name: 'services-fake'");
    expect(config).toContain("name: 'services-full'");
    expect(config).toContain("name: 'root-password-fake'");
    expect(config).toContain("name: 'root-password-full'");
    expect(config).toContain("name: 'team-fake'");
    expect(config).toContain("name: 'team-full'");
    expect(config).toContain("name: 'delete-client-fake'");
    expect(config).toContain("name: 'delete-client-full'");
    // the chromium project's whole ignore list, in order: a line that another project's testMatch also
    // holds cannot stand in for it
    const chromium = /name: 'chromium',\s*testIgnore: \[([^\]]*)\],/.exec(config);
    expect(
      chromium?.[1]
        ?.split(',')
        .map((entry) => entry.trim())
        .filter(Boolean),
    ).toEqual([
      "'piece-2.spec.ts'",
      "'lists.spec.ts'",
      "'orders.spec.ts'",
      "'driver.spec.ts'",
      "'reconcile.spec.ts'",
      "'operator.spec.ts'",
      "'operator-passkeys.spec.ts'",
      "'operator-services.spec.ts'",
      "'operator-root-password.spec.ts'",
      "'operator-team.spec.ts'",
      "'operator-delete-client.spec.ts'",
    ]);
    expect(config).toContain("name: 'lists-fake'");
    expect(config).toContain("name: 'lists-full'");
    expect(config).toContain("testMatch: 'lists.spec.ts'");
    expect(config).toContain("name: 'orders-fake'");
    expect(config).toContain("name: 'orders-full'");
    expect(config).toContain("testMatch: 'orders.spec.ts'");
    expect(config).toContain("name: 'driver-fake'");
    expect(config).toContain("name: 'driver-full'");
    expect(config).toContain("testMatch: 'driver.spec.ts'");
    expect(config).toContain("name: 'reconcile-fake'");
    expect(config).toContain("name: 'reconcile-full'");
    expect(config).toContain("testMatch: 'reconcile.spec.ts'");
  });

  it('puts the customers and products from Excel in one walk of the admin’s set-up, seventeen screens, each a scene and none from the mock, the file without the code column on the wrong path', () => {
    const walk = WALKS[8];

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
      ['lists-9-more', 9, 'main'],
      ['lists-10-customer', 10, 'main'],
      ['lists-11-customer-no-note', 11, 'main'],
      ['lists-12-product', 12, 'main'],
      ['lists-13-product-no-note', 13, 'main'],
      ['lists-14-customer-saved', 14, 'main'],
      ['lists-15-customer-conflict', 15, 'wrong'],
      ['lists-16-product-saved', 16, 'main'],
      ['lists-17-product-conflict', 17, 'wrong'],
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

    for (const screen of WALKS[8].screens) {
      // a customer's or a product's page is reached from the list by the name's link: on the stack
      // the BFF mints the id, so the spec opens the list and clicks the data set's record by name
      const before = openings.get(screen.id)!;
      const opened = [...before.matchAll(/await open\(page, language, '([^']+)'\)/g)];
      const customer = DEMO_CUSTOMERS.find((one) => screen.scene!.path === `/customers/${one.id}`);
      const product = DEMO_PRODUCTS.find((one) => screen.scene!.path === `/products/${one.id}`);
      const record = customer ?? product;
      if (record) {
        const noted = typeof record.extra['note'] === 'string' && record.extra['note'] !== '';
        const opener = customer ? 'openCustomer' : 'openProduct';
        const name = `${noted ? 'NOTED' : 'PLAIN'}_${customer ? 'CUSTOMER' : 'PRODUCT'}`;
        expect(
          before
            .slice(before.lastIndexOf(`await ${opener}(`))
            .startsWith(`await ${opener}(${name}.name`),
          screen.id,
        ).toBe(true);
        expect(before, screen.id).not.toContain('/customers/${');
        expect(before, screen.id).not.toContain('/products/${');
      } else {
        expect(opened.at(-1)?.[1], screen.id).toBe(screen.scene!.path);
      }
      expect(screen.scene!.as, screen.id).toBeUndefined();
      // only the two conflicts are cued, and the spec opens each with the same cue
      expect(screen.scene!.cue, screen.id).toBe(
        {
          'lists-15-customer-conflict': 'saveCustomer:409',
          'lists-17-product-conflict': 'saveProduct:409',
        }[screen.id],
      );
      if (screen.scene!.cue) expect(before, screen.id).toContain(`, '${screen.scene!.cue}');`);
    }
  });

  it('puts an order sent to a driver in one walk of the office’s orders, twelve screens, each a scene and none from the mock, the three failures on the wrong path', () => {
    const walk = WALKS[9];

    expect(walk).toMatchObject({ id: 'office-orders', person: 'office', part: 'orders' });
    expect(walk.screens.map((screen) => [screen.id, screen.number, screen.path])).toEqual([
      ['orders-1-list', 1, 'main'],
      ['orders-2-new', 2, 'main'],
      ['orders-3-confirm', 3, 'main'],
      ['orders-4-confirmed', 4, 'main'],
      ['orders-5-requests', 5, 'main'],
      ['orders-6-request', 6, 'main'],
      ['orders-7-cancelled', 7, 'main'],
      ['orders-8-conflict', 8, 'wrong'],
      ['orders-9-confirm-failed', 9, 'wrong'],
      ['orders-10-no-drivers', 10, 'wrong'],
      ['orders-11-fulfilled', 11, 'main'],
      ['orders-12-proof', 12, 'main'],
    ]);
    expect(walk.screens.filter((screen) => screen.scene === undefined)).toEqual([]);
    // every screen is the office manager's, and the failures are cued or provoked as the spec does
    expect(walk.screens.map((screen) => screen.scene!.as)).toEqual(Array(12).fill('EMP-0001'));
    expect(walk.screens.map((screen) => screen.scene!.cue)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      'saveOrder:409',
      'confirmOrder:503',
      undefined,
      undefined,
      undefined,
    ]);
    expect(walk.screens[9].scene!.noDrivers).toBe(true);
  });

  it('The driver’s walk: the phone’s six screens, the first from the QR link with nobody signed in, the rest the data set’s driver, the failures cued as the spec cues them and on the wrong path', () => {
    const walk = WALKS[10];

    expect(walk).toMatchObject({ id: 'driver-deliveries', person: 'driver', part: 'delivery' });
    expect(walk.screens.map((screen) => [screen.id, screen.number, screen.path])).toEqual([
      ['driver-1-today', 1, 'main'],
      ['driver-2-request', 2, 'main'],
      ['driver-3-photo', 3, 'main'],
      ['driver-4-delivered', 4, 'main'],
      ['driver-5-send-failed', 5, 'wrong'],
      ['driver-6-cancelled', 6, 'wrong'],
    ]);
    expect(walk.screens.filter((screen) => screen.scene === undefined)).toEqual([]);
    expect(walk.screens[0].scene).toMatchObject({ out: true, signIns: true });
    expect(walk.screens[0].scene!.path).toContain(`qr=${DEMO_EMPLOYEES[4].id}.`);
    expect(walk.screens.slice(1).map((screen) => screen.scene!.as)).toEqual(
      Array(5).fill('EMP-0005'),
    );
    expect(walk.screens.map((screen) => screen.scene!.cue)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
      'deliver:503',
      'deliver:409',
    ]);
    // the photo is chosen as the camera's file, then sent
    expect(walk.screens[2].scene!.steps).toEqual([
      { press: 'myDeliveries.deliver' },
      { attach: 'myDeliveries.photoField', file: 'photo' },
    ]);
    expect(walk.screens[3].scene!.steps!.at(-1)).toEqual({ press: 'myDeliveries.send' });
  });

  it('Each driver screen opens in the walk spec as its scene does: signed in by the QR link for the first, the cue the scene names for the others', () => {
    const spec = read('specs/driver.spec.ts');
    const parts = spec.slice(spec.indexOf('async function walk(')).split(/await at\('([^']+)'/);
    const before = new Map<string, string>();
    for (let index = 1; index < parts.length; index += 2)
      before.set(parts[index], parts[index - 1]);

    for (const screen of WALKS[10].screens) {
      const { cue, out } = screen.scene!;
      const steps = before.get(screen.id)!;
      const opened = [...steps.matchAll(/(?:opened|open)\(([^)]*)\)/g)].at(-1)?.[1] ?? '';
      expect(opened.includes(`cue: '${cue}'`), `${screen.id}: cue`).toBe(cue !== undefined);
      expect(opened.includes('qr: true'), `${screen.id}: qr`).toBe(out === true);
    }
    expect(spec).toContain('await page.clock.setFixedTime(CLOCK);');
  });

  it('Each orders screen opens in the walk spec as its scene does: the cue, the right taken from the drivers, and the clock at the data set’s today', () => {
    const spec = read('specs/orders.spec.ts');
    const parts = spec.slice(spec.indexOf('async function walk(')).split(/await at\('([^']+)'/);
    const before = new Map<string, string>();
    for (let index = 1; index < parts.length; index += 2)
      before.set(parts[index], parts[index - 1]);

    for (const screen of WALKS[9].screens) {
      const { cue, noDrivers } = screen.scene!;
      const steps = before.get(screen.id)!;
      const opened = [...steps.matchAll(/(?:listed|open)\(([^)]*)\)/g)].at(-1)?.[1] ?? '';
      expect(opened.includes(`cue: '${cue}'`), `${screen.id}: cue`).toBe(cue !== undefined);
      expect(opened.includes('noDrivers: true'), `${screen.id}: noDrivers`).toBe(
        noDrivers === true,
      );
    }
    // the browser's clock is fixed before each opening, at the day the fake build and a scene take
    expect(spec).toContain('await page.clock.setFixedTime(CLOCK);');
    expect(spec).toContain('DEMO_TODAY.split');
  });
  it('Each driver’s day settled is one walk of the office in a part of its own, the day’s end: eight screens, each a scene of the office’s manager, the two failures cued and on the wrong path', () => {
    const walk = WALKS[11];

    expect(walk).toMatchObject({ id: 'office-reconcile', person: 'office', part: 'day-end' });
    expect(PARTS.map((part) => part.id).at(-1)).toBe('day-end');
    expect(walk.screens.map((screen) => [screen.id, screen.number, screen.path])).toEqual([
      ['reconcile-1-requests', 1, 'main'],
      ['reconcile-2-day', 2, 'main'],
      ['reconcile-3-cash', 3, 'main'],
      ['reconcile-4-check', 4, 'main'],
      ['reconcile-5-closed', 5, 'main'],
      ['reconcile-6-yesterday', 6, 'main'],
      ['reconcile-7-moved', 7, 'wrong'],
      ['reconcile-8-failed', 8, 'wrong'],
    ]);
    expect(walk.screens.filter((screen) => screen.scene === undefined)).toEqual([]);
    expect(walk.screens.map((screen) => screen.scene!.as)).toEqual(Array(8).fill('EMP-0001'));
    expect(walk.screens.map((screen) => screen.scene!.cue)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      'closeDay:409',
      'closeDay:503',
    ]);
    // the cash is typed short of what is to be collected, then the close asked, then confirmed
    expect(walk.screens[2].scene!.steps).toEqual([
      { fill: 'reconcile.cash', text: expect.stringMatching(/^\d+$/) as string },
    ]);
    expect(walk.screens[3].scene!.steps!.at(-1)).toEqual({ press: 'reconcile.close' });
    expect(walk.screens[4].scene!.steps!.at(-1)).toEqual({ press: 'reconcile.closeConfirm' });
    expect(walk.screens[5].scene!.path).toBe('/deliveries?day=2026-11-03');
  });

  it('Each day’s end screen opens in the walk spec as its scene does: the cue it names, and the clock at the data set’s today', () => {
    const spec = read('specs/reconcile.spec.ts');
    const parts = spec.slice(spec.indexOf('async function walk(')).split(/await at\('([^']+)'/);
    const before = new Map<string, string>();
    for (let index = 1; index < parts.length; index += 2)
      before.set(parts[index], parts[index - 1]);

    for (const screen of WALKS[11].screens) {
      const { cue } = screen.scene!;
      const steps = before.get(screen.id)!;
      const opened = [...steps.matchAll(/(?:asked|typed|open)\(([^)]*)\)/g)].at(-1)?.[1] ?? '';
      expect(opened.includes(`cue: '${cue}'`), `${screen.id}: cue`).toBe(cue !== undefined);
    }
    expect(spec).toContain('await page.clock.setFixedTime(CLOCK);');
    expect(spec).toContain('DEMO_TODAY.split');
  });
});

// @vitest-environment node
import { readFileSync } from 'node:fs';
import { SCREENS } from '@credo/ui/mock';
import { describe, expect, it } from 'vitest';
import { allKeys, answerKey, DEVICE_WIDTH, PARTS, PEOPLE, resolveStates, WALKS } from './walks';

describe('the walks', () => {
  it('Each walk screen names a state the mock draws', () => {
    const states = resolveStates(WALKS, SCREENS);

    expect(states.size).toBe(8);
    expect(states.get('admin-setup:8-save-conflict')!.id).toBe('conflict');
    expect(states.get('admin-setup:7-save-failed')!.id).toBe('save-failed');
    expect(states.get('admin-setup:1-sign-in')!.id).toBe('empty');
  });

  it('One it lacks stops the build, naming it', () => {
    const lacking = (screen: number, state: string) => [
      {
        ...WALKS[0],
        screens: [{ ...WALKS[0].screens[0], id: 'x', mock: { screen, state } }],
      },
    ];

    expect(() => resolveStates(lacking(3, 'no-such-state'), SCREENS)).toThrow(
      'walk admin-setup, screen x: the mock draws no state "3 no-such-state"',
    );
    expect(() => resolveStates(lacking(99, 'empty'), SCREENS)).toThrow('"99 empty"');
  });

  it('holds piece 1’s eight screens, in the app frame’s numbers, the main path before what can go wrong', () => {
    const screens = WALKS[0].screens;

    expect(screens.map((screen) => screen.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(screens.filter((screen) => screen.path === 'main').map((s) => s.number)).toEqual([
      1, 3, 4, 5,
    ]);
    expect(screens.filter((screen) => screen.path === 'wrong').map((s) => s.number)).toEqual([
      2, 6, 7, 8,
    ]);
  });

  it('puts the walk in the map’s people and parts, each person on a device with a width', () => {
    const walk = WALKS[0];

    expect(PEOPLE.map((person) => person.id)).toContain(walk.person);
    expect(PARTS.map((part) => part.id)).toContain(walk.part);
    expect(PEOPLE.find((person) => person.id === walk.person)!.device).toBe('pc');
    expect(DEVICE_WIDTH).toEqual({ pc: 1280, tablet: 768, phone: 390 });
  });

  it('keys an answer by walk, screen and language, sixteen for the eight screens', () => {
    expect(answerKey('w', '1-a', 'vi')).toBe('w:1-a:vi');
    expect(allKeys(WALKS)).toHaveLength(16);
    expect(allKeys(WALKS)[0]).toBe('admin-setup:1-sign-in:vi');
  });

  it('names the same eight screens as the walk spec, which makes their base images', () => {
    const spec = readFileSync(new URL('../../walk/specs/piece-1.spec.ts', import.meta.url), 'utf8');
    const inSpec = [...spec.matchAll(/await at\('([^']+)'\)/g)].map((m) => m[1]);

    expect(inSpec.sort()).toEqual(WALKS[0].screens.map((screen) => screen.id).sort());
  });

  it('shoots the walk at the widths the report draws, the width in each image’s name', () => {
    const spec = readFileSync(new URL('../../walk/specs/piece-1.spec.ts', import.meta.url), 'utf8');
    const widths = /const WIDTHS = \{ pc: (\d+), tablet: (\d+), phone: (\d+) \} as const/.exec(
      spec,
    )!;

    expect(widths.slice(1).map(Number)).toEqual([
      DEVICE_WIDTH.pc,
      DEVICE_WIDTH.tablet,
      DEVICE_WIDTH.phone,
    ]);
    expect(spec).toContain('`${screen}-${language}-${width}.png`');
  });

  it('parks the pointer before each shot and compares with no tolerance in pixels or in colour', () => {
    const spec = readFileSync(new URL('../../walk/specs/piece-1.spec.ts', import.meta.url), 'utf8');
    const config = readFileSync(
      new URL('../../walk/playwright.config.ts', import.meta.url),
      'utf8',
    );

    expect(spec.indexOf('await page.mouse.move(0, 0);')).toBeGreaterThan(-1);
    expect(spec.indexOf('await page.mouse.move(0, 0);')).toBeLessThan(
      spec.indexOf('await expect(page).toHaveScreenshot'),
    );
    expect(config).toContain('maxDiffPixels: 0, threshold: 0');
  });
});

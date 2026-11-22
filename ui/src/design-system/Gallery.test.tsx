import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { CREDO_COLOUR } from '@credo/shared';
import { DEMO_CONFIG } from '@credo/shared/demo';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openApp } from '../../tests/open';
import { Gallery } from './Gallery';
import { ENTRIES, slugOf } from './entries';
import { followedWords, heldWords } from './Charter';
import { GUIDELINE } from './guideline';
import { ContractPanel, FormMessageStates, PageStateStates } from './Contract';
import { CredoMantine } from './CredoMantine';
import { contrast, onBrand, onWhite, beforeOf, type Surface } from './onBrand';
import {
  HEADER_WASHES,
  ICON_SIZES,
  MENU_WASHES,
  ON_BRAND,
  RADII,
  ROLES,
  SIZES,
  SPACING,
  TONES,
  TYPE,
  WEIGHTS,
  WIDTHS,
} from './tokens';
import { credoVariables } from './cssVariables';
import { PALETTES } from './palettes';
import { shadesOf } from './appTheme';

// Every component file of the three folders, by level and name: the list must hold each.
const FILES = Object.keys(
  import.meta.glob(['../components/*/*.tsx', '!../components/*/*.test.tsx']),
);
const found = FILES.map((path) => path.split('/').slice(-2)).map(([level, file]) => ({
  level: level,
  name: file.replace('.tsx', ''),
}));

// The same files read as text: each one's doc comment and props.
const SOURCES = import.meta.glob(['../components/*/*.tsx', '!../components/*/*.test.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

const HEADINGS: Record<string, string> = {
  atoms: 'Atoms',
  molecules: 'Molecules',
  organisms: 'Organisms',
};

const BASE = '/48b74d079/gallery';

function open(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Gallery test />
    </MemoryRouter>,
  );
}

const list = () => within(screen.getByRole('navigation', { name: 'Parts' }));
const part = () => within(screen.getByRole('article'));
const bar = () => within(screen.getByRole('banner'));
const about = () => within(screen.getByRole('complementary', { name: 'About this part' }));
// Each state is a figure named for it, so a sample's own headings are not taken for states.
const stateNames = () =>
  part()
    .getAllByRole('figure')
    .map((figure) => figure.getAttribute('aria-label'));

describe('Gallery', () => {
  it("writes the roles' variables the swatches read, as the app does", () => {
    open(`${BASE}/foundations/values`);

    const style = document.querySelector('style[data-mantine-styles]')?.textContent ?? '';
    const names = Object.keys(ROLES);
    expect(names.length).toBeGreaterThan(1);
    for (const name of names) expect(style).toContain(`--credo-${name}: `);
  });

  it('213 case 4: lists Start here, Foundations, Rules, Pages, Atoms, Molecules and Organisms in order, each with its count and every component file of its level', () => {
    open(`${BASE}/atoms/field-label`);

    const heads = list()
      .getAllByRole('heading')
      .map((heading) => heading.textContent);
    expect(heads).toEqual([
      'Start here',
      'Foundations',
      'Rules',
      'Pages',
      'Atoms',
      'Molecules',
      'Organisms',
    ]);
    expect(found.length).toBeGreaterThan(0);
    expect(list().getByRole('region', { name: 'Start here' }).textContent).toContain('1');
    expect(list().getByRole('region', { name: 'Foundations' }).textContent).toContain('3');
    for (const [level, heading] of Object.entries(HEADINGS)) {
      // A part to come has its entry and no file yet.
      const coming = ENTRIES.filter((entry) => entry.toCome && entry.group === heading);
      const files = [
        ...found.filter((file) => file.level === level),
        ...coming.map(({ name }) => ({ level, name })),
      ];
      const group = within(list().getByRole('region', { name: heading }));
      expect(group.getAllByRole('link')).toHaveLength(files.length);
      expect(group.getByText(String(files.length))).toBeDefined();
      for (const { name } of files) {
        expect(group.getByRole('link', { name })).toBeDefined();
      }
    }
  });

  it('5: a part’s address opens that part alone, with its group, name, description, props and states', () => {
    open(`${BASE}/organisms/door-card`);

    expect(part().getByRole('heading', { level: 2, name: 'DoorCard' })).toBeDefined();
    expect(part().getByText(/^A door’s card|^A door's card/)).toBeDefined();
    expect(part().getByText('name: string · logo?: string · children: ReactNode')).toBeDefined();
    expect(stateNames()).toEqual(['Sign-in', 'Login link']);
    expect(screen.queryByRole('heading', { level: 2, name: 'FieldLabel' })).toBeNull();
    expect(screen.getAllByRole('article')).toHaveLength(1);
  });

  it('213 case 5: the bare address opens the charter and the list marks it current', () => {
    open(BASE);

    expect(part().getByRole('heading', { level: 2, name: 'The charter' })).toBeDefined();
    expect(list().getByRole('link', { name: 'The charter' }).getAttribute('aria-current')).toBe(
      'page',
    );
    expect(list().getByRole('link', { name: 'Values' }).getAttribute('aria-current')).toBeNull();
    expect(
      list().getByRole('link', { name: 'FieldLabel' }).getAttribute('aria-current'),
    ).toBeNull();
  });

  it('213 case 7: the charter draws its words from guideline.ts, the same text', () => {
    open(BASE);

    const { goal, credo, readers, lookHere, rules } = GUIDELINE.charter;
    expect(readers).toHaveLength(2);
    expect(lookHere.length).toBeGreaterThan(1);
    expect(rules.length).toBeGreaterThan(1);
    const plate = within(part().getByRole('figure', { name: 'The charter' }));
    expect(plate.getByText(goal)).toBeDefined();
    expect(plate.getByText(credo)).toBeDefined();
    for (const { reader, does } of readers) {
      expect(plate.getByText(`${reader}.`)).toBeDefined();
      expect(plate.getByText(does, { exact: false })).toBeDefined();
    }
    for (const { need, where } of lookHere) {
      expect(plate.getByText(`${need}.`)).toBeDefined();
      expect(plate.getByText(where, { exact: false })).toBeDefined();
    }
    for (const rule of rules) {
      expect(plate.getByText(rule.says)).toBeDefined();
      expect(plate.getByText(rule.why)).toBeDefined();
    }
    // Each rule's caption says what holds it and whether the app follows it.
    expect(plate.getAllByText(/^Held by /)).toHaveLength(rules.length);
    const unmet = rules.filter((rule) => rule.followed !== 'yes');
    expect(unmet.length).toBeGreaterThan(0);
    expect(plate.getAllByText(/The app follows it\.$/)).toHaveLength(rules.length - unmet.length);
    expect(plate.getAllByText(/Not yet: open item \d+ moves it\.$/)).toHaveLength(unmet.length);
  });

  it('7: an address that names no part says so beside the list and draws no part', () => {
    open(`${BASE}/atoms/nothing-here`);

    expect(screen.getByRole('status').textContent).toContain('No part has this address');
    expect(screen.queryByRole('article')).toBeNull();
    expect(list().getAllByRole('link').length).toBeGreaterThan(0);
    expect(list().queryAllByRole('link', { current: 'page' })).toHaveLength(0);
  });

  it('8: each component’s description and props in the table are its file’s doc comment and props', async () => {
    const user = userEvent.setup();
    open(BASE);

    for (const [path, source] of Object.entries(SOURCES)) {
      const text = source;
      const name = path.split('/').pop()!.replace('.tsx', '');
      const docMatch = /\/\*\* ([\s\S]*?) \*\/\nexport function/.exec(text);
      expect(docMatch, `${path}: a one-block doc comment over \`export function\``).not.toBeNull();
      const typedMatch = /export function \w+\(\{[^}]*\}: \{([\s\S]*?)\}\) \{/.exec(text);
      expect(typedMatch, `${path}: props typed inline as \`({ ... }: { ... })\``).not.toBeNull();
      const doc = docMatch![1];
      const typed = typedMatch![1];
      const props = typed
        .split(/;|\n/)
        .map((line) => line.trim())
        .filter((line) => line !== '')
        .join(' · ');

      await user.click(list().getByRole('link', { name }));
      expect(part().getByText(doc)).toBeDefined();
      expect(part().getByText(props)).toBeDefined();
    }
  });

  it('9: on a part of two states or more “One at a time” shows one state and a row to pick another; a part of one state has no switch; another part opens on all states', async () => {
    const user = userEvent.setup();
    open(`${BASE}/organisms/door-card`);

    expect(stateNames()).toEqual(['Sign-in', 'Login link']);
    await user.click(screen.getByRole('button', { name: 'One at a time' }));
    expect(stateNames()).toEqual(['Sign-in']);
    await user.click(screen.getByRole('button', { name: 'Login link' }));
    expect(stateNames()).toEqual(['Login link']);
    await user.click(screen.getByRole('button', { name: 'Side by side' }));
    expect(stateNames()).toEqual(['Sign-in', 'Login link']);

    await user.click(screen.getByRole('button', { name: 'One at a time' }));
    await user.click(list().getByRole('link', { name: 'PageHeader' }));
    expect(stateNames()).toEqual(['With actions', 'Title only', 'With status and subtitle']);

    await user.click(list().getByRole('link', { name: 'FieldLabel' }));
    expect(screen.queryByRole('button', { name: 'One at a time' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Side by side' })).toBeNull();
  });

  it('10: the door heading, the logo tile and the page header each draw the state the mock adds', () => {
    open(`${BASE}/atoms/door-heading`);
    expect(stateNames()).toEqual(['With subtitle', 'Title only']);
    expect(part().getAllByRole('heading', { level: 3, name: /^Đăng nhập/ })).toHaveLength(2);
    expect(part().getAllByText(/^Quét mã QR hoặc/)).toHaveLength(1);
  });

  it('10: the logo tile with no logo draws nothing, and the page header draws its title only', () => {
    open(`${BASE}/atoms/logo-tile`);
    expect(stateNames()).toEqual(['With a logo', 'No logo']);
    expect(part().getAllByRole('img')).toHaveLength(1);
    expect(part().getByText('draws nothing')).toBeDefined();
  });

  it('10: the page header draws its title alone beside the one with an action', () => {
    open(`${BASE}/organisms/page-header`);
    expect(part().getAllByRole('heading', { level: 2, name: 'Staff' })).toHaveLength(2);
    expect(part().getAllByRole('button', { name: 'Add' })).toHaveLength(1);
  });

  it('11: draws the gradient button, the default button and the divider worded “hoặc” under their part', () => {
    open(`${BASE}/foundations/mantine-in-the-theme`);

    expect(stateNames()).toEqual([
      'Button, field, badge',
      'Gradient button',
      'Default button',
      'Labelled divider',
    ]);
    expect(part().getByRole('button', { name: 'Quét mã QR' })).toBeDefined();
    expect(part().getByRole('button', { name: 'Nhập mã thủ công' })).toBeDefined();
    expect(part().getByText('hoặc')).toBeDefined();
    expect(part().getByRole('button', { name: 'Save' })).toBeDefined();
    expect(part().getByRole('textbox', { name: 'Name' })).toBeDefined();
  });

  it('11: draws the door card in two states, the sign-in and the link page, in sentence case', () => {
    open(`${BASE}/organisms/door-card`);

    expect(part().getByRole('heading', { name: 'Đăng nhập vào tài khoản của bạn' })).toBeDefined();
    expect(part().getByRole('heading', { name: 'Đăng nhập bằng liên kết' })).toBeDefined();
    expect(part().getAllByText('hoặc')).toHaveLength(2);
    expect(part().getByRole('link', { name: 'Quay lại đăng nhập' })).toBeDefined();
  });

  it('213 case 7: a rule says in words what holds it and whether the app follows it, or the item that moves it', () => {
    expect(heldWords('review')).toBe('Held by review.');
    expect(heldWords({ check: 'a/b.test.ts' })).toBe('Held by a/b.test.ts.');
    expect(followedWords('yes')).toBe('The app follows it.');
    expect(followedWords({ item: 12 })).toBe('Not yet: open item 12 moves it.');
  });

  it('11: draws the values', () => {
    open(`${BASE}/foundations/values`);

    expect(stateNames()).toEqual([
      'Palette',
      'Type',
      'Weights',
      'Sizes',
      'Spacing',
      'Widths',
      'Icons',
      'Corners and shadows',
      'Formats',
      'Roles',
      'Meanings',
    ]);
    expect(part().getAllByTitle(/^brand \d$/)).toHaveLength(10);
    expect(part().getByText(/^Type: /)).toBeDefined();
    for (const style of Object.keys(TYPE)) expect(part().getByText(style)).toBeDefined();
    for (const role of [
      ...Object.keys(ROLES),
      ...ON_BRAND,
      ...Object.keys(HEADER_WASHES),
      ...Object.keys(MENU_WASHES),
    ])
      expect(part().getByText(role, { exact: true })).toBeDefined();
    // A swatch draws the variable the app writes, not the table's value.
    expect(part().getByText('brand-text', { exact: true }).previousElementSibling).toHaveProperty(
      'style.background',
      'var(--credo-brand-text)',
    );
  });

  it('213 case 8: Values gives each role, on-brand value, wash, style and meaning its use line, from the guideline', () => {
    open(`${BASE}/foundations/values`);
    const { roles, styles, tones } = GUIDELINE.values;
    // A table that found nothing would quiet the loops below.
    expect(Object.keys(roles).length).toBe(
      Object.keys(ROLES).length +
        ON_BRAND.length +
        Object.keys(HEADER_WASHES).length +
        Object.keys(MENU_WASHES).length,
    );
    for (const line of [...Object.values(roles), ...Object.values(styles), ...Object.values(tones)])
      expect(part().getAllByText(line, { exact: true }).length).toBeGreaterThan(0);
    // A line is a sentence, not a name left to be filled.
    for (const line of Object.values(roles)) expect(line.length).toBeGreaterThan(10);
  });

  it('213 case 8: Values gives each spacing step, width, icon size, corner, shadow and format its use line, from the guideline, next to its value', () => {
    open(`${BASE}/foundations/values`);
    const { spacing, widths, icons, corners, shadows, formats } = GUIDELINE.values;
    const tables = [
      [spacing, Object.keys(SPACING), 5],
      [widths, Object.keys(WIDTHS), 6],
      [icons, Object.keys(ICON_SIZES), 5],
      [corners, Object.keys(RADII), 5],
      [shadows, ['lg', 'xl', 'bar-shadow', 'header-shadow'], 4],
      [formats, ['money', 'date', 'time'], 3],
    ] as const;
    for (const [table, keys, count] of tables) {
      // A table of another size would quiet the check on its keys.
      expect(Object.keys(table)).toEqual(keys);
      expect(keys).toHaveLength(count);
      for (const [name, line] of Object.entries(table)) {
        expect(line.length).toBeGreaterThan(20);
        const row = part().getAllByText(line)[0]?.parentElement;
        expect(row?.textContent).toContain(name);
      }
    }
    // The value drawn is the table's, not a copy: its own text, beside its name.
    const valueOf = (name: string, value: string) =>
      part()
        .getAllByText(name, { exact: true })
        .some((el) => el.nextElementSibling?.textContent === value);
    expect(valueOf('md', SPACING.md)).toBe(true);
    expect(valueOf('card', `${WIDTHS.card} px`)).toBe(true);
    expect(valueOf('mark', `${ICON_SIZES.mark} px`)).toBe(true);
    expect(valueOf('xl', RADII.xl)).toBe(true);
  });

  it('213 case 9: Values draws each role’s value as credoVariables writes it for the chosen colour, and it follows the colour', async () => {
    const written = (colour: string) =>
      credoVariables({ colors: { brand: shadesOf(colour) } } as never).variables;
    const names = Object.keys(GUIDELINE.values.roles);
    const read = () =>
      Object.fromEntries(
        names.map((role) => [
          role,
          part().getByText(role, { exact: true }).nextElementSibling?.textContent,
        ]),
      );
    open(`${BASE}/foundations/values`);
    const steel = written(CREDO_COLOUR);
    expect(read()).toEqual(
      Object.fromEntries(names.map((role) => [role, steel[`--credo-${role}`]])),
    );
    expect(steel['--credo-header-chip']).toMatch(/^rgba\(/);

    const user = userEvent.setup();
    await user.click(screen.getByRole('combobox', { name: 'Colour theme' }));
    await user.click(
      within(await screen.findByRole('listbox')).getByRole('option', { name: 'Emerald' }),
    );
    const emerald = written(PALETTES.find(({ name }) => name === 'emerald')!.shades[7]);
    expect(read()).toEqual(
      Object.fromEntries(names.map((role) => [role, emerald[`--credo-${role}`]])),
    );
    // A value that follows the colour moves with it: some stock colour writes a role differently.
    expect(
      PALETTES.some(({ shades }) =>
        names.some((role) => written(shades[7])[`--credo-${role}`] !== steel[`--credo-${role}`]),
      ),
    ).toBe(true);
    window.localStorage.clear();
  });

  it('213 case 10: Values draws each text style’s size, line height, weight and spacing, its name in plain letters', () => {
    open(`${BASE}/foundations/values`);
    const FACTS: Record<keyof typeof TYPE, string> = {
      pageTitle: 'size 22 px · line height 1.4 · weight 700 · spacing 0 px',
      sectionLabel: 'size 12 px · line height 1.4 · weight 700 · spacing 0.5 px',
      fieldLabel: 'size 12 px · line height 1.4 · weight 600 · spacing 0.3 px',
      body: 'size 16 px · line height 1.55 · weight 400 · spacing 0 px',
      bodyStrong: 'size 16 px · line height 1.55 · weight 600 · spacing 0 px',
      caption: 'size 14 px · line height 1.45 · weight 400 · spacing 0 px',
    };
    for (const [name, facts] of Object.entries(FACTS)) {
      const plain = part().getByText(name, { exact: true });
      // The name is written as typed, outside any style that would change its letters.
      expect(plain.style.textTransform).toBe('');
      expect(plain.nextElementSibling?.textContent).toBe(facts);
    }
    expect(Object.keys(FACTS)).toEqual(Object.keys(TYPE));
  });

  it('213 case 8: Values draws each note at the top of the state it is about, and no state draws another’s', () => {
    open(`${BASE}/foundations/values`);
    const { notes } = GUIDELINE.values;
    // A guideline with a note short of a state would quiet the loop below.
    expect(new Set(notes.map((note) => note.about)).size).toBe(4);
    const states = {
      tones: 'Meanings',
      styles: 'Type',
      widths: 'Widths',
      icons: 'Icons',
      formats: 'Formats',
    } as const;
    for (const { about, text } of notes) {
      for (const [other, state] of Object.entries(states)) {
        const plate = within(part().getByRole('figure', { name: state }));
        if (other === about) expect(plate.getAllByText(text)).toHaveLength(1);
        else expect(plate.queryByText(text)).toBeNull();
      }
    }
  });

  it('213 case 8: Values draws the four meanings, each with the Mantine colour that draws it and its line', () => {
    open(`${BASE}/foundations/values`);
    for (const [tone, colour] of Object.entries(TONES)) {
      const name = part().getByText(tone, { exact: true });
      expect(name.nextElementSibling?.textContent).toBe(colour);
      expect(name.nextElementSibling?.nextElementSibling?.textContent).toBe(
        GUIDELINE.values.tones[tone as keyof typeof TONES],
      );
    }
    expect(Object.values(TONES)).toEqual(['red', 'green', 'orange', 'gray']);
  });

  it('9: On the brand draws the six colours’ header, buttons and menu, before the rule and after, each with its ratio', () => {
    open(`${BASE}/foundations/on-the-brand`);

    expect(stateNames()).toEqual(['Buttons', 'Header', 'Menu', 'Links']);
    const surfaces: [string, Surface][] = [
      ['Buttons', 'filled'],
      ['Header', 'header'],
      ['Menu', 'menu'],
    ];
    expect(PALETTES).toHaveLength(6);
    for (const [state, surface] of surfaces) {
      const plate = within(part().getByRole('figure', { name: state }));
      expect(plate.getAllByRole('row')).toHaveLength(9);
      for (const { name, shades } of PALETTES) {
        const row = within(
          plate
            .getByRole('rowheader', { name: `${name[0].toUpperCase()}${name.slice(1)}` })
            .closest('tr')!,
        );
        const tuple = shadesOf(shades[7]);
        const said = (pick: ReturnType<typeof onBrand>) => `${pick.ink} ${pick.least.toFixed(2)}:1`;
        expect(row.getAllByText(/:1$/).map((node) => node.textContent)).toEqual([
          said(beforeOf(tuple, surface)),
          said(onBrand(tuple, surface)),
        ]);
      }
    }
    // Two typed colours follow the six on each surface: the walks' company's moves a shade under
    // white, and a light one gets dark text.
    for (const [state, surface] of surfaces) {
      const plate = within(part().getByRole('figure', { name: state }));
      for (const colour of [DEMO_CONFIG.colour, '#d97757']) {
        const row = within(
          plate.getByRole('rowheader', { name: `Typed ${colour}` }).closest('tr')!,
        );
        const tuple = shadesOf(colour);
        const said = (pick: ReturnType<typeof onBrand>) => `${pick.ink} ${pick.least.toFixed(2)}:1`;
        expect(row.getAllByText(/:1$/).map((node) => node.textContent)).toEqual([
          said(beforeOf(tuple, surface)),
          said(onBrand(tuple, surface)),
        ]);
      }
    }
    const light = within(part().getByRole('figure', { name: 'Buttons' }))
      .getByRole('rowheader', { name: 'Typed #d97757' })
      .closest('tr')!;
    expect(within(light).getByText(/^dark [4-9]\.\d\d:1$/)).toBeDefined();
    const company = within(part().getByRole('figure', { name: 'Buttons' }))
      .getByRole('rowheader', { name: 'Typed #2f7d6d' })
      .closest('tr')!;
    expect(within(company).getByText('white 4.91:1')).toBeDefined();
    // Emerald's buttons, the one stock change: white fails at 3.77, dark reads at 4.71.
    const emerald = within(part().getByRole('figure', { name: 'Buttons' }))
      .getByRole('rowheader', { name: 'Emerald' })
      .closest('tr')!;
    expect(within(emerald).getByText(/^white [0-3]\.\d\d:1$/)).toBeDefined();
    expect(within(emerald).getByText(/^dark [4-9]\.\d\d:1$/)).toBeDefined();
  });

  it('19: On the brand draws a links row, before and after, each with its ratio', () => {
    open(`${BASE}/foundations/on-the-brand`);

    const plate = within(part().getByRole('figure', { name: 'Links' }));
    expect(plate.getAllByRole('row')).toHaveLength(9);
    const said = (link: ReturnType<typeof onWhite>) =>
      `${link.shade === null ? 'dark' : `shade ${link.shade}`} ${link.ratio.toFixed(2)}:1`;
    const labels = [
      ...PALETTES.map(({ name, shades }) => [
        `${name[0].toUpperCase()}${name.slice(1)}`,
        shades[7],
      ]),
      [`Typed ${DEMO_CONFIG.colour}`, DEMO_CONFIG.colour],
      ['Typed #d97757', '#d97757'],
    ];
    for (const [label, colour] of labels) {
      const shades = shadesOf(colour);
      const row = within(plate.getByRole('rowheader', { name: label }).closest('tr')!);
      expect(row.getAllByText(/:1$/).map((node) => node.textContent)).toEqual([
        `shade 6 ${contrast('#ffffff', shades[6]).toFixed(2)}:1`,
        said(onWhite(shades, 6)),
      ]);
    }
    // Emerald's links, the stock change: shade 6 reads 3.77 on white, shade 7 reads 5.48.
    const emerald = within(plate.getByRole('rowheader', { name: 'Emerald' }).closest('tr')!);
    expect(emerald.getByText('shade 6 3.77:1')).toBeDefined();
    expect(emerald.getByText('shade 7 5.48:1')).toBeDefined();
  });

  it('12: draws no picture of the old app beside any part', () => {
    open(`${BASE}/organisms/door-card`);

    expect(screen.queryByText('Legacy')).toBeNull();
    expect(screen.queryAllByRole('img', { name: /^The legacy/ })).toHaveLength(0);
  });

  it('12: is light whatever the device asks', () => {
    window.localStorage.setItem('mantine-color-scheme-value', 'dark');
    open(BASE);

    expect(document.documentElement.getAttribute('data-mantine-color-scheme')).toBe('light');
  });

  it('the side list: a button hides the whole list so the part takes the width, and shows it again', async () => {
    const user = userEvent.setup();
    open(`${BASE}/organisms/door-card`);

    await user.click(screen.getByRole('button', { name: 'Hide the list' }));
    expect(screen.queryByRole('navigation', { name: 'Parts' })).toBeNull();
    expect(part().getByRole('heading', { level: 2, name: 'DoorCard' })).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'Show the list' }).getAttribute('aria-expanded'),
    ).toBe('false');

    await user.click(screen.getByRole('button', { name: 'Show the list' }));
    expect(list().getByRole('link', { name: 'DoorCard' })).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'Hide the list' }).getAttribute('aria-expanded'),
    ).toBe('true');
  });

  it('the side list: each group folds its parts away and unfolds them again, the others left open', async () => {
    const user = userEvent.setup();
    open(`${BASE}/organisms/door-card`);
    const atoms = () => within(list().getByRole('region', { name: 'Atoms' }));

    expect(atoms().getAllByRole('link').length).toBeGreaterThan(0);
    await user.click(list().getByRole('button', { name: 'Atoms' }));
    expect(atoms().queryAllByRole('link')).toHaveLength(0);
    expect(list().getByRole('button', { name: 'Atoms' }).getAttribute('aria-expanded')).toBe(
      'false',
    );
    expect(list().getByRole('link', { name: 'DoorCard' })).toBeDefined();
    expect(list().getByRole('link', { name: 'Values' })).toBeDefined();

    await user.click(list().getByRole('button', { name: 'Atoms' }));
    expect(atoms().getByRole('link', { name: 'FieldLabel' })).toBeDefined();
    expect(list().getByRole('button', { name: 'Atoms' }).getAttribute('aria-expanded')).toBe(
      'true',
    );
  });

  it('the side list: a part with a kind sits under its kind inside its group, read from its own entry, and a kind folds its parts', async () => {
    const user = userEvent.setup();
    open(`${BASE}/atoms/field-label`);

    const kinded = ENTRIES.filter((entry) => entry.kind !== undefined);
    expect(kinded.length).toBeGreaterThan(0);
    for (const entry of kinded) {
      const group = within(list().getByRole('region', { name: entry.group }));
      const kind = within(group.getByRole('region', { name: entry.kind }));
      expect(kind.getByRole('link', { name: entry.name })).toBeDefined();
    }
    // A part with no kind sits straight under its group.
    const values = list().getByRole('link', { name: 'Values' });
    expect(values.closest('section')?.getAttribute('aria-label')).toBe('Foundations');

    const first = kinded[0];
    const kind = () => within(list().getByRole('region', { name: first.kind }));
    await user.click(list().getByRole('button', { name: first.kind }));
    expect(kind().queryByRole('link', { name: first.name })).toBeNull();
    await user.click(list().getByRole('button', { name: first.kind }));
    expect(kind().getByRole('link', { name: first.name })).toBeDefined();
  });

  it('the side list: a group and a kind folded stay folded when the list is hidden and shown again', async () => {
    const user = userEvent.setup();
    open(`${BASE}/atoms/field-label`);
    const folded = (name: string) =>
      list().getByRole('button', { name }).getAttribute('aria-expanded');

    await user.click(list().getByRole('button', { name: 'Atoms' }));
    await user.click(list().getByRole('button', { name: 'Cards' }));
    await user.click(screen.getByRole('button', { name: 'Hide the list' }));
    await user.click(screen.getByRole('button', { name: 'Show the list' }));

    expect(folded('Atoms')).toBe('false');
    expect(
      within(list().getByRole('region', { name: 'Atoms' })).queryAllByRole('link'),
    ).toHaveLength(0);
    expect(folded('Cards')).toBe('false');
    expect(
      within(list().getByRole('region', { name: 'Cards' })).queryAllByRole('link'),
    ).toHaveLength(0);
    expect(folded('Molecules')).toBe('true');
    expect(list().getByRole('link', { name: 'PageHeader' })).toBeDefined();
  });

  describe('the colour themes', () => {
    afterEach(() => {
      window.localStorage.clear();
      vi.restoreAllMocks();
    });

    const chooser = () => screen.getByRole<HTMLInputElement>('combobox', { name: 'Colour theme' });
    // Mantine's picker draws its options in a list of its own, once it is opened.
    const choose = async (name: string) => {
      const user = userEvent.setup();
      await user.click(chooser());
      await user.click(within(await screen.findByRole('listbox')).getByRole('option', { name }));
    };
    const STEEL = 'Steel · the app’s';
    // The colour every part reads, as Mantine writes it for the provider drawn last.
    const brand7 = () =>
      [...document.querySelectorAll('style[data-mantine-styles]')]
        .map((style) => /--mantine-color-brand-7:\s*([^;]+);/.exec(style.textContent ?? '')?.[1])
        .filter((value) => value !== undefined)
        .at(-1)
        ?.toLowerCase();
    const swatches = () =>
      part()
        .getAllByTitle(/^brand \d$/)
        .map((swatch) => swatch.getAttribute('style'));

    it('the colour themes: the picker is Mantine’s own, labelled in sight, offers every stock palette by name, steel, emerald and brick among them, and opens on the app’s own', async () => {
      const user = userEvent.setup();
      open(BASE);
      expect(chooser().tagName).toBe('INPUT');
      expect(screen.getByText('Colour theme').tagName).toBe('LABEL');
      expect(chooser().value).toBe(STEEL);
      expect(brand7()).toBe(CREDO_COLOUR);

      await user.click(chooser());
      const options = within(await screen.findByRole('listbox')).getAllByRole('option');
      expect(options.map((option) => option.textContent)).toEqual([
        'Steel · the app’s',
        'Emerald',
        'Brick',
        'Bronze',
        'Plum',
        'Indigo',
      ]);
      expect(PALETTES.map(({ name }) => name)).toHaveLength(options.length);
      expect(options.filter((option) => option.getAttribute('aria-selected') === 'true')).toEqual([
        options[0],
      ]);

      // Picking the theme already chosen keeps it: the picker is never left empty.
      await user.click(options[6]);
      expect(chooser().value).toBe(STEEL);
      expect(brand7()).toBe(CREDO_COLOUR);
    });

    it('the colour themes: a remembered value no palette has opens on the app’s own colour', () => {
      window.localStorage.setItem('credo-gallery-theme', '#123456');
      open(BASE);

      expect(chooser().value).toBe(STEEL);
      expect(brand7()).toBe(CREDO_COLOUR);
    });

    it('the colour themes: choosing one redraws every part in it, the Foundations’ palette included, and the browser remembers it', async () => {
      open(`${BASE}/foundations/values`);
      const before = swatches();
      const emerald = PALETTES.find(({ name }) => name === 'emerald')!;

      await choose('Emerald');
      expect(brand7()).toBe(emerald.shades[7]);
      const after = swatches();
      expect(after).toHaveLength(10);
      after.forEach((style, at) => expect(style).not.toBe(before[at]));

      cleanup();
      open(`${BASE}/foundations/values`);
      expect(chooser().value).toBe('Emerald');
      expect(brand7()).toBe(emerald.shades[7]);
      expect(swatches()).toEqual(after);
    });

    it('the colour themes: they are the gallery’s alone, the app outside it keeps its own colour, and with no browser storage the gallery still draws and switches', async () => {
      open(BASE);
      await choose('Brick');
      cleanup();

      // The app as `App.tsx` draws it, at the operator's door, which wears credo's own colour.
      openApp('/operator', { operator: true });
      expect(brand7()).toBe(CREDO_COLOUR);
      cleanup();

      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('no storage');
      });
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('no storage');
      });
      open(BASE);
      expect(chooser().value).toBe(STEEL);
      await choose('Emerald');
      expect(brand7()).toBe(PALETTES.find(({ name }) => name === 'emerald')!.shades[7]);
    });
  });

  it('the workbench: the top bar carries the title and the part’s path, and neither a tagline nor the page’s address', () => {
    open(`${BASE}/organisms/door-card`);

    expect(bar().getByRole('heading', { level: 1, name: 'Design system' })).toBeDefined();
    expect(bar().getByText('Organisms / Cards /')).toBeDefined();
    expect(bar().getByText('DoorCard')).toBeDefined();
    expect(screen.queryByText('Every part, one at a time')).toBeNull();
    expect(screen.queryByText(BASE)).toBeNull();
    expect(bar().queryByRole('combobox')).toBeNull();
  });

  it('the workbench: a part with no kind has its group and name for a path, and an address naming no part has none', () => {
    open(`${BASE}/foundations/values`);
    expect(bar().getByText('Foundations /')).toBeDefined();
    expect(bar().getByText('Values')).toBeDefined();
    cleanup();

    open(`${BASE}/organisms/no-such-part`);
    expect(bar().queryByText(/\//)).toBeNull();
  });

  it('the workbench: the right column holds the part’s name, description, props, the Show switch, the states to pick and the theme picker', async () => {
    const user = userEvent.setup();
    open(`${BASE}/organisms/door-card`);

    expect(about().getByRole('heading', { level: 2, name: 'DoorCard' })).toBeDefined();
    expect(about().getByText(/^A door’s card|^A door's card/)).toBeDefined();
    expect(about().getByRole('heading', { level: 3, name: 'Props' })).toBeDefined();
    expect(about().getByText('name: string · logo?: string · children: ReactNode')).toBeDefined();
    expect(about().getByRole('heading', { level: 3, name: 'Show' })).toBeDefined();
    expect(about().getByRole('combobox', { name: 'Colour theme' })).toBeDefined();
    expect(about().queryAllByRole('figure')).toHaveLength(0);

    await user.click(about().getByRole('button', { name: 'One at a time' }));
    expect(about().getByRole('button', { name: 'Login link' })).toBeDefined();
  });

  it('the workbench: each state is a plate on the stage with its name under it, outside the right column', () => {
    open(`${BASE}/organisms/door-card`);

    const plate = part().getByRole('figure', { name: 'Sign-in' });
    expect(within(plate).getByText('Sign-in').tagName).toBe('FIGCAPTION');
    expect(plate.closest('aside')).toBeNull();
  });

  it('the workbench: an address that names no part keeps the theme picker beside its message', () => {
    open(`${BASE}/organisms/no-such-part`);

    expect(screen.getByRole('combobox', { name: 'Colour theme' })).toBeDefined();
    expect(screen.queryByRole('complementary', { name: 'About this part' })).toBeNull();
  });

  it('213 case 1: every entry carries one to three use lines and one to three don’t-use lines', () => {
    expect(ENTRIES).toHaveLength(25);
    for (const entry of ENTRIES) {
      for (const lines of [entry.useWhen, entry.dontUseWhen]) {
        expect(lines.length, entry.name).toBeGreaterThanOrEqual(1);
        expect(lines.length, entry.name).toBeLessThanOrEqual(3);
        for (const line of lines) expect(line.trim(), entry.name).not.toBe('');
      }
    }
  });

  it('213 case 2: an entry’s “instead” names an entry that exists, and the panel links to its address', () => {
    const withInstead = ENTRIES.filter((entry) => entry.instead !== undefined);
    expect(withInstead.length).toBeGreaterThan(0);
    for (const entry of withInstead) {
      const target = ENTRIES.find(({ name }) => name === entry.instead);
      expect(target, `${entry.name} instead ${entry.instead}`).toBeDefined();
      expect(target?.name).not.toBe(entry.name);

      open(`${BASE}/${slugOf(entry.group)}/${slugOf(entry.name)}`);
      const link = about().getByRole('link', { name: entry.instead });
      expect(link.getAttribute('href')).toBe(
        `${BASE}/${slugOf(target!.group)}/${slugOf(target!.name)}`,
      );
      cleanup();
    }

    open(`${BASE}/atoms/field-label`);
    expect(about().queryByText(/^Instead:/)).not.toBeNull();
    cleanup();
    open(`${BASE}/atoms/back-link`);
    expect(about().queryByText(/^Instead:/)).toBeNull();
  });

  it('213 case 3: the side panel shows the part’s use lines under its description, before its props', () => {
    for (const entry of ENTRIES) {
      open(`${BASE}/${slugOf(entry.group)}/${slugOf(entry.name)}`);
      const side = about();
      const use = side.getByRole('heading', { level: 3, name: 'Use when' });
      const dont = side.getByRole('heading', { level: 3, name: 'Don’t use when' });
      for (const line of [...entry.useWhen, ...entry.dontUseWhen]) {
        expect(side.getByText(line), entry.name).toBeDefined();
      }
      const before = (a: Node, b: Node) =>
        Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
      expect(before(side.getByText(entry.description), use), entry.name).toBe(true);
      expect(before(use, dont), entry.name).toBe(true);
      expect(before(dont, side.getByRole('heading', { level: 3, name: 'Props' })), entry.name).toBe(
        true,
      );
      cleanup();
    }
  });

  it('3: asks search engines not to list it and carries its title', () => {
    open(BASE);

    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'noindex',
    );
    expect(document.title).toBe('Credo: the design system’s gallery');
  });

  it('213 case 21: Values gives each weight and each size its use line, from the guideline, beside its value', () => {
    open(`${BASE}/foundations/values`);
    const { weights, sizes } = GUIDELINE.values;
    for (const [table, values, unit] of [
      [weights, WEIGHTS, ''],
      [sizes, SIZES, ' px'],
    ] as const) {
      expect(Object.keys(table)).toEqual(Object.keys(values));
      for (const [name, line] of Object.entries(table)) {
        const row = part().getAllByText(line)[0]?.parentElement;
        expect(row?.textContent, name).toContain(name);
        expect(row?.textContent, name).toContain(
          `${String(values[name as keyof typeof values])}${unit}`,
        );
      }
    }
  });

  it('213 case 13: the entries of FormMessage and PageState draw each kind and state at its contract’s tone and role', () => {
    const states = (name: string) =>
      GUIDELINE.contracts.find((contract) => contract.part === name)!.states;
    // A contract that lost its states would quiet the loops below.
    expect(states('FormMessage').map((state) => state.name)).toEqual([
      'Error',
      'Warning',
      'Success',
      'Info',
      'Saved',
      'Standing',
    ]);
    expect(states('PageState').map((state) => state.name)).toEqual([
      'Loading',
      'Failed',
      'Forbidden',
      'Nothing',
      'Empty',
      'Not found',
    ]);
    const entry = (name: string) => ENTRIES.find((each) => each.name === name)!;
    expect(entry('FormMessage').states).toBe(FormMessageStates);
    expect(entry('PageState').states).toBe(PageStateStates);
    let toned = 0;
    for (const name of ['FormMessage', 'PageState']) {
      open(`${BASE}/${slugOf(entry(name).group)}/${slugOf(name)}`);
      for (const { name: state, tone, role } of states(name)) {
        const plate = within(part().getByRole('figure', { name: state }));
        if (role) {
          const spoken = plate.getByRole(role);
          if (tone) {
            toned += 1;
            expect(spoken.getAttribute('class') ?? '', state).toContain('Alert');
            expect(spoken.getAttribute('style'), state).toContain(
              `--mantine-color-${TONES[tone]}-`,
            );
          }
        }
      }
      cleanup();
    }
    expect(toned).toBe(7);
    // The spoken roles split as the contract says: an error and a warning alert, the rest are status.
    open(`${BASE}/molecules/form-message`);
    expect(part().getAllByRole('alert')).toHaveLength(2);
    expect(part().getAllByRole('status')).toHaveLength(3);
    expect(part().getAllByRole('note')).toHaveLength(1);
    cleanup();
    open(`${BASE}/organisms/page-state`);
    expect(part().getAllByRole('alert')).toHaveLength(1);
    expect(part().getAllByRole('status')).toHaveLength(4);
    // The failed plate's sample retry acts without a page behind it: the press changes nothing.
    fireEvent.click(within(part().getByRole('figure', { name: 'Failed' })).getByRole('button'));
    expect(part().getAllByRole('alert')).toHaveLength(1);
    // The loader is named by the dictionary's words; this draw loads none, so its key is the name.
    expect(
      within(part().getByRole('figure', { name: 'Loading' })).getByLabelText(
        /^(Loading\.\.\.|common\.loading)$/,
      ),
    ).toBeDefined();
  });

  it('213 case 13: a part’s panel shows what it takes and what it decides, and the item that moves the screens', () => {
    open(`${BASE}/molecules/form-message`);
    const side = about();
    const takes = side.getByRole('heading', { level: 3, name: 'Takes from a screen' });
    const decides = side.getByRole('heading', { level: 3, name: 'Decides itself' });
    expect(takes.compareDocumentPosition(decides) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const { takes: given, decides: decided } = GUIDELINE.contracts[0];
    for (const { prop } of given) expect(side.getByText(prop, { exact: true })).toBeDefined();
    for (const { what } of decided)
      expect(side.getByText(new RegExp(what.slice(0, 20)))).toBeDefined();
    expect(side.getByText(/Built and in use; .* open item 651 moves them\./)).toBeDefined();
    cleanup();
    // A page with no contract has neither section: Values is no part.
    open(`${BASE}/foundations/values`);
    expect(about().queryByRole('heading', { name: 'Takes from a screen' })).toBeNull();
  });

  it('213 case 15: the entry of ActionButton draws a button at each meaning’s look, a danger red', () => {
    const states = GUIDELINE.contracts.find((contract) => contract.part === 'ActionButton')!.states;
    expect(states.map((state) => state.look)).toEqual(['filled', 'default', 'subtle', 'red']);
    open(`${BASE}/atoms/action-button`);
    const looks = states.map(({ name }) =>
      within(part().getByRole('figure', { name })).getByRole('button'),
    );
    expect(looks.map((button) => button.getAttribute('data-variant'))).toEqual([
      'filled',
      'default',
      'subtle',
      'filled',
    ]);
    expect(looks[3].getAttribute('style')).toContain(`--mantine-color-${TONES.danger}-`);
    expect(looks[0].getAttribute('style') ?? '').not.toContain(`--mantine-color-${TONES.danger}-`);
    expect(about().getByText(/The app follows it\./)).toBeDefined();
  });

  it('213 case 14: the entry of StatusBadge draws each status of the records in its word, a built part’s panel saying it is in use', () => {
    open(`${BASE}/atoms/status-badge`);
    expect(stateNames()).toEqual(['An order', 'A delivery request', 'A person']);
    const chips = [...document.querySelectorAll('[data-status]')];
    expect(chips.map((chip) => chip.getAttribute('data-status'))).toEqual([
      'draft',
      'confirmed',
      'fulfilled',
      'cancelled',
      'waiting',
      'delivered',
      'cancelled',
      'active',
      'inactive',
    ]);
    expect(chips.map((chip) => chip.textContent)).toEqual([
      'Draft',
      'Confirmed',
      'Delivered',
      'Cancelled',
      'Pending delivery',
      'Delivered',
      'Cancelled',
      'Active',
      'Inactive',
    ]);
    expect(about().getByText(/Built and in use; .* open item 651 moves them\./)).toBeDefined();
  });

  it('213 case 13: a built part’s contract says the app follows it, and has no “to come”', () => {
    render(
      <CredoMantine colour={CREDO_COLOUR} test>
        <ContractPanel contract={{ ...GUIDELINE.contracts[0], followed: 'yes' }} />
      </CredoMantine>,
    );
    expect(screen.getByText(/The app follows it\./)).toBeDefined();
    expect(screen.queryByText(/To come/)).toBeNull();
  });

  it('213 case 13: a part not yet built has its panel say it is to come, and the item that builds it', () => {
    render(
      <CredoMantine colour={CREDO_COLOUR} test>
        <ContractPanel contract={{ ...GUIDELINE.contracts[0], followed: { item: 651 } }} />
      </CredoMantine>,
    );
    expect(screen.getByText(/To come: open item 651 builds it\./)).toBeDefined();
  });

  it('213 case 16: each slot of the page base is an entry with a contract, and the base draws a page from them', async () => {
    const SLOTS = [
      'PageShell',
      'PageHeader',
      'SectionCard',
      'DetailColumns',
      'FieldPair',
      'BackLink',
      'ListTable',
    ];
    // The Pages group holds the base and four of the slots; the other three sit in their levels.
    const inPages = ENTRIES.filter((entry) => entry.group === 'Pages').map((entry) => entry.name);
    expect(inPages).toEqual([
      'The page base',
      'PageShell',
      'DetailColumns',
      'FieldPair',
      'ListTable',
    ]);
    for (const name of SLOTS) {
      const entry = ENTRIES.find((each) => each.name === name);
      expect(entry, name).toBeDefined();
      expect(
        GUIDELINE.contracts.find((contract) => contract.part === name),
        name,
      ).toBeDefined();
      open(`${BASE}/${slugOf(entry!.group)}/${slugOf(name)}`);
      expect(about().getByRole('heading', { level: 3, name: 'Takes from a screen' })).toBeDefined();
      expect(about().getByRole('heading', { level: 3, name: 'Decides itself' })).toBeDefined();
      cleanup();
    }
    // The table's least width is a key of `WIDTHS`, with its use line (item 653).
    const table = GUIDELINE.contracts.find((contract) => contract.part === 'ListTable')!;
    expect(table.decides.flatMap((decision) => decision.from)).toContainEqual({
      table: 'WIDTHS',
      key: 'table',
    });
    expect(GUIDELINE.values.widths.table.length).toBeGreaterThan(20);
    // The base draws the frame, then a page whose every slot is a part.
    open(`${BASE}/pages/the-page-base`);
    expect(stateNames()).toEqual(['The frame', 'A page, from parts']);
    const frame = within(part().getByRole('figure', { name: 'The frame' }));
    for (const slot of ['Header', 'Menu', 'Phone bar', 'Page']) {
      expect(frame.getByText(slot)).toBeDefined();
    }
    const page = within(part().getByRole('figure', { name: 'A page, from parts' }));
    expect(page.getByRole('link', { name: 'Back to staff' })).toBeDefined();
    expect(page.getByRole('heading', { level: 2, name: 'Staff member' })).toBeDefined();
    expect(page.getByRole('button', { name: 'Save' })).toBeDefined();
    expect(page.getAllByRole('heading', { level: 3 })).toHaveLength(3);
    expect(page.getByRole('table')).toBeDefined();
    expect(page.getAllByRole('row')).toHaveLength(4);
    expect(page.getByText('Active')).toBeDefined();
    expect(page.getByRole('status')).toBeDefined();
    cleanup();
    // A built part the screens draw says so; one no screen draws says it is not used yet.
    open(`${BASE}/pages/page-shell`);
    expect(stateNames()).toEqual(['Ready', 'Loading', 'Failed']);
    await userEvent.click(
      within(part().getByRole('figure', { name: 'Failed' })).getByRole('button', {
        name: 'Try again',
      }),
    );
    expect(about().getByText(/Built and in use; .* open item 651 moves them\./)).toBeDefined();
    cleanup();
    open(`${BASE}/atoms/back-link`);
    expect(about().getByText(/Built and in use; .* open item 651 moves them\./)).toBeDefined();
  });

  it('222 case 19: the contracts of the page base’s new takes and its two new parts are drawn, each take a content or a meaning', () => {
    const shell = GUIDELINE.contracts.find((contract) => contract.part === 'PageShell')!;
    expect(shell.takes.filter(({ prop }) => ['back', 'recordStatus'].includes(prop))).toEqual([
      expect.objectContaining({ prop: 'back', is: 'content' }),
      expect.objectContaining({ prop: 'recordStatus', is: 'meaning' }),
    ]);
    open(`${BASE}/molecules/action-row`);
    expect(stateNames()).toEqual(['Two or more', 'One']);
    expect(
      within(part().getByRole('figure', { name: 'Two or more' }))
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Cancel', 'Save a draft', 'Send']);
    expect(about().getByText(/Built and in use; .* open item 651 moves them\./)).toBeDefined();
    cleanup();
    open(`${BASE}/molecules/table-scroll`);
    expect(stateNames()).toEqual(['Default']);
    expect(about().getByText(/The app follows it\./)).toBeDefined();
    const decided = GUIDELINE.contracts.find(
      (contract) => contract.part === 'TableScroll',
    )!.decides;
    expect(decided.flatMap((decision) => decision.from)).toEqual([
      { table: 'WIDTHS', key: 'table' },
    ]);
  });

  it('213 case 17: every part’s entry draws its contract, and each duplicate’s winner is named on the other’s entry', () => {
    const parts = ENTRIES.filter(
      (entry) =>
        ['Atoms', 'Molecules', 'Organisms', 'Pages'].includes(entry.group) &&
        entry.name !== 'The page base',
    );
    // A set that found nothing would quiet the loop.
    expect(parts.length).toBe(20);
    expect(GUIDELINE.contracts.map((contract) => contract.part).sort()).toEqual(
      parts.map((entry) => entry.name).sort(),
    );
    for (const { group, name } of parts) {
      open(`${BASE}/${slugOf(group)}/${slugOf(name)}`);
      expect(
        about().getByRole('heading', { level: 3, name: 'Takes from a screen' }),
        name,
      ).toBeDefined();
      expect(
        about().getByRole('heading', { level: 3, name: 'Decides itself' }),
        name,
      ).toBeDefined();
      cleanup();
    }
    const words = (name: string) => {
      const entry = ENTRIES.find((each) => each.name === name)!;
      return [...entry.useWhen, ...entry.dontUseWhen].join(' ');
    };
    // The screens’ own frame of a door draws a card of its own: the entry names it and the winner.
    expect(words('DoorCard')).toContain('SignInFrame');
    expect(words('DetailField')).toContain('FieldPair');
    expect(words('FieldPair')).toContain('DetailField');
  });
});

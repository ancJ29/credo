import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { CREDO_COLOUR } from '@credo/shared';
import { DEMO_CONFIG } from '@credo/shared/demo';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openApp } from '../../tests/open';
import { DICTIONARIES, LANGUAGE_NAMES } from '../i18n';
import { Gallery, Part } from './Gallery';
import { ENTRIES, KIND_OF_PAGE, slugOf, type Entry } from './entries';
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
import { SAMPLES } from './samples';
import { dayOf, timeOf } from '../day';
import { marksOf, priceOf } from '../number';

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
    expect(list().getByRole('region', { name: 'Foundations' }).textContent).toContain('5');
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
    expect(
      part().getAllByRole('heading', { level: 2, name: DICTIONARIES.vi.nav.staff }),
    ).toHaveLength(2);
    expect(part().getAllByRole('button', { name: DICTIONARIES.vi.staff.add })).toHaveLength(1);
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
    expect(part().getByRole('button', { name: SAMPLES.vi.save })).toBeDefined();
    expect(part().getByRole('textbox', { name: DICTIONARIES.vi.staff.colName })).toBeDefined();
  });

  it('231 case 5: Fields draws the five kinds each with a label and a hint, an error and read-only, and the staff list’s filter bar', () => {
    open(`${BASE}/foundations/fields`);

    expect(stateNames()).toEqual([
      'Text',
      'Password',
      'Number',
      'Long text',
      'Drop-down',
      'Filter bar',
    ]);
    const { vi } = DICTIONARIES;
    const kinds = [
      ['Text', vi.addPerson.code, vi.addPerson.codeHint, vi.addPerson.codeInvalid],
      ['Password', vi.auth.password, SAMPLES.vi.passwordHint, vi.auth.refused],
      ['Number', vi.lists.columns.price, vi.lists.write.price, vi.lists.products.priceInvalid],
      ['Long text', vi.lists.columns.note, vi.import.writeNote, vi.lists.products.noteTooLong],
      ['Drop-down', vi.addPerson.department, SAMPLES.vi.departmentHint, SAMPLES.vi.departmentError],
    ];
    for (const [name, label, hint, error] of kinds) {
      const plate = within(part().getByRole('figure', { name }));
      expect(plate.getAllByText(label), name).toHaveLength(3);
      expect(plate.getByText(hint), name).toBeDefined();
      expect(plate.getByText(error), name).toBeDefined();
      const figure = part().getByRole('figure', { name });
      expect(figure.querySelectorAll('[readonly]'), name).toHaveLength(1);
      expect(figure.querySelectorAll('[data-error]').length, name).toBeGreaterThan(0);
    }
    const bar = within(part().getByRole('figure', { name: 'Filter bar' }));
    expect(bar.getByRole('textbox', { name: vi.staff.search })).toBeDefined();
    for (const name of [vi.staff.status, vi.staff.filterDepartment, vi.staff.filterPosition]) {
      expect(bar.getByRole('combobox', { name }), name).toBeDefined();
    }
  });

  it('231 case 6: DataTable draws an order’s lines under a bold total and a list whose names are links, in the picked language', () => {
    open(`${BASE}/molecules/data-table`);

    expect(stateNames()).toEqual(['Order lines', 'A list']);
    const { vi } = DICTIONARIES;
    const lines = within(part().getByRole('figure', { name: 'Order lines' }));
    for (const heading of [vi.orders.product, vi.orders.quantity, vi.orders.amount]) {
      expect(lines.getByRole('columnheader', { name: heading }), heading).toBeDefined();
    }
    const total = lines.getByRole('cell', { name: vi.orders.total }).closest('tr')!;
    expect(total.closest('tfoot')).not.toBeNull();
    expect(lines.getByRole('cell', { name: SAMPLES.vi.lines[0].name })).toBeDefined();
    const list = within(part().getByRole('figure', { name: 'A list' }));
    expect(list.getAllByRole('link').map((link) => link.textContent)).toEqual(
      SAMPLES.vi.people.map((person) => person.name),
    );
    expect(list.queryByRole('cell', { name: vi.orders.total })).toBeNull();
  });

  it('231 case 7: Panel draws a titled panel and an untitled one, in the picked language', () => {
    open(`${BASE}/organisms/panel`);

    expect(stateNames()).toEqual(['With a title', 'No title']);
    const { vi } = DICTIONARIES;
    const titled = within(part().getByRole('figure', { name: 'With a title' }));
    expect(titled.getByRole('heading', { level: 3, name: vi.settings.basics })).toBeDefined();
    expect(titled.getByText(SAMPLES.vi.shop)).toBeDefined();
    const plain = within(part().getByRole('figure', { name: 'No title' }));
    expect(plain.queryByRole('heading')).toBeNull();
    expect(plain.getByText(SAMPLES.vi.changesKept)).toBeDefined();
  });

  it('231 case 8: Choices draws the tick boxes, the switches, the one-of-many list and the segmented pick, each in the settings page’s and the permission editor’s words', () => {
    open(`${BASE}/foundations/choices`);

    expect(stateNames()).toEqual(['Tick boxes', 'Switches', 'One of many', 'Segmented pick']);
    const { vi } = DICTIONARIES;
    const plate = (name: string) => within(part().getByRole('figure', { name }));

    const ticks = plate('Tick boxes');
    const languages = ticks.getByRole('group', { name: vi.settings.languages });
    expect(within(languages).getAllByRole('checkbox')).toHaveLength(2);
    expect(
      within(languages).getByRole<HTMLInputElement>('checkbox', { name: LANGUAGE_NAMES.vi })
        .checked,
    ).toBe(true);
    expect(
      within(languages).getByRole<HTMLInputElement>('checkbox', { name: LANGUAGE_NAMES.en })
        .checked,
    ).toBe(false);
    expect(ticks.getByRole('checkbox', { name: vi.permissions.orders_canEdit })).toBeDefined();
    expect(
      ticks.getByText(vi.permissions.needs.replace('{{what}}', vi.permissions.orders_canView)),
    ).toBeDefined();

    const switches = plate('Switches').getAllByRole<HTMLInputElement>('switch');
    expect(switches.map((box) => box.checked)).toEqual([true, false, false]);
    for (const name of [vi.settings.whiteHeader, vi.settings.whiteMenu, vi.settings.menuIcons]) {
      expect(plate('Switches').getByRole('switch', { name }), name).toBeDefined();
    }

    const palettes = plate('One of many').getAllByRole<HTMLInputElement>('radio');
    expect(palettes).toHaveLength(PALETTES.length);
    expect(palettes.filter((radio) => radio.checked)).toHaveLength(1);
    expect(
      plate('One of many').getByRole('radio', { name: vi.settings.palettes.steel }),
    ).toBeDefined();

    const pick = plate('Segmented pick').getAllByRole<HTMLInputElement>('radio');
    expect(pick).toHaveLength(3);
    expect(pick.filter((radio) => radio.checked).map((radio) => radio.value)).toEqual(['inherit']);
    for (const name of [vi.permissions.inherit, vi.permissions.allow, vi.permissions.refuse]) {
      expect(plate('Segmented pick').getByRole('radio', { name }), name).toBeDefined();
    }
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

  describe('the sample language', () => {
    afterEach(() => {
      window.localStorage.clear();
      vi.restoreAllMocks();
    });

    const picker = () =>
      screen.getByRole<HTMLInputElement>('combobox', { name: 'Sample language' });
    const choose = async (name: string) => {
      const user = userEvent.setup();
      await user.click(picker());
      await user.click(within(await screen.findByRole('listbox')).getByRole('option', { name }));
    };
    const page = () => within(part().getByRole('figure', { name: 'A page, from parts' }));

    it('231 case 1: the samples are Vietnamese first, English once picked, the pick is kept, and an unknown one opens on Vietnamese', async () => {
      open(`${BASE}/pages/the-page-base`);
      expect(picker().value).toBe(LANGUAGE_NAMES.vi);
      expect(
        page().getByRole('columnheader', { name: DICTIONARIES.vi.lists.columns.name }),
      ).toBeDefined();
      expect(page().getByRole('link', { name: SAMPLES.vi.people[1].name })).toBeDefined();
      // The picker sits beside the colour theme, in one section of the right column.
      expect(picker().closest('section')).toBe(
        about().getByRole('combobox', { name: 'Colour theme' }).closest('section'),
      );

      await choose(LANGUAGE_NAMES.en);
      expect(picker().value).toBe(LANGUAGE_NAMES.en);
      expect(
        page().getByRole('columnheader', { name: DICTIONARIES.en.lists.columns.name }),
      ).toBeDefined();
      expect(page().getByRole('link', { name: SAMPLES.en.people[1].name })).toBeDefined();
      expect(page().queryByRole('link', { name: SAMPLES.vi.people[1].name })).toBeNull();

      // Kept: a gallery opened again speaks the pick, and a value no language has opens on Vietnamese.
      cleanup();
      open(`${BASE}/pages/the-page-base`);
      expect(picker().value).toBe(LANGUAGE_NAMES.en);
      cleanup();
      window.localStorage.setItem('credo-gallery-language', 'fr');
      open(`${BASE}/pages/the-page-base`);
      expect(picker().value).toBe(LANGUAGE_NAMES.vi);
      expect(
        page().getByRole('columnheader', { name: DICTIONARIES.vi.lists.columns.name }),
      ).toBeDefined();
    });

    it('231 case 1: the picker is on the page of no part, and with no browser storage the gallery opens on Vietnamese and still switches', async () => {
      open(`${BASE}/organisms/no-such-part`);
      expect(picker().value).toBe(LANGUAGE_NAMES.vi);
      cleanup();

      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('no storage');
      });
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('no storage');
      });
      open(`${BASE}/pages/the-page-base`);
      expect(picker().value).toBe(LANGUAGE_NAMES.vi);
      await choose(LANGUAGE_NAMES.en);
      expect(
        page().getByRole('columnheader', { name: DICTIONARIES.en.lists.columns.name }),
      ).toBeDefined();
    });

    it('231 case 2: a sample a screen says reads the dictionary by key, one no screen says reads samples.ts, each in the picked language', async () => {
      // The ListTable's own entry, first in Vietnamese: its headings are the dictionary's.
      open(`${BASE}/pages/list-table`);
      expect(
        part().getByRole('columnheader', { name: DICTIONARIES.vi.lists.columns.phone }),
      ).toBeDefined();
      cleanup();
      open(`${BASE}/pages/the-page-base`);
      for (const language of ['vi', 'en'] as const) {
        if (language === 'en') await choose(LANGUAGE_NAMES.en);
        const words = DICTIONARIES[language];
        // By key: the back link, the save button, the labels and the status are the screens' own.
        expect(page().getByRole('link', { name: words.staff.back })).toBeDefined();
        expect(page().getByRole('button', { name: words.person.save })).toBeDefined();
        expect(page().getAllByText(words.person.phone).length).toBeGreaterThan(0);
        expect(page().getByText(words.staff.chipActive)).toBeDefined();
        // By samples.ts: the title, the person and the message are no screen's.
        expect(
          page().getByRole('heading', { level: 2, name: SAMPLES[language].staffMember }),
        ).toBeDefined();
        expect(page().getAllByText(SAMPLES[language].person).length).toBeGreaterThan(0);
        expect(page().getByText(SAMPLES[language].changesKept)).toBeDefined();
      }
      // The ListTable's own entry draws the same table in the picked language, English now.
      cleanup();
      open(`${BASE}/pages/list-table`);
      expect(
        part().getByRole('columnheader', { name: DICTIONARIES.en.lists.columns.phone }),
      ).toBeDefined();
    });

    it('231 case 3: the gallery’s own words stay English whatever the pick, the plates’ words follow it', async () => {
      open(`${BASE}/organisms/page-header`);
      const entry = ENTRIES.find((each) => each.name === 'PageHeader')!;
      for (const language of ['vi', 'en'] as const) {
        if (language === 'en') await choose(LANGUAGE_NAMES.en);
        expect(about().getByText(entry.description)).toBeDefined();
        expect(about().getByText(entry.props)).toBeDefined();
        expect(about().getByRole('heading', { level: 3, name: 'Use when' })).toBeDefined();
        expect(stateNames()).toEqual(['With actions', 'Title only', 'With status and subtitle']);
        expect(
          part().getAllByRole('heading', { level: 2, name: DICTIONARIES[language].nav.staff }),
        ).toHaveLength(2);
        expect(
          part().getByRole('button', { name: DICTIONARIES[language].staff.add }),
        ).toBeDefined();
      }
    });

    it('231 case 4: the Formats state draws a price, a number’s marks, a day and a time in the picked language', async () => {
      const at = Date.UTC(2026, 10, 22, 13, 5, 9);
      open(`${BASE}/foundations/values`);
      const formats = () => within(part().getByRole('figure', { name: 'Formats' }));
      for (const language of ['vi', 'en'] as const) {
        if (language === 'en') await choose(LANGUAGE_NAMES.en);
        const marks = marksOf(language);
        expect(
          formats().getByText(
            DICTIONARIES[language].orders.money.replace('{{amount}}', priceOf(1250000, language)),
          ),
        ).toBeDefined();
        expect(
          formats().getByText(`1${marks.group}250${marks.group}000${marks.decimal}5`),
        ).toBeDefined();
        expect(formats().getByText(dayOf(at, language))).toBeDefined();
        expect(formats().getByText(timeOf(at, language))).toBeDefined();
      }
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

  it('232: the right column puts the controls (Show, the states, the theme picker) before the part’s notes', async () => {
    const user = userEvent.setup();
    open(`${BASE}/organisms/door-card`);
    await user.click(about().getByRole('button', { name: 'One at a time' }));

    const before = (first: HTMLElement, second: HTMLElement) =>
      Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
    const notes = [
      about().getByRole('heading', { level: 2, name: 'DoorCard' }),
      about().getByRole('heading', { level: 3, name: 'Props' }),
    ];
    const controls = [
      about().getByRole('heading', { level: 3, name: 'Show' }),
      about().getByRole('button', { name: 'Side by side' }),
      about().getByRole('group', { name: 'States' }),
      about().getByRole('combobox', { name: 'Colour theme' }),
    ];
    for (const control of controls) {
      for (const note of notes) expect(before(control, note)).toBe(true);
    }
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
    expect(ENTRIES).toHaveLength(32);
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
    // The loader is named by the dictionary's words, in the language the gallery draws in.
    expect(
      within(part().getByRole('figure', { name: 'Loading' })).getByLabelText(
        DICTIONARIES.vi.common.loading,
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
    const { state } = DICTIONARIES.vi.orders;
    expect(chips.map((chip) => chip.textContent)).toEqual([
      state.draft,
      state.confirmed,
      state.fulfilled,
      state.cancelled,
      state.waiting,
      state.delivered,
      state.cancelled,
      DICTIONARIES.vi.staff.chipActive,
      DICTIONARIES.vi.staff.chipInactive,
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
      'The list page',
      'The form page',
      'The phone page',
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
    expect(page.getByRole('link', { name: DICTIONARIES.vi.staff.back })).toBeDefined();
    expect(page.getByRole('heading', { level: 2, name: SAMPLES.vi.staffMember })).toBeDefined();
    expect(page.getByRole('button', { name: DICTIONARIES.vi.person.save })).toBeDefined();
    expect(page.getAllByRole('heading', { level: 3 })).toHaveLength(3);
    expect(page.getByRole('table')).toBeDefined();
    expect(page.getAllByRole('row')).toHaveLength(4);
    expect(page.getByText(DICTIONARIES.vi.staff.chipActive)).toBeDefined();
    expect(page.getByRole('status')).toBeDefined();
    cleanup();
    // A built part the screens draw says so; one no screen draws says it is not used yet.
    open(`${BASE}/pages/page-shell`);
    expect(stateNames()).toEqual(['Ready', 'Loading', 'Failed']);
    await userEvent.click(
      within(part().getByRole('figure', { name: 'Failed' })).getByRole('button', {
        name: DICTIONARIES.vi.common.retry,
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
    ).toEqual([SAMPLES.vi.cancel, SAMPLES.vi.saveDraft, SAMPLES.vi.send]);
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
        entry.name !== 'The page base' &&
        entry.kind !== KIND_OF_PAGE,
    );
    // A set that found nothing would quiet the loop.
    expect(parts.length).toBe(22);
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
    // The table of ours and the kind's list each name the other.
    expect(words('DataTable')).toContain('ListTable');
    expect(words('ListTable')).toContain('DataTable');
    // The panel of ours and the card with a section title each name the other.
    expect(words('Panel')).toContain('SectionCard');
    expect(words('SectionCard')).toContain('Panel');
  });

  const drawn = (entry: Entry, language: 'vi' | 'en' = 'en') =>
    render(
      <MemoryRouter>
        <CredoMantine colour={CREDO_COLOUR} test>
          <Part entry={entry} picker={null} language={language} colour={CREDO_COLOUR} test />
        </CredoMantine>
      </MemoryRouter>,
    );
  const sample = (mustHave?: string[]): Entry => ({
    group: 'Pages',
    kind: KIND_OF_PAGE,
    name: 'A sample page',
    description: 'A page.',
    props: '',
    useWhen: ['When.'],
    dontUseWhen: ['Not.'],
    mustHave,
    states: [
      { name: 'At the phone', node: <p>drawn at the phone</p>, phone: true },
      { name: 'On the computer', node: <p>drawn on the computer</p> },
    ],
  });

  it('236 case 1: a phone plate draws its page in a frame 390 wide, in the gallery’s colour and language, and any other plate beside it', () => {
    drawn(sample(), 'vi');

    const frame = screen.getByTitle<HTMLIFrameElement>('At the phone, at the phone’s width');
    act(() => {
      fireEvent.load(frame);
    });

    expect(frame.getAttribute('width')).toBe('390');
    expect(frame.contentDocument!.documentElement.lang).toBe('vi');
    expect(frame.contentDocument!.body.textContent).toContain('drawn at the phone');
    expect(part().queryByText('drawn at the phone')).toBeNull();
    expect(part().getByText('drawn on the computer')).toBeDefined();
    expect(part().getAllByTitle(/at the phone’s width/)).toHaveLength(1);
  });

  it('236 case 3: a kind of page’s entry draws its must-have lines under their heading, and a part with none draws no heading', () => {
    drawn(sample(['The first line.', 'The second line.']));

    const lines = within(
      about()
        .getByRole('heading', { level: 3, name: 'A new page of this kind must have' })
        .closest('section')!,
    );
    expect(lines.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'The first line.',
      'The second line.',
    ]);
    cleanup();

    drawn(sample());

    expect(about().queryByRole('heading', { name: /must have/ })).toBeNull();
  });

  it('236 case 3: every entry under the kind of page has one to a handful of must-have lines, and no other entry has any', () => {
    for (const entry of ENTRIES) {
      if (entry.kind === KIND_OF_PAGE) {
        expect(entry.mustHave?.length, entry.name).toBeGreaterThanOrEqual(1);
        for (const line of entry.mustHave ?? []) expect(line.trim(), entry.name).not.toBe('');
      } else {
        expect(entry.mustHave, entry.name).toBeUndefined();
      }
    }
  });

  it('236 case 5: the phone page draws the walk’s six screens at the phone’s width: the cards each opening its request, one main press a state, the photo’s send and take again, the proof', () => {
    const entry = ENTRIES.find((each) => each.name === 'The phone page')!;
    expect(entry.kind).toBe(KIND_OF_PAGE);
    drawn(entry);
    const frames = part().getAllByTitle<HTMLIFrameElement>(/at the phone’s width/);
    expect(frames).toHaveLength(6);
    for (const frame of frames) {
      act(() => {
        fireEvent.load(frame);
      });
      expect(frame.getAttribute('width')).toBe('390');
    }
    const at = (index: number) => within(frames[index].contentDocument!.body);
    const pressesOf = (index: number) => at(index).queryAllByRole('button');

    // 1. The day's requests: a card each, a link opening its request, no press.
    const cards = at(0).getAllByRole('link');
    expect(cards.map((card) => card.getAttribute('href'))).toEqual([
      '/my-deliveries/2026-11-23/r1',
      '/my-deliveries/2026-11-23/r2',
    ]);
    expect(cards[0].textContent).toContain('GH-0001');
    expect(pressesOf(0)).toHaveLength(0);
    // 2. One request: the customer's call, the goods, the money in bold under them, one main press.
    expect(at(1).getByRole('link', { name: 'Call 0901 234 567' }).getAttribute('href')).toBe(
      'tel:0901234567',
    );
    expect(at(1).getAllByRole('row')).toHaveLength(5);
    const collect = at(1).getByText('Amount to collect: 945,000 VND');
    expect(collect.style.fontWeight).toBe('700');
    expect(
      at(1).getByRole('table').compareDocumentPosition(collect) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(pressesOf(1).map((press) => press.textContent)).toEqual(['Mark as delivered']);
    // 3. The photo taken: Submit the main, Retake the other under it.
    expect(at(2).getByRole('img', { name: 'Captured delivery photo' })).toBeDefined();
    expect(pressesOf(2).map((press) => press.textContent)).toEqual(['Submit', 'Retake photo']);
    expect(pressesOf(2)[0].getAttribute('data-variant')).toBe('filled');
    expect(pressesOf(2)[1].getAttribute('data-variant')).toBe('default');
    // 4. Delivered: the proof, no press.
    expect(at(3).getByRole('status').textContent).toBe('Delivered successfully. Thank you!');
    expect(at(3).getByRole('img', { name: 'Delivery verification photo' })).toBeDefined();
    expect(pressesOf(3)).toHaveLength(0);
    // 5. A send that failed: the message, the photo kept, Submit again.
    expect(at(4).getByRole('alert').textContent).toContain('Failed to submit photo');
    expect(at(4).getByRole('img', { name: 'Captured delivery photo' })).toBeDefined();
    expect(pressesOf(4).map((press) => press.textContent)).toEqual(['Submit', 'Retake photo']);
    // 6. Cancelled by the office: told so, nothing to press.
    expect(at(5).getByRole('alert').textContent).toContain('cancelled by the dispatch office');
    expect(pressesOf(5)).toHaveLength(0);
    // Every press is ActionButton's, at the one size that stands at least 36 px.
    for (let index = 0; index < 6; index += 1) {
      for (const press of pressesOf(index)) expect(press.getAttribute('data-size')).toBe('sm');
    }
  });

  it('236 case 6: the list page draws its acts, table, status column, filter bar, empty, loading and failed, and a card a row at the phone width', () => {
    const entry = ENTRIES.find((each) => each.name === 'The list page')!;
    expect(entry.kind).toBe(KIND_OF_PAGE);
    drawn(entry);
    const figure = (name: string) => within(part().getByRole('figure', { name }));
    // 1. A list: the acts beside the title, the add the main, the kind's records in a table.
    const list = figure('A list');
    expect(list.getByRole('heading', { name: 'Customers' }).textContent).toBe('Customers');
    const acts = list.getAllByRole('link');
    expect(acts.slice(0, 2).map((link) => link.textContent)).toEqual([
      'Import from Excel',
      'Add customer',
    ]);
    expect(acts[1].getAttribute('data-variant')).toBe('filled');
    expect(list.getAllByRole('row')).toHaveLength(4);
    expect(list.getByRole('columnheader', { name: 'Code' })).toBeDefined();
    // 2. Filtered, with a status: the filter bar over a table whose last column is the chip.
    const filtered = figure('Filtered, with a status');
    expect(filtered.getByRole('textbox', { name: 'Search' })).toBeDefined();
    expect(filtered.getByRole('combobox', { name: 'Status' })).toBeDefined();
    const rows = filtered.getAllByRole('row');
    expect(rows).toHaveLength(3);
    expect(within(rows[1]).getAllByRole('cell').at(-1)!.textContent).toBe('Active');
    // 3. Empty: said by the page state, with its add.
    const empty = figure('Empty');
    expect(empty.getByRole('status').textContent).toContain('No customers found');
    expect(empty.getAllByRole('link', { name: 'Add customer' })).toHaveLength(1);
    expect(empty.queryByRole('table')).toBeNull();
    // 4. Loading, 5. failed: the body is the state.
    expect(figure('Loading').getByLabelText('Loading...')).toBeDefined();
    expect(figure('Loading').queryByRole('table')).toBeNull();
    expect(figure('Failed').getByRole('alert').textContent).toContain('Unable to load page');
    expect(figure('Failed').getByRole('button', { name: 'Try again' })).toBeDefined();
    // 6. At the phone's width: a frame, a card a row, the name and its chip first, the rest captions.
    const frame = part().getByTitle<HTMLIFrameElement>('At the phone, at the phone’s width');
    act(() => {
      fireEvent.load(frame);
    });
    expect(frame.getAttribute('width')).toBe('390');
    const body = within(frame.contentDocument!.body);
    expect(body.queryByRole('table')).toBeNull();
    const cards = body
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href')?.startsWith('/staff/s'));
    expect(cards.map((card) => card.getAttribute('href'))).toEqual([
      '/staff/s1',
      '/staff/s2',
      '/staff/s3',
    ]);
    expect(cards[0].textContent).toBe('An NguyenActiveNV-0010901 234 567');
    expect(cards[2].textContent).toContain('Inactive');
  });

  it('236 case 7: the form page draws blocks of fields, a field’s refusal on the field and a whole form’s above, one main at the foot, the made state', () => {
    const entry = ENTRIES.find((each) => each.name === 'The form page')!;
    expect(entry.kind).toBe(KIND_OF_PAGE);
    drawn(entry);
    const figure = (name: string) => within(part().getByRole('figure', { name }));
    // 1. A new record: the way back above the title, three titled blocks, one main at the foot.
    const fresh = figure('A new record');
    const back = fresh.getByRole('link', { name: 'Back to staff directory' });
    const title = fresh.getByRole('heading', { name: 'Add staff member' });
    expect(back.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      fresh.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent),
    ).toEqual(['Basic information', 'Contact details', 'Internal notes']);
    expect(fresh.getAllByRole('button')).toHaveLength(1);
    expect(fresh.getByRole('button', { name: 'Add employee' }).getAttribute('data-variant')).toBe(
      'filled',
    );
    expect(fresh.queryByRole('alert')).toBeNull();
    expect(fresh.getByRole('textbox', { name: /Staff code/ }).hasAttribute('data-error')).toBe(
      false,
    );
    // 2. Refused: the whole form's message above the blocks, the code's refusal on its field.
    const refused = figure('Refused');
    const message = refused.getByRole('alert');
    expect(message.textContent).toContain('Failed to add employee');
    const first = refused.getAllByRole('heading', { level: 3 })[0];
    expect(message.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(refused.getByRole('textbox', { name: /Staff code/ }).hasAttribute('data-error')).toBe(
      true,
    );
    expect(
      refused.getByText('Code must be 2–20 alphanumeric characters or hyphens.'),
    ).toBeDefined();
    expect(refused.getAllByRole('button')).toHaveLength(1);
    // 3. One block: its fields in one titled block, one main.
    const one = figure('One block');
    expect(one.getAllByRole('heading', { level: 3 })).toHaveLength(1);
    const press = one.getByRole('button', { name: 'Update password' });
    expect(press.getAttribute('data-variant')).toBe('filled');
    expect(one.getAllByRole('button').filter((button) => button !== press)).toHaveLength(3);
    // 4. Made: what was made, read-only, with the way on.
    const made = figure('Made');
    expect(made.getByRole('status').textContent).toContain('only displayed once');
    expect(made.getByRole('textbox', { name: 'Login username' }).hasAttribute('readonly')).toBe(
      true,
    );
    expect(made.getByRole('textbox', { name: 'Initial password' }).hasAttribute('readonly')).toBe(
      true,
    );
    expect(made.getByRole('link', { name: 'View employee profile' })).toBeDefined();
  });

  it('236 case 13: Panel’s new take, the address its block opens, is a content in its contract and drawn on its entry', () => {
    const panel = GUIDELINE.contracts.find((contract) => contract.part === 'Panel')!;
    expect(panel.takes.find(({ prop }) => prop === 'to')?.is).toBe('content');
    expect(ENTRIES.find((entry) => entry.name === 'Panel')!.props).toContain('to?: string');

    open(`${BASE}/organisms/panel`);

    const takes = about().getByRole('heading', { level: 3, name: 'Takes from a screen' });
    expect(within(takes.closest('section')!).getByText('to')).toBeDefined();
  });
});

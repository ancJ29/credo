import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { Gallery } from './Gallery';
import { ENTRIES } from './entries';

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
      <Gallery />
    </MemoryRouter>,
  );
}

const list = () => within(screen.getByRole('navigation', { name: 'Parts' }));
const part = () => within(screen.getByRole('article'));
// Each state is a region named for it, so a sample's own headings are not taken for states.
const stateNames = () =>
  part()
    .getAllByRole('region')
    .map((region) => region.getAttribute('aria-label'));

describe('Gallery', () => {
  it('4: lists Foundations, Atoms, Molecules and Organisms in order, each with its count and every component file of its level', () => {
    open(`${BASE}/atoms/field-label`);

    const heads = list()
      .getAllByRole('heading')
      .map((heading) => heading.textContent);
    expect(heads).toEqual(['Foundations', 'Atoms', 'Molecules', 'Organisms']);
    expect(found.length).toBeGreaterThan(0);
    expect(list().getByRole('region', { name: 'Foundations' }).textContent).toContain('2');
    for (const [level, heading] of Object.entries(HEADINGS)) {
      const files = found.filter((file) => file.level === level);
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
    expect(part().getByText('Organisms')).toBeDefined();
    expect(part().getByText(/^A door’s card|^A door's card/)).toBeDefined();
    expect(part().getByText('name: string · logo?: string · children: ReactNode')).toBeDefined();
    expect(stateNames()).toEqual(['Sign-in', 'Login link']);
    expect(screen.queryByRole('heading', { level: 2, name: 'FieldLabel' })).toBeNull();
    expect(screen.getAllByRole('article')).toHaveLength(1);
  });

  it('6: the bare address opens the first part and the list marks it current', () => {
    open(BASE);

    expect(part().getByRole('heading', { level: 2, name: 'Values' })).toBeDefined();
    expect(list().getByRole('link', { name: 'Values' }).getAttribute('aria-current')).toBe('page');
    expect(
      list().getByRole('link', { name: 'FieldLabel' }).getAttribute('aria-current'),
    ).toBeNull();
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

  it('9: on a part of two states or more “One state at a time” shows one state and a row to pick another; a part of one state has no switch; another part opens on all states', async () => {
    const user = userEvent.setup();
    open(`${BASE}/organisms/door-card`);

    expect(stateNames()).toEqual(['Sign-in', 'Login link']);
    await user.click(screen.getByRole('button', { name: 'One state at a time' }));
    expect(stateNames()).toEqual(['Sign-in']);
    await user.click(screen.getByRole('button', { name: 'Login link' }));
    expect(stateNames()).toEqual(['Login link']);
    await user.click(screen.getByRole('button', { name: 'All states side by side' }));
    expect(stateNames()).toEqual(['Sign-in', 'Login link']);

    await user.click(screen.getByRole('button', { name: 'One state at a time' }));
    await user.click(list().getByRole('link', { name: 'PageHeader' }));
    expect(stateNames()).toEqual(['With actions', 'Title only']);

    await user.click(list().getByRole('link', { name: 'FieldLabel' }));
    expect(screen.queryByRole('button', { name: 'One state at a time' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'All states side by side' })).toBeNull();
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

  it('11: draws the values', () => {
    open(BASE);

    expect(stateNames()).toEqual(['Palette', 'Type', 'Gaps']);
    expect(part().getAllByTitle(/^brand \d$/)).toHaveLength(10);
    expect(part().getByText(/^Type: /)).toBeDefined();
    expect(part().getByText(/^Gaps: /)).toBeDefined();
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

  it('3: asks search engines not to list it and carries its title', () => {
    open(BASE);

    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'noindex',
    );
    expect(document.title).toBe('Credo: the design system’s gallery');
  });
});

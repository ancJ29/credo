# Building with credo's parts

Credo's screens are Mantine, dressed by one theme and a small set of parts. There are **no CSS
classes to write**: style with the parts' props, Mantine's own props, and `var(--credo-*)` /
`var(--mantine-color-*)` variables. Do not invent class names or hard-code colours.

## Wrap once, at the root

Every part reads its theme, words and router from `CredoProvider`. Without it the parts draw
unstyled and the ones that say words (`ActionButton`, `PageState`, `Panel`, `DoorPage`, `BackLink`,
`MenuRow`) show their dictionary keys. The provider takes `colour` (the company's brand colour, a
`#rrggbb`; the theme's ten brand shades and every `--credo-*` variable follow it) and `language`
(`'vi'`, the default, or `'en'`). It keeps a router that is already there.

```jsx
const { CredoProvider } = window.Credo;
root.render(<CredoProvider colour="#3e618c" language="en">{/* the whole screen */}</CredoProvider>);
```

Fonts are Noto Sans Variable, carried inside `components/bundle.css`; link that stylesheet once.

## The idiom

- **Parts first.** Reach for a credo part before raw Mantine: `PageHeader` (title, `actions`,
  `status`), `Panel` / `SectionCard` (a titled block), `DataTable` (columns, rows, optional
  `total`), `ActionButton` (`meaning`: `main` once per page, then `other`, `quiet`, `danger`),
  `FormMessage` (`kind`), `PageState` (loading, failed, forbidden, empty, notFound), `StatusBadge`,
  `Tag`, `DetailField`, `FieldLabel`, `ActionRow` (a block's buttons, one gap), `DoorPage` +
  `DoorCard` (a sign-in screen).
- **Mantine for the rest**, as exported: `Button`, `TextInput`, `PasswordInput`, `Checkbox`,
  `Divider`, `Badge`, `Group`, `Stack`, `Table`, `Text`, `Anchor`. Layout by `Stack` / `Group` with
  `gap="xs|sm|md|lg|xl"` (8, 12, 16, 24, 32 px); `Text` takes `size`, `fw`, `c="dimmed"`.
- **Colour by role, never by value.** Brand shades: `var(--mantine-color-brand-0)` to `-9`. Roles:
  `--credo-surface`, `--credo-surface-sunken`, `--credo-text`, `--credo-text-muted`,
  `--credo-border`, `--credo-border-strong`, `--credo-brand-text`, `--credo-brand-tint`,
  `--credo-brand-tint-strong`, `--credo-brand-line`, `--credo-on-filled` (text on a filled brand
  surface), `--credo-warning-text`. Meanings are four: danger (red), success (green), warning
  (orange), info (grey): pass `meaning` / `kind`, never a colour name.
- **Weights by role:** `--credo-weight-label` (500), `--credo-weight-emphasis` (600),
  `--credo-weight-title` (700).
- **Buttons:** primary calls to action are `ActionButton meaning="main"`; a sign-in or hero button is
  Mantine `Button variant="gradient"`.
- **Icons:** the app's Tabler icons are exported as `Icon<Name>` (`IconPlus`, `IconUsers`,
  `IconSettings`, …); size 14 inline, 16 in a field, 18 in a button.

## Where the truth lives

Read `components/bundle.css` before styling (`tokens.css` and `tokens.json` list its static tokens;
the `--credo-*` roles are set by `CredoProvider` as it renders), and for each part its
`components/<Name>/README.md` (props, examples) and its `<Name>Props` in `components/index.d.ts`.

## One idiomatic screen

```jsx
const { CredoProvider, PageHeader, Button, Panel, DataTable, ActionRow, ActionButton, StatusBadge } = window.Credo;

<CredoProvider colour="#3e618c" language="en">
  <PageHeader title="Orders" actions={<Button>New order</Button>} />
  <Panel title="Open orders">
    <DataTable
      columns={[{ heading: 'Customer' }, { heading: 'Status' }, { heading: 'Amount', number: true }]}
      rows={[{ key: '1042', cells: ['An Phat', <StatusBadge key="s" status="confirmed" />, '945,000 ₫'] }]}
    />
    <ActionRow>
      <ActionButton meaning="quiet">Cancel</ActionButton>
      <ActionButton meaning="main">Confirm</ActionButton>
    </ActionRow>
  </Panel>
</CredoProvider>
```

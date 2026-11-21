import { HEADER_WASHES, MENU_WASHES, ON_BRAND, ROLES, TONES, TYPE } from './tokens';

/**
 * What holds a rule: the file of a check that goes red when it is broken, or a person's review.
 * A check is the repository path of its file, which `guideline.test.ts` reads.
 */
export type HeldBy = { check: string } | 'review';

/**
 * Whether the app follows a rule today: `yes`, or the open item that moves the screens that do not.
 */
export type Followed = 'yes' | { item: number };

/** One rule: what it says, why, what holds it, and whether the app follows it yet. */
export type Rule = {
  says: string;
  why: string;
  heldBy: HeldBy;
  followed: Followed;
};

/** The charter: the guideline's first page, which a coder reads before any rule. */
export type Charter = {
  /** What the guideline is for, in the human's words. */
  goal: string;
  /** What credo is, so a choice fits the product and not one trade. */
  credo: string;
  /** Where a coder looks for a choice, by what is needed, in the order to look. */
  lookHere: { need: string; where: string }[];
  /** The rules that hold for every screen and every part. */
  rules: Rule[];
};

/** Every colour role a screen reads: the roles, the text on the client's colour, the washes. */
export type RoleName =
  | keyof typeof ROLES
  | (typeof ON_BRAND)[number]
  | keyof typeof HEADER_WASHES
  | keyof typeof MENU_WASHES;

/** The values page: what each value is for, one line each, typed over its table's keys so a value with no line is a type error. */
export type Values = {
  roles: Record<RoleName, string>;
  styles: Record<keyof typeof TYPE, string>;
  tones: Record<keyof typeof TONES, string>;
  /** What a coder reads before the tables, where a rule or a name is not yet followed. */
  notes: string[];
};

/**
 * The design guideline, as text a coder or an agent reads from the top: the gallery draws it, the
 * typecheck holds its shape, so a rule that does not say what holds it is a type error. A choice a
 * screen's coder meets that is not here is asked, and its answer is written here as a rule.
 */
export const GUIDELINE: { charter: Charter; values: Values } = {
  charter: {
    goal: 'Decide the design once, so whoever codes a screen makes as few look-and-feel choices as possible, and the app stays consistent anyway.',
    credo:
      'Credo is one platform that many small and medium companies in Vietnam share, its modules added over time. It is not one trade’s app: a choice fits any of them, and a company’s own colour is the one thing that differs.',
    lookHere: [
      { need: 'How a page is laid out', where: 'The page base, in the Pages group.' },
      { need: 'What a screen says or offers', where: 'A rule, in the Rules group.' },
      {
        need: 'A piece to build a screen from',
        where: 'A part, in Atoms, Molecules or Organisms.',
      },
      { need: 'A colour, a text style, a gap', where: 'A value, in Foundations.' },
      {
        need: 'Anything else',
        where:
          'Nowhere else: another screen of the app or the legacy app is not a source, since each may be one of the choices still to be made.',
      },
    ],
    rules: [
      {
        says: 'A choice this guideline does not make is asked, never guessed, and its answer is written here as a rule the first time.',
        why: 'A guess becomes a second way, and the app stops looking like one app.',
        heldBy: 'review',
        followed: 'yes',
      },
      {
        says: 'A screen reads a colour by its role, never by a shade of a palette; text on the client’s colour comes from the on-brand values, never from a white written in the screen.',
        why: 'The client’s colour changes every shade, so a shade written in a screen reads on one colour and fails on another.',
        heldBy: { check: 'ui/src/design-system/literals.test.ts' },
        followed: 'yes',
      },
      {
        says: 'A screen reads its text by name: a style of the type table, or a weight or a size of its own tables, never a number.',
        why: 'A style named once changes once, and a number written in a screen cannot be found again.',
        heldBy: { check: 'ui/src/design-system/literals.test.ts' },
        followed: 'yes',
      },
      {
        says: 'A part sits in a level and imports only from the levels below it: an atom holds no other part of ours, a molecule is a few atoms made one thing, an organism is a block of a page.',
        why: 'The levels keep a part’s weight in view, and a part that reaches upward cannot be used on its own.',
        heldBy: { check: 'eslint.config.js' },
        followed: 'yes',
      },
      {
        says: 'A part joins the parts at its third use in the app, with its gallery entry; its first two uses stay in their screens. The rule of three is for code, not for a look: a look is decided here before its first use.',
        why: 'A part made for one use is guessed at, and a part made after three is drawn from what they share.',
        heldBy: 'review',
        followed: 'yes',
      },
      {
        says: 'The app is light only, whatever the device asks.',
        why: 'The human’s answer: the legacy is light only, and a second set of values is not worth carrying yet.',
        heldBy: 'review',
        followed: 'yes',
      },
    ],
  },
  values: {
    roles: {
      surface: 'The ground of a page and of a card.',
      'surface-sunken':
        'A ground one step below the page: a table’s header, a field’s well, a quiet panel.',
      text: 'Body text and headings on a surface.',
      'text-muted':
        'Text one step softer than body: a hint, a note, a label that should not compete.',
      border: 'A hairline inside one surface: a card’s edge, a divider, a table’s rule.',
      'border-strong':
        'A line that must be seen: a field’s edge, the divide between two blocks of a page.',
      'hover-ink':
        'A faint dark wash over any ground under the pointer: a row or a link that can be pressed.',
      'brand-text':
        'The client’s colour as text on white: a name that is also a link, the current marker; darker where the colour is too pale to read.',
      'brand-tint':
        'The palest wash of the client’s colour: a row under the pointer, a quiet highlight.',
      'brand-tint-strong':
        'One step stronger than brand-tint: a selected row, a chip standing on a tint.',
      'brand-line': 'A hairline in the client’s colour: the edge of a highlighted block.',
      'on-brand-tint': 'Text on brand-tint and brand-tint-strong.',
      tip: 'The ground of a small hint that floats over the page, as the side strip’s tip.',
      'on-tip': 'Text on tip.',
      'warning-text': 'Text that warns, in an orange dark enough to read on white.',
      'on-filled': 'Text and icons on a button filled with the client’s colour.',
      'on-header': 'Text and icons on the header, which wears the client’s colour.',
      'on-menu': 'Text and icons on the side menu’s ground.',
      'header-hover': 'The wash on a header item under the pointer.',
      'header-chip': 'The wash behind a small chip in the header, as the language chip.',
      'header-avatar': 'The wash behind the avatar in the header.',
      'header-avatar-edge': 'The edge of the avatar in the header.',
      'header-badge': 'The wash behind a count or a mark in the header.',
      'language-edge': 'The edge of the language chip.',
      'language-picked': 'The wash on the language chosen.',
      'menu-hover': 'The wash on a menu item under the pointer.',
      'menu-current': 'The wash on the menu item of the page the person is on.',
    },
    styles: {
      pageTitle: 'The title of a page, once a page: a level-2 heading.',
      sectionLabel: 'The title of a block inside a page: small capitals, bold and wide.',
      fieldLabel: 'The name of a field or of a fact: small capitals, spaced, in grey.',
      body: 'Any running text and any value a person reads.',
      bodyStrong: 'A name or an amount that must stand out from the text around it.',
      caption: 'A note under or beside content: small and grey.',
    },
    tones: {
      danger: 'Something failed or will destroy: an error, a delete’s last step.',
      success: 'Something worked: a saved, sent or finished message, a done status.',
      warning:
        'Something needs care before it goes on: a caution, a status that waits for the person.',
      info: 'Something to know with nothing to fix: a neutral note, a state that asks nothing.',
    },
    notes: [
      'A screen names a meaning (danger, success, warning, info) or a role, never a Mantine colour. Not yet: the screens still write red, green, orange, gray and yellow (about 195 uses), and the later landings move them by rule; a yellow has no meaning and becomes warning.',
      'A text takes a style of the table below; a size or a weight on a Text is written only where no style fits, with a comment saying why. Not yet checked: review holds it.',
    ],
  },
};

import {
  FRAME_VALUES,
  HEADER_WASHES,
  ICON_SIZES,
  MENU_WASHES,
  ON_BRAND,
  RADII,
  ROLES,
  SPACING,
  TONES,
  TYPE,
  WIDTHS,
} from './tokens';

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
  /** The two readers of the guideline and what each does with it. */
  readers: { reader: string; does: string }[];
  /** Where each reader looks for a choice, by what is needed, in the order to look. */
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

/** The shadows a screen or the frame draws: Mantine's `lg` and `xl`, and the frame's two. */
export type ShadowName =
  'lg' | 'xl' | Extract<keyof typeof FRAME_VALUES, 'bar-shadow' | 'header-shadow'>;

/** The kinds of value a screen writes as text, each with its one place. */
export type FormatName = 'money' | 'date' | 'time';

/** The states a note stands beside: the note is drawn at the top of that state of the values page. */
export type NoteAbout = 'tones' | 'styles' | 'widths' | 'icons' | 'formats';

/**
 * The values page, the design-system coder's reference: what each value is for, one line each. A
 * value of a table is typed over its table's keys, so one with no line is a type error; the shadows
 * and the formats have no table of their own, so their names are written here.
 */
export type Values = {
  roles: Record<RoleName, string>;
  styles: Record<keyof typeof TYPE, string>;
  tones: Record<keyof typeof TONES, string>;
  spacing: Record<keyof typeof SPACING, string>;
  widths: Record<keyof typeof WIDTHS, string>;
  icons: Record<keyof typeof ICON_SIZES, string>;
  corners: Record<keyof typeof RADII, string>;
  shadows: Record<ShadowName, string>;
  formats: Record<FormatName, string>;
  /** What a coder reads first in a state, where a rule or a name is not yet followed. */
  notes: { about: NoteAbout; text: string }[];
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
      'Credo is one platform that many small and medium companies in Vietnam share, its modules added over time. It is not one trade’s app: a choice fits any of them, and a company’s own colour, name and logo are what differ.',
    readers: [
      {
        reader: 'A screen’s coder',
        does: 'Picks parts and passes them content and meaning (a main action, a danger), never a colour, a size, a gap or a weight. A choice no part offers is asked, then written here as a rule or as a part.',
      },
      {
        reader: 'A design-system coder',
        does: 'Owns each part’s look, read from the theme, and changes it when it needs changing. A new part matches the existing ones, and the gallery is the check. The values and their use lines below are this coder’s reference.',
      },
    ],
    lookHere: [
      {
        need: 'A screen’s coder: a piece to build a screen from',
        where: 'A part, in Atoms, Molecules or Organisms.',
      },
      {
        need: 'A screen’s coder: how a page is laid out',
        where: 'The page base, in the Pages group, which stays empty until the plan’s landing 3.',
      },
      {
        need: 'A screen’s coder: what a screen says or offers',
        where: 'A rule, in the Rules group, which stays empty until the plan’s landing 2.',
      },
      {
        need: 'A design-system coder: a colour, a text style, a gap, a width, an icon size or a corner',
        where:
          'A value and its use line, in Foundations. A screen’s coder does not pick these: the part does.',
      },
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
        says: 'A screen picks parts, never a style: it passes a part content and meaning (a main action, a danger), and never a colour, a size, a gap or a weight.',
        why: 'A look written in a screen is one more place to change and one more way to differ; in a part it changes once, and the design-system coder keeps the new look matching the old.',
        heldBy: 'review',
        followed: { item: 651 },
      },
      {
        says: 'A colour is read by its role, never by a numbered shade of a palette; text on the client’s colour comes from the on-brand values, never from a white written in the screen. Mantine’s own slots (`--mantine-color-body`, `-text`, `-default-border`, `-default-hover`) and an avatar’s `color="initials"` are allowed.',
        why: 'The client’s colour changes every shade, so a shade written in a screen reads on one colour and fails on another.',
        heldBy: { check: 'ui/src/design-system/literals.test.ts' },
        followed: 'yes',
      },
      {
        says: 'Text takes a style of the type table, never a number for a weight or a size; the weights and sizes of their own tables are the design-system coder’s, and `tokens.ts` says what each is for.',
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
        says: 'A part joins `ui/src/components/` at its third use in the app, with its gallery entry; its first two uses stay in their screens or in `ui/src/parts/`, and the first six parts, joined as the skeleton’s day-one set, are the exception. It is never made to wrap a Mantine part alone. The rule of three is for code, not for a look: a look is decided here before its first use.',
        why: 'A part made for one use is guessed at, and a part made after three is drawn from what they share; Mantine stays the base.',
        heldBy: 'review',
        followed: 'yes',
      },
      {
        says: 'The app is light only, whatever the device asks.',
        why: 'The human’s answer: the legacy is light only, and a second set of values is not worth carrying yet.',
        heldBy: { check: 'ui/src/frame/Providers.test.tsx' },
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
    spacing: {
      xs: 'Between the parts of one small thing: an icon and its word, a header’s items, a field and the note under it.',
      sm: 'Between the fields or rows of one block that belong together: the fields of a form’s group, a list’s rows.',
      md: 'Between the contents of one card, and the padding of a card on a phone.',
      lg: 'Between the blocks of a page, and the padding of a section card.',
      xl: 'Between the big parts of a long page, as the steps of a setup, and the padding of a centred card on a wide window.',
    },
    widths: {
      card: 'A card that stands alone in the middle of the window: the sign-in card, the loading page, the unknown-company page. 440 px at most, the whole width below it.',
      column:
        'A page that is one column of text and fields: the own-password page. 560 px at most.',
      field:
        'A field of a form of several, a day field too: the order’s driver and its send day. 420 px at most.',
      amount: 'A field that holds an amount: the cash a driver takes in. 320 px at most.',
      date: 'A field that holds a day and stands alone, outside a form of several: the deliveries’ day, a day shown on its own. 240 px at most.',
    },
    icons: {
      inline:
        'An icon beside a title or a back link: a section’s title tile, a page’s back arrow. 14 px.',
      field:
        'An icon in a search field or at the end of a row: a search field’s magnifier, a row’s arrow. 16 px.',
      button:
        'An icon on a button, in the left side of a form’s field (the sign-in fields’), and a header’s control. 18 px.',
      bar: 'The phone bar’s more mark, the one icon set on a bar below the page. 22 px.',
      mark: 'The company’s mark on the header and the sign-in card, with a thin stroke. 36 px.',
    },
    corners: {
      xs: 'Not drawn by a screen today: 2 px, for a mark of a few pixels.',
      sm: 'A small tile or a badge: a section title’s icon tile, a logo on the sign-in card, a status badge. 4 px.',
      md: 'The default: a card, a paper, a photo, a button and a field. 8 px.',
      lg: 'Not drawn by a screen today: 12 px, which the frame’s own stylesheets write for one corner; they write a 6 px corner twice, which no step here names.',
      xl: 'A round pick: the colour swatches on the settings page. 16 px.',
    },
    shadows: {
      lg: 'A card that floats over a ground of its own: the sign-in card.',
      xl: 'A card that must lift off its page: the door card.',
      'bar-shadow': 'The soft shadow cast upward by the phone bar.',
      'header-shadow': 'The soft shadow below the header, on the phone only.',
    },
    formats: {
      money:
        'An amount in dong is written by `useMoney` (in `ui/src/parts/OrderParts.tsx`), never by a formatter in a screen.',
      date: 'A day is written by `dayOf` for a saved time and `shownDay` for a day as `YYYY-MM-DD`, both in `ui/src/day.ts`, in the language shown.',
      time: 'A time of day is written by `timeOf` in `ui/src/day.ts`, to the second on 24 hours, in the language shown.',
    },
    notes: [
      {
        about: 'tones',
        text: 'A screen names a meaning (danger, success, warning, info), never a Mantine colour. Not yet: the screens still write red, green, orange, gray and yellow (about 130 uses) and `dimmed` (about 50 more), which move with the parts; a yellow has no meaning and becomes warning. Open item 651 moves them.',
      },
      {
        about: 'styles',
        text: 'A text takes a style of this table; a size or a weight on a Text is written only where no style fits, with a comment saying why. Not yet checked: review holds it, and about 17 Text lines set one with no comment (open item 651). `WEIGHTS` and `SIZES` have no use line here; open item 654 adds them.',
      },
      {
        about: 'widths',
        text: 'A width is named by its use, never a number. Not yet: the screens write the numbers: 440 px is written 3 times, 420 and 240 twice, 560 and 320 once, and three more are in no list: 140 (a quantity field), 155 (a filter) and 200 (the search field’s least). The most common width of all is also in no list: a table’s least width, set 14 times at 480 (once), 560 (3), 640 (2), 720 (4) and 760 (2), which only the human can choose; open item 653 asks it, and open item 651 moves the rest.',
      },
      {
        about: 'icons',
        text: 'An icon size is named by where the icon sits, never a number. Not yet: of 45 icons, 30 are written as 14 px, 7 as 18, 3 as 16, 2 as 36, 2 as 20 and 1 as 22 (the two 20 px icons, a fingerprint on a button, are the button’s 18); open item 651 moves them.',
      },
      {
        about: 'formats',
        text: 'A number, a day or a time is written by its one place, never by `new Intl` in a screen. Not yet: outside `ui/src/day.ts` five `new Intl.NumberFormat` stand in four files (one is `useMoney`’s own, the other four write a price, a quantity or the marks of a number by hand), and a number has no place of its own yet; open item 652 moves them.',
      },
    ],
  },
};

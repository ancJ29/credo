import {
  FRAME_VALUES,
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
  weights: Record<keyof typeof WEIGHTS, string>;
  sizes: Record<keyof typeof SIZES, string>;
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

/** The theme's tables, by name: what a part may decide from. */
type Tables = {
  TONES: typeof TONES;
  TYPE: typeof TYPE;
  WEIGHTS: typeof WEIGHTS;
  SIZES: typeof SIZES;
  SPACING: typeof SPACING;
  WIDTHS: typeof WIDTHS;
  ICON_SIZES: typeof ICON_SIZES;
  RADII: typeof RADII;
  ROLES: typeof ROLES;
};

/** One key of one of the theme's tables: a key that is not there is a type error. */
type ThemeKey = { [T in keyof Tables]: { table: T; key: keyof Tables[T] } }[keyof Tables];

/** What a screen passes a part: its words or its act (`content`), or what it means (`meaning`), never a style. */
type Take = { prop: string; is: 'content' | 'meaning'; line: string };

/** What a part decides, in words, and the theme keys it reads to decide it. */
type Decision = { what: string; from: ThemeKey[] };

/** One kind or state of a part, as its entry draws it: the tone it wears and the role it speaks. */
export type PartState = {
  name: string;
  tone?: keyof typeof TONES;
  /** The look a button of this meaning is drawn in: filled, the default look, subtle, or red filled. */
  look?: 'filled' | 'default' | 'subtle' | 'red';
  role?: 'alert' | 'status' | 'note';
  line: string;
};

/**
 * One part's contract, the data its entry draws: what a screen gives it, what it decides from the
 * theme, the rule it serves, what holds it, and whether it is built (`followed` naming the open
 * item that builds a part to come).
 */
export type Contract = {
  /** The name of the part's entry in the gallery. */
  part: string;
  takes: Take[];
  decides: Decision[];
  /** What the part fixes in its own code and no table holds: its spoken role, its place. */
  fixes: string[];
  states: PartState[];
  /** The opening words of the charter's rule it serves. */
  serves: string;
  heldBy: HeldBy;
  followed: Followed;
  /** Set on a built part the screens already draw, which they do not all follow yet. */
  used?: true;
};

/** What a screen asks of a button: the main action of the page, another, a quiet one, a danger. */
type ButtonMeaning = 'main' | 'other' | 'quiet' | 'danger';

/**
 * The looks the screens draw a `Button` in today (its variant, `red` where its colour is red), and
 * the meaning each becomes when the screens move to `ActionButton`: red stays only on a danger,
 * and a danger is only a delete's last step, so a red outline or red subtle button becomes another
 * meaning.
 */
export type DrawnButtons = Record<
  'filled' | 'filled red' | 'default' | 'default red' | 'subtle' | 'subtle red' | 'outline red',
  ButtonMeaning
>;

/**
 * The design guideline, as text a coder or an agent reads from the top: the gallery draws it, the
 * typecheck holds its shape, so a rule that does not say what holds it is a type error. A choice a
 * screen's coder meets that is not here is asked, and its answer is written here as a rule.
 */
export const GUIDELINE: {
  charter: Charter;
  values: Values;
  contracts: Contract[];
  buttons: DrawnButtons;
} = {
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
        does: 'Owns each part’s look, read from the theme, and changes it when it needs changing. A new part matches the existing ones, and the gallery is the check. The values and their use lines below are this coder’s reference. Takes the feedback of product owners, sales or the human, in their own words, and turns it into a change of a part or a rule.',
      },
    ],
    lookHere: [
      {
        need: 'A screen’s coder: a piece to build a screen from',
        where: 'A part, in Atoms, Molecules or Organisms.',
      },
      {
        need: 'A screen’s coder: how a page is laid out',
        where: 'The page base, in the Pages group: the frame, then a page drawn from parts only.',
      },
      {
        need: 'A screen’s coder: what a screen says or offers',
        where:
          'The part’s contract, in the panel beside its entry: what a screen gives it and what it decides. A rule that holds for every screen is in the rules below. The Rules group stays empty.',
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
        says: 'A part’s look (a tone, a variant, which of today’s looks becomes which meaning) is the design-system coder’s to decide and keep consistent, never asked of a person outside it; feedback on the look comes from product owners, sales or the human in their own words, and the design-system coder turns it into a change of a part or a rule.',
        why: 'The people who see the app say what they see and want, not which variant draws it; a look chosen by many hands is a second way, and the design-system coder is the one who keeps the app one app.',
        heldBy: 'review',
        followed: 'yes',
      },
      {
        says: 'A kind of page (a list, a detail, a form) is written when its first page is built, from the page base’s slots, and a person looks at it before a second page of that kind is built.',
        why: 'A kind guessed before any page needs it is a second way; one drawn from a real first page, judged once, is the pattern the next pages copy.',
        heldBy: 'review',
        followed: 'yes',
      },
      {
        says: 'A screen writes no numbered shade of a palette; text on the client’s colour comes from the on-brand values, never from a white written in the screen. Mantine’s own slots (`--mantine-color-body`, `-text`, `-default-border`, `-default-hover`) and an avatar’s `color="initials"` are allowed.',
        why: 'The client’s colour changes every shade, so a shade written in a screen reads on one colour and fails on another.',
        heldBy: { check: 'ui/src/design-system/literals.test.ts' },
        followed: 'yes',
      },
      {
        says: 'A part’s text takes a style of the type table, never a number for a weight or a size, and a screen’s running text is the theme’s body; the weights and sizes of their own tables are the design-system coder’s, and the values page says what each is for.',
        why: 'A style named once changes once, and a number written in a screen cannot be found again.',
        heldBy: { check: 'ui/src/design-system/literals.test.ts' },
        followed: 'yes',
      },
      {
        says: 'A page has one main action, drawn as the filled button, and any other act is the other or the quiet one; a danger is red only at the last step of a delete, which a page of its own confirms (open item 306).',
        why: 'Two filled buttons ask the person to choose between equals, and a red button before the last step cries danger where there is none; the person finds the next step by its look.',
        heldBy: 'review',
        followed: { item: 655 },
      },
      {
        says: 'A part sits in a level and imports only from the levels below it: an atom holds no other part of ours, a molecule is a few atoms made one thing, an organism is a block of a page.',
        why: 'The levels keep a part’s weight in view, and a part that reaches upward cannot be used on its own.',
        heldBy: { check: 'eslint.config.js' },
        followed: 'yes',
      },
      {
        says: 'A part joins `ui/src/components/` at its third use in the app, with its gallery entry; its first two uses stay in their screens or in `ui/src/parts/`, and the first six parts, joined as the skeleton’s day-one set, are the exception: `StatusBadge`, then `FieldLabel`, `DetailField`, `SectionTitle`, `SectionCard` and `PageHeader`. It is never a part that decides nothing of Mantine’s look. The rule of three is for code, not for a look: a look is decided here before its first use.',
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
    weights: {
      label: 'A field’s name: the weight of a label over a field or a fact. 500.',
      emphasis:
        'A name or an amount that must stand out from the text around it, and a small label that must be seen. 600.',
      title: 'A heading: a page’s title and a block’s title. 700.',
    },
    sizes: {
      chip: 'The language chip’s size in the header, which a screen’s prop and the frame’s stylesheet both draw. 12 px.',
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
      table:
        'A table’s least width, in the list table part: below it the table scrolls sideways and its columns keep their room. 640 px at least.',
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
        text: 'A text takes a style of this table; a size or a weight on a Text is written only where no style fits, with a comment saying why. Not yet checked: review holds it, and about 17 Text lines set one with no comment (open item 651).',
      },
      {
        about: 'widths',
        text: 'A width is named by its use, never a number. Not yet: the screens write the numbers: 440 px is written 3 times, 420 and 240 twice, 560 and 320 once, and three more are in no list: 140 (a quantity field), 155 (a filter) and 200 (the search field’s least). The most common width of all is also in no list: a table’s least width, set 12 times at 480 (once), 560 (3), 640 (2), 720 (4) and 760 (2), which the table part now decides, the design-system coder’s choice, as the `table` width of 640 (the part writes its own 640 still); open item 653 moves the screens’ own, and open item 651 the rest.',
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
  /**
   * Each part's contract, one row a part: a redraw of a contract edits its row here and nothing
   * else, since the gallery's entry draws the row and the tests read it.
   */
  contracts: [
    {
      part: 'FormMessage',
      takes: [
        {
          prop: 'kind',
          is: 'meaning',
          line: 'What the message is: error, warning, success, info, or saved (the one after a save).',
        },
        { prop: 'title', is: 'content', line: 'A line above its words, as a record’s code.' },
        {
          prop: 'standing',
          is: 'meaning',
          line: 'That it is a note the page read when it loaded, not the outcome of an act: spoken as a note.',
        },
        {
          prop: 'act',
          is: 'content',
          line: 'The act the message offers beside its words, an `ActionButton`: the part lays it out under the words.',
        },
        {
          prop: 'children',
          is: 'content',
          line: 'Its words, and until the other six sites that hold an act inside them move (item 658) an act beside them.',
        },
      ],
      decides: [
        {
          what: 'Its colour, from its kind: error red, warning orange, success and saved green, info gray.',
          from: [
            { table: 'TONES', key: 'danger' },
            { table: 'TONES', key: 'warning' },
            { table: 'TONES', key: 'success' },
            { table: 'TONES', key: 'info' },
          ],
        },
        { what: 'Its text, the theme’s body.', from: [{ table: 'TYPE', key: 'body' }] },
      ],
      fixes: [
        'Its spoken role: alert for an error or a warning (a conflict is a warning), status for the rest, note for a standing one.',
        'Its place: the whole width of the column it sits in, even a left-aligned one, no margin; where it sits, and the gap above it, are its column’s.',
      ],
      states: [
        { name: 'Error', tone: 'danger', role: 'alert', line: 'Something failed.' },
        {
          name: 'Warning',
          tone: 'warning',
          role: 'alert',
          line: 'Something needs care, as a conflict.',
        },
        { name: 'Success', tone: 'success', role: 'status', line: 'Something worked.' },
        { name: 'Info', tone: 'info', role: 'status', line: 'Something to know, nothing to fix.' },
        { name: 'Saved', tone: 'success', role: 'status', line: 'The message after a save.' },
        {
          name: 'Standing',
          tone: 'warning',
          role: 'note',
          line: 'A note the page read when it loaded, with the record’s code above its words.',
        },
      ],
      serves: 'A screen picks parts, never a style',
      heldBy: { check: 'ui/src/design-system/guideline.test.ts' },
      followed: { item: 651 },
      used: true,
    },
    {
      part: 'PageState',
      takes: [
        {
          prop: 'state',
          is: 'meaning',
          line: 'Which state the page is in: loading, failed, forbidden, nothing, empty, or not found.',
        },
        { prop: 'onRetry', is: 'content', line: 'The act of a failed load’s retry.' },
        { prop: 'add', is: 'content', line: 'The act of an empty list’s add button.' },
        { prop: 'children', is: 'content', line: 'Its words, where a state has any.' },
      ],
      decides: [
        { what: 'The title’s style.', from: [{ table: 'TYPE', key: 'pageTitle' }] },
        { what: 'The message’s style.', from: [{ table: 'TYPE', key: 'caption' }] },
        { what: 'The failed state’s colour.', from: [{ table: 'TONES', key: 'danger' }] },
        {
          what: 'The gap between its title and its message.',
          from: [{ table: 'SPACING', key: 'xs' }],
        },
      ],
      fixes: [
        'Its loader and the loader’s spoken name, and its least height while it loads.',
        'Its retry button: a default button under the failed message.',
        'Its spoken role: alert for a failed load, status for the rest.',
      ],
      states: [
        { name: 'Loading', line: 'The page’s data is on its way.' },
        {
          name: 'Failed',
          tone: 'danger',
          role: 'alert',
          line: 'The data did not come; a retry follows.',
        },
        { name: 'Forbidden', role: 'status', line: 'The person may not open the page.' },
        { name: 'Nothing', role: 'status', line: 'No page is open to the person yet.' },
        {
          name: 'Empty',
          role: 'status',
          line: 'A list with nothing in it; an add button follows.',
        },
        { name: 'Not found', role: 'status', line: 'The address names nothing.' },
      ],
      serves: 'A screen picks parts, never a style',
      heldBy: { check: 'ui/src/design-system/guideline.test.ts' },
      followed: { item: 651 },
    },
    {
      part: 'ActionButton',
      takes: [
        {
          prop: 'meaning',
          is: 'meaning',
          line: 'What the act is to the page: the main action, another act, a quiet one, or a danger.',
        },
        { prop: 'children', is: 'content', line: 'Its words.' },
        { prop: 'onClick', is: 'content', line: 'The act it performs.' },
        {
          prop: 'to',
          is: 'content',
          line: 'The address it goes to, where the act is a move to another page: it is then drawn as a link.',
        },
        {
          prop: 'submit',
          is: 'meaning',
          line: 'That it sends the form it sits in, instead of performing an act of its own.',
        },
        {
          prop: 'busy',
          is: 'meaning',
          line: 'That its act is under way: it shows a loader and takes no second press.',
        },
        {
          prop: 'disabled',
          is: 'meaning',
          line: 'That its act cannot be taken yet: it takes no press.',
        },
        { prop: 'icon', is: 'content', line: 'A small picture before its words.' },
        {
          prop: 'label',
          is: 'content',
          line: 'The name a screen reader says for it, where its words alone do not say which one it is (one in each row of a table).',
        },
      ],
      decides: [
        {
          what: 'A danger’s colour: red, filled.',
          from: [{ table: 'TONES', key: 'danger' }],
        },
        {
          what: 'Its label’s weight: Mantine’s own button weight, 600.',
          from: [{ table: 'WEIGHTS', key: 'emphasis' }],
        },
      ],
      fixes: [
        'Its look from its meaning: the main action filled in the client’s colour, another the default look, a quiet one subtle, a danger red filled.',
        'Its size: Mantine’s small, one size for every button.',
        'Its width: its words’ own, even in a column that stretches (and its place in a row unmoved), so no screen needs a wrapper or an `alignSelf` for it.',
        'Its place is its column’s, not its own: a page has one main action and a danger is only a delete’s last step, which the part cannot count and the check that reads the screens (case 7 of the screens-on-parts plan) holds.',
      ],
      states: [
        { name: 'Main', look: 'filled', line: 'The page’s one main action.' },
        { name: 'Other', look: 'default', line: 'Another act, as cancel or back.' },
        {
          name: 'Quiet',
          look: 'subtle',
          line: 'An act the page offers with no weight, as a link.',
        },
        {
          name: 'Danger',
          look: 'red',
          tone: 'danger',
          line: 'A delete’s last step, on the page that confirms it.',
        },
      ],
      serves: 'A page has one main action',
      heldBy: { check: 'ui/src/design-system/guideline.test.ts' },
      followed: { item: 655 },
      used: true,
    },
    {
      part: 'StatusBadge',
      takes: [
        {
          prop: 'status',
          is: 'meaning',
          line: 'Which state the record is in: an order’s, a delivery request’s, or a person’s active or not (archived).',
        },
      ],
      decides: [
        {
          what: 'Its colour, from its status: green for what is done or active, orange for what waits, red for cancelled, gray for a draft or inactive.',
          from: [
            { table: 'TONES', key: 'success' },
            { table: 'TONES', key: 'warning' },
            { table: 'TONES', key: 'danger' },
            { table: 'TONES', key: 'info' },
          ],
        },
      ],
      fixes: [
        'Its word, the dictionary’s for the status, in the person’s language.',
        'Its look: Mantine’s light badge.',
      ],
      states: [
        { name: 'draft', tone: 'info', line: 'An order still to be confirmed.' },
        { name: 'confirmed', tone: 'warning', line: 'An order confirmed, its delivery to come.' },
        { name: 'fulfilled', tone: 'success', line: 'An order delivered.' },
        { name: 'cancelled', tone: 'danger', line: 'An order or a request cancelled.' },
        { name: 'waiting', tone: 'warning', line: 'A request waiting for its delivery.' },
        { name: 'delivered', tone: 'success', line: 'A request delivered.' },
        { name: 'active', tone: 'success', line: 'A person who may sign in.' },
        { name: 'inactive', tone: 'info', line: 'A person who is archived.' },
      ],
      serves: 'A screen picks parts, never a style',
      heldBy: { check: 'ui/src/components/atoms/StatusBadge.test.tsx' },
      followed: { item: 651 },
    },
    {
      part: 'PageShell',
      takes: [
        { prop: 'title', is: 'content', line: 'The page’s title.' },
        { prop: 'actions', is: 'content', line: 'What acts on the whole page, beside its title.' },
        {
          prop: 'status',
          is: 'meaning',
          line: 'Whether the page’s data is loading, failed or ready.',
        },
        { prop: 'onRetry', is: 'content', line: 'The act of a failed load’s retry.' },
        { prop: 'children', is: 'content', line: 'The page’s body, drawn when its data is ready.' },
      ],
      decides: [
        { what: 'The title’s style.', from: [{ table: 'TYPE', key: 'pageTitle' }] },
        {
          what: 'The gap between the heading row and the body.',
          from: [{ table: 'SPACING', key: 'lg' }],
        },
      ],
      fixes: [
        'The header row’s order: the title first, what acts on the page beside it.',
        'Where a failed or loading state sits: in the place of the body, under the header row.',
        'Not yet: it takes no back link and no record status, a screen draws them itself; open item 651 moves them into the part.',
      ],
      states: [
        { name: 'Ready', line: 'The data is here: the heading row, then the body.' },
        { name: 'Loading', line: 'The data is on its way: the heading row, then a loader.' },
        {
          name: 'Failed',
          line: 'The data did not come: the heading row, then a message and a retry.',
        },
      ],
      serves: 'A screen picks parts, never a style',
      heldBy: { check: 'ui/src/design-system/guideline.test.ts' },
      followed: { item: 651 },
      used: true,
    },
    {
      part: 'PageHeader',
      takes: [
        { prop: 'title', is: 'content', line: 'The page’s title.' },
        { prop: 'actions', is: 'content', line: 'What acts on the whole page, beside its title.' },
      ],
      decides: [{ what: 'The title’s style.', from: [{ table: 'TYPE', key: 'pageTitle' }] }],
      fixes: ['Its alignment: the title at the start, the actions at the end, on one line.'],
      states: [
        { name: 'With actions', line: 'The title, and the page’s actions beside it.' },
        { name: 'Title only', line: 'The title alone.' },
      ],
      serves: 'A screen picks parts, never a style',
      heldBy: { check: 'ui/src/design-system/guideline.test.ts' },
      followed: 'yes',
    },
    {
      part: 'SectionCard',
      takes: [
        { prop: 'icon', is: 'content', line: 'The icon of the section, never its size.' },
        { prop: 'title', is: 'content', line: 'The section’s title.' },
        { prop: 'children', is: 'content', line: 'What the section holds.' },
      ],
      decides: [
        {
          what: 'Its padding.',
          from: [{ table: 'SPACING', key: 'lg' }],
        },
        {
          what: 'The gap between its title and what it holds.',
          from: [{ table: 'SPACING', key: 'md' }],
        },
        {
          what: 'The icon’s size beside the title.',
          from: [{ table: 'ICON_SIZES', key: 'inline' }],
        },
        { what: 'Its edge.', from: [{ table: 'ROLES', key: 'border' }] },
      ],
      fixes: [
        'Its tile: a small grey tile behind the icon, and its corner.',
        'Not yet: the screens pass the icon’s size themselves, 14 px, and the edge is Mantine’s own; open item 651 moves them into the part.',
      ],
      states: [{ name: 'Default', line: 'A title over what the section holds.' }],
      serves: 'A screen picks parts, never a style',
      heldBy: { check: 'ui/src/design-system/guideline.test.ts' },
      followed: { item: 651 },
      used: true,
    },
    {
      part: 'DetailColumns',
      takes: [
        { prop: 'main', is: 'content', line: 'The blocks that identify the record.' },
        {
          prop: 'side',
          is: 'content',
          line: 'The blocks that act on it; none for a page without.',
        },
      ],
      decides: [{ what: 'The gap between its columns.', from: [{ table: 'SPACING', key: 'lg' }] }],
      fixes: [
        'Its columns by width: two from 992 px (the main seven twelfths, the side five), one below with the main first.',
        'With no side, the main takes the full width at every width.',
      ],
      states: [
        { name: 'Main and side', line: 'Two columns on a wide window.' },
        { name: 'Main only', line: 'The main takes the whole width.' },
      ],
      serves: 'A screen picks parts, never a style',
      heldBy: { check: 'ui/src/design-system/guideline.test.ts' },
      followed: 'yes',
    },
    {
      part: 'FieldPair',
      takes: [{ prop: 'children', is: 'content', line: 'The two fields of a row.' }],
      decides: [{ what: 'The gap between its fields.', from: [{ table: 'SPACING', key: 'md' }] }],
      fixes: ['Its columns by width: two a row from 768 px, one below.'],
      states: [
        { name: 'Two fields', line: 'Two fields beside each other, or one over the other.' },
      ],
      serves: 'A screen picks parts, never a style',
      heldBy: { check: 'ui/src/design-system/guideline.test.ts' },
      followed: 'yes',
    },
    {
      part: 'BackLink',
      takes: [
        { prop: 'href', is: 'content', line: 'The address it leads back to.' },
        { prop: 'children', is: 'content', line: 'Its words.' },
      ],
      decides: [
        { what: 'Its colour.', from: [{ table: 'ROLES', key: 'brand-text' }] },
        { what: 'Its arrow’s size.', from: [{ table: 'ICON_SIZES', key: 'inline' }] },
      ],
      fixes: [
        'Its arrow, before the words, and the small gap between them.',
        'Its text size: Mantine’s small.',
        'Not yet: no screen draws it; 14 places draw a back link by hand, as a button or a link, and open item 651 moves them to this one.',
      ],
      states: [{ name: 'Default', line: 'An arrow, then its words.' }],
      serves: 'A screen picks parts, never a style',
      heldBy: { check: 'ui/src/design-system/guideline.test.ts' },
      followed: { item: 651 },
    },
    {
      part: 'ListTable',
      takes: [
        { prop: 'kind', is: 'meaning', line: 'Which list it draws: customers or products.' },
        { prop: 'shown', is: 'content', line: 'The columns to draw, by key.' },
        { prop: 'rows', is: 'content', line: 'The records, one row each.' },
        { prop: 'language', is: 'content', line: 'The language its headings are written in.' },
      ],
      decides: [
        {
          what: 'Its least width, below which it scrolls sideways.',
          from: [{ table: 'WIDTHS', key: 'table' }],
        },
      ],
      fixes: [
        'The price column’s side: its figures at the right.',
        'Its rows under the pointer: the brand’s palest shade.',
        'Not yet: the part writes its 640 itself, and the screens write five widths of their own, 12 times; open item 653 moves them.',
      ],
      states: [{ name: 'Default', line: 'The headings, then a row for each record.' }],
      serves: 'A screen picks parts, never a style',
      heldBy: { check: 'ui/src/design-system/guideline.test.ts' },
      followed: { item: 653 },
      used: true,
    },
    {
      part: 'FieldLabel',
      takes: [{ prop: 'children', is: 'content', line: 'The label’s words.' }],
      decides: [
        {
          what: 'Its style: small capitals, spaced, in grey.',
          from: [{ table: 'TYPE', key: 'fieldLabel' }],
        },
      ],
      fixes: ['Its element: a span, so it sits inside a line.'],
      states: [{ name: 'Phone', line: 'A label over a field or a value.' }],
      serves: 'A screen picks parts, never a style',
      heldBy: { check: 'ui/src/design-system/guideline.test.ts' },
      followed: 'yes',
    },
    {
      part: 'DoorHeading',
      takes: [
        { prop: 'title', is: 'content', line: 'The door’s title.' },
        { prop: 'subtitle', is: 'content', line: 'A line under the title; none draws none.' },
      ],
      decides: [
        { what: 'The title’s weight.', from: [{ table: 'WEIGHTS', key: 'title' }] },
        { what: 'The subtitle’s style.', from: [{ table: 'TYPE', key: 'caption' }] },
      ],
      fixes: ['Both centred, and the gap under the subtitle, 32 px, before what follows.'],
      states: [
        { name: 'With subtitle', line: 'A title and a line under it.' },
        { name: 'Title only', line: 'The title alone.' },
      ],
      serves: 'A screen picks parts, never a style',
      heldBy: { check: 'ui/src/design-system/guideline.test.ts' },
      followed: 'yes',
    },
    {
      part: 'LogoTile',
      takes: [
        {
          prop: 'logo',
          is: 'content',
          line: 'The company’s logo; none, or one that fails to load, draws nothing.',
        },
        { prop: 'alt', is: 'content', line: 'The company’s name, said for the logo.' },
      ],
      decides: [
        {
          what: 'Its line: a pale hairline in the client’s colour.',
          from: [{ table: 'ROLES', key: 'brand-line' }],
        },
      ],
      fixes: ['Its tile: 44 px square with a corner of 10 px, the logo fitted inside.'],
      states: [
        { name: 'With a logo', line: 'The logo in its tile.' },
        { name: 'No logo', line: 'Nothing is drawn.' },
      ],
      serves: 'A screen picks parts, never a style',
      heldBy: { check: 'ui/src/design-system/guideline.test.ts' },
      followed: 'yes',
    },
    {
      part: 'BrandBand',
      takes: [
        { prop: 'name', is: 'content', line: 'The company’s name.' },
        { prop: 'logo', is: 'content', line: 'The company’s logo, if it has one.' },
      ],
      decides: [
        {
          what: 'Its wash: the client’s palest shade.',
          from: [{ table: 'ROLES', key: 'brand-tint' }],
        },
        { what: 'The line beneath it.', from: [{ table: 'ROLES', key: 'brand-tint-strong' }] },
        { what: 'The name’s weight.', from: [{ table: 'WEIGHTS', key: 'title' }] },
        { what: 'The gap between the logo and the name.', from: [{ table: 'SPACING', key: 'md' }] },
      ],
      fixes: ['Its padding, 28 px above and below and 40 at the sides, and its centring.'],
      states: [{ name: 'Default', line: 'The logo tile beside the name.' }],
      serves: 'A screen picks parts, never a style',
      heldBy: { check: 'ui/src/design-system/guideline.test.ts' },
      followed: 'yes',
    },
    {
      part: 'DetailField',
      takes: [
        { prop: 'label', is: 'content', line: 'The name of the fact.' },
        { prop: 'value', is: 'content', line: 'The fact; none draws a dash.' },
      ],
      decides: [{ what: 'The label’s style.', from: [{ table: 'TYPE', key: 'fieldLabel' }] }],
      fixes: ['A dash for no value, and the small gap between the label and the value.'],
      states: [
        { name: 'With a value, and with none', line: 'A label over its value, or over a dash.' },
      ],
      serves: 'A screen picks parts, never a style',
      heldBy: { check: 'ui/src/design-system/guideline.test.ts' },
      followed: 'yes',
    },
    {
      part: 'SectionTitle',
      takes: [
        { prop: 'icon', is: 'content', line: 'The icon of the section, never its size.' },
        { prop: 'label', is: 'content', line: 'The section’s short title.' },
      ],
      decides: [
        { what: 'The label’s style.', from: [{ table: 'TYPE', key: 'sectionLabel' }] },
        { what: 'The icon’s size.', from: [{ table: 'ICON_SIZES', key: 'inline' }] },
        { what: 'The tile’s corner.', from: [{ table: 'RADII', key: 'sm' }] },
      ],
      fixes: [
        'Its tile: a grey square of 24 px behind the icon.',
        'Not yet: the screens pass the icon’s size themselves; open item 651 moves them into the part.',
      ],
      states: [{ name: 'Default', line: 'A tile with its icon, then the label.' }],
      serves: 'A screen picks parts, never a style',
      heldBy: { check: 'ui/src/design-system/guideline.test.ts' },
      followed: { item: 651 },
      used: true,
    },
    {
      part: 'DoorCard',
      takes: [
        { prop: 'name', is: 'content', line: 'The company’s name.' },
        { prop: 'logo', is: 'content', line: 'The company’s logo, if it has one.' },
        { prop: 'children', is: 'content', line: 'What the card holds.' },
      ],
      decides: [
        { what: 'Its corner.', from: [{ table: 'RADII', key: 'md' }] },
        { what: 'Its edge.', from: [{ table: 'ROLES', key: 'border-strong' }] },
        {
          what: 'Its width at most, given by the page around it.',
          from: [{ table: 'WIDTHS', key: 'card' }],
        },
      ],
      fixes: [
        'Its bar: 4 px in the brand’s gradient across the top; then the band, then the body with its own padding.',
        'Its shadow: the one that lifts a door off its page.',
        'Not yet: no screen draws it; `SignInFrame` in `ui/src/pages/SignIn.tsx` draws a card of its own, and open item 651 moves it to this one.',
      ],
      states: [
        { name: 'Sign-in', line: 'The card holding the sign-in fields.' },
        { name: 'Login link', line: 'The card holding the login-link choices.' },
      ],
      serves: 'A screen picks parts, never a style',
      heldBy: { check: 'ui/src/design-system/guideline.test.ts' },
      followed: { item: 651 },
    },
  ],
  buttons: {
    filled: 'main',
    'filled red': 'danger',
    default: 'other',
    'default red': 'other',
    subtle: 'quiet',
    'subtle red': 'quiet',
    'outline red': 'other',
  },
};

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

/**
 * The design guideline, as text a coder or an agent reads from the top: the gallery draws it, the
 * typecheck holds its shape, so a rule that does not say what holds it is a type error. A choice a
 * screen's coder meets that is not here is asked, and its answer is written here as a rule.
 */
export const GUIDELINE: { charter: Charter } = {
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
};

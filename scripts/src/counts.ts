import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { checkCitations, declared, describeRun } from './citations';

/**
 * `pnpm counts`: how much of the code follows each of `docs/conventions/code.md`'s counted rules
 * (C1, C4, C5, C6, C7), and where the living documents' citations stand. It counts and never reds:
 * a rule marked `next copy` binds the next file and fixes none of the existing ones, so a count that
 * failed would block every piece on counter-examples nobody agreed to fix. The gate keeps the true
 * reds (`src/citations.test.ts` among them); this is read when someone asks.
 *
 * Each count prints its blind spot beside it, because a count that hides what it cannot see is
 * worse than none. Exit 0 done, 1 a named site or file the counts rest on is not there (a wrong
 * entry fails loudly), 2 a call that cannot be read.
 */

export type Io = {
  /** The tracked files of the repository, by path from its root. */
  tracked: () => string[];
  read: (path: string) => string;
  out: (line: string) => void;
  err: (line: string) => void;
};

/** One decision that was written out by hand in several places and now has one home (C1). */
type Decision = {
  name: string;
  home: { file: string; name: string };
  /** The sites the review named, by file. */
  sites: string[];
  /** More sites of the same family, by tracked path. */
  family?: RegExp;
  /** What a site still holding its own copy looks like. */
  copy: RegExp;
};

export type Rules = {
  decisions: Decision[];
  /** C4: the forms, named by hand, because what is a form is a judgement. */
  forms: { files: string[]; fieldError: RegExp; marker: RegExp; where: RegExp };
  /** C5: the storage client's own type names the calls to look for. */
  storage: { client: { file: string; type: string }; where: RegExp; registration: RegExp };
  /** C6: the screens are the non-test `.tsx` of the UI. */
  screens: { where: RegExp; direct: RegExp };
  /** C7: route registrations, and the idioms that write an error reply in the route itself. */
  errors: { where: RegExp; registration: RegExp; writes: RegExp[] };
};

/** The code of a file: its lines but the comments, which may name an old copy without being one. */
const codeOf = (text: string) =>
  text
    .split('\n')
    .filter((row) => !/^\s*(\*|\/\/|\/\*)/.test(row))
    .join('\n');
const isTest = (path: string) => /\.test\.tsx?$/.test(path);
/** Every `.tsx` under ui/src at any depth except the standalone harness in mock/, which stays outside the screens' scope as it was when the package was flat. */
const UI_SCREENS = /^ui\/src\/(?!mock\/).+\.tsx$/;
/** An import of the API module from wherever a file now stands: `./api`, `../api`, `../../api`. */
const UI_API = /from '(\.\.?\/)+api'/;
/** Every `.ts` under bff/src at any depth: the routes, records and calling folders and the files at the top. */
const BFF_SOURCES = /^bff\/src\/.+\.ts$/;
const ui = (names: string) => names.split(' ').map((name) => `ui/src/${name}.tsx`);

export const RULES: Rules = {
  decisions: [
    {
      name: 'the retry bound',
      home: { file: 'shared/src/c-storage.ts', name: 'ATTEMPTS' },
      sites: [
        'records/staff-records',
        'records/operators',
        'routes/orders',
        'calling/sessions',
      ].map((one) => `bff/src/${one}.ts`),
      copy: /\b(const|let)\s+ATTEMPTS\s*=/,
    },
    {
      name: 'the environment names',
      home: { file: 'shared/src/env.ts', name: 'STACK_ENV' },
      sites: ['scripts/src/cli.ts'],
      family: /^walk\/specs\/[^/]+\.spec\.ts$/,
      copy: /['"]CREDO_[A-Z_]+['"]/,
    },
    {
      name: 'what a 403 means',
      home: { file: 'ui/src/page.ts', name: 'refusal' },
      sites: ui(
        'pages/client/AddRecordPage pages/client/RecordPage pages/client/PersonPage pages/client/SettingsPage',
      ),
      copy: /status === 403/,
    },
    {
      name: 'listing under a prefix',
      home: { file: 'bff/src/records/records.ts', name: 'recordTools' },
      sites: ['records/clients', 'routes/lists', 'routes/orders', 'routes/staff'].map(
        (one) => `bff/src/${one}.ts`,
      ),
      copy: /longer than c-storage returns/,
    },
    {
      name: 'the screen widths',
      home: { file: 'shared/src/widths.ts', name: 'WIDTHS' },
      sites: [
        'visual/src/walks.ts',
        'walk/support.ts',
        'ui/src/mock/MockPage.tsx',
        'ui/src/mock/Frame.tsx',
      ],
      copy: /\b1280\b/,
    },
  ],
  forms: {
    files: ui(
      'pages/operator/AddOperatorPage pages/client/AddPersonPage parts/CustomerForm pages/operator/DeleteClientPage parts/NewClient parts/OrderParts pages/client/PersonPage pages/client/OwnPasswordPage parts/ProductForm pages/operator/RootPasswordPage parts/Settings pages/SignIn parts/SignInPanels',
    ),
    fieldError: /\berror=\{/,
    marker: /<form\b|component="form"/,
    where: UI_SCREENS,
  },
  storage: {
    client: { file: 'shared/src/c-storage.ts', type: 'CStorageClient' },
    where: BFF_SOURCES,
    registration: /^\s*\w+\.(get|put|post|delete|patch)\(/m,
  },
  screens: { where: UI_SCREENS, direct: UI_API },
  errors: {
    where: BFF_SOURCES,
    registration: /^\s*\w+\.(get|put|post|delete|patch)\(/,
    writes: [/\.(status|code)\(\s*[45]\d\d\s*\)/, /statusCode\s*=\s*[45]\d\d/],
  },
};

const USAGE = 'usage: counts [rules|citations]';

/** A named file the counts rest on is not tracked: the entry is wrong, and the run stops. */
class Missing extends Error {}

type Count = {
  id: string;
  followed: number;
  total: number;
  what: string;
  notes: string[];
  blind: string;
};

const show = (count: Count) => [
  `${count.id}  ${count.followed} of ${count.total}  ${count.what}`,
  ...count.notes.map((note) => `      ${note}`),
  `      blind spot: ${count.blind}`,
];

/** C1: the named copy sites that read their decision's one home. */
function countHomes(io: Io, tracked: string[], rules: Rules): Count {
  const notes: string[] = [];
  let followed = 0;
  let total = 0;
  for (const decision of rules.decisions) {
    const sites = [
      ...decision.sites,
      ...tracked.filter((path) => decision.family?.test(path) && !isTest(path)),
    ];
    for (const path of [decision.home.file, ...sites]) {
      if (!tracked.includes(path))
        throw new Missing(`C1 names ${path}, which is not a tracked file`);
    }
    const homed =
      declared(decision.home.file, io.read(decision.home.file), decision.home.name) === 1;
    const holding = sites.filter((path) => decision.copy.test(codeOf(io.read(path))));
    const reading = homed ? sites.length - holding.length : 0;
    followed += reading;
    total += sites.length;
    notes.push(
      `${decision.name}: ${reading} of ${sites.length} read ${decision.home.name} in ${decision.home.file}${homed ? '' : ' (that home is not declared once: none counts)'}${holding.length ? `; still holding a copy: ${holding.join(', ')}` : ''}`,
    );
  }
  return {
    id: 'C1',
    followed,
    total,
    what: "named copy sites read their decision's one home",
    notes,
    blind:
      'a site passes by not holding the old copy, never by showing that it reads the home, so a site that reads it only through a wrapper or only as a type passes without the check seeing why, and a site with nothing to do with the decision would pass too; the site list is written by hand, so the denominator is a judgement and a new copy in a file not listed is invisible; `codeOf` drops comment lines, so a `copy` pattern aimed at a phrase that now lives only in a comment can never fire, which is the case for the listing-under-a-prefix clause, whose phrase survives only in its home and in two test files.',
  };
}

/** C4: the listed forms that draw a refusal on the field. */
function countForms(io: Io, tracked: string[], rules: Rules): Count {
  const { files, fieldError, marker, where } = rules.forms;
  for (const path of files) {
    if (!tracked.includes(path)) throw new Missing(`C4 names ${path}, which is not a tracked file`);
  }
  const drawing = files.filter((path) => fieldError.test(io.read(path))).length;
  const unlisted = tracked.filter(
    (path) =>
      where.test(path) && !isTest(path) && !files.includes(path) && marker.test(io.read(path)),
  );
  return {
    id: 'C4',
    followed: drawing,
    total: files.length,
    what: 'listed forms draw a refusal on the field',
    notes: [
      `unlisted files that hold a form marker: ${unlisted.length ? unlisted.join(', ') : 'none'}`,
    ],
    blind:
      'the denominator is the list of forms named in this script, a human judgement: it moves when someone edits the list, not when the code changes, and a new form is invisible until it is named. A form is judged to draw a field error by an `error={` prop in its file.',
  };
}

/** The calls the storage client declares, read from its type so a new method cannot go unseen. */
function storageCalls(io: Io, tracked: string[], rules: Rules): string[] {
  const { file, type } = rules.storage.client;
  if (!tracked.includes(file)) throw new Missing(`C5 names ${file}, which is not a tracked file`);
  const text = io.read(file);
  const start = text.indexOf(`type ${type} = {`);
  const body = start < 0 ? '' : text.slice(start, text.indexOf('\n};', start));
  const methods = [...body.matchAll(/^ {2}(\w+)\(/gm)].map((match) => match[1]);
  if (methods.length === 0) throw new Missing(`C5 found no methods in ${type} in ${file}`);
  return methods;
}

/** C5: the storage calls made in a module of their own, not in a file that registers routes. */
function countStorage(io: Io, tracked: string[], rules: Rules): Count {
  const methods = storageCalls(io, tracked, rules);
  const call = new RegExp(`\\bstorage\\.(${methods.join('|')})\\(`, 'g');
  let modules = 0;
  let inline = 0;
  const closures: string[] = [];
  for (const path of tracked.filter((one) => rules.storage.where.test(one) && !isTest(one))) {
    const text = io.read(path);
    const calls = text.match(call)?.length ?? 0;
    if (rules.storage.registration.test(text)) {
      inline += calls;
      if (calls > 0) closures.push(`${path} ${calls}`);
    } else {
      modules += calls;
    }
  }
  return {
    id: 'C5',
    followed: modules,
    total: modules + inline,
    what: 'storage calls are made in a module of their own, not in a file that registers routes',
    notes: [
      `calls counted: ${methods.join(', ')} (read from the client's type)`,
      `inline, by file that registers routes: ${closures.length ? closures.join(', ') : 'none'}`,
    ],
    blind:
      "scope is the `.ts` files in bff/src at any depth, tests left out; storage calls made elsewhere (bff/tests, scripts/src and its demo folder) are not counted. A call is `storage.<method>(` and nothing else: a client held under another name, or reached through a helper that wraps it, is not seen, so moving a call behind a wrapper reads as an improvement; a file is 'a route file' when it registers a route at all.",
  };
}

/** C6: the screens that take their data handed down instead of importing the API module. */
function countScreens(io: Io, tracked: string[], rules: Rules): Count {
  const screens = tracked.filter((path) => rules.screens.where.test(path) && !isTest(path));
  const direct = screens.filter((path) => rules.screens.direct.test(io.read(path)));
  return {
    id: 'C6',
    followed: screens.length - direct.length,
    total: screens.length,
    what: 'screens take what they need without importing the API module',
    notes: [`importing it: ${direct.length}`],
    blind:
      "scope is the non-test `.tsx` files in ui/src at any depth, the app shells and the entry included; the `.tsx` files in ui/src/mock are not in it. Importing the api module (`./api`, `../api` or `../../api`) is not importing the client: `ApiError`, `hopOf` and the result types come from it too, and many of the importing files take only the `Api` type or only an error class, which by the rule's own words is not the breach it is about (only the entry builds the client with `createApi`), so the honest reading of this count is much closer to compliant than the number looks.",
  };
}

/** C7: the route registrations that leave an error reply to the one handler. */
function countErrors(io: Io, tracked: string[], rules: Rules): Count {
  let routes = 0;
  const writes: string[] = [];
  for (const path of tracked.filter((one) => rules.errors.where.test(one) && !isTest(one))) {
    const rows = io.read(path).split('\n');
    routes += rows.filter((row) => rules.errors.registration.test(row)).length;
    rows.forEach((row, index) => {
      if (rules.errors.writes.some((idiom) => idiom.test(row))) writes.push(`${path}:${index + 1}`);
    });
  }
  return {
    id: 'C7',
    followed: Math.max(routes - writes.length, 0),
    total: routes,
    what: 'route registrations leave an error reply to the one handler',
    notes: [
      `route registrations counted: ${routes}, as a line that starts with <name>.get|put|post|delete|patch( in bff/src, tests left out`,
      `error replies written in a route: ${writes.length ? writes.join(', ') : 'none'}`,
    ],
    blind:
      'an error written through an idiom this script does not know (a status held in a variable, a plugin hook) reads as no breach: zero here can sit beside two in the code. The idioms are `.status(4xx|5xx)`, `.code(4xx|5xx)` and `statusCode = 4xx|5xx`; each write found is taken to sit in a different route.',
  };
}

/** The citation check's table, which a passing test does not print. */
function citationTable(io: Io, tracked: string[]): string[] {
  const report = checkCitations(tracked, io.read);
  const red = report.findings.map(
    (one) => `  would be red: ${one.doc}:${one.line} ${one.cite}: ${one.why}`,
  );
  return [...describeRun(report).split('\n'), ...red];
}

/** `counts [rules|citations]`: both by default. */
export function runCounts(argv: string[], io: Io, rules: Rules = RULES): number {
  if (argv.length > 1 || (argv.length === 1 && !['rules', 'citations'].includes(argv[0]))) {
    io.err(USAGE);
    return 2;
  }
  const verbs = argv.length === 0 ? ['rules', 'citations'] : argv;
  try {
    const tracked = io.tracked();
    if (verbs.includes('rules')) {
      io.out('counts: how much of the code follows each rule (counted, never red)');
      for (const count of [
        countHomes(io, tracked, rules),
        countForms(io, tracked, rules),
        countStorage(io, tracked, rules),
        countScreens(io, tracked, rules),
        countErrors(io, tracked, rules),
      ]) {
        for (const line of show(count)) io.out(line);
      }
    }
    if (verbs.includes('citations')) {
      for (const line of citationTable(io, tracked)) io.out(line);
    }
    return 0;
  } catch (error) {
    if (!(error instanceof Missing)) throw error;
    io.err(`counts: ${error.message}`);
    return 1;
  }
}

/** The repository at `root`, as git tracks it. */
export function repoIo(
  root: string,
  out: Io['out'] = () => undefined,
  err: Io['err'] = () => undefined,
): Io {
  return {
    tracked: () =>
      execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
        .split('\0')
        .filter(Boolean),
    read: (path) => readFileSync(`${root}/${path}`, 'utf8'),
    out,
    err,
  };
}

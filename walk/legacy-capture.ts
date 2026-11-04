/**
 * walk/legacy-capture.ts: one picture of each screen a screens file names, on the legacy app, signed in as a
 * client's root. Opening screens only: it navigates, reads and clicks a tab or a list row; it never saves.
 * Run by ops/legacy-capture.sh (read its header first); it is a plain Node script (Node 26 strips the types), a
 * library user of Playwright, not the test runner, so the credential can reach it on stdin.
 *
 *   node walk/legacy-capture.ts --url <address> --screens <file> --out <dir>      (two lines on stdin)
 *   node walk/legacy-capture.ts --screens <file> --check                          (parse only, no stdin)
 *
 * Stdin: line 1 the root's name, line 2 the password. Read once, held in two variables, typed into the sign-in
 * form, never printed, logged or written. The sign-in step's failure is a fixed text. No trace, video or HAR is
 * recorded (they keep typed values). The address is read from the command line and written nowhere.
 *
 * Screens file, one screen a line, `#` starts a comment:
 *   <name> <pc|both> <route> [auth=no] [tab=<word>] [if-menu=1]
 *   pc       the PC width only (1280x800); both = PC and the phone (an emulated iPhone, since the legacy picks its
 *            phone frame by device, not by width)
 *   route    `/employees/:id` takes the id of the first row of the list route named by `list=<route>`
 *            (default: the route up to the `:id`)
 *   auth=no  taken before signing in
 *   tab=word clicks the tab whose name holds the word, then the picture
 *   if-menu=1 only when the page after sign-in links to the route; else a "not shown" line
 * Out: <name>-pc.png, <name>-phone.png and calls.json (each screen's API calls as `METHOD /path`, ids as `:id`,
 * no query, no body).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Browser, BrowserContext, Page } from '@playwright/test';

type Device = 'pc' | 'phone';
interface Screen {
  name: string;
  devices: Device[];
  route: string;
  auth: boolean;
  tab: string | undefined;
  ifMenu: boolean;
  list: string | undefined;
}

const SIGN_IN_FAILED =
  'sign-in did not complete (the name or password, or the sign-in form, is not as expected)';

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function fail(why: string, code = 2): never {
  console.log(`== refused: ${why}`);
  process.exit(code);
}

function parseScreens(text: string): Screen[] {
  const out: Screen[] = [];
  const names = new Set<string>();
  text.split('\n').forEach((raw, i) => {
    const line = raw.replace(/#.*/, '').trim();
    if (line === '') return;
    const [name, dev, route, ...opts] = line.split(/\s+/);
    const at = `screens file line ${i + 1}`;
    if (!name || !dev || !route) fail(`${at}: expected <name> <pc|both> <route> [options]`);
    if (!/^[a-z0-9][a-z0-9-]*$/.test(name))
      fail(`${at}: the name is lower case letters, digits and dashes`);
    if (names.has(name)) fail(`${at}: the name ${name} is there twice`);
    if (dev !== 'pc' && dev !== 'both') fail(`${at}: the devices are pc or both`);
    if (!route.startsWith('/') || /[?#\s]/.test(route))
      fail(`${at}: the route starts with / and has no query`);
    const s: Screen = {
      name,
      devices: dev === 'pc' ? ['pc'] : ['pc', 'phone'],
      route,
      auth: true,
      tab: undefined,
      ifMenu: false,
      list: undefined,
    };
    for (const o of opts) {
      const [k, v] = o.split('=');
      if (k === 'auth' && v === 'no') s.auth = false;
      else if (k === 'tab' && v && /^[A-Za-z]+$/.test(v)) s.tab = v;
      else if (k === 'if-menu' && v === '1') s.ifMenu = true;
      else if (k === 'list' && v?.startsWith('/')) s.list = v;
      else
        fail(`${at}: the option ${o} is not one of auth=no, tab=<word>, if-menu=1, list=<route>`);
    }
    if (s.route.includes(':id') && !s.route.endsWith(':id') && !/:id\/[a-z]+$/.test(s.route)) {
      fail(`${at}: :id stands as a path segment only`);
    }
    names.add(name);
    out.push(s);
  });
  if (out.length === 0) fail('the screens file names no screen');
  return out;
}

/** METHOD /path with ids as :id, no query, no body. */
function callKey(method: string, rawUrl: string): string {
  const path = new URL(rawUrl).pathname
    .split('/')
    .map((seg) =>
      /^\d+$/.test(seg) ||
      /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(seg) ||
      (/\d/.test(seg) && /^[A-Za-z0-9_-]{16,}$/.test(seg))
        ? ':id'
        : seg,
    )
    .join('/');
  return `${method} ${path}`;
}

async function readCredential(): Promise<{ user: string; pass: string }> {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  const lines = Buffer.concat(chunks).toString('utf8').split('\n');
  const user = (lines[0] ?? '').replace(/\r$/, '');
  const pass = (lines[1] ?? '').replace(/\r$/, '');
  if (user === '' || pass === '')
    fail('stdin did not carry two lines: the root name, then the password');
  return { user, pass };
}

const base = { pc: { viewport: { width: 1280, height: 800 } } };

async function newContext(
  browser: Browser,
  device: Device,
  pw: typeof import('@playwright/test'),
): Promise<BrowserContext> {
  if (device === 'pc') return browser.newContext({ ...base.pc, colorScheme: 'light' });
  const { defaultBrowserType: _t, ...phone } = pw.devices['iPhone 13'];
  return browser.newContext({ ...phone, colorScheme: 'light' });
}

async function hrefsOf(page: Page): Promise<string[]> {
  const links = await page.locator('a[href]').all();
  return (await Promise.all(links.map((l) => l.getAttribute('href')))).map((h) => h ?? '');
}

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined);
  await page.waitForTimeout(500);
}

async function signIn(
  page: Page,
  root: string,
  cred: { user: string; pass: string },
): Promise<boolean> {
  try {
    await page.goto(root + '/login');
    await page.locator('input[name="identifier"]').fill(cred.user);
    await page.locator('input[name="password"]').fill(cred.pass);
    await page
      .getByRole('button', { name: /sign in/i })
      .first()
      .click();
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
    await settle(page);
    return true;
  } catch {
    return false;
  }
}

async function firstRowId(
  page: Page,
  root: string,
  listRoute: string,
): Promise<string | undefined> {
  await page.goto(root + listRoute);
  await settle(page);
  const hrefs = await hrefsOf(page);
  const re = new RegExp(`^${listRoute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/([^/?#]+)$`);
  for (const h of hrefs) {
    const m = re.exec(h.replace(/^https?:\/\/[^/]+/, ''));
    const id = m?.[1];
    if (id && id !== 'new' && id !== 'organization') return id;
  }
  // No row link: a row that navigates when clicked (a click that only opens a page).
  const row = page.locator('tbody tr').first();
  if ((await row.count()) === 0) return undefined;
  await row.click();
  await page.waitForURL((u) => re.test(u.pathname), { timeout: 15_000 }).catch(() => undefined);
  return re.exec(new URL(page.url()).pathname)?.[1];
}

async function main(): Promise<void> {
  const screensFile = arg('--screens');
  if (!screensFile) fail('--screens <file> is required');
  let text: string;
  try {
    text = readFileSync(screensFile, 'utf8');
  } catch {
    return fail('the screens file cannot be read');
  }
  const screens = parseScreens(text);
  const count = (d: Device): number => screens.filter((s) => s.devices.includes(d)).length;
  console.log(
    `== screens file parsed: ${screens.length} screens, ${count('pc')} pictures at PC width, ${count('phone')} on the phone`,
  );
  if (process.argv.includes('--check')) {
    console.log('== check: no browser opened');
    return;
  }
  const root = (arg('--url') ?? '').replace(/\/+$/, '');
  const out = arg('--out');
  if (!/^https?:\/\/[^/\s]+$/.test(root))
    fail("--url is the legacy app's address, such as https://host (no path)");
  if (!out) fail('--out <dir> is required');
  const cred = await readCredential();
  mkdirSync(out, { recursive: true });

  const pw = await import('@playwright/test');
  const browser = await pw.chromium.launch({ args: ['--disable-partial-raster'] });
  const calls: Record<string, string[]> = {};
  const notes: string[] = [];
  let reds = 0;
  try {
    for (const device of ['pc', 'phone'] as const) {
      const mine = screens.filter((s) => s.devices.includes(device));
      if (mine.length === 0) continue;
      console.log(`== ${device}`);
      // Before signing in: a fresh context, so the sign-in screen shows signed out.
      const anon = await newContext(browser, device, pw);
      const ap = await anon.newPage();
      for (const s of mine.filter((x) => !x.auth))
        await shot(ap, s, device, root, out, calls, notes, undefined, () => reds++);
      await anon.close();
      const ctx = await newContext(browser, device, pw);
      const page = await ctx.newPage();
      if (!(await signIn(page, root, cred))) {
        console.log(`== ${device}: ${SIGN_IN_FAILED}`);
        await ctx.close();
        reds++;
        continue;
      }
      console.log(`== ${device}: signed in`);
      const ids = new Map<string, string | undefined>();
      for (const s of mine.filter((x) => x.auth)) {
        let route = s.route;
        if (route.includes(':id')) {
          const list = s.list ?? route.slice(0, route.indexOf('/:id'));
          if (!ids.has(list))
            ids.set(list, await firstRowId(page, root, list).catch(() => undefined));
          const id = ids.get(list);
          if (!id) {
            console.log(`== ${s.name} (${device}): no first row to open; skipped`);
            notes.push(`${s.name}-${device}: no row in the list`);
            reds++;
            continue;
          }
          route = route.replace(':id', encodeURIComponent(id));
        }
        if (s.ifMenu) {
          const hrefs = await hrefsOf(page);
          if (!hrefs.some((h) => h.replace(/^https?:\/\/[^/]+/, '') === s.route)) {
            console.log(`== ${s.name} (${device}): not shown in the menu`);
            notes.push(`${s.name}-${device}: not shown in the menu`);
            continue;
          }
        }
        await shot(page, s, device, root, out, calls, notes, route, () => reds++);
      }
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
  writeFileSync(join(out, 'calls.json'), JSON.stringify({ calls, notes }, null, 2) + '\n');
  const nonGet = Object.values(calls)
    .flat()
    .filter((c) => !c.startsWith('GET ')).length;
  console.log(`== calls.json written (${nonGet} calls that are not GET, listed there)`);
  if (reds > 0) process.exitCode = 1;
}

async function shot(
  page: Page,
  s: Screen,
  device: Device,
  root: string,
  out: string,
  calls: Record<string, string[]>,
  notes: string[],
  route: string | undefined,
  red: () => void,
): Promise<void> {
  const key = `${s.name}-${device}`;
  const seen = new Set<string>();
  const onReq = (r: { method(): string; url(): string; resourceType(): string }): void => {
    if (r.resourceType() === 'fetch' || r.resourceType() === 'xhr')
      seen.add(callKey(r.method(), r.url()));
  };
  page.on('request', onReq);
  try {
    await page.goto(root + (route ?? s.route));
    await settle(page);
    if (s.tab) {
      const word = new RegExp(s.tab, 'i');
      const tab = page.getByRole('tab', { name: word }).first();
      if ((await tab.count()) > 0) await tab.click();
      else await page.getByText(word).first().click();
      await settle(page);
    }
    await page.screenshot({ path: join(out, `${key}.png`), fullPage: true });
    console.log(`== ${key}: picture taken`);
  } catch (e) {
    // Playwright's message can carry the address or a typed value: only the kind of error is printed.
    console.log(`== ${key}: failed (${e instanceof Error ? e.name : 'error'})`);
    notes.push(`${key}: failed`);
    red();
  } finally {
    page.off('request', onReq);
    calls[key] = [...seen].sort();
  }
}

await main();

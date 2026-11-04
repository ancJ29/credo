/**
 * walk/legacy-capture.ts: one picture of each screen a screens file names, on the legacy app, signed in as a
 * client's root. Opening screens only: it navigates, reads and clicks a tab or a list row; it never saves.
 * Run by ops/legacy-capture.sh (read its header first); it is a plain Node script (Node 26 strips the types), a
 * library user of Playwright, not the test runner, so the credential can reach it on stdin.
 *
 *   node walk/legacy-capture.ts --url <address> --screens <file> --out <dir>      (three lines on stdin)
 *   node walk/legacy-capture.ts --screens <file> --check                          (parse only, no stdin)
 *
 * Stdin: line 1 the root's name, line 2 the password, line 3 the legacy's tunnel seed. Read once, held in two variables, typed into the sign-in
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
 *   tab=word clicks the tab whose value is the word (the legacy's Tabs.Tab value, the same in every language),
 *            then the picture; PC only, since the legacy's phone frame shows its tabs as a select
 *   if-menu=1 only when the page after sign-in links to the route; else a "not shown" line
 * Out: <name>-pc.png, <name>-phone.png and calls.json (each screen's API calls as `METHOD /path`, ids as `:id`,
 * no query, no body; `blocked`: the calls refused after the sign-in).
 *
 * Read only, enforced: after the sign-in every request that is not a read is aborted (`readOnly`). The legacy's
 * connector sends every API call from a browser, reads included, as `POST …/api/request` with the real method and
 * path inside a scrambled msgpack envelope (its shared/connectors call-api.ts), so that envelope is read back here.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Browser, BrowserContext, Page, Request } from '@playwright/test';

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
      else if (k === 'tab' && v && /^[a-z]+$/.test(v)) s.tab = v;
      else if (k === 'if-menu' && v === '1') s.ifMenu = true;
      else if (k === 'list' && v?.startsWith('/')) s.list = v;
      else
        fail(`${at}: the option ${o} is not one of auth=no, tab=<word>, if-menu=1, list=<route>`);
    }
    if (s.route.includes(':id') && !s.route.endsWith(':id') && !/:id\/[a-z]+$/.test(s.route)) {
      fail(`${at}: :id stands as a path segment only`);
    }
    if (s.tab && s.devices.includes('phone'))
      fail(`${at}: tab= is pc only (the legacy's phone frame shows its tabs as a select)`);
    names.add(name);
    out.push(s);
  });
  if (out.length === 0) fail('the screens file names no screen');
  return out;
}

/** METHOD /path with ids as :id, no query, no body. */
function callKey(method: string, rawPath: string): string {
  const path = rawPath
    .replace(/[?#].*/, '')
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

/**
 * The legacy's tunnel envelope XORs its msgpack bytes with SHA-256(seed + the hour slot) (its shared/kits
 * crypt.ts `scrambleBytes`). The seed ships in every legacy bundle but stays out of this repo: ops/legacy-capture.sh
 * reads it from the legacy's source file and sends it as stdin line 3; it is held here, never printed or logged.
 */
let tunnelSeed = '';

/** The envelope's first two entries, `method` then `path`, as the connector writes them; else undefined. */
function readEnvelope(b: Buffer): { method: string; path: string } | undefined {
  let at = 0;
  const str = (): string => {
    const t = b.readUInt8(at++);
    let n: number;
    if (t >= 0xa0 && t <= 0xbf) n = t & 0x1f;
    else if (t === 0xd9) n = b.readUInt8(at++);
    else if (t === 0xda) {
      n = b.readUInt16BE(at);
      at += 2;
    } else throw new RangeError('not a string');
    if (at + n > b.length) throw new RangeError('short');
    const s = b.toString('utf8', at, at + n);
    at += n;
    return s;
  };
  try {
    const head = b.readUInt8(at++);
    if (head === 0xde) at += 2;
    else if (head < 0x82 || head > 0x8f) return undefined;
    const fields = new Map<string, string>();
    for (let i = 0; i < 2; i++) fields.set(str(), str());
    const method = fields.get('method');
    const path = fields.get('path');
    if (!method || !/^[A-Z]+$/.test(method) || !path?.startsWith('/')) return undefined;
    return { method, path };
  } catch {
    return undefined;
  }
}

function tunnelCall(body: Buffer | null): { method: string; path: string } | undefined {
  if (!body || body.length < 16) return undefined;
  const slot = Math.floor(Date.now() / 3_600_000);
  // The browser built the body a moment ago: this hour's key, or the one before it at the turn of the hour.
  for (const s of [slot, slot - 1, slot + 1]) {
    const key = createHash('sha256').update(`${tunnelSeed}${s}`).digest();
    const call = readEnvelope(Buffer.from(body.map((v, i) => v ^ (key[i % key.length] ?? 0))));
    if (call) return call;
  }
  return undefined;
}

/** The call a request makes: its own method and path, or the tunnel envelope's; undefined if unreadable. */
function callOf(r: Request): { method: string; path: string } | undefined {
  const path = new URL(r.url()).pathname;
  if (r.method() === 'POST' && path.endsWith('/api/request')) return tunnelCall(r.postDataBuffer());
  return { method: r.method(), path };
}

/** Reads by the legacy's own route tables, though POSTed: range and sync queries, a batch get, the session's refresh. */
const READ_POSTS = /\/(query|query-sync|batch|refresh-token)$/;

function isRead(c: { method: string; path: string }): boolean {
  if (c.method === 'GET' || c.method === 'HEAD') return true;
  return c.method === 'POST' && READ_POSTS.test(c.path.replace(/[?#].*/, ''));
}

/** After the sign-in: every request that is not a read (or cannot be read) is aborted and listed. */
async function readOnly(ctx: BrowserContext, blocked: Set<string>, device: Device): Promise<void> {
  await ctx.route('**/*', async (route) => {
    const r = route.request();
    const c = callOf(r);
    if (c && isRead(c)) return route.continue();
    const what = c
      ? callKey(c.method, c.path)
      : `${callKey(r.method(), new URL(r.url()).pathname)} (unreadable)`;
    blocked.add(`${device}: ${what}`);
    return route.abort('blockedbyclient');
  });
}

async function readCredential(): Promise<{ user: string; pass: string }> {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  const lines = Buffer.concat(chunks).toString('utf8').split('\n');
  const user = (lines[0] ?? '').replace(/\r$/, '');
  const pass = (lines[1] ?? '').replace(/\r$/, '');
  tunnelSeed = (lines[2] ?? '').replace(/\r$/, '');
  if (user === '' || pass === '' || tunnelSeed === '')
    fail('stdin did not carry three lines: the root name, the password, the tunnel seed');
  return { user, pass };
}

const base = { pc: { viewport: { width: 1280, height: 800 } } };

async function newContext(
  browser: Browser,
  device: Device,
  pw: typeof import('@playwright/test'),
): Promise<BrowserContext> {
  // No service worker: a request it made would pass by the context's route (readOnly).
  const own = { colorScheme: 'light', serviceWorkers: 'block' } as const;
  if (device === 'pc') return browser.newContext({ ...base.pc, ...own });
  const { defaultBrowserType: _t, ...phone } = pw.devices['iPhone 13'];
  return browser.newContext({ ...phone, ...own });
}

async function hrefsOf(page: Page): Promise<string[]> {
  const links = await page.locator('a[href]').all();
  return (await Promise.all(links.map((l) => l.getAttribute('href')))).map((h) => h ?? '');
}

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined);
  await page.waitForTimeout(500);
}

// Returns undefined when signed in, else a fixed text naming the step that stopped (never a value, never
// Playwright's own message). The form is found by its password field and sent by its own submit button, so the
// page's language does not matter; the "sign-in link" button is never pressed.
async function signIn(
  page: Page,
  root: string,
  cred: { user: string; pass: string },
): Promise<string | undefined> {
  const step = async (find: () => Promise<boolean>): Promise<boolean> => find().catch(() => false);
  await page.goto(root + '/login').catch(() => undefined);
  const nameField = page.locator('input[name="identifier"]');
  if (!(await step(async () => (await nameField.count()) > 0)))
    return 'sign-in stopped: the name field was not found';
  const passField = page.locator('input[name="password"]');
  if (!(await step(async () => (await passField.count()) > 0)))
    return 'sign-in stopped: the password field was not found';
  const submit = page.locator('form:has(input[name="password"]) button[type="submit"]').first();
  if (!(await step(async () => (await submit.count()) > 0)))
    return 'sign-in stopped: the submit button was not found';
  try {
    await nameField.fill(cred.user);
    await passField.fill(cred.pass);
    await submit.click();
  } catch {
    return 'sign-in stopped: the form could not be filled and sent';
  }
  try {
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
  } catch {
    return 'sign-in stopped: still on the sign-in page after sending (most likely the name or password)';
  }
  try {
    await settle(page);
    await page.locator('a[href], nav, main').first().waitFor({ timeout: 20_000 });
  } catch {
    return 'sign-in stopped: left the sign-in page but the app did not load';
  }
  return undefined;
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
  const blocked = new Set<string>();
  // The phone frame lists people as cards, not table rows: it opens the person the PC found.
  const ids = new Map<string, string | undefined>();
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
      const stopped = await signIn(page, root, cred);
      if (stopped) {
        console.log(`== ${device}: ${stopped}`);
        await ctx.close();
        reds++;
        continue;
      }
      console.log(`== ${device}: signed in`);
      await readOnly(ctx, blocked, device);
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
  const refused = [...blocked].sort();
  writeFileSync(
    join(out, 'calls.json'),
    JSON.stringify({ calls, blocked: refused, notes }, null, 2) + '\n',
  );
  console.log(
    `== calls.json written (${refused.length} calls that are not reads blocked, listed there)`,
  );
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
  const onReq = (r: Request): void => {
    if (r.resourceType() !== 'fetch' && r.resourceType() !== 'xhr') return;
    const c = callOf(r);
    seen.add(
      c
        ? callKey(c.method, c.path)
        : `${callKey(r.method(), new URL(r.url()).pathname)} (unreadable)`,
    );
  };
  page.on('request', onReq);
  try {
    await page.goto(root + (route ?? s.route));
    await settle(page);
    if (s.auth && new URL(page.url()).pathname.startsWith('/login')) {
      console.log(`== ${key}: failed (the page went back to the sign-in screen)`);
      notes.push(`${key}: signed out`);
      red();
      return;
    }
    if (s.tab) {
      // Mantine's Tabs.Tab id ends in -tab-<value>; no click on a text that merely holds the word.
      const tab = page.locator(`[role="tab"][id$="-tab-${s.tab}"]`).first();
      if ((await tab.count()) === 0) {
        console.log(`== ${key}: the tab is not shown; no picture`);
        notes.push(`${key}: tab not shown`);
        return;
      }
      await tab.click();
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

// Node's own print of an uncaught error would carry Playwright's message and call log (the address with it).
await main().catch((e: unknown) => {
  console.log(`== failed (${e instanceof Error ? e.name : 'error'}; the message is not printed)`);
  process.exitCode = 1;
});

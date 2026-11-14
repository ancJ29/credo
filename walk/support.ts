/// <reference lib="dom" />
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { type EnvName, type Language } from '@credo/shared';
import { comparePictures, decodePng, type Difference } from '@credo/scripts/pixels';
import { expect, type Locator, type Page } from '@playwright/test';

/** The widths the visual report draws a screen at; every walk shoots the same three. */
export { WIDTHS } from '@credo/shared';

export const required = (
  name: EnvName | 'CREDO_SHOTS_DIR',
  how = 'run this through `pnpm stack -- …`',
) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set: ${how}`);
  return value;
};

/** At most this many shots of one screen before it is called unsteady. */
const MAX_SHOTS = 10;
/** The wait between two shots, for a transition or a repaint still under way. */
const BETWEEN_SHOTS_MS = 100;
/** Mantine draws a scroll area's scrollbar (type hover, a table's `Table.ScrollContainer`) while the
 * pointer is over it, and a pointer enter can land after the pointer was parked in the corner (the
 * table mounts under it after a click, the browser dispatches the enter late), so a wait for the bar
 * to detach passed before it appeared and the fake and the stack caught it at different times
 * (20:01 run). Drawn hidden, the picture is the one of a pointer away from the table; the bar is
 * absolutely placed, so no layout moves. */
const NO_SCROLLBARS = '[data-mantine-scrollbar] { visibility: hidden !important; }';

const describeMove = (difference: Exclude<Difference, { kind: 'equal' }>) =>
  difference.kind === 'size'
    ? `sizes ${difference.left} and ${difference.right}`
    : `${difference.pixels} pixels, largest shade ${difference.shade}`;

/** The one way a picture is taken. The pointer is parked in the corner first (a button under it is
 * drawn hovered, and which one depends on where the last click left it) and the page is scrolled to
 * the top (a fixed bar is drawn where the scroll left it), once no button loader is on the page. Then full-page shots, animations off and
 * the caret hidden and a table's hover scrollbar not drawn, until two in a row are equal pixel for pixel by the raw reader, at most ten, or a
 * red naming the pixels between the last two. The picture is written to
 * `CREDO_SHOTS_DIR/<screen>-<language>-<width>.png`; `walk/run.sh` compares folders and bases, this
 * compares nothing with a base. `mask` paints over what is minted on every run and the human need not
 * judge: each call names the unit test that holds what it covers (QA rule 7). */
export async function shot(
  page: Page,
  screen: string,
  language: Language,
  width: number,
  mask: Locator[] = [],
) {
  // A pressed button's loader fades out in Mantine's 150 ms transition: no picture is taken while one is on
  // the page (the shape of the services walk's own wait, 926c1b2). The count is of mounted elements, not visible ones: a loader whose
  // exit has not finished stays mounted at opacity 0, which Playwright reads as visible, so a walk that pauses the
  // clock must advance it before its picture. No screen's subject is a loader.
  await expect(
    page.locator('.mantine-Button-loader'),
    `${screen}: a button's loader is still on the page`,
  ).toHaveCount(0);
  await page.mouse.move(0, 0);
  await page.evaluate('window.scrollTo(0, 0)');
  const name = `${screen}-${language}-${width}.png`;
  const dir = required('CREDO_SHOTS_DIR', 'walk/run.sh gives it the folder for the pictures');
  const take = () =>
    page.screenshot({
      fullPage: true,
      animations: 'disabled',
      caret: 'hide',
      mask,
      style: NO_SCROLLBARS,
    });
  let last = await take();
  let moved = 'no second shot';
  for (let taken = 1; taken < MAX_SHOTS; taken++) {
    await page.waitForTimeout(BETWEEN_SHOTS_MS);
    const next = await take();
    const difference = comparePictures(decodePng(last), decodePng(next));
    if (difference.kind === 'equal') {
      await writeFile(join(dir, name), next);
      return;
    }
    moved = describeMove(difference);
    last = next;
  }
  throw new Error(`${name} did not settle in ${MAX_SHOTS} shots: the last two differ by ${moved}`);
}

/** A mask for the figures of an add-company form's list of boxes alone. Each line reads
 * `<name>: <free disk> GB … <companies> …` in one translated string, and the figures are real on a stack and
 * invented on the fake, so they differ in width and the words after the first figure move with them. The
 * mask is therefore a block of one fixed width laid from the first figure to the end of the line (the
 * name, its radio and which one is chosen stay in the picture), drawn as an element of its own over the
 * page, which no layout reads and which React does not own. The figure is found after the first ": ",
 * since a box's name may hold digits. A line that wraps, or whose figures outrun the block, is a red:
 * the picture would then differ between the fake and the stack outside the mask. Held by
 * ui/src/parts/NewClientBoxes.test.tsx ("C9: The form lists each box with its free disk and its
 * companies, the home box chosen"). Call it just before the picture; it replaces its own earlier blocks. */
export async function boxFigures(group: Locator): Promise<Locator[]> {
  await group.evaluate((root, attribute) => {
    root.ownerDocument.querySelectorAll(`[${attribute}]`).forEach((old) => old.remove());
    const doc = root.ownerDocument;
    const groupRight = root.getBoundingClientRect().right + doc.defaultView!.scrollX;
    for (const label of Array.from(root.querySelectorAll('.mantine-Radio-label'))) {
      const walker = doc.createTreeWalker(label, NodeFilter.SHOW_TEXT);
      const text = walker.nextNode();
      const content = text?.textContent ?? '';
      const colon = content.indexOf(': ');
      const digit = colon < 0 ? -1 : content.slice(colon).search(/\d/);
      if (!text || digit < 0) continue; // a box that did not answer has no figure
      const range = doc.createRange();
      range.setStart(text, colon + digit);
      range.setEnd(text, content.length);
      const rects = Array.from(range.getClientRects());
      if (rects.length !== 1) throw new Error(`a box's line wraps: ${content}`);
      const rect = rects[0];
      const view = doc.defaultView!;
      const left = rect.left + view.scrollX;
      const width = Math.min(200, groupRight - left);
      if (rect.width > width) throw new Error(`a box's figures outrun the mask: ${content}`);
      const block = doc.createElement('div');
      block.setAttribute(attribute, '');
      block.style.cssText = `position:absolute;pointer-events:none;left:${left}px;top:${rect.top + view.scrollY}px;width:${width}px;height:${rect.height}px;`;
      doc.body.append(block);
    }
  }, FIGURES);
  return group.page().locator(`[${FIGURES}]`).all();
}
const FIGURES = 'data-walk-box-figures';

/**
 * Chromium's virtual authenticator, added to this page alone through the DevTools protocol: an
 * internal one that keeps resident keys and verifies the user, so no browser dialog enters a
 * picture and the machine's own keychain is never touched. `verified(false)` makes it unable to
 * verify the user, as a device whose owner does not give a fingerprint, face or PIN; `stranger()`
 * puts a passkey on it that no operator here holds; `forget()` empties it.
 */
export async function virtualAuthenticator(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  return {
    verified: (isUserVerified: boolean) =>
      cdp.send('WebAuthn.setUserVerified', { authenticatorId, isUserVerified }),
    stranger: () =>
      cdp.send('WebAuthn.addCredential', {
        authenticatorId,
        credential: {
          credentialId: randomBytes(32).toString('base64'),
          isResidentCredential: true,
          rpId: 'localhost',
          privateKey: generateKeyPairSync('ec', { namedCurve: 'P-256' })
            .privateKey.export({ type: 'pkcs8', format: 'der' })
            .toString('base64'),
          userHandle: randomBytes(16).toString('base64'),
          signCount: 0,
        },
      }),
    /** Puts on the authenticator a passkey the stack handed over (`CREDO_OPERATOR_PASSKEY`, the first
     * of the data set's operator): the credential's id and user handle in base64url, its private key
     * as PKCS8 in base64. The BFF holds its public half, so a ceremony it answers is a real one. */
    hold: (passkey: { id: string; privateKey: string; userHandle: string }) =>
      cdp.send('WebAuthn.addCredential', {
        authenticatorId,
        credential: {
          credentialId: Buffer.from(passkey.id, 'base64url').toString('base64'),
          isResidentCredential: true,
          rpId: 'localhost',
          privateKey: passkey.privateKey,
          userHandle: Buffer.from(passkey.userHandle, 'base64url').toString('base64'),
          signCount: 0,
        },
      }),
    forget: () => cdp.send('WebAuthn.clearCredentials', { authenticatorId }),
  };
}

/** The operator's own handle, as the console keeps it on the device. */
export const readOperatorHandle = (page: Page) =>
  page.evaluate(() => localStorage.getItem('credo.operator'));

/**
 * Opens an address that may hold a one-time token (a join link's fragment). A failed opening says
 * so and not where: Playwright's own error names the address, and the log is read by others.
 */
export async function gotoQuietly(page: Page, address: string) {
  try {
    await page.goto(address);
  } catch {
    throw new Error(
      'the page did not open (the address is left out of the log, it may hold a token)',
    );
  }
}

/**
 * Waits for the page to stand on `path`, matched on the pathname alone: `toHaveURL` prints the
 * address it received, and after a failed join that is the link with its token.
 */
export async function reachedPath(page: Page, path: string) {
  await expect
    .poll(() => new URL(page.url()).pathname, {
      message: `the page did not reach ${path}`,
    })
    .toBe(path);
}

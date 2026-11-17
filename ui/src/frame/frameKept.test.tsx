import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { openApp, person } from '../../tests/open';
import { draw } from '../../tests/render';
import { DICTIONARIES } from '../i18n';
import { SessionEnded } from '../parts/SessionEnded';

const WORD = '·';

/** The page as drawn, without the style blocks the library writes into it (they grow with every render of the file),
 * with its random ids named alike and the sliding indicator's late flag left out. Every word is
 * made one dot, a text and each aria-label, placeholder, title and alt, so the snapshot keeps the
 * markup and not the partners' words. */
const markup = () => {
  const page = document.body.cloneNode(true) as HTMLElement;
  for (const style of page.querySelectorAll('style')) style.remove();
  const texts = document.createTreeWalker(page, NodeFilter.SHOW_TEXT);
  for (let text = texts.nextNode(); text; text = texts.nextNode()) {
    if (text.nodeValue?.trim()) text.nodeValue = WORD;
  }
  for (const element of page.querySelectorAll('[aria-label], [placeholder], [title], [alt]')) {
    for (const name of ['aria-label', 'placeholder', 'title', 'alt']) {
      if (element.hasAttribute(name)) element.setAttribute(name, WORD);
    }
  }
  return page.innerHTML
    .replace(/mantine-[a-z0-9]{9}(?=["-])/g, 'mantine-ID')
    .replace(/ data-initialized="true"/g, '');
};

describe('the screens already inside the app’s frame', () => {
  it('9: the session-ended prompt keeps the markup it had', () => {
    draw(<SessionEnded status="idle" onContinue={vi.fn()} onSignOut={vi.fn()} />);
    expect(markup()).toMatchSnapshot('session ended');
  });

  it('9: the operator’s passkeys', async () => {
    openApp('/operator/passkeys', { operator: true });
    await screen.findAllByRole('row');
    expect(markup()).toMatchSnapshot('passkeys');
  });

  it('9: the ways to sign in, an email and a QR code', async () => {
    openApp(`/staff/${person('EMP-0002').id}`, { signIns: true });
    await screen.findByLabelText(DICTIONARIES.en.person.emailNew);
    expect(markup()).toMatchSnapshot('ways');
  });
});

import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { openApp, person } from '../../tests/open';
import { draw } from '../../tests/render';
import { SessionEnded } from '../parts/SessionEnded';

/** The page as drawn, without the style blocks the library writes into it (they grow with every render of the file),
 * with its random ids named alike and the sliding indicator's late flag left out. */
const markup = () => {
  const page = document.body.cloneNode(true) as HTMLElement;
  for (const style of page.querySelectorAll('style')) style.remove();
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
    await screen.findByLabelText('Email');
    expect(markup()).toMatchSnapshot('ways');
  });
});

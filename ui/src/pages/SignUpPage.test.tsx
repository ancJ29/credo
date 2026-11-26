import { clientAddress, SIGN_UP_WAITING } from '@credo/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { openApp } from '../../tests/open';
import { drawApp } from '../../tests/render';
import { ApiError } from '../api';
import { App } from '../App';
import { createDeviceStore } from '../device';
import { createFakeApi, createFakePasskeys } from '../fake';
import { DICTIONARIES } from '../i18n';

const words = DICTIONARIES.en;
const GOOD = 'Correct-horse-9!';
/** A label that carries a star is found by its word inside it, as the dictionary spells it. */
const labelled = (word: string) => new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

async function fill(code = 'phu-quy', password = GOOD) {
  await userEvent.type(
    await screen.findByLabelText(labelled(words.signUp.name)),
    ' Gạch Men Phú Quý ',
  );
  await userEvent.type(screen.getByLabelText(labelled(words.signUp.code)), code);
  await userEvent.type(screen.getByLabelText(labelled(words.signUp.contactName)), 'An');
  await userEvent.type(screen.getByLabelText(labelled(words.signUp.contactPhone)), '0901 234');
  await userEvent.type(screen.getByLabelText(labelled(words.signUp.password)), password);
}
const send = () => userEvent.click(screen.getByRole('button', { name: words.signUp.submit }));

describe('15: the sign-up page opens at any address, before any company’s boot', () => {
  it('draws the form on credo’s own card at /sign-up and asks no company anything', async () => {
    const { api } = openApp('/sign-up', { out: true });

    expect(await screen.findByRole('heading', { level: 2, name: words.signUp.title })).toBeTruthy();
    expect(screen.getByText(words.signUp.intro)).toBeTruthy();
    expect(screen.getByText(words.signUp.codeHint)).toBeTruthy();
    for (const call of ['getConfig', 'me', 'signIn'] as const) {
      expect(api[call], call).not.toHaveBeenCalled();
    }
  });
});

describe('the walk spec’s sign-up screens 17 to 20, replayed on the real router', () => {
  it('WK6: the walk’s link that names no company shows the unknown screen titled at level 2', async () => {
    openApp('/login?client-code=no-such-company', {
      out: true,
      override: (spied) => {
        spied.getConfig.mockRejectedValue(new ApiError(404, true));
      },
    });

    expect(
      await screen.findByRole('heading', { level: 2, name: words.unknownClient.title }),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Credo');
  });

  it('WK6: the walk’s form, filled as the walk fills it, is sent with its password and says it was sent', async () => {
    const { api } = openApp('/sign-up');
    await fill('phu-quy', 'Gach-Men-2026!');
    await send();

    expect(await screen.findByRole('heading', { name: words.signUp.sentTitle })).toBeTruthy();
    expect(api.signUp).toHaveBeenCalledOnce();
  });

  it('WK6: the walk’s address held by a company is said taken, and the address of a company waiting shows its screen', async () => {
    const taken = openApp('/sign-up');
    await fill('hoa-sen', 'Gach-Men-2026!');
    await send();
    expect(await screen.findByText(words.signUp.taken)).toBeTruthy();
    taken.unmount();

    openApp('/login?client-code=son-ha', { out: true });
    expect(
      await screen.findByRole('heading', { level: 2, name: words.signUp.waitingTitle }),
    ).toBeTruthy();
  });
});

describe('the sign-up page speaks the device’s language', () => {
  /** A device that keeps only what a test tells it, drawn on the app at /sign-up. */
  const drawnWith = (kept: Record<string, string>) => {
    const store = {
      getItem: (key: string) => kept[key] ?? null,
      setItem: () => undefined,
      removeItem: () => undefined,
    };
    const device = createDeviceStore(store);
    drawApp(
      <App
        api={createFakeApi({ device, cue: null })}
        device={device}
        passkeys={createFakePasskeys({ cue: null })}
        build="dev"
        test
      />,
      '/sign-up',
    );
  };

  it('uses the language the person chose, else the one the last boot showed, else credo’s own', async () => {
    drawnWith({ 'credo.language': 'en' });
    expect(await screen.findByRole('heading', { name: words.signUp.title })).toBeTruthy();
    document.body.innerHTML = '';
  });

  it('falls back to the language the last boot showed', async () => {
    drawnWith({ 'credo.shown': 'en' });
    expect(await screen.findByRole('heading', { name: words.signUp.title })).toBeTruthy();
    document.body.innerHTML = '';
  });

  it('and to credo’s own where the device keeps none', async () => {
    drawnWith({});
    expect(await screen.findByRole('heading', { name: DICTIONARIES.vi.signUp.title })).toBeTruthy();
  });
});

describe('14: the sign-up page sends the form and says what came of it', () => {
  it('sends the trimmed fields once and shows the card that says it was sent, with the company’s name and address', async () => {
    const { api } = openApp('/sign-up', { out: true });
    await fill();
    await send();

    expect(await screen.findByRole('heading', { name: words.signUp.sentTitle })).toBeTruthy();
    expect(api.signUp).toHaveBeenCalledExactlyOnceWith({
      code: 'phu-quy',
      name: 'Gạch Men Phú Quý',
      contactName: 'An',
      contactPhone: '0901 234',
      password: GOOD,
    });
    const address = clientAddress(window.location.origin, 'phu-quy');
    const message = screen.getByRole('status');
    // The whole sentence reads as the dictionary's, and the address sits alone in its own plain element
    // (the walk masks that element: the stack's port is free on every run).
    expect(message.textContent).toContain(
      words.signUp.sentText.replace('{{name}}', 'Gạch Men Phú Quý').replace('{{address}}', address),
    );
    const own = message.querySelectorAll('[data-sent-address]');
    expect(own).toHaveLength(1);
    expect(own[0]?.textContent).toBe(address);
    expect(own[0]?.children).toHaveLength(0);
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('says an address taken on its field, and keeps what was typed', async () => {
    openApp('/sign-up', { out: true });
    await fill('hoa-sen');
    await send();

    expect(await screen.findByText(words.signUp.taken)).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>(labelled(words.signUp.code)).value).toBe(
      'hoa-sen',
    );
    expect(screen.queryByRole('heading', { name: words.signUp.sentTitle })).toBeNull();
  });

  it('says a field refused before anything is sent: an address that is no company code, a password that fails the rule', async () => {
    const { api } = openApp('/sign-up', { out: true });
    await fill('Phu Quy');
    await send();

    expect(await screen.findByText(words.operator.codeInvalid)).toBeTruthy();
    await userEvent.clear(screen.getByLabelText(labelled(words.signUp.code)));
    await userEvent.type(screen.getByLabelText(labelled(words.signUp.code)), 'phu-quy');
    await userEvent.clear(screen.getByLabelText(labelled(words.signUp.password)));
    await userEvent.type(screen.getByLabelText(labelled(words.signUp.password)), 'weak');
    await send();

    expect(await screen.findByText(words.person.passwordInvalid)).toBeTruthy();
    expect(api.signUp).not.toHaveBeenCalled();
  });

  it('says a company name of spaces alone is refused before anything is sent', async () => {
    const { api } = openApp('/sign-up', { out: true });
    await fill();
    const name = screen.getByLabelText(labelled(words.signUp.name));
    await userEvent.clear(name);
    await userEvent.type(name, '   ');
    await send();

    expect(await screen.findByText(words.operator.nameInvalid)).toBeTruthy();
    expect(api.signUp).not.toHaveBeenCalled();
  });

  it('says a full queue where the BFF answers 503, and any other failure as the service being unavailable, each keeping the form', async () => {
    openApp('/sign-up', { out: true, cue: 'signUp:503' });
    await fill();
    await send();

    expect((await screen.findByRole('alert')).textContent).toBe(words.signUp.full);
    expect(screen.getByRole('button', { name: words.signUp.submit })).toBeTruthy();
    await send();
    expect(await screen.findByRole('heading', { name: words.signUp.sentTitle })).toBeTruthy();
  });

  it('a request that fails otherwise is said to be unavailable', async () => {
    openApp('/sign-up', { out: true, cue: 'signUp:403' });
    await fill();
    await send();

    expect((await screen.findByRole('alert')).textContent).toBe(words.common.unavailable);
  });
});

describe('16: the boot draws the waiting screen where the 404 says waiting, and the unknown one otherwise', () => {
  it('draws "waiting for approval" with no form and no link where the settings answer 404 marked waiting', async () => {
    openApp('/', {
      out: true,
      override: (spied) => {
        spied.getConfig.mockRejectedValue(new ApiError(404, true, null, SIGN_UP_WAITING));
      },
    });

    expect(await screen.findByRole('heading', { name: words.signUp.waitingTitle })).toBeTruthy();
    expect(screen.getByText(words.signUp.waitingText)).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('draws the unknown screen, with its link to sign a company up, for any other 404', async () => {
    openApp('/', {
      out: true,
      override: (spied) => {
        spied.getConfig.mockRejectedValue(new ApiError(404, true));
      },
    });

    expect(await screen.findByRole('heading', { name: words.unknownClient.title })).toBeTruthy();
    expect(screen.getByRole('link', { name: words.signUp.title }).getAttribute('href')).toBe(
      '/sign-up',
    );
    expect(screen.queryByRole('heading', { name: words.signUp.waitingTitle })).toBeNull();
  });
});

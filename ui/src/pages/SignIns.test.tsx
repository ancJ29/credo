import { type EmployeeDoc, staffConfig } from '@credo/shared';
import { DEMO_QR_SECRET } from '@credo/shared/demo';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { openApp, person, type Spied } from '../../tests/open';
import { ApiError, type Api } from '../api';

import { DICTIONARIES } from '../i18n';

const words = DICTIONARIES.en;
/** A word with its placeholders filled as the screen fills them. */
const filled = (text: string, values: Record<string, string>) =>
  Object.entries(values).reduce(
    (made, [name, value]) => made.replaceAll(`{{${name}}}`, value),
    text,
  );
const at = (code: string) => `/staff/${person(code).id}`;
const menu = () => within(screen.getAllByRole('navigation', { name: words.nav.menu })[0]);
const NEW = 'New-password-2@';
const OLD = 'Old-password-1!';

/** A company whose root saved the email sign-in off: the setup read says so. */
const emailOff = (spied: Spied, original: Api) =>
  spied.getStaffSetup.mockImplementation(async () => {
    const read = await original.getStaffSetup();
    const fields = { ...staffConfig(read.setup).fields, email: false };
    return { ...read, setup: { ...read.setup, fields } };
  });

/** The user's menu, opened by the button that names the person. */
const openUserMenu = (name: string) => userEvent.click(screen.getByRole('button', { name }));

describe('an email on a person', () => {
  it('C: The root gives a person an email on their page and takes it back; the page says it signs in beside the code and that no mail was sent', async () => {
    const { api } = openApp(at('EMP-0002'), { signIns: true });
    await userEvent.type(
      await screen.findByLabelText(words.person.emailNew),
      ' Hung@Minh-Phat.Example ',
    );
    await userEvent.click(screen.getByRole('button', { name: words.person.emailSet }));

    expect((await screen.findAllByRole('status'))[0]?.textContent).toBe(
      filled(words.person.emailChanged, { email: 'hung@minh-phat.example' }),
    );
    expect(api.setEmail).toHaveBeenCalledWith(person('EMP-0002').id, {
      version: 'e1',
      email: ' Hung@Minh-Phat.Example ',
    });
    expect(
      screen.getByText(
        filled(words.person.signInReadyEmail, {
          code: 'EMP-0002',
          email: 'hung@minh-phat.example',
        }),
      ),
    ).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>(words.person.emailNew).value).toBe('');

    await userEvent.click(screen.getByRole('button', { name: words.person.emailRemove }));
    expect(await screen.findByText(words.person.emailRemoved));
    expect(api.setEmail).toHaveBeenLastCalledWith(person('EMP-0002').id, {
      version: 'e2',
      email: null,
    });
    expect(screen.getByText(filled(words.person.signInReady, { code: 'EMP-0002' }))).toBeTruthy();
    expect(screen.getByText(words.person.emailNone)).toBeTruthy();
    expect(screen.queryByRole('button', { name: words.person.emailRemove })).toBeNull();
  });

  it('C: A person’s page says it signs in with the email only while the company has the email sign-in on', async () => {
    const withEmail =
      (api: { getEmployee: (id: string) => Promise<EmployeeDoc> }) => async (id: string) => {
        const held = await api.getEmployee(id);
        return { ...held, employee: { ...held.employee, email: 'hung@minh-phat.example' } };
      };
    const off = openApp(at('EMP-0002'), {
      override: (spied, original) => {
        spied.getEmployee.mockImplementation(withEmail(original));
        emailOff(spied, original);
      },
    });
    expect(
      await screen.findByText(filled(words.person.signInReady, { code: 'EMP-0002' })),
    ).toBeTruthy();
    expect(off.api.getEmployee).toHaveBeenCalled();
    off.unmount();

    openApp(at('EMP-0002'), {
      signIns: true,
      override: (spied, original) => spied.getEmployee.mockImplementation(withEmail(original)),
    });
    expect(
      await screen.findByText(
        filled(words.person.signInReadyEmail, {
          code: 'EMP-0002',
          email: 'hung@minh-phat.example',
        }),
      ),
    ).toBeTruthy();
  });

  it('C: An email that is no address is said at the panel and sent to no one; one that already signs someone in, a version that moved and a failed save each say so', async () => {
    const { api } = openApp(at('EMP-0002'), {
      signIns: true,
      override: (spied) => {
        spied.setEmail
          .mockResolvedValueOnce({ kind: 'taken' })
          .mockResolvedValueOnce({ kind: 'conflict' })
          .mockRejectedValueOnce(new ApiError(503));
      },
    });
    const field = await screen.findByLabelText(words.person.emailNew);
    const give = screen.getByRole('button', { name: words.person.emailSet });

    await userEvent.type(field, 'not an address');
    await userEvent.click(give);
    expect((await screen.findByRole('alert')).textContent).toBe(words.person.emailInvalid);
    expect(api.setEmail).not.toHaveBeenCalled();

    await userEvent.clear(field);
    await userEvent.type(field, 'lan@minh-phat.example');
    await userEvent.click(give);
    expect((await screen.findByRole('alert')).textContent).toBe(words.person.emailTaken);
    expect((field as HTMLInputElement).value).toBe('lan@minh-phat.example');

    await userEvent.click(give);
    expect(await screen.findByText(words.person.conflict));

    await userEvent.click(give);
    expect(await screen.findByText(words.person.emailFailed)).toBeTruthy();
    expect((field as HTMLInputElement).value).toBe('lan@minh-phat.example');
  });

  it('C: The root’s person page offers the email and the QR code where the company never set the switches', async () => {
    openApp(at('EMP-0002'));
    expect(
      await screen.findByRole('heading', { level: 3, name: words.person.emailTitle }),
    ).toBeTruthy();
    expect(screen.getByLabelText(words.person.emailNew)).toBeTruthy();
    expect(screen.getByRole('heading', { level: 3, name: words.person.qrTitle })).toBeTruthy();
  });

  it('C: The email panel is the root’s alone, only while the company keeps the email, and the QR panel does not follow it', async () => {
    openApp(at('EMP-0002'), { override: emailOff });
    await screen.findByRole('heading', { level: 2, name: 'Trần Văn Hùng' });
    expect(screen.queryByRole('heading', { name: words.person.emailTitle })).toBeNull();
    expect(screen.getByRole('heading', { name: words.person.qrTitle })).toBeTruthy();
  });

  it('C: Someone allowed to change people sees neither the email nor the QR code, and nor does the page of a person who left', async () => {
    openApp(at('EMP-0002'), { as: 'EMP-0001', signIns: true });
    await screen.findByRole('heading', { level: 2, name: 'Trần Văn Hùng' });
    expect(screen.queryByRole('heading', { name: words.person.emailTitle })).toBeNull();
    expect(screen.queryByRole('heading', { name: words.person.qrTitle })).toBeNull();
  });

  it('C: A person who left shows neither the email nor the QR code to the root', async () => {
    openApp(at('EMP-0008'), { signIns: true });
    await screen.findByRole('heading', { level: 2, name: 'Hoàng Gia Huy' });
    expect(screen.queryByRole('heading', { name: words.person.emailTitle })).toBeNull();
    expect(screen.queryByRole('heading', { name: words.person.qrTitle })).toBeNull();
  });

  it('C: The root turns the QR sign-in off in the staff setup, where it starts on beside the email, and the person’s page then shows the email alone', async () => {
    const { api } = openApp('/staff-setup');
    await screen.findByRole('heading', { level: 2, name: words.setup.title });
    const email = screen.getByRole<HTMLInputElement>('checkbox', {
      name: words.setup.fieldEmail,
    });
    const qr = screen.getByRole<HTMLInputElement>('checkbox', {
      name: words.setup.fieldQr,
    });
    expect([email.checked, qr.checked]).toEqual([true, true]);

    await userEvent.click(qr);
    await userEvent.click(screen.getByRole('button', { name: words.setup.save }));
    await screen.findByText(words.setup.saved);
    expect((await api.getStaffSetup()).setup.fields).toMatchObject({ email: true, qr: false });

    await userEvent.click(menu().getByRole('link', { name: words.nav.staff }));
    await userEvent.click((await screen.findAllByRole('link', { name: 'Trần Văn Hùng' }))[0]);
    expect(
      await screen.findByRole('heading', { level: 3, name: words.person.emailTitle }),
    ).toBeTruthy();
    expect(screen.queryByRole('heading', { name: words.person.qrTitle })).toBeNull();
  });
});

describe('the walk spec’s email sign-in, replayed on the real router', () => {
  it('WK6: The root gives a person an email on the default switches, signs out, and the email typed in the one box signs that person in', async () => {
    const { api, device } = openApp(at('EMP-0002'));
    await userEvent.type(
      await screen.findByLabelText(words.person.emailNew),
      'hung@minh-phat.example',
    );
    await userEvent.click(screen.getByRole('button', { name: words.person.emailSet }));
    await screen.findByText(
      filled(words.person.signInReadyEmail, { code: 'EMP-0002', email: 'hung@minh-phat.example' }),
    );

    await openUserMenu('root');
    await userEvent.click(screen.getByRole('menuitem', { name: words.user.signOut }));
    await userEvent.type(
      await screen.findByLabelText(words.auth.username),
      'hung@minh-phat.example',
    );
    await userEvent.type(screen.getByLabelText(words.auth.password), 'Fake-password-1!');
    expect(screen.getByLabelText<HTMLInputElement>(words.auth.username).value).toBe(
      'hung@minh-phat.example',
    );

    await userEvent.click(screen.getByRole('button', { name: words.auth.submit }));
    await waitFor(() => expect(device.authId()).toBe(`fake.session.${person('EMP-0002').id}`));
    expect(api.signIn).toHaveBeenLastCalledWith('hung@minh-phat.example', 'Fake-password-1!');
    expect(await screen.findByRole('button', { name: 'Trần Văn Hùng' })).toBeTruthy();
  });
});

describe('the walk spec’s passkey scenes, replayed on the real router', () => {
  const HUNG = 'Trần Văn Hùng';

  it('WK6: A person opens the add page, adds a passkey, signs out, and the passkey button signs them in as themselves', async () => {
    openApp('/passkey', { as: 'EMP-0002' });
    expect(
      await screen.findByRole('heading', { level: 2, name: words.ownPasskey.title }),
    ).toBeTruthy();
    expect(screen.getByText(words.ownPasskey.text)).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: words.ownPasskey.submit }));
    expect((await screen.findByRole('status')).textContent).toContain(words.ownPasskey.added);
    expect(screen.getByText(words.ownPasskey.addedText)).toBeTruthy();

    await openUserMenu(HUNG);
    await userEvent.click(screen.getByRole('menuitem', { name: words.user.signOut }));
    await userEvent.click(await screen.findByRole('button', { name: words.auth.passkey }));
    expect(await screen.findByRole('button', { name: HUNG })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: words.ownPasskey.title })).toBeTruthy();
    expect(screen.queryByRole('button', { name: words.auth.passkey })).toBeNull();
  });

  it('WK6: The door’s passkey button tells a device that gives none, and a passkey that opens nothing here', async () => {
    const notGiven = openApp('/staff', { out: true, cue: 'passkey:notGiven' });
    await userEvent.click(await screen.findByRole('button', { name: words.auth.passkey }));
    expect((await screen.findByRole('alert')).textContent).toBe(words.passkey.notGiven);
    notGiven.unmount();

    openApp('/staff', { out: true, cue: 'passkeySignIn:401' });
    await userEvent.click(await screen.findByRole('button', { name: words.auth.passkey }));
    expect((await screen.findByRole('alert')).textContent).toBe(words.auth.passkeyRefused);
  });
});

describe('the walk spec’s own-passkey and person-passkey scenes, replayed on the real router', () => {
  const PC = `${words.ownPasskeys.remove}: Windows · Chrome`;

  it('WK6: The office’s manager sees her two passkeys, is asked before the PC’s goes, and one row is left with the message', async () => {
    openApp('/passkeys', { as: 'EMP-0001' });
    expect(
      await screen.findByRole('heading', { level: 2, name: words.ownPasskeys.title }),
    ).toBeTruthy();
    expect(screen.getByRole('cell', { name: 'iPhone · Safari' })).toBeTruthy();
    expect(screen.getByRole('cell', { name: 'Windows · Chrome' })).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: PC }));
    expect(screen.getByText(words.ownPasskeys.removeAsk)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: words.ownPasskeys.removeConfirm }));
    expect((await screen.findByRole('status')).textContent).toBe(words.ownPasskeys.removed);
    expect(screen.queryByRole('cell', { name: 'Windows · Chrome' })).toBeNull();
    // The walk's finder for the table's scroll container, and its reset before office-10's picture.
    const viewport = screen.getByRole('table').closest('.mantine-ScrollArea-viewport');
    expect(viewport).toBeTruthy();
    if (viewport) viewport.scrollLeft = 0;
    expect(viewport?.scrollLeft).toBe(0);
    expect(screen.getByRole('cell', { name: 'iPhone · Safari' })).toBeTruthy();
  });

  it('WK6: A person with no passkey is told so, with the way to add one', async () => {
    openApp('/passkeys', { as: 'EMP-0002' });
    expect(await screen.findByText(words.ownPasskeys.none)).toBeTruthy();
    expect(screen.getByRole('link', { name: words.ownPasskey.submit })).toBeTruthy();
  });

  it('WK6: The root sees the manager hold two passkeys, is asked, and removes them with the person signed out said by name', async () => {
    openApp(`/staff/${person('EMP-0001').id}`);
    expect(await screen.findByText(filled(words.person.passkeysHeld, { count: '2' }))).toBeTruthy();
    const name = person('EMP-0001').name;
    await userEvent.click(screen.getByRole('button', { name: words.person.passkeysRemove }));
    await userEvent.click(
      screen.getByRole('button', { name: filled(words.person.passkeysConfirm, { name }) }),
    );
    expect((await screen.findAllByRole('status'))[0]?.textContent).toBe(
      filled(words.person.passkeysRemoved, { name }),
    );
  });
});

/** A company whose root saved the passkey sign-in off: the setup read says so. */
const passkeysOff = (spied: Spied, original: Api) =>
  spied.getStaffSetup.mockImplementation(async () => {
    const read = await original.getStaffSetup();
    const fields = { ...staffConfig(read.setup).fields, passkey: false };
    return { ...read, setup: { ...read.setup, fields } };
  });

describe('16: the passkeys panel on a person’s page', () => {
  const lan = person('EMP-0001');
  const heldWords = (count: number) => filled(words.person.passkeysHeld, { count: String(count) });

  it('shows the root how many passkeys a person holds and why to remove them all, and a press asks first', async () => {
    const { api } = openApp(at('EMP-0001'));

    expect(
      await screen.findByRole('heading', { level: 3, name: words.person.passkeysTitle }),
    ).toBeTruthy();
    expect(screen.getByText(heldWords(2))).toBeTruthy();
    expect(screen.getByText(filled(words.person.passkeysText, { name: lan.name }))).toBeTruthy();
    expect(api.personPasskeys).toHaveBeenCalledExactlyOnceWith(lan.id);

    await userEvent.click(screen.getByRole('button', { name: words.person.passkeysRemove }));
    expect(screen.queryByRole('button', { name: words.person.passkeysRemove })).toBeNull();
    expect(
      screen.getByRole('button', {
        name: filled(words.person.passkeysConfirm, { name: lan.name }),
      }),
    ).toBeTruthy();
    expect(api.removePersonPasskeys).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: words.person.passkeysCancel }));

    expect(screen.getByRole('button', { name: words.person.passkeysRemove })).toBeTruthy();
    expect(screen.getByText(heldWords(2))).toBeTruthy();
    expect(api.removePersonPasskeys).not.toHaveBeenCalled();
  });

  it('a confirmed removal tells the outcome by the person’s name and leaves none to remove', async () => {
    const { api } = openApp(at('EMP-0001'));
    await userEvent.click(await screen.findByRole('button', { name: words.person.passkeysRemove }));
    await userEvent.click(
      screen.getByRole('button', {
        name: filled(words.person.passkeysConfirm, { name: lan.name }),
      }),
    );

    expect((await screen.findByRole('status')).textContent).toContain(
      filled(words.person.passkeysRemoved, { name: lan.name }),
    );
    expect(api.removePersonPasskeys).toHaveBeenCalledExactlyOnceWith(lan.id);
    expect(screen.queryByText(heldWords(2))).toBeNull();
    expect(screen.queryByRole('button', { name: words.person.passkeysRemove })).toBeNull();
  });

  it('a failed removal is told and the person’s passkeys stay to remove', async () => {
    openApp(at('EMP-0001'), { cue: 'removePersonPasskeys:503' });
    await userEvent.click(await screen.findByRole('button', { name: words.person.passkeysRemove }));
    await userEvent.click(
      screen.getByRole('button', {
        name: filled(words.person.passkeysConfirm, { name: lan.name }),
      }),
    );

    expect((await screen.findByRole('alert')).textContent).toBe(words.person.passkeysFailed);
    expect(screen.getByText(heldWords(2))).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: words.person.passkeysRemove }));
  });

  it('shows no panel where none is held, where passkeys are off, to anyone but the root, or for a person who left', async () => {
    const none = openApp(at('EMP-0002'));
    await screen.findByRole('heading', { level: 2, name: 'Trần Văn Hùng' });
    expect(screen.queryByRole('heading', { name: words.person.passkeysTitle })).toBeNull();
    expect(none.api.personPasskeys).toHaveBeenCalledOnce();
    none.unmount();

    const off = openApp(at('EMP-0001'), { override: passkeysOff });
    await screen.findByRole('heading', { level: 2, name: lan.name });
    expect(screen.queryByRole('heading', { name: words.person.passkeysTitle })).toBeNull();
    expect(off.api.personPasskeys).not.toHaveBeenCalled();
    off.unmount();

    const other = openApp(at('EMP-0001'), { as: 'EMP-0001' });
    await screen.findByRole('heading', { level: 2, name: lan.name });
    expect(screen.queryByRole('heading', { name: words.person.passkeysTitle })).toBeNull();
    expect(other.api.personPasskeys).not.toHaveBeenCalled();
    other.unmount();

    const left = openApp(at('EMP-0008'));
    await screen.findByRole('heading', { level: 2, name: 'Hoàng Gia Huy' });
    expect(screen.queryByRole('heading', { name: words.person.passkeysTitle })).toBeNull();
    expect(left.api.personPasskeys).not.toHaveBeenCalled();
  });

  it('a person’s page that cannot read the count says the page could not load, as for any other read', async () => {
    openApp(at('EMP-0001'), { cue: 'personPasskeys:503' });

    expect(await screen.findByRole('button', { name: words.common.retry })).toBeTruthy();
  });
});

describe('a QR code for a person', () => {
  it('9: The root shows a person a QR code and its link, copies the link, and a new code asks first while one is shown; “Keep this one” keeps it', async () => {
    const user = userEvent.setup();
    const { api } = openApp(at('EMP-0004'), { signIns: true });
    await user.click(await screen.findByRole('button', { name: words.person.qrShow }));

    const link = await screen.findByLabelText<HTMLInputElement>(words.person.qrLink);
    expect(link.readOnly).toBe(true);
    expect(link.value).toMatch(
      new RegExp(
        `^https?://[^/]+/login\\?client-code=demo&qr=${person('EMP-0004').id}\\.fake-qr-minted-1$`,
      ),
    );
    expect(screen.getByRole('img', { name: words.person.qrImage })).toBeTruthy();
    expect(screen.getByText(words.person.qrOnce)).toBeTruthy();
    expect(api.issueQr).toHaveBeenCalledWith(person('EMP-0004').id);

    // the link is copied by its button
    await user.click(
      screen.getByRole('button', { name: new RegExp(`^${words.operator.copyLink}`) }),
    );
    expect(await navigator.clipboard.readText()).toBe(link.value);

    // a new code asks first: keeping the one shown asks the BFF for nothing
    const first = link.value;
    await user.click(screen.getByRole('button', { name: words.person.qrNew }));
    expect(screen.getByText(words.person.qrNewAsk)).toBeTruthy();
    expect(screen.queryByRole('button', { name: words.person.qrNew })).toBeNull();
    await user.click(screen.getByRole('button', { name: words.person.qrNewCancel }));
    expect(screen.queryByText(words.person.qrNewAsk)).toBeNull();
    expect(link.value).toBe(first);
    expect(api.issueQr).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: words.person.qrNew }));
    await user.click(screen.getByRole('button', { name: words.person.qrNewConfirm }));
    await waitFor(() => expect(link.value).not.toBe(first));
    expect(api.issueQr).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(words.person.qrNewAsk)).toBeNull();
  });

  it('C: A QR code that could not be made says so, and the button asks again', async () => {
    openApp(at('EMP-0004'), { signIns: true, cue: 'issueQr:503' });
    await userEvent.click(await screen.findByRole('button', { name: words.person.qrShow }));

    expect((await screen.findByRole('alert')).textContent).toBe(words.person.qrFailed);
    expect(screen.queryByRole('img', { name: words.person.qrImage })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: words.person.qrShow }));
    expect(await screen.findByRole('img', { name: words.person.qrImage })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('the door’s QR button', () => {
  it('8: the card offers “Use a QR code” where the company has it on, and it opens the scan page', async () => {
    const { api } = openApp('/', { out: true });
    await userEvent.click(await screen.findByRole('button', { name: words.qrScan.button }));
    expect(await screen.findByRole('heading', { level: 2, name: words.qrScan.title })).toBeTruthy();
    expect(api.signInMethods).toHaveBeenCalled();
  });

  it('8: and none where it is off or the read fails', async () => {
    const off = openApp('/', {
      out: true,
      override: (spied) => spied.signInMethods.mockResolvedValue({ qr: false }),
    });
    await screen.findByRole('heading', { level: 2, name: words.auth.title });
    await waitFor(() => expect(off.api.signInMethods).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: words.qrScan.button })).toBeNull();
    off.unmount();

    const down = openApp('/', {
      out: true,
      override: (spied) => spied.signInMethods.mockRejectedValue(new ApiError(503)),
    });
    await screen.findByRole('heading', { level: 2, name: words.auth.title });
    await waitFor(() => expect(down.api.signInMethods).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: words.qrScan.button })).toBeNull();
  });
});

describe('the phone that opens a QR code', () => {
  const link = (secret: string, id = person('EMP-0004').id) =>
    `/login?client-code=demo&qr=${id}.${secret}`;

  it('C: A QR code opened on a phone signs that phone in, on the person’s first page, and the address is cleared of it', async () => {
    const { api, device } = openApp(link(DEMO_QR_SECRET), { signIns: true, out: true });

    expect(await screen.findByRole('heading', { level: 2, name: words.staff.title })).toBeTruthy();
    expect(api.signInQr).toHaveBeenCalledOnce();
    expect(api.signInQr).toHaveBeenCalledWith(person('EMP-0004').id, DEMO_QR_SECRET);
    expect(device.authId()).toBe(`fake.session.${person('EMP-0004').id}`);
    expect(screen.getByRole('button', { name: 'Phạm Quốc Bảo' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: words.qrSignIn.busyTitle })).toBeNull();
  });

  it('C: While the code is being read the phone says it is signing in', async () => {
    let finish: (() => void) | undefined;
    const { api } = openApp(link(DEMO_QR_SECRET), {
      signIns: true,
      out: true,
      override: (spied, original) => {
        spied.signInQr.mockImplementationOnce(
          (id, secret) =>
            new Promise((resolve) => {
              finish = () => resolve(original.signInQr(id, secret));
            }),
        );
      },
    });

    expect(
      await screen.findByRole('heading', { level: 2, name: words.qrSignIn.busyTitle }),
    ).toBeTruthy();
    await waitFor(() => expect(api.signInQr).toHaveBeenCalledOnce());
    finish?.();
    expect(await screen.findByRole('heading', { level: 2, name: words.staff.title })).toBeTruthy();
  });

  it('C: A code used before, or past its 15 minutes, is refused and says to ask for a new one; the password sign-in is one press away', async () => {
    const { device } = openApp(link('used-before-qr-code'), { signIns: true, out: true });

    expect(
      await screen.findByRole('heading', { level: 2, name: words.qrSignIn.refusedTitle }),
    ).toBeTruthy();
    expect(screen.getByText(words.qrSignIn.refusedText)).toBeTruthy();
    expect(device.authId()).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: words.qrSignIn.password }));
    expect(await screen.findByRole('heading', { level: 2, name: words.auth.title })).toBeTruthy();
  });

  it('C: A code opened a second time is refused: the first opening spent it', async () => {
    const first = openApp(link(DEMO_QR_SECRET), { signIns: true, out: true });
    await screen.findByRole('heading', { level: 2, name: words.staff.title });
    first.unmount();

    const second = openApp(link(DEMO_QR_SECRET), {
      signIns: true,
      out: true,
      override: (spied) => {
        spied.signInQr.mockRejectedValueOnce(new ApiError(401));
      },
    });
    expect(
      await screen.findByRole('heading', { level: 2, name: words.qrSignIn.refusedTitle }),
    ).toBeTruthy();
    second.unmount();
  });

  it('C: A company with the QR sign-in off refuses every code', async () => {
    // the fake's own switch is held in fake.test.tsx; here the refusal is what the phone draws
    openApp(link(DEMO_QR_SECRET), {
      out: true,
      override: (spied) => spied.signInQr.mockRejectedValueOnce(new ApiError(401)),
    });

    expect(
      await screen.findByRole('heading', { level: 2, name: words.qrSignIn.refusedTitle }),
    ).toBeTruthy();
  });

  it('C: A service that is down is not a refused code: the phone says so, and Try again asks again and signs in', async () => {
    const { api } = openApp(link(DEMO_QR_SECRET), {
      signIns: true,
      out: true,
      cue: 'signInQr:503',
    });

    expect((await screen.findByRole('alert')).textContent).toBe(words.common.unavailable);
    await userEvent.click(screen.getByRole('button', { name: words.common.retry }));
    expect(await screen.findByRole('heading', { level: 2, name: words.staff.title })).toBeTruthy();
    expect(api.signInQr).toHaveBeenCalledTimes(2);
  });

  it('C: A device already signed in takes the person the code names, and an address that names no code is the ordinary sign-in', async () => {
    const { device } = openApp(link(DEMO_QR_SECRET), { signIns: true });
    await waitFor(() => expect(device.authId()).toBe(`fake.session.${person('EMP-0004').id}`));
    expect(await screen.findByRole('button', { name: 'Phạm Quốc Bảo' })).toBeTruthy();
  });

  it('C: A link whose code is not one is the ordinary sign-in', async () => {
    const { api } = openApp('/login?client-code=demo&qr=garbage', { out: true });

    expect(await screen.findByRole('heading', { level: 2, name: words.auth.title })).toBeTruthy();
    expect(api.signInQr).not.toHaveBeenCalled();
  });
});

describe('one’s own password', () => {
  const typeAll = async (current: string, next: string, again = next) => {
    await userEvent.type(await screen.findByLabelText(words.ownPassword.current), current);
    await userEvent.type(screen.getByLabelText(words.ownPassword.new), next);
    await userEvent.type(screen.getByLabelText(words.ownPassword.again), again);
  };
  const submit = () =>
    userEvent.click(screen.getByRole('button', { name: words.ownPassword.submit }));

  it('C: A person finds the page in their menu, gives the current password first, and is told the others were signed out', async () => {
    const { api, device } = openApp('/staff', { as: 'EMP-0001' });
    await screen.findByRole('heading', { level: 2, name: words.staff.title });
    await openUserMenu('Nguyễn Thị Lan');
    await userEvent.click(screen.getByRole('menuitem', { name: words.user.password }));

    expect(
      await screen.findByRole('heading', { level: 2, name: words.ownPassword.title }),
    ).toBeTruthy();
    await typeAll(OLD, NEW);
    await submit();

    expect((await screen.findByRole('status')).textContent).toBe(words.ownPassword.changed);
    expect(api.changePassword).toHaveBeenCalledWith(OLD, NEW);
    expect(device.authId()).toBe(`fake.session.${person('EMP-0001').id}`);
    expect(screen.getByLabelText<HTMLInputElement>(words.ownPassword.current).value).toBe('');
  });

  it('C: The root changes their own password too, and takes the session that replaces theirs', async () => {
    const { device } = openApp('/password', {
      override: (spied, original) => {
        spied.changePassword.mockImplementationOnce(async (current, next) => {
          const done = await original.changePassword(current, next);
          return done.kind === 'changed'
            ? { kind: 'changed', session: { ...done.session, authId: 'd.fresh' } }
            : done;
        });
      },
    });
    await typeAll(OLD, NEW);
    await submit();

    expect(await screen.findByText(words.ownPassword.changed)).toBeTruthy();
    expect(device.authId()).toBe('d.fresh');
  });

  it('C: Someone allowed nothing still changes their own password', async () => {
    openApp('/staff', { as: 'EMP-0005', noDrivers: true });
    await screen.findByRole('heading', { level: 2, name: words.nothing.title });
    await openUserMenu('Võ Thanh Tùng');
    await userEvent.click(screen.getByRole('menuitem', { name: words.user.password }));

    expect(
      await screen.findByRole('heading', { level: 2, name: words.ownPassword.title }),
    ).toBeTruthy();
    await typeAll(OLD, NEW);
    await submit();
    expect(await screen.findByText(words.ownPassword.changed)).toBeTruthy();
  });

  it('C: A current password that is wrong is said, nothing is changed, and what was typed stays', async () => {
    const { device } = openApp('/password', { as: 'EMP-0001', cue: 'changePassword:403' });
    await typeAll('Wrong-password-1!', NEW);
    await submit();

    expect((await screen.findByRole('alert')).textContent).toBe(words.ownPassword.wrong);
    expect(screen.getByLabelText<HTMLInputElement>(words.ownPassword.current).value).toBe(
      'Wrong-password-1!',
    );
    expect(screen.getByLabelText<HTMLInputElement>(words.ownPassword.new).value).toBe(NEW);
    expect(device.authId()).toBe(`fake.session.${person('EMP-0001').id}`);
  });

  it('18: A wait on the current password is drawn in the same words, and what was typed stays', async () => {
    openApp('/password', {
      as: 'EMP-0001',
      override: (api) => {
        api.changePassword.mockResolvedValue({ kind: 'wait', seconds: 30 });
      },
    });
    await typeAll('Wrong-password-1!', NEW);
    await submit();

    expect((await screen.findByRole('alert')).textContent).toBe(
      filled(words.wait.seconds, { count: '30' }),
    );
    expect(screen.getByLabelText<HTMLInputElement>(words.ownPassword.current).value).toBe(
      'Wrong-password-1!',
    );
  });

  it('C: A new password off the rule, two that differ and no current password are said before anything is sent', async () => {
    const { api } = openApp('/password', { as: 'EMP-0001' });
    await typeAll(OLD, 'weak');
    await submit();
    expect((await screen.findByRole('alert')).textContent).toBe(words.ownPassword.invalid);

    await userEvent.clear(screen.getByLabelText(words.ownPassword.new));
    await userEvent.type(screen.getByLabelText(words.ownPassword.new), NEW);
    await submit();
    expect((await screen.findByRole('alert')).textContent).toBe(words.ownPassword.mismatch);

    await userEvent.clear(screen.getByLabelText(words.ownPassword.again));
    await userEvent.type(screen.getByLabelText(words.ownPassword.again), NEW);
    await userEvent.clear(screen.getByLabelText(words.ownPassword.current));
    await submit();
    expect((await screen.findByRole('alert')).textContent).toBe(words.ownPassword.wrong);
    expect(api.changePassword).not.toHaveBeenCalled();
  });

  it('C: A failed change says so and keeps what was typed, and a refused session signs the person out', async () => {
    const { device } = openApp('/password', {
      as: 'EMP-0001',
      override: (spied) => {
        spied.changePassword
          .mockRejectedValueOnce(new ApiError(503))
          .mockRejectedValueOnce(new ApiError(401));
      },
    });
    await typeAll(OLD, NEW);
    await submit();
    expect((await screen.findByRole('alert')).textContent).toBe(words.ownPassword.failed);
    expect(screen.getByLabelText<HTMLInputElement>(words.ownPassword.new).value).toBe(NEW);

    await submit();
    expect(await screen.findByRole('heading', { level: 2, name: words.auth.title })).toBeTruthy();
    expect(device.authId()).toBeNull();
  });
});

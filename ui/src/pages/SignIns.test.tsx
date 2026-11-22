import { type EmployeeDoc } from '@credo/shared';
import { DEMO_QR_SECRET } from '@credo/shared/demo';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { openApp, person } from '../../tests/open';
import { ApiError } from '../api';

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
      override: (spied, original) => spied.getEmployee.mockImplementation(withEmail(original)),
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

  it('C: The email panel is the root’s alone, only while the company keeps the email, and not for a person who left', async () => {
    openApp(at('EMP-0002'));
    await screen.findByRole('heading', { level: 2, name: 'Trần Văn Hùng' });
    expect(screen.queryByRole('heading', { name: words.person.emailTitle })).toBeNull();
    expect(screen.queryByRole('heading', { name: words.person.qrTitle })).toBeNull();
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

  it('C: The root turns the email and the QR sign-in on in the staff setup, and the person’s page then shows both', async () => {
    const { api } = openApp('/staff-setup');
    await screen.findByRole('heading', { level: 2, name: words.setup.title });
    const email = screen.getByRole<HTMLInputElement>('checkbox', {
      name: words.setup.fieldEmail,
    });
    const qr = screen.getByRole<HTMLInputElement>('checkbox', {
      name: words.setup.fieldQr,
    });
    expect([email.checked, qr.checked]).toEqual([false, false]);

    await userEvent.click(email);
    await userEvent.click(qr);
    await userEvent.click(screen.getByRole('button', { name: words.setup.save }));
    await screen.findByText(words.setup.saved);
    expect((await api.getStaffSetup()).setup.fields).toMatchObject({ email: true, qr: true });

    await userEvent.click(menu().getByRole('link', { name: words.nav.staff }));
    await userEvent.click((await screen.findAllByRole('link', { name: 'Trần Văn Hùng' }))[0]);
    expect(
      await screen.findByRole('heading', { level: 3, name: words.person.emailTitle }),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { level: 3, name: words.person.qrTitle })).toBeTruthy();
  });
});

describe('a QR code for a person', () => {
  it('C: The root shows a person a QR code and its link, for one sign-in within 15 minutes; a new code cancels the last', async () => {
    const { api } = openApp(at('EMP-0004'), { signIns: true });
    await userEvent.click(await screen.findByRole('button', { name: words.person.qrShow }));

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

    const first = link.value;
    await userEvent.click(screen.getByRole('button', { name: words.person.qrNew }));
    await waitFor(() => expect(link.value).not.toBe(first));
    expect(api.issueQr).toHaveBeenCalledTimes(2);
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
    openApp(link(DEMO_QR_SECRET), { out: true });

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

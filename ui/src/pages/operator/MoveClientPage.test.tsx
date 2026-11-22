import { type ClientListItem, type MoveClientReply } from '@credo/shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { openApp, type Spied } from '../../../tests/open';
import { ApiError } from '../../api';
import { Providers } from '../../frame/Providers';
import { DICTIONARIES } from '../../i18n';
import { sceneParts } from '../../scene';
import { MoveClientPage } from './MoveClientPage';

const words = DICTIONARIES.en.operator;
const fill = (text: string, count: number) => text.replace('{{count}}', String(count));
/** A line's boxes: the one the company works on, and the one being cleared. */
const boxes = (text: string, works: string, clearing: string) =>
  text.replace('{{works}}', works).replace('{{clearing}}', clearing);

type Options = { cue?: string; code?: string; before?: (api: Spied) => void };

/** The page alone, on the fake, with a wait that costs nothing, and the list as the page left it. */
function page({ cue, code = 'hoa-sen', before }: Options = {}) {
  const parts = sceneParts({ operator: true, language: 'en', cue });
  const api = parts.api as unknown as Spied;
  const original = { ...parts.api };
  for (const name of Object.keys(api) as (keyof Spied)[]) vi.spyOn(api, name);
  before?.(api);
  const wait = vi.fn<(ms: number) => Promise<void>>(() => Promise.resolve());
  render(
    <Providers colour="#2f7d6d" language="en" test>
      <MemoryRouter initialEntries={[`/operator/clients/${code}/move`]}>
        <Routes>
          <Route
            path="/operator/clients/:code/move"
            element={
              <MoveClientPage
                api={api}
                passkeys={parts.passkeys}
                onSignedOut={vi.fn()}
                wait={wait}
              />
            }
          />
          <Route path="/operator/clients" element={<h2>The list came back</h2>} />
        </Routes>
      </MemoryRouter>
    </Providers>,
  );
  return { api, wait, original };
}

const back = () => screen.findByRole('heading', { level: 2, name: 'The list came back' });
const choose = async () => {
  await userEvent.click(await screen.findByRole('radio', { name: /^b2/ }));
  await userEvent.click(screen.getByRole('button', { name: words.moveMake }));
};
const sequence = (api: Spied, answers: (MoveClientReply | ApiError)[]) => {
  for (const answer of answers) {
    if (answer instanceof ApiError) api.moveClient.mockRejectedValueOnce(answer);
    else api.moveClient.mockResolvedValueOnce(answer);
  }
};
/** The list, with Hoa Sen carrying a mark. */
const carrying = (form: 'copying' | 'sweeping', box: string) => (api: Spied) =>
  api.listClients.mockResolvedValue([
    {
      code: 'hoa-sen',
      name: 'Hoa Sen',
      madeAt: 1,
      link: '/login',
      box: form === 'copying' ? 'home' : 'b2',
      move: { form, box },
    },
  ] satisfies ClientListItem[]);

describe('the page that moves a company to another box', () => {
  it('C14: It names the company and its box, lists only the other boxes with free disk and companies, and moves nothing until a box is picked', async () => {
    page();

    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: words.moveTitle.replace('{{name}}', 'Hoa Sen'),
      }),
    ).toBeTruthy();
    expect(
      screen.getByText(words.moveHere.replace('{{name}}', 'Hoa Sen').replace('{{box}}', 'home')),
    ).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'b2: 112 GB free, 0 companies' })).toBeTruthy();
    expect(screen.queryByRole('radio', { name: /^home/ })).toBeNull();
    expect(screen.getByRole('button', { name: words.moveMake }).hasAttribute('disabled')).toBe(
      true,
    );
  });

  it('C14: With a touch it presses on through the waits, the copy and the sweep, saying what is left each time, and comes back to the list', async () => {
    const { api, wait, original } = page();
    const held: (() => void)[] = [];
    let calls = 0;
    api.moveClient.mockImplementation(async (code, request) => {
      calls += 1;
      // The third and the fifth presses wait for the test to read what the page says.
      if (calls === 3 || calls === 5) await new Promise<void>((release) => held.push(release));
      return await original.moveClient(code, request);
    });

    await choose();

    expect(await screen.findByText(words.moveCopying)).toBeTruthy();
    held[0]();
    expect(
      await screen.findByText(fill(words.moveSweeping.replace('{{clearing}}', 'home'), 30)),
    ).toBeTruthy();
    held[1]();
    expect(await back()).toBeTruthy();
    expect(api.operatorPasskeyConfirmOptions).toHaveBeenCalledExactlyOnceWith('move-client');
    expect(api.moveClient.mock.calls[0]?.[1]).toMatchObject({ to: 'b2' });
    expect(api.moveClient.mock.calls.slice(1).map((call) => call[1])).toEqual([{}, {}, {}, {}]);
    expect(wait.mock.calls).toEqual([[2000], [2000]]);
  });

  it('C14: While a wait runs the page says the company is closed and for how long', async () => {
    const { api, wait } = page();
    sequence(api, [{ phase: 'waiting', seconds: 15 }, { phase: 'done' }]);
    wait.mockImplementationOnce(async () => {
      await waitFor(() =>
        expect(screen.getByRole('status').textContent).toBe(fill(words.moveWait, 15)),
      );
    });

    await choose();

    expect(await back()).toBeTruthy();
    expect(wait).toHaveBeenCalledExactlyOnceWith(15000);
  });

  it('C14: A failed press says the company is still on its old box and offers to go on, which carries the move to its end', async () => {
    const { api } = page();
    sequence(api, [
      { phase: 'waiting', seconds: 1 },
      new ApiError(503),
      { phase: 'copying', left: 5 },
      { phase: 'switched', seconds: 1 },
      { phase: 'done' },
    ]);
    await choose();

    expect((await screen.findByRole('alert')).textContent).toBe(words.moveFailed);
    expect(screen.getByRole('button', { name: words.moveStop })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: words.moveGoOn }));

    expect(await back()).toBeTruthy();
    expect(api.moveClient).toHaveBeenCalledTimes(5);
  });

  it('C14: A failed press may be answered by a stop, which puts the company back and sweeps the part copy', async () => {
    const { api } = page();
    sequence(api, [
      { phase: 'waiting', seconds: 1 },
      new ApiError(503),
      { phase: 'stopped', seconds: 1 },
      { phase: 'sweeping', left: 4 },
      { phase: 'done' },
    ]);
    await choose();
    await userEvent.click(await screen.findByRole('button', { name: words.moveStop }));

    expect(await back()).toBeTruthy();
    expect(api.moveClient.mock.calls[2]?.[1]).toEqual({ stop: true });
  });

  it('C14: A press that fails after the switch says the company works on its new box and offers no stop', async () => {
    const { api } = page();
    sequence(api, [
      { phase: 'waiting', seconds: 1 },
      { phase: 'switched', seconds: 1 },
      new ApiError(503),
    ]);
    await choose();

    expect((await screen.findByRole('alert')).textContent).toBe(
      boxes(words.moveFailedAfter, 'b2', 'home'),
    );
    expect(screen.getByRole('button', { name: words.moveGoOn })).toBeTruthy();
    expect(screen.queryByRole('button', { name: words.moveStop })).toBeNull();
  });

  it('C14: A press that fails after a stop says the company works on its old box and the new one is being cleared', async () => {
    const { api } = page();
    sequence(api, [
      { phase: 'waiting', seconds: 1 },
      new ApiError(503),
      { phase: 'stopped', seconds: 1 },
      new ApiError(503),
    ]);
    await choose();
    await userEvent.click(await screen.findByRole('button', { name: words.moveStop }));

    const alert = (await screen.findByRole('alert')).textContent;
    expect(alert).toBe(boxes(words.moveFailedAfter, 'home', 'b2'));
    expect(screen.queryByRole('button', { name: words.moveStop })).toBeNull();
  });

  it('C14: A beginning that fails leaves the form to try again', async () => {
    const { api } = page({ cue: 'moveClient:503' });
    await choose();

    expect((await screen.findByRole('alert')).textContent).toBe(words.moveRefused);
    expect(screen.getByRole('button', { name: words.moveMake })).toBeTruthy();
    expect(api.moveClient).toHaveBeenCalledTimes(1);
  });

  it('C14: A touch not given moves nothing', async () => {
    const { api } = page({ cue: 'passkey:notGiven' });
    await choose();

    expect((await screen.findByRole('alert')).textContent).toBe(DICTIONARIES.en.passkey.notGiven);
    expect(api.moveClient).not.toHaveBeenCalled();
  });

  it('C14: A touch that fails to start moves nothing and says the step failed', async () => {
    const { api } = page({
      before: (api) => api.operatorPasskeyConfirmOptions.mockRejectedValueOnce(new ApiError(503)),
    });
    await choose();

    expect((await screen.findByRole('alert')).textContent).toBe(words.moveRefused);
    expect(api.moveClient).not.toHaveBeenCalled();
  });

  it('C14: A form sent with no box picked moves nothing', async () => {
    const { api } = page();
    const make = await screen.findByRole('button', { name: words.moveMake });
    fireEvent.submit(make.closest('form')!);

    expect(api.operatorPasskeyConfirmOptions).not.toHaveBeenCalled();
    expect(api.moveClient).not.toHaveBeenCalled();
  });

  it('C14: A press the session no longer allows (401) opens the sign-in prompt', async () => {
    openApp('/operator/clients/hoa-sen/move', {
      operator: true,
      override: (spied) => spied.moveClient.mockRejectedValueOnce(new ApiError(401)),
    });
    await choose();

    expect(
      await screen.findByRole('dialog', { name: DICTIONARIES.en.passkey.endedTitle }),
    ).toBeTruthy();
  });

  it('C14: A company not in the list has no form', async () => {
    page({ code: 'nobody' });

    expect((await screen.findByRole('status')).textContent).toBe(words.rootUnknown);
    expect(screen.queryByRole('radio')).toBeNull();
  });

  it('C14: A back end with one box has nothing to move to', async () => {
    page({
      before: (api) =>
        api.operatorBoxes.mockResolvedValue([{ name: 'home', companies: 3, freeBytes: 1 }]),
    });

    expect(await screen.findByText(words.moveNoBox)).toBeTruthy();
    expect(screen.queryByRole('radio')).toBeNull();
  });

  it('C15: A page opened mid-copy offers to go on or to stop, and does nothing until one is pressed', async () => {
    const { api } = page({
      before: (api) => {
        carrying('copying', 'b2')(api);
        sequence(api, [
          { phase: 'copying', left: 2 },
          { phase: 'switched', seconds: 1 },
          { phase: 'done' },
        ]);
      },
    });

    expect(await screen.findByText(words.moveUnder.replace('{{box}}', 'b2'))).toBeTruthy();
    expect(api.moveClient).not.toHaveBeenCalled();
    expect(screen.queryByRole('radio')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: words.moveGoOn }));

    expect(await back()).toBeTruthy();
    expect(api.moveClient.mock.calls.map((call) => call[1])).toEqual([{}, {}, {}]);
    expect(api.operatorPasskeyConfirmOptions).not.toHaveBeenCalled();
  });

  it('C15: A page opened mid-copy may stop the move instead', async () => {
    const { api } = page({
      before: (api) => {
        carrying('copying', 'b2')(api);
        sequence(api, [{ phase: 'stopped', seconds: 1 }, { phase: 'done' }]);
      },
    });
    await userEvent.click(await screen.findByRole('button', { name: words.moveStop }));

    expect(await back()).toBeTruthy();
    expect(api.moveClient.mock.calls[0]?.[1]).toEqual({ stop: true });
  });

  it('C15: A page opened on an unfinished sweep presses it on to its end, with no touch and no choice', async () => {
    const { api } = page({
      before: (api) => {
        carrying('sweeping', 'home')(api);
        sequence(api, [{ phase: 'sweeping', left: 7 }, { phase: 'done' }]);
      },
    });

    expect(await back()).toBeTruthy();
    expect(api.moveClient.mock.calls.map((call) => call[1])).toEqual([{}, {}]);
    expect(api.operatorPasskeyConfirmOptions).not.toHaveBeenCalled();
  });

  it('C15: A sweep pressed on from an opened page that fails offers to go on, and no stop', async () => {
    page({
      before: (api) => {
        carrying('sweeping', 'home')(api);
        sequence(api, [new ApiError(503)]);
      },
    });

    expect((await screen.findByRole('alert')).textContent).toBe(
      boxes(words.moveFailedAfter, 'b2', 'home'),
    );
    expect(screen.queryByRole('button', { name: words.moveStop })).toBeNull();
    expect(screen.getByRole('button', { name: words.moveGoOn })).toBeTruthy();
  });

  it('C14: In the app the route opens the page, and the page waits the seconds an answer names', async () => {
    const { api } = openApp('/operator/clients/hoa-sen/move', {
      operator: true,
      override: (spied) => {
        spied.moveClient
          .mockResolvedValueOnce({ phase: 'waiting', seconds: 1 })
          .mockResolvedValueOnce({ phase: 'done' });
      },
    });
    const began = Date.now();
    await choose();

    expect(
      await screen.findByRole(
        'heading',
        { level: 2, name: DICTIONARIES.en.nav.clients },
        { timeout: 4000 },
      ),
    ).toBeTruthy();
    expect(Date.now() - began).toBeGreaterThanOrEqual(900);
    expect(api.moveClient).toHaveBeenCalledTimes(2);
  });
});

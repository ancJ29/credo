import { DEMO_SERVICES } from '@credo/shared/demo';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openApp } from '../tests/open';
import { ApiError } from './api';
import { timeOf } from './day';
import { DICTIONARIES } from './i18n';

const words = DICTIONARIES.en;
const open = (options: Parameters<typeof openApp>[1] = {}) =>
  openApp('/operator/services', { operator: true, ...options });

/** One service's card, by its name. */
const card = async (name: string) => within(await screen.findByLabelText(name));

/** Tells the page whether the tab is in view, as the browser does. */
function inView(visible: boolean) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => (visible ? 'visible' : 'hidden'),
  });
  act(() => void document.dispatchEvent(new Event('visibilitychange')));
}

/** Lets what is pending finish. */
const settle = () =>
  act(async () => {
    await Promise.resolve();
  });

/** Lets the clock run on, and what its timers started, finish. */
const pass = (ms: number) =>
  act(async () => {
    vi.advanceTimersByTime(ms);
    await Promise.resolve();
  });

afterEach(() => {
  vi.useRealTimers();
  inView(true);
});

describe('the services status', () => {
  it('C: The page shows the app’s page, the BFF and c-storage, each answering with the build it runs, and says all three run one build', async () => {
    const { api } = open();

    expect(await screen.findByRole('heading', { level: 2, name: 'Services status' })).toBeTruthy();
    expect((await screen.findByRole('status')).textContent).toBe(words.services.oneBuild);
    for (const name of [words.services.app, words.services.bff, words.services.storage]) {
      const service = await card(name);
      expect(service.getByText(words.services.answers), name).toBeTruthy();
      expect(service.getByText(DEMO_SERVICES.build), name).toBeTruthy();
    }
    expect(screen.queryByText(words.services.differs)).toBeNull();
    expect(api.operatorServices).toHaveBeenCalledOnce();
  });

  it('C: When a deploy is half done the three builds differ: the page says so, and marks the build that is out of step', async () => {
    open({ drift: true });

    expect((await screen.findByRole('status')).textContent).toBe(words.services.twoBuilds);
    const storage = await card(words.services.storage);
    expect(storage.getByText(DEMO_SERVICES.driftBuild)).toBeTruthy();
    expect(storage.getByText(words.services.differs)).toBeTruthy();
    expect((await card(words.services.app)).queryByText(words.services.differs)).toBeNull();
    expect((await card(words.services.bff)).queryByText(words.services.differs)).toBeNull();
  });

  it('C: Three different builds are all different and none is called the odd one out, but the page still says they differ', async () => {
    open({
      override: (api, original) => {
        api.operatorServices.mockImplementation(async () => ({
          ...(await original.operatorServices()),
          build: 'aaaaaaa',
          storage: { build: 'bbbbbbb', ms: 7 },
        }));
      },
    });

    expect((await screen.findByRole('status')).textContent).toBe(words.services.twoBuilds);
    expect(screen.queryByText(words.services.differs)).toBeNull();
  });

  it('C: A build is shown by the first seven characters of its commit, and two commits that share them are still two builds', async () => {
    const same = 'a1b2c3d';
    const bff = `${same}${'0'.repeat(33)}`;
    const storage = `${same}${'f'.repeat(33)}`;
    open({
      override: (api, original) => {
        api.operatorServices.mockImplementation(async () => ({
          ...(await original.operatorServices()),
          build: bff,
          storage: { build: storage, ms: 7 },
        }));
      },
    });

    expect((await screen.findByRole('status')).textContent).toBe(words.services.twoBuilds);
    for (const name of [words.services.bff, words.services.storage]) {
      const service = await card(name);
      expect(service.getByText(same), name).toBeTruthy();
    }
    expect(screen.queryByText(bff)).toBeNull();
    expect(screen.queryByText(storage)).toBeNull();
  });

  it('C: It says all of it in Vietnamese', async () => {
    open({ language: 'vi', drift: true });
    const vi = DICTIONARIES.vi;

    expect((await screen.findByRole('status')).textContent).toBe(vi.services.twoBuilds);
    expect((await card(vi.services.storage)).getByText(vi.services.differs)).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Trạng thái dịch vụ');
  });

  it('C: It shows how long the BFF and c-storage took and when it last checked, the clock to the second', async () => {
    open();

    expect(
      (await card(words.services.bff)).getByText(`Took ${DEMO_SERVICES.bffMs} ms`),
    ).toBeTruthy();
    expect(
      (await card(words.services.storage)).getByText(`Took ${DEMO_SERVICES.storageMs} ms`),
    ).toBeTruthy();
    expect((await card(words.services.app)).queryByText(/^Took /)).toBeNull();
    expect(
      await screen.findByText(`Last checked at ${timeOf(DEMO_SERVICES.checkedAt, 'en')}`),
    ).toBeTruthy();
  });

  it('C: It checks each minute while it is open and in view', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const { api, unmount } = open();
    await screen.findByRole('status');
    expect(api.operatorServices).toHaveBeenCalledTimes(1);

    await pass(59_000);
    expect(api.operatorServices).toHaveBeenCalledTimes(1);
    await pass(1_000);
    expect(api.operatorServices).toHaveBeenCalledTimes(2);
    await pass(60_000);
    expect(api.operatorServices).toHaveBeenCalledTimes(3);

    unmount();
    await pass(120_000);
    expect(api.operatorServices).toHaveBeenCalledTimes(3);
  });

  it('C: The page reads nothing while hidden, and checks at once when shown again', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const { api } = open();
    await screen.findByRole('status');

    inView(false);
    await pass(300_000);
    expect(api.operatorServices).toHaveBeenCalledTimes(1);

    inView(true);
    await settle();
    expect(api.operatorServices).toHaveBeenCalledTimes(2);
    await pass(60_000);
    expect(api.operatorServices).toHaveBeenCalledTimes(3);
  });

  it('C: A page opened while hidden reads nothing until it is shown', async () => {
    inView(false);
    const { api } = open();
    await settle();

    expect(api.operatorServices).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Loading')).toBeTruthy();
    inView(true);
    expect((await screen.findByRole('status')).textContent).toBe(words.services.oneBuild);
    expect(api.operatorServices).toHaveBeenCalledOnce();
  });

  it('C: “Check now” checks at once; a check still out is not asked again by the minute’s turn, and the button waits', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    let finish = () => {};
    const { api } = open({
      override: (spied, original) => {
        let first = true;
        spied.operatorServices.mockImplementation(async () => {
          const answer = await original.operatorServices();
          if (first) {
            first = false;
            await new Promise<void>((resolve) => (finish = resolve));
          }
          return answer;
        });
      },
    });
    await settle();
    expect(api.operatorServices).toHaveBeenCalledTimes(1);
    await pass(60_000);
    expect(api.operatorServices).toHaveBeenCalledTimes(1);

    await act(async () => {
      finish();
      await Promise.resolve();
    });
    await screen.findByRole('status');
    vi.useRealTimers();
    await userEvent.click(screen.getByRole('button', { name: 'Check now' }));
    expect(api.operatorServices).toHaveBeenCalledTimes(2);
  });

  it('C: When c-storage does not answer, the BFF answers but cannot reach its storage, so no one can sign in or save', async () => {
    open({ cue: 'operatorServices:503' });

    expect((await screen.findByRole('alert')).textContent).toBe(words.services.storageDown);
    expect((await card(words.services.app)).getByText(words.services.answers)).toBeTruthy();
    expect((await card(words.services.bff)).getByText(words.services.answers)).toBeTruthy();
    expect((await card(words.services.storage)).getByText(words.services.silent)).toBeTruthy();
    expect(screen.queryByText(/^Last checked/)).toBeNull();
  });

  it('C: When the BFF does not answer, the page says so and that c-storage cannot be seen from here', async () => {
    open({ cue: 'operatorServices:silent' });

    expect((await screen.findByRole('alert')).textContent).toBe(words.services.bffDown);
    expect((await card(words.services.app)).getByText(words.services.answers)).toBeTruthy();
    expect((await card(words.services.bff)).getByText(words.services.silent)).toBeTruthy();
    expect((await card(words.services.storage)).getByText(words.services.unseen)).toBeTruthy();
  });

  it('C: A 503 that is not in the BFF’s own error shape is the edge’s: the BFF did not answer', async () => {
    open({
      override: (api) => api.operatorServices.mockRejectedValue(new ApiError(503)),
    });

    expect((await screen.findByRole('alert')).textContent).toBe(words.services.bffDown);
    expect((await card(words.services.storage)).getByText(words.services.unseen)).toBeTruthy();
  });

  it('C: A failure that is not an answer of the Api at all is the BFF not answering', async () => {
    open({ override: (api) => api.operatorServices.mockRejectedValue(new Error('offline')) });

    expect((await screen.findByRole('alert')).textContent).toBe(words.services.bffDown);
  });

  it('C: A failure is told again as it ends: the next check that answers clears it', async () => {
    open({ cue: 'operatorServices:503' });
    await screen.findByRole('alert');

    await userEvent.click(screen.getByRole('button', { name: 'Check now' }));

    expect((await screen.findByRole('status')).textContent).toBe(words.services.oneBuild);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('C: A sign-in that ended opens the prompt over the page, which keeps what it found and says no service is down', async () => {
    const { api } = open();
    await screen.findByRole('status');
    api.operatorServices.mockRejectedValueOnce(new ApiError(401));

    await userEvent.click(screen.getByRole('button', { name: 'Check now' }));

    expect(await screen.findByRole('dialog', { name: words.passkey.endedTitle })).toBeTruthy();
    expect(screen.getByText(words.services.oneBuild)).toBeTruthy();
    expect(screen.queryByText(words.services.bffDown)).toBeNull();
  });
});

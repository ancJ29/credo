import { addDays } from '@credo/shared';
import { DEMO_DELIVERIES, DEMO_DELIVERY_PHOTOS, DEMO_ORDERS, DEMO_TODAY } from '@credo/shared/demo';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { openApp } from '../../../tests/open';
import { ApiError } from '../../api';

import { DICTIONARIES } from '../../i18n';

const words = DICTIONARIES.en;
/** A word at the start of a label, the star of a required field allowed after it. */
const starting = (word: string) => new RegExp(`^${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
const wordsVi = DICTIONARIES.vi;
const LAN = 'EMP-0001';
const money = (amount: number) =>
  words.orders.money.replace('{{amount}}', new Intl.NumberFormat('en').format(amount));

const today = DEMO_DELIVERIES.filter((one) => one.day === DEMO_TODAY);
const waiting = today.find((one) => one.state === 'waiting' && one.driver.code === 'EMP-0006')!;
const cancelled = today.find((one) => one.state === 'cancelled')!;
const at = (request: { day: string; id: string }) => `/deliveries/${request.day}/${request.id}`;

/** The text of each row of a table, cell by cell. */
const rowsOf = (table: HTMLElement) =>
  within(table)
    .getAllByRole('row')
    .map((row) => [...row.querySelectorAll('th, td')].map((cell) => cell.textContent));

const heading = (name: string | RegExp, level = 2) => screen.findByRole('heading', { level, name });

describe('the delivery requests', () => {
  it('Delivery requests shows a day’s, today unless another is picked, one group per driver, each with its number, customer, address, order number, total and state; the office opens one to read it', async () => {
    const drawn = openApp('/deliveries', { as: LAN });

    expect(await heading(words.nav.deliveries)).toBeTruthy();
    // one group for each driver, in code order, with how many it holds
    const groups = await screen.findAllByRole('heading', { level: 3 });
    expect(groups.map((one) => one.textContent)).toEqual([
      `Võ Thanh Tùng ${words.orders.requestCount.replace('{{n}}', '3')}`,
      `Đặng Hoài Nam ${words.orders.requestCount.replace('{{n}}', '2')}`,
    ]);
    expect(drawn.api.listDeliveries).toHaveBeenCalledExactlyOnceWith(DEMO_TODAY);
    const mine = today.filter((one) => one.driver.code === 'EMP-0005');
    const table = screen.getByRole('table', { name: 'Võ Thanh Tùng' });
    expect(rowsOf(table)).toEqual([
      [
        words.orders.requestNumber,
        words.orders.customer,
        words.orders.addressHeading,
        words.orders.orderNumber,
        words.orders.total,
        words.orders.stateHeading,
      ],
      ...mine.map((one) => [
        one.number,
        one.customer.name,
        one.customer.extra['address'],
        one.order.number,
        money(one.total),
        {
          waiting: words.orders.state.waiting,
          delivered: words.orders.state.delivered,
          cancelled: words.orders.state.cancelled,
        }[one.state],
      ]),
    ]);

    // another day is picked in the day field
    const dayField = screen.getByLabelText<HTMLInputElement>(words.orders.sendDay);
    expect(dayField.value).toBe(DEMO_TODAY);
    fireEvent.change(dayField, { target: { value: addDays(DEMO_TODAY, -1) } });
    await waitFor(() =>
      expect(drawn.api.listDeliveries).toHaveBeenCalledWith(addDays(DEMO_TODAY, -1)),
    );
    expect(await screen.findByRole('table', { name: 'Đặng Hoài Nam' })).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>(words.orders.sendDay).value).toBe(
      addDays(DEMO_TODAY, -1),
    );

    // a day that is no date is not asked for
    fireEvent.change(screen.getByLabelText(words.orders.sendDay), { target: { value: '' } });
    expect(drawn.api.listDeliveries).toHaveBeenCalledTimes(2);

    // one is opened from its number
    const open = (await screen.findAllByRole('link', { name: /^GH-/ }))[0];
    expect(open.getAttribute('href')).toMatch(/^\/deliveries\/2026-11-03\//);
  });

  it('says there are none on a day with none, takes the day from the address, and falls back to today for a day that is no date', async () => {
    const drawn = openApp(`/deliveries?day=${addDays(DEMO_TODAY, 5)}`, { as: LAN });

    expect(await screen.findByText(words.orders.noRequests)).toBeTruthy();
    expect(drawn.api.listDeliveries).toHaveBeenCalledWith(addDays(DEMO_TODAY, 5));
    drawn.unmount();

    const bad = openApp('/deliveries?day=2026-02-30', { as: LAN, language: 'vi' });
    expect(await screen.findByRole('table', { name: 'Võ Thanh Tùng' })).toBeTruthy();
    expect(bad.api.listDeliveries).toHaveBeenCalledWith(DEMO_TODAY);
    expect(screen.getByText(wordsVi.orders.requestCount.replace('{{n}}', '3'))).toBeTruthy();
  });

  it('says it could not load and tries again', async () => {
    openApp('/deliveries', {
      as: LAN,
      override: (spied, original) => {
        spied.listDeliveries.mockRejectedValueOnce(new ApiError(503));
        spied.listDeliveries.mockImplementation((day) => original.listDeliveries(day));
      },
    });

    expect((await screen.findByRole('alert')).textContent).toContain(words.common.loadFailed);
    await userEvent.click(screen.getByRole('button', { name: words.common.retry }));
    expect(await screen.findByRole('table', { name: 'Võ Thanh Tùng' })).toBeTruthy();
  });

  it('shows a customer with no address as an empty cell', async () => {
    openApp('/deliveries', {
      as: LAN,
      override: (spied) =>
        spied.listDeliveries.mockResolvedValue([
          { ...waiting, customer: { ...waiting.customer, extra: {} } },
        ]),
    });

    const table = await screen.findByRole('table', { name: waiting.driver.name });
    expect(rowsOf(table)[1]?.[2]).toBe('');
  });
});

describe('a delivery request opened', () => {
  it('A delivery request carries the order’s number, its customer with their phone and address as at the order, its lines and quantities, and the total to collect; an order has one at a time', async () => {
    openApp(at(waiting), { as: LAN });

    expect(
      await heading(words.orders.requestTitle.replace('{{number}}', waiting.number)),
    ).toBeTruthy();
    expect(screen.getByText(words.orders.state.waiting)).toBeTruthy();
    expect(screen.getByRole('link', { name: waiting.order.number }).getAttribute('href')).toBe(
      `/orders/${waiting.order.day}/${waiting.order.id}`,
    );
    expect(screen.getByText(waiting.customer.name)).toBeTruthy();
    expect(
      screen.getByText(
        words.orders.phone.replace('{{phone}}', waiting.customer.extra['phone'] as string),
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        words.orders.address.replace('{{address}}', waiting.customer.extra['address'] as string),
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(words.orders.byDriver.replace('{{name}}', waiting.driver.name)),
    ).toBeTruthy();
    const lines = rowsOf(screen.getByRole('table'));
    expect(lines.slice(1, -1).map((row) => [row[0], row[3]])).toEqual(
      waiting.lines.map((line) => [
        `${line.code} · ${line.name}`,
        new Intl.NumberFormat('en').format(line.quantity),
      ]),
    );
    expect(lines.at(-1)).toEqual([words.orders.total, money(waiting.total)]);
    expect(
      screen.getByText(words.orders.collect.replace('{{total}}', money(waiting.total))),
    ).toBeTruthy();
  });

  it('reads a request with no phone and no address, and one that is cancelled offers no cancel', async () => {
    openApp(at(cancelled), {
      as: LAN,
      override: (spied) =>
        spied.getDelivery.mockResolvedValue({
          request: { ...cancelled, customer: { ...cancelled.customer, extra: {} } },
          version: 'g2',
        }),
    });

    expect(
      await heading(words.orders.requestTitle.replace('{{number}}', cancelled.number)),
    ).toBeTruthy();
    expect(screen.getByText(words.orders.state.cancelled)).toBeTruthy();
    expect(screen.queryByText(starting(words.orders.phone.replace('{{phone}}', '')))).toBeNull();
    expect(
      screen.queryByText(starting(words.orders.address.replace('{{address}}', ''))),
    ).toBeNull();
    expect(
      screen.queryByRole('heading', { level: 3, name: words.orders.cancelRequest }),
    ).toBeNull();
  });

  it('offers no cancel to someone who may only see, and says it could not be loaded when it is not there', async () => {
    openApp(at(waiting), {
      language: 'vi',
      override: (spied) =>
        spied.me.mockResolvedValue({
          user: { name: 'Xem', root: false, permissions: { 'orders.canView': true } },
        }),
    });
    expect(
      await heading(wordsVi.orders.requestTitle.replace('{{number}}', waiting.number)),
    ).toBeTruthy();
    expect(
      screen.queryByRole('heading', { level: 3, name: wordsVi.orders.cancelRequest }),
    ).toBeNull();
    document.body.innerHTML = '';

    openApp(`/deliveries/${DEMO_TODAY}/00000000-0000-4000-8000-000000000999`, { as: LAN });
    expect((await screen.findByRole('alert')).textContent).toContain(words.common.loadFailed);
  });
});

describe('a delivered request', () => {
  const delivered = today.find((one) => one.state === 'delivered')!;

  it('The office sees a delivered request in Orders, Delivery requests, the request with its photo and its order Fulfilled, when it next opens or reloads one', async () => {
    openApp(at(delivered), { as: LAN });

    expect(
      await heading(words.orders.requestTitle.replace('{{number}}', delivered.number)),
    ).toBeTruthy();
    expect(screen.getByText(words.orders.state.delivered)).toBeTruthy();
    expect(screen.getByRole('heading', { level: 3, name: words.orders.proofTitle })).toBeTruthy();
    const proof = await screen.findByRole('img', {
      name: words.orders.proofAlt,
    });
    expect(proof.getAttribute('src')).toBe(DEMO_DELIVERY_PHOTOS[delivered.id]);
    // no cancel is offered after it
    expect(
      screen.queryByRole('heading', { level: 3, name: words.orders.cancelRequest }),
    ).toBeNull();
    document.body.innerHTML = '';

    // its order reads Fulfilled, with the request it names
    const order = DEMO_ORDERS.find((one) => one.id === delivered.order.id)!;
    openApp(`/orders/${order.day}/${order.id}`, { as: LAN });
    expect(await heading(words.orders.orderTitle.replace('{{number}}', order.number))).toBeTruthy();
    expect(screen.getByText(words.orders.state.fulfilled)).toBeTruthy();
    expect(screen.getByRole('link', { name: delivered.number })).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 3, name: words.orders.cancelOrder })).toBeNull();
  });

  it('A delivered request whose picture never arrived shows the office “The photo did not arrive.”, never a broken picture', async () => {
    const lost = DEMO_DELIVERIES.filter(
      (one) => one.state === 'delivered' && one.day < DEMO_TODAY && one.driver.code !== 'EMP-0005',
    ).at(-1)!;
    openApp(`/deliveries/${lost.day}/${lost.id}`, { as: LAN });

    // the address is given, and the picture is not there: the browser's own error on it
    const picture = await screen.findByRole('img', {
      name: words.orders.proofAlt,
    });
    expect(picture.getAttribute('src')).toBe(`https://photos.invalid/never-arrived/${lost.id}`);
    fireEvent.error(picture);

    expect((await screen.findByRole('alert')).textContent).toBe(words.orders.proofMissing);
    expect(screen.queryByRole('img', { name: words.orders.proofAlt })).toBeNull();
  });

  it('The walk’s fifteenth screen: the second driver’s request delivered with no picture sent, opened from the list as the office does, says “The photo did not arrive.”', async () => {
    openApp('/deliveries', { as: LAN, photoLost: true });

    await userEvent.click(await screen.findByRole('link', { name: waiting.number }));
    expect(
      await heading(words.orders.requestTitle.replace('{{number}}', waiting.number)),
    ).toBeTruthy();
    expect(screen.getByText(words.orders.state.delivered)).toBeTruthy();
    const picture = await screen.findByRole('img', {
      name: words.orders.proofAlt,
    });
    expect(picture.getAttribute('src')).toBe(`https://photos.invalid/never-arrived/${waiting.id}`);
    fireEvent.error(picture);

    expect((await screen.findByRole('alert')).textContent).toBe(words.orders.proofMissing);
  });

  it('says the photo could not be loaded, and tries again', async () => {
    openApp(at(delivered), {
      as: LAN,
      override: (spied, original) => {
        spied.getDeliveryPhoto.mockRejectedValueOnce(new ApiError(503));
        spied.getDeliveryPhoto.mockImplementation((day, id) => original.getDeliveryPhoto(day, id));
      },
    });

    await heading(words.orders.proofTitle, 3);
    expect((await screen.findByRole('alert')).textContent).toContain(words.common.loadFailed);
    await userEvent.click(screen.getByRole('button', { name: words.common.retry }));
    expect(await screen.findByRole('img', { name: words.orders.proofAlt })).toBeTruthy();
  });
});

describe('cancelling a request', () => {
  const cancelButton = () => screen.findByRole('button', { name: words.orders.cancelRequest });

  it('The office cancels a waiting request after a check; the order stays confirmed and offers to send it again, to a driver and a day, as a new request with a new number', async () => {
    const drawn = openApp(at(waiting), { as: LAN });
    await heading(words.orders.requestTitle.replace('{{number}}', waiting.number));

    // the first press only asks
    await userEvent.click(await cancelButton());
    expect(drawn.api.cancelDelivery).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: words.orders.keep }));
    await userEvent.click(await cancelButton());
    await userEvent.click(
      screen.getByRole('button', {
        name: words.orders.cancelRequestConfirm.replace('{{number}}', waiting.number),
      }),
    );

    expect(drawn.api.cancelDelivery).toHaveBeenCalledExactlyOnceWith(waiting.day, waiting.id, {
      version: 'g1',
    });
    expect((await screen.findByRole('status')).textContent).toContain(
      words.orders.requestCancelled,
    );
    expect(screen.getByText(words.orders.state.cancelled)).toBeTruthy();
    expect(
      screen.queryByRole('heading', { level: 3, name: words.orders.cancelRequest }),
    ).toBeNull();

    // the order stays confirmed, and offers to be sent again
    await userEvent.click(screen.getByRole('link', { name: words.orders.openOrder }));
    expect(
      await heading(words.orders.orderTitle.replace('{{number}}', waiting.order.number)),
    ).toBeTruthy();
    expect(screen.getByText(words.orders.state.confirmed)).toBeTruthy();
    expect(
      await screen.findByRole('heading', { level: 3, name: words.orders.sendAgain }),
    ).toBeTruthy();
    expect(screen.getByText(words.orders.notSent)).toBeTruthy();
    await userEvent.selectOptions(
      await screen.findByLabelText(words.orders.driver),
      'EMP-0005 · Võ Thanh Tùng',
    );
    await userEvent.click(screen.getByRole('button', { name: words.orders.sendAgainSubmit }));
    const number = `GH-${String(DEMO_DELIVERIES.length + 1).padStart(5, '0')}`;
    expect((await screen.findByRole('status')).textContent).toBe(
      words.orders.done.sent.replace('{{number}}', number),
    );
    expect(number).not.toBe(waiting.number);
  });

  it('A cancel over someone else’s newer one is refused and theirs is offered; one that fails says so', async () => {
    openApp(at(waiting), { as: LAN, cue: 'cancelDelivery:409' });
    await heading(words.orders.requestTitle.replace('{{number}}', waiting.number));
    await userEvent.click(await cancelButton());
    await userEvent.click(
      screen.getByRole('button', {
        name: words.orders.cancelRequestConfirm.replace('{{number}}', waiting.number),
      }),
    );

    expect((await screen.findByRole('alert')).textContent).toContain(words.orders.conflict);
    await userEvent.click(screen.getByRole('button', { name: words.orders.showTheirs }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(screen.getByText(words.orders.state.waiting)).toBeTruthy();
    document.body.innerHTML = '';

    openApp(at(waiting), { as: LAN, cue: 'cancelDelivery:503' });
    await heading(words.orders.requestTitle.replace('{{number}}', waiting.number));
    await userEvent.click(await cancelButton());
    await userEvent.click(
      screen.getByRole('button', {
        name: words.orders.cancelRequestConfirm.replace('{{number}}', waiting.number),
      }),
    );
    expect((await screen.findByRole('alert')).textContent).toContain(words.orders.cancelFailed);
    expect(screen.getByText(words.orders.state.waiting)).toBeTruthy();
  });

  it('reads the request again when the refusal carried no newer one', async () => {
    const drawn = openApp(at(waiting), {
      as: LAN,
      override: (spied) =>
        spied.cancelDelivery.mockResolvedValue({ kind: 'conflict', current: null }),
    });
    await heading(words.orders.requestTitle.replace('{{number}}', waiting.number));
    await userEvent.click(await cancelButton());
    await userEvent.click(
      screen.getByRole('button', {
        name: words.orders.cancelRequestConfirm.replace('{{number}}', waiting.number),
      }),
    );

    await userEvent.click(await screen.findByRole('button', { name: words.orders.showTheirs }));

    await waitFor(() => expect(drawn.api.getDelivery).toHaveBeenCalledTimes(2));
  });
});

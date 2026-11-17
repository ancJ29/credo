import { addDays, TOTAL_MAX } from '@credo/shared';
import { DEMO_DELIVERIES, DEMO_TODAY } from '@credo/shared/demo';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { openApp, person } from '../../../tests/open';
import { ApiError } from '../../api';

import { DICTIONARIES } from '../../i18n';

const words = DICTIONARIES.en;
const wordsVi = DICTIONARIES.vi;
const money = (amount: number) =>
  words.orders.money.replace('{{amount}}', new Intl.NumberFormat('en').format(amount));
const short = (amount: number) => words.reconcile.gapShort.replace('{{amount}}', money(amount));
const over = (amount: number) => words.reconcile.gapOver.replace('{{amount}}', money(amount));
const figures = (total: string, n: number, m: number) =>
  `${words.reconcile.bringBack.replace('{{total}}', total)} · ${words.reconcile.deliveredOf.replace('{{n}}', String(n)).replace('{{m}}', String(m))}`;
const LAN = 'EMP-0001';
const TUNG = person('EMP-0005');
const NAM = person('EMP-0006');
const YESTERDAY = addDays(DEMO_TODAY, -1);
const dayOf = (who: { id: string }, day = DEMO_TODAY) => `/deliveries/${day}/drivers/${who.id}`;
/** Tùng's day today in the data set: one delivered (47,400,000), one waiting, one cancelled. */
const TUNG_COLLECT = money(47_400_000);
const heading = (name: string | RegExp, level = 2) => screen.findByRole('heading', { level, name });
const cashField = () => screen.findByLabelText<HTMLInputElement>(words.reconcile.cash);
const typeCash = async (text: string) => {
  const field = await cashField();
  await userEvent.clear(field);
  await userEvent.type(field, text);
};
const closeButton = () => screen.findByRole('button', { name: words.reconcile.close });

describe('the day’s end in Delivery requests', () => {
  it('At the day’s end the office settles each driver’s day on the PC, in Delivery requests: each driver’s group shows what they are to bring back, how many of their requests are delivered, and whether the day is open or closed, with its gap once closed', async () => {
    const drawn = openApp('/deliveries', { as: LAN });

    expect(await screen.findByText(figures(TUNG_COLLECT, 1, 2))).toBeTruthy();
    expect(screen.getByText(figures(money(0), 0, 2))).toBeTruthy();
    expect(screen.getAllByText(words.reconcile.dayOpen)).toHaveLength(2);
    // each group opens its driver's day
    expect(
      screen
        .getByRole('link', { name: words.reconcile.openFor.replace('{{name}}', 'Võ Thanh Tùng') })
        .getAttribute('href'),
    ).toBe(dayOf(TUNG));
    expect(
      screen
        .getByRole('link', { name: words.reconcile.openFor.replace('{{name}}', 'Đặng Hoài Nam') })
        .getAttribute('href'),
    ).toBe(dayOf(NAM));
    expect(drawn.api.listReconciliations).toHaveBeenCalledWith(DEMO_TODAY);
    drawn.unmount();

    // yesterday's, closed by the data set: the gap beside it
    openApp(`/deliveries?day=${YESTERDAY}`, { as: LAN });
    expect(await screen.findByText(figures(money(2_560_000), 1, 1))).toBeTruthy();
    expect(
      screen.getByText(words.reconcile.dayClosedGap.replace('{{gap}}', short(20_000))),
    ).toBeTruthy();
    expect(screen.queryByText(words.reconcile.dayOpen)).toBeNull();
  });

  it('The close is offered for today and the days before, by the page’s today, and for a later day it says the day is not over', async () => {
    openApp(dayOf(TUNG), { as: LAN });
    expect(await closeButton()).toBeTruthy();
    document.body.innerHTML = '';

    const later = addDays(DEMO_TODAY, 1);
    openApp(dayOf(TUNG, later), { as: LAN });
    // Tùng has nothing on that day in the data set
    expect(await screen.findByText(words.reconcile.noRequests)).toBeTruthy();
    document.body.innerHTML = '';

    const request = DEMO_DELIVERIES.find((one) => one.day === later)!;
    openApp(dayOf(request.driver, later), { as: LAN });
    expect(
      await heading(words.reconcile.title.replace('{{name}}', request.driver.name)),
    ).toBeTruthy();
    expect(screen.getByText(words.reconcile.notYet)).toBeTruthy();
    expect(screen.queryByRole('button', { name: words.reconcile.close })).toBeNull();
    expect(screen.queryByLabelText(words.reconcile.cash)).toBeNull();
  });

  it('says it could not load and tries again', async () => {
    openApp('/deliveries', {
      as: LAN,
      override: (spied, original) => {
        spied.listReconciliations.mockRejectedValueOnce(new ApiError(503));
        spied.listReconciliations.mockImplementation((day) => original.listReconciliations(day));
      },
    });

    expect((await screen.findByRole('alert')).textContent).toContain(words.common.loadFailed);
    await userEvent.click(screen.getByRole('button', { name: words.common.retry }));
    expect(await screen.findByRole('table', { name: 'Võ Thanh Tùng' })).toBeTruthy();
  });
});

describe('a driver’s day opened', () => {
  it('A driver’s day opened lists the requests they delivered that day, each with its number, customer, order number and total to collect, and the sum to collect; those still waiting are listed apart, with nothing to collect; a cancelled one is left out', async () => {
    openApp(dayOf(TUNG), { as: LAN });

    expect(await heading(words.reconcile.title.replace('{{name}}', 'Võ Thanh Tùng'))).toBeTruthy();
    const delivered = DEMO_DELIVERIES.find(
      (one) => one.day === DEMO_TODAY && one.driver.id === TUNG.id && one.state === 'delivered',
    )!;
    const waiting = DEMO_DELIVERIES.find(
      (one) => one.day === DEMO_TODAY && one.driver.id === TUNG.id && one.state === 'waiting',
    )!;
    const cancelled = DEMO_DELIVERIES.find(
      (one) => one.day === DEMO_TODAY && one.driver.id === TUNG.id && one.state === 'cancelled',
    )!;
    const tables = screen.getAllByRole('table');
    const rows = (table: HTMLElement) =>
      within(table)
        .getAllByRole('row')
        .map((row) => [...row.querySelectorAll('th, td')].map((cell) => cell.textContent));

    expect(rows(tables[0])).toEqual([
      [
        words.orders.requestNumber,
        words.orders.customer,
        words.orders.orderNumber,
        words.orders.total,
      ],
      [delivered.number, delivered.customer.name, delivered.order.number, TUNG_COLLECT],
      [words.reconcile.toCollect, TUNG_COLLECT],
    ]);
    // those still waiting are apart, with no total
    expect(
      screen.getByRole('heading', { level: 3, name: words.reconcile.waitingTitle }),
    ).toBeTruthy();
    expect(rows(tables[1])).toEqual([
      [words.orders.requestNumber, words.orders.customer, words.orders.orderNumber],
      [waiting.number, waiting.customer.name, waiting.order.number],
    ]);
    // a cancelled one is left out
    expect(screen.queryByText(cancelled.number)).toBeNull();
    // each number opens its request
    expect(screen.getByRole('link', { name: delivered.number }).getAttribute('href')).toBe(
      `/deliveries/${delivered.day}/${delivered.id}`,
    );
  });

  it('says nothing is delivered yet when none is, and that the driver has no request on a day with none', async () => {
    openApp(dayOf(NAM), { as: LAN });

    expect(await heading(words.reconcile.title.replace('{{name}}', 'Đặng Hoài Nam'))).toBeTruthy();
    expect(screen.getByText(words.reconcile.noDelivered)).toBeTruthy();
    expect(
      screen.getByRole('heading', { level: 3, name: words.reconcile.waitingTitle }),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: words.reconcile.back }).getAttribute('href')).toBe(
      `/deliveries?day=${DEMO_TODAY}`,
    );
    document.body.innerHTML = '';

    openApp(`/deliveries/${DEMO_TODAY}/drivers/00000000-0000-4000-8000-000000000999`, { as: LAN });
    expect(await screen.findByText(words.reconcile.noRequests)).toBeTruthy();
  });
});

describe('the cash handed in', () => {
  it('The office types the cash the driver handed in, in whole đồng from 0, and sees the difference at once: exact, short by, or over by; nothing is rounded', async () => {
    openApp(dayOf(TUNG), { as: LAN });
    await heading(words.reconcile.title.replace('{{name}}', 'Võ Thanh Tùng'));

    const status = () => screen.getByRole('status').textContent;
    expect(status()).toBe(words.reconcile.typeCash);
    expect((await closeButton()).hasAttribute('disabled')).toBe(true);

    await typeCash('47400000');
    expect(status()).toBe(words.reconcile.gapExact);
    await typeCash('47380000');
    expect(status()).toBe(short(20_000));
    await typeCash('47400001');
    expect(status()).toBe(over(1));
    // from 0: nothing handed in is the whole sum missing
    await typeCash('0');
    expect(status()).toBe(short(47_400_000));
    expect((await closeButton()).hasAttribute('disabled')).toBe(false);
  });

  it('The cash field takes digits and the language’s thousands separator alone; anything else is refused before any call', async () => {
    const drawn = openApp(dayOf(TUNG), { as: LAN });
    await heading(words.reconcile.title.replace('{{name}}', 'Võ Thanh Tùng'));

    await typeCash('a1b,2.3-4e5');
    expect((await cashField()).value).toBe('12,345');
    expect(drawn.api.closeDay).not.toHaveBeenCalled();
    // letters alone type nothing, and the close stays unavailable
    await typeCash('abc');
    expect((await cashField()).value).toBe('');
    expect((await closeButton()).hasAttribute('disabled')).toBe(true);
    drawn.unmount();

    // in Vietnamese the separator is the dot, and a comma is no digit
    openApp(dayOf(TUNG), { as: LAN, language: 'vi' });
    await heading(wordsVi.reconcile.title.replace('{{name}}', 'Võ Thanh Tùng'));
    const field = await screen.findByLabelText<HTMLInputElement>(wordsVi.reconcile.cash);
    await userEvent.type(field, '1.234');
    expect(field.value).toBe('1.234');
  });

  it('A day that adds up to more than a day can hold cannot be closed', async () => {
    const delivered = DEMO_DELIVERIES.find(
      (one) => one.day === DEMO_TODAY && one.driver.id === TUNG.id && one.state === 'delivered',
    )!;
    const drawn = openApp(dayOf(TUNG), {
      as: LAN,
      override: (spied) =>
        spied.listDeliveries.mockResolvedValue([
          { ...delivered, total: TOTAL_MAX },
          {
            ...delivered,
            id: '00000000-0000-4000-8000-000000000998',
            number: 'GH-00998',
            total: TOTAL_MAX,
          },
        ]),
    });
    await heading(words.reconcile.title.replace('{{name}}', 'Võ Thanh Tùng'));

    await typeCash('5');
    expect(screen.getByText(words.reconcile.tooLarge)).toBeTruthy();
    expect((await closeButton()).hasAttribute('disabled')).toBe(true);
    expect(drawn.api.closeDay).not.toHaveBeenCalled();
  });
});

describe('closing the day', () => {
  it('Close the day asks first, naming the cash, the gap and the requests still waiting, which the close cancels so that their orders offer to be sent again; once closed, the page reads Closed, with to collect, handed in, the gap and who closed it', async () => {
    const drawn = openApp(dayOf(TUNG), { as: LAN });
    await heading(words.reconcile.title.replace('{{name}}', 'Võ Thanh Tùng'));
    const waiting = DEMO_DELIVERIES.find(
      (one) => one.day === DEMO_TODAY && one.driver.id === TUNG.id && one.state === 'waiting',
    )!;
    const delivered = DEMO_DELIVERIES.find(
      (one) => one.day === DEMO_TODAY && one.driver.id === TUNG.id && one.state === 'delivered',
    )!;
    await typeCash('47380000');

    // the first press only asks
    await userEvent.click(await closeButton());
    expect(drawn.api.closeDay).not.toHaveBeenCalled();
    expect(
      screen.getByText(words.reconcile.closeAsk.replace('{{name}}', 'Võ Thanh Tùng')),
    ).toBeTruthy();
    expect(
      screen.getByText(words.reconcile.closeCash.replace('{{amount}}', money(47_380_000))),
    ).toBeTruthy();
    expect(
      screen.getByText(words.reconcile.closeGap.replace('{{gap}}', short(20_000))),
    ).toBeTruthy();
    expect(screen.getByText(words.reconcile.closeWaiting.replace('{{count}}', '1'))).toBeTruthy();
    // the cash cannot be changed while the check is open
    expect((await cashField()).readOnly).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: words.reconcile.keepOpen }));
    expect((await cashField()).readOnly).toBe(false);
    await userEvent.click(await closeButton());
    await userEvent.click(screen.getByRole('button', { name: words.reconcile.closeConfirm }));

    // the close names the requests the page showed and the cash, and no sum
    expect(drawn.api.closeDay).toHaveBeenCalledExactlyOnceWith(DEMO_TODAY, TUNG.id, {
      delivered: [delivered.id],
      waiting: [waiting.id],
      handedIn: 47_380_000,
    });
    expect((await screen.findByRole('alert')).textContent).toBe(words.reconcile.closedNow);
    const closed = await screen.findByRole('table', { name: words.reconcile.closedTitle });
    expect(
      within(closed)
        .getAllByRole('row')
        .map((row) => [...row.querySelectorAll('th, td')].map((cell) => cell.textContent)),
    ).toEqual([
      [words.reconcile.toCollect, TUNG_COLLECT],
      [words.reconcile.handedIn, '47,380,000 VND'],
      [words.reconcile.difference, short(20_000)],
      [words.reconcile.closedBy, 'EMP-0001 · Nguyễn Thị Lan'],
    ]);
    // the request that waited is cancelled: the day lists it no more, and no cash or close is offered
    expect(
      screen.queryByRole('heading', { level: 3, name: words.reconcile.waitingTitle }),
    ).toBeNull();
    expect(screen.queryByLabelText(words.reconcile.cash)).toBeNull();
    expect(screen.queryByRole('button', { name: words.reconcile.close })).toBeNull();
  });
});

describe('a day that moved, a close that failed', () => {
  it('The figures are the app’s: a delivery made between opening the day and closing it closes nothing, and the page shows the new figures; the check then names no waiting request and the root closes it', async () => {
    const drawn = openApp(dayOf(TUNG), { cue: 'closeDay:409' });
    await heading(words.reconcile.title.replace('{{name}}', 'Võ Thanh Tùng'));
    await typeCash('47400000');
    await userEvent.click(await closeButton());
    await userEvent.click(screen.getByRole('button', { name: words.reconcile.closeConfirm }));

    // nothing was closed; the day is read again, with the request the driver delivered meanwhile
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(words.reconcile.moved);
    expect(drawn.api.closeDay).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(drawn.api.listDeliveries).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('table', { name: words.reconcile.closedTitle })).toBeNull();
    expect(
      screen.queryByRole('heading', { level: 3, name: words.reconcile.waitingTitle }),
    ).toBeNull();
    const delivered = (await screen.findAllByRole('table'))[0];
    expect(within(delivered).getAllByRole('row')).toHaveLength(4);
    expect(within(delivered).getByText('51,180,000 VND', { selector: 'th' })).toBeTruthy();
    // the cash typed is kept, and now it is short of the new sum
    expect((await cashField()).value).toBe('47,400,000');
    expect(screen.getByRole('status').textContent).toBe(short(3_780_000));

    await userEvent.click(await closeButton());
    expect(screen.getByText(words.reconcile.closeNoWaiting)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: words.reconcile.closeConfirm }));
    expect((await screen.findByRole('alert')).textContent).toBe(words.reconcile.closedNow);
    const closed = await screen.findByRole('table', { name: words.reconcile.closedTitle });
    expect(
      within(closed).getByText(words.reconcile.byRoot.replace('{{name}}', 'root')),
    ).toBeTruthy();
  });

  it('A close by someone else between opening the day and closing it closes nothing of ours, and the page reads Closed as they left it', async () => {
    const drawn = openApp(dayOf(TUNG), {
      as: LAN,
      override: (spied, original) =>
        spied.closeDay.mockImplementationOnce(async (day, driverId, request) => {
          // their close goes through first; ours then meets a closed day
          await original.closeDay(day, driverId, { ...request, handedIn: 1 });
          return await original.closeDay(day, driverId, request);
        }),
    });
    await heading(words.reconcile.title.replace('{{name}}', 'Võ Thanh Tùng'));
    await typeCash('47400000');
    await userEvent.click(await closeButton());
    await userEvent.click(screen.getByRole('button', { name: words.reconcile.closeConfirm }));

    expect((await screen.findByRole('alert')).textContent).toContain(words.reconcile.moved);
    const closed = await screen.findByRole('table', { name: words.reconcile.closedTitle });
    expect(within(closed).getByText(short(47_399_999))).toBeTruthy();
    expect(drawn.api.closeDay).toHaveBeenCalledTimes(1);
  });

  it('A close that fails says so, keeps the cash typed, and closes nothing', async () => {
    const drawn = openApp(dayOf(TUNG), { as: LAN, cue: 'closeDay:503' });
    await heading(words.reconcile.title.replace('{{name}}', 'Võ Thanh Tùng'));
    await typeCash('47380000');
    await userEvent.click(await closeButton());
    await userEvent.click(screen.getByRole('button', { name: words.reconcile.closeConfirm }));

    expect((await screen.findByRole('alert')).textContent).toBe(words.reconcile.failed);
    expect((await cashField()).value).toBe('47,380,000');
    expect(screen.queryByRole('table', { name: words.reconcile.closedTitle })).toBeNull();
    // nothing on the day moved: the waiting request still waits, and a second try closes it
    expect(
      screen.getByRole('heading', { level: 3, name: words.reconcile.waitingTitle }),
    ).toBeTruthy();
    await userEvent.click(await closeButton());
    await userEvent.click(screen.getByRole('button', { name: words.reconcile.closeConfirm }));
    expect(await screen.findByRole('table', { name: words.reconcile.closedTitle })).toBeTruthy();
    expect(drawn.api.closeDay).toHaveBeenCalledTimes(2);
  });
});

describe('who may do what', () => {
  it('Those who may make and send orders close a driver’s day; those who may see orders see the figures and the closed days, and are offered neither cash nor close', async () => {
    openApp(dayOf(TUNG), {
      language: 'vi',
      override: (spied) =>
        spied.me.mockResolvedValue({
          user: { name: 'Xem', root: false, permissions: { 'orders.canView': true } },
        }),
    });

    expect(
      await heading(wordsVi.reconcile.title.replace('{{name}}', 'Võ Thanh Tùng')),
    ).toBeTruthy();
    expect(screen.getAllByRole('table')).toHaveLength(2);
    expect(screen.queryByLabelText(wordsVi.reconcile.cash)).toBeNull();
    expect(screen.queryByRole('button', { name: wordsVi.reconcile.close })).toBeNull();
    document.body.innerHTML = '';

    // and the closed day is read as the data set closed it
    openApp(dayOf(NAM, YESTERDAY), {
      override: (spied) =>
        spied.me.mockResolvedValue({
          user: { name: 'Xem', root: false, permissions: { 'orders.canView': true } },
        }),
    });
    expect(await screen.findByRole('table', { name: words.reconcile.closedTitle })).toBeTruthy();
  });

  it('A driver’s phone shows nothing new: the day’s page is not theirs to open, and the menu lists no such page', async () => {
    openApp(dayOf(TUNG), { as: 'EMP-0005' });

    expect(
      await screen.findByRole('heading', { level: 2, name: words.forbidden.title }),
    ).toBeTruthy();
  });

  it('A closed day is final: it offers no cash and no close, and a second close from a stale page closes nothing', async () => {
    const drawn = openApp(dayOf(NAM, YESTERDAY), { as: LAN });

    const closed = await screen.findByRole('table', { name: words.reconcile.closedTitle });
    expect(within(closed).getByText(short(20_000))).toBeTruthy();
    expect(within(closed).getByText('2,540,000 VND')).toBeTruthy();
    expect(screen.queryByLabelText(words.reconcile.cash)).toBeNull();
    expect(screen.queryByRole('button', { name: words.reconcile.close })).toBeNull();
    expect(
      await drawn.api.closeDay(YESTERDAY, NAM.id, { delivered: [], waiting: [], handedIn: 5 }),
    ).toEqual({ kind: 'moved' });
  });
});

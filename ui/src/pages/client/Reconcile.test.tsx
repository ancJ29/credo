import { addDays, TOTAL_MAX } from '@credo/shared';
import { DEMO_DELIVERIES, DEMO_TODAY } from '@credo/shared/demo';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { openApp, person } from '../../../tests/open';
import { ApiError } from '../../api';

const LAN = 'EMP-0001';
const TUNG = person('EMP-0005');
const NAM = person('EMP-0006');
const YESTERDAY = addDays(DEMO_TODAY, -1);
const dayOf = (who: { id: string }, day = DEMO_TODAY) => `/deliveries/${day}/drivers/${who.id}`;
/** Tùng's day today in the data set: one delivered (47,400,000), one waiting, one cancelled. */
const TUNG_COLLECT = '47,400,000 VND';
const heading = (name: string | RegExp, level = 2) => screen.findByRole('heading', { level, name });
const cashField = () => screen.findByLabelText<HTMLInputElement>('Cash handed in (VND)');
const typeCash = async (text: string) => {
  const field = await cashField();
  await userEvent.clear(field);
  await userEvent.type(field, text);
};
const closeButton = () => screen.findByRole('button', { name: 'Close the day' });

describe('the day’s end in Delivery requests', () => {
  it('At the day’s end the office settles each driver’s day on the PC, in Delivery requests: each driver’s group shows what they are to bring back, how many of their requests are delivered, and whether the day is open or closed, with its gap once closed', async () => {
    const drawn = openApp('/deliveries', { as: LAN });

    expect(
      await screen.findByText(`To bring back: ${TUNG_COLLECT} · Delivered 1 of 2`),
    ).toBeTruthy();
    expect(screen.getByText('To bring back: 0 VND · Delivered 0 of 2')).toBeTruthy();
    expect(screen.getAllByText('Day open')).toHaveLength(2);
    // each group opens its driver's day
    expect(screen.getByRole('link', { name: 'Reconcile Võ Thanh Tùng' }).getAttribute('href')).toBe(
      dayOf(TUNG),
    );
    expect(screen.getByRole('link', { name: 'Reconcile Đặng Hoài Nam' }).getAttribute('href')).toBe(
      dayOf(NAM),
    );
    expect(drawn.api.listReconciliations).toHaveBeenCalledWith(DEMO_TODAY);
    drawn.unmount();

    // yesterday's, closed by the data set: the gap beside it
    openApp(`/deliveries?day=${YESTERDAY}`, { as: LAN });
    expect(await screen.findByText('To bring back: 2,560,000 VND · Delivered 1 of 1')).toBeTruthy();
    expect(screen.getByText('Closed · Short by 20,000 VND')).toBeTruthy();
    expect(screen.queryByText('Day open')).toBeNull();
  });

  it('The close is offered for today and the days before, by the page’s today, and for a later day it says the day is not over', async () => {
    openApp(dayOf(TUNG), { as: LAN });
    expect(await closeButton()).toBeTruthy();
    document.body.innerHTML = '';

    const later = addDays(DEMO_TODAY, 1);
    openApp(dayOf(TUNG, later), { as: LAN });
    // Tùng has nothing on that day in the data set
    expect(
      await screen.findByText('This driver has no delivery requests on this day.'),
    ).toBeTruthy();
    document.body.innerHTML = '';

    const request = DEMO_DELIVERIES.find((one) => one.day === later)!;
    openApp(dayOf(request.driver, later), { as: LAN });
    expect(await heading(`Reconcile: ${request.driver.name}`)).toBeTruthy();
    expect(screen.getByText('This day is not over yet: it cannot be closed.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Close the day' })).toBeNull();
    expect(screen.queryByLabelText('Cash handed in (VND)')).toBeNull();
  });

  it('says it could not load and tries again', async () => {
    openApp('/deliveries', {
      as: LAN,
      override: (spied, original) => {
        spied.listReconciliations.mockRejectedValueOnce(new ApiError(503));
        spied.listReconciliations.mockImplementation((day) => original.listReconciliations(day));
      },
    });

    expect((await screen.findByRole('alert')).textContent).toContain('could not be loaded');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('table', { name: 'Võ Thanh Tùng' })).toBeTruthy();
  });
});

describe('a driver’s day opened', () => {
  it('A driver’s day opened lists the requests they delivered that day, each with its number, customer, order number and total to collect, and the sum to collect; those still waiting are listed apart, with nothing to collect; a cancelled one is left out', async () => {
    openApp(dayOf(TUNG), { as: LAN });

    expect(await heading('Reconcile: Võ Thanh Tùng')).toBeTruthy();
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
      ['Request', 'Customer', 'Order', 'Total'],
      [delivered.number, delivered.customer.name, delivered.order.number, TUNG_COLLECT],
      ['To collect', TUNG_COLLECT],
    ]);
    // those still waiting are apart, with no total
    expect(screen.getByRole('heading', { level: 3, name: 'Still waiting' })).toBeTruthy();
    expect(rows(tables[1])).toEqual([
      ['Request', 'Customer', 'Order'],
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

    expect(await heading('Reconcile: Đặng Hoài Nam')).toBeTruthy();
    expect(screen.getByText('Nothing delivered yet: nothing to collect.')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 3, name: 'Still waiting' })).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Back to the delivery requests' }).getAttribute('href'),
    ).toBe(`/deliveries?day=${DEMO_TODAY}`);
    document.body.innerHTML = '';

    openApp(`/deliveries/${DEMO_TODAY}/drivers/00000000-0000-4000-8000-000000000999`, { as: LAN });
    expect(
      await screen.findByText('This driver has no delivery requests on this day.'),
    ).toBeTruthy();
  });
});

describe('the cash handed in', () => {
  it('The office types the cash the driver handed in, in whole đồng from 0, and sees the difference at once: exact, short by, or over by; nothing is rounded', async () => {
    openApp(dayOf(TUNG), { as: LAN });
    await heading('Reconcile: Võ Thanh Tùng');

    const status = () => screen.getByRole('status').textContent;
    expect(status()).toBe('Type the cash the driver handed in to see the difference.');
    expect((await closeButton()).hasAttribute('disabled')).toBe(true);

    await typeCash('47400000');
    expect(status()).toBe('Exact: nothing missing');
    await typeCash('47380000');
    expect(status()).toBe('Short by 20,000 VND');
    await typeCash('47400001');
    expect(status()).toBe('Over by 1 VND');
    // from 0: nothing handed in is the whole sum missing
    await typeCash('0');
    expect(status()).toBe('Short by 47,400,000 VND');
    expect((await closeButton()).hasAttribute('disabled')).toBe(false);
  });

  it('The cash field takes digits and the language’s thousands separator alone; anything else is refused before any call', async () => {
    const drawn = openApp(dayOf(TUNG), { as: LAN });
    await heading('Reconcile: Võ Thanh Tùng');

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
    await heading('Đối soát: Võ Thanh Tùng');
    const field = await screen.findByLabelText<HTMLInputElement>('Tiền mặt đã nộp (đ)');
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
    await heading('Reconcile: Võ Thanh Tùng');

    await typeCash('5');
    expect(screen.getByText(/adds up to more than a day can hold/)).toBeTruthy();
    expect((await closeButton()).hasAttribute('disabled')).toBe(true);
    expect(drawn.api.closeDay).not.toHaveBeenCalled();
  });
});

describe('closing the day', () => {
  it('Close the day asks first, naming the cash, the gap and the requests still waiting, which the close cancels so that their orders offer to be sent again; once closed, the page reads Closed, with to collect, handed in, the gap and who closed it', async () => {
    const drawn = openApp(dayOf(TUNG), { as: LAN });
    await heading('Reconcile: Võ Thanh Tùng');
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
    expect(screen.getByText('Close this day for Võ Thanh Tùng?')).toBeTruthy();
    expect(screen.getByText('Cash handed in: 47,380,000 VND')).toBeTruthy();
    expect(screen.getByText('Difference: Short by 20,000 VND')).toBeTruthy();
    expect(
      screen.getByText(
        'Requests still waiting: 1. The close cancels them, and their orders offer to be sent again.',
      ),
    ).toBeTruthy();
    // the cash cannot be changed while the check is open
    expect((await cashField()).readOnly).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'No, keep it open' }));
    expect((await cashField()).readOnly).toBe(false);
    await userEvent.click(await closeButton());
    await userEvent.click(screen.getByRole('button', { name: 'Yes, close the day' }));

    // the close names the requests the page showed and the cash, and no sum
    expect(drawn.api.closeDay).toHaveBeenCalledExactlyOnceWith(DEMO_TODAY, TUNG.id, {
      delivered: [delivered.id],
      waiting: [waiting.id],
      handedIn: 47_380_000,
    });
    expect((await screen.findByRole('alert')).textContent).toBe('The day is closed.');
    const closed = await screen.findByRole('table', { name: 'Closed' });
    expect(
      within(closed)
        .getAllByRole('row')
        .map((row) => [...row.querySelectorAll('th, td')].map((cell) => cell.textContent)),
    ).toEqual([
      ['To collect', TUNG_COLLECT],
      ['Handed in', '47,380,000 VND'],
      ['Difference', 'Short by 20,000 VND'],
      ['Closed by', 'EMP-0001 · Nguyễn Thị Lan'],
    ]);
    // the request that waited is cancelled: the day lists it no more, and no cash or close is offered
    expect(screen.queryByRole('heading', { level: 3, name: 'Still waiting' })).toBeNull();
    expect(screen.queryByLabelText('Cash handed in (VND)')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Close the day' })).toBeNull();
  });
});

describe('a day that moved, a close that failed', () => {
  it('The figures are the app’s: a delivery made between opening the day and closing it closes nothing, and the page shows the new figures; the check then names no waiting request and the root closes it', async () => {
    const drawn = openApp(dayOf(TUNG), { cue: 'closeDay:409' });
    await heading('Reconcile: Võ Thanh Tùng');
    await typeCash('47400000');
    await userEvent.click(await closeButton());
    await userEvent.click(screen.getByRole('button', { name: 'Yes, close the day' }));

    // nothing was closed; the day is read again, with the request the driver delivered meanwhile
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Nothing was closed. These are the new figures');
    expect(drawn.api.closeDay).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(drawn.api.listDeliveries).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('table', { name: 'Closed' })).toBeNull();
    expect(screen.queryByRole('heading', { level: 3, name: 'Still waiting' })).toBeNull();
    const delivered = (await screen.findAllByRole('table'))[0];
    expect(within(delivered).getAllByRole('row')).toHaveLength(4);
    expect(within(delivered).getByText('51,180,000 VND', { selector: 'th' })).toBeTruthy();
    // the cash typed is kept, and now it is short of the new sum
    expect((await cashField()).value).toBe('47,400,000');
    expect(screen.getByRole('status').textContent).toBe('Short by 3,780,000 VND');

    await userEvent.click(await closeButton());
    expect(screen.getByText('No request is still waiting.')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Yes, close the day' }));
    expect((await screen.findByRole('alert')).textContent).toBe('The day is closed.');
    const closed = await screen.findByRole('table', { name: 'Closed' });
    expect(within(closed).getByText('root (the root)')).toBeTruthy();
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
    await heading('Reconcile: Võ Thanh Tùng');
    await typeCash('47400000');
    await userEvent.click(await closeButton());
    await userEvent.click(screen.getByRole('button', { name: 'Yes, close the day' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Nothing was closed.');
    const closed = await screen.findByRole('table', { name: 'Closed' });
    expect(within(closed).getByText('Short by 47,399,999 VND')).toBeTruthy();
    expect(drawn.api.closeDay).toHaveBeenCalledTimes(1);
  });

  it('A close that fails says so, keeps the cash typed, and closes nothing', async () => {
    const drawn = openApp(dayOf(TUNG), { as: LAN, cue: 'closeDay:503' });
    await heading('Reconcile: Võ Thanh Tùng');
    await typeCash('47380000');
    await userEvent.click(await closeButton());
    await userEvent.click(screen.getByRole('button', { name: 'Yes, close the day' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Nothing was closed. The cash you typed is still here: try again.',
    );
    expect((await cashField()).value).toBe('47,380,000');
    expect(screen.queryByRole('table', { name: 'Closed' })).toBeNull();
    // nothing on the day moved: the waiting request still waits, and a second try closes it
    expect(screen.getByRole('heading', { level: 3, name: 'Still waiting' })).toBeTruthy();
    await userEvent.click(await closeButton());
    await userEvent.click(screen.getByRole('button', { name: 'Yes, close the day' }));
    expect(await screen.findByRole('table', { name: 'Closed' })).toBeTruthy();
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

    expect(await heading('Đối soát: Võ Thanh Tùng')).toBeTruthy();
    expect(screen.getAllByRole('table')).toHaveLength(2);
    expect(screen.queryByLabelText('Tiền mặt đã nộp (đ)')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Chốt ngày' })).toBeNull();
    document.body.innerHTML = '';

    // and the closed day is read as the data set closed it
    openApp(dayOf(NAM, YESTERDAY), {
      override: (spied) =>
        spied.me.mockResolvedValue({
          user: { name: 'Xem', root: false, permissions: { 'orders.canView': true } },
        }),
    });
    expect(await screen.findByRole('table', { name: 'Closed' })).toBeTruthy();
  });

  it('A driver’s phone shows nothing new: the day’s page is not theirs to open, and the menu lists no such page', async () => {
    openApp(dayOf(TUNG), { as: 'EMP-0005' });

    expect(
      await screen.findByRole('heading', { level: 2, name: 'You cannot open this page' }),
    ).toBeTruthy();
  });

  it('A closed day is final: it offers no cash and no close, and a second close from a stale page closes nothing', async () => {
    const drawn = openApp(dayOf(NAM, YESTERDAY), { as: LAN });

    const closed = await screen.findByRole('table', { name: 'Closed' });
    expect(within(closed).getByText('Short by 20,000 VND')).toBeTruthy();
    expect(within(closed).getByText('2,540,000 VND')).toBeTruthy();
    expect(screen.queryByLabelText('Cash handed in (VND)')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Close the day' })).toBeNull();
    expect(
      await drawn.api.closeDay(YESTERDAY, NAM.id, { delivered: [], waiting: [], handedIn: 5 }),
    ).toEqual({ kind: 'moved' });
  });
});

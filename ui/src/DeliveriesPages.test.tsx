import { addDays } from '@credo/shared';
import { DEMO_DELIVERIES, DEMO_DELIVERY_PHOTOS, DEMO_ORDERS, DEMO_TODAY } from '@credo/shared/demo';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { openApp } from '../tests/open';
import { ApiError } from './api';

const LAN = 'EMP-0001';
const money = (amount: number) => `${new Intl.NumberFormat('en').format(amount)} VND`;

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

    expect(await heading('Delivery requests')).toBeTruthy();
    // one group for each driver, in code order, with how many it holds
    const groups = await screen.findAllByRole('heading', { level: 3 });
    expect(groups.map((one) => one.textContent)).toEqual([
      'Võ Thanh Tùng Requests: 3',
      'Đặng Hoài Nam Requests: 2',
    ]);
    expect(drawn.api.listDeliveries).toHaveBeenCalledExactlyOnceWith(DEMO_TODAY);
    const mine = today.filter((one) => one.driver.code === 'EMP-0005');
    const table = screen.getByRole('table', { name: 'Võ Thanh Tùng' });
    expect(rowsOf(table)).toEqual([
      ['Request', 'Customer', 'Address', 'Order', 'Total', 'State'],
      ...mine.map((one) => [
        one.number,
        one.customer.name,
        one.customer.extra['address'],
        one.order.number,
        money(one.total),
        { waiting: 'Waiting', delivered: 'Delivered', cancelled: 'Cancelled' }[one.state],
      ]),
    ]);

    // another day is picked in the day field
    const dayField = screen.getByLabelText<HTMLInputElement>('Delivery day');
    expect(dayField.value).toBe(DEMO_TODAY);
    fireEvent.change(dayField, { target: { value: addDays(DEMO_TODAY, -1) } });
    await waitFor(() =>
      expect(drawn.api.listDeliveries).toHaveBeenCalledWith(addDays(DEMO_TODAY, -1)),
    );
    expect(await screen.findByRole('table', { name: 'Đặng Hoài Nam' })).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>('Delivery day').value).toBe(
      addDays(DEMO_TODAY, -1),
    );

    // a day that is no date is not asked for
    fireEvent.change(screen.getByLabelText('Delivery day'), { target: { value: '' } });
    expect(drawn.api.listDeliveries).toHaveBeenCalledTimes(2);

    // one is opened from its number
    const open = (await screen.findAllByRole('link', { name: /^GH-/ }))[0];
    expect(open.getAttribute('href')).toMatch(/^\/deliveries\/2026-11-03\//);
  });

  it('says there are none on a day with none, takes the day from the address, and falls back to today for a day that is no date', async () => {
    const drawn = openApp(`/deliveries?day=${addDays(DEMO_TODAY, 5)}`, { as: LAN });

    expect(await screen.findByText('No delivery requests on this day.')).toBeTruthy();
    expect(drawn.api.listDeliveries).toHaveBeenCalledWith(addDays(DEMO_TODAY, 5));
    drawn.unmount();

    const bad = openApp('/deliveries?day=2026-02-30', { as: LAN, language: 'vi' });
    expect(await screen.findByRole('table', { name: 'Võ Thanh Tùng' })).toBeTruthy();
    expect(bad.api.listDeliveries).toHaveBeenCalledWith(DEMO_TODAY);
    expect(screen.getByText('Số yêu cầu: 3')).toBeTruthy();
  });

  it('says it could not load and tries again', async () => {
    openApp('/deliveries', {
      as: LAN,
      override: (spied, original) => {
        spied.listDeliveries.mockRejectedValueOnce(new ApiError(503));
        spied.listDeliveries.mockImplementation((day) => original.listDeliveries(day));
      },
    });

    expect((await screen.findByRole('alert')).textContent).toContain('could not be loaded');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
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

    expect(await heading(`Delivery request ${waiting.number}`)).toBeTruthy();
    expect(screen.getByText('Waiting')).toBeTruthy();
    expect(screen.getByRole('link', { name: waiting.order.number }).getAttribute('href')).toBe(
      `/orders/${waiting.order.day}/${waiting.order.id}`,
    );
    expect(screen.getByText(waiting.customer.name)).toBeTruthy();
    expect(screen.getByText(`Phone: ${waiting.customer.extra['phone'] as string}`)).toBeTruthy();
    expect(
      screen.getByText(`Address: ${waiting.customer.extra['address'] as string}`),
    ).toBeTruthy();
    expect(screen.getByText(`Driver: ${waiting.driver.name}`)).toBeTruthy();
    const lines = rowsOf(screen.getByRole('table'));
    expect(lines.slice(1, -1).map((row) => [row[0], row[3]])).toEqual(
      waiting.lines.map((line) => [
        `${line.code} · ${line.name}`,
        new Intl.NumberFormat('en').format(line.quantity),
      ]),
    );
    expect(lines.at(-1)).toEqual(['Total', money(waiting.total)]);
    expect(screen.getByText(`To collect: ${money(waiting.total)}`)).toBeTruthy();
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

    expect(await heading(`Delivery request ${cancelled.number}`)).toBeTruthy();
    expect(screen.getByText('Cancelled')).toBeTruthy();
    expect(screen.queryByText(/^Phone:/)).toBeNull();
    expect(screen.queryByText(/^Address:/)).toBeNull();
    expect(screen.queryByRole('heading', { level: 3, name: 'Cancel the request' })).toBeNull();
  });

  it('offers no cancel to someone who may only see, and says it could not be loaded when it is not there', async () => {
    openApp(at(waiting), {
      language: 'vi',
      override: (spied) =>
        spied.me.mockResolvedValue({
          user: { name: 'Xem', root: false, permissions: { 'orders.canView': true } },
        }),
    });
    expect(await heading(`Yêu cầu giao hàng ${waiting.number}`)).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 3, name: 'Hủy yêu cầu' })).toBeNull();
    document.body.innerHTML = '';

    openApp(`/deliveries/${DEMO_TODAY}/00000000-0000-4000-8000-000000000999`, { as: LAN });
    expect((await screen.findByRole('alert')).textContent).toContain('could not be loaded');
  });
});

describe('a delivered request', () => {
  const delivered = today.find((one) => one.state === 'delivered')!;

  it('The office sees a delivered request in Orders, Delivery requests, the request with its photo and its order Fulfilled, when it next opens or reloads one', async () => {
    openApp(at(delivered), { as: LAN });

    expect(await heading(`Delivery request ${delivered.number}`)).toBeTruthy();
    expect(screen.getByText('Delivered')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 3, name: 'Proof of delivery' })).toBeTruthy();
    const proof = await screen.findByRole('img', {
      name: 'The goods as the driver delivered them',
    });
    expect(proof.getAttribute('src')).toBe(DEMO_DELIVERY_PHOTOS[delivered.id]);
    // no cancel is offered after it
    expect(screen.queryByRole('heading', { level: 3, name: 'Cancel the request' })).toBeNull();
    document.body.innerHTML = '';

    // its order reads Fulfilled, with the request it names
    const order = DEMO_ORDERS.find((one) => one.id === delivered.order.id)!;
    openApp(`/orders/${order.day}/${order.id}`, { as: LAN });
    expect(await heading(`Order ${order.number}`)).toBeTruthy();
    expect(screen.getByText('Fulfilled')).toBeTruthy();
    expect(screen.getByRole('link', { name: delivered.number })).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 3, name: 'Cancel the order' })).toBeNull();
  });

  it('says the photo could not be loaded, and tries again', async () => {
    openApp(at(delivered), {
      as: LAN,
      override: (spied, original) => {
        spied.getDeliveryPhoto.mockRejectedValueOnce(new ApiError(503));
        spied.getDeliveryPhoto.mockImplementation((day, id) => original.getDeliveryPhoto(day, id));
      },
    });

    await heading('Proof of delivery', 3);
    expect((await screen.findByRole('alert')).textContent).toContain('could not be loaded');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByRole('img', { name: 'The goods as the driver delivered them' }),
    ).toBeTruthy();
  });
});

describe('cancelling a request', () => {
  const cancelButton = () => screen.findByRole('button', { name: 'Cancel the request' });

  it('The office cancels a waiting request after a check; the order stays confirmed and offers to send it again, to a driver and a day, as a new request with a new number', async () => {
    const drawn = openApp(at(waiting), { as: LAN });
    await heading(`Delivery request ${waiting.number}`);

    // the first press only asks
    await userEvent.click(await cancelButton());
    expect(drawn.api.cancelDelivery).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'No, keep it' }));
    await userEvent.click(await cancelButton());
    await userEvent.click(screen.getByRole('button', { name: `Yes, cancel ${waiting.number}` }));

    expect(drawn.api.cancelDelivery).toHaveBeenCalledExactlyOnceWith(waiting.day, waiting.id, {
      version: 'g1',
    });
    expect((await screen.findByRole('alert')).textContent).toContain('The request is cancelled.');
    expect(screen.getByText('Cancelled')).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 3, name: 'Cancel the request' })).toBeNull();

    // the order stays confirmed, and offers to be sent again
    await userEvent.click(screen.getByRole('link', { name: 'Open the order to send it again' }));
    expect(await heading(`Order ${waiting.order.number}`)).toBeTruthy();
    expect(screen.getByText('Confirmed')).toBeTruthy();
    expect(await screen.findByRole('heading', { level: 3, name: 'Send it again' })).toBeTruthy();
    expect(
      screen.getByText('Its delivery request was cancelled. Send it again to a driver and a day.'),
    ).toBeTruthy();
    await userEvent.selectOptions(
      await screen.findByLabelText('Driver'),
      'EMP-0005 · Võ Thanh Tùng',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Send again' }));
    const number = `GH-${String(DEMO_DELIVERIES.length + 1).padStart(5, '0')}`;
    expect((await screen.findByRole('alert')).textContent).toBe(
      `Sent again. Delivery request ${number} is made.`,
    );
    expect(number).not.toBe(waiting.number);
  });

  it('A cancel over someone else’s newer one is refused and theirs is offered; one that fails says so', async () => {
    openApp(at(waiting), { as: LAN, cue: 'cancelDelivery:409' });
    await heading(`Delivery request ${waiting.number}`);
    await userEvent.click(await cancelButton());
    await userEvent.click(screen.getByRole('button', { name: `Yes, cancel ${waiting.number}` }));

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Someone saved this order first',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Show theirs' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(screen.getByText('Waiting')).toBeTruthy();
    document.body.innerHTML = '';

    openApp(at(waiting), { as: LAN, cue: 'cancelDelivery:503' });
    await heading(`Delivery request ${waiting.number}`);
    await userEvent.click(await cancelButton());
    await userEvent.click(screen.getByRole('button', { name: `Yes, cancel ${waiting.number}` }));
    expect((await screen.findByRole('alert')).textContent).toContain('Nothing was cancelled');
    expect(screen.getByText('Waiting')).toBeTruthy();
  });

  it('reads the request again when the refusal carried no newer one', async () => {
    const drawn = openApp(at(waiting), {
      as: LAN,
      override: (spied) =>
        spied.cancelDelivery.mockResolvedValue({ kind: 'conflict', current: null }),
    });
    await heading(`Delivery request ${waiting.number}`);
    await userEvent.click(await cancelButton());
    await userEvent.click(screen.getByRole('button', { name: `Yes, cancel ${waiting.number}` }));

    await userEvent.click(await screen.findByRole('button', { name: 'Show theirs' }));

    await waitFor(() => expect(drawn.api.getDelivery).toHaveBeenCalledTimes(2));
  });
});

import {
  DEMO_CUSTOMERS,
  DEMO_DELIVERIES,
  DEMO_ORDERS,
  DEMO_PRODUCTS,
  DEMO_TODAY,
} from '@credo/shared/demo';
import { addDays, newestOrdersFirst } from '@credo/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { openApp } from '../../../tests/open';
import { ApiError } from '../../api';

const LAN = 'EMP-0001';
const money = (amount: number) => `${new Intl.NumberFormat('en').format(amount)} VND`;
const day = (value: string) =>
  new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(Date.parse(`${value}T00:00:00Z`));

/** The text of each row of the first table, cell by cell. */
const rows = () =>
  within(screen.getByRole('table'))
    .getAllByRole('row')
    .map((row) => [...row.querySelectorAll('th, td')].map((cell) => cell.textContent));

const draftToday = DEMO_ORDERS.find((one) => one.day === DEMO_TODAY && one.state === 'draft')!;
const draftOlder = DEMO_ORDERS.find((one) => one.day !== DEMO_TODAY && one.state === 'draft')!;
const sentToday = DEMO_ORDERS.find((one) => one.request?.day === DEMO_TODAY)!;
const unsent = DEMO_ORDERS.find((one) => one.state === 'confirmed' && one.request === null)!;
const cancelledOrder = DEMO_ORDERS.find((one) => one.state === 'cancelled')!;
const at = (order: { day: string; id: string }) => `/orders/${order.day}/${order.id}`;

const heading = (name: string | RegExp, level = 2) => screen.findByRole('heading', { level, name });

/** The draft's form is drawn once the two lists are in. */
const formReady = () => screen.findByRole('button', { name: 'Save draft' });

/** A form field by its label, the star of a required one allowed. */
const field = (label: string) =>
  screen.getByLabelText(new RegExp(`^${label}`), { selector: 'input, select, textarea' });

describe('the orders list', () => {
  it('Someone who may see orders lands on them after signing in: the last 7 days’, newest first, each with its number, day, customer, total, state, and the driver of one sent; the 7 days before are one click away', async () => {
    const drawn = openApp('/', { as: LAN });

    expect(await heading('Orders')).toBeTruthy();
    expect((await screen.findAllByRole('row')).length).toBe(DEMO_ORDERS.length + 1);
    expect(rows()[0]).toEqual(['Order', 'Day', 'Customer', 'Total', 'State', 'Driver']);
    const newest = [...DEMO_ORDERS].sort(newestOrdersFirst);
    expect(rows().slice(1)).toEqual(
      newest.map((one) => [
        one.number,
        day(one.day),
        one.customer.name,
        money(one.total),
        {
          draft: 'Draft',
          confirmed: 'Confirmed',
          fulfilled: 'Fulfilled',
          cancelled: 'Cancelled',
        }[one.state],
        one.request?.driver.name ?? '',
      ]),
    );
    // the week asked for ends today and starts six days before
    expect(drawn.api.listOrders).toHaveBeenCalledExactlyOnceWith(
      addDays(DEMO_TODAY, -6),
      DEMO_TODAY,
    );
    expect(
      screen.getByText(`Orders from ${day(addDays(DEMO_TODAY, -6))} to today, newest first.`),
    ).toBeTruthy();
    expect(
      within(screen.getAllByRole('navigation', { name: 'Menu' })[0])
        .getAllByRole('link')
        .map((link) => link.textContent)
        .slice(0, 2),
    ).toEqual(['Orders', 'Delivery requests']);

    await userEvent.click(screen.getByRole('button', { name: 'Show the 7 days before' }));

    await waitFor(() => expect(drawn.api.listOrders).toHaveBeenCalledTimes(3));
    expect(drawn.api.listOrders).toHaveBeenCalledWith(
      addDays(DEMO_TODAY, -13),
      addDays(DEMO_TODAY, -7),
    );
    expect(
      await screen.findByText(
        `Orders from ${day(addDays(DEMO_TODAY, -13))} to today, newest first.`,
      ),
    ).toBeTruthy();
    expect(rows().length).toBe(DEMO_ORDERS.length + 1);
  });

  it('opens an order from its number, and offers New order to whoever may make one', async () => {
    openApp('/orders', { as: LAN });

    const link = await screen.findByRole('link', { name: draftToday.number });
    expect(link.getAttribute('href')).toBe(at(draftToday));
    expect(screen.getByRole('link', { name: 'New order' }).getAttribute('href')).toBe(
      '/orders/new',
    );
  });

  it('says there are no orders, in Vietnamese too, and offers no New order to someone who may only see', async () => {
    openApp('/orders', {
      language: 'vi',
      override: (spied) => {
        spied.listOrders.mockResolvedValue([]);
        spied.me.mockResolvedValue({
          user: { name: 'Xem', root: false, permissions: { 'orders.canView': true } },
        });
      },
    });

    expect(await screen.findByText('Chưa có đơn hàng nào trong những ngày này.')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Tạo đơn hàng' })).toBeNull();
  });

  it('says it could not load and tries again', async () => {
    const drawn = openApp('/orders', {
      as: LAN,
      override: (spied, original) => {
        spied.listOrders.mockRejectedValueOnce(new ApiError(503));
        spied.listOrders.mockImplementation((from, to) => original.listOrders(from, to));
      },
    });

    expect((await screen.findByRole('alert')).textContent).toContain('could not be loaded');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(draftToday.number)).toBeTruthy();
    expect(drawn.api.listOrders).toHaveBeenCalledTimes(2);
  });

  it('a refusal reads who the person is again', async () => {
    const drawn = openApp('/orders', {
      as: LAN,
      override: (spied) => spied.listOrders.mockRejectedValue(new ApiError(403)),
    });

    await screen.findByRole('alert');
    await waitFor(() => expect(drawn.api.me).toHaveBeenCalledTimes(2));
  });
});

describe('a new order', () => {
  const chooseProduct = async (code: string, quantity: number) => {
    const product = DEMO_PRODUCTS.find((one) => one.code === code)!;
    await userEvent.selectOptions(field('Product'), product.id);
    fireEvent.change(field('Quantity'), { target: { value: String(quantity) } });
    await userEvent.click(screen.getByRole('button', { name: 'Add line' }));
  };

  it('A new order: the office picks a customer from the list and products from the list, each with a quantity in whole units; a product added twice is one line; each line shows its unit, price and amount, the order its total in đồng', async () => {
    openApp('/orders/new', { as: LAN });
    await heading('New order');
    await screen.findByRole('option', { name: /KH-001/ });

    await userEvent.selectOptions(field('Customer'), DEMO_CUSTOMERS[0].id);
    await chooseProduct('VT-001', 40);
    await chooseProduct('VT-002', 3);
    await chooseProduct('VT-001', 10);

    // the customer and the products come from the two lists, in code order
    expect(
      within(field('Customer'))
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Choose a customer', ...DEMO_CUSTOMERS.map((one) => `${one.code} · ${one.name}`)]);
    expect(rows()).toEqual([
      ['Product', 'Unit', 'Price (VND)', 'Quantity', 'Amount (VND)', ''],
      ['VT-001 · Xi măng PCB40', 'bao', '95,000', '50', '4,750,000', 'Remove'],
      ['VT-002 · Cát xây tô', 'm³', '320,000', '3', '960,000', 'Remove'],
      ['Total', money(5_710_000), ''],
    ]);
    // a quantity is in whole units, and no price is typed anywhere
    expect(screen.getByText('Whole units')).toBeTruthy();
    expect(screen.queryByLabelText(/^Price/)).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Remove Cát xây tô' }));
    expect(rows().at(-1)).toEqual(['Total', money(4_750_000), '']);
  });

  it('A line’s price is the product’s, set by the app, never typed; the total is the sum of the lines, with no VAT, discount or fee beyond a product’s own line (S1’s transport fee is one); a confirmed order keeps its prices and its customer’s name, phone and address as they were', async () => {
    const changed = { ...sentToday, lines: sentToday.lines.map((line) => ({ ...line, price: 1 })) };
    openApp('/orders/new', { as: LAN });
    await heading('New order');
    await screen.findByRole('option', { name: /KH-001/ });
    await userEvent.selectOptions(field('Customer'), DEMO_CUSTOMERS[0].id);
    await chooseProduct('VT-001', 1);
    await chooseProduct('DV-001', 1);

    // the product's price, and the fee as a line of its own, and nothing else added
    expect(rows().at(-1)).toEqual(['Total', money(95_000 + 150_000), '']);
    expect(
      rows()
        .slice(1, 3)
        .map((row) => row[2]),
    ).toEqual(['95,000', '150,000']);
    cleanupPage();

    // a confirmed order shows the prices and the customer it was saved with, not the lists' now
    openApp(at(sentToday), {
      as: LAN,
      override: (spied) =>
        spied.getOrder.mockResolvedValue({
          order: { ...changed, customer: { ...changed.customer, name: 'Tên cũ' } },
          version: 'o1',
        }),
    });
    await heading(`Order ${sentToday.number}`);
    expect(screen.getByText('Tên cũ')).toBeTruthy();
    expect(rows()[1]?.[2]).toBe('1');
    expect(rows().at(-1)).toEqual(['Total', money(sentToday.total)]);
  });

  it('An order is saved as a draft and changed again, or confirmed; once confirmed it is not changed', async () => {
    const drawn = openApp('/orders/new', { as: LAN });
    await heading('New order');
    await screen.findByRole('option', { name: /KH-001/ });
    expect(screen.getByRole('button', { name: 'Save draft' }).hasAttribute('disabled')).toBe(true);
    await userEvent.selectOptions(field('Customer'), DEMO_CUSTOMERS[0].id);
    await chooseProduct('VT-001', 2);

    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    // saved: no price and no total in the request, and the order's own page opens with its number
    expect(drawn.api.createOrder).toHaveBeenCalledExactlyOnceWith({
      day: DEMO_TODAY,
      customerId: DEMO_CUSTOMERS[0].id,
      lines: [{ productId: DEMO_PRODUCTS.find((one) => one.code === 'VT-001')!.id, quantity: 2 }],
      extra: {},
    });
    const number = `DH-${String(DEMO_ORDERS.length + 1).padStart(5, '0')}`;
    expect(await heading(`Order ${number}`)).toBeTruthy();
    expect(screen.getByText('Draft')).toBeTruthy();

    // changed again: the save names the version it was read at, and is not offered while nothing changed
    const save = await screen.findByRole('button', { name: 'Save draft' });
    expect(save.hasAttribute('disabled')).toBe(true);
    await chooseProduct('VT-002', 1);
    expect(save.hasAttribute('disabled')).toBe(false);
    await userEvent.click(save);
    expect(await screen.findByText('Saved.')).toBeTruthy();
    expect(drawn.api.saveOrder).toHaveBeenCalledOnce();
    expect(drawn.api.saveOrder.mock.calls[0]?.[2].version).toBe('o1');

    // confirmed: the page reads, and offers no change
    await userEvent.selectOptions(
      await screen.findByLabelText('Driver'),
      'EMP-0005 · Võ Thanh Tùng',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(await screen.findByText('Confirmed')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save draft' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add line' })).toBeNull();
    expect(screen.queryByLabelText('Quantity')).toBeNull();
  });

  it('refuses a save over a customer or lines that are not there yet, and keeps New order for those who may make one', async () => {
    openApp('/orders/new', {
      override: (spied) =>
        spied.me.mockResolvedValue({
          user: { name: 'Xem', root: false, permissions: { 'orders.canView': true } },
        }),
    });

    expect((await heading('You cannot open this page')).textContent).toBe(
      'You cannot open this page',
    );
  });

  it('says the lists could not be loaded, and that nothing is chosen yet', async () => {
    openApp('/orders/new', {
      as: LAN,
      override: (spied) => spied.listProducts.mockRejectedValue(new ApiError(503)),
    });

    expect((await screen.findByRole('alert')).textContent).toContain('could not be loaded');
  });

  it('a quantity cleared before the line is added counts as one, and a line whose product the list no longer holds is not drawn', async () => {
    openApp('/orders/new', { as: LAN });
    await heading('New order');
    await screen.findByRole('option', { name: /KH-001/ });
    await userEvent.selectOptions(field('Product'), DEMO_PRODUCTS[1].id);
    await userEvent.clear(field('Quantity'));
    await userEvent.click(screen.getByRole('button', { name: 'Add line' }));
    expect(rows()[1]?.[3]).toBe('1');
    document.body.innerHTML = '';

    openApp(at(draftToday), {
      as: LAN,
      override: (spied, original) =>
        spied.listProducts.mockImplementation(async () =>
          (await original.listProducts()).filter((one) => one.id !== draftToday.lines[0].productId),
        ),
    });
    await heading(`Order ${draftToday.number}`);
    await formReady();
    expect(
      screen.getByText('No lines yet. Choose a product and a quantity, then add the line.'),
    ).toBeTruthy();
  });

  it('says there are no lines before one is added', async () => {
    openApp('/orders/new', { as: LAN });

    expect(
      await screen.findByText('No lines yet. Choose a product and a quantity, then add the line.'),
    ).toBeTruthy();
  });

  it('a save that fails says so and keeps what was typed', async () => {
    openApp('/orders/new', {
      as: LAN,
      override: (spied) => spied.createOrder.mockRejectedValue(new ApiError(503)),
    });
    await heading('New order');
    await screen.findByRole('option', { name: /KH-001/ });
    await userEvent.selectOptions(field('Customer'), DEMO_CUSTOMERS[1].id);
    await chooseProduct('VT-003', 4);

    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    expect((await screen.findByRole('alert')).textContent).toContain('was not saved');
    expect((field('Customer') as HTMLSelectElement).value).toBe(DEMO_CUSTOMERS[1].id);
    expect(rows()[1]?.[3]).toBe('4');
  });

  it('keeps a quantity within the most a line takes, and a line added again grows to it and no further', async () => {
    openApp('/orders/new', { as: LAN });
    await heading('New order');
    await screen.findByRole('option', { name: /KH-001/ });

    await chooseProduct('VT-001', 99_999);
    await chooseProduct('VT-001', 5);

    expect(rows()[1]?.[3]).toBe('100,000');
  });
});

/** Which column of the page's grid a block sits in: 0 the details, 1 the steps, -1 none. */
const columnOf = (element: HTMLElement) =>
  [...document.querySelectorAll('.mantine-Grid-col')].indexOf(
    element.closest('.mantine-Grid-col')!,
  );
const columnCount = () => document.querySelectorAll('.mantine-Grid-col').length;
const block = (name: string) => screen.getByRole('heading', { level: 3, name });

describe('the order’s page on the cards', () => {
  it('A draft is two columns from 992: the day, customer and lines left, the confirm and the cancel right', async () => {
    openApp(at(draftToday), { as: LAN });
    await formReady();
    // the confirm panel draws after the drivers load, a call of its own the form does not wait for
    await screen.findByRole('heading', { level: 3, name: 'Confirm the order' });

    expect(columnCount()).toBe(2);
    expect(columnOf(block('Details'))).toBe(0);
    expect(columnOf(block('Lines'))).toBe(0);
    expect(columnOf(screen.getByRole('button', { name: 'Save draft' }))).toBe(0);
    expect(columnOf(block('Confirm the order'))).toBe(1);
    expect(columnOf(block('Cancel the order'))).toBe(1);
  });

  it('A new order offers no step, so it is one column at the full width', async () => {
    openApp('/orders/new', { as: LAN });
    await formReady();

    expect(columnCount()).toBe(1);
    expect(columnOf(block('Details'))).toBe(0);
    expect(columnOf(block('Lines'))).toBe(0);
  });

  it.each([
    ['a confirmed order sent', sentToday, ['Cancel the order']],
    ['a confirmed order whose request is gone', unsent, ['Send it again', 'Cancel the order']],
    ['a cancelled order', cancelledOrder, []],
  ])(
    '%s puts its facts and lines left, its request and its steps right',
    async (_, order, steps) => {
      openApp(at(order), { as: LAN });
      await heading(`Order ${order.number}`);

      expect(columnCount()).toBe(2);
      expect(columnOf(block('Details'))).toBe(0);
      expect(columnOf(block('Lines'))).toBe(0);
      expect(columnOf(block('Delivery request'))).toBe(1);
      // a step's panel draws after the drivers load, a call of its own the order's heading does not wait for
      for (const step of steps) {
        await screen.findByRole('heading', { level: 3, name: step });
        expect(columnOf(block(step))).toBe(1);
      }
    },
  );

  it('A draft read by someone who may only see keeps the request on the right', async () => {
    openApp(at(draftToday), {
      override: (spied) =>
        spied.me.mockResolvedValue({
          user: { name: 'Xem', root: false, permissions: { 'orders.canView': true } },
        }),
    });
    await heading(`Order ${draftToday.number}`);

    expect(columnOf(block('Details'))).toBe(0);
    expect(columnOf(block('Delivery request'))).toBe(1);
  });
});

function cleanupPage() {
  // the next page is drawn on a fresh app
  document.body.innerHTML = '';
}

describe('an order read', () => {
  it('A draft is shown in a form to change, with its confirm and its cancel; a confirmed order with its request, number, driver and day', async () => {
    openApp(at(draftToday), { as: LAN });
    expect(await heading(`Order ${draftToday.number}`)).toBeTruthy();
    await formReady();
    expect((field('Customer') as HTMLSelectElement).value).toBe(draftToday.customer.id);
    expect(rows()[1]?.[0]).toContain(draftToday.lines[0].name);
    expect(
      await screen.findByRole('heading', { level: 3, name: 'Confirm the order' }),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { level: 3, name: 'Cancel the order' })).toBeTruthy();
    cleanupPage();

    openApp(at(sentToday), { as: LAN });
    expect(await heading(`Order ${sentToday.number}`)).toBeTruthy();
    expect(screen.getByText('Confirmed')).toBeTruthy();
    expect(screen.getByText(sentToday.customer.name)).toBeTruthy();
    expect(screen.getByText(`Phone: ${sentToday.customer.extra['phone'] as string}`)).toBeTruthy();
    const link = screen.getByRole('link', { name: sentToday.request!.number });
    expect(link.getAttribute('href')).toBe(
      `/deliveries/${sentToday.request!.day}/${sentToday.request!.id}`,
    );
    expect(screen.getByText(new RegExp(`Driver: ${sentToday.request!.driver.name}`))).toBeTruthy();
    // it has a live request, so no second one is offered
    expect(screen.queryByRole('heading', { level: 3, name: 'Send it again' })).toBeNull();
  });

  it('shows a cancelled order and a draft to someone who may only see as read, without a step to take', async () => {
    openApp(at(cancelledOrder), { as: LAN });
    expect(await heading(`Order ${cancelledOrder.number}`)).toBeTruthy();
    expect(screen.getByText('Cancelled')).toBeTruthy();
    expect(screen.getByText('No delivery request.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Cancel/ })).toBeNull();
    cleanupPage();

    openApp(at(draftToday), {
      language: 'vi',
      override: (spied) =>
        spied.me.mockResolvedValue({
          user: { name: 'Xem', root: false, permissions: { 'orders.canView': true } },
        }),
    });
    expect(await heading(`Đơn hàng ${draftToday.number}`)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Lưu nháp' })).toBeNull();
    expect(screen.queryByRole('heading', { level: 3, name: 'Xác nhận đơn hàng' })).toBeNull();
  });

  it('says it could not be loaded when the order is not there', async () => {
    openApp(`/orders/${DEMO_TODAY}/00000000-0000-4000-8000-000000000999`, { as: LAN });

    expect((await screen.findByRole('alert')).textContent).toContain('could not be loaded');
  });
});

describe('confirming an order', () => {
  const driverField = () => screen.findByLabelText('Driver');
  const confirmButton = () => screen.getByRole('button', { name: 'Confirm' });

  it('Confirm asks for the driver, among the people allowed to deliver who have not left, and the day, today unless another is picked, never before the order’s; the order is confirmed and its request made, and the order shows the request’s number, driver and day', async () => {
    const drawn = openApp(at(draftToday), { as: LAN });
    await heading(`Order ${draftToday.number}`);
    await formReady();

    // the drivers: those allowed to deliver, not the office, the warehouse or the one who left
    expect(
      within(await driverField())
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Choose a driver', 'EMP-0005 · Võ Thanh Tùng', 'EMP-0006 · Đặng Hoài Nam']);
    // today is chosen, and nothing is sent before a driver is
    const dayField = await screen.findByLabelText<HTMLInputElement>('Delivery day');
    expect(dayField.value).toBe(DEMO_TODAY);
    expect(confirmButton().hasAttribute('disabled')).toBe(true);

    await userEvent.selectOptions(await driverField(), 'EMP-0006 · Đặng Hoài Nam');
    expect(confirmButton().hasAttribute('disabled')).toBe(false);
    // a day before the order's is not sent
    fireEvent.change(dayField, { target: { value: addDays(draftToday.day, -1) } });
    expect(confirmButton().hasAttribute('disabled')).toBe(true);
    fireEvent.change(dayField, { target: { value: addDays(DEMO_TODAY, 1) } });
    await userEvent.click(confirmButton());

    const driver = DEMO_DELIVERIES.find((one) => one.driver.code === 'EMP-0006')!.driver;
    expect(drawn.api.confirmOrder).toHaveBeenCalledExactlyOnceWith(draftToday.day, draftToday.id, {
      version: 'o1',
      driverId: driver.id,
      day: addDays(DEMO_TODAY, 1),
    });
    const number = `GH-${String(DEMO_DELIVERIES.length + 1).padStart(5, '0')}`;
    expect((await screen.findByRole('alert')).textContent).toBe(
      `Confirmed. Delivery request ${number} is made.`,
    );
    expect(screen.getByText('Confirmed')).toBeTruthy();
    expect(screen.getByRole('link', { name: number })).toBeTruthy();
    expect(screen.getByText(new RegExp(`Driver: ${driver.name}`))).toBeTruthy();
    expect(screen.getByText(new RegExp(`For ${day(addDays(DEMO_TODAY, 1))}`))).toBeTruthy();
  });

  it('keeps the order’s own day as the least when it is later than today, and a day that is cleared sends nothing', async () => {
    openApp(at(draftOlder), { as: LAN });
    await heading(`Order ${draftOlder.number}`);
    await formReady();
    const dayField = await screen.findByLabelText<HTMLInputElement>('Delivery day');
    expect(dayField.min).toBe(draftOlder.day);
    expect(dayField.value).toBe(DEMO_TODAY);
    await userEvent.selectOptions(await driverField(), 'EMP-0005 · Võ Thanh Tùng');

    fireEvent.change(dayField, { target: { value: '' } });

    expect(confirmButton().hasAttribute('disabled')).toBe(true);
  });

  it('offers the order’s own day when it is later than today, and sends nothing when the form is submitted before a driver is chosen', async () => {
    const later = addDays(DEMO_TODAY, 2);
    const drawn = openApp(at(draftToday), {
      as: LAN,
      override: (spied) =>
        spied.getOrder.mockResolvedValue({ order: { ...draftToday, day: later }, version: 'o1' }),
    });
    await heading(`Order ${draftToday.number}`);
    await formReady();

    const dayField = await screen.findByLabelText<HTMLInputElement>('Delivery day');
    expect(dayField.value).toBe(later);
    fireEvent.submit(dayField.closest('form')!);

    expect(drawn.api.confirmOrder).not.toHaveBeenCalled();
  });

  it('holds Confirm until what was changed is saved', async () => {
    openApp(at(draftToday), { as: LAN });
    await heading(`Order ${draftToday.number}`);
    await formReady();
    await userEvent.selectOptions(await driverField(), 'EMP-0005 · Võ Thanh Tùng');
    expect(confirmButton().hasAttribute('disabled')).toBe(false);

    await userEvent.click(
      await screen.findByRole('button', { name: 'Remove ' + draftToday.lines[0].name }),
    );
    await userEvent.selectOptions(field('Product'), DEMO_PRODUCTS[1].id);
    await userEvent.click(screen.getByRole('button', { name: 'Add line' }));

    expect(confirmButton().hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('Save your changes first.')).toBeTruthy();
  });

  it('With no one allowed to deliver, Confirm says to ask the admin', async () => {
    const drawn = openApp(at(draftToday), { as: LAN, noDrivers: true });
    await heading(`Order ${draftToday.number}`);
    await formReady();

    expect((await screen.findByText(/No one is allowed to deliver yet/)).textContent).toContain(
      'Ask the admin',
    );
    expect(screen.queryByRole('button', { name: 'Confirm' })).toBeNull();
    expect(drawn.api.confirmOrder).not.toHaveBeenCalled();
  });

  it('A confirm that fails says so and keeps what was typed', async () => {
    openApp(at(draftToday), { as: LAN, cue: 'confirmOrder:503' });
    await heading(`Order ${draftToday.number}`);
    await formReady();
    await userEvent.selectOptions(await driverField(), 'EMP-0005 · Võ Thanh Tùng');

    await userEvent.click(confirmButton());

    expect((await screen.findByRole('alert')).textContent).toContain('Nothing was changed');
    expect(((await driverField()) as HTMLSelectElement).selectedOptions[0]?.textContent).toBe(
      'EMP-0005 · Võ Thanh Tùng',
    );
    expect(screen.getByText('Draft')).toBeTruthy();
  });

  it('A save or a confirm over someone else’s newer one is refused, what was typed kept, and the page offers theirs', async () => {
    openApp(at(draftToday), { as: LAN, cue: 'saveOrder:409' });
    await heading(`Order ${draftToday.number}`);
    await formReady();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Remove ' + draftToday.lines[0].name }),
    );
    await userEvent.selectOptions(field('Product'), DEMO_PRODUCTS[2].id);
    await userEvent.click(screen.getByRole('button', { name: 'Add line' }));

    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Someone saved this order first',
    );
    // what was typed is still in the form
    expect(rows()[1]?.[0]).toContain(DEMO_PRODUCTS[2].name);

    await userEvent.click(screen.getByRole('button', { name: 'Show theirs' }));

    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    // the form is drawn again once the customers and the products are read again
    await waitFor(() => expect(rows()[1]?.[0]).toContain(draftToday.lines[0].name));
  });

  it('A confirm over someone else’s newer one is refused too, and theirs is offered', async () => {
    openApp(at(draftToday), { as: LAN, cue: 'confirmOrder:409' });
    await heading(`Order ${draftToday.number}`);
    await formReady();
    await userEvent.selectOptions(await driverField(), 'EMP-0005 · Võ Thanh Tùng');

    await userEvent.click(confirmButton());

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Someone saved this order first',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Show theirs' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(screen.getByText('Draft')).toBeTruthy();
  });

  it('reads the order again when the refusal carried no newer one', async () => {
    const drawn = openApp(at(draftToday), {
      as: LAN,
      override: (spied) => spied.saveOrder.mockResolvedValue({ kind: 'conflict', current: null }),
    });
    await heading(`Order ${draftToday.number}`);
    await formReady();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Remove ' + draftToday.lines[0].name }),
    );
    await userEvent.selectOptions(field('Product'), DEMO_PRODUCTS[2].id);
    await userEvent.click(screen.getByRole('button', { name: 'Add line' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    await userEvent.click(await screen.findByRole('button', { name: 'Show theirs' }));

    await waitFor(() => expect(drawn.api.getOrder).toHaveBeenCalledTimes(2));
    // the form is drawn again once the customers and the products are read again
    await waitFor(() => expect(rows()[1]?.[0]).toContain(draftToday.lines[0].name));
  });

  it('A save that fails keeps what was typed', async () => {
    openApp(at(draftToday), { as: LAN, cue: 'saveOrder:503' });
    await heading(`Order ${draftToday.number}`);
    await formReady();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Remove ' + draftToday.lines[0].name }),
    );
    await userEvent.selectOptions(field('Product'), DEMO_PRODUCTS[2].id);
    await userEvent.click(screen.getByRole('button', { name: 'Add line' }));

    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    expect((await screen.findByRole('alert')).textContent).toContain('was not saved');
    expect(rows()[1]?.[0]).toContain(DEMO_PRODUCTS[2].name);
  });
});

describe('cancelling and sending again', () => {
  it('The office cancels a draft, or a confirmed order whose request still waits, after a check; its request is cancelled with it, and the order stays in the list as cancelled, under its number', async () => {
    const drawn = openApp(at(sentToday), { as: LAN });
    await heading(`Order ${sentToday.number}`);

    // a check first: nothing is cancelled by the first press
    await userEvent.click(screen.getByRole('button', { name: 'Cancel the order' }));
    expect(drawn.api.cancelOrder).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'No, keep it' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel the order' }));
    await userEvent.click(screen.getByRole('button', { name: `Yes, cancel ${sentToday.number}` }));

    expect(drawn.api.cancelOrder).toHaveBeenCalledExactlyOnceWith(sentToday.day, sentToday.id, {
      version: 'o1',
    });
    expect((await screen.findByRole('alert')).textContent).toBe('The order is cancelled.');
    expect(screen.getByText('Cancelled')).toBeTruthy();
    // its request was cancelled with it
    const request = await drawn.api.getDelivery(sentToday.request!.day, sentToday.request!.id);
    expect(request.request.state).toBe('cancelled');
    // and the order is still in the list under its number
    drawn.unmount();
    openApp('/orders', { as: LAN });
    expect(await screen.findByText(sentToday.number)).toBeTruthy();
  });

  it('cancels a draft the same way, and says when the cancel did not go through', async () => {
    openApp(at(draftToday), { as: LAN, cue: 'cancelOrder:503' });
    await heading(`Order ${draftToday.number}`);
    await formReady();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel the order' }));

    await userEvent.click(screen.getByRole('button', { name: `Yes, cancel ${draftToday.number}` }));

    expect((await screen.findByRole('alert')).textContent).toContain('Nothing was changed');
    expect(screen.getByText('Draft')).toBeTruthy();
  });

  it('The office cancels a waiting request after a check; the order stays confirmed and offers to send it again, to a driver and a day, as a new request with a new number', async () => {
    const drawn = openApp(at(unsent), { as: LAN });
    await heading(`Order ${unsent.number}`);

    expect(screen.getByText('Confirmed')).toBeTruthy();
    expect(
      screen.getByText('Its delivery request was cancelled. Send it again to a driver and a day.'),
    ).toBeTruthy();
    await userEvent.selectOptions(
      await screen.findByLabelText('Driver'),
      'EMP-0006 · Đặng Hoài Nam',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Send again' }));

    const number = `GH-${String(DEMO_DELIVERIES.length + 1).padStart(5, '0')}`;
    expect(drawn.api.sendOrder).toHaveBeenCalledOnce();
    expect((await screen.findByRole('alert')).textContent).toBe(
      `Sent again. Delivery request ${number} is made.`,
    );
    expect(screen.getByRole('link', { name: number })).toBeTruthy();
    // the old request keeps its own number
    expect(unsent.request).toBeNull();
    expect(
      DEMO_DELIVERIES.some((one) => one.order.id === unsent.id && one.state === 'cancelled'),
    ).toBe(true);
    expect(screen.queryByRole('heading', { level: 3, name: 'Send it again' })).toBeNull();
  });
});

describe('a draft read at the prices it was saved at', () => {
  const draftYesterday = DEMO_ORDERS.find(
    (one) => one.day === addDays(DEMO_TODAY, -1) && one.state === 'draft',
  )!;
  const MOVED = 'Now 95,000: saving takes the new price.';

  it('A saved draft’s lines are drawn at the prices they were saved at, never at the list’s prices today, and its total is theirs', async () => {
    openApp(at(draftYesterday), { as: LAN });
    await heading(`Order ${draftYesterday.number}`);
    await formReady();

    // the cement was saved at 90,000 and the list now says 95,000
    expect(rows()[1]?.slice(0, 5)).toEqual([
      'VT-001 · Xi măng PCB40',
      'bao',
      '90,000Now 95,000: saving takes the new price.',
      '20',
      '1,800,000',
    ]);
    expect(rows().at(-1)).toEqual(['Total', money(draftYesterday.total), '']);
    expect(draftYesterday.total).toBe(1_800_000 + 5 * 410_000);
  });

  it('A line whose product’s price has moved since is marked with what a save would make it; a line whose price has not moved is not marked, and a draft with none moved has no mark', async () => {
    openApp(at(draftYesterday), { as: LAN });
    await formReady();

    expect(screen.getAllByText(MOVED)).toHaveLength(1);
    expect(rows()[1]?.[2]).toContain(MOVED);
    expect(rows()[2]?.[2]).toBe('410,000');
    // a moved price is a change a save makes, though nothing was typed
    expect(screen.getByRole('button', { name: 'Save draft' }).hasAttribute('disabled')).toBe(false);
    cleanupPage();

    openApp(at(draftToday), { as: LAN });
    await formReady();
    expect(screen.queryByText(/saving takes the new price/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Save draft' }).hasAttribute('disabled')).toBe(true);
  });

  it('A save keeps the extra keys the form never shows', async () => {
    const kept = { note: 'Gọi trước', nested: { a: [1, 2] } };
    const drawn = openApp(at(draftToday), {
      as: LAN,
      override: (spied, original) =>
        spied.getOrder.mockImplementation(async (orderDay, orderId) => {
          const doc = await original.getOrder(orderDay, orderId);
          return { ...doc, order: { ...doc.order, extra: kept } };
        }),
    });
    await heading(`Order ${draftToday.number}`);
    await formReady();
    await userEvent.selectOptions(field('Customer'), DEMO_CUSTOMERS[1].id);

    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    expect(await screen.findByText('Saved.')).toBeTruthy();
    expect(drawn.api.saveOrder.mock.calls[0]?.[2].extra).toEqual(kept);
  });

  it('A confirmed, a fulfilled and a cancelled order draw no form, no Save and no marker', async () => {
    const fulfilled = DEMO_ORDERS.find((one) => one.state === 'fulfilled')!;
    for (const order of [sentToday, fulfilled, cancelledOrder]) {
      openApp(at(order), { as: LAN });
      await heading(`Order ${order.number}`);
      expect(screen.queryByRole('button', { name: 'Save draft' }), order.state).toBeNull();
      expect(screen.queryByRole('button', { name: 'Add line' }), order.state).toBeNull();
      expect(screen.queryByText(/saving takes the new price/), order.state).toBeNull();
      cleanupPage();
    }
  });
});

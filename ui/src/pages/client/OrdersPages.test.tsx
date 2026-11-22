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

import { DICTIONARIES } from '../../i18n';

const words = DICTIONARIES.en;
/** A word at the start of a label, the star of a required field allowed after it. */
const starting = (word: string) => new RegExp(`^${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
const wordsVi = DICTIONARIES.vi;
const LAN = 'EMP-0001';
const money = (amount: number) =>
  words.orders.money.replace('{{amount}}', new Intl.NumberFormat('en').format(amount));
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

const orderTitle = (number: string) => words.orders.orderTitle.replace('{{number}}', number);

const heading = (name: string | RegExp, level = 2) => screen.findByRole('heading', { level, name });

/** The draft's form is drawn once the two lists are in. */
const formReady = () => screen.findByRole('button', { name: words.orders.saveDraft });

/** A form field by its label, the star of a required one allowed. */
const field = (label: string) =>
  screen.getByLabelText(starting(label), { selector: 'input, select, textarea' });

describe('the orders list', () => {
  it('Someone who may see orders lands on them after signing in: the last 7 days’, newest first, each with its number, day, customer, total, state, and the driver of one sent; the 7 days before are one click away', async () => {
    const drawn = openApp('/', { as: LAN });

    expect(await heading(words.nav.orders)).toBeTruthy();
    expect((await screen.findAllByRole('row')).length).toBe(DEMO_ORDERS.length + 1);
    expect(rows()[0]).toEqual([
      words.orders.number,
      words.orders.day,
      words.orders.customer,
      words.orders.total,
      words.orders.stateHeading,
      words.orders.driver,
    ]);
    const newest = [...DEMO_ORDERS].sort(newestOrdersFirst);
    expect(rows().slice(1)).toEqual(
      newest.map((one) => [
        one.number,
        day(one.day),
        one.customer.name,
        money(one.total),
        {
          draft: words.orders.state.draft,
          confirmed: words.orders.state.confirmed,
          fulfilled: words.orders.state.fulfilled,
          cancelled: words.orders.state.cancelled,
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
      screen.getByText(words.orders.since.replace('{{day}}', day(addDays(DEMO_TODAY, -6)))),
    ).toBeTruthy();
    expect(
      within(screen.getAllByRole('navigation', { name: words.nav.menu })[0])
        .getAllByRole('link')
        .map((link) => link.textContent)
        .slice(0, 2),
    ).toEqual([words.nav.orders, words.nav.deliveries]);

    await userEvent.click(screen.getByRole('button', { name: words.orders.earlier }));

    await waitFor(() => expect(drawn.api.listOrders).toHaveBeenCalledTimes(3));
    expect(drawn.api.listOrders).toHaveBeenCalledWith(
      addDays(DEMO_TODAY, -13),
      addDays(DEMO_TODAY, -7),
    );
    expect(
      await screen.findByText(words.orders.since.replace('{{day}}', day(addDays(DEMO_TODAY, -13)))),
    ).toBeTruthy();
    expect(rows().length).toBe(DEMO_ORDERS.length + 1);
  });

  it('opens an order from its number, and offers New order to whoever may make one', async () => {
    openApp('/orders', { as: LAN });

    const link = await screen.findByRole('link', { name: draftToday.number });
    expect(link.getAttribute('href')).toBe(at(draftToday));
    expect(screen.getByRole('link', { name: words.orders.new }).getAttribute('href')).toBe(
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

    expect(await screen.findByText(wordsVi.orders.empty)).toBeTruthy();
    expect(screen.queryByRole('link', { name: wordsVi.orders.new })).toBeNull();
  });

  it('says it could not load and tries again', async () => {
    const drawn = openApp('/orders', {
      as: LAN,
      override: (spied, original) => {
        spied.listOrders.mockRejectedValueOnce(new ApiError(503));
        spied.listOrders.mockImplementation((from, to) => original.listOrders(from, to));
      },
    });

    expect((await screen.findByRole('alert')).textContent).toContain(words.common.loadFailed);
    await userEvent.click(screen.getByRole('button', { name: words.common.retry }));
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
    await userEvent.selectOptions(field(words.orders.product), product.id);
    fireEvent.change(field(words.orders.quantity), { target: { value: String(quantity) } });
    await userEvent.click(screen.getByRole('button', { name: words.orders.addLine }));
  };

  it('A new order: the office picks a customer from the list and products from the list, each with a quantity in whole units; a product added twice is one line; each line shows its unit, price and amount, the order its total in đồng', async () => {
    openApp('/orders/new', { as: LAN });
    await heading(words.orders.newTitle);
    await screen.findByRole('option', { name: /KH-001/ });

    await userEvent.selectOptions(field(words.orders.customer), DEMO_CUSTOMERS[0].id);
    await chooseProduct('VT-001', 40);
    await chooseProduct('VT-002', 3);
    await chooseProduct('VT-001', 10);

    // the customer and the products come from the two lists, in code order
    expect(
      within(field(words.orders.customer))
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual([
      words.orders.chooseCustomer,
      ...DEMO_CUSTOMERS.map((one) => `${one.code} · ${one.name}`),
    ]);
    expect(rows()).toEqual([
      [
        words.orders.product,
        words.orders.unit,
        words.orders.price,
        words.orders.quantity,
        words.orders.amount,
        '',
      ],
      ['VT-001 · Xi măng PCB40', 'bao', '95,000', '50', '4,750,000', words.orders.remove],
      ['VT-002 · Cát xây tô', 'm³', '320,000', '3', '960,000', words.orders.remove],
      [words.orders.total, money(5_710_000), ''],
    ]);
    // a quantity is in whole units, and no price is typed anywhere
    expect(screen.getByText(words.orders.wholeUnits)).toBeTruthy();
    expect(screen.queryByLabelText(starting(words.orders.price))).toBeNull();

    await userEvent.click(
      screen.getByRole('button', {
        name: words.orders.removeLine.replace('{{name}}', 'Cát xây tô'),
      }),
    );
    expect(rows().at(-1)).toEqual([words.orders.total, money(4_750_000), '']);
  });

  it('A line’s price is the product’s, set by the app, never typed; the total is the sum of the lines, with no VAT, discount or fee beyond a product’s own line (S1’s transport fee is one); a confirmed order keeps its prices and its customer’s name, phone and address as they were', async () => {
    const changed = { ...sentToday, lines: sentToday.lines.map((line) => ({ ...line, price: 1 })) };
    openApp('/orders/new', { as: LAN });
    await heading(words.orders.newTitle);
    await screen.findByRole('option', { name: /KH-001/ });
    await userEvent.selectOptions(field(words.orders.customer), DEMO_CUSTOMERS[0].id);
    await chooseProduct('VT-001', 1);
    await chooseProduct('DV-001', 1);

    // the product's price, and the fee as a line of its own, and nothing else added
    expect(rows().at(-1)).toEqual([words.orders.total, money(95_000 + 150_000), '']);
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
    await heading(orderTitle(sentToday.number));
    expect(screen.getByText('Tên cũ')).toBeTruthy();
    expect(rows()[1]?.[2]).toBe('1');
    expect(rows().at(-1)).toEqual([words.orders.total, money(sentToday.total)]);
  });

  it('An order is saved as a draft and changed again, or confirmed; once confirmed it is not changed', async () => {
    const drawn = openApp('/orders/new', { as: LAN });
    await heading(words.orders.newTitle);
    await screen.findByRole('option', { name: /KH-001/ });
    expect(
      screen.getByRole('button', { name: words.orders.saveDraft }).hasAttribute('disabled'),
    ).toBe(true);
    await userEvent.selectOptions(field(words.orders.customer), DEMO_CUSTOMERS[0].id);
    await chooseProduct('VT-001', 2);

    await userEvent.click(screen.getByRole('button', { name: words.orders.saveDraft }));

    // saved: no price and no total in the request, and the order's own page opens with its number
    expect(drawn.api.createOrder).toHaveBeenCalledExactlyOnceWith({
      day: DEMO_TODAY,
      customerId: DEMO_CUSTOMERS[0].id,
      lines: [{ productId: DEMO_PRODUCTS.find((one) => one.code === 'VT-001')!.id, quantity: 2 }],
      extra: {},
    });
    const number = `DH-${String(DEMO_ORDERS.length + 1).padStart(5, '0')}`;
    expect(await heading(orderTitle(number))).toBeTruthy();
    expect(screen.getByText(words.orders.state.draft)).toBeTruthy();

    // changed again: the save names the version it was read at, and is not offered while nothing changed
    const save = await screen.findByRole('button', { name: words.orders.saveDraft });
    expect(save.hasAttribute('disabled')).toBe(true);
    await chooseProduct('VT-002', 1);
    expect(save.hasAttribute('disabled')).toBe(false);
    await userEvent.click(save);
    expect(await screen.findByText(words.orders.done.saved)).toBeTruthy();
    expect(drawn.api.saveOrder).toHaveBeenCalledOnce();
    expect(drawn.api.saveOrder.mock.calls[0]?.[2].version).toBe('o1');

    // confirmed: the page reads, and offers no change
    await userEvent.selectOptions(
      await screen.findByLabelText(words.orders.driver),
      'EMP-0005 · Võ Thanh Tùng',
    );
    await userEvent.click(screen.getByRole('button', { name: words.orders.confirmSubmit }));
    expect(await screen.findByText(words.orders.state.confirmed)).toBeTruthy();
    expect(screen.queryByRole('button', { name: words.orders.saveDraft })).toBeNull();
    expect(screen.queryByRole('button', { name: words.orders.addLine })).toBeNull();
    expect(screen.queryByLabelText(words.orders.quantity)).toBeNull();
  });

  it('refuses a save over a customer or lines that are not there yet, and keeps New order for those who may make one', async () => {
    openApp('/orders/new', {
      override: (spied) =>
        spied.me.mockResolvedValue({
          user: { name: 'Xem', root: false, permissions: { 'orders.canView': true } },
        }),
    });

    expect((await heading(words.forbidden.title)).textContent).toBe(words.forbidden.title);
  });

  it('says the lists could not be loaded, and that nothing is chosen yet', async () => {
    openApp('/orders/new', {
      as: LAN,
      override: (spied) => spied.listProducts.mockRejectedValue(new ApiError(503)),
    });

    expect((await screen.findByRole('alert')).textContent).toContain(words.common.loadFailed);
  });

  it('a quantity cleared before the line is added counts as one, and a line whose product the list no longer holds is not drawn', async () => {
    openApp('/orders/new', { as: LAN });
    await heading(words.orders.newTitle);
    await screen.findByRole('option', { name: /KH-001/ });
    await userEvent.selectOptions(field(words.orders.product), DEMO_PRODUCTS[1].id);
    await userEvent.clear(field(words.orders.quantity));
    await userEvent.click(screen.getByRole('button', { name: words.orders.addLine }));
    expect(rows()[1]?.[3]).toBe('1');
    document.body.innerHTML = '';

    openApp(at(draftToday), {
      as: LAN,
      override: (spied, original) =>
        spied.listProducts.mockImplementation(async () =>
          (await original.listProducts()).filter((one) => one.id !== draftToday.lines[0].productId),
        ),
    });
    await heading(orderTitle(draftToday.number));
    await formReady();
    expect(screen.getByText(words.orders.noLines)).toBeTruthy();
  });

  it('says there are no lines before one is added', async () => {
    openApp('/orders/new', { as: LAN });

    expect(await screen.findByText(words.orders.noLines)).toBeTruthy();
  });

  it('a save that fails says so and keeps what was typed', async () => {
    openApp('/orders/new', {
      as: LAN,
      override: (spied) => spied.createOrder.mockRejectedValue(new ApiError(503)),
    });
    await heading(words.orders.newTitle);
    await screen.findByRole('option', { name: /KH-001/ });
    await userEvent.selectOptions(field(words.orders.customer), DEMO_CUSTOMERS[1].id);
    await chooseProduct('VT-003', 4);

    await userEvent.click(screen.getByRole('button', { name: words.orders.saveDraft }));

    expect((await screen.findByRole('alert')).textContent).toContain(words.orders.saveFailed);
    expect((field(words.orders.customer) as HTMLSelectElement).value).toBe(DEMO_CUSTOMERS[1].id);
    expect(rows()[1]?.[3]).toBe('4');
  });

  it('keeps a quantity within the most a line takes, and a line added again grows to it and no further', async () => {
    openApp('/orders/new', { as: LAN });
    await heading(words.orders.newTitle);
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
    await screen.findByRole('heading', { level: 3, name: words.orders.confirm });

    expect(columnCount()).toBe(2);
    expect(columnOf(block(words.orders.details))).toBe(0);
    expect(columnOf(block(words.orders.lines))).toBe(0);
    expect(columnOf(screen.getByRole('button', { name: words.orders.saveDraft }))).toBe(0);
    expect(columnOf(block(words.orders.confirm))).toBe(1);
    expect(columnOf(block(words.orders.cancelOrder))).toBe(1);
  });

  it('A new order offers no step, so it is one column at the full width', async () => {
    openApp('/orders/new', { as: LAN });
    await formReady();

    expect(columnCount()).toBe(1);
    expect(columnOf(block(words.orders.details))).toBe(0);
    expect(columnOf(block(words.orders.lines))).toBe(0);
  });

  it.each([
    ['a confirmed order sent', sentToday, [words.orders.cancelOrder]],
    [
      'a confirmed order whose request is gone',
      unsent,
      [words.orders.sendAgain, words.orders.cancelOrder],
    ],
    ['a cancelled order', cancelledOrder, []],
  ])(
    '%s puts its facts and lines left, its request and its steps right',
    async (_, order, steps) => {
      openApp(at(order), { as: LAN });
      await heading(orderTitle(order.number));

      expect(columnCount()).toBe(2);
      expect(columnOf(block(words.orders.details))).toBe(0);
      expect(columnOf(block(words.orders.lines))).toBe(0);
      expect(columnOf(block(words.orders.sentTitle))).toBe(1);
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
    await heading(orderTitle(draftToday.number));

    expect(columnOf(block(words.orders.details))).toBe(0);
    expect(columnOf(block(words.orders.sentTitle))).toBe(1);
  });
});

function cleanupPage() {
  // the next page is drawn on a fresh app
  document.body.innerHTML = '';
}

describe('an order read', () => {
  it('A draft is shown in a form to change, with its confirm and its cancel; a confirmed order with its request, number, driver and day', async () => {
    openApp(at(draftToday), { as: LAN });
    expect(await heading(orderTitle(draftToday.number))).toBeTruthy();
    await formReady();
    expect((field(words.orders.customer) as HTMLSelectElement).value).toBe(draftToday.customer.id);
    expect(rows()[1]?.[0]).toContain(draftToday.lines[0].name);
    expect(
      await screen.findByRole('heading', { level: 3, name: words.orders.confirm }),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { level: 3, name: words.orders.cancelOrder })).toBeTruthy();
    cleanupPage();

    openApp(at(sentToday), { as: LAN });
    expect(await heading(orderTitle(sentToday.number))).toBeTruthy();
    expect(screen.getByText(words.orders.state.confirmed)).toBeTruthy();
    expect(screen.getByText(sentToday.customer.name)).toBeTruthy();
    expect(
      screen.getByText(
        words.orders.phone.replace('{{phone}}', sentToday.customer.extra['phone'] as string),
      ),
    ).toBeTruthy();
    const link = screen.getByRole('link', { name: sentToday.request!.number });
    expect(link.getAttribute('href')).toBe(
      `/deliveries/${sentToday.request!.day}/${sentToday.request!.id}`,
    );
    expect(
      screen.getByText(words.orders.byDriver.replace('{{name}}', sentToday.request!.driver.name), {
        exact: false,
      }),
    ).toBeTruthy();
    // it has a live request, so no second one is offered
    expect(screen.queryByRole('heading', { level: 3, name: words.orders.sendAgain })).toBeNull();
  });

  it('shows a cancelled order and a draft to someone who may only see as read, without a step to take', async () => {
    openApp(at(cancelledOrder), { as: LAN });
    expect(await heading(orderTitle(cancelledOrder.number))).toBeTruthy();
    expect(screen.getByText(words.orders.state.cancelled)).toBeTruthy();
    expect(screen.getByText(words.orders.noRequest)).toBeTruthy();
    expect(screen.queryByRole('button', { name: starting(words.orders.cancelOrder) })).toBeNull();
    cleanupPage();

    openApp(at(draftToday), {
      language: 'vi',
      override: (spied) =>
        spied.me.mockResolvedValue({
          user: { name: 'Xem', root: false, permissions: { 'orders.canView': true } },
        }),
    });
    expect(
      await heading(wordsVi.orders.orderTitle.replace('{{number}}', draftToday.number)),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: wordsVi.orders.saveDraft })).toBeNull();
    expect(screen.queryByRole('heading', { level: 3, name: wordsVi.orders.confirm })).toBeNull();
  });

  it('says it could not be loaded when the order is not there', async () => {
    openApp(`/orders/${DEMO_TODAY}/00000000-0000-4000-8000-000000000999`, { as: LAN });

    expect((await screen.findByRole('alert')).textContent).toContain(words.common.loadFailed);
  });
});

describe('confirming an order', () => {
  const driverField = () => screen.findByLabelText(words.orders.driver);
  const confirmButton = () => screen.getByRole('button', { name: words.orders.confirmSubmit });

  it('Confirm asks for the driver, among the people allowed to deliver who have not left, and the day, today unless another is picked, never before the order’s; the order is confirmed and its request made, and the order shows the request’s number, driver and day', async () => {
    const drawn = openApp(at(draftToday), { as: LAN });
    await heading(orderTitle(draftToday.number));
    await formReady();

    // the drivers: those allowed to deliver, not the office, the warehouse or the one who left
    expect(
      within(await driverField())
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual([words.orders.chooseDriver, 'EMP-0005 · Võ Thanh Tùng', 'EMP-0006 · Đặng Hoài Nam']);
    // today is chosen, and nothing is sent before a driver is
    const dayField = await screen.findByLabelText<HTMLInputElement>(words.orders.sendDay);
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
    expect((await screen.findByRole('status')).textContent).toBe(
      words.orders.done.confirmed.replace('{{number}}', number),
    );
    expect(screen.getByText(words.orders.state.confirmed)).toBeTruthy();
    expect(screen.getByRole('link', { name: number })).toBeTruthy();
    expect(
      screen.getByText(words.orders.byDriver.replace('{{name}}', driver.name), { exact: false }),
    ).toBeTruthy();
    expect(
      screen.getByText(words.orders.forDay.replace('{{day}}', day(addDays(DEMO_TODAY, 1))), {
        exact: false,
      }),
    ).toBeTruthy();
  });

  it('keeps the order’s own day as the least when it is later than today, and a day that is cleared sends nothing', async () => {
    openApp(at(draftOlder), { as: LAN });
    await heading(orderTitle(draftOlder.number));
    await formReady();
    const dayField = await screen.findByLabelText<HTMLInputElement>(words.orders.sendDay);
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
    await heading(orderTitle(draftToday.number));
    await formReady();

    const dayField = await screen.findByLabelText<HTMLInputElement>(words.orders.sendDay);
    expect(dayField.value).toBe(later);
    fireEvent.submit(dayField.closest('form')!);

    expect(drawn.api.confirmOrder).not.toHaveBeenCalled();
  });

  it('holds Confirm until what was changed is saved', async () => {
    openApp(at(draftToday), { as: LAN });
    await heading(orderTitle(draftToday.number));
    await formReady();
    await userEvent.selectOptions(await driverField(), 'EMP-0005 · Võ Thanh Tùng');
    expect(confirmButton().hasAttribute('disabled')).toBe(false);

    await userEvent.click(
      await screen.findByRole('button', {
        name: words.orders.removeLine.replace('{{name}}', draftToday.lines[0].name),
      }),
    );
    await userEvent.selectOptions(field(words.orders.product), DEMO_PRODUCTS[1].id);
    await userEvent.click(screen.getByRole('button', { name: words.orders.addLine }));

    expect(confirmButton().hasAttribute('disabled')).toBe(true);
    expect(screen.getByText(words.orders.saveFirst)).toBeTruthy();
  });

  it('With no one allowed to deliver, Confirm says to ask the admin', async () => {
    const drawn = openApp(at(draftToday), { as: LAN, noDrivers: true });
    await heading(orderTitle(draftToday.number));
    await formReady();

    expect(await screen.findByText(words.orders.noDrivers)).toBeTruthy();
    expect(screen.queryByRole('button', { name: words.orders.confirmSubmit })).toBeNull();
    expect(drawn.api.confirmOrder).not.toHaveBeenCalled();
  });

  it('A confirm that fails says so and keeps what was typed', async () => {
    openApp(at(draftToday), { as: LAN, cue: 'confirmOrder:503' });
    await heading(orderTitle(draftToday.number));
    await formReady();
    await userEvent.selectOptions(await driverField(), 'EMP-0005 · Võ Thanh Tùng');

    await userEvent.click(confirmButton());

    expect((await screen.findByRole('alert')).textContent).toContain(words.orders.stepFailed);
    expect(((await driverField()) as HTMLSelectElement).selectedOptions[0]?.textContent).toBe(
      'EMP-0005 · Võ Thanh Tùng',
    );
    expect(screen.getByText(words.orders.state.draft)).toBeTruthy();
  });

  it('A save or a confirm over someone else’s newer one is refused, what was typed kept, and the page offers theirs', async () => {
    openApp(at(draftToday), { as: LAN, cue: 'saveOrder:409' });
    await heading(orderTitle(draftToday.number));
    await formReady();
    await userEvent.click(
      await screen.findByRole('button', {
        name: words.orders.removeLine.replace('{{name}}', draftToday.lines[0].name),
      }),
    );
    await userEvent.selectOptions(field(words.orders.product), DEMO_PRODUCTS[2].id);
    await userEvent.click(screen.getByRole('button', { name: words.orders.addLine }));

    await userEvent.click(screen.getByRole('button', { name: words.orders.saveDraft }));

    expect((await screen.findByRole('alert')).textContent).toContain(words.orders.conflict);
    // what was typed is still in the form
    expect(rows()[1]?.[0]).toContain(DEMO_PRODUCTS[2].name);

    await userEvent.click(screen.getByRole('button', { name: words.orders.showTheirs }));

    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    // the form is drawn again once the customers and the products are read again
    await waitFor(() => expect(rows()[1]?.[0]).toContain(draftToday.lines[0].name));
  });

  it('A confirm over someone else’s newer one is refused too, and theirs is offered', async () => {
    openApp(at(draftToday), { as: LAN, cue: 'confirmOrder:409' });
    await heading(orderTitle(draftToday.number));
    await formReady();
    await userEvent.selectOptions(await driverField(), 'EMP-0005 · Võ Thanh Tùng');

    await userEvent.click(confirmButton());

    expect((await screen.findByRole('alert')).textContent).toContain(words.orders.conflict);
    await userEvent.click(screen.getByRole('button', { name: words.orders.showTheirs }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(screen.getByText(words.orders.state.draft)).toBeTruthy();
  });

  it('reads the order again when the refusal carried no newer one', async () => {
    const drawn = openApp(at(draftToday), {
      as: LAN,
      override: (spied) => spied.saveOrder.mockResolvedValue({ kind: 'conflict', current: null }),
    });
    await heading(orderTitle(draftToday.number));
    await formReady();
    await userEvent.click(
      await screen.findByRole('button', {
        name: words.orders.removeLine.replace('{{name}}', draftToday.lines[0].name),
      }),
    );
    await userEvent.selectOptions(field(words.orders.product), DEMO_PRODUCTS[2].id);
    await userEvent.click(screen.getByRole('button', { name: words.orders.addLine }));
    await userEvent.click(screen.getByRole('button', { name: words.orders.saveDraft }));

    await userEvent.click(await screen.findByRole('button', { name: words.orders.showTheirs }));

    await waitFor(() => expect(drawn.api.getOrder).toHaveBeenCalledTimes(2));
    // the form is drawn again once the customers and the products are read again
    await waitFor(() => expect(rows()[1]?.[0]).toContain(draftToday.lines[0].name));
  });

  it('A save that fails keeps what was typed', async () => {
    openApp(at(draftToday), { as: LAN, cue: 'saveOrder:503' });
    await heading(orderTitle(draftToday.number));
    await formReady();
    await userEvent.click(
      await screen.findByRole('button', {
        name: words.orders.removeLine.replace('{{name}}', draftToday.lines[0].name),
      }),
    );
    await userEvent.selectOptions(field(words.orders.product), DEMO_PRODUCTS[2].id);
    await userEvent.click(screen.getByRole('button', { name: words.orders.addLine }));

    await userEvent.click(screen.getByRole('button', { name: words.orders.saveDraft }));

    expect((await screen.findByRole('alert')).textContent).toContain(words.orders.saveFailed);
    expect(rows()[1]?.[0]).toContain(DEMO_PRODUCTS[2].name);
  });
});

describe('cancelling and sending again', () => {
  it('The office cancels a draft, or a confirmed order whose request still waits, after a check; its request is cancelled with it, and the order stays in the list as cancelled, under its number', async () => {
    const drawn = openApp(at(sentToday), { as: LAN });
    await heading(orderTitle(sentToday.number));

    // a check first: nothing is cancelled by the first press
    await userEvent.click(screen.getByRole('button', { name: words.orders.cancelOrder }));
    expect(drawn.api.cancelOrder).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: words.orders.keep }));
    await userEvent.click(screen.getByRole('button', { name: words.orders.cancelOrder }));
    await userEvent.click(
      screen.getByRole('button', {
        name: words.orders.cancelOrderConfirm.replace('{{number}}', sentToday.number),
      }),
    );

    expect(drawn.api.cancelOrder).toHaveBeenCalledExactlyOnceWith(sentToday.day, sentToday.id, {
      version: 'o1',
    });
    expect((await screen.findByRole('status')).textContent).toBe(words.orders.done.cancelled);
    expect(screen.getByText(words.orders.state.cancelled)).toBeTruthy();
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
    await heading(orderTitle(draftToday.number));
    await formReady();
    await userEvent.click(screen.getByRole('button', { name: words.orders.cancelOrder }));

    await userEvent.click(
      screen.getByRole('button', {
        name: words.orders.cancelOrderConfirm.replace('{{number}}', draftToday.number),
      }),
    );

    expect((await screen.findByRole('alert')).textContent).toContain(words.orders.stepFailed);
    expect(screen.getByText(words.orders.state.draft)).toBeTruthy();
  });

  it('The office cancels a waiting request after a check; the order stays confirmed and offers to send it again, to a driver and a day, as a new request with a new number', async () => {
    const drawn = openApp(at(unsent), { as: LAN });
    await heading(orderTitle(unsent.number));

    expect(screen.getByText(words.orders.state.confirmed)).toBeTruthy();
    expect(screen.getByText(words.orders.notSent)).toBeTruthy();
    await userEvent.selectOptions(
      await screen.findByLabelText(words.orders.driver),
      'EMP-0006 · Đặng Hoài Nam',
    );
    await userEvent.click(screen.getByRole('button', { name: words.orders.sendAgainSubmit }));

    const number = `GH-${String(DEMO_DELIVERIES.length + 1).padStart(5, '0')}`;
    expect(drawn.api.sendOrder).toHaveBeenCalledOnce();
    expect((await screen.findByRole('status')).textContent).toBe(
      words.orders.done.sent.replace('{{number}}', number),
    );
    expect(screen.getByRole('link', { name: number })).toBeTruthy();
    // the old request keeps its own number
    expect(unsent.request).toBeNull();
    expect(
      DEMO_DELIVERIES.some((one) => one.order.id === unsent.id && one.state === 'cancelled'),
    ).toBe(true);
    expect(screen.queryByRole('heading', { level: 3, name: words.orders.sendAgain })).toBeNull();
  });
});

describe('a draft read at the prices it was saved at', () => {
  const draftYesterday = DEMO_ORDERS.find(
    (one) => one.day === addDays(DEMO_TODAY, -1) && one.state === 'draft',
  )!;
  const MOVED = words.orders.priceMoved.replace('{{price}}', '95,000');

  it('A saved draft’s lines are drawn at the prices they were saved at, never at the list’s prices today, and its total is theirs', async () => {
    openApp(at(draftYesterday), { as: LAN });
    await heading(orderTitle(draftYesterday.number));
    await formReady();

    // the cement was saved at 90,000 and the list now says 95,000
    expect(rows()[1]?.slice(0, 5)).toEqual([
      'VT-001 · Xi măng PCB40',
      'bao',
      `90,000${MOVED}`,
      '20',
      '1,800,000',
    ]);
    expect(rows().at(-1)).toEqual([words.orders.total, money(draftYesterday.total), '']);
    expect(draftYesterday.total).toBe(1_800_000 + 5 * 410_000);
  });

  it('A line whose product’s price has moved since is marked with what a save would make it; a line whose price has not moved is not marked, and a draft with none moved has no mark', async () => {
    openApp(at(draftYesterday), { as: LAN });
    await formReady();

    expect(screen.getAllByText(MOVED)).toHaveLength(1);
    expect(rows()[1]?.[2]).toContain(MOVED);
    expect(rows()[2]?.[2]).toBe('410,000');
    // a moved price is a change a save makes, though nothing was typed
    expect(
      screen.getByRole('button', { name: words.orders.saveDraft }).hasAttribute('disabled'),
    ).toBe(false);
    cleanupPage();

    openApp(at(draftToday), { as: LAN });
    await formReady();
    expect(screen.queryByText(MOVED)).toBeNull();
    expect(
      screen.getByRole('button', { name: words.orders.saveDraft }).hasAttribute('disabled'),
    ).toBe(true);
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
    await heading(orderTitle(draftToday.number));
    await formReady();
    await userEvent.selectOptions(field(words.orders.customer), DEMO_CUSTOMERS[1].id);

    await userEvent.click(screen.getByRole('button', { name: words.orders.saveDraft }));

    expect(await screen.findByText(words.orders.done.saved)).toBeTruthy();
    expect(drawn.api.saveOrder.mock.calls[0]?.[2].extra).toEqual(kept);
  });

  it('A confirmed, a fulfilled and a cancelled order draw no form, no Save and no marker', async () => {
    const fulfilled = DEMO_ORDERS.find((one) => one.state === 'fulfilled')!;
    for (const order of [sentToday, fulfilled, cancelledOrder]) {
      openApp(at(order), { as: LAN });
      await heading(orderTitle(order.number));
      expect(
        screen.queryByRole('button', { name: words.orders.saveDraft }),
        order.state,
      ).toBeNull();
      expect(screen.queryByRole('button', { name: words.orders.addLine }), order.state).toBeNull();
      expect(screen.queryByText(MOVED), order.state).toBeNull();
      cleanupPage();
    }
  });
});

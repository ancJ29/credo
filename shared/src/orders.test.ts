import { describe, expect, it } from 'vitest';
import {
  DEMO_CUSTOMERS,
  DEMO_DELIVERIES,
  DEMO_DELIVERY_PHOTOS,
  DEMO_ORDERS,
  DEMO_PRODUCTS,
  DEMO_TODAY,
} from './demo';
import {
  addDays,
  daySchema,
  deliveryRequestSchema,
  documentNumberingSchema,
  newestOrdersFirst,
  numberText,
  ORDER_STATES,
  orderSchema,
  priceLines,
  REQUEST_STATES,
  firstSaveOrderRequestSchema,
  resaveOrderRequestSchema,
  saveOrderRequestSchema,
  sendableOn,
  sendOrderRequestSchema,
  TOTAL_MAX,
} from './orders';
import { proofIsValid } from './photo';
import { orderRoutes, deliveryRoutes } from './wire';

const cement = DEMO_PRODUCTS.find((one) => one.code === 'VT-001')!;
const sand = DEMO_PRODUCTS.find((one) => one.code === 'VT-002')!;
const fee = DEMO_PRODUCTS.find((one) => one.code === 'DV-001')!;

describe('an order’s day', () => {
  it('An order’s day is the page’s, a real date; a request’s is on or after it', () => {
    expect(daySchema.safeParse('2026-11-04').success).toBe(true);
    expect(daySchema.safeParse('2028-02-29').success).toBe(true);
    for (const bad of ['2026-02-30', '2026-13-01', '2026-11-4', '04/11/2026', '2026-11-04T10:00']) {
      expect(daySchema.safeParse(bad).success, bad).toBe(false);
    }
    expect(sendableOn('2026-11-04', '2026-11-04')).toBe(true);
    expect(sendableOn('2026-11-04', '2026-11-05')).toBe(true);
    expect(sendableOn('2026-11-04', '2026-11-03')).toBe(false);
    expect(addDays('2026-11-04', -6)).toBe('2026-10-29');
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
  });
});

describe('pricing an order', () => {
  it('A line’s price is the product’s, set by the app, never typed; the total is the sum of the lines, with no VAT, discount or fee beyond a product’s own line (S1’s transport fee is one); a confirmed order keeps its prices and its customer’s name, phone and address as they were', () => {
    const priced = priceLines(
      [
        { productId: cement.id, quantity: 40 },
        { productId: sand.id, quantity: 3 },
        { productId: fee.id, quantity: 1 },
      ],
      DEMO_PRODUCTS,
    );

    expect(priced).toEqual({
      kind: 'priced',
      lines: [
        {
          productId: cement.id,
          code: 'VT-001',
          name: cement.name,
          unit: 'bao',
          price: 95_000,
          quantity: 40,
          amount: 3_800_000,
        },
        {
          productId: sand.id,
          code: 'VT-002',
          name: sand.name,
          unit: 'm³',
          price: 320_000,
          quantity: 3,
          amount: 960_000,
        },
        {
          productId: fee.id,
          code: 'DV-001',
          name: fee.name,
          unit: 'chuyến',
          price: 150_000,
          quantity: 1,
          amount: 150_000,
        },
      ],
      total: 4_910_000,
    });
    // a price or a total in a save is refused, so none is ever typed
    const save = { day: DEMO_TODAY, customerId: DEMO_CUSTOMERS[0].id, extra: {} };
    const line = { productId: cement.id, quantity: 1 };
    expect(saveOrderRequestSchema.safeParse({ ...save, lines: [line] }).success).toBe(true);
    expect(
      saveOrderRequestSchema.safeParse({ ...save, lines: [{ ...line, price: 1 }] }).success,
    ).toBe(false);
    expect(saveOrderRequestSchema.safeParse({ ...save, lines: [line], total: 1 }).success).toBe(
      false,
    );
    // the week of orders keeps each line at the price it was saved at, and the customer whole
    for (const order of DEMO_ORDERS) {
      expect(order.total).toBe(order.lines.reduce((sum, one) => sum + one.amount, 0));
      for (const one of order.lines) expect(one.amount).toBe(one.price * one.quantity);
      expect(order.customer).toEqual(DEMO_CUSTOMERS.find((c) => c.id === order.customer.id));
    }
  });

  it('A first save carries no version and a save again carries the tag it read: a version that is no tag, or one on a first save, is refused', () => {
    const body = {
      day: DEMO_TODAY,
      customerId: DEMO_CUSTOMERS[0].id,
      lines: [{ productId: cement.id, quantity: 1 }],
      extra: {},
    };
    const tag = 'a'.repeat(64);
    expect(firstSaveOrderRequestSchema.safeParse(body).success).toBe(true);
    expect(firstSaveOrderRequestSchema.safeParse({ ...body, version: tag }).success).toBe(false);
    expect(resaveOrderRequestSchema.safeParse({ ...body, version: tag }).success).toBe(true);
    for (const version of [undefined, '', 'x', 'A'.repeat(64), 'a'.repeat(63), 7]) {
      expect(resaveOrderRequestSchema.safeParse({ ...body, version }).success).toBe(false);
    }
  });

  it('A save carries the customer’s id and each line’s product id and quantity (1 to 100,000, 1 to 50 lines); the BFF reads both lists and prices each line; a price or total sent, a product twice, an id not in its list, or a total over 10¹⁵ is a 400', () => {
    const customerId = DEMO_CUSTOMERS[0].id;
    const save = (lines: unknown[]) =>
      saveOrderRequestSchema.safeParse({ day: DEMO_TODAY, customerId, lines, extra: {} }).success;
    const one = { productId: cement.id, quantity: 1 };
    const many = (count: number) =>
      Array.from({ length: count }, (_, i) => ({
        productId: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
        quantity: 1,
      }));

    expect(save([one])).toBe(true);
    expect(save([{ ...one, quantity: 100_000 }])).toBe(true);
    expect(save(many(50))).toBe(true);
    expect(save([])).toBe(false);
    expect(save(many(51))).toBe(false);
    expect(save([{ ...one, quantity: 0 }])).toBe(false);
    expect(save([{ ...one, quantity: 100_001 }])).toBe(false);
    expect(save([{ ...one, quantity: 1.5 }])).toBe(false);
    expect(save([one, { productId: cement.id, quantity: 2 }])).toBe(false);
    expect(priceLines([{ productId: 'nope', quantity: 1 }], DEMO_PRODUCTS)).toEqual({
      kind: 'unknown',
      productId: 'nope',
    });
    const dear = { ...cement, price: 10 ** 12 };
    expect(priceLines([{ productId: cement.id, quantity: 100_000 }], [dear]).kind).toBe(
      'too-large',
    );
    expect(
      priceLines([{ productId: cement.id, quantity: Math.ceil(TOTAL_MAX / 10 ** 12) }], [dear])
        .kind,
    ).toBe('priced');
  });
});

describe('numbers', () => {
  it('Each order has a number from its first save, DH- and five digits, each delivery request its own, GH-; each counts past every number given, a cancelled one’s included, and is never given twice', () => {
    expect(numberText('DH-', 1)).toBe('DH-00001');
    expect(numberText('GH-', 99_999)).toBe('GH-99999');
    expect(numberText('GH-', 100_000)).toBe('GH-100000');
    expect(documentNumberingSchema.safeParse({ orders: 16, requests: 14 }).success).toBe(true);
    // the data set: every order and request has its number once, the cancelled ones among them
    expect(DEMO_ORDERS.map((order) => order.number)).toEqual(
      DEMO_ORDERS.map((_, index) => numberText('DH-', index + 1)),
    );
    expect(new Set(DEMO_DELIVERIES.map((request) => request.number)).size).toBe(
      DEMO_DELIVERIES.length,
    );
    expect(DEMO_DELIVERIES.some((request) => request.state === 'cancelled')).toBe(true);
    expect(orderSchema.safeParse({ ...DEMO_ORDERS[0], number: 'DH-1' }).success).toBe(false);
    expect(
      deliveryRequestSchema.safeParse({ ...DEMO_DELIVERIES[0], number: 'XX-00001' }).success,
    ).toBe(false);
  });
});

describe('the lists and the routes', () => {
  it('The orders’ list is newest first: the later day, then the later number, a sixth digit counting after five', () => {
    const rows = [
      { day: '2026-11-03', number: 'DH-00009' },
      { day: '2026-11-04', number: 'DH-00010' },
      { day: '2026-11-04', number: 'DH-100000' },
      { day: '2026-11-04', number: 'DH-99999' },
    ];

    expect([...rows].sort(newestOrdersFirst).map((row) => row.number)).toEqual([
      'DH-100000',
      'DH-99999',
      'DH-00010',
      'DH-00009',
    ]);
  });

  it('The routes name a record by its day and id, and confirm, send and cancel hang under it', () => {
    expect(orderRoutes.list('2026-10-29', '2026-11-04')).toBe(
      '/api/orders?from=2026-10-29&to=2026-11-04',
    );
    expect(orderRoutes.one('2026-11-04', 'a')).toBe('/api/orders/2026-11-04/a');
    expect(orderRoutes.confirm('2026-11-04', 'a')).toBe('/api/orders/2026-11-04/a/confirm');
    expect(orderRoutes.send('2026-11-04', 'a')).toBe('/api/orders/2026-11-04/a/send');
    expect(orderRoutes.cancel('2026-11-04', 'a')).toBe('/api/orders/2026-11-04/a/cancel');
    expect(deliveryRoutes.list('2026-11-04')).toBe('/api/deliveries?day=2026-11-04');
    expect(deliveryRoutes.one('2026-11-04', 'b')).toBe('/api/deliveries/2026-11-04/b');
    expect(deliveryRoutes.cancel('2026-11-04', 'b')).toBe('/api/deliveries/2026-11-04/b/cancel');
    expect(deliveryRoutes.deliver('2026-11-04', 'b')).toBe('/api/deliveries/2026-11-04/b/deliver');
    expect(deliveryRoutes.photo('2026-11-04', 'b')).toBe('/api/deliveries/2026-11-04/b/photo');
    expect(deliveryRoutes.mine('2026-11-04')).toBe('/api/my-deliveries?day=2026-11-04');
  });

  it('A confirm and a send carry the version read, the driver and the day, and nothing else', () => {
    const ask = {
      version: 'a'.repeat(64),
      driverId: DEMO_DELIVERIES[0].driver.id,
      day: DEMO_TODAY,
    };

    expect(sendOrderRequestSchema.safeParse(ask).success).toBe(true);
    expect(sendOrderRequestSchema.safeParse({ ...ask, total: 1 }).success).toBe(false);
    expect(sendOrderRequestSchema.safeParse({ ...ask, day: '2026-02-30' }).success).toBe(false);
  });
});

describe('the demo week', () => {
  it('One data set gives the fake and the stack’s generator the same week at fixed times; the fake build’s today is the data set’s', () => {
    for (const order of DEMO_ORDERS)
      expect(orderSchema.safeParse(order).data, order.number).toEqual(order);
    for (const request of DEMO_DELIVERIES) {
      expect(deliveryRequestSchema.safeParse(request).data, request.number).toEqual(request);
    }
    const days = DEMO_ORDERS.map((order) => order.day);
    expect(DEMO_TODAY).toBe('2026-11-04');
    expect(Math.max(...days.map((day) => Date.parse(day)))).toBe(Date.parse(DEMO_TODAY));
    expect(days.every((day) => day >= addDays(DEMO_TODAY, -6))).toBe(true);
    // every order is made between 07:30 and 17:30 in Vietnam, at a fixed instant
    for (const order of DEMO_ORDERS) {
      const hour = new Date(order.madeAt + 7 * 3_600_000);
      const minutes = hour.getUTCHours() * 60 + hour.getUTCMinutes();
      expect(minutes, order.number).toBeGreaterThanOrEqual(7 * 60 + 30);
      expect(minutes, order.number).toBeLessThanOrEqual(17 * 60 + 30);
      expect(hour.toISOString().slice(0, 10), order.number).toBe(order.day);
    }
    // a draft has no request, a confirmed order's live request is the one a request names back
    expect(DEMO_ORDERS.some((order) => order.state === 'draft')).toBe(true);
    expect(DEMO_ORDERS.some((order) => order.state === 'cancelled')).toBe(true);
    for (const order of DEMO_ORDERS.filter((one) => one.request)) {
      const request = DEMO_DELIVERIES.find((one) => one.id === order.request!.id)!;
      expect(['waiting', 'delivered']).toContain(request.state);
      expect(request.order).toEqual({ id: order.id, day: order.day, number: order.number });
      expect(sendableOn(order.day, request.day)).toBe(true);
    }
    // today's requests are in more than one driver's hands, one cancelled
    const today = DEMO_DELIVERIES.filter((request) => request.day === DEMO_TODAY);
    expect(new Set(today.map((request) => request.driver.id)).size).toBe(2);
    expect(today.some((request) => request.state === 'cancelled')).toBe(true);
  });
});

describe('the states', () => {
  it('A request’s states are waiting, delivered and cancelled, an order’s draft, confirmed, fulfilled and cancelled; deliveredAt is optional, so a request slice 2 wrote still reads', () => {
    expect(REQUEST_STATES).toEqual(['waiting', 'delivered', 'cancelled']);
    expect(ORDER_STATES).toEqual(['draft', 'confirmed', 'fulfilled', 'cancelled']);
    const waiting = DEMO_DELIVERIES.find((request) => request.state === 'waiting')!;
    expect('deliveredAt' in waiting).toBe(false);
    expect(deliveryRequestSchema.safeParse(waiting).success).toBe(true);
    expect(deliveryRequestSchema.safeParse({ ...waiting, deliveredAt: 1 }).success).toBe(true);
    expect(deliveryRequestSchema.safeParse({ ...waiting, state: 'lost' }).success).toBe(false);
    expect(orderSchema.safeParse({ ...DEMO_ORDERS[0], state: 'fulfilled' }).success).toBe(true);
  });

  it('Each request of a past day is delivered between 14:00 and 17:30 on its day, after it was sent, with one of three drawn photos under 10 KB, and its order is fulfilled; of today’s one was delivered before 10:00 and the rest wait', () => {
    const delivered = DEMO_DELIVERIES.filter((request) => request.state === 'delivered');
    expect(delivered.length).toBeGreaterThan(3);
    for (const request of delivered) {
      const at = new Date(request.deliveredAt! + 7 * 3_600_000);
      expect(at.toISOString().slice(0, 10), request.number).toBe(request.day);
      expect(request.deliveredAt!, request.number).toBeGreaterThan(request.madeAt);
      const order = DEMO_ORDERS.find((one) => one.id === request.order.id)!;
      expect(order.state, request.number).toBe('fulfilled');
      expect(order.request?.id, request.number).toBe(request.id);
      expect(proofIsValid(DEMO_DELIVERY_PHOTOS[request.id]), request.number).toBe(true);
      expect(DEMO_DELIVERY_PHOTOS[request.id].length, request.number).toBeLessThan(10_000);
    }
    const past = DEMO_DELIVERIES.filter((request) => request.day < DEMO_TODAY);
    expect(past.every((request) => ['delivered', 'cancelled'].includes(request.state))).toBe(true);
    for (const request of past.filter((one) => one.state === 'delivered')) {
      const minutes = new Date(request.deliveredAt! + 7 * 3_600_000);
      const total = minutes.getUTCHours() * 60 + minutes.getUTCMinutes();
      expect(total, request.number).toBeGreaterThanOrEqual(14 * 60);
      expect(total, request.number).toBeLessThanOrEqual(17 * 60 + 30);
    }
    const today = DEMO_DELIVERIES.filter((request) => request.day === DEMO_TODAY);
    const early = today.filter((request) => request.state === 'delivered');
    expect(early).toHaveLength(1);
    expect(early[0].deliveredAt!).toBeLessThan(Date.UTC(2026, 10, 4, 3, 0));
    expect(today.filter((request) => request.state === 'waiting').length).toBeGreaterThan(1);
    expect(new Set(Object.values(DEMO_DELIVERY_PHOTOS)).size).toBe(3);
  });
});

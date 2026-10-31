import {
  deliveryDocSchema,
  deliveryRoutes,
  type Driver,
  listImportRoute,
  orderDocSchema,
  orderRoutes,
  ROUTES,
} from '@credo/shared';
import { expect } from 'vitest';
import { type RunningCStorage } from './c-storage';
import { staffTenant } from './staff';

export const DAY = '2026-10-28';

type Record = { id: string; code: string };

/** A tenant with two customers, three products, an office person who may see and make orders, two
 * people who may deliver and the calls an orders test makes as any of them. */
export async function ordersTenant(
  cs: RunningCStorage,
  options: Parameters<typeof staffTenant>[1] = {},
) {
  const t = await staffTenant(cs, options);
  const imported = async <T extends Record>(route: 'customers' | 'products', rows: object[]) => {
    const reply = await t.rootCall.send('POST', listImportRoute(route), { rows });
    expect(reply.statusCode).toBe(200);
    return reply.json<{ results: { kind: string; record: T }[] }>().results.map((r) => r.record);
  };
  const [anh, lan] = await imported<Record>('customers', [
    { code: 'KH-1', name: 'Anh Hùng', extra: { phone: '0901 111 222', address: '12 Lê Lợi' } },
    { code: 'KH-2', name: 'Chị Lan', extra: {} },
  ]);
  const [cement, sand, fee] = await imported<Record>('products', [
    { code: 'VT-1', name: 'Xi măng', unit: 'bao', price: 95000, stocked: true, extra: {} },
    { code: 'VT-2', name: 'Cát xây', unit: 'm³', price: 320000, stocked: true, extra: {} },
    { code: 'DV-1', name: 'Phí vận chuyển', unit: 'lần', price: 50000, stocked: false, extra: {} },
  ]);
  const office = await t.staff('OFFICE', {
    department: { 'orders.canView': true, 'orders.canEdit': true },
  });
  const viewer = await t.staff('VIEWER', { own: { 'orders.canView': true } });
  const driverOne = await t.staff(
    'DRV-1',
    { department: { 'deliveries.canDeliver': true } },
    {},
    { signedIn: false },
  );
  const driverTwo = await t.staff(
    'DRV-2',
    { department: { 'deliveries.canDeliver': true } },
    {},
    { signedIn: false },
  );
  const someone = await t.staff('NOBODY');

  const ids = {
    anh: anh.id,
    lan: lan.id,
    cement: cement.id,
    sand: sand.id,
    fee: fee.id,
  };
  /** A save as the page sends it: a customer and products by id, never a price. */
  const body = (over: object = {}) => ({
    day: DAY,
    customerId: ids.anh,
    lines: [
      { productId: ids.cement, quantity: 10 },
      { productId: ids.sand, quantity: 2 },
    ],
    extra: {},
    ...over,
  });
  type Call = typeof office.call;
  const orderDoc = (reply: { statusCode: number; json: () => unknown }, status = 200) => {
    expect(reply.statusCode).toBe(status);
    return orderDocSchema.parse(reply.json());
  };
  /** A draft made by the office. */
  const made = async (over: object = {}, call: Call = office.call) =>
    orderDoc(await call.send('POST', ROUTES.orders, body(over)), 201);
  const sendBody = (
    doc: { version: string; order: { day: string } },
    driver: { employee: { id: string } } = driverOne,
    over: object = {},
  ) => ({ version: doc.version, driverId: driver.employee.id, day: doc.order.day, ...over });
  /** A draft confirmed to a driver. */
  const confirmed = async (doc: Awaited<ReturnType<typeof made>>, driver = driverOne, over = {}) =>
    orderDoc(
      await office.call.send(
        'POST',
        orderRoutes.confirm(doc.order.day, doc.order.id),
        sendBody(doc, driver, over),
      ),
    );
  const cancelled = async (doc: Awaited<ReturnType<typeof made>>) =>
    orderDoc(
      await office.call.send('POST', orderRoutes.cancel(doc.order.day, doc.order.id), {
        version: doc.version,
      }),
    );
  const read = async (day: string, id: string, call: Call = office.call) =>
    orderDoc(await call.get(orderRoutes.one(day, id)));
  const requestDoc = async (day: string, id: string, call: Call = office.call) => {
    const reply = await call.get(deliveryRoutes.one(day, id));
    expect(reply.statusCode).toBe(200);
    return deliveryDocSchema.parse(reply.json());
  };
  const asDriver = (driver: { employee: { id: string; code: string; name: string } }): Driver => ({
    id: driver.employee.id,
    code: driver.employee.code,
    name: driver.employee.name,
  });
  return {
    t,
    ids,
    office,
    viewer,
    someone,
    driverOne,
    driverTwo,
    body,
    made,
    confirmed,
    cancelled,
    sendBody,
    read,
    requestDoc,
    orderDoc,
    asDriver,
  };
}
export type OrdersTenant = Awaited<ReturnType<typeof ordersTenant>>;

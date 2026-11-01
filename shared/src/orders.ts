import { z } from 'zod';
import { extraInputSchema, extraSchema } from './extra';
import { customerSchema, priceSchema, type Product, unitSchema } from './lists';
import { codeSchema, nameSchema } from './staff';
import { tagSchema } from './wire';

/** A day as an order and a request name it: a real `YYYY-MM-DD`, the office's own calendar day,
 * never an instant. */
export const daySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((day) => {
    const time = Date.parse(`${day}T00:00:00Z`);
    return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === day;
  }, 'a real day');

const DAY_MS = 24 * 60 * 60 * 1000;
/** The day `count` days after (or before, when negative) `day`. */
export const addDays = (day: string, count: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + count * DAY_MS).toISOString().slice(0, 10);

/** The most days of orders one list answers: a week. */
export const ORDER_LIST_DAYS = 7;
/** The largest a quantity, a number of lines and a total are. */
export const QUANTITY_MAX = 100_000;
export const LINES_MAX = 50;
export const TOTAL_MAX = 10 ** 15;

/** `DH-` and five digits for an order, `GH-` for a request; a sixth digit when the fifth is full. */
export const ORDER_PREFIX = 'DH-';
export const REQUEST_PREFIX = 'GH-';
export const numberText = (prefix: string, count: number) =>
  `${prefix}${String(count).padStart(5, '0')}`;
const orderNumberSchema = z.string().regex(/^DH-\d{5,}$/);
const requestNumberSchema = z.string().regex(/^GH-\d{5,}$/);

/** The last number given of each kind. A number lost to a failed write is never given again. */
export const documentNumberingSchema = z.strictObject({
  orders: z.number().int().min(0),
  requests: z.number().int().min(0),
});
export type DocumentNumbering = z.infer<typeof documentNumberingSchema>;

/** A person the office may name as a driver, as an order and a request keep them. */
export const driverSchema = z.strictObject({ id: z.uuid(), code: codeSchema, name: nameSchema });
export type Driver = z.infer<typeof driverSchema>;

const quantitySchema = z.number().int().min(1).max(QUANTITY_MAX);

/** A line as saved: the product as it was at the save, the quantity, and the amount. */
export const orderLineSchema = z.strictObject({
  productId: z.uuid(),
  code: codeSchema,
  name: nameSchema,
  unit: unitSchema,
  price: priceSchema,
  quantity: quantitySchema,
  amount: z.number().int().min(1).max(TOTAL_MAX),
});
export type OrderLine = z.infer<typeof orderLineSchema>;

export const ORDER_STATES = ['draft', 'confirmed', 'cancelled'] as const;
export const orderStateSchema = z.enum(ORDER_STATES);
export type OrderState = z.infer<typeof orderStateSchema>;

/** The live request an order names: where to find it, and who carries it. */
export const requestLinkSchema = z.strictObject({
  id: z.uuid(),
  number: requestNumberSchema,
  day: daySchema,
  driver: driverSchema,
});
export type RequestLink = z.infer<typeof requestLinkSchema>;

/** An order: its customer as at the order, the lines and total priced by the app, and its live
 * request (none for a draft, a cancelled order, or a confirmed one whose request was cancelled). */
export const orderSchema = z.strictObject({
  id: z.uuid(),
  number: orderNumberSchema,
  day: daySchema,
  state: orderStateSchema,
  customer: customerSchema,
  lines: z.array(orderLineSchema).min(1).max(LINES_MAX),
  total: z.number().int().min(1).max(TOTAL_MAX),
  request: requestLinkSchema.nullable(),
  madeAt: z.number(),
  extra: extraSchema,
});
export type Order = z.infer<typeof orderSchema>;

export const REQUEST_STATES = ['waiting', 'cancelled'] as const;
export const requestStateSchema = z.enum(REQUEST_STATES);
export type RequestState = z.infer<typeof requestStateSchema>;

/** A delivery request: the order it was made from, its customer and lines as at the order, and the
 * total to collect. */
export const deliveryRequestSchema = z.strictObject({
  id: z.uuid(),
  number: requestNumberSchema,
  day: daySchema,
  state: requestStateSchema,
  driver: driverSchema,
  order: z.strictObject({ id: z.uuid(), day: daySchema, number: orderNumberSchema }),
  customer: customerSchema,
  lines: z.array(orderLineSchema).min(1).max(LINES_MAX),
  total: z.number().int().min(1).max(TOTAL_MAX),
  madeAt: z.number(),
  extra: extraSchema,
});
export type DeliveryRequest = z.infer<typeof deliveryRequestSchema>;

/** A record with the version it was read at; a write sends it back. */
export const orderDocSchema = z.strictObject({ order: orderSchema, version: z.string() });
export type OrderDoc = z.infer<typeof orderDocSchema>;
export const deliveryDocSchema = z.strictObject({
  request: deliveryRequestSchema,
  version: z.string(),
});
export type DeliveryDoc = z.infer<typeof deliveryDocSchema>;

export const orderListReplySchema = z.strictObject({ orders: z.array(orderSchema) });
export const deliveryListReplySchema = z.strictObject({
  deliveries: z.array(deliveryRequestSchema),
});
export const driverListReplySchema = z.strictObject({ drivers: z.array(driverSchema) });

/** A draft's save: the customer and the lines by id and quantity, never a price or a total. A
 * product twice is refused. `version` is absent for the first save and is the tag read after it. */
export const saveOrderRequestSchema = z.strictObject({
  day: daySchema,
  customerId: z.uuid(),
  lines: z
    .array(z.strictObject({ productId: z.uuid(), quantity: quantitySchema }))
    .min(1)
    .max(LINES_MAX)
    .refine(
      (lines) => new Set(lines.map((line) => line.productId)).size === lines.length,
      'a product once',
    ),
  extra: extraInputSchema,
  version: tagSchema.optional(),
});
export type SaveOrderRequest = z.infer<typeof saveOrderRequestSchema>;

/** Confirming a draft, or sending a confirmed order again: the driver and the day. */
export const sendOrderRequestSchema = z.strictObject({
  version: tagSchema,
  driverId: z.uuid(),
  day: daySchema,
});
export type SendOrderRequest = z.infer<typeof sendOrderRequestSchema>;

/** Cancelling an order or a request over the version read. */
export const cancelRequestSchema = z.strictObject({ version: tagSchema });
export type CancelRequest = z.infer<typeof cancelRequestSchema>;

/** A line's amount, and why an order cannot be priced. */
export type Priced =
  | { kind: 'priced'; lines: OrderLine[]; total: number }
  | { kind: 'unknown'; productId: string }
  | { kind: 'too-large' };

/** The lines priced at the products' prices: each line takes the product's code, name, unit and
 * price as they are now, and the amount is price times quantity; the total is their sum. An id the
 * list lacks, or a total past `TOTAL_MAX`, prices nothing. */
export function priceLines(
  asked: readonly { productId: string; quantity: number }[],
  products: readonly Product[],
): Priced {
  const lines: OrderLine[] = [];
  for (const { productId, quantity } of asked) {
    const product = products.find((candidate) => candidate.id === productId);
    if (!product) return { kind: 'unknown', productId };
    const { id, code, name, unit, price } = product;
    lines.push({ productId: id, code, name, unit, price, quantity, amount: price * quantity });
  }
  const total = lines.reduce((sum, line) => sum + line.amount, 0);
  if (total > TOTAL_MAX) return { kind: 'too-large' };
  return { kind: 'priced', lines, total };
}

/** The orders' list order: the newest day first, and within a day the later number first. */
export const newestOrdersFirst = (a: { day: string; number: string }, b: typeof a) =>
  b.day.localeCompare(a.day) ||
  b.number.length - a.number.length ||
  b.number.localeCompare(a.number);

/** A request is for the order's day or a later one, never before. */
export const sendableOn = (orderDay: string, day: string) => day >= orderDay;

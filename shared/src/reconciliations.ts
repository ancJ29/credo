import { z } from 'zod';
import {
  daySchema,
  type DeliveryRequest,
  driverSchema,
  requestNumberSchema,
  TOTAL_MAX,
} from './orders';
import { codeSchema, nameSchema } from './staff';

/** The cash a driver hands in, in whole đồng from 0. */
export const handedInSchema = z.number().int().min(0).max(TOTAL_MAX);

/** The most requests one driver's day names: the most a day's list reads. */
const REQUESTS_MAX = 1000;

/** A delivered request a closed day covers: where to find it, and what it was to collect. */
const closedRequestSchema = z.strictObject({
  id: z.uuid(),
  number: requestNumberSchema,
  total: z.number().int().min(1).max(TOTAL_MAX),
});

/** Who closed a day: a person (id, code and name), or the root, which holds no person (no id, no
 * code, its sign-in name). */
const closerSchema = z.strictObject({
  id: z.uuid().nullable(),
  code: codeSchema.nullable(),
  name: nameSchema,
});

/** A driver's day closed, one a driver a day, final: the delivered requests it covers, what they
 * were to collect, the cash handed in and the difference (handed in minus to collect, below 0 short,
 * above it over). `closedAt` is the BFF's clock when it was closed; no screen shows it. */
export const reconciliationSchema = z.strictObject({
  day: daySchema,
  driver: driverSchema,
  requests: z.array(closedRequestSchema).max(REQUESTS_MAX),
  toCollect: z.number().int().min(0).max(TOTAL_MAX),
  handedIn: handedInSchema,
  difference: z.number().int(),
  closedBy: closerSchema,
  closedAt: z.number(),
});
export type Reconciliation = z.infer<typeof reconciliationSchema>;

export const reconciliationListReplySchema = z.strictObject({
  reconciliations: z.array(reconciliationSchema),
});

/** Closing a driver's day: the requests the page showed (the delivered, and those still waiting) and
 * the cash. A different set from the day as it now is closes nothing. */
export const closeDayRequestSchema = z.strictObject({
  delivered: z.array(z.uuid()).max(REQUESTS_MAX),
  waiting: z.array(z.uuid()).max(REQUESTS_MAX),
  handedIn: handedInSchema,
});
export type CloseDayRequest = z.infer<typeof closeDayRequestSchema>;

/** One driver's day as a day's requests make it: the delivered, in number order, those still
 * waiting, and the sum to collect, the one place it is made. A cancelled request is left out. */
export function driverDay(requests: readonly DeliveryRequest[], driverId: string) {
  const mine = requests
    .filter((one) => one.driver.id === driverId)
    .sort((a, b) => a.number.localeCompare(b.number));
  const delivered = mine.filter((one) => one.state === 'delivered');
  const waiting = mine.filter((one) => one.state === 'waiting');
  const toCollect = delivered.reduce((sum, one) => sum + one.total, 0);
  return { delivered, waiting, toCollect, tooLarge: toCollect > TOTAL_MAX };
}
type DriverDay = ReturnType<typeof driverDay>;

/** The difference between the cash handed in and what was to be collected. */
export const gapOf = (toCollect: number, handedIn: number) => handedIn - toCollect;

/** The close the page asks for: the requests of the day it shows, and the cash. */
export const closeRequestFor = (day: DriverDay, handedIn: number): CloseDayRequest => ({
  delivered: day.delivered.map((one) => one.id),
  waiting: day.waiting.map((one) => one.id),
  handedIn,
});

/** Whether two lists name the same requests, whatever the order. */
export const sameIds = (a: readonly string[], b: readonly string[]) =>
  [...a].sort().join() === [...b].sort().join();

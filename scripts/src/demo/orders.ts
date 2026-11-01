import { addDays, atMinute, isSunday } from './days';
import { customersOf, productsOf } from './lists';
import { SCENARIOS, type ScenarioId } from './scenarios';
import { type Stream, streamOf } from './stream';

/** How an order ends: left a draft, sent to a driver, or sent and then cancelled. */
type Outcome = 'draft' | 'confirmed' | 'cancelled';

/** An order of a day as the generator plans it, before any record is written: codes for the
 * customer and the products (the BFF mints their ids), and every time in milliseconds. */
export type PlannedOrder = {
  /** The customer's code. */
  customer: string;
  lines: { product: string; quantity: number }[];
  /** When the draft is saved; with the customer, the order's name in the day's list. */
  madeAt: number;
  outcome: Outcome;
  /** When it is sent to a driver, for a sent or cancelled order. */
  sentAt: number;
  /** The day it is sent for: its own, or the next working day. */
  sendFor: string;
  /** Where among the drivers who deliver, in [0, 1), this order's driver is drawn. */
  driverDraw: number;
  /** When a cancelled order is cancelled; 0 for any other. */
  cancelAt: number;
  /** When its driver delivers it, for a sent order that is not cancelled; 0 for any other. */
  deliverAt: number;
  /** Where among the drawn photos, in [0, 1), this delivery's photo is drawn. */
  photoDraw: number;
};

const MINUTE = 60_000;

/** The next working day: the day after, but never a Sunday. */
export function nextWorkingDay(day: string) {
  const next = addDays(day, 1);
  return isSunday(next) ? addDays(next, 1) : next;
}

/** The working day before: the day before, but never a Sunday. */
export function previousWorkingDay(day: string) {
  const before = addDays(day, -1);
  return isSunday(before) ? addDays(before, -1) : before;
}

const within = (s: Stream, [from, to]: [number, number]) => from + s.int(to - from + 1);
/** A moment inside a minute, so two orders of a minute are told apart. */
const secondsOf = (s: Stream) => s.int(60) * 1000;

const lists = new Map<string, ReturnType<typeof listsOf>>();
function listsOf(client: string, scenario: ScenarioId) {
  const products = productsOf(client, scenario);
  return {
    customers: customersOf(client, scenario).map((one) => one.code),
    stocked: products.filter((one) => one.stocked),
    services: products.filter((one) => !one.stocked),
  };
}
const held = (client: string, scenario: ScenarioId) => {
  const key = `${client}\u0000${scenario}`;
  if (!lists.has(key)) lists.set(key, listsOf(client, scenario));
  return lists.get(key)!;
};

/** A day's orders: a pure function of the client, its scenario and the day, none on a Sunday.
 * Most are sent for the day or the next working day and delivered; a few are left drafts, a few
 * cancelled. A delivery falls after its request was sent and before the working day ends. */
export function plannedOrders(client: string, scenario: ScenarioId, day: string): PlannedOrder[] {
  if (isSunday(day)) return [];
  const { orders, deliveries } = SCENARIOS[scenario];
  const { customers, stocked, services } = held(client, scenario);
  const unitOf = new Map([...stocked, ...services].map((one) => [one.code, one.unit]));
  const s = streamOf(client, scenario, 'orders', day);
  const spread = Math.ceil(orders.perDay / 5);
  const count = orders.perDay - spread + s.int(2 * spread + 1);
  const planned = Array.from({ length: count }, (): PlannedOrder => {
    const customer = s.pick(customers);
    const chosen = new Set<string>();
    const wanted = within(s, orders.lines);
    while (chosen.size < wanted) chosen.add(s.pick(stocked).code);
    const codes = [...chosen];
    if (services.length > 0 && s.chance(orders.serviceLine)) codes.push(s.pick(services).code);
    const lines = codes.map((product) => ({
      product,
      quantity: within(s, orders.quantities[unitOf.get(product)!] ?? orders.otherQuantity),
    }));
    const minute = within(s, orders.made);
    const madeAt = atMinute(day, minute) + secondsOf(s);
    const drawn = s.next();
    const outcome: Outcome =
      drawn < orders.draft
        ? 'draft'
        : drawn < orders.draft + orders.cancelled
          ? 'cancelled'
          : 'confirmed';
    const sentAt = madeAt + within(s, orders.toSend) * MINUTE;
    const sendFor =
      minute <= orders.sameDayUntil && !s.chance(orders.heldToNextDay) ? day : nextWorkingDay(day);
    const driverDraw = s.next();
    const cancelAt = sentAt + within(s, orders.toCancel) * MINUTE;
    const deliverAt =
      sendFor === day
        ? sentAt + within(s, deliveries.afterSending) * MINUTE
        : atMinute(sendFor, within(s, deliveries.laterDay)) + secondsOf(s);
    const photoDraw = s.next();
    return {
      customer,
      lines,
      madeAt,
      outcome,
      sentAt: outcome === 'draft' ? 0 : sentAt,
      sendFor,
      driverDraw,
      cancelAt: outcome === 'cancelled' ? cancelAt : 0,
      deliverAt: outcome === 'confirmed' ? deliverAt : 0,
      photoDraw,
    };
  });
  return planned.sort((a, b) => a.madeAt - b.madeAt);
}

/** The requests planned for a day: those sent for it from the working day before and from the day
 * itself, to be delivered, in the order of their delivery times. */
export function plannedDeliveries(client: string, scenario: ScenarioId, day: string) {
  return [previousWorkingDay(day), day]
    .flatMap((made) => plannedOrders(client, scenario, made))
    .filter((order) => order.outcome === 'confirmed' && order.sendFor === day)
    .sort((a, b) => a.deliverAt - b.deliverAt);
}

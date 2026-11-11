import { z } from 'zod';
import { customerSchema } from './lists';

/** How long the back end waits for the audit service before it saves the change anyway and logs
 * the entry as lost: the one bound, read by every call of the client. */
export const AUDIT_TIMEOUT_MS = 600;

/** Every action an entry may carry, to the words the printout shows. One list, declared once. */
export const ACTIONS = {
  'customer.save': 'customer saved',
  'customer.create': 'customer added',
  'customer.import': 'customer imported',
  'product.save': 'product saved',
  'product.create': 'product added',
  'product.import': 'product imported',
  'order.create': 'order made',
  'order.save': 'order saved',
  'order.confirm': 'order confirmed',
  'order.send': 'order sent',
  'order.cancel': 'order cancelled',
  'delivery.deliver': 'delivery done',
  'delivery.cancel': 'delivery cancelled',
  'reconciliation.close': 'day closed for a driver',
  'employee.create': 'person added',
  'employee.import': 'person imported',
  'employee.save': 'person saved',
  'employee.archive': 'person switched off',
  'employee.restore': 'person switched on',
  'employee.password': 'password changed',
  'employee.code': 'code changed',
  'employee.photo': 'photo changed',
  'employee.email': 'email changed',
  'employee.qr': 'QR sign-in issued',
  'staff.setup': 'staff setup saved',
  'config.save': 'settings saved',
  'client.create': 'client made',
  'client.delete': 'client deleted',
  'client.rootPassword': 'root password set',
} as const;
export type ActionId = keyof typeof ACTIONS;

/** What a memo holds, the whole record as stored: `by` is the person's name as it was shown then,
 * `outcome` whether the change stood, and a change that did not has no `after`. A password, a photo
 * or a code's act holds neither record. The memo's one home, since the audit service owns no memo
 * schema. */
export const customerSaveMemoSchema = z.strictObject({
  by: z.string(),
  before: customerSchema.nullable(),
  after: customerSchema.nullable().optional(),
  outcome: z.enum(['saved', 'refused']).optional(),
});

/** An entry as the audit service takes it. */
export type ActivityEntry = {
  clientId: string;
  actorId: string;
  action: ActionId;
  targetId?: string;
  memo: Record<string, unknown>;
  timestamp: string;
};

/** A call to the audit service that did not answer as promised: `status` is the HTTP status, or
 * null when none came (refused, reset, timed out) or its shape was not the one promised. The
 * message never holds a key or a token. */
export class ActivityError extends Error {
  constructor(
    readonly status: number | null,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'ActivityError';
  }
}

type Connection = { fetch?: typeof fetch; timeoutMs?: number };

async function call(
  connection: Connection,
  url: string,
  init: { method: string; headers: Record<string, string>; body?: unknown },
  what: string,
) {
  const { fetch: send = fetch, timeoutMs = AUDIT_TIMEOUT_MS } = connection;
  try {
    return await send(url, {
      method: init.method,
      headers: {
        ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
        ...init.headers,
      },
      body: init.body === undefined ? null : JSON.stringify(init.body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new ActivityError(null, `the audit service did not answer ${what}`, { cause: error });
  }
}

const tokenReplySchema = z.object({ token: z.string().min(1) });

export type ActivityClient = {
  /** Appends the entries in one call; a 201 means committed, anything else throws. */
  log(entries: ActivityEntry[]): Promise<void>;
  /** A read token for one client, for the keyed listener's holder to read with. */
  mintToken(clientId: string): Promise<string>;
};

/** The audit service's keyed listener: its write and its token mint. */
export function createActivityClient(
  connection: Connection & { baseUrl: string; key: string },
): ActivityClient {
  const keyed = { 'x-internal-access-key': connection.key };
  return {
    async log(entries) {
      const what = 'a write';
      const response = await call(
        connection,
        `${connection.baseUrl}/api/activities`,
        { method: 'POST', headers: keyed, body: { activities: entries } },
        what,
      );
      if (response.status !== 201) {
        throw new ActivityError(
          response.status,
          `the audit service answered ${response.status} to ${what}`,
        );
      }
    },
    async mintToken(clientId) {
      const what = 'a token';
      const response = await call(
        connection,
        `${connection.baseUrl}/api/read-tokens`,
        { method: 'POST', headers: keyed, body: { clientId } },
        what,
      );
      if (response.status !== 200) {
        throw new ActivityError(
          response.status,
          `the audit service answered ${response.status} to ${what}`,
        );
      }
      const parsed = tokenReplySchema.safeParse(await response.json().catch(() => null));
      if (!parsed.success)
        throw new ActivityError(null, 'the audit service sent a token in no known shape');
      return parsed.data.token;
    },
  };
}

const readEntrySchema = z.object({
  id: z.string(),
  clientId: z.string(),
  actorId: z.string(),
  action: z.string(),
  targetId: z.string().nullable(),
  memo: z.unknown(),
  createdAt: z.string(),
});
export type ReadEntry = z.infer<typeof readEntrySchema>;

const pageSchema = z.object({ activities: z.array(readEntrySchema) });

/** One record's entries, newest written first, from the open listener under a read token. */
export async function readEntriesByTarget(
  connection: Connection & { readUrl: string; token: string },
  targetId: string,
): Promise<ReadEntry[]> {
  const what = 'a read';
  const response = await call(
    connection,
    `${connection.readUrl}/api/activities/by-target/${encodeURIComponent(targetId)}`,
    { method: 'GET', headers: { authorization: `Bearer ${connection.token}` } },
    what,
  );
  if (response.status !== 200) {
    throw new ActivityError(
      response.status,
      `the audit service answered ${response.status} to ${what}`,
    );
  }
  const parsed = pageSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success)
    throw new ActivityError(null, 'the audit service sent entries in no known shape');
  return parsed.data.activities;
}

/** What every memo carries: who made the change, as shown then, and the record before and after. */
const printedMemoSchema = z.looseObject({
  by: z.string(),
  before: z.unknown().optional(),
  after: z.unknown().optional(),
  outcome: z.enum(['saved', 'refused']).optional(),
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The name a record holds, when it holds one as text. */
const nameOf = (value: unknown) =>
  isRecord(value) && typeof value.name === 'string' ? value.name : null;

/** What changed, in a form every kind of record can carry: `new` for a record made, else the names
 * of the fields whose value differs, never a value. */
function changedFields(before: unknown, after: unknown): string | null {
  if (!isRecord(after)) return null;
  if (!isRecord(before)) return 'new';
  const names = [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]))
    .sort();
  return names.length === 0 ? null : `changed: ${names.join(', ')}`;
}

/** One line of the printout: the time, the person as shown then, what was done, then what changed:
 * `refused` for a change that did not stand, else the name before and after when the record has one,
 * and `new` or the names of the fields that differ. An entry whose memo is in no known shape shows
 * the actor and the action alone. Never a value but a name, so no password, photo, key or token. */
export function entryLine(entry: ReadEntry): string {
  const label = (ACTIONS as Record<string, string>)[entry.action] ?? entry.action;
  const memo = printedMemoSchema.safeParse(entry.memo);
  if (!memo.success) return `${entry.createdAt}  ${entry.actorId}  ${label}`;
  const { by, before, after, outcome } = memo.data;
  const names = [nameOf(before), nameOf(after)];
  const what =
    outcome === 'refused'
      ? ['refused']
      : [
          names.some((name) => name !== null) ? `${names[0] ?? '-'} -> ${names[1] ?? '-'}` : null,
          changedFields(before, after),
        ];
  return [entry.createdAt, by, label, ...what.filter((part) => part !== null)].join('  ');
}

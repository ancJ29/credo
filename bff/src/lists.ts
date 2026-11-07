import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import {
  addCustomerRequestSchema,
  addProductRequestSchema,
  byCode,
  CStorageError,
  type CustomerDoc,
  customerRoutes,
  customerSchema,
  importCallSchema,
  listImportRoute,
  normaliseEmployeeCode,
  productSchema,
  recordKeys,
  ROUTES,
  saveCustomerRequestSchema,
} from '@credo/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { HttpError, parse, replyFor } from './errors';
import type { Deps } from './staff';

/** What one list is to the routes: where its records sit, how a row is read, how a record is
 * checked. The two lists differ in nothing else. */
type ListKind<Record extends { id: string; code: string }> = {
  /** The list's name in a fault, never a key. */
  name: 'customer' | 'product';
  route: string;
  importRoute: string;
  field: 'customers' | 'products';
  prefix: (tenantId: string) => string;
  key: (tenantId: string, id: string) => string;
  record: z.ZodType<Record>;
  /** A row of an import call, read as one add. */
  row: z.ZodType<{ code: string }>;
};

const CUSTOMERS: ListKind<z.infer<typeof customerSchema>> = {
  name: 'customer',
  route: ROUTES.customers,
  importRoute: listImportRoute('customers'),
  field: 'customers',
  prefix: (tenantId) => recordKeys.tenant(tenantId).customerPrefix,
  key: (tenantId, id) => recordKeys.tenant(tenantId).customer(id),
  record: customerSchema,
  row: addCustomerRequestSchema,
};

const PRODUCTS: ListKind<z.infer<typeof productSchema>> = {
  name: 'product',
  route: ROUTES.products,
  importRoute: listImportRoute('products'),
  field: 'products',
  prefix: (tenantId) => recordKeys.tenant(tenantId).productPrefix,
  key: (tenantId, id) => recordKeys.tenant(tenantId).product(id),
  record: productSchema,
  row: addProductRequestSchema,
};

type Result<Record> =
  { kind: 'added'; record: Record } | { kind: 'refused'; reason: 'taken' | 'invalid' | 'busy' };

/** The customers' and the products' routes: whoever may see orders reads a list, and the company's
 * root alone imports into it, checked on the server. A list is read in code order, never short; an import adds each row as
 * one add, one after another, and answers one result for each row. */
export function registerListRoutes(app: FastifyInstance, deps: Deps) {
  const { storage, forClient, signedIn, mustBeRoot, mustCan } = deps;

  function registerList<Record extends { id: string; code: string }>(kind: ListKind<Record>) {
    /** Every record of the list. Never a short list that looks whole: more than c-storage returns,
     * or a record that does not parse, is a 500 that names the kind and not the key. */
    async function everyone(tenantId: string) {
      const listed = await storage.listRecords(kind.prefix(tenantId));
      if (listed.more) throw new Error(`the ${kind.name} list is longer than c-storage returns`);
      return listed.records.map((stored) => {
        const parsed = kind.record.safeParse(stored.data);
        if (!parsed.success) throw new Error(`a ${kind.name} record does not parse`);
        return parsed.data;
      });
    }

    /** One record written once under its fresh id. The write may have landed while its answer was
     * lost: the record is there, or the failure stands. */
    async function write(tenantId: string, record: Record) {
      const key = kind.key(tenantId, record.id);
      let written: 'saved' | 'moved';
      try {
        written = await storage.putRecord(key, record, null);
      } catch (error) {
        if (!(await storage.getRecord(key))) throw error;
        written = 'saved';
      }
      if (written === 'moved') {
        throw new CStorageError(412, 'a record already sat under a fresh id');
      }
    }

    app.get(kind.route, forClient, async (request) => {
      mustCan(await signedIn(request), 'orders.canView');
      const records = await everyone(request.tenantId);
      records.sort(byCode);
      return { [kind.field]: records };
    });

    /** The root's import. A row the add refuses is its result (`invalid`, or `taken` for a code in
     * the list or earlier in the call); a row the store could not answer for (503) is `busy`, to be
     * sent again, and the call goes on. Any other failure ends the call as it would any route: the
     * rows before it stay. */
    app.post(kind.importRoute, forClient, async (request) => {
      mustBeRoot(await signedIn(request));
      const call = parse(importCallSchema, request.body);
      // The list is read once a call, and each code written joins it.
      const codes = new Set((await everyone(request.tenantId)).map((one) => one.code));
      const results: Result<Record>[] = [];
      for (const raw of call.rows) {
        const row = kind.row.safeParse(raw);
        if (!row.success) {
          results.push({ kind: 'refused', reason: 'invalid' });
          continue;
        }
        const code = normaliseEmployeeCode(row.data.code);
        if (codes.has(code)) {
          results.push({ kind: 'refused', reason: 'taken' });
          continue;
        }
        const record = kind.record.parse({ ...row.data, id: randomUUID(), code });
        try {
          await write(request.tenantId, record);
        } catch (error) {
          if (replyFor(error).status !== 503) throw error;
          // The write may have landed with its read-back failed: the code counts as held, so a
          // later row with it is not written a second time.
          codes.add(code);
          results.push({ kind: 'refused', reason: 'busy' });
          continue;
        }
        codes.add(code);
        results.push({ kind: 'added', record });
      }
      return { results };
    });
  }

  registerList(CUSTOMERS);
  registerList(PRODUCTS);

  /** A route's `:id` that is no id names no customer. */
  function idOf(request: FastifyRequest) {
    const id = z.uuid().safeParse((request.params as { id: string }).id);
    if (!id.success) throw new HttpError(404, 'Not found');
    return id.data;
  }

  /** The customer as stored now with its tag; none if the company holds none by that id. */
  async function readCustomer(tenantId: string, id: string): Promise<CustomerDoc | null> {
    const found = await storage.getRecord(CUSTOMERS.key(tenantId, id));
    if (!found) return null;
    const parsed = customerSchema.safeParse(found.data);
    if (!parsed.success) throw new Error('a customer record does not parse');
    return { customer: parsed.data, version: found.tag };
  }

  /** The customer as stored now; a 404 when there is none. */
  async function mustRead(tenantId: string, id: string) {
    const doc = await readCustomer(tenantId, id);
    if (!doc) throw new HttpError(404, 'Not found');
    return doc;
  }

  app.get(customerRoutes.one(':id'), forClient, async (request) => {
    mustCan(await signedIn(request), 'orders.canView');
    return await mustRead(request.tenantId, idOf(request));
  });

  /** A save over the version read: the name and `extra`, the code never. A write the store did
   * not answer, or a version that moved, is read again once: a record that already holds exactly
   * what was asked is our own write landed and counts as saved; anything else is a genuine
   * conflict, answered 409 with the customer as it is now. The version is never skipped. */
  app.put(customerRoutes.one(':id'), forClient, async (request) => {
    mustCan(await signedIn(request), 'orders.canEdit');
    const id = idOf(request);
    const body = parse(saveCustomerRequestSchema, request.body);
    const found = await mustRead(request.tenantId, id);
    const updated = { ...found.customer, name: body.name, extra: body.extra };
    let outcome: 'saved' | 'moved';
    try {
      outcome = await storage.putRecord(CUSTOMERS.key(request.tenantId, id), updated, body.version);
    } catch (error) {
      // The write may have landed with its answer lost: the record is as asked, or the failure stands.
      const now = await readCustomer(request.tenantId, id).catch(() => null);
      // This compare and the `moved` one below hold only while a customer's code and id never
      // change: `updated` spreads `found.customer`, read now, perhaps after another writer. The
      // day a mutable field (a `changeCode`, an `archived` flag, an order's status) joins a record
      // saved this way, another writer's record could count as our own save: re-think this then.
      if (now && isDeepStrictEqual(now.customer, updated)) return now;
      throw error;
    }
    if (outcome === 'saved') return await mustRead(request.tenantId, id);
    const now = await readCustomer(request.tenantId, id);
    if (now && isDeepStrictEqual(now.customer, updated)) return now;
    throw new HttpError(409, 'Conflict', { current: now });
  });
}

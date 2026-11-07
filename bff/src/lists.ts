import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import {
  addCustomerRequestSchema,
  addProductRequestSchema,
  byCode,
  CStorageError,
  customerRoutes,
  customerSchema,
  importCallSchema,
  listImportRoute,
  normaliseEmployeeCode,
  productRoutes,
  productSchema,
  recordKeys,
  ROUTES,
  saveCustomerRequestSchema,
  saveProductRequestSchema,
} from '@credo/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { HttpError, parse, replyFor } from './errors';
import type { Deps } from './staff';

/** What one list is to the routes: where its records sit, how a row is read, how a record is
 * checked, what a save may change. The two lists differ in nothing else. */
type ListKind<Record extends { id: string; code: string }, Save extends { version: string }> = {
  /** The list's name in a fault, never a key. */
  name: 'customer' | 'product';
  route: string;
  /** One record's route, `:id` filled in by the caller. */
  one: (id: string) => string;
  importRoute: string;
  field: 'customers' | 'products';
  prefix: (tenantId: string) => string;
  key: (tenantId: string, id: string) => string;
  record: z.ZodType<Record>;
  /** A row of an import call, read as one add. */
  row: z.ZodType<{ code: string }>;
  /** A save's body: the version read and every value a person may correct, never an id or a
   * code. The route parses with this, so the rule on a value lives in the schema and nowhere else. */
  save: z.ZodType<Save>;
  /** The record a save asks for, built on the one read: the body's values over it. */
  apply: (found: Record, body: Save) => Record;
};

const CUSTOMERS: ListKind<
  z.infer<typeof customerSchema>,
  z.infer<typeof saveCustomerRequestSchema>
> = {
  name: 'customer',
  route: ROUTES.customers,
  one: customerRoutes.one,
  importRoute: listImportRoute('customers'),
  field: 'customers',
  prefix: (tenantId) => recordKeys.tenant(tenantId).customerPrefix,
  key: (tenantId, id) => recordKeys.tenant(tenantId).customer(id),
  record: customerSchema,
  row: addCustomerRequestSchema,
  save: saveCustomerRequestSchema,
  apply: (found, body) => ({ ...found, name: body.name, extra: body.extra }),
};

const PRODUCTS: ListKind<
  z.infer<typeof productSchema>,
  z.infer<typeof saveProductRequestSchema>
> = {
  name: 'product',
  route: ROUTES.products,
  one: productRoutes.one,
  importRoute: listImportRoute('products'),
  field: 'products',
  prefix: (tenantId) => recordKeys.tenant(tenantId).productPrefix,
  key: (tenantId, id) => recordKeys.tenant(tenantId).product(id),
  record: productSchema,
  row: addProductRequestSchema,
  save: saveProductRequestSchema,
  apply: (found, body) => ({
    ...found,
    name: body.name,
    unit: body.unit,
    price: body.price,
    stocked: body.stocked,
    extra: body.extra,
  }),
};

type Result<Record> =
  { kind: 'added'; record: Record } | { kind: 'refused'; reason: 'taken' | 'invalid' | 'busy' };

/** The customers' and the products' routes: whoever may see orders reads a list, and the company's
 * root alone imports into it, checked on the server. A list is read in code order, never short; an import adds each row as
 * one add, one after another, and answers one result for each row. */
export function registerListRoutes(app: FastifyInstance, deps: Deps) {
  const { storage, forClient, signedIn, mustBeRoot, mustCan } = deps;

  function registerList<
    Record extends { id: string; code: string },
    Save extends { version: string },
  >(kind: ListKind<Record, Save>) {
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

    /** A route's `:id` that is no id names no record. */
    function idOf(request: FastifyRequest) {
      const id = z.uuid().safeParse((request.params as { id: string }).id);
      if (!id.success) throw new HttpError(404, 'Not found');
      return id.data;
    }

    /** The record as stored now with its tag, answered as the kind's doc (`{ customer, version }`
     * or `{ product, version }`); none if the company holds none by that id. */
    async function readOne(tenantId: string, id: string) {
      const found = await storage.getRecord(kind.key(tenantId, id));
      if (!found) return null;
      const parsed = kind.record.safeParse(found.data);
      if (!parsed.success) throw new Error(`a ${kind.name} record does not parse`);
      return { record: parsed.data, version: found.tag };
    }
    const docOf = (one: { record: Record; version: string }) => ({
      [kind.name]: one.record,
      version: one.version,
    });

    /** The record as stored now; a 404 when there is none. */
    async function mustRead(tenantId: string, id: string) {
      const one = await readOne(tenantId, id);
      if (!one) throw new HttpError(404, 'Not found');
      return one;
    }

    app.get(kind.one(':id'), forClient, async (request) => {
      mustCan(await signedIn(request), 'orders.canView');
      return docOf(await mustRead(request.tenantId, idOf(request)));
    });

    /** A save over the version read: the values the kind's `apply` takes from the body, the id and
     * the code never. The permission is checked before the body is read. A write the store did
     * not answer, or a version that moved, is read again once: a record that already holds exactly
     * what was asked is our own write landed and counts as saved; anything else is a genuine
     * conflict, answered 409 with the record as it is now. The version is never skipped. */
    app.put(kind.one(':id'), forClient, async (request) => {
      mustCan(await signedIn(request), 'orders.canEdit');
      const id = idOf(request);
      const body = parse(kind.save, request.body);
      const found = await mustRead(request.tenantId, id);
      const updated = kind.apply(found.record, body);
      let outcome: 'saved' | 'moved';
      try {
        outcome = await storage.putRecord(kind.key(request.tenantId, id), updated, body.version);
      } catch (error) {
        // The write may have landed with its answer lost: the record is as asked, or the failure stands.
        const now = await readOne(request.tenantId, id).catch(() => null);
        // This compare and the `moved` one below hold only while a record's code and id never
        // change: `updated` spreads `found.record`, read now, perhaps after another writer, and
        // overwrites every other field with the body's, so only `id` and `code` come from the read.
        // The day a mutable field (a `changeCode`, an `archived` flag, an order's status) joins a
        // record saved this way, another writer's record could count as our own save: re-think
        // this then.
        if (now && isDeepStrictEqual(now.record, updated)) return docOf(now);
        throw error;
      }
      if (outcome === 'saved') return docOf(await mustRead(request.tenantId, id));
      const now = await readOne(request.tenantId, id);
      if (now && isDeepStrictEqual(now.record, updated)) return docOf(now);
      throw new HttpError(409, 'Conflict', { current: now && docOf(now) });
    });
  }

  registerList(CUSTOMERS);
  registerList(PRODUCTS);
}

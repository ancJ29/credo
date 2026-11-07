import {
  type CStorageClient,
  customerSchema,
  listImportRoute,
  productSchema,
  recordKeys,
} from '@credo/shared';
import { describe, expect, it } from 'vitest';
import { applyCopy } from './apply';
import { addDays } from './days';
import { writeLedger } from './ledger';
import { customersOf, productsOf } from './lists';
import {
  A1,
  A2,
  B1,
  fresh,
  make,
  tenantOf,
  hooked,
  down,
  asRoot,
  TODAY,
  useCStorage,
} from './apply-support';

useCStorage();

describe('the copy’s customers and products, written by the first fill', () => {
  const listsOf = async (storage: CStorageClient, code: string) => {
    const keys = recordKeys.tenant(await tenantOf(storage, code));
    const customers = (await storage.listRecords(keys.customerPrefix)).records.map((one) =>
      customerSchema.parse(one.data),
    );
    const products = (await storage.listRecords(keys.productPrefix)).records.map((one) =>
      productSchema.parse(one.data),
    );
    return { customers, products };
  };
  const byCode = (a: { code: string }, b: { code: string }) => (a.code < b.code ? -1 : 1);

  it('row 22: the first fill writes the copy’s customers and products through the import routes, every record parsing, and the same client gives the same lists', async () => {
    const storage = await fresh();
    await make(storage, B1);
    const lines: string[] = [];

    const report = await applyCopy(storage, B1, TODAY, (line) => lines.push(line));

    expect(report.status).toBe('ok');
    const { customers, products } = await listsOf(storage, B1.code);
    const strip = <T extends { id: string }>({ id: _id, ...rest }: T) => rest;
    expect(customers.map(strip).sort(byCode)).toEqual(
      customersOf(B1.client, B1.scenario).sort(byCode),
    );
    expect(products.map(strip).sort(byCode)).toEqual(
      productsOf(B1.client, B1.scenario).sort(byCode),
    );
    expect(products).toHaveLength(251);
    expect(products.filter((one) => !one.stocked)).toHaveLength(1);
    expect(lines).toContain(`${B1.code}: 80 customers added`);
    expect(lines).toContain(`${B1.code}: 251 products added`);
  });

  it('row 22: a copy of the same scenario holds the same lists, since they follow the client', async () => {
    const one = await fresh();
    const other = await fresh();
    await make(one, A1);
    await make(other, A2);

    await applyCopy(one, A1, TODAY);
    await applyCopy(other, A2, TODAY);

    const [first, second] = [await listsOf(one, A1.code), await listsOf(other, A2.code)];
    expect(first.customers.map((c) => c.code).sort()).toEqual(
      second.customers.map((c) => c.code).sort(),
    );
    expect(first.customers.map((c) => c.name).sort()).toEqual(
      second.customers.map((c) => c.name).sort(),
    );
  });

  it('row 22: a fill cut after the people finishes on the next run, a code already there skipped and named, the rest added', async () => {
    const storage = await fresh();
    const made = await make(storage, A1);
    const root = await asRoot(storage, A1.code, made.password);
    const id = await tenantOf(storage, A1.code);
    const firstDay = addDays(TODAY, -7);
    await writeLedger(
      storage,
      id,
      { client: 'A', scenario: 'S1', firstDay, lastDay: addDays(firstDay, -1), filled: false },
      null,
    );
    const first = customersOf(A1.client, A1.scenario)[0];
    const placed = await root('POST', listImportRoute('customers'), {
      rows: [{ code: first.code, name: 'Chỗ đã có', extra: {} }],
    });
    expect(placed.statusCode).toBe(200);

    const report = await applyCopy(storage, A1, TODAY);

    expect(report.status).toBe('ok');
    expect(report.skipped).toContain(`${first.code} is already in the customers`);
    const { customers } = await listsOf(storage, A1.code);
    expect(customers).toHaveLength(30);
    expect(customers.find((one) => one.code === first.code)?.name).toBe('Chỗ đã có');
  });

  it('row 22: a refusal other than a code already there stops the run red, naming the list and the code', async () => {
    const storage = await fresh();
    await make(storage, A1);
    const breaking = hooked(storage, {
      beforePut: (key) => (key.includes('.product.') ? Promise.reject(down()) : Promise.resolve()),
    });

    await expect(applyCopy(breaking, A1, TODAY)).rejects.toThrow(
      /products import refused VT-001: busy/,
    );
  });
});

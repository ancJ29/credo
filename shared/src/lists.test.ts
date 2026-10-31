import { describe, expect, it } from 'vitest';
import {
  DEMO_CUSTOMER_IMPORT_ROWS,
  DEMO_CUSTOMERS,
  DEMO_PRODUCT_IMPORT_ROWS,
  DEMO_PRODUCTS,
} from './demo';
import {
  addCustomerRequestSchema,
  addProductRequestSchema,
  customerListReplySchema,
  customerSchema,
  importCustomersReplySchema,
  importProductsReplySchema,
  PRICE_MAX,
  priceSchema,
  productListReplySchema,
  productSchema,
  UNIT_MAX,
} from './lists';
import { recordKeys } from './records';
import { listImportRoute, ROUTES } from './wire';

const id = '00000000-0000-4000-8000-000000000001';

describe('the customer and the product', () => {
  it('Each customer and product is one record under a minted id, with a code in capitals and a name; a product also a unit and a price in whole đồng; everything else is in `extra`', () => {
    const customer = { id, code: 'KH-1', name: 'Một', extra: { phone: '0900' } };
    const product = {
      id,
      code: 'VT-1',
      name: 'Một',
      unit: 'bao',
      price: 5000,
      stocked: true,
      extra: {},
    };

    expect(customerSchema.safeParse(customer).data).toEqual(customer);
    expect(productSchema.safeParse(product).data).toEqual(product);
    // a record written before `extra` existed reads as having none
    expect(customerSchema.safeParse({ id, code: 'KH-1', name: 'Một' }).data?.extra).toEqual({});
    for (const bad of [
      { ...customer, id: 'not-a-uuid' },
      { ...customer, code: 'kh-1' },
      { ...customer, code: 'K' },
      { ...customer, name: '' },
      { ...customer, phone: '0900' },
    ]) {
      expect(customerSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
    for (const bad of [
      { ...product, unit: '' },
      { ...product, unit: 'x'.repeat(UNIT_MAX + 1) },
      { ...product, price: 0 },
      { ...product, price: 95.5 },
      { ...product, price: PRICE_MAX + 1 },
      { ...product, price: '5000' },
      { ...product, stocked: 'Có' },
      { id, code: 'VT-1', name: 'Một', unit: 'bao', price: 5000, extra: {} },
    ]) {
      expect(productSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
  });

  it('A price is a whole number of đồng from 1 to 10¹²', () => {
    expect([1, 95_000, PRICE_MAX].map((price) => priceSchema.safeParse(price).success)).toEqual([
      true,
      true,
      true,
    ]);
    expect(
      [0, -1, 1.5, PRICE_MAX + 1].map((price) => priceSchema.safeParse(price).success),
    ).toEqual([false, false, false, false]);
  });

  it('A list’s reply holds its records under their own name', () => {
    expect(customerListReplySchema.safeParse({ customers: DEMO_CUSTOMERS }).success).toBe(true);
    expect(productListReplySchema.safeParse({ products: DEMO_PRODUCTS }).success).toBe(true);
    expect(productListReplySchema.safeParse({ customers: [] }).success).toBe(false);
  });
});

describe('the add requests', () => {
  it('A customer needs a code and a name; a product a code, a name, a unit and a price; a code is read in any case and a row missing one is refused', () => {
    const customer = { code: 'kh-1', name: ' Một ', extra: {} };
    const product = {
      code: 'vt-1',
      name: 'Một',
      unit: ' bao ',
      price: 5000,
      stocked: false,
      extra: {},
    };

    expect(addCustomerRequestSchema.safeParse(customer).data).toEqual({
      code: 'kh-1',
      name: 'Một',
      extra: {},
    });
    expect(addProductRequestSchema.safeParse(product).data).toMatchObject({ unit: 'bao' });
    for (const missing of ['code', 'name', 'extra'] as const) {
      const { [missing]: _left, ...rest } = customer;
      expect(addCustomerRequestSchema.safeParse(rest).success, missing).toBe(false);
    }
    for (const missing of ['code', 'name', 'unit', 'price', 'stocked', 'extra'] as const) {
      const { [missing]: _left, ...rest } = product;
      expect(addProductRequestSchema.safeParse(rest).success, missing).toBe(false);
    }
    expect(addCustomerRequestSchema.safeParse({ ...customer, code: 'a b' }).success).toBe(false);
    expect(addProductRequestSchema.safeParse({ ...product, price: 95.5 }).success).toBe(false);
    expect(addCustomerRequestSchema.safeParse({ ...customer, id }).success).toBe(false);
  });
});

describe('the import’s reply', () => {
  it('holds one result for each row, in order: the record added, or why it was not', () => {
    const customer = { id, code: 'KH-1', name: 'Một', extra: {} };
    const reply = {
      results: [
        { kind: 'added', record: customer },
        { kind: 'refused', reason: 'taken' },
        { kind: 'refused', reason: 'invalid' },
        { kind: 'refused', reason: 'busy' },
      ],
    };

    expect(importCustomersReplySchema.safeParse(reply).data).toEqual(reply);
    expect(importProductsReplySchema.safeParse(reply).success).toBe(false);
    expect(
      importCustomersReplySchema.safeParse({ results: [{ kind: 'refused', reason: 'other' }] })
        .success,
    ).toBe(false);
    expect(importCustomersReplySchema.safeParse({ results: [{ kind: 'added' }] }).success).toBe(
      false,
    );
  });
});

describe('the routes and the keys', () => {
  it('Each list is a route, with its import under it, and each record a key of its own under the tenant’s, found by its prefix alone', () => {
    expect(ROUTES.customers).toBe('/api/customers');
    expect(ROUTES.products).toBe('/api/products');
    expect(listImportRoute('customers')).toBe('/api/customers/import');
    expect(listImportRoute('products')).toBe('/api/products/import');
    const tenant = recordKeys.tenant(id);
    expect(tenant.customer('c1')).toBe(`tenant.${id}.customer.c1`);
    expect(tenant.product('p1')).toBe(`tenant.${id}.product.p1`);
    expect(tenant.customer('c1').startsWith(tenant.customerPrefix)).toBe(true);
    expect(tenant.product('p1').startsWith(tenant.productPrefix)).toBe(true);
    // neither prefix finds the other's records, nor a person's
    expect(tenant.product('p1').startsWith(tenant.customerPrefix)).toBe(false);
    expect(tenant.customer('c1').startsWith(tenant.productPrefix)).toBe(false);
    expect(tenant.customer('c1').startsWith(tenant.employeePrefix)).toBe(false);
    expect(tenant.customer('c1').startsWith(tenant.all)).toBe(true);
  });
});

describe('the demo data set’s lists', () => {
  it('One data set gives six customers and seven products the BFF would take, in code order, with the codes used once; every name, phone and address invented', () => {
    expect(DEMO_CUSTOMERS).toHaveLength(6);
    expect(DEMO_PRODUCTS).toHaveLength(7);
    for (const record of DEMO_CUSTOMERS) {
      expect(customerSchema.safeParse(record).data, record.code).toEqual(record);
    }
    for (const record of DEMO_PRODUCTS) {
      expect(productSchema.safeParse(record).data, record.code).toEqual(record);
    }
    for (const list of [DEMO_CUSTOMERS, DEMO_PRODUCTS]) {
      const codes = list.map((record) => record.code);
      expect(codes).toEqual([...codes].sort());
      expect(new Set(codes).size).toBe(codes.length);
      expect(new Set(list.map((record) => record.id)).size).toBe(codes.length);
    }
    expect(new Set([...DEMO_CUSTOMERS, ...DEMO_PRODUCTS].map((record) => record.id)).size).toBe(13);
    // the products are by the bag, the tonne, the thousand and the cubic metre
    expect(new Set(DEMO_PRODUCTS.map((record) => record.unit))).toEqual(
      new Set(['bao', 'm³', 'nghìn viên', 'tấn', 'thùng', 'chuyến']),
    );
    // one is not stocked: a delivery fee, by the trip
    expect(DEMO_PRODUCTS.filter((record) => !record.stocked).map((record) => record.code)).toEqual([
      'DV-001',
    ]);
  });

  it('Each list’s import rows are three that hold, one whose code the list has and one refused', () => {
    const customerCodes = new Set(DEMO_CUSTOMERS.map((record) => record.code));
    const productCodes = new Set(DEMO_PRODUCTS.map((record) => record.code));
    const ask = (row: object) => ({ extra: {}, ...row });

    expect(DEMO_CUSTOMER_IMPORT_ROWS).toHaveLength(5);
    expect(DEMO_CUSTOMER_IMPORT_ROWS.map((row) => customerCodes.has(row.code ?? ''))).toEqual([
      false,
      false,
      false,
      true,
      false,
    ]);
    expect(
      DEMO_CUSTOMER_IMPORT_ROWS.map(
        (row) =>
          addCustomerRequestSchema.safeParse(ask({ code: row.code, name: row.name })).success,
      ),
    ).toEqual([true, true, true, true, false]);
    expect(DEMO_PRODUCT_IMPORT_ROWS).toHaveLength(5);
    expect(DEMO_PRODUCT_IMPORT_ROWS.map((row) => productCodes.has(row.code ?? ''))).toEqual([
      false,
      false,
      false,
      true,
      false,
    ]);
    expect(DEMO_PRODUCT_IMPORT_ROWS.at(-1)?.price).toBe('thương lượng');
  });
});

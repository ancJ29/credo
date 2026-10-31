import {
  addCustomerRequestSchema,
  addProductRequestSchema,
  customerSchema,
  productSchema,
} from '@credo/shared';
import { describe, expect, it } from 'vitest';
import { customersOf, demoFilesOf, productsOf } from './lists';
import { SCENARIO_IDS, SCENARIOS } from './scenarios';

const CLIENT_OF = { S1: 'A', S2: 'B' } as const;

describe('the scenarios’ customers and products', () => {
  it('row 11: S1 has 30 builders and 60 stocked materials plus a transport fee by the trip and rebar cutting by the job, not stocked', () => {
    const customers = customersOf('A', 'S1');
    const products = productsOf('A', 'S1');

    expect(customers).toHaveLength(30);
    expect(products.filter((one) => one.stocked)).toHaveLength(60);
    expect(products.filter((one) => !one.stocked).map(({ name, unit }) => [name, unit])).toEqual([
      ['Cước vận chuyển theo chuyến', 'chuyến'],
      ['Cắt sắt theo việc', 'việc'],
    ]);
    const units = new Set(products.filter((one) => one.stocked).map((one) => one.unit));
    expect([...units].sort()).toEqual(['bao', 'cây', 'm³', 'nghìn viên', 'tấn']);
    expect(customers.every((one) => /^(Nhà thầu|Thầu|Cơ sở|Công ty)/.test(one.name))).toBe(true);
  });

  it('row 11: S2 has 80 grocery shops and 250 stocked drinks and household goods by the carton plus a delivery fee by the trip, not stocked', () => {
    const customers = customersOf('B', 'S2');
    const products = productsOf('B', 'S2');

    expect(customers).toHaveLength(80);
    expect(products.filter((one) => one.stocked)).toHaveLength(250);
    expect(products.filter((one) => !one.stocked)).toMatchObject([
      { name: 'Phí giao hàng theo chuyến', unit: 'chuyến', price: 150000 },
    ]);
    expect(new Set(products.filter((one) => one.stocked).map((one) => one.unit))).toEqual(
      new Set(['thùng']),
    );
  });

  it.each(SCENARIO_IDS)(
    'row 11: every %s row is invented and holds: codes and names once, a phone in the range no operator assigns, and every row parses under the schemas the BFF reads it with',
    (scenario) => {
      const client = CLIENT_OF[scenario];
      const customers = customersOf(client, scenario);
      const products = productsOf(client, scenario);

      expect(new Set(customers.map((one) => one.code)).size).toBe(customers.length);
      expect(new Set(customers.map((one) => one.name)).size).toBe(customers.length);
      expect(new Set(products.map((one) => one.code)).size).toBe(products.length);
      expect(new Set(products.map((one) => one.name)).size).toBe(products.length);
      expect(customers.every((one) => one.extra.phone.startsWith('0600 '))).toBe(true);
      for (const one of customers) {
        expect(addCustomerRequestSchema.safeParse(one).success).toBe(true);
        expect(customerSchema.safeParse({ id: crypto.randomUUID(), ...one }).success).toBe(true);
      }
      for (const one of products) {
        expect(addProductRequestSchema.safeParse(one).success).toBe(true);
        expect(productSchema.safeParse({ id: crypto.randomUUID(), ...one }).success).toBe(true);
      }
    },
  );

  it('row 11: the same client and scenario give the same lists, another client other ones', () => {
    expect(customersOf('A', 'S1')).toEqual(customersOf('A', 'S1'));
    expect(productsOf('A', 'S1')).toEqual(productsOf('A', 'S1'));
    expect(customersOf('A2', 'S1')).not.toEqual(customersOf('A', 'S1'));
    expect(productsOf('A2', 'S1').map((one) => one.price)).not.toEqual(
      productsOf('A', 'S1').map((one) => one.price),
    );
  });

  it('row 15: no list of any scenario passes 500 records, and each has room for the demo file’s eight new rows', () => {
    for (const scenario of SCENARIO_IDS) {
      const { customers, products, services } = SCENARIOS[scenario].lists;
      expect(customers + 10).toBeLessThanOrEqual(500);
      expect(products + services.length + 10).toBeLessThanOrEqual(500);
    }
  });
});

describe('the demo’s files for the presenter’s step 2', () => {
  it.each(SCENARIO_IDS)(
    'row 11: %s’s customers’ file has eight new rows, one whose code the list holds, and one with no name',
    (scenario) => {
      const client = CLIENT_OF[scenario];
      const held = customersOf(client, scenario);
      const { customers } = demoFilesOf(client, scenario, 'vi');

      expect(customers).toHaveLength(10);
      const heldCodes = new Set(held.map((one) => one.code));
      const heldNames = new Set(held.map((one) => one.name));
      expect(customers.filter((row) => row.code && heldCodes.has(row.code))).toEqual([
        expect.objectContaining({ code: held[1].code }),
      ]);
      const fresh = customers.filter((row) => row.name && !heldCodes.has(row.code ?? ''));
      expect(fresh).toHaveLength(8);
      expect(fresh.every((row) => !heldNames.has(row.name ?? ''))).toBe(true);
      expect(new Set(fresh.map((row) => row.code)).size).toBe(8);
      expect(customers.filter((row) => !row.name)).toHaveLength(1);
    },
  );

  it.each(SCENARIO_IDS)(
    'row 11: %s’s products’ file has eight new rows, one whose code the list holds, and one whose price is no price, in either language',
    (scenario) => {
      const client = CLIENT_OF[scenario];
      const held = productsOf(client, scenario);
      for (const language of ['vi', 'en'] as const) {
        const { products } = demoFilesOf(client, scenario, language);

        expect(products).toHaveLength(10);
        const heldCodes = new Set(held.map((one) => one.code));
        const heldNames = new Set(held.map((one) => one.name));
        expect(products.filter((row) => heldCodes.has(row.code ?? ''))).toHaveLength(1);
        const fresh = products.filter(
          (row) => !heldCodes.has(row.code ?? '') && /^\d/.test(row.price ?? ''),
        );
        expect(fresh).toHaveLength(8);
        expect(fresh.every((row) => !heldNames.has(row.name ?? ''))).toBe(true);
        expect(products.at(-1)?.price).toBe(language === 'en' ? 'negotiable' : 'thương lượng');
        expect(fresh.some((row) => row.stocked === (language === 'en' ? 'No' : 'Không'))).toBe(
          true,
        );
      }
    },
  );
});

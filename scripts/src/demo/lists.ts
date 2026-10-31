import { type ProductFamily, SCENARIOS, type ScenarioId } from './scenarios';
import { phone, uniqueName } from './staff';
import { type Stream, streamOf } from './stream';

/** A customer as the import route takes it: the BFF trusts the code and the name, the rest is the
 * company's own and goes in `extra`. */
export type CustomerRow = {
  code: string;
  name: string;
  extra: { phone: string; address: string; note?: string };
};

/** A product as the import route takes it. */
export type ProductRow = {
  code: string;
  name: string;
  unit: string;
  price: number;
  stocked: boolean;
  extra: { note?: string };
};

const STREETS = [
  'đường Số 3',
  'đường Số 7',
  'đường Số 12',
  'đường Số 21',
  'hẻm 45 đường Số 9',
  'Tỉnh lộ 10',
  'Quốc lộ 1A',
  'đường Liên Ấp 2-3',
  'đường Nội Bộ 5',
  'khu phố 4',
];
const WARDS = ['Phường 3', 'Phường 8', 'Phường 11', 'Xã Tân Thới', 'Xã Vĩnh Lộc', 'Thị trấn Mới'];
const DISTRICTS = ['Quận 12', 'Quận 7', 'Huyện Bình Chánh', 'Huyện Hóc Môn', 'Thành phố Mẫu'];
const NOTES = ['Thanh toán cuối tháng.', 'Giao buổi sáng.', 'Gọi trước khi giao.'];
const PRODUCT_NOTES = [
  'Hàng nặng, cần xe tải.',
  'Giá theo bảng giá tháng.',
  'Bán theo thùng nguyên.',
];

const address = (s: Stream) =>
  `${1 + s.int(280)} ${s.pick(STREETS)}, ${s.pick(WARDS)}, ${s.pick(DISTRICTS)}`;

/** The code with its number in at least three digits. */
const codeOf = (prefix: string, number: number) => `${prefix}${String(number).padStart(3, '0')}`;

/** A customer: a shop or a builder under its owner's invented name. */
function makeCustomer(
  scenario: ScenarioId,
  s: Stream,
  taken: Set<string>,
  number: number,
): CustomerRow {
  const { customerKinds, customerPrefix } = SCENARIOS[scenario].lists;
  const name = `${s.pick(customerKinds)} ${uniqueName(s, taken)}`;
  const extra: CustomerRow['extra'] = { phone: phone(s), address: address(s) };
  if (s.chance(0.15)) extra.note = s.pick(NOTES);
  return { code: codeOf(customerPrefix, number), name, extra };
}

/** Every combination of a family's variants and sizes, named `noun variant size`, with a price
 * drawn in steps of 500 from the family's range. */
function combinations(family: ProductFamily, s: Stream) {
  const steps = Math.floor((family.to - family.from) / 500) + 1;
  return family.variants.flatMap((variant) =>
    family.sizes.map((size) => ({
      name: `${family.noun} ${variant} ${size}`,
      unit: family.unit,
      price: family.from + 500 * s.int(steps),
    })),
  );
}

const allCombinations = (client: string, scenario: ScenarioId) => {
  const s = streamOf(client, scenario, 'products', 'prices');
  return SCENARIOS[scenario].lists.families.flatMap((family) => combinations(family, s));
};

/** The company's customers, and the owners' names they carry. */
function customerBatch(client: string, scenario: ScenarioId) {
  const s = streamOf(client, scenario, 'customers');
  const taken = new Set<string>();
  const rows = Array.from({ length: SCENARIOS[scenario].lists.customers }, (_, at) =>
    makeCustomer(scenario, s, taken, at + 1),
  );
  return { rows, taken };
}

/** The company's customers: a pure function of the client and its scenario. */
export const customersOf = (client: string, scenario: ScenarioId) =>
  customerBatch(client, scenario).rows;

/** The company's products: the stocked ones, drawn from the combinations without repeating a name
 * and kept in the families' order, then the services, whose stock is not kept. */
export function productsOf(client: string, scenario: ScenarioId): ProductRow[] {
  const { products, productPrefix, services } = SCENARIOS[scenario].lists;
  const s = streamOf(client, scenario, 'products', 'chosen');
  const pool = allCombinations(client, scenario).map((combination, at) => ({ combination, at }));
  const chosen: typeof pool = [];
  while (chosen.length < products) {
    chosen.push(...pool.splice(s.int(pool.length), 1));
  }
  chosen.sort((a, b) => a.at - b.at);
  const stocked: ProductRow[] = chosen.map(({ combination }, at) => ({
    code: codeOf(productPrefix, at + 1),
    ...combination,
    stocked: true,
    extra: s.chance(0.1) ? { note: s.pick(PRODUCT_NOTES) } : {},
  }));
  return [
    ...stocked,
    ...services.map((service, at) => ({
      code: codeOf(productPrefix, products + at + 1),
      ...service,
      stocked: false,
      extra: {},
    })),
  ];
}

/** The cells of one row of a demo file, as the template's columns take them. */
type FileRow = Partial<
  Record<'code' | 'name' | 'phone' | 'address' | 'unit' | 'price' | 'stocked' | 'note', string>
>;

/** The two files the presenter chooses in the demo's step 2, for one client: each list's ten rows,
 * eight new, one whose code the company's list has already, and one that is refused (a customer
 * with no name; a product whose price is no price). The new ones are not in the company's list. */
export function demoFilesOf(client: string, scenario: ScenarioId, language: 'vi' | 'en') {
  const lists = SCENARIOS[scenario].lists;
  const { rows: held, taken } = customerBatch(client, scenario);
  const s = streamOf(client, scenario, 'file', 'customers');
  const fresh = Array.from({ length: 8 }, (_, at) =>
    makeCustomer(scenario, s, taken, lists.customers + at + 1),
  );
  const customers: FileRow[] = [...fresh.slice(0, 3), held[1], ...fresh.slice(3)].map(
    ({ code, name, extra }) => ({
      code,
      name,
      phone: extra.phone,
      address: extra.address,
      ...(extra.note ? { note: extra.note } : {}),
    }),
  );
  customers.push({ code: codeOf(lists.customerPrefix, lists.customers + 9), name: '', phone: '' });

  const ps = streamOf(client, scenario, 'file', 'products');
  const listed = productsOf(client, scenario);
  const names = new Set(listed.map((one) => one.name));
  const pool = allCombinations(client, scenario).filter((one) => !names.has(one.name));
  const news = Array.from({ length: 8 }, (_, at) => ({
    code: codeOf(lists.productPrefix, listed.length + at + 1),
    ...pool.splice(ps.int(pool.length), 1)[0],
  }));
  const typed = (price: number, at: number) =>
    at % 2 === 0 ? String(price) : new Intl.NumberFormat('de-DE').format(price);
  const yes = language === 'en' ? 'Yes' : 'Có';
  const no = language === 'en' ? 'No' : 'Không';
  const product = (
    one: { code: string; name: string; unit: string; price: number },
    at: number,
  ) => ({
    code: one.code,
    name: one.name,
    unit: one.unit,
    price: typed(one.price, at),
    // An empty stocked cell reads yes; the last new row says its stock is not kept.
    stocked: at === 7 ? no : at % 3 === 0 ? yes : '',
  });
  const products: FileRow[] = news.map(product);
  products.splice(3, 0, {
    code: listed[1].code,
    name: listed[1].name,
    unit: listed[1].unit,
    price: String(listed[1].price),
  });
  products.push({
    code: codeOf(lists.productPrefix, listed.length + 9),
    name: pool[0].name,
    unit: pool[0].unit,
    price: language === 'en' ? 'negotiable' : 'thương lượng',
  });
  return { customers, products };
}

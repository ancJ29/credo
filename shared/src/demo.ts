import type { TenantConfig } from './config';
import { DEMO_PROOFS } from './demo-proofs';
import type { CustomField } from './fields';
import type { Customer, Product } from './lists';
import {
  addDays,
  type DeliveryRequest,
  type Driver,
  type Order,
  type OrderState,
  numberText,
  ORDER_PREFIX,
  type Priced,
  priceLines,
  REQUEST_PREFIX,
  type RequestState,
} from './orders';
import { driverDay, type Reconciliation } from './reconciliations';
import type { Employee, StaffSetup, UnitLink } from './staff';

const logo = `data:image/svg+xml;base64,${btoa(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="10" fill="#2f7d6d"/><path d="M13 33V15l11 12 11-12v18" fill="none" stroke="#fff" stroke-width="4" stroke-linejoin="round"/></svg>',
)}`;

/** An invented company, never a client's. Fixed, so every walk starts from the same screens. The
 * one data set that seeds both the fake `Api` and the stack's generator. */
export const DEMO_CONFIG: TenantConfig = {
  name: 'Minh Phát',
  logo,
  colour: '#2f7d6d',
  whiteHeader: false,
  whiteMenu: false,
  menuIcons: false,
  languages: ['vi', 'en'],
  defaultLanguage: 'vi',
};

export const DEMO_CODE = 'demo';
/** The name the demo company's root signs in with: the BFF's own root name. */
export const DEMO_ROOT_NAME = 'root';
export const OPERATOR_NAME = 'operator';
/** The operator's minted id, which a passkey's answer names. */
export const DEMO_OPERATOR_ID = '00000000-0000-4000-8000-000000000201';
/** The data set's active colleague, whose new link and delete the walk shows. */
export const DEMO_COLLEAGUE_ID = '00000000-0000-4000-8000-000000000203';
/** The operator the join link in the data set is for: invited, with no passkey yet. */
export const DEMO_INVITED_NAME = 'Lan Anh';
/** That link's token, 43 characters in the token's form. */
export const DEMO_JOIN_TOKEN = 'demo-join-link-for-the-fake-run-00000000000';

/** The operator's own passkeys, a laptop's and a phone's, one never used. Each is made at noon UTC,
 * so its day reads the same in every zone from UTC-11 to UTC+11. */
export const DEMO_PASSKEYS: { id: string; addedAt: number; lastUsedAt: number | null }[] = [
  {
    // The id is a credential's, base64url of 'demo-passkey-laptop', so a device that holds it answers
    // with the id the BFF stored (a walk touches this one through the stack's `CREDO_OPERATOR_PASSKEY`).
    id: 'ZGVtby1wYXNza2V5LWxhcHRvcA',
    addedAt: Date.UTC(2026, 9, 5, 12),
    lastUsedAt: Date.UTC(2026, 9, 28, 12),
  },
  { id: 'demo-passkey-phone', addedAt: Date.UTC(2026, 9, 25, 12), lastUsedAt: null },
];

/** The operators the roster page shows, as the operator is shown them: the operator themselves, made
 * by the command line; a colleague added by an operator since deleted (no adder shown); and the
 * invited one the join link is for. Each time is noon UTC, like every time here. */
export const DEMO_TEAM: {
  id: string;
  name: string;
  state: 'invited' | 'active';
  addedBy: string | null;
  addedByTerminal: boolean;
  addedAt: number;
  passkeys: number;
  signedInAt: number | null;
}[] = [
  {
    id: DEMO_OPERATOR_ID,
    name: OPERATOR_NAME,
    state: 'active',
    addedBy: null,
    addedByTerminal: true,
    addedAt: Date.UTC(2026, 9, 5, 12),
    passkeys: 2,
    signedInAt: Date.UTC(2026, 9, 30, 12),
  },
  {
    id: DEMO_COLLEAGUE_ID,
    name: 'Minh Quân',
    state: 'active',
    addedBy: null,
    addedByTerminal: false,
    addedAt: Date.UTC(2026, 9, 12, 12),
    passkeys: 1,
    signedInAt: Date.UTC(2026, 9, 27, 12),
  },
  {
    id: '00000000-0000-4000-8000-000000000202',
    name: DEMO_INVITED_NAME,
    state: 'invited',
    addedBy: OPERATOR_NAME,
    addedByTerminal: false,
    addedAt: Date.UTC(2026, 9, 29, 12),
    passkeys: 0,
    signedInAt: null,
  },
];

/** The clients the operator's list shows: the demo company and two more invented ones, never a
 * real client's. Each time is noon UTC, so its day reads the same in every zone from UTC-11 to
 * UTC+11. */
export const DEMO_CLIENTS: { code: string; name: string; madeAt: number }[] = [
  { code: DEMO_CODE, name: DEMO_CONFIG.name, madeAt: Date.UTC(2026, 8, 14, 12) },
  { code: 'hoa-sen', name: 'Hoa Sen', madeAt: Date.UTC(2026, 9, 2, 12) },
  { code: 'binh-an', name: 'Bình An', madeAt: Date.UTC(2026, 9, 21, 12) },
];

/** The services the status page shows, fixed at their source so the fake's screens and the stack's
 * read the same: one build for the app, the BFF and c-storage (the commit they were built from,
 * as a short hash); how long the BFF and c-storage took; and when it was last checked, at noon UTC
 * like every time here. `driftBuild` is c-storage's when a deploy is half done: it ships first. */
export const DEMO_SERVICES = {
  build: '4e1a9c7',
  driftBuild: 'b72d0f3',
  bffMs: 42,
  storageMs: 7,
  checkedAt: Date.UTC(2026, 9, 31, 12),
};

/** The secret of the QR code the data set holds for one person, whose link the phone's walk opens. */
export const DEMO_QR_SECRET = 'fake-qr-secret-0001';
/** The same for the driver `EMP-0005`, whose link the driver's walk opens on the fake. */
export const DEMO_DRIVER_QR_SECRET = 'fake-qr-secret-0005';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const DEPARTMENTS = { warehouse: id(1), office: id(2), delivery: id(3) };
const POSITIONS = { manager: id(11), staff: id(12), trainee: id(13) };

/** The company's own fields: one of each kind, the choice and the date shown in the list. */
export const DEMO_CUSTOM_FIELDS: CustomField[] = [
  {
    key: 'licence',
    label: { vi: 'Bằng lái xe', en: 'Driving licence' },
    kind: 'choice',
    options: [
      { value: 'b2', label: { vi: 'Hạng B2', en: 'Class B2' } },
      { value: 'c', label: { vi: 'Hạng C', en: 'Class C' } },
    ],
    inList: true,
  },
  {
    key: 'started',
    label: { vi: 'Ngày ký hợp đồng', en: 'Contract date' },
    kind: 'date',
    options: [],
    inList: true,
  },
  {
    key: 'plate',
    label: { vi: 'Biển số xe', en: 'Vehicle plate' },
    kind: 'text',
    options: [],
    inList: false,
  },
  {
    key: 'dependants',
    label: { vi: 'Số người phụ thuộc', en: 'Dependants' },
    kind: 'number',
    options: [],
    inList: false,
  },
];

/** The demo company's departments and positions, with what each may do, the second phone and the
 * photo switched on, its own fields and its numbering. */
export const DEMO_STAFF_SETUP: StaffSetup = {
  departments: [
    { id: DEPARTMENTS.warehouse, name: 'Kho', permissions: { 'staff.canView': true }, extra: {} },
    {
      id: DEPARTMENTS.office,
      name: 'Văn phòng',
      permissions: {
        'staff.canView': true,
        'staff.canCreate': true,
        'staff.canEdit': true,
        'orders.canView': true,
        'orders.canEdit': true,
      },
      extra: {},
    },
    {
      id: DEPARTMENTS.delivery,
      name: 'Giao hàng',
      permissions: { 'deliveries.canDeliver': true },
      extra: {},
    },
  ],
  positions: [
    { id: POSITIONS.manager, name: 'Quản lý', permissions: { 'staff.canDelete': true }, extra: {} },
    { id: POSITIONS.staff, name: 'Nhân viên', permissions: {}, extra: {} },
    {
      id: POSITIONS.trainee,
      name: 'Thực tập',
      permissions: { 'staff.canEdit': false },
      extra: {},
    },
  ],
  fields: {
    personalPhone: true,
    photo: true,
    startDate: true,
    birthDate: true,
    address: true,
  },
  customFields: DEMO_CUSTOM_FIELDS,
  numbering: { prefix: 'EMP-', digits: 4 },
  extra: {},
};

/** A flat one-pixel image, the one invented photo: the data set's photos by person. */
const PHOTO =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const link = ({ id: unit, name }: { id: string; name: string }) => ({ id: unit, name });
const [warehouse, office, delivery] = DEMO_STAFF_SETUP.departments.map(link) as [
  UnitLink,
  UnitLink,
  UnitLink,
];
const [manager, staff, trainee] = DEMO_STAFF_SETUP.positions.map(link) as [
  UnitLink,
  UnitLink,
  UnitLink,
];

/** About eight invented people, with phones and notes: the office's manager, two with permissions
 * of their own, one who left, one in no department; some with the company's own fields. */
export const DEMO_EMPLOYEES: Employee[] = [
  {
    id: id(101),
    code: 'EMP-0001',
    name: 'Nguyễn Thị Lan',
    department: office,
    position: manager,
    permissions: {},
    archived: false,
    extra: {
      phone: '0903 111 001',
      note: 'Phụ trách nhân sự.',
      startDate: '2022-02-14',
      birthDate: '1988-06-09',
      address: '12 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh',
    },
  },
  {
    id: id(102),
    code: 'EMP-0002',
    name: 'Trần Văn Hùng',
    department: office,
    position: staff,
    permissions: { 'staff.canDelete': true },
    archived: false,
    extra: { phone: '0903 111 002', note: 'Được lưu trữ nhân viên, theo lời quản lý.' },
  },
  {
    id: id(103),
    code: 'EMP-0003',
    name: 'Lê Minh Châu',
    department: warehouse,
    position: manager,
    permissions: { 'settings.canEdit': true },
    archived: false,
    extra: {
      phone: '0903 111 003',
      started: '2024-03-04',
      startDate: '2024-03-04',
      birthDate: '1991-11-23',
    },
  },
  {
    id: id(104),
    code: 'EMP-0004',
    name: 'Phạm Quốc Bảo',
    department: warehouse,
    position: staff,
    permissions: {},
    archived: false,
    extra: { phone: '0903 111 004', personalPhone: '0903 222 004' },
  },
  {
    id: id(105),
    code: 'EMP-0005',
    name: 'Võ Thanh Tùng',
    department: delivery,
    position: staff,
    permissions: {},
    archived: false,
    extra: {
      phone: '0903 111 005',
      note: 'Lái xe tải nhỏ.',
      licence: 'c',
      started: '2023-08-21',
      startDate: '2023-08-21',
      birthDate: '1985-01-30',
      address: '45 Lê Lợi, Quận 3, TP. Hồ Chí Minh',
      plate: '51C-123.45',
      dependants: 2,
    },
  },
  {
    id: id(106),
    code: 'EMP-0006',
    name: 'Đặng Hoài Nam',
    department: delivery,
    position: trainee,
    permissions: {},
    archived: false,
    extra: { phone: '0903 111 006', licence: 'b2', started: '2026-09-01' },
  },
  {
    id: id(107),
    code: 'EMP-0007',
    name: 'Bùi Ngọc Anh',
    department: null,
    position: null,
    permissions: {},
    archived: false,
    extra: { phone: '0903 111 007', note: 'Chưa xếp phòng ban.' },
  },
  {
    id: id(108),
    code: 'EMP-0008',
    name: 'Hoàng Gia Huy',
    department: warehouse,
    position: staff,
    permissions: {},
    archived: true,
    extra: { phone: '0903 111 008', note: 'Đã nghỉ việc.' },
  },
];

/** The one invented photo, Châu's. */
export const DEMO_PHOTOS: Record<string, string> = { [id(103)]: PHOTO };

/** One row of the import file the demo company's root chooses, by the key of the column it fills:
 * a built-in column's name, or the key of one of the company's own fields. A column is left out
 * of a row that gives nothing. */
export type DemoImportRow = Partial<
  Record<
    | 'name'
    | 'code'
    | 'phone'
    | 'personalPhone'
    | 'department'
    | 'position'
    | 'note'
    | 'licence'
    | 'started'
    | 'plate'
    | 'dependants',
    string
  >
>;

/** The staff file the demo company's root chooses (group D): three rows that hold, with the code
 * numbered, the code given and the company's own fields; five that do not, one for each reason, in
 * the order the preview lists them: a code taken in the company, no name, a department the company
 * lacks, a code an earlier row gave, a value a field refuses. */
export const DEMO_IMPORT_ROWS: DemoImportRow[] = [
  {
    name: 'Mai Linh',
    phone: '0909 123 456',
    department: 'Kho',
    position: 'Nhân viên',
    note: 'Mới vào làm.',
  },
  {
    name: 'Ngô Thu Hà',
    code: 'EMP-0100',
    phone: '0909 777 888',
    department: 'Văn phòng',
    position: 'Thực tập',
    licence: 'b2',
    started: '2026-10-01',
  },
  {
    name: 'Lý Quang Minh',
    code: 'EMP-0101',
    department: 'Giao hàng',
    position: 'Nhân viên',
    plate: '51C-678.90',
    dependants: '3',
  },
  { name: 'Hồ Bảo Trân', code: 'EMP-0002', department: 'Kho' },
  { code: 'EMP-0102', phone: '0909 000 111' },
  { name: 'Đinh Công Sơn', department: 'Kế toán' },
  { name: 'Phan Thị Yến', code: 'EMP-0100' },
  { name: 'Dương Văn Tài', dependants: 'two' },
];

/** Six invented customers of the demo company, in code order, each with a phone and an address, and
 * one with a note. */
export const DEMO_CUSTOMERS: Customer[] = [
  {
    id: id(201),
    code: 'KH-001',
    name: 'Cửa hàng Vật liệu Hưng Thịnh',
    extra: {
      phone: '0908 220 001',
      address: '12 Nguyễn Trãi, Quận 5',
      note: 'Lấy hàng sáng thứ Hai.',
    },
  },
  {
    id: id(202),
    code: 'KH-002',
    name: 'Công ty Xây dựng An Phú',
    extra: { phone: '0908 220 002', address: '88 Lê Văn Việt, TP. Thủ Đức' },
  },
  {
    id: id(203),
    code: 'KH-003',
    name: 'Anh Tuấn, thầu xây nhà',
    extra: { phone: '0908 220 003', address: '5 Đường số 7, Bình Tân' },
  },
  {
    id: id(204),
    code: 'KH-004',
    name: 'Đại lý Sắt thép Phước Lộc',
    extra: { phone: '0908 220 004', address: '301 Quốc lộ 1A, Bình Chánh' },
  },
  {
    id: id(205),
    code: 'KH-005',
    name: 'Cô Hạnh, sửa nhà',
    extra: { phone: '0908 220 005', address: '17 Hoàng Hoa Thám, Tân Bình' },
  },
  {
    id: id(206),
    code: 'KH-006',
    name: 'Nhà thầu Bảo Long',
    extra: { phone: '0908 220 006', address: '240 Phan Văn Hớn, Quận 12' },
  },
];

/** Seven invented products of the demo company, in code order, by the bag, the tonne, the thousand
 * and the cubic metre, one with a note, and one not stocked: a delivery fee, by the trip. */
export const DEMO_PRODUCTS: Product[] = [
  {
    id: id(307),
    code: 'DV-001',
    name: 'Phí giao hàng theo chuyến',
    unit: 'chuyến',
    price: 150_000,
    stocked: false,
    extra: {},
  },
  {
    id: id(301),
    code: 'VT-001',
    name: 'Xi măng PCB40',
    unit: 'bao',
    price: 95_000,
    stocked: true,
    extra: { note: 'Bao 50 kg.' },
  },
  {
    id: id(302),
    code: 'VT-002',
    name: 'Cát xây tô',
    unit: 'm³',
    price: 320_000,
    stocked: true,
    extra: {},
  },
  {
    id: id(303),
    code: 'VT-003',
    name: 'Đá 1x2',
    unit: 'm³',
    price: 410_000,
    stocked: true,
    extra: {},
  },
  {
    id: id(304),
    code: 'VT-004',
    name: 'Gạch ống 4 lỗ',
    unit: 'nghìn viên',
    price: 1_650_000,
    stocked: true,
    extra: {},
  },
  {
    id: id(305),
    code: 'VT-005',
    name: 'Thép phi 8',
    unit: 'tấn',
    price: 15_800_000,
    stocked: true,
    extra: {},
  },
  {
    id: id(306),
    code: 'VT-006',
    name: 'Sơn nước ngoại thất 18 L',
    unit: 'thùng',
    price: 1_890_000,
    stocked: true,
    extra: {},
  },
];

/** One row of a customers' or products' import file, by the key of the column it fills. A column is
 * left out of a row that gives nothing. */
export type DemoListRow = Partial<
  Record<'code' | 'name' | 'phone' | 'address' | 'unit' | 'price' | 'stocked' | 'note', string>
>;

/** The customers' file the demo company's root chooses: three rows that hold (the second typed in
 * lower case), one whose code the company has (KH-002) and one with no name, in the order the
 * preview lists them. */
export const DEMO_CUSTOMER_IMPORT_ROWS: DemoListRow[] = [
  {
    code: 'KH-007',
    name: 'Cửa hàng Minh Tâm',
    phone: '0909 330 007',
    address: '9 Lý Thường Kiệt, Quận 10',
  },
  {
    code: 'kh-008',
    name: 'Công ty TNHH Gia Khang',
    phone: '0909 330 008',
    address: '61 Cộng Hòa, Tân Bình',
    note: 'Thanh toán cuối tháng.',
  },
  { code: 'KH-009', name: 'Chú Sáu, thợ hồ', phone: '0909 330 009' },
  { code: 'KH-002', name: 'Xây dựng An Phú', phone: '0909 330 010' },
  { code: 'KH-011', phone: '0909 330 011' },
];

/** The products' file: three rows that hold (VT-007 and VT-008 with the stocked cell empty, which
 * reads Có; VT-009 says Có; the prices typed with a dot, none and a comma between the thousands),
 * one whose code the company has (VT-002) and one whose price is no price. */
export const DEMO_PRODUCT_IMPORT_ROWS: DemoListRow[] = [
  { code: 'VT-007', name: 'Xi măng đen PC30', unit: 'bao', price: '88.000' },
  {
    code: 'VT-008',
    name: 'Cát san lấp',
    unit: 'm³',
    price: '180000',
    note: 'Giao tận công trình.',
  },
  { code: 'vt-009', name: 'Ống nhựa PVC phi 60', unit: 'cây', price: '72,000', stocked: 'Có' },
  { code: 'VT-002', name: 'Cát xây tô', unit: 'm³', price: '320000' },
  { code: 'VT-011', name: 'Đá mi bụi', unit: 'm³', price: 'thương lượng' },
];

/** The day the data set's week ends on, the office's today: a Wednesday, the day of the demo. The
 * fake build and a scene take it as the page's today, and the walk fixes the browser's clock at
 * it, so no screen holds a day the run was made on. */
export const DEMO_TODAY = '2026-11-04';

/** One order of the week: a day (counted back from today), the hour it was made, the customer and
 * the products by code (a line may name the price it was saved at, when the product's has moved
 * since), its state, and for a confirmed one the driver by code, the day it was sent
 * for (counted from today), whether its request was cancelled since, and for one of today's the
 * time its driver delivered it. */
type OrderSpec = {
  back: number;
  time: string;
  customer: string;
  lines: [string, number, number?][];
  state: OrderState;
  driver?: string;
  sentFor?: number;
  requestState?: RequestState;
  deliveredAt?: string;
};

const WEEK_OF_ORDERS: OrderSpec[] = [
  {
    back: 6,
    time: '08:10',
    customer: 'KH-001',
    lines: [
      ['VT-001', 40],
      ['VT-002', 3],
    ],
    state: 'confirmed',
    driver: 'EMP-0005',
    sentFor: -6,
  },
  {
    back: 6,
    time: '10:45',
    customer: 'KH-003',
    lines: [['VT-004', 2]],
    state: 'confirmed',
    driver: 'EMP-0006',
    sentFor: -6,
  },
  {
    back: 5,
    time: '07:55',
    customer: 'KH-002',
    lines: [
      ['VT-005', 2],
      ['VT-003', 6],
    ],
    state: 'confirmed',
    driver: 'EMP-0005',
    sentFor: -5,
  },
  {
    back: 5,
    time: '14:20',
    customer: 'KH-005',
    lines: [['VT-006', 4]],
    state: 'cancelled',
    driver: 'EMP-0006',
    sentFor: -5,
    requestState: 'cancelled',
  },
  {
    back: 4,
    time: '09:05',
    customer: 'KH-004',
    lines: [['VT-005', 5]],
    state: 'confirmed',
    driver: 'EMP-0005',
    sentFor: -4,
  },
  {
    back: 3,
    time: '08:30',
    customer: 'KH-006',
    lines: [
      ['VT-001', 100],
      ['DV-001', 1],
    ],
    state: 'confirmed',
    driver: 'EMP-0006',
    sentFor: -3,
  },
  { back: 3, time: '15:40', customer: 'KH-001', lines: [['VT-003', 4]], state: 'draft' },
  {
    back: 2,
    time: '10:15',
    customer: 'KH-002',
    lines: [
      ['VT-004', 6],
      ['DV-001', 1],
    ],
    state: 'confirmed',
    driver: 'EMP-0005',
    sentFor: -2,
  },
  {
    back: 1,
    time: '09:40',
    customer: 'KH-003',
    lines: [['VT-002', 8]],
    state: 'confirmed',
    driver: 'EMP-0006',
    sentFor: -1,
  },
  {
    back: 1,
    time: '16:05',
    customer: 'KH-005',
    lines: [['VT-006', 2]],
    state: 'confirmed',
    driver: 'EMP-0005',
    sentFor: 0,
  },
  {
    back: 1,
    time: '17:10',
    customer: 'KH-004',
    lines: [
      ['VT-001', 60],
      ['VT-003', 5],
    ],
    state: 'confirmed',
    driver: 'EMP-0006',
    sentFor: 0,
  },
  {
    back: 0,
    time: '07:45',
    customer: 'KH-006',
    lines: [['VT-005', 3]],
    state: 'confirmed',
    driver: 'EMP-0005',
    sentFor: 0,
    deliveredAt: '09:30',
  },
  {
    back: 0,
    time: '09:20',
    customer: 'KH-001',
    lines: [
      ['VT-002', 5],
      ['VT-001', 20],
    ],
    state: 'confirmed',
    driver: 'EMP-0006',
    sentFor: 0,
  },
  {
    back: 0,
    time: '10:50',
    customer: 'KH-002',
    lines: [['VT-004', 3]],
    state: 'confirmed',
    driver: 'EMP-0005',
    sentFor: 0,
    requestState: 'cancelled',
  },
  { back: 0, time: '11:30', customer: 'KH-003', lines: [['VT-006', 2]], state: 'draft' },
  {
    back: 0,
    time: '13:05',
    customer: 'KH-005',
    lines: [['VT-001', 30]],
    state: 'confirmed',
    driver: 'EMP-0006',
    sentFor: 1,
  },
  // taken yesterday, before the cement's price rose from 90,000 to its 95,000 of today
  {
    back: 1,
    time: '16:10',
    customer: 'KH-002',
    lines: [
      ['VT-001', 20, 90_000],
      ['VT-003', 5],
    ],
    state: 'draft',
  },
];

/** The minutes after an order that its request is made, in the data set. */
const SENT_AFTER_MINUTES = 20;
/** The times of day a request of a past day was delivered at, in turn: after it was sent and before
 * 17:30. */
const PAST_DELIVERY_TIMES = ['14:00', '14:40', '15:20', '16:00'] as const;
/** A time of day in Vietnam (UTC+7), as milliseconds since the epoch, fixed. */
const atVietnam = (day: string, time: string) => {
  const [year, month, date] = day.split('-').map(Number) as [number, number, number];
  const [hour, minute] = time.split(':').map(Number) as [number, number];
  return Date.UTC(year, month - 1, date, hour - 7, minute);
};

const driverOf = (code: string): Driver => {
  const found = DEMO_EMPLOYEES.find((person) => person.code === code)!;
  return { id: found.id, code: found.code, name: found.name };
};

/** A week of the demo company's orders and their delivery requests at fixed times, ending on
 * `DEMO_TODAY`, numbered DH- and GH- in the order they were made. One data set for the fake and
 * the stack's generator; a request is made for each confirmed order, and one is cancelled since.
 * Each request of a past day was delivered, with a drawn photo, and its order is fulfilled; of
 * today's, one was delivered before the walk's 10:00 and the rest wait. */
const WEEK = (() => {
  const orders: Order[] = [];
  const requests: DeliveryRequest[] = [];
  const photos: Record<string, string> = {};
  WEEK_OF_ORDERS.forEach((spec, index) => {
    const day = addDays(DEMO_TODAY, -spec.back);
    const customer = DEMO_CUSTOMERS.find((one) => one.code === spec.customer)!;
    const priced = priceLines(
      spec.lines.map(([code, quantity]) => ({
        productId: DEMO_PRODUCTS.find((one) => one.code === code)!.id,
        quantity,
      })),
      DEMO_PRODUCTS,
    ) as Extract<Priced, { kind: 'priced' }>; // every code is in the data set's lists, as its test reads
    // a line named with its saved price keeps it, the amount and the total following
    const lines = priced.lines.map((line, at) => {
      const saved = spec.lines[at][2];
      return saved === undefined ? line : { ...line, price: saved, amount: saved * line.quantity };
    });
    const total = lines.reduce((sum, line) => sum + line.amount, 0);
    const madeAt = atVietnam(day, spec.time);
    const order: Order = {
      id: id(401 + index),
      number: numberText(ORDER_PREFIX, index + 1),
      day,
      state: spec.state,
      customer: structuredClone(customer),
      lines,
      total,
      request: null,
      madeAt,
      extra: {},
    };
    orders.push(order);
    if (spec.driver === undefined) return;
    const request: DeliveryRequest = {
      id: id(501 + index),
      number: numberText(REQUEST_PREFIX, requests.length + 1),
      day: addDays(DEMO_TODAY, spec.sentFor as number),
      state: spec.requestState ?? 'waiting',
      driver: driverOf(spec.driver),
      order: { id: order.id, day: order.day, number: order.number },
      customer: structuredClone(order.customer),
      lines: structuredClone(order.lines),
      total: order.total,
      madeAt: madeAt + SENT_AFTER_MINUTES * 60_000,
      extra: {},
    };
    requests.push(request);
    const deliveredTime =
      spec.deliveredAt ??
      (request.day < DEMO_TODAY
        ? PAST_DELIVERY_TIMES[requests.length % PAST_DELIVERY_TIMES.length]
        : undefined);
    if (request.state === 'waiting' && deliveredTime !== undefined) {
      request.state = 'delivered';
      request.deliveredAt = atVietnam(request.day, deliveredTime);
      order.state = 'fulfilled';
      photos[request.id] = DEMO_PROOFS[Object.keys(photos).length % DEMO_PROOFS.length];
    }
    if (request.state === 'waiting' || request.state === 'delivered') {
      const { id: requestId, number, day: sentDay, driver } = request;
      order.request = { id: requestId, number, day: sentDay, driver };
    }
  });
  return { orders, requests, photos };
})();

export const DEMO_ORDERS: Order[] = WEEK.orders;
export const DEMO_DELIVERIES: DeliveryRequest[] = WEEK.requests;

/** The drawn photo of each delivered request, by the request's id: three pictures in turn. */
export const DEMO_DELIVERY_PHOTOS: Record<string, string> = WEEK.photos;

/** The picture the walks choose as the camera's file when a driver delivers: the first of the three. */
export const DEMO_WALK_PROOF: string = DEMO_PROOFS[0];

/** The hour the data set's office closes each driver's day, in Vietnam. */
const CLOSED_AT = '17:45';
/** The one day of the past that was closed short: yesterday's, `EMP-0006`'s, by this many đồng. */
const SHORT_BY = 20_000;

/** Every driver's day before `DEMO_TODAY` closed by `EMP-0001` at the day's end, with the cash
 * exactly what it was to collect but yesterday's `EMP-0006`, short `SHORT_BY`. Today's are open. A
 * driver whose only request of a day was cancelled has nothing to collect, and closes with 0. */
export const DEMO_RECONCILIATIONS: Reconciliation[] = (() => {
  const manager = DEMO_EMPLOYEES.find((person) => person.code === 'EMP-0001')!;
  const days = [...new Set(DEMO_DELIVERIES.map((one) => one.day))]
    .filter((day) => day < DEMO_TODAY)
    .sort();
  return days.flatMap((day) => {
    const drivers = [
      ...new Map(
        DEMO_DELIVERIES.filter((one) => one.day === day).map((one) => [one.driver.id, one.driver]),
      ).values(),
    ].sort((a, b) => a.code.localeCompare(b.code));
    return drivers.map((driver): Reconciliation => {
      const { delivered, toCollect } = driverDay(
        DEMO_DELIVERIES.filter((one) => one.day === day),
        driver.id,
      );
      const short = day === addDays(DEMO_TODAY, -1) && driver.code === 'EMP-0006' ? SHORT_BY : 0;
      const handedIn = toCollect - short;
      return {
        day,
        driver,
        requests: delivered.map(({ id: requestId, number, total }) => ({
          id: requestId,
          number,
          total,
        })),
        toCollect,
        handedIn,
        difference: handedIn - toCollect,
        closedBy: { id: manager.id, code: manager.code, name: manager.name },
        closedAt: atVietnam(day, CLOSED_AT),
      };
    });
  });
})();

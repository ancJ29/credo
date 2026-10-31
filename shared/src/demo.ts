import type { TenantConfig } from './config';
import type { CustomField } from './fields';
import type { Customer, Product } from './lists';
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
  languages: ['vi', 'en'],
  defaultLanguage: 'vi',
};

export const DEMO_CODE = 'demo';
/** The name the demo company's root signs in with: the BFF's own root name. */
export const DEMO_ROOT_NAME = 'root';
export const OPERATOR_NAME = 'operator';

/** The clients the operator's list shows: the demo company and two more invented ones, never a
 * real client's. Each time is noon UTC, so its day reads the same in every zone from UTC-11 to
 * UTC+11. */
export const DEMO_CLIENTS: { code: string; name: string; madeAt: number }[] = [
  { code: DEMO_CODE, name: DEMO_CONFIG.name, madeAt: Date.UTC(2026, 8, 14, 12) },
  { code: 'hoa-sen', name: 'Hoa Sen', madeAt: Date.UTC(2026, 9, 2, 12) },
  { code: 'binh-an', name: 'Bình An', madeAt: Date.UTC(2026, 9, 21, 12) },
];

/** The secret of the QR code the data set holds for one person, whose link the phone's walk opens. */
export const DEMO_QR_SECRET = 'fake-qr-secret-0001';

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
    label: { vi: 'Ngày vào làm', en: 'Start date' },
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
      permissions: { 'staff.canView': true, 'staff.canCreate': true, 'staff.canEdit': true },
      extra: {},
    },
    { id: DEPARTMENTS.delivery, name: 'Giao hàng', permissions: {}, extra: {} },
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
  fields: { personalPhone: true, photo: true },
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
    extra: { phone: '0903 111 001', note: 'Phụ trách nhân sự.' },
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
    extra: { phone: '0903 111 003', started: '2024-03-04' },
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

/** Six invented products of the demo company, in code order, by the bag, the tonne, the thousand
 * and the cubic metre, one with a note. */
export const DEMO_PRODUCTS: Product[] = [
  {
    id: id(301),
    code: 'VT-001',
    name: 'Xi măng PCB40',
    unit: 'bao',
    price: 95_000,
    extra: { note: 'Bao 50 kg.' },
  },
  { id: id(302), code: 'VT-002', name: 'Cát xây tô', unit: 'm³', price: 320_000, extra: {} },
  { id: id(303), code: 'VT-003', name: 'Đá 1x2', unit: 'm³', price: 410_000, extra: {} },
  {
    id: id(304),
    code: 'VT-004',
    name: 'Gạch ống 4 lỗ',
    unit: 'nghìn viên',
    price: 1_650_000,
    extra: {},
  },
  { id: id(305), code: 'VT-005', name: 'Thép phi 8', unit: 'tấn', price: 15_800_000, extra: {} },
  {
    id: id(306),
    code: 'VT-006',
    name: 'Sơn nước ngoại thất 18 L',
    unit: 'thùng',
    price: 1_890_000,
    extra: {},
  },
];

/** One row of a customers' or products' import file, by the key of the column it fills. A column is
 * left out of a row that gives nothing. */
export type DemoListRow = Partial<
  Record<'code' | 'name' | 'phone' | 'address' | 'unit' | 'price' | 'note', string>
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

/** The products' file: three rows that hold (one price typed with a dot between the thousands, one
 * with a comma), one whose code the company has (VT-002) and one whose price is no price. */
export const DEMO_PRODUCT_IMPORT_ROWS: DemoListRow[] = [
  { code: 'VT-007', name: 'Xi măng đen PC30', unit: 'bao', price: '88.000' },
  {
    code: 'VT-008',
    name: 'Cát san lấp',
    unit: 'm³',
    price: '180000',
    note: 'Giao tận công trình.',
  },
  { code: 'vt-009', name: 'Ống nhựa PVC phi 60', unit: 'cây', price: '72,000' },
  { code: 'VT-002', name: 'Cát xây tô', unit: 'm³', price: '320000' },
  { code: 'VT-011', name: 'Đá mi bụi', unit: 'm³', price: 'thương lượng' },
];

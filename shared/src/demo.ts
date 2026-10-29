import type { TenantConfig } from './config';
import type { CustomField } from './fields';
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

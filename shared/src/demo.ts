import type { TenantConfig } from './config';
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

/** The demo company's departments and positions, with what each may do. */
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
  extra: {},
};

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

/** About eight invented people, with phones and notes: the office's manager, one with permissions
 * of their own, one who left, one in no department. */
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
    permissions: {},
    archived: false,
    extra: { phone: '0903 111 003' },
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
    extra: { phone: '0903 111 005', note: 'Lái xe tải nhỏ.' },
  },
  {
    id: id(106),
    code: 'EMP-0006',
    name: 'Đặng Hoài Nam',
    department: delivery,
    position: trainee,
    permissions: {},
    archived: false,
    extra: { phone: '0903 111 006' },
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

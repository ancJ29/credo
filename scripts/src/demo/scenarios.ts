import type { CustomField, PermissionLayer, StaffFields } from '@credo/shared';

/** A scenario is a kind of company: a trade and a size, as data. Each piece's generator reads every
 * profile; a new scenario is one more profile here. */
export const SCENARIO_IDS = ['S1', 'S2'] as const;
export type ScenarioId = (typeof SCENARIO_IDS)[number];

export type DepartmentProfile = {
  name: string;
  permissions: PermissionLayer;
  /** Its part of the headcount, in proportion. */
  share: number;
  /** The licences its people hold (values of the licence field), or none. */
  licences: string[];
  /** The kind of vehicle plate its people have, or none. */
  plate: 'car' | 'moto' | null;
};

type PositionProfile = {
  name: string;
  permissions: PermissionLayer;
  /** How often a person who is not their department's manager holds it; 0 for the manager. */
  weight: number;
};

type StaffProfile = {
  headcount: number;
  /** Working days between one hire and the next, on average; the same for leavers. */
  hireEvery: number;
  leaveEvery: number;
  /** People who left before the first day, kept as archived. */
  former: number;
  departments: DepartmentProfile[];
  positions: PositionProfile[];
  numbering: { prefix: string; digits: number };
};

export type Scenario = {
  id: ScenarioId;
  /** The trade, for a reader. */
  trade: string;
  staff: StaffProfile;
};

/** The two positions every scenario shares: the manager of a department, and the ordinary ones. */
export const MANAGER = 'Quản lý';
const positions: PositionProfile[] = [
  { name: MANAGER, permissions: { 'staff.canDelete': true }, weight: 0 },
  { name: 'Nhân viên', permissions: {}, weight: 85 },
  { name: 'Học việc', permissions: { 'staff.canEdit': false }, weight: 15 },
];

/** The company's own fields, the same in every scenario. */
export const CUSTOM_FIELDS: CustomField[] = [
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

export const STAFF_FIELDS: StaffFields = { personalPhone: true, photo: false };

const view: PermissionLayer = { 'staff.canView': true };
const office: PermissionLayer = {
  'staff.canView': true,
  'staff.canCreate': true,
  'staff.canEdit': true,
};

export const SCENARIOS: Record<ScenarioId, Scenario> = {
  S1: {
    id: 'S1',
    trade: 'Building materials: cement, steel, brick, sand to builders',
    staff: {
      headcount: 45,
      hireEvery: 15,
      leaveEvery: 15,
      former: 3,
      departments: [
        { name: 'Văn phòng bán hàng', permissions: office, share: 10, licences: [], plate: null },
        { name: 'Kế toán', permissions: view, share: 3, licences: [], plate: null },
        { name: 'Bãi vật liệu', permissions: view, share: 17, licences: [], plate: null },
        { name: 'Lái xe tải', permissions: {}, share: 15, licences: ['c'], plate: 'car' },
      ],
      positions,
      numbering: { prefix: 'VL-', digits: 3 },
    },
  },
  S2: {
    id: 'S2',
    trade: 'Drinks and household goods wholesale to grocery shops',
    staff: {
      headcount: 60,
      hireEvery: 10,
      leaveEvery: 10,
      former: 4,
      departments: [
        { name: 'Kinh doanh tuyến', permissions: view, share: 22, licences: [], plate: 'moto' },
        { name: 'Kho', permissions: view, share: 16, licences: [], plate: null },
        { name: 'Giao hàng', permissions: {}, share: 14, licences: ['b2', 'c'], plate: 'car' },
        { name: 'Văn phòng', permissions: office, share: 8, licences: [], plate: null },
      ],
      positions,
      numbering: { prefix: 'NV-', digits: 3 },
    },
  },
};

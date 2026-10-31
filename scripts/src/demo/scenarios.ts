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

/** A family of products: a noun, its variants and sizes, and the unit and price range of its
 * combinations. A product is one combination, named `noun variant size`. */
export type ProductFamily = {
  noun: string;
  variants: string[];
  sizes: string[];
  unit: string;
  /** The price range in whole đồng; a price is drawn in steps of 500. */
  from: number;
  to: number;
};

/** A product whose stock is not kept: a service the company charges for. */
type ServiceProfile = { name: string; unit: string; price: number };

/** The company's lists: the customers it sells to and the products it sells. */
type ListsProfile = {
  customers: number;
  /** What a customer is called before its owner's name: a shop, a builder. */
  customerKinds: string[];
  customerPrefix: string;
  products: number;
  productPrefix: string;
  families: ProductFamily[];
  /** Products whose stock is not kept, after the stocked ones. */
  services: ServiceProfile[];
};

export type Scenario = {
  id: ScenarioId;
  /** The trade, for a reader. */
  trade: string;
  staff: StaffProfile;
  lists: ListsProfile;
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
    lists: {
      customers: 30,
      customerKinds: ['Nhà thầu', 'Thầu xây dựng', 'Cơ sở xây dựng', 'Công ty TNHH XD'],
      customerPrefix: 'KH-',
      products: 60,
      productPrefix: 'VT-',
      families: [
        {
          noun: 'Xi măng',
          variants: ['Hà Tiên', 'Nghi Sơn', 'Vicem', 'Holcim', 'Chinfon'],
          sizes: ['PC30', 'PC40'],
          unit: 'bao',
          from: 82000,
          to: 98000,
        },
        {
          noun: 'Thép phi',
          variants: ['6', '8', '10', '12', '14', '16', '18'],
          sizes: ['Hòa Phát', 'Pomina', 'Việt Nhật'],
          unit: 'cây',
          from: 95000,
          to: 420000,
        },
        {
          noun: 'Gạch',
          variants: ['ống 4 lỗ', 'thẻ', 'tuynel', 'block', 'bê tông', 'không nung'],
          sizes: ['loại 1', 'loại 2'],
          unit: 'nghìn viên',
          from: 1200000,
          to: 2600000,
        },
        {
          noun: 'Cát, đá',
          variants: [
            'cát vàng',
            'cát san lấp',
            'cát xây tô',
            'đá 1x2',
            'đá 4x6',
            'đá mi',
            'đá hộc',
          ],
          sizes: ['sàng', 'thường'],
          unit: 'm³',
          from: 120000,
          to: 420000,
        },
        {
          noun: 'Thép cuộn',
          variants: ['phi 6', 'phi 8', 'phi 10'],
          sizes: ['Hòa Phát', 'Pomina'],
          unit: 'tấn',
          from: 14500000,
          to: 16500000,
        },
        {
          noun: 'Ống nhựa PVC phi',
          variants: ['21', '27', '34', '42', '60', '90', '114'],
          sizes: ['Bình Minh', 'Tiền Phong'],
          unit: 'cây',
          from: 28000,
          to: 260000,
        },
      ],
      services: [
        { name: 'Cước vận chuyển theo chuyến', unit: 'chuyến', price: 350000 },
        { name: 'Cắt sắt theo việc', unit: 'việc', price: 450000 },
      ],
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
    lists: {
      customers: 80,
      customerKinds: ['Tạp hóa', 'Cửa hàng tiện lợi', 'Đại lý', 'Quán', 'Siêu thị mini'],
      customerPrefix: 'KH-',
      products: 250,
      productPrefix: 'SP-',
      families: [
        {
          noun: 'Nước ngọt',
          variants: ['Cola', 'Chanh', 'Cam', 'Soda', 'Nho', 'Dâu', 'Gừng', 'Me', 'Sữa bắp', 'Tắc'],
          sizes: ['lon 330ml', 'chai 390ml', 'chai 1,5L'],
          unit: 'thùng',
          from: 150000,
          to: 260000,
        },
        {
          noun: 'Nước suối',
          variants: ['Núi Xanh', 'Suối Mát', 'Khe Trong', 'Mây Bạc', 'Đồi Thông', 'Thạch Lam'],
          sizes: ['chai 500ml', 'chai 1,5L', 'bình 5L'],
          unit: 'thùng',
          from: 45000,
          to: 110000,
        },
        {
          noun: 'Bia',
          variants: ['vàng', 'đen', 'lạnh', 'tươi', 'nhẹ', 'đặc biệt', 'xuất khẩu', 'thủ công'],
          sizes: ['lon 330ml', 'chai 330ml', 'chai 450ml', 'lon 500ml'],
          unit: 'thùng',
          from: 180000,
          to: 420000,
        },
        {
          noun: 'Sữa',
          variants: [
            'tươi',
            'đặc',
            'chua',
            'ít đường',
            'có đường',
            'socola',
            'dâu',
            'hạt',
            'gạo',
            'đậu nành',
          ],
          sizes: ['hộp 180ml', 'hộp 1L', 'bịch 220ml'],
          unit: 'thùng',
          from: 160000,
          to: 380000,
        },
        {
          noun: 'Mì gói',
          variants: [
            'bò',
            'gà',
            'tôm',
            'heo',
            'chua cay',
            'rau',
            'trứng',
            'sườn',
            'lẩu thái',
            'kim chi',
            'hải sản',
            'cua',
          ],
          sizes: ['gói 75g', 'ly 65g'],
          unit: 'thùng',
          from: 95000,
          to: 190000,
        },
        {
          noun: 'Dầu ăn',
          variants: ['đậu nành', 'hướng dương', 'cải', 'olive', 'mè', 'dừa'],
          sizes: ['chai 1L', 'chai 2L', 'can 5L'],
          unit: 'thùng',
          from: 260000,
          to: 780000,
        },
        {
          noun: 'Nước mắm, nước tương',
          variants: ['cá cơm', 'cá linh', 'nhĩ', 'đậu nành', 'ớt', 'hầm', 'chay', 'tỏi'],
          sizes: ['chai 500ml', 'chai 900ml'],
          unit: 'thùng',
          from: 130000,
          to: 360000,
        },
        {
          noun: 'Bột giặt',
          variants: [
            'hương chanh',
            'hương hoa',
            'hương nắng',
            'khử mùi',
            'trắng sáng',
            'diệt khuẩn',
            'cho máy',
            'đậm đặc',
          ],
          sizes: ['gói 400g', 'túi 800g', 'túi 3kg'],
          unit: 'thùng',
          from: 150000,
          to: 520000,
        },
        {
          noun: 'Nước rửa chén',
          variants: ['chanh', 'trà xanh', 'lô hội', 'khử mùi', 'bạc hà', 'cam'],
          sizes: ['chai 750g', 'can 3,6kg'],
          unit: 'thùng',
          from: 120000,
          to: 340000,
        },
        {
          noun: 'Giấy vệ sinh',
          variants: [
            '2 lớp',
            '3 lớp',
            'không lõi',
            'cuộn lớn',
            'cuộn nhỏ',
            'hương lài',
            'trắng',
            'tre',
          ],
          sizes: ['lốc 10 cuộn', 'lốc 24 cuộn'],
          unit: 'thùng',
          from: 90000,
          to: 280000,
        },
        {
          noun: 'Cà phê hòa tan',
          variants: [
            'sữa',
            'đen',
            'đá',
            'sữa dừa',
            'mocha',
            'ba trong một',
            'đậm vị',
            'ít ngọt',
            'hạnh nhân',
            'caramel',
          ],
          sizes: ['hộp 20 gói', 'hộp 50 gói', 'bịch 100 gói'],
          unit: 'thùng',
          from: 85000,
          to: 310000,
        },
        {
          noun: 'Trà đóng chai',
          variants: ['xanh', 'chanh', 'đào', 'ô long', 'lài', 'atiso', 'gừng', 'sen'],
          sizes: ['chai 450ml', 'chai 1L'],
          unit: 'thùng',
          from: 110000,
          to: 230000,
        },
      ],
      services: [{ name: 'Phí giao hàng theo chuyến', unit: 'chuyến', price: 150000 }],
    },
  },
};

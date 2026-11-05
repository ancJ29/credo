import { addDays, driverDay, type Language } from '@credo/shared';
import {
  DEMO_CODE,
  DEMO_COLLEAGUE_ID,
  DEMO_CUSTOMERS,
  DEMO_DELIVERIES,
  DEMO_DRIVER_QR_SECRET,
  DEMO_EMPLOYEES,
  DEMO_INVITED_NAME,
  DEMO_JOIN_TOKEN,
  DEMO_ORDERS,
  DEMO_PRODUCTS,
  DEMO_QR_SECRET,
  DEMO_TODAY,
} from '@credo/shared/demo';
import type { DemoFile } from '@credo/ui/import-demo';
import type { MockScreen } from '@credo/ui/mock';

/** A text in each language the report draws. */
export type Bilingual = Record<Language, string>;

/**
 * The widths a screen is drawn at, so the app's breakpoints answer to each, widest first: every
 * walk screen is drawn at all three, whoever the walk is for.
 */
export const DEVICE_WIDTH = { pc: 1280, tablet: 768, phone: 390 } as const;
export type Device = keyof typeof DEVICE_WIDTH;
export const DEVICE_LABEL: Record<Device, string> = { pc: 'PC', tablet: 'tablet', phone: 'phone' };
export type DeviceWidth = (typeof DEVICE_WIDTH)[Device];

/**
 * One thing a person does on a scene, named by the app's own words: a key of its dictionaries
 * (`person.archive`), read in the language the scene is drawn in, so a renamed label stops the
 * build where it was renamed. A step that finds nothing stops the build, naming it.
 */
export type Step =
  /** Presses the button, link, switch or choice with these words; `within` names the group of
   * choices it sits in by the words of its label, `with` fills a word's `{{name}}`. */
  | { press: string; within?: string; with?: Record<string, string> }
  /** Replaces what is typed in the field with these words by `text`. */
  | { fill: string; text: string }
  /** Chooses, in the list with these words, the option that reads `option`. */
  | { choose: string; option: string }
  /** Puts one of the data set's files (the staff's, the customers' or the products') in the file
   * field with these words, as a person's choosing it does. */
  | { attach: string; file: DemoFile };

/**
 * A screen drawn as the app itself on the fake, as a person meets it: opened at `path`, signed in
 * as the data-set person with this code (the root when none) or as the operator, with one call's failure cued, then
 * the steps.
 */
export type Scene = {
  path: string;
  as?: string;
  /** Signed in as the operator, not as a person of the data set. */
  operator?: true;
  cue?: string;
  /** The company has turned on sign-in by email and by QR code, which the data set leaves off. */
  signIns?: true;
  /** A deploy half done: c-storage runs a newer build than the app and the BFF. */
  drift?: true;
  /** Nobody is signed in: a phone opening a QR code's link. */
  out?: true;
  /** No one is allowed to deliver yet: the data set's drivers' departments lack the right. */
  noDrivers?: true;
  steps?: Step[];
};

export type Person = { id: string; name: Bilingual; device: Device };
export type Part = { id: string; name: Bilingual };

type WalkScreen = {
  /** The walk spec's name for the screen, which is also its base image's: `3-settings`. */
  id: string;
  number: number;
  path: 'main' | 'wrong';
  /** What the screen is, in each language. */
  sentence: Bilingual;
  /** The one question the human answers, in English. */
  question: string;
  /** Set when the screen is about the menu of pages, so its words keep the menu. */
  navigation?: true;
} & (
  | {
      /** The mock's screen and state it shows: piece 1's screens. */
      mock: { screen: number; state: string };
      scene?: never;
    }
  | { scene: Scene; mock?: never }
);

export type Walk = {
  id: string;
  person: string;
  part: string;
  title: Bilingual;
  screens: WalkScreen[];
};

/** The map's people, down, each on their device. */
export const PEOPLE: Person[] = [
  { id: 'operator', name: { en: 'The operator', vi: 'Người vận hành' }, device: 'pc' },
  { id: 'admin', name: { en: 'The client’s admin', vi: 'Quản trị của khách hàng' }, device: 'pc' },
  { id: 'office', name: { en: 'Office staff', vi: 'Nhân viên văn phòng' }, device: 'pc' },
  { id: 'driver', name: { en: 'The driver', vi: 'Tài xế' }, device: 'phone' },
];

/** The map's parts of the day, across. A new one only by a piece’s plan. */
export const PARTS: Part[] = [
  { id: 'setup', name: { en: 'Set up', vi: 'Thiết lập' } },
  { id: 'staff', name: { en: 'Staff', vi: 'Nhân viên' } },
  { id: 'stock', name: { en: 'Stock', vi: 'Kho hàng' } },
  { id: 'orders', name: { en: 'Orders', vi: 'Đơn hàng' } },
  { id: 'delivery', name: { en: 'Delivery', vi: 'Giao hàng' } },
  { id: 'day-end', name: { en: 'The day’s end', vi: 'Cuối ngày' } },
];

/** A data-set person's page, by their code. */
const personAt = (code: string) => `/staff/${DEMO_EMPLOYEES.find((p) => p.code === code)!.id}`;

/** The add form, filled as the root fills it: the same steps for the form and for what follows. */
const FILLED_ADD: Step[] = [
  { fill: 'addPerson.name', text: 'Mai Linh' },
  { fill: 'addPerson.code', text: 'EMP-0100' },
  { fill: 'addPerson.phone', text: '0909 123 456' },
  { fill: 'addPerson.note', text: 'Mới vào làm.' },
  { choose: 'addPerson.department', option: 'Kho' },
  { choose: 'addPerson.position', option: 'Nhân viên' },
];

/** The same for someone allowed to add people, who has no department, position or sign-in to give. */
const FILLED_ADD_BY_OFFICE: Step[] = FILLED_ADD.filter((step) => !('choose' in step));

/** The operator's add form, filled as the operator fills it: the same steps for the form and for what follows. */
const FILLED_CLIENT: Step[] = [
  { fill: 'operator.code', text: 'minh-phat' },
  { fill: 'operator.companyName', text: 'Minh Phát' },
];

/** A client's root password page: the data set's own client, whose root's first password the walk knows. */
const ROOT_PASSWORD_PATH = `/operator/clients/${DEMO_CODE}/root-password`;

/** The password page's form filled as the operator fills it: the client's code typed, and the password twice. */
const ROOT_CODE: Step = { fill: 'operator.rootCodeLabel', text: DEMO_CODE };
const ROOT_TYPED: Step[] = [
  ROOT_CODE,
  { fill: 'person.passwordNew', text: 'Mat-khau-moi-1!' },
  { fill: 'person.passwordAgain', text: 'Mat-khau-moi-1!' },
];

/** A client's delete page: the data set's second client, whose code the walk types and deletes. */
const DELETE_CLIENT_CODE = 'hoa-sen';
const DELETE_CLIENT_PATH = `/operator/clients/${DELETE_CLIENT_CODE}/delete`;
const DELETE_CODE: Step = { fill: 'operator.deleteClientCodeLabel', text: DELETE_CLIENT_CODE };

/** The add-operator form's name, typed as the operator types it. */
const NEW_OPERATOR_NAME: Step = { fill: 'team.nameLabel', text: 'Thu Hà' };

/** The data set's join link, as the invited operator opens it: the token is in the fragment. */
const JOIN_LINK = `/operator/join#${DEMO_JOIN_TOKEN}`;

/** The add form with the company's own fields and the second phone filled, the code left to be
 * numbered. */
const FILLED_OWN: Step[] = [
  { fill: 'addPerson.name', text: 'Mai Linh' },
  { fill: 'addPerson.phone', text: '0909 123 456' },
  { fill: 'addPerson.personalPhone', text: '0909 555 666' },
  { fill: 'field.plate', text: '51C-999.99' },
  { fill: 'field.dependants', text: '1' },
  { fill: 'field.started', text: '2026-10-01' },
  { choose: 'addPerson.department', option: 'Kho' },
  { choose: 'addPerson.position', option: 'Nhân viên' },
];

/** The orders' walk's data, by the data set: today's draft the office confirms, and the request of
 * a driver the office cancels and sends again. */
const DRAFT_TODAY = DEMO_ORDERS.find((one) => one.day === DEMO_TODAY && one.state === 'draft')!;
const WAITING_TODAY = DEMO_DELIVERIES.find(
  (one) => one.day === DEMO_TODAY && one.state === 'waiting' && one.driver.code === 'EMP-0006',
)!;
/** The customers' pages in the lists walk: one with a note, one without. */
const NOTED_CUSTOMER = DEMO_CUSTOMERS.find((one) => 'note' in one.extra)!;
const PLAIN_CUSTOMER = DEMO_CUSTOMERS.find((one) => !('note' in one.extra))!;
/** A customer or a product as the order form lists it in its choice. */
const customerChoice = (code: string) => {
  const one = DEMO_CUSTOMERS.find((candidate) => candidate.code === code)!;
  return `${one.code} · ${one.name}`;
};
const productChoice = (code: string) => {
  const one = DEMO_PRODUCTS.find((candidate) => candidate.code === code)!;
  return `${one.code} · ${one.name} · ${one.unit}`;
};
const DRIVER_CHOICE = 'EMP-0005 · Võ Thanh Tùng';
/** A line added to the order form: the product, its quantity, and the press. */
const LINE = (code: string, quantity: number): Step[] => [
  { choose: 'orders.product', option: productChoice(code) },
  { fill: 'orders.quantity', text: String(quantity) },
  { press: 'orders.addLine' },
];
/** The new order form as the office fills it: a customer and two products. */
const FILLED_ORDER: Step[] = [
  { choose: 'orders.customer', option: customerChoice('KH-001') },
  ...LINE('VT-001', 40),
  ...LINE('VT-002', 3),
];
/** Today's draft, opened from its page, with its first line taken off and another put in. */
const CHANGED_DRAFT: Step[] = [
  { press: 'orders.removeLine', with: { name: DRAFT_TODAY.lines[0].name } },
  ...LINE('VT-001', 1),
];
const DRAFT_PATH = `/orders/${DRAFT_TODAY.day}/${DRAFT_TODAY.id}`;

/** The link a QR code opens, for a data-set person (a warehouse member unless another is named) and
 * the secret given. */
const qrLinkWith = (secret: string, code = 'EMP-0004') =>
  `/login?client-code=demo&qr=${DEMO_EMPLOYEES.find((p) => p.code === code)!.id}.${secret}`;

/** The driver's walk's data, by the data set: the driver `EMP-0005`, the request of theirs that waits
 * today, and the request the data set delivered, with its order fulfilled. */
const DRIVER = 'EMP-0005';
const WAITING_OF_DRIVER = DEMO_DELIVERIES.find(
  (one) => one.day === DEMO_TODAY && one.state === 'waiting' && one.driver.code === DRIVER,
)!;
const DELIVERED_TODAY = DEMO_DELIVERIES.find(
  (one) => one.day === DEMO_TODAY && one.state === 'delivered',
)!;
const FULFILLED_PATH = `/orders/${DELIVERED_TODAY.order.day}/${DELIVERED_TODAY.order.id}`;
/** The driver taking the picture of the goods: Delivered, then the camera's file. */
const PHOTO_TAKEN: Step[] = [
  { press: 'myDeliveries.deliver' },
  { attach: 'myDeliveries.photoField', file: 'photo' },
];
const SENT: Step[] = [...PHOTO_TAKEN, { press: 'myDeliveries.send' }];

/** The day's end walk's data, by the data set: the driver `EMP-0005`'s day today (one delivered, one
 * waiting), the cash typed short of what is to be collected, and yesterday's page of requests. */
const DRIVER_ID = DEMO_EMPLOYEES.find((one) => one.code === DRIVER)!.id;
const DRIVER_DAY_PATH = `/deliveries/${DEMO_TODAY}/drivers/${DRIVER_ID}`;
const SHORT_BY = 20_000;
const CASH_SHORT = String(
  driverDay(
    DEMO_DELIVERIES.filter((one) => one.day === DEMO_TODAY),
    DRIVER_ID,
  ).toCollect - SHORT_BY,
);
/** The cash typed, the day's close asked, and then confirmed. */
const CASH_TYPED: Step[] = [{ fill: 'reconcile.cash', text: CASH_SHORT }];
const CLOSE_ASKED: Step[] = [...CASH_TYPED, { press: 'reconcile.close' }];
const CLOSE_CONFIRMED: Step[] = [...CLOSE_ASKED, { press: 'reconcile.closeConfirm' }];

/** One's own password typed: the current one, the new one, and the new one again. */
const NEW_PASSWORD: Step[] = [
  { fill: 'ownPassword.current', text: 'Old-password-1!' },
  { fill: 'ownPassword.new', text: 'New-password-2@' },
  { fill: 'ownPassword.again', text: 'New-password-2@' },
  { press: 'ownPassword.submit' },
];

/** The staff file chosen on the import page. */
const IMPORT_CHOSEN: Step[] = [{ attach: 'import.file', file: 'import' }];

/** A person's name replaced, for the screens that save it. */
const RENAMED: Step[] = [{ fill: 'person.name', text: 'Trần Hùng' }, { press: 'person.save' }];

/** The customers' file, then the products', chosen on their import pages. */
const CUSTOMERS_CHOSEN: Step[] = [{ attach: 'import.file', file: 'customers' }];
const PRODUCTS_CHOSEN: Step[] = [{ attach: 'import.file', file: 'products' }];

/**
 * The walks: piece 1's, the client's admin on a PC, whose screens keep the app frame plan's
 * numbers and gain the ridge-app plan's screen 9; then the operator's, on a PC, numbered 1 to 9;
 * then piece 2's groups A, B, C and D (the staff setup, the staff, the office's, the phone's), each
 * screen a scene of the app on the fake; then the admin's customers and products from Excel.
 */
export const WALKS: Walk[] = [
  {
    id: 'admin-setup',
    person: 'admin',
    part: 'setup',
    title: {
      en: 'Set up the company: its name, colour and languages',
      vi: 'Thiết lập công ty: tên, màu và ngôn ngữ',
    },
    screens: [
      {
        id: '1-sign-in',
        number: 1,
        path: 'main',
        mock: { screen: 1, state: 'empty' },
        sentence: {
          en: 'Sign in, in the company’s name and colours',
          vi: 'Đăng nhập, mang tên và màu của công ty',
        },
        question: 'Would the admin know this is their app, and how to sign in?',
      },
      {
        id: '2-sign-in-refused',
        number: 2,
        path: 'wrong',
        mock: { screen: 2, state: 'failed' },
        sentence: { en: 'Sign-in refused', vi: 'Đăng nhập bị từ chối' },
        question: 'Does this say what to do?',
      },
      {
        id: '3-settings',
        number: 3,
        path: 'main',
        mock: { screen: 3, state: 'filled' },
        sentence: {
          en: 'Settings: name, logo, colour, languages',
          vi: 'Cài đặt: tên, logo, màu, ngôn ngữ',
        },
        question: 'Is this what an admin sets up first?',
      },
      {
        id: '4-saved',
        number: 4,
        path: 'main',
        mock: { screen: 4, state: 'filled' },
        sentence: {
          en: 'Saved: the app shows the new name and colour',
          vi: 'Đã lưu: ứng dụng hiện tên và màu mới',
        },
        question: 'Does the change show where the admin expects?',
      },
      {
        id: '5-language-menu',
        number: 5,
        path: 'main',
        mock: { screen: 5, state: 'filled' },
        sentence: { en: 'The language switched', vi: 'Đã đổi ngôn ngữ' },
        question: 'Is the switch where a user would look?',
      },
      {
        id: '6-service-down',
        number: 6,
        path: 'wrong',
        mock: { screen: 6, state: 'failed' },
        sentence: {
          en: 'The service down at start',
          vi: 'Dịch vụ không hoạt động khi khởi động',
        },
        question: 'Would the admin know it is not their fault, and to try again?',
      },
      {
        id: '7-save-failed',
        number: 7,
        path: 'wrong',
        mock: { screen: 3, state: 'save-failed' },
        sentence: {
          en: 'A save that failed, what was typed kept',
          vi: 'Lưu không thành công, nội dung đã nhập vẫn còn',
        },
        question: 'Would the admin know the save did not happen, and that nothing typed is lost?',
      },
      {
        id: '8-save-conflict',
        number: 8,
        path: 'wrong',
        mock: { screen: 3, state: 'conflict' },
        sentence: {
          en: 'Someone else saved first, what was typed kept',
          vi: 'Người khác đã lưu trước, nội dung đã nhập vẫn còn',
        },
        question: 'Would the admin know someone else saved first, and how to see what they saved?',
      },
      {
        id: '9-unknown-company',
        number: 9,
        path: 'wrong',
        mock: { screen: 9, state: 'unknown' },
        sentence: {
          en: 'A link that names no company',
          vi: 'Đường dẫn không thuộc công ty nào',
        },
        question: 'Would the person know to ask whoever sent the link?',
      },
      {
        id: '10-saved-white',
        number: 10,
        path: 'main',
        mock: { screen: 10, state: 'filled' },
        sentence: {
          en: 'Saved: the header and the menu in white',
          vi: 'Đã lưu: đầu trang và menu màu trắng',
        },
        question: 'Do the name, the buttons and the menu read clearly on white?',
      },
      {
        id: '11-menu-icons',
        number: 11,
        path: 'main',
        mock: { screen: 11, state: 'filled' },
        sentence: {
          en: 'The menu hidden to its icons',
          vi: 'Menu ẩn còn lại các biểu tượng',
        },
        question: 'Would a person on a PC know which page each icon opens?',
      },
    ],
  },
  {
    id: 'operator-setup',
    person: 'operator',
    part: 'setup',
    title: {
      en: 'Make a client and send it its link',
      vi: 'Tạo khách hàng và gửi đường dẫn cho họ',
    },
    screens: [
      {
        id: 'op-1-sign-in',
        number: 1,
        path: 'main',
        scene: { path: '/operator' },
        sentence: {
          en: 'Sign in at the operator’s page',
          vi: 'Đăng nhập tại trang người vận hành',
        },
        question: 'Would you know this is our own door, not a client’s?',
      },
      {
        id: 'op-2-new-client',
        number: 2,
        path: 'main',
        scene: { path: '/operator/clients/new', operator: true, steps: FILLED_CLIENT },
        sentence: {
          en: 'A new client: its code and the company’s name, in the frame',
          vi: 'Khách hàng mới: mã và tên công ty, trong khung',
        },
        question: 'Is this all you need to start a client?',
      },
      {
        id: 'op-3-made',
        number: 3,
        path: 'main',
        scene: {
          path: '/operator/clients/new',
          operator: true,
          steps: [...FILLED_CLIENT, { press: 'operator.make' }],
        },
        sentence: {
          en: 'Made: the link, the root’s name and its first password, once, to copy',
          vi: 'Đã tạo: đường dẫn, tên tài khoản root và mật khẩu đầu tiên, chỉ một lần, để sao chép',
        },
        question:
          'Would you know what to send the client, and that the password is not shown again?',
      },
      {
        id: 'op-4-code-taken',
        number: 4,
        path: 'wrong',
        scene: {
          path: '/operator/clients/new',
          operator: true,
          steps: [
            { fill: 'operator.code', text: 'hoa-sen' },
            { fill: 'operator.companyName', text: 'Hoa Sen' },
            { press: 'operator.make' },
          ],
        },
        sentence: { en: 'The code already taken', vi: 'Mã đã được dùng' },
        question: 'Does this say what to do?',
      },
      {
        id: 'op-5-dashboard',
        number: 5,
        path: 'main',
        navigation: true,
        scene: { path: '/operator/clients', operator: true },
        sentence: {
          en: 'The dashboard: the five sections, who is signed in, the clients newest first with the day each was made and a New root password button on each',
          vi: 'Bảng điều khiển: năm mục, người đang đăng nhập, khách hàng mới nhất trước kèm ngày tạo và nút Mật khẩu root mới ở mỗi dòng',
        },
        question:
          'Is this what you need to see of your clients, and are these the sections you expect?',
      },
      {
        id: 'op-6-coming-soon',
        number: 6,
        path: 'main',
        scene: { path: '/operator/usage', operator: true },
        sentence: {
          en: 'A section coming soon (Usage and costs)',
          vi: 'Một mục sắp có (Mức dùng và chi phí)',
        },
        question: 'Is it clear this part is not built yet?',
      },
      {
        id: 'op-7-list-failed',
        number: 7,
        path: 'wrong',
        scene: { path: '/operator/clients', operator: true, cue: 'listClients:503' },
        sentence: { en: 'The list could not be loaded', vi: 'Không tải được danh sách' },
        question: 'Would you know it is not your fault, and to try again?',
      },
      {
        id: 'op-8-code-invalid',
        number: 8,
        path: 'wrong',
        scene: {
          path: '/operator/clients/new',
          operator: true,
          steps: [
            { fill: 'operator.code', text: 'minh phat' },
            { fill: 'operator.companyName', text: 'Minh Phát' },
            { press: 'operator.make' },
          ],
        },
        sentence: {
          en: 'A code not in the form, said before anything is sent',
          vi: 'Mã không đúng dạng, báo trước khi gửi đi',
        },
        question: 'Does this say what to fix?',
      },
      {
        id: 'op-9-make-failed',
        number: 9,
        path: 'wrong',
        scene: {
          path: '/operator/clients/new',
          operator: true,
          cue: 'makeClient:503',
          steps: [...FILLED_CLIENT, { press: 'operator.make' }],
        },
        sentence: {
          en: 'The client was not made, what was typed kept',
          vi: 'Chưa tạo được khách hàng, những gì đã nhập vẫn còn',
        },
        question: 'Would you know the client was not made, and that nothing typed is lost?',
      },
    ],
  },

  {
    id: 'operator-passkeys',
    person: 'operator',
    part: 'setup',
    title: {
      en: 'Sign in with a passkey, and keep one’s passkeys',
      vi: 'Đăng nhập bằng khóa truy cập và quản lý khóa của mình',
    },
    screens: [
      {
        id: 'pk-1-join',
        number: 1,
        path: 'main',
        scene: { path: JOIN_LINK },
        sentence: {
          en: 'A join link opened: whose it is, who made it, and the button to make a passkey',
          vi: 'Mở đường dẫn tham gia: của ai, ai tạo, và nút tạo khóa truy cập',
        },
        question: 'Would the new operator know what this is and what to do?',
      },
      {
        id: 'pk-2-passkeys',
        number: 2,
        path: 'main',
        scene: { path: '/operator/passkeys', operator: true },
        sentence: {
          en: 'One’s own passkeys: when each was added and last used, add one, remove one',
          vi: 'Khóa truy cập của mình: ngày thêm và dùng lần cuối, thêm, xóa',
        },
        question: 'Would you keep a second passkey here, and tell them apart?',
      },
      {
        id: 'pk-3-not-given',
        number: 3,
        path: 'wrong',
        scene: {
          path: '/operator',
          cue: 'passkey:notGiven',
          steps: [{ press: 'passkey.signInButton' }],
        },
        sentence: { en: 'The passkey not given', vi: 'Chưa có khóa truy cập nào được đưa ra' },
        question: 'Does this say what to do?',
      },
      {
        id: 'pk-4-no-operator',
        number: 4,
        path: 'wrong',
        scene: {
          path: '/operator',
          cue: 'operatorPasskeySignIn:401',
          steps: [{ press: 'passkey.signInButton' }],
        },
        sentence: {
          en: 'A passkey that opens nothing here',
          vi: 'Khóa truy cập không mở được gì ở đây',
        },
        question: 'Would you know to ask another operator?',
      },
      {
        id: 'pk-5-link-dead',
        number: 5,
        path: 'wrong',
        scene: { path: JOIN_LINK, cue: 'operatorJoinOptions:404' },
        sentence: {
          en: 'A link used, too old or replaced',
          vi: 'Đường dẫn đã dùng, quá cũ hoặc đã bị thay',
        },
        question: 'Would you know to ask for a new link?',
      },
      {
        id: 'pk-6-sign-in-ended',
        number: 6,
        path: 'wrong',
        scene: {
          path: '/operator/clients/new',
          operator: true,
          cue: 'makeClient:401',
          steps: [...FILLED_CLIENT, { press: 'operator.make' }],
        },
        sentence: {
          en: 'The sign-in ended mid-task: one touch to go on, what was typed kept',
          vi: 'Phiên đăng nhập kết thúc giữa chừng: chạm một lần để tiếp tục, những gì đã nhập vẫn còn',
        },
        question: 'Would you know nothing typed is lost, and to press save again?',
      },
    ],
  },

  {
    id: 'operator-services',
    person: 'operator',
    part: 'setup',
    title: {
      en: 'The services status: whether each part answers',
      vi: 'Trạng thái dịch vụ: từng phần có trả lời không',
    },
    screens: [
      {
        id: 'sv-1-all-well',
        number: 1,
        path: 'main',
        scene: { path: '/operator/services', operator: true },
        sentence: {
          en: 'All three answer, one build',
          vi: 'Cả ba đều trả lời, cùng một bản dựng',
        },
        question: 'Would you know from this that all is well?',
      },
      {
        id: 'sv-2-two-builds',
        number: 2,
        path: 'wrong',
        scene: { path: '/operator/services', operator: true, drift: true },
        sentence: {
          en: 'Two builds: a deploy half done',
          vi: 'Hai bản dựng: đợt triển khai làm được nửa chừng',
        },
        question: 'Would you know what is out of step?',
      },
      {
        id: 'sv-3-storage-silent',
        number: 3,
        path: 'wrong',
        scene: { path: '/operator/services', operator: true, cue: 'operatorServices:503' },
        sentence: {
          en: 'c-storage does not answer',
          vi: 'c-storage không trả lời',
        },
        question: 'Would you know what is down and what it stops?',
      },
      {
        id: 'sv-4-bff-silent',
        number: 4,
        path: 'wrong',
        scene: { path: '/operator/services', operator: true, cue: 'operatorServices:silent' },
        sentence: {
          en: 'The BFF does not answer',
          vi: 'BFF không trả lời',
        },
        question: 'Would you know what is down, and what cannot be seen?',
      },
      {
        id: 'sv-5-unavailable',
        number: 5,
        path: 'wrong',
        scene: {
          path: '/operator',
          cue: 'operatorPasskeyOptions:503',
          steps: [{ press: 'passkey.signInButton' }],
        },
        sentence: {
          en: 'Before sign-in: the service unavailable, naming the hop',
          vi: 'Trước khi đăng nhập: dịch vụ không khả dụng, nói rõ chặng nào',
        },
        question: 'Would you know where it fails without signing in?',
      },
    ],
  },

  {
    id: 'admin-staff-setup',
    person: 'admin',
    part: 'setup',
    title: {
      en: 'The staff setup: departments and positions',
      vi: 'Thiết lập nhân viên: phòng ban và chức vụ',
    },
    screens: [
      {
        id: 'setup-1-departments-positions',
        number: 1,
        path: 'main',
        scene: { path: '/staff-setup' },
        sentence: {
          en: 'Departments and positions, each with what its staff may do',
          vi: 'Phòng ban và chức vụ, mỗi nơi kèm những việc nhân viên được làm',
        },
        question: 'Is this how the admin would say who does what?',
      },
      {
        id: 'setup-2-fields',
        number: 2,
        path: 'main',
        scene: { path: '/staff-setup', steps: [{ press: 'setup.ownAdd' }] },
        sentence: {
          en: 'The person’s fields: the switches, the company’s own fields, the code numbering',
          vi: 'Các mục của một người: công tắc, mục riêng của công ty, cách đánh mã',
        },
        question: 'Are these the choices a company makes about its staff records?',
      },
    ],
  },
  {
    id: 'admin-staff',
    person: 'admin',
    part: 'staff',
    title: {
      en: 'Take on staff: their records, sign-ins and import',
      vi: 'Tiếp nhận nhân viên: hồ sơ, đăng nhập và nhập từ Excel',
    },
    screens: [
      {
        id: 'staff-1-list',
        number: 1,
        path: 'main',
        scene: { path: '/staff' },
        sentence: {
          en: 'The staff list: name, code, department, position, phone, status',
          vi: 'Danh sách nhân viên: tên, mã, phòng ban, chức vụ, điện thoại, trạng thái',
        },
        question: 'Is this what the admin needs to see about the staff at a glance?',
      },
      {
        id: 'staff-2-add',
        number: 2,
        path: 'main',
        scene: { path: '/staff/new', steps: FILLED_ADD },
        sentence: {
          en: 'Adding a person: name, code, phone, department, position, note',
          vi: 'Thêm một người: tên, mã, điện thoại, phòng ban, chức vụ, ghi chú',
        },
        question: 'Are these the details a business takes when it hires?',
      },
      {
        id: 'staff-3-added',
        number: 3,
        path: 'main',
        scene: { path: '/staff/new', steps: [...FILLED_ADD, { press: 'addPerson.submit' }] },
        sentence: {
          en: 'Added: the sign-in name and a first password, shown once',
          vi: 'Đã thêm: tên đăng nhập và mật khẩu đầu tiên, chỉ hiện một lần',
        },
        question:
          'Would the admin know what to hand over, and that the password is not shown again?',
      },
      {
        id: 'staff-4-person',
        number: 4,
        path: 'main',
        scene: { path: personAt('EMP-0002') },
        sentence: {
          en: 'A person’s page: details, note, how they sign in',
          vi: 'Trang của một người: thông tin, ghi chú, cách đăng nhập',
        },
        question: 'Is anything missing from a person’s page?',
      },
      {
        id: 'staff-5-permissions',
        number: 5,
        path: 'main',
        scene: {
          path: personAt('EMP-0004'),
          steps: [{ press: 'permissions.allow', within: 'permissions.staff_canDelete' }],
        },
        sentence: {
          en: 'A person’s own permissions, over their department’s and position’s',
          vi: 'Quyền riêng của một người, đè lên quyền của phòng ban và chức vụ',
        },
        question: 'Would the admin see what this person may do, and what is theirs alone?',
      },
      {
        id: 'staff-6-password',
        number: 6,
        path: 'main',
        scene: { path: personAt('EMP-0007'), steps: [{ press: 'person.passwordMake' }] },
        sentence: {
          en: 'A password typed or made, shown once',
          vi: 'Mật khẩu tự nhập hoặc do ứng dụng tạo, chỉ hiện một lần',
        },
        question: 'Is a password from the person’s page how a business would do it?',
      },
      {
        id: 'staff-7-archive',
        number: 7,
        path: 'main',
        scene: { path: personAt('EMP-0006'), steps: [{ press: 'person.archive' }] },
        sentence: {
          en: 'Lock, after a check: their sign-in stops at once, their record is kept',
          vi: 'Khóa, sau khi hỏi lại: đăng nhập dừng ngay, hồ sơ vẫn được giữ',
        },
        question: 'Is “lock” the word for someone who left, and is the check clear?',
      },
      {
        id: 'staff-8-left',
        number: 8,
        path: 'main',
        scene: { path: '/staff?status=inactive' },
        sentence: {
          en: 'Inactive: people who left, by the status choice',
          vi: 'Ngừng hoạt động: người đã nghỉ việc, theo lựa chọn trạng thái',
        },
        question: 'Should the admin find people who left this way?',
      },
      {
        id: 'staff-9-code-taken',
        number: 9,
        path: 'wrong',
        scene: {
          path: '/staff/new',
          steps: [
            { fill: 'addPerson.name', text: 'Mai Linh' },
            { fill: 'addPerson.code', text: 'EMP-0008' },
            { press: 'addPerson.submit' },
          ],
        },
        sentence: { en: 'The code already taken', vi: 'Mã đã được dùng' },
        question: 'Does this say what to fix?',
      },
      {
        id: 'staff-10-save-conflict',
        number: 10,
        path: 'wrong',
        scene: { path: personAt('EMP-0002'), cue: 'saveEmployee:409', steps: RENAMED },
        sentence: {
          en: 'Someone else saved first, what was typed kept',
          vi: 'Người khác đã lưu trước, nội dung đã nhập vẫn còn',
        },
        question: 'Would the admin know someone else saved first, and how to see what they saved?',
      },
      {
        id: 'staff-11-save-failed',
        number: 11,
        path: 'wrong',
        scene: { path: personAt('EMP-0002'), cue: 'saveEmployee:503', steps: RENAMED },
        sentence: {
          en: 'A save that failed, what was typed kept',
          vi: 'Lưu không thành công, nội dung đã nhập vẫn còn',
        },
        question: 'Would the admin know the save did not happen, and that nothing typed is lost?',
      },
      {
        id: 'staff-12-own-fields',
        number: 12,
        path: 'main',
        scene: { path: '/staff/new', steps: FILLED_OWN },
        sentence: {
          en: 'Adding a person with the company’s own fields and a second phone; the code numbered',
          vi: 'Thêm một người với các mục riêng của công ty và điện thoại thứ hai; mã tự đánh số',
        },
        question: 'Does the form hold what this company keeps?',
      },
      {
        id: 'staff-13-photo',
        number: 13,
        path: 'main',
        scene: { path: personAt('EMP-0003') },
        sentence: { en: 'A person’s photo', vi: 'Ảnh của một người' },
        question: 'Is the photo where the admin would look for it?',
      },
      {
        id: 'staff-14-search',
        number: 14,
        path: 'main',
        scene: {
          path: '/staff',
          steps: [
            { fill: 'staff.search', text: 'phong' },
            { choose: 'staff.filterPosition', option: 'Quản lý' },
          ],
        },
        sentence: {
          en: 'The list searched and filtered; the address keeps them',
          vi: 'Danh sách đã tìm và lọc; địa chỉ giữ lại các lựa chọn',
        },
        question: 'Would the admin find a person this way?',
      },
      {
        id: 'staff-15-code-changed',
        number: 15,
        path: 'main',
        scene: {
          path: personAt('EMP-0004'),
          steps: [{ fill: 'person.codeNew', text: 'nv-12' }, { press: 'person.codeSet' }],
        },
        sentence: {
          en: 'A code changed: the person signs in with the new one',
          vi: 'Đã đổi mã: người đó đăng nhập bằng mã mới',
        },
        question: 'Is it clear the old code no longer signs in?',
      },
      {
        id: 'staff-16-field-refused',
        number: 16,
        path: 'wrong',
        scene: {
          path: '/staff/new',
          steps: [
            { fill: 'addPerson.name', text: 'Mai Linh' },
            { fill: 'field.dependants', text: 'two' },
            { press: 'addPerson.submit' },
          ],
        },
        sentence: {
          en: 'A value the company’s own field refuses',
          vi: 'Giá trị mà mục riêng của công ty không nhận',
        },
        question: 'Does this say what to fix?',
      },
      {
        id: 'staff-17-email',
        number: 17,
        path: 'main',
        scene: {
          path: personAt('EMP-0002'),
          signIns: true,
          steps: [
            { fill: 'person.emailNew', text: 'hung@minh-phat.example' },
            { press: 'person.emailSet' },
          ],
        },
        sentence: {
          en: 'An email given: the person may sign in with it',
          vi: 'Đã cấp email: người đó có thể đăng nhập bằng email',
        },
        question: 'Is it clear the email is a second way to sign in, and that no mail is sent?',
      },
      {
        id: 'staff-18-qr',
        number: 18,
        path: 'main',
        scene: { path: personAt('EMP-0004'), signIns: true, steps: [{ press: 'person.qrShow' }] },
        sentence: {
          en: 'A QR code and its link, for one sign-in within 15 minutes',
          vi: 'Mã QR và đường dẫn của nó, để đăng nhập một lần trong 15 phút',
        },
        question: 'Would the admin know to show it, and that it works once?',
      },
      {
        id: 'staff-19-import',
        number: 19,
        path: 'main',
        scene: { path: '/staff/import', steps: [{ attach: 'import.file', file: 'import' }] },
        sentence: {
          en: 'Import: the template, and the file chosen',
          vi: 'Nhập từ Excel: tệp mẫu và tệp đã chọn',
        },
        question: 'Would the admin know to fill the template and choose it?',
      },
      {
        id: 'staff-20-preview',
        number: 20,
        path: 'main',
        scene: { path: '/staff/import', steps: [...IMPORT_CHOSEN, { press: 'import.read' }] },
        sentence: {
          en: 'Before saving: each row read, with the reasons for the refused',
          vi: 'Trước khi lưu: từng dòng đã đọc, kèm lý do cho các dòng bị từ chối',
        },
        question: 'Would the admin know which rows will be added and why others are not?',
      },
      {
        id: 'staff-21-imported',
        number: 21,
        path: 'main',
        scene: {
          path: '/staff/import',
          steps: [
            ...IMPORT_CHOSEN,
            { press: 'import.read' },
            { press: 'import.add', with: { count: '3' } },
          ],
        },
        sentence: {
          en: 'Imported: the people added, without sign-ins yet',
          vi: 'Đã nhập: những người được thêm, chưa có tên đăng nhập',
        },
        question: 'Would the admin know each still needs a sign-in?',
      },
      {
        id: 'staff-22-no-name',
        number: 22,
        path: 'wrong',
        scene: {
          path: '/staff/import',
          steps: [{ attach: 'import.file', file: 'import-no-name' }, { press: 'import.read' }],
        },
        sentence: { en: 'A file without the name column', vi: 'Tệp không có cột tên' },
        question: 'Does this say what to fix?',
      },
      {
        id: 'staff-23-back-on',
        number: 23,
        path: 'main',
        scene: {
          path: personAt('EMP-0008'),
          steps: [
            { press: 'person.restore' },
            { press: 'person.restoreConfirm', with: { name: 'Hoàng Gia Huy' } },
          ],
        },
        sentence: {
          en: 'Someone who left, switched back on: the record as it was, and they sign in as before',
          vi: 'Người đã nghỉ, được mở khóa lại: hồ sơ như cũ, và họ đăng nhập như trước',
        },
        question: 'Is anything lost from the record of someone switched back on?',
      },
    ],
  },
  {
    id: 'office-staff',
    person: 'office',
    part: 'staff',
    title: {
      en: 'Look up and add staff, as allowed',
      vi: 'Tra cứu và thêm nhân viên, theo quyền được cấp',
    },
    screens: [
      {
        id: 'office-1-menu',
        number: 1,
        path: 'main',
        scene: { path: '/staff', as: 'EMP-0001' },
        navigation: true,
        sentence: {
          en: 'Signed in with a code: the menu and the buttons their permissions allow',
          vi: 'Đăng nhập bằng mã: menu và các nút theo quyền của họ',
        },
        question: 'Should office staff see and do this, and nothing more?',
      },
      {
        id: 'office-2-add',
        number: 2,
        path: 'main',
        scene: {
          path: '/staff/new',
          as: 'EMP-0001',
          steps: [...FILLED_ADD_BY_OFFICE, { press: 'addPerson.submit' }],
        },
        sentence: {
          en: 'Adding a person without a sign-in, which the root gives',
          vi: 'Thêm một người chưa có đăng nhập, do root cấp',
        },
        question: 'Is it clear who gives the sign-in?',
      },
      {
        id: 'office-3-forbidden',
        number: 3,
        path: 'wrong',
        scene: { path: '/staff-setup', as: 'EMP-0001' },
        sentence: {
          en: 'A page this person may not open',
          vi: 'Một trang người này không được mở',
        },
        question: 'Does this say why, and whom to ask?',
      },
      {
        id: 'office-4-nothing',
        number: 4,
        path: 'wrong',
        scene: { path: '/staff', as: 'EMP-0005', noDrivers: true },
        sentence: {
          en: 'Someone allowed nothing: nothing to work on yet',
          vi: 'Người chưa được phép làm gì: chưa có việc nào',
        },
        question: 'Would the person know to ask their admin?',
      },
      {
        id: 'office-5-settings',
        number: 5,
        path: 'main',
        scene: { path: '/settings', as: 'EMP-0003' },
        navigation: true,
        sentence: {
          en: 'Allowed to change the settings: Settings in the menu',
          vi: 'Được đổi thiết lập: có mục Thiết lập trong menu',
        },
        question: 'Is it clear this person may change the company’s settings?',
      },
      {
        id: 'office-6-password',
        number: 6,
        path: 'main',
        scene: { path: '/password', as: 'EMP-0001', steps: NEW_PASSWORD },
        sentence: {
          en: 'Changing one’s own password',
          vi: 'Tự đổi mật khẩu của mình',
        },
        question: 'Would a person find this, and know what to type?',
      },
      {
        id: 'office-7-password-wrong',
        number: 7,
        path: 'wrong',
        scene: {
          path: '/password',
          as: 'EMP-0001',
          cue: 'changePassword:403',
          steps: NEW_PASSWORD,
        },
        sentence: {
          en: 'The current password wrong',
          vi: 'Mật khẩu hiện tại không đúng',
        },
        question: 'Does this say what to fix?',
      },
    ],
  },
  {
    id: 'phone-sign-in',
    person: 'driver',
    part: 'staff',
    title: { en: 'Sign in by a QR code', vi: 'Đăng nhập bằng mã QR' },
    screens: [
      {
        id: 'phone-1-signed-in',
        number: 1,
        path: 'main',
        scene: { path: qrLinkWith(DEMO_QR_SECRET), signIns: true, out: true },
        sentence: {
          en: 'Signed in on a phone by the code, on the person’s first page',
          vi: 'Đăng nhập trên điện thoại bằng mã, vào trang đầu tiên của người đó',
        },
        question: 'Would the person know they are in, and where?',
      },
      {
        id: 'phone-2-code-used',
        number: 2,
        path: 'wrong',
        scene: { path: qrLinkWith('used-before-qr-code'), signIns: true, out: true },
        sentence: {
          en: 'A code used before, or past its 15 minutes',
          vi: 'Mã đã dùng rồi, hoặc đã quá 15 phút',
        },
        question: 'Would the person know to ask for a new one?',
      },
    ],
  },
  {
    id: 'admin-lists',
    person: 'admin',
    part: 'setup',
    title: {
      en: 'Customers and products from Excel',
      vi: 'Khách hàng và sản phẩm từ Excel',
    },
    screens: [
      {
        id: 'lists-1-customers',
        number: 1,
        path: 'main',
        scene: { path: '/customers' },
        sentence: {
          en: 'The customer list: code, name, phone, address',
          vi: 'Danh sách khách hàng: mã, tên, điện thoại, địa chỉ',
        },
        question: 'Is this what the office needs to see about its customers at a glance?',
      },
      {
        id: 'lists-2-customers-import',
        number: 2,
        path: 'main',
        scene: { path: '/customers/import', steps: CUSTOMERS_CHOSEN },
        sentence: {
          en: 'Import: the template, and the file chosen',
          vi: 'Nhập từ Excel: tệp mẫu và tệp đã chọn',
        },
        question: 'Would the admin know to fill the template and choose it?',
      },
      {
        id: 'lists-3-customers-preview',
        number: 3,
        path: 'main',
        scene: {
          path: '/customers/import',
          steps: [...CUSTOMERS_CHOSEN, { press: 'import.read' }],
        },
        sentence: {
          en: 'Before saving: each row read, with the reasons for the refused',
          vi: 'Trước khi lưu: từng dòng đã đọc, kèm lý do cho các dòng bị từ chối',
        },
        question: 'Would the admin know which customers will be added, and why the others are not?',
      },
      {
        id: 'lists-4-customers-added',
        number: 4,
        path: 'main',
        scene: {
          path: '/customers/import',
          steps: [
            ...CUSTOMERS_CHOSEN,
            { press: 'import.read' },
            { press: 'lists.customers.add', with: { count: '3' } },
          ],
        },
        sentence: {
          en: 'Imported: the customers added',
          vi: 'Đã nhập: những khách hàng được thêm',
        },
        question: 'Would the admin know they are now in the list?',
      },
      {
        id: 'lists-5-no-code',
        number: 5,
        path: 'wrong',
        scene: {
          path: '/customers/import',
          steps: [{ attach: 'import.file', file: 'customers-no-code' }, { press: 'import.read' }],
        },
        sentence: { en: 'A file without the code column', vi: 'Tệp không có cột mã' },
        question: 'Does this say what to fix?',
      },
      {
        id: 'lists-6-products',
        number: 6,
        path: 'main',
        scene: { path: '/products' },
        sentence: {
          en: 'The product list: code, name, unit, price',
          vi: 'Danh sách sản phẩm: mã, tên, đơn vị tính, giá',
        },
        question: 'Is this what the office needs to see about its products at a glance?',
      },
      {
        id: 'lists-7-products-preview',
        number: 7,
        path: 'main',
        scene: {
          path: '/products/import',
          steps: [...PRODUCTS_CHOSEN, { press: 'import.read' }],
        },
        sentence: {
          en: 'Before saving: a price that is no price, refused',
          vi: 'Trước khi lưu: một giá không phải là giá, bị từ chối',
        },
        question: 'Would the admin know which products will be added, and what to fix in a price?',
      },
      {
        id: 'lists-8-products-added',
        number: 8,
        path: 'main',
        scene: {
          path: '/products/import',
          steps: [
            ...PRODUCTS_CHOSEN,
            { press: 'import.read' },
            { press: 'lists.products.add', with: { count: '3' } },
          ],
        },
        sentence: {
          en: 'Imported: the products added',
          vi: 'Đã nhập: những sản phẩm được thêm',
        },
        question: 'Would the admin know they are now in the list?',
      },
      {
        id: 'lists-9-more',
        number: 9,
        path: 'main',
        scene: { path: '/more' },
        sentence: {
          en: 'More: the pages the phone’s bar leaves out, then the password and sign-out',
          vi: 'Thêm: các trang thanh dưới của điện thoại không có, rồi đổi mật khẩu và đăng xuất',
        },
        question: 'Would a person on a phone find the other pages and sign-out here?',
      },
      {
        id: 'lists-10-customer',
        number: 10,
        path: 'main',
        scene: { path: `/customers/${NOTED_CUSTOMER.id}` },
        sentence: {
          en: 'A customer’s page: code, name, phone and address on the left, the note on the right',
          vi: 'Trang khách hàng: mã, tên, điện thoại, địa chỉ bên trái, ghi chú bên phải',
        },
        question: 'Does this show the office what the old app showed about a customer?',
      },
      {
        id: 'lists-11-customer-no-note',
        number: 11,
        path: 'main',
        scene: { path: `/customers/${PLAIN_CUSTOMER.id}` },
        sentence: {
          en: 'A customer with no note: one column at the full width, no blank half',
          vi: 'Khách hàng không có ghi chú: một cột đủ chiều rộng, không để trống nửa trang',
        },
        question: 'Does a customer with no note read well in one full column?',
      },
    ],
  },
  {
    id: 'office-orders',
    person: 'office',
    part: 'orders',
    title: { en: 'An order, sent to a driver', vi: 'Một đơn hàng, giao cho tài xế' },
    screens: [
      {
        id: 'orders-1-list',
        number: 1,
        path: 'main',
        scene: { path: '/orders', as: 'EMP-0001' },
        sentence: {
          en: 'Orders: the last 7 days’, with number, customer, total, state and driver',
          vi: 'Đơn hàng: 7 ngày gần đây, kèm số, khách hàng, tổng tiền, trạng thái và tài xế',
        },
        question: 'Is this what the office needs to see of its week’s orders at a glance?',
      },
      {
        id: 'orders-2-new',
        number: 2,
        path: 'main',
        scene: { path: '/orders/new', as: 'EMP-0001', steps: FILLED_ORDER },
        sentence: {
          en: 'A new order: a customer, two products at their prices, the total',
          vi: 'Đơn hàng mới: một khách hàng, hai sản phẩm theo giá, và tổng tiền',
        },
        question: 'Is this how the office would take an order?',
      },
      {
        id: 'orders-3-confirm',
        number: 3,
        path: 'main',
        scene: {
          path: DRAFT_PATH,
          as: 'EMP-0001',
          steps: [{ choose: 'orders.driver', option: DRIVER_CHOICE }],
        },
        sentence: {
          en: 'Confirm: the driver and the day, today chosen',
          vi: 'Xác nhận: chọn tài xế và ngày, hôm nay đã được chọn sẵn',
        },
        question: 'Would the office know whom it goes to, and when?',
      },
      {
        id: 'orders-4-confirmed',
        number: 4,
        path: 'main',
        scene: {
          path: DRAFT_PATH,
          as: 'EMP-0001',
          steps: [
            { choose: 'orders.driver', option: DRIVER_CHOICE },
            { press: 'orders.confirmSubmit' },
          ],
        },
        sentence: {
          en: 'Confirmed: the order’s number and its request’s',
          vi: 'Đã xác nhận: số đơn hàng và số yêu cầu giao hàng của nó',
        },
        question: 'Would the office know the order is confirmed and with the driver?',
      },
      {
        id: 'orders-5-requests',
        number: 5,
        path: 'main',
        scene: { path: '/deliveries', as: 'EMP-0001' },
        sentence: {
          en: 'Delivery requests: today’s, by driver',
          vi: 'Yêu cầu giao hàng: của hôm nay, theo tài xế',
        },
        question: 'Is this how the office would see who delivers what today?',
      },
      {
        id: 'orders-6-request',
        number: 6,
        path: 'main',
        scene: { path: `/deliveries/${WAITING_TODAY.day}/${WAITING_TODAY.id}`, as: 'EMP-0001' },
        sentence: {
          en: 'A delivery request opened: customer, address, lines, total to collect',
          vi: 'Một yêu cầu giao hàng: khách hàng, địa chỉ, các dòng hàng, số tiền cần thu',
        },
        question: 'Is anything missing that the office or the driver needs?',
      },
      {
        id: 'orders-7-cancelled',
        number: 7,
        path: 'main',
        scene: {
          path: `/deliveries/${WAITING_TODAY.day}/${WAITING_TODAY.id}`,
          as: 'EMP-0001',
          steps: [
            { press: 'orders.cancelRequest' },
            { press: 'orders.cancelRequestConfirm', with: { number: WAITING_TODAY.number } },
            { press: 'orders.openOrder' },
          ],
        },
        sentence: {
          en: 'A request cancelled: its order offers to send it again',
          vi: 'Một yêu cầu đã hủy: đơn hàng của nó cho phép gửi lại',
        },
        question: 'Would the office know how to send it again?',
      },
      {
        id: 'orders-8-conflict',
        number: 8,
        path: 'wrong',
        scene: {
          path: DRAFT_PATH,
          as: 'EMP-0001',
          cue: 'saveOrder:409',
          steps: [...CHANGED_DRAFT, { press: 'orders.saveDraft' }],
        },
        sentence: {
          en: 'Someone else saved the draft first, what was typed kept',
          vi: 'Có người đã lưu bản nháp trước, những gì đã nhập vẫn còn',
        },
        question: 'Would the office know someone else saved first, and how to see it?',
      },
      {
        id: 'orders-9-confirm-failed',
        number: 9,
        path: 'wrong',
        scene: {
          path: DRAFT_PATH,
          as: 'EMP-0001',
          cue: 'confirmOrder:503',
          steps: [
            { choose: 'orders.driver', option: DRIVER_CHOICE },
            { press: 'orders.confirmSubmit' },
          ],
        },
        sentence: {
          en: 'A confirm that failed, what was typed kept',
          vi: 'Xác nhận không thành công, những gì đã nhập vẫn còn',
        },
        question: 'Would the office know nothing was sent, and nothing typed is lost?',
      },
      {
        id: 'orders-10-no-drivers',
        number: 10,
        path: 'wrong',
        scene: { path: DRAFT_PATH, as: 'EMP-0001', noDrivers: true },
        sentence: {
          en: 'No one is allowed to deliver yet',
          vi: 'Chưa ai được phép giao hàng',
        },
        question: 'Would the office know to ask the admin?',
      },
      {
        id: 'orders-11-fulfilled',
        number: 11,
        path: 'main',
        scene: { path: FULFILLED_PATH, as: 'EMP-0001' },
        sentence: {
          en: 'An order fulfilled: its request delivered',
          vi: 'Một đơn hàng đã hoàn tất: yêu cầu giao hàng của nó đã được giao',
        },
        question: 'Would the office know this order is delivered and done?',
      },
      {
        id: 'orders-12-proof',
        number: 12,
        path: 'main',
        scene: {
          path: `/deliveries/${DELIVERED_TODAY.day}/${DELIVERED_TODAY.id}`,
          as: 'EMP-0001',
        },
        sentence: {
          en: 'A delivered request, with the driver’s photo',
          vi: 'Một yêu cầu đã giao, kèm ảnh của tài xế',
        },
        question: 'Would the office take this photo as proof of delivery?',
      },
    ],
  },
  {
    id: 'driver-deliveries',
    person: 'driver',
    part: 'delivery',
    title: { en: 'Delivering with a photo', vi: 'Giao hàng kèm ảnh' },
    screens: [
      {
        id: 'driver-1-today',
        number: 1,
        path: 'main',
        scene: { path: qrLinkWith(DEMO_DRIVER_QR_SECRET, DRIVER), signIns: true, out: true },
        sentence: {
          en: 'Signed in by the code: today’s deliveries, those waiting first',
          vi: 'Đăng nhập bằng mã: các đơn giao hôm nay, đơn đang chờ lên trước',
        },
        question: 'Would the driver know what to deliver today, and where?',
      },
      {
        id: 'driver-2-request',
        number: 2,
        path: 'main',
        scene: {
          path: `/my-deliveries/${WAITING_OF_DRIVER.day}/${WAITING_OF_DRIVER.id}`,
          as: DRIVER,
        },
        sentence: {
          en: 'A request opened: customer, phone, address, goods, money to collect',
          vi: 'Một yêu cầu: khách hàng, điện thoại, địa chỉ, hàng hóa, số tiền cần thu',
        },
        question: 'Would the driver know what to hand over and what to collect?',
      },
      {
        id: 'driver-3-photo',
        number: 3,
        path: 'main',
        scene: {
          path: `/my-deliveries/${WAITING_OF_DRIVER.day}/${WAITING_OF_DRIVER.id}`,
          as: DRIVER,
          steps: PHOTO_TAKEN,
        },
        sentence: {
          en: 'The photo taken, before it is sent',
          vi: 'Ảnh đã chụp, trước khi gửi',
        },
        question: 'Would the driver know to send it, or to take it again?',
      },
      {
        id: 'driver-4-delivered',
        number: 4,
        path: 'main',
        scene: {
          path: `/my-deliveries/${WAITING_OF_DRIVER.day}/${WAITING_OF_DRIVER.id}`,
          as: DRIVER,
          steps: SENT,
        },
        sentence: {
          en: 'Delivered: the request with its photo',
          vi: 'Đã giao: yêu cầu kèm ảnh của nó',
        },
        question: 'Would the driver know it is done?',
      },
      {
        id: 'driver-5-send-failed',
        number: 5,
        path: 'wrong',
        scene: {
          path: `/my-deliveries/${WAITING_OF_DRIVER.day}/${WAITING_OF_DRIVER.id}`,
          as: DRIVER,
          cue: 'deliver:503',
          steps: SENT,
        },
        sentence: {
          en: 'A send that failed, the photo kept',
          vi: 'Gửi không thành công, ảnh vẫn còn',
        },
        question: 'Would the driver know nothing was lost, and to try again?',
      },
      {
        id: 'driver-6-cancelled',
        number: 6,
        path: 'wrong',
        scene: {
          path: `/my-deliveries/${WAITING_OF_DRIVER.day}/${WAITING_OF_DRIVER.id}`,
          as: DRIVER,
          cue: 'deliver:409',
          steps: SENT,
        },
        sentence: {
          en: 'The office cancelled it first',
          vi: 'Văn phòng đã hủy trước',
        },
        question: 'Would the driver know not to deliver it?',
      },
    ],
  },
  {
    id: 'office-reconcile',
    person: 'office',
    part: 'day-end',
    title: { en: 'Each driver’s day settled', vi: 'Đối soát ngày của từng tài xế' },
    screens: [
      {
        id: 'reconcile-1-requests',
        number: 1,
        path: 'main',
        scene: { path: '/deliveries', as: 'EMP-0001' },
        sentence: {
          en: 'Delivery requests: each driver’s cash to bring back, delivered n of m, the day open',
          vi: 'Yêu cầu giao hàng: tiền mặt tài xế cần mang về, đã giao n trên m, ngày chưa chốt',
        },
        question:
          'Would the office know whose day is still to settle, and what each should bring back?',
      },
      {
        id: 'reconcile-2-day',
        number: 2,
        path: 'main',
        scene: { path: DRIVER_DAY_PATH, as: 'EMP-0001' },
        sentence: {
          en: 'A driver’s day: the delivered requests and their sum, the one still waiting apart',
          vi: 'Ngày của một tài xế: các yêu cầu đã giao và tổng của chúng, yêu cầu còn chờ để riêng',
        },
        question:
          'Would the office know how much this driver should hand in, and for which deliveries?',
      },
      {
        id: 'reconcile-3-cash',
        number: 3,
        path: 'main',
        scene: { path: DRIVER_DAY_PATH, as: 'EMP-0001', steps: CASH_TYPED },
        sentence: {
          en: 'The cash typed: short by 20,000 đồng',
          vi: 'Đã nhập tiền mặt: thiếu 20.000 đồng',
        },
        question: 'Would the office see at once what is missing?',
      },
      {
        id: 'reconcile-4-check',
        number: 4,
        path: 'main',
        scene: { path: DRIVER_DAY_PATH, as: 'EMP-0001', steps: CLOSE_ASKED },
        sentence: {
          en: 'Close the day: the check names the cash, the gap and the request still waiting',
          vi: 'Chốt ngày: bước kiểm tra nêu tiền mặt, chênh lệch và yêu cầu còn chờ',
        },
        question: 'Would the office know what closing the day does?',
      },
      {
        id: 'reconcile-5-closed',
        number: 5,
        path: 'main',
        scene: { path: DRIVER_DAY_PATH, as: 'EMP-0001', steps: CLOSE_CONFIRMED },
        sentence: {
          en: 'Closed: to collect, handed in, the gap and who closed it',
          vi: 'Đã chốt: cần thu, đã nộp, chênh lệch và người chốt',
        },
        question: 'Would the office know this day is settled for good?',
      },
      {
        id: 'reconcile-6-yesterday',
        number: 6,
        path: 'main',
        scene: { path: `/deliveries?day=${addDays(DEMO_TODAY, -1)}`, as: 'EMP-0001' },
        sentence: {
          en: 'Yesterday: every driver’s day closed, one short',
          vi: 'Hôm qua: ngày của mọi tài xế đã chốt, một ngày thiếu tiền',
        },
        question: 'Would the office trust that the past days are settled?',
      },
      {
        id: 'reconcile-7-moved',
        number: 7,
        path: 'wrong',
        scene: {
          path: DRIVER_DAY_PATH,
          as: 'EMP-0001',
          cue: 'closeDay:409',
          steps: CLOSE_CONFIRMED,
        },
        sentence: {
          en: 'A delivery made meanwhile: the new figures, nothing closed',
          vi: 'Có yêu cầu vừa được giao: số liệu mới, chưa chốt gì',
        },
        question: 'Would the office know to count again before closing?',
      },
      {
        id: 'reconcile-8-failed',
        number: 8,
        path: 'wrong',
        scene: {
          path: DRIVER_DAY_PATH,
          as: 'EMP-0001',
          cue: 'closeDay:503',
          steps: CLOSE_CONFIRMED,
        },
        sentence: {
          en: 'A close that failed, the cash kept',
          vi: 'Chốt không thành công, tiền mặt đã nhập vẫn còn',
        },
        question: 'Would the office know nothing was closed, and to try again?',
      },
    ],
  },

  {
    id: 'operator-root-password',
    person: 'operator',
    part: 'setup',
    title: {
      en: 'Set a client’s root password anew',
      vi: 'Đặt lại mật khẩu root của khách hàng',
    },
    screens: [
      {
        id: 'rp-1-form',
        number: 1,
        path: 'main',
        scene: { path: ROOT_PASSWORD_PATH, operator: true, steps: ROOT_TYPED },
        sentence: {
          en: 'The page: the company, its code typed, the password twice, what it ends',
          vi: 'Trang này: tên công ty, mã đã nhập, mật khẩu hai lần, điều nó chấm dứt',
        },
        question:
          'Would you know whose password this changes, that their root is signed out, and that leaving it empty makes one?',
      },
      {
        id: 'rp-2-rule',
        number: 2,
        path: 'wrong',
        scene: {
          path: ROOT_PASSWORD_PATH,
          operator: true,
          steps: [
            ROOT_CODE,
            { fill: 'person.passwordNew', text: 'weak' },
            { fill: 'person.passwordAgain', text: 'weak' },
            { press: 'operator.rootSet' },
          ],
        },
        sentence: {
          en: 'A typed password refused on the form, the rule said',
          vi: 'Mật khẩu nhập bị từ chối ngay trên biểu mẫu, quy tắc được nêu rõ',
        },
        question: 'Does this say what to fix?',
      },
      {
        id: 'rp-3-made',
        number: 3,
        path: 'main',
        scene: {
          path: ROOT_PASSWORD_PATH,
          operator: true,
          steps: [ROOT_CODE, { press: 'operator.rootSet' }],
        },
        sentence: {
          en: 'Left empty, made: the new password, once, to copy and send',
          vi: 'Để trống, ứng dụng tạo: mật khẩu mới, chỉ một lần, để sao chép và gửi',
        },
        question: 'Would you know to send it to the root, and that it is not shown again?',
      },
      {
        id: 'rp-4-failed',
        number: 4,
        path: 'wrong',
        scene: {
          path: ROOT_PASSWORD_PATH,
          operator: true,
          cue: 'setRootPassword:503',
          steps: [...ROOT_TYPED, { press: 'operator.rootSet' }],
        },
        sentence: {
          en: 'Not set: the service failed, the password as it was',
          vi: 'Chưa đặt được: dịch vụ lỗi, mật khẩu vẫn như cũ',
        },
        question: 'Would you know nothing changed, and to try again?',
      },
    ],
  },

  {
    id: 'operator-team',
    person: 'operator',
    part: 'setup',
    title: {
      en: 'Who else may sign in here',
      vi: 'Ai khác được đăng nhập vào đây',
    },
    screens: [
      {
        id: 'tm-1-list',
        number: 1,
        path: 'main',
        scene: { path: '/operator/operators', operator: true },
        sentence: {
          en: 'The operators: name, state, added by whom (“—” once that one is deleted) and when, passkeys, last sign-in; you marked; every other row offers New link and Delete',
          vi: 'Các người vận hành: tên, trạng thái, ai thêm (“—” khi người đó đã bị xóa) và khi nào, khóa truy cập, lần đăng nhập gần nhất; bạn được đánh dấu; mỗi dòng còn lại có Đường dẫn mới và Xóa',
        },
        question:
          'Is this who you expect may sign in, and does every row but yours offer a new link and a delete?',
      },
      {
        id: 'tm-2-name',
        number: 2,
        path: 'main',
        scene: {
          path: '/operator/operators/new',
          operator: true,
          steps: [NEW_OPERATOR_NAME],
        },
        sentence: {
          en: 'Creating an operator: a name',
          vi: 'Tạo người vận hành: một cái tên',
        },
        question: 'Would you know that a name is all you give, and that your passkey is asked?',
      },
      {
        id: 'tm-3-added',
        number: 3,
        path: 'main',
        scene: {
          path: '/operator/operators/new',
          operator: true,
          steps: [NEW_OPERATOR_NAME, { press: 'team.make' }],
        },
        sentence: {
          en: 'Added: the join link, once, to send',
          vi: 'Đã thêm: đường dẫn tham gia, chỉ một lần, để gửi đi',
        },
        question:
          'Would you know to send the link to your colleague, and that it is not shown again?',
      },
      {
        id: 'tm-4-link',
        number: 4,
        path: 'main',
        scene: {
          path: `/operator/operators/${DEMO_COLLEAGUE_ID}/link`,
          operator: true,
          steps: [{ press: 'team.linkMake' }],
        },
        sentence: {
          en: 'A new link for a colleague who lost their passkeys: shown once, their old passkeys stop when they use it',
          vi: 'Đường dẫn mới cho đồng nghiệp đã mất khóa truy cập: chỉ hiện một lần, khóa cũ của họ ngừng hoạt động khi họ dùng nó',
        },
        question:
          'Would you know that their old passkeys stop only when they use the link, and that it is not shown again?',
      },
      {
        id: 'tm-5-delete',
        number: 5,
        path: 'main',
        scene: { path: `/operator/operators/${DEMO_COLLEAGUE_ID}/delete`, operator: true },
        sentence: {
          en: 'Deleting a colleague: what goes, and that they are signed out at their next step',
          vi: 'Xóa một đồng nghiệp: những gì sẽ mất, và họ bị đăng xuất ở bước tiếp theo',
        },
        question:
          'Would you know they are signed out at their next step, and come back only by a new invite?',
      },
      {
        id: 'tm-6-taken',
        number: 6,
        path: 'wrong',
        scene: {
          path: '/operator/operators/new',
          operator: true,
          steps: [
            { fill: 'team.nameLabel', text: DEMO_INVITED_NAME.toLowerCase() },
            { press: 'team.make' },
          ],
        },
        sentence: {
          en: 'The name taken',
          vi: 'Tên đã có người dùng',
        },
        question: 'Would you know the name is taken, that no one was added, and to choose another?',
      },
    ],
  },

  {
    id: 'operator-delete-client',
    person: 'operator',
    part: 'setup',
    title: {
      en: 'Delete a client and everything it owns',
      vi: 'Xóa một khách hàng và mọi thứ của họ',
    },
    screens: [
      {
        id: 'dc-1-page',
        number: 1,
        path: 'main',
        scene: { path: DELETE_CLIENT_PATH, operator: true },
        sentence: {
          en: 'The delete page before anything is pressed: the company, what goes and cannot come back, the code to type, the red button',
          vi: 'Trang xóa trước khi bấm gì: tên công ty, những gì sẽ mất và không thể khôi phục, mã cần nhập, nút đỏ',
        },
        question:
          'Does this read as a wall: would you know everything of this client goes for good, and that you must type its code first?',
      },
      {
        id: 'dc-2-code',
        number: 2,
        path: 'wrong',
        scene: {
          path: DELETE_CLIENT_PATH,
          operator: true,
          steps: [
            { fill: 'operator.deleteClientCodeLabel', text: 'binh-an' },
            { press: 'operator.deleteClientMake' },
          ],
        },
        sentence: {
          en: 'The wrong code typed: refused on the page, nothing sent',
          vi: 'Nhập sai mã: bị từ chối ngay trên trang, không gửi gì cả',
        },
        question: 'Would you know the client was not deleted, and to type the right code?',
      },
      {
        id: 'dc-3-failed',
        number: 3,
        path: 'wrong',
        scene: {
          path: DELETE_CLIENT_PATH,
          operator: true,
          cue: 'deleteClient:503',
          steps: [DELETE_CODE, { press: 'operator.deleteClientMake' }],
        },
        sentence: {
          en: 'The service failed: the client may not be fully deleted, look at the list and press again',
          vi: 'Dịch vụ lỗi: khách hàng có thể chưa bị xóa hết, hãy xem danh sách và bấm lại',
        },
        question:
          'Would you know the client may be only partly deleted, and that pressing again picks up where it stopped?',
      },
      {
        id: 'dc-4-gone',
        number: 4,
        path: 'main',
        scene: {
          path: DELETE_CLIENT_PATH,
          operator: true,
          steps: [DELETE_CODE, { press: 'operator.deleteClientMake' }],
        },
        sentence: {
          en: 'Deleted: the clients list comes back without the client',
          vi: 'Đã xóa: danh sách khách hàng hiện lại, không còn khách hàng đó',
        },
        question: 'Does the list read as finished: is the client gone from it?',
      },
    ],
  },
];

type DrawnState = MockScreen['states'][number];

/** A scene as the build draws it: the screen it is, in the walk it is in. */
export type DrawnScene = { id: string; walk: string; scene: Scene };

/** What a walk screen draws: a state of the mock, or a scene of the app. */
export type Drawn = DrawnState | DrawnScene;

/**
 * What each walk screen draws, under `walk:screen`: the mock's state a screen names, or its scene.
 * A screen naming a state the mock lacks stops the build, naming the walk, the screen and the
 * state.
 */
export function resolveDrawn(walks: readonly Walk[], mock: readonly MockScreen[]) {
  const drawn = new Map<string, Drawn>();
  for (const walk of walks) {
    for (const screen of walk.screens) {
      if (screen.scene) {
        drawn.set(`${walk.id}:${screen.id}`, { id: screen.id, walk: walk.id, scene: screen.scene });
        continue;
      }
      const found = mock
        .find((candidate) => candidate.number === screen.mock.screen)
        ?.states.find((state) => state.id === screen.mock.state);
      if (!found) {
        throw new Error(
          `walk ${walk.id}, screen ${screen.id}: the mock draws no state "${screen.mock.screen} ${screen.mock.state}"`,
        );
      }
      drawn.set(`${walk.id}:${screen.id}`, found);
    }
  }
  return drawn;
}

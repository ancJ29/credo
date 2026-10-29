import { LANGUAGES, type Language } from '@credo/shared';
import { DEMO_EMPLOYEES } from '@credo/shared/demo';
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
  | { choose: string; option: string };

/**
 * A screen drawn as the app itself on the fake, as a person meets it: opened at `path`, signed in
 * as the data-set person with this code (the root when none), with one call's failure cued, then
 * the steps.
 */
export type Scene = { path: string; as?: string; cue?: string; steps?: Step[] };

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

/** A person's name replaced, for the screens that save it. */
const RENAMED: Step[] = [{ fill: 'person.name', text: 'Trần Hùng' }, { press: 'person.save' }];

/**
 * The walks: piece 1's, the client's admin on a PC, whose screens keep the app frame plan's
 * numbers and gain the ridge-app plan's screen 9; then the operator's, on a PC, numbered 1 to 4;
 * then piece 2's groups A and B (the staff setup, the staff, the office's), each screen a scene of
 * the app on the fake. Group C adds the phone's walk, whose screens are all C's.
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
        mock: { screen: 11, state: 'empty' },
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
        mock: { screen: 12, state: 'typed' },
        sentence: {
          en: 'A new client: its code and the company’s name',
          vi: 'Khách hàng mới: mã và tên công ty',
        },
        question: 'Is this all you need to start a client?',
      },
      {
        id: 'op-3-made',
        number: 3,
        path: 'main',
        mock: { screen: 13, state: 'made' },
        sentence: {
          en: 'Made: the link, the root’s name and its first password, once',
          vi: 'Đã tạo: đường dẫn, tên tài khoản root và mật khẩu đầu tiên, chỉ một lần',
        },
        question:
          'Would you know what to send the client, and that the password is not shown again?',
      },
      {
        id: 'op-4-code-taken',
        number: 4,
        path: 'wrong',
        mock: { screen: 12, state: 'taken' },
        sentence: { en: 'The code already taken', vi: 'Mã đã được dùng' },
        question: 'Does this say what to do?',
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
          en: 'The staff list: name, code, department, position, phone',
          vi: 'Danh sách nhân viên: tên, mã, phòng ban, chức vụ, điện thoại',
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
          en: 'Archive, after a check: their sign-in stops at once, their record is kept',
          vi: 'Lưu trữ, sau khi hỏi lại: đăng nhập dừng ngay, hồ sơ vẫn được giữ',
        },
        question: 'Is “archive” the word for someone who left, and is the check clear?',
      },
      {
        id: 'staff-8-left',
        number: 8,
        path: 'main',
        scene: { path: '/staff', steps: [{ press: 'staff.showLeft' }] },
        sentence: {
          en: 'People who left, shown by the filter',
          vi: 'Người đã nghỉ việc, hiện bằng bộ lọc',
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
        scene: { path: '/staff', as: 'EMP-0005' },
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
    ],
  },
];

/** The key an answer is kept under. */
export const answerKey = (walk: string, screen: string, language: Language) =>
  `${walk}:${screen}:${language}`;

/** Every key the walks can be answered under, in the walks' order. */
export const allKeys = (walks: readonly Walk[]) =>
  walks.flatMap((walk) =>
    walk.screens.flatMap((screen) =>
      LANGUAGES.map((language) => answerKey(walk.id, screen.id, language)),
    ),
  );

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

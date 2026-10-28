import { LANGUAGES, type Language } from '@credo/shared';
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

export type Person = { id: string; name: Bilingual; device: Device };
export type Part = { id: string; name: Bilingual };

type WalkScreen = {
  /** The walk spec's name for the screen, which is also its base image's: `3-settings`. */
  id: string;
  number: number;
  path: 'main' | 'wrong';
  /** The mock's screen and state it shows. */
  mock: { screen: number; state: string };
  /** What the screen is, in each language. */
  sentence: Bilingual;
  /** The one question the human answers, in English. */
  question: string;
  /** Set when the screen is about the menu of pages, so its words keep the menu. */
  navigation?: true;
};

export type Walk = {
  id: string;
  person: string;
  part: string;
  title: Bilingual;
  screens: WalkScreen[];
};

/** The map's people, down, each on their device. */
export const PEOPLE: Person[] = [
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

/** Piece 1's walk, the client's admin on a PC; the screens keep the app frame plan's numbers. */
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

export type DrawnState = MockScreen['states'][number];

/**
 * The mock's state each walk screen names. A screen naming a state the mock lacks stops the
 * build, naming the walk, the screen and the state.
 */
export function resolveStates(walks: readonly Walk[], mock: readonly MockScreen[]) {
  const states = new Map<string, DrawnState>();
  for (const walk of walks) {
    for (const screen of walk.screens) {
      const found = mock
        .find((candidate) => candidate.number === screen.mock.screen)
        ?.states.find((state) => state.id === screen.mock.state);
      if (!found) {
        throw new Error(
          `walk ${walk.id}, screen ${screen.id}: the mock draws no state "${screen.mock.screen} ${screen.mock.state}"`,
        );
      }
      states.set(`${walk.id}:${screen.id}`, found);
    }
  }
  return states;
}

import type { Language } from '@credo/shared';

/**
 * The words a gallery sample says that no screen says (a person, a shop, a message), in both
 * languages. A word a screen says is read from the dictionary by its key, never written here, and
 * nothing of the data set is imported: the app's bundle holds this file in the gallery's chunk.
 */
export const SAMPLES: Record<
  Language,
  {
    person: string;
    phone: string;
    people: readonly { name: string; phone: string }[];
    staffMember: string;
    actions: string;
    changesKept: string;
  }
> = {
  en: {
    person: 'An Nguyen',
    phone: '0901 234 567',
    people: [
      { name: 'An Nguyen', phone: '0901 234 567' },
      { name: 'Binh Tran', phone: '0902 345 678' },
      { name: 'Chi Le', phone: '0903 456 789' },
    ],
    staffMember: 'Staff member',
    actions: 'Actions',
    changesKept: 'Changes are kept when you save.',
  },
  vi: {
    person: 'Nguyễn Văn An',
    phone: '0901 234 567',
    people: [
      { name: 'Nguyễn Văn An', phone: '0901 234 567' },
      { name: 'Trần Thị Bình', phone: '0902 345 678' },
      { name: 'Lê Minh Chi', phone: '0903 456 789' },
    ],
    staffMember: 'Nhân viên',
    actions: 'Thao tác',
    changesKept: 'Thay đổi được lưu khi bạn bấm lưu.',
  },
};

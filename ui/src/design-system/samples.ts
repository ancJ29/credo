import type { Language } from '@credo/shared';
import { useTranslation } from 'react-i18next';

/** The language the gallery's stage draws in: the one its provider was started with. */
export function useLanguage(): Language {
  return useTranslation().i18n.language === 'en' ? 'en' : 'vi';
}

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
    lines: readonly { name: string; quantity: number; amount: number }[];
    staffMember: string;
    actions: string;
    changesKept: string;
    shop: string;
    shopAddress: string;
    address: string;
    email: string;
    save: string;
    cancel: string;
    saveDraft: string;
    send: string;
    deleteRecord: string;
    mainAction: string;
    otherAction: string;
    quietAction: string;
    aField: string;
    aBadge: string;
    or: string;
    useLink: string;
    linkTitle: string;
    linkSubtitle: string;
    scanQr: string;
    enterCode: string;
    backToSignIn: string;
    codeValue: string;
    secretValue: string;
    passwordHint: string;
    departmentHint: string;
    departmentError: string;
    colourHint: string;
    colourError: string;
    departmentValue: string;
    messages: Record<string, string>;
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
    lines: [
      { name: 'Sticky rice', quantity: 12, amount: 480000 },
      { name: 'Fish sauce', quantity: 6, amount: 270000 },
      { name: 'Jasmine tea', quantity: 3, amount: 195000 },
    ],
    staffMember: 'Staff member',
    actions: 'Actions',
    changesKept: 'Changes are kept when you save.',
    shop: 'An Phat',
    shopAddress: '12 Le Loi',
    address: 'Address',
    email: 'Email',
    save: 'Save',
    cancel: 'Cancel',
    saveDraft: 'Save a draft',
    send: 'Send',
    deleteRecord: 'Delete the record',
    mainAction: 'Main action',
    otherAction: 'Other action',
    quietAction: 'Quiet action',
    aField: 'A field',
    aBadge: 'A badge',
    or: 'or',
    useLink: 'Use a sign-in link',
    linkTitle: 'Sign in with a link',
    linkSubtitle: 'Scan the QR code or enter the sign-in code to sign in',
    scanQr: 'Scan the QR code',
    enterCode: 'Enter the code by hand',
    backToSignIn: 'Back to sign-in',
    codeValue: 'NV-001',
    secretValue: 'a-long-secret',
    passwordHint: 'At least eight characters.',
    departmentHint: 'The department the person works in.',
    departmentError: 'Pick a department first.',
    colourHint: 'A hex value such as the palette gives.',
    colourError: 'Enter the colour as # and six hex digits.',
    departmentValue: 'Sales',
    messages: {
      Error: 'The name could not be saved.',
      Warning: 'Someone changed this record first.',
      Success: 'The order was sent.',
      Info: 'Prices change on the first of the month.',
      Saved: 'Saved.',
      Standing: 'This client has no staff yet, so nothing can move.',
      'Not found': 'This address names no page.',
    },
  },
  vi: {
    person: 'Nguyễn Văn An',
    phone: '0901 234 567',
    people: [
      { name: 'Nguyễn Văn An', phone: '0901 234 567' },
      { name: 'Trần Thị Bình', phone: '0902 345 678' },
      { name: 'Lê Minh Chi', phone: '0903 456 789' },
    ],
    lines: [
      { name: 'Gạo nếp', quantity: 12, amount: 480000 },
      { name: 'Nước mắm', quantity: 6, amount: 270000 },
      { name: 'Trà nhài', quantity: 3, amount: 195000 },
    ],
    staffMember: 'Nhân viên',
    actions: 'Thao tác',
    changesKept: 'Thay đổi được lưu khi bạn bấm lưu.',
    shop: 'Công ty An Phát',
    shopAddress: '12 Lê Lợi',
    address: 'Địa chỉ',
    email: 'Email',
    save: 'Lưu',
    cancel: 'Hủy',
    saveDraft: 'Lưu nháp',
    send: 'Gửi',
    deleteRecord: 'Xóa bản ghi',
    mainAction: 'Thao tác chính',
    otherAction: 'Thao tác khác',
    quietAction: 'Thao tác phụ',
    aField: 'Một ô nhập',
    aBadge: 'Một nhãn',
    or: 'hoặc',
    useLink: 'Dùng liên kết đăng nhập',
    linkTitle: 'Đăng nhập bằng liên kết',
    linkSubtitle: 'Quét mã QR hoặc nhập mã đăng nhập để đăng nhập',
    scanQr: 'Quét mã QR',
    enterCode: 'Nhập mã thủ công',
    backToSignIn: 'Quay lại đăng nhập',
    codeValue: 'NV-001',
    secretValue: 'mat-khau-dai',
    passwordHint: 'Ít nhất tám ký tự.',
    departmentHint: 'Phòng ban mà nhân viên làm việc.',
    departmentError: 'Hãy chọn phòng ban trước.',
    colourHint: 'Mã màu như bảng màu cho.',
    colourError: 'Nhập màu dạng # và sáu chữ số hex.',
    departmentValue: 'Kinh doanh',
    messages: {
      Error: 'Không thể lưu tên.',
      Warning: 'Người khác đã sửa bản ghi này trước.',
      Success: 'Đã gửi đơn hàng.',
      Info: 'Giá thay đổi vào ngày đầu mỗi tháng.',
      Saved: 'Đã lưu.',
      Standing: 'Khách hàng này chưa có nhân viên nên chưa thể thao tác.',
      'Not found': 'Địa chỉ này không có trang nào.',
    },
  },
};

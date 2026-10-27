import type { Dictionary } from './en';

export const vi: Dictionary = {
  app: { name: 'Credo' },
  common: {
    loading: 'Đang tải',
    retry: 'Thử lại',
    loadFailed: 'Không tải được trang này. Những gì bạn đã nhập không mất: hãy thử lại.',
  },
  auth: {
    title: 'Đăng nhập',
    username: 'Tên đăng nhập',
    password: 'Mật khẩu',
    submit: 'Đăng nhập',
    refused: 'Tên đăng nhập hoặc mật khẩu không đúng. Hãy kiểm tra và thử lại.',
  },
  nav: { menu: 'Menu', settings: 'Cài đặt' },
  user: { language: 'Ngôn ngữ', signOut: 'Đăng xuất' },
  settings: {
    title: 'Cài đặt',
    intro: 'Những gì nhân viên của bạn thấy trên mọi màn hình, kể cả màn hình đăng nhập.',
    name: 'Tên công ty',
    logo: 'Logo',
    logoNone: 'Chưa có logo',
    logoChoose: 'Chọn logo',
    logoRemove: 'Bỏ logo',
    colour: 'Màu thương hiệu',
    languages: 'Ngôn ngữ cho phép dùng',
    defaultLanguage: 'Ngôn ngữ khi ai đó mở ứng dụng lần đầu',
    save: 'Lưu',
    saved: 'Đã lưu. Tên và màu mới hiện trên mọi màn hình.',
    saveFailed: 'Chưa lưu được cài đặt. Những gì bạn đã nhập vẫn còn đây: hãy thử lại.',
    conflict: 'Có người đã lưu cài đặt mới hơn. Thay đổi của bạn chưa được lưu.',
    conflictReload: 'Xem cài đặt mới hơn',
  },
  boot: {
    unavailableTitle: 'Dịch vụ chưa trả lời',
    unavailable: 'Đây không phải lỗi của bạn. Hãy chờ một lát rồi thử lại.',
  },
};

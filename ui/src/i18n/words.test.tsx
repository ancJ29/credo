import { cleanup } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { draw } from '../../tests/render';
import { OperatorSignIn } from '../pages/operator/OperatorSignIn';
import { QrLanding } from '../pages/client/QrLanding';
import { SignIn } from '../pages/SignIn';

/** Every word each door said before the frame was redrawn, in both languages, as it was read off the
 * doors at that time: the text in their order, and each field's placeholder. */
const BEFORE: Record<string, string[]> = {
  'en signin': [
    'Minh Phát',
    'Sign in to your account',
    'Username',
    'Enter your username',
    'Password',
    'Enter your password',
    'Sign In',
  ],
  'en signin-refused': [
    'Minh Phát',
    'Sign in to your account',
    'Wrong username or password.',
    'Username',
    'Enter your username',
    'Password',
    'Enter your password',
    'Sign In',
  ],
  'en operator': [
    'Credo',
    'Operator sign-in',
    'Your device will ask for your fingerprint, face or PIN.',
    'Sign in with a passkey',
  ],
  'en operator-notgiven': [
    'Credo',
    'Operator sign-in',
    'No passkey was given. Try again when you are ready.',
    'Your device will ask for your fingerprint, face or PIN.',
    'Sign in with a passkey',
  ],
  'en operator-refused': [
    'Credo',
    'Operator sign-in',
    'No operator here has this passkey. Ask another operator for a new link.',
    'Your device will ask for your fingerprint, face or PIN.',
    'Sign in with a passkey',
  ],
  'en qr-busy': ['Minh Phát', 'Signing you in', 'One moment.'],
  'en qr-refused': [
    'Minh Phát',
    'This code cannot sign you in',
    'It was used already, or its 15 minutes are over. Ask your admin for a new one.',
    'Sign in with a password',
  ],
  'vi signin': [
    'Minh Phát',
    'Đăng nhập vào tài khoản của bạn',
    'Tên đăng nhập',
    'Nhập tên đăng nhập',
    'Mật khẩu',
    'Nhập mật khẩu',
    'Đăng nhập',
  ],
  'vi signin-refused': [
    'Minh Phát',
    'Đăng nhập vào tài khoản của bạn',
    'Sai tên đăng nhập hoặc mật khẩu.',
    'Tên đăng nhập',
    'Nhập tên đăng nhập',
    'Mật khẩu',
    'Nhập mật khẩu',
    'Đăng nhập',
  ],
  'vi operator': [
    'Credo',
    'Đăng nhập người vận hành',
    'Thiết bị sẽ yêu cầu vân tay, khuôn mặt hoặc mã PIN của bạn.',
    'Đăng nhập bằng khóa truy cập',
  ],
  'vi operator-notgiven': [
    'Credo',
    'Đăng nhập người vận hành',
    'Chưa có khóa truy cập nào được đưa ra. Hãy thử lại khi bạn sẵn sàng.',
    'Thiết bị sẽ yêu cầu vân tay, khuôn mặt hoặc mã PIN của bạn.',
    'Đăng nhập bằng khóa truy cập',
  ],
  'vi operator-refused': [
    'Credo',
    'Đăng nhập người vận hành',
    'Không có người vận hành nào ở đây dùng khóa truy cập này. Hãy nhờ một người vận hành khác gửi đường dẫn mới.',
    'Thiết bị sẽ yêu cầu vân tay, khuôn mặt hoặc mã PIN của bạn.',
    'Đăng nhập bằng khóa truy cập',
  ],
  'vi qr-busy': ['Minh Phát', 'Đang đăng nhập cho bạn', 'Xin chờ một chút.'],
  'vi qr-refused': [
    'Minh Phát',
    'Mã này không đăng nhập được',
    'Mã đã được dùng, hoặc đã quá 15 phút. Hãy nhờ quản trị viên cấp mã mới.',
    'Đăng nhập bằng mật khẩu',
  ],
};

/** The words a drawn door shows, in order: its texts and its fields' placeholders. */
const wordsOf = (container: HTMLElement) => {
  const words: string[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === 3 && node.textContent?.trim()) words.push(node.textContent.trim());
    if (node.nodeName !== 'STYLE') node.childNodes.forEach(walk);
    if (node instanceof HTMLInputElement && node.placeholder) words.push(node.placeholder);
  };
  walk(container);
  return words;
};

const brand = { name: 'Minh Phát', logo: null };
const doors: [string, ReactNode][] = [
  ['signin', <SignIn brand={brand} status="idle" onSubmit={vi.fn()} />],
  ['signin-refused', <SignIn brand={brand} status="refused" onSubmit={vi.fn()} />],
  ['operator', <OperatorSignIn status="idle" onSubmit={vi.fn()} />],
  ['operator-notgiven', <OperatorSignIn status="notGiven" onSubmit={vi.fn()} />],
  ['operator-refused', <OperatorSignIn status="refused" onSubmit={vi.fn()} />],
  ['qr-busy', <QrLanding brand={brand} status="busy" onPassword={vi.fn()} />],
  ['qr-refused', <QrLanding brand={brand} status="refused" onPassword={vi.fn()} />],
];

describe('the words of the doors', () => {
  it('8: every word each door says is the word it said before, in English and in Vietnamese', () => {
    for (const language of ['en', 'vi'] as const) {
      for (const [name, door] of doors) {
        const { container } = draw(door, language);
        expect(wordsOf(container), `${language} ${name}`).toEqual(BEFORE[`${language} ${name}`]);
        cleanup();
      }
    }
  });
});

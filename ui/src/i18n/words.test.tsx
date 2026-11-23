import { cleanup } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { draw } from '../../tests/render';
import { DICTIONARIES } from './index';
import { OperatorSignIn } from '../pages/operator/OperatorSignIn';
import { QrLanding } from '../pages/client/QrLanding';
import { SignIn } from '../pages/SignIn';

type Words = (typeof DICTIONARIES)['en'];

/** What each door says, in order, as the keys of the dictionary it draws from: its texts and each
 * field's placeholder. The brand's name is data. */
const KEYS: Record<string, (w: Words) => string[]> = {
  signin: (w) => [
    'Minh Phát',
    w.auth.title,
    w.auth.username,
    w.auth.usernamePlaceholder,
    w.auth.password,
    w.auth.passwordPlaceholder,
    w.auth.remember,
    w.auth.submit,
  ],
  'signin-refused': (w) => [
    'Minh Phát',
    w.auth.title,
    w.auth.refused,
    w.auth.username,
    w.auth.usernamePlaceholder,
    w.auth.password,
    w.auth.passwordPlaceholder,
    w.auth.remember,
    w.auth.submit,
  ],
  operator: (w) => ['Credo', w.operator.signIn, w.passkey.signInHint, w.passkey.signInButton],
  'operator-notgiven': (w) => [
    'Credo',
    w.operator.signIn,
    w.passkey.notGiven,
    w.passkey.signInHint,
    w.passkey.signInButton,
  ],
  'operator-refused': (w) => [
    'Credo',
    w.operator.signIn,
    w.passkey.refused,
    w.passkey.signInHint,
    w.passkey.signInButton,
  ],
  'qr-busy': (w) => ['Minh Phát', w.qrSignIn.busyTitle, w.qrSignIn.busyText],
  'qr-refused': (w) => [
    'Minh Phát',
    w.qrSignIn.refusedTitle,
    w.qrSignIn.refusedText,
    w.qrSignIn.password,
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
  it('8: every word each door says is the word of its keys, in order, in English and in Vietnamese', () => {
    for (const language of ['en', 'vi'] as const) {
      for (const [name, door] of doors) {
        const { container } = draw(door, language);
        expect(wordsOf(container), `${language} ${name}`).toEqual(
          KEYS[name](DICTIONARIES[language]),
        );
        cleanup();
      }
    }
  });
});

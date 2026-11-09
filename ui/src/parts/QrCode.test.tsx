import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { QrCode } from './QrCode';

const path = (value: string) => {
  const { container, unmount } = render(<QrCode value={value} label="QR" />);
  const d = [...container.querySelectorAll('path')].map((p) => p.getAttribute('d')).join('');
  unmount();
  return d;
};

describe('QrCode', () => {
  it('draws the value as a labelled image of modules, not an icon', () => {
    render(<QrCode value="https://x.test/login?qr=a.b" label="Sign-in QR" />);
    const image = screen.getByRole('img', { name: 'Sign-in QR' });
    expect(image.tagName.toLowerCase()).toBe('svg');
    expect(path('https://x.test/login?qr=a.b').length).toBeGreaterThan(100);
  });

  it('draws a different picture for a different value', () => {
    expect(path('https://x.test/a')).not.toBe(path('https://x.test/b'));
  });
});

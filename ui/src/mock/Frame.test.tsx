import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Frame } from './Frame';

const frame = (language: 'vi' | 'en' = 'en') =>
  render(
    <Frame title="a frame" colour="#2f7d6d" language={language} scheme="dark" width={390}>
      <p>drawn inside</p>
    </Frame>,
  );

const loaded = () => {
  const iframe = screen.getByTitle<HTMLIFrameElement>('a frame');
  act(() => {
    fireEvent.load(iframe);
  });
  return iframe.contentDocument!;
};

describe('Frame', () => {
  it('is as wide as the device it stands for, and draws nothing until its page has loaded', () => {
    frame();
    const iframe = screen.getByTitle('a frame');

    expect(iframe.getAttribute('width')).toBe('390');
    expect(iframe.getAttribute('height')).toBe('780');
    expect(iframe.ownerDocument.body.textContent).not.toContain('drawn inside');
  });

  it('draws the screen inside its own page, in its colour scheme and language', () => {
    document.head.appendChild(document.createElement('style')).textContent = '.x{color:red}';
    frame('vi');

    const inner = loaded();

    expect(inner.body.textContent).toContain('drawn inside');
    expect(document.body.textContent).not.toContain('drawn inside');
    expect(inner.documentElement.lang).toBe('vi');
    expect(inner.documentElement.getAttribute('data-mantine-color-scheme')).toBe('dark');
    expect(inner.head.querySelector('style')!.textContent).toContain('.x{color:red}');
  });
});

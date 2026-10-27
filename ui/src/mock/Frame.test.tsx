import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
    expect(iframe.getAttribute('height')).toBe('320');
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

  it('is as tall as its screen, and no shorter than its floor', () => {
    const watching: (() => void)[] = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          watching.push(callback);
        }
        observe() {}
      },
    );
    frame();
    const inner = loaded();
    const height = (of: number) => {
      Object.defineProperty(inner.documentElement, 'scrollHeight', {
        value: of,
        configurable: true,
      });
      act(() => watching.forEach((fit) => fit()));
      return screen.getByTitle('a frame').getAttribute('height');
    };

    expect(height(612)).toBe('612');
    expect(height(100)).toBe('320');
    vi.unstubAllGlobals();
  });
});

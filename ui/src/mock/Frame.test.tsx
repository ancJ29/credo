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

  /** The page's MutationObserver, handed to a test so it can say when something inside changed. */
  const watchNodes = () => {
    const watching: { callback: () => void; target?: Node; options?: MutationObserverInit }[] = [];
    const disconnect = vi.fn();
    vi.stubGlobal(
      'MutationObserver',
      class {
        constructor(callback: () => void) {
          watching.push({ callback });
        }
        observe(target: Node, options: MutationObserverInit) {
          Object.assign(watching.at(-1)!, { target, options });
        }
        disconnect = disconnect;
      },
    );
    return { watching, disconnect };
  };

  it('is as tall as its screen, and no shorter than its floor', () => {
    const { watching } = watchNodes();
    frame();
    const inner = loaded();
    const height = (of: number) => {
      Object.defineProperty(inner.documentElement, 'scrollHeight', {
        value: of,
        configurable: true,
      });
      act(() => watching.forEach(({ callback }) => callback()));
      return screen.getByTitle('a frame').getAttribute('height');
    };

    expect(height(612)).toBe('612');
    expect(height(100)).toBe('320');
    vi.unstubAllGlobals();
  });

  it('measures its screen when a node, an attribute or a text inside changes, and never because its own height did', () => {
    const { watching } = watchNodes();
    const resize = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor() {
          resize();
        }
        observe() {}
      },
    );
    frame();
    const inner = loaded();

    expect(watching).toHaveLength(1);
    expect(watching[0].target).toBe(inner.documentElement);
    expect(watching[0].options).toEqual({
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });
    expect(resize).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  const tall = (inner: Document, of: number) =>
    Object.defineProperty(inner.documentElement, 'scrollHeight', { value: of, configurable: true });

  it('measures again when an image inside finishes loading', () => {
    watchNodes();
    frame();
    const inner = loaded();
    tall(inner, 700);

    act(() => {
      inner.body.dispatchEvent(new Event('load'));
    });

    expect(screen.getByTitle('a frame').getAttribute('height')).toBe('700');
    vi.unstubAllGlobals();
  });

  /** Lets the inner page's own load event, which jsdom fires after the frame's, pass first. */
  const later = () =>
    act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

  it('measures again when the fonts are ready', async () => {
    watchNodes();
    frame();
    const iframe = screen.getByTitle<HTMLIFrameElement>('a frame');
    let ready!: () => void;
    Object.defineProperty(iframe.contentDocument!, 'fonts', {
      configurable: true,
      value: Object.assign(new EventTarget(), {
        ready: new Promise<void>((resolve) => (ready = resolve)),
      }),
    });
    act(() => {
      fireEvent.load(iframe);
    });
    await later();
    tall(iframe.contentDocument!, 900);

    await act(async () => {
      ready();
      await Promise.resolve();
    });

    expect(iframe.getAttribute('height')).toBe('900');
    vi.unstubAllGlobals();
  });

  it('measures again when a font arrives after the fonts were ready', async () => {
    watchNodes();
    frame();
    const iframe = screen.getByTitle<HTMLIFrameElement>('a frame');
    const fonts = Object.assign(new EventTarget(), { ready: Promise.resolve() });
    Object.defineProperty(iframe.contentDocument!, 'fonts', { configurable: true, value: fonts });
    act(() => {
      fireEvent.load(iframe);
    });
    await later();
    tall(iframe.contentDocument!, 900);

    act(() => {
      fonts.dispatchEvent(new Event('loadingdone'));
    });

    expect(iframe.getAttribute('height')).toBe('900');
    vi.unstubAllGlobals();
  });

  it('keeps the scroll of the page and of the screen across the read at the floor', () => {
    watchNodes();
    frame();
    const iframe = screen.getByTitle<HTMLIFrameElement>('a frame');
    const sets: Record<string, number[]> = { page: [], screen: [] };
    const scrolled = (document: Document, at: number, name: string) =>
      Object.defineProperty(document.documentElement, 'scrollTop', {
        configurable: true,
        get: () => at,
        set: (to: number) => void sets[name].push(to),
      });
    act(() => {
      fireEvent.load(iframe);
    });
    scrolled(iframe.ownerDocument, 120, 'page');
    scrolled(iframe.contentDocument!, 40, 'screen');

    act(() => {
      iframe.contentDocument!.dispatchEvent(new Event('load'));
    });

    expect(sets).toEqual({ page: [120], screen: [40] });
    vi.unstubAllGlobals();
  });

  describe('with a shell that is never shorter than the frame (min-height: 100dvh)', () => {
    const settle = async () => {
      for (let i = 0; i < 10; i++) {
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 0));
        });
      }
    };
    const heightOf = (iframe: HTMLIFrameElement) => Number(iframe.getAttribute('height'));
    const change = async (inner: Document) => {
      act(() => {
        inner.body.appendChild(inner.createElement('i'));
      });
      await settle();
    };
    const open = (content: () => number, under: number) => {
      frame();
      const iframe = screen.getByTitle<HTMLIFrameElement>('a frame');
      act(() => {
        fireEvent.load(iframe);
      });
      const inner = iframe.contentDocument!;
      Object.defineProperty(inner.documentElement, 'scrollHeight', {
        configurable: true,
        get: () => Math.max(content(), heightOf(iframe)) + under,
      });
      return { iframe, inner };
    };

    it('takes what sits under the shell once, then stops growing', async () => {
      const { iframe, inner } = open(() => 400, 50);
      await change(inner);
      const first = heightOf(iframe);
      await change(inner);
      await change(inner);

      expect(heightOf(iframe)).toBe(first);
      expect(first).toBe(450);
    });

    it('comes down when the screen grows shorter', async () => {
      let content = 900;
      const { iframe, inner } = open(() => content, 0);
      await change(inner);
      expect(heightOf(iframe)).toBe(900);

      content = 500;
      await change(inner);

      expect(heightOf(iframe)).toBe(500);
    });
  });

  it('stops watching when it leaves', () => {
    const { disconnect } = watchNodes();
    const { unmount } = frame();
    loaded();

    unmount();

    expect(disconnect).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});

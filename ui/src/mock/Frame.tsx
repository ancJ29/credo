import type { Language, Width } from '@credo/shared';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MemoryRouter } from 'react-router';
import { Providers } from '../frame/Providers';

export type Scheme = 'light';
export type { Width };

type StageProps = {
  colour: string;
  language: Language;
  scheme: Scheme;
  /** The element that carries the colour scheme, where it is not the page's own. */
  root?: () => HTMLElement;
  /** Switches Mantine's transitions off, as the tests draw. */
  test?: boolean;
  /** The address the router starts at: Settings, for a mock screen. */
  path?: string;
  children: ReactNode;
};

type ViewportProps = Omit<StageProps, 'root' | 'path'> & { title: string; width: Width };
type Props = Omit<ViewportProps, 'test'> & { path?: string };

/** Where a mock screen's router starts: the page the screens are drawn from. */
const SETTINGS = '/settings';

/** What a mock screen is drawn inside: the app's look and words, and a router at Settings, or at
 * `path` for the whole app drawn as a scene. */
export function Stage({
  colour,
  language,
  scheme,
  root,
  test,
  path = SETTINGS,
  children,
}: StageProps) {
  return (
    <Providers colour={colour} language={language} scheme={scheme} root={root} test={test}>
      <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
    </Providers>
  );
}

/** The least a frame stands, and where it starts before its screen has told its height. */
const FLOOR = 320;

/**
 * One page in its own window: an iframe is the only box whose width is the viewport's, so the
 * app's breakpoints answer to the frame's width, not the host's. The page is drawn into it
 * with the host's styles copied in, and the frame is as tall as the page, never shorter than
 * `FLOOR`: a screen that fills the viewport (the sign-in's centred card) is then centred in a
 * frame that fits it, with no empty block above. It draws the look and the words and no router,
 * so a host that has one (the gallery's) reaches the page through the portal, and the mock's
 * `Frame` puts its own round the page.
 */
export function Viewport({
  title,
  colour,
  language,
  scheme,
  width,
  test,
  children,
}: ViewportProps) {
  const [body, setBody] = useState<HTMLElement | null>(null);
  const [height, setHeight] = useState(FLOOR);
  const watcher = useRef<MutationObserver>(undefined);
  useEffect(() => () => watcher.current?.disconnect(), []);

  const load = (frame: HTMLIFrameElement) => {
    const inner = frame.contentDocument!;
    for (const style of document.head.querySelectorAll('style, link[rel="stylesheet"]')) {
      inner.head.appendChild(style.cloneNode(true));
    }
    inner.documentElement.lang = language;
    setBody(inner.body);
    // The screen is measured when something inside it changes, never because the frame's own
    // height did. The app's shell is never shorter than the frame (min-height: 100dvh), so it is
    // read with the frame at its floor and put back: read at its present height, whatever sits
    // under the shell would be added each time, and the frame would never come down.
    const fit = () => {
      const page = frame.ownerDocument.documentElement;
      const [was, kept, keptInside] = [
        frame.height,
        page.scrollTop,
        inner.documentElement.scrollTop,
      ];
      frame.height = String(FLOOR);
      const tall = inner.documentElement.scrollHeight;
      frame.height = was;
      page.scrollTop = kept;
      inner.documentElement.scrollTop = keptInside;
      setHeight(Math.max(FLOOR, tall));
    };
    watcher.current = new MutationObserver(fit);
    watcher.current.observe(inner.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });
    // An image or a font that arrives later changes the height without changing a node.
    inner.addEventListener('load', fit, true);
    const fonts = (inner as Document & { fonts?: FontFaceSet }).fonts;
    void fonts?.ready.then(fit);
    fonts?.addEventListener('loadingdone', fit);
  };

  return (
    <>
      <iframe
        title={title}
        width={width}
        height={height}
        loading="lazy"
        srcDoc="<!doctype html><html><head><meta charset=utf-8></head><body></body></html>"
        style={{ border: '1px solid #8886', background: 'white', flex: 'none' }}
        onLoad={(event) => load(event.currentTarget)}
      />
      {body &&
        createPortal(
          <Providers
            colour={colour}
            language={language}
            scheme={scheme}
            root={() => body.ownerDocument.documentElement}
            test={test}
          >
            {children}
          </Providers>,
          body,
        )}
    </>
  );
}

/** One mock screen in its own page: `Viewport` with a router at Settings, or at `path` for the
 * whole app drawn as a scene. */
export function Frame({ path = SETTINGS, children, ...frame }: Props) {
  return (
    <Viewport {...frame}>
      <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
    </Viewport>
  );
}

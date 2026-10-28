import type { Language } from '@credo/shared';
import { type ReactNode, useState } from 'react';
import { createPortal } from 'react-dom';
import { MemoryRouter } from 'react-router';
import { Providers } from '../Providers';

export type Scheme = 'light' | 'dark';
export type Width = 390 | 768 | 1280;

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

type Props = Omit<StageProps, 'root' | 'test'> & { title: string; width: Width };

/** What a mock screen is drawn inside: the app's look and words, and a router at Settings, or at
 * `path` for the whole app drawn as a scene. */
export function Stage({
  colour,
  language,
  scheme,
  root,
  test,
  path = '/settings',
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
 * One screen in its own page: an iframe is the only box whose width is the viewport's, so the
 * app's breakpoints answer to the frame's width, not the mock's. The screen is drawn into it
 * with the page's own styles copied in, and the frame is as tall as the screen, never shorter
 * than `FLOOR`: a screen that fills the viewport (the sign-in's centred card) is then centred in
 * a frame that fits it, with no empty block above.
 */
export function Frame({ title, colour, language, scheme, width, path, children }: Props) {
  const [body, setBody] = useState<HTMLElement | null>(null);
  const [height, setHeight] = useState(FLOOR);

  const load = (frame: HTMLIFrameElement) => {
    const inner = frame.contentDocument!;
    for (const style of document.head.querySelectorAll('style, link[rel="stylesheet"]')) {
      inner.head.appendChild(style.cloneNode(true));
    }
    inner.documentElement.lang = language;
    setBody(inner.body);
    const fit = () => setHeight(Math.max(FLOOR, inner.documentElement.scrollHeight));
    new ResizeObserver(fit).observe(inner.documentElement);
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
          <Stage
            colour={colour}
            language={language}
            scheme={scheme}
            root={() => body.ownerDocument.documentElement}
            path={path}
          >
            {children}
          </Stage>,
          body,
        )}
    </>
  );
}

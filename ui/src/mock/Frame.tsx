import type { Language } from '@credo/shared';
import { type ReactNode, useState } from 'react';
import { createPortal } from 'react-dom';
import { MemoryRouter } from 'react-router';
import { Providers } from '../Providers';

export type Scheme = 'light' | 'dark';
export type Width = 390 | 1280;

type Props = {
  title: string;
  colour: string;
  language: Language;
  scheme: Scheme;
  width: Width;
  children: ReactNode;
};

const HEIGHT: Record<Width, number> = { 390: 780, 1280: 720 };

/**
 * One screen in its own page: an iframe is the only box whose width is the viewport's, so the
 * app's breakpoints answer to the frame's width, not the mock's. The screen is drawn into it
 * with the page's own styles copied in.
 */
export function Frame({ title, colour, language, scheme, width, children }: Props) {
  const [body, setBody] = useState<HTMLElement | null>(null);

  const load = (frame: HTMLIFrameElement) => {
    const inner = frame.contentDocument!;
    for (const style of document.head.querySelectorAll('style, link[rel="stylesheet"]')) {
      inner.head.appendChild(style.cloneNode(true));
    }
    inner.documentElement.lang = language;
    setBody(inner.body);
  };

  return (
    <>
      <iframe
        title={title}
        width={width}
        height={HEIGHT[width]}
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
          >
            <MemoryRouter initialEntries={['/settings']}>{children}</MemoryRouter>
          </Providers>,
          body,
        )}
    </>
  );
}

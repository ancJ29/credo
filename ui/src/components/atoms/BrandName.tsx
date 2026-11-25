import { isHexColour } from '@credo/shared';
import { VisuallyHidden } from '@mantine/core';
import { type ReactNode, useMemo } from 'react';

// Elements dropped with everything inside them; every other element not kept is unwrapped to its text.
const DROPPED = new Set(['script', 'style', 'template']);

// The one colour a span may carry: a style of exactly one `color` declaration holding a #rrggbb.
function colourOf(style: string | null) {
  const declarations = (style ?? '')
    .split(';')
    .map((each) => each.trim())
    .filter((each) => each !== '');
  const [only] = declarations;
  const at = only?.indexOf(':') ?? -1;
  if (declarations.length !== 1 || at < 0) return null;
  const value = only.slice(at + 1).trim();
  return only.slice(0, at).trim().toLowerCase() === 'color' && isHexColour(value) ? value : null;
}

// What the cleaning has built so far: whether any text is left, and the next element's key.
type Built = { text: boolean; key: number };

// The children of a parsed node as React elements: only `b`, `strong`, `br` and a coloured `span` are
// kept, built here, never copied as markup; no attribute is read but the span's colour.
function build(parent: Node, colours: boolean, built: Built): ReactNode[] {
  return Array.from(parent.childNodes).flatMap((node): ReactNode[] => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = String(node.textContent);
      if (text.trim() !== '') built.text = true;
      return [text];
    }
    if (!(node instanceof Element) || DROPPED.has(node.localName)) return [];
    const key = (built.key += 1);
    const inner = build(node, colours, built);
    switch (node.localName) {
      case 'b':
        return [<b key={key}>{inner}</b>];
      case 'strong':
        return [<strong key={key}>{inner}</strong>];
      case 'br':
        return [<br key={key} />];
      case 'span': {
        const colour = colours ? colourOf(node.getAttribute('style')) : null;
        return colour === null
          ? inner
          : [
              <span key={key} style={{ color: colour }}>
                {inner}
              </span>,
            ];
      }
      default:
        return inner;
    }
  });
}

// The cleaned name, or null where nothing but space is left.
function clean(formatted: string, colours: boolean) {
  const built: Built = { text: false, key: 0 };
  const nodes = build(new DOMParser().parseFromString(formatted, 'text/html').body, colours, built);
  return built.text ? nodes : null;
}

/** The company name, plain, or formatted where one is typed as HTML: cleaned at each draw to bold, line breaks and one colour on a span, built as elements, hidden from a reader beside the plain name; colours false lets the colour of the text show. */
export function BrandName({
  name,
  formatted,
  colours = true,
}: {
  name: string;
  formatted?: string;
  colours?: boolean;
}) {
  const cleaned = useMemo(() => clean(formatted ?? '', colours), [formatted, colours]);
  if (cleaned === null) return <>{name}</>;
  return (
    <>
      <span aria-hidden>{cleaned}</span>
      <VisuallyHidden>{name}</VisuallyHidden>
    </>
  );
}

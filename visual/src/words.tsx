import type { Language } from '@credo/shared';
import { Stage } from '@credo/ui/mock';
import { computeAccessibleName, getRole } from 'dom-accessibility-api';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';

const ELEMENT = 1;
const TEXT = 3;

const CONTROLS = new Set(['input', 'textarea', 'select']);
const SKIPPED = new Set(['script', 'style']);

const squash = (text: string | null) => (text ?? '').replace(/\s+/g, ' ').trim();
const quoted = (text: string) => JSON.stringify(text);

/** A form control, by its role and name, then what it holds. */
function controlLine(control: HTMLInputElement, role: string) {
  const name = quoted(squash(computeAccessibleName(control)));
  if (control.type === 'checkbox' || control.type === 'radio') {
    return `${role} ${name} ${control.checked ? 'checked' : 'unchecked'}`;
  }
  const value = control.type === 'file' || !control.value ? '' : ` = ${quoted(control.value)}`;
  const placeholder = control.placeholder ? ` placeholder ${quoted(control.placeholder)}` : '';
  return `${role} ${name}${value}${placeholder}`;
}

/**
 * A screen's words: each text, accessible name, field value, placeholder and image alternative, in
 * reading order, each with the role it sits in. The menu of pages (`nav`) is left out unless the
 * screen is about it. jsdom lays nothing out, so a word that CSS hides still counts.
 */
export function wordsOf(root: Element, { navigation = false } = {}): string[] {
  const lines: string[] = [];

  const visit = (node: Node, inherited: string) => {
    if (node.nodeType === TEXT) {
      const text = squash(node.textContent);
      if (text) lines.push(`${inherited}: ${text}`);
      return;
    }
    if (node.nodeType !== ELEMENT) return;
    const element = node as Element;
    const tag = element.localName;
    if (SKIPPED.has(tag) || (tag === 'nav' && !navigation)) return;
    if (tag === 'input' && (element as HTMLInputElement).type === 'hidden') return;

    const own = getRole(element);
    const role = own ?? inherited;
    if (CONTROLS.has(tag)) {
      lines.push(controlLine(element as HTMLInputElement, own ?? tag));
    } else if (tag === 'img') {
      const alternative = squash(element.getAttribute('alt'));
      if (alternative) lines.push(`img: ${alternative}`);
    } else if (own) {
      const name = squash(computeAccessibleName(element));
      if (name && name !== squash(element.textContent)) lines.push(`${role}: ${name}`);
    }
    for (const child of element.childNodes) visit(child, role);
  };

  visit(root, 'text');
  return lines;
}

/** One mock screen drawn on the page's own DOM, as ui's tests draw one, and its words read. */
export function drawnWords(
  screen: ReactNode,
  colour: string,
  language: Language,
  options: { navigation?: boolean } = {},
): string[] {
  const container = document.body.appendChild(document.createElement('div'));
  const root = createRoot(container);
  try {
    act(() => {
      root.render(
        <Stage colour={colour} language={language} scheme="light" test>
          {screen}
        </Stage>,
      );
    });
    return wordsOf(container, options);
  } finally {
    act(() => root.unmount());
    container.remove();
  }
}

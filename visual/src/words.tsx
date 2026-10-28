import type { Language } from '@credo/shared';
import { DEMO_CONFIG } from '@credo/shared/demo';
import { Stage } from '@credo/ui/mock';
import { computeAccessibleName, getRole } from 'dom-accessibility-api';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { SceneView } from './scene';
import type { Limits } from './steps';
import type { Drawn, DrawnScene } from './walks';

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

/** How often a scene is looked at, and the longest it is waited for by default, steps and all. */
const LOOK_EVERY = 10;
const SCENE_FOR = 30_000;

/**
 * One scene drawn on the page's own DOM, its steps done as a person does them, and its words read
 * when they have run. A step that finds nothing stops the build, naming the walk, the screen and
 * the step. React is let schedule as it does in a browser while the scene runs, since the steps
 * and the fake's answers come between its renders, not inside one `act`.
 */
export async function drawnSceneWords(
  { id, walk, scene }: DrawnScene,
  language: Language,
  options: { navigation?: boolean; limits?: Limits; endsIn?: number } = {},
): Promise<string[]> {
  const endsIn = options.endsIn ?? SCENE_FOR;
  const container = document.body.appendChild(document.createElement('div'));
  const root = createRoot(container);
  const env = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const before = env.IS_REACT_ACT_ENVIRONMENT;
  env.IS_REACT_ACT_ENVIRONMENT = false;
  try {
    root.render(
      <Stage colour={DEMO_CONFIG.colour} language={language} scheme="light" test path={scene.path}>
        <SceneView scene={scene} language={language} test limits={options.limits} />
      </Stage>,
    );
    const began = Date.now();
    for (;;) {
      const phase = container.querySelector('[data-scene]')?.getAttribute('data-scene');
      if (phase === 'done') return wordsOf(container, options);
      if (phase === 'failed') {
        const why = container.querySelector('[data-scene-failed]')!.textContent;
        throw new Error(`walk ${walk}, screen ${id}: ${why}`);
      }
      if (Date.now() - began > endsIn) {
        throw new Error(`walk ${walk}, screen ${id}: the scene did not end in ${endsIn} ms`);
      }
      await new Promise((resolve) => setTimeout(resolve, LOOK_EVERY));
    }
  } finally {
    env.IS_REACT_ACT_ENVIRONMENT = before;
    act(() => root.unmount());
    container.remove();
  }
}

/** The words of whatever a walk screen draws, a mock's state or a scene, in `language`. */
export function readWords(drawn: Drawn, language: Language, navigation: boolean) {
  return 'scene' in drawn
    ? drawnSceneWords(drawn, language, { navigation })
    : drawnWords(drawn.screen, drawn.colour, language, { navigation });
}

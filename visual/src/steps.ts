import { computeAccessibleName } from 'dom-accessibility-api';
import type { Step } from './walks';

/** What a scene waits for, in ms: the longest for a step's element, how long the page must stand
 * still after a step, and the longest it is waited on for that. Tests shorten them. */
export type Limits = { findFor: number; stillFor: number; stillAtMost: number };
export const LIMITS: Limits = { findFor: 3000, stillFor: 40, stillAtMost: 3000 };
const LOOK_EVERY = 15;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const squash = (text: string) => text.replace(/\s+/g, ' ').trim();
/** A field's name less the star a required one carries. */
const plain = (text: string) => squash(text).replace(/\s*\*$/, '');
const nameOf = (element: Element) => plain(computeAccessibleName(element));

/** A step that could not be done, with its place in the scene and what it was. */
export class StepError extends Error {
  constructor(index: number, step: Step, reason: string) {
    super(`step ${index + 1} (${JSON.stringify(step)}): ${reason}`);
  }
}

/** The words a key of the dictionary stands for, `{{name}}` filled; a key with none stops the scene. */
function wordsFor(
  dictionary: unknown,
  key: string,
  fill: Record<string, string> | undefined = undefined,
) {
  const found = key.split('.').reduce<unknown>((at, part) => (at as never)?.[part], dictionary);
  if (typeof found !== 'string') throw new Error(`the dictionary holds no words "${key}"`);
  return found.replace(/\{\{(\w+)\}\}/g, (_all, name: string) => fill?.[name] ?? '');
}

const PRESSED = 'button, a[href], input[type=radio], input[type=checkbox]';
const TYPED = 'input:not([type=radio]):not([type=checkbox]):not([type=hidden]), textarea';

/** What a step acts on, and what it is called when none is found. */
function target(
  step: Step,
  dictionary: unknown,
): { selector: string; name: string; within: string | undefined; kind: string } {
  if ('press' in step) {
    return {
      selector: PRESSED,
      name: wordsFor(dictionary, step.press, step.with),
      within: step.within === undefined ? undefined : wordsFor(dictionary, step.within),
      kind: 'button, link or choice',
    };
  }
  if ('fill' in step) {
    return {
      selector: TYPED,
      name: wordsFor(dictionary, step.fill),
      within: undefined,
      kind: 'field',
    };
  }
  if ('attach' in step) {
    return {
      selector: 'input[type=file]',
      name: wordsFor(dictionary, step.attach),
      within: undefined,
      kind: 'file field',
    };
  }
  return {
    selector: 'select',
    name: wordsFor(dictionary, step.choose),
    within: undefined,
    kind: 'list',
  };
}

/** The element a step names, once the page shows it; null until then. */
function find(body: HTMLElement, { selector, name, within }: ReturnType<typeof target>) {
  const scopes =
    within === undefined
      ? [body]
      : [...body.querySelectorAll<HTMLElement>('[role=radiogroup], [role=group]')].filter((group) =>
          nameOf(group).includes(within),
        );
  return (
    scopes
      .flatMap((scope) => [...scope.querySelectorAll<HTMLElement>(selector)])
      .find((element) => nameOf(element) === name) ?? null
  );
}

/** Sets what a field holds as a person's typing does, so the page's own handler sees it. */
function setValue(element: HTMLInputElement | HTMLSelectElement, value: string) {
  const view = element.ownerDocument.defaultView!;
  const prototype =
    element.localName === 'select'
      ? view.HTMLSelectElement.prototype
      : element.localName === 'textarea'
        ? view.HTMLTextAreaElement.prototype
        : view.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(element, value);
  element.dispatchEvent(
    new view.Event(element.localName === 'select' ? 'change' : 'input', { bubbles: true }),
  );
}

/** Puts a file in a file field as choosing it does: the field's files, then its `change`. */
function attach(element: HTMLInputElement, file: File) {
  Object.defineProperty(element, 'files', { value: [file], configurable: true });
  element.dispatchEvent(new element.ownerDocument.defaultView!.Event('change', { bubbles: true }));
}

/** Waits until the page has gone `stillFor` ms with no change, or `stillAtMost` in all. */
async function stillPage(body: HTMLElement, { stillFor, stillAtMost }: Limits) {
  const view = body.ownerDocument.defaultView!;
  let changed = Date.now();
  const watcher = new view.MutationObserver(() => (changed = Date.now()));
  watcher.observe(body.ownerDocument, { subtree: true, childList: true, attributes: true });
  const began = Date.now();
  try {
    while (Date.now() - changed < stillFor && Date.now() - began < stillAtMost) {
      await sleep(LOOK_EVERY);
    }
  } finally {
    watcher.disconnect();
  }
}

/**
 * Does a scene's steps on the page `body` belongs to, as a person would, each once the page shows
 * what it names and settles after it. The page is let settle first, so the first step meets the
 * app booted. A step that finds nothing within `findFor` ms throws a `StepError` naming it.
 *
 * @param dictionary the words of the language the scene is drawn in
 * @param files the data set's staff file a step attaches, by its name, in that language
 */
export async function runSteps(
  body: HTMLElement,
  steps: readonly Step[],
  dictionary: unknown,
  limits: Limits = LIMITS,
  files: (which: 'import' | 'import-no-name') => Promise<File> = () =>
    Promise.reject(new Error('no file to attach')),
) {
  await stillPage(body, limits);
  for (const [index, step] of steps.entries()) {
    const fail = (reason: string) => new StepError(index, step, reason);
    let aim: ReturnType<typeof target>;
    try {
      aim = target(step, dictionary);
    } catch (error) {
      throw fail((error as Error).message);
    }
    const began = Date.now();
    let element = find(body, aim);
    while (!element && Date.now() - began < limits.findFor) {
      await sleep(LOOK_EVERY);
      element = find(body, aim);
    }
    if (!element) throw fail(`found no ${aim.kind} named “${aim.name}”`);
    if ('press' in step) element.click();
    else if ('fill' in step) setValue(element as HTMLInputElement, step.text);
    else if ('attach' in step) attach(element as HTMLInputElement, await files(step.file));
    else {
      const option = [...(element as HTMLSelectElement).options].find(
        (candidate) => squash(candidate.text) === step.option,
      );
      if (!option) throw fail(`the list holds no option “${step.option}”`);
      setValue(element as HTMLSelectElement, option.value);
    }
    await stillPage(body, limits);
  }
}

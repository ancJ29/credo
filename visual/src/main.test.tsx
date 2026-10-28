import { SCREENS } from '@credo/ui/mock';
import { act, fireEvent, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { inlineJson, REPORT_ELEMENT } from './page-data';
import { makeReport } from './report';
import { PARTS, PEOPLE, WALKS } from './walks';

it('mounts the page the build inlined its report into', async () => {
  const report = await makeReport({
    walks: WALKS.slice(0, 2),
    people: PEOPLE,
    parts: PARTS,
    mock: SCREENS,
    answers: {},
    source: { branch: 'b', commit: 'c', changed: false, committedAt: new Date(0), home: '/h' },
    builtAt: new Date(0),
    readWords: () => [],
  });
  document.body.innerHTML = `<div id="root"></div><script type="application/json" id="${REPORT_ELEMENT}">${inlineJson(report)}</script>`;

  const { root } = await import('./main');

  expect(await screen.findByRole('heading', { level: 1 })).toBeTruthy();
  expect(screen.getByText('A business’s day in Credo')).toBeTruthy();
  // Its frames load and draw after the test; unmounted, nothing draws once jsdom's window is gone.
  act(() => root.unmount());
});

it('the mounted page: a label typed, two answers chosen, Share’s message equal to the clipboard’s, and "Copy my answers" giving the block it gives today', async () => {
  const report = await makeReport({
    walks: WALKS.slice(0, 2),
    people: PEOPLE,
    parts: PARTS,
    mock: SCREENS,
    answers: {},
    source: { branch: 'b', commit: 'c', changed: false, committedAt: new Date(0), home: '/h' },
    builtAt: new Date(0),
    readWords: (state, language) => [`text: ${state.id} ${language}`],
  });
  document.body.innerHTML = `<div id="root"></div><script type="application/json" id="${REPORT_ELEMENT}">${inlineJson(report)}</script>`;
  const written: string[] = [];
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: (text: string) => {
        written.push(text);
        return Promise.resolve();
      },
    },
  });
  vi.resetModules();
  const { root } = await import('./main');
  await screen.findByRole('heading', { level: 1 });

  fireEvent.change(screen.getByLabelText('Your label'), { target: { value: 'p1' } });
  const first = document.querySelectorAll<HTMLInputElement>('.w-yesno input[type="radio"]');
  fireEvent.click(first[0]);
  fireEvent.click(document.querySelectorAll<HTMLInputElement>('.w-yesno input[type="radio"]')[2]);
  const press = (name: string) =>
    act(() => {
      fireEvent.click(screen.getByRole('button', { name }));
      return Promise.resolve();
    });
  await press('Share');
  const shown = screen.getByLabelText<HTMLTextAreaElement>('The text to paste').value;
  await press('Copy my answers');

  const [shared, copied] = written;
  expect(shown).toBe(shared);
  expect(shared).toContain('By: p1');
  expect(shared.match(/ \| (yes|no) \| /g)).toHaveLength(2);
  expect(copied).not.toContain('By:');
  expect(
    shared
      .split('```')[1]
      .split('\n')
      .filter((line) => line.includes(' | ')),
  ).toEqual(copied.split('\n').filter((line) => line.includes(' | ')));
  act(() => root.unmount());
  Reflect.deleteProperty(navigator, 'clipboard');
  localStorage.clear();
});

import { SCREENS } from '@credo/ui/mock';
import { screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { inlineJson, REPORT_ELEMENT } from './page-data';
import { makeReport } from './report';
import { PARTS, PEOPLE, WALKS } from './walks';

it('mounts the page the build inlined its report into', async () => {
  const report = makeReport({
    walks: WALKS,
    people: PEOPLE,
    parts: PARTS,
    mock: SCREENS,
    answers: {},
    source: { branch: 'b', commit: 'c', changed: false, committedAt: new Date(0), home: '/h' },
    builtAt: new Date(0),
    readWords: () => [],
  });
  document.body.innerHTML = `<div id="root"></div><script type="application/json" id="${REPORT_ELEMENT}">${inlineJson(report)}</script>`;

  await import('./main');

  expect(await screen.findByRole('heading', { level: 1 })).toBeTruthy();
  expect(screen.getByText('A business’s day in Credo')).toBeTruthy();
});

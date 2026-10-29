import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SCREENS } from '@credo/ui/mock';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Page } from './page';
import { makeReport } from './report';
import { PARTS, PEOPLE, WALKS } from './walks';

const css = readFileSync(join(process.cwd(), 'src/page.css'), 'utf8');

/** The text between the braces that follow `opening`, braces inside counted. */
function block(text: string, opening: string) {
  const start = text.indexOf(opening);
  if (start < 0) return '';
  let depth = 0;
  for (let at = start + opening.length - 1; at < text.length; at++) {
    if (text[at] === '{') depth++;
    if (text[at] === '}' && --depth === 0) return text.slice(start + opening.length, at);
  }
  return '';
}

const WIDE = '@media (min-width: 1000px) {';

/** Every 1000-pixel media block of the stylesheet, as one text. */
const wideCss = css
  .split(WIDE)
  .slice(1)
  .map((rest) => block(WIDE + rest, WIDE))
  .join('\n');

/** The declarations of a rule, in the stylesheet, or in its 1000-pixel media blocks. */
const rule = (selector: string, wide = false) =>
  block(wide ? wideCss : css, `\n${wide ? '  ' : ''}${selector} {`);

const report = makeReport({
  walks: WALKS.slice(0, 1),
  people: PEOPLE,
  parts: PARTS,
  mock: SCREENS,
  answers: {},
  source: {
    branch: 'a-piece',
    commit: 'abc123def',
    changed: false,
    committedAt: new Date('2026-10-27T18:59:00Z'),
    home: '/h',
  },
  builtAt: new Date('2026-10-27T19:30:00Z'),
  readWords: (state, language) => [`text: ${state.id} ${language}`],
});

describe('the bar at the foot', () => {
  it('keeps the note above its one row, not in it', () => {
    render(<Page report={report} />);

    const bar = document.querySelector('.w-send')!;
    const note = bar.querySelector('[role="status"]')!;
    const row = bar.querySelector('.w-send-row')!;

    expect(row.contains(note)).toBe(false);
    expect(note.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('stays one row from 1000 pixels wide: the row does not wrap and the ledger gives way to the buttons', () => {
    expect(rule('.w-send-row', true)).toContain('flex-wrap: nowrap');
    expect(rule('.w-ledger', true)).toMatch(/flex: 1 1 0(px|%)?;/);
    expect(rule('.w-ledger', true)).toContain('min-width: 0');
  });

  it('shrinks each segment to fit, from a segment per screen and language down to a hairline', () => {
    expect(rule('.w-tick', true)).toMatch(/flex: 1 1 0(px|%)?;/);
    expect(rule('.w-tick', true)).toContain('min-width: 0');
    expect(rule('.w-tick', true)).toContain('max-width: 9px');
    expect(rule('.w-ledger', true)).not.toMatch(/gap: [2-9]px/);
  });

  it('keeps the buttons and the count at their size while the ledger shrinks', () => {
    expect(rule('.w-copy')).toContain('white-space: nowrap');
    expect(rule('.w-count,\n  .w-label,\n  .w-share,\n  .w-copy', true)).toContain('flex: none');
  });
});

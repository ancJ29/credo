import { describe, expect, it } from 'vitest';
import { inlineJson, readReport, REPORT_ELEMENT } from './page-data';
import type { Report } from './report';

const report = (text: string) => ({ title: text }) as unknown as Report;

describe('the report inside the page', () => {
  it('The page’s data is inlined with every < escaped, so no text of the walks or the answers ends its script', () => {
    const text = '</script><script>alert(1)</script><!-- <b>';

    const inlined = inlineJson(report(text));

    expect(inlined).not.toContain('<');
    expect(JSON.parse(inlined)).toEqual({ title: text });
  });

  it('is read back from its element, as it went in', () => {
    document.body.innerHTML = `<script type="application/json" id="${REPORT_ELEMENT}">${inlineJson(report('a <b> & c'))}</script>`;

    expect(readReport(document)).toEqual({ title: 'a <b> & c' });
  });
});

import type { Report } from './report';

export const REPORT_ELEMENT = 'report';

/**
 * The report as JSON for a script element, with every `<` escaped so no text of the walks or the
 * answers can end the script or open a tag inside it.
 */
export const inlineJson = (report: Report) => JSON.stringify(report).replaceAll('<', '\\u003c');

/** The report the build inlined into the page. */
export const readReport = (doc: Document) =>
  JSON.parse(doc.getElementById(REPORT_ELEMENT)!.textContent) as Report;

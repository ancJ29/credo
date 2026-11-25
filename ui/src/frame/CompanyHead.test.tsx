import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { barColour } from '../design-system/barColour';
import { CompanyHead } from './CompanyHead';

const head = (selector: string) => document.head.querySelector<HTMLElement>(selector);

describe('the company’s head', () => {
  it('draws the manifest and credo’s colour alone before the company is known, and nothing of one where none is named', () => {
    const named = render(<CompanyHead manifest="/api/manifest/an" />);
    expect(head('link[rel="manifest"]')?.getAttribute('href')).toBe('/api/manifest/an');
    expect(head('link[rel="icon"]')).toBeNull();
    named.unmount();

    render(<CompanyHead manifest={null} />);
    expect(head('link[rel="manifest"]')).toBeNull();
    expect(head('meta[name="theme-color"]')).not.toBeNull();
  });

  it('draws the icons and the bar in the header’s colour once known: white for a white header', () => {
    const company = { tabIcon: '/t', appIcon: '/a', colour: '#2f7d6d', whiteHeader: false };
    const { rerender } = render(<CompanyHead manifest={null} company={company} />);
    expect(head('link[rel="icon"]')?.getAttribute('href')).toBe('/t');
    expect(head('link[rel="apple-touch-icon"]')?.getAttribute('href')).toBe('/a');
    expect(head('meta[name="theme-color"]')?.getAttribute('content')).toBe(
      barColour('#2f7d6d', false),
    );

    rerender(<CompanyHead manifest={null} company={{ ...company, whiteHeader: true }} />);
    expect(head('meta[name="theme-color"]')?.getAttribute('content')).toBe('#ffffff');
  });
});

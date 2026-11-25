import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { draw } from '../../tests/render';
import { IconPreview } from './IconPreview';

const picture = (container: HTMLElement, which: 'tab' | 'home') =>
  container.querySelector<HTMLElement>(`[data-preview="${which}"]`)!;

describe('the preview of the tab icon and the phone-app icon', () => {
  it('draws the tab icon beside the name and the app icon over it, each under its caption', () => {
    const { container } = draw(
      <IconPreview name="An Phat" tabIcon="/tab.png" appIcon="/app.png" />,
    );
    const tab = picture(container, 'tab');
    const home = picture(container, 'home');
    expect(tab.querySelector('img')?.getAttribute('src')).toBe('/tab.png');
    expect(tab.textContent).toBe('An Phat');
    expect(home.querySelector('img')?.getAttribute('src')).toBe('/app.png');
    expect(home.textContent).toBe('An Phat');
    expect(screen.getByText("In the browser's tab")).toBeDefined();
    expect(screen.getByText("On a phone's home screen")).toBeDefined();
  });

  it('hides both pictures from a reader and takes no focus: only the two captions are read', () => {
    const { container } = draw(
      <IconPreview name="An Phat" tabIcon="/tab.png" appIcon="/app.png" />,
    );
    for (const which of ['tab', 'home'] as const) {
      expect(picture(container, which).getAttribute('aria-hidden')).toBe('true');
      expect(picture(container, which).hasAttribute('inert')).toBe(true);
    }
    expect(screen.queryAllByRole('img')).toEqual([]);
  });
});

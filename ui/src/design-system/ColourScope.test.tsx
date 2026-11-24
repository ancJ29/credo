import { useMantineTheme } from '@mantine/core';
import { describe, expect, it } from 'vitest';
import { draw } from '../../tests/render';
import { themeOf } from './appTheme';
import { ColourScope } from './ColourScope';

/** Says the brand's main shade the theme under it holds. */
function Probe({ label }: { label: string }) {
  const theme = useMantineTheme();
  return <p>{`${label} ${theme.colors['brand'][7]}`}</p>;
}

const BRICK = '#b5472a';
const PAGE = '#2f7d6d';

describe('the colour scope', () => {
  it('7: draws its contents in the given colour’s theme and leaves the page’s as it was', () => {
    const { container, getByText } = draw(
      <>
        <Probe label="page" />
        <ColourScope colour={BRICK}>
          <Probe label="scope" />
        </ColourScope>
        <Probe label="after" />
      </>,
    );

    expect(getByText(`scope ${themeOf(BRICK).colors?.['brand']?.[7]}`)).toBeDefined();
    expect(getByText(`page ${themeOf(PAGE).colors?.['brand']?.[7]}`)).toBeDefined();
    expect(getByText(`after ${themeOf(PAGE).colors?.['brand']?.[7]}`)).toBeDefined();
    const scope = container.querySelector<HTMLElement>('[data-colour-scope]')!;
    // Mantine's brand and primary variables, and the frame's own, on the scope's element
    expect(scope.style.getPropertyValue('--mantine-color-brand-7')).toBe(
      themeOf(BRICK).colors?.['brand']?.[7],
    );
    expect(scope.style.getPropertyValue('--mantine-primary-color-7')).not.toBe('');
    expect(scope.style.getPropertyValue('--credo-header-gradient')).not.toBe('');
    expect(scope.style.getPropertyValue('--credo-brand-tint')).not.toBe('');
    // the page's own is not written there
    expect(container.querySelectorAll('[data-colour-scope]')).toHaveLength(1);
  });
});

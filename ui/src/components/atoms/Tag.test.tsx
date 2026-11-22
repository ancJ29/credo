import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { draw } from '../../../tests/render';
import { SIZES, TONES } from '../../design-system/tokens';
import { Tag } from './Tag';

describe('Tag', () => {
  it('231 case 11: a tag draws its words light at the chip’s size, in the brand’s tone or its meaning’s', () => {
    draw(
      <>
        <Tag>Brand</Tag>
        <Tag meaning="success">Success</Tag>
        <Tag meaning="danger">Danger</Tag>
        <Tag meaning="warning">Warning</Tag>
        <Tag meaning="info">Info</Tag>
      </>,
    );

    const style = (name: string) => screen.getByText(name).closest('.mantine-Badge-root')!;
    for (const name of ['Brand', 'Success', 'Danger', 'Warning', 'Info']) {
      const badge = style(name);
      expect(badge.getAttribute('data-variant'), name).toBe('light');
      expect(badge.getAttribute('style'), name).toContain(`calc(${SIZES.chip / 16}rem`);
    }
    expect(style('Brand').getAttribute('style')).not.toMatch(
      /--mantine-color-(red|green|orange|gray)-/,
    );
    for (const [name, tone] of [
      ['Success', TONES.success],
      ['Danger', TONES.danger],
      ['Warning', TONES.warning],
      ['Info', TONES.info],
    ])
      expect(style(name).getAttribute('style'), name).toContain(`--mantine-color-${tone}-`);
  });
});

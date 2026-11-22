import { Group, Stack } from '@mantine/core';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { draw } from '../../../tests/render';
import { SPACING } from '../../design-system/tokens';
import { ActionButton } from '../atoms/ActionButton';
import { ActionRow } from './ActionRow';

describe('ActionRow', () => {
  it('222 case 13: it draws its buttons in the order given, at the end of the block, one gap apart', () => {
    draw(
      <>
        <ActionRow>
          <ActionButton meaning="quiet">Cancel</ActionButton>
          <ActionButton meaning="other">Save a draft</ActionButton>
          <ActionButton meaning="main">Send</ActionButton>
        </ActionRow>
        <div data-testid="reference">
          <Group gap={SPACING.sm} justify="flex-end" />
        </div>
      </>,
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((button) => button.textContent)).toEqual(['Cancel', 'Save a draft', 'Send']);
    const row = buttons[0].parentElement!;
    expect(buttons.every((button) => button.parentElement === row)).toBe(true);
    // The reference is Mantine's group at the contract's values: the row's gap and side are its.
    const want = screen.getByTestId('reference').firstElementChild!.getAttribute('style')!;
    expect(want).toContain('--group-justify: flex-end');
    expect(row.getAttribute('style')).toContain('--group-justify: flex-end');
    const gapOf = (style: string) => /--group-gap: ([^;]+);/.exec(style)?.[1];
    expect(gapOf(row.getAttribute('style')!)).toBe(gapOf(want));
    expect(gapOf(want)).toBeDefined();
  });

  it('222 case 13: one button sits at the end too', () => {
    draw(
      <ActionRow>
        <ActionButton meaning="main">Save</ActionButton>
      </ActionRow>,
    );
    expect(
      screen.getByRole('button', { name: 'Save' }).parentElement?.getAttribute('style'),
    ).toContain('--group-justify: flex-end');
  });

  it('222 fix 4: inside a block whose stack keeps its children at the start, the row still takes the block and so sits at its end', () => {
    draw(
      <Stack align="flex-start">
        <ActionRow>
          <ActionButton meaning="main">Save</ActionButton>
        </ActionRow>
      </Stack>,
    );
    const row = screen.getByRole('button', { name: 'Save' }).parentElement!;
    // A flex-end row with no width of its own is only as wide as its buttons there, so it must stretch itself.
    expect(row.getAttribute('style')).toContain('align-self: stretch');
  });
});

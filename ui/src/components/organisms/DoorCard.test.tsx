import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { designThemeOf } from '../../design-system/theme';
import { DoorCard } from './DoorCard';

describe('DoorCard', () => {
  it('5: draws a 4-px bar in the brand’s gradient across its top, the band, then what it holds', () => {
    const { container } = render(
      <MantineProvider theme={designThemeOf('#2f7d6d')} env="test">
        <DoorCard name="Acme" logo="/logo.png">
          <p>Inside</p>
        </DoorCard>
      </MantineProvider>,
    );

    const card = container.querySelector('.mantine-Paper-root')!;
    const [bar, band, body] = Array.from(card.children) as HTMLElement[];
    expect(bar.style.height).toBe('4px');
    expect(bar.style.background).toContain('90deg');
    expect(bar.style.background).toContain('var(--mantine-color-brand-7)');
    expect(bar.style.background).toContain('var(--mantine-color-brand-9)');
    expect(band).toBe(screen.getByText('Acme').parentElement);
    expect(band.contains(screen.getByRole('img', { name: 'Acme' }))).toBe(true);
    expect(body.style.padding).toBe('28px 40px 40px');
    expect(body.contains(screen.getByText('Inside'))).toBe(true);
    expect((card as HTMLElement).style.border).toBe('1px solid var(--mantine-color-neutral-3)');
  });
});

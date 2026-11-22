import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { IconRefresh } from '@tabler/icons-react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { GUIDELINE } from '../../design-system/guideline';
import { TONES } from '../../design-system/tokens';
import { ActionButton } from './ActionButton';

const draw = (node: React.ReactNode) =>
  render(
    <MantineProvider env="test">
      <MemoryRouter>{node}</MemoryRouter>
    </MantineProvider>,
  );

describe('ActionButton', () => {
  it('222 case 5: each meaning draws its look at one size and its words’ width', () => {
    const looks = [
      ['main', 'filled', false],
      ['other', 'default', false],
      ['quiet', 'subtle', false],
      ['danger', 'filled', true],
    ] as const;
    for (const [meaning, variant, red] of looks) {
      const { unmount } = draw(<ActionButton meaning={meaning}>{`Act ${meaning}`}</ActionButton>);
      const button = screen.getByRole('button', { name: `Act ${meaning}` });
      expect(button.getAttribute('data-variant'), meaning).toBe(variant);
      expect(button.getAttribute('data-size'), meaning).toBe('sm');
      expect(button.getAttribute('style') ?? '', meaning).toContain('width: fit-content');
      const danger = `--mantine-color-${TONES.danger}-`;
      expect(button.getAttribute('style') ?? '', meaning).toEqual(
        red ? expect.stringContaining(danger) : expect.not.stringContaining(danger),
      );
      unmount();
    }
  });

  it('222 case 6: an address makes a link, busy shows the loader and takes no second press, submit sends its form', () => {
    const { unmount } = draw(
      <ActionButton meaning="quiet" to="/clients">
        Back to clients
      </ActionButton>,
    );
    const link = screen.getByRole('link', { name: 'Back to clients' });
    expect(link.getAttribute('href')).toBe('/clients');
    expect(link.getAttribute('data-variant')).toBe('subtle');
    unmount();

    const press = vi.fn();
    const busy = draw(
      <ActionButton meaning="main" busy onClick={press}>
        Save
      </ActionButton>,
    );
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button.querySelector('.mantine-Button-loader')).not.toBeNull();
    fireEvent.click(button);
    expect(press).not.toHaveBeenCalled();
    busy.unmount();

    const idle = draw(
      <ActionButton meaning="main" onClick={press} icon={<IconRefresh aria-hidden />}>
        Reload
      </ActionButton>,
    );
    expect(screen.getByRole('button', { name: 'Reload' }).querySelector('svg')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(press).toHaveBeenCalledTimes(1);
    idle.unmount();

    const off = vi.fn();
    const held = draw(
      <ActionButton meaning="other" disabled onClick={off}>
        Held
      </ActionButton>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Held' }));
    expect(off).not.toHaveBeenCalled();
    held.unmount();

    const sent = vi.fn((event: React.FormEvent) => event.preventDefault());
    draw(
      <form onSubmit={sent}>
        <ActionButton meaning="main" submit>
          Send
        </ActionButton>
        <ActionButton meaning="other" onClick={press}>
          Plain
        </ActionButton>
      </form>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(sent).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Plain' }));
    expect(sent).toHaveBeenCalledTimes(1);
  });

  it('222 case 19: every take the contract gains is a content or a meaning, never a style', () => {
    const { takes } = GUIDELINE.contracts.find((contract) => contract.part === 'ActionButton')!;
    expect(takes.map(({ prop, is }) => `${prop}:${is}`)).toEqual([
      'meaning:meaning',
      'children:content',
      'onClick:content',
      'to:content',
      'submit:meaning',
      'busy:meaning',
      'disabled:meaning',
      'icon:content',
    ]);
  });
});

import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { describe, expect, it, vi } from 'vitest';
import { themeOf } from '../../design-system/appTheme';
import { createI18n } from '../../i18n';
import { DoorPage } from './DoorPage';

const LANGS = [
  { language: 'vi' as const, name: 'Tiếng Việt' },
  { language: 'en' as const, name: 'English' },
];

function draw(props: Partial<Parameters<typeof DoorPage>[0]>) {
  return render(
    <I18nextProvider i18n={createI18n('vi')}>
      <MantineProvider theme={themeOf('#2f7d6d')} env="test">
        <DoorPage {...props}>
          <p>Card</p>
        </DoorPage>
      </MantineProvider>
    </I18nextProvider>,
  );
}

describe('DoorPage', () => {
  it('241.1 case 17: sweeps the whole screen in the brand’s gradient and holds the card', () => {
    const { container } = draw({});

    const root = container.querySelector<HTMLElement>('[style*="min-height"]')!;
    expect(root.getAttribute('style')).toContain('background: var(--credo-header-gradient)');
    expect(root.getAttribute('style')).toContain('min-height: var(--door-page-height, 100vh)');
    expect(root.contains(screen.getByText('Card'))).toBe(true);
  });

  it('241.1 case 17: the switch is drawn for two languages and an act, names the picked one and calls the act with the other', async () => {
    const onLanguage = vi.fn();
    draw({ languages: LANGS, onLanguage });

    expect(screen.getByRole('button', { name: 'Tiếng Việt' }).getAttribute('aria-current')).toBe(
      'true',
    );
    await userEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(onLanguage).toHaveBeenCalledWith('en');
  });

  it('241.1 case 17: no switch for one language or for no act', () => {
    const { unmount } = draw({ languages: LANGS.slice(0, 1), onLanguage: vi.fn() });
    expect(screen.queryByRole('group')).toBeNull();
    unmount();
    draw({ languages: LANGS });
    expect(screen.queryByRole('group')).toBeNull();
  });
});

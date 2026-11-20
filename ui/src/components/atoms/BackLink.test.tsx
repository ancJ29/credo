import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { themeOf } from '../../design-system/appTheme';
import { BackLink } from './BackLink';

describe('BackLink', () => {
  it('4: goes where its caller says, its arrow before its words, in brand-7', () => {
    render(
      <MantineProvider theme={themeOf('#2f7d6d')} env="test">
        <BackLink href="/login">Back to sign in</BackLink>
      </MantineProvider>,
    );

    const link = screen.getByRole('link', { name: 'Back to sign in' });
    expect(link.getAttribute('href')).toBe('/login');
    expect(link.firstElementChild?.tagName.toLowerCase()).toBe('svg');
    expect(link.lastChild?.textContent).toBe('Back to sign in');
    expect(link.style.color).toBe('var(--credo-brand-text)');
  });
});

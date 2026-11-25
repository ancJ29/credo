import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { draw } from '../../tests/render';
import { DICTIONARIES } from '../i18n';
import { IdentityFields } from './IdentityFields';

const words = DICTIONARIES.en.settings;

describe('IdentityFields', () => {
  it('250.2 step 1: holds the name, the formatted name with its hint and preview, and the description', () => {
    draw(
      <IdentityFields
        name="An Phat"
        formattedName="<b>An</b> Phat"
        description="Rice"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole<HTMLInputElement>('textbox', { name: words.name }).value).toBe(
      'An Phat',
    );
    expect(
      screen.getByRole<HTMLTextAreaElement>('textbox', { name: words.formattedName }).value,
    ).toBe('<b>An</b> Phat');
    expect(screen.getByText(words.formattedNameHint)).toBeDefined();
    expect(screen.getByText(words.descriptionHint)).toBeDefined();
    expect(screen.getByText(words.formattedNamePreview)).toBeDefined();
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: words.description }).value).toBe(
      'Rice',
    );
    expect(document.querySelector('[aria-hidden="true"] b')?.textContent).toBe('An');
  });

  it('250.2 step 1: tells each field and what was typed, one key at a time', async () => {
    const onChange = vi.fn();
    draw(<IdentityFields name="" formattedName="" description="" onChange={onChange} />);

    await userEvent.type(screen.getByRole('textbox', { name: words.name }), 'N');
    await userEvent.type(screen.getByRole('textbox', { name: words.formattedName }), 'F');
    await userEvent.type(screen.getByRole('textbox', { name: words.description }), 'D');

    expect(onChange.mock.calls).toEqual([
      ['name', 'N'],
      ['formattedName', 'F'],
      ['description', 'D'],
    ]);
  });
});

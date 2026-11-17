import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { draw } from '../../tests/render';
import { DICTIONARIES } from '../i18n';
import { NewClient } from './NewClient';

const words = DICTIONARIES.en.operator;
/** A label that carries a star is found by its word inside it, as the dictionary spells it. */
const labelled = (word: string) => new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

describe('NewClient', () => {
  it('asks for a code and the company’s name, and says what a code may be', () => {
    draw(<NewClient status="idle" onSubmit={vi.fn()} />);

    expect(screen.getByLabelText(labelled(words.code))).toBeTruthy();
    expect(screen.getByLabelText(labelled(words.companyName))).toBeTruthy();
    expect(screen.getByText(words.codeHint)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('sends what was typed', async () => {
    const onSubmit = vi.fn();
    draw(<NewClient status="idle" onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(labelled(words.code)), 'minh-phat');
    await userEvent.type(screen.getByLabelText(labelled(words.companyName)), 'Minh Phát');
    await userEvent.click(screen.getByRole('button', { name: words.make }));

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith('minh-phat', 'Minh Phát');
  });

  it('waits while the service answers', () => {
    draw(<NewClient status="busy" onSubmit={vi.fn()} />);

    expect(screen.getByRole('button', { name: words.make }).hasAttribute('data-loading')).toBe(
      true,
    );
  });

  it('a failure says so and leaves the code unmarked', () => {
    draw(<NewClient status="failed" onSubmit={vi.fn()} />);

    expect(screen.getByRole('alert').textContent).toBe(words.failed);
    expect(screen.getByLabelText(labelled(words.code)).getAttribute('aria-invalid')).toBeNull();
  });

  it('a taken code says so and marks the code', () => {
    draw(<NewClient status="taken" onSubmit={vi.fn()} />);

    expect(screen.getByRole('alert').textContent).toBe(words.taken);
    expect(screen.getByLabelText(labelled(words.code)).getAttribute('aria-invalid')).toBe('true');
  });

  it('A code not in the form is refused on its field, saying the rule, and nothing is sent', async () => {
    const onSubmit = vi.fn();
    draw(<NewClient status="idle" onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(labelled(words.code)), '9 bad code');
    await userEvent.type(screen.getByLabelText(labelled(words.companyName)), 'Minh Phát');
    await userEvent.click(screen.getByRole('button', { name: words.make }));

    expect(screen.getByText(words.codeInvalid)).toBeTruthy();
    expect(screen.getByLabelText(labelled(words.code)).getAttribute('aria-invalid')).toBe('true');
    expect(
      screen.getByLabelText(labelled(words.companyName)).getAttribute('aria-invalid'),
    ).toBeNull();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('A name of spaces alone is refused on its field, and a fixed form is sent', async () => {
    const onSubmit = vi.fn();
    draw(<NewClient status="idle" onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(labelled(words.code)), 'minh-phat');
    await userEvent.type(screen.getByLabelText(labelled(words.companyName)), '   ');
    await userEvent.click(screen.getByRole('button', { name: words.make }));

    expect(screen.getByText(words.nameInvalid)).toBeTruthy();
    expect(screen.getByLabelText(labelled(words.code)).getAttribute('aria-invalid')).toBeNull();
    expect(onSubmit).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText(labelled(words.companyName)), ' Minh Phát ');
    await userEvent.click(screen.getByRole('button', { name: words.make }));

    expect(screen.queryByText(words.nameInvalid)).toBeNull();
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith('minh-phat', 'Minh Phát');
  });

  it('A code typed in capitals or with spaces around it is lowered and trimmed before it is checked and sent', async () => {
    const onSubmit = vi.fn();
    draw(<NewClient status="idle" onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(labelled(words.code)), '  Minh-PHAT ');
    await userEvent.type(screen.getByLabelText(labelled(words.companyName)), 'Minh Phát');
    await userEvent.click(screen.getByRole('button', { name: words.make }));

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith('minh-phat', 'Minh Phát');
  });
});

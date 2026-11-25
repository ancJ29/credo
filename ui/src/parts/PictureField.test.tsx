import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { draw } from '../../tests/render';
import { PictureField } from './PictureField';

const WORDS = { label: 'Logo', none: 'No logo', choose: 'Upload', remove: 'Remove' };

describe('PictureField', () => {
  it('17: draws its label and hint, the picture beside its choose and remove, and hides the picture from a reader', () => {
    const { container } = draw(
      <PictureField
        {...WORDS}
        hint="Optional"
        picture="/logo.png"
        onChoose={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByText('Logo')).toBeDefined();
    expect(screen.getByText('Optional')).toBeDefined();
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/logo.png');
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('');
    expect(screen.queryByText('No logo')).toBeNull();
    expect(screen.getByRole('button', { name: 'Upload' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeDefined();
  });

  it('17: with no picture it says none, offers no remove and draws no hint nor message', () => {
    const { container } = draw(<PictureField {...WORDS} onChoose={vi.fn()} onRemove={vi.fn()} />);

    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('No logo')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('17: tells its screen the file chosen and the remove pressed', () => {
    const onChoose = vi.fn();
    const onRemove = vi.fn();
    const { container } = draw(
      <PictureField {...WORDS} picture="/logo.png" onChoose={onChoose} onRemove={onRemove} />,
    );
    const file = new File(['x'], 'mark.png', { type: 'image/png' });

    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    expect(onChoose).toHaveBeenCalledWith(file);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('17: says a refusal as an alert and an outcome as a status', () => {
    const refused = draw(
      <PictureField
        {...WORDS}
        message={{ kind: 'error', text: 'Too large' }}
        onChoose={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert').textContent).toContain('Too large');
    refused.unmount();

    draw(
      <PictureField
        {...WORDS}
        message={{ kind: 'saved', text: 'Saved' }}
        onChoose={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByRole('status').textContent).toContain('Saved');
  });
});

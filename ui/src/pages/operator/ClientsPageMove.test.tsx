import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { draw } from '../../../tests/render';
import { type Api, ApiError } from '../../api';
import { ClientsPage } from './ClientsPage';

import { DICTIONARIES } from '../../i18n';

const words = DICTIONARIES.en;
/** A label that carries a star is found by its word inside it, as the dictionary spells it. */
const labelled = (word: string) => new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
const GIB = 1024 ** 3;
const TWO = [
  { name: 'home', companies: 4, freeBytes: 38 * GIB },
  { name: 'b2', companies: 0, freeBytes: 112 * GIB },
];
const ONE = [TWO[0]];
const item = { code: 'binh-an', name: 'Bình An', madeAt: 1, link: '/login?client-code=binh-an' };

const page = (operatorBoxes: Api['operatorBoxes']) =>
  draw(
    <ClientsPage
      api={{ listClients: () => Promise.resolve([item]), operatorBoxes } as unknown as Api}
      onSignedOut={vi.fn()}
    />,
  );

describe('the clients list and the move', () => {
  it('C15: A row offers the move to the move’s page where the back end holds more than one box', async () => {
    page(() => Promise.resolve(TWO));

    const link = await screen.findByRole('link', { name: `${words.operator.moveClient}: binh-an` });
    expect(link.getAttribute('href')).toBe('/operator/clients/binh-an/move');
    const row = screen.getByRole('row', { name: /binh-an/ });
    expect(
      within(row)
        .getAllByRole('link')
        .map((one) => one.textContent),
    ).toContain(words.operator.moveClient);
  });

  it('C15: With one box, or a list of boxes that does not come, no row offers it', async () => {
    page(() => Promise.resolve(ONE));
    await screen.findAllByRole('row');
    expect(screen.queryByRole('link', { name: labelled(words.operator.moveClient) })).toBeNull();
  });

  it('C15: A list of boxes that does not come offers no move either', async () => {
    page(() => Promise.reject(new ApiError(503)));
    await screen.findAllByRole('row');
    expect(screen.queryByRole('link', { name: labelled(words.operator.moveClient) })).toBeNull();
  });
});

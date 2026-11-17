import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { draw } from '../../../tests/render';
import type { Api } from '../../api';
import { createFakeApi, parseCue } from '../../fake';
import { DICTIONARIES } from '../../i18n';
import { ClientsPage } from './ClientsPage';

const base = { name: 'Acme', madeAt: 1, link: '/login' };

describe('the clients list names the box each company is on', () => {
  it('shows a column of boxes, the box the line names, and the home box for a line that names none', async () => {
    const listClients = () =>
      Promise.resolve([
        { ...base, code: 'on-b2', box: 'b2' },
        { ...base, code: 'on-home', box: 'home' },
        { ...base, code: 'unnamed' },
      ]);
    draw(<ClientsPage api={{ listClients } as unknown as Api} onSignedOut={vi.fn()} />);

    expect(
      await screen.findByRole('columnheader', { name: DICTIONARIES.en.operator.colBox }),
    ).toBeTruthy();
    const boxOf = (code: string) =>
      within(screen.getByRole('row', { name: new RegExp(code) })).getAllByRole('cell')[2]
        ?.textContent;
    expect([boxOf('on-b2'), boxOf('on-home'), boxOf('unnamed')]).toEqual(['b2', 'home', 'home']);
  });

  it('is sent by the fake for every company, the home box included', async () => {
    const api = createFakeApi({
      device: { authId: () => null, operatorAuthId: () => 'fake.operator' },
      cue: parseCue(null),
      signIns: false,
      drift: false,
    });
    expect((await api.listClients()).map((client) => client.box)).toEqual(['home', 'home', 'home']);
  });
});

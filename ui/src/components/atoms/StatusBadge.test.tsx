import { ORDER_STATES, REQUEST_STATES } from '@credo/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Providers } from '../../frame/Providers';
import { GUIDELINE } from '../../design-system/guideline';
import { TONES } from '../../design-system/tokens';
import { en } from '../../i18n/en';
import { STATUS_TONE, STATUSES, StatusBadge, type Status } from './StatusBadge';

const draw = (status: Status) =>
  render(
    <Providers colour="#2f7d6d" language="en" test>
      <StatusBadge status={status} />
    </Providers>,
  );

/** The word each status is said in, from the dictionary the screens read. */
const WORD: Record<Status, string> = {
  draft: en.orders.state.draft,
  confirmed: en.orders.state.confirmed,
  fulfilled: en.orders.state.fulfilled,
  cancelled: en.orders.state.cancelled,
  waiting: en.orders.state.waiting,
  delivered: en.orders.state.delivered,
  active: en.staff.chipActive,
  inactive: en.staff.chipInactive,
};

describe('StatusBadge', () => {
  it('213 case 14: takes every status the records carry, each with one tone and one word', () => {
    // A set that found nothing would quiet the loop below.
    expect(STATUSES.length).toBeGreaterThan(6);
    for (const carried of [...ORDER_STATES, ...REQUEST_STATES, 'active', 'inactive'])
      expect(STATUSES, carried).toContain(carried);
    expect(Object.keys(STATUS_TONE).sort()).toEqual([...STATUSES].sort());
    for (const status of STATUSES) {
      const { unmount } = draw(status);
      const badge = screen.getByText(WORD[status]);
      expect(badge.closest('[data-status]')?.getAttribute('data-status'), status).toBe(status);
      expect(badge.closest('[data-status]')?.getAttribute('style'), status).toContain(
        `--mantine-color-${TONES[STATUS_TONE[status]]}-`,
      );
      unmount();
    }
  });

  it('213 case 14: its contract’s states name each status and the tone the part draws it at', () => {
    const states = GUIDELINE.contracts.find((contract) => contract.part === 'StatusBadge')!.states;
    expect(states.map((state) => state.name)).toEqual([...STATUSES]);
    for (const { name, tone } of states) expect(tone, name).toBe(STATUS_TONE[name as Status]);
  });
});

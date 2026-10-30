import type { Employee, StaffSetup, UnitLink } from '@credo/shared';

/** A unit's name as the setup holds it now, so a rename follows the person; a unit since removed
 * shows as it was saved on them. */
export const unitName = (link: UnitLink | null, units: StaffSetup['departments']) =>
  link === null ? null : (units.find((unit) => unit.id === link.id)?.name ?? link.name);

/** The phone a person's `extra` holds, or nothing. */
export const phoneOf = (person: Pick<Employee, 'extra'>) =>
  typeof person.extra.phone === 'string' ? person.extra.phone : '';

export const noteOf = (person: Pick<Employee, 'extra'>) =>
  typeof person.extra.note === 'string' ? person.extra.note : '';

export const personalPhoneOf = (person: Pick<Employee, 'extra'>) =>
  typeof person.extra.personalPhone === 'string' ? person.extra.personalPhone : '';

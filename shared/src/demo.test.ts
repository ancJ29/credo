import { describe, expect, it } from 'vitest';
import { tenantConfigSchema } from './config';
import { DEMO_CONFIG, DEMO_EMPLOYEES, DEMO_STAFF_SETUP } from './demo';
import { employeeSchema, staffSetupSchema } from './staff';

describe('the demo data set', () => {
  it('The demo company is a company’s settings the BFF would take, logo included', () => {
    expect(tenantConfigSchema.parse(DEMO_CONFIG)).toEqual(DEMO_CONFIG);
  });

  it('The demo staff are the people and the setup the BFF would take, each person in a unit the setup holds', () => {
    expect(staffSetupSchema.safeParse(DEMO_STAFF_SETUP).data).toEqual(DEMO_STAFF_SETUP);
    const known = (units: { id: string }[], link: { id: string } | null) =>
      link === null || units.some((unit) => unit.id === link.id);
    for (const person of DEMO_EMPLOYEES) {
      expect(employeeSchema.safeParse(person).data, person.code).toEqual(person);
      expect(known(DEMO_STAFF_SETUP.departments, person.department), person.code).toBe(true);
      expect(known(DEMO_STAFF_SETUP.positions, person.position), person.code).toBe(true);
    }
    expect(new Set(DEMO_EMPLOYEES.map((person) => person.code)).size).toBe(DEMO_EMPLOYEES.length);
    expect(DEMO_EMPLOYEES.filter((person) => person.archived)).toHaveLength(1);
    expect(DEMO_EMPLOYEES.filter((person) => person.department === null)).toHaveLength(1);
    expect(
      DEMO_EMPLOYEES.filter((person) => Object.keys(person.permissions).length > 0),
    ).toHaveLength(1);
  });
});

import { describe, expect, it } from 'vitest';
import { tenantConfigSchema } from './config';
import {
  DEMO_CLIENTS,
  DEMO_CODE,
  DEMO_CONFIG,
  DEMO_EMPLOYEES,
  DEMO_INVITED_NAME,
  DEMO_JOIN_TOKEN,
  DEMO_OPERATOR_ID,
  DEMO_PASSKEYS,
  DEMO_TEAM,
  DEMO_PHOTOS,
  DEMO_SERVICES,
  DEMO_STAFF_SETUP,
  OPERATOR_NAME,
} from './demo';
import { fieldValueIsValid } from './fields';
import { photoIsValid } from './photo';
import { clientCodeSchema } from './records';
import { employeeSchema, staffConfig, staffSetupSchema } from './staff';
import {
  joinTokenSchema,
  operatorItemSchema,
  passkeyListReplySchema,
  servicesReplySchema,
} from './wire';

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
    ).toHaveLength(2);
  });

  it('The demo setup switches the second phone and the photo on, holds one field of each kind and numbers codes as EMP- and 4 digits; every value a person holds is one its field takes, and the photos are ones the BFF would take', () => {
    const { fields, customFields, numbering } = staffConfig(DEMO_STAFF_SETUP);

    expect(fields).toEqual({ personalPhone: true, photo: true, email: false, qr: false });
    expect(customFields.map((field) => field.kind).sort()).toEqual([
      'choice',
      'date',
      'number',
      'text',
    ]);
    expect(numbering).toEqual({ prefix: 'EMP-', digits: 4 });
    for (const person of DEMO_EMPLOYEES) {
      for (const field of customFields) {
        const stored = person.extra[field.key];
        if (stored === undefined) continue;
        expect(
          fieldValueIsValid(field, `${stored as string | number}`),
          `${person.code} ${field.key}`,
        ).toBe(true);
      }
    }
    const photos = Object.entries(DEMO_PHOTOS);
    expect(photos).toHaveLength(1);
    for (const [owner, photo] of photos) {
      expect(DEMO_EMPLOYEES.some((person) => person.id === owner)).toBe(true);
      expect(photoIsValid(photo)).toBe(true);
    }
  });
});

describe('the demo clients', () => {
  it('The operator’s list holds three invented clients, the demo company among them, each made at noon UTC so its day reads the same in every zone', () => {
    expect(DEMO_CLIENTS).toHaveLength(3);
    expect(new Set(DEMO_CLIENTS.map((client) => client.code)).size).toBe(3);
    expect(DEMO_CLIENTS.map((client) => client.code)).toContain(DEMO_CODE);
    for (const client of DEMO_CLIENTS) {
      expect(clientCodeSchema.safeParse(client.code).success, client.code).toBe(true);
      expect(new Date(client.madeAt).getUTCHours(), client.code).toBe(12);
      expect(new Date(client.madeAt).getUTCMinutes(), client.code).toBe(0);
    }
  });
});

describe('the demo operator', () => {
  it('The operator holds two passkeys, one used and one not yet, each made at noon UTC; the invited one has a join link in the token’s form', () => {
    expect(passkeyListReplySchema.safeParse({ passkeys: DEMO_PASSKEYS }).success).toBe(true);
    expect(DEMO_PASSKEYS).toHaveLength(2);
    expect(DEMO_PASSKEYS.filter((passkey) => passkey.lastUsedAt === null)).toHaveLength(1);
    for (const passkey of DEMO_PASSKEYS) {
      expect(new Date(passkey.addedAt).getUTCHours(), passkey.id).toBe(12);
    }
    expect(joinTokenSchema.safeParse(DEMO_JOIN_TOKEN).success).toBe(true);
    expect(DEMO_OPERATOR_ID).not.toBe('');
    expect(DEMO_INVITED_NAME).not.toBe(OPERATOR_NAME);
  });

  it('B1: The roster holds the operator, a colleague whose adder is deleted and the invited one, each a line the roster’s schema parses, at noon UTC', () => {
    expect(DEMO_TEAM.map((one) => [one.name, one.state, one.passkeys])).toEqual([
      [OPERATOR_NAME, 'active', DEMO_PASSKEYS.length],
      ['Minh Quân', 'active', 1],
      [DEMO_INVITED_NAME, 'invited', 0],
    ]);
    expect(DEMO_TEAM[0]?.id).toBe(DEMO_OPERATOR_ID);
    // the command line's, a deleted operator's (no adder, not the terminal's), an operator's
    expect(DEMO_TEAM.map((one) => [one.addedBy, one.addedByTerminal])).toEqual([
      [null, true],
      [null, false],
      [OPERATOR_NAME, false],
    ]);
    expect(DEMO_TEAM.find((one) => one.state === 'invited')?.signedInAt).toBeNull();
    for (const one of DEMO_TEAM) {
      expect(operatorItemSchema.safeParse({ ...one, you: false }).success, one.name).toBe(true);
      expect(new Date(one.addedAt).getUTCHours(), one.name).toBe(12);
    }
  });
});

describe('the demo services', () => {
  it('C: The services hold one build and a drifted one that differ, as the BFF would answer them, checked at noon UTC so the time reads the same in every whole-hour zone', () => {
    const reply = (build: string) => ({
      build: DEMO_SERVICES.build,
      storage: { build, ms: DEMO_SERVICES.storageMs },
    });
    expect(servicesReplySchema.safeParse(reply(DEMO_SERVICES.build)).success).toBe(true);
    expect(servicesReplySchema.safeParse(reply(DEMO_SERVICES.driftBuild)).success).toBe(true);
    expect(DEMO_SERVICES.driftBuild).not.toBe(DEMO_SERVICES.build);
    expect(DEMO_SERVICES.bffMs).toBeGreaterThan(DEMO_SERVICES.storageMs);
    expect(new Date(DEMO_SERVICES.checkedAt).getUTCHours()).toBe(12);
    expect(new Date(DEMO_SERVICES.checkedAt).getUTCMinutes()).toBe(0);
    expect(new Date(DEMO_SERVICES.checkedAt).getUTCSeconds()).toBe(0);
  });
});

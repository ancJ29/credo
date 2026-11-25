import type { StaffSetup, TenantConfig } from '@credo/shared';
import { CUSTOM_FIELDS, SCENARIOS, type ScenarioId, STAFF_FIELDS } from './scenarios';
import { streamOf } from './stream';

const COLOURS = ['#2f7d6d', '#8a4b2a', '#3e618c', '#7a3b6e', '#b4532a', '#4a6b2f', '#2a6f8f'];

/** The company's colour, drawn from its client's own stream, so every copy of one client has the
 * same brand. */
const colourOf = (client: string) => streamOf(client, 'brand').pick(COLOURS);

/** The company's monogram logo, an image data URL in its colour, kept as its logo picture. */
export function companyLogo(client: string, name: string): string {
  const colour = colourOf(client);
  const monogram = name
    .split(' ')
    .slice(-2)
    .map((word) => word[0].toUpperCase())
    .join('');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="10" fill="${colour}"/>` +
    `<text x="24" y="31" font-size="20" font-family="sans-serif" font-weight="700" text-anchor="middle" fill="#fff">${monogram}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

/** The company's settings: its name and its colour. */
export function companyConfig(client: string, name: string): TenantConfig {
  return {
    name,
    colour: colourOf(client),
    whiteHeader: false,
    whiteMenu: false,
    menuIcons: false,
    languages: ['vi', 'en'],
    defaultLanguage: 'vi',
    formattedName: '',
    description: '',
  };
}

/** A staff setup as the operator saves it, before the BFF mints the units' ids. */
export type StaffSetupDraft = Omit<StaffSetup, 'departments' | 'positions'> & {
  departments: Omit<StaffSetup['departments'][number], 'id'>[];
  positions: Omit<StaffSetup['positions'][number], 'id'>[];
};

/** The scenario's staff setup: its departments and positions with what each may do, the fields and
 * its numbering. */
export function staffSetupOf(scenario: ScenarioId): StaffSetupDraft {
  const { staff } = SCENARIOS[scenario];
  return {
    departments: staff.departments.map(({ name, permissions }) => ({
      name,
      permissions,
      extra: {},
    })),
    positions: staff.positions.map(({ name, permissions }) => ({ name, permissions, extra: {} })),
    fields: STAFF_FIELDS,
    customFields: CUSTOM_FIELDS,
    numbering: staff.numbering,
    extra: {},
  };
}

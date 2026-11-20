import type { MantineColorsTuple } from '@mantine/core';

/** The six stock palettes, in the human's order (2026-11-20; the old app's nine before): each name and its ten shades, the lightest first. */
export const PALETTES = [
  {
    name: 'steel',
    shades: [
      '#eaf3fb',
      '#d6e6f7',
      '#bcd6f0',
      '#9bc1e7',
      '#79aadb',
      '#5f91c6',
      '#4a76a9',
      '#3e618c',
      '#324e71',
      '#273c59',
    ],
  },
  {
    name: 'emerald',
    shades: [
      '#ecfdf5',
      '#d1fae5',
      '#a7f3d0',
      '#6ee7b7',
      '#34d399',
      '#10b981',
      '#059669',
      '#047857',
      '#065f46',
      '#064e3b',
    ],
  },
  {
    name: 'brick',
    shades: [
      '#fef4f2',
      '#fee4e0',
      '#fecbc2',
      '#faab9e',
      '#ef8978',
      '#d86655',
      '#b83e2f',
      '#9e2d20',
      '#832015',
      '#67160e',
    ],
  },
  {
    name: 'bronze',
    shades: [
      '#fef5ed',
      '#f9e8da',
      '#f1d3b9',
      '#e5b993',
      '#d59c69',
      '#bd7d41',
      '#9d5a09',
      '#854a00',
      '#6b3c02',
      '#542d00',
    ],
  },
  {
    name: 'plum',
    shades: [
      '#fff3fa',
      '#f9e4f1',
      '#f2cce4',
      '#e6afd2',
      '#d58fbe',
      '#bd6fa4',
      '#9d4b85',
      '#863b70',
      '#6e2d5b',
      '#562147',
    ],
  },
  {
    name: 'indigo',
    shades: [
      '#f5f6ff',
      '#e6eafe',
      '#cfd7ff',
      '#b3befe',
      '#95a1f9',
      '#7882e5',
      '#595fc7',
      '#484dae',
      '#393c90',
      '#2b2d72',
    ],
  },
] as const;

/** The stock palette whose shade 7 is this colour, in any case; none for any other colour. */
export const paletteOfColour = (colour: string) => {
  const lower = colour.toLowerCase();
  return PALETTES.find((palette) => palette.shades[7] === lower);
};

/** The old app's greys: the guest screens' ground and the card's edge. */
export const NEUTRAL: MantineColorsTuple = [
  '#fafafa',
  '#f5f5f5',
  '#e5e5e5',
  '#d4d4d4',
  '#9ca3af',
  '#6b7280',
  '#4b5563',
  '#374151',
  '#1f2937',
  '#111827',
];

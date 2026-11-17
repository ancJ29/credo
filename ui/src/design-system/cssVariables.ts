import type { CSSVariablesResolver } from '@mantine/core';
import { FRAME_COLOURS, FRAME_VALUES } from './tokens';

/** Writes the frame's colours and values, which Mantine has no slot for, as `--credo-<name>` variables. */
export const credoVariables: CSSVariablesResolver = () => ({
  variables: Object.fromEntries(
    Object.entries({ ...FRAME_COLOURS, ...FRAME_VALUES }).map(([name, value]) => [
      `--credo-${name}`,
      value,
    ]),
  ),
  light: {},
  dark: {},
});

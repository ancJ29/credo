import type { CSSVariablesResolver } from '@mantine/core';
import { FRAME_COLOURS } from './tokens';

/** Writes the frame's colours, which Mantine has no slot for, as `--credo-<name>` variables. */
export const credoVariables: CSSVariablesResolver = () => ({
  variables: Object.fromEntries(
    Object.entries(FRAME_COLOURS).map(([name, value]) => [`--credo-${name}`, value]),
  ),
  light: {},
  dark: {},
});

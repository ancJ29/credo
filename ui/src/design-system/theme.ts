import { Badge, createTheme, mergeThemeOverrides, Modal, Table } from '@mantine/core';
import { themeOf } from '../theme';
import { TOKENS } from './tokens';

/**
 * The legacy app's look, laid over the app's own theme: the main colour at shade 6 (shade 7 stays the
 * company's colour itself), a badge with small corners, a table row's pale hover, a centred dialog
 * with a large title. Light only.
 */
export const designThemeOf = (colour: string) =>
  mergeThemeOverrides(
    themeOf(colour),
    createTheme({
      primaryShade: TOKENS.primaryShade,
      components: {
        Badge: Badge.extend({ defaultProps: { radius: TOKENS.badgeRadius } }),
        Table: Table.extend({ defaultProps: { highlightOnHoverColor: TOKENS.rowHover } }),
        Modal: Modal.extend({
          defaultProps: { centered: true },
          styles: { title: TOKENS.dialogTitle },
        }),
      },
    }),
  );

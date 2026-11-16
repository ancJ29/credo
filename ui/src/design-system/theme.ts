import { Badge, createTheme, Divider, mergeThemeOverrides, Modal, Table } from '@mantine/core';
import { themeOf } from './appTheme';
import { TOKENS } from './tokens';

/**
 * The legacy app's look, laid over the app's own theme: the main colour at shade 6 (shade 7 stays the
 * company's colour itself), a badge with small corners, a table row's pale hover, a centred dialog
 * with a large title, the gradient button's brand gradient and a labelled divider's small dimmed
 * word. Light only.
 */
export const designThemeOf = (colour: string) =>
  mergeThemeOverrides(
    themeOf(colour),
    createTheme({
      primaryShade: TOKENS.primaryShade,
      defaultGradient: TOKENS.buttonGradient,
      components: {
        Badge: Badge.extend({ defaultProps: { radius: TOKENS.badgeRadius } }),
        Divider: Divider.extend({
          defaultProps: { labelPosition: 'center' },
          styles: { label: TOKENS.dividerLabel },
        }),
        Table: Table.extend({ defaultProps: { highlightOnHoverColor: TOKENS.rowHover } }),
        Modal: Modal.extend({
          defaultProps: { centered: true },
          styles: { title: TOKENS.dialogTitle },
        }),
      },
    }),
  );

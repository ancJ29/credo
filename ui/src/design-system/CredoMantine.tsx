import { MantineProvider } from '@mantine/core';
import { useMemo, type ReactNode } from 'react';
import { themeOf } from './appTheme';
import { credoVariables } from './cssVariables';

type Props = {
  /** The brand colour the theme is made from. */
  colour: string;
  /** The app is light whatever the device asks. */
  scheme?: 'light';
  /** The element that carries the colour scheme, where it is not the page's own. */
  root?: () => HTMLElement;
  /** Tests switch Mantine's transitions off. */
  test?: boolean;
  children: ReactNode;
};

/** Mantine as the app sets it up: the theme, the `--credo-*` variables, the light scheme. The app's
 * providers and the gallery both draw inside it, so the gallery shows what the app uses. */
export function CredoMantine({ colour, scheme, root, test, children }: Props) {
  const theme = useMemo(() => themeOf(colour), [colour]);
  return (
    <MantineProvider
      theme={theme}
      cssVariablesResolver={credoVariables}
      forceColorScheme={scheme ?? 'light'}
      getRootElement={root}
      env={test ? 'test' : 'default'}
    >
      {children}
    </MantineProvider>
  );
}

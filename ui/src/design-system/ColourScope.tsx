import {
  defaultCssVariablesResolver,
  mergeMantineTheme,
  MantineThemeProvider,
  useMantineTheme,
} from '@mantine/core';
import { useMemo, type ReactNode } from 'react';
import { themeOf } from './appTheme';
import { credoVariables } from './cssVariables';

/** Draws its contents in the theme of another brand colour, the rest of the page keeping its own: the
 * theme by a nested theme provider, and that theme's brand and primary variables and every `--credo-*`
 * one written on its own element, where the page's sit on the root. For a part that shows a look not
 * yet saved. */
export function ColourScope({ colour, children }: { colour: string; children: ReactNode }) {
  const page = useMantineTheme();
  const variables = useMemo(() => {
    const theme = mergeMantineTheme(page, themeOf(colour));
    const mantine = defaultCssVariablesResolver(theme);
    const credo = credoVariables(theme);
    return { ...mantine.variables, ...mantine.light, ...credo.variables, ...credo.light };
  }, [page, colour]);
  return (
    <MantineThemeProvider theme={themeOf(colour)}>
      <div data-colour-scope style={variables}>
        {children}
      </div>
    </MantineThemeProvider>
  );
}

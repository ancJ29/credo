import { LANGUAGES, type Language } from '@credo/shared';
import {
  Container,
  Group,
  MantineProvider,
  SegmentedControl,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useState } from 'react';
import { Frame, type Scheme, type Width } from './Frame';
import { SCREENS } from './screens';

const SCHEMES: Scheme[] = ['light', 'dark'];
const WIDTHS: Width[] = [390, 768, 1280];

/** One filter: every value, or one. */
function Filter<T extends string | number>({
  label,
  values,
  value,
  onChange,
}: {
  label: string;
  values: readonly T[];
  value: T | 'all';
  onChange: (value: T | 'all') => void;
}) {
  return (
    <Group gap="xs">
      <Text size="sm" fw={500}>
        {label}
      </Text>
      <SegmentedControl
        size="xs"
        aria-label={label}
        value={String(value)}
        onChange={(next) => onChange(values.find((v) => String(v) === next) ?? 'all')}
        data={['all', ...values.map(String)]}
      />
    </Group>
  );
}

/**
 * The walks as one static page: piece 1's screens and the operator's, each in every state, light
 * and dark, at 390, 768 and 1280 pixels, in Vietnamese and English. Its screens are the app's own components.
 */
export function MockPage() {
  const [language, setLanguage] = useState<Language | 'all'>('all');
  const [scheme, setScheme] = useState<Scheme | 'all'>('all');
  const [width, setWidth] = useState<Width | 'all'>('all');
  const pick = <T,>(all: readonly T[], chosen: T | 'all') => (chosen === 'all' ? all : [chosen]);

  return (
    <MantineProvider>
      <Container size="100%" py="md">
        <Stack gap="xl">
          <div>
            <Title order={1}>The mock: piece 1 and the operator</Title>
            <Text c="dimmed">
              Each screen of the walks, from fixtures, in each of its states. No network.
            </Text>
          </div>
          <Group gap="lg">
            <Filter label="Language" values={LANGUAGES} value={language} onChange={setLanguage} />
            <Filter label="Theme" values={SCHEMES} value={scheme} onChange={setScheme} />
            <Filter label="Width" values={WIDTHS} value={width} onChange={setWidth} />
          </Group>
          {SCREENS.map((screen) => (
            <Stack key={screen.number} gap="md" component="section">
              <Title order={2}>
                {screen.number}. {screen.label}
              </Title>
              {screen.states.map((state) => (
                <Stack key={state.id} gap="xs">
                  <Title order={3} size="h5">
                    {state.label}
                  </Title>
                  <Group align="flex-start" gap="md">
                    {pick(LANGUAGES, language).flatMap((lang) =>
                      pick(SCHEMES, scheme).flatMap((sch) =>
                        pick(WIDTHS, width).map((w) => {
                          const title = `${screen.number} ${state.id} · ${lang} · ${sch} · ${w}`;
                          return (
                            <Frame
                              key={title}
                              title={title}
                              colour={state.colour}
                              language={lang}
                              scheme={sch}
                              width={w}
                            >
                              {state.screen}
                            </Frame>
                          );
                        }),
                      ),
                    )}
                  </Group>
                </Stack>
              ))}
            </Stack>
          ))}
        </Stack>
      </Container>
    </MantineProvider>
  );
}

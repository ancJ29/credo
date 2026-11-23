import type { Language } from '@credo/shared';
import { Box, Flex, Group, UnstyledButton } from '@mantine/core';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { SIZES, TOKENS, WEIGHTS } from '../../design-system/tokens';

// A language the switch offers, and the name it says for it.
type Choice = { language: Language; name: string };

/** A door's whole screen: the brand's gradient sweeping all of it, the language switch in its top right corner, and the card centred, with no menu, bar or header. */
export function DoorPage({
  languages = [],
  onLanguage,
  children,
}: {
  languages?: readonly Choice[];
  onLanguage?: (language: Language) => void;
  children: ReactNode;
}) {
  const { t, i18n } = useTranslation();
  return (
    <Box
      pos="relative"
      style={{
        minHeight: 'var(--door-page-height, 100vh)',
        background: TOKENS.doorSweep,
      }}
    >
      {languages.length > 1 && onLanguage && (
        <Group
          gap={0}
          wrap="nowrap"
          role="group"
          aria-label={t('user.language')}
          pos="absolute"
          top={12}
          right={16}
          style={{
            color: 'var(--credo-on-header)',
            border: '1px solid var(--credo-language-edge)',
            borderRadius: 6,
            overflow: 'hidden',
          }}
        >
          {languages.map(({ language, name }) => (
            <UnstyledButton
              key={language}
              aria-label={name}
              aria-current={i18n.language === language}
              px={8}
              py={3}
              fz={SIZES.chip}
              fw={WEIGHTS.title}
              style={{
                background: i18n.language === language ? 'var(--credo-language-picked)' : undefined,
              }}
              onClick={() => onLanguage(language)}
            >
              {language.toUpperCase()}
            </UnstyledButton>
          ))}
        </Group>
      )}
      <Flex justify="center" align="center" px="md" py={56} style={{ minHeight: 'inherit' }}>
        <Box w="100%" maw={474}>
          {children}
        </Box>
      </Flex>
    </Box>
  );
}

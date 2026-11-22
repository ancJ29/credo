import { CopyButton, TextInput } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { TOKENS } from '../../design-system/tokens';
import { ActionButton } from '../atoms/ActionButton';

/** A button that copies a value and says the copied word for a moment after; given a field, it sits at the right of a read-only field that shows the value in the code face. */
export function CopyText({
  value,
  label,
  about,
  field,
}: {
  value: string;
  label: string;
  about: string;
  field?: string;
}) {
  const { t } = useTranslation();
  const button = (
    <CopyButton value={value}>
      {({ copied, copy }) => {
        const shown = copied ? t('operator.copied') : label;
        return (
          <ActionButton meaning="other" label={`${shown}: ${about}`} onClick={copy}>
            {shown}
          </ActionButton>
        );
      }}
    </CopyButton>
  );
  if (field === undefined) return button;
  return (
    <TextInput
      label={field}
      value={value}
      readOnly
      styles={{ input: TOKENS.codeFace }}
      rightSectionWidth={96}
      rightSection={button}
    />
  );
}

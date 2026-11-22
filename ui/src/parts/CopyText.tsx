import { CopyButton } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { ActionButton } from '../components/atoms/ActionButton';

type Props = {
  /** What lands on the clipboard. */
  value: string;
  /** The button's words before it is pressed. */
  label: string;
  /** What is copied, so the button's name tells one copy button from the next. */
  about: string;
};

/** A button that copies `value`, and says "Copied" for a moment after. */
export function CopyText({ value, label, about }: Props) {
  const { t } = useTranslation();
  return (
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
}

import { Button, CopyButton } from '@mantine/core';
import { useTranslation } from 'react-i18next';

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
          <Button variant="default" size="xs" aria-label={`${shown}: ${about}`} onClick={copy}>
            {shown}
          </Button>
        );
      }}
    </CopyButton>
  );
}

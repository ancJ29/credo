import type { BoxItem } from '@credo/shared';
import { Radio, Stack } from '@mantine/core';
import { useTranslation } from 'react-i18next';

type Props = {
  label: string;
  description: string;
  boxes: BoxItem[];
  value: string;
  onChange: (box: string) => void;
};

const GIB = 1024 ** 3;

/** The boxes a company may be put on, one to pick, each with its free disk and its companies; a
 * box that did not answer is shown so and cannot be picked. The add form and the move's page both
 * list them this way. */
export function BoxChoice({ label, description, boxes, value, onChange }: Props) {
  const { t } = useTranslation();
  return (
    <Radio.Group label={label} description={description} value={value} onChange={onChange}>
      <Stack gap="xs" mt="xs">
        {boxes.map((item) => (
          <Radio
            key={item.name}
            value={item.name}
            disabled={item.freeBytes === null}
            label={
              item.freeBytes === null
                ? t('operator.boxDown', { name: item.name })
                : t('operator.boxLine', {
                    name: item.name,
                    free: Math.floor(item.freeBytes / GIB),
                    companies: item.companies,
                  })
            }
          />
        ))}
      </Stack>
    </Radio.Group>
  );
}

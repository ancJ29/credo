import { Group, Image, Title, type TitleOrder } from '@mantine/core';
import type { Brand } from './brand';

/** The company's logo beside its name: the shell's first heading. */
export function BrandMark({ brand, order = 1 }: { brand: Brand; order?: TitleOrder }) {
  return (
    <Group gap="sm" wrap="nowrap">
      {brand.logo && <Image src={brand.logo} alt="" h={32} w={32} fit="contain" />}
      <Title order={order} size="h4">
        {brand.name}
      </Title>
    </Group>
  );
}

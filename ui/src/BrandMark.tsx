import { Group, Image, Title, type TitleOrder } from '@mantine/core';
import type { Brand } from './brand';

/** The company's logo beside its name: the first heading of every screen but a page's own. */
export function BrandMark({ brand, order = 1 }: { brand: Brand; order?: TitleOrder }) {
  return (
    <Group gap="sm" wrap="nowrap">
      {brand.logo && <Image src={brand.logo} alt="" h={36} w={36} fit="contain" />}
      <Title order={order} size="h4">
        {brand.name}
      </Title>
    </Group>
  );
}

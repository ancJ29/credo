import { Anchor, Stack, Text } from '@mantine/core';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { SAMPLES, useLanguage } from './samples';

/** The links as the screens draw them, in the theme's link colour, worded by the dictionary where a screen says it. */
export const LinkStates: { name: string; node: ReactNode }[] = [
  { name: 'A name link in a row', node: <NameLink /> },
  { name: 'A phone link', node: <PhoneLink /> },
  { name: 'A link in a sentence', node: <SentenceLink /> },
];

/** A name that opens its page, as a list's row draws it. */
function NameLink() {
  const words = SAMPLES[useLanguage()];
  return (
    <Anchor component={Link} to="/staff/1" w="fit-content">
      {words.person}
    </Anchor>
  );
}

/** A phone number a tap calls, as the driver's page draws it. */
function PhoneLink() {
  const { t } = useTranslation();
  const { phone } = SAMPLES[useLanguage()];
  return (
    <Text>
      <Anchor href={`tel:${phone.replace(/\s/g, '')}`}>{t('myDeliveries.call', { phone })}</Anchor>
    </Text>
  );
}

/** An order's number inside a sentence, as a delivery's page draws it. */
function SentenceLink() {
  const { t } = useTranslation();
  return (
    <Stack>
      <Text>
        {t('orders.fromOrder')}{' '}
        <Anchor component={Link} to="/orders/2026-11-22/1">
          DH-0001
        </Anchor>
      </Text>
    </Stack>
  );
}

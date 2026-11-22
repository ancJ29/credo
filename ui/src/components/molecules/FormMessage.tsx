import { Alert, Stack } from '@mantine/core';
import type { ReactNode } from 'react';
import { TONES } from '../../design-system/tokens';

/** A message to the person, by its kind: its colour and spoken role follow the kind, and a standing note from the page load is spoken as a note. */
export function FormMessage({
  kind,
  title,
  standing,
  act,
  children,
}: {
  kind: 'error' | 'warning' | 'success' | 'info' | 'saved';
  title?: string;
  standing?: boolean;
  act?: ReactNode;
  children: ReactNode;
}) {
  const tone = kind === 'saved' ? 'success' : kind === 'error' ? 'danger' : kind;
  const role = standing ? 'note' : kind === 'error' || kind === 'warning' ? 'alert' : 'status';
  return (
    <Alert color={TONES[tone]} role={role} title={title} w="100%">
      {act === undefined ? (
        children
      ) : (
        <Stack gap="xs" align="flex-start">
          {children}
          {act}
        </Stack>
      )}
    </Alert>
  );
}

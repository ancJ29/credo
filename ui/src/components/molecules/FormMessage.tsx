import { Alert } from '@mantine/core';
import { TONES } from '../../design-system/tokens';

/** A message to the person, by its kind: its colour and spoken role follow the kind, and a standing note from the page load is spoken as a note. */
export function FormMessage({
  kind,
  title,
  standing,
  children,
}: {
  kind: 'error' | 'warning' | 'success' | 'info' | 'saved';
  title?: string;
  standing?: boolean;
  children: string;
}) {
  const tone = kind === 'saved' ? 'success' : kind === 'error' ? 'danger' : kind;
  const role = standing ? 'note' : kind === 'error' || kind === 'warning' ? 'alert' : 'status';
  return (
    <Alert color={TONES[tone]} role={role} title={title}>
      {children}
    </Alert>
  );
}

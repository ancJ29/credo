import type { CreateClientReply } from '@credo/shared';
import { useState } from 'react';
import { type Api } from './api';
import { ClientMade } from './ClientMade';
import { NewClient } from './NewClient';
import { refusal } from './page';

type Props = { api: Api; onSignedOut: () => void };

/** Adding a client: the form, then the answer once. The answer lives in this page's state alone,
 * so a reload or a step away loses it and the password is never shown twice. */
export function AddClientPage({ api, onSignedOut }: Props) {
  const [status, setStatus] = useState<'idle' | 'busy' | 'failed' | 'taken'>('idle');
  const [made, setMade] = useState<CreateClientReply | null>(null);

  async function submit(code: string, name: string) {
    setStatus('busy');
    try {
      const result = await api.makeClient(code, name);
      if (result.kind === 'taken') return setStatus('taken');
      setStatus('idle');
      setMade(result.client);
    } catch (error) {
      refusal(error, { onSignedOut });
      setStatus('failed');
    }
  }

  return made ? (
    <ClientMade
      link={`${window.location.origin}${made.link}`}
      rootName={made.rootName}
      password={made.password}
      onAnother={() => setMade(null)}
    />
  ) : (
    <NewClient status={status} onSubmit={(c, n) => void submit(c, n)} />
  );
}

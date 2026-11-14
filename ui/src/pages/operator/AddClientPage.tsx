import type { BoxItem, CreateClientReply } from '@credo/shared';
import { useEffect, useState } from 'react';
import { type Api } from '../../api';
import { ClientMade } from '../../parts/ClientMade';
import { NewClient } from '../../parts/NewClient';
import { refusal } from '../../page';

type Props = { api: Api; onSignedOut: () => void };

/** Adding a client: the form, then the answer once. The answer lives in this page's state alone,
 * so a reload or a step away loses it and the password is never shown twice. */
export function AddClientPage({ api, onSignedOut }: Props) {
  const [status, setStatus] = useState<'idle' | 'busy' | 'failed' | 'taken'>('idle');
  const [made, setMade] = useState<CreateClientReply | null>(null);
  const [boxes, setBoxes] = useState<BoxItem[]>([]);

  /** The list the operator picks a box from. A list that does not come leaves the form without a
   * choice, so a company is made on the home box as before. */
  useEffect(() => {
    void (async () => {
      try {
        setBoxes(await api.operatorBoxes());
      } catch {
        // no list, no choice
      }
    })();
  }, [api]);

  async function submit(code: string, name: string, box?: string) {
    setStatus('busy');
    try {
      const result = await api.makeClient(code, name, ...(box === undefined ? [] : [box]));
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
    <NewClient status={status} boxes={boxes} onSubmit={(c, n, b) => void submit(c, n, b)} />
  );
}

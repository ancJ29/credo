import type { ConfigDoc, TenantConfig } from '@credo/shared';
import { useState } from 'react';
import { type Api, ApiError } from './api';
import { Settings } from './Settings';

type Props = {
  api: Api;
  doc: ConfigDoc;
  /** The settings now stored, after a save or a reload: the whole app draws from them. */
  onDoc: (doc: ConfigDoc) => void;
  onSignedOut: () => void;
  /** A 403 means what the person may do changed: the app reads who they are again. */
  onForbidden: () => void;
};

/** Settings wired to the BFF: a save sends the version it was read at, and an outcome that is
 * not "saved" keeps what was typed. */
export function SettingsPage({ api, doc, onDoc, onSignedOut, onForbidden }: Props) {
  const [status, setStatus] = useState<'loading' | 'failed' | 'ready'>('ready');
  const [outcome, setOutcome] = useState<'saved' | 'failed' | 'refused' | 'conflict' | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(config: TenantConfig) {
    setSaving(true);
    setOutcome(null);
    try {
      const result = await api.saveConfig(config, doc.version);
      if (result.kind === 'saved') onDoc(result.doc);
      setOutcome(result.kind === 'saved' ? 'saved' : 'conflict');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) onSignedOut();
      else if (error instanceof ApiError && error.status === 403) {
        // No longer theirs to change: the app reads who they are again, and the redraw replaces
        // this page if the right is gone.
        onForbidden();
        setOutcome('failed');
      }
      // A 400 is the BFF refusing these settings: trying again as they are can never succeed.
      else setOutcome(error instanceof ApiError && error.status === 400 ? 'refused' : 'failed');
    } finally {
      setSaving(false);
    }
  }

  /** The newer settings: read again, and the form starts from them. */
  async function reload() {
    setStatus('loading');
    setOutcome(null);
    try {
      onDoc(await api.getConfig());
      setStatus('ready');
    } catch {
      setStatus('failed');
    }
  }

  return (
    <Settings
      key={doc.version}
      status={status}
      config={doc.config}
      outcome={outcome}
      saving={saving}
      onSave={(config) => void save(config)}
      onRetry={() => void reload()}
      onReload={() => void reload()}
    />
  );
}

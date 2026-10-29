import { type CStorageClient, recordKeys } from '@credo/shared';
import { SCENARIO_IDS, type ScenarioId } from './scenarios';

/** The seed's record for one copy: its scenario, its first day, the last day applied, and whether
 * the first fill has finished. The BFF never reads it. */
export type Ledger = {
  client: string;
  scenario: ScenarioId;
  firstDay: string;
  lastDay: string;
  filled: boolean;
};

const isDay = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

/** A ledger as stored, or an error: a record that is not one is the seed's fault to name, never to
 * guess at. */
export function parseLedger(data: unknown): Ledger {
  const ledger = data as Partial<Record<keyof Ledger, unknown>> | null;
  if (
    typeof ledger !== 'object' ||
    ledger === null ||
    typeof ledger.client !== 'string' ||
    !SCENARIO_IDS.includes(ledger.scenario as ScenarioId) ||
    !isDay(ledger.firstDay) ||
    !isDay(ledger.lastDay) ||
    typeof ledger.filled !== 'boolean'
  ) {
    throw new Error('the seed ledger does not parse');
  }
  return ledger as Ledger;
}

export async function readLedger(storage: CStorageClient, tenantId: string) {
  const found = await storage.getRecord(recordKeys.tenant(tenantId).seed);
  return found ? { ledger: parseLedger(found.data), tag: found.tag } : null;
}

/** Writes the ledger over the tag it was read at (null for a first write). Gives the new tag, or
 * null when the ledger moved, which means another run holds this copy. */
export async function writeLedger(
  storage: CStorageClient,
  tenantId: string,
  ledger: Ledger,
  tag: string | null,
) {
  const key = recordKeys.tenant(tenantId).seed;
  if ((await storage.putRecord(key, ledger, tag)) === 'moved') return null;
  // The tag is read back; if what sits there is not what was written, someone wrote after us.
  const back = (await storage.getRecord(key))!;
  const written = back.data as Record<string, unknown>;
  const same = (Object.keys(ledger) as (keyof Ledger)[]).every(
    (name) => written[name] === ledger[name],
  );
  return same ? back.tag : null;
}

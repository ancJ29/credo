import type { ScenarioId } from './scenarios';

/** A partner's label by the walks' rule: 1 to 20 lowercase letters, digits or hyphens. */
export const PARTNER_LABEL = /^[a-z0-9-]{1,20}$/;

/** One partner's own copy of a client: the code the human makes it under at `/operator`. */
type Copy = { partner: string; code: string };

export type DemoClient = {
  scenario: ScenarioId;
  /** The invented company, the same in every copy. */
  company: string;
  copies: Copy[];
};

/**
 * The mapping, labels and codes alone: which client each partner has a copy of, which scenario each
 * client is, and its invented company. A code is the company's name without marks and the copy's
 * number, never the partner's label. The label to a partner's name is kept outside git.
 */
export const CLIENTS: Record<string, DemoClient> = {
  A: {
    scenario: 'S1',
    company: 'Vật liệu Quảng Tín Đạt',
    copies: [
      { partner: 'p1', code: 'vat-lieu-quang-tin-dat-1' },
      { partner: 'p2', code: 'vat-lieu-quang-tin-dat-2' },
      { partner: 'p3', code: 'vat-lieu-quang-tin-dat-3' },
    ],
  },
  B: {
    scenario: 'S2',
    company: 'Phân phối Lộc Vượng Hải',
    copies: [
      { partner: 'p1', code: 'phan-phoi-loc-vuong-hai-1' },
      { partner: 'p2', code: 'phan-phoi-loc-vuong-hai-2' },
      { partner: 'p3', code: 'phan-phoi-loc-vuong-hai-3' },
    ],
  },
};

/** Every copy, flat, with its client. */
export const allCopies = () =>
  Object.entries(CLIENTS).flatMap(([client, { scenario, company, copies }]) =>
    copies.map((copy) => ({ client, scenario, company, ...copy })),
  );

/** The copy a code names, or nothing: a code outside the mapping is never touched. */
export const copyOfCode = (code: string) => allCopies().find((copy) => copy.code === code);

/** A copy whose ledger names another scenario than the mapping is refused, never switched. */
export function assertLedgerScenario(code: string, ledgerScenario: string) {
  const copy = copyOfCode(code);
  if (!copy) throw new Error(`${code} is not in the mapping`);
  if (copy.scenario !== ledgerScenario) {
    throw new Error(`${code}: the ledger names ${ledgerScenario}, the mapping ${copy.scenario}`);
  }
}

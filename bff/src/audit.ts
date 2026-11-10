import type { ActionId, ActivityEntry } from '@credo/shared';
import type { FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyContextConfig {
    /** The action a route's change writes to the activity log: set on a route that changes data. */
    audit?: ActionId;
    /** The reason a route that posts, puts or deletes yet writes no entry: it changes no client's
     * data. The route-list test tells a forgotten route from a chosen one by it. */
    exempt?: string;
  }
}

/** What a route declares about the change it made: the hook adds the client, unless the route names
 * another, the time and the send. */
export type Declared = Pick<ActivityEntry, 'actorId' | 'action' | 'memo'> & {
  targetId?: string;
  clientId?: string;
};

/** Who an entry names: `employee.<id>`, or `root` (the root has no employee id). Three kinds
 * cannot collide, `operator.<id>` being the third. */
const actorOf = (who: { employeeId?: string | null }) =>
  who.employeeId ? `employee.${who.employeeId}` : 'root';

/** A person signed in to a client: the entry's actor, and the name as shown now. */
export const personOf = (who: { employeeId?: string | null; name: string }) => ({
  actorId: actorOf(who),
  by: who.name,
});

/** An operator signed in. */
export const operatorOf = (operator: { id: string; name: string }) => ({
  actorId: `operator.${operator.id}`,
  by: operator.name,
});

/** The entry a route declares, as it stands now. */
export type Entry = {
  /** The record the change is to, once the route knows it (a create mints its id late). */
  target: (id: string) => void;
  /** The change landed: the record before it (none for a create) and after. A memo never holds a
   * password, a hash or a photo's bytes: those routes pass none. */
  saved: (before: unknown, after: unknown) => void;
  /** An import landed: one entry for each record it created, in place of the call's own. */
  created: (records: { id: string }[]) => void;
};

/** Declares the route's entry at its top, once the person is known, in its refused form: the
 * outcome and no `after`. The route marks it as standing at its write, so the hook sends the
 * outcome the change had. The action is the route's own `config.audit`. */
export function declare(
  request: FastifyRequest,
  actor: { actorId: string; by: string },
  targetId?: string,
  clientId?: string,
): Entry {
  const action = request.routeOptions.config.audit as ActionId;
  const entry: Declared = {
    actorId: actor.actorId,
    action,
    targetId,
    clientId,
    memo: { by: actor.by, before: null, outcome: 'refused' },
  };
  request.audit = [entry];
  return {
    target: (id) => {
      entry.targetId = id;
    },
    saved: (before, after) => {
      entry.memo = { by: actor.by, before, after, outcome: 'saved' };
    },
    created: (records) => {
      request.audit = records.map((record) => ({
        ...entry,
        targetId: record.id,
        memo: { by: actor.by, before: null, after: record, outcome: 'saved' },
      }));
    },
  };
}

/** A route's options for a route that writes no entry, and why: the reason is read by the
 * route-list test. */
export const exempt = <T extends object>(reason: string, options?: T) => ({
  ...options,
  config: { exempt: reason },
});

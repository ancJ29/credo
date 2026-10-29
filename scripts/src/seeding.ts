import { createServer, type Server } from 'node:http';
import type { SeededClient } from './generator';

/** Where a failure goes: the stack's own stderr, which the run's log keeps when the stack's data
 * folder is gone. The answer to the caller stays "could not seed". */
export const logToStderr = (error: unknown) => {
  process.stderr.write(`seed failed: ${String(error)}\n`);
};

/**
 * The one door a command has to more data: `POST /seed` makes a client of its own from the data
 * set and answers its code and first passwords. A walk that adds or archives someone cannot be
 * undone, so each screen of the full run opens on a client no earlier screen touched. The stack
 * serves it on loopback alone, for as long as it stands; nothing else is routed, and a refusal
 * names no more than "could not seed"; the answer goes first, then the reason to `log`, whose own
 * failure never reaches the caller.
 */
export function createSeeding(
  seed: () => Promise<SeededClient>,
  log: (error: unknown) => void,
): Server {
  return createServer((request, response) => {
    const reply = (status: number, body: unknown) => {
      response.writeHead(status, { 'content-type': 'application/json' });
      response.end(JSON.stringify(body));
    };
    if (request.method !== 'POST' || request.url !== '/seed') {
      reply(404, { error: 'Not found' });
      return;
    }
    seed().then(
      (client) => reply(201, client),
      (error: unknown) => {
        reply(500, { error: 'could not seed' });
        try {
          log(error);
        } catch {
          // A log that fails has nothing left to tell: the caller has its answer.
        }
      },
    );
  });
}

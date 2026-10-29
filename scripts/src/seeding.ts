import { createServer, type Server } from 'node:http';
import type { SeededClient } from './generator';

/**
 * The one door a command has to more data: `POST /seed` makes a client of its own from the data
 * set and answers its code and first passwords. A walk that adds or archives someone cannot be
 * undone, so each screen of the full run opens on a client no earlier screen touched. The stack
 * serves it on loopback alone, for as long as it stands; nothing else is routed, and a refusal
 * names no more than "could not seed".
 */
export function createSeeding(seed: () => Promise<SeededClient>): Server {
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
      () => reply(500, { error: 'could not seed' }),
    );
  });
}

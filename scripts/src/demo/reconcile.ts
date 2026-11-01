import { atMinute } from './days';
import { SCENARIOS, type ScenarioId } from './scenarios';
import { streamOf } from './stream';

/** What a driver hands in for a day and when the office closes it: a pure function of the client,
 * its scenario, the day and the driver. Most hand in exactly the sum to collect; about one in five
 * is short by a small sum, now and then one is over. A short sum never passes what was to be
 * collected, so the cash is never below 0. */
export function closeOf(
  client: string,
  scenario: ScenarioId,
  day: string,
  driver: string,
  toCollect: number,
) {
  const { closeAt, closeSpread, short, over } = SCENARIOS[scenario].reconciliation;
  const s = streamOf(client, scenario, 'close', day, driver);
  const sum = ({ by: [from, to], step }: typeof short) =>
    from + step * s.int((to - from) / step + 1);
  const drawn = s.next();
  let gap = 0;
  if (drawn < short.odds) gap = -Math.min(sum(short), toCollect);
  else if (drawn < short.odds + over.odds) gap = sum(over);
  return { handedIn: toCollect + gap, at: atMinute(day, closeAt + s.int(closeSpread)) };
}

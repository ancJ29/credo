/** Days are Vietnam's (UTC+07), written `YYYY-MM-DD`; every function here reads and gives that
 * form, so a date never depends on the machine's own zone. */
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MINUTE = 60_000;

function utcOf(date: string) {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!DAY.test(date) || Number.isNaN(parsed.getTime()) || !parsed.toISOString().startsWith(date)) {
    throw new Error(`not a day: ${date}`);
  }
  return parsed;
}

export function addDays(date: string, days: number) {
  const moved = utcOf(date);
  moved.setUTCDate(moved.getUTCDate() + days);
  return moved.toISOString().slice(0, 10);
}

export const isSunday = (date: string) => utcOf(date).getUTCDay() === 0;

/** The days from `from` up to but not including `to`. */
export function daysBetween(from: string, to: string) {
  const days: string[] = [];
  for (let day = from; day < to; day = addDays(day, 1)) days.push(day);
  return days;
}

/** The moment, in milliseconds, at `minutes` past midnight of that day in Vietnam. */
export const atMinute = (date: string, minutes: number) =>
  utcOf(date).getTime() - 7 * 60 * MINUTE + minutes * MINUTE;

import { describe, expect, it } from 'vitest';
import { CHALLENGE_MS, createChallenges } from './challenge';

const KEY = 'a-service-key';
const at = (start: number) => {
  let time = start;
  return { now: () => time, advance: (ms: number) => void (time += ms) };
};

describe('A challenge is signed under a key derived from the service key, not stored', () => {
  it('opens for its purpose and its subject, and for no other', () => {
    const clock = at(1000);
    const challenges = createChallenges({ serviceKey: KEY, now: clock.now });
    const token = challenges.mint('c1', 'join', 'link-hash');
    expect(challenges.open(token, 'join', 'link-hash')).toBe('c1');
    expect(challenges.open(token, 'sign-in', 'link-hash')).toBeNull();
    expect(challenges.open(token, 'join', 'another-hash')).toBeNull();
    expect(challenges.open(token, 'join')).toBeNull();
    expect(challenges.open(challenges.mint('c2', 'sign-in'), 'sign-in')).toBe('c2');
  });

  it('is good for 5 minutes and not a moment more', () => {
    const clock = at(1000);
    const challenges = createChallenges({ serviceKey: KEY, now: clock.now });
    const token = challenges.mint('c1', 'add', 'op');
    clock.advance(CHALLENGE_MS - 1);
    expect(challenges.open(token, 'add', 'op')).toBe('c1');
    clock.advance(1);
    expect(challenges.open(token, 'add', 'op')).toBeNull();
  });

  it('does not open when changed, signed under another key, or not in the form', () => {
    const clock = at(1000);
    const challenges = createChallenges({ serviceKey: KEY, now: clock.now });
    const other = createChallenges({ serviceKey: 'another-key', now: clock.now });
    const token = challenges.mint('c1', 'sign-in');
    const [body, signature] = token.split('.') as [string, string];
    const longer = Buffer.from(
      JSON.stringify({ challenge: 'c1', purpose: 'sign-in', subject: '', endsAt: 1e15 }),
    ).toString('base64url');
    expect(challenges.open(`${longer}.${signature}`, 'sign-in')).toBeNull();
    expect(other.open(token, 'sign-in')).toBeNull();
    for (const bad of ['', body, `${body}.`, `.${signature}`, `${token}.extra`]) {
      expect(challenges.open(bad, 'sign-in'), bad).toBeNull();
    }
  });

  it('mints a token that holds the challenge and not the key', () => {
    const challenges = createChallenges({ serviceKey: KEY, now: () => 1 });
    const token = challenges.mint('c1', 'sign-in');
    expect(token).not.toContain(KEY);
    expect(Buffer.from(token.split('.')[0], 'base64url').toString()).toContain('"c1"');
  });
});

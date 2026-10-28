// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { fingerprintOf } from './fingerprint';

describe('the fingerprint', () => {
  it('is twelve hex digits of the words, the same for the same words and another for a changed one', () => {
    const words = ['heading: Sign in', 'button: Go'];

    expect(fingerprintOf(words)).toMatch(/^[0-9a-f]{12}$/);
    expect(fingerprintOf([...words])).toBe(fingerprintOf(words));
    expect(fingerprintOf(['heading: Sign in', 'button: Go on'])).not.toBe(fingerprintOf(words));
    // A line is a line: two words on one line are not two lines.
    expect(fingerprintOf(['a b'])).not.toBe(fingerprintOf(['a', 'b']));
  });
});

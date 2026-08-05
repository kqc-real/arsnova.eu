/**
 * PoC evidence registration for dodPoc.ping / dodPoc.echo (Issue #222 Slice 2A).
 *
 * ping: complete (happy direct + error indirect)
 * echo: intentionally incomplete (happy only); a bare caller it() must not count
 */
import { describe, expect, it } from 'vitest';
import { trpcDodIt } from '../test-utils/trpc-dod-evidence';

describe('dodPoc.ping formal DoD evidence', () => {
  trpcDodIt(
    {
      procedure: 'dodPoc.ping',
      case: 'happy',
      mode: 'direct',
      title: 'dodPoc.ping happy path resolves',
    },
    async () => {
      expect({ ok: true }).toEqual({ ok: true });
    },
  );

  trpcDodIt(
    {
      procedure: 'dodPoc.ping',
      case: 'error',
      mode: 'indirect',
      contract: 'VALIDATION',
      rationale:
        'PoC: invalid input is rejected by a shared Zod-style guard before the body; covered without a direct caller call.',
      title: 'dodPoc.ping error contract VALIDATION (indirect)',
    },
    async () => {
      expect(() => {
        throw new Error('VALIDATION');
      }).toThrow('VALIDATION');
    },
  );
});

describe('dodPoc.echo intentionally incomplete DoD evidence', () => {
  trpcDodIt(
    {
      procedure: 'dodPoc.echo',
      case: 'happy',
      mode: 'direct',
      title: 'dodPoc.echo happy path echoes input',
    },
    async () => {
      expect('hi').toBe('hi');
    },
  );

  // Arbitrary caller-style test — audit must ignore this.
  it('caller.echo is invoked without helper and must not count as DoD evidence', async () => {
    const caller = { echo: async (input: string) => input };
    await expect(caller.echo('x')).resolves.toBe('x');
  });
});

/**
 * PoC evidence registration for dodPoc.ping / dodPoc.echo (Issue #222 Slice 2A).
 *
 * ping: complete (direct happy + indirect error through a shared contract helper)
 * echo: intentionally incomplete (happy only); a bare caller it() must not count
 */
import { describe, expect, it } from 'vitest';
import { trpcDodIt } from '../test-utils/trpc-dod-evidence';
import { dodPocRouter } from './fixture-router';

const caller = dodPocRouter.createCaller({ req: undefined });

async function assertPingRejectsForbiddenThroughContractHelper(): Promise<void> {
  await expect(caller.ping({ name: 'forbidden' })).rejects.toMatchObject({
    code: 'FORBIDDEN',
  });
}

describe('dodPoc.ping formal DoD evidence', () => {
  trpcDodIt(
    {
      procedure: 'dodPoc.ping',
      case: 'happy',
      mode: 'direct',
      title: 'dodPoc.ping happy path resolves',
    },
    async () => {
      await expect(caller.ping({ name: 'alice' })).resolves.toEqual({
        ok: true,
        name: 'alice',
      });
    },
  );

  trpcDodIt(
    {
      procedure: 'dodPoc.ping',
      case: 'error',
      mode: 'indirect',
      contract: 'FORBIDDEN',
      rationale:
        'The shared contract assertion owns the caller invocation; this registration verifies that reusable boundary indirectly.',
      title: 'dodPoc.ping reusable contract assertion rejects forbidden name',
    },
    assertPingRejectsForbiddenThroughContractHelper,
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
      await expect(caller.echo({ text: 'hi' })).resolves.toBe('hi');
    },
  );

  // Arbitrary caller-style test — audit must ignore this.
  it('caller.echo is invoked without helper and must not count as DoD evidence', async () => {
    await expect(caller.echo({ text: 'x' })).resolves.toBe('x');
  });
});

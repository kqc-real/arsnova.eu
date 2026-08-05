/**
 * PoC evidence registration for dodPoc.ping / dodPoc.echo (Issue #222 Slice 2A).
 *
 * ping: complete (happy + error, both via createCaller)
 * echo: intentionally incomplete (happy only); a bare caller it() must not count
 */
import { describe, expect, it } from 'vitest';
import { trpcDodIt } from '../test-utils/trpc-dod-evidence';
import { dodPocRouter } from './fixture-router';

const caller = dodPocRouter.createCaller({ req: undefined });

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
      mode: 'direct',
      contract: 'FORBIDDEN',
      title: 'dodPoc.ping rejects forbidden name',
    },
    async () => {
      await expect(caller.ping({ name: 'forbidden' })).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
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
      await expect(caller.echo({ text: 'hi' })).resolves.toBe('hi');
    },
  );

  // Arbitrary caller-style test — audit must ignore this.
  it('caller.echo is invoked without helper and must not count as DoD evidence', async () => {
    await expect(caller.echo({ text: 'x' })).resolves.toBe('x');
  });
});

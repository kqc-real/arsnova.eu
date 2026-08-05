/**
 * PoC fixture router for ADR-0034 / Issue #222 Slice 2A.
 *
 * Real tRPC router (not mounted on AppRouter) so evidence tests can exercise
 * procedures via `createCaller`.
 */
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { publicProcedure, router } from '../../trpc';

/** Exactly two query/mutation procedures plus one subscription for classification. */
export const dodPocRouter = router({
  ping: publicProcedure.input(z.object({ name: z.string().min(1) })).query(({ input }) => {
    if (input.name === 'forbidden') {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'ping forbidden' });
    }
    return { ok: true as const, name: input.name };
  }),
  echo: publicProcedure.input(z.object({ text: z.string().min(1) })).mutation(({ input }) => {
    return input.text;
  }),
  onTick: publicProcedure.subscription(async function* () {
    yield { t: 1 };
  }),
});

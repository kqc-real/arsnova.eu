/**
 * PoC fixture router for ADR-0034 / Issue #222 Slice 2A.
 *
 * Not mounted on AppRouter. Structural stand-in so the audit can inventarise
 * query/mutation/subscription and compute source fingerprints.
 */

const publicProcedure = {
  query: (fn: unknown) => ({ kind: 'query' as const, fn }),
  mutation: (fn: unknown) => ({ kind: 'mutation' as const, fn }),
  subscription: (fn: unknown) => ({ kind: 'subscription' as const, fn }),
};

function router<T extends Record<string, unknown>>(def: T): T {
  return def;
}

/** Exactly two query/mutation procedures plus one subscription for classification. */
export const dodPocRouter = router({
  ping: publicProcedure.query(async () => {
    return { ok: true as const };
  }),
  echo: publicProcedure.mutation(async (opts: { input: string }) => {
    if (!opts.input) {
      throw new Error('VALIDATION');
    }
    return opts.input;
  }),
  onTick: publicProcedure.subscription(async function* () {
    yield { t: Date.now() };
  }),
});

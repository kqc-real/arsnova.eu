import { z } from 'zod';

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    Symbol.asyncIterator in value &&
    typeof value[Symbol.asyncIterator] === 'function'
  );
}

/**
 * Validiert jeden Yield eines AsyncIterable. Ein normales `.output(schema)`
 * würde bei tRPC sonst den Iterator selbst gegen das Elementschema prüfen.
 */
export function zAsyncIterable<TYieldIn, TYieldOut>(yieldSchema: z.ZodType<TYieldOut, TYieldIn>) {
  return z.custom<AsyncIterable<TYieldIn>>(isAsyncIterable).transform(async function* (iterable) {
    const iterator = iterable[Symbol.asyncIterator]();
    try {
      let next = await iterator.next();
      while (!next.done) {
        yield await yieldSchema.parseAsync(next.value);
        next = await iterator.next();
      }
    } finally {
      await iterator.return?.();
    }
  }) as z.ZodType<AsyncIterable<TYieldOut>, AsyncIterable<TYieldIn>>;
}

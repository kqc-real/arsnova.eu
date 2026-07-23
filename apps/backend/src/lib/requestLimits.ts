/** Global HTTP ceiling for tRPC request bodies (2 MiB). */
export const TRPC_MAX_BODY_SIZE_BYTES = 2 * 1024 * 1024;

/** Human-readable equivalent used in API errors and operator documentation. */
export const TRPC_MAX_BODY_SIZE_LABEL = '2 MiB';

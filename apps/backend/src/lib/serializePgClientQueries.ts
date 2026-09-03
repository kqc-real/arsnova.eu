import type pg from 'pg';

type PgQueryArgs = Parameters<pg.PoolClient['query']>;
type PgQueryResult = ReturnType<pg.PoolClient['query']>;

const SERIALIZED_QUERY_FLAG = Symbol.for('arsnova.pg.serializeQueriesOnClient');

/**
 * Stellt sicher, dass auf einem physischen Client höchstens eine Query
 * gleichzeitig aktiv ist. Pool-Level-Concurrency bleibt erhalten.
 *
 * Braucht es, weil Prisma in Transaktionen Relation-Joins per Promise.all
 * auf einem gepinnten PoolClient startet; pg warnt dabei und wirft ab pg@9.
 *
 * Idempotent: Pool-Clients werden wiederverwendet; wiederholte Aufrufe
 * stapeln keinen weiteren Wrapper.
 */
export function serializeQueriesOnClient<T extends pg.PoolClient>(client: T): T {
  const flagged = client as T & { [SERIALIZED_QUERY_FLAG]?: true };
  if (flagged[SERIALIZED_QUERY_FLAG]) {
    return client;
  }

  let tail: Promise<unknown> = Promise.resolve();
  const originalQuery = client.query.bind(client) as (...args: PgQueryArgs) => PgQueryResult;

  client.query = ((...args: PgQueryArgs) => {
    const run = tail.then(
      () => originalQuery(...args),
      () => originalQuery(...args),
    );
    // Fehler dürfen die Queue nicht blockieren; der Caller sieht sie weiter.
    tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run as unknown as PgQueryResult;
  }) as pg.PoolClient['query'];

  flagged[SERIALIZED_QUERY_FLAG] = true;
  return client;
}

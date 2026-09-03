/**
 * Prisma-Client-Singleton (Story 2.1a, 4.7).
 * Prisma 7: Client-Engine benötigt Driver-Adapter (@prisma/adapter-pg).
 *
 * Expliziter pg.Pool + Query-Serialisierung pro ausgechecktem Client:
 * Prisma holt Relation-Joins in Transaktionen per Promise.all auf einem
 * gepinnten PoolClient; paralleles client.query() ist in pg deprecated
 * und wird in pg@9 zum Fehler.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { serializeQueriesOnClient } from './lib/serializePgClientQueries';

const connectionString =
  process.env['DATABASE_URL'] ??
  'postgresql://arsnova_user:secretpassword@localhost:5432/arsnova_v3_dev?schema=public';

function createPgPool(): pg.Pool {
  const pool = new pg.Pool({ connectionString });
  const originalConnect = pool.connect.bind(pool);

  pool.connect = ((
    callback?: (
      err: Error | undefined,
      client: pg.PoolClient | undefined,
      done: (release?: unknown) => void,
    ) => void,
  ) => {
    if (typeof callback === 'function') {
      return originalConnect((err, client, done) => {
        if (client) {
          serializeQueriesOnClient(client);
        }
        callback(err, client, done);
      });
    }

    return originalConnect().then((client) => serializeQueriesOnClient(client));
  }) as typeof pool.connect;

  return pool;
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pgPool?: pg.Pool;
};

export const pgPool = globalForPrisma.pgPool ?? createPgPool();

const adapter = new PrismaPg(pgPool);
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env['NODE_ENV'] === 'development' ? ['query', 'error', 'warn'] : [], // In Production keine Prisma-Logs; Health-Stats fangen DB-Ausfall ab und liefern Fallback
  });

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma;
  globalForPrisma.pgPool = pgPool;
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  await pgPool.end();
  if (process.env['NODE_ENV'] !== 'production') {
    delete globalForPrisma.prisma;
    delete globalForPrisma.pgPool;
  }
}

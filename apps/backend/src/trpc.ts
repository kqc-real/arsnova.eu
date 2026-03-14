/**
 * tRPC-Initialisierung (Story 0.5: Context mit req für Rate-Limit-IP).
 */
import { initTRPC } from '@trpc/server';
import type { IncomingMessage } from 'http';
import { TRPCError } from '@trpc/server';
import { extractAdminToken, isAdminSessionTokenValid } from './lib/adminAuth';

export type Context = {
  req?: IncomingMessage;
  adminToken?: string;
};

const t = initTRPC.context<Context>().create();

/** tRPC Router Builder */
export const router = t.router;

/** Öffentliche Procedure (kein Auth nötig) */
export const publicProcedure = t.procedure;

/** Admin-geschützte Procedure (Token via Authorization oder x-admin-token). */
export const adminProcedure = t.procedure.use(async ({ ctx, next }) => {
  const token = extractAdminToken(ctx.req);
  if (!token) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Admin-Authentifizierung erforderlich.' });
  }

  const valid = await isAdminSessionTokenValid(token);
  if (!valid) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Admin-Session ungültig oder abgelaufen.' });
  }

  return next({
    ctx: {
      ...ctx,
      adminToken: token,
    },
  });
});

/** Liest Client-IP aus Context (für Rate-Limiting). */
export function getClientIp(ctx: Context): string {
  const req = ctx.req;
  if (!req) return '0.0.0.0';
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim() ?? req.socket.remoteAddress ?? '0.0.0.0';
  return req.socket.remoteAddress ?? '0.0.0.0';
}

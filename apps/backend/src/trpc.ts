/**
 * tRPC-Initialisierung (Story 0.5: Context mit req für Rate-Limit-IP).
 */
import { initTRPC, TRPCError } from '@trpc/server';
import type { IncomingMessage } from 'node:http';
import { extractAdminToken, isAdminSessionTokenValid } from './lib/adminAuth';
import { extractHostTokenFromContext, isHostSessionTokenValid } from './lib/hostAuth';
import { isTrackedLiveProcedure, recordLiveRequestTelemetry } from './lib/sloTelemetry';

export type Context = {
  req?: IncomingMessage;
  connectionParams?: unknown;
  adminToken?: string;
  hostToken?: string;
  hostSessionCode?: string;
};

const t = initTRPC.context<Context>().create();
const telemetryProcedure = t.procedure.use(async ({ path, type, next }) => {
  if (type === 'subscription' || !isTrackedLiveProcedure(path)) {
    return next();
  }

  const startedAt = Date.now();
  try {
    const result = await next();
    void recordLiveRequestTelemetry({ durationMs: Date.now() - startedAt });
    return result;
  } catch (err) {
    const errorCode =
      err && typeof err === 'object' && 'code' in err
        ? String((err as { code?: unknown }).code)
        : undefined;
    void recordLiveRequestTelemetry({
      durationMs: Date.now() - startedAt,
      errorCode,
    });
    throw err;
  }
});

/** tRPC Router Builder */
export const router = t.router;

/** Öffentliche Procedure (kein Auth nötig) */
export const publicProcedure = telemetryProcedure;

/** Admin-geschützte Procedure (Token via Authorization oder x-admin-token). */
export const adminProcedure = telemetryProcedure.use(async ({ ctx, next }) => {
  const token = extractAdminToken(ctx.req);
  if (!token) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Admin-Authentifizierung erforderlich.' });
  }

  const valid = await isAdminSessionTokenValid(token);
  if (!valid) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Admin-Session ungültig oder abgelaufen.',
    });
  }

  return next({
    ctx: {
      ...ctx,
      adminToken: token,
    },
  });
});

function extractSessionCodeFromInput(input: unknown): string | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const candidate = input as Record<string, unknown>;
  for (const key of ['code', 'sessionCode']) {
    const raw = candidate[key];
    if (typeof raw === 'string' && raw.trim().length > 0) {
      return raw.trim().toUpperCase();
    }
  }

  return null;
}

/** Host-geschützte Procedure (Token via x-host-token). */
export const hostProcedure = telemetryProcedure.use(async ({ ctx, getRawInput, next }) => {
  const rawInput = await getRawInput();
  const sessionCode = extractSessionCodeFromInput(rawInput);
  if (!sessionCode) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Host-Authentifizierung ohne Session-Code konfiguriert.',
    });
  }

  const token = extractHostTokenFromContext(ctx);
  if (!token) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Host-Authentifizierung erforderlich.' });
  }

  const valid = await isHostSessionTokenValid(sessionCode, token);
  if (!valid) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Host-Session ungültig oder abgelaufen.',
    });
  }

  return next({
    ctx: {
      ...ctx,
      hostToken: token,
      hostSessionCode: sessionCode,
    },
  });
});

function firstForwardedClientIp(header: string | string[] | undefined): string | undefined {
  if (typeof header === 'string' && header.trim()) {
    return header.split(',')[0]?.trim();
  }
  if (Array.isArray(header) && header[0]) {
    return header[0].split(',')[0]?.trim();
  }
  return undefined;
}

/** Woher die IP für Rate-Limiting stammt (nur Server-Logs / Diagnose). */
export type ClientIpSource =
  | 'cf-connecting-ip'
  | 'true-client-ip'
  | 'x-forwarded-for'
  | 'x-real-ip'
  | 'express-req-ip'
  | 'socket'
  | 'missing-req';

export type ResolvedClientIp = { ip: string; source: ClientIpSource };

/**
 * Löst die Client-IP mit Quelle auf — für Logs bei 429, ohne Raten zu raten.
 */
export function resolveClientIp(req: IncomingMessage | undefined): ResolvedClientIp {
  if (!req) {
    return { ip: '0.0.0.0', source: 'missing-req' };
  }

  const cf = firstForwardedClientIp(req.headers['cf-connecting-ip']);
  if (cf) return { ip: cf, source: 'cf-connecting-ip' };

  const trueClient = firstForwardedClientIp(req.headers['true-client-ip']);
  if (trueClient) return { ip: trueClient, source: 'true-client-ip' };

  const xff = firstForwardedClientIp(req.headers['x-forwarded-for']);
  if (xff) return { ip: xff, source: 'x-forwarded-for' };

  const realIp = firstForwardedClientIp(req.headers['x-real-ip']);
  if (realIp) return { ip: realIp, source: 'x-real-ip' };

  const expressIp = (req as IncomingMessage & { ip?: string }).ip;
  if (typeof expressIp === 'string' && expressIp.trim()) {
    return { ip: expressIp.trim(), source: 'express-req-ip' };
  }

  const ra = req.socket?.remoteAddress;
  if (ra?.trim()) {
    return { ip: ra, source: 'socket' };
  }
  return { ip: '0.0.0.0', source: 'missing-req' };
}

/** Client-IP für Rate-Limiting (siehe `resolveClientIp` für Quelle). */
export function getClientIp(ctx: Context): string {
  return resolveClientIp(ctx.req).ip;
}

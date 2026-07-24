/**
 * tRPC-Initialisierung (Story 0.5: Context mit req für Rate-Limit-IP).
 */
import { initTRPC, TRPCError } from '@trpc/server';
import type { IncomingMessage } from 'node:http';
import { extractAdminToken, isAdminSessionTokenValid } from './lib/adminAuth';
import {
  consumeDiagnosticAuthFailure,
  extractAdminDiagnosticSecret,
  verifyAdminDiagnosticSecret,
} from './lib/diagnosticAuth';
import { extractHostTokenFromContext, isHostSessionTokenValid } from './lib/hostAuth';
import { TRPC_MAX_BODY_SIZE_LABEL } from './lib/requestLimits';
import { isTrackedLiveProcedure, recordLiveRequestTelemetry } from './lib/sloTelemetry';
import {
  logRateLimitRejection,
  recordRateLimitRejection,
  recordSessionCreateCompleted,
  type RateLimitCategory,
} from './lib/abuseTelemetry';

export type Context = {
  req?: IncomingMessage;
  connectionParams?: unknown;
  adminToken?: string;
  hostToken?: string;
  hostSessionCode?: string;
};

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    if (error.code !== 'PAYLOAD_TOO_LARGE') {
      return shape;
    }

    return {
      ...shape,
      message: `Die Anfrage ist zu groß. Maximal ${TRPC_MAX_BODY_SIZE_LABEL} sind erlaubt.`,
    };
  },
});
function classifyRateLimitPath(path: string): RateLimitCategory {
  if (path === 'session.create') return 'sessionCreate';
  if (path === 'quiz.upload') return 'quizUpload';
  if (path === 'quickFeedback.create') return 'quickFeedback';
  if (path === 'session.join') return 'sessionCode';
  if (path === 'vote.submit') return 'vote';
  if (path === 'session.getSessionExportPdf' || path === 'session.getLastSessionExportPdfForQuiz') {
    return 'pdf';
  }
  if (path.startsWith('motd.')) return 'motd';
  return 'other';
}

const telemetryProcedure = t.procedure.use(async ({ ctx, path, type, next }) => {
  const trackLiveRequest = type !== 'subscription' && isTrackedLiveProcedure(path);
  const startedAt = Date.now();
  const result = await next();
  const errorCode = result.ok ? undefined : result.error.code;

  if (result.ok && path === 'session.create') {
    void recordSessionCreateCompleted();
  }
  if (!result.ok) {
    if (errorCode === 'TOO_MANY_REQUESTS') {
      const category = classifyRateLimitPath(path);
      const resolved = resolveClientIp(ctx.req);
      logRateLimitRejection({
        path,
        category,
        ipSource: resolved.source,
      });
      void recordRateLimitRejection(category);
    }
  }
  if (trackLiveRequest) {
    void recordLiveRequestTelemetry({
      durationMs: Date.now() - startedAt,
      errorCode,
    });
  }
  return result;
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

/**
 * Read-only Betriebsdiagnose mit separatem ADMIN_DIAGNOSTIC_SECRET.
 * Bewusst unabhängig von Redis, damit health.securityStats im Redis-Incident erreichbar bleibt.
 */
export const diagnosticProcedure = telemetryProcedure.use(async ({ ctx, next }) => {
  const secret = extractAdminDiagnosticSecret(ctx.req);
  if (secret && verifyAdminDiagnosticSecret(secret)) {
    return next();
  }
  if (!consumeDiagnosticAuthFailure()) {
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: 'Zu viele fehlgeschlagene Diagnose-Authentifizierungen.',
    });
  }
  throw new TRPCError({
    code: 'UNAUTHORIZED',
    message: 'Diagnose-Authentifizierung erforderlich.',
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

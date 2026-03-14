import { TRPCError } from '@trpc/server';
import {
  AdminDeleteSessionInputSchema,
  AdminDeleteSessionOutputSchema,
  AdminExportInputSchema,
  AdminExportOutputSchema,
  AdminGetSessionDetailInputSchema,
  AdminListSessionsInputSchema,
  AdminLoginInputSchema,
  AdminLoginOutputSchema,
  AdminRetentionStateDTO,
  AdminRetentionStateDTOSchema,
  AdminSessionDetailDTOSchema,
  AdminSessionListDTOSchema,
  AdminSessionLookupInputSchema,
  AdminSessionSummaryDTO,
  AdminSetLegalHoldInputSchema,
  AdminWhoAmIOutputSchema,
} from '@arsnova/shared-types';
import { adminProcedure, publicProcedure, router } from '../trpc';
import { createHash, randomUUID } from 'crypto';
import PDFDocument from 'pdfkit';
import katex from 'katex';
import { marked } from 'marked';
import {
  createAdminSessionToken,
  invalidateAdminSessionToken,
  verifyAdminSecret,
} from '../lib/adminAuth';
import { prisma } from '../db';

const DEFAULT_LEGAL_HOLD_DAYS = 30;
const MIN_LEGAL_HOLD_DAYS = 1;
const MAX_LEGAL_HOLD_DAYS = 365;
const SESSION_RETENTION_HOURS = 24;
const ADMIN_EXPORT_SCHEMA_VERSION = 1;

function resolveDefaultLegalHoldDays(): number {
  const raw = process.env['ADMIN_LEGAL_HOLD_DEFAULT_DAYS'];
  if (!raw) return DEFAULT_LEGAL_HOLD_DAYS;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_LEGAL_HOLD_DAYS;
  return Math.max(MIN_LEGAL_HOLD_DAYS, Math.min(MAX_LEGAL_HOLD_DAYS, parsed));
}

function resolveRetentionState(session: {
  status: 'LOBBY' | 'QUESTION_OPEN' | 'ACTIVE' | 'PAUSED' | 'RESULTS' | 'DISCUSSION' | 'FINISHED';
  endedAt: Date | null;
  legalHoldUntil: Date | null;
  legalHoldReason: string | null;
}): AdminRetentionStateDTO {
  const now = Date.now();
  if (session.status !== 'FINISHED') {
    return {
      window: 'RUNNING',
      legalHoldUntil: session.legalHoldUntil?.toISOString() ?? null,
      legalHoldReason: session.legalHoldReason ?? null,
    };
  }

  if (session.legalHoldUntil && session.legalHoldUntil.getTime() > now) {
    return {
      window: 'POST_SESSION_24H',
      legalHoldUntil: session.legalHoldUntil.toISOString(),
      legalHoldReason: session.legalHoldReason ?? null,
    };
  }

  const retentionCutoff = now - SESSION_RETENTION_HOURS * 60 * 60 * 1000;
  const isWithinRetention = !session.endedAt || session.endedAt.getTime() >= retentionCutoff;
  return {
    window: isWithinRetention ? 'POST_SESSION_24H' : 'PURGED',
    legalHoldUntil: null,
    legalHoldReason: session.legalHoldReason ?? null,
  };
}

function toSessionSummary(session: {
  id: string;
  code: string;
  type: 'QUIZ' | 'Q_AND_A';
  status: 'LOBBY' | 'QUESTION_OPEN' | 'ACTIVE' | 'PAUSED' | 'RESULTS' | 'DISCUSSION' | 'FINISHED';
  quiz: { name: string } | null;
  _count: { participants: number };
  startedAt: Date;
  endedAt: Date | null;
  legalHoldUntil: Date | null;
  legalHoldReason: string | null;
}): AdminSessionSummaryDTO {
  return {
    sessionId: session.id,
    sessionCode: session.code,
    type: session.type,
    status: session.status,
    quizName: session.quiz?.name ?? null,
    participantCount: session._count.participants,
    startedAt: session.startedAt.toISOString(),
    endedAt: session.endedAt?.toISOString() ?? null,
    retention: resolveRetentionState(session),
  };
}

type AuthorityQuestionAggregate = {
  order: number;
  type: string;
  totalResponses: number;
  optionDistribution?: Array<{ text: string; textRaw: string; count: number; isCorrect: boolean }>;
  ratingDistribution?: Record<string, number>;
  freeTextResponseCount?: number;
};

type AuthorityExportPayload = {
  schemaVersion: number;
  exportId: string;
  generatedAt: string;
  caseReference: string | null;
  session: {
    id: string;
    code: string;
    type: string;
    status: string;
    title: string | null;
    startedAt: string;
    endedAt: string | null;
    participantCount: number;
  };
  quiz: {
    name: string | null;
    questions: Array<{
      order: number;
      text: string;
      textRaw: string;
      type: string;
      answers: Array<{ text: string; textRaw: string; isCorrect: boolean }>;
    }>;
  };
  aggregates: AuthorityQuestionAggregate[];
  legalHold: {
    until: string | null;
    reason: string | null;
  };
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function mathPlaceholder(index: number): string {
  return `KATEXAUTHPLACEHOLDER${index}`;
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|h[1-6]|tr|div|section|article)>/gi, '\n')
    .replace(/<\/(td|th)>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#([0-9]+);/g, (_match, dec: string) =>
      String.fromCodePoint(Number.parseInt(dec, 10)),
    )
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([)\],.;:!?])/g, '$1')
    .replace(/([([])\s+/g, '$1')
    .trim();
}

function renderMarkdownKatexToPlainText(input: string | null | undefined): string {
  const source = input?.trim() ?? '';
  if (!source) return '';

  const renderedMath: string[] = [];
  const storeRenderedMath = (html: string): string => {
    const index = renderedMath.push(html) - 1;
    return mathPlaceholder(index);
  };

  const normalizeKatexExpression = (expression: string): string => {
    return expression
      .trim()
      .replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, '$1 durch $2')
      .replace(/\\sqrt\s*\{([^{}]+)\}/g, 'Wurzel aus $1')
      .replace(/\\cdot/g, '*')
      .replace(/\\times/g, 'x')
      .replace(/\\geq/g, '>=')
      .replace(/\\leq/g, '<=')
      .replace(/\\neq/g, '!=')
      .replace(/\\pm/g, '+/-')
      .replace(/\\approx/g, 'ungefähr')
      .replace(/\\infty/g, 'unendlich')
      .replace(/\^\{([^{}]+)\}/g, ' hoch $1')
      .replace(/\^([A-Za-z0-9]+)/g, ' hoch $1')
      .replace(/_\{([^{}]+)\}/g, ' Index $1')
      .replace(/_([A-Za-z0-9]+)/g, ' Index $1')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const renderExpression = (expression: string, displayMode: boolean): string => {
    try {
      // Validierung via KaTeX; für Behördenexport danach in lesbare Textform normalisieren.
      katex.renderToString(expression.trim(), {
        displayMode,
        throwOnError: true,
        strict: 'ignore',
        output: 'html',
      });
      return storeRenderedMath(escapeHtml(normalizeKatexExpression(expression)));
    } catch {
      // Fallback: Ausdruck ohne Delimiter erhalten, statt roh mit $...$ zu exportieren.
      return storeRenderedMath(escapeHtml(normalizeKatexExpression(expression)));
    }
  };

  const withBlockMath = source.replace(/\$\$([\s\S]+?)\$\$/g, (_, expression: string) =>
    renderExpression(expression, true),
  );
  const withInlineMath = withBlockMath.replace(
    /\$([^$\n]+?)\$/g,
    (_, expression: string) => renderExpression(expression, false),
  );

  const renderer = new marked.Renderer();
  renderer.html = ({ text }) => escapeHtml(text);
  const html = marked.parse(withInlineMath, { renderer, async: false }) as string;
  const htmlWithRenderedMath = renderedMath.reduce(
    (current, value, index) => current.replaceAll(mathPlaceholder(index), value),
    html,
  );

  return htmlToPlainText(htmlWithRenderedMath);
}

function toBufferFromPdf(doc: InstanceType<typeof PDFDocument>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (error: Error) => reject(error));
    doc.end();
  });
}

function hashSha256(input: Buffer | string): string {
  return createHash('sha256').update(input).digest('hex');
}

function buildAuthorityPdf(payload: AuthorityExportPayload, payloadHash: string): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 48, size: 'A4' });
  doc.info.Title = `Behördenauszug ${payload.session.code}`;
  doc.info.Author = 'arsnova.eu';
  doc.fontSize(18).text('Behoerdenauszug (Admin)', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(10)
    .text(`Export-ID: ${payload.exportId}`)
    .text(`Erzeugt am: ${payload.generatedAt}`)
    .text(`Schema-Version: ${payload.schemaVersion}`)
    .text(`Referenz-Hash (JSON): ${payloadHash}`);
  doc.moveDown(0.8);
  doc.fontSize(13).text('Session');
  doc.fontSize(10)
    .text(`Code: ${payload.session.code}`)
    .text(`ID: ${payload.session.id}`)
    .text(`Typ: ${payload.session.type}`)
    .text(`Status: ${payload.session.status}`)
    .text(`Titel: ${payload.session.title || '-'}`)
    .text(`Gestartet: ${payload.session.startedAt}`)
    .text(`Beendet: ${payload.session.endedAt ?? '-'}`)
    .text(`Teilnehmende (gesamt): ${payload.session.participantCount}`);
  doc.moveDown(0.8);
  doc.fontSize(13).text('Quiz-Inhalt');
  doc.fontSize(10).text(`Quizname: ${payload.quiz.name ?? '-'}`);
  for (const question of payload.quiz.questions) {
    doc.moveDown(0.4);
    doc.fontSize(11).text(`Frage ${question.order + 1} (${question.type})`);
    doc.fontSize(10).text(question.text);
    if (question.answers.length > 0) {
      for (const answer of question.answers) {
        doc.fontSize(10).text(`- ${answer.text} ${answer.isCorrect ? '(korrekt)' : ''}`);
      }
    }
  }
  doc.moveDown(0.8);
  doc.fontSize(13).text('Aggregierte Ergebnisse');
  for (const aggregate of payload.aggregates) {
    doc.moveDown(0.4);
    doc.fontSize(11).text(`Frage ${aggregate.order + 1} (${aggregate.type})`);
    doc.fontSize(10).text(`Antworten gesamt: ${aggregate.totalResponses}`);
    if (aggregate.optionDistribution) {
      for (const option of aggregate.optionDistribution) {
        doc.text(`- ${option.text}: ${option.count} ${option.isCorrect ? '(korrekt)' : ''}`);
      }
    }
    if (aggregate.ratingDistribution) {
      const entries = Object.entries(aggregate.ratingDistribution)
        .sort((a, b) => Number(a[0]) - Number(b[0]));
      for (const [rating, count] of entries) {
        doc.text(`- Rating ${rating}: ${count}`);
      }
    }
    if (typeof aggregate.freeTextResponseCount === 'number') {
      doc.text(`- Freitext-Antworten: ${aggregate.freeTextResponseCount}`);
    }
  }
  doc.moveDown(0.8);
  doc.fontSize(9).text(
    'Datensparsamkeit: Dieser Auszug enthaelt keine Nicknames, IP-Adressen oder andere personenbezogene Daten.',
  );
  return toBufferFromPdf(doc);
}

function buildAuthorityAggregates(questions: Array<{
  id: string;
  order: number;
  type: string;
  answers: Array<{ id: string; text: string; isCorrect: boolean }>;
}>, votes: Array<{
  questionId: string;
  ratingValue: number | null;
  freeText: string | null;
  selectedAnswers: Array<{ answerOptionId: string }>;
}>): AuthorityQuestionAggregate[] {
  return questions.map((question) => {
    const votesForQuestion = votes.filter((vote) => vote.questionId === question.id);
    const base: AuthorityQuestionAggregate = {
      order: question.order,
      type: question.type,
      totalResponses: votesForQuestion.length,
    };

    if (question.type === 'SINGLE_CHOICE' || question.type === 'MULTIPLE_CHOICE' || question.type === 'SURVEY') {
      const counts = new Map<string, number>();
      for (const answer of question.answers) {
        counts.set(answer.id, 0);
      }
      for (const vote of votesForQuestion) {
        for (const selected of vote.selectedAnswers) {
          counts.set(selected.answerOptionId, (counts.get(selected.answerOptionId) ?? 0) + 1);
        }
      }
      base.optionDistribution = question.answers.map((answer) => ({
        text: renderMarkdownKatexToPlainText(answer.text),
        textRaw: answer.text,
        count: counts.get(answer.id) ?? 0,
        isCorrect: answer.isCorrect,
      }));
    }

    if (question.type === 'RATING') {
      const dist: Record<string, number> = {};
      for (const vote of votesForQuestion) {
        if (typeof vote.ratingValue === 'number') {
          const key = String(vote.ratingValue);
          dist[key] = (dist[key] ?? 0) + 1;
        }
      }
      base.ratingDistribution = dist;
    }

    if (question.type === 'FREETEXT') {
      base.freeTextResponseCount = votesForQuestion.filter((vote) => (vote.freeText?.trim() ?? '').length > 0).length;
    }

    return base;
  });
}

export const adminRouter = router({
  /** Admin-Login (MVP: Shared Secret). */
  login: publicProcedure
    .input(AdminLoginInputSchema)
    .output(AdminLoginOutputSchema)
    .mutation(async ({ input }) => {
      if (!verifyAdminSecret(input.secret)) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Ungültige Admin-Zugangsdaten.',
        });
      }

      const session = await createAdminSessionToken();
      return {
        token: session.token,
        expiresAt: session.expiresAt.toISOString(),
      };
    }),

  /** Prüft, ob Admin-Session noch gültig ist. */
  whoami: adminProcedure
    .output(AdminWhoAmIOutputSchema)
    .query(() => ({ authenticated: true as const })),

  /** Admin-Logout (Token invalidieren). */
  logout: adminProcedure
    .output(AdminWhoAmIOutputSchema)
    .mutation(async ({ ctx }) => {
      if (ctx.adminToken) {
        await invalidateAdminSessionToken(ctx.adminToken);
      }
      return { authenticated: true as const };
    }),

  /** Session-Liste für Admin (nur Recherchefenster A/B). */
  listSessions: adminProcedure
    .input(AdminListSessionsInputSchema)
    .output(AdminSessionListDTOSchema)
    .query(async ({ input }) => {
      const now = new Date();
      const retentionCutoff = new Date(now.getTime() - SESSION_RETENTION_HOURS * 60 * 60 * 1000);
      const page = input.page;
      const pageSize = input.pageSize;
      const skip = (page - 1) * pageSize;

      const where = {
        ...(input.status ? { status: input.status } : {}),
        ...(input.type ? { type: input.type } : {}),
        ...(input.code ? { code: input.code.toUpperCase() } : {}),
        OR: [
          { status: { not: 'FINISHED' as const } },
          {
            status: 'FINISHED' as const,
            OR: [
              { endedAt: null },
              { endedAt: { gte: retentionCutoff } },
              { legalHoldUntil: { gt: now } },
            ],
          },
        ],
      };

      const [total, sessions] = await Promise.all([
        prisma.session.count({ where }),
        prisma.session.findMany({
          where,
          orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
          skip,
          take: pageSize,
          include: {
            quiz: { select: { name: true } },
            _count: { select: { participants: true } },
          },
        }),
      ]);

      return {
        sessions: sessions.map((session) => toSessionSummary(session)),
        total,
        page,
        pageSize,
      };
    }),

  /** Session-Lookup per 6-stelligem Code (nur Recherchefenster A/B). */
  getSessionByCode: adminProcedure
    .input(AdminSessionLookupInputSchema)
    .output(AdminSessionDetailDTOSchema)
    .query(async ({ input }) => {
      const code = input.code.toUpperCase();
      const session = await prisma.session.findUnique({
        where: { code },
        include: {
          quiz: {
            select: {
              name: true,
              questions: {
                orderBy: { order: 'asc' },
                select: {
                  id: true,
                  order: true,
                  text: true,
                  type: true,
                  answers: {
                    orderBy: { id: 'asc' },
                    select: { id: true, text: true, isCorrect: true },
                  },
                },
              },
            },
          },
          _count: { select: { participants: true } },
        },
      });
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }

      const retention = resolveRetentionState(session);
      if (retention.window === 'PURGED') {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Sessiondaten wurden gemäß Aufbewahrungsregel bereinigt.',
        });
      }

      return {
        session: toSessionSummary(session),
        title: session.title ?? null,
        questions: session.quiz?.questions.map((question) => ({
          id: question.id,
          order: question.order,
          text: question.text,
          type: question.type,
          answers: question.answers,
        })),
      };
    }),

  /** Session-Detail per Session-ID (nur Recherchefenster A/B). */
  getSessionDetail: adminProcedure
    .input(AdminGetSessionDetailInputSchema)
    .output(AdminSessionDetailDTOSchema)
    .query(async ({ input }) => {
      const session = await prisma.session.findUnique({
        where: { id: input.sessionId },
        include: {
          quiz: {
            select: {
              name: true,
              questions: {
                orderBy: { order: 'asc' },
                select: {
                  id: true,
                  order: true,
                  text: true,
                  type: true,
                  answers: {
                    orderBy: { id: 'asc' },
                    select: { id: true, text: true, isCorrect: true },
                  },
                },
              },
            },
          },
          _count: { select: { participants: true } },
        },
      });
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }

      const retention = resolveRetentionState(session);
      if (retention.window === 'PURGED') {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Sessiondaten wurden gemäß Aufbewahrungsregel bereinigt.',
        });
      }

      return {
        session: toSessionSummary(session),
        title: session.title ?? null,
        questions: session.quiz?.questions.map((question) => ({
          id: question.id,
          order: question.order,
          text: question.text,
          type: question.type,
          answers: question.answers,
        })),
      };
    }),

  /** Legal Hold setzen/lösen (Default 30 Tage). */
  setLegalHold: adminProcedure
    .input(AdminSetLegalHoldInputSchema)
    .output(AdminRetentionStateDTOSchema)
    .mutation(async ({ input }) => {
      const session = await prisma.session.findUnique({
        where: { id: input.sessionId },
        select: { id: true, status: true, legalHoldUntil: true },
      });
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }

      if (input.enabled) {
        const holdDays = input.holdDays ?? resolveDefaultLegalHoldDays();
        const legalHoldUntil = new Date(Date.now() + holdDays * 24 * 60 * 60 * 1000);
        const reason = input.reason?.trim() || null;

        await prisma.session.update({
          where: { id: session.id },
          data: {
            legalHoldUntil,
            legalHoldReason: reason,
            legalHoldSetAt: new Date(),
          },
        });

        return {
          window: session.status === 'FINISHED' ? 'POST_SESSION_24H' : 'RUNNING',
          legalHoldUntil: legalHoldUntil.toISOString(),
          legalHoldReason: reason,
        };
      }

      await prisma.session.update({
        where: { id: session.id },
        data: {
          legalHoldUntil: null,
          legalHoldReason: null,
          legalHoldSetAt: null,
        },
      });

      return {
        window: session.status === 'FINISHED' ? 'POST_SESSION_24H' : 'RUNNING',
        legalHoldUntil: null,
        legalHoldReason: null,
      };
    }),

  /** Session endgültig löschen (Story 9.2) inkl. Audit-Log. */
  deleteSession: adminProcedure
    .input(AdminDeleteSessionInputSchema)
    .output(AdminDeleteSessionOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await prisma.session.findUnique({
        where: { id: input.sessionId },
        select: {
          id: true,
          code: true,
          status: true,
          endedAt: true,
          legalHoldUntil: true,
          legalHoldReason: true,
          quizId: true,
        },
      });
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }

      const retention = resolveRetentionState(existing);
      if (retention.window === 'PURGED') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Sessiondaten wurden bereits bereinigt.',
        });
      }

      const reason = input.reason?.trim() || null;
      const adminIdentifier = ctx.adminToken ? `token:${ctx.adminToken.slice(0, 12)}` : 'admin';

      await prisma.$transaction(async (tx) => {
        await tx.session.delete({
          where: { id: existing.id },
        });

        if (existing.quizId) {
          const stillReferenced = await tx.session.count({
            where: { quizId: existing.quizId },
          });
          if (stillReferenced === 0) {
            await tx.quiz.delete({
              where: { id: existing.quizId },
            }).catch(() => {
              // Best effort: Falls Quiz parallel entfernt wurde, ist die Session trotzdem gelöscht.
            });
          }
        }

        await tx.adminAuditLog.create({
          data: {
            action: 'SESSION_DELETE',
            sessionId: existing.id,
            sessionCode: existing.code,
            adminIdentifier,
            reason,
          },
        });
      });

      return {
        deleted: true as const,
        sessionId: existing.id,
        sessionCode: existing.code,
      };
    }),

  /** Behördenexport (Story 9.3): PDF primär, JSON optional. */
  exportForAuthorities: adminProcedure
    .input(AdminExportInputSchema)
    .output(AdminExportOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const session = await prisma.session.findUnique({
        where: { id: input.sessionId },
        include: {
          quiz: {
            select: {
              name: true,
              questions: {
                orderBy: { order: 'asc' },
                select: {
                  id: true,
                  order: true,
                  text: true,
                  type: true,
                  answers: {
                    orderBy: { id: 'asc' },
                    select: { id: true, text: true, isCorrect: true },
                  },
                },
              },
            },
          },
          votes: {
            select: {
              questionId: true,
              ratingValue: true,
              freeText: true,
              selectedAnswers: { select: { answerOptionId: true } },
            },
          },
          _count: { select: { participants: true } },
        },
      });
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }

      const retention = resolveRetentionState(session);
      if (retention.window === 'PURGED') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Export nicht mehr möglich: Sessiondaten wurden bereinigt.',
        });
      }

      const exportId = randomUUID();
      const generatedAt = new Date().toISOString();
      const payload: AuthorityExportPayload = {
        schemaVersion: ADMIN_EXPORT_SCHEMA_VERSION,
        exportId,
        generatedAt,
        caseReference: input.caseReference?.trim() || null,
        session: {
          id: session.id,
          code: session.code,
          type: session.type,
          status: session.status,
          title: renderMarkdownKatexToPlainText(session.title) || null,
          startedAt: session.startedAt.toISOString(),
          endedAt: session.endedAt?.toISOString() ?? null,
          participantCount: session._count.participants,
        },
        quiz: {
          name: renderMarkdownKatexToPlainText(session.quiz?.name) || null,
          questions: (session.quiz?.questions ?? []).map((question) => ({
            order: question.order,
            text: renderMarkdownKatexToPlainText(question.text),
            textRaw: question.text,
            type: question.type,
            answers: question.answers.map((answer) => ({
              text: renderMarkdownKatexToPlainText(answer.text),
              textRaw: answer.text,
              isCorrect: answer.isCorrect,
            })),
          })),
        },
        aggregates: buildAuthorityAggregates(session.quiz?.questions ?? [], session.votes),
        legalHold: {
          until: session.legalHoldUntil?.toISOString() ?? null,
          reason: session.legalHoldReason ?? null,
        },
      };

      const payloadJson = JSON.stringify(payload, null, 2);
      const payloadHash = hashSha256(payloadJson);
      const reason = input.reason?.trim() || null;
      const adminIdentifier = ctx.adminToken ? `token:${ctx.adminToken.slice(0, 12)}` : 'admin';

      let fileName = `authority-export-${session.code}-${generatedAt.slice(0, 10)}`;
      let mimeType = 'application/pdf';
      let fileBuffer: Buffer;

      if (input.format === 'JSON') {
        fileName = `${fileName}.json`;
        mimeType = 'application/json';
        fileBuffer = Buffer.from(payloadJson, 'utf8');
      } else {
        fileName = `${fileName}.pdf`;
        mimeType = 'application/pdf';
        fileBuffer = await buildAuthorityPdf(payload, payloadHash);
      }

      await prisma.adminAuditLog.create({
        data: {
          action: 'EXPORT_FOR_AUTHORITIES',
          sessionId: session.id,
          sessionCode: session.code,
          adminIdentifier,
          reason,
        },
      });

      return {
        exportId,
        format: input.format,
        mimeType,
        fileName,
        contentBase64: fileBuffer.toString('base64'),
        sha256: hashSha256(fileBuffer),
        generatedAt,
      };
    }),
});

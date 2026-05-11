/**
 * Tempo-Router – kontinuierlicher Livekanal für Vortragsrhythmus (ADR-0022, Story 8.8).
 * Live-Zustand Redis-only; Session-Konfiguration (tempoEnabled/tempoOpen) in PostgreSQL.
 */
import { TRPCError } from '@trpc/server';
import {
  TempoSnapshotSchema,
  TempoVoteInputSchema,
  TempoRemoveVoteInputSchema,
  TempoSetOpenInputSchema,
  type TempoState,
  type TempoTendency,
  type TempoSnapshot,
} from '@arsnova/shared-types';
import { publicProcedure, router, hostProcedure } from '../trpc';
import { getRedis } from '../redis';
import { prisma } from '../db';

const TEMPO_TTL_SECONDS = 24 * 60 * 60; // 24 h – läuft mit der Session

function statesKey(code: string): string {
  return `tempo:states:${code}`;
}

const TEMPO_STATES: TempoState[] = ['speed_up', 'following', 'slow_down', 'lost'];

function computeTendency(dist: TempoSnapshot['distribution'], total: number): TempoTendency {
  if (total === 0) return 'no_data';

  const pFollowing = dist.following / total;
  const pSlowDown = dist.slow_down / total;
  const pLost = dist.lost / total;
  const pSpeedUp = dist.speed_up / total;

  if (pLost >= 0.2) return 'lost';
  if (pSlowDown + pLost >= 0.4) return 'too_fast';
  if (pSpeedUp >= 0.4) return 'underchallenged';
  if (pFollowing >= 0.5) return 'following';
  return 'heterogeneous';
}

async function buildSnapshot(code: string): Promise<TempoSnapshot> {
  const redis = getRedis();
  const raw = await redis.hgetall(statesKey(code));

  const distribution: TempoSnapshot['distribution'] = {
    speed_up: 0,
    following: 0,
    slow_down: 0,
    lost: 0,
  };

  for (const state of Object.values(raw)) {
    if (TEMPO_STATES.includes(state as TempoState)) {
      distribution[state as TempoState]++;
    }
  }

  const totalVotes = Object.values(distribution).reduce((s, n) => s + n, 0);
  return { totalVotes, distribution, tendency: computeTendency(distribution, totalVotes) };
}

async function assertTempoOpen(code: string): Promise<void> {
  const session = await prisma.session.findUnique({
    where: { code },
    select: { tempoEnabled: true, tempoOpen: true, status: true },
  });
  if (!session) throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
  if (!session.tempoEnabled || !session.tempoOpen) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Der Tempo-Kanal ist nicht geöffnet.' });
  }
  if (session.status === 'FINISHED') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Die Session ist beendet.' });
  }
}

export const tempoRouter = router({
  /** Host: Tempo-Kanal öffnen oder schließen (tempoEnabled muss bereits true sein). */
  setOpen: hostProcedure.input(TempoSetOpenInputSchema).mutation(async ({ input }) => {
    const code = input.sessionCode.toUpperCase();
    const session = await prisma.session.findUnique({
      where: { code },
      select: { id: true, tempoEnabled: true },
    });
    if (!session) throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
    if (!session.tempoEnabled) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Tempo-Kanal ist für diese Session nicht aktiviert.',
      });
    }
    await prisma.session.update({
      where: { code },
      data: { tempoOpen: input.open },
    });
    return { open: input.open };
  }),

  /** Teilnehmende setzen ihren aktuellen Tempo-Zustand (ersetzt vorherigen). */
  vote: publicProcedure.input(TempoVoteInputSchema).mutation(async ({ input }) => {
    const code = input.sessionCode.toUpperCase();
    await assertTempoOpen(code);

    const redis = getRedis();
    await redis.hset(statesKey(code), input.participantId, input.state);
    await redis.expire(statesKey(code), TEMPO_TTL_SECONDS);
    return { ok: true };
  }),

  /** Teilnehmende entfernen ihren Tempo-Zustand (optionaler zweiter Tap). */
  removeVote: publicProcedure.input(TempoRemoveVoteInputSchema).mutation(async ({ input }) => {
    const code = input.sessionCode.toUpperCase();
    await assertTempoOpen(code);

    const redis = getRedis();
    await redis.hdel(statesKey(code), input.participantId);
    return { ok: true };
  }),

  /** Aggregierter Snapshot (Teilnehmer-Polling – nur wenn Kanal offen). */
  getSnapshot: publicProcedure
    .input(TempoRemoveVoteInputSchema.pick({ sessionCode: true }))
    .output(TempoSnapshotSchema)
    .query(async ({ input }) => {
      const code = input.sessionCode.toUpperCase();
      await assertTempoOpen(code);
      return buildSnapshot(code);
    }),

  /** Aggregierter Snapshot für Host (kein open-Check – Host darf auch bei geschlossenem Kanal sehen). */
  getHostSnapshot: hostProcedure
    .input(TempoRemoveVoteInputSchema.pick({ sessionCode: true }))
    .output(TempoSnapshotSchema)
    .query(async ({ input }) => {
      return buildSnapshot(input.sessionCode.toUpperCase());
    }),

  /** Subscription: Host erhält Live-Updates des Snapshots. */
  onHostSnapshot: hostProcedure
    .input(TempoRemoveVoteInputSchema.pick({ sessionCode: true }))
    .subscription(async function* ({ input }) {
      const code = input.sessionCode.toUpperCase();
      let lastJson = '';
      while (true) {
        const snapshot = await buildSnapshot(code);
        const json = JSON.stringify(snapshot);
        if (json !== lastJson) {
          lastJson = json;
          yield snapshot;
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
    }),
});

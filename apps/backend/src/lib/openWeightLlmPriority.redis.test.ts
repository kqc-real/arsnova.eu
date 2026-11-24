import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { closeRedis, getRedis } from '../redis';
import { resetOpenWeightLlmClientForTests, runOpenWeightLlm } from './openWeightLlmClient';
import type {
  OpenWeightLlmLearningObjectivesRequest,
  OpenWeightLlmTopicLabelRequest,
} from '@arsnova/shared-types';
import {
  admitOpenWeightLlmPriorityTicket,
  beginOpenWeightLlmPriorityTicket,
  finishOpenWeightLlmPriorityTicket,
  OPEN_WEIGHT_LLM_LEASE_KEY,
  type OpenWeightLlmPriorityTicket,
} from './openWeightLlmPriority';

const topic: OpenWeightLlmTopicLabelRequest = {
  schemaVersion: 1,
  taskType: 'topic_label',
  locale: 'de',
  clusterId: 'test',
  sources: [{ id: 's1', text: 'Wie berechne ich die Steigung?' }],
};
const learningRequest: OpenWeightLlmLearningObjectivesRequest = {
  schemaVersion: 1,
  taskType: 'learning_objectives',
  locale: 'de',
  requestId: '11111111-1111-4111-8111-111111111111',
  questions: [
    {
      id: '22222222-2222-4222-8222-222222222222',
      text: 'Welche Gerade beschreibt y = 2x + 1?',
      answerOptions: [
        { text: 'Steigung 2, Achsenabschnitt 1', isCorrect: true },
        { text: 'Steigung 1, Achsenabschnitt 2', isCorrect: false },
      ],
    },
  ],
};
function enablePriorityClient() {
  vi.stubEnv('OPEN_WEIGHT_LLM_ENABLED', 'true');
  vi.stubEnv('OPEN_WEIGHT_LLM_SHARED_SLOT_ENABLED', 'true');
  vi.stubEnv('OPEN_WEIGHT_LLM_PRIORITY_HANDOFF_ENABLED', 'true');
  vi.stubEnv('OPEN_WEIGHT_LLM_URL', 'http://127.0.0.1:18176');
  vi.stubEnv('OPEN_WEIGHT_LLM_SOCKET_PATH', '');
  vi.stubEnv('OPEN_WEIGHT_LLM_TOKEN', 'synthetic-redis-priority-token-00000000');
}

describe.skipIf(process.env['RUN_REDIS_LLM_PRIORITY_TESTS'] !== '1')(
  'Prioritätsübergabe mit echtem Redis',
  () => {
    const reservations: OpenWeightLlmPriorityTicket[] = [];

    function ticket(
      taskType: OpenWeightLlmPriorityTicket['taskType'],
    ): OpenWeightLlmPriorityTicket {
      const reservation = { id: randomUUID(), taskType };
      reservations.push(reservation);
      return reservation;
    }

    afterEach(async () => {
      vi.restoreAllMocks();
      vi.unstubAllEnvs();
      resetOpenWeightLlmClientForTests();
      await getRedis().del(
        OPEN_WEIGHT_LLM_LEASE_KEY,
        'llm:inference:priority:v1',
        ...reservations.splice(0).map(({ id }) => `llm:inference:priority:v1:preempted:${id}`),
      );
    });

    afterAll(closeRedis);

    it('sichert die Übergabe gegen eine verspätete Freigabe des alten Besitzers', async () => {
      const learning = ticket('learning_objectives');
      const topics = ticket('topic_label');
      const summary = ticket('qa_summary');

      await expect(admitOpenWeightLlmPriorityTicket(learning, 2_500)).resolves.toEqual({
        status: 'admitted',
      });
      await expect(beginOpenWeightLlmPriorityTicket(learning, 30_000)).resolves.toBe('owned');
      await expect(admitOpenWeightLlmPriorityTicket(topics, 2_500)).resolves.toEqual({
        status: 'interrupt',
        owner: learning.id,
      });
      await expect(admitOpenWeightLlmPriorityTicket(summary, 2_500)).resolves.toEqual({
        status: 'waiting',
      });
      await expect(admitOpenWeightLlmPriorityTicket(topics, 2_500, randomUUID())).resolves.toEqual({
        status: 'interrupt',
        owner: learning.id,
      });
      await expect(admitOpenWeightLlmPriorityTicket(topics, 2_500, learning.id)).resolves.toEqual({
        status: 'admitted',
      });
      await expect(finishOpenWeightLlmPriorityTicket(learning)).resolves.toBe('preempted');
      await expect(getRedis().get(OPEN_WEIGHT_LLM_LEASE_KEY)).resolves.toBe(topics.id);
      await expect(beginOpenWeightLlmPriorityTicket(learning, 30_000)).resolves.toBe('lost');
      await expect(beginOpenWeightLlmPriorityTicket(topics, 30_000)).resolves.toBe('owned');
    });

    it('lässt eine geplante Unterbrechung vor dem Modell-POST am Besitzer scheitern', async () => {
      const learning = ticket('learning_objectives');
      const summary = ticket('qa_summary');

      await admitOpenWeightLlmPriorityTicket(learning, 2_500);
      await expect(admitOpenWeightLlmPriorityTicket(summary, 2_500)).resolves.toEqual({
        status: 'waiting',
      });
      await expect(admitOpenWeightLlmPriorityTicket(summary, 2_500, learning.id)).resolves.toEqual({
        status: 'waiting',
      });
      await expect(beginOpenWeightLlmPriorityTicket(learning, 30_000)).resolves.toBe('preempted');
      await expect(finishOpenWeightLlmPriorityTicket(learning)).resolves.toBe('preempted');
      await expect(admitOpenWeightLlmPriorityTicket(summary, 2_500)).resolves.toEqual({
        status: 'admitted',
      });
    });

    it('bevorzugt höhere Prioritäten und hält die Reihenfolge innerhalb einer Priorität ein', async () => {
      const active = ticket('topic_label');
      const learning = ticket('learning_objectives');
      const firstSummary = ticket('qa_summary');
      const secondSummary = ticket('qa_summary');

      await admitOpenWeightLlmPriorityTicket(active, 2_500);
      await beginOpenWeightLlmPriorityTicket(active, 30_000);
      for (const reservation of [learning, firstSummary, secondSummary]) {
        await expect(admitOpenWeightLlmPriorityTicket(reservation, 2_500)).resolves.toEqual({
          status: 'waiting',
        });
      }
      await expect(finishOpenWeightLlmPriorityTicket(active)).resolves.toBe('owned');
      await expect(admitOpenWeightLlmPriorityTicket(secondSummary, 2_500)).resolves.toEqual({
        status: 'waiting',
      });
      await expect(admitOpenWeightLlmPriorityTicket(firstSummary, 2_500)).resolves.toEqual({
        status: 'admitted',
      });
      await finishOpenWeightLlmPriorityTicket(firstSummary);
      await finishOpenWeightLlmPriorityTicket(secondSummary);
      await expect(admitOpenWeightLlmPriorityTicket(learning, 2_500)).resolves.toEqual({
        status: 'admitted',
      });
    });

    it.each([
      ['qa_summary', 'learning_objectives'],
      ['topic_label', 'qa_summary'],
    ] as const)(
      'lässt %s einen laufenden Auftrag %s gezielt unterbrechen',
      async (higher, lower) => {
        const active = ticket(lower);
        const waiting = ticket(higher);

        await admitOpenWeightLlmPriorityTicket(active, 2_500);
        await beginOpenWeightLlmPriorityTicket(active, 30_000);
        await expect(admitOpenWeightLlmPriorityTicket(waiting, 2_500)).resolves.toEqual({
          status: 'interrupt',
          owner: active.id,
        });
        await expect(admitOpenWeightLlmPriorityTicket(waiting, 2_500, active.id)).resolves.toEqual({
          status: 'admitted',
        });
        await expect(finishOpenWeightLlmPriorityTicket(active)).resolves.toBe('preempted');
      },
    );

    it('vergibt den Slot nach Besitzerverlust ohne Mitwirkung des alten Prozesses', async () => {
      const stopped = ticket('qa_summary');
      const next = ticket('learning_objectives');
      await admitOpenWeightLlmPriorityTicket(stopped, 2_500);
      await beginOpenWeightLlmPriorityTicket(stopped, 30_000);
      await expect(admitOpenWeightLlmPriorityTicket(next, 2_500)).resolves.toEqual({
        status: 'waiting',
      });

      await getRedis().pexpire(OPEN_WEIGHT_LLM_LEASE_KEY, 1);
      await vi.waitFor(async () => {
        await expect(getRedis().get(OPEN_WEIGHT_LLM_LEASE_KEY)).resolves.toBeNull();
      });
      await expect(admitOpenWeightLlmPriorityTicket(next, 2_500)).resolves.toEqual({
        status: 'admitted',
      });
      await expect(finishOpenWeightLlmPriorityTicket(stopped)).resolves.toBe('lost');
      await expect(getRedis().get(OPEN_WEIGHT_LLM_LEASE_KEY)).resolves.toBe(next.id);
    });

    it('lässt einen noch nicht gestarteten Auftrag nach abgesagter Übergabe weiterlaufen', async () => {
      const old = ticket('learning_objectives');
      const next = ticket('topic_label');
      await admitOpenWeightLlmPriorityTicket(old, 2_500);
      await admitOpenWeightLlmPriorityTicket(next, 2_500);
      await finishOpenWeightLlmPriorityTicket(next);
      await expect(beginOpenWeightLlmPriorityTicket(old, 30_000)).resolves.toBe('owned');
      await expect(finishOpenWeightLlmPriorityTicket(old, true)).resolves.toBe('owned');
    });

    it('sendet bei verlorenem Abbruchsignal keinen zweiten Modell-POST', async () => {
      enablePriorityClient();
      let finish = () => {};
      const holding = new Promise<void>((resolve) => {
        finish = resolve;
      });
      let posts = 0;
      let cancellations = 0;
      const request = vi.fn(async (input: { path: string; headers: Record<string, string> }) => {
        if (input.path.startsWith('/slots')) {
          return { status: posts ? 503 : 200, body: '[]' };
        }
        if (input.path === '/internal/arsnova/cancel') {
          cancellations += 1;
          return { status: 200, body: '{"status":"unknown"}' };
        }
        posts += 1;
        const id = input.headers['x-arsnova-inference-id'];
        if (id) reservations.push({ id, taskType: 'learning_objectives' });
        await holding;
        return {
          status: 200,
          body: JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    schemaVersion: 1,
                    taskType: 'learning_objectives',
                    objectives: [],
                  }),
                },
              },
            ],
          }),
        };
      });
      resetOpenWeightLlmClientForTests({ request });
      const low = runOpenWeightLlm(learningRequest);
      try {
        await vi.waitFor(() => expect(posts).toBe(1));
        await expect(runOpenWeightLlm(topic)).resolves.toMatchObject({ status: 'busy' });
        expect(cancellations).toBeGreaterThan(0);
        expect(posts).toBe(1);
      } finally {
        finish();
        await low;
      }
    }, 6000);

    it('lässt bei Redis-Ausfall keinen Modell-POST zu', async () => {
      enablePriorityClient();
      vi.spyOn(getRedis(), 'eval').mockRejectedValue(new Error('Redis unavailable'));
      const request = vi.fn();
      resetOpenWeightLlmClientForTests({ request });
      await expect(runOpenWeightLlm(topic)).resolves.toMatchObject({ status: 'unavailable' });
      expect(request).not.toHaveBeenCalled();
    });

    it('reserviert auch bei voller Lernziel-Warteliste Platz für Themenlabels', async () => {
      const legacy = randomUUID();
      await getRedis().set(OPEN_WEIGHT_LLM_LEASE_KEY, legacy, 'PX', 2_500);
      for (let count = 0; count < 8; count += 1) {
        await expect(
          admitOpenWeightLlmPriorityTicket(ticket('learning_objectives'), 2_500),
        ).resolves.toEqual({ status: 'waiting' });
      }
      await expect(
        admitOpenWeightLlmPriorityTicket(ticket('learning_objectives'), 2_500),
      ).resolves.toEqual({ status: 'rejected' });
      const high = ticket('topic_label');
      await expect(admitOpenWeightLlmPriorityTicket(high, 2_500)).resolves.toEqual({
        status: 'waiting',
      });
      await expect(getRedis().get(OPEN_WEIGHT_LLM_LEASE_KEY)).resolves.toBe(legacy);
      await getRedis().del(OPEN_WEIGHT_LLM_LEASE_KEY);
      await expect(admitOpenWeightLlmPriorityTicket(high, 2_500)).resolves.toEqual({
        status: 'admitted',
      });
    });
  },
);

import { describe, expect, it, vi } from 'vitest';
import type pg from 'pg';
import { serializeQueriesOnClient } from './serializePgClientQueries';

describe('serializeQueriesOnClient', () => {
  it('führt überlappende query()-Aufrufe strikt nacheinander aus', async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    const querySpy = vi.fn(async (sql: string) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return { rows: [{ sql }] };
    });

    const fakeClient = { query: querySpy } as unknown as pg.PoolClient;
    serializeQueriesOnClient(fakeClient);

    const results = await Promise.all([
      fakeClient.query('select 1'),
      fakeClient.query('select 2'),
      fakeClient.query('select 3'),
    ]);

    expect(querySpy).toHaveBeenCalledTimes(3);
    expect(maxInFlight).toBe(1);
    expect(results.map((row) => row.rows[0]?.sql)).toEqual(['select 1', 'select 2', 'select 3']);
  });

  it('blockiert die Queue nicht, wenn eine Query fehlschlägt', async () => {
    const querySpy = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ rows: [{ ok: true }] });

    const fakeClient = { query: querySpy } as unknown as pg.PoolClient;
    serializeQueriesOnClient(fakeClient);

    await expect(fakeClient.query('select fail')).rejects.toThrow('boom');
    await expect(fakeClient.query('select ok')).resolves.toEqual({ rows: [{ ok: true }] });
    expect(querySpy).toHaveBeenCalledTimes(2);
  });

  it('wrappt denselben Client nur einmal (Pool-Wiederverwendung)', async () => {
    const querySpy = vi.fn(async () => ({ rows: [] }));
    const fakeClient = { query: querySpy } as unknown as pg.PoolClient;

    serializeQueriesOnClient(fakeClient);
    const wrappedOnce = fakeClient.query;
    serializeQueriesOnClient(fakeClient);
    serializeQueriesOnClient(fakeClient);

    expect(fakeClient.query).toBe(wrappedOnce);

    await Promise.all([fakeClient.query('a'), fakeClient.query('b')]);
    expect(querySpy).toHaveBeenCalledTimes(2);
  });
});

import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $transaction: vi.fn(),
  },
}));

vi.mock('../db', () => ({ prisma: prismaMock }));

import {
  lockSessionDeletionQuizParents,
  lockSessionDeletionTargets,
  runSessionBoundWrite,
  runSerializableSessionDeletion,
} from './sessionDeletion';

function serializableConflict(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Write conflict', {
    code: 'P2034',
    clientVersion: 'test',
  });
}

function driverAdapterSerializableConflict(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Raw query failed', {
    code: 'P2010',
    clientVersion: 'test',
    meta: {
      driverAdapterError: {
        cause: {
          originalCode: '40001',
        },
      },
    },
  });
}

describe('sessionDeletion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('wiederholt P2034 bounded unter SERIALIZABLE', async () => {
    const transactionClient = {} as Prisma.TransactionClient;
    const operation = vi.fn().mockResolvedValue('deleted');
    prismaMock.$transaction
      .mockRejectedValueOnce(serializableConflict())
      .mockImplementationOnce(
        async (callback: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
          callback(transactionClient),
      );

    await expect(runSerializableSessionDeletion(operation)).resolves.toBe('deleted');

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(2);
    expect(prismaMock.$transaction).toHaveBeenNthCalledWith(1, operation, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    expect(operation).toHaveBeenCalledOnce();
    expect(operation).toHaveBeenCalledWith(transactionClient);
  });

  it('reicht einen dritten Serialisierungskonflikt weiter', async () => {
    prismaMock.$transaction.mockRejectedValue(serializableConflict());

    await expect(runSerializableSessionDeletion(async () => undefined)).rejects.toMatchObject({
      code: 'P2034',
    });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(3);
  });

  it('wiederholt einen vom Driver Adapter als P2010 verpackten SQLSTATE 40001', async () => {
    const transactionClient = {} as Prisma.TransactionClient;
    const operation = vi.fn().mockResolvedValue('deleted');
    prismaMock.$transaction
      .mockRejectedValueOnce(driverAdapterSerializableConflict())
      .mockImplementationOnce(
        async (callback: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
          callback(transactionClient),
      );

    await expect(runSerializableSessionDeletion(operation)).resolves.toBe('deleted');

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(2);
    expect(operation).toHaveBeenCalledOnce();
  });

  it('wiederholt andere P2010-Fehler nicht', async () => {
    const rawQueryError = new Prisma.PrismaClientKnownRequestError('Raw query failed', {
      code: 'P2010',
      clientVersion: 'test',
      meta: {
        driverAdapterError: {
          cause: {
            originalCode: '23503',
          },
        },
      },
    });
    prismaMock.$transaction.mockRejectedValue(rawQueryError);

    await expect(runSerializableSessionDeletion(async () => undefined)).rejects.toBe(rawQueryError);

    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
  });

  it('vertraut bei P2010 nur dem verschachtelten Driver-Adapter-SQLSTATE', async () => {
    const rawQueryError = new Prisma.PrismaClientKnownRequestError('Raw query failed', {
      code: 'P2010',
      clientVersion: 'test',
      meta: {
        originalCode: '40001',
      },
    });
    prismaMock.$transaction.mockRejectedValue(rawQueryError);

    await expect(runSerializableSessionDeletion(async () => undefined)).rejects.toBe(rawQueryError);

    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
  });

  it('sperrt Ziel-Sessions sortiert und liest deren aktuellen Parentbezug', async () => {
    const locked = [{ id: 'session-a', code: 'ABC123', quizId: 'quiz-current' }];
    const queryRaw = vi.fn().mockResolvedValue(locked);
    const tx = { $queryRaw: queryRaw } as unknown as Prisma.TransactionClient;

    await expect(
      lockSessionDeletionTargets(tx, ['session-b', 'session-a', 'session-b']),
    ).resolves.toEqual(locked);

    const query = queryRaw.mock.calls[0]?.[0] as { strings?: string[]; values?: unknown[] };
    expect(query.strings?.join('?')).toContain('FOR UPDATE OF target');
    expect(query.strings?.join('?')).toContain('ORDER BY target."id" ASC');
    expect(query.strings?.join('?')).toContain('target."quizId"');
    expect(query.values).toEqual(['session-a', 'session-b']);
  });

  it('legt nach einem bereits abgeschlossenen Purge keinen FK-losen Sessionbezug neu an', async () => {
    const transactionClient = {
      $queryRaw: vi.fn().mockResolvedValue([]),
    } as unknown as Prisma.TransactionClient;
    prismaMock.$transaction.mockImplementationOnce(
      async (callback: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
        callback(transactionClient),
    );
    const operation = vi.fn();

    await expect(runSessionBoundWrite('deleted-session', operation)).resolves.toBeNull();

    expect(operation).not.toHaveBeenCalled();
  });

  it('erzeugt vor dem FK-losen Writer eine Session-Tupelversion für wartende Purges', async () => {
    const target = { id: 'session-a', code: 'ABC123', quizId: null };
    const executeRaw = vi.fn().mockResolvedValue(1);
    const transactionClient = {
      $queryRaw: vi.fn().mockResolvedValue([target]),
      $executeRaw: executeRaw,
    } as unknown as Prisma.TransactionClient;
    prismaMock.$transaction.mockImplementationOnce(
      async (callback: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
        callback(transactionClient),
    );
    const operation = vi.fn().mockResolvedValue('written');

    await expect(runSessionBoundWrite(target.id, operation)).resolves.toBe('written');

    const update = executeRaw.mock.calls[0]?.[0] as { strings?: string[] };
    expect(update.strings?.join('?')).toContain('SET "statusChangedAt" = "statusChangedAt"');
    expect(operation).toHaveBeenCalledWith(transactionClient, target);
  });

  it('sperrt eindeutige Parent-Quizze sortiert vor dem Delete', async () => {
    const queryRaw = vi.fn().mockResolvedValue([]);
    const tx = { $queryRaw: queryRaw } as unknown as Prisma.TransactionClient;

    await expect(
      lockSessionDeletionQuizParents(tx, ['quiz-b', null, 'quiz-a', 'quiz-b']),
    ).resolves.toEqual(['quiz-a', 'quiz-b']);

    const query = queryRaw.mock.calls[0]?.[0] as { strings?: string[]; values?: unknown[] };
    expect(query.strings?.join('?')).toContain('FOR UPDATE OF parent');
    expect(query.strings?.join('?')).toContain('ORDER BY parent."id" ASC');
    expect(query.values).toEqual(['quiz-a', 'quiz-b']);
  });
});

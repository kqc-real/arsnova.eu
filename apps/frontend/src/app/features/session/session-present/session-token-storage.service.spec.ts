import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HOST_TOKEN_INDEXED_DB_NAME,
  SessionTokenStorageService,
} from './session-token-storage.service';

type TokenRecord = { code: string; token: string; expiresAt: number };

function createIdbRequest<T>(value: T): IDBRequest<T> {
  const request = {
    result: value,
    error: null,
    onsuccess: null as (() => void) | null,
    onerror: null as (() => void) | null,
  };
  queueMicrotask(() => request.onsuccess?.());
  return request as IDBRequest<T>;
}

function createFakeIndexedDb(data: Map<string, TokenRecord>) {
  return {
    open(name: string) {
      expect(name).toBe(HOST_TOKEN_INDEXED_DB_NAME);
      const transaction = {
        oncomplete: null as (() => void) | null,
        onerror: null as (() => void) | null,
        onabort: null as (() => void) | null,
        error: null,
        objectStore() {
          return {
            get(key: IDBValidKey) {
              const request = createIdbRequest(data.get(String(key)));
              queueMicrotask(() => transaction.oncomplete?.());
              return request;
            },
            delete(key: IDBValidKey) {
              data.delete(String(key));
              const request = createIdbRequest(undefined);
              queueMicrotask(() => transaction.oncomplete?.());
              return request;
            },
          };
        },
      };
      const db = {
        objectStoreNames: { contains: () => true },
        createObjectStore() {
          return undefined;
        },
        close() {
          return undefined;
        },
        transaction: () => transaction,
      };
      const request = {
        result: db,
        onupgradeneeded: null as (() => void) | null,
        onsuccess: null as (() => void) | null,
        onerror: null as (() => void) | null,
      };
      queueMicrotask(() => {
        request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    },
  };
}

describe('SessionTokenStorageService', () => {
  const data = new Map<string, TokenRecord>();

  beforeEach(() => {
    data.clear();
    window.sessionStorage.clear();
    vi.stubGlobal('indexedDB', createFakeIndexedDb(data));
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
    TestBed.resetTestingModule();
  });

  it('liest einen gültigen Token aus der früheren Übergabe nur für seine Session', async () => {
    data.set('ABC123', {
      code: 'ABC123',
      token: 'host-token-xyz',
      expiresAt: Date.now() + 60_000,
    });
    const service = TestBed.inject(SessionTokenStorageService);

    expect(await service.getHostToken('abc123')).toBe('host-token-xyz');
    expect(await service.getHostToken('XYZ789')).toBeNull();
  });

  it('verwirft abgelaufene IndexedDB-Tokens', async () => {
    data.set('ABC123', {
      code: 'ABC123',
      token: 'stale',
      expiresAt: Date.now() - 1,
    });
    const service = TestBed.inject(SessionTokenStorageService);

    expect(await service.getHostToken('ABC123')).toBeNull();
    expect(data.has('ABC123')).toBe(false);
  });

  it('entfernt den gespeicherten Token', async () => {
    const service = TestBed.inject(SessionTokenStorageService);
    data.set('ABC123', {
      code: 'ABC123',
      token: 'host-token-xyz',
      expiresAt: Date.now() + 60_000,
    });

    await service.clearHostToken('abc123');

    expect(await service.getHostToken('ABC123')).toBeNull();
    expect(data.has('ABC123')).toBe(false);
  });

  it('liefert null wenn IndexedDB fehlt', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const service = TestBed.inject(SessionTokenStorageService);

    expect(await service.getHostToken('ABC123')).toBeNull();
  });
});

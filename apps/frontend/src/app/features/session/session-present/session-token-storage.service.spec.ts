import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setHostToken, clearHostToken } from '../../../core/host-session-token';
import {
  HOST_TOKEN_INDEXED_DB_NAME,
  SessionTokenStorageService,
} from './session-token-storage.service';

type TokenRecord = { code: string; token: string };

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
            put(record: TokenRecord) {
              data.set(record.code, record);
              const request = createIdbRequest(record);
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
    clearHostToken('ABC123');
    vi.stubGlobal('indexedDB', createFakeIndexedDb(data));
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
    TestBed.resetTestingModule();
  });

  it('schreibt und liest den Host-Token sessionbezogen', async () => {
    const service = TestBed.inject(SessionTokenStorageService);

    await service.setHostToken('abc123', ' host-token-xyz ');

    expect(await service.getHostToken('ABC123')).toBe('host-token-xyz');
    expect(data.get('ABC123')).toEqual({ code: 'ABC123', token: 'host-token-xyz' });
  });

  it('persistiert den aktuellen sessionStorage-Token', async () => {
    setHostToken('ABC123', 'tab-token');
    const service = TestBed.inject(SessionTokenStorageService);

    await service.persistCurrentHostToken('abc123');

    expect(await service.getHostToken('ABC123')).toBe('tab-token');
  });

  it('entfernt den gespeicherten Token', async () => {
    const service = TestBed.inject(SessionTokenStorageService);
    await service.setHostToken('ABC123', 'host-token-xyz');

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

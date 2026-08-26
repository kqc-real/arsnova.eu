import { Injectable } from '@angular/core';
import { getHostToken, normalizeHostSessionCode } from '../../../core/host-session-token';

/** Eigene DB, getrennt von Yjs/`y-indexeddb` der Quiz-Sammlung. */
export const HOST_TOKEN_INDEXED_DB_NAME = 'arsnova-host-tokens';
const HOST_TOKEN_STORE_NAME = 'tokens';
const HOST_TOKEN_DB_VERSION = 1;

type HostTokenRecord = {
  code: string;
  token: string;
};

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
  });
}

function openHostTokenDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB unavailable'));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(HOST_TOKEN_INDEXED_DB_NAME, HOST_TOKEN_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(HOST_TOKEN_STORE_NAME)) {
        db.createObjectStore(HOST_TOKEN_STORE_NAME, { keyPath: 'code' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
  });
}

async function withHostTokenStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openHostTokenDb();
  try {
    const transaction = db.transaction(HOST_TOKEN_STORE_NAME, mode);
    const request = run(transaction.objectStore(HOST_TOKEN_STORE_NAME));
    const [result] = await Promise.all([requestToPromise(request), transactionDone(transaction)]);
    return result;
  } finally {
    db.close();
  }
}

/**
 * Origin-gebundener Host-Token-Speicher für den Presenter-Tab auf Tablets.
 * Nur im Session-Feature importieren — nicht in Core, Home oder app.routes.
 */
@Injectable({ providedIn: 'root' })
export class SessionTokenStorageService {
  async getHostToken(sessionCode: string): Promise<string | null> {
    const code = normalizeHostSessionCode(sessionCode);
    try {
      const record = await withHostTokenStore<HostTokenRecord | undefined>('readonly', (store) =>
        store.get(code),
      );
      const token = record?.token?.trim() ?? '';
      return token || null;
    } catch {
      return null;
    }
  }

  async setHostToken(sessionCode: string, token: string): Promise<void> {
    const code = normalizeHostSessionCode(sessionCode);
    const normalizedToken = token.trim();
    if (!code || !normalizedToken) {
      return;
    }
    await withHostTokenStore('readwrite', (store) =>
      store.put({ code, token: normalizedToken } satisfies HostTokenRecord),
    );
  }

  async clearHostToken(sessionCode: string): Promise<void> {
    const code = normalizeHostSessionCode(sessionCode);
    try {
      await withHostTokenStore('readwrite', (store) => store.delete(code));
    } catch {
      // Private Mode / Quota: sessionStorage bleibt die tab-lokale Quelle.
    }
  }

  async persistCurrentHostToken(sessionCode: string): Promise<void> {
    const token = getHostToken(sessionCode);
    if (!token) {
      return;
    }
    try {
      await this.setHostToken(sessionCode, token);
    } catch {
      // Presenter-Tab kann dann nur über sessionStorage (Desktop) fortfahren.
    }
  }
}

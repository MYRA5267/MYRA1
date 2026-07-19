// ─── Локальные треки пользователя в IndexedDB ────────────────────────────────
// Блобы аудиофайлов сохраняются на устройстве и переживают перезапуск.

export interface LocalTrackRecord {
  id: number;
  title: string;
  artist: string;
  duration: string;
  c1: string;
  c2: string;
  blob: Blob;
  genre?: string;
  lyrics?: string;
  cover?: string | null;
}

const DB_NAME = "myra-local";
const STORE = "tracks";
const DL_STORE = "downloads";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: "id" });
      }
      if (!req.result.objectStoreNames.contains(DL_STORE)) {
        req.result.createObjectStore(DL_STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ── Скачанные треки каталога (офлайн-режим) ──

export async function saveDownload(id: number, blob: Blob): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DL_STORE, "readwrite");
    tx.objectStore(DL_STORE).put({ id, blob });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function loadDownloads(): Promise<{ id: number; blob: Blob }[]> {
  try {
    const db = await openDb();
    const recs = await new Promise<{ id: number; blob: Blob }[]>((resolve, reject) => {
      const req = db.transaction(DL_STORE, "readonly").objectStore(DL_STORE).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return recs;
  } catch { return []; }
}

export async function deleteDownload(id: number): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DL_STORE, "readwrite");
    tx.objectStore(DL_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function saveLocalTrack(rec: LocalTrackRecord): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(rec);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function loadLocalTracks(): Promise<LocalTrackRecord[]> {
  try {
    const db = await openDb();
    const recs = await new Promise<LocalTrackRecord[]>((resolve, reject) => {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result as LocalTrackRecord[]);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return recs.sort((a, b) => b.id - a.id);
  } catch {
    return []; // приватный режим или запрет хранилища — работаем без сохранения
  }
}

export async function deleteLocalTrack(id: number): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

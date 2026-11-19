export type LocalAttachment = {
  id: string;
  boardId: string;
  name: string;
  type: string;
  size: number;
  createdAt: string;
  blob: Blob;
};

const DB_NAME = 'visual-workspace-files';
const STORE_NAME = 'attachments';

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open local file storage.'));
  });
}

export async function listAttachments(boardId: string): Promise<LocalAttachment[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve((request.result as LocalAttachment[]).filter((file) => file.boardId === boardId));
    request.onerror = () => reject(request.error ?? new Error('Could not read attachments.'));
  });
}

export async function saveAttachment(file: LocalAttachment): Promise<void> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(file);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Could not save attachment.'));
  });
}

export async function removeAttachment(id: string): Promise<void> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Could not delete attachment.'));
  });
}

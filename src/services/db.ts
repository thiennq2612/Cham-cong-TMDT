const DB_NAME = 'CTVTimekeepingDB';
const DB_VERSION = 1;
const STORE_COLLABORATORS = 'collaborators';
const STORE_LOGS = 'logs';

export interface Collaborator {
  id?: number;
  name: string;
  hourlyRate: number;
}

export interface TimeLog {
  id?: number;
  name: string;
  date: string; // YYYY-MM-DD
  checkInTime: number; // Timestamp (ms)
  checkOutTime: number; // Timestamp (ms)
  signature: string; // Base64 Image URL
  hourlyRate: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open database'));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = () => {
      const db = request.result;
      
      // Create collaborators store
      if (!db.objectStoreNames.contains(STORE_COLLABORATORS)) {
        db.createObjectStore(STORE_COLLABORATORS, { keyPath: 'id', autoIncrement: true });
      }

      // Create logs store
      if (!db.objectStoreNames.contains(STORE_LOGS)) {
        db.createObjectStore(STORE_LOGS, { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

export async function initDefaultCollaborators(): Promise<void> {
  const collabs = await getCollaborators();
  if (collabs.length === 0) {
    await addCollaborator('Nguyễn Văn A', 42000);
    await addCollaborator('Trần Thị B', 42000);
    await addCollaborator('Lê Văn C', 42000);
  }
}

export async function getCollaborators(): Promise<Collaborator[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_COLLABORATORS, 'readonly');
    const store = transaction.objectStore(STORE_COLLABORATORS);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(new Error('Failed to retrieve collaborators'));
    };
  });
}

export async function addCollaborator(name: string, hourlyRate: number = 42000): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_COLLABORATORS, 'readwrite');
    const store = transaction.objectStore(STORE_COLLABORATORS);
    const request = store.add({ name, hourlyRate });

    request.onsuccess = () => {
      resolve(request.result as number);
    };

    request.onerror = () => {
      reject(new Error('Failed to add collaborator'));
    };
  });
}

export async function deleteCollaborator(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_COLLABORATORS, 'readwrite');
    const store = transaction.objectStore(STORE_COLLABORATORS);
    const request = store.delete(id);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(new Error('Failed to delete collaborator'));
    };
  });
}

export async function getTimeLogs(): Promise<TimeLog[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_LOGS, 'readonly');
    const store = transaction.objectStore(STORE_LOGS);
    const request = store.getAll();

    request.onsuccess = () => {
      // Sort logs by checkInTime descending (newest first)
      const sorted = (request.result as TimeLog[]).sort((a, b) => b.checkInTime - a.checkInTime);
      resolve(sorted);
    };

    request.onerror = () => {
      reject(new Error('Failed to retrieve time logs'));
    };
  });
}

export async function addTimeLog(log: Omit<TimeLog, 'id'>): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_LOGS, 'readwrite');
    const store = transaction.objectStore(STORE_LOGS);
    const request = store.add(log);

    request.onsuccess = () => {
      resolve(request.result as number);
    };

    request.onerror = () => {
      reject(new Error('Failed to add time log'));
    };
  });
}

export async function deleteTimeLog(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_LOGS, 'readwrite');
    const store = transaction.objectStore(STORE_LOGS);
    const request = store.delete(id);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(new Error('Failed to delete time log'));
    };
  });
}

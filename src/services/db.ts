import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy,
  updateDoc,
  onSnapshot
} from 'firebase/firestore';

// ==========================================
// CẤU HÌNH FIREBASE CỦA BẠN (CẦN THAY THẾ)
// ==========================================
// Hãy dán cụm thông tin cấu hình Firebase Web App của bạn vào đây:
const firebaseConfig = {
  apiKey: "AIzaSyBO_4bXSfuwdjLs7RI-sYWdLyy49vctPVE",
  authDomain: "fahasa-tmdt.firebaseapp.com",
  projectId: "fahasa-tmdt",
  storageBucket: "fahasa-tmdt.firebasestorage.app",
  messagingSenderId: "882925197789",
  appId: "1:882925197789:web:d99723e1a7bde185a2fe34",
  measurementId: "G-J2ZB935SNK"
};

const app = initializeApp(firebaseConfig);
const firestore = getFirestore(app);

const COLLAB_COLLECTION = 'collaborators';
const LOGS_COLLECTION = 'logs';

export interface Collaborator {
  id?: string;
  name: string;
  hourlyRate: number;
}

export interface TimeLog {
  id?: string;
  name: string;
  date: string; // YYYY-MM-DD
  checkInTime: number; // Timestamp (ms)
  checkOutTime: number; // Timestamp (ms)
  signature: string; // Base64 Image URL
  hourlyRate: number;
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
  try {
    const querySnapshot = await getDocs(collection(firestore, COLLAB_COLLECTION));
    const collabs: Collaborator[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      collabs.push({
        id: doc.id,
        name: data.name,
        hourlyRate: data.hourlyRate ?? 42000
      });
    });
    return collabs;
  } catch (err) {
    console.error('Error fetching collaborators: ', err);
    return [];
  }
}

export async function addCollaborator(name: string, hourlyRate: number = 42000): Promise<string> {
  const docRef = await addDoc(collection(firestore, COLLAB_COLLECTION), {
    name,
    hourlyRate
  });
  return docRef.id;
}

export async function deleteCollaborator(id: string): Promise<void> {
  await deleteDoc(doc(firestore, COLLAB_COLLECTION, id));
}

export async function getTimeLogs(): Promise<TimeLog[]> {
  try {
    const q = query(collection(firestore, LOGS_COLLECTION), orderBy('checkInTime', 'desc'));
    const querySnapshot = await getDocs(q);
    const logs: TimeLog[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      logs.push({
        id: doc.id,
        name: data.name,
        date: data.date,
        checkInTime: data.checkInTime,
        checkOutTime: data.checkOutTime,
        signature: data.signature,
        hourlyRate: data.hourlyRate ?? 42000
      });
    });
    return logs;
  } catch (err) {
    console.error('Error fetching time logs: ', err);
    return [];
  }
}

export async function addTimeLog(log: Omit<TimeLog, 'id'>): Promise<string> {
  const docRef = await addDoc(collection(firestore, LOGS_COLLECTION), log);
  return docRef.id;
}

export async function deleteTimeLog(id: string): Promise<void> {
  await deleteDoc(doc(firestore, LOGS_COLLECTION, id));
}

export async function updateTimeLog(id: string, updates: Partial<TimeLog>): Promise<void> {
  await updateDoc(doc(firestore, LOGS_COLLECTION, id), updates);
}

export function subscribeTimeLogs(callback: (logs: TimeLog[]) => void) {
  const q = query(collection(firestore, LOGS_COLLECTION), orderBy('checkInTime', 'desc'));
  return onSnapshot(q, (querySnapshot) => {
    const logs: TimeLog[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      logs.push({
        id: doc.id,
        name: data.name,
        date: data.date,
        checkInTime: data.checkInTime,
        checkOutTime: data.checkOutTime,
        signature: data.signature,
        hourlyRate: data.hourlyRate ?? 42000
      });
    });
    callback(logs);
  }, (err) => {
    console.error('Error listening to logs: ', err);
  });
}

export function subscribeCollaborators(callback: (collabs: Collaborator[]) => void) {
  return onSnapshot(collection(firestore, COLLAB_COLLECTION), (querySnapshot) => {
    const collabs: Collaborator[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      collabs.push({
        id: doc.id,
        name: data.name,
        hourlyRate: data.hourlyRate ?? 42000
      });
    });
    callback(collabs);
  }, (err) => {
    console.error('Error listening to collaborators: ', err);
  });
}

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously, Auth } from 'firebase/auth';
import { 
  initializeFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  query, 
  where,
  writeBatch,
  serverTimestamp,
  Firestore
} from 'firebase/firestore';

// Safely load local config if available, without breaking build or runtime if missing
const appletConfigModules = import.meta.glob('../../firebase-applet-config.json', { eager: true });
const fileConfig: any = (Object.values(appletConfigModules)[0] as any)?.default || {};

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY || fileConfig.apiKey;
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || fileConfig.projectId;

const firebaseConfig = {
  apiKey: apiKey || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || fileConfig.authDomain || '',
  projectId: projectId || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || fileConfig.storageBucket || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || fileConfig.messagingSenderId || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || fileConfig.appId || '',
};

const databaseId = import.meta.env.VITE_FIREBASE_DATABASE_ID || fileConfig.firestoreDatabaseId || '(default)';

export const isFirebaseConfigured = (): boolean => {
  return Boolean(apiKey && projectId);
};

let appInstance: FirebaseApp | null = null;
let dbInstance: Firestore | null = null;
let authInstance: Auth | null = null;

if (isFirebaseConfigured()) {
  try {
    appInstance = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    dbInstance = initializeFirestore(appInstance, {
      ignoreUndefinedProperties: true
    }, databaseId);
    authInstance = getAuth(appInstance);
  } catch (err) {
    console.warn('Firebase: Não foi possível inicializar o SDK.', err);
  }
}

export const app = appInstance;
export const db = dbInstance;
export const auth = authInstance;

// Simple anonymous sign-in helper
export const ensureAuthenticated = async () => {
  if (!isFirebaseConfigured() || !authInstance) {
    return { uid: 'local-anonymous-user' } as any;
  }
  if (!authInstance.currentUser) {
    try {
      await signInAnonymously(authInstance);
      console.log('Firebase: Autenticação anônima estabelecida com sucesso.');
    } catch (err: any) {
      if (err.code === 'auth/admin-restricted-operation' || err.code === 'auth/operation-not-allowed') {
        console.warn('Autenticação anônima desabilitada. Utilizando fallback local.');
        return { uid: 'local-anonymous-user' } as any;
      }
      console.warn('Firebase: Falha ao autenticar, utilizando fallback local.', err);
      return { uid: 'local-anonymous-user' } as any;
    }
  }
  return authInstance.currentUser;
};

// Types corresponding to local structures for typing the firebase functions
import { Batch, ExpectedItem, ScanItem, AuditLog } from '../types';

/**
 * Cloud Sync Service to bidirectional synchronize LocalStorage with Firestore
 */
export const syncToCloud = async (
  localBatches: Batch[],
  localExpectedItems: ExpectedItem[],
  localScanItems: ScanItem[],
  localAuditLogs: AuditLog[]
) => {
  if (!isFirebaseConfigured() || !dbInstance) {
    throw new Error('O Firebase não está configurado. Configure as credenciais no arquivo .env.');
  }
  const user = await ensureAuthenticated();
  if (!user) throw new Error('Não autenticado no Firebase.');
  const ownerUid = user.uid;

  // 1. Get existing batches in Firestore to compare
  const batchesRef = collection(dbInstance, 'batches');
  const q = query(batchesRef, where('ownerUid', '==', ownerUid));
  const querySnapshot = await getDocs(q);
  
  const cloudBatchesMap = new Map<number, any>();
  querySnapshot.forEach((docSnap) => {
    const data = docSnap.data();
    cloudBatchesMap.set(Number(data.id), { docId: docSnap.id, ...data });
  });

  // 2. Synchronize Batches
  for (const localBatch of localBatches) {
    const batchDocId = String(localBatch.id);
    const batchDocRef = doc(dbInstance, 'batches', batchDocId);
    const cloudBatch = cloudBatchesMap.get(localBatch.id);

    if (!cloudBatch) {
      // Create new batch in Firestore
      await setDoc(batchDocRef, {
        id: localBatch.id,
        name: localBatch.name,
        description: localBatch.description || '',
        type: localBatch.type,
        timestamp: localBatch.timestamp,
        isClosed: !!localBatch.isClosed,
        closedReason: localBatch.closedReason || '',
        closedAt: localBatch.closedAt || null,
        ownerUid: ownerUid
      });
      console.log(`Firebase Sync: Lote '${localBatch.name}' enviado.`);
    } else {
      // If local batch is modified, update cloud
      if (
        localBatch.name !== cloudBatch.name ||
        (localBatch.description || '') !== (cloudBatch.description || '') ||
        !!localBatch.isClosed !== !!cloudBatch.isClosed
      ) {
        await setDoc(batchDocRef, {
          id: localBatch.id,
          name: localBatch.name,
          description: localBatch.description || '',
          type: localBatch.type,
          timestamp: localBatch.timestamp,
          isClosed: !!localBatch.isClosed,
          closedReason: localBatch.closedReason || '',
          closedAt: localBatch.closedAt || null,
          ownerUid: ownerUid
        }, { merge: true });
        console.log(`Firebase Sync: Lote '${localBatch.name}' atualizado.`);
      }
    }

    // Synchronize subcollections for this batch: scanItems, expectedItems, auditLogs
    
    // A. Expected Items Subcollection
    const expectedRef = collection(dbInstance, 'batches', batchDocId, 'expectedItems');
    const cloudExpectedSnap = await getDocs(expectedRef);
    const cloudExpectedMap = new Map<number, any>();
    cloudExpectedSnap.forEach((d) => {
      cloudExpectedMap.set(Number(d.data().id), { docId: d.id, ...d.data() });
    });

    const localExpectedForBatch = localExpectedItems.filter(e => e.batchId === localBatch.id);
    for (const item of localExpectedForBatch) {
      const itemDocRef = doc(expectedRef, String(item.id));
      const cloudItem = cloudExpectedMap.get(item.id);

      if (!cloudItem || item.isFound !== cloudItem.isFound || item.timestampFound !== cloudItem.timestampFound) {
        await setDoc(itemDocRef, {
          id: item.id,
          batchId: item.batchId,
          barcode: item.barcode,
          description: item.description || '',
          category: item.category || '',
          isFound: !!item.isFound,
          timestampFound: item.timestampFound || null
        }, { merge: true });
      }
    }

    // B. Scan Items Subcollection
    const scansRef = collection(dbInstance, 'batches', batchDocId, 'scanItems');
    const cloudScansSnap = await getDocs(scansRef);
    const cloudScansMap = new Map<number, any>();
    cloudScansSnap.forEach((d) => {
      cloudScansMap.set(Number(d.data().id), { docId: d.id, ...d.data() });
    });

    const localScansForBatch = localScanItems.filter(s => s.batchId === localBatch.id);
    for (const scan of localScansForBatch) {
      const scanDocRef = doc(scansRef, String(scan.id));
      const cloudScan = cloudScansMap.get(scan.id);

      if (!cloudScan) {
        await setDoc(scanDocRef, {
          id: scan.id,
          batchId: scan.batchId,
          barcode: scan.barcode,
          format: scan.format,
          timestamp: scan.timestamp
        });
      }
    }

    // C. Audit Logs Subcollection
    const logsRef = collection(dbInstance, 'batches', batchDocId, 'auditLogs');
    const cloudLogsSnap = await getDocs(logsRef);
    const cloudLogsMap = new Map<number, any>();
    cloudLogsSnap.forEach((d) => {
      cloudLogsMap.set(Number(d.data().id), d.data());
    });

    const localLogsForBatch = localAuditLogs.filter(l => l.batchId === localBatch.id);
    for (const log of localLogsForBatch) {
      const logDocRef = doc(logsRef, String(log.id));
      const cloudLog = cloudLogsMap.get(log.id);

      if (!cloudLog) {
        await setDoc(logDocRef, {
          id: log.id,
          batchId: log.batchId,
          timestamp: log.timestamp,
          type: log.type,
          barcode: log.barcode || null,
          message: log.message || ''
        });
      }
    }
  }

  // Delete cloud batches that are deleted locally (only if local count is different)
  const localBatchIds = new Set(localBatches.map(b => b.id));
  for (const [cloudId, cloudBatch] of cloudBatchesMap.entries()) {
    if (!localBatchIds.has(cloudId)) {
      const batchDocRef = doc(dbInstance, 'batches', String(cloudId));
      await deleteDoc(batchDocRef);
      console.log(`Firebase Sync: Lote deletado na nuvem (id: ${cloudId}).`);
    }
  }
};

export const addChangelog = async (title: string, description: string) => {
  if (!isFirebaseConfigured() || !dbInstance) {
    return;
  }
  const user = await ensureAuthenticated();
  if (!user) return;

  const logRef = doc(collection(dbInstance, 'changelogs'));
  await setDoc(logRef, {
    id: logRef.id,
    title,
    description,
    author: 'Gemini AI',
    timestamp: Date.now(),
    ownerUid: user.uid
  });
};

export const getChangelogs = async () => {
  if (!isFirebaseConfigured() || !dbInstance) {
    return [];
  }
  const q = query(collection(dbInstance, 'changelogs'));
  const snap = await getDocs(q);
  const logs: any[] = [];
  snap.forEach(d => logs.push(d.data()));
  return logs.sort((a, b) => b.timestamp - a.timestamp);
};

export const downloadFromCloud = async (): Promise<{
  batches: Batch[];
  expectedItems: ExpectedItem[];
  scanItems: ScanItem[];
  auditLogs: AuditLog[];
}> => {
  if (!isFirebaseConfigured() || !dbInstance) {
    throw new Error('O Firebase não está configurado. Configure as credenciais no arquivo .env.');
  }
  const user = await ensureAuthenticated();
  if (!user) throw new Error('Não autenticado no Firebase.');
  const ownerUid = user.uid;

  // 1. Fetch batches
  const batchesRef = collection(dbInstance, 'batches');
  const q = query(batchesRef, where('ownerUid', '==', ownerUid));
  const querySnapshot = await getDocs(q);

  const batches: Batch[] = [];
  const expectedItems: ExpectedItem[] = [];
  const scanItems: ScanItem[] = [];
  const auditLogs: AuditLog[] = [];

  for (const docSnap of querySnapshot.docs) {
    const data = docSnap.data();
    const batchDocId = docSnap.id;

    batches.push({
      id: Number(data.id),
      name: data.name,
      description: data.description,
      type: data.type,
      timestamp: data.timestamp,
      isClosed: !!data.isClosed,
      closedReason: data.closedReason,
      closedAt: data.closedAt
    });

    // Fetch expected items
    const expectedSnap = await getDocs(collection(dbInstance, 'batches', batchDocId, 'expectedItems'));
    expectedSnap.forEach((d) => {
      const ed = d.data();
      expectedItems.push({
        id: Number(ed.id),
        batchId: Number(ed.batchId),
        barcode: ed.barcode,
        description: ed.description,
        category: ed.category,
        isFound: !!ed.isFound,
        timestampFound: ed.timestampFound
      });
    });

    // Fetch scan items
    const scansSnap = await getDocs(collection(dbInstance, 'batches', batchDocId, 'scanItems'));
    scansSnap.forEach((d) => {
      const sd = d.data();
      scanItems.push({
        id: Number(sd.id),
        batchId: Number(sd.batchId),
        barcode: sd.barcode,
        format: sd.format,
        timestamp: sd.timestamp
      });
    });

    // Fetch audit logs
    const logsSnap = await getDocs(collection(dbInstance, 'batches', batchDocId, 'auditLogs'));
    logsSnap.forEach((d) => {
      const ld = d.data();
      auditLogs.push({
        id: Number(ld.id),
        batchId: Number(ld.batchId),
        timestamp: ld.timestamp,
        type: ld.type,
        barcode: ld.barcode,
        message: ld.message
      });
    });
  }

  return { batches, expectedItems, scanItems, auditLogs };
};

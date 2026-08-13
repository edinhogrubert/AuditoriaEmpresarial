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
import { Batch, BatchType, ExpectedItem, ScanItem, AuditLog } from '../types';
import {
  getStoredBatches,
  getStoredExpectedItems,
  getStoredScanItems,
  getStoredAuditLogs,
  saveBatches,
  saveExpectedItems,
  saveScanItems,
  saveAuditLogs,
  reconcileBatchAudit,
  getStoredDeviceTag,
  saveStoredDeviceTag,
  getStoredDeviceCustomName,
  saveStoredDeviceCustomName,
} from './storage';

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

export interface FirebaseStatusInfo {
  configured: boolean;
  projectId: string;
  statusText: string;
}

export const getFirebaseStatusInfo = (): FirebaseStatusInfo => {
  const configured = isFirebaseConfigured();
  return {
    configured,
    projectId: projectId || 'Nenhum projeto configurado',
    statusText: configured
      ? 'Conectado ao Firebase Cloud (Sincronização Ativa)'
      : 'Modo Local (LocalStorage Ativo)'
  };
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

/**
 * Registers or retrieves the sequential device identification for cloud uploads/downloads.
 * Format: "Pedro_1", "Pedro_2", "Dispositivo_1", etc.
 */
export const registerOrGetDeviceSequence = async (
  desiredName?: string,
  forceNewSequence: boolean = false
): Promise<string> => {
  const currentTag = getStoredDeviceTag();
  if (currentTag && !forceNewSequence) {
    return currentTag;
  }

  const baseName = (desiredName || getStoredDeviceCustomName() || 'Dispositivo')
    .trim()
    .replace(/[^a-zA-Z0-9_áàâãéèêíïóôõöúçÑñ]/gi, '');
  const cleanPrefix = baseName || 'Dispositivo';

  let nextSequence = 1;

  if (isFirebaseConfigured() && dbInstance) {
    try {
      await ensureAuthenticated();
      const counterDocRef = doc(dbInstance, 'device_counters', cleanPrefix);
      const counterSnap = await getDoc(counterDocRef);

      if (counterSnap.exists()) {
        const data = counterSnap.data();
        nextSequence = (Number(data.count) || 0) + 1;
      }

      await setDoc(counterDocRef, {
        count: nextSequence,
        updatedAt: Date.now(),
      }, { merge: true });

      const newTag = `${cleanPrefix}_${nextSequence}`;

      // Register device info document
      await setDoc(doc(dbInstance, 'registered_devices', newTag), {
        deviceTag: newTag,
        baseName: cleanPrefix,
        sequence: nextSequence,
        registeredAt: Date.now(),
      });

      saveStoredDeviceTag(newTag);
      saveStoredDeviceCustomName(cleanPrefix);
      return newTag;
    } catch (e) {
      console.warn('Erro ao registrar sequencial na nuvem, gerando fallback local:', e);
    }
  }

  // Local fallback if offline
  const randomSuffix = Math.floor(Math.random() * 100) + 1;
  const fallbackTag = `${cleanPrefix}_${randomSuffix}`;
  saveStoredDeviceTag(fallbackTag);
  saveStoredDeviceCustomName(cleanPrefix);
  return fallbackTag;
};

export interface CloudBatchSummary {
  id: number;
  name: string;
  description?: string;
  type: BatchType;
  timestamp: number;
  isClosed?: boolean;
  closedAt?: number;
  closedReason?: string;
  expectedCount?: number;
  scannedCount?: number;
  foundCount?: number;
  createdBy?: string;
}

/**
 * Lists all batches available in Firebase Cloud (accessible to any device connected)
 */
export const fetchCloudBatchesList = async (): Promise<CloudBatchSummary[]> => {
  if (!isFirebaseConfigured() || !dbInstance) {
    throw new Error('O Firebase não está configurado.');
  }

  const batchesRef = collection(dbInstance, 'batches');
  const querySnapshot = await getDocs(batchesRef);

  const summaries: CloudBatchSummary[] = [];

  for (const docSnap of querySnapshot.docs) {
    const data = docSnap.data();
    const batchDocId = docSnap.id;

    let expectedCount = 0;
    let scannedCount = 0;
    let foundCount = 0;

    try {
      const expSnap = await getDocs(collection(dbInstance, 'batches', batchDocId, 'expectedItems'));
      expectedCount = expSnap.size;
      expSnap.forEach((d) => {
        if (d.data().isFound) foundCount++;
      });

      const scanSnap = await getDocs(collection(dbInstance, 'batches', batchDocId, 'scanItems'));
      scannedCount = scanSnap.size;
    } catch (e) {
      console.warn('Erro ao ler contagens do lote cloud:', e);
    }

    summaries.push({
      id: Number(data.id),
      name: data.name || `Lote #${data.id}`,
      description: data.description || '',
      type: data.type || 'COLLECTION',
      timestamp: Number(data.timestamp) || Date.now(),
      isClosed: !!data.isClosed,
      closedAt: data.closedAt || undefined,
      closedReason: data.closedReason || '',
      expectedCount,
      scannedCount,
      foundCount,
      createdBy: data.createdBy || 'ADM_WEB',
    });
  }

  return summaries.sort((a, b) => b.timestamp - a.timestamp);
};

/**
 * Uploads/Descarrrega a single local batch to Firebase Cloud with Smart Merge
 */
export const uploadSingleBatchToCloud = async (batchId: number): Promise<{
  success: boolean;
  isMerged: boolean;
  wasClosedOnCloud: boolean;
  scannedCount: number;
  foundCount: number;
  totalExpected: number;
}> => {
  if (!isFirebaseConfigured() || !dbInstance) {
    throw new Error('O Firebase não está configurado.');
  }
  await ensureAuthenticated();

  const localBatches = getStoredBatches();
  const localBatch = localBatches.find((b) => b.id === batchId);
  if (!localBatch) {
    throw new Error('Lote local não encontrado.');
  }

  const localExpected = getStoredExpectedItems().filter((e) => e.batchId === batchId);
  const localScans = getStoredScanItems().filter((s) => s.batchId === batchId);
  const localLogs = getStoredAuditLogs().filter((l) => l.batchId === batchId);

  const operatorTag = await registerOrGetDeviceSequence();

  const batchDocRef = doc(dbInstance, 'batches', String(batchId));
  const cloudDocSnap = await getDoc(batchDocRef);

  let isMerged = false;
  let wasClosedOnCloud = false;

  let mergedExpected: ExpectedItem[] = [...localExpected];
  let mergedScans: ScanItem[] = [...localScans];
  let mergedLogs: AuditLog[] = [...localLogs];

  if (cloudDocSnap.exists()) {
    isMerged = true;
    const cloudBatchData = cloudDocSnap.data();
    if (cloudBatchData.isClosed) {
      wasClosedOnCloud = true;
    }

    // 1. Merge Expected Items
    const cloudExpectedSnap = await getDocs(collection(dbInstance, 'batches', String(batchId), 'expectedItems'));
    const cloudExpectedMap = new Map<string, ExpectedItem>();
    cloudExpectedSnap.forEach((d) => {
      const data = d.data();
      cloudExpectedMap.set(data.barcode.trim().toLowerCase(), {
        id: Number(data.id),
        batchId: Number(data.batchId),
        barcode: data.barcode,
        description: data.description,
        category: data.category,
        isFound: !!data.isFound,
        timestampFound: data.timestampFound || undefined,
      });
    });

    // Unified map by barcode
    const unifiedExpectedMap = new Map<string, ExpectedItem>();

    // Put cloud expected items
    cloudExpectedMap.forEach((item, key) => {
      unifiedExpectedMap.set(key, item);
    });

    // Merge local expected items
    localExpected.forEach((localItem) => {
      const key = localItem.barcode.trim().toLowerCase();
      const existing = unifiedExpectedMap.get(key);
      if (!existing) {
        unifiedExpectedMap.set(key, localItem);
      } else {
        // Merge status: if either is found, result is found
        const isFound = existing.isFound || localItem.isFound;
        const timestampFound = existing.timestampFound || localItem.timestampFound;
        unifiedExpectedMap.set(key, {
          ...existing,
          isFound,
          timestampFound,
          description: localItem.description || existing.description,
          category: localItem.category || existing.category,
        });
      }
    });

    mergedExpected = Array.from(unifiedExpectedMap.values());

    // 2. Merge Scan Items
    const cloudScansSnap = await getDocs(collection(dbInstance, 'batches', String(batchId), 'scanItems'));
    const cloudScans: ScanItem[] = [];
    cloudScansSnap.forEach((d) => {
      const data = d.data();
      cloudScans.push({
        id: Number(data.id),
        batchId: Number(data.batchId),
        barcode: data.barcode,
        format: data.format,
        timestamp: Number(data.timestamp),
      });
    });

    // Unique scans map by barcode + timestamp
    const scanKeys = new Set<string>();
    mergedScans = [];

    [...cloudScans, ...localScans].forEach((scan) => {
      const key = `${scan.barcode.trim().toLowerCase()}_${scan.timestamp}`;
      if (!scanKeys.has(key)) {
        scanKeys.add(key);
        mergedScans.push(scan);
      }
    });

    // 3. Merge Audit Logs
    const cloudLogsSnap = await getDocs(collection(dbInstance, 'batches', String(batchId), 'auditLogs'));
    const cloudLogs: AuditLog[] = [];
    cloudLogsSnap.forEach((d) => {
      const data = d.data();
      cloudLogs.push({
        id: Number(data.id),
        batchId: Number(data.batchId),
        timestamp: Number(data.timestamp),
        type: data.type,
        barcode: data.barcode,
        message: data.message,
      });
    });

    const logKeys = new Set<string>();
    mergedLogs = [];
    [...cloudLogs, ...localLogs].forEach((log) => {
      const key = `${log.id}_${log.timestamp}`;
      if (!logKeys.has(key)) {
        logKeys.add(key);
        mergedLogs.push(log);
      }
    });
  }

  // Write merged batch metadata to Firestore
  const isClosedFinal = localBatch.isClosed || wasClosedOnCloud;
  await setDoc(batchDocRef, {
    id: localBatch.id,
    name: localBatch.name,
    description: localBatch.description || '',
    type: localBatch.type,
    timestamp: localBatch.timestamp,
    isClosed: isClosedFinal,
    closedReason: localBatch.closedReason || (wasClosedOnCloud ? 'Concluído na nuvem' : ''),
    closedAt: localBatch.closedAt || null,
    createdBy: localBatch.createdBy || operatorTag,
    lastUploadedBy: operatorTag,
    updatedAt: Date.now(),
  }, { merge: true });

  // Write merged expected items
  const expectedSubRef = collection(dbInstance, 'batches', String(batchId), 'expectedItems');
  for (const item of mergedExpected) {
    await setDoc(doc(expectedSubRef, String(item.id)), {
      id: item.id,
      batchId: item.batchId,
      barcode: item.barcode,
      description: item.description || '',
      category: item.category || '',
      isFound: !!item.isFound,
      timestampFound: item.timestampFound || null,
    });
  }

  // Write merged scan items
  const scansSubRef = collection(dbInstance, 'batches', String(batchId), 'scanItems');
  for (const scan of mergedScans) {
    await setDoc(doc(scansSubRef, String(scan.id)), {
      id: scan.id,
      batchId: scan.batchId,
      barcode: scan.barcode,
      format: scan.format,
      timestamp: scan.timestamp,
    });
  }

  // Write merged audit logs
  const logsSubRef = collection(dbInstance, 'batches', String(batchId), 'auditLogs');
  for (const log of mergedLogs) {
    await setDoc(doc(logsSubRef, String(log.id)), {
      id: log.id,
      batchId: log.batchId,
      timestamp: log.timestamp,
      type: log.type,
      barcode: log.barcode || null,
      message: log.message || '',
    });
  }

  // ALSO update local storage for this batch with the merged cloud state!
  const allLocalExpected = getStoredExpectedItems().filter((e) => e.batchId !== batchId);
  saveExpectedItems([...allLocalExpected, ...mergedExpected]);

  const allLocalScans = getStoredScanItems().filter((s) => s.batchId !== batchId);
  saveScanItems([...allLocalScans, ...mergedScans]);

  const allLocalLogs = getStoredAuditLogs().filter((l) => l.batchId !== batchId);
  saveAuditLogs([...allLocalLogs, ...mergedLogs]);

  // Update local batch record
  const updatedBatches = localBatches.map((b) => {
    if (b.id === batchId) {
      return {
        ...b,
        isClosed: isClosedFinal,
        closedReason: b.closedReason || (wasClosedOnCloud ? 'Concluído na nuvem' : ''),
        closedAt: b.closedAt || (wasClosedOnCloud ? Date.now() : undefined),
      };
    }
    return b;
  });
  saveBatches(updatedBatches);

  reconcileBatchAudit(batchId);

  const foundCount = mergedExpected.filter((e) => e.isFound).length;

  return {
    success: true,
    isMerged,
    wasClosedOnCloud,
    scannedCount: mergedScans.length,
    foundCount,
    totalExpected: mergedExpected.length,
  };
};

/**
 * Downloads/Carrega a single batch from Firebase Cloud to LocalStorage
 */
export const downloadSingleBatchFromCloud = async (batchId: number): Promise<Batch> => {
  if (!isFirebaseConfigured() || !dbInstance) {
    throw new Error('O Firebase não está configurado.');
  }
  await ensureAuthenticated();

  const batchDocRef = doc(dbInstance, 'batches', String(batchId));
  const docSnap = await getDoc(batchDocRef);

  if (!docSnap.exists()) {
    throw new Error(`Lote #${batchId} não foi encontrado na nuvem.`);
  }

  const data = docSnap.data();

  const cloudBatch: Batch = {
    id: Number(data.id),
    name: data.name,
    description: data.description || '',
    type: data.type || 'COLLECTION',
    timestamp: Number(data.timestamp) || Date.now(),
    isClosed: !!data.isClosed,
    closedReason: data.closedReason || '',
    closedAt: data.closedAt || undefined,
  };

  // Download expected items
  const expectedSnap = await getDocs(collection(dbInstance, 'batches', String(batchId), 'expectedItems'));
  const downloadedExpected: ExpectedItem[] = [];
  expectedSnap.forEach((d) => {
    const ed = d.data();
    downloadedExpected.push({
      id: Number(ed.id),
      batchId: Number(ed.batchId),
      barcode: ed.barcode,
      description: ed.description || '',
      category: ed.category || '',
      isFound: !!ed.isFound,
      timestampFound: ed.timestampFound || undefined,
    });
  });

  // Download scan items
  const scansSnap = await getDocs(collection(dbInstance, 'batches', String(batchId), 'scanItems'));
  const downloadedScans: ScanItem[] = [];
  scansSnap.forEach((d) => {
    const sd = d.data();
    downloadedScans.push({
      id: Number(sd.id),
      batchId: Number(sd.batchId),
      barcode: sd.barcode,
      format: sd.format,
      timestamp: Number(sd.timestamp),
    });
  });

  // Download audit logs
  const logsSnap = await getDocs(collection(dbInstance, 'batches', String(batchId), 'auditLogs'));
  const downloadedLogs: AuditLog[] = [];
  logsSnap.forEach((d) => {
    const ld = d.data();
    downloadedLogs.push({
      id: Number(ld.id),
      batchId: Number(ld.batchId),
      timestamp: Number(ld.timestamp),
      type: ld.type,
      barcode: ld.barcode || undefined,
      message: ld.message || '',
    });
  });

  // Save/Merge into LocalStorage
  const localBatches = getStoredBatches().filter((b) => b.id !== batchId);
  saveBatches([cloudBatch, ...localBatches]);

  const localExpected = getStoredExpectedItems().filter((e) => e.batchId !== batchId);
  saveExpectedItems([...downloadedExpected, ...localExpected]);

  const localScans = getStoredScanItems().filter((s) => s.batchId !== batchId);
  saveScanItems([...downloadedScans, ...localScans]);

  const localLogs = getStoredAuditLogs().filter((l) => l.batchId !== batchId);
  saveAuditLogs([...downloadedLogs, ...localLogs]);

  reconcileBatchAudit(batchId);

  return cloudBatch;
};


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

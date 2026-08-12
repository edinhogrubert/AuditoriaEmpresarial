import { Batch, ScanItem, ExpectedItem, AppSettings, BatchType, AuditLog, AuditLogType } from '../types';

const BATCHES_KEY = 'inventario_batches_v2';
const SCAN_ITEMS_KEY = 'inventario_scan_items_v2';
const EXPECTED_ITEMS_KEY = 'inventario_expected_items_v2';
const SETTINGS_KEY = 'inventario_settings_v2';
const AUDIT_LOGS_KEY = 'inventario_audit_logs_v2';

export const getStoredAuditLogs = (): AuditLog[] => {
  try {
    const data = localStorage.getItem(AUDIT_LOGS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

export const saveAuditLogs = (logs: AuditLog[]) => {
  try {
    localStorage.setItem(AUDIT_LOGS_KEY, JSON.stringify(logs));
  } catch (e) {}
};

export const addAuditLog = (batchId: number, type: AuditLogType, barcode?: string, message: string = '') => {
  const logs = getStoredAuditLogs();
  const newLog: AuditLog = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    batchId,
    timestamp: Date.now(),
    type,
    barcode,
    message,
  };
  saveAuditLogs([newLog, ...logs]);
};

export const getAuditLogsForBatch = (batchId: number): AuditLog[] => {
  return getStoredAuditLogs().filter(log => log.batchId === batchId);
};

export const exportAuditLogsToCsv = (batch: Batch) => {
  const logs = getAuditLogsForBatch(batch.id);
  let csvContent = 'Data,Hora,Evento,Patrimônio,Mensagem\n';
  logs.forEach(log => {
    const date = formatDateStr(log.timestamp);
    const time = formatTimeStr(log.timestamp);
    const barcode = log.barcode || '-';
    csvContent += `${date},${time},${log.type},"${barcode}","${log.message.replace(/"/g, '""')}"\n`;
  });
  downloadCsv(csvContent, `log_auditoria_${batch.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${Date.now()}.csv`);
};

// Add Expected Items to an existing Batch
export const addExpectedItemsToBatch = (
  batchId: number,
  items: { barcode: string; description?: string; category?: string }[]
) => {
  const allExpected = getStoredExpectedItems();
  const existingForBatch = allExpected.filter(e => e.batchId === batchId);
  const existingBarcodes = new Set(existingForBatch.map(e => e.barcode.toLowerCase()));

  const newExpected: ExpectedItem[] = [];
  items.forEach((item, index) => {
    if (!existingBarcodes.has(item.barcode.toLowerCase().trim())) {
      newExpected.push({
        id: Date.now() + index + Math.floor(Math.random() * 10000),
        batchId: batchId,
        barcode: item.barcode.trim(),
        description: item.description?.trim() || 'Item de Inventário',
        category: item.category?.trim() || 'Sem Categoria',
        isFound: false,
      });
      existingBarcodes.add(item.barcode.toLowerCase().trim());
    }
  });

  if (newExpected.length > 0) {
    saveExpectedItems([...allExpected, ...newExpected]);
  }
  return newExpected.length;
};

// Clear all expected items for a batch
export const clearExpectedItemsForBatch = (batchId: number) => {
  const allExpected = getStoredExpectedItems();
  saveExpectedItems(allExpected.filter(e => e.batchId !== batchId));
};

// Clear all scanned items for a batch
export const clearScanItemsForBatch = (batchId: number) => {
  const allScans = getStoredScanItems();
  saveScanItems(allScans.filter(s => s.batchId !== batchId));

  // Also reset 'isFound' status for all expected items in this batch
  const allExpected = getStoredExpectedItems();
  const updatedExpected = allExpected.map(exp => {
    if (exp.batchId === batchId) {
      return { ...exp, isFound: false, timestampFound: undefined };
    }
    return exp;
  });
  saveExpectedItems(updatedExpected);
};


export const getStoredBatches = (): Batch[] => {
  try {
    const data = localStorage.getItem(BATCHES_KEY);
    if (!data) {
      return [];
    }
    return JSON.parse(data);
  } catch (e) {
    console.error('Failed to get batches', e);
    return [];
  }
};

export const saveBatches = (batches: Batch[]) => {
  try {
    localStorage.setItem(BATCHES_KEY, JSON.stringify(batches));
  } catch (e) {
    console.error('Failed to save batches', e);
  }
};

// Scan Items API
export const getStoredScanItems = (): ScanItem[] => {
  try {
    const data = localStorage.getItem(SCAN_ITEMS_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch (e) {
    console.error('Failed to get scan items', e);
    return [];
  }
};

export const saveScanItems = (items: ScanItem[]) => {
  try {
    localStorage.setItem(SCAN_ITEMS_KEY, JSON.stringify(items));
  } catch (e) {
    console.error('Failed to save scan items', e);
  }
};

// Expected Items API (Conferência / Auditoria)
export const getStoredExpectedItems = (): ExpectedItem[] => {
  try {
    const data = localStorage.getItem(EXPECTED_ITEMS_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch (e) {
    console.error('Failed to get expected items', e);
    return [];
  }
};

export const saveExpectedItems = (items: ExpectedItem[]) => {
  try {
    localStorage.setItem(EXPECTED_ITEMS_KEY, JSON.stringify(items));
  } catch (e) {
    console.error('Failed to save expected items', e);
  }
};

// Create Batch
export const createBatch = (
  name: string,
  description: string = '',
  type: BatchType = 'COLLECTION',
  expectedList: { barcode: string; description?: string; category?: string }[] = []
): Batch => {
  const batches = getStoredBatches();
  const newBatch: Batch = {
    id: Date.now(),
    name: name.trim(),
    description: description.trim(),
    type,
    timestamp: Date.now(),
  };
  saveBatches([newBatch, ...batches]);

  addAuditLog(newBatch.id, 'IMPORT_START', undefined, `Lote criado (${type}). ${expectedList.length > 0 ? `Importados ${expectedList.length} itens.` : ''}`);

  if (type === 'VERIFICATION' && expectedList.length > 0) {
    const allExpected = getStoredExpectedItems();
    const newExpected: ExpectedItem[] = expectedList.map((item, index) => ({
      id: Date.now() + index + Math.floor(Math.random() * 1000),
      batchId: newBatch.id,
      barcode: item.barcode.trim(),
      description: item.description?.trim() || '',
      category: item.category?.trim() || '',
      isFound: false,
    }));
    saveExpectedItems([...allExpected, ...newExpected]);
  }

  return newBatch;
};

// Delete Batch
export const deleteBatch = (batchId: number) => {
  saveBatches(getStoredBatches().filter((b) => b.id !== batchId));
  saveScanItems(getStoredScanItems().filter((i) => i.batchId !== batchId));
  saveExpectedItems(getStoredExpectedItems().filter((e) => e.batchId !== batchId));
};

// Process Scan Item for Verification or Collection Batch
export interface VerificationScanResult {
  status: 'FOUND' | 'DUPLICATE' | 'EXTRA' | 'ADDED';
  message: string;
  item: ScanItem;
  expectedItem?: ExpectedItem;
}

export const processScanItem = (
  batchId: number,
  barcode: string,
  format: string
): VerificationScanResult => {
  const code = barcode.trim();
  const batches = getStoredBatches();
  const batch = batches.find((b) => b.id === batchId);

  const scanItems = getStoredScanItems();
  const alreadyScanned = scanItems.some(
    (i) => i.batchId === batchId && i.barcode.toLowerCase() === code.toLowerCase()
  );

  const newScanItem: ScanItem = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    batchId,
    barcode: code,
    format: format.toUpperCase(),
    timestamp: Date.now(),
  };

  // If simple collection batch
  if (!batch || batch.type === 'COLLECTION') {
    if (alreadyScanned) {
      addAuditLog(batchId, 'DUPLICATE_BLOCK', code, 'Tentativa de leitura duplicada bloqueada (coleção)');
      return {
        status: 'DUPLICATE',
        message: 'Atenção: Este item já foi lido/coletado neste lote!',
        item: newScanItem,
      };
    }
    saveScanItems([newScanItem, ...scanItems]);
    return {
      status: 'ADDED',
      message: 'Item adicionado ao lote',
      item: newScanItem,
    };
  }

  // If Verification / Audit batch
  const expectedItems = getStoredExpectedItems();
  const matchedExpected = expectedItems.find(
    (exp) => exp.batchId === batchId && exp.barcode.toLowerCase() === code.toLowerCase()
  );

  if (matchedExpected) {
    if (matchedExpected.isFound || alreadyScanned) {
      // Already found / scanned previously
      addAuditLog(batchId, 'DUPLICATE_BLOCK', code, 'Tentativa de verificação duplicada bloqueada');
      return {
        status: 'DUPLICATE',
        message: 'Atenção: Item já havia sido verificado anteriormente!',
        item: newScanItem,
        expectedItem: matchedExpected,
      };
    } else {
      // First time found!
      const updatedExpected = expectedItems.map((exp) =>
        exp.id === matchedExpected.id
          ? { ...exp, isFound: true, timestampFound: Date.now() }
          : exp
      );
      saveExpectedItems(updatedExpected);
      saveScanItems([newScanItem, ...scanItems]);
      return {
        status: 'FOUND',
        message: 'Sucesso: Patrimônio localizado na lista de auditoria!',
        item: newScanItem,
        expectedItem: { ...matchedExpected, isFound: true, timestampFound: Date.now() },
      };
    }
  } else {
    // Extra item / Sobra de estoque
    if (alreadyScanned) {
      addAuditLog(batchId, 'DUPLICATE_BLOCK', code, 'Tentativa de leitura duplicada de sobra bloqueada');
      return {
        status: 'DUPLICATE',
        message: 'Atenção: Esta sobra de estoque já foi lida anteriormente!',
        item: newScanItem,
      };
    }
    saveScanItems([newScanItem, ...scanItems]);
    return {
      status: 'EXTRA',
      message: 'Aviso: Código escaneado não consta na lista esperada (Sobra)',
      item: newScanItem,
    };
  }
};

export const addMultipleScanItems = (batchId: number, barcodes: string[], format: string = 'MANUAL') => {
  barcodes.forEach((barcode) => {
    if (barcode && barcode.trim()) {
      processScanItem(batchId, barcode.trim(), format);
    }
  });
  return reconcileBatchAudit(batchId);
};

// Delete Scan Item & Sync Audit status
export const deleteScanItemAndSync = (itemId: number) => {
  const scanItems = getStoredScanItems();
  const itemToDelete = scanItems.find((i) => i.id === itemId);
  if (!itemToDelete) return;

  addAuditLog(itemToDelete.batchId, 'ITEM_REMOVED', itemToDelete.barcode, 'Item excluído do registro/lote');

  const updatedScanItems = scanItems.filter((i) => i.id !== itemId);
  saveScanItems(updatedScanItems);

  // Check if there are other scans for this same barcode in the same batch
  const remainingSameBarcodeScans = updatedScanItems.filter(
    (i) => i.batchId === itemToDelete.batchId && i.barcode === itemToDelete.barcode
  );

  // If no remaining scans for this code, mark expected item back to unfound
  if (remainingSameBarcodeScans.length === 0) {
    const expectedItems = getStoredExpectedItems();
    const updatedExpected = expectedItems.map((exp) => {
      if (exp.batchId === itemToDelete.batchId && exp.barcode.toLowerCase() === itemToDelete.barcode.toLowerCase()) {
        return { ...exp, isFound: false, timestampFound: undefined };
      }
      return exp;
    });
    saveExpectedItems(updatedExpected);
  }
};

// Delete any item (ExpectedItem, ScanItem, or both) from a batch
export const deleteItemFromBatch = (
  batchId: number,
  barcode: string,
  scanId?: number,
  expectedItemId?: number
) => {
  // 1. Remove scan items
  const scanItems = getStoredScanItems();
  const updatedScans = scanItems.filter((s) => {
    if (scanId) return s.id !== scanId;
    return !(s.batchId === batchId && s.barcode.toLowerCase() === barcode.toLowerCase());
  });
  saveScanItems(updatedScans);

  // 2. Remove expected items
  const expectedItems = getStoredExpectedItems();
  const updatedExpected = expectedItems.filter((e) => {
    if (expectedItemId) return e.id !== expectedItemId;
    return !(e.batchId === batchId && e.barcode.toLowerCase() === barcode.toLowerCase());
  });
  saveExpectedItems(updatedExpected);
};

// Helpers & Statistics
export const getScanItemsForBatch = (batchId: number): ScanItem[] => {
  return getStoredScanItems().filter((item) => item.batchId === batchId);
};

export const getScanCountForBatch = (batchId: number): number => {
  return getScanItemsForBatch(batchId).length;
};

export const getExpectedItemsForBatch = (batchId: number): ExpectedItem[] => {
  return getStoredExpectedItems().filter((item) => item.batchId === batchId);
};

export interface AuditStats {
  totalExpected: number;
  scannedCount: number;
  combinedTotal: number;
  foundCount: number;
  missingCount: number;
  extraCount: number;
  progressPercent: number;
}

export const reconcileBatchAudit = (batchId: number): AuditStats => {
  const expectedItems = getStoredExpectedItems();
  const scanItems = getScanItemsForBatch(batchId);
  const scannedBarcodesMap = new Map<string, number>();

  scanItems.forEach((scan) => {
    const key = scan.barcode.trim().toLowerCase();
    if (!scannedBarcodesMap.has(key) || scan.timestamp < scannedBarcodesMap.get(key)!) {
      scannedBarcodesMap.set(key, scan.timestamp);
    }
  });

  let hasExpectedForBatch = false;
  const updatedExpected = expectedItems.map((exp) => {
    if (exp.batchId === batchId) {
      hasExpectedForBatch = true;
      const key = exp.barcode.trim().toLowerCase();
      const matchTimestamp = scannedBarcodesMap.get(key);
      if (matchTimestamp !== undefined) {
        return { ...exp, isFound: true, timestampFound: matchTimestamp };
      } else {
        return { ...exp, isFound: false, timestampFound: undefined };
      }
    }
    return exp;
  });

  saveExpectedItems(updatedExpected);

  // If batch has expected items, ensure batch type is 'VERIFICATION'
  if (hasExpectedForBatch) {
    const batches = getStoredBatches();
    const updatedBatches = batches.map((b) =>
      b.id === batchId && b.type !== 'VERIFICATION' ? { ...b, type: 'VERIFICATION' as const } : b
    );
    localStorage.setItem(BATCHES_KEY, JSON.stringify(updatedBatches));
  }

  addAuditLog(
    batchId,
    'AUDIT_RECONCILED',
    '',
    'Recálculo e conciliação completa da lógica do negócio (TODOS, OK, FALTANTE, EXTRA)'
  );

  return getAuditStatsForBatch(batchId);
};

export const getAuditStatsForBatch = (batchId: number): AuditStats => {
  const expected = getExpectedItemsForBatch(batchId);
  const scans = getScanItemsForBatch(batchId);

  const totalExpected = expected.length;

  // Unique scanned barcodes
  const uniqueScannedMap = new Map<string, ScanItem>();
  scans.forEach((s) => {
    const key = s.barcode.trim().toLowerCase();
    if (!uniqueScannedMap.has(key)) {
      uniqueScannedMap.set(key, s);
    }
  });
  const scannedCount = uniqueScannedMap.size;

  const expectedBarcodes = new Set(expected.map((e) => e.barcode.trim().toLowerCase()));
  const combinedBarcodes = new Set<string>();
  expectedBarcodes.forEach((b) => combinedBarcodes.add(b));
  uniqueScannedMap.forEach((_, k) => combinedBarcodes.add(k));
  const combinedTotal = combinedBarcodes.size > 0 ? combinedBarcodes.size : (totalExpected > 0 ? totalExpected : scans.length);

  const foundCount = expected.filter((e) => e.isFound).length;
  const missingCount = Math.max(0, totalExpected - foundCount);

  // Extra items are scans that don't match any expected barcode
  let extraCount = 0;
  uniqueScannedMap.forEach((_, k) => {
    if (!expectedBarcodes.has(k)) {
      extraCount++;
    }
  });

  const progressPercent = totalExpected > 0 ? Math.round((foundCount / totalExpected) * 100) : (scannedCount > 0 ? 100 : 0);

  return {
    totalExpected,
    scannedCount,
    combinedTotal,
    foundCount,
    missingCount,
    extraCount,
    progressPercent,
  };
};

// Data retrieval for suggestions
export const getUniqueCategories = (): string[] => {
  const items = getStoredExpectedItems();
  const cats = items.map(i => i.category).filter((c): c is string => !!c && c.trim().length > 0);
  return Array.from(new Set(cats)).sort();
};

export const getUniqueDescriptions = (): string[] => {
  const items = getStoredExpectedItems();
  const descs = items.map(i => i.description).filter((d): d is string => !!d && d.trim().length > 0);
  return Array.from(new Set(descs)).sort();
};

// CSV Export Helpers
export const formatDateStr = (timestamp: number): string => {
  const d = new Date(timestamp);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

export const formatTimeStr = (timestamp: number): string => {
  const d = new Date(timestamp);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
};

export const exportSingleBatchToCsv = (batch: Batch, items: ScanItem[]) => {
  if (batch.type === 'VERIFICATION') {
    exportAuditReportCsv(batch);
    return;
  }

  let csvContent = 'Lote,Index,Formato,Conteúdo,Data,Hora\n';
  const escapedBatchName = `"${batch.name.replace(/"/g, '""')}"`;

  items.forEach((item, index) => {
    const date = formatDateStr(item.timestamp);
    const time = formatTimeStr(item.timestamp);
    const escapedBarcode = `"${item.barcode.replace(/"/g, '""')}"`;
    const escapedFormat = `"${item.format}"`;
    csvContent += `${escapedBatchName},${index + 1},${escapedFormat},${escapedBarcode},${date},${time}\n`;
  });

  downloadCsv(csvContent, `coleta_${batch.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${Date.now()}.csv`);
};

export const exportAuditReportCsv = (batch: Batch, filteredExpected?: ExpectedItem[], filteredExtras?: ScanItem[]) => {
  const expected = filteredExpected !== undefined ? filteredExpected : getExpectedItemsForBatch(batch.id);
  const scans = getScanItemsForBatch(batch.id);

  let csvContent = 'Lote,Status,Código/Patrimônio,Descrição,Categoria,Data/Hora Localização\n';
  const escapedName = `"${batch.name.replace(/"/g, '""')}"`;

  // Expected items
  expected.forEach((item) => {
    const status = item.isFound ? 'ENCONTRADO' : 'FALTANTE';
    const time = item.timestampFound ? `${formatDateStr(item.timestampFound)} ${formatTimeStr(item.timestampFound)}` : '-';
    const desc = item.description ? `"${item.description.replace(/"/g, '""')}"` : 'N/A';
    const cat = item.category ? `"${item.category.replace(/"/g, '""')}"` : 'N/A';
    const escapedCode = `"${item.barcode.replace(/"/g, '""')}"`;
    csvContent += `${escapedName},${status},${escapedCode},${desc},${cat},${time}\n`;
  });

  // Extra items (Sobras)
  const finalExtras = filteredExtras !== undefined ? filteredExtras : (filteredExpected ? [] : scans.filter(s => {
      const expectedBarcodes = new Set(getExpectedItemsForBatch(batch.id).map(e => e.barcode.toLowerCase()));
      return !expectedBarcodes.has(s.barcode.toLowerCase());
  }));

  if (finalExtras.length > 0) {
      const uniqueExtrasMap = new Map<string, ScanItem>();
      finalExtras.forEach((s) => {
        if (!uniqueExtrasMap.has(s.barcode.toLowerCase())) {
          uniqueExtrasMap.set(s.barcode.toLowerCase(), s);
        }
      });
      uniqueExtrasMap.forEach((scan) => {
        const time = scan ? `${formatDateStr(scan.timestamp)} ${formatTimeStr(scan.timestamp)}` : '-';
        const escapedCode = `"${scan.barcode.replace(/"/g, '""')}"`;
        csvContent += `${escapedName},SOBRA DE ESTOQUE,${escapedCode},"Item não constava na lista esperada","Sobra de Estoque",${time}\n`;
      });
  }

  downloadCsv(csvContent, `relatorio_auditoria_${batch.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${Date.now()}.csv`);
};

export const exportMultipleBatchesToCsv = (selectedBatches: Batch[], allItems: ScanItem[]) => {
  let csvContent = 'Lote,Tipo Lote,Status Item,Index,Formato/Categoria,Código/Patrimônio,Descrição,Data,Hora\n';
  let globalIndex = 1;

  selectedBatches.forEach((batch) => {
    const escapedBatchName = `"${batch.name.replace(/"/g, '""')}"`;

    if (batch.type === 'VERIFICATION') {
      const expected = getExpectedItemsForBatch(batch.id);
      const batchScans = allItems.filter((i) => i.batchId === batch.id);

      // Expected items
      expected.forEach((item) => {
        const status = item.isFound ? 'ENCONTRADO' : 'FALTANTE';
        const date = item.timestampFound ? formatDateStr(item.timestampFound) : '-';
        const time = item.timestampFound ? formatTimeStr(item.timestampFound) : '-';
        const desc = item.description ? `"${item.description.replace(/"/g, '""')}"` : 'N/A';
        const cat = item.category ? `"${item.category.replace(/"/g, '""')}"` : 'Auditoria';
        const escapedCode = `"${item.barcode.replace(/"/g, '""')}"`;

        csvContent += `${escapedBatchName},Auditoria,${status},${globalIndex++},${cat},${escapedCode},${desc},${date},${time}\n`;
      });

      // Extra items (Sobras)
      const expectedBarcodes = new Set(expected.map((e) => e.barcode.toLowerCase()));
      const extraScans = batchScans.filter((s) => !expectedBarcodes.has(s.barcode.toLowerCase()));
      const uniqueExtrasMap = new Map<string, ScanItem>();
      extraScans.forEach((s) => {
        if (!uniqueExtrasMap.has(s.barcode.toLowerCase())) {
          uniqueExtrasMap.set(s.barcode.toLowerCase(), s);
        }
      });

      uniqueExtrasMap.forEach((scan) => {
        const date = formatDateStr(scan.timestamp);
        const time = formatTimeStr(scan.timestamp);
        const escapedCode = `"${scan.barcode.replace(/"/g, '""')}"`;

        csvContent += `${escapedBatchName},Auditoria,SOBRA DE ESTOQUE,${globalIndex++},"Sobra de Estoque",${escapedCode},"Item não constava na lista esperada",${date},${time}\n`;
      });
    } else {
      // Collection batch
      const batchItems = allItems.filter((item) => item.batchId === batch.id);
      batchItems.forEach((item) => {
        const date = formatDateStr(item.timestamp);
        const time = formatTimeStr(item.timestamp);
        const escapedCode = `"${item.barcode.replace(/"/g, '""')}"`;
        const fmt = `"${item.format}"`;

        csvContent += `${escapedBatchName},Coleta,COLETADO,${globalIndex++},${fmt},${escapedCode},"Coleta Rápida",${date},${time}\n`;
      });
    }
  });

  downloadCsv(csvContent, `relatorio_lotes_multiplos_${Date.now()}.csv`);
};

const downloadCsv = async (csvContent: string, filename: string) => {
  const contentWithBOM = '\uFEFF' + csvContent;
  const blob = new Blob([contentWithBOM], { type: 'text/csv;charset=utf-8;' });
  const file = new File([blob], filename, { type: 'text/csv;charset=utf-8;' });

  // Try Web Share API first if supported (Android, Mobile devices, Chrome Web Share)
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: filename,
        text: `Relatório exportado do aplicativo: ${filename}`,
      });
      return;
    } catch (err) {
      console.log('Share dismissed, proceeding to direct download:', err);
    }
  }

  // Fallback to standard browser download trigger
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// Settings API
export interface AssetRecord {
  id: string;
  barcode: string;
  description: string;
  category: string;
  batchId: number;
  batchName: string;
  batchType: BatchType;
  status: 'ENCONTRADO' | 'PENDENTE' | 'SOBRA' | 'COLETADO';
  timestamp?: number;
}

export const getAllAssetRecords = (): AssetRecord[] => {
  const batches = getStoredBatches();
  const batchMap = new Map(batches.map(b => [b.id, b]));

  const expectedItems = getStoredExpectedItems();
  const scanItems = getStoredScanItems();

  const records: AssetRecord[] = [];

  // 1. Process expected items (Verification batches)
  expectedItems.forEach(exp => {
    const batch = batchMap.get(exp.batchId);
    records.push({
      id: `exp-${exp.id}`,
      barcode: exp.barcode,
      description: exp.description || 'Patrimônio de Auditoria',
      category: exp.category || 'Geral',
      batchId: exp.batchId,
      batchName: batch ? batch.name : `Lote #${exp.batchId}`,
      batchType: 'VERIFICATION',
      status: exp.isFound ? 'ENCONTRADO' : 'PENDENTE',
      timestamp: exp.timestampFound,
    });
  });

  // 2. Process scan items for Extra (sobras) or Collection batches
  scanItems.forEach(scan => {
    const batch = batchMap.get(scan.batchId);
    const batchType = batch ? batch.type : 'COLLECTION';

    if (batchType === 'COLLECTION') {
      records.push({
        id: `scan-${scan.id}`,
        barcode: scan.barcode,
        description: 'Item Coletado',
        category: 'Coleta Directa',
        batchId: scan.batchId,
        batchName: batch ? batch.name : `Lote #${scan.batchId}`,
        batchType: 'COLLECTION',
        status: 'COLETADO',
        timestamp: scan.timestamp,
      });
    } else {
      // Check if this scan was an extra (sobra) in verification batch
      const matchedExpected = expectedItems.find(
        e => e.batchId === scan.batchId && e.barcode.toLowerCase() === scan.barcode.toLowerCase()
      );
      if (!matchedExpected) {
        records.push({
          id: `extra-${scan.id}`,
          barcode: scan.barcode,
          description: 'Sobra de Estoque / Não cadastrado',
          category: 'Extra',
          batchId: scan.batchId,
          batchName: batch ? batch.name : `Lote #${scan.batchId}`,
          batchType: 'VERIFICATION',
          status: 'SOBRA',
          timestamp: scan.timestamp,
        });
      }
    }
  });

  return records;
};

// Close/Conclude Batch
export const closeBatch = (batchId: number, reason?: string) => {
  const batches = getStoredBatches();
  const updated = batches.map((b) => {
    if (b.id === batchId) {
      return {
        ...b,
        isClosed: true,
        closedReason: reason?.trim() || 'Concluído manualmente',
        closedAt: Date.now(),
      };
    }
    return b;
  });
  saveBatches(updated);
  addAuditLog(batchId, 'BATCH_CLOSED', undefined, `Lote encerrado: ${reason?.trim() || 'Concluído manualmente'}`);
};

export const reopenBatch = (batchId: number) => {
  const batches = getStoredBatches();
  const updated = batches.map((b) => {
    if (b.id === batchId) {
      return {
        ...b,
        isClosed: false,
        closedReason: undefined,
        closedAt: undefined,
      };
    }
    return b;
  });
  saveBatches(updated);
  addAuditLog(batchId, 'BATCH_OPENED', undefined, 'Lote reaberto para conferência');
};

export const consumeDeletePermissionOnce = () => {
  const settings = getStoredSettings();
  if (settings.deletePermission === 'ONCE') {
    const updated = { ...settings, deletePermission: 'LOCKED' as const };
    saveSettings(updated);
    return true;
  }
  return false;
};

export const getStoredSettings = (): AppSettings => {
  try {
    const data = localStorage.getItem(SETTINGS_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      return {
        deletePermission: 'LOCKED',
        barcodePatterns: [],
        ...parsed,
      };
    }
  } catch (e) {
    console.error('Failed to get settings', e);
  }
  return {
    soundEnabled: true,
    vibrationEnabled: true,
    continuousScan: true,
    scanBeep: true,
    cameraResolution: '1080p',
    autoRemoveDuplicates: true,
    theme: 'dark',
    deletePermission: 'LOCKED',
    barcodePatterns: [],
  };
};

export const saveSettings = (settings: AppSettings) => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

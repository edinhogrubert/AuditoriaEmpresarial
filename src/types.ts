export type BatchType = 'COLLECTION' | 'VERIFICATION';

export interface Batch {
  id: number;
  name: string;
  description: string;
  type: BatchType;
  timestamp: number;
  isClosed?: boolean;
  closedReason?: string;
  closedAt?: number;
}

export interface ScanItem {
  id: number;
  batchId: number;
  barcode: string;
  format: string;
  timestamp: number;
}

export interface ExpectedItem {
  id: number;
  batchId: number;
  barcode: string;
  description?: string;
  category?: string;
  isFound: boolean;
  timestampFound?: number;
}

export type Screen =
  | 'menu'
  | 'scan'
  | 'sequential_scan'
  | 'batch_list'
  | 'general_reports'
  | 'assets_list'
  | 'new_batch'
  | 'batch_scan'
  | 'batch_details'
  | 'import_inventory'
  | 'qr_import'
  | 'verification_scan'
  | 'audit_results'
  | 'audit_log'
  | 'export_batches'
  | 'settings';

export type DeletePermission = 'LOCKED' | 'ONCE' | 'ALWAYS';

export interface BarcodePattern {
  id: string;
  format: string;    // e.g., 'EAN_13', 'CODE_128', 'CODE_39', 'UPC_A', 'ANY'
  prefix?: string;   // e.g., 'PAT-'
  length?: number;   // e.g., 13
}

export type AuditLogType =
  | 'DUPLICATE_BLOCK'
  | 'ITEM_REMOVED'
  | 'MANUAL_ENTRY'
  | 'IMPORT_START'
  | 'BATCH_CLOSED'
  | 'BATCH_OPENED'
  | 'AUDIT_RECONCILED';

export interface AuditLog {
  id: number;
  batchId: number;
  timestamp: number;
  type: AuditLogType;
  barcode?: string;
  message: string;
}

export interface AppSettings {
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  continuousScan: boolean;
  scanBeep: boolean;
  cameraResolution: string;
  autoRemoveDuplicates: boolean;
  theme: 'light' | 'dark';
  deletePermission: DeletePermission;
  barcodePatterns?: BarcodePattern[];
}


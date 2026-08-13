import React, { useState, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  Share2,
  Package,
  Calendar,
  Clock,
  QrCode,
  Download,
  Trash2,
  BarChart3,
  FilePlus2,
  ScanLine,
  Keyboard,
  X,
  CheckCircle2,
  RotateCcw,
  RefreshCw,
  Check,
  ChevronRight,
  Search,
  AlertTriangle,
  FileJson,
  FolderSync,
  CloudUpload,
} from 'lucide-react';
import { QrCodeExportModal } from './QrCodeExportModal';
import { CloudSyncModal } from './CloudSyncModal';
import { Batch, ScanItem, ExpectedItem } from '../types';
import {
  formatDateStr,
  formatTimeStr,
  exportSingleBatchToCsv,
  getExpectedItemsForBatch,
  clearExpectedItemsForBatch,
  clearScanItemsForBatch,
  processScanItem,
  addExpectedItemsToBatch,
  closeBatch,
  reopenBatch,
  getAuditStatsForBatch,
  reconcileBatchAudit,
  getStoredSettings,
  saveSettings,
  consumeDeletePermissionOnce,
  deleteScanItemAndSync,
  deleteItemFromBatch,
  getScanItemsForBatch,
  getUniqueCategories,
  getUniqueDescriptions,
  addMultipleScanItems,
} from '../services/storage';
import { CloseBatchModal } from './CloseBatchModal';
import { DeletePermissionModal } from './DeletePermissionModal';

interface BatchDetailsScreenProps {
  batch: Batch;
  scanItems: ScanItem[];
  onBack: () => void;
  onDone: () => void;
  onContinueScanning: () => void;
  onImportMore: () => void;
  onViewResults?: (tab?: 'all' | 'found' | 'missing' | 'extra') => void;
  onRefresh: () => void;
  onDeleteItem?: (itemId: number) => void;
  onViewAuditLog?: () => void;
}

export const BatchDetailsScreen: React.FC<BatchDetailsScreenProps> = ({
  batch,
  scanItems,
  onBack,
  onDone,
  onContinueScanning,
  onImportMore,
  onViewResults,
  onRefresh,
  onDeleteItem,
  onViewAuditLog,
}) => {
  const [manualMasterOpen, setManualMasterOpen] = useState(false);
  const [manualScanOpen, setManualScanOpen] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualCategory, setManualCategory] = useState('');
  const [scanInputMode, setScanInputMode] = useState<'single' | 'paste' | 'csv'>('single');
  const [scanPastedText, setScanPastedText] = useState('');
  const scanFileInputRef = useRef<HTMLInputElement>(null);

  const existingCategories = getUniqueCategories();
  const existingNames = getUniqueDescriptions();

  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [reopenModalOpen, setReopenModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [pendingDeleteItem, setPendingDeleteItem] = useState<{
    barcode: string;
    scanId?: number;
    expectedItemId?: number;
  } | null>(null);

  const expectedItems = getExpectedItemsForBatch(batch.id);
  const stats = getAuditStatsForBatch(batch.id);
  const totalCount = batch.type === 'VERIFICATION' ? expectedItems.length : scanItems.length;

  const appSettings = getStoredSettings();
  const deletePermission = appSettings.deletePermission;

  const [itemFilter, setItemFilter] = useState<'ALL' | 'FOUND' | 'MISSING' | 'EXTRA'>('ALL');
  const [recordSearch, setRecordSearch] = useState('');
  const [reconciledNotice, setReconciledNotice] = useState<string | null>(null);

  const handleReconcile = () => {
    const updatedStats = reconcileBatchAudit(batch.id);
    setReconciledNotice(`Lógica de auditoria sincronizada: ${updatedStats.foundCount} OK, ${updatedStats.missingCount} Ausentes, ${updatedStats.extraCount} Extras.`);
    setTimeout(() => setReconciledNotice(null), 4500);
    onRefresh();
  };

  // Extra scans (scans not present in expected list) for VERIFICATION batches
  const extraScans = useMemo(() => {
    if (batch.type !== 'VERIFICATION') return [];
    const expectedBarcodes = new Set(expectedItems.map((e) => e.barcode.toLowerCase()));
    return scanItems.filter((s) => !expectedBarcodes.has(s.barcode.toLowerCase()));
  }, [batch.type, expectedItems, scanItems]);

  // Filtered records list for bottom section
  const filteredRecords = useMemo(() => {
    if (batch.type !== 'VERIFICATION') {
      return scanItems
        .filter((s) => s.barcode.toLowerCase().includes(recordSearch.toLowerCase()))
        .slice()
        .reverse()
        .map((s) => ({
          type: 'SCAN' as const,
          id: `scan-${s.id}`,
          barcode: s.barcode,
          description: `Format: ${s.format}`,
          isFound: true,
          scanId: s.id,
          expectedItemId: undefined,
        }));
    }

    let items: Array<{
      type: 'EXPECTED' | 'EXTRA';
      id: string;
      barcode: string;
      description?: string;
      isFound: boolean;
      scanId?: number;
      expectedItemId?: number;
    }> = [];

    if (itemFilter === 'ALL' || itemFilter === 'FOUND' || itemFilter === 'MISSING') {
      expectedItems.forEach((exp) => {
        const matchedScan = scanItems.find(
          (s) => s.barcode.toLowerCase() === exp.barcode.toLowerCase()
        );
        if (itemFilter === 'FOUND' && !exp.isFound) return;
        if (itemFilter === 'MISSING' && exp.isFound) return;

        items.push({
          type: 'EXPECTED',
          id: `exp-${exp.id}`,
          barcode: exp.barcode,
          description: exp.description || 'Patrimônio Cadastrado',
          isFound: exp.isFound,
          scanId: matchedScan?.id,
          expectedItemId: exp.id,
        });
      });
    }

    if (itemFilter === 'ALL' || itemFilter === 'EXTRA') {
      extraScans.forEach((ext) => {
        items.push({
          type: 'EXTRA',
          id: `ext-${ext.id}`,
          barcode: ext.barcode,
          description: 'Sobra / Não Esperado',
          isFound: true,
          scanId: ext.id,
        });
      });
    }

    if (recordSearch) {
      const query = recordSearch.toLowerCase();
      items = items.filter(
        (i) =>
          i.barcode.toLowerCase().includes(query) ||
          (i.description && i.description.toLowerCase().includes(query))
      );
    }

    return items;
  }, [batch.type, expectedItems, scanItems, extraScans, itemFilter, recordSearch]);

  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [showCloudSync, setShowCloudSync] = useState(false);

  const handleExportCsv = () => {
    exportSingleBatchToCsv(batch, scanItems);
    setExportMenuOpen(false);
  };

  const handleExportJson = () => {
    const payload = {
      batch,
      scans: scanItems,
      expected: expectedItems,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lote_${batch.name.toLowerCase().replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportMenuOpen(false);
  };

  const batchQrPayload = useMemo(() => {
    return {
      batch,
      scans: scanItems,
      expected: expectedItems,
    };
  }, [batch, scanItems, expectedItems]);

  const handleClearMaster = () => {
    if (confirm('ATENÇÃO: Deseja apagar TODOS os itens da lista mestre (o que deve ser procurado)?')) {
      clearExpectedItemsForBatch(batch.id);
      onRefresh();
    }
  };

  const handleClearScans = () => {
    if (confirm('ATENÇÃO: Deseja apagar TODO o histórico de leituras realizadas?')) {
      clearScanItemsForBatch(batch.id);
      onRefresh();
    }
  };

  const handleManualMasterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      addExpectedItemsToBatch(batch.id, [{
        barcode: manualCode.trim(),
        description: manualName.trim() || 'Item de Inventário',
        category: manualCategory.trim() || 'Sem Categoria'
      }]);
      setManualCode('');
      setManualName('');
      setManualCategory('');
      setManualMasterOpen(false);
      onRefresh();
    }
  };

  const handleManualScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      processScanItem(batch.id, manualCode.trim(), 'MANUAL');
      setManualCode('');
      setManualScanOpen(false);
      onRefresh();
    }
  };

  const handleScanPasteSubmit = () => {
    const lines = scanPastedText.split(/\r?\n|,/).map(l => l.trim()).filter(Boolean);
    if (lines.length > 0) {
      addMultipleScanItems(batch.id, lines, 'PASTE');
      setScanPastedText('');
      setManualScanOpen(false);
      setScanInputMode('single');
      onRefresh();
    }
  };

  const handleScanFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (lines.length === 0) return;

        let startIdx = 0;
        const firstLineLower = lines[0].toLowerCase();
        if (firstLineLower.includes('codigo') || firstLineLower.includes('patrimonio') || firstLineLower.includes('barcode')) {
          startIdx = 1;
        }

        const barcodes: string[] = [];
        for (let i = startIdx; i < lines.length; i++) {
          const line = lines[i];
          const parts = line.split(/[,\t;]/).map(p => p.trim().replace(/^["']|["']$/g, ''));
          let bc = parts[0];
          if (parts.length >= 2 && /^\d+$/.test(parts[0]) && !/^\d{4,}$/.test(parts[0])) {
            bc = parts[1];
          }
          if (bc) barcodes.push(bc);
        }

        if (barcodes.length > 0) {
          addMultipleScanItems(batch.id, barcodes, 'CSV_IMPORT');
          setManualScanOpen(false);
          setScanInputMode('single');
          onRefresh();
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmCloseBatch = (reason: string) => {
    closeBatch(batch.id, reason);
    setCloseModalOpen(false);
    onRefresh();
  };

  const handleConfirmReopenBatch = () => {
    reopenBatch(batch.id);
    setReopenModalOpen(false);
    onRefresh();
  };

  // Trash button handler for individual items (found, missing, extra, collection)
  const handleDeleteItemClick = (barcode: string, scanId?: number, expectedItemId?: number) => {
    setPendingDeleteItem({ barcode, scanId, expectedItemId });
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (pendingDeleteItem) {
      const currentPermission = getStoredSettings().deletePermission;
      deleteItemFromBatch(batch.id, pendingDeleteItem.barcode, pendingDeleteItem.scanId, pendingDeleteItem.expectedItemId);
      if (currentPermission === 'ONCE') {
        consumeDeletePermissionOnce();
      }
      setPendingDeleteItem(null);
      setDeleteModalOpen(false);
      onRefresh();
    }
  };

  const handleConfirmDeleteOnce = () => {
    if (pendingDeleteItem) {
      deleteItemFromBatch(batch.id, pendingDeleteItem.barcode, pendingDeleteItem.scanId, pendingDeleteItem.expectedItemId);
      consumeDeletePermissionOnce();
      setPendingDeleteItem(null);
      setDeleteModalOpen(false);
      onRefresh();
    }
  };

  const handleConfirmDeleteAlways = () => {
    setPendingDeleteItem(null);
    setDeleteModalOpen(false);
  };

  return (
    <div className="min-h-screen text-[var(--text-primary)] bg-[var(--bg-primary)] flex flex-col max-w-md mx-auto p-5 select-none relative pb-12 border-x border-[var(--border-color)]">
      {/* Top Bar */}
      <div className="flex items-center justify-between pb-6 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2.5 rounded-full bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-color)] active:scale-95 transition-all shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-black text-[var(--text-primary)] truncate max-w-[200px] uppercase tracking-tight">
            {batch.name}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCloudSync(true)}
            className="px-2.5 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20 active:scale-95 transition-all text-xs font-bold uppercase flex items-center gap-1.5 shadow-xs"
            title="Carga & Descarga Cloud Firebase"
          >
            <FolderSync className="w-4 h-4" />
            <span className="hidden sm:inline">Nuvem</span>
          </button>
          {onViewAuditLog && (
            <button
              onClick={onViewAuditLog}
              className="px-3 py-2 rounded-xl bg-[var(--bg-secondary)] text-[var(--color-blue)] border border-[var(--border-color)] hover:bg-[var(--bg-primary)] active:scale-95 transition-all text-xs font-bold uppercase flex items-center gap-1.5 shadow-xs"
              title="Histórico de Eventos / Log de Auditoria"
            >
              <Clock className="w-4 h-4" />
              <span>Histórico</span>
            </button>
          )}
          <button
            onClick={() => setExportMenuOpen(true)}
            className="p-2.5 rounded-full bg-[var(--color-emerald)]/10 text-[var(--color-emerald)] border border-[var(--color-emerald)]/20 hover:bg-[var(--color-emerald)]/20 active:scale-95 transition-all shadow-sm"
            title="Opções de Exportação / Compartilhamento"
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="py-4 space-y-4 flex-1 overflow-hidden flex flex-col">
        {/* Closed Banner if already concluded */}
        {batch.isClosed && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-2xl flex items-center justify-between gap-3 shrink-0 shadow-sm animate-in fade-in">
            <div className="space-y-0.5 min-w-0">
              <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Auditoria Concluída
              </span>
              <p className="text-xs font-bold text-[var(--text-primary)] truncate">
                {batch.closedReason || 'Finalizada manualmente'}
              </p>
              {batch.closedAt && (
                <p className="text-[10px] text-[var(--text-dim)] font-medium">
                  Concluída em {formatDateStr(batch.closedAt)}
                </p>
              )}
            </div>
            <button
              onClick={() => setReopenModalOpen(true)}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shrink-0 transition-all active:scale-95 shadow-sm flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              REABRIR
            </button>
          </div>
        )}

        {/* Detail Header Cards (Ativos, Data/Hora) + RELATÓRIO Button (Maior) */}
        <div className="grid grid-cols-8 gap-2.5 items-stretch shrink-0">
          {/* Card 1: Ativos */}
          <div className="col-span-2 card-elevated p-3 flex flex-col justify-between shadow-xs">
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 mb-1">
              <Package className="w-4 h-4 shrink-0" />
              <span className="text-[10px] text-[var(--text-dim)] font-bold uppercase tracking-wider truncate">Ativos</span>
            </div>
            <span className="text-base font-extrabold text-[var(--text-primary)] leading-tight">{totalCount}</span>
          </div>

          {/* Card 2: Data / Hora (Combinados) */}
          <div className="col-span-3 card-elevated p-3 flex flex-col justify-between shadow-xs min-w-0">
            <div className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400 mb-1">
              <Calendar className="w-4 h-4 shrink-0" />
              <span className="text-[10px] text-[var(--text-dim)] font-bold uppercase tracking-wider truncate">Data / Hora</span>
            </div>
            <div className="truncate">
              <span className="text-xs font-extrabold text-[var(--text-primary)] leading-tight block truncate">
                {formatDateStr(batch.timestamp)}
              </span>
              <span className="text-[10px] font-semibold text-[var(--text-secondary)] leading-none block mt-0.5 truncate">
                {formatTimeStr(batch.timestamp).slice(0, 5)} h
              </span>
            </div>
          </div>

          {/* Button: RELATÓRIO (Maior que os outros dois) */}
          <button
            onClick={() => onViewResults?.('all')}
            className="col-span-3 bg-[#002b59] hover:bg-[#0f3d73] text-white rounded-2xl flex flex-col items-center justify-center gap-1 shadow-md transition-all active:scale-95 font-bold p-3"
            title="Ver Relatório e Estatísticas"
          >
            <BarChart3 className="w-5 h-5 text-sky-300" />
            <span className="text-[11px] font-black uppercase tracking-wider">Relatório</span>
          </button>
        </div>

        {/* Action Matrix */}
        <div className="space-y-3 shrink-0">
          {/* Row 1: Master List Actions */}
          <div className="flex gap-2 h-14">
            <button
              onClick={onImportMore}
              className="flex-[3.5] bg-[#002b59] hover:bg-[#0f3d73] text-white rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center gap-2.5 px-4 transition-all active:scale-95 shadow-md"
            >
              <FilePlus2 className="w-5 h-5 shrink-0 text-sky-300" />
              <span className="leading-tight text-left">Importar Patrimônios</span>
            </button>
            <button
              onClick={() => setManualMasterOpen(true)}
              className="flex-1 card-elevated hover:bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 shadow-xs border border-[var(--border-color)]"
            >
              <Keyboard className="w-4 h-4 text-[var(--text-secondary)]" />
              <span className="text-[9px] font-bold uppercase tracking-tight">Manual</span>
            </button>
            <button
              onClick={handleClearMaster}
              className="w-16 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 shadow-xs"
            >
              <Trash2 className="w-4 h-4" />
              <span className="text-[9px] font-bold uppercase tracking-tight">Limpar</span>
            </button>
          </div>

          {/* Row 2: Scanning Actions */}
          <div className="flex gap-2 h-14">
            <button
              onClick={onContinueScanning}
              className="flex-[3.5] bg-[#059669] hover:bg-[#047857] text-white rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center gap-2.5 px-4 transition-all active:scale-95 shadow-md"
            >
              <ScanLine className="w-5 h-5 shrink-0 text-emerald-200" />
              <span className="leading-tight text-left">Ler Códigos (Câmera)</span>
            </button>
            <button
              onClick={() => setManualScanOpen(true)}
              className="flex-1 card-elevated hover:bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 shadow-xs border border-[var(--border-color)]"
            >
              <Keyboard className="w-4 h-4 text-[var(--text-secondary)]" />
              <span className="text-[9px] font-bold uppercase tracking-tight">Manual</span>
            </button>
            <button
              onClick={handleClearScans}
              className="w-16 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 shadow-xs"
            >
              <Trash2 className="w-4 h-4" />
              <span className="text-[9px] font-bold uppercase tracking-tight">Limpar</span>
            </button>
          </div>
        </div>

        {/* Secondary Actions */}
        <div className="flex gap-2.5 pt-1 shrink-0">
          <button onClick={() => setExportMenuOpen(true)} className="flex-1 h-12 bg-[#0284c7] hover:bg-[#0369a1] text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 rounded-2xl transition-all active:scale-95 shadow-md">
            <Download className="w-4 h-4 text-sky-200" />
            Exportar Lote
          </button>
          
          {batch.type === 'VERIFICATION' && !batch.isClosed ? (
            <button
              onClick={() => setCloseModalOpen(true)}
              className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500/30 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all active:scale-95 shadow-md flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-200" />
              FINALIZAR
            </button>
          ) : batch.type === 'VERIFICATION' && batch.isClosed ? (
            <button
              onClick={() => setReopenModalOpen(true)}
              className="flex-1 h-12 bg-amber-600 hover:bg-amber-500 text-white border border-amber-500/30 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all active:scale-95 shadow-md flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-4 h-4 text-amber-200" />
              REABRIR
            </button>
          ) : (
            <button onClick={onDone} className="flex-1 h-12 bg-[var(--bg-secondary)] hover:bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-2xl font-bold text-xs uppercase tracking-wider transition-all active:scale-95 shadow-xs">
              Concluir
            </button>
          )}
        </div>

        {/* Visual Audit Summary & Metric Distribution Section (Replacing Item Rows) */}
        <div className="card-elevated p-4 rounded-2xl border border-[var(--border-color)] shadow-xs space-y-4 flex-1 overflow-y-auto custom-scrollbar flex flex-col justify-between">
          <div className="space-y-4">
            {/* Top Card Header & Accuracy Badge & Reconcile Button */}
            <div className="flex items-center justify-between gap-2 border-b border-[var(--border-color)] pb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-sky-500 shrink-0" />
                <h2 className="text-xs font-black uppercase tracking-tight text-[var(--text-primary)]">
                  Resumo da Auditoria
                </h2>
                {stats.totalExpected > 0 && (
                  <span className="text-[10px] font-extrabold text-sky-600 dark:text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20">
                    {stats.progressPercent}% Acurácia
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleReconcile}
                  className="px-2.5 py-1 bg-[#002b59] hover:bg-[#0f3d73] text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 shadow-xs flex items-center gap-1"
                  title="Refazer a leitura e conciliação da lógica do negócio"
                >
                  <RefreshCw className="w-3 h-3 text-sky-300" />
                  <span>Recalcular Lógica</span>
                </button>
                <button
                  onClick={() => onViewResults?.('all')}
                  className="flex items-center gap-0.5 text-[11px] font-black text-sky-600 dark:text-sky-400 uppercase tracking-wider hover:underline"
                >
                  <span>Relatório</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {reconciledNotice && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold p-2.5 rounded-xl text-center animate-in fade-in">
                {reconciledNotice}
              </div>
            )}

            {/* Dual-Column Paper Summary Grid: Importados vs Lidos */}
            <div className="grid grid-cols-3 gap-2 text-center pb-1">
              <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] p-2 rounded-xl">
                <span className="text-[9px] font-black text-sky-500 dark:text-sky-400 uppercase tracking-wider block">Importados</span>
                <span className="text-base font-extrabold text-[var(--text-primary)] font-mono">{stats.totalExpected}</span>
              </div>
              <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] p-2 rounded-xl">
                <span className="text-[9px] font-black text-amber-500 dark:text-amber-400 uppercase tracking-wider block">Lidos (Câmera)</span>
                <span className="text-base font-extrabold text-[var(--text-primary)] font-mono">{stats.scannedCount}</span>
              </div>
              <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] p-2 rounded-xl">
                <span className="text-[9px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-wider block">Todos (Únicos)</span>
                <span className="text-base font-extrabold text-[var(--text-primary)] font-mono">{stats.combinedTotal}</span>
              </div>
            </div>

            {/* Top Overall Progress Bar (Ok / Falta / Extra Segmented Bar) */}
            {stats.totalExpected > 0 && (
              <div className="space-y-1.5">
                <div className="w-full bg-[var(--bg-primary)] h-3 rounded-full overflow-hidden flex border border-[var(--border-color)] p-0.5">
                  {stats.foundCount > 0 && (
                    <div
                      style={{ width: `${(stats.foundCount / Math.max(1, stats.totalExpected + stats.extraCount)) * 100}%` }}
                      className="bg-emerald-500 h-full rounded-l-full transition-all duration-500"
                      title={`Ok: ${stats.foundCount}`}
                    />
                  )}
                  {stats.missingCount > 0 && (
                    <div
                      style={{ width: `${(stats.missingCount / Math.max(1, stats.totalExpected + stats.extraCount)) * 100}%` }}
                      className="bg-red-500 h-full transition-all duration-500"
                      title={`Falta: ${stats.missingCount}`}
                    />
                  )}
                  {stats.extraCount > 0 && (
                    <div
                      style={{ width: `${(stats.extraCount / Math.max(1, stats.totalExpected + stats.extraCount)) * 100}%` }}
                      className="bg-amber-500 h-full rounded-r-full transition-all duration-500"
                      title={`Extra: ${stats.extraCount}`}
                    />
                  )}
                </div>
                <div className="flex justify-between items-center text-[10px] text-[var(--text-dim)] font-extrabold px-1">
                  <span className="text-emerald-600 dark:text-emerald-400">🟢 {stats.foundCount} Ok</span>
                  <span className="text-red-500">🔴 {stats.missingCount} Falta</span>
                  <span className="text-amber-500">🟠 {stats.extraCount} Extra</span>
                </div>
              </div>
            )}

            {/* 4 Stacked Rows Layout Matching Mockup Diagram */}
            <div className="space-y-3 pt-1">
              {/* Row 1: TODOS */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => onViewResults?.('all')}
                  className="w-20 h-14 bg-[#002b59] hover:bg-[#0f3d73] text-white border border-sky-500/30 rounded-xl flex flex-col items-center justify-center shrink-0 transition-all active:scale-95 shadow-sm"
                >
                  <span className="text-[9px] font-black uppercase text-sky-300 tracking-wider">Todos</span>
                  <span className="text-base font-black mt-0.5 leading-none">
                    {stats.totalExpected > 0 ? stats.totalExpected : scanItems.length}
                  </span>
                </button>
                <div className="flex-1 space-y-1.5">
                  <div className="w-full bg-[var(--bg-primary)] h-4 rounded-lg overflow-hidden border border-[var(--border-color)] p-0.5 relative flex items-center">
                    <div className="bg-sky-500 h-full w-full rounded-md transition-all duration-500" />
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold text-[var(--text-secondary)] px-0.5">
                    <span>{stats.totalExpected > 0 ? 'Ativos Esperados na Mestre' : 'Total de Leituras Coletadas'}</span>
                    <span className="font-mono-code text-[var(--text-primary)]">
                      {stats.totalExpected > 0 ? stats.totalExpected : scanItems.length}
                    </span>
                  </div>
                </div>
              </div>

              {/* Row 2: OK */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => onViewResults?.('found')}
                  className="w-20 h-14 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 rounded-xl flex flex-col items-center justify-center shrink-0 transition-all active:scale-95 shadow-sm"
                >
                  <span className="text-[9px] font-black uppercase tracking-wider">OK</span>
                  <span className="text-base font-black mt-0.5 leading-none">
                    {stats.foundCount}
                  </span>
                </button>
                <div className="flex-1 space-y-1.5">
                  <div className="w-full bg-[var(--bg-primary)] h-4 rounded-lg overflow-hidden border border-[var(--border-color)] p-0.5 relative flex items-center">
                    <div
                      className="bg-emerald-500 h-full rounded-md transition-all duration-500"
                      style={{
                        width: `${
                          stats.totalExpected > 0
                            ? Math.min(100, (stats.foundCount / Math.max(1, stats.totalExpected)) * 100)
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold text-emerald-600 dark:text-emerald-400 px-0.5">
                    <span>🟢 {stats.foundCount} Localizados</span>
                    <span className="font-mono-code">
                      {stats.totalExpected > 0
                        ? `${Math.round((stats.foundCount / Math.max(1, stats.totalExpected)) * 100)}%`
                        : '0%'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Row 3: FALTA */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => onViewResults?.('missing')}
                  className="w-20 h-14 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 rounded-xl flex flex-col items-center justify-center shrink-0 transition-all active:scale-95 shadow-sm"
                >
                  <span className="text-[9px] font-black uppercase tracking-wider">Falta</span>
                  <span className="text-base font-black mt-0.5 leading-none">
                    {stats.missingCount}
                  </span>
                </button>
                <div className="flex-1 space-y-1.5">
                  <div className="w-full bg-[var(--bg-primary)] h-4 rounded-lg overflow-hidden border border-[var(--border-color)] p-0.5 relative flex items-center">
                    <div
                      className="bg-red-500 h-full rounded-md transition-all duration-500"
                      style={{
                        width: `${
                          stats.totalExpected > 0
                            ? Math.min(100, (stats.missingCount / Math.max(1, stats.totalExpected)) * 100)
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold text-red-600 dark:text-red-400 px-0.5">
                    <span>🔴 {stats.missingCount} Ausentes</span>
                    <span className="font-mono-code">
                      {stats.totalExpected > 0
                        ? `${Math.round((stats.missingCount / Math.max(1, stats.totalExpected)) * 100)}%`
                        : '0%'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Row 4: EXTRA */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => onViewResults?.('extra')}
                  className="w-20 h-14 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 rounded-xl flex flex-col items-center justify-center shrink-0 transition-all active:scale-95 shadow-sm"
                >
                  <span className="text-[9px] font-black uppercase tracking-wider">Extra</span>
                  <span className="text-base font-black mt-0.5 leading-none">
                    {stats.totalExpected > 0 ? stats.extraCount : scanItems.length}
                  </span>
                </button>
                <div className="flex-1 space-y-1.5">
                  <div className="w-full bg-[var(--bg-primary)] h-4 rounded-lg overflow-hidden border border-[var(--border-color)] p-0.5 relative flex items-center">
                    <div
                      className="bg-amber-500 h-full rounded-md transition-all duration-500"
                      style={{
                        width: `${
                          stats.totalExpected > 0
                            ? Math.min(100, (stats.extraCount / Math.max(1, stats.totalExpected)) * 100)
                            : (scanItems.length > 0 ? 100 : 0)
                        }%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold text-amber-600 dark:text-amber-400 px-0.5">
                    <span>🟠 {stats.totalExpected > 0 ? stats.extraCount : scanItems.length} Sobras Encontradas</span>
                    <span className="font-mono-code">
                      {stats.totalExpected > 0
                        ? `${Math.round((stats.extraCount / stats.totalExpected) * 100)}%`
                        : (scanItems.length > 0 ? '100%' : '0%')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Card ("Alguma outra coisa nesse espaço" -> Executive Diagnostic Card) */}
          <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] p-3.5 rounded-xl space-y-2.5 mt-2 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] flex items-center gap-1.5">
                💡 Diagnóstico de Auditoria
              </span>
              <span className="text-[9px] font-bold text-[var(--text-dim)] uppercase">
                Lote #{batch.id}
              </span>
            </div>

            <p className="text-xs font-semibold text-[var(--text-primary)] leading-relaxed">
              {batch.type === 'VERIFICATION' ? (
                stats.missingCount > 0 ? (
                  <>
                    Atenção: <strong className="text-red-500">{stats.missingCount} patrimônios</strong> pendentes de conciliação neste setor. Clique no relatório para auditar os itens um a um.
                  </>
                ) : (
                  <>
                    Parabéns! <strong className="text-emerald-500">100% dos patrimônios</strong> cadastrados foram devidamente localizados e checados.
                  </>
                )
              ) : (
                <>Foram registradas {scanItems.length} leituras neste lote de conferência rápida.</>
              )}
            </p>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => onViewResults?.('all')}
                className="flex-1 py-2 bg-[#002b59] hover:bg-[#0f3d73] text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all active:scale-95 shadow-xs flex items-center justify-center gap-1.5"
              >
                <BarChart3 className="w-3.5 h-3.5 text-sky-300" />
                <span>Ver Dossiê e Itens</span>
              </button>
              <button
                onClick={() => setExportMenuOpen(true)}
                className="py-2 px-3 bg-[var(--bg-secondary)] hover:bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-color)] text-[10px] font-extrabold uppercase tracking-wider rounded-xl transition-all active:scale-95 shadow-xs flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5 text-sky-500" />
                <span>Exportar</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Manual Input Modals */}
      {(manualMasterOpen || manualScanOpen) && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[2.5rem] p-7 w-full max-w-md space-y-5 shadow-[0_30px_70px_-10px_rgba(0,0,0,0.8)]">
            <div className="flex items-center justify-between">
               <h3 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
                 {manualMasterOpen ? 'Adicionar Item' : 'Inserir Leituras (Campo)'}
               </h3>
               <button type="button" onClick={() => { setManualMasterOpen(false); setManualScanOpen(false); setManualCode(''); setManualName(''); setManualCategory(''); setScanInputMode('single'); setScanPastedText(''); }} className="p-2 text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors">
                  <X className="w-6 h-6" />
               </button>
            </div>

            {manualScanOpen && !manualMasterOpen && (
              <div className="flex gap-1 bg-[var(--bg-primary)] p-1 rounded-2xl border border-[var(--border-color)]">
                <button
                  type="button"
                  onClick={() => setScanInputMode('single')}
                  className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${scanInputMode === 'single' ? 'bg-[#002b59] text-white shadow-md' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                >
                  Individual
                </button>
                <button
                  type="button"
                  onClick={() => setScanInputMode('paste')}
                  className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${scanInputMode === 'paste' ? 'bg-[#002b59] text-white shadow-md' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                >
                  Copiar & Colar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setScanInputMode('csv');
                    scanFileInputRef.current?.click();
                  }}
                  className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${scanInputMode === 'csv' ? 'bg-[#002b59] text-white shadow-md' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                >
                  CSV / TXT
                </button>
              </div>
            )}

            {manualScanOpen && !manualMasterOpen && scanInputMode === 'paste' ? (
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] block ml-1 mb-1">Cole a lista (um por linha)</label>
                  <textarea
                    rows={8}
                    value={scanPastedText}
                    onChange={(e) => setScanPastedText(e.target.value)}
                    placeholder="PAT-1001&#10;PAT-1002&#10;PAT-1003"
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl p-4 text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-blue)]"
                    autoFocus
                  />
                </div>
                <button
                  type="button"
                  onClick={handleScanPasteSubmit}
                  className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-black rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-95"
                >
                  Processar e Inserir ({scanPastedText.split(/\r?\n|,/).filter(l => l.trim()).length})
                </button>
              </div>
            ) : manualScanOpen && !manualMasterOpen && scanInputMode === 'csv' ? (
              <div className="space-y-4 text-center py-6">
                <input
                  type="file"
                  ref={scanFileInputRef}
                  onChange={handleScanFileUpload}
                  accept=".csv,.txt"
                  className="hidden"
                />
                <p className="text-xs text-[var(--text-secondary)]">Selecione o arquivo CSV ou TXT contendo os patrimônios lidos no setor:</p>
                <button
                  type="button"
                  onClick={() => scanFileInputRef.current?.click()}
                  className="w-full py-4 bg-[#002b59] hover:bg-[#0f3d73] text-white rounded-2xl font-bold text-xs uppercase tracking-wider shadow-md"
                >
                  Selecionar Arquivo CSV / TXT
                </button>
              </div>
            ) : (
              <form
                onSubmit={manualMasterOpen ? handleManualMasterSubmit : handleManualScanSubmit}
                className="space-y-4"
              >
                <div>
                  <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] block ml-1 mb-1">Código de Patrimônio</label>
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="Ex: 2250110"
                    autoFocus
                    className="w-full bg-[var(--bg-primary)] border-2 border-[var(--border-color)] rounded-2xl px-5 py-3.5 text-lg text-[var(--text-primary)] font-mono-code focus:outline-none focus:border-[var(--color-blue)] transition-all shadow-inner"
                  />
                </div>

                {manualMasterOpen && (
                  <>
                    <div>
                      <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.15em] block ml-1 mb-1">Nome Padrão</label>
                      <input
                        type="text"
                        list="manual-names-list"
                        value={manualName}
                        onChange={(e) => setManualName(e.target.value)}
                        placeholder="Ex: Notebook DELL"
                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs font-bold text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-blue)] transition-all"
                      />
                      <datalist id="manual-names-list">
                        {existingNames.map(name => <option key={name} value={name} />)}
                      </datalist>
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.15em] block ml-1 mb-1">Categoria Padrão</label>
                      <input
                        type="text"
                        list="manual-categories-list"
                        value={manualCategory}
                        onChange={(e) => setManualCategory(e.target.value)}
                        placeholder="Ex: TI / Informática"
                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs font-bold text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-blue)] transition-all"
                      />
                      <datalist id="manual-categories-list">
                        {existingCategories.map(cat => <option key={cat} value={cat} />)}
                      </datalist>
                    </div>
                  </>
                )}

                <button
                  type="submit"
                  disabled={!manualCode.trim()}
                  className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-[0.2em] transition-all shadow-xl active:scale-95 disabled:opacity-20 ${manualMasterOpen ? 'bg-[var(--color-blue)] text-white shadow-blue-900/20' : 'bg-[var(--color-emerald)] text-[var(--bg-primary)] shadow-emerald-900/20'}`}
                >
                  {manualMasterOpen ? 'Cadastrar Item' : 'Confirmar Presença'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Close Batch / Audit Modal */}
      <CloseBatchModal
        isOpen={closeModalOpen}
        onClose={() => setCloseModalOpen(false)}
        batchName={batch.name}
        missingCount={stats.missingCount}
        onConfirm={handleConfirmCloseBatch}
      />

      {/* Reopen Batch Confirmation Modal */}
      {reopenModalOpen && (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-5 animate-in fade-in duration-200">
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[2.2rem] p-6 w-full max-w-sm space-y-5 shadow-2xl scale-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-amber-500/15 text-amber-500 border border-amber-500/30">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase tracking-tight text-[var(--text-primary)]">
                    Reabrir Auditoria
                  </h3>
                  <p className="text-[10px] text-[var(--text-dim)] font-medium truncate max-w-[180px]">
                    {batch.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setReopenModalOpen(false)}
                className="p-1.5 text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[var(--text-secondary)] font-medium leading-relaxed bg-[var(--bg-primary)] p-3.5 rounded-2xl border border-[var(--border-color)]">
              Deseja reabrir esta auditoria? Você poderá continuar realizando leituras e alterando os registros.
            </p>

            <div className="space-y-2.5">
              <button
                onClick={handleConfirmReopenBatch}
                className="w-full py-3.5 px-4 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Sim, Reabrir Auditoria</span>
              </button>

              <button
                onClick={() => setReopenModalOpen(false)}
                className="w-full py-3 px-4 bg-[var(--bg-primary)] hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-2xl font-bold text-xs uppercase tracking-wider transition-all active:scale-95"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Permission Modal */}
      <DeletePermissionModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        deletePermission={getStoredSettings().deletePermission}
        itemBarcode={pendingDeleteItem?.barcode}
        onConfirmDelete={handleConfirmDelete}
        onConfirmDeleteOnce={handleConfirmDeleteOnce}
        onConfirmDeleteAlways={handleConfirmDeleteAlways}
      />

      {/* Export Format Selector Modal */}
      {exportMenuOpen && (
        <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[2.5rem] p-6 w-full max-w-sm space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[var(--color-emerald)]/10 text-[var(--color-emerald)] border border-[var(--color-emerald)]/20">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">
                    Exportar Lote
                  </h2>
                  <p className="text-[10px] text-[var(--text-dim)] font-medium truncate max-w-[180px]">
                    {batch.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setExportMenuOpen(false)}
                className="p-1.5 text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5">
              <button
                onClick={handleExportCsv}
                className="w-full card-elevated p-4 rounded-2xl border border-[var(--border-color)] hover:border-[var(--color-emerald)] flex items-center gap-3.5 text-left transition-all active:scale-[0.98] shadow-sm group"
              >
                <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 group-hover:scale-110 transition-transform">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-black uppercase tracking-tight text-[var(--text-primary)] block">
                    Planilha CSV (Excel / Sheets)
                  </span>
                  <span className="text-[9px] text-[var(--text-secondary)] font-medium">
                    Download em tabela organizada por colunas
                  </span>
                </div>
              </button>

              <button
                onClick={handleExportJson}
                className="w-full card-elevated p-4 rounded-2xl border border-[var(--border-color)] hover:border-[var(--color-blue)] flex items-center gap-3.5 text-left transition-all active:scale-[0.98] shadow-sm group"
              >
                <div className="p-3 rounded-xl bg-sky-500/10 text-sky-500 border border-sky-500/20 group-hover:scale-110 transition-transform">
                  <FileJson className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-black uppercase tracking-tight text-[var(--text-primary)] block">
                    Arquivo JSON Estruturado
                  </span>
                  <span className="text-[9px] text-[var(--text-secondary)] font-medium">
                    Contém lote, mestre e todas as leituras
                  </span>
                </div>
              </button>

              <button
                onClick={() => {
                  setExportMenuOpen(false);
                  setShowCloudSync(true);
                }}
                className="w-full card-elevated p-4 rounded-2xl border border-[var(--border-color)] hover:border-emerald-500 flex items-center gap-3.5 text-left transition-all active:scale-[0.98] shadow-sm group"
              >
                <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 group-hover:scale-110 transition-transform">
                  <CloudUpload className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-black uppercase tracking-tight text-[var(--text-primary)] block">
                    Carga & Descarga Cloud (Firebase)
                  </span>
                  <span className="text-[9px] text-[var(--text-secondary)] font-medium">
                    Sincronize ou mescle dados online com a nuvem
                  </span>
                </div>
              </button>

              <button
                onClick={() => {
                  setExportMenuOpen(false);
                  setQrModalOpen(true);
                }}
                className="w-full card-elevated p-4 rounded-2xl border border-[var(--border-color)] hover:border-amber-500 flex items-center gap-3.5 text-left transition-all active:scale-[0.98] shadow-sm group"
              >
                <div className="p-3 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 group-hover:scale-110 transition-transform">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-black uppercase tracking-tight text-[var(--text-primary)] block">
                    Gerar QR Code Mestre
                  </span>
                  <span className="text-[9px] text-[var(--text-secondary)] font-medium">
                    Transferência direta de celular para celular
                  </span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal for Single Batch Transfer */}
      {qrModalOpen && (
        <QrCodeExportModal
          isOpen={qrModalOpen}
          onClose={() => setQrModalOpen(false)}
          title={`Lote: ${batch.name}`}
          subtitle={`${totalCount} itens cadastrados`}
          payload={batchQrPayload}
        />
      )}

      {/* Cloud Sync Carga & Descarga Modal */}
      <CloudSyncModal
        isOpen={showCloudSync}
        onClose={() => setShowCloudSync(false)}
        onDataChanged={onRefresh}
      />
    </div>
  );
};


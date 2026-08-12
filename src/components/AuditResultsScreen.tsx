import React, { useState } from 'react';
import {
  ArrowLeft,
  Search,
  Download,
  Check,
  X,
  Package,
  Laptop,
  Trash2,
  Bell,
  Boxes,
  BarChart3,
  Sparkles,
  FileUp,
  CheckCircle2,
  RotateCcw,
  RefreshCw,
} from 'lucide-react';
import { Batch, ExpectedItem, ScanItem } from '../types';
import {
  getExpectedItemsForBatch,
  getScanItemsForBatch,
  getAuditStatsForBatch,
  reconcileBatchAudit,
  exportAuditReportCsv,
  deleteScanItemAndSync,
  deleteItemFromBatch,
  formatTimeStr,
  formatDateStr,
  closeBatch,
  reopenBatch,
  getStoredSettings,
  saveSettings,
  consumeDeletePermissionOnce,
} from '../services/storage';
import { CloseBatchModal } from './CloseBatchModal';
import { DeletePermissionModal } from './DeletePermissionModal';

interface AuditResultsScreenProps {
  batch: Batch;
  onBack: () => void;
  onContinueScanning: () => void;
  onNavigate?: (screen: string) => void;
  initialFilterTab?: 'all' | 'found' | 'missing' | 'extra';
}

export const AuditResultsScreen: React.FC<AuditResultsScreenProps> = ({
  batch,
  onBack,
  onContinueScanning,
  onNavigate,
  initialFilterTab = 'all',
}) => {
  const [filterTab, setFilterTab] = useState<'all' | 'found' | 'missing' | 'extra'>(initialFilterTab);
  const [searchQuery, setSearchQuery] = useState('');

  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [reopenModalOpen, setReopenModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [pendingDeleteItem, setPendingDeleteItem] = useState<{
    barcode: string;
    scanId?: number;
    expectedItemId?: number;
  } | null>(null);

  const [refreshKey, setRefreshKey] = useState(0);
  const triggerRefresh = () => setRefreshKey((k) => k + 1);

  const [reconcileNotice, setReconcileNotice] = useState<string | null>(null);

  const handleReconcile = () => {
    const newStats = reconcileBatchAudit(batch.id);
    setReconcileNotice(`Lógica recalculada com sucesso: ${newStats.foundCount} OK, ${newStats.missingCount} Faltantes, ${newStats.extraCount} Extras.`);
    setTimeout(() => setReconcileNotice(null), 4500);
    triggerRefresh();
  };

  const expectedItems = getExpectedItemsForBatch(batch.id);
  const scanItems = getScanItemsForBatch(batch.id);
  const stats = getAuditStatsForBatch(batch.id);

  const appSettings = getStoredSettings();
  const deletePermission = appSettings.deletePermission;

  const expectedBarcodes = new Set(expectedItems.map((e) => e.barcode.toLowerCase()));
  const extraScans = scanItems.filter((s) => !expectedBarcodes.has(s.barcode.toLowerCase()));

  const filteredExpected = expectedItems.filter((item) => {
    const matchesSearch =
      item.barcode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
    if (!matchesSearch) return false;
    if (filterTab === 'found') return item.isFound;
    if (filterTab === 'missing') return !item.isFound;
    if (filterTab === 'extra') return false;
    return true;
  });

  const filteredExtras = extraScans.filter((item) => {
    if (filterTab === 'found' || filterTab === 'missing') return false;
    return item.barcode.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleExportCsv = () => {
    let finalExpected: ExpectedItem[] | undefined = undefined;
    let finalExtras: ScanItem[] | undefined = undefined;

    const query = searchQuery.trim().toLowerCase();

    if (filterTab === 'found') {
      finalExpected = expectedItems.filter((e) => e.isFound);
      finalExtras = [];
    } else if (filterTab === 'missing') {
      finalExpected = expectedItems.filter((e) => !e.isFound);
      finalExtras = [];
    } else if (filterTab === 'extra') {
      finalExpected = [];
      finalExtras = extraScans;
    } else {
      finalExpected = expectedItems;
      finalExtras = extraScans;
    }

    if (query) {
      if (finalExpected) {
        finalExpected = finalExpected.filter((e) =>
          e.barcode.toLowerCase().includes(query) ||
          (e.description && e.description.toLowerCase().includes(query))
        );
      }
      if (finalExtras) {
        finalExtras = finalExtras.filter((s) => s.barcode.toLowerCase().includes(query));
      }
    }

    exportAuditReportCsv(batch, finalExpected, finalExtras);
  };

  const handleConfirmCloseBatch = (reason: string) => {
    closeBatch(batch.id, reason);
    setCloseModalOpen(false);
    triggerRefresh();
  };

  const handleConfirmReopenBatch = () => {
    reopenBatch(batch.id);
    setReopenModalOpen(false);
    triggerRefresh();
  };

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
      triggerRefresh();
    }
  };

  const handleConfirmDeleteOnce = () => {
    if (pendingDeleteItem) {
      deleteItemFromBatch(batch.id, pendingDeleteItem.barcode, pendingDeleteItem.scanId, pendingDeleteItem.expectedItemId);
      consumeDeletePermissionOnce();
      setPendingDeleteItem(null);
      setDeleteModalOpen(false);
      triggerRefresh();
    }
  };

  const handleConfirmDeleteAlways = () => {
    setPendingDeleteItem(null);
    setDeleteModalOpen(false);
  };

  return (
    <div className="min-h-screen text-[var(--text-primary)] bg-[var(--bg-primary)] flex flex-col max-w-md mx-auto select-none relative pb-32 border-x border-[var(--border-color)]">
      <header className="bg-[var(--bg-secondary)] border-b border-[var(--border-color)] px-4 h-16 flex items-center justify-between sticky top-0 z-50 shadow-sm transition-colors">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2.5 rounded-full bg-[var(--bg-primary)] border border-[var(--border-color)] active:scale-95 transition-all shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-black uppercase tracking-tight">Análise</h1>
        </div>
        <div className="flex items-center gap-2">
          {!batch.isClosed ? (
            <button
              onClick={() => setCloseModalOpen(true)}
              className="text-[10px] font-black uppercase tracking-[0.1em] text-emerald-600 dark:text-emerald-400 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl active:scale-95 transition-all shadow-sm flex items-center gap-1"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              FINALIZAR
            </button>
          ) : (
            <button
              onClick={() => setReopenModalOpen(true)}
              className="text-[10px] font-black uppercase tracking-[0.1em] text-amber-600 dark:text-amber-400 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl active:scale-95 transition-all shadow-sm flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              REABRIR
            </button>
          )}
          <button
            onClick={onContinueScanning}
            className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F97316] px-3.5 py-2 bg-orange-500/10 border border-orange-500/20 rounded-xl active:scale-95 transition-all shadow-sm"
          >
            Continuar
          </button>
        </div>
      </header>

      <main className="p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
        {/* Closed Banner */}
        {batch.isClosed && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-2xl flex items-center justify-between gap-3 shadow-sm animate-in fade-in">
            <div className="space-y-0.5 min-w-0">
              <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Auditoria Concluída
              </span>
              <p className="text-xs font-bold text-[var(--text-primary)] truncate">
                {batch.closedReason || 'Finalizada manualmente'}
              </p>
              {batch.closedAt && (
                <p className="text-[10px] text-[var(--text-dim)] font-medium">
                  Em {formatDateStr(batch.closedAt)}
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

        <div className="space-y-3">
          <h1 className="text-2xl font-black tracking-tighter uppercase truncate leading-none">
            {batch.name}
          </h1>
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-[var(--text-secondary)] font-black uppercase tracking-widest">
              {formatDateStr(batch.timestamp)} • {batch.isClosed ? 'Concluída' : 'Auditoria Ativa'}
            </p>
            <span className="text-[10px] font-black text-[var(--color-emerald)] bg-[var(--color-emerald)]/10 px-3 py-1 rounded-xl border border-[var(--color-emerald)]/20 shadow-inner">
              {stats.progressPercent}% Acurácia
            </span>
          </div>
          <div className="w-full h-2 bg-[var(--bg-secondary)] rounded-full overflow-hidden shadow-inner p-0.5 border border-[var(--border-color)]">
            <div
              className="h-full bg-[var(--color-emerald)] shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-all duration-700 rounded-full"
              style={{ width: `${stats.progressPercent}%` }}
            />
          </div>
        </div>

        {/* Audit Metrics & Recalculate Logic Card */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] p-4 rounded-2xl space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-sky-500" />
              <span className="text-xs font-black uppercase tracking-wider text-[var(--text-primary)]">
                Métricas da Auditoria
              </span>
            </div>
            <button
              onClick={handleReconcile}
              className="px-3 py-1.5 bg-[#002b59] hover:bg-[#0f3d73] text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 shadow-sm flex items-center gap-1.5"
              title="Refazer conciliação entre leituras e lista mestre"
            >
              <RefreshCw className="w-3.5 h-3.5 text-sky-300" />
              <span>Recalcular Lógica</span>
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center pt-1">
            <div className="bg-[var(--bg-primary)] p-2 rounded-xl border border-[var(--border-color)]">
              <span className="text-[9px] font-extrabold uppercase text-[var(--text-dim)] block">Mestre</span>
              <span className="text-sm font-black text-sky-600 dark:text-sky-400">{stats.totalExpected}</span>
            </div>
            <div className="bg-[var(--bg-primary)] p-2 rounded-xl border border-[var(--border-color)]">
              <span className="text-[9px] font-extrabold uppercase text-emerald-600 dark:text-emerald-400 block">OK</span>
              <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{stats.foundCount}</span>
            </div>
            <div className="bg-[var(--bg-primary)] p-2 rounded-xl border border-[var(--border-color)]">
              <span className="text-[9px] font-extrabold uppercase text-red-500 block">Falta</span>
              <span className="text-sm font-black text-red-500">{stats.missingCount}</span>
            </div>
            <div className="bg-[var(--bg-primary)] p-2 rounded-xl border border-[var(--border-color)]">
              <span className="text-[9px] font-extrabold uppercase text-amber-500 block">Extra</span>
              <span className="text-sm font-black text-amber-500">{stats.extraCount}</span>
            </div>
          </div>

          {reconcileNotice && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold p-2.5 rounded-xl text-center animate-in fade-in">
              {reconcileNotice}
            </div>
          )}
        </div>

        <div className="relative">
          <Search className="w-5 h-5 text-[var(--text-dim)] absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrar por Código ou Nome..."
            className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl pl-12 pr-5 py-4 text-sm font-bold focus:outline-none focus:border-[var(--color-blue)] shadow-md transition-all placeholder-[var(--text-dim)]/50"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'all', label: 'Todos', count: expectedItems.length + extraScans.length },
            { id: 'found', label: 'OK', count: stats.foundCount },
            { id: 'missing', label: 'Falta', count: stats.missingCount },
            { id: 'extra', label: 'Extra', count: stats.extraCount },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterTab(tab.id as any)}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap shadow-xs border ${
                filterTab === tab.id
                  ? 'bg-[#002b59] border-[#002b59] text-white'
                  : 'bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {tab.label} <span className="opacity-70 ml-1">({tab.count})</span>
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {filteredExpected.map((item) => {
            const matchedScan = scanItems.find(
              (s) => s.barcode.toLowerCase() === item.barcode.toLowerCase()
            );
            return (
              <div
                key={item.id}
                className="card-elevated p-4 flex items-center gap-3 transition-all shadow-xs relative overflow-hidden group"
              >
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1 ${
                    item.isFound ? 'bg-emerald-500' : 'bg-red-500'
                  }`}
                />
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${
                    item.isFound
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                      : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30'
                  }`}
                >
                  <Laptop className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xs font-bold truncate text-[var(--text-primary)]">
                    {item.description || `Ativo ${item.barcode}`}
                  </h3>
                  <p className="text-[11px] font-medium text-[var(--text-secondary)] font-mono-code mt-0.5">
                    ID: {item.barcode}
                  </p>
                </div>
                <div className="text-right shrink-0 flex flex-col items-end gap-1">
                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                      item.isFound
                        ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30'
                        : 'bg-red-500/15 text-red-800 dark:text-red-300 border-red-500/30'
                    }`}
                  >
                    {item.isFound ? 'ENCONTRADO' : 'FALTANTE'}
                  </span>
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] font-medium text-[var(--text-dim)] font-mono-code">
                      {item.timestampFound ? formatTimeStr(item.timestampFound) : '--:--:--'}
                    </p>
                    <button
                      onClick={() => handleDeleteItemClick(item.barcode, matchedScan?.id, item.id)}
                      title="Excluir item"
                      className={`p-1 text-red-500 hover:bg-red-500/10 rounded-lg transition-all ${
                        deletePermission === 'LOCKED'
                          ? 'opacity-30 hover:opacity-100'
                          : deletePermission === 'ONCE'
                          ? 'opacity-80 hover:opacity-100'
                          : 'opacity-100'
                      }`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredExtras.map((scan) => (
            <div
              key={scan.id}
              className="card-elevated p-4 flex items-center gap-3 transition-all shadow-xs relative overflow-hidden group"
            >
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-sky-500" />
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30 flex items-center justify-center shrink-0">
                <Package className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xs font-bold truncate text-[var(--text-primary)]">
                  Sobra de Estoque
                </h3>
                <p className="text-[11px] font-medium text-[var(--text-secondary)] font-mono-code mt-0.5">
                  ID: {scan.barcode}
                </p>
              </div>
              <div className="text-right shrink-0 flex flex-col items-end gap-1">
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border bg-sky-500/15 text-sky-800 dark:text-sky-300 border-sky-500/30">
                  EXCEDENTE
                </span>
                <div className="flex items-center gap-2">
                  <p className="text-[10px] font-medium text-[var(--text-dim)] font-mono-code">
                    {formatTimeStr(scan.timestamp)}
                  </p>
                  <button
                    onClick={() => handleDeleteItemClick(scan.barcode, scan.id)}
                    title="Excluir leitura"
                    className={`p-1 text-red-500 hover:bg-red-500/10 rounded-lg transition-all ${
                      deletePermission === 'LOCKED'
                        ? 'opacity-30 hover:opacity-100'
                        : deletePermission === 'ONCE'
                        ? 'opacity-80 hover:opacity-100'
                        : 'opacity-100'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {filteredExpected.length === 0 && filteredExtras.length === 0 && (
            <div className="py-16 text-center opacity-50">
              <Package className="w-10 h-10 mx-auto mb-2 text-[var(--text-dim)]" />
              <p className="text-xs font-bold text-[var(--text-dim)]">Nenhum registro encontrado</p>
            </div>
          )}
        </div>
      </main>

      <div className="fixed bottom-16 left-0 right-0 max-w-md mx-auto p-4 bg-gradient-to-t from-[var(--bg-primary)] via-[var(--bg-primary)] to-transparent z-40">
        <button
          onClick={handleExportCsv}
          className="w-full h-14 bg-[#002b59] hover:bg-[#0f3d73] text-white rounded-2xl font-bold text-xs uppercase tracking-wider shadow-md flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
        >
          <Download className="w-5 h-5 text-sky-300" />
          Exportar Relatório {filterTab !== 'all' ? `(${filterTab})` : ''}
        </button>
      </div>

      {/* Nav Bar consistency */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-[var(--bg-secondary)] border-t border-[var(--border-color)] h-16 px-4 flex items-center justify-around z-50">
        <button
          onClick={() => onNavigate && onNavigate('menu')}
          className="flex flex-col items-center text-[var(--text-dim)] uppercase text-[9px] font-bold tracking-tighter"
        >
          <BarChart3 className="w-5 h-5 mb-0.5" />
          Home
        </button>
        <button
          onClick={() => onNavigate && onNavigate('batch_list')}
          className="flex flex-col items-center text-[var(--color-emerald)] uppercase text-[9px] font-black tracking-tighter"
        >
          <Boxes className="w-5 h-5 mb-0.5 stroke-[3]" />
          Arquivos
        </button>
        <button
          onClick={() => onNavigate && onNavigate('import_inventory')}
          className="flex flex-col items-center text-[var(--text-dim)] uppercase text-[9px] font-bold tracking-tighter"
        >
          <FileUp className="w-5 h-5 mb-0.5" />
          Importar
        </button>
        <button
          onClick={() => onNavigate && onNavigate('settings')}
          className="flex flex-col items-center text-[var(--text-dim)] uppercase text-[9px] font-bold tracking-tighter"
        >
          <Sparkles className="w-5 h-5 mb-0.5" />
          Ajustes
        </button>
      </nav>

      {/* Modals */}
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

      <DeletePermissionModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        deletePermission={getStoredSettings().deletePermission}
        itemBarcode={pendingDeleteItem?.barcode}
        onConfirmDelete={handleConfirmDelete}
        onConfirmDeleteOnce={handleConfirmDeleteOnce}
        onConfirmDeleteAlways={handleConfirmDeleteAlways}
      />
    </div>
  );
};


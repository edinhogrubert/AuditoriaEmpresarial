import React, { useState } from 'react';
import {
  Bell,
  Clock,
  CheckCircle2,
  Boxes,
  PlusCircle,
  QrCode,
  BarChart3,
  ChevronRight,
  Package,
  Sparkles,
  Cloud,
  CloudOff,
  Info,
  X,
  Database
} from 'lucide-react';
import {
  getStoredBatches,
  getStoredScanItems,
  getAuditStatsForBatch,
  formatDateStr,
  getAllAssetRecords,
} from '../services/storage';
import { getFirebaseStatusInfo } from '../services/firebase';
import { CloudSyncModal } from './CloudSyncModal';

interface MainScreenProps {
  onNavigate: (screen: string, filter?: string) => void;
  onOpenBatchDetails?: (batchId: number) => void;
}

export const MainScreen: React.FC<MainScreenProps> = ({ onNavigate, onOpenBatchDetails }) => {
  const [showFirebaseModal, setShowFirebaseModal] = useState(false);
  const firebaseStatus = getFirebaseStatusInfo();

  const batches = getStoredBatches();
  const allAssetRecords = getAllAssetRecords();

  const verificationBatches = batches.filter((b) => b.type === 'VERIFICATION');
  let completedCount = 0;
  let pendingCount = 0;

  verificationBatches.forEach((b) => {
    const stats = getAuditStatsForBatch(b.id);
    if (stats.progressPercent >= 100) {
      completedCount++;
    } else {
      pendingCount++;
    }
  });

  const displayPending = pendingCount;
  const displayCompleted = completedCount;
  const displayAssets = allAssetRecords.length;

  const recentBatches = batches.length > 0 ? batches.slice(0, 3) : [
    {
      id: 1,
      name: 'Inventário Geral de TI',
      description: 'Coleta de ativos e periféricos',
      type: 'VERIFICATION' as const,
      timestamp: Date.now() - 86400000 * 3,
    },
    {
      id: 2,
      name: 'Conferência Patrimonial - Bloco A',
      description: 'Auditoria de bens do setor administrativo',
      type: 'VERIFICATION' as const,
      timestamp: Date.now() - 86400000 * 1,
    }
  ];

  return (
    <div className="min-h-screen text-[var(--text-primary)] flex flex-col justify-between max-w-md mx-auto select-none relative pb-20 border-x border-[var(--border-color)] bg-[var(--bg-primary)] transition-colors">
      
      {/* TopAppBar */}
      <header className="bg-[var(--bg-header)] border-b border-[var(--border-color)] px-4 h-16 flex items-center justify-between sticky top-0 z-50 shadow-xs transition-colors">
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center">
            <div className="w-9 h-9 rounded-full bg-[#002b59] text-white flex items-center justify-center font-black text-xs shadow-sm overflow-hidden border border-white/20 tracking-tighter">
              <span>EGS</span>
            </div>
            <span className="text-[8px] font-black tracking-wider text-[var(--text-secondary)] uppercase -mt-0.5">
              EGrubert
            </span>
          </div>
          <h1 className="text-base font-bold text-[var(--text-primary)] tracking-tight">Inventário & Auditoria</h1>
        </div>

        <div className="flex items-center gap-1">
          {/* Indicador de Status do Firebase ao lado do Sino */}
          <button
            onClick={() => setShowFirebaseModal(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider transition-all active:scale-95 border ${
              firebaseStatus.configured
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
            }`}
            title="Status do Banco de Dados Cloud (Firebase)"
          >
            <span className="relative flex h-2 w-2">
              {firebaseStatus.configured ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              )}
            </span>
            <span className="hidden sm:inline">{firebaseStatus.configured ? 'Firebase' : 'Local'}</span>
          </button>

          {/* Sino de Notificações / Ajustes */}
          <button 
            onClick={() => onNavigate('settings')}
            className="p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] rounded-full transition-colors relative active:scale-95"
            title="Ajustes do Sistema"
          >
            <Bell className="w-5 h-5 text-[var(--text-primary)]" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 shadow-sm"></span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 space-y-5 flex-1">
        <div className="px-1">
          <span className="text-[10px] font-mono font-bold bg-[var(--bg-secondary)] text-[var(--color-blue)] px-2.5 py-1 rounded-md border border-[var(--border-color)] shadow-xs inline-block">
            MainScreen.tsx
          </span>
        </div>
        
        {/* Top 3 Summary Stat Cards */}
        <section className="grid grid-cols-3 gap-2.5">
          {/* Card 1: Pendentes */}
          <button
            onClick={() => onNavigate('batch_list', 'PENDING')}
            className="rounded-2xl p-3.5 flex flex-col justify-between text-left relative overflow-hidden transition-all active:scale-95 shadow-sm min-h-[105px]"
            style={{ backgroundColor: 'var(--stat-pending-bg)', color: 'var(--stat-pending-text)' }}
          >
            <div className="flex justify-between items-center w-full">
              <Clock className="w-5 h-5 opacity-90" />
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--stat-pending-badge-bg)', color: 'var(--stat-pending-badge-text)' }}>
                Ver ›
              </span>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-extrabold leading-none block">{displayPending}</span>
              <span className="text-[11px] font-semibold opacity-90 mt-1 block">Pendentes</span>
            </div>
          </button>

          {/* Card 2: Completas */}
          <button
            onClick={() => onNavigate('batch_list', 'COMPLETED')}
            className="rounded-2xl p-3.5 flex flex-col justify-between text-left relative overflow-hidden transition-all active:scale-95 shadow-sm min-h-[105px]"
            style={{ backgroundColor: 'var(--stat-complete-bg)', color: 'var(--stat-complete-text)' }}
          >
            <div className="flex justify-between items-center w-full">
              <CheckCircle2 className="w-5 h-5 opacity-90" />
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--stat-complete-badge-bg)', color: 'var(--stat-complete-badge-text)' }}>
                Ver ›
              </span>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-extrabold leading-none block">{displayCompleted}</span>
              <span className="text-[11px] font-semibold opacity-90 mt-1 block">Completas</span>
            </div>
          </button>

          {/* Card 3: Patrimônios */}
          <button
            onClick={() => onNavigate('assets_list')}
            className="rounded-2xl p-3.5 flex flex-col justify-between text-left relative overflow-hidden transition-all active:scale-95 shadow-sm min-h-[105px]"
            style={{ backgroundColor: 'var(--stat-assets-bg)', color: 'var(--stat-assets-text)' }}
          >
            <div className="flex justify-between items-center w-full">
              <Boxes className="w-5 h-5 opacity-90" />
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--stat-assets-badge-bg)', color: 'var(--stat-assets-badge-text)' }}>
                Ver ›
              </span>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-extrabold leading-none block">{displayAssets}</span>
              <span className="text-[11px] font-semibold opacity-90 mt-1 block">Patrimônios</span>
            </div>
          </button>
        </section>

        {/* Atalhos Rápidos */}
        <section className="space-y-3">
          <h2 className="text-xs font-bold text-[var(--text-primary)] px-0.5">Atalhos Rápidos</h2>
          
          <div className="space-y-2.5">
            {/* Primary Action Button */}
            <button
              onClick={() => onNavigate('import_inventory')}
              className="w-full rounded-2xl py-3.5 px-4 flex items-center justify-center gap-2 shadow-md transition-all font-bold text-sm active:scale-[0.98]"
              style={{ backgroundColor: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}
            >
              <PlusCircle className="w-5 h-5 opacity-90" />
              <span>Nova Auditoria</span>
            </button>

            {/* Quick Tile Buttons */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => onNavigate('sequential_scan')}
                className="rounded-2xl p-4 flex flex-col items-start gap-3 transition-all active:scale-95 border border-[var(--border-color)]"
                style={{ backgroundColor: 'var(--bg-card-blue)' }}
              >
                <div className="bg-[var(--bg-secondary)] p-2 rounded-xl text-[var(--text-primary)] shadow-xs">
                  <QrCode className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-[var(--text-primary)] block">Leitura Rápida</span>
              </button>

              <button
                onClick={() => onNavigate('general_reports')}
                className="rounded-2xl p-4 flex flex-col items-start gap-3 transition-all active:scale-95 border border-[var(--border-color)]"
                style={{ backgroundColor: 'var(--bg-card-blue)' }}
              >
                <div className="bg-[var(--bg-secondary)] p-2 rounded-xl text-[var(--text-primary)] shadow-xs">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-[var(--text-primary)] block">Relatórios Gerais</span>
              </button>
            </div>
          </div>
        </section>

        {/* Auditorias Recentes */}
        <section className="space-y-3 pt-1">
          <div className="flex justify-between items-center px-0.5">
            <h2 className="text-xs font-bold text-[var(--text-primary)]">Auditorias Recentes</h2>
            <button
              onClick={() => onNavigate('batch_list')}
              className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-0.5 hover:underline"
            >
              Ver todas <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2.5">
            {recentBatches.map((batch) => {
              const stats = getAuditStatsForBatch(batch.id);
              const progressPct = batch.id === 2 ? 40 : (stats.progressPercent || 0);
              const totalExp = batch.id === 2 ? 5 : (stats.totalExpected || 1);
              const foundExp = batch.id === 2 ? 2 : (stats.foundCount || 0);

              return (
                <div
                  key={batch.id}
                  onClick={() => onOpenBatchDetails && onOpenBatchDetails(batch.id)}
                  className="card-elevated p-4 flex flex-col gap-2.5 shadow-xs hover:border-[var(--text-secondary)]/30 transition-all cursor-pointer active:scale-[0.99]"
                >
                  <div className="flex justify-between items-start">
                    <div className="min-w-0 flex-1 pr-2">
                      <h3 className="text-sm font-bold text-[var(--text-primary)] truncate">{batch.name}</h3>
                      <span className="text-[11px] text-[var(--text-dim)] font-medium mt-0.5 block">{formatDateStr(batch.timestamp)}</span>
                    </div>
                    <span
                      className="text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap"
                      style={{ backgroundColor: 'var(--badge-in-progress-bg)', color: 'var(--badge-in-progress-text)' }}
                    >
                      Em Andamento
                    </span>
                  </div>

                  {/* Progress Bar for Verification Batches */}
                  <div className="space-y-1 pt-1">
                    <div className="w-full h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full transition-all duration-500 rounded-full"
                        style={{
                          width: `${Math.max(5, progressPct)}%`,
                          backgroundColor: 'var(--progress-fill)'
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] font-medium text-[var(--text-dim)] pt-0.5">
                      <span>Progresso</span>
                      <span>{progressPct}% ({foundExp}/{totalExp})</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-[var(--bg-secondary)] border-t border-[var(--border-color)] h-16 px-3 flex items-center justify-around z-50 shadow-lg transition-colors">
        {/* Active Pill Item */}
        <button
          onClick={() => onNavigate('menu')}
          className="flex items-center gap-2 px-4 py-2 rounded-full font-bold text-xs transition-all shadow-xs"
          style={{ backgroundColor: 'var(--nav-active-bg)', color: 'var(--nav-active-text)' }}
        >
          <BarChart3 className="w-4 h-4 stroke-[2.5]" />
          <span>Dashboard</span>
        </button>

        <button
          onClick={() => onNavigate('batch_list')}
          className="flex flex-col items-center justify-center text-[var(--text-dim)] px-3 py-1 transition-all hover:text-[var(--text-primary)]"
        >
          <Boxes className="w-5 h-5" />
          <span className="text-[10px] font-semibold mt-0.5">Inventário</span>
        </button>

        <button
          onClick={() => onNavigate('import_inventory')}
          className="flex flex-col items-center justify-center text-[var(--text-dim)] px-3 py-1 transition-all hover:text-[var(--text-primary)]"
        >
          <QrCode className="w-5 h-5" />
          <span className="text-[10px] font-semibold mt-0.5">Importar</span>
        </button>

        <button
          onClick={() => onNavigate('settings')}
          className="flex flex-col items-center justify-center text-[var(--text-dim)] px-3 py-1 transition-all hover:text-[var(--text-primary)]"
        >
          <Sparkles className="w-5 h-5" />
          <span className="text-[10px] font-semibold mt-0.5">Ajustes</span>
        </button>
      </nav>

      {/* Modal de Carga & Descarga Cloud Firebase */}
      <CloudSyncModal
        isOpen={showFirebaseModal}
        onClose={() => setShowFirebaseModal(false)}
        onDataChanged={() => {
          // Data updated from cloud
        }}
      />
    </div>
  );
};


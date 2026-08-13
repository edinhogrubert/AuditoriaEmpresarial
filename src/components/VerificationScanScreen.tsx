import React, { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Package,
} from 'lucide-react';
import { Batch } from '../types';
import { CameraScanner } from './CameraScanner';
import { processScanItem, getAuditStatsForBatch } from '../services/storage';

interface VerificationScanScreenProps {
  batch: Batch;
  onBack: () => void;
  onViewAuditResults: () => void;
}

export const VerificationScanScreen: React.FC<VerificationScanScreenProps> = ({
  batch,
  onBack,
  onViewAuditResults,
}) => {
  const [stats, setStats] = useState(() => getAuditStatsForBatch(batch.id));
  const [lastScanResult, setLastScanResult] = useState<{
    status: 'FOUND' | 'DUPLICATE' | 'EXTRA' | 'ADDED';
    message: string;
    barcode: string;
  } | null>(null);

  const handleScan = (barcode: string, format: string = 'CODE_128') => {
    if (lastScanResult && lastScanResult.barcode === barcode) return;

    const res = processScanItem(batch.id, barcode, format);

    setLastScanResult({
      status: res.status,
      message: res.message,
      barcode,
    });

    if (navigator.vibrate) {
      if (res.status === 'FOUND') navigator.vibrate(100);
      else if (res.status === 'DUPLICATE') navigator.vibrate([100, 50, 100]);
      else if (res.status === 'EXTRA') navigator.vibrate([200, 100, 200]);
    }

    setStats(getAuditStatsForBatch(batch.id));
  };

  return (
    <div className="relative w-full h-screen bg-transparent scanner-active-transparent text-white flex flex-col select-none overflow-hidden max-w-md mx-auto">
      
      {/* Top Overlay Header */}
      <header className="relative z-20 w-full flex justify-between items-center px-4 h-14 bg-gradient-to-b from-black/70 to-transparent text-white">
        <button
          onClick={onBack}
          aria-label="Go Back"
          className="w-10 h-10 flex items-center justify-center rounded-full bg-black/30 backdrop-blur-md hover:bg-black/50 active:scale-95 transition-all"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>

        <div className="flex-1 text-center truncate px-3">
          <h1 className="text-sm font-bold text-white truncate drop-shadow-md">
            {batch.name}
          </h1>
        </div>

        <div className="w-10 h-10" />
      </header>

      {/* Main Camera Viewfinder View */}
      <main className="flex-1 relative z-10 flex flex-col items-center justify-center -mt-14">
        <CameraScanner onScan={handleScan} />

        {/* Viewfinder Cutout Frame */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-64 h-64 rounded-2xl border-2 border-transparent relative shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
            {/* Corner Indicators */}
            <div className="absolute -top-0.5 -left-0.5 w-6 h-6 border-t-4 border-l-4 border-emerald-400" />
            <div className="absolute -top-0.5 -right-0.5 w-6 h-6 border-t-4 border-r-4 border-emerald-400" />
            <div className="absolute -bottom-0.5 -left-0.5 w-6 h-6 border-b-4 border-l-4 border-emerald-400" />
            <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 border-b-4 border-r-4 border-emerald-400" />

            {/* Scanning Line Animation */}
            <div className="absolute top-0 left-0 w-full h-0.5 bg-emerald-400 shadow-[0_0_8px_#10B981] animate-pulse" />
          </div>
        </div>

        {/* Floating Instruction Badge */}
        <p className="mt-72 z-20 text-xs font-semibold text-white drop-shadow-md bg-black/40 px-4 py-2 rounded-full backdrop-blur-md pointer-events-auto border border-white/10">
          Aponte para o código de barras
        </p>
      </main>

      {/* Bottom Overlay Sheet (Progress, Status, Actions) */}
      <footer className="relative z-20 w-full bg-[#1A1F26] text-white rounded-t-3xl shadow-[0_-4px_24px_rgba(0,0,0,0.5)] flex flex-col border-t border-gray-800">
        
        {/* Progress Bar Section */}
        <div className="w-full pt-4 px-5">
          <div className="flex justify-between items-end mb-1.5">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Progresso (OK / Esperados)</span>
            <span className="text-xs font-bold text-emerald-400 font-mono-code">
              {stats.foundCount}/{stats.totalExpected || 0} ({stats.progressPercent}%)
            </span>
          </div>
          <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500 ease-out shadow-[0_0_10px_#10B981]"
              style={{ width: `${Math.min(100, stats.progressPercent)}%` }}
            />
          </div>
        </div>

        {/* Dual-Column Paper Summary Grid: Importados vs Lidos */}
        <div className="px-5 mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="bg-[#0A0D14] border border-gray-800 p-2 rounded-xl">
            <span className="text-[9px] font-black text-sky-400 uppercase tracking-wider block">Importados</span>
            <span className="text-base font-extrabold text-white font-mono">{stats.totalExpected}</span>
          </div>
          <div className="bg-[#0A0D14] border border-gray-800 p-2 rounded-xl">
            <span className="text-[9px] font-black text-amber-400 uppercase tracking-wider block">Lidos (Câmera)</span>
            <span className="text-base font-extrabold text-white font-mono">{stats.scannedCount}</span>
          </div>
          <div className="bg-[#0A0D14] border border-gray-800 p-2 rounded-xl">
            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-wider block">Todos (Únicos)</span>
            <span className="text-base font-extrabold text-white font-mono">{stats.combinedTotal}</span>
          </div>
        </div>

        <div className="px-5 mt-1 grid grid-cols-3 gap-2 text-center">
          <div className="bg-emerald-500/10 border border-emerald-500/20 p-1.5 rounded-xl">
            <span className="text-[8px] font-bold text-emerald-400 uppercase">🟢 OK: {stats.foundCount}</span>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 p-1.5 rounded-xl">
            <span className="text-[8px] font-bold text-red-400 uppercase">🔴 Falta: {stats.missingCount}</span>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 p-1.5 rounded-xl">
            <span className="text-[8px] font-bold text-amber-400 uppercase">🟠 Extra: {stats.extraCount}</span>
          </div>
        </div>

        {/* Feedback Card (Última Leitura) */}
        <div className="px-5 mt-4">
          <div className="bg-[#0A0D14] border border-gray-800 rounded-2xl p-4 flex items-center shadow-sm">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center mr-3 shrink-0 ${
                lastScanResult?.status === 'DUPLICATE'
                  ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                  : lastScanResult?.status === 'EXTRA'
                  ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              }`}
            >
              {lastScanResult?.status === 'DUPLICATE' ? (
                <AlertTriangle className="w-5 h-5" />
              ) : lastScanResult?.status === 'EXTRA' ? (
                <HelpCircle className="w-5 h-5" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-black text-gray-500 tracking-[0.2em] uppercase mb-0.5">
                Status Atual
              </p>
              <p className="text-sm font-bold text-white truncate font-mono">
                {lastScanResult?.barcode || 'Pronto para ler'}
              </p>
              <p className={`text-[10px] font-bold mt-0.5 ${
                lastScanResult?.status === 'EXTRA' ? 'text-red-400' : 'text-emerald-400'
              }`}>
                {lastScanResult?.message || 'Aguardando bipagem...'}
              </p>
            </div>
          </div>
        </div>

        {/* Finalize Button */}
        <div className="p-5 pt-4">
          <button
            onClick={onViewAuditResults}
            className="w-full h-14 bg-emerald-500 hover:bg-emerald-600 text-[#0A0D14] rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-emerald-900/10"
          >
            Finalizar e Ver Resultados
          </button>
        </div>
      </footer>
    </div>
  );
};

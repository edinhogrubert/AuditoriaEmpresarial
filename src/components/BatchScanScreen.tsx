import React, { useState } from 'react';
import { ArrowLeft, Package, Check, QrCode } from 'lucide-react';
import { Batch, ScanItem } from '../types';
import { CameraScanner } from './CameraScanner';
import { formatTimeStr } from '../services/storage';

interface BatchScanScreenProps {
  batch: Batch;
  scanItems: ScanItem[];
  onBack: () => void;
  onAddScanItem: (barcode: string, format: string) => void;
  onViewDetails: () => void;
}

export const BatchScanScreen: React.FC<BatchScanScreenProps> = ({
  batch,
  scanItems,
  onBack,
  onAddScanItem,
  onViewDetails,
}) => {
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  const handleBarcodeDetected = (code: string, format: string) => {
    if (code !== lastScanned) {
      setLastScanned(code);
      onAddScanItem(code, format);
      setShowFeedback(true);
      setTimeout(() => setShowFeedback(false), 800);
    }
  };

  const getTypeLabel = (format: string) => {
    const fmt = format.toUpperCase();
    if (fmt.includes('QR')) return '[URL]';
    if (fmt.includes('EAN')) return '[EAN]';
    return '[TEXT]';
  };

  return (
    <div className="relative w-full h-screen bg-transparent scanner-active-transparent text-white flex flex-col select-none overflow-hidden max-w-md mx-auto">
      {/* Top Header */}
      <div className="absolute top-0 inset-x-0 z-30 p-4 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2.5 rounded-full bg-black/40 text-white border border-white/10 backdrop-blur-md hover:bg-black/60 active:scale-95 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-sm font-bold text-white truncate max-w-[160px] drop-shadow-md">
              {batch.name}
            </h2>
            <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest drop-shadow-md">
              Armazenamento Direto
            </p>
          </div>
        </div>

        {/* Counter Badge */}
        <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl px-3.5 py-2 flex items-center gap-2 shadow-lg">
          <Package className="w-4 h-4 text-purple-400" />
          <span className="text-xs font-bold text-white font-mono">
            {scanItems.length}
          </span>
        </div>
      </div>

      {/* Camera Scanner Container */}
      <div className="relative flex-1 w-full h-full">
        <CameraScanner onScan={handleBarcodeDetected} />

        {/* Success Flash Feedback */}
        {showFeedback && (
          <div className="absolute inset-0 bg-emerald-500/20 pointer-events-none z-20 transition-opacity animate-pulse"></div>
        )}

        {/* Last Scanned Pink Code Label */}
        {lastScanned && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-20 z-20 pointer-events-none bg-black/60 backdrop-blur-md px-5 py-2.5 rounded-2xl border-2 border-emerald-500/40 shadow-2xl scale-110">
            <span className="text-base font-black text-emerald-400 font-mono tracking-tighter">
              {lastScanned}
            </span>
          </div>
        )}
      </div>

      {/* Floating Bottom Section: Recent Scans + Shutter Controls */}
      <div className="absolute bottom-6 inset-x-6 z-30 flex flex-col gap-5">
        {/* Recent Scans Mini List */}
        {scanItems.length > 0 && (
          <div className="space-y-2">
            <span className="text-[9px] font-black text-white/60 tracking-[0.2em] uppercase block drop-shadow-md">
              Últimas Leituras
            </span>
            <div className="bg-[#1A1F26]/90 backdrop-blur-xl border border-gray-800 rounded-2xl p-4 max-h-40 overflow-y-auto space-y-3 shadow-2xl">
              {scanItems.slice(0, 5).map((item) => {
                const badge = getTypeLabel(item.format);
                return (
                  <div key={item.id} className="flex items-center justify-between gap-3 text-xs py-1 border-b border-gray-800/40 last:border-0 transition-colors">
                    <span className="text-[9px] font-black text-emerald-400 font-mono shrink-0">{badge}</span>
                    <span className="font-mono text-white font-bold truncate flex-1 tracking-tight">{item.barcode}</span>
                    <span className="text-[10px] text-gray-500 shrink-0 font-mono">{formatTimeStr(item.timestamp).slice(0, 5)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Bottom Shutter / Action Controls */}
        <div className="flex items-center justify-center gap-10">
          {/* Shutter Visual */}
          <div className="w-20 h-20 rounded-full border-4 border-white/20 flex items-center justify-center shadow-2xl bg-white/5 backdrop-blur-sm">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <QrCode className="w-6 h-6 text-emerald-400/60" />
            </div>
          </div>

          {/* Confirm Button -> Go to Details */}
          <button
            onClick={onViewDetails}
            className="w-16 h-16 rounded-full bg-emerald-500 text-[#0A0D14] flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.3)] active:scale-90 transition-all border-4 border-[#0A0D14]"
            title="Finalizar"
          >
            <Check className="w-8 h-8 stroke-[3]" />
          </button>
        </div>
      </div>
    </div>
  );
};

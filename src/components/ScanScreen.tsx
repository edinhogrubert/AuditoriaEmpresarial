import React, { useState } from 'react';
import { ArrowLeft, Copy, Share2, Trash2, CheckCircle2, Play } from 'lucide-react';
import { CameraScanner } from './CameraScanner';

interface ScanScreenProps {
  onBack: () => void;
}

export const ScanScreen: React.FC<ScanScreenProps> = ({ onBack }) => {
  const [scannedResult, setScannedResult] = useState<{ code: string; format: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  const handleScan = (code: string, format: string) => {
    setScannedResult({ code, format });
    setIsScanning(false); // Stop scanning automatically after first success
  };

  const handleCopy = () => {
    if (scannedResult) {
      navigator.clipboard.writeText(scannedResult.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = () => {
    if (scannedResult && navigator.share) {
      navigator.share({
        title: 'Código Escaneado',
        text: scannedResult.code,
      }).catch(() => {});
    } else if (scannedResult) {
      handleCopy();
    }
  };

  const startNewScan = () => {
    setScannedResult(null);
    setIsScanning(true);
  };

  return (
    <div className={`relative w-full h-screen text-white flex flex-col select-none overflow-hidden max-w-md mx-auto ${isScanning ? 'bg-transparent scanner-active-transparent' : 'bg-[#0A0D14]'}`}>
      {/* Top Header */}
      <div className={`absolute top-0 inset-x-0 z-30 p-4 flex items-center justify-between ${isScanning ? 'bg-gradient-to-b from-black/80 to-transparent' : ''}`}>
        <button
          onClick={onBack}
          className="p-2.5 rounded-full bg-[#1A1F26]/80 text-white border border-gray-800 backdrop-blur-md active:scale-95 transition-all shadow-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-base font-bold text-white tracking-wide">Leitura Rápida</h2>
        <div className="w-10"></div>
      </div>

      {/* Main Scanner Viewport */}
      <div className="relative flex-1 w-full h-full">
        <CameraScanner onScan={handleScan} active={isScanning} />

        {/* Manual Start Button (Overlay) */}
        {!isScanning && !scannedResult && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 z-20">
            <button
              onClick={startNewScan}
              className="group relative flex flex-col items-center gap-4 active:scale-95 transition-all"
            >
              <div className="w-24 h-24 rounded-full bg-emerald-500 flex items-center justify-center shadow-[0_0_50px_rgba(16,185,129,0.4)] group-hover:scale-105 transition-transform">
                <Play className="w-10 h-10 text-[#0A0D14] ml-1" />
              </div>
              <span className="text-sm font-black uppercase tracking-widest text-emerald-400">Iniciar Leitura</span>
            </button>
          </div>
        )}
      </div>

      {/* Result Floating Card Overlay */}
      {scannedResult && !isScanning && (
        <div className="absolute bottom-6 inset-x-6 z-40 bg-[#1A1F26] border border-gray-800 rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom duration-300">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-gray-400 tracking-wider uppercase">
              RESULTADO
            </span>
            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-500/20">
              {scannedResult.format}
            </span>
          </div>

          <p className="text-lg font-bold text-white break-all mb-6 font-mono bg-[#0A0D14] p-3 rounded-xl border border-gray-800">
            {scannedResult.code}
          </p>

          <div className="flex flex-col gap-3">
             <div className="flex items-center gap-3">
                <button
                onClick={handleCopy}
                className="flex-1 py-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-emerald-500/20 active:scale-95 transition-all"
                >
                {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copiado!' : 'Copiar'}
                </button>
                <button
                onClick={handleShare}
                className="flex-1 py-3 bg-darkCard border border-gray-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-gray-800 active:scale-95 transition-all"
                >
                <Share2 className="w-4 h-4 text-blue-400" /> Compartilhar
                </button>
             </div>

            <button
              onClick={startNewScan}
              className="w-full py-3.5 bg-emerald-500 text-[#0A0D14] rounded-xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all shadow-lg"
            >
              Nova Leitura
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

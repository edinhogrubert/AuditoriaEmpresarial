import React, { useState, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, ChevronLeft, ChevronRight, Copy, Check, QrCode as QrIcon, Share2, Sparkles, FileJson } from 'lucide-react';
import { createQrChunks } from '../utils/qrChunker';

interface QrCodeExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  payload: any; // Object or array to be encoded
}

export const QrCodeExportModal: React.FC<QrCodeExportModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  payload,
}) => {
  const [currentPartIndex, setCurrentPartIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  // Generate QR Chunks automatically
  const chunks = useMemo(() => {
    if (!payload) return [];
    return createQrChunks(payload, 350); // ~350 chars per QR code chunk for clean camera scanning
  }, [payload]);

  if (!isOpen || chunks.length === 0) return null;

  const totalParts = chunks.length;
  const currentChunkText = chunks[currentPartIndex];

  const handleCopyText = () => {
    navigator.clipboard.writeText(currentChunkText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const jsonString = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);

  const handleDownloadJson = () => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `export_${title.toLowerCase().replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-[150] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-200 select-none">
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[2.5rem] p-6 w-full max-w-sm space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar flex flex-col justify-between">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-500 border border-sky-500/20">
              <QrIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)] truncate max-w-[180px]">
                {title}
              </h2>
              {subtitle && (
                <p className="text-[10px] text-[var(--text-dim)] font-medium truncate">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* QR Code Container */}
        <div className="flex flex-col items-center space-y-4 py-2 shrink-0">
          <div className="bg-white p-4 rounded-3xl border-4 border-sky-500/30 shadow-xl flex items-center justify-center">
            <QRCodeSVG
              value={currentChunkText}
              size={210}
              level="M"
              includeMargin={true}
            />
          </div>

          {/* Part Multi-Chunk Indicator Banner */}
          {totalParts > 1 ? (
            <div className="w-full bg-[var(--bg-primary)] border border-sky-500/30 p-3 rounded-2xl flex items-center justify-between text-xs font-bold text-sky-600 dark:text-sky-400">
              <button
                onClick={() => setCurrentPartIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentPartIndex === 0}
                className="p-1.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] disabled:opacity-30 active:scale-95 transition-all text-[var(--text-primary)]"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="text-center space-y-0.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] block">
                  Parte {currentPartIndex + 1} de {totalParts}
                </span>
                <span className="text-[9px] font-mono font-semibold text-[var(--text-dim)] block">
                  Transfira lendo cada QR Code sequencialmente
                </span>
              </div>

              <button
                onClick={() => setCurrentPartIndex((prev) => Math.min(totalParts - 1, prev + 1))}
                disabled={currentPartIndex === totalParts - 1}
                className="p-1.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] disabled:opacity-30 active:scale-95 transition-all text-[var(--text-primary)]"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="text-center">
              <span className="text-[10px] font-extrabold uppercase text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                🟢 QR Code Único Pronto para Leitura
              </span>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="space-y-2 pt-2 border-t border-[var(--border-color)] shrink-0">
          <button
            onClick={handleDownloadJson}
            className="w-full py-3 bg-[#002b59] hover:bg-[#0f3d73] text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 shadow-md flex items-center justify-center gap-2"
          >
            <FileJson className="w-4 h-4 text-sky-300" />
            <span>Baixar Arquivo .JSON</span>
          </button>

          <button
            onClick={handleCopyText}
            className="w-full py-2.5 bg-[var(--bg-primary)] hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-2xl text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center gap-1.5"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-[var(--text-dim)]" />}
            <span>{copied ? 'Código Copiado!' : 'Copiar Texto Interno do QR'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

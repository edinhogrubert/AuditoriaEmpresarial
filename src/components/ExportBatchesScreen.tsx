import React, { useState } from 'react';
import { ArrowLeft, Download, Check, FileJson, QrCode } from 'lucide-react';
import { Batch, ScanItem } from '../types';
import { formatDateStr, getScanCountForBatch, exportMultipleBatchesToCsv, getExpectedItemsForBatch } from '../services/storage';
import { QrCodeExportModal } from './QrCodeExportModal';

interface ExportBatchesScreenProps {
  batches: Batch[];
  allItems: ScanItem[];
  onBack: () => void;
}

export const ExportBatchesScreen: React.FC<ExportBatchesScreenProps> = ({
  batches,
  allItems,
  onBack,
}) => {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [exportModalPayload, setExportModalPayload] = useState<any | null>(null);

  const allSelected = batches.length > 0 && selectedIds.length === batches.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(batches.map((b) => b.id));
    }
  };

  const toggleBatch = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((bId) => bId !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const getSelectedBatchesData = () => {
    const selectedBatches = batches.filter((b) => selectedIds.includes(b.id));
    return selectedBatches.map((b) => {
      const scans = allItems.filter((i) => i.batchId === b.id);
      const expected = getExpectedItemsForBatch(b.id);
      return {
        batch: b,
        scans,
        expected,
      };
    });
  };

  const handleExportCsv = () => {
    const selectedBatches = batches.filter((b) => selectedIds.includes(b.id));
    if (selectedBatches.length > 0) {
      exportMultipleBatchesToCsv(selectedBatches, allItems);
    }
  };

  const handleExportJson = () => {
    const data = getSelectedBatchesData();
    if (data.length === 0) return;

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.body.appendChild(document.createElement('a'));
    link.href = url;
    link.download = `export_lotes_${Date.now()}.json`;
    link.click();
    document.body.removeChild(link);
  };

  const handleExportQr = () => {
    const data = getSelectedBatchesData();
    if (data.length === 0) return;
    setExportModalPayload(data);
  };

  return (
    <div className="min-h-screen text-[var(--text-primary)] bg-[var(--bg-primary)] flex flex-col justify-between max-w-md mx-auto p-6 select-none relative border-x border-[var(--border-color)] pb-8">
      <div className="space-y-6 flex-1 overflow-hidden flex flex-col">
        {/* Top Header */}
        <div className="flex items-center gap-4 pb-4 border-b border-[var(--border-color)] shrink-0">
          <button
            onClick={onBack}
            className="p-2.5 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-color)] active:scale-95 transition-all shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-black uppercase tracking-tight">Exportar Lotes</h1>
        </div>

        <p className="text-xs text-[var(--text-secondary)] font-medium leading-relaxed px-1 shrink-0">
          Selecione os lotes desejados para exportação via CSV, JSON ou transferência direta via QR Code.
        </p>

        {/* Select All Card */}
        <button
          onClick={toggleSelectAll}
          className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl p-4 flex items-center gap-4 text-left hover:border-[var(--text-dim)] transition-all shadow-md shrink-0"
        >
          <div
            className={`w-7 h-7 rounded-xl border-2 flex items-center justify-center transition-all ${
              allSelected
                ? 'bg-[var(--color-blue)] border-[var(--color-blue)] text-white shadow-lg'
                : 'border-[var(--border-color)] bg-[var(--bg-primary)] shadow-inner'
            }`}
          >
            {allSelected && <Check className="w-4 h-4 stroke-[4]" />}
          </div>
          <span className="text-sm font-black uppercase tracking-widest flex-1">
            Selecionar Todos
          </span>
          <span className="text-[10px] font-bold text-[var(--text-dim)] font-mono">
            {batches.length} LOTES
          </span>
        </button>

        {/* Batches List */}
        <div className="space-y-3 overflow-y-auto flex-1 pr-1 custom-scrollbar pb-2">
          {batches.map((batch) => {
            const isSelected = selectedIds.includes(batch.id);
            const count = getScanCountForBatch(batch.id);

            return (
              <div
                key={batch.id}
                onClick={() => toggleBatch(batch.id)}
                className={`w-full card-elevated p-4 flex items-center gap-4 cursor-pointer transition-all shadow-sm ${
                  isSelected ? 'border-[var(--color-blue)]/50 bg-[var(--bg-secondary)]/90' : 'hover:border-[var(--text-dim)]'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                    isSelected
                      ? 'bg-[var(--color-blue)] border-[var(--color-blue)] text-white'
                      : 'border-[var(--border-color)] bg-[var(--bg-primary)] shadow-inner'
                  }`}
                >
                  {isSelected && <Check className="w-3.5 h-3.5 stroke-[4]" />}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-black uppercase tracking-tight truncate">
                    {batch.name}
                  </h3>
                  <p className="text-[10px] text-[var(--text-secondary)] font-bold font-mono-code mt-0.5 opacity-80 uppercase tracking-tighter">
                    {count} itens • {formatDateStr(batch.timestamp)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Export Options Bar */}
      <div className="pt-4 border-t border-[var(--border-color)] space-y-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-dim)] ml-1 block">
          Formato de Exportação ({selectedIds.length} selecionados)
        </span>

        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={handleExportCsv}
            disabled={selectedIds.length === 0}
            className="py-3 bg-[#002b59] hover:bg-[#0f3d73] disabled:opacity-30 disabled:pointer-events-none text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 shadow-xs flex flex-col items-center justify-center gap-1"
          >
            <Download className="w-4 h-4 text-sky-300" />
            <span>Planilha CSV</span>
          </button>

          <button
            onClick={handleExportJson}
            disabled={selectedIds.length === 0}
            className="py-3 bg-[var(--bg-secondary)] hover:bg-[var(--bg-primary)] border border-[var(--border-color)] disabled:opacity-30 disabled:pointer-events-none text-[var(--text-primary)] rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 shadow-xs flex flex-col items-center justify-center gap-1"
          >
            <FileJson className="w-4 h-4 text-emerald-500" />
            <span>Arquivo JSON</span>
          </button>

          <button
            onClick={handleExportQr}
            disabled={selectedIds.length === 0}
            className="py-3 bg-[var(--bg-secondary)] hover:bg-[var(--bg-primary)] border border-[var(--border-color)] disabled:opacity-30 disabled:pointer-events-none text-[var(--text-primary)] rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 shadow-xs flex flex-col items-center justify-center gap-1"
          >
            <QrCode className="w-4 h-4 text-sky-500" />
            <span>Gerar QR Code</span>
          </button>
        </div>
      </div>

      {/* QR Export Modal */}
      {exportModalPayload && (
        <QrCodeExportModal
          isOpen={!!exportModalPayload}
          onClose={() => setExportModalPayload(null)}
          title={`Exportar (${selectedIds.length} Lotes)`}
          subtitle="Transfira os lotes selecionados de um celular para outro"
          payload={exportModalPayload}
        />
      )}
    </div>
  );
};


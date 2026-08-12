import React, { useState } from 'react';
import { X, RefreshCw, Plus, ShieldAlert, Check, FileJson, Sparkles, AlertTriangle } from 'lucide-react';
import { BackupData, restoreBackup } from '../utils/qrChunker';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  backupData: BackupData;
  onSuccess: (message: string) => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  onClose,
  backupData,
  onSuccess,
}) => {
  const [isConfirmingReplace, setIsConfirmingReplace] = useState(false);

  if (!isOpen || !backupData) return null;

  const batchCount = (backupData.batches || []).length;
  const itemCount = (backupData.items || []).length;
  const expectedCount = (backupData.expected || []).length;

  const handleExecuteRestore = (mode: 'REPLACE' | 'MERGE') => {
    try {
      const stats = restoreBackup(backupData, mode);
      const modeText = mode === 'REPLACE' ? 'Substituição Total (Zerar Base)' : 'Mesclagem Inteligente';
      onSuccess(
        `Restauração realizada (${modeText}): ${stats.importedBatchesCount} Lotes, ${stats.importedItemsCount} Leituras, ${stats.importedExpectedCount} Itens Mestre.`
      );
      onClose();
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (e: any) {
      alert(`Erro ao restaurar backup: ${e.message || 'Arquivo inválido'}`);
    }
  };

  return (
    <div className="fixed inset-0 z-[160] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 select-none">
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[2.5rem] p-6 w-full max-w-md space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-sky-500/10 text-sky-500 border border-sky-500/20">
              <FileJson className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-black uppercase tracking-tight text-[var(--text-primary)]">
                Restaurar Backup
              </h2>
              <p className="text-[10px] text-[var(--text-dim)] font-medium">
                Escolha a lógica de importação dos dados
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Backup Summary Card */}
        <div className="bg-[var(--bg-primary)] p-4 rounded-2xl border border-[var(--border-color)] space-y-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-sky-600 dark:text-sky-400 block">
            Conteúdo Detectado no Arquivo
          </span>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-[var(--bg-secondary)] p-2.5 rounded-xl border border-[var(--border-color)]">
              <span className="text-[9px] font-bold uppercase text-[var(--text-dim)] block">Lotes</span>
              <span className="text-base font-black text-sky-500">{batchCount}</span>
            </div>
            <div className="bg-[var(--bg-secondary)] p-2.5 rounded-xl border border-[var(--border-color)]">
              <span className="text-[9px] font-bold uppercase text-[var(--text-dim)] block">Leituras</span>
              <span className="text-base font-black text-emerald-500">{itemCount}</span>
            </div>
            <div className="bg-[var(--bg-secondary)] p-2.5 rounded-xl border border-[var(--border-color)]">
              <span className="text-[9px] font-bold uppercase text-[var(--text-dim)] block">Mestre</span>
              <span className="text-base font-black text-amber-500">{expectedCount}</span>
            </div>
          </div>

          {backupData.exportedAt && (
            <p className="text-[9px] text-[var(--text-dim)] font-mono text-center">
              Gerado em: {new Date(backupData.exportedAt).toLocaleString('pt-BR')}
            </p>
          )}
        </div>

        {/* Option Choices */}
        {!isConfirmingReplace ? (
          <div className="space-y-3 pt-1">
            {/* Option 1: Merge */}
            <button
              onClick={() => handleExecuteRestore('MERGE')}
              className="w-full card-elevated p-4 rounded-2xl border border-sky-500/30 hover:border-sky-500 flex items-center gap-4 text-left transition-all active:scale-[0.98] shadow-md group"
            >
              <div className="p-3 rounded-xl bg-sky-500/10 text-sky-500 border border-sky-500/20 shrink-0 group-hover:scale-110 transition-transform">
                <Plus className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-tight text-[var(--text-primary)]">
                    🔵 Mesclar com Dados Locais
                  </span>
                  <span className="text-[8px] font-extrabold uppercase bg-sky-500/10 text-sky-500 px-2 py-0.5 rounded-full border border-sky-500/20">
                    Recomendado
                  </span>
                </div>
                <p className="text-[10px] text-[var(--text-secondary)] mt-1 leading-relaxed">
                  Adiciona os lotes e itens do arquivo mantendo todos os dados já cadastrados neste celular.
                </p>
              </div>
            </button>

            {/* Option 2: Full Replace */}
            <button
              onClick={() => setIsConfirmingReplace(true)}
              className="w-full card-elevated p-4 rounded-2xl border border-red-500/30 hover:border-red-500 flex items-center gap-4 text-left transition-all active:scale-[0.98] shadow-md group"
            >
              <div className="p-3 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 shrink-0 group-hover:scale-110 transition-transform">
                <RefreshCw className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-black uppercase tracking-tight text-red-600 dark:text-red-400 block">
                  🔴 Zerar Base e Substituir Tudo
                </span>
                <p className="text-[10px] text-[var(--text-secondary)] mt-1 leading-relaxed">
                  Apaga o banco de dados atual deste aparelho e restaura exatamente a cópia do backup.
                </p>
              </div>
            </button>
          </div>
        ) : (
          /* Confirm Replace Alert Warning */
          <div className="bg-red-500/10 border-2 border-red-500/40 p-4 rounded-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-xs font-black uppercase tracking-wider">
                Atenção: Ação Irreversível!
              </h3>
            </div>
            <p className="text-[10px] text-[var(--text-primary)] font-medium leading-relaxed">
              Você selecionou **Zerar Base e Substituir**. Todos os inventários e leituras atuais deste aparelho serão removidos permanentemente para dar lugar ao backup.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setIsConfirmingReplace(false)}
                className="flex-1 py-3 bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-xl text-[10px] font-extrabold uppercase tracking-wider"
              >
                Voltar
              </button>
              <button
                onClick={() => handleExecuteRestore('REPLACE')}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-md active:scale-95 transition-all"
              >
                Confirmar e Zerar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

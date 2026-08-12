import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle, X, FileText } from 'lucide-react';

interface CloseBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  batchName: string;
  missingCount: number;
  onConfirm: (reason: string) => void;
}

export const CloseBatchModal: React.FC<CloseBatchModalProps> = ({
  isOpen,
  onClose,
  batchName,
  missingCount,
  onConfirm,
}) => {
  const [reason, setReason] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(reason);
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-md flex items-center justify-center p-5 animate-in fade-in duration-200">
      <form
        onSubmit={handleSubmit}
        className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[2.2rem] p-6 w-full max-w-sm space-y-5 shadow-2xl scale-100"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl ${missingCount > 0 ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30' : 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'}`}>
              {missingCount > 0 ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-black uppercase tracking-tight text-[var(--text-primary)]">
                Finalizar Auditoria
              </h3>
              <p className="text-[10px] text-[var(--text-dim)] font-medium truncate max-w-[180px]">
                {batchName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {missingCount > 0 ? (
          <div className="bg-amber-500/10 border border-amber-500/20 p-3.5 rounded-2xl text-xs font-semibold text-amber-600 dark:text-amber-400 space-y-1">
            <p className="font-bold flex items-center gap-1.5">
              <span>⚠️ Restam {missingCount} patrimônios não localizados!</span>
            </p>
            <p className="text-[11px] font-normal opacity-90">
              Você pode finalizar a auditoria mesmo assim registrando uma justificativa abaixo.
            </p>
          </div>
        ) : (
          <div className="bg-emerald-500/10 border border-emerald-500/20 p-3.5 rounded-2xl text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <p className="font-bold">✓ 100% dos patrimônios foram encontrados com sucesso!</p>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-sky-500" />
            <span>Motivo / Observação de Finalização</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              missingCount > 0
                ? 'Ex: Bens extraviados ou transferidos sem baixa no sistema...'
                : 'Ex: Auditoria realizada com sucesso sem pendências.'
            }
            rows={3}
            className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-xs font-medium rounded-2xl p-3 focus:outline-none focus:border-sky-500 transition-colors shadow-inner resize-none text-[var(--text-primary)]"
          />
        </div>

        <div className="space-y-2 pt-1">
          <button
            type="submit"
            className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>FINALIZAR AUDITORIA</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 text-center text-xs font-bold text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
};

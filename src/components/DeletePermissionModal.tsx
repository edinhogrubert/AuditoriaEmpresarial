import React from 'react';
import { Lock, Unlock, ShieldCheck, ShieldAlert, X, Trash2 } from 'lucide-react';
import { DeletePermission } from '../types';

interface DeletePermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  deletePermission: DeletePermission;
  itemBarcode?: string;
  onConfirmDelete: () => void;
  onConfirmDeleteOnce: () => void;
  onConfirmDeleteAlways: () => void;
}

export const DeletePermissionModal: React.FC<DeletePermissionModalProps> = ({
  isOpen,
  onClose,
  deletePermission,
  itemBarcode,
  onConfirmDelete,
  onConfirmDeleteOnce,
  onConfirmDeleteAlways,
}) => {
  if (!isOpen) return null;

  if (deletePermission === 'ALWAYS' || deletePermission === 'ONCE') {
    const isAlways = deletePermission === 'ALWAYS';

    return (
      <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-5 animate-in fade-in duration-200">
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[2.2rem] p-6 w-full max-w-sm space-y-5 shadow-2xl scale-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-2xl border ${isAlways ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' : 'bg-sky-500/15 text-sky-500 border-sky-500/30'}`}>
                {isAlways ? <ShieldCheck className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-base font-black uppercase tracking-tight text-[var(--text-primary)]">
                  Confirmar Exclusão
                </h3>
                <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider flex items-center gap-1">
                  {isAlways ? 'Liberar sempre está ativo' : 'Liberado para 1x exclusão'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors rounded-full"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="bg-[var(--bg-primary)] p-4 rounded-2xl border border-[var(--border-color)] space-y-2">
            <p className="text-xs text-[var(--text-secondary)] font-medium">
              Tem certeza que deseja excluir este registro do lote?
            </p>
            {itemBarcode && (
              <p className="text-sm font-black font-mono-code text-[var(--text-primary)] bg-[var(--bg-secondary)] p-2.5 rounded-xl border border-[var(--border-color)] text-center tracking-wider">
                {itemBarcode}
              </p>
            )}
          </div>

          <div className="space-y-2.5">
            <button
              onClick={onConfirmDelete}
              className="w-full py-3.5 px-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2.5 transition-all shadow-md active:scale-95"
            >
              <Trash2 className="w-4 h-4" />
              <span>Sim, Excluir Item</span>
            </button>

            <button
              onClick={onClose}
              className="w-full py-3 px-4 bg-[var(--bg-primary)] hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-2xl font-bold text-xs uppercase tracking-wider transition-all active:scale-95"
            >
              Não, Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-5 animate-in fade-in duration-200">
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[2.2rem] p-6 w-full max-w-sm space-y-5 shadow-2xl scale-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/15 text-amber-500 border border-amber-500/30">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black uppercase tracking-tight text-[var(--text-primary)]">
                Exclusão Bloqueada
              </h3>
              <p className="text-[10px] text-[var(--text-dim)] font-medium">
                Proteção ativada nos Ajustes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-[var(--text-secondary)] font-medium leading-relaxed bg-[var(--bg-primary)] p-3.5 rounded-2xl border border-[var(--border-color)]">
          Para evitar perdas acidentais de registros, a exclusão requer permissão. Como deseja proceder?
        </p>

        <div className="space-y-2.5">
          <button
            onClick={onConfirmDeleteOnce}
            className="w-full py-3.5 px-4 bg-sky-600 hover:bg-sky-500 text-white rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2.5 transition-all shadow-md active:scale-95"
          >
            <Unlock className="w-4 h-4" />
            <span>Liberar 1x e Excluir Item</span>
          </button>

          <button
            onClick={onConfirmDeleteAlways}
            className="w-full py-3.5 px-4 bg-[var(--bg-primary)] hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2.5 transition-all shadow-xs active:scale-95"
          >
            <ShieldAlert className="w-4 h-4 text-emerald-500" />
            <span>Liberar sempre (Ir em Ajustes)</span>
          </button>

          <button
            onClick={onClose}
            className="w-full py-2 text-center text-xs font-bold text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors pt-1"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};

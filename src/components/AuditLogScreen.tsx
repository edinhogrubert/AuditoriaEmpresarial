import React from 'react';
import {
  ArrowLeft,
  Clock,
  AlertTriangle,
  Trash2,
  FilePlus2,
  Lock,
  Unlock,
  Download,
  Package,
} from 'lucide-react';
import { Batch } from '../types';
import {
  getAuditLogsForBatch,
  formatTimeStr,
  formatDateStr,
  exportAuditLogsToCsv,
} from '../services/storage';

interface AuditLogScreenProps {
  batch: Batch;
  onBack: () => void;
}

export const AuditLogScreen: React.FC<AuditLogScreenProps> = ({ batch, onBack }) => {
  const logs = getAuditLogsForBatch(batch.id);

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'DUPLICATE_BLOCK':
        return <AlertTriangle className="w-5 h-5 text-orange-400" />;
      case 'ITEM_REMOVED':
        return <Trash2 className="w-5 h-5 text-red-400" />;
      case 'IMPORT_START':
        return <FilePlus2 className="w-5 h-5 text-blue-400" />;
      case 'BATCH_CLOSED':
        return <Lock className="w-5 h-5 text-purple-400" />;
      case 'BATCH_OPENED':
        return <Unlock className="w-5 h-5 text-emerald-400" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getEventTitle = (type: string) => {
    switch (type) {
      case 'DUPLICATE_BLOCK': return 'Bloqueio de Duplicidade';
      case 'ITEM_REMOVED': return 'Exclusão de Registro';
      case 'IMPORT_START': return 'Importação de Dados';
      case 'BATCH_CLOSED': return 'Lote Encerrado';
      case 'BATCH_OPENED': return 'Lote Reaberto';
      case 'MANUAL_ENTRY': return 'Entrada Manual';
      default: return 'Evento do Sistema';
    }
  };

  return (
    <div className="min-h-screen text-[var(--text-primary)] flex flex-col max-w-md mx-auto p-6 select-none relative pb-28 border-x border-[var(--border-color)]">
      {/* Top Bar */}
      <div className="flex items-center justify-between pb-6 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2.5 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-color)] active:scale-95 transition-all shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-black uppercase tracking-tight">Histórico de Eventos</h1>
            <p className="text-[10px] text-[var(--text-dim)] font-bold uppercase tracking-widest">{batch.name}</p>
          </div>
        </div>
      </div>

      <main className="py-6 space-y-6 flex-1 overflow-hidden flex flex-col">
        <div className="px-1">
          <span className="text-[10px] font-mono font-bold bg-[var(--bg-secondary)] text-[var(--color-blue)] px-2.5 py-1 rounded-md border border-[var(--border-color)] shadow-xs inline-block">
            AuditLogScreen.tsx
          </span>
        </div>

        <div className="flex items-center justify-between px-1 shrink-0">
            <h2 className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em]">Linha do Tempo ({logs.length})</h2>
            <button
                onClick={() => exportAuditLogsToCsv(batch)}
                className="flex items-center gap-1.5 text-[10px] font-black uppercase text-[var(--color-blue)] hover:underline"
            >
                <Download className="w-3 h-3" /> Exportar Logs (CSV)
            </button>
        </div>

        {logs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center opacity-30 py-12">
            <Clock className="w-12 h-12 mb-4" />
            <p className="text-xs font-black uppercase tracking-widest">Nenhum evento registrado</p>
          </div>
        ) : (
          <div className="space-y-4 overflow-y-auto flex-1 pr-1 custom-scrollbar">
            {logs.map((log: any) => (
              <div key={log.id} className="relative pl-8 before:content-[''] before:absolute before:left-[11px] before:top-8 before:bottom-[-16px] before:w-[2px] before:bg-[var(--border-color)] last:before:hidden">
                <div className="absolute left-0 top-1.5 w-6 h-6 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-color)] flex items-center justify-center z-10">
                   <div className="w-1.5 h-1.5 rounded-full bg-[var(--text-dim)]" />
                </div>

                <div className="card-elevated p-4 shadow-sm space-y-2">
                   <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                         {getEventIcon(log.type)}
                         <span className="text-[11px] font-black uppercase tracking-tight">{getEventTitle(log.type)}</span>
                      </div>
                      <span className="text-[9px] font-bold text-[var(--text-dim)] font-mono-code">{formatDateStr(log.timestamp)} {formatTimeStr(log.timestamp)}</span>
                   </div>

                   <p className="text-xs text-[var(--text-secondary)] font-medium leading-relaxed">
                      {log.message}
                   </p>

                   {log.barcode && (
                     <div className="pt-1 flex items-center gap-2">
                        <Package className="w-3 h-3 text-[var(--text-dim)]" />
                        <span className="text-[10px] font-bold font-mono-code bg-[var(--bg-primary)] px-2 py-0.5 rounded border border-[var(--border-color)]">
                           ID: {log.barcode}
                        </span>
                     </div>
                   )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

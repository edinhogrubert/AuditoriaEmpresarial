import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Search,
  X,
  Boxes,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FolderOpen,
  ChevronRight,
  PackageCheck,
  Tag,
} from 'lucide-react';
import { getAllAssetRecords, AssetRecord, formatDateStr, formatTimeStr } from '../services/storage';

interface AssetsListScreenProps {
  onBack: () => void;
  onOpenBatchDetails: (batchId: number) => void;
}

export const AssetsListScreen: React.FC<AssetsListScreenProps> = ({
  onBack,
  onOpenBatchDetails,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'ENCONTRADO' | 'PENDENTE' | 'SOBRA_COLETADO'>('ALL');

  const allRecords = useMemo(() => getAllAssetRecords(), []);

  const filteredRecords = useMemo(() => {
    return allRecords.filter((record) => {
      // Status Filter
      if (selectedStatus === 'ENCONTRADO' && record.status !== 'ENCONTRADO') return false;
      if (selectedStatus === 'PENDENTE' && record.status !== 'PENDENTE') return false;
      if (
        selectedStatus === 'SOBRA_COLETADO' &&
        record.status !== 'SOBRA' &&
        record.status !== 'COLETADO'
      ) {
        return false;
      }

      // Search Query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        record.barcode.toLowerCase().includes(q) ||
        record.description.toLowerCase().includes(q) ||
        record.category.toLowerCase().includes(q) ||
        record.batchName.toLowerCase().includes(q)
      );
    });
  }, [allRecords, searchQuery, selectedStatus]);

  const stats = useMemo(() => {
    let encontrados = 0;
    let pendentes = 0;
    let sobras = 0;

    allRecords.forEach((r) => {
      if (r.status === 'ENCONTRADO') encontrados++;
      else if (r.status === 'PENDENTE') pendentes++;
      else sobras++;
    });

    return { total: allRecords.length, encontrados, pendentes, sobras };
  }, [allRecords]);

  return (
    <div className="min-h-screen text-[var(--text-primary)] bg-[var(--bg-primary)] flex flex-col max-w-md mx-auto p-5 select-none relative pb-12 border-x border-[var(--border-color)]">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2.5 rounded-full bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-color)] active:scale-95 transition-all shadow-xs"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
              <Boxes className="w-5 h-5 text-sky-500" />
              <span>Patrimônios</span>
            </h1>
            <p className="text-[10px] text-[var(--text-dim)] font-medium">
              {filteredRecords.length} de {allRecords.length} itens cadastrados
            </p>
          </div>
        </div>
      </div>

      <div className="py-4 space-y-4 flex-1 overflow-hidden flex flex-col">
        <div className="px-1">
          <span className="text-[10px] font-mono font-bold bg-[var(--bg-secondary)] text-[var(--color-blue)] px-2.5 py-1 rounded-md border border-[var(--border-color)] shadow-xs inline-block">
            AssetsListScreen.tsx
          </span>
        </div>
        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por código, descrição, lote..."
            className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs font-semibold rounded-2xl pl-10 pr-9 py-3 focus:outline-none focus:border-sky-500 transition-colors shadow-inner"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[var(--text-dim)] hover:text-[var(--text-primary)]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Chips */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1 shrink-0">
          <button
            onClick={() => setSelectedStatus('ALL')}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all border whitespace-nowrap ${
              selectedStatus === 'ALL'
                ? 'bg-sky-500/15 border-sky-500/30 text-sky-600 dark:text-sky-400'
                : 'bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-secondary)]'
            }`}
          >
            Todos ({stats.total})
          </button>

          <button
            onClick={() => setSelectedStatus('ENCONTRADO')}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all border whitespace-nowrap ${
              selectedStatus === 'ENCONTRADO'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                : 'bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-secondary)]'
            }`}
          >
            Encontrados ({stats.encontrados})
          </button>

          <button
            onClick={() => setSelectedStatus('PENDENTE')}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all border whitespace-nowrap ${
              selectedStatus === 'PENDENTE'
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400'
                : 'bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-secondary)]'
            }`}
          >
            Pendentes ({stats.pendentes})
          </button>

          <button
            onClick={() => setSelectedStatus('SOBRA_COLETADO')}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all border whitespace-nowrap ${
              selectedStatus === 'SOBRA_COLETADO'
                ? 'bg-purple-500/15 border-purple-500/30 text-purple-600 dark:text-purple-400'
                : 'bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-secondary)]'
            }`}
          >
            Sobras / Outros ({stats.sobras})
          </button>
        </div>

        {/* Items List */}
        {filteredRecords.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50 py-12">
            <div className="w-16 h-16 rounded-2xl bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-dim)] mb-3 border border-[var(--border-color)]">
              <FolderOpen className="w-7 h-7" />
            </div>
            <p className="text-xs font-bold text-[var(--text-primary)]">Nenhum patrimônio encontrado</p>
            <p className="text-[10px] text-[var(--text-dim)] mt-1">Tente alterar o termo de busca ou o filtro selecionado.</p>
          </div>
        ) : (
          <div className="space-y-3 overflow-y-auto flex-1 pr-1 custom-scrollbar pb-6">
            {filteredRecords.map((item) => {
              let badgeColor = 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400';
              let badgeIcon = <Clock className="w-3.5 h-3.5" />;
              let badgeLabel = 'Pendente';

              if (item.status === 'ENCONTRADO') {
                badgeColor = 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400';
                badgeIcon = <CheckCircle2 className="w-3.5 h-3.5" />;
                badgeLabel = 'Encontrado';
              } else if (item.status === 'SOBRA') {
                badgeColor = 'bg-orange-500/10 border-orange-500/20 text-orange-600 dark:text-orange-400';
                badgeIcon = <AlertTriangle className="w-3.5 h-3.5" />;
                badgeLabel = 'Sobra';
              } else if (item.status === 'COLETADO') {
                badgeColor = 'bg-sky-500/10 border-sky-500/20 text-sky-600 dark:text-sky-400';
                badgeIcon = <PackageCheck className="w-3.5 h-3.5" />;
                badgeLabel = 'Coletado';
              }

              return (
                <div
                  key={item.id}
                  onClick={() => onOpenBatchDetails(item.batchId)}
                  className="card-elevated p-4 flex flex-col gap-2.5 transition-all hover:border-[var(--text-dim)] shadow-xs active:scale-[0.99] cursor-pointer group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono-code font-black text-sm text-[var(--text-primary)] uppercase tracking-tight">
                          {item.barcode}
                        </span>
                      </div>
                      <h4 className="text-xs font-semibold text-[var(--text-secondary)] mt-0.5 line-clamp-1">
                        {item.description}
                      </h4>
                    </div>

                    <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold border flex items-center gap-1 shrink-0 ${badgeColor}`}>
                      {badgeIcon}
                      <span>{badgeLabel}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-medium text-[var(--text-dim)] pt-1 border-t border-[var(--border-color)]/50">
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <Tag className="w-3 h-3 text-[var(--text-dim)] shrink-0" />
                      <span className="truncate">{item.category} • <strong className="text-[var(--text-secondary)]">{item.batchName}</strong></span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[var(--text-dim)] group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

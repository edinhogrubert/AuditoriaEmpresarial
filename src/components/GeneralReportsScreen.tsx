import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  BarChart3,
  Calendar,
  Layers,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Package,
  Search,
  Download,
  PieChart,
  Activity,
  FileText,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Building2,
  Filter,
  TrendingDown,
  Copy,
  Check,
  Zap,
  AlertCircle,
  FileCheck2,
  Share2,
} from 'lucide-react';
import { Batch, ExpectedItem, ScanItem } from '../types';
import {
  formatDateStr,
  getAuditStatsForBatch,
  getScanItemsForBatch,
  getExpectedItemsForBatch,
  exportMultipleBatchesToCsv,
  getStoredScanItems,
  getStoredExpectedItems,
  formatTimeStr,
} from '../services/storage';

interface GeneralReportsScreenProps {
  batches: Batch[];
  onBack: () => void;
  onOpenBatchDetails: (batchId: number) => void;
  onNavigateBatchList: () => void;
}

export const GeneralReportsScreen: React.FC<GeneralReportsScreenProps> = ({
  batches,
  onBack,
  onOpenBatchDetails,
  onNavigateBatchList,
}) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'divergences' | 'timeline' | 'insights'>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [batchTypeFilter, setBatchTypeFilter] = useState<'all' | 'VERIFICATION' | 'COLLECTION'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'closed' | 'open'>('all');
  const [copiedDossier, setCopiedDossier] = useState(false);
  const [showDossierModal, setShowDossierModal] = useState(false);

  // Global datasets
  const allScans = useMemo(() => getStoredScanItems(), [batches]);
  const allExpected = useMemo(() => getStoredExpectedItems(), [batches]);

  // Filtered Batches
  const filteredBatches = useMemo(() => {
    return batches.filter((b) => {
      const matchesSearch =
        b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = batchTypeFilter === 'all' || b.type === batchTypeFilter;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'closed' && b.isClosed) ||
        (statusFilter === 'open' && !b.isClosed);
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [batches, searchQuery, batchTypeFilter, statusFilter]);

  // Calculated Aggregate Audit Statistics
  const statsSummary = useMemo(() => {
    const totalBatches = batches.length;
    const verificationBatches = batches.filter((b) => b.type === 'VERIFICATION');
    const collectionBatches = batches.filter((b) => b.type === 'COLLECTION');
    const closedBatches = batches.filter((b) => b.isClosed);
    const openBatches = totalBatches - closedBatches.length;

    let totalExpected = 0;
    let totalFound = 0;
    let totalMissing = 0;
    let totalExtra = 0;

    const batchStatsList = batches.map((b) => {
      const stats = getAuditStatsForBatch(b.id);
      const scans = getScanItemsForBatch(b.id);
      if (b.type === 'VERIFICATION') {
        totalExpected += stats.totalExpected;
        totalFound += stats.foundCount;
        totalMissing += stats.missingCount;
        totalExtra += stats.extraCount;
      } else {
        totalExtra += scans.length;
      }
      return {
        batch: b,
        stats,
        scansCount: scans.length,
      };
    });

    const globalAccuracy =
      totalExpected > 0 ? Math.round((totalFound / totalExpected) * 100) : 100;
    const globalDiscrepancyRate =
      totalExpected > 0 ? Math.round(((totalMissing + totalExtra) / totalExpected) * 100) : 0;

    // Risk level calculation
    let riskLevel: 'BAIXO' | 'MÉDIO' | 'ELEVADO' = 'BAIXO';
    let riskColor = 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
    if (globalAccuracy < 80 || totalMissing > totalFound * 0.25) {
      riskLevel = 'ELEVADO';
      riskColor = 'text-red-500 bg-red-500/10 border-red-500/20';
    } else if (globalAccuracy < 92 || totalExtra > totalFound * 0.15) {
      riskLevel = 'MÉDIO';
      riskColor = 'text-amber-500 bg-amber-500/10 border-amber-500/20';
    }

    return {
      totalBatches,
      verificationCount: verificationBatches.length,
      collectionCount: collectionBatches.length,
      closedCount: closedBatches.length,
      openCount: openBatches,
      totalExpected,
      totalFound,
      totalMissing,
      totalExtra,
      totalScans: allScans.length,
      globalAccuracy,
      globalDiscrepancyRate,
      riskLevel,
      riskColor,
      batchStatsList,
    };
  }, [batches, allScans, allExpected]);

  // Prefix Analysis (Detecting patterns in barcode categories like PAT-, EQP-, etc.)
  const prefixAnalysis = useMemo(() => {
    const prefixMap = new Map<string, { total: number; found: number; missing: number }>();
    
    allExpected.forEach((exp) => {
      const prefix = exp.barcode.includes('-')
        ? exp.barcode.split('-')[0].toUpperCase()
        : exp.barcode.substring(0, 3).toUpperCase() || 'SEM PREFIXO';

      const curr = prefixMap.get(prefix) || { total: 0, found: 0, missing: 0 };
      curr.total += 1;
      if (exp.isFound) curr.found += 1;
      else curr.missing += 1;
      prefixMap.set(prefix, curr);
    });

    return Array.from(prefixMap.entries())
      .map(([prefix, counts]) => ({
        prefix,
        total: counts.total,
        found: counts.found,
        missing: counts.missing,
        accuracyPercent: counts.total > 0 ? Math.round((counts.found / counts.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [allExpected]);

  // Timeline / Date grouping
  const timelineDates = useMemo(() => {
    const map = new Map<string, number>();
    allScans.forEach((s) => {
      const dateStr = formatDateStr(s.timestamp);
      map.set(dateStr, (map.get(dateStr) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [allScans]);

  const handleExportAll = () => {
    exportMultipleBatchesToCsv(batches, allScans);
  };

  // Executive Dossier Generator Text
  const generateDossierText = () => {
    const dateNow = new Date().toLocaleDateString('pt-BR');
    const timeNow = new Date().toLocaleTimeString('pt-BR').slice(0, 5);
    return `================================================
  DOSSIÊ DE ESTUDO & DIAGNÓSTICO DE AUDITORIA
================================================
Data do Relatório: ${dateNow} às ${timeNow}

1. RESUMO EXECUTIVO
------------------------------------------------
- Total de Lotes Cadastrados: ${statsSummary.totalBatches} (${statsSummary.verificationCount} Auditorias / ${statsSummary.collectionCount} Coletas)
- Estado dos Lotes: ${statsSummary.closedCount} Concluídos | ${statsSummary.openCount} Em Aberto
- Nível de Risco Contábil: ${statsSummary.riskLevel}

2. INDICADORES DE ACURÁCIA FÍSICA E DIVERGÊNCIAS
------------------------------------------------
- Total de Ativos Esperados: ${statsSummary.totalExpected}
- Ativos Conciliados (Achados): ${statsSummary.totalFound} (${statsSummary.globalAccuracy}%)
- Ativos Faltantes (Divergência Negativa): ${statsSummary.totalMissing}
- Sobras / Excedentes (Divergência Positiva): ${statsSummary.totalExtra}
- Volume Total de Leituras Efetuadas: ${statsSummary.totalScans}

3. DIAGNÓSTICO POR CATEGORIA / PREFIXO
------------------------------------------------
${
  prefixAnalysis.length > 0
    ? prefixAnalysis
        .map(
          (p) =>
            `- Grupo [${p.prefix}]: ${p.found}/${p.total} Encontrados (${p.accuracyPercent}% acurácia) | Faltantes: ${p.missing}`
        )
        .join('\n')
    : '- Sem prefixos categorizados cadastrados.'
}

4. RECOMENDAÇÕES DA AUDITORIA
------------------------------------------------
${
  statsSummary.globalAccuracy < 90
    ? '* Recomenda-se contagem cega de verificação para lotes com acurácia abaixo de 90%.'
    : '* Acurácia global em patamar satisfatório.'
}
${
  statsSummary.totalExtra > 0
    ? '* Proceder com a regularização patrimonial das sobras identificadas.'
    : '* Nenhuma sobra sem cadastro detectada.'
}
${
  statsSummary.openCount > 0
    ? '* Finalizar oficialmente os lotes em aberto para emissão do balanço definitivo.'
    : '* Todos os lotes foram devidamente encerrados.'
}
================================================`;
  };

  const handleCopyDossier = () => {
    navigator.clipboard.writeText(generateDossierText());
    setCopiedDossier(true);
    setTimeout(() => setCopiedDossier(false), 2500);
  };

  return (
    <div className="min-h-screen text-[var(--text-primary)] bg-[var(--bg-primary)] flex flex-col max-w-md mx-auto p-5 select-none relative pb-16 shadow-xl border-x border-[var(--border-color)]">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="p-2.5 rounded-full bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-color)] active:scale-95 transition-all shadow-sm shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-base font-black uppercase tracking-tight truncate">Relatórios & Insights</h1>
            <p className="text-[10px] text-[var(--text-dim)] font-semibold truncate">Estudo de Auditoria & Indicadores</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowDossierModal(true)}
            className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 active:scale-95 transition-all shadow-xs flex items-center gap-1.5 px-2.5"
            title="Gerar Dossiê da Auditoria"
          >
            <FileText className="w-4 h-4" />
            <span className="text-[10px] font-extrabold uppercase">Dossiê</span>
          </button>
          <button
            onClick={handleExportAll}
            className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 active:scale-95 transition-all shadow-xs flex items-center gap-1.5 px-2.5"
            title="Exportar Dados em CSV"
          >
            <Download className="w-4 h-4" />
            <span className="text-[10px] font-extrabold uppercase">CSV</span>
          </button>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="grid grid-cols-4 gap-1 p-1 bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] shadow-xs my-3 shrink-0">
        {[
          { id: 'dashboard', label: 'Painel', icon: BarChart3 },
          { id: 'divergences', label: 'Divergências', icon: AlertTriangle },
          { id: 'timeline', label: 'Histórico', icon: Calendar },
          { id: 'insights', label: 'Estudo', icon: Sparkles },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 flex flex-col items-center gap-1 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all ${
                isActive
                  ? 'bg-[#002b59] dark:bg-sky-600 text-white shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar pb-6">
        {/* TAB 1: PAINEL EXECUTIVO */}
        {activeTab === 'dashboard' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Executive Risk & Health Banner */}
            <div className="card-elevated p-4 rounded-2xl border border-[var(--border-color)] space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-sky-500" />
                  <span className="text-xs font-black uppercase tracking-tight">Status Geral de Auditoria</span>
                </div>
                <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-xl border ${statsSummary.riskColor}`}>
                  Risco {statsSummary.riskLevel}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-baseline text-xs font-black">
                  <span className="text-[10px] text-[var(--text-dim)] uppercase">Acurácia Física Global</span>
                  <span className="text-emerald-500 font-extrabold">{statsSummary.globalAccuracy}%</span>
                </div>
                <div className="w-full bg-[var(--bg-primary)] h-3 rounded-full overflow-hidden border border-[var(--border-color)] p-0.5">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-700 shadow-sm"
                    style={{ width: `${Math.min(100, Math.max(0, statsSummary.globalAccuracy))}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-[var(--text-dim)] font-semibold pt-0.5">
                  <span>{statsSummary.totalFound} Conciliados</span>
                  <span>{statsSummary.totalMissing} Faltantes</span>
                </div>
              </div>
            </div>

            {/* Key Metric Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="card-elevated p-3.5 space-y-1 border-l-4 border-l-sky-500">
                <div className="flex items-center justify-between text-[var(--text-dim)]">
                  <span className="text-[9px] font-black uppercase tracking-wider">Total Lotes</span>
                  <Layers className="w-4 h-4 text-sky-500" />
                </div>
                <div className="text-xl font-black">{statsSummary.totalBatches}</div>
                <p className="text-[10px] text-[var(--text-dim)] font-medium truncate">
                  {statsSummary.verificationCount} Auditorias • {statsSummary.collectionCount} Coletas
                </p>
              </div>

              <div className="card-elevated p-3.5 space-y-1 border-l-4 border-l-purple-500">
                <div className="flex items-center justify-between text-[var(--text-dim)]">
                  <span className="text-[9px] font-black uppercase tracking-wider">Ativos Lidos</span>
                  <Activity className="w-4 h-4 text-purple-500" />
                </div>
                <div className="text-xl font-black">{statsSummary.totalScans}</div>
                <p className="text-[10px] text-[var(--text-dim)] font-medium truncate">
                  Leituras registradas
                </p>
              </div>

              <div className="card-elevated p-3.5 space-y-1 border-l-4 border-l-emerald-500">
                <div className="flex items-center justify-between text-[var(--text-dim)]">
                  <span className="text-[9px] font-black uppercase tracking-wider">Concluídos</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                  {statsSummary.closedCount}
                </div>
                <p className="text-[10px] text-[var(--text-dim)] font-medium truncate">
                  Lotes finalizados
                </p>
              </div>

              <div className="card-elevated p-3.5 space-y-1 border-l-4 border-l-amber-500">
                <div className="flex items-center justify-between text-[var(--text-dim)]">
                  <span className="text-[9px] font-black uppercase tracking-wider">Em Aberto</span>
                  <Clock className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-xl font-black text-amber-600 dark:text-amber-400">
                  {statsSummary.openCount}
                </div>
                <p className="text-[10px] text-[var(--text-dim)] font-medium truncate">
                  Pendentes de fecho
                </p>
              </div>
            </div>

            {/* Batch Benchmarking Chart / Matrix */}
            <div className="card-elevated p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-tight flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-sky-500" />
                  <span>Comparativo de Acurácia dos Lotes</span>
                </h3>
              </div>

              <div className="space-y-2.5">
                {statsSummary.batchStatsList.length === 0 ? (
                  <p className="text-xs text-[var(--text-dim)] text-center py-6 font-semibold">
                    Nenhum lote cadastrado para comparativo.
                  </p>
                ) : (
                  statsSummary.batchStatsList.map(({ batch, stats, scansCount }) => (
                    <div
                      key={batch.id}
                      onClick={() => onOpenBatchDetails(batch.id)}
                      className="p-3 bg-[var(--bg-secondary)] hover:bg-[var(--bg-primary)] rounded-2xl border border-[var(--border-color)] space-y-2 cursor-pointer transition-all active:scale-[0.99] shadow-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="text-xs font-extrabold truncate text-[var(--text-primary)]">{batch.name}</h4>
                          <span className="text-[9px] font-bold text-[var(--text-dim)] uppercase">
                            {batch.type === 'VERIFICATION' ? 'Auditoria' : 'Coleta'} • {formatDateStr(batch.timestamp)}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-black px-2.5 py-0.5 rounded-lg shrink-0 ${
                            batch.isClosed
                              ? 'bg-emerald-500/15 text-emerald-500'
                              : 'bg-amber-500/15 text-amber-500'
                          }`}
                        >
                          {batch.isClosed ? 'CONCLUÍDO' : 'EM ABERTO'}
                        </span>
                      </div>

                      {batch.type === 'VERIFICATION' ? (
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-bold">
                            <span className="text-[var(--text-dim)]">Progresso</span>
                            <span className="text-sky-500">{stats.progressPercent}%</span>
                          </div>
                          <div className="w-full bg-[var(--bg-primary)] h-2 rounded-full overflow-hidden border border-[var(--border-color)]">
                            <div
                              className="bg-sky-500 h-full rounded-full transition-all duration-500"
                              style={{ width: `${stats.progressPercent}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="text-[10px] font-bold text-[var(--text-secondary)]">
                          Total de itens coletados: <span className="font-extrabold text-[var(--text-primary)]">{scansCount}</span>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ANÁLISE DE DIVERGÊNCIAS */}
        {activeTab === 'divergences' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Divergence Metrics Breakdown */}
            <div className="card-elevated p-4 space-y-3">
              <h3 className="text-xs font-black uppercase tracking-tight flex items-center gap-2 text-amber-500">
                <AlertTriangle className="w-4 h-4" />
                <span>Análise de Discrepâncias de Estoque</span>
              </h3>
              <p className="text-[11px] text-[var(--text-secondary)] font-medium leading-relaxed">
                Estudo da diferença entre os bens esperados nas planilhas de carga e a leitura física realizada em campo.
              </p>

              <div className="grid grid-cols-3 gap-2 text-center pt-1">
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl space-y-0.5">
                  <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Conciliados</span>
                  <p className="text-base font-black text-emerald-600 dark:text-emerald-400">{statsSummary.totalFound}</p>
                </div>

                <div className="bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl space-y-0.5">
                  <span className="text-[9px] font-bold text-red-600 dark:text-red-400 uppercase">Faltantes</span>
                  <p className="text-base font-black text-red-600 dark:text-red-400">{statsSummary.totalMissing}</p>
                </div>

                <div className="bg-sky-500/10 border border-sky-500/20 p-2.5 rounded-xl space-y-0.5">
                  <span className="text-[9px] font-bold text-sky-600 dark:text-sky-400 uppercase">Excedentes</span>
                  <p className="text-base font-black text-sky-600 dark:text-sky-400">{statsSummary.totalExtra}</p>
                </div>
              </div>
            </div>

            {/* Prefix Pattern Analysis */}
            <div className="card-elevated p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-tight flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-purple-500" />
                  <span>Divergência por Prefixo / Categoria</span>
                </h3>
              </div>
              <p className="text-[10px] text-[var(--text-dim)] font-medium">
                Padrões identificados nos códigos para localizar setores com maior perda ou desvio de ativos.
              </p>

              <div className="space-y-2">
                {prefixAnalysis.length === 0 ? (
                  <p className="text-xs text-[var(--text-dim)] text-center py-6 font-semibold">
                    Nenhum prefixo registrado nos itens esperados.
                  </p>
                ) : (
                  prefixAnalysis.map((p) => (
                    <div
                      key={p.prefix}
                      className="p-3 bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black font-mono-code px-2 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                          {p.prefix}
                        </span>
                        <span className="text-xs font-extrabold text-[var(--text-primary)]">
                          {p.found} / {p.total} ({p.accuracyPercent}%)
                        </span>
                      </div>

                      <div className="w-full bg-[var(--bg-primary)] h-2 rounded-full overflow-hidden border border-[var(--border-color)]">
                        <div
                          className="bg-purple-500 h-full rounded-full transition-all"
                          style={{ width: `${p.accuracyPercent}%` }}
                        />
                      </div>

                      <div className="flex justify-between text-[10px] text-[var(--text-dim)] font-semibold">
                        <span>Encontrados: {p.found}</span>
                        <span className="text-red-500">Faltantes: {p.missing}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Filtered Batches List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pt-2">
                <h3 className="text-xs font-black uppercase tracking-tight">Detalhamento dos Lotes</h3>
                <span className="text-[10px] font-bold text-[var(--text-dim)]">{filteredBatches.length} Lote(s)</span>
              </div>

              {/* Quick Filters */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                <button
                  onClick={() => setBatchTypeFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-extrabold uppercase transition-all ${
                    batchTypeFilter === 'all'
                      ? 'bg-[#002b59] text-white shadow-xs'
                      : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-color)]'
                  }`}
                >
                  Todos Tipos
                </button>
                <button
                  onClick={() => setBatchTypeFilter('VERIFICATION')}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-extrabold uppercase transition-all ${
                    batchTypeFilter === 'VERIFICATION'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-color)]'
                  }`}
                >
                  Auditorias
                </button>
                <button
                  onClick={() => setBatchTypeFilter('COLLECTION')}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-extrabold uppercase transition-all ${
                    batchTypeFilter === 'COLLECTION'
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-color)]'
                  }`}
                >
                  Coletas
                </button>
              </div>

              {filteredBatches.map((b) => {
                const stats = getAuditStatsForBatch(b.id);
                const scans = getScanItemsForBatch(b.id);

                return (
                  <div
                    key={b.id}
                    onClick={() => onOpenBatchDetails(b.id)}
                    className="card-elevated p-3.5 space-y-2 cursor-pointer transition-all active:scale-[0.99]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-black text-[var(--text-primary)]">{b.name}</h4>
                        <p className="text-[10px] text-[var(--text-dim)] font-medium">
                          {formatDateStr(b.timestamp)} • {b.description || 'Sem observações'}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[var(--text-dim)] shrink-0" />
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 pt-1 text-center text-[10px] font-bold">
                      <div className="bg-[var(--bg-secondary)] p-1.5 rounded-lg border border-[var(--border-color)]">
                        <span className="text-[8px] text-[var(--text-dim)] block uppercase">Leituras</span>
                        <span>{scans.length}</span>
                      </div>
                      {b.type === 'VERIFICATION' ? (
                        <>
                          <div className="bg-[var(--bg-secondary)] p-1.5 rounded-lg border border-[var(--border-color)]">
                            <span className="text-[8px] text-[var(--text-dim)] block uppercase">Faltantes</span>
                            <span className="text-red-500">{stats.missingCount}</span>
                          </div>
                          <div className="bg-[var(--bg-secondary)] p-1.5 rounded-lg border border-[var(--border-color)]">
                            <span className="text-[8px] text-[var(--text-dim)] block uppercase">Excedentes</span>
                            <span className="text-sky-500">{stats.extraCount}</span>
                          </div>
                        </>
                      ) : (
                        <div className="col-span-2 bg-[var(--bg-secondary)] p-1.5 rounded-lg border border-[var(--border-color)] text-emerald-500 font-extrabold">
                          LOTE DE COLETA SIMPLES
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: LINHA DO TEMPO / PRODUTIVIDADE */}
        {activeTab === 'timeline' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="card-elevated p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-sky-500" />
                <h3 className="text-xs font-black uppercase tracking-tight">Produtividade de Leitura por Data</h3>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] font-medium">
                Análise do volume diário de contagens patrimoniais registradas no sistema.
              </p>
            </div>

            <div className="space-y-2.5">
              {timelineDates.length === 0 ? (
                <div className="text-center py-12 text-[var(--text-dim)] space-y-2">
                  <Clock className="w-10 h-10 mx-auto opacity-40" />
                  <p className="text-xs font-bold">Nenhum registro de data localizado</p>
                </div>
              ) : (
                timelineDates.map(([dateStr, count]) => (
                  <div key={dateStr} className="card-elevated p-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-500 border border-sky-500/20">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-[var(--text-primary)]">{dateStr}</h4>
                        <p className="text-[10px] text-[var(--text-dim)] font-medium">Volume de leituras ativas</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-black text-sky-500">{count} leituras</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 4: ESTUDO & PLANO DE AÇÃO */}
        {activeTab === 'insights' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Header Box */}
            <div className="card-elevated p-4 space-y-2 border-l-4 border-l-amber-500">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <h3 className="text-xs font-black uppercase tracking-tight">Plano de Ação & Estudo de Auditoria</h3>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                Recomendações e diagnósticos automáticos gerados com base nas discrepâncias e acurácia dos dados.
              </p>
            </div>

            {/* Diagnostic Cards */}
            <div className="space-y-3">
              {/* Alert: Open Batches */}
              {statsSummary.openCount > 0 && (
                <div className="card-elevated p-4 space-y-2 border border-amber-500/30 bg-amber-500/5">
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-[11px] font-black uppercase tracking-wider">Ação Recomendada: Finalizar Lotes</span>
                  </div>
                  <p className="text-xs font-bold text-[var(--text-primary)]">
                    Existem {statsSummary.openCount} lote(s) ainda em aberto. Recomendamos encerrar as leituras para congelar o saldo da auditoria.
                  </p>
                </div>
              )}

              {/* Alert: Surplus / Extras */}
              {statsSummary.totalExtra > 0 && (
                <div className="card-elevated p-4 space-y-2 border border-sky-500/30 bg-sky-500/5">
                  <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400">
                    <Package className="w-4 h-4" />
                    <span className="text-[11px] font-black uppercase tracking-wider">Sobras de Estoque ({statsSummary.totalExtra})</span>
                  </div>
                  <p className="text-xs font-bold text-[var(--text-primary)]">
                    Ativos lidos sem cadastro prévio no esperado. É indicado proceder com o tombamento ou regularização patrimonial destes itens.
                  </p>
                </div>
              )}

              {/* Alert: Low Accuracy */}
              {statsSummary.globalAccuracy < 85 && (
                <div className="card-elevated p-4 space-y-2 border border-red-500/30 bg-red-500/5">
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                    <TrendingDown className="w-4 h-4" />
                    <span className="text-[11px] font-black uppercase tracking-wider">Acurácia Abaixo da Meta</span>
                  </div>
                  <p className="text-xs font-bold text-[var(--text-primary)]">
                    A acurácia global está em {statsSummary.globalAccuracy}%. Sugere-se realizar recontagem amostral nos lotes com mais de 20% de faltantes.
                  </p>
                </div>
              )}

              {/* Action Plan Interactive Checklist */}
              <div className="card-elevated p-4 space-y-3">
                <h4 className="text-xs font-black uppercase tracking-tight flex items-center gap-2">
                  <FileCheck2 className="w-4 h-4 text-emerald-500" />
                  <span>Checklist Pós-Auditoria</span>
                </h4>

                <div className="space-y-2 text-xs font-semibold text-[var(--text-secondary)]">
                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] cursor-pointer">
                    <input type="checkbox" defaultChecked={statsSummary.closedCount > 0} className="rounded accent-emerald-500 w-4 h-4" />
                    <span>Revisar e encerrar lotes em aberto</span>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] cursor-pointer">
                    <input type="checkbox" defaultChecked={statsSummary.totalExtra === 0} className="rounded accent-emerald-500 w-4 h-4" />
                    <span>Tombamento de sobras / ativos excedentes</span>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] cursor-pointer">
                    <input type="checkbox" className="rounded accent-emerald-500 w-4 h-4" />
                    <span>Conciliação com balanço financeiro/contábil</span>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] cursor-pointer">
                    <input type="checkbox" className="rounded accent-emerald-500 w-4 h-4" />
                    <span>Emissão e arquivamento do Dossiê em PDF/CSV</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dossier Modal */}
      {showDossierModal && (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[2rem] p-5 w-full max-w-sm space-y-4 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-sky-500" />
                <h3 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">
                  Dossiê da Auditoria
                </h3>
              </div>
              <button
                onClick={() => setShowDossierModal(false)}
                className="text-xs font-extrabold text-[var(--text-dim)] hover:text-[var(--text-primary)] px-2 py-1"
              >
                Fechar
              </button>
            </div>

            <p className="text-[11px] text-[var(--text-dim)] font-medium">
              Relatório consolidado para apresentação e arquivo contábil.
            </p>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 bg-[var(--bg-primary)] rounded-2xl border border-[var(--border-color)] font-mono text-[10px] leading-relaxed whitespace-pre-wrap select-text text-[var(--text-primary)]">
              {generateDossierText()}
            </div>

            <div className="space-y-2 pt-1">
              <button
                onClick={handleCopyDossier}
                className="w-full py-3 px-4 bg-[#002b59] hover:bg-[#0f3d73] text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md"
              >
                {copiedDossier ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-sky-300" />}
                <span>{copiedDossier ? 'Copiado para Área de Transferência!' : 'Copiar Texto do Dossiê'}</span>
              </button>

              <button
                onClick={() => setShowDossierModal(false)}
                className="w-full py-2.5 px-4 bg-[var(--bg-primary)] text-[var(--text-secondary)] border border-[var(--border-color)] rounded-xl font-bold text-xs uppercase tracking-wider"
              >
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


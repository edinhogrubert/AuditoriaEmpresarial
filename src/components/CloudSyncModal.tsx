import React, { useState, useEffect } from 'react';
import {
  Cloud,
  CloudOff,
  CloudDownload,
  CloudUpload,
  X,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Database,
  Lock,
  ArrowDownCircle,
  ArrowUpCircle,
  FolderSync
} from 'lucide-react';
import { Batch } from '../types';
import {
  getStoredBatches,
  formatDateStr,
  getAuditStatsForBatch,
  getStoredDeviceTag,
  getStoredDeviceCustomName,
  saveStoredDeviceCustomName,
} from '../services/storage';
import {
  getFirebaseStatusInfo,
  fetchCloudBatchesList,
  uploadSingleBatchToCloud,
  downloadSingleBatchFromCloud,
  registerOrGetDeviceSequence,
  CloudBatchSummary,
} from '../services/firebase';
import { User, Tag } from 'lucide-react';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataChanged: () => void;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  isOpen,
  onClose,
  onDataChanged,
}) => {
  const [activeTab, setActiveTab] = useState<'download' | 'upload'>('download');
  const [cloudBatches, setCloudBatches] = useState<CloudBatchSummary[]>([]);
  const [loadingCloud, setLoadingCloud] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [operatorNameInput, setOperatorNameInput] = useState<string>(getStoredDeviceCustomName());
  const [deviceTag, setDeviceTag] = useState<string | null>(getStoredDeviceTag());
  const [isRegisteringTag, setIsRegisteringTag] = useState(false);

  const firebaseStatus = getFirebaseStatusInfo();
  const localBatches = getStoredBatches();

  const handleRegisterDeviceTag = async (forceNew: boolean = false) => {
    setIsRegisteringTag(true);
    try {
      const tag = await registerOrGetDeviceSequence(operatorNameInput, forceNew);
      setDeviceTag(tag);
      saveStoredDeviceCustomName(operatorNameInput);
      setStatusMessage(`Identidade do dispositivo configurada com sucesso: ${tag}`);
    } catch (e: any) {
      setErrorMessage('Falha ao registrar sequencial: ' + e.message);
    } finally {
      setIsRegisteringTag(false);
    }
  };

  const loadCloudList = async () => {
    if (!firebaseStatus.configured) return;
    setLoadingCloud(true);
    setErrorMessage(null);
    try {
      // Auto-ensure device tag exists
      if (!getStoredDeviceTag()) {
        const tag = await registerOrGetDeviceSequence(operatorNameInput);
        setDeviceTag(tag);
      }
      const list = await fetchCloudBatchesList();
      setCloudBatches(list);
    } catch (err: any) {
      setErrorMessage('Não foi possível carregar os lotes da nuvem: ' + err.message);
    } finally {
      setLoadingCloud(false);
    }
  };

  useEffect(() => {
    if (isOpen && firebaseStatus.configured) {
      loadCloudList();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDownload = async (batchId: number, batchName: string) => {
    setActionLoadingId(batchId);
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      await downloadSingleBatchFromCloud(batchId);
      setStatusMessage(`Lote "${batchName}" baixado com sucesso para o seu celular!`);
      onDataChanged();
      loadCloudList();
    } catch (err: any) {
      setErrorMessage('Erro ao carregar lote: ' + err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleUpload = async (batch: Batch) => {
    setActionLoadingId(batch.id);
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      const res = await uploadSingleBatchToCloud(batch.id);
      if (res.wasClosedOnCloud) {
        setStatusMessage(
          `Aviso: O lote "${batch.name}" já constava como encerrado na nuvem, mas suas novas leituras extras foram mescladas (Merge) com sucesso!`
        );
      } else if (res.isMerged) {
        setStatusMessage(`Lote "${batch.name}" mesclado e atualizado na nuvem com sucesso!`);
      } else {
        setStatusMessage(`Lote "${batch.name}" enviado para a nuvem com sucesso!`);
      }
      onDataChanged();
      loadCloudList();
    } catch (err: any) {
      setErrorMessage('Erro ao descarregar lote na nuvem: ' + err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
      <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-secondary)]">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${firebaseStatus.configured ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
              <FolderSync className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black uppercase tracking-tight text-sm text-[var(--text-primary)]">
                Carga & Descarga Cloud (Firebase)
              </h3>
              <p className="text-[10px] text-[var(--text-secondary)] font-medium">
                Sincronização manual por lote com Fusão (Merge) de dados
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Connection Status Badge */}
        <div className="px-5 pt-4">
          <div className={`p-3 rounded-2xl border flex items-center justify-between text-xs ${
            firebaseStatus.configured
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
          }`}>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                {firebaseStatus.configured ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </>
                ) : (
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                )}
              </span>
              <span className="font-bold">
                {firebaseStatus.configured ? 'Conectado ao Cloud Firestore' : 'Modo Off-line LocalStorage'}
              </span>
            </div>
            {firebaseStatus.configured && (
              <button
                onClick={loadCloudList}
                disabled={loadingCloud}
                className="flex items-center gap-1 text-[11px] font-bold underline hover:opacity-80 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingCloud ? 'animate-spin' : ''}`} />
                Atualizar Lista
              </button>
            )}
          </div>

          {/* Device Sequential Identity Card */}
          <div className="mt-2.5 p-3.5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[var(--color-blue)]" />
                <span className="text-[10px] font-black uppercase text-[var(--text-secondary)] tracking-wider">
                  Identificador Sequencial do Aparelho
                </span>
              </div>
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--color-blue)]/10 text-[var(--color-blue)] border border-[var(--color-blue)]/20 text-[10px] font-mono font-bold">
                <Tag className="w-3 h-3" />
                <span>{deviceTag || 'Pendente'}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={operatorNameInput}
                onChange={(e) => setOperatorNameInput(e.target.value)}
                placeholder="Ex: Pedro, Auditor, SetorA"
                className="flex-1 px-3 py-1.5 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl text-xs font-semibold focus:outline-none focus:border-[var(--color-blue)] text-[var(--text-primary)]"
              />
              <button
                onClick={() => handleRegisterDeviceTag(true)}
                disabled={isRegisteringTag}
                className="px-3 py-1.5 bg-[var(--color-blue)] hover:opacity-90 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shrink-0 flex items-center gap-1 active:scale-95 disabled:opacity-50"
                title="Gera o próximo número na sequência (Ex: Pedro_1, Pedro_2)"
              >
                {isRegisteringTag ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'Próxima Seq. +'}
              </button>
            </div>
            <p className="text-[9px] text-[var(--text-dim)] leading-tight">
              Se múltiplos aparelhos usarem o nome &quot;{operatorNameInput || 'Pedro'}&quot;, a nuvem atribuirá sequenciais únicos (ex: <strong>{operatorNameInput || 'Pedro'}_1</strong>, <strong>{operatorNameInput || 'Pedro'}_2</strong>).
            </p>
          </div>
        </div>

        {/* Feedback Messages */}
        {statusMessage && (
          <div className="mx-5 mt-3 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="mx-5 mt-3 p-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex p-1 mx-5 mt-4 bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)]">
          <button
            onClick={() => setActiveTab('download')}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeTab === 'download'
                ? 'bg-[#002b59] dark:bg-sky-600 text-white shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <CloudDownload className="w-4 h-4" />
            <span>CARGA (Baixar da Nuvem)</span>
          </button>

          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeTab === 'upload'
                ? 'bg-[#002b59] dark:bg-sky-600 text-white shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <CloudUpload className="w-4 h-4" />
            <span>DESCARGA (Enviar p/ Nuvem)</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 flex-1 overflow-y-auto space-y-3 custom-scrollbar">
          {!firebaseStatus.configured ? (
            <div className="py-8 text-center space-y-3">
              <CloudOff className="w-12 h-12 text-amber-500 mx-auto opacity-80" />
              <h4 className="text-sm font-bold text-[var(--text-primary)]">Firebase Não Configurado</h4>
              <p className="text-xs text-[var(--text-secondary)] max-w-xs mx-auto leading-relaxed">
                Para carregar ou descarregar lotes na nuvem, adicione as chaves do Firebase nas configurações. Seus dados continuam seguros salvos localmente.
              </p>
            </div>
          ) : activeTab === 'download' ? (
            /* TAB: CARGA (Baixar da Nuvem) */
            loadingCloud ? (
              <div className="py-12 text-center text-xs text-[var(--text-secondary)] space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[var(--color-blue)]" />
                <p>Buscando lotes na nuvem do Firebase...</p>
              </div>
            ) : cloudBatches.length === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--text-dim)] space-y-1">
                <Database className="w-8 h-8 mx-auto opacity-50 mb-2" />
                <p className="font-bold uppercase tracking-wider text-[11px]">Nenhum lote na nuvem</p>
                <p>Nenhum lote foi enviado para o Firebase ainda.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-[11px] text-[var(--text-secondary)] font-semibold">
                  Selecione um lote abaixo para **baixar** e realizar/dar continuidade à auditoria off-line neste aparelho:
                </p>
                {cloudBatches.map((cb) => {
                  const isAlreadyLocal = localBatches.some((lb) => lb.id === cb.id);
                  const isLoading = actionLoadingId === cb.id;

                  return (
                    <div
                      key={cb.id}
                      className="p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] flex items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs font-black uppercase text-[var(--text-primary)] truncate">
                            {cb.name}
                          </h4>
                          <span className="px-2 py-0.5 rounded-full bg-[var(--color-blue)]/10 text-[var(--color-blue)] border border-[var(--color-blue)]/20 text-[9px] font-bold font-mono">
                            Criado por: {cb.createdBy || 'ADM_WEB'}
                          </span>
                          {cb.isClosed && (
                            <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 border border-red-500/20 text-[9px] font-bold flex items-center gap-1">
                              <Lock className="w-2.5 h-2.5" /> Concluído
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-[var(--text-secondary)] font-mono">
                          {cb.type === 'VERIFICATION'
                            ? `Auditoria • ${cb.foundCount || 0}/${cb.expectedCount || 0} encontrados`
                            : `Coleta • ${cb.scannedCount || 0} registros`}{' '}
                          • {formatDateStr(cb.timestamp)}
                        </p>
                      </div>

                      <button
                        onClick={() => handleDownload(cb.id, cb.name)}
                        disabled={isLoading}
                        className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 ${
                          isAlreadyLocal
                            ? 'bg-amber-500/10 text-amber-600 border border-amber-500/30 hover:bg-amber-500/20'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                        }`}
                      >
                        {isLoading ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <ArrowDownCircle className="w-4 h-4" />
                        )}
                        <span>{isAlreadyLocal ? 'Re-baixar' : 'Baixar Lote'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* TAB: DESCARGA (Enviar p/ Nuvem com Merge) */
            localBatches.length === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--text-dim)] space-y-1">
                <p className="font-bold uppercase tracking-wider text-[11px]">Sem Lotes Locais</p>
                <p>Não há nenhum lote criado ou lido no seu celular para enviar.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-[11px] text-[var(--text-secondary)] font-semibold">
                  Ao **descarregar** um lote para o Firebase, os seus registros serão enviados. Se o lote já existir na nuvem, é realizada uma **Fusão Inteligente (Merge)** agregando novas leituras.
                </p>
                {localBatches.map((lb) => {
                  const stats = getAuditStatsForBatch(lb.id);
                  const isLoading = actionLoadingId === lb.id;

                  return (
                    <div
                      key={lb.id}
                      className="p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] flex items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-black uppercase text-[var(--text-primary)] truncate">
                            {lb.name}
                          </h4>
                          {lb.isClosed && (
                            <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 border border-red-500/20 text-[9px] font-bold">
                              Concluído
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-[var(--text-secondary)] font-mono">
                          {lb.type === 'VERIFICATION'
                            ? `Auditoria • ${stats.foundCount}/${stats.totalExpected} (${stats.progressPercent}%)`
                            : `Coleta • ${stats.scannedCount} registros`}{' '}
                          • {formatDateStr(lb.timestamp)}
                        </p>
                      </div>

                      <button
                        onClick={() => handleUpload(lb)}
                        disabled={isLoading}
                        className="px-3 py-2 bg-[#002b59] hover:bg-[#0f3d73] text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 shadow-xs active:scale-95 disabled:opacity-50"
                      >
                        {isLoading ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <ArrowUpCircle className="w-4 h-4" />
                        )}
                        <span>Descarregar</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-secondary)] flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
          <p className="leading-snug">
            💡 <strong>Offline-First:</strong> As leituras continuam salvas no celular e só sobem para a nuvem sob seu comando.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[var(--bg-primary)] hover:bg-[var(--border-color)] text-[var(--text-primary)] rounded-xl font-bold border border-[var(--border-color)] ml-3 shrink-0"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

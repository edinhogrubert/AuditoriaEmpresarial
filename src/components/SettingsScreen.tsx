import React, { useState } from 'react';
import {
  ArrowLeft,
  Volume2,
  Vibrate,
  Camera,
  RotateCcw,
  Database,
  FileJson,
  Upload,
  CheckCircle2,
  Download,
  FileCode,
  Sparkles,
  Sun,
  Moon,
  Monitor,
  Trash2,
  Lock,
  Unlock,
  ShieldAlert,
  Barcode,
  Plus,
  X,
  Cloud,
  CloudUpload,
  CloudDownload,
} from 'lucide-react';
import { AppSettings, DeletePermission, BarcodePattern } from '../types';
import {
  saveSettings,
  getStoredDeviceTag,
  getStoredDeviceCustomName,
  saveStoredDeviceCustomName,
} from '../services/storage';
import { registerOrGetDeviceSequence } from '../services/firebase';
import { generateFullBackup, BackupData } from '../utils/qrChunker';
import { BackupModal } from './BackupModal';
import { CameraScanner } from './CameraScanner';
import { User, Tag, RefreshCw } from 'lucide-react';

interface SettingsScreenProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onBack: () => void;
  onResetData: () => void;
  onSyncToCloud?: () => void;
  onDownloadFromCloud?: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  settings,
  onUpdateSettings,
  onBack,
  onResetData,
  onSyncToCloud,
  onDownloadFromCloud,
}) => {
  const [current, setCurrent] = useState<AppSettings>(settings);
  const [savedNotice, setSavedNotice] = useState(false);
  const [pendingBackupData, setPendingBackupData] = useState<BackupData | null>(null);

  const [operatorNameInput, setOperatorNameInput] = useState<string>(getStoredDeviceCustomName());
  const [deviceTag, setDeviceTag] = useState<string | null>(getStoredDeviceTag());
  const [isRegisteringTag, setIsRegisteringTag] = useState(false);

  const handleRegisterDeviceTag = async (forceNew: boolean = false) => {
    setIsRegisteringTag(true);
    try {
      const tag = await registerOrGetDeviceSequence(operatorNameInput, forceNew);
      setDeviceTag(tag);
      saveStoredDeviceCustomName(operatorNameInput);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2000);
    } catch (e: any) {
      alert('Falha ao registrar sequencial: ' + e.message);
    } finally {
      setIsRegisteringTag(false);
    }
  };

  const [isPatternModalOpen, setIsPatternModalOpen] = useState(false);
  const [isScanningForPattern, setIsScanningForPattern] = useState(false);
  const [newPatternForm, setNewPatternForm] = useState<{
    format: string;
    prefix: string;
    length: string;
    usePrefix: boolean;
    useLength: boolean;
  }>({
    format: 'ANY',
    prefix: '',
    length: '',
    usePrefix: false,
    useLength: false,
  });

  const handleRemovePattern = (id: string) => {
    const patternsList = current.barcodePatterns || [];
    const updatedPatterns = patternsList.filter(p => p.id !== id);
    updateSetting('barcodePatterns', updatedPatterns);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  const handleAddPatternManually = () => {
    setNewPatternForm({
      format: 'ANY',
      prefix: '',
      length: '',
      usePrefix: false,
      useLength: false,
    });
    setIsScanningForPattern(false);
    setIsPatternModalOpen(true);
  };

  const toggle = (key: keyof AppSettings) => {
    const updated = { ...current, [key]: !current[key] };
    setCurrent(updated);
    onUpdateSettings(updated);
    saveSettings(updated);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  const updateSetting = (key: keyof AppSettings, val: any) => {
    const updated = { ...current, [key]: val };
    setCurrent(updated);
    onUpdateSettings(updated);
    saveSettings(updated);
  };

  const handleBackupExport = () => {
    const backup = generateFullBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.body.appendChild(document.createElement('a'));
    link.href = url;
    link.download = `backup_inventario_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleBackupImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const rawJson = evt.target?.result as string;
        const parsed = JSON.parse(rawJson);

        // Standardize backup format
        let normalized: BackupData;
        if (parsed.batches && typeof parsed.batches === 'string') {
          normalized = {
            batches: JSON.parse(parsed.batches || '[]'),
            items: JSON.parse(parsed.items || '[]'),
            expected: JSON.parse(parsed.expected || '[]'),
            logs: JSON.parse(parsed.logs || '[]'),
            settings: parsed.settings ? JSON.parse(parsed.settings) : undefined,
            exportedAt: parsed.exportedAt || new Date().toISOString(),
            version: '2.1',
          };
        } else {
          normalized = {
            batches: Array.isArray(parsed.batches) ? parsed.batches : [],
            items: Array.isArray(parsed.items) ? parsed.items : [],
            expected: Array.isArray(parsed.expected) ? parsed.expected : [],
            logs: Array.isArray(parsed.logs) ? parsed.logs : [],
            settings: parsed.settings,
            exportedAt: parsed.exportedAt || new Date().toISOString(),
            version: '2.1',
          };
        }

        setPendingBackupData(normalized);
      } catch (err) {
        alert('Formato de arquivo inválido. Certifique-se de selecionar um backup .JSON do sistema.');
      } finally {
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className={`min-h-screen text-[var(--text-primary)] flex flex-col max-w-md mx-auto p-6 select-none relative pb-12 border-x border-[var(--border-color)] transition-colors ${isScanningForPattern ? 'bg-transparent scanner-active-transparent' : 'bg-[var(--bg-primary)]'}`}>
      <div className="space-y-8 flex-1 overflow-y-auto pr-1 custom-scrollbar">
        <div className="px-1 pt-2">
          <span className="text-[10px] font-mono font-bold bg-[var(--bg-secondary)] text-[var(--color-blue)] px-2.5 py-1 rounded-md border border-[var(--border-color)] shadow-xs inline-block">
            SettingsScreen.tsx
          </span>
        </div>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-6">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2.5 rounded-full bg-[var(--bg-secondary)] active:scale-95 transition-all shadow-sm border border-[var(--border-color)]"><ArrowLeft className="w-5 h-5" /></button>
            <h1 className="text-xl font-black uppercase tracking-tight">Ajustes</h1>
          </div>
          {savedNotice && <span className="text-[9px] font-black uppercase text-[var(--color-emerald)] bg-[var(--color-emerald)]/10 px-3 py-1.5 rounded-xl border border-[var(--color-emerald)]/20 animate-in fade-in zoom-in-95">Salvo ✓</span>}
        </div>

        {/* Tema / Personalização */}
        <div className="space-y-4">
          <h2 className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.25em] ml-1">Estética do Sistema</h2>
          <div className="card-elevated p-6 space-y-6 shadow-lg border-blue-500/5">
             <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-[var(--color-blue)]/10 text-[var(--color-blue)] border border-[var(--color-blue)]/10"><Monitor className="w-6 h-6" /></div>
                <div><h3 className="text-sm font-black uppercase tracking-tight">Tema Visual</h3><p className="text-[10px] text-[var(--text-dim)] font-medium mt-1">Alternar modo claro e escuro</p></div>
             </div>
             <div className="grid grid-cols-2 gap-3 p-1.5 bg-[var(--bg-primary)] rounded-[1.25rem] border border-[var(--border-color)] shadow-inner">
                <button onClick={() => updateSetting('theme', 'light')} className={`flex items-center justify-center gap-2 py-3 rounded-xl transition-all ${current.theme === 'light' ? 'bg-[#002b59] dark:bg-sky-600 text-white shadow-xs font-bold' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-semibold'}`}><Sun className={`w-4 h-4 ${current.theme === 'light' ? 'fill-current' : ''}`} /><span className="text-xs uppercase tracking-wider">Claro</span></button>
                <button onClick={() => updateSetting('theme', 'dark')} className={`flex items-center justify-center gap-2 py-3 rounded-xl transition-all ${current.theme === 'dark' ? 'bg-[#002b59] dark:bg-sky-600 text-white shadow-xs font-bold' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-semibold'}`}><Moon className={`w-4 h-4 ${current.theme === 'dark' ? 'fill-current' : ''}`} /><span className="text-xs uppercase tracking-wider">Escuro</span></button>
             </div>
          </div>
        </div>

        {/* Permissão de Exclusão */}
        <div className="space-y-4">
          <h2 className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.25em] ml-1">
            Segurança de Leituras
          </h2>
          <div className="card-elevated p-6 space-y-5 shadow-lg border-amber-500/10">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-tight">Exclusão de Registros</h3>
                <p className="text-[10px] text-[var(--text-dim)] font-medium mt-0.5">
                  Proteção contra apagar linhas acidentalmente
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 p-1.5 bg-[var(--bg-primary)] rounded-[1.25rem] border border-[var(--border-color)] shadow-inner">
              <button
                onClick={() => updateSetting('deletePermission', 'LOCKED')}
                className={`flex flex-col items-center justify-center gap-1 py-3 px-1 rounded-xl transition-all ${
                  current.deletePermission === 'LOCKED'
                    ? 'bg-amber-600 text-white shadow-xs font-bold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-semibold'
                }`}
              >
                <Lock className="w-4 h-4" />
                <span className="text-[10px] uppercase tracking-tight text-center">Bloqueado</span>
              </button>

              <button
                onClick={() => updateSetting('deletePermission', 'ONCE')}
                className={`flex flex-col items-center justify-center gap-1 py-3 px-1 rounded-xl transition-all ${
                  current.deletePermission === 'ONCE'
                    ? 'bg-sky-600 text-white shadow-xs font-bold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-semibold'
                }`}
              >
                <Unlock className="w-4 h-4" />
                <span className="text-[10px] uppercase tracking-tight text-center">Liberar 1x</span>
              </button>

              <button
                onClick={() => updateSetting('deletePermission', 'ALWAYS')}
                className={`flex flex-col items-center justify-center gap-1 py-3 px-1 rounded-xl transition-all ${
                  current.deletePermission === 'ALWAYS'
                    ? 'bg-emerald-600 text-white shadow-xs font-bold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-semibold'
                }`}
              >
                <ShieldAlert className="w-4 h-4" />
                <span className="text-[10px] uppercase tracking-tight text-center">Sempre Lib.</span>
              </button>
            </div>

            <p className="text-[10px] text-[var(--text-dim)] font-medium italic leading-relaxed">
              {current.deletePermission === 'LOCKED' &&
                '• O botão de lixeira fica visível porém esmaecido. Ao clicar, solicitará confirmação de liberação.'}
              {current.deletePermission === 'ONCE' &&
                '• A exclusão está liberada para a próxima linha e será bloqueada automaticamente logo após.'}
              {current.deletePermission === 'ALWAYS' &&
                '• Botão de lixeira liberado sem restrições em todas as telas de leitura.'}
            </p>
          </div>
        </div>

        {/* Padrões de Código de Barras */}
        <div className="space-y-4">
          <h2 className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.25em] ml-1">
            Padrões de Código de Barras
          </h2>
          <div className="card-elevated p-6 space-y-4 shadow-lg border-emerald-500/5">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <Barcode className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-tight">Atalhos de Leitura (Máx. 3)</h3>
                <p className="text-[10px] text-[var(--text-dim)] font-medium mt-0.5">
                  Foque a câmera apenas nos formatos e comprimentos de patrimônio desejados
                </p>
              </div>
            </div>

            {/* List current patterns */}
            <div className="space-y-2">
              {!current.barcodePatterns || current.barcodePatterns.length === 0 ? (
                <div className="p-4 bg-[var(--bg-primary)] rounded-xl border border-dashed border-[var(--border-color)] text-center text-xs text-[var(--text-dim)] italic">
                  Nenhum padrão cadastrado. A câmera lerá qualquer código compatível.
                </div>
              ) : (
                current.barcodePatterns.map((pat, idx) => (
                  <div key={pat.id} className="flex items-center justify-between p-3.5 bg-[var(--bg-primary)] rounded-xl border border-[var(--border-color)] text-xs">
                    <div className="space-y-1">
                      <div className="font-bold flex items-center gap-2">
                        <span className="px-1.5 py-0.5 bg-[var(--color-blue)]/10 text-[var(--color-blue)] text-[9px] font-mono rounded">
                          {pat.format === 'ANY' ? 'QUALQUER' : pat.format}
                        </span>
                        <span>Padrão #{idx + 1}</span>
                      </div>
                      <div className="text-[10px] text-[var(--text-dim)] font-medium space-x-2">
                        {pat.prefix && <span>Prefixo: <strong className="font-mono text-[var(--text-primary)]">{pat.prefix}</strong></span>}
                        {pat.length && <span>Tam: <strong className="font-mono text-[var(--text-primary)]">{pat.length} ch</strong></span>}
                        {!pat.prefix && !pat.length && <span>Sem filtros de valor</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemovePattern(pat.id)}
                      className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {(!current.barcodePatterns || current.barcodePatterns.length < 3) && (
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={() => {
                    setNewPatternForm({
                      format: 'ANY',
                      prefix: '',
                      length: '',
                      usePrefix: false,
                      useLength: false,
                    });
                    setIsScanningForPattern(true);
                    setIsPatternModalOpen(true);
                  }}
                  className="py-3 px-3 bg-[var(--color-blue)]/10 border border-[var(--color-blue)]/20 text-[var(--color-blue)] hover:bg-[var(--color-blue)]/20 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                >
                  <Camera className="w-4 h-4" /> Escanear Código
                </button>
                <button
                  onClick={handleAddPatternManually}
                  className="py-3 px-3 bg-zinc-800 text-white hover:bg-zinc-700 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-95 transition-all border border-zinc-700"
                >
                  <Plus className="w-4 h-4" /> Digitar Padrão
                </button>
              </div>
            )}
            
            <p className="text-[9px] text-[var(--text-dim)] font-semibold leading-relaxed bg-[var(--bg-secondary)] p-3 rounded-xl border border-[var(--border-color)]">
              💡 <strong>Como agiliza?</strong> Ao restringir para os seus padrões (ex: EAN-13 iniciando com &quot;789&quot;), a câmera aceita somente os códigos de barras válidos para o seu processo, ignorando outras etiquetas ou códigos concorrentes na embalagem. <strong>A leitura de QR Code continua funcionando normalmente.</strong>
            </p>
          </div>
        </div>

        {/* Feedback Section */}
        <div className="space-y-4">
          <h2 className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.25em] ml-1">Respostas Háticas</h2>
          <div className="card-elevated p-1.5 shadow-md divide-y divide-[var(--border-color)]">
            <div className="flex items-center justify-between p-4.5 py-5 px-5">
                <div className="flex items-center gap-4"><div className="p-2.5 rounded-xl bg-[var(--color-emerald)]/10 text-[var(--color-emerald)] border border-[var(--color-emerald)]/10"><Volume2 className="w-5 h-5" /></div><span className="text-[11px] font-black uppercase tracking-widest">Bipe Sonoro</span></div>
                <button onClick={() => toggle('soundEnabled')} className={`w-12 h-7 rounded-full relative transition-all duration-300 shadow-inner ${current.soundEnabled ? 'bg-[var(--color-emerald)]' : 'bg-[var(--text-dim)]/30'}`}><div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-300 ${current.soundEnabled ? 'left-6' : 'left-1'}`} /></button>
            </div>
            <div className="flex items-center justify-between p-4.5 py-5 px-5">
                <div className="flex items-center gap-4"><div className="p-2.5 rounded-xl bg-[var(--color-blue)]/10 text-[var(--color-blue)] border border-[var(--color-blue)]/10"><Vibrate className="w-5 h-5" /></div><span className="text-[11px] font-black uppercase tracking-widest">Vibrar Motor</span></div>
                <button onClick={() => toggle('vibrationEnabled')} className={`w-12 h-7 rounded-full relative transition-all duration-300 shadow-inner ${current.vibrationEnabled ? 'bg-[var(--color-emerald)]' : 'bg-[var(--text-dim)]/30'}`}><div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-300 ${current.vibrationEnabled ? 'left-6' : 'left-1'}`} /></button>
            </div>
          </div>
        </div>

        {/* Identidade do Aparelho */}
        <div className="space-y-4">
          <h2 className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.25em] ml-1">
            Identidade do Aparelho (Sequencial)
          </h2>
          <div className="card-elevated p-6 space-y-4 shadow-lg border-sky-500/10">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                <User className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-black uppercase tracking-tight">Nome / Tag do Operador</h3>
                <p className="text-[10px] text-[var(--text-dim)] font-medium mt-0.5">
                  Gera sufixo sequencial automático no Firebase (Ex: Pedro_1, Pedro_2)
                </p>
              </div>
              <div className="px-2.5 py-1 rounded-xl bg-[var(--color-blue)]/10 text-[var(--color-blue)] border border-[var(--color-blue)]/20 text-xs font-mono font-bold flex items-center gap-1 shrink-0">
                <Tag className="w-3.5 h-3.5" />
                <span>{deviceTag || 'Pendente'}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={operatorNameInput}
                onChange={(e) => setOperatorNameInput(e.target.value)}
                placeholder="Ex: Pedro, Auditor, SetorA"
                className="flex-1 px-4 py-3 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl text-xs font-semibold focus:outline-none focus:border-[var(--color-blue)] text-[var(--text-primary)]"
              />
              <button
                onClick={() => handleRegisterDeviceTag(true)}
                disabled={isRegisteringTag}
                className="px-4 py-3 bg-[#002b59] hover:bg-[#0f3d73] text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shrink-0 flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
              >
                {isRegisteringTag ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Atualizar / Próximo +'}
              </button>
            </div>
            <p className="text-[9px] text-[var(--text-dim)] font-medium leading-relaxed italic">
              • O Firebase atribui um número incremental único para cada celular registrado sob o mesmo nome.
            </p>
          </div>
        </div>

        {/* Cloud Sync Section */}
        <div className="space-y-4">
           <h2 className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.25em] ml-1">Sincronização em Nuvem (Firebase)</h2>
           <div className="card-elevated p-6 space-y-4 shadow-lg">
             {onSyncToCloud && (
                <button
                  onClick={onSyncToCloud}
                  className="w-full py-4.5 bg-[var(--color-blue)]/10 border border-[var(--color-blue)]/30 rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all text-[10px] font-black uppercase tracking-[0.15em] text-[var(--color-blue)] shadow-sm hover:bg-[var(--color-blue)]/20"
                >
                  <CloudUpload className="w-4.5 h-4.5" /> Enviar para Nuvem
                </button>
             )}
             {onDownloadFromCloud && (
                <button
                  onClick={onDownloadFromCloud}
                  className="w-full py-4.5 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all text-[10px] font-black uppercase tracking-[0.15em] text-[var(--text-primary)] shadow-sm hover:border-[var(--text-dim)]/30"
                >
                  <CloudDownload className="w-4.5 h-4.5" /> Baixar da Nuvem
                </button>
             )}
           </div>
        </div>

        {/* Data Section */}
        <div className="space-y-4">
           <h2 className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.25em] ml-1">Dados & Manutenção</h2>
           <div className="card-elevated p-6 space-y-4 shadow-lg">
              <button onClick={handleBackupExport} className="w-full py-4.5 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all text-[10px] font-black uppercase tracking-[0.15em] text-[var(--color-blue)] shadow-sm hover:border-[var(--color-blue)]/30"><Download className="w-4.5 h-4.5" />Backup do Sistema</button>
              <label className="w-full py-4.5 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all text-[10px] font-black uppercase tracking-[0.15em] text-[var(--text-primary)] cursor-pointer shadow-sm hover:border-[var(--text-dim)]/30"><Upload className="w-4.5 h-4.5" />Restaurar Banco<input type="file" accept=".json" className="hidden" onChange={handleBackupImport} /></label>
              <button onClick={() => { if(confirm('⚠️ Esta ação apagará TUDO. Continuar?')) onResetData(); }} className="w-full py-4.5 bg-[var(--color-red)]/5 border border-[var(--color-red)]/20 rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all text-[10px] font-black uppercase tracking-[0.15em] text-[var(--color-red)] hover:bg-[var(--color-red)]/10"><RotateCcw className="w-4.5 h-4.5" />Zerar Aplicação</button>
           </div>
        </div>
      </div>

      <div className="pt-10 flex flex-col items-center opacity-30">
          <p className="text-[8px] font-black uppercase tracking-[0.4em]">Inventário Profissional</p>
          <p className="text-[7px] font-bold uppercase mt-1 tracking-widest">v2.1 Build Quail</p>
      </div>

      {pendingBackupData && (
        <BackupModal
          isOpen={!!pendingBackupData}
          onClose={() => setPendingBackupData(null)}
          backupData={pendingBackupData}
          onSuccess={(msg) => alert(msg)}
        />
      )}

      {isPatternModalOpen && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in ${isScanningForPattern ? 'bg-black/80 scanner-active-transparent' : 'bg-black/60'}`}>
          <div className={`border border-[var(--border-color)] rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col transition-colors ${isScanningForPattern ? 'bg-transparent' : 'bg-[var(--bg-primary)]'}`}>
            {/* Modal Header */}
            <div className="p-5 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-secondary)]">
              <h3 className="font-black uppercase tracking-tight text-xs text-[var(--text-primary)]">
                {isScanningForPattern ? 'Escanear Código de Barras' : 'Novo Padrão de Leitura'}
              </h3>
              <button
                onClick={() => setIsPatternModalOpen(false)}
                className="p-1.5 hover:bg-[var(--bg-primary)] rounded-full transition-all text-[var(--text-dim)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isScanningForPattern ? (
              /* Camera Scanning State */
              <div className="h-80 relative bg-black">
                <CameraScanner
                  active={isPatternModalOpen && isScanningForPattern}
                  onScan={(barcode, format) => {
                    // Map the format
                    let mappedFormat = 'ANY';
                    const fmt = format.toUpperCase();
                    if (fmt.includes('EAN-13') || fmt.includes('EAN_13')) mappedFormat = 'EAN_13';
                    else if (fmt.includes('128')) mappedFormat = 'CODE_128';
                    else if (fmt.includes('39')) mappedFormat = 'CODE_39';
                    else if (fmt.includes('UPC')) mappedFormat = 'UPC_A';

                    // Prefill form
                    setNewPatternForm({
                      format: mappedFormat,
                      prefix: barcode.slice(0, Math.min(barcode.length, 4)),
                      length: String(barcode.length),
                      usePrefix: barcode.length > 4,
                      useLength: true,
                    });
                    setIsScanningForPattern(false);
                  }}
                  showOverlay={true}
                />
                <div className="absolute bottom-4 inset-x-0 flex justify-center z-20">
                  <button
                    onClick={() => setIsScanningForPattern(false)}
                    className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg"
                  >
                    Digitar Manualmente
                  </button>
                </div>
              </div>
            ) : (
              /* Configuration Form State */
              <div className="p-5 space-y-4 text-xs">
                {/* Format selection */}
                <div className="space-y-1.5">
                  <label className="font-bold text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
                    Formato de Código
                  </label>
                  <select
                    value={newPatternForm.format}
                    onChange={(e) => setNewPatternForm({ ...newPatternForm, format: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl text-xs font-semibold focus:outline-none focus:border-[var(--color-blue)] bg-[var(--bg-primary)] text-[var(--text-primary)]"
                  >
                    <option value="ANY">Qualquer Formato (Apenas Prefixo/Tamanho)</option>
                    <option value="EAN_13">EAN-13 (Código de Barras Padrão Comercial)</option>
                    <option value="CODE_128">Code 128 (Logística / Crachás / Patrimônio)</option>
                    <option value="CODE_39">Code 39 (Industrial / Logística)</option>
                    <option value="UPC_A">UPC-A (Formato Americano de Varejo)</option>
                  </select>
                </div>

                {/* Prefix checkbox & input */}
                <div className="space-y-2 p-3 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)]">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newPatternForm.usePrefix}
                      onChange={(e) => setNewPatternForm({ ...newPatternForm, usePrefix: e.target.checked })}
                      className="w-4 h-4 rounded border-[var(--border-color)] text-[var(--color-blue)] focus:ring-0"
                    />
                    <span className="font-bold text-[10px] uppercase tracking-wider text-[var(--text-primary)]">
                      Filtrar por Prefixo Inicial
                    </span>
                  </label>
                  {newPatternForm.usePrefix && (
                    <div className="pt-1.5">
                      <input
                        type="text"
                        placeholder="Ex: PAT ou 789"
                        value={newPatternForm.prefix}
                        onChange={(e) => setNewPatternForm({ ...newPatternForm, prefix: e.target.value })}
                        className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-xs font-mono focus:outline-none focus:border-[var(--color-blue)] uppercase text-[var(--text-primary)]"
                      />
                      <p className="text-[9px] text-[var(--text-dim)] mt-1 font-medium">
                        A câmera só lerá códigos que comecem com essas letras/números.
                      </p>
                    </div>
                  )}
                </div>

                {/* Length checkbox & input */}
                <div className="space-y-2 p-3 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)]">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newPatternForm.useLength}
                      onChange={(e) => setNewPatternForm({ ...newPatternForm, useLength: e.target.checked })}
                      className="w-4 h-4 rounded border-[var(--border-color)] text-[var(--color-blue)] focus:ring-0"
                    />
                    <span className="font-bold text-[10px] uppercase tracking-wider text-[var(--text-primary)]">
                      Limitar Tamanho do Código
                    </span>
                  </label>
                  {newPatternForm.useLength && (
                    <div className="pt-1.5">
                      <input
                        type="number"
                        placeholder="Ex: 10 ou 13"
                        value={newPatternForm.length}
                        onChange={(e) => setNewPatternForm({ ...newPatternForm, length: e.target.value })}
                        className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-xs font-mono focus:outline-none focus:border-[var(--color-blue)] text-[var(--text-primary)]"
                        min="1"
                      />
                      <p className="text-[9px] text-[var(--text-dim)] mt-1 font-medium">
                        Apenas códigos com exatamente esse número de dígitos serão computados.
                      </p>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    onClick={() => {
                      if (newPatternForm.usePrefix && !newPatternForm.prefix.trim()) {
                        alert('Por favor, informe o prefixo para o filtro.');
                        return;
                      }
                      if (newPatternForm.useLength && (!newPatternForm.length || Number(newPatternForm.length) <= 0)) {
                        alert('Por favor, informe um tamanho válido maior que zero.');
                        return;
                      }

                      // Create new pattern
                      const patternsList = current.barcodePatterns || [];
                      const newPat: BarcodePattern = {
                        id: String(Date.now()),
                        format: newPatternForm.format,
                        prefix: newPatternForm.usePrefix ? newPatternForm.prefix.trim() : undefined,
                        length: newPatternForm.useLength ? Number(newPatternForm.length) : undefined,
                      };

                      const updatedPatterns = [...patternsList, newPat];
                      updateSetting('barcodePatterns', updatedPatterns);
                      setIsPatternModalOpen(false);
                    }}
                    className="py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold uppercase tracking-wider text-[10px] text-center shadow-md"
                  >
                    Salvar Padrão
                  </button>
                  <button
                    onClick={() => setIsPatternModalOpen(false)}
                    className="py-3 bg-zinc-800 text-gray-300 hover:bg-zinc-700 rounded-xl font-bold uppercase tracking-wider text-[10px] text-center"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

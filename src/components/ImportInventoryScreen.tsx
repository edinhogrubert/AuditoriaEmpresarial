import React, { useState, useRef } from 'react';
import {
  FileUp,
  QrCode,
  Info,
  Download,
  CheckCircle2,
  ChevronRight,
  Bell,
  Boxes,
  BarChart3,
  Sparkles,
  ArrowLeft,
  Upload,
  FileCheck,
  Check,
  Image as ImageIcon,
  Loader2,
} from 'lucide-react';
import { AppSettings } from '../types';
import { getStoredBatches, getExpectedItemsForBatch, getScanCountForBatch, formatDateStr, getUniqueCategories, getUniqueDescriptions } from '../services/storage';
import { decodeQrCodeFromImageFile } from '../utils/qrDecoder';

interface ImportInventoryScreenProps {
  onBack: () => void;
  onCreateVerificationBatch: (
    name: string,
    description: string,
    items: { barcode: string; description?: string; category?: string }[]
  ) => void;
  onAddExpectedToBatch: (
    batchId: number,
    items: { barcode: string; description?: string; category?: string }[]
  ) => void;
  onNavigateQrImport: (batchName: string, targetBatchId?: number, initialContent?: string) => void;
  onNavigate?: (screen: string) => void;
  onOpenBatchDetails?: (batchId: number) => void;
  targetBatchId?: number | null;
  settings: AppSettings;
}

export const ImportInventoryScreen: React.FC<ImportInventoryScreenProps> = ({
  onBack,
  onCreateVerificationBatch,
  onAddExpectedToBatch,
  onNavigateQrImport,
  onNavigate,
  onOpenBatchDetails,
  targetBatchId,
  settings,
}) => {
  const batches = getStoredBatches();
  const targetBatch = targetBatchId ? batches.find(b => b.id === targetBatchId) : null;
  const existingCategories = getUniqueCategories();
  const existingNames = getUniqueDescriptions();

  const [selectedMethod, setSelectedMethod] = useState<'none' | 'csv' | 'qr'>('none');
  const [batchName, setBatchName] = useState(targetBatch?.name || '');
  const [csvParsedItems, setCsvParsedItems] = useState<{ barcode: string; description?: string; category?: string }[]>([]);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [isSingleColumn, setIsSingleColumn] = useState(false);
  const [globalName, setGlobalName] = useState('');
  const [globalCategory, setGlobalCategory] = useState('');
  const [pasteModalOpen, setPasteModalOpen] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [qrTextModalOpen, setQrTextModalOpen] = useState(false);
  const [manualQrCode, setManualQrCode] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    setIsLoadingImage(true);

    try {
      const text = await decodeQrCodeFromImageFile(file);
      onNavigateQrImport(batchName || 'Importação QR Imagem', targetBatchId || undefined, text);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Não foi possível ler o QR Code da imagem selecionada.');
    } finally {
      setIsLoadingImage(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFileName(file.name);
    setErrorMessage(null);
    setCsvParsedItems([]);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length === 0) {
          setErrorMessage('O arquivo está vazio.');
          setCsvFileName(null);
          return;
        }

        let startIdx = 0;
        const firstLineLower = lines[0].toLowerCase();
        if (firstLineLower.includes('codigo') || firstLineLower.includes('patrimonio') || firstLineLower.includes('barcode')) {
          startIdx = 1;
        }

        const dataLines = lines.slice(startIdx).filter((l) => l.trim().length > 0);
        if (dataLines.length === 0) {
          setErrorMessage('Nenhuma linha de dados encontrada no arquivo.');
          setCsvFileName(null);
          return;
        }

        const parsed: { barcode: string; description?: string; category?: string }[] = [];
        let invalidColumnCount = false;
        let detectedCols = 0;

        for (let i = 0; i < dataLines.length; i++) {
          const line = dataLines[i].trim();
          if (!line) continue;

          let cols = line.split(/[,;\t]|\s{2,}/).map((c) => c.replace(/^"|"$/g, '').trim()).filter(Boolean);
          if (cols.length === 1 && cols[0].includes(' ')) {
            const parts = cols[0].split(/\s+/);
            if (parts.length > 1) {
              cols = [parts[0], parts.slice(1).join(' ')];
            }
          }
          detectedCols = cols.length;

          // Accept 1, 2, or 3 columns
          if (cols.length < 1 || cols.length > 3) {
            invalidColumnCount = true;
            break;
          }

          if (cols[0]) {
            parsed.push({
              barcode: cols[0],
              description: cols[1] || undefined,
              category: cols[2] || undefined,
            });
          }
        }

        if (invalidColumnCount) {
          setErrorMessage(
            `Importação Negada! O arquivo contém ${detectedCols} colunas. Apenas arquivos com 1 coluna (Patrimônio), 2 colunas (Patrimônio, Nome) ou 3 colunas (Patrimônio, Nome, Categoria) são aceitos.`
          );
          setCsvParsedItems([]);
          setCsvFileName(null);
          return;
        }

        if (parsed.length === 0) {
          setErrorMessage('Nenhum código válido encontrado.');
          setCsvFileName(null);
        } else {
          setCsvParsedItems(parsed);
          if (!batchName) setBatchName(file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '));
          const hasDescriptions = parsed.some((item) => !!item.description);
          setIsSingleColumn(!hasDescriptions);
        }
      } catch (err) {
        setErrorMessage('Erro ao ler CSV.');
        setCsvFileName(null);
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = () => {
    if (csvParsedItems.length === 0) return;
    const finalItems = csvParsedItems.map(item => ({
      barcode: item.barcode.trim(),
      description: item.description?.trim() || globalName.trim() || 'Item de Inventário',
      category: item.category?.trim() || globalCategory.trim() || 'Sem Categoria'
    }));

    if (targetBatchId) {
      onAddExpectedToBatch(targetBatchId, finalItems);
    } else {
      onCreateVerificationBatch(batchName || 'Auditoria CSV', `Importação CSV`, finalItems);
    }
  };

  return (
    <div className="min-h-screen text-[var(--text-primary)] bg-[var(--bg-primary)] flex flex-col justify-between max-w-md mx-auto select-none relative pb-24 border-x border-[var(--border-color)]">
      
      <header className="bg-[var(--bg-secondary)] border-b border-[var(--border-color)] px-4 h-16 flex items-center justify-between sticky top-0 z-50 shadow-sm transition-colors">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2.5 rounded-full bg-[var(--bg-primary)] border border-[var(--border-color)] active:scale-95 transition-all shadow-sm">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-black uppercase tracking-tight">{targetBatch ? 'Adição' : 'Importação'}</h1>
        </div>
      </header>

      <main className="p-6 space-y-7 flex-1 overflow-y-auto custom-scrollbar">
        <div className="px-1">
          <span className="text-[10px] font-mono font-bold bg-[var(--bg-secondary)] text-[var(--color-blue)] px-2.5 py-1 rounded-md border border-[var(--border-color)] shadow-xs inline-block">
            ImportInventoryScreen.tsx
          </span>
        </div>
        <div className="space-y-6">
          <section className="card-elevated p-6 space-y-4 shadow-lg border-blue-500/10">
            <label className="text-[10px] font-black text-[var(--color-blue)] uppercase tracking-[0.2em] block ml-1">Identificação da Auditoria</label>
            <div className="relative">
                <input
                type="text"
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                placeholder="Ex: Auditoria Setor Sul"
                disabled={!!targetBatchId}
                className={`w-full bg-[var(--bg-primary)] border-2 border-[var(--border-color)] rounded-[1.25rem] px-6 py-4 text-base font-black uppercase tracking-tight focus:outline-none focus:border-[var(--color-blue)] transition-all shadow-inner ${!!targetBatchId ? 'opacity-50 cursor-not-allowed' : ''}`}
                />
                {!batchName.trim() && !targetBatchId && (
                    <span className="absolute -bottom-5 left-1 text-[8px] font-black text-[var(--color-red)] uppercase tracking-widest animate-pulse">Obrigatório digitar nome</span>
                )}
            </div>
          </section>

          <section className={`space-y-4 pt-2 transition-all duration-500 ${(!batchName.trim() && !targetBatchId) ? 'opacity-20 pointer-events-none grayscale' : 'opacity-100'}`}>
            <h2 className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] px-1">Método de Entrada</h2>

            <button onClick={() => { setSelectedMethod('csv'); fileInputRef.current?.click(); }} className="w-full card-elevated p-5 flex items-center gap-4 transition-all active:scale-[0.98] shadow-md border-blue-500/5 group hover:border-[var(--color-blue)]/20">
                <div className="bg-[var(--color-blue)]/10 text-[var(--color-blue)] rounded-2xl p-3 border border-[var(--color-blue)]/20 shadow-sm transition-transform group-hover:scale-110 shrink-0"><FileUp className="w-6 h-6" /></div>
                <div className="text-left min-w-0"><span className="text-sm font-black uppercase tracking-tight block truncate">Planilha Eletrônica (CSV)</span><span className="text-xs text-[var(--text-secondary)] mt-0.5 font-medium block">Importar de arquivos CSV/TXT</span></div>
            </button>

            <button onClick={() => onNavigateQrImport(batchName, targetBatchId || undefined)} className="w-full card-elevated p-5 flex items-center gap-4 transition-all active:scale-[0.98] shadow-md border-emerald-500/5 group hover:border-[var(--color-emerald)]/20">
                <div className="bg-[var(--color-emerald)]/10 text-[var(--color-emerald)] rounded-2xl p-3 border border-[var(--color-emerald)]/20 shadow-sm transition-transform group-hover:scale-110 shrink-0"><QrCode className="w-6 h-6" /></div>
                <div className="text-left min-w-0"><span className="text-sm font-black uppercase tracking-tight block truncate">Escanear QR Mestre (Câmera)</span><span className="text-xs text-[var(--text-secondary)] mt-0.5 font-medium block">Captura ao vivo via câmera</span></div>
            </button>

            <button onClick={() => imageInputRef.current?.click()} className="w-full card-elevated p-5 flex items-center gap-4 transition-all active:scale-[0.98] shadow-md border-sky-500/5 group hover:border-sky-500/20">
                <div className="bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded-2xl p-3 border border-sky-500/20 shadow-sm transition-transform group-hover:scale-110 shrink-0"><ImageIcon className="w-6 h-6" /></div>
                <div className="text-left min-w-0"><span className="text-sm font-black uppercase tracking-tight block truncate">Importar Imagem do QR Code</span><span className="text-xs text-[var(--text-secondary)] mt-0.5 font-medium block">Carregar foto salva com QR Code</span></div>
            </button>

            <button onClick={() => setPasteModalOpen(true)} className="w-full card-elevated p-5 flex items-center gap-4 transition-all active:scale-[0.98] shadow-md border-indigo-500/5 group hover:border-indigo-500/20">
                <div className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl p-3 border border-indigo-500/20 shadow-sm transition-transform group-hover:scale-110 shrink-0"><FileUp className="w-6 h-6" /></div>
                <div className="text-left min-w-0"><span className="text-sm font-black uppercase tracking-tight block truncate">Copiar e Colar Lista (TXT / Vários)</span><span className="text-xs text-[var(--text-secondary)] mt-0.5 font-medium block">Colar vários patrimônios um por linha</span></div>
            </button>

            <button onClick={() => setQrTextModalOpen(true)} className="w-full card-elevated p-5 flex items-center gap-4 transition-all active:scale-[0.98] shadow-md border-emerald-500/5 group hover:border-emerald-500/20">
                <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl p-3 border border-emerald-500/20 shadow-sm transition-transform group-hover:scale-110 shrink-0"><QrCode className="w-6 h-6" /></div>
                <div className="text-left min-w-0"><span className="text-sm font-black uppercase tracking-tight block truncate">Inserir Código QR / Manual</span><span className="text-xs text-[var(--text-secondary)] mt-0.5 font-medium block">Digitar ou colar código de barra/QR Mestre</span></div>
            </button>
          </section>

          {errorMessage && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-xs font-bold text-red-600 dark:text-red-400">
              {errorMessage}
            </div>
          )}

          {isLoadingImage && (
            <div className="p-4 bg-sky-500/10 border border-sky-500/30 rounded-2xl flex items-center justify-center gap-3 text-xs font-bold text-sky-700 dark:text-sky-300">
              <Loader2 className="w-5 h-5 animate-spin text-sky-600" />
              <span>Processando imagem de QR Code...</span>
            </div>
          )}
        </div>

        <input type="file" ref={fileInputRef} accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
        <input type="file" ref={imageInputRef} accept="image/*" className="hidden" onChange={handleImageUpload} />

        {csvFileName && csvParsedItems.length > 0 && (
          <div className="fixed inset-x-6 bottom-20 z-40 bg-[var(--bg-secondary)] border-2 border-sky-500/30 rounded-3xl p-6 space-y-4 shadow-2xl max-h-[75vh] overflow-y-auto">
             <div className="flex flex-col items-center text-center gap-2">
                 <div className="w-14 h-14 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-500/30"><FileCheck className="w-7 h-7" /></div>
                 <h3 className="text-sm font-bold truncate w-full text-[var(--text-primary)]">{csvFileName}</h3>
                 <span className="text-xs font-bold bg-[#002b59] text-white px-4 py-1 rounded-full uppercase tracking-wider">
                   {csvParsedItems.length} ATIVOS {isSingleColumn ? '(1 COLUNA)' : '(3 COLUNAS)'}
                 </span>
             </div>

             {isSingleColumn && (
               <div className="bg-[var(--bg-primary)] p-4 rounded-2xl border border-[var(--border-color)] space-y-3 text-left">
                 <p className="text-[10px] font-black uppercase text-[var(--color-blue)] tracking-wider flex items-center gap-1">
                   <Sparkles className="w-3.5 h-3.5" /> Identificação dos Ativos (1 Coluna)
                 </p>
                 <div className="space-y-2.5">
                   <div>
                     <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase block mb-1">Nome Padrão</label>
                     <input
                       type="text"
                       list="csv-names-list"
                       value={globalName}
                       onChange={(e) => setGlobalName(e.target.value)}
                       placeholder="Ex: Cadeira de Escritório"
                       className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl px-3.5 py-2 text-xs font-bold text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-blue)]"
                     />
                     <datalist id="csv-names-list">
                       {existingNames.map(name => <option key={name} value={name} />)}
                     </datalist>
                   </div>
                   <div>
                     <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase block mb-1">Categoria Padrão</label>
                     <input
                       type="text"
                       list="csv-categories-list"
                       value={globalCategory}
                       onChange={(e) => setGlobalCategory(e.target.value)}
                       placeholder="Ex: Móveis / Equipamentos"
                       className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl px-3.5 py-2 text-xs font-bold text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-blue)]"
                     />
                     <datalist id="csv-categories-list">
                       {existingCategories.map(cat => <option key={cat} value={cat} />)}
                     </datalist>
                   </div>
                 </div>
               </div>
             )}

             <button onClick={handleConfirmImport} className="w-full py-4 bg-[#002b59] hover:bg-[#0f3d73] text-white rounded-2xl font-bold text-xs uppercase tracking-wider shadow-md active:scale-95 transition-all">Confirmar e Abrir</button>
             <button onClick={() => setCsvFileName(null)} className="w-full text-xs font-bold text-red-600 dark:text-red-400 hover:underline">Cancelar Seleção</button>
          </div>
        )}

        {/* Copy-Paste Modal */}
        {pasteModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl">
              <h3 className="text-base font-black uppercase text-[var(--text-primary)]">Copiar e Colar Patrimônios</h3>
              <p className="text-xs text-[var(--text-secondary)]">Cole abaixo uma lista de números de patrimônio (um por linha ou separados por vírgula/espaço):</p>
              <textarea
                rows={8}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="PAT-1001&#10;PAT-1002&#10;PAT-1003"
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl p-4 text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-blue)]"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const lines = pastedText.split(/\r?\n|,/).map(l => l.trim()).filter(Boolean);
                    if (lines.length === 0) {
                      setErrorMessage('Nenhum patrimônio inserido.');
                      return;
                    }
                    const parsed = lines.map(barcode => ({ barcode, description: 'Item Copiado', category: 'Geral' }));
                    if (targetBatchId) {
                      onAddExpectedToBatch(targetBatchId, parsed);
                    } else {
                      onCreateVerificationBatch(batchName || 'Auditoria Copiada', 'Importação por Copiar/Colar', parsed);
                    }
                    setPasteModalOpen(false);
                  }}
                  className="flex-1 py-3.5 bg-[#002b59] hover:bg-[#0f3d73] text-white rounded-2xl font-bold text-xs uppercase tracking-wider shadow-md"
                >
                  Processar e Inserir ({pastedText.split(/\r?\n|,/).filter(l => l.trim()).length})
                </button>
                <button
                  onClick={() => setPasteModalOpen(false)}
                  className="px-4 py-3.5 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl text-xs font-bold text-[var(--text-primary)]"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Manual QR Text / Code Modal */}
        {qrTextModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl">
              <h3 className="text-base font-black uppercase text-[var(--text-primary)]">Inserir Código Manual / QR Mestre</h3>
              <p className="text-xs text-[var(--text-secondary)]">Digite ou cole o código do patrimônio ou o conteúdo do QR Code mestre:</p>
              <input
                type="text"
                value={manualQrCode}
                onChange={(e) => setManualQrCode(e.target.value)}
                placeholder="Ex: PAT-5001"
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl p-4 text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-blue)]"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const code = manualQrCode.trim();
                    if (!code) return;
                    if (code.startsWith('{') || code.includes('batch')) {
                      onNavigateQrImport(batchName || 'Importação QR Texto', targetBatchId || undefined, code);
                    } else {
                      const parsed = [{ barcode: code, description: 'Item Manual', category: 'Geral' }];
                      if (targetBatchId) {
                        onAddExpectedToBatch(targetBatchId, parsed);
                      } else {
                        onCreateVerificationBatch(batchName || 'Auditoria Manual', 'Importação Manual', parsed);
                      }
                    }
                    setQrTextModalOpen(false);
                  }}
                  className="flex-1 py-3.5 bg-[#002b59] hover:bg-[#0f3d73] text-white rounded-2xl font-bold text-xs uppercase tracking-wider shadow-md"
                >
                  Adicionar Código
                </button>
                <button
                  onClick={() => setQrTextModalOpen(false)}
                  className="px-4 py-3.5 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl text-xs font-bold text-[var(--text-primary)]"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-[var(--bg-secondary)] border-t border-[var(--border-color)] h-16 px-4 flex items-center justify-around z-50 shadow-2xl transition-colors">
          <button onClick={() => onNavigate && onNavigate('menu')} className="flex flex-col items-center text-[var(--text-dim)] uppercase text-[9px] font-bold tracking-tighter"><BarChart3 className="w-5 h-5 mb-0.5" />Home</button>
          <button onClick={() => onNavigate && onNavigate('batch_list')} className="flex flex-col items-center text-[var(--text-dim)] uppercase text-[9px] font-bold tracking-tighter"><Boxes className="w-5 h-5 mb-0.5" />Arquivos</button>
          <button className="flex flex-col items-center text-[var(--color-blue)] uppercase text-[9px] font-black tracking-tighter"><FileUp className="w-5 h-5 mb-0.5 stroke-[3]" />Importar</button>
          <button onClick={() => onNavigate && onNavigate('settings')} className="flex flex-col items-center text-[var(--text-dim)] uppercase text-[9px] font-bold tracking-tighter"><Sparkles className="w-5 h-5 mb-0.5" />Ajustes</button>
      </nav>
    </div>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Tag, RefreshCw, Check, Upload, Image as ImageIcon, QrCode, Sparkles, Loader2, Layers } from 'lucide-react';
import { CameraScanner } from './CameraScanner';
import { createBatch, getUniqueCategories, getUniqueDescriptions } from '../services/storage';
import { AppSettings } from '../types';
import { decodeQrCodeFromImageFile } from '../utils/qrDecoder';
import { parseQrChunk, combineQrChunks } from '../utils/qrChunker';
import { parseCsvOrText } from '../utils/csvParser';

interface QrImportScannerScreenProps {
  batchName: string;
  onBack: () => void;
  onImported: (batchId: number) => void;
  onAddExpectedToBatch: (
    batchId: number,
    items: { barcode: string; description?: string; category?: string }[]
  ) => void;
  targetBatchId?: number;
  settings: AppSettings;
  initialContent?: string;
}

export const QrImportScannerScreen: React.FC<QrImportScannerScreenProps> = ({
  batchName,
  onBack,
  onImported,
  onAddExpectedToBatch,
  targetBatchId,
  settings,
  initialContent,
}) => {
  const [scannedContent, setScannedContent] = useState<string | null>(initialContent || null);
  const [receivedChunksMap, setReceivedChunksMap] = useState<Map<number, string>>(new Map());
  const [totalChunks, setTotalChunks] = useState<number>(1);
  const [transferId, setTransferId] = useState<string | null>(null);
  const [chunkNotice, setChunkNotice] = useState<string | null>(null);

  const [selectedDelimiter, setSelectedDelimiter] = useState<'\n' | ';' | ','>('\n');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [globalName, setGlobalName] = useState('');
  const [globalCategory, setGlobalCategory] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const existingCategories = getUniqueCategories();
  const existingNames = getUniqueDescriptions();

  // Handle incoming raw barcode / QR code text
  const handleRawScan = (rawText: string) => {
    if (!rawText) return;

    const parsedChunk = parseQrChunk(rawText);

    if (parsedChunk.isChunk) {
      setTotalChunks(parsedChunk.totalParts);
      setTransferId(parsedChunk.transferId);

      setReceivedChunksMap((prev) => {
        const nextMap = new Map(prev);
        nextMap.set(parsedChunk.currentPart, parsedChunk.chunkData);

        if (nextMap.size === parsedChunk.totalParts) {
          // All parts received! Reconstruct payload
          try {
            const combinedStr = combineQrChunks(nextMap, parsedChunk.totalParts);
            setScannedContent(combinedStr);
            setChunkNotice(`⚡ Todas as ${parsedChunk.totalParts} partes do QR Code foram lidas com sucesso!`);
          } catch (e: any) {
            setUploadError(`Erro ao juntar as partes do QR: ${e.message}`);
          }
        } else {
          setChunkNotice(
            `Parte ${parsedChunk.currentPart} de ${parsedChunk.totalParts} lida! Falta ler as partes restantes (${Math.round((nextMap.size / parsedChunk.totalParts) * 100)}%).`
          );
        }

        return nextMap;
      });
    } else {
      // Single payload QR code
      setScannedContent(rawText);
    }
  };

  // Auto-detect delimiter when content is scanned
  useEffect(() => {
    if (scannedContent) {
      if (scannedContent.includes(';')) setSelectedDelimiter(';');
      else if (scannedContent.includes(',')) setSelectedDelimiter(',');
      else setSelectedDelimiter('\n');
    }
  }, [scannedContent]);

  const parsedStructItems = scannedContent
    ? parseCsvOrText(scannedContent, selectedDelimiter)
    : [];

  const parsedItems = parsedStructItems.map((item) => item.barcode);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setIsProcessingImage(true);

    try {
      if (
        file.name.endsWith('.csv') ||
        file.name.endsWith('.txt') ||
        file.name.endsWith('.json') ||
        file.type.includes('text') ||
        file.type.includes('csv') ||
        file.type.includes('json')
      ) {
        const text = await file.text();
        handleRawScan(text);
      } else {
        const text = await decodeQrCodeFromImageFile(file);
        handleRawScan(text);
      }
    } catch (err: any) {
      setUploadError(err?.message || 'Não foi possível ler o arquivo ou a imagem selecionada.');
    } finally {
      setIsProcessingImage(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleConfirmImport = () => {
    if (!parsedStructItems.length) return;

    let expectedList = parsedStructItems.map((item) => ({
      barcode: item.barcode.trim(),
      description: item.description?.trim() || globalName.trim() || 'Item de Inventário',
      category: item.category?.trim() || globalCategory.trim() || 'Sem Categoria',
    }));

    // Duplicate detection
    const uniqueBarcodes = new Set<string>();
    const duplicates: string[] = [];
    expectedList.forEach(item => {
      const code = item.barcode.toLowerCase();
      if (uniqueBarcodes.has(code)) {
        duplicates.push(item.barcode);
      } else {
        uniqueBarcodes.add(code);
      }
    });

    if (duplicates.length > 0) {
      if (settings.autoRemoveDuplicates) {
        // Remove automatically
        const seen = new Set<string>();
        expectedList = expectedList.filter(item => {
          const code = item.barcode.toLowerCase();
          if (seen.has(code)) return false;
          seen.add(code);
          return true;
        });
        alert(`Removidos ${duplicates.length} patrimônios duplicados automaticamente.`);
      } else {
        // Ask user
        if (confirm(`Encontramos ${duplicates.length} patrimônios duplicados no QR Code. Deseja removê-los?`)) {
          const seen = new Set<string>();
          expectedList = expectedList.filter(item => {
            const code = item.barcode.toLowerCase();
            if (seen.has(code)) return false;
            seen.add(code);
            return true;
          });
        }
      }
    }

    if (targetBatchId) {
      onAddExpectedToBatch(targetBatchId, expectedList);
      onImported(targetBatchId);
    } else {
      const newBatch = createBatch(
        batchName || 'Conferência QR Mestre',
        'Importado via QR Mestre',
        'VERIFICATION',
        expectedList
      );
      onImported(newBatch.id);
    }
  };

  return (
    <div className={`min-h-screen text-[#0b1c30] flex flex-col justify-between max-w-md mx-auto select-none relative pb-16 shadow-xl border-x border-[#c3c6d1]/30 transition-colors ${!scannedContent ? 'bg-transparent scanner-active-transparent' : 'bg-[#f8f9ff]'}`}>
      
      {/* Hidden File Input for PC upload */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".csv,.txt,.json,image/*"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Top Header */}
      <header className="bg-white border-b border-[#e5eeff] px-4 h-14 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 rounded-full hover:bg-[#eff4ff] text-[#002b59] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-sm font-bold text-[#002b59]">Escanear QR Mestre</h1>
            <p className="text-[10px] text-[#43474f] font-medium">Importação Rápida de Ativos</p>
          </div>
        </div>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-1.5 bg-[#e5eeff] hover:bg-[#dce9ff] text-[#002b59] rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border border-[#c3c6d1]/60"
        >
          <Upload className="w-3.5 h-3.5" />
          Abrir Imagem
        </button>
      </header>

      {/* Main Container */}
      <main className="p-4 space-y-4 flex-1">
        
        {/* Mode 1: Camera Scanner & File Upload Option */}
        {!scannedContent && (
          <div className="space-y-4">
            <div className="bg-white/90 backdrop-blur-sm border border-[#c3c6d1]/60 rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-[#002b59]" />
                  <h2 className="text-sm font-bold text-[#0b1c30]">Importar por Câmera ou Arquivo</h2>
                </div>
              </div>
              <p className="text-xs text-[#43474f] leading-relaxed">
                Aponte a câmera para o QR Code Mestre contendo a lista de patrimônios ou selecione uma foto salva no seu computador.
              </p>

              {/* Action Button: PC File Upload */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full bg-[#002b59] hover:bg-[#1a4175] text-white rounded-xl py-3 font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.99]"
              >
                <ImageIcon className="w-4 h-4" />
                Carregar Imagem com QR Code do Computador (PC)
              </button>
            </div>

            {uploadError && (
              <div className="bg-[#ffdad6] text-[#93000a] border border-[#ba1a1a]/30 rounded-xl p-3 text-xs font-medium">
                {uploadError}
              </div>
            )}

            {chunkNotice && (
              <div className="bg-sky-500/10 border border-sky-500/30 text-sky-700 dark:text-sky-300 rounded-xl p-3 text-xs font-bold animate-in fade-in flex items-center gap-2">
                <Layers className="w-4 h-4 text-sky-500 shrink-0" />
                <span>{chunkNotice}</span>
              </div>
            )}

            {/* Camera Viewport Container */}
            <div className="relative w-full h-80 rounded-2xl overflow-hidden border border-[#c3c6d1] flex flex-col items-center justify-center bg-transparent">
              <CameraScanner onScan={(barcode) => handleRawScan(barcode)} />
              <div className="absolute bottom-3 inset-x-3 z-30 bg-black/60 backdrop-blur-md border border-white/10 rounded-xl p-2.5 text-center text-[11px] text-white">
                {totalChunks > 1
                  ? `Scanner em Modo Múltiplas Partes (${receivedChunksMap.size}/${totalChunks} Lidas)`
                  : 'Aponte para o QR Code ou clique em "Abrir Imagem" acima'}
              </div>
            </div>
          </div>
        )}

        {/* Mode 2: Content Review */}
        {scannedContent && (
          <div className="space-y-4">
            <div className="bg-[#e6f4ea] border border-[#006a6a]/30 rounded-2xl p-4 space-y-1">
              <h2 className="text-sm font-bold text-[#004f4f]">QR Code Lido com Sucesso!</h2>
              <p className="text-xs text-[#006a6a]">
                Encontramos <span className="font-bold">{parsedItems.length} patrimônios</span> no código.
              </p>
            </div>

            {/* Delimiter Selection */}
            <div className="bg-white border border-[#c3c6d1]/60 rounded-2xl p-4 space-y-2 shadow-sm">
              <label className="text-[10px] font-bold text-[#43474f] tracking-wider uppercase block">
                SELECIONE O DELIMITADOR
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Quebra de Linha', val: '\n' },
                  { label: 'Ponto-e-vírgula (;)', val: ';' },
                  { label: 'Vírgula (,)', val: ',' },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setSelectedDelimiter(item.val as any)}
                    className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                      selectedDelimiter === item.val
                        ? 'bg-[#002b59] text-white border-[#002b59] shadow-sm'
                        : 'bg-white text-[#43474f] border-[#c3c6d1] hover:bg-[#eff4ff]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Global Configuration Panel */}
            <div className="bg-[#e5eeff] border border-[#a9c7ff] rounded-2xl p-4 space-y-3 shadow-md">
              <p className="text-[10px] font-extrabold text-[#006a6a] flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> CONFIGURAÇÃO GLOBAL
              </p>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-[#43474f] uppercase block">NOME PADRÃO</label>
                  <input
                    type="text"
                    list="qr-names-list"
                    value={globalName}
                    onChange={(e) => setGlobalName(e.target.value)}
                    placeholder="Ex: Notebook"
                    className="w-full bg-white border border-[#c3c6d1] rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-[#002b59]"
                  />
                  <datalist id="qr-names-list">
                    {existingNames.map(name => <option key={name} value={name} />)}
                  </datalist>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-[#43474f] uppercase block">CATEGORIA PADRÃO</label>
                  <input
                    type="text"
                    list="qr-categories-list"
                    value={globalCategory}
                    onChange={(e) => setGlobalCategory(e.target.value)}
                    placeholder="Ex: TI"
                    className="w-full bg-white border border-[#c3c6d1] rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-[#002b59]"
                  />
                  <datalist id="qr-categories-list">
                    {existingCategories.map(cat => <option key={cat} value={cat} />)}
                  </datalist>
                </div>
              </div>
            </div>

            {/* Preview Items Card */}
            <div className="bg-white border border-[#c3c6d1]/60 rounded-2xl p-4 space-y-2 shadow-sm">
              <label className="text-[10px] font-bold text-[#43474f] tracking-wider uppercase block">
                PRÉVIA DOS ITENS ({parsedItems.length})
              </label>
              <div className="max-h-56 overflow-y-auto space-y-2 font-mono-code text-xs">
                {parsedItems.slice(0, 10).map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2.5 py-1.5 border-b border-[#e5eeff] last:border-0">
                    <Tag className="w-3.5 h-3.5 text-[#002b59] shrink-0" />
                    <span className="text-[#0b1c30] font-bold truncate">{item}</span>
                  </div>
                ))}
                {parsedItems.length > 10 && (
                  <div className="pt-2 text-center text-[10px] text-[#737780] font-semibold">
                    ... e mais {parsedItems.length - 10} itens na lista
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Action Row */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => {
                  setScannedContent(null);
                  setUploadError(null);
                }}
                className="py-3 bg-white hover:bg-[#eff4ff] border border-[#c3c6d1] text-[#002b59] rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95"
              >
                <RefreshCw className="w-4 h-4 text-[#002b59]" />
                Repetir / Nova Imagem
              </button>

              <button
                onClick={handleConfirmImport}
                disabled={parsedItems.length === 0}
                className="py-3 bg-[#002b59] hover:bg-[#1a4175] text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.99] disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                Confirmar e Abrir
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};


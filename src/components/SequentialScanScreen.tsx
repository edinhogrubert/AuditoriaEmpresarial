import React, { useState, useCallback } from 'react';
import { ArrowLeft, Trash2, Download, Copy, List, CheckCircle2, Play, Square } from 'lucide-react';
import { CameraScanner } from './CameraScanner';

interface SequentialScanScreenProps {
  onBack: () => void;
}

interface ScannedItem {
  id: string;
  code: string;
  format: string;
  time: string;
}

export const SequentialScanScreen: React.FC<SequentialScanScreenProps> = ({ onBack }) => {
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [copied, setCopied] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  const handleScan = useCallback((code: string, format: string) => {
    // Stop scanning immediately when something is found
    setIsScanning(false);

    // Split logic: support space, comma, semicolon and newline
    const codes = code.split(/[\s,;\n]+/).filter(c => c.trim().length > 0);

    if (codes.length === 0) return;

    const newItems: ScannedItem[] = codes.map(c => ({
      id: Math.random().toString(),
      code: c,
      format,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    }));

    // Avoid immediate duplicate at the top for the first item
    setScannedItems((prev) => {
       if (prev.length > 0 && prev[0].code === newItems[0].code) return prev;
       return [...newItems, ...prev];
    });
  }, []);

  const handleCopyAll = () => {
    if (scannedItems.length === 0) return;
    const text = scannedItems.map((i) => i.code).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportCsv = () => {
    if (scannedItems.length === 0) return;
    let csv = 'Index,Tipo,Conteúdo,Hora\n';
    scannedItems.forEach((item, index) => {
      csv += `${index + 1},${item.format},"${item.code}",${item.time}\n`;
    });

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `leituras_sequenciais_${Date.now()}.csv`;
    link.click();
  };

  const handleRemove = (id: string) => {
    setScannedItems((prev) => prev.filter((item) => item.id !== id));
  };

  const toggleScanning = () => {
    setIsScanning(!isScanning);
  };

  return (
    <div className={`relative w-full h-screen text-white flex flex-col select-none overflow-hidden max-w-md mx-auto ${isScanning ? 'bg-transparent' : 'bg-[#0A0D14]'}`}>
      {/* Top Header */}
      <div className={`absolute top-0 inset-x-0 z-30 p-4 flex items-center justify-between ${isScanning ? 'bg-gradient-to-b from-black/80 to-transparent' : ''}`}>
        <button
          onClick={onBack}
          className="p-2.5 rounded-full bg-[#1A1F26]/80 text-white border border-gray-800 backdrop-blur-md active:scale-95 transition-all shadow-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <h2 className="text-base font-bold text-white tracking-wide">Ler em Sequência</h2>
          <span className="text-[10px] text-blue-400 font-semibold uppercase tracking-wider">
            {scannedItems.length} {scannedItems.length === 1 ? 'item lido' : 'itens lidos'}
          </span>
        </div>
        <div className="flex gap-2">
          {scannedItems.length > 0 && (
            <button
              onClick={handleExportCsv}
              className="p-2.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 backdrop-blur-md active:scale-95 transition-all shadow-lg"
              title="Exportar CSV"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Camera Scanner Container */}
      <div className="relative flex-1 w-full h-full overflow-hidden">
        <CameraScanner onScan={handleScan} active={isScanning} />
      </div>

      {/* Bottom Scanned List Drawer & Control Button */}
      <div className={`absolute bottom-0 inset-x-0 z-40 bg-[#1A1F26]/95 backdrop-blur-xl border-t border-gray-800 flex flex-col rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)] transition-all duration-300 ${isScanning ? 'translate-y-[35vh]' : 'translate-y-0'}`}>

        {/* Toggle Button - Anchored to the drawer top */}
        <div className="absolute -top-10 inset-x-0 flex justify-center pointer-events-none">
          <button
            onClick={toggleScanning}
            className={`pointer-events-auto px-10 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-2xl active:scale-95 flex items-center gap-3 border-2 ${
              isScanning
                ? 'bg-red-500/20 text-red-400 border-red-500/30 backdrop-blur-md'
                : 'bg-emerald-500 text-[#0A0D14] border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.4)]'
            }`}
          >
            {isScanning ? (
              <>
                <Square className="w-4 h-4 fill-current" />
                Parar Leitura
              </>
            ) : (
              <>
                <Play className="w-5 h-5 fill-current" />
                Iniciar Leitura
              </>
            )}
          </button>
        </div>

        <div className="p-5 flex flex-col max-h-[45vh]">
          <div className="flex items-center justify-between pb-3 mb-2 border-b border-gray-800/80">
            <div className="flex items-center gap-2">
              <List className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                Histórico Sequencial
              </span>
            </div>
            {scannedItems.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyAll}
                  className="text-xs text-blue-400 font-bold hover:underline flex items-center gap-1"
                >
                  {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copiado!' : 'Copiar Tudo'}
                </button>
                <span className="text-gray-700">•</span>
                <button
                  onClick={() => setScannedItems([])}
                  className="text-xs text-red-400 font-bold hover:underline"
                >
                  Limpar
                </button>
              </div>
            )}
          </div>

          {scannedItems.length === 0 ? (
            <div className="py-8 text-center text-gray-500 text-xs">
              Nenhum código lido ainda nesta sessão.
            </div>
          ) : (
            <div className="overflow-y-auto space-y-2 flex-1 pr-1 custom-scrollbar">
              {scannedItems.map((item, idx) => (
                <div
                  key={item.id}
                  className="bg-[#0A0D14] border border-gray-800/80 rounded-xl p-3.5 flex items-center justify-between text-xs transition-all hover:border-gray-700"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 font-bold flex items-center justify-center text-[10px] shrink-0 border border-blue-500/20">
                      {scannedItems.length - idx}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-white font-bold truncate tracking-tight text-sm">{item.code}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5 font-medium">{item.format} • {item.time}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemove(item.id)}
                    className="text-gray-600 hover:text-red-400 p-2 shrink-0 ml-2 transition-colors"
                  >
                    <Trash2 className="w-4.5 h-4.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

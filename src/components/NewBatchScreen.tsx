import React, { useState } from 'react';
import { ArrowLeft, QrCode, Sparkles } from 'lucide-react';

interface NewBatchScreenProps {
  onBack: () => void;
  onCreateBatch: (name: string, description: string) => void;
}

const SUGGESTIONS = [
  'Inventário Julho',
  'NF-Entrada #4821',
  'Picking A12',
  'Conferência CD Sul',
  'Devolução Lote 09',
];

export const NewBatchScreen: React.FC<NewBatchScreenProps> = ({
  onBack,
  onCreateBatch,
}) => {
  const [batchName, setBatchName] = useState('');
  const maxChars = 48;

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (batchName.trim()) {
      onCreateBatch(batchName.trim(), '');
    }
  };

  return (
    <div className="min-h-screen text-[var(--text-primary)] bg-[var(--bg-primary)] flex flex-col justify-between max-w-md mx-auto p-6 select-none relative border-x border-[var(--border-color)]">
      <div className="space-y-8 flex-1">
        {/* Top Header */}
        <div className="flex items-center gap-4 pb-6 border-b border-[var(--border-color)]">
          <button
            onClick={onBack}
            className="p-2.5 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-color)] active:scale-95 transition-all shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-black uppercase tracking-tight">Novo Lote</h1>
        </div>

        <div className="space-y-6">
            <p className="text-xs text-[var(--text-secondary)] font-medium leading-relaxed px-1">
            Defina uma identificação clara para este conjunto de coletas.
            </p>

            {/* Input Card */}
            <div className="card-elevated p-6 space-y-4 shadow-lg">
                <label className="text-[10px] font-black text-[var(--color-blue)] uppercase tracking-[0.2em] block ml-1">
                    Nome da Identificação
                </label>
                <div className="relative">
                    <input
                        type="text"
                        value={batchName}
                        maxLength={maxChars}
                        onChange={(e) => setBatchName(e.target.value)}
                        placeholder="Ex: Inventário Geral"
                        autoFocus
                        className="w-full bg-[var(--bg-primary)] border-2 border-[var(--border-color)] rounded-[1.25rem] px-6 py-4 text-base font-black uppercase tracking-tight focus:outline-none focus:border-[var(--color-blue)] transition-all shadow-inner"
                    />
                    <div className="absolute right-4 bottom-[-20px] text-[8px] font-black text-[var(--text-dim)] uppercase tracking-widest">
                        {batchName.length}/{maxChars}
                    </div>
                </div>
            </div>

            {/* Suggestions */}
            <div className="space-y-4 pt-2">
                <h2 className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] px-1 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3" /> Sugestões Rápidas
                </h2>
                <div className="flex flex-wrap gap-2.5">
                    {SUGGESTIONS.map((suggestion) => (
                    <button
                        key={suggestion}
                        type="button"
                        onClick={() => setBatchName(suggestion)}
                        className="px-4 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:border-[var(--text-dim)] rounded-xl text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--text-primary)] active:scale-95 transition-all shadow-sm"
                    >
                        {suggestion}
                    </button>
                    ))}
                </div>
            </div>
        </div>
      </div>

      {/* Submit Button */}
      <div className="pt-6">
        <button
          onClick={() => handleSubmit()}
          disabled={!batchName.trim()}
          className={`w-full h-14 rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-md ${
            batchName.trim()
              ? 'bg-[#059669] hover:bg-[#047857] text-white'
              : 'bg-[var(--bg-secondary)] text-[var(--text-dim)] cursor-not-allowed border border-[var(--border-color)]'
          }`}
        >
          <QrCode className="w-5 h-5 text-emerald-200" />
          Gerar Lote Ativo
        </button>
      </div>
    </div>
  );
};

export interface ParsedInventoryItem {
  barcode: string;
  description?: string;
  category?: string;
}

/**
 * Robust CSV, TXT, or JSON inventory parser.
 * Handles any delimiter (comma, semicolon, tab, newline, pipe),
 * headers, and any number of columns (1, 2, 3, 5, 10+ columns).
 */
export function parseCsvOrText(text: string, manualDelimiter?: string): ParsedInventoryItem[] {
  if (!text || !text.trim()) return [];

  // Clean BOM and trim
  const cleanText = text.replace(/^\uFEFF/, '').trim();

  // 1. Try JSON parsing first
  if (cleanText.startsWith('[') || cleanText.startsWith('{')) {
    try {
      const jsonObj = JSON.parse(cleanText);
      const items: ParsedInventoryItem[] = [];
      const arr = Array.isArray(jsonObj) ? jsonObj : [jsonObj];
      for (const item of arr) {
        if (typeof item === 'string') {
          if (item.trim()) items.push({ barcode: item.trim() });
        } else if (item && typeof item === 'object') {
          const barcode = item.barcode || item.patrimonio || item.codigo || item.code || item.id;
          if (barcode) {
            items.push({
              barcode: String(barcode).trim(),
              description: item.description || item.nome || item.nome_item || item.desc,
              category: item.category || item.categoria || item.cat,
            });
          }
        }
      }
      if (items.length > 0) return items;
    } catch (e) {
      // Fallback to text parsing
    }
  }

  // 2. Split into raw non-empty lines
  const rawLines = cleanText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (rawLines.length === 0) return [];

  // 3. Determine delimiter
  let delimiter = manualDelimiter;

  if (!delimiter || delimiter === '\n') {
    const sample = rawLines.slice(0, 10).join('\n');
    const semicolonCount = (sample.match(/;/g) || []).length;
    const commaCount = (sample.match(/,/g) || []).length;
    const tabCount = (sample.match(/\t/g) || []).length;
    const pipeCount = (sample.match(/\|/g) || []).length;

    if (semicolonCount >= commaCount && semicolonCount >= tabCount && semicolonCount >= pipeCount && semicolonCount > 0) {
      delimiter = ';';
    } else if (commaCount > semicolonCount && commaCount >= tabCount && commaCount >= pipeCount && commaCount > 0) {
      delimiter = ',';
    } else if (tabCount > 0) {
      delimiter = '\t';
    } else if (pipeCount > 0) {
      delimiter = '|';
    } else {
      delimiter = '\n';
    }
  }

  // Helper to split a line by delimiter
  const splitLine = (line: string): string[] => {
    let parts: string[] = [];
    if (delimiter && delimiter !== '\n') {
      parts = line.split(delimiter);
    } else {
      parts = line.split(/[,;\t|]|\s{2,}/);
    }
    return parts.map((c) => c.replace(/^["']|["']$/g, '').trim());
  };

  // 4. Header detection
  let startLineIdx = 0;
  let barcodeColIdx = -1;
  let descColIdx = -1;
  let catColIdx = -1;

  if (rawLines.length > 0) {
    const headerCols = splitLine(rawLines[0]).map((c) => c.toLowerCase());
    const isHeaderLine = headerCols.some((col) =>
      col.includes('codigo') ||
      col.includes('código') ||
      col.includes('patrimonio') ||
      col.includes('patrimônio') ||
      col.includes('barcode') ||
      col.includes('code') ||
      col.includes('lote') ||
      col.includes('status') ||
      col.includes('descri') ||
      col.includes('nome') ||
      col.includes('name') ||
      col.includes('categoria') ||
      col.includes('category') ||
      col.includes('data') ||
      col.includes('hora') ||
      col.includes('index')
    );

    if (isHeaderLine) {
      startLineIdx = 1; // Skip header line
      headerCols.forEach((col, idx) => {
        if (
          col.includes('codigo') ||
          col.includes('código') ||
          col.includes('patrimonio') ||
          col.includes('patrimônio') ||
          col.includes('barcode') ||
          col.includes('code')
        ) {
          if (barcodeColIdx === -1) barcodeColIdx = idx;
        } else if (
          col.includes('descri') ||
          col.includes('nome') ||
          col.includes('name') ||
          col.includes('item') ||
          col.includes('produto')
        ) {
          if (descColIdx === -1) descColIdx = idx;
        } else if (
          col.includes('categoria') ||
          col.includes('category') ||
          col.includes('cat') ||
          col.includes('grupo') ||
          col.includes('tipo')
        ) {
          if (catColIdx === -1) catColIdx = idx;
        }
      });
    }
  }

  const results: ParsedInventoryItem[] = [];

  for (let i = startLineIdx; i < rawLines.length; i++) {
    const line = rawLines[i];
    const cols = splitLine(line).filter((c) => c.length > 0);
    if (cols.length === 0) continue;

    let barcode = '';
    let description: string | undefined = undefined;
    let category: string | undefined = undefined;

    if (barcodeColIdx >= 0 && barcodeColIdx < cols.length) {
      barcode = cols[barcodeColIdx];
      if (descColIdx >= 0 && descColIdx < cols.length) description = cols[descColIdx];
      if (catColIdx >= 0 && catColIdx < cols.length) category = cols[catColIdx];
    } else {
      // Default fallback
      if (cols.length === 1) {
        // Check if single column is space separated e.g. "PAT-1001 Cadeira de Escritório"
        const spaceParts = cols[0].split(/\s+/);
        if (spaceParts.length > 1 && /^[a-zA-Z0-9\-_/]+$/.test(spaceParts[0])) {
          barcode = spaceParts[0];
          description = spaceParts.slice(1).join(' ');
        } else {
          barcode = cols[0];
        }
      } else {
        barcode = cols[0];
        if (cols.length >= 2) description = cols[1];
        if (cols.length >= 3) category = cols[2];
      }
    }

    if (barcode) {
      results.push({
        barcode: barcode.trim(),
        description: description?.trim(),
        category: category?.trim(),
      });
    }
  }

  return results;
}

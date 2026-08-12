import { BrowserMultiFormatReader } from '@zxing/library';

function decodeCanvasWithZXing(codeReader: BrowserMultiFormatReader, canvas: HTMLCanvasElement): Promise<string> {
  return new Promise((resolve, reject) => {
    const tempImg = new Image();
    tempImg.onload = async () => {
      try {
        const res = await codeReader.decodeFromImageElement(tempImg);
        if (res && res.getText()) {
          resolve(res.getText());
        } else {
          reject(new Error('Nenhum código encontrado.'));
        }
      } catch (e) {
        reject(e);
      }
    };
    tempImg.onerror = () => reject(new Error('Erro ao converter canvas em imagem.'));
    tempImg.src = canvas.toDataURL('image/png');
  });
}

export async function decodeQrCodeFromImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Por favor, selecione um arquivo de imagem válido (PNG, JPG, WEBP).'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Erro ao ler arquivo de imagem.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Erro ao carregar a imagem. Verifique o arquivo.'));
      img.onload = async () => {
        const codeReader = new BrowserMultiFormatReader();

        // Strategy 1: Direct decode from Image Element
        try {
          const res = await codeReader.decodeFromImageElement(img);
          if (res && res.getText()) {
            resolve(res.getText());
            return;
          }
        } catch (e) {
          // Fall through to Canvas strategy
        }

        // Strategy 2: Canvas decode with original resolution
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Recurso de Canvas não suportado pelo navegador.'));
          return;
        }

        const width = img.naturalWidth || img.width || 800;
        const height = img.naturalHeight || img.height || 600;

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        try {
          const text = await decodeCanvasWithZXing(codeReader, canvas);
          if (text) {
            resolve(text);
            return;
          }
        } catch (e) {
          // Fall through
        }

        // Strategy 3: Downscale high-res images (phone photos can be 4000px+)
        const maxDim = 1200;
        if (width > maxDim || height > maxDim) {
          const scale = Math.min(maxDim / width, maxDim / height);
          const scaledCanvas = document.createElement('canvas');
          scaledCanvas.width = Math.round(width * scale);
          scaledCanvas.height = Math.round(height * scale);
          const scaledCtx = scaledCanvas.getContext('2d');
          if (scaledCtx) {
            scaledCtx.drawImage(img, 0, 0, scaledCanvas.width, scaledCanvas.height);
            try {
              const text = await decodeCanvasWithZXing(codeReader, scaledCanvas);
              if (text) {
                resolve(text);
                return;
              }
            } catch (e) {
              // Fall through
            }
          }
        }

        // Strategy 4: High-contrast thresholding on Canvas
        try {
          const imgData = ctx.getImageData(0, 0, width, height);
          const data = imgData.data;
          for (let i = 0; i < data.length; i += 4) {
            const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
            const bw = avg > 128 ? 255 : 0;
            data[i] = bw;
            data[i + 1] = bw;
            data[i + 2] = bw;
          }
          ctx.putImageData(imgData, 0, 0);

          const text = await decodeCanvasWithZXing(codeReader, canvas);
          if (text) {
            resolve(text);
            return;
          }
        } catch (e) {
          // Fall through
        }

        reject(
          new Error(
            'Nenhum QR Code válido foi encontrado na imagem. Certifique-se de que a foto esteja bem iluminada e o QR Code esteja visível.'
          )
        );
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

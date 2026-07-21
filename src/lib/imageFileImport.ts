import type { PageImage } from './pdfImageImport';

/** Reads an image file into a base64 data URL + its natural pixel size. */
export function loadImageFile(file: File): Promise<PageImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('读取图片失败'));
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onerror = () => reject(new Error('图片解码失败，可能不是受支持的图片格式'));
      img.onload = () => {
        resolve({ dataUrl, widthPx: img.naturalWidth || 800, heightPx: img.naturalHeight || 600 });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

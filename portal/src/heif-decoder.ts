import type { PhotoPolicy } from './domain';
import type { PreparedPhoto } from './photo-processing';
import type { HeifHeader } from './heif-header';

export interface HeifResult {
  bitmap: ImageBitmap; sourceWidth: number; sourceHeight: number;
  method: 'native' | 'libheif';
}
export const heifImportTimeoutMs = 20000;
/** Worker lifetime bounds decoding, including the native attempt. No source is uploaded. */
export function prepareHeif(bytes: Uint8Array<ArrayBuffer>, header: HeifHeader,
  policy: PhotoPolicy, signal?: AbortSignal): Promise<PreparedPhoto> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Photo import canceled.', 'AbortError')); return; }
    let worker: Worker;
    try { worker = new Worker(new URL('./heif-worker.ts', import.meta.url), { type: 'module' }); }
    catch { reject(Error('This browser cannot import HEIC/HEIF photos. Try an updated browser or a JPEG copy.')); return; }
    let settled = false;
    const cleanup = () => { clearTimeout(timer); worker.terminate(); signal?.removeEventListener('abort', abort); };
    const fail = (error: Error) => { if (!settled) { settled = true; cleanup(); reject(error); } };
    const abort = () => fail(new DOMException('Photo import canceled.', 'AbortError'));
    const timer = setTimeout(() => fail(Error('This HEIC/HEIF photo took too long to open. Try again or choose another photo.')), heifImportTimeoutMs);
    signal?.addEventListener('abort', abort, { once: true });
    worker.onerror = () => fail(Error('This HEIC/HEIF photo could not be opened. Try another photo.'));
    worker.onmessage = (event: MessageEvent<HeifResult | { error: string }>) => {
      if ('error' in event.data) { fail(Error(event.data.error)); return; }
      const { bitmap, sourceWidth, sourceHeight } = event.data;
      if (settled) { if (bitmap instanceof ImageBitmap) bitmap.close(); return; }
      if (!(bitmap instanceof ImageBitmap) || !Number.isInteger(sourceWidth) || !Number.isInteger(sourceHeight)
        || sourceWidth < 1 || sourceHeight < 1 || sourceWidth * sourceHeight > policy.maxInputPixels
        || bitmap.width < 1 || bitmap.height < 1 || Math.max(bitmap.width, bitmap.height) > 2048) {
        if (bitmap instanceof ImageBitmap) bitmap.close(); fail(Error('This HEIC/HEIF photo has invalid image dimensions.')); return;
      }
      settled = true; cleanup();
      resolve({ bitmap, width: bitmap.width, height: bitmap.height,
        sourceWidth, sourceHeight, close: () => bitmap.close() });
    };
    worker.postMessage({ bytes, header, maxPixels: policy.maxInputPixels }, [bytes.buffer]);
  });
}

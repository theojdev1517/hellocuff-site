import type { HeifHeader } from './heif-header';
import type { HeifResult } from './heif-decoder';
import type { HeifModule, HeifChannel, HeifPointer } from './vendor/libheif-no-eval.js';

type Request = { bytes: Uint8Array<ArrayBuffer>; header: HeifHeader; maxPixels: number };
const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<Request>) => void) | null;
  postMessage: (message: HeifResult | { error: string }, transfer?: Transferable[]) => void;
};
const invalid = () => Error('This HEIC/HEIF photo could not be decoded safely. Try another photo.');
const validSize = (width: number, height: number, maxPixels: number) =>
  Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0
  && width <= 65535 && height <= 65535 && width * height <= maxPixels;
const targetSize = (width: number, height: number) => {
  const factor = Math.min(1, 2048 / Math.max(width, height));
  return { resizeWidth: Math.max(1, Math.round(width * factor)),
    resizeHeight: Math.max(1, Math.round(height * factor)), resizeQuality: 'high' as const };
};
function checkedChannel(channel: HeifChannel | undefined, maxPixels: number, declaredPixels: number) {
  if (!channel || !validSize(channel.width, channel.height, maxPixels)
    || channel.width * channel.height > declaredPixels
    || channel.bits_per_pixel !== 8 || !Number.isSafeInteger(channel.stride)
    || channel.stride < channel.width * 4 || !(channel.data instanceof Uint8Array)
    || (channel.height - 1) * channel.stride + channel.width * 4 > channel.data.length) throw invalid();
  return channel;
}
async function decode({ bytes, header, maxPixels }: Request): Promise<HeifResult> {
  if (!(bytes instanceof Uint8Array) || !validSize(header.width, header.height, maxPixels)) throw invalid();
  const declaredPixels = header.width * header.height;
  // Native decoding stays inside the same bounded, terminable worker lifetime.
  let native: ImageBitmap | undefined;
  try {
    native = await createImageBitmap(new Blob([bytes], { type: 'image/heic' }), { imageOrientation: 'from-image' });
    if (!validSize(native.width, native.height, maxPixels) || native.width * native.height > declaredPixels) throw invalid();
    const sourceWidth = native.width, sourceHeight = native.height;
    const bitmap = await createImageBitmap(native, targetSize(sourceWidth, sourceHeight));
    return { bitmap, sourceWidth, sourceHeight, method: 'native' };
  } catch { /* Unsupported native HEIF decoding uses the local codec, not a server. */ }
  finally { native?.close(); }

  const { default: buildLibheif } = await import('./vendor/libheif-no-eval.js');
  const lib: HeifModule = buildLibheif({ print() {}, printErr() {} });
  let context: HeifPointer | null = null, handle: HeifPointer | null = null, decodedImage: HeifPointer | null = null;
  try {
    context = lib.heif_context_alloc();
    if (!context || !Number.isSafeInteger(context.$$.ptr) || context.$$.ptr < 1) throw invalid();
    // The supported C API takes a side length and enforces its square as AREA.
    // Tighten the codec's generous default BEFORE it parses source metadata.
    lib.heif_context_set_maximum_image_size_limit(context.$$.ptr, Math.floor(Math.sqrt(maxPixels)));
    const error = lib.heif_context_read_from_memory(context, bytes);
    if (!error || error.code.value !== 0) throw invalid();
    const primary = lib.heif_context_get_primary_image_handle(context);
    if (!primary || 'code' in primary || !Number.isSafeInteger(primary.$$.ptr) || primary.$$.ptr < 1) throw invalid();
    handle = primary;
    const width = lib.heif_image_handle_get_width(handle), height = lib.heif_image_handle_get_height(handle);
    if (!validSize(width, height, maxPixels) || width * height > declaredPixels) throw invalid();
    const decoded = await lib.heif_js_decode_image2(handle, lib.heif_colorspace_RGB, lib.heif_chroma_interleaved_RGBA);
    decodedImage = decoded?.image || null;
    if (!decoded || decoded.code?.value || !Array.isArray(decoded.channels)) throw invalid();
    // Actual decoded planes can differ from signalled handle dimensions.
    const channel = checkedChannel(decoded.channels.find(c => c.id.value === lib.heif_channel_interleaved.value), maxPixels, declaredPixels);
    let rgba: Uint8ClampedArray<ArrayBuffer>;
    if (channel.stride === channel.width * 4 && channel.data.length === channel.width * channel.height * 4
      && channel.data.buffer instanceof ArrayBuffer) {
      rgba = new Uint8ClampedArray(channel.data.buffer, channel.data.byteOffset, channel.data.byteLength);
    } else {
      rgba = new Uint8ClampedArray(channel.width * channel.height * 4);
      for (let row = 0; row < channel.height; row++)
        rgba.set(channel.data.subarray(row * channel.stride, row * channel.stride + channel.width * 4), row * channel.width * 4);
    }
    const bitmap = await createImageBitmap(new ImageData(rgba, channel.width, channel.height), targetSize(channel.width, channel.height));
    return { bitmap, sourceWidth: channel.width, sourceHeight: channel.height, method: 'libheif' };
  } finally {
    if (decodedImage) lib.heif_image_release(decodedImage);
    if (handle) lib.heif_image_handle_release(handle);
    if (context) lib.heif_context_free(context);
  }
}
scope.onmessage = event => {
  void decode(event.data).then(result => scope.postMessage(result, [result.bitmap]),
    () => scope.postMessage({ error: 'This HEIC/HEIF photo could not be opened. It may be damaged or use an unsupported variant. Try another photo.' }));
};

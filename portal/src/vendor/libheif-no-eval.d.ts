export interface HeifEnum { value: number }
/** Opaque embind instances from this exact pinned build, never customer values. */
export interface HeifPointer { readonly $$: { readonly ptr: number } }
export interface HeifChannel { id: HeifEnum; width: number; height: number; stride: number; bits_per_pixel: number; data: Uint8Array }
export interface HeifModule {
  heif_context_alloc(): HeifPointer;
  /** Unwrapped C export: requires the pinned embind instance's native pointer. */
  heif_context_set_maximum_image_size_limit(pointer: number, side: number): void;
  heif_context_read_from_memory(context: HeifPointer, bytes: Uint8Array): { code: HeifEnum };
  heif_context_get_primary_image_handle(context: HeifPointer): HeifPointer | { code: HeifEnum };
  heif_image_handle_get_width(handle: HeifPointer): number;
  heif_image_handle_get_height(handle: HeifPointer): number;
  heif_js_decode_image2(handle: HeifPointer, space: HeifEnum, chroma: HeifEnum): Promise<{ code?: HeifEnum; image: HeifPointer; channels: HeifChannel[] }>;
  heif_image_release(image: HeifPointer): void;
  heif_image_handle_release(handle: HeifPointer): void;
  heif_context_free(context: HeifPointer): void;
  heif_colorspace_RGB: HeifEnum;
  heif_chroma_interleaved_RGBA: HeifEnum;
  heif_channel_interleaved: HeifEnum;
}
export default function buildLibheif(options?: Record<string, unknown>): HeifModule;

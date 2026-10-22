import { validPhotoPolicy, type PhotoPolicy } from "./domain";

export interface Crop {
  zoom: number;
  offsetX: number;
  offsetY: number;
  /** Clockwise degrees, in quarter turns, after the source EXIF orientation. */
  rotation?: number;
}
export const defaultCrop: Crop = {
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
};
export interface ImageHeader {
  kind: "jpeg" | "png" | "webp";
  width: number;
  height: number;
  orientation: number;
}
export interface PreparedPhoto {
  bitmap: ImageBitmap;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
  close: () => void;
}
export interface ProcessedPhoto {
  web: Blob;
  vcf: Blob;
  width: number;
  height: number;
}
const invalid = () =>
  Error(
    "This photo could not be opened. Choose a valid JPEG, PNG or WebP image.",
  );
const text = (b: Uint8Array, start: number, count: number) =>
  String.fromCharCode(...b.subarray(start, start + count));
const uint24 = (b: Uint8Array, at: number) =>
  b[at] + b[at + 1] * 256 + b[at + 2] * 65536;

// Inspect dimensions before invoking a browser decoder. No supplied image or metadata is executed.
export function inspectImageHeader(bytes: Uint8Array): ImageHeader {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const size = bytes.length;
  const check = (at: number, count: number) => {
    if (at < 0 || at + count > size) throw invalid();
  };
  if (
    size >= 24 &&
    bytes[0] === 137 &&
    text(bytes, 1, 3) === "PNG" &&
    text(bytes, 12, 4) === "IHDR"
  ) {
    return {
      kind: "png",
      width: view.getUint32(16),
      height: view.getUint32(20),
      orientation: 1,
    };
  }
  if (
    size >= 30 &&
    text(bytes, 0, 4) === "RIFF" &&
    text(bytes, 8, 4) === "WEBP"
  ) {
    const kind = text(bytes, 12, 4);
    if (kind === "VP8X") {
      if (bytes[20] & 2)
        throw Error("Choose a still photo rather than an animated image.");
      return {
        kind: "webp",
        width: uint24(bytes, 24) + 1,
        height: uint24(bytes, 27) + 1,
        orientation: 1,
      };
    }
    if (kind === "VP8L" && bytes[20] === 47) {
      const bits = view.getUint32(21, true);
      return {
        kind: "webp",
        width: (bits & 16383) + 1,
        height: ((bits >>> 14) & 16383) + 1,
        orientation: 1,
      };
    }
    if (
      kind === "VP8 " &&
      bytes[23] === 157 &&
      bytes[24] === 1 &&
      bytes[25] === 42
    )
      return {
        kind: "webp",
        width: view.getUint16(26, true) & 16383,
        height: view.getUint16(28, true) & 16383,
        orientation: 1,
      };
    throw invalid();
  }
  if (size >= 4 && bytes[0] === 255 && bytes[1] === 216) {
    let at = 2,
      width = 0,
      height = 0,
      orientation = 1;
    while (at < size) {
      check(at, 2);
      if (bytes[at] !== 255) throw invalid();
      while (bytes[at] === 255) at++;
      check(at, 1);
      const marker = bytes[at++];
      if (marker === 217 || marker === 218) break;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      check(at, 2);
      const length = view.getUint16(at);
      if (length < 2) throw invalid();
      check(at, length);
      if (
        marker === 225 &&
        length >= 16 &&
        text(bytes, at + 2, 6) === "Exif\0\0"
      ) {
        const tiff = at + 8;
        const little = text(bytes, tiff, 2) === "II";
        if (
          (little || text(bytes, tiff, 2) === "MM") &&
          view.getUint16(tiff + 2, little) === 42
        ) {
          const directory = tiff + view.getUint32(tiff + 4, little);
          if (directory >= tiff && directory + 2 <= at + length) {
            const count = Math.min(view.getUint16(directory, little), 256);
            for (let n = 0; n < count; n++) {
              const entry = directory + 2 + n * 12;
              if (entry + 12 > at + length) break;
              if (
                view.getUint16(entry, little) === 274 &&
                view.getUint16(entry + 2, little) === 3 &&
                view.getUint32(entry + 4, little) === 1
              ) {
                const value = view.getUint16(entry + 8, little);
                if (value >= 1 && value <= 8) orientation = value;
              }
            }
          }
        }
      }
      if (
        [
          192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207,
        ].includes(marker)
      ) {
        if (length < 8) throw invalid();
        height = view.getUint16(at + 3);
        width = view.getUint16(at + 5);
      }
      at += length;
    }
    if (width && height) return { kind: "jpeg", width, height, orientation };
  }
  if (size >= 12 && text(bytes, 4, 4) === "ftyp")
    throw Error(
      "HEIC/HEIF and AVIF photos are not supported in this editor yet. Choose a JPEG, PNG or WebP version; no external resizing is needed.",
    );
  throw invalid();
}

export function validateSource(
  header: ImageHeader,
  bytes: number,
  policy: PhotoPolicy,
) {
  if (!validPhotoPolicy(policy))
    throw Error("Photo settings are unavailable. Try again later.");
  if (!policy.enabled) throw Error("Photos are not enabled for this plan yet.");
  if (!Number.isFinite(bytes) || bytes < 1 || bytes > policy.maxInputBytes)
    throw Error(
      `This unusually large file is over ${Math.round(policy.maxInputBytes / 1048576)} MB. Choose a normal phone photo or a smaller export.`,
    );
  if (
    !Number.isInteger(header.width) ||
    !Number.isInteger(header.height) ||
    header.width < 1 ||
    header.height < 1 ||
    header.width * header.height > policy.maxInputPixels ||
    header.width > 65535 ||
    header.height > 65535
  )
    throw Error(
      `This image is too large to safely process here. Choose an image up to ${Math.round(policy.maxInputPixels / 1000000)} megapixels.`,
    );
}

export function normalizeCrop(crop: Crop): Required<Crop> {
  const rotation = crop.rotation ?? 0;
  if (
    ![crop.zoom, crop.offsetX, crop.offsetY, rotation].every(Number.isFinite) ||
    rotation % 90 !== 0
  )
    throw Error("Invalid photo crop.");
  return {
    zoom: Math.min(4, Math.max(1, crop.zoom)),
    offsetX: Math.min(1, Math.max(-1, crop.offsetX)),
    offsetY: Math.min(1, Math.max(-1, crop.offsetY)),
    rotation: ((rotation % 360) + 360) % 360,
  };
}

export function cropDimensions(width: number, height: number, crop: Crop) {
  if (![width, height].every(Number.isFinite) || width <= 0 || height <= 0)
    throw Error("Invalid photo crop.");
  const { rotation } = normalizeCrop(crop);
  return rotation === 90 || rotation === 270
    ? { width: height, height: width }
    : { width, height };
}

export function cropRegion(width: number, height: number, crop: Crop) {
  const normalized = normalizeCrop(crop);
  const size = cropDimensions(width, height, normalized);
  const side = Math.min(size.width, size.height) / normalized.zoom;
  const x = ((size.width - side) * (normalized.offsetX + 1)) / 2;
  const y = ((size.height - side) * (normalized.offsetY + 1)) / 2;
  return { x, y, side };
}

export interface CropPoint {
  x: number;
  y: number;
}

// Frame coordinates are fractions of its displayed size. Keep the image point
// under the gesture anchor while zooming/panning, then clamp to covered pixels.
export function adjustCrop(
  width: number,
  height: number,
  crop: Crop,
  zoom: number,
  from: CropPoint = { x: 0.5, y: 0.5 },
  to: CropPoint = from,
): Required<Crop> {
  if (![from.x, from.y, to.x, to.y, zoom].every(Number.isFinite))
    throw Error("Invalid photo crop gesture.");
  const old = cropRegion(width, height, crop);
  const next = normalizeCrop({ ...crop, zoom });
  const size = cropDimensions(width, height, next);
  const side = Math.min(size.width, size.height) / next.zoom;
  const offset = (position: number, maximum: number) =>
    maximum > 0
      ? (Math.min(maximum, Math.max(0, position)) / maximum) * 2 - 1
      : 0;
  return {
    ...next,
    offsetX: offset(old.x + from.x * old.side - to.x * side, size.width - side),
    offsetY: offset(
      old.y + from.y * old.side - to.y * side,
      size.height - side,
    ),
  };
}

export function rotateCrop(crop: Crop, turns = 1): Required<Crop> {
  if (!Number.isInteger(turns)) throw Error("Invalid photo rotation.");
  let next = normalizeCrop(crop);
  for (let n = 0; n < ((turns % 4) + 4) % 4; n++)
    next = {
      ...next,
      offsetX: -next.offsetY,
      offsetY: next.offsetX,
      rotation: (next.rotation + 90) % 360,
    };
  return next;
}

// The same source-to-output matrix drives the frame and both stored derivatives.
// No full-resolution rotated canvas or extra retained source image is needed.
export function cropMatrix(
  width: number,
  height: number,
  crop: Crop,
  dimension: number,
): [number, number, number, number, number, number] {
  if (!Number.isInteger(dimension) || dimension < 1 || dimension > 2048)
    throw Error("Invalid photo output size.");
  const { rotation } = normalizeCrop(crop);
  const region = cropRegion(width, height, crop);
  const scale = dimension / region.side;
  const transforms: Record<number, number[]> = {
    0: [1, 0, 0, 1, 0, 0],
    90: [0, 1, -1, 0, height, 0],
    180: [-1, 0, 0, -1, width, height],
    270: [0, -1, 1, 0, 0, width],
  };
  const [a, b, c, d, e, f] = transforms[rotation];
  return [
    a * scale,
    b * scale,
    c * scale,
    d * scale,
    (e - region.x) * scale,
    (f - region.y) * scale,
  ];
}

export async function preparePhoto(
  file: Blob,
  policy: PhotoPolicy,
): Promise<PreparedPhoto> {
  if (!validPhotoPolicy(policy))
    throw Error("Photo settings are unavailable. Try again later.");
  if (!policy.enabled) throw Error("Photos are not enabled for this plan yet.");
  if (file.size > policy.maxInputBytes)
    validateSource(
      { kind: "jpeg", width: 1, height: 1, orientation: 1 },
      file.size,
      policy,
    );
  const header = inspectImageHeader(new Uint8Array(await file.arrayBuffer()));
  validateSource(header, file.size, policy);
  const rotated = header.orientation >= 5;
  const sourceWidth = rotated ? header.height : header.width;
  const sourceHeight = rotated ? header.width : header.height;
  const factor = Math.min(1, 2048 / Math.max(sourceWidth, sourceHeight));
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
      resizeWidth: Math.max(1, Math.round(sourceWidth * factor)),
      resizeHeight: Math.max(1, Math.round(sourceHeight * factor)),
      resizeQuality: "high",
    });
  } catch {
    throw invalid();
  }
  return {
    bitmap,
    width: bitmap.width,
    height: bitmap.height,
    sourceWidth,
    sourceHeight,
    close: () => bitmap.close(),
  };
}

export function paintCrop(
  canvas: HTMLCanvasElement,
  image: PreparedPhoto,
  crop: Crop,
  dimension: number,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx)
    throw Error("This browser cannot edit photos. Try a current browser.");
  canvas.width = dimension;
  canvas.height = dimension;
  const matrix = cropMatrix(image.width, image.height, crop, dimension);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, dimension, dimension);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.save();
  try {
    ctx.setTransform(...matrix);
    ctx.drawImage(image.bitmap, 0, 0);
  } finally {
    ctx.restore();
  }
}

// Canvas encoders can add ICC/other APP markers even after a fresh rendering.
// Remove every APP/COM segment, including between progressive scans, rather than
// sending encoder metadata to the private storage boundary. Image/scan bytes stay
// untouched; the image itself has already been decoded and freshly re-encoded.
export function stripJpegMetadata(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  if (bytes.length < 4 || bytes[0] !== 255 || bytes[1] !== 216) throw invalid();
  const chunks: Uint8Array[] = [];
  let at = 2,
    keepFrom = 0;
  while (at < bytes.length) {
    const start = at;
    if (bytes[at++] !== 255) throw invalid();
    while (bytes[at] === 255) at++;
    const marker = bytes[at++];
    if (marker === 217) {
      if (at !== bytes.length) throw invalid();
      chunks.push(bytes.subarray(keepFrom));
      const result = new Uint8Array(
        chunks.reduce((sum, chunk) => sum + chunk.length, 0),
      );
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
      return result;
    }
    if (marker === 216 || marker === undefined || marker === 0) throw invalid();
    if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
    if (at + 2 > bytes.length) throw invalid();
    const length = bytes[at] * 256 + bytes[at + 1];
    if (length < 2 || at + length > bytes.length) throw invalid();
    at += length;
    if ((marker >= 224 && marker <= 239) || marker === 254) {
      chunks.push(bytes.subarray(keepFrom, start));
      keepFrom = at;
    }
    if (marker === 218) {
      while (at < bytes.length) {
        if (bytes[at] !== 255) {
          at++;
          continue;
        }
        const scanMarker = at;
        while (bytes[at] === 255) at++;
        if (bytes[at] === 0 || (bytes[at] >= 208 && bytes[at] <= 215)) {
          at++;
          continue;
        }
        at = scanMarker;
        break;
      }
    }
  }
  throw invalid();
}

async function optimizedJpeg(
  image: PreparedPhoto,
  crop: Crop,
  dimension: number,
  cap: number,
) {
  const canvas = document.createElement("canvas");
  const minimum = Math.min(96, dimension);
  for (
    let size = dimension;
    size >= minimum;
    size = Math.max(minimum - 1, Math.floor(size * 0.8))
  ) {
    paintCrop(canvas, image, crop, size);
    for (const quality of [0.9, 0.8, 0.7, 0.6, 0.5, 0.4]) {
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (value) =>
            value
              ? resolve(value)
              : reject(Error("Photo optimization failed. Try another photo.")),
          "image/jpeg",
          quality,
        ),
      );
      if (blob.type === "image/jpeg") {
        const clean = stripJpegMetadata(
          new Uint8Array(await blob.arrayBuffer()),
        );
        if (clean.length <= cap)
          return new Blob([clean], { type: "image/jpeg" });
      }
    }
  }
  throw Error("This photo could not be optimized safely. Try another photo.");
}

export async function optimizePhoto(
  image: PreparedPhoto,
  crop: Crop,
  policy: PhotoPolicy,
): Promise<ProcessedPhoto> {
  if (!validPhotoPolicy(policy))
    throw Error("Photo settings are unavailable. Try again later.");
  if (!policy.enabled) throw Error("Photos are not enabled for this plan yet.");
  const available = Math.max(
    1,
    Math.floor(cropRegion(image.width, image.height, crop).side),
  );
  const web = await optimizedJpeg(
    image,
    crop,
    Math.min(available, policy.webMaxDimension),
    policy.webMaxBytes,
  );
  const vcf = await optimizedJpeg(
    image,
    crop,
    Math.min(available, policy.vcfMaxDimension),
    policy.vcfMaxBytes,
  );
  const result = inspectImageHeader(new Uint8Array(await web.arrayBuffer()));
  return { web, vcf, width: result.width, height: result.height };
}

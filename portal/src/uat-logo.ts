import { preparePhoto, stripJpegMetadata } from "./photo-processing";
import type { PhotoPolicy } from "./domain";
export async function optimizeLogo(
  source: Blob,
  policy: PhotoPolicy,
): Promise<Blob> {
  const image = await preparePhoto(source, policy);
  try {
    const canvas = document.createElement("canvas"),
      ctx = canvas.getContext("2d");
    if (!ctx) throw Error("This browser cannot prepare the logo.");
    for (const max of [512, 384, 256]) {
      const scale = Math.min(1, max / Math.max(image.width, image.height));
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image.bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.9, 0.75, 0.6, 0.45]) {
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(Error("Logo preparation failed."))),
            "image/jpeg",
            quality,
          ),
        );
        const bytes = stripJpegMetadata(
          new Uint8Array(await blob.arrayBuffer()),
        );
        if (bytes.length <= 153600)
          return new Blob([bytes], { type: "image/jpeg" });
      }
    }
    throw Error("This logo could not be optimized. Choose another image.");
  } finally {
    image.close();
  }
}

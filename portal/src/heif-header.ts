/** Bounded HEIF metadata inspection before any native/codec pixel allocation. */
export interface HeifHeader {
  kind: 'heif'; width: number; height: number; orientation: 1; maxDeclaredPixels: number;
}
interface Box { type: string; payload: number; end: number }
const invalid = () => Error('This HEIC/HEIF photo is damaged or uses an unsupported image layout. Choose another photo.');
export function inspectHeifHeader(bytes: Uint8Array): HeifHeader {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (at: number, length: number) => String.fromCharCode(...bytes.subarray(at, at + length));
  const need = (at: number, length: number, end = bytes.length) => {
    if (!Number.isSafeInteger(at) || length < 0 || at < 0 || at + length > end) throw invalid();
  };
  let count = 0;
  const boxes = (start: number, end: number): Box[] => {
    const result: Box[] = [];
    for (let at = start; at < end;) {
      if (++count > 10000) throw invalid();
      need(at, 8, end);
      let size = view.getUint32(at), header = 8;
      if (size === 1) {
        need(at, 16, end);
        const big = view.getBigUint64(at + 8);
        if (big > BigInt(Number.MAX_SAFE_INTEGER)) throw invalid();
        size = Number(big); header = 16;
      } else if (size === 0) size = end - at;
      if (size < header) throw invalid();
      need(at, size, end);
      result.push({ type: text(at + 4, 4), payload: at + header, end: at + size });
      at += size;
    }
    return result;
  };
  const exactlyOne = (items: Box[], type: string) => {
    const found = items.filter(box => box.type === type);
    if (found.length !== 1) throw invalid();
    return found[0];
  };
  const top = boxes(0, bytes.length), ftyp = exactlyOne(top, 'ftyp');
  need(ftyp.payload, 8, ftyp.end);
  if ((ftyp.end - ftyp.payload) % 4 || (ftyp.end - ftyp.payload) / 4 > 66) throw invalid();
  const brands = [text(ftyp.payload, 4)];
  for (let at = ftyp.payload + 8; at < ftyp.end; at += 4) brands.push(text(at, 4));
  if (brands.some(brand => ['avif', 'avis'].includes(brand)))
    throw Error('AVIF photos are not supported in this editor yet. Choose a JPEG, PNG, WebP or HEIC photo.');
  if (!brands.some(brand => ['heic','heix','hevc','hevx','heim','heis','hevm','hevs','mif1','msf1'].includes(brand))) throw invalid();
  const meta = exactlyOne(top, 'meta');
  need(meta.payload, 4, meta.end);
  if (bytes[meta.payload] !== 0) throw invalid();
  const children = boxes(meta.payload + 4, meta.end), pitm = exactlyOne(children, 'pitm');
  need(pitm.payload, 6, pitm.end);
  const version = bytes[pitm.payload];
  if (version > 1) throw invalid();
  need(pitm.payload + 4, version ? 4 : 2, pitm.end);
  const primary = version ? view.getUint32(pitm.payload + 4) : view.getUint16(pitm.payload + 4);
  const iprp = exactlyOne(children, 'iprp'), properties = boxes(iprp.payload, iprp.end);
  const ipco = exactlyOne(properties, 'ipco'), definitions = boxes(ipco.payload, ipco.end);
  let maxDeclaredPixels = 0, totalEntries = 0, totalAssociations = 0;
  for (const property of definitions) {
    if (property.type !== 'ispe') continue;
    need(property.payload, 12, property.end);
    const w = view.getUint32(property.payload + 4), h = view.getUint32(property.payload + 8);
    if (bytes[property.payload] !== 0 || !w || !h) throw invalid();
    maxDeclaredPixels = Math.max(maxDeclaredPixels, w * h);
  }
  const associations: number[] = [];
  for (const ipma of properties.filter(box => box.type === 'ipma')) {
    need(ipma.payload, 8, ipma.end);
    const v = bytes[ipma.payload], flags = view.getUint32(ipma.payload) & 0xffffff;
    if (v > 1 || flags & ~1) throw invalid();
    const entries = view.getUint32(ipma.payload + 4);
    totalEntries += entries;
    if (totalEntries > 4096) throw invalid();
    let at = ipma.payload + 8;
    for (let n = 0; n < entries; n++) {
      const width = v ? 4 : 2;
      need(at, width + 1, ipma.end);
      const item = v ? view.getUint32(at) : view.getUint16(at); at += width;
      const associated = bytes[at++];
      totalAssociations += associated;
      if (totalAssociations > 16384) throw invalid();
      for (let a = 0; a < associated; a++) {
        need(at, flags & 1 ? 2 : 1, ipma.end);
        const property = flags & 1 ? view.getUint16(at) & 0x7fff : bytes[at] & 0x7f;
        at += flags & 1 ? 2 : 1;
        if (property > definitions.length) throw invalid();
        if (item === primary && property) {
          if (associations.length >= 256) throw invalid();
          associations.push(property);
        }
      }
    }
    if (at !== ipma.end) throw invalid();
  }
  let width = 0, height = 0, turns = 0;
  for (const index of associations) {
    const property = definitions[index - 1];
    if (property.type === 'ispe') {
      need(property.payload, 12, property.end);
      if (bytes[property.payload] !== 0) throw invalid();
      const w = view.getUint32(property.payload + 4), h = view.getUint32(property.payload + 8);
      if (width && (width !== w || height !== h)) throw invalid();
      width = w; height = h;
    } else if (property.type === 'irot') {
      need(property.payload, 1, property.end);
      if (bytes[property.payload] > 3) throw invalid();
      turns += bytes[property.payload];
    }
  }
  if (!width || !height) throw invalid();
  // HEIF's container transformations are applied by the decoder, not a second EXIF pass.
  return { kind: 'heif', width: turns % 2 ? height : width,
    height: turns % 2 ? width : height, orientation: 1, maxDeclaredPixels };
}

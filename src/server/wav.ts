export function combineWav(files: Uint8Array[]): Uint8Array<ArrayBuffer> {
  let format: Uint8Array | undefined;
  const parts: Uint8Array[] = [];
  for (const file of files) {
    const data = new DataView(file.buffer, file.byteOffset, file.byteLength);
    const text = (start: number, end: number) =>
      new TextDecoder().decode(file.subarray(start, end));
    if (file.length < 44 || text(0, 4) !== "RIFF" || text(8, 12) !== "WAVE")
      throw new Error("Invalid speech audio.");
    let found = false;
    for (let offset = 12; offset + 8 <= file.length;) {
      const size = data.getUint32(offset + 4, true);
      if (offset + 8 + size > file.length)
        throw new Error("Incomplete speech audio.");
      const chunk = file.subarray(offset + 8, offset + 8 + size);
      if (text(offset, offset + 4) === "fmt ") {
        if (
          format &&
          (format.length !== chunk.length ||
            !format.every((v, i) => v === chunk[i]))
        )
          throw new Error("Incompatible speech formats.");
        format = chunk.slice();
      }
      if (text(offset, offset + 4) === "data") {
        parts.push(chunk);
        found = true;
      }
      offset += 8 + size + (size % 2);
    }
    if (!found) throw new Error("Empty speech audio.");
  }
  if (!format) throw new Error("Missing speech format.");
  const length = parts.reduce((total, part) => total + part.length, 0);
  const formatLength = format.length + (format.length % 2);
  const wav = new Uint8Array(28 + formatLength + length);
  const data = new DataView(wav.buffer);
  const write = (offset: number, text: string) =>
    wav.set(new TextEncoder().encode(text), offset);
  write(0, "RIFF");
  data.setUint32(4, wav.length - 8, true);
  write(8, "WAVEfmt ");
  data.setUint32(16, format.length, true);
  wav.set(format, 20);
  write(20 + formatLength, "data");
  data.setUint32(24 + formatLength, length, true);
  let offset = 28 + formatLength;
  for (const part of parts) {
    wav.set(part, offset);
    offset += part.length;
  }
  return wav;
}

// Keep every word/punctuation mark while staying below the model's token limit.
export function speechChunks(text: string, limit = 300): string[] {
  const chunks: string[] = [];
  for (const sentence of text.match(/[^.!?]+[.!?]*|[.!?]+/gu) ?? []) {
    let current = "";
    for (const word of sentence.trim().split(/\s+/u).filter(Boolean)) {
      if (current && current.length + word.length + 1 > limit) {
        chunks.push(current);
        current = "";
      }
      let rest = word;
      while (rest.length > limit) {
        chunks.push(rest.slice(0, limit));
        rest = rest.slice(limit);
      }
      current = current ? `${current} ${rest}` : rest;
    }
    if (current) chunks.push(current);
  }
  return chunks;
}

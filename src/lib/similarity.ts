export function cosineSimilarity(
  a: number[],
  b: number[]
) {
  if (
    !Array.isArray(a) ||
    !Array.isArray(b) ||
    a.length === 0 ||
    a.length !== b.length
  ) {
    return 0;
  }

  let dot = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }

  if (
    magnitudeA === 0 ||
    magnitudeB === 0
  ) {
    return 0;
  }

  return (
    dot /
    (Math.sqrt(magnitudeA) *
      Math.sqrt(magnitudeB))
  );
}

export function rankChunks(
  chunks: any[],
  queryEmbedding: number[],
  limit = 8
) {
  return chunks
    .filter(
      (chunk) =>
        Array.isArray(chunk.embedding)
    )
    .map((chunk) => ({
      ...chunk,
      similarity:
        cosineSimilarity(
          chunk.embedding,
          queryEmbedding
        ),
    }))
    .sort(
      (a, b) =>
        b.similarity -
        a.similarity
    )
    .slice(0, limit);
}
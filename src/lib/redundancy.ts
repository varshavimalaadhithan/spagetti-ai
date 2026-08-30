type Segment = {
  videoId: string;
  chunkId: string | number;
  text: string;
  educationalScore: number;
};

function getWords(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(
      (word) => word.length > 2
    );

  return new Set(words);
}

function textSimilarity(
  a: string,
  b: string
): number {
  const wordsA = getWords(a);
  const wordsB = getWords(b);

  if (
    wordsA.size === 0 ||
    wordsB.size === 0
  ) {
    return 0;
  }

  let intersection = 0;

  for (const word of wordsA) {
    if (wordsB.has(word)) {
      intersection++;
    }
  }

  const union =
    new Set([
      ...wordsA,
      ...wordsB,
    ]).size;

  return intersection / union;
}

export function removeRedundantSegments<
  T extends Segment
>(
  segments: T[],
  maxSegments = 5,
  redundancyThreshold = 0.72
): T[] {
  const sorted = [...segments].sort(
    (a, b) =>
      b.educationalScore -
      a.educationalScore
  );

  const kept: T[] = [];

  for (const candidate of sorted) {
    const duplicate =
      kept.some((existing) => {
        /*
         * Exact same chunk.
         */
        if (
          candidate.videoId ===
            existing.videoId &&
          candidate.chunkId ===
            existing.chunkId
        ) {
          return true;
        }

        /*
         * Very similar explanation.
         */
        const similarity =
          textSimilarity(
            candidate.text,
            existing.text
          );

        return (
          similarity >=
          redundancyThreshold
        );
      });

    if (!duplicate) {
      kept.push(candidate);
    }

    if (
      kept.length >=
      maxSegments
    ) {
      break;
    }
  }

  return kept;
}
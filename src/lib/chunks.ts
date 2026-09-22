import type {
  TranscriptSegment,
} from "./transcript";

export type TranscriptChunk = {
  id: string;
  videoId: string;
  startTime: number;
  endTime: number;
  text: string;
};

export function createChunks(
  videoId: string,
  segments: TranscriptSegment[]
): TranscriptChunk[] {
  const chunks: TranscriptChunk[] = [];

  /*
   * The transcript library now returns offset and
   * duration directly in SECONDS.
   *
   * Keep enough caption segments together to give
   * semantic retrieval meaningful educational context.
   */
  const SEGMENTS_PER_CHUNK = 12;

  for (
    let i = 0;
    i < segments.length;
    i += SEGMENTS_PER_CHUNK
  ) {
    const group = segments.slice(
      i,
      i + SEGMENTS_PER_CHUNK
    );

    if (!group.length) {
      continue;
    }

    const first = group[0];
    const last =
      group[group.length - 1];

    const start =
      Number(first.offset);

    const lastOffset =
      Number(last.offset);

    const lastDuration =
      Number(last.duration);

    if (
      !Number.isFinite(start) ||
      !Number.isFinite(lastOffset)
    ) {
      continue;
    }

    const safeDuration =
      Number.isFinite(lastDuration) &&
      lastDuration > 0
        ? lastDuration
        : 0;

    const end =
      lastOffset +
      safeDuration;

    const text = group
      .map((segment) =>
        typeof segment.text === "string"
          ? segment.text.trim()
          : ""
      )
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (!text) {
      continue;
    }

    /*
     * IMPORTANT:
     *
     * start/end are already seconds.
     * Do NOT divide by 1000 here.
     */
    const startTime =
      Math.max(
        0,
        Math.floor(start)
      );

    let endTime =
      Math.max(
        startTime + 1,
        Math.ceil(end)
      );

    /*
     * Safety fallback for captions whose final
     * duration is missing.
     */
    if (endTime <= startTime) {
      endTime =
        startTime + 1;
    }

    chunks.push({
      id: `${videoId}-${i}`,

      videoId,

      startTime,

      endTime,

      text,
    });
  }

  return chunks;
}
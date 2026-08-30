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

    if (!group.length) continue;

    const start =
      group[0].offset;

    const last =
      group[group.length - 1];

    const end =
      last.offset + last.duration;

    chunks.push({
      id: `${videoId}-${i}`,

      videoId,

      startTime: Math.floor(
        start / 1000
      ),

      endTime: Math.ceil(
        end / 1000
      ),

      text: group
        .map((segment) => segment.text)
        .join(" "),
    });
  }

  return chunks;
}
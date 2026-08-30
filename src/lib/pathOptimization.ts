import type { SegmentAnalysis } from "@/lib/segmentAnalysis";

type OptimizableSegment = {
  videoId: string;
  chunkId: string | number;
  startTime: number;
  endTime: number;
  educationalScore: number;
  analysis: SegmentAnalysis | null;
};

function durationQuality(
  startTime: number,
  endTime: number
): number {
  const duration =
    endTime - startTime;

  if (duration <= 0) return 0.2;
  if (duration <= 180) return 1;
  if (duration <= 300) return 0.9;
  if (duration <= 480) return 0.75;
  if (duration <= 720) return 0.6;

  return 0.45;
}

function conceptMatchQuality(
  analysis: SegmentAnalysis | null,
  conceptId: string
): number {
  if (
    analysis?.conceptId === conceptId
  ) {
    return 1;
  }

  if (
    analysis?.conceptId == null
  ) {
    return 0.5;
  }

  return 0.25;
}

function roleQuality(
  analysis: SegmentAnalysis | null
): number {
  if (!analysis) {
    return 0.5;
  }

  switch (analysis.type) {
    case "FOUNDATION":
    case "CONCEPT":
      return 1;

    case "INTUITION":
      return 0.95;

    case "EXAMPLE":
      return 0.9;

    case "APPLICATION":
      return 0.85;

    case "REVIEW":
      return 0.75;

    default:
      return 0.6;
  }
}

export function optimizeSegmentsForConcept<
  T extends OptimizableSegment
>(
  conceptId: string,
  segments: T[],
  maxSegments = 2
) {
  const ranked =
    segments
      .map((segment) => {
        const educational =
          segment.educationalScore /
          100;

        const duration =
          durationQuality(
            segment.startTime,
            segment.endTime
          );

        const conceptMatch =
          conceptMatchQuality(
            segment.analysis,
            conceptId
          );

        const role =
          roleQuality(
            segment.analysis
          );

        const pathScore =
          (
            educational * 0.8 +
            duration * 0.08 +
            conceptMatch * 0.08 +
            role * 0.04
          ) * 100;

        return {
          ...segment,

          pathScore:
            Number(
              pathScore.toFixed(2)
            ),
        };
      })
      .sort(
        (a, b) =>
          b.pathScore -
          a.pathScore
      );

  if (ranked.length <= 1) {
    return ranked;
  }

  const selected =
    [ranked[0]];

  for (
    const candidate of
      ranked.slice(1)
  ) {
    if (
      selected.length >=
      maxSegments
    ) {
      break;
    }

    if (
      candidate.pathScore < 60
    ) {
      continue;
    }

    const primary =
      selected[0];

    const differentRole =
      candidate.analysis?.type !==
      primary.analysis?.type;

    const differentVideo =
      candidate.videoId !==
      primary.videoId;

    const competitiveScore =
      candidate.pathScore >=
      primary.pathScore - 12;

    if (
      competitiveScore &&
      (
        differentRole ||
        differentVideo
      )
    ) {
      selected.push(
        candidate
      );
    }
  }

  return selected;
}
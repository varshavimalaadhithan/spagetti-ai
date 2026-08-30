type SegmentAnalysis = {
  segmentId?: string;
  conceptId?: string | null;

  type?:
    | "FOUNDATION"
    | "CONCEPT"
    | "INTUITION"
    | "EXAMPLE"
    | "APPLICATION"
    | "REVIEW"
    | "OTHER"
    | string;

  difficulty?:
    | "BEGINNER"
    | "INTERMEDIATE"
    | "ADVANCED"
    | string;

  depth?: number;
  clarity?: number;
  relevance?: number;
  explanation?: string;
};

type ScorableSegment = {
  similarity?: number;

  analysis?:
    | SegmentAnalysis
    | null;

  educationalScore?: number;

  [key: string]: any;
};

function clamp(
  value: number,
  minimum: number,
  maximum: number
) {
  return Math.min(
    maximum,
    Math.max(
      minimum,
      value
    )
  );
}

/*
 * Convert cosine similarity into a safe 0–1 range.
 */

function normalizeSimilarity(
  value: unknown
) {
  const numeric =
    Number(value);

  if (
    !Number.isFinite(
      numeric
    )
  ) {
    return 0;
  }

  return clamp(
    numeric,
    0,
    1
  );
}

/*
 * Segment-analysis scores use a 1–5 scale.
 */

function normalizeFivePointScore(
  value: unknown,
  fallback = 1
) {
  const numeric =
    Number(value);

  if (
    !Number.isFinite(
      numeric
    )
  ) {
    return (
      clamp(
        fallback,
        1,
        5
      ) / 5
    );
  }

  return (
    clamp(
      numeric,
      1,
      5
    ) / 5
  );
}

/*
 * ============================================================
 * SCORE SEGMENTS FOR ONE CONCEPT
 * ============================================================
 *
 * Important:
 *
 * Segment analysis assigns every transcript segment to the
 * ONE concept it teaches most directly.
 *
 * But a single educational segment can legitimately help teach
 * several related concepts.
 *
 * Previously we multiplied segments assigned to another concept
 * by only 0.25.
 *
 * Example:
 *
 *      good educational score ≈ 80
 *      cross-concept penalty  = 0.25
 *      final score            ≈ 20
 *
 * That caused valid retrieved segments to collapse to ~19–20
 * even when semantic retrieval had found them specifically for
 * the current concept.
 *
 * Semantic retrieval is therefore treated as evidence of
 * relevance to the TARGET concept.
 *
 * The AI concept assignment is still useful, but it is now a
 * moderate confidence adjustment rather than a destructive
 * penalty.
 */

export function scoreSegmentsForConcept<
  T extends ScorableSegment
>(
  conceptId: string,
  segments: T[]
) {
  if (
    !Array.isArray(
      segments
    )
  ) {
    return [];
  }

  const scored =
    segments.map(
      (segment) => {
        const analysis =
          segment.analysis;

        const similarity =
          normalizeSimilarity(
            segment.similarity
          );

        const clarity =
          normalizeFivePointScore(
            analysis?.clarity
          );

        const depth =
          normalizeFivePointScore(
            analysis?.depth
          );

        const assignedConceptId =
          typeof analysis?.conceptId ===
            "string"
            ? analysis.conceptId
            : null;

        const isExactConcept =
          assignedConceptId ===
          conceptId;

        /*
         * Relevance needs special handling.
         *
         * When analysis selected THIS concept, trust its explicit
         * relevance judgment.
         *
         * When analysis selected ANOTHER concept, that relevance
         * number describes the other concept, not our target.
         * In that case semantic similarity is the better target-
         * concept relevance signal.
         */

        let targetRelevance =
          similarity;

        if (
          isExactConcept
        ) {
          targetRelevance =
            normalizeFivePointScore(
              analysis?.relevance
            );
        }

        /*
         * Concept-assignment confidence.
         *
         * Exact assignment:
         *     full confidence
         *
         * Another supplied concept:
         *     mild penalty because educational chunks often
         *     legitimately cover multiple related concepts
         *
         * No concept assignment:
         *     stronger penalty because the educational relevance
         *     is less certain
         */

        let conceptConfidence =
          0.75;

        if (
          isExactConcept
        ) {
          conceptConfidence =
            1;
        } else if (
          assignedConceptId
        ) {
          conceptConfidence =
            0.9;
        }

        /*
         * Educational score:
         *
         * Semantic relevance      40%
         * Target relevance        25%
         * Clarity                 20%
         * Depth                   15%
         *
         * The result remains deterministic and costs no
         * additional API calls.
         */

        const baseScore =
          similarity *
            0.4 +
          targetRelevance *
            0.25 +
          clarity *
            0.2 +
          depth *
            0.15;

        const educationalScore =
          clamp(
            baseScore *
              conceptConfidence *
              100,
            0,
            100
          );

        return {
          ...segment,

          educationalScore:
            Number(
              educationalScore.toFixed(
                2
              )
            ),

          /*
           * Useful later when benchmarking/debugging.
           * It does not affect the rest of the pipeline.
           */

          scoreBreakdown: {
            similarity:
              Number(
                (
                  similarity *
                  100
                ).toFixed(
                  1
                )
              ),

            relevance:
              Number(
                (
                  targetRelevance *
                  100
                ).toFixed(
                  1
                )
              ),

            clarity:
              Number(
                (
                  clarity *
                  100
                ).toFixed(
                  1
                )
              ),

            depth:
              Number(
                (
                  depth *
                  100
                ).toFixed(
                  1
                )
              ),

            conceptConfidence:
              Number(
                (
                  conceptConfidence *
                  100
                ).toFixed(
                  1
                )
              ),

            exactConceptMatch:
              isExactConcept,
          },
        };
      }
    );

  /*
   * Highest-quality candidate first.
   */

  scored.sort(
    (
      first,
      second
    ) =>
      Number(
        second.educationalScore ||
          0
      ) -
      Number(
        first.educationalScore ||
          0
      )
  );

  return scored;
}
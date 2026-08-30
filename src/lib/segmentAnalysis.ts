import { createHash } from "crypto";
import { openai } from "@/lib/openai";
import { getCache, setCache } from "@/lib/cache";

type Segment = {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
};

type Concept = {
  id: string;
  title: string;
  goal: string;
};

export type SegmentAnalysis = {
  segmentId: string;
  conceptId: string | null;

  type:
    | "FOUNDATION"
    | "CONCEPT"
    | "INTUITION"
    | "EXAMPLE"
    | "APPLICATION"
    | "REVIEW"
    | "OTHER";

  difficulty:
    | "BEGINNER"
    | "INTERMEDIATE"
    | "ADVANCED";

  depth: number;
  clarity: number;
  relevance: number;

  explanation: string;
};

const VALID_TYPES = new Set<
  SegmentAnalysis["type"]
>([
  "FOUNDATION",
  "CONCEPT",
  "INTUITION",
  "EXAMPLE",
  "APPLICATION",
  "REVIEW",
  "OTHER",
]);

const VALID_DIFFICULTIES = new Set<
  SegmentAnalysis["difficulty"]
>([
  "BEGINNER",
  "INTERMEDIATE",
  "ADVANCED",
]);

/*
 * Keep v1 so your existing valid
 * segment-analysis cache still works.
 */
const ANALYSIS_CACHE_VERSION = "v1";

/*
 * ============================================================
 * SCORE NORMALIZATION
 * ============================================================
 *
 * AI output should be between 1 and 5.
 *
 * Instead of crashing the whole learning path
 * if GPT gives a malformed score, safely use 1.
 */

function normalizeScore(
  value: unknown,
  fieldName: string,
  segmentId: string
): number {
  const score = Number(value);

  if (!Number.isFinite(score)) {
    console.warn(
      `Invalid ${fieldName} score for ${segmentId}. Using 1.`
    );

    return 1;
  }

  return Math.min(
    5,
    Math.max(
      1,
      Math.round(score)
    )
  );
}

/*
 * ============================================================
 * CACHE KEY
 * ============================================================
 */

function createAnalysisCacheKey(
  segment: Segment,
  concepts: Concept[]
): string {
  const data = JSON.stringify({
    version:
      ANALYSIS_CACHE_VERSION,

    segment: {
      id:
        segment.id,

      text:
        segment.text,

      startTime:
        segment.startTime,

      endTime:
        segment.endTime,
    },

    concepts:
      concepts.map(
        (concept) => ({
          id:
            concept.id,

          title:
            concept.title,

          goal:
            concept.goal,
        })
      ),
  });

  const hash =
    createHash("sha256")
      .update(data)
      .digest("hex");

  return `segment-analysis-${hash}`;
}

/*
 * ============================================================
 * MAIN SEGMENT ANALYSIS
 * ============================================================
 */

export async function analyzeSegments(
  segments: Segment[],
  concepts: Concept[]
): Promise<SegmentAnalysis[]> {
  if (
    segments.length === 0
  ) {
    return [];
  }

  if (
    concepts.length === 0
  ) {
    throw new Error(
      "No concepts provided for segment analysis."
    );
  }

  /*
   * ============================================================
   * STEP 1
   * CHECK CACHE
   * ============================================================
   */

  const analysisBySegmentId =
    new Map<
      string,
      SegmentAnalysis
    >();

  const cacheKeyBySegmentId =
    new Map<
      string,
      string
    >();

  const segmentsToAnalyze:
    Segment[] = [];

  for (
    const segment of
      segments
  ) {
    const cacheKey =
      createAnalysisCacheKey(
        segment,
        concepts
      );

    cacheKeyBySegmentId.set(
      segment.id,
      cacheKey
    );

    const cached =
      getCache<SegmentAnalysis>(
        cacheKey
      );

    if (
      cached &&
      cached.segmentId ===
        segment.id
    ) {
      analysisBySegmentId.set(
        segment.id,
        cached
      );
    } else {
      segmentsToAnalyze.push(
        segment
      );
    }
  }

  const cacheHits =
    segments.length -
    segmentsToAnalyze.length;

  console.log(
    `Segment analysis cache: ${cacheHits}/${segments.length} hits.`
  );

  /*
   * Everything was cached.
   * Skip OpenAI completely.
   */

  if (
    segmentsToAnalyze.length ===
    0
  ) {
    console.log(
      "All segment analyses found in cache."
    );

    return segments.map(
      (segment) =>
        analysisBySegmentId.get(
          segment.id
        )!
    );
  }

  console.log(
    `Analyzing ${segmentsToAnalyze.length} uncached segments...`
  );

  /*
   * ============================================================
   * STEP 2
   * BUILD AI PROMPT
   * ============================================================
   */

  const prompt = {
    concepts:
      concepts.map(
        (concept) => ({
          id:
            concept.id,

          title:
            concept.title,

          goal:
            concept.goal,
        })
      ),

    segments:
      segmentsToAnalyze.map(
        (segment) => ({
          id:
            segment.id,

          text:
            segment.text,

          startTime:
            segment.startTime,

          endTime:
            segment.endTime,
        })
      ),
  };

  /*
   * ============================================================
   * STEP 3
   * CALL OPENAI
   * ============================================================
   */

  const response =
    await openai.chat.completions.create(
      {
        model:
          "gpt-4.1-mini",

        response_format: {
          type:
            "json_object",
        },

        messages: [
          {
            role:
              "system",

            content: `
You are the educational segment-analysis engine for Spaghetti AI.

Your job is to analyze transcript segments from educational YouTube videos.

For EVERY supplied segment:

1. Determine which supplied learning concept the segment most directly teaches.
2. If the segment does not meaningfully teach any supplied concept, set conceptId to null.
3. Classify the segment's educational role.
4. Estimate its difficulty.
5. Rate its educational depth from 1 to 5.
6. Rate its clarity from 1 to 5.
7. Rate its relevance to the identified concept from 1 to 5.
8. Give a very short explanation of its educational value.

Educational types:

FOUNDATION
CONCEPT
INTUITION
EXAMPLE
APPLICATION
REVIEW
OTHER

Difficulty levels:

BEGINNER
INTERMEDIATE
ADVANCED

DEPTH:

1 = superficial mention
2 = limited explanation
3 = useful explanation
4 = substantial explanation
5 = deep or highly instructive explanation

CLARITY:

1 = confusing or fragmented
2 = difficult to follow
3 = understandable
4 = clear
5 = exceptionally clear

RELEVANCE:

1 = barely related
2 = somewhat related
3 = meaningfully relevant
4 = strongly relevant
5 = directly teaches the concept

IMPORTANT RULES:

- Return exactly one analysis for every supplied segment.
- Use every supplied segment ID exactly once.
- Never return the same segment ID twice.
- Preserve the supplied segment IDs exactly.
- Only use concept IDs supplied to you.
- Never invent concepts.
- Never invent segment IDs.
- Never invent timestamps.
- Judge only the supplied transcript text.
- A segment may teach a concept without explicitly naming it.
- Prefer the most specific matching concept.
- conceptId must be null if the segment does not meaningfully teach a supplied concept.
- If conceptId is null, relevance must be 1.
- Do not confuse mentioning a concept with teaching it.
- Keep explanations concise.
- Do not assume information not present in the transcript.

Return ONLY valid JSON:

{
  "segments": [
    {
      "segmentId": "segment-id",
      "conceptId": "concept-1",
      "type": "CONCEPT",
      "difficulty": "BEGINNER",
      "depth": 4,
      "clarity": 5,
      "relevance": 5,
      "explanation": "Clearly explains the central idea."
    }
  ]
}
`,
          },

          {
            role:
              "user",

            content:
              JSON.stringify(
                prompt
              ),
          },
        ],
      }
    );

  /*
   * Token usage logging.
   */

  if (
    response.usage
  ) {
    console.log(
      "Segment analysis token usage:",
      response.usage
    );
  }

  /*
   * ============================================================
   * STEP 4
   * PARSE RESPONSE
   * ============================================================
   */

  const text =
    response
      .choices[0]
      ?.message
      ?.content ||
    "{}";

  let parsed: {
    segments?: any[];
  };

  try {
    parsed =
      JSON.parse(
        text
      );
  } catch {
    throw new Error(
      "AI returned invalid segment-analysis JSON."
    );
  }

  if (
    !Array.isArray(
      parsed.segments
    )
  ) {
    throw new Error(
      "AI returned no segment analysis."
    );
  }

  /*
   * ============================================================
   * STEP 5
   * VALIDATE + CLEAN AI RESPONSE
   * ============================================================
   */

  const validSegmentIds =
    new Set(
      segmentsToAnalyze.map(
        (segment) =>
          segment.id
      )
    );

  const validConceptIds =
    new Set(
      concepts.map(
        (concept) =>
          concept.id
      )
    );

  const seenSegmentIds =
    new Set<string>();

  const cleaned:
    SegmentAnalysis[] = [];

  /*
   * IMPORTANT:
   *
   * We no longer crash if GPT returns:
   *
   * - a duplicate segment
   * - an unknown segment
   * - an invalid educational type
   * - an invalid difficulty
   * - a malformed score
   *
   * Bad output receives a safe fallback
   * instead of killing the whole path.
   */

  for (
    const result of
      parsed.segments
  ) {
    /*
     * Ignore unknown / invented IDs.
     */

    if (
      !result ||
      typeof result.segmentId !==
        "string" ||
      !validSegmentIds.has(
        result.segmentId
      )
    ) {
      console.warn(
        "AI returned an unknown segment ID. Ignoring it."
      );

      continue;
    }

    /*
     * FIX FOR YOUR CURRENT ERROR.
     *
     * If GPT returns the same segment
     * twice, keep the first one and
     * ignore the duplicate.
     */

    if (
      seenSegmentIds.has(
        result.segmentId
      )
    ) {
      console.warn(
        `Duplicate segment analysis ignored: ${result.segmentId}`
      );

      continue;
    }

    seenSegmentIds.add(
      result.segmentId
    );

    /*
     * Validate concept.
     */

    const conceptId =
      typeof result.conceptId ===
        "string" &&
      validConceptIds.has(
        result.conceptId
      )
        ? result.conceptId
        : null;

    /*
     * Normalize educational type.
     */

    const normalizedType:
      SegmentAnalysis["type"] =
      VALID_TYPES.has(
        result.type
      )
        ? result.type
        : "OTHER";

    /*
     * Normalize difficulty instead of
     * crashing the entire request.
     */

    const normalizedDifficulty:
      SegmentAnalysis["difficulty"] =
      VALID_DIFFICULTIES.has(
        result.difficulty
      )
        ? result.difficulty
        : "BEGINNER";

    if (
      !VALID_DIFFICULTIES.has(
        result.difficulty
      )
    ) {
      console.warn(
        `Invalid difficulty for ${result.segmentId}. Using BEGINNER.`
      );
    }

    /*
     * Normalize scores.
     */

    const depth =
      normalizeScore(
        result.depth,
        "depth",
        result.segmentId
      );

    const clarity =
      normalizeScore(
        result.clarity,
        "clarity",
        result.segmentId
      );

    const relevance =
      conceptId === null
        ? 1
        : normalizeScore(
            result.relevance,
            "relevance",
            result.segmentId
          );

    /*
     * Normalize explanation.
     */

    const explanation =
      typeof result.explanation ===
        "string" &&
      result.explanation.trim()
        ? result.explanation.trim()
        : "Educational segment.";

    cleaned.push({
      segmentId:
        result.segmentId,

      conceptId,

      type:
        normalizedType,

      difficulty:
        normalizedDifficulty,

      depth,

      clarity,

      relevance,

      explanation,
    });
  }

  /*
   * ============================================================
   * STEP 6
   * FILL MISSING ANALYSES SAFELY
   * ============================================================
   *
   * GPT occasionally returns fewer results
   * than requested.
   *
   * We create a LOW-SCORE fallback so the
   * pipeline can continue.
   *
   * IMPORTANT:
   * Fallbacks are NOT cached.
   */

  const fallbackSegmentIds =
    new Set<string>();

  if (
    cleaned.length !==
    segmentsToAnalyze.length
  ) {
    console.warn(
      `AI analyzed ${cleaned.length} of ${segmentsToAnalyze.length} uncached segments. Filling missing analyses safely.`
    );

    const analyzedIds =
      new Set(
        cleaned.map(
          (analysis) =>
            analysis.segmentId
        )
      );

    for (
      const segment of
        segmentsToAnalyze
    ) {
      if (
        analyzedIds.has(
          segment.id
        )
      ) {
        continue;
      }

      fallbackSegmentIds.add(
        segment.id
      );

      cleaned.push({
        segmentId:
          segment.id,

        conceptId:
          null,

        type:
          "OTHER",

        difficulty:
          "BEGINNER",

        depth:
          1,

        clarity:
          1,

        relevance:
          1,

        explanation:
          "Analysis unavailable.",
      });
    }
  }

  /*
   * ============================================================
   * STEP 7
   * CACHE VALID NEW ANALYSES
   * ============================================================
   */

  let cachedNewAnalyses =
    0;

  for (
    const analysis of
      cleaned
  ) {
    /*
     * Always make the result available
     * for this run.
     */

    analysisBySegmentId.set(
      analysis.segmentId,
      analysis
    );

    /*
     * Do NOT cache fallback analyses.
     *
     * This allows that segment to be
     * retried in a future request.
     */

    if (
      fallbackSegmentIds.has(
        analysis.segmentId
      )
    ) {
      continue;
    }

    const cacheKey =
      cacheKeyBySegmentId.get(
        analysis.segmentId
      );

    if (
      !cacheKey
    ) {
      continue;
    }

    setCache(
      cacheKey,
      analysis
    );

    cachedNewAnalyses++;
  }

  console.log(
    `Cached ${cachedNewAnalyses} new segment analyses.`
  );

  if (
    fallbackSegmentIds.size >
    0
  ) {
    console.warn(
      `${fallbackSegmentIds.size} fallback segment analyses were not cached and will be retried next run.`
    );
  }

  /*
   * ============================================================
   * STEP 8
   * RESTORE ORIGINAL SEGMENT ORDER
   * ============================================================
   */

  return segments.map(
    (segment) => {
      const analysis =
        analysisBySegmentId.get(
          segment.id
        );

      /*
       * This should almost never happen
       * because missing AI results were
       * filled above.
       */

      if (
        !analysis
      ) {
        console.warn(
          `Missing final analysis for ${segment.id}. Using emergency fallback.`
        );

        return {
          segmentId:
            segment.id,

          conceptId:
            null,

          type:
            "OTHER" as const,

          difficulty:
            "BEGINNER" as const,

          depth:
            1,

          clarity:
            1,

          relevance:
            1,

          explanation:
            "Analysis unavailable.",
        };
      }

      return analysis;
    }
  );
}
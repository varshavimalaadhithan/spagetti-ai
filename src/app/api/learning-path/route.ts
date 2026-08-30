import { createHash } from "crypto";
import { validateLearningPath } from "@/lib/validation";
import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";
import { getTranscript } from "@/lib/transcript";
import { createChunks } from "@/lib/chunks";
import { createEmbeddings } from "@/lib/embeddings";
import { rankChunks } from "@/lib/similarity";
import { getCache, setCache } from "@/lib/cache";
import {
  getPersistentCache,
  setPersistentCache,
} from "@/lib/persistentCache";
import {
  consumeTrialGeneration,
  getTrialStatus,
  refundTrialGeneration,
} from "@/lib/trial";

import { analyzeSegments } from "@/lib/segmentAnalysis";
import type { SegmentAnalysis } from "@/lib/segmentAnalysis";

import { scoreSegmentsForConcept } from "@/lib/segmentScoring";
import { removeRedundantSegments } from "@/lib/redundancy";
import { optimizeSegmentsForConcept } from "@/lib/pathOptimization";
export const maxDuration = 120;
type Concept = {
  id: string;
  title: string;
  goal: string;
};

type PrerequisiteRelationship = {
  prerequisite: string;
  concept: string;
  reason: string;
};

type PrerequisiteData = {
  relationships: PrerequisiteRelationship[];
  orderedConceptIds: string[];
};

type ProcessedVideo = {
  videoId: string;
  title: string;
  chunks: any[];
};

const FINAL_PATH_CACHE_VERSION = "v7";
const CONCEPT_EMBEDDING_CACHE_VERSION = "v2";
const FINAL_PATH_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const RETRIEVAL_CANDIDATES_PER_CONCEPT = 6;
const RETRIEVAL_RANK_POOL_SIZE = 20;
const MAX_RETRIEVAL_SEGMENTS_PER_VIDEO = 2;
const MIN_ACCEPTABLE_CONCEPT_COVERAGE = 80;

const ANALYSIS_BATCH_SIZE = 10;
const ANALYSIS_CONCURRENCY = 3;

function createHashedCacheKey(
  prefix: string,
  value: unknown
) {
  const hash = createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");

  return `${prefix}-${hash}`;
}

function normalizeQuery(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

const CLOUD_TRANSCRIPT_TTL_SECONDS =
  30 * 24 * 60 * 60;

const CLOUD_TOPIC_TTL_SECONDS =
  14 * 24 * 60 * 60;

async function getTieredCache<T>(
  key: string
): Promise<T | null> {
  const local = getCache<T>(key);

  if (local !== null) {
    return local;
  }

  const persistent =
    await getPersistentCache<T>(
      key
    );

  if (persistent !== null) {
    console.log(
      `Persistent cache hit: ${key}`
    );

    setCache(
      key,
      persistent
    );

    return persistent;
  }

  return null;
}

async function setTieredCache<T>(
  key: string,
  value: T,
  ttlSeconds: number
) {
  setCache(
    key,
    value
  );

  await setPersistentCache(
    key,
    value,
    ttlSeconds
  );
}

async function sleep(ms: number) {
  await new Promise((resolve) =>
    setTimeout(resolve, ms)
  );
}

async function analyzeBatchWithRetry(
  batch: {
    id: string;
    text: string;
    startTime: number;
    endTime: number;
  }[],
  concepts: Concept[],
  batchNumber: number
) {
  try {
    console.log(
      `Analyzing segment batch ${batchNumber}...`
    );

    return await analyzeSegments(
      batch,
      concepts
    );
  } catch (error) {
    console.warn(
      `Segment batch ${batchNumber} failed once. Retrying...`
    );

    await sleep(700);

    return analyzeSegments(
      batch,
      concepts
    );
  }
}

export async function POST(
  request: Request
) {
  const startTime = Date.now();

  let trialReservationActive = false;

  const stageTimes: Record<string, number> = {};

  function startStage() {
    return Date.now();
  }

  function endStage(
    name: string,
    startedAt: number
  ) {
    const seconds =
      (Date.now() - startedAt) /
      1000;

    stageTimes[name] =
      Number(
        seconds.toFixed(3)
      );

    console.log(
      `⏱ ${name}: ${seconds.toFixed(3)}s`
    );
  }

  try {
    const body =
      await request.json();

    const videos =
      body.videos;

    const query =
      body.query;

    if (
      !Array.isArray(videos) ||
      videos.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "No videos provided.",
        },
        {
          status: 400,
        }
      );
    }

    const learningQuery =
      typeof query === "string" &&
      query.trim().length > 0
        ? query.trim()
        : videos
            .map(
              (video: any) =>
                video.title || ""
            )
            .join(" ")
            .trim();

    /*
     * ============================================================
     * FAST FINAL PATH CACHE
     * ============================================================
     *
     * Keyed by the normalized learning query instead of the
     * currently selected video IDs. This means a repeated search
     * can return the last validated path even if video ranking
     * returns the same videos in a different order.
     *
     * Cache entries expire after 7 days and the version number
     * lets us invalidate older pipeline results safely.
     */

    const normalizedLearningQuery =
      normalizeQuery(learningQuery);

    const finalPathCacheKey =
      createHashedCacheKey(
        `final-learning-path-${FINAL_PATH_CACHE_VERSION}`,
        {
          query:
            normalizedLearningQuery,
        }
      );

    const cachedFinalPath =
      await getTieredCache<{
        createdAt: number;
        payload: any;
      }>(
        finalPathCacheKey
      );

    if (
      cachedFinalPath &&
      typeof cachedFinalPath.createdAt ===
        "number" &&
      Date.now() -
        cachedFinalPath.createdAt <
        FINAL_PATH_CACHE_TTL_MS &&
      cachedFinalPath.payload
    ) {
      const cachedProcessingTime =
        (
          Date.now() -
          startTime
        ) / 1000;

      console.log(
        "Final learning path cache hit."
      );

      const trial =
        await getTrialStatus(
          request
        );

      return NextResponse.json({
        ...cachedFinalPath.payload,
        cacheHit: true,
        processingTime:
          cachedProcessingTime,
        trial,
      });
    }

    /*
     * ============================================================
     * FREE TRIAL GUARD
     * ============================================================
     *
     * Only CACHE MISSES consume a daily trial generation.
     * Cached final learning paths return above and stay free.
     */

    const trial =
      await consumeTrialGeneration(
        request
      );

    trialReservationActive =
      trial.enabled &&
      trial.success;

    if (!trial.success) {
      console.warn(
        "Trial limit reached for this visitor."
      );

      return NextResponse.json(
        {
          error:
            `You've used today's ${trial.limit} free learning paths. Your trial resets automatically.`,
          code:
            "TRIAL_LIMIT_REACHED",
          trial,
        },
        {
          status: 429,
          headers: {
            "Cache-Control":
              "no-store, max-age=0",
          },
        }
      );
    }

    if (trial.enabled) {
      console.log(
        `Trial generation consumed. ${trial.remaining}/${trial.limit} remaining.`
      );
    }

    console.log(
      `Learning path: preparing ${videos.length} videos...`
    );

    /*
     * ============================================================
     * STEP 1
     * GET TRANSCRIPTS + CREATE CHUNKS
     * ============================================================
     */

    const transcriptStage =
      startStage();

    const results =
      await Promise.all(
        videos.map(
          async (
            video: any
          ) => {
            const videoId =
              video.videoId ||
              video.id
                ?.videoId;

            const title =
              video.title ||
              video.snippet
                ?.title ||
              "Untitled video";

            if (!videoId) {
              return null;
            }

            const cacheKey =
              `transcript-${videoId}`;

            const cached =
              await getTieredCache<ProcessedVideo>(
                cacheKey
              );

            if (cached) {
              console.log(
                `Transcript cache hit: ${title}`
              );

              return cached;
            }

            console.log(
              `Fetching transcript: ${title}`
            );

            try {
              const transcript =
                await getTranscript(
                  videoId,
                  title
                );

              const chunks =
                createChunks(
                  videoId,
                  transcript.segments
                );

              if (
                chunks.length ===
                0
              ) {
                console.log(
                  `Transcript unusable: ${title}`
                );

                return null;
              }

              const result: ProcessedVideo =
                {
                  videoId,
                  title,
                  chunks,
                };

              await setTieredCache(
                cacheKey,
                result,
                CLOUD_TRANSCRIPT_TTL_SECONDS
              );

              console.log(
                `Cached ${chunks.length} chunks: ${title}`
              );

              return result;
            } catch {
              console.log(
                `Transcript unavailable: ${title}`
              );

              return null;
            }
          }
        )
      );

    endStage(
      "Transcripts + chunking",
      transcriptStage
    );

    const usableVideos:
      ProcessedVideo[] =
      results.filter(
        (
          video
        ): video is ProcessedVideo =>
          video !== null
      );

    if (
      usableVideos.length ===
      0
    ) {
      return NextResponse.json(
        {
          error:
            "No usable transcripts found.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * ============================================================
     * STEP 2
     * LOAD / CREATE CHUNK EMBEDDINGS
     * ============================================================
     */

    const chunkEmbeddingStage =
      startStage();

    const chunksToEmbed: {
      videoId: string;
      chunkId: string;
      text: string;
    }[] = [];

    const processedVideos:
      ProcessedVideo[] =
      usableVideos.map(
        (video) => {
          const chunks =
            video.chunks.map(
              (
                chunk: any
              ) => {
                const embeddingKey =
                  `embedding-${video.videoId}-${chunk.id}`;

                const cachedEmbedding =
                  getCache<
                    number[]
                  >(
                    embeddingKey
                  );

                if (
                  Array.isArray(
                    cachedEmbedding
                  )
                ) {
                  return {
                    ...chunk,

                    embedding:
                      cachedEmbedding,
                  };
                }

                chunksToEmbed.push(
                  {
                    videoId:
                      video.videoId,

                    chunkId:
                      String(
                        chunk.id
                      ),

                    text:
                      chunk.text,
                  }
                );

                return chunk;
              }
            );

          return {
            ...video,
            chunks,
          };
        }
      );

    if (
      chunksToEmbed.length >
      0
    ) {
      console.log(
        `Creating ${chunksToEmbed.length} new embeddings...`
      );

      // OpenAI embedding requests have a maximum total input size.
      // Keep batches small enough that even near-limit individual inputs
      // cannot push one request over the 300,000-token request ceiling.
      const EMBEDDING_BATCH_SIZE =
        32;

      const embeddings:
        number[][] = [];

      const totalEmbeddingBatches =
        Math.ceil(
          chunksToEmbed.length /
            EMBEDDING_BATCH_SIZE
        );

      for (
        let index = 0;
        index <
        chunksToEmbed.length;
        index +=
          EMBEDDING_BATCH_SIZE
      ) {
        const batch =
          chunksToEmbed.slice(
            index,
            index +
              EMBEDDING_BATCH_SIZE
          );

        const batchNumber =
          Math.floor(
            index /
              EMBEDDING_BATCH_SIZE
          ) + 1;

        console.log(
          `Creating embedding batch ${batchNumber}/${totalEmbeddingBatches} (${batch.length} chunks)...`
        );

        const batchEmbeddings =
          await createEmbeddings(
            batch.map(
              (item) =>
                item.text
            )
          );

        embeddings.push(
          ...batchEmbeddings
        );
      }

      const embeddingMap =
        new Map<
          string,
          number[]
        >();

      chunksToEmbed.forEach(
        (
          item,
          index
        ) => {
          const embedding =
            embeddings[index];

          if (!embedding) {
            return;
          }

          const embeddingKey =
            `embedding-${item.videoId}-${item.chunkId}`;

          setCache(
            embeddingKey,
            embedding
          );

          embeddingMap.set(
            `${item.videoId}-${item.chunkId}`,
            embedding
          );
        }
      );

      for (
        const video of
          processedVideos
      ) {
        video.chunks =
          video.chunks.map(
            (
              chunk: any
            ) => {
              if (
                Array.isArray(
                  chunk.embedding
                )
              ) {
                return chunk;
              }

              const embedding =
                embeddingMap.get(
                  `${video.videoId}-${chunk.id}`
                );

              if (!embedding) {
                return chunk;
              }

              return {
                ...chunk,
                embedding,
              };
            }
          );
      }

      console.log(
        `Embeddings cached: ${embeddings.length}`
      );
    } else {
      console.log(
        "All embeddings found in cache."
      );
    }

    endStage(
      "Chunk embeddings",
      chunkEmbeddingStage
    );

    /*
     * ============================================================
     * STEP 3
     * CONCEPT DECOMPOSITION
     * ============================================================
     */

    const conceptStage =
      startStage();

    const conceptCacheKey =
      `concepts-${learningQuery
        .toLowerCase()
        .replace(
          /\s+/g,
          "-"
        )}`;

    let concepts:
      Concept[] | null =
      await getTieredCache<
        Concept[]
      >(
        conceptCacheKey
      );

    if (
      Array.isArray(
        concepts
      ) &&
      concepts.length > 0
    ) {
      console.log(
        "Concept cache hit."
      );
    } else {
      console.log(
        `Generating learning concepts for: ${learningQuery}`
      );

      const conceptResponse =
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
You are the curriculum-planning engine for Spaghetti AI.

Break the user's topic into 4 to 7 important concepts.

The goal is DEEP UNDERSTANDING, not just a list of topics.

Rules:

- Start with foundational ideas.
- Progress toward advanced ideas.
- Include concepts necessary to understand later concepts.
- Avoid redundant concepts.
- Avoid overly broad concepts.
- Keep concept names concise.
- Each concept must have a clear learning goal.
- Prefer conceptual understanding over memorization.

IMPORTANT FOR THE USER INTERFACE:

The learning goal should be short and easy to scan.

Keep each goal to ONE concise sentence.

Return ONLY valid JSON:

{
  "concepts": [
    {
      "id": "concept-1",
      "title": "Concept name",
      "goal": "What the learner should understand"
    }
  ]
}
`,
              },

              {
                role: "user",

                content:
                  learningQuery,
              },
            ],
          }
        );

      const conceptText =
        conceptResponse
          .choices[0]
          ?.message
          ?.content ||
        "{}";

      let parsedConcepts: {
        concepts?: Concept[];
      };

      try {
        parsedConcepts =
          JSON.parse(
            conceptText
          );
      } catch {
        throw new Error(
          "GPT returned invalid concept JSON."
        );
      }

      concepts =
        Array.isArray(
          parsedConcepts.concepts
        )
          ? parsedConcepts.concepts
          : [];

      if (
        concepts.length ===
        0
      ) {
        throw new Error(
          "No learning concepts were generated."
        );
      }

      await setTieredCache(
        conceptCacheKey,
        concepts,
        CLOUD_TOPIC_TTL_SECONDS
      );

      console.log(
        `Generated ${concepts.length} learning concepts.`
      );

      concepts.forEach(
        (
          concept,
          index
        ) => {
          console.log(
            `${index + 1}. ${concept.title}`
          );
        }
      );
    }

    if (
      !concepts ||
      concepts.length === 0
    ) {
      throw new Error(
        "No learning concepts available."
      );
    }

    endStage(
      "Concept generation",
      conceptStage
    );

    /*
     * ============================================================
     * STEP 4
     * PREREQUISITE GRAPH
     * ============================================================
     */

    const prerequisiteStage =
      startStage();

    const prerequisiteCacheKey =
      `prerequisites-${learningQuery
        .toLowerCase()
        .replace(
          /\s+/g,
          "-"
        )}`;

    let prerequisiteData =
      await getTieredCache<
        PrerequisiteData
      >(
        prerequisiteCacheKey
      );

    if (
      prerequisiteData &&
      Array.isArray(
        prerequisiteData
          .orderedConceptIds
      )
    ) {
      console.log(
        "Prerequisite cache hit."
      );
    } else {
      console.log(
        "Generating prerequisite graph..."
      );

      const prerequisiteResponse =
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
You are the prerequisite-planning engine for Spaghetti AI.

Given a set of concepts, determine which concepts must be understood before others.

A prerequisite relationship means:

Concept A should be learned before Concept B.

Rules:

1. Use ONLY the supplied concept IDs.
2. Never invent concepts.
3. Never create self-dependencies.
4. Avoid circular dependencies.
5. Foundations must come before advanced concepts.
6. Do not create relationships just because two concepts are related.
7. Only create a prerequisite when understanding one genuinely helps understand the other.
8. Produce one best overall learning order.
9. The final ordering must contain every concept exactly once.

Return ONLY valid JSON:

{
  "relationships": [
    {
      "prerequisite": "concept-1",
      "concept": "concept-2",
      "reason": "Why concept-1 should be understood first"
    }
  ],
  "orderedConceptIds": [
    "concept-1",
    "concept-2"
  ]
}
`,
              },

              {
                role:
                  "user",

                content:
                  JSON.stringify(
                    concepts
                  ),
              },
            ],
          }
        );

      const prerequisiteText =
        prerequisiteResponse
          .choices[0]
          ?.message
          ?.content ||
        "{}";

      try {
        prerequisiteData =
          JSON.parse(
            prerequisiteText
          );
      } catch {
        throw new Error(
          "GPT returned invalid prerequisite JSON."
        );
      }

      if (
        !prerequisiteData ||
        !Array.isArray(
          prerequisiteData
            .orderedConceptIds
        )
      ) {
        throw new Error(
          "Invalid prerequisite structure."
        );
      }

      const validIds =
        new Set(
          concepts.map(
            (concept) =>
              concept.id
          )
        );

      const validOrderedIds =
        prerequisiteData
          .orderedConceptIds
          .filter(
            (id) =>
              validIds.has(
                id
              )
          );

      for (
        const concept of
          concepts
      ) {
        if (
          !validOrderedIds.includes(
            concept.id
          )
        ) {
          validOrderedIds.push(
            concept.id
          );
        }
      }

      prerequisiteData = {
        relationships:
          Array.isArray(
            prerequisiteData
              .relationships
          )
            ? prerequisiteData.relationships
            : [],

        orderedConceptIds:
          validOrderedIds,
      };

      await setTieredCache(
        prerequisiteCacheKey,
        prerequisiteData,
        CLOUD_TOPIC_TTL_SECONDS
      );

      console.log(
        `Prerequisite graph generated with ${prerequisiteData.relationships.length} relationships.`
      );
    }

    endStage(
      "Prerequisite graph",
      prerequisiteStage
    );

    /*
     * ============================================================
     * STEP 5
     * REORDER CONCEPTS USING PREREQUISITE GRAPH
     * ============================================================
     */

    const conceptMap =
      new Map<
        string,
        Concept
      >();

    concepts.forEach(
      (concept) => {
        conceptMap.set(
          concept.id,
          concept
        );
      }
    );

    const orderedConcepts =
      prerequisiteData
        .orderedConceptIds
        .map(
          (id) =>
            conceptMap.get(
              id
            )
        )
        .filter(
          (
            concept
          ): concept is Concept =>
            Boolean(
              concept
            )
        );

    const retrievalStage =
      startStage();

    /*
     * ============================================================
     * STEP 6
     * CONCEPT EMBEDDINGS
     * ============================================================
     */

    const conceptQueries =
      orderedConcepts.map(
        (concept) =>
          `${concept.title}. ${concept.goal}`
      );

    const conceptEmbeddings:
      Array<number[] | undefined> =
      new Array(
        conceptQueries.length
      );

    const missingConceptEmbeddings: {
      index: number;
      text: string;
      cacheKey: string;
    }[] = [];

    conceptQueries.forEach(
      (
        text,
        index
      ) => {
        const cacheKey =
          createHashedCacheKey(
            `concept-embedding-${CONCEPT_EMBEDDING_CACHE_VERSION}`,
            {
              text,
            }
          );

        const cached =
          getCache<number[]>(
            cacheKey
          );

        if (
          Array.isArray(cached)
        ) {
          conceptEmbeddings[
            index
          ] = cached;
        } else {
          missingConceptEmbeddings.push(
            {
              index,
              text,
              cacheKey,
            }
          );
        }
      }
    );

    if (
      missingConceptEmbeddings.length >
      0
    ) {
      console.log(
        `Creating ${missingConceptEmbeddings.length} missing concept embeddings...`
      );

      const newEmbeddings =
        await createEmbeddings(
          missingConceptEmbeddings.map(
            (item) =>
              item.text
          )
        );

      missingConceptEmbeddings.forEach(
        (
          item,
          resultIndex
        ) => {
          const embedding =
            newEmbeddings[
              resultIndex
            ];

          if (!embedding) {
            return;
          }

          conceptEmbeddings[
            item.index
          ] = embedding;

          setCache(
            item.cacheKey,
            embedding
          );
        }
      );
    } else {
      console.log(
        "All concept embeddings found in cache."
      );
    }

    /*
     * ============================================================
     * STEP 7
     * SEMANTIC RETRIEVAL
     * ============================================================
     */

    const allChunks =
      processedVideos.flatMap(
        (video) =>
          video.chunks
      );

    const conceptResults =
      orderedConcepts.map(
        (
          concept,
          index
        ) => {
          const embedding =
            conceptEmbeddings[
              index
            ];

          if (!embedding) {
            return {
              ...concept,
              chunks: [],
            };
          }

          /*
           * Rank a wider semantic pool first, then keep a
           * source-diverse shortlist. This prevents a single long
           * lecture from occupying every candidate slot for a
           * concept simply because it contributed most of the corpus.
           */

          const ranked =
            rankChunks(
              allChunks,
              embedding,
              RETRIEVAL_RANK_POOL_SIZE
            );

          const diverseRanked: any[] = [];
          const perVideoCounts =
            new Map<string, number>();
          const selectedChunkKeys =
            new Set<string>();

          for (const chunk of ranked) {
            if (
              diverseRanked.length >=
              RETRIEVAL_CANDIDATES_PER_CONCEPT
            ) {
              break;
            }

            const videoId =
              typeof chunk?.videoId === "string"
                ? chunk.videoId
                : "";

            const chunkKey =
              `${videoId}:${chunk?.id ?? ""}`;

            if (
              !videoId ||
              selectedChunkKeys.has(chunkKey)
            ) {
              continue;
            }

            const currentVideoCount =
              perVideoCounts.get(videoId) || 0;

            if (
              currentVideoCount >=
              MAX_RETRIEVAL_SEGMENTS_PER_VIDEO
            ) {
              continue;
            }

            selectedChunkKeys.add(chunkKey);
            perVideoCounts.set(
              videoId,
              currentVideoCount + 1
            );
            diverseRanked.push(chunk);
          }

          /*
           * If there are too few source videos with transcripts,
           * fill any remaining slots from the semantic ranking.
           * Relevance still wins over leaving the concept starved.
           */

          if (
            diverseRanked.length <
            RETRIEVAL_CANDIDATES_PER_CONCEPT
          ) {
            for (const chunk of ranked) {
              if (
                diverseRanked.length >=
                RETRIEVAL_CANDIDATES_PER_CONCEPT
              ) {
                break;
              }

              const videoId =
                typeof chunk?.videoId === "string"
                  ? chunk.videoId
                  : "";

              const chunkKey =
                `${videoId}:${chunk?.id ?? ""}`;

              if (
                !videoId ||
                selectedChunkKeys.has(chunkKey)
              ) {
                continue;
              }

              selectedChunkKeys.add(chunkKey);
              diverseRanked.push(chunk);
            }
          }

          console.log(
            `${concept.title}: retrieved ${diverseRanked.length} candidates from ${perVideoCounts.size} source videos.`
          );

          return {
            ...concept,

            chunks:
              diverseRanked.map(
                (
                  chunk: any
                ) => ({
                  videoId:
                    chunk.videoId,

                  chunkId:
                    chunk.id,

                  text:
                    chunk.text,

                  startTime:
                    chunk.startTime,

                  endTime:
                    chunk.endTime,

                  similarity:
                    chunk.similarity,
                })
              ),
          };
        }
      );

    console.log(
      "Concept retrieval completed."
    );

    endStage(
      "Concept embeddings + retrieval",
      retrievalStage
    );

    /*
     * ============================================================
     * STEP 8
     * EDUCATIONAL SEGMENT ANALYSIS
     * ============================================================
     */

    const analysisStage =
      startStage();

    console.log(
      "Analyzing retrieved educational segments..."
    );

    const candidateSegmentMap =
      new Map<
        string,
        {
          id: string;
          text: string;
          startTime: number;
          endTime: number;
        }
      >();

    for (
      const conceptResult of
        conceptResults
    ) {
      for (
        const chunk of
          conceptResult.chunks
      ) {
        const analysisId =
          `${chunk.videoId}:${chunk.chunkId}`;

        if (
          !candidateSegmentMap.has(
            analysisId
          )
        ) {
          candidateSegmentMap.set(
            analysisId,
            {
              id:
                analysisId,

              text:
                chunk.text,

              startTime:
                chunk.startTime,

              endTime:
                chunk.endTime,
            }
          );
        }
      }
    }

    const candidateSegments =
      Array.from(
        candidateSegmentMap.values()
      );

    console.log(
      `${candidateSegments.length} unique candidate segments require analysis.`
    );

    const segmentAnalyses:
      SegmentAnalysis[] = [];

    const analysisBatches:
      typeof candidateSegments[] =
      [];

    for (
      let index = 0;
      index <
      candidateSegments.length;
      index +=
        ANALYSIS_BATCH_SIZE
    ) {
      analysisBatches.push(
        candidateSegments.slice(
          index,
          index +
            ANALYSIS_BATCH_SIZE
        )
      );
    }

    for (
      let index = 0;
      index <
      analysisBatches.length;
      index +=
        ANALYSIS_CONCURRENCY
    ) {
      const group =
        analysisBatches.slice(
          index,
          index +
            ANALYSIS_CONCURRENCY
        );

      const groupResults =
        await Promise.all(
          group.map(
            (
              batch,
              groupIndex
            ) =>
              analyzeBatchWithRetry(
                batch,
                orderedConcepts,
                index +
                  groupIndex +
                  1
              )
          )
        );

      for (
        const batchAnalysis of
          groupResults
      ) {
        segmentAnalyses.push(
          ...batchAnalysis
        );
      }
    }

    console.log(
      `Segment analysis completed for ${segmentAnalyses.length} candidate segments.`
    );

    endStage(
      "Segment analysis",
      analysisStage
    );

    const analysisMap =
      new Map<
        string,
        SegmentAnalysis
      >();

    for (
      const analysis of
        segmentAnalyses
    ) {
      analysisMap.set(
        analysis.segmentId,
        analysis
      );
    }

    const analyzedConceptResults =
      conceptResults.map(
        (concept) => ({
          ...concept,

          chunks:
            concept.chunks.map(
              (chunk) => {
                const analysisId =
                  `${chunk.videoId}:${chunk.chunkId}`;

                return {
                  ...chunk,

                  analysis:
                    analysisMap.get(
                      analysisId
                    ) || null,
                };
              }
            ),
        })
      );

    /*
     * ============================================================
     * STEP 9
     * SEGMENT SCORING
     * ============================================================
     */

    console.log(
      "Scoring educational segments..."
    );

    const scoredConceptResults =
      analyzedConceptResults.map(
        (concept) => ({
          ...concept,

          chunks:
            scoreSegmentsForConcept(
              concept.id,
              concept.chunks
            ),
        })
      );

    for (
      const concept of
        scoredConceptResults
    ) {
      const bestSegment =
        concept.chunks[0];

      if (bestSegment) {
        console.log(
          `${concept.title}: best segment score = ${bestSegment.educationalScore}`
        );
      } else {
        console.log(
          `${concept.title}: no candidate segments`
        );
      }
    }

    console.log(
      "Segment scoring completed."
    );

    /*
     * ============================================================
     * STEP 10
     * REDUNDANCY REMOVAL
     * ============================================================
     */

    console.log(
      "Removing redundant educational segments..."
    );

    const deduplicatedConceptResults =
      scoredConceptResults.map(
        (concept) => {
          const originalCount =
            concept.chunks.length;

          const chunks =
            removeRedundantSegments(
              concept.chunks,
              5
            );

          console.log(
            `${concept.title}: ${originalCount} → ${chunks.length} candidates`
          );

          return {
            ...concept,
            chunks,
          };
        }
      );

    console.log(
      "Redundancy removal completed."
    );

    /*
     * ============================================================
     * STEP 11
     * PATH OPTIMIZATION
     * ============================================================
     */

    console.log(
      "Optimizing learning path candidates..."
    );

    const optimizedConceptResults =
      deduplicatedConceptResults.map(
        (concept) => {
          const chunks =
            optimizeSegmentsForConcept(
              concept.id,
              concept.chunks,
              2
            );

          console.log(
            `${concept.title}: ${concept.chunks.length} → ${chunks.length} optimized finalists`
          );

          return {
            ...concept,
            chunks,
          };
        }
      );

    console.log(
      "Path optimization completed."
    );

    /*
     * ============================================================
     * STEP 12
     * DETERMINISTIC FINAL LEARNING-PATH ASSEMBLY
     * ============================================================
     *
     * The expensive final GPT call has been removed.
     *
     * By this stage, candidates have already been:
     * - semantically retrieved
     * - educationally analyzed
     * - scored
     * - deduplicated
     * - path-optimized
     *
     * We now assemble the final path directly from those finalists.
     */

    const finalGenerationStage =
      startStage();

    console.log(
      `Assembling optimized learning path deterministically for: ${learningQuery}`
    );

    const MIN_FINAL_EDUCATIONAL_SCORE =
      55;

    const MAX_FINAL_RESOURCES_PER_CONCEPT =
      2;

    const usedFinalResources =
      new Set<string>();

    function shortenText(
      value: unknown,
      maxWords = 18
    ) {
      if (
        typeof value !== "string" ||
        !value.trim()
      ) {
        return "";
      }

      const words =
        value
          .trim()
          .replace(/\s+/g, " ")
          .split(" ");

      if (
        words.length <=
        maxWords
      ) {
        return words.join(" ");
      }

      return (
        words
          .slice(
            0,
            maxWords
          )
          .join(" ") +
        "..."
      );
    }

    function buildTakeaway(
      concept: Concept,
      chunk: any
    ) {
      const explanation =
        shortenText(
          chunk?.analysis
            ?.explanation,
          16
        );

      if (
        explanation
      ) {
        return explanation;
      }

      return `Understand ${concept.title} through this focused explanation.`;
    }

    function buildReason(
      chunk: any
    ) {
      const educationalScore =
        Number(
          chunk?.educationalScore ||
          0
        );

      const role =
        typeof chunk?.analysis
          ?.type === "string"
          ? chunk.analysis.type
              .toLowerCase()
              .replace(
                /_/g,
                " "
              )
          : "educational";

      if (
        educationalScore > 0
      ) {
        return `Selected for strong ${role} value with an educational score of ${educationalScore.toFixed(
          1
        )}.`;
      }

      return `Selected as a strong ${role} explanation.`;
    }

    function getCandidateResourceKey(
      chunk: any
    ) {
      const videoId =
        typeof chunk?.videoId === "string"
          ? chunk.videoId
          : "";

      const start =
        Number(chunk?.startTime);

      const end =
        Number(chunk?.endTime);

      if (
        !videoId ||
        !Number.isFinite(start) ||
        !Number.isFinite(end) ||
        start < 0 ||
        end <= start
      ) {
        return "";
      }

      return `${videoId}:${start}:${end}`;
    }

    function isUsableFinalCandidate(
      chunk: any
    ) {
      const educationalScore =
        Number(
          chunk?.educationalScore ||
          0
        );

      return (
        educationalScore >=
          MIN_FINAL_EDUCATIONAL_SCORE &&
        Boolean(
          getCandidateResourceKey(
            chunk
          )
        )
      );
    }

    /*
     * Build a richer candidate pool for each concept.
     *
     * The optimized finalists stay first because they are our
     * preferred choices. If one of those finalists has already
     * been used by another concept, we fall back through that
     * concept's other scored + deduplicated candidates.
     *
     * This prevents one shared timestamp from starving several
     * concepts of resources.
     */

    const candidatePoolsByConcept =
      new Map<string, any[]>();

    for (const concept of orderedConcepts) {
      const optimizedConcept =
        optimizedConceptResults.find(
          (item) =>
            item.id ===
            concept.id
        );

      const fallbackConcept =
        deduplicatedConceptResults.find(
          (item) =>
            item.id ===
            concept.id
        );

      const preferredCandidates =
        Array.isArray(
          optimizedConcept?.chunks
        )
          ? optimizedConcept.chunks
          : [];

      const fallbackCandidates =
        Array.isArray(
          fallbackConcept?.chunks
        )
          ? fallbackConcept.chunks
          : [];

      const mergedCandidates: any[] = [];
      const seenCandidateKeys =
        new Set<string>();

      for (
        const chunk of [
          ...preferredCandidates,
          ...fallbackCandidates,
        ]
      ) {
        if (
          !isUsableFinalCandidate(
            chunk
          )
        ) {
          continue;
        }

        const resourceKey =
          getCandidateResourceKey(
            chunk
          );

        if (
          seenCandidateKeys.has(
            resourceKey
          )
        ) {
          continue;
        }

        seenCandidateKeys.add(
          resourceKey
        );

        mergedCandidates.push(
          chunk
        );
      }

      candidatePoolsByConcept.set(
        concept.id,
        mergedCandidates
      );
    }

    const selectedChunksByConcept =
      new Map<string, any[]>();

    for (const concept of orderedConcepts) {
      selectedChunksByConcept.set(
        concept.id,
        []
      );
    }

    /*
     * ============================================================
     * COVERAGE-FIRST UNIQUE RESOURCE MATCHING
     * ============================================================
     *
     * A simple greedy allocator can fail when several concepts
     * share the same strongest timestamp. Example:
     *
     * concept A -> [segment 1, segment 2]
     * concept B -> [segment 1]
     *
     * If A greedily takes segment 1 first, B gets nothing even
     * though the correct allocation is A -> segment 2 and
     * B -> segment 1.
     *
     * We therefore use a small augmenting-path matcher. It can
     * move an earlier concept onto another valid candidate when
     * that frees a scarce timestamp for a later concept.
     *
     * This maximizes first-resource concept coverage while still
     * preserving global timestamp uniqueness.
     */

    const firstResourceByConcept =
      new Map<string, any>();

    const firstResourceOwnerByKey =
      new Map<string, string>();

    function tryAssignFirstResource(
      conceptId: string,
      visitedResourceKeys: Set<string>,
      visitedConceptIds: Set<string>
    ): boolean {
      if (
        visitedConceptIds.has(
          conceptId
        )
      ) {
        return false;
      }

      visitedConceptIds.add(
        conceptId
      );

      const candidates =
        candidatePoolsByConcept.get(
          conceptId
        ) || [];

      for (const chunk of candidates) {
        const resourceKey =
          getCandidateResourceKey(
            chunk
          );

        if (
          !resourceKey ||
          visitedResourceKeys.has(
            resourceKey
          )
        ) {
          continue;
        }

        visitedResourceKeys.add(
          resourceKey
        );

        const currentOwner =
          firstResourceOwnerByKey.get(
            resourceKey
          );

        if (!currentOwner) {
          firstResourceOwnerByKey.set(
            resourceKey,
            conceptId
          );

          firstResourceByConcept.set(
            conceptId,
            chunk
          );

          return true;
        }

        if (
          tryAssignFirstResource(
            currentOwner,
            visitedResourceKeys,
            visitedConceptIds
          )
        ) {
          firstResourceOwnerByKey.set(
            resourceKey,
            conceptId
          );

          firstResourceByConcept.set(
            conceptId,
            chunk
          );

          return true;
        }
      }

      return false;
    }

    /*
     * Concepts with fewer usable candidates go first. This makes
     * scarce concepts less likely to be boxed out and keeps the
     * matching deterministic.
     */

    const conceptsForMatching =
      [...orderedConcepts].sort(
        (first, second) => {
          const firstCount =
            candidatePoolsByConcept.get(
              first.id
            )?.length || 0;

          const secondCount =
            candidatePoolsByConcept.get(
              second.id
            )?.length || 0;

          if (
            firstCount !==
            secondCount
          ) {
            return (
              firstCount -
              secondCount
            );
          }

          return (
            orderedConcepts.findIndex(
              (item) =>
                item.id ===
                first.id
            ) -
            orderedConcepts.findIndex(
              (item) =>
                item.id ===
                second.id
            )
          );
        }
      );

    for (const concept of conceptsForMatching) {
      tryAssignFirstResource(
        concept.id,
        new Set<string>(),
        new Set<string>()
      );
    }

    /*
     * Copy matched first resources into the final selection map
     * and mark their timestamps as globally used.
     */

    for (const concept of orderedConcepts) {
      const chunk =
        firstResourceByConcept.get(
          concept.id
        );

      if (!chunk) {
        continue;
      }

      selectedChunksByConcept.set(
        concept.id,
        [chunk]
      );

      const resourceKey =
        getCandidateResourceKey(
          chunk
        );

      if (resourceKey) {
        usedFinalResources.add(
          resourceKey
        );
      }
    }

    const conceptsWithFirstResource =
      orderedConcepts.filter(
        (concept) =>
          (
            selectedChunksByConcept.get(
              concept.id
            ) || []
          ).length > 0
      ).length;

    console.log(
      `Coverage-first matching assigned ${conceptsWithFirstResource}/${orderedConcepts.length} concepts a unique first resource.`
    );

    /*
     * PASS 2: Add an optional second resource only after maximum
     * first-resource coverage has been established.
     */

    for (const concept of orderedConcepts) {
      const selected =
        selectedChunksByConcept.get(
          concept.id
        ) || [];

      if (
        selected.length === 0 ||
        selected.length >=
          MAX_FINAL_RESOURCES_PER_CONCEPT
      ) {
        continue;
      }

      const candidates =
        candidatePoolsByConcept.get(
          concept.id
        ) || [];

      for (const chunk of candidates) {
        if (
          selected.length >=
          MAX_FINAL_RESOURCES_PER_CONCEPT
        ) {
          break;
        }

        const resourceKey =
          getCandidateResourceKey(
            chunk
          );

        if (
          !resourceKey ||
          usedFinalResources.has(
            resourceKey
          )
        ) {
          continue;
        }

        selected.push(
          chunk
        );

        usedFinalResources.add(
          resourceKey
        );
      }

      selectedChunksByConcept.set(
        concept.id,
        selected
      );
    }

    /*
     * Validation must check against the SAME candidate universe
     * that the deterministic final builder is allowed to use.
     *
     * v5 incorrectly validated fallback resources against only
     * optimizedConceptResults, causing legitimate fallback
     * selections to be reported as "ungrounded".
     */

    const validationCandidateConcepts =
      orderedConcepts.map(
        (concept) => ({
          ...concept,
          chunks:
            candidatePoolsByConcept.get(
              concept.id
            ) || [],
        })
      );

    const learningPath = {
      title:
        `Learning Path: ${learningQuery}`,

      learningPath:
        orderedConcepts.map(
          (concept) => {
            const selectedChunks =
              selectedChunksByConcept.get(
                concept.id
              ) || [];

            const resources =
              selectedChunks.map(
                (chunk) => ({
                  videoId:
                    chunk.videoId,

                  startTime:
                    Number(
                      chunk.startTime
                    ),

                  endTime:
                    Number(
                      chunk.endTime
                    ),

                  takeaway:
                    buildTakeaway(
                      concept,
                      chunk
                    ),

                  reason:
                    buildReason(
                      chunk
                    ),
                })
              );

            return {
              id:
                concept.id,

              title:
                concept.title,

              goal:
                concept.goal,

              explanation:
                "",

              resources,
            };
          }
        ),
    };

    console.log(
      "Final learning path assembled from optimized finalists."
    );

    endStage(
      "Final path generation",
      finalGenerationStage
    );

    /*
     * ============================================================
     * STEP 14
     * FINAL PATH VALIDATION
     * ============================================================
     */

    console.log(
      "Validating final learning path..."
    );

const baseValidationReport =
  validateLearningPath({
    learningPath:
      Array.isArray(
        learningPath.learningPath
      )
        ? learningPath.learningPath
        : [],

    orderedConcepts,

    candidateConcepts:
      validationCandidateConcepts,
  });

const coverageQualityPassed =
  baseValidationReport.conceptCoverage >=
  MIN_ACCEPTABLE_CONCEPT_COVERAGE;

const validationReport = {
  ...baseValidationReport,

  passed:
    baseValidationReport.passed &&
    coverageQualityPassed,

  issues:
    coverageQualityPassed
      ? baseValidationReport.issues
      : [
          ...baseValidationReport.issues,
          `Concept coverage below ${MIN_ACCEPTABLE_CONCEPT_COVERAGE}% quality threshold.`,
        ],
};

console.log(
  `Validation: ${
    validationReport.passed
      ? "PASSED"
      : "FAILED"
  }`
);

console.log(
  `Concept coverage: ${validationReport.conceptCoverage}%`
);

console.log(
  `Resource grounding: ${validationReport.resourceGrounding}%`
);

console.log(
  `Duplicate resources: ${validationReport.duplicateResources}`
);

if (
  validationReport.issues.length >
  0
) {
  console.warn(
    "Validation issues:",
    validationReport.issues
  );
}
    /*
     * ============================================================
     * STEP 15
     * METRICS / LOGGING
     * ============================================================
     */

    const totalChunks =
      processedVideos.reduce(
        (
          total,
          video
        ) =>
          total +
          video.chunks.length,
        0
      );

    const embeddedChunks =
      processedVideos.reduce(
        (
          total,
          video
        ) =>
          total +
          video.chunks.filter(
            (
              chunk: any
            ) =>
              Array.isArray(
                chunk.embedding
              )
          ).length,
        0
      );

    const processingTime =
      (
        Date.now() -
        startTime
      ) / 1000;

    console.log(
      `Videos ready: ${processedVideos.length}`
    );

    console.log(
      `Total chunks: ${totalChunks}`
    );

    console.log(
      `Embedded chunks: ${embeddedChunks}`
    );

    console.log(
      `Concepts: ${orderedConcepts.length}`
    );

    console.log(
      `Prerequisite relationships: ${prerequisiteData.relationships.length}`
    );

    console.log(
      `Final learning path generated with ${
        Array.isArray(
          learningPath.learningPath
        )
          ? learningPath
              .learningPath
              .length
          : 0
      } concepts.`
    );

    console.log(
      `Total processing time: ${processingTime}s`
    );

    console.log(
      "========== STAGE TIMING =========="
    );

    console.table(
      stageTimes
    );

    console.log(
      "=================================="
    );

    /*
     * ============================================================
     * FINAL RESPONSE + QUERY-LEVEL CACHE
     * ============================================================
     */

    const cacheableResponsePayload = {
      status:
        "success",

      query:
        learningQuery,

      title:
        learningPath.title ||
        "Learning Path",

      learningPath:
        Array.isArray(
          learningPath.learningPath
        )
          ? learningPath.learningPath
          : [],

      concepts:
        orderedConcepts,

      prerequisites:
        prerequisiteData,

      videosProcessed:
        processedVideos.length,

      validation:
        validationReport,

      totalChunks,

      embeddedChunks,

      candidateSegmentsAnalyzed:
        candidateSegments.length,

      processingTime,

      stageTimes,

      cacheHit:
        false,
    };

    const responsePayload = {
      ...cacheableResponsePayload,
      trial: {
        enabled:
          trial.enabled,
        limit:
          trial.limit,
        remaining:
          trial.remaining,
        reset:
          trial.reset,
        resetAt:
          trial.resetAt,
      },
    };

    /*
     * Only cache learning paths that passed
     * grounding/order/duplicate validation.
     */

    const cacheQualityPassed =
      validationReport.passed &&
      validationReport.conceptCoverage >=
      MIN_ACCEPTABLE_CONCEPT_COVERAGE;

    if (
      cacheQualityPassed
    ) {
      await setTieredCache(
        finalPathCacheKey,
        {
          createdAt:
            Date.now(),
          payload:
            cacheableResponsePayload,
        },
        Math.floor(
          FINAL_PATH_CACHE_TTL_MS /
            1000
        )
      );

      console.log(
        "Final learning path cached."
      );
    } else {
      console.log(
        `Final learning path was not cached because quality validation failed (coverage: ${validationReport.conceptCoverage}%).`
      );
    }

    return NextResponse.json(
      responsePayload
    );
  } catch (
    error: any
  ) {
    console.error(
      "Learning path error:",
      error
    );

    if (trialReservationActive) {
      const refundedTrial =
        await refundTrialGeneration(
          request
        );

      console.log(
        `Failed generation refunded. ${refundedTrial.remaining}/${refundedTrial.limit} remaining.`
      );
    }

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Failed to generate learning path.",
      },
      {
        status: 500,
      }
    );
  }
}
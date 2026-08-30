import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";
import { getCache, setCache } from "@/lib/cache";
import {
  getPersistentCache,
  setPersistentCache,
} from "@/lib/persistentCache";

type VideoInformation = {
  videoId: string;
  title: string;
  description: string;
  channelTitle: string;
  durationSeconds: number;
  viewCount: number;
  publishedAt: string;
  originalIndex: number;
  localScore: number;
};

type CachedRecommendation = {
  videoId: string;
  reason: string;
};

type CachedRanking = {
  createdAt: number;
  recommendations: CachedRecommendation[];
};

const RANKING_CACHE_VERSION = "v2";
const RANKING_CACHE_TTL_MS =
  7 * 24 * 60 * 60 * 1000;
const MAX_MODEL_CANDIDATES = 10;
const TARGET_VIDEO_COUNT = 6;

const MAX_QUERY_LENGTH = 200;
const MAX_INPUT_VIDEOS = 30;
const MAX_REQUEST_BYTES = 512 * 1024;

function requestBodyTooLarge(request: Request) {
  const raw =
    request.headers.get("content-length");

  if (!raw) {
    return false;
  }

  const size = Number(raw);

  return (
    Number.isFinite(size) &&
    size > MAX_REQUEST_BYTES
  );
}

function normalizeQuery(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function createCacheKey(query: string) {
  const hash = createHash("sha256")
    .update(
      JSON.stringify({
        version: RANKING_CACHE_VERSION,
        query: normalizeQuery(query),
      })
    )
    .digest("hex");

  return `video-ranking-${hash}`;
}

function parseDuration(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value)
      ? Math.max(0, value)
      : 0;
  }

  if (typeof value !== "string") {
    return 0;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return 0;
  }

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }

  const iso = trimmed.match(
    /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i
  );

  if (iso) {
    const hours = Number(iso[1] || 0);
    const minutes = Number(iso[2] || 0);
    const seconds = Number(iso[3] || 0);

    return (
      hours * 3600 +
      minutes * 60 +
      seconds
    );
  }

  const parts = trimmed
    .split(":")
    .map(Number);

  if (
    parts.length >= 2 &&
    parts.every(Number.isFinite)
  ) {
    return parts.reduce(
      (total, part) =>
        total * 60 + part,
      0
    );
  }

  return 0;
}

function tokenize(value: string) {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 2)
  );
}

function calculateLocalScore(
  query: string,
  video: Omit<VideoInformation, "localScore">
) {
  const queryTokens = tokenize(query);
  const titleTokens = tokenize(video.title);
  const descriptionTokens = tokenize(
    video.description
  );

  let queryMatch = 0;

  for (const token of queryTokens) {
    if (titleTokens.has(token)) {
      queryMatch += 3;
    } else if (
      descriptionTokens.has(token)
    ) {
      queryMatch += 1;
    }
  }

  const educationalText =
    `${video.title} ${video.description}`.toLowerCase();

  const educationalSignals = [
    "course",
    "tutorial",
    "lecture",
    "lesson",
    "explained",
    "introduction",
    "beginner",
    "full course",
    "crash course",
    "fundamentals",
    "chapter",
  ];

  const educationalBonus =
    educationalSignals.reduce(
      (score, signal) =>
        score +
        (educationalText.includes(signal)
          ? 1
          : 0),
      0
    );

  let durationScore = 0;

  if (
    video.durationSeconds >= 180 &&
    video.durationSeconds <= 3600
  ) {
    durationScore = 2;
  } else if (
    video.durationSeconds > 3600
  ) {
    durationScore = 1;
  }

  const viewSignal =
    video.viewCount > 0
      ? Math.min(
          2,
          Math.log10(
            video.viewCount + 1
          ) / 3
        )
      : 0;

  return (
    queryMatch * 2 +
    educationalBonus +
    durationScore +
    viewSignal
  );
}

function getVideoId(video: any) {
  return (
    video?.id?.videoId ||
    video?.videoId ||
    (typeof video?.id === "string"
      ? video.id
      : "")
  );
}

function getTieredCachedRanking(
  key: string
) {
  const local =
    getCache<CachedRanking>(key);

  if (local) {
    return Promise.resolve(local);
  }

  return getPersistentCache<CachedRanking>(
    key
  ).then((persistent) => {
    if (persistent) {
      console.log(
        `Persistent cache hit: ${key}`
      );

      setCache(key, persistent);
    }

    return persistent;
  });
}

async function setTieredCachedRanking(
  key: string,
  value: CachedRanking
) {
  setCache(key, value);

  await setPersistentCache(
    key,
    value,
    Math.floor(
      RANKING_CACHE_TTL_MS / 1000
    )
  );
}

export async function POST(
  request: Request
) {
  const startTime = Date.now();

  try {
    if (requestBodyTooLarge(request)) {
      return NextResponse.json(
        {
          error:
            "Request is too large.",
        },
        {
          status: 413,
          headers: {
            "Cache-Control":
              "no-store, max-age=0",
          },
        }
      );
    }

    const body = await request.json();

    const query =
      typeof body?.query === "string"
        ? body.query.trim()
        : "";

    const videos = Array.isArray(
      body?.videos
    )
      ? body.videos
      : [];

    if (
      query.length < 2 ||
      query.length > MAX_QUERY_LENGTH
    ) {
      return NextResponse.json(
        {
          error:
            `Learning topics must be between 2 and ${MAX_QUERY_LENGTH} characters.`,
        },
        {
          status: 400,
          headers: {
            "Cache-Control":
              "no-store, max-age=0",
          },
        }
      );
    }

    if (videos.length === 0) {
      return NextResponse.json(
        {
          error: "No videos provided.",
        },
        {
          status: 400,
          headers: {
            "Cache-Control":
              "no-store, max-age=0",
          },
        }
      );
    }

    if (
      videos.length > MAX_INPUT_VIDEOS
    ) {
      return NextResponse.json(
        {
          error:
            `Too many videos supplied. Maximum: ${MAX_INPUT_VIDEOS}.`,
        },
        {
          status: 400,
          headers: {
            "Cache-Control":
              "no-store, max-age=0",
          },
        }
      );
    }

    const cacheKey =
      createCacheKey(query);

    const cached =
      await getTieredCachedRanking(
        cacheKey
      );

    if (
      cached &&
      Date.now() - cached.createdAt <
        RANKING_CACHE_TTL_MS
    ) {
      const restored =
        cached.recommendations
          .map((recommendation) => {
            const originalIndex =
              videos.findIndex(
                (video: any) =>
                  getVideoId(video) ===
                  recommendation.videoId
              );

            if (originalIndex < 0) {
              return null;
            }

            const video =
              videos[originalIndex];

            return {
              index: originalIndex,
              videoId:
                recommendation.videoId,
              title:
                video?.snippet?.title ||
                video?.title ||
                "Untitled video",
              reason:
                recommendation.reason,
            };
          })
          .filter(Boolean);

      if (restored.length > 0) {
        console.log(
          `Video ranking cache hit: ${restored.length} videos restored.`
        );

        console.log(
          `Video ranking time: ${(
            (Date.now() - startTime) /
            1000
          ).toFixed(3)}s`
        );

        return NextResponse.json({
          recommendations: restored,
          cacheHit: true,
        });
      }
    }

    const enriched: VideoInformation[] = [];

    for (let originalIndex = 0; originalIndex < videos.length; originalIndex++) {
      const video = videos[originalIndex];
      const videoId = getVideoId(video);

      if (!videoId) {
        continue;
      }

      const title =
        video?.snippet?.title ||
        video?.title ||
        "Untitled video";

      const description =
        video?.snippet?.description ||
        video?.description ||
        "";

      const channelTitle =
        video?.snippet?.channelTitle ||
        video?.channelTitle ||
        "";

      const durationSeconds = parseDuration(
        video?.contentDetails?.duration ||
          video?.duration ||
          video?.durationSeconds
      );

      // Skip confirmed Shorts / very short videos.
      // A duration of 0 means the API did not provide duration,
      // so keep it rather than discarding a potentially useful video.
      if (
        durationSeconds !== 0 &&
        durationSeconds <= 60
      ) {
        continue;
      }

      const rawViewCount = Number(
        video?.statistics?.viewCount ||
          video?.viewCount ||
          0
      );

      const publishedAt =
        video?.snippet?.publishedAt ||
        video?.publishedAt ||
        "";

      const base: Omit<VideoInformation, "localScore"> = {
        videoId,
        title,
        description,
        channelTitle,
        durationSeconds,
        viewCount: Number.isFinite(rawViewCount)
          ? rawViewCount
          : 0,
        publishedAt,
        originalIndex,
      };

      enriched.push({
        ...base,
        localScore: calculateLocalScore(
          query,
          base
        ),
      });
    }

    if (enriched.length === 0) {
      return NextResponse.json(
        {
          error:
            "No suitable non-short videos were found.",
        },
        {
          status: 400,
        }
      );
    }

    const shortlist = [...enriched]
      .sort(
        (a, b) =>
          b.localScore - a.localScore
      )
      .slice(
        0,
        MAX_MODEL_CANDIDATES
      );

    console.log(
      `Video ranking: ${enriched.length} candidates → ${shortlist.length} model candidates.`
    );

    console.log(
      "Ranking videos educationally..."
    );

    const compactCandidates =
      shortlist.map((video) => ({
        videoId: video.videoId,
        title: video.title,
        channelTitle:
          video.channelTitle,
        durationSeconds:
          video.durationSeconds,
        description:
          video.description.slice(
            0,
            350
          ),
      }));

    const response =
      await openai.chat.completions.create(
        {
          model: "gpt-4.1-mini",
          response_format: {
            type: "json_object",
          },
          messages: [
            {
              role: "system",
              content: `
You rank educational YouTube videos for Spaghetti AI.

The learner's topic and a shortlist of candidate videos are supplied.

Choose the videos that together create the strongest source corpus for building a structured learning path.

Rules:

- Prefer genuinely educational videos.
- Prefer clear explanations over entertainment.
- Prefer complementary coverage rather than six nearly identical videos.
- Include foundational and deeper material when useful.
- Avoid Shorts, trailers, reaction videos, and obvious low-value content.
- Select exactly 6 DISTINCT videos when at least 6 suitable candidates exist.
- If fewer than 6 suitable candidates exist, select every suitable candidate.
- Use ONLY the supplied videoId values.
- Never invent a videoId.
- Keep each reason concise.

Return ONLY valid JSON:

{
  "recommendations": [
    {
      "videoId": "VIDEO_ID",
      "reason": "Why this video adds useful educational coverage."
    }
  ]
}
`,
            },
            {
              role: "user",
              content: JSON.stringify({
                query,
                videos:
                  compactCandidates,
              }),
            },
          ],
        }
      );

    const raw =
      response.choices[0]?.message
        ?.content || "{}";

    let parsed: any;

    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {
        recommendations: [],
      };
    }

    const validIds = new Set(
      shortlist.map(
        (video) => video.videoId
      )
    );

    const seenIds = new Set<string>();

    const chosen: CachedRecommendation[] =
      [];

    if (
      Array.isArray(
        parsed?.recommendations
      )
    ) {
      for (const item of
        parsed.recommendations) {
        const videoId =
          typeof item?.videoId ===
          "string"
            ? item.videoId.trim()
            : "";

        if (
          !videoId ||
          !validIds.has(videoId) ||
          seenIds.has(videoId)
        ) {
          continue;
        }

        seenIds.add(videoId);

        chosen.push({
          videoId,
          reason:
            typeof item?.reason ===
            "string"
              ? item.reason.trim()
              : "Strong educational resource for this learning path.",
        });

        if (
          chosen.length >=
          TARGET_VIDEO_COUNT
        ) {
          break;
        }
      }
    }

    const minimumWanted = Math.min(
      TARGET_VIDEO_COUNT,
      shortlist.length
    );

    if (
      chosen.length < minimumWanted
    ) {
      for (const video of shortlist) {
        if (
          seenIds.has(video.videoId)
        ) {
          continue;
        }

        seenIds.add(video.videoId);

        chosen.push({
          videoId: video.videoId,
          reason:
            "High-ranking educational source that adds useful topic coverage.",
        });

        if (
          chosen.length >=
          minimumWanted
        ) {
          break;
        }
      }
    }

    const recommendations =
      chosen.map(
        (recommendation) => {
          const candidate =
            shortlist.find(
              (video) =>
                video.videoId ===
                recommendation.videoId
            )!;

          return {
            index:
              candidate.originalIndex,
            videoId:
              recommendation.videoId,
            title: candidate.title,
            reason:
              recommendation.reason,
          };
        }
      );

    const cacheValue: CachedRanking = {
      createdAt: Date.now(),
      recommendations: chosen,
    };

    await setTieredCachedRanking(
      cacheKey,
      cacheValue
    );

    console.log(
      `Video ranking completed: ${recommendations.length} videos selected.`
    );

    console.log(
      `Video ranking time: ${(
        (Date.now() - startTime) /
        1000
      ).toFixed(3)}s`
    );

    console.log(
      "Video ranking cached."
    );

    return NextResponse.json({
      recommendations,
      cacheHit: false,
    });
  } catch (error: any) {
    console.error(
      "Video ranking error:",
      error
    );

    const publicMessage =
      process.env.NODE_ENV ===
        "development" &&
      error instanceof Error
        ? error.message
        : "Failed to rank videos.";

    return NextResponse.json(
      {
        error: publicMessage,
      },
      {
        status: 500,
        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      }
    );
  }
}

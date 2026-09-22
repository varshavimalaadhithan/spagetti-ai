import {
  YouTubeTranscriptApi,
} from "@hallelx/youtube-transcript";

export type TranscriptSegment = {
  text: string;
  offset: number;
  duration: number;
};

export type VideoTranscript = {
  videoId: string;
  title: string;
  segments: TranscriptSegment[];
};

type SupadataSegment = {
  text?: unknown;
  offset?: unknown;
  duration?: unknown;
};

type SupadataResponse = {
  content?: SupadataSegment[];
};

async function fetchDirectTranscript(
  videoId: string
): Promise<TranscriptSegment[]> {
  const api =
    new YouTubeTranscriptApi();

  const transcript =
    await api.fetch(videoId, {
      languages: ["en"],
    });

  const rawSegments =
    transcript.toRawData();

  const segments = rawSegments
    .filter(
      (item) =>
        typeof item.text === "string" &&
        item.text.trim().length > 0 &&
        Number.isFinite(
          Number(item.start)
        )
    )
    .map((item) => ({
      text: item.text.trim(),
      offset: Number(item.start),
      duration:
        Number.isFinite(
          Number(item.duration)
        )
          ? Math.max(
              0,
              Number(item.duration)
            )
          : 0,
    }));

  if (!segments.length) {
    throw new Error(
      "Direct transcript returned no usable segments."
    );
  }

  return segments;
}

async function fetchSupadataTranscript(
  videoId: string
): Promise<TranscriptSegment[]> {
  const apiKey =
    process.env.SUPADATA_API_KEY;

  if (!apiKey) {
    throw new Error(
      "SUPADATA_API_KEY is missing."
    );
  }

  const videoUrl =
    `https://www.youtube.com/watch?v=${videoId}`;

  const url =
    new URL(
      "https://api.supadata.ai/v1/transcript"
    );

  url.searchParams.set(
    "url",
    videoUrl
  );

  url.searchParams.set(
    "lang",
    "en"
  );

  const response =
    await fetch(url.toString(), {
      headers: {
        "x-api-key": apiKey,
      },
      cache: "no-store",
    });

  if (!response.ok) {
    const message =
      await response.text();

    throw new Error(
      `Supadata transcript failed (${response.status}): ${message}`
    );
  }

  const data =
    (await response.json()) as
      SupadataResponse;

  if (!Array.isArray(data.content)) {
    throw new Error(
      "Supadata returned no transcript segments."
    );
  }

  /*
   * Supadata timestamps are milliseconds.
   * Spaghetti's chunking code expects seconds.
   */
  const segments =
    data.content
      .filter(
        (item) =>
          typeof item.text ===
            "string" &&
          item.text.trim().length > 0 &&
          Number.isFinite(
            Number(item.offset)
          )
      )
      .map((item) => ({
        text:
          String(item.text).trim(),

        offset:
          Number(item.offset) /
          1000,

        duration:
          Number.isFinite(
            Number(item.duration)
          )
            ? Math.max(
                0,
                Number(
                  item.duration
                ) / 1000
              )
            : 0,
      }));

  if (!segments.length) {
    throw new Error(
      "Supadata transcript contained no usable text."
    );
  }

  return segments;
}

export async function getTranscript(
  videoId: string,
  title: string
): Promise<VideoTranscript> {
  try {
    const segments =
      await fetchDirectTranscript(
        videoId
      );

    return {
      videoId,
      title,
      segments,
    };
  } catch (directError) {
    console.warn(
      `Direct YouTube transcript failed for ${videoId}. Trying hosted fallback.`,
      directError
    );
  }

  const segments =
    await fetchSupadataTranscript(
      videoId
    );

  return {
    videoId,
    title,
    segments,
  };
}
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

function createTranscriptApi() {
  /*
   * Localhost:
   * Use the normal internet connection.
   *
   * Vercel:
   * YouTube often blocks datacenter IPs, so route
   * transcript-related requests through a free relay.
   *
   * This is appropriate for a small portfolio/tester
   * deployment, but it is not guaranteed production
   * infrastructure.
   */
  if (process.env.VERCEL === "1") {
    return new YouTubeTranscriptApi({
      fetchFn: async (
        url,
        init
      ) => {
        const targetUrl =
          url.toString();

        const proxyUrl =
          `https://api.corsproxy.io/?url=${encodeURIComponent(
            targetUrl
          )}`;

        console.log(
          "Routing YouTube transcript request through relay."
        );

        return fetch(
          proxyUrl,
          {
            ...init,
            cache: "no-store",
          }
        );
      },
    });
  }

  return new YouTubeTranscriptApi();
}

export async function getTranscript(
  videoId: string,
  title: string
): Promise<VideoTranscript> {
  const api =
    createTranscriptApi();

  const transcript =
    await api.fetch(
      videoId,
      {
        languages: ["en"],
      }
    );

  const rawSegments =
    transcript.toRawData();

  if (
    !Array.isArray(
      rawSegments
    ) ||
    rawSegments.length === 0
  ) {
    throw new Error(
      `No transcript segments found for video ${videoId}`
    );
  }

  const segments: TranscriptSegment[] =
    rawSegments
      .filter(
        (item) =>
          typeof item.text ===
            "string" &&
          item.text.trim().length >
            0 &&
          Number.isFinite(
            Number(item.start)
          )
      )
      .map(
        (item) => ({
          text:
            item.text.trim(),

          /*
           * The new library returns seconds.
           * chunks.ts also expects seconds.
           */
          offset:
            Number(
              item.start
            ),

          duration:
            Number.isFinite(
              Number(
                item.duration
              )
            )
              ? Math.max(
                  0,
                  Number(
                    item.duration
                  )
                )
              : 0,
        })
      );

  if (
    segments.length === 0
  ) {
    throw new Error(
      `Transcript contained no usable text for video ${videoId}`
    );
  }

  return {
    videoId,
    title,
    segments,
  };
}
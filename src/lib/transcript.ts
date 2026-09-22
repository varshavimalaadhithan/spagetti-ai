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
  return new YouTubeTranscriptApi({
    /*
     * Vercel's datacenter IP can be blocked by YouTube.
     *
     * The library first tries normally.
     * If only the final transcript download is blocked,
     * this fallback sends that signed transcript URL
     * through a free public CORS relay.
     */
    transcriptFetchFallback:
      async (
        signedUrl,
        videoId
      ) => {
        try {
          console.log(
            `Using transcript fallback for ${videoId}`
          );

          const proxyUrl =
            `https://api.corsproxy.io/?url=${encodeURIComponent(
              String(signedUrl)
            )}`;

          const response =
            await fetch(proxyUrl, {
              method: "GET",

              headers: {
                Accept:
                  "text/xml,text/plain,*/*",
              },

              cache:
                "no-store",
            });

          if (!response.ok) {
            console.warn(
              `Transcript fallback failed for ${videoId}: ${response.status}`
            );

            return null;
          }

          return response;
        } catch (error) {
          console.error(
            `Transcript fallback error for ${videoId}:`,
            error
          );

          return null;
        }
      },
  });
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

  const segments =
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
            item.text
              .trim(),

          /*
           * New library returns seconds.
           * chunks.ts now also expects seconds.
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
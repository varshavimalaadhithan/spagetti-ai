import {
  WebshareProxyConfig,
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
  const proxyUsername =
    process.env.WEBSHARE_PROXY_USERNAME?.trim();

  const proxyPassword =
    process.env.WEBSHARE_PROXY_PASSWORD?.trim();

  /*
   * Catch an incomplete configuration instead
   * of silently making direct YouTube requests.
   */
  if (
    (proxyUsername && !proxyPassword) ||
    (!proxyUsername && proxyPassword)
  ) {
    throw new Error(
      "Webshare proxy configuration is incomplete. " +
        "Both WEBSHARE_PROXY_USERNAME and " +
        "WEBSHARE_PROXY_PASSWORD are required."
    );
  }

  /*
   * When Webshare credentials exist, route
   * YouTube transcript traffic through the
   * rotating residential proxy network.
   *
   * Without credentials, local development
   * can still use the normal residential
   * internet connection directly.
   */
  if (
    proxyUsername &&
    proxyPassword
  ) {
    console.log(
      "Transcript transport: Webshare residential proxy"
    );

    return new YouTubeTranscriptApi({
      proxyConfig:
        new WebshareProxyConfig({
          proxyUsername,
          proxyPassword,
        }),
    });
  }

  console.log(
    "Transcript transport: direct connection"
  );

  return new YouTubeTranscriptApi();
}

export async function getTranscript(
  videoId: string,
  title: string
): Promise<VideoTranscript> {
  const api =
    createTranscriptApi();

  const transcript =
    await api.fetch(videoId, {
      languages: ["en"],
    });

  const rawSegments =
    transcript.toRawData();

  if (
    !Array.isArray(rawSegments) ||
    rawSegments.length === 0
  ) {
    throw new Error(
      `No transcript segments found for video ${videoId}`
    );
  }

  /*
   * @hallelx/youtube-transcript returns
   * start and duration in SECONDS.
   */
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
      .map((item) => ({
        text:
          item.text.trim(),

        offset:
          Number(item.start),

        duration:
          Number.isFinite(
            Number(item.duration)
          )
            ? Math.max(
                0,
                Number(
                  item.duration
                )
              )
            : 0,
      }));

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
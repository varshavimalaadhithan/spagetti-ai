import { YoutubeTranscript } from "youtube-transcript";

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

export async function getTranscript(
  videoId: string,
  title: string
): Promise<VideoTranscript> {
  const transcript =
    await YoutubeTranscript.fetchTranscript(
      videoId
    );

  return {
    videoId,
    title,

    segments: transcript.map((item: any) => ({
      text: item.text,
      offset: item.offset,
      duration: item.duration || 0,
    })),
  };
}
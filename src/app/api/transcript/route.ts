import { NextResponse } from "next/server";
import { YoutubeTranscript } from "youtube-transcript";

export async function POST(request: Request) {
  try {
    const { videoId } = await request.json();

    if (!videoId) {
      return NextResponse.json(
        { error: "No video ID provided" },
        { status: 400 }
      );
    }

    const transcript =
      await YoutubeTranscript.fetchTranscript(videoId);

    return NextResponse.json({
      videoId,
      transcript,
    });

  } catch (error: any) {
    return NextResponse.json(
      {
        error: error.message,
      },
      {
        status: 500,
      }
    );
  }
}
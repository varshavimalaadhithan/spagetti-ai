import { NextResponse } from "next/server";
import { getTranscript } from "@/lib/transcript";

export async function POST(request: Request) {
  try {
    const { videoId } = await request.json();

    if (!videoId) {
      return NextResponse.json(
        { error: "No video ID provided" },
        { status: 400 }
      );
    }

    const transcriptResult =
  await getTranscript(
    videoId,
    videoId
  );

const transcript =
  transcriptResult.segments;

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
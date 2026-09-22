import { NextResponse } from "next/server";
import { getTranscript } from "@/lib/transcript";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const videoId = searchParams.get("videoId");

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

    const timestamps = transcript
      .filter((_, index) => index % 10 === 0)
      .map((item) => ({
        time: formatTime(item.offset),
        text: item.text,
      }));

    return NextResponse.json({
      videoId,
      timestamps,
    });

  } catch (error: any) {
    console.log("TRANSCRIPT ERROR:", error.message);

    return NextResponse.json(
      {
        error: error.message,
      },
      { status: 500 }
    );
  }
}

function formatTime(milliseconds: number) {
  const totalSeconds = Math.floor(milliseconds / 1000);

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds
    .toString()
    .padStart(2, "0")}`;
}
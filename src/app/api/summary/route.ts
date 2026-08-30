import { NextResponse } from "next/server";
import { YoutubeTranscript } from "youtube-transcript";
import { openai } from "@/lib/openai";

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

    const transcript = await YoutubeTranscript.fetchTranscript(videoId);

    const text = transcript
      .map((item) => item.text)
      .join(" ");

    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an AI tutor that explains educational videos clearly.",
        },
        {
          role: "user",
          content: `
Analyze this YouTube transcript.

Give:
1. A beginner-friendly explanation
2. The main concepts
3. Important takeaways

Transcript:
${text}
`,
        },
      ],
    });

    return NextResponse.json({
      summary: aiResponse.choices[0].message.content,
    });

  } catch (error: any) {
    console.log("ERROR:", error.message);

    return NextResponse.json(
      {
        error: error.message,
      },
      { status: 500 }
    );
  }
}
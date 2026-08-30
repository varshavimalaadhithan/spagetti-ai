import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";

export async function GET() {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "user",
          content:
            "Create a 3 step learning path for learning calculus. Return only JSON.",
        },
      ],
    });

    return NextResponse.json({
      result: response.choices[0].message.content,
    });

  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
    });
  }
}
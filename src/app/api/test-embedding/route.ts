import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";

export async function GET() {
  try {
    const response =
      await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: "Spaghetti AI test",
      });

    return NextResponse.json({
      success: true,
      model: response.model,
      dimensions:
        response.data[0].embedding.length,
    });

  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        status: error.status,
        code: error.code,
        message: error.message,
      },
      {
        status: 500,
      }
    );
  }
}
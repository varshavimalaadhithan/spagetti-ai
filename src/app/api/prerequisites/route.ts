import { NextRequest, NextResponse } from "next/server";
import { openai } from "@/lib/openai";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const concepts = body?.concepts;

    if (!Array.isArray(concepts) || concepts.length === 0) {
      return NextResponse.json(
        { error: "Concepts are required." },
        { status: 400 }
      );
    }

    const prompt = `
You are designing a rigorous learning curriculum.

Given the concepts below, determine the prerequisite relationships between them.

A prerequisite means:

"Concept A should be understood before Concept B."

Do NOT invent unnecessary concepts.

Return ONLY valid JSON.

Required format:

{
  "relationships": [
    {
      "prerequisite": "concept id",
      "concept": "concept id",
      "reason": "short explanation"
    }
  ],
  "orderedConceptIds": [
    "concept id 1",
    "concept id 2"
  ]
}

Rules:

1. Every ID must exactly match an ID from the input.
2. Do not create IDs.
3. Do not include self-dependencies.
4. Avoid circular dependencies.
5. Put foundational concepts before advanced concepts.
6. If two concepts are independent, do not force a relationship.
7. The orderedConceptIds list should represent the strongest overall learning order.

Concepts:

${JSON.stringify(concepts, null, 2)}
`;

    const response = await openai.responses.create({
      // IMPORTANT:
      // Use the SAME MODEL that already works
      // in your existing rank-videos / learning-path route.
      model: "gpt-4.1-mini",
      input: prompt,
    });

    const text = response.output_text;

    if (!text) {
      throw new Error("AI returned an empty response.");
    }

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      console.error("Invalid AI JSON:", text);

      return NextResponse.json(
        {
          error: "AI returned invalid JSON.",
          raw: text,
        },
        { status: 500 }
      );
    }

    if (!Array.isArray(data.relationships)) {
      data.relationships = [];
    }

    if (!Array.isArray(data.orderedConceptIds)) {
      data.orderedConceptIds = [];
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Prerequisite generation error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate prerequisites.",
      },
      { status: 500 }
    );
  }
}
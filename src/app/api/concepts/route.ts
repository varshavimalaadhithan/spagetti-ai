import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type Concept = {
  id: string;
  title: string;
  description: string;
  goal: string;
  difficulty: "FOUNDATION" | "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  order: number;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const query =
      typeof body.query === "string"
        ? body.query.trim()
        : "";

    if (!query) {
      return NextResponse.json(
        { error: "A learning topic is required." },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured." },
        { status: 500 }
      );
    }

    const prompt = `
You are the curriculum-planning intelligence inside Spaghetti AI.

Spaghetti AI turns fragmented educational videos into structured learning paths.

The user wants to learn:

"${query}"

Your job is to decompose this topic into the concepts a learner should understand.

IMPORTANT:

1. Start with foundational concepts.
2. Move toward more advanced concepts.
3. Do not simply list textbook chapter titles.
4. Each concept must represent something meaningfully learnable.
5. Avoid unnecessary repetition.
6. Include important intermediate concepts.
7. Include practical examples or applications when they are genuinely useful.
8. Do not assume the learner already understands advanced terminology.
9. The sequence should make sense for deep understanding.
10. Prefer approximately 5–10 concepts depending on the complexity of the topic.

Return ONLY valid JSON.

Use exactly this structure:

{
  "topic": "${query}",
  "concepts": [
    {
      "id": "concept-1",
      "title": "Concept name",
      "description": "What this concept means and why it matters.",
      "goal": "What the learner should be able to understand after learning it.",
      "difficulty": "FOUNDATION",
      "order": 1
    }
  ]
}

Allowed difficulty values:

FOUNDATION
BEGINNER
INTERMEDIATE
ADVANCED

Make sure:

- order starts at 1
- every id is unique
- concepts are ordered from prerequisite knowledge toward advanced understanding
- JSON contains no markdown
- JSON contains no explanation outside the JSON object
`;

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: prompt,
    });

    const text = response.output_text?.trim();

    if (!text) {
      throw new Error(
        "The AI returned an empty response."
      );
    }

    let data: any;

    try {
      data = JSON.parse(text);
    } catch {
      console.error(
        "Invalid AI JSON:",
        text
      );

      throw new Error(
        "The AI returned invalid concept data."
      );
    }

    if (
      !data ||
      !Array.isArray(data.concepts)
    ) {
      throw new Error(
        "The AI did not return a valid concept list."
      );
    }

    const concepts: Concept[] =
      data.concepts
        .map(
          (concept: any, index: number) => ({
            id:
              typeof concept.id === "string" &&
              concept.id.trim()
                ? concept.id.trim()
                : `concept-${index + 1}`,

            title:
              typeof concept.title === "string"
                ? concept.title.trim()
                : `Concept ${index + 1}`,

            description:
              typeof concept.description === "string"
                ? concept.description.trim()
                : "",

            goal:
              typeof concept.goal === "string"
                ? concept.goal.trim()
                : "",

            difficulty:
              [
                "FOUNDATION",
                "BEGINNER",
                "INTERMEDIATE",
                "ADVANCED",
              ].includes(
                concept.difficulty
              )
                ? concept.difficulty
                : "BEGINNER",

            order:
              Number.isFinite(
                Number(concept.order)
              )
                ? Number(concept.order)
                : index + 1,
          })
        )
        .filter(
          (concept: Concept) =>
            concept.title.length > 0
        )
        .sort(
          (a: Concept, b: Concept) =>
            a.order - b.order
        );

    if (concepts.length === 0) {
      throw new Error(
        "No concepts were generated."
      );
    }

    return NextResponse.json({
      topic: query,
      concepts,
    });

  } catch (error) {
    console.error(
      "Concept decomposition error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to decompose the topic.",
      },
      { status: 500 }
    );
  }
}
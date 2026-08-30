import { NextResponse } from "next/server";
import { analyzeSegments } from "@/lib/segmentAnalysis";

type Segment = {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
};

type Concept = {
  id: string;
  title: string;
  goal: string;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const segments = body.segments as Segment[];
    const concepts = body.concepts as Concept[];

    /*
     * Validate segments
     */

    if (!Array.isArray(segments) || segments.length === 0) {
      return NextResponse.json(
        {
          error: "No transcript segments provided.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Validate concepts
     */

    if (!Array.isArray(concepts) || concepts.length === 0) {
      return NextResponse.json(
        {
          error: "No learning concepts provided.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Make sure every segment has the
     * information the AI needs.
     */

    const validSegments = segments
      .filter((segment) => {
        return (
          segment &&
          typeof segment.id === "string" &&
          typeof segment.text === "string" &&
          segment.text.trim().length > 0 &&
          typeof segment.startTime === "number" &&
          typeof segment.endTime === "number"
        );
      })
      .map((segment) => ({
        id: String(segment.id),
        text: segment.text.trim(),
        startTime: segment.startTime,
        endTime: segment.endTime,
      }));

    if (validSegments.length === 0) {
      return NextResponse.json(
        {
          error: "No valid transcript segments were provided.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Make sure every concept has
     * the information the AI needs.
     */

    const validConcepts = concepts
      .filter((concept) => {
        return (
          concept &&
          typeof concept.id === "string" &&
          typeof concept.title === "string" &&
          typeof concept.goal === "string"
        );
      })
      .map((concept) => ({
        id: String(concept.id),
        title: concept.title.trim(),
        goal: concept.goal.trim(),
      }));

    if (validConcepts.length === 0) {
      return NextResponse.json(
        {
          error: "No valid learning concepts were provided.",
        },
        {
          status: 400,
        }
      );
    }

    console.log(
      `Analyzing ${validSegments.length} transcript segments...`
    );

    console.log(
      `Comparing against ${validConcepts.length} concepts...`
    );

    /*
     * Send the segments to the educational
     * segment-analysis engine.
     */

    const analysis = await analyzeSegments(
      validSegments,
      validConcepts
    );

    console.log(
      `Successfully analyzed ${analysis.length} segments.`
    );

    /*
     * Return the analyzed segments.
     */

    return NextResponse.json({
      status: "success",

      analyzedSegments: analysis.length,

      totalSegments: validSegments.length,

      concepts: validConcepts,

      segments: analysis,
    });
  } catch (error: any) {
    console.error(
      "Segment analysis error:",
      error
    );

    return NextResponse.json(
      {
        status: "error",

        error:
          error?.message ||
          "Failed to analyze transcript segments.",
      },
      {
        status: 500,
      }
    );
  }
}
import { NextResponse } from "next/server";
import { getTrialStatus } from "@/lib/trial";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request
) {
  const trial =
    await getTrialStatus(
      request
    );

  return NextResponse.json(
    {
      trial,
    },
    {
      headers: {
        "Cache-Control":
          "no-store, max-age=0",
      },
    }
  );
}

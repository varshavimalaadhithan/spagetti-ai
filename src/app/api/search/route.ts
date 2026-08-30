import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } =
      new URL(request.url);

    const query =
      searchParams.get("query");

    if (!query?.trim()) {
      return NextResponse.json(
        {
          error: "No query provided",
        },
        {
          status: 400,
        }
      );
    }

    const searchResponse =
      await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=20&q=${encodeURIComponent(
          query
        )}&key=${process.env.YOUTUBE_API_KEY}`
      );

    if (!searchResponse.ok) {
      const errorData =
        await searchResponse.json();

      return NextResponse.json(
        {
          error:
            errorData.error?.message ||
            "YouTube search failed",
        },
        {
          status:
            searchResponse.status,
        }
      );
    }

    const searchData =
      await searchResponse.json();

    const items =
      searchData.items || [];

    /*
     * Get detailed metadata for the
     * candidate videos.
     *
     * This lets us make better decisions
     * about video quality later.
     */

    const videoIds =
      items
        .map(
          (item: any) =>
            item.id?.videoId
        )
        .filter(Boolean)
        .join(",");

    if (!videoIds) {
      return NextResponse.json([]);
    }

    const detailsResponse =
      await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics,snippet&id=${videoIds}&key=${process.env.YOUTUBE_API_KEY}`
      );

    if (!detailsResponse.ok) {
      /*
       * If metadata lookup fails,
       * still return the original results.
       */

      return NextResponse.json(
        items
      );
    }

    const detailsData =
      await detailsResponse.json();

    const detailsMap = new Map<string, any>(
      detailsData.items.map(
        (video: any) => [
            video.id,
            video,
        ]
    )
    );

    /*
     * Combine search information with
     * detailed video information.
     */

    const enrichedVideos =
      items.map((item: any) => {
        const videoId =
          item.id?.videoId;

        const details =
          detailsMap.get(videoId);

        return {
          ...item,

          videoDetails: {
            duration:
              details?.contentDetails
                ?.duration || null,

            views:
              details?.statistics
                ?.viewCount || null,

            likes:
              details?.statistics
                ?.likeCount || null,

            publishedAt:
              details?.snippet
                ?.publishedAt || null,
          },
        };
      });

    return NextResponse.json(
      enrichedVideos
    );

  } catch (error: any) {
    console.error(
      "Search error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message,
      },
      {
        status: 500,
      }
    );
  }
}
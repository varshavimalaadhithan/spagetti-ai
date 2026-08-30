"use client";

import {
  useEffect,
  useState,
} from "react";

type Resource = {
  videoId?: string;
  chunkId?: string;
  startTime?: number;
  endTime?: number;
  takeaway?: string;
  reason?: string;
  text?: string;
  url?: string;
};

type LearningSection = {
  id?: string;
  title?: string;
  concept?: string;
  goal?: string;
  explanation?: string;
  resources?: Resource[];
};

type LearningPathData = {
  title?: string;
  query?: string;
  learningPath?: LearningSection[];
  videosProcessed?: number;
  totalChunks?: number;
  processingTime?: number;
};

export default function LearningPath() {
  const [path, setPath] =
    useState<LearningPathData | null>(
      null
    );

  const [error, setError] =
    useState("");

  useEffect(() => {
    try {
      const saved =
        localStorage.getItem(
          "learningPath"
        );

      if (!saved) {
        setError(
          "No learning path found."
        );

        return;
      }

      const parsed =
        JSON.parse(saved);

      setPath(parsed);
    } catch (err) {
      console.error(
        "Could not load learning path:",
        err
      );

      setError(
        "Could not load learning path."
      );
    }
  }, []);

  if (error) {
    return (
      <main className="min-h-screen bg-[#090909] px-6 py-12 text-white">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center">
            <div className="mb-4 text-4xl">
              🍝
            </div>

            <h1 className="text-2xl font-bold">
              Something went wrong
            </h1>

            <p className="mt-3 text-zinc-400">
              {error}
            </p>

            <a
              href="/"
              className="mt-6 inline-flex rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
            >
              Back home
            </a>
          </div>
        </div>
      </main>
    );
  }

  if (!path) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#090909] text-white">
        <div className="text-center">
          <div className="mb-4 text-5xl">
            🍝
          </div>

          <p className="text-zinc-400">
            Loading your learning path...
          </p>
        </div>
      </main>
    );
  }

  const sections =
    Array.isArray(
      path.learningPath
    )
      ? path.learningPath
      : [];

  return (
    <main className="min-h-screen bg-[#090909] px-5 py-10 text-white md:px-8 md:py-14">
      <div className="mx-auto max-w-5xl">

        {/* HEADER */}

        <header className="mb-14">
          <div className="mb-8 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-600 text-xl">
                🍝
              </div>

              <span className="font-bold tracking-wide text-red-500">
                SPAGHETTI AI
              </span>
            </div>

            <a
              href="/"
              className="rounded-lg border border-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-900"
            >
              New path
            </a>
          </div>

          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-red-500">
            Your learning route
          </p>

          <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
            {path.query ||
              path.title ||
              "Learning Path"}
          </h1>

          <p className="mt-4 max-w-xl text-zinc-400">
            Watch the important parts.
            Skip the searching.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Stat
              value={sections.length}
              label="concepts"
            />

            {typeof path.videosProcessed ===
              "number" && (
              <Stat
                value={
                  path.videosProcessed
                }
                label="videos analyzed"
              />
            )}
          </div>

          <div className="mt-8 h-px bg-gradient-to-r from-red-600 via-zinc-800 to-transparent" />
        </header>

        {/* TIMELINE */}

        <div className="relative">
          <div className="absolute bottom-10 left-[19px] top-6 w-px bg-gradient-to-b from-red-600 via-red-900 to-zinc-900 md:left-[27px]" />

          <div className="space-y-9">
            {sections.map(
              (
                section,
                index
              ) => {
                const resources =
                  Array.isArray(
                    section.resources
                  )
                    ? section.resources
                    : [];

                return (
                  <section
                    key={
                      section.id ||
                      index
                    }
                    className="relative pl-14 md:pl-20"
                  >

                    {/* NUMBER */}

                    <div className="absolute left-0 top-1 z-10 flex h-10 w-10 items-center justify-center rounded-full border-4 border-[#090909] bg-red-600 text-sm font-bold md:h-14 md:w-14">
                      {index + 1}
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">

                      {/* TITLE */}

                      <div className="p-6 md:p-8">
                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-red-500">
                          Concept{" "}
                          {index + 1}
                        </span>

                        <h2 className="mt-2 text-2xl font-bold md:text-3xl">
                          {section.title ||
                            section.concept ||
                            "Learning Concept"}
                        </h2>

                        {/* SHORT GOAL */}

                        {section.goal && (
                          <div className="mt-5 rounded-xl border border-zinc-800 bg-[#0c0c0c] px-4 py-3">
                            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-600">
                              🎯 Your goal
                            </p>

                            <p className="mt-1 text-sm leading-6 text-zinc-300">
                              {
                                section.goal
                              }
                            </p>
                          </div>
                        )}

                        {/* VIDEO CLIPS */}

                        <div className="mt-7 space-y-4">
                          {resources.length >
                          0 ? (
                            resources.map(
                              (
                                resource,
                                resourceIndex
                              ) => {
                                const startTime =
                                  Number(
                                    resource.startTime
                                  ) ||
                                  0;

                                const endTime =
                                  Number(
                                    resource.endTime
                                  ) ||
                                  0;

                                const duration =
                                  Math.max(
                                    0,
                                    endTime -
                                      startTime
                                  );

                                const videoId =
                                  resource.videoId;

                                const youtubeUrl =
                                  resource.url ||
                                  (videoId
                                    ? `https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(
                                        startTime
                                      )}s`
                                    : "#");

                                return (
                                  <article
                                    key={
                                      resource.chunkId ||
                                      resourceIndex
                                    }
                                    className="rounded-xl border border-zinc-800 bg-zinc-950 p-5 md:p-6"
                                  >

                                    {/* TIME */}

                                    <div className="flex flex-wrap items-center gap-3">
                                      <span className="rounded-md bg-red-600/10 px-2.5 py-1 font-mono text-sm font-bold text-red-500">
                                        {formatTime(
                                          startTime
                                        )}
                                      </span>

                                      <span className="text-zinc-700">
                                        →
                                      </span>

                                      <span className="font-mono text-sm text-zinc-400">
                                        {formatTime(
                                          endTime
                                        )}
                                      </span>

                                      {duration >
                                        0 && (
                                        <span className="text-xs text-zinc-600">
                                          •{" "}
                                          {formatDuration(
                                            duration
                                          )}
                                        </span>
                                      )}
                                    </div>

                                    {/* MAIN TAKEAWAY */}

                                    <div className="mt-5">
                                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-500">
                                        This clip teaches
                                      </p>

                                      <p className="mt-2 text-lg font-semibold leading-7 text-white">
                                        {resource.takeaway ||
                                          resource.reason ||
                                          "Watch this segment for the key explanation."}
                                      </p>
                                    </div>

                                    {/* BUTTON */}

                                    {videoId && (
                                      <a
                                        href={
                                          youtubeUrl
                                        }
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-700 md:w-auto"
                                      >
                                        ▶ Watch this
                                        segment
                                      </a>
                                    )}

                                    {/* OPTIONAL DETAILS */}

                                    {(resource.reason ||
                                      section.explanation) && (
                                      <details className="mt-5 border-t border-zinc-800 pt-4">
                                        <summary className="cursor-pointer text-sm text-zinc-500 hover:text-zinc-300">
                                          More details
                                        </summary>

                                        <div className="mt-3 space-y-3 text-sm leading-6 text-zinc-500">
                                          {resource.reason && (
                                            <p>
                                              <span className="font-semibold text-zinc-400">
                                                Why
                                                this
                                                clip:{" "}
                                              </span>

                                              {
                                                resource.reason
                                              }
                                            </p>
                                          )}

                                          {section.explanation && (
                                            <p>
                                              <span className="font-semibold text-zinc-400">
                                                Why
                                                this
                                                concept
                                                matters:{" "}
                                              </span>

                                              {
                                                section.explanation
                                              }
                                            </p>
                                          )}
                                        </div>
                                      </details>
                                    )}
                                  </article>
                                );
                              }
                            )
                          ) : (
                            <div className="rounded-xl border border-dashed border-zinc-800 p-5 text-sm text-zinc-500">
                              No strong
                              segment was
                              found for
                              this concept.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </section>
                );
              }
            )}
          </div>
        </div>

        {/* END */}

        {sections.length > 0 && (
          <div className="mt-14 rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center">
            <div className="text-3xl">
              🍝
            </div>

            <h2 className="mt-3 text-xl font-bold">
              Path complete
            </h2>

            <p className="mt-2 text-sm text-zinc-500">
              That&apos;s the route.
              No 47-tab YouTube expedition
              required.
            </p>

            <a
              href="/"
              className="mt-6 inline-flex rounded-lg border border-zinc-700 px-5 py-2.5 text-sm font-semibold text-zinc-300 hover:bg-zinc-800"
            >
              Build another path
            </a>
          </div>
        )}
      </div>
    </main>
  );
}

function Stat({
  value,
  label,
}: {
  value: string | number;
  label: string;
}) {
  return (
    <div className="rounded-full border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm">
      <span className="font-semibold">
        {value}
      </span>

      <span className="ml-2 text-zinc-500">
        {label}
      </span>
    </div>
  );
}

function formatTime(
  seconds: number
) {
  const total =
    Math.max(
      0,
      Math.floor(seconds)
    );

  const hours =
    Math.floor(total / 3600);

  const minutes =
    Math.floor(
      (total % 3600) / 60
    );

  const remaining =
    total % 60;

  if (hours > 0) {
    return `${hours}:${String(
      minutes
    ).padStart(
      2,
      "0"
    )}:${String(
      remaining
    ).padStart(
      2,
      "0"
    )}`;
  }

  return `${minutes}:${String(
    remaining
  ).padStart(
    2,
    "0"
  )}`;
}

function formatDuration(
  seconds: number
) {
  const rounded =
    Math.max(
      0,
      Math.round(seconds)
    );

  if (rounded < 60) {
    return `${rounded}s`;
  }

  const minutes =
    Math.floor(
      rounded / 60
    );

  const remaining =
    rounded % 60;

  return remaining > 0
    ? `${minutes}m ${remaining}s`
    : `${minutes}m`;
}
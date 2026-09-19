"use client";

import { useEffect, useState } from "react";

export default function LearningPath() {
  const [path, setPath] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("learningPath");

      if (!saved) {
        setError("No learning path found.");
        return;
      }

      const parsed = JSON.parse(saved);

      console.log("LEARNING PATH DATA:", parsed);

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
      <main className="min-h-screen bg-[#090909] text-white px-6 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center">
            <div className="text-4xl mb-4">
              🍝
            </div>

            <h1 className="text-2xl font-bold">
              Something went wrong
            </h1>

            <p className="mt-3 text-zinc-400">
              {error}
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!path) {
    return (
      <main className="min-h-screen bg-[#090909] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-5">
            🍝
          </div>

          <p className="text-zinc-400">
            Building your learning path...
          </p>
        </div>
      </main>
    );
  }

  const sections =
    Array.isArray(path.learningPath)
      ? path.learningPath
      : [];

  const validation =
    path.validation || null;

  return (
    <main className="min-h-screen bg-[#090909] text-white px-5 py-10 md:px-8 md:py-14">
      <div className="max-w-5xl mx-auto">

        {/* HEADER */}

        <div className="mb-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center text-xl">
              🍝
            </div>

            <span className="font-bold tracking-wide text-red-500">
              SPAGHETTI AI
            </span>
          </div>

          <p className="text-sm uppercase tracking-[0.2em] text-red-500 font-semibold mb-3">
            Optimized learning path
          </p>

          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            {path.title ||
              "Learning Path"}
          </h1>

          {path.query && (
            <p className="text-zinc-400 text-lg mt-4">
              Learning:
              <span className="text-white ml-2">
                {path.query}
              </span>
            </p>
          )}

          <p className="mt-5 max-w-3xl text-zinc-500 leading-7">
            Spaghetti AI analyzed
            educational video content,
            transcript segments and
            prerequisite relationships to
            select the strongest explanations
            in a useful learning order.
          </p>
        </div>

        {/* ENGINEERING / VALIDATION SUMMARY */}

        <div className="mb-12 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-red-500 font-semibold">
                Path verification
              </p>

              <h2 className="text-xl font-semibold mt-1">
                Built from transcript-level evidence
              </h2>
            </div>

            {validation?.passed === true && (
              <div className="rounded-full border border-emerald-900 bg-emerald-950/50 px-4 py-2 text-sm text-emerald-400 font-medium">
                ✓ Validation passed
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <MetricCard
              label="Concepts"
              value={sections.length}
            />

            <MetricCard
              label="Videos analyzed"
              value={
                path.videosProcessed ??
                "—"
              }
            />

            <MetricCard
              label="Coverage"
              value={
                isNumber(
                  validation?.conceptCoverage
                )
                  ? `${Math.round(
                      validation.conceptCoverage
                    )}%`
                  : "—"
              }
            />

            <MetricCard
              label="Grounding"
              value={
                isNumber(
                  validation?.resourceGrounding
                )
                  ? `${Math.round(
                      validation.resourceGrounding
                    )}%`
                  : "—"
              }
            />

            <MetricCard
              label="Duplicates"
              value={
                isNumber(
                  validation?.duplicateResources
                )
                  ? validation.duplicateResources
                  : "—"
              }
            />
          </div>

          <p className="mt-4 text-xs text-zinc-600">
            Grounding checks whether selected
            timestamps correspond to retrieved
            transcript evidence. Coverage shows
            how much of the generated curriculum
            has a suitable learning resource.
          </p>
        </div>

        {/* EMPTY STATE */}

        {sections.length === 0 && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
            <h2 className="text-xl font-semibold">
              No learning sections were generated.
            </h2>

            <p className="text-zinc-400 mt-2">
              Try searching again.
            </p>
          </div>
        )}

        {/* LEARNING PATH */}

        <div className="space-y-8">
          {sections.map(
            (
              section: any,
              index: number
            ) => {
              return (
                <div
                  key={
                    section.id ||
                    index
                  }
                  className="relative rounded-2xl border border-zinc-800 bg-zinc-900 p-6 md:p-8"
                >
                  {/* CONCEPT NUMBER */}

                  <div className="flex items-center justify-between gap-4 mb-5">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-9 h-9 rounded-full bg-red-600 text-white font-bold">
                        {index + 1}
                      </div>

                      <span className="text-sm font-semibold uppercase tracking-wider text-red-500">
                        Concept{" "}
                        {index + 1}
                      </span>
                    </div>

                    <span className="text-xs text-zinc-600">
                      {index + 1} /{" "}
                      {sections.length}
                    </span>
                  </div>

                  {/* TITLE */}

                  <h2 className="text-2xl md:text-3xl font-bold">
                    {section.title ||
                      section.concept ||
                      "Learning Concept"}
                  </h2>

                  {/* GOAL */}

                  {section.goal && (
                    <div className="mt-4">
                      <p className="text-xs uppercase tracking-wider text-zinc-600 mb-1">
                        Learning objective
                      </p>

                      <p className="text-zinc-300 leading-7">
                        {section.goal}
                      </p>
                    </div>
                  )}

                  {/* EXPLANATION */}

                  {section.explanation && (
                    <div className="mt-6 rounded-xl border border-zinc-800 bg-[#0c0c0c] p-5">
                      <h3 className="font-semibold text-white">
                        Why this comes here
                      </h3>

                      <p className="text-zinc-400 mt-2 leading-7">
                        {
                          section.explanation
                        }
                      </p>
                    </div>
                  )}

                  {/* RESOURCES */}

                  {Array.isArray(
                    section.resources
                  ) &&
                    section.resources
                      .length > 0 && (
                      <div className="mt-8">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold">
                            Selected learning segments
                          </h3>

                          <span className="text-xs text-zinc-500">
                            {
                              section
                                .resources
                                .length
                            }{" "}
                            segment
                            {section
                              .resources
                              .length !== 1
                              ? "s"
                              : ""}
                          </span>
                        </div>

                        <div className="space-y-4">
                          {section.resources.map(
                            (
                              resource: any,
                              resourceIndex: number
                            ) => {
                              const startTime =
                                Number(
                                  resource.startTime
                                ) || 0;

                              const endTime =
                                Number(
                                  resource.endTime
                                ) || 0;

                              const videoId =
                                resource.videoId;

                              const youtubeUrl =
                                resource.url ||
                                (videoId
                                  ? `https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(
                                      startTime
                                    )}s`
                                  : "#");

                              const educationalScore =
                                getNumber(
                                  resource.educationalScore
                                );

                              const pathScore =
                                getNumber(
                                  resource.pathScore
                                );

                              const similarity =
                                getNumber(
                                  resource.similarity
                                );

                              const transcript =
                                typeof resource.text ===
                                "string"
                                  ? resource.text.trim()
                                  : "";

                              return (
                                <div
                                  key={
                                    resource.chunkId ||
                                    `${videoId}-${startTime}-${resourceIndex}`
                                  }
                                  className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950"
                                >
                                  <div className="p-5">
                                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5">
                                      <div className="min-w-0 flex-1">

                                        {/* TIMESTAMP */}

                                        <div className="flex flex-wrap items-center gap-3">
                                          <div className="font-mono text-sm rounded-lg border border-red-950 bg-red-950/30 px-3 py-1.5">
                                            <span className="text-red-400 font-semibold">
                                              {formatTime(
                                                startTime
                                              )}
                                            </span>

                                            <span className="text-zinc-600 mx-2">
                                              →
                                            </span>

                                            <span className="text-zinc-300">
                                              {formatTime(
                                                endTime
                                              )}
                                            </span>
                                          </div>

                                          <span className="text-xs text-zinc-600">
                                            {formatDuration(
                                              endTime -
                                                startTime
                                            )}{" "}
                                            watch
                                          </span>
                                        </div>

                                        {/* TAKEAWAY */}

                                        {resource.takeaway && (
                                          <div className="mt-4">
                                            <p className="text-xs uppercase tracking-wider text-zinc-600 mb-1">
                                              What you&apos;ll get
                                            </p>

                                            <p className="text-white font-medium leading-6">
                                              {
                                                resource.takeaway
                                              }
                                            </p>
                                          </div>
                                        )}

                                        {/* WHY SELECTED */}

                                        <div className="mt-5 rounded-xl border border-zinc-800 bg-[#0b0b0b] p-4">
                                          <div className="flex items-center gap-2">
                                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-950 text-xs text-red-400">
                                              ✓
                                            </span>

                                            <h4 className="text-sm font-semibold">
                                              Why Spaghetti selected this segment
                                            </h4>
                                          </div>

                                          {resource.reason ? (
                                            <p className="text-sm text-zinc-400 mt-3 leading-6">
                                              {
                                                resource.reason
                                              }
                                            </p>
                                          ) : (
                                            <p className="text-sm text-zinc-500 mt-3 leading-6">
                                              This segment survived semantic retrieval,
                                              educational scoring and path optimization.
                                            </p>
                                          )}

                                          <div className="mt-4 flex flex-wrap gap-2">
                                            <EvidenceBadge>
                                              ✓ Exact timestamp
                                            </EvidenceBadge>

                                            {transcript && (
                                              <EvidenceBadge>
                                                ✓ Transcript grounded
                                              </EvidenceBadge>
                                            )}

                                            {educationalScore !==
                                              null && (
                                              <ScoreBadge
                                                label="Educational"
                                                score={
                                                  educationalScore
                                                }
                                              />
                                            )}

                                            {pathScore !==
                                              null && (
                                              <ScoreBadge
                                                label="Path"
                                                score={
                                                  pathScore
                                                }
                                              />
                                            )}

                                            {similarity !==
                                              null && (
                                              <EvidenceBadge>
                                                Semantic{" "}
                                                {formatSimilarity(
                                                  similarity
                                                )}
                                              </EvidenceBadge>
                                            )}
                                          </div>
                                        </div>

                                        {/* TRANSCRIPT EVIDENCE */}

                                        {transcript && (
                                          <div className="mt-4">
                                            <p className="text-xs uppercase tracking-wider text-zinc-600 mb-2">
                                              Transcript evidence
                                            </p>

                                            <blockquote className="border-l-2 border-red-900 pl-4 text-sm text-zinc-500 leading-6">
                                              “
                                              {shortenText(
                                                transcript,
                                                320
                                              )}
                                              ”
                                            </blockquote>
                                          </div>
                                        )}
                                      </div>

                                      {/* WATCH */}

                                      {videoId && (
                                        <a
                                          href={
                                            youtubeUrl
                                          }
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="shrink-0 inline-flex items-center justify-center rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition"
                                        >
                                          Watch exact
                                          segment →
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                          )}
                        </div>
                      </div>
                    )}
                </div>
              );
            }
          )}
        </div>

        {/* FOOTER */}

        {sections.length > 0 && (
          <div className="mt-14 pb-6 text-center">
            <p className="text-sm text-zinc-600">
              🍝 Spaghetti AI · From scattered videos to an optimized learning path.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-[#0b0b0b] p-4">
      <div className="text-xl font-bold text-white">
        {value}
      </div>

      <div className="mt-1 text-xs text-zinc-500">
        {label}
      </div>
    </div>
  );
}

function EvidenceBadge({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <span className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-400">
      {children}
    </span>
  );
}

function ScoreBadge({
  label,
  score,
}: {
  label: string;
  score: number;
}) {
  return (
    <span className="rounded-full border border-red-950 bg-red-950/30 px-3 py-1 text-xs text-red-300">
      {label} {Math.round(score)}/100
    </span>
  );
}

function getNumber(
  value: unknown
): number | null {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function isNumber(
  value: unknown
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  );
}

function formatSimilarity(
  similarity: number
) {
  if (
    similarity >= 0 &&
    similarity <= 1
  ) {
    return `${Math.round(
      similarity * 100
    )}%`;
  }

  return `${Math.round(
    similarity
  )}%`;
}

function shortenText(
  text: string,
  maxLength: number
) {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text
    .slice(0, maxLength)
    .trim()}…`;
}

function formatDuration(
  seconds: number
) {
  const safeSeconds = Math.max(
    0,
    Math.round(seconds)
  );

  if (safeSeconds < 60) {
    return `${safeSeconds}s`;
  }

  const minutes = Math.floor(
    safeSeconds / 60
  );

  const remaining =
    safeSeconds % 60;

  if (remaining === 0) {
    return `${minutes}m`;
  }

  return `${minutes}m ${remaining}s`;
}

function formatTime(
  seconds: number
) {
  const totalSeconds =
    Math.max(
      0,
      Math.floor(seconds)
    );

  const hours = Math.floor(
    totalSeconds / 3600
  );

  const minutes = Math.floor(
    (totalSeconds % 3600) / 60
  );

  const remainingSeconds =
    totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(
      minutes
    ).padStart(
      2,
      "0"
    )}:${String(
      remainingSeconds
    ).padStart(
      2,
      "0"
    )}`;
  }

  return `${minutes}:${String(
    remainingSeconds
  ).padStart(
    2,
    "0"
  )}`;
}
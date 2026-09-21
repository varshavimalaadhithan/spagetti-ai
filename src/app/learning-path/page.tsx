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
        {/* LEARNING SEQUENCE */}

{sections.length > 0 && (
  <div className="mb-12 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 md:p-6">
    <div className="mb-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-500">
        Learning sequence
      </p>

      <h2 className="mt-1 text-xl font-semibold text-white">
        Your prerequisite-aware path
      </h2>

      <p className="mt-2 text-sm text-zinc-500">
        Concepts are arranged in the order Spaghetti recommends learning them.
      </p>
    </div>

    <div className="flex flex-col gap-2">
      {sections.map(
        (
          section: any,
          index: number
        ) => (
          <div
            key={
              section.id ||
              index
            }
          >
            <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-600 text-sm font-bold text-white">
                {index + 1}
              </div>

              <div className="min-w-0">
                <p className="font-medium text-white">
                  {section.title ||
                    section.concept ||
                    "Learning concept"}
                </p>

                {section.goal && (
                  <p className="mt-1 text-xs text-zinc-500">
                    {section.goal}
                  </p>
                )}
              </div>
            </div>

            {index <
              sections.length - 1 && (
              <div className="ml-4 flex h-6 items-center">
                <div className="h-full w-px bg-red-900" />

                <span className="ml-2 text-xs text-zinc-700">
                  ↓
                </span>
              </div>
            )}
          </div>
        )
      )}
    </div>

    <p className="mt-5 text-xs text-zinc-600">
      AI-generated concept order based on prerequisite relationships.
    </p>
  </div>
)}

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
                                  
                              const coverageSummary =
  typeof resource.coverageSummary ===
  "string"
    ? resource.coverageSummary.trim()
    : typeof resource.takeaway ===
      "string"
    ? resource.takeaway.trim()
    : "";
                                  const selectionEvidence =
  resource?.selectionEvidence ?? null;

const eligibleCandidates =
  getNumber(
    selectionEvidence?.eligibleCandidates
  );

const qualityThreshold =
  getNumber(
    selectionEvidence?.qualityThreshold
  );

const allocationStage =
  typeof selectionEvidence?.allocationStage ===
  "string"
    ? selectionEvidence.allocationStage
    : "";

const alternatives =
  Array.isArray(
    selectionEvidence?.alternatives
  )
    ? selectionEvidence.alternatives.slice(
        0,
        3
      )
    : [];

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

                                        {/* SEGMENT COVERAGE PREVIEW */}

{coverageSummary && (
  <div className="mt-4 rounded-xl border border-zinc-800 bg-[#0c0c0c] p-4">
    <div className="flex items-start gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-950 text-sm text-red-400">
        ✦
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-red-400">
          Covered in this exact segment
        </p>

        <p className="mt-2 text-sm leading-6 text-zinc-300">
          {shortenText(
            coverageSummary,
            420
          )}
        </p>

        <p className="mt-3 text-xs text-zinc-600">
          Preview for{" "}
          <span className="font-mono text-zinc-500">
            {formatTime(
              startTime
            )}
            {" → "}
            {formatTime(
              endTime
            )}
          </span>
        </p>
      </div>
    </div>
  </div>
)}

                                        {/* WHY THIS CLIP WON - COLLAPSIBLE */}

<details className="mt-5 overflow-hidden rounded-xl border border-zinc-800 bg-[#0b0b0b]">
  <summary className="cursor-pointer list-none p-4 md:p-5 hover:bg-zinc-900/70 transition">
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-950 text-red-400">
          ✓
        </div>

        <div>
          <p className="font-semibold text-white">
            Why this clip?
          </p>

          <p className="mt-0.5 text-xs text-zinc-500">
            See how Spaghetti selected this exact segment
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {educationalScore !== null && (
          <span className="hidden sm:inline-flex rounded-full border border-red-950 bg-red-950/30 px-3 py-1 text-xs font-medium text-red-300">
            {Math.round(
              educationalScore
            )}
            /100
          </span>
        )}

        <span className="text-zinc-500 text-lg">
          ↓
        </span>
      </div>
    </div>
  </summary>

  <div className="border-t border-zinc-800 p-5">

    {/* SIMPLE INTRO */}

    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-400">
          Selection evidence
        </p>

        <h4 className="mt-1 text-lg font-semibold text-white">
          Why this segment won
        </h4>

        {eligibleCandidates !== null && (
          <p className="mt-2 text-sm text-zinc-500">
            Spaghetti evaluated{" "}
            <span className="font-medium text-zinc-300">
              {eligibleCandidates}
            </span>{" "}
            eligible transcript segment
            {eligibleCandidates !== 1
              ? "s"
              : ""}{" "}
            for this concept.
          </p>
        )}
      </div>

      <span className="shrink-0 rounded-full border border-red-900 bg-red-950/40 px-3 py-1.5 text-xs font-semibold text-red-300">
        🏆 SELECTED
      </span>
    </div>

    {/* SCORES */}

    <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
      {educationalScore !== null && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
          <p className="text-xs text-zinc-500">
            Educational quality
          </p>

          <p className="mt-1 text-xl font-bold text-white">
            {Math.round(
              educationalScore
            )}
            <span className="text-sm font-normal text-zinc-600">
              /100
            </span>
          </p>
        </div>
      )}

      {similarity !== null && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
          <p className="text-xs text-zinc-500">
            Concept relevance
          </p>

          <p className="mt-1 text-xl font-bold text-white">
            {formatSimilarity(
              similarity
            )}
          </p>
        </div>
      )}

      {qualityThreshold !== null && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
          <p className="text-xs text-zinc-500">
            Minimum quality
          </p>

          <p className="mt-1 text-xl font-bold text-white">
            {Math.round(
              qualityThreshold
            )}
            <span className="text-sm font-normal text-zinc-600">
              /100
            </span>
          </p>

          <p className="mt-2 text-xs text-emerald-500">
            ✓ Passed
          </p>
        </div>
      )}

      {allocationStage && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
          <p className="text-xs text-zinc-500">
            Selection method
          </p>

          <p className="mt-1 text-sm font-semibold capitalize text-white">
            {allocationStage.replace(
              /-/g,
              " "
            )}
          </p>
        </div>
      )}
    </div>

    {/* REASON */}

    <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
      <p className="text-sm font-semibold text-white">
        Why it was selected
      </p>

      <p className="mt-2 text-sm leading-6 text-zinc-400">
        {resource.reason ||
          "This segment survived semantic retrieval, educational scoring, redundancy removal and path optimization."}
      </p>
    </div>

    {/* BADGES */}

    <div className="mt-4 flex flex-wrap gap-2">
      <EvidenceBadge>
        ✓ Exact timestamp
      </EvidenceBadge>

      {transcript && (
        <EvidenceBadge>
          ✓ Transcript grounded
        </EvidenceBadge>
      )}

      <EvidenceBadge>
        ✓ Path optimized
      </EvidenceBadge>
    </div>

    {/* ALTERNATIVES */}

    {alternatives.length > 0 && (
      <div className="mt-6 border-t border-zinc-800 pt-5">
        <p className="text-sm font-semibold text-white">
          Other candidates considered
        </p>

        <p className="mt-1 text-xs text-zinc-600">
          Other eligible transcript segments for this concept.
        </p>

        <div className="mt-3 space-y-2">
          {alternatives.map(
            (
              alternative: any,
              alternativeIndex: number
            ) => {
              const alternativeScore =
                getNumber(
                  alternative?.educationalScore
                );

              const alternativeSimilarity =
                getNumber(
                  alternative?.similarity
                );

              const alternativeStart =
                Number(
                  alternative?.startTime
                ) || 0;

              const alternativeEnd =
                Number(
                  alternative?.endTime
                ) || 0;

              return (
                <div
                  key={`${alternative?.videoId || "candidate"}-${alternativeStart}-${alternativeIndex}`}
                  className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-300">
                      Candidate{" "}
                      {alternativeIndex + 1}
                    </p>

                    <p className="mt-1 font-mono text-xs text-zinc-600">
                      {formatTime(
                        alternativeStart
                      )}
                      {" → "}
                      {formatTime(
                        alternativeEnd
                      )}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {alternativeScore !== null && (
                      <span className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-400">
                        Quality{" "}
                        {Math.round(
                          alternativeScore
                        )}
                        /100
                      </span>
                    )}

                    {alternativeSimilarity !== null && (
                      <span className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-400">
                        Relevance{" "}
                        {formatSimilarity(
                          alternativeSimilarity
                        )}
                      </span>
                    )}
                  </div>
                </div>
              );
            }
          )}
        </div>
      </div>
    )}

    {/* TRANSCRIPT */}

    {transcript && (
      <div className="mt-6 border-t border-zinc-800 pt-5">
        <div className="mb-2">
  <p className="text-xs uppercase tracking-wider text-zinc-600">
    Optional technical verification
  </p>

  <p className="mt-1 text-xs text-zinc-700">
    Raw transcript evidence used to verify this timestamp.
    You do not need this to follow the learning path.
  </p>
</div>

        <blockquote className="border-l-2 border-red-900 pl-4 text-sm leading-6 text-zinc-500">
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
</details>

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
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number =
    Number(value);

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
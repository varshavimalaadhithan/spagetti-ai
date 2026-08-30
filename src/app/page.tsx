"use client";

import { useEffect, useRef, useState } from "react";

type TrialStatus = {
  enabled: boolean;
  limit: number;
  remaining: number;
  reset: number | null;
  resetAt: string | null;
};

export default function Home() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState("");
  const [started, setStarted] = useState(false);
  const [trialStatus, setTrialStatus] = useState<TrialStatus | null>(null);
  const [trialLoading, setTrialLoading] = useState(true);
  const [error, setError] = useState("");
  const requestInFlightRef = useRef(false);

  async function refreshTrialStatus() {
    try {
      const response = await fetch("/api/trial-status", {
        cache: "no-store",
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();

      if (data?.trial) {
        setTrialStatus(data.trial);
      }
    } catch (statusError) {
      console.error("Trial status error:", statusError);
    } finally {
      setTrialLoading(false);
    }
  }

  useEffect(() => {
    void refreshTrialStatus();
  }, []);

  function getResetLabel() {
    if (!trialStatus?.resetAt) {
      return "Resets daily";
    }

    const resetDate = new Date(trialStatus.resetAt);

    if (Number.isNaN(resetDate.getTime())) {
      return "Resets daily";
    }

    return `Resets ${resetDate.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  }

  async function buildLearningPath() {
    if (
      !query.trim() ||
      loading ||
      requestInFlightRef.current
    ) {
      return;
    }

    /*
     * State updates are asynchronous, so
     * this ref closes the tiny window where
     * a double-click / Enter+click could
     * submit the same generation twice.
     */
    requestInFlightRef.current = true;

    setLoading(true);
    setError("");
    setStage("Searching YouTube...");

    try {
      // STEP 1 — Search YouTube
      const searchRes = await fetch(
        `/api/search?query=${encodeURIComponent(query)}`
      );

      const searchText = await searchRes.text();

      let videos: any;

      try {
        videos = JSON.parse(searchText);
      } catch {
        throw new Error("Invalid response from YouTube search.");
      }

      if (
        !searchRes.ok ||
        !Array.isArray(videos) ||
        videos.length === 0
      ) {
        throw new Error("No suitable videos were found.");
      }

      // STEP 2 — Rank videos
      setStage("Finding the best learning resources...");

      const rankRes = await fetch("/api/rank-videos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: query.trim(),
          videos,
        }),
      });

      const rankText = await rankRes.text();

      let rankData: any;

      try {
        rankData = JSON.parse(rankText);
      } catch {
        throw new Error("AI returned an invalid response.");
      }

      if (!rankRes.ok) {
        throw new Error(
          rankData?.error || "Failed to rank videos."
        );
      }

      if (!Array.isArray(rankData?.recommendations)) {
        throw new Error(
          "No video recommendations were generated."
        );
      }

      const selectedVideos = rankData.recommendations
        .map((recommendation: any) => {
          const index = Number(recommendation?.index);

          if (
            Number.isNaN(index) ||
            index < 0 ||
            index >= videos.length
          ) {
            return null;
          }

          return videos[index];
        })
        .filter(Boolean);

      if (selectedVideos.length === 0) {
        throw new Error(
          "No suitable learning resources were found."
        );
      }

      // STEP 3 — Build learning path
      setStage("Building your learning path...");

      const formattedVideos = selectedVideos
        .map((video: any) => {
          const videoId =
            video?.id?.videoId ||
            video?.videoId ||
            video?.id;

          const title =
            video?.snippet?.title ||
            video?.title ||
            "Untitled video";

          if (!videoId) {
            return null;
          }

          return {
            videoId,
            title,
          };
        })
        .filter(Boolean);

      if (formattedVideos.length === 0) {
        throw new Error(
          "The selected videos could not be processed."
        );
      }

      const pathRes = await fetch("/api/learning-path", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          videos: formattedVideos,
          query: query.trim(),
        }),
      });

      const pathText = await pathRes.text();

      let pathData: any;

      try {
        pathData = JSON.parse(pathText);
      } catch {
        throw new Error(
          "The learning-path API returned an invalid response."
        );
      }

      if (pathData?.trial) {
        setTrialStatus(pathData.trial);
      }

      if (!pathRes.ok) {
        if (pathRes.status === 429) {
          requestInFlightRef.current = false;
          setLoading(false);
          setStage("");
          setError(
            pathData?.error ||
              "You've used today's free learning paths. Cached learning paths are still available."
          );
          void refreshTrialStatus();
          return;
        }

        throw new Error(
          pathData?.error ||
            "Failed to generate the learning path."
        );
      }

      // STEP 4 — Save result
      localStorage.setItem(
        "learningPath",
        JSON.stringify(pathData)
      );

      // STEP 5 — Open learning path
      window.location.href = "/learning-path";
    } catch (error) {
      console.error("Learning path error:", error);

      const message =
        error instanceof Error
          ? error.message
          : "Something went wrong.";

      requestInFlightRef.current = false;
      setError(message);
      setLoading(false);
      setStage("");
      void refreshTrialStatus();
    }
  }

  function startApp() {
    setStarted(true);

    setTimeout(() => {
      const searchElement =
        document.getElementById("search");

      if (searchElement) {
        searchElement.scrollIntoView({
          behavior: "smooth",
        });
      }
    }, 100);
  }

  return (
    <main className="min-h-screen bg-black text-white">
      {/* NAVBAR */}

      <nav className="relative z-20 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="text-xl font-bold">
          <span className="text-red-500">Spaghetti</span>{" "}
          AI
        </div>

        <button
          onClick={startApp}
          className="rounded-full border border-zinc-700 px-5 py-2 text-sm transition hover:border-red-500 hover:bg-red-500 hover:text-white"
        >
          Try for free
        </button>
      </nav>

      {/* LANDING PAGE */}

      {!started && (
        <>
          {/* HERO */}

          <section className="relative mx-auto max-w-6xl overflow-hidden px-6 pb-36 pt-28 text-center">
            {/* Decorative animation */}

            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="meatball meatball-one" />
              <div className="meatball meatball-two" />
              <div className="meatball meatball-three" />
              <div className="meatball meatball-four" />

              <div className="spaghetti-line spaghetti-one" />
              <div className="spaghetti-line spaghetti-two" />
            </div>

            <div className="fade-in-up relative z-10">
              {/* BADGE */}

              <div className="mb-8 inline-flex items-center rounded-full border border-red-900/50 bg-red-950/30 px-4 py-2 text-sm text-red-300">
                AI-powered learning from YouTube
              </div>

              {/* HEADLINE */}

              <h1 className="text-6xl font-bold leading-none tracking-tight md:text-8xl">
                Stop watching.
                <br />
                <span className="gradient-text">
                  Start learning.
                </span>
              </h1>

              {/* DESCRIPTION */}

              <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-zinc-400 md:text-xl">
                Spaghetti AI turns hours of educational
                videos into one structured learning path.
              </p>

              {/* MAIN CTA */}

              <button
                onClick={startApp}
                className="group relative mt-10 overflow-hidden rounded-2xl bg-red-600 px-12 py-5 text-xl font-bold text-white shadow-[0_0_35px_rgba(239,68,68,0.35)] transition-all duration-300 hover:-translate-y-1 hover:scale-105 hover:bg-red-400 hover:shadow-[0_0_70px_rgba(239,68,68,0.75)] active:scale-100"
              >
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full" />

                <span className="relative z-10">
                  Try Spaghetti AI — Free →
                </span>
              </button>

              <p className="mt-5 text-sm text-zinc-600">
                2 free fresh learning paths per day · No signup · Cached paths stay free
              </p>
            </div>
          </section>

          {/* HOW IT WORKS */}

          <section className="mx-auto max-w-6xl px-6 pb-32">
            <div className="mb-14 text-center">
              <p className="text-sm font-semibold uppercase tracking-wider text-red-400">
                How it works
              </p>

              <h2 className="mt-3 text-4xl font-bold">
                From curiosity to clarity.
              </h2>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {[
                {
                  number: "01",
                  title: "Search",
                  text: "Tell Spaghetti AI what you want to learn.",
                },
                {
                  number: "02",
                  title: "Understand",
                  text: "AI finds useful explanations and breaks your topic into concepts.",
                },
                {
                  number: "03",
                  title: "Learn",
                  text: "Follow a structured path with precise timestamps.",
                },
              ].map((item) => (
                <div
                  key={item.number}
                  className="saas-card p-8"
                >
                  <div className="mb-6 text-sm font-bold text-red-500">
                    {item.number}
                  </div>

                  <h3 className="text-2xl font-bold">
                    {item.title}
                  </h3>

                  <p className="mt-3 leading-relaxed text-zinc-400">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* PROBLEM */}

          <section className="mx-auto max-w-5xl px-6 pb-32">
            <div className="saas-card p-10 md:p-14">
              <p className="text-sm font-semibold uppercase tracking-wider text-red-400">
                The problem
              </p>

              <h2 className="mt-3 text-4xl font-bold">
                You shouldn't need to watch everything
                to learn something.
              </h2>

              <div className="mt-10 grid gap-5 md:grid-cols-2">
                {[
                  "Skip irrelevant sections",
                  "Find the strongest explanations",
                  "Learn concepts in the right order",
                  "Jump directly to timestamps",
                  "Combine multiple learning resources",
                  "Spend less time searching",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-3 text-zinc-300"
                  >
                    <span className="text-red-500">
                      ✓
                    </span>

                    {item}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* FINAL CTA */}

          <section className="mx-auto max-w-4xl px-6 pb-32 text-center">
            <h2 className="text-5xl font-bold">
              Ready to untangle the internet?
            </h2>

            <p className="mt-5 text-zinc-400">
              Let Spaghetti AI find the useful parts.
            </p>

            <button
              onClick={startApp}
              className="group relative mt-8 overflow-hidden rounded-xl bg-red-600 px-9 py-4 font-bold transition-all duration-300 hover:-translate-y-1 hover:bg-red-400 hover:shadow-[0_0_40px_rgba(239,68,68,0.55)]"
            >
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />

              <span className="relative z-10">
                Try it for free →
              </span>
            </button>
          </section>

          {/* FOOTER */}

          <footer className="border-t border-zinc-900 py-10 text-center text-sm text-zinc-600">
            Spaghetti AI · Learn smarter.
          </footer>
        </>
      )}

      {/* PRODUCT SEARCH */}

      {started && (
        <section
          id="search"
          className="mx-auto max-w-4xl px-6 pb-32 pt-24"
        >
          {/* SEARCH HEADER */}

          <div className="text-center">
            <div className="mb-5 text-sm font-bold tracking-widest text-red-500">
              SPAGHETTI AI
            </div>

            <h1 className="text-5xl font-bold md:text-6xl">
              What do you want to learn?
            </h1>

            <p className="mt-5 text-lg text-zinc-400">
              We'll turn it into a learning path.
            </p>
          </div>

          {/* TRIAL STATUS */}

          <div className="mx-auto mt-8 max-w-xl">
            <div className="rounded-2xl border border-red-500/60 bg-red-950/35 px-5 py-4 shadow-[0_0_30px_rgba(239,68,68,0.16)]">
              {trialLoading ? (
                <p className="text-center text-sm font-medium text-red-200/80">
                  Checking today&apos;s free paths...
                </p>
              ) : trialStatus?.enabled ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="mb-2 inline-flex rounded-full border border-red-400/40 bg-red-500/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-red-200">
                      Free daily trial
                    </div>

                    <p className="text-base font-bold text-white">
                      {trialStatus.remaining > 0
                        ? `${trialStatus.remaining} free new learning ${trialStatus.remaining === 1 ? "path" : "paths"} left today`
                        : "You've used today's free new learning paths"}
                    </p>

                    <p className="mt-1.5 text-sm leading-relaxed text-red-100/75">
                      Only brand-new paths count. If a path is already available, it won&apos;t use one of your daily tries.
                    </p>
                  </div>

                  <div className="shrink-0 rounded-full bg-black/30 px-3 py-1.5 text-xs font-semibold text-red-200">
                    {getResetLabel()}
                  </div>
                </div>
              ) : (
                <p className="text-center text-sm text-zinc-500">
                  Free trial protection is currently unavailable.
                </p>
              )}
            </div>
          </div>

          {/* SEARCH BAR */}

          <div className="mt-8">
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 p-4 outline-none transition focus:border-red-500 focus:ring-1 focus:ring-red-500"
                placeholder="e.g. Machine Learning"
                value={query}
                disabled={loading}
                onChange={(event) => {
                  setQuery(event.target.value);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    buildLearningPath();
                  }
                }}
              />

              <button
                onClick={buildLearningPath}
                disabled={
                  loading || !query.trim()
                }
                className="rounded-xl bg-red-600 px-7 py-4 font-semibold transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50 sm:py-0"
              >
                {loading ? "Cooking..." : "Build path"}
              </button>
            </div>
          </div>

          {/* INLINE ERROR / TRIAL LIMIT */}

          {error && (
            <div className="mt-6 rounded-2xl border border-red-900/60 bg-red-950/30 p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-950 text-red-400">
                  !
                </div>

                <div>
                  <p className="font-semibold text-red-200">
                    {trialStatus?.remaining === 0
                      ? "Today's fresh-path trial is finished"
                      : "Spaghetti AI couldn't build this path"}
                  </p>

                  <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                    {error}
                  </p>

                  {trialStatus?.remaining === 0 && (
                    <p className="mt-2 text-xs text-zinc-500">
                      You can still open topics that are already cached. {getResetLabel()}.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* PROCESSING */}

          {loading && (
            <div className="saas-card fade-in mt-12 p-8 md:p-10">
              <div className="text-center">
                <div className="mb-5 animate-bounce text-5xl">
                  🍝
                </div>

                <h2 className="text-2xl font-bold">
                  Cooking your learning path...
                </h2>

                <p className="mt-3 text-sm text-zinc-500">
                  Spaghetti AI is doing the digging for
                  you.
                </p>
              </div>

              {/* PROCESS STEPS */}

              <div className="mt-10 space-y-5">
                {/* STEP 1 */}

                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full font-bold ${
                      stage === "Searching YouTube..."
                        ? "bg-red-600 text-white"
                        : "bg-red-950 text-red-400"
                    }`}
                  >
                    1
                  </div>

                  <div>
                    <p className="font-semibold">
                      Search YouTube
                    </p>

                    <p className="text-sm text-zinc-500">
                      Finding educational videos
                    </p>
                  </div>
                </div>

                <div className="ml-[18px] h-5 border-l border-zinc-800" />

                {/* STEP 2 */}

                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full font-bold ${
                      stage ===
                      "Finding the best learning resources..."
                        ? "bg-red-600 text-white"
                        : stage ===
                            "Building your learning path..."
                          ? "bg-red-950 text-red-400"
                          : "bg-zinc-800 text-zinc-500"
                    }`}
                  >
                    2
                  </div>

                  <div>
                    <p className="font-semibold">
                      Find the best resources
                    </p>

                    <p className="text-sm text-zinc-500">
                      Selecting the strongest
                      explanations
                    </p>
                  </div>
                </div>

                <div className="ml-[18px] h-5 border-l border-zinc-800" />

                {/* STEP 3 */}

                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full font-bold ${
                      stage ===
                      "Building your learning path..."
                        ? "bg-red-600 text-white"
                        : "bg-zinc-800 text-zinc-500"
                    }`}
                  >
                    3
                  </div>

                  <div>
                    <p className="font-semibold">
                      Build your learning path
                    </p>

                    <p className="text-sm text-zinc-500">
                      Organizing concepts and
                      timestamps
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
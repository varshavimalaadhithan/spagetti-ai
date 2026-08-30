"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [videos, setVideos] = useState<any[]>([]);
  const [selectedVideos, setSelectedVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  async function searchVideos() {
    if (!query) return;

    setLoading(true);

    const response = await fetch(
      `/api/search?query=${encodeURIComponent(query)}`
    );

    const data = await response.json();

    setVideos(data);
    setLoading(false);
  }

  function toggleVideo(video: any) {
    const videoId = video.id.videoId;

    if (
      selectedVideos.some(
        (v) => v.videoId === videoId
      )
    ) {
      setSelectedVideos(
        selectedVideos.filter(
          (v) => v.videoId !== videoId
        )
      );
    } else {
      setSelectedVideos([
        ...selectedVideos,
        {
          title: video.snippet.title,
          videoId,
        },
      ]);
    }
  }

  function createLearningPath() {
    console.log("SELECTED VIDEOS:", selectedVideos);
    localStorage.setItem(
        "selectedVideos",
        JSON.stringify(selectedVideos)
    );
    
    router.push("/learning-path");
  }

  return (
    <main className="min-h-screen bg-black text-white p-10">
      <h1 className="text-4xl font-bold mb-8">
        Spaghetti AI Search
      </h1>

      <div className="flex gap-3 mb-10">
        <input
          className="flex-1 p-3 rounded bg-zinc-800"
          placeholder="What do you want to learn?"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <button
          onClick={searchVideos}
          className="bg-white text-black px-6 rounded"
        >
          Search
        </button>
      </div>

      {loading && <p>Finding videos...</p>}

      <button
        onClick={createLearningPath}
        disabled={selectedVideos.length === 0}
        className="bg-green-500 text-black px-6 py-3 rounded mb-8"
      >
        Create Learning Path ({selectedVideos.length})
      </button>

      <div className="space-y-6">
        {videos.map((video) => {
          const videoId = video.id.videoId;

          const selected = selectedVideos.some(
            (v) => v.videoId === videoId
          );

          return (
            <div
              key={videoId}
              onClick={() => toggleVideo(video)}
              className={`bg-zinc-900 p-5 rounded-xl cursor-pointer ${
                selected ? "border-2 border-green-500" : ""
              }`}
            >
              <img
                src={video.snippet.thumbnails.medium.url}
                alt={video.snippet.title}
                className="rounded mb-4"
              />

              <h2 className="text-xl font-bold">
                {video.snippet.title}
              </h2>

              <p className="text-zinc-400">
                {video.snippet.channelTitle}
              </p>

              <p className="mt-3">
                {selected ? "✓ Selected" : "Click to select"}
              </p>
            </div>
          );
        })}
      </div>
    </main>
  );
}
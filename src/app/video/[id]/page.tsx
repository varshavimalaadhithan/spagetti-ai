"use client";

import { useEffect, useState } from "react";

export default function VideoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [timestamps, setTimestamps] = useState<any[]>([]);
  const [videoId, setVideoId] = useState("");

  useEffect(() => {
    async function getTimestamps() {
      const { id } = await params;

      setVideoId(id);

      const response = await fetch(
        `/api/timestamps?videoId=${id}`
      );

      const data = await response.json();

      setTimestamps(data.timestamps || []);
    }

    getTimestamps();
  }, [params]);

  return (
    <main className="min-h-screen bg-black text-white p-10">
      <h1 className="text-3xl font-bold mb-8">
        Learning Timeline
      </h1>

      <p className="mb-6 text-zinc-400">
        Video ID: {videoId}
      </p>

      <div className="space-y-4">
        {timestamps.map((item, index) => (
          <div
            key={index}
            className="bg-zinc-900 p-5 rounded-xl"
          >
            <h2 className="text-xl font-semibold">
              {item.time}
            </h2>

            <p className="text-zinc-300">
              {item.text}
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}
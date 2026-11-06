# Spaghetti AI

A smart-learning platform that transforms any topic into a structured, concept-by-concept learning path across YouTube videos — selecting specific timestamped segments rather than listing full videos.

<img width="1710" height="1107" alt="image" src="https://github.com/user-attachments/assets/37c1177a-6459-49c2-8328-28c9f5af3ad1" />
<img width="1710" height="1107" alt="Screenshot 2026-11-06 at 10 45 40 AM" src="https://github.com/user-attachments/assets/8cd205ec-aa09-45da-84dc-7dc1ee5078b2" />

## The Problem

YouTube has thousands of hours of excellent educational content. But searching a topic returns hundreds of unordered videos with no indication of where to start, what to watch next, or which 4-minute segment inside a 45-minute lecture actually explains the concept you need. The content is free. The learning path is missing.

## What Spaghetti AI Does

1. **Enter a topic** — e.g., "circuit analysis" or "neural networks"
2. **The system breaks it into subtopics** — modelling the topic as a prerequisite graph of concepts that build on each other
3. **It searches YouTube** — finding educational videos relevant to each subtopic
4. **It retrieves and processes transcripts** — extracting the specific segments where each concept is explained
5. **It generates an ordered learning path** — sequenced so each concept builds on the previous one, with timestamped links to the exact moments in each video

The user gets a structured path through free content — not a playlist, but a curriculum.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js (App Router) |
| Language | TypeScript |
| Frontend | React, Tailwind CSS |
| API | YouTube Data API v3 |
| AI/Embeddings | AI/API integration for learning-path generation |
| Caching | Redis |
| Transcript Processing | Custom retrieval and segmentation pipeline |

## How It Works

**Topic → Prerequisite Graph → Transcript Retrieval → Segment Scoring → Learning Path**

1. **Prerequisite Graph Modelling** — The system decomposes a topic into ordered subtopics, determining which concepts must be understood before others.

2. **Transcript Retrieval** — For each subtopic, the system retrieves YouTube video transcripts and identifies segments where the concept is discussed using vector embeddings.

3. **Batched Embedding Generation** — To operate within API rate limits and compute constraints, transcript segments are processed in batches rather than individually.

4. **Redis Caching** — Previously computed embeddings and segment scores are cached to eliminate redundant computation on repeated or similar queries.

5. **Scoring and Redundancy Removal** — Segments are scored for relevance and quality. Redundant segments covering the same concept are filtered out, keeping only the strongest explanation for each subtopic.

6. **Staged Processing** — The pipeline processes data in stages to manage memory and API usage efficiently — the same resource-constraint thinking that applies to embedded system design.

## Key Technical Decisions

- **Why prerequisite graphs?** Learning is sequential. Understanding Kirchhoff's laws requires understanding voltage and current first. The graph ensures concepts are presented in a buildable order.

- **Why timestamped segments instead of full videos?** A student looking for a 4-minute explanation of node voltage analysis shouldn't have to watch a 50-minute lecture. Segment-level retrieval respects the learner's time.

- **Why batching and caching?** The initial pipeline hit API rate limits when processing hundreds of transcript segments. Batched processing and Redis caching reduced redundant API calls and made the system viable under real-world compute constraints.

### TRY IT LIVE NOW: https://spagetti-ai-psi.vercel.app/

### Environment Variables

```
YOUTUBE_API_KEY=your_youtube_data_api_key
# Add any additional API keys required for AI/embedding generation
REDIS_URL=your_redis_connection_string (optional for local dev)
```

## Project Structure

```
spaghetti-ai/
├── app/                  # Next.js App Router pages
├── components/           # React UI components
├── lib/
│   ├── graph/            # Prerequisite graph modelling
│   ├── retrieval/        # Transcript retrieval and segmentation
│   ├── embeddings/       # Embedding generation and caching
│   ├── scoring/          # Segment scoring and redundancy removal
│   └── youtube/          # YouTube Data API integration
├── api/                  # Backend API routes
├── styles/               # Tailwind CSS configuration
├── public/               # Static assets
└── README.md
```

*Adjust this structure to match your actual file organisation.*

## Limitations

- Learning path quality depends on the availability and quality of YouTube transcripts for a given topic. Topics with few educational videos produce weaker paths.
- Transcript segmentation relies on textual content — videos that teach primarily through visuals with minimal narration are harder to segment meaningfully.
- The system currently generates paths in English. Multi-language support is not yet implemented.
- Rate limits on external APIs constrain the number of segments that can be processed per query.

## Future Development

- Improved segment scoring using user feedback signals
- User accounts with saved learning paths
- Learning progress tracking
- Quality benchmarking against manually curated curricula
- Multi-language transcript support

## Why I Built This

I noticed that the best educational content in the world is technically free — it's sitting on YouTube. But without structure, sequence, and context, free resources are inaccessible to the people who need them most. A student in any country with an internet connection can access the same lectures as a student at a top university. What they can't access is the curriculum that tells them what order to learn things in and which specific explanation to watch for each concept.

Spaghetti AI is my attempt to build that missing structure.

## Built By

**Varsha Vimalaadhithan** — independently designed, developed, and deployed.

---

*This project was built entirely from scratch as an independent learning exercise. No course, bootcamp, or tutorial produced this — every technical decision was made by solving problems as they appeared.*

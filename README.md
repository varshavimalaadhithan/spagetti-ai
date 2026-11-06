Spaghetti AI

Spaghetti AI is an learning-path system that turns a broad learning topic into a prerequisite-aware sequence of timestamped educational video segments.

Instead of recommending entire videos, the system identifies strong transcript-grounded sections for each concept, removes redundant material, and organizes the selected segments into a structured learning path.

Why I built it

Educational content on YouTube is abundant, but learners often spend more time searching, scrubbing, and deciding what to watch than actually learning.

Spaghetti AI is designed to answer three questions:

What concepts should I learn?

In what order should I learn them?

Which exact video segments teach each concept well?

System pipeline

flowchart TD
    A[User topic] --> B[Concept decomposition]
    B --> C[Prerequisite graph]
    C --> D[YouTube resource search]
    D --> E[Transcript extraction]
    E --> F[Timestamped transcript chunks]
    F --> G[Embeddings]
    G --> H[Semantic retrieval]
    H --> I[Segment analysis]
    I --> J[Educational scoring]
    J --> K[Redundancy removal]
    K --> L[Path optimization]
    L --> M[Validation]
    M --> N[Final learning timeline]
    N --> O[YouTube playback with context]

What the system does

Searches YouTube for educational resources

Ranks candidate videos

Extracts and caches transcripts

Splits transcripts into timestamped chunks

Creates and caches semantic embeddings

Decomposes the user topic into learning concepts

Builds prerequisite relationships between concepts

Retrieves transcript segments relevant to each concept

Evaluates segment educational quality

Removes redundant explanations

Optimizes the final learning sequence

Validates concept coverage, transcript grounding, and duplicate resources

Opens YouTube near the selected segment with additional playback context

Shows what the learner should understand from each selected clip

Tech stack

Next.js

React

TypeScript

Tailwind CSS

OpenAI API

YouTube Data API

Transcript extraction

Semantic embeddings

Upstash Redis

Vercel

Webshare residential proxy transport

Engineering decisions

Prerequisite-aware learning order

The system does not treat concepts as an unordered list. It creates prerequisite relationships and uses them to construct a learning sequence.

Segment-level retrieval

Videos are split into timestamped transcript chunks. Embeddings are generated for these chunks so retrieval happens at the explanation level rather than the whole-video level.

Quality threshold

A segment must meet a minimum educational-quality threshold before it is eligible for final selection. The system is allowed to leave a concept without a resource instead of forcing a weak explanation into the path.

Coverage-first resource allocation

When multiple concepts compete for similar resources, the system prioritizes giving concepts distinct strong segments before assigning optional second resources.

Validation

Generated paths are checked for concept coverage, transcript grounding, duplicate resources, and path validity. Only sufficiently validated paths are saved to the final-path cache.

Caching

Spaghetti AI uses local and persistent caching for expensive operations such as transcripts, embeddings, concept generation, and validated final paths. Cached final paths do not consume a new daily generation.

Production engineering challenge

One of the most important engineering problems appeared only after deployment.

Transcript extraction worked from a residential development machine but failed from cloud infrastructure because YouTube treated datacenter traffic differently. I investigated the failure across multiple deployment approaches, tested alternate transcript transports, and integrated a rotating residential proxy into the production transcript layer.

A later production failure returned HTTP 402 from the proxy provider. Logs showed that the learning-path system itself was still functioning and that the failure occurred before transcript retrieval. The application also correctly refunded the user's trial generation when no usable transcripts could be retrieved.

During this work I also diagnosed a compatibility issue between the transcript library's proxy dispatcher and a newer undici version. Pinning undici to a compatible release restored successful proxied transcript requests.

This debugging process changed the project from a local prototype into a more reliable deployed system.

Reliability and cost controls

Per-IP public API rate limiting

Two fresh learning-path generations per visitor per day

Cached paths remain available without consuming a fresh generation

Failed fresh generations are refunded

Persistent Redis caching reduces repeated API work

API credentials are stored in environment variables

Cross-site browser POST requests to expensive routes are rejected

Production security headers are applied at the proxy layer

Benchmarking

The final production benchmark is intentionally run on fresh, uncached topics.

Metrics recorded for each topic:

generation success/failure

validation pass/fail

concept coverage

resource grounding

duplicate resources

videos processed

transcript chunks processed

candidate segments analyzed

end-to-end processing time

manual timestamp usability rating

Benchmark results will be added here after the final production run.

User testing

The deployed product is tested across different technical subjects. Feedback focuses on timestamp usefulness, clarity of learning order, usefulness of the “What you'll learn” preview, confusion or friction, and preference versus manually searching YouTube.

What I learned

This project strengthened my experience with graph-based modeling, semantic retrieval, ranking and optimization, API constraints and batching, caching and distributed state, validation, production debugging, network/proxy behavior, rate limiting, reliability engineering, and designing an AI system whose output must remain grounded in external evidence.

Project status

Core backend: feature frozen

Current focus: final production benchmarking, documentation, demo recording, and project packaging.

Disclaimer

Spaghetti AI is an independent engineering project. It is designed to help learners navigate educational video content and does not guarantee the correctness of third-party educational material.

# Spaghetti AI — Technical Project Sheet

## Project

**Spaghetti AI: Optimized Learning Paths from Fragmented Educational Video Content**

## Problem

Educational video platforms contain large amounts of useful material, but learners must manually decide what concepts matter, what order to learn them in, which videos are useful, and where the relevant explanations occur.

## Goal

Build a system that converts a topic into a prerequisite-aware curriculum of strong, timestamped educational video segments.

## Core architecture

User topic → concept decomposition → prerequisite graph → YouTube resources → transcripts → timestamped chunks → embeddings → semantic retrieval → segment analysis → educational scoring → redundancy removal → path optimization → validation → final learning timeline.

## Key engineering features

- prerequisite graph construction
- segment-level semantic retrieval
- transcript-grounded timestamps
- educational-quality scoring
- redundancy removal
- coverage-first resource allocation
- deterministic final path assembly
- persistent transcript/embedding/path caching
- validation of coverage, grounding, and duplicates
- per-IP rate limiting
- daily generation quota with refunds on failed fresh runs
- residential proxy transport for production transcript reliability

## Significant constraints solved

### Embedding request limits

Large embedding workloads were split into batches so requests stayed within API input limits.

### Production transcript failure

Transcript retrieval worked locally but failed from cloud/datacenter infrastructure. The deployed system was adapted to use residential proxy transport.

### Proxy/runtime compatibility

A proxy dispatcher compatibility issue was isolated to the installed `undici` version. Pinning a compatible version restored successful transcript extraction.

### Timestamp usability

Exact transcript boundaries could begin mid-explanation. Playback was changed to preserve the AI-selected evidence while adding a small context buffer for the learner.

## Evidence

The project is evaluated using fresh-topic production benchmarks, validation metrics, manual timestamp-quality checks, user feedback, failure logs, debugging history, and deployed production behavior.

## Engineering skills demonstrated

Algorithms, graph modeling, semantic retrieval, optimization, API integration, caching, distributed systems, rate limiting, reliability engineering, debugging, networking, validation, and human-centered system design.

## Project classification

Independent engineering project.

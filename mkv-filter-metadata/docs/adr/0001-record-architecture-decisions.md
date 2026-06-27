---
date: 2026-06-26
status: "accepted"
author: "AI Assistant"
---

# 1. Record architecture decisions

## Context

We need to record the architectural decisions made on this project. Without a structured format, decisions made during development (like choosing Svelte 5 over Svelte 4, or structuring the FFmpeg pipeline) can be lost or misunderstood by future contributors (and AI agents).

## Decision

We will use Architecture Decision Records (ADRs). We will place them in this directory (`docs/adr/`), using a sequential numbering scheme and a markdown template. 

Each ADR will include:
- A YAML frontmatter section (`date`, `status`, `author`).
- The **Context** explaining the problem.
- The **Decision** made.
- The **Consequences** (both positive and negative) resulting from the decision.

## Consequences

- **Positive:** We have a persistent, readable history of why certain technologies or patterns were chosen. AI agents can read this folder to understand project boundaries and intent.
- **Negative:** Requires slightly more overhead when making significant architectural changes to ensure an ADR is drafted.

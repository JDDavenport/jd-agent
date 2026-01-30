# SoSatisfying.com Implementation Plan

## Scope Intent

Build an MVP of SoSatisfying.com inside this monorepo while keeping shared auth and data patterns consistent with existing JD Agent infrastructure. The MVP focuses on groups, posts, and a classic feed with voting and basic comments.

## Phase 0: Foundation (This Iteration)

- Establish shared domain types for SoSatisfying entities.
- Define MVP API surface (REST under `/api/v1/`).
- Set a minimal UI shell for a Reddit-style layout (header, sidebar, feed).
- Document local dev requirements and env vars.

## Phase 1: Data Model + API (MVP Core)

- Add Drizzle schema tables for users, groups, posts, comments, votes, subscriptions.
- Create API routes:
  - `GET /api/v1/feed` (Hot/New)
  - `POST /api/v1/groups`
  - `GET /api/v1/groups/:name`
  - `POST /api/v1/posts`
  - `GET /api/v1/posts/:id`
  - `POST /api/v1/posts/:id/vote`
  - `POST /api/v1/posts/:id/comments`
- Seed a small set of initial groups and posts for local dev.

## Phase 2: Web UI (MVP)

- Build feed view with post cards and sorting selector.
- Create group page with sidebar rules, group info, and post list.
- Implement post creation modal (link/image/text).
- Add authentication gates for posting and voting.

## Phase 3: Moderation + Search

- Add reporting API and moderation queue.
- Implement basic search (posts/groups).
- Add 21+ group warning gate with user preference storage.

## Phase 4: Ads + Analytics (Post-MVP)

- Integrate Gadz.io SDK and ad slots (banner, sidebar, in-feed).
- Add impressions and revenue aggregation.
- Expose creator revenue dashboard.

## Decisions / Assumptions

- Start with REST endpoints in `hub` and a separate UI in `apps/sosatisfying`.
- Use Drizzle ORM for schema consistency with existing DB.
- Keep auth integration pluggable with existing shared user tables.

## Risks

- Shared auth scope may require cross-app session handling.
- Media storage strategy needs clarification before upload support.
- Content moderation API choice affects cost and latency.

## Immediate Next Steps

1. Add shared types for SoSatisfying entities.
2. Stub API route definitions and route registry.
3. Create minimal app shell for layout and navigation.

# SIGNAL — AI & Frontier Technology Intelligence Hub

> An AI and frontier technology intelligence hub for discovering,
> understanding, and tracking meaningful technical progress.

SIGNAL is a personal research workbench for a computer-science student who
wants to follow AI model releases, AI in mathematics and computer science,
embodied intelligence, global research breakthroughs, and technology trends on
GitHub and in the developer community — plus a curated slice of other frontier
science. It is a
single-user, locally deployed application: no accounts, no multi-tenant
infrastructure.

> 中文简介：SIGNAL 是面向个人使用的 AI 与前沿科技情报工作台，重点跟踪 AI
> 模型发布与迭代、AI 在数学和计算机科学中的应用、具身智能、国内外科研突破，
> 以及 GitHub 与开发者社区的技术趋势，同时精选少量其他科学前沿进展。

---

## Overview

SIGNAL exists because keeping up with AI is structurally hard:

- AI news is scattered, and it is difficult to tell which changes matter.
- New models ship constantly, but capability differences between versions are
  rarely laid out side by side.
- Papers, open-source projects, and social trends lack a single tracking entry
  point.
- Generic summaries omit technical analysis, evidence assessment, and personal
  learning value.

SIGNAL's goal is **not** to aggregate headlines. It is to help you understand
technical progress, judge the quality of evidence, and find open questions that
are worth your time to study and reproduce.

## Key Research Areas

- AI Models & Releases
- AI × Mathematics
- AI × Computer Science
- Physical AI & Robotics
- AI Agents & Coding
- Open Source & Developer Ecosystem
- Global Research Breakthroughs
- Technology Trends on GitHub & Community
- Selected Frontier Science

## Features

| Feature | Status | Notes |
| ------- | ------ | ----- |
| Daily Briefing | ✅ shipped | A generated, quality-filtered briefing (3–5 items, 24 h + 7-day backfill) is produced from collected articles on the Analysis page. The home page's briefing sections currently use clearly-marked sample data. |
| Search & Explore | 🚧 in progress | Full search/filter UI exists; the Explore page currently browses sample data. Real collected articles are searchable via Library → Discover and the `/api/intelligence` API. |
| Research Tracking | 🚧 in progress | Same-model / same-topic history works for real saved articles (Library → History). The Research page shows sample deep-dive reading material. |
| Topic Monitoring | ✅ shipped | Built-in topic tracking (subscribe toggles) plus custom topics and keywords tied to saved items. |
| Personal Library | ✅ shipped | Server-persisted favorites, notes, tags, read-later / read / reproduce states, research collections, weekly review, and learning suggestions. |
| AI-powered Analysis | ✅ shipped (rule-based) | Structured per-item analysis: one-line summary, key change, differences, evidence, limitations, impact, relevance, further reading. An optional OpenAI-compatible LLM engine is implemented but **not configured**; without a key it falls back to the deterministic rule-based analyzer. |
| Model Version Comparison | 🚧 in progress | Model/version/license/benchmark extraction and a version registry exist. Capability comparisons honestly report "缺乏可直接比较的证据" (no directly comparable evidence) when scores were not extractable. |
| Open-source Trend Discovery | ✅ shipped (GitHub) | GitHub repository tracking with metric snapshots and five separated scores (popularity, momentum, technical merit, evidence quality, relevance). Researcher signals are derived from collected arXiv papers. |
| Scheduled updates & monitoring | ✅ shipped | Idempotent, locked, recorded tasks plus an in-process scheduler (`SIGNAL_SCHEDULER_ENABLED=true`). Manual triggers and task status are available in Settings and `/api/tasks/status`. |

## Current data status

SIGNAL has two data layers:

1. **Real data** (production path): articles collected from arXiv and GitHub
   are stored in SQLite, analyzed, and drive the Analysis, Trends, Library, and
   Settings pages.
2. **Sample data** (Part 1 skeleton): the home Daily Briefing, Explore,
   Research, and Topics pages still render clearly-marked sample data
   (`src/lib/mock-data.ts`, `isMock: true`) while those surfaces are being
   migrated to the real data layer.

## Screenshots

No screenshots are included yet — no placeholder image paths are referenced.

## Tech Stack

- **Framework**: Next.js 16 (App Router) with Turbopack
- **Language**: TypeScript, React 19
- **Styling**: Tailwind CSS v4 (CSS variables, dark/light themes), Lucide icons
- **Database**: Node.js built-in `node:sqlite` (single SQLite file, WAL mode).
  No external DB service, no ORM — plain SQL.
- **Ingestion**: arXiv export API (Atom), GitHub REST API, the Hacker News
  Algolia API, and a generic RSS/Atom provider. All
  outbound requests go through a guarded HTTP client (SSRF validation,
  timeouts, bounded retries, rate limiting).
- **Analysis**: built-in deterministic rule-based engine; optional
  OpenAI-compatible chat-completions engine gated behind an env var.
- **Testing**: Vitest (29 unit tests) + ESLint + `tsc --noEmit` + `next build`.
- **Persistence of preferences**: `localStorage` for UI preferences (theme,
  settings, topic subscriptions); all knowledge data lives in SQLite.

## Getting Started

Prerequisites:

- **Node.js ≥ 22.5** (uses the built-in `node:sqlite` module; tested on 24.21)
- npm (tested on 11.19)

```bash
npm install
cp .env.example .env.local   # optional — see Environment Variables
npm run dev
```

Next.js prints the URL in the terminal; the default is http://localhost:3000.
If the port is already in use, use the URL from your terminal output.

Production build and quality checks:

```bash
npm run build      # production build
npm run start      # serve the production build
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm test           # Vitest
```

The database is created and migrated automatically on first access
(`.data/signal.db`, `CREATE TABLE IF NOT EXISTS`). No manual migration step is
required. See [`docs/RUNBOOK.md`](./docs/RUNBOOK.md) for the full production
runbook (scheduling, backup/restore, quota risks, known issues).

## Environment Variables

Copy `.env.example` to `.env.local` and set values as needed. **No variables
are strictly required** — arXiv and GitHub work without keys. All secrets are
read server-side only and never reach the browser bundle.

| Variable | Required | Purpose |
| -------- | -------- | ------- |
| `GITHUB_TOKEN` | optional | Raises the GitHub API limit from 60 to 5000 requests/hour. |
| `RSS_FEEDS` | optional | Comma-separated RSS/Atom feed URLs for the blog/media provider. |
| `LLM_ANALYZER_API_KEY` | optional | Enables the LLM analysis engine. Without it, the rule-based analyzer is used. |
| `LLM_ANALYZER_BASE_URL` | optional | Base URL for the OpenAI-compatible endpoint. |
| `LLM_ANALYZER_MODEL` | optional | Model name for the LLM analyzer. |
| `SIGNAL_SCHEDULER_ENABLED` | optional | `true` enables the in-process scheduled pipeline. |
| `SIGNAL_SCHEDULER_INTERVAL_MS` | optional | Scheduler interval in ms (default 21600000 = 6 h). |
| `SIGNAL_ADMIN_TOKEN` | optional | When set, manual/admin endpoints require a matching bearer token. |
| `SIGNAL_DB_PATH` | optional | Override the SQLite database path. |
| `SIGNAL_REQUEST_TIMEOUT_MS` | optional | Outbound request timeout (default 15000). |
| `SIGNAL_MIN_REQUEST_INTERVAL_MS` | optional | Minimum interval between outbound requests (default 1000). |

## Project Structure

```
src/
  app/                 Next.js App Router routes (pages + /api routes)
  components/          UI: design-system primitives, layout shell, search,
                       briefing, items, library, trends, settings panels
  lib/                 shared client code: types, constants, mock data,
                       storage adapter, hooks, utils
  lib/server/          server-only: providers, SQLite db, ingestion,
                       analysis, trends, library, tasks, SSRF/HTTP guards
  instrumentation.ts   scheduler entry point
tests/                 Vitest unit tests
docs/                  RUNBOOK.md (production runbook)
public/                static assets
```

## Data Sources and Reliability

SIGNAL prioritizes, in order: official model releases and technical reports,
arXiv / OpenReview and top conference and lab pages, the GitHub API (repos,
releases, commits, growth metrics), university/lab/company research pages,
researcher posts and community discussion, and reliable tech media for
context.

It explicitly separates:

- official vendor claims,
- preprints,
- peer-reviewed research,
- independent reproduction, and
- marketing.

Each stored article keeps the original URL, source name, **content publish
time**, and **fetch time** (never conflated), and titles/original content are
kept in English. RSS is connected via configured public
feeds (MIT News, MIT Technology Review, Google DeepMind, OpenAI), alongside
Hacker News and arXiv/GitHub.

| Source | Status |
| ------ | ------ |
| arXiv (export API) | ✅ connected, keyless |
| GitHub (REST API) | ✅ connected |
| Hacker News (Algolia API) | ✅ connected, keyless |
| RSS / blogs (MIT News, MIT Tech Review, DeepMind, OpenAI) | ✅ connected |

## Roadmap

Not yet implemented / in progress:

- Migrate the home, Explore, Research, and Topics pages from sample data to the
  real collection layer.
- Configure and validate the LLM analysis engine.
- Accumulate multi-day repository snapshots so the star-growth Momentum score
  can be computed over a meaningful time series (currently "unknown" until two
  snapshots exist).
- Per-item capability comparison for model versions (reasoning/math/coding/
  multimodal/agent) once benchmark scores can be extracted reliably.
- Notifications for scheduled-task results; cron-style schedules (currently a
  fixed interval).
- End-to-end browser tests (Playwright) — currently unit tests only.

## Privacy, Security and Limitations

- **Single-user, local deployment.** There is no authentication, no accounts,
  and no multi-tenant isolation. Do not expose the server to an untrusted
  network without a reverse proxy and `SIGNAL_ADMIN_TOKEN`.
- Never commit API keys; use `.env.local` (ignored by Git). `.env.example`
  contains placeholders only.
- All external content (web pages, paper text, model output) is treated as
  untrusted input: it is rendered with React escaping, and LLM output is
  whitelisted field-by-field.
- Outbound requests are SSRF-checked (http/https only, public IPs only),
  time-limited, and rate-limited.
- Model-generated summaries are a **starting point, not a substitute** for
  reading the original paper and checking the source yourself.

## License and Contributions

This project is licensed under the MIT License — see [LICENSE](./LICENSE) for
the full text. (The MIT text covers this project's own code only; it does not
apply to third-party dependencies, external data, or any trademarks.)

Contributions are welcome: open an issue to discuss changes before submitting
a pull request. No CI pipeline, issue templates, or other automation are set up
at this time.#   S I G N A L  
 
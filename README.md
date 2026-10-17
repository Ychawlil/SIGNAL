# SIGNAL

### AI & Frontier Technology Intelligence Hub

**Discover what matters. Understand what changes. Track what comes next.**

SIGNAL is a personal intelligence workbench for tracking AI breakthroughs, model releases, research papers, and emerging technology trends.

It goes beyond headlines to help you understand **what changed, why it matters, and what is worth exploring next.**

中文简介：SIGNAL 是一个个人 AI 与前沿科技情报工作台，聚焦 AI 模型、数学与计算机科学、具身智能、科研突破，以及 GitHub 上的新兴技术趋势。

---

## ✦ Focus Areas

| Domain | What to Track |
|---|---|
| **AI Models** | New releases, capability shifts, reasoning, multimodal AI |
| **AI × Science** | Mathematics, theorem proving, algorithms, scientific discovery |
| **Physical AI** | Robotics, VLA, world models, robot learning |
| **Agents & Coding** | AI agents, coding tools, inference and infrastructure |
| **Open Source** | Emerging repositories, developer tools, project momentum |
| **Frontier Science** | Selected breakthroughs in physics, biology, energy and beyond |

## ✦ Features

| Feature | Status |
|---|---|
| Daily intelligence briefing | Available |
| AI-powered article analysis | Available; rule-based by default |
| Personal library, notes & collections | Available |
| Topic subscriptions & weekly review | Available |
| GitHub trend tracking | Available |
| Scheduled ingestion & analysis | Available |
| Search and research exploration | Available |
| Model version comparison | In progress |

All primary pages — Daily Briefing, Explore, Research, Topics, Analysis, Trends, and
Library — render real records collected from the connected sources. No sample or
placeholder content is served in production.

## ✦ How It Works

SIGNAL collects, analyzes, and organizes technology intelligence into a searchable personal knowledge base.

1. **Collect** — Retrieve articles and research from arXiv RSS/API, GitHub, RSS feeds, and Hacker News.
2. **Analyze** — Extract key changes, evidence, limitations, and potential impact.
3. **Prioritize** — Evaluate relevance, technical merit, evidence quality, and emerging trends.
4. **Track** — Save discoveries, organize research, and review developments over time.

Original sources remain accessible. Official claims, preprints, peer-reviewed research, and independent verification are treated as distinct forms of evidence.

## ✦ Tech Stack

- **Framework:** Next.js 16, React 19, TypeScript
- **Styling:** Tailwind CSS v4, CSS variables, Lucide
- **Database:** SQLite via Node.js `node:sqlite`
- **Data sources:** arXiv daily RSS, arXiv export API, GitHub REST API, Hacker News, RSS/Atom
  (arXiv and GitHub collection can be paused per source)
- **Analysis:** Rule-based engine with optional OpenAI-compatible LLM integration
- **Testing:** Vitest, ESLint, TypeScript, Next.js build

## ✦ Getting Started

### Requirements

- Node.js ≥ 22.5
- npm

### Installation

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open the URL printed in your terminal, usually `http://localhost:3000`.

The SQLite database is initialized automatically on first access.

### Available Commands

```bash
npm run dev        # Development server
npm run build      # Production build
npm run start      # Production server
npm run lint       # Lint checks
npm run typecheck  # TypeScript checks
npm test           # Unit tests
```

## ✦ Configuration

All environment variables are optional. arXiv and GitHub can work without API keys, subject to service rate limits.

Sources can be paused individually with `SIGNAL_DISABLED_PROVIDERS`. A paused source
makes no outbound request, keeps its historical rows, and is reported as "paused" in
Settings and Trends.

| Variable | Purpose |
|---|---|
| `GITHUB_TOKEN` | Higher GitHub API rate limits (60 → 5000/h); verify it via Settings → GitHub 认证 |
| `LLM_ANALYZER_API_KEY` | Enable LLM-based analysis |
| `LLM_ANALYZER_BASE_URL` | OpenAI-compatible API endpoint |
| `LLM_ANALYZER_MODEL` | Analysis model |
| `RSS_FEEDS` | Additional RSS/Atom feeds |
| `ARXIV_RSS_CATEGORIES` | arXiv daily announcement categories to follow |
| `SIGNAL_DISABLED_PROVIDERS` | Pause automatic collection per source (e.g. `arxiv,github`) |
| `SIGNAL_MIN_REQUEST_INTERVAL_MS` | Outbound request pacing (arXiv stays ≥3000) |
| `SIGNAL_SCHEDULER_ENABLED` | Enable scheduled processing |
| `SIGNAL_ADMIN_TOKEN` | Protect manual/admin endpoints |
| `SIGNAL_DB_PATH` | Custom SQLite database path |

See `.env.example` and [`docs/RUNBOOK.md`](./docs/RUNBOOK.md) for additional configuration and operational details.

## ✦ Roadmap

- [ ] Configure and validate LLM-powered analysis
- [ ] Improve model-version and capability comparisons
- [ ] Build reliable multi-day trend measurements
- [ ] Add researcher/community signal tracking beyond arXiv
- [ ] Introduce browser-based end-to-end tests

## ✦ Security & Privacy

- Designed for single-user, local deployment.
- Never commit API keys or private environment files.
- External content and model outputs are treated as untrusted input.
- AI-generated analysis should be verified against original sources.

Do not expose the application to untrusted networks without appropriate access controls.

## ✦ License

Released under the [MIT License](./LICENSE).

This license applies to SIGNAL's own code, not third-party dependencies, external content, or trademarks.
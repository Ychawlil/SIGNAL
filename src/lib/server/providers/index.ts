import type { IntelligenceProvider, ProviderId } from "../types";
import { arxivProvider } from "./arxiv";
import { arxivRssProvider } from "./arxiv-rss";
import { githubProvider } from "./github";
import { hackernewsProvider } from "./hackernews";
import { rssProvider } from "./rss";

/**
 * Order matters: the cheapest / most reliable sources first, so a single
 * slow source cannot delay the briefing-relevant ones.
 */
export const PROVIDERS: IntelligenceProvider[] = [
  arxivRssProvider,
  arxivProvider,
  githubProvider,
  hackernewsProvider,
  rssProvider,
];

const providerMap = new Map<ProviderId, IntelligenceProvider>(
  PROVIDERS.map((p) => [p.id, p]),
);

export function getProvider(id: ProviderId): IntelligenceProvider | undefined {
  return providerMap.get(id);
}

export {
  arxivProvider,
  arxivRssProvider,
  githubProvider,
  hackernewsProvider,
  rssProvider,
};


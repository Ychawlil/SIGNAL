import type { IntelligenceProvider, ProviderId } from "../types";
import { arxivProvider } from "./arxiv";
import { githubProvider } from "./github";
import { hackernewsProvider } from "./hackernews";
import { rssProvider } from "./rss";

export const PROVIDERS: IntelligenceProvider[] = [
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

export { arxivProvider, githubProvider, hackernewsProvider, rssProvider };

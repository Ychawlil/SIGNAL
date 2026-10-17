import type {
  FetchContext,
  IntelligenceProvider,
  ProviderHealthCheck,
  ProviderResult,
} from "../types";

export class ProviderUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderUnavailableError";
  }
}

/** XML parsing can yield an object or an array depending on item count. */
export function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

export function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface ProviderDefinition {
  id: IntelligenceProvider["id"];
  name: string;
  fetch: (ctx: FetchContext) => Promise<ProviderResult>;
  healthCheck: () => ProviderHealthCheck;
}

export function createProvider(def: ProviderDefinition): IntelligenceProvider {
  return def;
}

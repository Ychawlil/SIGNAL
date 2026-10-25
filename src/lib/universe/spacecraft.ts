import { getPlanet, type PlanetId } from "./planets";
export const DEFAULT_SHIP_TARGET: PlanetId = "ai-frontier";
export const SHIP_LENGTH = getPlanet("community")!.radius * 4 / 3;

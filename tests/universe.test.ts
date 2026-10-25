import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PLANETS, CELESTIAL_BODIES, SUN, orbitPosition, orbitalSpeed, getPlanet } from "@/lib/universe/planets";
import { createPlanetModel, disposeScene } from "@/components/universe/planet-model";
import { createGalaxyBackground } from "@/components/universe/galaxy-background";
import { readingPose, readingBoundary } from "@/components/universe/reading-camera";
import { overviewPosition } from "@/components/universe/overview-camera";
import { easeInOut, flightDuration } from "@/components/universe/camera-controller";
import * as THREE from "three";
describe("universe configuration and original procedural art", () => {
 it("maps six unique navigable worlds to existing sections", () => { expect(PLANETS).toHaveLength(6); expect(new Set(PLANETS.map((p) => p.id)).size).toBe(6); for (const planet of PLANETS) { expect(planet.href).toMatch(/^\/(explore\?planet=|library)/); expect(planet.radius).toBeGreaterThan(0); expect(getPlanet(planet.id)).toBe(planet); } expect(getPlanet("missing")).toBeUndefined(); });
 it("constructs deterministic finite low-poly models that can be disposed", () => {
  for (const config of CELESTIAL_BODIES) {
   const first = createPlanetModel(config, true), second = createPlanetModel(config, true);
   let meshes = 0; first.traverse((object) => { if (object instanceof THREE.Mesh) { meshes++; const position = object.geometry.getAttribute("position"); for (let i = 0; i < position.count; i++) expect(Number.isFinite(position.getX(i)) && Number.isFinite(position.getY(i)) && Number.isFinite(position.getZ(i))).toBe(true); } });
   expect(meshes).toBeGreaterThan(5); expect(meshes).toBeLessThan(70);
   expect(first.children.length).toBe(second.children.length); const scene = new THREE.Scene(); scene.add(first, second); expect(() => disposeScene(scene)).not.toThrow();
  }
 });
 it("builds a bounded world-space galaxy and releases its GPU resources", () => {
  for (const compact of [true, false]) {
   const galaxy = createGalaxyBackground(compact); let stars = 0; const releases: ReturnType<typeof vi.spyOn>[] = [];
   galaxy.traverse(object => {
    if (object instanceof THREE.Points) { stars += object.geometry.getAttribute("position").count; expect(object.material.fog).toBe(false); }
    if (object instanceof THREE.Points || object instanceof THREE.Mesh) {
     releases.push(vi.spyOn(object.geometry, "dispose")); releases.push(vi.spyOn(object.material as THREE.Material, "dispose"));
     const positions = object.geometry.getAttribute("position"); for (let i = 0; i < positions.count; i++) expect(Number.isFinite(positions.getX(i) + positions.getY(i) + positions.getZ(i))).toBe(true);
    }
   });
   expect(stars).toBeGreaterThan(1000); expect(stars).toBeLessThan(6000); expect(galaxy.position.length()).toBe(0);
   disposeScene(galaxy); for (const released of releases) expect(released).toHaveBeenCalledOnce();
  }
 });
 it("keeps the sun fixed and moves inner worlds faster on bounded inclined orbits", () => {
  expect(CELESTIAL_BODIES).toHaveLength(7); expect(getPlanet("analysis")).toBeUndefined();
  expect(getPlanet("library")?.href).toBe("/library"); expect(SUN.href).toBe("/briefing");
  expect(orbitPosition(SUN, 0)).toEqual(orbitPosition(SUN, 100));
  for (let i = 0; i < PLANETS.length; i++) {
   const planet = PLANETS[i]; const radius = planet.orbit!.radius;
   if (i > 0) expect(orbitalSpeed(radius)).toBeLessThan(orbitalSpeed(PLANETS[i - 1].orbit!.radius));
   const period = Math.PI * 2 / orbitalSpeed(radius);
   const start = orbitPosition(planet, 0), halfway = orbitPosition(planet, period / 2), end = orbitPosition(planet, period);
   expect(new THREE.Vector3(...start).length()).toBeCloseTo(radius, 8);
   expect(new THREE.Vector3(...start).distanceTo(new THREE.Vector3(...end))).toBeLessThan(.000001);
   expect(new THREE.Vector3(...start).distanceTo(new THREE.Vector3(...halfway))).toBeCloseTo(2 * radius, 8);
  }
 });
 it("fits every planet through an entire revolution on wide, laptop and portrait screens", () => {
  for (const [width, height] of [[1920,1080], [1440,1000], [1280,720], [768,1024], [390,844], [320,740]]) {
   const camera = new THREE.PerspectiveCamera(38, width / height, .1, 900);
   camera.position.copy(overviewPosition(width, height)); camera.lookAt(0,0,0); camera.updateMatrixWorld();
   for (const planet of CELESTIAL_BODIES) for (let step = 0; step < 128; step++) {
    const elapsed = planet.orbit ? step / 128 * Math.PI * 2 / orbitalSpeed(planet.orbit.radius) : 0;
    const centre = new THREE.Vector3(...orbitPosition(planet, elapsed));
    for (const axis of [new THREE.Vector3(1,0,0), new THREE.Vector3(0,1,0), new THREE.Vector3(0,0,1)]) for (const sign of [-1,1]) {
     const projected = centre.clone().addScaledVector(axis, planet.radius * 1.9 * sign).project(camera);
     expect(Math.abs(projected.x)).toBeLessThan(1); expect(Math.abs(projected.y)).toBeLessThan(1);
    }
   }
  }
  expect(overviewPosition(1440,1000).length()).toBeLessThan(Math.hypot(24,36));
 });
 it("flies to real orbital positions with the planet at the left edge and sun centred in the visible background", () => {
  for (const [width,height] of [[1440,1000], [1280,720], [900,900], [390,844], [320,740]]) {
   for (const planet of CELESTIAL_BODIES) for (let step=0;step<16;step++) {
    const period = planet.orbit ? Math.PI * 2 / orbitalSpeed(planet.orbit.radius) : 0;
    const world = new THREE.Vector3(...orbitPosition(planet, period * step / 16));
    const original = world.clone(); const pose = readingPose(planet, world, width, height);
    const camera = new THREE.PerspectiveCamera(38,width/height,.1,900);
    camera.position.copy(pose.position); camera.lookAt(0,0,0);
    camera.setViewOffset(width,height,width*(.5-pose.sunFraction),0,width,height); camera.updateMatrixWorld();
    const projected = world.clone().project(camera);
    expect(projected.x).toBeCloseTo(-1,7); expect(projected.y).toBeCloseTo(0,7);
    expect(world.equals(original)).toBe(true); expect(camera.position.distanceTo(world)).toBeGreaterThan(planet.radius*2);
    if (planet.id !== "briefing") {
     const sun = new THREE.Vector3().project(camera);
     expect((sun.x+1)/2).toBeCloseTo(readingBoundary(width)/2,7); expect(sun.y).toBeCloseTo(0,7);
    }
   }
  }
 });
 it("gives a distant destination more flight time while keeping the animation bounded", () => {
  expect(flightDuration(50)).toBeGreaterThan(flightDuration(20));
  expect(flightDuration(120)).toBeGreaterThan(flightDuration(50));
  expect(flightDuration(0)).toBeGreaterThanOrEqual(1000); expect(flightDuration(10000)).toBeLessThanOrEqual(3500);
 });
 it("eases smoothly without overshooting camera endpoints", () => { expect(easeInOut(0)).toBe(0); expect(easeInOut(.5)).toBe(.5); expect(easeInOut(1)).toBe(1); let previous = 0; for (let i = 0; i <= 100; i++) { const next = easeInOut(i / 100); expect(next).toBeGreaterThanOrEqual(previous); expect(next).toBeLessThanOrEqual(1); previous = next; } });
});
const dbFile = path.join(os.tmpdir(), `signal-universe-${Date.now()}.db`);
describe("read-only real universe data", () => {
 beforeAll(async () => { process.env.SIGNAL_DB_PATH = dbFile; vi.resetModules(); const { insertArticles } = await import("@/lib/server/db"); insertArticles([{ provider: "rss", externalId: "universe:1", title: "Actual record", summary: "A stored record", url: "https://example.com/universe", sourceName: "RSS", category: "ai-models", publishedAt: "2026-10-22T03:00:00Z", fetchedAt: "2026-10-22T04:00:00Z", authors: [], tags: [] }]); });
 afterAll(() => { delete process.env.SIGNAL_DB_PATH; for (const suffix of ["", "-wal", "-shm"]) try { fs.rmSync(dbFile + suffix, { force: true }); } catch { /* Windows may retain open SQLite handles. */ } });
 it("uses actual category records, timestamps and empty-state zeros without analyzing", async () => { const { getUniverseReport } = await import("@/lib/server/universe"); const result = getUniverseReport(new Date("2026-10-22T12:00:00Z")); expect(result.totalArticles).toBe(1); expect(result.planets["ai-frontier"]).toMatchObject({ total: 1, new24h: 1, lastUpdatedAt: "2026-10-22T04:00:00Z", articleIds: ["1"] }); expect(result.planets.community.total).toBe(0); expect(result.planets.library.total).toBe(0); const { getDb } = await import("@/lib/server/db"); expect((getDb().prepare("SELECT COUNT(*) AS n FROM analyses").get() as { n: number }).n).toBe(0); });
});

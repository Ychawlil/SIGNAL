import * as THREE from "three";
import type { PlanetConfig } from "@/lib/universe/planets";

/** Match the visible background beside the responsive reading panel. */
export function readingBoundary(width: number) { return width < 760 ? .16 : width <= 1100 ? .32 : .4; }
export function readingPose(planet: PlanetConfig, position: THREE.Vector3, width: number, height: number, fov = 38) {
 const tangent = Math.tan(THREE.MathUtils.degToRad(fov / 2));
 const aspect = width / height;
 const visibleWidth = width * readingBoundary(width);
 const screenRadius = Math.min(height * .32, visibleWidth * .36);
 let depth = planet.radius * height / (2 * tangent * screenRadius);
 if (planet.id === "briefing") {
   // The sun is the selected body itself: approach it without making a second sun.
   return { position: new THREE.Vector3(0, .4, 1).normalize().multiplyScalar(depth), sunFraction: 0 };
 }
 const sunFraction = readingBoundary(width) / 2;
 const horizontal = Math.hypot(position.x, position.z);
 const separation = 2 * sunFraction * tangent * aspect;
 depth = Math.min(depth, horizontal * .8 / separation);
 const lateral = separation * depth;
 const remaining = Math.sqrt(Math.max(.000001, horizontal * horizontal - lateral * lateral));
 const azimuth = Math.atan2(position.x, position.z) + Math.asin(lateral / horizontal);
 const elevation = Math.atan2(position.y, remaining);
 const radius = Math.sqrt(remaining * remaining + position.y * position.y) + depth;
 return { position: new THREE.Vector3(Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.cos(azimuth) * Math.cos(elevation)).multiplyScalar(radius), sunFraction };
}

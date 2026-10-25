import * as THREE from "three";
import { CELESTIAL_BODIES } from "@/lib/universe/planets";
/** Fit the full orbital envelope, including terrain, hover scale and edge controls. */
export function overviewPosition(width: number, height: number, fov = 38): THREE.Vector3 {
 const safeWidth = Math.max(240, width), safeHeight = Math.max(320, height);
 const direction = new THREE.Vector3(0, .4, 1).normalize();
 const up = new THREE.Vector3(0, direction.z, -direction.y);
 const tangent = Math.tan(THREE.MathUtils.degToRad(fov / 2));
 const horizontal = tangent * safeWidth / safeHeight * Math.max(.6, 1 - 64 / safeWidth);
 const top = tangent * Math.max(.5, 1 - 192 / safeHeight);
 const bottom = tangent * Math.max(.6, 1 - 96 / safeHeight);
 let distance = 0;
 for (const planet of CELESTIAL_BODIES) {
   const radius = planet.radius * 1.9;
   const samples = planet.orbit ? 128 : 1;
   for (let i = 0; i < samples; i++) {
     const angle = i / samples * Math.PI * 2;
     const [x, y, z] = planet.orbit ? [Math.cos(angle) * planet.orbit.radius, Math.sin(angle) * Math.sin(planet.orbit.inclination) * planet.orbit.radius, Math.sin(angle) * Math.cos(planet.orbit.inclination) * planet.orbit.radius] : planet.position;
     const depth = y * direction.y + z * direction.z;
     const vertical = y * up.y + z * up.z;
     distance = Math.max(distance,
       depth + Math.abs(x) / horizontal + radius * Math.sqrt(1 + horizontal * horizontal) / horizontal,
       depth + vertical / top + radius * Math.sqrt(1 + top * top) / top,
       depth - vertical / bottom + radius * Math.sqrt(1 + bottom * bottom) / bottom);
   }
 }
 return direction.multiplyScalar(distance * 1.015);
}

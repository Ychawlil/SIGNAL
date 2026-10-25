import * as THREE from "three";
import type { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { overviewPosition } from "./overview-camera";
import { readingPose } from "./reading-camera";
import { orbitPosition, type PlanetConfig, type PlanetId } from "@/lib/universe/planets";
export function easeInOut(t: number) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
export function flightDuration(distance: number) { return THREE.MathUtils.clamp(850 + Math.sqrt(Math.max(0, distance)) * 180, 1350, 3300); }
/** Fly the camera to the real orbit, then track it while looking toward the sun. */
export class CameraController {
 private motion: { from: THREE.Vector3; fromShift: number; at: number; duration: number } | null = null;
 private selected: PlanetConfig | null = null;
 private shift = 0;
 private projectionKey = "";
 constructor(private camera: THREE.PerspectiveCamera, private controls: OrbitControls, private viewport: () => { width: number; height: number }, private reduced: () => boolean, private elapsed: () => number = () => 0, private onFlightChange: (id: PlanetId | null, arrived: boolean) => void = () => {}) {}
 cancel() { this.motion = null; this.controls.enabled = true; }
 private pose() {
   const { width, height } = this.viewport();
   return this.selected ? readingPose(this.selected, new THREE.Vector3(...orbitPosition(this.selected, this.elapsed())), width, height, this.camera.fov) : { position: overviewPosition(width, height, this.camera.fov), sunFraction: .5 };
 }
 private projection(shift: number) {
   const { width, height } = this.viewport();
   this.shift = shift;
   const key = `${width}:${height}:${shift.toFixed(7)}`;
   if (key === this.projectionKey) return false;
   this.projectionKey = key;
   if (Math.abs(shift) < .0000001) this.camera.clearViewOffset();
   else this.camera.setViewOffset(width, height, width * shift, 0, width, height);
   return true;
 }
 focus(planet: PlanetConfig | null) {
   this.selected = planet;
   const distance = planet ? this.camera.position.distanceTo(new THREE.Vector3(...orbitPosition(planet, this.elapsed()))) : 0;
   this.motion = { from: this.camera.position.clone(), fromShift: this.shift, at: performance.now(), duration: planet ? flightDuration(distance) : 1100 };
   this.onFlightChange(planet?.id ?? null, false);
   this.controls.enabled = false;
   if (this.reduced()) this.update(performance.now() + this.motion.duration);
 }
 update(now: number) {
   if (!this.motion && !this.selected) return false;
   const pose = this.pose(); const targetShift = .5 - pose.sunFraction;
   const previous = this.camera.position.clone();
   const motion = this.motion;
   let projectionChanged = false;
   if (motion) {
     const progress = Math.min(1, Math.max(0, (now - motion.at) / motion.duration)); const eased = easeInOut(progress);
     const from = motion.from.clone(), to = pose.position.clone();
     const distance = THREE.MathUtils.lerp(from.length(), to.length(), eased);
     const start = from.normalize(), finish = to.normalize();
     const rotation = new THREE.Quaternion().setFromUnitVectors(start, finish);
     this.camera.position.copy(start.applyQuaternion(new THREE.Quaternion().slerp(rotation, eased))).multiplyScalar(distance);
     projectionChanged = this.projection(THREE.MathUtils.lerp(motion.fromShift, targetShift, eased));
     if (progress === 1) { this.motion = null; this.onFlightChange(this.selected?.id ?? null, true); }
   } else {
     this.camera.position.copy(pose.position); projectionChanged = this.projection(targetShift);
   }
   this.controls.target.set(0, 0, 0); this.camera.lookAt(0, 0, 0);
   if (!this.motion && !this.selected) { this.controls.enabled = true; this.controls.update(); }
   return !!motion || projectionChanged || this.camera.position.distanceToSquared(previous) > .000000001;
 }
 get moving() { return this.motion !== null; }
}

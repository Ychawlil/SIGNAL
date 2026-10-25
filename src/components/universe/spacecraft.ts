import * as THREE from "three";
import { CELESTIAL_BODIES, getPlanet, orbitPosition, type PlanetId } from "@/lib/universe/planets";
import { DEFAULT_SHIP_TARGET, SHIP_LENGTH } from "@/lib/universe/spacecraft";
/** Original low-poly shuttle; its complete silhouette is two thirds of Community's diameter. */
export function createSpacecraft(): THREE.Group {
 const root = new THREE.Group(); root.name = "spacecraft";
 const materials = new Map<string, THREE.MeshStandardMaterial>();
 const add = (geometry: THREE.BufferGeometry, colour: string, position: [number,number,number]) => {
  if (!materials.has(colour)) materials.set(colour,new THREE.MeshStandardMaterial({color:colour,roughness:.78,metalness:.14,flatShading:true}));
  const mesh = new THREE.Mesh(geometry,materials.get(colour)); mesh.position.set(...position); root.add(mesh); return mesh;
 };
 const hull = add(new THREE.ConeGeometry(.14,.62,5),"#d8d6c9",[0,0,.08]); hull.rotation.x = Math.PI/2;
 add(new THREE.BoxGeometry(.21,.16,.30),"#a8b2b3",[0,-.01,-.06]);
 const canopy = add(new THREE.OctahedronGeometry(.12,0),"#527783",[0,.12,.10]); canopy.scale.set(.8,.58,1.5);
 for (const sign of [-1,1]) {
  const wing = add(new THREE.BoxGeometry(.23,.035,.27),"#c8c2b0",[sign*.19,-.045,-.09]); wing.rotation.y = sign*.35;
  add(new THREE.BoxGeometry(.055,.13,.18),"#697b81",[sign*.25,.015,-.14]);
  const engine = add(new THREE.CylinderGeometry(.055,.065,.15,6),"#667078",[sign*.10,-.015,-.24]); engine.rotation.x=Math.PI/2;
  const flame = add(new THREE.ConeGeometry(.043,.13,5),"#dcad71",[sign*.10,-.015,-.36]); flame.rotation.x=-Math.PI/2; flame.name="engine-flame";
 }
 root.updateMatrixWorld(true); const box=new THREE.Box3().setFromObject(root); const size=box.getSize(new THREE.Vector3());
 const factor=SHIP_LENGTH/Math.max(size.x,size.y,size.z); root.children.forEach(child=>{child.position.sub(box.getCenter(new THREE.Vector3()));}); root.scale.setScalar(factor);
 root.traverse(object=>{object.userData.spacecraft=true;}); return root;
}

/** Steering is independent of camera navigation and never changes a planet's orbit. */
export class SpacecraftController {
 readonly velocity = new THREE.Vector3();
 private destination: PlanetId = DEFAULT_SHIP_TARGET;
 private orbitAngle = 0;
 private arrived = true;
 constructor(readonly craft: THREE.Group) { this.craft.position.copy(this.orbitPoint(0)); }
 get target() { return this.destination; }
 get phase() { return this.arrived ? "orbiting" : "approaching"; }
 setTarget(target: PlanetId) {
  if (target === this.destination) return false;
  this.destination = target; this.arrived = false; this.orbitAngle = 0;
  return true;
 }
 private orbitPoint(time:number) {
  const planet=getPlanet(this.destination)!; const centre=new THREE.Vector3(...orbitPosition(planet,time));
  const radial=centre.lengthSq()>.01?centre.clone().normalize():new THREE.Vector3(0,1,0);
  const tangent=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),radial);
  if(tangent.lengthSq()<.01)tangent.set(1,0,0);else tangent.normalize();
  const north=new THREE.Vector3().crossVectors(radial,tangent).normalize();
  const radius=planet.radius*1.9+SHIP_LENGTH*.85;
  return centre.addScaledVector(tangent,Math.cos(this.orbitAngle)*radius).addScaledVector(north,Math.sin(this.orbitAngle)*radius);
 }
 update(dt: number, time: number) {
  const old = this.craft.position.clone();
  if (this.arrived) this.orbitAngle += dt * .55;
  const target = this.orbitPoint(time);
  if (this.craft.position.distanceTo(target) < .65) this.arrived = true;
  const desired = target.sub(this.craft.position).multiplyScalar(this.arrived ? 2.3 : 1.5).clampLength(0, 3.4);
  // Avoid terrain before contact; projection is a final guard against crossing a moving planet.
  for(const planet of CELESTIAL_BODIES){
   const centre=new THREE.Vector3(...orbitPosition(planet,time)); const away=this.craft.position.clone().sub(centre); const distance=away.length();
   const safe=planet.radius*1.75+SHIP_LENGTH*.4;
   if(distance<safe+1.1&&distance>.001) desired.addScaledVector(away.normalize(),Math.max(0,(safe+1.1-distance))*3.2);
  }
  this.velocity.lerp(desired,1-Math.exp(-dt*3.2));this.velocity.clampLength(0,3.5);
  this.craft.position.addScaledVector(this.velocity,dt);
  for(const planet of CELESTIAL_BODIES){
   const centre=new THREE.Vector3(...orbitPosition(planet,time));const away=this.craft.position.clone().sub(centre); const safe=planet.radius*1.75+SHIP_LENGTH*.4;
   if(away.length()<safe){if(away.lengthSq()<.000001)away.set(0,1,0);away.normalize();this.craft.position.copy(centre).addScaledVector(away,safe);const inward=this.velocity.dot(away);if(inward<0)this.velocity.addScaledVector(away,-inward);}
  }
  const limit=16.5;
  if(this.craft.position.length()>limit){this.craft.position.setLength(limit);const outward=this.craft.position.clone().normalize();if(this.velocity.dot(outward)>0)this.velocity.addScaledVector(outward,-this.velocity.dot(outward));}
  if(this.velocity.lengthSq()>.015){const orientation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),this.velocity.clone().normalize());this.craft.quaternion.slerp(orientation,1-Math.exp(-dt*4));}
  return old.distanceToSquared(this.craft.position)>.0000001;
 }
}

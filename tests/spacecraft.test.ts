import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { createSpacecraft, SpacecraftController } from "@/components/universe/spacecraft";
import { SHIP_LENGTH } from "@/lib/universe/spacecraft";
import { CELESTIAL_BODIES, getPlanet, orbitPosition } from "@/lib/universe/planets";
import { disposeScene } from "@/components/universe/planet-model";

describe("the little spacecraft",()=>{
 it("has the requested size and finite original geometry",()=>{
  const craft=createSpacecraft();const box=new THREE.Box3().setFromObject(craft);const size=box.getSize(new THREE.Vector3());
  expect(Math.max(size.x,size.y,size.z)).toBeCloseTo(getPlanet("community")!.radius*4/3,7);
  craft.traverse(object=>{if(object instanceof THREE.Mesh){const positions=object.geometry.getAttribute("position");for(let i=0;i<positions.count;i++)expect(Number.isFinite(positions.getX(i)+positions.getY(i)+positions.getZ(i))).toBe(true);}});
  disposeScene(craft);
 });
 it("starts orbiting AI Frontier and follows it safely as it moves",()=>{
  const craft=createSpacecraft(), pilot=new SpacecraftController(craft);const start=craft.position.clone();let covered=0;
  expect(pilot.target).toBe("ai-frontier");expect(pilot.phase).toBe("orbiting");
  for(let frame=1;frame<=5400;frame++){
   const previous=craft.position.clone(), time=frame/30;pilot.update(1/30,time);const step=previous.distanceTo(craft.position);covered+=step;
   expect(step).toBeLessThan(.7);expect(craft.position.length()).toBeLessThanOrEqual(16.50001);
   for(const planet of CELESTIAL_BODIES)expect(craft.position.distanceTo(new THREE.Vector3(...orbitPosition(planet,time)))).toBeGreaterThan(planet.radius*1.15);
  }
  expect(covered).toBeGreaterThan(50);expect(start.distanceTo(craft.position)).toBeGreaterThan(1);disposeScene(craft);
 });
 it("transfers between moving planets and settles into orbit around each destination",()=>{
  const craft=createSpacecraft(),pilot=new SpacecraftController(craft);let time=0;
  for(const id of ["community","science","library","briefing","ai-frontier"] as const){
   const before=craft.position.clone();pilot.setTarget(id);expect(craft.position.equals(before)).toBe(true);for(let step=0;step<1500;step++){time+=1/30;pilot.update(1/30,time);}
   expect(pilot.phase).toBe("orbiting");const planet=getPlanet(id)!;const distance=craft.position.distanceTo(new THREE.Vector3(...orbitPosition(planet,time)));
   expect(distance).toBeGreaterThan(planet.radius);expect(distance).toBeLessThan(planet.radius*4+SHIP_LENGTH*2);
  }
  disposeScene(craft);
 });
 it("keeps orbiting when the selected destination is unchanged",()=>{
  const craft=createSpacecraft(),pilot=new SpacecraftController(craft);
  for(let frame=1;frame<300;frame++)pilot.update(1/30,frame/30);
  const position=craft.position.clone();
  expect(pilot.setTarget("ai-frontier")).toBe(false);
  expect(craft.position.equals(position)).toBe(true);expect(pilot.phase).toBe("orbiting");
  expect(pilot.setTarget("research")).toBe(true);expect(pilot.phase).toBe("approaching");
  expect(pilot.setTarget("research")).toBe(false);
  disposeScene(craft);
 });
});

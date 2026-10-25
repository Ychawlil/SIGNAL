import * as THREE from "three";
import type { PlanetConfig } from "@/lib/universe/planets";
export function seededRandom(seed: number) {
 let state = seed >>> 0;
 return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}
/** All art is original procedural geometry. A GLB can replace this factory later. */
export function createPlanetModel(config: PlanetConfig, compact = false): THREE.Group {
 const root = new THREE.Group(); root.name = config.id;
 const random = seededRandom(config.seed);
 const r = config.radius;
 const materials = new Map<string, THREE.MeshStandardMaterial>();
 const material = (color: string) => {
   if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: .94, metalness: .02, flatShading: true }));
   return materials.get(color)!;
 };
 const add = (parent: THREE.Object3D, geometry: THREE.BufferGeometry, color: string, xyz: [number, number, number] = [0, 0, 0]) => {
   const mesh = new THREE.Mesh(geometry, material(color)); mesh.position.set(...xyz); parent.add(mesh); return mesh;
 };
 const bodyGeometry = new THREE.IcosahedronGeometry(r, compact ? 1 : 2);
 const positions = bodyGeometry.getAttribute("position");
 const colors: number[] = [];
 const base = new THREE.Color(config.color); const high = new THREE.Color(config.terrainColor);
 for (let i = 0; i < positions.count; i++) {
   const p = new THREE.Vector3().fromBufferAttribute(positions, i).normalize();
   const noise = Math.sin(p.x * 7 + config.seed) * Math.cos(p.z * 6) + Math.sin(p.y * 9 + p.z * 4) * .5;
   p.multiplyScalar(r * (1 + noise * .045)); positions.setXYZ(i, p.x, p.y, p.z);
   const shade = base.clone().lerp(high, Math.max(0, p.y / r * .35 + .10));
   colors.push(shade.r, shade.g, shade.b);
 }
 bodyGeometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3)); bodyGeometry.computeVertexNormals();
 const bodyMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
 if (config.landform === "sun") { bodyMaterial.emissive.set("#9e5e22"); bodyMaterial.emissiveIntensity = .32; }
 root.add(new THREE.Mesh(bodyGeometry, bodyMaterial));
 const surface = (lat: number, lon: number, scale = 1) => {
   const normal = new THREE.Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon));
   const group = new THREE.Group(); group.position.copy(normal).multiplyScalar(r * .97); group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal); group.scale.setScalar(r * scale); root.add(group); return group;
 };
 // Sculptural terrain clusters; fixed seeds keep each world's silhouette stable.
 const terrainCount = compact ? 7 : 12;
 for (let i = 0; i < terrainCount; i++) {
   const patch = surface(.12 + random() * 1.25, random() * Math.PI * 2);
   const height = .13 + random() * .23;
   const rock = add(patch, new THREE.ConeGeometry(.12 + random() * .17, height, 4), config.terrainColor, [0, height / 2 - .04, 0]);
   rock.rotation.y = random() * Math.PI;
 }
 if (config.landform === "sun") {
   for (let i = 0; i < 9; i++) {
     const ridge = surface((random() - .5) * 2.4, i * 2.4);
     const flare = add(ridge, new THREE.OctahedronGeometry(.16, 0), i % 2 ? "#f1d795" : "#d4a45b", [0, .12, 0]);
     flare.scale.set(1.2, .75 + random(), .7);
   }
 } else if (config.landform === "crystal") {
   for (let i = 0; i < (compact ? 5 : 9); i++) {
     const cluster = surface(.5 + random() * .8, .25 + random() * 2.1);
     const height = .28 + random() * .36;
     const crystal = add(cluster, new THREE.OctahedronGeometry(.14, 0), i % 2 ? "#c9dbd9" : "#90bac4", [0, height / 2, 0]); crystal.scale.set(.7, height / .2, .7); crystal.rotation.z = (random() - .5) * .35;
     add(cluster, new THREE.CylinderGeometry(.15, .20, .06, 5), "#4b626a");
   }
   const site = surface(1.1, 3.2); add(site, new THREE.BoxGeometry(.36, .12, .28), "#425964", [0, .07, 0]); add(site, new THREE.BoxGeometry(.13, .32, .13), "#b1c2bd", [0, .27, 0]);
 } else if (config.landform === "ruins") {
   const site = surface(1.15, 1.2);
   add(site, new THREE.BoxGeometry(.85, .08, .65), "#77766e", [0, .01, 0]);
   for (const x of [-.3, 0, .3]) for (const z of [-.22, .22]) add(site, new THREE.CylinderGeometry(.06, .08, .48, 5), "#d1c4a5", [x, .27, z]);
   add(site, new THREE.BoxGeometry(.82, .09, .12), "#b9aa8d", [0, .55, .22]);
   add(site, new THREE.BoxGeometry(.42, .09, .12), "#b9aa8d", [-.18, .55, -.22]);
   const gate = surface(.6, 3); add(gate, new THREE.BoxGeometry(.12, .42, .14), "#c5b798", [-.17, .2, 0]); add(gate, new THREE.BoxGeometry(.12, .42, .14), "#c5b798", [.17, .2, 0]); add(gate, new THREE.BoxGeometry(.5, .12, .18), "#d4c5a5", [0, .46, 0]);
 } else if (config.landform === "machines") {
   const site = surface(1.1, .9);
   add(site, new THREE.BoxGeometry(.65, .12, .48), "#485c54", [0, .08, 0]);
   add(site, new THREE.CylinderGeometry(.1, .14, .65, 4), "#bec3a5", [0, .45, 0]);
   add(site, new THREE.BoxGeometry(.55, .06, .08), "#495d5a", [0, .7, 0]);
   add(site, new THREE.OctahedronGeometry(.13), "#b6c99a", [0, .86, 0]);
   for (const x of [-.30, .30]) { const panel = add(site, new THREE.BoxGeometry(.28, .025, .38), "#425a61", [x, .28, 0]); panel.rotation.z = x > 0 ? -.2 : .2; }
   for (let i = 0; i < (compact ? 3 : 6); i++) { const tree = surface(.35 + random() * .7, 2 + random() * 3.5); add(tree, new THREE.CylinderGeometry(.025, .04, .18, 4), "#6c6850", [0, .08, 0]); add(tree, new THREE.ConeGeometry(.15, .36, 5), "#4c6553", [0, .3, 0]); }
 } else if (config.landform === "desert") {
   const station = surface(1.2, 1.4);
   add(station, new THREE.CylinderGeometry(.26, .32, .1, 6), "#947b60", [0, .05, 0]);
   add(station, new THREE.BoxGeometry(.3, .22, .26), "#d8c39b", [0, .2, 0]);
   add(station, new THREE.CylinderGeometry(.022, .035, .58, 5), "#544f49", [0, .58, 0]);
   const dish = add(station, new THREE.ConeGeometry(.22, .10, 8, 1, true), "#bcbdb2", [0, .8, 0]); dish.rotation.z = -.5;
   for (let i = 0; i < 3; i++) { const house = surface(.5, 2.5 + i * .32); add(house, new THREE.BoxGeometry(.20, .16 + i * .04, .23), "#c7a27c", [0, .08, 0]); }
 } else if (config.landform === "ice") {
   const site = surface(1.15, 1.25);
   add(site, new THREE.CylinderGeometry(.28, .32, .15, 8), "#7d959d", [0, .08, 0]);
   add(site, new THREE.SphereGeometry(.25, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), "#e0e7df", [0, .16, 0]);
   const telescope = add(site, new THREE.CylinderGeometry(.045, .065, .35, 6), "#516a79", [0, .31, .12]); telescope.rotation.x = 1;
   add(site, new THREE.BoxGeometry(.45, .04, .17), "#5c7b8d", [.34, .14, 0]);
 } else {
   const archive = surface(1.15, 1.2);
   add(archive, new THREE.BoxGeometry(.80, .1, .55), "#6c6579", [0, .06, 0]);
   add(archive, new THREE.BoxGeometry(.54, .35, .34), "#aaa0b1", [0, .27, -.05]);
   for (const x of [-.27, -.09, .09, .27]) add(archive, new THREE.BoxGeometry(.055, .38, .055), "#d2c7d2", [x, .27, .24]);
   const roof = add(archive, new THREE.ConeGeometry(.54, .22, 4), "#696377", [0, .56, 0]); roof.rotation.y = Math.PI / 4;
   add(archive, new THREE.BoxGeometry(.1, .5, .12), "#575368", [.40, .3, -.12]);
 }
 for (let i = 0; i < (compact ? 2 : 4); i++) {
   const angle = i * 2.2 + config.seed;
   const rock = add(root, new THREE.IcosahedronGeometry(r * (.045 + random() * .03), 0), config.color, [Math.cos(angle) * r * 1.4, (random() - .5) * r * .8, Math.sin(angle) * r * 1.35]);
   rock.rotation.set(random(), random(), random());
 }
 root.traverse((object) => { object.userData.planetId = config.id; });
 return root;
}
export function disposeScene(scene: THREE.Object3D) {
 const geometries = new Set<THREE.BufferGeometry>(); const materials = new Set<THREE.Material>(); const textures = new Set<THREE.Texture>();
 scene.traverse((object) => {
   const renderable = object as THREE.Mesh;
   if (renderable.geometry) geometries.add(renderable.geometry);
   if (renderable.material) for (const material of Array.isArray(renderable.material) ? renderable.material : [renderable.material]) materials.add(material);
 });
 geometries.forEach((geometry) => geometry.dispose()); materials.forEach((material) => { for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value); material.dispose(); }); textures.forEach((texture) => texture.dispose());
}

import * as THREE from "three";
import { seededRandom } from "./planet-model";

/** A world-space Milky Way: camera rotation reveals other parts of the sky. */
export function createGalaxyBackground(compact = false): THREE.Group {
 const galaxy = new THREE.Group(); galaxy.name = "milky-way";
 const material = new THREE.ShaderMaterial({
   side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false, toneMapped: false,
   vertexShader: `varying vec3 skyDirection;
     void main() { skyDirection = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
   fragmentShader: `precision highp float;
     varying vec3 skyDirection;
     float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
     float noise(vec2 p) {
       vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
       return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
     }
     float clouds(vec2 p) {
       float value = 0.0, weight = .5;
       for (int i = 0; i < ${compact ? 3 : 4}; i++) { value += weight * noise(p); p = mat2(.8, -.6, .6, .8) * p * 2.13 + 13.7; weight *= .5; }
       return value;
     }
     void main() {
       vec3 d = normalize(skyDirection);
       vec3 normal = normalize(vec3(.35, .74, -.57));
       vec3 side = normalize(cross(normal, vec3(0, 1, 0)));
       vec3 along = cross(side, normal);
       float longitude = atan(dot(d, side), dot(d, along));
       float latitude = asin(clamp(dot(d, normal), -1.0, 1.0));
       // Use continuous spherical coordinates for noise, avoiding a longitude seam.
       vec2 p = vec2(d.x * 3.1 + d.z * 2.7, d.y * 4.3 - d.z * 1.9);
       float broadNoise = clouds(p * 2.4);
       float detail = clouds(p * 10.0 + broadNoise * 2.0);
       float warp = (broadNoise - .45) * .14;
       float band = exp(-pow((latitude + warp) * 5.8, 2.0));
       float spine = exp(-pow((latitude + warp * .65) * 14.0, 2.0));
       float centre = pow(max(0.0, dot(d, normalize(vec3(-.45, -.52, -.72)))), 8.0);
       float mist = band * (.18 + broadNoise * .8 + detail * .45);
       float dust = exp(-pow((latitude + warp + .015) * 32.0, 2.0)) * smoothstep(.28, .7, detail);
       vec3 colour = vec3(.011, .016, .033);
       colour += vec3(.027, .038, .066) * clouds(p * .85);
       colour += mix(vec3(.13, .145, .23), vec3(.24, .185, .25), broadNoise) * mist;
       colour += vec3(.17, .165, .18) * spine * detail * (.5 + centre);
       colour += vec3(.12, .09, .055) * centre * band;
       colour *= 1.0 - dust * .68;
       colour += (hash(gl_FragCoord.xy) - .5) / 500.0;
       gl_FragColor = vec4(colour, 1.0);
     }`,
 });
 const sky = new THREE.Mesh(new THREE.SphereGeometry(430, 48, 24), material);
 sky.name = "galactic-sky"; sky.renderOrder = -100; sky.frustumCulled = false; galaxy.add(sky);
 const random = seededRandom(58731);
 const normal = new THREE.Vector3(.35, .74, -.57).normalize();
 const side = new THREE.Vector3().crossVectors(normal, new THREE.Vector3(0, 1, 0)).normalize();
 const along = new THREE.Vector3().crossVectors(side, normal);
 const addStars = (count: number, concentrated: boolean) => {
   const positions: number[] = [], colours: number[] = [];
   for (let i = 0; i < count; i++) {
     const angle = random() * Math.PI * 2;
     let direction: THREE.Vector3;
     if (concentrated) {
       const latitude = (random() + random() + random() - 1.5) * .22;
       direction = side.clone().multiplyScalar(Math.cos(angle)).addScaledVector(along, Math.sin(angle)).multiplyScalar(Math.cos(latitude)).addScaledVector(normal, Math.sin(latitude));
     } else {
       const y = random() * 2 - 1, xz = Math.sqrt(1 - y * y);
       direction = new THREE.Vector3(Math.cos(angle) * xz, y, Math.sin(angle) * xz);
     }
     direction.multiplyScalar(200 + random() * 190); positions.push(direction.x, direction.y, direction.z);
     const brightness = .28 + Math.pow(random(), 3) * .55;
     const tint = random(); colours.push(brightness * (tint > .8 ? 1 : .83), brightness * .91, brightness * (tint > .8 ? .8 : 1));
   }
   const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute("color", new THREE.Float32BufferAttribute(colours, 3));
   const stars = new THREE.Points(geometry, new THREE.PointsMaterial({ vertexColors: true, size: concentrated ? .18 : .30, sizeAttenuation: true, depthWrite: false, fog: false, transparent: true, opacity: concentrated ? .7 : .85, toneMapped: false }));
   stars.name = concentrated ? "galactic-star-band" : "distant-stars"; stars.renderOrder = -90; galaxy.add(stars);
 };
 addStars(compact ? 1000 : 2400, false); addStars(compact ? 1000 : 2600, true);
 return galaxy;
}

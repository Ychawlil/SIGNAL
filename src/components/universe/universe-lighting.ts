import * as THREE from "three";
export function addUniverseLighting(scene: THREE.Scene) {
 scene.add(new THREE.HemisphereLight(0xd8e3ec, 0x444048, 1.65));
 const key = new THREE.DirectionalLight(0xffe7bd, 3.1); key.position.set(-8, 14, 10); scene.add(key);
 const fill = new THREE.DirectionalLight(0x99b8d2, 1.1); fill.position.set(10, 3, -8); scene.add(fill);
 scene.fog = new THREE.Fog(0x151e28, 36, 85);
}

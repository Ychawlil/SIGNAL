"use client";
import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CELESTIAL_BODIES, orbitPosition, getPlanet, type PlanetId } from "@/lib/universe/planets";
import { createPlanetModel, disposeScene } from "./planet-model";
import { overviewPosition } from "./overview-camera";
import { CameraController } from "./camera-controller";
import { createSpacecraft, SpacecraftController } from "./spacecraft";
import { createGalaxyBackground } from "./galaxy-background";
import { addUniverseLighting } from "./universe-lighting";
export interface UniverseSceneApi { focus: (id: PlanetId | null) => void; }
interface Props {
 apiRef: RefObject<UniverseSceneApi | null>;
 selected: PlanetId | null;
 paused: boolean;
 signals: boolean;
 updated: readonly PlanetId[];
 onSelect: (id: PlanetId) => void;
 onFlightChange: (id: PlanetId | null, arrived: boolean) => void;
 onStatus: (status: "ready" | "unavailable") => void;
 onKey: (key: string) => void;
}
export default function UniverseCanvas(props: Props) {
 const host = useRef<HTMLDivElement>(null);
 const shipState = useRef<HTMLSpanElement>(null);
 const labels = useRef(new Map<string, HTMLButtonElement>());
 const latest = useRef(props);
 useEffect(() => { latest.current = props; }, [props]);
 useEffect(() => {
   const container = host.current; if (!container) return;
   const scene = new THREE.Scene();
   let renderer: THREE.WebGLRenderer;
   try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" }); }
   catch { latest.current.onStatus("unavailable"); return; }
   renderer.setClearColor(0x151d27, 0); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.13;
   const canvas = renderer.domElement; canvas.tabIndex = 0; canvas.setAttribute("aria-label", "三维信息宇宙。拖动旋转，滚轮或双指缩放，数字一至六选择星球，数字零打开每日简报，Escape 返回全景。"); canvas.setAttribute("role", "application");
   container.prepend(canvas);
   const mobile = () => container.clientWidth < 760;
   const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
   const compact = mobile() || ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) < 4;
   renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1.2 : 1.65));
   const camera = new THREE.PerspectiveCamera(38, 1, .1, 900);
   camera.aspect = container.clientWidth / container.clientHeight; camera.updateProjectionMatrix();
   camera.position.copy(overviewPosition(container.clientWidth, container.clientHeight, camera.fov));
   const controls = new OrbitControls(camera, canvas);
   controls.enableDamping = !reducedQuery.matches; controls.dampingFactor = .06; controls.enablePan = false; controls.rotateSpeed = .48; controls.zoomSpeed = .65;
   controls.minDistance = 4.3; controls.maxDistance = Math.max(mobile() ? 130 : 85, camera.position.length() * 1.4); controls.minPolarAngle = .45; controls.maxPolarAngle = 1.42; 
   controls.target.set(0, 0, 0); controls.update();
   let orbitalTime = 0;
   const controller = new CameraController(camera, controls, () => ({ width: container.clientWidth, height: container.clientHeight }), () => reducedQuery.matches, () => orbitalTime, (id, arrived) => {
     container.dataset.flight = arrived ? "arrived" : "flying";
     container.dataset.flightTarget = id ?? "";
     latest.current.onFlightChange(id, arrived);
   });
   addUniverseLighting(scene);
   if (mobile()) scene.fog = new THREE.Fog(0x151e28, 90, 180);
   const worlds = new THREE.Group(); scene.add(worlds);
   const models = CELESTIAL_BODIES.map((config) => {
     const pivot = new THREE.Group(); pivot.position.set(...orbitPosition(config, 0)); worlds.add(pivot);
     const model = createPlanetModel(config, compact); pivot.add(model);
     const pulseMaterial = new THREE.MeshBasicMaterial({ color: config.accentColor, transparent: true, opacity: .13, side: THREE.DoubleSide, depthWrite: false });
     const pulse = new THREE.Mesh(new THREE.RingGeometry(config.radius * 1.24, config.radius * 1.255, 48), pulseMaterial); pulse.rotation.x = -Math.PI / 2; pulse.position.y = -config.radius * .6; pivot.add(pulse);
     model.rotation.y = config.seed * .12; model.rotation.z = (config.seed % 9 - 4) * .025;
     return { config, model, pivot, pulse, pulseMaterial };
   });
   const craft = createSpacecraft(); scene.add(craft);
   const pilot = new SpacecraftController(craft);
   const flames = craft.children.filter(child => child.name === "engine-flame");
   scene.add(createGalaxyBackground(compact));
   let dirty = true, frame = 0, previous = performance.now(), disposed = false, hovered: string | null = null;
   // Optional future GLB art uses the exact same pivot, radius and navigation API.
   for (const { model, config } of models) if (config.modelUrl) {
     void import("three/addons/loaders/GLTFLoader.js").then(async ({ GLTFLoader }) => {
       const gltf = await new GLTFLoader().loadAsync(config.modelUrl!);
       if (disposed) { disposeScene(gltf.scene); return; }
       const box = new THREE.Box3().setFromObject(gltf.scene), size = box.getSize(new THREE.Vector3());
       const extent = Math.max(size.x, size.y, size.z);
       if (!Number.isFinite(extent) || extent <= 0) { disposeScene(gltf.scene); return; }
       gltf.scene.position.sub(box.getCenter(new THREE.Vector3()));
       const artwork = new THREE.Group(); artwork.add(gltf.scene); artwork.scale.setScalar(config.radius * 2 / extent);
       artwork.traverse((object) => { object.userData.planetId = config.id; });
       disposeScene(model); model.clear(); model.add(artwork); dirty = true;
     }).catch(() => { /* Keep the procedural model if a replacement asset fails. */ });
   }
   const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2();
   const hitAt = (event: PointerEvent) => {
     const rect = canvas.getBoundingClientRect(); pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1); raycaster.setFromCamera(pointer, camera);
     return raycaster.intersectObject(worlds, true).map(hit => hit.object.userData.planetId).find(Boolean) as PlanetId | undefined;
   };
   let down: { x: number; y: number; at: number } | null = null; let multitouch = false; const pointers = new Set<number>();
   const pointerDown = (event: PointerEvent) => { pointers.add(event.pointerId); multitouch = pointers.size > 1; if (pointers.size === 1) down = { x: event.clientX, y: event.clientY, at: performance.now() }; };
   const pointerUp = (event: PointerEvent) => {
     if (down && !multitouch && Math.hypot(event.clientX - down.x, event.clientY - down.y) < 7 && performance.now() - down.at < 700 && event.button === 0) { const id = hitAt(event); if (id && !latest.current.selected) latest.current.onSelect(id); }
     pointers.delete(event.pointerId); if (!pointers.size) { down = null; multitouch = false; }
   };
   const pointerCancel = (event: PointerEvent) => { pointers.delete(event.pointerId); down = null; };
   const pointerMove = (event: PointerEvent) => { if (event.pointerType !== "mouse" || pointers.size) return; hovered = latest.current.selected ? null : hitAt(event) ?? null; canvas.style.cursor = hovered ? "pointer" : "grab"; dirty = true; };
   const keyDown = (event: KeyboardEvent) => { if (/^[0-6]$/.test(event.key) || ["ArrowLeft", "ArrowRight", "Home", "Escape", "Enter"].includes(event.key)) { event.preventDefault(); latest.current.onKey(event.key); } };
   canvas.addEventListener("pointerdown", pointerDown); canvas.addEventListener("pointerup", pointerUp); canvas.addEventListener("pointercancel", pointerCancel); canvas.addEventListener("pointermove", pointerMove); canvas.addEventListener("keydown", keyDown);
   const change = () => { dirty = true; }; controls.addEventListener("change", change);
   const api: UniverseSceneApi = {
     focus(id) { controller.focus(getPlanet(id) ?? null); dirty = true; },
   };
   latest.current.apiRef.current = api;
   const resize = () => {
     const width = container.clientWidth, height = container.clientHeight; if (!width || !height) return;
     const overviewDistance = overviewPosition(width, height, camera.fov).length();
     controls.maxDistance = Math.max(mobile() ? 130 : 85, overviewDistance * 1.4);
     const fogNear = Math.max(90, overviewDistance + 15);
     scene.fog = mobile() ? new THREE.Fog(0x151e28, fogNear, fogNear + 100) : new THREE.Fog(0x151e28, 36, 85);
     renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix(); controller.focus(getPlanet(latest.current.selected) ?? null); dirty = true;
   };
   const observer = new ResizeObserver(resize); observer.observe(container); resize();
   const projection = new THREE.Vector3();
   const destination = new THREE.Vector3();
   const render = (time: number) => {
     if (disposed) return;
     frame = requestAnimationFrame(render);
     if (document.hidden) { previous = time; return; }
     const elapsed = Math.max(0, (time - previous) / 1000);
     const dt = Math.min(.1, elapsed);
     const motionDt = Math.min(.25, elapsed);
     if (compact && time - previous < 1000 / 30) return;
     previous = time;
     const animate = !latest.current.paused && !reducedQuery.matches;
     if (animate) orbitalTime += dt;
     const moving = controller.update(time);
     controls.enabled = !latest.current.selected && !controller.moving;
     if (controls.enabled) controls.update();
     camera.updateMatrixWorld();
     if (latest.current.selected && pilot.setTarget(latest.current.selected)) dirty = true;
     if (animate) {
       if (pilot.update(dt, orbitalTime)) dirty = true;
       for (const flame of flames) flame.scale.y = pilot.velocity.lengthSq() > .05 ? .8 + Math.sin(orbitalTime * 14) * .16 : .4;
     }
     for (const { model, config, pivot, pulse, pulseMaterial } of models) {
       const selected = latest.current.selected === config.id;
       destination.set(...orbitPosition(config, orbitalTime));
       if (pivot.position.distanceToSquared(destination) > .000000001) { pivot.position.copy(destination); dirty = true; }
       if (animate) { model.rotation.y += dt * (config.id === "briefing" ? .035 : .07 + (config.seed % 7) * .007); dirty = true; }
       const scale = !latest.current.selected && hovered === config.id ? 1.035 : 1;
       const nextScale = THREE.MathUtils.damp(model.scale.x, scale, 7, motionDt); if (Math.abs(model.scale.x - nextScale) > .00001) { model.scale.setScalar(nextScale); dirty = true; }
       const visible = latest.current.signals && latest.current.updated.includes(config.id);
       if (pulse.visible !== visible) { pulse.visible = visible; dirty = true; }
       if (visible && animate) { pulseMaterial.opacity = .1 + (Math.sin(time / 2000 + config.seed) + 1) * .035; dirty = true; }
       const label = labels.current.get(config.id);
       if (label && (dirty || moving)) {
         projection.copy(pivot.position).project(camera);
         label.dataset.centerX = String((projection.x + 1) / 2 * container.clientWidth);
         label.dataset.centerY = String((-projection.y + 1) / 2 * container.clientHeight);
         label.dataset.orbitTime = String(orbitalTime);
         label.dataset.spin = String(model.rotation.y);
         label.dataset.worldX = String(pivot.position.x); label.dataset.worldY = String(pivot.position.y); label.dataset.worldZ = String(pivot.position.z);
         label.dataset.cameraDistance = String(camera.position.distanceTo(pivot.position));
         projection.copy(pivot.position); projection.y -= config.radius * 1.2; projection.project(camera);
         const onscreen = !selected && projection.z > -1 && projection.z < 1 && Math.abs(projection.x) < 1.1 && Math.abs(projection.y) < .85;
         label.style.opacity = onscreen ? "1" : "0"; label.style.visibility = onscreen ? "visible" : "hidden";
         label.style.transform = `translate(-50%, 0) translate(${(projection.x + 1) / 2 * container.clientWidth}px, ${(-projection.y + 1) / 2 * container.clientHeight}px)`;
       }
     }
     const marker = shipState.current;
     if (marker && (dirty || moving)) {
       marker.dataset.x = String(craft.position.x); marker.dataset.y = String(craft.position.y); marker.dataset.z = String(craft.position.z);
       marker.dataset.target = pilot.target; marker.dataset.phase = pilot.phase;
     }
     if (dirty || moving) { renderer.render(scene, camera); dirty = false; }
   };
   const reducedChange = () => { controls.enableDamping = !reducedQuery.matches; dirty = true; if (reducedQuery.matches) controller.focus(getPlanet(latest.current.selected) ?? null); };
   reducedQuery.addEventListener("change", reducedChange);
   const contextLost = (event: Event) => { event.preventDefault(); latest.current.onStatus("unavailable"); };
   canvas.addEventListener("webglcontextlost", contextLost);
   renderer.render(scene, camera); frame = requestAnimationFrame(render); latest.current.onStatus("ready");
   return () => {
     disposed = true; cancelAnimationFrame(frame); observer.disconnect(); controller.cancel(); controls.removeEventListener("change", change); controls.dispose(); reducedQuery.removeEventListener("change", reducedChange);
     canvas.removeEventListener("pointerdown", pointerDown); canvas.removeEventListener("pointerup", pointerUp); canvas.removeEventListener("pointercancel", pointerCancel); canvas.removeEventListener("pointermove", pointerMove); canvas.removeEventListener("keydown", keyDown); canvas.removeEventListener("webglcontextlost", contextLost);
     disposeScene(scene); renderer.dispose(); canvas.remove(); if (latest.current.apiRef.current === api) latest.current.apiRef.current = null;
   };
 }, []);
 return <div ref={host} className="universe-canvas" id="universe-scene">{CELESTIAL_BODIES.map((planet, index) => <button key={planet.id} data-world-id={planet.id} ref={(element) => { if (element) labels.current.set(planet.id, element); else labels.current.delete(planet.id); }} tabIndex={props.selected ? -1 : 0} disabled={!!props.selected} className={`world-label ${props.selected === planet.id ? "is-selected" : ""}`} aria-label={`打开${planet.label}`} onClick={() => props.onSelect(planet.id)}><span className="world-label-index">{planet.id === "briefing" ? "☀" : `0${index + 1}`}</span><span>{planet.label}</span><span className="world-label-en">{planet.name}</span></button>)}<span ref={shipState} className="spacecraft-state" hidden aria-hidden="true" /></div>;
}

// src/core/bim/thatopen.ts

import * as THREE from "three";
import * as OBC from "@thatopen/components";

export interface AederaViewerContext {
  components: OBC.Components;
  world: OBC.SimpleWorld<OBC.SimpleScene, OBC.SimpleCamera, OBC.SimpleRenderer>;
}

let viewerContext: AederaViewerContext | null = null;

export function initAederaViewer(container: HTMLDivElement): AederaViewerContext {
  if (viewerContext) return viewerContext;

  const components = new OBC.Components();

  // Worlds
  const worlds = components.get(OBC.Worlds);
  const world = worlds.create<
    OBC.SimpleScene,
    OBC.SimpleCamera,
    OBC.SimpleRenderer
  >();

  // Scene, renderer, camera
  world.scene = new OBC.SimpleScene(components);
  world.renderer = new OBC.SimpleRenderer(components, container);
  world.camera = new OBC.SimpleCamera(components);

  // FragmentsManager + worker locale
  const fragments = components.get(OBC.FragmentsManager);
  const workerUrl = "/thatopen-worker/worker.mjs";
  fragments.init(workerUrl);

  // update fragments quando la camera si ferma
  world.camera.controls.addEventListener("rest", () => {
    fragments.core.update(true);
  });

  // quando un nuovo modello fragments viene aggiunto alla lista,
  // collegalo a camera + scena
  fragments.list.onItemSet.add(({ value: model }) => {
    model.useCamera(world.camera.three);
    world.scene.three.add(model.object);
    fragments.core.update(true);
  });

  // init components (render loop ecc.)
  components.init();

  // griglia
  const grids = components.get(OBC.Grids);
  grids.create(world);

  // luce
  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(10, 20, 10);
  world.scene.three.add(light);

  // setup scena + camera
  (world.scene as OBC.SimpleScene).setup();
  world.camera.controls.setLookAt(3, 3, 3, 0, 0, 0);

  viewerContext = { components, world };
  return viewerContext;
}

export function getAederaViewer(): AederaViewerContext | null {
  return viewerContext;
}

export function destroyAederaViewer(): void {
  if (!viewerContext) return;

  try {
    (viewerContext.components as any).dispose?.();
  } catch {}

  try {
    const rendererAny = viewerContext.world.renderer as any;
    rendererAny?.dispose?.();
  } catch {}

  viewerContext = null;
}

export function resizeAederaViewer(): void {
  const ctx = getAederaViewer();
  if (!ctx) return;

  const renderer = ctx.world.renderer;
  if (!renderer) return;

  const rendererAny = renderer as any;

  // In SimpleRenderer esiste "container" (vedi API) e resize(Vector2?)
  const container: HTMLElement | null =
    rendererAny?.container ??
    rendererAny?.three?.domElement?.parentElement ??
    null;

  if (!container) return;

  const rect = container.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width));
  const h = Math.max(1, Math.floor(rect.height));

  // 1) Resize del renderer (ThatOpen)
  renderer.resize(new THREE.Vector2(w, h));

  // 2) Fix aspect (Three.js) per evitare immagine “stirata”
  // Aggiorna l’aspect in modo coerente con ThatOpen
  if (ctx.world.camera) {
    ctx.world.camera.updateAspect();
  }

  // 3) Forza un update del renderer (se in MANUAL mode o se serve un kick)
  try {
    (ctx.world.renderer as any).update?.();
  } catch {}
}

// DEBUG GLOBAL EXPORTS
import * as ModelProps from "./modelProperties";
import { poEngine } from "../po/poEngine";

(window as any).AED = {
  modelProps: ModelProps,
  po: poEngine,
};


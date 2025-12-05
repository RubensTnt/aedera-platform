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

  // cubo di test
  const material = new THREE.MeshLambertMaterial({ color: 0x6528d7 });
  const geometry = new THREE.BoxGeometry();
  const cube = new THREE.Mesh(geometry, material);
  world.scene.three.add(cube);

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

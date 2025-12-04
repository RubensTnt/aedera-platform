// src/core/bim/thatopen.ts

import * as OBC from "@thatopen/components";
import * as THREE from "three";

export interface AederaViewerContext {
  components: OBC.Components;
  world: OBC.SimpleWorld<OBC.SimpleScene, OBC.SimpleCamera, OBC.SimpleRenderer>;
}

let viewerContext: AederaViewerContext | null = null;

export async function initAederaViewer(
  container: HTMLDivElement,
): Promise<AederaViewerContext> {
  // Evita doppia inizializzazione
  if (viewerContext) return viewerContext;

  const components = new OBC.Components();

  // Worlds manager
  const worlds = components.get(OBC.Worlds);

  // Creiamo un SimpleWorld tipizzato
  const world = worlds.create<
    OBC.SimpleScene,
    OBC.SimpleCamera,
    OBC.SimpleRenderer
  >();
  world.name = "main";

  // Scene
  const sceneComponent = new OBC.SimpleScene(components);
  sceneComponent.setup();
  sceneComponent.three.background = new THREE.Color(0x151515);
  world.scene = sceneComponent;

  // Renderer legato al container React
  const rendererComponent = new OBC.SimpleRenderer(components, container);
  world.renderer = rendererComponent;

  // Camera
  const cameraComponent = new OBC.SimpleCamera(components);
  world.camera = cameraComponent;

  // Griglia
  const grids = components.get(OBC.Grids);
  grids.create(world);

  // Inizializza tutti i componenti registrati
  components.init();

  // Posiziona la camera
  await world.camera.controls.setLookAt(5, 5, 5, 0, 0, 0);

  // Cubo di test
  const cubeMat = new THREE.MeshLambertMaterial({ color: 0x6528d7 });
  const cubeGeom = new THREE.BoxGeometry(1, 1, 1);
  const cube = new THREE.Mesh(cubeGeom, cubeMat);
  world.scene.three.add(cube);

  // Luce base
  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(10, 20, 10);
  world.scene.three.add(light);

  viewerContext = { components, world };
  return viewerContext;
}

export function getAederaViewer(): AederaViewerContext | null {
  return viewerContext;
}

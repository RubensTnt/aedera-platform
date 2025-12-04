// src/core/bim/thatopen.ts

import * as THREE from "three";
import * as OBC from "@thatopen/components";

export interface AederaViewerContext {
  components: OBC.Components;
  world: OBC.SimpleWorld<OBC.SimpleScene, OBC.SimpleCamera, OBC.SimpleRenderer>;
}

let viewerContext: AederaViewerContext | null = null;

export function initAederaViewer(container: HTMLDivElement): AederaViewerContext {
  // Evita di inizializzare più volte se il componente React viene rimontato
  if (viewerContext) return viewerContext;

  const components = new OBC.Components();

  // Manager dei mondi
  const worlds = components.get(OBC.Worlds);

  // Crea il mondo semplice tipizzato (scene+camera+renderer)
  const world = worlds.create<
    OBC.SimpleScene,
    OBC.SimpleCamera,
    OBC.SimpleRenderer
  >();

  // Associa i componenti al mondo (ordine come nell’esempio ufficiale)
  world.scene = new OBC.SimpleScene(components);
  world.renderer = new OBC.SimpleRenderer(components, container);
  world.camera = new OBC.SimpleCamera(components);

  // Avvia il loop di rendering di Components
  components.init();

  // Griglia di riferimento
  const grids = components.get(OBC.Grids);
  grids.create(world);

  // Cubo di test
  const material = new THREE.MeshLambertMaterial({ color: 0x6528d7 });
  const geometry = new THREE.BoxGeometry();
  const cube = new THREE.Mesh(geometry, material);
  world.scene.three.add(cube);

  // Luce base
  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(10, 20, 10);
  world.scene.three.add(light);

  // Setup della scena (come da docs)
  (world.scene as OBC.SimpleScene).setup();

  // Posizioniamo la camera
  world.camera.controls.setLookAt(3, 3, 3, 0, 0, 0);

  viewerContext = { components, world };
  return viewerContext;
}

export function getAederaViewer(): AederaViewerContext | null {
  return viewerContext;
}

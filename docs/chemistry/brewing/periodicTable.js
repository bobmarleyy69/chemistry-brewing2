import { ELEMENTS, CATEGORY_COLORS } from './elementsData.js';

// Tile + grid geometry constants.
const TILE = 0.36;
const CELL = 0.4; // center-to-center spacing (leaves a small gap between tiles)
const COLUMNS = 18;
const ROWS = 10;

// Meshes exposed for click/select detection in main.js.
export const atomMeshes = [];

// Returns 0-based [col, row] for an element in an 18x10 periodic grid.
// Lanthanides and actinides are pulled out into the two bottom rows.
function gridPosition(el) {
  if (el.category === 'lanthanide') {
    return [2 + (el.atomicNumber - 57), 8];
  }
  if (el.category === 'actinide') {
    return [2 + (el.atomicNumber - 89), 9];
  }
  return [el.group - 1, el.period - 1];
}

function cellToLocal(col, row) {
  const x = (col - (COLUMNS - 1) / 2) * CELL;
  const y = ((ROWS - 1) / 2 - row) * CELL;
  return [x, y];
}

function makeTileTexture(el) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = CATEGORY_COLORS[el.category] || '#444';
  ctx.fillRect(0, 0, 128, 128);

  // Atomic number — top-left, 14px white.
  ctx.fillStyle = '#ffffff';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(String(el.atomicNumber), 8, 8);

  // Symbol — centered, 36px bold white.
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(el.symbol, 64, 62);

  // Name — bottom center, 10px #ccc.
  ctx.fillStyle = '#cccccc';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(el.name, 64, 120, 120);

  // Mass — bottom-right, 9px #aaa.
  ctx.fillStyle = '#aaaaaa';
  ctx.font = '9px sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText(String(el.atomicMass), 122, 120);

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  return texture;
}

export function buildPeriodicTable(scene, raycaster, camera) {
  const group = new THREE.Group();
  group.position.set(0, 1.8, -3.2);
  group.rotation.x = -0.12;

  atomMeshes.length = 0;

  const geometry = new THREE.BoxGeometry(TILE, TILE, 0.04);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

  ELEMENTS.forEach((el, index) => {
    const [col, row] = gridPosition(el);
    const [x, y] = cellToLocal(col, row);

    const material = new THREE.MeshBasicMaterial({ map: makeTileTexture(el) });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, 0);
    mesh.userData.element = el;
    mesh.userData.index = index;
    mesh.userData.baseScale = 1;
    mesh.userData.targetScale = 1;

    group.add(mesh);
    atomMeshes.push(mesh);

    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  });

  // Frame around the full table.
  const frameW = (maxX - minX) + TILE + CELL * 0.5;
  const frameH = (maxY - minY) + TILE + CELL * 0.5;
  const frameGeom = new THREE.PlaneGeometry(frameW, frameH);
  const edges = new THREE.EdgesGeometry(frameGeom);
  const frame = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x4fc3f7 }));
  frame.position.set((minX + maxX) / 2, (minY + maxY) / 2, -0.03);
  group.add(frame);

  scene.add(group);

  // Hover handling: track pointer in normalized device coordinates.
  const pointer = new THREE.Vector2(-2, -2);
  window.addEventListener('pointermove', (event) => {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  });

  const clock = new THREE.Clock();

  function update() {
    const dt = clock.getDelta();
    const elapsed = clock.getElapsedTime();

    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(atomMeshes, false);
    const hovered = hits.length > 0 ? hits[0].object : null;

    atomMeshes.forEach((mesh, i) => {
      mesh.userData.targetScale = mesh === hovered ? 1.18 : 1;

      // Smoothly approach the target scale over ~120ms.
      const s = mesh.scale.x;
      const k = Math.min(1, dt / 0.12);
      const ns = s + (mesh.userData.targetScale - s) * k;
      mesh.scale.set(ns, ns, ns);

      // Idle floating bob.
      mesh.position.y += Math.sin(elapsed + i * 0.3) * 0.0008;
    });

    requestAnimationFrame(update);
  }
  update();

  return { group, atomMeshes };
}

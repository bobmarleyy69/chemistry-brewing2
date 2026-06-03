import { CATEGORY_COLORS } from './elementsData.js';

const SHELL_RADII = [0.22, 0.32, 0.44];
const MAX_ATOMS = 6;
const SPAWN_DURATION = 400; // ms, scale 0 -> 1
const DRAG_PLANE_Z = -1.2;
const BOND_DISTANCE = 0.6;

export const liveAtoms = [];
const bonds = [];

function categoryColor(elementData) {
  return new THREE.Color(CATEGORY_COLORS[elementData.category] || '#888888');
}

function makeLabelSprite(symbol) {
  const canvas = document.createElement('canvas');
  canvas.width = 200;
  canvas.height = 80;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 200, 80);
  ctx.font = 'bold 52px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#000000';
  ctx.strokeText(symbol, 100, 42);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(symbol, 100, 42);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.5, 0.2, 1);
  sprite.position.set(0, 0.28, 0);
  return sprite;
}

function disposeAtom(atom, scene) {
  scene.remove(atom.group);
  atom.group.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      materials.forEach((m) => {
        if (m.map) m.map.dispose();
        m.dispose();
      });
    }
  });
  // Remove any bonds attached to this atom.
  for (let i = bonds.length - 1; i >= 0; i--) {
    if (bonds[i].a === atom || bonds[i].b === atom) {
      scene.remove(bonds[i].mesh);
      bonds[i].mesh.geometry.dispose();
      bonds[i].mesh.material.dispose();
      bonds.splice(i, 1);
    }
  }
}

export function spawnAtom(elementData, scene) {
  if (liveAtoms.length >= MAX_ATOMS) {
    const oldest = liveAtoms.shift();
    disposeAtom(oldest, scene);
  }

  const color = categoryColor(elementData);
  const group = new THREE.Group();

  // Nucleus.
  const nucleus = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 16, 16),
    new THREE.MeshStandardMaterial({ color: color.clone(), emissive: color.clone(), emissiveIntensity: 0.3 })
  );
  group.add(nucleus);

  // Electron shells (1 to 3) + electrons.
  const shellCount = Math.min(3, Math.max(1, elementData.period || 1));
  const electrons = [];
  for (let s = 0; s < shellCount; s++) {
    const radius = SHELL_RADII[s];
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.004, 8, 64),
      new THREE.MeshBasicMaterial({ color: 0x4fc3f7, wireframe: true, transparent: true, opacity: 0.5 })
    );
    ring.rotation.x = Math.random() * Math.PI;
    ring.rotation.z = Math.random() * Math.PI;
    group.add(ring);

    const perShell = s + 1;
    for (let e = 0; e < perShell; e++) {
      const electron = new THREE.Mesh(
        new THREE.SphereGeometry(0.03, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0xaee9ff })
      );
      // Parent to the ring so it inherits the random tilt.
      ring.add(electron);
      electrons.push({
        mesh: electron,
        radius,
        angle: (e / perShell) * Math.PI * 2,
        speed: 1.5 + Math.random() * 2,
      });
    }
  }

  const label = makeLabelSprite(elementData.symbol);
  group.add(label);

  group.position.set(Math.random() * 2 - 1, 1.6, DRAG_PLANE_Z);
  group.scale.setScalar(0.0001);

  scene.add(group);

  const atom = {
    group,
    uuid: group.uuid,
    element: elementData,
    nucleus,
    electrons,
    label,
    baseY: group.position.y,
    bobPhase: Math.random() * Math.PI * 2,
    spawnTime: performance.now(),
    dragging: false,
  };
  liveAtoms.push(atom);
  return atom;
}

export function updateAtoms(delta, clock) {
  const now = performance.now();
  const elapsed = clock.getElapsedTime();

  liveAtoms.forEach((atom) => {
    // Spawn scale-in (ease-out cubic).
    const t = Math.min(1, (now - atom.spawnTime) / SPAWN_DURATION);
    const eased = 1 - Math.pow(1 - t, 3);
    atom.group.scale.setScalar(eased);

    // Electron orbits.
    atom.electrons.forEach((el) => {
      el.angle += el.speed * delta;
      el.mesh.position.set(
        Math.cos(el.angle) * el.radius,
        Math.sin(el.angle) * el.radius,
        0
      );
    });

    // Idle bob (skipped while dragging).
    if (!atom.dragging) {
      atom.group.position.y = atom.baseY + Math.sin(elapsed * 2 + atom.bobPhase) * 0.025;
    }
  });

  // Keep bonds attached between their two atoms.
  bonds.forEach((bond) => {
    positionBond(bond);
  });
}

function positionBond(bond) {
  const a = bond.a.group.position;
  const b = bond.b.group.position;
  const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  bond.mesh.position.copy(mid);
  bond.mesh.scale.set(1, Math.max(len, 0.0001), 1);
  bond.mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir.clone().normalize()
  );
}

function createBond(a, b, scene) {
  // Avoid duplicate bonds.
  const exists = bonds.some(
    (bd) => (bd.a === a && bd.b === b) || (bd.a === b && bd.b === a)
  );
  if (exists) return;

  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 1, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 })
  );
  const bond = { a, b, mesh };
  positionBond(bond);
  scene.add(mesh);
  bonds.push(bond);
  console.log(`Bond formed: ${a.element.symbol} – ${b.element.symbol}`);
}

export function initDrag(camera, renderer, scene) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -DRAG_PLANE_Z);
  const hit = new THREE.Vector3();
  let dragged = null;
  let grabOffset = new THREE.Vector3();

  const dom = renderer.domElement;

  function setPointer(event) {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  }

  function atomFromObject(obj) {
    let node = obj;
    while (node) {
      const found = liveAtoms.find((a) => a.group === node);
      if (found) return found;
      node = node.parent;
    }
    return null;
  }

  dom.addEventListener('pointerdown', (event) => {
    setPointer(event);
    raycaster.setFromCamera(pointer, camera);
    const groups = liveAtoms.map((a) => a.group);
    const hits = raycaster.intersectObjects(groups, true);
    if (hits.length === 0) return;

    dragged = atomFromObject(hits[0].object);
    if (!dragged) return;

    dragged.dragging = true;
    if (scene.userData.controls) scene.userData.controls.enabled = false;

    if (raycaster.ray.intersectPlane(dragPlane, hit)) {
      grabOffset.subVectors(dragged.group.position, hit);
    } else {
      grabOffset.set(0, 0, 0);
    }
  });

  dom.addEventListener('pointermove', (event) => {
    if (!dragged) return;
    setPointer(event);
    raycaster.setFromCamera(pointer, camera);
    if (raycaster.ray.intersectPlane(dragPlane, hit)) {
      dragged.group.position.x = hit.x + grabOffset.x;
      dragged.group.position.y = hit.y + grabOffset.y;
      dragged.group.position.z = DRAG_PLANE_Z;
    }
  });

  function endDrag() {
    if (!dragged) return;
    dragged.baseY = dragged.group.position.y;
    dragged.dragging = false;
    // Suppress the click that fires right after grabbing/dragging an atom so it
    // doesn't fall through to a periodic-table tile behind the atom.
    scene.userData.suppressNextClick = true;

    // Proximity check for bonding.
    liveAtoms.forEach((other) => {
      if (other === dragged) return;
      if (dragged.group.position.distanceTo(other.group.position) < BOND_DISTANCE) {
        createBond(dragged, other, scene);
      }
    });

    if (scene.userData.controls) scene.userData.controls.enabled = true;
    dragged = null;
  }

  dom.addEventListener('pointerup', endDrag);
  dom.addEventListener('pointerleave', endDrag);
}

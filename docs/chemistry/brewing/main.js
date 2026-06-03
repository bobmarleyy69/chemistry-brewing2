import { buildPeriodicTable, atomMeshes } from './periodicTable.js';

const container = document.getElementById('vr-container');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.xr.enabled = true;
container.appendChild(renderer.domElement);

document.body.appendChild(THREE.VRButton.createButton(renderer));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0e1a);
scene.fog = new THREE.FogExp2(0x0a0e1a, 0.04);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1.6, 4);

const grid = new THREE.GridHelper(20, 20, 0x1a2a4a, 0x1a2a4a);
grid.position.y = 0;
scene.add(grid);

const ambientLight = new THREE.AmbientLight(0x223366, 0.8);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0x4fc3f7, 1.2);
directionalLight.position.set(5, 8, 3);
scene.add(directionalLight);

const particleCount = 1200;
const positions = new Float32Array(particleCount * 3);
for (let i = 0; i < positions.length; i++) {
  positions[i] = Math.random() * 16 - 8;
}
const particleGeometry = new THREE.BufferGeometry();
particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
const particleMaterial = new THREE.PointsMaterial({ size: 0.015, color: 0x4fc3f7 });
const particles = new THREE.Points(particleGeometry, particleMaterial);
scene.add(particles);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxPolarAngle = Math.PI / 2;

const raycaster = new THREE.Raycaster();
buildPeriodicTable(scene, raycaster, camera);

// Click detection: raycast against the periodic table tiles.
const clickPointer = new THREE.Vector2();
renderer.domElement.addEventListener('click', (event) => {
  clickPointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  clickPointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(clickPointer, camera);
  const hits = raycaster.intersectObjects(atomMeshes, false);
  if (hits.length > 0) {
    const el = hits[0].object.userData.element;
    console.log(`Selected element: ${el.atomicNumber} ${el.symbol} (${el.name})`);
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
  particles.rotation.y += 0.0003;
  controls.update();
  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);

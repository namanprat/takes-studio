import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger.js';

gsap.registerPlugin(ScrollTrigger);

function brev() {
  const container = document.getElementById('model');
  if (!container) {
    console.error("No element with ID 'model' found.");
    return;
  }

  // Scene + camera
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    60,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  );
  
  // Initial camera setup - positioned to look at center, will be adjusted based on scroll
  const initialCameraZ = 30;
  camera.position.set(0, 10, initialCameraZ);
  
  // Mouse parallax
  const mouse = new THREE.Vector2();
  container.addEventListener('mousemove', e => {
    mouse.x = (e.clientX / container.clientWidth) * 2 - 1;
    mouse.y = -(e.clientY / container.clientHeight) * 2 + 1;
  });

  // Renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  container.appendChild(renderer.domElement);

  // HDR environment
  const rgbeLoader = new RGBELoader();
  rgbeLoader.load(
    'https://perception-pod.netlify.app/enviornment.hdr',
    texture => {
      texture.flipY = false;
      const pmrem = new THREE.PMREMGenerator(renderer);
      pmrem.compileEquirectangularShader();
      scene.environment = pmrem.fromEquirectangular(texture).texture;
      texture.dispose();
      pmrem.dispose();
    },
    undefined,
    err => console.error('Failed to load HDR:', err)
  );

  // Helpers to inspect the model
  function listChildrenGroups(obj, depth = 0) {
    const pad = '  '.repeat(depth);
    console.log(`${pad}${obj.name || 'Unnamed'} (${obj.type})`);
    if (obj.type === 'Mesh') {
      console.log(`${pad}  - Geometry: ${obj.geometry.type}`);
      console.log(`${pad}  - Material: ${obj.material.type}`);
      if (obj.material.name) console.log(`${pad}  - Mat name: ${obj.material.name}`);
    }
    obj.children.forEach(c => listChildrenGroups(c, depth + 1));
  }

  function getFlatObjectList(obj, list = []) {
    list.push({ name: obj.name, type: obj.type, uuid: obj.uuid, object: obj });
    obj.children.forEach(c => getFlatObjectList(c, list));
    return list;
  }

  // Camera focus and zoom variables
  let modelCenter = new THREE.Vector3(0, 0, 0);
  let currentLookAtY = 0; // Will be updated based on scroll

  // Load GLTF
  let model;

  new GLTFLoader().load(
    'https://perception-pod.netlify.app/test.glb',
    gltf => {
      model = gltf.scene;

      // Inspect structure
      console.log('=== MODEL STRUCTURE ===');
      listChildrenGroups(model);

      // Flat list & find meshes
      const flat = getFlatObjectList(model);
      console.log('Meshes:', flat.filter(o => o.type === 'Mesh').map(o => o.name));

      // find crust/mantle/core
      let crustMesh, mantleMesh, outerCoreMesh;
      model.traverse(c => {
        if (c.type === 'Mesh') {
          if (c.name === 'Crust') crustMesh = c;
          if (c.name === 'Mantle') mantleMesh = c;
          if (c.name === 'OuterCore') outerCoreMesh = c;
        }
      });
      console.log('Found:', {
        Crust: !!crustMesh,
        Mantle: !!mantleMesh,
        OuterCore: !!outerCoreMesh
      });

      // Get model center for camera targeting
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      modelCenter = box.getCenter(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const desiredSize = 5;
      const finalScale = (desiredSize / maxDim) * 1.2;

      // Calculate 50vh offset - this will be our initial look-at point
      const viewportHeight = window.innerHeight;
      const initialYOffset = (viewportHeight * 0.5) / 100; // Convert 50vh to world units (approximate)
      
      // Set initial camera look-at point (50vh from top)
      currentLookAtY = modelCenter.y + initialYOffset;
      camera.lookAt(modelCenter.x, currentLookAtY, modelCenter.z);

      // explosion offsets
      const explosionSpacing = maxDim * 0.8;
      const offsets = {
        crust: new THREE.Vector3(0, explosionSpacing * 0.8, 0),
        mantle: new THREE.Vector3(0, 0, 0),
        outerCore: new THREE.Vector3(0, -explosionSpacing * 0.8, 0)
      };

      // store originals
      const originals = {};
      if (crustMesh) originals.crust = crustMesh.position.clone();
      if (mantleMesh) originals.mantle = mantleMesh.position.clone();
      if (outerCoreMesh) originals.outerCore = outerCoreMesh.position.clone();

      // initial transform (entry state)
      model.scale.set(0.1, 0.1, 0.1);
      model.position.copy(modelCenter);
      model.rotation.x = Math.PI * 0.15;

      scene.add(model);

      // entrance animation
      const crustScale = finalScale * 3.0;
      gsap.timeline({ defaults: { duration: 3, ease: 'power4.inOut' } })
        .to(model.scale, { delay: 1, x: crustScale, y: crustScale, z: crustScale }, 0);

      // scroll-triggered animation with new camera logic
      ScrollTrigger.create({
        trigger: '.webgl_contain', // Target the webgl_contain element
        start: 'top top',
        end: 'bottom bottom',
        scrub: 1,
        onUpdate: self => {
          const p = self.progress;
          const half = 0.5;
          
          // Camera zoom and centering logic
          // Start at initialCameraZ, zoom out by 30% at the end
          const zoomOutFactor = 0.3;
          const finalCameraZ = initialCameraZ * (1 + zoomOutFactor);
          camera.position.z = initialCameraZ + (finalCameraZ - initialCameraZ) * p;
          
          // Gradually center the camera look-at point
          const targetLookAtY = modelCenter.y + (initialYOffset * (1 - p));
          currentLookAtY = targetLookAtY;
          
          // Keep camera centered on X and Z
          camera.position.x = modelCenter.x;
          camera.position.y = modelCenter.y;
          
          if (p <= half) {
            const t = p / half;
            model.rotation.y = t * Math.PI * 0.5;
            const cs = crustScale + (finalScale - crustScale) * t;
            model.scale.set(cs, cs, cs);
            model.position.lerpVectors(modelCenter, new THREE.Vector3(0,0,0), t);
            [crustMesh, mantleMesh, outerCoreMesh].forEach((m, i) => {
              if (m) m.position.copy(originals[['crust','mantle','outerCore'][i]]);
            });
          } else {
            const t = (p - half) / half;
            model.rotation.x = Math.PI * 0.15 * (1 - t * 0.5);
            model.rotation.y = Math.PI * 0.5;
            model.scale.set(finalScale, finalScale, finalScale);
            ['crust','mantle','outerCore'].forEach(key => {
              const mesh = { crust: crustMesh, mantle: mantleMesh, outerCore: outerCoreMesh }[key];
              if (!mesh) return;
              const ease = 1 - Math.pow(1 - t, 3);
              mesh.position.copy(originals[key].clone().addScaledVector(offsets[key], ease));
            });
          }
        }
      });

    },
    undefined,
    err => console.error('GLTF load error:', err)
  );

  // render + parallax
  function animate() {
    requestAnimationFrame(animate);
    
    // Apply subtle mouse parallax only on X axis
    const parallaxStrength = 2; // Reduced for more subtle effect
    const targetX = modelCenter.x + mouse.x * parallaxStrength;
    camera.position.x += (targetX - camera.position.x) * 0.05;
    
    // Always look at the current target point
    camera.lookAt(modelCenter.x, currentLookAtY, modelCenter.z);
    
    renderer.render(scene, camera);
  }
  animate();

  // handle resize
  window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
    ScrollTrigger.refresh();
  });
}

export default brev;
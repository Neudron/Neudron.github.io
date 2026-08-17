/* ═══════════════════════════════════════════════════════════════════
   neu — the glass.

   One transmissive mesh. Exactly one, and that is a hard rule: every
   mesh with transmission > 0 forces a full extra render of the scene
   to compute its refracted background, so a second piece of glass
   costs a third of your frame rate.

   The mark is real letterforms — glyph outlines exported as SVG path
   data in Y-UP space. SVGLoader only parses numbers, so authoring the
   paths already in three's coordinate system sidesteps the usual
   mirror-flip; the common fix for that (scale(1,-1,1)) inverts the
   winding order and turns every face inside out.
   ═══════════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { SVGLoader }          from 'three/addons/loaders/SVGLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment }    from 'three/addons/environments/RoomEnvironment.js';

const PATHS = {"chancery": "M0.164 0.019 0.223 0.254 0.248 0.27C0.341 0.328 0.352 0.334 0.366 0.334C0.372 0.334 0.376 0.329 0.376 0.321C0.376 0.305 0.369 0.276 0.339 0.154C0.317 0.066 0.313 0.048 0.313 0.029C0.313 0.015 0.317 0.003 0.328 -0.016C0.373 0.004 0.443 0.048 0.513 0.1L0.52 0.128C0.423 0.072 0.416 0.069 0.406 0.069C0.396 0.069 0.39 0.079 0.39 0.096C0.39 0.123 0.394 0.14 0.438 0.299C0.463 0.388 0.463 0.388 0.463 0.394C0.463 0.405 0.456 0.411 0.444 0.411C0.422 0.411 0.419 0.409 0.311 0.343C0.271 0.318 0.245 0.302 0.233 0.294C0.243 0.329 0.257 0.39 0.257 0.398C0.257 0.406 0.252 0.411 0.244 0.411C0.233 0.411 0.165 0.376 0.087 0.33L0.081 0.304C0.145 0.333 0.149 0.334 0.158 0.334C0.165 0.334 0.17 0.328 0.17 0.32C0.17 0.298 0.152 0.218 0.126 0.125L0.103 0.044C0.101 0.037 0.096 0.018 0.089 -0.01Z M0.84 0.137C0.76 0.069 0.717 0.044 0.679 0.044C0.653 0.044 0.633 0.061 0.626 0.087C0.622 0.103 0.621 0.114 0.621 0.143C0.667 0.172 0.695 0.192 0.754 0.236C0.809 0.277 0.829 0.31 0.829 0.355C0.829 0.39 0.808 0.411 0.772 0.411C0.75 0.411 0.735 0.406 0.711 0.393C0.673 0.371 0.639 0.344 0.619 0.32C0.581 0.274 0.547 0.164 0.547 0.083C0.547 0.024 0.578 -0.013 0.629 -0.013C0.688 -0.013 0.764 0.031 0.839 0.108ZM0.624 0.179C0.641 0.287 0.686 0.369 0.73 0.369C0.746 0.369 0.757 0.353 0.757 0.328C0.757 0.278 0.728 0.246 0.624 0.179Z M1.13 0.132C1.054 0.08 1.019 0.059 1.006 0.059C0.995 0.059 0.987 0.073 0.987 0.092C0.987 0.115 0.995 0.155 1.012 0.219C1.022 0.257 1.032 0.295 1.033 0.301C1.042 0.339 1.049 0.364 1.051 0.371C1.054 0.382 1.056 0.392 1.056 0.398C1.056 0.406 1.051 0.411 1.044 0.411C1.034 0.411 0.962 0.372 0.889 0.327L0.882 0.3C0.925 0.322 0.943 0.329 0.955 0.329C0.963 0.329 0.969 0.322 0.969 0.31C0.969 0.296 0.96 0.257 0.941 0.186C0.916 0.092 0.91 0.065 0.91 0.036C0.91 0.008 0.922 -0.013 0.938 -0.013C0.953 -0.013 0.97 -0.004 1.021 0.029C1.099 0.079 1.099 0.079 1.124 0.096C1.115 0.062 1.11 0.028 1.11 0.01C1.11 -0.004 1.117 -0.013 1.128 -0.013C1.148 -0.013 1.242 0.042 1.311 0.094L1.318 0.124C1.247 0.082 1.214 0.064 1.203 0.064C1.196 0.064 1.192 0.071 1.192 0.088C1.192 0.139 1.228 0.287 1.272 0.415C1.259 0.408 1.25 0.403 1.246 0.401C1.234 0.395 1.222 0.389 1.209 0.384C1.206 0.382 1.2 0.379 1.189 0.373C1.182 0.348 1.166 0.281 1.14 0.172Z","bookman": "M0.249 0.367C0.325 0.425 0.376 0.448 0.43 0.448C0.472 0.448 0.499 0.425 0.499 0.389C0.499 0.38 0.497 0.368 0.495 0.354C0.492 0.341 0.49 0.332 0.49 0.329L0.461 0.172C0.452 0.122 0.45 0.106 0.45 0.086C0.45 0.032 0.489 -0.009 0.543 -0.009C0.591 -0.009 0.637 0.015 0.673 0.059L0.653 0.081C0.624 0.052 0.61 0.043 0.591 0.043C0.564 0.043 0.543 0.068 0.543 0.099C0.543 0.113 0.544 0.123 0.55 0.154L0.58 0.318C0.592 0.38 0.592 0.38 0.592 0.401C0.592 0.459 0.545 0.495 0.468 0.495C0.4 0.495 0.339 0.471 0.258 0.414L0.271 0.486H0.233C0.176 0.473 0.161 0.47 0.093 0.464L0.088 0.435L0.1 0.433C0.143 0.426 0.158 0.412 0.158 0.383C0.158 0.373 0.157 0.367 0.156 0.358L0.091 0H0.183Z M1.121 0.114C1.034 0.065 0.992 0.051 0.931 0.051C0.841 0.051 0.794 0.096 0.794 0.182C0.794 0.194 0.795 0.203 0.799 0.218C0.9 0.224 0.961 0.232 1.025 0.248C1.134 0.276 1.195 0.326 1.195 0.387C1.195 0.449 1.125 0.495 1.031 0.495C0.849 0.495 0.685 0.345 0.685 0.178C0.685 0.071 0.777 -0.009 0.901 -0.009C0.98 -0.009 1.065 0.024 1.147 0.087ZM0.806 0.255C0.826 0.319 0.843 0.352 0.876 0.39C0.917 0.436 0.961 0.458 1.011 0.458C1.062 0.458 1.098 0.428 1.098 0.386C1.098 0.346 1.067 0.311 1.013 0.289C0.966 0.27 0.873 0.255 0.806 0.255Z M1.767 0.486H1.675L1.609 0.123C1.528 0.064 1.48 0.043 1.425 0.043C1.387 0.043 1.364 0.066 1.364 0.104C1.364 0.114 1.365 0.119 1.369 0.143L1.431 0.486H1.393C1.336 0.473 1.321 0.47 1.253 0.464L1.248 0.435L1.26 0.433C1.303 0.426 1.318 0.412 1.318 0.382C1.318 0.372 1.318 0.367 1.316 0.358L1.277 0.144C1.273 0.121 1.271 0.101 1.271 0.084C1.271 0.025 1.312 -0.009 1.383 -0.009C1.432 -0.009 1.473 0.002 1.522 0.028C1.557 0.047 1.584 0.066 1.602 0.083C1.61 0.025 1.648 -0.009 1.705 -0.009C1.755 -0.009 1.804 0.017 1.846 0.066L1.823 0.087C1.803 0.061 1.774 0.043 1.751 0.043C1.722 0.043 1.7 0.068 1.7 0.103C1.7 0.112 1.7 0.112 1.708 0.159Z","palatino": "M0.024 0.388 0.031 0.368 0.063 0.389C0.102 0.414 0.103 0.414 0.11 0.414C0.121 0.414 0.128 0.404 0.128 0.389C0.128 0.337 0.087 0.146 0.046 0.002L0.053 -0.009C0.078 -0.002 0.101 0.004 0.123 0.008C0.142 0.134 0.163 0.199 0.209 0.269C0.264 0.352 0.338 0.414 0.383 0.414C0.394 0.414 0.4 0.406 0.4 0.39C0.4 0.371 0.397 0.352 0.389 0.319L0.337 0.107C0.328 0.069 0.324 0.047 0.324 0.031C0.324 0.006 0.335 -0.009 0.354 -0.009C0.379 -0.009 0.418 0.014 0.514 0.085L0.504 0.103L0.478 0.086C0.448 0.066 0.427 0.056 0.417 0.056C0.41 0.056 0.404 0.065 0.404 0.076C0.404 0.082 0.405 0.091 0.406 0.096L0.472 0.372C0.479 0.402 0.483 0.428 0.483 0.446C0.483 0.469 0.472 0.482 0.452 0.482C0.41 0.482 0.341 0.444 0.282 0.389C0.244 0.354 0.216 0.32 0.164 0.247L0.202 0.408C0.206 0.427 0.208 0.438 0.208 0.449C0.208 0.471 0.2 0.482 0.185 0.482C0.164 0.482 0.126 0.461 0.052 0.408Z M0.884 0.111 0.86 0.094C0.807 0.056 0.759 0.036 0.723 0.036C0.675 0.036 0.647 0.073 0.647 0.134C0.647 0.16 0.649 0.185 0.655 0.214L0.737 0.234C0.754 0.238 0.781 0.248 0.806 0.259C0.89 0.296 0.93 0.342 0.93 0.404C0.93 0.451 0.897 0.482 0.846 0.482C0.781 0.482 0.67 0.413 0.631 0.349C0.601 0.299 0.571 0.181 0.571 0.113C0.571 0.036 0.614 -0.011 0.686 -0.011C0.744 -0.011 0.798 0.016 0.892 0.092ZM0.669 0.274C0.686 0.343 0.706 0.386 0.735 0.412C0.753 0.428 0.784 0.44 0.808 0.44C0.837 0.44 0.856 0.42 0.856 0.389C0.856 0.344 0.821 0.297 0.769 0.272C0.741 0.259 0.703 0.246 0.66 0.237Z M1.278 0.097C1.271 0.072 1.267 0.047 1.267 0.031C1.267 0.006 1.278 -0.009 1.297 -0.009C1.322 -0.009 1.361 0.013 1.457 0.085L1.447 0.103L1.421 0.086C1.396 0.07 1.372 0.059 1.36 0.059C1.352 0.059 1.347 0.066 1.347 0.076C1.347 0.084 1.348 0.094 1.352 0.11L1.353 0.116C1.376 0.227 1.407 0.357 1.437 0.473L1.43 0.482L1.362 0.465L1.352 0.414C1.337 0.336 1.312 0.268 1.281 0.221C1.221 0.129 1.145 0.059 1.104 0.059C1.095 0.059 1.091 0.068 1.091 0.085C1.091 0.1 1.092 0.111 1.098 0.137L1.155 0.408C1.158 0.424 1.16 0.438 1.16 0.451C1.16 0.471 1.152 0.482 1.138 0.482C1.117 0.482 1.079 0.461 1.005 0.408L0.977 0.388L0.984 0.368L1.016 0.389C1.044 0.407 1.055 0.412 1.064 0.412C1.074 0.412 1.081 0.403 1.081 0.392C1.081 0.387 1.08 0.379 1.079 0.374L1.016 0.077C1.014 0.067 1.012 0.045 1.012 0.03C1.012 0.007 1.027 -0.011 1.047 -0.011C1.111 -0.011 1.231 0.101 1.315 0.239Z"};

/* Which letterforms. 'palatino' | 'bookman' | 'chancery'
   bookman is the roundest and reads warmest; chancery is the most
   ornate; palatino sits between them. */
const MARK = 'palatino';

const NEU    = window.NEU || { fireReady() {}, heroT: 1 };
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = document.getElementById('glassCanvas');
const stage  = document.getElementById('glassStage');

if (canvas) init();

function init() {

  /* ── renderer ─────────────────────────────────────────────────── */
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, alpha: true, powerPreference: 'high-performance'
    });
  } catch (err) {
    // No WebGL. Set the mark in type instead and let the page carry on.
    // stays aria-hidden: the <h1> already carries "neu" for assistive tech
    if (stage) {
      stage.innerHTML = '<div class="nogl"><b>neu</b></div>';
      stage.style.opacity = '1';
    }
    NEU.fireReady();
    return;
  }

  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearAlpha(0);

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0, 7.4);

  /* Radius of the sphere that contains the shell however it is turned.
     The box is 2.15 with 0.52 corner rounding, so the corner sphere sits
     at sqrt(3)*0.555 from the middle plus its own radius. Fitting to a
     sphere rather than to the box is the point: the box's silhouette
     changes as you drag it, a sphere's does not. */
  const FIT_RADIUS = 1.5;

  /* ── environment ──────────────────────────────────────────────────
     Transmission renders whatever is behind the object. With nothing
     behind it there is nothing to refract and the glass reads as grey
     plastic — this is the single most common reason it looks wrong.
     RoomEnvironment is generated in code, so no HDR download, and
     environmentIntensity dims the studio down to something funereal. */
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room  = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, 0.04).texture;
  scene.environmentIntensity = 0.35;
  room.dispose();
  pmrem.dispose();   // the generator's scratch targets are dead weight now

  /* ── backdrop ─────────────────────────────────────────────────────
     The starfield, used as the thing the glass bends.

     stars.js already paints a full-viewport canvas sitting behind the
     page. Rather than duplicating that as a second gradient in here,
     the same canvas becomes the backdrop texture — so the glass
     refracts the actual stars, and the pixels visibly warp and split
     as you turn it. Everything outside the object's silhouette lines
     up with the DOM canvas behind, which is what makes the illusion
     hold: it reads as one continuous sky with a lens in front of it.

     NearestFilter on both ends, because smoothing pixel art defeats
     the entire point of pixel art. */
  const STARS = window.NEU && window.NEU.stars;
  const BACKDROP_Z = -7;

  let backdropTex = null;
  let backdrop = null;
  let starVersion = -1;

  if (STARS && STARS.canvas) {
    backdropTex = new THREE.CanvasTexture(STARS.canvas);
    backdropTex.colorSpace = THREE.SRGBColorSpace;
    backdropTex.minFilter = THREE.NearestFilter;
    backdropTex.magFilter = THREE.NearestFilter;
    backdropTex.generateMipmaps = false;

    backdrop = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: backdropTex, depthWrite: false, toneMapped: false })
    );
    backdrop.position.z = BACKDROP_Z;
    backdrop.renderOrder = -1;
    scene.add(backdrop);
  }

  /* Scale the plane to exactly fill the frustum at its depth, so the
     texture maps 1:1 onto the viewport and matches the DOM canvas. */
  function fitBackdrop() {
    if (!backdrop) return;
    const dist = camera.position.z - BACKDROP_Z;
    const height = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * dist;
    backdrop.scale.set(height * camera.aspect, height, 1);
  }

  /* ── the etch ─────────────────────────────────────────────────────
     Real etched glass is rougher where it was blasted. roughnessMap
     multiplies material.roughness, so a bright mark on a dark field
     frosts the letters and leaves the rest of the surface near-mirror. */
  const ec = document.createElement('canvas');
  ec.width = ec.height = 1024;
  const ex = ec.getContext('2d');

  function paintEtch() {
    ex.fillStyle = '#0d0d0d';
    ex.fillRect(0, 0, 1024, 1024);
    ex.fillStyle = '#ffffff';
    ex.font = '700 160px "Determination Sans", "Determination Mono", "Pixelify Sans", monospace';
    ex.textAlign = 'center';
    ex.textBaseline = 'middle';
    ex.fillText('neu', 512, 512);
    if (etchTex) etchTex.needsUpdate = true;
  }

  let etchTex = null;
  paintEtch();
  etchTex = new THREE.CanvasTexture(ec);

  /* This canvas is painted at module time, before the webfont has
     arrived, so the first pass silently falls back to Georgia. Repaint
     once the real face is available or the etched mark never matches
     the headings. */
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(paintEtch, () => {});
  }

  /* ── materials ────────────────────────────────────────────────── */
  const glass = new THREE.MeshPhysicalMaterial({
    transmission: 1,
    thickness: 1.8,
    ior: 1.62,
    roughness: 0.42,        // multiplied down by the etch map
    roughnessMap: etchTex,
    dispersion: 0.6,        // realistic range is [0,1]
    color: new THREE.Color(0.06, 0.06, 0.075),
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    opacity: 1,
    transparent: false
  });

  const markMat = new THREE.MeshStandardMaterial({
    color: 0x0a0a10, roughness: 0.34, metalness: 0.1
  });

  /* ── geometry ─────────────────────────────────────────────────── */
  const root  = new THREE.Group();
  const inner = new THREE.Group();
  root.add(inner);
  scene.add(root);

  const shell = new THREE.Mesh(
    new RoundedBoxGeometry(2.15, 2.15, 2.15, 8, 0.52),
    glass
  );
  root.add(shell);

  const markPath = PATHS[MARK] || PATHS.palatino;
  if (!PATHS[MARK]) console.warn(`[neu] unknown MARK "${MARK}" — using palatino`);

  const doc = new SVGLoader().parse(
    `<svg xmlns="http://www.w3.org/2000/svg"><path d="${markPath}"/></svg>`
  );
  let shapes = [];
  for (const p of doc.paths) shapes = shapes.concat(p.toShapes(true));

  const markGeo = new THREE.ExtrudeGeometry(shapes, {
    depth: 0.18,
    curveSegments: 6,
    bevelEnabled: true,
    bevelThickness: 0.013,
    bevelSize: 0.009,
    bevelSegments: 3
  });
  markGeo.center();
  markGeo.computeBoundingBox();
  const w = markGeo.boundingBox.max.x - markGeo.boundingBox.min.x;
  markGeo.scale(1.18 / w, 1.18 / w, 1);

  inner.add(new THREE.Mesh(markGeo, markMat));

  /* ── the door, on the right face ──────────────────────────────────
     Added to `root` rather than `inner` so it turns with the shell and
     stays welded to the +X face. The half-extent of a 2.15 box is
     1.075, so 1.078 floats it a hair proud of the surface — inside
     that and it z-fights with the glass, much further out and it
     visibly detaches when you turn the cube edge-on.

     Sitting outside the shell also means a raycast reaches it without
     having to punch through a transmissive material, which is what
     makes the hit test cheap: it tests this group alone, not the
     scene. */
  const door = new THREE.Group();
  const doorMat = new THREE.MeshStandardMaterial({
    color: 0x14141c, roughness: 0.5, metalness: 0.4
  });
  door.add(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.64, 0.05), doorMat));

  const holeMat = new THREE.MeshStandardMaterial({
    color: 0xc9a227, roughness: 0.35, metalness: 0.75, emissive: 0x241b06
  });
  const hole = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.10, 0.07), holeMat);
  hole.position.set(0.13, 0, 0.005);
  door.add(hole);

  door.position.set(1.078, 0, 0);
  door.rotation.y = Math.PI / 2;          // local +Z now points along world +X
  root.add(door);

  /* Only clickable when it is actually pointing at you. Without this
     you could open it through the back of the cube, and the whole
     point is that you have to turn the thing around to find it. */
  const _ray = new THREE.Raycaster();
  const _ndc = new THREE.Vector2();
  const _dir = new THREE.Vector3(), _pos = new THREE.Vector3();

  function doorFacesCamera() {
    door.getWorldDirection(_dir);         // local +Z in world space = outward
    door.getWorldPosition(_pos);
    _pos.sub(camera.position).normalize();
    return _dir.dot(_pos) < -0.15;
  }
  function hitDoor(e) {
    if (!doorFacesCamera()) return false;
    const r = canvas.getBoundingClientRect();
    _ndc.x =  ((e.clientX - r.left) / r.width)  * 2 - 1;
    _ndc.y = -((e.clientY - r.top)  / r.height) * 2 + 1;
    _ray.setFromCamera(_ndc, camera);
    return _ray.intersectObject(door, true).length > 0;
  }
  NEU.doorGlow = function (on) {
    holeMat.emissive.setHex(on ? 0x6b5010 : 0x241b06);
  };

  /* Where the door is ON SCREEN, so sans.js can tell whether a thrown
     key actually hit it. Returns null when there is nothing to hit —
     the hero scrolled away, or the door is facing into the page — which
     means the throw has to be aimed at a door you can actually see.

     `.project(camera)` gives normalised device coords; mapping those
     through the canvas rect converts to page pixels, which is the same
     space the key's physics runs in. */
  const _proj = new THREE.Vector3();
  NEU.doorScreenPos = function () {
    if (NEU.heroT < 0.25) return null;         // cube has faded out
    if (!doorFacesCamera()) return null;
    door.getWorldPosition(_proj);
    _proj.project(camera);
    const r = canvas.getBoundingClientRect();
    return {
      x: r.left + ( _proj.x * 0.5 + 0.5) * r.width,
      y: r.top  + (-_proj.y * 0.5 + 0.5) * r.height,
      r: Math.max(30, r.height * 0.10)
    };
  };

  /* ── lights toggle ────────────────────────────────────────────── */
  NEU.setLights = function (on) {
    scene.environmentIntensity = on ? 1.15 : 0.35;
    renderer.toneMappingExposure = on ? 1.15 : 1.0;
    glass.color.setRGB(on ? 0.16 : 0.06, on ? 0.16 : 0.06, on ? 0.19 : 0.075);
    markMat.color.setHex(on ? 0x1a1a24 : 0x0a0a10);
    if (STARS && STARS.setLit) STARS.setLit(on);
  };

  /* ── interaction ──────────────────────────────────────────────────
     Not OrbitControls. A drag with friction, then an underdamped
     spring home, so the object always returns to dead front and can
     never end up facing away. The overshoot is where the cute lives. */
  let spinY = 0, spinX = 0, velY = 0, velX = 0;
  let dragging = false, dragged = false, lastX = 0, lastY = 0;
  let leanX = 0, leanY = 0, leanTX = 0, leanTY = 0;
  let squash = 0;

  const K = 60, C = 9;   // damping ratio ≈ 0.58 → one soft overshoot

  canvas.addEventListener('pointerdown', e => {
    if (NEU.heroT < 0.25) return;
    dragging = true; dragged = false;
    lastX = e.clientX; lastY = e.clientY;
    canvas.classList.add('dragging');
    canvas.setPointerCapture?.(e.pointerId);
  });

  canvas.addEventListener('pointermove', e => {
    const r = canvas.getBoundingClientRect();
    leanTX = ((e.clientY - r.top) / r.height * 2 - 1) * 0.05;
    leanTY = ((e.clientX - r.left) / r.width * 2 - 1) * 0.05;
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    if (Math.abs(dx) + Math.abs(dy) > 4) dragged = true;
    velY += dx * 0.020;
    velX += dy * 0.014;
    lastX = e.clientX; lastY = e.clientY;
  });

  function endDrag() { dragging = false; canvas.classList.remove('dragging'); }
  canvas.addEventListener('pointerup', e => {
    /* A click that wasn't a drag either opens the door or squashes the
       cube — never both, or every attempt at the door would also boing
       the thing you are trying to unlock. */
    if (!dragged) {
      if (hitDoor(e) && NEU.tryDoor) NEU.tryDoor();
      else squash = 1;
    }
    endDrag();
  });
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointerleave', () => { endDrag(); leanTX = leanTY = 0; });

  /* ── size ─────────────────────────────────────────────────────── */
  /* Pull the camera back until the bounding sphere clears BOTH axes.
     A fixed distance works on a wide screen and fails on a tall one:
     the vertical field of view is the one that is fixed, so as the
     viewport narrows the horizontal field shrinks with the aspect and
     the object runs off the sides. At 1080x1920 it was covering 90% of
     the visible width at rest — and rotating it swung the corners
     straight off the screen. */
  function fitCamera() {
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    const need = Math.max(
      FIT_RADIUS / Math.sin(vFov / 2),
      FIT_RADIUS / Math.sin(hFov / 2)
    );
    camera.position.z = need * 1.22;      // margin, so it is framed not crammed
    camera.updateProjectionMatrix();
  }

  function resize() {
    const w2 = innerWidth, h2 = innerHeight;
    renderer.setSize(w2, h2, false);
    camera.aspect = w2 / h2;
    camera.fov = w2 < 720 ? 44 : 32;
    fitCamera();
    fitBackdrop();
  }
  addEventListener('resize', resize, { passive: true });
  resize();

  /* ── loop ─────────────────────────────────────────────────────────
     Rendered only while the hero is on screen and the tab is visible.
     A transmissive material is expensive enough that leaving it
     running behind the rest of the page is a real battery cost. */
  let visible = !document.hidden;
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; });

  const clock = new THREE.Clock();

  function tick() {
    requestAnimationFrame(tick);

    const t = NEU.heroT;
    if (!visible || t < 0.02) return;

    const dt = Math.min(clock.getDelta(), 1 / 30);

    if (backdropTex && STARS && STARS.version !== starVersion) {
      starVersion = STARS.version;
      backdropTex.needsUpdate = true;
    }

    if (reduce) {
      root.rotation.set(0, 0, 0);
    } else {
      if (dragging) { velY *= 0.86; velX *= 0.86; }
      else {
        velY += (-K * spinY - C * velY) * dt;
        velX += (-K * spinX - C * velX) * dt;
      }
      spinY += velY * dt;
      spinX += velX * dt;
      spinX = Math.max(-0.62, Math.min(0.62, spinX));

      leanX += (leanTX - leanX) * Math.min(1, dt * 5);
      leanY += (leanTY - leanY) * Math.min(1, dt * 5);

      /* scroll turns it away and lets it sink, so leaving the hero
         reads as the object receding rather than a layer fading */
      const gone = 1 - t;
      root.rotation.y = spinY + leanY + gone * 0.55;
      root.rotation.x = spinX + leanX - gone * 0.30;
      root.position.y = -gone * 0.9;

      if (squash > 0) {
        squash = Math.max(0, squash - dt * 5.2);
        const s = 1 - 0.045 * Math.sin(squash * Math.PI);
        root.scale.setScalar(s);
      } else if (root.scale.x !== 1) {
        root.scale.setScalar(1);
      }
    }

    renderer.render(scene, camera);
  }

  /* ── diagnostics ─────────────────────────────────────────────────
     Add ?debug to the URL to get the real numbers on screen. After two
     failed guesses at why the object is not visible on a tall viewport,
     measuring beats inferring. */
  if (location.search.indexOf('debug') !== -1) {
    const dbg = document.createElement('pre');
    dbg.style.cssText = 'position:fixed;left:8px;top:8px;z-index:99;margin:0;padding:10px;' +
      'background:#000c;color:#B892FF;font:12px/1.5 ui-monospace,monospace;' +
      'white-space:pre;pointer-events:none;border:1px solid #B892FF';
    document.body.appendChild(dbg);

    const sphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), FIT_RADIUS);
    const frustum = new THREE.Frustum();

    setInterval(function () {
      camera.updateMatrixWorld();
      frustum.setFromProjectionMatrix(
        new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      const vh = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.position.z;
      const glassEl = document.getElementById('glassStage');
      dbg.textContent =
        'viewport   ' + innerWidth + ' x ' + innerHeight + '  (aspect ' + camera.aspect.toFixed(3) + ')\n' +
        'orientation' + (innerHeight > innerWidth ? ' PORTRAIT' : ' landscape') + '\n' +
        'fov        ' + camera.fov + '\n' +
        'camera z   ' + camera.position.z.toFixed(2) + '\n' +
        'view WxH   ' + (vh * camera.aspect).toFixed(2) + ' x ' + vh.toFixed(2) + '\n' +
        'object     ' + (2 * FIT_RADIUS).toFixed(2) + ' across\n' +
        'in frustum ' + frustum.intersectsSphere(sphere) + '\n' +
        'canvas     ' + canvas.width + ' x ' + canvas.height + '\n' +
        'renderer   ' + (renderer.getContext() ? 'webgl ok' : 'NO CONTEXT') + '\n' +
        'heroT      ' + (NEU.heroT === undefined ? '-' : NEU.heroT.toFixed(3)) + '\n' +
        'glass op   ' + (glassEl ? (glassEl.style.opacity || 'unset') : 'no element') + '\n' +
        'body class ' + document.body.className + '\n' +
        'drawcalls  ' + renderer.info.render.calls + '  tris ' + renderer.info.render.triangles;
    }, 250);
  }

  tick();

  /* Released on the frame after the first render — not from inside the
     loop, which early-returns when the hero is off screen. A visitor
     landing on a restored scroll position must not be trapped behind
     the boot overlay waiting for a render that never runs. */
  requestAnimationFrame(() => NEU.fireReady());
}

import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import {
  DEFAULTS,
  fromHash,
  toHash,
  metrics,
  PRESETS,
  normalize,
} from "./state.js";
import { CameraRig } from "./rig.js";

const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
let state = fromHash(location.hash),
  rig,
  selected = "body",
  playing = false,
  tourTime = 0;
const inspected = new Set(),
  viewport = $("#viewport");
const descriptions = {
  body: [
    "An idea, made tangible.",
    "An AI-generated exterior meets an articulated mechanical core. Explore how appearance and movement come together.",
    "HYBRID 3D ASSET · PINK / GOLD",
  ],
  zoom: [
    "One turn. A different frame.",
    "The zoom ring rotates 55° while two internal lens groups slide along the optical axis. Try X-ray to see the coupled motion.",
    "2 LENS GROUPS · 6 / 10 MM TRAVEL",
  ],
  focus: [
    "Precision beneath the surface.",
    "The focus ring rotates 80° and drives the third lens group through 5 mm of travel. The motion is illustrative, not optically calibrated.",
    "1 LENS GROUP · 5 MM TRAVEL",
  ],
  iris: [
    "Nine blades. One opening.",
    "Nine individually pivoted blades rotate together to narrow the aperture. Look straight into the lens and move the aperture slider.",
    "9 PIVOTS · 65° ROTATION",
  ],
  glass: [
    "The hidden choreography.",
    "Three lens groups translate along the optical axis. Explode the assembly to reveal their order, then move zoom and focus independently.",
    "3 TRANSLATING GROUPS · LOCAL-AXIS RIG",
  ],
};
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("#toast").classList.remove("show"), 2800);
}
function saveState() {
  history.replaceState(
    null,
    "",
    `${location.pathname}${location.search}#${toHash(state)}`,
  );
}
function updateUI() {
  const m = metrics(state);
  for (const k of ["zoom", "focus", "aperture", "explode"]) {
    $("#" + k).value = state[k];
    $("#" + k).style.setProperty("--progress", `${state[k] * 100}%`);
  }
  $("#zoom-value").innerHTML = `${Math.round(m.focal)}<span>mm</span>`;
  $("#focus-value").innerHTML =
    `${Math.round(state.focus * 100)}<span>%</span>`;
  $("#aperture-value").textContent = `ƒ/${m.fNumber.toFixed(1)}`;
  $("#explode-value").innerHTML =
    `${Math.round(state.explode * 100)}<span>%</span>`;
  $("#fov").innerHTML = `${m.fieldOfView.toFixed(1)}<span>°</span>`;
  $("#light").innerHTML = `${Math.round(m.light * 100)}<span>%</span>`;
  $("#light-bar").style.width = `${m.light * 100}%`;
  const half = 17 * (24 / m.focal);
  $("#fov-cone").setAttribute(
    "d",
    `M10 18 L135 ${18 - half} L135 ${18 + half} Z`,
  );
  $$("[data-mode]").forEach((b) => {
    b.classList.toggle("selected", b.dataset.mode === state.mode);
    b.setAttribute("aria-pressed", String(b.dataset.mode === state.mode));
  });
  $$("[data-view]").forEach((b) => {
    b.classList.toggle("selected", b.dataset.view === state.view);
    b.setAttribute("aria-pressed", String(b.dataset.view === state.view));
  });
  $$("[data-part]").forEach((b) => {
    b.classList.toggle("active", b.dataset.part === selected);
    b.setAttribute("aria-pressed", String(b.dataset.part === selected));
  });
  $("#explored").innerHTML = `${inspected.size}<span>/ 5</span>`;
  $$("#explore-dots i").forEach((e, i) =>
    e.classList.toggle("done", i < inspected.size),
  );
}
function apply() {
  rig?.apply(state);
  updateUI();
}
function selectPart(part) {
  selected = part;
  inspected.add(part);
  const [title, description, spec] = descriptions[part];
  $("#part-title").textContent = title;
  $("#part-description").textContent = description;
  $("#part-spec").textContent = spec;
  rig?.appearance(state.mode, selected);
  updateUI();
}
function stopTour() {
  playing = false;
  $("#tour").classList.remove("playing");
  $("#tour").innerHTML = "▷ <span>Play the mechanism</span>";
  $("#tour").setAttribute("aria-pressed", "false");
}

let renderer, scene, camera, controls;
try {
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  viewport.appendChild(renderer.domElement);
  scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8b877a, 2));
  const key = new THREE.DirectionalLight(0xfff3e8, 2.4);
  key.position.set(0.5, 0.9, 0.8);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 1.1);
  fill.position.set(-0.4, 0.1, -0.5);
  scene.add(fill);
  camera = new THREE.PerspectiveCamera(38, 1, 0.001, 10);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 0.14;
  controls.maxDistance = 0.9;
  controls.enablePan = false;
  controls.addEventListener("start", () => stopTour());
  function resize() {
    const w = viewport.clientWidth,
      h = viewport.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(viewport);
  resize();
  renderer.domElement.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    $("#loading").classList.remove("hidden");
    $("#loading strong").textContent = "Graphics connection interrupted";
    $("#load-progress").textContent = "Reload this page to restore the camera.";
  });
  new GLTFLoader().load(
    `${import.meta.env.BASE_URL}models/camera.glb`,
    (g) => {
      try {
        rig = new CameraRig(g.scene);
        scene.add(g.scene);
        apply();
        rig.appearance(state.mode, selected);
        $("#loading").classList.add("hidden");
        $("#model-status").textContent = "LIVE 3D";
        document.body.dataset.ready = "true";
      } catch (e) {
        showError(e);
      }
    },
    (ev) => {
      if (ev.total)
        $("#load-progress").textContent =
          `${Math.round((100 * ev.loaded) / ev.total)}% · Loading original 3D asset`;
    },
    showError,
  );
} catch (e) {
  showError(e);
}
function showError(e) {
  $("#loading").classList.remove("hidden");
  $("#loading strong").textContent = "The camera could not load";
  $("#load-progress").textContent =
    "Please reload in a browser with WebGL enabled.";
  $("#model-status").textContent = "LOAD ERROR";
  console.error(e);
}
const views = {
  hero: { p: [0.3, 0.17, 0.33], t: [-0.01, 0.018, 0] },
  front: { p: [0.5, 0.022, 0], t: [0, 0.022, 0] },
  side: { p: [0.01, 0.09, 0.49], t: [0.01, 0.022, 0] },
  rear: { p: [-0.43, 0.14, 0.17], t: [-0.035, 0.018, 0] },
};
function setView(view) {
  state.view = view;
  const v = views[view];
  if (camera && controls) {
    const target = new THREE.Vector3(...v.t);
    target.x += state.explode * 0.025;
    camera.position
      .set(...v.p)
      .sub(new THREE.Vector3(...v.t))
      .multiplyScalar(1 + state.explode * 0.65)
      .add(target);
    controls.target.copy(target);
    controls.update();
  }
  updateUI();
}
setView(state.view);
for (const k of ["zoom", "focus", "aperture", "explode"]) {
  $("#" + k).addEventListener("input", (e) => {
    stopTour();
    state[k] = Number(e.target.value);
    if (k === "explode") setView(state.view);
    $$("[data-preset]").forEach((b) => b.classList.remove("active"));
    selectPart(k === "aperture" ? "iris" : k === "explode" ? "glass" : k);
    apply();
    saveState();
  });
}
$$("[data-part]").forEach((b) =>
  b.addEventListener("click", () => {
    stopTour();
    selectPart(b.dataset.part);
    if (selected === "iris") {
      setView("front");
    }
    if (selected === "glass" || selected === "iris") {
      state.mode = "xray";
      rig?.appearance(state.mode, selected);
      updateUI();
    }
    saveState();
  }),
);
$$("[data-mode]").forEach((b) =>
  b.addEventListener("click", () => {
    state.mode = b.dataset.mode;
    rig?.appearance(state.mode, selected);
    updateUI();
    saveState();
  }),
);
$$("[data-view]").forEach((b) =>
  b.addEventListener("click", () => {
    stopTour();
    setView(b.dataset.view);
    saveState();
  }),
);
$$("[data-preset]").forEach((b) =>
  b.addEventListener("click", () => {
    stopTour();
    Object.assign(state, PRESETS[b.dataset.preset]);
    $$("[data-preset]").forEach((x) => x.classList.toggle("active", x === b));
    selectPart("zoom");
    apply();
    saveState();
  }),
);
$("#reset").addEventListener("click", () => {
  stopTour();
  state = { ...DEFAULTS };
  selected = "body";
  setView("hero");
  selectPart("body");
  rig?.appearance("solid", "body");
  $$("[data-preset]").forEach((b) => b.classList.remove("active"));
  apply();
  saveState();
  toast("Camera reset to its resting position");
});
$("#share").addEventListener("click", async () => {
  saveState();
  try {
    await navigator.clipboard.writeText(location.href);
    toast("Setup link copied — every setting is included");
  } catch {
    toast("Your setup is saved in the address bar. Copy the URL to share.");
  }
});
$("#snapshot").addEventListener("click", () => {
  if (!rig || !renderer) return toast("Please wait for the camera to load");
  renderer.render(scene, camera);
  const a = document.createElement("a");
  a.download = "iris-camera.png";
  a.href = renderer.domElement.toDataURL("image/png");
  a.click();
  toast("Your camera view has been saved");
});
$("#about-link").addEventListener("click", (e) => {
  e.preventDefault();
  $("#about").scrollIntoView({
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "instant"
      : "smooth",
  });
});
$("#tour").addEventListener("click", () => {
  if (playing) {
    stopTour();
    saveState();
    return;
  }
  if (!rig) return toast("Please wait for the camera to load");
  playing = true;
  tourTime = 0;
  state.mode = "xray";
  state.explode = 0.18;
  setView("hero");
  rig.appearance(state.mode, selected);
  $("#tour").classList.add("playing");
  $("#tour").innerHTML = "Ⅱ <span>Pause the mechanism</span>";
  $("#tour").setAttribute("aria-pressed", "true");
});
window.addEventListener("hashchange", () => {
  stopTour();
  state = fromHash(location.hash);
  setView(state.view);
  rig?.appearance(state.mode, selected);
  apply();
});
const raycaster = new THREE.Raycaster();
let pointerStart;
viewport.addEventListener(
  "pointerdown",
  (e) => (pointerStart = [e.clientX, e.clientY]),
);
viewport.addEventListener("pointerup", (e) => {
  if (
    !rig ||
    !pointerStart ||
    Math.hypot(e.clientX - pointerStart[0], e.clientY - pointerStart[1]) > 5
  )
    return;
  const r = viewport.getBoundingClientRect();
  raycaster.setFromCamera(
    new THREE.Vector2(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      (-(e.clientY - r.top) / r.height) * 2 + 1,
    ),
    camera,
  );
  const hit = raycaster.intersectObjects(rig.meshes, false)[0];
  if (hit) selectPart(hit.object.userData.part);
});
let previous = performance.now(),
  lastSegment = -1;
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, (now - previous) / 1000);
  previous = now;
  if (!renderer) return;
  if (playing && rig) {
    tourTime = (tourTime + dt) % 15;
    const segment = Math.floor(tourTime / 5),
      u = (tourTime % 5) / 5,
      amount = (1 - Math.cos(u * Math.PI * 2)) / 2;
    const k = ["zoom", "focus", "aperture"][segment];
    state.zoom = 0;
    state.focus = 0;
    state.aperture = 0;
    state[k] = amount;
    if (segment !== lastSegment) {
      lastSegment = segment;
      selectPart(k === "aperture" ? "iris" : k);
    }
    apply();
  }
  controls?.update();
  renderer.render(scene, camera);
}
updateUI();
requestAnimationFrame(animate);
// Small read-only observability surface for reproducible rig checks.
Object.defineProperty(window, "irisLab", {
  value: {
    get state() {
      return { ...state };
    },
    get ready() {
      return !!rig;
    },
    get joints() {
      return rig
        ? Object.fromEntries(
            Object.entries(rig.nodes).map(([k, n]) => [
              k,
              {
                position: n.position.toArray(),
                quaternion: n.quaternion.toArray(),
              },
            ]),
          )
        : {};
    },
    get irisCount() {
      return rig?.iris.length ?? 0;
    },
  },
});

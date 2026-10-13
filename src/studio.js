import "./studio.css";
import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { MotionRig, bindByNames, inspectGLB } from "./motion.js";
import { bicycle, gripper, catalog } from "./assets.js";
import { saveProject, listProjects, getProject } from "./storage.js";
if (new URLSearchParams(location.hash.slice(1)).has("zoom"))
  location.replace(new URL("camera.html" + location.hash, location.href).href);
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
let rig,
  wrapper,
  assetId = "camera",
  assetName = "",
  assetBuffer = null,
  fingerprint = "",
  selectedId = null,
  editing = -1,
  mode = "solid",
  playing = false,
  time = 0,
  requestId = 0,
  currentProject = null;
const status = $("#status");
const drawings = {
  camera:
    '<rect x="13" y="20" width="55" height="37" rx="7" fill="#dcb9bc"/><path d="M25 20v-7h20l6 7" fill="#dcb9bc"/><rect x="51" y="27" width="41" height="28" rx="8" fill="#ba939b"/><ellipse cx="88" cy="41" rx="10" ry="15" fill="#dfc2a1"/><ellipse cx="89" cy="41" rx="7" ry="11" fill="#59655a"/>',
  bicycle:
    '<g fill="none" stroke-width="2"><circle cx="23" cy="48" r="18" stroke="#718071"/><circle cx="81" cy="48" r="18" stroke="#718071"/><path d="M23 48l14-29 15 29H23l40-28 18 28M37 19h26M33 15h15M63 20l-2-9h10" stroke="#d08251"/></g>',
  gripper:
    '<rect x="30" y="44" width="44" height="17" rx="4" fill="#667975"/><rect x="24" y="34" width="56" height="17" rx="3" fill="#8fa99e"/><path d="M29 34V13h10v22M65 34V13h10v22" fill="#9aa5a0"/><path d="M34 13h10v11H34M60 13h10v11H60" fill="#4d5d52"/>',
};
for (const c of catalog) {
  const b = document.createElement("button");
  b.className = "asset-card";
  b.dataset.asset = c.id;
  b.innerHTML = `<svg viewBox="0 0 108 76" aria-hidden="true">${drawings[c.id]}</svg><div><span class="card-tag">${c.tag}</span><strong>${c.name}</strong><small>${c.subtitle}</small></div><span class="card-number">${c.number}</span>`;
  b.onclick = () => loadAsset(c.id);
  $("#asset-cards").append(b);
}
function toast(s) {
  $("#toast").textContent = s;
  $("#toast").classList.add("show");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => $("#toast").classList.remove("show"), 3500);
}
function fail(e) {
  toast(e.message || String(e));
}
const viewport = $("#viewport"),
  scene = new T.Scene();
let renderer, camera, controls;
try {
  renderer = new T.WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  viewport.append(renderer.domElement);
  camera = new T.PerspectiveCamera(38, 1, 0.01, 100);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.minDistance = 0.5;
  controls.maxDistance = 15;
  const p = new T.PMREMGenerator(renderer);
  scene.environment = p.fromScene(new RoomEnvironment(), 0.04).texture;
  p.dispose();
  scene.add(new T.HemisphereLight(0xffffff, 0x829078, 2));
  const key = new T.DirectionalLight(0xffffff, 2);
  key.position.set(3, 5, 4);
  scene.add(key);
  new ResizeObserver(() => {
    renderer.setSize(viewport.clientWidth, viewport.clientHeight);
    camera.aspect = viewport.clientWidth / viewport.clientHeight;
    camera.updateProjectionMatrix();
  }).observe(viewport);
} catch (e) {
  $("#loading").textContent =
    "WebGL is unavailable. Please use a browser with hardware acceleration.";
  throw e;
}
const boxHelper = new T.Box3Helper(new T.Box3(), 0xc97745);
boxHelper.visible = false;
scene.add(boxHelper);
const axisHelper = new T.AxesHelper(0.35);
axisHelper.visible = false;
scene.add(axisHelper);
function stop() {
  playing = false;
  $("#play").textContent = "▷ Play all";
  $("#play").setAttribute("aria-pressed", "false");
}
function dispose() {
  if (!wrapper) return;
  scene.remove(wrapper);
  wrapper.traverse((n) => {
    n.geometry?.dispose();
    if (n.material)
      for (const m of [].concat(n.material)) {
        for (const v of Object.values(m)) if (v?.isTexture) v.dispose();
        m.dispose();
      }
  });
}
function fit() {
  if (!wrapper) return;
  const box = new T.Box3().setFromObject(wrapper),
    center = box.getCenter(new T.Vector3()),
    size = box.getSize(new T.Vector3());
  const distance =
    (Math.max(size.x, size.y, size.z) * (assetId === "camera" ? 1.8 : 2.25)) /
    Math.min(1, camera.aspect);
  controls.target.copy(center);
  const dir =
    assetId === "camera"
      ? new T.Vector3(1, 0.55, 1.1)
      : new T.Vector3(1, 0.65, 1.8);
  camera.position.copy(center).add(dir.normalize().multiplyScalar(distance));
  controls.update();
}
function appearance() {
  rig?.root.traverse((n) => {
    if (!n.isMesh) return;
    for (const m of [].concat(n.material)) {
      const r = m.userData.restStyle;
      m.wireframe = mode === "wire";
      m.transparent = mode === "xray" || r.transparent;
      m.opacity = mode === "xray" ? 0.25 : r.opacity;
      m.depthWrite = mode === "xray" ? false : r.depthWrite;
      m.needsUpdate = true;
    }
  });
  $$("[data-mode]").forEach((b) => {
    b.classList.toggle("active", b.dataset.mode === mode);
    b.setAttribute("aria-pressed", String(b.dataset.mode === mode));
  });
}
function install(root, specs, config) {
  const nextRig = new MotionRig(root);
  nextRig.configure(config ?? bindByNames(nextRig, specs));
  const box = new T.Box3().setFromObject(root),
    size = box.getSize(new T.Vector3()),
    center = box.getCenter(new T.Vector3()),
    extent = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(extent) || extent <= 0)
    throw Error("The GLB does not contain visible geometry.");
  dispose();
  rig = nextRig;
  wrapper = new T.Group();
  wrapper.add(root);
  wrapper.scale.setScalar(2.6 / extent);
  wrapper.position.copy(center).multiplyScalar(-2.6 / extent);
  scene.add(wrapper);
  root.traverse((n) => {
    if (n.isMesh) {
      n.material = [].concat(n.material).map((m) => {
        const c = m.clone();
        c.userData.restStyle = {
          opacity: c.opacity,
          transparent: c.transparent,
          depthWrite: c.depthWrite,
        };
        return c;
      });
      if (n.material.length === 1) n.material = n.material[0];
    }
  });
  selectedId = null;
  editing = -1;
  boxHelper.visible = false;
  axisHelper.visible = false;
  $("#motion-form").reset();
  $("#editor").disabled = true;
  $("#remove-motion").hidden = true;
  $("#selected-name").textContent = "Choose a part";
  $("#selection-help").textContent =
    "Pick a component on the left to add or edit its motion.";
  $("#form-error").textContent = "";
  $("#search").value = "";
  $("#asset-name").textContent = assetName;
  $("#asset-type").textContent =
    assetId === "camera"
      ? "HYBRID AI ASSET"
      : assetId === "imported"
        ? "YOUR LOCAL GLB"
        : "PROCEDURAL DEMONSTRATION";
  $("#project-name").value = `My ${assetName.toLowerCase()} exploration`;
  $("#node-count").textContent = `${rig.nodes.size} SCENE NODES`;
  status.textContent = "READY TO EXPLORE";
  $("#loading").hidden = true;
  document.body.dataset.ready = "true";
  $$("[data-asset]").forEach((b) => {
    b.classList.toggle("active", b.dataset.asset === assetId);
    b.setAttribute("aria-pressed", String(b.dataset.asset === assetId));
  });
  $("#asset-tip").textContent =
    assetId === "camera"
      ? "Pick a DOF group to edit its existing motion. The Camera deep dive has coupled optical controls."
      : assetId === "bicycle"
        ? "Turn the wheels, steer the front assembly, then edit the pedal crank."
        : assetId === "gripper"
          ? "Both fingers move along their own local X axis; the left axis faces the opposite direction."
          : "Select a named mesh or group. Models without separate parts move as one object.";
  renderTree();
  renderMotions();
  appearance();
  fit();
}
const cameraSpecs = [
  {
    name: "Zoom ring",
    names: ["DOF_zoom__r"],
    type: "rotate",
    axis: "y",
    min: 0,
    max: 55,
  },
  {
    name: "Focus ring",
    names: ["DOF_focus__r"],
    type: "rotate",
    axis: "y",
    min: 0,
    max: 80,
  },
  {
    name: "Nine-blade iris",
    names: Array.from({ length: 9 }, (_, i) => `DOF_iris_0${i}__r`),
    type: "rotate",
    axis: "y",
    min: 0,
    max: 65,
  },
  ...["g1", "g2", "g3"].map((g, i) => ({
    name: `Lens group ${i + 1}`,
    names: [`DOF_${g}__t`],
    type: "slide",
    axis: "y",
    min: i === 2 ? -0.005 : 0,
    max: [0.006, 0.01, 0][i],
  })),
];
async function loadAsset(id, options = {}) {
  const previousAsset = {
    assetId,
    assetName,
    assetBuffer,
    fingerprint,
    currentProject,
  };
  const ticket = ++requestId;
  stop();
  $("#loading").hidden = false;
  $("#loading").textContent = "Preparing your object…";
  status.textContent = "LOADING";
  try {
    let root,
      specs,
      buffer = options.buffer ?? null,
      hash = "builtin:" + id;
    if (id === "camera" || id === "imported") {
      buffer =
        buffer ??
        (await fetch(`${import.meta.env.BASE_URL}models/camera.glb`).then(
          (r) => {
            if (!r.ok) throw Error("Could not download the camera asset.");
            return r.arrayBuffer();
          },
        ));
      inspectGLB(buffer);
      if (id === "imported")
        hash = Array.from(
          new Uint8Array(await crypto.subtle.digest("SHA-256", buffer)),
        )
          .map((v) => v.toString(16).padStart(2, "0"))
          .join("");
      const gltf = await new GLTFLoader().parseAsync(buffer, "");
      root = gltf.scene;
      specs = id === "camera" ? cameraSpecs : [];
    } else ({ root, specs } = id === "bicycle" ? bicycle() : gripper());
    if (ticket !== requestId) return;
    assetId = id;
    assetName =
      options.name ??
      catalog.find((c) => c.id === id)?.name ??
      "Imported model";
    assetBuffer = id === "imported" ? buffer : null;
    fingerprint = hash;
    currentProject = options.projectId ?? null;
    mode = "solid";
    install(root, specs, options.config);
    if (options.projectName) $("#project-name").value = options.projectName;
  } catch (e) {
    if (ticket !== requestId) return;
    ({ assetId, assetName, assetBuffer, fingerprint, currentProject } =
      previousAsset);
    $("#loading").hidden = !!rig;
    $("#loading").textContent = e.message;
    status.textContent = rig ? "PREVIOUS MODEL RETAINED" : "LOAD ERROR";
    fail(e);
  }
}
function renderTree() {
  const filter = $("#search").value.toLowerCase();
  $("#tree").replaceChildren();
  for (const [id, n] of rig.nodes) {
    if (!n.name && !n.isMesh) continue;
    const name = n.name || "Unnamed mesh";
    if (!name.toLowerCase().includes(filter)) continue;
    let depth = 0,
      p = n.parent;
    while (p && p !== rig.root) {
      depth++;
      p = p.parent;
    }
    const b = document.createElement("button");
    b.className = "tree-node";
    b.dataset.node = id;
    b.style.paddingLeft = `${6 + Math.min(depth, 4) * 9}px`;
    b.title = name;
    b.textContent = (n.isMesh ? "◇ " : "▧ ") + name;
    b.classList.toggle("active", id === selectedId);
    b.setAttribute("aria-pressed", String(id === selectedId));
    b.onclick = () => select(id);
    $("#tree").append(b);
  }
}
function select(id) {
  if (!rig.nodes.has(id)) return;
  selectedId = id;
  const n = rig.nodes.get(id);
  editing = rig.channels.findIndex((c) => c.targets.includes(id));
  const c = rig.channels[editing] ?? {
    name: n.name || "New motion",
    type: "rotate",
    axis: "y",
    min: 0,
    max: 90,
    pivot: [0, 0, 0],
  };
  $("#editor").disabled = false;
  $("#selected-name").textContent = n.name || "Unnamed part";
  $("#selection-help").textContent =
    editing >= 0
      ? `Editing ${c.targets.length > 1 ? c.targets.length + " linked parts" : "this part"}; changes update the existing control.`
      : "This part has no motion. Define one below.";
  $("#motion-name").value = c.name;
  $("#motion-type").value = c.type;
  $("#motion-axis").value = c.axis;
  $("#motion-min").value = c.min;
  $("#motion-max").value = c.max;
  ["x", "y", "z"].forEach((k, i) => ($("#pivot-" + k).value = c.pivot[i]));
  $("#remove-motion").hidden = editing < 0;
  $("#form-error").textContent = "";
  units();
  renderTree();
  boxHelper.visible = true;
}
function units() {
  $$(".unit").forEach(
    (e) =>
      (e.textContent =
        $("#motion-type").value === "rotate" ? "(degrees)" : "(model units)"),
  );
}
function renderMotions() {
  const container = $("#motion-controls");
  container.replaceChildren();
  $("#motion-count").textContent = rig.channels.length;
  $("#empty-motion").hidden = !!rig.channels.length;
  rig.channels.forEach((c, i) => {
    const div = document.createElement("div");
    div.className = "motion-control";
    const label = document.createElement("label");
    label.htmlFor = "channel-" + i;
    label.append(document.createTextNode(c.name));
    const out = document.createElement("output");
    out.id = "output-" + i;
    label.append(out);
    const input = document.createElement("input");
    input.type = "range";
    input.min = 0;
    input.max = 1;
    input.step = 0.001;
    input.value = c.value;
    input.id = "channel-" + i;
    input.addEventListener("input", () => {
      stop();
      c.value = Number(input.value);
      rig.apply();
      updateOutputs();
    });
    const small = document.createElement("small");
    small.textContent = `${c.type === "rotate" ? "ROTATE" : "TRANSLATE"} · LOCAL ${c.axis.toUpperCase()} · ${c.targets.length} PART${c.targets.length > 1 ? "S" : ""}`;
    div.append(label, input, small);
    container.append(div);
  });
  updateOutputs();
}
function updateOutputs() {
  rig.channels.forEach((c, i) => {
    const v = c.min + (c.max - c.min) * c.value;
    $("#output-" + i).textContent =
      c.type === "rotate" ? `${v.toFixed(1)}°` : v.toFixed(4);
    $("#channel-" + i).value = c.value;
  });
}
$("#motion-form").onsubmit = (e) => {
  e.preventDefault();
  if (!selectedId) return;
  try {
    stop();
    const config = rig.export(),
      c = {
        name: $("#motion-name").value,
        type: $("#motion-type").value,
        axis: $("#motion-axis").value,
        min: Number($("#motion-min").value),
        max: Number($("#motion-max").value),
        pivot: ["x", "y", "z"].map((k) => Number($("#pivot-" + k).value)),
        targets: editing >= 0 ? config.channels[editing].targets : [selectedId],
        value: 0,
      };
    if (editing >= 0) config.channels[editing] = c;
    else config.channels.push(c);
    rig.configure(config);
    renderMotions();
    select(selectedId);
    toast("Motion applied. Try its slider below.");
  } catch (e) {
    $("#form-error").textContent = e.message;
  }
};
$("#remove-motion").onclick = () => {
  stop();
  if (editing < 0) return;
  const config = rig.export();
  config.channels.splice(editing, 1);
  rig.configure(config);
  renderMotions();
  select(selectedId);
};
$("#motion-type").onchange = units;
$("#search").oninput = () => rig && renderTree();
$("#fit").onclick = fit;
$$("[data-mode]").forEach(
  (b) =>
    (b.onclick = () => {
      mode = b.dataset.mode;
      appearance();
    }),
);
$("#reset").onclick = () => {
  stop();
  rig?.channels.forEach(
    (c) => (c.value = Math.min(1, Math.max(0, -c.min / (c.max - c.min)))),
  );
  rig?.apply();
  updateOutputs();
};
$("#play").onclick = () => {
  if (!rig?.channels.length) return toast("Add a motion first.");
  if (playing) return stop();
  playing = true;
  time = 0;
  $("#play").textContent = "Ⅱ Pause";
  $("#play").setAttribute("aria-pressed", "true");
};
function download(blob, name) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$("#snapshot").onclick = () => {
  if (!rig) return;
  renderer.render(scene, camera);
  renderer.domElement.toBlob((b) => b && download(b, "iris-motion-studio.png"));
};
for (const id of ["import-top", "import-card"])
  $("#" + id).onclick = () => $("#model-file").click();
$("#model-file").onchange = async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  if (file.size > 40 * 1024 * 1024)
    return toast("Choose a GLB smaller than 40 MB.");
  try {
    const buffer = await file.arrayBuffer();
    inspectGLB(buffer);
    await loadAsset("imported", {
      buffer,
      name: file.name.replace(/\.glb$/i, ""),
    });
  } catch (e) {
    fail(e);
  }
};
$("#export-config").onclick = () => {
  if (!rig) return;
  download(
    new Blob(
      [
        JSON.stringify(
          {
            ...rig.export(),
            asset: { id: assetId, name: assetName, fingerprint },
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    ),
    "iris-motion-recipe.json",
  );
};
$("#import-config").onclick = () => $("#config-file").click();
$("#config-file").onchange = async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    if (!rig) throw Error("Load a model first.");
    if (file.size > 1024 * 1024)
      throw Error("Recipe files must be smaller than 1 MB.");
    const config = JSON.parse(await file.text());
    if (config.asset?.fingerprint !== fingerprint)
      throw Error(
        "This recipe belongs to a different model. Load the matching asset first.",
      );
    stop();
    rig.configure(config);
    renderMotions();
    if (selectedId) select(selectedId);
    toast("Motion recipe restored.");
  } catch (e) {
    fail(e);
  }
};
async function refreshSaved() {
  try {
    const projects = await listProjects();
    $("#saved-projects").replaceChildren();
    if (!projects.length)
      $("#saved-projects").textContent = "No saved projects yet.";
    for (const p of projects.sort((a, b) => b.updated - a.updated)) {
      const b = document.createElement("button");
      b.dataset.project = p.id;
      b.textContent = p.name;
      const small = document.createElement("small");
      small.textContent = `${p.assetName} · ${p.config.channels.length} motions`;
      b.append(small);
      b.onclick = async () => {
        try {
          const saved = await getProject(p.id);
          await loadAsset(saved.assetId, {
            buffer: saved.buffer,
            name: saved.assetName,
            config: saved.config,
            projectId: saved.id,
            projectName: saved.name,
          });
        } catch (e) {
          fail(e);
        }
      };
      $("#saved-projects").append(b);
    }
  } catch {
    $("#saved-projects").textContent =
      "Local saving is unavailable in this browser. Use recipe export instead.";
  }
}
$("#save-project").onclick = async () => {
  if (!rig) return;
  try {
    const name = $("#project-name").value.trim();
    if (!name) throw Error("Give your project a name.");
    currentProject ??= crypto.randomUUID();
    await saveProject({
      id: currentProject,
      name,
      assetId,
      assetName,
      buffer: assetBuffer,
      config: rig.export(),
      updated: Date.now(),
    });
    await refreshSaved();
    toast("Saved locally, including your imported model.");
  } catch (e) {
    fail(e);
  }
};
const raycaster = new T.Raycaster();
let start;
viewport.onpointerdown = (e) => (start = [e.clientX, e.clientY]);
viewport.onpointerup = (e) => {
  if (
    !rig ||
    !start ||
    Math.hypot(e.clientX - start[0], e.clientY - start[1]) > 5
  )
    return;
  const r = viewport.getBoundingClientRect();
  raycaster.setFromCamera(
    new T.Vector2(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      (-(e.clientY - r.top) / r.height) * 2 + 1,
    ),
    camera,
  );
  const hit = raycaster
    .intersectObject(rig.root, true)
    .find((h) => h.object.isMesh);
  if (hit) {
    let n = hit.object;
    while (
      n.parent &&
      n.parent !== rig.root &&
      !rig.channels.some((c) => c.targets.includes(n.userData.motionId))
    ) {
      if (
        rig.channels.some((c) => c.targets.includes(n.parent.userData.motionId))
      )
        n = n.parent;
      else break;
    }
    select(n.userData.motionId);
  }
};
let last = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (playing && rig) {
    time += dt;
    for (const c of rig.channels) c.value = (1 - Math.cos(time * 1.2)) / 2;
    rig.apply();
    updateOutputs();
  }
  if (selectedId && rig?.nodes.has(selectedId)) {
    boxHelper.box.setFromObject(rig.nodes.get(selectedId));
    boxHelper.visible = !boxHelper.box.isEmpty();
    const node = rig.nodes.get(selectedId);
    axisHelper.position.copy(
      node.localToWorld(
        new T.Vector3(
          ...(rig.channels.find((c) => c.targets.includes(selectedId))
            ?.pivot ?? [0, 0, 0]),
        ),
      ),
    );
    node.getWorldQuaternion(axisHelper.quaternion);
    axisHelper.visible = true;
  }
  controls.update();
  renderer.render(scene, camera);
}
requestAnimationFrame(animate);
Object.defineProperty(window, "irisStudio", {
  value: {
    get ready() {
      return !!rig && $("#loading").hidden;
    },
    get asset() {
      return assetId;
    },
    get config() {
      return rig?.export();
    },
    get transforms() {
      return rig
        ? [...rig.nodes].map(([id, n]) => ({
            id,
            name: n.name,
            p: n.position.toArray(),
            q: n.quaternion.toArray(),
          }))
        : [];
    },
  },
});
loadAsset("camera");
refreshSaved();

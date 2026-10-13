import * as THREE from "three";
export const axes = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
};
export function indexNodes(root) {
  const nodes = new Map();
  let i = 0;
  root.traverse((n) => {
    const id = `n${i++}`;
    n.userData.motionId = id;
    nodes.set(id, n);
  });
  return nodes;
}
export function validateConfig(input, nodes) {
  if (
    !input ||
    input.version !== 1 ||
    !Array.isArray(input.channels) ||
    input.channels.length > 100
  )
    throw Error("Invalid IRIS configuration (version 1 required).");
  const used = new Set();
  return {
    version: 1,
    channels: input.channels.map((c, i) => {
      if (
        !c ||
        !["rotate", "slide"].includes(c.type) ||
        !axes[c.axis] ||
        !Array.isArray(c.targets) ||
        !c.targets.length ||
        c.targets.length > 100
      )
        throw Error(`Invalid motion ${i + 1}.`);
      for (const id of c.targets) {
        if (!nodes.has(id) || used.has(id))
          throw Error(
            "A target is missing or assigned to more than one motion.",
          );
        used.add(id);
      }
      const min = Number(c.min),
        max = Number(c.max),
        value = Number(c.value ?? 0),
        pivot = c.pivot ?? [0, 0, 0];
      if (
        !Number.isFinite(min) ||
        !Number.isFinite(max) ||
        max <= min ||
        Math.max(Math.abs(min), Math.abs(max)) > 10000 ||
        !Number.isFinite(value) ||
        !Array.isArray(pivot) ||
        pivot.length !== 3 ||
        !pivot.every(
          (v) =>
            typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= 10000,
        )
      )
        throw Error(
          "Motion limits and pivot must be finite; maximum magnitude is 10000.",
        );
      return {
        name: String(c.name ?? `Motion ${i + 1}`).slice(0, 80),
        targets: [...c.targets],
        type: c.type,
        axis: c.axis,
        min,
        max,
        value: Math.min(1, Math.max(0, value)),
        pivot: [...pivot],
      };
    }),
  };
}
export class MotionRig {
  constructor(root) {
    this.root = root;
    this.nodes = indexNodes(root);
    this.rest = new Map(
      [...this.nodes].map(([id, n]) => [
        id,
        { p: n.position.clone(), q: n.quaternion.clone() },
      ]),
    );
    this.channels = [];
  }
  configure(config) {
    this.channels = validateConfig(config, this.nodes).channels;
    this.apply();
  }
  resetPose() {
    for (const [id, r] of this.rest) {
      const n = this.nodes.get(id);
      n.position.copy(r.p);
      n.quaternion.copy(r.q);
    }
  }
  apply() {
    this.resetPose();
    for (const c of this.channels) {
      const value = c.min + (c.max - c.min) * c.value;
      for (const id of c.targets) {
        const n = this.nodes.get(id),
          r = this.rest.get(id),
          axis = axes[c.axis];
        if (c.type === "slide") {
          n.position.addScaledVector(axis.clone().applyQuaternion(r.q), value);
        } else {
          const q = new THREE.Quaternion().setFromAxisAngle(
              axis,
              THREE.MathUtils.degToRad(value),
            ),
            pivot = new THREE.Vector3(...c.pivot);
          n.quaternion.copy(r.q).multiply(q);
          n.position.add(
            pivot
              .clone()
              .sub(pivot.clone().applyQuaternion(q))
              .applyQuaternion(r.q),
          );
        }
      }
    }
    this.root.updateMatrixWorld(true);
  }
  export() {
    return { version: 1, channels: structuredClone(this.channels) };
  }
}
export function bindByNames(rig, specs) {
  return {
    version: 1,
    channels: specs.map((c) => ({
      ...c,
      targets: [...rig.nodes]
        .filter(([, n]) => c.names.includes(n.name))
        .map(([id]) => id),
      value: Math.min(1, Math.max(0, -c.min / (c.max - c.min))),
      pivot: [0, 0, 0],
    })),
  };
}
export function inspectGLB(buffer) {
  const v = new DataView(buffer);
  if (
    v.byteLength < 20 ||
    v.getUint32(0, true) !== 0x46546c67 ||
    v.getUint32(4, true) !== 2 ||
    v.getUint32(8, true) !== v.byteLength
  )
    throw Error("Choose a valid binary glTF 2.0 (.glb) file.");
  const len = v.getUint32(12, true);
  if (v.getUint32(16, true) !== 0x4e4f534a || 20 + len > v.byteLength)
    throw Error("Invalid GLB JSON chunk.");
  const json = JSON.parse(
    new TextDecoder().decode(new Uint8Array(buffer, 20, len)),
  );
  for (const a of [...(json.buffers ?? []), ...(json.images ?? [])])
    if (a.uri && !a.uri.startsWith("data:"))
      throw Error(
        "Use a self-contained GLB with embedded textures and buffers.",
      );
  if (
    (json.extensionsRequired ?? []).some((x) =>
      [
        "KHR_draco_mesh_compression",
        "EXT_meshopt_compression",
        "KHR_texture_basisu",
      ].includes(x),
    )
  )
    throw Error(
      "Please export an uncompressed GLB; this editor does not include Draco, Meshopt or KTX2 decoders.",
    );
  return json;
}

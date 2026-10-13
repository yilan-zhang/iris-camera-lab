import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as THREE from "three";
import { CameraRig } from "../src/rig.js";
import { DEFAULTS } from "../src/state.js";
// Build the actual exported node hierarchy without a browser or texture decoder.
const bytes = fs.readFileSync(
  new URL("../public/models/camera.glb", import.meta.url),
);
const json = JSON.parse(
  bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString(),
);
function fixture() {
  const nodes = json.nodes.map((n) => {
    const o = new THREE.Group();
    o.name = n.name ?? "";
    if (n.translation) o.position.fromArray(n.translation);
    if (n.rotation) o.quaternion.fromArray(n.rotation);
    if (n.scale) o.scale.fromArray(n.scale);
    return o;
  });
  json.nodes.forEach((n, i) =>
    (n.children ?? []).forEach((c) => nodes[i].add(nodes[c])),
  );
  const root = new THREE.Group();
  json.scenes[json.scene ?? 0].nodes.forEach((i) => root.add(nodes[i]));
  return new CameraRig(root);
}
test("published asset contains required independent joints and nine iris blades", () => {
  const rig = fixture();
  assert.equal(rig.iris.length, 9);
  assert.equal(Object.keys(rig.nodes).length, 6);
});
test("zoom slides groups along optical X while focus independently moves g3", () => {
  const r = fixture(),
    g1 = r.nodes.g1.position.clone(),
    g2 = r.nodes.g2.position.clone(),
    g3 = r.nodes.g3.position.clone();
  r.apply({ ...DEFAULTS, zoom: 1 });
  assert.ok(Math.abs(r.nodes.g1.position.x - g1.x - 0.006) < 1e-6);
  assert.ok(Math.abs(r.nodes.g2.position.x - g2.x - 0.01) < 1e-6);
  assert.ok(r.nodes.g3.position.distanceTo(g3) < 1e-9);
  r.apply({ ...DEFAULTS, focus: 1 });
  assert.ok(Math.abs(r.nodes.g3.position.x - g3.x + 0.005) < 1e-6);
  assert.ok(r.nodes.g1.position.distanceTo(g1) < 1e-9);
});
test("repeated exploded motion does not accumulate drift and reset restores every node", () => {
  const r = fixture();
  const s = { ...DEFAULTS, zoom: 0.9, focus: 0.7, aperture: 1, explode: 1 };
  r.apply(s);
  const first = r.nodes.g1.position.clone();
  for (let i = 0; i < 100; i++) r.apply(s);
  assert.ok(r.nodes.g1.position.distanceTo(first) < 1e-12);
  r.apply(DEFAULTS);
  for (const [node, rest] of r.rest) {
    assert.ok(node.position.distanceTo(rest.p) < 1e-12);
    assert.ok(1 - Math.abs(node.quaternion.dot(rest.q)) < 1e-6);
  }
});

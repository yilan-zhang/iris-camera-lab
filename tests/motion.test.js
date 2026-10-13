import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { MotionRig, bindByNames, inspectGLB } from "../src/motion.js";
import { bicycle, gripper } from "../src/assets.js";
test("procedural bicycle and gripper have resolvable independent motions", () => {
  for (const create of [bicycle, gripper]) {
    const { root, specs } = create(),
      r = new MotionRig(root);
    r.configure(bindByNames(r, specs));
    assert.equal(r.channels.length, 3);
    assert.ok(r.channels.every((c) => c.targets.length > 0));
  }
});
test("pivot remains fixed and repeated rotation does not drift", () => {
  const root = new T.Group(),
    n = new T.Group();
  n.name = "hinge";
  n.position.set(3, 2, 1);
  root.add(n);
  const r = new MotionRig(root),
    id = n.userData.motionId;
  r.configure({
    version: 1,
    channels: [
      {
        name: "hinge",
        type: "rotate",
        axis: "z",
        min: 0,
        max: 90,
        value: 1,
        pivot: [1, 0, 0],
        targets: [id],
      },
    ],
  });
  const pivot = n.localToWorld(new T.Vector3(1, 0, 0));
  assert.ok(pivot.distanceTo(new T.Vector3(4, 2, 1)) < 1e-8);
  const p = n.position.clone();
  for (let i = 0; i < 100; i++) r.apply();
  assert.ok(n.position.distanceTo(p) < 1e-12);
});
test("gripper fingers move outwards symmetrically in opposite local axes", () => {
  const { root, specs } = gripper(),
    r = new MotionRig(root);
  r.configure(bindByNames(r, specs));
  const left = root.getObjectByName("Left jaw"),
    right = root.getObjectByName("Right jaw"),
    lp = left.position.x,
    rp = right.position.x;
  r.channels[0].value = 1;
  r.channels[1].value = 1;
  r.apply();
  assert.ok(Math.abs(left.position.x - lp + 0.4) < 1e-9);
  assert.ok(Math.abs(right.position.x - rp - 0.4) < 1e-9);
});
test("invalid imported recipes cannot partially replace the active rig", () => {
  const { root, specs } = bicycle(),
    r = new MotionRig(root);
  r.configure(bindByNames(r, specs));
  const before = r.export();
  for (const bad of [
    { ...before, version: 99 },
    { version: 1, channels: [{ ...before.channels[0], min: Infinity }] },
    { version: 1, channels: [before.channels[0], before.channels[0]] },
  ])
    assert.throws(() => r.configure(bad));
  assert.deepEqual(r.export(), before);
});
test("GLB parser accepts original asset and rejects invalid/external-resource files", () => {
  const bytes = fs.readFileSync(
    new URL("../public/models/camera.glb", import.meta.url),
  );
  assert.ok(
    inspectGLB(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    ).nodes.length,
  );
  assert.throws(() => inspectGLB(new ArrayBuffer(2)));
  const json = JSON.stringify({
    asset: { version: "2.0" },
    buffers: [{ uri: "https://example.com/model.bin" }],
  });
  const padded = json.padEnd(Math.ceil(json.length / 4) * 4, " "),
    b = new ArrayBuffer(20 + padded.length),
    v = new DataView(b);
  v.setUint32(0, 0x46546c67, true);
  v.setUint32(4, 2, true);
  v.setUint32(8, b.byteLength, true);
  v.setUint32(12, padded.length, true);
  v.setUint32(16, 0x4e4f534a, true);
  new Uint8Array(b, 20).set(new TextEncoder().encode(padded));
  assert.throws(() => inspectGLB(b), /self-contained/);
});

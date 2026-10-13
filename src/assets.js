import * as T from "three";
const mat = (color, metalness = 0.45, roughness = 0.38) =>
  new T.MeshStandardMaterial({ color, metalness, roughness });
const dark = mat("#303b3d"),
  silver = mat("#b7c3c3", 0.8, 0.23),
  rubber = mat("#1f2527", 0.05, 0.8),
  orange = mat("#d97746"),
  teal = mat("#6a9690");
function mesh(g, m, parent, name, pos = [0, 0, 0]) {
  const n = new T.Mesh(g, m);
  n.name = name;
  n.position.set(...pos);
  parent.add(n);
  return n;
}
function group(parent, name, pos = [0, 0, 0]) {
  const n = new T.Group();
  n.name = name;
  n.position.set(...pos);
  parent.add(n);
  return n;
}
function bar(parent, a, b, r, m, name) {
  const start = new T.Vector3(...a),
    end = new T.Vector3(...b),
    d = end.clone().sub(start);
  const n = mesh(new T.CylinderGeometry(r, r, d.length(), 20), m, parent, name);
  n.position.copy(start.add(end).multiplyScalar(0.5));
  n.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
  return n;
}
function wheel(parent, name, pos) {
  const g = group(parent, name, pos);
  mesh(new T.TorusGeometry(0.57, 0.057, 12, 64), rubber, g, "Tire");
  mesh(new T.TorusGeometry(0.5, 0.015, 8, 64), silver, g, "Rim");
  const hub = mesh(
    new T.CylinderGeometry(0.055, 0.055, 0.18, 20),
    silver,
    g,
    "Hub",
  );
  hub.rotation.x = Math.PI / 2;
  for (let i = 0; i < 20; i++) {
    const a = (i * Math.PI) / 10;
    bar(
      g,
      [0, 0, 0],
      [0.5 * Math.cos(a), 0.5 * Math.sin(a), 0],
      0.006,
      silver,
      `Spoke ${i + 1}`,
    );
  }
  return g;
}
export function bicycle() {
  const root = new T.Group();
  root.name = "City bicycle";
  const rear = [-1.0, 0.62, 0],
    front = [1.0, 0.62, 0],
    crank = [-0.25, 0.48, 0],
    seat = [-0.5, 1.45, 0],
    head = [0.7, 1.44, 0];
  const frame = group(root, "Frame");
  for (const [a, b] of [
    [rear, crank],
    [rear, seat],
    [crank, seat],
    [seat, head],
    [crank, head],
  ])
    bar(frame, a, b, 0.036, orange, "Frame tube");
  wheel(root, "Rear wheel", rear);
  const steering = group(root, "Steering", [0.7, 1.44, 0]);
  bar(steering, [0, 0, 0], [0.3, -0.82, 0], 0.025, silver, "Fork");
  wheel(steering, "Front wheel", [0.3, -0.82, 0]);
  bar(steering, [0, 0, 0], [-0.03, 0.32, 0], 0.026, silver, "Stem");
  bar(
    steering,
    [-0.03, 0.32, -0.38],
    [-0.03, 0.32, 0.38],
    0.025,
    silver,
    "Handlebar",
  );
  for (const z of [-0.35, 0.35])
    bar(
      steering,
      [-0.03, 0.32, z - 0.1],
      [-0.03, 0.32, z + 0.1],
      0.039,
      rubber,
      "Grip",
    );
  bar(root, seat, [-0.5, 1.64, 0], 0.025, silver, "Seat post");
  mesh(
    new T.BoxGeometry(0.38, 0.07, 0.22),
    dark,
    root,
    "Saddle",
    [-0.55, 1.66, 0],
  );
  const pedals = group(root, "Crank", crank);
  const gear = mesh(
    new T.CylinderGeometry(0.16, 0.16, 0.035, 32),
    silver,
    pedals,
    "Chainring",
  );
  gear.rotation.x = Math.PI / 2;
  for (const sign of [-1, 1]) {
    bar(
      pedals,
      [0, 0, 0.1 * sign],
      [0.2 * sign, -0.1 * sign, 0.1 * sign],
      0.022,
      silver,
      "Crank arm",
    );
    mesh(new T.BoxGeometry(0.16, 0.045, 0.16), dark, pedals, "Pedal", [
      0.2 * sign,
      -0.1 * sign,
      0.16 * sign,
    ]);
  }
  return {
    root,
    specs: [
      {
        name: "Wheel rotation",
        names: ["Rear wheel", "Front wheel"],
        type: "rotate",
        axis: "z",
        min: 0,
        max: 360,
      },
      {
        name: "Steering",
        names: ["Steering"],
        type: "rotate",
        axis: "y",
        min: -35,
        max: 35,
      },
      {
        name: "Pedal crank",
        names: ["Crank"],
        type: "rotate",
        axis: "z",
        min: 0,
        max: 360,
      },
    ],
  };
}
export function gripper() {
  const root = new T.Group();
  root.name = "Parallel gripper";
  mesh(
    new T.CylinderGeometry(0.6, 0.72, 0.15, 64),
    dark,
    root,
    "Mount",
    [0, 0.08, 0],
  );
  mesh(
    new T.CylinderGeometry(0.34, 0.4, 0.32, 48),
    silver,
    root,
    "Wrist",
    [0, 0.32, 0],
  );
  const wrist = group(root, "Wrist rotation", [0, 0.5, 0]);
  mesh(
    new T.BoxGeometry(1.4, 0.48, 0.68),
    teal,
    wrist,
    "Actuator housing",
    [0, 0.22, 0],
  );
  for (const z of [-0.24, 0.24])
    bar(wrist, [-0.6, 0.5, z], [0.6, 0.5, z], 0.04, silver, "Guide rail");
  for (const s of [-1, 1]) {
    const jaw = group(wrist, s < 0 ? "Left jaw" : "Right jaw", [
      s * 0.18,
      0.55,
      0,
    ]);
    if (s < 0) jaw.rotation.y = Math.PI;
    mesh(
      new T.BoxGeometry(0.16, 0.7, 0.44),
      silver,
      jaw,
      "Finger",
      [0, 0.35, 0],
    );
    mesh(new T.BoxGeometry(0.2, 0.25, 0.48), dark, jaw, "Contact pad", [
      -s * 0.025,
      0.7,
      0,
    ]);
    mesh(new T.BoxGeometry(0.25, 0.1, 0.6), dark, jaw, "Carriage", [0, 0, 0]);
  }
  for (const x of [-0.5, 0.5])
    for (const z of [-0.2, 0.2])
      mesh(
        new T.CylinderGeometry(0.035, 0.035, 0.035, 6),
        silver,
        wrist,
        "Housing bolt",
        [x, 0.475, z],
      );
  return {
    root,
    specs: [
      {
        name: "Left finger",
        names: ["Left jaw"],
        type: "slide",
        axis: "x",
        min: 0,
        max: 0.4,
      },
      {
        name: "Right finger",
        names: ["Right jaw"],
        type: "slide",
        axis: "x",
        min: 0,
        max: 0.4,
      },
      {
        name: "Wrist rotation",
        names: ["Wrist rotation"],
        type: "rotate",
        axis: "y",
        min: -90,
        max: 90,
      },
    ],
  };
}
export const catalog = [
  {
    id: "camera",
    name: "Pink & gold camera",
    subtitle: "Hybrid AI asset · 6 motions",
    number: "01",
    tag: "OPTICS",
    icon: "◉",
  },
  {
    id: "bicycle",
    name: "City bicycle",
    subtitle: "Procedural model · 3 motions",
    number: "02",
    tag: "LINKAGES",
    icon: "◎",
  },
  {
    id: "gripper",
    name: "Parallel gripper",
    subtitle: "Procedural model · 3 motions",
    number: "03",
    tag: "ROBOTICS",
    icon: "⋈",
  },
];

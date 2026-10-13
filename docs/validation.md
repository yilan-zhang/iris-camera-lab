# Validation — October 13, 2026

## Motion Studio expansion

- Unit suite: 12 passing checks, including generic pivot invariants, symmetric gripper travel, recipe rejection without partial updates, and GLB preflight validation.
- Studio browser suite: 15 passing checks covering three assets, editing limits, invalid edits, IndexedDB save/reload, JSON export/import, mismatched model rejection, imported GLB authoring, saved model-byte restoration, malformed file rejection, animation override, motion removal, mobile overflow and keyboard input.
- Original camera browser suite: 15 passing checks on `camera.html`.
- Inspected desktop screenshots for all three assets and a 390 × 844 mobile viewport.
- Procedural examples are new demonstration geometry; no external bicycle or gripper asset was used.

## Original camera edition

- `npm test`: 7 checks passed, including actual GLB joint hierarchy, independent group motion, repeated-update/reset stability, URL bounds and state round trips.
- `npm run test:e2e`: 15 browser checks passed in headless Google Chrome on macOS. The run exercised loading, zoom/focus motion, aperture output, X-ray, exploded view, reload restoration, wireframe, component selection, reset, presets, animation/manual override, PNG download, mobile overflow and keyboard range control. No uncaught page errors were observed.
- Desktop: 1440 × 1000 viewport. Mobile layout: 390 × 844 viewport. Screenshots inspected manually; exploded framing was adjusted after finding clipping.
- `npm run build`: passed. Vite reports a bundle-size advisory for the Three.js application bundle; this is not a build failure.
- Browser coverage is Chrome only; the mobile check uses a resized Chrome viewport, not a physical phone.
- Metrics illustrate relationships and are not validated against a physical lens or camera.

## Asset integrity

`public/models/camera.glb` SHA-256:

```text
5d9b74d7d7b47354f9ecdf9ca339c8151d2937d9ae148ba296c3420369d704a6
```

The source GLB was copied unchanged from the owner's personal camera asset.

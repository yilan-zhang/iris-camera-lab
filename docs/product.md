# IRIS Motion Studio — product brief

## Problem

A generated 3D object can look convincing while lacking usable motion. Students and creative technologists need to inspect its parts, define pivots and axes, and test interactions without first building a custom viewer for every object.

## Core workflow

Choose one of three assemblies or import a GLB → inspect/search parts → select a mesh or group → define rotation/translation, local axis, limits and pivot → test with sliders → save a browser-local project or export a recipe.

## Implemented acceptance criteria

- Three distinct assemblies with working motion: camera, bicycle and gripper.
- Import validates a self-contained GLB and rejects external dependencies and unsupported compression.
- A generic motion engine handles all three models and user-imported parts.
- Offset-pivot rotation preserves the pivot; repeated updates have no cumulative drift.
- Configuration validation is atomic; invalid recipes do not partially replace working controls.
- Imported-model recipes are bound to a SHA-256 fingerprint.
- IndexedDB saves imported bytes together with configurations for restoration after refresh.
- Labeled controls, keyboard-operable sliders, and mobile layout without horizontal overflow.
- The original camera lab remains available for its specialized coupled optics and exploded view.

## Design

A visible asset library makes the scope clear before interaction. The workbench places structure on the left, the object in the center, and motion definition on the right. Playable motion controls sit directly below. Original asset names are preserved for technical inspection; explanatory guidance is separate from implementation details.

## Future work

Visual pivot dragging, hierarchy editing, mesh segmentation, imported animation playback, multiple simultaneous channels per node, collision checking, asset compression and cross-browser/device testing. These are not implemented claims.

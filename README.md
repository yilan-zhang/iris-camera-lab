# IRIS · Camera Lab

**An interactive anatomy lab for a hybrid AI-generated camera.** Turn the zoom and focus rings, move internal lens groups, close a nine-blade iris, and take the assembly apart in your browser.

IRIS explores a gap in generative 3D workflows: a convincing exterior does not automatically provide meaningful pivots, part relationships or usable interaction. It turns an existing pink-and-gold camera experiment into an inspectable, shareable web experience.

[Live demo](https://yilan-zhang.github.io/iris-camera-lab/) · [Product brief](docs/product.md)

![IRIS Camera Lab desktop interface](docs/preview.png)

## Explore

- **Articulated controls:** a 55° zoom ring, 80° focus ring, three translating lens groups and nine individually pivoted iris blades.
- **Anatomy selection:** click the model or use keyboard-accessible component buttons to highlight and learn about parts.
- **Inspection tools:** solid, transparent-shell X-ray and wireframe modes; exploded assembly; four camera viewpoints.
- **Guided motion:** an animated zoom → focus → aperture sequence, with manual override.
- **Reproducible setups:** bounded URL-fragment parameters restore the same controls and view. No account or backend required.
- **Export:** PNG view captures and the original GLB asset.
- **Responsive interface:** desktop workspace and stacked mobile controls.
- **Illustrative optics:** field of view for an idealized 36 mm-wide sensor and relative light from the displayed aperture ratio.

## Run locally

Node.js 22 or later recommended.

```sh
npm ci
npm run dev
```

Open the printed local URL. The 14.6 MB model is served locally; no model-generation API key is needed.

```sh
npm test
npm run build
npm run preview
```

`npm run test:e2e` runs browser interaction checks against the local dev server. Set `CHROME_PATH` if Google Chrome is not installed at the macOS default path, or install Playwright Chromium. Set `TEST_URL` to test a production preview.

## How it works

The GLB carries named transform nodes (`DOF_zoom__r`, `DOF_focus__r`, `DOF_g1__t` …). Each joint uses local **+Y** as its rotation/translation axis. The rest quaternion maps that axis to the scene’s **+X optical axis**. Rotation post-multiplies the rest quaternion; translation adds displacement along the transformed axis. Every update starts from stored rest transforms, so animations and exploded views do not accumulate drift.

Zoom couples two lens groups to 6 mm and 10 mm travel. Focus drives the third group through −5 mm travel. Nine blade pivots rotate through 65°. The exploded view moves top-level assemblies along the optical axis, preserving the iris’s internal layout. Existing embedded animation clips are not played concurrently with the procedural rig.

| File | Responsibility |
| --- | --- |
| `src/rig.js` | Asset contract, rest transforms, articulation, exploded view, material modes |
| `src/state.js` | Validated state, share-link serialization, presets, illustrative metrics |
| `src/main.js` | Three.js scene, interaction, selection, loading, exports, animation |
| `src/style.css` | Responsive visual system and accessible focus states |
| `public/models/camera.glb` | Original hybrid camera asset |
| `tests/` | URL bounds, metrics, actual asset hierarchy and browser behavior |

**Stack:** Three.js, JavaScript ES modules, HTML/CSS, Vite, Node test runner and Playwright. Static deployment; no database, authentication, paid service or runtime AI API.

## Origin and authorship

Project direction and the original camera exploration are by **Yilan Zhang (Winnie)**. Her prior workflow used Tripo for generated appearance and AI-assisted coding/rigging to make the camera interactive. This browser edition extends the existing articulated asset with a new interface, inspection workflow, shareable state, documentation and tests. Implementation and testing were developed with **Codex assistance**. It is a personal project, not a hackathon entry, and it does not claim independently handwritten implementation.

The original personal asset and viewer logic were approved by Yilan for public release. This repository contains only the selected camera asset and the new standalone application; no company datasets or infrastructure are included. See [asset provenance](docs/asset-provenance.md).

## Limitations

- This is a **mechanical visualization**, not a calibrated camera or optical ray tracer. Ring-to-lens relationships are illustrative.
- The displayed focal length is a 24–70 mm mapping of the zoom control. The aperture ratio follows the iris geometry, not a calibrated entrance pupil. Relative light holds shutter speed and ISO constant and ignores transmission losses.
- Focus moves a lens group; it does not render photographically accurate depth of field or focus distance.
- Exploded positions are for inspection, not a manufacturing assembly plan. Transparent surfaces can exhibit normal real-time transparency artifacts.
- The original 14.6 MB asset may take several seconds to load. WebGL is required. Google Fonts is optional and falls back to system fonts.
- No user accounts or analytics. Shared links contain only numeric settings, rendering mode and named viewpoint.

## Deploy

The Vite build emits `dist/` with relative asset paths. It can be served on GitHub Pages or any static host. A Vercel static configuration and GitHub Pages workflow are included. Deployment status should be verified separately from a successful local build.

## License

Application source is MIT licensed. The camera model is retained as a demonstration asset with separate terms; see [asset provenance](docs/asset-provenance.md). Tripo and third-party product names are descriptive, without endorsement or affiliation.

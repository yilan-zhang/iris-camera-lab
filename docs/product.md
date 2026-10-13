# Product brief

## User and problem

Students, creative technologists and portfolio visitors can inspect an AI-generated 3D surface but often cannot tell which parts move or how a control relates to a mechanism. An attractive static asset hides the work involved in making it interactive.

## Main flow

1. Recognize the camera and orbit it without setup.
2. Select a component and read a short explanation.
3. Move its control and see the corresponding geometry change.
4. Reveal hidden structures with X-ray or exploded inspection.
5. Share the exact setup or save a view.

## Acceptance criteria

- Model loads with visible progress and clear failure state.
- Zoom, focus and iris are independent and driven by the real asset hierarchy.
- Reset restores original transforms after repeated interactions.
- Shared URLs accept finite bounded values and reject unknown modes.
- All primary operations have labeled keyboard-accessible controls.
- Mobile layout has no horizontal overflow.
- Readme describes real behavior, authorship and mechanical/optical limitations.

## Design choices

An off-white workbench and muted green controls frame the original pink-and-gold model. Orange marks active controls and observations. Technical explanations stay next to the anatomy rather than interrupting exploration. The implementation is static because the core task does not need an account, API, database or server.

## Future work

Asset compression, glTF import with user-defined joint mapping, an actual optical model, broader device validation and a short user study. None are claimed as implemented.

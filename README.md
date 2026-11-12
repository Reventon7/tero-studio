# TERO — A new perspective

A complete English-language redesign with a locally rendered Three.js loupe study, cinematic scroll chapters and original TERO product photography.

## Preview

From this folder run `npm run dev`, then open http://127.0.0.1:4175 . Node.js is required for the preview server. The distributable assets are already included: no install or build is necessary. Opening index.html directly does not support the module-based 3D experience.

## Included

- Three scroll chapters: perspective, optical architecture and illumination.
- Interactive 3D rotation, keyboard arrows/Home, reset, exploded components and ambient-motion pause.
- Five catalog optical families, magnification selection and comparison.
- Three frame finishes, a lighting scene and kit, and seating photography.
- Downloadable selection summary and original PDF catalog.
- Responsive layouts, keyboard-operated dialogs and tabs, reduced-motion support and a photograph fallback for unavailable WebGL.
- Self-hosted fonts, Three.js and GSAP assets.

The 3D scene now loads the supplied assembled.glb and light.glb from D:/Projects/Tero/public/assets/hero. These replace the earlier procedural model. No dimensional-CAD accuracy is asserted. Actual product images and catalog specifications are presented separately. Saved selections are local text files; no order, inquiry or backend submission occurs. There is no invented price, certification, testimonial or contact address.

The six supplied prompts informed the art direction. sample.mp4 was analyzed solely as a motion reference and is not embedded or distributed as product media. See design/DIRECTION.md.

## Verification

JavaScript syntax and HTML asset-reference checks passed. Rendered checks at 1440 x 900 and 390 x 844 found no horizontal overflow. All five optical families, keyboard tab selection, magnification selection, downloaded selection contents, frame colors, comparison/Escape/focus return, lighting controls, mobile navigation and 3D pause/explode/reset controls were exercised. No browser console errors were recorded in the final check. Screenshots and detailed limitations are in design/qa.

Reduced-motion behavior and WebGL-failure handling are implemented but were not forced in browser testing. Physical-device, Safari and full assistive-technology audits remain unperformed. No online deployment was made.

## Files

- dist/: complete static website, original catalog copy and optimized photography.
- server.mjs: local preview server, bound to loopback.
- design/: reference decisions and review evidence.
- package.json / package-lock.json: dependency versions and convenience commands.

Original user-supplied files remain untouched in the parent project directory.

## Supplied model and amber filter update

The headlight section uses the supplied GLB with its original filter hinge. It starts with white light and the cover raised. The switch rotates the amber cover into place before warming the beam, and reverses on the next press. The light stays on throughout. The lighting-section switch is independent of the scroll-driven hero filter. GSAP handles interruptible transitions; reduced-motion users receive immediate state changes. The headlight asset loads near its section and rendering pauses offscreen. The source Tero project was read only and was not changed or deployed.


## Detail pass: smooth eyewire, optical previews and seating

The upper rim and clear lens now use one continuous Bezier contour, replacing the local vertex deformation that produced a wavy brow. Existing mounts, temples, loupes and headlight remain from the supplied GLB.

Product plates use clean, tightly bounded crops of the catalog photographs without overlay numbering or family labels. Sixteen orchid examples are extracted from catalog spreads 4–8 and mapped to their printed optical-family/magnification pair. A reversible zoom transition accompanies selection; the final view uses the original sample, not a fabricated optical simulation. The extracted samples are about 355 pixels wide, reflecting the catalog resolution.

Seating uses the supplied clinical/tero-chair-fitted.glb, copied unchanged to assets/models/chair.glb. A separate lazy-loaded Three.js scene provides studio lighting, soft contact shadow, scroll rotation, four animated viewpoints, drag/keyboard rotation and a pause control. Offscreen rendering pauses; reduced-motion preferences suppress scroll motion and animated view transitions. The prior chair photograph is no longer displayed in the seating section.

## The human perspective

A new pinned cinematic section sits between the philosophy and optical collection. It reuses the source project's doctor-study.glb (licensed MakeHuman anatomy and wardrobe, with the existing seated alignment animation), fitted chair, conventional stool, workstation and dental training model. The glasses are the existing refined TERO assembly mounted to the head bone. The section moves through conventional setup, support, angled optics and focused light, ending with the amber filter.

The chapter buttons and keyboard-accessible comparison slider allow independent inspection; Resume scroll story reconnects playback to scroll position. The scene loads near the viewport, pauses when offscreen/hidden, respects reduced motion and uses before/after posters if 3D loading fails. It is a visual fitting study, not a prescribed posture or measured clinical outcome. Source project files are unchanged. Character provenance is recorded in design/DOCTOR-SOURCE.md.

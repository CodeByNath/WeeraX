# WeeraX · The Antikythera

Standalone Three.js homepage prototype. The original WeeraX entry point sits outside this directory.

## Run locally

From this directory:

```sh
npm ci
npm run dev
```

Open [the local preview](http://127.0.0.1:4173/). A browser with WebGL 2 is required. Set `PORT` to use a different local port.

## Build for GitHub Pages

Run `npm ci` and `npm run build` from this directory. The `dist/` folder contains the static site and the pinned Three.js modules. Publish its contents at the root of a dedicated Pages repository. All URLs are relative so the site works under a GitHub Pages project path.

## Controls

Scroll down to move the camera toward the star and up to pull back. On touchscreens, pinch the scene or use the zoom slider. With the slider focused, the arrow keys adjust zoom and Home or End jumps to an endpoint. Use the motion button to inspect the train at rest. The system reduced-motion preference starts the scene paused.

The eleven wheels share a tooth module. Each driven wheel uses its parent's pitch radius, tooth count and tooth phase to set its centre, angle and speed. The tooth shape is a simplified profile for real-time rendering.

The scene generates its geometry, patina, reflections and star locally. It batches rigid detail by material, caps the canvas at 2.2 million pixels and suspends continuous rendering when paused or backgrounded.

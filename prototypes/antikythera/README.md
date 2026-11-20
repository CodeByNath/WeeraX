# WeeraX · The Antikythera

The Three.js homepage uses the repository’s root `index.html` and serves its scene from this directory.

## Run locally

From this directory:

```sh
npm run dev
```

Open [the local preview](http://127.0.0.1:4173/). A browser with WebGL 2 is required. Set `PORT` to use a different local port.

## Static hosting

GitHub Pages serves the root `index.html` directly. The relative URLs work under the `/WeeraX/` project path. Three.js is checked in under `vendor/` with its MIT license so the deployment needs no install step. When updating Three.js, update the lockfile and copy both minified modules from `node_modules/three/build/` and the license from `node_modules/three/`.

Run `npm run build` from this directory to export a self-contained copy to `dist/` for other static hosting.

## Controls

Scroll down to move the camera toward the star and up to pull back. On touchscreens, pinch the scene or use the zoom slider. With the slider focused, the arrow keys adjust zoom and Home or End jumps to an endpoint. Use the motion button to inspect the train at rest. The system reduced-motion preference starts the scene paused.

The eleven wheels share a tooth module. Each driven wheel uses its parent's pitch radius, tooth count and tooth phase to set its centre, angle and speed. The tooth shape is a simplified profile for real-time rendering.

The scene generates its geometry, patina, reflections and star locally. It batches rigid detail by material, caps the canvas at 2.2 million pixels and suspends continuous rendering when paused or backgrounded.

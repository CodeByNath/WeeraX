const canvas = document.querySelector('#mechanism');
const stage = document.querySelector('.stage');
const status = document.querySelector('#scene-status');

async function run() {
  const [THREE, { buildMechanism }, { buildEnvironment, buildMaterials, buildStar }] = await Promise.all([
    import('three'), import('./mechanism.js'), import('./surface.js'),
  ]);
  const renderer = new THREE.WebGLRenderer({
    canvas, alpha: true, antialias: true, powerPreference: 'low-power',
  });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;

  const scene = new THREE.Scene();
  let environment = buildEnvironment(renderer);
  scene.environment = environment.texture;
  scene.environmentIntensity = 1.2;

  const camera = new THREE.PerspectiveCamera(34, 1, .1, 120);
  const root = new THREE.Group();
  scene.add(root);

  function directional(colour, intensity, x, y, z) {
    const light = new THREE.DirectionalLight(colour, intensity);
    light.position.set(x, y, z);
    scene.add(light);
  }

  directional(0xffe4c6, 2.8, -4, 6, 4);
  directional(0xbbc9ed, 2.1, 5, 2, -1.5);
  directional(0xe5b38c, 1.2, 1, -4, 3);
  scene.add(new THREE.HemisphereLight(0xfce4ca, 0x281c1a, .58));

  const updateGears = buildMechanism(root, buildMaterials());
  const updateStar = buildStar(root);
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  let playing = !preference.matches;
  let contextLost = false;
  let time = 0;
  let previousFrame = 0;
  let frame = 0;
  let baseDistance = 20;
  let cameraFocusY = .21;
  let zoomTarget = 0;
  let zoomCurrent = 0;
  let x = 0;
  let y = 0;
  let targetX = 0;
  let targetY = 0;

  function requestFrame() {
    if (!frame && !document.hidden && !contextLost) frame = requestAnimationFrame(render);
  }

  function render(now) {
    frame = 0;
    const delta = previousFrame ? Math.min(.05, (now - previousFrame) / 1000) : 1 / 60;
    previousFrame = now;
    if (playing) time += delta;

    zoomCurrent = THREE.MathUtils.damp(zoomCurrent, zoomTarget, 7.4, delta);
    x = THREE.MathUtils.damp(x, targetX, 4, delta);
    y = THREE.MathUtils.damp(y, targetY, 4, delta);
    const settling = Math.abs(zoomCurrent - zoomTarget) + Math.abs(x - targetX) + Math.abs(y - targetY) > .0005;
    if (!settling) {
      zoomCurrent = zoomTarget;
      x = targetX;
      y = targetY;
    }

    // Zoom moves the camera toward the star and gradually centres it in the lens.
    const distance = baseDistance / (1 + zoomCurrent * 1.3);
    const focusX = .24 * (1 - zoomCurrent * .93);
    const focusY = cameraFocusY * (1 - zoomCurrent * .93);
    camera.position.set(focusX + x * .38, focusY - y * .30, distance);
    camera.lookAt(focusX, focusY, -.10);
    root.rotation.set(
      -.24 + Math.sin(time * .39) * .022 + y * .055,
      -.32 + Math.sin(time * .33) * .024 + x * .095,
      -.105,
    );
    updateGears(time);
    updateStar(time);
    renderer.render(scene, camera);

    if (playing || settling) requestFrame();
    else previousFrame = 0;
  }

  function resize() {
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    if (!width || !height) return;
    const ratio = Math.min(devicePixelRatio, 1.75, Math.sqrt(2200000 / (width * height)));
    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    const frameWidth = width > 560 ? 11.8 : 10.95;
    const frameHeight = height < 495 ? 11.1 : 9.65;
    baseDistance = Math.max(frameHeight, frameWidth / camera.aspect)
      / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    cameraFocusY = width > 560 ? .19 : -.70;
    requestFrame();
  }

  function setPlaying(value) {
    playing = value;
    if (!value) targetX = targetY = 0;
    requestFrame();
  }

  function setZoom(value) {
    zoomTarget = THREE.MathUtils.clamp(value, 0, 1);
    requestFrame();
  }

  new ResizeObserver(resize).observe(stage);
  resize();
  status.hidden = true;

  preference.addEventListener('change', ({ matches }) => setPlaying(!matches));

  canvas.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    switch (event.key) {
      case ' ':
        if (!event.repeat) setPlaying(!playing);
        break;
      case 'ArrowUp': setZoom(zoomTarget + .05); break;
      case 'ArrowDown': setZoom(zoomTarget - .05); break;
      case 'Home': setZoom(0); break;
      case 'End': setZoom(1); break;
      default: return;
    }
    event.preventDefault();
  });

  stage.addEventListener('wheel', event => {
    if (event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? stage.clientHeight : 1;
    setZoom(zoomTarget + event.deltaY * unit * .00145);
  }, { passive: false });

  const touches = new Map();
  let pinchDistance = 0;
  function trackPinch() {
    if (touches.size !== 2) {
      pinchDistance = 0;
      return;
    }
    const [first, second] = touches.values();
    const distance = Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
    if (pinchDistance && distance) setZoom(zoomTarget + Math.log(distance / pinchDistance) * 1.08);
    pinchDistance = distance;
  }

  canvas.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch') return;
    touches.set(event.pointerId, event);
    canvas.setPointerCapture(event.pointerId);
    trackPinch();
  });
  canvas.addEventListener('pointermove', event => {
    if (touches.has(event.pointerId)) {
      touches.set(event.pointerId, event);
      trackPinch();
    } else if (event.pointerType === 'mouse' && playing && !preference.matches) {
      targetX = (event.offsetX / stage.clientWidth - .5) * 2;
      targetY = (event.offsetY / stage.clientHeight - .5) * 2;
      requestFrame();
    }
  });
  canvas.addEventListener('pointerleave', () => {
    targetX = targetY = 0;
    requestFrame();
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(type, ({ pointerId }) => {
      if (touches.delete(pointerId)) trackPinch();
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(frame);
      frame = 0;
      previousFrame = 0;
    } else requestFrame();
  });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    contextLost = true;
    cancelAnimationFrame(frame);
    frame = 0;
    previousFrame = 0;
    status.textContent = 'Reconnecting to the graphics device…';
    status.hidden = false;
  });
  canvas.addEventListener('webglcontextrestored', () => {
    environment.dispose();
    environment = buildEnvironment(renderer);
    scene.environment = environment.texture;
    contextLost = false;
    status.hidden = true;
    requestFrame();
  });
}

run().catch(error => {
  status.textContent = 'The mechanism requires Three.js and a browser with WebGL 2.';
  console.error('Unable to start the Antikythera scene.', error);
});

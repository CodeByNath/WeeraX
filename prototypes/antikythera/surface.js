import * as THREE from 'three';

function randomSource(seed) {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function canvas(width, height = width) {
  const surface = document.createElement('canvas');
  surface.width = width;
  surface.height = height;
  return surface.getContext('2d');
}

function bronzeTextures() {
  const size = 512;
  const colour = canvas(size);
  const relief = canvas(size);
  const random = randomSource(313927);
  const pixels = colour.createImageData(size, size);
  const pits = relief.createImageData(size, size);

  const fields = [5, 13, 29, 67].map(scale => ({
    scale, values: Float32Array.from({ length: scale * scale }, random),
  }));
  function field({ scale, values }, x, y) {
    const u = x * scale / size;
    const v = y * scale / size;
    const i = Math.floor(u);
    const j = Math.floor(v);
    const a = u - i;
    const b = v - j;
    const smooth = t => t * t * (3 - 2 * t);
    const nextX = (i + 1) % scale;
    const nextY = (j + 1) % scale;
    return THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(values[j * scale + i], values[j * scale + nextX], smooth(a)),
      THREE.MathUtils.lerp(values[nextY * scale + i], values[nextY * scale + nextX], smooth(a)),
      smooth(b),
    );
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const index = (y * size + x) * 4;
      const mottling = field(fields[0], x, y) * .45 + field(fields[1], x, y) * .3
        + field(fields[2], x, y) * .17 + field(fields[3], x, y) * .08;
      const fleck = (random() - .5) * 29;
      const oxide = THREE.MathUtils.smoothstep(mottling, .43, .78);
      pixels.data[index] = 209 - 98 * oxide + fleck;
      pixels.data[index + 1] = 154 - 68 * oxide + fleck;
      pixels.data[index + 2] = 104 - 29 * oxide + fleck;
      pixels.data[index + 3] = 255;
      const height = 146 - oxide * 55 + fleck * .73 - (random() > .945 ? 44 : 0);
      pits.data.set([height, height, height, 255], index);
    }
  }
  colour.putImageData(pixels, 0, 0);
  relief.putImageData(pits, 0, 0);

  for (let i = 0; i < 620; i++) {
    const x = random() * size;
    const y = random() * size;
    const length = 3 + random() * 38;
    for (const context of [colour, relief]) {
      context.strokeStyle = i % 3 ? 'rgba(20,14,10,.15)' : 'rgba(255,225,175,.21)';
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + length, y + length * .16);
      context.stroke();
    }
  }

  const map = new THREE.CanvasTexture(colour.canvas);
  const bumpMap = new THREE.CanvasTexture(relief.canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  for (const texture of [map, bumpMap]) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 4;
  }
  return { map, bumpMap };
}

export function buildMaterials() {
  const texture = bronzeTextures();
  const metal = (color, metalness, roughness, bumpScale) =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness, bumpScale, ...texture });

  return {
    bronze: metal(0xe3ae79, .79, .43, .035),
    edge: metal(0xffd2a1, .84, .33, .022),
    brass: metal(0xffcd8d, .83, .29, .019),
    casting: metal(0x825639, .68, .58, .067),
    recess: metal(0x473a30, .60, .62, .042),
    steel: metal(0x9d9487, .87, .33, .032),
    ink: new THREE.MeshStandardMaterial({ color: 0x311c10, metalness: .25, roughness: .83 }),
  };
}

export function buildEnvironment(renderer) {
  const light = canvas(512, 256);
  light.fillStyle = '#11141b';
  light.fillRect(0, 0, 512, 256);

  for (const [x, y, width, height, hue] of [
    [108, 64, 110, 55, '255,226,196'],
    [337, 78, 73, 92, '182,207,255'],
    [457, 143, 59, 50, '255,193,129'],
    [211, 203, 85, 30, '128,100,80'],
  ]) {
    light.save();
    light.translate(x, y);
    light.scale(width, height);
    const box = light.createRadialGradient(0, 0, 0, 0, 0, 1);
    box.addColorStop(0, `rgba(${hue},1)`);
    box.addColorStop(.45, `rgba(${hue},.44)`);
    box.addColorStop(1, `rgba(${hue},0)`);
    light.fillStyle = box;
    light.fillRect(-1, -1, 2, 2);
    light.restore();
  }

  const source = new THREE.CanvasTexture(light.canvas);
  source.colorSpace = THREE.SRGBColorSpace;
  source.mapping = THREE.EquirectangularReflectionMapping;
  const generator = new THREE.PMREMGenerator(renderer);
  const environment = generator.fromEquirectangular(source);
  generator.dispose();
  source.dispose();
  return environment;
}

export function buildStar(root) {
  const time = { value: 0 };
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(.155, 4),
    new THREE.ShaderMaterial({
      uniforms: { time },
      vertexShader: `
        varying vec3 surface;
        varying float facing;
        uniform float time;
        void main() {
          vec3 p = normalize(position);
          surface = p;
          float wave = sin(p.x * 19.0 + p.y * 13.0 + time * 4.3) * sin(p.z * 17.0 - time * 5.0);
          vec4 view = modelViewMatrix * vec4(position * (1.0 + wave * .04), 1.0);
          facing = dot(normalize(normalMatrix * normal), normalize(-view.xyz));
          gl_Position = projectionMatrix * view;
        }`,
      fragmentShader: `
        varying vec3 surface;
        varying float facing;
        uniform float time;

        float hash(vec3 p) {
          p = fract(p * .3183099 + vec3(.13,.37,.73)) * 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }
        float noise(vec3 p) {
          vec3 i = floor(p);
          vec3 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x),
                mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
            mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x),
                mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z);
        }
        void main() {
          vec3 p = surface * 5.0 + vec3(0.0, -time*.62, time*.19);
          float n = noise(p) * .60 + noise(p * 2.25 + 4.0) * .28 + noise(p * 5.4) * .12;
          vec3 ember = mix(vec3(.94,.105,.009), vec3(1.0,.53,.10), smoothstep(.10,.60,n));
          vec3 heat = mix(ember, vec3(1.0,.98,.81), smoothstep(.37,.78,n + clamp(facing,0.0,1.0)*.18));
          gl_FragColor = vec4(heat, 1.0);
        }`,
    }),
  );
  core.position.z = .32;
  root.add(core);

  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 2.2),
    new THREE.ShaderMaterial({
      uniforms: { time },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        varying vec2 halo;
        void main() {
          halo = uv * 2.0 - 1.0;
          vec4 centre = modelViewMatrix * vec4(0.0,0.0,0.0,1.0);
          gl_Position = projectionMatrix * (centre + vec4(position.xy,0.0,0.0));
        }`,
      fragmentShader: `
        varying vec2 halo;
        uniform float time;
        void main() {
          float r = length(halo);
          float a = atan(halo.y, halo.x);
          float corona = exp(-11.5*r) * .88 + exp(-4.6*r) * .12;
          float wisps = pow(.5 + .5*sin(a*9.0 + sin(a*5.0-time)*1.2 - r*22.0 + time*1.9), 3.0);
          float flare = exp(-17.0*abs(halo.y + halo.x*.18)) * exp(-8.0*abs(halo.x)) * .13;
          float alpha = (corona*(1.0 + .46*wisps) + flare) * (1.0-smoothstep(.36,.88,r));
          gl_FragColor = vec4(1.0, .37 + .24*exp(-5.0*r), .10, alpha);
        }`,
    }),
  );
  glow.position.z = .51;
  glow.renderOrder = 2;
  root.add(glow);

  const lamp = new THREE.PointLight(0xffa05b, 14, 6, 2);
  lamp.position.z = .59;
  root.add(lamp);

  return seconds => {
    time.value = seconds;
    core.rotation.y = seconds * .43;
    lamp.intensity = 14 + Math.sin(seconds * 7.1) * 1.3 + Math.sin(seconds * 13.9) * .6;
  };
}

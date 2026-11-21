import * as THREE from 'three';

const turn = Math.PI * 2;
const moduleSize = .055;
const toothProfile = [
  [-.50, -.031], [-.38, -.031], [-.25, 0], [-.15, .030],
  [.15, .030], [.25, 0], [.38, -.031],
];

function annulus(profile, segments, toothCount = 0) {
  const positions = [];
  const indices = [];
  const steps = toothCount ? toothCount * toothProfile.length : segments;
  for (let band = 0; band < profile.length; band++) {
    const base = positions.length / 3;
    const nextBand = (band + 1) % profile.length;
    for (const [radius, z, toothed = false] of [profile[band], profile[nextBand]]) {
      for (let i = 0; i <= steps; i++) {
        const sample = toothProfile[i % toothProfile.length];
        const fraction = toothCount ? (Math.floor(i / toothProfile.length) + sample[0]) / toothCount : i / steps;
        const angle = fraction * turn;
        const actualRadius = radius + (toothed ? sample[1] : 0);
        const x = Math.cos(angle) * actualRadius;
        const y = Math.sin(angle) * actualRadius;
        positions.push(x, y, z);
      }
    }
    for (let i = 0; i < steps; i++) {
      const a = base + i;
      const b = a + steps + 1;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function rim(outer, inner, thickness, z, bevel = .02, segments = 72) {
  const bottom = z - thickness / 2;
  const top = z + thickness / 2;
  return annulus([
    [outer - bevel, bottom], [outer, bottom + bevel], [outer, top - bevel],
    [outer - bevel, top], [inner + bevel, top], [inner, top - bevel],
    [inner, bottom + bevel], [inner + bevel, bottom],
  ], segments);
}

function extrusion(points, depth, bevel) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

// Each rigid part is drawn once per material, even when it contains dozens of details.
function assembly(target) {
  const batches = new Map();
  return {
    add(geometry, material, x = 0, y = 0, z = 0, angle = 0) {
      const batch = batches.get(material) ?? { position: [], normal: [], uv: [], index: [] };
      batches.set(material, batch);
      const offset = batch.position.length / 3;
      const position = geometry.getAttribute('position');
      const normal = geometry.getAttribute('normal');
      const sine = Math.sin(angle);
      const cosine = Math.cos(angle);
      for (let i = 0; i < position.count; i++) {
        const px = position.getX(i);
        const py = position.getY(i);
        const nx = normal.getX(i);
        const ny = normal.getY(i);
        const tx = px * cosine - py * sine + x;
        const ty = px * sine + py * cosine + y;
        const pz = position.getZ(i) + z;
        batch.position.push(tx, ty, pz);
        batch.normal.push(nx * cosine - ny * sine, nx * sine + ny * cosine, normal.getZ(i));
        batch.uv.push((tx + pz * .64) * .66, (ty + pz * .81) * .66);
      }
      const index = geometry.getIndex();
      const count = index?.count ?? position.count;
      for (let i = 0; i < count; i++) batch.index.push(offset + (index ? index.getX(i) : i));
    },
    finish() {
      for (const [material, batch] of batches) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(batch.position, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(batch.normal, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(batch.uv, 2));
        geometry.setIndex(batch.index);
        target.add(new THREE.Mesh(geometry, material));
      }
    },
  };
}

function cylinder(radius, depth, segments = 24) {
  return new THREE.CylinderGeometry(radius, radius, depth, segments).rotateX(Math.PI / 2);
}

function ticks(batch, radius, z, count, material, size = 1) {
  const minor = new THREE.BoxGeometry(.052 * size, .012 * size, .006);
  const major = new THREE.BoxGeometry(.113 * size, .021 * size, .007);
  for (let i = 0; i < count; i++) {
    const angle = i * turn / count;
    batch.add(i % 5 ? minor : major, material, Math.cos(angle) * radius, Math.sin(angle) * radius, z, angle);
  }
}

function makeGear(gear, materials) {
  const { teeth, radius: r, central, silver, x, y, phase } = gear;
  const wheel = new THREE.Group();
  wheel.position.set(x, y, 0);
  wheel.rotation.z = phase;
  const batch = assembly(wheel);
  const thick = central ? .225 : .173;
  const toothBand = central ? .325 : r > .7 ? .168 : .112;
  const inner = r - toothBand;
  const front = thick / 2;
  const detail = central ? 112 : Math.max(32, Math.ceil(teeth * 1.3));
  const bevel = .016;
  const body = silver ? materials.silver : materials.matte;

  batch.add(annulus([
    [r - bevel, -front, true], [r, -front + bevel, true], [r, front - bevel, true],
    [r - bevel, front, true], [inner + .018, front], [inner, front - .018],
    [inner, -front + .018], [inner + .018, -front],
  ], 0, teeth), body);
  batch.add(rim(r - .058, inner + .026, .039, front + .010, .010, detail), body);
  batch.add(rim(inner + .037, inner + .017, .024, front + .031, .005, detail), materials.casting);
  batch.add(rim(r - .087, r - .107, .026, front + .036, .005, detail), silver ? materials.polished : materials.steel);

  const hub = central ? .64 : Math.max(.153, r * .305);
  const bore = central ? .357 : hub * .47;
  const spokes = central ? 6 : r > .85 ? 5 : r > .59 ? 4 : 3;
  const width = central ? .183 : r * .153;
  const spoke = extrusion([
    [hub * .83, -width * .68], [inner * .66 + hub * .34, -width * .70],
    [inner + .055, -width * 1.44], [inner + .055, width * .65],
    [inner * .76 + hub * .24, width * .42], [hub * .83, width * 1.04],
  ], thick * .63, .019);
  for (let i = 0; i < spokes; i++) {
    const angle = turn * i / spokes;
    batch.add(spoke, silver ? materials.silver : materials.casting, 0, 0, -.029, angle);
    if (central) {
      const fillet = extrusion([
        [hub + .023, -.019], [inner - .03, -.084],
        [inner - .03, -.038], [hub + .023, .041],
      ], .013, .007);
      batch.add(fillet, materials.steel, 0, 0, .050, angle);
    }
  }

  batch.add(rim(hub, bore, thick + .115, .024, .024, detail), body);
  batch.add(rim(hub * .92, hub * .78, .041, front + .100, .010, detail), materials.steel);
  batch.add(rim(hub * .77, bore + .012, .028, front + .086, .007, detail), materials.casting);
  if (central) {
    batch.add(rim(bore + .035, bore - .016, .041, front + .093, .009, 72), materials.polished);
    ticks(batch, r - .174, front + .032, 100, materials.ink);
    ticks(batch, hub * .855, front + .122, 40, materials.ink, .49);
  }
  if (teeth === 42) ticks(batch, r - .123, front + .032, 45, materials.ink, .57);

  const rivet = cylinder(central ? .043 : .022, .033, 12);
  for (let i = 0; i < spokes; i++) {
    const angle = i * turn / spokes;
    const distance = central ? r - .245 : hub * .85;
    const z = central ? front + .05 : front + .126;
    batch.add(rivet, materials.polished, Math.cos(angle) * distance, Math.sin(angle) * distance, z);
  }
  batch.finish();
  return wheel;
}

function buildChassis(root, gears, materials) {
  const frame = assembly(root);
  frame.add(rim(2.34, 2.216, .19, -.54, .035, 150), materials.casting);
  frame.add(rim(2.34, 2.259, .056, -.436, .014, 150), materials.steel);
  frame.add(rim(2.22, 2.173, .061, -.472, .011, 128), materials.recess);
  frame.add(rim(1.29, 1.218, .095, -.59, .023, 96), materials.matte);
  frame.add(rim(.763, .411, .18, -.56, .032, 96), materials.casting);
  frame.add(rim(.574, .439, .073, -.443, .022, 96), materials.polished);
  frame.add(cylinder(.452, .056, 64), materials.recess, 0, 0, -.58);
  ticks(frame, 2.291, -.405, 120, materials.ink, .58);

  const mountingBolt = cylinder(.062, .086, 12);
  const axleScrew = cylinder(.067, .041, 16);
  const slot = new THREE.BoxGeometry(.086, .012, .005);
  for (const gear of gears.slice(1)) {
    const { parent, x, y, radius, phase } = gear;
    const dx = x - parent.x;
    const dy = y - parent.y;
    const angle = Math.atan2(dy, dx);
    const distance = Math.hypot(dx, dy);
    const width = .14 + radius * .114;
    const arm = extrusion([
      [0, -width], [distance * .30, -width * .68], [distance * .68, -width * .64],
      [distance, -width * .93], [distance + .10, 0], [distance, width * .93],
      [distance * .59, width * .79], [distance * .28, width * .68], [0, width],
    ], .112, .032);
    frame.add(arm, materials.casting, parent.x, parent.y, -.547, angle);

    frame.add(cylinder(Math.max(.166, radius * .325), .19, 36), materials.casting, x, y, -.446);
    frame.add(rim(Math.max(.164, radius * .321), .105, .064, -.335, .013, 48), materials.steel, x, y);
    frame.add(cylinder(.103, .57, 24), materials.steel, x, y, -.087);
    frame.add(rim(.119, .07, .046, .191, .01, 24), materials.steel, x, y);
    frame.add(axleScrew, materials.polished, x, y, .220);
    frame.add(slot, materials.ink, x, y, .243, phase * 2 + radius);
    if (parent.central) {
      const tx = Math.cos(angle) * 2.294;
      const ty = Math.sin(angle) * 2.294;
      frame.add(mountingBolt, materials.matte, tx, ty, -.39, angle);
      frame.add(slot, materials.ink, tx, ty, -.345, angle);
    }
  }
  frame.finish();
}

export function buildMechanism(root, materials) {
  const first = { central: true, teeth: 70, radius: 70 * moduleSize / 2, x: 0, y: 0, phase: 0, ratio: 1 };
  const gears = [first];

  function meshWith(parent, teeth, degrees, silver = false) {
    const direction = THREE.MathUtils.degToRad(degrees);
    const radius = teeth * moduleSize / 2;
    const distance = parent.radius + radius;
    const period = turn / teeth;
    // On the line of centres, one gear's tooth phase complements the other's gap phase.
    const parentPhase = (direction - parent.phase) * parent.teeth / turn;
    const phase = THREE.MathUtils.euclideanModulo(direction + Math.PI - (.5 - parentPhase) * period, period);
    const gear = {
      parent, teeth, radius, phase, silver, ratio: -parent.ratio * parent.teeth / teeth,
      x: parent.x + Math.cos(direction) * distance,
      y: parent.y + Math.sin(direction) * distance,
    };
    gears.push(gear);
    return gear;
  }

  const left = meshWith(first, 34, 157, true);
  meshWith(left, 22, 216);
  const top = meshWith(first, 24, 94);
  meshWith(top, 18, 49, true);
  const right = meshWith(first, 42, 20);
  meshWith(right, 20, -19, true);
  const lowerRight = meshWith(first, 28, -52, true);
  meshWith(lowerRight, 16, -18);
  const lowerLeft = meshWith(first, 30, -123);
  meshWith(lowerLeft, 16, -167);

  buildChassis(root, gears, materials);
  for (const gear of gears) {
    gear.wheel = makeGear(gear, materials);
    root.add(gear.wheel);
  }

  return seconds => {
    const driver = seconds * .195 + Math.sin(seconds * 1.49) * .016;
    for (const gear of gears) gear.wheel.rotation.z = gear.phase + (driver * gear.ratio) % turn;
  };
}

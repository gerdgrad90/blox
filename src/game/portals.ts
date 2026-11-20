import * as THREE from 'three';

export type PortalKind = 'blue' | 'orange';

export interface PortalAnchorState {
  kind: PortalKind;
  position: [number, number, number];
  normal: [number, number, number];
  isHorizontal: boolean;
  createdAt: number;
}

export interface PortalRuntimeState {
  blueActive: boolean;
  orangeActive: boolean;
  linked: boolean;
  lastColor: PortalKind;
  transitCount: number;
  warpFlash: number;
  warpColor: PortalKind;
}

export interface PortalSurfaceTransform {
  position: [number, number, number];
  normal: [number, number, number];
  quaternion: [number, number, number, number];
  isHorizontal: boolean;
}

export interface PortalTransitResult {
  from: PortalKind;
  to: PortalKind;
  exitPos: [number, number, number];
  exitVel: [number, number, number];
  exitYaw: number | null;
  exitSpeed: number;
}

export function createInitialPortalState(): PortalRuntimeState {
  return {
    blueActive: false,
    orangeActive: false,
    linked: false,
    lastColor: 'blue',
    transitCount: 0,
    warpFlash: 0,
    warpColor: 'blue',
  };
}

/**
 * Pure helper computing world position, unit normal, and orientation quaternion for a 3D portal
 * placed onto any wall, floor, ceiling, or mid-air rift surface without Z-fighting.
 */
export function computePortalSurfaceTransform(
  hitPoint: readonly [number, number, number],
  hitNormal: readonly [number, number, number],
  fallbackLookDir: readonly [number, number, number]
): PortalSurfaceTransform {
  let nx = hitNormal[0];
  let ny = hitNormal[1];
  let nz = hitNormal[2];
  const nLen = Math.hypot(nx, ny, nz);

  if (nLen < 1e-4) {
    const fLen = Math.hypot(fallbackLookDir[0], fallbackLookDir[1], fallbackLookDir[2]) || 1;
    nx = -fallbackLookDir[0] / fLen;
    ny = 0;
    nz = -fallbackLookDir[2] / fLen;
    const hLen = Math.hypot(nx, nz);
    if (hLen < 1e-4) {
      nx = 0;
      nz = 1;
    } else {
      nx /= hLen;
      nz /= hLen;
    }
  } else {
    nx /= nLen;
    ny /= nLen;
    nz /= nLen;
  }

  const isHorizontal = Math.abs(ny) >= 0.65;
  // Offset slightly along normal to completely eliminate Z-fighting with walls/floors
  const offset = 0.11;
  const px = hitPoint[0] + nx * offset;
  // Keep vertical wall portals centered comfortably at player doorway height if placed near a floor edge
  const py = hitPoint[1] + ny * offset;
  const pz = hitPoint[2] + nz * offset;

  const normalVec = new THREE.Vector3(nx, ny, nz).normalize();
  const upRef = new THREE.Vector3(0, 1, 0);
  if (isHorizontal) {
    // Use player's horizontal facing axis as the portal oval's top axis on floors/ceilings
    let fx = fallbackLookDir[0];
    let fz = fallbackLookDir[2];
    const fLen = Math.hypot(fx, fz);
    if (fLen < 1e-4) {
      fx = 0;
      fz = -1;
    } else {
      fx /= fLen;
      fz /= fLen;
    }
    upRef.set(fx, 0, fz);
  }

  const xAxis = new THREE.Vector3().crossVectors(upRef, normalVec);
  if (xAxis.lengthSq() < 1e-5) {
    xAxis.set(1, 0, 0);
  } else {
    xAxis.normalize();
  }
  const yAxis = new THREE.Vector3().crossVectors(normalVec, xAxis).normalize();
  const rotMat = new THREE.Matrix4().makeBasis(xAxis, yAxis, normalVec);
  const quat = new THREE.Quaternion().setFromRotationMatrix(rotMat);

  return {
    position: [Number(px.toFixed(4)), Number(py.toFixed(4)), Number(pz.toFixed(4))],
    normal: [Number(normalVec.x.toFixed(4)), Number(normalVec.y.toFixed(4)), Number(normalVec.z.toFixed(4))],
    quaternion: [
      Number(quat.x.toFixed(5)),
      Number(quat.y.toFixed(5)),
      Number(quat.z.toFixed(5)),
      Number(quat.w.toFixed(5)),
    ],
    isHorizontal,
  };
}

/**
 * Pure momentum-conserving portal traversal physics.
 * When both Blue and Orange portals are active and the player enters one, teleports them out
 * of the linked partner portal while redirecting & boosting their velocity along the exit normal!
 */
export function evaluatePortalTransit(
  playerPos: readonly [number, number, number],
  playerVel: readonly [number, number, number],
  bluePortal: PortalAnchorState | null,
  orangePortal: PortalAnchorState | null,
  cooldownRemaining: number,
  triggerRadius: number = 2.15
): PortalTransitResult | null {
  if (!bluePortal || !orangePortal || cooldownRemaining > 0) return null;

  // Player torso center is roughly +1.55m above feet
  const torsoX = playerPos[0];
  const torsoY = playerPos[1] + 1.55;
  const torsoZ = playerPos[2];

  const distTo = (p: PortalAnchorState) => {
    const dx = torsoX - p.position[0];
    const dy = (torsoY - p.position[1]) * (p.isHorizontal ? 1.1 : 0.72);
    const dz = torsoZ - p.position[2];
    return Math.hypot(dx, dy, dz);
  };

  const dBlue = distTo(bluePortal);
  const dOrange = distTo(orangePortal);

  let entry: PortalAnchorState | null = null;
  let exit: PortalAnchorState | null = null;

  if (dBlue <= triggerRadius && dBlue <= dOrange) {
    entry = bluePortal;
    exit = orangePortal;
  } else if (dOrange <= triggerRadius) {
    entry = orangePortal;
    exit = bluePortal;
  }

  if (!entry || !exit) return null;

  const enx = exit.normal[0];
  const eny = exit.normal[1];
  const enz = exit.normal[2];

  // Conservation & exhilarating Portal-style momentum redirection
  const entrySpeed = Math.hypot(playerVel[0], playerVel[1], playerVel[2]);
  const exitSpeed = Math.max(13.5, Math.min(36.0, entrySpeed * 1.18 + 4.2));

  // Place player cleanly in front of exit portal so they never clip into the wall/floor
  const exitClearance = exit.isHorizontal ? 1.65 : 2.35;
  const exitFeetOffsetY = exit.isHorizontal
    ? eny >= 0
      ? 0.45
      : -2.8
    : -1.35;

  const exitPos: [number, number, number] = [
    Number((exit.position[0] + enx * exitClearance).toFixed(4)),
    Number((exit.position[1] + eny * exitClearance + exitFeetOffsetY).toFixed(4)),
    Number((exit.position[2] + enz * exitClearance).toFixed(4)),
  ];

  // Add slight playful upward lift on horizontal wall exits so momentum flings feel dramatic
  const wallLift = exit.isHorizontal ? 0 : 4.2;
  const exitVel: [number, number, number] = [
    Number((enx * exitSpeed).toFixed(4)),
    Number((eny * exitSpeed + wallLift).toFixed(4)),
    Number((enz * exitSpeed).toFixed(4)),
  ];

  // Face outward from wall exit portals; preserve player's horizontal yaw for floor/ceiling portals
  let exitYaw: number | null = null;
  if (!exit.isHorizontal && Math.hypot(enx, enz) > 0.1) {
    // Engine forward vector is (-sin(yaw), 0, -cos(yaw)), so yaw = atan2(-enx, -enz)
    exitYaw = Math.atan2(-enx, -enz);
  }

  return {
    from: entry.kind,
    to: exit.kind,
    exitPos,
    exitVel,
    exitYaw,
    exitSpeed: Number(exitSpeed.toFixed(3)),
  };
}

const PORTAL_VORTEX_VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const PORTAL_VORTEX_FRAGMENT_SHADER = `
  uniform float uTime;
  uniform float uLinked;
  uniform vec3 uColorInner;
  uniform vec3 uColorOuter;
  varying vec2 vUv;

  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    if (r > 1.0) discard;

    float angle = atan(p.y, p.x);
    float swirl = sin(angle * 5.0 - r * 11.0 + uTime * 4.8) * 0.5 + 0.5;
    float ripple = sin(r * 16.0 - uTime * 6.2 + angle * 2.0) * 0.5 + 0.5;
    float radialCore = smoothstep(0.98, 0.12, r);
    float edgeGlow = smoothstep(0.55, 0.96, r);

    // Deep cosmic dimensional interior when linked, calmer energy mist when unlinked
    vec3 abyss = mix(vec3(0.02, 0.04, 0.12), uColorInner * 0.45, swirl * 0.7);
    vec3 vortex = mix(abyss, uColorOuter, edgeGlow * 0.92 + ripple * 0.25 * (0.45 + 0.55 * uLinked));

    // Bright star-like spiral streaks inside the active wormhole
    float streak = pow(max(0.0, sin(angle * 3.0 + r * 9.0 - uTime * 5.4)), 6.0) * radialCore;
    vortex += mix(uColorInner, vec3(1.0), 0.55) * streak * (0.45 + 0.65 * uLinked);

    // Hot luminous white-tinted rim ring
    float rim = smoothstep(0.82, 0.96, r) * (1.0 - smoothstep(0.96, 1.0, r));
    vortex += vec3(1.0) * rim * 0.85;

    float alpha = (0.72 + 0.26 * uLinked) * (1.0 - smoothstep(0.93, 1.0, r));
    gl_FragColor = vec4(vortex, alpha);
  }
`;

/**
 * Builds an animated 3D dimensional vortex portal (GLSL ShaderMaterial core + beveled glowing rim
 * + dark Aperture anchor collar + orbiting energy sparks).
 */
export function createPortalMesh3D(kind: PortalKind) {
  const root = new THREE.Group();
  root.name = `SpatialPortal3D_${kind}`;
  root.visible = false;

  const isBlue = kind === 'blue';
  const primaryHex = isBlue ? 0x00e5ff : 0xff7300;
  const secondaryHex = isBlue ? 0x38bdf8 : 0xfbbf24;

  // Oval doorway dimensions (1.42m wide x 2.35m tall)
  const scaleX = 1.42;
  const scaleY = 2.35;

  // 1. Custom GLSL Swirling Wormhole Vortex Core
  const shaderMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uLinked: { value: 0 },
      uColorInner: { value: new THREE.Color(secondaryHex) },
      uColorOuter: { value: new THREE.Color(primaryHex) },
    },
    vertexShader: PORTAL_VORTEX_VERTEX_SHADER,
    fragmentShader: PORTAL_VORTEX_FRAGMENT_SHADER,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const vortexCore = new THREE.Mesh(new THREE.CircleGeometry(1.0, 32), shaderMat);
  vortexCore.scale.set(scaleX * 0.96, scaleY * 0.96, 1);
  vortexCore.position.z = 0.02;
  vortexCore.renderOrder = 14;
  root.add(vortexCore);

  // 2. Primary Neon Energy Rim Ring
  const rimMat = new THREE.MeshBasicMaterial({
    color: primaryHex,
    transparent: true,
    opacity: 0.96,
  });
  const outerRim = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.075, 14, 40), rimMat);
  outerRim.scale.set(scaleX, scaleY, 0.65);
  outerRim.position.z = 0.03;
  root.add(outerRim);

  // 3. Soft Additive Outer Halo Ring
  const haloMat = new THREE.MeshBasicMaterial({
    color: secondaryHex,
    transparent: true,
    opacity: 0.34,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const outerHalo = new THREE.Mesh(new THREE.RingGeometry(0.96, 1.24, 36), haloMat);
  outerHalo.scale.set(scaleX, scaleY, 1);
  outerHalo.position.z = 0.015;
  root.add(outerHalo);

  // 4. Dark Metallic Anchor Collar Frame behind the plasma ring
  const collarMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.35,
    metalness: 0.85,
  });
  const anchorCollar = new THREE.Mesh(new THREE.TorusGeometry(1.04, 0.045, 10, 36), collarMat);
  anchorCollar.scale.set(scaleX, scaleY, 0.5);
  anchorCollar.position.z = -0.02;
  root.add(anchorCollar);

  // 5. Orbiting Energy Sparks around the perimeter
  const sparksGroup = new THREE.Group();
  const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const sparkGeo = new THREE.OctahedronGeometry(0.08, 0);
  const sparkNodes: { mesh: THREE.Mesh; phase: number; speed: number }[] = [];
  for (let i = 0; i < 8; i++) {
    const sMesh = new THREE.Mesh(sparkGeo, sparkMat);
    sparksGroup.add(sMesh);
    sparkNodes.push({
      mesh: sMesh,
      phase: (i / 8) * Math.PI * 2,
      speed: (isBlue ? 1 : -1) * (1.8 + (i % 3) * 0.45),
    });
  }
  root.add(sparksGroup);

  root.traverse((obj) => {
    obj.frustumCulled = false;
  });

  let openScale = 0.01;

  const setPlacement = (transform: PortalSurfaceTransform) => {
    root.position.set(transform.position[0], transform.position[1], transform.position[2]);
    root.quaternion.set(
      transform.quaternion[0],
      transform.quaternion[1],
      transform.quaternion[2],
      transform.quaternion[3]
    );
    root.visible = true;
    openScale = 0.12;
    root.scale.setScalar(openScale);
  };

  const hide = () => {
    root.visible = false;
  };

  const update = (time: number, dt: number, linked: boolean) => {
    if (!root.visible) return;
    // Juicy spring open animation
    if (openScale < 1.0) {
      openScale = Math.min(1.0, openScale + dt * 6.5);
      const overshoot = openScale < 0.85 ? openScale * 1.08 : 1.0 + Math.sin(openScale * Math.PI) * 0.06;
      root.scale.setScalar(Math.min(1.08, overshoot));
    } else {
      const breathe = 1.0 + Math.sin(time * 4.5 + (isBlue ? 0 : 1.5)) * 0.022;
      root.scale.setScalar(breathe);
    }

    shaderMat.uniforms.uTime.value = time;
    shaderMat.uniforms.uLinked.value = linked ? 1.0 : 0.25;
    haloMat.opacity = (linked ? 0.42 : 0.24) + Math.sin(time * 6.0) * 0.07;

    for (let i = 0; i < sparkNodes.length; i++) {
      const s = sparkNodes[i];
      const a = s.phase + time * s.speed;
      s.mesh.position.set(Math.cos(a) * scaleX * 1.03, Math.sin(a) * scaleY * 1.03, 0.11 + Math.sin(a * 3) * 0.05);
      s.mesh.rotation.set(time * 3, time * 2, 0);
    }
  };

  return { root, shaderMat, setPlacement, hide, update };
}

/**
 * Builds a composite 8-part procedural sci-fi 3D Portal Gun (Aperture-inspired white ceramic shell,
 * glowing dynamic cyan/orange plasma chamber, dark titanium chassis, and 3 energy prongs).
 */
export function createPortalGunModel3D(scale: number = 1.0) {
  const root = new THREE.Group();
  root.name = 'PortalGun3D';
  root.scale.setScalar(scale);

  const ceramicMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.22,
    metalness: 0.15,
  });
  const chassisMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.55,
    metalness: 0.72,
  });
  const metalMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.3,
    metalness: 0.88,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    roughness: 0.1,
    metalness: 0.1,
    transparent: true,
    opacity: 0.38,
  });
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0x00e5ff,
  });

  // 1. Rear sleek curved white ceramic shell
  const rearShell = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.11, 8, 14), ceramicMat);
  rearShell.rotation.x = Math.PI / 2;
  rearShell.position.set(0, 0.015, 0.055);
  root.add(rearShell);

  // 2. Dark mechanical central chassis
  const coreBody = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.042, 0.24, 14), chassisMat);
  coreBody.rotation.x = Math.PI / 2;
  coreBody.position.set(0, 0.01, -0.05);
  root.add(coreBody);

  // 3. Translucent plasma glass chamber
  const chamberGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.095, 14), glassMat);
  chamberGlass.rotation.x = Math.PI / 2;
  chamberGlass.position.set(0, 0.014, -0.045);
  root.add(chamberGlass);

  // 4. Luminous plasma core orb inside chamber (dynamically changes Cyan <-> Orange)
  const plasmaCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.028, 1), coreMat);
  plasmaCore.position.set(0, 0.014, -0.045);
  root.add(plasmaCore);

  // 5. White front nose shroud
  const frontShroud = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.045, 0.09, 14), ceramicMat);
  frontShroud.rotation.x = Math.PI / 2;
  frontShroud.position.set(0, 0.012, -0.155);
  root.add(frontShroud);

  // 6. Glowing muzzle emitter ring
  const muzzleRing = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.0065, 8, 18), coreMat);
  muzzleRing.position.set(0, 0.012, -0.205);
  root.add(muzzleRing);

  // 7. Three signature angled metallic energy prongs around muzzle
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2 + Math.PI / 6;
    const prong = new THREE.Mesh(new THREE.BoxGeometry(0.011, 0.011, 0.11), metalMat);
    prong.position.set(Math.cos(angle) * 0.046, 0.012 + Math.sin(angle) * 0.046, -0.22);
    prong.rotation.z = angle;
    prong.rotation.x = 0.22;
    root.add(prong);
  }

  // 8. Ergonomic handle grip
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.095, 0.044), chassisMat);
  grip.position.set(0, -0.045, 0.04);
  grip.rotation.x = 0.24;
  root.add(grip);

  root.traverse((obj) => {
    obj.frustumCulled = false;
  });

  const setMode = (kind: PortalKind, animTime: number = 0) => {
    coreMat.color.setHex(kind === 'blue' ? 0x00e5ff : 0xff7300);
    plasmaCore.rotation.set(animTime * 3.2, animTime * 4.1, 0);
  };

  return { root, plasmaCore, coreMat, setMode };
}

/**
 * Builds an animated plasma shot beam + impact burst ring shown briefly when firing a portal.
 */
export function createPortalShotBeam3D() {
  const root = new THREE.Group();
  root.name = 'PortalShotBeam3D';
  root.visible = false;

  const beamMat = new THREE.MeshBasicMaterial({
    color: 0x00e5ff,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  const beamMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.14, 1.0, 10, 1, true), beamMat);
  root.add(beamMesh);

  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const impactRing = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.72, 24), ringMat);
  root.add(impactRing);

  root.traverse((obj) => {
    obj.frustumCulled = false;
  });

  let timer = 0;
  const duration = 0.26;
  const upVec = new THREE.Vector3(0, 1, 0);
  const dirVec = new THREE.Vector3();
  const midVec = new THREE.Vector3();

  const trigger = (
    origin: readonly [number, number, number],
    target: readonly [number, number, number],
    kind: PortalKind
  ) => {
    const start = new THREE.Vector3(origin[0], origin[1], origin[2]);
    const end = new THREE.Vector3(target[0], target[1], target[2]);
    dirVec.subVectors(end, start);
    const len = Math.max(0.25, dirVec.length());
    midVec.addVectors(start, end).multiplyScalar(0.5);

    beamMesh.position.copy(midVec);
    beamMesh.scale.set(1, len, 1);
    beamMesh.quaternion.setFromUnitVectors(upVec, dirVec.normalize());

    impactRing.position.copy(end);
    impactRing.lookAt(start);
    impactRing.scale.setScalar(0.5);

    beamMat.color.setHex(kind === 'blue' ? 0x00e5ff : 0xff7300);
    ringMat.color.setHex(kind === 'blue' ? 0x7dd3fc : 0xfde047);
    beamMat.opacity = 0.92;
    ringMat.opacity = 0.95;

    timer = duration;
    root.visible = true;
  };

  const update = (dt: number) => {
    if (timer <= 0) {
      root.visible = false;
      return;
    }
    timer -= dt;
    const progress = 1 - Math.max(0, timer / duration);
    const fade = Math.max(0, 1 - progress);
    beamMat.opacity = fade * 0.9;
    beamMesh.scale.x = Math.max(0.15, fade);
    beamMesh.scale.z = Math.max(0.15, fade);
    ringMat.opacity = fade * 0.95;
    impactRing.scale.setScalar(0.5 + progress * 2.4);
    if (timer <= 0) {
      root.visible = false;
    }
  };

  return { root, trigger, update };
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computePortalSurfaceTransform,
  evaluatePortalTransit,
  createPortalMesh3D,
  createPortalGunModel3D,
  createPortalShotBeam3D,
  createInitialPortalState,
  PortalAnchorState,
} from './portals';

test('computePortalSurfaceTransform offsets along wall and floor normals without Z-fighting', () => {
  const wall = computePortalSurfaceTransform([10, 4, -8], [0, 0, 1], [0, 0, -1]);
  assert.equal(wall.isHorizontal, false);
  assert.ok(wall.position[2] > -8.0, 'Wall portal must sit slightly proud of wall surface');
  assert.ok(Math.abs(wall.normal[2] - 1) < 1e-4);

  const floor = computePortalSurfaceTransform([2, 0, 3], [0, 1, 0], [0, 0, -1]);
  assert.equal(floor.isHorizontal, true);
  assert.ok(floor.position[1] > 0, 'Floor portal must sit slightly above floor');
  assert.ok(Math.abs(floor.normal[1] - 1) < 1e-4);

  // Degenerate zero normal falls back cleanly opposite to look direction
  const midAir = computePortalSurfaceTransform([0, 3, -12], [0, 0, 0], [0, 0, -1]);
  assert.equal(midAir.isHorizontal, false);
  assert.ok(Math.abs(midAir.normal[2] - 1) < 1e-4);
});

test('evaluatePortalTransit teleports between linked portals with momentum conservation and cooldown guard', () => {
  const blue: PortalAnchorState = {
    kind: 'blue',
    position: [0, 0.11, -5],
    normal: [0, 1, 0],
    isHorizontal: true,
    createdAt: 1,
  };
  const orange: PortalAnchorState = {
    kind: 'orange',
    position: [12, 8, -20],
    normal: [0, 0, 1],
    isHorizontal: false,
    createdAt: 2,
  };

  // Single portal does not teleport
  assert.equal(evaluatePortalTransit([0, 0, -5], [0, -20, 0], blue, null, 0), null);

  // Active cooldown prevents infinite ping-pong loop
  assert.equal(evaluatePortalTransit([0, 0, -5], [0, -20, 0], blue, orange, 0.35), null);

  // Falling fast into floor Blue Portal launches fast out of wall Orange Portal (+Z)
  const transit = evaluatePortalTransit([0, 0, -5], [0, -24, 0], blue, orange, 0);
  assert.ok(transit, 'Player falling into floor portal must transit to linked partner');
  assert.equal(transit.from, 'blue');
  assert.equal(transit.to, 'orange');
  assert.ok(transit.exitPos[2] > orange.position[2] + 1.5, 'Exit pos must clear exit wall');
  assert.ok(transit.exitVel[2] >= 25, 'Falling momentum must be converted into outward wall velocity');
  assert.ok(transit.exitYaw !== null, 'Wall exit portal must provide outward yaw');
});

test('createPortalMesh3D, createPortalGunModel3D, and createPortalShotBeam3D build safely in Node with frustumCulled=false', () => {
  const initState = createInitialPortalState();
  assert.equal(initState.linked, false);
  assert.equal(initState.transitCount, 0);

  const blueMesh = createPortalMesh3D('blue');
  assert.equal(blueMesh.root.visible, false);
  blueMesh.root.traverse((obj) => assert.equal(obj.frustumCulled, false));

  const placement = computePortalSurfaceTransform([0, 3, -10], [0, 0, 1], [0, 0, -1]);
  blueMesh.setPlacement(placement);
  assert.equal(blueMesh.root.visible, true);
  blueMesh.update(1.5, 0.05, true);
  assert.equal(blueMesh.shaderMat.uniforms.uLinked.value, 1.0);

  const gun = createPortalGunModel3D(1.0);
  gun.setMode('orange', 1.2);
  assert.equal(gun.coreMat.color.getHex(), 0xff7300);

  const beam = createPortalShotBeam3D();
  beam.trigger([0, 3, 0], [0, 3, -10], 'blue');
  assert.equal(beam.root.visible, true);
  beam.update(0.35);
  assert.equal(beam.root.visible, false);
});

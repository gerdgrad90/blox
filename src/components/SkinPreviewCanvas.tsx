import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RobloxAvatar } from '../game/avatar';
import { CharacterSkin } from '../game/types';
import { RefreshCw } from 'lucide-react';

interface SkinPreviewCanvasProps {
  skin: CharacterSkin;
}

const isSoftwareGl = (() => {
  if (typeof document === 'undefined') return false;
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
})();

function normalizeShortestTargetAngle(current: number, target: number): number {
  const twoPi = Math.PI * 2;
  const diff = (((target - current) % twoPi) + twoPi + Math.PI) % twoPi - Math.PI;
  return current + diff;
}

export const SkinPreviewCanvas: React.FC<SkinPreviewCanvasProps> = ({ skin }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<RobloxAvatar | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rotYRef = useRef<number>(0);
  const targetRotYRef = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);
  const lastMouseXRef = useRef<number>(0);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const autoRotateRef = useRef<boolean>(true);

  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  // Initialize Three.js viewport once
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const initialW = container.clientWidth || 300;
    const initialH = container.clientHeight || 320;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(40, initialW / initialH, 0.1, 60);

    const updateCameraFraming = (w: number, h: number) => {
      if (w <= 0 || h <= 0) return;
      const aspect = w / h;
      camera.aspect = aspect;
      const halfVFovRad = THREE.MathUtils.degToRad(camera.fov * 0.5);
      const tanHalfV = Math.tan(halfVFovRad);
      // Full character + pedestal spans y = 0.8..7.45 (tallest hats like top_hat/viking).
      // Aim slightly below center so the feet & pedestal clear the bottom toolbar and the full head & hat fit below the top hint.
      const minZForHeight = 4.4 / tanHalfV;
      const minZForWidth = 2.65 / (tanHalfV * Math.max(0.35, aspect));
      const dist = Math.max(minZForHeight, minZForWidth);
      camera.position.set(0, 4.25, dist);
      camera.lookAt(0, 3.95, 0);
      camera.updateProjectionMatrix();
    };

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(initialW, initialH);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    updateCameraFraming(initialW, initialH);
    container.appendChild(renderer.domElement);

    // Procedural studio reflection environment for metallic hats & jetpack finishes
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    // Warm/cool 3-point studio lighting rig
    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x1e293b, 0.9);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfffbeb, 1.45);
    keyLight.position.set(4, 9, 6);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.75);
    fillLight.position.set(-4, 5, 3);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xfef08a, 0.9);
    rimLight.position.set(0, 6, -5);
    scene.add(rimLight);

    // Circular Studio Pedestal Floor
    const pedestalGeo = new THREE.CylinderGeometry(2.2, 2.4, 0.2, 32);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.6,
      metalness: 0.25,
    });
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestal.position.set(0, 0.9, 0);
    pedestal.receiveShadow = true;
    scene.add(pedestal);

    // Pedestal glow ring
    const ringGeo = new THREE.RingGeometry(2.15, 2.3, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, 1.01, 0);
    scene.add(ring);

    // Create 3D Avatar
    const avatar = new RobloxAvatar(skin);
    avatar.root.position.set(0, 1.0, 0);
    avatar.setNameplate('');
    avatar.toolMount.visible = false;
    scene.add(avatar.root);
    avatarRef.current = avatar;

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Animation Loop
    let frameId = 0;
    let disposed = false;
    let lastTime = performance.now();

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext | null;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    };

    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      if (autoRotateRef.current && !isDraggingRef.current) {
        targetRotYRef.current += dt * 0.75;
      }

      // Smooth damping rotation
      rotYRef.current = THREE.MathUtils.damp(rotYRef.current, targetRotYRef.current, 12, dt);
      if (avatarRef.current) {
        avatarRef.current.root.rotation.y = rotYRef.current;
        avatarRef.current.update(dt, now / 1000);
      }

      renderer.render(scene, camera);
      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    frameId = requestAnimationFrame(tick);

    // Responsive Resize via ResizeObserver + window resize
    const handleResize = () => {
      if (!container || disposed) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w > 0 && h > 0) {
        updateCameraFraming(w, h);
        renderer.setSize(w, h);
      }
    };

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(container);
    }
    window.addEventListener('resize', handleResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', handleResize);
      if (avatarRef.current) {
        avatarRef.current.dispose();
        avatarRef.current = null;
      }
      pedestalGeo.dispose();
      pedestalMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      envTarget.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Sync changes in skin props with the 3D avatar
  useEffect(() => {
    if (avatarRef.current) {
      avatarRef.current.updateSkin(skin);
      avatarRef.current.setNameplate('');
      avatarRef.current.toolMount.visible = false;
    }
  }, [skin]);

  // Pointer Drag Controls for 360 view
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = true;
    lastMouseXRef.current = e.clientX;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const delta = e.clientX - lastMouseXRef.current;
    lastMouseXRef.current = e.clientX;
    targetRotYRef.current += delta * 0.018;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = false;
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const setViewAngle = (angleRad: number) => {
    autoRotateRef.current = false;
    setAutoRotate(false);
    targetRotYRef.current = normalizeShortestTargetAngle(rotYRef.current, angleRad);
  };

  const handleToggleAutoRotate = () => {
    setAutoRotate((prev) => {
      const next = !prev;
      autoRotateRef.current = next;
      if (!next) {
        // Freeze target at current damped angle so rotation stops immediately without drift
        targetRotYRef.current = rotYRef.current;
      }
      return next;
    });
  };

  return (
    <div className="relative w-full h-full min-h-[160px] flex flex-col items-center justify-between bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 rounded-2xl border border-slate-700/80 shadow-inner overflow-hidden select-none">
      {/* 3D Canvas Container */}
      <div
        ref={mountRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="w-full h-full flex-1 cursor-grab active:cursor-grabbing touch-none"
        title="Потяните мышью или пальцем для вращения на 360°"
      />

      {/* Floating View Controls & Angle Presets */}
      <div className="absolute bottom-2.5 inset-x-3 flex items-center justify-between gap-1.5 p-1.5 rounded-xl bg-slate-900/95 border border-slate-700/80 shadow-lg pointer-events-auto">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setViewAngle(0)}
            className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-200 transition-colors cursor-pointer"
          >
            Спереди
          </button>
          <button
            type="button"
            onClick={() => setViewAngle(Math.PI)}
            className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-sky-300 transition-colors cursor-pointer"
            title="Осмотреть рюкзак / джетпак сзади"
          >
            Сзади 🎒
          </button>
        </div>

        <button
          type="button"
          onClick={handleToggleAutoRotate}
          aria-pressed={autoRotate}
          data-testid="preview-auto-rotate-toggle"
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
            autoRotate
              ? 'bg-sky-500/20 text-sky-400 border border-sky-400/40'
              : 'bg-slate-800 text-slate-400 hover:text-white border border-transparent'
          }`}
          title="Включить / выключить авто-вращение"
        >
          <RefreshCw size={12} className={autoRotate ? 'animate-spin' : ''} />
          <span>360°</span>
        </button>
      </div>

      {/* Top hint tag */}
      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-slate-950/80 border border-slate-700/50 text-[10px] text-slate-400 font-medium pointer-events-none">
        3D Превью (тяните для вращения)
      </div>
    </div>
  );
};

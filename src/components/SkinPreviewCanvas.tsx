import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RobloxAvatar } from '../game/avatar';
import { CharacterSkin } from '../game/types';
import { RotateCw, RefreshCw } from 'lucide-react';

interface SkinPreviewCanvasProps {
  skin: CharacterSkin;
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

  // Initialize Three.js viewport
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 240;
    const height = container.clientHeight || 320;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 50);
    camera.position.set(0, 3.2, 7.8);
    camera.lookAt(0, 3.0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);

    // Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
    keyLight.position.set(4, 8, 6);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.75);
    fillLight.position.set(-4, 4, 3);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xfef08a, 0.9);
    rimLight.position.set(0, 6, -5);
    scene.add(rimLight);

    // Circular Studio Pedestal Floor
    const pedestalGeo = new THREE.CylinderGeometry(2.2, 2.4, 0.2, 32);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.6,
      metalness: 0.2,
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
    scene.add(avatar.root);
    avatarRef.current = avatar;

    // Animation Loop
    let animId = 0;
    let lastTime = performance.now();

    const animate = () => {
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      if (autoRotate && !isDraggingRef.current) {
        targetRotYRef.current += dt * 0.75;
      }

      // Smooth damping rotation
      rotYRef.current = THREE.MathUtils.damp(rotYRef.current, targetRotYRef.current, 12, dt);
      if (avatarRef.current) {
        avatarRef.current.root.rotation.y = rotYRef.current;
        avatarRef.current.update(dt, now / 1000);
      }

      renderer.render(scene, camera);
      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);

    // Responsive Resize
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w > 0 && h > 0) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      if (avatarRef.current) {
        avatarRef.current.dispose();
      }
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
    }
  }, [skin]);

  // Mouse & Touch Drag Controls for 360 view
  const handlePointerDown = (clientX: number) => {
    isDraggingRef.current = true;
    lastMouseXRef.current = clientX;
  };

  const handlePointerMove = (clientX: number) => {
    if (!isDraggingRef.current) return;
    const delta = clientX - lastMouseXRef.current;
    lastMouseXRef.current = clientX;
    targetRotYRef.current += delta * 0.018;
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  const setViewAngle = (angleRad: number) => {
    targetRotYRef.current = angleRad;
    setAutoRotate(false);
  };

  return (
    <div className="relative w-full h-full min-h-[260px] sm:min-h-[340px] flex flex-col items-center justify-between bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 rounded-2xl border border-slate-700/80 shadow-inner overflow-hidden select-none">
      {/* 3D Canvas Container */}
      <div
        ref={mountRef}
        onMouseDown={(e) => handlePointerDown(e.clientX)}
        onMouseMove={(e) => handlePointerMove(e.clientX)}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchStart={(e) => handlePointerDown(e.touches[0].clientX)}
        onTouchMove={(e) => handlePointerMove(e.touches[0].clientX)}
        onTouchEnd={handlePointerUp}
        className="w-full flex-1 cursor-grab active:cursor-grabbing touch-none"
        title="Потяните мышью или пальцем для вращения на 360°"
      />

      {/* Floating View Controls & Angle Presets */}
      <div className="absolute bottom-2.5 inset-x-3 flex items-center justify-between gap-1.5 p-1.5 rounded-xl bg-slate-900/90 border border-slate-700/80 backdrop-blur-md shadow-lg pointer-events-auto">
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
          onClick={() => setAutoRotate((prev) => !prev)}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
            autoRotate
              ? 'bg-sky-500/20 text-sky-400 border border-sky-400/40'
              : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
          title="Включить / выключить авто-вращение"
        >
          <RefreshCw size={12} className={autoRotate ? 'animate-spin' : ''} />
          <span>360°</span>
        </button>
      </div>

      {/* Top hint tag */}
      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-slate-950/70 border border-slate-700/50 text-[10px] text-slate-400 font-medium pointer-events-none">
        3D Превью (тяните для вращения)
      </div>
    </div>
  );
};

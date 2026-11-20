import * as THREE from 'three';
import { RobloxAvatar } from './avatar';
import { CharacterSkin } from './types';

const portraitCache = new Map<string, string>();
let sharedRenderer: THREE.WebGLRenderer | null = null;

function getSkinCacheKey(skin: CharacterSkin): string {
  return [
    skin.skinColor,
    skin.torsoColor,
    skin.legsColor,
    skin.headShape || 'round',
    skin.hat || 'none',
    skin.face || 'smile',
    skin.outfit || '',
    skin.shirt || '',
    skin.pants || '',
    skin.backpack || 'none',
  ].join('|');
}

function getPortraitRenderer(): THREE.WebGLRenderer | null {
  if (typeof document === 'undefined') return null;
  if (sharedRenderer) return sharedRenderer;

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 160;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(160, 160, false);
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    sharedRenderer = renderer;
    return renderer;
  } catch {
    return null;
  }
}

/**
 * Renders a crisp front-facing 3D portrait snapshot of the player's equipped RobloxAvatar
 * looking straight at the viewer. Cached by visual skin attributes so it updates instantly
 * whenever clothing, face, hat, or colors change.
 */
export function renderAvatarPortrait(skin: CharacterSkin): string | null {
  const key = getSkinCacheKey(skin);
  const cached = portraitCache.get(key);
  if (cached) return cached;

  const renderer = getPortraitRenderer();
  if (!renderer) return null;

  try {
    const scene = new THREE.Scene();

    const ambient = new THREE.AmbientLight(0xffffff, 1.05);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.35);
    keyLight.position.set(2.5, 6.5, 5.5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.7);
    fillLight.position.set(-3.5, 4.5, 3.0);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xfef08a, 0.65);
    rimLight.position.set(0, 6.0, -4.0);
    scene.add(rimLight);

    const avatar = new RobloxAvatar(skin);
    avatar.setNameplate('');
    avatar.toolMount.visible = false;
    // Face directly forward toward the camera (+Z) with a slight welcoming head pose
    avatar.root.rotation.set(0, 0, 0);
    avatar.headGroup.rotation.set(0.03, 0, 0);
    scene.add(avatar.root);

    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 30);
    camera.position.set(0, 4.42, 3.65);
    camera.lookAt(0, 4.32, 0);

    renderer.clear();
    renderer.render(scene, camera);

    const dataUrl = renderer.domElement.toDataURL('image/png');
    avatar.dispose();

    if (portraitCache.size > 40) {
      const firstKey = portraitCache.keys().next().value;
      if (firstKey) portraitCache.delete(firstKey);
    }
    portraitCache.set(key, dataUrl);
    return dataUrl;
  } catch {
    return null;
  }
}

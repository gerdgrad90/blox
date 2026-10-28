import * as THREE from 'three';
import { CharacterSkin, ToolType, ShirtOutfit, PantsOutfit } from './types';

export class RobloxAvatar {
  public root: THREE.Group;
  public headGroup: THREE.Group;
  public headMesh: THREE.Mesh;
  public torsoMesh: THREE.Mesh;
  public backpackGroup: THREE.Group;
  public leftArmGroup: THREE.Group;
  public leftArmMesh: THREE.Mesh;
  public leftHandMesh: THREE.Mesh;
  public rightArmGroup: THREE.Group;
  public rightArmMesh: THREE.Mesh;
  public rightHandMesh: THREE.Mesh;
  public leftLegGroup: THREE.Group;
  public leftLegMesh: THREE.Mesh;
  public rightLegGroup: THREE.Group;
  public rightLegMesh: THREE.Mesh;

  public toolMount: THREE.Group;
  public swordMesh: THREE.Group;
  public speedCoilMesh: THREE.Group;
  public gravityCoilMesh: THREE.Group;
  public hammerMesh: THREE.Group;
  public jetpackRemoteMesh: THREE.Group;
  public bloxyColaMesh: THREE.Group;

  public hatGroup: THREE.Group;

  private headMaterial: THREE.MeshStandardMaterial;
  private torsoMaterial: THREE.MeshStandardMaterial;
  private sleeveMaterial: THREE.MeshStandardMaterial;
  private legsMaterial: THREE.MeshStandardMaterial;
  private faceTexture: THREE.CanvasTexture | null = null;
  private torsoTexture: THREE.CanvasTexture | null = null;
  private legsTexture: THREE.CanvasTexture | null = null;

  // Animation state
  public walkPhase: number = 0;
  public isMoving: boolean = false;
  public isGrounded: boolean = true;
  public isEmoting: boolean = false;
  public isAttacking: boolean = false;
  public attackTimer: number = 0;
  public squashY: number = 1;
  public targetSquashY: number = 1;

  constructor(skin: CharacterSkin) {
    this.root = new THREE.Group();
    this.root.name = 'RobloxAvatar';

    // Base Materials
    this.headMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(skin.skinColor),
      roughness: 0.6,
      metalness: 0.05,
    });

    this.torsoMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(skin.torsoColor),
      roughness: 0.7,
      metalness: 0.05,
    });

    this.sleeveMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#141619'),
      roughness: 0.45,
      metalness: 0.15,
    });

    this.legsMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(skin.legsColor),
      roughness: 0.75,
      metalness: 0.02,
    });

    // 1. Torso (Size: 2 x 2 x 1, centered at y = 3)
    const torsoGeo = new THREE.BoxGeometry(2, 2, 1);
    this.torsoMesh = new THREE.Mesh(torsoGeo, this.createTorsoMaterials(skin));
    this.torsoMesh.position.set(0, 3, 0);
    this.torsoMesh.castShadow = true;
    this.torsoMesh.receiveShadow = true;
    this.root.add(this.torsoMesh);

    // Backpack / Jetpack Group attached to Torso so it moves & breathes with the body
    this.backpackGroup = new THREE.Group();
    this.backpackGroup.position.set(0, 0, -0.55);
    this.torsoMesh.add(this.backpackGroup);
    this.updateBackpack(skin.backpack || 'none');

    // 2. Head (Size: 1.25 x 1.25 x 1.25, centered at y = 4.7)
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 4.7, 0);
    this.root.add(this.headGroup);

    const headGeo = new THREE.BoxGeometry(1.25, 1.25, 1.25);
    const headMaterials = this.createHeadMaterials(skin);
    this.headMesh = new THREE.Mesh(headGeo, headMaterials);
    this.headMesh.castShadow = true;
    this.headGroup.add(this.headMesh);

    // Head Hat / Hair / Accessory
    this.hatGroup = new THREE.Group();
    this.hatGroup.position.set(0, 0.65, 0);
    this.headGroup.add(this.hatGroup);
    this.updateHat(skin.hat, skin.skinColor);

    // 3. Left Arm (Pivot at shoulder: x = -1.5, y = 4.0, z = 0)
    this.leftArmGroup = new THREE.Group();
    this.leftArmGroup.position.set(-1.5, 4.0, 0);
    this.root.add(this.leftArmGroup);

    const armGeo = new THREE.BoxGeometry(1, 2, 1);
    this.leftArmMesh = new THREE.Mesh(armGeo, this.headMaterial);
    this.leftArmMesh.position.set(0, -1, 0);
    this.leftArmMesh.castShadow = true;
    this.leftArmGroup.add(this.leftArmMesh);

    // Left Hand Cuff (used when wearing long-sleeve jacket)
    const handCuffGeo = new THREE.BoxGeometry(1.02, 0.42, 1.02);
    this.leftHandMesh = new THREE.Mesh(handCuffGeo, this.headMaterial);
    this.leftHandMesh.position.set(0, -1.8, 0);
    this.leftHandMesh.castShadow = true;
    this.leftArmGroup.add(this.leftHandMesh);

    // 4. Right Arm (Pivot at shoulder: x = 1.5, y = 4.0, z = 0)
    this.rightArmGroup = new THREE.Group();
    this.rightArmGroup.position.set(1.5, 4.0, 0);
    this.root.add(this.rightArmGroup);

    this.rightArmMesh = new THREE.Mesh(armGeo, this.headMaterial);
    this.rightArmMesh.position.set(0, -1, 0);
    this.rightArmMesh.castShadow = true;
    this.rightArmGroup.add(this.rightArmMesh);

    this.rightHandMesh = new THREE.Mesh(handCuffGeo, this.headMaterial);
    this.rightHandMesh.position.set(0, -1.8, 0);
    this.rightHandMesh.castShadow = true;
    this.rightArmGroup.add(this.rightHandMesh);

    // Tool mount at right hand
    this.toolMount = new THREE.Group();
    this.toolMount.position.set(0, -1.8, 0.4);
    this.rightArmGroup.add(this.toolMount);

    // Tools
    this.swordMesh = this.createSword();
    this.speedCoilMesh = this.createCoil('#ef4444', '#f87171');
    this.gravityCoilMesh = this.createCoil('#06b6d4', '#67e8f9');
    this.hammerMesh = this.createHammer();
    this.jetpackRemoteMesh = this.createJetpackRemote();
    this.bloxyColaMesh = this.createBloxyCola();

    this.toolMount.add(this.swordMesh);
    this.toolMount.add(this.speedCoilMesh);
    this.toolMount.add(this.gravityCoilMesh);
    this.toolMount.add(this.hammerMesh);
    this.toolMount.add(this.jetpackRemoteMesh);
    this.toolMount.add(this.bloxyColaMesh);

    // 5. Left Leg (Pivot at hip: x = -0.5, y = 2.0, z = 0)
    this.leftLegGroup = new THREE.Group();
    this.leftLegGroup.position.set(-0.5, 2.0, 0);
    this.root.add(this.leftLegGroup);

    const legGeo = new THREE.BoxGeometry(1, 2, 1);
    const legMats = this.createLegMaterials(skin);
    this.leftLegMesh = new THREE.Mesh(legGeo, legMats);
    this.leftLegMesh.position.set(0, -1, 0);
    this.leftLegMesh.castShadow = true;
    this.leftLegMesh.receiveShadow = true;
    this.leftLegGroup.add(this.leftLegMesh);

    // 6. Right Leg (Pivot at hip: x = 0.5, y = 2.0, z = 0)
    this.rightLegGroup = new THREE.Group();
    this.rightLegGroup.position.set(0.5, 2.0, 0);
    this.root.add(this.rightLegGroup);

    this.rightLegMesh = new THREE.Mesh(legGeo, legMats);
    this.rightLegMesh.position.set(0, -1, 0);
    this.rightLegMesh.castShadow = true;
    this.rightLegMesh.receiveShadow = true;
    this.rightLegGroup.add(this.rightLegMesh);

    // Apply sleeve visibility based on outfit
    this.applyArmOutfit(skin);

    // Initial tool visibility
    this.setEquippedTool('sword');

    // Billboard overhead nameplate
    this.setNameplate(skin.name);
  }

  private getActiveShirt(skin: CharacterSkin): ShirtOutfit {
    if (skin.shirt) return skin.shirt;
    return skin.outfit === 'rock_jacket' ? 'rock_jacket' : 'custom_shirt';
  }

  private getActivePants(skin: CharacterSkin): PantsOutfit {
    if (skin.pants) return skin.pants;
    return skin.outfit === 'rock_jacket' ? 'rock_jeans' : 'custom_pants';
  }

  private applyArmOutfit(skin: CharacterSkin) {
    const shirt = this.getActiveShirt(skin);

    if (shirt === 'rock_jacket') {
      this.sleeveMaterial.color.set('#141619');
      this.leftArmMesh.material = this.sleeveMaterial;
      this.rightArmMesh.material = this.sleeveMaterial;
      this.leftHandMesh.visible = true;
      this.rightHandMesh.visible = true;
    } else if (shirt === 'red_hoodie') {
      this.sleeveMaterial.color.set('#dc2626');
      this.leftArmMesh.material = this.sleeveMaterial;
      this.rightArmMesh.material = this.sleeveMaterial;
      this.leftHandMesh.visible = true;
      this.rightHandMesh.visible = true;
    } else if (shirt === 'blue_windbreaker') {
      this.sleeveMaterial.color.set('#1d4ed8');
      this.leftArmMesh.material = this.sleeveMaterial;
      this.rightArmMesh.material = this.sleeveMaterial;
      this.leftHandMesh.visible = true;
      this.rightHandMesh.visible = true;
    } else if (shirt === 'tuxedo') {
      this.sleeveMaterial.color.set('#0f172a');
      this.leftArmMesh.material = this.sleeveMaterial;
      this.rightArmMesh.material = this.sleeveMaterial;
      this.leftHandMesh.visible = true;
      this.rightHandMesh.visible = true;
    } else if (shirt === 'swat_vest') {
      this.sleeveMaterial.color.set('#1e293b');
      this.leftArmMesh.material = this.sleeveMaterial;
      this.rightArmMesh.material = this.sleeveMaterial;
      this.leftHandMesh.visible = true;
      this.rightHandMesh.visible = true;
    } else if (shirt === 'pizza_tee') {
      this.leftArmMesh.material = this.headMaterial;
      this.rightArmMesh.material = this.headMaterial;
      this.leftHandMesh.visible = false;
      this.rightHandMesh.visible = false;
    } else {
      if (skin.torsoColor && skin.torsoColor !== skin.skinColor) {
        this.sleeveMaterial.color.set(skin.torsoColor);
        this.leftArmMesh.material = this.sleeveMaterial;
        this.rightArmMesh.material = this.sleeveMaterial;
        this.leftHandMesh.visible = true;
        this.rightHandMesh.visible = true;
      } else {
        this.leftArmMesh.material = this.headMaterial;
        this.rightArmMesh.material = this.headMaterial;
        this.leftHandMesh.visible = false;
        this.rightHandMesh.visible = false;
      }
    }
  }

  private createTorsoMaterials(skin: CharacterSkin): THREE.Material | THREE.Material[] {
    if (this.torsoTexture) {
      this.torsoTexture.dispose();
      this.torsoTexture = null;
    }

    const shirt = this.getActiveShirt(skin);

    if (shirt === 'custom_shirt') {
      this.torsoMaterial.color.set(skin.torsoColor);
      return this.torsoMaterial;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    let backColor = '#141619';

    if (shirt === 'rock_jacket') {
      backColor = '#141619';
      // 1. Center Teal T-Shirt background
      ctx.fillStyle = '#0e7490';
      ctx.fillRect(0, 0, 256, 256);

      // Neckline skin triangle at top center
      ctx.fillStyle = skin.skinColor;
      ctx.beginPath();
      ctx.arc(128, 0, 40, 0, Math.PI);
      ctx.fill();

      // 2. Orange Flying-V Electric Guitar graphic in the center of the teal shirt
      ctx.save();
      ctx.translate(128, 128);
      ctx.rotate(-0.55);
      // Guitar body (Flying V)
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.lineTo(28, 34);
      ctx.lineTo(10, 34);
      ctx.lineTo(0, 12);
      ctx.lineTo(-10, 34);
      ctx.lineTo(-28, 34);
      ctx.closePath();
      ctx.fill();
      // White pickguard accent
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(12, 16);
      ctx.lineTo(-12, 16);
      ctx.closePath();
      ctx.fill();
      // Guitar neck
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(0, -56);
      ctx.stroke();
      // Headstock
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.moveTo(0, -52);
      ctx.lineTo(9, -66);
      ctx.lineTo(-9, -66);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // 3. Open Black Leather Jacket sides
      ctx.fillStyle = '#141619';
      ctx.fillRect(0, 0, 74, 240);
      ctx.fillRect(182, 0, 74, 240);

      // Jacket Lapels (angled glossy folds)
      ctx.fillStyle = '#272a30';
      ctx.beginPath();
      ctx.moveTo(74, 0);
      ctx.lineTo(94, 55);
      ctx.lineTo(74, 145);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(182, 0);
      ctx.lineTo(162, 55);
      ctx.lineTo(182, 145);
      ctx.closePath();
      ctx.fill();

      // Silver lapel studs
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.arc(82, 42, 4, 0, Math.PI * 2);
      ctx.arc(174, 42, 4, 0, Math.PI * 2);
      ctx.fill();

      // Red waist belt accents at bottom corners
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(8, 236, 48, 14);
      ctx.fillRect(200, 236, 48, 14);

      // Dark bottom hem
      ctx.fillStyle = '#090a0c';
      ctx.fillRect(0, 248, 256, 8);
    } else if (shirt === 'red_hoodie') {
      backColor = '#b91c1c';
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(0, 0, 256, 256);

      // Kangaroo pouch pocket
      ctx.fillStyle = '#b91c1c';
      ctx.beginPath();
      ctx.roundRect(44, 140, 168, 86, 16);
      ctx.fill();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      ctx.stroke();

      // White drawstring cords from neck
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(108, 24);
      ctx.lineTo(108, 96);
      ctx.moveTo(148, 24);
      ctx.lineTo(148, 96);
      ctx.stroke();

      // Blox Circle Emblem on left chest
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(80, 80, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(72, 72, 16, 16);

      // Ribbed bottom hem
      ctx.fillStyle = '#991b1b';
      ctx.fillRect(0, 236, 256, 20);
    } else if (shirt === 'blue_windbreaker') {
      backColor = '#1e40af';
      ctx.fillStyle = '#1d4ed8';
      ctx.fillRect(0, 0, 256, 256);

      // White sport chest chevron band
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(0, 80);
      ctx.lineTo(128, 130);
      ctx.lineTo(256, 80);
      ctx.lineTo(256, 120);
      ctx.lineTo(128, 170);
      ctx.lineTo(0, 120);
      ctx.closePath();
      ctx.fill();

      // Light blue accent stripe
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(0, 170, 256, 8);

      // Center silver zipper
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(128, 0);
      ctx.lineTo(128, 256);
      ctx.stroke();

      // Zipper slider
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(124, 40, 8, 14);

      // Collar
      ctx.fillStyle = '#1e3a8a';
      ctx.fillRect(0, 0, 256, 24);
    } else if (shirt === 'tuxedo') {
      backColor = '#0f172a';
      // Black jacket base
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 256, 256);

      // White pleated shirt triangle
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.moveTo(90, 0);
      ctx.lineTo(166, 0);
      ctx.lineTo(128, 190);
      ctx.closePath();
      ctx.fill();

      // Red bow tie
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(128, 38);
      ctx.lineTo(104, 24);
      ctx.lineTo(104, 52);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(128, 38);
      ctx.lineTo(152, 24);
      ctx.lineTo(152, 52);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#b91c1c';
      ctx.beginPath();
      ctx.arc(128, 38, 7, 0, Math.PI * 2);
      ctx.fill();

      // Satin lapels
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.moveTo(90, 0);
      ctx.lineTo(60, 110);
      ctx.lineTo(128, 195);
      ctx.lineTo(112, 110);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(166, 0);
      ctx.lineTo(196, 110);
      ctx.lineTo(128, 195);
      ctx.lineTo(144, 110);
      ctx.closePath();
      ctx.fill();

      // Tuxedo jacket button
      ctx.fillStyle = '#020617';
      ctx.beginPath();
      ctx.arc(128, 215, 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (shirt === 'pizza_tee') {
      backColor = '#e2e8f0';
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(0, 0, 256, 256);

      // Neckline skin arc
      ctx.fillStyle = skin.skinColor;
      ctx.beginPath();
      ctx.arc(128, 0, 36, 0, Math.PI);
      ctx.fill();
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 5;
      ctx.stroke();

      // Pizza Slice Graphic in center
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.arc(128, 120, 72, -Math.PI * 0.75, -Math.PI * 0.25);
      ctx.lineTo(128, 200);
      ctx.closePath();
      ctx.fill();

      // Cheesy layer
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(128, 122, 62, -Math.PI * 0.72, -Math.PI * 0.28);
      ctx.lineTo(128, 194);
      ctx.closePath();
      ctx.fill();

      // Pepperoni slices
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(114, 130, 10, 0, Math.PI * 2);
      ctx.arc(142, 136, 9, 0, Math.PI * 2);
      ctx.arc(128, 160, 8, 0, Math.PI * 2);
      ctx.fill();

      // Text "BLOXY PIZZA"
      ctx.fillStyle = '#0f172a';
      ctx.font = '900 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('BLOXY PIZZA', 128, 62);
    } else if (shirt === 'swat_vest') {
      backColor = '#0f172a';
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, 256, 256);

      // Molle straps
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(20, 40, 216, 12);
      ctx.fillRect(20, 80, 216, 12);
      ctx.fillRect(20, 150, 216, 12);

      // Tactical chest pouches
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.roundRect(32, 100, 80, 44, 8);
      ctx.roundRect(144, 100, 80, 44, 8);
      ctx.fill();

      // SWAT Badge in bold yellow/white
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(58, 48, 140, 28);
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 2;
      ctx.strokeRect(58, 48, 140, 28);

      ctx.fillStyle = '#facc15';
      ctx.font = '900 18px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('S.W.A.T.', 128, 68);

      // Tactical buckle belt at bottom
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 226, 256, 30);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(116, 232, 24, 18);
    }

    this.torsoTexture = new THREE.CanvasTexture(canvas);
    this.torsoTexture.colorSpace = THREE.SRGBColorSpace;

    const frontMat = new THREE.MeshStandardMaterial({
      map: this.torsoTexture,
      roughness: 0.55,
      metalness: 0.1,
    });

    const bodyBackMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(backColor),
      roughness: 0.55,
      metalness: 0.1,
    });

    // [+X, -X, +Y, -Y, +Z (front), -Z (back)]
    return [
      bodyBackMat,
      bodyBackMat,
      bodyBackMat,
      bodyBackMat,
      frontMat,
      bodyBackMat,
    ];
  }

  private createLegMaterials(skin: CharacterSkin): THREE.Material | THREE.Material[] {
    if (this.legsTexture) {
      this.legsTexture.dispose();
      this.legsTexture = null;
    }

    const pants = this.getActivePants(skin);

    if (pants === 'custom_pants') {
      this.legsMaterial.color.set(skin.legsColor);
      return this.legsMaterial;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    let topColor = 0x141417;
    let soleColor = 0xe2e8f0;

    if (pants === 'rock_jeans') {
      topColor = 0x141417;
      soleColor = 0xe2e8f0;
      // Black denim base
      ctx.fillStyle = '#141417';
      ctx.fillRect(0, 0, 128, 256);

      // Subtle vertical denim distressed streaks
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 3;
      for (let x = 14; x < 118; x += 12) {
        ctx.beginPath();
        ctx.moveTo(x, 20);
        ctx.lineTo(x, 210);
        ctx.stroke();
      }

      // White jeans pocket arcs
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(20, 10, 32, 0, Math.PI * 0.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(108, 10, 32, Math.PI * 0.5, Math.PI);
      ctx.stroke();

      // Dark Teal / Emerald Sneakers
      ctx.fillStyle = '#0f5248';
      ctx.fillRect(0, 214, 128, 34);
      ctx.fillStyle = '#14b8a6';
      ctx.fillRect(10, 222, 108, 5);
      // Crisp white sole
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(0, 248, 128, 8);
    } else if (pants === 'blue_denim') {
      topColor = 0x1d4ed8;
      soleColor = 0xffffff;
      // Blue denim
      ctx.fillStyle = '#2563eb';
      ctx.fillRect(0, 0, 128, 256);

      // Faded wash
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(20, 60, 88, 120);

      // Brown leather belt at top
      ctx.fillStyle = '#78350f';
      ctx.fillRect(0, 0, 128, 22);
      ctx.fillStyle = '#f59e0b';
      ctx.strokeRect(48, 2, 32, 18);

      // White skate sneakers
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 216, 128, 32);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 244, 128, 4);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 248, 128, 8);
    } else if (pants === 'cargo_camo') {
      topColor = 0x3f6212;
      soleColor = 0x18181b;
      // Camo blocks
      ctx.fillStyle = '#4d7c0f';
      ctx.fillRect(0, 0, 128, 256);
      ctx.fillStyle = '#365314';
      ctx.fillRect(10, 20, 50, 40);
      ctx.fillRect(70, 70, 48, 50);
      ctx.fillRect(15, 140, 55, 45);
      ctx.fillStyle = '#713f12';
      ctx.fillRect(60, 10, 40, 35);
      ctx.fillRect(20, 80, 45, 40);
      ctx.fillRect(75, 150, 40, 40);

      // Flap pocket
      ctx.fillStyle = '#1e3a1e';
      ctx.fillRect(18, 110, 92, 30);
      ctx.fillStyle = '#a3e635';
      ctx.beginPath();
      ctx.arc(64, 120, 4, 0, Math.PI * 2);
      ctx.fill();

      // Black combat boots
      ctx.fillStyle = '#18181b';
      ctx.fillRect(0, 210, 128, 46);
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 246, 128, 10);
    } else if (pants === 'track_pants') {
      topColor = 0x0f172a;
      soleColor = 0xf8fafc;
      // Dark Charcoal base
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 128, 256);

      // Iconic white double side stripes
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(8, 0, 6, 216);
      ctx.fillRect(18, 0, 6, 216);

      // Running shoes
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(0, 216, 128, 30);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 246, 128, 10);
    } else if (pants === 'suit_pants') {
      topColor = 0x020617;
      soleColor = 0x000000;
      // Deep black fabric
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, 128, 256);

      // Pressed crease
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(64, 10);
      ctx.lineTo(64, 215);
      ctx.stroke();

      // Glossy dress shoes
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 218, 128, 38);
      ctx.fillStyle = '#475569';
      ctx.fillRect(16, 224, 30, 4);
    }

    this.legsTexture = new THREE.CanvasTexture(canvas);
    this.legsTexture.colorSpace = THREE.SRGBColorSpace;

    const pantsMat = new THREE.MeshStandardMaterial({
      map: this.legsTexture,
      roughness: 0.7,
      metalness: 0.05,
    });

    const bottomSoleMat = new THREE.MeshStandardMaterial({
      color: soleColor,
      roughness: 0.8,
    });

    const topHipMat = new THREE.MeshStandardMaterial({
      color: topColor,
      roughness: 0.8,
    });

    return [
      pantsMat,
      pantsMat,
      topHipMat,
      bottomSoleMat,
      pantsMat,
      pantsMat,
    ];
  }

  private createHeadMaterials(skin: CharacterSkin): THREE.Material[] {
    if (this.faceTexture) {
      this.faceTexture.dispose();
    }

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Background skin color
    ctx.fillStyle = skin.skinColor;
    ctx.fillRect(0, 0, 256, 256);

    // Draw iconic Roblox face
    ctx.fillStyle = '#111827';
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (skin.face === 'squiggly') {
      // User's Roblox Face: Dark eyes peeking near the top + iconic squiggly/wavy mouth (`~`)
      ctx.beginPath();
      ctx.ellipse(96, 82, 11, 16, 0, 0, Math.PI * 2);
      ctx.ellipse(160, 82, 11, 16, 0, 0, Math.PI * 2);
      ctx.fill();

      // Wavy squiggly mouth (`~`) matching the screenshot
      ctx.lineWidth = 11;
      ctx.beginPath();
      ctx.moveTo(86, 162);
      ctx.quadraticCurveTo(106, 144, 126, 158);
      ctx.quadraticCurveTo(146, 172, 168, 150);
      ctx.stroke();
    } else if (skin.face === 'smile') {
      // Classic Roblox Oval Eyes
      ctx.beginPath();
      ctx.ellipse(75, 95, 14, 22, 0, 0, Math.PI * 2);
      ctx.ellipse(181, 95, 14, 22, 0, 0, Math.PI * 2);
      ctx.fill();

      // Catchlights
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(71, 88, 5, 0, Math.PI * 2);
      ctx.arc(177, 88, 5, 0, Math.PI * 2);
      ctx.fill();

      // Classic Roblox Curved Smile
      ctx.beginPath();
      ctx.arc(128, 140, 52, 0.25 * Math.PI, 0.75 * Math.PI);
      ctx.stroke();
    } else if (skin.face === 'cool') {
      // Sunglasses
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(40, 75, 75, 45);
      ctx.fillRect(141, 75, 75, 45);
      ctx.fillRect(115, 85, 26, 12);
      // Lens shine
      ctx.fillStyle = '#60a5fa';
      ctx.fillRect(45, 80, 65, 8);
      ctx.fillRect(146, 80, 65, 8);
      // Smug smile
      ctx.beginPath();
      ctx.arc(140, 150, 40, 0.1 * Math.PI, 0.6 * Math.PI);
      ctx.stroke();
    } else if (skin.face === 'determined') {
      // Brows
      ctx.beginPath();
      ctx.moveTo(55, 75);
      ctx.lineTo(105, 90);
      ctx.moveTo(201, 75);
      ctx.lineTo(151, 90);
      ctx.stroke();
      // Eyes
      ctx.beginPath();
      ctx.arc(80, 105, 12, 0, Math.PI * 2);
      ctx.arc(176, 105, 12, 0, Math.PI * 2);
      ctx.fill();
      // Straight grin
      ctx.beginPath();
      ctx.moveTo(90, 160);
      ctx.lineTo(166, 160);
      ctx.stroke();
    } else {
      // Derp / Silly
      ctx.beginPath();
      ctx.arc(70, 95, 20, 0, Math.PI * 2);
      ctx.arc(180, 95, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(128, 160, 30, 0, Math.PI);
      ctx.stroke();
    }

    this.faceTexture = new THREE.CanvasTexture(canvas);
    this.faceTexture.colorSpace = THREE.SRGBColorSpace;

    const faceMaterial = new THREE.MeshStandardMaterial({
      map: this.faceTexture,
      roughness: 0.6,
      metalness: 0.05,
    });

    // BoxGeometry materials: [+X, -X, +Y, -Y, +Z, -Z]
    return [
      this.headMaterial,
      this.headMaterial,
      this.headMaterial,
      this.headMaterial,
      faceMaterial,
      this.headMaterial,
    ];
  }

  public updateSkin(skin: CharacterSkin) {
    this.headMaterial.color.set(skin.skinColor);
    this.torsoMaterial.color.set(skin.torsoColor);
    this.legsMaterial.color.set(skin.legsColor);

    this.headMesh.material = this.createHeadMaterials(skin);
    this.torsoMesh.material = this.createTorsoMaterials(skin);
    const legMats = this.createLegMaterials(skin);
    this.leftLegMesh.material = legMats;
    this.rightLegMesh.material = legMats;

    this.applyArmOutfit(skin);
    this.updateHat(skin.hat, skin.skinColor);
    this.updateBackpack(skin.backpack || 'none');
    this.setNameplate(skin.name);
  }

  public updateHat(hat: CharacterSkin['hat'], skinColor: string = '#e5c298') {
    while (this.hatGroup.children.length > 0) {
      this.hatGroup.remove(this.hatGroup.children[0]);
    }

    if (hat === 'rocker_hair') {
      // User's Custom Roblox Hair + Red Visor Headband + Top Bunny/Antenna Ears!
      const hairDarkMat = new THREE.MeshStandardMaterial({ color: 0x2b1a0e, roughness: 0.55 });
      const hairLightMat = new THREE.MeshStandardMaterial({ color: 0x5c3a1e, roughness: 0.5 });
      const redVisorMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35 });
      const blackStrapMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.5 });
      const earMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(skinColor), roughness: 0.6 });

      // Main hair crown volume
      const hairTop = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.38, 1.38), hairDarkMat);
      hairTop.position.set(0, 0.08, -0.02);
      hairTop.castShadow = true;
      this.hatGroup.add(hairTop);

      // Tousled spiky hair tufts across top & front
      const tuft1 = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.26, 0.65), hairLightMat);
      tuft1.position.set(-0.28, 0.25, 0.25);
      tuft1.rotation.set(-0.2, 0.3, 0.15);

      const tuft2 = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.28, 0.65), hairDarkMat);
      tuft2.position.set(0.22, 0.26, 0.22);
      tuft2.rotation.set(-0.25, -0.25, -0.15);

      const tuft3 = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.22, 0.55), hairLightMat);
      tuft3.position.set(0, 0.28, -0.15);
      tuft3.rotation.set(0.15, 0.4, 0);
      this.hatGroup.add(tuft1, tuft2, tuft3);

      // Back hair layer
      const hairBack = new THREE.Mesh(new THREE.BoxGeometry(1.34, 0.72, 0.28), hairDarkMat);
      hairBack.position.set(0, -0.22, -0.58);
      this.hatGroup.add(hairBack);

      // Left & Right Sideburns (visible in side screenshots)
      const sideburnGeo = new THREE.BoxGeometry(0.16, 0.58, 0.32);
      const sideburnL = new THREE.Mesh(sideburnGeo, hairDarkMat);
      sideburnL.position.set(-0.64, -0.24, 0.08);
      const sideburnR = new THREE.Mesh(sideburnGeo, hairDarkMat);
      sideburnR.position.set(0.64, -0.24, 0.08);
      this.hatGroup.add(sideburnL, sideburnR);

      // Black headband strap around head
      const strap = new THREE.Mesh(new THREE.BoxGeometry(1.34, 0.18, 1.34), blackStrapMat);
      strap.position.set(0, -0.14, 0);
      this.hatGroup.add(strap);

      // Red Curved Forehead Band & Visor Brim
      const redBand = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.22, 0.35), redVisorMat);
      redBand.position.set(0, -0.14, 0.55);
      redBand.rotation.x = 0.12;

      const redBrim = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.09, 0.55), redVisorMat);
      redBrim.position.set(0, -0.19, 0.82);
      redBrim.rotation.x = 0.18;
      this.hatGroup.add(redBand, redBrim);

      // Two Upright Tan Ears / Horns on top-back (visible in front, side, and back screenshots)
      const earGeo = new THREE.BoxGeometry(0.18, 0.48, 0.24);
      const earL = new THREE.Mesh(earGeo, earMat);
      earL.position.set(-0.28, 0.42, -0.22);
      earL.rotation.x = -0.15;
      const earR = new THREE.Mesh(earGeo, earMat);
      earR.position.set(0.28, 0.42, -0.22);
      earR.rotation.x = -0.15;
      this.hatGroup.add(earL, earR);
    } else if (hat === 'cap') {
      const capMat = new THREE.MeshStandardMaterial({ color: 0xd92626, roughness: 0.5 });
      const capVisorMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.4 });
      const crownMesh = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.35, 1.35), capMat);
      crownMesh.castShadow = true;
      const visorMesh = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.08, 0.8), capVisorMat);
      visorMesh.position.set(0, -0.12, 0.85);
      visorMesh.castShadow = true;
      this.hatGroup.add(crownMesh, visorMesh);
    } else if (hat === 'crown') {
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.85, roughness: 0.25 });
      const crownBase = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.3, 1.36), goldMat);
      crownBase.castShadow = true;
      this.hatGroup.add(crownBase);

      const spikeGeo = new THREE.ConeGeometry(0.18, 0.45, 4);
      const rubyMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.1, metalness: 0.3 });
      [
        [-0.55, 0.3, -0.55],
        [0.55, 0.3, -0.55],
        [-0.55, 0.3, 0.55],
        [0.55, 0.3, 0.55],
        [0, 0.4, 0.65],
      ].forEach(([x, y, z]) => {
        const spike = new THREE.Mesh(spikeGeo, goldMat);
        spike.position.set(x, y, z);
        this.hatGroup.add(spike);
      });
      const gem = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.1), rubyMat);
      gem.position.set(0, 0.05, 0.7);
      this.hatGroup.add(gem);
    } else if (hat === 'headphones') {
      const hpMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, metalness: 0.3, roughness: 0.4 });
      const bandMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3 });
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.08, 8, 16, Math.PI), bandMat);
      band.rotation.x = -Math.PI / 2;
      band.rotation.z = Math.PI / 2;
      band.position.set(0, 0.2, 0);

      const earL = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.2, 12), hpMat);
      earL.rotation.z = Math.PI / 2;
      earL.position.set(-0.7, -0.2, 0);

      const earR = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.2, 12), hpMat);
      earR.rotation.z = Math.PI / 2;
      earR.position.set(0.7, -0.2, 0);

      this.hatGroup.add(band, earL, earR);
    } else if (hat === 'visor') {
      const visorMat = new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        emissive: 0x0891b2,
        emissiveIntensity: 0.6,
        roughness: 0.1,
        metalness: 0.5,
      });
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 });
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.3, 0.3), frameMat);
      frame.position.set(0, -0.2, 0.55);
      const glass = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.22, 0.15), visorMat);
      glass.position.set(0, -0.2, 0.68);
      this.hatGroup.add(frame, glass);
    } else if (hat === 'viking') {
      const helmetMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.7, roughness: 0.3 });
      const hornMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.6 });
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.75, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), helmetMat);
      dome.position.set(0, -0.1, 0);
      const hornGeo = new THREE.ConeGeometry(0.18, 0.7, 8);
      const hornL = new THREE.Mesh(hornGeo, hornMat);
      hornL.position.set(-0.75, 0.2, 0);
      hornL.rotation.z = 0.6;
      const hornR = new THREE.Mesh(hornGeo, hornMat);
      hornR.position.set(0.75, 0.2, 0);
      hornR.rotation.z = -0.6;
      this.hatGroup.add(dome, hornL, hornR);
    }
  }

  public updateBackpack(backpack: CharacterSkin['backpack']) {
    while (this.backpackGroup.children.length > 0) {
      this.backpackGroup.remove(this.backpackGroup.children[0]);
    }

    if (backpack === 'fuel_jetpack') {
      // Build the exact Blue & Lime-Green "FUEL" Jetpack from the user's screenshots!
      const packGroup = new THREE.Group();
      packGroup.name = 'FuelJetpack';

      const lightBlueMat = new THREE.MeshStandardMaterial({ color: 0x5bb5f2, roughness: 0.35, metalness: 0.15 });
      const deepBlueMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.4, metalness: 0.2 });
      const limeMat = new THREE.MeshStandardMaterial({
        color: 0x84cc16,
        emissive: 0x4d7c0f,
        emissiveIntensity: 0.25,
        roughness: 0.3,
      });
      const wingOrangeMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xd97706,
        emissiveIntensity: 0.2,
        roughness: 0.35,
      });
      const flameMat = new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.85,
        roughness: 0.2,
      });
      const redBrickMat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xdc2626,
        emissiveIntensity: 0.5,
        roughness: 0.3,
      });

      // Create canvas texture for the back of the center pack ("FUEL" + green/red meter)
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 160;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#5bb5f2';
      ctx.fillRect(0, 0, 128, 160);

      // Top & bottom royal blue borders
      ctx.fillStyle = '#1d4ed8';
      ctx.fillRect(0, 0, 128, 22);
      ctx.fillRect(0, 136, 128, 24);

      // White "FUEL" sign plate
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(28, 42, 72, 26);
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 3;
      ctx.strokeRect(28, 42, 72, 26);

      ctx.fillStyle = '#0f172a';
      ctx.font = '900 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('FUEL', 64, 56);

      // Fuel gauge bar (Green left + Red right)
      ctx.fillStyle = '#1e3a8a';
      ctx.fillRect(20, 78, 88, 24);
      ctx.fillStyle = '#4ade80';
      ctx.fillRect(24, 82, 52, 16);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(76, 82, 28, 16);

      const fuelTex = new THREE.CanvasTexture(canvas);
      fuelTex.colorSpace = THREE.SRGBColorSpace;
      const fuelBackMat = new THREE.MeshStandardMaterial({ map: fuelTex, roughness: 0.35 });

      // 1. Center Fuel Box
      const centerBoxMats = [
        lightBlueMat,
        lightBlueMat,
        deepBlueMat,
        deepBlueMat,
        lightBlueMat,
        fuelBackMat, // -Z faces outward behind the player
      ];
      const centerBox = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.55, 0.65), centerBoxMats);
      centerBox.position.set(0, 0.25, -0.2);
      centerBox.castShadow = true;
      packGroup.add(centerBox);

      // 2. Left & Right Cylindrical Booster Tanks
      [-0.72, 0.72].forEach((xOffset, idx) => {
        const tankGroup = new THREE.Group();
        tankGroup.position.set(xOffset, 0.22, -0.22);

        // Main light-blue cylinder body
        const tankBody = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 1.35, 14), lightBlueMat);
        tankBody.castShadow = true;
        tankGroup.add(tankBody);

        // Royal blue top dome
        const topDome = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), deepBlueMat);
        topDome.position.set(0, 0.65, 0);
        tankGroup.add(topDome);

        // Royal blue bottom nozzle rim
        const bottomRim = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.18, 14), deepBlueMat);
        bottomRim.position.set(0, -0.68, 0);
        tankGroup.add(bottomRim);

        // Lime green band ring near top
        const limeRing = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.12, 14), limeMat);
        limeRing.position.set(0, 0.38, 0);
        tankGroup.add(limeRing);

        // Curved Lime-Green Pipe looping from top of tank into center box
        const pipeArch = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.085, 8, 16, Math.PI), limeMat);
        pipeArch.position.set(idx === 0 ? 0.32 : -0.32, 0.92, 0);
        tankGroup.add(pipeArch);

        // Side Triangular Fin / Wing (Orange inner + Lime border)
        const wingSign = idx === 0 ? -1 : 1;
        const wingOuter = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.85, 0.08), limeMat);
        wingOuter.position.set(wingSign * 0.42, 0.05, 0.08);
        wingOuter.rotation.z = wingSign * 0.38;

        const wingInner = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.68, 0.1), wingOrangeMat);
        wingInner.position.set(wingSign * 0.42, 0.03, 0.08);
        wingInner.rotation.z = wingSign * 0.38;
        tankGroup.add(wingOuter, wingInner);

        // Thruster Flame Plume + Floating Red Brick Particles at bottom of tank!
        const plumeGroup = new THREE.Group();
        plumeGroup.name = `JetpackPlume_${idx}`;
        plumeGroup.position.set(0, -1.1, 0);

        // Inverted yellow-orange flame cone
        const flameCone = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.78, 8), flameMat);
        flameCone.rotation.x = Math.PI; // Point downward
        plumeGroup.add(flameCone);

        // Ring of floating red Roblox brick particles around the flame
        const brickOffsets = [
          [0.28, 0.1, 0.15, 0.4, 0.2],
          [-0.28, 0.05, 0.15, -0.3, 0.5],
          [0.15, -0.15, -0.26, 0.6, -0.4],
          [-0.2, -0.1, -0.24, -0.5, 0.3],
          [0.0, -0.32, 0.24, 0.3, 0.7],
          [0.24, 0.18, -0.18, -0.4, -0.3],
        ];
        const brickGeo = new THREE.BoxGeometry(0.16, 0.1, 0.22);
        brickOffsets.forEach(([bx, by, bz, rx, rz]) => {
          const brick = new THREE.Mesh(brickGeo, redBrickMat);
          brick.position.set(bx, by, bz);
          brick.rotation.set(rx, 0.3, rz);
          plumeGroup.add(brick);
        });

        tankGroup.add(plumeGroup);
        packGroup.add(tankGroup);
      });

      this.backpackGroup.add(packGroup);
    } else if (backpack === 'roblox_classic') {
      // Classic Red Roblox Explorer Backpack
      const packGroup = new THREE.Group();
      packGroup.name = 'RobloxClassicBackpack';

      const redBagMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.65 });
      const darkRedMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.6 });
      const strapMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.8 });
      const bottleMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3 });
      const bottleCapMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });

      // Canvas Texture for Front Pocket with classic Roblox 'R' logo
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#b91c1c';
      ctx.fillRect(0, 0, 128, 128);

      // Silver zipper
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(14, 18, 100, 8);
      ctx.fillStyle = '#475569';
      ctx.fillRect(16, 21, 96, 2);

      // Roblox Square Tilt Logo
      ctx.save();
      ctx.translate(64, 72);
      ctx.rotate(-0.16);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-22, -22, 44, 44);
      // Hollow center
      ctx.fillStyle = '#b91c1c';
      ctx.fillRect(-8, -8, 16, 16);
      ctx.restore();

      const logoTex = new THREE.CanvasTexture(canvas);
      logoTex.colorSpace = THREE.SRGBColorSpace;
      const logoPocketMat = new THREE.MeshStandardMaterial({ map: logoTex, roughness: 0.55 });

      // Main Bag Body
      const mainBody = new THREE.Mesh(new THREE.BoxGeometry(1.35, 1.65, 0.6), redBagMat);
      mainBody.position.set(0, 0.25, -0.2);
      mainBody.castShadow = true;
      packGroup.add(mainBody);

      // Front Pocket Box
      const pocketMats = [
        darkRedMat,
        darkRedMat,
        darkRedMat,
        darkRedMat,
        darkRedMat,
        logoPocketMat, // Facing outwards (-Z)
      ];
      const pocket = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.95, 0.32), pocketMats);
      pocket.position.set(0, 0.05, -0.58);
      pocket.castShadow = true;
      packGroup.add(pocket);

      // Top Grab Handle Loop
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.055, 8, 16, Math.PI), strapMat);
      handle.position.set(0, 1.1, -0.2);
      packGroup.add(handle);

      // Side Water Bottle Pocket & Bottle
      const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.7, 10), bottleMat);
      bottle.position.set(0.72, 0.15, -0.2);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.18, 10), bottleCapMat);
      cap.position.set(0.72, 0.55, -0.2);
      packGroup.add(bottle, cap);

      // Shoulder Straps Over Torso
      const strapL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.8, 0.08), strapMat);
      strapL.position.set(-0.48, 0.25, 0.45);
      const strapR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.8, 0.08), strapMat);
      strapR.position.set(0.48, 0.25, 0.45);
      packGroup.add(strapL, strapR);

      this.backpackGroup.add(packGroup);
    } else if (backpack === 'treasure_pack') {
      // Golden Adventurer Treasure Chest Backpack
      const packGroup = new THREE.Group();
      packGroup.name = 'TreasurePack';

      const chestWoodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 });
      const goldTrimMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.8, roughness: 0.25 });
      const gemMat = new THREE.MeshStandardMaterial({
        color: 0xc084fc,
        emissive: 0x9333ea,
        emissiveIntensity: 0.6,
        roughness: 0.2,
      });

      // Chest base
      const chest = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, 0.7), chestWoodMat);
      chest.position.set(0, 0.25, -0.25);
      chest.castShadow = true;
      packGroup.add(chest);

      // Gold Trim bands
      const bandTop = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.14, 0.74), goldTrimMat);
      bandTop.position.set(0, 0.75, -0.25);
      const lockLatch = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.32, 0.15), goldTrimMat);
      lockLatch.position.set(0, 0.35, -0.62);
      packGroup.add(bandTop, lockLatch);

      // 3 Glowing Amethyst Crystals protruding
      [-0.32, 0, 0.32].forEach((xPos, i) => {
        const crystal = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.5, 6), gemMat);
        crystal.position.set(xPos, 0.95, -0.25);
        crystal.rotation.z = (i - 1) * 0.25;
        packGroup.add(crystal);
      });

      this.backpackGroup.add(packGroup);
    }
  }

  private createSword(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'Sword';

    // Blade
    const bladeGeo = new THREE.BoxGeometry(0.2, 2.2, 0.08);
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.9,
      roughness: 0.15,
    });
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.set(0, 1.1, 0);
    blade.castShadow = true;

    // Crossguard
    const guardGeo = new THREE.BoxGeometry(0.8, 0.12, 0.25);
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.8,
      roughness: 0.25,
    });
    const guard = new THREE.Mesh(guardGeo, goldMat);
    guard.position.set(0, 0, 0);

    // Grip
    const gripGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.6, 8);
    const gripMat = new THREE.MeshStandardMaterial({ color: 0x3b1d11, roughness: 0.8 });
    const grip = new THREE.Mesh(gripGeo, gripMat);
    grip.position.set(0, -0.35, 0);

    // Pommel
    const pommelGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const pommel = new THREE.Mesh(pommelGeo, goldMat);
    pommel.position.set(0, -0.68, 0);

    group.add(blade, guard, grip, pommel);
    group.rotation.x = Math.PI / 4;
    return group;
  }

  private createCoil(mainColor: string, glowColor: string): THREE.Group {
    const group = new THREE.Group();
    group.name = 'Coil';

    // Handle
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.5 });
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.8, 8), handleMat);
    handle.position.set(0, 0, 0);
    group.add(handle);

    // Spiral Coil Rings
    const coilMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(mainColor),
      emissive: new THREE.Color(glowColor),
      emissiveIntensity: 0.5,
      metalness: 0.6,
      roughness: 0.2,
    });

    const ringCount = 5;
    for (let i = 0; i < ringCount; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.06, 8, 16), coilMat);
      ring.position.set(0, -0.3 + i * 0.16, 0);
      ring.rotation.x = Math.PI / 2;
      group.add(ring);
    }

    group.rotation.x = Math.PI / 3;
    return group;
  }

  private createHammer(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'Hammer';

    // Wood Handle
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.7 });
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.8, 8), woodMat);
    handle.position.set(0, 0.6, 0);

    // Stone/Steel Block Head
    const headMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.5, roughness: 0.4 });
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.6), headMat);
    head.position.set(0, 1.4, 0);
    head.castShadow = true;

    group.add(handle, head);
    group.rotation.x = Math.PI / 4;
    return group;
  }

  private createJetpackRemote(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'JetpackRemote';

    const caseMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, metalness: 0.4, roughness: 0.3 });
    const buttonMat = new THREE.MeshStandardMaterial({ color: 0x84cc16, emissive: 0x4d7c0f, emissiveIntensity: 0.7 });
    const antennaMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.2 });

    const remoteCase = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.65, 0.18), caseMat);
    const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.12), buttonMat);
    trigger.position.set(0, 0.1, 0.1);

    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.45, 8), antennaMat);
    antenna.position.set(0.1, 0.45, 0);

    group.add(remoteCase, trigger, antenna);
    group.rotation.x = Math.PI / 4;
    return group;
  }

  private createBloxyCola(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'BloxyColaCan';

    const canMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      roughness: 0.3,
      metalness: 0.4,
    });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.85, roughness: 0.2 });

    const canBody = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.7, 16), canMat);
    const topRim = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.05, 16), rimMat);
    topRim.position.set(0, 0.36, 0);

    const tab = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.14), rimMat);
    tab.position.set(0, 0.39, 0.04);

    group.add(canBody, topRim, tab);
    group.rotation.x = Math.PI / 3.5;
    return group;
  }

  public setEquippedTool(tool: ToolType) {
    this.swordMesh.visible = tool === 'sword';
    this.speedCoilMesh.visible = tool === 'speed_coil';
    this.gravityCoilMesh.visible = tool === 'gravity_coil';
    this.hammerMesh.visible = tool === 'hammer';
    this.jetpackRemoteMesh.visible = tool === 'jetpack_boost';
    this.bloxyColaMesh.visible = tool === 'bloxy_cola';
  }

  public triggerAttack() {
    this.isAttacking = true;
    this.attackTimer = 0;
  }

  public update(dt: number, time: number) {
    // 1. Squash and stretch damping
    this.squashY = THREE.MathUtils.damp(this.squashY, this.targetSquashY, 15, dt);
    this.root.scale.set(1 / Math.sqrt(this.squashY), this.squashY, 1 / Math.sqrt(this.squashY));

    // Reset target squash back to 1.0
    this.targetSquashY = THREE.MathUtils.damp(this.targetSquashY, 1.0, 10, dt);

    // 1b. Animate Jetpack thruster plumes if equipped
    const plume0 = this.backpackGroup.getObjectByName('JetpackPlume_0');
    const plume1 = this.backpackGroup.getObjectByName('JetpackPlume_1');
    if (plume0 && plume1) {
      const boostScale = !this.isGrounded ? 1.35 : this.isMoving ? 1.15 : 0.95;
      const flicker = boostScale + Math.sin(time * 24) * 0.12;
      plume0.scale.set(1, flicker, 1);
      plume1.scale.set(1, flicker, 1);
      plume0.rotation.y = time * 3.5;
      plume1.rotation.y = -time * 3.5;
    }

    // 2. Attack swing animation
    if (this.isAttacking) {
      this.attackTimer += dt * 8;
      const swingAngle = Math.sin(this.attackTimer) * 1.8;
      this.rightArmGroup.rotation.x = -0.5 - swingAngle;
      if (this.attackTimer >= Math.PI) {
        this.isAttacking = false;
        this.attackTimer = 0;
      }
      return;
    }

    // 3. Emote Dance
    if (this.isEmoting) {
      const danceAngle = Math.sin(time * 6) * 0.45;
      const danceArm = Math.cos(time * 6) * 0.9;
      this.torsoMesh.rotation.y = danceAngle;
      this.headGroup.rotation.y = -danceAngle * 0.8;
      this.leftArmGroup.rotation.x = -1.5 + danceArm;
      this.rightArmGroup.rotation.x = -1.5 - danceArm;
      this.leftLegGroup.rotation.x = danceAngle * 0.5;
      this.rightLegGroup.rotation.x = -danceAngle * 0.5;
      return;
    }

    // 4. In Air (Jumping or Falling)
    if (!this.isGrounded) {
      this.leftLegGroup.rotation.x = THREE.MathUtils.damp(this.leftLegGroup.rotation.x, -0.4, 12, dt);
      this.rightLegGroup.rotation.x = THREE.MathUtils.damp(this.rightLegGroup.rotation.x, 0.4, 12, dt);
      this.leftArmGroup.rotation.x = THREE.MathUtils.damp(this.leftArmGroup.rotation.x, -2.4, 12, dt);
      this.rightArmGroup.rotation.x = THREE.MathUtils.damp(this.rightArmGroup.rotation.x, -2.4, 12, dt);
      return;
    }

    // 5. Walking / Running
    if (this.isMoving) {
      const swing = Math.sin(this.walkPhase) * 0.85;
      this.leftLegGroup.rotation.x = swing;
      this.rightLegGroup.rotation.x = -swing;
      this.leftArmGroup.rotation.x = -swing;
      this.rightArmGroup.rotation.x = swing;

      // Subtle torso sway
      this.torsoMesh.rotation.y = -swing * 0.12;
      this.headGroup.rotation.y = swing * 0.08;
    } else {
      // Idle Breathing
      const breath = Math.sin(time * 2.5) * 0.04;
      this.torsoMesh.position.y = 3 + breath;
      this.headGroup.position.y = 4.7 + breath;
      this.leftArmGroup.rotation.x = THREE.MathUtils.damp(this.leftArmGroup.rotation.x, 0, 10, dt);
      this.rightArmGroup.rotation.x = THREE.MathUtils.damp(this.rightArmGroup.rotation.x, 0, 10, dt);
      this.leftLegGroup.rotation.x = THREE.MathUtils.damp(this.leftLegGroup.rotation.x, 0, 10, dt);
      this.rightLegGroup.rotation.x = THREE.MathUtils.damp(this.rightLegGroup.rotation.x, 0, 10, dt);
      this.torsoMesh.rotation.y = THREE.MathUtils.damp(this.torsoMesh.rotation.y, 0, 10, dt);
      this.headGroup.rotation.y = THREE.MathUtils.damp(this.headGroup.rotation.y, 0, 10, dt);
    }
  }

  public setNameplate(nameText: string, accentColor: string = '#38bdf8') {
    const existing = this.headGroup.getObjectByName('AvatarNameplate');
    if (existing) {
      this.headGroup.remove(existing);
    }
    if (!nameText) return;

    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 72;
    const ctx = canvas.getContext('2d')!;

    // Pill background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(8, 8, 304, 56, 18);
    ctx.fill();

    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(8, 8, 304, 56, 18);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(nameText.slice(0, 16), 160, 37);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.name = 'AvatarNameplate';
    sprite.scale.set(2.8, 0.65, 1);
    sprite.position.set(0, 1.55, 0);
    this.headGroup.add(sprite);
  }

  public dispose() {
    this.headMaterial.dispose();
    this.torsoMaterial.dispose();
    this.sleeveMaterial.dispose();
    this.legsMaterial.dispose();
    if (this.faceTexture) {
      this.faceTexture.dispose();
    }
    if (this.torsoTexture) {
      this.torsoTexture.dispose();
    }
    if (this.legsTexture) {
      this.legsTexture.dispose();
    }
    const existing = this.headGroup.getObjectByName('AvatarNameplate') as THREE.Sprite | undefined;
    if (existing) {
      existing.material.map?.dispose();
      existing.material.dispose();
    }
  }
}

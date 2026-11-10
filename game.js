// ============================================================
// IMPOSSIBLE MAZE - 3D FIRST-PERSON ENGINE & GAMEPLAY LOGIC
// Powered by Three.js
// ============================================================

class ImpossibleMazeGame {
  constructor() {
    this.currentLevel = 0;
    this.lives = 3;
    this.timeLeft = 150;
    this.hasKey = false;
    this.isPaused = false;
    this.isGameOver = false;
    this.isVictory = false;
    this.isPlaying = false;

    // Movement & Orientation
    this.cameraPitch = 0;
    this.cameraYaw = 0;
    this.lastPlayerYaw = 0;
    this.turnAccumulator = 0;
    this.shiftCooldown = 0;

    this.keys = { forward: false, backward: false, left: false, right: false, sprint: false };
    this.velocity = new THREE.Vector3();
    this.moveSpeed = 4.2;
    this.sprintMultiplier = 1.6;

    // Touch joystick state
    this.touchMove = { x: 0, y: 0 };
    this.touchLookLast = { x: 0, y: 0 };
    this.isDraggingLook = false;

    // Three.js Core
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.flashlight = null;
    this.ambientLight = null;

    // Maze Objects
    this.mazeData = null;
    this.wallMeshes = [];
    this.shiftableMeshes = [];
    this.spikes = [];
    this.teleports = [];
    this.keyMesh = null;
    this.exitDoorMesh = null;
    this.fakeExitMesh = null;
    this.secretWallMesh = null;
    this.CELL_SIZE = 3; // 3 units per maze block

    // Ghosts & Horror Stalkers
    this.ghosts = [];
    this.jumpscareActive = false;
    this.jumpscareCooldown = 0;
    this.horrorEventTimer = 0;

    // UI Elements
    this.hudLevel = document.getElementById('hud-level');
    this.hudLives = document.getElementById('hud-lives');
    this.hudTimer = document.getElementById('hud-timer');
    this.hudKeys = document.getElementById('hud-keys');
    this.hudStatus = document.getElementById('hud-status');
    this.flashOverlay = document.getElementById('flash-overlay');
    this.whisperText = document.getElementById('whisper-text');
    this.jumpscareOverlay = document.getElementById('jumpscare-overlay');
    this.staticOverlay = document.getElementById('static-overlay');
    
    this.startScreen = document.getElementById('start-screen');
    this.pauseScreen = document.getElementById('pause-screen');
    this.gameoverScreen = document.getElementById('gameover-screen');
    this.victoryScreen = document.getElementById('victory-screen');

    this.init();
  }

  init() {
    this.initThree();
    this.setupEventListeners();
    this.setupMobileControls();
  }

  // ----------------------------------------------------------
  // Three.js Setup with Procedural Textures & Atmospheric Lighting
  // ----------------------------------------------------------
  initThree() {
    const container = document.getElementById('game-container');
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 100);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    // Fog for psychological horror
    this.scene.fog = new THREE.FogExp2(0x05060b, 0.12);

    // Subtle Ambient Light
    this.ambientLight = new THREE.AmbientLight(0x181824, 0.55);
    this.scene.add(this.ambientLight);

    // Player Flashlight attached to camera
    this.flashlight = new THREE.SpotLight(0xfff1cf, 2.2, 22, Math.PI / 4.2, 0.45, 1.2);
    this.flashlight.position.set(0, 0, 0);
    this.camera.add(this.flashlight);
    this.flashlight.target = new THREE.Object3D();
    this.flashlight.target.position.set(0, 0, -5);
    this.camera.add(this.flashlight.target);

    // Pointlight at player chest for close-up illumination
    this.chestLight = new THREE.PointLight(0xa5c0ff, 0.8, 4.5);
    this.camera.add(this.chestLight);

    this.scene.add(this.camera);

    window.addEventListener('resize', () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });
  }

  // Generate procedural canvas textures for walls, floor, and runes
  createProceduralTextures(levelConfig) {
    // 1. Stone Wall Texture
    const wallCanvas = document.createElement('canvas');
    wallCanvas.width = 256;
    wallCanvas.height = 256;
    const wctx = wallCanvas.getContext('2d');
    wctx.fillStyle = '#' + levelConfig.wallColor.toString(16).padStart(6, '0');
    wctx.fillRect(0, 0, 256, 256);

    // Brick pattern
    wctx.strokeStyle = '#05070c';
    wctx.lineWidth = 4;
    for (let y = 0; y < 256; y += 32) {
      wctx.beginPath();
      wctx.moveTo(0, y);
      wctx.lineTo(256, y);
      wctx.stroke();

      const offset = (y / 32) % 2 === 0 ? 0 : 32;
      for (let x = offset; x < 256; x += 64) {
        wctx.beginPath();
        wctx.moveTo(x, y);
        wctx.lineTo(x, y + 32);
        wctx.stroke();
      }
    }
    // Noise / moss grit
    for (let i = 0; i < 2000; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      wctx.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.06)';
      wctx.fillRect(x, y, 2, 2);
    }
    const wallTexture = new THREE.CanvasTexture(wallCanvas);

    // 2. Floor Stone Tiles
    const floorCanvas = document.createElement('canvas');
    floorCanvas.width = 256;
    floorCanvas.height = 256;
    const fctx = floorCanvas.getContext('2d');
    fctx.fillStyle = '#' + levelConfig.floorColor.toString(16).padStart(6, '0');
    fctx.fillRect(0, 0, 256, 256);
    fctx.strokeStyle = '#020306';
    fctx.lineWidth = 3;
    for (let i = 0; i <= 256; i += 64) {
      fctx.strokeRect(i, 0, 64, 256);
      fctx.strokeRect(0, i, 256, 64);
    }
    const floorTexture = new THREE.CanvasTexture(floorCanvas);
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(levelConfig.width, levelConfig.height);

    return { wallTexture, floorTexture };
  }

  // ----------------------------------------------------------
  // Build 3D Maze World
  // ----------------------------------------------------------
  buildLevel(levelIdx) {
    this.currentLevel = levelIdx;
    this.hasKey = false;
    this.isGameOver = false;
    this.isVictory = false;
    this.isPaused = false;
    this.turnAccumulator = 0;
    this.shiftCooldown = 0;

    // Clear previous maze objects
    while (this.scene.children.length > 0) {
      const obj = this.scene.children[0];
      if (obj === this.camera || obj === this.ambientLight) {
        this.scene.remove(obj);
      } else {
        if (obj.geometry) obj.geometry.dispose();
        this.scene.remove(obj);
      }
    }
    this.scene.add(this.camera);
    this.scene.add(this.ambientLight);

    this.mazeData = window.mazeBuilder.generate(levelIdx);
    const cfg = this.mazeData.config;
    this.timeLeft = cfg.timeLimit;

    // Update scene fog & colors
    this.scene.fog.color.setHex(cfg.fogColor);
    this.scene.fog.density = cfg.fogDensity;
    this.renderer.setClearColor(cfg.fogColor);

    const { wallTexture, floorTexture } = this.createProceduralTextures(cfg);

    const wallGeo = new THREE.BoxGeometry(this.CELL_SIZE, 3.2, this.CELL_SIZE);
    const wallMat = new THREE.MeshStandardMaterial({
      map: wallTexture,
      roughness: 0.85,
      metalness: 0.15
    });

    const shiftWallMat = new THREE.MeshStandardMaterial({
      color: 0x5a3d82,
      roughness: 0.6,
      metalness: 0.3,
      emissive: 0x1d1133,
      emissiveIntensity: 0.4
    });

    // Floor and Ceiling
    const totalW = this.mazeData.width * this.CELL_SIZE;
    const totalH = this.mazeData.height * this.CELL_SIZE;

    const floorGeo = new THREE.PlaneGeometry(totalW, totalH);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTexture,
      roughness: 0.9,
      metalness: 0.1
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(totalW / 2 - this.CELL_SIZE / 2, 0, totalH / 2 - this.CELL_SIZE / 2);
    this.scene.add(floor);

    // Dark Ceiling
    const ceilMat = new THREE.MeshBasicMaterial({ color: 0x050608 });
    const ceiling = new THREE.Mesh(floorGeo, ceilMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(totalW / 2 - this.CELL_SIZE / 2, 3.2, totalH / 2 - this.CELL_SIZE / 2);
    this.scene.add(ceiling);

    this.wallMeshes = [];
    this.shiftableMeshes = [];
    this.spikes = [];
    this.teleports = [];

    // Instantiate Maze Elements
    for (let y = 0; y < this.mazeData.height; y++) {
      for (let x = 0; x < this.mazeData.width; x++) {
        const type = this.mazeData.grid[y][x];
        const posX = x * this.CELL_SIZE;
        const posZ = y * this.CELL_SIZE;

        if (type === 1) {
          // Solid Wall
          const mesh = new THREE.Mesh(wallGeo, wallMat);
          mesh.position.set(posX, 1.6, posZ);
          this.scene.add(mesh);
          this.wallMeshes.push({ mesh, x, y, solid: true });
        } else if (type === 2) {
          // Shifting Wall
          const mesh = new THREE.Mesh(wallGeo, shiftWallMat);
          mesh.position.set(posX, 1.6, posZ);
          this.scene.add(mesh);
          this.shiftableMeshes.push({ mesh, x, y, active: true });
        } else if (type === 3) {
          // Spike Trap
          this.createSpikeTrap(posX, posZ, x, y);
        } else if (type === 4) {
          // Teleport Door (Swirling Vortex Portal)
          this.createTeleportPortal(posX, posZ, x, y);
        } else if (type === 5) {
          // Exit Door
          this.createExitDoor(posX, posZ, x, y);
        } else if (type === 6) {
          // Golden Key
          this.createKey(posX, posZ, x, y);
        } else if (type === 7) {
          // Fake Exit
          this.createFakeExit(posX, posZ, x, y);
        } else if (type === 8) {
          // Secret Passage (Illusory Wall)
          this.createSecretPassage(posX, posZ, x, y);
        }
      }
    }

    // Spawn Two Ugly Ghost Stalkers
    this.createGhostCreatures();

    // Set Player Spawn (At 1, 1)
    const spawnX = this.mazeData.spawn.x * this.CELL_SIZE;
    const spawnZ = this.mazeData.spawn.y * this.CELL_SIZE;
    this.camera.position.set(spawnX, 1.4, spawnZ);
    this.cameraYaw = 0;
    this.cameraPitch = 0;
    this.lastPlayerYaw = 0;

    this.updateHUD();
    this.showWhisper(`LEVEL ${this.currentLevel + 1}: ${cfg.title}`);
  }

  // ----------------------------------------------------------
  // Traps & Interactive Objects
  // ----------------------------------------------------------
  createSpikeTrap(x, z, gx, gy) {
    const group = new THREE.Group();
    // Base grate
    const plateGeo = new THREE.BoxGeometry(2.4, 0.08, 2.4);
    const plateMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8 });
    const plate = new THREE.Mesh(plateGeo, plateMat);
    plate.position.y = 0.04;
    group.add(plate);

    // Spikes (cones)
    const spikeGeo = new THREE.ConeGeometry(0.12, 1.2, 5);
    const spikeMat = new THREE.MeshStandardMaterial({ color: 0xb52222, metalness: 0.9, roughness: 0.3 });
    const spikeArray = [];

    for (let sx = -0.8; sx <= 0.8; sx += 0.5) {
      for (let sz = -0.8; sz <= 0.8; sz += 0.5) {
        const spike = new THREE.Mesh(spikeGeo, spikeMat);
        spike.position.set(sx, 0.6, sz);
        group.add(spike);
        spikeArray.push(spike);
      }
    }

    group.position.set(x, 0, z);
    this.scene.add(group);
    this.spikes.push({ group, gx, gy, spikeArray, timer: Math.random() * Math.PI, extended: true });
  }

  createTeleportPortal(x, z, gx, gy) {
    const group = new THREE.Group();
    // Portal ring
    const ringGeo = new THREE.TorusGeometry(1.0, 0.15, 8, 24);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x7b2cbf,
      emissive: 0x9d4edd,
      emissiveIntensity: 1.2
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 1.4;
    group.add(ring);

    // Swirling center light
    const light = new THREE.PointLight(0xa855f7, 1.5, 5);
    light.position.y = 1.4;
    group.add(light);

    group.position.set(x, 0, z);
    this.scene.add(group);
    this.teleports.push({ group, ring, light, gx, gy });
  }

  createExitDoor(x, z, gx, gy) {
    const group = new THREE.Group();
    // Archway
    const archGeo = new THREE.BoxGeometry(0.3, 2.6, 0.3);
    const archMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x15803d, emissiveIntensity: 0.6 });

    const postL = new THREE.Mesh(archGeo, archMat);
    postL.position.set(-1.1, 1.3, 0);
    const postR = new THREE.Mesh(archGeo, archMat);
    postR.position.set(1.1, 1.3, 0);

    const beamGeo = new THREE.BoxGeometry(2.5, 0.3, 0.3);
    const beam = new THREE.Mesh(beamGeo, archMat);
    beam.position.set(0, 2.6, 0);

    // Glowing Exit Portal Barrier
    const doorGeo = new THREE.PlaneGeometry(2.0, 2.4);
    const doorMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x059669,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide
    });
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(0, 1.3, 0);

    group.add(postL);
    group.add(postR);
    group.add(beam);
    group.add(door);

    const light = new THREE.PointLight(0x34d399, 2.2, 7);
    light.position.set(0, 1.5, 0);
    group.add(light);

    group.position.set(x, 0, z);
    this.scene.add(group);
    this.exitDoorMesh = { group, door, light, gx, gy, unlocked: false };
  }

  createFakeExit(x, z, gx, gy) {
    const group = new THREE.Group();
    // Mimic the exit door visually, but red-tinted trap aura
    const doorGeo = new THREE.PlaneGeometry(2.0, 2.4);
    const doorMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xb91c1c,
      emissiveIntensity: 0.9,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide
    });
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(0, 1.3, 0);
    group.add(door);

    const light = new THREE.PointLight(0xf87171, 1.8, 6);
    light.position.set(0, 1.5, 0);
    group.add(light);

    group.position.set(x, 0, z);
    this.scene.add(group);
    this.fakeExitMesh = { group, light, gx, gy };
  }

  createKey(x, z, gx, gy) {
    const group = new THREE.Group();
    // Golden Key design
    const shaftGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.6, 8);
    const keyMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      metalness: 0.9,
      roughness: 0.2,
      emissive: 0xeab308,
      emissiveIntensity: 0.5
    });
    const shaft = new THREE.Mesh(shaftGeo, keyMat);
    shaft.rotation.z = Math.PI / 2;

    const ringGeo = new THREE.TorusGeometry(0.12, 0.04, 8, 16);
    const ring = new THREE.Mesh(ringGeo, keyMat);
    ring.position.set(-0.35, 0, 0);

    const bitGeo = new THREE.BoxGeometry(0.06, 0.12, 0.04);
    const bit = new THREE.Mesh(bitGeo, keyMat);
    bit.position.set(0.2, -0.06, 0);

    group.add(shaft);
    group.add(ring);
    group.add(bit);

    const light = new THREE.PointLight(0xfef08a, 1.5, 4.5);
    group.add(light);

    group.position.set(x, 1.1, z);
    this.scene.add(group);
    this.keyMesh = { group, gx, gy, picked: false };
  }

  createSecretPassage(x, z, gx, gy) {
    // Secret Wall with slightly offset color that can be walked right through
    const secretGeo = new THREE.BoxGeometry(this.CELL_SIZE * 0.98, 3.1, this.CELL_SIZE * 0.98);
    const secretMat = new THREE.MeshStandardMaterial({
      color: 0x3d4257,
      roughness: 0.95,
      transparent: true,
      opacity: 0.92
    });
    const mesh = new THREE.Mesh(secretGeo, secretMat);
    mesh.position.set(x, 1.55, z);
    this.scene.add(mesh);
    this.secretWallMesh = { mesh, gx, gy };
  }

  // ----------------------------------------------------------
  // TWO UGLY GHOST CREATURES CREATION
  // 1. "The Weeping Stalker": Pale elongated gaunt demon with hollow eye sockets and long bloody claws.
  // 2. "The Crimson Screamer": Floating skull monstrosity with jagged bloody fangs and glowing red eyes.
  // ----------------------------------------------------------
  createGhostCreatures() {
    this.ghosts = [];

    // Find two corridor cells far from player spawn (1, 1)
    const validCells = [];
    for (let y = 3; y < this.mazeData.height - 2; y++) {
      for (let x = 3; x < this.mazeData.width - 2; x++) {
        if (this.mazeData.grid[y][x] === 0) {
          validCells.push({ x, y });
        }
      }
    }
    validCells.sort(() => Math.random() - 0.5);

    const pos1 = validCells.pop() || { x: 5, y: 5 };
    const pos2 = validCells.pop() || { x: 7, y: 7 };

    // --- CREATURE 1: "The Weeping Stalker" ---
    const stalkerGroup = new THREE.Group();
    // Shroud/Torso (twisted, decaying pale grey shroud)
    const torsoGeo = new THREE.CylinderGeometry(0.35, 0.15, 1.9, 8);
    const torsoMat = new THREE.MeshStandardMaterial({
      color: 0x22252a,
      roughness: 0.9,
      emissive: 0x080a10,
      emissiveIntensity: 0.3
    });
    const torso = new THREE.Mesh(torsoGeo, torsoMat);
    torso.position.y = 1.0;
    stalkerGroup.add(torso);

    // Gaunt elongated skull
    const headGeo = new THREE.SphereGeometry(0.38, 12, 12);
    headGeo.scale(0.85, 1.3, 0.95);
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xd8d8d0,
      roughness: 0.7,
      emissive: 0x333333,
      emissiveIntensity: 0.2
    });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(0, 2.05, 0);
    stalkerGroup.add(head);

    // Deep hollow black eye cavities
    const eyeCavityGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const eyeCavityMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const eyeL = new THREE.Mesh(eyeCavityGeo, eyeCavityMat);
    eyeL.position.set(-0.13, 2.12, 0.3);
    const eyeR = new THREE.Mesh(eyeCavityGeo, eyeCavityMat);
    eyeR.position.set(0.13, 2.12, 0.3);
    stalkerGroup.add(eyeL);
    stalkerGroup.add(eyeR);

    // Agonized wide-open weeping mouth
    const mouthGeo = new THREE.CylinderGeometry(0.08, 0.05, 0.22, 6);
    const mouthMat = new THREE.MeshBasicMaterial({ color: 0x1a0202 });
    const mouth = new THREE.Mesh(mouthGeo, mouthMat);
    mouth.position.set(0, 1.88, 0.3);
    stalkerGroup.add(mouth);

    // Long spindly grasping claws
    const armGeo = new THREE.CylinderGeometry(0.05, 0.03, 1.4, 6);
    const clawMat = new THREE.MeshStandardMaterial({ color: 0x8a1515, roughness: 0.6 });
    const armL = new THREE.Mesh(armGeo, clawMat);
    armL.position.set(-0.55, 1.25, 0.25);
    armL.rotation.z = 0.4;
    armL.rotation.x = -0.3;
    const armR = new THREE.Mesh(armGeo, clawMat);
    armR.position.set(0.55, 1.25, 0.25);
    armR.rotation.z = -0.4;
    armR.rotation.x = -0.3;
    stalkerGroup.add(armL);
    stalkerGroup.add(armR);

    // Eerie cyan/grey aura light
    const stalkerLight = new THREE.PointLight(0x4466aa, 1.8, 6.0);
    stalkerLight.position.set(0, 2.0, 0);
    stalkerGroup.add(stalkerLight);

    stalkerGroup.position.set(pos1.x * this.CELL_SIZE, 0, pos1.y * this.CELL_SIZE);
    this.scene.add(stalkerGroup);

    this.ghosts.push({
      id: 'stalker',
      name: 'The Weeping Stalker',
      group: stalkerGroup,
      head: head,
      arms: [armL, armR],
      light: stalkerLight,
      speed: 2.4 + this.currentLevel * 0.45,
      patrolDir: new THREE.Vector3(1, 0, 0),
      state: 'patrol', // patrol, chase
      agroRange: 9.0,
      groanTimer: 3.0
    });

    // --- CREATURE 2: "The Crimson Screamer" ---
    const screamerGroup = new THREE.Group();
    // Grotesque floating head
    const skullGeo = new THREE.SphereGeometry(0.48, 14, 14);
    skullGeo.scale(1.0, 1.15, 1.2);
    const skullMat = new THREE.MeshStandardMaterial({
      color: 0x3d0808,
      roughness: 0.5,
      emissive: 0x550a0a,
      emissiveIntensity: 0.7
    });
    const skull = new THREE.Mesh(skullGeo, skullMat);
    skull.position.y = 1.6;
    screamerGroup.add(skull);

    // Bleeding glowing demon red eyes
    const demonEyeGeo = new THREE.SphereGeometry(0.1, 8, 8);
    const demonEyeMat = new THREE.MeshBasicMaterial({ color: 0xff1111 });
    const demonEyeL = new THREE.Mesh(demonEyeGeo, demonEyeMat);
    demonEyeL.position.set(-0.18, 1.72, 0.45);
    const demonEyeR = new THREE.Mesh(demonEyeGeo, demonEyeMat);
    demonEyeR.position.set(0.18, 1.72, 0.45);
    screamerGroup.add(demonEyeL);
    screamerGroup.add(demonEyeR);

    // Jagged fang row
    const jawGeo = new THREE.BoxGeometry(0.38, 0.22, 0.35);
    const jawMat = new THREE.MeshStandardMaterial({ color: 0x110202, roughness: 0.8 });
    const jaw = new THREE.Mesh(jawGeo, jawMat);
    jaw.position.set(0, 1.35, 0.38);
    screamerGroup.add(jaw);

    // Fangs
    const fangGeo = new THREE.ConeGeometry(0.04, 0.16, 4);
    const fangMat = new THREE.MeshBasicMaterial({ color: 0xf5f5dc });
    for (let fx = -0.14; fx <= 0.14; fx += 0.07) {
      const fang = new THREE.Mesh(fangGeo, fangMat);
      fang.position.set(fx, 1.48, 0.48);
      fang.rotation.x = Math.PI;
      screamerGroup.add(fang);
    }

    // Tendrils of darkness dangling underneath
    for (let i = 0; i < 5; i++) {
      const tendrilGeo = new THREE.CylinderGeometry(0.03, 0.01, 1.2, 5);
      const tendrilMat = new THREE.MeshBasicMaterial({ color: 0x1a0505 });
      const tendril = new THREE.Mesh(tendrilGeo, tendrilMat);
      tendril.position.set((Math.random() - 0.5) * 0.5, 0.9, (Math.random() - 0.5) * 0.4);
      tendril.rotation.z = (Math.random() - 0.5) * 0.4;
      screamerGroup.add(tendril);
    }

    // Terrifying Blood Red Point Light
    const screamerLight = new THREE.PointLight(0xff1111, 2.5, 7.5);
    screamerLight.position.set(0, 1.6, 0);
    screamerGroup.add(screamerLight);

    screamerGroup.position.set(pos2.x * this.CELL_SIZE, 0, pos2.y * this.CELL_SIZE);
    this.scene.add(screamerGroup);

    this.ghosts.push({
      id: 'screamer',
      name: 'The Crimson Screamer',
      group: screamerGroup,
      head: skull,
      light: screamerLight,
      speed: 2.8 + this.currentLevel * 0.55,
      patrolDir: new THREE.Vector3(0, 0, 1),
      state: 'patrol',
      agroRange: 11.0,
      groanTimer: 2.0
    });
  }

  // ----------------------------------------------------------
  // Special Mechanic: Maze Reconfiguration on Turnaround
  // ----------------------------------------------------------
  checkPlayerTurnaround(deltaYaw) {
    this.turnAccumulator += Math.abs(deltaYaw);
    this.shiftCooldown -= 0.016;

    // If player rotates 180 degrees (PI radians) and cooldown elapsed
    if (this.turnAccumulator >= Math.PI * 0.85 && this.shiftCooldown <= 0) {
      this.triggerMazeShift();
      this.turnAccumulator = 0;
      this.shiftCooldown = 4.0; // Cooldown before next shift
    }
  }

  triggerMazeShift() {
    if (this.shiftableMeshes.length === 0) return;

    window.mazeAudio.playShiftSound();
    this.flashRed(0.3, 'rgba(120, 50, 255, 0.4)');
    this.showWhisper('🌀 THE CORRIDORS RECONSTRUCTED BEHIND YOU!');

    // Toggle states of shiftable walls
    this.shiftableMeshes.forEach((item) => {
      // 50% chance to toggle wall existence
      if (Math.random() < 0.5) {
        item.active = !item.active;
        if (item.active) {
          item.mesh.position.y = 1.6; // Solid wall
          this.mazeData.grid[item.y][item.x] = 2;
        } else {
          item.mesh.position.y = -5.0; // Sunk into ground
          this.mazeData.grid[item.y][item.x] = 0;
        }
      }
    });
  }

  // ----------------------------------------------------------
  // Player Collision & Traps Detection
  // ----------------------------------------------------------
  checkCollisions(targetPos) {
    const playerRadius = 0.55;
    const minGridX = Math.floor((targetPos.x - playerRadius) / this.CELL_SIZE);
    const maxGridX = Math.floor((targetPos.x + playerRadius) / this.CELL_SIZE);
    const minGridY = Math.floor((targetPos.z - playerRadius) / this.CELL_SIZE);
    const maxGridY = Math.floor((targetPos.z + playerRadius) / this.CELL_SIZE);

    for (let gy = minGridY; gy <= maxGridY; gy++) {
      for (let gx = minGridX; gx <= maxGridX; gx++) {
        if (gx < 0 || gx >= this.mazeData.width || gy < 0 || gy >= this.mazeData.height) {
          return true; // Out of bounds
        }
        const cell = this.mazeData.grid[gy][gx];
        // Solid wall or active shiftable wall
        if (cell === 1 || cell === 2) {
          const cellMinX = gx * this.CELL_SIZE - this.CELL_SIZE / 2;
          const cellMaxX = gx * this.CELL_SIZE + this.CELL_SIZE / 2;
          const cellMinZ = gy * this.CELL_SIZE - this.CELL_SIZE / 2;
          const cellMaxZ = gy * this.CELL_SIZE + this.CELL_SIZE / 2;

          // Box collision
          if (
            targetPos.x + playerRadius > cellMinX &&
            targetPos.x - playerRadius < cellMaxX &&
            targetPos.z + playerRadius > cellMinZ &&
            targetPos.z - playerRadius < cellMaxZ
          ) {
            return true;
          }
        }
      }
    }
    return false;
  }

  // Interaction & Trigger Proximity Check
  checkInteractions() {
    const px = this.camera.position.x;
    const pz = this.camera.position.z;
    const playerCellX = Math.round(px / this.CELL_SIZE);
    const playerCellY = Math.round(pz / this.CELL_SIZE);

    // 1. Key Pickup
    if (this.keyMesh && !this.keyMesh.picked) {
      const dist = Math.hypot(px - this.keyMesh.group.position.x, pz - this.keyMesh.group.position.z);
      if (dist < 1.4) {
        this.keyMesh.picked = true;
        this.hasKey = true;
        this.scene.remove(this.keyMesh.group);
        window.mazeAudio.playKeyPickup();
        this.showWhisper('🗝️ RUNIC KEY COLLECTED! FIND THE EXIT PORTAL!');
        this.updateHUD();
      }
    }

    // 2. Spike Trap Damage
    this.spikes.forEach((spike) => {
      const dist = Math.hypot(px - spike.group.position.x, pz - spike.group.position.z);
      if (dist < 1.1 && spike.extended) {
        this.takeDamage('You were impaled on cursed iron spikes!');
      }
    });

    // 3. Teleport Doors
    this.teleports.forEach((tp) => {
      const dist = Math.hypot(px - tp.group.position.x, pz - tp.group.position.z);
      if (dist < 1.2) {
        this.teleportPlayer();
      }
    });

    // 4. Fake Exit Gate (Trap)
    if (this.fakeExitMesh) {
      const dist = Math.hypot(px - this.fakeExitMesh.group.position.x, pz - this.fakeExitMesh.group.position.z);
      if (dist < 1.3) {
        this.triggerJumpscare('IT WAS A TRAP! THE ABYSS STARES BACK!');
        this.takeDamage('IT WAS A FAKE EXIT! THE VOID CONSUMES YOU!');
        // Warp back to start
        this.warpToCell(this.mazeData.spawn.x, this.mazeData.spawn.y);
      }
    }

    // 5. Real Exit Door
    if (this.exitDoorMesh) {
      const dist = Math.hypot(px - this.exitDoorMesh.group.position.x, pz - this.exitDoorMesh.group.position.z);
      if (dist < 1.4) {
        if (this.hasKey) {
          this.advanceLevel();
        } else {
          this.showWhisper('🔒 THE PORTAL IS SEALED! FIND THE GOLDEN KEY!');
        }
      }
    }
  }

  teleportPlayer() {
    window.mazeAudio.playTeleport();
    this.flashRed(0.4, 'rgba(160, 60, 255, 0.7)');

    // 50% teleport to start, 50% teleport to random valid corridor
    let targetX = 1;
    let targetY = 1;
    if (Math.random() < 0.6) {
      const openCells = [];
      for (let y = 1; y < this.mazeData.height - 1; y++) {
        for (let x = 1; x < this.mazeData.width - 1; x++) {
          if (this.mazeData.grid[y][x] === 0) openCells.push({ x, y });
        }
      }
      const randomCell = openCells[Math.floor(Math.random() * openCells.length)];
      if (randomCell) {
        targetX = randomCell.x;
        targetY = randomCell.y;
      }
      this.showWhisper('🌀 REALITY WARPED! YOU TELEPORTED TO UNKNOWN DEPTHS!');
    } else {
      this.showWhisper('🌀 TRAPPED IN A LOOP! CAST BACK TO THE BEGINNING!');
    }

    this.warpToCell(targetX, targetY);
  }

  warpToCell(x, y) {
    this.camera.position.x = x * this.CELL_SIZE;
    this.camera.position.z = y * this.CELL_SIZE;
  }

  // ----------------------------------------------------------
  // JUMPSCARE & PSYCHOLOGICAL HORROR ENGINE
  // ----------------------------------------------------------
  triggerJumpscare(customText = 'IT FOUND YOU.') {
    if (this.jumpscareActive) return;
    this.jumpscareActive = true;
    this.jumpscareCooldown = 6.0;

    window.mazeAudio.playJumpscare();
    const caption = document.getElementById('jumpscare-caption');
    if (caption) caption.innerText = customText;

    if (this.jumpscareOverlay) {
      this.jumpscareOverlay.classList.remove('hidden');
    }

    // High intensity screen strobe
    this.flashRed(0.85, 'rgba(255, 0, 0, 0.95)');

    setTimeout(() => {
      if (this.jumpscareOverlay) {
        this.jumpscareOverlay.classList.add('hidden');
      }
      this.jumpscareActive = false;
    }, 750);
  }

  takeDamage(reason) {
    if (this.isGameOver) return;
    this.lives--;
    window.mazeAudio.playTrapHit();
    this.flashRed(0.5, 'rgba(255, 20, 20, 0.8)');
    this.showWhisper('⚠️ YOU TOOK DAMAGE!');
    this.updateHUD();

    if (this.lives <= 0) {
      this.triggerGameOver(reason);
    }
  }

  flashRed(duration = 0.3, color = 'rgba(255, 30, 30, 0.6)') {
    this.flashOverlay.style.backgroundColor = color;
    this.flashOverlay.style.opacity = '1';
    setTimeout(() => {
      this.flashOverlay.style.opacity = '0';
    }, duration * 1000);
  }

  showWhisper(text, duration = 3000) {
    this.whisperText.innerText = text;
    this.whisperText.style.opacity = '1';
    if (this.whisperTimer) clearTimeout(this.whisperTimer);
    this.whisperTimer = setTimeout(() => {
      this.whisperText.style.opacity = '0';
    }, duration);
  }

  advanceLevel() {
    window.mazeAudio.playDoorUnlock();
    if (this.currentLevel + 1 < window.mazeBuilder.levels.length) {
      this.currentLevel++;
      this.buildLevel(this.currentLevel);
      this.showWhisper(`DESCENDING TO LEVEL ${this.currentLevel + 1}...`);
    } else {
      this.triggerVictory();
    }
  }

  triggerGameOver(reason) {
    this.isGameOver = true;
    this.isPlaying = false;
    window.mazeAudio.playGameOver();
    document.exitPointerLock?.();

    document.getElementById('gameover-reason').innerText = reason;
    document.getElementById('gameover-stats').innerHTML = `
      <div>Levels Cleared: <strong>${this.currentLevel} / 3</strong></div>
      <div>Time Survived: <strong>${Math.floor(this.mazeData.config.timeLimit - this.timeLeft)}s</strong></div>
    `;
    this.gameoverScreen.classList.remove('hidden');
  }

  triggerVictory() {
    this.isVictory = true;
    this.isPlaying = false;
    window.mazeAudio.playVictory();
    document.exitPointerLock?.();

    document.getElementById('victory-stats').innerHTML = `
      <div>Lives Remaining: <strong>${'❤️'.repeat(this.lives)}</strong></div>
      <div>Final Level Time: <strong>${Math.floor(this.timeLeft)}s remaining</strong></div>
    `;
    this.victoryScreen.classList.remove('hidden');
  }

  // ----------------------------------------------------------
  // Controls & Event Listeners
  // ----------------------------------------------------------
  setupEventListeners() {
    // Keyboard inputs
    window.addEventListener('keydown', (e) => {
      if (!this.isPlaying && e.code === 'Space') {
        this.startGame();
        return;
      }
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.keys.forward = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.keys.backward = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.keys.left = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.keys.right = true;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.keys.sprint = true;
          break;
        case 'KeyP':
          this.togglePause();
          break;
        case 'KeyE':
          this.checkInteractions();
          break;
        case 'KeyM':
          this.toggleAudio();
          break;
      }
    });

    window.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.keys.forward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.keys.backward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.keys.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.keys.right = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.keys.sprint = false;
          break;
      }
    });

    // Pointer Lock for Mouse Look
    const canvas = this.renderer.domElement;
    canvas.addEventListener('click', () => {
      if (this.isPlaying && !this.isPaused) {
        canvas.requestPointerLock?.();
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === canvas && this.isPlaying && !this.isPaused) {
        const mouseSensitivity = 0.0022;
        const deltaX = e.movementX * mouseSensitivity;
        const deltaY = e.movementY * mouseSensitivity;

        this.cameraYaw -= deltaX;
        this.cameraPitch -= deltaY;
        this.cameraPitch = Math.max(-Math.PI / 2.3, Math.min(Math.PI / 2.3, this.cameraPitch));

        this.checkPlayerTurnaround(deltaX);
      }
    });

    // UI Buttons
    document.getElementById('btn-start').addEventListener('click', () => this.startGame());
    document.getElementById('btn-pause').addEventListener('click', () => this.togglePause());
    document.getElementById('btn-resume').addEventListener('click', () => this.togglePause());
    document.getElementById('btn-restart-pause').addEventListener('click', () => this.restartGame());
    document.getElementById('btn-retry').addEventListener('click', () => this.restartGame());
    document.getElementById('btn-play-again').addEventListener('click', () => this.restartGame());
    document.getElementById('btn-audio').addEventListener('click', () => this.toggleAudio());
  }

  // Virtual Joystick & Swipe Look for Mobile
  setupMobileControls() {
    const joystickZone = document.getElementById('joystick-zone');
    const joystickStick = document.getElementById('joystick-stick');
    const interactBtn = document.getElementById('btn-interact');

    let joystickActive = false;
    let baseRect = null;

    joystickZone.addEventListener('touchstart', (e) => {
      joystickActive = true;
      baseRect = joystickZone.getBoundingClientRect();
      this.handleJoystick(e.touches[0], baseRect, joystickStick);
    });

    window.addEventListener('touchmove', (e) => {
      if (joystickActive) {
        for (let i = 0; i < e.touches.length; i++) {
          const t = e.touches[i];
          if (t.clientX < window.innerWidth * 0.5) {
            this.handleJoystick(t, baseRect, joystickStick);
            break;
          }
        }
      }
    });

    const resetJoystick = () => {
      joystickActive = false;
      this.touchMove.x = 0;
      this.touchMove.y = 0;
      joystickStick.style.transform = `translate(0px, 0px)`;
    };
    window.addEventListener('touchend', resetJoystick);
    window.addEventListener('touchcancel', resetJoystick);

    // Right screen swipe to look
    window.addEventListener('touchstart', (e) => {
      for (let i = 0; i < e.touches.length; i++) {
        const t = e.touches[i];
        if (t.clientX > window.innerWidth * 0.5) {
          this.isDraggingLook = true;
          this.touchLookLast.x = t.clientX;
          this.touchLookLast.y = t.clientY;
          break;
        }
      }
    });

    window.addEventListener('touchmove', (e) => {
      if (this.isDraggingLook) {
        for (let i = 0; i < e.touches.length; i++) {
          const t = e.touches[i];
          if (t.clientX > window.innerWidth * 0.4) {
            const dx = (t.clientX - this.touchLookLast.x) * 0.005;
            const dy = (t.clientY - this.touchLookLast.y) * 0.005;
            this.cameraYaw -= dx;
            this.cameraPitch -= dy;
            this.cameraPitch = Math.max(-Math.PI / 2.3, Math.min(Math.PI / 2.3, this.cameraPitch));
            this.checkPlayerTurnaround(dx);
            this.touchLookLast.x = t.clientX;
            this.touchLookLast.y = t.clientY;
            break;
          }
        }
      }
    });

    window.addEventListener('touchend', () => { this.isDraggingLook = false; });
    interactBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.checkInteractions();
    });
  }

  handleJoystick(touch, baseRect, stick) {
    const centerX = baseRect.left + baseRect.width / 2;
    const centerY = baseRect.top + baseRect.height / 2;
    let dx = touch.clientX - centerX;
    let dy = touch.clientY - centerY;
    const maxRadius = baseRect.width / 2.2;
    const dist = Math.hypot(dx, dy);

    if (dist > maxRadius) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }

    stick.style.transform = `translate(${dx}px, ${dy}px)`;
    this.touchMove.x = dx / maxRadius;
    this.touchMove.y = dy / maxRadius;
  }

  startGame() {
    window.mazeAudio.init();
    window.mazeAudio.resume();
    this.startScreen.classList.add('hidden');
    this.lives = 3;
    this.buildLevel(0);
    this.isPlaying = true;
    this.renderer.domElement.requestPointerLock?.();
  }

  restartGame() {
    this.pauseScreen.classList.add('hidden');
    this.gameoverScreen.classList.add('hidden');
    this.victoryScreen.classList.add('hidden');
    this.lives = 3;
    this.buildLevel(0);
    this.isPlaying = true;
    this.renderer.domElement.requestPointerLock?.();
  }

  togglePause() {
    if (!this.isPlaying || this.isGameOver || this.isVictory) return;
    this.isPaused = !this.isPaused;
    if (this.isPaused) {
      document.exitPointerLock?.();
      this.pauseScreen.classList.remove('hidden');
    } else {
      this.pauseScreen.classList.add('hidden');
      this.renderer.domElement.requestPointerLock?.();
    }
  }

  toggleAudio() {
    const isMuted = window.mazeAudio.toggleMute();
    document.getElementById('btn-audio').innerText = isMuted ? '🔇' : '🔊';
  }

  updateHUD() {
    this.hudLevel.innerText = `${this.currentLevel + 1} / 3`;
    this.hudLives.innerText = '❤️'.repeat(Math.max(0, this.lives));
    this.hudKeys.innerText = this.hasKey ? '🗝️ 1 / 1 (READY)' : '🗝️ 0 / 1';
    this.hudKeys.style.color = this.hasKey ? '#facc15' : '#ffffff';

    const mins = Math.floor(this.timeLeft / 60);
    const secs = Math.floor(this.timeLeft % 60);
    this.hudTimer.innerText = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    if (this.timeLeft <= 30) {
      this.hudTimer.classList.add('warning');
    } else {
      this.hudTimer.classList.remove('warning');
    }
  }

  // ----------------------------------------------------------
  // Main Game Loop & Animations
  // ----------------------------------------------------------
  update(dt) {
    if (!this.isPlaying || this.isPaused || this.isGameOver || this.isVictory) return;

    // Timer countdown
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.triggerGameOver('Time ran out! The maze sealed permanently.');
      return;
    }
    this.updateHUD();

    if (this.timeLeft <= 20) {
      window.mazeAudio.triggerHeartbeat();
    }

    // Camera rotation update
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.cameraYaw;
    this.camera.rotation.x = this.cameraPitch;

    // Calculate Movement Vector
    const moveDir = new THREE.Vector3();
    if (this.keys.forward) moveDir.z -= 1;
    if (this.keys.backward) moveDir.z += 1;
    if (this.keys.left) moveDir.x -= 1;
    if (this.keys.right) moveDir.x += 1;

    // Add mobile touch joystick input
    if (Math.abs(this.touchMove.x) > 0.1 || Math.abs(this.touchMove.y) > 0.1) {
      moveDir.x += this.touchMove.x;
      moveDir.z += this.touchMove.y;
    }

    if (moveDir.lengthSq() > 0) {
      moveDir.normalize();
      const currentSpeed = this.moveSpeed * (this.keys.sprint ? this.sprintMultiplier : 1.0);

      // Rotate movement vector by camera yaw
      moveDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.cameraYaw);

      // Attempt X and Z movement separately for smooth sliding against walls
      const nextX = this.camera.position.clone();
      nextX.x += moveDir.x * currentSpeed * dt;
      if (!this.checkCollisions(nextX)) {
        this.camera.position.x = nextX.x;
      }

      const nextZ = this.camera.position.clone();
      nextZ.z += moveDir.z * currentSpeed * dt;
      if (!this.checkCollisions(nextZ)) {
        this.camera.position.z = nextZ.z;
      }

      // Footstep sound
      if (!this.lastStepTime || performance.now() - this.lastStepTime > (this.keys.sprint ? 280 : 420)) {
        window.mazeAudio.playFootstep();
        this.lastStepTime = performance.now();
      }

      // Head bobbing effect
      const bobbing = Math.sin(performance.now() * 0.008) * 0.04;
      this.camera.position.y = 1.4 + bobbing;
    } else {
      this.camera.position.y = 1.4;
    }

    // Check interactions / proximity triggers
    this.checkInteractions();

    // Animate Key rotation & float
    if (this.keyMesh && !this.keyMesh.picked) {
      this.keyMesh.group.rotation.y += dt * 2.0;
      this.keyMesh.group.position.y = 1.1 + Math.sin(performance.now() * 0.003) * 0.12;
    }

    // Animate Teleport rings
    this.teleports.forEach((tp) => {
      tp.ring.rotation.z += dt * 3.0;
      tp.ring.rotation.x += dt * 1.5;
    });

    // Animate Spike Traps (periodic stabbing in/out)
    this.spikes.forEach((spike) => {
      spike.timer += dt * 2.5;
      const spikeHeight = Math.sin(spike.timer);
      spike.extended = spikeHeight > 0.2;
      spike.spikeArray.forEach((s) => {
        s.position.y = spike.extended ? 0.6 : -0.4;
      });
    });

    // Flickering Flashlight Effect for Horror
    if (Math.random() < 0.02) {
      this.flashlight.intensity = 1.2 + Math.random() * 1.4;
    }

    // --------------------------------------------------------
    // GHOST CREATURES AI & STALKING BEHAVIOR
    // --------------------------------------------------------
    const px = this.camera.position.x;
    const pz = this.camera.position.z;
    this.jumpscareCooldown -= dt;
    this.horrorEventTimer += dt;

    // Random psychological whispers and flickers
    if (this.horrorEventTimer > 18.0) {
      this.horrorEventTimer = 0;
      const creepyWhispers = [
        'DON\'T LOOK BEHIND YOU...',
        'IT HEARS YOUR HEART...',
        'YOU ARE NEVER ALONE...',
        'THE WALLS ARE CLOSING IN...'
      ];
      this.showWhisper(creepyWhispers[Math.floor(Math.random() * creepyWhispers.length)], 3500);
      window.mazeAudio.playGhostGroan();
    }

    this.ghosts.forEach((ghost) => {
      const gx = ghost.group.position.x;
      const gz = ghost.group.position.z;
      const distToPlayer = Math.hypot(px - gx, pz - gz);

      // Rotate ghost face toward player
      ghost.group.lookAt(px, ghost.group.position.y, pz);

      // Groan audio timer
      ghost.groanTimer -= dt;
      if (distToPlayer < ghost.agroRange && ghost.groanTimer <= 0) {
        if (ghost.id === 'screamer') {
          window.mazeAudio.playGhostShriek();
        } else {
          window.mazeAudio.playGhostGroan();
        }
        ghost.groanTimer = 4.5 + Math.random() * 3.0;
      }

      // Check Line-of-sight / Distance to chase
      if (distToPlayer < ghost.agroRange) {
        ghost.state = 'chase';
        // Direction to player
        const dirX = (px - gx) / distToPlayer;
        const dirZ = (pz - gz) / distToPlayer;

        // Move toward player
        const nextX = ghost.group.position.clone();
        nextX.x += dirX * ghost.speed * dt;
        if (!this.checkCollisions(nextX)) {
          ghost.group.position.x = nextX.x;
        }

        const nextZ = ghost.group.position.clone();
        nextZ.z += dirZ * ghost.speed * dt;
        if (!this.checkCollisions(nextZ)) {
          ghost.group.position.z = nextZ.z;
        }

        // Float bobbing effect
        ghost.group.position.y = Math.sin(performance.now() * 0.005) * 0.15;

        // Claws grabbing animation for Weeping Stalker
        if (ghost.arms) {
          ghost.arms[0].rotation.x = -0.3 + Math.sin(performance.now() * 0.01) * 0.4;
          ghost.arms[1].rotation.x = -0.3 + Math.cos(performance.now() * 0.01) * 0.4;
        }

        // Jumpscare proximity trigger (if ghost reaches player)
        if (distToPlayer < 1.35) {
          if (this.jumpscareCooldown <= 0) {
            this.triggerJumpscare(`${ghost.name.toUpperCase()} CAUGHT YOU!`);
            this.takeDamage(`${ghost.name} devoured your soul in the dark!`);
            // Reposition creature backwards
            ghost.group.position.x -= dirX * 4.0;
            ghost.group.position.z -= dirZ * 4.0;
          }
        }
      } else {
        ghost.state = 'patrol';
        // Slow float patrol
        ghost.group.position.y = Math.sin(performance.now() * 0.003) * 0.1;
      }
    });
  }

  // Render loop
  render() {
    this.renderer.render(this.scene, this.camera);
  }
}

// ----------------------------------------------------------
// Game Bootstrap & Animation Loop
// ----------------------------------------------------------
window.addEventListener('DOMContentLoaded', () => {
  const game = new ImpossibleMazeGame();
  let lastTime = performance.now();

  function loop(currentTime) {
    const dt = Math.min((currentTime - lastTime) / 1000, 0.1);
    lastTime = currentTime;

    game.update(dt);
    game.render();

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
});


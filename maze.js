// ============================================================
// IMPOSSIBLE MAZE - PROCEDURAL GENERATION & REALITY-SHIFT ENGINE
// Tile Map Legends:
// 0 = Empty Passage
// 1 = Solid Wall
// 2 = Shiftable Wall (changes when player turns around)
// 3 = Spike Trap
// 4 = Teleport Door (warp to random cell or start)
// 5 = Locked Exit Door (Requires Key)
// 6 = Golden Key
// 7 = Fake Exit (Trap portal)
// 8 = Secret Passage (Hollow illusion wall)
// ============================================================

class MazeBuilder {
  constructor() {
    this.levels = [
      {
        levelNum: 1,
        title: "The Shifting Cellar",
        width: 17,
        height: 17,
        timeLimit: 150, // 2:30 min
        spikeCount: 6,
        teleportCount: 2,
        shiftWallChance: 0.15,
        wallColor: 0x222638,
        floorColor: 0x11131c,
        fogColor: 0x05060b,
        fogDensity: 0.11
      },
      {
        levelNum: 2,
        title: "The Hall of Hallucinations",
        width: 23,
        height: 23,
        timeLimit: 190, // 3:10 min
        spikeCount: 12,
        teleportCount: 4,
        shiftWallChance: 0.28,
        wallColor: 0x361d2d,
        floorColor: 0x190c15,
        fogColor: 0x090408,
        fogDensity: 0.13
      },
      {
        levelNum: 3,
        title: "The Impossible Abyss",
        width: 29,
        height: 29,
        timeLimit: 240, // 4:00 min
        spikeCount: 18,
        teleportCount: 6,
        shiftWallChance: 0.38,
        wallColor: 0x18302b,
        floorColor: 0x0a1714,
        fogColor: 0x030807,
        fogDensity: 0.14
      }
    ];
  }

  // Generate perfect maze using Recursive Backtracker, then customize with traps & features
  generate(levelIndex) {
    const config = this.levels[Math.min(levelIndex, this.levels.length - 1)];
    const W = config.width;
    const H = config.height;

    // Initialize all to walls (1)
    const grid = Array.from({ length: H }, () => Array(W).fill(1));

    // Carve maze paths
    function carve(x, y) {
      grid[y][x] = 0;
      const dirs = [
        [0, -2], // North
        [2, 0],  // East
        [0, 2],  // South
        [-2, 0]  // West
      ].sort(() => Math.random() - 0.5);

      for (const [dx, dy] of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx > 0 && nx < W - 1 && ny > 0 && ny < H - 1 && grid[ny][nx] === 1) {
          grid[y + dy / 2][x + dx / 2] = 0; // Carve connecting wall
          carve(nx, ny);
        }
      }
    }

    // Start carving at (1, 1)
    carve(1, 1);

    // Collect all open corridor cells
    const corridors = [];
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        if (grid[y][x] === 0) {
          // Keep (1,1) and neighbors safe for spawn
          if (!(x <= 2 && y <= 2)) {
            corridors.push({ x, y });
          }
        }
      }
    }

    // Shuffle corridors for random placement of elements
    corridors.sort(() => Math.random() - 0.5);

    // 1. Place Exit Door (5) far from spawn
    let exitPos = corridors.pop();
    grid[exitPos.y][exitPos.x] = 5;

    // 2. Place Golden Key (6)
    let keyPos = corridors.pop();
    grid[keyPos.y][keyPos.x] = 6;

    // 3. Place Fake Exit (7)
    let fakeExitPos = corridors.pop();
    grid[fakeExitPos.y][fakeExitPos.x] = 7;

    // 4. Place Teleport Doors (4)
    for (let i = 0; i < config.teleportCount && corridors.length > 0; i++) {
      const tp = corridors.pop();
      grid[tp.y][tp.x] = 4;
    }

    // 5. Place Spikes (3)
    for (let i = 0; i < config.spikeCount && corridors.length > 0; i++) {
      const spk = corridors.pop();
      grid[spk.y][spk.x] = 3;
    }

    // 6. Convert some interior walls to Shiftable Walls (2)
    const shiftableWalls = [];
    for (let y = 2; y < H - 2; y++) {
      for (let x = 2; x < W - 2; x++) {
        if (grid[y][x] === 1 && Math.random() < config.shiftWallChance) {
          // Count neighbor walls to prevent open field voids
          let neighborWalls = 0;
          if (grid[y - 1][x] === 1) neighborWalls++;
          if (grid[y + 1][x] === 1) neighborWalls++;
          if (grid[y][x - 1] === 1) neighborWalls++;
          if (grid[y][x + 1] === 1) neighborWalls++;

          if (neighborWalls <= 3) {
            grid[y][x] = 2;
            shiftableWalls.push({ x, y, state: 'solid' });
          }
        }
      }
    }

    // 7. Secret Passage (8): Hollow wall near exit or key
    for (let y = 2; y < H - 2; y++) {
      for (let x = 2; x < W - 2; x++) {
        if (grid[y][x] === 1 && Math.random() < 0.05) {
          grid[y][x] = 8;
          break;
        }
      }
    }

    return {
      config,
      width: W,
      height: H,
      grid,
      spawn: { x: 1, y: 1 },
      exitPos,
      keyPos,
      fakeExitPos,
      shiftableWalls
    };
  }
}

window.mazeBuilder = new MazeBuilder();


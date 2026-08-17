/* World 1-1 style level layout (original arrangement). */

export const TILE = 16;
export const VIEW_W = 480;
export const VIEW_H = 270;
export const LEVEL_W = 216;
export const LEVEL_H = 15;
export const GROUND_ROW = 13;
export const PX_W = LEVEL_W * TILE;

export const T = {
  EMPTY: 0,
  GROUND: 1,
  BRICK: 2,
  Q: 3,
  QUSED: 4,
  STONE: 5,
} as const;

export interface CoinSpawn {
  x: number;
  y: number; // px
}
export interface EnemySpawn {
  kind: "walker" | "spiny";
  x: number;
  dir: -1 | 1;
}
export interface PipeSpawn {
  x: number; // tile
  h: number; // tiles tall
}
export interface Deco {
  x: number; // tile
  v: number;
}
export interface CloudDeco extends Deco {
  y: number;
}

export interface LevelData {
  w: number;
  h: number;
  pxW: number;
  grid: Uint8Array;
  qContents: Map<number, "coin" | "mushroom">;
  coins: CoinSpawn[];
  enemies: EnemySpawn[];
  pipes: PipeSpawn[];
  hills: Deco[];
  bushes: Deco[];
  clouds: CloudDeco[];
  startX: number;
  startY: number;
  flagX: number;
  castleX: number;
}

export function buildLevel(): LevelData {
  const grid = new Uint8Array(LEVEL_W * LEVEL_H);
  const set = (x: number, y: number, v: number) => {
    grid[y * LEVEL_W + x] = v;
  };

  // ----- ground with pits -----
  const pits: [number, number][] = [
    [71, 72],
    [96, 97],
    [125, 126],
    [153, 155],
    [179, 181],
  ];
  const inPit = (x: number) => pits.some(([a, b]) => x >= a && x <= b);
  for (let x = 0; x < LEVEL_W; x++) {
    if (inPit(x)) continue;
    set(x, GROUND_ROW, T.GROUND);
    set(x, GROUND_ROW + 1, T.GROUND);
  }

  // ----- blocks -----
  const qContents = new Map<number, "coin" | "mushroom">();
  const blocks: { x: number; y: number; t: number; content?: "coin" | "mushroom" }[] = [
    { x: 6, y: 9, t: T.Q, content: "coin" },
    { x: 10, y: 9, t: T.Q, content: "mushroom" },
    { x: 16, y: 9, t: T.BRICK },
    { x: 20, y: 9, t: T.BRICK },
    { x: 21, y: 9, t: T.Q, content: "coin" },
    { x: 22, y: 9, t: T.BRICK },
    { x: 23, y: 9, t: T.Q, content: "coin" },
    { x: 24, y: 9, t: T.BRICK },
    { x: 25, y: 5, t: T.BRICK },
    { x: 26, y: 5, t: T.BRICK },
    { x: 27, y: 5, t: T.Q, content: "coin" },
    { x: 33, y: 9, t: T.BRICK },
    { x: 34, y: 9, t: T.Q, content: "coin" },
    { x: 35, y: 9, t: T.BRICK },
    { x: 42, y: 9, t: T.Q, content: "mushroom" },
    { x: 51, y: 9, t: T.BRICK },
    { x: 52, y: 9, t: T.Q, content: "coin" },
    { x: 53, y: 9, t: T.BRICK },
    { x: 80, y: 9, t: T.BRICK },
    { x: 81, y: 9, t: T.Q, content: "coin" },
    { x: 82, y: 9, t: T.BRICK },
    { x: 83, y: 9, t: T.Q, content: "coin" },
    { x: 84, y: 9, t: T.BRICK },
    { x: 106, y: 9, t: T.BRICK },
    { x: 107, y: 9, t: T.Q, content: "coin" },
    { x: 108, y: 9, t: T.BRICK },
    { x: 109, y: 9, t: T.Q, content: "coin" },
    { x: 110, y: 9, t: T.BRICK },
    { x: 131, y: 9, t: T.BRICK },
    { x: 132, y: 9, t: T.Q, content: "coin" },
    { x: 133, y: 9, t: T.BRICK },
    { x: 160, y: 9, t: T.Q, content: "mushroom" },
  ];
  for (const b of blocks) {
    set(b.x, b.y, b.t);
    if (b.t === T.Q && b.content) qContents.set(b.y * LEVEL_W + b.x, b.content);
  }

  // ----- final staircase -----
  for (let i = 0; i < 8; i++) {
    for (let r = 0; r <= i; r++) set(190 + i, 12 - r, T.STONE);
  }

  // ----- pipes -----
  const pipes: PipeSpawn[] = [
    { x: 28, h: 2 },
    { x: 38, h: 3 },
    { x: 46, h: 4 },
    { x: 57, h: 4 },
    { x: 63, h: 2 },
    { x: 66, h: 2 },
    { x: 130, h: 2 },
    { x: 140, h: 2 },
    { x: 163, h: 4 },
  ];

  // ----- coins -----
  const coinTiles: [number, number][] = [
    [60, 8],
    [61, 8],
    [62, 8],
    [73, 8],
    [74, 8],
    [96, 8],
    [97, 8],
    [100, 8],
    [101, 8],
    [102, 8],
    [115, 5],
    [116, 5],
    [117, 5],
    [143, 8],
    [144, 8],
    [145, 8],
    [163, 5],
    [164, 5],
    [168, 5],
    [169, 5],
    [170, 5],
    [183, 8],
    [184, 8],
    [185, 8],
  ];
  const coins: CoinSpawn[] = coinTiles.map(([x, y]) => ({ x: x * TILE + 1, y: y * TILE }));

  // ----- enemies -----
  const enemies: EnemySpawn[] = [
    { kind: "walker", x: 12 * TILE + 1, dir: -1 },
    { kind: "walker", x: 17 * TILE + 1, dir: -1 },
    { kind: "walker", x: 24 * TILE + 1, dir: -1 },
    { kind: "walker", x: 33 * TILE + 1, dir: -1 },
    { kind: "spiny", x: 44 * TILE + 1, dir: -1 },
    { kind: "walker", x: 52 * TILE + 1, dir: 1 },
    { kind: "walker", x: 69 * TILE + 1, dir: -1 },
    { kind: "walker", x: 84 * TILE + 1, dir: -1 },
    { kind: "spiny", x: 94 * TILE + 1, dir: -1 },
    { kind: "walker", x: 99 * TILE + 1, dir: 1 },
    { kind: "walker", x: 112 * TILE + 1, dir: -1 },
    { kind: "spiny", x: 118 * TILE + 1, dir: -1 },
    { kind: "walker", x: 121 * TILE + 1, dir: -1 },
    { kind: "walker", x: 150 * TILE + 1, dir: -1 },
    { kind: "walker", x: 157 * TILE + 1, dir: 1 },
    { kind: "spiny", x: 170 * TILE + 1, dir: -1 },
    { kind: "walker", x: 175 * TILE + 1, dir: -1 },
    { kind: "walker", x: 186 * TILE + 1, dir: -1 },
  ];

  // ----- decorations -----
  const hills: Deco[] = [
    { x: 8, v: 0 },
    { x: 26, v: 1 },
    { x: 48, v: 0 },
    { x: 68, v: 1 },
    { x: 92, v: 0 },
    { x: 116, v: 1 },
    { x: 138, v: 0 },
    { x: 160, v: 1 },
    { x: 184, v: 0 },
  ];
  const bushes: Deco[] = [
    { x: 31, v: 0 },
    { x: 54, v: 1 },
    { x: 88, v: 0 },
    { x: 110, v: 1 },
    { x: 136, v: 0 },
    { x: 158, v: 1 },
    { x: 178, v: 0 },
  ];
  const clouds: CloudDeco[] = [
    { x: 10, y: 2, v: 0 },
    { x: 24, y: 1, v: 1 },
    { x: 38, y: 3, v: 2 },
    { x: 55, y: 2, v: 0 },
    { x: 70, y: 1, v: 1 },
    { x: 86, y: 2, v: 2 },
    { x: 102, y: 1, v: 0 },
    { x: 118, y: 2, v: 1 },
    { x: 134, y: 1, v: 2 },
    { x: 150, y: 2, v: 0 },
    { x: 166, y: 1, v: 1 },
    { x: 182, y: 2, v: 2 },
    { x: 198, y: 1, v: 0 },
  ];

  return {
    w: LEVEL_W,
    h: LEVEL_H,
    pxW: PX_W,
    grid,
    qContents,
    coins,
    enemies,
    pipes,
    hills,
    bushes,
    clouds,
    startX: 2 * TILE,
    startY: GROUND_ROW * TILE - 16,
    flagX: 202 * TILE,
    castleX: 208 * TILE,
  };
}

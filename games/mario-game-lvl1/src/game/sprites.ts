/* All pixel art is procedurally generated (original artwork, no assets). */

type Rect = [number, number, number, number, string];

function mk(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const c = cv.getContext("2d")!;
  draw(c);
  return cv;
}

function rects(c: CanvasRenderingContext2D, list: Rect[]) {
  for (const [x, y, w, h, col] of list) {
    c.fillStyle = col;
    c.fillRect(x, y, w, h);
  }
}

/* ---------------- palette ---------------- */
export const PAL = {
  cap: "#e83828",
  capD: "#a01808",
  skin: "#f8b878",
  skinD: "#e09050",
  hair: "#7a3c10",
  shirt: "#e83828",
  shirtD: "#b01810",
  blue: "#3048e8",
  blueD: "#18288c",
  shoe: "#7a3c10",
  gold: "#ffd838",
  goldL: "#fff8a0",
  goldD: "#c89000",
  goom: "#c06820",
  goomD: "#9c4c10",
  goomFeet: "#803c08",
  cream: "#f8d0a0",
  red: "#e83030",
  redD: "#a01818",
  white: "#f8f8f8",
};

/* ---------------- hero ---------------- */
const HERO_BASE: Rect[] = [
  [0, 0, 14, 3, PAL.cap], // cap
  [7, 3, 7, 1, PAL.cap], // brim
  [1, 3, 3, 2, PAL.hair], // hair
  [2, 3, 11, 4, PAL.skin], // face
  [8, 4, 2, 2, "#4a2408"], // eye
  [10, 5, 2, 1, PAL.skinD], // nose
  [6, 6, 7, 1, PAL.hair], // mustache
  [1, 7, 12, 4, PAL.shirt], // torso
  [11, 8, 2, 2, PAL.skin], // front hand
  [2, 11, 10, 3, PAL.blue], // overalls
  [5, 11, 1, 1, PAL.gold], // button
  [8, 11, 1, 1, PAL.gold], // button
];

const HERO_LEGS: Record<string, Rect[]> = {
  stand: [
    [2, 14, 4, 2, PAL.shoe],
    [8, 14, 4, 2, PAL.shoe],
  ],
  w1: [
    [2, 13, 4, 2, PAL.shoe],
    [8, 14, 4, 2, PAL.shoe],
    [12, 7, 2, 2, PAL.skin],
  ],
  w2: [
    [2, 14, 4, 2, PAL.shoe],
    [8, 13, 4, 2, PAL.shoe],
    [12, 7, 2, 2, PAL.skin],
  ],
  jump: [
    [3, 12, 3, 2, PAL.shoe],
    [8, 12, 3, 2, PAL.shoe],
    [12, 4, 2, 3, PAL.skin],
  ],
};

function buildHeroFrame(legs: string, big: boolean): HTMLCanvasElement {
  if (!big) {
    return mk(14, 16, (c) => rects(c, [...HERO_BASE, ...HERO_LEGS[legs]]));
  }
  const s = 1.75;
  const scaled = [...HERO_BASE, ...HERO_LEGS[legs]].map(
    ([x, y, w, h, col]): Rect => [x, Math.round(y * s), w, Math.max(1, Math.round(h * s)), col]
  );
  return mk(14, 30, (c) => rects(c, scaled));
}

export interface HeroFrames {
  stand: HTMLCanvasElement;
  w1: HTMLCanvasElement;
  w2: HTMLCanvasElement;
  jump: HTMLCanvasElement;
}

/* ---------------- enemies ---------------- */
function buildGoomba() {
  const base: Rect[] = [
    [1, 2, 14, 9, PAL.goom], // dome
    [1, 2, 14, 1, "#e08c40"], // dome highlight
    [1, 9, 14, 2, PAL.goomD], // dome shade
    [3, 7, 10, 4, PAL.cream], // face
    [4, 8, 3, 4, PAL.white], // eye L
    [5, 9, 1, 2, "#181818"], // pupil
    [9, 8, 3, 4, PAL.white], // eye R
    [10, 9, 1, 2, "#181818"],
    [3, 6, 4, 1, "#7a3808"], // brow
    [9, 6, 4, 1, "#7a3808"],
  ];
  const a = mk(16, 16, (c) =>
    rects(c, [
      ...base,
      [2, 11, 5, 3, PAL.goomFeet],
      [9, 11, 5, 3, PAL.goomFeet],
    ])
  );
  const b = mk(16, 16, (c) =>
    rects(c, [
      ...base,
      [1, 12, 5, 2, PAL.goomFeet],
      [10, 12, 5, 2, PAL.goomFeet],
    ])
  );
  const squash = mk(16, 16, (c) =>
    rects(c, [
      [2, 10, 12, 6, PAL.goom],
      [2, 10, 12, 1, "#e08c40"],
      [5, 12, 2, 2, "#181818"],
      [9, 12, 2, 2, "#181818"],
      [1, 14, 6, 2, PAL.goomFeet],
      [9, 14, 6, 2, PAL.goomFeet],
    ])
  );
  return { a, b, squash };
}

function buildSpiny() {
  const base: Rect[] = [
    [4, 0, 2, 2, PAL.white], // spikes
    [10, 0, 2, 2, PAL.white],
    [2, 2, 2, 2, PAL.white],
    [8, 2, 2, 2, PAL.white],
    [13, 2, 2, 2, PAL.white],
    [1, 4, 14, 8, PAL.red], // body
    [1, 4, 14, 1, "#ff6868"],
    [1, 10, 14, 2, PAL.redD],
    [3, 8, 10, 3, PAL.cream], // face
    [4, 8, 3, 3, PAL.white],
    [5, 9, 1, 1, "#181818"],
    [9, 8, 3, 3, PAL.white],
    [10, 9, 1, 1, "#181818"],
  ];
  const a = mk(16, 16, (c) =>
    rects(c, [
      ...base,
      [2, 12, 4, 2, "#801010"],
      [10, 12, 4, 2, "#801010"],
    ])
  );
  const b = mk(16, 16, (c) =>
    rects(c, [
      ...base,
      [1, 12, 4, 2, "#801010"],
      [11, 12, 4, 2, "#801010"],
    ])
  );
  return { a, b };
}

/* ---------------- power-up ---------------- */
function buildMushroom() {
  return mk(16, 16, (c) =>
    rects(c, [
      [0, 0, 16, 8, PAL.red],
      [0, 0, 16, 1, "#ff6868"],
      [3, 2, 4, 3, PAL.white],
      [10, 3, 3, 3, PAL.white],
      [6, 5, 2, 2, PAL.white],
      [0, 7, 16, 2, PAL.redD],
      [4, 8, 8, 8, PAL.cream],
      [4, 14, 8, 2, "#d8a870"],
      [5, 10, 2, 3, "#181818"],
      [9, 10, 2, 3, "#181818"],
    ])
  );
}

/* ---------------- tiles ---------------- */
function buildGround() {
  return mk(16, 16, (c) =>
    rects(c, [
      [0, 0, 16, 16, "#c05818"],
      [0, 0, 16, 1, "#f09048"],
      [0, 4, 16, 1, "#f09048"],
      [0, 8, 16, 1, "#f09048"],
      [0, 12, 16, 1, "#f09048"],
      [0, 3, 16, 1, "#7a2c08"],
      [0, 7, 16, 1, "#7a2c08"],
      [0, 11, 16, 1, "#7a2c08"],
      [0, 15, 16, 1, "#7a2c08"],
      [5, 0, 1, 4, "#7a2c08"],
      [11, 4, 1, 4, "#7a2c08"],
      [5, 8, 1, 4, "#7a2c08"],
      [11, 12, 1, 4, "#7a2c08"],
    ])
  );
}

function buildBrickBlock() {
  return mk(16, 16, (c) =>
    rects(c, [
      [0, 0, 16, 16, "#c85418"],
      [0, 0, 16, 2, "#f8a058"],
      [1, 0, 1, 16, "#f8a058"],
      [0, 7, 16, 2, "#5c2008"],
      [8, 0, 2, 7, "#5c2008"],
      [4, 9, 2, 7, "#5c2008"],
      [12, 9, 2, 7, "#5c2008"],
      [0, 14, 16, 2, "#8a3008"],
      [14, 0, 2, 16, "#8a3008"],
    ])
  );
}

function buildQBlock(alt: boolean) {
  const light = alt ? "#ffc838" : "#f8a800";
  const top = alt ? "#ffe184" : "#ffd858";
  return mk(16, 16, (c) =>
    rects(c, [
      [0, 0, 16, 16, light],
      [0, 0, 16, 2, top],
      [0, 0, 2, 16, top],
      [0, 14, 16, 2, "#a05c00"],
      [14, 0, 2, 16, "#a05c00"],
      [2, 2, 2, 2, "#8a4c00"],
      [12, 2, 2, 2, "#8a4c00"],
      [2, 12, 2, 2, "#8a4c00"],
      [12, 12, 2, 2, "#8a4c00"],
      // blocky "?" glyph
      [6, 5, 5, 1, "#8a4c00"],
      [5, 6, 1, 1, "#8a4c00"],
      [10, 6, 1, 1, "#8a4c00"],
      [6, 8, 5, 1, "#8a4c00"],
      [7, 9, 1, 2, "#8a4c00"],
      [8, 10, 1, 1, "#8a4c00"],
      [5, 4, 5, 1, PAL.white],
      [4, 5, 1, 1, PAL.white],
      [9, 5, 1, 1, PAL.white],
      [4, 6, 1, 1, PAL.white],
      [9, 6, 1, 1, PAL.white],
      [5, 7, 5, 1, PAL.white],
      [6, 8, 1, 2, PAL.white],
      [7, 9, 1, 1, PAL.white],
    ])
  );
}

function buildQUsed() {
  return mk(16, 16, (c) =>
    rects(c, [
      [0, 0, 16, 16, "#9c5c2c"],
      [0, 0, 16, 2, "#b87840"],
      [0, 0, 2, 16, "#b87840"],
      [0, 14, 16, 2, "#5c3408"],
      [14, 0, 2, 16, "#5c3408"],
      [2, 2, 2, 2, "#5c3408"],
      [12, 2, 2, 2, "#5c3408"],
      [2, 12, 2, 2, "#5c3408"],
      [12, 12, 2, 2, "#5c3408"],
    ])
  );
}

function buildStone() {
  return mk(16, 16, (c) =>
    rects(c, [
      [0, 0, 16, 16, "#e8b060"],
      [0, 0, 16, 2, "#f8d898"],
      [0, 0, 2, 16, "#f8d898"],
      [0, 14, 16, 2, "#a87030"],
      [14, 0, 2, 16, "#a87030"],
      [0, 7, 16, 1, "#c89040"],
      [8, 0, 1, 7, "#c89040"],
      [4, 8, 1, 8, "#c89040"],
    ])
  );
}

function buildPipeTop() {
  return mk(16, 16, (c) =>
    rects(c, [
      [0, 0, 16, 16, "#009e00"],
      [0, 0, 16, 2, "#58d048"],
      [4, 2, 4, 14, "#58d048"],
      [0, 14, 16, 2, "#005800"],
      [14, 0, 2, 16, "#005800"],
      [0, 0, 2, 16, "#005800"],
    ])
  );
}

function buildPipeBody() {
  return mk(16, 16, (c) =>
    rects(c, [
      [0, 0, 16, 16, "#009e00"],
      [4, 0, 4, 16, "#58d048"],
      [0, 0, 2, 16, "#005800"],
      [14, 0, 2, 16, "#005800"],
    ])
  );
}

/* ---------------- coin ---------------- */
function buildCoinFrames() {
  const frames: HTMLCanvasElement[] = [];
  const widths = [1, 0.55, 1, 0.25];
  for (const w of widths) {
    frames.push(
      mk(16, 16, (c) => {
        for (let y = 1; y < 15; y++) {
          const dy = (y - 7.5) / 6.5;
          const half = Math.max(0.5, w * Math.sqrt(Math.max(0, 1 - dy * dy)) * 7.5);
          const x0 = Math.floor(8 - half);
          const x1 = Math.ceil(8 + half);
          c.fillStyle = PAL.goldD;
          c.fillRect(x0, y, x1 - x0, 1);
          c.fillStyle = PAL.gold;
          c.fillRect(x0 + 1, y, x1 - x0 - 2, 1);
        }
        c.fillStyle = PAL.goldL;
        c.fillRect(5, 3, 3, 2);
      })
    );
  }
  return frames;
}

/* ---------------- flag + castle ---------------- */
function buildFlagPole() {
  return mk(32, 144, (c) => {
    // pole
    rects(c, [
      [14, 6, 4, 136, "#a8a8a8"],
      [14, 6, 1, 136, "#d8d8d8"],
      [17, 6, 1, 136, "#707070"],
      [10, 138, 12, 6, "#707070"],
      [10, 138, 12, 2, "#a8a8a8"],
      [13, 2, 6, 6, PAL.gold],
      [14, 3, 2, 2, PAL.goldL],
    ]);
    // flag cloth (triangle, green with star)
    for (let i = 0; i < 13; i++) {
      const w = Math.max(3, 13 - i);
      c.fillStyle = i < 10 ? "#00a800" : "#007800";
      c.fillRect(18, 8 + i, w, 1);
    }
    rects(c, [
      [22, 12, 3, 3, PAL.white],
      [23, 11, 1, 5, PAL.white],
      [21, 13, 5, 1, PAL.white],
    ]);
  });
}

function buildCastle() {
  return mk(80, 80, (c) => {
    // sky backdrop transparent; castle body
    rects(c, [
      [0, 8, 80, 72, "#c8c8c8"],
      [0, 8, 80, 2, "#e8e8e8"],
    ]);
    // crenellations
    for (const x of [0, 16, 32, 48, 64]) {
      c.fillStyle = "#c8c8c8";
      c.fillRect(x, 0, 12, 9);
      c.fillStyle = "#e8e8e8";
      c.fillRect(x, 0, 12, 2);
      c.fillStyle = "#888888";
      c.fillRect(x + 11, 0, 1, 9);
    }
    // mortar lines
    c.fillStyle = "#888888";
    for (let y = 16; y < 80; y += 8) c.fillRect(0, y, 80, 1);
    for (let row = 0; row < 9; row++) {
      const y = 8 + row * 8;
      const off = row % 2 === 0 ? 24 : 40;
      for (let x = off; x < 80; x += 16) c.fillRect(x, y + 1, 1, 6);
    }
    // door
    rects(c, [
      [26, 44, 28, 36, "#181818"],
      [32, 32, 16, 12, "#181818"],
      [26, 44, 28, 2, "#404040"],
      [36, 62, 8, 18, "#2c2418"],
      [36, 62, 8, 2, "#584c34"],
    ]);
    // windows
    rects(c, [
      [8, 32, 8, 8, "#181818"],
      [8, 32, 8, 2, "#404040"],
      [64, 32, 8, 8, "#181818"],
      [64, 32, 8, 2, "#404040"],
    ]);
  });
}

/* ---------------- background ---------------- */
function mound(
  w: number,
  h: number,
  color: string,
  shade: string,
  spots: [number, number, number, number][]
) {
  return mk(w, h, (c) => {
    const cx = w / 2;
    const R = w / 2;
    for (let x = 0; x < w; x++) {
      const dx = (x - cx) / R;
      const hh = Math.sqrt(Math.max(0, 1 - dx * dx)) * (h - 2);
      c.fillStyle = color;
      c.fillRect(x, h - hh, 1, hh);
      c.fillStyle = shade;
      c.fillRect(x, h - hh, 1, 2);
    }
    c.fillStyle = shade;
    for (const [x, y, ww, hh] of spots) c.fillRect(x, h - y, ww, hh);
  });
}

function buildCloud(w: number, h: number) {
  return mk(w, h, (c) => {
    const blobs: [number, number, number, number][] =
      w >= 60
        ? [
            [0, h * 0.45, 20, h * 0.55],
            [14, h * 0.15, 30, h * 0.85],
            [40, h * 0.4, 24, h * 0.6],
          ]
        : [
            [0, h * 0.45, 14, h * 0.55],
            [10, h * 0.2, 20, h * 0.8],
            [26, h * 0.45, 14, h * 0.55],
          ];
    for (const [x, y, ww, hh] of blobs) {
      c.fillStyle = "#f8f8f8";
      c.fillRect(x, y, ww, hh);
      c.fillStyle = "#cfe4f8";
      c.fillRect(x, y + hh - 3, ww, 3);
    }
  });
}

function buildHeart() {
  return mk(8, 8, (c) =>
    rects(c, [
      [1, 0, 2, 1, "#ff4050"],
      [4, 0, 2, 1, "#ff4050"],
      [0, 1, 7, 1, "#ff4050"],
      [1, 2, 5, 1, "#ff4050"],
      [2, 3, 3, 1, "#ff4050"],
      [3, 4, 1, 2, "#ff4050"],
      [1, 1, 1, 1, "#ffb0b8"],
    ])
  );
}

/* ---------------- assembled set ---------------- */
export interface SpriteSet {
  tiles: {
    ground: HTMLCanvasElement;
    brick: HTMLCanvasElement;
    q0: HTMLCanvasElement;
    q1: HTMLCanvasElement;
    qUsed: HTMLCanvasElement;
    stone: HTMLCanvasElement;
    pipeTop: HTMLCanvasElement;
    pipeBody: HTMLCanvasElement;
  };
  coin: HTMLCanvasElement[];
  heroSmall: HeroFrames;
  heroBig: HeroFrames;
  goomba: { a: HTMLCanvasElement; b: HTMLCanvasElement; squash: HTMLCanvasElement };
  spiny: { a: HTMLCanvasElement; b: HTMLCanvasElement };
  mushroom: HTMLCanvasElement;
  flagPole: HTMLCanvasElement;
  castle: HTMLCanvasElement;
  hills: HTMLCanvasElement[];
  bushes: HTMLCanvasElement[];
  clouds: HTMLCanvasElement[];
  heart: HTMLCanvasElement;
}

export function buildSprites(): SpriteSet {
  const heroSmall: HeroFrames = {
    stand: buildHeroFrame("stand", false),
    w1: buildHeroFrame("w1", false),
    w2: buildHeroFrame("w2", false),
    jump: buildHeroFrame("jump", false),
  };
  const heroBig: HeroFrames = {
    stand: buildHeroFrame("stand", true),
    w1: buildHeroFrame("w1", true),
    w2: buildHeroFrame("w2", true),
    jump: buildHeroFrame("jump", true),
  };
  return {
    tiles: {
      ground: buildGround(),
      brick: buildBrickBlock(),
      q0: buildQBlock(false),
      q1: buildQBlock(true),
      qUsed: buildQUsed(),
      stone: buildStone(),
      pipeTop: buildPipeTop(),
      pipeBody: buildPipeBody(),
    },
    coin: buildCoinFrames(),
    heroSmall,
    heroBig,
    goomba: buildGoomba(),
    spiny: buildSpiny(),
    mushroom: buildMushroom(),
    flagPole: buildFlagPole(),
    castle: buildCastle(),
    hills: [
      mound(96, 44, "#00a000", "#008800", [
        [28, 12, 4, 3],
        [58, 9, 4, 3],
        [44, 18, 3, 3],
      ]),
      mound(120, 52, "#00a000", "#008800", [
        [36, 14, 5, 3],
        [70, 10, 4, 3],
        [54, 20, 4, 3],
      ]),
    ],
    bushes: [
      mound(48, 20, "#00b408", "#008800", [
        [16, 8, 4, 2],
        [28, 6, 3, 2],
      ]),
      mound(56, 22, "#00b408", "#008800", [
        [18, 9, 4, 2],
        [34, 7, 3, 2],
      ]),
    ],
    clouds: [buildCloud(48, 24), buildCloud(64, 28), buildCloud(40, 20)],
    heart: buildHeart(),
  };
}

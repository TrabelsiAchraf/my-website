/* Core game engine — fixed-timestep loop, tile physics, juice (shake/particles/hitstop). */

import { AudioEngine } from "./audio";
import { Input } from "./input";
import {
  buildLevel,
  GROUND_ROW,
  LEVEL_H,
  T,
  TILE,
  VIEW_H,
  VIEW_W,
  type LevelData,
} from "./level";
import { buildSprites, PAL, type SpriteSet } from "./sprites";

export type GameState =
  | "menu"
  | "playing"
  | "paused"
  | "dying"
  | "flag"
  | "victory"
  | "gameover";

export interface StatePayload {
  score: number;
  coins: number;
  lives: number;
  timeLeft: number;
  baseScore: number;
  timeBonus: number;
}

export interface GameCallbacks {
  onState: (s: GameState, p: StatePayload | null) => void;
  onMute?: (muted: boolean) => void;
}

/* ---------------- physics constants (per frame @60fps) ---------------- */
const GRAV = 0.44;
const GRAV_REL = 0.75;
const GRAV_FALL = 0.5;
const JUMP_V = 7.6;
const MAX_FALL = 8.5;
const WALK = 1.55;
const RUN = 2.55;
const ACC = 0.13;
const ACC_AIR = 0.09;
const DEC = 0.16;
const DEC_AIR = 0.02;
const SKID = 0.3;
const STOMP_V = 4.8;
const STOMP_V_HELD = 6.4;
const TIME_START = 200;

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

interface Player {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  onGround: boolean;
  big: boolean;
  animT: number;
  invulnT: number;
  coyoteT: number;
  jumpBufT: number;
  prevBottom: number;
  squashX: number;
  squashY: number;
  dustT: number;
  hidden: boolean;
}

interface Enemy {
  kind: "walker" | "spiny";
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  dir: 1 | -1;
  spd: number;
  active: boolean;
  dead: boolean;
  deadT: number;
  animT: number;
  ground: boolean;
  remove: boolean;
}

interface Coin {
  x: number;
  y: number;
  taken: boolean;
  spinT: number;
}

interface PopCoin {
  x: number;
  y: number;
  vy: number;
  life: number;
}

interface Power {
  x: number;
  y: number;
  originY: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  emerging: boolean;
  emergeT: number;
  remove: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  life: number;
  max: number;
  size: number;
  color: string;
  grav: boolean;
}

interface Popup {
  x: number;
  y: number;
  vy: number;
  life: number;
  max: number;
  text: string;
  color: string;
  size: number;
}

const FIRE_COLORS = ["#ff5050", "#ffd838", "#78ff78", "#58b8ff", "#ff8ad0", "#ffffff"];

export class Game {
  state: GameState = "menu";
  readonly input = new Input();

  private ctx: CanvasRenderingContext2D;
  private dpr: number;
  private sprites: SpriteSet;
  private level: LevelData;
  private audio: AudioEngine;
  private cb: GameCallbacks;
  private isTouch: boolean;
  private raf = 0;
  private last = 0;
  private acc = 0;

  private score = 0;
  private coins = 0;
  private lives = 3;
  private time = TIME_START;
  private timeAcc = 0;
  private combo = 0;

  private player!: Player;
  private enemies: Enemy[] = [];
  private coinEnts: Coin[] = [];
  private popCoins: PopCoin[] = [];
  private powers: Power[] = [];
  private particles: Particle[] = [];
  private popups: Popup[] = [];
  private bumps = new Map<number, number>();

  private pipeRects: { x: number; y: number; w: number; h: number }[] = [];
  private camX = 0;
  private shakeT = 0;
  private shakeDur = 0.2;
  private shakeMag = 0;
  private freeze = 0;
  private deathT = 0;
  private menuT = 0;
  private flagSlide = false;
  private victoryT = 0;
  private fireworkT = 0;
  private timeBonus = 0;
  private baseScore = 0;
  private skyGrad: CanvasGradient;

  constructor(canvas: HTMLCanvasElement, cb: GameCallbacks, audio: AudioEngine, isTouch: boolean) {
    this.cb = cb;
    this.audio = audio;
    this.isTouch = isTouch;
    this.dpr = Math.min(3, Math.max(2, window.devicePixelRatio || 1));
    canvas.width = VIEW_W * this.dpr;
    canvas.height = VIEW_H * this.dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    this.ctx = ctx;
    this.sprites = buildSprites();
    this.level = buildLevel();
    this.skyGrad = this.ctx.createLinearGradient(0, 0, 0, VIEW_H);
    this.skyGrad.addColorStop(0, "#5c94fc");
    this.skyGrad.addColorStop(0.65, "#6fa8ff");
    this.skyGrad.addColorStop(1, "#a8dcff");
    this.input.attach();
    this.reset(true);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.input.detach();
  }

  /* ================= public API ================= */

  start() {
    this.audio.ensure();
    this.input.clearAll();
    this.reset(true);
    this.state = "playing";
    this.addPopup(this.player.x + 16, this.player.y - 26, "GO!", "#78ff78", 8);
    this.audio.startMusic();
    this.cb.onState("playing", null);
  }

  pause() {
    if (this.state !== "playing") return;
    this.state = "paused";
    this.audio.stopMusic();
    this.audio.pause();
    this.input.clearAll();
    this.cb.onState("paused", this.payload());
  }

  resume() {
    if (this.state !== "paused") return;
    this.state = "playing";
    this.input.clearAll();
    this.audio.ensure();
    this.audio.startMusic();
    this.cb.onState("playing", null);
  }

  quitToMenu() {
    this.audio.stopMusic();
    this.reset(true);
    this.state = "menu";
    this.input.clearAll();
    this.cb.onState("menu", null);
  }

  private payload(): StatePayload {
    return {
      score: this.score,
      coins: this.coins,
      lives: this.lives,
      timeLeft: Math.ceil(this.time),
      baseScore: this.baseScore,
      timeBonus: this.timeBonus,
    };
  }

  /* ================= setup ================= */

  private reset(full: boolean) {
    this.level = buildLevel();
    if (full) {
      this.score = 0;
      this.coins = 0;
      this.lives = 3;
    }
    this.time = TIME_START;
    this.timeAcc = 0;
    this.combo = 0;
    this.particles = [];
    this.popups = [];
    this.popCoins = [];
    this.powers = [];
    this.bumps.clear();
    this.camX = 0;
    this.shakeT = 0;
    this.freeze = 0;
    this.timeBonus = 0;
    this.baseScore = 0;
    this.victoryT = 0;
    this.flagSlide = false;
    this.player = {
      x: this.level.startX,
      y: this.level.startY,
      w: 14,
      h: 16,
      vx: 0,
      vy: 0,
      facing: 1,
      onGround: true,
      big: false,
      animT: 0,
      invulnT: 0,
      coyoteT: 0,
      jumpBufT: 0,
      prevBottom: this.level.startY + 16,
      squashX: 1,
      squashY: 1,
      dustT: 0,
      hidden: false,
    };
    this.enemies = this.level.enemies.map((s) => ({
      kind: s.kind,
      x: s.x,
      y: GROUND_ROW * TILE - 16,
      w: 16,
      h: 16,
      vx: s.dir * (s.kind === "walker" ? 0.45 : 0.4),
      vy: 0,
      dir: s.dir,
      spd: s.kind === "walker" ? 0.45 : 0.4,
      active: false,
      dead: false,
      deadT: 0,
      animT: Math.random() * 10,
      ground: true,
      remove: false,
    }));
    this.coinEnts = this.level.coins.map((c) => ({ x: c.x, y: c.y, taken: false, spinT: Math.random() * 10 }));
    this.pipeRects = this.level.pipes.map((p) => ({
      x: p.x * TILE,
      y: (LEVEL_H - 1 - p.h) * TILE,
      w: 32,
      h: p.h * TILE,
    }));
  }

  /* ================= main loop ================= */

  private frame = (t: number) => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    this.acc += dt;
    let guard = 0;
    while (this.acc >= 1 / 60 && guard++ < 4) {
      this.acc -= 1 / 60;
      this.step(1 / 60);
    }
    if (guard >= 4) this.acc = 0;
    this.render();
  };

  private step(dt: number) {
    this.input.beginFrame();
    switch (this.state) {
      case "playing":
        this.updatePlaying(dt);
        break;
      case "dying":
        this.updateDying(dt);
        break;
      case "flag":
        this.updateFlag(dt);
        break;
      case "victory":
        this.updateVictory(dt);
        break;
      case "gameover":
        this.updateParticles(dt);
        break;
      case "menu":
        this.updateMenu(dt);
        break;
      case "paused":
        break;
    }
    this.input.endFrame();
  }

  /* ================= state updates ================= */

  private updateMenu(dt: number) {
    this.menuT += dt;
    const span = Math.min(700, this.level.pxW - VIEW_W);
    this.camX = ((Math.sin(this.menuT * 0.18) + 1) / 2) * span;
    this.updateParticles(dt);
    this.updateShake(dt);
  }

  private updatePlaying(dt: number) {
    if (this.input.pausePressed) {
      this.pause();
      return;
    }
    if (this.input.mutePressed) this.cb.onMute?.(this.audio.toggleMuted());

    if (this.freeze > 0) {
      this.freeze -= dt;
      this.updateParticles(dt * 0.4);
      return;
    }

    this.time -= dt;
    this.timeAcc += dt;
    if (this.timeAcc >= 1) {
      this.timeAcc -= 1;
      if (this.time <= 60 && this.time > 0) this.audio.tick();
    }
    if (this.time <= 0) {
      this.time = 0;
      this.die();
      return;
    }

    this.updatePlayer(dt);
    this.updateEnemies(dt);
    this.updateCoins();
    this.updatePowers(dt);
    this.checkFlag();
    this.updatePopCoins(dt);
    this.updateBumps(dt);
    this.updateParticles(dt);
    this.updatePopups(dt);
    this.updateShake(dt);
    this.updateCamera(dt);
  }

  private updatePlayer(dt: number) {
    const p = this.player;
    const inp = this.input;
    p.invulnT = Math.max(0, p.invulnT - dt);
    p.coyoteT = Math.max(0, p.coyoteT - dt);
    p.jumpBufT = Math.max(0, p.jumpBufT - dt);
    p.animT += dt;
    p.squashX += (1 - p.squashX) * Math.min(1, dt * 14);
    p.squashY += (1 - p.squashY) * Math.min(1, dt * 14);

    const max = inp.run ? RUN : WALK;
    const acc = p.onGround ? ACC : ACC_AIR;
    if (inp.left && !inp.right) {
      if (p.vx > 0.5 && p.onGround) {
        p.vx -= SKID;
        this.emitSkid(p);
      }
      p.vx -= acc;
      p.facing = -1;
    } else if (inp.right && !inp.left) {
      if (p.vx < -0.5 && p.onGround) {
        p.vx += SKID;
        this.emitSkid(p);
      }
      p.vx += acc;
      p.facing = 1;
    } else {
      const dec = p.onGround ? DEC : DEC_AIR;
      if (p.vx > 0) p.vx = Math.max(0, p.vx - dec);
      else p.vx = Math.min(0, p.vx + dec);
    }
    p.vx = clamp(p.vx, -max, max);

    if (inp.jumpPressed) p.jumpBufT = 0.12;
    if (p.jumpBufT > 0 && (p.onGround || p.coyoteT > 0)) {
      p.vy = -JUMP_V;
      p.onGround = false;
      p.coyoteT = 0;
      p.jumpBufT = 0;
      p.squashX = 0.7;
      p.squashY = 1.3;
      this.audio.jump();
      this.emitDust(p.x + p.w / 2, p.y + p.h, 5, 0);
    }

    let g = GRAV_FALL;
    if (p.vy < 0) g = inp.jumpHeld ? GRAV : GRAV_REL;
    p.vy = Math.min(MAX_FALL, p.vy + g);

    p.x += p.vx;
    this.collideX(p);
    const wasGround = p.onGround;
    const fallV = p.vy;
    p.onGround = false;
    p.prevBottom = p.y + p.h;
    p.y += p.vy;
    const hitCeil = this.collideY(p);
    for (const [tx, ty] of hitCeil) this.bumpTile(tx, ty);
    // land on pipe tops
    if (!p.onGround && p.vy >= 0) {
      for (const r of this.pipeRects) {
        if (
          p.x + p.w > r.x + 1 &&
          p.x < r.x + r.w - 1 &&
          p.y + p.h >= r.y &&
          p.prevBottom <= r.y + 1 + p.vy
        ) {
          p.y = r.y - p.h;
          p.vy = 0;
          p.onGround = true;
          break;
        }
      }
    }
    if (!wasGround && p.onGround) {
      p.squashX = 1.3;
      p.squashY = 0.65;
      if (fallV > 4) {
        this.emitDust(p.x + p.w / 2, p.y + p.h, Math.min(8, 3 + fallV), 0);
      }
      if (fallV > 8) this.shake(0.1, 2);
      this.combo = 0;
    }
    if (p.onGround) p.coyoteT = 0.09;

    p.dustT -= dt;
    if (p.onGround && Math.abs(p.vx) > 2.1 && p.dustT <= 0) {
      p.dustT = 0.11;
      this.emitDust(p.x + p.w / 2 - p.facing * 5, p.y + p.h - 1, 1, p.facing);
    }
  }

  private updateEnemies(dt: number) {
    const p = this.player;
    for (const e of this.enemies) {
      if (e.dead) {
        e.deadT -= dt;
        if (e.deadT <= 0) e.remove = true;
        continue;
      }
      if (!e.active) {
        if (e.x < this.camX + VIEW_W + 96) e.active = true;
        else continue;
      }
      e.animT += dt;
      e.vy = Math.min(MAX_FALL, e.vy + GRAV_FALL);
      e.x += e.vx;
      this.collideX(e);
      if (e.vx === 0) {
        e.dir = e.dir === 1 ? -1 : 1;
        e.vx = e.dir * e.spd;
      }
      e.ground = false;
      const prevBottom = e.y + e.h;
      e.y += e.vy;
      if (this.collideY(e).length === 0 && e.vy >= 0) {
        // check pipe landing
        for (const r of this.pipeRects) {
          if (
            e.x + e.w > r.x + 2 &&
            e.x < r.x + r.w - 2 &&
            e.y + e.h >= r.y &&
            prevBottom <= r.y + e.vy + 1
          ) {
            e.y = r.y - e.h;
            e.vy = 0;
            e.ground = true;
            break;
          }
        }
        if (!e.ground) {
          const ty = Math.floor((e.y + e.h) / TILE);
          const left = Math.floor((e.x + 0.01) / TILE);
          const right = Math.floor((e.x + e.w - 0.01) / TILE);
          for (let tx = left; tx <= right; tx++) {
            if (this.solid(tx, ty)) {
              e.y = ty * TILE - e.h;
              e.vy = 0;
              e.ground = true;
              break;
            }
          }
        }
      } else if (e.vy >= 0) {
        e.ground = true;
      }
      // edge turn
      if (e.ground) {
        const fx = Math.floor((e.x + (e.dir > 0 ? e.w + 2 : -2)) / TILE);
        const fy = Math.floor((e.y + e.h + 2) / TILE);
        if (!this.solid(fx, fy)) {
          e.dir = e.dir === 1 ? -1 : 1;
        }
      }
      e.vx = e.dir * e.spd;

      // player interaction
      if (this.state === "playing" && !p.hidden && p.invulnT <= 0 && this.overlap(e, p)) {
        if (p.vy > 0.5 && p.prevBottom <= e.y + 9 && e.kind === "walker") {
          this.stomp(e);
        } else {
          this.hitPlayer();
        }
      }
    }
    this.enemies = this.enemies.filter((e) => !e.remove);
  }

  private updateCoins() {
    const p = this.player;
    for (const c of this.coinEnts) {
      if (c.taken) continue;
      c.spinT += 1 / 60;
      if (!p.hidden && p.x + p.w > c.x && p.x < c.x + 14 && p.y + p.h > c.y && p.y < c.y + 14) {
        c.taken = true;
        this.score += 100;
        this.coins++;
        this.audio.coin();
        this.emitCoinSparkle(c.x + 7, c.y + 7);
        this.addPopup(c.x + 7, c.y - 4, "+100", "#fff8a0", 8);
        if (this.coins % 100 === 0) this.grantLife(c.x + 7, c.y - 16);
      }
    }
  }

  private grantLife(x: number, y: number) {
    this.lives++;
    this.audio.oneUp();
    this.addPopup(x, y, "1-UP!", "#78ff78", 8);
  }

  private updatePowers(dt: number) {
    const p = this.player;
    for (const m of this.powers) {
      if (m.emerging) {
        m.emergeT += dt;
        m.y = m.originY - 16 * Math.min(1, m.emergeT / 0.8);
        if (m.emergeT >= 0.8) {
          m.emerging = false;
          m.vx = 1.1;
        }
        continue;
      }
      m.vy = Math.min(MAX_FALL, m.vy + GRAV_FALL);
      m.x += m.vx;
      const prevX = m.x - m.vx;
      const top = Math.floor(m.y / TILE);
      const bot = Math.floor((m.y + m.h - 0.01) / TILE);
      if (m.vx > 0) {
        const tx = Math.floor((m.x + m.w) / TILE);
        for (let ty = top; ty <= bot; ty++) {
          if (this.solid(tx, ty) && prevX + m.w <= tx * TILE + 1) {
            m.x = tx * TILE - m.w - 0.01;
            m.vx *= -1;
            break;
          }
        }
      } else if (m.vx < 0) {
        const tx = Math.floor(m.x / TILE);
        for (let ty = top; ty <= bot; ty++) {
          if (this.solid(tx, ty) && prevX >= (tx + 1) * TILE - 1) {
            m.x = (tx + 1) * TILE + 0.01;
            m.vx *= -1;
            break;
          }
        }
      }
      for (const r of this.pipeRects) {
        if (m.x + m.w > r.x && m.x < r.x + r.w && m.y + m.h > r.y + 2 && m.y < r.y + r.h) {
          if (m.vx > 0) {
            m.x = r.x - m.w - 0.01;
            m.vx *= -1;
          } else if (m.vx < 0) {
            m.x = r.x + r.w + 0.01;
            m.vx *= -1;
          }
        }
      }
      const prevBottom = m.y + m.h;
      m.y += m.vy;
      const ty = Math.floor((m.y + m.h) / TILE);
      const left = Math.floor((m.x + 0.01) / TILE);
      const right = Math.floor((m.x + m.w - 0.01) / TILE);
      let landed = false;
      for (let tx = left; tx <= right; tx++) {
        if (this.solid(tx, ty) && prevBottom <= ty * TILE + 2) {
          m.y = ty * TILE - m.h;
          m.vy = 0;
          landed = true;
          break;
        }
      }
      if (!landed) {
        for (const r of this.pipeRects) {
          if (m.x + m.w > r.x + 2 && m.x < r.x + r.w - 2 && m.y + m.h >= r.y && prevBottom <= r.y + 2) {
            m.y = r.y - m.h;
            m.vy = 0;
            break;
          }
        }
      }
      if (!p.hidden && p.x + p.w > m.x && p.x < m.x + m.w && p.y + p.h > m.y && p.y < m.y + m.h) {
        m.remove = true;
        this.score += 1000;
        this.audio.powerup();
        this.emitCoinSparkle(m.x + 8, m.y + 8);
        this.addPopup(m.x + 8, m.y - 6, "+1000", "#fff8a0", 8);
        this.shake(0.1, 1.5);
        this.freeze = 0.04;
        if (!p.big) {
          p.big = true;
          p.h = 28;
          p.y -= 12;
          p.invulnT = 1;
        }
      }
      if (m.y > LEVEL_H * TILE + 60) m.remove = true;
    }
    this.powers = this.powers.filter((m) => !m.remove);
  }

  private updatePopCoins(dt: number) {
    for (const c of this.popCoins) {
      c.y += c.vy;
      c.vy += 0.22;
      c.life -= dt;
    }
    this.popCoins = this.popCoins.filter((c) => c.life > 0);
  }

  private updateBumps(dt: number) {
    for (const [k, t] of this.bumps) {
      const nt = t - dt;
      if (nt <= 0) this.bumps.delete(k);
      else this.bumps.set(k, nt);
    }
  }

  private updateParticles(dt: number) {
    for (const pt of this.particles) {
      pt.life -= dt;
      if (pt.grav) pt.vy += pt.g;
      pt.x += pt.vx;
      pt.y += pt.vy;
    }
    this.particles = this.particles.filter((pt) => pt.life > 0);
  }

  private updatePopups(dt: number) {
    for (const pp of this.popups) {
      pp.life -= dt;
      pp.y += pp.vy;
    }
    this.popups = this.popups.filter((pp) => pp.life > 0);
  }

  private updateShake(dt: number) {
    this.shakeT = Math.max(0, this.shakeT - dt);
  }

  private updateCamera(dt: number) {
    const p = this.player;
    const target = p.x - VIEW_W * 0.42 + p.facing * 20;
    this.camX += (target - this.camX) * (1 - Math.pow(0.0001, dt));
    this.camX = clamp(this.camX, 0, this.level.pxW - VIEW_W);
  }

  private updateDying(dt: number) {
    this.deathT += dt;
    const p = this.player;
    p.vy = Math.min(MAX_FALL, p.vy + GRAV_FALL);
    p.y += p.vy;
    this.updateParticles(dt);
    this.updatePopups(dt);
    this.updateShake(dt);
    if (p.y > VIEW_H + 64) {
      this.lives--;
      if (this.lives <= 0) {
        this.state = "gameover";
        this.baseScore = this.score;
        this.cb.onState("gameover", this.payload());
      } else {
        this.reset(false);
        this.state = "playing";
        this.audio.startMusic();
        this.cb.onState("playing", null);
      }
    }
  }

  private updateFlag(dt: number) {
    const p = this.player;
    this.updateParticles(dt);
    this.updatePopups(dt);
    this.updateShake(dt);
    if (this.flagSlide) {
      p.y += 2.4;
      if (p.y + p.h >= GROUND_ROW * TILE) {
        p.y = GROUND_ROW * TILE - p.h;
        this.flagSlide = false;
        p.facing = 1;
        this.emitDust(p.x + p.w / 2, p.y + p.h, 6, 0);
        this.audio.bump();
      }
    } else {
      p.animT += dt;
      p.onGround = true;
      p.x += 1.3;
      p.dustT -= dt;
      if (p.dustT <= 0) {
        p.dustT = 0.1;
        this.emitDust(p.x, p.y + p.h, 1, 1);
      }
      if (p.x >= this.level.castleX + 16) {
        p.hidden = true;
        this.state = "victory";
        this.victoryT = 0;
        this.fireworkT = 0.3;
        this.timeBonus = Math.ceil(this.time) * 50;
        this.baseScore = this.score;
        this.score += this.timeBonus;
        this.audio.victory();
        this.cb.onState("victory", this.payload());
      }
    }
    this.updateCamera(dt);
  }

  private updateVictory(dt: number) {
    this.victoryT += dt;
    this.fireworkT -= dt;
    if (this.fireworkT <= 0 && this.victoryT < 6) {
      this.fireworkT = 0.45;
      const cx = this.level.castleX + 24 + Math.random() * 40;
      const cy = 96 + Math.random() * 60;
      this.emitFirework(cx, cy);
    }
    this.updateParticles(dt);
    this.updatePopups(dt);
    this.updateShake(dt);
  }

  /* ================= events ================= */

  private stomp(e: Enemy) {
    e.dead = true;
    e.deadT = 0.4;
    this.audio.stomp();
    this.combo++;
    const pts = 100 * Math.min(1 << (this.combo - 1), 16);
    this.score += pts;
    this.addPopup(e.x + 8, e.y - 4, `+${pts}`, "#ffd838", 8);
    if (this.combo > 1) this.addPopup(e.x + 8, e.y - 18, `COMBO ×${this.combo}`, "#ff8a40", 8);
    this.emitPoof(e.x + 8, e.y + 6, e.kind === "spiny" ? PAL.red : PAL.goom);
    this.freeze = 0.05;
    this.shake(0.13, 2.5);
    const p = this.player;
    p.vy = -(this.input.jumpHeld ? STOMP_V_HELD : STOMP_V);
    p.y = e.y - p.h - 1;
    p.onGround = false;
  }

  private hitPlayer() {
    const p = this.player;
    if (p.big) {
      p.big = false;
      p.h = 16;
      p.y += 12;
      p.invulnT = 2;
      this.audio.growShrink();
      this.emitPoof(p.x + 7, p.y, PAL.skin);
      this.shake(0.16, 2.5);
    } else {
      this.die();
    }
  }

  private die() {
    this.state = "dying";
    this.deathT = 0;
    this.audio.death();
    this.audio.stopMusic();
    const p = this.player;
    p.vy = -7.2;
    p.vx = 0;
    this.shake(0.3, 4);
    this.emitPoof(p.x + p.w / 2, p.y + p.h / 2, PAL.skin);
  }

  private checkFlag() {
    const p = this.player;
    if (p.x + p.w / 2 >= this.level.flagX + 8) {
      this.state = "flag";
      this.audio.stopMusic();
      this.audio.flag();
      p.x = this.level.flagX + 3;
      p.vx = 0;
      p.vy = 0;
      p.facing = -1;
      p.onGround = false;
      let bonus = 500;
      if (p.y <= 96) bonus = 5000;
      else if (p.y <= 150) bonus = 2000;
      this.score += bonus;
      this.addPopup(p.x + 8, p.y - 8, `+${bonus}`, "#ffd838", 8);
      this.flagSlide = true;
      this.freeze = 0.05;
    }
  }

  /* ================= block interactions ================= */

  private bumpTile(tx: number, ty: number) {
    const idx = ty * this.level.w + tx;
    const t = this.level.grid[idx];
    if (!t) return;
    this.bumps.set(idx, 0.22);
    this.audio.bump();
    this.shake(0.08, 1.5);
    if (t === T.BRICK && this.player.big) {
      this.level.grid[idx] = T.EMPTY;
      this.audio.brick();
      this.shake(0.16, 3);
      this.freeze = 0.05;
      this.score += 50;
      this.addPopup(tx * TILE + 8, ty * TILE - 6, "+50", "#ffb070", 8);
      for (let i = 0; i < 10; i++) {
        this.spawnParticle(
          tx * TILE + 8,
          ty * TILE + 8,
          (Math.random() - 0.5) * 3.4,
          -Math.random() * 4 - 1,
          0.18,
          0.7,
          3,
          i % 2 ? "#c85418" : "#8a3008",
          true
        );
      }
    } else if (t === T.Q) {
      const content = this.level.qContents.get(idx);
      this.level.grid[idx] = T.QUSED;
      if (content === "coin") {
        this.audio.coin();
        this.score += 200;
        this.coins++;
        this.popCoins.push({ x: tx * TILE + 1, y: ty * TILE - 16, vy: -3.4, life: 0.45 });
        this.addPopup(tx * TILE + 8, ty * TILE - 10, "+200", "#fff8a0", 8);
        if (this.coins % 100 === 0) this.grantLife(tx * TILE + 8, ty * TILE - 24);
      } else if (content === "mushroom") {
        this.audio.powerupAppear();
        this.powers.push({
          x: tx * TILE + 1,
          y: ty * TILE - 16,
          originY: ty * TILE - 16,
          w: 15,
          h: 15,
          vx: 0,
          vy: 0,
          emerging: true,
          emergeT: 0,
          remove: false,
        });
      }
    }
  }

  /* ================= collisions ================= */

  private solid(tx: number, ty: number): boolean {
    if (tx < 0 || tx >= this.level.w || ty < 0 || ty >= this.level.h) return false;
    return this.level.grid[ty * this.level.w + tx] !== T.EMPTY;
  }

  private overlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  private collideX(e: { x: number; y: number; w: number; h: number; vx: number }) {
    const top = Math.floor(e.y / TILE);
    const bot = Math.floor((e.y + e.h - 0.01) / TILE);
    if (e.vx > 0) {
      const tx = Math.floor((e.x + e.w) / TILE);
      for (let ty = top; ty <= bot; ty++) {
        if (this.solid(tx, ty)) {
          e.x = tx * TILE - e.w - 0.01;
          e.vx = 0;
          return;
        }
      }
    } else if (e.vx < 0) {
      const tx = Math.floor(e.x / TILE);
      for (let ty = top; ty <= bot; ty++) {
        if (this.solid(tx, ty)) {
          e.x = (tx + 1) * TILE + 0.01;
          e.vx = 0;
          return;
        }
      }
    }
    for (const r of this.pipeRects) {
      if (e.x + e.w > r.x && e.x < r.x + r.w && e.y + e.h > r.y + 2 && e.y < r.y + r.h) {
        if (e.vx > 0) {
          e.x = r.x - e.w - 0.01;
          e.vx = 0;
        } else if (e.vx < 0) {
          e.x = r.x + r.w + 0.01;
          e.vx = 0;
        }
        return;
      }
    }
  }

  /** Returns bumped tiles (head hits). Sets onGround when landing. */
  private collideY(e: { x: number; y: number; w: number; h: number; vx: number; vy: number }) {
    const bumps: [number, number][] = [];
    const left = Math.floor((e.x + 0.01) / TILE);
    const right = Math.floor((e.x + e.w - 0.01) / TILE);
    if (e.vy > 0) {
      const ty = Math.floor((e.y + e.h) / TILE);
      for (let tx = left; tx <= right; tx++) {
        if (this.solid(tx, ty)) {
          e.y = ty * TILE - e.h;
          e.vy = 0;
          (e as unknown as { onGround?: boolean }).onGround = true;
          return bumps;
        }
      }
    } else if (e.vy < 0) {
      const ty = Math.floor(e.y / TILE);
      for (let tx = left; tx <= right; tx++) {
        if (this.solid(tx, ty)) {
          e.y = (ty + 1) * TILE + 0.01;
          e.vy = 0;
          bumps.push([tx, ty]);
        }
      }
    }
    return bumps;
  }

  /* ================= juice helpers ================= */

  private spawnParticle(
    x: number,
    y: number,
    vx: number,
    vy: number,
    g: number,
    life: number,
    size: number,
    color: string,
    grav: boolean
  ) {
    if (this.particles.length > 320) return;
    this.particles.push({ x, y, vx, vy, g, life, max: life, size, color, grav });
  }

  private emitDust(x: number, y: number, n: number, dir: number) {
    for (let i = 0; i < n; i++) {
      this.spawnParticle(
        x + (Math.random() - 0.5) * 6,
        y - Math.random() * 3,
        dir !== 0 ? dir * (0.4 + Math.random() * 0.6) : (Math.random() - 0.5) * 1.6,
        -0.4 - Math.random() * 0.9,
        0.12,
        0.25 + Math.random() * 0.25,
        2,
        Math.random() > 0.5 ? "#e8d8b8" : "#d0c0a0",
        true
      );
    }
  }

  private emitSkid(p: Player) {
    for (let i = 0; i < 2; i++) {
      this.spawnParticle(
        p.x + p.w / 2 + p.facing * 6,
        p.y + p.h - 2,
        -p.facing * (1 + Math.random()),
        -0.6 - Math.random(),
        0.1,
        0.3,
        2,
        "#e8d8b8",
        true
      );
    }
  }

  private emitPoof(x: number, y: number, color: string) {
    for (let i = 0; i < 10; i++) {
      this.spawnParticle(
        x + (Math.random() - 0.5) * 8,
        y + (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 3,
        (Math.random() - 0.5) * 3,
        0.02,
        0.3 + Math.random() * 0.2,
        i % 3 === 0 ? 2 : 3,
        i % 2 ? color : "#ffffff",
        true
      );
    }
  }

  private emitCoinSparkle(x: number, y: number) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      this.spawnParticle(
        x,
        y,
        Math.cos(a) * (1 + Math.random()),
        Math.sin(a) * (1 + Math.random()) - 1,
        0.08,
        0.35 + Math.random() * 0.2,
        2,
        i % 2 ? "#ffd838" : "#fff8a0",
        true
      );
    }
  }

  private emitFirework(x: number, y: number) {
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + Math.random() * 0.3;
      const sp = 0.8 + Math.random() * 2.2;
      this.spawnParticle(
        x,
        y,
        Math.cos(a) * sp,
        Math.sin(a) * sp,
        0.045,
        0.7 + Math.random() * 0.4,
        i % 4 === 0 ? 3 : 2,
        FIRE_COLORS[i % FIRE_COLORS.length],
        true
      );
    }
  }

  private addPopup(x: number, y: number, text: string, color: string, size: number) {
    if (this.popups.length > 24) return;
    this.popups.push({ x, y, vy: -0.55, life: 0.9, max: 0.9, text, color, size });
  }

  private shake(dur: number, mag: number) {
    this.shakeT = Math.max(this.shakeT, dur);
    this.shakeDur = dur;
    this.shakeMag = Math.max(this.shakeMag, mag);
  }

  /* ================= render ================= */

  private text(x: number, y: number, str: string, color: string, size: number, align: CanvasTextAlign = "left") {
    const ctx = this.ctx;
    ctx.font = `${size}px "Press Start 2P", monospace`;
    ctx.textAlign = align;
    ctx.textBaseline = "top";
    ctx.fillStyle = "rgba(0,0,0,0.85)";
    ctx.fillText(str, x + 1, y + 1);
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  private render() {
    const { ctx } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = this.skyGrad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    let shX = 0;
    let shY = 0;
    if (this.shakeT > 0) {
      const s = this.shakeMag * (this.shakeT / this.shakeDur);
      shX = (Math.random() * 2 - 1) * s;
      shY = (Math.random() * 2 - 1) * s;
    }
    const cam = Math.round(this.camX);
    ctx.save();
    ctx.translate(-cam + shX, shY);

    this.drawBackdrop(cam);
    this.drawTiles(cam);
    this.drawPipes(cam);
    this.drawCastle();
    this.drawFlag();
    this.drawCoins();
    this.drawPopCoins();
    this.drawPowers();
    this.drawEnemies(cam);
    this.drawPlayer();
    this.drawParticles();
    this.drawPopups();
    this.drawHints();
    ctx.restore();

    this.drawHUD();
  }

  private drawBackdrop(cam: number) {
    const { ctx } = this;
    const groundY = GROUND_ROW * TILE;
    for (const h of this.level.hills) {
      const img = this.sprites.hills[h.v];
      const x = Math.round(h.x * TILE - cam * 0.25);
      if (x > VIEW_W + 80 || x < -160) continue;
      ctx.drawImage(img, x, groundY - img.height);
    }
    for (const c of this.level.clouds) {
      const img = this.sprites.clouds[c.v];
      const x = Math.round(c.x * TILE - cam * 0.5);
      if (x > VIEW_W + 80 || x < -100) continue;
      ctx.drawImage(img, x, c.y * TILE);
    }
    for (const b of this.level.bushes) {
      const img = this.sprites.bushes[b.v];
      const x = Math.round(b.x * TILE - cam * 0.75);
      if (x > VIEW_W + 80 || x < -80) continue;
      ctx.drawImage(img, x, groundY - img.height + 2);
    }
  }

  private drawTiles(cam: number) {
    const { ctx } = this;
    const t = this.sprites.tiles;
    const x0 = Math.max(0, Math.floor(cam / TILE) - 1);
    const x1 = Math.min(this.level.w - 1, Math.ceil((cam + VIEW_W) / TILE) + 1);
    const qAlt = Math.floor(this.time * 3) % 2 === 0;
    for (let ty = 0; ty < this.level.h; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const v = this.level.grid[ty * this.level.w + tx];
        if (!v) continue;
        let img: HTMLCanvasElement | null = null;
        switch (v) {
          case T.GROUND:
            img = t.ground;
            break;
          case T.BRICK:
            img = t.brick;
            break;
          case T.Q:
            img = qAlt ? t.q0 : t.q1;
            break;
          case T.QUSED:
            img = t.qUsed;
            break;
          case T.STONE:
            img = t.stone;
            break;
        }
        if (!img) continue;
        let dy = 0;
        const b = this.bumps.get(ty * this.level.w + tx);
        if (b !== undefined && b > 0) {
          dy = -Math.round(Math.sin((1 - b / 0.22) * Math.PI) * 7);
        }
        ctx.drawImage(img, tx * TILE, ty * TILE + dy);
      }
    }
  }

  private drawPipes(cam: number) {
    const { ctx } = this;
    const x0 = Math.max(-1, Math.floor(cam / TILE) - 2);
    const x1 = Math.ceil((cam + VIEW_W) / TILE) + 2;
    for (const p of this.level.pipes) {
      if (p.x + 1 < x0 || p.x > x1) continue;
      for (let r = 0; r < p.h; r++) {
        const row = LEVEL_H - 1 - p.h + r;
        const img = r === 0 ? this.sprites.tiles.pipeTop : this.sprites.tiles.pipeBody;
        ctx.drawImage(img, p.x * TILE, row * TILE);
        ctx.drawImage(img, p.x * TILE + 16, row * TILE);
      }
    }
  }

  private drawCastle() {
    const { ctx } = this;
    ctx.drawImage(this.sprites.castle, this.level.castleX, GROUND_ROW * TILE - 80);
  }

  private drawFlag() {
    const { ctx } = this;
    ctx.drawImage(this.sprites.flagPole, this.level.flagX, GROUND_ROW * TILE - 144);
  }

  private drawCoins() {
    const { ctx } = this;
    for (const c of this.coinEnts) {
      if (c.taken) continue;
      const frame = Math.floor(c.spinT * 9) % 4;
      ctx.drawImage(this.sprites.coin[frame], Math.round(c.x), Math.round(c.y));
    }
  }

  private drawPopCoins() {
    const { ctx } = this;
    for (const c of this.popCoins) {
      ctx.drawImage(this.sprites.coin[1], Math.round(c.x), Math.round(c.y));
    }
  }

  private drawPowers() {
    const { ctx } = this;
    for (const m of this.powers) {
      ctx.drawImage(this.sprites.mushroom, Math.round(m.x), Math.round(m.y));
    }
  }

  private drawEnemies(cam: number) {
    const { ctx } = this;
    for (const e of this.enemies) {
      if (e.x < cam - 32 || e.x > cam + VIEW_W + 32) continue;
      const set = e.kind === "walker" ? this.sprites.goomba : this.sprites.spiny;
      const img = e.dead
        ? e.kind === "walker"
          ? this.sprites.goomba.squash
          : set.a
        : Math.floor(e.animT * 8) % 2 === 0
          ? set.a
          : set.b;
      ctx.save();
      if (e.dead) {
        ctx.translate(Math.round(e.x + 8), Math.round(e.y + 16));
        ctx.scale(1, 0.6);
        ctx.drawImage(img, -8, -16);
      } else {
        ctx.translate(Math.round(e.x + 8), Math.round(e.y + 8));
        ctx.scale(e.dir, 1);
        ctx.drawImage(img, -8, -8);
      }
      ctx.restore();
    }
  }

  private drawPlayer() {
    const p = this.player;
    if (p.hidden) return;
    if (p.invulnT > 0 && Math.floor(p.animT * 16) % 2 === 0 && this.state === "playing") return;
    const frames = p.big ? this.sprites.heroBig : this.sprites.heroSmall;
    let f = frames.stand;
    if (!p.onGround) f = frames.jump;
    else if (Math.abs(p.vx) > 0.15) f = Math.floor(p.animT * 14) % 2 === 0 ? frames.w1 : frames.w2;
    const { ctx } = this;
    ctx.save();
    ctx.translate(Math.round(p.x + p.w / 2), Math.round(p.y + p.h));
    ctx.scale(p.facing * p.squashX, p.squashY);
    if (p.big) ctx.drawImage(f, -7, -30);
    else ctx.drawImage(f, -7, -16);
    ctx.restore();
  }

  private drawParticles() {
    const { ctx } = this;
    for (const pt of this.particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, (pt.life / pt.max) * 1.4));
      ctx.fillStyle = pt.color;
      const s = Math.max(1, Math.round(pt.size * (0.5 + 0.5 * (pt.life / pt.max))));
      ctx.fillRect(Math.round(pt.x), Math.round(pt.y), s, s);
    }
    ctx.globalAlpha = 1;
  }

  private drawPopups() {
    const { ctx } = this;
    for (const pp of this.popups) {
      ctx.globalAlpha = Math.min(1, (pp.life / pp.max) * 2);
      this.text(Math.round(pp.x), Math.round(pp.y), pp.text, pp.color, pp.size, "center");
    }
    ctx.globalAlpha = 1;
  }

  private drawHints() {
    if (this.state !== "playing" || this.camX > 240) return;
    const t = this.isTouch;
    this.text(48, 92, t ? "A  =  JUMP" : "← →  MOVE", "#ffffff", 8);
    this.text(48, 108, t ? "HOLD A = HIGHER" : "SPACE  JUMP", "#ffffff", 8);
    this.text(48, 124, t ? "B  =  RUN" : "SHIFT  RUN", "#ffffff", 8);
  }

  private drawHUD() {
    const { ctx } = this;
    const hurry = this.time <= 60 && this.state === "playing";
    this.text(8, 10, `SCORE ${String(this.score).padStart(7, "0")}`, "#ffffff", 8);
    ctx.drawImage(this.sprites.coin[0], 214, 9, 9, 9);
    this.text(226, 10, `×${String(this.coins).padStart(2, "0")}`, "#ffffff", 8);
    this.text(VIEW_W - 8, 10, `TIME ${Math.max(0, Math.ceil(this.time))}`, hurry ? "#ff5050" : "#ffffff", 8, "right");
    ctx.drawImage(this.sprites.heart, 8, 24, 8, 8);
    this.text(18, 24, `×${this.lives}`, "#ffffff", 8);
    this.text(VIEW_W - 8, 24, "1-1", "#ffffff", 8, "right");
  }
}

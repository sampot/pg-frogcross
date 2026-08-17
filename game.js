/**
 * Street-crossing hop game. Original layout & sprites —
 * homage to the classic “cross the road / river” arcade type, not a commercial clone.
 */

export const COLS = 13;
export const ROWS = 13;
export const CELL = 36;
export const W = COLS * CELL;
export const H = ROWS * CELL;
export const MAX_LIVES = 3;
export const HOME_COLS = [1, 4, 7, 10];

/** @typedef {'grass'|'road'|'water'|'homeBank'} LaneKind */
/**
 * @typedef {{
 *   kind: LaneKind,
 *   dir: number,
 *   speed: number,
 *   gap: number,
 *   len: number,
 *   color: string,
 *   accent: string,
 * }} LaneDef
 */

/** Row 0 = top homes … row ROWS-1 = start. */
const BASE_LANES = /** @type {LaneDef[]} */ ([
  { kind: "homeBank", dir: 0, speed: 0, gap: 0, len: 0, color: "#166534", accent: "#86efac" },
  { kind: "water", dir: 1, speed: 48, gap: 3.2, len: 3, color: "#0e7490", accent: "#92400e" },
  { kind: "water", dir: -1, speed: 56, gap: 2.8, len: 2, color: "#0e7490", accent: "#a16207" },
  { kind: "water", dir: 1, speed: 40, gap: 3.6, len: 4, color: "#0e7490", accent: "#78350f" },
  { kind: "water", dir: -1, speed: 64, gap: 2.6, len: 2, color: "#0e7490", accent: "#b45309" },
  { kind: "water", dir: 1, speed: 52, gap: 3.0, len: 3, color: "#0e7490", accent: "#92400e" },
  { kind: "grass", dir: 0, speed: 0, gap: 0, len: 0, color: "#4d7c0f", accent: "#a3e635" },
  { kind: "road", dir: -1, speed: 70, gap: 3.4, len: 2, color: "#334155", accent: "#f87171" },
  { kind: "road", dir: 1, speed: 55, gap: 3.8, len: 1, color: "#334155", accent: "#60a5fa" },
  { kind: "road", dir: -1, speed: 85, gap: 2.9, len: 2, color: "#334155", accent: "#fbbf24" },
  { kind: "road", dir: 1, speed: 48, gap: 4.2, len: 3, color: "#334155", accent: "#c084fc" },
  { kind: "road", dir: -1, speed: 62, gap: 3.5, len: 1, color: "#334155", accent: "#fb7185" },
  { kind: "grass", dir: 0, speed: 0, gap: 0, len: 0, color: "#65a30d", accent: "#bef264" },
]);

/**
 * @typedef {{
 *   row: number,
 *   x: number,
 *   w: number,
 *   dir: number,
 *   speed: number,
 *   kind: 'car'|'raft',
 *   color: string,
 * }} Hazard
 */

/**
 * @typedef {{
 *   col: number,
 *   row: number,
 *   px: number,
 *   py: number,
 *   facing: {x:number,y:number},
 * }} Frog
 */

const BEST_KEY = "pg-frogcross-best";

export class FrogcrossGame {
  constructor() {
    this.best = loadBest();
    this.resetAll();
  }

  resetAll() {
    this.level = 1;
    this.score = 0;
    this.lives = MAX_LIVES;
    this.status = "ready"; // ready | playing | clear | over
    this.message = "按「出發」過馬路、再過河，進巢穴";
    this.homes = HOME_COLS.map(() => false);
    this.hazards = /** @type {Hazard[]} */ ([]);
    this.timeLeft = 40;
    this.hopCool = 0;
    this.invuln = 0;
    this.furthestRow = ROWS - 1;
    this.flash = 0;
    this._spawnFrog();
    this._rebuildHazards();
  }

  start() {
    if (this.status === "clear") {
      this.level += 1;
      this.homes = HOME_COLS.map(() => false);
      this.timeLeft = Math.max(28, 42 - this.level);
      this._rebuildHazards();
      this._spawnFrog();
      this.status = "playing";
      this.message = `第 ${this.level} 關 · 過街進巢`;
      return ["start"];
    }
    if (this.status === "over" || this.status === "ready") {
      this.level = 1;
      this.score = 0;
      this.lives = MAX_LIVES;
      this.homes = HOME_COLS.map(() => false);
      this.timeLeft = 40;
      this.furthestRow = ROWS - 1;
      this._rebuildHazards();
      this._spawnFrog();
    }
    this.status = "playing";
    this.message = "過馬路 · 過河 · 進巢穴";
    this.hopCool = 0;
    this.invuln = 0.35;
    return ["start"];
  }

  /**
   * @param {{x:number,y:number}} dir
   * @returns {string[]}
   */
  tryHop(dir) {
    if (this.status !== "playing" || this.hopCool > 0 || this.invuln > 0) return [];
    if (!dir.x && !dir.y) return [];
    const nx = this.frog.col + dir.x;
    const ny = this.frog.row + dir.y;
    if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) return [];

    const lane = BASE_LANES[ny];
    if (lane.kind === "homeBank") {
      return this._tryEnterHome(nx, ny, dir);
    }

    this.frog.col = nx;
    this.frog.row = ny;
    this.frog.px = nx * CELL + CELL / 2;
    this.frog.py = ny * CELL + CELL / 2;
    this.frog.facing = { x: dir.x, y: dir.y };
    // Prefer landing on a raft that covers this cell (fairer hops).
    if (lane.kind === "water") {
      const raft = this._raftNear(this.frog.px, ny);
      if (raft) this.frog.px = raft.x;
    }
    this.hopCool = 0.14;
    /** @type {string[]} */
    const events = ["hop"];

    if (ny < this.furthestRow) {
      const steps = this.furthestRow - ny;
      this.furthestRow = ny;
      this.score += steps * 10;
    }
    return events;
  }

  /**
   * @param {number} nx
   * @param {number} ny
   * @param {{x:number,y:number}} dir
   */
  _tryEnterHome(nx, ny, dir) {
    const hi = HOME_COLS.indexOf(nx);
    if (hi < 0) {
      // bank wall / bush — bounce soft fail
      this.flash = 0.12;
      return [];
    }
    if (this.homes[hi]) {
      this.flash = 0.12;
      return [];
    }
    this.homes[hi] = true;
    this.frog.col = nx;
    this.frog.row = ny;
    this.frog.px = nx * CELL + CELL / 2;
    this.frog.py = ny * CELL + CELL / 2;
    this.frog.facing = dir;
    this.score += 50 + Math.floor(this.timeLeft * 2);
    this.hopCool = 0.2;
    /** @type {string[]} */
    const events = ["home"];
    if (this.homes.every(Boolean)) {
      this.status = "clear";
      this.score += 200 + this.level * 50;
      this.message = `第 ${this.level} 關過關！`;
      this._saveBest();
      events.push("level");
    } else {
      this._spawnFrog();
      this.timeLeft = Math.max(28, 42 - this.level);
      this.furthestRow = ROWS - 1;
      this.message = `巢穴 ${this.homes.filter(Boolean).length}/${HOME_COLS.length}`;
      this.invuln = 0.4;
    }
    return events;
  }

  /**
   * @param {number} dt
   * @returns {string[]}
   */
  update(dt) {
    /** @type {string[]} */
    const events = [];
    if (this.hopCool > 0) this.hopCool = Math.max(0, this.hopCool - dt);
    if (this.invuln > 0) this.invuln = Math.max(0, this.invuln - dt);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt);

    for (const h of this.hazards) {
      h.x += h.dir * h.speed * dt;
      const span = COLS * CELL + h.w + CELL * 2;
      if (h.dir > 0 && h.x - h.w / 2 > COLS * CELL + CELL) h.x -= span;
      if (h.dir < 0 && h.x + h.w / 2 < -CELL) h.x += span;
    }

    if (this.status !== "playing") return events;

    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      events.push(...this._kill("時間到"));
      return events;
    }

    const lane = BASE_LANES[this.frog.row];
    if (lane.kind === "road") {
      if (this.invuln <= 0 && this._hitCar()) {
        events.push(...this._kill("撞車"));
        return events;
      }
    } else if (lane.kind === "water") {
      const raft = this._raftUnder();
      if (!raft) {
        if (this.invuln <= 0) {
          events.push(...this._kill("落水"));
          return events;
        }
      } else {
        this.frog.px += raft.dir * raft.speed * dt;
        this.frog.col = Math.floor(this.frog.px / CELL);
        if (this.frog.px < 0 || this.frog.px > COLS * CELL) {
          events.push(...this._kill("漂出畫面"));
          return events;
        }
      }
    }

    return events;
  }

  _hitCar() {
    const fy = this.frog.py;
    const fx = this.frog.px;
    const r = CELL * 0.28;
    for (const h of this.hazards) {
      if (h.kind !== "car" || h.row !== this.frog.row) continue;
      const half = h.w / 2 - 2;
      if (Math.abs(h.x - fx) < half + r && Math.abs(h.row * CELL + CELL / 2 - fy) < CELL * 0.4) {
        return true;
      }
    }
    return false;
  }

  /** @returns {Hazard | null} */
  _raftUnder() {
    return this._raftNear(this.frog.px, this.frog.row);
  }

  /**
   * @param {number} fx
   * @param {number} row
   * @returns {Hazard | null}
   */
  _raftNear(fx, row) {
    /** @type {Hazard | null} */
    let best = null;
    let bestDist = Infinity;
    for (const h of this.hazards) {
      if (h.kind !== "raft" || h.row !== row) continue;
      const half = h.w / 2 - CELL * 0.08;
      const dist = Math.abs(h.x - fx);
      if (dist < half && dist < bestDist) {
        best = h;
        bestDist = dist;
      }
    }
    return best;
  }

  /**
   * @param {string} reason
   * @returns {string[]}
   */
  _kill(reason) {
    const splash = reason === "落水" || reason === "漂出畫面";
    /** @type {string[]} */
    const events = [splash ? "splash" : "crunch"];
    this.lives -= 1;
    this.flash = 0.35;
    if (this.lives <= 0) {
      this.status = "over";
      this.message = `結束 · ${reason} · 分數 ${this.score}`;
      this._saveBest();
      events.push("lose");
    } else {
      this.message = `${reason} · 剩餘 ${this.lives} 命`;
      this._spawnFrog();
      this.timeLeft = Math.max(28, 42 - this.level);
      this.furthestRow = ROWS - 1;
      this.invuln = 0.85;
      events.push("hurt");
    }
    return events;
  }

  _spawnFrog() {
    const col = Math.floor(COLS / 2);
    const row = ROWS - 1;
    this.frog = /** @type {Frog} */ ({
      col,
      row,
      px: col * CELL + CELL / 2,
      py: row * CELL + CELL / 2,
      facing: { x: 0, y: -1 },
    });
    this.hopCool = 0;
  }

  _rebuildHazards() {
    const speedMul = 1 + (this.level - 1) * 0.12;
    /** @type {Hazard[]} */
    const list = [];
    for (let row = 0; row < ROWS; row++) {
      const lane = BASE_LANES[row];
      if (lane.kind !== "road" && lane.kind !== "water") continue;
      const kind = lane.kind === "road" ? "car" : "raft";
      const w = lane.len * CELL * 0.92;
      const period = (lane.gap + lane.len) * CELL;
      const count = Math.ceil((COLS * CELL) / period) + 1;
      const phase = ((row * 47) % 100) / 100;
      for (let i = 0; i < count; i++) {
        list.push({
          row,
          x: i * period + phase * period - CELL,
          w,
          dir: lane.dir,
          speed: lane.speed * speedMul,
          kind,
          color: lane.accent,
        });
      }
    }
    this.hazards = list;
  }

  _saveBest() {
    if (this.score > this.best.score) {
      this.best = { score: this.score, level: this.level };
      try {
        localStorage.setItem(BEST_KEY, JSON.stringify(this.best));
      } catch {
        /* */
      }
      // KV 為權威；LS 僅快取
      void fetch(`/api/kv/${BEST_KEY}`, { method: "PUT", body: JSON.stringify(this.best) }).catch(
        () => {}
      );
    }
  }

  /** KV 為權威；本地快取過舊時以遠端為準 */
  async mergeBestFromKv() {
    try {
      const res = await fetch(`/api/kv/${BEST_KEY}`);
      if (!res.ok) return;
      const raw = JSON.parse((await res.text()) || "null");
      if (raw && typeof raw.score === "number" && raw.score > this.best.score) {
        this.best = { score: raw.score, level: raw.level || 1 };
      }
    } catch {
      /* 無 KV 環境照玩 */
    }
  }

  /** @returns {LaneDef[]} */
  lanes() {
    return BASE_LANES;
  }
}

function loadBest() {
  try {
    const raw = JSON.parse(localStorage.getItem(BEST_KEY) || "null");
    if (raw && typeof raw.score === "number") {
      return { score: raw.score, level: raw.level || 1 };
    }
  } catch {
    /* */
  }
  return { score: 0, level: 1 };
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {FrogcrossGame} game
 * @param {number} ts
 */
export function drawGame(ctx, game, ts) {
  const lanes = game.lanes();

  for (let row = 0; row < ROWS; row++) {
    const lane = lanes[row];
    const y = row * CELL;
    if (lane.kind === "road") {
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(0, y, W, CELL);
      ctx.strokeStyle = "rgba(248,250,252,0.18)";
      ctx.setLineDash([8, 10]);
      ctx.beginPath();
      ctx.moveTo(0, y + CELL / 2);
      ctx.lineTo(W, y + CELL / 2);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (lane.kind === "water") {
      const g = ctx.createLinearGradient(0, y, 0, y + CELL);
      g.addColorStop(0, "#0c4a6e");
      g.addColorStop(1, "#155e75");
      ctx.fillStyle = g;
      ctx.fillRect(0, y, W, CELL);
      ctx.fillStyle = "rgba(125,211,252,0.12)";
      const wave = Math.sin(ts / 400 + row) * 4;
      for (let x = -20; x < W; x += 28) {
        ctx.fillRect(x + wave, y + 8 + (row % 2) * 6, 14, 3);
      }
    } else if (lane.kind === "homeBank") {
      ctx.fillStyle = "#14532d";
      ctx.fillRect(0, y, W, CELL);
      for (let c = 0; c < COLS; c++) {
        const hi = HOME_COLS.indexOf(c);
        const x = c * CELL;
        if (hi >= 0) {
          ctx.fillStyle = game.homes[hi] ? "#4ade80" : "#052e16";
          roundRect(ctx, x + 4, y + 4, CELL - 8, CELL - 8, 6);
          ctx.fill();
          if (game.homes[hi]) {
            drawFrog(ctx, x + CELL / 2, y + CELL / 2, CELL * 0.34, { x: 0, y: 1 }, true);
          } else {
            ctx.strokeStyle = "rgba(134,239,172,0.55)";
            ctx.lineWidth = 2;
            roundRect(ctx, x + 8, y + 8, CELL - 16, CELL - 16, 4);
            ctx.stroke();
          }
        } else {
          // bushes
          ctx.fillStyle = "#166534";
          ctx.beginPath();
          ctx.ellipse(x + CELL / 2, y + CELL * 0.55, CELL * 0.38, CELL * 0.32, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#22c55e";
          ctx.beginPath();
          ctx.ellipse(x + CELL / 2, y + CELL * 0.4, CELL * 0.28, CELL * 0.24, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else {
      ctx.fillStyle = row === ROWS - 1 ? "#84cc16" : "#65a30d";
      ctx.fillRect(0, y, W, CELL);
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      for (let c = 0; c < COLS; c += 2) {
        ctx.fillRect(c * CELL + (row % 2) * CELL, y, CELL, CELL);
      }
    }
  }

  for (const h of game.hazards) {
    const y = h.row * CELL + CELL / 2;
    if (h.kind === "car") {
      drawCar(ctx, h.x, y, h.w, CELL * 0.62, h.color, h.dir);
    } else {
      drawRaft(ctx, h.x, y, h.w, CELL * 0.55, h.color);
    }
  }

  if (game.status !== "over" || game.flash > 0) {
    const blink = game.invuln > 0 && Math.floor(ts / 80) % 2 === 0;
    if (!blink || game.status !== "playing") {
      drawFrog(ctx, game.frog.px, game.frog.py, CELL * 0.38, game.frog.facing, false);
    }
  }

  if (game.flash > 0) {
    ctx.fillStyle = `rgba(248,113,113,${game.flash * 0.45})`;
    ctx.fillRect(0, 0, W, H);
  }

  // timer bar
  const tRatio = Math.max(0, Math.min(1, game.timeLeft / 42));
  ctx.fillStyle = "rgba(15,23,42,0.55)";
  ctx.fillRect(8, H - 8, W - 16, 4);
  ctx.fillStyle = tRatio < 0.25 ? "#f87171" : "#4ade80";
  ctx.fillRect(8, H - 8, (W - 16) * tRatio, 4);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {string} color
 * @param {number} dir
 */
function drawCar(ctx, x, y, w, h, color, dir) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  roundRect(ctx, -w / 2, -h / 2, w, h, 5);
  ctx.fill();
  ctx.fillStyle = "rgba(15,23,42,0.35)";
  roundRect(ctx, -w / 2 + 4, -h / 2 + 3, w * 0.35, h - 6, 3);
  ctx.fill();
  // headlight
  ctx.fillStyle = "#fef9c3";
  const hx = dir > 0 ? w / 2 - 5 : -w / 2 + 2;
  ctx.fillRect(hx, -3, 4, 6);
  ctx.restore();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {string} color
 */
function drawRaft(ctx, x, y, w, h, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  roundRect(ctx, -w / 2, -h / 2, w, h, 4);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 1.5;
  for (let i = 1; i < 3; i++) {
    const lx = -w / 2 + (w * i) / 3;
    ctx.beginPath();
    ctx.moveTo(lx, -h / 2 + 2);
    ctx.lineTo(lx, h / 2 - 2);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} r
 * @param {{x:number,y:number}} facing
 * @param {boolean} settled
 */
function drawFrog(ctx, x, y, r, facing, settled) {
  ctx.save();
  ctx.translate(x, y);
  const ang = Math.atan2(facing.y, facing.x) + Math.PI / 2;
  ctx.rotate(ang);
  ctx.fillStyle = settled ? "#86efac" : "#22c55e";
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.85, r, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#16a34a";
  ctx.beginPath();
  ctx.ellipse(0, r * 0.15, r * 0.55, r * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  // eyes
  ctx.fillStyle = "#ecfdf5";
  ctx.beginPath();
  ctx.arc(-r * 0.35, -r * 0.45, r * 0.28, 0, Math.PI * 2);
  ctx.arc(r * 0.35, -r * 0.45, r * 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.arc(-r * 0.35, -r * 0.5, r * 0.12, 0, Math.PI * 2);
  ctx.arc(r * 0.35, -r * 0.5, r * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number} r
 */
function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

import { FrogcrossAudio } from "./audio.js";
import {
  FrogcrossGame,
  W,
  H,
  MAX_LIVES,
  drawGame,
} from "./game.js";

const audio = new FrogcrossAudio();
const game = new FrogcrossGame();
globalThis.__frogcross = game;

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById("game"));
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const levelEl = document.getElementById("level");
const bestEl = document.getElementById("best");
const statusEl = document.getElementById("status");
const btnStart = document.getElementById("btn-start");
const btnMute = document.getElementById("btn-mute");
const pad = document.getElementById("pad");

canvas.width = W;
canvas.height = H;

let lastTs = 0;
let running = true;
/** @type {{ x: number, y: number } | null} */
let swipeOrigin = null;
/** @type {Set<string>} */
const held = new Set();
let keyRepeat = 0;

function hearts(n) {
  return "♥".repeat(Math.max(0, n)) + "♡".repeat(Math.max(0, MAX_LIVES - n));
}

/** @param {string} msg @param {string} [tone] */
function setStatus(msg, tone = "") {
  statusEl.textContent = msg;
  statusEl.dataset.tone = tone;
}

function syncHud() {
  scoreEl.textContent = String(game.score);
  livesEl.textContent = hearts(game.lives);
  levelEl.textContent = String(game.level);
  bestEl.textContent = game.best.score > 0 ? String(game.best.score) : "—";

  const tone =
    game.status === "clear" ? "win" : game.status === "over" ? "lose" : "";
  setStatus(game.message, tone);

  if (game.status === "ready") {
    btnStart.textContent = "出發";
    btnStart.disabled = false;
  } else if (game.status === "playing") {
    btnStart.textContent = "進行中";
    btnStart.disabled = true;
  } else if (game.status === "clear") {
    btnStart.textContent = "下一關";
    btnStart.disabled = false;
  } else {
    btnStart.textContent = "再來一局";
    btnStart.disabled = false;
  }

  btnMute.textContent = audio.enabled ? "聲音" : "靜音";
  btnMute.setAttribute("aria-pressed", audio.enabled ? "true" : "false");
}

function bgmTempo() {
  return Math.min(148, 108 + (game.level - 1) * 6);
}

/** @param {string[]} events */
function handleEvents(events) {
  for (const e of events) {
    if (e === "start") {
      audio.start();
      audio.startBgm(bgmTempo());
    } else if (e === "hop") audio.hop();
    else if (e === "home") audio.home();
    else if (e === "splash") audio.splash();
    else if (e === "crunch") audio.crunch();
    else if (e === "level") {
      audio.level();
      // Keep groove; nudge tempo for the next round when they press 下一關
    } else if (e === "lose") {
      audio.lose();
      audio.stopBgm();
    } else if (e === "hurt") audio.crunch();
  }
}

/**
 * @param {number} dx
 * @param {number} dy
 */
function hop(dx, dy) {
  if (game.status !== "playing") return;
  const events = game.tryHop({ x: dx, y: dy });
  if (events.length) handleEvents(events);
}

async function tryStart() {
  await audio.unlock();
  if (game.status === "playing") return;
  const events = game.start();
  handleEvents(events);
  syncHud();
}

btnStart.addEventListener("click", () => {
  void tryStart();
});

btnMute.addEventListener("click", async () => {
  await audio.unlock();
  const on = !audio.enabled;
  audio.setEnabled(on);
  if (on && game.status === "playing") audio.startBgm(bgmTempo());
  syncHud();
});

pad?.addEventListener("pointerdown", (e) => {
  const btn = /** @type {HTMLElement | null} */ (
    e.target instanceof Element ? e.target.closest("[data-dir]") : null
  );
  if (!btn) return;
  e.preventDefault();
  void audio.unlock();
  const [dx, dy] = btn.dataset.dir.split(",").map(Number);
  hop(dx, dy);
});

window.addEventListener("keydown", (e) => {
  const map = {
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    w: [0, -1],
    W: [0, -1],
    s: [0, 1],
    S: [0, 1],
    a: [-1, 0],
    A: [-1, 0],
    d: [1, 0],
    D: [1, 0],
  };
  const dir = map[e.key];
  if (!dir) {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      void tryStart();
    }
    return;
  }
  e.preventDefault();
  if (held.has(e.key)) return;
  held.add(e.key);
  void audio.unlock();
  hop(dir[0], dir[1]);
});

window.addEventListener("keyup", (e) => {
  held.delete(e.key);
});

canvas.addEventListener(
  "pointerdown",
  (e) => {
    swipeOrigin = { x: e.clientX, y: e.clientY };
    void audio.unlock();
  },
  { passive: true },
);

canvas.addEventListener(
  "pointerup",
  (e) => {
    if (!swipeOrigin) return;
    const dx = e.clientX - swipeOrigin.x;
    const dy = e.clientY - swipeOrigin.y;
    swipeOrigin = null;
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    if (Math.max(ax, ay) < 24) return;
    if (ax > ay) hop(dx > 0 ? 1 : -1, 0);
    else hop(0, dy > 0 ? 1 : -1);
  },
  { passive: true },
);

canvas.addEventListener("pointercancel", () => {
  swipeOrigin = null;
});

function frame(ts) {
  if (!running) return;
  const dt = Math.min(0.05, (ts - lastTs) / 1000) || 0.016;
  lastTs = ts;

  // hold-to-repeat hops for keyboard comfort
  keyRepeat -= dt;
  if (keyRepeat <= 0 && held.size) {
    const order = ["ArrowUp", "w", "W", "ArrowDown", "s", "S", "ArrowLeft", "a", "A", "ArrowRight", "d", "D"];
    for (const k of order) {
      if (!held.has(k)) continue;
      const map = {
        ArrowUp: [0, -1],
        w: [0, -1],
        W: [0, -1],
        ArrowDown: [0, 1],
        s: [0, 1],
        S: [0, 1],
        ArrowLeft: [-1, 0],
        a: [-1, 0],
        A: [-1, 0],
        ArrowRight: [1, 0],
        d: [1, 0],
        D: [1, 0],
      };
      hop(map[k][0], map[k][1]);
      keyRepeat = 0.16;
      break;
    }
  }

  const events = game.update(dt);
  if (events.length) handleEvents(events);

  drawGame(ctx, game, ts);
  syncHud();
  requestAnimationFrame(frame);
}

document.body.addEventListener(
  "pointerdown",
  () => {
    void audio.unlock();
  },
  { once: true },
);

syncHud();
drawGame(ctx, game, 0);
requestAnimationFrame((ts) => {
  lastTs = ts;
  requestAnimationFrame(frame);
});

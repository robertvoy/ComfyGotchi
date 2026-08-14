import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const TICK_INTERVAL_MS = 60000;
const POLL_INTERVAL_MS = 2000;

const NODE_W = 200;
const NODE_H = 380;
const DEVICE_OFFSET_Y = 120;

const W = 200;
const H = 250;

const SHELL_COLOR = "#f0e6d3";
const SHELL_DARK = "#d4c4a8";
const SHELL_BUTTON = "#c9b896";
const SCREEN_BG = "#9bbc0f";
const SCREEN_BG_DARK = "#8bac0f";
const PD = "#0f380f";
const PM = "#306230";
const PL = "#8bac0f";
const PW = "#c4cfa1";
const PURPLE = "#7c5fb8";
const RED = "#b33a3a";

let lastState = null;
let lastTickSent = 0;
let animFrame = 0;

async function fetchState() {
  try {
    const r = await fetch("/comfygotchi/state");
    lastState = await r.json();
    return lastState;
  } catch (e) {
    console.warn("[ComfyGotchi] fetchState failed", e);
    return null;
  }
}

async function sendTick() {
  const now = Date.now();
  if (now - lastTickSent < TICK_INTERVAL_MS - 1000) return;
  lastTickSent = now;
  try {
    await fetch("/comfygotchi/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "tick", elapsed_minutes: 1 }),
    });
  } catch (e) {
    console.warn("[ComfyGotchi] tick failed", e);
  }
}

function px(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function drawEgg(ctx, cx, cy, crackProgress, bob) {
  const oy = Math.round(bob);
  const ex = cx;
  const ey = cy + oy;
  for (let dy = -18; dy <= 18; dy++) {
    for (let dx = -14; dx <= 14; dx++) {
      const dist = Math.sqrt((dx * dx) / (14 * 14) + ((dy + 4) * (dy + 4)) / (18 * 18));
      if (dist <= 1) {
        let c = PW;
        if (dist > 0.85) c = PL;
        if (dist > 0.95) c = PM;
        px(ctx, ex + dx, ey + dy, 1, 1, c);
      }
    }
  }
  px(ctx, ex - 8, ey - 6, 2, 2, PD);
  px(ctx, ex + 6, ey - 6, 2, 2, PD);
  px(ctx, ex - 5, ey + 2, 6, 1, PM);
  if (crackProgress > 0.5) {
    px(ctx, ex - 6, ey - 10, 1, 3, PD);
    px(ctx, ex - 5, ey - 8, 2, 1, PD);
    px(ctx, ex - 3, ey - 7, 1, 2, PD);
  }
  if (crackProgress > 0.75) {
    px(ctx, ex + 2, ey - 12, 1, 4, PD);
    px(ctx, ex + 3, ey - 9, 2, 1, PD);
    px(ctx, ex + 5, ey - 8, 1, 3, PD);
  }
  if (crackProgress >= 1.0) {
    px(ctx, ex - 8, ey - 14, 16, 1, PD);
    px(ctx, ex - 4, ey - 15, 8, 1, PD);
  }
}

function drawBodyBase(ctx, cx, cy, rx, ry, fillColor, edgeColor, tier) {
  for (let dy = -ry; dy <= ry; dy++) {
    for (let dx = -rx; dx <= rx; dx++) {
      const dist = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
      if (dist <= 1) {
        let c = fillColor;
        if (dist > 0.8) c = edgeColor;
        if (tier > 0 && dist < 0.3) c = PURPLE;
        px(ctx, cx + dx, cy + dy, 1, 1, c);
      }
    }
  }
}

function drawEyes(ctx, cx, cy, mood, sep) {
  const eyeY = cy;
  if (mood === "grumpy" || mood === "miserable") {
    px(ctx, cx - sep - 1, eyeY - 1, 3, 1, PD);
    px(ctx, cx + sep - 1, eyeY - 1, 3, 1, PD);
  } else {
    px(ctx, cx - sep, eyeY, 2, 2, PD);
    px(ctx, cx + sep - 1, eyeY, 2, 2, PD);
  }
}

function drawMouth(ctx, cx, cy, mood, width) {
  if (mood === "happy" || mood === "ecstatic") {
    px(ctx, cx - width, cy + 4, width * 2, 1, PD);
    px(ctx, cx - width - 1, cy + 3, 1, 1, PD);
    px(ctx, cx + width, cy + 3, 1, 1, PD);
  } else if (mood === "miserable") {
    px(ctx, cx - width, cy + 6, width * 2, 1, PD);
    px(ctx, cx - width - 1, cy + 7, 1, 1, PD);
    px(ctx, cx + width, cy + 7, 1, 1, PD);
  } else {
    px(ctx, cx - width, cy + 4, width * 2, 1, PD);
  }
}

function drawHorns(ctx, cx, cy, rx) {
  px(ctx, cx - rx + 1, cy - 2, 1, 3, PD);
  px(ctx, cx - rx, cy - 1, 2, 1, PD);
  px(ctx, cx + rx - 2, cy - 2, 1, 3, PD);
  px(ctx, cx + rx - 1, cy - 1, 2, 1, PD);
}

function drawBlob(ctx, cx, cy, mood, bob, weight, tier) {
  const oy = Math.round(bob);
  const rx = 14 + Math.round(weight * 0.1);
  const ry = 12;
  drawBodyBase(ctx, cx, cy + oy, rx, ry, PW, PL, tier);
  drawEyes(ctx, cx, cy + oy - 2, mood, 5);
  drawMouth(ctx, cx, cy + oy, mood, 4);
}

function drawCat(ctx, cx, cy, mood, bob, weight, tier) {
  const oy = Math.round(bob);
  const rx = 13 + Math.round(weight * 0.08);
  const ry = 11;
  drawBodyBase(ctx, cx, cy + oy, rx, ry, PW, PL, tier);
  px(ctx, cx - rx + 1, cy + oy - ry, 2, 5, PW);
  px(ctx, cx - rx + 1, cy + oy - ry - 2, 3, 2, PW);
  px(ctx, cx + rx - 3, cy + oy - ry, 2, 5, PW);
  px(ctx, cx + rx - 3, cy + oy - ry - 2, 3, 2, PW);
  px(ctx, cx - rx + 1, cy + oy - ry + 1, 1, 3, PD);
  px(ctx, cx + rx - 1, cy + oy - ry + 1, 1, 3, PD);
  drawEyes(ctx, cx, cy + oy - 2, mood, 5);
  px(ctx, cx - 1, cy + oy + 2, 2, 1, PD);
  px(ctx, cx - 4, cy + oy + 3, 1, 1, PD);
  px(ctx, cx + 3, cy + oy + 3, 1, 1, PD);
  drawMouth(ctx, cx, cy + oy, mood, 3);
}

function drawDog(ctx, cx, cy, mood, bob, weight, tier) {
  const oy = Math.round(bob);
  const rx = 14 + Math.round(weight * 0.1);
  const ry = 11;
  drawBodyBase(ctx, cx, cy + oy, rx, ry, PW, PL, tier);
  px(ctx, cx - rx - 2, cy + oy - ry + 2, 3, 7, PW);
  px(ctx, cx + rx, cy + oy - ry + 2, 3, 7, PW);
  px(ctx, cx - rx - 2, cy + oy - ry + 2, 3, 2, PL);
  px(ctx, cx + rx, cy + oy - ry + 2, 3, 2, PL);
  px(ctx, cx - 3, cy + oy, 6, 4, PL);
  px(ctx, cx - 1, cy + oy + 3, 2, 1, PD);
  drawEyes(ctx, cx, cy + oy - 2, mood, 5);
  drawMouth(ctx, cx, cy + oy + 4, mood, 3);
}

function drawMonster(ctx, cx, cy, mood, bob, weight, tier) {
  const oy = Math.round(bob);
  const rx = 14 + Math.round(weight * 0.1);
  const ry = 12;
  drawBodyBase(ctx, cx, cy + oy, rx, ry, PW, PL, tier);
  px(ctx, cx - rx + 2, cy + oy - ry - 1, 1, 4, PD);
  px(ctx, cx - rx + 1, cy + oy - ry, 3, 1, PD);
  px(ctx, cx + rx - 3, cy + oy - ry - 1, 1, 4, PD);
  px(ctx, cx + rx - 3, cy + oy - ry, 3, 1, PD);
  drawEyes(ctx, cx, cy + oy - 2, mood, 5);
  px(ctx, cx - 4, cy + oy + 3, 1, 2, PD);
  px(ctx, cx - 2, cy + oy + 4, 1, 1, PD);
  px(ctx, cx, cy + oy + 3, 1, 2, PD);
  px(ctx, cx + 2, cy + oy + 4, 1, 1, PD);
  px(ctx, cx + 4, cy + oy + 3, 1, 2, PD);
}

function drawDragon(ctx, cx, cy, mood, bob, weight, tier) {
  const oy = Math.round(bob);
  const rx = 14 + Math.round(weight * 0.1);
  const ry = 11;
  drawBodyBase(ctx, cx, cy + oy, rx, ry, PW, PL, tier);
  px(ctx, cx - rx - 4, cy + oy - 4, 4, 2, PW);
  px(ctx, cx - rx - 4, cy + oy - 6, 2, 3, PW);
  px(ctx, cx + rx + 1, cy + oy - 4, 4, 2, PW);
  px(ctx, cx + rx + 3, cy + oy - 6, 2, 3, PW);
  px(ctx, cx - rx + 2, cy + oy - ry - 1, 1, 4, PD);
  px(ctx, cx + rx - 3, cy + oy - ry - 1, 1, 4, PD);
  for (let i = 0; i < 5; i++) {
    px(ctx, cx + rx - 1 + i * 2, cy + oy + ry, 1, 2, PD);
  }
  drawEyes(ctx, cx, cy + oy - 2, mood, 5);
  drawMouth(ctx, cx, cy + oy, mood, 4);
}

function drawRobot(ctx, cx, cy, mood, bob, weight, tier) {
  const oy = Math.round(bob);
  const rw = 16 + Math.round(weight * 0.1);
  const rh = 14;
  const ex = cx;
  const ey = cy + oy;
  for (let dy = -rh; dy <= rh; dy++) {
    for (let dx = -rw; dx <= rw; dx++) {
      if (Math.abs(dx) <= rw && Math.abs(dy) <= rh) {
        let c = PW;
        if (Math.abs(dx) > rw - 2 || Math.abs(dy) > rh - 2) c = PL;
        if (tier > 0 && Math.abs(dx) < 4 && Math.abs(dy) < 4) c = PURPLE;
        px(ctx, ex + dx, ey + dy, 1, 1, c);
      }
    }
  }
  px(ctx, ex, ey - rh - 4, 1, 4, PD);
  px(ctx, ex - 2, ey - rh - 5, 5, 1, PD);
  px(ctx, ex, ey - rh - 6, 1, 1, RED);
  if (mood === "grumpy" || mood === "miserable") {
    px(ctx, ex - 5, ey - 2, 3, 1, RED);
    px(ctx, ex + 3, ey - 2, 3, 1, RED);
  } else {
    px(ctx, ex - 5, ey - 3, 3, 2, RED);
    px(ctx, ex + 3, ey - 3, 3, 2, RED);
  }
  px(ctx, ex - 3, ey + 3, 6, 1, PD);
  if (mood === "happy" || mood === "ecstatic") {
    px(ctx, ex - 4, ey + 2, 1, 1, PD);
    px(ctx, ex + 4, ey + 2, 1, 1, PD);
  }
}

function drawPhantom(ctx, cx, cy, mood, bob, weight, tier) {
  const oy = Math.round(bob * 0.5);
  const rx = 13 + Math.round(weight * 0.08);
  const ry = 12;
  const ex = cx;
  const ey = cy + oy;
  ctx.globalAlpha = 0.75;
  for (let dy = -ry; dy <= 0; dy++) {
    for (let dx = -rx; dx <= rx; dx++) {
      const dist = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
      if (dist <= 1) {
        let c = PW;
        if (dist > 0.8) c = PL;
        if (tier > 0 && dist < 0.3) c = PURPLE;
        px(ctx, ex + dx, ey + dy, 1, 1, c);
      }
    }
  }
  const waveY = ey + 1;
  for (let dx = -rx; dx <= rx; dx++) {
    const wave = Math.round(Math.sin((dx + animFrame * 0.1) * 0.5) * 2);
    px(ctx, ex + dx, waveY + wave, 1, 6, PW);
  }
  px(ctx, ex - rx, waveY + 4, 3, 3, PW);
  px(ctx, ex - 3, waveY + 4, 3, 4, PW);
  px(ctx, ex + 3, waveY + 4, 3, 3, PW);
  ctx.globalAlpha = 1.0;
  drawEyes(ctx, ex, ey - 2, mood, 5);
  drawMouth(ctx, ex, ey, mood, 4);
}

function drawAlien(ctx, cx, cy, mood, bob, weight, tier) {
  const oy = Math.round(bob);
  const rx = 11 + Math.round(weight * 0.08);
  const ry = 13;
  drawBodyBase(ctx, cx, cy + oy, rx, ry, PL, PM, tier);
  px(ctx, cx, cy + oy - ry - 3, 1, 3, PM);
  px(ctx, cx - 2, cy + oy - ry - 4, 5, 1, PM);
  px(ctx, cx, cy + oy - ry - 5, 1, 1, PD);
  if (mood === "grumpy" || mood === "miserable") {
    px(ctx, cx - 5, cy + oy - 3, 3, 1, PD);
    px(ctx, cx + 2, cy + oy - 3, 3, 1, PD);
  } else {
    px(ctx, cx - 6, cy + oy - 4, 3, 3, PD);
    px(ctx, cx + 3, cy + oy - 4, 3, 3, PD);
    px(ctx, cx - 5, cy + oy - 3, 1, 1, PW);
    px(ctx, cx + 4, cy + oy - 3, 1, 1, PW);
  }
  px(ctx, cx - 1, cy + oy + 2, 2, 1, PD);
  drawMouth(ctx, cx, cy + oy + 4, mood, 2);
}

function drawBunny(ctx, cx, cy, mood, bob, weight, tier) {
  const oy = Math.round(bob);
  const rx = 12 + Math.round(weight * 0.08);
  const ry = 11;
  drawBodyBase(ctx, cx, cy + oy, rx, ry, PW, PL, tier);
  px(ctx, cx - 6, cy + oy - ry - 8, 3, 10, PW);
  px(ctx, cx + 4, cy + oy - ry - 8, 3, 10, PW);
  px(ctx, cx - 5, cy + oy - ry - 6, 1, 6, PL);
  px(ctx, cx + 5, cy + oy - ry - 6, 1, 6, PL);
  drawEyes(ctx, cx, cy + oy - 2, mood, 4);
  px(ctx, cx - 1, cy + oy + 2, 2, 1, PD);
  drawMouth(ctx, cx, cy + oy + 4, mood, 2);
  px(ctx, cx - 8, cy + oy + 6, 2, 1, PD);
  px(ctx, cx + 7, cy + oy + 6, 2, 1, PD);
}

function drawPenguin(ctx, cx, cy, mood, bob, weight, tier) {
  const oy = Math.round(bob);
  const rx = 13 + Math.round(weight * 0.1);
  const ry = 13;
  drawBodyBase(ctx, cx, cy + oy, rx, ry, PD, PD, 0);
  for (let dy = -8; dy <= 6; dy++) {
    for (let dx = -7; dx <= 7; dx++) {
      if (Math.abs(dx) + Math.abs(dy) < 10) {
        px(ctx, cx + dx, cy + oy + dy, 1, 1, PW);
      }
    }
  }
  if (tier > 0) {
    px(ctx, cx, cy + oy - 2, 3, 3, PURPLE);
  }
  if (mood === "grumpy" || mood === "miserable") {
    px(ctx, cx - 5, cy + oy - 4, 3, 1, PD);
    px(ctx, cx + 2, cy + oy - 4, 3, 1, PD);
  } else {
    px(ctx, cx - 4, cy + oy - 5, 2, 2, PD);
    px(ctx, cx + 3, cy + oy - 5, 2, 2, PD);
  }
  px(ctx, cx - 2, cy + oy - 2, 4, 2, RED);
  px(ctx, cx - 4, cy + oy + 6, 3, 2, RED);
  px(ctx, cx + 2, cy + oy + 6, 3, 2, RED);
}

function drawGhost(ctx, cx, cy, bob) {
  const oy = Math.round(bob * 0.5);
  const ex = cx;
  const ey = cy + oy;
  for (let dy = -12; dy <= 10; dy++) {
    for (let dx = -10; dx <= 10; dx++) {
      if (dx * dx + dy * dy <= 100) {
        px(ctx, ex + dx, ey + dy, 1, 1, PM);
      }
    }
  }
  px(ctx, ex - 10, ey + 10, 4, 2, PM);
  px(ctx, ex - 4, ey + 10, 4, 3, PM);
  px(ctx, ex + 2, ey + 10, 4, 2, PM);
  px(ctx, ex - 5, ey - 3, 2, 2, PD);
  px(ctx, ex + 3, ey - 3, 2, 2, PD);
  px(ctx, ex - 3, ey + 12, 6, 1, PL);
}

function drawHearts(ctx, x, y, count, max) {
  for (let i = 0; i < max; i++) {
    const filled = i < count;
    const hx = x + i * 7;
    const c = filled ? PD : PL;
    px(ctx, hx, y, 1, 1, c);
    px(ctx, hx + 2, y, 1, 1, c);
    px(ctx, hx, y + 1, 3, 1, c);
    px(ctx, hx + 1, y + 2, 1, 1, c);
  }
}

function drawFoodBar(ctx, x, y, value, max) {
  const width = 20;
  const filled = Math.round((value / max) * width);
  for (let i = 0; i < width; i++) {
    const c = i < filled ? PD : PL;
    px(ctx, x + i, y, 1, 3, c);
  }
}

function drawText(ctx, text, x, y, color = PD) {
  ctx.fillStyle = color;
  ctx.font = "6px monospace";
  ctx.textBaseline = "top";
  ctx.fillText(text, x, y);
}

function drawCreature(ctx, state) {
  ctx.fillStyle = SHELL_COLOR;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = SHELL_DARK;
  ctx.fillRect(6, 6, W - 12, H - 12);
  ctx.fillStyle = SHELL_COLOR;
  ctx.fillRect(8, 8, W - 16, H - 16);

  const sx = 14;
  const sy = 16;
  const sw = W - 28;
  const sh = 130;

  ctx.fillStyle = SCREEN_BG;
  ctx.fillRect(sx, sy, sw, sh);
  ctx.fillStyle = SCREEN_BG_DARK;
  for (let i = 0; i < sw; i += 2) {
    for (let j = 0; j < sh; j += 2) {
      if ((i + j) % 4 === 0) {
        ctx.fillRect(sx + i, sy + j, 1, 1, SCREEN_BG_DARK);
      }
    }
  }
  ctx.strokeStyle = SHELL_DARK;
  ctx.lineWidth = 2;
  ctx.strokeRect(sx - 1, sy - 1, sw + 2, sh + 2);

  const cx = sx + Math.round(sw / 2);
  const cy = sy + Math.round(sh / 2) - 10;
  const bob = Math.sin(animFrame * 0.05) * 2;
  const stage = state ? (state.stage || "egg") : "egg";
  const mood = state ? (state.mood || "neutral") : "neutral";
  const weight = state ? (state.weight || 50) : 50;
  const tier = state ? (state.evolution_tier || 0) : 0;
  const variant = state ? (state.variant || "blob") : "blob";

  if (stage === "egg") {
    const crack = state ? (state.incubation_progress || 0) / 10 : 0;
    drawEgg(ctx, cx, cy, crack, bob);
  } else if (stage === "ghost") {
    drawGhost(ctx, cx, cy, bob);
  } else {
    const drawers = {
      blob: drawBlob, cat: drawCat, dog: drawDog, monster: drawMonster,
      dragon: drawDragon, robot: drawRobot, phantom: drawPhantom,
      alien: drawAlien, bunny: drawBunny, penguin: drawPenguin
    };
    const drawer = drawers[variant] || drawBlob;
    drawer(ctx, cx, cy, mood, bob, weight, tier);
    if (mood === "ecstatic") {
      const hx = cx + 16 + Math.sin(animFrame * 0.1) * 2;
      const hy = cy - 10 + Math.cos(animFrame * 0.15) * 2;
      px(ctx, hx, hy, 1, 1, PD);
      px(ctx, hx + 1, hy - 1, 1, 1, PD);
      px(ctx, hx - 1, hy - 1, 1, 1, PD);
      px(ctx, hx, hy - 2, 1, 1, PD);
    }
  }

  const barY = sy + sh + 4;
  drawText(ctx, "HUN", sx + 2, barY, PD);
  drawFoodBar(ctx, sx + 22, barY, state ? (state.hunger || 0) : 0, 100);
  drawText(ctx, "JOY", sx + 2, barY + 7, PD);
  const joyCount = Math.round((state ? (state.happiness || 0) : 0) / 25);
  drawHearts(ctx, sx + 22, barY + 7, joyCount, 4);
  const eaten = state ? (state.stats?.total_images_eaten || 0) : 0;
  drawText(ctx, `MEALS:${eaten}`, sx + 2, barY + 16, PD);
  if (tier > 0) {
    drawText(ctx, `EVO:T${tier}`, sx + sw - 36, barY + 16, PD);
  }
  const nextEvo = (tier + 1) * 5000;
  const progress = eaten / nextEvo;
  const barW = sw - 4;
  const filled = Math.round(progress * barW);
  for (let i = 0; i < barW; i++) {
    const c = i < filled ? PD : PL;
    px(ctx, sx + 2 + i, barY + 24, 1, 1, c);
  }

  ctx.fillStyle = SHELL_BUTTON;
  ctx.beginPath();
  ctx.arc(W / 2 - 20, H - 8, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(W / 2, H - 8, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(W / 2 + 20, H - 8, 5, 0, Math.PI * 2);
  ctx.fill();
}

app.registerExtension({
  name: "comfygotchi",
  async beforeRegisterNodeDef(nodeType, nodeData, app) {
    if (nodeData.name !== "ComfyGotchiNode") return;
    const onNodeCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
      this.setSize([NODE_W, NODE_H]);
      this.onDrawBackground = function (ctx) {
        if (this.flags.collapsed) return;
        ctx.save();
        ctx.translate(0, DEVICE_OFFSET_Y);
        drawCreature(ctx, lastState);
        ctx.restore();
        animFrame++;
        this.setDirtyCanvas(true, false);
      };
      return r;
    };
  },
  async setup() {
    await fetchState();
    setInterval(fetchState, POLL_INTERVAL_MS);
    setInterval(sendTick, TICK_INTERVAL_MS);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        fetchState();
        sendTick();
      }
    });
  },
});

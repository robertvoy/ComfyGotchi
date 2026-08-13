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
const PIXEL_DARK = "#0f380f";
const PIXEL_MID = "#306230";
const PIXEL_LIGHT = "#8bac0f";
const PIXEL_WHITE = "#c4cfa1";

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
        let color = PIXEL_WHITE;
        if (dist > 0.85) color = PIXEL_LIGHT;
        if (dist > 0.95) color = PIXEL_MID;
        px(ctx, ex + dx, ey + dy, 1, 1, color);
      }
    }
  }

  px(ctx, ex - 8, ey - 6, 2, 2, PIXEL_DARK);
  px(ctx, ex + 6, ey - 6, 2, 2, PIXEL_DARK);
  px(ctx, ex - 5, ey + 2, 6, 1, PIXEL_MID);
  px(ctx, ex - 3, ey + 4, 3, 1, PIXEL_MID);

  if (crackProgress > 0.5) {
    px(ctx, ex - 6, ey - 10, 1, 3, PIXEL_DARK);
    px(ctx, ex - 5, ey - 8, 2, 1, PIXEL_DARK);
    px(ctx, ex - 3, ey - 7, 1, 2, PIXEL_DARK);
  }
  if (crackProgress > 0.75) {
    px(ctx, ex + 2, ey - 12, 1, 4, PIXEL_DARK);
    px(ctx, ex + 3, ey - 9, 2, 1, PIXEL_DARK);
    px(ctx, ex + 5, ey - 8, 1, 3, PIXEL_DARK);
  }
  if (crackProgress >= 1.0) {
    px(ctx, ex - 8, ey - 14, 16, 1, PIXEL_DARK);
    px(ctx, ex - 4, ey - 15, 8, 1, PIXEL_DARK);
  }
}

function drawHatchling(ctx, cx, cy, mood, bob, weight) {
  const oy = Math.round(bob);
  const r = 10 + Math.round(weight * 0.08);
  const ex = cx;
  const ey = cy + oy;

  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy <= r * r) {
        let color = PIXEL_WHITE;
        if (Math.abs(dx) > r - 2 || Math.abs(dy) > r - 2) color = PIXEL_LIGHT;
        px(ctx, ex + dx, ey + dy, 1, 1, color);
      }
    }
  }

  const eyeY = ey - 2;
  if (mood === "grumpy" || mood === "miserable") {
    px(ctx, ex - 5, eyeY - 1, 3, 1, PIXEL_DARK);
    px(ctx, ex + 3, eyeY - 1, 3, 1, PIXEL_DARK);
  } else {
    px(ctx, ex - 4, eyeY, 2, 2, PIXEL_DARK);
    px(ctx, ex + 3, eyeY, 2, 2, PIXEL_DARK);
  }

  if (mood === "happy" || mood === "ecstatic") {
    px(ctx, ex - 3, ey + 4, 6, 1, PIXEL_DARK);
    px(ctx, ex - 4, ey + 3, 1, 1, PIXEL_DARK);
    px(ctx, ex + 3, ey + 3, 1, 1, PIXEL_DARK);
  } else if (mood === "miserable") {
    px(ctx, ex - 3, ey + 5, 6, 1, PIXEL_DARK);
    px(ctx, ex - 4, ey + 6, 1, 1, PIXEL_DARK);
    px(ctx, ex + 3, ey + 6, 1, 1, PIXEL_DARK);
  } else {
    px(ctx, ex - 2, ey + 4, 4, 1, PIXEL_DARK);
  }
}

function drawAdult(ctx, cx, cy, mood, bob, weight, tier) {
  const oy = Math.round(bob);
  const rx = 14 + Math.round(weight * 0.1);
  const ry = 12;
  const ex = cx;
  const ey = cy + oy;

  for (let dy = -ry; dy <= ry; dy++) {
    for (let dx = -rx; dx <= rx; dx++) {
      const dist = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
      if (dist <= 1) {
        let color = PIXEL_WHITE;
        if (dist > 0.8) color = PIXEL_LIGHT;
        if (tier > 0 && dist < 0.3) color = "#7c5fb8";
        px(ctx, ex + dx, ey + dy, 1, 1, color);
      }
    }
  }

  if (tier > 0) {
    px(ctx, ex - 2, ey - ry - 3, 1, 3, PIXEL_DARK);
    px(ctx, ex + 2, ey - ry - 3, 1, 3, PIXEL_DARK);
    px(ctx, ex - 3, ey - ry - 1, 2, 1, PIXEL_DARK);
    px(ctx, ex + 2, ey - ry - 1, 2, 1, PIXEL_DARK);
  }

  const eyeY = ey - 2;
  if (mood === "grumpy" || mood === "miserable") {
    px(ctx, ex - 6, eyeY - 1, 4, 1, PIXEL_DARK);
    px(ctx, ex + 2, eyeY - 1, 4, 1, PIXEL_DARK);
  } else {
    px(ctx, ex - 5, eyeY, 2, 2, PIXEL_DARK);
    px(ctx, ex + 3, eyeY, 2, 2, PIXEL_DARK);
  }

  if (mood === "happy" || mood === "ecstatic") {
    px(ctx, ex - 4, ey + 4, 8, 1, PIXEL_DARK);
    px(ctx, ex - 5, ey + 3, 1, 1, PIXEL_DARK);
    px(ctx, ex + 4, ey + 3, 1, 1, PIXEL_DARK);
  } else if (mood === "miserable") {
    px(ctx, ex - 4, ey + 6, 8, 1, PIXEL_DARK);
    px(ctx, ex - 5, ey + 7, 1, 1, PIXEL_DARK);
    px(ctx, ex + 4, ey + 7, 1, 1, PIXEL_DARK);
  } else {
    px(ctx, ex - 3, ey + 4, 6, 1, PIXEL_DARK);
  }

  if (mood === "ecstatic") {
    const hx = ex + 12 + Math.sin(animFrame * 0.1) * 2;
    const hy = ey - 8 + Math.cos(animFrame * 0.15) * 2;
    px(ctx, hx, hy, 1, 1, PIXEL_DARK);
    px(ctx, hx + 1, hy - 1, 1, 1, PIXEL_DARK);
    px(ctx, hx - 1, hy - 1, 1, 1, PIXEL_DARK);
    px(ctx, hx, hy - 2, 1, 1, PIXEL_DARK);
  }
}

function drawGhost(ctx, cx, cy, bob) {
  const oy = Math.round(bob * 0.5);
  const ex = cx;
  const ey = cy + oy;

  for (let dy = -12; dy <= 10; dy++) {
    for (let dx = -10; dx <= 10; dx++) {
      if (dx * dx + dy * dy <= 100) {
        px(ctx, ex + dx, ey + dy, 1, 1, PIXEL_MID);
      }
    }
  }

  px(ctx, ex - 10, ey + 10, 4, 2, PIXEL_MID);
  px(ctx, ex - 4, ey + 10, 4, 3, PIXEL_MID);
  px(ctx, ex + 2, ey + 10, 4, 2, PIXEL_MID);

  px(ctx, ex - 5, ey - 3, 2, 2, PIXEL_DARK);
  px(ctx, ex + 3, ey - 3, 2, 2, PIXEL_DARK);

  px(ctx, ex - 3, ey + 12, 6, 1, PIXEL_LIGHT);
}

function drawHearts(ctx, x, y, count, max) {
  for (let i = 0; i < max; i++) {
    const filled = i < count;
    const hx = x + i * 7;
    const c = filled ? PIXEL_DARK : PIXEL_LIGHT;
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
    const c = i < filled ? PIXEL_DARK : PIXEL_LIGHT;
    px(ctx, x + i, y, 1, 3, c);
  }
}

function drawText(ctx, text, x, y, color = PIXEL_DARK) {
  ctx.fillStyle = color;
  ctx.font = "6px monospace";
  ctx.textBaseline = "top";
  ctx.fillText(text, x, y);
}

function drawDevice(ctx, state) {
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

  if (stage === "egg") {
    const crack = state ? (state.incubation_progress || 0) / 20 : 0;
    drawEgg(ctx, cx, cy, crack, bob);
  } else if (stage === "hatchling") {
    drawHatchling(ctx, cx, cy, mood, bob, weight);
  } else if (stage === "ghost") {
    drawGhost(ctx, cx, cy, bob);
  } else {
    drawAdult(ctx, cx, cy, mood, bob, weight, tier);
  }

  const barY = sy + sh + 4;

  drawText(ctx, "HUN", sx + 2, barY, PIXEL_DARK);
  drawFoodBar(ctx, sx + 22, barY, state ? (state.hunger || 0) : 0, 100);

  drawText(ctx, "JOY", sx + 2, barY + 7, PIXEL_DARK);
  const joyCount = Math.round((state ? (state.happiness || 0) : 0) / 25);
  drawHearts(ctx, sx + 22, barY + 7, joyCount, 4);

  const eaten = state ? (state.stats?.total_images_eaten || 0) : 0;
  drawText(ctx, `MEALS:${eaten}`, sx + 2, barY + 16, PIXEL_DARK);

  if (tier > 0) {
    drawText(ctx, `EVO:T${tier}`, sx + sw - 36, barY + 16, PIXEL_DARK);
  }

  const nextEvo = (tier + 1) * 5000;
  const progress = eaten / nextEvo;
  const barW = sw - 4;
  const filled = Math.round(progress * barW);
  for (let i = 0; i < barW; i++) {
    const c = i < filled ? PIXEL_DARK : PIXEL_LIGHT;
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
        drawDevice(ctx, lastState);
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

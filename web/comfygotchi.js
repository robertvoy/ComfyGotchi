import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const TICK_INTERVAL_MS = 60000;
const POLL_INTERVAL_MS = 2000;

const STAGE_COLORS = {
  egg: "#d4a574",
  hatchling: "#7ec8e3",
  adult: "#5cb85c",
  evolved: "#9b59b6",
  ghost: "#aaaaaa",
};

let lastState = null;
let lastTickSent = 0;

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

function drawCreature(ctx, state) {
  if (!state) {
    ctx.fillStyle = "#333";
    ctx.font = "12px sans-serif";
    ctx.fillText("loading...", 10, 40);
    return;
  }

  const cx = 64;
  const cy = 56;
  const color = STAGE_COLORS[state.stage] || "#5cb85c";
  const weightScale = 0.7 + (state.weight / 100) * 0.6;
  const radiusX = 30 * weightScale;
  const radiusY = 28;

  if (state.stage === "ghost") {
    ctx.globalAlpha = 0.5 + Math.sin(Date.now() / 500) * 0.2;
  }

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(cx, cy, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.fill();

  if (state.stage === "egg") {
    ctx.strokeStyle = "#8B5E3C";
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(cx - 10 + i * 10, cy - 5, 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    const prog = state.incubation_progress / 20;
    if (prog > 0.75) {
      ctx.strokeStyle = "#ff4444";
      ctx.beginPath();
      ctx.moveTo(cx - 15, cy);
      ctx.lineTo(cx - 5, cy + 5);
      ctx.lineTo(cx + 5, cy - 3);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(cx - 10, cy - 5, 5, 0, Math.PI * 2);
    ctx.arc(cx + 10, cy - 5, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#000";
    const mood = state.mood || "neutral";
    let eyeY = cy - 5;
    if (mood === "miserable" || mood === "grumpy") eyeY = cy - 3;
    ctx.beginPath();
    ctx.arc(cx - 10, eyeY, 2, 0, Math.PI * 2);
    ctx.arc(cx + 10, eyeY, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (mood === "ecstatic" || mood === "happy") {
      ctx.arc(cx, cy + 8, 6, 0, Math.PI);
    } else if (mood === "miserable") {
      ctx.arc(cx, cy + 15, 6, Math.PI, Math.PI * 2);
    } else {
      ctx.moveTo(cx - 5, cy + 10);
      ctx.lineTo(cx + 5, cy + 10);
    }
    ctx.stroke();
  }

  ctx.globalAlpha = 1.0;

  ctx.fillStyle = "#ff5555";
  ctx.font = "10px sans-serif";
  ctx.fillText(`H:${Math.round(state.hunger)}`, 4, 12);
  ctx.fillText(`J:${Math.round(state.happiness)}`, 4, 24);
  const eaten = state.stats?.total_images_eaten || 0;
  ctx.fillText(`eaten:${eaten}`, 4, 100);
  if (state.evolution_tier > 0) {
    ctx.fillStyle = "#9b59b6";
    ctx.fillText(`T${state.evolution_tier}`, 90, 12);
  }
}

app.registerExtension({
  name: "comfygotchi",
  async beforeRegisterNodeDef(nodeType, nodeData, app) {
    if (nodeData.name !== "ComfyGotchiNode") return;

    const onNodeCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
      this.setSize([150, 130]);
      this.onDrawBackground = function (ctx) {
        if (this.flags.collapsed) return;
        drawCreature(ctx, lastState);
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

import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

async function sendLove() {
  try {
    await fetch("/comfygotchi/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "love" }),
    });
  } catch (e) {
    console.warn("[ComfyGotchi] love event failed", e);
  }
}

function isApiNode(nodeType) {
  if (!nodeType) return false;
  const defs = window.comfyAPI?.nodeDefs || {};
  const def = defs[nodeType];
  if (def && def.api_node === true) return true;
  if (def && def.python_module && def.python_module.startsWith("comfy_api_nodes")) return true;
  return false;
}

app.registerExtension({
  name: "comfygotchi_listener",
  async setup() {
    api.addEventListener("executed", (evt) => {
      const detail = evt.detail || {};
      const nodeType = detail.class_type || detail.type || detail.node_type;
      if (isApiNode(nodeType)) {
        sendLove();
      }
    });
  },
});

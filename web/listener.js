import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

let apiNodeTypes = null;

async function loadApiNodeTypes() {
  try {
    const r = await fetch("/object_info");
    const defs = await r.json();
    const types = new Set();
    for (const [name, def] of Object.entries(defs)) {
      if (def.api_node === true) {
        types.add(name);
      }
    }
    apiNodeTypes = types;
    console.log(`[ComfyGotchi] Loaded ${types.size} API node types for love detection`);
  } catch (e) {
    console.warn("[ComfyGotchi] Failed to load object_info for love detection", e);
    apiNodeTypes = null;
  }
}

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

function checkNodeAndSendLove(nodeId) {
  if (apiNodeTypes === null || apiNodeTypes.size === 0) return;
  const node = app.graph?._nodes_by_id?.[nodeId];
  if (!node) return;
  if (apiNodeTypes.has(node.type)) {
    sendLove();
  }
}

app.registerExtension({
  name: "comfygotchi_listener",
  async setup() {
    await loadApiNodeTypes();
    
    setInterval(() => {
      if (apiNodeTypes === null) {
        loadApiNodeTypes();
      }
    }, 30000);
    
    api.addEventListener("executed", (evt) => {
      const detail = evt.detail || {};
      const nodeId = detail.node || detail.display_node;
      if (nodeId) {
        checkNodeAndSendLove(String(nodeId));
      }
    });
    
    api.addEventListener("executing", (evt) => {
      const detail = evt.detail || {};
      const nodeId = detail.node;
      if (nodeId) {
        checkNodeAndSendLove(String(nodeId));
      }
    });
  },
});

import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const MAX_TRACKED_PROMPTS = 256;
const rewardedPromptIds = new Set();
const rewardedPromptOrder = [];

function rememberPrompt(promptId) {
  const key = String(promptId || "");
  if (!key || rewardedPromptIds.has(key)) return false;

  rewardedPromptIds.add(key);
  rewardedPromptOrder.push(key);
  while (rewardedPromptOrder.length > MAX_TRACKED_PROMPTS) {
    rewardedPromptIds.delete(rewardedPromptOrder.shift());
  }
  return true;
}

async function sendCreativeEnergy(promptId) {
  try {
    const response = await fetch("/comfygotchi/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "love",
        source: "workflow_success",
        prompt_id: String(promptId),
      }),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (e) {
    console.warn("[ComfyGotchi] creative energy event failed", e);
  }
}

app.registerExtension({
  name: "comfygotchi_listener",
  setup() {
    api.addEventListener("execution_success", (evt) => {
      const detail = evt.detail || {};
      const promptId = detail.prompt_id;
      if (!rememberPrompt(promptId)) return;

      console.log(`[ComfyGotchi] Creative energy! Workflow ${promptId} completed`);
      sendCreativeEnergy(promptId);
    });
  },
});

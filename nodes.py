import os
import json
import urllib.request

from .vision import detect_vision_models, caption_image, _rule_based_caption
from .prompts import generate_comment
from .state import GotchiState, CONFIG

_STATE_PATH = os.path.join(os.path.dirname(__file__), "state.json")

def _post_event(event_type, caption=""):
    try:
        data = json.dumps({"type": event_type, "caption": caption}).encode("utf-8")
        req = urllib.request.Request(
            "http://127.0.0.1:8188/comfygotchi/event",
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        urllib.request.urlopen(req, timeout=5)
    except Exception as e:
        print(f"[ComfyGotchi] Failed to POST event: {e}")

def _get_state_dict():
    try:
        req = urllib.request.Request("http://127.0.0.1:8188/comfygotchi/state")
        with urllib.request.urlopen(req, timeout=5) as resp:
            return json.loads(resp.read())
    except Exception:
        return None

class ComfyGotchiNode:
    @classmethod
    def INPUT_TYPES(s):
        models = detect_vision_models()
        return {
            "required": {
                "image": ("IMAGE",),
                "vision_model": (models, {"default": models[0]}),
            },
            "optional": {
                "florence2_model": ("FL2MODEL",),
            },
        }

    RETURN_TYPES = ("IMAGE", "STRING")
    RETURN_NAMES = ("image", "comment")
    FUNCTION = "process"
    CATEGORY = "ComfyGotchi"

    def process(self, image, vision_model="none", florence2_model=None):
        caption = caption_image(image, vision_model, florence2_model)
        state_dict = _get_state_dict()
        if state_dict is None:
            mood = "neutral"
            stage = "adult"
            tier = 0
        else:
            mood = state_dict.get("mood", "neutral")
            stage = state_dict.get("stage", "egg")
            tier = state_dict.get("evolution_tier", 0)
        comment = generate_comment(mood, stage, tier, caption)
        _post_event("feed", caption)
        return (image, comment)

NODE_CLASS_MAPPINGS = {
    "ComfyGotchiNode": ComfyGotchiNode,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "ComfyGotchiNode": "ComfyGotchi",
}

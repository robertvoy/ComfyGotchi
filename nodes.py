import os
import json
import random
import urllib.request

from .vision import detect_qwen_models, caption_image, determine_variant
from .prompts import generate_comment

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

def _post_variant_update(variant, personality):
    try:
        data = json.dumps({"type": "set_variant", "variant": variant, "personality": personality}).encode("utf-8")
        req = urllib.request.Request(
            "http://127.0.0.1:8188/comfygotchi/event",
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        urllib.request.urlopen(req, timeout=10)
    except Exception as e:
        print(f"[ComfyGotchi] Failed to POST variant update: {e}")

class ComfyGotchiNode:
    @classmethod
    def INPUT_TYPES(s):
        models = detect_qwen_models()
        return {
            "required": {
                "image": ("IMAGE",),
            },
            "optional": {
                "qwen_model": (models, {"default": models[0], "tooltip": "Select a Qwen-VL model from models/LLM/Qwen-VL/, or 'none (rule-based)' for fallback"}),
                "keep_model_loaded": ("BOOLEAN", {"default": True, "tooltip": "Keep Qwen model in VRAM between calls"}),
            },
        }

    RETURN_TYPES = ("IMAGE", "STRING")
    RETURN_NAMES = ("image", "comment")
    FUNCTION = "process"
    CATEGORY = "ComfyGotchi"

    def process(self, image, qwen_model="none (rule-based)", keep_model_loaded=True, **kwargs):
        state_dict = _get_state_dict()
        
        if state_dict is None:
            stage = "egg"
            mood = "incubating"
            tier = 0
            variant = "blob"
            personality = ""
            incubation_progress = 0
            egg_captions = []
            variant_determined = False
        else:
            stage = state_dict.get("stage", "egg")
            mood = state_dict.get("mood", "neutral")
            tier = state_dict.get("evolution_tier", 0)
            variant = state_dict.get("variant", "blob")
            personality = state_dict.get("personality", "")
            incubation_progress = state_dict.get("incubation_progress", 0)
            egg_captions = state_dict.get("egg_captions", [])
            variant_determined = state_dict.get("variant_determined", False)

        comment = ""
        caption = ""

        if stage == "egg":
            try:
                caption = caption_image(image, qwen_model, keep_model_loaded)
            except Exception as e:
                print(f"[ComfyGotchi] Caption failed in egg phase: {e}")
                caption = ""
            egg_captions.append(caption)
            _post_event("egg_caption", caption)
            
            if len(egg_captions) >= 10 and not variant_determined:
                try:
                    variant, personality = determine_variant(egg_captions, qwen_model, keep_model_loaded)
                except Exception as e:
                    print(f"[ComfyGotchi] Variant determination failed: {e}")
                    variant, personality = "blob", ""
                _post_variant_update(variant, personality)
            
            _post_event("feed", caption)
            progress = incubation_progress + 1
            if progress >= 10:
                comment = "*crack* ... something is happening!"
            elif progress >= 7:
                comment = "*wobble wobble*"
            elif progress >= 4:
                comment = "*tiny shake*"
            else:
                comment = "..."

        elif stage == "ghost":
            _post_event("feed", "")
            comment = generate_comment("dead", "ghost", tier, None, personality, variant)

        else:
            _post_event("feed", "")
            
            try:
                if random.random() < 0.25:
                    caption = caption_image(image, qwen_model, keep_model_loaded)
                    comment = generate_comment(mood, stage, tier, caption, personality, variant)
                else:
                    comment = generate_comment(mood, stage, tier, None, personality, variant)
            except Exception as e:
                print(f"[ComfyGotchi] Comment generation failed: {e}")
                comment = "..."
            
            if not comment:
                comment = "..."

        if not comment:
            comment = "..."

        return (image, comment)

NODE_CLASS_MAPPINGS = {
    "ComfyGotchiNode": ComfyGotchiNode,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "ComfyGotchiNode": "ComfyGotchi",
}

import numpy as np
import os
import importlib.util

def detect_vision_models():
    available = ["none"]
    packs = {
        "florence2": "comfyui_florence2",
        "qwen_vl": "ComfyUI_QwenVL",
        "pixtral": "ComfyUI_pixtral_vision",
        "joytag": "Comfyui_joytag",
    }
    import sys
    for name, mod in packs.items():
        spec_path = None
        for p in sys.path:
            candidate = os.path.join(p, mod, "__init__.py")
            if os.path.exists(candidate):
                spec_path = candidate
                break
        if spec_path:
            available.append(name)
    if importlib.util.find_spec("comfyui_florence2") is not None:
        if "florence2" not in available:
            available.append("florence2")
    return available

def _rule_based_caption(image_tensor):
    if image_tensor is None:
        return "something"
    arr = image_tensor
    if hasattr(arr, "cpu"):
        arr = arr.cpu().numpy()
    if arr.ndim == 4:
        arr = arr[0]
    mean_brightness = float(arr.mean())
    r, g, b = float(arr[..., 0].mean()), float(arr[..., 1].mean()), float(arr[..., 2].mean())
    dominant = ["red", "green", "blue"][np.argmax([r, g, b])]
    if mean_brightness < 0.2:
        return f"a dark {dominant} image"
    if mean_brightness > 0.8:
        return f"a bright {dominant} image"
    return f"a {dominant} image"

def caption_image(image_tensor, model_name="none", florence2_model=None):
    if model_name == "none" or model_name is None:
        return _rule_based_caption(image_tensor)
    if model_name == "florence2":
        try:
            return _caption_with_florence2(image_tensor, florence2_model)
        except Exception as e:
            print(f"[ComfyGotchi] Florence2 caption failed: {e}, falling back")
            return _rule_based_caption(image_tensor)
    return _rule_based_caption(image_tensor)

def _caption_with_florence2(image_tensor, florence2_model):
    if florence2_model is None:
        raise ValueError("No Florence2 model provided")
    from comfyui_florence2.nodes import Florence2Run
    runner = Florence2Run()
    image, mask, caption, data = runner.encode(
        image=image_tensor,
        florence2_model=florence2_model,
        text_input="",
        task="caption",
        fill_mask=False,
        keep_model_loaded=False,
        max_new_tokens=64,
        num_beams=3,
        do_sample=False,
        output_mask_select="",
        seed=42,
    )
    if isinstance(caption, str):
        return caption.strip()
    if isinstance(caption, list) and len(caption) > 0:
        return str(caption[0]).strip()
    return _rule_based_caption(image_tensor)

import os
import glob
import numpy as np

_QWEN_STATE = {
    "model": None,
    "processor": None,
    "tokenizer": None,
    "current_path": None,
}

def detect_qwen_models():
    try:
        import folder_paths
        llm_paths = folder_paths.get_folder_paths("LLM") if "LLM" in folder_paths.folder_names_and_paths else []
    except Exception:
        llm_paths = []
    if not llm_paths:
        llm_paths = [os.path.join(os.path.dirname(__file__), "..", "..", "models", "LLM")]
    
    models = ["none (rule-based)"]
    for base in llm_paths:
        qwen_dir = os.path.join(base, "Qwen-VL")
        if not os.path.isdir(qwen_dir):
            continue
        for entry in os.listdir(qwen_dir):
            full = os.path.join(qwen_dir, entry)
            if not os.path.isdir(full):
                continue
            has_config = os.path.exists(os.path.join(full, "config.json"))
            has_weights = bool(glob.glob(os.path.join(full, "*.safetensors")) or glob.glob(os.path.join(full, "*.bin")))
            if has_config and has_weights:
                models.append(entry)
    return models

def _tensor_to_pil(tensor):
    if tensor is None:
        return None
    from PIL import Image
    if hasattr(tensor, "cpu"):
        tensor = tensor.cpu()
    arr = tensor
    if hasattr(arr, "numpy"):
        arr = arr.numpy()
    if arr.ndim == 4:
        arr = arr[0]
    arr = (arr * 255).clip(0, 255).astype(np.uint8)
    return Image.fromarray(arr)

def _load_qwen(model_path):
    if _QWEN_STATE["current_path"] == model_path and _QWEN_STATE["model"] is not None:
        return
    _unload_qwen()
    import torch
    from transformers import AutoModelForImageTextToText, AutoProcessor, AutoTokenizer
    dtype = torch.float16 if torch.cuda.is_available() else torch.float32
    device = "cuda:0" if torch.cuda.is_available() else "cpu"
    print(f"[ComfyGotchi] Loading Qwen-VLM from {model_path} on {device}...")
    _QWEN_STATE["model"] = AutoModelForImageTextToText.from_pretrained(
        model_path, torch_dtype=dtype, attn_implementation="sdpa"
    ).to(device).eval()
    _QWEN_STATE["processor"] = AutoProcessor.from_pretrained(model_path)
    _QWEN_STATE["tokenizer"] = AutoTokenizer.from_pretrained(model_path, trust_remote_code=True)
    _QWEN_STATE["current_path"] = model_path
    print("[ComfyGotchi] Qwen-VLM loaded.")

def _unload_qwen():
    if _QWEN_STATE["model"] is not None:
        try:
            _QWEN_STATE["model"] = _QWEN_STATE["model"].cpu()
        except Exception:
            pass
    _QWEN_STATE["model"] = None
    _QWEN_STATE["processor"] = None
    _QWEN_STATE["tokenizer"] = None
    _QWEN_STATE["current_path"] = None
    import gc
    gc.collect()
    try:
        import torch
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            torch.cuda.synchronize()
    except ImportError:
        pass

def _get_model_path(model_name):
    try:
        import folder_paths
        llm_paths = folder_paths.get_folder_paths("LLM") if "LLM" in folder_paths.folder_names_and_paths else []
    except Exception:
        llm_paths = []
    if not llm_paths:
        llm_paths = [os.path.join(os.path.dirname(__file__), "..", "..", "models", "LLM")]
    for base in llm_paths:
        candidate = os.path.join(base, "Qwen-VL", model_name)
        if os.path.isdir(candidate):
            return candidate
    return None

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

def _safe_pad_token_id(tokenizer):
    pid = getattr(tokenizer, "pad_token_id", None)
    if pid is None:
        pid = getattr(tokenizer, "eos_token_id", None)
    return pid

def _qwen_generate(pil_image, prompt_text, max_tokens=128, retries=2):
    import torch
    model = _QWEN_STATE["model"]
    processor = _QWEN_STATE["processor"]
    tokenizer = _QWEN_STATE["tokenizer"]
    if model is None or processor is None or tokenizer is None:
        raise RuntimeError("Qwen model not loaded")
    pad_token_id = _safe_pad_token_id(tokenizer)

    conversation = [{"role": "user", "content": [
        {"type": "image", "image": pil_image},
        {"type": "text", "text": prompt_text}
    ]}]
    chat = processor.apply_chat_template(conversation, tokenize=False, add_generation_prompt=True)
    inputs = processor(text=chat, images=[pil_image], return_tensors="pt")
    device = next(model.parameters()).device
    inputs = {k: v.to(device) if torch.is_tensor(v) else v for k, v in inputs.items()}

    last_text = ""
    for attempt in range(retries + 1):
        gen_kwargs = dict(
            **inputs,
            max_new_tokens=max_tokens,
            do_sample=True,
            temperature=0.6 if attempt == 0 else 0.3,
            top_p=0.9,
        )
        if pad_token_id is not None:
            gen_kwargs["pad_token_id"] = pad_token_id
        output = model.generate(**gen_kwargs)
        input_len = inputs["input_ids"].shape[-1]
        text = tokenizer.decode(output[0, input_len:], skip_special_tokens=True).strip()
        if text:
            return text
        last_text = text
        print(f"[ComfyGotchi] Qwen returned empty caption, retry {attempt + 1}/{retries + 1}")
    return last_text

def _qwen_text_only(prompt_text, max_tokens=256):
    import torch
    model = _QWEN_STATE["model"]
    processor = _QWEN_STATE["processor"]
    tokenizer = _QWEN_STATE["tokenizer"]
    if model is None or processor is None or tokenizer is None:
        raise RuntimeError("Qwen model not loaded")
    pad_token_id = _safe_pad_token_id(tokenizer)

    conversation = [{"role": "user", "content": [{"type": "text", "text": prompt_text}]}]
    chat = processor.apply_chat_template(conversation, tokenize=False, add_generation_prompt=True)
    inputs = processor(text=chat, return_tensors="pt")
    device = next(model.parameters()).device
    inputs = {k: v.to(device) if torch.is_tensor(v) else v for k, v in inputs.items()}

    gen_kwargs = dict(
        **inputs,
        max_new_tokens=max_tokens,
        do_sample=False,
    )
    if pad_token_id is not None:
        gen_kwargs["pad_token_id"] = pad_token_id
    output = model.generate(**gen_kwargs)
    input_len = inputs["input_ids"].shape[-1]
    text = tokenizer.decode(output[0, input_len:], skip_special_tokens=True)
    return text.strip()

def caption_image(image_tensor, model_name="none (rule-based)", keep_model_loaded=True):
    if model_name == "none (rule-based)" or model_name is None:
        return _rule_based_caption(image_tensor)
    
    model_path = _get_model_path(model_name)
    if model_path is None:
        print(f"[ComfyGotchi] Qwen model '{model_name}' not found, falling back")
        return _rule_based_caption(image_tensor)
    
    try:
        _load_qwen(model_path)
        pil_image = _tensor_to_pil(image_tensor)
        caption = _qwen_generate(pil_image, "Describe this image in one short sentence.", max_tokens=64)
        if not keep_model_loaded:
            _unload_qwen()
        if not caption:
            print("[ComfyGotchi] Qwen returned empty caption after retries, using rule-based fallback")
            return _rule_based_caption(image_tensor)
        return caption
    except Exception as e:
        print(f"[ComfyGotchi] Qwen caption failed: {e}, falling back")
        try:
            _unload_qwen()
        except Exception:
            pass
        return _rule_based_caption(image_tensor)

def determine_variant(egg_captions, model_name="none (rule-based)", keep_model_loaded=True):
    variants = ["blob", "cat", "dog", "monster", "dragon", "robot", "phantom", "alien", "bunny", "penguin"]
    
    if model_name == "none (rule-based)" or model_name is None or not egg_captions:
        return "blob", ""
    
    model_path = _get_model_path(model_name)
    if model_path is None:
        return "blob", ""
    
    try:
        _load_qwen(model_path)
        captions_text = "\n".join(f"{i+1}. {c}" for i, c in enumerate(egg_captions))
        prompt = f"""You are deciding a tamagotchi creature's identity. Based on these 10 image descriptions, choose:
1. A variant from: blob, cat, dog, monster, dragon, robot, phantom, alien, bunny, penguin
2. A personality: 2-3 keywords describing the user's aesthetic

Image descriptions:
{captions_text}

Respond ONLY as JSON: {{"variant": "cat", "personality": "dark moody cinematic"}}"""
        
        response = _qwen_text_only(prompt, max_tokens=128)
        if not keep_model_loaded:
            _unload_qwen()
        
        import json as _json
        response = response.strip()
        if response.startswith("```"):
            response = response.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        try:
            result = _json.loads(response)
            variant = result.get("variant", "blob").lower().strip()
            if variant not in variants:
                variant = "blob"
            personality = result.get("personality", "").strip()
            return variant, personality
        except (_json.JSONDecodeError, KeyError):
            for v in variants:
                if v in response.lower():
                    return v, ""
            return "blob", ""
    except Exception as e:
        print(f"[ComfyGotchi] Variant determination failed: {e}")
        return "blob", ""

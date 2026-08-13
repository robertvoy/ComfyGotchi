import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import numpy as np
from vision import caption_image, detect_vision_models, _rule_based_caption

def test_rule_based_caption_dark_image():
    img = np.zeros((1, 64, 64, 3), dtype=np.float32)
    c = _rule_based_caption(img)
    assert "dark" in c.lower()

def test_rule_based_caption_bright_image():
    img = np.ones((1, 64, 64, 3), dtype=np.float32)
    c = _rule_based_caption(img)
    assert "bright" in c.lower() or "light" in c.lower()

def test_caption_image_with_none_model_returns_fallback():
    img = np.zeros((1, 64, 64, 3), dtype=np.float32)
    c = caption_image(img, "none")
    assert len(c) > 0

def test_detect_vision_models_returns_list():
    models = detect_vision_models()
    assert isinstance(models, list)

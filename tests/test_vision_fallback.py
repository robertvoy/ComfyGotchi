import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import numpy as np
from vision import caption_image, detect_qwen_models, _rule_based_caption, determine_variant

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
    c = caption_image(img, "none (rule-based)")
    assert len(c) > 0

def test_detect_qwen_models_returns_list():
    models = detect_qwen_models()
    assert isinstance(models, list)
    assert "none (rule-based)" in models

def test_determine_variant_no_model_returns_blob():
    v, p = determine_variant(["a cat", "a dog"], "none (rule-based)")
    assert v == "blob"
    assert p == ""

def test_determine_variant_empty_captions_returns_blob():
    v, p = determine_variant([], "none (rule-based)")
    assert v == "blob"

def test_determine_variant_keywords_dog():
    captions = [
        "A golden retriever sits happily on a park lawn.",
        "A golden retriever puppy on grass.",
        "A dog with a joyful expression sits outdoors.",
    ] * 4
    v, p = determine_variant(captions, "none (rule-based)")
    assert v == "dog"

def test_determine_variant_keywords_cat():
    captions = ["A fluffy orange tabby cat sits on a blanket."] * 10
    v, p = determine_variant(captions, "none (rule-based)")
    assert v == "cat"

def test_determine_variant_keywords_robot():
    captions = ["A robot with glowing eyes in a cyber city."] * 10
    v, p = determine_variant(captions, "none (rule-based)")
    assert v == "robot"

def test_determine_variant_keywords_bunny():
    captions = ["A cute bunny rabbit in a garden."] * 10
    v, p = determine_variant(captions, "none (rule-based)")
    assert v == "bunny"

def test_determine_variant_keywords_dragon():
    captions = ["A dragon with green scales and wings."] * 10
    v, p = determine_variant(captions, "none (rule-based)")
    assert v == "dragon"

def test_determine_variant_personality_nature():
    captions = ["A dog in a forest with trees and grass."] * 10
    v, p = determine_variant(captions, "none (rule-based)")
    assert v == "dog"
    assert "nature" in p

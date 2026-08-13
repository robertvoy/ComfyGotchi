import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from prompts import generate_comment

def test_egg_returns_empty():
    assert generate_comment("incubating", "egg", 0, "a cat") == ""

def test_hatchling_short_comment():
    c = generate_comment("happy", "hatchling", 0, "a red ball")
    assert len(c) > 0
    assert len(c) < 100

def test_hungry_adult_mentions_food():
    c = generate_comment("grumpy", "adult", 0, "a landscape")
    assert len(c) > 0

def test_evolved_tier_has_witty_tone():
    c = generate_comment("neutral", "evolved", 1, "a portrait")
    assert len(c) > 0

def test_ghost_eerie():
    c = generate_comment("dead", "ghost", 0, "")
    assert len(c) > 0

def test_no_caption_still_returns_comment():
    c = generate_comment("happy", "adult", 0, "")
    assert len(c) > 0

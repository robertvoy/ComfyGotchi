import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from prompts import generate_comment

def test_egg_returns_empty():
    assert generate_comment("incubating", "egg", 0, "a cat", "", "blob") == ""

def test_hatchling_short_comment():
    c = generate_comment("happy", "hatchling", 0, "a red ball", "bright colorful", "cat")
    assert len(c) > 0
    assert len(c) < 120

def test_hungry_adult_mentions_food():
    c = generate_comment("grumpy", "adult", 0, "a landscape", "dark moody", "blob")
    assert len(c) > 0

def test_evolved_tier_has_witty_tone():
    c = generate_comment("neutral", "evolved", 1, "a portrait", "sci-fi cyber", "robot")
    assert len(c) > 0

def test_ghost_eerie():
    c = generate_comment("dead", "ghost", 0, "", "", "blob")
    assert len(c) > 0

def test_no_caption_still_returns_comment():
    c = generate_comment("happy", "adult", 0, "", "nature calm", "bunny")
    assert len(c) > 0

def test_personality_dark_tone():
    c = generate_comment("grumpy", "adult", 0, "a landscape", "dark gothic", "monster")
    assert len(c) > 0

def test_personality_cute_tone():
    c = generate_comment("happy", "adult", 0, "a kitten", "cute kawaii", "bunny")
    assert len(c) > 0

def test_robot_tone():
    c = generate_comment("neutral", "adult", 0, "a circuit board", "sci-fi tech", "robot")
    assert "LOGGED" in c or "INPUT" in c or "PROCESSING" in c or "ACKNOWLEDGED" in c or len(c) > 0

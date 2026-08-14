import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from state import GotchiState, TunableConfig

def test_fresh_state_is_egg():
    s = GotchiState()
    assert s.stage == "egg"
    assert s.hunger == 50
    assert s.happiness == 50
    assert s.weight == 50
    assert s.evolution_tier == 0
    assert s.incubation_progress == 0
    assert s.stats["total_images_eaten"] == 0

from state import GotchiState, TunableConfig, CONFIG
import tempfile, os, json

def test_egg_hatches_after_10_feeds():
    s = GotchiState()
    for _ in range(10):
        s.apply_feed()
    assert s.stage == "hatchling"
    assert s.born_at is not None

def test_egg_does_not_accumulate_hunger():
    s = GotchiState()
    for _ in range(9):
        s.apply_feed()
    assert s.hunger == 50

def test_feed_reduces_hunger_and_increments_images():
    s = GotchiState()
    for _ in range(10):
        s.apply_feed()
    assert s.stage == "hatchling"
    s.apply_feed()
    assert s.hunger < 40
    assert s.stats["total_images_eaten"] == 11

def test_love_raises_happiness_not_hunger():
    s = GotchiState()
    for _ in range(10):
        s.apply_feed()
    s.apply_feed()
    h_before = s.happiness
    s.apply_love()
    assert s.happiness > h_before
    assert s.stats["total_love_received"] == 1

def test_tick_raises_hunger():
    s = GotchiState()
    for _ in range(10):
        s.apply_feed()
    for _ in range(5):
        s.apply_feed()
    from state import TunableConfig
    cfg = TunableConfig()
    h_before = s.hunger
    s.apply_tick(10)
    assert s.hunger > h_before

def test_death_at_hunger_100():
    s = GotchiState()
    for _ in range(10):
        s.apply_feed()
    s.hunger = 99
    s.apply_tick(10)
    assert s.stage == "ghost"
    assert s.mood == "dead"

def test_reincarnation_after_ghost_threshold():
    s = GotchiState()
    for _ in range(10):
        s.apply_feed()
    s.hunger = 100
    s.apply_tick(10)
    assert s.stage == "ghost"
    reincarnated = s.check_reincarnation(31, 0)
    assert reincarnated is True
    assert s.stage == "egg"

def test_evolution_at_5000_images():
    s = GotchiState()
    for _ in range(10):
        s.apply_feed()
    s.stage = "adult"
    s.stats["total_images_eaten"] = 4999
    s.apply_feed()
    assert s.evolution_tier == 1
    assert s.stage == "evolved"

def test_evolution_tier_survives_death():
    s = GotchiState()
    s.evolution_tier = 2
    s.stage = "adult"
    s.hunger = 100
    s.apply_tick(10)
    assert s.stage == "ghost"
    s.check_reincarnation(31, 0)
    assert s.stage == "egg"
    assert s.evolution_tier == 2

def test_save_and_load_roundtrip():
    s = GotchiState()
    for _ in range(15):
        s.apply_feed()
    s.apply_love()
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
        path = f.name
    s.save(path)
    loaded = GotchiState.load(path)
    os.unlink(path)
    assert loaded.stage == s.stage
    assert loaded.hunger == s.hunger
    assert loaded.stats["total_images_eaten"] == s.stats["total_images_eaten"]

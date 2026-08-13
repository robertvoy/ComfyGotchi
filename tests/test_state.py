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

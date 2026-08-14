from dataclasses import dataclass, field
from datetime import datetime, timezone
import json
import os
import tempfile

@dataclass
class TunableConfig:
    HATCH_THRESHOLD: int = 10
    N_FEEDS_GROWUP: int = 5
    EVOLUTION_THRESHOLD: int = 5000
    DELTA_FEED: float = 15.0
    DELTA_LOVE: float = 10.0
    DELTA_HUNGER_PER_MIN: float = 0.5
    DELTA_HAPPINESS_DECAY_PER_MIN: float = 0.2
    T_GHOST_MIN: int = 30
    GHOST_EVENT_THRESHOLD: int = 20
    TICK_TIMEOUT_SEC: int = 120

CONFIG = TunableConfig()

DEFAULT_STATE = {
    "stage": "egg",
    "evolution_tier": 0,
    "incubation_progress": 0,
    "hunger": 50,
    "happiness": 50,
    "weight": 50,
    "mood": "neutral",
    "born_at": None,
    "died_at": None,
    "comment_history": [],
    "last_event_at": None,
    "last_decay_at": None,
    "variant": "blob",
    "personality": "",
    "egg_captions": [],
    "variant_determined": False,
    "stats": {
        "total_images_eaten": 0,
        "images_this_life": 0,
        "total_love_received": 0,
        "generations_lived": 1,
    },
}

def _now_iso():
    return datetime.now(timezone.utc).isoformat()

class GotchiState:
    def __init__(self, data=None):
        d = DEFAULT_STATE.copy()
        d["stats"] = DEFAULT_STATE["stats"].copy()
        d["comment_history"] = list(DEFAULT_STATE["comment_history"])
        d["egg_captions"] = list(DEFAULT_STATE["egg_captions"])
        if data:
            d.update(data)
            if "stats" in data:
                merged = DEFAULT_STATE["stats"].copy()
                merged.update(data["stats"])
                d["stats"] = merged
            if "comment_history" in data:
                d["comment_history"] = list(data["comment_history"])
            if "egg_captions" in data:
                d["egg_captions"] = list(data["egg_captions"])
        for k, v in d.items():
            setattr(self, k, v)
        self._cfg = CONFIG

    def to_dict(self):
        keys = list(DEFAULT_STATE.keys())
        return {k: getattr(self, k) for k in keys}

    @classmethod
    def from_dict(cls, data):
        return cls(data)

    def derive_mood(self):
        if self.stage == "ghost":
            return "dead"
        if self.stage == "egg":
            return "incubating"
        h = self.hunger
        j = self.happiness
        if h >= 80:
            return "miserable"
        if h >= 60:
            return "grumpy"
        if j >= 80 and h < 30:
            return "ecstatic"
        if j >= 60:
            return "happy"
        return "neutral"

    def apply_feed(self):
        self.last_event_at = _now_iso()
        self.stats["total_images_eaten"] += 1
        self.stats["images_this_life"] += 1
        if self.stage == "egg":
            self.incubation_progress += 1
            if self.incubation_progress >= self._cfg.HATCH_THRESHOLD:
                self._hatch()
            self.mood = self.derive_mood()
            return
        if self.stage == "ghost":
            self.mood = self.derive_mood()
            return
        self.hunger = max(0, self.hunger - self._cfg.DELTA_FEED)
        self.happiness = min(100, self.happiness + self._cfg.DELTA_FEED * 0.3)
        self.weight = min(100, self.weight + self._cfg.DELTA_FEED * 0.2)
        self._check_evolution()
        self._check_death()
        self.mood = self.derive_mood()

    def apply_love(self):
        self.last_event_at = _now_iso()
        self.stats["total_love_received"] += 1
        if self.stage in ("egg", "ghost"):
            self.mood = self.derive_mood()
            return
        self.happiness = min(100, self.happiness + self._cfg.DELTA_LOVE)
        self.mood = self.derive_mood()

    def apply_tick(self, elapsed_minutes):
        self.last_event_at = _now_iso()
        if self.stage in ("egg", "ghost"):
            self.last_decay_at = _now_iso()
            return
        self.hunger = min(100, self.hunger + self._cfg.DELTA_HUNGER_PER_MIN * elapsed_minutes)
        self.happiness = max(0, self.happiness - self._cfg.DELTA_HAPPINESS_DECAY_PER_MIN * elapsed_minutes)
        self.last_decay_at = _now_iso()
        self._check_death()
        self.mood = self.derive_mood()

    def _hatch(self):
        self.stage = "hatchling"
        self.born_at = _now_iso()
        self.hunger = 40
        self.happiness = 60
        self.weight = 40
        self.incubation_progress = 0

    def _check_growup(self, feeds_as_hatchling):
        if self.stage == "hatchling" and feeds_as_hatchling >= self._cfg.N_FEEDS_GROWUP:
            self.stage = "adult"

    def _check_evolution(self):
        tier = self.stats["total_images_eaten"] // self._cfg.EVOLUTION_THRESHOLD
        if tier > self.evolution_tier:
            self.evolution_tier = tier
            if self.stage in ("hatchling", "adult"):
                self.stage = "evolved"

    def _check_death(self):
        if self.hunger >= 100 and self.stage != "ghost":
            self.stage = "ghost"
            self.died_at = _now_iso()
            self.mood = "dead"

    def check_reincarnation(self, ghost_minutes, ghost_events):
        if self.stage != "ghost":
            return False
        if ghost_minutes >= self._cfg.T_GHOST_MIN or ghost_events >= self._cfg.GHOST_EVENT_THRESHOLD:
            self.stage = "egg"
            self.incubation_progress = 0
            self.hunger = 50
            self.happiness = 50
            self.weight = 50
            self.died_at = None
            self.born_at = None
            self.variant = "blob"
            self.personality = ""
            self.egg_captions = []
            self.variant_determined = False
            self.stats["images_this_life"] = 0
            self.stats["generations_lived"] += 1
            self.mood = self.derive_mood()
            return True
        return False

    def save(self, path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        data = self.to_dict()
        fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), suffix=".tmp")
        try:
            with os.fdopen(fd, "w") as f:
                json.dump(data, f, indent=2)
            os.replace(tmp, path)
        except:
            try:
                os.unlink(tmp)
            except OSError:
                pass
            raise

    @classmethod
    def load(cls, path):
        if not os.path.exists(path):
            return cls()
        try:
            with open(path, "r") as f:
                data = json.load(f)
            return cls.from_dict(data)
        except (json.JSONDecodeError, IOError):
            return cls()

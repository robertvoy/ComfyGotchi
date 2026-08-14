# ComfyGotchi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Tamagotchi custom node pack for ComfyUI that eats images (via Florence2 VLM), feels love from ComfyUI partner API nodes, gets hungry over time, evolves every 5000 images, and persists across restarts and workflows.

**Architecture:** Singleton-state creature living in `state.json` on the backend, served via custom PromptServer endpoints. A passthrough IMAGE node (`ComfyGotchiNode`) runs the VLM, emits comments, and POSTs feed events. A global frontend listener detects partner API node executions and POSTs love events. Time-based hunger runs via 1-min frontend ticks. State is hybrid (backend JSON + localStorage mirror).

**Tech Stack:** Python 3.10+ (ComfyUI backend), vanilla JS (ComfyUI frontend), Florence2 VLM (via existing `comfyui-florence2` pack), pytest, ComfyUI PromptServer extension API.

## Global Constraints

- Target install path: `F:\Comfyui\ComfyUI_windows_portable_nvidia\ComfyUI\custom_nodes\comfygotchi\`
- Python ≥ 3.10, ComfyUI portable edition.
- No hard dependencies on optional packs — Florence2, QwenVL, Pixtral, JoyTag are all auto-detected and optional.
- Follow existing pack conventions: `__init__.py` with `NODE_CLASS_MAPPINGS`, `WEB_DIRECTORY`, `pyproject.toml` with `[tool.comfy-nodes]`.
- Atomic file writes via temp-file + rename for `state.json`.
- All tunable constants at top of `state.py`, exposed via node settings.
- No comments in code unless explicitly requested.
- Spec: `F:\Comfyui\ComfyUI_windows_portable_nvidia\ComfyUI\custom_nodes\comfygotchi\docs\2026-08-13-comfygotchi-design.md`

---

## File Structure

```
custom_nodes/comfygotchi/
├── __init__.py              # NODE_CLASS_MAPPINGS, WEB_DIRECTORY, pyproject shim
├── pyproject.toml           # ComfyUI-Manager compatibility
├── requirements.txt         # empty (all deps optional)
├── README.md
├── nodes.py                 # ComfyGotchiNode (passthrough + VLM + feed event)
├── state.py                 # State engine + constants + decay-on-read
├── server.py                # /comfygotchi/* endpoints + PromptServer hooks
├── vision.py                # VLM adapter + auto-detect + rule-based fallback
├── prompts.py               # Mood/stage/tier one-liner templates
├── state.json               # created on first run (gitignored)
├── web/
│   ├── comfygotchi.js       # Node frontend, canvas widget, tick sender
│   ├── listener.js          # Global executed-event listener (love events)
│   └── sprites/
│       └── .gitkeep
└── tests/
    ├── __init__.py
    ├── test_state.py
    └── test_vision_fallback.py
```

---

### Task 1: Scaffold pack structure and metadata

**Files:**
- Create: `__init__.py`
- Create: `pyproject.toml`
- Create: `requirements.txt`
- Create: `README.md`
- Create: `web/sprites/.gitkeep`
- Create: `tests/__init__.py`

**Interfaces:**
- Produces: a loadable ComfyUI custom node pack (empty mappings) that ComfyUI-Manager can see.

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p web/sprites tests
```

- [ ] **Step 2: Write `__init__.py`**

```python
from .nodes import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS

WEB_DIRECTORY = "./web"
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
```

- [ ] **Step 3: Write `pyproject.toml`**

```toml
[project]
name = "comfygotchi"
version = "0.1.0"
description = "A Tamagotchi that lives inside ComfyUI — eats images, feels love from API nodes, evolves."
authors = [
    { name = "ComfyGotchi" }
]
requires-python = ">=3.10"
readme = "README.md"
license = { text = "MIT" }
dependencies = []

[project.optional-dependencies]
dev = [
    "pytest",
    "pillow",
    "numpy"
]

[tool.comfy-nodes]
publisher = "@comfygotchi"
```

- [ ] **Step 4: Write `requirements.txt`**

```
# No hard dependencies. Florence2/QwenVL/Pixtral/JoyTag are auto-detected if installed.
```

- [ ] **Step 5: Write `README.md`**

```markdown
# ComfyGotchi

A Tamagotchi that lives inside ComfyUI.

- **Feeds on images** — pipe an IMAGE through the ComfyGotchiNode and Florence2 (or another local VLM) generates a comment while the creature eats.
- **Feels love** — when a ComfyUI partner API node (`is_api_node=True`) executes, the creature's happiness rises.
- **Gets hungry over time** — hunger rises passively while the UI is open.
- **Evolves** — after every 5000 images eaten cumulatively, the creature mutates into a new form.
- **Persists** — state survives restarts and is shared across all workflows.

## Installation

Drop this folder into `custom_nodes/` and restart ComfyUI.

## Usage

```
KSampler → VAE Decode → ComfyGotchiNode → Save Image
```

Wire the `comment` STRING output to a Display Text or Save node to see the creature's remarks.
```

- [ ] **Step 6: Write `tests/__init__.py`** (empty file)

- [ ] **Step 7: Write `web/sprites/.gitkeep`** (empty file)

- [ ] **Step 8: Verify ComfyUI can discover the pack (dry import)**

Run:
```bash
cd F:\Comfyui\ComfyUI_windows_portable_nvidia\ComfyUI
python_embeded\python.exe -c "import sys; sys.path.insert(0, 'custom_nodes'); import comfygotchi; print(comfygotchi.NODE_CLASS_MAPPINGS)"
```
Expected: prints `{}` (empty — nodes.py doesn't exist yet, but the pack structure is valid). If it fails with `ModuleNotFoundError: No module named 'comfygotchi.nodes'`, that's expected — we create `nodes.py` in Task 6. The important thing is that the folder is discovered.

- [ ] **Step 9: Commit**

```bash
cd F:\Comfyui\ComfyUI_windows_portable_nvidia\ComfyUI\custom_nodes\comfygotchi
git init
git add -A
git commit -m "scaffold: comfygotchi pack structure"
```

---

### Task 2: State engine — constants and data model

**Files:**
- Create: `state.py`
- Test: `tests/test_state.py`

**Interfaces:**
- Produces: `DEFAULT_STATE` (dict), `TunableConfig` (dataclass with all constants), `GotchiState` class with `to_dict()`, `from_dict()`, `apply_feed()`, `apply_love()`, `apply_tick()`, `derive_mood()`, `check_transitions()`.

- [ ] **Step 1: Write the failing test for state creation and defaults**

```python
# tests/test_state.py
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python_embeded\python.exe -m pytest tests/test_state.py::test_fresh_state_is_egg -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'state'`

- [ ] **Step 3: Write minimal `state.py` with constants, dataclass, and GotchiState**

```python
# state.py
from dataclasses import dataclass, field
from datetime import datetime, timezone
import json
import os
import tempfile

@dataclass
class TunableConfig:
    HATCH_THRESHOLD: int = 20
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
        if data:
            d.update(data)
            d.setdefault("stats", {}).update(DEFAULT_STATE["stats"].copy())
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
            self.stats["images_this_life"] = 0
            self.stats["generations_lived"] += 1
            self.mood = self.derive_mood()
            return True
        return False
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python_embeded\python.exe -m pytest tests/test_state.py::test_fresh_state_is_egg -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add state.py tests/test_state.py
git commit -m "feat: state engine with constants and data model"
```

---

### Task 3: State engine — transitions and persistence

**Files:**
- Modify: `state.py` (add persistence methods)
- Modify: `tests/test_state.py` (add transition tests)

**Interfaces:**
- Produces: `GotchiState.save(path)`, `GotchiState.load(path)`, atomic write logic.
- Consumes: `GotchiState` from Task 2.

- [ ] **Step 1: Write failing tests for transitions and persistence**

Append to `tests/test_state.py`:

```python
from state import GotchiState, TunableConfig, CONFIG
import tempfile, os, json

def test_egg_hatches_after_20_feeds():
    s = GotchiState()
    for _ in range(20):
        s.apply_feed()
    assert s.stage == "hatchling"
    assert s.born_at is not None

def test_egg_does_not_accumulate_hunger():
    s = GotchiState()
    for _ in range(10):
        s.apply_feed()
    assert s.hunger == 50

def test_feed_reduces_hunger_and_increments_images():
    s = GotchiState()
    for _ in range(20):
        s.apply_feed()
    assert s.stage == "hatchling"
    s.apply_feed()
    assert s.hunger < 40
    assert s.stats["total_images_eaten"] == 21

def test_love_raises_happiness_not_hunger():
    s = GotchiState()
    for _ in range(20):
        s.apply_feed()
    s.apply_feed()
    h_before = s.happiness
    s.apply_love()
    assert s.happiness > h_before
    assert s.stats["total_love_received"] == 1

def test_tick_raises_hunger():
    s = GotchiState()
    for _ in range(20):
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
    for _ in range(20):
        s.apply_feed()
    s.hunger = 99
    s.apply_tick(10)
    assert s.stage == "ghost"
    assert s.mood == "dead"

def test_reincarnation_after_ghost_threshold():
    s = GotchiState()
    for _ in range(20):
        s.apply_feed()
    s.hunger = 100
    s.apply_tick(10)
    assert s.stage == "ghost"
    reincarnated = s.check_reincarnation(31, 0)
    assert reincarnated is True
    assert s.stage == "egg"

def test_evolution_at_5000_images():
    s = GotchiState()
    for _ in range(20):
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
    for _ in range(25):
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python_embeded\python.exe -m pytest tests/test_state.py -v`
Expected: FAIL — `save` and `load` methods don't exist yet; other tests should pass already.

- [ ] **Step 3: Add persistence methods to `state.py`**

Append to the `GotchiState` class in `state.py`:

```python
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python_embeded\python.exe -m pytest tests/test_state.py -v`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add state.py tests/test_state.py
git commit -m "feat: state transitions, evolution, death, persistence"
```

---

### Task 4: Persona prompts — mood/stage/tier one-liners

**Files:**
- Create: `prompts.py`
- Test: `tests/test_prompts.py` (create)

**Interfaces:**
- Produces: `generate_comment(mood, stage, evolution_tier, caption) -> str`
- Consumes: nothing (pure module).

- [ ] **Step 1: Write failing test**

```python
# tests/test_prompts.py
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python_embeded\python.exe -m pytest tests/test_prompts.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Write `prompts.py`**

```python
import random

TEMPLATES = {
    "egg": [],
    "hatchling": {
        "ecstatic": ["ooooh! {c}!!", "yayyy a {c}!", "*squeak* {c}!"],
        "happy": ["ooh shiny! a {c}!", "i like this {c}!", "*happy wiggle*"],
        "neutral": ["um, {c}?", "is that a {c}?", "okay, {c}."],
        "grumpy": ["hmph. {c} again?", "not enough. {c}.", "*pout*"],
        "miserable": ["so hungry... {c}...", "{c}... not enough...", "*whimper*"],
    },
    "adult": {
        "ecstatic": ["Finally, a proper {c}! *chef's kiss*", "Oh YES. {c}. Exactly what I needed.", "This {c}? Perfection."],
        "happy": ["Nice {c}. I'll take it.", "Not bad — a {c}. Decent meal.", "Mmm, {c}. Thank you."],
        "neutral": ["{c}. Sure.", "Another {c}. Okay.", "{c}. It's fine."],
        "grumpy": ["Is that it? A {c}? I'm starving.", "{c}... you call that food?", "*sigh* {c}. Again."],
        "miserable": ["I can't go on... {c}...", "{c}... too little... too late...", "*stares weakly at the {c}*"],
    },
    "evolved": {
        "ecstatic": ["After 5000 meals, I can say: this {c} is exquisite.", "Ah, a {c}. My evolved palate approves.", "Centuries of eating and still — {c} delights."],
        "happy": ["A {c}. Acceptable. I've eaten worse across eons.", "Mmm. {c}. My evolved form thanks you.", "{c}. Not bad for a mortal creation."],
        "neutral": ["{c}. I've seen thousands of these.", "Another {c}. The cycle continues.", "{c}. Yes."],
        "grumpy": ["You bring me a {c}? After all I've become?", "I evolved for THIS? A {c}?", "*cosmic sigh* {c}."],
        "miserable": ["Even in evolved form... hunger hurts. {c}...", "{c}... the void grows...", "*ancient stomach rumbles at the {c}*"],
    },
    "ghost": {
        "dead": ["...", "boo.", "*floats silently*", "i was once alive...", "the {c} means nothing now..."],
    },
}

FALLBACK_NO_CAPTION = {
    "egg": "",
    "hatchling": ["ooh!", "*chomp*", "yum!", "*happy noise*"],
    "adult": ["Not bad.", "Could be worse.", "Alright.", "Mhm."],
    "evolved": ["Acceptable.", "As expected.", "Hmm. Yes.", "Adequate."],
    "ghost": ["...", "boo.", "*floats*"],
}

def generate_comment(mood, stage, evolution_tier, caption):
    if stage == "egg":
        return ""
    if stage == "ghost":
        return random.choice(TEMPLATES["ghost"]["dead"])
    stage_key = "evolved" if stage == "evolved" else stage
    if stage_key not in TEMPLATES:
        stage_key = "adult"
    pool = TEMPLATES[stage_key].get(mood, TEMPLATES[stage_key]["neutral"])
    c = caption.strip() if caption else ""
    if c:
        c = c[:60]
        return random.choice(pool).format(c=c)
    fb = FALLBACK_NO_CAPTION.get(stage_key, FALLBACK_NO_CAPTION["adult"])
    return random.choice(fb)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python_embeded\python.exe -m pytest tests/test_prompts.py -v`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add prompts.py tests/test_prompts.py
git commit -m "feat: persona prompt templates for comments"
```

---

### Task 5: Vision adapter — Florence2 integration + rule-based fallback

**Files:**
- Create: `vision.py`
- Test: `tests/test_vision_fallback.py`

**Interfaces:**
- Produces: `detect_vision_models() -> list[str]`, `caption_image(image_tensor, model_name) -> str`
- Consumes: Florence2 model loader from `comfyui-florence2` pack (optional).

- [ ] **Step 1: Write failing test for fallback path**

```python
# tests/test_vision_fallback.py
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python_embeded\python.exe -m pytest tests/test_vision_fallback.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Write `vision.py`**

```python
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
    pil_mask, pil_image, caption, data = runner.encode(
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python_embeded\python.exe -m pytest tests/test_vision_fallback.py -v`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add vision.py tests/test_vision_fallback.py
git commit -m "feat: vision adapter with Florence2 and rule-based fallback"
```

---

### Task 6: Backend server — endpoints and state management

**Files:**
- Create: `server.py`
- Modify: `__init__.py` (add server import)

**Interfaces:**
- Produces: `init_server(server_instance)` that registers `/comfygotchi/state`, `/comfygotchi/event`, `/comfygotchi/save` on the ComfyUI PromptServer.
- Consumes: `GotchiState` from Task 2, `TunableConfig` from Task 2.

- [ ] **Step 1: Write `server.py`**

```python
import os
import json
import threading
from datetime import datetime, timezone

from .state import GotchiState, CONFIG

STATE_FILE = os.path.join(os.path.dirname(__file__), "state.json")
_lock = threading.Lock()
_state = None

def _get_state():
    global _state
    if _state is None:
        _state = GotchiState.load(STATE_FILE)
    return _state

def _save_state():
    s = _get_state()
    s.save(STATE_FILE)

def _now():
    return datetime.now(timezone.utc)

def _apply_decay_on_read():
    s = _get_state()
    if s.last_decay_at and s.stage not in ("egg", "ghost"):
        try:
            last = datetime.fromisoformat(s.last_decay_at)
            elapsed = (_now() - last).total_seconds() / 60.0
            if elapsed > 0 and elapsed < (CONFIG.TICK_TIMEOUT_SEC / 60.0 + 5):
                s.apply_tick(elapsed)
            else:
                s.last_decay_at = _now().isoformat()
        except (ValueError, TypeError):
            s.last_decay_at = _now().isoformat()
    elif not s.last_decay_at:
        s.last_decay_at = _now().isoformat()
    _save_state()
    return s

def init_server(server_instance):
    from server import PromptServer
    from aiohttp import web

    @server_instance.routes.get("/comfygotchi/state")
    async def get_state(request):
        with _lock:
            s = _apply_decay_on_read()
            return web.json_response(s.to_dict())

    @server_instance.routes.post("/comfygotchi/event")
    async def post_event(request):
        body = await request.json()
        event_type = body.get("type", "")
        caption = body.get("caption", "")
        with _lock:
            s = _get_state()
            if event_type == "feed":
                s.apply_feed()
            elif event_type == "love":
                s.apply_love()
            elif event_type == "tick":
                elapsed = body.get("elapsed_minutes", 1.0)
                s.apply_tick(elapsed)
            elif event_type == "ghost_tick":
                ghost_min = body.get("ghost_minutes", 0)
                ghost_ev = body.get("ghost_events", 0)
                s.check_reincarnation(ghost_min, ghost_ev)
            s.last_event_at = _now().isoformat()
            _save_state()
            return web.json_response(s.to_dict())

    @server_instance.routes.post("/comfygotchi/save")
    async def post_save(request):
        with _lock:
            _save_state()
            return web.json_response({"ok": True})

    @server_instance.routes.get("/comfygotchi/config")
    async def get_config(request):
        return web.json_response({
            "HATCH_THRESHOLD": CONFIG.HATCH_THRESHOLD,
            "EVOLUTION_THRESHOLD": CONFIG.EVOLUTION_THRESHOLD,
            "DELTA_FEED": CONFIG.DELTA_FEED,
            "DELTA_LOVE": CONFIG.DELTA_LOVE,
            "DELTA_HUNGER_PER_MIN": CONFIG.DELTA_HUNGER_PER_MIN,
        })

try:
    from server import PromptServer
    SERVER = PromptServer.instance
    init_server(SERVER)
except Exception as e:
    print(f"[ComfyGotchi] Could not register server routes: {e}")
```

- [ ] **Step 2: Update `__init__.py` to import server and nodes**

```python
from .nodes import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS

try:
    from . import server
except Exception as e:
    print(f"[ComfyGotchi] Server init failed: {e}")

WEB_DIRECTORY = "./web"
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
```

- [ ] **Step 3: Commit**

```bash
git add server.py __init__.py
git commit -m "feat: backend server endpoints for state and events"
```

---

### Task 7: ComfyGotchiNode — passthrough + VLM + comment

**Files:**
- Create: `nodes.py`
- Test: manual (node requires ComfyUI runtime)

**Interfaces:**
- Produces: `ComfyGotchiNode` class with `INPUT_TYPES`, `RETURN_TYPES = ("IMAGE", "STRING")`, `FUNCTION = "process"`.
- Consumes: `vision.py` caption_image, `prompts.py` generate_comment, `server.py` POST endpoints.

- [ ] **Step 1: Write `nodes.py`**

```python
import os
import json
import urllib.request

from .vision import detect_vision_models, caption_image, _rule_based_caption
from .prompts import generate_comment
from .state import GotchiState, CONFIG

_STATE_PATH = os.path.join(os.path.dirname(__file__), "state.json")

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

class ComfyGotchiNode:
    @classmethod
    def INPUT_TYPES(s):
        models = detect_vision_models()
        return {
            "required": {
                "image": ("IMAGE",),
                "vision_model": (models, {"default": models[0]}),
            },
            "optional": {
                "florence2_model": ("FL2MODEL",),
            },
        }

    RETURN_TYPES = ("IMAGE", "STRING")
    RETURN_NAMES = ("image", "comment")
    FUNCTION = "process"
    CATEGORY = "ComfyGotchi"

    def process(self, image, vision_model="none", florence2_model=None):
        caption = caption_image(image, vision_model, florence2_model)
        state_dict = _get_state_dict()
        if state_dict is None:
            mood = "neutral"
            stage = "adult"
            tier = 0
        else:
            mood = state_dict.get("mood", "neutral")
            stage = state_dict.get("stage", "egg")
            tier = state_dict.get("evolution_tier", 0)
        comment = generate_comment(mood, stage, tier, caption)
        _post_event("feed", caption)
        return (image, comment)

NODE_CLASS_MAPPINGS = {
    "ComfyGotchiNode": ComfyGotchiNode,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "ComfyGotchiNode": "ComfyGotchi",
}
```

- [ ] **Step 2: Verify dry import**

Run:
```bash
cd F:\Comfyui\ComfyUI_windows_portable_nvidia\ComfyUI
python_embeded\python.exe -c "import sys; sys.path.insert(0, 'custom_nodes'); import comfygotchi; print(comfygotchi.NODE_CLASS_MAPPINGS)"
```
Expected: prints `{'ComfyGotchiNode': <class 'comfygotchi.nodes.ComfyGotchiNode'>}`

- [ ] **Step 3: Commit**

```bash
git add nodes.py
git commit -m "feat: ComfyGotchiNode passthrough with VLM caption and comment"
```

---

### Task 8: Frontend — canvas widget and tick sender

**Files:**
- Create: `web/comfygotchi.js`

**Interfaces:**
- Produces: ComfyUI frontend extension that registers the node widget, renders canvas, polls state every 2s, sends tick events every 60s.
- Consumes: `/comfygotchi/state`, `/comfygotchi/event` endpoints.

- [ ] **Step 1: Write `web/comfygotchi.js`**

```javascript
import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const TICK_INTERVAL_MS = 60000;
const POLL_INTERVAL_MS = 2000;
const SPRITE_SIZE = 128;

const STAGE_COLORS = {
  egg: "#d4a574",
  hatchling: "#7ec8e3",
  adult: "#5cb85c",
  evolved: "#9b59b6",
  ghost: "#aaaaaa",
};

let lastState = null;
let lastTickSent = 0;

async function fetchState() {
  try {
    const r = await fetch("/comfygotchi/state");
    lastState = await r.json();
    return lastState;
  } catch (e) {
    console.warn("[ComfyGotchi] fetchState failed", e);
    return null;
  }
}

async function sendTick() {
  const now = Date.now();
  if (now - lastTickSent < TICK_INTERVAL_MS - 1000) return;
  lastTickSent = now;
  try {
    await fetch("/comfygotchi/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "tick", elapsed_minutes: 1 }),
    });
  } catch (e) {
    console.warn("[ComfyGotchi] tick failed", e);
  }
}

function drawCreature(ctx, state) {
  ctx.clearRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  if (!state) {
    ctx.fillStyle = "#333";
    ctx.font = "12px sans-serif";
    ctx.fillText("loading...", 30, 64);
    return;
  }
  const cx = SPRITE_SIZE / 2;
  const cy = SPRITE_SIZE / 2;
  const color = STAGE_COLORS[state.stage] || "#5cb85c";
  const weightScale = 0.7 + (state.weight / 100) * 0.6;
  const radiusX = 30 * weightScale;
  const radiusY = 28;

  if (state.stage === "ghost") {
    ctx.globalAlpha = 0.5 + Math.sin(Date.now() / 500) * 0.2;
  }

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(cx, cy, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.fill();

  if (state.stage === "egg") {
    ctx.strokeStyle = "#8B5E3C";
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(cx - 10 + i * 10, cy - 5, 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    const prog = state.incubation_progress / 20;
    if (prog > 0.75) {
      ctx.strokeStyle = "#ff4444";
      ctx.beginPath();
      ctx.moveTo(cx - 15, cy);
      ctx.lineTo(cx - 5, cy + 5);
      ctx.lineTo(cx + 5, cy - 3);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(cx - 10, cy - 5, 5, 0, Math.PI * 2);
    ctx.arc(cx + 10, cy - 5, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#000";
    const mood = state.mood || "neutral";
    let eyeY = cy - 5;
    if (mood === "miserable" || mood === "grumpy") eyeY = cy - 3;
    ctx.beginPath();
    ctx.arc(cx - 10, eyeY, 2, 0, Math.PI * 2);
    ctx.arc(cx + 10, eyeY, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (mood === "ecstatic" || mood === "happy") {
      ctx.arc(cx, cy + 8, 6, 0, Math.PI);
    } else if (mood === "miserable") {
      ctx.arc(cx, cy + 15, 6, Math.PI, Math.PI * 2);
    } else {
      ctx.moveTo(cx - 5, cy + 10);
      ctx.lineTo(cx + 5, cy + 10);
    }
    ctx.stroke();
  }

  if (state.stage !== "egg" && state.stage !== "ghost") {
    ctx.fillStyle = "#ff5555";
    ctx.font = "10px sans-serif";
    const hungerBar = `H:${Math.round(state.hunger)}`;
    const happyBar = `J:${Math.round(state.happiness)}`;
    ctx.fillText(hungerBar, 5, 12);
    ctx.fillText(happyBar, 5, 24);
    ctx.fillText(`🍱${state.stats?.total_images_eaten || 0}`, 5, 120);
    if (state.evolution_tier > 0) {
      ctx.fillStyle = "#9b59b6";
      ctx.fillText(`T${state.evolution_tier}`, 100, 12);
    }
  }
  ctx.globalAlpha = 1.0;
}

app.registerExtension({
  name: "comfygotchi",
  async nodeCreated(node) {
    if (node.comfyClass !== "ComfyGotchiNode") return;
    const widget = {
      type: "comfygotchi_canvas",
      name: "canvas",
      draw(nodeCtx, x, y, w, h) {
        const canvas = document.createElement("canvas");
        drawCreature(canvas.getContext("2d"), lastState);
        nodeCtx.drawImage(canvas, x, y, w, h);
      },
    };
    node.addWidget("comfygotchi_canvas", "canvas", "", widget);
  },
  async setup() {
    await fetchState();
    setInterval(fetchState, POLL_INTERVAL_MS);
    setInterval(sendTick, TICK_INTERVAL_MS);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        fetchState();
        sendTick();
      }
    });
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add web/comfygotchi.js
git commit -m "feat: frontend canvas widget, state polling, tick sender"
```

---

### Task 9: Frontend — global listener for love events

**Files:**
- Create: `web/listener.js`

**Interfaces:**
- Produces: extension that listens to `api.addEventListener("executed", ...)` and POSTs `love` events when `node_def.api_node === true`.

- [ ] **Step 1: Write `web/listener.js`**

```javascript
import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

async function sendLove() {
  try {
    await fetch("/comfygotchi/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "love" }),
    });
  } catch (e) {
    console.warn("[ComfyGotchi] love event failed", e);
  }
}

function isApiNode(nodeType) {
  if (!nodeType) return false;
  const defs = window.comfyAPI?.nodeDefs || {};
  const def = defs[nodeType];
  if (def && def.api_node === true) return true;
  if (def && def.python_module && def.python_module.startsWith("comfy_api_nodes")) return true;
  return false;
}

app.registerExtension({
  name: "comfygotchi_listener",
  async setup() {
    api.addEventListener("executed", (evt) => {
      const detail = evt.detail || {};
      const nodeType = detail.class_type || detail.type || detail.node_type;
      if (isApiNode(nodeType)) {
        sendLove();
      }
    });
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add web/listener.js
git commit -m "feat: global listener for partner API node love events"
```

---

### Task 10: Smoke test and final integration

**Files:**
- No new files.

- [ ] **Step 1: Run full test suite**

Run:
```bash
cd F:\Comfyui\ComfyUI_windows_portable_nvidia\ComfyUI\custom_nodes\comfygotchi
..\..\python_embeded\python.exe -m pytest tests/ -v
```
Expected: all tests PASS.

- [ ] **Step 2: Start ComfyUI and verify pack loads**

Run ComfyUI normally. Check the console for `[ComfyGotchi]` messages. Open the node menu and search for "ComfyGotchi" — the node should appear.

- [ ] **Step 3: Build a minimal test workflow**

```
Load Checkpoint → CLIP Text Encode (prompt) → KSampler → VAE Decode → ComfyGotchiNode → Save Image
```
Wire the `comment` output to a "Show Text" node. Run the workflow 20 times to hatch the egg. Verify:
- Egg counter increments.
- After 20 runs, egg hatches to hatchling.
- Comments appear on the STRING output.

- [ ] **Step 4: Test love events**

Add a ComfyUI partner API node (e.g. any node from `comfy_api_nodes/`) to any workflow. Execute it. Verify the creature's happiness rises (check via `/comfygotchi/state` in a browser).

- [ ] **Step 5: Test time-based hunger**

Leave ComfyUI open for a few minutes without activity. Check `/comfygotchi/state` — hunger should be slowly rising.

- [ ] **Step 6: Test persistence**

Close ComfyUI. Reopen. The creature should have the same state. Check `/comfygotchi/state`.

- [ ] **Step 7: Test cross-workflow singleton**

Open a new workflow. Drop a `ComfyGotchiNode` in it. It should show the same creature with the same stats as the other workflow.

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "chore: final integration smoke test complete"
```

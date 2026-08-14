# ComfyGotchi — Design Spec

**Date:** 2026-08-13 (rev. 2)
**Target install:** `F:\Comfyui\ComfyUI_windows_portable_nvidia\ComfyUI\custom_nodes\comfygotchi\`

## 1. Overview

ComfyGotchi is a Tamagotchi that lives inside ComfyUI. It eats **images**,
feels **love** when ComfyUI's monetized partner API nodes run, gets **hungry
over time**, comments lightly on every image it sees, and evolves after
consuming enough images. Its state persists across restarts and workflows.

**Core loop:**
- An image flows through the `ComfyGotchiNode` → the creature **eats** it:
  hunger drops. The Florence2 VLM looks at the image and the creature
  comments on it.
- A ComfyUI partner API node (`is_api_node=True`) executes anywhere in
  ComfyUI → the creature receives **love**: happiness rises.
- Time passes (UI open) → the creature gets **hungrier**: hunger rises
  toward 100.
- Hunger reaches 100 → the creature dies, becomes a ghost, and eventually
  reincarnates as an egg.
- After 5000 images eaten cumulatively → the creature **mutates** into a new
  evolved form.

**Lifecycle:** Egg → (20 images) → Hatchling → Adult → (5000 images) →
Evolved → (death) → Ghost → (reincarnate) → Egg.

## 2. Three Mechanics

### 2.1 Feeding (images via Florence2 VLM)

The `ComfyGotchiNode` is a passthrough IMAGE node. Every time an image
flows through it, the creature eats:

1. The image is passed to Florence2 (or another installed local VLM) which
   produces a lightweight caption.
2. A mood-flavored comment is generated from the caption.
3. The creature's `hunger` drops by `Δ_feed`, `weight` rises slightly,
   `stats.total_images_eaten += 1`.
4. The comment is emitted as a `STRING` output and stored in history.

This is the **only** thing that reduces hunger.

### 2.2 Love (ComfyUI partner API nodes)

ComfyUI marks its monetized partner API nodes with `is_api_node=True` in the
node definition. The global frontend listener reads the registered node
definition at runtime and checks the `api_node` flag.

- `api_node === true` → **love** event → `happiness += Δ_love`
- otherwise → no direct stat effect (the creature doesn't care about local
  compute).

This works with all built-in partner node files (Anthropic, BFL, Bytedance,
ElevenLabs, Gemini, Grok, HeyGen, Ideogram, Kling, Krea, Luma, Magnific,
Meshy, Minimax, OpenAI, OpenRouter, Pixverse, Recraft, Reve, Rodin, Runway,
Sonilo, Sora, Sync.so, Topaz, Tripo, Veo2, Vidu, Wan, Wavespeed, …) and
auto-includes any future partner nodes ComfyUI adds. No hardcoded whitelist
to maintain.

### 2.3 Hunger (time-based)

Hunger rises passively over real time while the ComfyUI UI is open. There is
no "work" event that raises hunger — only time. The decay is sampled once
per minute while the page is open:

```
hunger += Δ_hunger_per_min
happiness -= Δ_happiness_decay_per_min   (gentle)
```

If the UI is closed, decay pauses (no background starvation). On reopen,
the creature resumes from its last persisted state.

## 3. Architecture

### 3.1 Components

| Component | Location | Responsibility |
|-----------|----------|----------------|
| `ComfyGotchiNode` | `nodes.py` | Passthrough IMAGE node. Runs the VLM on each passing image, emits a comment as STRING, POSTs a `feed` event with the caption to the backend. Holds the canvas widget. |
| Global listener | `web/listener.js` | Listens to `api.addEventListener("executed", ...)`. If `node_def.api_node === true`, POSTs a `love` event. Runs once per page load, not per node. |
| State engine | `state.py` | Pure-Python state model: stages, stats, transitions, time-decay, death, evolution, reincarnation. |
| Backend endpoints | `server.py` | `GET /comfygotchi/state`, `POST /comfygotchi/event`, `POST /comfygotchi/save`. Source of truth. Applies decay on read. |
| Vision adapter | `vision.py` | Loads an installed local VLM (Florence2 default, QwenVL / Pixtral / JoyTag fallbacks), returns a caption. Graceful fallback to image-stat heuristics if no model is available. |
| Persona prompts | `prompts.py` | Mood/stage-indexed templates that turn a caption into a short creature comment. |
| Frontend widget | `web/comfygotchi.js` | Canvas sprite rendering, idle/eating/loved/sleeping/hatching/dying/evolving animations, state sync, 1-min decay poll. |
| Sprites | `web/sprites/` | Pixel-art sprite sheets per stage and evolution tier. |

### 3.2 Data flow

```
Image pipeline:
KSampler → VAE Decode → ComfyGotchiNode ──▶ Save Image
                              │
                              ▼
                    vision.py (Florence2)
                              │ caption
                              ▼
                    prompts.py (mood persona)
                              │
                              ▼
                    STRING (comment) + POST /comfygotchi/event {type: feed, caption}

Partner API node (anywhere in ComfyUI):
node executes → listener.js → POST /comfygotchi/event {type: love}

Time (UI open):
every 60s → frontend → POST /comfygotchi/event {type: tick}

All events:
  POST /comfygotchi/event → state.py updates state.json → push to all open tabs
```

### 3.3 Singleton state

There is exactly **one** creature per ComfyUI install. State lives in
`custom_nodes/comfygotchi/state.json` on the backend. Every
`ComfyGotchiNode` instance — in any workflow, open or closed — reads from
and writes to that same file via the backend endpoints. Opening a new
workflow and dropping a `ComfyGotchiNode` into it immediately shows the
current creature with its current stats.

## 4. State Model

Stored as JSON in `state.json`. Fields:

```json
{
  "stage": "egg",                 // egg | hatchling | adult | evolved | ghost
  "evolution_tier": 0,            // 0 = base, increments at each 5000-image mutation
  "incubation_progress": 0,       // 0–20 images fed (egg only)
  "hunger": 50,                   // 0–100, 100 = starving
  "happiness": 50,                // 0–100
  "weight": 50,                   // 0–100, drives sprite scale
  "mood": "neutral",              // derived from hunger+happiness+stage
  "born_at": "2026-08-13T…",      // ISO timestamp of hatch
  "died_at": null,                // ISO timestamp of death
  "comment_history": [],          // last N=50 comments
  "last_event_at": "2026-08-13T…",
  "last_decay_at": "2026-08-13T…",// for time-based hunger calc on read
  "stats": {
    "total_images_eaten": 0,      // cumulative across all lives — drives evolution
    "images_this_life": 0,        // resets on reincarnation
    "total_love_received": 0,
    "generations_lived": 1
  }
}
```

### 4.1 Transitions

**Egg stage:**
- Each image fed (`feed` event) increments `incubation_progress += 1`.
- No hunger/decay during egg stage (it's an egg).
- At `incubation_progress >= 20` → hatch: `stage = "hatchling"`,
  `born_at = now()`, reset hunger/happiness/weight to hatchling defaults,
  `stats.images_this_life` continues counting.
- The egg does not comment (it's an egg). It does wobble when fed.

**Hatchling → Adult:**
- After `N_FEEDS_GROWUP` (default 5) images eaten as a hatchling →
  `stage = "adult"`.

**Adult (main loop):**
- `feed` event (image through node):
  `hunger -= Δ_feed`, `happiness += Δ_feed * 0.3`, `weight += Δ_feed * 0.2`,
  `stats.total_images_eaten += 1`, `stats.images_this_life += 1`.
  All clamped to [0,100].
- `love` event (partner API node):
  `happiness += Δ_love`, `stats.total_love_received += 1`.
  Does not affect hunger or weight.
- `tick` event (1/min while UI open):
  `hunger += Δ_hunger_per_min`, `happiness -= Δ_happiness_decay_per_min`.
  Paused while UI closed.
- `mood` derived from hunger+happiness banding.

**Evolution (mutation at 5000 images):**
- When `stats.total_images_eaten` crosses each multiple of 5000 →
  `evolution_tier += 1`, `stage = "evolved"`.
- Evolution is a permanent tier; the sprite changes form (new sprite sheet
  per tier). Stat caps and deltas may widen slightly per tier (the creature
  gets hardier as it evolves).
- Evolution tier survives death/reincarnation — it is a cumulative
  achievement, not reset on death.
- If the creature dies and reincarnates, it hatches from a new egg but
  retains its `evolution_tier` (the egg looks fancier at higher tiers,
  and the hatched creature is born at the evolved form).

**Death:**
- If `hunger >= 100` → `stage = "ghost"`, `died_at = now()`,
  `mood = "dead"`.
- Ghost does not eat or feel love; it floats.

**Reincarnation:**
- After `T_ghost` (default 30 min real time, or 20 events of any kind) →
  `stage = "egg"`, `incubation_progress = 0`, reset hunger/happiness/weight,
  `stats.images_this_life = 0`, `stats.generations_lived += 1`.
  `evolution_tier` is preserved.

### 4.2 Tunable constants

All constants live at the top of `state.py` and are exposed via the node's
settings panel:

| Constant | Default | Meaning |
|----------|---------|---------|
| `HATCH_THRESHOLD` | 20 | Images to hatch from egg |
| `N_FEEDS_GROWUP` | 5 | Images to grow hatchling → adult |
| `EVOLUTION_THRESHOLD` | 5000 | Images per evolution tier |
| `Δ_feed` | 15 | Hunger reduced per image fed |
| `Δ_love` | 10 | Happiness gained per partner-API execution |
| `Δ_hunger_per_min` | 0.5 | Hunger gained per minute (UI open) |
| `Δ_happiness_decay_per_min` | 0.2 | Happiness lost per minute |
| `T_ghost` | 30 min | Ghost duration before reincarnation |

## 5. Vision Commentary

### 5.1 Model selection

The `ComfyGotchiNode` exposes a `vision_model` dropdown populated at startup
by probing for installed local VLM packs:

| Pack | Model | Output |
|------|-------|--------|
| `comfyui-florence2` | Florence2 | Rich caption (default) |
| `ComfyUI-QwenVL` | Qwen-VL | Caption, multilingual |
| `ComfyUI_pixtral_vision` | Pixtral | Caption |
| `Comfyui_joytag` | JoyTag | Tags only (lightweight) |

If none are installed, the dropdown shows "None (rule-based)" and the node
falls back to image-stat heuristics (brightness, dominant color, saturation)
to pick from mood-weighted template pools.

### 5.2 Comment generation

Comments are intentionally **light** — one short line, not paragraphs.

1. VLM returns a caption (or tags, or stats in fallback mode).
2. `prompts.py` selects a one-liner template by current `mood`, `stage`,
   and `evolution_tier`:
   - Egg: no comments (it's an egg). Wobble only.
   - Hatchling: short, childlike, easily amused ("ooh! shiny!").
   - Adult + sated/happy: warm, approving ("finally, a decent meal").
   - Adult + hungry: snarky, food-obsessed ("is that it?").
   - Adult + loved: smitten, giddy ("someone really cares about me…").
   - Evolved (tier ≥ 1): more worldly/witty, references past meals.
   - Ghost: eerie one-liners.
3. The caption is lightly woven into the template (e.g. "Nice cat. Again?
   I'm starving."). Not a full caption restatement — a quip.
4. Fallback (no VLM): template-string interpolation against image stats
   (e.g. "Too dark. I can't see what I'm eating." for low-brightness images).

### 5.3 Output

- `STRING` output on the node carries the comment → wire to a Display or
  Save node.
- Comment is appended to `comment_history` (capped at 50) in the state file.
- Comment is shown briefly in a speech bubble on the canvas sprite.

## 6. Persistence (Hybrid)

- **Backend (`state.json`):** source of truth. Written on every state change
  via `POST /comfygotchi/event`. Survives restarts.
- **Time-based hunger:** computed on read by comparing `last_decay_at` to
  `now()` and applying elapsed minutes × `Δ_hunger_per_min`, but **only if**
  the UI was reported open during that interval. The frontend sends a
  `tick` every 60s while open; if no `tick` has been received for > 2 min,
  the backend assumes the UI is closed and does not accumulate hunger for
  the gap. This prevents starvation while ComfyUI is shut down.
- **Frontend (`localStorage`):** mirror for flicker-free rendering while the
  page is open. Re-synced from backend on page load and after every event
  ack. If backend is unreachable, the frontend keeps working off localStorage
  and reconciles later.
- **Atomic writes:** `state.json` is written via temp-file + rename to avoid
  corruption on crash.

## 7. Frontend / Canvas

- Canvas widget rendered inside the node body (~128×128 px).
- Sprite sheet per stage and evolution tier:
  - `egg_t{tier}.png` — wobble; crack frames at 75%/90%/100% incubation.
  - `hatchling_t{tier}.png` — idle, eating, sleeping.
  - `adult_t{tier}.png` — idle, eating, loved (hearts), sleeping, dying.
  - `evolved_t{tier}.png` — evolved idle/eating/loved forms.
  - `ghost.png` — float, fade.
- Tier-0 is the base form. Each evolution tier adds a visual flourish
  (horns, aura, palette shift) so 5000-image milestones feel rewarding.
- Weight drives horizontal scale of the body sprite.
- Mood drives facial expression overlay (eyes/mouth).
- Love event spawns floating heart particles.
- Feed event spawns a brief chewing animation.
- Speech-bubble overlay shows the last comment briefly when it lands.
- A small stat bar (hunger/happiness) under the sprite.
- A counter "🍱 {total_images_eaten}" and evolution progress toward next
  5000 milestone.

## 8. Error handling

| Failure | Behavior |
|---------|----------|
| Vision model not loaded | Fall back to rule-based templates. Image still counts as eaten. Pipeline continues. |
| Vision model errors mid-run | Catch, log, emit a generic mood comment. Image still counts as eaten. Pipeline continues. |
| `state.json` missing/corrupt | Create fresh egg state (tier 0). Log warning. |
| Backend endpoints unreachable (frontend) | Use localStorage, reconcile on reconnect. Love events buffered. |
| Backend endpoints unreachable (node) | Node still passes IMAGE through; comment is a static "…" string. Feed event retried on reconnect. |
| No `api_node` nodes registered | No love events. Creature can still be fed images and still gets hungry over time. Expected on offline/local-only installs. |
| `tick` events stop arriving (UI closed) | Backend pauses hunger decay after 2 min of silence. Resumes on next `tick`. |

## 9. File layout

```
custom_nodes/comfygotchi/
├── __init__.py              # NODE_CLASS_MAPPINGS, WEB_DIRECTORY, pyproject shim
├── pyproject.toml           # ComfyUI-Manager compatibility
├── requirements.txt         # (none hard-required; all optional)
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
│       ├── egg_t0.png
│       ├── hatchling_t0.png
│       ├── adult_t0.png
│       ├── evolved_t1.png
│       ├── evolved_t2.png
│       └── ghost.png
└── tests/
    ├── test_state.py        # Transitions, decay, death, evolution, reincarnation
    └── test_vision_fallback.py
```

## 10. Testing

- **`test_state.py`** (pytest):
  - Egg hatches after exactly 20 feed events.
  - Egg does not accumulate hunger.
  - Feed reduces hunger, increments `total_images_eaten`.
  - Love raises happiness, does not touch hunger.
  - Tick raises hunger by `Δ_hunger_per_min` × elapsed minutes.
  - No tick for > 2 min → decay pauses (no starvation while closed).
  - Death at hunger 100 → ghost.
  - Ghost reincarnates after `T_ghost`.
  - `total_images_eaten` crossing 5000 → `evolution_tier += 1`, `stage = "evolved"`.
  - Evolution tier survives death and reincarnation.
  - `images_this_life` resets on reincarnation; `total_images_eaten` does not.
  - Mood banding matches stat thresholds.
  - Atomic write does not corrupt on simulated crash.
- **`test_vision_fallback.py`**:
  - No VLM installed → rule-based returns deterministic comment.
  - Florence2 adapter path is mocked.
- **Manual smoke test:**
  - Fresh install → egg appears.
  - Feed 20 images through ComfyGotchiNode → egg hatches.
  - Continue feeding → hatchling grows to adult, comments appear.
  - Run a partner API node (e.g. FLUX.3 API) → hearts float, happiness rises.
  - Leave UI open without feeding → hunger rises over minutes.
  - Stop feeding until hunger hits 100 → creature dies, ghost floats.
  - Wait/interact → new egg appears (same evolution tier if any).
  - Feed 5000 images (batch test) → evolution animation, new sprite.
  - Close and reopen ComfyUI → same creature, same stats, same tier.
  - Open a second workflow with a ComfyGotchiNode → same creature.

## 11. Non-goals (YAGNI)

- No multiplayer / shared creatures across machines.
- No in-node mini-games (petting, cleaning) beyond feed/love/decay/evolve.
- No cloud sync of state.
- No dependency on any specific VLM — all are optional.
- No sound effects in v1.
- Evolution tiers beyond a handful get a generic "aura intensifies" treatment
  rather than bespoke sprites per tier (keeps asset scope bounded).

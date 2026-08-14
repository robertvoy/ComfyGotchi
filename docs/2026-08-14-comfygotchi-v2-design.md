# ComfyGotchi v2 — Design Spec

**Date:** 2026-08-14
**Target:** `F:\Comfyui\ComfyUI_windows_portable_nvidia\ComfyUI\custom_nodes\comfygotchi\`

## 1. Changes from v1

1. **Qwen VLM built-in** — Node lädt Qwen-VL-Modell selbst (Model-File-Picker), kein Florence2/FL2MODEL mehr.
2. **10 Tamagotchi-Varianten** — erste 10 Images bestimmen Variante + Persönlichkeit.
3. **25% VLM-Chance** post-hatch — nicht jedes Image wird analysiert.
4. **Personality-Kommentare** — Tone basiert auf Persönlichkeit.
5. **Love-Event Fix** — `executed`-Event korrekt auswerten.

## 2. Qwen VLM Integration

### 2.1 Model-Auswahl

Die Node scannt `models/LLM/Qwen-VL/` nach Verzeichnissen mit `config.json` + `*.safetensors`. Diese werden im Dropdown angeboten. Bei dir liegt bereits `Qwen3-VL-2B-Instruct`.

Falls kein Modell gefunden: Dropdown zeigt `"none (rule-based)"`, Node nutzt Fallback.

### 2.2 Modell-Laden

```python
from transformers import AutoModelForVision2Seq, AutoProcessor, AutoTokenizer

model = AutoModelForVision2Seq.from_pretrained(model_path, torch_dtype="auto", attn_implementation="sdpa")
processor = AutoProcessor.from_pretrained(model_path)
tokenizer = AutoTokenizer.from_pretrained(model_path, trust_remote_code=True)
```

Modell bleibt geladen zwischen Calls (Instance-Variable). `keep_model_loaded=True` default. VRAM wird beim Wechsel freigegeben.

### 2.3 Caption-Generierung

```python
def caption_image(image_tensor, model_state, prompt_text):
    pil_image = tensor_to_pil(image_tensor)
    conversation = [{"role": "user", "content": [
        {"type": "image", "image": pil_image},
        {"type": "text", "text": prompt_text}
    ]}]
    chat = processor.apply_chat_template(conversation, tokenize=False, add_generation_prompt=True)
    inputs = processor(text=chat, images=[pil_image], return_tensors="pt")
    output = model.generate(**inputs, max_new_tokens=128)
    return tokenizer.decode(output[0, inputs["input_ids"].shape[-1]:], skip_special_tokens=True)
```

### 2.4 Zwei Prompt-Modi

- **Ei-Phase (Bilder 1–10):** Caption-Prompt = `"Describe this image in one short sentence."` → Caption gespeichert.
- **Varianten-Bestimmung (bei Bild 10):** Prompt = alle 10 Captions zusammen → JSON `{variant, personality}`.
- **Post-Hatch (25% Chance):** Caption-Prompt = `"Describe this image in one short sentence."` → Caption + Personality → Kommentar.

## 3. 10 Tamagotchi-Varianten

| # | Key | Name | Visuelle Merkmale |
|---|-----|------|-------------------|
| 1 | blob | Blob | Rund, simpel, default |
| 2 | cat | Cat | Ohren (Dreiecke), Schnurrhaare |
| 3 | dog | Dog | Hängeohren, Schnauze |
| 4 | monster | Monster | Hörner, Zähne |
| 5 | dragon | Dragon | Flügel, Stachelschwanz |
| 6 | robot | Robot | Eckig, Antenne, LED-Augen |
| 7 | phantom | Phantom | Schwebend, welliger Saum |
| 8 | alien | Alien | Große Augen, Antenne, grün |
| 9 | bunny | Bunny | Lange Ohren, flauschig |
| 10 | penguin | Penguin | Schnabel, Flipper, S/W |

Jede Variante hat eigene Pixel-Art-Zeichenfunktion in `web/comfygotchi.js`: `drawBlob()`, `drawCat()`, `drawDog()`, etc. Alle nutzen denselben LCD-Screen-Stil, aber unterscheiden sich in Form, Ohren, Augen,Extras.

Variante wird im State als `variant`-Feld gespeichert. Default vor Bestimmung: `"blob"`.

## 4. Personality-System

### 4.1 Bestimmung

Bei Bild 10 sendet die Node alle 10 Captions an Qwen mit Prompt:

```
You are deciding a tamagotchi creature's identity. Based on these 10 image descriptions, choose:
1. A variant: blob, cat, dog, monster, dragon, robot, phantom, alien, bunny, penguin
2. A personality: 2-3 keywords describing the user's aesthetic (e.g. "dark moody cinematic", "bright colorful nature")

Image descriptions:
1. {caption_1}
2. {caption_2}
...
10. {caption_10}

Respond ONLY as JSON: {"variant": "cat", "personality": "dark moody cinematic"}
```

### 4.2 Tone-Modifier

`personality` (z.B. "dark moody cinematic") wird gegen Keyword-Kategorien gematcht:

| Keyword | Tone |
|---------|------|
| dark, moody, gothic, noir | snarky, dramatic |
| bright, colorful, happy | cheerful, gushing |
| nature, organic, natural | calm, philosophical |
| sci-fi, cyber, tech | analytical, robotic |
| cute, kawaii, soft | gentle, childlike |
| horror, scary, creepy | morbid, dark humor |

### 4.3 Kommentar-Generierung

Bei VLM-Analyse (25% Chance):
1. Caption generieren
2. Personality-Tone bestimmen
3. Template: Caption + Tone → One-Liner

Ohne VLM (75%):
1. Personality-Tone bestimmen
2. Generischer Spruch mit Tone (kein Bildbezug)

`prompts.py` wird erweitert mit `generate_comment(mood, stage, tier, caption, personality, variant)`.

## 5. Post-Hatch Flow (25% VLM)

```python
def process(self, image, qwen_model="none", **kwargs):
    state = get_state()
    
    if state["stage"] == "egg":
        # Ei-Phase: immer analysieren
        caption = caption_image(image, ...)
        store_egg_caption(caption)
        if state["incubation_progress"] >= 10:
            variant, personality = determine_variant()
            state["variant"] = variant
            state["personality"] = personality
        apply_feed()  # incubation_progress += 1
        comment = "..."  # egg wobble, kein Kommentar
    elif state["stage"] in ("hatchling", "adult", "evolved"):
        apply_feed()
        if random.random() < 0.25:
            caption = caption_image(image, ...)
            comment = generate_comment(mood, stage, tier, caption, personality, variant)
        else:
            comment = generate_comment(mood, stage, tier, None, personality, variant)
    else:  # ghost
        apply_feed()  # ignored
        comment = generate_comment("dead", "ghost", tier, None, personality, variant)
    
    post_feed_event()
    return (image, comment)
```

## 6. Hatching Threshold

- **v1:** 20 Images zum Schlüpfen
- **v2:** 10 Images zum Schlüpfen (entspricht den 10 Bestimmungs-Images)
- `HATCH_THRESHOLD = 10`

## 7. State Model Änderungen

Neue Felder in `state.json`:

```json
{
  "variant": "blob",           // blob|cat|dog|monster|dragon|robot|phantom|alien|bunny|penguin
  "personality": "",           // z.B. "dark moody cinematic"
  "egg_captions": [],          // Captions der ersten 10 Bilder
  "variant_determined": false  // true nach Bestimmung
}
```

`incubation_progress` zählt jetzt bis 10 (nicht mehr 20).

## 8. Love-Event Fix

### Root Cause

`api.addEventListener("executed", ...)` liefert `evt.detail = { node: "5", display_node: "5", output: ..., prompt_id: "..." }`. `node` ist die **Node-ID**, nicht der Klassentyp. Unser Code suchte nach `class_type` → fand nichts → kein Love-Event.

### Fix

```javascript
// 1. Beim Setup: alle API-Node-Typen vom Backend holen
async function loadApiNodeTypes() {
  const r = await fetch("/object_info");
  const defs = await r.json();
  const apiTypes = new Set();
  for (const [name, def] of Object.entries(defs)) {
    if (def.api_node === true) apiTypes.add(name);
  }
  return apiTypes;
}

// 2. Im executed-Listener: Node-ID → Node-Objekt → type
api.addEventListener("executed", (evt) => {
  const nodeId = evt.detail.node;
  const node = app.graph._nodes_by_id?.[nodeId];
  if (node && apiNodeTypes.has(node.type)) {
    sendLove();
  }
});
```

## 9. Node Inputs

```python
INPUT_TYPES:
  required:
    image: IMAGE
  optional:
    qwen_model: (dropdown, default "none (rule-based)")
      # Scannt models/LLM/Qwen-VL/ für verfügbare Modelle
    keep_model_loaded: BOOLEAN (default True)
```

Kein `FL2MODEL` mehr. Kein `vision_model` mehr. Alles Qwen.

## 10. File Changes

| File | Change |
|------|--------|
| `nodes.py` | Rewrite: Qwen-Lader, 25%-Logik, Variant-Bestimmung, Personality |
| `vision.py` | Rewrite: Qwen VLM statt Florence2 |
| `prompts.py` | Erweitern: `generate_comment(mood, stage, tier, caption, personality, variant)` |
| `state.py` | Neue Felder: `variant`, `personality`, `egg_captions`, `variant_determined`; `HATCH_THRESHOLD=10` |
| `server.py` | Keine Änderung (endpoints gleich) |
| `web/comfygotchi.js` | 10 Varianten-Zeichenfunktionen, Variant aus State rendern |
| `web/listener.js` | Love-Event Fix: `/object_info` fetch + `_nodes_by_id` |

## 11. Error Handling

| Failure | Behavior |
|---------|----------|
| Kein Qwen-Modell gefunden | Rule-based Fallback für Captions. Variante = blob. Personality = "" |
| Qwen-Modell lädt nicht | Fallback, Fehler loggen, Pipeline läuft weiter |
| Variante-Bestimmung fehlschlägt (bad JSON) | Retry ohne JSON-Format, falls failt: variante=blob, personality="" |
| `/object_info` fetch fehlschlägt | Love-Events deaktiviert bis neu geladen |

## 12. Non-goals

- Keine Multiplayer / shared creatures
- Kein Cloud-Sync
- Kein Florence2-Support mehr (nur Qwen)
- Keine Sound-Effekte

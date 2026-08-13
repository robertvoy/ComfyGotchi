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

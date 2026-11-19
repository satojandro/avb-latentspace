# Personal site: plan and status

A personal website told as one interactive machine. The home page is **Fig 1**, an isometric
figure (built with the [Anatomy](https://github.com/wheresryan22/anatomy) skill's kit) that
explains how latent space works in a real LLM, with the MLP neurons labelled as parts of
the owner's life. Chapter pages (Caracas, Melbourne, travel map, crypto, AI, projects,
contact) open from parts of the machine.

## How to build

```bash
node mind/build.mjs      # builds the figure (writes mind/mind-body.html, mind-script.js, iso.css)
python3 build.py         # runs the above, then inlines everything into index.html (deployable) and artifact.html
node mind/preview.mjs    # optional: mind/preview.html, the figure alone
```

Line check (from the installed skill, needs `~/.claude/skills/anatomy`):

```bash
node ~/.claude/skills/anatomy/scripts/lines.mjs mind/preview.html --out /tmp/lines.png   # must print "line ends: 0"
```

## Files

| File | What it is |
|---|---|
| `src.html` | The site: home page shell, chapter plates, all site JS. `CONFIG` at the top has name, travel places, crypto roles, links. |
| `mind/model.mjs` | **The model.** A tiny real transformer forward pass: embeddings, residual stream, 1 attention head, MLP neurons (key/value, GELU), RMSNorm, unembedding, softmax, ablation, steering, PCA. Neurons and projects (placeholders) live here. |
| `mind/build.mjs` | Builds the isometric SVG figure from the model with the kit. |
| `mind/live.js` | The figure's live behaviour in the page. |
| `mind/mind.css` | Palette overrides and live-part styles for the figure. |
| `mind/kit/` | Copy of the Anatomy kit (MIT, see `mind/kit/LICENSE`). |
| `build.py` | Inlines the figure into `src.html` → `index.html` / `artifact.html`. |
| `build/b64.txt` | Land-dot bitmask for the world map (from world-atlas 110m). |

Published preview: https://claude.ai/artifact/FVnFKKLVgzjp33fV2BF64Q (private to the owner).

## The concept (what the machine shows)

Prompt = three tokens: `I`, a context word (`teach`, `connect`, `fix`, `explore`, `trade`), `build`.
The model predicts the next token, which is one of the projects.

| LLM part | Physical part in the figure |
|---|---|
| Token embeddings | Card reader with three token cards; a knob picks the context word |
| Attention (1 head, block 1) | Three cables from the cards up to block 1, brightness = attention weight |
| Residual stream (d=8) | Bank of 8 sliders on every tray: the vector after that block |
| MLP neurons (key → GELU → value) | Lamps on the trays, brightness = activation; trays = blocks = life chapters |
| Final RMSNorm + unembedding | Block on the map table, 8 dots in, 5 logit posts out |
| Softmax probabilities | Five graduated tubes beside the decoder |
| Latent space | Map table = 2-D PCA projection of the stream; trajectory of the token's vector through the blocks; pins = project output directions |
| Ablation / steering | Click a lamp to switch a neuron off; drag the map to add a steering vector |

Real-model scale for the caption: Llama 3 8B has d_model 4,096, 32 layers, 14,336 MLP neurons per layer, a 128,256-token vocabulary.

Model check (`node -e 'import("./mind/model.mjs").then(m=>m.CONTEXTS.forEach(c=>console.log(c, m.forward(c).probs.map(p=>p.toFixed(2)))))'`):
teach → Project One, connect → Five, fix → Two, explore → Three, trade → Four.

## Status

- [x] v1–v2: canvas machine home (replaced)
- [x] v3: Anatomy figure home (lamp cascade → map table → decoder), chapter plates, projects plate
- [x] Anatomy skill installed at `~/.claude/skills/anatomy` (container only; reinstall: `npx skills add wheresryan22/anatomy -g -a claude-code`)
- [x] v4 detail pass (braces, clamps, socket screws, decoder vents/LED)
- [x] **v5 model**: `mind/model.mjs` rewritten as a real forward pass (tested, numbers above)
- [ ] **v5 geometry** (in progress in `mind/build.mjs`): token reader + knob + attention cables, slider banks, unembed block, trajectory path, probability tubes. Edits applied; **not yet built or checked**.
- [ ] **v5 live** (`mind/live.js`): rewrite for the new model:
  - state: `ctx` index, `off` (ablated set), `steer` (du, dv) from map drag
  - each frame: `forward(ctx, off, steerVec)`; displayed values follow targets with a cascade (block l starts 0.35·l s after a change)
  - write: lamp glow = clamp(act/1.5); sliders `[data-slider="l:d"]` translate x by clamp(rmsnorm(states[l+1])[d]/2, ±1)·SLIDE; attention flows `[data-link="att{j}"]` and `[data-tokglow]` by attn[j]; knob pointer `[data-knobptr]`; context word `[data-ctxword]`; trajectory `[data-traj]` and `[data-td]` from `project2(states[i])`; stylus/bridge at final projection; logit posts `[data-logit]` and tubes `[data-fill]` (rebuild with `cylinder(...).fill`) by probs; card number = argmax
  - input: lamp click toggles ablation; knob click / arrow keys change ctx; map drag sets steering; pin click → open projects; tray label → chapter; tour cycles ctx every ~5 s when idle
  - readout: `"I <ctx> build" → Project X · p 0.87 · n neurons off`
- [ ] v5 site text in `src.html`: rewrite the 4 "How to read" steps for tokens → attention → blocks → unembed; caption with real-model scale; projects plate "Grew from" = `attribution(ctx, p)` (direct logit attribution)
- [ ] Verify: build, screenshots desktop + 390 px, line check 0, interactions; publish to the artifact URL
- [ ] Owner content: real neurons per life layer, real projects (name, line, stack, status, year, url) and each one's unembedding direction in `mind/model.mjs`; name, links, travel list in `CONFIG`
- [ ] Later: light theme; audit for cables (`kit/audit.mjs`); deploy `index.html` (Netlify/Vercel/GitHub Pages)

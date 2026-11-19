import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "./kit/iso-kit.mjs";
import * as M from "./model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const CSS = `
* { box-sizing: border-box; }
html, body {
  margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
body.iso {
  background: radial-gradient(circle at 46% 50%, #101624 0%, #090c12 68%, #06080d 100%) !important;
  color: #e6ecf5;
  padding: 0 !important;
  margin: 0 !important;
  max-width: none !important;
}
body.iso[data-theme="light"] {
  background: radial-gradient(circle at 46% 50%, #ffffff 0%, #f3f6fa 70%, #e9eef5 100%) !important;
  color: #161b24 !important;
}
.iso-page, main.iso-page {
  max-width: none !important;
  width: 100vw !important;
  height: 100vh !important;
  margin: 0 !important;
  padding: 0 !important;
}

.app-shell {
  position: relative;
  width: 100vw;
  height: 100vh;
  display: flex;
  overflow: hidden;
}

.viewport-main {
  position: relative;
  flex: 1 1 auto;
  height: 100vh;
  min-width: 0;
  overflow: hidden;
}

/* Full-bleed edge-to-edge 3D optical chamber stage */
.lc-stage {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  touch-action: none;
  user-select: none;
  cursor: grab;
}
.lc-stage:active { cursor: grabbing; }
.lc-stage > .lc-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
.lc-svg-overlay { pointer-events: none; overflow: visible; }
.lc-gl { pointer-events: none; }

/* Dynamic 3D Optical Cube Frame styling */
.lc-face-floor { fill: rgba(20, 32, 54, 0.24); stroke: none; }
.lc-face-wall { fill: rgba(14, 24, 42, 0.14); stroke: none; }
.iso[data-theme="light"] .lc-face-floor { fill: rgba(190, 208, 228, 0.24); }
.iso[data-theme="light"] .lc-face-wall { fill: rgba(205, 220, 236, 0.14); }

.lc-cube-grid {
  fill: none;
  stroke: rgba(130, 170, 220, 0.10);
  stroke-width: 0.65;
}
.iso[data-theme="light"] .lc-cube-grid { stroke: rgba(30, 55, 90, 0.10); }

.lc-cube-edge-back {
  fill: none;
  stroke: rgba(140, 178, 226, 0.20);
  stroke-width: 0.75;
  stroke-dasharray: 3 3;
}
.lc-cube-edge-front {
  fill: none;
  stroke: rgba(175, 208, 248, 0.42);
  stroke-width: 0.9;
}
.lc-cube-corners {
  fill: none;
  stroke: rgba(215, 234, 255, 0.85);
  stroke-width: 1.4;
  stroke-linecap: square;
}
.iso[data-theme="light"] .lc-cube-edge-back { stroke: rgba(25, 48, 82, 0.22); }
.iso[data-theme="light"] .lc-cube-edge-front { stroke: rgba(20, 42, 74, 0.48); }
.iso[data-theme="light"] .lc-cube-corners { stroke: rgba(16, 34, 62, 0.85); }

.lc-axis-tag {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 9px;
  letter-spacing: 0.14em;
  fill: rgba(165, 195, 235, 0.48);
}
.iso[data-theme="light"] .lc-axis-tag { fill: rgba(30, 50, 80, 0.50); }

/* Projected 3D SVG semantic callouts */
.lc-labels text {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 9.5px;
  letter-spacing: 0.02em;
  paint-order: stroke;
  stroke: rgba(7, 10, 16, 0.88);
  stroke-width: 3px;
  stroke-linejoin: round;
}
.iso[data-theme="light"] .lc-labels text {
  stroke: rgba(246, 248, 252, 0.94);
}
.lc-tag text { fill: rgba(220, 230, 245, 0.68); font-size: 9.5px; }
.lc-tag-top text { fill: #ffe08a; font-weight: 700; font-size: 10.5px; }
.iso[data-theme="light"] .lc-tag text { fill: rgba(35, 45, 62, 0.68); }
.iso[data-theme="light"] .lc-tag-top text { fill: #b8321c; font-weight: 700; }
.lc-feat-tag text { font-size: 9px; font-weight: 500; }
.lc-feat-tag.is-hov text { font-size: 10.5px; font-weight: 700; }
.lc-cursor-tag text { fill: #fff4cc; font-size: 9.5px; font-weight: 700; }
.iso[data-theme="light"] .lc-cursor-tag text { fill: #0e2a66; }

/* Top-left floating badge */
.top-badge {
  position: absolute;
  top: 16px;
  left: 20px;
  z-index: 10;
  pointer-events: none;
}
.top-badge .kicker {
  font-size: 9.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  opacity: 0.52;
}
.top-badge .title {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-top: 2px;
}
.top-badge .sub {
  font-size: 10px;
  opacity: 0.58;
  margin-top: 3px;
}

/* Bottom-left floating camera & interaction bar */
.cam-bar {
  position: absolute;
  bottom: 16px;
  left: 20px;
  z-index: 15;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.cam-group {
  display: inline-flex;
  align-items: center;
  background: rgba(14, 18, 28, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  backdrop-filter: blur(10px);
  overflow: hidden;
}
.iso[data-theme="light"] .cam-group {
  background: rgba(255, 255, 255, 0.82);
  border-color: rgba(15, 25, 40, 0.14);
}
.cam-btn {
  background: transparent;
  color: inherit;
  border: none;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  padding: 6px 10px;
  font: 10px/1 ui-monospace, monospace;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
  opacity: 0.78;
  transition: background 0.14s, opacity 0.14s;
}
.cam-btn:last-child { border-right: none; }
.cam-btn:hover { background: rgba(255, 255, 255, 0.08); opacity: 1; }
.cam-btn.active {
  background: rgba(96, 178, 255, 0.22);
  color: #9ed4ff;
  opacity: 1;
  font-weight: 700;
}
.iso[data-theme="light"] .cam-btn { border-right-color: rgba(15, 25, 40, 0.08); }
.iso[data-theme="light"] .cam-btn:hover { background: rgba(15, 25, 40, 0.06); }
.iso[data-theme="light"] .cam-btn.active {
  background: rgba(20, 96, 178, 0.14);
  color: #104e96;
}
.cam-val {
  padding: 0 8px;
  font-size: 10px;
  opacity: 0.72;
  font-variant-numeric: tabular-nums;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
}
.iso[data-theme="light"] .cam-val { border-right-color: rgba(15, 25, 40, 0.08); }
.cam-hint {
  font-size: 9.5px;
  letter-spacing: 0.05em;
  opacity: 0.45;
  pointer-events: none;
}

/* Right-side Mechanistic Telemetry Inspector */
.hud-panel {
  position: relative;
  flex: 0 0 330px;
  height: 100vh;
  background: rgba(12, 15, 22, 0.86);
  border-left: 1px solid rgba(255, 255, 255, 0.09);
  backdrop-filter: blur(14px);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 11px;
  overflow-y: auto;
  z-index: 20;
  transition: flex-basis 0.25s ease, padding 0.25s ease, opacity 0.2s ease;
}
.iso[data-theme="light"] .hud-panel {
  background: rgba(246, 248, 252, 0.90);
  border-left-color: rgba(15, 25, 40, 0.12);
}
.hud-panel.collapsed {
  flex-basis: 0;
  padding: 0;
  border-left: none;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
}

.panel-toggle-btn {
  position: absolute;
  top: 14px;
  right: 16px;
  z-index: 30;
  background: rgba(18, 24, 36, 0.74);
  color: inherit;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 5px;
  padding: 5px 10px;
  font: 10px/1 ui-monospace, monospace;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  backdrop-filter: blur(8px);
}
.iso[data-theme="light"] .panel-toggle-btn {
  background: rgba(255, 255, 255, 0.82);
  border-color: rgba(15, 25, 40, 0.16);
}
.hud-panel:not(.collapsed) ~ .panel-toggle-btn { right: 344px; }

.hud-section {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding-top: 9px;
}
.hud-section:first-child { border-top: none; padding-top: 0; }
.iso[data-theme="light"] .hud-section { border-top-color: rgba(15, 25, 40, 0.1); }

.hud-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 9.5px;
  letter-spacing: 0.11em;
  text-transform: uppercase;
  opacity: 0.58;
  margin-bottom: 6px;
}

.hud-prompts { display: flex; flex-direction: column; gap: 4px; }
.hud-prompt-btn {
  text-align: left;
  background: rgba(255, 255, 255, 0.04);
  color: inherit;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 5px;
  padding: 5.5px 8px;
  font: 11px/1.25 ui-monospace, monospace;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.hud-prompt-btn:hover { background: rgba(255, 255, 255, 0.09); }
.hud-prompt-btn.active {
  background: rgba(96, 178, 255, 0.16);
  border-color: rgba(130, 200, 255, 0.55);
  font-weight: 700;
}
.iso[data-theme="light"] .hud-prompt-btn {
  background: rgba(15, 25, 40, 0.03);
  border-color: rgba(15, 25, 40, 0.10);
}
.iso[data-theme="light"] .hud-prompt-btn.active {
  background: rgba(24, 96, 176, 0.12);
  border-color: rgba(24, 96, 176, 0.45);
}

.hud-controls { display: flex; gap: 6px; margin-top: 6px; }
.hud-btn {
  flex: 1;
  background: rgba(255, 255, 255, 0.06);
  color: inherit;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  padding: 5px 6px;
  font: 10px/1 ui-monospace, monospace;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
}
.hud-btn.active {
  background: rgba(96, 178, 255, 0.2);
  border-color: rgba(130, 200, 255, 0.5);
}
.iso[data-theme="light"] .hud-btn {
  background: rgba(15, 25, 40, 0.05);
  border-color: rgba(15, 25, 40, 0.14);
}

input[type="range"].hud-slider {
  width: 100%;
  accent-color: #6cc2ff;
  cursor: pointer;
}

.hud-note {
  font-size: 10.5px;
  line-height: 1.45;
  padding: 7px 9px;
  border-radius: 5px;
  background: rgba(96, 178, 255, 0.08);
  border-left: 2px solid #6cc2ff;
  opacity: 0.92;
}
.iso[data-theme="light"] .hud-note {
  background: rgba(24, 96, 176, 0.07);
  border-left-color: #1860b0;
}

.hud-steer-badge {
  font-size: 9px;
  padding: 2px 5px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.07);
}
.hud-steer-badge.active {
  background: rgba(255, 168, 66, 0.24);
  color: #ffc272;
}
.iso[data-theme="light"] .hud-steer-badge.active {
  background: rgba(204, 88, 24, 0.16);
  color: #a83c0c;
}

/* 8-D Residual Stream bipolar bars */
.hud-vec-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 10px;
}
.hud-vec-row {
  display: grid;
  grid-template-columns: 20px 1fr 34px;
  align-items: center;
  gap: 5px;
  font-size: 9.5px;
}
.hud-vec-track {
  position: relative;
  height: 5px;
  background: rgba(255, 255, 255, 0.07);
  border-radius: 2px;
  overflow: hidden;
}
.iso[data-theme="light"] .hud-vec-track { background: rgba(15, 25, 40, 0.09); }
.hud-vec-track::after {
  content: "";
  position: absolute;
  left: 50%; top: 0; bottom: 0; width: 1px;
  background: rgba(255, 255, 255, 0.22);
}
.hud-vec-fill { position: absolute; top: 0; bottom: 0; background: #5ec2ff; }
.hud-vec-fill.neg { background: #ff9c54; }
.hud-vec-val { text-align: right; opacity: 0.72; font-variant-numeric: tabular-nums; }

/* Active SAE Features (clickable for clamp/ablate) */
.hud-feat-list { display: flex; flex-direction: column; gap: 3px; }
.hud-feat-row {
  display: grid;
  grid-template-columns: 7px 1fr 48px 28px;
  align-items: center;
  gap: 6px;
  font: 10px/1.2 ui-monospace, monospace;
  background: transparent;
  color: inherit;
  border: 1px solid transparent;
  border-radius: 4px;
  padding: 3px 4px;
  text-align: left;
  cursor: pointer;
}
.hud-feat-row:hover { background: rgba(255, 255, 255, 0.06); }
.iso[data-theme="light"] .hud-feat-row:hover { background: rgba(15, 25, 40, 0.05); }
.hud-feat-row.is-clamp { border-color: rgba(255, 190, 85, 0.45); background: rgba(255, 190, 85, 0.08); }
.hud-feat-row.is-ablate { border-color: rgba(255, 92, 108, 0.45); background: rgba(255, 92, 108, 0.08); }
.hud-dot { width: 6px; height: 6px; border-radius: 50%; }
.hud-feat-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hud-feat-bar { height: 4px; background: rgba(255, 255, 255, 0.08); border-radius: 2px; overflow: hidden; }
.iso[data-theme="light"] .hud-feat-bar { background: rgba(15, 25, 40, 0.09); }
.hud-feat-bar i { display: block; height: 100%; border-radius: 2px; }
.hud-feat-num { text-align: right; opacity: 0.72; font-variant-numeric: tabular-nums; }

.hud-clamp-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}
.hud-clamp-empty { font-size: 9.5px; opacity: 0.45; }
.hud-clamp-pill {
  font: 9px/1 ui-monospace, monospace;
  padding: 3px 6px;
  border-radius: 3px;
  border: 1px solid;
  cursor: pointer;
  background: transparent;
}
.hud-clamp-pill.is-clamp { color: #ffbe55; border-color: rgba(255, 190, 85, 0.5); }
.hud-clamp-pill.is-ablate { color: #ff6b78; border-color: rgba(255, 92, 108, 0.5); }
.hud-clamp-clear {
  font: 9px/1 ui-monospace, monospace;
  padding: 3px 6px;
  border-radius: 3px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: transparent;
  color: inherit;
  opacity: 0.7;
  cursor: pointer;
}

/* Logit Lens tokens */
.hud-tok-list { display: flex; flex-direction: column; gap: 5px; }
.hud-tok-row {
  display: grid;
  grid-template-columns: 62px 1fr 32px;
  align-items: center;
  gap: 7px;
  font-size: 10.5px;
}
.hud-tok-track { height: 6px; background: rgba(255, 255, 255, 0.08); border-radius: 3px; overflow: hidden; }
.iso[data-theme="light"] .hud-tok-track { background: rgba(15, 25, 40, 0.09); }
.hud-tok-fill { height: 100%; background: rgba(96, 178, 255, 0.65); border-radius: 3px; transition: width 0.06s linear; }
.hud-tok-fill.top { background: #ffd875; }
.iso[data-theme="light"] .hud-tok-fill.top { background: #c43e24; }
.hud-tok-pct { text-align: right; font-variant-numeric: tabular-nums; opacity: 0.85; }

@media (max-width: 900px) {
  .app-shell { flex-direction: column; height: auto; overflow-y: auto; }
  html, body { overflow: auto; }
  .viewport-main { width: 100%; height: 68vh; }
  .hud-panel { width: 100%; flex: none; height: auto; border-left: none; border-top: 1px solid rgba(255,255,255,0.1); }
  .panel-toggle-btn { display: none; }
}
`;

const DATA = { version: 2 };
const stripExport = (src) => src.replace(/^export\s+(?=(const|let|var|function|class)\b)/gm, "");
const modelSrc = stripExport(readFileSync(join(HERE, "model.mjs"), "utf8"));
const liveSrc = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));

const promptBtnsHtml = M.PROMPTS.map(
  (p, i) => `<button class="hud-prompt-btn${i === 0 ? " active" : ""}" data-prompt-btn="${i}">${i + 1}. "${p.text}"</button>`,
).join("\n");

const vecBarsHtml = Array.from({ length: 8 }, (_, d) =>
  `<div class="hud-vec-row"><span>d${d}</span><span class="hud-vec-track"><span class="hud-vec-fill" data-vec-bar="${d}"></span></span><span class="hud-vec-val" data-vec-val="${d}">+0.00</span></div>`,
).join("\n");

const tokenBarsHtml = M.TOKENS.map(
  (t, i) => `<div class="hud-tok-row"><span>${t.text}</span><span class="hud-tok-track"><div class="hud-tok-fill" data-tok-bar="${i}" style="width:20%"></div></span><span class="hud-tok-pct" data-tok-pct="${i}">20%</span></div>`,
).join("\n");

const bodyHtml = `
<style>${CSS}</style>
<div class="app-shell">
  <main class="viewport-main">
    <div class="top-badge">
      <div class="kicker">Fig 1 · Real-Time Transformer + SAE Latent Space</div>
      <div class="title">LLM Latent Space Chamber</div>
      <div class="sub">d_model = 8 → PCA 3D · 1,848 Superposed Concepts · 48 Named SAE Features · L = 6</div>
    </div>

    <div class="lc-stage" tabindex="0">
      <svg xmlns="http://www.w3.org/2000/svg" class="lc-layer lc-svg-overlay" aria-label="Interactive 3D optical cube of an LLM latent space">
        <g data-cube-back></g>
      </svg>
      <canvas class="lc-layer lc-gl" aria-hidden="true"></canvas>
      <svg xmlns="http://www.w3.org/2000/svg" class="lc-layer lc-svg-overlay" aria-hidden="true">
        <g data-cube-front></g>
        <g data-labels class="lc-labels"></g>
      </svg>
    </div>

    <div class="cam-bar">
      <div class="cam-group">
        <button class="cam-btn active" data-mode-orbit title="Drag to rotate 3D cube">Orbit</button>
        <button class="cam-btn" data-mode-steer title="Drag to inject 3D→8D steering vector (or hold Shift)">Steer</button>
      </div>
      <div class="cam-group">
        <button class="cam-btn" data-zoom-out title="Zoom out (−)">−</button>
        <span class="cam-val" data-zoom-val>1.1×</span>
        <button class="cam-btn" data-zoom-in title="Zoom into cluster (+)">+</button>
      </div>
      <div class="cam-group">
        <button class="cam-btn" data-cam-spin title="Toggle slow cosmic orbit">Spin</button>
        <button class="cam-btn" data-cam-reset title="Reset camera, steering & clamps (R)">Reset</button>
      </div>
      <span class="cam-hint">DRAG ORBIT · SCROLL ZOOM · CLICK NODE CLAMP/ABLATE · SHIFT+DRAG STEER</span>
    </div>
  </main>

  <aside class="hud-panel">
    <div class="hud-section">
      <div class="hud-label"><span>Prompt Context</span><span>1–5</span></div>
      <div class="hud-prompts">${promptBtnsHtml}</div>
    </div>

    <div class="hud-section">
      <div class="hud-label"><span>Layer Depth (4th Dim)</span><span data-layer-val>L4.4 / 6.0</span></div>
      <input type="range" class="hud-slider" data-layer-slider min="0" max="6" step="0.05" value="4.35"/>
      <div class="hud-controls">
        <button class="hud-btn" data-play-btn>Pause</button>
        <button class="hud-btn active" data-labels-btn>Labels</button>
        <button class="hud-btn" data-theme-btn>${theme === "light" ? "Dark" : "Light"}</button>
      </div>
    </div>

    <div class="hud-section">
      <div class="hud-label"><span>Active Layer Mechanism</span><span class="hud-steer-badge" data-steer-badge>UNSTEERED</span></div>
      <div class="hud-note" data-stage-note>Loading layer state…</div>
    </div>

    <div class="hud-section">
      <div class="hud-label"><span>Residual Stream x(l) ∈ ℝ⁸</span><span>Unit Norm</span></div>
      <div class="hud-vec-grid">${vecBarsHtml}</div>
    </div>

    <div class="hud-section">
      <div class="hud-label"><span>Top Firing SAE Features</span><span>Click to Clamp</span></div>
      <div class="hud-feat-list" data-feat-list></div>
      <div class="hud-clamp-bar" data-clamp-bar></div>
    </div>

    <div class="hud-section">
      <div class="hud-label"><span>Logit Lens · W_U Softmax</span><span data-entropy>0.48 bits</span></div>
      <div class="hud-tok-list">${tokenBarsHtml}</div>
    </div>
  </aside>

  <button class="panel-toggle-btn" data-panel-toggle>Hide</button>
</div>
`;

const html = k.pageHtml({
  title: "LLM Latent Space Chamber — Anatomy v2",
  theme,
  body: bodyHtml,
  script: [modelSrc, liveSrc].join("\n;\n"),
});

const outFile = join(HERE, theme === "light" ? "index-light.html" : "index.html");
writeFileSync(outFile, html, "utf8");
console.log(`Built ${outFile} (${(html.length / 1024).toFixed(1)} KB)`);

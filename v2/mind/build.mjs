import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../kit/iso-kit.mjs";
import * as M from "./model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const CSS = `
* { box-sizing: border-box; }
html, body {
  margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
body.iso {
  background: radial-gradient(circle at 46% 50%, #101624 0%, #090c12 68%, #06080d 100%) !important;
  color: #e8eef7;
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

/* Full-bleed edge-to-edge 3D galaxy cube */
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

/* 3D Optical Cube Frame */
.lc-face-floor { fill: rgba(20, 32, 54, 0.22); stroke: none; }
.lc-face-wall { fill: rgba(14, 24, 42, 0.12); stroke: none; }
.iso[data-theme="light"] .lc-face-floor { fill: rgba(190, 208, 228, 0.22); }
.iso[data-theme="light"] .lc-face-wall { fill: rgba(205, 220, 236, 0.13); }

.lc-cube-grid { fill: none; stroke: rgba(130, 170, 220, 0.09); stroke-width: 0.65; }
.iso[data-theme="light"] .lc-cube-grid { stroke: rgba(30, 55, 90, 0.09); }
.lc-cube-edge-back { fill: none; stroke: rgba(140, 178, 226, 0.18); stroke-width: 0.75; stroke-dasharray: 3 3; }
.lc-cube-edge-front { fill: none; stroke: rgba(175, 208, 248, 0.38); stroke-width: 0.9; }
.lc-cube-corners { fill: none; stroke: rgba(215, 234, 255, 0.82); stroke-width: 1.4; stroke-linecap: square; }
.iso[data-theme="light"] .lc-cube-edge-back { stroke: rgba(25, 48, 82, 0.20); }
.iso[data-theme="light"] .lc-cube-edge-front { stroke: rgba(20, 42, 74, 0.44); }
.iso[data-theme="light"] .lc-cube-corners { stroke: rgba(16, 34, 62, 0.82); }

/* Projected 3D labels */
.lc-labels text {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 9.5px;
  letter-spacing: 0.01em;
  paint-order: stroke;
  stroke: rgba(7, 10, 16, 0.90);
  stroke-width: 3px;
  stroke-linejoin: round;
}
.iso[data-theme="light"] .lc-labels text { stroke: rgba(246, 248, 252, 0.95); }
.lc-node-tag.is-sel text { font-size: 10.5px; font-weight: 700; }
.lc-node-tag.is-hov text { font-size: 10.5px; font-weight: 700; }

/* Top-left floating editorial header */
.top-badge {
  position: absolute;
  top: 18px;
  left: 22px;
  z-index: 10;
  pointer-events: none;
}
.top-badge .kicker {
  font: 9.5px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  opacity: 0.54;
}
.top-badge .title {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.02em;
  margin-top: 4px;
}
.top-badge .sub {
  font-size: 11px;
  opacity: 0.60;
  margin-top: 3px;
}

/* Bottom-left floating camera controls */
.cam-bar {
  position: absolute;
  bottom: 16px;
  left: 22px;
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
  background: rgba(255, 255, 255, 0.84);
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
}
.cam-btn:last-child { border-right: none; }
.cam-btn:hover { background: rgba(255, 255, 255, 0.08); opacity: 1; }
.cam-btn.active { background: rgba(255, 214, 112, 0.2); color: #ffe08a; opacity: 1; font-weight: 700; }
.iso[data-theme="light"] .cam-btn { border-right-color: rgba(15, 25, 40, 0.08); }
.iso[data-theme="light"] .cam-btn:hover { background: rgba(15, 25, 40, 0.06); }
.iso[data-theme="light"] .cam-btn.active { background: rgba(184, 58, 20, 0.12); color: #9c2e0e; }
.cam-val {
  padding: 0 8px;
  font: 10px/1 ui-monospace, monospace;
  opacity: 0.72;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
}
.iso[data-theme="light"] .cam-val { border-right-color: rgba(15, 25, 40, 0.08); }
.cam-hint {
  font: 9.5px/1 ui-monospace, monospace;
  letter-spacing: 0.05em;
  opacity: 0.45;
  pointer-events: none;
}

/* Right-side Story Inspector */
.hud-panel {
  position: relative;
  flex: 0 0 364px;
  height: 100vh;
  background: rgba(12, 15, 22, 0.88);
  border-left: 1px solid rgba(255, 255, 255, 0.09);
  backdrop-filter: blur(14px);
  padding: 15px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  z-index: 20;
  transition: flex-basis 0.25s ease, padding 0.25s ease, opacity 0.2s ease;
}
.iso[data-theme="light"] .hud-panel {
  background: rgba(248, 250, 253, 0.92);
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
  top: 16px;
  right: 16px;
  z-index: 30;
  background: rgba(18, 24, 36, 0.76);
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
  background: rgba(255, 255, 255, 0.84);
  border-color: rgba(15, 25, 40, 0.16);
}
.hud-panel:not(.collapsed) ~ .panel-toggle-btn { right: 378px; }

/* Mode Tabs (Timeline | Lenses) */
.mode-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.10);
  border-radius: 6px;
  padding: 3px;
  gap: 3px;
}
.iso[data-theme="light"] .mode-tabs {
  background: rgba(15, 25, 40, 0.05);
  border-color: rgba(15, 25, 40, 0.10);
}
.mode-tab {
  background: transparent;
  color: inherit;
  border: none;
  border-radius: 4px;
  padding: 6px 8px;
  font: 10.5px/1 ui-monospace, monospace;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
  opacity: 0.68;
}
.mode-tab.active {
  background: rgba(255, 214, 112, 0.18);
  color: #ffe08a;
  font-weight: 700;
  opacity: 1;
}
.iso[data-theme="light"] .mode-tab.active {
  background: #ffffff;
  color: #161b24;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.hud-section {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding-top: 10px;
}
.hud-section:first-child { border-top: none; padding-top: 0; }
.iso[data-theme="light"] .hud-section { border-top-color: rgba(15, 25, 40, 0.10); }

.hud-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font: 9.5px/1 ui-monospace, monospace;
  letter-spacing: 0.11em;
  text-transform: uppercase;
  opacity: 0.56;
  margin-bottom: 7px;
}

.chap-list { display: flex; flex-direction: column; gap: 4px; }
.chap-btn {
  display: flex;
  justify-content: space-between;
  align-items: center;
  text-align: left;
  background: rgba(255, 255, 255, 0.035);
  color: inherit;
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 5px;
  padding: 6px 9px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.14s, border-color 0.14s;
}
.chap-btn:hover { background: rgba(255, 255, 255, 0.08); }
.chap-btn.active {
  background: rgba(255, 214, 112, 0.13);
  border-color: rgba(255, 214, 112, 0.45);
  font-weight: 600;
}
.chap-yr {
  font: 9.5px/1 ui-monospace, monospace;
  opacity: 0.58;
}
.iso[data-theme="light"] .chap-btn {
  background: rgba(15, 25, 40, 0.03);
  border-color: rgba(15, 25, 40, 0.09);
}
.iso[data-theme="light"] .chap-btn.active {
  background: rgba(184, 58, 20, 0.09);
  border-color: rgba(184, 58, 20, 0.38);
}

input[type="range"].hud-slider {
  width: 100%;
  margin: 8px 0 6px;
  accent-color: #ffd875;
  cursor: pointer;
}
.iso[data-theme="light"] input[type="range"].hud-slider { accent-color: #b83a14; }

.hud-controls { display: flex; gap: 6px; }
.hud-btn {
  flex: 1;
  background: rgba(255, 255, 255, 0.06);
  color: inherit;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  padding: 5.5px 6px;
  font: 10px/1 ui-monospace, monospace;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
}
.hud-btn.active { background: rgba(96, 178, 255, 0.18); border-color: rgba(130, 200, 255, 0.45); }
.iso[data-theme="light"] .hud-btn { background: rgba(15, 25, 40, 0.05); border-color: rgba(15, 25, 40, 0.14); }

/* Chapter Narrative + Echo Box */
.story-title { font-size: 13.5px; font-weight: 700; margin-bottom: 5px; }
.story-text { font-size: 12px; line-height: 1.5; opacity: 0.86; }
.echo-box {
  margin-top: 8px;
  font-size: 11px;
  line-height: 1.42;
  padding: 7px 9px;
  border-radius: 5px;
  background: rgba(255, 214, 112, 0.09);
  border-left: 2px solid #ffd875;
  color: #ffe8ad;
}
.iso[data-theme="light"] .echo-box {
  background: rgba(184, 58, 20, 0.07);
  border-left-color: #b83a14;
  color: #7d250b;
}

/* Selected Node Story Card */
.node-card {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.10);
  border-radius: 7px;
  padding: 10px 11px;
}
.iso[data-theme="light"] .node-card {
  background: #ffffff;
  border-color: rgba(15, 25, 40, 0.12);
}
.node-card-empty { font-size: 11.5px; opacity: 0.55; line-height: 1.45; }
.nc-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
.nc-meta {
  display: flex; align-items: center; gap: 5px;
  font: 9.5px/1 ui-monospace, monospace;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.65;
}
.nc-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.nc-title { font-size: 13px; font-weight: 700; margin-top: 4px; }
.nc-story { font-size: 11.8px; line-height: 1.48; opacity: 0.88; margin-top: 6px; }
.nc-mute-btn {
  background: transparent;
  color: inherit;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 4px;
  padding: 3px 7px;
  font: 9px/1 ui-monospace, monospace;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  opacity: 0.72;
  flex-shrink: 0;
}
.nc-mute-btn:hover { opacity: 1; }
.nc-mute-btn.is-muted { border-color: #ff6472; color: #ff6472; opacity: 1; }
.iso[data-theme="light"] .nc-mute-btn { border-color: rgba(15, 25, 40, 0.20); }

.nc-links-block { margin-top: 8px; }
.nc-links-hdr {
  font: 9px/1 ui-monospace, monospace;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.52;
  margin-bottom: 4px;
}
.nc-links-row { display: flex; flex-wrap: wrap; gap: 4px; }
.nc-chip {
  background: rgba(255, 255, 255, 0.06);
  color: inherit;
  border: 1px solid rgba(255, 255, 255, 0.10);
  border-radius: 4px;
  padding: 3.5px 6px;
  font-size: 10.5px;
  cursor: pointer;
  text-align: left;
}
.nc-chip:hover { background: rgba(255, 255, 255, 0.12); }
.nc-chip.is-bridge {
  border-color: rgba(255, 214, 112, 0.42);
  background: rgba(255, 214, 112, 0.10);
}
.nc-chip-yr { font: 9px/1 ui-monospace, monospace; opacity: 0.58; margin-left: 3px; }
.iso[data-theme="light"] .nc-chip { background: rgba(15, 25, 40, 0.04); border-color: rgba(15, 25, 40, 0.12); }
.iso[data-theme="light"] .nc-chip.is-bridge { background: rgba(184, 58, 20, 0.08); border-color: rgba(184, 58, 20, 0.32); }

/* Resonating Now list */
.act-list { display: flex; flex-direction: column; gap: 3px; }
.act-row {
  display: grid;
  grid-template-columns: 7px 1fr auto;
  align-items: center;
  gap: 7px;
  background: transparent;
  color: inherit;
  border: 1px solid transparent;
  border-radius: 4px;
  padding: 4px 5px;
  font-size: 11.5px;
  text-align: left;
  cursor: pointer;
}
.act-row:hover { background: rgba(255, 255, 255, 0.06); }
.act-row.is-sel { background: rgba(255, 214, 112, 0.12); border-color: rgba(255, 214, 112, 0.35); }
.iso[data-theme="light"] .act-row:hover { background: rgba(15, 25, 40, 0.05); }
.hud-dot { width: 6px; height: 6px; border-radius: 50%; }
.act-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.act-tag { font: 9.5px/1 ui-monospace, monospace; opacity: 0.58; }

/* Emergent Clusters legend */
.cl-list { display: flex; flex-direction: column; gap: 5px; }
.cl-row {
  display: grid;
  grid-template-columns: 132px 1fr 30px;
  align-items: center;
  gap: 7px;
  font-size: 10.5px;
}
.cl-track { height: 5px; background: rgba(255, 255, 255, 0.08); border-radius: 3px; overflow: hidden; }
.iso[data-theme="light"] .cl-track { background: rgba(15, 25, 40, 0.09); }
.cl-fill { height: 100%; border-radius: 3px; transition: width 0.15s ease; }
.cl-val { text-align: right; font: 9.5px/1 ui-monospace, monospace; opacity: 0.65; }

.ml-link {
  display: inline-block;
  margin-top: 2px;
  font: 9.5px/1 ui-monospace, monospace;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: inherit;
  opacity: 0.45;
  text-decoration: none;
}
.ml-link:hover { opacity: 0.9; text-decoration: underline; }

@media (max-width: 900px) {
  .app-shell { flex-direction: column; height: auto; overflow-y: auto; }
  html, body { overflow: auto; }
  .viewport-main { width: 100%; height: 66vh; }
  .hud-panel { width: 100%; flex: none; height: auto; border-left: none; border-top: 1px solid rgba(255,255,255,0.1); }
  .panel-toggle-btn { display: none; }
}
`;

const stripExport = (src) => src.replace(/^export\s+(?=(const|let|var|function|class)\b)/gm, "");
const modelSrc = stripExport(readFileSync(join(HERE, "model.mjs"), "utf8"));
const liveSrc = readFileSync(join(HERE, "live.js"), "utf8");

const chapterBtnsHtml = M.CHAPTERS.map(
  (ch, i) => `<button class="chap-btn${i === 4 ? " active" : ""}" data-chapter-btn="${i}"><span>${ch.num}. ${ch.title}</span><span class="chap-yr">${ch.years}</span></button>`,
).join("\n");

const lensBtnsHtml = M.LENSES.map(
  (l, i) => `<button class="chap-btn${i === 0 ? " active" : ""}" data-lens-btn="${i}"><span>${l.title}</span></button>`,
).join("\n");

const clustersHtml = M.CLUSTERS.map(
  (c, i) => `<div class="cl-row" title="${c.desc}"><span>${c.name}</span><span class="cl-track"><div class="cl-fill" data-cluster-bar="${i}" style="width:40%"></div></span><span class="cl-val" data-cluster-val="${i}">40%</span></div>`,
).join("\n");

const bodyHtml = `
<style>${CSS}</style>
<div class="app-shell">
  <main class="viewport-main">
    <div class="top-badge">
      <div class="kicker">Personal Latent Space · 1989 → Today</div>
      <div class="title">The Nonlinear Mind</div>
      <div class="sub">5 Chapters · 42 Deconstructed Priors · 4 Emergent Facets · Retroactive Cross-Era Bridges</div>
    </div>

    <div class="lc-stage" tabindex="0">
      <svg xmlns="http://www.w3.org/2000/svg" class="lc-layer lc-svg-overlay" aria-label="Interactive 3D latent space of a nonlinear career and lived experience">
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
        <button class="cam-btn" data-zoom-out title="Zoom out (−)">−</button>
        <span class="cam-val" data-zoom-val>0.9×</span>
        <button class="cam-btn" data-zoom-in title="Zoom into cluster (+)">+</button>
      </div>
      <div class="cam-group">
        <button class="cam-btn" data-cam-spin title="Toggle slow cosmic orbit">Spin</button>
        <button class="cam-btn" data-cam-reset title="Reset camera & counterfactuals (R)">Reset</button>
      </div>
      <span class="cam-hint">DRAG ORBIT · SCROLL ZOOM · CLICK ANY STAR TO READ ITS STORY & BRIDGES</span>
    </div>
  </main>

  <aside class="hud-panel">
    <div class="mode-tabs">
      <button class="mode-tab active" data-tab-timeline>Timeline</button>
      <button class="mode-tab" data-tab-lens>Synthesis Lenses</button>
    </div>

    <div class="hud-section" data-pane-timeline>
      <div class="hud-label"><span>Life Chapters (4th Dim)</span><span data-time-val>Ch.5 · 2023 – Today</span></div>
      <div class="chap-list">${chapterBtnsHtml}</div>
      <input type="range" class="hud-slider" data-time-slider min="0.1" max="5" step="0.02" value="4.95"/>
      <div class="hud-controls">
        <button class="hud-btn" data-play-btn>Play Arc</button>
        <button class="hud-btn active" data-labels-btn>Labels</button>
        <button class="hud-btn" data-theme-btn>${theme === "light" ? "Dark" : "Light"}</button>
      </div>
    </div>

    <div class="hud-section" data-pane-lens style="display:none">
      <div class="hud-label"><span>Ask the Constellation</span><span>4 Lenses</span></div>
      <div class="chap-list">${lensBtnsHtml}</div>
    </div>

    <div class="hud-section">
      <div class="story-title" data-story-title>5. AI Builder Mode</div>
      <div class="story-text" data-story-text></div>
      <div class="echo-box" data-echo-note></div>
    </div>

    <div class="hud-section">
      <div class="hud-label"><span>Selected Memory / Prior</span><span>Click any star</span></div>
      <div class="node-card" data-node-card></div>
    </div>

    <div class="hud-section">
      <div class="hud-label"><span>Resonating Now</span><span>Gold = Earlier Echo</span></div>
      <div class="act-list" data-active-list></div>
    </div>

    <div class="hud-section">
      <div class="hud-label"><span>Emergent Facets</span><span>Organic Clusters</span></div>
      <div class="cl-list">${clustersHtml}</div>
      <a class="ml-link" href="../${theme === "light" ? "index-light.html" : "index.html"}">↗ View Technical LLM Latent Space (Phase 1)</a>
    </div>
  </aside>

  <button class="panel-toggle-btn" data-panel-toggle>Hide</button>
</div>
`;

const html = k.pageHtml({
  title: "Personal Latent Space — The Nonlinear Mind",
  theme,
  body: bodyHtml,
  script: [modelSrc, liveSrc].join("\n;\n"),
});

const outFile = join(HERE, theme === "light" ? "index-light.html" : "index.html");
writeFileSync(outFile, html, "utf8");
console.log(`Built ${outFile} (${(html.length / 1024).toFixed(1)} KB)`);

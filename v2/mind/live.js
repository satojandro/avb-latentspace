(() => {
  const stage = document.querySelector(".lc-stage");
  const canvas = stage.querySelector(".lc-gl");
  const svgOverlays = [...stage.querySelectorAll(".lc-svg-overlay")];
  const cubeBackG = stage.querySelector("[data-cube-back]");
  const cubeFrontG = stage.querySelector("[data-cube-front]");
  const labelsG = stage.querySelector("[data-labels]");

  // Story Inspector DOM
  const hudPanel = document.querySelector(".hud-panel");
  const panelToggleBtn = document.querySelector("[data-panel-toggle]");
  const tabTimelineBtn = document.querySelector("[data-tab-timeline]");
  const tabLensBtn = document.querySelector("[data-tab-lens]");
  const timelinePane = document.querySelector("[data-pane-timeline]");
  const lensPane = document.querySelector("[data-pane-lens]");
  const chapterBtns = [...document.querySelectorAll("[data-chapter-btn]")];
  const lensBtns = [...document.querySelectorAll("[data-lens-btn]")];
  const timeSlider = document.querySelector("[data-time-slider]");
  const timeValEl = document.querySelector("[data-time-val]");
  const playBtn = document.querySelector("[data-play-btn]");
  const labelsBtn = document.querySelector("[data-labels-btn]");
  const themeBtn = document.querySelector("[data-theme-btn]");
  const storyTitleEl = document.querySelector("[data-story-title]");
  const storyTextEl = document.querySelector("[data-story-text]");
  const echoNoteEl = document.querySelector("[data-echo-note]");
  const nodeCardEl = document.querySelector("[data-node-card]");
  const activeListEl = document.querySelector("[data-active-list]");
  const clusterBars = [...document.querySelectorAll("[data-cluster-bar]")];
  const clusterVals = [...document.querySelectorAll("[data-cluster-val]")];

  // Floating camera controls
  const zoomInBtn = document.querySelector("[data-zoom-in]");
  const zoomOutBtn = document.querySelector("[data-zoom-out]");
  const zoomReadout = document.querySelector("[data-zoom-val]");
  const resetCamBtn = document.querySelector("[data-cam-reset]");
  const spinBtn = document.querySelector("[data-cam-spin]");

  // 4 Emergent Cluster Palettes (Dark & Light)
  const CLUSTER_RGB_DARK = [
    [0.34, 0.74, 1.0],   // Systems & Sovereignty (cyan)
    [0.98, 0.70, 0.28],  // Agency & Exit (amber)
    [0.24, 0.88, 0.68],  // Frontier Tech & Craft (emerald)
    [0.86, 0.46, 0.96],  // Narrative & Bridges (violet)
  ];
  const CLUSTER_RGB_LIGHT = [
    [0.08, 0.40, 0.76],
    [0.74, 0.36, 0.04],
    [0.05, 0.52, 0.38],
    [0.54, 0.16, 0.66],
  ];
  const CLUSTER_HEX_DARK = ["#58bdff", "#fab248", "#3de0ae", "#db75f5"];
  const CLUSTER_HEX_LIGHT = ["#1466c2", "#bd5c0a", "#0d8561", "#8a29a8"];

  const state = {
    mode: "timeline", // "timeline" | "lens"
    timeDepth: 4.95,  // Start near Today so the full living galaxy & retroactive echoes shine on first load!
    lensIdx: 0,
    playing: false,
    showLabels: true,
    selectedNode: 34, // "Removing the last middleman" — showcases cross-era synthesis immediately
    hoveredNode: -1,
    muted: {},        // nodeId -> true ("What if?" counterfactual mute)
    autoSpin: false,
    az: 0.68,
    el: 0.42,
    zoom: 0.94,
    targetAz: 0.68,
    targetEl: 0.42,
    targetZoom: 0.94,
    cw: 960,
    ch: 760,
    dpr: 1,
  };

  const isLight = () => document.body.getAttribute("data-theme") === "light";

  // =========================================================================
  // 1. SHARED 3D ORBIT + PERSPECTIVE CAMERA (IDENTICAL IN JS & GLSL)
  // =========================================================================
  const CAM_DIST = 5.2;

  function camBasis(az, el) {
    const ca = Math.cos(az), sa = Math.sin(az);
    const ce = Math.cos(el), se = Math.sin(el);
    return {
      right: [-sa, ca, 0],
      up: [-se * ca, -se * sa, ce],
      fwd: [ce * ca, ce * sa, se],
    };
  }

  function proj3(p, basis, cw, ch, zoom) {
    const vx = p[0] * basis.right[0] + p[1] * basis.right[1] + p[2] * basis.right[2];
    const vy = p[0] * basis.up[0] + p[1] * basis.up[1] + p[2] * basis.up[2];
    const vz = p[0] * basis.fwd[0] + p[1] * basis.fwd[1] + p[2] * basis.fwd[2];
    const persp = CAM_DIST / Math.max(0.85, CAM_DIST - vz);
    const S = Math.min(cw, ch) * 0.34 * zoom;
    return [cw * 0.5 + vx * persp * S, ch * 0.5 - vy * persp * S, vz, persp];
  }

  // =========================================================================
  // 2. NATIVE WEBGL1 GALAXY RENDERER (LINES + ANALYTIC SDF POINTS)
  // =========================================================================
  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: true,
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,
  });

  let lineProg = null;
  let pointProg = null;
  let lineBuf = null;
  let pointBuf = null;

  function compileShader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error("Shader compile error:", gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  function linkProgram(vsSrc, fsSrc) {
    const vs = compileShader(gl.VERTEX_SHADER, vsSrc);
    const fs = compileShader(gl.FRAGMENT_SHADER, fsSrc);
    if (!vs || !fs) return null;
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error("Program link error:", gl.getProgramInfoLog(p));
      return null;
    }
    return p;
  }

  if (gl) {
    const CAM_GLSL = `
      uniform vec3 uRight;
      uniform vec3 uUp;
      uniform vec3 uFwd;
      uniform vec2 uRes;
      uniform float uScale;
      vec4 project3D(vec3 p, out float depthFade, out float persp) {
        float vx = dot(p, uRight);
        float vy = dot(p, uUp);
        float vz = dot(p, uFwd);
        persp = 5.2 / max(0.85, 5.2 - vz);
        float nx = (vx * persp * uScale) / (uRes.x * 0.5);
        float ny = (vy * persp * uScale) / (uRes.y * 0.5);
        float nz = -vz / 3.2;
        depthFade = clamp(0.45 + 0.55 * (vz + 1.4) / 2.8, 0.25, 1.0);
        return vec4(nx, ny, nz, 1.0);
      }
    `;

    const lineVS = `
      precision highp float;
      attribute vec3 aPos;
      attribute vec4 aCol;
      varying vec4 vCol;
      ${CAM_GLSL}
      void main() {
        float df, persp;
        gl_Position = project3D(aPos, df, persp);
        vCol = vec4(aCol.rgb, aCol.a * df);
      }
    `;
    const lineFS = `
      precision highp float;
      varying vec4 vCol;
      void main() { gl_FragColor = vCol; }
    `;

    const pointVS = `
      precision highp float;
      attribute vec3 aPos;
      attribute vec4 aCol;
      attribute vec4 aMeta;
      uniform float uDpr;
      varying vec4 vCol;
      varying vec4 vMeta;
      varying float vDepth;
      ${CAM_GLSL}
      void main() {
        float df, persp;
        gl_Position = project3D(aPos, df, persp);
        gl_PointSize = clamp(aMeta.x * uDpr * (0.72 + 0.28 * persp), 1.5, 56.0);
        vCol = aCol;
        vMeta = aMeta;
        vDepth = df;
      }
    `;
    const pointFS = `
      precision highp float;
      varying vec4 vCol;
      varying vec4 vMeta;
      varying float vDepth;
      uniform float uLight;
      void main() {
        vec2 uv = gl_PointCoord * 2.0 - 1.0;
        float r = length(uv);
        if (r > 1.0) discard;

        float mode = vMeta.y;
        float ringInt = vMeta.z;
        float extra = vMeta.w;
        vec3 col = vCol.rgb;
        float alpha = 0.0;

        if (mode < 0.5) {
          // Mode 0: Crisp pinpoint lived-experience background star
          float core = smoothstep(0.76, 0.14, r);
          alpha = core * vCol.a * (0.45 + 0.55 * vDepth);
        } else if (mode < 1.5) {
          // Mode 1: Named Experience / Mental-Model Node
          float coreR = mix(0.24, 0.34, clamp(ringInt, 0.0, 1.0));
          float core = smoothstep(coreR + 0.14, coreR - 0.06, r);
          float hot = exp(-r * r * 24.0);
          float ring = exp(-pow((r - 0.78) * 14.0, 2.0)) * ringInt;
          // Muted ("What if?") node: hollow dim ring
          if (extra < -0.5) {
            core *= 0.14;
            hot = 0.0;
            ring = exp(-pow((r - 0.68) * 13.0, 2.0)) * 0.85;
          }
          // Retroactive Echo or Selected node: crisp double ring
          if (extra > 0.5) {
            ring = max(ring, exp(-pow((r - 0.84) * 16.0, 2.0)) * 0.95);
            ring = max(ring, exp(-pow((r - 0.56) * 16.0, 2.0)) * 0.65);
          }
          if (uLight < 0.5) col = mix(col, vec3(1.0), hot * 0.65);
          else col = mix(col, col * 0.45, hot * 0.3);
          alpha = clamp(core * 0.95 + ring * 0.85, 0.0, 1.0) * vCol.a * (0.48 + 0.52 * vDepth);
        } else if (mode < 2.5) {
          // Mode 2: Traveling bridge light packet / chapter waypoint
          float core = smoothstep(0.48, 0.12, r);
          float rim = exp(-pow((r - 0.78) * 14.0, 2.0)) * ringInt;
          if (uLight < 0.5) col = mix(col, vec3(1.0), exp(-r * r * 18.0) * 0.6);
          alpha = clamp(core + rim * 0.8, 0.0, 1.0) * vCol.a * (0.55 + 0.45 * vDepth);
        } else {
          // Mode 3: Selected node / active timeline optical reticle
          float core = smoothstep(0.22, 0.05, r);
          float ring1 = exp(-pow((r - 0.60) * 18.0, 2.0)) * 0.95;
          float ring2 = exp(-pow((r - 0.88) * 20.0, 2.0)) * 0.48;
          float crossX = exp(-pow(uv.y * 16.0, 2.0)) * step(0.36, abs(uv.x)) * step(abs(uv.x), 0.92);
          float crossY = exp(-pow(uv.x * 16.0, 2.0)) * step(0.36, abs(uv.y)) * step(abs(uv.y), 0.92);
          if (uLight < 0.5) col = mix(col, vec3(1.0), core * 0.7);
          alpha = clamp(core + ring1 + ring2 + max(crossX, crossY) * 0.6, 0.0, 1.0) * vCol.a;
        }

        if (alpha < 0.004) discard;
        gl_FragColor = vec4(col, alpha);
      }
    `;

    lineProg = linkProgram(lineVS, lineFS);
    pointProg = linkProgram(pointVS, pointFS);
    lineBuf = gl.createBuffer();
    pointBuf = gl.createBuffer();
  }

  const MAX_LINE_VERTS = 5400;
  const lineData = new Float32Array(MAX_LINE_VERTS * 7);
  const MAX_POINTS = 2200;
  const pointData = new Float32Array(MAX_POINTS * 11);
  let lineVerts = 0;
  let pointCount = 0;

  function pushLine(a, b, r, g, bl, alpha) {
    if (lineVerts + 2 > MAX_LINE_VERTS) return;
    let o = lineVerts * 7;
    lineData[o++] = a[0]; lineData[o++] = a[1]; lineData[o++] = a[2];
    lineData[o++] = r; lineData[o++] = g; lineData[o++] = bl; lineData[o++] = alpha;
    lineData[o++] = b[0]; lineData[o++] = b[1]; lineData[o++] = b[2];
    lineData[o++] = r; lineData[o++] = g; lineData[o++] = bl; lineData[o++] = alpha;
    lineVerts += 2;
  }

  function pushPoint(p, r, g, b, a, size, mode, ring = 0, extra = 0) {
    if (pointCount + 1 > MAX_POINTS) return;
    let o = pointCount * 11;
    pointData[o++] = p[0]; pointData[o++] = p[1]; pointData[o++] = p[2];
    pointData[o++] = r; pointData[o++] = g; pointData[o++] = b; pointData[o++] = a;
    pointData[o++] = size; pointData[o++] = mode; pointData[o++] = ring; pointData[o++] = extra;
    pointCount++;
  }

  const CUBE_VERTS = [
    [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
    [-1, -1,  1], [1, -1,  1], [1, 1,  1], [-1, 1,  1],
  ];
  const CUBE_EDGES = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  const CUBE_FACES = [
    { idx: [0, 1, 2, 3], n: [0, 0, -1], grid: true },
    { idx: [4, 5, 6, 7], n: [0, 0,  1], grid: false },
    { idx: [0, 1, 5, 4], n: [0, -1, 0], grid: true },
    { idx: [3, 2, 6, 7], n: [0,  1, 0], grid: true },
    { idx: [0, 3, 7, 4], n: [-1, 0, 0], grid: true },
    { idx: [1, 2, 6, 5], n: [ 1, 0, 0], grid: true },
  ];

  function lerp3(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }

  function resizeViewport() {
    const rect = stage.getBoundingClientRect();
    const cw = Math.max(200, Math.round(rect.width));
    const ch = Math.max(200, Math.round(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (cw !== state.cw || ch !== state.ch || dpr !== state.dpr) {
      state.cw = cw;
      state.ch = ch;
      state.dpr = dpr;
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
      for (const s of svgOverlays) s.setAttribute("viewBox", `0 0 ${cw} ${ch}`);
    }
  }
  window.addEventListener("resize", resizeViewport);

  // =========================================================================
  // 3. SVG OPTICAL CUBE FRAME + DE-OVERLAPPED HUMAN LABELS
  // =========================================================================
  function renderSvgFrameAndLabels(basis, evalRes) {
    const { cw, ch, zoom } = state;
    const light = isLight();
    const hexPal = light ? CLUSTER_HEX_LIGHT : CLUSTER_HEX_DARK;
    const pVerts = CUBE_VERTS.map((v) => proj3(v, basis, cw, ch, zoom));

    const backPaths = [];
    const backGrid = [];
    for (const f of CUBE_FACES) {
      const nd = f.n[0] * basis.fwd[0] + f.n[1] * basis.fwd[1] + f.n[2] * basis.fwd[2];
      if (nd < -0.02) {
        const pts = f.idx.map((i) => `${pVerts[i][0].toFixed(1)},${pVerts[i][1].toFixed(1)}`).join(" L");
        const isFloor = f.n[2] < -0.5;
        backPaths.push(`<path class="${isFloor ? "lc-face-floor" : "lc-face-wall"}" d="M${pts} Z"/>`);
        if (f.grid) {
          const c0 = CUBE_VERTS[f.idx[0]], c1 = CUBE_VERTS[f.idx[1]];
          const c2 = CUBE_VERTS[f.idx[2]], c3 = CUBE_VERTS[f.idx[3]];
          for (let g = 1; g < 4; g++) {
            const t = g / 4;
            const a1 = proj3(lerp3(c0, c1, t), basis, cw, ch, zoom);
            const b1 = proj3(lerp3(c3, c2, t), basis, cw, ch, zoom);
            const a2 = proj3(lerp3(c0, c3, t), basis, cw, ch, zoom);
            const b2 = proj3(lerp3(c1, c2, t), basis, cw, ch, zoom);
            backGrid.push(`M${a1[0].toFixed(1)},${a1[1].toFixed(1)} L${b1[0].toFixed(1)},${b1[1].toFixed(1)}`);
            backGrid.push(`M${a2[0].toFixed(1)},${a2[1].toFixed(1)} L${b2[0].toFixed(1)},${b2[1].toFixed(1)}`);
          }
        }
      }
    }

    const backEdgeD = [];
    const frontEdgeD = [];
    for (const [i, j] of CUBE_EDGES) {
      const a = pVerts[i], b = pVerts[j];
      const d = `M${a[0].toFixed(1)},${a[1].toFixed(1)} L${b[0].toFixed(1)},${b[1].toFixed(1)}`;
      if ((a[2] + b[2]) * 0.5 < -0.15) backEdgeD.push(d);
      else frontEdgeD.push(d);
    }

    const cornerTicks = [];
    const tickLen = 0.085;
    for (let i = 0; i < 8; i++) {
      const v = CUBE_VERTS[i];
      const p0 = pVerts[i];
      for (let axis = 0; axis < 3; axis++) {
        const v2 = v.slice();
        v2[axis] -= Math.sign(v[axis]) * tickLen;
        const p1 = proj3(v2, basis, cw, ch, zoom);
        cornerTicks.push(`M${p0[0].toFixed(1)},${p0[1].toFixed(1)} L${p1[0].toFixed(1)},${p1[1].toFixed(1)}`);
      }
    }

    cubeBackG.innerHTML =
      backPaths.join("") +
      (backGrid.length ? `<path class="lc-cube-grid" d="${backGrid.join(" ")}"/>` : "") +
      (backEdgeD.length ? `<path class="lc-cube-edge-back" d="${backEdgeD.join(" ")}"/>` : "");

    cubeFrontG.innerHTML =
      (frontEdgeD.length ? `<path class="lc-cube-edge-front" d="${frontEdgeD.join(" ")}"/>` : "") +
      `<path class="lc-cube-corners" d="${cornerTicks.join(" ")}"/>`;

    if (!state.showLabels) {
      labelsG.innerHTML = "";
      return;
    }

    const items = [];
    const placed = [];
    const overlaps = (x0, y0, x1, y1) => {
      for (let k = 0; k < placed.length; k++) {
        const b = placed[k];
        if (x0 < b[2] && x1 > b[0] && y0 < b[3] && y1 > b[1]) return true;
      }
      return false;
    };

    // Rank nodes by priority: selected > hovered > retroactive echoes > active anchors > active features
    const maxLabels = Math.min(20, Math.round(9 + Math.max(0, zoom - 0.9) * 6.0));
    const ranked = NODES.map((n, i) => {
      const a = evalRes.acts[i];
      const echo = evalRes.echoes[i];
      const isSel = i === state.selectedNode;
      const isHov = i === state.hoveredNode;
      const isBorn = state.mode === "lens" || n.bornAt <= state.timeDepth;
      const score = !isBorn ? -1
        : (isSel ? 10 : 0) + (isHov ? 8 : 0) + echo * 2.2 + a * (n.kind === "anchor" ? 1.4 : 1.0);
      return { i, a, echo, isSel, isHov, isBorn, score };
    })
      .filter((x) => x.isBorn && (x.score > 0.45 || zoom > 1.8))
      .sort((x, y) => y.score - x.score)
      .slice(0, maxLabels);

    const offsets = [[10, 3], [10, -11], [10, 17], [-10, 3], [-10, -11], [-10, 17], [10, -25], [10, 31]];
    for (const r of ranked) {
      const n = NODES[r.i];
      const sp = proj3(NODE_POS3[r.i], basis, cw, ch, zoom);
      if (sp[0] < 16 || sp[0] > cw - 16 || sp[1] < 18 || sp[1] > ch - 18) continue;

      const isMuted = !!state.muted[r.i];
      const isEcho = r.echo > 0.3;
      const col = isMuted
        ? "#ff6472"
        : r.isSel
          ? (light ? "#0f2c66" : "#fff5cc")
          : isEcho
            ? (light ? "#b83a14" : "#ffe08a")
            : hexPal[n.cluster];

      const suffix = r.isSel || r.isHov ? ` · ${n.year}` : isEcho ? ` · Ch.${n.chapter + 1}` : "";
      const txt = `${n.name}${suffix}`;
      const tw = txt.length * 5.7;

      let chosen = null;
      for (const [ox, oy] of offsets) {
        const anchor = ox >= 0 ? "start" : "end";
        const lx = sp[0] + ox;
        const ly = sp[1] + oy;
        const rx0 = anchor === "start" ? lx : lx - tw;
        if (!overlaps(rx0 - 2, ly - 9, rx0 + tw + 2, ly + 4)) {
          chosen = { ox, oy, lx, ly, anchor, rx0 };
          break;
        }
      }
      if (!chosen && !r.isSel && !r.isHov) continue;
      if (!chosen) chosen = { ox: 10, oy: 3, lx: sp[0] + 10, ly: sp[1] + 3, anchor: "start", rx0: sp[0] + 10 };
      placed.push([chosen.rx0 - 2, chosen.ly - 9, chosen.rx0 + tw + 2, chosen.ly + 4]);

      const opacity = r.isSel || r.isHov || isEcho ? 1.0 : Math.min(0.92, 0.45 + r.a * 0.52);
      const leader = Math.abs(chosen.oy) > 6 || r.isSel
        ? `<line x1="${sp[0].toFixed(1)}" y1="${sp[1].toFixed(1)}" x2="${(chosen.lx + (chosen.ox > 0 ? -2 : 2)).toFixed(1)}" y2="${(chosen.ly - 3).toFixed(1)}" stroke="${col}" stroke-width="0.65" opacity="0.5"/>`
        : "";
      items.push(
        `<g class="lc-node-tag${r.isSel ? " is-sel" : ""}${r.isHov ? " is-hov" : ""}" style="opacity:${opacity.toFixed(2)}">` +
        leader +
        `<text x="${chosen.lx.toFixed(1)}" y="${chosen.ly.toFixed(1)}" text-anchor="${chosen.anchor}" fill="${col}">${txt}</text></g>`,
      );
    }

    labelsG.innerHTML = items.join("");
  }

  // =========================================================================
  // 4. STORY INSPECTOR HUD UPDATES
  // =========================================================================
  let lastHudKey = "";
  function renderNodeCard() {
    const id = state.selectedNode;
    if (id < 0 || id >= N_NODES) {
      nodeCardEl.innerHTML = `<div class="node-card-empty">Click any glowing star in the cube to inspect its story and hidden cross-era connections.</div>`;
      return;
    }
    const n = NODES[id];
    const ch = CHAPTERS[n.chapter];
    const cl = CLUSTERS[n.cluster];
    const hexPal = isLight() ? CLUSTER_HEX_LIGHT : CLUSTER_HEX_DARK;
    const col = hexPal[n.cluster];
    const isMuted = !!state.muted[id];

    const informedBy = EDGES.filter(([, to]) => to === id).map(([from, , , isBridge, note]) => ({
      id: from, node: NODES[from], isBridge, note,
    }));
    const echoedIn = EDGES.filter(([from]) => from === id).map(([, to, , isBridge, note]) => ({
      id: to, node: NODES[to], isBridge, note,
    }));

    const linksHtml = (list, label, arrow) => {
      if (!list.length) return "";
      return (
        `<div class="nc-links-block"><div class="nc-links-hdr">${label}</div><div class="nc-links-row">` +
        list.map((item) =>
          `<button class="nc-chip${item.isBridge ? " is-bridge" : ""}" data-jump-node="${item.id}" title="${item.note}">` +
          `${arrow} ${item.node.name} <span class="nc-chip-yr">Ch.${item.node.chapter + 1}</span></button>`,
        ).join("") +
        `</div></div>`
      );
    };

    nodeCardEl.innerHTML = `
      <div class="nc-head">
        <div>
          <div class="nc-meta">
            <span class="nc-dot" style="background:${col}"></span>
            <span>${cl.name}</span>
            <span>·</span>
            <span>Ch.${ch.num} (${n.year})</span>
          </div>
          <div class="nc-title">${n.name}</div>
        </div>
        <button class="nc-mute-btn${isMuted ? " is-muted" : ""}" data-toggle-mute="${id}" title="Counterfactual: see what disconnects if this experience is muted">
          ${isMuted ? "Restore" : "What if?"}
        </button>
      </div>
      <div class="nc-story">${n.story}</div>
      ${linksHtml(informedBy, "Informed by", "←")}
      ${linksHtml(echoedIn, "Echoed later in", "→")}
    `;
  }

  function updateHud(evalRes, force = false) {
    const curChap = Math.min(4, Math.floor(state.timeDepth));
    const key = `${state.mode}|${state.timeDepth.toFixed(2)}|${state.lensIdx}|${state.selectedNode}|${Object.keys(state.muted).join(",")}|${isLight()}`;
    if (!force && key === lastHudKey) return;
    lastHudKey = key;

    const hexPal = isLight() ? CLUSTER_HEX_LIGHT : CLUSTER_HEX_DARK;

    // Mode panes
    tabTimelineBtn.classList.toggle("active", state.mode === "timeline");
    tabLensBtn.classList.toggle("active", state.mode === "lens");
    timelinePane.style.display = state.mode === "timeline" ? "block" : "none";
    lensPane.style.display = state.mode === "lens" ? "block" : "none";

    if (state.mode === "timeline") {
      const ch = CHAPTERS[curChap];
      timeValEl.textContent = `Ch.${ch.num} · ${ch.years}`;
      if (document.activeElement !== timeSlider) timeSlider.value = state.timeDepth.toFixed(2);
      chapterBtns.forEach((b, i) => b.classList.toggle("active", i === curChap));
      storyTitleEl.textContent = `${ch.num}. ${ch.title}`;
      storyTextEl.textContent = ch.summary;
      echoNoteEl.textContent = ch.echoNote;
    } else {
      const lens = LENSES[state.lensIdx];
      lensBtns.forEach((b, i) => b.classList.toggle("active", i === state.lensIdx));
      storyTitleEl.textContent = lens.title;
      storyTextEl.textContent = lens.summary;
      echoNoteEl.textContent = lens.subtitle;
    }

    // Cluster resonance meters
    for (let c = 0; c < 4; c++) {
      const pct = Math.round(evalRes.clusterLevels[c] * 100);
      clusterBars[c].style.width = `${pct}%`;
      clusterBars[c].style.background = hexPal[c];
      clusterVals[c].textContent = `${pct}%`;
    }

    // Active resonating nodes list (top 6 clickable)
    const topNodes = NODES.map((n, i) => ({
      n, i, a: evalRes.acts[i], echo: evalRes.echoes[i],
    }))
      .filter((x) => x.a > 0.25)
      .sort((x, y) => (y.echo * 0.6 + y.a) - (x.echo * 0.6 + x.a))
      .slice(0, 6);

    activeListEl.innerHTML = topNodes.map(({ n, i, a, echo }) => {
      const isEcho = echo > 0.3;
      const isSel = i === state.selectedNode;
      const col = isEcho ? (isLight() ? "#b83a14" : "#ffe08a") : hexPal[n.cluster];
      return (
        `<button class="act-row${isSel ? " is-sel" : ""}" data-select-node="${i}">` +
        `<span class="hud-dot" style="background:${col}"></span>` +
        `<span class="act-name">${n.name}</span>` +
        `<span class="act-tag">${isEcho ? `ECHO Ch.${n.chapter + 1}` : n.year}</span></button>`
      );
    }).join("");

    renderNodeCard();
    if (zoomReadout) zoomReadout.textContent = `${state.zoom.toFixed(1)}×`;
  }

  // =========================================================================
  // 5. MAIN 60FPS RENDER LOOP
  // =========================================================================
  let lastT = performance.now();

  function renderFrame(now) {
    const dt = Math.min(0.05, (now - lastT) * 0.001);
    lastT = now;

    resizeViewport();

    if (state.playing && state.mode === "timeline") {
      state.timeDepth += dt * 0.38;
      if (state.timeDepth > 5.2) state.timeDepth = 0.08;
    }
    if (state.autoSpin) {
      state.targetAz += dt * 0.14;
    }

    const damp = 1 - Math.exp(-12 * dt);
    state.az += (state.targetAz - state.az) * damp;
    state.el += (state.targetEl - state.el) * damp;
    state.zoom += (state.targetZoom - state.zoom) * damp;

    const effTime = Math.min(5.0, state.timeDepth);
    const evalRes = evaluateState(state.mode, effTime, state.lensIdx, state.muted);
    const basis = camBasis(state.az, state.el);
    const light = isLight();
    const pal = light ? CLUSTER_RGB_LIGHT : CLUSTER_RGB_DARK;
    const goldCol = light ? [0.78, 0.24, 0.10] : [1.0, 0.85, 0.44];

    if (gl && lineProg && pointProg) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, light ? gl.ONE_MINUS_SRC_ALPHA : gl.ONE);

      lineVerts = 0;
      pointCount = 0;
      const tSec = now * 0.001;
      const zoomBoost = Math.pow(state.zoom, 0.35);

      // --- A. LINES ---
      // 1. Growing background lived-experience manifold web
      const webAlpha = light ? 0.12 : 0.14;
      for (let i = 0; i < BG_EDGES.length; i++) {
        const [aIdx, bIdx, w, born] = BG_EDGES[i];
        if (state.mode === "timeline" && born > effTime) continue;
        const c = pal[BG_CLUSTER[aIdx]];
        pushLine(BG_POS3[aIdx], BG_POS3[bIdx], c[0], c[1], c[2], webAlpha * (0.45 + 0.55 * w));
      }

      // 2. Meaningful Experience Edges & Retroactive Cross-Era Bridges
      for (let i = 0; i < evalRes.activeEdges.length; i++) {
        const e = evalRes.activeEdges[i];
        const isSelEdge = e.a === state.selectedNode || e.b === state.selectedNode;
        const pA = NODE_POS3[e.a], pB = NODE_POS3[e.b];

        if (e.isRetro || isSelEdge) {
          // Luminous golden bridge connecting eras!
          const alpha = isSelEdge ? 0.85 : 0.28 + e.flow * 0.56;
          pushLine(pA, pB, goldCol[0], goldCol[1], goldCol[2], alpha);
          // Crisp traveling light pulse from earlier chapter -> later chapter
          const phase = (tSec * (0.34 + 0.25 * e.flow) + i * 0.17) % 1.0;
          const pkt = lerp3(pA, pB, phase);
          pushPoint(pkt, light ? goldCol[0] : 1.0, light ? goldCol[1] : 0.95, light ? goldCol[2] : 0.78, 0.92, 3.4 * zoomBoost, 2, 0.0, 0);
        } else {
          const c = pal[NODES[e.a].cluster];
          pushLine(pA, pB, c[0], c[1], c[2], 0.08 + e.flow * 0.38);
        }
      }

      // 3. Smooth Life Trajectory / Lens Synthesis Path
      const pathPts = state.mode === "timeline"
        ? CHAPTER_POS3
        : LENSES[state.lensIdx].path.map((id) => NODE_POS3[id]);
      const nSegs = pathPts.length - 1;
      const subSteps = 6;
      const progress = state.mode === "timeline" ? Math.max(0, effTime - 0.5) : nSegs;

      for (let seg = 0; seg < nSegs; seg++) {
        const p0 = pathPts[Math.max(0, seg - 1)];
        const p1 = pathPts[seg];
        const p2 = pathPts[seg + 1];
        const p3 = pathPts[Math.min(nSegs, seg + 2)];
        let prev = p1;
        for (let k = 1; k <= subSteps; k++) {
          const t = k / subSteps;
          const t2 = t * t, t3 = t2 * t;
          const cur = [0, 1, 2].map((d) =>
            0.5 * (
              2 * p1[d] +
              (-p0[d] + p2[d]) * t +
              (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 +
              (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3
            ),
          );
          if (seg + t <= progress) {
            pushLine(prev, cur, goldCol[0], goldCol[1], goldCol[2], 0.58);
          }
          prev = cur;
        }
      }

      // --- B. POINTS ---
      // 1. 1,600 Growing Background Lived-Experience Stars
      const activeIdx = [];
      for (let i = 0; i < N_NODES; i++) if (evalRes.acts[i] > 0.55) activeIdx.push(i);

      for (let i = 0; i < N_BG; i++) {
        if (state.mode === "timeline" && BG_BORN[i] > effTime) continue;
        const bp = BG_POS3[i];
        const c = pal[BG_CLUSTER[i]];
        const w = BG_WEIGHT[i];
        let symp = 0;
        for (let k = 0; k < activeIdx.length; k++) {
          const fp = NODE_POS3[activeIdx[k]];
          const dx = bp[0] - fp[0], dy = bp[1] - fp[1], dz = bp[2] - fp[2];
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < 0.075) symp = Math.max(symp, (1.0 - d2 / 0.075) * evalRes.acts[activeIdx[k]]);
        }
        const baseA = light ? 0.28 + 0.28 * w : 0.30 + 0.34 * w;
        const alpha = Math.min(0.9, baseA + symp * 0.36);
        const sz = (2.1 + 1.9 * w + symp * 1.5) * zoomBoost;
        pushPoint(bp, c[0], c[1], c[2], alpha, sz, 0, 0, 0);
      }

      // 2. 42 Named Experience & Mental-Model Nodes
      for (let i = 0; i < N_NODES; i++) {
        const n = NODES[i];
        if (state.mode === "timeline" && n.bornAt > effTime) continue;

        const a = evalRes.acts[i];
        const echo = evalRes.echoes[i];
        const isSel = i === state.selectedNode;
        const isHov = i === state.hoveredNode;
        const isMuted = !!state.muted[i];

        let c = pal[n.cluster];
        let ring = a > 0.55 ? 0.85 : n.kind === "anchor" ? 0.3 : 0.0;
        let extra = 0;
        let sz = (n.kind === "anchor" ? 5.2 : 3.8) + a * 5.2;
        let alpha = 0.45 + a * 0.55;

        if (isMuted) {
          c = light ? [0.76, 0.14, 0.22] : [1.0, 0.38, 0.44];
          extra = -1.0;
          ring = 1.0;
          sz = 9.0;
          alpha = 0.85;
        } else if (echo > 0.3) {
          // Retroactive echo from an earlier chapter!
          c = goldCol;
          extra = 1.0;
          ring = 1.0;
          sz = 11.2;
          alpha = 1.0;
        } else if (isHov) {
          ring = 1.0;
          sz = Math.max(sz, 11.5);
          alpha = 1.0;
        }
        pushPoint(NODE_POS3[i], c[0], c[1], c[2], alpha, sz * zoomBoost, 1, ring, extra);

        if (isSel) {
          const selCol = light ? [0.06, 0.20, 0.48] : [1.0, 0.94, 0.72];
          pushPoint(NODE_POS3[i], selCol[0], selCol[1], selCol[2], 1.0, 17.5 * zoomBoost, 3, 1.0, 0);
        }
      }

      // Upload & Draw
      const camScale = Math.min(state.cw, state.ch) * 0.34 * state.zoom;
      const setCamUniforms = (prog) => {
        gl.uniform3fv(gl.getUniformLocation(prog, "uRight"), basis.right);
        gl.uniform3fv(gl.getUniformLocation(prog, "uUp"), basis.up);
        gl.uniform3fv(gl.getUniformLocation(prog, "uFwd"), basis.fwd);
        gl.uniform2f(gl.getUniformLocation(prog, "uRes"), state.cw, state.ch);
        gl.uniform1f(gl.getUniformLocation(prog, "uScale"), camScale);
      };

      gl.useProgram(lineProg);
      setCamUniforms(lineProg);
      gl.bindBuffer(gl.ARRAY_BUFFER, lineBuf);
      gl.bufferData(gl.ARRAY_BUFFER, lineData.subarray(0, lineVerts * 7), gl.DYNAMIC_DRAW);
      const lPos = gl.getAttribLocation(lineProg, "aPos");
      const lCol = gl.getAttribLocation(lineProg, "aCol");
      gl.enableVertexAttribArray(lPos);
      gl.enableVertexAttribArray(lCol);
      gl.vertexAttribPointer(lPos, 3, gl.FLOAT, false, 28, 0);
      gl.vertexAttribPointer(lCol, 4, gl.FLOAT, false, 28, 12);
      gl.drawArrays(gl.LINES, 0, lineVerts);

      gl.useProgram(pointProg);
      setCamUniforms(pointProg);
      gl.uniform1f(gl.getUniformLocation(pointProg, "uDpr"), state.dpr);
      gl.uniform1f(gl.getUniformLocation(pointProg, "uLight"), light ? 1.0 : 0.0);
      gl.bindBuffer(gl.ARRAY_BUFFER, pointBuf);
      gl.bufferData(gl.ARRAY_BUFFER, pointData.subarray(0, pointCount * 11), gl.DYNAMIC_DRAW);
      const pPos = gl.getAttribLocation(pointProg, "aPos");
      const pCol = gl.getAttribLocation(pointProg, "aCol");
      const pMeta = gl.getAttribLocation(pointProg, "aMeta");
      gl.enableVertexAttribArray(pPos);
      gl.enableVertexAttribArray(pCol);
      gl.enableVertexAttribArray(pMeta);
      gl.vertexAttribPointer(pPos, 3, gl.FLOAT, false, 44, 0);
      gl.vertexAttribPointer(pCol, 4, gl.FLOAT, false, 44, 12);
      gl.vertexAttribPointer(pMeta, 4, gl.FLOAT, false, 44, 28);
      gl.drawArrays(gl.POINTS, 0, pointCount);
    }

    renderSvgFrameAndLabels(basis, evalRes);
    updateHud(evalRes);

    requestAnimationFrame(renderFrame);
  }

  // =========================================================================
  // 6. INTERACTION: 3D ORBIT, ZOOM, CLICK NODE TO INSPECT STORY
  // =========================================================================
  function stageLocal(e) {
    const r = stage.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  function findNearestNode(mx, my, maxPx = 16) {
    const basis = camBasis(state.az, state.el);
    let best = -1;
    let bestD = maxPx;
    for (let i = 0; i < N_NODES; i++) {
      if (state.mode === "timeline" && NODES[i].bornAt > state.timeDepth) continue;
      const sp = proj3(NODE_POS3[i], basis, state.cw, state.ch, state.zoom);
      const d = Math.hypot(sp[0] - mx, sp[1] - my);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  let dragging = false;
  let dragPrev = [0, 0];
  let dragMoved = 0;

  stage.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    stage.setPointerCapture(e.pointerId);
    dragging = true;
    dragPrev = stageLocal(e);
    dragMoved = 0;
    if (state.autoSpin) {
      state.autoSpin = false;
      if (spinBtn) spinBtn.classList.remove("active");
    }
  });

  stage.addEventListener("pointermove", (e) => {
    const pt = stageLocal(e);
    if (!dragging) {
      state.hoveredNode = findNearestNode(pt[0], pt[1], 16);
      stage.style.cursor = state.hoveredNode >= 0 ? "pointer" : "grab";
      return;
    }
    const dx = pt[0] - dragPrev[0];
    const dy = pt[1] - dragPrev[1];
    dragPrev = pt;
    dragMoved += Math.hypot(dx, dy);
    state.targetAz -= dx * 0.0075;
    state.targetEl = Math.max(-1.25, Math.min(1.25, state.targetEl + dy * 0.0075));
  });

  stage.addEventListener("pointerup", (e) => {
    if (dragging && dragMoved < 5) {
      const pt = stageLocal(e);
      const hit = findNearestNode(pt[0], pt[1], 18);
      if (hit >= 0) {
        state.selectedNode = hit;
        updateHud(evaluateState(state.mode, state.timeDepth, state.lensIdx, state.muted), true);
      }
    }
    dragging = false;
  });

  stage.addEventListener("pointerleave", () => {
    if (!dragging) state.hoveredNode = -1;
  });

  stage.addEventListener("wheel", (e) => {
    e.preventDefault();
    const factor = Math.exp(-e.deltaY * 0.0014);
    state.targetZoom = Math.max(0.65, Math.min(4.2, state.targetZoom * factor));
  }, { passive: false });

  function resetAll() {
    state.targetAz = 0.68;
    state.targetEl = 0.42;
    state.targetZoom = 0.94;
    state.muted = {};
    state.autoSpin = false;
    if (spinBtn) spinBtn.classList.remove("active");
    updateHud(evaluateState(state.mode, state.timeDepth, state.lensIdx, state.muted), true);
  }
  stage.addEventListener("dblclick", resetAll);

  // =========================================================================
  // 7. INSPECTOR & FLOATING CAMERA CONTROLS
  // =========================================================================
  tabTimelineBtn.addEventListener("click", () => {
    state.mode = "timeline";
    updateHud(evaluateState(state.mode, state.timeDepth, state.lensIdx, state.muted), true);
  });
  tabLensBtn.addEventListener("click", () => {
    state.mode = "lens";
    state.playing = false;
    playBtn.textContent = "Play Arc";
    updateHud(evaluateState(state.mode, state.timeDepth, state.lensIdx, state.muted), true);
  });

  chapterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.chapterBtn);
      state.mode = "timeline";
      state.playing = false;
      playBtn.textContent = "Play Arc";
      state.timeDepth = idx + 0.95;
      state.selectedNode = CHAPTERS[idx].anchorIds[CHAPTERS[idx].anchorIds.length - 1];
      updateHud(evaluateState(state.mode, state.timeDepth, state.lensIdx, state.muted), true);
    });
  });

  lensBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      state.mode = "lens";
      state.lensIdx = Number(btn.dataset.lensBtn);
      const path = LENSES[state.lensIdx].path;
      state.selectedNode = path[path.length - 1];
      updateHud(evaluateState(state.mode, state.timeDepth, state.lensIdx, state.muted), true);
    });
  });

  timeSlider.addEventListener("input", () => {
    state.mode = "timeline";
    state.playing = false;
    playBtn.textContent = "Play Arc";
    state.timeDepth = Number(timeSlider.value);
    updateHud(evaluateState(state.mode, state.timeDepth, state.lensIdx, state.muted), true);
  });

  playBtn.addEventListener("click", () => {
    state.mode = "timeline";
    if (!state.playing && state.timeDepth >= 4.85) state.timeDepth = 0.08;
    state.playing = !state.playing;
    playBtn.textContent = state.playing ? "Pause" : "Play Arc";
  });

  labelsBtn.addEventListener("click", () => {
    state.showLabels = !state.showLabels;
    labelsBtn.classList.toggle("active", state.showLabels);
  });

  themeBtn.addEventListener("click", () => {
    const next = isLight() ? "dark" : "light";
    document.body.setAttribute("data-theme", next);
    themeBtn.textContent = next === "light" ? "Dark" : "Light";
    updateHud(evaluateState(state.mode, state.timeDepth, state.lensIdx, state.muted), true);
  });

  panelToggleBtn.addEventListener("click", () => {
    const collapsed = hudPanel.classList.toggle("collapsed");
    panelToggleBtn.textContent = collapsed ? "Story" : "Hide";
    setTimeout(resizeViewport, 280);
  });

  activeListEl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-select-node]");
    if (btn) {
      state.selectedNode = Number(btn.dataset.selectNode);
      updateHud(evaluateState(state.mode, state.timeDepth, state.lensIdx, state.muted), true);
    }
  });

  nodeCardEl.addEventListener("click", (e) => {
    const jump = e.target.closest("[data-jump-node]");
    if (jump) {
      const id = Number(jump.dataset.jumpNode);
      state.selectedNode = id;
      if (state.mode === "timeline" && NODES[id].bornAt > state.timeDepth) {
        state.timeDepth = NODES[id].chapter + 0.95;
      }
      updateHud(evaluateState(state.mode, state.timeDepth, state.lensIdx, state.muted), true);
      return;
    }
    const muteBtn = e.target.closest("[data-toggle-mute]");
    if (muteBtn) {
      const id = Number(muteBtn.dataset.toggleMute);
      if (state.muted[id]) delete state.muted[id];
      else state.muted[id] = true;
      updateHud(evaluateState(state.mode, state.timeDepth, state.lensIdx, state.muted), true);
    }
  });

  if (zoomInBtn) zoomInBtn.addEventListener("click", () => {
    state.targetZoom = Math.min(4.2, state.targetZoom * 1.28);
  });
  if (zoomOutBtn) zoomOutBtn.addEventListener("click", () => {
    state.targetZoom = Math.max(0.65, state.targetZoom / 1.28);
  });
  if (resetCamBtn) resetCamBtn.addEventListener("click", resetAll);
  if (spinBtn) {
    spinBtn.addEventListener("click", () => {
      state.autoSpin = !state.autoSpin;
      spinBtn.classList.toggle("active", state.autoSpin);
    });
  }

  window.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT") return;
    if (e.code === "Space") {
      e.preventDefault();
      playBtn.click();
    } else if (e.key >= "1" && e.key <= "5") {
      chapterBtns[Number(e.key) - 1].click();
    } else if (e.key === "r" || e.key === "R") {
      resetAll();
    } else if (e.key === "+" || e.key === "=") {
      state.targetZoom = Math.min(4.2, state.targetZoom * 1.22);
    } else if (e.key === "-" || e.key === "_") {
      state.targetZoom = Math.max(0.65, state.targetZoom / 1.22);
    }
  });

  resizeViewport();
  updateHud(evaluateState(state.mode, state.timeDepth, state.lensIdx, state.muted), true);
  requestAnimationFrame(renderFrame);
})();

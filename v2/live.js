(() => {
  const DATA = __DATA__;
  const stage = document.querySelector(".lc-stage");
  const canvas = stage.querySelector(".lc-gl");
  const svgOverlays = [...stage.querySelectorAll(".lc-svg-overlay")];
  const cubeBackG = stage.querySelector("[data-cube-back]");
  const cubeFrontG = stage.querySelector("[data-cube-front]");
  const labelsG = stage.querySelector("[data-labels]");

  // HUD elements
  const hudPanel = document.querySelector(".hud-panel");
  const panelToggleBtn = document.querySelector("[data-panel-toggle]");
  const promptBtns = [...document.querySelectorAll("[data-prompt-btn]")];
  const layerSlider = document.querySelector("[data-layer-slider]");
  const layerValEl = document.querySelector("[data-layer-val]");
  const stageNoteEl = document.querySelector("[data-stage-note]");
  const entropyEl = document.querySelector("[data-entropy]");
  const steerBadgeEl = document.querySelector("[data-steer-badge]");
  const featListEl = document.querySelector("[data-feat-list]");
  const clampBarEl = document.querySelector("[data-clamp-bar]");
  const playBtn = document.querySelector("[data-play-btn]");
  const labelsBtn = document.querySelector("[data-labels-btn]");
  const themeBtn = document.querySelector("[data-theme-btn]");
  const vecBars = [...document.querySelectorAll("[data-vec-bar]")];
  const vecVals = [...document.querySelectorAll("[data-vec-val]")];
  const tokBars = [...document.querySelectorAll("[data-tok-bar]")];
  const tokPcts = [...document.querySelectorAll("[data-tok-pct]")];

  // Floating camera controls
  const zoomInBtn = document.querySelector("[data-zoom-in]");
  const zoomOutBtn = document.querySelector("[data-zoom-out]");
  const zoomReadout = document.querySelector("[data-zoom-val]");
  const resetCamBtn = document.querySelector("[data-cam-reset]");
  const modeOrbitBtn = document.querySelector("[data-mode-orbit]");
  const modeSteerBtn = document.querySelector("[data-mode-steer]");
  const spinBtn = document.querySelector("[data-cam-spin]");

  // 4 semantic neighborhood palettes (dark & light)
  const CLUSTER_RGB_DARK = [
    [0.34, 0.74, 1.0],   // Entities & World (cyan-blue)
    [0.98, 0.70, 0.28],  // Syntax & Code (warm amber)
    [0.24, 0.88, 0.68],  // Physical & Nature (emerald-teal)
    [0.86, 0.46, 0.96],  // Sequence & Tone (violet-magenta)
  ];
  const CLUSTER_RGB_LIGHT = [
    [0.08, 0.40, 0.76],
    [0.74, 0.36, 0.04],
    [0.05, 0.52, 0.38],
    [0.54, 0.16, 0.66],
  ];
  const CLUSTER_HEX_DARK = ["#58bdff", "#fab248", "#3de0ae", "#db75f5"];
  const CLUSTER_HEX_LIGHT = ["#1466c2", "#bd5c0a", "#0d8561", "#8a29a8"];

  // Application state
  const state = {
    promptIdx: 0,
    layer: 4.35,
    playing: true,
    showLabels: true,
    steer3: [0, 0, 0],
    clamped: {}, // featureId -> "clamp" | "ablate"
    hoveredFeat: -1,
    interactMode: "orbit", // "orbit" | "steer"
    autoSpin: false,
    // Camera (radians + zoom)
    az: 0.66,
    el: 0.44,
    zoom: 0.94,
    targetAz: 0.66,
    targetEl: 0.44,
    targetZoom: 0.94,
    cw: 960,
    ch: 760,
    dpr: 1,
    run: null,
  };

  const isLight = () => document.body.getAttribute("data-theme") === "light";

  function recomputeRun() {
    const hasSteer = Math.hypot(...state.steer3) > 0.015;
    const steer8 = hasSteer ? unprojectSteer(state.steer3) : null;
    const hasClamp = Object.keys(state.clamped).length > 0;
    state.run = forward(state.promptIdx, steer8, hasClamp ? state.clamped : null);
  }
  recomputeRun();

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
    stage.setAttribute("data-gl", "1");

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

    // Program 1: Razor-thin 3D lines (background manifold web, circuit filaments, hypercube, trajectory)
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
      void main() {
        gl_FragColor = vCol;
      }
    `;

    // Program 2: Crisp analytic SDF points (background pinpoint stars, jewel SAE nodes, rings, reticle)
    // aMeta = (sizePx, mode, ringIntensity, extra)
    // mode 0: pinpoint star | mode 1: SAE feature (core + fine ring) | mode 2: pulse/beacon | mode 3: cursor reticle
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
          // Mode 0: Crisp pinpoint background superposition star
          float core = smoothstep(0.76, 0.14, r);
          alpha = core * vCol.a * (0.45 + 0.55 * vDepth);
        } else if (mode < 1.5) {
          // Mode 1: Named SAE feature — razor-sharp jewel core + optional fine 1px ring
          float coreR = mix(0.26, 0.34, clamp(ringInt, 0.0, 1.0));
          float core = smoothstep(coreR + 0.14, coreR - 0.06, r);
          float hot = exp(-r * r * 26.0);
          // Delicate concentric ring when firing, hovered, clamped, or ablated
          float ringPos = 0.78;
          float ring = exp(-pow((r - ringPos) * 14.0, 2.0)) * ringInt;
          // Ablated state (extra < -0.5): hollow ring, suppressed core
          if (extra < -0.5) {
            core *= 0.18;
            hot = 0.0;
            ring = exp(-pow((r - 0.68) * 13.0, 2.0)) * 0.95;
          }
          // Clamped state (extra > 0.5): crisp double ring
          if (extra > 0.5) {
            ring = max(ring, exp(-pow((r - 0.82) * 16.0, 2.0)) * 0.95);
            ring = max(ring, exp(-pow((r - 0.56) * 16.0, 2.0)) * 0.65);
          }
          if (uLight < 0.5) {
            col = mix(col, vec3(1.0), hot * 0.65);
          } else {
            col = mix(col, col * 0.45, hot * 0.3);
          }
          alpha = clamp(core * 0.95 + ring * 0.85, 0.0, 1.0) * vCol.a * (0.45 + 0.55 * vDepth);
        } else if (mode < 2.5) {
          // Mode 2: Signal packet / waypoint / token beacon (crisp dot + subtle rim)
          float core = smoothstep(0.46, 0.12, r);
          float rim = exp(-pow((r - 0.78) * 14.0, 2.0)) * ringInt;
          if (uLight < 0.5) col = mix(col, vec3(1.0), exp(-r * r * 18.0) * 0.55);
          alpha = clamp(core + rim * 0.8, 0.0, 1.0) * vCol.a * (0.55 + 0.45 * vDepth);
        } else {
          // Mode 3: Active residual stream cursor x(l) — precision optical reticle
          float core = smoothstep(0.24, 0.06, r);
          float ring1 = exp(-pow((r - 0.58) * 18.0, 2.0)) * 0.95;
          float ring2 = exp(-pow((r - 0.88) * 20.0, 2.0)) * 0.45;
          float crossX = exp(-pow(uv.y * 16.0, 2.0)) * step(0.35, abs(uv.x)) * step(abs(uv.x), 0.92);
          float crossY = exp(-pow(uv.x * 16.0, 2.0)) * step(0.35, abs(uv.y)) * step(abs(uv.y), 0.92);
          float cross = max(crossX, crossY) * 0.65;
          if (uLight < 0.5) col = mix(col, vec3(1.0), core * 0.7);
          alpha = clamp(core + ring1 + ring2 + cross, 0.0, 1.0) * vCol.a;
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

  // Pre-allocated typed arrays for zero-GC 60fps uploads
  const MAX_LINE_VERTS = 5400; // 2700 segments
  const lineData = new Float32Array(MAX_LINE_VERTS * 7); // x,y,z, r,g,b,a
  const MAX_POINTS = 2200;
  const pointData = new Float32Array(MAX_POINTS * 11); // x,y,z, r,g,b,a, size,mode,ring,extra

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

  // 4D Tesseract edges (16 vertices, 32 edges)
  const TESS_VERTS = [];
  for (let i = 0; i < 16; i++) {
    TESS_VERTS.push([
      i & 1 ? 1 : -1,
      i & 2 ? 1 : -1,
      i & 4 ? 1 : -1,
      i & 8 ? 1 : -1,
    ]);
  }
  const TESS_EDGES = [];
  for (let i = 0; i < 16; i++) {
    for (let b = 0; b < 4; b++) {
      const j = i ^ (1 << b);
      if (j > i) TESS_EDGES.push([i, j]);
    }
  }

  // 3D Cube geometry (8 corners, 12 edges, 6 faces)
  const CUBE_VERTS = [
    [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
    [-1, -1,  1], [1, -1,  1], [1, 1,  1], [-1, 1,  1],
  ];
  const CUBE_EDGES = [
    [0, 1], [1, 2], [2, 3], [3, 0], // bottom
    [4, 5], [5, 6], [6, 7], [7, 4], // top
    [0, 4], [1, 5], [2, 6], [3, 7], // vertical
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
  // 3. SVG 3D OPTICAL CUBE FRAME + SEMANTIC CALLOUTS (SYNCHRONIZED 1:1)
  // =========================================================================
  function renderSvgFrameAndLabels(basis, lens, traj3) {
    const { cw, ch, zoom } = state;
    const light = isLight();
    const hexPal = light ? CLUSTER_HEX_LIGHT : CLUSTER_HEX_DARK;
    const pVerts = CUBE_VERTS.map((v) => proj3(v, basis, cw, ch, zoom));

    // Back-facing faces (normal pointing away from camera: dot(n, fwd) < 0)
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

    // Separate cube edges into back vs front based on midpoint depth
    const backEdgeD = [];
    const frontEdgeD = [];
    for (const [i, j] of CUBE_EDGES) {
      const a = pVerts[i], b = pVerts[j];
      const d = `M${a[0].toFixed(1)},${a[1].toFixed(1)} L${b[0].toFixed(1)},${b[1].toFixed(1)}`;
      if ((a[2] + b[2]) * 0.5 < -0.15) backEdgeD.push(d);
      else frontEdgeD.push(d);
    }

    // Precision corner tick brackets at the 8 vertices
    const cornerTicks = [];
    const tickLen = 0.09;
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

    // PC1, PC2, PC3 subtle axis tags outside positive cube faces
    const axDefs = [
      { p: [1.12, 0, 0], txt: "PC1" },
      { p: [0, 1.12, 0], txt: "PC2" },
      { p: [0, 0, 1.12], txt: "PC3" },
    ];
    const axSvg = axDefs.map((ax) => {
      const sp = proj3(ax.p, basis, cw, ch, zoom);
      return `<text class="lc-axis-tag" x="${sp[0].toFixed(1)}" y="${sp[1].toFixed(1)}" text-anchor="middle" dominant-baseline="middle">${ax.txt}</text>`;
    }).join("");

    cubeFrontG.innerHTML =
      (frontEdgeD.length ? `<path class="lc-cube-edge-front" d="${frontEdgeD.join(" ")}"/>` : "") +
      `<path class="lc-cube-corners" d="${cornerTicks.join(" ")}"/>` +
      axSvg;

    // Semantic Callouts (dynamically richer when zooming in!)
    if (!state.showLabels) {
      labelsG.innerHTML = "";
      return;
    }

    const items = [];
    const placed = []; // [x0, y0, x1, y1]
    const overlaps = (x0, y0, x1, y1) => {
      for (let k = 0; k < placed.length; k++) {
        const b = placed[k];
        if (x0 < b[2] && x1 > b[0] && y0 < b[3] && y1 > b[1]) return true;
      }
      return false;
    };

    // 1. Active residual stream cursor label (highest priority)
    const cPos = proj3(lens.pos3, basis, cw, ch, zoom);
    const cTxt = `x(L${lens.layer.toFixed(1)})`;
    const cLx = cPos[0] + 20, cLy = cPos[1] - 18;
    placed.push([cLx - 2, cLy - 10, cLx + cTxt.length * 6.2 + 4, cLy + 4]);
    items.push(
      `<g class="lc-cursor-tag">` +
      `<line x1="${(cPos[0] + 7).toFixed(1)}" y1="${(cPos[1] - 7).toFixed(1)}" x2="${(cLx - 2).toFixed(1)}" y2="${(cLy - 3).toFixed(1)}" stroke="currentColor" stroke-width="0.7" opacity="0.65"/>` +
      `<text x="${cLx.toFixed(1)}" y="${cLy.toFixed(1)}">${cTxt}</text></g>`,
    );

    // 2. Unembedding target beacons (5 tokens)
    for (let i = 0; i < TOKENS.length; i++) {
      const sp = proj3(TOKEN_POS3[i], basis, cw, ch, zoom);
      if (sp[0] < -40 || sp[0] > cw + 40 || sp[1] < -20 || sp[1] > ch + 20) continue;
      const isTop = i === lens.topIdx;
      const pct = Math.round(lens.probs[i] * 100);
      const txt = `${TOKENS[i].text} ${pct}%`;
      const anchor = sp[0] > cw * 0.5 ? "start" : "end";
      const dx = anchor === "start" ? 9 : -9;
      const tw = txt.length * 6.2;
      const rx0 = anchor === "start" ? sp[0] + dx : sp[0] + dx - tw;
      placed.push([rx0 - 2, sp[1] - 8, rx0 + tw + 2, sp[1] + 5]);
      items.push(
        `<g class="lc-tag ${isTop ? "lc-tag-top" : ""}" transform="translate(${sp[0].toFixed(1)},${sp[1].toFixed(1)})">` +
        `<text x="${dx}" y="3" text-anchor="${anchor}">${txt}</text></g>`,
      );
    }

    // 3. Top firing SAE features + clamped/ablated + hovered (de-overlapped!)
    const maxFeatLabels = Math.min(18, Math.round(6 + Math.max(0, zoom - 0.9) * 5.0));
    const ranked = FEATURES.map((f, i) => ({
      i,
      a: lens.acts[i],
      mode: state.clamped[i] || null,
    })).sort((x, y) => {
      const px = (x.mode ? 2 : 0) + x.a;
      const py = (y.mode ? 2 : 0) + y.a;
      return py - px;
    });

    const shown = [];
    if (state.hoveredFeat >= 0) shown.push(state.hoveredFeat);
    for (const r of ranked) {
      if (shown.length >= maxFeatLabels) break;
      if (r.i === state.hoveredFeat) continue;
      if (r.a < 0.22 && !r.mode && zoom < 1.7) continue;
      if (r.a < 0.02 && !r.mode && zoom < 2.5) continue;
      shown.push(r.i);
    }

    const offsets = [[9, 3], [9, -11], [9, 17], [-9, 3], [-9, -11], [9, -24], [9, 30]];
    for (const idx of shown) {
      const f = FEATURES[idx];
      const sp = proj3(FEATURE_POS3[idx], basis, cw, ch, zoom);
      if (sp[0] < 14 || sp[0] > cw - 14 || sp[1] < 16 || sp[1] > ch - 16) continue;
      const isHov = idx === state.hoveredFeat;
      const cMode = state.clamped[idx];
      const col = cMode === "clamp" ? "#ffbe55" : cMode === "ablate" ? "#ff5c6c" : hexPal[f.cluster];
      const badge = cMode === "clamp" ? " [CLAMP]" : cMode === "ablate" ? " [ABLATE]" : "";
      const valStr = isHov ? ` · ${lens.acts[idx].toFixed(2)}` : "";
      const txt = `${f.name}${badge}${valStr}`;
      const tw = txt.length * 5.6;

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
      if (!chosen && !isHov && !cMode) continue;
      if (!chosen) chosen = { ox: 9, oy: 3, lx: sp[0] + 9, ly: sp[1] + 3, anchor: "start", rx0: sp[0] + 9 };
      placed.push([chosen.rx0 - 2, chosen.ly - 9, chosen.rx0 + tw + 2, chosen.ly + 4]);

      const opacity = isHov || cMode ? 1.0 : Math.min(0.96, 0.52 + lens.acts[idx] * 0.48);
      const leader = Math.abs(chosen.oy) > 6
        ? `<line x1="${sp[0].toFixed(1)}" y1="${sp[1].toFixed(1)}" x2="${(chosen.lx + (chosen.ox > 0 ? -2 : 2)).toFixed(1)}" y2="${(chosen.ly - 3).toFixed(1)}" stroke="${col}" stroke-width="0.6" opacity="0.45"/>`
        : "";
      items.push(
        `<g class="lc-feat-tag${isHov ? " is-hov" : ""}" style="opacity:${opacity.toFixed(2)}">` +
        leader +
        `<text x="${chosen.lx.toFixed(1)}" y="${chosen.ly.toFixed(1)}" text-anchor="${chosen.anchor}" fill="${col}">${txt}</text></g>`,
      );
    }

    labelsG.innerHTML = items.join("");
  }

  // =========================================================================
  // 4. TELEMETRY HUD UPDATES
  // =========================================================================
  let lastHudMs = 0;
  function updateHud(lens, force = false) {
    const now = performance.now();
    if (!force && now - lastHudMs < 45) return;
    lastHudMs = now;

    layerValEl.textContent = `L${lens.layer.toFixed(1)} / 6.0`;
    if (document.activeElement !== layerSlider) layerSlider.value = lens.layer.toFixed(2);
    stageNoteEl.textContent = lens.note;
    entropyEl.textContent = `${lens.entropy.toFixed(2)} bits`;

    const steerMag = Math.hypot(...state.steer3);
    const clampKeys = Object.keys(state.clamped);
    if (steerMag > 0.02) {
      steerBadgeEl.textContent = `STEERED (${steerMag.toFixed(2)})`;
      steerBadgeEl.classList.add("active");
    } else if (clampKeys.length > 0) {
      steerBadgeEl.textContent = `${clampKeys.length} INTERVENED`;
      steerBadgeEl.classList.add("active");
    } else {
      steerBadgeEl.textContent = "UNSTEERED";
      steerBadgeEl.classList.remove("active");
    }

    // Clamped / ablated pills bar
    if (clampBarEl) {
      if (clampKeys.length === 0) {
        clampBarEl.innerHTML = `<span class="hud-clamp-empty">Click any glowing node to clamp or ablate it</span>`;
      } else {
        clampBarEl.innerHTML =
          clampKeys.map((k) => {
            const id = Number(k);
            const m = state.clamped[id];
            return `<button class="hud-clamp-pill is-${m}" data-clear-feat="${id}" title="Click to remove">${FEATURES[id].name} · ${m === "clamp" ? "+1.45" : "0.0"} ×</button>`;
          }).join("") +
          `<button class="hud-clamp-clear" data-clear-all>Clear</button>`;
      }
    }

    // 8-D Residual Stream bars
    for (let d = 0; d < 8; d++) {
      const v = lens.vec8[d];
      const pct = Math.min(50, Math.abs(v) * 50);
      const bar = vecBars[d];
      bar.style.width = `${pct.toFixed(1)}%`;
      bar.style.left = v >= 0 ? "50%" : `${(50 - pct).toFixed(1)}%`;
      bar.classList.toggle("neg", v < 0);
      vecVals[d].textContent = (v >= 0 ? "+" : "") + v.toFixed(2);
    }

    // Top 6 firing SAE features (clickable to clamp/ablate!)
    const hexPal = isLight() ? CLUSTER_HEX_LIGHT : CLUSTER_HEX_DARK;
    const topF = FEATURES.map((f, i) => ({ f, i, a: lens.acts[i], m: state.clamped[i] || null }))
      .sort((x, y) => (y.m ? 2 : 0) + y.a - ((x.m ? 2 : 0) + x.a))
      .slice(0, 6);

    featListEl.innerHTML = topF.map(({ f, i, a, m }) => {
      const w = Math.min(100, (a / 1.5) * 100);
      const col = m === "clamp" ? "#ffbe55" : m === "ablate" ? "#ff5c6c" : hexPal[f.cluster];
      const tag = m === "clamp" ? " [C]" : m === "ablate" ? " [×]" : "";
      return (
        `<button class="hud-feat-row${m ? " is-" + m : ""}" data-feat-click="${i}" title="Click to cycle: normal → clamp → ablate">` +
        `<span class="hud-dot" style="background:${col}"></span>` +
        `<span class="hud-feat-name">${f.name}${tag}</span>` +
        `<span class="hud-feat-bar"><i style="width:${w.toFixed(0)}%;background:${col}"></i></span>` +
        `<span class="hud-feat-num">${a.toFixed(2)}</span></button>`
      );
    }).join("");

    // Logit Lens probabilities
    for (let i = 0; i < TOKENS.length; i++) {
      const p = lens.probs[i];
      tokBars[i].style.width = `${(p * 100).toFixed(1)}%`;
      tokBars[i].classList.toggle("top", i === lens.topIdx);
      tokPcts[i].textContent = `${Math.round(p * 100)}%`;
    }

    if (zoomReadout) zoomReadout.textContent = `${state.zoom.toFixed(1)}×`;
  }

  function cycleFeatureIntervention(id) {
    const cur = state.clamped[id];
    if (!cur) state.clamped[id] = "clamp";
    else if (cur === "clamp") state.clamped[id] = "ablate";
    else delete state.clamped[id];
    recomputeRun();
    updateHud(logitLens(state.run, state.layer), true);
  }

  // =========================================================================
  // 5. MAIN 60FPS RENDER LOOP
  // =========================================================================
  let lastT = performance.now();

  function renderFrame(now) {
    const dt = Math.min(0.05, (now - lastT) * 0.001);
    lastT = now;

    resizeViewport();

    if (state.playing) {
      state.layer += dt * 0.62;
      if (state.layer > N_LAYERS + 0.55) state.layer = 0;
    }
    if (state.autoSpin) {
      state.targetAz += dt * 0.14;
    }

    // Smooth camera damping
    const damp = 1 - Math.exp(-12 * dt);
    state.az += (state.targetAz - state.az) * damp;
    state.el += (state.targetEl - state.el) * damp;
    state.zoom += (state.targetZoom - state.zoom) * damp;

    const effLayer = Math.min(N_LAYERS, state.layer);
    const lens = logitLens(state.run, effLayer);
    const traj3 = state.run.states.map((s) => project3(s));
    const basis = camBasis(state.az, state.el);
    const light = isLight();
    const pal = light ? CLUSTER_RGB_LIGHT : CLUSTER_RGB_DARK;

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
      // 1. Central faint PC1/PC2/PC3 crosshair axes
      const axCol = light ? [0.22, 0.28, 0.38, 0.14] : [0.45, 0.60, 0.80, 0.12];
      pushLine([-1, 0, 0], [1, 0, 0], ...axCol);
      pushLine([0, -1, 0], [0, 1, 0], ...axCol);
      pushLine([0, 0, -1], [0, 0, 1], ...axCol);

      // 2. Dense dormant background manifold web (~1,100 hair-thin filaments)
      const webAlpha = light ? 0.14 : 0.165;
      for (let i = 0; i < BG_EDGES.length; i++) {
        const [aIdx, bIdx, w] = BG_EDGES[i];
        const c = pal[BG_CLUSTER[aIdx]];
        pushLine(BG_POS3[aIdx], BG_POS3[bIdx], c[0], c[1], c[2], webAlpha * (0.45 + 0.55 * w));
      }

      // 3. 4D Tesseract inner wireframe rotating with layer depth
      const ang = effLayer * 0.42 + tSec * 0.14;
      const ca4 = Math.cos(ang), sa4 = Math.sin(ang);
      const tPts = TESS_VERTS.map((v) => {
        const x = v[0] * ca4 - v[3] * sa4;
        const w = v[0] * sa4 + v[3] * ca4;
        const p4 = 0.24 / (2.5 - w * 0.48);
        return [x * p4, v[1] * p4, v[2] * p4];
      });
      const tCol = light ? [0.24, 0.34, 0.56, 0.18] : [0.42, 0.72, 0.98, 0.15];
      for (let i = 0; i < TESS_EDGES.length; i++) {
        const [a, b] = TESS_EDGES[i];
        pushLine(tPts[a], tPts[b], ...tCol);
      }

      // 4. 48 Mechanistic Circuit Edges + Traveling Signal Packets
      for (let i = 0; i < CIRCUIT_EDGES.length; i++) {
        const [aIdx, bIdx, weight] = CIRCUIT_EDGES[i];
        const aA = lens.acts[aIdx];
        const aB = lens.acts[bIdx];
        const flow = Math.min(1.0, Math.sqrt(aA * aB) * weight * 1.15);
        const c = pal[FEATURES[aIdx].cluster];
        if (flow > 0.08) {
          pushLine(FEATURE_POS3[aIdx], FEATURE_POS3[bIdx], c[0], c[1], c[2], 0.14 + flow * 0.58);
          // Crisp traveling signal packet
          const phase = (tSec * (0.42 + 0.32 * flow) + i * 0.19) % 1.0;
          const pkt = lerp3(FEATURE_POS3[aIdx], FEATURE_POS3[bIdx], phase);
          pushPoint(pkt, light ? c[0] : 1.0, light ? c[1] : 0.96, light ? c[2] : 0.85, 0.88 * flow, 3.0 * zoomBoost, 2, 0.0, 0);
        } else {
          pushLine(FEATURE_POS3[aIdx], FEATURE_POS3[bIdx], c[0], c[1], c[2], light ? 0.06 : 0.055);
        }
      }

      // 5. Residual-Stream Trajectory (subdivided smooth curve L0 -> L6)
      const subSteps = 6;
      const pastCol = light ? [0.78, 0.24, 0.12] : [1.0, 0.86, 0.48];
      const futCol = light ? [0.25, 0.38, 0.55] : [0.48, 0.74, 1.0];
      for (let seg = 0; seg < N_LAYERS; seg++) {
        const p0 = traj3[Math.max(0, seg - 1)];
        const p1 = traj3[seg];
        const p2 = traj3[seg + 1];
        const p3 = traj3[Math.min(N_LAYERS, seg + 2)];
        let prev = p1;
        for (let k = 1; k <= subSteps; k++) {
          const t = k / subSteps;
          const t2 = t * t, t3 = t2 * t;
          // Catmull-Rom spline
          const cur = [0, 1, 2].map((d) =>
            0.5 * (
              2 * p1[d] +
              (-p0[d] + p2[d]) * t +
              (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 +
              (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3
            ),
          );
          const lPos = seg + t;
          const isPast = lPos <= effLayer;
          if (isPast) {
            pushLine(prev, cur, pastCol[0], pastCol[1], pastCol[2], 0.92);
          } else {
            pushLine(prev, cur, futCol[0], futCol[1], futCol[2], light ? 0.24 : 0.22);
          }
          prev = cur;
        }
      }

      // 6. Orthogonal drop-line from cursor x(l) to cube floor (z = -1)
      const floorPt = [lens.pos3[0], lens.pos3[1], -1.0];
      pushLine(lens.pos3, floorPt, pastCol[0], pastCol[1], pastCol[2], light ? 0.36 : 0.32);
      pushLine([floorPt[0] - 0.04, floorPt[1], -1], [floorPt[0] + 0.04, floorPt[1], -1], pastCol[0], pastCol[1], pastCol[2], 0.4);
      pushLine([floorPt[0], floorPt[1] - 0.04, -1], [floorPt[0], floorPt[1] + 0.04, -1], pastCol[0], pastCol[1], pastCol[2], 0.4);

      // --- B. POINTS ---
      // 1. 1,200 Dense Background Superposition Stars ("dark matter" latent concepts)
      const activeIdx = [];
      for (let i = 0; i < N_FEATURES; i++) if (lens.acts[i] > 0.35) activeIdx.push(i);

      for (let i = 0; i < N_BG; i++) {
        const bp = BG_POS3[i];
        const c = pal[BG_CLUSTER[i]];
        const w = BG_WEIGHT[i];
        // Subtle sympathetic glow when a nearby named SAE feature fires
        let symp = 0;
        for (let k = 0; k < activeIdx.length; k++) {
          const fp = FEATURE_POS3[activeIdx[k]];
          const dx = bp[0] - fp[0], dy = bp[1] - fp[1], dz = bp[2] - fp[2];
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < 0.075) {
            symp = Math.max(symp, (1.0 - d2 / 0.075) * lens.acts[activeIdx[k]]);
          }
        }
        const baseA = light ? 0.30 + 0.30 * w : 0.34 + 0.38 * w;
        const alpha = Math.min(0.92, baseA + symp * 0.42);
        const sz = (2.3 + 2.0 * w + symp * 1.8) * zoomBoost;
        pushPoint(bp, c[0], c[1], c[2], alpha, sz, 0, 0, 0);
      }

      // 2. 48 Named SAE Features (fine jewel-like cores + crisp 1px activation rings)
      for (let i = 0; i < N_FEATURES; i++) {
        const a = lens.acts[i];
        const isHov = i === state.hoveredFeat;
        const cMode = state.clamped[i];
        let c = pal[FEATURES[i].cluster];
        let extra = 0;
        let ring = a > 0.08 ? Math.min(1.0, a * 0.92) : 0.0;
        let sz = (4.0 + a * 6.2) * zoomBoost;
        let alpha = 0.48 + Math.min(0.52, a * 0.62);

        if (cMode === "clamp") {
          c = light ? [0.82, 0.46, 0.02] : [1.0, 0.78, 0.32];
          extra = 1.0;
          ring = 1.0;
          sz = 12.5 * zoomBoost;
          alpha = 1.0;
        } else if (cMode === "ablate") {
          c = light ? [0.76, 0.12, 0.22] : [1.0, 0.36, 0.42];
          extra = -1.0;
          ring = 1.0;
          sz = 9.8 * zoomBoost;
          alpha = 0.95;
        } else if (isHov) {
          ring = 1.0;
          sz = Math.max(sz, 11.5 * zoomBoost);
          alpha = 1.0;
        }
        pushPoint(FEATURE_POS3[i], c[0], c[1], c[2], alpha, sz, 1, ring, extra);
      }

      // 3. Discrete L0..L6 Layer Waypoints
      for (let l = 0; l <= N_LAYERS; l++) {
        const reached = l <= effLayer + 0.02;
        const c = reached ? pastCol : futCol;
        pushPoint(traj3[l], c[0], c[1], c[2], reached ? 0.95 : 0.42, (reached ? 5.6 : 3.6) * zoomBoost, 2, reached ? 0.7 : 0.0, 0);
      }

      // 4. 5 Unembedding Target Beacons on Cube Boundary
      for (let i = 0; i < TOKENS.length; i++) {
        const isTop = i === lens.topIdx;
        const p = lens.probs[i];
        const c = isTop ? (light ? [0.78, 0.22, 0.12] : [1.0, 0.86, 0.46]) : pal[TOKENS[i].cluster];
        const pulse = isTop ? 0.82 + 0.18 * Math.sin(tSec * 4.2) : 0.42;
        pushPoint(TOKEN_POS3[i], c[0], c[1], c[2], 0.58 + 0.42 * p, (5.2 + p * 6.8) * zoomBoost, 2, pulse, 0);
      }

      // 5. Active Residual Stream Cursor x(l) (crisp optical reticle)
      const curCol = light ? [0.06, 0.20, 0.48] : [1.0, 0.94, 0.72];
      pushPoint(lens.pos3, curCol[0], curCol[1], curCol[2], 1.0, 16.5 * zoomBoost, 3, 1.0, 0);

      // Upload & Draw Lines
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

      // Upload & Draw Points
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

    renderSvgFrameAndLabels(basis, lens, traj3);
    updateHud(lens);

    requestAnimationFrame(renderFrame);
  }

  // =========================================================================
  // 6. INTERACTION: 3D ORBIT, ZOOM, STEERING, NODE CLICK CLAMP/ABLATE
  // =========================================================================
  function stageLocal(e) {
    const r = stage.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  function findNearestFeature(mx, my, maxPx = 15) {
    const basis = camBasis(state.az, state.el);
    let best = -1;
    let bestD = maxPx;
    for (let i = 0; i < N_FEATURES; i++) {
      const sp = proj3(FEATURE_POS3[i], basis, state.cw, state.ch, state.zoom);
      const d = Math.hypot(sp[0] - mx, sp[1] - my);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  let dragMode = null; // "orbit" | "steer"
  let dragStart = [0, 0];
  let dragPrev = [0, 0];
  let dragMoved = 0;
  let steerOrigin = [0, 0, 0];

  stage.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    stage.setPointerCapture(e.pointerId);
    const pt = stageLocal(e);
    dragStart = pt;
    dragPrev = pt;
    dragMoved = 0;
    const useSteer = e.shiftKey || state.interactMode === "steer";
    dragMode = useSteer ? "steer" : "orbit";
    if (useSteer) steerOrigin = state.steer3.slice();
    if (!useSteer && state.autoSpin) {
      state.autoSpin = false;
      if (spinBtn) spinBtn.classList.remove("active");
    }
  });

  stage.addEventListener("pointermove", (e) => {
    const pt = stageLocal(e);
    if (!dragMode) {
      state.hoveredFeat = findNearestFeature(pt[0], pt[1], 14);
      stage.style.cursor = state.hoveredFeat >= 0 ? "pointer" : state.interactMode === "steer" ? "crosshair" : "grab";
      return;
    }
    const dx = pt[0] - dragPrev[0];
    const dy = pt[1] - dragPrev[1];
    dragPrev = pt;
    dragMoved += Math.hypot(dx, dy);

    if (dragMode === "orbit") {
      state.targetAz -= dx * 0.0075;
      state.targetEl = Math.max(-1.25, Math.min(1.25, state.targetEl + dy * 0.0075));
    } else if (dragMode === "steer") {
      const totalDx = (pt[0] - dragStart[0]) / (Math.min(state.cw, state.ch) * 0.28);
      const totalDy = -(pt[1] - dragStart[1]) / (Math.min(state.cw, state.ch) * 0.28);
      const basis = camBasis(state.az, state.el);
      state.steer3 = [0, 1, 2].map((d) =>
        Math.max(-1.25, Math.min(1.25, steerOrigin[d] + basis.right[d] * totalDx + basis.up[d] * totalDy)),
      );
      recomputeRun();
    }
  });

  stage.addEventListener("pointerup", (e) => {
    if (dragMode && dragMoved < 5) {
      const pt = stageLocal(e);
      const hit = findNearestFeature(pt[0], pt[1], 16);
      if (hit >= 0) cycleFeatureIntervention(hit);
    }
    dragMode = null;
  });

  stage.addEventListener("pointerleave", () => {
    if (!dragMode) state.hoveredFeat = -1;
  });

  stage.addEventListener("wheel", (e) => {
    e.preventDefault();
    const factor = Math.exp(-e.deltaY * 0.0014);
    state.targetZoom = Math.max(0.65, Math.min(4.2, state.targetZoom * factor));
  }, { passive: false });

  function resetAll() {
    state.targetAz = 0.66;
    state.targetEl = 0.44;
    state.targetZoom = 0.94;
    state.steer3 = [0, 0, 0];
    state.clamped = {};
    state.autoSpin = false;
    if (spinBtn) spinBtn.classList.remove("active");
    recomputeRun();
    updateHud(logitLens(state.run, state.layer), true);
  }

  stage.addEventListener("dblclick", resetAll);

  // =========================================================================
  // 7. HUD & FLOATING CAMERA CONTROL WIRING
  // =========================================================================
  function selectPrompt(idx) {
    state.promptIdx = idx;
    state.steer3 = [0, 0, 0];
    state.layer = 0.05;
    state.playing = true;
    playBtn.textContent = "Pause";
    promptBtns.forEach((b, i) => b.classList.toggle("active", i === idx));
    recomputeRun();
    updateHud(logitLens(state.run, state.layer), true);
  }

  promptBtns.forEach((btn) => {
    btn.addEventListener("click", () => selectPrompt(Number(btn.dataset.promptBtn)));
  });

  layerSlider.addEventListener("input", () => {
    state.playing = false;
    playBtn.textContent = "Play";
    state.layer = Number(layerSlider.value);
    updateHud(logitLens(state.run, state.layer), true);
  });

  playBtn.addEventListener("click", () => {
    state.playing = !state.playing;
    playBtn.textContent = state.playing ? "Pause" : "Play";
  });

  labelsBtn.addEventListener("click", () => {
    state.showLabels = !state.showLabels;
    labelsBtn.classList.toggle("active", state.showLabels);
  });

  themeBtn.addEventListener("click", () => {
    const next = isLight() ? "dark" : "light";
    document.body.setAttribute("data-theme", next);
    themeBtn.textContent = next === "light" ? "Dark" : "Light";
    updateHud(logitLens(state.run, state.layer), true);
  });

  panelToggleBtn.addEventListener("click", () => {
    const collapsed = hudPanel.classList.toggle("collapsed");
    panelToggleBtn.textContent = collapsed ? "Inspector" : "Hide";
    setTimeout(resizeViewport, 280);
  });

  featListEl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-feat-click]");
    if (btn) cycleFeatureIntervention(Number(btn.dataset.featClick));
  });

  if (clampBarEl) {
    clampBarEl.addEventListener("click", (e) => {
      const clearOne = e.target.closest("[data-clear-feat]");
      if (clearOne) {
        delete state.clamped[Number(clearOne.dataset.clearFeat)];
        recomputeRun();
        updateHud(logitLens(state.run, state.layer), true);
        return;
      }
      if (e.target.closest("[data-clear-all]")) {
        state.clamped = {};
        recomputeRun();
        updateHud(logitLens(state.run, state.layer), true);
      }
    });
  }

  if (zoomInBtn) zoomInBtn.addEventListener("click", () => {
    state.targetZoom = Math.min(4.2, state.targetZoom * 1.28);
  });
  if (zoomOutBtn) zoomOutBtn.addEventListener("click", () => {
    state.targetZoom = Math.max(0.65, state.targetZoom / 1.28);
  });
  if (resetCamBtn) resetCamBtn.addEventListener("click", resetAll);
  if (modeOrbitBtn && modeSteerBtn) {
    modeOrbitBtn.addEventListener("click", () => {
      state.interactMode = "orbit";
      modeOrbitBtn.classList.add("active");
      modeSteerBtn.classList.remove("active");
    });
    modeSteerBtn.addEventListener("click", () => {
      state.interactMode = "steer";
      modeSteerBtn.classList.add("active");
      modeOrbitBtn.classList.remove("active");
    });
  }
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
      state.playing = !state.playing;
      playBtn.textContent = state.playing ? "Pause" : "Play";
    } else if (e.key >= "1" && e.key <= "5") {
      selectPrompt(Number(e.key) - 1);
    } else if (e.key === "r" || e.key === "R") {
      resetAll();
    } else if (e.key === "+" || e.key === "=") {
      state.targetZoom = Math.min(4.2, state.targetZoom * 1.22);
    } else if (e.key === "-" || e.key === "_") {
      state.targetZoom = Math.max(0.65, state.targetZoom / 1.22);
    }
  });

  // Expose tiny debug hook for automated inspection
  window.__CHAMBER = {
    state,
    setView(az, el, zoom) {
      state.az = state.targetAz = az;
      state.el = state.targetEl = el;
      state.zoom = state.targetZoom = zoom;
    },
    setLayer(l) {
      state.playing = false;
      state.layer = l;
    },
    selectPrompt,
    cycleFeatureIntervention,
  };

  resizeViewport();
  updateHud(logitLens(state.run, state.layer), true);
  requestAnimationFrame(renderFrame);
})();

(function () {
  const D = __DATA__;
  const stage = document.querySelector(".lc-stage");
  if (!stage) return;

  const still = matchMedia("(prefers-reduced-motion: reduce)");
  const LIGHT = document.body.dataset.theme === "light" ? 1 : 0;

  // Map normalized cube coords [-1, 1]^3 -> world coordinates inside the optical chamber
  const CUBE_CX = D.cube.cx;
  const CUBE_CY = D.cube.cy;
  const CUBE_CZ = D.cube.cz;
  const CUBE_HALF = D.cube.half; // 82 world units (leaves 8u margin inside 90u glass)

  function toWorld(p3) {
    return [
      CUBE_CX + p3[0] * CUBE_HALF,
      CUBE_CY + p3[1] * CUBE_HALF,
      CUBE_CZ + p3[2] * CUBE_HALF,
    ];
  }

  // Precompute static world positions for the 24 SAE features and 5 unembedding beacons
  const NODE_W = FEATURE_POS3.map(toWorld);
  const TOKEN_W = TOKEN_POS3.map((p) => [
    CUBE_CX + p[0] * (CUBE_HALF + 5),
    CUBE_CY + p[1] * (CUBE_HALF + 5),
    CUBE_CZ + p[2] * (CUBE_HALF + 5),
  ]);

  // --- WebGL Fragment Shader (registered in GLSL_ISO world space) ---
  const FRAGMENT = `
uniform float uLight;
uniform float uFirst;
uniform float uLayer;
uniform float uSteerMag;
uniform vec3 uCursor;
uniform vec4 uNodes[24];
uniform vec4 uTraj[7];
uniform vec4 uTokens[5];
uniform vec4 uEdgeA[8];
uniform vec4 uEdgeB[8];

const vec3 C_CENTER = vec3(${CUBE_CX.toFixed(1)}, ${CUBE_CY.toFixed(1)}, ${CUBE_CZ.toFixed(1)});
const float C_INNER = ${(CUBE_HALF + 7.5).toFixed(1)};
const float FLOOR_Z = ${(D.cube.z0).toFixed(1)};

// Exact ray-to-point perpendicular distance and depth parameter t along ray p0 + t*V
vec2 rayPoint(vec3 p0, vec3 V, vec3 q) {
  vec3 d = q - p0;
  float t = dot(d, V);
  float dist = length(d - t * V);
  return vec2(dist, t);
}

// Analytic closest distance between camera ray (p0 + t*V) and 3D segment (a -> b)
// Returns vec3(minDist, segParam s in [0,1], rayDepth t)
vec3 raySegment(vec3 p0, vec3 V, vec3 a, vec3 b) {
  vec3 u = b - a;
  vec3 w = a - p0;
  float uu = dot(u, u);
  float uv = dot(u, V);
  float uw = dot(u, w);
  float vw = dot(V, w);
  float denom = max(uu - uv * uv, 1e-5);
  float s = clamp((uv * vw - uw) / denom, 0.0, 1.0);
  vec3 q = a + u * s;
  vec2 rp = rayPoint(p0, V, q);
  return vec3(rp.x, s, rp.y);
}

// Ray-box intersection for the optical glass cube cavity (returns vec2(tNear, tFar))
vec2 hitBox(vec3 p0, vec3 V, vec3 bmin, vec3 bmax) {
  vec3 invV = 1.0 / (V + vec3(1e-7));
  vec3 t0 = (bmin - p0) * invV;
  vec3 t1 = (bmax - p0) * invV;
  vec3 tmin = min(t0, t1);
  vec3 tmax = max(t0, t1);
  float nearT = max(max(tmin.x, tmin.y), tmin.z);
  float farT = min(min(tmax.x, tmax.y), tmax.z);
  return vec2(nearT, farT);
}

vec3 clusterColor(float cIdx, float isLight) {
  if (isLight > 0.5) {
    // Saturated scientific inks for paper
    if (cIdx < 0.5) return vec3(0.84, 0.44, 0.08); // Entities: warm ochre-amber
    if (cIdx < 1.5) return vec3(0.06, 0.48, 0.72); // Code: cobalt-cyan
    if (cIdx < 2.5) return vec3(0.08, 0.56, 0.44); // Nature: deep viridian
    return vec3(0.56, 0.22, 0.68);                 // Sequence/Tone: plum-violet
  }
  // Luminous dark-theme hues
  if (cIdx < 0.5) return vec3(1.00, 0.68, 0.26); // Entities: warm amber-gold
  if (cIdx < 1.5) return vec3(0.28, 0.84, 1.00); // Code: electric cyan
  if (cIdx < 2.5) return vec3(0.26, 0.92, 0.68); // Nature: emerald-mint
  return vec3(0.82, 0.48, 1.00);                 // Sequence/Tone: luminous violet
}

vec4 over(vec4 top, vec4 under) {
  return top + under * (1.0 - top.a);
}

void main() {
  vec2 vb = viewOf(gl_FragCoord.xy);
  float px = pixelOf();
  vec3 V = towardViewer();
  vec3 p0 = rayOf(vb);

  vec3 bmin = C_CENTER - vec3(C_INNER);
  vec3 bmax = C_CENTER + vec3(C_INNER);
  vec2 hb = hitBox(p0, V, bmin, bmax);

  // Soft window so nothing ever leaks outside the glass chamber
  float inCube = smoothstep(-2.0 * px, 2.0 * px, hb.y - hb.x);
  if (inCube < 0.001) {
    gl_FragColor = vec4(0.0);
    return;
  }

  vec3 colDark = vec3(0.0);
  vec4 inkLight = vec4(0.0);

  // 1. Subtle floor light pool cast by the active residual-stream cursor orb
  vec3 pf = onFloor(vb, FLOOR_Z);
  vec2 fRel = abs(pf.xy - C_CENTER.xy);
  float onChamberFloor = (1.0 - smoothstep(C_INNER - 2.0, C_INNER, fRel.x))
                       * (1.0 - smoothstep(C_INNER - 2.0, C_INNER, fRel.y));
  float fDist = length(pf.xy - uCursor.xy);
  float hFactor = 1.0 / (1.0 + 0.008 * max(0.0, uCursor.z - FLOOR_Z));
  float floorPool = exp(-pow(fDist / 44.0, 2.0)) * onChamberFloor * hFactor * 0.28;
  colDark += vec3(0.45, 0.78, 1.0) * floorPool;
  if (uLight > 0.5) {
    float fa = floorPool * 0.32;
    inkLight = over(vec4(vec3(0.14, 0.36, 0.68) * fa, fa), inkLight);
  }

  // 2. 4D Tesseract / Nested Hypercube Lattice (breathes subtly with layer depth l)
  float lNorm = uLayer / 6.0;
  float innerScale = (0.48 + 0.14 * lNorm) * C_INNER;
  vec3 innerC = C_CENTER + vec3(1.0, -0.6, 0.8) * (lNorm - 0.5) * 14.0;
  float tessLine = 0.0;
  float lineW = max(0.65, 1.0 * px);

  // 12 edges of the inner hypercube + 8 corner-to-corner 4D struts
  for (int axis = 0; axis < 3; axis++) {
    for (int i = 0; i < 4; i++) {
      float s1 = (i == 0 || i == 2) ? -1.0 : 1.0;
      float s2 = (i < 2) ? -1.0 : 1.0;
      vec3 a, b;
      if (axis == 0) {
        a = innerC + vec3(-innerScale, s1 * innerScale, s2 * innerScale);
        b = innerC + vec3( innerScale, s1 * innerScale, s2 * innerScale);
      } else if (axis == 1) {
        a = innerC + vec3(s1 * innerScale, -innerScale, s2 * innerScale);
        b = innerC + vec3(s1 * innerScale,  innerScale, s2 * innerScale);
      } else {
        a = innerC + vec3(s1 * innerScale, s2 * innerScale, -innerScale);
        b = innerC + vec3(s1 * innerScale, s2 * innerScale,  innerScale);
      }
      vec3 rs = raySegment(p0, V, a, b);
      tessLine = max(tessLine, exp(-pow(rs.x / (lineW * 1.25), 2.0)) * 0.34);
    }
  }
  // 8 4D struts connecting outer cube corners to inner hypercube corners
  for (int i = 0; i < 8; i++) {
    float sx = (mod(float(i), 2.0) < 0.5) ? -1.0 : 1.0;
    float sy = (mod(floor(float(i) / 2.0), 2.0) < 0.5) ? -1.0 : 1.0;
    float sz = (i < 4) ? -1.0 : 1.0;
    vec3 outerPt = C_CENTER + vec3(sx, sy, sz) * (C_INNER - 2.0);
    vec3 innerPt = innerC + vec3(sx, sy, sz) * innerScale;
    vec3 rs = raySegment(p0, V, outerPt, innerPt);
    float strut = exp(-pow(rs.x / (lineW * 1.15), 2.0)) * (0.22 - 0.08 * rs.y);
    tessLine = max(tessLine, strut);
  }
  colDark += vec3(0.48, 0.72, 0.98) * tessLine * inCube;
  if (uLight > 0.5 && tessLine > 0.005) {
    float ta = tessLine * 0.65 * inCube;
    inkLight = over(vec4(vec3(0.22, 0.34, 0.52) * ta, ta), inkLight);
  }

  // 3. Active Circuit Filaments (top 8 feature-to-feature attribution edges)
  for (int i = 0; i < 8; i++) {
    float strength = max(0.18, uEdgeA[i].w);
    vec3 a = uEdgeA[i].xyz;
    vec3 b = uEdgeB[i].xyz;
    vec3 rs = raySegment(p0, V, a, b);
    float core = exp(-pow(rs.x / (max(0.75, 1.05 * px)), 2.0));
    float glow = exp(-pow(rs.x / 4.8, 2.0)) * 0.34;
    float pulse = 0.78 + 0.22 * sin(rs.y * 9.0 - uTime * 2.4 + float(i));
    vec3 c = clusterColor(uEdgeB[i].w, uLight);
    float e = (core * 0.85 + glow) * strength * pulse * inCube;
    colDark += c * e;
    if (uLight > 0.5 && e > 0.01) {
      float ea = min(0.82, (core * 0.75 + glow * 0.42) * strength * inCube);
      inkLight = over(vec4(c * ea, ea), inkLight);
    }
  }

  // 4. Residual Stream Trajectory (6 segments from L0 -> L6)
  for (int i = 0; i < 6; i++) {
    vec3 a = uTraj[i].xyz;
    vec3 b = uTraj[i + 1].xyz;
    vec3 rs = raySegment(p0, V, a, b);
    float segLayer = float(i) + rs.y;
    // Active traversed portion vs faint future preview
    float traversed = 1.0 - smoothstep(uLayer - 0.12, uLayer + 0.08, segLayer);
    float wCore = mix(0.75, 1.55, traversed) + 0.5 * px;
    float core = exp(-pow(rs.x / wCore, 2.0));
    float aura = exp(-pow(rs.x / 6.5, 2.0)) * 0.34 * traversed;
    float futureGhost = core * 0.22 * (1.0 - traversed);

    vec3 pathColDark = mix(vec3(0.45, 0.75, 1.0), vec3(1.0, 0.96, 0.88), traversed * (0.45 + 0.55 * (segLayer / 6.0)));
    colDark += (pathColDark * (core * 1.15 * traversed + aura) + vec3(0.55, 0.7, 0.9) * futureGhost) * inCube;

    if (uLight > 0.5) {
      vec3 pathColLight = mix(vec3(0.28, 0.36, 0.48), vec3(0.10, 0.22, 0.52), traversed);
      float pa = min(0.92, (core * (0.88 * traversed + 0.22 * (1.0 - traversed)) + aura * 0.35) * inCube);
      if (pa > 0.008) inkLight = over(vec4(pathColLight * pa, pa), inkLight);
    }
  }

  // 5. 24 Suspended SAE Feature Nodes
  for (int i = 0; i < 24; i++) {
    vec3 np = uNodes[i].xyz;
    float act = uNodes[i].w;
    vec2 rp = rayPoint(p0, V, np);
    float r = 2.0 + 3.0 * min(1.0, act);
    float core = 1.0 - smoothstep(r - 0.8 * px, r + 0.8 * px, rp.x);
    float halo = exp(-pow(rp.x / (r * 2.3), 2.0)) * (0.14 + 0.62 * act);
    float cIdx = floor(float(i) / 6.0);
    vec3 c = clusterColor(cIdx, uLight);

    // Dark theme: glowing orb with white-hot core when strongly active
    vec3 nodeDark = mix(c * (0.28 + 0.85 * act), vec3(1.0, 0.98, 0.94), core * min(0.85, act * 0.7));
    colDark += (nodeDark * core * (0.35 + 0.95 * act) + c * halo) * inCube;

    // Light theme: crisp saturated ink orb with pale highlight core when active
    if (uLight > 0.5) {
      float na = min(0.94, (core * (0.32 + 0.66 * min(1.0, act)) + halo * 0.28) * inCube);
      if (na > 0.008) {
        vec3 nCol = mix(c, vec3(0.96, 0.98, 1.0), core * smoothstep(0.55, 1.2, act) * 0.55);
        inkLight = over(vec4(nCol * na, na), inkLight);
      }
    }
  }

  // 6. 5 Unembedding Target Beacons + Sight-line to Top Predicted Token
  float bestP = -1.0;
  vec3 bestPos = uTokens[0].xyz;
  for (int i = 0; i < 5; i++) {
    vec3 tp = uTokens[i].xyz;
    float prob = uTokens[i].w;
    if (prob > bestP) { bestP = prob; bestPos = tp; }
    vec2 rp = rayPoint(p0, V, tp);
    float r = 2.6 + 2.4 * prob;
    float ring = exp(-pow((rp.x - r * 1.45) / (0.8 + 0.5 * px), 2.0)) * (0.25 + 0.75 * prob);
    float dotCore = 1.0 - smoothstep(r * 0.65 - 0.6 * px, r * 0.65 + 0.6 * px, rp.x);
    vec3 bCol = (uLight > 0.5) ? vec3(0.76, 0.24, 0.14) : vec3(1.0, 0.86, 0.52);
    colDark += bCol * (dotCore * (0.35 + 0.9 * prob) + ring * 0.85);
    if (uLight > 0.5) {
      float ba = min(0.9, dotCore * (0.35 + 0.58 * prob) + ring * 0.55);
      if (ba > 0.008) inkLight = over(vec4(bCol * ba, ba), inkLight);
    }
  }
  // Fine sight-line from current residual state x(l) to the winning unembedding beacon
  {
    vec3 rs = raySegment(p0, V, uCursor, bestPos);
    float dash = 0.5 + 0.5 * sin(rs.y * 28.0 - uTime * 3.0);
    float line = exp(-pow(rs.x / (0.65 + 0.5 * px), 2.0)) * (0.28 + 0.35 * bestP) * (0.55 + 0.45 * dash) * inCube;
    colDark += vec3(1.0, 0.88, 0.58) * line;
    if (uLight > 0.5 && line > 0.008) {
      float la = min(0.65, line * 0.85);
      inkLight = over(vec4(vec3(0.76, 0.24, 0.14) * la, la), inkLight);
    }
  }

  // 7. Living Residual-Stream State Orb at x(l) (the focal lit subject!)
  {
    vec2 rp = rayPoint(p0, V, uCursor);
    float rOrb = 4.2 + 0.6 * sin(uTime * 2.8);
    float core = 1.0 - smoothstep(rOrb - 0.9 * px, rOrb + 0.9 * px, rp.x);
    float rim = exp(-pow((rp.x - rOrb * 1.7) / (1.0 + 0.6 * px), 2.0)) * 0.55;
    float bloom = exp(-pow(rp.x / 18.0, 2.0)) * 0.65;
    vec3 orbTint = mix(vec3(0.62, 0.88, 1.0), vec3(1.0, 0.72, 0.38), min(1.0, uSteerMag));

    colDark += (vec3(1.0, 0.99, 0.96) * core * 1.45 + orbTint * (rim + bloom)) * inCube;
    if (uLight > 0.5) {
      vec3 oInk = mix(vec3(0.08, 0.26, 0.66), vec3(0.82, 0.32, 0.10), min(1.0, uSteerMag));
      float oa = min(0.96, (core * 0.94 + rim * 0.55 + bloom * 0.22) * inCube);
      vec3 oSeen = mix(oInk, vec3(0.97, 0.98, 1.0), core * 0.58);
      inkLight = over(vec4(oSeen * oa, oa), inkLight);
    }
  }

  // Tonemap, dither, and apply calm first-light fade
  float dither = (hash12(gl_FragCoord.xy + fract(uTime * 0.61) * 91.0)
                + hash12(gl_FragCoord.yx * 1.37 + fract(uTime * 0.37) * 57.0) - 1.0) / 255.0;

  if (uLight > 0.5) {
    vec4 outL = inkLight * uFirst;
    outL.rgb = min(outL.rgb, vec3(outL.a));
    float gate = smoothstep(0.0, 1.5 / 255.0, outL.a);
    outL = max(outL + vec4(dither * gate), vec4(0.0));
    outL.rgb = min(outL.rgb, vec3(outL.a));
    gl_FragColor = outL;
  } else {
    vec3 c = tonemap(colDark, 1.18) * uFirst;
    float m = max(c.r, max(c.g, c.b));
    c = max(c + dither * smoothstep(0.0, 1.5 / 255.0, m), 0.0);
    gl_FragColor = vec4(c, max(c.r, max(c.g, c.b)));
  }
}
`;

  const canvas = stage.querySelector(".lc-gl");
  const layer = glLayer({
    canvas,
    fragment: FRAGMENT,
    view: [D.W, D.H],
    camera: D.camera,
    uniforms: [
      "uFirst", "uLayer", "uSteerMag", "uCursor",
      "uNodes", "uTraj", "uTokens", "uEdgeA", "uEdgeB",
    ],
    fixed: { uLight: LIGHT },
  });
  if (layer) stage.setAttribute("data-gl", "");

  // DOM references for live SVG controls & readout
  const readout = document.querySelector("[data-readout]");
  const carriageEl = stage.querySelector("[data-part='carriage']");
  const knobPtrEl = stage.querySelector("[data-part='knob-ptr']");
  const barEls = Array.from(stage.querySelectorAll("[data-bar]"));
  const barCapEls = Array.from(stage.querySelectorAll("[data-bar-cap]"));

  // Interactive state
  let promptIdx = 0;
  let targetLayer = 4.2;
  const curLayer = { x: 4.2, v: 0 };
  const targetSteer = [0, 0, 0];
  const curSteer = [0, 0, 0];
  let tourActive = true;
  let idleTimer = 0;
  let firstClock = 0;
  let clock = 0;
  let last = 0;
  let frame = 0;
  let visible = false;
  let dragging = null; // "rail" | "cube"

  // Reusable flat typed arrays for WebGL uniforms
  const uNodesArr = new Float32Array(24 * 4);
  const uTrajArr = new Float32Array(7 * 4);
  const uTokensArr = new Float32Array(5 * 4);
  const uEdgeAArr = new Float32Array(8 * 4);
  const uEdgeBArr = new Float32Array(8 * 4);

  // Smoothly interpolated node activations & trajectory points across prompt switches
  let dispTraj = Array.from({ length: 7 }, () => [CUBE_CX, CUBE_CY, CUBE_CZ]);
  let dispActs = new Array(24).fill(0);
  let dispProbs = new Array(5).fill(0.2);

  function setPrompt(idx) {
    promptIdx = ((idx % PROMPTS.length) + PROMPTS.length) % PROMPTS.length;
    targetSteer[0] = targetSteer[1] = targetSteer[2] = 0;
    updateKnob();
    run();
  }

  function updateKnob() {
    if (!knobPtrEl) return;
    const angle = -2.1 + (promptIdx / (PROMPTS.length - 1)) * 4.2;
    const cx = D.knob.cx, cy = D.knob.cy, z = D.knob.z;
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const pA = iso([cx - dx * 2.5, cy - dy * 2.5, z], D.P);
    const pB = iso([cx + dx * 6.8, cy + dy * 6.8, z], D.P);
    knobPtrEl.setAttribute("d", `M${pA[0].toFixed(1)},${pA[1].toFixed(1)} L${pB[0].toFixed(1)},${pB[1].toFixed(1)}`);
  }

  function updateCarriage(lVal) {
    if (!carriageEl) return;
    const frac = Math.max(0, Math.min(1, lVal / N_LAYERS));
    const dxWorld = (frac - 0.5) * D.rail.span;
    const p0 = iso([0, 0, 0], D.P);
    const p1 = iso([dxWorld, 0, 0], D.P);
    carriageEl.setAttribute("transform", `translate(${(p1[0] - p0[0]).toFixed(2)} ${(p1[1] - p0[1]).toFixed(2)})`);
  }

  function updateBars(probs, topIdx) {
    for (let i = 0; i < barEls.length; i++) {
      const p = Math.max(0.04, Math.min(1, probs[i] || 0));
      const h = p * D.bars.maxH;
      const b = D.bars.items[i];
      const cyl = cylinder(b.x, b.y, b.r, b.z0, h, D.P, 20);
      barEls[i].setAttribute("d", cyl.fill);
      barEls[i].setAttribute("data-top", i === topIdx ? "1" : "0");
      if (barCapEls[i]) {
        barCapEls[i].setAttribute("d", ring(b.x, b.y, b.r, b.z0 + h, D.P, 20));
      }
    }
  }

  // Pointer interactions: knob click, rail drag, cube drag (steering)
  function viewPointFromEvent(e) {
    const rect = stage.getBoundingClientRect();
    return [
      ((e.clientX - rect.left) / rect.width) * D.W,
      ((e.clientY - rect.top) / rect.height) * D.H,
    ];
  }

  stage.addEventListener("pointerdown", (e) => {
    const t = e.target;
    tourActive = false;
    idleTimer = 0;
    if (t && t.closest && t.closest("[data-hit='knob']")) {
      setPrompt(promptIdx + 1);
      return;
    }
    if (t && t.closest && t.closest("[data-hit='rail']")) {
      dragging = "rail";
      stage.setPointerCapture(e.pointerId);
      handleRailDrag(e);
      return;
    }
    // Dragging anywhere on the cube injects a 3D steering vector
    dragging = "cube";
    stage.setPointerCapture(e.pointerId);
    handleCubeDrag(e);
  });

  function handleRailDrag(e) {
    const [vx] = viewPointFromEvent(e);
    const frac = Math.max(0, Math.min(1, (vx - D.rail.vbX0) / (D.rail.vbX1 - D.rail.vbX0)));
    targetLayer = frac * N_LAYERS;
    run();
  }

  function handleCubeDrag(e) {
    const [vx, vy] = viewPointFromEvent(e);
    const sx = Math.max(-1, Math.min(1, (vx - D.cube.vbCenter[0]) / 120));
    const sy = Math.max(-1, Math.min(1, -(vy - D.cube.vbCenter[1]) / 120));
    targetSteer[0] = sx * 0.9;
    targetSteer[1] = -sx * 0.45 + sy * 0.45;
    targetSteer[2] = sy * 0.9;
    run();
  }

  stage.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    if (dragging === "rail") handleRailDrag(e);
    else if (dragging === "cube") handleCubeDrag(e);
  });

  stage.addEventListener("pointerup", () => {
    if (dragging === "cube") {
      // Gently relax steering back toward 0 on release so user sees the rebound
      targetSteer[0] *= 0.65;
      targetSteer[1] *= 0.65;
      targetSteer[2] *= 0.65;
    }
    dragging = null;
  });

  // Double-click resets steering
  stage.addEventListener("dblclick", () => {
    targetSteer[0] = targetSteer[1] = targetSteer[2] = 0;
    run();
  });

  // Keyboard controls
  stage.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") {
      tourActive = false; idleTimer = 0;
      targetLayer = Math.min(N_LAYERS, targetLayer + 0.5);
      e.preventDefault(); run();
    } else if (e.key === "ArrowLeft") {
      tourActive = false; idleTimer = 0;
      targetLayer = Math.max(0, targetLayer - 0.5);
      e.preventDefault(); run();
    } else if (e.key === " ") {
      tourActive = !tourActive; idleTimer = 0;
      e.preventDefault(); run();
    } else if (e.key >= "1" && e.key <= "5") {
      tourActive = false; idleTimer = 0;
      setPrompt(Number(e.key) - 1);
    } else if (e.key === "r" || e.key === "R") {
      targetSteer[0] = targetSteer[1] = targetSteer[2] = 0;
      run();
    }
  });

  // Initialize knob & first trajectory
  updateKnob();
  {
    const initRun = forward(0);
    dispTraj = initRun.states.map((s) => toWorld(project3(s)));
    const initLens = logitLens(initRun, targetLayer);
    dispActs = initLens.acts.slice();
    dispProbs = initLens.probs.slice();
  }

  function tick(now) {
    const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
    last = now;
    clock += dt;
    firstClock += dt;

    const calm = still.matches;

    // Calm idle tour: gently sweeps L0 -> L6, then advances to the next prompt
    if (!calm) {
      if (!tourActive && !dragging) {
        idleTimer += dt;
        if (idleTimer > 14) tourActive = true;
      }
      if (tourActive && !dragging) {
        targetLayer += dt * 0.55;
        if (targetLayer > N_LAYERS + 1.4) {
          targetLayer = 0.0;
          promptIdx = (promptIdx + 1) % PROMPTS.length;
          targetSteer[0] = targetSteer[1] = targetSteer[2] = 0;
          updateKnob();
        }
      }
    }

    const clampedTargetL = Math.max(0, Math.min(N_LAYERS, targetLayer));
    settle(curLayer, clampedTargetL, dt, 0.24, calm);

    const kFollow = calm ? 1 : 1 - Math.exp(-dt * 8.5);
    for (let i = 0; i < 3; i++) curSteer[i] += (targetSteer[i] - curSteer[i]) * kFollow;
    const steerMag = Math.hypot(curSteer[0], curSteer[1], curSteer[2]);
    const steer8 = steerMag > 0.01 ? unprojectSteer(curSteer) : null;

    // Run real forward pass + Logit Lens at continuous layer depth curLayer.x
    const runRes = forward(promptIdx, steer8);
    const lens = logitLens(runRes, curLayer.x);

    // Smoothly ease visual trajectory, activations, and probabilities
    const targetTraj = runRes.states.map((s) => toWorld(project3(s)));
    for (let i = 0; i < 7; i++) {
      for (let c = 0; c < 3; c++) dispTraj[i][c] += (targetTraj[i][c] - dispTraj[i][c]) * kFollow;
    }
    for (let i = 0; i < 24; i++) dispActs[i] += (lens.acts[i] - dispActs[i]) * kFollow;
    for (let i = 0; i < 5; i++) dispProbs[i] += (lens.probs[i] - dispProbs[i]) * kFollow;

    // Interpolated cursor along dispTraj at curLayer.x
    const cl = Math.max(0, Math.min(N_LAYERS, curLayer.x));
    const i0 = Math.min(N_LAYERS - 1, Math.floor(cl));
    const i1 = i0 + 1;
    const f = cl - i0;
    const sf = f * f * (3 - 2 * f);
    const cursorW = [
      dispTraj[i0][0] * (1 - sf) + dispTraj[i1][0] * sf,
      dispTraj[i0][1] * (1 - sf) + dispTraj[i1][1] * sf,
      dispTraj[i0][2] * (1 - sf) + dispTraj[i1][2] * sf,
    ];

    // Pack WebGL uniform buffers
    for (let i = 0; i < 24; i++) {
      uNodesArr[i * 4 + 0] = NODE_W[i][0];
      uNodesArr[i * 4 + 1] = NODE_W[i][1];
      uNodesArr[i * 4 + 2] = NODE_W[i][2];
      uNodesArr[i * 4 + 3] = dispActs[i];
    }
    for (let i = 0; i < 7; i++) {
      uTrajArr[i * 4 + 0] = dispTraj[i][0];
      uTrajArr[i * 4 + 1] = dispTraj[i][1];
      uTrajArr[i * 4 + 2] = dispTraj[i][2];
      uTrajArr[i * 4 + 3] = i;
    }
    for (let i = 0; i < 5; i++) {
      uTokensArr[i * 4 + 0] = TOKEN_W[i][0];
      uTokensArr[i * 4 + 1] = TOKEN_W[i][1];
      uTokensArr[i * 4 + 2] = TOKEN_W[i][2];
      uTokensArr[i * 4 + 3] = dispProbs[i];
    }

    // Rank circuit edges by active attribution strength and pack top 8
    const scoredEdges = CIRCUIT_EDGES.map(([a, b, w]) => ({
      a, b,
      s: Math.sqrt(Math.max(0, dispActs[a]) * Math.max(0, dispActs[b])) * w,
      cluster: FEATURES[b].cluster,
    })).sort((x, y) => y.s - x.s);

    for (let i = 0; i < 8; i++) {
      const e = scoredEdges[i];
      const pa = NODE_W[e.a], pb = NODE_W[e.b];
      uEdgeAArr[i * 4 + 0] = pa[0];
      uEdgeAArr[i * 4 + 1] = pa[1];
      uEdgeAArr[i * 4 + 2] = pa[2];
      uEdgeAArr[i * 4 + 3] = Math.min(1.2, e.s * 1.15);
      uEdgeBArr[i * 4 + 0] = pb[0];
      uEdgeBArr[i * 4 + 1] = pb[1];
      uEdgeBArr[i * 4 + 2] = pb[2];
      uEdgeBArr[i * 4 + 3] = e.cluster;
    }

    const firstEnv = calm ? 1 : smooth(0, 1, (firstClock - 0.05) / 0.75);
    if (layer) {
      layer.draw(
        {
          uFirst: firstEnv,
          uLayer: curLayer.x,
          uSteerMag: steerMag,
          uCursor: cursorW,
          uNodes: uNodesArr,
          uTraj: uTrajArr,
          uTokens: uTokensArr,
          uEdgeA: uEdgeAArr,
          uEdgeB: uEdgeBArr,
        },
        calm ? 0.8 : clock,
      );
    }

    // Update live SVG carriage, probability bars, and readout
    updateCarriage(curLayer.x);
    updateBars(dispProbs, lens.topIdx);

    if (readout) {
      const pTxt = PROMPTS[promptIdx].text;
      const steerTag = steerMag > 0.08 ? ` · Δ${steerMag.toFixed(1)}` : "";
      readout.textContent = `"${pTxt}" → ${lens.topToken} ${Math.round(lens.topProb * 100)}% · L${curLayer.x.toFixed(1)} · H ${lens.entropy.toFixed(2)}${steerTag}`;
    }

    frame = visible && !calm ? requestAnimationFrame(tick) : 0;
  }

  function run() {
    if (!frame && visible) {
      last = 0;
      frame = requestAnimationFrame(tick);
    }
  }

  new IntersectionObserver(
    (entries) => {
      visible = entries[entries.length - 1].isIntersecting;
      if (visible) run();
    },
    { rootMargin: "120px 0px" },
  ).observe(stage);

  window.addEventListener("resize", () => run());
})();

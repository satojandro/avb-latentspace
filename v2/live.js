(function () {
  const D = __DATA__;
  const stage = document.querySelector(".lc-stage");
  if (!stage) return;

  const still = matchMedia("(prefers-reduced-motion: reduce)");
  let isLight = document.body.dataset.theme === "light" ? 1 : 0;

  const CUBE_CX = D.cube.cx;
  const CUBE_CY = D.cube.cy;
  const CUBE_CZ = D.cube.cz;
  const CUBE_HALF = D.cube.half; // 104 world units inside 115u half-width glass

  function toWorld(p3) {
    return [
      CUBE_CX + p3[0] * CUBE_HALF,
      CUBE_CY + p3[1] * CUBE_HALF,
      CUBE_CZ + p3[2] * CUBE_HALF,
    ];
  }

  const NODE_W = FEATURE_POS3.map(toWorld);
  const TOKEN_W = TOKEN_POS3.map((p) => [
    CUBE_CX + p[0] * (CUBE_HALF + 6),
    CUBE_CY + p[1] * (CUBE_HALF + 6),
    CUBE_CZ + p[2] * (CUBE_HALF + 6),
  ]);
  const NODE_VB = NODE_W.map((w) => iso(w, D.P));
  const TOKEN_VB = TOKEN_W.map((w) => iso(w, D.P));

  const CLUSTER_HEX_DARK = ["#ffae42", "#47d6ff", "#42eba8", "#d17aff"];
  const CLUSTER_HEX_LIGHT = ["#c86410", "#0e74ad", "#108568", "#8834a6"];

  // --- WebGL Fragment Shader (48 SAE nodes, 16 pulsing circuits, 3D axes, drop-lines, 4D hypercube) ---
  const FRAGMENT = `
uniform float uLight;
uniform float uFirst;
uniform float uLayer;
uniform float uSteerMag;
uniform float uHoverIdx;
uniform vec3 uCursor;
uniform vec4 uNodes[48];
uniform vec4 uTraj[7];
uniform vec4 uTokens[5];
uniform vec4 uEdgeA[16];
uniform vec4 uEdgeB[16];

const vec3 C_CENTER = vec3(${CUBE_CX.toFixed(1)}, ${CUBE_CY.toFixed(1)}, ${CUBE_CZ.toFixed(1)});
const float C_INNER = ${(CUBE_HALF + 9.5).toFixed(1)};
const float FLOOR_Z = ${(D.cube.z0).toFixed(1)};

vec2 rayPoint(vec3 p0, vec3 V, vec3 q) {
  vec3 d = q - p0;
  float t = dot(d, V);
  float dist = length(d - t * V);
  return vec2(dist, t);
}

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

vec2 hitBox(vec3 p0, vec3 V, vec3 bmin, vec3 bmax) {
  vec3 invV = 1.0 / (V + vec3(1e-7));
  vec3 t0 = (bmin - p0) * invV;
  vec3 t1 = (bmax - p0) * invV;
  vec3 tmin = min(t0, t1);
  vec3 tmax = max(t0, t1);
  return vec2(max(max(tmin.x, tmin.y), tmin.z), min(min(tmax.x, tmax.y), tmax.z));
}

vec3 clusterColor(float cIdx, float isL) {
  if (isL > 0.5) {
    if (cIdx < 0.5) return vec3(0.82, 0.42, 0.08);
    if (cIdx < 1.5) return vec3(0.06, 0.46, 0.72);
    if (cIdx < 2.5) return vec3(0.07, 0.54, 0.42);
    return vec3(0.54, 0.20, 0.66);
  }
  if (cIdx < 0.5) return vec3(1.00, 0.68, 0.26);
  if (cIdx < 1.5) return vec3(0.28, 0.84, 1.00);
  if (cIdx < 2.5) return vec3(0.26, 0.92, 0.68);
  return vec3(0.82, 0.48, 1.00);
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
  float inCube = smoothstep(-2.0 * px, 2.0 * px, hb.y - hb.x);
  if (inCube < 0.001) {
    gl_FragColor = vec4(0.0);
    return;
  }

  vec3 colDark = vec3(0.0);
  vec4 inkLight = vec4(0.0);
  float thin = max(0.55, 0.85 * px);

  // 1. Floor projection pool & crisp crosshair directly beneath x(l)
  vec3 pf = onFloor(vb, FLOOR_Z);
  vec2 fRel = abs(pf.xy - C_CENTER.xy);
  float onFloorMask = (1.0 - smoothstep(C_INNER - 2.0, C_INNER, fRel.x))
                    * (1.0 - smoothstep(C_INNER - 2.0, C_INNER, fRel.y));
  float fDist = length(pf.xy - uCursor.xy);
  float floorPool = exp(-pow(fDist / 48.0, 2.0)) * onFloorMask * 0.22;
  float floorRing = exp(-pow((fDist - 7.5) / (0.85 + 0.5 * px), 2.0)) * onFloorMask * 0.45;
  colDark += vec3(0.45, 0.80, 1.0) * (floorPool + floorRing);
  if (uLight > 0.5) {
    float fa = (floorPool * 0.35 + floorRing * 0.55);
    if (fa > 0.004) inkLight = over(vec4(vec3(0.14, 0.34, 0.66) * fa, fa), inkLight);
  }

  // 2. Principal Component Axes (PC1, PC2, PC3) through origin + orthogonal drop-line from x(l)
  float axisLine = 0.0;
  for (int a = 0; a < 3; a++) {
    vec3 dir = (a == 0) ? vec3(1.0, 0.0, 0.0) : (a == 1 ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0));
    vec3 rs = raySegment(p0, V, C_CENTER - dir * (C_INNER - 4.0), C_CENTER + dir * (C_INNER - 4.0));
    axisLine = max(axisLine, exp(-pow(rs.x / (thin * 1.1), 2.0)) * 0.14);
  }
  // Orthogonal drop-line from uCursor down to floor (z = FLOOR_Z)
  {
    vec3 rsDrop = raySegment(p0, V, uCursor, vec3(uCursor.xy, FLOOR_Z));
    float dash = 0.4 + 0.6 * smoothstep(-0.1, 0.2, sin(rsDrop.y * 42.0));
    float dropL = exp(-pow(rsDrop.x / (thin * 1.05), 2.0)) * 0.38 * dash;
    axisLine = max(axisLine, dropL);
  }
  colDark += vec3(0.52, 0.78, 1.0) * axisLine * inCube;
  if (uLight > 0.5 && axisLine > 0.005) {
    float aa = axisLine * 0.68 * inCube;
    inkLight = over(vec4(vec3(0.20, 0.34, 0.54) * aa, aa), inkLight);
  }

  // 3. 4D Nested Hypercube Lattice (morphs cleanly with layer depth l = 0..6)
  float lNorm = uLayer / 6.0;
  float innerScale = (0.44 + 0.18 * lNorm) * C_INNER;
  vec3 innerC = C_CENTER + vec3(1.0, -0.6, 0.75) * (lNorm - 0.5) * 16.0;
  float tessLine = 0.0;
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
      tessLine = max(tessLine, exp(-pow(rs.x / (thin * 1.15), 2.0)) * 0.30);
    }
  }
  for (int i = 0; i < 8; i++) {
    float sx = (mod(float(i), 2.0) < 0.5) ? -1.0 : 1.0;
    float sy = (mod(floor(float(i) / 2.0), 2.0) < 0.5) ? -1.0 : 1.0;
    float sz = (i < 4) ? -1.0 : 1.0;
    vec3 outerPt = C_CENTER + vec3(sx, sy, sz) * (C_INNER - 2.0);
    vec3 innerPt = innerC + vec3(sx, sy, sz) * innerScale;
    vec3 rs = raySegment(p0, V, outerPt, innerPt);
    tessLine = max(tessLine, exp(-pow(rs.x / (thin * 1.05), 2.0)) * (0.20 - 0.08 * rs.y));
  }
  colDark += vec3(0.42, 0.68, 0.96) * tessLine * inCube;
  if (uLight > 0.5 && tessLine > 0.005) {
    float ta = tessLine * 0.62 * inCube;
    inkLight = over(vec4(vec3(0.22, 0.34, 0.50) * ta, ta), inkLight);
  }

  // 4. 16 Active Circuit Filaments with Directional Signal Pulses
  for (int i = 0; i < 16; i++) {
    float strength = max(0.24, uEdgeA[i].w);
    vec3 a = uEdgeA[i].xyz;
    vec3 b = uEdgeB[i].xyz;
    vec3 rs = raySegment(p0, V, a, b);
    float core = exp(-pow(rs.x / (max(0.8, 1.15 * px)), 2.0));
    float glow = exp(-pow(rs.x / 4.8, 2.0)) * 0.34;
    float phase = fract(rs.y - uTime * 0.55 - float(i) * 0.19);
    float packet = exp(-pow((phase - 0.5) * 7.0, 2.0)) * smoothstep(0.18, 0.7, uEdgeA[i].w);
    vec3 c = clusterColor(uEdgeB[i].w, uLight);
    float e = (core * (0.85 + 1.15 * packet) + glow) * strength * inCube;
    colDark += mix(c, vec3(1.0, 0.98, 0.94), packet * 0.6) * e;
    if (uLight > 0.5 && e > 0.01) {
      float ea = min(0.88, (core * (0.72 + 0.45 * packet) + glow * 0.42) * strength * inCube);
      inkLight = over(vec4(c * ea, ea), inkLight);
    }
  }

  // 5. Residual Stream Trajectory (6 segments + discrete L0..L6 layer waypoints)
  for (int i = 0; i < 6; i++) {
    vec3 a = uTraj[i].xyz;
    vec3 b = uTraj[i + 1].xyz;
    vec3 rs = raySegment(p0, V, a, b);
    float segLayer = float(i) + rs.y;
    float traversed = 1.0 - smoothstep(uLayer - 0.1, uLayer + 0.08, segLayer);
    float wCore = mix(0.9, 1.9, traversed) + 0.5 * px;
    float core = exp(-pow(rs.x / wCore, 2.0));
    float aura = exp(-pow(rs.x / 7.5, 2.0)) * 0.42 * traversed;
    float futureGhost = core * 0.32 * (1.0 - traversed);

    vec3 pathColDark = mix(vec3(0.45, 0.80, 1.0), vec3(1.0, 0.97, 0.90), traversed * (0.5 + 0.5 * (segLayer / 6.0)));
    colDark += (pathColDark * (core * 1.45 * traversed + aura) + vec3(0.58, 0.78, 0.98) * futureGhost) * inCube;
    if (uLight > 0.5) {
      vec3 pathColLight = mix(vec3(0.28, 0.36, 0.48), vec3(0.08, 0.22, 0.58), traversed);
      float pa = min(0.95, (core * (0.92 * traversed + 0.28 * (1.0 - traversed)) + aura * 0.38) * inCube);
      if (pa > 0.008) inkLight = over(vec4(pathColLight * pa, pa), inkLight);
    }
  }
  // Discrete layer waypoint rings L0..L6 along the trajectory
  for (int i = 0; i < 7; i++) {
    vec2 rp = rayPoint(p0, V, uTraj[i].xyz);
    float reached = 1.0 - smoothstep(uLayer - 0.15, uLayer + 0.15, float(i));
    float rW = mix(2.2, 3.2, reached);
    float ring = exp(-pow((rp.x - rW) / (0.75 + 0.5 * px), 2.0)) * (0.35 + 0.75 * reached);
    float dotC = (1.0 - smoothstep(1.3 - 0.5 * px, 1.3 + 0.5 * px, rp.x)) * (0.45 + 0.75 * reached);
    colDark += vec3(0.88, 0.96, 1.0) * (ring + dotC) * inCube;
    if (uLight > 0.5) {
      float wa = min(0.92, (ring * 0.8 + dotC * 0.9) * inCube);
      if (wa > 0.008) inkLight = over(vec4(vec3(0.08, 0.22, 0.56) * wa, wa), inkLight);
    }
  }

  // 6. 48 Crisp Monosemantic SAE Feature Nodes
  for (int i = 0; i < 48; i++) {
    vec3 np = uNodes[i].xyz;
    float act = uNodes[i].w;
    float isHov = 1.0 - step(0.5, abs(float(i) - uHoverIdx));
    vec2 rp = rayPoint(p0, V, np);
    float r = 2.0 + 2.8 * min(1.0, act) + 1.6 * isHov;
    float core = 1.0 - smoothstep(r - 0.8 * px, r + 0.8 * px, rp.x);
    float ring = exp(-pow((rp.x - (r + 2.8)) / (0.75 + 0.45 * px), 2.0)) * (smoothstep(0.4, 1.0, act) * 0.78 + isHov * 0.95);
    float halo = exp(-pow(rp.x / (r * 2.4), 2.0)) * (0.18 + 0.56 * act + 0.42 * isHov);
    float cIdx = floor(float(i) / 12.0);
    vec3 c = clusterColor(cIdx, uLight);

    vec3 nodeDark = mix(c * (0.52 + 0.95 * act), vec3(1.0, 0.99, 0.96), core * min(0.9, act * 0.72 + isHov * 0.6));
    colDark += (nodeDark * core * (0.55 + 1.1 * act + 0.7 * isHov) + c * (halo + ring)) * inCube;
    if (uLight > 0.5) {
      float na = min(0.96, (core * (0.48 + 0.52 * min(1.0, act) + 0.4 * isHov) + ring * 0.75 + halo * 0.28) * inCube);
      if (na > 0.008) {
        vec3 nCol = mix(c, vec3(0.97, 0.98, 1.0), core * smoothstep(0.6, 1.25, act) * 0.45);
        inkLight = over(vec4(nCol * na, na), inkLight);
      }
    }
  }

  // 7. 5 Unembedding Target Beacons + Sight-line to Top Token
  float bestP = -1.0;
  vec3 bestPos = uTokens[0].xyz;
  for (int i = 0; i < 5; i++) {
    vec3 tp = uTokens[i].xyz;
    float prob = uTokens[i].w;
    if (prob > bestP) { bestP = prob; bestPos = tp; }
    vec2 rp = rayPoint(p0, V, tp);
    float r = 2.8 + 2.5 * prob;
    float ring = exp(-pow((rp.x - r * 1.55) / (0.75 + 0.45 * px), 2.0)) * (0.35 + 0.85 * prob);
    float dotCore = 1.0 - smoothstep(r * 0.62 - 0.6 * px, r * 0.62 + 0.6 * px, rp.x);
    vec3 bCol = (uLight > 0.5) ? vec3(0.76, 0.22, 0.12) : vec3(1.0, 0.86, 0.48);
    colDark += bCol * (dotCore * (0.45 + 0.95 * prob) + ring * 0.9);
    if (uLight > 0.5) {
      float ba = min(0.92, dotCore * (0.42 + 0.56 * prob) + ring * 0.62);
      if (ba > 0.008) inkLight = over(vec4(bCol * ba, ba), inkLight);
    }
  }
  {
    vec3 rs = raySegment(p0, V, uCursor, bestPos);
    float dash = 0.45 + 0.55 * sin(rs.y * 34.0 - uTime * 3.4);
    float line = exp(-pow(rs.x / (0.65 + 0.45 * px), 2.0)) * (0.32 + 0.42 * bestP) * (0.55 + 0.45 * dash) * inCube;
    colDark += vec3(1.0, 0.88, 0.54) * line;
    if (uLight > 0.5 && line > 0.008) {
      float la = min(0.72, line * 0.88);
      inkLight = over(vec4(vec3(0.76, 0.22, 0.12) * la, la), inkLight);
    }
  }

  // 8. Focal Residual-Stream State Orb at x(l)
  {
    vec2 rp = rayPoint(p0, V, uCursor);
    float rOrb = 4.4 + 0.45 * sin(uTime * 2.8);
    float core = 1.0 - smoothstep(rOrb - 0.85 * px, rOrb + 0.85 * px, rp.x);
    float rim = exp(-pow((rp.x - rOrb * 1.75) / (0.95 + 0.5 * px), 2.0)) * 0.68;
    float bloom = exp(-pow(rp.x / 18.0, 2.0)) * 0.55;
    vec3 orbTint = mix(vec3(0.55, 0.88, 1.0), vec3(1.0, 0.70, 0.34), min(1.0, uSteerMag));

    colDark += (vec3(1.0, 0.99, 0.96) * core * 1.5 + orbTint * (rim + bloom)) * inCube;
    if (uLight > 0.5) {
      vec3 oInk = mix(vec3(0.08, 0.24, 0.64), vec3(0.82, 0.30, 0.08), min(1.0, uSteerMag));
      float oa = min(0.96, (core * 0.95 + rim * 0.62 + bloom * 0.20) * inCube);
      vec3 oSeen = mix(oInk, vec3(0.97, 0.98, 1.0), core * 0.55);
      inkLight = over(vec4(oSeen * oa, oa), inkLight);
    }
  }

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
    vec3 c = tonemap(colDark, 1.15) * uFirst;
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
      "uLight", "uFirst", "uLayer", "uSteerMag", "uHoverIdx", "uCursor",
      "uNodes", "uTraj", "uTokens", "uEdgeA", "uEdgeB",
    ],
    fixed: {},
  });
  if (layer) stage.setAttribute("data-gl", "");

  // SVG elements
  const carriageEl = stage.querySelector("[data-part='carriage']");
  const knobPtrEl = stage.querySelector("[data-part='knob-ptr']");
  const barEls = Array.from(stage.querySelectorAll("[data-bar]"));
  const barCapEls = Array.from(stage.querySelectorAll("[data-bar-cap]"));
  const labelsLayer = stage.querySelector("[data-labels]");

  // Telemetry HUD elements
  const hudPromptBtns = Array.from(document.querySelectorAll("[data-prompt-btn]"));
  const hudLayerSlider = document.querySelector("[data-layer-slider]");
  const hudLayerVal = document.querySelector("[data-layer-val]");
  const hudPlayBtn = document.querySelector("[data-play-btn]");
  const hudLabelsBtn = document.querySelector("[data-labels-btn]");
  const hudThemeBtn = document.querySelector("[data-theme-btn]");
  const hudPanelBtn = document.querySelector("[data-panel-toggle]");
  const hudPanel = document.querySelector(".hud-panel");
  const hudNote = document.querySelector("[data-stage-note]");
  const hudVecBars = Array.from(document.querySelectorAll("[data-vec-bar]"));
  const hudVecVals = Array.from(document.querySelectorAll("[data-vec-val]"));
  const hudFeatList = document.querySelector("[data-feat-list]");
  const hudTokenBars = Array.from(document.querySelectorAll("[data-tok-bar]"));
  const hudTokenPcts = Array.from(document.querySelectorAll("[data-tok-pct]"));
  const hudEntropy = document.querySelector("[data-entropy]");
  const hudSteerBadge = document.querySelector("[data-steer-badge]");

  // Interactive state
  let promptIdx = 0;
  let targetLayer = 4.2;
  const curLayer = { x: 4.2, v: 0 };
  const targetSteer = [0, 0, 0];
  const curSteer = [0, 0, 0];
  let tourActive = true;
  let showLabels = true;
  let hoverIdx = -1;
  let idleTimer = 0;
  let firstClock = 0;
  let clock = 0;
  let last = 0;
  let frame = 0;
  let visible = false;
  let dragging = null;

  const uNodesArr = new Float32Array(48 * 4);
  const uTrajArr = new Float32Array(7 * 4);
  const uTokensArr = new Float32Array(5 * 4);
  const uEdgeAArr = new Float32Array(16 * 4);
  const uEdgeBArr = new Float32Array(16 * 4);

  let dispTraj = Array.from({ length: 7 }, () => [CUBE_CX, CUBE_CY, CUBE_CZ]);
  let dispActs = new Array(48).fill(0);
  let dispProbs = new Array(5).fill(0.2);

  function setPrompt(idx) {
    promptIdx = ((idx % PROMPTS.length) + PROMPTS.length) % PROMPTS.length;
    targetSteer[0] = targetSteer[1] = targetSteer[2] = 0;
    updateKnob();
    hudPromptBtns.forEach((b, i) => b.classList.toggle("active", i === promptIdx));
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
      if (barCapEls[i]) barCapEls[i].setAttribute("d", ring(b.x, b.y, b.r, b.z0 + h, D.P, 20));
    }
  }

  // Projected 3D SVG semantic callout labels (top firing features + unembedding beacons + cursor + hover)
  function updateCallouts(cursorW, lens) {
    if (!labelsLayer) return;
    if (!showLabels) {
      labelsLayer.innerHTML = "";
      return;
    }
    const parts = [];
    const palette = isLight ? CLUSTER_HEX_LIGHT : CLUSTER_HEX_DARK;

    // 1. Unembedding target beacons on cube boundary
    for (let i = 0; i < TOKENS.length; i++) {
      const [vx, vy] = TOKEN_VB[i];
      const p = dispProbs[i];
      const isTop = i === lens.topIdx;
      const dx = vx > D.cube.vbCenter[0] ? 10 : -10;
      const anchor = dx > 0 ? "start" : "end";
      const op = (isTop ? 0.96 : 0.45 + 0.35 * p).toFixed(2);
      parts.push(
        `<g class="lc-tag ${isTop ? "lc-tag-top" : ""}" opacity="${op}">` +
        `<text x="${(vx + dx).toFixed(1)}" y="${(vy + 3).toFixed(1)}" text-anchor="${anchor}">${TOKENS[i].text} ${Math.round(p * 100)}%</text>` +
        `</g>`
      );
    }

    // 2. Top 4 firing SAE features (plus hovered node if any)
    const ranked = FEATURES.map((f, i) => ({ f, i, a: dispActs[i] }))
      .sort((a, b) => b.a - a.a)
      .slice(0, 4)
      .filter((x) => x.a > 0.32);

    if (hoverIdx >= 0 && !ranked.some((r) => r.i === hoverIdx)) {
      ranked.unshift({ f: FEATURES[hoverIdx], i: hoverIdx, a: dispActs[hoverIdx], hovered: true });
    }

    const usedY = TOKEN_VB.map((pt) => pt[1]);
    for (const item of ranked) {
      const [vx, vy] = NODE_VB[item.i];
      let ly = vy - 18;
      for (const uy of usedY) if (Math.abs(ly - uy) < 16) ly = uy - 16;
      usedY.push(ly);
      const side = vx >= D.cube.vbCenter[0] ? 1 : -1;
      const lx = vx + side * 16;
      const anchor = side > 0 ? "start" : "end";
      const col = palette[item.f.cluster];
      parts.push(
        `<g class="lc-feat-tag ${item.hovered ? "is-hov" : ""}">` +
        `<path d="M${vx.toFixed(1)},${vy.toFixed(1)} L${(lx - side * 3).toFixed(1)},${(ly - 2).toFixed(1)}" stroke="${col}" stroke-width="0.7" opacity="0.65"/>` +
        `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${anchor}" fill="${col}">F${String(item.i).padStart(2, "0")} ${item.f.name}</text>` +
        `</g>`
      );
    }

    // 3. Current residual-stream cursor tag x(L) placed cleanly to the left of the orb
    const [cx, cy] = iso(cursorW, D.P);
    parts.push(
      `<g class="lc-cursor-tag">` +
      `<text x="${(cx - 12).toFixed(1)}" y="${(cy - 10).toFixed(1)}" text-anchor="end">x(L${curLayer.x.toFixed(1)})</text>` +
      `</g>`
    );

    labelsLayer.innerHTML = parts.join("");
  }

  // Update telemetry HUD
  let lastHudTime = 0;
  function updateHud(now, lens, steerMag) {
    if (now - lastHudTime < 45) return; // ~22 Hz DOM updates for silky 60fps WebGL
    lastHudTime = now;

    if (hudLayerSlider && document.activeElement !== hudLayerSlider) {
      hudLayerSlider.value = curLayer.x.toFixed(2);
    }
    if (hudLayerVal) hudLayerVal.textContent = `L${curLayer.x.toFixed(1)} / 6.0`;
    if (hudNote) hudNote.textContent = lens.note;
    if (hudEntropy) hudEntropy.textContent = `${lens.entropy.toFixed(2)} bits`;
    if (hudSteerBadge) {
      hudSteerBadge.textContent = steerMag > 0.05 ? `STEER Δ ${steerMag.toFixed(2)}` : "UNSTEERED";
      hudSteerBadge.classList.toggle("active", steerMag > 0.05);
    }
    if (hudPlayBtn) hudPlayBtn.textContent = tourActive ? "Pause" : "Play";

    // 8-D residual stream bars
    for (let d = 0; d < 8; d++) {
      const v = lens.vec8[d];
      const bar = hudVecBars[d];
      if (bar) {
        const pct = Math.min(50, Math.abs(v) * 62);
        bar.style.left = v >= 0 ? "50%" : `${50 - pct}%`;
        bar.style.width = `${pct}%`;
        bar.classList.toggle("neg", v < 0);
      }
      if (hudVecVals[d]) hudVecVals[d].textContent = (v >= 0 ? "+" : "") + v.toFixed(2);
    }

    // Top 5 firing SAE features
    if (hudFeatList) {
      const palette = isLight ? CLUSTER_HEX_LIGHT : CLUSTER_HEX_DARK;
      const top5 = FEATURES.map((f, i) => ({ f, i, a: dispActs[i] }))
        .sort((a, b) => b.a - a.a)
        .slice(0, 5);
      hudFeatList.innerHTML = top5
        .map(({ f, i, a }) => {
          const w = Math.min(100, (a / 1.4) * 100);
          return `<div class="hud-feat-row">
            <span class="hud-dot" style="background:${palette[f.cluster]}"></span>
            <span class="hud-feat-name">F${String(i).padStart(2, "0")} ${f.name}</span>
            <span class="hud-feat-bar"><i style="width:${w.toFixed(0)}%;background:${palette[f.cluster]}"></i></span>
            <span class="hud-feat-num">${a.toFixed(2)}</span>
          </div>`;
        })
        .join("");
    }

    // Logit Lens probabilities
    for (let i = 0; i < TOKENS.length; i++) {
      const p = dispProbs[i];
      if (hudTokenBars[i]) {
        hudTokenBars[i].style.width = `${(p * 100).toFixed(1)}%`;
        hudTokenBars[i].classList.toggle("top", i === lens.topIdx);
      }
      if (hudTokenPcts[i]) hudTokenPcts[i].textContent = `${Math.round(p * 100)}%`;
    }
  }

  // --- HUD & Pointer Interactions ---
  hudPromptBtns.forEach((btn, i) => {
    btn.addEventListener("click", () => {
      tourActive = false; idleTimer = 0;
      setPrompt(i);
    });
  });

  if (hudLayerSlider) {
    hudLayerSlider.addEventListener("input", (e) => {
      tourActive = false; idleTimer = 0;
      targetLayer = parseFloat(e.target.value);
      run();
    });
  }

  if (hudPlayBtn) {
    hudPlayBtn.addEventListener("click", () => {
      tourActive = !tourActive; idleTimer = 0;
      hudPlayBtn.textContent = tourActive ? "Pause" : "Play";
      run();
    });
  }

  if (hudLabelsBtn) {
    hudLabelsBtn.addEventListener("click", () => {
      showLabels = !showLabels;
      hudLabelsBtn.classList.toggle("active", showLabels);
      run();
    });
  }

  if (hudThemeBtn) {
    hudThemeBtn.addEventListener("click", () => {
      isLight = isLight ? 0 : 1;
      document.body.dataset.theme = isLight ? "light" : "dark";
      hudThemeBtn.textContent = isLight ? "Dark" : "Light";
      run();
    });
  }

  if (hudPanelBtn && hudPanel) {
    hudPanelBtn.addEventListener("click", () => {
      const collapsed = hudPanel.classList.toggle("collapsed");
      hudPanelBtn.textContent = collapsed ? "Inspector" : "Hide";
    });
  }

  function viewPointFromEvent(e) {
    const svg = stage.querySelector("svg");
    const rect = svg.getBoundingClientRect();
    // Respect preserveAspectRatio="xMidYMid meet"
    const scale = Math.min(rect.width / D.W, rect.height / D.H);
    const ox = rect.left + (rect.width - D.W * scale) / 2;
    const oy = rect.top + (rect.height - D.H * scale) / 2;
    return [(e.clientX - ox) / scale, (e.clientY - oy) / scale];
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
    const sx = Math.max(-1, Math.min(1, (vx - D.cube.vbCenter[0]) / 160));
    const sy = Math.max(-1, Math.min(1, -(vy - D.cube.vbCenter[1]) / 160));
    targetSteer[0] = sx * 0.95;
    targetSteer[1] = -sx * 0.45 + sy * 0.45;
    targetSteer[2] = sy * 0.95;
    run();
  }

  stage.addEventListener("pointermove", (e) => {
    if (dragging === "rail") { handleRailDrag(e); return; }
    if (dragging === "cube") { handleCubeDrag(e); return; }
    // Hover detection on 48 SAE feature nodes
    const [vx, vy] = viewPointFromEvent(e);
    let best = -1, bestD = 16;
    for (let i = 0; i < NODE_VB.length; i++) {
      const d = Math.hypot(vx - NODE_VB[i][0], vy - NODE_VB[i][1]);
      if (d < bestD) { bestD = d; best = i; }
    }
    if (best !== hoverIdx) {
      hoverIdx = best;
      run();
    }
  });

  stage.addEventListener("pointerleave", () => {
    if (hoverIdx !== -1) { hoverIdx = -1; run(); }
  });

  stage.addEventListener("pointerup", () => {
    if (dragging === "cube") {
      targetSteer[0] *= 0.65;
      targetSteer[1] *= 0.65;
      targetSteer[2] *= 0.65;
    }
    dragging = null;
  });

  stage.addEventListener("dblclick", () => {
    targetSteer[0] = targetSteer[1] = targetSteer[2] = 0;
    run();
  });

  window.addEventListener("keydown", (e) => {
    if (e.target && e.target.tagName === "INPUT") return;
    if (e.key === "ArrowRight") {
      tourActive = false; idleTimer = 0;
      targetLayer = Math.min(N_LAYERS, targetLayer + 0.4);
      e.preventDefault(); run();
    } else if (e.key === "ArrowLeft") {
      tourActive = false; idleTimer = 0;
      targetLayer = Math.max(0, targetLayer - 0.4);
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

  updateKnob();
  hudPromptBtns.forEach((b, i) => b.classList.toggle("active", i === 0));
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

    if (!calm) {
      if (!tourActive && !dragging) {
        idleTimer += dt;
        if (idleTimer > 18) tourActive = true;
      }
      if (tourActive && !dragging) {
        targetLayer += dt * 0.48;
        if (targetLayer > N_LAYERS + 1.6) {
          targetLayer = 0.0;
          promptIdx = (promptIdx + 1) % PROMPTS.length;
          targetSteer[0] = targetSteer[1] = targetSteer[2] = 0;
          updateKnob();
          hudPromptBtns.forEach((b, i) => b.classList.toggle("active", i === promptIdx));
        }
      }
    }

    const clampedTargetL = Math.max(0, Math.min(N_LAYERS, targetLayer));
    settle(curLayer, clampedTargetL, dt, 0.24, calm);

    const kFollow = calm ? 1 : 1 - Math.exp(-dt * 8.5);
    for (let i = 0; i < 3; i++) curSteer[i] += (targetSteer[i] - curSteer[i]) * kFollow;
    const steerMag = Math.hypot(curSteer[0], curSteer[1], curSteer[2]);
    const steer8 = steerMag > 0.01 ? unprojectSteer(curSteer) : null;

    const runRes = forward(promptIdx, steer8);
    const lens = logitLens(runRes, curLayer.x);

    const targetTraj = runRes.states.map((s) => toWorld(project3(s)));
    for (let i = 0; i < 7; i++) {
      for (let c = 0; c < 3; c++) dispTraj[i][c] += (targetTraj[i][c] - dispTraj[i][c]) * kFollow;
    }
    for (let i = 0; i < 48; i++) dispActs[i] += (lens.acts[i] - dispActs[i]) * kFollow;
    for (let i = 0; i < 5; i++) dispProbs[i] += (lens.probs[i] - dispProbs[i]) * kFollow;

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

    for (let i = 0; i < 48; i++) {
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

    const scoredEdges = CIRCUIT_EDGES.map(([a, b, w]) => ({
      a, b,
      s: Math.sqrt(Math.max(0, dispActs[a]) * Math.max(0, dispActs[b])) * w,
      cluster: FEATURES[b].cluster,
    })).sort((x, y) => y.s - x.s);

    for (let i = 0; i < 16; i++) {
      const e = scoredEdges[i];
      const pa = NODE_W[e.a], pb = NODE_W[e.b];
      uEdgeAArr[i * 4 + 0] = pa[0];
      uEdgeAArr[i * 4 + 1] = pa[1];
      uEdgeAArr[i * 4 + 2] = pa[2];
      uEdgeAArr[i * 4 + 3] = Math.min(1.25, e.s * 1.2);
      uEdgeBArr[i * 4 + 0] = pb[0];
      uEdgeBArr[i * 4 + 1] = pb[1];
      uEdgeBArr[i * 4 + 2] = pb[2];
      uEdgeBArr[i * 4 + 3] = e.cluster;
    }

    const firstEnv = calm ? 1 : 0.45 + 0.55 * smooth(0, 1, firstClock / 0.35);
    if (layer) {
      layer.draw(
        {
          uLight: isLight,
          uFirst: firstEnv,
          uLayer: curLayer.x,
          uSteerMag: steerMag,
          uHoverIdx: hoverIdx,
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

    updateCarriage(curLayer.x);
    updateBars(dispProbs, lens.topIdx);
    updateCallouts(cursorW, lens);
    updateHud(now, lens, steerMag);

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

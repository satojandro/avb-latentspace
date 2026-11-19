// Personal Latent Space Model — Nonlinear Career & Lived Experience
// 5 Chronological Chapters (1989 -> Today) deconstructed into 42 atomic events & mental models
// organized organically across 4 emergent latent clusters in R^8 -> PCA 3D,
// with cross-era retroactive bridges, 4 synthesis lenses, and 1,600 time-accumulating background stars.

export const D_MODEL = 8;
export const N_CHAPTERS = 5;

export function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}
export function norm(a) {
  return Math.sqrt(dot(a, a)) || 1e-8;
}
export function unit(a) {
  const n = norm(a);
  return a.map((v) => v / n);
}
export function add(a, b, scale = 1) {
  return a.map((v, i) => v + b[i] * scale);
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 4 Emergent Latent Clusters (conceptual dimensions, NOT chronological silos)
export const CLUSTERS = [
  {
    id: "systems",
    name: "Systems & Sovereignty",
    desc: "Institutional fragility, rule of law, sound money, and trustless code.",
    center: unit([1.0, 0.12, 0.2, -0.1, 0.35, 0.0, -0.1, 0.0]),
  },
  {
    id: "agency",
    name: "Agency & Exit",
    desc: "Self-reliance, bypassing gatekeepers, anti-complacency, and contrarian conviction.",
    center: unit([0.1, 1.0, -0.12, 0.18, 0.0, 0.38, 0.0, -0.1]),
  },
  {
    id: "craft",
    name: "Frontier Tech & Craft",
    desc: "Engineering proximity, UX taste, signal over hype, and AI-powered building.",
    center: unit([-0.15, 0.1, 1.0, 0.15, 0.0, 0.0, 0.4, 0.12]),
  },
  {
    id: "narrative",
    name: "Narrative & Bridges",
    desc: "Bicultural fluency, history & politics, community building, and translating worlds.",
    center: unit([0.18, -0.12, 0.12, 1.0, -0.15, 0.0, 0.0, 0.42]),
  },
];

// 5 Chronological Chapters (Timeline 4th Dimension: 0.0 -> 5.0)
export const CHAPTERS = [
  {
    id: "venezuela",
    num: 1,
    years: "1989 – 2008",
    title: "Venezuela",
    subtitle: "Prosperity, institutional collapse & the instinct to exit",
    summary:
      "Born the year the Berlin Wall fell into a prosperous, oil-rich middle-class home. Bilingual early at an American school with an engineer father — then watching socialism, street protests, and institutional decay unfold in slow motion until leaving solo in 2008.",
    echoNote: "Origin layer: plants the foundational priors — institutional skepticism, bicultural fluency, and engineering proximity.",
    anchorIds: [0, 1, 2, 3, 4, 5, 6, 7],
  },
  {
    id: "australia",
    num: 2,
    years: "2008 – 2014",
    title: "Australia · Arts & Law",
    subtitle: "Solo arrival, systems that work & friction with complacency",
    summary:
      "Landed in Australia alone and studied Politics, International Studies, History, and Law at Monash. Studying a functional legal system sharpened a structural worldview — while debating comfortable idealists hardened a freedom-first, high-ambition stance.",
    echoNote: "Echoes Ch. 1: lived collapse in Venezuela collides directly with Monash legal theory and campus ideology.",
    anchorIds: [8, 9, 10, 11, 12, 13, 14, 15],
  },
  {
    id: "law",
    num: 3,
    years: "2015 – 2017",
    title: "Crypto Law · The Pivot",
    subtitle: "Skipping the script, cold-emailing the #1 partner & pragmatic exit",
    summary:
      "Bypassed every graduate recruitment pipeline and emailed Australia's top crypto law partner directly. Earned admission as a lawyer in Sydney — and stepped out the moment the credential was complete to move straight into technology.",
    echoNote: "Echoes Ch. 1 & 2: the same exit instinct that left Venezuela now refuses a conventional legal track.",
    anchorIds: [16, 17, 18, 19, 20, 21],
  },
  {
    id: "crypto",
    num: 4,
    years: "2013 – 2023",
    title: "Crypto & NEAR Ecosystem",
    subtitle: "Cypherpunk conviction, non-technical leadership & latent builder tension",
    summary:
      "Bitcoin clicked instantly in 2013 through the lens of Venezuelan hyperinflation. From Melbourne Blockchain Centre to becoming a recognized voice in the early NEAR ecosystem across BD, governance, content, and community — surrounded by engineers, full of ideas, always one step from shipping them solo.",
    echoNote: "Strong retroactive echoes: Ch. 1 hyperinflation + Ch. 2 rule-of-law fuse into cypherpunk trustless code.",
    anchorIds: [22, 23, 24, 25, 26, 27, 28, 29, 30, 31],
  },
  {
    id: "ai",
    num: 5,
    years: "2023 – Today",
    title: "AI Builder Mode",
    subtitle: "Removing the last middleman — vibe coding, hackathons & sovereign shipping",
    summary:
      "The moment AI arrived, taught himself to code among the earliest wave of vibe coders. Peak curiosity testing every new model and tool, winning hackathons, and shipping increasingly ambitious projects — finally turning a decade of latent product ideas into real software.",
    echoNote: "Full-cube synthesis: Ch. 1 engineering proximity + Ch. 3 high agency + Ch. 4 coiled ideas ignite into sovereign execution.",
    anchorIds: [32, 33, 34, 35, 36, 37, 38, 39, 40, 41],
  },
];

// 42 Deconstructed Nodes (events + underlying atomic features/mental models)
// Each node has a primary cluster + optional secondary cluster pull in R^8 so bridges sit naturally in space.
const RAW_NODES = [
  // --- Chapter 1: Venezuela (0..7) ---
  {
    name: "Born 1989 · Berlin Wall",
    chapter: 0, year: "1989", cluster: 3, mix: [0, 0.3], kind: "anchor",
    story: "Born the year the Berlin Wall fell — an early fascination with geopolitical inflection points and how regimes rise and collapse.",
  },
  {
    name: "Oil-rich prosperity",
    chapter: 0, year: "1990s", cluster: 0, mix: [3, 0.2], kind: "feature",
    story: "Grew up in a solid middle-class Venezuela before the decline — knowing firsthand that abundance is never guaranteed.",
  },
  {
    name: "Engineer dad · multinationals",
    chapter: 0, year: "1990s", cluster: 2, mix: [1, 0.25], kind: "feature",
    story: "A father working as an engineer for multinational companies and a mother at a private hospital normalized technical competence and global horizons.",
  },
  {
    name: "American school · bilingual",
    chapter: 0, year: "1995", cluster: 3, mix: [1, 0.3], kind: "anchor",
    story: "Attending an American private school and becoming bilingual early wired in cross-cultural fluency and an affinity for freedom-oriented values.",
  },
  {
    name: "Rise of Chávez · opposition",
    chapter: 0, year: "1999", cluster: 0, mix: [1, 0.2], kind: "anchor",
    story: "Family and circles were opposition from day one — building an early radar for ideological capture and broken incentives.",
  },
  {
    name: "Slow-motion warning signs",
    chapter: 0, year: "2002–07", cluster: 0, mix: [3, 0.25], kind: "feature",
    story: "The visceral frustration of watching every warning come true in slow motion — sharpening pattern recognition for systemic decay.",
  },
  {
    name: "Street protests & collapse",
    chapter: 0, year: "2006–08", cluster: 0, mix: [1, 0.3], kind: "feature",
    story: "Violence, rising crime, and eroding living standards proved that legal rights mean nothing when institutions fail.",
  },
  {
    name: "Leaving Venezuela (2008)",
    chapter: 0, year: "2008", cluster: 1, mix: [0, 0.3], kind: "anchor",
    story: "Right after high school, made the defining call of a generation: exit a broken system to build a future elsewhere.",
  },

  // --- Chapter 2: Australia + BA/LLM (8..15) ---
  {
    name: "Solo arrival in Australia",
    chapter: 1, year: "2008", cluster: 1, mix: [3, 0.25], kind: "anchor",
    story: "Arriving in a new country completely alone forged deep self-reliance and comfort operating without a safety net.",
  },
  {
    name: "Politics, History & IR",
    chapter: 1, year: "2009–12", cluster: 3, mix: [0, 0.35], kind: "feature",
    story: "Studying Politics, International Studies, and History at Monash gave formal language to the geopolitical forces lived firsthand.",
  },
  {
    name: "Monash Law · working systems",
    chapter: 1, year: "2009–14", cluster: 0, mix: [3, 0.2], kind: "anchor",
    story: "Genuine fascination with studying a legal and institutional system that actually works — contrasting sharply with Venezuela.",
  },
  {
    name: "Lived reality vs. ideology",
    chapter: 1, year: "2010–13", cluster: 1, mix: [0, 0.35], kind: "feature",
    story: "Confronted on campus by comfortable idealists romanticizing the exact regime just escaped — cementing intellectual independence.",
  },
  {
    name: "American freedom ethos",
    chapter: 1, year: "2011", cluster: 1, mix: [3, 0.3], kind: "feature",
    story: "Clear cultural alignment with individual liberty, merit, and building without asking permission.",
  },
  {
    name: "Anti-tall-poppy ambition",
    chapter: 1, year: "2012", cluster: 1, mix: [2, 0.25], kind: "feature",
    story: "Pushing back against 'comfortable' complacency and tall poppy syndrome — refusing to shrink ambition to fit in.",
  },
  {
    name: "Structural literacy",
    chapter: 1, year: "2013", cluster: 0, mix: [2, 0.2], kind: "feature",
    story: "Learning to read contracts, incentives, and governance rules as executable architectures rather than mere words.",
  },
  {
    name: "Contrarian conviction",
    chapter: 1, year: "2014", cluster: 1, mix: [0, 0.25], kind: "feature",
    story: "Willingness to hold an unpopular view early when first-principles reality disagrees with the consensus crowd.",
  },

  // --- Chapter 3: Law Stint -> Tech Transition (16..21) ---
  {
    name: "Bypassing grad programs",
    chapter: 2, year: "2015", cluster: 1, mix: [2, 0.2], kind: "feature",
    story: "Never applied to a single traditional graduate recruitment track — rejecting bureaucratic funnels from the start.",
  },
  {
    name: "Cold-emailing #1 crypto partner",
    chapter: 2, year: "2015", cluster: 1, mix: [0, 0.3], kind: "anchor",
    story: "Emailed directly the one partner in Australia who was the best in crypto law — and won a seat through genuine early conviction.",
  },
  {
    name: "Sydney law grad stint",
    chapter: 2, year: "2016", cluster: 0, mix: [3, 0.25], kind: "anchor",
    story: "Brief, focused stint at a Sydney firm seeing legal practice from the inside while mapping where code would outpace courts.",
  },
  {
    name: "Admitted as a lawyer",
    chapter: 2, year: "2017", cluster: 0, mix: [1, 0.2], kind: "anchor",
    story: "Crossed the finish line to legal admission — proving mastery of the traditional system before choosing to step beyond it.",
  },
  {
    name: "Pragmatic exit to tech",
    chapter: 2, year: "2017", cluster: 1, mix: [2, 0.35], kind: "anchor",
    story: "Left legal practice the moment the experience was banked — treating credentials as launchpads, never cages.",
  },
  {
    name: "Direct access instinct",
    chapter: 2, year: "2016", cluster: 3, mix: [1, 0.35], kind: "feature",
    story: "Reaching straight to the most interesting builders and decision-makers — a habit that later powered ecosystem BD.",
  },

  // --- Chapter 4: Crypto & NEAR Ecosystem (22..31) ---
  {
    name: "Bitcoin clicks instantly (2013)",
    chapter: 3, year: "2013", cluster: 0, mix: [2, 0.35], kind: "anchor",
    story: "First heard of Bitcoin in 2013 and understood it immediately — hyperinflation in Venezuela made sound, borderless money self-evident.",
  },
  {
    name: "Melbourne Blockchain Centre",
    chapter: 3, year: "2015–16", cluster: 3, mix: [2, 0.3], kind: "anchor",
    story: "Immersed in Melbourne's early crypto meetups, finding a tribe of builders and cypherpunks before the mainstream arrived.",
  },
  {
    name: "Cypherpunk · remove middlemen",
    chapter: 3, year: "2016", cluster: 0, mix: [1, 0.25], kind: "feature",
    story: "Core ethos: replace brittle intermediaries and failed legal systems with immutable code that lets strangers trust each other.",
  },
  {
    name: "Cycle immunity · ICO/NFT/Memes",
    chapter: 3, year: "2017–22", cluster: 0, mix: [2, 0.25], kind: "feature",
    story: "Watched every speculative wave rise and crash without losing sight of real technology — filtering signal from hype.",
  },
  {
    name: "Early NEAR Protocol",
    chapter: 3, year: "2020", cluster: 2, mix: [0, 0.25], kind: "anchor",
    story: "Drawn to NEAR for real engineering ('Ethereum 2.0 delivered') and a rare obsession with consumer-grade UI/UX.",
  },
  {
    name: "UI/UX & tech taste",
    chapter: 3, year: "2020–22", cluster: 2, mix: [3, 0.3], kind: "feature",
    story: "Sharpened an instinct for why great infrastructure still fails without intuitive, human-centered interfaces.",
  },
  {
    name: "BD, Content & Governance",
    chapter: 3, year: "2020–23", cluster: 3, mix: [0, 0.3], kind: "anchor",
    story: "Wore every non-technical hat — business development, marketing content, protocol governance, and community architecture.",
  },
  {
    name: "Recognized ecosystem voice",
    chapter: 3, year: "2021–23", cluster: 3, mix: [1, 0.25], kind: "feature",
    story: "Became widely known across the NEAR ecosystem by bridging technical teams, governance, and narrative.",
  },
  {
    name: "Surrounded by engineers",
    chapter: 3, year: "2020–23", cluster: 2, mix: [3, 0.25], kind: "feature",
    story: "Absorbed systems thinking, architecture tradeoffs, and product intuition by working side-by-side with top engineers for years.",
  },
  {
    name: "Latent builder tension",
    chapter: 3, year: "2022–23", cluster: 2, mix: [1, 0.35], kind: "feature",
    story: "Overflowing with product ideas yet always one step short of building them solo — a coiled spring waiting for leverage.",
  },

  // --- Chapter 5: AI Builder Mode (32..41) ---
  {
    name: "Self-taught coding with AI",
    chapter: 4, year: "2023", cluster: 2, mix: [1, 0.3], kind: "anchor",
    story: "The moment AI arrived, jumped straight in and taught himself to code — closing the final gap between idea and execution.",
  },
  {
    name: "First-gen 'vibe coder'",
    chapter: 4, year: "2023–24", cluster: 2, mix: [1, 0.25], kind: "anchor",
    story: "Among the earliest generation building software fluidly in partnership with LLMs — turning taste and clarity into working code.",
  },
  {
    name: "Removing the last middleman",
    chapter: 4, year: "2024", cluster: 0, mix: [2, 0.45], kind: "feature",
    story: "The cypherpunk arc completed: first code removed institutional middlemen, now AI removes the execution middleman.",
  },
  {
    name: "Peak frontier curiosity",
    chapter: 4, year: "2024–25", cluster: 2, mix: [3, 0.2], kind: "feature",
    story: "Proactively testing every new model, agent, and developer tool the day it drops — staying right at the leading edge.",
  },
  {
    name: "Hackathon wins",
    chapter: 4, year: "2024–25", cluster: 1, mix: [2, 0.45], kind: "anchor",
    story: "Turning rapid prototypes into winning hackathon submissions — validating builder instincts under real time pressure.",
  },
  {
    name: "Ambitious side projects",
    chapter: 4, year: "2025–26", cluster: 2, mix: [3, 0.25], kind: "anchor",
    story: "A growing portfolio of increasingly deep, technically ambitious projects — including visualizing the very mind behind them.",
  },
  {
    name: "Full-stack synthesis",
    chapter: 4, year: "2025–26", cluster: 3, mix: [2, 0.4], kind: "feature",
    story: "Law, geopolitics, crypto governance, UX taste, and AI engineering finally converging into a single sovereign builder stack.",
  },
  {
    name: "Rapid taste-to-ship loop",
    chapter: 4, year: "2025", cluster: 2, mix: [1, 0.3], kind: "feature",
    story: "Years of non-technical product judgment now pay compounding dividends when paired with instant AI implementation.",
  },
  {
    name: "Sovereign builder identity",
    chapter: 4, year: "Today", cluster: 1, mix: [2, 0.35], kind: "anchor",
    story: "No longer waiting on institutions, grad tracks, or someone else to build — full agency from raw insight to shipped artifact.",
  },
  {
    name: "Nonlinear edge",
    chapter: 4, year: "Today", cluster: 3, mix: [0, 0.35], kind: "feature",
    story: "What looked like disconnected chapters on paper turned out to be a rare, uncopyable latent space of connected priors.",
  },
];

// Generate deterministic R^8 coordinates anchored to each node's primary + secondary cluster
const rng = mulberry32(198908);
export const NODES = RAW_NODES.map((n, i) => {
  const base = CLUSTERS[n.cluster].center;
  const sec = n.mix ? CLUSTERS[n.mix[0]].center : base;
  const mixW = n.mix ? n.mix[1] : 0;
  let v = add(base, sec, mixW);
  const jitter = Array.from({ length: D_MODEL }, () => (rng() - 0.5) * 0.54);
  v = unit(add(v, jitter, 1));
  // Spread bornAt smoothly within each chapter [chapter + 0.08, chapter + 0.92]
  const chapNodes = RAW_NODES.filter((x) => x.chapter === n.chapter);
  const idxInChap = chapNodes.indexOf(n);
  const bornAt = n.chapter + 0.08 + (idxInChap / Math.max(1, chapNodes.length - 1)) * 0.84;
  return { id: i, ...n, bornAt, dir: v };
});

export const N_NODES = NODES.length;

// Meaningful Connections: [fromId, toId, strength, isCrossEraBridge, note]
export const EDGES = [
  // Intra-chapter & immediate narrative links
  [0, 4, 0.8, false, "Geopolitical awareness meets Chávez's rise"],
  [1, 5, 0.85, false, "Knowing prosperity makes decay unmistakable"],
  [4, 5, 0.95, false, "Opposition clarity watching warnings come true"],
  [5, 6, 0.95, false, "Slow warnings erupt into street collapse"],
  [6, 7, 1.0, false, "Institutional breakdown forces the 2008 exit"],
  [7, 8, 1.0, true, "Leaving Venezuela → arriving solo in Australia"],
  [8, 13, 0.85, false, "Solo self-reliance rejects comfortable complacency"],
  [9, 10, 0.9, false, "Politics & History paired with Monash Law"],
  [10, 14, 0.95, false, "Studying working law builds structural literacy"],
  [11, 15, 0.9, false, "Campus ideology friction forges contrarian conviction"],
  [12, 13, 0.9, false, "American freedom ethos rejects tall poppy syndrome"],
  [16, 17, 0.98, false, "Skipping grad tracks → cold-emailing the #1 partner"],
  [17, 18, 0.95, false, "Direct outreach lands the Sydney crypto law seat"],
  [18, 19, 0.9, false, "Practice completed → admitted as a lawyer"],
  [19, 20, 0.95, false, "Credential earned → pragmatic exit into tech"],
  [22, 23, 0.92, false, "Early Bitcoin conviction → Melbourne Blockchain Centre"],
  [23, 24, 0.95, false, "Community meetups deepen cypherpunk ethos"],
  [24, 25, 0.85, false, "Cypherpunk principles filter out hype cycles"],
  [25, 26, 0.9, false, "Tech-first filter leads straight to early NEAR"],
  [26, 27, 0.95, false, "NEAR's consumer focus sharpens UI/UX taste"],
  [26, 28, 0.95, false, "Leading BD, content, governance & community"],
  [28, 29, 0.92, false, "Cross-functional work builds ecosystem recognition"],
  [26, 30, 0.88, false, "Working closely alongside protocol engineers"],
  [30, 31, 0.98, false, "Engineering proximity + ideas = coiled builder tension"],
  [32, 33, 0.98, false, "Self-taught AI coding → first-gen vibe coder"],
  [33, 35, 0.92, false, "Vibe coding fueled by testing every new model"],
  [35, 36, 0.95, false, "Frontier tool fluency powers hackathon wins"],
  [36, 37, 0.98, false, "Hackathon momentum → ambitious side projects"],
  [37, 40, 0.96, false, "Shipping real products → sovereign builder identity"],
  [38, 41, 0.95, false, "All worlds converging into a nonlinear edge"],

  // *** NON-OBVIOUS LONG-RANGE CROSS-ERA BRIDGES (The Heart of the Latent Space!) ***
  [5, 22, 1.0, true, "Venezuelan hyperinflation made Bitcoin click immediately in 2013"],
  [6, 24, 1.0, true, "Failed legal systems in Venezuela → immutable code replacing middlemen"],
  [10, 24, 0.92, true, "Monash rule-of-law study → understanding code as enforceable trust"],
  [14, 28, 0.88, true, "Legal structural literacy → crypto protocol governance design"],
  [3, 12, 0.92, true, "American school in Venezuela → cultural alignment with freedom & ambition"],
  [3, 29, 0.85, true, "Early bicultural fluency → translating across global crypto communities"],
  [7, 20, 0.9, true, "Exiting Venezuela in 2008 → exiting traditional law once admitted"],
  [11, 25, 0.86, true, "Resisting campus dogma → resisting ICO/NFT/memecoin hype cycles"],
  [13, 16, 0.92, true, "Rejecting complacency → bypassing every traditional grad program"],
  [17, 21, 0.9, true, "Cold-emailing the #1 partner → direct-access habit in crypto BD"],
  [21, 28, 0.86, true, "Direct-access instinct → high-leverage ecosystem business development"],
  [2, 30, 0.85, true, "Engineer dad at multinationals → effortless rapport with engineers"],
  [2, 32, 0.88, true, "Childhood engineering proximity → finally stepping into code with AI"],
  [31, 32, 1.0, true, "Years of coiled product ideas → explosive AI self-teaching in 2023"],
  [24, 34, 1.0, true, "Cypherpunk 'remove middlemen' → AI removes the last execution middleman"],
  [27, 39, 0.95, true, "NEAR UI/UX taste → rapid taste-to-ship loop in AI builder mode"],
  [13, 36, 0.9, true, "High-agency ambition → competing and winning in AI hackathons"],
  [15, 33, 0.86, true, "Contrarian early adoption → first-generation vibe coder"],
  [9, 38, 0.84, true, "History & Politics lens → synthesizing culture, law, and technology"],
  [20, 40, 0.92, true, "Pragmatic exit from law → sovereign builder identity today"],
  [29, 41, 0.88, true, "Cross-functional ecosystem voice → compounding nonlinear edge"],
];

// 4 Synthesis Lenses (Prompt Mode — cross-era constellations firing all at once)
export const LENSES = [
  {
    id: "crypto-click",
    title: "Why did crypto click instantly?",
    subtitle: "From Venezuelan hyperinflation to trustless code",
    summary:
      "Bitcoin didn't arrive as an abstract whitepaper — it landed on top of lived hyperinflation, institutional collapse, and a Monash law degree. Immutable code became the logical answer to systems that fail their citizens.",
    nodes: [4, 5, 6, 10, 14, 17, 22, 23, 24, 25, 26, 34],
    path: [5, 6, 10, 22, 24, 26, 34],
  },
  {
    id: "builder-arc",
    title: "How did a lawyer become an AI builder?",
    subtitle: "Removing the final middleman between taste and code",
    summary:
      "Growing up with an engineer father, spending years beside NEAR engineers, and holding sharp UI/UX taste coiled a decade of ideas. When AI arrived, vibe coding removed the last bottleneck — turning latent vision into hackathon wins and shipped software.",
    nodes: [2, 20, 26, 27, 30, 31, 32, 33, 34, 35, 36, 37, 39, 40],
    path: [2, 20, 27, 30, 31, 32, 33, 36, 37, 40],
  },
  {
    id: "agency-exit",
    title: "What drives the refusal to settle?",
    subtitle: "High agency, bypassing gatekeepers & sovereign exits",
    summary:
      "Leaving Venezuela solo at 18, rejecting comfortable complacency in Australia, cold-emailing the #1 crypto law partner instead of applying to grad programs, and leaving law the moment admission cleared — one consistent instinct for agency.",
    nodes: [3, 7, 8, 11, 12, 13, 15, 16, 17, 20, 21, 36, 40],
    path: [7, 8, 13, 16, 17, 20, 40],
  },
  {
    id: "full-synthesis",
    title: "How do all 5 chapters connect today?",
    subtitle: "The compounding edge of a nonlinear mind",
    summary:
      "On paper: Caracas → Melbourne Law → Crypto BD → AI Builder. In latent space: one continuous trajectory of bicultural fluency, institutional literacy, cypherpunk sovereignty, and frontier craft compounding into a rare builder stack.",
    nodes: [0, 3, 7, 10, 13, 17, 22, 24, 27, 28, 31, 32, 34, 37, 38, 40, 41],
    path: [3, 7, 10, 17, 22, 28, 31, 32, 38, 41],
  },
];

// =========================================================================
// REAL 3D PCA PROJECTION (R^8 -> [-0.94, 0.94]^3)
// =========================================================================
function computePCA3() {
  const samples = NODES.map((n) => n.dir);
  const mean = new Array(D_MODEL).fill(0);
  for (const s of samples) for (let d = 0; d < D_MODEL; d++) mean[d] += s[d] / samples.length;

  const cov = Array.from({ length: D_MODEL }, () => new Array(D_MODEL).fill(0));
  for (const s of samples) {
    for (let i = 0; i < D_MODEL; i++) {
      const di = s[i] - mean[i];
      for (let j = 0; j < D_MODEL; j++) cov[i][j] += (di * (s[j] - mean[j])) / samples.length;
    }
  }

  const basis = [];
  const C = cov.map((r) => r.slice());
  for (let k = 0; k < 3; k++) {
    let v = unit(Array.from({ length: D_MODEL }, (_, i) => ((i + k * 3) % 2 === 0 ? 1 : -0.7) + 0.17 * i));
    for (let iter = 0; iter < 80; iter++) {
      const next = new Array(D_MODEL).fill(0);
      for (let i = 0; i < D_MODEL; i++) {
        let sum = 0;
        for (let j = 0; j < D_MODEL; j++) sum += C[i][j] * v[j];
        next[i] = sum;
      }
      for (const prev of basis) {
        const proj = dot(next, prev);
        for (let i = 0; i < D_MODEL; i++) next[i] -= proj * prev[i];
      }
      v = unit(next);
    }
    const Av = C.map((row) => dot(row, v));
    const lam = dot(v, Av);
    basis.push(v);
    for (let i = 0; i < D_MODEL; i++) {
      for (let j = 0; j < D_MODEL; j++) C[i][j] -= lam * v[i] * v[j];
    }
  }

  let maxAbs = 0.01;
  for (const s of samples) {
    const centered = s.map((v, d) => v - mean[d]);
    for (let k = 0; k < 3; k++) {
      const c = Math.abs(dot(centered, basis[k]));
      if (c > maxAbs) maxAbs = c;
    }
  }
  const scale = 0.86 / maxAbs;
  return { mean, basis, scale };
}

export const PCA3 = computePCA3();

export function project3(vec8) {
  const u = unit(vec8);
  const centered = u.map((v, d) => v - PCA3.mean[d]);
  return [
    Math.max(-0.92, Math.min(0.92, dot(centered, PCA3.basis[0]) * PCA3.scale)),
    Math.max(-0.92, Math.min(0.92, dot(centered, PCA3.basis[1]) * PCA3.scale)),
    Math.max(-0.92, Math.min(0.92, dot(centered, PCA3.basis[2]) * PCA3.scale)),
  ];
}

export const NODE_POS3 = NODES.map((n) => project3(n.dir));

// Chapter centroids for smooth timeline trajectory
export const CHAPTER_POS3 = CHAPTERS.map((ch) => {
  const sum = [0, 0, 0];
  for (const id of ch.anchorIds) {
    sum[0] += NODE_POS3[id][0];
    sum[1] += NODE_POS3[id][1];
    sum[2] += NODE_POS3[id][2];
  }
  const n = ch.anchorIds.length;
  return [sum[0] / n, sum[1] / n, sum[2] / n];
});

// Dense Background Field of Accumulated Unspoken Moments (1,600 stars that grow with time)
export const N_BG = 1600;
function buildLivedField() {
  const r = mulberry32(892026);
  const gauss = () => (r() + r() + r() + r() - 2.0) * 0.85;
  const pos3 = [];
  const cluster = [];
  const weight = [];
  const bornAt = [];

  for (let i = 0; i < N_BG; i++) {
    let vec8;
    let cIdx;
    let born;
    if (i < 1050) {
      // Anchored organically around real nodes so each chapter visibly thickens its neighborhood
      const host = NODES[i % N_NODES];
      cIdx = host.cluster;
      const spread = 0.22 + 0.52 * Math.pow(r(), 1.2);
      vec8 = unit(host.dir.map((v) => v + gauss() * spread));
      born = Math.max(0, Math.min(4.98, host.bornAt + (r() - 0.35) * 0.6));
    } else {
      // Diffuse global subconscious / lived-experience texture across the whole cube
      vec8 = unit(Array.from({ length: D_MODEL }, () => gauss()));
      let bestC = 0;
      let bestDot = -2;
      for (let c = 0; c < 4; c++) {
        const d = dot(vec8, CLUSTERS[c].center);
        if (d > bestDot) { bestDot = d; bestC = c; }
      }
      cIdx = bestC;
      born = r() * 4.95;
    }
    const p = project3(vec8);
    pos3.push([
      Math.max(-0.96, Math.min(0.96, p[0] + (r() - 0.5) * 0.14)),
      Math.max(-0.96, Math.min(0.96, p[1] + (r() - 0.5) * 0.14)),
      Math.max(-0.96, Math.min(0.96, p[2] + (r() - 0.5) * 0.14)),
    ]);
    cluster.push(cIdx);
    weight.push(0.35 + 0.65 * r());
    bornAt.push(born);
  }

  // ~950 delicate local manifold filaments
  const edges = [];
  const maxEdges = 950;
  for (let i = 0; i < N_BG && edges.length < maxEdges; i++) {
    const a = pos3[i];
    let bestJ = -1;
    let bestD2 = 0.068;
    for (let k = 0; k < 48; k++) {
      const j = (i + 1 + ((k * 31) % (N_BG - 1))) % N_BG;
      if (j === i) continue;
      const b = pos3[j];
      const dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2];
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > 0.002 && d2 < bestD2) {
        bestD2 = d2;
        bestJ = j;
      }
    }
    if (bestJ >= 0) {
      edges.push([i, bestJ, 1.0 - Math.sqrt(bestD2) / 0.27, Math.max(bornAt[i], bornAt[bestJ])]);
    }
  }
  return { pos3, cluster, weight, bornAt, edges };
}

const BG = buildLivedField();
export const BG_POS3 = BG.pos3;
export const BG_CLUSTER = BG.cluster;
export const BG_WEIGHT = BG.weight;
export const BG_BORN = BG.bornAt;
export const BG_EDGES = BG.edges;

// Evaluate node activations & retroactive echoes at a given timeline depth t in [0, 5] OR in a synthesis lens
export function evaluateState(mode, timeDepth, lensIdx, mutedIds = null) {
  const acts = new Array(N_NODES).fill(0);
  const echoes = new Array(N_NODES).fill(0); // retroactive echo intensity from earlier chapters!
  const activeEdges = [];

  if (mode === "timeline") {
    const t = Math.max(0.05, Math.min(5.0, timeDepth));
    const curChap = Math.min(4, Math.floor(t));

    for (let i = 0; i < N_NODES; i++) {
      if (mutedIds && mutedIds[i]) continue;
      const n = NODES[i];
      if (n.bornAt > t) continue;
      const age = t - n.bornAt;
      if (n.chapter === curChap) {
        // Current chapter nodes glow brightly as they crystallize
        const ramp = Math.min(1.0, age / 0.22);
        acts[i] = 0.65 + 0.35 * ramp;
      } else {
        // Past chapter nodes remain present as calm established stars
        acts[i] = 0.26;
      }
    }

    // Activate edges whose endpoints are born, and fire RETROACTIVE ECHOES on cross-era bridges!
    for (let eIdx = 0; eIdx < EDGES.length; eIdx++) {
      const [a, b, str, isBridge] = EDGES[eIdx];
      if ((mutedIds && mutedIds[a]) || (mutedIds && mutedIds[b])) continue;
      const na = NODES[a], nb = NODES[b];
      if (na.bornAt > t || nb.bornAt > t) continue;

      const aIsCur = na.chapter === curChap;
      const bIsCur = nb.chapter === curChap;
      let flow = 0.16;
      let isRetro = false;

      if (isBridge && (aIsCur !== bIsCur)) {
        // Cross-era bridge connecting an earlier chapter into the active chapter!
        flow = 0.96 * str;
        isRetro = true;
        const older = aIsCur ? b : a;
        echoes[older] = Math.max(echoes[older], 0.95 * str);
        acts[older] = Math.max(acts[older], 0.85 * str);
      } else if (aIsCur && bIsCur) {
        flow = 0.72 * str;
      }
      activeEdges.push({ idx: eIdx, a, b, flow, isBridge, isRetro });
    }
  } else {
    // Lens / Synthesis mode: entire life (1989 -> Today) is present; selected constellation ignites!
    const lens = LENSES[lensIdx] || LENSES[0];
    const inLens = new Set(lens.nodes);
    for (let i = 0; i < N_NODES; i++) {
      if (mutedIds && mutedIds[i]) continue;
      acts[i] = inLens.has(i) ? 0.95 : 0.18;
    }
    for (let eIdx = 0; eIdx < EDGES.length; eIdx++) {
      const [a, b, str, isBridge] = EDGES[eIdx];
      if ((mutedIds && mutedIds[a]) || (mutedIds && mutedIds[b])) continue;
      const both = inLens.has(a) && inLens.has(b);
      const one = inLens.has(a) || inLens.has(b);
      const flow = both ? 0.96 * str : one ? 0.22 * str : 0.08;
      activeEdges.push({ idx: eIdx, a, b, flow, isBridge, isRetro: both && isBridge });
    }
  }

  // Cluster resonance meters (0..1)
  const clusterEnergy = [0, 0, 0, 0];
  const clusterCounts = [0, 0, 0, 0];
  for (let i = 0; i < N_NODES; i++) {
    const c = NODES[i].cluster;
    clusterEnergy[c] += acts[i];
    clusterCounts[c]++;
  }
  const clusterLevels = clusterEnergy.map((e, c) => Math.min(1, e / Math.max(1, clusterCounts[c] * 0.72)));

  return { acts, echoes, activeEdges, clusterLevels };
}

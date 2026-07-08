/* ============================================================
   essays — graph explorer + reader
   ============================================================ */

let nodes = [], links = [];
let selectedId = null;
let sim, node, link, edgeLabel, color;
const byId = new Map();
const neighbors = new Map(); // id -> Set(neighborId)
const linkKey = l => `${idOf(l.source)}::${idOf(l.target)}`;
const idOf = x => (typeof x === "object" ? x.id : x);
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const $ = id => document.getElementById(id);

fetch("essays.json")
  .then(r => r.json())
  .then(data => {
    nodes = data.essays;
    links = data.links.map(l => ({ ...l }));
    nodes.forEach(n => byId.set(n.id, n));
    indexNeighbors();
    bootSequence();
    renderHeroMeta();
    buildLegend();
    buildGraph();
    openFromHash();
    runOracle();
  })
  .catch(err => {
    $("readoutEmpty").innerHTML =
      'could not load <b>essays.json</b>. If you opened this file directly (file://), run a local server instead — <code>python3 -m http.server</code> — then visit localhost. GitHub Pages serves it correctly.';
    console.error(err);
  });

function indexNeighbors(){
  nodes.forEach(n => neighbors.set(n.id, new Set()));
  links.forEach(l => {
    neighbors.get(l.source)?.add(l.target);
    neighbors.get(l.target)?.add(l.source);
  });
}

/* ─── color: one hue per theme cluster ─── */
function makeColor(){
  const tags = [...new Set(nodes.map(n => n.tag))];
  const range = ["#5EEAD4", "#A5B4FC", "#F4B678", "#F0A6C4", "#86EFAC"];
  color = d3.scaleOrdinal().domain(tags).range(range);
}

/* ─── typed terminal boot ─── */
function bootSequence(){
  const boot = $("boot");
  const lines = [
    { html: `<span class="p">liam@dondisch ~ %</span> whoami` },
    { html: `<span class="arrow">→</span> <span class="v">data scientist · psychology &amp; philosophy, occasionally both at once</span>`, instant: true },
    { html: `<span class="p">liam@dondisch ~ %</span> open ./essays --graph`, cursor: true },
  ];
  if (reduceMotion){
    boot.innerHTML = lines.map(l => `<div>${l.html}</div>`).join("");
    boot.querySelector(".p:last-of-type")?.insertAdjacentHTML("afterend", '<span class="cursor"></span>');
    return;
  }
  let i = 0;
  const next = () => {
    if (i >= lines.length) return;
    const l = lines[i];
    const div = document.createElement("div");
    boot.appendChild(div);
    if (l.instant){
      div.innerHTML = l.html;
      i++; setTimeout(next, 260); return;
    }
    typeInto(div, l.html, () => {
      if (l.cursor){ const c = document.createElement("span"); c.className = "cursor"; div.appendChild(c); }
      i++; setTimeout(next, 240);
    });
  };
  next();
}

// type an html string char-by-char while keeping tags intact
function typeInto(el, html, done){
  const tmp = document.createElement("div"); tmp.innerHTML = html;
  const tokens = [];
  tmp.childNodes.forEach(function walk(n){
    if (n.nodeType === 3) n.textContent.split("").forEach(ch => tokens.push({ ch }));
    else { const open = n.cloneNode(false); tokens.push({ open }); n.childNodes.forEach(walk); tokens.push({ close: true }); }
  });
  let idx = 0, stack = [el];
  const step = () => {
    if (idx >= tokens.length){ done && done(); return; }
    const t = tokens[idx++];
    if (t.ch) stack[stack.length-1].appendChild(document.createTextNode(t.ch));
    else if (t.open){ stack[stack.length-1].appendChild(t.open); stack.push(t.open); }
    else if (t.close) stack.pop();
    setTimeout(step, t.ch === " " ? 14 : 18);
  };
  step();
}

/* ─── hero meta stats ─── */
function renderHeroMeta(){
  const langs = new Set(nodes.map(n => n.lang)).size;
  const tags = new Set(nodes.map(n => n.tag)).size;
  const words = nodes.reduce((s, n) => s + (n.words || 0), 0);
  $("heroMeta").innerHTML = `
    <span><b>${nodes.length}</b> essays</span>
    <span><b>${tags}</b> themes</span>
    <span><b>${langs}</b> languages</span>
    <span><b>${words.toLocaleString()}</b> words</span>`;
}

function buildLegend(){
  makeColor();
  $("legend").innerHTML = color.domain().map(t =>
    `<span class="item"><span class="swatch" style="color:${color(t)};background:${color(t)}"></span>${t}</span>`
  ).join("");
}

/* ─── graph ─── */
function buildGraph(){
  const svg = d3.select("#graph");
  const W = 880, H = 440;
  svg.attr("viewBox", [0, 0, W, H]).attr("preserveAspectRatio", "xMidYMid meet");

  // soft glow filter
  const defs = svg.append("defs");
  const f = defs.append("filter").attr("id", "glow").attr("x", "-60%").attr("y", "-60%").attr("width", "220%").attr("height", "220%");
  f.append("feGaussianBlur").attr("stdDeviation", "4").attr("result", "b");
  const m = f.append("feMerge"); m.append("feMergeNode").attr("in", "b"); m.append("feMergeNode").attr("in", "SourceGraphic");

  sim = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id(d => d.id).distance(d => 260 - d.w * 90))
    .force("charge", d3.forceManyBody().strength(-900))
    .force("center", d3.forceCenter(W / 2, H / 2))
    .force("collide", d3.forceCollide(66))
    .force("x", d3.forceX(W / 2).strength(.09))
    .force("y", d3.forceY(H / 2).strength(.12));

  link = svg.append("g").selectAll("line").data(links).join("line")
    .attr("class", "link-line")
    .attr("stroke", "#33465F")
    .attr("stroke-width", d => 1 + d.w * 3.2)
    .attr("opacity", .5);

  edgeLabel = svg.append("g").selectAll("text").data(links).join("text")
    .attr("class", "edge-label").attr("text-anchor", "middle").text(d => d.w.toFixed(2));

  node = svg.append("g").selectAll("g").data(nodes).join("g").style("cursor", "pointer");

  if (!window.matchMedia("(pointer: coarse)").matches){
    node.call(d3.drag()
      .on("start", (e, d) => { if (!e.active) sim.alphaTarget(.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on("drag",  (e, d) => { d.fx = e.x; d.fy = e.y; })
      .on("end",   (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }));
  }

  node.append("circle")
    .attr("class", "node-circle")
    .attr("r", 21)
    .attr("fill", "#0C121C")
    .attr("stroke", d => color(d.tag))
    .attr("stroke-width", 2.5);

  // language badge inside node
  node.append("text")
    .attr("text-anchor", "middle").attr("dy", 4)
    .attr("font-family", "var(--mono)").attr("font-size", "10px").attr("font-weight", "700")
    .attr("fill", d => color(d.tag)).attr("pointer-events", "none")
    .text(d => d.lang);

  node.append("text")
    .attr("class", "node-label").attr("text-anchor", "middle").attr("dy", 40)
    .text(d => d.title.length > 24 ? d.title.slice(0, 22) + "…" : d.title);

  node.on("click", (e, d) => handleNodeClick(d))
    .on("mouseenter", (e, d) => emphasize(d.id))
    .on("mouseleave", () => emphasize(selectedId));

  sim.on("tick", () => {
    link.attr("x1", d => d.source.x).attr("y1", d => d.source.y).attr("x2", d => d.target.x).attr("y2", d => d.target.y);
    edgeLabel.attr("x", d => (d.source.x + d.target.x) / 2).attr("y", d => (d.source.y + d.target.y) / 2 - 3);
    node.attr("transform", d => `translate(${d.x},${d.y})`);
  });
}

/* highlight a node + its neighborhood, dim the rest */
function emphasize(id){
  if (!id){ // reset
    node.classed("dim", false);
    node.select(".node-circle").attr("stroke-width", 2.5).style("filter", null);
    link.classed("dim", false);
    edgeLabel.classed("on", false);
    return;
  }
  const nbrs = neighbors.get(id) || new Set();
  const inSet = i => i === id || nbrs.has(i);
  node.classed("dim", d => !inSet(d.id));
  node.select(".node-circle")
    .attr("stroke-width", d => d.id === id ? 4 : 2.5)
    .style("filter", d => d.id === id ? "url(#glow)" : null);
  link.classed("dim", d => idOf(d.source) !== id && idOf(d.target) !== id);
  edgeLabel.classed("on", d => idOf(d.source) === id || idOf(d.target) === id);
}

function handleNodeClick(d){
  if (selectedId === d.id) openReader(d);
  else { selectedId = d.id; emphasize(d.id); showReadout(d); }
}

/* ─── readout ─── */
function readTime(w){ return Math.max(1, Math.round((w || 0) / 220)); }

function showReadout(d){
  $("readoutEmpty").hidden = true;
  const body = $("readoutBody");
  body.hidden = false;
  const maxW = Math.max(...nodes.map(n => n.words || 0));
  body.innerHTML = `
    <div class="ro-id">${d.id} · checksum ${d.hash}</div>
    <div class="ro-title">${d.title}</div>
    <div class="ro-grid">
      <span class="k">theme</span><span class="val ro-tag">${d.tag}</span>
      <span class="k">language</span><span class="val">${d.lang === "ES" ? "Spanish" : "English"}</span>
      <span class="k">length</span><span class="val">${(d.words||0).toLocaleString()} words · ~${readTime(d.words)} min</span>
      <span class="k">links</span><span class="val">${(neighbors.get(d.id)||new Set()).size} connected</span>
    </div>
    <div class="ro-bar"><span style="width:${Math.round((d.words/maxW)*100)}%"></span></div>
    <div style="margin-top:18px"><button class="open" id="openBtn">read file →</button></div>`;
  $("openBtn").addEventListener("click", () => openReader(d));
}

/* ─── reader ─── */
function openReader(d){
  selectedId = d.id;
  $("explorer").classList.add("shrunk");
  $("breadcrumb").classList.add("show");
  $("crumbPath").textContent = `essays/${d.id}.txt`;

  const reader = $("reader");
  reader.classList.add("show");
  reader.setAttribute("aria-hidden", "false");

  $("readerFname").textContent = `${d.id}.txt`;
  $("readerCmd").textContent = `cat ${d.id}.txt`;
  $("readerTag").textContent = d.tag;
  $("readerTitle").textContent = d.title;
  $("readerSub").textContent = d.sub;
  $("readerByline").textContent = `${d.byline} · ${d.lang === "ES" ? "Spanish" : "English"} · ~${readTime(d.words)} min read`;
  $("readerParas").innerHTML = d.paras.map(p => `<p>${p}</p>`).join("");
  $("readerSource").textContent = d.source || "";

  renderRelated(d);
  $("progressBar").style.width = "0%";
  if (location.hash !== "#" + d.id) history.replaceState(null, "", "#" + d.id);
  window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
}

/* open a specific essay if the URL carries #case_id */
function openFromHash(){
  const id = decodeURIComponent(location.hash.replace(/^#/, ""));
  if (id && byId.has(id)){ selectedId = id; emphasize(id); openReader(byId.get(id)); }
}

function renderRelated(d){
  const rel = links
    .filter(l => idOf(l.source) === d.id || idOf(l.target) === d.id)
    .map(l => ({ other: byId.get(idOf(l.source) === d.id ? idOf(l.target) : idOf(l.source)), w: l.w }))
    .filter(r => r.other)
    .sort((a, b) => b.w - a.w);

  const box = $("readerRelated");
  if (!rel.length){ box.innerHTML = ""; return; }
  box.innerHTML = `
    <div class="rel-label">connected essays</div>
    <div class="rel-chips">
      ${rel.map(r => `
        <button class="rel-chip" data-id="${r.other.id}">
          <span class="rc-t">${r.other.title}</span>
          <span class="rc-w">${r.other.tag} · edge <b>${r.w.toFixed(2)}</b></span>
        </button>`).join("")}
    </div>`;
  box.querySelectorAll(".rel-chip").forEach(el =>
    el.addEventListener("click", () => openReader(byId.get(el.dataset.id))));
}

function closeReader(){
  $("explorer").classList.remove("shrunk");
  $("breadcrumb").classList.remove("show");
  const reader = $("reader");
  reader.classList.remove("show");
  reader.setAttribute("aria-hidden", "true");
  emphasize(selectedId);
  if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
}

$("backBtn").addEventListener("click", closeReader);
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && $("reader").classList.contains("show")) closeReader();
});

/* ============================================================
   oracle — glyph-scramble philosopher ticker
   ============================================================ */

const PHILOSOPHERS = [
  { name: "Martin Heidegger", quotes: [
    { t: "The most thought-provoking thing in our thought-provoking time is that we are still not thinking.", w: "What Is Called Thinking?, 1954" },
    { t: "Anxiety individualizes Dasein for its ownmost being-in-the-world.", w: "Being and Time, 1927" },
    { t: "Only a god can save us.", w: "Der Spiegel interview, 1966" },
  ]},
  { name: "Albert Camus", quotes: [
    { t: "One must imagine Sisyphus happy.", w: "The Myth of Sisyphus, 1942" },
    { t: "There is but one truly serious philosophical problem: suicide.", w: "The Myth of Sisyphus, 1942" },
    { t: "In the midst of winter, I found there was an invincible summer.", w: "Return to Tipasa, 1952" },
  ]},
  { name: "Friedrich Nietzsche", quotes: [
    { t: "Man is a rope stretched between the animal and the Übermensch.", w: "Thus Spoke Zarathustra, 1883" },
    { t: "One must still have chaos in oneself to give birth to a dancing star.", w: "Thus Spoke Zarathustra, 1883" },
    { t: "He who has a why to live can bear almost any how.", w: "Twilight of the Idols, 1889" },
  ]},
  { name: "Michel Foucault", quotes: [
    { t: "In the serene world of mental illness, modern man no longer communicates with the madman.", w: "Madness and Civilization, 1961" },
    { t: "Madness fascinates because it is knowledge.", w: "Madness and Civilization, 1961" },
    { t: "Where there is power, there is resistance.", w: "The History of Sexuality, 1976" },
  ]},
  { name: "Marcus Aurelius", quotes: [
    { t: "You have power over your mind, not outside events. Realize this, and you will find strength.", w: "Meditations, c. 170 AD" },
    { t: "The impediment to action advances action. What stands in the way becomes the way.", w: "Meditations, c. 170 AD" },
    { t: "Waste no more time arguing about what a good man should be. Be one.", w: "Meditations, c. 170 AD" },
  ]},
];

const GLYPHS = "!<>-_\\/[]{}—=+*^?#§$%&:;·|~".split("");

// decode/scramble text: chars appear as glyphs, then resolve to target.
// one shared glyph set → scramble-in and scramble-out feel like one system.
class TextScramble {
  constructor(el){ this.el = el; this.frame = 0; this.queue = []; this.req = null; this.tick = this.tick.bind(this); }
  set(newText, totalFrames){
    const old = this.el.textContent || "";
    const len = Math.max(old.length, newText.length);
    this.queue = [];
    for (let i = 0; i < len; i++){
      const start = Math.floor(Math.random() * totalFrames * 0.45);
      const dur = Math.floor(totalFrames * 0.25) + Math.floor(Math.random() * totalFrames * 0.35);
      this.queue.push({ from: old[i] || "", to: newText[i] || "", start, end: start + dur, char: null });
    }
    cancelAnimationFrame(this.req);
    this.frame = 0;
    return new Promise(res => { this.resolve = res; this.tick(); });
  }
  tick(){
    let out = "", done = 0;
    for (const q of this.queue){
      if (this.frame >= q.end){ done++; out += q.to; }
      else if (this.frame >= q.start){
        if (!q.char || Math.random() < 0.3) q.char = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        out += `<span class="scr">${q.char}</span>`;
      } else out += q.from;
    }
    this.el.innerHTML = out;
    if (done === this.queue.length) this.resolve();
    else { this.frame++; this.req = requestAnimationFrame(this.tick); }
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const F = ms => Math.round(ms / 16.67); // ms → animation frames (~60fps)

async function runOracle(){
  const nameEl = $("oracleName"), quoteEl = $("oracleQuote"), workEl = $("oracleWork");

  if (reduceMotion){
    const p = PHILOSOPHERS[1]; // Camus — a gentle default
    nameEl.textContent = p.name.toUpperCase();
    quoteEl.textContent = `“${p.quotes[0].t}”`;
    workEl.textContent = p.quotes[0].w;
    return;
  }

  const scrName = new TextScramble(nameEl);
  const scrQuote = new TextScramble(quoteEl);
  let i = 0;

  while (true){
    const p = PHILOSOPHERS[i];

    // State 0 — idle blink (3s)
    nameEl.innerHTML = '<span class="ocursor">▮</span>';
    quoteEl.textContent = ""; workEl.style.opacity = 0; workEl.textContent = "";
    await sleep(3000);

    // States 1+2 — glyph write-in, then resolve to the name (~2.6s)
    nameEl.textContent = "";
    await scrName.set(p.name.toUpperCase(), F(2600));

    // State 3 — quote cycle (~20s), scramble transition between quotes
    const hold = Math.round((20000 - p.quotes.length * 600) / p.quotes.length);
    for (const q of p.quotes){
      workEl.style.opacity = 0;
      await scrQuote.set(`“${q.t}”`, F(600));
      workEl.textContent = q.w;
      workEl.style.opacity = 1;
      await sleep(hold);
    }

    // State 4 — quick delete: scramble back to glyphs, then dissolve (4s)
    workEl.style.opacity = 0;
    await Promise.all([ scrName.set("", F(1200)), scrQuote.set("", F(1200)) ]);
    await sleep(400);

    i = (i + 1) % PHILOSOPHERS.length;
  }
}

/* reading progress */
window.addEventListener("scroll", () => {
  if (!$("reader").classList.contains("show")) return;
  const doc = document.documentElement;
  const max = doc.scrollHeight - doc.clientHeight;
  const pct = max > 0 ? Math.min(100, (doc.scrollTop / max) * 100) : 0;
  $("progressBar").style.width = pct + "%";
}, { passive: true });

let nodes = [];
let links = [];
let selectedId = null;
let sim, node, link, edgeLabel, width, height;

fetch("essays.json")
  .then(r => r.json())
  .then(data => {
    nodes = data.essays;
    links = data.links;
    renderStats();
    buildGraph();
  })
  .catch(err => {
    document.getElementById("readout").innerHTML =
      '<div class="empty">// could not load essays.json — if you are opening this file directly (file://), run a local server instead, e.g. `python3 -m http.server` then visit localhost. GitHub Pages serves this correctly.</div>';
    console.error(err);
  });

function renderStats(){
  const langs = new Set(nodes.map(n => n.lang)).size;
  const tags = new Set(nodes.map(n => n.tag)).size;
  const strongest = Math.max(...links.map(l => l.w)).toFixed(2);
  document.getElementById("statsRowInner").innerHTML = `
    <div class="stat"><span class="n">${nodes.length}</span><span class="l">open files</span></div>
    <div class="stat"><span class="n">${langs}</span><span class="l">languages</span></div>
    <div class="stat"><span class="n">${tags}</span><span class="l">theme clusters</span></div>
    <div class="stat"><span class="n">${strongest}</span><span class="l">strongest edge</span></div>
  `;
}

function buildGraph(){
  const svg = d3.select("#graph");
  width = 872; height = 460;
  svg.attr("viewBox", [0, 0, width, height]);

  sim = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id(d => d.id).distance(d => 260 - d.w * 140))
    .force("charge", d3.forceManyBody().strength(-420))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collide", d3.forceCollide(58));

  link = svg.append("g").selectAll("line")
    .data(links).join("line")
    .attr("stroke", "#2A6E67").attr("stroke-width", d => 1 + d.w * 3).attr("opacity", 0.55);

  edgeLabel = svg.append("g").selectAll("text")
    .data(links).join("text").attr("class", "edge-label").text(d => d.w.toFixed(2));

  node = svg.append("g").selectAll("g")
    .data(nodes).join("g");

  const isCoarsePointer = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  if (!isCoarsePointer) {
    node.call(d3.drag()
      .on("start", (event, d) => { if (!event.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on("drag", (event, d) => { d.fx = event.x; d.fy = event.y; })
      .on("end", (event, d) => { if (!event.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }));
  }

  node.append("circle")
    .attr("r", 22).attr("fill", "#0F1420")
    .attr("stroke", d => d.lang === "ES" ? "#FFB454" : "#4FD1C5")
    .attr("stroke-width", 2.5)
    .style("cursor", "pointer")
    .on("click", (event, d) => handleNodeClick(d))
    .on("mouseover", function(){ d3.select(this).attr("stroke-width", 4); })
    .on("mouseout", function(){ d3.select(this).attr("stroke-width", 2.5); });

  node.append("text")
    .attr("class", "node-label").attr("text-anchor", "middle").attr("dy", 40)
    .text(d => d.title.length > 22 ? d.title.slice(0, 20) + "…" : d.title);

  sim.on("tick", () => {
    link.attr("x1", d => d.source.x).attr("y1", d => d.source.y).attr("x2", d => d.target.x).attr("y2", d => d.target.y);
    edgeLabel.attr("x", d => (d.source.x + d.target.x) / 2).attr("y", d => (d.source.y + d.target.y) / 2);
    node.attr("transform", d => `translate(${d.x},${d.y})`);
  });
}

function handleNodeClick(d){
  if (selectedId === d.id) {
    openReader(d);
  } else {
    selectedId = d.id;
    showReadout(d);
  }
}

function showReadout(d){
  document.getElementById("readout").innerHTML = `
    <span class="rline"><span class="k">// case_id:</span> <span class="v">${d.id}</span></span><br>
    <span class="title-v">${d.title}</span>
    <span class="rline"><span class="k">theme:</span> <span class="tag-v">${d.tag}</span></span><br>
    <span class="rline"><span class="k">language:</span> <span class="v">${d.lang}</span></span><br>
    <span class="rline"><span class="k">length:</span> <span class="v">${d.words} words</span></span><br>
    <span class="rline"><span class="k">checksum:</span> <span class="v">${d.hash}...</span></span><br>
    <button class="open" id="openBtn">open file →</button>
  `;
  document.getElementById("openBtn").addEventListener("click", () => openReader(d));
}

function openReader(d){
  document.getElementById("statsRow").classList.add("shrunk");
  document.getElementById("graphPanelWrap").classList.add("shrunk");
  document.getElementById("readoutWrap").classList.add("shrunk");
  document.getElementById("breadcrumb").classList.add("show");
  document.getElementById("crumbPath").textContent = "essays/" + d.id + ".txt";
  document.getElementById("reader").classList.add("show");

  document.getElementById("readerFname").textContent = d.id + ".txt";
  document.getElementById("readerCmd").textContent = "liam@dondisch:~$ cat " + d.id + ".txt";
  document.getElementById("readerTitle").textContent = d.title;
  document.getElementById("readerSub").textContent = d.sub;
  document.getElementById("readerByline").textContent = d.byline + " · " + d.lang;
  document.getElementById("readerParas").innerHTML = d.paras.map(p => `<p>${p}</p>`).join("");
  document.getElementById("readerSource").textContent = d.source ? ("source: " + d.source) : "";

  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.getElementById("backBtn").addEventListener("click", () => {
  document.getElementById("statsRow").classList.remove("shrunk");
  document.getElementById("graphPanelWrap").classList.remove("shrunk");
  document.getElementById("readoutWrap").classList.remove("shrunk");
  document.getElementById("breadcrumb").classList.remove("show");
  document.getElementById("reader").classList.remove("show");
  selectedId = null;
});

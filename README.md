# essays — a thematic graph of writing

A personal essay site for writing on **psychology and philosophy**, presented
as an interactive knowledge graph rather than a chronological blog. Each essay
is a node; edges connect essays that share ideas. Click a node to inspect it,
click again to read it in a focused, typographic reader.

**Live site:** _enable GitHub Pages (see [Deployment](#deployment)) and it publishes to_
`https://<username>.github.io/<repo>/`

<!-- Replace the line above with your real URL once Pages is live, e.g.:
     Live site: https://dondischl12.github.io/psych_blog/ -->

---

## Why a graph?

Ideas don't arrive in chronological order, and they rarely stay in their lane.
An essay on dissociative PTSD and an essay on the legitimacy of political
violence turn out to share a spine — questions of authority, control, and the
self under pressure. A reverse-chronological list flattens that. A force-directed
graph makes the relationships between pieces the primary interface: proximity and
edge weight encode how strongly two essays speak to each other.

## Features

- **Force-directed graph** (d3-force) — nodes colored by theme cluster, edge
  thickness scaled by thematic similarity, with neighborhood highlighting on hover.
- **Focused reader** — editorial serif typography, drop cap, reading-time
  estimate, scroll progress, and a "connected essays" trail that lets you move
  through the graph while reading.
- **Bilingual** — essays in English and Spanish, badged inline.
- **Zero build step** — plain HTML/CSS/JS. Content lives in a single JSON file.
- **Accessible & responsive** — honors `prefers-reduced-motion`, works on mobile.

## Tech

No framework, no bundler. Just:

| File | Role |
| --- | --- |
| [`site/index.html`](site/index.html) | Page structure |
| [`site/style.css`](site/style.css) | All styling (design tokens as CSS variables) |
| [`site/script.js`](site/script.js) | Graph rendering, reader, interactions |
| [`site/essays.json`](site/essays.json) | **All content** — the only file you edit to publish |
| [d3.js v7](https://d3js.org/) | Loaded from CDN for the force simulation |

## Project structure

```
.
├── .github/workflows/deploy.yml   # auto-deploy to GitHub Pages on push
├── README.md
└── site/
    ├── index.html
    ├── style.css
    ├── script.js
    ├── essays.json                # content
    └── .nojekyll                  # skip Jekyll processing
```

## Running locally

Browsers block `fetch()` of local files over `file://`, so open the folder with
a static server:

```bash
cd site
python3 -m http.server 8000
# then open http://localhost:8000
```

Any static server works (`npx serve`, etc.).

## Adding an essay

Everything is data-driven. Add an object to the `essays` array in
[`site/essays.json`](site/essays.json):

```json
{
  "id": "case_06",
  "title": "Essay title",
  "sub": "One-line subtitle shown under the title",
  "tag": "theme label",
  "lang": "EN",
  "paras": ["Paragraph one.", "Paragraph two."],
  "source": "Citation, if any",
  "hash": "0a1b2c3d",
  "words": 800,
  "byline": "by Liam Dondisch"
}
```

- **`tag`** groups essays into colored theme clusters (new tags get their own color automatically).
- **`hash`** is cosmetic — the first 8 chars of the SHA-256 of the joined paragraph text.
- **`words`** drives the reading-time estimate and the length bar.

Then connect it to existing essays by adding to the `links` array:

```json
{ "source": "case_06", "target": "case_02", "w": 0.55 }
```

`w` is a 0–1 similarity weight: higher pulls the nodes closer and draws a
thicker edge.

## Deployment

The included GitHub Actions workflow deploys the `site/` directory to GitHub
Pages on every push to `main`. One-time setup:

1. Push this repository to GitHub.
2. Go to **Settings → Pages → Build and deployment**.
3. Set **Source** to **GitHub Actions**.

That's it — the next push (or a manual run from the **Actions** tab) publishes
the site. No branch juggling, no build output committed to the repo.

---

<sub>Built by hand, not templated.</sub>

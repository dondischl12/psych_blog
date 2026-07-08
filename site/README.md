# essays

Personal essay site. Philosophy and mental health, presented as a thematic
graph instead of a chronological blog list.

## Structure

- `index.html` — page shell
- `style.css` — all styles
- `script.js` — graph rendering (d3-force) + reader view, loads content from `essays.json`
- `essays.json` — the actual content: titles, tags, full text, source citations.
  **This is the only file you touch to add a new essay.**
- `.nojekyll` — tells GitHub Pages not to run Jekyll processing on this repo

## Adding a new essay

Open `essays.json` and add a new object to the `essays` array:

```json
{
  "id": "case_06",
  "title": "Essay title",
  "sub": "One-line subtitle",
  "tag": "theme label",
  "lang": "EN",
  "paras": ["Paragraph one.", "Paragraph two."],
  "source": "Citation, if any"
}
```

`hash`, `words`, and `byline` are computed automatically the next time you
regenerate the file with `build_essays_json.py` (kept outside the repo, or
you can compute the checksum by hand — first 8 characters of the SHA-256 of
the joined paragraph text).

To connect it to existing essays, add an entry to `links`:

```json
{ "source": "case_06", "target": "case_02", "w": 0.55 }
```

`w` is a 0–1 similarity weight. Higher pulls the two nodes closer together
and draws a thicker edge.

## Running locally

Opening `index.html` directly (`file://`) will fail to load `essays.json`
due to browser CORS restrictions on local file fetches. Run a local server
from this folder instead:

```
python3 -m http.server
```

Then visit `http://localhost:8000`. GitHub Pages serves this correctly with
no extra setup once pushed.

## Deploying

Push to GitHub, then in the repo settings enable Pages for the `main`
branch (root folder). No build step required, it's static.

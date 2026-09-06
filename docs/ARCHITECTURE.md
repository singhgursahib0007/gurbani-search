# Architecture

How the pieces fit, and why the seams are where they are.

## The shape of it

```
  BaniDB REST API ──┐
                    ├──▶  data/raw/       every upstream response, gzipped
  Shabad OS SQLite ─┘         │            (the downloaded dataset)
                              │
                         build │            pure function, offline
                              ▼
                      data/processed/gurbani.sqlite
                              │
              ┌───────────────┼───────────────┐
              │               │               │
          export           serve           static
              │               │               │
              ▼               ▼               ▼
      JSONL · CSV · txt   local API      site/  →  GitHub Pages
                              │               │
                              └──── app/ ─────┘
                                 one interface
```

Four commands, four stages, each doing one thing:

| Stage | Command | Reads | Writes |
|---|---|---|---|
| Fetch | `harness fetch` | the network | `data/raw/` |
| Build | `harness build` | `data/raw/` | `data/processed/gurbani.sqlite` |
| Verify | `harness verify` | the database | a pass/fail report |
| Publish | `harness static` | the database + `app/` | `site/` |

## The two rules everything else follows

**`data/raw` is the source of truth, and `build` is a pure function of it.**
Delete the database, rebuild it, and you get the same bytes back with no
network. Nothing is fetched during a build, nothing is patched by hand
afterwards. A correction to the corpus is a re-fetch; a correction to the
*shape* of the corpus is a change to `build.py` and a rebuild.

**The app has one implementation and two data paths.** `app/index.html` is
the same file whether it is served by `harness serve` against a local API or
published as static files. It picks its path at runtime from a marker the
static build injects, and `app/js/data.js` presents one interface over both.
There is no second copy of the interface to keep in step.

## Why SQLite in the middle

The corpus arrives as several thousand JSON documents shaped for an API, not
for reading. SQLite is the smallest thing that turns that into something
queryable, is a single file to copy or delete, needs no server, and is
already on every machine this runs on. It is also the artefact worth keeping:
if the harness disappeared tomorrow, `gurbani.sqlite` is still a complete,
documented corpus that any tool can open.

## Why no build step in the app

`app/` is plain ES modules and CSS custom properties. No bundler, no
transpiler, no lockfile. Two reasons:

- **What runs in production is the source you edit.** A stack trace points at
  a real line. There is no build output to get out of step with its input.
- **It cannot rot.** A toolchain is a dependency that expires; this will still
  run in five years because it is what browsers already execute.

The cost is a request per module on a cold load - about twenty small files.
The service worker caches them after the first visit, and they gzip to a few
kilobytes each, so the cost is paid once.

## Where the interesting problems are

Most of this is plumbing. Three parts carry real difficulty, and each has its
own document:

- **[The script layer](GURMUKHI.md)** — first-letter search means
  reconstructing a column the API does not expose, in an encoding where case
  is meaningful and vowels are written before the letters they modify.
- **[The corpus](DATASET.md)** — two sources with different editorial
  policies, eleven translation streams, and an upstream that numbers bani
  verses in a different id space from ang verses.
- **[The app](APP.md)** — a reading interface where the chrome has to get out
  of the way, on a phone, offline.

## Sizes, so nothing is a surprise

| | |
|---|---|
| `data/raw/` | 245 MB — every upstream response, gzipped |
| `data/processed/gurbani.sqlite` | 394 MB |
| `site/` | 124 MB across 13,392 files |
| App source | ~3,000 lines of JS and CSS |
| Harness | ~2,400 lines of Python, no dependencies |
| First page load, published | ~35 KB gzipped |
| Search index, on first search | 4.6 MB gzipped, then cached |

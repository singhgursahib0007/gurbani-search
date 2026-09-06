# Publishing

The app is static files. `harness serve` is for your own machine; anything
that serves a folder can host the published build.

## Build and publish

```bash
python3 -m harness static          # writes site/
```

~124 MB across 13,392 files: the app shell, the search index, one JSON file
per shabad, and the icon set.

This repository publishes from a `gh-pages` branch so `main` stays small
enough to clone quickly:

```bash
git worktree add /tmp/ghp gh-pages
rsync -a --delete --exclude '.git' site/ /tmp/ghp/
git -C /tmp/ghp add -A && git -C /tmp/ghp commit -m "Publish"
git -C /tmp/ghp push origin gh-pages
git worktree remove /tmp/ghp
```

Pages redeploys in about thirty seconds. Any static host works the same way —
Vercel, Netlify, or a folder behind nginx.

## What a visit actually costs

The CDN gzips text, so these are wire sizes:

| | |
|---|---|
| First page load | **~35 KB** — shell, CSS, modules, font |
| Opening a bani or shabad | 2–7 KB, cached after |
| First search | **4.6 MB** — the index, once, then cached and offline |
| English/transliteration search | 5.3 MB more, only if used |

The index loads only when Search is first opened, with real progress, so the
Banis screen is instant on a cold visit.

## Choosing what to publish

The local database keeps all eleven translation streams; the published build
carries three. Two of the eleven are near-duplicates — `pu.bdb` matches
`pu.ss` on 99.2% of lines, `en.ssk` matches `en.bdb` on 92.7% — so shipping
both sides of each pair costs 25 MB and adds nothing a reader would notice.

```bash
python3 -m harness static --translations en.bdb,pu.ss,pu.ft --translits en,ur
```

Two structural savings are already applied: `larivaar` is dropped because it
is exactly the Gurmukhi line with spaces removed — true for all 142,405 lines,
so the browser derives it — and unused visraam data is dropped. Together they
took the build from 289 MB to 124 MB.

## Offline

`app/sw.js` precaches the shell, then serves by strategy:

| Request | Strategy | Why |
|---|---|---|
| Navigation | network first, cached shell as fallback | always try for the newest build, never fail without signal |
| `lines.tsv`, `text-en.tsv` | cache first, revalidated quietly | megabytes, and only change when the corpus is rebuilt |
| Everything else | stale-while-revalidate | instant, refreshed for next time |

`__BUILD__` is replaced with a timestamp at publish time, so each deployment
lands in a fresh cache and the previous one is deleted on activate.

Precache entries are fetched with `cache: "reload"`. Without it, a stale copy
sitting in the browser or a CDN edge can be baked into the precache and served
for the whole life of that build — which was observed happening.

## Installing on a phone

Open in Safari → **Share** → **Add to Home Screen**. It opens without browser
chrome, with the Khanda, and the status bar follows the theme.

`manifest.webmanifest` carries the icons and `display: standalone`. iOS also
needs a launch image matching the device *exactly*, or it shows a blank screen
while starting — hence 22 of them, eleven iPhone sizes in light and dark,
chosen by `prefers-color-scheme`. Flat grounds quantise well: 2.0 MB of PNG
became 0.26 MB.

## Two limits to keep in mind

**Git rejects any file over 100 MB.** The full 394 MB database can never be
committed; publish a slim build and keep the full one local. Git LFS will not
help — GitHub Pages does not resolve it and serves the pointer file instead.

**Pages has a soft ~100 GB/month bandwidth limit.** At ~35 KB a visit that is
effectively unlimited; it only starts to matter for visitors who all run a
first search.

## Regenerating the icons

The PNGs are rasterised from `app/icon.svg` so they cannot drift from the
artwork. There is no SVG rasteriser in this environment, so they were produced
by drawing the SVG to a canvas in a browser and posting the result to a
throwaway local endpoint — which also keeps image bytes out of the terminal.
`docs/DECISIONS.md` records the approach if they ever need rebuilding.

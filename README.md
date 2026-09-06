# GurbaniSearch

An offline Gurbani reader and search engine, built from the open data behind
[SikhiToTheMax](https://www.sikhitothemax.org).

**→ [singhgursahib0007.github.io/gurbani-search](https://singhgursahib0007.github.io/gurbani-search/)**

Read it on a phone, add it to the home screen, and it works with no signal.
No account, no tracking, no third-party JavaScript.

<br>

```bash
python3 -m harness fetch      # download the corpus (resumable, ~25 min)
python3 -m harness build      # normalise it into one SQLite database
python3 -m harness verify     # prove the result is sound
python3 -m harness serve      # open the app
```

Nothing beyond the Python standard library is required.

---

## What it is

SikhiToTheMax is how most people look up a line of Gurbani. Its signature
feature is **first-letter search**: instead of typing a whole line, you type
the first letter of each word — `jkrvmm` finds ਜਿਨ ਕੈ ਰਾਮੁ ਵਸੈ ਮਨ ਮਾਹਿ. That is
how kirtanis and granthis actually find a shabad.

This project reproduces that end to end — the data, the index, the keyboard,
and a reader built around it.

| | |
|---|---|
| **142,405** lines | across all seven sources |
| **820,549** translations | 11 streams: English, Punjabi, Hindi, Spanish |
| **104** banis | with per-*maryada* recitation flags |
| **4** transliteration schemes | Roman, Devanagari, IPA, Shahmukhi |

## Documentation

| | |
|---|---|
| **[Architecture](docs/ARCHITECTURE.md)** | how the pieces fit, and why the seams are where they are |
| **[The corpus](docs/DATASET.md)** | every table and field, and where the texts come from |
| **[The harness](docs/HARNESS.md)** | the ingestion pipeline, and how to extend it |
| **[The script layer](docs/GURMUKHI.md)** | first-letter search, two encodings, and the fonts |
| **[The app](docs/APP.md)** | screens, gestures, preferences, and what will bite you |
| **[Publishing](docs/DEPLOY.md)** | building the static site, offline, installing on a phone |
| **[Decisions and defects](docs/DECISIONS.md)** | the non-obvious calls, and the bugs found by measuring |

New here? Read **[Architecture](docs/ARCHITECTURE.md)**, then whichever of
**[the corpus](docs/DATASET.md)** or **[the app](docs/APP.md)** you are
touching.

## Where the data comes from

| | **BaniDB** | **Shabad OS** |
|---|---|---|
| Steward | Khalis Foundation | Shabad OS |
| Powers | SikhiToTheMax | Shabad OS Presenter |
| Distribution | REST API only | SQLite release asset |
| Role here | primary corpus | independent cross-check |

**BaniDB** is standardised for *lagamatra* and *padh chhedh* against the SGPC's
published pothis, with tens of thousands of community-vetted corrections. It
publishes no SQL dump, so the harness walks its public API exhaustively and
keeps every response.

**Shabad OS** traces every line to a cited printed source. Two projects
transcribing the same scripture from different printed sources is a feature:
disagreements become visible instead of invisible.

Both are the work of volunteers. **Please treat the API gently** — the harness
already rate-limits itself to well under the published limit, and its on-disk
cache means a re-run costs nothing.

## Layout

```
harness/     the ingestion pipeline — fetch, build, verify, export, publish
app/         the reader — plain ES modules and CSS, no build step
docs/        the documentation above
data/
  raw/       every upstream response, gzipped, untouched
  processed/ gurbani.sqlite
  exports/   JSONL, CSV, readable text, with checksums
site/        the publishable static build
```

`data/raw` is the source of truth. `build` is a pure function of it: delete the
database, rebuild, and you get the same bytes back, offline.

## The desktop app

The same corpus, designed from a desktop-first perspective — three panes, a
sidebar, keyboard-driven, with an immersive full-screen reading mode:

**→ [singhgursahib0007.github.io/gurbani-studio](https://singhgursahib0007.github.io/gurbani-studio/)**

Source: [gurbani-studio](https://github.com/singhgursahib0007/gurbani-studio).
It is standalone — its own pipeline, app and documentation — and shares only
the lineage of the harness and the script layer.

## A note on the texts

This is scripture. The harness never rewrites, "corrects" or normalises the
words — every translation and transliteration is stored exactly as the upstream
projects publish it, attributed to the person who made it, and upstream quirks
are kept and reported rather than quietly cleaned. The only text this project
generates is the search index, and that is derived mechanically and
[checked three independent ways](docs/GURMUKHI.md#how-the-index-is-checked).

## Credits

The corpus is the work of the [Khalis Foundation](https://khalisfoundation.org)
(BaniDB, SikhiToTheMax) and [Shabad OS](https://shabados.com), and of the
translators named in the `translators` table — Prof. Sahib Singh, Manmohan
Singh, Dr. Sant Singh Khalsa, the Faridkot Teeka commentators, and the SikhNet
team. Gurmukhi is set in [Sant Lipi](https://github.com/shabados/SantLipi);
icons are [Phosphor](https://phosphoricons.com). This repository only
reorganises their work for reading and study.

Built by Gursahib Singh · [gursahib99888@gmail.com](mailto:gursahib99888@gmail.com)

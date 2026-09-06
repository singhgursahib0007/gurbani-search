# GurbaniSearch

A local, offline Gurbani corpus and search engine — a study of how
[SikhiToTheMax](https://www.sikhitothemax.org) works, rebuilt from the open
data that powers it.

Everything here runs on your machine. No account, no network at query time,
no third-party JavaScript.

```bash
python3 -m harness fetch      # download the corpus (resumable, ~20 min)
python3 -m harness build      # normalise it into one SQLite database
python3 -m harness verify     # prove the result is sound
python3 -m harness serve      # open the search UI
```

Nothing beyond the Python standard library is required.

---

## What this is

SikhiToTheMax is the search interface most people use to look up a line of
Gurbani. Its signature feature is **first-letter search**: instead of typing a
whole line, you type the first letter of each word — `jkrvmm` finds
ਜਿਨ ਕੈ ਰਾਮੁ ਵਸੈ ਮਨ ਮਾਹਿ. That is how kirtanis and granthis actually find a
shabad, and it is why STTM ships an on-screen Gurmukhi keyboard.

This project reproduces that end to end: the data, the index, the keyboard,
and the reading view.

## Where the data comes from

| | **BaniDB** | **Shabad OS** |
|---|---|---|
| Steward | Khalis Foundation | Shabad OS |
| Powers | SikhiToTheMax | Shabad OS Presenter |
| Distribution | REST API only | SQLite release asset |
| Role here | primary corpus | independent cross-check |

**BaniDB** is the database behind SikhiToTheMax. It is standardised for
*lagamatra* (spelling) and *padh chhedh* (word separation) against the SGPC's
published pothis, with tens of thousands of community-vetted corrections. It
publishes no SQL dump, so the harness walks its public API exhaustively and
keeps every response.

**Shabad OS** takes a different editorial approach — every line traced to a
cited printed source, with a public logbook of corrections. It ships its
database directly, so we download it whole. Two projects transcribing the same
scripture from different printed sources is a feature: disagreements become
visible instead of invisible.

Both are the work of volunteers. Please treat the API gently — the harness
already rate-limits itself to well under the published limit.

## What you get

Seven sources, in Gurmukhi (Unicode *and* the legacy ASCII font encoding):

- **Sri Guru Granth Sahib Ji** — all 1,430 angs
- **Dasam Bani**
- **Bhai Gurdas Ji Vaaran** and **Bhai Gurdas Singh Ji Vaaran**
- **Bhai Nand Lal Ji**
- **Amrit Keertan**
- **Codes of Conduct** (Rehat Maryadas)

plus the **nitnem banis**, each carrying per-*maryada* inclusion flags, so you
can see which lines the SGPC, Taksal, and Buddha Dal traditions each recite.

Every line keeps, verbatim:

- **11 translation streams** — English (BaniDB, Manmohan Singh, Sant Singh
  Khalsa), Punjabi (Prof. Sahib Singh, his *padd arth* word glossary, the
  Faridkot Teeka, Manmohan Singh, BaniDB), Hindi (Sahib Singh, Sant Singh),
  and Spanish (SikhNet)
- **4 transliteration schemes** — Roman, Devanagari, IPA, Shahmukhi
- **visraam** (pause) markers from three editorial traditions
- writer, raag, ang and line number, and larivaar (word-joined) form

See [docs/DATASET.md](docs/DATASET.md) for the full schema and field-by-field
data dictionary.

## The search modes

They mirror SikhiToTheMax's own:

| Mode | What it does |
|---|---|
| First letters | first letter of each word, from the **start** of the line |
| First letters anywhere | the same run of letters **anywhere** in the line |
| Gurmukhi | a whole word, in either encoding |
| Romanised | a word in transliteration (`satgur`) |
| English | a word from the English translation |
| Main letters | consonant skeleton, vowel signs ignored |
| Ang | jump to a page |

### How first-letter search actually works

BaniDB stores a `FirstLetterStr` column — one character per word, in the
legacy ASCII font encoding — and matches it with `LIKE 'jkr%'` or
`LIKE '%jkr%'`. The public API does not expose that column, so the harness
recomputes it.

It derives the letters from the **Unicode** text rather than the ASCII text,
because ASCII Gurmukhi stores the sihari vowel *before* its consonant
(`isr` = ਸਿਰ), which would make `word[0]` the wrong letter. Unicode is in
logical order, so `word[0]` is always the base letter. Each letter is then
mapped back to its ASCII character, making the result byte-compatible with
BaniDB's own column.

`python3 -m harness verify --online` checks exactly this: it runs the same
first-letter queries against the local index and the live BaniDB API and
confirms every verse the API returns is also found locally.

## Layout

```
harness/            the ingestion pipeline
  config.py         paths, source registry, provenance
  net.py            polite, resumable, cached HTTP fetcher
  gurmukhi.py       the script layer: letters, first letters, keyboard
  providers/        one module per upstream data source
  build.py          raw cache -> normalised SQLite
  export.py         SQLite -> JSONL / CSV / plain text
  verify.py         integrity checks, offline and online
app/
  server.py         local JSON API over the database
  index.html        the search UI
data/
  raw/              every upstream response, gzipped, untouched
  processed/        gurbani.sqlite
  exports/          JSONL, CSV, readable text, with checksums
```

`data/raw` is the source of truth. `build` is a pure function of it: delete
the database, rebuild, and you get the same bytes back, offline.

## Commands

```bash
python3 -m harness fetch banidb --stage angs   # one stage at a time
python3 -m harness fetch --force               # ignore the cache and refetch
python3 -m harness build --rebuild             # drop and rebuild the database
python3 -m harness export --format jsonl       # jsonl | csv | txt | all
python3 -m harness verify --online             # cross-check against BaniDB
python3 -m harness stats                       # corpus summary
python3 -m harness serve --port 8080           # the UI
```

## The app

The interface is mobile-first and built from the iOS vocabulary: a tab bar,
inset grouped lists, sheets you can drag away, and a navigation title that
shrinks as you scroll. English is set in the system face (SF Pro on Apple
devices); Gurmukhi is set in **Sant Lipi**, a Unicode face built for Gurbani,
with Mukta Mahee, Noto Sans and Anek offered as alternatives.

Four screens: **Banis** (starred ones first, then the catalogue), **Search**,
**Saved**, and **Settings**. Tapping a bani or a search result opens the
reader, where the chrome hides as you scroll and everything a reader might
reach for lives in one sheet - theme, Gurmukhi face and weight, separate
sizes for Gurbani, transliteration and translation, alignment, larivaar,
which translations to show, and auto-scroll with an adjustable speed. Every
preference is stored on the device and there is a reset for each half of it.

`app/` is plain ES modules with no build step, so what runs in production is
the source you edit:

```
app/
  index.html          the shell
  css/                tokens (themes) · base · components · search · reader
  js/
    store.js          preferences and saved items, mirrored to localStorage
    data.js           one search interface over the API or the static index
    gurmukhi.js       the letter layer and the keyboard
    ui.js             el(), sheets, switches, segmented controls, sliders
    icons.js          Phosphor icons, inlined
    views/            banis · search · saved · settings · reader · typography
```

## Publishing it as a website

`serve` is for your own machine. To share it, build a version with no server
at all:

```bash
python3 -m harness static          # writes site/
```

That emits ~123 MB of plain files. The browser loads a 17 MB first-letter
index once (~4 MB over the wire, gzipped by the CDN) and searches it in
memory, so every keystroke is local — 10 ms for a first-letter search across
142,405 lines. Each shabad is a small JSON file fetched only when opened, and
the transliteration/English tier loads only if a visitor uses those two search
modes.

It is the **same `app/index.html`** in both modes; it picks its data path at
runtime from a marker the static build injects. There is no second copy of the
UI to keep in sync.

The published site carries three translations rather than all eleven —
`en.bdb`, `pu.ss` and `en.ms` — because two of the eleven are near-duplicates
(`pu.bdb` matches `pu.ss` on 99.2% of lines, `en.ssk` matches `en.bdb` on
92.7%), and the rest are specialist. Your local database keeps all eleven
regardless. Change the selection with:

```bash
python3 -m harness static --translations en.bdb,pu.ss,pu.ft --translits en,ur
```

Any static host works — GitHub Pages, Vercel, Netlify, or a folder behind
nginx. Nothing server-side is required.

## A note on the texts

This is scripture. The harness never rewrites, "corrects", or normalises the
words themselves — every translation and transliteration is stored exactly as
the upstream projects publish it, attributed to the person who made it. The
only text this project generates is the search index, and that is derived
mechanically and checked against the source.

## Credits

The corpus is the work of the [Khalis Foundation](https://khalisfoundation.org)
(BaniDB, SikhiToTheMax) and [Shabad OS](https://shabados.com), and of the
translators and scholars named in the `translators` table — Prof. Sahib Singh,
Manmohan Singh, Dr. Sant Singh Khalsa, the Faridkot Teeka commentators, and
the SikhNet team. This repository only reorganises their work for local study.

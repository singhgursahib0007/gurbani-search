# The app

A reading interface, mobile first, built from the iOS vocabulary: a tab bar,
inset grouped lists, sheets you can drag away, a navigation title that shrinks
as you scroll.

No framework and no build step — plain ES modules and CSS custom properties.
See [ARCHITECTURE](ARCHITECTURE.md#why-no-build-step-in-the-app) for why.

## Layout

```
app/
  index.html            the shell, the splash, the pre-paint theme script
  sw.js                 service worker: offline, caching strategies
  manifest.webmanifest  installable app metadata
  css/
    tokens.css          the design system: colour, type, spacing, four themes
    base.css            reset, typography, the Gurmukhi @font-face set
    components.css      navbar, tab bar, lists, sheets, switches, toasts
    search.css          the keyboard and result list
    reader.css          the reading surface
  js/
    main.js             routing, the tab bar, splash dismissal
    store.js            preferences and saved items, mirrored to localStorage
    data.js             one search interface over the API or the static index
    gurmukhi.js         letters, folding, keyboard layout
    banis-info.js       curated English names and grouping for all 104 banis
    ui.js               el(), sheets, switches, sliders, toasts, swipe
    icons.js            Phosphor icons, inlined
    views/
      banis.js          home: continue, starred, search, arrange
      search.js         the Gurmukhi keyboard and live results
      saved.js          kept lines, shabads and banis
      settings.js       every preference, gestures, reset
      reader.js         the reading surface
      typography.js     font, weight and size controls, shared by two screens
```

## Screens

**Banis** — the home screen. Continue reading, then starred banis, then the
catalogue. Searchable by English or Gurmukhi name, and arrangeable three ways:
by category (Nitnem · Popular · Vaars · Raags), A–Z, or ਅ–ੜ. The Gurmukhi sort
uses the Punjabi collation rather than codepoint order, so it follows the
varnmala — ੳ, then ਅ, then ੲ.

**Search** — the whole screen is the input. A Gurmukhi keyboard is pinned where
thumbs are, results fill the space above, and nothing is submitted: from the
third letter the list updates on every tap. Matching is always *anywhere in
the line*; offering "from the start" as a choice mostly made people pick wrong,
and anywhere is a superset.

**Saved** — kept lines, shabads and banis, grouped by kind because the three
are read differently. A kept line is a fragment you want to see in full, so it
gets a card; a kept bani is a door you walk back through, so it gets a row.

**Reader** — chrome hides as you scroll and returns on a tap. Every knob is in
one sheet.

## Gestures

Three, none of which announce themselves, so all three are written down in
Settings.

| Gesture | Does |
|---|---|
| **Swipe a line left** | uncovers a star; releasing opens the save sheet |
| **Tap the page** | hides the chrome, or brings it back |
| **Press and hold** | selects text, as it does anywhere else — deliberately left to the system |

The swipe shares the screen with vertical scrolling, so the first few pixels
decide who owns the touch: a mostly-vertical move hands it back to the
scroller and never takes it again for that touch. Past the threshold the pull
turns rubbery rather than stopping dead, and a small haptic fires at the point
it arms, so the commit is felt before the finger lifts.

## Preferences

All in `store.js`, mirrored to `localStorage` on every change, and applied as
CSS custom properties so a change repaints without a re-render.

- **Theme** — auto, light, sepia, dark, night
- **Gurmukhi font** — Sant Lipi, Mukta Mahee, Noto Sans, Anek
- **Weight** — regular, medium, bold
- **Sizes** — Gurbani, transliteration and translation, each independent
- **Alignment** — centred (default) or natural
- **Larivaar** — words joined, derived by removing spaces
- **Translations** — English, Manmohan Singh, Prof. Sahib Singh, attribution
- **Auto-scroll speed** — 9.5 to 119 px/s

Two resets: one restores appearance and keeps what you collected; the other
clears everything.

`DEFAULTS` carries a `prefsVersion`. When a default changes in a way existing
readers should inherit, bump it and migrate in `load()` — that is how centred
alignment reached people who already had the old default stored, without
overriding anyone who had since chosen otherwise.

## Reading position

`Continue` restores where you stopped, not just what you read.

Position is stored as **the index of the topmost visible line, not a pixel
offset**. Pixels stop meaning anything the moment type size, a translation
toggle or the font changes, all of which reflow the page. Tested by leaving
Japji part way, raising type size to 170% and reopening: the pixel offset
moved 5099 → 9051 and it landed on the same line.

Written while scrolling (throttled) and again when the reader is torn down, so
leaving is not a way to lose your place. Skipped when arriving from a search or
a saved line, since that destination is more specific. Only the fifty most
recent items are kept.

## Offline

A service worker precaches the shell — HTML, CSS, modules, the Gurmukhi face,
icons and `meta.json` — so the app opens with no network at all. Three
strategies by kind of request; see [DEPLOY](DEPLOY.md#offline).

## Things that will bite you

**`scrollTo({behavior: "auto"})` does not mean instant.** It means "use the CSS
`scroll-behavior`", which is `smooth` here for auto-scroll. Jumping to a line
switches smooth off around the assignment instead — which also works on Safari
versions predating `behavior: "instant"`.

**`requestAnimationFrame` never fires in a background tab.** Neither do scroll
events. Anything that must complete — dismissing the splash, jumping to a line
— runs on a timer, not a frame. A splash gated on rAF sits there until its
ceiling expires for anyone who opens a shared link in a background tab.

**`min-height: 100dvh` is not `height: 100dvh`.** With `min-height` the app
grows to its content, the *document* scrolls, and any handler listening to a
pane's scroll never fires. That is why the large title never collapsed until
it was fixed. Panes also need `min-height: 0` to shrink enough to scroll.

**`append()` stringifies `false`.** `el()` filters falsy children, but a bare
`node.append(a, cond && b)` will write the word "false" into the page.

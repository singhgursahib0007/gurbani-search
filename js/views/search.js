/* Search.
 *
 * The whole screen is the input. A Gurmukhi keyboard is pinned to the bottom
 * where thumbs are, results fill the space above, and nothing needs to be
 * submitted: from the third letter onwards the list updates on every tap.
 *
 * Results arrive as Gurmukhi immediately - that comes from the in-memory
 * index - and each card quietly fills in its transliteration and translation
 * once its shabad file arrives, so the list is never blank waiting on a
 * network round trip.
 */

import { el, clear, iconButton, tap, emptyState } from "../ui.js";
import { Icons } from "../icons.js";
import { KB_ROWS, A2U, LETTER_NAMES, toGurmukhi } from "../gurmukhi.js";
import { loadIndex, indexReady, search as runSearch, getShabad } from "../data.js";

const MIN_LETTERS = 3;      // results begin here, and update on every tap

/* A worked example, because "first letter of each word" is easy to say and
 * surprisingly easy to misread. Seeing one real line taken apart explains it
 * faster than any wording. This line is ang 681; its letters are distinctive
 * enough that the five shown here find it on their own. */
const EXAMPLE = {
  words: ["\u0a1c\u0a4b", "\u0a2e\u0a3e\u0a17\u0a39\u0a3f",
          "\u0a20\u0a3e\u0a15\u0a41\u0a30",
          "\u0a05\u0a2a\u0a41\u0a28\u0a47", "\u0a24\u0a47"],
  letters: ["\u0a1c", "\u0a2e", "\u0a20", "\u0a05", "\u0a24"],
};

/* A base letter plus the marks that belong to it: vowel signs, nasalisation,
 * nukta, addak, virama. */
const FIRST_CLUSTER =
  /^(.[\u0a01-\u0a03\u0a3c\u0a3e-\u0a4d\u0a51\u0a70\u0a71\u0a75]*)(.*)$/u;

export function searchView({ onOpenShabad }) {
  const root = el("div.screen.search-screen");

  let query = "";
  // Always "anywhere". Someone searching by first letters rarely knows
  // whether the phrase they remember is the start of the line, and offering
  // the choice only made them get it wrong. Matching anywhere is a superset,
  // so nothing is lost by not asking.
  const mode = "anywhere";

  /* ------------------------------------------------------------ query --- */
  const queryText = el("div.query-text.gur", {
    "data-placeholder": "Tap the first letter of each word",
    "aria-live": "polite",
  });
  const clearBtn = iconButton("xmark", "Clear", () => setQuery(""), "icon-btn plain");
  clearBtn.hidden = true;

  const queryBar = el("div.query-bar", {}, [queryText, clearBtn]);
  const hintText = el("span.txt");
  const hint = el("div.query-hint", {}, [hintText]);

  /* ---------------------------------------------------------- results --- */
  const results = el("div.results");

  /* --------------------------------------------------------- keyboard --- */
  const grid = el("div.kb-grid");
  KB_ROWS.forEach((row) => {
    row.forEach((ch) => {
      grid.append(el("button.key", {
        text: A2U[ch] || ch,
        "aria-label": LETTER_NAMES[ch] || ch,
        onclick: () => { tap(); setQuery(query + ch); },
      }));
    });
  });
  const utils = el("div.kb-utils", {}, [
    el("button.key.util", {
      text: "Clear", "aria-label": "Clear the query",
      onclick: () => { tap(); setQuery(""); },
    }),
    el("button.key.util.grow", {
      html: Icons.delete, "aria-label": "Delete the last letter",
      onclick: () => { tap(); setQuery(query.slice(0, -1)); },
    }),
  ]);
  const keyboard = el("div.keyboard", {}, [grid, utils]);

  root.append(queryBar, hint, results, keyboard);

  /* ------------------------------------------------------------ logic --- */
  function setQuery(next) {
    query = next;
    queryText.textContent = toGurmukhi(query);
    clearBtn.hidden = !query;
    run();
  }

  let runToken = 0;
  async function run() {
    const token = ++runToken;

    if (query.length === 0) {
      hintText.textContent = "";
      clear(results);
      results.append(introduction());
      return;
    }

    if (query.length < MIN_LETTERS) {
      const left = MIN_LETTERS - query.length;
      hintText.textContent = `${left} more letter${left > 1 ? "s" : ""} to search`;
      clear(results);
      results.append(emptyState("search", "Keep going",
        "Results appear once you have tapped three letters."));
      return;
    }

    if (!indexReady()) {
      await showLoading();
      if (token !== runToken) return;
    }

    const { total, rows, capped } = await runSearch(query, { mode, limit: 60 });
    if (token !== runToken) return;

    hintText.textContent = total === 0
      ? "No matches — try removing a letter"
      : `${capped ? "2000+" : total} result${total === 1 ? "" : "s"}` +
        (total > rows.length ? ` · first ${rows.length}` : "");

    clear(results);
    if (!total) {
      results.append(emptyState("search", "Nothing found",
        "Try fewer letters, or check their order."));
      return;
    }
    rows.forEach((row) => results.append(card(row)));
    enrich(results);
    results.scrollTop = 0;
  }

  /* Loading the index: honest progress, because it is a few megabytes. */
  async function showLoading() {
    clear(results);
    const fill = el("div.progress-fill");
    results.append(el("div.empty", {}, [
      el("div", { html: Icons.book }),
      el("h3", { text: "Preparing search" }),
      el("p", { text: "This happens once, then searching is instant and works offline." }),
      el("div.progress-track", {}, [fill]),
    ]));
    await loadIndex((frac) => { fill.style.width = `${Math.round(frac * 100)}%`; });
  }

  /* The opening screen: what to do, and one line showing what it looks like. */
  function introduction() {
    const line = el("div.eg-line.gur");
    EXAMPLE.words.forEach((word, i) => {
      // Highlight the whole first cluster - the letter together with any
      // matra sitting on it. Splitting after the bare consonant orphans the
      // vowel sign, and the browser draws it on a dotted circle of its own.
      const [, head, tail] = word.match(FIRST_CLUSTER) || [, word, ""];
      line.append(el("b", { text: head }));
      line.append(document.createTextNode(tail + " "));
      if (i === EXAMPLE.words.length - 1) line.append(document.createTextNode("…"));
    });

    const keys = el("div.eg-keys");
    EXAMPLE.letters.forEach((letter, i) => {
      if (i) keys.append(el("span.eg-arrow", { text: "\u203a" }));
      keys.append(el("span.eg-key.gur", { text: letter }));
    });

    return el("div.intro", {}, [
      el("div.intro-icon", { html: Icons.search }),
      el("h3", { text: "Find a shabad" }),
      el("p", { text: "Type the first letter of each word of the shabad." }),
      el("div.eg", {}, [
        el("div.eg-label", { text: "For example" }),
        line,
        el("div.eg-hint", { text: "tap these" }),
        keys,
      ]),
    ]);
  }

  /* A result card carries the line and how it sounds, and nothing else.
     The translation and the letter-by-letter match were noise: you are
     scanning for a line you already half-remember, not reading here. */
  function card(row) {
    return el("button.result", {
      dataset: { shabad: String(row.shabad_id), verse: String(row.verse_id) },
      onclick: () => { tap(); onOpenShabad(row.shabad_id, row.verse_id); },
    }, [
      el("div.gur", { text: row.gurmukhi }),
      el("div.tl"),
    ]);
  }

  /* Fill in transliteration and translation as cards scroll into view. */
  function enrich(container) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(async (e) => {
        if (!e.isIntersecting) return;
        const node = e.target;
        io.unobserve(node);
        if (node.dataset.filled) return;
        node.dataset.filled = "1";
        try {
          const d = await getShabad(+node.dataset.shabad);
          const v = (d.verses || []).find((x) => x.verse_id === +node.dataset.verse);
          if (!v) return;
          if (v.translit_en) node.querySelector(".tl").textContent = v.translit_en;
        } catch { /* a missing file must never break the list */ }
      });
    }, { root: container, rootMargin: "300px" });
    container.querySelectorAll(".result").forEach((n) => io.observe(n));
  }

  setQuery("");
  return { root, focus: () => {} };
}

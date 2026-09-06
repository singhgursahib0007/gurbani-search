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

import { el, clear, iconButton, tap, emptyState, segmented } from "../ui.js";
import { Icons } from "../icons.js";
import { KB_ROWS, A2U, LETTER_NAMES, toGurmukhi } from "../gurmukhi.js";
import { loadIndex, indexReady, search as runSearch, getShabad } from "../data.js";

const MIN_LETTERS = 3;      // results begin here, and update on every tap after

export function searchView({ onOpenShabad }) {
  const root = el("div.screen.search-screen");

  let query = "";
  let mode = "start";

  /* ------------------------------------------------------------ query --- */
  const queryText = el("div.query-text.gur", {
    "data-placeholder": "Tap the first letter of each word",
    "aria-live": "polite",
  });
  const clearBtn = iconButton("xmark", "Clear", () => setQuery(""), "icon-btn plain");
  clearBtn.hidden = true;

  const queryBar = el("div.query-bar", {}, [queryText, clearBtn]);
  const hintText = el("span.txt");
  const modeToggle = segmented(
    [{ value: "start", label: "From start" }, { value: "anywhere", label: "Anywhere" }],
    mode,
    (v) => { mode = v; run(); },
    { label: "Where the letters may appear" },
  );
  const hint = el("div.query-hint", {}, [hintText, modeToggle]);

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
      results.append(emptyState(
        "search", "Find a shabad",
        "Tap the first letter of each word you remember, in order."));
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
        "Check the order of the letters, or try matching anywhere in the line."));
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

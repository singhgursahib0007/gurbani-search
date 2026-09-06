/* Banis — the home screen.
 *
 * Ordered by what a reader is most likely to want next: carry on where they
 * left off, then the ones they starred, then everything else. Starring is a
 * single tap on the card itself, no menus. */

import { el, clear, tap, emptyState } from "../ui.js";
import { Icons } from "../icons.js";
import { store } from "../store.js";
import { getMeta } from "../data.js";

export function banisView({ onOpenBani, onContinue }) {
  const root = el("div.screen");
  const scroll = el("div.scroll.pad-tabbar");
  const navbar = el("div.navbar", {}, [
    el("div.navbar-row", {}, [el("div.navbar-title", { text: "Banis" })]),
    el("div.large-title", {}, [el("h1.t-large-title", { text: "Banis" })]),
  ]);
  root.append(navbar, scroll);

  scroll.addEventListener("scroll", () => {
    navbar.classList.toggle("scrolled", scroll.scrollTop > 12);
  }, { passive: true });

  let banis = [];

  (async () => {
    const meta = await getMeta();
    banis = meta.banis || [];
    render();
  })();

  store.subscribe((_s, keys) => {
    if (keys === "*" || keys.includes("favourites") || keys.includes("lastRead")) render();
  });

  function render() {
    const y = scroll.scrollTop;
    clear(scroll);
    const inner = el("div.container");

    /* continue reading */
    const last = store.get("lastRead");
    if (last && last.id != null) {
      const progress = store.getProgress(`${last.type}:${last.id}`);
      const started = progress && progress.line > 0;
      inner.append(el("div.section-label", { text: "Continue" }));
      inner.append(el("div.list", {}, [
        el("button.row", { onclick: () => onContinue(last) }, [
          el("div.row-icon.is-gold", { html: Icons.bookFill }),
          el("div.row-body", {}, [
            el("div.row-title", { text: last.title }),
            el("div.row-sub", {
              text: started ? "Pick up where you left off" : "Start reading",
            }),
          ]),
          el("div.row-trail", { html: Icons.chevronRight }),
        ]),
      ]));
    }

    /* favourites */
    const favIds = store.get("favourites");
    const favs = favIds.map((id) => banis.find((b) => b.bani_id === id)).filter(Boolean);
    if (favs.length) {
      inner.append(el("div.section-label", { text: "Your banis" }));
      const grid = el("div.card-grid");
      favs.forEach((b) => grid.append(baniCard(b)));
      inner.append(grid);
    }

    /* everything else */
    inner.append(el("div.section-label", {
      text: favs.length ? "All banis" : "Choose a bani",
    }));
    const rest = banis.filter((b) => !favIds.includes(b.bani_id));
    if (!rest.length && !favs.length) {
      inner.append(emptyState("book", "Loading banis…", ""));
    } else {
      inner.append(el("div.list", {},
        rest.map((b) => el("button.row", { onclick: () => onOpenBani(b.bani_id) }, [
          el("div.row-body", {}, [
            el("div.row-title.gur", { text: b.unicode || "",
                                      style: { fontSize: "1.15rem" } }),
            b.english && el("div.row-sub", { text: titleCase(b.english) }),
          ]),
          el("button.icon-btn.plain", {
            html: store.isFavourite(b.bani_id) ? Icons.starFill : Icons.star,
            "aria-label": `Star ${titleCase(b.english || "")}`,
            style: { color: store.isFavourite(b.bani_id) ? "var(--gold)" : "" },
            onclick: (e) => { e.stopPropagation(); tap(); store.toggleFavourite(b.bani_id); },
          }),
        ])),
      ));
    }

    scroll.append(inner);
    scroll.scrollTop = y;
  }

  function baniCard(b) {
    const starred = store.isFavourite(b.bani_id);
    return el("button.bani-card", { onclick: () => onOpenBani(b.bani_id) }, [
      el("div.gur", { text: b.unicode || "" }),
      el("div.en", { text: titleCase(b.english || "") }),
      el("button", {
        class: `star ${starred ? "on" : ""}`,
        html: starred ? Icons.starFill : Icons.star,
        "aria-label": starred ? "Remove from your banis" : "Add to your banis",
        onclick: (e) => { e.stopPropagation(); tap(); store.toggleFavourite(b.bani_id); },
      }),
    ]);
  }

  return { root };
}

/* Bani names arrive romanised in mixed case ("Ma(N)Tr"). Lower-casing first
 * and capitalising only the opening letter of each word reads far better:
 * "Gur Ma(n)tr" rather than "Gur Ma(N)Tr". */
export const titleCase = (s) =>
  (s || "").toLowerCase().replace(
    // Capitalise at a word start, and after an opening bracket that itself
    // begins a word - so "ma(n)tr" keeps its lower-case n, while
    // "(sraavag su'dh)" gets its capital.
    /(^|\s)(\(?)([a-z])/g,
    (_, pre, bracket, ch) => pre + bracket + ch.toUpperCase());

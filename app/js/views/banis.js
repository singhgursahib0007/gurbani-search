/* Banis — the home screen.
 *
 * A hundred and four entries is too many to scroll blindly, so the list can be
 * filtered by name and arranged three ways. Category is the default because it
 * answers the question people actually arrive with: what do I read today. The
 * two alphabetical orders are for when you already know the name.
 *
 * Starred banis stay pinned above whatever arrangement is chosen - a shortcut
 * should not move around.
 */

import { el, clear, tap, emptyState, sheet, iconButton } from "../ui.js";
import { Icons } from "../icons.js";
import { store } from "../store.js";
import { getMeta } from "../data.js";
import { BANI_INFO, GROUPS, baniName, baniGroup } from "../banis-info.js";

const SORTS = [
  { id: "category", label: "By category", sub: "Nitnem first, then the rest" },
  { id: "english",  label: "A – Z",   sub: "By English name" },
  { id: "gurmukhi", label: "ਅ – ੜ", sub: "By Gurmukhi name" },
];

export function banisView({ onOpenBani, onContinue }) {
  const root = el("div.screen");
  const scroll = el("div.scroll.pad-tabbar");

  let banis = [];
  let query = "";
  let sortBy = store.get("baniSort") || "category";

  /* --- chrome ---------------------------------------------------------- */
  const sortBtn = el("button.chip-btn", {
    onclick: () => { tap(); openSort(); },
  }, [
    el("span", { html: Icons.sliders, style: { display: "flex" } }),
    el("span.sort-name", { text: sortLabel() }),
  ]);

  const field = el("input.field-input", {
    type: "search", placeholder: "Search banis", autocomplete: "off",
    "aria-label": "Search banis by name",
    oninput: (e) => { query = e.target.value.trim(); render(); },
  });
  const clearBtn = iconButton("xmark", "Clear", () => {
    field.value = ""; query = ""; render(); field.focus();
  }, "icon-btn plain field-clear");

  const toolbar = el("div.toolbar", {}, [
    el("div.field", {}, [
      el("span.field-icon", { html: Icons.search }),
      field,
      clearBtn,
    ]),
    sortBtn,
  ]);

  const navbar = el("div.navbar", {}, [
    el("div.navbar-row", {}, [el("div.navbar-title", { text: "Banis" })]),
    el("div.large-title", {}, [el("h1.t-large-title", { text: "Banis" })]),
    toolbar,
  ]);
  root.append(navbar, scroll);
  scroll.addEventListener("scroll", () => {
    navbar.classList.toggle("scrolled", scroll.scrollTop > 12);
  }, { passive: true });

  (async () => {
    banis = (await getMeta()).banis || [];
    render();
  })();

  store.subscribe((_s, keys) => {
    if (keys === "*" || keys.includes("favourites") || keys.includes("lastRead")) {
      render();
    }
  });

  function sortLabel() {
    return (SORTS.find((s) => s.id === sortBy) || SORTS[0]).label;
  }

  function openSort() {
    sheet("Arrange", (body, { close }) => {
      body.append(el("div.list", {}, SORTS.map((s) =>
        el("button.row", {
          onclick: () => {
            sortBy = s.id;
            store.set("baniSort", s.id);
            sortBtn.querySelector(".sort-name").textContent = sortLabel();
            close();
            render();
          },
        }, [
          el("div.row-body", {}, [
            el("div.row-title", { text: s.label }),
            el("div.row-sub", { text: s.sub }),
          ]),
          el("div.row-trail", {
            html: s.id === sortBy ? Icons.check : "",
            style: { color: "var(--accent)" },
          }),
        ]))));
    });
  }

  /* --- rendering -------------------------------------------------------- */
  function matches(b) {
    if (!query) return true;
    const q = query.toLowerCase();
    return baniName(b).toLowerCase().includes(q) ||
           (b.unicode || "").includes(query) ||
           (b.english || "").toLowerCase().includes(q);
  }

  const byEnglish = (a, b) => baniName(a).localeCompare(baniName(b), "en");
  const byGurmukhi = (a, b) =>
    (a.unicode || "").localeCompare(b.unicode || "", "pa");

  function render() {
    const y = scroll.scrollTop;
    clear(scroll);
    clearBtn.hidden = !query;
    const inner = el("div.container");
    const visible = banis.filter(matches);

    /* Searching collapses everything to one flat list of hits. */
    if (query) {
      if (!visible.length) {
        inner.append(emptyState("search", "No bani by that name",
          "Try part of the name, like “sukhmani” or “vaar”."));
      } else {
        inner.append(el("div.section-label", {
          text: `${visible.length} ${visible.length === 1 ? "bani" : "banis"}`,
        }));
        inner.append(el("div.list", {}, visible.sort(byEnglish).map(row)));
      }
      scroll.append(inner);
      return;
    }

    /* Continue reading */
    const last = store.get("lastRead");
    if (last && last.id != null) {
      const progress = store.getProgress(`${last.type}:${last.id}`);
      inner.append(el("div.section-label", { text: "Continue" }));
      inner.append(el("div.list", {}, [
        el("button.row", { onclick: () => onContinue(last) }, [
          el("div.row-icon.is-gold", { html: Icons.bookFill }),
          el("div.row-body", {}, [
            el("div.row-title", { text: last.title }),
            el("div.row-sub", {
              text: progress && progress.line > 0
                ? "Pick up where you left off" : "Start reading",
            }),
          ]),
          el("div.row-trail", { html: Icons.chevronRight }),
        ]),
      ]));
    }

    /* Starred, pinned above whatever arrangement is chosen */
    const favIds = store.get("favourites");
    const favs = favIds.map((id) => banis.find((b) => b.bani_id === id))
                       .filter(Boolean);
    if (favs.length) {
      inner.append(el("div.section-label", { text: "Your banis" }));
      const grid = el("div.card-grid");
      favs.forEach((b) => grid.append(card(b)));
      inner.append(grid);
    }

    const rest = visible.filter((b) => !favIds.includes(b.bani_id));

    if (sortBy === "category") {
      GROUPS.forEach((g) => {
        const items = rest.filter((b) => baniGroup(b) === g.id);
        if (!items.length) return;
        inner.append(el("div.section-label", { text: g.label }));
        inner.append(el("div.list", {}, items.map(row)));
      });
    } else {
      const sorted = [...rest].sort(sortBy === "gurmukhi" ? byGurmukhi : byEnglish);
      inner.append(el("div.section-label", {
        text: sortBy === "gurmukhi" ? "All banis · ਅ – ੜ"
                                    : "All banis · A – Z",
      }));
      inner.append(el("div.list", {}, sorted.map(row)));
    }

    scroll.append(inner);
    scroll.scrollTop = y;
  }

  function row(b) {
    const starred = store.isFavourite(b.bani_id);
    return el("button.row", { onclick: () => onOpenBani(b.bani_id) }, [
      el("div.row-body", {}, [
        el("div.row-title.gur", {
          text: b.unicode || "", style: { fontSize: "1.15rem" },
        }),
        el("div.row-sub", { text: baniName(b) }),
      ]),
      el("button.icon-btn.plain", {
        html: starred ? Icons.starFill : Icons.star,
        "aria-label": starred ? `Unstar ${baniName(b)}` : `Star ${baniName(b)}`,
        style: { color: starred ? "var(--gold)" : "" },
        onclick: (e) => {
          e.stopPropagation(); tap(); store.toggleFavourite(b.bani_id);
        },
      }),
    ]);
  }

  function card(b) {
    const starred = store.isFavourite(b.bani_id);
    return el("button.bani-card", { onclick: () => onOpenBani(b.bani_id) }, [
      el("div.gur", { text: b.unicode || "" }),
      el("div.en", { text: baniName(b) }),
      el("button", {
        class: `star ${starred ? "on" : ""}`,
        html: starred ? Icons.starFill : Icons.star,
        "aria-label": starred ? "Remove from your banis" : "Add to your banis",
        onclick: (e) => {
          e.stopPropagation(); tap(); store.toggleFavourite(b.bani_id);
        },
      }),
    ]);
  }

  return { root };
}

export { baniName as titleCase };

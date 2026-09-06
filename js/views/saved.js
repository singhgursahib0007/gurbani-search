/* Saved — lines, shabads and banis the reader chose to keep.
 *
 * Grouped by kind rather than mixed by date, because the three are read
 * differently: a kept line is a fragment you want to see in full, while a
 * kept shabad or bani is a door you walk back through. So lines get cards
 * showing the words, and the rest get list rows.
 */

import { el, clear, tap, emptyState, toast } from "../ui.js";
import { Icons } from "../icons.js";
import { store } from "../store.js";

export function savedView({ onOpen }) {
  const root = el("div.screen");
  const scroll = el("div.scroll.pad-tabbar");
  const navbar = el("div.navbar", {}, [
    el("div.navbar-row", {}, [el("div.navbar-title", { text: "Saved" })]),
    el("div.large-title", {}, [el("h1.t-large-title", { text: "Saved" })]),
  ]);
  root.append(navbar, scroll);
  scroll.addEventListener("scroll", () => {
    navbar.classList.toggle("scrolled", scroll.scrollTop > 12);
  }, { passive: true });

  render();
  store.subscribe((_s, keys) => {
    if (keys === "*" || keys.includes("saved")) render();
  });

  function remove(item) {
    tap();
    store.toggleSaved(item);
    toast("Removed", {
      action: "Undo",
      onAction: () => store.toggleSaved(item),
    });
  }

  function render() {
    const y = scroll.scrollTop;
    clear(scroll);
    const items = store.get("saved");
    const inner = el("div.container");

    if (!items.length) {
      inner.append(emptyState(
        "bookmark", "Nothing saved yet",
        "Swipe a line left while reading to keep it, " +
        "or tap the bookmark to keep the whole shabad."));
      scroll.append(inner);
      return;
    }

    const lines = items.filter((i) => i.type === "line");
    const shabads = items.filter((i) => i.type === "shabad");
    const banis = items.filter((i) => i.type === "bani");

    if (lines.length) {
      inner.append(el("div.section-label", { text: "Lines" }));
      lines.forEach((it) => inner.append(lineCard(it)));
    }

    if (shabads.length) {
      inner.append(el("div.section-label", { text: "Shabads" }));
      inner.append(el("div.list", {}, shabads.map((it) => row(it, "bookFill"))));
    }

    if (banis.length) {
      inner.append(el("div.section-label", { text: "Banis" }));
      inner.append(el("div.list", {}, banis.map((it) => row(it, "bookFill"))));
    }

    scroll.append(inner);
    scroll.scrollTop = y;
  }

  /* A kept line, shown in full and opening the shabad at that exact line. */
  function lineCard(it) {
    return el("button.saved-line", {
      onclick: () => { tap(); onOpen(it); },
    }, [
      el("div.gur", { text: it.gurmukhi || "" }),
      it.translit && el("div.tl", { text: it.translit }),
      it.en && el("div.en", { text: it.en }),
      it.where && el("div.where", { text: it.where }),
      el("span.drop", {
        html: Icons.xmark, role: "button", "aria-label": "Remove",
        onclick: (e) => { e.stopPropagation(); remove(it); },
      }),
    ].filter(Boolean));
  }

  function row(it, iconName) {
    return el("button.row", { onclick: () => { tap(); onOpen(it); } }, [
      el("div.row-icon.is-gold", { html: Icons[iconName] }),
      el("div.row-body", {}, [
        it.gurmukhi
          ? el("div.row-title.gur", {
              text: it.title || it.gurmukhi,
              style: { fontSize: "1.1rem" },
            })
          : el("div.row-title", { text: it.title || "" }),
        el("div.row-sub", { text: it.subtitle || it.gurmukhi || "" }),
      ]),
      el("span.icon-btn.plain", {
        html: Icons.xmark, role: "button", "aria-label": "Remove",
        onclick: (e) => { e.stopPropagation(); remove(it); },
      }),
    ]);
  }

  return { root };
}

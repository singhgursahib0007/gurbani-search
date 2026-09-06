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
      shabads.forEach((it) => inner.append(shabadCard(it)));
    }

    if (banis.length) {
      inner.append(el("div.section-label", { text: "Banis" }));
      inner.append(el("div.list", {}, banis.map(baniRow)));
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

  /* A kept shabad is shown by its line, not by its ang.
     "Ang 681" is where it lives, not what it is - and the raag heading it
     used to show opens hundreds of shabads. The line the reader searched for
     is the only part they will recognise, so that is the heading, and the
     reference goes underneath. */
  function shabadCard(it) {
    const where = [it.title, it.subtitle].filter(Boolean).join(" · ");
    return el("button.saved-line.is-shabad", {
      onclick: () => { tap(); onOpen(it); },
    }, [
      el("div.gur", { text: it.gurmukhi || it.title || "" }),
      where && el("div.where", {}, [
        el("span", { html: Icons.bookFill, style: { display: "inline-flex" } }),
        el("span", { text: where }),
      ]),
      el("span.drop", {
        html: Icons.xmark, role: "button", "aria-label": "Remove",
        onclick: (e) => { e.stopPropagation(); remove(it); },
      }),
    ].filter(Boolean));
  }

  function baniRow(it) {
    return el("button.row", { onclick: () => { tap(); onOpen(it); } }, [
      el("div.row-icon.is-gold", { html: Icons.bookFill }),
      el("div.row-body", {}, [
        el("div.row-title.gur", {
          text: it.title || "", style: { fontSize: "1.1rem" },
        }),
        it.subtitle && el("div.row-sub", { text: it.subtitle }),
      ].filter(Boolean)),
      el("span.icon-btn.plain", {
        html: Icons.xmark, role: "button", "aria-label": "Remove",
        onclick: (e) => { e.stopPropagation(); remove(it); },
      }),
    ]);
  }

  return { root };
}

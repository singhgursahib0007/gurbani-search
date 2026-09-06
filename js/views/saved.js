/* Saved — shabads and banis the reader bookmarked, newest first. */

import { el, clear, tap, emptyState } from "../ui.js";
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

  function render() {
    clear(scroll);
    const items = store.get("saved");
    const inner = el("div.container");

    if (!items.length) {
      inner.append(emptyState("bookmark", "Nothing saved yet",
        "Tap the bookmark while reading to keep a shabad here."));
      scroll.append(inner);
      return;
    }

    inner.append(el("div.list", {}, items.map((it) =>
      el("button.row", { onclick: () => onOpen(it) }, [
        el("div.row-icon.is-gold", { html: Icons.bookmarkFill }),
        el("div.row-body", {}, [
          it.gurmukhi && el("div.row-title.gur", {
            text: it.gurmukhi, style: { fontSize: "1.1rem" },
          }),
          el("div.row-sub", { text: it.title || "" }),
        ]),
        el("button.icon-btn.plain", {
          html: Icons.xmark, "aria-label": "Remove",
          onclick: (e) => { e.stopPropagation(); tap(); store.toggleSaved(it); },
        }),
      ]))));

    scroll.append(inner);
  }

  return { root };
}

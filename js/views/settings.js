/* Settings — the same knobs as the reading sheet, plus the destructive ones.
 *
 * Two kinds of reset, kept apart on purpose: one puts the appearance back to
 * default, the other also clears what the reader collected. */

import { el, clear, switchRow, sliderRow, segmented, tap, sheet } from "../ui.js";
import { Icons } from "../icons.js";
import { store, DEFAULTS } from "../store.js";
import { textControls } from "./typography.js";

const THEMES = [
  { value: "auto", label: "Auto" }, { value: "light", label: "Light" },
  { value: "sepia", label: "Sepia" }, { value: "dark", label: "Dark" },
  { value: "night", label: "Night" },
];

export function settingsView() {
  const root = el("div.screen");
  const scroll = el("div.scroll.pad-tabbar");
  const navbar = el("div.navbar", {}, [
    el("div.navbar-row", {}, [el("div.navbar-title", { text: "Settings" })]),
    el("div.large-title", {}, [el("h1.t-large-title", { text: "Settings" })]),
  ]);
  root.append(navbar, scroll);
  scroll.addEventListener("scroll", () => {
    navbar.classList.toggle("scrolled", scroll.scrollTop > 12);
  }, { passive: true });

  render();
  store.subscribe((_s, keys) => { if (keys === "*") render(); });

  function render() {
    clear(scroll);
    const inner = el("div.container");

    inner.append(el("div.section-label", { text: "Appearance" }));
    inner.append(el("div.list", {}, [
      el("div", { style: { padding: "var(--s-3) var(--s-4)" } }, [
        el("div.t-subhead", { text: "Theme", style: { marginBottom: "var(--s-2)" } }),
        segmented(THEMES, store.get("theme"),
          (v) => store.set("theme", v), { label: "Theme" }),
      ]),
    ]));

    inner.append(...textControls());

    inner.append(el("div.section-label", { text: "Show with each line" }));
    inner.append(el("div.list", {}, [
      switchRow("Transliteration", store.get("transliteration"),
        (v) => store.set("transliteration", v), { iconName: "textSize" }),
      switchRow("English", store.get("translationEn"),
        (v) => store.set("translationEn", v), { iconName: "book" }),
      switchRow("English · Manmohan Singh", store.get("translationEnAlt"),
        (v) => store.set("translationEnAlt", v), { iconName: "book" }),
      switchRow("Punjabi · Prof. Sahib Singh", store.get("translationPa"),
        (v) => store.set("translationPa", v), { iconName: "book", gold: true }),
      switchRow("Name the translator", store.get("showAttribution"),
        (v) => store.set("showAttribution", v), { iconName: "info" }),
      switchRow("Larivaar", store.get("larivaar"),
        (v) => store.set("larivaar", v),
        { sub: "Words joined, as in the original", iconName: "alignLeft" }),
    ]));

    inner.append(el("div.section-label", { text: "Gestures" }));
    inner.append(el("div.list", {}, [
      el("div.row", {}, [
        el("div.row-icon.is-gold", { html: Icons.handSwipeLeft || Icons.starFill }),
        el("div.row-body", {}, [
          el("div.row-title", { text: "Swipe a line left to save it" }),
          el("div.row-sub", { text: "Kept lines appear under Saved" }),
        ]),
      ]),
      el("div.row", {}, [
        el("div.row-icon", { html: Icons.bookmarkFill }),
        el("div.row-body", {}, [
          el("div.row-title", { text: "Tap the bookmark to save a whole shabad" }),
          el("div.row-sub", { text: "It is kept against the line you opened it at" }),
        ]),
      ]),
      el("div.row", {}, [
        el("div.row-icon", { html: Icons.eye }),
        el("div.row-body", {}, [
          el("div.row-title", { text: "Tap the page to hide the controls" }),
          el("div.row-sub", { text: "Tap again to bring them back" }),
        ]),
      ]),
    ]));

    inner.append(el("div.section-label", { text: "Reset" }));
    inner.append(el("div.list", {}, [
      el("button.row", {
        onclick: () => { store.reset(); tap(14); },
      }, [
        el("div.row-icon", { html: Icons.reset }),
        el("div.row-body", {}, [
          el("div.row-title", { text: "Reset appearance" }),
          el("div.row-sub", { text: "Keeps your banis and saved shabads" }),
        ]),
      ]),
      el("button.row", { onclick: confirmWipe }, [
        el("div.row-icon", { html: Icons.xmark,
                             style: { background: "rgba(220,60,60,.12)", color: "#D9483B" } }),
        el("div.row-body", {}, [
          el("div.row-title", { text: "Reset everything", style: { color: "#D9483B" } }),
          el("div.row-sub", { text: "Also clears your banis and saved shabads" }),
        ]),
      ]),
    ]));

    inner.append(el("div.section-label", { text: "About" }));
    inner.append(el("div.list", {}, [
      el("div.row", {}, [
        el("div.row-icon.is-gold", { html: Icons.heart }),
        el("div.row-body", {}, [
          el("div.row-title", { text: "Made by Gursahib Singh" }),
          el("div.row-sub", { text: "Gurbani, for reading anywhere" }),
        ]),
      ]),
      el("a.row", {
        href: "mailto:gursahib99888@gmail.com?subject=" +
              encodeURIComponent("Gurbani app"),
        style: { color: "inherit", textDecoration: "none" },
      }, [
        el("div.row-icon", { html: Icons.envelope }),
        el("div.row-body", {}, [
          el("div.row-title", { text: "Contact" }),
          el("div.row-sub", { text: "gursahib99888@gmail.com" }),
        ]),
        el("div.row-trail", { html: Icons.chevronRight }),
      ]),
    ]));

    inner.append(el("p.t-footnote.dim2", {
      style: { padding: "var(--s-2) var(--s-5) var(--s-8)", textAlign: "center",
               lineHeight: "1.6" },
      html: "Your preferences stay on this device.<br>" +
            "Gurbani text and translations by the Khalis Foundation " +
            "and the translators named above.",
    }));

    scroll.append(inner);
  }

  function confirmWipe() {
    sheet("Reset everything?", (body, { close }) => {
      body.append(el("p.t-subhead.dim", {
        style: { padding: "0 var(--s-5) var(--s-4)" },
        text: "Your starred banis, saved shabads and all preferences will be cleared. This cannot be undone.",
      }));
      body.append(el("div.list", {}, [
        el("button.row", {
          onclick: () => { store.resetEverything(); tap(20); close(); },
        }, [el("div.row-body", {}, [
          el("div.row-title", { text: "Reset everything", style: { color: "#D9483B" } }),
        ])]),
        el("button.row", { onclick: close }, [
          el("div.row-body", {}, [el("div.row-title", { text: "Cancel" })]),
        ]),
      ]));
    });
  }

  return { root };
}

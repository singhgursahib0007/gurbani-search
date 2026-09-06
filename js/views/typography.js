/* Typography controls.
 *
 * Built once and used in two places - the reading sheet and Settings - so the
 * two can never drift apart. Every control writes straight to the store, and
 * because the store applies CSS variables on change, the page underneath
 * updates while the sheet is still open. You choose a font by watching the
 * Gurbani change, not by guessing from a name.
 */

import { el, segmented, sliderRow, tap } from "../ui.js";
import { Icons } from "../icons.js";
import { store, FONTS, WEIGHTS } from "../store.js";

const pct = (v) => `${Math.round(v * 100)}%`;

/** The font picker: each row is set in the face it offers. */
export function fontPicker() {
  const list = el("div.list");
  FONTS.forEach((f) => {
    const check = el("span", {
      html: Icons.check,
      style: { display: "flex", color: "var(--accent)",
               visibility: store.get("gurFont") === f.value ? "visible" : "hidden" },
    });
    const row = el("button.row", {
      onclick: () => {
        tap();
        store.set("gurFont", f.value);
        [...list.children].forEach((r, i) => {
          r.querySelector(".check").style.visibility =
            FONTS[i].value === f.value ? "visible" : "hidden";
        });
      },
    }, [
      el("div.row-body", {}, [
        // The sample is the point of the row: it shows the actual letterforms.
        el("div.gur", {
          text: "ਸਤਿ ਨਾਮੁ",
          style: { fontFamily: `"${f.value}"`, fontSize: "1.35rem",
                   lineHeight: "1.6" },
        }),
        el("div.row-sub", { text: `${f.label} · ${f.note}` }),
      ]),
      el("div.row-trail", {}, [Object.assign(check, { className: "check" })]),
    ]);
    list.append(row);
  });
  return list;
}

/** Weight, the three sizes, and alignment. */
export function textControls() {
  return [
    el("div.section-label", { text: "Gurbani" }),
    fontPicker(),
    el("div.list", {}, [
      el("div", { style: { padding: "var(--s-3) var(--s-4)" } }, [
        el("div.t-subhead", { text: "Weight",
                              style: { marginBottom: "var(--s-2)" } }),
        segmented(WEIGHTS, store.get("gurWeight"),
          (v) => store.set("gurWeight", v), { label: "Gurbani weight" }),
      ]),
      sliderRow({
        label: "Gurbani size", min: 0.85, max: 1.9, step: 0.05,
        value: store.get("textScale"), format: pct,
        onInput: (v) => store.set("textScale", v),
      }),
      el("div", { style: { padding: "var(--s-3) var(--s-4)" } }, [
        el("div.t-subhead", { text: "Alignment",
                              style: { marginBottom: "var(--s-2)" } }),
        segmented(
          [{ value: "start", label: "Natural", icon: "alignRight" },
           { value: "center", label: "Centred", icon: "alignCenter" }],
          store.get("align"), (v) => store.set("align", v), { label: "Alignment" }),
      ]),
    ]),

    el("div.section-label", { text: "Everything else" }),
    el("div.list", {}, [
      sliderRow({
        label: "Transliteration size", min: 0.7, max: 1.6, step: 0.05,
        value: store.get("translitScale"), format: pct,
        onInput: (v) => store.set("translitScale", v),
      }),
      sliderRow({
        label: "Translation size", min: 0.7, max: 1.6, step: 0.05,
        value: store.get("translationScale"), format: pct,
        onInput: (v) => store.set("translationScale", v),
      }),
    ]),
  ];
}

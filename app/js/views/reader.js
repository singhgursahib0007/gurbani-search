/* The reader.
 *
 * One screen, two sources (a bani or a shabad), normalised to the same shape
 * so the rendering code has no idea which it is showing.
 *
 * The chrome hides itself as you scroll down and returns when you scroll up or
 * tap, which is the behaviour people already know from Books and Safari. Every
 * preference applies live: changing type size or a translation from the sheet
 * re-renders the lines underneath while the sheet is still open.
 */

import { el, clear, iconButton, sheet, segmented, sliderRow, switchRow, tap } from "../ui.js";
import { Icons } from "../icons.js";
import { store, DEFAULTS } from "../store.js";
import { getBani, getShabad, toLarivaar } from "../data.js";
import { textControls } from "./typography.js";
import { titleCase } from "./banis.js";

const THEMES = [
  { value: "auto",  label: "Auto",  bg: "linear-gradient(135deg,#fff 50%,#0C1524 50%)", fg: "#7FA8E8" },
  { value: "light", label: "Light", bg: "#FFFFFF", fg: "#12294B" },
  { value: "sepia", label: "Sepia", bg: "#FBF4E6", fg: "#3B2E1B" },
  { value: "dark",  label: "Dark",  bg: "#0C1524", fg: "#EEF3FA" },
  { value: "night", label: "Night", bg: "#000000", fg: "#C8D2E0" },
];

export function readerView({ type, id }, { onBack }) {
  const root = el("div.reader");
  const scroller = el("div.reader-scroll");
  const inner = el("div.reader-inner");
  scroller.append(inner);

  const progress = el("div.reader-progress");
  const title = el("div.reader-title", {}, [el("div.t1", { text: "" })]);
  const saveBtn = iconButton("bookmark", "Save", () => toggleSave());
  const bar = el("div.reader-bar", {}, [
    el("div.navbar-row", {}, [
      iconButton("chevronLeft", "Back", onBack),
      title,
      saveBtn,
    ]),
    progress,
  ]);

  const optionsFab = el("button.fab", {
    html: Icons.sliders, "aria-label": "Reading options",
    onclick: () => { tap(); openOptions(); },
  });
  const scrollFab = el("button.fab.is-gold", {
    html: Icons.play, "aria-label": "Start auto-scroll",
    onclick: () => { tap(); toggleAuto(); },
  });
  const fabs = el("div.reader-fabs", {}, [optionsFab, scrollFab]);

  root.append(bar, scroller, fabs);

  let record = null;      // {title, subtitle, lines:[…]}
  let speedPill = null;

  /* ---------------------------------------------------------- loading -- */
  inner.append(el("div.empty", {}, [el("div", { html: Icons.book }),
                                    el("h3", { text: "Opening…" })]));

  (async () => {
    record = type === "bani" ? normaliseBani(await getBani(id))
                             : normaliseShabad(await getShabad(id));
    title.firstChild.textContent = record.title;
    store.set("lastRead", { type, id, title: record.title, at: Date.now() });
    render();
    // Bar height varies with the notch, so measure rather than assume.
    requestAnimationFrame(() => {
      scroller.style.paddingTop = bar.offsetHeight + "px";
    });
  })();

  /* --------------------------------------------------------- rendering -- */
  function render() {
    if (!record) return;
    const p = store.all;
    clear(inner);

    inner.append(el("header", { style: { padding: "var(--s-6) 0 var(--s-4)" } }, [
      el("h1.t-large-title.gur", { text: record.gurTitle || record.title }),
      record.subtitle && el("p.t-subhead.dim", {
        text: record.subtitle, style: { marginTop: "var(--s-2)" },
      }),
    ]));

    record.lines.forEach((line, i) => {
      const box = el(`div.line${line.isHeader ? ".is-header" : ""}`, {
        dataset: { i: String(i) },
        onclick: (e) => {
          // Tapping a line marks your place; tapping the page toggles chrome.
          e.stopPropagation();
          box.classList.toggle("is-active");
        },
      });
      // append() would stringify a `false`, so every optional node is
      // filtered out before it reaches the DOM.
      const add = (...nodes) => box.append(...nodes.filter(Boolean));

      add(el("div.gur", {
        text: p.larivaar ? toLarivaar(line.gurmukhi) : line.gurmukhi,
      }));
      if (p.transliteration && line.translit)
        add(el("div.tl", { text: line.translit }));
      if (p.translationEn && line.en)
        add(el("div.tr", { text: line.en }),
            p.showAttribution && el("div.who", { text: "English" }));
      if (p.translationEnAlt && line.enAlt)
        add(el("div.tr", { text: line.enAlt }),
            p.showAttribution && el("div.who", { text: "Manmohan Singh" }));
      if (p.translationPa && line.pa)
        add(el("div.tr.pa.gur", { text: line.pa }),
            p.showAttribution && el("div.who", { text: "Prof. Sahib Singh" }));
      inner.append(box);
    });

    updateSaveIcon();
  }

  store.subscribe((_s, keys) => {
    if (keys === "*" || ["larivaar", "transliteration", "translationEn",
      "translationEnAlt", "translationPa", "showAttribution"].some((k) => keys.includes(k))) {
      const y = scroller.scrollTop;
      render();
      scroller.scrollTop = y;
    }
  });

  /* ------------------------------------------------------- chrome & scroll */
  let lastY = 0, hidden = false;
  scroller.addEventListener("scroll", () => {
    const y = scroller.scrollTop;
    const max = scroller.scrollHeight - scroller.clientHeight;
    progress.style.width = max > 0 ? `${(y / max) * 100}%` : "0";

    if (Math.abs(y - lastY) > 6) {
      const goingDown = y > lastY && y > 80;
      if (goingDown !== hidden) {
        hidden = goingDown;
        bar.classList.toggle("hidden", hidden);
        fabs.classList.toggle("hidden", hidden && !auto);
      }
      lastY = y;
    }
  }, { passive: true });

  scroller.addEventListener("click", () => {
    if (!hidden) return;
    hidden = false;
    bar.classList.remove("hidden");
    fabs.classList.remove("hidden");
  });

  /* ----------------------------------------------------------- autoscroll */
  let auto = false, rafId = null, carry = 0, lastT = 0;

  function toggleAuto() {
    auto ? stopAuto() : startAuto();
  }

  function startAuto() {
    auto = true;
    scrollFab.innerHTML = Icons.pause;
    scrollFab.classList.add("is-on");
    scrollFab.setAttribute("aria-label", "Pause auto-scroll");
    scroller.classList.add("no-smooth");
    showSpeedPill();
    lastT = performance.now();
    carry = 0;
    const step = (t) => {
      if (!auto) return;
      const dt = Math.min(64, t - lastT);
      lastT = t;
      // Maps the 5‒100 slider onto 9.5‒119 px per second. The slow end is
      // unchanged - it was right for reading along - while the top end is
      // about a quarter faster, for skimming to a remembered line.
      const pxPerSec = 3.75 + 1.15 * store.get("autoScrollSpeed");
      carry += (pxPerSec * dt) / 1000;
      const whole = Math.floor(carry);
      if (whole >= 1) {
        carry -= whole;
        const before = scroller.scrollTop;
        scroller.scrollTop = before + whole;
        if (scroller.scrollTop === before) { stopAuto(); return; }  // reached the end
      }
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
  }

  function stopAuto() {
    auto = false;
    cancelAnimationFrame(rafId);
    scrollFab.innerHTML = Icons.play;
    scrollFab.classList.remove("is-on");
    scrollFab.setAttribute("aria-label", "Start auto-scroll");
    scroller.classList.remove("no-smooth");
    hideSpeedPill();
  }

  function showSpeedPill() {
    if (speedPill) return;
    speedPill = el("div.speed-pill", {}, [
      el("span", { html: Icons.scroll, style: { display: "flex" } }),
      el("input.slider", {
        type: "range", min: 5, max: 100, step: 1,
        value: store.get("autoScrollSpeed"),
        "aria-label": "Auto-scroll speed",
        oninput: (e) => store.set("autoScrollSpeed", Number(e.target.value)),
      }),
    ]);
    document.body.append(speedPill);
  }
  function hideSpeedPill() { speedPill?.remove(); speedPill = null; }

  /* ---------------------------------------------------------- saving ---- */
  function toggleSave() {
    if (!record) return;
    tap();
    store.toggleSaved({
      id: `${type}:${id}`, type, refId: id,
      title: record.title, gurmukhi: record.lines[0]?.gurmukhi || "",
    });
    updateSaveIcon();
  }
  function updateSaveIcon() {
    const on = store.isSaved(`${type}:${id}`);
    saveBtn.innerHTML = on ? Icons.bookmarkFill : Icons.bookmark;
    saveBtn.style.color = on ? "var(--gold)" : "";
  }

  /* --------------------------------------------------------- options ---- */
  function openOptions() {
    sheet("Reading", (body) => {
      /* theme swatches */
      body.append(el("div.section-label", { text: "Appearance" }));
      const sw = el("div.swatches", { style: { padding: "0 var(--s-4) var(--s-4)" } });
      THEMES.forEach((t) => {
        const b = el("button.swatch", {
          text: "Aa",
          "aria-label": t.label, "aria-pressed": String(store.get("theme") === t.value),
          style: { background: t.bg, color: t.fg },
          onclick: () => {
            [...sw.children].forEach((c) => c.setAttribute("aria-pressed", "false"));
            b.setAttribute("aria-pressed", "true");
            tap();
            store.set("theme", t.value);
          },
        });
        sw.append(b);
      });
      body.append(sw);

      /* font, weight, the three sizes, alignment */
      body.append(...textControls());

      /* what shows under each line */
      body.append(el("div.section-label", { text: "Show with each line" }));
      body.append(el("div.list", {}, [
        switchRow("Transliteration", store.get("transliteration"),
          (v) => store.set("transliteration", v),
          { sub: "Roman spelling", iconName: "textSize" }),
        switchRow("English", store.get("translationEn"),
          (v) => store.set("translationEn", v), { iconName: "book" }),
        switchRow("English · Manmohan Singh", store.get("translationEnAlt"),
          (v) => store.set("translationEnAlt", v),
          { sub: "A second English voice", iconName: "book" }),
        switchRow("Punjabi · Prof. Sahib Singh", store.get("translationPa"),
          (v) => store.set("translationPa", v), { iconName: "book", gold: true }),
        switchRow("Name the translator", store.get("showAttribution"),
          (v) => store.set("showAttribution", v), { iconName: "info" }),
      ]));

      /* reading style */
      body.append(el("div.section-label", { text: "Style" }));
      body.append(el("div.list", {}, [
        switchRow("Larivaar", store.get("larivaar"),
          (v) => store.set("larivaar", v),
          { sub: "Words joined, as in the original", iconName: "alignLeft" }),
        sliderRow({
          label: "Auto-scroll speed", min: 5, max: 100, step: 1,
          value: store.get("autoScrollSpeed"),
          format: (v) => (v < 30 ? "Slow" : v < 65 ? "Steady" : "Brisk"),
          onInput: (v) => store.set("autoScrollSpeed", v),
        }),
      ]));

      body.append(el("div.list", {}, [
        el("button.row", {
          onclick: () => {
            store.update({
              gurFont: DEFAULTS.gurFont, gurWeight: DEFAULTS.gurWeight,
              textScale: DEFAULTS.textScale,
              translitScale: DEFAULTS.translitScale,
              translationScale: DEFAULTS.translationScale,
              align: DEFAULTS.align,
              larivaar: DEFAULTS.larivaar, transliteration: DEFAULTS.transliteration,
              translationEn: DEFAULTS.translationEn,
              translationEnAlt: DEFAULTS.translationEnAlt,
              translationPa: DEFAULTS.translationPa,
              showAttribution: DEFAULTS.showAttribution,
              autoScrollSpeed: DEFAULTS.autoScrollSpeed,
            });
            tap(14);
          },
        }, [
          el("div.row-icon", { html: Icons.reset }),
          el("div.row-body", {}, [
            el("div.row-title", { text: "Reset reading options" }),
            el("div.row-sub", { text: "Font, sizes, translations and style" }),
          ]),
        ]),
      ]));
    });
  }

  return { root, destroy: () => { stopAuto(); hideSpeedPill(); } };
}

/* ------------------------------------------------------------ shaping --- */
function normaliseBani(d) {
  const info = d.bani || {};
  return {
    title: titleCase(info.english || "Bani"),
    gurTitle: info.unicode || info.english,
    subtitle: null,
    lines: (d.verses || []).map((v) => ({
      gurmukhi: v.gurmukhi,
      translit: v.translit_en,
      en: v.translation_en,
      enAlt: null,
      pa: v.translation_pu,
      isHeader: !!v.is_header,
    })),
  };
}

function normaliseShabad(d) {
  const s = d.shabad || {};
  return {
    title: s.writer || s.raag || "Shabad",
    gurTitle: null,
    subtitle: [s.raag, s.page_no ? `Ang ${s.page_no}` : null]
      .filter(Boolean).join(" · "),
    lines: (d.verses || []).map((v) => {
      const t = v.translation || {};
      return {
        gurmukhi: v.gurmukhi,
        translit: v.translit_en,
        en: t.en?.bdb || t.en?.ssk || null,
        enAlt: t.en?.ms || null,
        pa: t.pu?.ss || null,
        isHeader: false,
      };
    }),
  };
}

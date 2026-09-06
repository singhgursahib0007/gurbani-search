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

import { el, clear, iconButton, sheet, segmented, sliderRow, switchRow, tap,
         toast, swipeToAct } from "../ui.js";
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

export function readerView({ type, id, focusVerse = null }, { onBack }) {
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

    // The press-and-hold gesture is invisible, so say it once and never again.
    if (store.get("hintLongPress")) {
      setTimeout(() => {
        store.set("hintLongPress", false);
        toast("Swipe a line left to save it");
      }, 1600);
    }
    // Bar height varies with the notch, so measure rather than assume.
    requestAnimationFrame(() => {
      scroller.style.paddingTop = bar.offsetHeight + "px";
      revealFocus();
    });
    // rAF does not fire in a background tab; a timer guarantees the jump.
    setTimeout(revealFocus, 120);
    setTimeout(restorePosition, 140);
  })();

  /* --------------------------------------------------------- rendering -- */
  function render() {
    if (!record) return;
    const p = store.all;
    clear(inner);

    inner.append(el("header", {
      style: { padding: "var(--s-6) 0 var(--s-5)", textAlign: "center" },
    }, [
      record.gurTitle
        ? el("h1.t-large-title.gur", { text: record.gurTitle })
        : el("h1.t-title-2", { text: record.title }),
      record.subtitle && el("p.t-subhead.dim", {
        text: record.subtitle, style: { marginTop: "var(--s-2)" },
      }),
    ].filter(Boolean)));

    record.lines.forEach((line, index) => {
      line.index = index;
      // No click handler on a line. Taps belong to the page - they bring the
      // chrome back - and a line that highlights itself when brushed while
      // scrolling is just noise.
      const box = el(`div.line${line.isHeader ? ".is-header" : ""}`, {
        dataset: {
          verse: line.verseId != null ? String(line.verseId) : "",
          i: String(line.index),
        },
      });
      if (focusVerse != null && line.verseId === focusVerse) {
        box.classList.add("is-focus");
      }

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

      // With every translation switched off a line is one short phrase, and
      // the padding sized for a block of prose leaves it stranded in white
      // space. Mark those so the CSS can close the gaps up.
      if (box.childElementCount === 1) box.classList.add("is-bare");

      // Only lines with a stable verse id can be kept: bani lines are numbered
      // in their own id space and would not resolve back to a shabad.
      if (line.verseId == null) {
        inner.append(box);
        return;
      }
      if (store.isSaved(lineKey(line.verseId))) box.classList.add("is-saved");

      // Pull the line left to uncover a star. Press and hold is deliberately
      // left alone, so it still selects text the way it does anywhere else.
      const action = el("div.line-action", {}, [
        el("div.star-well", { html: Icons.starFill }),
      ]);
      const row = el("div.line-row", {}, [action, box]);
      swipeToAct(row, box, {
        onTrigger: () => openLineActions(line, box),
        onProgress: (progress, armed) => {
          action.style.setProperty("--pull-scale", String(0.5 + progress * 0.55));
          action.style.setProperty("--pull-opacity",
                                   String(Math.min(1, progress * 1.4)));
          action.classList.toggle("armed", armed);
        },
      });
      inner.append(row);
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

  /* Bring the line that was searched for into view. Not centred: a line sits
     better a third of the way down, with the lines that lead to it visible
     above. */
  let revealed = false;
  function revealFocus() {
    if (revealed || focusVerse == null) return;
    const target = inner.querySelector(`.line[data-verse="${focusVerse}"]`);
    if (!target) return;
    revealed = true;
    const top = Math.max(0, target.offsetTop - Math.round(scroller.clientHeight * 0.3));

    // The jump must be instantaneous, not animated: smoothly scrolling the
    // reader through the whole shabad to reach their line is slow and makes
    // them watch it happen.
    //
    // Note that scrollTo({behavior: "auto"}) does NOT do this - "auto" means
    // "use the CSS scroll-behavior", which is smooth here for auto-scroll. So
    // the smooth behaviour is switched off around the jump, which also works
    // on Safari versions predating behavior: "instant".
    scroller.classList.add("no-smooth");
    scroller.scrollTop = top;
    // Read back before restoring, so the jump is committed first.
    void scroller.scrollTop;
    scroller.classList.remove("no-smooth");
  }

  /* --------------------------------------------------- reading position -- */
  const progressKey = `${type}:${id}`;

  /** The line currently at the top of the page. */
  function topLineIndex() {
    const y = scroller.scrollTop + 8;
    const boxes = inner.querySelectorAll(".line[data-i]");
    for (const box of boxes) {
      const el_ = box.closest(".line-row") || box;
      if (el_.offsetTop + el_.offsetHeight > y) return Number(box.dataset.i);
    }
    return 0;
  }

  function rememberPosition() {
    if (!record) return;
    store.setProgress(progressKey, topLineIndex());
  }

  /* Put the reader back where they stopped. Skipped when they arrived from a
     search or a saved line, because that destination is more specific than
     wherever they happened to leave off. */
  let restored = false;
  function restorePosition() {
    if (restored || focusVerse != null) return;
    const saved = store.getProgress(progressKey);
    if (!saved || !saved.line) { restored = true; return; }
    const box = inner.querySelector(`.line[data-i="${saved.line}"]`);
    if (!box) return;
    restored = true;
    const el_ = box.closest(".line-row") || box;
    scroller.classList.add("no-smooth");
    scroller.scrollTop = Math.max(0, el_.offsetTop - bar.offsetHeight - 8);
    void scroller.scrollTop;
    scroller.classList.remove("no-smooth");
  }

  /* ------------------------------------------------------- chrome & scroll */
  let lastY = 0, hidden = false, saveTimer = null;
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

    // Throttled: a scroll fires far too often to write storage on each one.
    clearTimeout(saveTimer);
    saveTimer = setTimeout(rememberPosition, 450);
  }, { passive: true });

  // A tap anywhere brings the chrome back, and puts it away again.
  scroller.addEventListener("click", () => {
    hidden = !hidden;
    bar.classList.toggle("hidden", hidden);
    fabs.classList.toggle("hidden", hidden);
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
    // Which line stands for this shabad in the Saved list.
    //
    // If the reader arrived from a search, it is the line they searched for -
    // that is what they will recognise. Otherwise it is the first real line,
    // skipping the raag-and-mehla heading, which is identical across hundreds
    // of shabads and tells you nothing about which one this is.
    const ref =
      (focusVerse != null &&
        record.lines.find((l) => l.verseId === focusVerse)) ||
      record.lines.find((l) => !l.isHeader && !isHeading(l.gurmukhi)) ||
      record.lines[0];

    const nowSaved = store.toggleSaved({
      id: `${type}:${id}`, type, refId: id,
      verseId: ref?.verseId ?? null,
      title: record.gurTitle || record.title,
      subtitle: record.subtitle || null,
      gurmukhi: ref?.gurmukhi || "",
    });
    updateSaveIcon();
    toast(nowSaved
      ? (type === "bani" ? "Bani saved" : "Shabad saved")
      : "Removed from Saved");
  }
  function updateSaveIcon() {
    const on = store.isSaved(`${type}:${id}`);
    saveBtn.innerHTML = on ? Icons.bookmarkFill : Icons.bookmark;
    saveBtn.style.color = on ? "var(--gold)" : "";
  }

  /* ----------------------------------------------------- line actions --- */
  const lineKey = (verseId) => `line:${verseId}`;

  function lineEntry(line) {
    return {
      id: lineKey(line.verseId),
      type: "line",
      refId: line.verseId,
      shabadId: record?.shabadId ?? (type === "shabad" ? id : null),
      gurmukhi: line.gurmukhi,
      translit: line.translit || null,
      en: line.en || null,
      where: record?.subtitle || record?.title || "",
    };
  }

  /* A press and hold opens this rather than saving outright: it makes the
     gesture discoverable, shows what is about to be kept, and puts copying
     within reach - which matters because holding a line no longer starts a
     text selection. */
  function openLineActions(line, box) {
    const saved = store.isSaved(lineKey(line.verseId));

    sheet(saved ? "Saved line" : "Save this line", (body, { close }) => {
      // The line itself, shown the way it is shown when kept, so what you are
      // about to save is what you will see in Saved.
      body.append(el("div.sheet-quote", {}, [
        el("div.gur", { text: line.gurmukhi }),
        line.translit && el("div.tl", { text: line.translit }),
        line.en && el("div.en", { text: line.en }),
      ].filter(Boolean)));

      const primary = el("button.btn-primary", {}, [
        el("span", { html: saved ? Icons.xmark : Icons.starFill,
                     style: { display: "flex" } }),
        el("span", { text: saved ? "Remove from Saved" : "Save line" }),
      ]);
      primary.onclick = () => {
        const nowSaved = store.toggleSaved(lineEntry(line));
        box.classList.toggle("is-saved", nowSaved);
        if (nowSaved) {
          box.classList.add("just-kept");
          setTimeout(() => box.classList.remove("just-kept"), 900);
        }
        close();
        toast(nowSaved ? "Line saved" : "Line removed", {
          action: "Undo",
          onAction: () => {
            const back = store.toggleSaved(lineEntry(line));
            box.classList.toggle("is-saved", back);
          },
        });
      };

      const secondary = el("button.btn-secondary", {}, [
        el("span", { html: Icons.copy, style: { display: "flex" } }),
        el("span", { text: "Copy line" }),
      ]);
      secondary.onclick = async () => {
        const parts = [line.gurmukhi, line.translit, line.en].filter(Boolean);
        try {
          await navigator.clipboard.writeText(parts.join("\n"));
          close(); toast("Copied");
        } catch { close(); toast("Could not copy"); }
      };

      body.append(el("div.sheet-actions", {}, [primary, secondary]));
    });
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

  return {
    root,
    destroy: () => {
      clearTimeout(saveTimer);
      rememberPosition();     // catch the position on the way out
      stopAuto();
      hideSpeedPill();
    },
  };
}

/* A raag-and-mehla heading - "ਸਿਰੀਰਾਗੁ ਮਹਲਾ ੧ ਘਰੁ ੪ ॥" - opens a great many
 * shabads, so it is useless as a label for any one of them. */
const isHeading = (text = "") =>
  /\u0a2e\u0a39\u0a32\u0a3e|\u0a2e\u0a03/.test(text) && text.length < 40;

/* ------------------------------------------------------------ shaping --- */
function normaliseBani(d) {
  const info = d.bani || {};
  return {
    title: titleCase(info.english || "Bani"),
    gurTitle: info.unicode || null,
    subtitle: titleCase(info.english || "") || null,
    lines: (d.verses || []).map((v) => ({
      verseId: null,          // bani lines have their own id space, not verses
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
  // The ang is what a reader actually uses to find their place again, so it
  // is the title. The raag was previously the navigation title, the heading
  // and half the subtitle - the same words three times over.
  return {
    shabadId: s.shabad_id ?? null,
    title: s.page_no ? `Ang ${s.page_no}` : "Shabad",
    gurTitle: null,
    subtitle: [s.writer, s.raag].filter(Boolean).join(" · ") || null,
    lines: (d.verses || []).map((v) => {
      const t = v.translation || {};
      return {
        verseId: v.verse_id,
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

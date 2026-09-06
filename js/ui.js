/* Small DOM helpers and the shared iOS-flavoured controls.
 *
 * No framework: these are plain functions returning elements. Keeping them in
 * one place is what makes the views read like layout rather than plumbing. */

import { Icons } from "./icons.js";

/** el("div.card", {onclick}, [children | "text"]) */
export function el(spec, props = {}, children = []) {
  const [tag, ...classes] = String(spec).split(".");
  const node = document.createElement(tag || "div");
  if (classes.length) node.className = classes.join(" ");

  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === "class") node.className += (node.className ? " " : "") + v;
    else if (k === "html") node.innerHTML = v;
    else if (k === "text") node.textContent = v;
    else if (k === "style") Object.assign(node.style, v);
    else if (k === "dataset") Object.assign(node.dataset, v);
    else if (k.startsWith("on") && typeof v === "function")
      node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v === true ? "" : v);
  }

  for (const child of [].concat(children)) {
    if (child == null || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

export const clear = (node) => { while (node.firstChild) node.firstChild.remove(); };

/** A button that is only an icon, with a required accessible label. */
export const iconButton = (name, label, onclick, cls = "icon-btn") =>
  el(`button.${cls}`, {
    html: Icons[name] || "", "aria-label": label, title: label, onclick,
  });

/** A soft tap, where the platform offers one. */
export const tap = (ms = 8) => { try { navigator.vibrate?.(ms); } catch {} };

/* ------------------------------------------------------------- sheet ---- */
/**
 * A bottom sheet, the way iOS presents options: a grabber, a scrim, and
 * dismissal by dragging down as well as by tapping away.
 */
export function sheet(title, build, { onClose } = {}) {
  const scrim = el("div.sheet-scrim");
  const panel = el("div.sheet", { role: "dialog", "aria-modal": "true",
                                  "aria-label": title });
  const body = el("div.sheet-body");

  panel.append(
    el("div.sheet-grabber"),
    el("div.sheet-head", {}, [
      el("h2", { text: title }),
      iconButton("xmark", "Close", () => close(), "icon-btn plain"),
    ]),
    body,
  );
  build(body, { close: () => close() });

  document.body.append(scrim, panel);
  const present = () => {
    scrim.classList.add("open");
    panel.classList.add("open");
  };
  // rAF for the smooth case, a timer as backstop: rAF never fires in a
  // background tab, which would leave the sheet parked off-screen.
  requestAnimationFrame(present);
  setTimeout(present, 40);

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    scrim.classList.remove("open");
    panel.classList.remove("open");
    setTimeout(() => { scrim.remove(); panel.remove(); onClose?.(); }, 320);
  }
  scrim.addEventListener("click", close);

  // Drag-to-dismiss, but only when the sheet's own content is scrolled to top.
  let y0 = null, dy = 0;
  panel.addEventListener("touchstart", (e) => {
    if (body.scrollTop > 0) return;
    y0 = e.touches[0].clientY; dy = 0;
    panel.style.transition = "none";
  }, { passive: true });
  panel.addEventListener("touchmove", (e) => {
    if (y0 == null) return;
    dy = Math.max(0, e.touches[0].clientY - y0);
    panel.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  panel.addEventListener("touchend", () => {
    if (y0 == null) return;
    panel.style.transition = "";
    panel.style.transform = "";
    if (dy > 110) close();
    y0 = null;
  });

  return { close, body };
}

/* ------------------------------------------------------------ controls -- */
export function switchRow(label, checked, onchange, { sub, iconName, gold } = {}) {
  const sw = el("button.switch", {
    role: "switch", "aria-checked": String(!!checked), "aria-label": label,
  });
  const row = el("div.row", {}, [
    iconName && el(`div.row-icon${gold ? ".is-gold" : ""}`, { html: Icons[iconName] }),
    el("div.row-body", {}, [
      el("div.row-title", { text: label }),
      sub && el("div.row-sub", { text: sub }),
    ]),
    sw,
  ]);
  const toggle = () => {
    const next = sw.getAttribute("aria-checked") !== "true";
    sw.setAttribute("aria-checked", String(next));
    tap();
    onchange(next);
  };
  sw.addEventListener("click", (e) => { e.stopPropagation(); toggle(); });
  row.addEventListener("click", toggle);
  return row;
}

export function segmented(options, value, onchange, { label } = {}) {
  const wrap = el("div.segmented", { role: "group", "aria-label": label || "" });
  options.forEach((opt) => {
    const btn = el("button", {
      text: opt.label,
      "aria-pressed": String(opt.value === value),
      html: opt.icon ? Icons[opt.icon] : undefined,
      onclick: () => {
        [...wrap.children].forEach((c) => c.setAttribute("aria-pressed", "false"));
        btn.setAttribute("aria-pressed", "true");
        tap();
        onchange(opt.value);
      },
    });
    if (opt.icon) { btn.innerHTML = Icons[opt.icon]; btn.setAttribute("aria-label", opt.label); }
    wrap.append(btn);
  });
  return wrap;
}

export function sliderRow({ label, min, max, step, value, onInput, format }) {
  const out = el("span.t-footnote.dim", { text: format ? format(value) : String(value) });
  const input = el("input.slider", {
    type: "range", min, max, step, value,
    "aria-label": label,
    oninput: (e) => {
      const v = Number(e.target.value);
      out.textContent = format ? format(v) : String(v);
      onInput(v);
    },
  });
  return el("div", { style: { padding: "var(--s-3) var(--s-4)" } }, [
    el("div", {
      style: { display: "flex", justifyContent: "space-between",
               alignItems: "baseline", marginBottom: "var(--s-2)" },
    }, [el("span.t-subhead", { text: label }), out]),
    input,
  ]);
}

export const listGroup = (rows, label) =>
  el("div", {}, [
    label && el("div.section-label", { text: label }),
    el("div.list", {}, rows.filter(Boolean)),
  ]);

/* ------------------------------------------------------------- toast --- */
let toastEl = null, toastTimer = null;

/** A brief confirmation, with an optional undo. Replaces any toast on screen. */
export function toast(message, { action, onAction, ms = 2800 } = {}) {
  clearTimeout(toastTimer);
  toastEl?.remove();

  toastEl = el("div.toast", { role: "status" }, [
    el("span", { text: message }),
    action && el("button.toast-action", {
      text: action,
      onclick: () => { onAction?.(); hideToast(); },
    }),
  ].filter(Boolean));

  document.body.append(toastEl);
  requestAnimationFrame(() => toastEl?.classList.add("in"));
  // rAF does not fire in a background tab; make sure it still shows.
  setTimeout(() => toastEl?.classList.add("in"), 40);
  toastTimer = setTimeout(hideToast, ms);
}

function hideToast() {
  const t = toastEl;
  if (!t) return;
  toastEl = null;
  t.classList.remove("in");
  setTimeout(() => t.remove(), 300);
}

/* --------------------------------------------------------- long press --- */
/**
 * Fire `handler` when a press is held still on `node`.
 *
 * Cancelled by movement, so it never steals a scroll, and it suppresses the
 * click that would otherwise follow - in the reader that click toggles the
 * chrome, which would flash every time someone saved a line.
 */
export function onLongPress(node, handler, { ms = 500, slop = 12 } = {}) {
  let timer = null, sx = 0, sy = 0, fired = false;

  const cancel = () => { clearTimeout(timer); timer = null; };

  const start = (x, y) => {
    fired = false;
    sx = x; sy = y;
    cancel();
    timer = setTimeout(() => {
      fired = true;
      tap(18);
      handler();
    }, ms);
  };

  const move = (x, y) => {
    if (timer && (Math.abs(x - sx) > slop || Math.abs(y - sy) > slop)) cancel();
  };

  node.addEventListener("touchstart", (e) => {
    const t = e.touches[0];
    start(t.clientX, t.clientY);
  }, { passive: true });
  node.addEventListener("touchmove", (e) => {
    const t = e.touches[0];
    move(t.clientX, t.clientY);
  }, { passive: true });
  node.addEventListener("touchend", cancel);
  node.addEventListener("touchcancel", cancel);

  // Pointer events cover desktop; touch devices fire both, and the guard on
  // `fired` keeps that from running the handler twice.
  node.addEventListener("mousedown", (e) => start(e.clientX, e.clientY));
  node.addEventListener("mousemove", (e) => move(e.clientX, e.clientY));
  node.addEventListener("mouseup", cancel);
  node.addEventListener("mouseleave", cancel);

  node.addEventListener("click", (e) => {
    if (fired) { e.stopPropagation(); e.preventDefault(); fired = false; }
  }, true);

  node.addEventListener("contextmenu", (e) => e.preventDefault());
}

export function emptyState(iconName, title, body) {
  return el("div.empty", {}, [
    el("div", { html: Icons[iconName] || "" }),
    el("h3", { text: title }),
    body && el("p", { text: body }),
  ]);
}

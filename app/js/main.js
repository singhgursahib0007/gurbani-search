/* App shell: routing, the tab bar, and keeping views alive between switches.
 *
 * Tab views are built once and kept in memory, so switching tabs restores
 * exactly what you left - your place in the bani list, your search and its
 * results. The reader is built fresh each time and torn down on the way out,
 * because it owns a running animation frame. */

import { el, iconButton } from "./ui.js";
import { Icons } from "./icons.js";
import { store, applyTheme, applyReaderVars } from "./store.js";
import { banisView } from "./views/banis.js";
import { searchView } from "./views/search.js";
import { savedView } from "./views/saved.js";
import { settingsView } from "./views/settings.js";
import { readerView } from "./views/reader.js";

applyTheme();
applyReaderVars();

const app = document.getElementById("app");
const stage = el("div.screen");
app.append(stage);

const TABS = [
  { id: "banis",    label: "Banis",    icon: "book",     active: "bookFill" },
  { id: "search",   label: "Search",   icon: "search",   active: "searchFill" },
  { id: "saved",    label: "Saved",    icon: "bookmark", active: "bookmarkFill" },
  { id: "settings", label: "Settings", icon: "gear",     active: "gearFill" },
];

const tabbar = el("nav.tabbar", { role: "tablist", "aria-label": "Sections" });
const tabButtons = {};
TABS.forEach((t) => {
  const b = el("button.tab", {
    role: "tab", "aria-selected": "false", "aria-label": t.label,
    onclick: () => go(`#/${t.id}`),
  }, [el("span", { html: Icons[t.icon], style: { display: "flex" } }),
      el("span", { text: t.label })]);
  tabButtons[t.id] = b;
  tabbar.append(b);
});
app.append(tabbar);

/* Tab views are lazily created, then cached. */
const views = {};
let current = null;
let reader = null;

function tabView(id) {
  if (views[id]) return views[id];
  if (id === "banis") views[id] = banisView({ onOpenBani: (b) => go(`#/bani/${b}`) });
  if (id === "search") views[id] = searchView({
    onOpenShabad: (s) => go(`#/shabad/${s}`),
  });
  if (id === "saved") views[id] = savedView({
    onOpen: (item) => go(item.type === "bani" ? `#/bani/${item.refId}`
                                              : `#/shabad/${item.refId}`),
  });
  if (id === "settings") views[id] = settingsView();
  return views[id];
}

function mount(node) {
  if (current === node) return;
  stage.replaceChildren(node);
  current = node;
  window.scrollTo(0, 0);
}

function setTab(id) {
  TABS.forEach((t) =>
    tabButtons[t.id].setAttribute("aria-selected", String(t.id === id)));
  TABS.forEach((t) => {
    const on = t.id === id;
    tabButtons[t.id].firstChild.innerHTML = Icons[on ? t.active : t.icon];
  });
}

export function go(hash) {
  if (location.hash === hash) route();
  else location.hash = hash;
}

function route() {
  const h = location.hash || "#/banis";

  // leaving the reader: stop its autoscroll and speed pill
  const inReader = /^#\/(bani|shabad)\//.test(h);
  if (!inReader && reader) { reader.destroy?.(); reader = null; }

  let m;
  if ((m = h.match(/^#\/bani\/(\d+)/))) {
    tabbar.classList.add("hidden");
    reader?.destroy?.();
    reader = readerView({ type: "bani", id: +m[1] }, { onBack: back });
    mount(reader.root);
    return;
  }
  if ((m = h.match(/^#\/shabad\/(\d+)/))) {
    tabbar.classList.add("hidden");
    reader?.destroy?.();
    reader = readerView({ type: "shabad", id: +m[1] }, { onBack: back });
    mount(reader.root);
    return;
  }

  const id = (h.match(/^#\/(\w+)/) || [, "banis"])[1];
  const tab = TABS.some((t) => t.id === id) ? id : "banis";
  tabbar.classList.remove("hidden");
  setTab(tab);
  mount(tabView(tab).root);
}

function back() {
  if (history.length > 1) history.back();
  else go("#/banis");
}

window.addEventListener("hashchange", route);
route();

/* Keep the status-bar colour in step when the system flips light/dark. */
store.subscribe((_s, keys) => {
  if (keys === "*" || keys.includes("theme")) applyTheme();
});

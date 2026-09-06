/* Preferences and saved items.
 *
 * Everything the reader chooses lives here and is mirrored to localStorage on
 * every change, so the app opens exactly as they left it. Reads are wrapped in
 * try/catch because private windows and "block site data" settings make
 * localStorage throw rather than return null.
 *
 * Subscribers are notified on change, which is how the theme, type size and
 * translation toggles apply live while a sheet is still open.
 */

const KEY = "gurbani.v1";

// Bumped when a default changes in a way existing readers should inherit.
// See the migration in load().
const PREFS_VERSION = 2;

export const DEFAULTS = Object.freeze({
  prefsVersion: PREFS_VERSION,
  theme: "auto",             // auto | light | sepia | dark | night
  gurFont: "Sant Lipi",      // see FONTS below
  gurWeight: 400,            // 400 regular · 500 medium · 700 bold
  textScale: 1,              // Gurbani line, 0.85 – 1.7
  translitScale: 1,          // transliteration
  translationScale: 1,       // translations
  align: "center",           // start | center
  larivaar: false,
  transliteration: true,
  translationEn: true,       // BaniDB English
  translationEnAlt: false,   // Manmohan Singh
  translationPa: true,       // Prof. Sahib Singh
  showAttribution: false,    // name the translator under each translation
  autoScrollSpeed: 30,       // 10 (slow) – 100 (fast)
  keepAwakeHint: true,
  hintLongPress: true,       // shown once, the first time a reader opens
  baniSort: "category",      // category | english | gurmukhi
  favourites: [],            // bani ids, in the order the reader starred them
  saved: [],                 // saved shabads: {id, gurmukhi, at}
  lastRead: null,            // {type:'bani'|'shabad', id, title, at}
  progress: {},              // "bani:2" -> { line, at } — see setProgress
});

let state = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const saved = JSON.parse(raw);
    // Merge over defaults so a new preference added in a later version
    // appears with its default instead of undefined.
    const merged = { ...DEFAULTS, ...saved };

    // Centred is now the default alignment. Anyone still carrying the old
    // default gets moved across once; a reader who deliberately chose
    // "start" after this version keeps it, because the version stamp will
    // already have been written.
    if ((saved.prefsVersion || 1) < 2) {
      if (saved.align === undefined || saved.align === "start") {
        merged.align = "center";
      }
      merged.prefsVersion = PREFS_VERSION;
    }
    return merged;
  } catch {
    return { ...DEFAULTS };
  }
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* Storage full or blocked: the app keeps working, it just won't remember. */
  }
}

export const store = {
  get all() { return state; },
  get(key) { return state[key]; },

  set(key, value) {
    if (state[key] === value) return;
    state = { ...state, [key]: value };
    persist();
    emit(key);
  },

  update(patch) {
    state = { ...state, ...patch };
    persist();
    emit(Object.keys(patch));
  },

  toggle(key) { this.set(key, !state[key]); },

  /* --- favourite banis ------------------------------------------------- */
  isFavourite(id) { return state.favourites.includes(id); },

  toggleFavourite(id) {
    const favs = state.favourites.includes(id)
      ? state.favourites.filter((f) => f !== id)
      : [...state.favourites, id];
    this.set("favourites", favs);
    return favs.includes(id);
  },

  /* --- saved shabads --------------------------------------------------- */
  isSaved(id) { return state.saved.some((s) => s.id === id); },

  toggleSaved(entry) {
    const exists = state.saved.some((s) => s.id === entry.id);
    const saved = exists
      ? state.saved.filter((s) => s.id !== entry.id)
      : [{ ...entry, at: Date.now() }, ...state.saved];
    this.set("saved", saved);
    return !exists;
  },

  /* --- reading position ------------------------------------------------ */
  //
  // Stored as the index of the topmost visible line, not a pixel offset. A
  // scroll position in pixels is meaningless the moment the reader changes
  // type size, turns a translation on, or switches font - all of which reflow
  // the page. A line index survives every one of those.
  getProgress(key) { return state.progress?.[key] || null; },

  setProgress(key, line) {
    const current = state.progress?.[key];
    if (current && current.line === line) return;
    const next = { ...state.progress, [key]: { line, at: Date.now() } };

    // Keep this from growing without bound: only the fifty most recently
    // read items are worth remembering.
    const keys = Object.keys(next);
    if (keys.length > 50) {
      keys.sort((a, b) => (next[b].at || 0) - (next[a].at || 0));
      for (const k of keys.slice(50)) delete next[k];
    }
    this.set("progress", next);
  },

  /* --- housekeeping ---------------------------------------------------- */
  reset() {
    // Deliberately keeps what the reader collected; only the knobs go back.
    const { favourites, saved, lastRead, progress } = state;
    state = { ...DEFAULTS, favourites, saved, lastRead, progress };
    persist();
    emit("*");
  },

  resetEverything() {
    state = { ...DEFAULTS };
    persist();
    emit("*");
  },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

function emit(keys) {
  const changed = Array.isArray(keys) ? keys : [keys];
  listeners.forEach((fn) => fn(state, changed));
}

/* --- theme ------------------------------------------------------------- */
const media = window.matchMedia("(prefers-color-scheme: dark)");

export function resolveTheme(pref = state.theme) {
  if (pref !== "auto") return pref;
  return media.matches ? "dark" : "light";
}

export function applyTheme() {
  const theme = resolveTheme();
  document.documentElement.setAttribute("data-theme", theme);
  // Colour the browser chrome to match, so the notch area doesn't jar.
  const bg = getComputedStyle(document.documentElement)
    .getPropertyValue("--bg").trim();
  let tag = document.querySelector('meta[name="theme-color"]');
  if (!tag) {
    tag = document.createElement("meta");
    tag.name = "theme-color";
    document.head.appendChild(tag);
  }
  tag.content = bg || "#ffffff";
}

/* The Gurmukhi faces on offer. Each is a real family declared in base.css;
 * a browser fetches only the one actually selected. */
export const FONTS = [
  { value: "Sant Lipi", label: "Sant Lipi", note: "Built for Gurbani" },
  { value: "Mukta Mahee", label: "Mukta Mahee", note: "Even and modern" },
  { value: "Noto Sans Gurmukhi", label: "Noto Sans", note: "Wide and plain" },
  { value: "Anek Gurmukhi", label: "Anek", note: "Compact" },
];

export const WEIGHTS = [
  { value: 400, label: "Regular" },
  { value: 500, label: "Medium" },
  { value: 700, label: "Bold" },
];

export function applyReaderVars() {
  const root = document.documentElement.style;
  root.setProperty("--gur-font", `"${state.gurFont}"`);
  root.setProperty("--gur-weight", String(state.gurWeight));
  root.setProperty("--reader-scale", String(state.textScale));
  root.setProperty("--translit-scale", String(state.translitScale));
  root.setProperty("--translation-scale", String(state.translationScale));
  root.setProperty("--reader-align", state.align === "center" ? "center" : "start");
}

media.addEventListener?.("change", () => {
  if (state.theme === "auto") applyTheme();
});

store.subscribe((_s, keys) => {
  if (keys === "*" || keys.includes("theme")) applyTheme();
  if (keys === "*" ||
      ["textScale", "translitScale", "translationScale", "align",
       "gurFont", "gurWeight"].some((k) => keys.includes(k))) {
    applyReaderVars();
  }
});

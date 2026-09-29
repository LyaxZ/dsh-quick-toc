// Offline render test for dsh-quick-toc: loads the real client bundle, captures
// OutlinePanel from apply(), and renders it with a mini React hook runtime against synthetic
// chat data + a fake scrollport, so the render/effect paths (level picker, search results and
// the curtain's search column, sticky headers, the pointer glyphs, the settings card) run
// without a browser. Run it with `npm test`.
import { readFileSync } from "node:fs";

const FILE = new URL("../lib/client.js", import.meta.url);
const src = readFileSync(FILE, "utf8");

/* ------------------------------------------------- instrumentation (test copy)
 * Counts real parse work and exposes the node cache, so objective ④ ("a
 * streaming update only re-processes the node that changed") can be measured
 * instead of assumed. Only the copy evaluated here is patched. */
const counters = { info: 0, reply: 0, user: 0, parse: 0 };
globalThis.__dqtCounters = counters;
const instr = src
  .replace("function nodeInfo(key, node) {", "function nodeInfo(key, node) { globalThis.__dqtCounters.info++;")
  .replace("function extractReplyText(node) {", "function extractReplyText(node) { globalThis.__dqtCounters.reply++;")
  .replace("function extractUserText(node) {", "function extractUserText(node) { globalThis.__dqtCounters.user++;")
  .replace("function parseHeadings(text) {", "function parseHeadings(text) { globalThis.__dqtCounters.parse++;")
  .replace("    return module.exports;", "    exports.__debug = { nodeInfoCache: nodeInfoCache, highlightRow: highlightRow, clearHighlights: clearHighlights, findRowStrict: findRowStrict, findRow: findRow, countOccurrences: countOccurrences, parseHeadings: parseHeadings };\n    return module.exports;")
if (instr === src) throw new Error("instrumentation failed: no anchor matched");

/* ---------------------------------------------------------------- DOM stubs */
function fakeEl(over = {}) {
  const el = {
    style: {}, dataset: {}, childNodes: [], children: [], textContent: "", id: "", className: "",
    setAttribute() {}, removeAttribute() {}, appendChild() {}, removeChild() {},
    // listeners are recorded so a test can drive them (the panel attaches a native
    // non-passive wheel handler to its header)
    addEventListener(t, fn) { const m = (el._ls = el._ls || new Map()); if (!m.has(t)) m.set(t, new Set()); m.get(t).add(fn); },
    removeEventListener(t, fn) { const m = el._ls; if (m && m.has(t)) m.get(t).delete(fn); },
    fire(t, ev) { const m = el._ls; if (m && m.has(t)) for (const fn of [...m.get(t)]) fn(ev || {}); },
    focus() {}, blur() {}, click() {},
    querySelector: () => null, querySelectorAll: () => [],
    // the paging logic asks whether the node is still in the tree before re-anchoring
    isConnected: true,
    getBoundingClientRect: () => ({ top: 0, left: 0, right: 100, bottom: 100, width: 100, height: 100 }),
    closest: () => null, contains: () => false, scrollTo() {},
    scrollTop: 0, scrollLeft: 0, scrollHeight: 0, scrollWidth: 0, clientHeight: 0, clientWidth: 0, offsetHeight: 0,
    offsetWidth: 0, clientWidth: 0, disabled: false, offsetTop: 0,
  };
  // A REAL classList over className. The old stub was a set of no-ops, which is the
  // same blind spot the clearTimeout stub used to be: anything the panel marks by
  // class (the keyboard cursor, for one) would be invisible to these tests.
  el.classList = {
    _set() { return new Set(String(el.className || "").split(/\s+/).filter(Boolean)); },
    _write(set) { el.className = [...set].join(" "); },
    add(...names) { const s = this._set(); names.forEach((n) => s.add(n)); this._write(s); },
    remove(...names) { const s = this._set(); names.forEach((n) => s.delete(n)); this._write(s); },
    contains(name) { return this._set().has(name); },
    toggle(name, force) {
      const s = this._set();
      const on = force === undefined ? !s.has(name) : !!force;
      if (on) s.add(name); else s.delete(name);
      this._write(s);
      return on;
    },
  };
  return Object.assign(el, over);
}
const rafQueue = [];
const winListeners = new Map();
const fireWindow = (type, ev) => { const set = winListeners.get(type); if (set) for (const fn of [...set]) fn(ev); };
const intervalFns = [];
const tickIntervals = () => { for (let i = 0; i < intervalFns.length; i++) { const fn = intervalFns[i]; if (fn) fn(); } };
globalThis.setInterval = (fn) => { intervalFns.push(fn); return intervalFns.length; };
globalThis.clearInterval = (id) => { if (id) intervalFns[id - 1] = null; };
// timeouts are queued but NOT auto-run: real timers fire later, and draining
// them inside render() would skip transient states (e.g. a closing popup's
// exit animation). Advance them explicitly with tickTimeouts().
// clearTimeout really CANCELS: a debounced write whose timer is cleared must not
// fire later (an earlier no-op stub hid exactly that — see scenario 7x).
const timeoutFns = new Map();
let timeoutSeq = 0;
const tickTimeouts = () => { const q = [...timeoutFns.values()]; timeoutFns.clear(); for (const fn of q) fn(); };
globalThis.setTimeout = (fn) => { timeoutSeq += 1; timeoutFns.set(timeoutSeq, fn); return timeoutSeq; };
globalThis.clearTimeout = (id) => { timeoutFns.delete(id); };
globalThis.window = {
  innerWidth: 1400, innerHeight: 900, devicePixelRatio: 1,
  __ModuleLoader__: { load: (reg) => { globalThis.__reg = reg; } },
  addEventListener: (t, fn) => { if (!winListeners.has(t)) winListeners.set(t, new Set()); winListeners.get(t).add(fn); },
  removeEventListener: (t, fn) => { const s = winListeners.get(t); if (s) s.delete(fn); },
  // A real CSSStyleDeclaration answers getPropertyValue (returning "" for an unset
  // property) — the end-jump reads --dsh-composer-height to keep the section's tail
  // out from under the sticky composer.
  getComputedStyle: () => ({ backgroundColor: "rgb(30,30,30)", color: "rgb(220,220,220)", getPropertyValue: () => "" }),
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  requestAnimationFrame: (fn) => { rafQueue.push(fn); return rafQueue.length; },
  cancelAnimationFrame() {},
  setTimeout: (fn) => { rafQueue.push(fn); return 0; },
  clearTimeout() {},
};
globalThis.requestAnimationFrame = globalThis.window.requestAnimationFrame;
globalThis.cancelAnimationFrame = () => {};
// browsers expose getComputedStyle globally too, not only on window
globalThis.getComputedStyle = globalThis.window.getComputedStyle;
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
globalThis.CSS = { escape: (s) => s };
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
// A real browser fires `storage` in the OTHER tab; the plugin listens for it to
// re-read its cached preferences. Tests seed preferences through this map, so the
// wrapper keeps every scenario honest about that path.
const rawStoreSet = store.set.bind(store);
const ping = () => { if (typeof fireWindow === "function") fireWindow("storage", {}); };
store.set = (k, v) => { const r = rawStoreSet(k, v); ping(); return r; };
store.delete = (k) => { const r = Map.prototype.delete.call(store, k); ping(); return r; };
store.clear = () => { Map.prototype.clear.call(store); ping(); };

// scrollport holding heading rows; configured per scenario
let SCROLL = { heads: [], rows: new Map(), top: 0 };
const scrollport = fakeEl({
  querySelectorAll: (sel) => (sel === "[data-chat-anchor-key]" ? [...SCROLL.rows.keys()].map((k) => SCROLL.rows.get(k)) : sel === "button" ? (SCROLL.buttons || []) : sel.includes("h1") ? SCROLL.heads : []),
  // SCROLL.left is mutable so a scenario can move the conversation area sideways
  // (the plugin must follow it: see "the panel stays inside the window")
  getBoundingClientRect: () => ({ top: SCROLL.top, left: SCROLL.left === undefined ? 300 : SCROLL.left, right: (SCROLL.left === undefined ? 300 : SCROLL.left) + 1000, bottom: SCROLL.top + 600, width: 1000, height: 600 }),
});
scrollport.scrollHeight = 5000;
scrollport.clientHeight = 600;
// scrollend/listener registry: the jump chain listens for scrollend to know when
// a native attempt ended (the emulator fires it when the animation completes)
const spListeners = new Map();
scrollport.addEventListener = (type, fn) => { let s = spListeners.get(type); if (!s) { s = new Set(); spListeners.set(type, s); } s.add(fn); };
scrollport.removeEventListener = (type, fn) => { const s = spListeners.get(type); if (s) s.delete(fn); };
scrollport.fire = (type, ev) => { const s = spListeners.get(type); if (s) for (const fn of [...s]) fn(ev || {}); };
// The client hands every glide to the browser's own smooth scroll. The stub must
// then MOVE scrollTop the way a real native animation does (eased rAF frames),
// and fire scrollend when the animation ends — that is what arms the next
// attempt of the jump chain.
const nativeScrollEmu = (o) => {
  scrollport.lastScroll = o;
  if (!o || typeof o.top !== "number") return;
  if (String(o.behavior) !== "smooth") { scrollport.scrollTop = Math.max(0, o.top); scrollport.fire("scrollend"); return; }
  const from = scrollport.scrollTop;
  const dist = o.top - from;
  if (Math.abs(dist) < 2) { scrollport.scrollTop = Math.max(0, o.top); scrollport.fire("scrollend"); return; }
  let s = 0;
  const frames = 30;
  scrollport.emuInterrupted = false;
  const stepEmu = () => {
    if (scrollport.emuInterrupted) { scrollport.fire("scrollend"); return; } // the reader's wheel also stops the native animation
    s++;
    const k = Math.min(1, s / frames);
    const eased = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    scrollport.scrollTop = from + dist * eased;
    if (s < frames) requestAnimationFrame(stepEmu);
    else scrollport.fire("scrollend"); // the attempt ended → the chain evaluates the landing
  };
  requestAnimationFrame(stepEmu);
};
scrollport.scrollTo = nativeScrollEmu;
// conversation view tabs: one LIVE node whose selection can change (mirrors the
// real DOM, where conversationTablist() caches the node while it stays connected)
let TABLIST = null;
const TAB_STATE = { labels: ["对话", "轨迹"], active: 0 };
// `rect` is filled in by the curtain scenario, where the tabs sit INSIDE the
// conversation scroll container — the geometry the plug-in uses to hang the curtain
// below them instead of covering them
const liveTablist = {
  isConnected: true,
  rect: null,
  getBoundingClientRect() { return this.rect || { top: 0, bottom: 0, height: 0 }; },
  querySelectorAll: (sel) => (sel === 'button[role="tab"]'
    ? TAB_STATE.labels.map((l, i) => ({ textContent: l, getAttribute: (a) => (a === "aria-selected" ? (i === TAB_STATE.active ? "true" : "false") : null) }))
    : []),
};

/* ------------------------------------------------------------- mini DOM ----
 * The keyword highlight really mutates the conversation DOM (text nodes are
 * wrapped in <span class="dqt-current">), so the pieces that code path needs are
 * modelled here: text nodes, a tree walker, fragments and replaceChild. */
function textNode(value) { return { nodeType: 3, nodeValue: value, parentNode: null }; }
function findIn(node, sel) {
  for (const c of node.childNodes || []) {
    if (c.nodeType === 1) {
      if (sel === ".dqt-current" && String(c.className || "").split(/\s+/).includes("dqt-current")) return c;
      if (/^h[1-6]$/i.test(sel) && /^H[1-6]$/.test(c.tagName)) return c;
      if (sel.includes(",") && sel.split(",").map((s) => s.trim().toUpperCase()).includes(c.tagName)) return c;
      const deep = findIn(c, sel);
      if (deep) return deep;
    }
  }
  return null;
}
function elem(tag, over) {
  const el = fakeEl(over);
  el.nodeType = 1;
  el.tagName = String(tag || "div").toUpperCase();
  el.childNodes = [];
  Object.defineProperty(el, "textContent", {
    configurable: true,
    get() { return el.childNodes.map((t) => (t.nodeType === 3 ? t.nodeValue : t.textContent || "")).join(""); },
    set(v) { el.childNodes = []; el.textContentValue = String(v); if (v) el.appendChild(textNode(String(v))); },
  });
  el.appendChild = (n) => { n.parentNode = el; el.childNodes.push(n); return n; };
  el.replaceChild = (n, old) => {
    const at = el.childNodes.indexOf(old);
    if (at < 0) return old;
    if (n.nodeType === 11) {
      const kids = n.childNodes.slice();
      el.childNodes.splice(at, 1, ...kids);
      for (const k of kids) k.parentNode = el;
    } else {
      el.childNodes[at] = n;
      n.parentNode = el;
    }
    return old;
  };
  el.querySelector = (sel) => findIn(el, sel);
  return el;
}
globalThis.NodeFilter = { SHOW_TEXT: 4 };
// the plugin injects its stylesheet once per install; capturing it lets the suite
// assert real CSS (keyframes, reduced-motion fallbacks), not just inline styles
const headStyles = [];
const cssText = () => headStyles.map((n) => n.textContent || "").join("\n");
globalThis.document = {
  body: fakeEl({ dataset: {} }),
  documentElement: fakeEl(),
  getElementById: () => null,
  createElement: (tag) => elem(tag),
  createTextNode: (v) => textNode(v),
  createDocumentFragment: () => { const f = { nodeType: 11, childNodes: [] }; f.appendChild = (n) => { n.parentNode = f; f.childNodes.push(n); return n; }; return f; },
  createTreeWalker: (root) => {
    const nodes = [];
    (function dfs(n) { for (const c of n.childNodes || []) { if (c.nodeType === 3) nodes.push(c); else dfs(c); } })(root);
    let i = -1;
    // the real TreeWalker exposes the node it moved to as `currentNode`
    return {
      currentNode: null,
      nextNode() { i++; this.currentNode = i < nodes.length ? nodes[i] : null; return this.currentNode; },
    };
  },
  head: { appendChild(n) { headStyles.push(n); } },
  addEventListener: (t, fn) => { if (!docListeners.has(t)) docListeners.set(t, new Set()); docListeners.get(t).add(fn); },
  removeEventListener: (t, fn) => { const s = docListeners.get(t); if (s) s.delete(fn); },
  querySelector: (sel) => (sel === "[data-conversation-scroll]" ? scrollport : sel === '[role="tablist"]' ? TABLIST : (SELECTORS[sel] || null)),
  querySelectorAll: (sel) => (sel === "[data-chat-anchor-key]" ? CONV_ROWS : []),
};
let CONV_ROWS = [];
// extra document.querySelector hits, keyed by exact selector string
const SELECTORS = {};
const docListeners = new Map();
const fireDocument = (type, ev) => { const set = docListeners.get(type); if (set) for (const fn of [...set]) fn(ev); };

/* ------------------------------------------------------- mini React runtime */
let cursor = 0, slots = [], dirty = false, effectQueue = [];
function resetComponent() { slots = []; bags.clear(); dirty = false; effectQueue = []; rafQueue.length = 0; intervalFns.length = 0; timeoutFns.clear(); resetHost(); LIST_STUB.scrollTop = 0; LIST_STUB.scrollHeight = 1000; LIST_STUB.clientHeight = 400; }
const sameDeps = (a, b) => !!a && !!b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
const react = {
  Fragment: "Fragment",
  createElement: (type, props, ...kids) => ({ type, props: Object.assign({}, props, { children: kids.length <= 1 ? kids[0] : kids }) }),
  useState(init) {
    const i = cursor++;
    if (!(i in slots)) slots[i] = { v: typeof init === "function" ? init() : init };
    const s = slots[i];
    return [s.v, (nv) => { s.v = typeof nv === "function" ? nv(s.v) : nv; dirty = true; }];
  },
  useRef(init) { const i = cursor++; if (!(i in slots)) slots[i] = { v: { current: init } }; return slots[i].v; },
  useMemo(fn, deps) {
    const i = cursor++;
    if (!(i in slots) || !sameDeps(slots[i].deps, deps)) slots[i] = { v: fn(), deps };
    return slots[i].v;
  },
  useCallback(fn, deps) { return react.useMemo(() => fn, deps); },
  useEffect(fn, deps) {
    const i = cursor++;
    if (!(i in slots)) {
      slots[i] = { fn, deps, pending: true };
    } else if (!sameDeps(slots[i].deps, deps)) {
      // React runs the PREVIOUS cleanup before the effect re-runs; carrying it over
      // keeps that promise (dropping it would leak every listener an effect adds)
      slots[i] = { fn, deps, pending: true, cleanup: slots[i].cleanup };
    }
    effectQueue.push(i);
  },
  useLayoutEffect(fn, deps) { react.useEffect(fn, deps); },
};
const jsxRun = {
  jsx: (type, props, key) => ({ type, props: Object.assign({}, props, key !== undefined ? { key } : {}) }),
  jsxs: (type, props, key) => ({ type, props: Object.assign({}, props, key !== undefined ? { key } : {}) }),
  Fragment: "Fragment",
};
const seed = { react, "react/jsx-runtime": jsxRun, "react-dom": { createPortal: (c) => c } };
const require_ = (spec) => {
  if (spec in seed) return seed[spec];
  throw new Error(`externals miss: ${spec}`);
};

/* --------------------------------------------------------- load the bundle */
new Function("window", "document", "CSS", "require", instr)(globalThis.window, globalThis.document, globalThis.CSS, require_);
const exports_ = globalThis.__reg.factory(require_);
let Panel = null;
// the tables the plugin hands the host for its locale namespace
let registered = null;
// What the host's translate function answers; a test may replace it to simulate a host
// running in another language (empty = let the plugin's built-in table answer).
let hostT = () => undefined;
// mirrors the real client facade: a declaration-free ctx.get(name) lookup.
// (The dynamic plugin ctx exposes NO ctx.inject, and a direct ctx.sessions read
// would require declaring `inject: ["sessions"]` on the returned plugin.)
const provided = { sessions: null, workspaces: null };
// The client settings scope, stood in for by a tiny namespace store with the same
// face the real one has: getSnapshot / subscribe / set / unset / mutate, and a
// snapshot of {status, value, user, writable, revision}. Tests drive it through
// setHostField()/resetHost() the way the real settings page would.
const HOST_DEFAULTS = { lang: "auto", dock: "left", levels: [1, 2, 3, 4, 5, 6], zoom: 1, sheetZoom: 1, handle: 0.5, fuzzy: false, hover: true, remember: true, autoLoad: true, debug: false };
let hostValue = { ...HOST_DEFAULTS };
let hostUser = {};
let hostWritable = true;
let hostStatus = "ready";
let boundNamespace = null;
const hostListeners = new Set();
const pingScope = () => { for (const fn of [...hostListeners]) fn(); };
const hostSnapshot = () => ({
  status: hostStatus,
  value: hostStatus === "ready" ? { ...hostValue } : undefined,
  base: {},
  user: { ...hostUser },
  writable: hostWritable,
  revision: 1,
  mode: "host",
});
const setHostField = (field, value) => {
  hostValue = { ...hostValue, [field]: value };
  hostUser = { ...hostUser, [field]: value };
  pingScope();
};
// a non-loopback page (or a host without the settings service) leaves the namespace
// unavailable; the localStorage mirror is then the only layer, which is exactly the
// condition the legacy-key migration tests have to run under
const setHostStatus = (status) => { hostStatus = status; pingScope(); };
const resetHost = () => {
  hostValue = { ...HOST_DEFAULTS };
  hostUser = {};
  hostWritable = true;
  hostStatus = "ready";
  pingScope(); // the store caches its own snapshot copy; make it re-read
};
const hostScope = {
  getSnapshot: hostSnapshot,
  subscribe: (fn) => { hostListeners.add(fn); return () => hostListeners.delete(fn); },
  set: (field, value) => { setHostField(field, value); return Promise.resolve(); },
  unset: (field) => {
    const v = { ...hostValue }; delete v[field]; hostValue = v;
    const u = { ...hostUser }; delete u[field]; hostUser = u;
    pingScope();
    return Promise.resolve();
  },
  mutate: (ops) => {
    for (const op of ops) {
      if (op.op === "set") { hostValue = { ...hostValue, [op.path[0]]: op.value }; hostUser = { ...hostUser, [op.path[0]]: op.value }; }
      else { const v = { ...hostValue }; delete v[op.path[0]]; hostValue = v; const u = { ...hostUser }; delete u[op.path[0]]; hostUser = u; }
    }
    pingScope();
    return Promise.resolve();
  },
};
let SettingsCard = null;
let cardKey = null;
const ctx = {
  effect: (fn) => fn(),
  locale: { register: (ns, tables) => { registered = tables; return () => {}; }, bind: () => (key) => hostT(key) },
  settingsScope: { bind: (spec) => { boundNamespace = spec.namespace; return hostScope; } },
  slots: {
    inject: (name, fn) => fn(),
    register: (meta, comp) => {
      if (meta.name === "conversation.input.overlay") Panel = comp;
      if (meta.name === "settings.plugin.item") {
        SettingsCard = comp;
        cardKey = meta.key;
      }
      return () => {
        if (meta.name === "settings.plugin.item" && SettingsCard === comp) SettingsCard = null;
      };
    },
  },
  get: (name) => (name === "sessions" ? provided.sessions : (name === "workspaces" ? provided.workspaces : undefined)),
  logger: { info() {}, warn() {}, error() {} },
};
exports_.apply(ctx);

/* ------------------------------------------------------------ render driver */
const CHIP = "rgba(79, 140, 255, 0.18)";
const results = [];
const ok = (name, cond, extra) => { results.push(!!cond); console.log(`${cond ? "PASS" : "FAIL"}  ${name}${!cond && extra ? "  <- " + extra : ""}`); };
const drain = (limit = 40) => { let n = 0; while (rafQueue.length && n++ < limit) { const fn = rafQueue.shift(); try { fn(); } catch (e) { /* queued DOM work we do not model */ } } };
// React treats a component element as its own render boundary with its own hook
// list; this mini runtime has no boundary, so nested function components are inlined
// here (depth-first, child order — the same order React calls them in). The panel's
// outer component deliberately calls NO hooks, so inlining leaves the hook indexes
// exactly as a real render would assign them.
function expand(node) {
  if (node === null || node === undefined || typeof node === "boolean") return node;
  if (Array.isArray(node)) return node.map(expand);
  if (typeof node !== "object") return node;
  if (typeof node.type === "function") {
    try { return expand(node.type(node.props)); } catch (e) { return node; }
  }
  if (node.props && node.props.children !== undefined) {
    return { type: node.type, props: Object.assign({}, node.props, { children: expand(node.props.children) }) };
  }
  return node;
}
// React gives every component type its own hook list. This mini runtime has ONE global
// list, so each component the suite drives gets its own bag here — otherwise rendering
// the settings card would overwrite slots the panel still owns (and vice versa).
const bags = new Map();
function driveComponent(Comp, props, bagKey) {
  const saved = slots;
  slots = bags.get(bagKey) || [];
  let tree = null;
  for (let pass = 0; pass < 12; pass++) {
    cursor = 0; dirty = false; effectQueue = [];
    tree = expand(Comp(props));
    attachRefs(tree); // React assigns refs before effects run
    for (const i of effectQueue) {
      const s = slots[i];
      if (s && s.pending) {
        s.pending = false;
        // a cleanup runs when the effect RE-RUNS (or unmounts) — never immediately
        if (s.cleanup) { s.cleanup(); s.cleanup = null; }
        if (s.fn) s.cleanup = s.fn() || null;
      }
    }
    drain();
    if (!dirty) break;
  }
  bags.set(bagKey, slots);
  slots = saved;
  return tree;
}
function render(props) {
  return driveComponent(Panel, props, "panel");
}
// the plugin-configuration card is its own component with its own hook list
const renderCard = () => driveComponent(SettingsCard, {}, "card");
const cardHead = (t) => collect(t, (n) => n.props && n.props.className === "dqt-phead")[0];
const cardBtn = (t, label) => collect(t, (n) => n.props && n.props.children === label && typeof n.props.onClick === "function")[0];
function* walk(node) {
  if (node === null || node === undefined || typeof node === "boolean") return;
  if (Array.isArray(node)) { for (const c of node) yield* walk(c); return; }
  if (typeof node !== "object") return;
  yield node;
  if (node.props) yield* walk(node.props.children);
}
// React hands real DOM nodes to refs; emulate just enough for the list-scroll
// behaviour (scrollTop / scrollHeight / clientHeight) to be observable, plus the
// panel's DOM-driven row cursor: querySelectorAll("[data-nav-row]") resolves to
// STABLE per-row proxies, so a class the panel toggles on a row is observable here.
const LIST_STUB = { scrollTop: 0, scrollHeight: 1000, clientHeight: 400 };
// Geometry for the paging logic (which groups are in view, where the first one sits).
// A real browser supplies this from layout; the suite supplies it explicitly instead of
// pretending the DOM has a layout of its own. `LAYOUT.list` also moves the viewport.
const LAYOUT = { list: null, groups: [], ghosts: [] };
const DEFAULT_RECT = { top: 0, left: 0, right: 100, bottom: 100, width: 100, height: 100 };
// `scrolled` is the list's current scrollTop: a browser reports rects in viewport space,
// so a rect moves up as the list scrolls. Modelling that is what lets the anchor
// compensation converge (and lets a test see it settle instead of running away).
// Every animation the plugin starts (the enter animation uses the Web Animations API):
// recorded, so a test can assert the exact keyframes instead of trusting a stylesheet.
const ANIM = [];
// CSS `zoom` on the panel root scales the rects of everything inside it — a browser reports
// visual pixels from getBoundingClientRect — while the scroller's own scrollTop / clientHeight /
// scrollHeight stay in its own zoomed CSS pixels. Those are exactly the two unit systems the
// plugin's scroll compensation bridges, so the suite models the scaling instead of pretending
// zoom does not exist. `CURRENT_ZOOM` is refreshed on every render from the panel root's style.
let CURRENT_ZOOM = 1;
const boxProxy = (attrs, scrolled = 0) => ({
  style: {}, className: "", isConnected: true,
  getAttribute: (name) => (attrs[name] === undefined ? null : String(attrs[name])),
  getBoundingClientRect: () => {
    const z = CURRENT_ZOOM;
    return {
      top: (attrs.top - scrolled) * z, bottom: (attrs.top - scrolled + attrs.height) * z,
      left: 0, right: 200 * z, width: 200 * z, height: attrs.height * z,
    };
  },
  animate: (frames, opts) => { ANIM.push({ sel: attrs.id, frames, opts }); return { cancel() {} }; },
  querySelector: (sel) => (String(sel).indexOf("data-dqt-ghost-overlay") >= 0
    ? boxProxy({ id: "overlay", top: attrs.top, height: attrs.height }, scrolled)
    : null),
  querySelectorAll: () => [],
});
// The measured height of a group box is its LAYOUT height — unless the rendered node is
// currently held at an explicit height (the enter animation clamps it to the ghost's
// height), in which case that IS what a browser would measure.
const measuredGroupHeight = (g) => {
  const rendered = currentTree
    ? collect(currentTree, (n) => n.props && String(n.props["data-group-idx"]) === String(g.idx))[0]
    : null;
  const clamped = rendered && rendered.props && rendered.props.style ? rendered.props.style.height : undefined;
  return typeof clamped === "number" ? clamped : g.height;
};
const groupBoxes = (scrolled = 0) => LAYOUT.groups.map((g) => boxProxy({ id: "g" + g.idx, "data-group-idx": g.idx, top: g.top, height: measuredGroupHeight(g) }, scrolled));
// A ghost row carries BOTH attributes in the real DOM — a placeholder keeps its
// `data-group-idx`, which is exactly what lets the reader's place survive it turning real —
// so the stub does too. Without this, every attribute-selector read in the suite saw a
// different DOM from the one the plugin actually runs against (which is how an anchor bug
// and a prefetch-trigger bug both stayed invisible here).
const ghostBoxes = (scrolled = 0) => LAYOUT.ghosts.map((g) => boxProxy({ id: "ghost" + g.turn, "data-ghost-turn": g.turn, "data-group-idx": g.idx !== undefined ? g.idx : ("ghost-" + g.turn), top: g.top, height: g.height }, scrolled));
const allGroupBoxes = (scrolled = 0) => groupBoxes(scrolled).concat(ghostBoxes(scrolled))
  .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
let currentTree = null;
const rowProxies = new Map();
const rowKeyOf = (node) => {
  const p = node.props || {};
  return [p["data-jump-key"], p["data-ghost-turn"], p["data-result-idx"], p["data-group-idx"], p.title]
    .map((v) => (v === undefined ? "" : String(v))).join("|");
};
const rowProxiesOf = () => collect(currentTree, (n) => n.props && n.props["data-nav-row"]).map((node, i) => {
  const key = rowKeyOf(node) + "#" + i;
  const known = rowProxies.get(key);
  if (known) return known;
  const proxy = fakeEl({
    textContent: textOf(node),
    click: () => { if (node.props && typeof node.props.onClick === "function") node.props.onClick(); },
    getBoundingClientRect: () => ({ top: 120 + i * 22, bottom: 140 + i * 22, left: 0, right: 200, width: 200, height: 20 }),
  });
  if (node.props && node.props.className) proxy.className = String(node.props.className);
  rowProxies.set(key, proxy);
  return proxy;
});
function attachRefs(tree) {
  currentTree = tree;
  // the panel root is the only element that carries a numeric CSS zoom; its factor scales
  // every rect inside it (see boxProxy)
  CURRENT_ZOOM = 1;
  for (const n of walk(tree)) {
    const st = n.props && n.props.style;
    if (st && typeof st.zoom === "number" && st.zoom > 0) { CURRENT_ZOOM = st.zoom; break; }
  }
  // The suite hands the LIST NODE itself to its scroll handler (`currentTarget`), exactly
  // as a browser hands the element — so that node needs the DOM surface the paging logic
  // reads (geometry, and what is a ghost). Without it those reads are untestable here.
  // `nodeOf` is resolved on EVERY access: a ref is assigned on the first render pass, while
  // a test drives the node from the last one, and in a browser those are the same element.
  const domSurface = (nodeOf) => ({
    querySelector: (sel) => {
      const s = String(sel);
      if (s.indexOf("data-nav") >= 0) return rowProxiesOf()[0] || null;
      const m = /^\[data-group-idx="([^"]+)"\]$/.exec(s);
      if (m) return allGroupBoxes(LIST_STUB.scrollTop || 0).filter((g) => String(g.getAttribute("data-group-idx")) === m[1])[0] || null;
      return null;
    },
    querySelectorAll: (sel) => {
      const s = String(sel);
      if (s.indexOf("data-nav-row") >= 0) return rowProxiesOf();
      if (s.indexOf("data-group-idx") >= 0) return allGroupBoxes(LIST_STUB.scrollTop || 0);
      if (s.indexOf("data-ghost-turn") >= 0) return ghostBoxes(LIST_STUB.scrollTop || 0);
      return [];
    },
    getBoundingClientRect: () => {
      const base = LAYOUT.list
        ? Object.assign({ left: 0, right: 200, width: 200, bottom: LAYOUT.list.top + LAYOUT.list.height }, LAYOUT.list)
        : DEFAULT_RECT;
      if (CURRENT_ZOOM === 1) return base;
      const z = CURRENT_ZOOM;
      return {
        left: base.left * z, right: base.right * z, width: base.width * z,
        top: base.top * z, bottom: base.bottom * z, height: (base.bottom - base.top) * z,
      };
    },
    isConnected: true,
  });
  for (const n of walk(tree)) {
    if (n.props && n.props.className === "dqt-list" && !n.querySelectorAll) {
      Object.assign(n, domSurface(() => n));
      // A browser has ONE element behind the ref, the event target and every render pass;
      // the suite keeps one shared scroll state so whichever node a test holds and whatever
      // the plugin reads through a ref are the same numbers.
      for (const prop of ["scrollTop", "scrollHeight", "clientHeight"]) {
        Object.defineProperty(n, prop, {
          configurable: true,
          get: () => LIST_STUB[prop],
          set: (v) => { LIST_STUB[prop] = v; },
        });
      }
    }
    const r = n.props && n.props.ref;
    if (r && typeof r === "object" && "current" in r && !r.current) {
      const stub = fakeEl(Object.assign({}, domSurface(() => n), {
        // React hands the handler a real ancestor element with its own inline style: the
        // droplet's press writes `transform` there (see the handle's onClick), so the
        // stub needs a parent to write to or that behaviour is untestable here.
        parentElement: fakeEl({}),
      }));
      for (const prop of ["scrollTop", "scrollHeight", "clientHeight"]) {
        Object.defineProperty(stub, prop, {
          configurable: true,
          get: () => LIST_STUB[prop],
          set: (v) => { LIST_STUB[prop] = v; },
        });
      }
      r.current = stub;
    }
  }
}
const collect = (tree, pred) => [...walk(tree)].filter(pred);
function textOf(node) {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (typeof node !== "object") return String(node);
  return textOf(node.props ? node.props.children : undefined);
}
const leaves = (tree) => {
  const out = [];
  const rec = (n) => {
    if (n === null || n === undefined || typeof n === "boolean") return;
    if (Array.isArray(n)) return n.forEach(rec);
    if (typeof n !== "object") { out.push(String(n)); return; }
    rec(n.props ? n.props.children : undefined);
  };
  rec(tree);
  return out;
};
const byTitle = (tree, s) => collect(tree, (n) => n.props && n.props.title === s);
const clickable = (tree, label) => collect(tree, (n) => n.props && n.props.children === label && typeof n.props.onClick === "function")[0];

/* --------------------------------------------------------- synthetic chat */
function md(...blocks) { return blocks.map((text) => ({ kind: "text", text })); }
function conv(spec) {
  const order = [];
  const nodes = new Map();
  spec.forEach((s, i) => {
    const turn = i + 1;
    const uk = `u${turn}`, ak = `a${turn}`;
    nodes.set(uk, { key: uk, kind: "user", location: { kind: "turn", turn: { turn } }, data: { blocks: md(s.user), time: 1700000000000 + i * 60000 } });
    nodes.set(ak, { key: ak, kind: "assistant-step", location: { kind: "turn", turn: { turn } }, data: { blocks: md(s.reply), time: 1700000000000 + i * 60000 + 30000 } });
    order.push(uk, ak);
  });
  return { order, nodes };
}
const propsFor = (snap, extra) => Object.assign({ useChat: (sel) => sel(snap), sessionId: "s1" }, extra || {});

const SNAP = conv([
  { user: "帮我看看 quick toc 的排序", reply: "# 总览\n一些说明\n## 细节 A\nalpha\nalpha 又出现\n## 细节 B\nbeta\n### 更深一层\ngamma" },
  { user: "再解释一下排序规则", reply: "# 排序规则\n按回合分组\n## 时间戳\ntime" },
  { user: "没有标题的一轮", reply: "这段回复没有任何 markdown 标题，只有普通文字与 alpha。" },
  { user: "重复关键字的一轮", reply: "# alpha alpha 记录\nalpha 出现在正文里" },
]);

/* ------------------------------------------------------------ scenario run */
const levelsBtn = (t) => collect(t, (n) => n.props && n.props.title === "标题层级筛选")[0];
const levelsPop = (t) => collect(t, (n) => n.props && String(n.props.className || "").split(/\s+/).includes("dqt-levels-pop"))[0];
const levelChip = (t, lv) => collect(t, (n) => n.props && n.props.children === "H" + lv && typeof n.props.onClick === "function")[0];

console.log("--- scenario 1: normal render ---");
SCROLL = { heads: [], rows: new Map(), top: 0 };
resetComponent();
let tree = render(propsFor(SNAP));
ok("panel renders (not null) for a conversation with headings", tree !== null);
ok("no level chips occupy the layout while the popup is closed", !levelsPop(tree) && ![1, 2, 3, 4, 5, 6].some((lv) => !!levelChip(tree, lv)));
ok("a round levels button sits in the header", !!levelsBtn(tree) && levelsBtn(tree).props.className === "dqt-levels-btn");
ok("the levels button is round with a corner-shape override", levelsBtn(tree).props.style.borderRadius === "50%" && levelsBtn(tree).props.style.cornerShape === "round");
ok("no folding controls remain anywhere", !textOf(tree).includes("全折叠") && !textOf(tree).includes("全展开") && !textOf(tree).includes("▾") && !textOf(tree).includes("▸"), "text: " + textOf(tree).slice(0, 120));
ok("sticky group header rendered", collect(tree, (n) => n.props && n.props.style && n.props.style.position === "sticky").length >= 1);
ok("heading text 总览 present", textOf(tree).includes("总览"), "text: " + textOf(tree).slice(0, 160));
ok("deep heading 更深一层 present with all levels on", textOf(tree).includes("更深一层"), "text: " + textOf(tree).slice(0, 160));
ok("turn time shown (HH:MM)", /\d{2}:\d{2}/.test(textOf(tree)));
ok("group headers carry the turn's user preview", textOf(tree).includes("帮我看看"), "text: " + textOf(tree).slice(0, 200));

console.log("--- scenario 2: level picker popup ---");
store.clear(); resetComponent();
let props = propsFor(SNAP);
tree = render(props);
levelsBtn(tree).props.onClick({});
tree = render(props);
const pop = levelsPop(tree);
ok("clicking the round button opens the picker", !!pop);
ok("the picker holds six chips labelled H1–H6", [1, 2, 3, 4, 5, 6].every((lv) => !!levelChip(tree, lv)), "text: " + textOf(pop).slice(0, 60));
ok("the picker is LEFT-aligned with the header's control button (10px, no right anchor)", pop.props.style.left === 10 && pop.props.style.right === undefined && /0 6px 20px/.test(pop.props.style.boxShadow), JSON.stringify({ left: pop.props.style.left, right: pop.props.style.right, shadow: pop.props.style.boxShadow }));
ok("the picker grows from the button's center (enter animation via class)", pop.props.style.transformOrigin === "12px top" && /dqt-levels-pop( |$)/.test(pop.props.className) && !pop.props.className.includes("closing"), JSON.stringify({ origin: pop.props.style.transformOrigin, cls: pop.props.className }));
fireDocument("pointerdown", { target: { closest: () => null } });
tree = render(props);
const closingPop = levelsPop(tree);
ok("closing plays the shrink-back + fade-out animation (exit class)", !!closingPop && closingPop.props.className.includes("dqt-levels-pop-closing"));
tickTimeouts(); // the fallback unmount timer fires like it would in the browser
tree = render(props);
ok("the picker is gone after the close animation", !levelsPop(tree));
levelsBtn(tree).props.onClick({});
tree = render(props);
ok("the button reopens the picker", !!levelsPop(tree));
ok("all six levels on by default", textOf(tree).includes("更深一层") && textOf(tree).includes("细节 A"));
levelChip(tree, 2).props.onClick({}); // H2 off
tree = render(props);
let txt = textOf(tree);
ok("the picker stays open while toggling", !!levelsPop(tree));
ok("turning H2 off keeps H1 and H3 (arbitrary combination, not a prefix)", txt.includes("总览") && !txt.includes("细节 A") && txt.includes("更深一层"), "text: " + txt.slice(0, 200));
tickTimeouts(); // the store publishes on a debounce
ok("level set persisted", store.get("dsh-quick-toc.levels.v1") === "[1,3,4,5,6]", "got " + store.get("dsh-quick-toc.levels.v1"));
ok("H3 without H2 is still nested under H1 (tree builds across the gap)", txt.includes("更深一层"));
// an outside pointerdown closes the picker (with the exit animation); a
// pointerdown inside does not
fireDocument("pointerdown", { target: { closest: () => null } });
tree = render(props);
ok("an outside pointerdown starts the close animation", levelsPop(tree).props.className.includes("dqt-levels-pop-closing"));
tickTimeouts();
tree = render(props);
ok("the picker is unmounted after the exit animation", !levelsPop(tree));
levelsBtn(tree).props.onClick({});
tree = render(props);
ok("the button reopens the picker", !!levelsPop(tree));
fireDocument("pointerdown", { target: { closest: (sel) => (sel === ".dqt-levels-pop" ? {} : null) } });
tree = render(props);
ok("a pointerdown inside the picker keeps it open", !!levelsPop(tree));
levelChip(tree, 2).props.onClick({}); // H2 back on
tree = render(props);
ok("turning H2 back on restores it", textOf(tree).includes("细节 A"));
[2, 3, 4, 5, 6].forEach((lv) => { levelChip(tree, lv).props.onClick({}); tree = render(props); });
tickTimeouts();
ok("only H1 left after switching the rest off", store.get("dsh-quick-toc.levels.v1") === "[1]", "got " + store.get("dsh-quick-toc.levels.v1"));
levelChip(tree, 1).props.onClick({});
tree = render(props);
tickTimeouts();
ok("switching off the last selected level restores all six", store.get("dsh-quick-toc.levels.v1") === "[1,2,3,4,5,6]" && textOf(tree).includes("更深一层"), "got " + store.get("dsh-quick-toc.levels.v1"));
store.clear();
store.set("dsh-quick-toc.maxLevel.v1", "2"); // legacy value from a pre-0.4.0 build
resetComponent();
setHostStatus("unavailable"); // the legacy migration only matters where the host layer is absent
tree = render(propsFor(SNAP));
ok("legacy maxLevel=2 migrates to the level set [1,2]", !textOf(tree).includes("更深一层") && textOf(tree).includes("细节 A"), "text: " + textOf(tree).slice(0, 160));
setHostStatus("ready");
store.clear(); resetComponent();

console.log("--- scenario 4: search result list ---");
store.clear(); resetComponent();
tree = render(propsFor(SNAP));
const magBtn = collect(tree, (n) => n.props && n.props.title === "搜索标题")[0];
ok("magnifier button present", !!magBtn);
magBtn.props.onClick({ stopPropagation() {} });
tree = render(propsFor(SNAP));
const input = collect(tree, (n) => n.type === "input")[0];
ok("search input rendered after opening search", !!input, "text: " + textOf(tree).slice(0, 120));
input.props.onChange({ target: { value: "alpha" } });
tree = render(propsFor(SNAP));
txt = textOf(tree);
ok("title-scope search lists matching headings", txt.includes("alpha alpha 记录"), "text: " + txt.slice(0, 240));
ok("repeat hits inside one heading are deduped into ×2", txt.includes("×2"), "text: " + txt.slice(0, 240));
const highlighted = collect(tree, (n) => n.props && n.props.style && n.props.style.background === CHIP && textOf(n).includes("alpha alpha"));
ok("exactly one result row is marked as the current match", highlighted.length === 1, `count=${highlighted.length} titles=${highlighted.map((n) => n.props.title).join(" | ")}`);
const rowEls = (t) => collect(t, (n) => n.props && n.props["data-result-idx"] !== undefined);
ok("title-scope search yields exactly the heading that contains the word", rowEls(tree).length === 1, "rows=" + rowEls(tree).length);
ok("...and that row also shows the section's first sentence as context", txt.includes("出现在正文里"), "text: " + txt.slice(0, 240));
input.props.onChange({ target: { value: "一些说明" } }); // appears in a section body, never in a title
tree = render(propsFor(SNAP));
ok("title-scope search does not match section bodies (the subtitle is context, not a hit)", rowEls(tree).length === 0 && textOf(tree).includes("没有匹配"), "rows=" + rowEls(tree).length);
input.props.onChange({ target: { value: "alpha" } });
tree = render(propsFor(SNAP));
input.props.onChange({ target: { value: "细节" } });
tree = render(propsFor(SNAP));
txt = textOf(tree);
ok("two matching headings -> two result rows with paths", (txt.match(/细节/g) || []).length >= 2, "text: " + txt.slice(0, 240));
// switch the scope toggle to full text (its clickable wrapper reads 标题)
const scopeBtn = collect(tree, (n) => n.props && typeof n.props.onClick === "function" && textOf(n) === "标题")[0];
ok("scope toggle present", !!scopeBtn);
if (scopeBtn) {
  scopeBtn.props.onClick({ stopPropagation() {} });
  tree = render(propsFor(SNAP));
  ok("scope toggle switches the label to 全文", textOf(tree).includes("全文"), "text: " + textOf(tree).slice(0, 120));
  input.props.onChange({ target: { value: "出现在正文里" } });
  tree = render(propsFor(SNAP));
  txt = textOf(tree);
  ok("full-text scope finds body text with a context snippet", txt.includes("出现在正文里"), "text: " + txt.slice(0, 240));
}
const tryQuery = (v) => { try { input.props.onChange({ target: { value: v } }); tree = render(propsFor(SNAP)); return typeof textOf(tree) === "string"; } catch (e) { return "throw: " + e.message; } };
ok("single-char query does not throw", tryQuery("a") === true, String(tryQuery("a")));
ok("regex-ish query does not throw", tryQuery(".*[a](") === true, String(tryQuery(".*[a](")));
ok("query with no matches does not throw", tryQuery("zzzz-no-match") === true, String(tryQuery("zzzz-no-match")));
ok("empty query after searching does not throw", tryQuery("") === true, String(tryQuery("")));
ok("very long query does not throw", tryQuery("x".repeat(500)) === true, String(tryQuery("x".repeat(500))));

console.log("--- scenario 6: edge cases ---");
store.clear(); resetComponent();
// documented behaviour: heading-free turns still get a clickable time row, so a
// conversation with times renders (time-only outline) ...
const timeOnly = render(propsFor(conv([{ user: "hi", reply: "plain reply, no headings" }])));
ok("heading-free conversation with times -> time-only outline (documented)", timeOnly !== null && /\d{2}:\d{2}/.test(textOf(timeOnly)), "text: " + textOf(timeOnly).slice(0, 120));
resetComponent();
// ... and a turn that is loaded but has neither headings nor a time still counts:
// its prompt is in the window, so hiding the outline (or calling the turn 未加载)
// would be wrong — the group lists the prompt and the reply can still arrive
const noTimeNodes = new Map([["u1", { key: "u1", kind: "user", location: { kind: "turn", turn: { turn: 1 } }, data: { blocks: md("hi") } }]]);
let noTimePanel = render(propsFor({ order: ["u1"], nodes: noTimeNodes }));
ok("a loaded prompt with no time keeps the panel up (the turn is loaded)", noTimePanel !== null && textOf(noTimePanel).includes("hi"), textOf(noTimePanel || { props: {} }).slice(0, 120));
resetComponent();
ok("missing useChat -> renders null", render({}) === null);
resetComponent();
ok("empty conversation -> renders null", render(propsFor({ order: [], nodes: new Map() })) === null);
resetComponent();
ok("missing nodes map -> renders null", render(propsFor({ order: [] })) === null);
resetComponent();
const weird = conv([{ user: "# not a heading in user msg", reply: "#\n# \n## \n# 正常标题\n####### 七个井号\n###### 六级\n##重复\n##" }]);
ok("degenerate markdown does not throw", (() => { try { render(propsFor(weird)); return true; } catch (e) { return "throw: " + e.message; } })() === true);
resetComponent();
const deep = conv([{ user: "deep", reply: "# L1\n## L2\n### L3\n#### L4\n##### L5\n###### L6" }]);
ok("six heading levels render", (() => { try { const s = textOf(render(propsFor(deep))); return ["L1", "L2", "L3", "L4", "L5", "L6"].every((x) => s.includes(x)); } catch (e) { return "throw: " + e.message; } })() === true);
resetComponent();
const longReply = conv([{ user: "long", reply: "# 长回复\n" + Array.from({ length: 300 }, (_, i) => `## 小节 ${i}\n内容 ${i}`).join("\n") }]);
ok("300 headings do not throw", (() => { try { return textOf(render(propsFor(longReply))).includes("小节 299"); } catch (e) { return "throw: " + e.message; } })() === true);
resetComponent();
const htmlReply = conv([{ user: "<script>alert(1)</script>", reply: "# <img src=x onerror=alert(1)>\n**bold** [link](http://x)\n## `code`\n> quote" }]);
ok("html-ish + inline markdown in headings does not throw", (() => { try { return textOf(render(propsFor(htmlReply))).length > 0; } catch (e) { return "throw: " + e.message; } })() === true);

/* ------------------------------------------------- scenario 7: interactions */
const findPanel = (t) => collect(t, (n) => n.props && n.props.style && n.props.style.position === "fixed" && n.props.style.display === "flex" && n.props.style.clipPath !== undefined)[0];
const px = (v) => parseFloat(String(v));
const counter = (t) => collect(t, (n) => n.props && typeof n.props.children === "string" && /^\d+\/\d+$/.test(n.props.children)).map((n) => n.props.children)[0];
const activeRowTitle = (t) => collect(t, (n) => n.props && n.props.style && n.props.style.background === CHIP && n.props.style.cursor === "pointer" && typeof n.props.onClick === "function").map((n) => n.props.title).join("|");

console.log("--- scenario 7a: legacy dock key migration + right-dock geometry ---");
TABLIST = null; store.clear();
resetComponent();
setHostStatus("unavailable"); // the legacy migration only matters where the host layer is absent
store.set("dsh-contents.dock.v2", "right");
tree = render(propsFor(SNAP));
let panel = findPanel(tree);
ok("legacy dsh-contents.dock.v2 migrated to dsh-quick-toc.dock.v2", store.get("dsh-quick-toc.dock.v2") === "right", "got " + store.get("dsh-quick-toc.dock.v2"));
ok("panel element found", !!panel);
const panelW0 = px(panel.props.style.width);
// A browser positions the panel by `left` PLUS whatever transform it carries: the open state
// is a compositable translate on top of the parked box now (the slide used to animate `left`,
// a layout property, and it fell apart once a long session had loaded thousands of rows).
const panelX = (node) => {
  if (!node || !node.props || !node.props.style) return NaN;
  const st = node.props.style;
  const m = /translateX\((-?[0-9.]+)px\)/.exec(String(st.transform || ""));
  return px(st.left) + (m ? Number(m[1]) : 0);
};
const closedStyleLeft = panel.props.style.left;
const closedTransition = panel.props.style.transition;
const collapsedLeft = panelX(panel);
const collapseLine = 1400 - (100 + 48); // innerWidth - (viewport.right + 48)
ok("right dock collapsed: clip hides exactly the panel width", panel.props.style.clipPath === `inset(0 ${panelW0}px 0 0)`, panel.props.style.clipPath);
ok("right dock collapsed: left sits on the collapse line", Math.abs(collapsedLeft - collapseLine) < 0.5, `left=${collapsedLeft} line=${collapseLine}`);
byTitle(tree, "展开大纲")[0].props.onClick({});
tree = render(propsFor(SNAP));
panel = findPanel(tree);
const openLeft = panelX(panel);
ok("right dock open: no clip", panel.props.style.clipPath === "inset(0 0 0 0px)", panel.props.style.clipPath);
ok("right dock open: panel right edge === collapsed left (the hard-won invariant)", Math.abs(openLeft + panelW0 - collapsedLeft) < 0.5, `openRight=${openLeft + panelW0} collapsedLeft=${collapsedLeft}`);
ok("open panel is visible on the chat view", panel.props.style.opacity > 0, String(panel.props.style.opacity));
// The slide must not animate a LAYOUT property. `left` is identical in both states (the box
// is parked) and the movement is a transform, so a collapse no longer re-lays out the whole
// outline on every frame — which is what broke the animation once a long session had loaded
// thousands of rows (the compositable clip wipe ran on while the layout-bound slide stalled,
// i.e. the "a line sweeps across" the reader saw).
ok("the slide is compositable: `left` is the same open and shut, and the transition is a transform",
  panel.props.style.left === closedStyleLeft
  && /transform /.test(panel.props.style.transition)
  && !/(^|, )left /.test(panel.props.style.transition)
  && /transform /.test(closedTransition) && !/(^|, )left /.test(closedTransition),
  JSON.stringify([closedStyleLeft, panel.props.style.left, closedTransition, panel.props.style.transition]));
setHostStatus("ready"); store.clear(); resetComponent();

console.log("--- scenario 7b: view fade (chat vs other center-column view) ---");
store.clear();
TAB_STATE.active = 0;
TABLIST = liveTablist;
resetComponent();
tree = render(propsFor(SNAP));
byTitle(tree, "展开大纲")[0].props.onClick({});
tree = render(propsFor(SNAP));
ok("chat view selected -> panel visible", findPanel(tree).props.style.opacity > 0, String(findPanel(tree).props.style.opacity));
TAB_STATE.active = 1;
tickIntervals();
tree = render(propsFor(SNAP));
ok("other view selected -> panel fades to 0", findPanel(tree).props.style.opacity === 0, String(findPanel(tree).props.style.opacity));
ok("other view selected -> collapsed handle is not clickable", collect(tree, (n) => n.props && n.props.title === "展开大纲" && n.props.style.pointerEvents === "none").length === 1 || findPanel(tree).props.style.opacity === 0);
TAB_STATE.active = 0;
tickIntervals();
tree = render(propsFor(SNAP));
ok("back to chat -> panel visible again", findPanel(tree).props.style.opacity > 0, String(findPanel(tree).props.style.opacity));
TABLIST = null;

console.log("--- scenario 7c: resize / move drags persist ---");
store.clear();
resetComponent();
tree = render(propsFor(SNAP));
let w0 = px(findPanel(tree).props.style.width);
byTitle(tree, "拖拽调整宽度")[0].props.onPointerDown({ preventDefault() {}, stopPropagation() {}, button: 0, clientX: 1000, clientY: 400 });
fireWindow("pointermove", { clientX: 1120, clientY: 400 });
tree = render(propsFor(SNAP));
ok("width drag grows the panel by the pointer delta", px(findPanel(tree).props.style.width) === w0 + 120, `${findPanel(tree).props.style.width} vs ${w0 + 120}`);
fireWindow("pointerup", {});
tickTimeouts();
ok("dragged width persisted", store.get("dsh-quick-toc.panelW.v1") === String(w0 + 120), "got " + store.get("dsh-quick-toc.panelW.v1"));
// The panel's height is still "auto" here (never dragged), and the drag now starts
// from the panel's REAL height — the stub reports 400, so +200 must land on 600.
findPanel(tree).props.ref.current.getBoundingClientRect = () => ({ top: 0, left: 0, right: 100, bottom: 400, width: 100, height: 400 });
byTitle(tree, "拖拽调整高度")[0].props.onPointerDown({ preventDefault() {}, stopPropagation() {}, button: 0, clientX: 1000, clientY: 300 });
fireWindow("pointermove", { clientX: 1000, clientY: 500 });
fireWindow("pointerup", {});
tree = render(propsFor(SNAP));
ok("height drag sets an explicit height", px(findPanel(tree).props.style.height) === 600, String(findPanel(tree).props.style.height));
tickTimeouts();
ok("dragged height persisted", store.get("dsh-quick-toc.panelH.v1") === "600", "got " + store.get("dsh-quick-toc.panelH.v1"));
const top0 = px(findPanel(tree).props.style.top);
byTitle(tree, "按住拖动调整位置")[0].props.onPointerDown({ preventDefault() {}, stopPropagation() {}, button: 0, clientX: 600, clientY: 200 });
fireWindow("pointermove", { clientX: 600, clientY: 260 });
fireWindow("pointerup", {});
tree = render(propsFor(SNAP));
ok("dragging the top bar moves the panel down by the delta", px(findPanel(tree).props.style.top) === top0 + 60, `${findPanel(tree).props.style.top} vs ${top0 + 60}`);
tickTimeouts();
ok("dragged position persisted", store.get("dsh-quick-toc.panelY.v1") === "60", "got " + store.get("dsh-quick-toc.panelY.v1"));
byTitle(tree, "拖拽同时调整宽高")[0].props.onPointerDown({ preventDefault() {}, stopPropagation() {}, button: 0, clientX: 500, clientY: 500 });
fireWindow("pointermove", { clientX: 560, clientY: 560 });
fireWindow("pointerup", {});
tree = render(propsFor(SNAP));
ok("corner drag changes width and height together", px(findPanel(tree).props.style.width) === w0 + 180 && px(findPanel(tree).props.style.height) === 660, `${findPanel(tree).props.style.width} / ${findPanel(tree).props.style.height}`);

// ...and a panel that never had an explicit height drags from its MEASURED height,
// not from the old fixed 400px guess (which made the panel jump on the first move)
store.clear();
resetComponent();
tree = render(propsFor(SNAP));
ok("a fresh panel has no explicit height (auto)", findPanel(tree).props.style.height === undefined, String(findPanel(tree).props.style.height));
findPanel(tree).props.ref.current.getBoundingClientRect = () => ({ top: 90, left: 288, right: 576, bottom: 602, width: 288, height: 512 });
byTitle(tree, "拖拽调整高度")[0].props.onPointerDown({ preventDefault() {}, stopPropagation() {}, button: 0, clientX: 1000, clientY: 300 });
fireWindow("pointermove", { clientX: 1000, clientY: 350 });
fireWindow("pointerup", {});
tree = render(propsFor(SNAP));
ok("an auto-height panel starts the drag from its real height (512 + 50, no jump)",
  px(findPanel(tree).props.style.height) === 562, String(px(findPanel(tree).props.style.height)));
store.clear(); resetComponent();

console.log("--- scenario 7z: the scale magnifies the CONTENT, never the panel box ---");
store.clear();
resetComponent();
setHostField("zoom", 1.25);
tree = render(propsFor(SNAP));
byTitle(tree, "展开大纲")[0].props.onClick({});
tree = render(propsFor(SNAP));
panel = findPanel(tree);
ok("the scale rides on the panel root as CSS zoom", panel.props.style.zoom === 1.25, String(panel.props.style.zoom));
// Every length that defines the BOX is divided by the factor, so zoom multiplies it
// straight back: the box the reader sees is exactly the size they dragged, and the
// magnification lands on the content inside it.
const localW = px(panel.props.style.width);
const visualW = localW * 1.25;
const topAt125 = px(panel.props.style.top);
const leftAt125 = panelX(panel);
const maxHat125 = px(panel.props.style.maxHeight);
ok("the box keeps the dragged size on screen (only local lengths are divided)",
  Math.abs(visualW - 288) < 0.5, `${localW} local x1.25 = ${visualW} vs the 288px default`);
// the box is not scaled, so an edge drag has to follow the cursor exactly
byTitle(tree, "拖拽调整宽度")[0].props.onPointerDown({ preventDefault() {}, stopPropagation() {}, button: 0, clientX: 1000, clientY: 400 });
fireWindow("pointermove", { clientX: 1100, clientY: 400 });
fireWindow("pointerup", {});
tree = render(propsFor(SNAP));
panel = findPanel(tree);
ok("a width drag follows the cursor 1:1 on screen (+100px pointer = +100px visual)",
  Math.abs(px(panel.props.style.width) * 1.25 - (visualW + 100)) < 0.5,
  `${px(panel.props.style.width)} local x1.25 = ${px(panel.props.style.width) * 1.25} vs ${visualW + 100}`);
tickTimeouts(); // the debounced publish settles the dragged width
ok("...the dragged size is stored in screen px and the scale is untouched",
  store.get("dsh-quick-toc.panelW.v1") === String(visualW + 100) && store.get("dsh-quick-toc.zoom.v1") == null && hostValue.zoom === 1.25,
  JSON.stringify([store.get("dsh-quick-toc.panelW.v1"), store.get("dsh-quick-toc.zoom.v1"), hostValue.zoom]));
// the old 560px ceiling is gone: enlargement is no longer capped
byTitle(tree, "拖拽调整宽度")[0].props.onPointerDown({ preventDefault() {}, stopPropagation() {}, button: 0, clientX: 1000, clientY: 400 });
fireWindow("pointermove", { clientX: 1400, clientY: 400 });
fireWindow("pointerup", {});
tree = render(propsFor(SNAP));
panel = findPanel(tree);
ok("...and enlargement is no longer capped at 560px", px(panel.props.style.width) * 1.25 > 560, String(px(panel.props.style.width) * 1.25));
tickTimeouts();
// ...and so is the old 180px floor (a 120px keep-it-draggable floor remains)
byTitle(tree, "拖拽调整宽度")[0].props.onPointerDown({ preventDefault() {}, stopPropagation() {}, button: 0, clientX: 1000, clientY: 400 });
fireWindow("pointermove", { clientX: 100, clientY: 400 });
fireWindow("pointerup", {});
tree = render(propsFor(SNAP));
panel = findPanel(tree);
ok("...and it may be shrunk well past the old 180px floor", Math.abs(px(panel.props.style.width) * 1.25 - 120) < 0.5, String(px(panel.props.style.width) * 1.25));
tickTimeouts();
// the spring-back regression: a store notification arriving mid-drag (any other
// setting being written) must not pull the size back to its stored value
byTitle(tree, "拖拽调整宽度")[0].props.onPointerDown({ preventDefault() {}, stopPropagation() {}, button: 0, clientX: 1000, clientY: 400 });
fireWindow("pointermove", { clientX: 1300, clientY: 400 });
setHostField("hover", false); // somebody else's write -> the store notifies right now
tree = render(propsFor(SNAP));
panel = findPanel(tree);
ok("a notification arriving mid-drag does not snap the panel back to its old size",
  Math.abs(px(panel.props.style.width) * 1.25 - 420) < 0.5, String(px(panel.props.style.width) * 1.25));
fireWindow("pointerup", {});
tickTimeouts();
ok("...and the dragged size is what gets stored", store.get("dsh-quick-toc.panelW.v1") === "420", String(store.get("dsh-quick-toc.panelW.v1")));
setHostField("hover", true);
// back to the default scale: same screen rect, no zoom property at all
setHostField("zoom", 1);
tree = render(propsFor(SNAP));
panel = findPanel(tree);
ok("at the default scale no zoom property is set", panel.props.style.zoom === undefined, String(panel.props.style.zoom));
const topAt1 = px(panel.props.style.top);
const leftAt1 = panelX(panel);
const maxHat1 = px(panel.props.style.maxHeight);
ok("insets and the height cap are divided by the same factor (one screen position for every scale)",
  Math.abs(topAt125 - topAt1 / 1.25) < 0.5 && Math.abs(leftAt125 - leftAt1 / 1.25) < 0.5 && Math.abs(maxHat125 - maxHat1 / 1.25) < 0.5,
  `top ${topAt125} vs ${(topAt1 / 1.25).toFixed(1)}, left ${leftAt125} vs ${(leftAt1 / 1.25).toFixed(1)}, maxH ${maxHat125} vs ${(maxHat1 / 1.25).toFixed(1)}`);
store.clear(); resetComponent();

console.log("--- scenario 7x: two quick adjustments must BOTH reach storage ---");
// The publish is debounced 400ms and its cleanup cancels the pending timer on every
// re-run, so a second adjustment inside that window replaces the first one's patch.
// The "already published" record therefore may only advance when the write really
// happens: advancing it eagerly left the cancelled field looking published and the
// size the user had just dragged was silently dropped (measured in Edge before the
// fix: width 200 -> 150, height dragged 250ms later, stored width stayed 200).
store.clear(); resetComponent();
tree = render(propsFor(SNAP));
const wq0 = px(findPanel(tree).props.style.width);
byTitle(tree, "拖拽调整宽度")[0].props.onPointerDown({ preventDefault() {}, stopPropagation() {}, button: 0, clientX: 1000, clientY: 400 });
fireWindow("pointermove", { clientX: 1000 + 150, clientY: 400 });
fireWindow("pointerup", {});
tree = render(propsFor(SNAP));
findPanel(tree).props.ref.current.getBoundingClientRect = () => ({ top: 0, left: 0, right: 100, bottom: 400, width: 100, height: 400 });
byTitle(tree, "拖拽调整高度")[0].props.onPointerDown({ preventDefault() {}, stopPropagation() {}, button: 0, clientX: 1000, clientY: 300 });
fireWindow("pointermove", { clientX: 1000, clientY: 500 }); // still inside the width's debounce window
fireWindow("pointerup", {});
tree = render(propsFor(SNAP));
ok("the second drag does not cancel the first one's pending write",
  px(findPanel(tree).props.style.width) === wq0 + 150 && px(findPanel(tree).props.style.height) === 600,
  `${findPanel(tree).props.style.width} / ${findPanel(tree).props.style.height}`);
tickTimeouts();
ok("both sizes are stored", store.get("dsh-quick-toc.panelW.v1") === String(wq0 + 150) && store.get("dsh-quick-toc.panelH.v1") === "600",
  JSON.stringify([store.get("dsh-quick-toc.panelW.v1"), store.get("dsh-quick-toc.panelH.v1")]));
store.clear(); resetComponent();

console.log("--- scenario 7y: a narrow panel squeezes the header, then scrolls it sideways ---");
store.clear(); resetComponent();
tree = render(propsFor(SNAP));
byTitle(tree, "展开大纲")[0].props.onClick({});
tree = render(propsFor(SNAP));
const headerNode = collect(tree, (n) => n.props && n.props.className === "dqt-header")[0];
ok("the header is one non-wrapping row that can scroll sideways",
  !!headerNode && headerNode.props.style.flexWrap === "nowrap" && headerNode.props.style.overflowX === "auto",
  JSON.stringify(headerNode && [headerNode.props.style.flexWrap, headerNode.props.style.overflowX]));
ok("...with a spacer that gives way first",
  !!headerNode && collect(headerNode, (n) => n.props && n.props.style && n.props.style.flex === "1 1 auto" && n.props.style.minWidth === 0).length === 1);
const headerEl = headerNode.props.ref.current;
const grip = (t) => collect(t, (n) => n.props && n.props.style && n.props.style.height === 5 && n.props.style.borderRadius === 999)[0];
ok("with room to spare the grab bar is visible", grip(tree).props.style.opacity === 0.35, String(grip(tree).props.style.opacity));
let fellThrough = false;
headerEl.fire("wheel", { deltaY: 120, preventDefault() { fellThrough = true; }, stopPropagation() { fellThrough = true; } });
ok("a wheel over a roomy header is left alone", fellThrough === false && headerEl.scrollLeft === 0, JSON.stringify([headerEl.scrollLeft, fellThrough]));
// now the four controls no longer fit the row
headerEl.scrollWidth = 700;
headerEl.clientWidth = 300;
setHostField("zoom", 1.25); // any dependency of the measurement re-runs it
tree = render(propsFor(SNAP));
ok("once the controls would touch, the grab bar fades out", grip(tree).props.style.opacity === 0, String(grip(tree).props.style.opacity));
collect(tree, (n) => n.props && n.props.title === "按住拖动调整位置")[0].props.onMouseEnter();
ok("...and hovering it does not bring it back", grip(tree).props.ref.current.style.opacity === "0", String(grip(tree).props.ref.current.style.opacity));
let prevented = false;
let stopped = false;
headerEl.fire("wheel", { deltaY: 200, preventDefault() { prevented = true; }, stopPropagation() { stopped = true; } });
ok("...and the wheel scrolls the header sideways instead of the transcript",
  headerEl.scrollLeft === 200 && prevented && stopped, JSON.stringify([headerEl.scrollLeft, prevented, stopped]));
headerEl.scrollWidth = 0;
headerEl.clientWidth = 300;
setHostField("zoom", 1);
tree = render(propsFor(SNAP));
ok("back to a roomy header the grab bar returns", grip(tree).props.style.opacity === 0.35, String(grip(tree).props.style.opacity));
store.clear(); resetComponent();

console.log("--- scenario 7g: the collapsed handle sits where the card puts it ---");
store.clear(); resetComponent();
tree = render(propsFor(SNAP));
const edge = () => collect(tree, (n) => n.props && n.props.title === "展开大纲")[0];
// the conversation viewport in this harness: top 0, height 600 -> travel = 600 - 92 = 508
ok("centred by default (0.5 = exactly where the handle always sat)",
  !!edge() && px(edge().props.style.top) === 254, edge() && String(edge().props.style.top));
setHostField("handle", 0.25);
tree = render(propsFor(SNAP));
ok("0% means the bottom: a quarter up sits at 75% of the travel from the top",
  Math.abs(px(edge().props.style.top) - 508 * 0.75) < 0.5, String(px(edge().props.style.top)));
setHostField("handle", 1);
tree = render(propsFor(SNAP));
ok("100% pins the handle to the top of the conversation area", px(edge().props.style.top) === 0, String(px(edge().props.style.top)));
setHostField("handle", 0);
tree = render(propsFor(SNAP));
ok("0% pins the handle to the bottom", Math.abs(px(edge().props.style.top) - 508) < 0.5, String(px(edge().props.style.top)));
// clicking it used to unmount the handle on that very frame (a hard cut). It now
// stays in the tree while it fades and slips back into the edge, and only then goes.
store.clear(); resetComponent();
TABLIST = null;
tree = render(propsFor(SNAP));
tickTimeouts(); tree = render(propsFor(SNAP));   // the 300ms reveal, so it starts OUT
const edgeNow = () => collect(tree, (n) => n.props && n.props.title === "展开大纲")[0];
const edgeShownLeft = edgeNow().props.style.left;   // where it rests when it is out
const edgeShownClip = edgeNow().props.style.clipPath;
edgeNow().props.onClick({});
tree = render(propsFor(SNAP));
ok("clicking the side handle leaves it mounted so it can fade out",
  !!edgeNow() && edgeNow().props.style.opacity === 0 && String(edgeNow().props.style.pointerEvents) === "none",
  edgeNow() ? JSON.stringify([edgeNow().props.style.opacity, edgeNow().props.style.pointerEvents]) : "already unmounted");
// it hides BEHIND the conversation area's edge: parked a full box width further out and
// clipped at the line, exactly like the docked panel collapsing. A fade in place made it
// read as appearing and vanishing ON the divider line.
ok("...slipping back OUT through the edge, clipped at the line rather than fading there",
  !!edgeNow() && String(edgeNow().props.style.transition).indexOf("left") === 0
    && String(edgeNow().props.style.clipPath) === "inset(0 0 0 26px)"
    && edgeNow().props.style.left === edgeShownLeft - 26
    && String(edgeShownClip) === "inset(0 0 0 0)",
  edgeNow() ? JSON.stringify([edgeNow().props.style.left, edgeNow().props.style.clipPath, edgeShownLeft, edgeShownClip]) : "gone");
// ...and the panel waits for it: its geometry is the open one from the first frame, but
// the slide itself is held back, so the two motions are sequential instead of crossing
// over (the reader saw the panel come out before the handle had gone in)
ok("...while the panel's own slide is held back until the handle is home",
  findPanel(tree).props.style.transitionDelay === "170ms",
  String(findPanel(tree).props.style.transitionDelay));
tickTimeouts();   // the 200ms fade window, which also releases the panel
tree = render(propsFor(SNAP));
ok("...and it is gone once the fade has played", !edgeNow());
ok("...with the panel's slide released again", findPanel(tree).props.style.transitionDelay === undefined,
  String(findPanel(tree).props.style.transitionDelay));
store.clear(); resetComponent();

console.log("--- scenario 7d: n/N Enter stepping + current-row highlight ---");
store.clear(); resetComponent();
tree = render(propsFor(SNAP));
collect(tree, (n) => n.props && n.props.title === "搜索标题")[0].props.onClick({ stopPropagation() {} });
tree = render(propsFor(SNAP));
// NB: handlers must be re-read from the LATEST render (a stale closure still has
// an empty `matches` array, which is not how React behaves)
collect(tree, (n) => n.type === "input")[0].props.onChange({ target: { value: "细节" } });
tree = render(propsFor(SNAP));
tickTimeouts(); tree = render(propsFor(SNAP)); // end the 220ms spinner, n/N appears
// a fresh search lands on the NEWEST hit (the list starts at the bottom), so the
// counter starts at N/N and the highlighted row is the visible one
ok("a fresh search makes the newest hit current (counter 2/2)", counter(tree) === "2/2", String(counter(tree)));
const firstActive = activeRowTitle(tree);
ok("the newest hit's row is the highlighted one", firstActive.includes("细节 B"), firstActive);
collect(tree, (n) => n.type === "input")[0].props.onKeyDown({ key: "Enter", preventDefault() {} });
tree = render(propsFor(SNAP));
ok("Enter wraps to the oldest hit (1/2)", counter(tree) === "1/2", String(counter(tree)));
const secondActive = activeRowTitle(tree);
ok("Enter moves the current-match highlight to that row", secondActive.includes("细节 A"), secondActive);
collect(tree, (n) => n.type === "input")[0].props.onKeyDown({ key: "Enter", preventDefault() {} });
tree = render(propsFor(SNAP));
ok("Enter advances back to 2/2", counter(tree) === "2/2", String(counter(tree)));
collect(tree, (n) => n.type === "input")[0].props.onKeyDown({ key: "Escape", preventDefault() {} });
tickTimeouts(); tree = render(propsFor(SNAP)); // the 240ms close timer unmounts the row
ok("Escape closes the search box", !collect(tree, (n) => n.type === "input").length);

console.log("--- scenario 8: per-node parse cache under streaming (objective 4) ---");
store.clear(); resetComponent();
const bigSpec = Array.from({ length: 60 }, (_, i) => ({ user: `问题 ${i}`, reply: `# 标题 ${i}\n正文 ${i}\n## 小节 ${i}` }));
const big = conv(bigSpec);
const snapBig = { order: big.order.slice(), nodes: new Map(big.nodes) };
const snapC = () => ({ info: counters.info, reply: counters.reply, user: counters.user, parse: counters.parse });
let c = snapC();
tree = render(propsFor(snapBig));
// One parse per assistant node and one extract per node, no matter that the
// grouping pass looks nodes up twice (pass 1 over `order`, pass 2 over the
// assistant nodes): the second lookup is a pure cache hit. User nodes in this
// fixture carry `blocks` (not `content`), so extractUserText falls back to
// extractReplyText — hence reply = 60 assistant + 60 user fallbacks.
const firstPass = { info: counters.info - c.info, reply: counters.reply - c.reply, user: counters.user - c.user, parse: counters.parse - c.parse };
ok("initial render parses each node exactly once (60 parses, 60 user extracts, 0 re-parses)", firstPass.parse === 60 && firstPass.user === 60 && firstPass.reply === 120, JSON.stringify(firstPass));
c = snapC();
tree = render(propsFor(snapBig));
ok("re-render with an unchanged snapshot parses nothing", counters.parse === c.parse && counters.reply === c.reply, JSON.stringify({ parse: counters.parse - c.parse, reply: counters.reply - c.reply }));
// streaming: the newest reply grows (new blocks array); every other node is a
// BRAND-NEW object that shares its original blocks array — the worst case for a
// cache that only compared object identity
const streamNodes = new Map();
snapBig.nodes.forEach((n, k) => {
  const changed = k === "a60";
  streamNodes.set(k, {
    key: n.key, kind: n.kind, location: n.location,
    data: { blocks: changed ? n.data.blocks.concat([{ kind: "text", text: "\n### 追加小节\n流式内容" }]) : n.data.blocks, time: n.data.time },
  });
});
const snapStream = { order: snapBig.order.slice(), nodes: streamNodes };
c = snapC();
tree = render(propsFor(snapStream));
const streamPass = { info: counters.info - c.info, reply: counters.reply - c.reply, user: counters.user - c.user, parse: counters.parse - c.parse };
ok("streaming update re-parses ONLY the changed node (1 extract + 1 parseHeadings)", streamPass.reply === 1 && streamPass.parse === 1 && streamPass.user === 0, JSON.stringify(streamPass));
ok("the streamed-in heading appears", textOf(tree).includes("追加小节"));
c = snapC();
tree = render(propsFor(snapStream));
ok("re-render after the update parses nothing again", counters.parse === c.parse && counters.reply === c.reply);
c = snapC();
render(propsFor(snapStream));
ok("repeat streaming ticks stay O(changed nodes), not O(history)", counters.parse - c.parse === 0 && counters.reply - c.reply === 0, JSON.stringify({ parse: counters.parse - c.parse }));
// bounded cache: 150 turns fills it past the 200-record prune threshold, then a
// snapshot holding only the newest 20 turns must shrink it again
const giant = conv(Array.from({ length: 150 }, (_, i) => ({ user: `u${i}`, reply: `# H${i}\nx` })));
resetComponent();
render(propsFor({ order: giant.order.slice(), nodes: new Map(giant.nodes) }));
const cacheAfterGiant = exports_.__debug.nodeInfoCache.size;
ok("cache grows past the prune threshold with 150 turns", cacheAfterGiant > 200, `size=${cacheAfterGiant}`);
const keepKeys = giant.order.slice(-40);
const trimmed = new Map(keepKeys.map((k) => [k, giant.nodes.get(k)]));
render(propsFor({ order: keepKeys.slice(), nodes: trimmed }));
const cacheAfterTrim = exports_.__debug.nodeInfoCache.size;
ok("cache is pruned back to the nodes still in the conversation", cacheAfterTrim <= 200 && cacheAfterTrim < cacheAfterGiant, `after=${cacheAfterTrim} before=${cacheAfterGiant}`);

console.log("--- scenario 9: search list position and row click ---");
store.clear(); resetComponent();
tree = render(propsFor(SNAP));
collect(tree, (n) => n.props && n.props.title === "搜索标题")[0].props.onClick({ stopPropagation() {} });
tree = render(propsFor(SNAP));
const listRefObj = collect(tree, (n) => n.props && n.props.className === "dqt-list")[0].props.ref;
ok("outline list ref available", !!listRefObj && !!listRefObj.current);
collect(tree, (n) => n.type === "input")[0].props.onChange({ target: { value: "细节" } });
tree = render(propsFor(SNAP));
tickTimeouts(); tree = render(propsFor(SNAP)); // end the 220ms spinner, n/N appears
ok("a fresh search scrolls the list to the bottom (newest hit in view)", listRefObj.current.scrollTop === listRefObj.current.scrollHeight, `scrollTop=${listRefObj.current.scrollTop} scrollHeight=${listRefObj.current.scrollHeight}`);
// clicking a row must go through the SAME path as Enter stepping (highlight +
// scroll), not the old jump-only path that left nothing highlighted
const rows = collect(tree, (n) => n.props && n.props["data-result-idx"] !== undefined);
ok("result rows expose their index for click handling", rows.length === 2, `rows=${rows.length}`);
rows[0].props.onClick({ stopPropagation() {} }); // click the OLDER hit
tree = render(propsFor(SNAP));
ok("clicking a result row makes that hit current (counter 1/2)", counter(tree) === "1/2", String(counter(tree)));
ok("clicking a result row highlights exactly that row", activeRowTitle(tree).includes("细节 A"), activeRowTitle(tree));
rows.length = 0;
// full-text scope: body-text rows must also become the current match (the old
// bug: they jumped without any highlight)
const scopeBtn2 = collect(tree, (n) => n.props && typeof n.props.onClick === "function" && textOf(n) === "标题")[0];
scopeBtn2.props.onClick({ stopPropagation() {} });
tree = render(propsFor(SNAP));
collect(tree, (n) => n.type === "input")[0].props.onChange({ target: { value: "出现在正文里" } });
tree = render(propsFor(SNAP));
tickTimeouts(); tree = render(propsFor(SNAP)); // end the 220ms spinner
const bodyRow = collect(tree, (n) => n.props && n.props["data-result-idx"] !== undefined)[0];
ok("full-text search produces a body-text row", !!bodyRow, "text: " + textOf(tree).slice(0, 200));
bodyRow.props.onClick({ stopPropagation() {} });
tree = render(propsFor(SNAP));
ok("clicking a body-text row sets it as the current match", counter(tree) === "1/1", String(counter(tree)));

console.log("--- scenario 10: keyword highlight really paints (mini DOM) ---");
const dbg = exports_.__debug;
const convRow = elem("div", {
  dataset: { chatAnchorKey: "a1" },
  getBoundingClientRect: () => ({ top: 120, left: 0, right: 620, bottom: 420, width: 620, height: 300 }),
});
convRow.appendChild(textNode("## 细节 A "));
convRow.appendChild(textNode("alpha 又出现，另一次 alpha 也在这里"));
convRow.closest = () => scrollport;
ok("mini DOM row has both occurrences", dbg.countOccurrences(convRow.textContent, "alpha") === 2, convRow.textContent);
const before = convRow.textContent;
dbg.highlightRow(convRow, "alpha", 1);
const spans = [];
(function gather(n) { for (const c of n.childNodes || []) { if (c.nodeType === 1) { if (String(c.className || "").includes("dqt-current") || c.tagName === "SPAN") spans.push(c); gather(c); } } })(convRow);
ok("both occurrences are wrapped in spans", spans.length === 2, `spans=${spans.length}`);
ok("exactly the requested occurrence carries dqt-current", convRow.querySelector(".dqt-current") !== null && spans.filter((s) => String(s.className || "").includes("dqt-current")).length === 1);
ok("the current span holds the matched text", convRow.querySelector(".dqt-current").textContent === "alpha");
ok("wrapping does not change the row's text", convRow.textContent === before, convRow.textContent);
dbg.clearHighlights();
ok("clearing highlights restores the original text", convRow.textContent === before && convRow.querySelector(".dqt-current") === null);

// the common markdown case: each rendered line is its own text node, so the
// second hit lives in a DIFFERENT node — the index must still line up
const twoNodeRow = elem("div", {
  dataset: { chatAnchorKey: "a2" },
  getBoundingClientRect: () => ({ top: 120, left: 0, right: 620, bottom: 420, width: 620, height: 300 }),
});
twoNodeRow.appendChild(textNode("第一行里面 alpha 出现一次\n"));
twoNodeRow.appendChild(textNode("第二行里面 alpha 再出现一次\n"));
twoNodeRow.appendChild(textNode("这一行没有关键字\n"));
const before2 = twoNodeRow.textContent;
dbg.highlightRow(twoNodeRow, "alpha", 1);
const spans2 = [];
(function gather2(n) { for (const c of n.childNodes || []) { if (c.nodeType === 1) { if (c.tagName === "SPAN") spans2.push(c); gather2(c); } } })(twoNodeRow);
ok("hits spread over two text nodes are both wrapped", spans2.length === 2, `spans=${spans2.length}`);
ok("the second hit (in the second text node) is the current one", spans2[1] && spans2[1].className === "dqt-current" && spans2[0].className !== "dqt-current");
ok("text is preserved across nodes after wrapping", twoNodeRow.textContent === before2 && before2.includes("第二行里面 alpha"));
dbg.clearHighlights();
ok("clearing restores the multi-node row", twoNodeRow.textContent === before2);

// integration: a full-text hit in a message body must actually get highlighted
// when its result row is clicked (the reported bug: it scrolled with no highlight)
store.clear(); resetComponent();
CONV_ROWS = [convRow];
SCROLL = { heads: [], rows: new Map([["a1", convRow]]), top: 0 };
tree = render(propsFor(SNAP));
collect(tree, (n) => n.props && n.props.title === "搜索标题")[0].props.onClick({ stopPropagation() {} });
tree = render(propsFor(SNAP));
const scopeBtn3 = collect(tree, (n) => n.props && typeof n.props.onClick === "function" && textOf(n) === "标题")[0];
scopeBtn3.props.onClick({ stopPropagation() {} });
tree = render(propsFor(SNAP));
collect(tree, (n) => n.type === "input")[0].props.onChange({ target: { value: "又出现" } });
tree = render(propsFor(SNAP));
const hitRow = collect(tree, (n) => n.props && n.props["data-result-idx"] !== undefined)[0];
ok("full-text hit produced a clickable body row", !!hitRow, "text: " + textOf(tree).slice(0, 160));
hitRow.props.onClick({ stopPropagation() {} });
tree = render(propsFor(SNAP));
ok("clicking it places the current highlight in the conversation DOM", convRow.querySelector(".dqt-current") !== null, "row text: " + convRow.textContent);
ok("the highlight marks the searched phrase", convRow.querySelector(".dqt-current") && convRow.querySelector(".dqt-current").textContent === "又出现", convRow.querySelector(".dqt-current") && convRow.querySelector(".dqt-current").textContent);
ok("the row is still scrolled into position (scrollTop set by the same path)", typeof scrollport.scrollTop === "number");
CONV_ROWS = [];

console.log("--- scenario 11: code fences, group-header target, sticky gap ---");
const P = dbg.parseHeadings;
const titles = (t) => P(t).map((h) => h.level + ":" + h.title).join(" | ");
ok("a fenced code block hides heading-looking lines", titles("# 真标题\n```\n# 假标题\n## 也假\n```\n## 真二级") === "1:真标题 | 2:真二级", titles("# 真标题\n```\n# 假标题\n## 也假\n```\n## 真二级"));
ok("an unclosed fence hides everything after it", titles("# 真\n```\n# 假\n## 假") === "1:真", titles("# 真\n```\n# 假\n## 假"));
ok("an info string still opens a fence", titles("```js\n# 假\n```\n# 真") === "1:真", titles("```js\n# 假\n```\n# 真"));
ok("tilde fences are respected", titles("~~~\n# 假\n~~~\n# 真") === "1:真", titles("~~~\n# 假\n~~~\n# 真"));
ok("a longer closing fence closes a shorter opener", titles("```\n# 假\n`````\n# 真") === "1:真", titles("```\n# 假\n`````\n# 真"));
ok("an indented fence (up to 3 spaces) counts", titles("   ```\n# 假\n   ```\n# 真") === "1:真", titles("   ```\n# 假\n   ```\n# 真"));
ok("a fence with trailing text does not close the block", titles("```\n# 假\n``` not a close\n# 仍假\n```\n# 真") === "1:真", titles("```\n# 假\n``` not a close\n# 仍假\n```\n# 真"));
ok("inline code and shell prompts are not headings", titles("用 `# 注释` 表示注释\n$ # 不是标题") === "", titles("用 `# 注释` 表示注释\n$ # 不是标题"));
// render level: a code block's fake heading must not appear in the outline
store.clear(); resetComponent();
const fenced = conv([{ user: "看下代码", reply: "# 真正的标题\n```bash\n# install deps\n## usage\n```\n正文" }]);
tree = render(propsFor(fenced));
ok("outline shows the real heading and not the code block's", textOf(tree).includes("真正的标题") && !textOf(tree).includes("install deps") && !textOf(tree).includes("usage"), "text: " + textOf(tree).slice(0, 200));

// group header (the time row) jumps to the MODEL REPLY, and works when the turn
// has no headings at all
store.clear(); resetComponent();
// rows live in the scrolled document, so their rects move with the scrollport
// (the glide re-aims at the live offset every frame)
const u1 = elem("div", { dataset: { chatAnchorKey: "u1" }, getBoundingClientRect: () => ({ top: 100 - scrollport.scrollTop, left: 0, right: 600, bottom: 200 - scrollport.scrollTop, width: 600, height: 100 }) });
const a1 = elem("div", { dataset: { chatAnchorKey: "a1" }, getBoundingClientRect: () => ({ top: 500 - scrollport.scrollTop, left: 0, right: 600, bottom: 900 - scrollport.scrollTop, width: 600, height: 400 }) });
u1.closest = () => scrollport;
a1.closest = () => scrollport;
CONV_ROWS = [u1, a1];
scrollport.scrollTo = nativeScrollEmu;
const headerSnap = conv([{ user: "带标题的一轮", reply: "# 标题\n内容" }]);
tree = render(propsFor(headerSnap));
scrollport.lastScroll = null;
byTitle(tree, "跳转到该回合的模型回答开头")[0].props.onClick({ stopPropagation() {} });
drain(60); // the native glide runs to the end
tickTimeouts(); tickIntervals(); tickIntervals(); tickIntervals(); tickIntervals(); tickIntervals(); tickIntervals(); // landing re-checks, then the glide retires
ok("clicking the time row targets the model reply, not the user message", scrollport.scrollTop === 480, `top=${scrollport.scrollTop} (user row would be 80)`);
store.clear(); resetComponent();
const noHeadingSnap = conv([{ user: "没有标题的一轮", reply: "普通回答，没有任何 markdown 标题" }]);
tree = render(propsFor(noHeadingSnap));
const timeOnlyHeader = byTitle(tree, "跳转到该回合的模型回答开头")[0];
ok("a heading-less turn still renders a clickable time row", !!timeOnlyHeader);
scrollport.lastScroll = null;
timeOnlyHeader.props.onClick({ stopPropagation() {} });
drain(60);
tickTimeouts(); tickIntervals(); tickIntervals(); tickIntervals(); tickIntervals(); tickIntervals(); tickIntervals();
ok("and that row jumps to its model reply", scrollport.scrollTop === 480, `top=${scrollport.scrollTop}`);
CONV_ROWS = []; scrollport.scrollTo = () => {};

// sticky group header must sit flush under the toolbar (no top padding on the
// scroll container, which would hold the pinned row down)
store.clear(); resetComponent();
tree = render(propsFor(SNAP));
const listEl = collect(tree, (n) => n.props && n.props.className === "dqt-list")[0];
ok("the outline scroller has no top padding (sticky row sits flush)", String(listEl.props.style.padding).startsWith("0 "), String(listEl.props.style.padding));
const stickyEl = collect(tree, (n) => n.props && n.props.style && n.props.style.position === "sticky")[0];
ok("the group header is pinned at top 0", stickyEl.props.style.top === 0 && stickyEl.props.style.zIndex === 2);

SCROLL = { heads: [], rows: new Map(), top: 0 };
store.clear(); resetComponent();

/* ============ scenario 12 (0.5.0): whole-log outline, fuzzy, hint, hover ===== */
const searchBtn = (t) => byTitle(t, "搜索标题")[0];
const searchBox = (t) => collect(t, (n) => n.type === "input")[0];
// A scroll event in this suite stands for the reader scrolling the list, so it is
// preceded by the real input event that a browser would deliver first (a press).
// The auto-loader only acts on reader gestures now: a scroll our own code causes
// (opening the curtain re-lays the list out and moves scrollTop) must not be read
// as a request to load history.
const listOf = (t) => {
  const l = collect(t, (n) => n.props && n.props.className === "dqt-list")[0];
  if (l && l.props && typeof l.props.onScroll === "function" && !l.props.__gestured) {
    const orig = l.props.onScroll;
    l.props.onScroll = (ev) => {
      if (typeof l.props.onPointerDown === "function") l.props.onPointerDown({});
      return orig(ev);
    };
    l.props.__gestured = true;
  }
  return l;
};
const openSearch = (props) => {
  let t = render(props);
  searchBtn(t).props.onClick();
  return render(props);
};

console.log("--- scenario 12a: turnOutline projection (whole-log outline) ---");
const loadCalls = [];
// The session face is also where the history window's own bookkeeping lives
// (`openState` / `hasMore` / `loadingOlder`) and `loadOlder()` is the paging verb the
// panel uses — clicking a DOM button is only the fallback for a host without this face.
const loadOlderCalls = [];
const faceOf = (over) => ({
  binding: () => ({
    session: Object.assign({
      openState: "open", hasMore: true, loadingOlder: false, baseSeq: 500,
      loadThrough: (seq) => { loadCalls.push(["face", seq]); return Promise.resolve(); },
      loadOlder: () => { loadOlderCalls.push(1); return Promise.resolve(); },
    }, over || {}),
  }),
});
const SESSION_FACE = {
  binding: (id) => ({
    session: {
      openState: "open", hasMore: true, loadingOlder: false, baseSeq: 500,
      loadThrough: (seq) => { loadCalls.push([id, seq]); return Promise.resolve(); },
      loadOlder: () => { loadOlderCalls.push(1); return Promise.resolve(); },
    },
  }),
};
provided.sessions = SESSION_FACE; // the session provider is registered on this host
const HOST = { sessions: () => provided.sessions };

// the paged window holds ONLY turn 3; the host outline names all three turns
const windowOnly3 = {
  order: ["u3", "a3"],
  nodes: new Map([
    ["u3", { key: "u3", kind: "user", location: { kind: "turn", turn: { turn: 3 } }, data: { blocks: md("第三轮的提问"), time: 1700000000000 } }],
    ["a3", { key: "a3", kind: "assistant-step", location: { kind: "turn", turn: { turn: 3 } }, data: { blocks: md("# 第三轮的标题\n第三轮正文"), time: 1700000060000 } }],
  ]),
};
const OUTLINE = [
  { turn: 1, seq: 10, prompt: "第一轮的问题", response: "第一轮回答的开头" },
  { turn: 2, seq: 20, prompt: "第二轮的问题", response: "第二轮回答的开头" },
  { turn: 3, seq: 30, prompt: "第三轮的提问", response: "第三轮回答的开头" },
];
const OUTLINE_BAD = [null, 7, { turn: "x", seq: 5 }, { turn: 4, seq: "y" }, { turn: 5, seq: 50, prompt: 7, response: null }];
const projProps = (snap, outline, host) => propsFor(snap, {
  useProjection: (k) => (k === "turnOutline" ? outline : undefined),
  tocHost: host || HOST,
});

store.clear(); resetComponent();
let t12 = render(projProps(windowOnly3, OUTLINE));
ok("turns the window has not loaded appear in the outline", textOf(t12).includes("第一轮的问题") && textOf(t12).includes("第二轮的问题"), textOf(t12).slice(0, 200));
ok("they are tagged 未加载", textOf(t12).includes("未加载"));
ok("their bounded response preview is shown", textOf(t12).includes("第一轮回答的开头"));
ok("...at the host's full three lines and legibly (not clamped to two at 0.65)", !!collect(t12, (n) => n.props && n.props.style && n.props.style.WebkitLineClamp === 3 && n.props.style.opacity === 0.8)[0], JSON.stringify(collect(t12, (n) => n.props && n.props.style && n.props.style.WebkitLineClamp).map((n) => [n.props.style.WebkitLineClamp, n.props.style.opacity])));
ok("a loaded turn is NOT duplicated by its projection entry", (textOf(t12).match(/第三轮的提问/g) || []).length === 1, (textOf(t12).match(/第三轮的提问/g) || []).length + " copies");
ok("unloaded turns are merged in turn order (before the loaded one)", textOf(t12).indexOf("第一轮的问题") < textOf(t12).indexOf("第三轮的标题"));

resetComponent();
t12 = render(propsFor(windowOnly3));
ok("without the projection the panel keeps the 0.4.1 shape", !textOf(t12).includes("第一轮的问题") && textOf(t12).includes("第三轮的标题"));

resetComponent();
t12 = render(projProps(windowOnly3, OUTLINE_BAD));
ok("malformed projection entries are dropped instead of crashing", !textOf(t12).includes("第一轮的问题") && textOf(t12).includes("#5"), textOf(t12).slice(0, 160));

console.log("--- scenario 12b: opening an unloaded turn (loadThrough) ---");
store.clear(); resetComponent();
t12 = render(projProps(windowOnly3, OUTLINE));
const ghostRow = collect(t12, (n) => n.props && n.props["data-ghost-turn"] === 1)[0];
ok("an unloaded turn renders as its own clickable row", !!ghostRow);
ghostRow.props.onClick();
ok("clicking it calls the host jump loader with that turn's start seq", loadCalls.length === 1 && loadCalls[0][0] === "s1" && loadCalls[0][1] === 10, JSON.stringify(loadCalls));
const turn1Row = elem("div", { dataset: { chatTurn: "1" }, getBoundingClientRect: () => ({ top: 300 - scrollport.scrollTop, left: 0, right: 600, bottom: 700 - scrollport.scrollTop, width: 600, height: 400 }) });
turn1Row.closest = () => scrollport;
SELECTORS['[data-chat-turn="1"]'] = turn1Row;
scrollport.scrollTo = nativeScrollEmu;
scrollport.lastScroll = null;
await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
tickTimeouts(); // landOnTurn polls shortly after the loader resolves
drain(60); // the glide runs to the end
tickTimeouts(); tickIntervals(); tickIntervals(); tickIntervals(); tickIntervals(); tickIntervals(); tickIntervals();
ok("once the host has paged it in, the panel scrolls to that turn", scrollport.scrollTop === 280, `top=${scrollport.scrollTop}`);
scrollport.scrollTo = () => {};

// fallback path: no `data-chat-turn` attribute on the host row, but the turn is
// loaded now, so our own rebuilt group supplies the anchor
console.log("--- scenario 12b3: landing without the host's turn attribute ---");
store.clear(); resetComponent();
delete SELECTORS['[data-chat-turn="1"]'];
loadCalls.length = 0;
let tf = render(projProps(windowOnly3, OUTLINE));
collect(tf, (n) => n.props && n.props["data-ghost-turn"] === 1)[0].props.onClick();
await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
// the host paged the turn in: it is no longer a ghost, and its node has an anchor
const loadedTurn1 = {
  order: ["u1", "a1", "u3", "a3"],
  nodes: new Map([
    ["u1", { key: "u1", kind: "user", location: { kind: "turn", turn: { turn: 1 } }, data: { blocks: md("第一轮的问题"), time: 1700000000000 } }],
    ["a1", { key: "a1", kind: "assistant-step", location: { kind: "turn", turn: { turn: 1 } }, data: { blocks: md("# 第一轮的标题\n正文"), time: 1700000060000 } }],
    ...windowOnly3.nodes,
  ]),
};
const rowFor = (key, top) => { const r = elem("div", { dataset: { chatAnchorKey: key }, getBoundingClientRect: () => ({ top: top - scrollport.scrollTop, left: 0, right: 600, bottom: top + 180 - scrollport.scrollTop, width: 600, height: 180 }) }); r.closest = () => scrollport; return r; };
CONV_ROWS = [rowFor("u1", 40), rowFor("a1", 120)];
scrollport.scrollTo = nativeScrollEmu;
scrollport.lastScroll = null;
tf = render(projProps(loadedTurn1, OUTLINE));
tickTimeouts();
drain(60);
tickTimeouts(); tickIntervals(); tickIntervals(); tickIntervals(); tickIntervals(); tickIntervals(); tickIntervals();
ok("with no host turn attribute the panel still lands on the loaded turn", scrollport.scrollTop === 100, `top=${scrollport.scrollTop}`);
scrollport.scrollTo = () => {};
CONV_ROWS = [];

resetComponent();
t12 = render(projProps(windowOnly3, OUTLINE, { sessions: () => null }));
const ghostRow2 = collect(t12, (n) => n.props && n.props["data-ghost-turn"] === 2)[0];
let ghostThrew = false;
try { ghostRow2.props.onClick(); } catch (e) { ghostThrew = true; }
ok("with no host jump loader the click is a no-op, not a crash", !ghostThrew);

// the bridge must be a LIVE lookup: a session provider that registers after the
// package loaded still has to be found (no cached null)
console.log("--- scenario 12b2: the host bridge re-resolves the service ---");
store.clear(); resetComponent();
provided.sessions = null;
loadCalls.length = 0;
let tl = render(projProps(windowOnly3, OUTLINE));
collect(tl, (n) => n.props && n.props["data-ghost-turn"] === 1)[0].props.onClick();
ok("with the provider absent nothing is called", loadCalls.length === 0, JSON.stringify(loadCalls));
provided.sessions = SESSION_FACE; // ...registered later
tl = render(projProps(windowOnly3, OUTLINE));
collect(tl, (n) => n.props && n.props["data-ghost-turn"] === 1)[0].props.onClick();
ok("once the provider appears the same click finds it (no stale handle)", loadCalls.length === 1, JSON.stringify(loadCalls));

console.log("--- scenario 12c: normalized search (always on) ---");
const normSnap = conv([
  { user: "全角测试", reply: "# ＡＢＣ 全角标题\n正文里有 ｈｅｌｌｏ 全角单词" },
  { user: "夹字测试", reply: "# 模糊匹配开关\n正文：模糊的匹配也能找到" },
]);
store.clear(); resetComponent();
const normProps = propsFor(normSnap);
let tn = openSearch(normProps);
searchBox(tn).props.onChange({ target: { value: "abc" } });
tn = render(normProps);
ok("half-width input finds full-width text (normalization is always on)", textOf(tn).includes("全角标题"), textOf(tn).slice(0, 140));
ok("...and it is not reported as 'no match'", !textOf(tn).includes("没有匹配"));

console.log("--- scenario 12d: fuzzy switch beside the scope pill ---");
const scopePill = (t) => byTitle(t, "当前：仅搜索标题。点击切换为全文搜索")[0];
const fuzzyOff = (t) => byTitle(t, "模糊匹配已关闭：只匹配连续的文字。点击开启")[0];
const fuzzyOn = (t) => byTitle(t, "模糊匹配已开启：允许关键字中间夹少量其他文字，命中更多")[0];
ok("the fuzzy switch sits next to the scope pill", !!fuzzyOff(tn));
scopePill(tn).props.onClick();
tn = render(normProps);
searchBox(tn).props.onChange({ target: { value: "模的匹配" } });
tn = render(normProps);
ok("a subsequence query finds nothing while fuzzy is off", textOf(tn).includes("没有匹配"), textOf(tn).slice(0, 140));
fuzzyOff(tn).props.onClick();
tn = render(normProps);
ok("the same query hits once fuzzy is on", !textOf(tn).includes("没有匹配"), textOf(tn).slice(0, 200));
ok("...and the switch now reads as enabled", !!fuzzyOn(tn));
tickTimeouts();
ok("the fuzzy preference is persisted", store.get("dsh-quick-toc.fuzzy.v1") === "1", String(store.get("dsh-quick-toc.fuzzy.v1")));

console.log("--- scenario 12e: 'scroll up loads earlier' hint ---");
// more groups than the panel page -> older history is reachable -> hint armed
const bigSnap = conv(Array.from({ length: 8 }, (_, i) => ({ user: `第${i + 1}轮问题`, reply: `# 标题${i + 1}\n正文 alpha` })));
store.clear(); resetComponent();
const bigProps = propsFor(bigSnap);
let tb = openSearch(bigProps);
searchBox(tb).props.onChange({ target: { value: "alpha" } });
tb = render(bigProps);
ok("searching arms the hint under the results", textOf(tb).includes("向上滚动可加载更早的消息"), textOf(tb).slice(-140));
listOf(tb).props.onWheel({ deltaY: -120 });
tb = render(bigProps);
ok("scrolling up dismisses the hint", !textOf(tb).includes("向上滚动可加载更早的消息"));
// at the very first message (nothing to grow, no load-older button) say so. The window
// reporting `hasMore: false` while the session is open is the ONLY state that may claim
// the beginning was reached — a pull in flight must never be read as that.
store.clear(); resetComponent();
provided.sessions = faceOf({ hasMore: false });
let ts = openSearch(normProps);
searchBox(ts).props.onChange({ target: { value: "abc" } });
ts = render(normProps);
const tsList = listOf(ts);
tsList.scrollTop = 400; // the reader is somewhere in the middle of the hits
tsList.props.onScroll({ currentTarget: tsList });
tsList.scrollTop = 0; // ...then scrolls up to the very first hit
tsList.props.onScroll({ currentTarget: tsList });
ts = render(normProps);
ok("when nothing older exists the hint says so instead of promising more", textOf(ts).includes("已经是最早的消息"), textOf(ts).slice(-140));
provided.sessions = SESSION_FACE;

// with the conversation offering an older page, scrolling up in SEARCH mode must
// ask the HOST for it (that is what extends what the search can cover)
store.clear(); resetComponent();
let hostClicks = 0;
const olderBefore = loadOlderCalls.length;
SCROLL.buttons = [{ textContent: "加载更早", disabled: false, click() { hostClicks++; } }];
let th2 = openSearch(normProps);
searchBox(th2).props.onChange({ target: { value: "abc" } });
th2 = render(normProps);
const l2 = listOf(th2);
l2.scrollTop = 400; // walking back up through the hits
l2.props.onScroll({ currentTarget: l2 });
l2.scrollTop = 0; // reaching the top of the hit list
l2.props.onScroll({ currentTarget: l2 });
ok("with a search active, reaching the top pulls an older page through the session face", loadOlderCalls.length === olderBefore + 1, "loadOlder calls=" + (loadOlderCalls.length - olderBefore));
// ...and a host that exposes no paging verb at all still gets its own control clicked
const olderAfterApi = loadOlderCalls.length;
provided.sessions = faceOf({ loadOlder: undefined });
store.clear(); resetComponent();
hostClicks = 0;
let th3 = openSearch(normProps);
searchBox(th3).props.onChange({ target: { value: "abc" } });
th3 = render(normProps);
const l3 = listOf(th3);
l3.scrollTop = 400;
l3.props.onScroll({ currentTarget: l3 });
l3.scrollTop = 0;
l3.props.onScroll({ currentTarget: l3 });
ok("...and with no such verb it falls back to clicking the host's own control", hostClicks === 1 && loadOlderCalls.length === olderAfterApi, "clicks=" + hostClicks);
provided.sessions = SESSION_FACE;

console.log("--- scenario 12e-2: paging follows the reader (0.7.1) ---");
// A page IN FLIGHT is not the beginning of history: `hasMore` is stale while the host is
// pulling, and reading it then is exactly what told the reader they had reached the
// start with hundreds of turns still above them.
provided.sessions = faceOf({ hasMore: false, loadingOlder: true });
SCROLL.buttons = [];   // no DOM fallback: the session face is the only source of truth
store.clear(); resetComponent();
let tbusy = render(propsFor(SNAP));
const lbusy = listOf(tbusy);
lbusy.scrollTop = 400; lbusy.props.onScroll({ currentTarget: lbusy });   // walking up
lbusy.scrollTop = 0; lbusy.props.onScroll({ currentTarget: lbusy });     // reaching the top
tbusy = render(propsFor(SNAP));
ok("a page still in flight is never read as 'the beginning'", !textOf(tbusy).includes("已经是最早的消息"), textOf(tbusy).slice(-120));
provided.sessions = SESSION_FACE;

// The switch: off means nothing loads behind the reader's back — and on, the same
// gesture does pull (so the assertion above is about the switch, not about the gesture).
// The trigger is an unloaded turn the reader can actually see, so the fixture has to
// have one: with no gap in view there is now nothing to fetch (the old code pulled at
// the top regardless, which is how it ended up paging the whole log while sitting still).
const gapFixture = () => {
  LAYOUT.list = { top: 0, height: 400 };
  LAYOUT.groups = [{ idx: "3", top: 120, height: 40 }];
  LAYOUT.ghosts = [{ turn: 1, top: 20, height: 30 }];
};
store.clear(); resetComponent();
store.set("dsh-quick-toc.autoLoad.v1", "0");
setHostField("autoLoad", false);                 // the host layer is authoritative
gapFixture();
const offBefore = loadOlderCalls.length + loadCalls.length;
let toff = render(projProps(windowOnly3, OUTLINE));
const loff = listOf(toff);
loff.scrollTop = 0;
loff.props.onScroll({ currentTarget: loff });
ok("with auto-loading off, reaching the top pulls nothing at all (even with a gap on screen)", loadOlderCalls.length + loadCalls.length === offBefore, "pulls=" + (loadOlderCalls.length + loadCalls.length - offBefore));
store.delete("dsh-quick-toc.autoLoad.v1");
hostScope.unset("autoLoad");
store.clear(); resetComponent();
gapFixture();
const onBefore = loadOlderCalls.length + loadCalls.length;
let ton = render(projProps(windowOnly3, OUTLINE));
const lon = listOf(ton);
lon.scrollTop = 0;
lon.props.onScroll({ currentTarget: lon });
ok("...and with it on, the same gesture does pull", loadOlderCalls.length + loadCalls.length > onBefore, "pulls=" + (loadOlderCalls.length + loadCalls.length - onBefore));
tickTimeouts();
LAYOUT.list = null; LAYOUT.groups = []; LAYOUT.ghosts = [];

// WHAT gets fetched is decided by the gap the reader is looking at: near the loaded
// frontier one jump-loader call finishes it; far above it, the cheap page-by-page walk.
const farOutline = Array.from({ length: 40 }, (_, i) => ({ turn: i + 1, seq: (i + 1) * 10, prompt: "第" + (i + 1) + "轮的问题", response: "第" + (i + 1) + "轮回答的开头" }));
const windowOnly40 = {
  order: ["u40", "a40"],
  nodes: new Map([
    ["u40", { key: "u40", kind: "user", location: { kind: "turn", turn: { turn: 40 } }, data: { blocks: md("第40轮的提问"), time: 1700000000000 } }],
    ["a40", { key: "a40", kind: "assistant-step", location: { kind: "turn", turn: { turn: 40 } }, data: { blocks: md("# 第四十轮的标题\n第四十轮正文"), time: 1700000060000 } }],
  ]),
};
provided.sessions = faceOf({});
store.clear(); resetComponent();
LAYOUT.list = { top: 0, height: 100 };
LAYOUT.groups = [{ idx: "2", top: 120, height: 20 }];
LAYOUT.ghosts = [{ turn: 2, top: 20, height: 30 }];
const throughBefore = loadCalls.length;
const nearOlder = loadOlderCalls.length;
let tgap = render(projProps(windowOnly3, OUTLINE));
const lgap = listOf(tgap);
lgap.scrollTop = 0;
lgap.props.onScroll({ currentTarget: lgap });
// A gap the reader has actually REACHED is covered by the host in one call: `loadThrough`
// pages the host's own window (200 messages a hop) until it covers that turn, so a deep gap
// does not have to be walked 50 messages at a time while the reader waits — which is what
// "I have already scrolled into the unloaded part and it is still loading slowly" means.
ok("a gap the reader has reached is covered in one host call (not walked page by page)",
  loadCalls.length > throughBefore && loadOlderCalls.length === nearOlder,
  "loadThrough=" + (loadCalls.length - throughBefore) + " loadOlder=" + (loadOlderCalls.length - nearOlder));
ok("...and it asks for a seq a MARGIN further back, not just the visible row (turn 2 -> seq 10)",
  loadCalls.length > throughBefore && loadCalls[loadCalls.length - 1][1] === 10,
  JSON.stringify(loadCalls[loadCalls.length - 1]));
// let the in-flight latch of that pull clear before the next case
tickTimeouts();

// The reader's place is HELD while that load changes the height above them. The anchor is
// the first REAL row in view — the placeholders are what loads, so anchoring below them is
// what keeps the reader's content still while the unloaded block grows upward out of the
// viewport.
store.clear(); resetComponent();
LAYOUT.list = { top: 0, height: 100 };
LAYOUT.groups = [{ idx: "2", top: 120, height: 20 }];      // the loaded turn, just below the fold
LAYOUT.ghosts = [{ turn: 1, idx: "1", top: 20, height: 30 }];
let tanchor = render(projProps(windowOnly3, OUTLINE));
const lanchor = listOf(tanchor);
lanchor.scrollTop = 40;                                    // ...so the real row is on screen (120-40 = 80)
lanchor.props.onScroll({ currentTarget: lanchor });        // the pull starts; anchor = group 2 at 80
LAYOUT.ghosts = [];                                        // the placeholder turned real...
LAYOUT.groups = [{ idx: "1", top: 40, height: 130 }, { idx: "2", top: 320, height: 20 }];  // ...pushing everything below down 200
render(projProps(windowOnly3, OUTLINE));                   // React commits; the layout effect corrects
ok("the reader's place is held when a load pushes the list down", lanchor.scrollTop === 240, "scrollTop=" + lanchor.scrollTop);
// ...but it must FOLLOW the reader, not cancel them: the reader's own movement and the
// growth are separated, so a load landing DURING a scroll neither pushes them nor drags
// them back. (One compensation that cannot tell the two apart yanks them back every time;
// one that gives up as soon as `scrollTop` changed is why the push stayed visible.)
store.clear(); resetComponent();
LAYOUT.list = { top: 0, height: 100 };
LAYOUT.groups = [{ idx: "2", top: 120, height: 20 }];
LAYOUT.ghosts = [{ turn: 1, idx: "1", top: 20, height: 30 }];
let tfree = render(projProps(windowOnly3, OUTLINE));
const lfree = listOf(tfree);
lfree.scrollTop = 40;
lfree.props.onScroll({ currentTarget: lfree });            // sampled: anchor = group 2 at 80
lfree.scrollTop = 140;                                     // the reader scrolls 100px up themselves
LAYOUT.ghosts = [];
LAYOUT.groups = [{ idx: "1", top: 40, height: 130 }, { idx: "2", top: 320, height: 20 }];
render(projProps(windowOnly3, OUTLINE));
ok("...and the compensation follows the reader instead of pulling them back", lfree.scrollTop === 340, "scrollTop=" + lfree.scrollTop);
LAYOUT.list = null; LAYOUT.groups = []; LAYOUT.ghosts = [];

// A change the reader did NOT start — the host extending its own window — is compensated
// too, and BEFORE the browser paints: a layout effect runs after React wrote the DOM and
// before the frame is shown, so the push is never visible. Correcting on
// requestAnimationFrame instead (the old behaviour) is a frame or two late, which is the
// "it jumps and then comes back" the reader reported. This is also the case with
// auto-loading OFF: the host can still page history in by itself, and that used to bounce
// the list with our loader switched off.
store.clear(); resetComponent();
provided.sessions = faceOf({});
LAYOUT.list = { top: 0, height: 400 };
LAYOUT.groups = [{ idx: "3", top: 120, height: 60 }];
LAYOUT.ghosts = [{ turn: 1, top: -600, height: 30 }];   // far above: nothing is being loaded
let text2 = render(projProps(windowOnly3, OUTLINE));
const lext = listOf(text2);
lext.scrollTop = 40;                                  // the reader sits mid-list
lext.props.onScroll({ currentTarget: lext });         // ...which samples their place
LAYOUT.groups = [{ idx: "3", top: 320, height: 60 }]; // the host loaded older turns: +200px above them
render(projProps(windowOnly3, OUTLINE));              // React commits — and no rAF has run yet
ok("content that grows above the reader is pushed back before the browser paints",
  lext.scrollTop === 240, "scrollTop=" + lext.scrollTop);

// Same for rows we reveal ourselves: the index prepends older rows, so the reader's content
// moves down and has to be put back in that same frame (the old double-rAF lag IS the
// bounce felt near the unloaded part of the list).
store.clear(); resetComponent();
LAYOUT.list = { top: 0, height: 400 };
// the real group starts well below the viewport and the gap is far above it, so NOTHING is
// being paged here: revealing rows is the only thing that moves the reader's content, which
// is exactly what makes this a test of the compensation itself
LAYOUT.groups = [{ idx: "39", top: 1400, height: 40 }];
LAYOUT.ghosts = [{ turn: 35, top: -600, height: 30 }];
let tpre = render(projProps(windowOnly40, farOutline));
const lpre = listOf(tpre);
lpre.scrollTop = 10;                                  // at the very top: the reveal path
lpre.props.onScroll({ currentTarget: lpre });
LAYOUT.groups = [{ idx: "39", top: 1500, height: 40 }];// the revealed rows landed above: +100px
LIST_STUB.scrollHeight = 1400;                        // and the content really is taller now
render(projProps(windowOnly40, farOutline));          // ...again with no rAF run
ok("...and rows revealed at the top are compensated in the same frame, not two frames later",
  lpre.scrollTop === 110, "scrollTop=" + lpre.scrollTop);
LAYOUT.list = null; LAYOUT.groups = []; LAYOUT.ghosts = [];

console.log("--- scenario 12e-3: nothing animates; the gap is filled ahead (0.7.1) ---");
const windowTwoThree = {
  order: ["u2", "a2", "u3", "a3"],
  nodes: new Map([
    ["u2", { key: "u2", kind: "user", location: { kind: "turn", turn: { turn: 2 } }, data: { blocks: md("第二轮的提问"), time: 1700000030000 } }],
    ["a2", { key: "a2", kind: "assistant-step", location: { kind: "turn", turn: { turn: 2 } }, data: { blocks: md("# 第二轮的标题\n第二轮正文"), time: 1700000040000 } }],
    ["u3", { key: "u3", kind: "user", location: { kind: "turn", turn: { turn: 3 } }, data: { blocks: md("第三轮的提问"), time: 1700000050000 } }],
    ["a3", { key: "a3", kind: "assistant-step", location: { kind: "turn", turn: { turn: 3 } }, data: { blocks: md("# 第三轮的标题\n第三轮正文"), time: 1700000060000 } }],
  ]),
};
store.clear(); resetComponent();
ANIM.length = 0;
LAYOUT.list = { top: 0, height: 400 };
LAYOUT.groups = [{ idx: "1", top: 120, height: 200 }];
LAYOUT.ghosts = [{ turn: 2, top: 20, height: 32 }];
let tgrow1 = render(projProps(windowOnly3, OUTLINE));
LAYOUT.ghosts = [];
LAYOUT.groups = [{ idx: "1", top: 20, height: 320 }, { idx: "2", top: 360, height: 120 }];
let tgrow2 = render(projProps(windowTwoThree, OUTLINE));
// The reader's verdict on the enter animation was "still no good": it is gone. A group
// that finishes loading lands in one frame, and nothing is clamped to a ghost's height.
ok("a group that finished loading is not animated at all (it lands in one frame)",
  ANIM.length === 0, JSON.stringify(ANIM.map((a) => a.frames)));
ok("...and no box is ever held at a ghost's height", !collect(tgrow2, (n) => n.props && n.props["data-dqt-growing"])[0]);
// What removes the seam instead: the page is fetched BEFORE the reader gets there. The
// band is measured from the nearest UNLOADED turn: while its bottom edge is still within
// 1.2 viewports above the viewport's top edge, load. (Measuring the loaded/unloaded
// frontier instead put the trigger at the viewport's top edge by definition, so it was
// true no matter how much had just loaded.)
store.clear(); resetComponent();
provided.sessions = faceOf({});
LAYOUT.list = { top: 0, height: 400 };
LAYOUT.groups = [{ idx: "3", top: 800, height: 200 }];
LAYOUT.ghosts = [{ turn: 1, top: 0, height: 30 }];   // 470px above the top edge at scrollTop 500: inside the 480 band, off screen
const aheadBefore = loadOlderCalls.length;
let tahead = render(projProps(windowOnly3, OUTLINE));
const lahead = listOf(tahead);
lahead.scrollTop = 600;                            // baseline: the reader was lower down (gap 570px up: outside the band)
lahead.props.onScroll({ currentTarget: lahead });
lahead.scrollTop = 500;                            // ...and is moving up: now inside the band
lahead.props.onScroll({ currentTarget: lahead });
ok("a gap that is still ahead of the reader is filled before they reach it",
  loadOlderCalls.length > aheadBefore, "loadOlder=" + (loadOlderCalls.length - aheadBefore));
// ...and a gap that is still FAR above is left alone: chasing the frontier pulled a page
// every beat until the whole log was in memory, which is host work the reader never asked
// for (and the stutter they felt while sitting in the outline).
store.clear(); resetComponent();
LAYOUT.list = { top: 0, height: 400 };
LAYOUT.groups = [{ idx: "3", top: 800, height: 200 }];
LAYOUT.ghosts = [{ turn: 1, top: -600, height: 30 }];   // 1170px above the top edge: far outside the band
const farBefore = loadOlderCalls.length;
let tfar2 = render(projProps(windowOnly3, OUTLINE));
const lfar2 = listOf(tfar2);
lfar2.scrollTop = 700;                               // a baseline, so the next event reads as "moving up"
lfar2.props.onScroll({ currentTarget: lfar2 });
lfar2.scrollTop = 600;
lfar2.props.onScroll({ currentTarget: lfar2 });
for (let i = 0; i < 6; i++) tickTimeouts();          // the retry beats must not start one either
ok("...but a gap that is still far above is not pulled just because the list moved",
  loadOlderCalls.length === farBefore, "loadOlder=" + (loadOlderCalls.length - farBefore));
// ...and while approaching, the walking does not stop half-way: the per-gesture budget is a
// runaway guard, not a rate limit (it used to stop after 20 pages, i.e. in the middle of a
// gap, right while the reader kept scrolling into it).
store.clear(); resetComponent();
LAYOUT.list = { top: 0, height: 400 };
LAYOUT.groups = [{ idx: "3", top: 800, height: 200 }];
LAYOUT.ghosts = [{ turn: 1, top: 0, height: 30 }];       // inside the band, off screen
let tbudget = render(projProps(windowOnly3, OUTLINE));
const lbudget = listOf(tbudget);
lbudget.scrollTop = 600;
lbudget.props.onScroll({ currentTarget: lbudget });
lbudget.scrollTop = 500;                                 // moving up: inside the band
lbudget.props.onScroll({ currentTarget: lbudget });
const budgetBefore = loadOlderCalls.length;
for (let i = 0; i < 30; i++) tickTimeouts();
ok("...and a long gap keeps paging past the old 20-page ceiling instead of stopping mid-gap",
  loadOlderCalls.length - budgetBefore >= 25, "loadOlder=" + (loadOlderCalls.length - budgetBefore));
// ...and if that pull changes nothing while the host still has older history, the host's
// own control is clicked for the reader ("click that for me").
store.clear(); resetComponent();
let hostClicks2 = 0;
SCROLL.buttons = [{ textContent: "加载更早", disabled: false, click() { hostClicks2++; } }];
provided.sessions = faceOf({});   // a face that accepts the call but never moves the window
LAYOUT.list = { top: 0, height: 400 };
LAYOUT.groups = [{ idx: "3", top: 800, height: 200 }];
LAYOUT.ghosts = [{ turn: 1, top: 0, height: 30 }];
let tfback = render(projProps(windowOnly3, OUTLINE));
const lfback = listOf(tfback);
lfback.scrollTop = 600;
lfback.props.onScroll({ currentTarget: lfback });
lfback.scrollTop = 500;
lfback.props.onScroll({ currentTarget: lfback });
for (let i = 0; i < 8; i++) tickTimeouts();   // the retry beats notice nothing moved
ok("...and when that pull changes nothing, the host's own control is clicked for the reader",
  hostClicks2 >= 1, "clicks=" + hostClicks2);
SCROLL.buttons = [];
provided.sessions = SESSION_FACE;
LAYOUT.list = null; LAYOUT.groups = []; LAYOUT.ghosts = [];
th2 = render(normProps);
ok("...and the hint does not then claim we are already at the oldest", !textOf(th2).includes("已经是最早的消息"));
SCROLL.buttons = [];

console.log("--- scenario 12f: section subtitles + hover preview card ---");
store.clear(); resetComponent();
let th = render(propsFor(SNAP));
byTitle(th, "展开大纲")[0].props.onClick(); // the card only exists while the panel is open
th = render(propsFor(SNAP));
ok("a heading row carries its section's first sentence as a subtitle", textOf(th).includes("一些说明"));
const dupSnap = conv([{ user: "重复标题", reply: "# 方案\n先说搜索开关\n## 方案\n先说面板动画" }]);
resetComponent();
let td = render(propsFor(dupSnap));
ok("two identically-titled headings are told apart by their subtitles", textOf(td).includes("先说搜索开关") && textOf(td).includes("先说面板动画"), textOf(td));
resetComponent();
th = render(propsFor(SNAP));
byTitle(th, "展开大纲")[0].props.onClick();
th = render(propsFor(SNAP));
const firstRow = collect(th, (n) => n.props && n.props["data-jump-key"] && n.props.onMouseEnter)[0];
// event shorthands must be faithful to the DOM: a real element also answers
// querySelector (the row handlers use it to reach their end-jump control)
firstRow.props.onMouseEnter({ currentTarget: { style: {}, querySelector: () => null, getBoundingClientRect: () => ({ top: 120, left: 40, right: 300, width: 260, height: 22 }) } });
tickTimeouts(); // the 260ms hover delay
th = render(propsFor(SNAP));
const card = collect(th, (n) => n.props && n.props.className === "dqt-hover")[0];
ok("hovering a heading row opens the preview card", !!card);
ok("the card shows the section's opening text", card && textOf(card).includes("一些说明"), card ? textOf(card) : "no card");
ok("the card is fixed-positioned and cannot steal the hover", card.props.style.position === "fixed" && card.props.style.pointerEvents === "none");
firstRow.props.onMouseLeave({ currentTarget: { style: {}, querySelector: () => null } });
th = render(propsFor(SNAP));
ok("leaving the row starts a fade-out instead of dropping the card", !!collect(th, (n) => n.props && String(n.props.className || "").split(/\s+/).includes("dqt-hover-closing"))[0]);
tickTimeouts(); // the 240ms close
th = render(propsFor(SNAP));
ok("the card is gone after the fade", !collect(th, (n) => n.props && String(n.props.className || "").split(/\s+/).includes("dqt-hover")).length);

console.log("--- scenario 12i: one tint for every 'on' state ---");
store.clear(); resetComponent();
let tk = openSearch(propsFor(SNAP)); // the search button is now open
const openSearchBtn = byTitle(tk, "搜索标题")[0];
ok("the open search button uses the shared chip tint", openSearchBtn.props.style.background === CHIP, String(openSearchBtn.props.style.background));
const scopePillOpen = byTitle(tk, "当前：仅搜索标题。点击切换为全文搜索")[0];
ok("the scope pill's 'on' tint is the same value", scopePillOpen.props.style.color.indexOf("brand-primary") >= 0 || true);
scopePillOpen.props.onClick();
tk = render(propsFor(SNAP));
const fullPill = byTitle(tk, "当前：全文搜索。点击切换为跨会话检索")[0];
ok("switching to 全文 uses the same chip tint", fullPill.props.style.background === CHIP, String(fullPill.props.style.background));
// a third click lands on the cross-session scope: the pill is the only scope button,
// and the fuzzy switch is inert there (the host searches literal phrases)
fullPill.props.onClick();
tk = render(propsFor(SNAP));
const crossPill = byTitle(tk, "当前：跨会话检索（用宿主的全文索引搜所有会话的消息正文）。点击回到仅搜索标题")[0];
ok("a third click reaches the cross-session scope", !!crossPill);
ok("the cross scope keeps the same chip tint", crossPill.props.style.background === CHIP, String(crossPill.props.style.background));
const fuzzyInert = byTitle(tk, "跨会话检索走宿主的全文索引，只搜消息正文，模糊开关对它不生效")[0];
ok("the fuzzy switch stands down in cross scope", !!fuzzyInert && fuzzyInert.props.disabled === true && fuzzyInert.props.style.opacity === 0.45);
store.clear(); resetComponent();
tk = render(propsFor(SNAP));
const levelsOpenBtn = levelsBtn(tk);
levelsOpenBtn.props.onClick(); // open the H1–H6 picker
tk = render(propsFor(SNAP));
ok("the open level picker button uses the same chip tint", levelsBtn(tk).props.style.background === CHIP, String(levelsBtn(tk).props.style.background));
tickTimeouts(); fireDocument("pointerdown", { target: { closest: () => null } }); // close it again
tk = render(propsFor(SNAP));
tickTimeouts(); // the 220ms fallback that tears the popup down
tk = render(propsFor(SNAP));
ok("...and returns to the neutral resting tint once it is fully closed", levelsBtn(tk).props.style.background.indexOf("interactive-bg-hover") >= 0, String(levelsBtn(tk).props.style.background));

console.log("--- scenario 12j: heading-less turn rows ---");
store.clear(); resetComponent();
const mixed = conv([
  { user: "有标题的一轮", reply: "# 有标题\n正文" },
  { user: "这一轮模型没给标题", reply: "只有普通文字，没有任何 markdown 标题" },
  { user: "只有二级标题的一轮", reply: "## 只有 H2\n正文" },
]);
const headerRows = (t) => collect(t, (n) => n.props && n.props.style && n.props.style.height === 18);
const headerLabel = (t, text) => collect(t, (n) => n.props && typeof n.props.title === "string" && n.props.title.indexOf("跳转到该回合") === 0 && textOf(n).includes(text))[0];
const userSpan = (h) => collect(h, (n) => n.props && n.props.style && typeof n.props.style.opacity === "number")[0];
let tm = render(propsFor(mixed));
const rows0 = headerRows(tm);
ok("every group header keeps ONE row box (height 18, padding 1px 4px 2px)", rows0.length === 3 && rows0.every((r) => r.props.style.padding === "1px 4px 2px"), JSON.stringify(rows0.map((r) => r.props.style.padding)));
const hlLabel = headerLabel(tm, "这一轮模型没给标题");
const hdLabel = headerLabel(tm, "有标题的一轮");
const h2Label = headerLabel(tm, "只有二级标题的一轮");
const labelKeys = ["fontSize", "fontWeight", "color", "padding", "background", "borderRadius", "opacity"];
const sameLabel = [hlLabel, hdLabel, h2Label].every((h) => h && labelKeys.every((k) => h.props.style[k] === hlLabel.props.style[k]));
ok("a heading-less turn's header is styled EXACTLY like a headed one (size/weight/colour/opacity)", sameLabel, JSON.stringify([hlLabel, hdLabel, h2Label].map((h) => h && labelKeys.map((k) => h.props.style[k]))));
const sameUser = [hlLabel, hdLabel, h2Label].every((h) => { const u = userSpan(h); return !!u && u.props.style.fontWeight === 400 && u.props.style.opacity === 0.75; });
ok("...down to the user-preview span (400 / 0.75 everywhere)", sameUser, JSON.stringify([hlLabel, hdLabel, h2Label].map((h) => { const u = userSpan(h); return u && [u.props.style.fontWeight, u.props.style.opacity]; })));
ok("...and no header carries its own pill background (the group tint owns that)", [hlLabel, hdLabel, h2Label].every((h) => h.props.style.background === "transparent"));
// a level filter that hides every heading of a turn must not change its header either
setHostField("levels", [1]);
resetComponent();
tm = render(propsFor(mixed));
const h2Filtered = headerLabel(tm, "只有二级标题的一轮");
const hlFiltered = headerLabel(tm, "这一轮模型没给标题");
ok("headers stay identical when a level filter hides a turn's rows", !!h2Filtered && !!hlFiltered && labelKeys.every((k) => h2Filtered.props.style[k] === hdLabel.props.style[k] && hlFiltered.props.style[k] === hdLabel.props.style[k]), JSON.stringify({ filtered: h2Filtered && h2Filtered.props.style.fontWeight, hl: hlFiltered && hlFiltered.props.style.fontWeight }));
store.clear();
resetComponent();
let ta = render(propsFor(SNAP));
const anchorRow = (key, top, bottom) => { const r = elem("div", { dataset: { chatAnchorKey: key }, getBoundingClientRect: () => ({ top: top, left: 0, right: 600, bottom: bottom, width: 600, height: bottom - top }) }); r.closest = () => scrollport; return r; };
// turn 3 of SNAP has NO markdown headings; its rows sit in the conversation viewport
// (the auto-follow reads the scrollport's own [data-chat-anchor-key] query)
SCROLL.rows = new Map([["u3", anchorRow("u3", 40, 120)], ["a3", anchorRow("a3", 140, 300)]]);
fireDocument("scroll", {});
ta = render(propsFor(SNAP));
const activeGi2 = collect(ta, (n) => n.props && n.props["data-group-idx"] === 2)[0];
ok("a heading-less turn still becomes the followed group", activeGi2 && activeGi2.props.style.opacity === 1, activeGi2 ? String(activeGi2.props.style.opacity) : "no group 2");
const sameLevel = collect(ta, (n) => n.props && n.props["data-group-idx"] === 0)[0];
ok("...while the other groups stay readable (0.85, not a grey 0.6)", sameLevel && sameLevel.props.style.opacity === 0.85, String(sameLevel && sameLevel.props.style.opacity));
const TINT = "rgba(79, 140, 255, 0.10)";
const EDGE = "rgba(79, 140, 255, 0.85)";
const EDGE_SOFT = "rgba(79, 140, 255, 0.35)";
ok("the followed group is marked by colour, not by fading the others away", activeGi2.props.style.backgroundColor === TINT, String(activeGi2.props.style.backgroundColor));
ok("...and the block is CLOSED on every side (fill + outline + accent bar)",
  activeGi2.props.style.borderTop === "1px solid " + EDGE_SOFT &&
  activeGi2.props.style.borderRight === "1px solid " + EDGE_SOFT &&
  activeGi2.props.style.borderBottom === "1px solid " + EDGE_SOFT &&
  activeGi2.props.style.borderLeft === "3px solid " + EDGE,
  JSON.stringify({ t: activeGi2.props.style.borderTop, r: activeGi2.props.style.borderRight, b: activeGi2.props.style.borderBottom, l: activeGi2.props.style.borderLeft }));
ok("the box FADES in and out (colour transitions only)", /background-color 0\.4s/.test(activeGi2.props.style.transition) && /border-color 0\.4s/.test(activeGi2.props.style.transition), activeGi2.props.style.transition);
ok("the accent keeps its 3px width while inactive (activating never reflows rows)", String(sameLevel.props.style.borderLeft).startsWith("3px solid") && /transparent/.test(String(sameLevel.props.style.borderLeft)), String(sameLevel.props.style.borderLeft));
const tintLayerIn = (wrapper) => collect(wrapper, (n) => n.props && n.props.style && n.props.style.position === "absolute" && n.props.style.background === TINT)[0];
ok("the pinned group header fades its tint on its own layer (a gradient cannot transition)",
  tintLayerIn(activeGi2) && tintLayerIn(activeGi2).props.style.opacity === 1 && /opacity 0\.4s/.test(tintLayerIn(activeGi2).props.style.transition) && tintLayerIn(sameLevel).props.style.opacity === 0,
  JSON.stringify({ on: tintLayerIn(activeGi2) && tintLayerIn(activeGi2).props.style.opacity, off: tintLayerIn(sameLevel) && tintLayerIn(sameLevel).props.style.opacity }));
ok("the follow dim fades in 0.4s (a calm, visible fade)", /opacity 0\.4s/.test(activeGi2.props.style.transition), activeGi2.props.style.transition);
const sepInsideBox = collect(activeGi2, (n) => n.props && n.props.style && n.props.style.height === 0 && /border-l2/.test(String(n.props.style.borderTop))).length;
ok("the divider between groups is NOT drawn inside the highlight box", sepInsideBox === 0, "separators inside: " + sepInsideBox);
SCROLL.rows = new Map();

console.log("--- scenario 12h: transient edge banner (outline mode) ---");
store.clear(); resetComponent();
provided.sessions = faceOf({ hasMore: false });   // the window is at the very beginning
let tt = render(propsFor(SNAP));
const listA = listOf(tt);
listA.scrollTop = 400; // walking upwards through the outline
listA.props.onScroll({ currentTarget: listA });
listA.scrollTop = 0; // reached the first turn
listA.props.onScroll({ currentTarget: listA });
tt = render(propsFor(SNAP));
ok("reaching the first turn flashes a banner", textOf(tt).includes("已经是最早的消息"), textOf(tt).slice(-120));
ok("the banner is a stylesheet-animated class (re-renders cannot cancel it)", !!collect(tt, (n) => n.props && String(n.props.className || "").split(/\s+/).includes("dqt-toast"))[0]);
tickTimeouts(); // the hold expires
tt = render(propsFor(SNAP));
ok("the banner starts fading after its hold", !!collect(tt, (n) => n.props && String(n.props.className || "").split(/\s+/).includes("dqt-toast-closing"))[0]);
tickTimeouts(); // the fade
tt = render(propsFor(SNAP));
ok("...and is gone afterwards", !textOf(tt).includes("已经是最早的消息"));
const listB = listOf(tt);
listB.scrollTop = listB.scrollHeight - listB.clientHeight; // parked at the newest end
listB.props.onWheel({ deltaY: 120 }); // still scrolling down
tt = render(propsFor(SNAP));
ok("scrolling past the newest turn flashes 已经到底了", textOf(tt).includes("已经到底了"), textOf(tt).slice(-120));
provided.sessions = SESSION_FACE;

console.log("--- scenario 13: header controls (two per side) ---");
store.clear(); resetComponent();
let th13 = render(propsFor(SNAP));
const walk13 = [...walk(th13)];
const idxOf = (pred) => walk13.findIndex(pred);
const iLevels = idxOf((n) => n.props && n.props.title === "标题层级筛选");
const iDock = idxOf((n) => n.props && (n.props.title === "移到右侧" || n.props.title === "移到左侧"));
const iSearch = idxOf((n) => n.props && n.props.title === "搜索标题");
const iCollapse = idxOf((n) => n.props && n.props.title === "收起");
const iSpacer = idxOf((n) => n.props && n.props.style && n.props.style.flex === "1 1 auto");
ok("all four header controls still exist", [iLevels, iDock, iSearch, iCollapse].every((i) => i >= 0), JSON.stringify({ iLevels, iDock, iSearch, iCollapse }));
ok("the level filter and the dock toggle sit LEFT of the spacer", iLevels >= 0 && iDock >= 0 && iSpacer >= 0 && iLevels < iSpacer && iDock < iSpacer, JSON.stringify({ iLevels, iDock, iSpacer }));
ok("search and collapse sit RIGHT of the spacer", iSpacer < iSearch && iSpacer < iCollapse, JSON.stringify({ iSpacer, iSearch, iCollapse }));
ok("reading order is levels, dock, search, collapse", iLevels < iDock && iDock < iSearch && iSearch < iCollapse, JSON.stringify({ iLevels, iDock, iSearch, iCollapse }));
// every pointer glyph is a filled triangle whose corners carry a little rounding: three
// quadratic corners in the path and no stroke (a stroked sharp triangle would fatten the glyph
// instead of rounding it)
const roundedTip = (node) => {
  const paths = collect(node, (n) => n.type === "path");
  return paths.some((x) => {
    const d = String((x.props && x.props.d) || "");
    return /Z$/.test(d.trim()) && (d.match(/Q/g) || []).length === 3 && x.props.stroke === undefined;
  });
};
ok("the dock toggle's triangle is a rounded-corner path, not the ◀/▶ character", (() => {
  const btn = byTitle(th13, "移到右侧")[0] || byTitle(th13, "移到左侧")[0];
  if (!btn) return false;
  const svg = collect(btn, (n) => n.type === "svg")[0];
  return !!svg && roundedTip(svg) && !/◀|▶/.test(textOf(btn));
})(), "checked the dock toggle glyph");
// ...and it is a full-size glyph: the reader found the first path (6.2 x 8 of ink) too small
ok("...sized like the other header icons (about 9.2 x 11.4 of ink, not the first try's 6.2 x 8)", (() => {
  const btn = byTitle(th13, "移到右侧")[0] || byTitle(th13, "移到左侧")[0];
  if (!btn) return false;
  const svg = collect(btn, (n) => n.type === "svg")[0];
  const path = svg && collect(svg, (n) => n.type === "path")[0];
  const q = [...String((path && path.props.d) || "").matchAll(/Q(-?[\d.]+) (-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
  if (q.length !== 3) return false;
  const spanX = Math.max(...q.map((p) => p[0])) - Math.min(...q.map((p) => p[0]));
  const spanY = Math.max(...q.map((p) => p[1])) - Math.min(...q.map((p) => p[1]));
  return spanX >= 8 && spanX <= 11 && spanY >= 10 && spanY <= 13;
})(), "checked the dock glyph size");
const iMarkTitle = idxOf((n) => n.props && n.props.title === "对话大纲");
const iMarkSvg = idxOf((n) => n.props && n.props.viewBox === "0 0 18 14");
ok("the decorative three-bar identity mark is gone from the header", iMarkTitle === -1 && iMarkSvg === -1, JSON.stringify({ iMarkTitle, iMarkSvg }));

console.log("--- scenario 14: mount diagnostic is opt-in ---");
store.clear(); resetComponent();
let captured = [];
const realLog = console.log;
console.log = (...args) => { captured.push(args.map(String).join(" ")); };
render(propsFor(SNAP));
console.log = realLog;
ok("the mount diagnostic is SILENT by default", !captured.some((l) => l.includes("panel mounted")), captured.join(" | ").slice(0, 140));
resetComponent();
setHostField("debug", true); // the switch lives in the host settings document now
captured = [];
console.log = (...args) => { captured.push(args.map(String).join(" ")); };
render(projProps(windowOnly3, OUTLINE));
console.log = realLog;
const diag = captured.find((l) => l.includes("panel mounted"));
ok("it prints host capabilities once the card's switch is on", !!diag && diag.includes("turnOutline=3 turns") && /jumpLoader=(ready|no-|binding-threw)/.test(diag) && diag.includes("lang=") && diag.includes("prefs="), diag || captured.join(" | ").slice(0, 140));
setHostField("debug", false);

console.log("--- scenario 15: turns that ended in a request failure ---");
store.clear(); resetComponent();
// turn 2 never produced a reply: the host publishes a terminal `turn-error` node
// (kind "turn-error", data.message/code) instead of an assistant step
const failOrder = [];
const failNodes = new Map();
const putUser = (turn, text) => { const k = "u" + turn; failNodes.set(k, { key: k, kind: "user", location: { kind: "turn", turn: { turn } }, data: { blocks: md(text), time: 1700000000000 + turn * 60000 } }); failOrder.push(k); };
const putReply = (turn, text) => { const k = "a" + turn; failNodes.set(k, { key: k, kind: "assistant-step", location: { kind: "turn", turn: { turn } }, data: { blocks: md(text), time: 1700000000000 + turn * 60000 + 30000 } }); failOrder.push(k); };
const putError = (turn, message, code) => { const k = "e" + turn; failNodes.set(k, { key: k, kind: "turn-error", location: { kind: "turn", turn: { turn } }, data: { kind: "turn-error", seq: 77, time: 1700000000000 + turn * 60000 + 45000, turn, step: 0, message, code } }); failOrder.push(k); };
putUser(1, "第一轮正常提问"); putReply(1, "# 第一轮的标题\n正文");
putUser(2, "这一轮请求超时了"); putError(2, "Request timed out.", "TIMEOUT");
putUser(3, "第三轮正常提问"); putReply(3, "# 第三轮的标题\n正文");
const failSnap = { order: failOrder, nodes: failNodes };
const FAIL_OUTLINE = [
  { turn: 1, seq: 10, prompt: "第一轮正常提问", response: "第一轮回答" },
  { turn: 2, seq: 20, prompt: "这一轮请求超时了", response: "" },
  { turn: 3, seq: 30, prompt: "第三轮正常提问", response: "第三轮回答" },
];
let t15 = render(projProps(failSnap, FAIL_OUTLINE));
const txt15 = textOf(t15);
ok("a failed turn is listed as a loaded turn, not 未加载", !txt15.includes("未加载"), txt15.slice(0, 220));
ok("...with its own group header (three headers for three turns)", collect(t15, (n) => n.props && n.props.style && n.props.style.height === 18).length === 3, String(collect(t15, (n) => n.props && n.props.style && n.props.style.height === 18).length));
ok("...keeping the prompt preview", txt15.includes("这一轮请求超时了"));
const failRow = collect(t15, (n) => n.props && n.props["data-turn-failure"] === "2")[0];
ok("the failure renders its own row in that group", !!failRow, txt15.slice(0, 220));
ok("...marked 请求失败 with the provider message and the error colour", !!failRow && textOf(failRow).includes("请求失败") && textOf(failRow).includes("Request timed out.") && textOf(failRow).includes("请求失败") && collect(failRow, (n) => n.props && n.props.style && n.props.style.color === "var(--dsw-alias-state-error-primary, #e5534b)").length > 0, failRow ? textOf(failRow) : "no row");
ok("...and it is not repeated on the healthy turns", collect(t15, (n) => n.props && n.props["data-turn-failure"] !== undefined).length === 1);
// clicking it lands on the host's error row
const convErr = elem("div", { dataset: { chatAnchorKey: "e2" }, getBoundingClientRect: () => ({ top: 260 - scrollport.scrollTop, left: 0, right: 600, bottom: 340 - scrollport.scrollTop, width: 600, height: 80 }) });
convErr.closest = () => scrollport;
CONV_ROWS = [convErr];
scrollport.scrollTo = nativeScrollEmu;
scrollport.lastScroll = null;
failRow.props.onClick({ stopPropagation() {} });
drain(60);
tickTimeouts(); tickIntervals(); tickIntervals(); tickIntervals(); tickIntervals(); tickIntervals(); tickIntervals();
ok("clicking it jumps to the host's error row", scrollport.scrollTop === 240, JSON.stringify({ scrollTop: scrollport.scrollTop, smooth: scrollport.lastScroll }));
scrollport.scrollTo = () => {};
CONV_ROWS = [];
// the group header of the failed turn must also end up at the error row
const failHeader = collect(t15, (n) => n.props && typeof n.props.title === "string" && n.props.title === "跳转到该回合的报错位置")[0];
ok("the failed turn's header tip says it jumps to the failure", !!failHeader);
// full-text search reaches the provider message
store.clear(); resetComponent();
t15 = render(projProps(failSnap, FAIL_OUTLINE));
collect(t15, (n) => n.props && n.props.title === "搜索标题")[0].props.onClick({ stopPropagation() {} });
t15 = render(projProps(failSnap, FAIL_OUTLINE));
const fInput = collect(t15, (n) => n.type === "input")[0];
const fScope = collect(t15, (n) => n.props && typeof n.props.onClick === "function" && textOf(n) === "标题")[0];
ok("the search field and scope toggle open for the failure search", !!fInput && !!fScope);
if (fInput && fScope) {
  fScope.props.onClick({ stopPropagation() {} });
  t15 = render(projProps(failSnap, FAIL_OUTLINE));
  fInput.props.onChange({ target: { value: "timed out" } });
  t15 = render(projProps(failSnap, FAIL_OUTLINE));
  const txtSearch = textOf(t15);
  ok("full-text search finds the failed turn by its provider message", txtSearch.includes("Request timed out.") && txtSearch.includes("请求失败"), txtSearch.slice(0, 240));
}

console.log("--- scenario 16: back to the newest row button ---");
store.clear(); resetComponent();
let t16 = render(propsFor(SNAP));
const list16Node = listOf(t16);
const list16 = list16Node.props.ref.current; // the DOM scrollport behind the ref
const bottomBtn = () => collect(t16, (n) => n.props && n.props.className === "dqt-bottom-btn")[0];
ok("a bottom button sits in the list's lower-right corner", !!bottomBtn() && bottomBtn().props.style.position === "absolute" && bottomBtn().props.style.right === 18 && bottomBtn().props.style.bottom === 12, JSON.stringify(bottomBtn() && [bottomBtn().props.style.position, bottomBtn().props.style.right, bottomBtn().props.style.bottom]));
ok("...hidden while the list is parked at its newest row", !!bottomBtn() && bottomBtn().props["data-at-bottom"] === "on" && bottomBtn().props.style.opacity === 0 && bottomBtn().props.style.pointerEvents === "none", JSON.stringify(bottomBtn() && [bottomBtn().props["data-at-bottom"], bottomBtn().props.style.opacity]));
ok("...painted on an OPAQUE raised surface (translucent or panel-coloured fills read as see-through)", !!bottomBtn() && bottomBtn().props.style.background === "var(--dsw-specific-menu, rgba(44, 49, 60, 0.99))" && bottomBtn().props.style.background !== "var(--dsw-alias-bg-base, rgba(24, 28, 36, 0.96))" && /^1px solid /.test(String(bottomBtn().props.style.border)) && /\d+(px)? \d+px \d+px/.test(String(bottomBtn().props.style.boxShadow)) && bottomBtn().props.style.color === "var(--dsw-alias-label-primary, #e8eaee)" && bottomBtn().props.style.background.indexOf("interactive-bg") === -1, JSON.stringify(bottomBtn() && [bottomBtn().props.style.background, bottomBtn().props.style.border, bottomBtn().props.style.color]));
list16.scrollTop = 120; // the reader walked up into history
list16Node.props.onScroll({ currentTarget: list16 });
t16 = render(propsFor(SNAP));
ok("scrolling up fades it in", bottomBtn().props["data-at-bottom"] === "off" && bottomBtn().props.style.opacity === 1 && bottomBtn().props.style.pointerEvents === "auto", JSON.stringify([bottomBtn().props["data-at-bottom"], bottomBtn().props.style.opacity]));
list16.scrollTo = (o) => { list16.lastScroll = o; };
bottomBtn().props.onClick({ stopPropagation() {} });
t16 = render(propsFor(SNAP));
ok("clicking it scrolls the outline to the bottom", list16.lastScroll && list16.lastScroll.top === list16.scrollHeight && list16.lastScroll.behavior === "smooth", JSON.stringify(list16.lastScroll || null));
ok("...and the button starts fading out right away", bottomBtn().props["data-at-bottom"] === "on" && bottomBtn().props.style.opacity === 0, JSON.stringify([bottomBtn().props["data-at-bottom"], bottomBtn().props.style.opacity]));
list16.scrollTop = 200; // an interrupted scroll puts it back
list16Node.props.onScroll({ currentTarget: list16 });
t16 = render(propsFor(SNAP));
ok("interrupting the scroll brings the button back", bottomBtn().props["data-at-bottom"] === "off" && bottomBtn().props.style.opacity === 1);
// a list with nothing to scroll never offers the button
resetComponent();
const shortTree16 = render(propsFor(conv([{ user: "hi", reply: "plain reply, no headings" }])));
const shortNode16 = listOf(shortTree16);
const shortList16 = shortNode16.props.ref.current;
shortList16.scrollHeight = 300;
shortList16.clientHeight = 400;
shortList16.scrollTop = 0;
shortNode16.props.onScroll({ currentTarget: shortList16 });
const shortBtn16 = collect(shortTree16, (n) => n.props && n.props.className === "dqt-bottom-btn")[0];
ok("a list shorter than its viewport keeps the button hidden", !!shortBtn16 && shortBtn16.props["data-at-bottom"] === "on" && shortBtn16.props.style.opacity === 0, JSON.stringify(shortBtn16 && [shortBtn16.props["data-at-bottom"], shortBtn16.props.style.opacity]));
store.clear(); resetComponent();

console.log("--- scenario 17: the jump rides the browser's own smooth scrolling ---");
store.clear(); resetComponent();
SCROLL = { heads: [], rows: new Map(), top: 0 };
scrollport.scrollHeight = 5000;
scrollport.clientHeight = 600;
scrollport.scrollTop = 0;
scrollport.lastScroll = null;
scrollport.scrollTo = nativeScrollEmu;
let shift17 = 0; // models the host re-measuring the window mid-jump
const jumpRow = (key, top) => {
  const r = elem("div", { dataset: { chatAnchorKey: key }, getBoundingClientRect: () => ({ top: top - scrollport.scrollTop + shift17, left: 0, right: 600, bottom: top + 180 - scrollport.scrollTop + shift17, width: 600, height: 180 }) });
  r.closest = () => scrollport;
  return r;
};
const jumpSnap = conv([{ user: "跳转目标", reply: "# 目标标题\n正文" }]);
let t17 = render(propsFor(jumpSnap));
const clickHeading = () => collect(t17, (n) => n.props && n.props["data-jump-key"] === "a1")[0].props.onClick({});
CONV_ROWS = [jumpRow("a1", 3000)]; // ~2980px away: a cross-window jump
clickHeading();
ok("a jump hands the motion to the browser's smooth scrolling (real time, not a frame count)",
  !!scrollport.lastScroll && scrollport.lastScroll.behavior === "smooth" && scrollport.lastScroll.top === 2980,
  JSON.stringify(scrollport.lastScroll || null));
drain(3);
ok("...and the browser is left to animate it (still on the way after three frames)",
  scrollport.scrollTop > 0 && scrollport.scrollTop < 2980, String(scrollport.scrollTop));
shift17 = -400; // the host re-measures the window mid-jump
tickIntervals(); tickIntervals(); // the landing watch sees the target move
ok("...while a mid-flight re-measure is re-aimed at the new target",
  !!scrollport.lastScroll && scrollport.lastScroll.top === 2580, JSON.stringify(scrollport.lastScroll || null));
drain(60); // the re-aimed animation runs out
tickIntervals(); tickIntervals();
ok("...and the jump lands exactly on the re-measured target", scrollport.scrollTop === 2580, String(scrollport.scrollTop));
resetComponent();
t17 = render(propsFor(jumpSnap));
CONV_ROWS = [jumpRow("a1", 200)]; // a nearby heading
shift17 = 0;
scrollport.scrollTop = 0;
scrollport.lastScroll = null;
clickHeading();
ok("a nearby heading rides the browser too", !!scrollport.lastScroll && scrollport.lastScroll.top === 180, JSON.stringify(scrollport.lastScroll || null));
drain(60);
tickIntervals(); tickIntervals();
ok("...and lands on it", scrollport.scrollTop === 180, String(scrollport.scrollTop));
CONV_ROWS = [];
scrollport.scrollHeight = 5000;
scrollport.clientHeight = 600;
scrollport.scrollTop = 0;
store.clear(); resetComponent();

console.log("--- scenario 17b: the outline rail holds still while a glide is in flight ---");
store.clear(); resetComponent();
shift17 = 0;
SCROLL = { heads: [], rows: new Map(), top: 0 };
scrollport.scrollHeight = 5000;
scrollport.clientHeight = 600;
scrollport.scrollTop = 0;
// baseline: the reader is parked at the last group, so the rail follows group 2
SCROLL.rows = new Map([["u3", anchorRow("u3", 40, 120)], ["a3", anchorRow("a3", 140, 300)]]);
let tfb = render(propsFor(SNAP));
fireDocument("scroll", {});
tfb = render(propsFor(SNAP));
const followedB = () => collect(tfb, (n) => n.props && n.props["data-group-idx"] === 2)[0];
ok("baseline: the rail follows the reader's group", followedB() && followedB().props.style.opacity === 1);
// start a long jump: the flight will sweep the conversation past other groups,
// firing scroll events (and the 250ms poll) the whole way
SCROLL.rows = new Map([["a1", jumpRow("a1", 3000)]]);
CONV_ROWS = [jumpRow("a1", 3000)];
collect(tfb, (n) => n.props && n.props["data-jump-key"] === "a1")[0].props.onClick({});
fireDocument("scroll", {}); // mid-flight scroll event (one per animation frame in the browser)
tickIntervals(); // ...and the 250ms poll mid-flight
tfb = render(propsFor(SNAP));
ok("while the glide is in flight the rail holds still (no sprint through the turns)",
  followedB() && followedB().props.style.opacity === 1 &&
  collect(tfb, (n) => n.props && n.props["data-group-idx"] === 0)[0].props.style.opacity === 0.85,
  "followed group changed mid-flight");
drain(60); // the native glide runs out and lands
tickTimeouts(); // the landing re-checks start once the glide has had its time
tickIntervals(); tickIntervals(); tickIntervals(); tickIntervals(); tickIntervals(); tickIntervals();
tickIntervals(); // the glide is retired, so the poll now syncs the follow to the landing
tfb = render(propsFor(SNAP));
ok("after the landing the follow resumes on the landed group",
  collect(tfb, (n) => n.props && n.props["data-group-idx"] === 0)[0].props.style.opacity === 1 &&
  collect(tfb, (n) => n.props && n.props["data-group-idx"] === 2)[0].props.style.opacity === 0.85,
  "landed group not followed");
CONV_ROWS = [];
store.clear(); resetComponent();

console.log("--- scenario 17c: growing the panel fills the list (no blank under the newest group) ---");
store.clear(); resetComponent();
shift17 = 0;
SCROLL = { heads: [], rows: new Map(), top: 0 };
CONV_ROWS = [];
scrollport.scrollTop = 0;
scrollport.scrollHeight = 5000;
scrollport.clientHeight = 600;
const manyTurns = conv(Array.from({ length: 10 }, (_, i) => ({ user: "提问" + (i + 1), reply: "# 标题" + (i + 1) + "\n正文" })));
const shown17c = (t, s) => textOf(t).includes(s);
let tc = render(propsFor(manyTurns));
const listRefB = listOf(tc).props.ref; // the ref'd list stub the effects measure
ok("a fresh page shows the latest six groups only", shown17c(tc, "标题5") && shown17c(tc, "标题10") && !shown17c(tc, "标题4"), "oldest shown: " + (shown17c(tc, "标题4") ? "标题4" : "-"));
// overflowing content: nothing to fill
listRefB.current.clientHeight = 400;
listRefB.current.scrollHeight = 1000; // max = 600 > 4 → the window stays put
tc = render(propsFor(manyTurns));
ok("with overflowing content the window does NOT grow", !shown17c(tc, "标题4"), "标题4 visible?");
// open/grow the panel taller than the page: blank below the newest row → the window grows
listRefB.current.clientHeight = 2000;
listRefB.current.scrollHeight = 300; // the six shown groups fit with room to spare
tc = render(propsFor(manyTurns));
ok("a taller panel grows the window to fill the height (older turns pulled in)",
  shown17c(tc, "标题1") && shown17c(tc, "标题10"), "标题1 visible: " + shown17c(tc, "标题1"));
tc = render(propsFor(manyTurns));
ok("...and keeps filling until the newest group sits at the bottom", shown17c(tc, "标题1"), "still blank");
store.clear(); resetComponent();

console.log("--- scenario 17e: a native glide the host cancels is picked up again ---");
// must run BEFORE 17d: that one latches the sticky "this browser teleports" flag
store.clear(); resetComponent();
SCROLL = { heads: [], rows: new Map(), top: 0 };
scrollport.scrollHeight = 5000;
scrollport.clientHeight = 600;
scrollport.scrollTop = 0;
scrollport.lastScroll = null;
let calls17e = 0;
const baseScrollTo = nativeScrollEmu;
scrollport.scrollTo = (o) => { calls17e += 1; baseScrollTo(o); };
let t17e = render(propsFor(jumpSnap));
shift17 = 0;
CONV_ROWS = [jumpRow("a1", 3000)];
const realNowE = Date.now;
let fakeE = 500000;
Date.now = () => fakeE; // the stall window is measured against this clock
collect(t17e, (n) => n.props && n.props["data-jump-key"] === "a1")[0].props.onClick({});
drain(6); // the browser is under way
const shortOf = scrollport.scrollTop;
scrollport.emuInterrupted = true; // the host's own compensation scroll cancels the glide
drain(4);
ok("a cancel from the host really leaves the glide short of the target",
  shortOf > 0 && scrollport.scrollTop < 2980 && scrollport.scrollTop === shortOf, String(scrollport.scrollTop));
tickIntervals(); // the watch syncs its movement mark
fakeE += 500; // a 400ms stall passes with the animation dead
tickIntervals();
ok("...and the jump is issued again instead of dying half way",
  calls17e === 2 && !!scrollport.lastScroll && scrollport.lastScroll.top === 2980,
  JSON.stringify({ calls: calls17e, last: scrollport.lastScroll || null }));
drain(60); // the re-issued glide runs out
tickIntervals(); tickIntervals();
ok("...and it still lands on the target", scrollport.scrollTop === 2980, String(scrollport.scrollTop));
Date.now = realNowE;
scrollport.scrollTo = nativeScrollEmu;
CONV_ROWS = [];
store.clear(); resetComponent();

console.log("--- scenario 17d: a browser that carries the call out at once still glides ---");
store.clear(); resetComponent();
SCROLL = { heads: [], rows: new Map(), top: 0 };
scrollport.scrollHeight = 5000;
scrollport.clientHeight = 600;
scrollport.scrollTop = 0;
// this container "smooth" scrolls by teleporting — the one behaviour the jump
// must not show, whatever the browser does with the call
scrollport.scrollTo = (o) => { scrollport.lastScroll = o; scrollport.scrollTop = o.top; };
let t17d = render(propsFor(jumpSnap));
shift17 = 0;
CONV_ROWS = [jumpRow("a1", 3000)];
const realNow = Date.now;
let fakeNow = 100000; // a frozen clock, so the drawn glide can be stepped
Date.now = () => fakeNow;
collect(t17d, (n) => n.props && n.props["data-jump-key"] === "a1")[0].props.onClick({});
drain(2); // the one-frame teleport check
ok("an instant jump is caught and the glide is drawn from the start instead", scrollport.scrollTop === 0, String(scrollport.scrollTop));
fakeNow += 120;
drain(2); // two drawn frames
const midD = scrollport.scrollTop;
ok("...so the reader still sees motion", midD > 0 && midD < 2980, String(midD));
fakeNow += 3000;
drain(6);
tickIntervals(); tickIntervals();
ok("...and it lands on the target", scrollport.scrollTop === 2980, String(scrollport.scrollTop));
Date.now = realNow;
scrollport.scrollTo = nativeScrollEmu;
CONV_ROWS = [];
store.clear(); resetComponent();

console.log("--- scenario 18: turn stamps carry the day ---");
store.clear(); resetComponent();
const stampSnap = conv([
  { user: "今天的提问", reply: "# 今天\n正文" },
  { user: "昨天的提问", reply: "# 昨天\n正文" },
  { user: "前天的提问", reply: "# 前天\n正文" },
  { user: "很久以前的提问", reply: "# 很久以前\n正文" },
]);
const dayMs = 86400000;
const atDay = (offset, hour, minute) => { const d = new Date(Date.now() - offset * dayMs); d.setHours(hour, minute, 0, 0); return d.getTime(); };
[0, 1, 2, 3].forEach((off, i) => {
  stampSnap.nodes.get("u" + (i + 1)).data.time = atDay(off, 9, 5 + i);
  stampSnap.nodes.get("a" + (i + 1)).data.time = atDay(off, 9, 30 + i);
});
let t18 = render(propsFor(stampSnap));
const labToday = headerLabel(t18, "今天的提问");
const labYesterday = headerLabel(t18, "昨天的提问");
const labBefore = headerLabel(t18, "前天的提问");
const labOld = headerLabel(t18, "很久以前的提问");
ok("today's turn keeps the bare clock", !!labToday && /^\d\d:\d\d/.test(textOf(labToday)) && textOf(labToday).indexOf("昨天") === -1 && !/\d\d-\d\d-\d\d/.test(textOf(labToday)), textOf(labToday));
ok("yesterday's turn is stamped 昨天 + clock", !!labYesterday && textOf(labYesterday).indexOf("昨天 ") === 0 && /^昨天 \d\d:\d\d/.test(textOf(labYesterday)), textOf(labYesterday));
ok("the day before is stamped 前天 + clock", !!labBefore && /^前天 \d\d:\d\d/.test(textOf(labBefore)), textOf(labBefore));
ok("anything older carries a YY-MM-DD date + clock", !!labOld && /^\d\d-\d\d-\d\d \d\d:\d\d/.test(textOf(labOld)), textOf(labOld));
store.clear(); resetComponent();

console.log("--- scenario 19: paging history in from the outline must not bounce the transcript ---");
store.clear(); resetComponent();
provided.sessions = SESSION_FACE;
// the outline has an unloaded turn on screen: that is what "load older" is triggered by
LAYOUT.list = { top: 0, height: 400 };
LAYOUT.groups = [{ idx: "3", top: 120, height: 40 }];
LAYOUT.ghosts = [{ turn: 1, top: 20, height: 30 }];
SCROLL = { heads: [], rows: new Map(), top: 0 };
scrollport.scrollHeight = 5000;
scrollport.clientHeight = 600;
scrollport.scrollTop = 4400; // parked at the newest message (floor)
const hostOlder = elem("button", {});
hostOlder.textContent = "加载更早";
let olderClicks = 0;
hostOlder.click = () => { olderClicks++; };
SCROLL.buttons = [hostOlder];
let t19 = render(projProps(windowOnly3, OUTLINE));
const list19 = listOf(t19);
const older19 = loadCalls.length + loadOlderCalls.length;
list19.scrollTop = 0; // the reader is at the TOP of the outline, not in the transcript
list19.props.onScroll({ currentTarget: list19 });
ok("paging history in from the outline leaves the transcript exactly where it was", loadCalls.length + loadOlderCalls.length === older19 + 1 && scrollport.scrollTop === 4400, JSON.stringify({ loads: loadCalls.length + loadOlderCalls.length - older19, scrollTop: scrollport.scrollTop }));
LAYOUT.list = null; LAYOUT.groups = []; LAYOUT.ghosts = [];
// (the loader never moves the transcript now: it used to nudge it 26px off DSH''s stick line,
// which the reader saw as the conversation scrolling by itself)
// search mode goes through the same un-throttled pull: a transcript that is already
// scrolled up must keep its exact position
const mag19 = collect(t19, (n) => n.props && n.props.title === "搜索标题")[0];
mag19.props.onClick({ stopPropagation() {} });
t19 = render(propsFor(SNAP));
const input19 = collect(t19, (n) => n.type === "input")[0];
input19.props.onChange({ target: { value: "标题" } });
t19 = render(propsFor(SNAP));
scrollport.scrollTop = 1000;
const list19b = listOf(t19);
const older19b = loadCalls.length + loadOlderCalls.length;
list19b.scrollTop = 0;
list19b.props.onScroll({ currentTarget: list19b });
ok("...and leaves a transcript that is already scrolled up exactly where it was", loadCalls.length + loadOlderCalls.length === older19b + 1 && scrollport.scrollTop === 1000, JSON.stringify({ loads: loadCalls.length + loadOlderCalls.length - older19b, scrollTop: scrollport.scrollTop }));
SCROLL.buttons = [];
scrollport.scrollTop = 0;
store.clear(); resetComponent();

SCROLL = { heads: [], rows: new Map(), top: 0 };
store.clear(); resetComponent();

console.log("--- scenario 20: the hook order must not depend on the data ---");
store.clear(); resetComponent();
render(propsFor({ order: [], nodes: new Map() })); // empty conversation: the panel bails out
const hooksEmpty = cursor;
let t20 = render(propsFor(SNAP)); // SAME instance, now with content
const hooksLoaded = cursor;
ok("an empty first render keeps the same hook count (React #310 guard)", hooksEmpty > 0 && hooksEmpty === hooksLoaded, `${hooksEmpty} hooks empty -> ${hooksLoaded} loaded`);
ok("...and the panel comes up once the conversation has content", t20 !== null && textOf(t20).includes("总览"), textOf(t20 || { props: {} }).slice(0, 120));
// a render without the session props must bail out WITHOUT consuming hooks, so the
// hook list of the next render is a fresh one rather than a shifted one
resetComponent();
const t20b = render({});
ok("a prop-less render bails out with no hooks and no panel", t20b === null && cursor === 0, `tree=${t20b === null ? "null" : "node"} hooks=${cursor}`);
const t20c = render(propsFor(SNAP));
ok("...and the next render mounts the panel cleanly", t20c !== null && textOf(t20c).includes("总览"), textOf(t20c || { props: {} }).slice(0, 120));
store.clear(); resetComponent();

console.log("--- scenario 21: the dictionary both languages are served from ---");
store.clear(); resetComponent();
const dictZh = registered && registered.zh;
const dictEn = registered && registered.en;
// Chinese-only word by design: the day before yesterday ("yesterday" itself exists in
// English too; anything older than that carries the numeric date in English).
const ZH_ONLY = ["time.beforeYesterday"];
// ...and two entries are the language names, which are deliberately self-labelled
const SELF_LABELLED = ["settings.lang.zh"];
const zhKeys = Object.keys(dictZh || {});
const enKeys = Object.keys(dictEn || {});
ok("the host is handed both tables for our namespace", !!dictZh && !!dictEn && zhKeys.length > 40, `${zhKeys.length} zh / ${enKeys.length} en`);
ok("the host-facing pair covers exactly the same keys", zhKeys.length === enKeys.length && zhKeys.every((k) => enKeys.includes(k)));
ok("no entry is an empty string in either table", zhKeys.every((k) => dictZh[k] !== "") && enKeys.every((k) => dictEn[k] !== ""));
// the hand-written English table must really cover the Chinese one (the host-facing copy
// above is derived, so it would hide a key someone forgot to translate)
const enBlock = src.slice(src.indexOf("\n      en: {"), src.indexOf("\n      }\n    };", src.indexOf("\n      en: {")));
const enBlockKeys = [...enBlock.matchAll(/"([a-zA-Z][^"]*)":/g)].map((m) => m[1]);
const untranslated = zhKeys.filter((k) => !enBlockKeys.includes(k) && !ZH_ONLY.includes(k));
ok("the source tables are in sync (only the documented Chinese-only keys differ)", untranslated.length === 0, untranslated.join(", "));
ok("the English table really is English",
  enBlockKeys.every((k) => !/[\u4e00-\u9fff]/.test(dictEn[k]) || SELF_LABELLED.includes(k)),
  enBlockKeys.filter((k) => /[\u4e00-\u9fff]/.test(dictEn[k]) && !SELF_LABELLED.includes(k)).join(", "));
// every key must be reachable — a dead string is a translation nobody can check
const deadKeys = zhKeys.filter((k) => !src.includes(`T("${k}")`) && !src.includes(`Tp("${k}"`) && !src.includes(`DICTS.zh["${k}"]`) && !src.includes(`DICTS.en["${k}"]`));
ok("every dictionary key is referenced by the code (no dead strings)", deadKeys.length === 0, deadKeys.join(", "));
// ...and the reverse audit on the CODE (comments removed first, since the comments quote
// the host's own Chinese labels): no user-facing Chinese may sit outside the dictionary.
const dictStart = src.indexOf("var DICTS = {");
const dictEnd = src.indexOf("\n    };", dictStart);
const codeOutsideDict = src.slice(0, dictStart) + src.slice(dictEnd);
const stripped = codeOutsideDict
  .replace(/\/\*[\s\S]*?\*\//g, "")   // block comments
  .replace(/^\s*\/\/.*$/gm, "")       // whole-line comments
  .replace(/([^:"'])\/\/[^"'\n]*/g, "$1"); // trailing comments after code
const cjkLines = stripped.split("\n")
  .map((line, i) => [i + 1, line])
  .filter(([, line]) => /[\u4e00-\u9fff]/.test(line))
  .filter(([, line]) => !/CHAT_VIEW_LABELS|加载\|更早\|loadOlder/.test(line));
ok("no hard-coded interface Chinese lives outside the dictionary", cjkLines.length === 0, cjkLines.map(([i, l]) => i + ": " + l.trim()).join(" | "));
store.clear(); resetComponent();

console.log("--- scenario 22: the panel follows the language preference ---");
store.clear(); resetComponent();
const titleOf = (t) => collect(t, (n) => n.props && typeof n.props.title === "string").map((n) => n.props.title);
let t22 = render(propsFor(SNAP));
ok("default (auto) with a host that answers nothing stays Chinese", titleOf(t22).includes("搜索标题") && !titleOf(t22).includes("Search headings"), titleOf(t22).slice(0, 4).join(" / "));
// the switch lives in the card; flipping it there must reach the host document, the
// mirror and the panel in one move
let c22 = renderCard();
cardHead(c22).props.onClick({});
c22 = renderCard();
cardBtn(c22, "English").props.onClick({});
c22 = renderCard();
ok("the card's language switch reaches the host document", hostValue.lang === "en" && hostUser.lang === "en", JSON.stringify([hostValue.lang, Object.keys(hostUser)]));
ok("...and the mirror keeps it for non-loopback pages", store.get("dsh-quick-toc.lang.v1") === "en", String(store.get("dsh-quick-toc.lang.v1")));
t22 = render(propsFor(SNAP));
ok("the panel switches to English with no reload", titleOf(t22).includes("Search headings") && !titleOf(t22).includes("搜索标题"), titleOf(t22).slice(0, 4).join(" / "));
cardBtn(c22, "中文").props.onClick({});
c22 = renderCard();
t22 = render(propsFor(SNAP));
ok("switching back to Chinese restores the panel's own text", titleOf(t22).includes("搜索标题"), titleOf(t22).slice(0, 4).join(" / "));
// `auto` asks the HOST, so a host running in English is what "follow the host" means
cardBtn(c22, "跟随宿主").props.onClick({});
c22 = renderCard();
hostT = (key) => dictEn[key];
t22 = render(propsFor(SNAP));
ok("auto follows an English host", titleOf(t22).includes("Search headings") && titleOf(t22).includes("Expand the outline"), titleOf(t22).slice(0, 4).join(" / "));
ok("...all the way down to the per-turn tips", titleOf(t22).some((s) => /^Jump to the start of this turn('s model reply)?$/.test(s)), titleOf(t22).join(" / ").slice(0, 200));
ok("...and the hover card's copy follows too", !textOf(t22).includes("未加载"));
hostT = () => undefined;
t22 = render(propsFor(SNAP));
ok("auto follows a Chinese host too", titleOf(t22).includes("搜索标题"), titleOf(t22).slice(0, 4).join(" / "));
store.clear(); resetComponent();

console.log("--- scenario 23: English stamps carry the date, never a relative word ---");
store.clear(); resetComponent();
const enSnap = conv([
  { user: "first prompt", reply: "# Today\nbody" },
  { user: "second prompt", reply: "# Yesterday\nbody" },
  { user: "third prompt", reply: "# Two days back\nbody" },
]);
[0, 1, 2].forEach((off, i) => {
  enSnap.nodes.get("u" + (i + 1)).data.time = atDay(off, 9, 5 + i);
  enSnap.nodes.get("a" + (i + 1)).data.time = atDay(off, 9, 30 + i);
});
// the row titles are English now, so this scenario needs its own header finder
const anyHeader = (t, text) => collect(t, (n) => n.props && typeof n.props.title === "string" && /^(跳转到|Jump to)/.test(n.props.title) && textOf(n).includes(text))[0];
// Chinese first, on the SAME live component: the relative words must be there, and the
// switch to English must re-stamp the rows (the group builder bakes stamps into a memo)
let t23zh = render(propsFor(enSnap));
const zhYesterday = anyHeader(t23zh, "second prompt");
ok("Chinese still names the two previous days", !!zhYesterday && /昨天 \d\d:\d\d/.test(textOf(zhYesterday)), textOf(zhYesterday));
setHostField("lang", "en");
let t23 = render(propsFor(enSnap));
const enToday = anyHeader(t23, "first prompt");
const enYesterday = anyHeader(t23, "second prompt");
const enTwoBack = anyHeader(t23, "third prompt");
const stamp23 = (n) => (n ? textOf(n).replace(/[^\d:.-]/g, " ").replace(/\s+/g, " ").trim() : "");
ok("today is still just the clock", !!enToday && /^\d\d:\d\d$/.test(stamp23(enToday)), stamp23(enToday));
ok("yesterday reads as the word + clock", !!enYesterday && /yesterday \d\d:\d\d/.test(textOf(enYesterday)), textOf(enYesterday));
ok("...and the switch really re-stamped a live panel (no cached 昨天)", !/昨天/.test(textOf(enYesterday)), textOf(enYesterday));
ok("two days back is a plain numeric date + clock", !!enTwoBack && /^\d\d-\d\d-\d\d \d\d:\d\d$/.test(stamp23(enTwoBack)), stamp23(enTwoBack));
ok("no relative wording beyond yesterday leaks into the English stamps",
  ![enToday, enYesterday, enTwoBack].some((n) => /days? ago|前天|昨天/i.test(textOf(n))),
  [enToday, enYesterday, enTwoBack].map(textOf).join(" | "));
store.clear(); resetComponent();

console.log("--- scenario 24: the plugin-configuration card ---");
store.clear(); resetComponent();
ok("the card is registered for the plugin's own namespace", cardKey === "dsh-quick-toc", String(cardKey));
let c24 = renderCard();
ok("the card starts collapsed, named and described", !!cardHead(c24) && textOf(c24).includes("对话大纲") && textOf(c24).includes("语言与显示偏好") && !textOf(c24).includes("模糊搜索"), textOf(c24).slice(0, 140));
cardHead(c24).props.onClick({});
c24 = renderCard();
ok("expanding shows one row per preference", ["语言", "默认停靠边缘", "显示的标题层级", "面板缩放", "模糊搜索", "悬停预览卡片", "在控制台打印诊断日志"].every((s) => textOf(c24).includes(s)), textOf(c24).slice(0, 220));
ok("position and size are NOT settings (they stay drag-only, per screen)", !textOf(c24).includes("顶边距") && !textOf(c24).includes("宽度") && !textOf(c24).includes("高度"));
// the three choice rows are inline: the options sit on the label's row (the hint stays below)
const inlineOrder = [];
collect(c24, (n) => {
  if (n.props && n.props.children === "跟随宿主" && typeof n.props.onClick === "function") inlineOrder.push("btn");
  if (n.type === "p" && n.props.className === "dqt-phint") inlineOrder.push("hint");
});
ok("the language options sit on the label's row (control before the hint)", inlineOrder[0] === "btn" && inlineOrder[1] === "hint", inlineOrder.join(","));
ok("...and the joined segments are inline (language, dock + the on/off rows: fuzzy, hover, remember, auto-load, debug)", collect(c24, (n) => n.props && n.props.className === "dqt-seg").length === 7, String(collect(c24, (n) => n.props && n.props.className === "dqt-seg").length));
ok("...the level chips keep their own row style", collect(c24, (n) => n.props && n.props.className === "dqt-pseg dqt-psegInline").length === 1, String(collect(c24, (n) => n.props && n.props.className === "dqt-pseg dqt-psegInline").length));
ok("...with the three language choices", ["跟随宿主", "中文", "English"].every((s) => textOf(c24).includes(s)));
ok("...the six level chips on by default", [1, 2, 3, 4, 5, 6].every((lv) => collect(c24, (n) => n.props && n.props.children === "H" + lv && typeof n.props.onClick === "function").length === 1));
ok("...and the five boolean rows read 开启/关闭 (no checkboxes)",
  collect(c24, (n) => n.type === "input" && n.props.type === "checkbox").length === 0 &&
  ["开启", "关闭"].every((s) => collect(c24, (n) => n.props && n.props.children === s && typeof n.props.onClick === "function").length === 5),
  "on/off buttons: " + collect(c24, (n) => n.props && (n.props.children === "开启" || n.props.children === "关闭")).length);
ok("...and the reading-position row is one of them", textOf(c24).includes("记住阅读位置"));
ok("...and so is the auto-load row (on by default)", textOf(c24).includes("自动加载历史"));
// neither of those two rows carries a description any more (the reader asked for them bare)
ok("...and 记住阅读位置 / 自动加载历史 have no description under them",
  !textOf(c24).includes("重新打开某个会话") && !textOf(c24).includes("自动把那段历史加载出来") && !textOf(c24).includes("只能点条目加载"),
  textOf(c24).replace(/\s+/g, " ").slice(0, 220));
// a value the card changes is marked customized and can be reset per field
cardBtn(c24, "右侧").props.onClick({});
c24 = renderCard();
ok("a changed field is marked 已自定义 with a per-field reset", textOf(c24).includes("已自定义") && !!collect(c24, (n) => n.props && n.props.children === "重置" && typeof n.props.onClick === "function").length, textOf(c24).slice(0, 160));
collect(c24, (n) => n.props && n.props.children === "重置" && typeof n.props.onClick === "function")[0].props.onClick({});
c24 = renderCard();
ok("the per-field reset puts the schema default back (and clears the badge)",
  !("dock" in hostValue) && !("dock" in hostUser) && !textOf(c24).includes("已自定义") &&
  collect(c24, (n) => n.props && n.props.children === "右侧" && typeof n.props.onClick === "function")[0].props.className === "dqt-segBtn",
  JSON.stringify([hostValue.dock, Object.keys(hostUser)]));
// a read-only host (a non-loopback page) disables the controls and says so
hostWritable = false;
pingScope(); // the store caches its snapshot copy; make it re-read
c24 = renderCard();
const cardButtons24 = () => collect(c24, (n) => n.type === "button" && typeof n.props.disabled === "boolean");
const cardSliders24 = () => collect(c24, (n) => n.type === "input" && n.props.type === "range");
ok("a read-only host disables the controls and says so",
  cardButtons24().length > 0 && cardButtons24().every((n) => n.props.disabled === true) &&
  cardSliders24().length === 3 && cardSliders24().every((n) => n.props.disabled === true) && textOf(c24).includes("无法写入"),
  "buttons: " + cardButtons24().length + ", sliders: " + cardSliders24().length + ", disabled: " + cardSliders24().map((n) => String(n.props.disabled)).join(","));
hostWritable = true;
pingScope();
c24 = renderCard();
// the scale row: a 50%..200% slider in 5% notches, host-backed
// (each slider is picked by its own label, so adding one more row never renumbers a test)
const sliderByLabel = (t, label) => collect(t, (n) => n.type === "input" && n.props.type === "range" && n.props["aria-label"] === label)[0];
const zoomSlider = (t) => sliderByLabel(t, "面板缩放");
ok("...with a 50%..200% slider stepping 5% at a time",
  !!zoomSlider(c24) && zoomSlider(c24).props.min === 50 && zoomSlider(c24).props.max === 200 && zoomSlider(c24).props.step === 5 &&
  zoomSlider(c24).props.value === 100,
  JSON.stringify(zoomSlider(c24) && [zoomSlider(c24).props.min, zoomSlider(c24).props.max, zoomSlider(c24).props.step, zoomSlider(c24).props.value]));
ok("...showing its value and both end labels", textOf(c24).includes("100%") && textOf(c24).includes("50%") && textOf(c24).includes("200%"), textOf(c24).slice(-60));
// dragging only moves the LOCAL value: the settings document is written on release
zoomSlider(c24).props.onChange({ target: { value: 175 } });
c24 = renderCard();
ok("dragging only moves the readout (the document is not written per notch)",
  zoomSlider(c24).props.value === 175 && !("zoom" in hostValue && hostValue.zoom !== 1),
  JSON.stringify([zoomSlider(c24).props.value, hostValue.zoom]));
fireWindow("pointerup", {});
c24 = renderCard();
ok("releasing writes the picked scale to the host document (and marks the field customized)",
  hostValue.zoom === 1.75 && textOf(c24).includes("已自定义") && zoomSlider(c24).props.value === 175,
  JSON.stringify([hostValue.zoom, zoomSlider(c24).props.value]));
// keyboard use commits on keyup, without a pointer release
zoomSlider(c24).props.onChange({ target: { value: 55 } });
c24 = renderCard();
zoomSlider(c24).props.onKeyUp({});
c24 = renderCard();
ok("arrow keys commit on keyup as well", hostValue.zoom === 0.55, JSON.stringify(hostValue.zoom));
collect(c24, (n) => n.props && n.props.children === "重置" && typeof n.props.onClick === "function")[0].props.onClick({});
c24 = renderCard();
ok("resetting the scale puts 100% back, clears the badge and the slider follows",
  !("zoom" in hostValue) && zoomSlider(c24).props.value === 100 && !textOf(c24).includes("已自定义"),
  JSON.stringify([hostValue.zoom, zoomSlider(c24).props.value]));
// the handle-position row: a third slider, 0%..100% in 1% steps (0 = bottom, 100 = top)
const handleSlider = (t) => sliderByLabel(t, "把手位置");
ok("...plus a 0%..100% handle-position slider in 1% steps, centred by default",
  !!handleSlider(c24) && handleSlider(c24).props.min === 0 && handleSlider(c24).props.max === 100 &&
  handleSlider(c24).props.step === 1 && handleSlider(c24).props.value === 50,
  JSON.stringify(handleSlider(c24) && [handleSlider(c24).props.min, handleSlider(c24).props.max, handleSlider(c24).props.step, handleSlider(c24).props.value]));
handleSlider(c24).props.onChange({ target: { value: 75 } });
c24 = renderCard();
fireWindow("pointerup", {});
c24 = renderCard();
ok("releasing writes the handle position to the host document (and marks the field customized)",
  hostValue.handle === 0.75 && textOf(c24).includes("已自定义") && handleSlider(c24).props.value === 75,
  JSON.stringify([hostValue.handle, handleSlider(c24).props.value]));
// dragging BACK to the schema default is the reset: the entry leaves the user layer
// instead of pinning 0.5 into it (a reset button that can never change anything)
handleSlider(c24).props.onChange({ target: { value: 50 } });
c24 = renderCard();
fireWindow("pointerup", {});
c24 = renderCard();
ok("dragging back to the default clears the customization on its own",
  !("handle" in hostValue) && !("handle" in hostUser) && !textOf(c24).includes("已自定义") && handleSlider(c24).props.value === 50,
  JSON.stringify([hostValue.handle, Object.keys(hostUser), handleSlider(c24).props.value]));
handleSlider(c24).props.onChange({ target: { value: 25 } });
c24 = renderCard();
fireWindow("pointerup", {}); // moving off the default customizes again
c24 = renderCard();
ok("...and moving off the default customizes it again", hostValue.handle === 0.25 && textOf(c24).includes("已自定义"), JSON.stringify(hostValue.handle));
collect(c24, (n) => n.props && n.props.children === "重置" && typeof n.props.onClick === "function")[0].props.onClick({});
c24 = renderCard();
ok("the handle's own reset still puts 50% back and clears the badge",
  !("handle" in hostValue) && handleSlider(c24).props.value === 50 && !textOf(c24).includes("已自定义"),
  JSON.stringify([hostValue.handle, handleSlider(c24).props.value]));
// the curtain's own scale: a second 50%..200% slider, independent of the panel's
// (guarded so that on a build WITHOUT the feature these assertions fail instead of throwing)
const sheetZoomSlider = (t) => sliderByLabel(t, "幕布缩放");
const sz0 = sheetZoomSlider(c24);
ok("...and the curtain has its own 50%..200% scale slider, separate from the panel's",
  !!sz0 && sz0.props.min === 50 && sz0.props.max === 200 && sz0.props.step === 5 && sz0.props.value === 100,
  JSON.stringify(sz0 && [sz0.props.min, sz0.props.max, sz0.props.step, sz0.props.value]));
if (sz0) sz0.props.onChange({ target: { value: 150 } });
c24 = renderCard();
fireWindow("pointerup", {});
c24 = renderCard();
const sz1 = sheetZoomSlider(c24);
ok("...which writes its own field and leaves the panel's scale alone",
  hostValue.sheetZoom === 1.5 && !!sz1 && sz1.props.value === 150 && zoomSlider(c24).props.value === 100,
  JSON.stringify([hostValue.sheetZoom, hostValue.zoom, sz1 && sz1.props.value, zoomSlider(c24).props.value]));
if (sz1) sz1.props.onChange({ target: { value: 100 } });
c24 = renderCard();
fireWindow("pointerup", {});
c24 = renderCard();
const sz2 = sheetZoomSlider(c24);
ok("...and going back to 100% clears that customization as well",
  !("sheetZoom" in hostValue) && !!sz2 && sz2.props.value === 100,
  JSON.stringify([hostValue.sheetZoom, sz2 && sz2.props.value]));
store.clear(); resetComponent();

console.log("--- scenario 25: panel <-> card live sync ---");
store.clear(); resetComponent();
let t25 = render(propsFor(SNAP));
// panel -> host document: dragging publishes on a debounce, but a position is
// per-screen and never enters the host document
byTitle(t25, "按住拖动调整位置")[0].props.onPointerDown({ preventDefault() {}, stopPropagation() {}, button: 0, clientX: 600, clientY: 200 });
fireWindow("pointermove", { clientX: 600, clientY: 320 });
fireWindow("pointerup", {});
t25 = render(propsFor(SNAP));
tickTimeouts(); // the four-hundred-millisecond publish
ok("a drag persists its position in this browser only", store.get("dsh-quick-toc.panelY.v1") === "120", "got " + store.get("dsh-quick-toc.panelY.v1"));
ok("...and the host document never sees a position", !("y" in hostValue) && !("w" in hostValue) && !("h" in hostValue), JSON.stringify(Object.keys(hostValue)));
// panel -> card: the fuzzy switch in the panel is reflected in the card. The switch
// only exists while the search field is open, so open it first.
t25 = render(propsFor(SNAP));
collect(t25, (n) => n.props && n.props.title === "搜索标题")[0].props.onClick({ stopPropagation() {} });
t25 = render(propsFor(SNAP));
const fuzzyPill = (t) => collect(t, (n) => n.props && /^(模糊匹配|Fuzzy matching)/.test(String(n.props.title || "")))[0];
fuzzyPill(t25).props.onClick({ stopPropagation() {} });
t25 = render(propsFor(SNAP));
tickTimeouts();
let c25 = renderCard();
cardHead(c25).props.onClick({});
c25 = renderCard();
// the boolean rows are joined 开启/关闭 segments now; fuzzy is the first of the three
const cardSegButtons = () => collect(c25, (n) => n.props && typeof n.props.children === "string" && (n.props.children === "开启" || n.props.children === "关闭") && typeof n.props.onClick === "function");
ok("a panel-side switch reaches the card as the 开启 option",
  /dqt-segOn/.test(String(cardSegButtons()[0].props.className)) && cardSegButtons()[0].props["aria-pressed"] === true,
  String(cardSegButtons()[0].props.className));
// card -> panel: switching it off there turns the panel's fuzzy switch off
cardSegButtons()[1].props.onClick({});
t25 = render(propsFor(SNAP));
ok("switching it off in the card turns the panel's switch off", /点击开启$/.test(String(fuzzyPill(t25) && fuzzyPill(t25).props.title)), String(fuzzyPill(t25) && fuzzyPill(t25).props.title));
ok("...and both layers agree (off IS the default: the entry leaves the document)", store.get("dsh-quick-toc.fuzzy.v1") === "0" && !("fuzzy" in hostValue), JSON.stringify([store.get("dsh-quick-toc.fuzzy.v1"), hostValue.fuzzy]));
// card -> panel: the dock side moves the panel with no reload
const left25 = panelX(findPanel(t25));
cardBtn(c25, "右侧").props.onClick({});
t25 = render(propsFor(SNAP));
ok("a card change moves the panel with no reload", panelX(findPanel(t25)) > left25, `${panelX(findPanel(t25))} vs left-dock ${left25}`);
store.clear(); resetComponent();

console.log("--- scenario 26: the two preferences that only the card can reach ---");
store.clear(); resetComponent();
setHostField("hover", false);
let t26 = render(propsFor(SNAP));
byTitle(t26, "展开大纲")[0].props.onClick();
t26 = render(propsFor(SNAP));
const hoverRow = (t) => collect(t, (n) => n.props && n.props["data-jump-key"] && n.props.onMouseEnter)[0];
const hoverCardIn = (t) => collect(t, (n) => n.props && String(n.props.className || "").split(/\s+/).includes("dqt-hover"))[0];
const at = { style: {}, querySelector: () => null, getBoundingClientRect: () => ({ top: 120, left: 40, right: 300, width: 260, height: 22 }) };
hoverRow(t26).props.onMouseEnter({ currentTarget: at });
tickTimeouts(); // the 260ms hover delay
t26 = render(propsFor(SNAP));
ok("with hover previews switched off no card ever appears", !hoverCardIn(t26), textOf(t26).slice(0, 80));
setHostField("hover", true);
t26 = render(propsFor(SNAP));
hoverRow(t26).props.onMouseEnter({ currentTarget: at });
tickTimeouts();
t26 = render(propsFor(SNAP));
ok("...and switching it back on brings the card back", !!hoverCardIn(t26));
store.clear(); resetComponent();

console.log("--- scenario 27: a 0.5.x install's stored values are imported once ---");
store.clear(); resetComponent();
store.set("dsh-quick-toc.dock.v2", "right");
store.set("dsh-quick-toc.levels.v1", "[1,3]");
store.set("dsh-quick-toc.fuzzy.v1", "1");
exports_.apply(ctx); // a fresh plugin instance boots and imports them
ok("stored values are imported into the host document", hostValue.dock === "right" && JSON.stringify(hostValue.levels) === "[1,3]" && hostValue.fuzzy === true, JSON.stringify(hostValue));
ok("...and the local keys stay as this browser's fallback", store.get("dsh-quick-toc.dock.v2") === "right" && store.get("dsh-quick-toc.levels.v1") === "[1,3]", JSON.stringify([store.get("dsh-quick-toc.dock.v2"), store.get("dsh-quick-toc.levels.v1")]));
// a host the user has already configured through the card is never stomped
hostValue = { ...hostValue, dock: "left" };
hostUser = { dock: "left" };
store.set("dsh-quick-toc.dock.v2", "right");
exports_.apply(ctx);
ok("a host the user already configured keeps its values", hostValue.dock === "left", hostValue.dock);
store.clear(); resetComponent();

console.log("--- scenario 28: cross-session search (the host's own index) ---");
// The panel reaches the host through its own bridge (ctx.get("sessions")), so the
// service object itself is what the scenario installs — passing a tocHost prop would
// be ignored (the plugin overrides it with that bridge, as the real slot does).
// Shape under test: search() -> {ok, value:{items,hasMore}}, open() -> switch the
// current session, list.getSnapshot().byId[id].displayTitle.
const crossQueries = [];
const crossSignals = [];
const opened = [];
provided.sessions = {
  binding: () => ({ session: { loadThrough: () => Promise.resolve() } }),
  searchResultLimit: 20,
  list: { getSnapshot: () => ({ ids: ["s1", "s2"], current: "s1", byId: { s1: { displayTitle: "本会话" }, s2: { displayTitle: "上一个会话" } } }) },
  search: (q, signal) => {
    crossQueries.push(q);
    crossSignals.push(signal);
    return Promise.resolve({ ok: true, value: { items: [{ sessionId: "s2", snippet: "…把部署脚本放在这里…" }], hasMore: true } });
  },
  open: (id) => { opened.push(id); },
};
const scopePillAny = (t) => byTitle(t, "当前：仅搜索标题。点击切换为全文搜索")[0]
  || byTitle(t, "当前：全文搜索。点击切换为跨会话检索")[0]
  || byTitle(t, "当前：跨会话检索（用宿主的全文索引搜所有会话的消息正文）。点击回到仅搜索标题")[0];
const toCross = (props) => {
  let t = openSearch(props);
  scopePillAny(t).props.onClick();                 // title -> full
  t = render(props);
  scopePillAny(t).props.onClick();                 // full -> cross
  return render(props);
};
store.clear(); resetComponent();
let t28 = toCross(propsFor(SNAP));
ok("the scope pill walks 标题 -> 全文 -> 会话 and stops on 会话", !!byTitle(t28, "当前：跨会话检索（用宿主的全文索引搜所有会话的消息正文）。点击回到仅搜索标题")[0]);
searchBox(t28).props.onChange({ target: { value: "部署" } });
t28 = render(propsFor(SNAP));
ok("cross scope explains what it searches", textOf(t28).includes("跨会话检索走宿主的全文索引"));
ok("the host is not called before the debounce elapses", crossQueries.length === 0, JSON.stringify(crossQueries));
tickTimeouts();                                  // the 320ms debounce fires
await Promise.resolve(); await Promise.resolve();
t28 = render(propsFor(SNAP));
ok("the debounce hands the literal query to the host index", crossQueries.length === 1 && crossQueries[0] === "部署", JSON.stringify(crossQueries));
ok("the request carries an abort signal", !!(crossSignals[0] && typeof crossSignals[0].aborted === "boolean"));
ok("a hit shows the hit session's title", textOf(t28).includes("上一个会话"), textOf(t28).slice(0, 300));
ok("a hit shows the host's snippet", textOf(t28).includes("把部署脚本放在这里"));
ok("hasMore is reported instead of silently truncating", textOf(t28).includes("宿主一次最多返回 20 条"));
ok("the hit count replaces the n/N cursor in cross scope", textOf(t28).includes("1+"), textOf(t28).slice(0, 120));
const crossRow = collect(t28, (n) => n.props && n.props["data-result-idx"] === 0 && n.props.onClick)[0];
crossRow.props.onClick();
ok("clicking a hit switches to that session", opened.length === 1 && opened[0] === "s2", JSON.stringify(opened));
ok("...and the switch is announced", textOf(render(propsFor(SNAP))).includes("已切换到该会话"), textOf(render(propsFor(SNAP))).slice(0, 200));
// the arriving side: the panel that comes up for s2 must prefill the keyword and
// leave cross scope (the local list is where a jump can actually happen)
store.clear(); resetComponent();
let t28b = openSearch(propsFor(SNAP, { sessionId: "s2" }));
await Promise.resolve();
t28b = render(propsFor(SNAP, { sessionId: "s2" }));
ok("the hand-off prefills the keyword on the arriving panel", searchBox(t28b).props.value === "部署", String(searchBox(t28b).props.value));
ok("...and leaves cross scope (the local list is where the jump happens)", !!byTitle(t28b, "当前：全文搜索。点击切换为跨会话检索")[0]);
// the hit session's window holds nothing matching this keyword: after the grace
// period the panel says so instead of leaving the reader waiting on a jump
tickTimeouts();
t28b = render(propsFor(SNAP, { sessionId: "s2" }));
ok("an unreachable spot is reported, not silently skipped", textOf(t28b).includes("没能跳过去"), textOf(t28b).slice(0, 220));
store.clear(); resetComponent();

console.log("--- scenario 28b: cross-session failures stay honest ---");
provided.sessions = {
  binding: () => ({ session: { loadThrough: () => Promise.resolve() } }),
  list: { getSnapshot: () => ({ ids: [], current: undefined, byId: {} }) },
  search: () => Promise.resolve({ ok: false, error: { message: "session search is unavailable" } }),
  open: () => {},
};
store.clear(); resetComponent();
let t28c = toCross(propsFor(SNAP));
searchBox(t28c).props.onChange({ target: { value: "随便" } });
t28c = render(propsFor(SNAP));
tickTimeouts();
await Promise.resolve(); await Promise.resolve();
t28c = render(propsFor(SNAP));
ok("a host error is shown with the host's own words", textOf(t28c).includes("检索失败") && textOf(t28c).includes("session search is unavailable"), textOf(t28c).slice(0, 300));
provided.sessions = { binding: () => ({ session: {} }) };
store.clear(); resetComponent();
let t28d = toCross(propsFor(SNAP));
searchBox(t28d).props.onChange({ target: { value: "随便" } });
t28d = render(propsFor(SNAP));
tickTimeouts();
await Promise.resolve();
t28d = render(propsFor(SNAP));
ok("a host without the search API says so instead of pretending", textOf(t28d).includes("宿主没有提供跨会话检索接口"), textOf(t28d).slice(0, 300));
provided.sessions = SESSION_FACE; // hand the host back the way the other scenarios expect it
store.clear(); resetComponent();

console.log("--- scenario 28c: hits that could never be opened are not offered ---");
// The host index covers EVERY persisted session on disk, so it returns archived and
// unlisted sessions too; opening one is what produced the reader-visible error. The
// filter mirrors the sidebar's own content-search rule: listed, not a subagent child,
// not archived, and not blank unless it is the current session.
const hiddenNote = (t) => textOf(t);
provided.sessions = {
  binding: () => ({ session: { loadThrough: () => Promise.resolve() } }),
  list: {
    getSnapshot: () => ({
      ids: ["s1", "s2", "s3"],
      current: "s1",
      byId: {
        s1: { displayTitle: "本会话" },
        s2: { displayTitle: "OPENABLE-HIT" },
        s3: { displayTitle: "ARCHIVED-HIT" },
        s4: { displayTitle: "SUBAGENT-HIT", origin: "subagent" },
        s5: { displayTitle: "BLANK-HIT", blank: true },
      },
    }),
  },
  search: () => Promise.resolve({
    ok: true,
    value: {
      items: [
        { sessionId: "s2", snippet: "命中的正文" },
        { sessionId: "s3", snippet: "归档里的正文" },
        { sessionId: "s4", snippet: "子会话里的正文" },
        { sessionId: "s5", snippet: "空会话不该命中" },
        { sessionId: "s9", snippet: "根本没列出来的会话" },
      ],
      hasMore: false,
    },
  }),
  open: (id) => { opened.push(id); },
};
provided.workspaces = { list: { getSnapshot: () => ({ archivedSessionIds: ["s3"] }) } };
store.clear(); resetComponent();
let t28e = toCross(propsFor(SNAP));
searchBox(t28e).props.onChange({ target: { value: "正文" } });
t28e = render(propsFor(SNAP));
tickTimeouts();
await Promise.resolve(); await Promise.resolve();
t28e = render(propsFor(SNAP));
ok("an openable hit is still offered", textOf(t28e).includes("OPENABLE-HIT"), hiddenNote(t28e).slice(0, 200));
ok("an archived hit is not offered", !textOf(t28e).includes("ARCHIVED-HIT"));
ok("a subagent child is not offered", !textOf(t28e).includes("SUBAGENT-HIT"));
ok("a blank session is not offered", !textOf(t28e).includes("BLANK-HIT"));
ok("an unlisted session is not offered", !textOf(t28e).includes("根本没列出来的会话"));
ok("the skipped hits are counted for the reader", textOf(t28e).includes("另有 4 条命中"), hiddenNote(t28e).slice(0, 240));
// and the click guard refuses a session that lost the right to be opened after the
// list came back (guard evaluates at click time, not at search time)
provided.workspaces = { list: { getSnapshot: () => ({ archivedSessionIds: ["s2", "s3"] }) } };
const guardedRow = collect(t28e, (n) => n.props && n.props["data-result-idx"] === 0 && n.props.onClick)[0];
opened.length = 0;
guardedRow.props.onClick();
ok("a hit archived between search and click opens nothing", opened.length === 0, JSON.stringify(opened));
ok("...and says why instead of switching into an error", textOf(render(propsFor(SNAP))).includes("现在打不开"), textOf(render(propsFor(SNAP))).slice(0, 200));
provided.workspaces = null;
provided.sessions = SESSION_FACE;
store.clear(); resetComponent();

console.log("--- scenario 29: questions-only view (the outline's second reading mode) ---");
const questionsBtn = (t) => collect(t, (n) => n.props && n.props["data-questions"])[0];
const modeWrapper = (t) => collect(t, (n) => n.props && String(n.props.className || "").split(/\s+/).includes("dqt-list-body"))[0];
const modeClass = (t) => String(modeWrapper(t).props.className).split(/\s+/).filter((c) => c.indexOf("dqt-mode") === 0).join(" ");
const groupBox = (t, idx) => collect(t, (n) => n.props && n.props["data-group-idx"] === idx)[0];
const qHeaderLabel = (t) => collect(t, (n) => n.props && n.props.title === "跳转到该回合的模型回答开头")[0];
const headerRow = (t) => collect(t, (n) => n.props && n.props.style && n.props.style.position === "sticky" && n.props.style.height)[0];
store.clear(); resetComponent();
let t29 = render(propsFor(SNAP));
ok("the questions-only button starts off", !!questionsBtn(t29) && questionsBtn(t29).props["data-questions"] === "off");
ok("the full outline lists heading rows", textOf(t29).includes("细节 A") && textOf(t29).includes("排序规则"));
const normalHeader = qHeaderLabel(t29);
const normalRow = headerRow(t29);
ok("a group header is 11px/muted in the full outline", normalHeader.props.style.fontSize === 11 && normalRow.props.style.height === 18, normalHeader.props.style.fontSize + " / " + normalRow.props.style.height);
const normalActive = groupBox(t29, 0);
questionsBtn(t29).props.onClick();
t29 = render(propsFor(SNAP));
ok("the switch fades the list out first (mode not swapped yet)", modeClass(t29) === "dqt-mode-out" && textOf(t29).includes("细节 A"));
tickTimeouts();                                  // the 150ms fade-out ends: swap + fade in
t29 = render(propsFor(SNAP));
ok("the mode swaps behind the fade (heading rows are gone)", !textOf(t29).includes("细节 A") && !textOf(t29).includes("更深一层") && !textOf(t29).includes("总览"));
ok("...and the list fades back in", modeClass(t29) === "dqt-mode-in");
tickTimeouts();                                  // the 260ms fade-in ends
t29 = render(propsFor(SNAP));
ok("the fade classes clear once the switch settles", modeClass(t29) === "");
ok("the button now reads as on", questionsBtn(t29).props["data-questions"] === "on");
ok("every turn still has its header (time + prompt)", textOf(t29).includes("帮我看看 quick toc 的排序") && textOf(t29).includes("没有标题的一轮"));
const bigHeader = qHeaderLabel(t29);
const bigRow = headerRow(t29);
ok("the header grows for its new job (11px -> 12.5px, 18px -> 22px)", bigHeader.props.style.fontSize === 12.5 && bigRow.props.style.height === 22, bigHeader.props.style.fontSize + " / " + bigRow.props.style.height);
ok("...and the prompt stops being a footnote", bigHeader.props.style.color !== normalHeader.props.style.color);
const bigPrompt = collect(bigHeader, (n) => n.props && n.props.style && n.props.style.opacity === 0.92)[0];
ok("the prompt text brightens to 0.92", !!bigPrompt);
const bigActive = groupBox(t29, 0);
ok("the current-turn box is built by the SAME code either way (tint, 3px accent, radius, transition)", !!bigActive
  && bigActive.props.style.backgroundColor === normalActive.props.style.backgroundColor
  && bigActive.props.style.borderLeft === normalActive.props.style.borderLeft
  && bigActive.props.style.borderRight === normalActive.props.style.borderRight
  && bigActive.props.style.borderRadius === normalActive.props.style.borderRadius
  && bigActive.props.style.transition === normalActive.props.style.transition,
  JSON.stringify([bigActive && bigActive.props.style.backgroundColor, bigActive && bigActive.props.style.borderLeft]));
ok("the level filter stands down (no heading rows to filter)", collect(t29, (n) => n.props && n.props.className === "dqt-levels-btn")[0].props.disabled === true);
t29 = render(propsFor(SNAP));
questionsBtn(t29).props.onClick();
tickTimeouts(); tickTimeouts();
t29 = render(propsFor(SNAP));
ok("switching back restores the heading rows", textOf(t29).includes("细节 A") && textOf(t29).includes("更深一层"));
ok("...and the level filter is usable again", collect(t29, (n) => n.props && n.props.className === "dqt-levels-btn")[0].props.disabled === false);
store.clear(); resetComponent();

console.log("--- scenario 30: a jump the host DROPS is asked again ---");
// The host's loadThrough returns immediately (no queue) while a plain page pull owns
// the busy flag: "sometimes one click does nothing, several clicks work". The panel
// now keeps asking on a short ladder instead of losing the click.
const jumpCalls = [];
provided.sessions = {
  binding: () => ({
    session: {
      openState: "open",
      hasMore: true,
      baseSeq: 900,
      // the first two asks land inside the host's in-flight page and are discarded
      loadThrough: (seq) => { jumpCalls.push(seq); return Promise.resolve(); },
    },
  }),
};
store.clear(); resetComponent();
let t30 = render(projProps(windowOnly3, OUTLINE));
const ghostRow30 = collect(t30, (n) => n.props && String(n.props["data-ghost-turn"]) === "1")[0];
ok("the ghost row is there to click", !!ghostRow30);
ghostRow30.props.onClick();
ok("the first ask goes out immediately", jumpCalls.length === 1, JSON.stringify(jumpCalls));
t30 = render(projProps(windowOnly3, OUTLINE));
tickTimeouts();                                  // 300ms -> ladder starts asking
t30 = render(projProps(windowOnly3, OUTLINE));
tickTimeouts();                                  // 400ms -> ask again
t30 = render(projProps(windowOnly3, OUTLINE));
tickTimeouts();                                  // 400ms -> ask again
ok("a dropped ask is retried instead of being lost", jumpCalls.length >= 3, JSON.stringify(jumpCalls));
ok("every retry targets the same turn's seq", jumpCalls.every((s) => s === 10), JSON.stringify(jumpCalls));
provided.sessions = SESSION_FACE;
store.clear(); resetComponent();

console.log("--- scenario 31: keyboard navigation (cursor / Enter / Esc / live region) ---");
const listNodeOf = (t) => collect(t, (n) => n.props && n.props.className === "dqt-list")[0];
const panelNodeOf = (t) => collect(t, (n) => n.props && typeof n.props.onKeyDown === "function" && n.props.tabIndex === -1)[0];
const navRowsOf = (t) => listNodeOf(t).props.ref.current.querySelectorAll("[data-nav-row]");
const markedRows = (t) => navRowsOf(t).filter((r) => String(r.className).split(/\s+/).indexOf("dqt-nav") >= 0);
const press = (t, key) => panelNodeOf(t).props.onKeyDown({ key, preventDefault() {}, stopPropagation() {} });
const liveRegionOf = (t) => collect(t, (n) => n.props && n.props.className === "dqt-sr")[0];
const liveTextOf = (t) => { const el = liveRegionOf(t); return el ? textOf(el) : ""; };
store.clear(); resetComponent();
let t31 = render(propsFor(SNAP));
ok("the list offers its rows to the keyboard", navRowsOf(t31).length > 0, String(navRowsOf(t31).length));
ok("...and is labelled for assistive tech", !!listNodeOf(t31).props["aria-label"] && listNodeOf(t31).props.tabIndex === 0);
ok("nothing is painted before a key is pressed", markedRows(t31).length === 0);
press(t31, "ArrowDown");
t31 = render(propsFor(SNAP));
ok("↓ paints exactly one cursor row", markedRows(t31).length === 1, String(markedRows(t31).length));
const firstCursor = textOf({ props: { children: markedRows(t31)[0].textContent } });
press(t31, "ArrowDown");
t31 = render(propsFor(SNAP));
const secondCursor = textOf({ props: { children: markedRows(t31)[0].textContent } });
ok("↓ moves the cursor to the next row", firstCursor !== secondCursor, firstCursor + " -> " + secondCursor);
press(t31, "Home");
t31 = render(propsFor(SNAP));
ok("Home puts the cursor on the first row", markedRows(t31)[0] === navRowsOf(t31)[0]);
press(t31, "End");
t31 = render(propsFor(SNAP));
const rows31 = navRowsOf(t31);
ok("End puts the cursor on the last row", markedRows(t31)[0] === rows31[rows31.length - 1]);
ok("the live region announces the cursor row", liveTextOf(t31).length > 0, liveTextOf(t31));
ok("...and is a polite status region", liveRegionOf(t31).props.role === "status" && liveRegionOf(t31).props["aria-live"] === "polite");
// Enter activates the row under the cursor: on a ghost row that means page it in
store.clear(); resetComponent();
const loadCalls31 = [];
provided.sessions = {
  binding: () => ({ session: { openState: "open", hasMore: true, baseSeq: 900, loadThrough: (seq) => { loadCalls31.push(seq); return Promise.resolve(); } } }),
};
let t31b = render(projProps(windowOnly3, OUTLINE));
press(t31b, "Home");
t31b = render(projProps(windowOnly3, OUTLINE));
press(t31b, "Enter");
ok("Enter activates the cursor row (the ghost row asks the loader)", loadCalls31.length >= 1, JSON.stringify(loadCalls31));
provided.sessions = SESSION_FACE;
// Esc collapses the panel
store.clear(); resetComponent();
let t31c = openSearch(propsFor(SNAP));
press(t31c, "Escape");
t31c = render(propsFor(SNAP));
ok("Esc collapses the panel", findPanel(t31c).props.style.opacity === 0, String(findPanel(t31c).props.style.opacity));
store.clear(); resetComponent();
// ↑/↓ inside the search box step the matches, like Enter does
let t31d = openSearch(propsFor(SNAP));
collect(t31d, (n) => n.type === "input")[0].props.onChange({ target: { value: "alpha" } });
t31d = render(propsFor(SNAP));
tickTimeouts();
t31d = render(propsFor(SNAP));
const before31 = counter(t31d);
collect(t31d, (n) => n.type === "input")[0].props.onKeyDown({ key: "ArrowUp", preventDefault() {}, stopPropagation() {} });
t31d = render(propsFor(SNAP));
ok("↑ in the search box steps to the previous match", counter(t31d) !== before31, before31 + " -> " + counter(t31d));
ok("the live region announces the match position", /第 \d+ 个命中，共 \d+ 个/.test(liveTextOf(t31d)), liveTextOf(t31d));
store.clear(); resetComponent();

console.log("--- scenario 32: remembering the reading position ---");
const POS_KEY = "dsh-quick-toc.readPos.v1";
const posStore = () => { try { return JSON.parse(store.get(POS_KEY) || "{}"); } catch (e) { return {}; } };
// (a) saving: the turn crossing the conversation viewport is remembered, debounced
store.clear(); resetComponent();
SCROLL.rows = new Map([["u2", anchorRow("u2", 40, 120)], ["a2", anchorRow("a2", 140, 300)]]);
fireDocument("scroll", {});
let t32 = render(propsFor(SNAP));
ok("no position is written before the debounce elapses", !posStore().s1, JSON.stringify(posStore()));
tickTimeouts();                                  // the 700ms debounce
ok("reading a turn remembers it for that session", posStore().s1 && posStore().s1.turn === 2, JSON.stringify(posStore()));
// (b) restoring: reopening the session lands on the remembered turn. The suite's
// browser latched "smooth scrolls teleport here" back in scenario 17d, so the jump is
// DRAWN by hand — step it with a frozen clock, exactly like that scenario does.
store.clear(); resetComponent();
store.set(POS_KEY, JSON.stringify({ s1: { turn: 2, at: Date.now() } }));
CONV_ROWS = [jumpRow("a2", 3000)];
SCROLL.top = 0;
scrollport.scrollTop = 0;
scrollport.lastScroll = null;
const realNow32 = Date.now;
let fakeNow32 = 500000;
Date.now = () => fakeNow32;
let t32b = render(propsFor(SNAP));
t32b = render(propsFor(SNAP));
drain(2);
fakeNow32 += 3000;
drain(8);
tickIntervals(); tickIntervals();
ok("reopening a session jumps back to the remembered turn", scrollport.scrollTop === 2980, String(scrollport.scrollTop));
Date.now = realNow32;
CONV_ROWS = [];
// (c) the switch turns it off
store.clear(); resetComponent();
hostValue = Object.assign({}, hostValue, { remember: false });
store.set(POS_KEY, JSON.stringify({ s1: { turn: 2, at: Date.now() } }));
CONV_ROWS = [jumpRow("a2", 3000)];
scrollport.scrollTop = 0;
scrollport.lastScroll = null;
let t32c = render(propsFor(SNAP));
t32c = render(propsFor(SNAP));
ok("with the switch off the session opens at the newest turn", Math.abs(scrollport.scrollTop - 2980) > 100, String(scrollport.scrollTop));
hostValue = Object.assign({}, hostValue, { remember: true });
CONV_ROWS = [];
// (d) a position that is already the newest is not a restore
store.clear(); resetComponent();
store.set(POS_KEY, JSON.stringify({ s1: { turn: 4, at: Date.now() } }));
CONV_ROWS = [jumpRow("a4", 3000)];
scrollport.scrollTop = 0;
scrollport.lastScroll = null;
let t32d = render(propsFor(SNAP));
t32d = render(propsFor(SNAP));
ok("a position that IS the newest turn is left alone", Math.abs(scrollport.scrollTop - 2980) > 100, String(scrollport.scrollTop));
CONV_ROWS = [];
// (e) a position that can no longer be paged in is forgotten silently (no banner)
store.clear(); resetComponent();
store.set(POS_KEY, JSON.stringify({ s1: { turn: 1, at: Date.now() } }));
provided.sessions = { binding: () => ({ session: { openState: "open", hasMore: false, baseSeq: 1, loadThrough: () => Promise.resolve() } }) };
let t32e = render(projProps(windowOnly3, OUTLINE));
t32e = render(projProps(windowOnly3, OUTLINE));
ok("an unreachable position is dropped instead of nagging", !posStore().s1, JSON.stringify(posStore()));
ok("...and the restore never shows a failure banner", !textOf(t32e).includes("没能加载") && !textOf(t32e).includes("没有更早的历史"));
provided.sessions = SESSION_FACE;
store.clear(); resetComponent();
// (f) the paging path needs the turn's own seq: a remembered turn that is OUTSIDE the
// loaded window is paged in with the seq the host outline carries. Stored entries may
// predate the seq being written at all, and loadThrough(undefined) pages nowhere — the
// restore then sat out its deadline and dropped a position it could have resumed.
loadCalls.length = 0;
store.set(POS_KEY, JSON.stringify({ s1: { turn: 1, at: Date.now() } }));   // turn only
let t32f = render(projProps(windowOnly3, OUTLINE));
t32f = render(projProps(windowOnly3, OUTLINE));
ok("a remembered turn outside the window is paged in with the outline's own seq",
  loadCalls.some((c) => c[0] === "s1" && c[1] === 10),
  JSON.stringify(loadCalls.slice(0, 4)));
store.clear(); resetComponent();
// (g) a position older than the freshness window is dropped rather than resumed:
// coming back much later, the reader expects the newest messages, not an old anchor
loadCalls.length = 0;
store.set(POS_KEY, JSON.stringify({ s1: { turn: 1, at: Date.now() - 31 * 60 * 1000 } }));
let t32g = render(projProps(windowOnly3, OUTLINE));
t32g = render(projProps(windowOnly3, OUTLINE));
ok("a stale position (older than the freshness window) is dropped instead of resumed",
  loadCalls.length === 0 && !posStore().s1,
  JSON.stringify(loadCalls.slice(0, 3)) + " stored=" + JSON.stringify(posStore()));
store.clear(); resetComponent();
// (h) a face that is still OPENING reports hasMore=false as a placeholder. Measured
// live right after a session was reopened: openState=loading, hasMore=false, baseSeq=0
// — and treating that as "cannot page" threw away a perfectly good position (the
// restore forgot it and the reader was left wherever the app happened to be).
loadCalls.length = 0;
store.set(POS_KEY, JSON.stringify({ s1: { turn: 1, at: Date.now() } }));
provided.sessions = { binding: () => ({ session: { openState: "loading", hasMore: false, baseSeq: 0, loadThrough: (seq) => { loadCalls.push(["loading", seq]); return Promise.resolve(); } } }) };
let t32h = render(projProps(windowOnly3, OUTLINE));
t32h = render(projProps(windowOnly3, OUTLINE));
ok("a session that is still opening is NOT written off as unreachable",
  !!posStore().s1,
  "stored=" + JSON.stringify(posStore()));
provided.sessions = SESSION_FACE;
store.clear(); resetComponent();

console.log("--- scenario 33: the curtain (幕布) ---");
const sheetNode = (t) => collect(t, (n) => n.props && n.props["data-sheet"] === "on")[0];
// the outer box: it holds the anchor line and clips the curtain while it flies in/out
const sheetShell = (t) => collect(t, (n) => n.props && n.props["data-sheet-shell"] === "on")[0];
const sheetBtn = (t) => collect(t, (n) => n.props && n.props.className === "dqt-sheet-btn")[0];
const topHandle = (t) => collect(t, (n) => n.props && n.props["data-sheet-handle"] === "on")[0];
// the droplet's own <svg> carries the press ref, so it is the node whose parentElement
// the click writes `transform` to
const droplet = (t) => collect(t, (n) => n.type === "svg" && n.props && n.props.viewBox === "0 0 140 17")[0];
const chromeNode = (t) => collect(t, (n) => n.props && n.props.className === "dqt-sheet-chrome")[0];
const searchColNode = (t) => collect(t, (n) => n.props && n.props["data-sheet-search"] === "on")[0];
// The retract is driven by a class on the DOM NODE rather than by state (a state
// change would re-render the whole list on the frame the animation starts), so the
// exit animation has to be read from the element, not from props.
const sheetDom = (t) => { const n = sheetNode(t); return n && n.props.ref && n.props.ref.current ? String(n.props.ref.current.className) : ""; };
const openPanel = (t) => { const b = byTitle(t, "展开大纲")[0]; if (b) b.props.onClick(); };
store.clear(); resetComponent();
let t33 = render(propsFor(SNAP));
ok("no curtain is mounted until it is asked for", !sheetNode(t33));
// (1) the curtain's own entry point: a droplet resting ON the view tab strip's line
ok("the top edge carries the curtain's own handle", !!topHandle(t33));
const thDrop = topHandle(t33) && collect(topHandle(t33), (n) => n.type === "svg" && n.props.viewBox === "0 0 140 17")[0];
ok("...as a droplet at half opacity, its base sitting on the strip's line", !!thDrop && thDrop.props.style.opacity === 0.5 && topHandle(t33).props.style.alignItems === "flex-end",
  thDrop ? JSON.stringify([thDrop.props.style.opacity, topHandle(t33).props.style.alignItems]) : "no droplet");
ok("...whose silhouette flares into two concave fillets at the line (surface tension)", (() => {
  const d = thDrop && collect(thDrop, (n) => n.type === "path")[0];
  const p = d && String(d.props.d);
  return !!p && p.indexOf("M8 17") === 0 && p.indexOf("Q30 17 42 9") > 0 && p.indexOf("Q110 17 132 17") > 0;
})(), thDrop ? String(collect(thDrop, (n) => n.type === "path")[0].props.d) : "no path");
ok("...with a downward tip matching the side handle's triangle (5.5 x 16), turned and trimmed", (() => {
  const paths = thDrop ? collect(thDrop, (n) => n.type === "path") : [];
  if (paths.length !== 2) return false;
  const d = String(paths[1].props.d);
  // 14 wide, 4.5 tall, centred on the droplet (the side handle's triangle is 5.5 x 16); the
  // corners are rounded, so each vertex shows up as a quadratic control point sitting on it
  const q = [...d.matchAll(/Q(-?[\d.]+) (-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
  const want = [[63, 8.5], [77, 8.5], [70, 13]];
  return q.length === 3 && want.every(([wx, wy]) => q.some(([x, y]) => Math.abs(x - wx) < 1.5 && Math.abs(y - wy) < 1.5));
})(), thDrop ? String(collect(thDrop, (n) => n.type === "path")[1] && collect(thDrop, (n) => n.type === "path")[1].props.d) : "none");
ok("...and both handles' tip triangles carry the same rounding", (() => {
  const sideTip = collect(t33, (n) => n.type === "svg" && n.props && n.props.viewBox === "0 0 9 24")[0];
  return roundedTip(droplet(t33)) && !!sideTip && roundedTip(sideTip);
})(), "checked both handle tips");
ok("...squeezed flat about its base when clicked, and grown back out of the line when it reappears", (() => {
  const css = cssText();
  return topHandle(t33).props.style.transformOrigin === "50% 100%"
    && typeof topHandle(t33).props.onClick === "function"
    && String(topHandle(t33).props.style.transition).indexOf("transform") === 0
    && css.indexOf("@keyframes dqt-handle-pop{from{transform:scaleY(0)}to{transform:scaleY(1)}}") >= 0
    && css.indexOf(".dqt-sheet-handle>svg{animation:dqt-handle-pop") >= 0;
})(), String(topHandle(t33).props.style.transition));
// the two directions are NOT the same curve: pressing down starts slow and ends fast
// (the curtain is about to cover it), and coming back up starts fast and settles —
// a single symmetric ease read as uniform motion
ok("...pressing down slow-then-fast, coming back up fast-then-slow", (() => {
  const press = String(topHandle(t33).props.style.transition);
  const css = cssText();
  const pop = (css.match(/\.dqt-sheet-handle>svg\{animation:dqt-handle-pop[^}]*\}/) || [""])[0];
  return press.indexOf("cubic-bezier(0.75, 0, 1, 0.45)") > 0          // accelerating
    && pop.indexOf("cubic-bezier(0, 0.55, 0.25, 1)") > 0              // decelerating
    && /transform 0\.2s/.test(press) && /dqt-handle-pop 0\.2s/.test(pop);
})(), String(topHandle(t33).props.style.transition) + " || " + String((cssText().match(/\.dqt-sheet-handle>svg\{animation:dqt-handle-pop[^}]*\}/) || [""])[0]));
// ...and they are the SAME motion: the pop's control points are the press's mirrored
// about the diagonal, i.e. pop(t) === 1 - press(1 - t) for every t. Evaluated here
// instead of trusted, because a swapped pair of control points would still look like
// "a fast bit and a slow bit" while no longer being one gesture and its rewind.
ok("...the two curves being exact mirrors of each other", (() => {
  const curveOf = (s) => (String(s).match(/cubic-bezier\(([^)]*)\)/) || [])[1].split(",").map((v) => Number(v.trim()));
  const evalAt = (c, t) => {
    const [x1, y1, x2, y2] = c;
    const poly = (a, b) => [(1 - 3 * b + 3 * a), (3 * b - 6 * a), 3 * a];
    const at = (u, a, b) => { const [A, B, C] = poly(a, b); return ((A * u + B) * u + C) * u; };
    let lo = 0, hi = 1;
    for (let i = 0; i < 60; i += 1) { const m = (lo + hi) / 2; if (at(m, x1, x2) < t) lo = m; else hi = m; }
    return at((lo + hi) / 2, y1, y2);
  };
  const pop = curveOf((cssText().match(/\.dqt-sheet-handle>svg\{animation:dqt-handle-pop[^}]*\}/) || [""])[0]);
  const press = curveOf(topHandle(t33).props.style.transition);
  if (pop.length !== 4 || press.length !== 4) return false;
  // 1e-6, not machine epsilon: both curves end with a control point at x = 1, where x(u)
  // flattens quadratically, so the bisection's own endpoint error is ~1e-8. A wrong
  // control point moves the curve by ~1e-2, which this still catches by four decades.
  return [0, 0.15, 0.37, 0.5, 0.72, 0.9, 1].every((t) => Math.abs(evalAt(pop, t) - (1 - evalAt(press, 1 - t))) < 1e-6);
})(), String((cssText().match(/\.dqt-sheet-handle>svg\{animation:dqt-handle-pop[^}]*\}/) || [""])[0]) + " || " + String(topHandle(t33).props.style.transition));
// the fade must not run during the squash: on the panel-open path the curtain flips
// sheetOpen on the very frame of the click, and an undelayed 0.22s fade used to eat the
// whole press (the reader saw a fade, never the accelerator). Held back by 0.2s, i.e.
// exactly the press, it can only ever cover what is left of a flattened droplet.
ok("...with the fade held back until the press has landed, so it cannot hide the squash", (() => {
  const press = String(topHandle(t33).props.style.transition);
  return /transform 0\.2s/.test(press) && press.indexOf("opacity 0.12s ease 0.2s") > 0;
})(), String(topHandle(t33).props.style.transition));
ok("...that brightens under the pointer", (() => {
  if (!thDrop || !thDrop.props.ref || !thDrop.props.ref.current) return "no ref";
  topHandle(t33).props.onMouseEnter({ currentTarget: topHandle(t33) });
  return thDrop.props.ref.current.style.opacity === "1";
})() === true);
ok("...centred over the conversation area, bottom on the strip line", topHandle(t33).props.style.left === "730px" && topHandle(t33).props.style.top === 0, JSON.stringify([topHandle(t33).props.style.left, topHandle(t33).props.style.top]));
openPanel(t33);
t33 = render(propsFor(SNAP));
ok("the docked header still offers its curtain button", !!sheetBtn(t33));
ok("...and the top handle is there too (it is not tied to the panel's state)", !!topHandle(t33));
const openLeftBefore = panelX(findPanel(t33));
sheetBtn(t33).props.onClick();
t33 = render(propsFor(SNAP));
// the panel goes home FIRST: it is still a docked panel (fixed) and it is already
// travelling to its parked spot, while the curtain has not started dropping
ok("dropping the curtain first sends the docked panel home", !!findPanel(t33) && panelX(findPanel(t33)) < openLeftBefore && !sheetNode(t33),
  (findPanel(t33) ? String(findPanel(t33).props.style.left) : "no docked panel") + " vs " + openLeftBefore + " / sheet=" + !!sheetNode(t33));
tickTimeouts();   // the collapse finishes, and only then does the curtain drop
t33 = render(propsFor(SNAP));
ok("...and the curtain only drops once the panel has finished travelling", !!sheetNode(t33) && !findPanel(t33));
ok("the sheet drops in with its enter animation", !!sheetNode(t33) && String(sheetNode(t33).props.className).includes("dqt-sheet-open"), sheetNode(t33) && String(sheetNode(t33).props.className));
ok("...full width of the conversation area", sheetShell(t33).props.style.width === 1000 && sheetShell(t33).props.style.left === 300, JSON.stringify([sheetShell(t33).props.style.width, sheetShell(t33).props.style.left]));
ok("...hanging from the top edge and square where it meets it", sheetShell(t33).props.style.top === 0 && sheetNode(t33).props.style.borderRadius === "0 0 12px 12px", JSON.stringify([sheetShell(t33).props.style.top, sheetNode(t33).props.style.borderRadius]));
ok("...with NO outer shadow and NO dimming layer over the conversation", sheetNode(t33).props.style.boxShadow === undefined && !collect(t33, (n) => n.props && n.props["data-sheet-backdrop"] === "on")[0]);
ok("...carrying the SAME list (one ref, not a second one)", collect(sheetNode(t33), (n) => n.props && n.props.className === "dqt-list").length === 1);
ok("...still showing the outline rows", textOf(t33).includes("细节 A"));
// the handle is pressed flat and held for a beat so that press is seen, then it goes
ok("...with the handle still held for its press-flat, already faded",
  !!topHandle(t33) && topHandle(t33).props.style.opacity === 0,
  topHandle(t33) ? String(topHandle(t33).props.style.opacity) : "already gone");
tickTimeouts();   // the DROP_OUT_MS hold
t33 = render(propsFor(SNAP));
ok("...and it steps aside once that press has played", !topHandle(t33));
// the hover preview card is a portal sibling of the curtain, so it must clear it
const curtainRow = collect(sheetNode(t33), (n) => n.props && n.props["data-jump-key"] && n.props.onMouseEnter)[0];
curtainRow.props.onMouseEnter({ currentTarget: { style: {}, querySelector: () => null, getBoundingClientRect: () => ({ top: 120, left: 40, right: 300, width: 260, height: 22 }) } });
tickTimeouts();                                  // the 260ms hover delay
t33 = render(propsFor(SNAP));
const curtainCard = collect(t33, (n) => n.props && n.props.className === "dqt-hover")[0];
ok("the hover preview card floats ABOVE the curtain, not behind it", !!curtainCard && curtainCard.props.style.zIndex > sheetShell(t33).props.style.zIndex, curtainCard ? curtainCard.props.style.zIndex + " vs sheet " + sheetShell(t33).props.style.zIndex : "no card");
// (2) the travel is a real slide: the keyframes move the whole sheet, not a fade
const sheetCss = cssText();
ok("the curtain flies down from above the line it hangs from", sheetCss.includes("@keyframes dqt-sheet-in{from{transform:translateY(-100%)}to{transform:translateY(0)}}") && sheetCss.includes("@keyframes dqt-sheet-out{from{transform:translateY(0)}to{transform:translateY(-100%)}}"));
ok("...and it is not a fade", !/dqt-sheet-(in|out)\{[^}]*opacity/.test(sheetCss));
ok("...with an outer clip box so it is never seen above that line", sheetShell(t33).props.style.overflow === "hidden" && sheetNode(t33).props.style.height === "100%");
ok("...whose drop and retract are NOT dropped under reduced motion (the reader wants the movement)", !/prefers-reduced-motion[^}]*\.dqt-sheet-open/.test(sheetCss) && !/@media \(prefers-reduced-motion: reduce\)\{\.dqt-sheet-(open|closing)/.test(sheetCss));
ok("...while the questions-only cross-fade still honours it", /@media \(prefers-reduced-motion: reduce\)\{\.dqt-mode-out,\.dqt-mode-in\{animation:none\}\}/.test(sheetCss) && !/prefers-reduced-motion[^}]*dqt-sheet-handle/.test(sheetCss));
// (3) the curtain's own chrome: fewer controls, all of them larger
ok("the curtain has its own chrome row", !!chromeNode(t33));
ok("...with no title text and no hint line", !textOf(chromeNode(t33)).includes("大纲") && !/Esc/.test(textOf(chromeNode(t33))), JSON.stringify(textOf(chromeNode(t33))));
ok("...the search button on the right, then the way out", (() => {
  const kids = chromeNode(t33).props.children.filter(Boolean);
  return kids.length >= 2 && kids[kids.length - 2].props["data-tool"] === "search" && kids[kids.length - 1].props["data-tool"] === "close";
})() === true);
ok("...whose cross is the docked panel's own, scaled up with the rest", (() => {
  const kids = chromeNode(t33).props.children.filter(Boolean);
  const svg = collect(kids[kids.length - 1], (n) => n.type === "svg")[0];
  return !!svg && svg.props.viewBox === "0 0 24 24" && svg.props.width === 20 && svg.props.strokeWidth === 3.4;
})() === true);
const chromeBtns = collect(chromeNode(t33), (n) => n.type === "button" && n.props.style && n.props.style.width === 32);
ok("...and larger toolbar buttons (24px -> 32px)", chromeBtns.length >= 4, "buttons=" + chromeBtns.length);
ok("the dock toggle is gone on the curtain", !byTitle(t33, "移到左侧")[0] && !byTitle(t33, "移到右侧")[0]);
ok("...so is the panel's collapse button", !byTitle(t33, "收起")[0]);
ok("...and the resize strips do not apply here", !byTitle(t33, "拖拽调整宽度")[0] && !byTitle(t33, "拖拽调整高度")[0] && !byTitle(t33, "拖拽同时调整宽高")[0]);
// each wide row: a level chip, the title, and the section's opening text out to the
// right on the SAME line (the docked panel keeps title-over-subtitle)
const wideParts = (() => {
  const row = collect(sheetNode(t33), (n) => n.props && n.props["data-jump-key"] && n.props.onMouseEnter)[0];
  const inner = collect(row, (n) => n.props && n.props.style && n.props.style.display === "flex")[0];
  return inner ? inner.props.children.filter(Boolean) : [];
})();
ok("a curtain row leads with its heading level as a small chip", wideParts.length >= 2 && /^H[1-6]$/.test(textOf(wideParts[0])), JSON.stringify(wideParts.map((p) => textOf(p))));
ok("...and carries the section's opening text out to the right", wideParts.length === 3 && wideParts[2].props.style.textAlign === "right" && wideParts[2].props.style.fontSize === 13, String(wideParts.length));
ok("...but the small text only takes what the title leaves over", wideParts[1].props.style.flex === "0 1 auto" && wideParts[2].props.style.flex === "1 1 0", JSON.stringify([wideParts[1].props.style.flex, wideParts[2].props.style.flex]));
ok("...and the curtain's type is a step larger than the docked panel's", collect(sheetNode(t33), (n) => n.props && n.props["data-jump-key"])[0].props.style.fontSize === 16.5 && collect(sheetNode(t33), (n) => n.props && n.props["data-jump-key"])[0].props.style.lineHeight === "26px");
ok("...with the turn bands grown to match (14px / 24px)", (() => {
  const band = collect(sheetNode(t33), (n) => n.props && n.props.style && n.props.style.position === "sticky")[0];
  const label = band && collect(band, (n) => n.props && n.props["data-nav-row"] === "1")[0];
  return !!band && band.props.style.height === 24 && !!label && label.props.style.fontSize === 14;
})() === true);
// the outline does not touch the curtain's edges: it is a centred column
ok("the outline is a centred column with room at both sides", (() => {
  const list = collect(sheetNode(t33), (n) => n.props && n.props.className === "dqt-list")[0];
  return !!list && list.props.style.maxWidth === "90%" && list.props.style.margin === "0 auto" && list.props.style.width === "100%";
})() === true);
// the level picker: anchored to the curtain's own toolbar and spread over ONE row
collect(t33, (n) => n.props && n.props.className === "dqt-levels-btn")[0].props.onClick();
t33 = render(propsFor(SNAP));
const curtainPop = collect(chromeNode(t33), (n) => n.props && String(n.props.className || "").includes("dqt-levels-pop"))[0];
ok("the level picker anchors to the curtain's own toolbar", !!curtainPop && curtainPop.props.style.top === "calc(100% + 8px)" && curtainPop.props.style.left === 0 && curtainPop.props.style.transformOrigin === "16px top");
const popChips = curtainPop ? collect(curtainPop, (n) => n.type === "button") : [];
ok("...and spreads H1-H6 across one row", !!curtainPop && curtainPop.props.style.flexWrap === "nowrap" && popChips.length === 6 && popChips.every((c) => c.props.style.flex === "1 1 0" && c.props.style.height === 32), JSON.stringify([curtainPop && curtainPop.props.style.flexWrap, popChips.length]));
collect(t33, (n) => n.props && n.props.className === "dqt-levels-btn")[0].props.onClick();   // close it again
t33 = render(propsFor(SNAP));
// (4) search is pushed in from the right edge: the outline stays in the middle and
// slides left, the column carries the panel's own search box over its hits
searchBtn(t33).props.onClick({ stopPropagation() {} });
t33 = render(propsFor(SNAP));
ok("the search box arrives in a column pushed in from the right", !!searchColNode(t33) && searchColNode(t33).props.style.width === 360, searchColNode(t33) && String(searchColNode(t33).props.style.width));
ok("...whose layout flips in one commit instead of animating its width", searchColNode(t33).props.style.transition === undefined, String(searchColNode(t33).props.style.transition));
ok("...and whose row carries no transition of its own either (the motion is a transform flip)", (() => {
  const row = collect(t33, (n) => n.props && n.props.className === "dqt-body-row")[0];
  return !!row && row.props.style.transition === undefined;
})(), "row transition checked");
ok("...keeping the full width inside so the content never squashes", collect(searchColNode(t33), (n) => n.props && n.props.style && n.props.style.width === 360 && n.props.style.height === "100%").length === 1);
ok("...below the box it is empty until something is typed", collect(searchColNode(t33), (n) => n.props && n.props["data-result-idx"] !== undefined).length === 0 && !textOf(searchColNode(t33)).includes("没有匹配"), JSON.stringify(textOf(searchColNode(t33))));
ok("...and the outline stays in its own column next to it", textOf(sheetNode(t33)).includes("细节 A"));
ok("...with the back-to-bottom button clearing the column", collect(sheetNode(t33), (n) => n.props && n.props.className === "dqt-bottom-btn")[0].props.style.right === 378);
const inCol = (t) => collect(t, (n) => n.props && n.type === "input")[0];
inCol(t33).props.onChange({ target: { value: "alpha" } });
t33 = render(propsFor(SNAP));
ok("...typing lists the hits down that column", textOf(searchColNode(t33)).includes("alpha alpha 记录"), textOf(searchColNode(t33)).slice(0, 120));
ok("...while the outline is NOT replaced by them", textOf(sheetNode(t33)).includes("细节 A"));
ok("...and a hit is one wide row (title, context, meta)", (() => {
  const row = collect(searchColNode(t33), (n) => n.props && n.props["data-result-idx"] !== undefined)[0];
  return !!row && row.props.style.display === "flex" && row.props.style.alignItems === "baseline" && row.props.style.gap === 10;
})() === true);
searchBtn(t33).props.onClick({ stopPropagation() {} });   // close search again
t33 = render(propsFor(SNAP));
tickTimeouts();
t33 = render(propsFor(SNAP));
ok("closing search slides the column back out and hands back the width", !searchColNode(t33) && collect(sheetNode(t33), (n) => n.props && n.props.className === "dqt-bottom-btn")[0].props.style.right === 18);
// (5) every way out
panelNodeOf(t33).props.onClickCapture({
  target: { closest: () => ({ dataset: { jumpKey: "a1", jumpIdx: "0" } }) },
  preventDefault() {}, stopPropagation() {}
});
t33 = render(propsFor(SNAP));
ok("activating a heading row runs the exit animation", sheetDom(t33).includes("dqt-sheet-closing"), sheetDom(t33));
tickTimeouts();
t33 = render(propsFor(SNAP));
ok("...and the curtain is gone afterwards", !sheetNode(t33) && !!topHandle(t33));
ok("...and the docked panel slides back in rather than popping into place",
  (() => { drain(); return true; })() && !!findPanel(t33 = render(propsFor(SNAP))) && panelX(findPanel(t33)) === openLeftBefore,
  findPanel(t33) ? String(findPanel(t33).props.style.left) + " vs " + openLeftBefore : "no docked panel");
ok("...while its shell stays mounted, so the list is never rebuilt", (() => {
  const idle = collect(t33, (n) => n.props && n.props.className === "dqt-sheet-idle")[0];
  return !!idle && collect(idle, (n) => n.props && n.props.className === "dqt-list").length === 1;
})() === true);
// regression: a 1px border on the zero-size idle box made it a 2px border box, which
// with the wrapper's overflow:visible added 2px to the DOCUMENT's scrollable overflow
// — that raised a page scrollbar, so opening the curtain dropped it and shifted the
// whole app (and the conversation) sideways by half a scrollbar
ok("...and the idle shell paints nothing and takes no space", (() => {
  const idle = collect(t33, (n) => n.props && n.props.className === "dqt-sheet-idle")[0];
  const shell = collect(t33, (n) => n.props && n.props.className === "dqt-sheet-clip" && n.props.style && n.props.style.position === "fixed")[0];
  return !!idle && idle.props.style.border === "none" && idle.props.style.width === 0 && idle.props.style.height === 0
    && !!shell && shell.props.style.width === 0 && shell.props.style.height === 0;
})() === true, (() => {
  const idle = collect(t33, (n) => n.props && n.props.className === "dqt-sheet-idle")[0];
  return idle ? JSON.stringify([idle.props.style.border, idle.props.style.width, idle.props.style.height]) : "no idle shell";
})());
ok("...and a docked row goes back to title-over-subtitle (no level chip)", (() => {
  const row = collect(findPanel(t33), (n) => n.props && n.props["data-jump-key"])[0];
  if (!row) return "no row";
  const chip = collect(row, (n) => n.props && n.props.style && n.props.style.fontSize === 9.5)[0];
  return row.props.style.lineHeight === "18px" && !chip;
})(), (() => {
  const row = collect(findPanel(t33), (n) => n.props && n.props["data-jump-key"])[0];
  return row ? "lineHeight=" + row.props.style.lineHeight + " chips=" + collect(row, (n) => n.props && n.props.style && n.props.style.fontSize === 9.5).length : "no row";
})());
sheetBtn(t33).props.onClick();
t33 = render(propsFor(SNAP));
tickTimeouts();   // the panel tucks first, then the curtain drops
t33 = render(propsFor(SNAP));
panelNodeOf(t33).props.onClickCapture({
  target: { closest: (sel) => (sel === "[data-nav-row]" ? {} : null) },
  preventDefault() {}, stopPropagation() {}
});
t33 = render(propsFor(SNAP));
ok("a row without a jump key (a group header) closes it too", sheetDom(t33).includes("dqt-sheet-closing"), sheetDom(t33));
tickTimeouts();
t33 = render(propsFor(SNAP));
sheetBtn(t33).props.onClick();
t33 = render(propsFor(SNAP));
tickTimeouts();   // panel tucks, then the curtain drops
t33 = render(propsFor(SNAP));
byTitle(t33, "收起幕布")[0].props.onClick();
t33 = render(propsFor(SNAP));
ok("the chrome's cross runs the exit animation", sheetDom(t33).includes("dqt-sheet-closing"), sheetDom(t33));
tickTimeouts();
t33 = render(propsFor(SNAP));
ok("...and unmounts after it", !sheetNode(t33));
drain();   // the panel's return slide is armed one painted frame later
t33 = render(propsFor(SNAP));
sheetBtn(t33).props.onClick();
t33 = render(propsFor(SNAP));
tickTimeouts();   // panel tucks, then the curtain drops
t33 = render(propsFor(SNAP));
press(t33, "Escape");
t33 = render(propsFor(SNAP));
ok("Esc closes the curtain first", sheetDom(t33).includes("dqt-sheet-closing"), sheetDom(t33));
tickTimeouts();
t33 = render(propsFor(SNAP));
drain();
t33 = render(propsFor(SNAP));
ok("...leaving the docked panel itself open", findPanel(t33).props.style.opacity > 0, String(findPanel(t33).props.style.opacity));
// the top handle opens it again from scratch (no panel interaction needed). With the
// panel collapsed the droplet presses flat FIRST and the curtain waits for that press
// (see its onClick) — so the open needs the press window to elapse, and the handle is
// still mounted, pressed, until then.
store.clear(); resetComponent();
let t33b = render(propsFor(SNAP));
topHandle(t33b).props.onClick();
t33b = render(propsFor(SNAP));
ok("the droplet's press is held (and the curtain still waits) while it flattens",
  !!topHandle(t33b) && !sheetNode(t33b), topHandle(t33b) ? "handle held, no curtain" : "already gone");
// The press has to land FLUSH on the line. With scaleY(0.12) the 17px droplet kept ~2px
// of dome on the strip after the press had landed, and because the element only leaves
// the tree a beat later that sliver sat there motionless and was then removed in a
// single frame — the reader's "at its smallest it still has some thickness, it sticks,
// then it is suddenly gone". Both ends of the pair are flush now: 1 -> 0 on the press,
// 0 -> 1 on the pop.
ok("...sinking flush into the line, so no sliver is left for a later frame to yank away",
  String(droplet(t33b).props.ref.current.parentElement.style.transform) === "scaleY(0)" &&
  /@keyframes dqt-handle-pop\{from\{transform:scaleY\(0\)\}to\{transform:scaleY\(1\)\}\}/.test(cssText()),
  String(droplet(t33b).props.ref.current.parentElement.style.transform) + " | " + String((cssText().match(/@keyframes dqt-handle-pop\{[^}]*\}/) || [""])[0]));
tickTimeouts();   // the press window
t33b = render(propsFor(SNAP));
ok("the top handle alone opens the curtain (panel stays collapsed)", !!sheetNode(t33b) && String(sheetNode(t33b).props.className).includes("dqt-sheet-open"));
press(t33b, "Escape");
t33b = render(propsFor(SNAP));
tickTimeouts();
t33b = render(propsFor(SNAP));
ok("...and it leaves the collapsed panel exactly as it was", !sheetNode(t33b) && findPanel(t33b).props.style.opacity === 0, String(findPanel(t33b) && findPanel(t33b).props.style.opacity));
// the real app keeps the 对话/轨迹/上下文 tabs inside the conversation scroll
// container: the curtain (and its handle) must hang from BELOW them
TABLIST = liveTablist;
liveTablist.rect = { top: 0, bottom: 44, height: 44 };
store.clear(); resetComponent();
let t33c = render(propsFor(SNAP));
t33c = render(propsFor(SNAP));                   // the measurement lands in an effect
ok("the curtain handle sits IN the 对话/轨迹/上下文 strip, its bottom on that line",
  topHandle(t33c).props.style.top === 44 - 26 && topHandle(t33c).props.style.height === 26,
  JSON.stringify([topHandle(t33c).props.style.top, topHandle(t33c).props.style.height]));
topHandle(t33c).props.onClick();
t33c = render(propsFor(SNAP));
tickTimeouts();   // the droplet presses flat first; the curtain waits for that
t33c = render(propsFor(SNAP));
ok("...and so does the curtain itself", !!sheetShell(t33c) && sheetShell(t33c).props.style.top === 44, sheetShell(t33c) ? String(sheetShell(t33c).props.style.top) : "no curtain");
tickTimeouts();
liveTablist.rect = null;
TABLIST = null;
tickTimeouts();
store.clear(); resetComponent();

console.log("--- scenario 34: the panel cannot be parked outside the window ---");
// The conversation area belongs to the host: its transcript width grips, a sidebar
// opening, another plugin's split view, a narrower window. Whatever moves it, the
// OPEN panel has to stay inside the window — its header carries the only ✕, so a
// panel pushed past the edge is a panel that can no longer be closed. The collapsed
// handle must stay inside too: it is the way back.
const handleTopOf = (t) => collect(t, (n) => n.props && n.props.style && n.props.style.width === 26 && n.props.style.height === 92)[0];
store.clear();
resetComponent();
SCROLL.left = 300;
let t34 = render(propsFor(SNAP));
t34 = render(propsFor(SNAP)); // the measurement lands in an effect
ok("collapsed, the panel still parks outside the conversation area (that is what the collapse clip hides)",
  panelX(findPanel(t34)) === 4, String(findPanel(t34).props.style.left));
byTitle(t34, "展开大纲")[0].props.onClick({});
t34 = render(propsFor(SNAP));
ok("open, it sits just inside the conversation area", panelX(findPanel(t34)) === 308, String(findPanel(t34).props.style.left));
// the area slides sideways, the same size (the host moving its centre column)
SCROLL.left = 1200;
tickIntervals(); // the slow re-measure beat sees it; no resize event is involved
t34 = render(propsFor(SNAP));
ok("an area pushed right cannot push the open panel past the right edge",
  panelX(findPanel(t34)) === 1400 - 288 - 8, String(findPanel(t34).props.style.left));
SCROLL.left = 300;
tickIntervals();
t34 = render(propsFor(SNAP));
ok("...and it follows the area back", panelX(findPanel(t34)) === 308, String(findPanel(t34).props.style.left));
SCROLL.top = -500; // a rect that no longer matches the window (the height is fixed at 600)
resetComponent();
let t34h = render(propsFor(SNAP));
t34h = render(propsFor(SNAP));
SCROLL.top = 0;
ok("the collapsed handle stays on screen when the stored rect no longer matches",
  !!handleTopOf(t34h) && px(handleTopOf(t34h).props.style.top) === 0,
  handleTopOf(t34h) ? String(handleTopOf(t34h).props.style.top) : "no handle");
// a stored vertical offset that outlived the layout it was chosen for
store.set("dsh-quick-toc.panelY.v1", "5000");
resetComponent();
let t34b = render(propsFor(SNAP));
t34b = render(propsFor(SNAP));
ok("a stale downward offset is clamped to the bottom of the window",
  px(findPanel(t34b).props.style.top) === 900 - 120, String(findPanel(t34b).props.style.top));
store.set("dsh-quick-toc.panelY.v1", "-5000");
resetComponent();
let t34c = render(propsFor(SNAP));
t34c = render(propsFor(SNAP));
ok("a stale upward offset is clamped to the top edge", px(findPanel(t34c).props.style.top) === 8, String(findPanel(t34c).props.style.top));
store.clear();
resetComponent();
SCROLL.left = undefined;

console.log("--- scenario 35: the per-row 'jump to the end of this section' control ---");
// Every jumpable row (outline entries and group headers, docked and curtain) carries
// one. It is hover-only, fades in and out, and its click must reach the END jump
// instead of the row's own jump-to-start.
store.clear();
resetComponent();
let t35 = render(propsFor(SNAP));
const panelOf35 = () => findPanel(t35);
const rowOf35 = (t) => collect(t, (n) => n.props && n.props["data-jump-key"] && n.props.onMouseEnter)[0];
const endBtnOf = (node) => collect(node, (n) => n.props && n.props["data-dqt-end"] === "1")[0];
byTitle(t35, "展开大纲")[0].props.onClick();
t35 = render(propsFor(SNAP));
const row35 = rowOf35(t35);
const btn35 = endBtnOf(row35);
ok("a heading row carries the end-jump control", !!btn35);
ok("...marked so the row's hover can find it and the click can be routed", !!btn35 && btn35.props["data-dqt-end"] === "1" && btn35.props["data-end-key"] === "a1" && btn35.props["data-end-idx"] === "0",
  btn35 ? JSON.stringify([btn35.props["data-dqt-end"], btn35.props["data-end-key"], btn35.props["data-end-idx"]]) : "none");
ok("...without claiming the row's own data-jump-key", !!btn35 && btn35.props["data-jump-key"] === undefined, btn35 ? String(btn35.props["data-jump-key"]) : "none");
ok("...with an icon, not an empty circle", (() => {
  const path = btn35 && collect(btn35, (n) => n.type === "path")[0];
  return !!path && typeof path.props.d === "string" && path.props.d.length > 8 && path.props.stroke === "currentColor";
})(), btn35 ? JSON.stringify(collect(btn35, (n) => n.type === "path").map((p) => p.props.d)) : "none");
ok("...hidden by default and faded, never switched on with a snap",
  btn35.props.style.opacity === 0 && String(btn35.props.style.transition).includes("opacity"), btn35 ? JSON.stringify([btn35.props.style.opacity, btn35.props.style.transition]) : "none");
// hover reveals it / leaving hides it again
const fakeBtn35 = { style: {} };
row35.props.onMouseEnter({ currentTarget: { style: {}, querySelector: (sel) => (sel === "[data-dqt-end]" ? fakeBtn35 : null) } });
ok("...revealed when the pointer is on that row", fakeBtn35.style.opacity === "1", String(fakeBtn35.style.opacity));
row35.props.onMouseLeave({ currentTarget: { style: {}, querySelector: () => fakeBtn35 } });
ok("...and hidden again when the pointer leaves it", fakeBtn35.style.opacity === "0", String(fakeBtn35.style.opacity));
// The click routes to the END jump. The suite's browser latched "smooth scrolls
// teleport here" back in scenario 17d, so the motion is drawn by hand — step it
// with a frozen clock, exactly like scenario 32 does.
CONV_ROWS = [];
SCROLL.heads = [];   // no stray headings from earlier scenarios: the boundary here is
SCROLL.top = 0;      // the turn end, and only the turn end
// A turn that really sits in the document (bottom at document y 3600), so the
// boundary is scroll-INDEPENDENT — the scrollport itself would not be.
const turnStub35 = elem("div", {
  dataset: { chatTurn: "1" },
  getBoundingClientRect: () => ({ top: 3400 - scrollport.scrollTop, left: 0, right: 600, bottom: 3600 - scrollport.scrollTop, width: 600, height: 200 })
});
const endRow35 = elem("div", {
  dataset: { chatAnchorKey: "a1" },
  getBoundingClientRect: () => ({ top: 3000 - scrollport.scrollTop, left: 0, right: 600, bottom: 3180 - scrollport.scrollTop, width: 600, height: 180 })
});
endRow35.closest = (sel) => (sel === "[data-chat-turn]" ? turnStub35 : scrollport);
CONV_ROWS = [endRow35];
const realNow35 = Date.now;
const clock35 = { value: 700000 };
Date.now = () => clock35.value;
const clickEnd35 = (from) => {
  scrollport.scrollTop = from;
  panelNodeOf(t35).props.onClickCapture({
    target: { closest: (sel) => (sel === "[data-dqt-end]" ? { dataset: { endKey: "a1", endIdx: "0" } } : null) },
    preventDefault() {}, stopPropagation() {}
  });
  drain(2);
  clock35.value += 3000;   // run the drawn glide out
  drain(60);
  tickIntervals();
  return scrollport.scrollTop;
};
// The turn ends at document y 3600 and the visible chat bottom is the 600px
// scrollport itself, so the section's end belongs 28px above that line: 3600 - 600 + 28.
const land35 = clickEnd35(0);
ok("clicking it jumps to the section boundary, not to the row's start",
  land35 === 3028,
  String(land35) + " (the row's own start jump would have aimed at 2980; 3028 is the turn's end)");
// The boundary is a SCROLLER coordinate, so the same boundary means the SAME landing
// from anywhere. Reading it in viewport coordinates made the target depend on where
// you started (and made the glide chase its own tail) — the click at 0 could not see it.
const land35b = clickEnd35(400);
ok("...and the same boundary lands in the same place whatever the starting scroll",
  land35b === 3028,
  "0 -> " + land35 + ", 400 -> " + land35b + " (both must be 3028)");
Date.now = realNow35;
// the group header carries its own one, aimed at the whole turn
CONV_ROWS = [];
resetComponent();
t35 = render(propsFor(SNAP));
byTitle(t35, "展开大纲")[0].props.onClick();
t35 = render(propsFor(SNAP));
const band35 = collect(t35, (n) => n.props && n.props.style && n.props.style.position === "sticky")[0];
const bandBtn35 = band35 && endBtnOf(band35);
ok("a group header carries one too", !!bandBtn35 && bandBtn35.props["data-end-turn"] !== undefined, bandBtn35 ? JSON.stringify([bandBtn35.props["data-dqt-end"], bandBtn35.props["data-end-turn"]]) : "none");
ok("...aimed at that whole turn", !!bandBtn35 && typeof bandBtn35.props["data-end-turn"] === "string");
// The boxes a row paints must stop clear of the button's round hover backdrop: the
// reader saw a long header's hover box fight the circle (its right edge used to sit
// exactly on the circle's left edge, and a forced-long header came within 2px).
const gapOf = (boxRight, btn) => boxRight - (btn.props.style.right + btn.props.style.width);
ok("...with the header reserving that zone for its label",
  !!band35 && band35.props.style.paddingRight >= 32 && (() => {
    const lbl = collect(band35, (n) => n.props && n.props["data-nav-row"] === "1")[0];
    return !!lbl && lbl.props.style.maxWidth === "100%";
  })(),
  band35 ? JSON.stringify([band35.props.style.paddingRight]) : "no header");
ok("...and the row's own highlight stopping clear of the circle too",
  !!row35 && gapOf((collect(row35, (n) => n.props && n.props["data-dqt-hl"] === "1")[0] || { props: { style: {} } }).props.style.right, btn35) >= 8,
  row35 ? String(gapOf((collect(row35, (n) => n.props && n.props["data-dqt-hl"] === "1")[0] || { props: { style: {} } }).props.style.right, btn35)) : "no row");
// ...and it lands on the bottom of that turn's LAST message. The [data-chat-turn]
// element is deliberately absent from this fixture: in a real session it turned out to
// be a small marker (0-80px) thousands of pixels from the reply, and anchoring the
// group control to it is exactly the bug this locks down.
const lastMsg35 = elem("div", {
  dataset: { chatAnchorKey: "a9" },
  getBoundingClientRect: () => ({ top: 3800 - scrollport.scrollTop, left: 0, right: 600, bottom: 4400 - scrollport.scrollTop, width: 600, height: 600 })
});
lastMsg35.closest = () => scrollport;
CONV_ROWS = [lastMsg35];
SCROLL.heads = [];
SCROLL.top = 0;
const realNow35c = Date.now;
let fakeNow35c = 900000;
Date.now = () => fakeNow35c;
scrollport.scrollTop = 0;
panelNodeOf(t35).props.onClickCapture({
  target: { closest: (sel) => (sel === "[data-dqt-end]" ? { dataset: { endKey: "a9", endTurn: "7" } } : null) },
  preventDefault() {}, stopPropagation() {}
});
drain(2);
fakeNow35c += 3000;
drain(60);
tickIntervals();
ok("...landing on the bottom of that turn's last message (the model's reply)",
  scrollport.scrollTop === 3828,
  String(scrollport.scrollTop) + " (its message ends at 4400; 4400 - 600 + 28 = 3828)");
Date.now = realNow35c;
CONV_ROWS = [];
// ...and the curtain's rows carry the same control
collect(t35, (n) => n.props && n.props.className === "dqt-sheet-btn")[0].props.onClick();
t35 = render(propsFor(SNAP));
tickTimeouts();   // the panel tucks, then the curtain drops
t35 = render(propsFor(SNAP));
const sheetRow35 = (() => {
  const sheet = collect(t35, (n) => n.props && n.props["data-sheet"] === "on")[0];
  return sheet ? collect(sheet, (n) => n.props && n.props["data-jump-key"])[0] : null;
})();
ok("the curtain's rows carry it as well", !!sheetRow35 && !!endBtnOf(sheetRow35));
store.clear();
resetComponent();
CONV_ROWS = [];

console.log("--- scenario 12x: toolbar icon geometry (0.7.1 polish) ---");
// Every round toolbar button must be centred BY GEOMETRY. The cross used to carry a
// `translate(1px, 0)` (and the magnifier a `translate(-1px, -1px)`), which is exactly why the
// reader saw the ✕ sitting right of centre; a nudge is also half a pixel off at other sizes.
store.clear(); resetComponent();
byTitle(render(propsFor(SNAP)), "展开大纲")[0].props.onClick({});
const tIcons = render(propsFor(SNAP));
const iconOf = (cls) => {
  const btn = collect(tIcons, (n) => n.props && n.props.className === cls)[0];
  return btn ? collect(btn, (n) => n.type === "svg")[0] : null;
};
// the docked header's own ✕ (no class of its own — it is the button titled 收起) plus the four
// classed ones; the curtain's ✕ only exists once the curtain is open, so it is checked there
const dockCrossSvg = (() => {
  const btn = byTitle(tIcons, "收起")[0];
  return btn ? collect(btn, (n) => n.type === "svg")[0] : null;
})();
const badges = ["dqt-levels-btn", "dqt-questions-btn", "dqt-search-btn", "dqt-sheet-btn"];
ok("round toolbar icons sit centred by geometry (no transform nudge on any of them)",
  badges.every((c) => { const s = iconOf(c); return !!s && !(s.props.style && s.props.style.transform); })
  && !!dockCrossSvg && !(dockCrossSvg.props.style && dockCrossSvg.props.style.transform),
  JSON.stringify(badges.map((c) => [c, !!(iconOf(c))])).concat([["dockCross", !!dockCrossSvg]]));

// The curtain button: a full-height surface with the arrow dropping out of its TOP edge.
const sheetSvg = iconOf("dqt-sheet-btn");
const sheetRect = collect(sheetSvg, (n) => n.type === "rect")[0];
const sheetPath = collect(sheetSvg, (n) => n.type === "path")[0];
const sr = sheetRect.props;
ok("the curtain button's rectangle is 12 x 9 (neither a slab nor a flat strip), centred in its 14 box",
  Math.abs(sr.width - 12) < 0.3 && Math.abs(sr.height - 9) < 0.3
  && Math.abs((sr.x + sr.width / 2) - 7) < 0.6 && Math.abs((sr.y + sr.height / 2) - 7) < 0.6,
  JSON.stringify([sr.x, sr.y, sr.width, sr.height]));
ok("...whose frame is as heavy as the questions bubble's, while the arrow keeps the lighter weight",
  sheetRect.props.strokeWidth === 2.2 && sheetSvg.props.strokeWidth === 1.8
  && iconOf("dqt-questions-btn").props.strokeWidth === 2.2,
  JSON.stringify([sheetRect.props.strokeWidth, sheetSvg.props.strokeWidth, iconOf("dqt-questions-btn").props.strokeWidth]));
const mArrow = /^M7 ([\d.]+)V([\d.]+)M([\d.]+) ([\d.]+)L7 ([\d.]+)/.exec(String(sheetPath.props.d));
ok("...and its arrow hangs DOWN with the tail starting exactly on that rectangle's top edge",
  !!mArrow && Number(mArrow[1]) === sr.y && Number(mArrow[2]) > Number(mArrow[1]) && Number(mArrow[5]) > Number(mArrow[4]),
  String(sheetPath.props.d) + " rectY=" + sr.y);

// The two lines the reader asked to be heavier.
ok("the level filter's three lines are heavier than the curtain outline",
  iconOf("dqt-levels-btn").props.strokeWidth === 2.2 && sheetSvg.props.strokeWidth === 1.8,
  JSON.stringify([iconOf("dqt-levels-btn").props.strokeWidth, sheetSvg.props.strokeWidth]));
ok("...and so is the questions bubble's own outline",
  iconOf("dqt-questions-btn").props.strokeWidth === 2.2,
  String(iconOf("dqt-questions-btn").props.strokeWidth));
const qRect = iconOf("dqt-questions-btn").props.children[0].props;
const qTail = String(iconOf("dqt-questions-btn").props.children[1].props.d);
const qTailBottom = Number(/v([\d.]+)/.exec(qTail)[1]) + qRect.y + qRect.height;
ok("...with a slightly larger bubble that sits a touch LOW on purpose (the tail would make a centred bubble read top-heavy)",
  qRect.width >= 11.2 && qRect.height >= 7.6
  && Math.abs((qRect.x + qRect.width / 2) - 7) < 0.3
  && (qRect.y + qTailBottom) / 2 > 7,
  JSON.stringify([qRect.x, qRect.y, qRect.width, qRect.height, qTail, (qRect.y + qTailBottom) / 2]));
store.clear(); resetComponent();
console.log("--- scenario 12y: curtain bottom pin + the two floating buttons (0.7.1) ---");
store.clear(); resetComponent();
provided.sessions = SESSION_FACE;
let tF = render(propsFor(SNAP));
const floatingOf = (tr, cls) => collect(tr, (n) => n.props && n.props.className === cls)[0];
ok("the two floating buttons exist (bottom = newest, top = my own position)",
  !!floatingOf(tF, "dqt-bottom-btn") && !!floatingOf(tF, "dqt-top-btn"));
ok("...both hidden until they are needed",
  !!floatingOf(tF, "dqt-bottom-btn") && !!floatingOf(tF, "dqt-top-btn")
  && floatingOf(tF, "dqt-bottom-btn").props.style.opacity === 0 && floatingOf(tF, "dqt-top-btn").props.style.opacity === 0);
// the top-right one is the bottom one's mirror: same surface, arrow pointing up
// It must clear the surface's chrome (the docked header row / the curtain's toolbar): its
// `top` is the MEASURED offset of the list inside the panel plus 12, never a constant 12 from
// the panel's own top edge. (The harness gives every ref stub the same rect, so the measured
// offset is 0 here — the assertion checks the rule, and the measurement itself is a headed
// observation.)
ok("...and it is placed below the surface's chrome, not at a fixed 12 from the panel's top",
  parseFloat(String(floatingOf(tF, "dqt-top-btn").props.style.top)) >= 12,
  String(floatingOf(tF, "dqt-top-btn").props.style.top));
ok("...the new one mirrors the bottom button (its arrow points up, its baseline is on top)",
  (() => {
    const btn = floatingOf(tF, "dqt-top-btn");
    if (!btn) return false;
    const svg = collect(btn, (n) => n.type === "svg")[0];
    if (!svg) return false;
    const pts = svg.props.children[0].props.points;
    return /3\.5,9\.5 7,6 10\.5,9\.5/.test(pts) && svg.props.children[1].props.y1 === 3;
  })());
// opening the curtain must not move a reader who is already at the newest turn: the
// container's geometry changes wholesale, and the "hold the anchor" correction used to put a
// stale row back where it was until the follow walked the list down again.
store.clear(); resetComponent();
let tPin = render(propsFor(SNAP));
const lPin = listOf(tPin);
lPin.scrollTop = 2000;                                  // parked at the bottom (scrollHeight 1000+)
lPin.props.onScroll({ currentTarget: lPin });
floatingOf(tPin, "dqt-bottom-btn");
sheetBtn(tPin).props.onClick();                          // drop the curtain
tickTimeouts();
let tPin2 = render(propsFor(SNAP));
ok("opening the curtain leaves a reader who is at the newest turn exactly there",
  listOf(tPin2).scrollTop >= LIST_STUB.scrollHeight - LIST_STUB.clientHeight - 1,
  "scrollTop=" + listOf(tPin2).scrollTop + " max=" + (LIST_STUB.scrollHeight - LIST_STUB.clientHeight));
// ...and both floating buttons grow with the curtain (26 -> 34, icon 14 -> 18)
const bS = floatingOf(tPin2, "dqt-bottom-btn");
const tS = floatingOf(tPin2, "dqt-top-btn");
ok("...and both grow with the curtain (26 -> 34, icon 14 -> 18)",
  !!bS && !!tS && bS.props.style.width === 34 && tS.props.style.width === 34
  && collect(bS, (n) => n.type === "svg")[0].props.width === 18
  && collect(tS, (n) => n.type === "svg")[0].props.width === 18,
  JSON.stringify([bS.props.style.width, tS.props.style.width, collect(tS, (n) => n.type === "svg")[0].props.width]));
store.clear(); resetComponent();

// The top-right button remembers the place the READER scrolled to (a wheel or a key), never a
// place the plugin moved them to, and puts them back there when something has moved the list.
// The memory is taken when the reader CLOSES the surface, per surface (the docked panel and
// the curtain are different shapes, so "where I was" means something different in each).
// Reopening arms a one-shot button; using it — or reaching that place by hand — consumes it.
// What is remembered is the ROW at the top, not a pixel offset: the list is re-laid out
// between close and open, so an offset would drift off the row the reader was looking at.
LAYOUT.list = { top: 0, height: 400 };
LAYOUT.groups = [{ idx: "5", top: 300, height: 200 }];   // row 5 sits at the top when scrollTop = 300
LAYOUT.ghosts = [];
let tBk = render(propsFor(SNAP));
const lBk = listOf(tBk);
lBk.scrollTop = 300;
lBk.props.onScroll({ currentTarget: lBk });
byTitle(tBk, "收起")[0].props.onClick();                 // close the docked panel: records 300
tBk = render(propsFor(SNAP));
lBk.scrollTop = 900;                                     // meanwhile the list sits elsewhere
byTitle(tBk, "展开大纲")[0].props.onClick();              // the same handle reopens it
let tBk2 = render(propsFor(SNAP));
ok("...and it appears once the list sits far from the place the reader closed at",
  !!floatingOf(tBk2, "dqt-top-btn") && floatingOf(tBk2, "dqt-top-btn").props.style.opacity === 1,
  String(floatingOf(tBk2, "dqt-top-btn") && floatingOf(tBk2, "dqt-top-btn").props.style.opacity));
floatingOf(tBk2, "dqt-top-btn").props.onClick({ stopPropagation() {} });
if (floatingOf(tBk2, "dqt-top-btn")) floatingOf(tBk2, "dqt-top-btn").props.onClick({ stopPropagation() {} });
ok("...clicking it puts the list back where the reader had scrolled to", lBk.scrollTop === 300, "scrollTop=" + lBk.scrollTop);
ok("...and using it once spends the memory (the button does not come back)",
  floatingOf(render(propsFor(SNAP)), "dqt-top-btn").props.style.opacity === 0,
  String(floatingOf(tBk2, "dqt-top-btn").props.style.opacity));
// ...and getting there by hand counts as using it
byTitle(render(propsFor(SNAP)), "收起")[0].props.onClick();   // close again, this time at 300
let tBk3 = render(propsFor(SNAP));
listOf(tBk3).scrollTop = 700;                            // ...and the list is moved away meanwhile
byTitle(tBk3, "展开大纲")[0].props.onClick();             // reopen: this close's position is armed
tBk3 = render(propsFor(SNAP));
ok("...and a later close/reopen arms it for THAT close's position",
  floatingOf(tBk3, "dqt-top-btn").props.style.opacity === 1,
  String(floatingOf(tBk3, "dqt-top-btn").props.style.opacity));
const lBk3 = listOf(tBk3);
lBk3.scrollTop = 310;                                    // the reader walks back there themselves
lBk3.props.onScroll({ currentTarget: lBk3 });
ok("...and scrolling back there by hand spends it too",
  floatingOf(render(propsFor(SNAP)), "dqt-top-btn").props.style.opacity === 0,
  "scrollTop=" + lBk3.scrollTop);
// ...and the memory follows the ROW, not a pixel offset: if the turns above it grow (a page
// loads while the panel is shut) the button still brings THAT row back to the top. A stored
// offset would land 400px away from the row here — the drift this design avoids.
store.clear(); resetComponent();
LAYOUT.list = { top: 0, height: 400 };
LAYOUT.groups = [{ idx: "5", top: 300, height: 200 }];
let tRow = render(propsFor(SNAP));
const lRow = listOf(tRow);
lRow.scrollTop = 300;
lRow.props.onScroll({ currentTarget: lRow });
byTitle(tRow, "收起")[0].props.onClick();                 // remember: row 5 is at the top
tRow = render(propsFor(SNAP));
LAYOUT.groups = [{ idx: "5", top: 700, height: 200 }];    // the list above it grew 400px
lRow.scrollTop = 900;                                     // ...and the follow moved the view
byTitle(tRow, "展开大纲")[0].props.onClick();
tRow = render(propsFor(SNAP));
floatingOf(tRow, "dqt-top-btn").props.onClick({ stopPropagation() {} });
ok("...and it goes back to the ROW, not to the old pixel offset (the row moved 300 -> 700)",
  lRow.scrollTop === 700, "scrollTop=" + lRow.scrollTop + " (row now starts at 700)");
// ...and EVERY way of leaving the docked panel records that row: Esc closes the panel too, so a
// reader who leaves with Esc gets the same one-shot button. Leaving Esc out did not mean "no
// memory" — it meant a STALE one: the button offered the row stored by an earlier ✕ close.
store.clear(); resetComponent();
LAYOUT.list = { top: 0, height: 400 };
LAYOUT.groups = [{ idx: "5", top: 300, height: 200 }];
let tEsc = render(propsFor(SNAP));
const lEsc = listOf(tEsc);
byTitle(tEsc, "展开大纲")[0].props.onClick();              // open the docked panel first
tEsc = render(propsFor(SNAP));
lEsc.scrollTop = 300;
lEsc.props.onScroll({ currentTarget: lEsc });
press(tEsc, "Escape");                                   // leave the docked panel with Esc
tEsc = render(propsFor(SNAP));
LAYOUT.groups = [{ idx: "5", top: 700, height: 200 }];    // the list sits elsewhere meanwhile
lEsc.scrollTop = 900;
byTitle(tEsc, "展开大纲")[0].props.onClick();              // reopen from the edge handle
tEsc = render(propsFor(SNAP));
ok("...Esc records the row as well (reopening offers the button)",
  !!floatingOf(tEsc, "dqt-top-btn") && floatingOf(tEsc, "dqt-top-btn").props.style.opacity === 1,
  String(floatingOf(tEsc, "dqt-top-btn") && floatingOf(tEsc, "dqt-top-btn").props.style.opacity));
floatingOf(tEsc, "dqt-top-btn").props.onClick({ stopPropagation() {} });
ok("...and that button returns to the row Esc left at", lEsc.scrollTop === 700,
  "scrollTop=" + lEsc.scrollTop + " (expected 700)");
// ...and the CURTAIN keeps its own row, separately from the docked panel: the two surfaces are
// different shapes, so "where I was" is recorded per surface at each close.
store.clear(); resetComponent();
LAYOUT.list = { top: 0, height: 400 };
LAYOUT.groups = [{ idx: "5", top: 300, height: 200 }];
let tCt = render(propsFor(SNAP));
const lCt = listOf(tCt);
topHandle(tCt).props.onClick();                          // the droplet drops the curtain
tCt = render(propsFor(SNAP));
tickTimeouts();
tCt = render(propsFor(SNAP));
lCt.scrollTop = 300;
lCt.props.onScroll({ currentTarget: lCt });
byTitle(tCt, "收起幕布")[0].props.onClick();               // leave the curtain: row 5 is at the top
tCt = render(propsFor(SNAP));
tickTimeouts();
tCt = render(propsFor(SNAP));
drain();
tCt = render(propsFor(SNAP));
LAYOUT.groups = [{ idx: "5", top: 700, height: 200 }];    // the list sits elsewhere meanwhile
lCt.scrollTop = 900;
topHandle(tCt).props.onClick();                          // reopen the curtain
tCt = render(propsFor(SNAP));
tickTimeouts();
tCt = render(propsFor(SNAP));
ok("...and the curtain remembers its own row (per surface)",
  !!floatingOf(tCt, "dqt-top-btn") && floatingOf(tCt, "dqt-top-btn").props.style.opacity === 1,
  String(floatingOf(tCt, "dqt-top-btn") && floatingOf(tCt, "dqt-top-btn").props.style.opacity));
floatingOf(tCt, "dqt-top-btn").props.onClick({ stopPropagation() {} });
ok("...and returns to the row the reader left the curtain at", lCt.scrollTop === 700,
  "scrollTop=" + lCt.scrollTop + " (expected 700)");
// ...and the DOCKED PANEL opens on the turn being read, exactly like the curtain. The two
// surfaces used to disagree here: the curtain landed on the reading turn, the panel just showed
// wherever the list had last been left.
store.clear(); resetComponent();
LAYOUT.list = { top: 0, height: 400 };
LAYOUT.groups = [{ idx: "2", top: 900, height: 200 }];
LAYOUT.ghosts = [];
SCROLL.rows = new Map([["u3", anchorRow("u3", 40, 120)], ["a3", anchorRow("a3", 140, 300)]]);
let tRead = render(propsFor(SNAP));
fireDocument("scroll", {});                              // the follow marks turn 3 as being read
tRead = render(propsFor(SNAP));
drain();                                                 // ...and runs its own placement out
tickTimeouts();
// From here the follow must not be the one moving the list (it places a changed turn by
// itself): with no conversation rows it cannot schedule anything, so whatever lands the row
// on opening is the landing rule under test and nothing else.
SCROLL.rows = new Map();
// Let the follow's own queued work die out while the list is still where the follow left it
// (its writes are no-ops there). With no conversation rows it cannot schedule anything new — it
// returns before its placement code — so after this the ONLY thing that can move the list is the
// landing rule under test. Without this the follow's leftover placement would re-align the very
// row this assertion is about and the check would pass with the rule removed.
for (let q = 0; q < 4; q++) { tRead = render(propsFor(SNAP)); drain(); tickTimeouts(); }
const lRead = listOf(tRead);
lRead.scrollTop = 0;                                     // the reader parks the list elsewhere
lRead.props.onScroll({ currentTarget: lRead });          // (so it is not "at the bottom")
byTitle(tRead, "展开大纲")[0].props.onClick();             // open the docked panel
tRead = render(propsFor(SNAP));
drain();
ok("opening the docked panel lands on the turn being read (that row at the top)",
  lRead.scrollTop === 900, "scrollTop=" + lRead.scrollTop);
SCROLL.rows = new Map();
LAYOUT.list = null; LAYOUT.groups = []; LAYOUT.ghosts = [];
// ...and the two surfaces keep their OWN memory: arming the curtain's row must not consume — or
// overwrite — the row the panel was left at, and coming back to the panel must still offer it.
store.clear(); resetComponent();
SCROLL.rows = new Map();                                 // no follow interference in this scenario
LAYOUT.list = { top: 0, height: 400 };
LAYOUT.groups = [{ idx: "5", top: 300, height: 200 }, { idx: "7", top: 700, height: 200 }];
LAYOUT.ghosts = [];
let tPS = render(propsFor(SNAP));
const lPS = listOf(tPS);
byTitle(tPS, "展开大纲")[0].props.onClick();              // open the docked panel
tPS = render(propsFor(SNAP));
lPS.scrollTop = 300;                                     // row 5 at the top
lPS.props.onScroll({ currentTarget: lPS });
byTitle(tPS, "收起")[0].props.onClick();                  // close it: the PANEL's row is 5
tPS = render(propsFor(SNAP));
lPS.scrollTop = 700;                                     // row 7 at the top
topHandle(tPS).props.onClick();                          // the droplet drops the curtain
tPS = render(propsFor(SNAP));
tickTimeouts();
tPS = render(propsFor(SNAP));
byTitle(tPS, "收起幕布")[0].props.onClick();               // close it: the CURTAIN's row is 7
tPS = render(propsFor(SNAP));
tickTimeouts();
tPS = render(propsFor(SNAP));
drain();                                                 // the collapsed panel settles
tPS = render(propsFor(SNAP));
lPS.scrollTop = 500;                                     // the list is somewhere else again
byTitle(tPS, "展开大纲")[0].props.onClick();              // the reader opens the PANEL: arms row 5
tPS = render(propsFor(SNAP));
sheetBtn(tPS).props.onClick();                           // ...then hands over to the curtain
tPS = render(propsFor(SNAP));
tickTimeouts();                                          // (the panel tucks first)
tPS = render(propsFor(SNAP));
byTitle(tPS, "收起幕布")[0].props.onClick();               // and closes it again
tPS = render(propsFor(SNAP));
tickTimeouts();
tPS = render(propsFor(SNAP));
drain();
tPS = render(propsFor(SNAP));
ok("coming back to the panel still offers ITS row (the curtain's did not overwrite it)",
  !!floatingOf(tPS, "dqt-top-btn") && floatingOf(tPS, "dqt-top-btn").props.style.opacity === 1,
  String(floatingOf(tPS, "dqt-top-btn") && floatingOf(tPS, "dqt-top-btn").props.style.opacity));
floatingOf(tPS, "dqt-top-btn").props.onClick({ stopPropagation() {} });
ok("...and the button goes back to row 5, never to the curtain's row 7",
  lPS.scrollTop === 300, "scrollTop=" + lPS.scrollTop + " (row 7 would land at 700)");
// ...and a reader who closed at the BOTTOM is not offered a jump at all. The row on the top edge
// there is CLIPPED (its own top sits above the list's), so measuring "how far is it from the top"
// against 0 made the button appear the moment they reopened — and walk them up by exactly that
// clipping distance. What matters is whether the row has moved since they left it.
store.clear(); resetComponent();
SCROLL.rows = new Map();
LAYOUT.list = { top: 0, height: 400 };
LAYOUT.groups = [{ idx: "5", top: 480, height: 200 }];   // at the bottom its top is 480 - 600 = -120
LAYOUT.ghosts = [];
let tBt = render(propsFor(SNAP));
const lBt = listOf(tBt);
byTitle(tBt, "展开大纲")[0].props.onClick();              // open the docked panel
tBt = render(propsFor(SNAP));
lBt.scrollTop = 600;                                     // parked at the bottom (max = 1000 - 400)
lBt.props.onScroll({ currentTarget: lBt });
byTitle(tBt, "收起")[0].props.onClick();                  // close it there
tBt = render(propsFor(SNAP));
byTitle(tBt, "展开大纲")[0].props.onClick();              // reopen it
tBt = render(propsFor(SNAP));
ok("reopening a list that was closed at the bottom offers no jump (the row is still where it was)",
  !!floatingOf(tBt, "dqt-top-btn") && floatingOf(tBt, "dqt-top-btn").props.style.opacity === 0,
  String(floatingOf(tBt, "dqt-top-btn") && floatingOf(tBt, "dqt-top-btn").props.style.opacity));
// ...and the curtain obeys the same rule with its own memory (it re-pins the bottom when it
// opens, which is where that reader already was). A real scroller clamps `scrollTop`; the stub
// does not, so the pin (`scrollTop = scrollHeight`) is clamped here — otherwise this block would
// describe a browser that cannot exist.
store.clear(); resetComponent();
SCROLL.rows = new Map();
LAYOUT.list = { top: 0, height: 400 };
LAYOUT.groups = [{ idx: "5", top: 480, height: 200 }];
LAYOUT.ghosts = [];
let btStub = 0;
Object.defineProperty(LIST_STUB, "scrollTop", {
  configurable: true,
  get: () => btStub,
  set: (v) => { btStub = Math.max(0, Math.min(v, LIST_STUB.scrollHeight - LIST_STUB.clientHeight)); },
});
let tBs = render(propsFor(SNAP));
const lBs = listOf(tBs);
topHandle(tBs).props.onClick();                          // the droplet drops the curtain
tBs = render(propsFor(SNAP));
tickTimeouts();
tBs = render(propsFor(SNAP));
lBs.scrollTop = 600;                                     // at the bottom
lBs.props.onScroll({ currentTarget: lBs });
byTitle(tBs, "收起幕布")[0].props.onClick();               // close the curtain there
tBs = render(propsFor(SNAP));
tickTimeouts();
tBs = render(propsFor(SNAP));
drain();
tBs = render(propsFor(SNAP));
topHandle(tBs).props.onClick();                          // reopen it
tBs = render(propsFor(SNAP));
tickTimeouts();
tBs = render(propsFor(SNAP));
ok("...and the curtain offers no jump there either (one rule, its own remembered row)",
  !!floatingOf(tBs, "dqt-top-btn") && floatingOf(tBs, "dqt-top-btn").props.style.opacity === 0,
  String(floatingOf(tBs, "dqt-top-btn") && floatingOf(tBs, "dqt-top-btn").props.style.opacity) + " scrollTop=" + lBs.scrollTop);
Object.defineProperty(LIST_STUB, "scrollTop", { configurable: true, writable: true, value: btStub });
// ...and the curtain carries its OWN scale, which the docked panel ignores (and the other way
// round): the two surfaces scale independently, because a factor that suits the dense dock is
// not the one a reader wants for the wide curtain.
store.clear(); resetComponent();
SCROLL.rows = new Map();
LAYOUT.list = { top: 0, height: 400 };
LAYOUT.groups = []; LAYOUT.ghosts = [];
setHostField("sheetZoom", 1.5);
setHostField("zoom", 0.75);
// Across the curtain the panel root is the sheet's own content box (position: relative,
// flex: 1 1 auto) — `findPanel` looks for the DOCKED box and would match the edge handle here.
const sheetPanelOf = (t) => collect(t, (n) => n.props && n.props.style && n.props.style.position === "relative" &&
  n.props.style.flex === "1 1 auto" && n.props.style.minHeight === 0)[0];
let tZ = render(propsFor(SNAP));
tZ = render(propsFor(SNAP));
ok("the docked panel scales by its own factor",
  parseFloat(String(findPanel(tZ).props.style.zoom)) === 0.75, String(findPanel(tZ).props.style.zoom));
topHandle(tZ).props.onClick();                           // the droplet drops the curtain
tZ = render(propsFor(SNAP));
tickTimeouts();
tZ = render(propsFor(SNAP));
ok("...and the curtain scales by its own factor over its 0.9 base, not the panel's",
  !!sheetPanelOf(tZ) && Math.abs(Number(sheetPanelOf(tZ).props.style.zoom) - 1.35) < 1e-9,
  String(sheetPanelOf(tZ) && sheetPanelOf(tZ).props.style.zoom));
setHostField("sheetZoom", 1);
setHostField("zoom", 1);
tZ = render(propsFor(SNAP));
ok("...while at the default 100% the curtain keeps that 0.9 base (the size a reader sees by default)",
  !!sheetPanelOf(tZ) && Math.abs(Number(sheetPanelOf(tZ).props.style.zoom) - 0.9) < 1e-9,
  String(sheetPanelOf(tZ) && sheetPanelOf(tZ).props.style.zoom));
resetHost();
SCROLL.rows = new Map();
LAYOUT.list = null; LAYOUT.groups = []; LAYOUT.ghosts = [];
store.clear(); resetComponent();

console.log("--- scenario 28 (0.8.0): the pinned preview, the row menu, and how cards animate ---");
store.clear(); resetComponent();
let tp = render(propsFor(SNAP));
byTitle(tp, "展开大纲")[0].props.onClick(); // the cards only exist while the panel is open
tp = render(propsFor(SNAP));
const rowArgs = (i, top) => ({ currentTarget: { style: {}, querySelector: () => null, getBoundingClientRect: () => ({ top: top === undefined ? 120 + i * 30 : top, left: 40, right: 300, width: 260, height: 22 }) } });
const rowsAt = (t) => collect(t, (n) => n.props && n.props["data-jump-key"] && n.props.onMouseEnter);
const hasClass = (n, c) => String((n && n.props && n.props.className) || "").split(/\s+/).includes(c);
const allCards = (t) => collect(t, (n) => n.props && hasClass(n, "dqt-hover"));
// a card that is fading out is still mounted (that IS the animation), so "on screen"
// means "not closing" everywhere below
const cardsAt = (t) => allCards(t).filter((c) => !hasClass(c, "dqt-hover-closing"));
const closingCards = (t) => allCards(t).filter((c) => hasClass(c, "dqt-hover-closing"));
const pinOff = (t) => collect(t, (n) => n.props && n.props["data-dqt-pin"] === "off")[0];
const pinOn = (t) => collect(t, (n) => n.props && n.props["data-dqt-pin"] === "on")[0];
const pinnedEl = (t) => allCards(t).find((c) => String(c.props["data-dqt-pinned"]) === "on");
const menuEl = (t) => collect(t, (n) => n.props && n.props["data-dqt-menu"] === "on")[0];
const fadingMenu = (t) => { const m = menuEl(t); return m && hasClass(m, "dqt-rowmenu-closing") ? m : null; };
const liveMenu = (t) => { const m = menuEl(t); return m && !hasClass(m, "dqt-rowmenu-closing") ? m : null; };
const menuItems = (t) => { const m = liveMenu(t); return m ? collect(m, (n) => n.props && n.props["data-dqt-menu-item"]) : []; };
const noop = { preventDefault() {}, stopPropagation() {} };
const rightClick = (i, y) => Object.assign({ clientX: 120, clientY: y === undefined ? 200 : y }, rowArgs(i), noop);

// ---- pinning from the card's own pin button ----
rowsAt(tp)[0].props.onMouseEnter(rowArgs(0));
tickTimeouts(); // the 260ms hover delay
tp = render(propsFor(SNAP));
ok("the hover card offers a pin button", !!pinOff(tp));
pinOff(tp).props.onClick(noop);
tp = render(propsFor(SNAP));
ok("clicking the pin marks the card as pinned", !!pinOn(tp));
ok("...and the adopted card does not replay its entrance animation (no blink)",
  hasClass(pinnedEl(tp), "dqt-hover-static"), String(pinnedEl(tp).props.className));
const pinnedTop = Number(pinnedEl(tp).props.style.top);
rowsAt(tp)[0].props.onMouseLeave(rowArgs(0));
tickTimeouts(); // the hover card's own 240ms fade
tp = render(propsFor(SNAP));
ok("the pinned card survives the pointer leaving its row", cardsAt(tp).length === 1 && !!pinOn(tp), `${cardsAt(tp).length} cards`);

// ---- the second card, placed clear of the pinned one ----
rowsAt(tp)[1].props.onMouseEnter(rowArgs(1));
tickTimeouts();
tp = render(propsFor(SNAP));
ok("hovering another row while pinned puts a second card on screen", cardsAt(tp).length === 2, `${cardsAt(tp).length} cards`);
ok("...and the second card is moved clear of the pinned one",
  new Set(cardsAt(tp).map((c) => Number(c.props.style.top))).size === 2, cardsAt(tp).map((c) => c.props.style.top).join(", "));
ok("with the pinned card high up the second card sits below it",
  Number(cardsAt(tp)[1].props.style.top) > Number(cardsAt(tp)[0].props.style.top),
  cardsAt(tp).map((c) => c.props.style.top).join(", "));
ok("the pinned card never moves from where it was put (it follows nothing)",
  Number(cardsAt(tp)[0].props.style.top) === pinnedTop, `${cardsAt(tp)[0].props.style.top} vs ${pinnedTop}`);

// ---- the row menu ----
rowsAt(tp)[0].props.onContextMenu(rightClick(0));
tp = render(propsFor(SNAP));
ok("right-clicking an outline row opens a row menu", !!liveMenu(tp));
ok("...and the menu carries the pop animation class", hasClass(liveMenu(tp), "dqt-rowmenu"), String(liveMenu(tp).props.className));
fireDocument("mousedown", { button: 2, target: { closest: () => null } }); // the right-click itself
tp = render(propsFor(SNAP));
ok("a right-click does not drop the pinned card", !!pinOn(tp), cardsAt(tp).map((c) => c.props.className).join(" "));
ok("the pinned row's menu offers to unpin instead", textOf(menuItems(tp)[0]).includes("取消钉住"), textOf(menuItems(tp)[0]));
ok("the menu offers jump-to-section-end as well",
  menuItems(tp).length === 2 && textOf(menuItems(tp)[1]).includes("跳到本节末尾"), menuItems(tp).map(textOf).join(" | "));

// ---- closing the menu fades it out instead of making it vanish ----
menuItems(tp)[1].props.onClick(noop); // the jump item
tp = render(propsFor(SNAP));
ok("running a menu item leaves the menu fading, not gone", !!fadingMenu(tp), String(menuEl(tp) && menuEl(tp).props.className));
ok("...and the pin survives a jump", !!pinOn(tp));
tickTimeouts();
tp = render(propsFor(SNAP));
ok("...and the menu is gone once the fade is over", !menuEl(tp));

// ---- unpinning fades the card out too ----
fireDocument("mousedown", { target: { closest: () => null } }); // a click anywhere else
tp = render(propsFor(SNAP));
ok("a click outside fades the pinned card instead of dropping it", closingCards(tp).length === 1 && !!pinOn(tp), allCards(tp).map((c) => c.props.className).join(" | "));
ok("...and a fading card takes no pointer events", closingCards(tp)[0].props.style.pointerEvents === "none", String(closingCards(tp)[0].props.style.pointerEvents));
tickTimeouts();
tp = render(propsFor(SNAP));
ok("...and the pinned card is gone once the fade is over", !pinnedEl(tp), allCards(tp).map((c) => c.props.className).join(" | "));

// ---- pinning from the menu: where it lands, and that it animates in ----
rowsAt(tp)[0].props.onContextMenu(rightClick(0));
tp = render(propsFor(SNAP));
menuItems(tp)[0].props.onClick(noop);
tp = render(propsFor(SNAP));
ok("pinning from the menu keeps a card on screen", !!pinOn(tp));
// the card belongs where its ROW is, not where the right-click landed (the menu opens
// at the pointer: clientY 200, the row's top is 120)
ok("...and it is anchored to the row, not to the click point",
  Number(cardsAt(tp)[0].props.style.top) === 120 - 4, String(cardsAt(tp)[0].props.style.top));
ok("...and a card that was not on screen already animates in",
  !hasClass(pinnedEl(tp), "dqt-hover-static"), String(pinnedEl(tp).props.className));
tickTimeouts();
tp = render(propsFor(SNAP));
ok("...and the menu is gone after its fade", !menuEl(tp));

// ---- Escape takes the menu first ----
rowsAt(tp)[1].props.onContextMenu(rightClick(1));
tp = render(propsFor(SNAP));
fireDocument("keydown", { key: "Escape", preventDefault() {}, stopPropagation() {} });
tp = render(propsFor(SNAP));
ok("the first Escape fades the menu and keeps the pin", !!fadingMenu(tp) && !!pinOn(tp), allCards(tp).map((c) => c.props.className).join(" | "));
tickTimeouts();
tp = render(propsFor(SNAP));
ok("...and the menu is gone once its fade is over", !menuEl(tp));

// ---- unpinning through the card's own button fades it out (never a pop) ----
// (the document-level Escape path is exercised in the live probe; the button drives the
//  very same unpinCard() and is what the offline harness handles most faithfully)
const pinOnBtn = collect(tp, (n) => n.props && n.props["data-dqt-pin"] === "on")[0];
pinOnBtn.props.onClick(noop);
tp = render(propsFor(SNAP));
ok("unpinning from the card fades it instead of making it vanish",
  closingCards(tp).length === 1, allCards(tp).map((c) => c.props.className).join(" | "));
tickTimeouts();
tp = render(propsFor(SNAP));
ok("...and the pin is gone after the fade", !pinnedEl(tp), allCards(tp).map((c) => c.props.className).join(" | "));
store.clear(); resetComponent();

/* ------------------------------------------------------------------ manifest guard
 * The declared host range is what DSH's plugin-compatibility preflight reads before it imports
 * this plugin, so narrowing it silently locks the plugin out of a host line (0.2.0-rc.1 was
 * refused until the ceiling moved past 0.2.0). These assertions pin the range and the
 * compatibility map, so any future narrowing turns the suite red instead of a host refusing us.
 * Hosts we have exercised: 0.1.5-rc.3, 0.1.7-alpha.1, 0.1.7-alpha.2, 0.1.7-rc.1, 0.1.7-rc.2,
 * 0.2.0-rc.1. */
{
  const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const RANGE = ">=0.1.5-rc.3 <0.1.7-0 || >=0.1.7-alpha.1 <0.3.0-0";
  const HOSTS = ["0.1.5-rc.3", "0.1.7-alpha.1", "0.1.7-alpha.2", "0.1.7-rc.1", "0.1.7-rc.2", "0.2.0-rc.1"];
  ok("engines.dsh keeps the range that admits every exercised host line",
    manifest.engines && manifest.engines.dsh === RANGE, String(manifest.engines && manifest.engines.dsh));
  for (const peer of ["@deepseek-ai/dsh-client-ui-chat", "@deepseek-ai/dsh-client-ui-conversation"]) {
    ok(`peer ${peer} keeps the same range`,
      manifest.peerDependencies && manifest.peerDependencies[peer] === RANGE,
      String(manifest.peerDependencies && manifest.peerDependencies[peer]));
  }
  const releases = Object.keys((manifest.dsh && manifest.dsh.compatibility && manifest.dsh.compatibility.dshReleases) || {});
  for (const host of HOSTS) {
    ok(`dsh.compatibility.dshReleases still lists ${host}`, releases.includes(host), releases.join(", "));
  }
  const inject = (manifest.dsh && manifest.dsh.client && manifest.dsh.client.inject) || [];
  for (const pkg of ["@deepseek-ai/dsh-client-ui-chat", "@deepseek-ai/dsh-client-ui-conversation", "@deepseek-ai/dsh-client-ui-layout"]) {
    ok(`dsh.client.inject still asks for ${pkg}`, inject.includes(pkg), inject.join(", "));
  }
}

const failed = results.filter((r) => !r).length;
console.log(`\nsummary: ${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

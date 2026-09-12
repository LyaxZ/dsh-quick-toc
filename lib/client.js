window.__ModuleLoader__.load({
  id: "dsh-quick-toc",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    let react = require("react");
    let react_jsx_runtime = require("react/jsx-runtime");
    let react_dom = require("react-dom"); // createPortal -> panel stays a top-level overlay (highest pointer priority)
    // Recent DSH (0.1.5-rc.1): the old @deepseek-ai/dsh-client-runtime package is gone.
    // Runtime hooks (useChat etc.) now arrive as session-scope slot props —
    // no runtime package to require here anymore.

    // ---------- constants ----------
    var PANEL_WIDTH = 288;
    // Very high base so the portal-rendered panel (top-level stacking context)
    // always sits above DSH content and its transcript width handles.
    // Panel layer: above the app's popovers (z 100) and the transcript width
    // handles (z 8), but BELOW DSH's modal layer (settings/image viewer, z 1000)
    // so opening settings covers the panel instead of the panel floating on top.
    var Z_BASE = 500;
    var EASE = "cubic-bezier(0.22, 0.9, 0.3, 1)"; // smooth non-linear slide

    // ---------- markdown helpers ----------
    function extractReplyText(node) {
      var blocks = node && node.data && node.data.blocks;
      if (!Array.isArray(blocks)) return "";
      var out = "";
      for (var i = 0; i < blocks.length; i++) {
        var b = blocks[i];
        if (b && typeof b === "object" && (b.kind === "text" || b.type === "text") && typeof b.text === "string") {
          out += b.text + "\n";
        }
      }
      return out;
    }

    // strip inline markdown from a heading title: **bold**, *italic*,
    // `code`, ~~strike~~, [link](url) -> link text
    function cleanTitle(t) {
      return t
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/__([^_]+)__/g, "$1")
        .replace(/\*([^*]+)\*/g, "$1")
        .replace(/_([^_]+)_/g, "$1")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/~~([^~]+)~~/g, "$1")
        .trim();
    }

    // user messages carry their text in data.content (assistant replies use
    // data.blocks) — read whichever is present
    function extractUserText(node) {
      var d = node && node.data;
      if (!d) return "";
      var content = d.content;
      if (typeof content === "string") return content;
      if (Array.isArray(content)) {
        var out = "";
        for (var i = 0; i < content.length; i++) {
          var b = content[i];
          if (b && typeof b === "object" && (b.type === "text" || b.kind === "text") && typeof b.text === "string") {
            out += b.text + "\n";
          }
        }
        return out;
      }
      return extractReplyText(node);
    }

    // first non-empty line of a message, truncated for the outline header
    function previewText(text, max) {
      if (!text) return "";
      var first = text.split("\n").map(function (s) { return s.trim(); }).filter(Boolean)[0] || "";
      if (first.length > max) first = first.slice(0, max) + "…";
      return first;
    }

    // Headings are collected line by line so FENCED CODE BLOCKS can be skipped:
    // a "```" block that documents markdown (or shows a shell comment like
    // "# install") contains lines that look like headings but are code — they
    // must not become outline entries (they have no element to jump to, and they
    // shifted the index of the real headings).
    function parseHeadings(text) {
      var items = [];
      if (!text) return items;
      var lines = text.split("\n");
      var fence = null; // { char, len } while inside a fenced code block
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        var fm = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
        if (fence !== null) {
          // a closing fence uses the same character, is at least as long and has
          // no info string after it
          if (fm && fm[1].charAt(0) === fence.char && fm[1].length >= fence.len && fm[2].trim() === "") fence = null;
          continue;
        }
        if (fm) { fence = { char: fm[1].charAt(0), len: fm[1].length }; continue; }
        var m = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
        if (m !== null) items.push({ level: m[1].length, title: cleanTitle(m[2].trim()) });
      }
      return items;
    }

    function buildTree(headings) {
      var root = { level: 0, children: [] };
      var stack = [root];
      for (var i = 0; i < headings.length; i++) {
        var h = headings[i];
        while (stack.length > 1 && stack[stack.length - 1].level >= h.level) stack.pop();
        var node = { level: h.level, title: h.title, key: h.key, idx: h.idx, children: [] };
        stack[stack.length - 1].children.push(node);
        stack.push(node);
      }
      return root.children;
    }

    // ---- per-node extraction cache ----
    // The conversation store keeps the same node objects for unchanged messages,
    // so a streaming update only re-joins/re-parses the node that actually
    // changed instead of every message in the history.
    var EMPTY_HEADINGS = [];
    var nodeInfoCache = new Map();
    function nodeInfo(key, node) {
      var isUser = node.kind === "user";
      var blocks = node.data ? node.data.blocks : undefined;
      var cached = nodeInfoCache.get(key);
      if (cached !== undefined &&
        (cached.node === node || (blocks !== undefined && cached.blocks === blocks && cached.user === isUser))) {
        return cached;
      }
      var text = isUser ? extractUserText(node) : extractReplyText(node);
      var info = {
        node: node,
        blocks: blocks,
        user: isUser,
        text: text,
        headings: node.kind === "assistant-step" ? parseHeadings(text) : EMPTY_HEADINGS
      };
      nodeInfoCache.set(key, info);
      return info;
    }
    // Drop cache records whose node left the conversation (bounded growth).
    function pruneNodeInfo(seen) {
      if (nodeInfoCache.size <= 200) return;
      nodeInfoCache.forEach(function (value, key) {
        if (!seen[key]) nodeInfoCache.delete(key);
      });
    }

    // stable id for one heading occurrence (a message can hold several)
    function headingId(h) {
      return h.key + "#" + h.idx;
    }

    // Split `text` into runs around case-insensitive occurrences of `q`, so the
    // caller can render the hits distinctly. Returns [{ text, hit }, ...].
    function highlightParts(text, q) {
      var parts = [];
      if (!text) return parts;
      if (!q) return [{ text: text, hit: false }];
      var lower = text.toLowerCase();
      var from = 0;
      for (;;) {
        var at = lower.indexOf(q, from);
        if (at === -1) break;
        if (at > from) parts.push({ text: text.slice(from, at), hit: false });
        parts.push({ text: text.slice(at, at + q.length), hit: true });
        from = at + q.length;
      }
      if (from < text.length) parts.push({ text: text.slice(from), hit: false });
      return parts;
    }

    // A one-line window around the first hit of `q` in `text` (for search results).
    function snippetAround(text, q, span) {
      if (!text) return "";
      var flat = text.replace(/\s+/g, " ").trim();
      var at = flat.toLowerCase().indexOf(q);
      if (at === -1) return previewText(flat, span * 2);
      var start = Math.max(0, at - span);
      var end = Math.min(flat.length, at + q.length + span);
      return (start > 0 ? "…" : "") + flat.slice(start, end) + (end < flat.length ? "…" : "");
    }

    // strict lookup: exact dataset match or CSS-escaped selector only —
    // no fuzzy contains matching (avoids landing on the wrong row);
    // hidden rows (zero rect, e.g. duplicate/hidden copies) are skipped
    function findRowStrict(key) {
      if (!key) return null;
      var rows = document.querySelectorAll("[data-chat-anchor-key]");
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].dataset && rows[i].dataset.chatAnchorKey === key) {
          var r = rows[i].getBoundingClientRect();
          if (r.width > 0 && r.height > 0) return rows[i];
        }
      }
      try {
        var el = document.querySelector('[data-chat-anchor-key="' + window.CSS.escape(key) + '"]');
        if (el) {
          var r2 = el.getBoundingClientRect();
          if (r2.width > 0 && r2.height > 0) return el;
        }
      } catch (e) {}
      return null;
    }

    function findRow(key) {
      if (!key) return null;
      var rows = document.querySelectorAll("[data-chat-anchor-key]");
      // 1) exact dataset match
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].dataset && rows[i].dataset.chatAnchorKey === key) return rows[i];
      }
      // 2) CSS attribute selector (keys may contain special chars)
      try {
        var el = document.querySelector('[data-chat-anchor-key="' + window.CSS.escape(key) + '"]');
        if (el) return el;
      } catch (e) {}
      // 3) contains match (one side may be prefixed/suffixed)
      for (var j = 0; j < rows.length; j++) {
        var k = rows[j].dataset && rows[j].dataset.chatAnchorKey;
        if (k && (k.indexOf(key) >= 0 || key.indexOf(k) >= 0)) return rows[j];
      }
      return null;
    }

    // count every occurrence of q (case-insensitive) inside text
    function countOccurrences(text, q) {
      // an empty needle would make indexOf return 0 forever and freeze the tab;
      // every caller passes a trimmed non-empty query today, but the guard keeps
      // a future call site from hanging the UI.
      if (!text || !q) return 0;
      var lower = text.toLowerCase();
      var count = 0;
      var idx = 0;
      while ((idx = lower.indexOf(q, idx)) !== -1) {
        count++;
        idx += q.length;
      }
      return count;
    }

    // find the conversation's "load older messages" button (scoped to the
    // conversation scrollport so panel buttons are never matched)
    function findLoadOlderButton() {
      var sp = document.querySelector("[data-conversation-scroll]");
      if (!sp) return null;
      var buttons = sp.querySelectorAll("button");
      for (var i = 0; i < buttons.length; i++) {
        var t = (buttons[i].textContent || "").trim();
        if (/加载|更早|loadOlder|older/i.test(t)) return buttons[i];
      }
      return null;
    }

    // ---- which view is the conversation area showing? ----
    // The center column hosts ONE view at a time (chat / trajectory / context /
    // any plugin view): DSH renders only the selected view entry, but the
    // scrollport is shared, so our overlay would otherwise float over every view.
    // The tab list (rendered when there is more than one view) marks the active
    // view with aria-selected; ui-chat registers the chat view with order 0, so
    // its tab comes first. Anything unknowable degrades to "chat" (visible).
    var CHAT_VIEW_LABELS = ["对话", "chat"];
    // Cached so the fast poll costs one isConnected check in the common case.
    var _chatTablistCache = null;
    function conversationTablist() {
      var cached = _chatTablistCache;
      if (cached && cached.isConnected) return cached;
      var found = null;
      // Scope the lookup to the conversation area: walk up from the shared
      // scrollport and take the first tab list an ancestor owns, so an
      // unrelated tab list (e.g. inside a settings dialog) can never match.
      var sp = document.querySelector("[data-conversation-scroll]");
      if (sp) {
        var node = sp;
        for (var d = 0; d < 6 && node && !found; d++) {
          node = node.parentElement;
          if (node) found = node.querySelector('[role="tablist"]');
        }
      }
      if (!found) found = document.querySelector('[role="tablist"]');
      _chatTablistCache = found;
      return found;
    }
    function isChatViewActive() {
      try {
        var tablist = conversationTablist();
        if (!tablist) return true; // a single view: no tab list, and it is chat
        var tabs = tablist.querySelectorAll('button[role="tab"]');
        if (tabs.length < 2) return true;
        var activeIdx = -1;
        var chatIdx = -1;
        for (var i = 0; i < tabs.length; i++) {
          var label = (tabs[i].textContent || "").trim().toLowerCase();
          if (chatIdx === -1 && CHAT_VIEW_LABELS.indexOf(label) !== -1) chatIdx = i;
          if (activeIdx === -1 && tabs[i].getAttribute("aria-selected") === "true") activeIdx = i;
        }
        if (activeIdx === -1) return true; // no explicit selection -> assume chat
        if (chatIdx === -1) chatIdx = 0; // chat is order 0 -> the first tab
        return activeIdx === chatIdx;
      } catch (e) {
        return true;
      }
    }

    // ---- search keyword highlight in the conversation ----
    var highlightSpans = [];

    function clearHighlights() {
      for (var i = 0; i < highlightSpans.length; i++) {
        var s = highlightSpans[i];
        if (s.parentNode) {
          var t = document.createTextNode(s.textContent);
          s.parentNode.replaceChild(t, s);
        }
      }
      highlightSpans = [];
    }

    // wrap every occurrence of q (case-insensitive) inside row's text nodes;
    // the occurrence at `currentOcc` gets a distinct "current" highlight
    function highlightRow(row, q, currentOcc) {
      if (!row || !q) return;
      var walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT, null);
      var textNodes = [];
      while (walker.nextNode()) textNodes.push(walker.currentNode);
      var occ = 0;
      for (var i = 0; i < textNodes.length; i++) {
        var node = textNodes[i];
        var text = node.nodeValue;
        if (!text) continue;
        var lower = text.toLowerCase();
        if (lower.indexOf(q) < 0) continue;
        var frag = document.createDocumentFragment();
        // EVERY occurrence inside this text node must be wrapped, in order: the
        // caller addresses hits by their global index (`occ`), which is counted
        // over the message text. Wrapping only the first one per text node made
        // a second hit on the same line un-markable, so stepping to it found no
        // `.dqt-current` and fell back to a plain scroll with no highlight.
        var from = 0;
        var idx = lower.indexOf(q, from);
        while (idx !== -1) {
          var before = text.slice(from, idx);
          if (before) frag.appendChild(document.createTextNode(before));
          var mark = document.createElement("span");
          if (occ === currentOcc) {
            mark.className = "dqt-current";
            mark.style.background = "rgba(79,140,255,0.55)";
            mark.style.boxShadow = "0 0 0 1px rgba(79,140,255,0.85)";
          } else {
            mark.style.background = "rgba(79,140,255,0.32)";
          }
          mark.style.borderRadius = "2px";
          mark.style.color = "inherit";
          mark.textContent = text.slice(idx, idx + q.length);
          frag.appendChild(mark);
          highlightSpans.push(mark);
          occ++;
          from = idx + q.length;
          idx = lower.indexOf(q, from);
        }
        var after = text.slice(from);
        if (after) frag.appendChild(document.createTextNode(after));
        node.parentNode.replaceChild(frag, node);
      }
    }

    // ---------- theme colors: DSH CSS variables (adapt to light/dark) ----------
    var C = {
      panelBg: "var(--dsw-alias-bg-base, rgba(24, 28, 36, 0.96))",
      panelBorder: "var(--dsw-alias-border-l2, rgba(128, 128, 128, 0.25))",
      text: "var(--dsw-alias-label-primary, #e8eaee)",
      muted: "var(--dsw-alias-label-secondary, #9aa0ab)",
      accent: "var(--dsw-alias-brand-primary, #4f8cff)",
      hover: "var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.08))",
      chip: "rgba(79, 140, 255, 0.18)"
    };

    // ---- theme scheme detection (for the panel's 3D inner shadow) ----
    // Prefer a positive dark signal from the OS preference, then DSH's theme
    // attribute/class, then the --dsw-alias-bg-base luminance as a last resort.
    // Failed-open to light so a light card never gets a dark inner shadow by
    // mistake; the caller flips to the white bevel only on a confident dark read.
    function isDarkScheme() {
      try {
        // DSH's authoritative dark marker: <body data-ds-dark-theme> is set when
        // the dark scheme is active (system OR manual). Check it first.
        var body = document.body;
        if (body) {
          if (body.hasAttribute && body.hasAttribute("data-ds-dark-theme")) return true;
          var cls = body.className || "";
          if (/dark|theme-dark/i.test(cls)) return true;
          var attr = (body.getAttribute("data-theme") || body.getAttribute("data-color-scheme") || "").toLowerCase();
          if (attr === "dark" || /dark/.test(attr)) return true;
        }
        if (typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches) return true;
        var root = body || document.documentElement;
        var cs = getComputedStyle(root).colorScheme;
        if (typeof cs === "string" && /dark/i.test(cs)) return true;
        var v = getComputedStyle(root).getPropertyValue("--dsw-alias-bg-base");
        var m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(v);
        if (m) return (Number(m[1]) + Number(m[2]) + Number(m[3])) < 384;
      } catch (e) {}
      return false;
    }
    // Inner shadow: computed per-render (not once) so it follows the live theme.
    // Dark scheme -> soft WHITE bevel (recessed card highlight); light -> soft
    // dark shade. Outer shadow stays off (clip-path would clip it).
    function innerShadow() {
      return isDarkScheme()
        ? "inset 0 0 0 1px rgba(255,255,255,0.16), inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -10px 16px rgba(255,255,255,0.08)"
        : "inset 0 0 0 1px rgba(0,0,0,0.08), inset 0 2px 10px rgba(0,0,0,0.18)";
    }

    // ---------- error boundary ----------
    var ErrorBoundary = (function () {
      if (!react.Component) return function (p) { return p.children; };
      function EB(props) {
        this.props = props;
        this.state = { err: null };
      }
      EB.prototype = Object.create(react.Component.prototype);
      EB.prototype.constructor = EB;
      EB.getDerivedStateFromError = function (e) { return { err: e }; };
      EB.prototype.componentDidCatch = function (e) { console.error("[dsh-quick-toc] render error:", e); };
      EB.prototype.render = function () {
        if (this.state.err) {
          var msg = this.state.err && this.state.err.message ? this.state.err.message : String(this.state.err);
          return react_jsx_runtime.jsx("div", {
            style: {
              position: "fixed",
              top: 80,
              right: 16,
              zIndex: Z_BASE + 1,
              background: "rgba(120,30,30,0.95)",
              border: "1px solid rgba(255,120,120,0.4)",
              color: "#ffdada",
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 12,
              maxWidth: 340,
              wordBreak: "break-all"
            },
            children: "dsh-quick-toc 面板出错: " + msg
          });
        }
        return this.props.children;
      };
      return EB;
    })();

    // ---------- component ----------
    function OutlinePanel(props) {
      // Recent DSH (0.1.5-rc.1): the conversation moved out of the session snapshot —
      // it is now the session-scope `chat` hook (ChatSnapshot: order + nodes
      // map + legacy projection), contributed by dsh-client-ui-chat. Same node
      // shape as before (kind user/assistant-step, location.turn, data.blocks).
      var useChat = props.useChat;
      if (!useChat) {
        console.warn("[dsh-quick-toc] useChat prop missing (requires DSH >= 0.1.5-rc.1)");
        return null;
      }
      var order = useChat(function (s) { return s.order; });
      var nodes = useChat(function (s) { return s.nodes; });

      // ---- hooks (ALL before any conditional return) ----
      // collapsed by default; user expands via the edge handle (default dock: left)
      var _s1 = react.useState(false);
      var open = _s1[0];
      var setOpen = _s1[1];

      // conversation area measurement
      var _s2 = react.useState(null);
      var viewport = _s2[0];
      var setViewport = _s2[1];
      react.useEffect(function () {
        var compute = function () {
          var sp = document.querySelector("[data-conversation-scroll]");
          if (sp) {
            var r = sp.getBoundingClientRect();
            setViewport({ left: r.left, right: window.innerWidth - r.right, top: r.top, height: r.height });
          }
        };
        compute();
        window.addEventListener("resize", compute);
        var sp = document.querySelector("[data-conversation-scroll]");
        var obs = null;
        if (typeof ResizeObserver !== "undefined" && sp) {
          obs = new ResizeObserver(compute);
          obs.observe(sp);
        }
        return function () {
          window.removeEventListener("resize", compute);
          if (obs) obs.disconnect();
        };
      }, []);

      // dock side: 'left' | 'right' (persisted; migrates old dsh-contents /
      // dsh-dagang keys, default left)
      var DOCK_KEY = "dsh-quick-toc.dock.v2";
      var OLD_DOCK_KEYS = ["dsh-contents.dock.v2", "dsh-dagang.dock.v2"];
      var _s3 = react.useState(function () {
        try {
          var d = localStorage.getItem(DOCK_KEY);
          if (d === "left" || d === "right") return d;
          for (var oi = 0; oi < OLD_DOCK_KEYS.length; oi++) {
            var old = localStorage.getItem(OLD_DOCK_KEYS[oi]);
            if (old === "left" || old === "right") { localStorage.setItem(DOCK_KEY, old); return old; }
          }
        } catch (e) {}
        return "left";
      });
      var dock = _s3[0];
      var setDock = _s3[1];
      var toggleDock = function () {
        var next = dock === "right" ? "left" : "right";
        setDock(next);
        try { localStorage.setItem(DOCK_KEY, next); } catch (e) {}
      };

      // vertical drag offset (persisted; migrates old dsh-contents / dsh-dagang keys)
      var PANEL_Y_KEY = "dsh-quick-toc.panelY.v1";
      var OLD_PANEL_Y_KEYS = ["dsh-contents.panelY.v1", "dsh-dagang.panelY.v1"];
      var _s4 = react.useState(function () {
        try {
          var v = localStorage.getItem(PANEL_Y_KEY);
          if (v !== null && isFinite(Number(v))) return Number(v);
          for (var oi = 0; oi < OLD_PANEL_Y_KEYS.length; oi++) {
            var old = localStorage.getItem(OLD_PANEL_Y_KEYS[oi]);
            if (old !== null && isFinite(Number(old))) { localStorage.setItem(PANEL_Y_KEY, old); return Number(old); }
          }
        } catch (e) {}
        return 0;
      });
      var panelY = _s4[0];
      var setPanelY = _s4[1];
      var handleRef = react.useRef(null);      // panel top drag bar
      var edgeRef = react.useRef(null);        // edge collapse handle

      // handle reveal: after the panel fully slides away, the handle fades+pops in
      var _s5 = react.useState(false);
      var handleShown = _s5[0];
      var setHandleShown = _s5[1];
      react.useEffect(function () {
        if (!open) {
          setHandleShown(false);
          var t = setTimeout(function () { setHandleShown(true); }, 300); // right after the panel slides away
          return function () { clearTimeout(t); };
        }
        setHandleShown(false);
      }, [open]);
      // panel hover: clear when mouse inside, transparent when outside
      var _s6 = react.useState(false);
      var hovered = _s6[0];
      var setHovered = _s6[1];

      // panel size (persisted; width default 288, height 0 = auto)
      var PANEL_W_KEY = "dsh-quick-toc.panelW.v1";
      var PANEL_H_KEY = "dsh-quick-toc.panelH.v1";
      var _s7 = react.useState(function () {
        try { var w = Number(localStorage.getItem(PANEL_W_KEY)); if (isFinite(w) && w >= 180) return w; } catch (e) {}
        return PANEL_WIDTH;
      });
      var panelW = _s7[0];
      var setPanelW = _s7[1];
      var _s8 = react.useState(function () {
        try { var h = Number(localStorage.getItem(PANEL_H_KEY)); if (isFinite(h) && h >= 160) return h; } catch (e) {}
        return 0;
      });
      var panelH = _s8[0];
      var setPanelH = _s8[1];

      // ---- heading level filter (persisted) ----
      // An arbitrary SET of levels, not a "show up to N" prefix: every chip is an
      // independent on/off switch, so H1 + H3 without H2 is a valid view. Turning
      // the last remaining level off restores all six (the panel is never empty).
      var LEVELS_KEY = "dsh-quick-toc.levels.v1";
      var OLD_MAX_LEVEL_KEY = "dsh-quick-toc.maxLevel.v1";
      var ALL_LEVELS = [1, 2, 3, 4, 5, 6];
      var _sLv = react.useState(function () {
        try {
          var raw = localStorage.getItem(LEVELS_KEY);
          if (raw !== null) {
            var arr = JSON.parse(raw);
            if (Array.isArray(arr)) {
              var kept = ALL_LEVELS.filter(function (lv) { return arr.indexOf(lv) !== -1; });
              if (kept.length > 0) return kept;
            }
          }
          // migrate the "show up to N" value written by earlier builds
          var v = Number(localStorage.getItem(OLD_MAX_LEVEL_KEY));
          if (isFinite(v) && v >= 1 && v <= 6) {
            return ALL_LEVELS.filter(function (lv) { return lv <= v; });
          }
        } catch (e) {}
        return ALL_LEVELS.slice();
      });
      var levels = _sLv[0];
      var setLevels = _sLv[1];
      var levelSet = react.useMemo(function () {
        var m = {};
        for (var i = 0; i < levels.length; i++) m[levels[i]] = true;
        return m;
      }, [levels]);
      var toggleLevel = function (lv) {
        var next;
        if (levelSet[lv]) {
          next = levels.filter(function (x) { return x !== lv; });
          if (next.length === 0) next = ALL_LEVELS.slice(); // never leave the panel empty
        } else {
          next = ALL_LEVELS.filter(function (x) { return x === lv || levelSet[x]; });
        }
        setLevels(next);
        try { localStorage.setItem(LEVELS_KEY, JSON.stringify(next)); } catch (e) {}
      };

      // ---- heading-level picker popup (transient): opens from the round button
      // next to the search button; closes on an outside pointerdown. Closing
      // plays a short shrink-back animation before unmounting. ----
      var _sLo = react.useState(false);
      var levelsOpen = _sLo[0];
      var setLevelsOpen = _sLo[1];
      var _sLc = react.useState(false);
      var levelsClosing = _sLc[0];
      var setLevelsClosing = _sLc[1];
      var closeLevels = function () {
        if (!levelsOpen || levelsClosing) return;
        setLevelsClosing(true);
        // unmount when the exit animation actually finishes (fallback timer in
        // case animationend never fires, e.g. display:none ancestors)
        var popped = document.querySelector(".dqt-levels-pop");
        var done = false;
        var finish = function () {
          if (done) return;
          done = true;
          if (popped && popped.removeEventListener) popped.removeEventListener("animationend", finish);
          setLevelsOpen(false);
          setLevelsClosing(false);
        };
        if (popped && popped.addEventListener) popped.addEventListener("animationend", finish);
        setTimeout(finish, 220);
      };
      react.useEffect(function () {
        if (!levelsOpen) return;
        var close = function (e) {
          var t = e.target;
          if (t && t.closest && (t.closest(".dqt-levels-pop") || t.closest(".dqt-levels-btn"))) return;
          closeLevels();
        };
        document.addEventListener("pointerdown", close);
        return function () { document.removeEventListener("pointerdown", close); };
      }, [levelsOpen, levelsClosing]);


      // ---- pagination: show the latest N groups; scrolling to the top loads older ----
      var PAGE_SIZE = 6;
      var _s9 = react.useState(PAGE_SIZE);
      var visibleCount = _s9[0];
      var setVisibleCount = _s9[1];
      var listRef = react.useRef(null);
      var didInitScroll = react.useRef(false);
      var outlineTouchRef = react.useRef(0); // last time the user touched the outline

      // ---- the outline belongs to the CHAT view only: when the center column
      // switches to another view (trajectory / context / plugin views), fade the
      // panel and its collapsed handle out. Polled lightly because view switches
      // are user clicks and the tab DOM is remounted on session/view changes.
      var _sView = react.useState(true);
      var chatViewActive = _sView[0];
      var setChatViewActive = _sView[1];
      var chatViewRef = react.useRef(true);
      // True briefly after a view switch: lets the fade use its own fast
      // transition instead of the slower dock/collapse one.
      var _sFade = react.useState(false);
      var viewFading = _sFade[0];
      var setViewFading = _sFade[1];
      var viewFadeTimerRef = react.useRef(null);
      react.useEffect(function () {
        var detect = function () {
          var v = isChatViewActive();
          if (v !== chatViewRef.current) {
            chatViewRef.current = v;
            setChatViewActive(v);
            setViewFading(true);
            if (viewFadeTimerRef.current) clearTimeout(viewFadeTimerRef.current);
            viewFadeTimerRef.current = setTimeout(function () { setViewFading(false); }, 380);
          }
        };
        detect();
        var timer = setInterval(detect, 120);
        return function () {
          clearInterval(timer);
          if (viewFadeTimerRef.current) clearTimeout(viewFadeTimerRef.current);
        };
      }, []);

      // ---- search: header button opens a keyword box; Enter cycles through
      // matching headings and jumps to each ----
      var _s13 = react.useState(false);
      var searchOpen = _s13[0];
      var setSearchOpen = _s13[1];
      var _s14 = react.useState("");
      var query = _s14[0];
      var setQuery = _s14[1];
      var _s15 = react.useState(0);
      var matchIdx = _s15[0];
      var setMatchIdx = _s15[1];
      var searchRef = react.useRef(null);
      // animation state: hidden | enter | shown | out; and a transient
      // "searching" flag that drives the spinner
      var _s16 = react.useState("hidden");
      var searchAnim = _s16[0];
      var setSearchAnim = _s16[1];
      var _s17 = react.useState(false);
      var searching = _s17[0];
      var setSearching = _s17[1];
      var searchTimerRef = react.useRef(null);
      // search scope: "title" (default) or "full" (user messages + AI replies)
      var _s18 = react.useState("title");
      var searchScope = _s18[0];
      var setSearchScope = _s18[1];
      // previous scope kept briefly so the old label cross-fades with the new one
      var _s19 = react.useState(null);
      var prevScope = _s19[0];
      var setPrevScope = _s19[1];
      var scopeTimerRef = react.useRef(null);
      var toggleScope = function () {
        setPrevScope(searchScope);
        setSearchScope(searchScope === "title" ? "full" : "title");
        setMatchIdx(0);
        if (scopeTimerRef.current) clearTimeout(scopeTimerRef.current);
        scopeTimerRef.current = setTimeout(function () { setPrevScope(null); }, 300);
      };
      var openSearch = function () {
        setSearchOpen(true);
        setSearchAnim("enter");
      };
      var closeSearch = function () {
        setSearchAnim("out");
        setQuery("");
        clearHighlights();
        setTimeout(function () {
          setSearchOpen(false);
          setSearchAnim("hidden");
        }, 240);
      };
      react.useEffect(function () {
        if (searchAnim === "enter") {
          var raf = requestAnimationFrame(function () { setSearchAnim("shown"); });
          return function () { cancelAnimationFrame(raf); };
        }
        return undefined;
      }, [searchAnim]);
      react.useEffect(function () {
        if (searchOpen && searchRef.current) searchRef.current.focus();
      }, [searchOpen]);
      var onQueryChange = function (v) {
        setQuery(v);
        setMatchIdx(0);
        setSearching(true);
        clearHighlights();
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        searchTimerRef.current = setTimeout(function () { setSearching(false); }, 220);
      };

      // the group currently being read (under the list viewport middle):
      // it stays at full opacity, every other group is dimmed
      var _s10 = react.useState([]);
      var activeGroup = _s10[0];
      var setActiveGroup = _s10[1];
      var activeSigRef = react.useRef("");

      // load older outline groups; when everything is loaded, click the
      // conversation's own "load older" button so older turns keep appearing
      var loadOlderOutline = function (el) {
        var grow = function () {
          if (visibleCount < groups.length) {
            var prevH = el.scrollHeight;
            setVisibleCount(Math.min(groups.length, visibleCount + PAGE_SIZE));
            requestAnimationFrame(function () {
              requestAnimationFrame(function () {
                el.scrollTop += (el.scrollHeight - prevH);
              });
            });
            return true;
          }
          return false;
        };
        if (grow()) return;
        var btn = findLoadOlderButton();
        if (btn && !btn.disabled) {
          btn.click();
          // once the conversation loads more, expand the outline window too
          setTimeout(function () {
            var prevH2 = el.scrollHeight;
            if (grow()) {
              requestAnimationFrame(function () {
                requestAnimationFrame(function () {
                  el.scrollTop += (el.scrollHeight - prevH2);
                });
              });
            }
          }, 1200);
        }
      };

      // wheel up (toward older) loads more when the list is at its top or has
      // nothing to scroll (content shorter than the panel) — so scrolling up
      // always refreshes older turns, even without a visible scrollbar
      var onListWheel = function (e) {
        outlineTouchRef.current = Date.now();
        if (e.deltaY >= 0) return;
        var el = listRef.current;
        if (!el) return;
        if (el.scrollTop <= 1) loadOlderOutline(el);
      };

      // scroll to the top edge also loads older groups (keeps the visual position)
      var onListScroll = function (e) {
        outlineTouchRef.current = Date.now();
        var el = e.currentTarget;
        if (el.scrollTop <= 24) loadOlderOutline(el);
      };

      // ---- resize drags (right edge = width, bottom edge = height) ----
      var onResizeWDown = function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (e.button !== 0) return;
        var startX = e.clientX;
        var startW = panelW;
        var lastW = panelW;
        var move = function (ev) {
          var next = Math.max(180, Math.min(560, startW + (ev.clientX - startX)));
          lastW = next;
          setPanelW(next);
        };
        var up = function () {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
          try { localStorage.setItem(PANEL_W_KEY, String(lastW)); } catch (e2) {}
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      };
      var onResizeHDown = function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (e.button !== 0) return;
        var startY = e.clientY;
        var startH = panelH > 0 ? panelH : 400;
        var lastH = startH;
        var move = function (ev) {
          var next = Math.max(160, Math.min(window.innerHeight - 60, startH + (ev.clientY - startY)));
          lastH = next;
          setPanelH(next);
        };
        var up = function () {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
          try { localStorage.setItem(PANEL_H_KEY, String(lastH)); } catch (e2) {}
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      };
      var onResizeCornerDown = function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (e.button !== 0) return;
        var startX = e.clientX;
        var startY = e.clientY;
        var startW = panelW;
        var startH = panelH > 0 ? panelH : 400;
        var lastW = startW;
        var lastH = startH;
        var move = function (ev) {
          var w = Math.max(180, Math.min(560, startW + (ev.clientX - startX)));
          var h = Math.max(160, Math.min(window.innerHeight - 60, startH + (ev.clientY - startY)));
          lastW = w;
          lastH = h;
          setPanelW(w);
          setPanelH(h);
        };
        var up = function () {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
          try {
            localStorage.setItem(PANEL_W_KEY, String(lastW));
            localStorage.setItem(PANEL_H_KEY, String(lastH));
          } catch (e2) {}
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      };

      // ---- node timestamp -> HH:MM (handles ms / s epochs / ISO strings) ----
      var fmtTime = function (t) {
        if (t === undefined || t === null) return "";
        if (typeof t === "string") {
          var d0 = new Date(t);
          if (isNaN(d0.getTime())) return "";
          var hh0 = ("0" + d0.getHours()).slice(-2);
          var mm0 = ("0" + d0.getMinutes()).slice(-2);
          return hh0 + ":" + mm0;
        }
        var n = Number(t);
        if (!isFinite(n) || n <= 0) return "";
        if (n < 1e12) n = n * 1000; // epoch seconds -> ms
        var d = new Date(n);
        if (isNaN(d.getTime())) return "";
        var hh = ("0" + d.getHours()).slice(-2);
        var mm = ("0" + d.getMinutes()).slice(-2);
        return hh + ":" + mm;
      };

      // ---- best-effort node time across common field names ----
      var getNodeTime = function (node) {
        var d = node && node.data;
        if (!d) return "";
        var t = d.time !== undefined ? d.time : (d.createdAt !== undefined ? d.createdAt : d.timestamp);
        return fmtTime(t);
      };

      // ---- group headings by conversation turn (node.location.turn) ----
      var groups = react.useMemo(function () {
        var result = [];
        var current = null;
        var turnTimes = {};
        var turnUserKey = {};
        var turnUserText = {};
        var turnUserFull = {};
        if (!order || !nodes) return result;
        var seen = {};
        // first pass: per-turn time — the LAST message of the turn wins (end time);
        // also remember each turn's user message key + first-line preview + full text
        for (var i = 0; i < order.length; i++) {
          var k0 = order[i];
          var n0 = nodes.get(k0);
          if (!n0 || (n0.kind !== "user" && n0.kind !== "assistant-step")) continue;
          var l0 = n0.location;
          var tid0 = l0 && (l0.kind === "turn" || l0.kind === "step") && l0.turn ? l0.turn.turn : null;
          if (tid0 === null) continue;
          seen[k0] = true;
          var info0 = nodeInfo(k0, n0);
          if (n0.kind === "user" && turnUserKey[tid0] === undefined) {
            turnUserKey[tid0] = k0;
            turnUserText[tid0] = previewText(info0.text, 30);
            turnUserFull[tid0] = info0.text;
          }
          var t0 = getNodeTime(n0);
          if (t0) turnTimes[tid0] = t0;
        }
        // second pass: group assistant headings + full reply texts by turn
        for (var j = 0; j < order.length; j++) {
          var key = order[j];
          var node = nodes.get(key);
          if (!node || node.kind !== "assistant-step") continue;
          var loc = node.location;
          var turnId = loc && (loc.kind === "turn" || loc.kind === "step") && loc.turn ? loc.turn.turn : null;
          var sameGroup = current !== null && current.turn === turnId;
          if (!sameGroup) {
            current = {
              turn: turnId,
              time: turnId !== null ? (turnTimes[turnId] || "") : "",
              userKey: turnId !== null ? (turnUserKey[turnId] || "") : "",
              userText: turnId !== null ? (turnUserText[turnId] || "") : "",
              userFull: turnId !== null ? (turnUserFull[turnId] || "") : "",
              msgs: [],
              headings: []
            };
            result.push(current);
          }
          seen[key] = true;
          var info = nodeInfo(key, node);
          current.msgs.push({ key: key, text: info.text });
          for (var k = 0; k < info.headings.length; k++) {
            current.headings.push({ level: info.headings[k].level, title: info.headings[k].title, key: key, idx: k });
          }
        }
        pruneNodeInfo(seen);
        // keep a turn when it has headings OR a time — turns without headings
        // still get a standalone time entry in the outline (click to jump)
        return result.filter(function (g) { return g.headings.length > 0 || g.time !== ""; });
      }, [order, nodes]);
      // first time content appears, scroll the list to the bottom (newest).
      // NOTE: must stay BELOW the `groups` memo — a deps array is evaluated
      // during render, so reading `groups` before that `var` is assigned would
      // freeze the deps at 0 and the effect would only ever run on mount.
      react.useEffect(function () {
        if (didInitScroll.current || !listRef.current || groups.length === 0) return;
        didInitScroll.current = true;
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }, [groups.length]);
      var groupTrees = react.useMemo(function () {
        return groups.map(function (g) {
          if (levels.length === 6) return buildTree(g.headings);
          var kept = [];
          for (var i = 0; i < g.headings.length; i++) {
            if (levelSet[g.headings[i].level]) kept.push(g.headings[i]);
          }
          return buildTree(kept);
        });
      }, [groups, levels, levelSet]);
      // pagination slice: the latest `visibleCount` groups
      var shownGroups = groups.slice(Math.max(0, groups.length - visibleCount));
      var shownTrees = groupTrees.slice(groupTrees.length - shownGroups.length);

      // the group currently being read (the turn under the middle of the
      // CONVERSATION viewport) stays bright in the outline; others are dimmed
      var keyToGroup = react.useMemo(function () {
        var m = {};
        for (var i = 0; i < groups.length; i++) {
          for (var j = 0; j < groups[i].headings.length; j++) {
            m[groups[i].headings[j].key] = i;
          }
        }
        return m;
      }, [groups]);

      // ancestor path of every heading occurrence (used by the search result rows):
      // id -> { path, title, level, gi }
      var headingPaths = react.useMemo(function () {
        var byId = {};
        var lastTitle = {};
        for (var gi = 0; gi < groups.length; gi++) {
          var g = groups[gi];
          for (var j = 0; j < g.headings.length; j++) {
            var h = g.headings[j];
            for (var deeper = h.level + 1; deeper <= 6; deeper++) lastTitle[deeper] = undefined;
            var parts = [];
            for (var up = 1; up < h.level; up++) {
              if (lastTitle[up]) parts.push(lastTitle[up]);
            }
            parts.push(h.title);
            byId[headingId(h)] = { path: parts.join(" › "), title: h.title, level: h.level, gi: gi };
            lastTitle[h.level] = h.title;
          }
        }
        return byId;
      }, [groups]);

      // search result rows: one row per matched heading/message (with an
      // occurrence count), carrying its heading path, turn time and a snippet.
      var resultRows = react.useMemo(function () {
        var q = query.trim().toLowerCase();
        if (!q) return [];
        var rows = [];
        var index = {};
        var push = function (row, n) {
          var id = row.key + "#" + (row.idx === undefined ? "-" : row.idx);
          var known = index[id];
          if (known !== undefined) { known.count += n; return; }
          row.count = n;
          index[id] = row;
          rows.push(row);
        };
        for (var gi = 0; gi < groups.length; gi++) {
          var g = groups[gi];
          for (var j = 0; j < g.headings.length; j++) {
            var h = g.headings[j];
            var nh = countOccurrences(h.title, q);
            if (nh > 0) {
              var hp = headingPaths[headingId(h)];
              push({
                gi: gi, key: h.key, idx: h.idx, title: h.title, level: h.level,
                path: hp ? hp.path : "", time: g.time, snippet: ""
              }, nh);
            }
          }
          if (searchScope === "full") {
            var nu = g.userKey && g.userFull ? countOccurrences(g.userFull, q) : 0;
            if (nu > 0) {
              push({
                gi: gi, key: g.userKey, idx: undefined, title: previewText(g.userFull, 40),
                level: 0, path: "", time: g.time, snippet: snippetAround(g.userFull, q, 36)
              }, nu);
            }
            for (var m = 0; m < g.msgs.length; m++) {
              var msg = g.msgs[m];
              if (!msg.text) continue;
              var nm = countOccurrences(msg.text, q);
              if (nm === 0) continue;
              push({
                gi: gi, key: msg.key, idx: undefined, title: previewText(msg.text, 40),
                level: 0, path: "", time: g.time, snippet: snippetAround(msg.text, q, 36)
              }, nm);
            }
          }
        }
        return rows;
      }, [groups, query, searchScope, headingPaths]);
      react.useEffect(function () {
        var sp = document.querySelector("[data-conversation-scroll]");
        if (!sp) return;
        var update = function () {
          var lr = sp.getBoundingClientRect();
          var vTop = lr.top;
          var vBottom = lr.top + lr.height;
          var rows = sp.querySelectorAll("[data-chat-anchor-key]");
          var actives = [];
          var seen = {};
          for (var i = 0; i < rows.length; i++) {
            var r = rows[i].getBoundingClientRect();
            if (r.top < vBottom && r.bottom > vTop) {
              var k = rows[i].dataset.chatAnchorKey;
              var gi = keyToGroup[k];
              if (gi !== undefined && !seen[gi]) { seen[gi] = true; actives.push(gi); }
            }
          }
          var sig = actives.slice().sort().join(",");
          if (sig !== activeSigRef.current) {
            activeSigRef.current = sig;
            setActiveGroup(actives);
            // auto-follow: keep the reading position visible in the outline —
            // but pause for ~2s after the user touches the outline themselves,
            // otherwise loading older turns gets yanked back to the bottom
            if (actives.length > 0 && Date.now() - outlineTouchRef.current > 2000) {
              var gi0 = actives[0];
              // ensure the group's window is loaded (with a small buffer below)
              setVisibleCount(function (prev) {
                var need = groups.length - gi0 + 3;
                return Math.max(prev, Math.min(groups.length, need));
              });
              var el = listRef.current;
              if (el) {
                setTimeout(function () {
                  var node = el.querySelector('[data-group-idx="' + gi0 + '"]');
                  if (!node) return;
                  var er = node.getBoundingClientRect();
                  var lr2 = el.getBoundingClientRect();
                  if (er.top < lr2.top - 2 || er.bottom > lr2.bottom + 2) {
                    el.scrollTo({ top: el.scrollTop + (er.top - lr2.top) - el.clientHeight / 2 + node.offsetHeight / 2, behavior: "smooth" });
                  }
                }, 120);
              }
            }
          }
        };
        update();
        sp.addEventListener("scroll", update, { passive: true });
        return function () { sp.removeEventListener("scroll", update); };
      }, [keyToGroup]);

      // ---- search matches ----
      // "title" scope: heading titles only; "full" scope: also the user
      // message and every AI reply text of each turn.
      // Every occurrence counts (multiple hits inside one message = multiple
      // matches), so the n/N counter reflects the real total.
      var matches = react.useMemo(function () {
        var q = query.trim().toLowerCase();
        if (!q) return [];
        var out = [];
        for (var gi = 0; gi < groups.length; gi++) {
          var g = groups[gi];
          for (var j = 0; j < g.headings.length; j++) {
            var h = g.headings[j];
            var n = countOccurrences(h.title, q);
            for (var c = 0; c < n; c++) {
              out.push({ gi: gi, title: h.title, key: h.key, idx: h.idx });
            }
          }
          if (searchScope === "full") {
            if (g.userKey && g.userFull) {
              var nu = countOccurrences(g.userFull, q);
              for (var cu = 0; cu < nu; cu++) {
                out.push({ gi: gi, title: previewText(g.userFull, 30), key: g.userKey, idx: undefined });
              }
            }
            for (var m = 0; m < g.msgs.length; m++) {
              var msg = g.msgs[m];
              if (!msg.text) continue;
              var nm = countOccurrences(msg.text, q);
              for (var cm = 0; cm < nm; cm++) {
                out.push({ gi: gi, title: previewText(msg.text, 30), key: msg.key, idx: undefined });
              }
            }
          }
        }
        return out;
      }, [groups, query, searchScope]);

      // which result row holds the current (n/N) occurrence (needs `matches`)
      var activeResultRow = -1;
      if (resultRows.length > 0 && matches.length > 0) {
        var acc = 0;
        var target = matchIdx % matches.length;
        for (var ri = 0; ri < resultRows.length; ri++) {
          acc += resultRows[ri].count;
          if (target < acc) { activeResultRow = ri; break; }
        }
      }

      // The result list follows the outline's convention: OLDEST hit at the top,
      // NEWEST at the bottom, and a fresh search starts scrolled to the bottom —
      // scroll UP from there to walk back through earlier hits. The newest hit is
      // also made the current one, so the highlighted row is the one on screen
      // (otherwise n/N points at a row that is off-view).
      var searchPosRef = react.useRef("");
      react.useEffect(function () {
        var q = query.trim();
        if (searchPosRef.current === q) return;
        searchPosRef.current = q;
        if (!q) return;
        var el = listRef.current;
        if (el) el.scrollTop = el.scrollHeight;
        if (matches.length > 0) setMatchIdx(matches.length - 1);
      }, [query, matches.length]);

      // keep the current row in view while stepping with Enter
      react.useEffect(function () {
        if (!query.trim() || activeResultRow < 0) return;
        var el = listRef.current;
        if (!el || !el.querySelector) return;
        var node = el.querySelector('[data-result-idx="' + activeResultRow + '"]');
        if (!node) return;
        var er = node.getBoundingClientRect();
        var lr2 = el.getBoundingClientRect();
        if (er.top < lr2.top + 2) el.scrollTop += er.top - lr2.top - 2;
        else if (er.bottom > lr2.bottom - 2) el.scrollTop += er.bottom - lr2.bottom + 2;
      }, [activeResultRow, query]);

      // ---- nothing to show without headings ----
      if (groups.length === 0) return null;

      // ---- geometry: always position by `left` (px) so dock-switch & slide share one animated transition
      var dockRight = dock === "right";
      var panelLeft;
      if (dockRight) {
        // RIGHT dock: keep the panel's VISIBLE right edge pinned at the SAME
        // line when collapsed as when expanded (the expand edge is correct).
        // open:   left = openRight,           visible right edge = openRight+panelW
        // closed: left = openRight + panelW,  clip-right panelW hides it fully,
        //         so the visible right edge stays at openRight+panelW -> the
        //         collapse shrinks toward that line and vanishes exactly there.
        var openRight = window.innerWidth - (viewport ? viewport.right + 48 : 60) - panelW;
        panelLeft = open ? openRight : (openRight + panelW);
      } else if (open) {
        // LEFT dock open (left dock is the confirmed-correct reference — untouched)
        panelLeft = (viewport ? viewport.left + 8 : 8);
      } else {
        panelLeft = (viewport ? viewport.left - panelW - 8 : -(panelW + 48));
      }
      var vMaxH = viewport ? Math.max(200, viewport.height - 28) : "72vh";
      var baseTopPx = (viewport ? viewport.top + 14 : window.innerHeight * 0.12) + panelY;

      // ---- panel top drag bar ----
      var onHandleDown = function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (e.button !== 0) return;
        var startY = e.clientY;
        var origY = panelY;
        var lastY = panelY;
        var move = function (ev) {
          var next = origY + (ev.clientY - startY);
          next = Math.max(-(viewport ? viewport.top : 0), Math.min(window.innerHeight - 90, next));
          lastY = next;
          setPanelY(next);
        };
        var up = function () {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
          // persist the DRAGGED value: `panelY` here is the value captured when
          // the drag started (the state setter has not re-rendered this closure)
          try { localStorage.setItem(PANEL_Y_KEY, String(lastY)); } catch (e2) {}
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      };
      var handleBright = function (on) {
        if (handleRef.current) handleRef.current.style.opacity = on ? "1" : "0.35";
      };

      // ---- jump: smooth glide to the exact heading element. When glued to the
      // bottom, lift just past DSH's 25px stick-to-bottom threshold first so
      // the glide is not yanked back. ----
      var jump = function (key, idx) {
        var row = findRow(key);
        if (!row) return;
        var el = row;
        if (idx !== undefined && idx !== null) {
          var hs = row.querySelectorAll("h1, h2, h3, h4, h5, h6");
          if (hs.length > 0) el = hs[Math.min(idx, hs.length - 1)] || row;
        }
        var sp = row.closest ? row.closest("[data-conversation-scroll]") : null;
        if (!sp) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
        var t = el.getBoundingClientRect().top - sp.getBoundingClientRect().top + sp.scrollTop - 20;
        var floor = Math.max(0, sp.scrollHeight - sp.clientHeight);
        if (floor - sp.scrollTop <= 25 && Math.abs(t - sp.scrollTop) > 60) {
          sp.scrollTop = Math.max(0, floor - 26);
        }
        sp.scrollTo({ top: t, behavior: "smooth" });
      };

      // jump to the n-th match, cycling; also reveal the group in the outline.
      // ONE smooth scroll straight to the current occurrence (no competing
      // scrolls): highlight first, then position the mark at the upper-middle
      var goToMatch = function (n) {
        if (matches.length === 0) return;
        var i = ((n % matches.length) + matches.length) % matches.length;
        setMatchIdx(i);
        var m = matches[i];
        var q = query.trim().toLowerCase();
        clearHighlights();
        var r = findRowStrict(m.key);
        if (r && q) {
          // occurrence index within the target message (consecutive in matches)
          var occ = 0;
          for (var p = i - 1; p >= 0 && matches[p].key === m.key; p--) occ++;
          highlightRow(r, q, occ);
          var markEl = r.querySelector(".dqt-current");
          var sp = r.closest ? r.closest("[data-conversation-scroll]") : null;
          if (sp && markEl) {
            var target = markEl.getBoundingClientRect().top - sp.getBoundingClientRect().top + sp.scrollTop - sp.clientHeight * 0.35;
            // stick-to-bottom nudge (same as jump): break the 25px floor hold
            var floor = Math.max(0, sp.scrollHeight - sp.clientHeight);
            if (floor - sp.scrollTop <= 25 && Math.abs(target - sp.scrollTop) > 60) {
              sp.scrollTop = Math.max(0, floor - 26);
            }
            sp.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
          } else {
            jump(m.key, m.idx);
          }
        } else {
          jump(m.key, m.idx);
        }
        setVisibleCount(function (prev) {
          return Math.max(prev, Math.min(groups.length, groups.length - m.gi));
        });
        setTimeout(function () {
          var el = listRef.current;
          if (!el) return;
          var node = el.querySelector('[data-group-idx="' + m.gi + '"]');
          if (node) node.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }, 150);
      };

      // clicking result row `i` = make its FIRST occurrence the current match, so
      // it highlights + scrolls exactly like Enter stepping does (rows are deduped
      // one-per-message, so row i starts at the sum of the previous rows' counts)
      var goToRow = function (i) {
        var start = 0;
        for (var k = 0; k < i && k < resultRows.length; k++) start += resultRows[k].count;
        goToMatch(start);
      };

      // ---- circular icon button (glyph optical offset: ox/oy px) ----
      var iconBtn = function (onClick, tip, glyph, fontSize, offset) {
        var ox = offset ? (offset.x || 0) : 0;
        var oy = offset ? (offset.y || 0) : 0;
        return react_jsx_runtime.jsx("button", {
          onClick: onClick,
          style: {
            width: 24,
            height: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "50%",
            cornerShape: "round",
            background: "var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,0.16))",
            border: "none",
            color: C.muted,
            cursor: "pointer",
            fontSize: fontSize || 13,
            lineHeight: "1",
            padding: 0,
            flex: "none",
            transition: "background 0.18s ease, color 0.18s ease"
          },
          title: tip,
          onMouseEnter: function (e) {
            e.currentTarget.style.background = "var(--dsw-alias-interactive-bg-active, rgba(79,140,255,0.24))";
            e.currentTarget.style.color = "var(--dsw-alias-brand-primary, #4f8cff)";
          },
          onMouseLeave: function (e) {
            e.currentTarget.style.background = "var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,0.16))";
            e.currentTarget.style.color = C.muted;
          },
          children: react_jsx_runtime.jsx("span", {
            style: {
              display: "inline-block",
              lineHeight: 1,
              transform: "translate(" + ox + "px," + oy + "px)"
            },
            children: glyph
          })
        });
      };

      // ---- panel ----
      // panel: opening slides in with a slow fade; closing slides quickly to
      // the dock edge, clipped by the sidebar line (looks covered, not
      // dissolving) and only fades at the very end. No box-shadow: a shadow
      // would get cut in half by the clip-path, so the panel is flat.
      var panelTransition = open
        ? "left 0.6s " + EASE + ", clip-path 0.6s " + EASE + ", opacity 0.45s ease"
        : "left 0.28s " + EASE + ", clip-path 0.28s " + EASE + ", opacity 0.14s ease 0.26s";

      // clip the panel at the dock edge while collapsed, so sliding away looks
      // like being covered by the sidebar (the sidebar stays untouched):
      //  left dock  -> clipped from the left up to the sidebar line
      //  right dock -> clipped from the right at the screen/sidebar line
      // LEFT dock keeps its original clip (collapse left). RIGHT dock clips the
      // LEFT side so the panel closes toward its right (dock) edge in place.
      var panelClip = "inset(0 0 0 0px)";
      if (!open) {
        if (dockRight) {
          // mirror of LEFT: clip the RIGHT side (panel flies right, shrinking from its right)
          panelClip = "inset(0 " + panelW + "px 0 0)";
        } else {
          panelClip = "inset(0 0 0 " + (panelW + 8) + "px)";
        }
      }
      // faded out entirely while another center-column view is active
      var panelOpacity = open && chatViewActive ? (hovered ? 0.95 : 0.45) : 0;

      var panelEl = react_jsx_runtime.jsx("div", {
        style: {
          position: "fixed",
          top: baseTopPx + "px",
          left: panelLeft + "px",
          width: panelW + "px",
          maxHeight: vMaxH,
          height: panelH > 0 ? panelH + "px" : undefined,
          display: "flex",
          flexDirection: "column",
          background: C.panelBg,
          border: "none",
          borderRadius: 12,
          zIndex: Z_BASE,
          overflow: "hidden",
          color: C.text,
          opacity: panelOpacity,
          clipPath: panelClip,
          // inner shadow only (no outer): theme-aware (white bevel in dark mode,
          // soft shade in light) — outer shadow would be clipped by the collapse
          // clip-path and the panel edges.
          boxShadow: innerShadow(),
          // A view switch swaps in a short, delay-free opacity fade; the dock and
          // collapse animations keep their own (slower) timings.
          transition: viewFading ? "opacity 0.3s ease" : panelTransition,
          pointerEvents: chatViewActive ? "auto" : "none"
        },
        onMouseEnter: function () { setHovered(true); },
        onMouseLeave: function () { setHovered(false); },
        onClickCapture: function (e) {
          // jump handled in the capture phase (bubble-phase handlers are unreliable here)
          var t = e.target;
          var item = (t && t.closest) ? t.closest("[data-jump-key]") : null;
          if (item && item.dataset && item.dataset.jumpKey) {
            e.preventDefault();
            e.stopPropagation();
            var idx = item.dataset.jumpIdx !== undefined ? Number(item.dataset.jumpIdx) : 0;
            jump(item.dataset.jumpKey, idx);
          }
        },
        children: [
          // top block: small grip bar on top + header row below (whole block draggable)
          react_jsx_runtime.jsx("div", {
            style: {
              flex: "none",
              cursor: "grab",
              userSelect: "none"
            },
            title: "按住拖动调整位置",
            onPointerDown: onHandleDown,
            onMouseEnter: function () { handleBright(true); },
            onMouseLeave: function () { handleBright(false); },
            children: [
              react_jsx_runtime.jsx("div", {
                ref: handleRef,
                style: {
                  width: 56,
                  height: 5,
                  borderRadius: 999,
                  cornerShape: "round",
                  background: "var(--dsw-alias-border-l2, rgba(128,128,128,0.55))",
                  opacity: 0.35,
                  transition: "opacity 0.2s ease",
                  margin: "5px auto 2px"
                }
              }),
              react_jsx_runtime.jsx("div", {
                style: {
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "1px 10px 5px",
                  borderBottom: "1px solid " + C.panelBorder,
                  fontSize: 13,
                  fontWeight: 600,
                  gap: 6
                },
                children: [
                  // three-bar outline mark (long / medium / short) — no title text
                  react_jsx_runtime.jsx("div", {
                    style: { display: "flex", alignItems: "center", color: C.muted, flex: "none" },
                    title: "对话大纲",
                    children: react_jsx_runtime.jsx("svg", {
                      width: 18,
                      height: 14,
                      viewBox: "0 0 18 14",
                      style: { display: "block" },
                      children: [
                        react_jsx_runtime.jsx("line", { x1: 0, y1: 2, x2: 18, y2: 2, stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" }),
                        react_jsx_runtime.jsx("line", { x1: 0, y1: 7, x2: 12, y2: 7, stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" }),
                        react_jsx_runtime.jsx("line", { x1: 0, y1: 12, x2: 6, y2: 12, stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" })
                      ]
                    })
                  }),
                  react_jsx_runtime.jsx("div", {
                    style: { display: "flex", alignItems: "center", gap: 6, flex: "none" },
                    children: [
                      // heading-level filter: a round icon button (directly left
                      // of the search button) that pops down the H1–H6 picker.
                      // Icon: three lines of decreasing width = outline levels.
                      // Hover behaviour matches the magnifier: background + icon
                      // tint change; the resting look never shifts when open.
                      react_jsx_runtime.jsx("button", {
                        className: "dqt-levels-btn",
                        onClick: function () { levelsOpen ? closeLevels() : setLevelsOpen(true); },
                        title: "标题层级筛选",
                        style: {
                          width: 24,
                          height: 24,
                          padding: 0,
                          border: "none",
                          borderRadius: "50%",
                          cornerShape: "round",
                          cursor: "pointer",
                          flex: "none",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,0.16))",
                          color: C.muted,
                          transition: "background 0.15s ease, color 0.15s ease"
                        },
                        onMouseEnter: function (e) {
                          e.currentTarget.style.background = "var(--dsw-alias-interactive-bg-active, rgba(79,140,255,0.24))";
                          e.currentTarget.style.color = "var(--dsw-alias-brand-primary, #4f8cff)";
                        },
                        onMouseLeave: function (e) {
                          e.currentTarget.style.background = "var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,0.16))";
                          e.currentTarget.style.color = C.muted;
                        },
                        children: react_jsx_runtime.jsx("svg", {
                          width: 14,
                          height: 14,
                          viewBox: "0 0 14 14",
                          fill: "none",
                          stroke: "currentColor",
                          strokeWidth: 1.8,
                          strokeLinecap: "round",
                          style: { display: "block" },
                          children: [
                            react_jsx_runtime.jsx("line", { x1: 1.5, y1: 3, x2: 12.5, y2: 3 }),
                            react_jsx_runtime.jsx("line", { x1: 1.5, y1: 7, x2: 9, y2: 7 }),
                            react_jsx_runtime.jsx("line", { x1: 1.5, y1: 11, x2: 5.5, y2: 11 })
                          ]
                        })
                      }),
                      // magnifier button (SVG, matches the other buttons' style)
                      react_jsx_runtime.jsx("button", {
                        onClick: function () { searchOpen ? closeSearch() : openSearch(); },
                        title: "搜索标题",
                        style: {
                          width: 24,
                          height: 24,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: "50%",
                          cornerShape: "round",
                          background: "var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,0.16))",
                          border: "none",
                          color: C.muted,
                          cursor: "pointer"
                        },
                        onMouseEnter: function (e) {
                          e.currentTarget.style.background = "var(--dsw-alias-interactive-bg-active, rgba(79,140,255,0.24))";
                          e.currentTarget.style.color = "var(--dsw-alias-brand-primary, #4f8cff)";
                        },
                        onMouseLeave: function (e) {
                          e.currentTarget.style.background = "var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,0.16))";
                          e.currentTarget.style.color = C.muted;
                        },
                        children: react_jsx_runtime.jsx("svg", {
                          width: 15,
                          height: 15,
                          viewBox: "0 0 24 24",
                          // overflow visible: the stroke may extend past the
                          // viewBox without being clipped at the svg boundary
                          style: { display: "block", transform: "translate(-1px, -1px)", overflow: "visible" },
                          fill: "none",
                          stroke: "currentColor",
                          strokeWidth: 3.6,
                          strokeLinecap: "round",
                          children: [
                            react_jsx_runtime.jsx("circle", { cx: 11, cy: 11, r: 7 }),
                            react_jsx_runtime.jsx("line", { x1: 21, y1: 21, x2: 16, y2: 16 })
                          ]
                        })
                      }),
                      // triangle tips toward the side it will move TO: shift slightly up + toward the tip
                      iconBtn(toggleDock, dockRight ? "移到左侧" : "移到右侧", dockRight ? "◀" : "▶", 12, dockRight ? { x: -1, y: -1 } : { x: 1, y: -1 }),
                      // close: thick SVG cross, nudged slightly down
                      react_jsx_runtime.jsx("button", {
                        onClick: function () { setOpen(false); },
                        title: "收起",
                        style: {
                          width: 24,
                          height: 24,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: "50%",
                          cornerShape: "round",
                          background: "var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,0.16))",
                          border: "none",
                          color: C.muted,
                          cursor: "pointer"
                        },
                        onMouseEnter: function (e) {
                          e.currentTarget.style.background = "var(--dsw-alias-interactive-bg-active, rgba(79,140,255,0.24))";
                          e.currentTarget.style.color = "var(--dsw-alias-brand-primary, #4f8cff)";
                        },
                        onMouseLeave: function (e) {
                          e.currentTarget.style.background = "var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,0.16))";
                          e.currentTarget.style.color = C.muted;
                        },
                        children: react_jsx_runtime.jsx("svg", {
                          width: 15,
                          height: 15,
                          viewBox: "0 0 24 24",
                          style: { display: "block", transform: "translate(1px, 0px)", overflow: "visible" },
                          fill: "none",
                          stroke: "currentColor",
                          strokeWidth: 3.4,
                          strokeLinecap: "round",
                          children: [
                            // cross lines span 5..19, intersection (12,12) centered
                            react_jsx_runtime.jsx("line", { x1: 5, y1: 5, x2: 19, y2: 19 }),
                            react_jsx_runtime.jsx("line", { x1: 19, y1: 5, x2: 5, y2: 19 })
                          ]
                        })
                      })
                    ]
                  })
                ]
              })
            ]
          }),
          // search input row: outer grid row animates 0fr<->1fr so the row
          // collapses/expands to its EXACT natural height (no max-height
          // overshoot stutter); the outline below moves smoothly with it
          (searchOpen || searchAnim === "out") ? react_jsx_runtime.jsx("div", {
            style: {
              display: "grid",
              gridTemplateRows: (searchAnim === "enter" || searchAnim === "out") ? "0fr" : "1fr",
              transition: "grid-template-rows 0.2s " + EASE,
              flex: "none"
            },
            children: react_jsx_runtime.jsx("div", {
              style: { overflow: "hidden", minHeight: 0 },
              children: react_jsx_runtime.jsx("div", {
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "2px 8px 4px",
                  borderBottom: "1px solid " + C.panelBorder,
                  opacity: (searchAnim === "enter" || searchAnim === "out") ? 0 : 1,
                  transform: (searchAnim === "enter" || searchAnim === "out") ? "translateY(-6px)" : "none",
                  transition: "opacity 0.2s ease, transform 0.2s ease"
                },
                children: [
              // input with a custom animated placeholder: the box stays static,
              // only the placeholder text fades when the scope switches
              react_jsx_runtime.jsx("div", {
                style: {
                  position: "relative",
                  flex: 1,
                  minWidth: 0,
                  display: "flex",
                  alignItems: "center",
                  background: "var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,0.14))",
                  borderRadius: 999,
                  cornerShape: "round",
                  padding: "6px 12px"
                },
                children: [
                  react_jsx_runtime.jsx("input", {
                    ref: searchRef,
                    value: query,
                    onChange: function (e) { onQueryChange(e.target.value); },
                    onKeyDown: function (e) {
                      if (e.key === "Enter") { goToMatch(matchIdx + 1); e.preventDefault(); }
                      if (e.key === "Escape") { closeSearch(); }
                    },
                    style: {
                      flex: 1,
                      minWidth: 0,
                      width: "100%",
                      background: "transparent",
                      border: "none",
                      outline: "none",
                      fontSize: 13,
                      color: C.text,
                      padding: 0
                    }
                  }),
                  (!query) ? react_jsx_runtime.jsx("span", {
                    style: {
                      position: "absolute",
                      left: 12,
                      pointerEvents: "none",
                      fontSize: 13,
                      color: "var(--dsw-alias-label-tertiary, rgba(128,128,128,0.7))"
                    },
                    children: [
                      "搜索",
                      react_jsx_runtime.jsx("span", {
                        style: { position: "relative", display: "inline-block" },
                        children: [
                          react_jsx_runtime.jsx("span", {
                            key: searchScope,
                            style: { display: "inline-block", animation: "dqt-fade-in 0.25s linear" },
                            children: searchScope === "title" ? "标题" : "全文"
                          }),
                          (prevScope && prevScope !== searchScope) ? react_jsx_runtime.jsx("span", {
                            key: "old-" + prevScope,
                            style: { position: "absolute", left: 0, top: 0, opacity: 0, animation: "dqt-fade-out 0.25s linear forwards" },
                            children: prevScope === "title" ? "标题" : "全文"
                          }) : null
                        ]
                      }),
                      "，回车定位…"
                    ]
                  }) : null,
                ]
              }),
              searching ? react_jsx_runtime.jsx("span", {
                style: { width: 13, height: 13, flex: "none", display: "flex", alignItems: "center", justifyContent: "center" },
                children: react_jsx_runtime.jsx("svg", {
                  width: 12,
                  height: 12,
                  viewBox: "0 0 24 24",
                  style: { display: "block", animation: "dqt-spin 0.8s linear infinite" },
                  children: react_jsx_runtime.jsx("circle", {
                    cx: 12, cy: 12, r: 9,
                    fill: "none",
                    stroke: C.muted,
                    strokeWidth: 3,
                    strokeDasharray: "42 22",
                    strokeLinecap: "round"
                  })
                })
              }) : react_jsx_runtime.jsx("span", {
                style: { fontSize: 11, color: C.muted, flex: "none", minWidth: 30, textAlign: "center" },
                children: matches.length > 0 ? ((matchIdx % matches.length) + 1) + "/" + matches.length : ""
              }),
              // scope toggle: 标题 <-> 全文 (round pill; background fades,
              // label text cross-fades old->new)
              react_jsx_runtime.jsx("button", {
                onClick: toggleScope,
                title: searchScope === "title" ? "当前：仅搜索标题。点击切换为全文搜索" : "当前：全文搜索。点击切换为仅标题",
                style: {
                  flex: "none",
                  width: 34,
                  height: 34,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "50%",
                  cornerShape: "round",
                  fontSize: 11,
                  color: searchScope === "full" ? "var(--dsw-alias-brand-primary, #4f8cff)" : C.muted,
                  background: searchScope === "full" ? "rgba(79,140,255,0.18)" : "var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,0.14))",
                  border: "none",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "background 0.25s ease"
                },
                children: react_jsx_runtime.jsx("span", {
                  style: { position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" },
                  children: [
                    react_jsx_runtime.jsx("span", {
                      key: searchScope,
                      style: { animation: "dqt-fade-in 0.25s linear", display: "block" },
                      children: searchScope === "title" ? "标题" : "全文"
                    }),
                    (prevScope && prevScope !== searchScope) ? react_jsx_runtime.jsx("span", {
                      key: "old-" + prevScope,
                      style: { position: "absolute", opacity: 0, animation: "dqt-fade-out 0.25s linear forwards", display: "block" },
                      children: prevScope === "title" ? "标题" : "全文"
                    }) : null
                  ]
                })
              })
                ]
              })
            })
          }) : null,
          // outline list (paged: newest first, scroll to the top loads older);
          // the scrollbar follows the dock side (rtl flips it to the left)
          react_jsx_runtime.jsx("div", {
            ref: listRef,
            className: "dqt-list",
            style: {
              overflowY: "auto",
              // NO top padding: a sticky child is confined to its containing
              // block, so a padded scroll container would hold the pinned group
              // header that many pixels below the toolbar (a visible gap). Spacing
              // between groups comes from the per-group divider instead.
              padding: "0 8px 6px",
              flex: "1 1 auto",
              minHeight: 0,
              direction: dockRight ? "ltr" : "rtl"
            },
            onScroll: onListScroll,
            onWheel: onListWheel,
            children: react_jsx_runtime.jsx("div", {
              style: { direction: "ltr" },
              children: query.trim()
                ? renderResults(resultRows, query.trim().toLowerCase(), C, goToRow, activeResultRow)
                : renderGroups(shownGroups, shownTrees, jump, C, Math.max(0, groups.length - visibleCount), activeGroup)
            })
          }),
          // resize handles (right edge: width, bottom edge: height)
          react_jsx_runtime.jsx("div", {
            style: {
              position: "absolute",
              top: 0,
              bottom: 0,
              right: 0,
              width: 8,
              cursor: "col-resize",
              touchAction: "none",
              zIndex: 2
            },
            onPointerDown: onResizeWDown,
            title: "拖拽调整宽度"
          }),
          react_jsx_runtime.jsx("div", {
            style: {
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: 8,
              cursor: "row-resize",
              touchAction: "none",
              zIndex: 2
            },
            onPointerDown: onResizeHDown,
            title: "拖拽调整高度"
          }),
          // corner handle: resize width AND height at once
          react_jsx_runtime.jsx("div", {
            style: {
              position: "absolute",
              right: 0,
              bottom: 0,
              width: 16,
              height: 16,
              cursor: "nwse-resize",
              touchAction: "none",
              zIndex: 3
            },
            onPointerDown: onResizeCornerDown,
            title: "拖拽同时调整宽高"
          }),
          // heading-level picker: pops down from the round header button,
          // right-aligned, with an outer shadow so it reads as a floating layer.
          // Open/close animate from the button's center: the animation lives in
          // the injected stylesheet (classes, not inline animation) so React
          // re-renders never restart or cancel it — an inline `animation` set on
          // every render made the entrance invisible and the exit never play.
          (levelsOpen || levelsClosing) ? react_jsx_runtime.jsx("div", {
            className: "dqt-levels-pop" + (levelsClosing ? " dqt-levels-pop-closing" : ""),
            style: {
              position: "absolute",
              top: 40,
              right: 8,
              zIndex: 30,
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 4,
              padding: 8,
              background: C.panelBg,
              border: "1px solid " + C.panelBorder,
              borderRadius: 10,
              cornerShape: "round",
              boxShadow: "0 6px 20px rgba(0, 0, 0, 0.28), 0 2px 6px rgba(0, 0, 0, 0.18)",
              maxWidth: "calc(100% - 16px)",
              transformOrigin: "calc(50% + 12px) top"
            },
            children: [1, 2, 3, 4, 5, 6].map(function (lv) {
              var active = !!levelSet[lv];
              return react_jsx_runtime.jsx("button", {
                onClick: function () { toggleLevel(lv); },
                title: active ? "隐藏 H" + lv : "显示 H" + lv,
                style: {
                  height: 22,
                  padding: "0 7px",
                  border: "none",
                  borderRadius: 6,
                  cornerShape: "round",
                  cursor: "pointer",
                  fontSize: 11,
                  lineHeight: "22px",
                  fontFamily: "inherit",
                  background: active
                    ? "rgba(79,140,255,0.18)"
                    : "var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,0.14))",
                  color: active ? "var(--dsw-alias-brand-primary, #4f8cff)" : C.muted,
                  fontWeight: active ? 600 : 400
                },
                children: "H" + lv
              }, "lv" + lv);
            })
          }) : null
        ]
      });

      // ---- edge collapse handle: fades+pops in after the panel fully slides away ----
      var edgeEl = !open ? react_jsx_runtime.jsx("div", {
        style: {
          position: "fixed",
          width: 26,
          height: 92,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          zIndex: Z_BASE,
          top: (viewport ? viewport.top + viewport.height / 2 - 46 : "50%"),
          transform: handleShown ? "translateX(0)" : (dockRight ? "translateX(16px)" : "translateX(-16px)"),
          opacity: chatViewActive ? 1 : 0,
          pointerEvents: chatViewActive ? "auto" : "none",
          transition: "transform 0.4s " + EASE + ", opacity 0.26s ease",
          ...(dockRight
            ? { right: viewport ? viewport.right + 52 : 60 }   // clear of the milestone rail
            : { left: viewport ? viewport.left : 0 })
        },
        title: "展开大纲",
        onClick: function () { setOpen(true); },
        onMouseEnter: function () { if (edgeRef.current) edgeRef.current.style.opacity = "1"; },
        onMouseLeave: function () { if (edgeRef.current) edgeRef.current.style.opacity = "0.5"; },
        children: react_jsx_runtime.jsx("div", {
          ref: edgeRef,
          style: {
            width: 12,
            height: 80,
            borderRadius: 999,
            cornerShape: "round",
            background: "var(--dsw-alias-border-l2, rgba(160,160,160,0.55))",
            opacity: handleShown ? 0.5 : 0,
            transition: "opacity 0.35s ease, background 0.25s ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--dsw-alias-label-secondary, #9aa0ab)",
            cursor: "pointer"
          },
          children: react_jsx_runtime.jsx("svg", {
            width: 9,
            height: 24,
            viewBox: "0 0 9 24",
            style: { display: "block" },
            children: react_jsx_runtime.jsx("path", {
              // tip points OUTWARD (toward where the panel will pop out):
              // docked left -> points right; docked right -> points left
              d: dockRight ? "M7 4 L1.5 12 L7 20 Z" : "M2 4 L7.5 12 L2 20 Z",
              fill: "currentColor"
            })
          })
        })
      }) : null;

      return react_dom.createPortal(
        react_jsx_runtime.jsx(ErrorBoundary, { children: [panelEl, edgeEl] }),
        document.body
      );
    }

    function renderItem(n, depth, jump, C, uid) {
      var hasChildren = !!(n.children && n.children.length);
      var parts = [];
      parts.push(react_jsx_runtime.jsx("span", {
        style: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" },
        children: n.title
      }, uid + "-l"));
      return react_jsx_runtime.jsx(
        "div",
        {
          onClick: function () { jump(n.key, n.idx); },
          "data-jump-key": n.key,
          "data-jump-idx": n.idx !== undefined ? String(n.idx) : "0",
          style: {
            display: "flex",
            alignItems: "center",
            gap: 2,
            padding: "2px 6px",
            paddingLeft: (hasChildren ? 2 : 6) + (n.level - 1) * 12,
            margin: "1px 0",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: n.level <= 2 ? 13 : 12,
            color: n.level <= 2 ? C.text : C.muted,
            fontWeight: n.level <= 2 ? 600 : 400,
            lineHeight: "18px",
            height: 22,
            whiteSpace: "nowrap",
            overflow: "hidden"
          },
          onMouseEnter: function (e) { e.currentTarget.style.background = C.hover; },
          onMouseLeave: function (e) { e.currentTarget.style.background = "transparent"; },
          title: n.title,
          children: parts
        },
        uid + "-" + n.level + "-" + (n.key || "")
      );
    }

    function renderNodes(nodes, depth, jump, C, uid) {
      var out = [];
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        out.push(renderItem(n, depth, jump, C, uid + "-" + i));
        if (n.children && n.children.length) {
          out.push(react_jsx_runtime.jsx("div", { children: renderNodes(n.children, depth + 1, jump, C, uid + "-" + i) }, uid + "-c-" + i));
        }
      }
      return out;
    }

    // ---- search results view ----
    // While a query is present the list shows every matched heading/message
    // (grouped per message, with an occurrence count) instead of the outline, so
    // search is "see them all, then jump" rather than stepping blindly.
    function hitSpans(text, q) {
      var parts = highlightParts(text, q);
      return parts.map(function (p, i) {
        return p.hit
          ? react_jsx_runtime.jsx("span", {
            style: { background: "rgba(255,196,0,0.32)", borderRadius: 2, color: "inherit" },
            children: p.text
          }, "hp" + i)
          : p.text;
      });
    }

    function renderResultRow(r, i, q, C, onRow, isActive) {
      var meta = [];
      if (r.time) meta.push(r.time);
      if (r.path) meta.push(r.path);
      if (r.count > 1) meta.push("×" + r.count);
      var children = [
        react_jsx_runtime.jsx("div", {
          style: {
            fontSize: 12,
            fontWeight: r.level > 0 && r.level <= 2 ? 600 : 400,
            color: r.level > 0 ? C.text : C.muted,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis"
          },
          children: hitSpans(r.title, q)
        }, "t" + i)
      ];
      if (r.snippet) {
        children.push(react_jsx_runtime.jsx("div", {
          style: {
            fontSize: 11,
            color: C.muted,
            marginTop: 1,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis"
          },
          children: hitSpans(r.snippet, q)
        }, "s" + i));
      }
      if (meta.length) {
        children.push(react_jsx_runtime.jsx("div", {
          style: { fontSize: 10, color: C.muted, opacity: 0.8, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
          children: meta.join("  ·  ")
        }, "m" + i));
      }
      return react_jsx_runtime.jsx("div", {
        // clicking a row makes that hit the CURRENT one: it highlights the
        // keyword in the conversation and scrolls there, exactly like Enter
        // stepping — a row that only scrolled (no highlight) was the old bug
        onClick: function () { onRow(i); },
        "data-result-idx": i,
        onMouseEnter: function (e) { e.currentTarget.style.background = C.hover; },
        onMouseLeave: function (e) { e.currentTarget.style.background = isActive ? "rgba(79,140,255,0.16)" : "transparent"; },
        title: r.path || r.title,
        style: {
          padding: "4px 6px",
          margin: "1px 0",
          borderRadius: 6,
          cursor: "pointer",
          minWidth: 0,
          background: isActive ? "rgba(79,140,255,0.16)" : "transparent",
          transition: "background 0.15s ease"
        },
        children: children
      }, "res-" + i);
    }

    function renderResults(rows, q, C, onRow, activeRow) {
      if (!rows || rows.length === 0) {
        return react_jsx_runtime.jsx("div", {
          style: { padding: "12px 8px", fontSize: 12, color: C.muted, textAlign: "center" },
          children: "没有匹配"
        });
      }
      var out = [];
      for (var i = 0; i < rows.length; i++) {
        out.push(renderResultRow(rows[i], i, q, C, onRow, i === activeRow));
      }
      return out;
    }

    // a group's header (the time row): clicking it jumps to the TOP OF THE
    // MODEL'S REPLY for that turn — the first assistant step — which also makes
    // heading-less turns jumpable, since they only have this row.
    // Implemented as a function (not an inline closure in a loop) so each
    // header captures its own (g, gi) — the var-in-loop closure bug would
    // otherwise make every header jump to the last group.
    function renderGroupHeader(g, gi, jump, C) {
      var replyKey = (g.msgs && g.msgs.length > 0) ? g.msgs[0].key : "";
      var targetKey = replyKey || g.userKey;
      var jumpToTurn = function (e) {
        e.stopPropagation();
        // prefer the model's reply; fall back to the user message, then to the
        // turn's first heading, so the row always does something useful
        if (replyKey && findRow(replyKey)) { jump(replyKey); return; }
        if (g.userKey && findRow(g.userKey)) { jump(g.userKey); return; }
        if (g.headings.length > 0) jump(g.headings[0].key, g.headings[0].idx);
      };
      return react_jsx_runtime.jsx("div", {
        style: {
          padding: "1px 4px 2px",
          height: 18,
          display: "flex",
          alignItems: "center",
          minWidth: 0,
          // sticky: while you scroll the outline, the header of the group you are
          // inside stays pinned at the top (background must be opaque to cover
          // the rows scrolling underneath).
          position: "sticky",
          top: 0,
          zIndex: 2,
          background: C.panelBg
        },
        children: react_jsx_runtime.jsx("span", {
          onClick: jumpToTurn,
          title: replyKey ? "跳转到该回合的模型回答开头" : "跳转到该回合开头",
          onMouseEnter: function (e) { e.currentTarget.style.background = C.hover; },
          onMouseLeave: function (e) { e.currentTarget.style.background = "transparent"; },
          style: {
            fontSize: 11,
            color: C.muted,
            cursor: "pointer",
            padding: "1px 5px",
            borderRadius: 4,
            transition: "background 0.15s ease",
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            minWidth: 0,
            maxWidth: "100%",
            overflow: "hidden"
          },
          children: [
            react_jsx_runtime.jsx("span", { style: { fontWeight: 600, flex: "none" }, children: g.time || " " }),
            g.userText ? react_jsx_runtime.jsx("span", {
              style: { fontWeight: 400, opacity: 0.75, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 },
              children: g.userText
            }) : null
          ]
        })
      }, "g-h-" + gi);
    }

    // render each conversation turn as its own block: solid divider + time header
    // offset = global group index of the first rendered group (stable React keys)
    // activeIdx = array of groups being read (full opacity); others are dimmed
    function renderGroups(groups, trees, jump, C, offset, activeIdx) {
      var base = offset || 0;
      var activeSet = {};
      if (Array.isArray(activeIdx)) {
        for (var a = 0; a < activeIdx.length; a++) activeSet[activeIdx[a]] = true;
      }
      var out = [];
      for (var i = 0; i < groups.length; i++) {
        var g = groups[i];
        var gi = base + i;
        var items = [];
        items.push(react_jsx_runtime.jsx("div", {
          style: { borderTop: "1px solid " + C.panelBorder, margin: "7px 2px 3px", height: 0 }
        }, "g-sep-" + gi));
        items.push(renderGroupHeader(g, gi, jump, C));
        items.push(renderNodes(trees[i], 0, jump, C, "g" + gi));
        var dim = !activeSet[gi];
        out.push(react_jsx_runtime.jsx("div", {
          "data-group-idx": gi,
          style: { opacity: dim ? 0.6 : 1, transition: "opacity 0.3s ease" },
          children: items
        }, "g-" + gi));
      }
      return out;
    }

    var zh = {
      "panel.title": "对话大纲"
    };
    var en = {
      "panel.title": "Conversation Outline"
    };

    var inject = ["slots", "locale"];

    function apply(ctx) {
      ctx.effect(function () {
        return ctx.locale.register("dsh-quick-toc", { zh: zh, en: en });
      }, "dsh-quick-toc: dictionaries");
      // Recent DSH (0.1.5-rc.1): session-scoped hooks (useChat/useSession/sessionId) only arrive
      // inside a declared session slot. Register the panel into the session-scoped
      // conversation.input.overlay (list/additive) so it receives useChat; the panel
      // itself renders a fixed, frame-floating dock, so the overlay seat is just the
      // hook source (it is NOT the panel's visual container).
      ctx.slots.inject("conversation.input.overlay", function () {
        return ctx.slots.register({
          name: "conversation.input.overlay",
          id: "quick-toc",
          order: 90,
          locale: "dsh-quick-toc"
        }, OutlinePanel);
      });
    }

    exports.name = "dsh-quick-toc"; // runner attributes slot entries to this registrant
    exports.apply = apply;
    exports.inject = inject;

    // inject the small keyframe + panel-scrollbar stylesheet once
    (function () {
      if (typeof document === "undefined") return;
      if (document.getElementById("dsh-quick-toc-css")) return;
      var s = document.createElement("style");
      s.id = "dsh-quick-toc-css";
      s.textContent = "@keyframes dqt-spin{to{transform:rotate(360deg)}}@keyframes dqt-fade-in{from{opacity:0}to{opacity:1}}@keyframes dqt-fade-out{from{opacity:1}to{opacity:0}}" +
        "@keyframes dqt-pop-in{from{opacity:0;transform:scale(0.7)}to{opacity:1;transform:scale(1)}}@keyframes dqt-pop-out{from{opacity:1;transform:scale(1)}to{opacity:0;transform:scale(0.7)}}" +
        // the level picker's enter/exit animations live here as classes so React
        // re-renders (which rewrite inline styles) cannot restart or cancel them
        ".dqt-levels-pop{animation:dqt-pop-in 0.22s cubic-bezier(0.22, 0.9, 0.3, 1) both;will-change:transform,opacity}" +
        // exit: starts moving immediately (fast attack), so the dismiss feels snappy
        ".dqt-levels-pop-closing{animation:dqt-pop-out 0.14s cubic-bezier(0.2, 0.9, 0.3, 1) both;will-change:transform,opacity}" +
        // Hide the native scrollbar entirely (no arrow buttons, no grey bar) —
        // custom webkit scrollbar styling was not reliably suppressing the
        // default arrows, so a hidden native bar + the panel's inner shadow gives
        // the cleanest look. Scrolling still works (auto-follow + wheel-load-older).
        ".dqt-list{scrollbar-width:none;-ms-overflow-style:none}" +
        ".dqt-list::-webkit-scrollbar{display:none;width:0;height:0}" +
        ".dqt-list::-webkit-scrollbar-button{display:none;height:0;width:0}" +
        ".dqt-list::-webkit-scrollbar-track{background:transparent}" +
        ".dqt-list::-webkit-scrollbar-thumb{background:transparent}" +
        ".dqt-list::-webkit-scrollbar-corner{background:transparent}";
      document.head.appendChild(s);
    })();

    return module.exports;
  }
});

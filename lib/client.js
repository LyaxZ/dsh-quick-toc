window.__ModuleLoader__.load({
  id: "dsh-quick-toc",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    let react = require("react");
    let react_jsx_runtime = require("react/jsx-runtime");
    require("@deepseek-ai/dsh-client-runtime/client");

    // ---------- constants ----------
    var PANEL_WIDTH = 288;
    var Z_BASE = 950;
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

    function parseHeadings(text) {
      var items = [];
      var re = /^(#{1,6})\s+(.+?)\s*#*\s*$/gm;
      var m;
      while ((m = re.exec(text)) !== null) {
        items.push({ level: m[1].length, title: cleanTitle(m[2].trim()) });
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
      var useSession = props.useSession;
      if (!useSession) {
        console.warn("[dsh-quick-toc] useSession prop missing");
        return null;
      }
      var order = useSession(function (s) { return s.chat.order; });
      var nodes = useSession(function (s) { return s.chat.nodes; });

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

      // ---- pagination: show the latest N groups; scrolling to the top loads older ----
      var PAGE_SIZE = 6;
      var _s9 = react.useState(PAGE_SIZE);
      var visibleCount = _s9[0];
      var setVisibleCount = _s9[1];
      var listRef = react.useRef(null);
      var didInitScroll = react.useRef(false);
      var outlineTouchRef = react.useRef(0); // last time the user touched the outline

      // the group currently being read (under the list viewport middle):
      // it stays at full opacity, every other group is dimmed
      var _s10 = react.useState([]);
      var activeGroup = _s10[0];
      var setActiveGroup = _s10[1];
      var activeSigRef = react.useRef("");

      // first time content appears, scroll the list to the bottom (newest)
      react.useEffect(function () {
        if (didInitScroll.current || !listRef.current || !groups || groups.length === 0) return;
        didInitScroll.current = true;
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }, [groups ? groups.length : 0]);

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
        if (!order || !nodes) return result;
        // first pass: per-turn time — the LAST message of the turn wins (end time);
        // also remember each turn's user message key + first-line preview
        for (var i = 0; i < order.length; i++) {
          var k0 = order[i];
          var n0 = nodes.get(k0);
          if (!n0 || (n0.kind !== "user" && n0.kind !== "assistant-step")) continue;
          var l0 = n0.location;
          var tid0 = l0 && (l0.kind === "turn" || l0.kind === "step") && l0.turn ? l0.turn.turn : null;
          if (tid0 === null) continue;
          if (n0.kind === "user" && turnUserKey[tid0] === undefined) {
            turnUserKey[tid0] = k0;
            turnUserText[tid0] = previewText(extractUserText(n0), 30);
          }
          var t0 = getNodeTime(n0);
          if (t0) turnTimes[tid0] = t0;
        }
        // second pass: group assistant headings by turn
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
              headings: []
            };
            result.push(current);
          }
          var parsed = parseHeadings(extractReplyText(node));
          var hIdx = 0;
          for (var k = 0; k < parsed.length; k++) {
            current.headings.push({ level: parsed[k].level, title: parsed[k].title, key: key, idx: hIdx });
            hIdx++;
          }
        }
        // keep a turn when it has headings OR a time — turns without headings
        // still get a standalone time entry in the outline (click to jump)
        return result.filter(function (g) { return g.headings.length > 0 || g.time !== ""; });
      }, [order, nodes]);
      var groupTrees = react.useMemo(function () {
        return groups.map(function (g) { return buildTree(g.headings); });
      }, [groups]);
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

      // ---- nothing to show without headings ----
      if (groups.length === 0) return null;

      // ---- geometry: always position by `left` (px) so dock-switch & slide share one animated transition
      var dockRight = dock === "right";
      var panelLeft;
      if (open) {
        panelLeft = dockRight
          ? window.innerWidth - (viewport ? viewport.right + 48 : 60) - panelW
          : (viewport ? viewport.left + 8 : 8);
      } else {
        // collapsed position:
        //  left dock  -> slide just past the left sidebar edge (stop there)
        //  right dock -> boundary is the right sidebar when it is open,
        //                otherwise the screen's right edge
        if (dockRight) {
          // with the right sidebar open, slide INTO the sidebar area (covered
          // by the cover wall); otherwise fly off the screen's right edge
          panelLeft = (viewport && viewport.right > 80)
            ? (window.innerWidth - viewport.right)
            : window.innerWidth + 24;
        } else {
          panelLeft = (viewport ? viewport.left - panelW - 8 : -(panelW + 48));
        }
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
        var move = function (ev) {
          var next = origY + (ev.clientY - startY);
          next = Math.max(-(viewport ? viewport.top : 0), Math.min(window.innerHeight - 90, next));
          setPanelY(next);
        };
        var up = function () {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
          try { localStorage.setItem(PANEL_Y_KEY, String(panelY)); } catch (e2) {}
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
      var panelClip = "inset(0 0 0 0px)";
      if (!open) {
        if (dockRight) {
          panelClip = "inset(0 " + panelW + "px 0 0)";
        } else {
          panelClip = "inset(0 0 0 " + (panelW + 8) + "px)";
        }
      }
      var panelOpacity = open ? (hovered ? 0.95 : 0.45) : 0;

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
          boxShadow: "0 2px 10px rgba(0,0,0,0.18)",
          zIndex: Z_BASE,
          overflow: "hidden",
          color: C.text,
          opacity: panelOpacity,
          clipPath: panelClip,
          boxShadow: "none",
          transition: panelTransition,
          pointerEvents: "auto"
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
                      // triangle tips toward the side it will move TO: shift slightly down + toward the tip
                      iconBtn(toggleDock, dockRight ? "移到左侧" : "移到右侧", dockRight ? "◀" : "▶", 12, dockRight ? { x: -1, y: 1 } : { x: 1, y: 1 }),
                      iconBtn(function () { setOpen(false); }, "收起", "✕", 13, { x: 0, y: -1 })
                    ]
                  })
                ]
              })
            ]
          }),
          // outline list (paged: newest first, scroll to the top loads older);
          // the scrollbar follows the dock side (rtl flips it to the left)
          react_jsx_runtime.jsx("div", {
            ref: listRef,
            style: {
              overflowY: "auto",
              padding: "6px 8px",
              flex: "1 1 auto",
              minHeight: 0,
              direction: dockRight ? "ltr" : "rtl"
            },
            onScroll: onListScroll,
            onWheel: onListWheel,
            children: react_jsx_runtime.jsx("div", {
              style: { direction: "ltr" },
              children: renderGroups(shownGroups, shownTrees, jump, C, Math.max(0, groups.length - visibleCount), activeGroup)
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
          })
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
          transition: "transform 0.4s " + EASE,
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

      return react_jsx_runtime.jsx(ErrorBoundary, {
        children: [panelEl, edgeEl]
      });
    }

    function renderItem(n, depth, jump, C, uid) {
      return react_jsx_runtime.jsx(
        "div",
        {
          onClick: function () { jump(n.key, n.idx); },
          "data-jump-key": n.key,
          "data-jump-idx": n.idx !== undefined ? String(n.idx) : "0",
          style: {
            padding: "2px 6px",
            paddingLeft: 8 + (n.level - 1) * 12,
            margin: "1px 0",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: n.level <= 2 ? 13 : 12,
            color: n.level <= 2 ? C.text : C.muted,
            fontWeight: n.level <= 2 ? 600 : 400,
            lineHeight: "18px",
            height: 22,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis"
          },
          onMouseEnter: function (e) { e.currentTarget.style.background = C.hover; },
          onMouseLeave: function (e) { e.currentTarget.style.background = "transparent"; },
          title: n.title,
          children: n.title
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

    // a group's header: clicking the time jumps to that turn's start.
    // Implemented as a function (not an inline closure in a loop) so each
    // header captures its own (g, gi) — the var-in-loop closure bug would
    // otherwise make every header jump to the last group.
    function renderGroupHeader(g, gi, jump, C) {
      var jumpToTurn = function (e) {
        e.stopPropagation();
        if (!g.userKey) return;
        var r0 = findRowStrict(g.userKey);
        if (r0) jump(g.userKey);
        else if (g.headings.length > 0) jump(g.headings[0].key, g.headings[0].idx);
      };
      return react_jsx_runtime.jsx("div", {
        style: { padding: "1px 4px 2px", height: 18, display: "flex", alignItems: "center", minWidth: 0 },
        children: react_jsx_runtime.jsx("span", {
          onClick: jumpToTurn,
          title: g.userKey ? "跳转到该回合开头" : "",
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

    function OutlineOverlay(props) {
      var SessionProvider = props.SessionProvider;
      var renderSlot = props.renderSlot;
      return react_jsx_runtime.jsx(SessionProvider, {
        empty: function () { return null; },
        children: function () { return renderSlot("quick-toc.panel", {}); }
      });
    }

    var zh = {
      "panel.title": "对话大纲"
    };
    var en = {
      "panel.title": "Conversation Outline"
    };

    var inject = ["slots", "sessions", "locale"];

    function apply(ctx) {
      ctx.effect(function () {
        return ctx.locale.register("dsh-quick-toc", { zh: zh, en: en });
      }, "dsh-quick-toc: dictionaries");
      ctx.slots.inject("shell.overlay", function () {
        return ctx.slots.register({
          name: "shell.overlay",
          id: "quick-toc",
          order: 90,
          children: { "quick-toc.panel": { kind: "single", scope: "session" } }
        }, OutlineOverlay);
      });
      ctx.slots.inject("quick-toc.panel", function () {
        return ctx.slots.register({
          name: "quick-toc.panel",
          locale: "dsh-quick-toc"
        }, OutlinePanel);
      });
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});

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

    // ---------- UI strings ----------
    // Every string the panel renders goes through T(). 0.5.0 ships the Chinese
    // column only — the visible text is byte-identical to 0.4.1 — so 0.6.0 can
    // add English (or feed the same keys into the host locale table) without
    // hunting for hard-coded literals a second time.
    var DICTS = {
      zh: {
        "panel.title": "对话大纲",
        "error.panel": "dsh-quick-toc 面板出错: ",
        "handle.dragY": "按住拖动调整位置",
        "handle.dockLeft": "移到左侧",
        "handle.dockRight": "移到右侧",
        "handle.collapse": "收起",
        "handle.expand": "展开大纲",
        "levels.tip": "标题层级筛选",
        "levels.show": "显示 H",
        "levels.hide": "隐藏 H",
        "search.open": "搜索标题",
        "search.word": "搜索",
        "search.tail": "，回车定位…",
        "search.scope.title": "标题",
        "search.scope.full": "全文",
        "search.scope.tipTitle": "当前：仅搜索标题。点击切换为全文搜索",
        "search.scope.tipFull": "当前：全文搜索。点击切换为仅标题",
        "search.fuzzy": "模糊",
        "search.fuzzy.tipOn": "模糊匹配已开启：允许关键字中间夹少量其他文字，命中更多",
        "search.fuzzy.tipOff": "模糊匹配已关闭：只匹配连续的文字。点击开启",
        "search.empty": "没有匹配",
        "search.hintMore": "向上滚动可加载更早的消息",
        "search.hintOldest": "已经是最早的消息",
        "hint.bottom": "已经到底了",
        "outline.bottom": "回到底部",
        "turn.jumpReply": "跳转到该回合的模型回答开头",
        "turn.jumpTurn": "跳转到该回合开头",
        "turn.unloaded": "未加载",
        "turn.loadTip": "点击加载这个回合并跳转过去",
        "turn.failed": "请求失败",
        "turn.jumpFailed": "跳转到该回合的报错位置",
        "time.yesterday": "昨天",
        "time.beforeYesterday": "前天",
        "preview.truncated": "预览由宿主提供，可能被截断",
        "resize.w": "拖拽调整宽度",
        "resize.h": "拖拽调整高度",
        "resize.wh": "拖拽同时调整宽高",
        "settings.desc": "对话大纲面板的语言与显示偏好，保存在 DSH 的设置里。",
        "settings.language": "语言",
        "settings.language.tip": "「跟随宿主」使用 DSH 当前的语言",
        "settings.lang.auto": "跟随宿主",
        "settings.lang.zh": "中文",
        "settings.lang.en": "English",
        "settings.dock": "默认停靠边缘",
        "settings.dock.left": "左侧",
        "settings.dock.right": "右侧",
        "settings.levels": "显示的标题层级",
        "settings.zoom": "面板缩放",
        "settings.zoom.tip": "文字、图标与按钮按比例缩放，面板本身的尺寸不变",
        "settings.handle": "把手位置",
        "settings.handle.tip": "收起面板后，边缘把手在对话区里的上下位置（0% 最下、100% 最上）",
        "settings.on": "开启",
        "settings.off": "关闭",
        "settings.fuzzy": "模糊搜索",
        "settings.hover": "悬停预览卡片",
        "settings.debug": "在控制台打印诊断日志",
        "settings.debug.tip": "开启后控制台会打印一行挂载诊断（宿主能力与跳转加载器状态）",
        "settings.overridden": "已自定义",
        "settings.resetField": "重置",
        "settings.readOnly": "当前页面无法写入 DSH 设置，面板暂时使用本浏览器保存的偏好。"
      },
      en: {
        "panel.title": "Conversation Outline",
        "error.panel": "dsh-quick-toc panel error: ",
        "handle.dragY": "Drag to move the panel",
        "handle.dockLeft": "Move to the left",
        "handle.dockRight": "Move to the right",
        "handle.collapse": "Collapse",
        "handle.expand": "Expand the outline",
        "levels.tip": "Heading level filter",
        "levels.show": "Show H",
        "levels.hide": "Hide H",
        "search.open": "Search headings",
        "search.word": "Search",
        "search.tail": ", Enter to jump…",
        "search.scope.title": "Title",
        "search.scope.full": "Full text",
        "search.scope.tipTitle": "Titles only. Click for full-text search",
        "search.scope.tipFull": "Full text. Click for titles only",
        "search.fuzzy": "Fuzzy",
        "search.fuzzy.tipOn": "Fuzzy matching is on: a few other characters may sit between the keywords, so more matches hit",
        "search.fuzzy.tipOff": "Fuzzy matching is off: only contiguous text matches. Click to turn it on",
        "search.empty": "No matches",
        "search.hintMore": "Scroll up to load earlier messages",
        "search.hintOldest": "This is the earliest message",
        "hint.bottom": "You have reached the end",
        "outline.bottom": "Back to the newest entry",
        "turn.jumpReply": "Jump to the start of this turn's model reply",
        "turn.jumpTurn": "Jump to the start of this turn",
        "turn.unloaded": "Not loaded",
        "turn.loadTip": "Click to load this turn and jump to it",
        "turn.failed": "Request failed",
        "turn.jumpFailed": "Jump to this turn's error",
        // NB: "time.beforeYesterday" stays Chinese-only on purpose — English has no
        // natural word for it that beats the date, so anything older than yesterday
        // carries the numeric date. Yesterday itself reads as the word in both.
        "time.yesterday": "yesterday",
        "preview.truncated": "Preview comes from the host and may be truncated",
        "resize.w": "Drag to resize the width",
        "resize.h": "Drag to resize the height",
        "resize.wh": "Drag to resize width and height",
        "settings.desc": "Language and display preferences for the conversation outline panel, kept in DSH's settings.",
        "settings.language": "Language",
        "settings.language.tip": "\"Follow the host\" uses whatever language DSH currently runs in",
        "settings.lang.auto": "Follow the host",
        "settings.lang.zh": "中文",
        "settings.lang.en": "English",
        "settings.dock": "Default docked edge",
        "settings.dock.left": "Left",
        "settings.dock.right": "Right",
        "settings.levels": "Heading levels shown",
        "settings.zoom": "Panel scale",
        "settings.zoom.tip": "Scales the text, icons and buttons; the panel's own size is unchanged",
        "settings.handle": "Handle position",
        "settings.handle.tip": "Where the collapsed-panel handle sits vertically (0% bottom, 100% top of the conversation area)",
        "settings.on": "On",
        "settings.off": "Off",
        "settings.fuzzy": "Fuzzy search",
        "settings.hover": "Hover preview card",
        "settings.debug": "Print the mount diagnostic to the console",
        "settings.debug.tip": "The console then prints one mount line (host capabilities and jump-loader state)",
        "settings.overridden": "Customized",
        "settings.resetField": "Reset",
        "settings.readOnly": "This page cannot write DSH settings; the panel is using the preferences saved in this browser."
      }
    };
    // The dictionary the current render reads. `T` prefers the HOST translation for
    // the active language when one is bound (that is what makes "follow the host"
    // work and what makes a language switch in Settings live), and falls back to the
    // built-in table so the panel still speaks a language when the host has no
    // locale service. Kept as a module-level binding so the module-scope render
    // helpers (renderItem/renderResultRow/...) can localise without threading a `t`
    // argument through every call.
    var activeLang = "zh";        // resolved language: "zh" | "en"
    var langPref = "auto";        // user preference: "auto" | "zh" | "en"
    var hostTranslate = null;     // (key) => string | undefined, bound by apply()
    var builtinDict = function () { return DICTS[activeLang] || DICTS.zh; };
    // The English table is complete except for the two Chinese-only relative days (see
    // the note in it), so the Chinese table is the last stop before the key itself —
    // a raw key like "turn.unloaded" must never reach the screen.
    function T(key) {
      if (langPref === "auto" && typeof hostTranslate === "function") {
        var viaHost = hostTranslate(key);
        if (typeof viaHost === "string" && viaHost !== "") return viaHost;
      }
      var s = builtinDict()[key];
      if (s === undefined && activeLang !== "zh") s = DICTS.zh[key];
      return s === undefined ? key : s;
    }
    // The host reports the language it resolved for us; `auto` follows it, an explicit
    // preference wins, and an unknown host language falls back to Chinese.
    function setLanguage(pref, hostLang) {
      langPref = pref === "zh" || pref === "en" ? pref : "auto";
      activeLang = langPref === "auto" ? (hostLang === "en" ? "en" : "zh") : langPref;
      return activeLang;
    }
    // Which language the HOST is running in. The bound translate function is the only
    // signal a plugin gets, so it is probed with one key whose two translations differ
    // (both are registered below, so the answer is exact rather than a guess).
    function hostLanguage() {
      if (typeof hostTranslate !== "function") return null;
      try {
        return hostTranslate("panel.title") === DICTS.en["panel.title"] ? "en" : "zh";
      } catch (e) {
        return null;
      }
    }

    // ---------- preferences ----------
    // ONE module-level home for the panel's preferences, shared by the panel and by
    // the plugin-configuration card, so a change on either side is live on the other.
    //
    // Two layers sit behind it. The Host settings document (the namespace the host
    // half registers) is authoritative on a loopback page — that is what the card in
    // Settings → Plugins → Plugin configuration edits, and what follows the account
    // across browsers. localStorage is the mirror this browser falls back to: DSH
    // marks settings read-only on a non-loopback page, and there the panel keeps
    // working exactly as 0.5.x did. Position and size (y/w/h) are local-only on
    // purpose — they describe THIS screen, not the account.
    var NAMESPACE = "dsh-quick-toc";
    // Fields backed by the Host settings document; everything else is localStorage.
    var HOST_FIELDS = { dock: 1, lang: 1, levels: 1, zoom: 1, handle: 1, fuzzy: 1, hover: 1, debug: 1 };
    // The schema defaults (mirrored here for the card's per-field reset and for the
    // one-time import of a 0.5.x install's stored values).
    var DEFAULTS = {
      dock: "left", y: 0, w: 0, h: 0,
      levels: [1, 2, 3, 4, 5, 6],
      zoom: 1, handle: 0.5,
      fuzzy: false, hover: true, lang: "auto", debug: false
    };
    var PREF_KEYS = {
      dock: "dsh-quick-toc.dock.v2",
      y: "dsh-quick-toc.panelY.v1",
      w: "dsh-quick-toc.panelW.v1",
      h: "dsh-quick-toc.panelH.v1",
      levels: "dsh-quick-toc.levels.v1",
      zoom: "dsh-quick-toc.zoom.v1",
      handle: "dsh-quick-toc.handle.v1",
      fuzzy: "dsh-quick-toc.fuzzy.v1",
      hover: "dsh-quick-toc.hover.v1",
      lang: "dsh-quick-toc.lang.v1",
      debug: "dsh-quick-toc.debug"
    };
    // Writing a field's schema default through the card IS its reset — a value that
    // equals the default carries no customization, so it must not pin an entry (and
    // the "customized" badge with it) into the user layer.
    var isDefaultValue = function (key, value) {
      var d = DEFAULTS[key];
      if (typeof value === "number" && typeof d === "number") return Math.round(value * 100) === Math.round(d * 100);
      if (Array.isArray(value) || Array.isArray(d)) return JSON.stringify(value) === JSON.stringify(d);
      return value === d;
    };
    // Legacy keys from the renamed plugin (dsh-dagang -> dsh-contents -> dsh-quick-toc).
    var PREF_LEGACY = {
      dock: ["dsh-contents.dock.v2", "dsh-dagang.dock.v2"],
      y: ["dsh-contents.panelY.v1", "dsh-dagang.panelY.v1"]
    };
    var OLD_MAX_LEVEL_KEY = "dsh-quick-toc.maxLevel.v1";
    var LEVELS_ALL = [1, 2, 3, 4, 5, 6];
    var prefsStore = (function () {
      var hasOwn = function (obj, key) { return Object.prototype.hasOwnProperty.call(obj, key); };
      var read = function (key, legacy) {
        try {
          var v = localStorage.getItem(key);
          if (v !== null) return v;
          var list = legacy || [];
          for (var i = 0; i < list.length; i++) {
            var old = localStorage.getItem(list[i]);
            if (old !== null) { localStorage.setItem(key, old); return old; }
          }
        } catch (e) {}
        return null;
      };
      var parseLevelList = function (arr) {
        if (!Array.isArray(arr)) return null;
        var out = [];
        for (var i = 0; i < arr.length; i++) {
          var lv = Number(arr[i]);
          if (lv >= 1 && lv <= 6 && out.indexOf(lv) < 0) out.push(lv);
        }
        if (out.length > 0) { out.sort(); return out; }
        return null;
      };
      var parseLevels = function (raw) {
        if (raw === null) return null;
        try { return parseLevelList(JSON.parse(raw)); } catch (e) { return null; }
      };
      var loadLocal = function () {
        var rawLevels = read(PREF_KEYS.levels);
        if (rawLevels === null) {
          // pre-0.4.0 stored a single max level instead of a set
          try {
            var max = Number(read(OLD_MAX_LEVEL_KEY));
            if (isFinite(max) && max >= 1) {
              var grown = [];
              for (var lv = 1; lv <= Math.min(6, max); lv++) grown.push(lv);
              rawLevels = JSON.stringify(grown);
            }
          } catch (e) {}
        }
        var dockRaw = read(PREF_KEYS.dock, PREF_LEGACY.dock);
        var yRaw = read(PREF_KEYS.y, PREF_LEGACY.y);
        var wRaw = read(PREF_KEYS.w);
        var hRaw = read(PREF_KEYS.h);
        var langRaw = read(PREF_KEYS.lang);
        var zoomRaw = read(PREF_KEYS.zoom); // NB: absent (null) means 1 — Number(null) is 0!
        var handleRaw = read(PREF_KEYS.handle); // absent (null) means 0.5 — same trap
        var clampRatio = function (raw, fallback) {
          return raw !== null && isFinite(Number(raw)) ? Math.min(1, Math.max(0, Math.round(Number(raw) * 100) / 100)) : fallback;
        };
        return {
          dock: dockRaw === "right" ? "right" : "left",
          // 0 means "the panel's own default" (see PANEL_WIDTH / auto height)
          y: yRaw !== null && isFinite(Number(yRaw)) ? Number(yRaw) : 0,
          w: wRaw !== null && isFinite(Number(wRaw)) && Number(wRaw) >= 120 ? Number(wRaw) : 0,
          h: hRaw !== null && isFinite(Number(hRaw)) && Number(hRaw) >= 60 ? Number(hRaw) : 0,
          levels: parseLevels(rawLevels) || LEVELS_ALL.slice(),
          zoom: clampRatio(zoomRaw, 1),
          handle: clampRatio(handleRaw, 0.5),
          fuzzy: read(PREF_KEYS.fuzzy) === "1",
          // absent means "on": the hover card predates this switch
          hover: read(PREF_KEYS.hover) !== "0",
          lang: langRaw === "zh" || langRaw === "en" ? langRaw : "auto",
          debug: read(PREF_KEYS.debug) === "1"
        };
      };
      var write = function (patch) {
        var map = {
          dock: function (v) { return v; },
          y: function (v) { return String(v); },
          w: function (v) { return String(v); },
          h: function (v) { return String(v); },
          levels: function (v) { return JSON.stringify(v); },
          zoom: function (v) { return String(v); },
          handle: function (v) { return String(v); },
          fuzzy: function (v) { return v ? "1" : "0"; },
          hover: function (v) { return v ? "1" : "0"; },
          lang: function (v) { return v; },
          debug: function (v) { return v ? "1" : "0"; }
        };
        for (var key in patch) {
          if (!hasOwn(patch, key) || !map[key]) continue;
          try { localStorage.setItem(PREF_KEYS[key], map[key](patch[key])); } catch (e) {}
        }
      };
      var listeners = [];
      var localValues = null;
      var hostScope = null;   // the bound client settings scope, or null
      var hostSnap = null;    // its last snapshot: {status, value, user, writable, revision}
      var values = null;
      var valuesVersion = -1;
      // The host layer arrives schema-validated, but the overlay still normalises so a
      // half-written document can never hand the panel a wrong type.
      var hostOverlay = function (snap) {
        if (!snap || snap.status !== "ready" || typeof snap.value !== "object" || snap.value === null) return null;
        var v = snap.value;
        var levels = parseLevelList(v.levels);
        var zoomNum = Number(v.zoom);
        var handleNum = Number(v.handle);
        return {
          dock: v.dock === "right" ? "right" : "left",
          lang: v.lang === "zh" || v.lang === "en" ? v.lang : "auto",
          levels: levels || LEVELS_ALL.slice(),
          zoom: isFinite(zoomNum) ? Math.min(2, Math.max(0.5, Math.round(zoomNum * 100) / 100)) : 1,
          handle: isFinite(handleNum) ? Math.min(1, Math.max(0, Math.round(handleNum * 100) / 100)) : 0.5,
          fuzzy: v.fuzzy === true,
          hover: v.hover !== false,
          debug: v.debug === true
        };
      };
      var compute = function () {
        var local = localValues || (localValues = loadLocal());
        var over = hostOverlay(hostSnap);
        if (!over) return local;
        return {
          dock: over.dock, y: local.y, w: local.w, h: local.h,
          levels: over.levels, zoom: over.zoom, handle: over.handle, fuzzy: over.fuzzy, hover: over.hover,
          lang: over.lang, debug: over.debug
        };
      };
      var notify = function () {
        for (var i = 0; i < listeners.length; i++) {
          try { listeners[i](store.get()); } catch (e) {}
        }
      };
      // Fold write operations into the cached snapshot so the next read is already the
      // new value; the host's own answer replaces it when the write settles.
      var foldOps = function (snap, ops) {
        if (!snap || typeof snap.value !== "object" || snap.value === null) return snap;
        var value = Object.assign({}, snap.value);
        var user = snap.user && typeof snap.user === "object" ? Object.assign({}, snap.user) : {};
        for (var i = 0; i < ops.length; i++) {
          var field = ops[i].path[0];
          value[field] = ops[i].value;
          user[field] = ops[i].value;
        }
        return Object.assign({}, snap, { value: value, user: user });
      };
      var foldUnset = function (snap, field) {
        if (!snap || typeof snap.value !== "object" || snap.value === null) return snap;
        var value = Object.assign({}, snap.value); delete value[field];
        var user = snap.user && typeof snap.user === "object" ? Object.assign({}, snap.user) : {}; delete user[field];
        return Object.assign({}, snap, { value: value, user: user });
      };
      // Remove one field's entry from the host document's user layer (the mirror is
      // the caller's business). Used by the card's per-field reset — and by `set`,
      // for a write whose value IS the schema default.
      var unsetHostEntry = function (field) {
        if (!(HOST_FIELDS[field] && hostScope && hostSnap && hostSnap.writable === true)) return;
        hostSnap = foldUnset(hostSnap, field);
        var settle = function () {
          if (!hostScope) return;
          hostSnap = hostScope.getSnapshot();
          store.version++;
          notify();
        };
        try {
          var p = hostScope.unset(field);
          if (p && typeof p.then === "function") p.then(settle, settle);
        } catch (e) { settle(); }
      };
      var sendHost = function (ops) {
        if (!ops.length || !hostScope || !hostSnap || hostSnap.writable !== true) return;
        hostSnap = foldOps(hostSnap, ops);
        var settle = function () {
          if (!hostScope) return;
          hostSnap = hostScope.getSnapshot();
          store.version++;
          notify();
        };
        try {
          var p = hostScope.mutate(ops);
          if (p && typeof p.then === "function") p.then(settle, settle);
        } catch (e) { settle(); }
      };
      /**
       * One-time import: a 0.5.x install kept every preference in localStorage. The
       * first time the host layer answers, hand it any STORED value that differs from
       * the schema defaults — but only while the user layer is still empty, so a
       * preference already configured through the card is never stomped. The local
       * keys stay: they remain this browser's fallback on non-loopback pages.
       */
      var importLegacy = function () {
        if (!hostSnap || hostSnap.status !== "ready" || hostSnap.writable !== true) return;
        if (hostSnap.user && typeof hostSnap.user === "object" && Object.keys(hostSnap.user).length > 0) return;
        var local = localValues || loadLocal(); // the stored layer, NOT the merged view
        var ops = [];
        if (local.dock !== DEFAULTS.dock) ops.push({ op: "set", path: ["dock"], value: local.dock });
        if (local.lang !== DEFAULTS.lang) ops.push({ op: "set", path: ["lang"], value: local.lang });
        if (JSON.stringify(local.levels) !== JSON.stringify(DEFAULTS.levels)) ops.push({ op: "set", path: ["levels"], value: local.levels.slice() });
        if (local.zoom !== DEFAULTS.zoom) ops.push({ op: "set", path: ["zoom"], value: local.zoom });
        if (local.handle !== DEFAULTS.handle) ops.push({ op: "set", path: ["handle"], value: local.handle });
        if (local.fuzzy !== DEFAULTS.fuzzy) ops.push({ op: "set", path: ["fuzzy"], value: local.fuzzy });
        if (local.hover !== DEFAULTS.hover) ops.push({ op: "set", path: ["hover"], value: local.hover });
        if (local.debug !== DEFAULTS.debug) ops.push({ op: "set", path: ["debug"], value: local.debug });
        sendHost(ops);
      };
      var store = {
        version: 0,
        get: function () {
          if (values === null || valuesVersion !== store.version) {
            values = compute();
            valuesVersion = store.version;
          }
          return values;
        },
        /** Merge a patch: route it to the host document and/or the mirror, then tell every subscriber (panel + card). */
        set: function (patch) {
          var current = store.get();
          var next = {};
          var changed = false;
          for (var key in current) {
            if (!hasOwn(current, key)) continue;
            next[key] = hasOwn(patch, key) ? patch[key] : current[key];
            if (key === "levels") {
              if (JSON.stringify(next[key]) !== JSON.stringify(current[key])) changed = true;
            } else if (next[key] !== current[key]) changed = true;
          }
          if (!changed) return current;
          // A host-field write whose value IS the schema default is a reset, not a
          // customization: the entry leaves the user layer (the "customized" badge
          // goes with it) instead of pinning the default into the document.
          var resets = [];
          var ops = [];
          for (var k in patch) {
            if (!hasOwn(patch, k)) continue;
            if (!HOST_FIELDS[k]) continue;
            if (isDefaultValue(k, patch[k])) { resets.push(k); continue; }
            ops.push({ op: "set", path: [k], value: patch[k] });
          }
          sendHost(ops);
          write(patch); // the localStorage mirror (and the local-only y/w/h)
          for (var r = 0; r < resets.length; r++) unsetHostEntry(resets[r]);
          store.version++;
          notify();
          return store.get();
        },
        /**
         * Clear one field back to its base layer (the card's per-field reset): the
         * host entry is removed — the schema default takes over and the "customized"
         * badge goes away — and the mirror records the default for non-loopback pages.
         */
        unset: function (field) {
          // the mirror FIRST: clearing the host entry empties the user layer, and the
          // one-time import must not read a stale mirror value and push it right back
          var mirror = {};
          mirror[field] = field === "levels" ? DEFAULTS.levels.slice() : DEFAULTS[field];
          write(mirror);
          unsetHostEntry(field);
          store.version++;
          notify();
          return store.get();
        },
        subscribe: function (fn) {
          listeners.push(fn);
          return function () {
            var at = listeners.indexOf(fn);
            if (at >= 0) listeners.splice(at, 1);
          };
        },
        /** The raw host snapshot for surfaces that need more than the merged values (the card's badges). */
        host: function () { return hostSnap; },
        /**
         * Adopt the client settings scope: its snapshot becomes the authoritative layer
         * for the host-backed fields, and its changes flow through the store like any
         * other write.
         */
        attachHost: function (scope) {
          hostScope = scope;
          hostSnap = scope.getSnapshot();
          store.version++;
          notify();
          scope.subscribe(function () {
            hostSnap = scope.getSnapshot();
            store.version++;
            notify();
            importLegacy();
          });
          importLegacy();
        },
        /**
         * Re-read localStorage and tell every subscriber. Used when another tab writes
         * one of these keys (a `storage` event) — the cached snapshot would otherwise
         * keep the stale value for the rest of this page's life.
         */
        reload: function () {
          localValues = null;
          store.version++;
          var next = store.get();
          for (var i = 0; i < listeners.length; i++) {
            try { listeners[i](next); } catch (e) {}
          }
          return next;
        }
      };
      return store;
    })();
    // Read the live preferences from a component: the store is versioned so a plain
    // state counter is enough to re-render on every change.
    function usePrefs() {
      var box = react.useState(prefsStore.version);
      react.useEffect(function () {
        return prefsStore.subscribe(function () { box[1](prefsStore.version); });
      }, []);
      return prefsStore.get();
    }

    // ---- timestamp helpers (module scope: the stamp formatter is used by the
    // component AND by module-scope render helpers) ----
    // Accepts ms / seconds epochs and ISO strings; null when unreadable.
    function toDateOf(t) {
      if (t === undefined || t === null) return null;
      if (typeof t === "string") {
        var d0 = new Date(t);
        return isNaN(d0.getTime()) ? null : d0;
      }
      var n = Number(t);
      if (!isFinite(n) || n <= 0) return null;
      if (n < 1e12) n = n * 1000; // epoch seconds -> ms
      var d = new Date(n);
      return isNaN(d.getTime()) ? null : d;
    }
    function pad2Of(n) { return ("0" + n).slice(-2); }
    function startOfDayOf(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }
    function fmtNumericDate(d) {
      return pad2Of(d.getFullYear() % 100) + "-" + pad2Of(d.getMonth() + 1) + "-" + pad2Of(d.getDate());
    }
    // A stamp the reader can place in time. Yesterday reads as a word in both
    // languages; Chinese also names the day before, while English falls straight
    // back to the numeric date for anything older (today is always just the clock).
    function fmtStampOf(t) {
      var d = toDateOf(t);
      if (!d) return "";
      var clock = pad2Of(d.getHours()) + ":" + pad2Of(d.getMinutes());
      var days = Math.round((startOfDayOf(d) - startOfDayOf(new Date())) / 86400000);
      if (days >= 0) return clock; // today (a future skew also reads as today)
      if (days === -1) return T("time.yesterday") + " " + clock;
      if (days === -2 && activeLang === "zh") return T("time.beforeYesterday") + " " + clock;
      return fmtNumericDate(d) + " " + clock;
    }
    // The jump in flight (null when none). A newer jump retires the previous one,
    // and the auto-follow stays out of the way while one is running.
    var glide = null;
    // Set once a jump has been seen handed back already finished: from then on the
    // glide is drawn frame by frame instead of asked for again.
    var smoothTeleports = false;


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

    // ---------- normalized matching (fold, plus an optional fuzzy pass) ----------
    // Folding ignores differences that never change meaning: letter case,
    // full-width vs half-width forms (ＡＢ１２，), and runs of whitespace. `map`
    // keeps every folded character's ORIGINAL index, so a match found in folded
    // space still highlights the untouched DOM text. Folding is ALWAYS on — it is
    // correctness, not fuzziness: pasting "全角" text must find "全角" content.
    function foldWithMap(text) {
      var src = String(text === undefined || text === null ? "" : text);
      var out = "";
      var map = [];
      var prevSpace = false;
      for (var i = 0; i < src.length; i++) {
        var ch = src.charAt(i);
        var code = src.charCodeAt(i);
        if (code >= 0xFF01 && code <= 0xFF5E) ch = String.fromCharCode(code - 0xFEE0); // full-width ASCII
        else if (code === 0x3000) ch = " "; // ideographic space
        var lower = ch.toLowerCase();
        if (/\s/.test(lower)) {
          if (prevSpace) continue; // collapse a whitespace run to one space
          prevSpace = true;
          out += " ";
          map.push(i);
          continue;
        }
        prevSpace = false;
        out += lower;
        map.push(i);
      }
      map.push(src.length); // end sentinel: source index just past the last character
      return { text: out, map: map };
    }

    function foldQuery(q) {
      return foldWithMap(q).text.trim();
    }

    // Contiguous occurrences of the folded query — the panel's original
    // behaviour (case-insensitive, non-overlapping), now fold-aware.
    function exactMatches(folded, fq) {
      var hits = [];
      if (!fq) return hits;
      var at = 0;
      while ((at = folded.text.indexOf(fq, at)) !== -1) {
        hits.push({ ranges: [[folded.map[at], folded.map[at + fq.length]]] });
        at += fq.length;
      }
      return hits;
    }

    // How far apart the matched characters of one fuzzy hit may sit. Without a
    // bound, "提交" would match any text that happens to contain 提…交 somewhere,
    // which buries the real hits; the span keeps fuzzy useful for "关键字中间夹
    // 了别的字" without turning the list into noise.
    function fuzzySpan(fq) {
      return Math.max(12, fq.length * 2 + 8);
    }

    // Subsequence occurrences (fuzzy mode): the query's characters must appear in
    // order, each hit is the shortest window found from the current position, and
    // hits never overlap. Adjacent matched characters are merged into one range so
    // a contiguous hit still highlights as a whole word.
    function fuzzyMatches(folded, fq) {
      var hits = [];
      if (!fq) return hits;
      var span = fuzzySpan(fq);
      var from = 0;
      for (;;) {
        var start = -1;
        var at = from;
        var ranges = [];
        var ok = true;
        for (var i = 0; i < fq.length; i++) {
          var hit = folded.text.indexOf(fq.charAt(i), at);
          if (hit === -1 || (start !== -1 && hit - start > span)) { ok = false; break; }
          if (start === -1) start = hit;
          var raw = [folded.map[hit], folded.map[hit + 1]];
          var last = ranges.length > 0 ? ranges[ranges.length - 1] : null;
          if (last !== null && last[1] === raw[0] && folded.text.charAt(hit - 1) !== " ") last[1] = raw[1];
          else ranges.push(raw);
          at = hit + 1;
        }
        if (!ok) break;
        hits.push({ ranges: ranges });
        from = at;
        if (from >= folded.text.length) break;
      }
      return hits;
    }

    function findMatches(folded, fq, fuzzy) {
      if (!fq) return [];
      return fuzzy ? fuzzyMatches(folded, fq) : exactMatches(folded, fq);
    }

    // Number of hits of the folded query in `text` (used for ×N and n/N counts).
    function countOccurrences(text, q, fuzzy) {
      var fq = q && q.folded !== undefined ? q.folded : foldQuery(q);
      if (!text || !fq) return 0;
      return findMatches(foldWithMap(text), fq, !!fuzzy).length;
    }

    // ---------- section bodies: subtitle + hover preview ----------
    // Body lines of one heading: everything after it up to the next heading in
    // the same message.
    function sectionPreview(lines, from, to, max) {
      if (!lines || from >= to) return "";
      var out = "";
      var fence = null;
      for (var i = from; i < to; i++) {
        var line = lines[i];
        var fm = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
        if (fence !== null) {
          if (fm && fm[1].charAt(0) === fence.char && fm[1].length >= fence.len && fm[2].trim() === "") fence = null;
          continue;
        }
        if (fm) { fence = { char: fm[1].charAt(0), len: fm[1].length }; continue; }
        var t = line.trim();
        if (t === "") continue;
        out += (out === "" ? "" : " ") + t;
        if (out.length >= max) return out.slice(0, max).trim() + "…";
      }
      return out;
    }

    // First readable sentence of a section — the outline row's subtitle. Skips
    // blank lines, code fences, table rules and bare bullet/emphasis markers so a
    // "###" block that opens with a table still gets a meaningful line.
    function firstSentence(lines, from, to, max) {
      if (!lines || from >= to) return "";
      var fence = null;
      for (var i = from; i < to; i++) {
        var line = lines[i];
        var fm = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
        if (fence !== null) {
          if (fm && fm[1].charAt(0) === fence.char && fm[1].length >= fence.len && fm[2].trim() === "") fence = null;
          continue;
        }
        if (fm) { fence = { char: fm[1].charAt(0), len: fm[1].length }; continue; }
        var t = line.trim().replace(/^[>+\-*]\s+/, "").replace(/^\d+[.)]\s+/, "");
        if (t === "" || /^[|\-=*_\s]+$/.test(t)) continue;
        t = cleanTitle(t);
        if (t === "") continue;
        return t.length > max ? t.slice(0, max).trim() + "…" : t;
      }
      return "";
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
        if (m !== null) items.push({ level: m[1].length, title: cleanTitle(m[2].trim()), line: i });
      }
      return items;
    }

    function buildTree(headings, time) {
      var root = { level: 0, children: [] };
      var stack = [root];
      for (var i = 0; i < headings.length; i++) {
        var h = headings[i];
        while (stack.length > 1 && stack[stack.length - 1].level >= h.level) stack.pop();
        var node = { level: h.level, title: h.title, key: h.key, idx: h.idx, sub: h.sub, preview: h.preview, time: time, children: [] };
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
    var EMPTY_LINES = [];
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
      var lines = text ? text.split("\n") : EMPTY_LINES;
      var headings = node.kind === "assistant-step" ? parseHeadings(text) : EMPTY_HEADINGS;
      // per-heading subtitle (first sentence) + hover preview (section opening) —
      // computed here, with the parse, so streaming updates only pay for the node
      // that actually changed. `line` marks where the heading sits in `lines`, and
      // its section runs to the next heading of ANY level (or the message end).
      for (var hi = 0; hi < headings.length; hi++) {
        var toLine = hi + 1 < headings.length ? headings[hi + 1].line : lines.length;
        headings[hi].sub = firstSentence(lines, headings[hi].line + 1, toLine, 44);
        headings[hi].preview = sectionPreview(lines, headings[hi].line + 1, toLine, 260);
      }
      var info = {
        node: node,
        blocks: blocks,
        user: isUser,
        text: text,
        lines: lines,
        headings: headings
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

    // Split `text` into runs around the hits of `q`, so the caller can render the
    // hits distinctly. Returns [{ text, hit }, ...]. Runs on folded text, so a
    // full-width or differently-cased match is highlighted where it really sits,
    // and a fuzzy hit paints each matched character run.
    function highlightParts(text, q, fuzzy) {
      var parts = [];
      if (!text) return parts;
      var fq = foldQuery(q);
      if (!fq) return [{ text: text, hit: false }];
      var hits = findMatches(foldWithMap(text), fq, !!fuzzy);
      if (hits.length === 0) return [{ text: text, hit: false }];
      var cursor = 0;
      for (var i = 0; i < hits.length; i++) {
        var ranges = hits[i].ranges;
        for (var r = 0; r < ranges.length; r++) {
          var from = ranges[r][0];
          var to = ranges[r][1];
          if (from < cursor || to <= from) continue;
          if (from > cursor) parts.push({ text: text.slice(cursor, from), hit: false });
          parts.push({ text: text.slice(from, to), hit: true });
          cursor = to;
        }
      }
      if (cursor < text.length) parts.push({ text: text.slice(cursor), hit: false });
      return parts;
    }

    // A one-line window around the first hit of `q` in `text` (for search results).
    function snippetAround(text, q, span, fuzzy) {
      if (!text) return "";
      var flat = text.replace(/\s+/g, " ").trim();
      var fq = foldQuery(q);
      var folded = fq ? foldWithMap(flat) : null;
      var hits = folded ? findMatches(folded, fq, !!fuzzy) : [];
      if (hits.length === 0) return previewText(flat, span * 2);
      var at = folded.map[hits[0].ranges[0][0]];
      var start = Math.max(0, at - span);
      var end = Math.min(flat.length, at + span * 2);
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

    // wrap every hit of q inside row's text nodes; the hit at `currentOcc` gets a
    // distinct "current" highlight. Matching runs on FOLDED text (case/full-width/
    // whitespace insensitive) and, in fuzzy mode, on subsequences — a hit is then a
    // set of character ranges, so one fuzzy hit can paint several spans.
    // NOTE: these fills sit ON TOP OF conversation text, so they stay deliberately
    // stronger than the panel's UI tints (C.chip / C.groupTint); only the current
    // hit's outline reuses the shared accent value.
    function highlightRow(row, q, currentOcc, fuzzy) {
      if (!row || !q) return;
      var fq = foldQuery(q);
      if (!fq) return;
      var walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT, null);
      var textNodes = [];
      while (walker.nextNode()) textNodes.push(walker.currentNode);
      var occ = 0;
      for (var i = 0; i < textNodes.length; i++) {
        var node = textNodes[i];
        var text = node.nodeValue;
        if (!text) continue;
        var hits = findMatches(foldWithMap(text), fq, !!fuzzy);
        if (hits.length === 0) continue;
        var frag = document.createDocumentFragment();
        // EVERY hit inside this text node must be wrapped, in order: the caller
        // addresses hits by their global index (`occ`), which is counted over the
        // message text. Wrapping only the first one per text node made a second
        // hit on the same line un-markable, so stepping to it found no
        // `.dqt-current` and fell back to a plain scroll with no highlight.
        var cursor = 0;
        for (var h = 0; h < hits.length; h++) {
          var isCurrent = occ === currentOcc;
          occ++;
          var ranges = hits[h].ranges;
          for (var r = 0; r < ranges.length; r++) {
            var from = ranges[r][0];
            var to = ranges[r][1];
            if (from < cursor || to <= from) continue;
            if (from > cursor) frag.appendChild(document.createTextNode(text.slice(cursor, from)));
            var mark = document.createElement("span");
            if (isCurrent) {
              mark.className = "dqt-current";
              mark.style.background = "rgba(79,140,255,0.55)";
              mark.style.boxShadow = "0 0 0 1px rgba(79,140,255,0.85)";
            } else {
              mark.style.background = "rgba(79,140,255,0.32)";
            }
            mark.style.borderRadius = "2px";
            mark.style.color = "inherit";
            mark.textContent = text.slice(from, to);
            frag.appendChild(mark);
            highlightSpans.push(mark);
            cursor = to;
          }
        }
        if (cursor < text.length) frag.appendChild(document.createTextNode(text.slice(cursor)));
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
      // terminal turn failures (a reply that never arrived) get the host's own
      // error colour, so the outline speaks the same language as the transcript
      error: "var(--dsw-alias-state-error-primary, #e5534b)",
      hover: "var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.08))",
      // ONE source for every "this control is on / this button is open / this match
      // is current" tint, so the panel cannot drift into five near-identical blues.
      chip: "rgba(79, 140, 255, 0.18)",
      // the followed group is a LARGE surface: same hue, lighter fill, with a
      // closing outline + accent bar so the block reads as a finished shape.
      groupTint: "rgba(79, 140, 255, 0.10)",
      groupEdge: "rgba(79, 140, 255, 0.85)",
      groupEdgeSoft: "rgba(79, 140, 255, 0.35)"
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
            children: T("error.panel") + msg
          });
        }
        return this.props.children;
      };
      return EB;
    })();

    // ---------- component ----------
    // The bail-out lives in this OUTER component, which deliberately calls NO hooks:
    // a slot occupant can be rendered once without session props and again with them
    // (a remount, a store that binds late), and a guard that returns before/after a
    // different number of hooks makes React abort the whole panel with
    // "Rendered more hooks than during the previous render" (#310). The hooks all
    // live in the body below, which is only ever mounted with complete props.
    function OutlinePanel(props) {
      if (!props.useChat) {
        console.warn("[dsh-quick-toc] useChat prop missing (requires DSH >= 0.1.5-rc.1)");
        return null;
      }
      return react_jsx_runtime.jsx(OutlinePanelBody, props);
    }

    function OutlinePanelBody(props) {
      // Recent DSH (0.1.5-rc.1): the conversation moved out of the session snapshot —
      // it is now the session-scope `chat` hook (ChatSnapshot: order + nodes
      // map + legacy projection), contributed by dsh-client-ui-chat. Same node
      // shape as before (kind user/assistant-step, location.turn, data.blocks).
      var useChat = props.useChat;
      var order = useChat(function (s) { return s.order; });
      var nodes = useChat(function (s) { return s.nodes; });

      // Whole-log turn index: the host's `turnOutline` projection
      // (@deepseek-ai/dsh-session-turn-outline) names EVERY turn of the session —
      // including turns the paged event window has not loaded yet — with a bounded
      // prompt/response preview and the `turn/start` seq that pages history to it.
      // On a host without that projection the value is undefined and the panel
      // behaves exactly like 0.4.1 (loaded turns only).
      var useProjection = props.useProjection;
      var rawOutline = useProjection ? useProjection("turnOutline") : null;
      // { sessions() } bridge to the host session face, injected by apply().
      // It is a LOOKUP (ctx.get), not a cached reference: the service may be
      // registered after this package loads, and an unloaded provider must not
      // leave a stale handle behind.
      var tocHost = props.tocHost;
      var sessionId = props.sessionId;
      var hostSessions = function () {
        if (!tocHost || typeof tocHost.sessions !== "function") return null;
        try {
          return tocHost.sessions();
        } catch (e) {
          return null;
        }
      };
      // Which stage of the bridge is actually ready — reported once at mount so a
      // missing jump loader can be diagnosed from the console instead of guessed.
      var jumpLoaderState = function () {
        var sessions = hostSessions();
        if (!sessions) return "no-sessions-service";
        if (typeof sessions.binding !== "function") return "no-binding-api";
        var binding = null;
        try {
          binding = sessions.binding(sessionId);
        } catch (e) {
          return "binding-threw";
        }
        var face = binding && binding.session;
        if (!face) return "no-binding-for-session";
        return typeof face.loadThrough === "function" ? "ready" : "no-loadThrough";
      };

      // Structural narrowing of that projection (its value crosses the wire):
      // `turn` and `seq` are load-bearing — an entry without them cannot be
      // shown or jumped to — while the previews are decorative and degrade to "".
      var outlineTurns = react.useMemo(function () {
        var list = Array.isArray(rawOutline) ? rawOutline
          : (rawOutline && Array.isArray(rawOutline.turns) ? rawOutline.turns : null);
        if (!list) return null; // projection unavailable: loaded turns only
        var out = [];
        for (var i = 0; i < list.length; i++) {
          var e = list[i];
          if (!e || typeof e !== "object") continue;
          if (typeof e.turn !== "number" || !isFinite(e.turn) || e.turn < 0) continue;
          if (typeof e.seq !== "number" || !isFinite(e.seq) || e.seq < 0) continue;
          out.push({
            turn: e.turn,
            seq: e.seq,
            prompt: typeof e.prompt === "string" ? e.prompt : "",
            response: typeof e.response === "string" ? e.response : ""
          });
        }
        return out;
      }, [rawOutline]);

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

      // dock side: 'left' | 'right' (the store owns persistence, legacy-key migration
      // and the default; the panel keeps a live copy so drags stay instant)
      var _s3 = react.useState(function () { return prefsStore.get().dock; });
      var dock = _s3[0];
      var setDock = _s3[1];
      var toggleDock = function () {
        setDock(dock === "right" ? "left" : "right");
      };

      // vertical drag offset (the store owns the key and the legacy-key migration)
      var _s4 = react.useState(function () { return prefsStore.get().y; });
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

      // panel size (the store owns the keys; width 0 = the panel default, height 0 = auto)
      var _s7 = react.useState(function () { return prefsStore.get().w || PANEL_WIDTH; });
      var panelW = _s7[0];
      var setPanelW = _s7[1];
      var _s8 = react.useState(function () { return prefsStore.get().h; });
      var panelH = _s8[0];
      var setPanelH = _s8[1];

      // ---- heading level filter (the store owns the key and the legacy migration) ----
      // An arbitrary SET of levels, not a "show up to N" prefix: every chip is an
      // independent on/off switch, so H1 + H3 without H2 is a valid view. Turning
      // the last remaining level off restores all six (the panel is never empty).
      var ALL_LEVELS = LEVELS_ALL;
      var _sLv = react.useState(function () { return prefsStore.get().levels.slice(); });
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
      var panelRootRef = react.useRef(null); // the panel box itself (for its live height)
      var didInitScroll = react.useRef(false);
      var outlineTouchRef = react.useRef(0); // last time the user touched the outline
      var lastScrollTopRef = react.useRef(0);
      var lastHostClickRef = react.useRef(0); // throttle for the "load earlier" click

      // ---- "back to the newest row" button ------------------------------------
      // The list can be scrolled far up into history (that is the whole point of
      // paging), and the newest turns are then a long scroll away. The button
      // appears whenever the list is NOT parked at its bottom and disappears once it
      // is. `atBottomRef` mirrors the state so the scroll handler can tell "changed"
      // from "same value" without depending on a stale render closure.
      var _sAtBottom = react.useState(true);
      var atBottom = _sAtBottom[0];
      var setAtBottom = _sAtBottom[1];
      var atBottomRef = react.useRef(true);
      // a few px of slack: scrollTop is fractional and sub-pixel remainders are
      // normal at the end of a smooth scroll
      var syncAtBottom = function (el) {
        if (!el) return;
        var max = el.scrollHeight - el.clientHeight;
        var next = max <= 4 || el.scrollTop >= max - 4;
        if (next !== atBottomRef.current) {
          atBottomRef.current = next;
          setAtBottom(next);
        }
      };
      var scrollToBottom = function (e) {
        if (e && e.stopPropagation) e.stopPropagation();
        outlineTouchRef.current = Date.now();
        hoverEnd();
        var el = listRef.current;
        if (!el) return;
        // optimistic: the list is on its way to the newest row, so the button starts
        // fading at once; if the user interrupts the scroll the handler brings it back
        atBottomRef.current = true;
        setAtBottom(true);
        if (typeof el.scrollTo === "function") el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
        else el.scrollTop = el.scrollHeight;
      };

      // ---- "scroll up to load earlier messages" hint (search mode) -----------
      // Armed by a search when older history is still reachable; dismissed the
      // moment the reader scrolls up (which is when the older page starts loading,
      // so the hint has done its job). "" | "more" | "oldest"
      var _sHint = react.useState("");
      var hint = _sHint[0];
      var setHint = _sHint[1];

      // ---- transient edge banner (outline mode) ------------------------------
      // Reaching either end of the outline flashes a short bar over the bottom of
      // the list: fade in, hold a few seconds, fade out. Deliberately NOT the same
      // element as the search hint above (which stays until the reader acts).
      var _sToast = react.useState(null);
      var toast = _sToast[0];
      var setToast = _sToast[1];
      var toastTimersRef = react.useRef({ hold: null, out: null });
      var showBanner = function (text) {
        if (toastTimersRef.current.hold) clearTimeout(toastTimersRef.current.hold);
        if (toastTimersRef.current.out) clearTimeout(toastTimersRef.current.out);
        setToast({ text: text, closing: false });
        toastTimersRef.current.hold = setTimeout(function () {
          setToast(function (cur) { return cur === null ? null : { text: cur.text, closing: true }; });
          toastTimersRef.current.out = setTimeout(function () { setToast(null); }, 460);
        }, 2600);
      };

      // ---- hover preview card -------------------------------------------------
      // Hovering an outline/result row opens a card with the section's opening
      // lines; it lives in the body portal so the scrolling list cannot clip it.
      var _sHov = react.useState(null);
      var hoverCard = _sHov[0];
      var setHoverCard = _sHov[1];
      var _sHovOut = react.useState(false);
      var hoverClosing = _sHovOut[0];
      var setHoverClosing = _sHovOut[1];
      var hoverTimerRef = react.useRef(null);
      var hoverCloseTimerRef = react.useRef(null);
      var hoverStart = function (info, el) {
        // the hover card is a preference: off means it never opens (the outline rows
        // themselves keep their hover tint)
        if (!prefsStore.get().hover) return;
        if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = setTimeout(function () {
          var r = el && el.getBoundingClientRect ? el.getBoundingClientRect() : null;
          if (!r || r.width <= 0) return;
          if (hoverCloseTimerRef.current) {
            clearTimeout(hoverCloseTimerRef.current);
            hoverCloseTimerRef.current = null;
          }
          setHoverClosing(false);
          setHoverCard({
            title: info.title,
            sub: info.sub,
            preview: info.preview,
            meta: info.meta,
            ghost: info.ghost,
            top: r.top,
            left: r.left,
            right: r.right
          });
        }, 260);
      };
      // leaving fades the card out instead of dropping it on the next frame
      var hoverEnd = function () {
        if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
        if (hoverCloseTimerRef.current) clearTimeout(hoverCloseTimerRef.current);
        setHoverClosing(true);
        hoverCloseTimerRef.current = setTimeout(function () {
          hoverCloseTimerRef.current = null;
          setHoverCard(null);
          setHoverClosing(false);
        }, 240);
      };

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
      // ---- fuzzy matching: an independent switch beside the scope pill --------
      // Off (default) = the folded CONTIGUOUS match. On = subsequence matching, so
      // keywords tolerate text wedged in between ("模糊匹配" also finds "模糊的匹配").
      var _sFz = react.useState(function () { return prefsStore.get().fuzzy; });
      var fuzzy = _sFz[0];
      var setFuzzy = _sFz[1];
      var toggleFuzzy = function () {
        setFuzzy(!fuzzy);
        setMatchIdx(0);
      };

      // ---- preference plumbing -------------------------------------------------
      // The store is the shared source (the native Settings section writes into it);
      // the states above are the panel's LIVE copy, so a drag or a toggle never waits
      // for a round-trip. `lastSeen` records every value the panel has already agreed
      // on, which is what separates "someone else changed this" (adopt it) from "the
      // panel itself just changed it" (leave the live value alone — otherwise a stale
      // store value would snap a half-finished drag back).
      //
      // Both effects MUST agree on the exact shape they compare, so every entry is kept
      // in the panel's own form rather than the stored one: `levels` as the joined key
      // (never the raw array) and `w` as the EFFECTIVE pixel width (a stored 0 only
      // means "the panel default"). Recording the raw stored value instead makes the
      // two comparisons disagree forever — the panel then republishes its default on
      // every pass and stomps a fresh change with the value it had just read back.
      var prefs = usePrefs();
      // Resolve the language for this render FIRST: the group builder below bakes the
      // localised turn stamps (昨天 versus a numeric date) into its memo, and `langKey`
      // is what tells that memo a language switch has to rebuild it.
      var langKey = setLanguage(prefs.lang, hostLanguage());
      // What the panel last handed to the store. A store value that comes back equal to
      // this is our own echo, not news — and the panel may already have moved on: it
      // restores all six levels the moment the last one is switched off, long before
      // that restore is written out, and the echo of the previous write would otherwise
      // undo it. So only a value that differs from BOTH the live state and this record is
      // an external change worth adopting. Size and position are not adopted at all:
      // this panel is their only writer, so a pull can never bring news, only a stale
      // copy — which is exactly what made a drag spring back to its previous size.
      var sent = react.useRef({
        dock: prefs.dock, y: prefs.y, w: prefs.w || PANEL_WIDTH, h: prefs.h,
        levels: prefs.levels.join(","), fuzzy: prefs.fuzzy
      });
      react.useEffect(function () {
        var localLevels = levels.join(",");
        var storeLevels = prefs.levels.join(",");
        if (prefs.dock !== dock && prefs.dock !== sent.current.dock) setDock(prefs.dock);
        if (storeLevels !== localLevels && storeLevels !== sent.current.levels) setLevels(prefs.levels.slice());
        if (prefs.fuzzy !== fuzzy && prefs.fuzzy !== sent.current.fuzzy) setFuzzy(prefs.fuzzy);
      }, [prefs]);
      // ...and publish the panel's own changes back, debounced: a drag fires on every
      // pointer move and the Settings section does not need that resolution.
      //
      // The record of what has been published advances only when the write actually
      // happens. This effect re-runs on EVERY change and its cleanup cancels the
      // pending timer, so a second adjustment inside the 400ms window replaces the
      // first one's patch; an eagerly advanced record would leave the cancelled field
      // looking published, the next pass would find nothing to publish, and the value
      // just dragged would never reach storage (measured in Edge: drag the width
      // 200 -> 150, drag the height 250ms later — the stored width stayed 200 and the
      // next load brought the panel back 50px wider than it was left).
      react.useEffect(function () {
        var seen = sent.current;
        var nextLevels = levels.join(",");
        var patch = {};
        if (dock !== seen.dock) patch.dock = dock;
        if (panelY !== seen.y) patch.y = panelY;
        if (panelW !== seen.w) patch.w = panelW;
        if (panelH !== seen.h) patch.h = panelH;
        if (nextLevels !== seen.levels) patch.levels = levels.slice();
        if (fuzzy !== seen.fuzzy) patch.fuzzy = fuzzy;
        if (!Object.keys(patch).length) return;
        // agree on the panel's form of each published value (see the note above), so the
        // next pass — including the one the store's own notification triggers — finds
        // nothing left to publish and the debounced write cannot bounce back
        var has = function (key) { return Object.prototype.hasOwnProperty.call(patch, key); };
        var timer = setTimeout(function () {
          if (has("dock")) seen.dock = patch.dock;
          if (has("y")) seen.y = patch.y;
          if (has("w")) seen.w = patch.w;
          if (has("h")) seen.h = patch.h;
          if (has("levels")) seen.levels = nextLevels;
          if (has("fuzzy")) seen.fuzzy = patch.fuzzy;
          prefsStore.set(patch);
        }, 400);
        return function () { clearTimeout(timer); };
      }, [dock, panelY, panelW, panelH, levels, fuzzy]);

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
        var liftOffBottom = function () {
          // DSH re-pins the transcript to the newest message whenever it sees a
          // scroll it does not attribute to the reader while it still believes the
          // reader is at the bottom (`toBottom`). Paging history in from the OUTLINE
          // is exactly that case: the prepend compensation DSH applies is a
          // programmatic scroll, `atBottomRef` was never cleared (the reader never
          // touched the transcript), so the page-in is immediately undone and the
          // whole view — and with it the outline's follow — snaps back to the newest
          // turn. Nudging the transcript just past DSH's 25px stick zone first makes
          // that scroll read as a reader movement, so the page-in keeps its place.
          // (Same trick `glideTo` uses so a jump is not yanked back.)
          var sp = document.querySelector("[data-conversation-scroll]");
          if (!sp) return;
          var floor = Math.max(0, sp.scrollHeight - sp.clientHeight);
          if (floor - sp.scrollTop <= 25) sp.scrollTop = Math.max(0, floor - 26);
        };
        var viaHost = function () {
          var btn = findLoadOlderButton();
          if (!btn || btn.disabled) return false;
          liftOffBottom();
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
          return true;
        };
        var viaHostThrottled = function () {
          var now = Date.now();
          if (now - lastHostClickRef.current < 900) return false;
          if (!findLoadOlderButton()) return false;
          lastHostClickRef.current = now;
          return viaHost();
        };
        // In SEARCH mode the list shows matches, not the outline: paging the
        // outline's own window would change nothing the reader can see, whereas
        // loading the conversation's older messages extends what the search can
        // cover at all (the whole-log index only carries bounded previews). So the
        // host's own "load earlier" comes first while a query is active.
        if (query.trim() !== "") return viaHost() || grow();
        // Outline mode keeps the ORIGINAL contract: scrolling the outline up also
        // pulls the conversation's older messages in (that is what makes the outline
        // a substitute for scrolling the transcript), not merely more index entries.
        // The host click is throttled so one continuous scroll cannot hammer the
        // pager; grow() still runs first so the index never lags behind the window.
        var grew = grow();
        return viaHostThrottled() || grew;
      };

      // older history still reachable? the outline can always page its own window
      // further, and beyond that the conversation's own "load older" button decides
      var canLoadOlder = function () {
        return visibleCount < groups.length || !!findLoadOlderButton();
      };

      // wheel up (toward older) loads more when the list is at its top or has
      // nothing to scroll (content shorter than the panel) — so scrolling up
      // always refreshes older turns, even without a visible scrollbar
      var onListWheel = function (e) {
        outlineTouchRef.current = Date.now();
        var el = listRef.current;
        if (!el) return;
        hoverEnd();
        if (e.deltaY >= 0) {
          // still scrolling down at the very end of the outline: say so. Outline
          // mode only — the search list has its own persistent hint line.
          var max = el.scrollHeight - el.clientHeight;
          if (max > 4 && el.scrollTop >= max - 4 && query.trim() === "") showBanner(T("hint.bottom"));
          return;
        }
        if (hint === "more") setHint(""); // scrolling up is what the hint asked for
        if (el.scrollTop <= 1) {
          var progressed = loadOlderOutline(el);
          if (!progressed) {
            if (query.trim() !== "") {
              if (hint !== "oldest") setHint("oldest");
            } else {
              showBanner(T("search.hintOldest"));
            }
          }
        }
      };

      // scroll to the top edge also loads older groups (keeps the visual position)
      var onListScroll = function (e) {
        outlineTouchRef.current = Date.now();
        var el = e.currentTarget;
        syncAtBottom(el);
        var upward = el.scrollTop < lastScrollTopRef.current - 2;
        if (upward) {
          if (hint === "more") setHint("");
          if (hoverCard) hoverEnd();
        }
        lastScrollTopRef.current = el.scrollTop;
        if (el.scrollTop <= 24) {
          // Reaching the top is the ONLY place the exhausted case can be told
          // apart from "keep scrolling": after a search the list is parked at the
          // bottom, so the first wheel-up merely scrolls and never gets here.
          var progressed = loadOlderOutline(el);
          if (!progressed && upward) {
            if (query.trim() !== "") {
              if (hint !== "oldest") setHint("oldest");
            } else {
              showBanner(T("search.hintOldest"));
            }
          }
        }
      };

      // ---- panel scale (prefs.zoom) ------------------------------------------
      // The preference magnifies what is INSIDE the panel — text, icons, buttons and
      // their spacing — and never the panel's own box: the reader keeps full control
      // of the size by dragging. A CSS zoom on the panel would scale the box as well,
      // so every length that defines the box is divided by the factor and zoom
      // multiplies it straight back: the box stays exactly the size that was dragged
      // while the content inside is magnified (and simply shows less of itself).
      // Measured on this Chromium: zoom scales the element's own box, its insets, its
      // clip-path and viewport units, and getBoundingClientRect reports the scaled
      // (visual) values.
      var zoom = prefs.zoom > 0 ? prefs.zoom : 1;
      // a length that must keep its VISUAL value under zoom (zoom multiplies it back)
      var zLen = function (v) {
        if (zoom === 1) return typeof v === "number" ? v + "px" : v;
        return typeof v === "number" ? (v / zoom) + "px" : "calc(" + v + " / " + zoom + ")";
      };

      // ---- resize drags (right edge = width, bottom edge = height) ----
      // No upper bound and only a keep-it-usable floor: the reader decides how small
      // the panel gets. The drags only move the live state; the preference effect
      // persists the settled value (debounced), so there is exactly one writer.
      // A panel whose height is still "auto" (never dragged) starts from its REAL
      // height: the old fixed 400px guess made the panel jump on the first pointer
      // move. getBoundingClientRect reports the visual (post-zoom) height, which is
      // the same unit panelH is stored in.
      var dragStartH = function () {
        if (panelH > 0) return panelH;
        var el = panelRootRef.current;
        if (el && el.getBoundingClientRect) {
          var h = el.getBoundingClientRect().height;
          if (h > 0) return h;
        }
        return 400; // nothing measurable yet: a sane starting point
      };
      var onResizeWDown = function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (e.button !== 0) return;
        var startX = e.clientX;
        var startW = panelW;
        var move = function (ev) {
          setPanelW(Math.max(120, startW + (ev.clientX - startX)));
        };
        var up = function () {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      };
      var onResizeHDown = function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (e.button !== 0) return;
        var startY = e.clientY;
        var startH = dragStartH();
        var move = function (ev) {
          setPanelH(Math.max(60, startH + (ev.clientY - startY)));
        };
        var up = function () {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
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
        var startH = dragStartH();
        var move = function (ev) {
          setPanelW(Math.max(120, startW + (ev.clientX - startX)));
          setPanelH(Math.max(60, startH + (ev.clientY - startY)));
        };
        var up = function () {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      };

      // ---- node timestamp -> a readable stamp (helpers live at module scope so the
      // language-sensitive formatting has exactly one home) ----
      // ---- best-effort node time across common field names ----
      var getNodeTime = function (node) {
        var d = node && node.data;
        if (!d) return "";
        var t = d.time !== undefined ? d.time : (d.createdAt !== undefined ? d.createdAt : d.timestamp);
        return fmtStampOf(t);
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
        // A turn's group is anchored by EVERY node that belongs to it — the user
        // message, its assistant steps, and the terminal `turn-error` the host
        // publishes when a request never produced a reply. Without the error node a
        // timed-out turn had no time and no headings, so it was dropped here and the
        // host outline re-listed it as "未加载" even though it was fully loaded.
        var anchorKind = function (kind) { return kind === "user" || kind === "assistant-step" || kind === "turn-error"; };
        // first pass: per-turn time — the LAST message of the turn wins (end time);
        // also remember each turn's user message key + first-line preview + full text
        for (var i = 0; i < order.length; i++) {
          var k0 = order[i];
          var n0 = nodes.get(k0);
          if (!n0 || !anchorKind(n0.kind)) continue;
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
        // second pass: group assistant headings + full reply texts by turn, and
        // record a turn's terminal failure so the outline can say WHY it is empty
        for (var j = 0; j < order.length; j++) {
          var key = order[j];
          var node = nodes.get(key);
          if (!node || !anchorKind(node.kind)) continue;
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
              failure: null,
              msgs: [],
              headings: []
            };
            result.push(current);
          }
          seen[key] = true;
          if (node.kind === "turn-error") {
            // the host's terminal failure row: the turn ended without a reply, so
            // the outline shows the reason instead of pretending it is unloaded
            if (current.failure === null) {
              current.failure = {
                key: key,
                message: (node.data && node.data.message) || "",
                code: (node.data && node.data.code) || ""
              };
            }
            continue;
          }
          if (node.kind !== "assistant-step") continue;
          var info = nodeInfo(key, node);
          current.msgs.push({ key: key, text: info.text });
          for (var k = 0; k < info.headings.length; k++) {
            current.headings.push({
              level: info.headings[k].level,
              title: info.headings[k].title,
              key: key,
              idx: k,
              sub: info.headings[k].sub,
              preview: info.headings[k].preview
            });
          }
        }
        pruneNodeInfo(seen);
        // keep a turn when it has headings, a time, a loaded prompt or a failure —
        // turns without headings still get a standalone time entry (click to jump)
        var ready = result.filter(function (g) {
          return g.headings.length > 0 || g.time !== "" || g.userKey !== "" || g.failure !== null;
        });
        if (outlineTurns === null) return ready;
        // ---- merge the whole-log turn index ---------------------------------
        // Loaded groups keep their order (a group whose node carries no turn
        // location stays where it was found); every turn the paged window has not
        // loaded yet becomes an "unloaded" entry in the gap where it belongs, so
        // the outline covers the whole session and heading-less turns stay
        // reachable by number. Preview text comes from the projection and is
        // bounded by it (host-side 50/120 character budgets).
        var merged = [];
        var li = 0;
        for (var ei = 0; ei < outlineTurns.length; ei++) {
          var entry = outlineTurns[ei];
          while (li < ready.length && (ready[li].turn === null || ready[li].turn < entry.turn)) {
            merged.push(ready[li]);
            li++;
          }
          if (li < ready.length && ready[li].turn === entry.turn) continue; // emitted above
          merged.push({
            turn: entry.turn,
            seq: entry.seq,
            ghost: true,
            time: "",
            userKey: "",
            userText: entry.prompt,
            userFull: "",
            failure: null,
            msgs: [],
            headings: [],
            preview: entry.response
          });
        }
        while (li < ready.length) { merged.push(ready[li]); li++; }
        return merged;
      }, [order, nodes, outlineTurns, langKey]);
      // first time content appears, scroll the list to the bottom (newest).
      // NOTE: must stay BELOW the `groups` memo — a deps array is evaluated
      // during render, so reading `groups` before that `var` is assigned would
      // freeze the deps at 0 and the effect would only ever run on mount.
      react.useEffect(function () {
        if (didInitScroll.current || !listRef.current || groups.length === 0) return;
        didInitScroll.current = true;
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }, [groups.length]);
      // The "back to the newest row" button follows the list's real geometry, and a
      // bottom can be reached WITHOUT a scroll event: older turns page in, a search
      // replaces the rows, the panel is resized, the panel is expanded/collapsed.
      // Also must stay below `groups` (deps arrays read the vars eagerly).
      react.useEffect(function () {
        syncAtBottom(listRef.current);
      }, [groups.length, query, visibleCount, panelW, panelH, open]);
      // Mount diagnostic: the host capabilities this panel actually reached
      // (whole-log turn index + jump loader). SILENT by default — a normal console
      // should stay clean — and switched on from the plugin-configuration card
      // ("print the mount diagnostic"), which persists the flag in the host settings
      // document. Kept because it is the fastest way to tell "the host has no
      // turnOutline projection" apart from "the jump-loader bridge is broken".
      var mountLogRef = react.useRef(false);
      react.useEffect(function () {
        if (mountLogRef.current) return;
        if (!prefsStore.get().debug) return; // the host has not answered yet, or it is off
        mountLogRef.current = true;
        console.log("[dsh-quick-toc] panel mounted · turnOutline=" +
          (outlineTurns ? outlineTurns.length + " turns" : "unavailable") +
          " · jumpLoader=" + jumpLoaderState() +
          " · lang=" + activeLang + (langPref === "auto" ? " (auto)" : "") +
          " · prefs=" + JSON.stringify(prefsStore.get()));
        // `prefs` too: the host snapshot answers after mount, so a switch turned on in
        // the card prints on the spot instead of asking for a reload
      }, [outlineTurns, prefs]);

      // Locator fallback for a turn the jump loader just paged in: once the paged
      // window covers the turn, OUR OWN rebuilt outline has a loaded group for it,
      // which carries that turn's node keys — that path does not depend on the host
      // keeping a `data-chat-turn` attribute on the row.
      //
      // NOTE: this hook pair lives HERE, with the other hooks, and NOT next to the
      // function that reads it further down. Hooks must run on EVERY render: the
      // panel bails out early while the conversation is still empty (no groups), so a
      // hook declared after that return is skipped on the empty render and added back
      // on the next one — "Rendered more hooks than during the previous render"
      // (React #310), which killed the panel exactly when a session went from empty
      // to loaded.
      var groupsRef = react.useRef([]);
      react.useEffect(function () { groupsRef.current = groups; }, [groups]);

      var groupTrees = react.useMemo(function () {
        return groups.map(function (g) {
          if (levels.length === 6) return buildTree(g.headings, g.time);
          var kept = [];
          for (var i = 0; i < g.headings.length; i++) {
            if (levelSet[g.headings[i].level]) kept.push(g.headings[i]);
          }
          return buildTree(kept, g.time);
        });
      }, [groups, levels, levelSet]);
      // pagination slice: the latest `visibleCount` groups
      var shownGroups = groups.slice(Math.max(0, groups.length - visibleCount));
      var shownTrees = groupTrees.slice(groupTrees.length - shownGroups.length);

      // the group currently being read (the turn under the middle of the
      // CONVERSATION viewport) stays bright in the outline; others are dimmed.
      // Every node key of every loaded group -> its group index: mapping ONLY the
      // heading-bearing messages meant a turn with no markdown headings had no
      // entry at all, so a jump that landed on it (the host's own turn rail, for
      // one) could never light up or follow in the outline.
      var keyToGroup = react.useMemo(function () {
        var m = {};
        for (var i = 0; i < groups.length; i++) {
          var g = groups[i];
          if (g.ghost) continue; // no loaded rows to match
          if (g.userKey) m[g.userKey] = i;
          if (g.failure) m[g.failure.key] = i;
          for (var j = 0; j < g.headings.length; j++) {
            m[g.headings[j].key] = i;
          }
          for (var k = 0; k < g.msgs.length; k++) {
            m[g.msgs[k].key] = i;
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
        var fq = foldQuery(query);
        if (!fq) return [];
        var needle = { folded: fq }; // one folded query, reused for every text
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
          // a turn the paged window has not loaded: searchable through the host
          // outline's bounded previews, and clicking it pages the turn in first
          if (g.ghost) {
            if (searchScope === "full") {
              var gtext = (g.userText || "") + "\n" + (g.preview || "");
              var ng = countOccurrences(gtext, needle, fuzzy);
              if (ng > 0) {
                push({
                  gi: gi, key: "", idx: undefined,
                  title: previewText(g.userText || g.preview || "", 40),
                  level: 0, path: "", time: "",
                  snippet: snippetAround(g.preview || g.userText || "", fq, 36, fuzzy),
                  ghost: true, turn: g.turn, seq: g.seq
                }, ng);
              }
            }
            continue;
          }
          for (var j = 0; j < g.headings.length; j++) {
            var h = g.headings[j];
            var nh = countOccurrences(h.title, needle, fuzzy);
            if (nh > 0) {
              var hp = headingPaths[headingId(h)];
              push({
                gi: gi, key: h.key, idx: h.idx, title: h.title, level: h.level,
                // the subtitle identifies same-titled headings ("which one?")
                path: hp ? hp.path : "", time: g.time, snippet: h.sub || ""
              }, nh);
            }
          }
          if (searchScope === "full") {
            var nu = g.userKey && g.userFull ? countOccurrences(g.userFull, needle, fuzzy) : 0;
            if (nu > 0) {
              push({
                gi: gi, key: g.userKey, idx: undefined, title: previewText(g.userFull, 40),
                level: 0, path: "", time: g.time, snippet: snippetAround(g.userFull, fq, 36, fuzzy)
              }, nu);
            }
            for (var m = 0; m < g.msgs.length; m++) {
              var msg = g.msgs[m];
              if (!msg.text) continue;
              var nm = countOccurrences(msg.text, needle, fuzzy);
              if (nm === 0) continue;
              push({
                gi: gi, key: msg.key, idx: undefined, title: previewText(msg.text, 40),
                level: 0, path: "", time: g.time, snippet: snippetAround(msg.text, fq, 36, fuzzy)
              }, nm);
            }
            // a failed turn's provider message is searchable too — "timed out" must
            // find the turns it killed
            if (g.failure && g.failure.message) {
              var nf = countOccurrences(g.failure.message, needle, fuzzy);
              if (nf > 0) {
                push({
                  gi: gi, key: g.failure.key, idx: undefined, title: previewText(g.failure.message, 40),
                  level: 0, path: "", time: g.time, failed: true,
                  snippet: snippetAround(g.failure.message, fq, 36, fuzzy)
                }, nf);
              }
            }
          }
        }
        return rows;
      }, [groups, query, searchScope, headingPaths, fuzzy]);
      // ---- auto-follow: which turn is the reader looking at -------------------
      // This used to hang off ONE scroll listener bound to the scrollport element
      // captured when the effect ran. DSH can replace that element (a jump that
      // repages the window remounts the list), and the listener then stays on the
      // detached node — the outline silently stops following. So it re-queries the
      // scrollport on every run, listens on the DOCUMENT in the capture phase
      // (scroll does not bubble; capture still sees every descendant), and keeps a
      // slow poll for programmatic anchor adjustments that emit no scroll event.
      //
      // The outline's own scroll is INSTANT and starts on the next frame: a following
      // rail that animates its way to the target reads as permanently one step behind.
      react.useEffect(function () {
        var followFrame = null;
        var followTimer = null;
        var lastRun = 0;
        var update = function (force) {
          // a jump glide carries the conversation past many turns; following each
          // transient position would make the rail sprint through the whole
          // outline (wild jumps on rapid consecutive clicks), so hold still while
          // one is in flight — the poll syncs the rail to the landing afterwards
          if (glide) return;
          // scroll frames are hot and a document-level capture listener sees every
          // scroll in the app; the rail only changes when a different turn crosses
          // the viewport, so cap the row measurement at ~16/s
          var now = Date.now();
          if (!force && now - lastRun < 60) return;
          lastRun = now;
          if (!chatViewRef.current) return;
          var sp = document.querySelector("[data-conversation-scroll]");
          if (!sp) return;
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
          if (sig === activeSigRef.current) return;
          activeSigRef.current = sig;
          setActiveGroup(actives);
          if (actives.length === 0) return;
          // pause right after the reader touched the outline themselves —
          // otherwise paging older turns gets yanked back to the newest group
          if (Date.now() - outlineTouchRef.current <= 1500) return;
          var gi0 = actives[0];
          setVisibleCount(function (prev) {
            var need = groups.length - gi0 + 3;
            return Math.max(prev, Math.min(groups.length, need));
          });
          if (followFrame) cancelAnimationFrame(followFrame);
          if (followTimer) clearTimeout(followTimer);
          var place = function () {
            var el = listRef.current;
            if (!el) return;
            var node = el.querySelector('[data-group-idx="' + gi0 + '"]');
            if (!node) return;
            var er = node.getBoundingClientRect();
            var lr2 = el.getBoundingClientRect();
            if (er.top < lr2.top - 2 || er.bottom > lr2.bottom + 2) {
              el.scrollTop = el.scrollTop + (er.top - lr2.top) - el.clientHeight / 2 + node.offsetHeight / 2;
            }
          };
          followFrame = requestAnimationFrame(function () { followFrame = requestAnimationFrame(place); });
          followTimer = setTimeout(place, 90); // the row may only exist after the expansion commits
        };
        update(true);
        document.addEventListener("scroll", update, { passive: true, capture: true });
        var poll = setInterval(function () { update(true); }, 250);
        return function () {
          document.removeEventListener("scroll", update, { capture: true });
          clearInterval(poll);
          if (followFrame) cancelAnimationFrame(followFrame);
          if (followTimer) clearTimeout(followTimer);
        };
      }, [keyToGroup]);

      // ---- search matches ----
      // "title" scope: heading titles only; "full" scope: also the user
      // message and every AI reply text of each turn.
      // Every occurrence counts (multiple hits inside one message = multiple
      // matches), so the n/N counter reflects the real total.
      var matches = react.useMemo(function () {
        var fq = foldQuery(query);
        if (!fq) return [];
        var needle = { folded: fq };
        var out = [];
        for (var gi = 0; gi < groups.length; gi++) {
          var g = groups[gi];
          if (g.ghost) {
            if (searchScope === "full") {
              var gtext = (g.userText || "") + "\n" + (g.preview || "");
              var ng = countOccurrences(gtext, needle, fuzzy);
              for (var cg = 0; cg < ng; cg++) {
                out.push({ gi: gi, title: g.userText || "", key: "", idx: undefined, ghost: true, turn: g.turn, seq: g.seq });
              }
            }
            continue;
          }
          for (var j = 0; j < g.headings.length; j++) {
            var h = g.headings[j];
            var n = countOccurrences(h.title, needle, fuzzy);
            for (var c = 0; c < n; c++) {
              out.push({ gi: gi, title: h.title, key: h.key, idx: h.idx });
            }
          }
          if (searchScope === "full") {
            if (g.userKey && g.userFull) {
              var nu = countOccurrences(g.userFull, needle, fuzzy);
              for (var cu = 0; cu < nu; cu++) {
                out.push({ gi: gi, title: previewText(g.userFull, 30), key: g.userKey, idx: undefined });
              }
            }
            for (var m = 0; m < g.msgs.length; m++) {
              var msg = g.msgs[m];
              if (!msg.text) continue;
              var nm = countOccurrences(msg.text, needle, fuzzy);
              for (var cm = 0; cm < nm; cm++) {
                out.push({ gi: gi, title: previewText(msg.text, 30), key: msg.key, idx: undefined });
              }
            }
          }
        }
        return out;
      }, [groups, query, searchScope, fuzzy]);

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
        if (!q) { setHint(""); return; }
        var el = listRef.current;
        if (el) el.scrollTop = el.scrollHeight;
        if (matches.length > 0) setMatchIdx(matches.length - 1);
        // arm the "scroll up for older messages" hint: the result list only covers
        // what the window holds, and older turns are one upward scroll away
        setHint(canLoadOlder() ? "more" : "");
      }, [query, matches.length]);

      // keep the outline filled: after opening the panel or dragging it taller,
      // the latest page may be shorter than the list viewport, leaving dead space
      // below the newest group. Grow the window until the content fills the height
      // (or every group is already shown). Outline mode only — the search list
      // grows with its matches.
      react.useEffect(function () {
        if (query.trim() !== "") return;
        var el = listRef.current;
        if (!el || el.clientHeight === 0) return;
        if (el.scrollHeight - el.clientHeight > 4) return; // content overflows: nothing blank below
        if (visibleCount >= groups.length) return;
        setVisibleCount(Math.min(groups.length, visibleCount + PAGE_SIZE));
      }, [groups.length, visibleCount, panelW, panelH, open, query]);

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

      // ---- crowded header: squeeze the middle, then scroll sideways -----------
      // Four fixed-size controls share one header row. While there is room, the
      // flexible spacer between the two pairs takes up the slack; once the controls
      // would touch, the spacer is already at zero and the row becomes a sideways
      // scroll strip — the wheel scrolls it, and the grab bar above fades out because
      // there is no slack left to signal. Declared BEFORE the "nothing to show" return
      // below, so the hook count never depends on the data (the React #310 lesson).
      var headerRef = react.useRef(null);
      var _sCrowd = react.useState(false);
      var crowded = _sCrowd[0];
      var setCrowded = _sCrowd[1];
      // A scale change moves the box's LOCAL lengths while `zoom` itself cannot
      // animate: that single render skips the `left` transition instead of sliding.
      var prevZoom = react.useRef(zoom);
      var zoomJustChanged = prevZoom.current !== zoom;
      react.useEffect(function () { prevZoom.current = zoom; }, [zoom]);
      react.useEffect(function () {
        var el = headerRef.current;
        if (!el) return;
        var tight = el.scrollWidth > el.clientWidth + 1;
        setCrowded(function (prev) { return prev === tight ? prev : tight; });
      }, [open, panelW, zoom, dock, levelsOpen, searchOpen, groups.length]);
      react.useEffect(function () {
        var el = headerRef.current;
        if (!el) return;
        // `crowded` is captured here and the listener is re-attached whenever it
        // changes, so the hot path (every wheel event) reads no layout at all —
        // measuring scrollWidth per event would force a synchronous layout.
        if (!crowded) return;
        var onWheel = function (e) {
          var d = e.deltaY !== 0 ? e.deltaY : e.deltaX;
          if (!d) return;
          el.scrollLeft += d;
          e.preventDefault(); // the transcript behind must not scroll instead
          e.stopPropagation();
        };
        el.addEventListener("wheel", onWheel, { passive: false });
        return function () { el.removeEventListener("wheel", onWheel); };
      }, [open, crowded, groups.length]);

      // ---- nothing to show without headings ----
      if (groups.length === 0) return null;

      // ---- geometry: always position by `left` (px) so dock-switch & slide share one animated transition
      // (The scale preference leaves all of this alone: it acts on the panel's inner
      // box, so the panel itself keeps the width and height the reader dragged.)
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
      // the collapsed handle's vertical position (a 0..1 ratio of the conversation
      // area — 0 pins the handle to the BOTTOM, 1 to the top; 0.5 = centred, which is
      // exactly the previous fixed position)
      var handlePos = isFinite(Number(prefs.handle)) ? Math.min(1, Math.max(0, Number(prefs.handle))) : 0.5;
      var handleFromTop = 1 - handlePos; // the setting counts from the bottom up

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
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      };
      var handleBright = function (on) {
        // while the header is crowded the grab hint stays hidden even on hover
        if (handleRef.current) handleRef.current.style.opacity = crowded ? "0" : (on ? "1" : "0.35");
      };

      // ---- jump: glide to the exact heading element ---------------------------
      // The glide is the browser's own smooth scrolling. It runs off the wall
      // clock, not off a frame count, so it takes the same time on a 60Hz and on
      // a 240Hz panel, and it coasts to a stop instead of stopping dead. Three
      // guards, each one learned from a real failure:
      //   * DSH holds the transcript at the bottom. A jump upward has to step out
      //     of that 25px stick zone first, or the compensation scroll that comes
      //     with it undoes the jump.
      //   * A long jump makes the host page history in, which moves the target
      //     while the animation is running, and the host's own compensation
      //     scrolls cancel the animation outright. So the landing is watched and
      //     the call re-issued — but only on a real drift (>40px) or a real stop
      //     (>400ms with less than a pixel of movement). A watchdog that cannot
      //     tell a slow start from a dead scroll re-issues on every tick, and
      //     then the jump never animates at all: this curve begins with almost no
      //     movement by design.
      //   * If a browser carries the call out as an instant jump (none seen; the
      //     check is cheap) the glide is drawn frame by frame instead, over a
      //     real-time duration for the same reason as above.
      // A short re-check after the landing keeps it honest while the host
      // finishes measuring; a newer jump retires the previous one; and the
      // auto-follow stays out of the way while one is in flight.
      var scrollTargetOf = function (el, sp) {
        var t = el.getBoundingClientRect().top - sp.getBoundingClientRect().top + sp.scrollTop - 20;
        var floor = Math.max(0, sp.scrollHeight - sp.clientHeight);
        return Math.max(0, Math.min(t, floor));
      };
      var glideTo = function (el) {
        var sp = el.closest ? el.closest("[data-conversation-scroll]") : null;
        if (!sp) return;
        var t0 = scrollTargetOf(el, sp);
        var floor = Math.max(0, sp.scrollHeight - sp.clientHeight);
        if (floor - sp.scrollTop <= 25 && Math.abs(t0 - sp.scrollTop) > 60) {
          sp.scrollTop = Math.max(0, floor - 26); // break the stick-to-bottom hold first
        }
        var from = sp.scrollTop;
        var dist = Math.abs(t0 - from);
        if (dist < 2) return;
        if (glide) glide.done = true; // a newer jump takes over
        var mine = { done: false };
        glide = mine;
        var aimed = t0;
        var drawn = false;
        var landed = false;

        // landed: hand control back to the auto-follow immediately — holding the
        // glide until the re-checks finish would delay the "currently reading"
        // highlight by ~1s. The re-checks keep running in the background; they
        // only nudge small offsets, which cannot re-trigger the wild rail chase.
        var land = function () {
          if (landed) return;
          landed = true;
          if (glide === mine) glide = null;
          var ticks = 0;
          var iv = setInterval(function () {
            if (mine.done || (ticks += 1) > 5) { clearInterval(iv); return; }
            var next = scrollTargetOf(el, sp);
            if (Math.abs(next - sp.scrollTop) > 2) sp.scrollTop = next;
          }, 120);
        };

        // fallback: draw the glide ourselves, in real time, decelerating to a stop
        var draw = function () {
          if (drawn) return;
          drawn = true;
          var start = Math.abs(sp.scrollTop - aimed) <= 2 ? from : sp.scrollTop; // undo an instant jump
          // paced like the browser's own glide: ~0.7s for two screens, ~1.3s across a long session
          var dur = Math.min(1400, Math.max(300, 190 + Math.sqrt(Math.abs(aimed - start)) * 13));
          var started = Date.now();
          sp.scrollTop = start;
          var frame = function () {
            if (mine.done) { if (glide === mine) glide = null; return; }
            var k = Math.min(1, (Date.now() - started) / dur);
            var eased = 1 - (1 - k) * (1 - k); // quick off the mark, long coast to a stop
            var live = scrollTargetOf(el, sp); // the target's offset RIGHT NOW
            sp.scrollTop = start + (live - start) * eased;
            if (k < 1) requestAnimationFrame(frame);
            else land();
          };
          requestAnimationFrame(frame);
        };

        var aim = function (top) {
          aimed = top;
          if (drawn) return; // a drawn glide cannot be re-aimed through the browser
          if (smoothTeleports) { draw(); return; }
          try { sp.scrollTo({ top: top, behavior: "smooth" }); }
          catch (e) { sp.scrollTop = top; }
        };

        aim(t0);
        if (!smoothTeleports && dist > (sp.clientHeight || 400) * 1.5) {
          // one frame is enough to tell the two apart: an animation cannot have
          // covered that much ground yet, whereas a jump carried out at once is
          // already there and has to be drawn by hand from now on.
          requestAnimationFrame(function () {
            if (mine.done || drawn) return;
            if (Math.abs(sp.scrollTop - t0) <= 2) { smoothTeleports = true; draw(); }
          });
        }

        var lastTop = from;
        var lastMove = Date.now();
        var stalls = 0;
        var watch = setInterval(function () {
          if (mine.done || glide !== mine || drawn) { clearInterval(watch); return; }
          var live = scrollTargetOf(el, sp);
          var top = sp.scrollTop;
          if (Math.abs(live - aimed) > 40) { aim(live); lastTop = top; lastMove = Date.now(); return; }
          if (Math.abs(top - aimed) <= 2) { clearInterval(watch); land(); return; }
          if (Math.abs(top - lastTop) > 1) { lastTop = top; lastMove = Date.now(); stalls = 0; return; }
          if (Date.now() - lastMove > 400) { // cancelled, or the call never took
            stalls += 1;
            if (stalls >= 2) draw();
            aim(aimed);
            lastMove = Date.now();
          }
        }, 120);
      };

      var jump = function (key, idx) {
        var row = findRow(key);
        if (!row) return;
        var el = row;
        if (idx !== undefined && idx !== null) {
          var hs = row.querySelectorAll("h1, h2, h3, h4, h5, h6");
          if (hs.length > 0) el = hs[Math.min(idx, hs.length - 1)] || row;
        }
        glideTo(el);
      };

      // ---- unloaded turns: page history to the turn, then land on it ----------
      // The host turn outline carries each turn's `turn/start` seq and the session
      // face's loadThrough(seq) is the documented jump loader ("page history
      // backwards until the window covers seq"). Once it resolves the turn's nodes
      // exist, so we poll briefly for its row — the native turn rail waits for the
      // same settle.
      var turnRow = function (turn) {
        try {
          return document.querySelector('[data-chat-turn="' + String(turn) + '"]');
        } catch (e) {
          return null;
        }
      };

      // reads the outline groups via the ref declared with the other hooks above
      var loadedGroupRow = function (turn) {
        var list = groupsRef.current || [];
        for (var i = 0; i < list.length; i++) {
          var g = list[i];
          if (g.ghost || g.turn !== turn) continue;
          var key = (g.msgs && g.msgs.length > 0) ? g.msgs[0].key : g.userKey;
          var row = key ? findRow(key) : null;
          if (row) return row;
        }
        return null;
      };

      var landOnTurn = function (turn) {
        var tries = 0;
        var step = function () {
          tries++;
          var row = turnRow(turn) || loadedGroupRow(turn);
          if (row) {
            glideTo(row);
            // a jump that started from a search hit keeps the hit highlighted
            if (query.trim()) {
              clearHighlights();
              highlightRow(row, query.trim(), 0, fuzzy);
            }
            return;
          }
          if (tries < 25) setTimeout(step, 80);
        };
        setTimeout(step, 40);
      };

      // returns false when the host exposes no jump loader (older DSH builds)
      var openTurn = function (turn, seq) {
        var sessions = hostSessions();
        if (!sessions) {
          console.warn("[dsh-quick-toc] ctx.get(\"sessions\") returned nothing: this host has no session service, cannot open turn " + turn);
          return false;
        }
        var binding = typeof sessions.binding === "function" ? sessions.binding(sessionId) : null;
        var face = binding && binding.session;
        if (!face || typeof face.loadThrough !== "function") {
          console.warn("[dsh-quick-toc] session " + String(sessionId) + " exposes no loadThrough jump loader, cannot open turn " + turn);
          return false;
        }
        setHoverCard(null);
        Promise.resolve(face.loadThrough(seq)).then(function () {
          landOnTurn(turn);
        }, function (err) {
          console.warn("[dsh-quick-toc] loadThrough failed:", err);
        });
        return true;
      };

      // reveal one group inside the outline list (shared by Enter-stepping and by
      // jumps into a turn that had to be loaded first)
      var revealGroupInOutline = function (gi) {
        setVisibleCount(function (prev) {
          return Math.max(prev, Math.min(groups.length, groups.length - gi));
        });
        setTimeout(function () {
          var el = listRef.current;
          if (!el) return;
          var node = el.querySelector('[data-group-idx="' + gi + '"]');
          if (node) node.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }, 150);
      };

      // jump to the n-th match, cycling; also reveal the group in the outline.
      // ONE smooth scroll straight to the current occurrence (no competing
      // scrolls): highlight first, then position the mark at the upper-middle
      var goToMatch = function (n) {
        if (matches.length === 0) return;
        var i = ((n % matches.length) + matches.length) % matches.length;
        setMatchIdx(i);
        var m = matches[i];
        var q = query.trim();
        clearHighlights();
        if (m.ghost) {
          // the hit lives in a turn the paged window has not loaded: page it in
          // and land on it (landOnTurn re-applies the highlight there)
          openTurn(m.turn, m.seq);
          revealGroupInOutline(m.gi);
          return;
        }
        var r = findRowStrict(m.key);
        if (r && q) {
          // occurrence index within the target message (consecutive in matches)
          var occ = 0;
          for (var p = i - 1; p >= 0 && matches[p].key === m.key; p--) occ++;
          highlightRow(r, q, occ, fuzzy);
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
        revealGroupInOutline(m.gi);
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
      // what the module-scope render helpers need from this render
      var renderExtra = {
        paths: headingPaths,
        fuzzy: fuzzy,
        onOpenTurn: openTurn,
        hoverStart: hoverStart,
        hoverEnd: hoverEnd
      };
      // Transient banner pinned to the bottom of the panel (the panel is
      // position:fixed, so this anchors to the list's lower edge without joining
      // the list's scroll flow). pointerEvents:none keeps it from eating clicks.
      var toastEl = toast ? react_jsx_runtime.jsx("div", {
        className: "dqt-toast" + (toast.closing ? " dqt-toast-closing" : ""),
        style: {
          position: "absolute",
          left: 8,
          right: 8,
          bottom: 8,
          display: "flex",
          justifyContent: "center",
          pointerEvents: "none",
          zIndex: 3
        },
        children: react_jsx_runtime.jsx("span", {
          style: {
            maxWidth: "100%",
            padding: "3px 10px",
            borderRadius: 999,
            cornerShape: "round",
            fontSize: 11,
            color: C.text,
            background: C.panelBg,
            border: "1px solid " + C.panelBorder,
            boxShadow: "0 2px 10px rgba(0,0,0,0.22)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis"
          },
          children: toast.text
        })
      }) : null;
      // panel: opening slides in with a slow fade; closing slides quickly to
      // the dock edge, clipped by the sidebar line (looks covered, not
      // dissolving) and only fades at the very end. No box-shadow: a shadow
      // would get cut in half by the clip-path, so the panel is flat.
      // A scale change moves the box's LOCAL lengths (they are divided by the factor)
      // while `zoom` itself does not animate: leaving `left` in the transition on that
      // one render would let the panel slide across the screen. It lands on exactly the
      // same visual spot either way, so that render simply skips the transition.
      var slide = open ? "0.6s " + EASE : "0.28s " + EASE;
      var panelTransition = (zoomJustChanged ? "" : "left " + slide + ", ")
        + "clip-path " + slide + ", opacity " + (open ? "0.45s ease" : "0.14s ease 0.26s");

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
          panelClip = "inset(0 " + zLen(panelW) + " 0 0)";
        } else {
          panelClip = "inset(0 0 0 " + zLen(panelW + 8) + ")";
        }
      }
      // faded out entirely while another center-column view is active
      // Idle transparency used to be 0.45, which stacked with the outline's own
      // inactive-group dimming (0.6) into a wall of grey that left the panel barely
      // readable whenever the pointer was elsewhere. Readability now comes from
      // CONTRAST on the group being read (tinted row + accent bar, see
      // renderGroups) instead of from fading everything else away.
      var panelOpacity = open && chatViewActive ? (hovered ? 1 : 0.72) : 0;

      var panelEl = react_jsx_runtime.jsx("div", {
        ref: panelRootRef,
        style: {
          position: "fixed",
          top: zLen(baseTopPx),
          left: zLen(panelLeft),
          width: zLen(panelW),
          maxHeight: zLen(vMaxH),
          height: panelH > 0 ? zLen(panelH) : undefined,
          zoom: zoom === 1 ? undefined : zoom,
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
            title: T("handle.dragY"),
            onPointerDown: onHandleDown,
            onMouseEnter: function () { handleBright(true); },
            onMouseLeave: function () { handleBright(false); },
            children: [
              react_jsx_runtime.jsx("div", {
                ref: handleRef,
                style: {
                  width: 56,
                  maxWidth: "calc(100% - 12px)",
                  height: 5,
                  borderRadius: 999,
                  cornerShape: "round",
                  background: "var(--dsw-alias-border-l2, rgba(128,128,128,0.55))",
                  // no slack left in the header -> the grab hint fades away
                  opacity: crowded ? 0 : 0.35,
                  transition: "opacity 0.2s ease",
                  margin: "5px auto 2px"
                }
              }),
              react_jsx_runtime.jsx("div", {
                ref: headerRef,
                className: "dqt-header",
                style: {
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "1px 10px 5px",
                  borderBottom: "1px solid " + C.panelBorder,
                  fontSize: 13,
                  fontWeight: 600,
                  gap: 6,
                  // the four controls keep their size and stay on ONE line; when the row
                  // runs out of room it scrolls sideways (wheel) instead of wrapping or
                  // overlapping, and the flexible spacer below collapses first
                  flexWrap: "nowrap",
                  overflowX: "auto",
                  overflowY: "hidden",
                  scrollbarWidth: "none"
                },
                children: [
                  // LEFT pair: the heading-level filter and the dock toggle take the
                  // left end — so the header reads two controls per side (search +
                  // collapse sit at the other end).
                  react_jsx_runtime.jsx("div", {
                    style: { display: "flex", alignItems: "center", gap: 6, flex: "none" },
                    children: [
                      // heading-level filter: a round icon button that pops down the
                      // H1–H6 picker. Icon: three lines of decreasing width = outline
                      // levels. Hover behaviour matches the magnifier: background +
                      // icon tint change; the resting look never shifts when open.
                      react_jsx_runtime.jsx("button", {
                        className: "dqt-levels-btn",
                        onClick: function () { levelsOpen ? closeLevels() : setLevelsOpen(true); },
                        title: T("levels.tip"),
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
                          // open (or still animating shut) uses the SAME tint as every
                          // other "on" control, so the header reads consistently
                          background: (levelsOpen || levelsClosing) ? C.chip : "var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,0.16))",
                          color: (levelsOpen || levelsClosing) ? C.accent : C.muted,
                          transition: "background 0.15s ease, color 0.15s ease"
                        },
                        onMouseEnter: function (e) {
                          e.currentTarget.style.background = "var(--dsw-alias-interactive-bg-active, rgba(79,140,255,0.24))";
                          e.currentTarget.style.color = "var(--dsw-alias-brand-primary, #4f8cff)";
                        },
                        onMouseLeave: function (e) {
                          e.currentTarget.style.background = (levelsOpen || levelsClosing) ? C.chip : "var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,0.16))";
                          e.currentTarget.style.color = (levelsOpen || levelsClosing) ? C.accent : C.muted;
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
                      // dock toggle: the triangle tips toward the side it will move TO
                      iconBtn(toggleDock, dockRight ? T("handle.dockLeft") : T("handle.dockRight"), dockRight ? "◀" : "▶", 12, dockRight ? { x: -1, y: -1 } : { x: 1, y: -1 })
                    ]
                  }),
                  // spacer: nothing here, it just pins the two pairs to the two ends —
                  // and it is the first thing to give way when the panel narrows
                  react_jsx_runtime.jsx("div", { style: { flex: "1 1 auto", minWidth: 0 } }),
                  // RIGHT pair: search + collapse
                  react_jsx_runtime.jsx("div", {
                    style: { display: "flex", alignItems: "center", gap: 6, flex: "none" },
                    children: [
                      // magnifier button (SVG, matches the other buttons' style)
                      react_jsx_runtime.jsx("button", {
                        onClick: function () { searchOpen ? closeSearch() : openSearch(); },
                        title: T("search.open"),
                        style: {
                          width: 24,
                          height: 24,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: "50%",
                          cornerShape: "round",
                          background: searchOpen ? C.chip : "var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,0.16))",
                          border: "none",
                          color: searchOpen ? C.accent : C.muted,
                          cursor: "pointer"
                        },
                        onMouseEnter: function (e) {
                          e.currentTarget.style.background = "var(--dsw-alias-interactive-bg-active, rgba(79,140,255,0.24))";
                          e.currentTarget.style.color = "var(--dsw-alias-brand-primary, #4f8cff)";
                        },
                        onMouseLeave: function (e) {
                          e.currentTarget.style.background = searchOpen ? C.chip : "var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,0.16))";
                          e.currentTarget.style.color = searchOpen ? C.accent : C.muted;
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
                      // close: thick SVG cross, nudged slightly down
                      react_jsx_runtime.jsx("button", {
                        onClick: function () { setOpen(false); },
                        title: T("handle.collapse"),
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
                      T("search.word"),
                      react_jsx_runtime.jsx("span", {
                        style: { position: "relative", display: "inline-block" },
                        children: [
                          react_jsx_runtime.jsx("span", {
                            key: searchScope,
                            style: { display: "inline-block", animation: "dqt-fade-in 0.25s linear" },
                            children: searchScope === "title" ? T("search.scope.title") : T("search.scope.full")
                          }),
                          (prevScope && prevScope !== searchScope) ? react_jsx_runtime.jsx("span", {
                            key: "old-" + prevScope,
                            style: { position: "absolute", left: 0, top: 0, opacity: 0, animation: "dqt-fade-out 0.25s linear forwards" },
                            children: prevScope === "title" ? T("search.scope.title") : T("search.scope.full")
                          }) : null
                        ]
                      }),
                      T("search.tail")
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
                title: searchScope === "title" ? T("search.scope.tipTitle") : T("search.scope.tipFull"),
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
                  background: searchScope === "full" ? C.chip : "var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,0.14))",
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
                      children: searchScope === "title" ? T("search.scope.title") : T("search.scope.full")
                    }),
                    (prevScope && prevScope !== searchScope) ? react_jsx_runtime.jsx("span", {
                      key: "old-" + prevScope,
                      style: { position: "absolute", opacity: 0, animation: "dqt-fade-out 0.25s linear forwards", display: "block" },
                      children: prevScope === "title" ? T("search.scope.title") : T("search.scope.full")
                    }) : null
                  ]
                })
              }),
              // fuzzy switch: an independent toggle beside the scope pill (its label
              // is the same either way, so only the colour carries the state)
              react_jsx_runtime.jsx("button", {
                onClick: toggleFuzzy,
                title: fuzzy ? T("search.fuzzy.tipOn") : T("search.fuzzy.tipOff"),
                "data-fuzzy": fuzzy ? "on" : "off",
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
                  color: fuzzy ? "var(--dsw-alias-brand-primary, #4f8cff)" : C.muted,
                  background: fuzzy ? C.chip : "var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,0.14))",
                  border: "none",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "background 0.25s ease, color 0.25s ease"
                },
                children: T("search.fuzzy")
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
                ? [
                  react_jsx_runtime.jsx("div", {
                    key: "results",
                    children: renderResults(resultRows, query.trim(), C, goToRow, activeResultRow, renderExtra)
                  }),
                  // older history is one upward scroll away — say so until the
                  // reader actually scrolls up (then the hint has done its job)
                  hint ? react_jsx_runtime.jsx("div", {
                    key: "hint",
                    style: {
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "10px 6px 4px",
                      fontSize: 11,
                      color: C.muted,
                      opacity: 0.85,
                      textAlign: "center"
                    },
                    children: hint === "oldest" ? T("search.hintOldest") : T("search.hintMore")
                  }) : null
                ]
                : renderGroups(shownGroups, shownTrees, jump, C, Math.max(0, groups.length - visibleCount), activeGroup, renderExtra)
            })
          }),
          // "back to the newest row": floats over the list's lower-right corner and
          // fades in the moment the newest turns fall below the fold. Kept MOUNTED
          // and toggled by opacity/pointer-events — an unmounted button has nothing
          // to animate, and (like the level picker) its animation must not depend on
          // inline keyframes that every re-render rewrites.
          react_jsx_runtime.jsx("button", {
            onClick: scrollToBottom,
            className: "dqt-bottom-btn",
            "data-at-bottom": atBottom ? "on" : "off",
            title: T("outline.bottom"),
            tabIndex: atBottom ? -1 : 0,
            "aria-hidden": atBottom ? "true" : undefined,
            onMouseEnter: function (e) {
              e.currentTarget.style.color = C.accent;
              e.currentTarget.style.borderColor = C.groupEdgeSoft;
            },
            onMouseLeave: function (e) {
              e.currentTarget.style.color = C.text;
              e.currentTarget.style.borderColor = C.panelBorder;
            },
            style: {
              position: "absolute",
              // clear of the resize handle in the very corner (16x16)
              right: 18,
              bottom: 12,
              width: 26,
              height: 26,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
              // OPAQUE surface + outline + lift, the same vocabulary as the hover card:
              // a translucent chip disappeared into the rows behind it (and the panel's
              // own idle transparency multiplied it away). The surface is the host's
              // RAISED menu colour, not the panel background — a fill identical to the
              // panel it sits on reads as "no fill" and the button looks see-through.
              background: "var(--dsw-specific-menu, rgba(44, 49, 60, 0.99))",
              border: "1px solid " + C.panelBorder,
              borderRadius: "50%",
              cornerShape: "round",
              color: C.text,
              cursor: "pointer",
              zIndex: 6,
              boxShadow: "0 3px 10px rgba(0, 0, 0, 0.30)",
              opacity: atBottom ? 0 : 1,
              transform: atBottom ? "translateY(6px)" : "translateY(0)",
              pointerEvents: atBottom ? "none" : "auto",
              transition: "opacity 0.22s ease, transform 0.22s ease, background 0.18s ease, color 0.18s ease, border-color 0.18s ease"
            },
            children: react_jsx_runtime.jsx("svg", {
              width: 14,
              height: 14,
              viewBox: "0 0 14 14",
              fill: "none",
              stroke: "currentColor",
              strokeWidth: 1.8,
              strokeLinecap: "round",
              strokeLinejoin: "round",
              style: { display: "block" },
              children: [
                react_jsx_runtime.jsx("polyline", { points: "3.5,4.5 7,8 10.5,4.5" }),
                react_jsx_runtime.jsx("line", { x1: 3.5, y1: 11, x2: 10.5, y2: 11 })
              ]
            })
          }),
          toastEl,
          // resize handles (right edge: width, bottom edge: height)
          // Their grab strips keep their SCREEN thickness under the scale factor:
          // they are part of the panel's box, not of its magnified content.
          react_jsx_runtime.jsx("div", {
            style: {
              position: "absolute",
              top: 0,
              bottom: 0,
              right: 0,
              width: zLen(8),
              cursor: "col-resize",
              touchAction: "none",
              zIndex: 2
            },
            onPointerDown: onResizeWDown,
            title: T("resize.w")
          }),
          react_jsx_runtime.jsx("div", {
            style: {
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: zLen(8),
              cursor: "row-resize",
              touchAction: "none",
              zIndex: 2
            },
            onPointerDown: onResizeHDown,
            title: T("resize.h")
          }),
          // corner handle: resize width AND height at once
          react_jsx_runtime.jsx("div", {
            style: {
              position: "absolute",
              right: 0,
              bottom: 0,
              width: zLen(16),
              height: zLen(16),
              cursor: "nwse-resize",
              touchAction: "none",
              zIndex: 3
            },
            onPointerDown: onResizeCornerDown,
            title: T("resize.wh")
          }),
          // heading-level picker: pops down from the round header button and its
          // LEFT edge lines up with that button (the button now sits at the left end
          // of the header, so 10px is exactly the header's own left padding).
          // Open/close animate from the button's center: the animation lives in
          // the injected stylesheet (classes, not inline animation) so React
          // re-renders never restart or cancel it — an inline `animation` set on
          // every render made the entrance invisible and the exit never play.
          (levelsOpen || levelsClosing) ? react_jsx_runtime.jsx("div", {
            className: "dqt-levels-pop" + (levelsClosing ? " dqt-levels-pop-closing" : ""),
            style: {
              position: "absolute",
              top: 40,
              left: 10,
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
              maxWidth: "calc(100% - 20px)",
              // the button's center sits 12px inside the popup's left edge
              transformOrigin: "12px top"
            },
            children: [1, 2, 3, 4, 5, 6].map(function (lv) {
              var active = !!levelSet[lv];
              return react_jsx_runtime.jsx("button", {
                onClick: function () { toggleLevel(lv); },
                title: active ? T("levels.hide") + lv : T("levels.show") + lv,
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
                    ? C.chip
                    : "var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,0.14))",
                  color: active ? C.accent : C.muted,
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
          // the ratio counts from the BOTTOM (0% = bottom, 100% = top) — at 0.5 this
          // is the same centred spot the handle always had
          top: (viewport
            ? viewport.top + (viewport.height - 92) * handleFromTop
            : (window.innerHeight - 92) * handleFromTop) + "px",
          transform: handleShown ? "translateX(0)" : (dockRight ? "translateX(16px)" : "translateX(-16px)"),
          opacity: chatViewActive ? 1 : 0,
          pointerEvents: chatViewActive ? "auto" : "none",
          transition: "transform 0.4s " + EASE + ", opacity 0.26s ease",
          ...(dockRight
            ? { right: viewport ? viewport.right + 52 : 60 }   // clear of the milestone rail
            : { left: viewport ? viewport.left : 0 })
        },
        title: T("handle.expand"),
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

      // ---- hover preview card ------------------------------------------------
      // Rendered INSIDE the body portal (position: fixed) so the outline's own
      // scroll container can never clip it, and pointer-events: none so it can
      // never steal the hover that opened it.
      var hoverEl = null;
      if (hoverCard && open) {
        var cardW = 264;
        var cardTop = Math.max(8, Math.min(hoverCard.top - 4, window.innerHeight - 210));
        var cardLeft = dockRight
          ? Math.max(8, hoverCard.left - cardW - 10)
          : Math.min(window.innerWidth - cardW - 8, hoverCard.right + 10);
        var cardBody = hoverCard.preview || hoverCard.sub || "";
        var cardChildren = [
          react_jsx_runtime.jsx("div", {
            style: { fontSize: 12, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
            children: hoverCard.title
          }, "hc-t")
        ];
        if (hoverCard.meta) {
          cardChildren.push(react_jsx_runtime.jsx("div", {
            style: { fontSize: 10, color: C.muted, opacity: 0.8, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
            children: hoverCard.meta
          }, "hc-m"));
        }
        cardChildren.push(react_jsx_runtime.jsx("div", {
          style: { fontSize: 11, lineHeight: "16px", color: C.text, opacity: 0.9, marginTop: 4, maxHeight: 116, overflow: "hidden" },
          children: cardBody || (hoverCard.ghost ? T("turn.loadTip") : "")
        }, "hc-b"));
        if (hoverCard.ghost) {
          cardChildren.push(react_jsx_runtime.jsx("div", {
            style: { fontSize: 10, color: C.muted, opacity: 0.7, marginTop: 4 },
            children: T("preview.truncated")
          }, "hc-n"));
        }
        hoverEl = react_jsx_runtime.jsx("div", {
          className: "dqt-hover" + (hoverClosing ? " dqt-hover-closing" : ""),
          style: {
            position: "fixed",
            top: cardTop,
            left: cardLeft,
            width: cardW,
            padding: "8px 10px",
            borderRadius: 8,
            cornerShape: "round",
            background: C.panelBg,
            color: C.text,
            border: "1px solid " + C.panelBorder,
            boxShadow: "0 8px 24px rgba(0,0,0,0.28)",
            zIndex: Z_BASE + 1,
            pointerEvents: "none"
          },
          children: cardChildren
        }, "hover-card");
      }

      return react_dom.createPortal(
        react_jsx_runtime.jsx(ErrorBoundary, { children: [panelEl, edgeEl, hoverEl] }),
        document.body
      );
    }

    function renderItem(n, depth, jump, C, uid, extra) {
      var hasChildren = !!(n.children && n.children.length);
      var path = extra && extra.paths ? extra.paths[headingId(n)] : null;
      var hoverInfo = {
        title: n.title,
        sub: n.sub || "",
        preview: n.preview || "",
        meta: [n.time, path ? path.path : ""].filter(Boolean).join("  ·  "),
        ghost: false
      };
      var rows = [
        react_jsx_runtime.jsx("div", {
          style: { display: "flex", alignItems: "center", gap: 2, minWidth: 0 },
          children: react_jsx_runtime.jsx("span", {
            style: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" },
            children: n.title
          })
        }, uid + "-l")
      ];
      // Subtitle = the section's first sentence. This is what makes two headings
      // with the SAME text distinguishable without hovering ("which one is this?").
      if (n.sub) {
        rows.push(react_jsx_runtime.jsx("div", {
          style: {
            fontSize: 10,
            lineHeight: "13px",
            color: C.muted,
            opacity: 0.75,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis"
          },
          children: n.sub
        }, uid + "-s"));
      }
      return react_jsx_runtime.jsx(
        "div",
        {
          onClick: function () { jump(n.key, n.idx); },
          onMouseEnter: function (e) {
            e.currentTarget.style.background = C.hover;
            if (extra && extra.hoverStart) extra.hoverStart(hoverInfo, e.currentTarget);
          },
          onMouseLeave: function (e) {
            e.currentTarget.style.background = "transparent";
            if (extra && extra.hoverEnd) extra.hoverEnd();
          },
          "data-jump-key": n.key,
          "data-jump-idx": n.idx !== undefined ? String(n.idx) : "0",
          style: {
            // no fixed height: a row grows by one line when it has a subtitle
            display: "block",
            padding: "2px 6px",
            paddingLeft: (hasChildren ? 2 : 6) + (n.level - 1) * 12,
            margin: "1px 0",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: n.level <= 2 ? 13 : 12,
            color: n.level <= 2 ? C.text : C.muted,
            fontWeight: n.level <= 2 ? 600 : 400,
            lineHeight: "18px",
            whiteSpace: "nowrap",
            overflow: "hidden"
          },
          title: n.title,
          children: rows
        },
        uid + "-" + n.level + "-" + (n.key || "")
      );
    }

    function renderNodes(nodes, depth, jump, C, uid, extra) {
      var out = [];
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        out.push(renderItem(n, depth, jump, C, uid + "-" + i, extra));
        if (n.children && n.children.length) {
          out.push(react_jsx_runtime.jsx("div", { children: renderNodes(n.children, depth + 1, jump, C, uid + "-" + i, extra) }, uid + "-c-" + i));
        }
      }
      return out;
    }

    // ---- search results view ----
    // While a query is present the list shows every matched heading/message
    // (grouped per message, with an occurrence count) instead of the outline, so
    // search is "see them all, then jump" rather than stepping blindly.
    function hitSpans(text, q, fuzzy) {
      var parts = highlightParts(text, q, fuzzy);
      return parts.map(function (p, i) {
        return p.hit
          ? react_jsx_runtime.jsx("span", {
            style: { background: "rgba(255,196,0,0.32)", borderRadius: 2, color: "inherit" },
            children: p.text
          }, "hp" + i)
          : p.text;
      });
    }

    function renderResultRow(r, i, q, C, onRow, isActive, extra) {
      var fuzzy = !!(extra && extra.fuzzy);
      var meta = [];
      if (r.ghost) meta.push(T("turn.unloaded"));
      if (r.failed) meta.push(T("turn.failed"));
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
          children: hitSpans(r.title, q, fuzzy)
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
          children: hitSpans(r.snippet, q, fuzzy)
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
        onMouseEnter: function (e) {
          e.currentTarget.style.background = C.hover;
          if (extra && extra.hoverStart) {
            extra.hoverStart({
              title: r.title,
              sub: r.snippet || "",
              preview: r.snippet || "",
              meta: meta.join("  ·  "),
              ghost: !!r.ghost
            }, e.currentTarget);
          }
        },
        onMouseLeave: function (e) {
          e.currentTarget.style.background = isActive ? C.chip : "transparent";
          if (extra && extra.hoverEnd) extra.hoverEnd();
        },
        "data-result-idx": i,
        title: r.path || r.title,
        style: {
          padding: "4px 6px",
          margin: "1px 0",
          borderRadius: 6,
          cursor: "pointer",
          minWidth: 0,
          background: isActive ? C.chip : "transparent",
          transition: "background 0.15s ease"
        },
        children: children
      }, "res-" + i);
    }

    function renderResults(rows, q, C, onRow, activeRow, extra) {
      if (!rows || rows.length === 0) {
        return react_jsx_runtime.jsx("div", {
          style: { padding: "12px 8px", fontSize: 12, color: C.muted, textAlign: "center" },
          children: T("search.empty")
        }, "empty");
      }
      var out = [];
      for (var i = 0; i < rows.length; i++) {
        out.push(renderResultRow(rows[i], i, q, C, onRow, i === activeRow, extra));
      }
      return out;
    }

    // a group's header (the time row): clicking it jumps to the TOP OF THE
    // MODEL'S REPLY for that turn — the first assistant step — which also makes
    // heading-less turns jumpable, since they only have this row.
    // Implemented as a function (not an inline closure in a loop) so each
    // header captures its own (g, gi) — the var-in-loop closure bug would
    // otherwise make every header jump to the last group.
    function renderGroupHeader(g, gi, jump, C, isActive) {
      // a turn that ended in a failure has no reply to land on: its terminal row IS
      // the interesting position, so the header lands there (and says so in the tip)
      var replyKey = (g.msgs && g.msgs.length > 0) ? g.msgs[0].key : (g.failure ? g.failure.key : "");
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
          // ONE row geometry for every group header, whether or not the turn has
          // headings: same box, same 18px rhythm, same left inset, so the time
          // column of a heading-less turn lines up with all the others. Only the
          // type emphasis differs (weight + colour, see the label below).
          padding: "1px 4px 2px",
          height: 18,
          display: "flex",
          alignItems: "center",
          minWidth: 0,
          // sticky: while you scroll the outline, the header of the group you are
          // inside stays pinned at the top. It must be opaque to cover the rows
          // scrolling underneath, so its base colour is the panel background in both
          // states — the "current group" tint rides on its own layer inside, which
          // can FADE (a background-image gradient cannot be transitioned).
          position: "sticky",
          top: 0,
          zIndex: 2,
          background: C.panelBg
        },
        children: [
          react_jsx_runtime.jsx("div", {
            style: {
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              background: C.groupTint,
              opacity: isActive ? 1 : 0,
              transition: "opacity 0.4s ease",
              pointerEvents: "none"
            }
          }, "g-h-tint-" + gi),
          react_jsx_runtime.jsx("span", {
          onClick: jumpToTurn,
          title: (g.msgs && g.msgs.length > 0) ? T("turn.jumpReply") : (g.failure ? T("turn.jumpFailed") : T("turn.jumpTurn")),
          onMouseEnter: function (e) { e.currentTarget.style.background = C.hover; },
          onMouseLeave: function (e) { e.currentTarget.style.background = "transparent"; },
          style: {
            // ONE style for every group header, heading-less turns included: a turn
            // whose reply has no markdown headings is not a different kind of entry,
            // it is simply a group with no rows under its header, and it must line up
            // with the rest of the list (same size, weight, colour, opacity). The only
            // thing that marks a group is the shared "current group" tint, which lives
            // on the group box — never on the label.
            fontSize: 11,
            fontWeight: 400,
            color: C.muted,
            cursor: "pointer",
            padding: "1px 5px",
            borderRadius: 4,
            background: "transparent",
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
              style: {
                fontWeight: 400,
                opacity: 0.75,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                minWidth: 0
              },
              children: g.userText
            }) : null
          ]
        })
        ]
      }, "g-h-" + gi);
    }

    // A turn the paged event window has not loaded yet: the host outline still
    // names it (number + bounded previews), so the outline covers the whole
    // session. Clicking pages that turn in through the session's jump loader.
    function renderGhostGroup(g, gi, C, extra) {
      extra = extra || {};
      var children = [
        react_jsx_runtime.jsx("div", {
          style: { display: "flex", alignItems: "center", gap: 5, minWidth: 0 },
          children: [
            react_jsx_runtime.jsx("span", {
              style: { fontSize: 10, fontWeight: 600, flex: "none", color: C.muted, opacity: 0.8, border: "1px solid " + C.panelBorder, borderRadius: 4, padding: "0 4px" },
              children: T("turn.unloaded")
            }),
            react_jsx_runtime.jsx("span", {
              style: { fontSize: 11, color: C.muted, fontWeight: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 },
              children: g.userText || "#" + g.turn
            })
          ]
        })
      ];
      if (g.preview) {
        children.push(react_jsx_runtime.jsx("div", {
          style: { fontSize: 10, lineHeight: "13px", color: C.muted, opacity: 0.65, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" },
          children: g.preview
        }));
      }
      return react_jsx_runtime.jsx("div", {
        onClick: function () { extra.onOpenTurn(g.turn, g.seq); },
        onMouseEnter: function (e) {
          e.currentTarget.style.background = C.hover;
          e.currentTarget.style.opacity = "1";
          extra.hoverStart({ title: g.userText || "#" + g.turn, sub: "", preview: g.preview || "", meta: T("turn.unloaded"), ghost: true }, e.currentTarget);
        },
        onMouseLeave: function (e) {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.opacity = "0.85";
          extra.hoverEnd();
        },
        "data-group-idx": gi,
        "data-ghost-turn": g.turn,
        title: T("turn.loadTip"),
        style: {
          padding: "3px 6px",
          margin: "1px 0",
          borderRadius: 6,
          cursor: "pointer",
          minWidth: 0,
          opacity: 0.85,
          transition: "background 0.15s ease, opacity 0.15s ease"
        },
        children: children
      }, "g-ghost-" + gi);
    }

    // A turn that ended in a terminal failure (the host's `turn-error` row): the
    // outline lists it as a normal turn and adds this row, so a turn whose request
    // never came back reads as "请求失败 · <provider message>" instead of "未加载"
    // and never silently disappears from the outline.
    function renderFailureRow(g, gi, jump, C) {
      var f = g.failure;
      var message = f.message || f.code || "";
      var open = function (e) {
        e.stopPropagation();
        if (findRow(f.key)) jump(f.key);
        else if (g.userKey && findRow(g.userKey)) jump(g.userKey);
      };
      return react_jsx_runtime.jsx("div", {
        onClick: open,
        title: message || T("turn.failed"),
        "data-turn-failure": g.turn === null || g.turn === undefined ? String(gi) : String(g.turn),
        style: {
          display: "flex",
          alignItems: "center",
          gap: 5,
          minWidth: 0,
          padding: "1px 6px",
          margin: "1px 0",
          borderRadius: 6,
          cursor: "pointer",
          transition: "background 0.15s ease"
        },
        onMouseEnter: function (e) { e.currentTarget.style.background = C.hover; },
        onMouseLeave: function (e) { e.currentTarget.style.background = "transparent"; },
        children: [
          react_jsx_runtime.jsx("span", {
            style: { fontSize: 10, fontWeight: 600, flex: "none", color: C.error, border: "1px solid " + C.error, borderRadius: 4, padding: "0 4px" },
            children: T("turn.failed")
          }),
          message ? react_jsx_runtime.jsx("span", {
            style: {
              fontSize: 11,
              color: C.muted,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              minWidth: 0
            },
            children: message
          }) : null
        ]
      }, "g-fail-" + gi);
    }

    // render each conversation turn as its own block: solid divider + time header
    // offset = global group index of the first rendered group (stable React keys)
    // activeIdx = array of groups being read (full opacity); others are dimmed
    function renderGroups(groups, trees, jump, C, offset, activeIdx, extra) {
      extra = extra || {};
      var base = offset || 0;
      var activeSet = {};
      if (Array.isArray(activeIdx)) {
        for (var a = 0; a < activeIdx.length; a++) activeSet[activeIdx[a]] = true;
      }
      var out = [];
      for (var i = 0; i < groups.length; i++) {
        var g = groups[i];
        var gi = base + i;
        var isActive = !!activeSet[gi];
        var rows = g.ghost ? [] : trees[i];
        // The divider between two groups stays OUTSIDE the highlight box: inside it
        // would draw a rule straight across the tinted block.
        out.push(react_jsx_runtime.jsx("div", {
          style: { borderTop: "1px solid " + C.panelBorder, margin: "7px 2px 3px", height: 0 }
        }, "g-sep-" + gi));
        var items = [];
        if (g.ghost) {
          items.push(renderGhostGroup(g, gi, C, extra));
        } else {
          // every group gets the SAME header, whether or not this turn produced any
          // markdown headings — a heading-less turn is just a group with no rows, not
          // a second kind of entry (`rows` only decides what gets listed below it)
          items.push(renderGroupHeader(g, gi, jump, C, isActive));
          items.push(renderNodes(rows, 0, jump, C, "g" + gi, extra));
          // the failure is the turn's LAST event, so its row sits under the rows
          if (g.failure) items.push(renderFailureRow(g, gi, jump, C));
        }
        // The group being read stays at full opacity and every other group is dimmed
        // to 0.85 — enough to mark the reading position without turning the list grey
        // (0.6 did, and multiplied by the panel's own idle transparency it made the
        // outline barely readable). The current group ALSO gets the closed tinted box
        // below (fill + outline + accent bar), which stays visible on top of any
        // panel transparency and never looks cut off on the right.
        var dim = !isActive && !g.ghost;
        out.push(react_jsx_runtime.jsx("div", {
          "data-group-idx": gi,
          "data-active-group": isActive ? "on" : "off",
          style: {
            opacity: dim ? 0.85 : 1,
            // the box fades in AND out: colour transitions only, and the left accent
            // keeps its 3px width in both states so activating a group never reflows
            // (a width change would shift every row by 2px)
            transition: "opacity 0.4s ease, background-color 0.4s ease, border-color 0.4s ease",
            backgroundColor: isActive ? C.groupTint : "transparent",
            borderTop: "1px solid " + (isActive ? C.groupEdgeSoft : "transparent"),
            borderRight: "1px solid " + (isActive ? C.groupEdgeSoft : "transparent"),
            borderBottom: "1px solid " + (isActive ? C.groupEdgeSoft : "transparent"),
            borderLeft: "3px solid " + (isActive ? C.groupEdge : "transparent"),
            borderRadius: 6,
            margin: "2px -5px",
            paddingLeft: 2
          },
          children: items
        }, "g-" + gi));
      }
      return out;
    }

    // Host-facing locale namespace: the slot declares `locale: "dsh-quick-toc"`, and
    // registering BOTH tables under the same keys is what lets the panel follow the
    // host's language: `T` asks the host translation first and only falls back to the
    // built-in table. Keep the two hand-written tables below in sync with DICTS — the
    // offline suite asserts that every DICTS key exists in both languages, and the
    // host-facing tables are derived from DICTS so they cannot drift.
    var zh = {};
    var en = {};
    (function () {
      for (var key in DICTS.zh) {
        if (!Object.prototype.hasOwnProperty.call(DICTS.zh, key)) continue;
        zh[key] = DICTS.zh[key];
        en[key] = DICTS.en[key] === undefined ? DICTS.zh[key] : DICTS.en[key];
      }
    })();

    // ---------- plugin-configuration card ----------
    // Settings → Plugins → Plugin configuration renders one collapsible card per
    // served settings namespace; this is ours, keyed on the namespace the host half
    // registers. It edits the SAME store the panel writes to, so the two sides are
    // live in both directions. The chrome mirrors the section's own card (radii,
    // borders, spacing, tokens) because a plugin bundle cannot import the section's
    // CSS module.
    function TocSettingsCard() {
      var prefs = usePrefs();
      setLanguage(prefs.lang, hostLanguage());
      var snap = prefsStore.host();
      var writable = !!snap && snap.writable === true;
      var user = snap && snap.user && typeof snap.user === "object" ? snap.user : {};
      var openState = react.useState(false);
      var open = openState[0];
      var setOpen = openState[1];
      var commit = function (patch) { prefsStore.set(patch); };
      var resetField = function (key) { prefsStore.unset(key); };
      // joined segments: one outer frame, the options split by thin dividers —
      // the same control shape the fonttune card uses (heights, fonts, surfaces)
      var seg = function (options, current, onPick) {
        return react_jsx_runtime.jsx("div", {
          className: "dqt-seg",
          children: options.map(function (pair) {
            var on = current === pair[0];
            return react_jsx_runtime.jsx("button", {
              type: "button",
              "aria-pressed": on,
              disabled: !writable,
              onClick: function () { onPick(pair[0]); },
              className: "dqt-segBtn" + (on ? " dqt-segOn" : ""),
              children: pair[1]
            }, pair[0]);
          })
        });
      };
      // the boolean rows use the same joined segments (开启/关闭), not a checkbox
      var onoff = function (on, onToggle) {
        return seg([["on", T("settings.on")], ["off", T("settings.off")]], on ? "on" : "off",
          function (v) { onToggle(v === "on"); });
      };
      // Percentage sliders (the panel scale and the handle position) — the same
      // control shape as the fonttune card's slider. Dragging only moves a LOCAL
      // value: the settings document is written once the pointer is released (a
      // per-notch rewrite would recompute the panel mid-drag), and the local value
      // stays on screen until the host confirms it, so the readout never bounces back
      // to the old number for a frame. One drag/confirm ledger serves both sliders.
      var _sSliderDrag = react.useState(null); // { field, value } or null
      var sliderDrag = _sSliderDrag[0];
      var setSliderDrag = _sSliderDrag[1];
      var sliderAwaiting = react.useRef({});
      var commitSlider = function (field, pct) {
        sliderAwaiting.current[field] = pct;
        commit(field === "zoom" ? { zoom: pct / 100 } : { handle: pct / 100 });
      };
      react.useEffect(function () {
        var a = sliderAwaiting.current;
        var settled = false;
        if (a.zoom !== undefined && Math.round(prefs.zoom * 100) === a.zoom) { delete a.zoom; settled = true; }
        if (a.handle !== undefined && Math.round(prefs.handle * 100) === a.handle) { delete a.handle; settled = true; }
        if (settled) setSliderDrag(null);
      }, [prefs.zoom, prefs.handle]);
      react.useEffect(function () {
        if (sliderDrag === null) return undefined;
        var release = function () {
          // one release per drag: a late pointerup must not rewrite the same value
          var f = sliderDrag.field;
          if (sliderAwaiting.current[f] !== undefined) return;
          commitSlider(f, sliderDrag.value);
        };
        window.addEventListener("pointerup", release, true);
        window.addEventListener("touchend", release, true);
        return function () {
          window.removeEventListener("pointerup", release, true);
          window.removeEventListener("touchend", release, true);
        };
      }, [sliderDrag]);
      var sliderCtl = function (field, label, min, max, step, pct) {
        var value = (sliderDrag && sliderDrag.field === field) ? sliderDrag.value : pct;
        return react_jsx_runtime.jsxs("div", {
          children: [
            react_jsx_runtime.jsxs("div", {
              className: "dqt-sliderRow",
              children: [
                react_jsx_runtime.jsx("input", {
                  type: "range",
                  className: "dqt-slider",
                  min: min,
                  max: max,
                  step: step,
                  value: value,
                  disabled: !writable,
                  "aria-label": T(label),
                  onChange: function (e) { setSliderDrag({ field: field, value: Number(e.target.value) }); },
                  onKeyUp: function () { if (sliderDrag && sliderDrag.field === field) commitSlider(field, sliderDrag.value); },
                  onBlur: function () { if (sliderDrag && sliderDrag.field === field) commitSlider(field, sliderDrag.value); }
                }),
                react_jsx_runtime.jsx("span", { className: "dqt-sliderValue", children: value + "%" })
              ]
            }),
            react_jsx_runtime.jsxs("div", {
              className: "dqt-sliderScale",
              children: [
                react_jsx_runtime.jsx("span", { children: min + "%" }),
                react_jsx_runtime.jsx("span", { children: max + "%" })
              ]
            })
          ]
        });
      };
      var zoomControl = sliderCtl("zoom", "settings.zoom", 50, 200, 5, Math.round(prefs.zoom * 100));
      var handleControl = sliderCtl("handle", "settings.handle", 0, 100, 1, Math.round(prefs.handle * 100));
      var field = function (key, label, hint, control, inline, last) {
        var overridden = Object.prototype.hasOwnProperty.call(user, key);
        var reset = overridden ? react_jsx_runtime.jsx("button", {
          type: "button",
          className: "dqt-pfieldReset",
          disabled: !writable,
          onClick: function () { resetField(key); },
          children: T("settings.resetField")
        }) : null;
        return react_jsx_runtime.jsxs("div", {
          className: "dqt-pfield" + (last ? " dqt-pfieldLast" : ""),
          children: [
            react_jsx_runtime.jsxs("div", {
              className: "dqt-pfieldHead",
              children: [
                react_jsx_runtime.jsx("span", { className: "dqt-pfieldLabel", children: label }),
                overridden ? react_jsx_runtime.jsx("span", { className: "dqt-poverridden", children: T("settings.overridden") }) : null,
                reset,
                inline ? react_jsx_runtime.jsx("span", { className: "dqt-pinline", children: control }) : null
              ]
            }),
            hint ? react_jsx_runtime.jsx("p", { className: "dqt-phint", children: hint }) : null,
            inline ? null : control
          ]
        }, key);
      };
      var levelsControl = function (inline) {
        return react_jsx_runtime.jsx("div", {
          className: "dqt-pseg" + (inline ? " dqt-psegInline" : ""),
        children: LEVELS_ALL.map(function (lv) {
          var on = prefs.levels.indexOf(lv) !== -1;
          return react_jsx_runtime.jsx("button", {
            type: "button",
            disabled: !writable,
            onClick: function () {
              var next;
              if (on) {
                next = prefs.levels.filter(function (x) { return x !== lv; });
                if (next.length === 0) next = LEVELS_ALL.slice(); // never leave the panel empty
              } else {
                next = LEVELS_ALL.filter(function (x) { return x === lv || prefs.levels.indexOf(x) !== -1; });
              }
              commit({ levels: next });
            },
            title: (on ? T("levels.hide") : T("levels.show")) + lv,
            className: "dqt-psegBtn" + (on ? " dqt-psegOn" : ""),
            children: "H" + lv
          }, "lv-" + lv);
        })
      });
      };
      var fields = [
        field("lang", T("settings.language"), T("settings.language.tip"),
          seg([["auto", T("settings.lang.auto")], ["zh", T("settings.lang.zh")], ["en", T("settings.lang.en")]], prefs.lang,
            function (v) { commit({ lang: v }); }), true),
        field("dock", T("settings.dock"), "",
          seg([["left", T("settings.dock.left")], ["right", T("settings.dock.right")]], prefs.dock,
            function (v) { commit({ dock: v }); }), true),
        field("levels", T("settings.levels"), "", levelsControl(true), true),
        field("zoom", T("settings.zoom"), T("settings.zoom.tip"), zoomControl, false),
        field("handle", T("settings.handle"), T("settings.handle.tip"), handleControl, false),
        field("fuzzy", T("settings.fuzzy"), "", onoff(prefs.fuzzy, function (v) { commit({ fuzzy: v }); }), true),
        field("hover", T("settings.hover"), "", onoff(prefs.hover, function (v) { commit({ hover: v }); }), true),
        field("debug", T("settings.debug"), T("settings.debug.tip"), onoff(prefs.debug, function (v) { commit({ debug: v }); }), true, true)
      ];
      return react_jsx_runtime.jsxs("li", {
        className: "dqt-pcard" + (open ? " dqt-pcardOpen" : ""),
        children: [
          react_jsx_runtime.jsxs("button", {
            type: "button",
            className: "dqt-phead",
            "aria-expanded": open,
            onClick: function () { setOpen(!open); },
            children: [
              react_jsx_runtime.jsxs("span", { className: "dqt-pheadText", children: [
                react_jsx_runtime.jsx("span", { className: "dqt-pname", children: T("panel.title") }),
                react_jsx_runtime.jsx("span", { className: "dqt-pdesc", children: T("settings.desc") })
              ] }),
              // The host's own chevron (IconChevronDownOutline14): a filled 14x14 glyph.
              // A text arrowhead ("⌄") sat in a 20px line box, so its ink hung off the
              // box centre — rotating it swung the glyph sideways instead of turning it
              // in place — and at text weight it never matched the host's other icons.
              // The class goes on the <svg> itself, exactly as the host's PluginCard does,
              // so `transform:rotate(180deg)` turns around the icon's own centre.
              react_jsx_runtime.jsx("svg", {
                className: "dqt-pchev" + (open ? " dqt-pchevOpen" : ""),
                width: 14,
                height: 14,
                viewBox: "0 0 14 14",
                fill: "none",
                "aria-hidden": "true",
                children: react_jsx_runtime.jsx("path", {
                  d: "M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 8.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z",
                  fill: "currentColor"
                })
              })
            ]
          }),
          open ? react_jsx_runtime.jsx("div", {
            className: "dqt-pbody",
            children: [
              writable ? null : react_jsx_runtime.jsx("p", { className: "dqt-preadOnly", role: "status", children: T("settings.readOnly") }),
              fields
            ]
          }) : null
        ]
      });
    }

    var inject = ["slots", "locale", "settingsScope"];

    function apply(ctx) {
      ctx.effect(function () {
        return ctx.locale.register("dsh-quick-toc", { zh: zh, en: en });
      }, "dsh-quick-toc: dictionaries");

      // The host's translate function for our namespace is what makes "follow the
      // host" work: `T` prefers it, so the panel speaks whatever language DSH is in.
      // Optional on purpose — a host without a locale service leaves the built-in
      // table in charge.
      if (ctx.locale && typeof ctx.locale.bind === "function") {
        try {
          var bound = ctx.locale.bind("dsh-quick-toc");
          hostTranslate = function (key) {
            try {
              var s = bound(key);
              // the host echoes the key back for anything it cannot translate, and the
              // built-in table is the better fallback in that case
              return typeof s === "string" && s !== key ? s : undefined;
            } catch (e) {
              return undefined;
            }
          };
        } catch (e) {
          hostTranslate = null;
        }
      }

      // Two open DSH tabs should agree: the other tab's write to one of these keys
      // arrives here as a `storage` event, and the store re-reads and notifies, so the
      // panel and the configuration card both follow along.
      if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
        window.addEventListener("storage", function () { prefsStore.reload(); });
      }

      // Bridge to the host session face, used to open a turn whose events the
      // paged window has not loaded: ctx.sessions.binding(id).session.loadThrough(seq)
      // is the host's documented "page history backwards until the window covers
      // seq" jump loader.
      //
      // The client plugin facade offers two ways in: a direct `ctx.sessions`
      // property read (which demands `inject: ["sessions"]` on the returned plugin
      // object, and the runtime then PARKS the whole package whenever that provider
      // is absent) and `ctx.get(name)`, the declaration-free lookup. This uses the
      // lookup — deliberately optional, so a host without the session controller
      // still gets a working outline, and callers report the missing loader
      // instead of the panel disappearing.
      var host = {
        sessions: function () {
          try {
            return typeof ctx.get === "function" ? (ctx.get("sessions") || null) : null;
          } catch (e) {
            return null;
          }
        }
      };

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
        }, function OutlinePanelWithHost(props) {
          // the panel needs the host bridge plus the session id it was registered for
          return OutlinePanel(Object.assign({}, props, { tocHost: host }));
        });
      });

      // The client settings scope: the browser face of the namespace the host half
      // registers. The store adopts its snapshot as the authoritative layer for the
      // host-backed fields and routes writes to it; on a host without the service (or
      // on a non-loopback page, where DSH keeps settings read-only) the localStorage
      // mirror keeps every preference working, exactly as 0.5.x did.
      var boundScope = null;
      if (ctx.settingsScope && typeof ctx.settingsScope.bind === "function") {
        try {
          boundScope = ctx.settingsScope.bind({ namespace: NAMESPACE });
          prefsStore.attachHost(boundScope);
        } catch (e) {
          boundScope = null;
          console.warn("[dsh-quick-toc] settings scope unavailable, preferences stay in this browser:", e);
        }
      }

      // The plugin-configuration card: Settings → Plugins → Plugin configuration, a
      // keyed slot dispatched only for namespaces the Host actually serves. Registering
      // it only when the scope bound keeps a half-configured host from rendering a card
      // that could not read or write anything.
      if (boundScope) {
        ctx.slots.inject("settings.plugin.item", function () {
          return ctx.slots.register({
            name: "settings.plugin.item",
            key: NAMESPACE,
            locale: "dsh-quick-toc"
          }, TocSettingsCard);
        });
      }
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
        // hover preview card: fades in place, and fades OUT when the pointer
        // leaves (both as stylesheet classes so re-renders cannot cancel them)
        ".dqt-hover{animation:dqt-fade-in 0.12s linear both}" +
        ".dqt-hover-closing{animation:dqt-fade-out 0.16s cubic-bezier(0.2, 0.9, 0.3, 1) both}" +
        // transient edge banner over the bottom of the outline list
        "@keyframes dqt-toast-in{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}" +
        "@keyframes dqt-toast-out{from{opacity:1;transform:none}to{opacity:0;transform:none}}" +
        ".dqt-toast{animation:dqt-toast-in 0.2s cubic-bezier(0.22, 0.9, 0.3, 1) both}" +
        ".dqt-toast-closing{animation:dqt-toast-out 0.42s linear both}" +
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
        ".dqt-list::-webkit-scrollbar-corner{background:transparent}" +
        // the header scrolls sideways once the four controls fill it: the native bar
        // would be taller than the row, so it is hidden (the wheel still scrolls)
        ".dqt-header{scrollbar-width:none;-ms-overflow-style:none}" +
        ".dqt-header::-webkit-scrollbar{display:none;width:0;height:0}" +
        ".dqt-header::-webkit-scrollbar-thumb{background:transparent}" +
        // Plugin-configuration card (Settings → Plugins → Plugin configuration).
        // The chrome reproduces the section's own card — a plugin bundle cannot
        // import that CSS module — with the same tokens, radii and spacing.
        ".dqt-pcard{border:.5px solid var(--dsw-alias-border-l4);background:var(--dsw-alias-bg-layer-3);border-radius:16px;list-style:none;transition:border-color .16s,background .16s}" +
        ".dqt-pcard:hover{border-color:var(--dsw-alias-label-dimmed)}" +
        ".dqt-pcardOpen{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-label-dimmed)}" +
        ".dqt-phead{appearance:none;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;background:0 0;border:0;border-radius:12px;align-items:center;gap:12px;padding:14px 16px;display:flex}" +
        ".dqt-phead:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}" +
        ".dqt-pheadText{flex-direction:column;flex:1;gap:4px;min-width:0;display:flex}" +
        ".dqt-pname{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:1.4}" +
        ".dqt-pdesc{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:1.5}" +
        ".dqt-pchev{color:var(--dsw-alias-label-tertiary);flex:none;transition:transform .16s}" +
        ".dqt-pchevOpen{transform:rotate(180deg)}" +
        ".dqt-pbody{border-top:.5px solid var(--dsw-alias-border-l2);margin:0 16px;padding-bottom:8px}" +
        ".dqt-preadOnly{color:var(--dsw-alias-label-tertiary);margin:12px 0 0;font-size:12px;line-height:1.5}" +
        ".dqt-pfield{padding:14px 0;border-bottom:.5px solid var(--dsw-alias-border-l2)}" +
        ".dqt-pfieldLast{border-bottom:0}" +
        ".dqt-pfieldHead{align-items:center;gap:8px;display:flex}" +
        ".dqt-pfieldLabel{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:400;line-height:22px}" +
        ".dqt-poverridden{flex:none;color:var(--dsw-alias-label-tertiary);background:var(--dsw-alias-bg-layer-2);border:.5px solid var(--dsw-alias-border-l3);border-radius:999px;padding:1px 8px;font-size:11px;line-height:16px}" +
        ".dqt-pfieldReset{flex:none;appearance:none;font:inherit;cursor:pointer;background:0 0;border:0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;padding:0}" +
        ".dqt-pfieldReset:hover:not(:disabled){color:var(--dsw-alias-label-primary)}" +
        ".dqt-pfieldReset:disabled{opacity:.4;cursor:default}" +
        ".dqt-pinline{flex:1;justify-content:flex-end;align-items:center;gap:10px;display:flex}" +
        ".dqt-phint{color:var(--dsw-alias-label-tertiary);margin:4px 0 0;font-size:12px;line-height:18px}" +
        ".dqt-pseg{align-items:center;flex-wrap:wrap;gap:6px;margin-top:10px;display:flex}" +
        ".dqt-psegInline{margin-top:0}" +
        ".dqt-psegBtn{appearance:none;font:inherit;cursor:pointer;height:28px;padding:0 12px;color:var(--dsw-alias-label-secondary);background:0 0;border:.5px solid var(--dsw-alias-border-l3);border-radius:8px;font-size:13px;line-height:18px}" +
        ".dqt-psegBtn:hover:not(:disabled):not(.dqt-psegOn){background:var(--dsw-specific-sidebar-nav-item-hover)}" +
        ".dqt-psegBtn:disabled{opacity:.4;cursor:default}" +
        ".dqt-psegOn{color:var(--dsw-alias-label-primary);background:var(--dsw-specific-sidebar-nav-item-active);border-color:transparent}" +
        // joined segmented control — one outer frame, options split by thin
        // dividers; same heights, fonts and surfaces as the fonttune card's
        ".dqt-seg{flex:none;display:inline-flex;overflow:hidden;background:var(--dsw-alias-bg-layer-2);border:.5px solid var(--dsw-alias-border-l3);border-radius:8px}" +
        ".dqt-segBtn{appearance:none;font:inherit;cursor:pointer;height:28px;padding:0 14px;color:var(--dsw-alias-label-secondary);background:0 0;border:none;border-left:.5px solid var(--dsw-alias-border-l3);font-size:13px;line-height:18px}" +
        ".dqt-segBtn:first-child{border-left:none}" +
        ".dqt-segBtn:hover:not(:disabled):not(.dqt-segOn){background:var(--dsw-specific-sidebar-nav-item-hover)}" +
        ".dqt-segBtn:disabled{opacity:.4;cursor:default}" +
        ".dqt-segOn{color:var(--dsw-alias-label-primary);background:var(--dsw-specific-sidebar-nav-item-active)}" +
        // scale slider — the fonttune card's slider shape (track, readout, end labels)
        ".dqt-sliderRow{align-items:center;gap:10px;margin-top:10px;display:flex}" +
        ".dqt-slider{flex:1;min-width:0;height:20px;accent-color:var(--dsw-alias-brand-primary)}" +
        ".dqt-slider:disabled{opacity:.4;cursor:default}" +
        ".dqt-sliderValue{flex:none;min-width:56px;text-align:right;color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px;font-variant-numeric:tabular-nums}" +
        ".dqt-sliderScale{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;display:flex;justify-content:space-between}";
      document.head.appendChild(s);
    })();

    return module.exports;
  }
});

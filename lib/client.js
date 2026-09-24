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
    // ---------- layers ----------
    // This plugin floats over the conversation, so it belongs in the ONE free band
    // of the stacking order: above the app's own content, below everything that
    // claims to be an overlay. Outranking other overlays is not a neutral choice —
    // the previous flat z 500 painted the handles and the panel over other plugins'
    // dialogs, and anything sitting on a dialog's close button makes that dialog
    // impossible to dismiss.
    //
    // Measured neighbours (dsh-web-frontend/dist CSS plus every @deepseek-ai
    // dsh-client-ui-* bundle and the installed plugins — values, not guesses):
    //    0-6    trajectory view internals
    //    7-10   conversation: sticky composer seat 7, transcript width grips 8
    //           ([data-width-handle], width cap 40px, visible only on hover),
    //           composer with a trigger menu 9, workspace row 10
    //    11     layout frame
    //    20     layout overlay layer (pointer-events:none, holds floating chrome)
    //    25     dsh-better-sidebar panel host (its panels live inside it)
    //    30     dsh-client-ui-cordis panel
    //    40/60  right sidebar fullscreen panel / float host
    //    100    menus and popovers (six packages)
    //    200    dsh-context modal mask + card (.lc-modal-backdrop, .lc-ov-backdrop)
    //    1000   DSH modals (settings, image viewer)
    //    1100   tooltips and the app's top overlays
    // So the whole band from 12 to 18 is free, and it is exactly where a reading
    // aid belongs: above the transcript (including the width grips, which would
    // otherwise take the pointer over our left edge) and below everything that is
    // an overlay, the app's own floating chrome included.
    var Z_HANDLE = 12; // the two edge handles
    var Z_PANEL = 14;  // the docked panel
    var Z_SHEET = 16;  // the curtain, which replaces the docked panel while it is up
    var Z_HOVER = 18;  // hover preview card: above both, still inside the free band
    var Z_ERROR = 32;  // crash banner: above our layers and the app's chrome, below
                       // DSH's popovers (100) and modals (1000)
    var EASE = "cubic-bezier(0.22, 0.9, 0.3, 1)"; // smooth non-linear slide
    // How long the docked panel takes to get out of the curtain's way. It is the
    // panel's own collapse duration (0.28s) plus a hair, so the curtain's drop only
    // starts once the panel has actually finished travelling.
    var PANEL_TUCK_MS = 300;
    // How long a collapse keeps the edge it started from (see the geometry block): the
    // panel's collapse takes 0.28s, and the host can re-measure the conversation area at
    // any point while it runs, so the freeze outlives the motion by a frame or two.
    var COLLAPSE_HOLD_MS = 420;
    // The row-end control ("jump to the end of this section") lives in the last 24px
    // of a row (a 20px button inset 4px). Every box a row can paint — the hover
    // highlight, a group header's hover label, the right-aligned context text — stops
    // END_ZONE from the row's right edge, so such a box can never touch the round
    // backdrop the button paints on hover, let alone overlap it: the reader saw the
    // two "fight" on long group headers, the label's box running right up to the
    // circle.
    var END_ZONE = 32;
    // How long the collapsed edge handle takes to slip back into the edge when it is
    // the thing that was clicked. The panel's own slide waits exactly this long, so the
    // two motions are sequential instead of crossing over.
    var EDGE_OUT_MS = 170;
    // Same idea for the curtain handle: it is pressed flat and held for a beat before it
    // leaves the tree, otherwise the flatten had no frame to play on (the curtain used
    // to open and unmount it in the same commit). It covers the whole 200ms press — the
    // press is deliberately slow-then-fast (see the element), so the curtain must not
    // start before it has finished.
    var DROP_OUT_MS = 220;
    // Width of the curtain's search column: it is pushed in from the right edge and
    // pushes the outline left by exactly this much while a search is up.
    var SHEET_SEARCH_W = 360;

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
        "a11y.list": "大纲列表：上下键移动，回车跳转，Esc 收起面板",
        "a11y.hits": "第 {n} 个命中，共 {total} 个",
        "a11y.results": "共 {n} 条结果",
        "a11y.loading": "正在检索",
        "a11y.crossEmpty": "没有结果",
        "sheet.open": "全屏大纲（从顶部展开一层幕布）",
        "sheet.openHandle": "展开幕布：全宽大纲从顶部落下",
        "sheet.close": "收起幕布",
        "sheet.noDrag": "幕布铺满对话区，不能拖动尺寸或位置",
        "levels.tip": "标题层级筛选",
        "levels.show": "显示 H",
        "levels.hide": "隐藏 H",
        "levels.offInQuestions": "只看提问时没有标题行，层级筛选不生效",
        "view.questions.tipOn": "当前：只看提问（每轮只显示时间与你的提问）。点击回到完整大纲",
        "view.questions.tipOff": "当前：完整大纲。点击只看提问（每轮只显示时间与你的提问）",
        "search.open": "搜索标题",
        "search.word": "搜索",
        "search.tail": "，回车定位…",
        "search.scope.title": "标题",
        "search.scope.full": "全文",
        "search.scope.cross": "会话",
        "search.scope.tipTitle": "当前：仅搜索标题。点击切换为全文搜索",
        "search.scope.tipFull": "当前：全文搜索。点击切换为跨会话检索",
        "search.scope.tipCross": "当前：跨会话检索（用宿主的全文索引搜所有会话的消息正文）。点击回到仅搜索标题",
        "search.cross.loading": "检索中…",
        "search.cross.empty": "其他会话里没有匹配",
        "search.cross.error": "检索失败：",
        "search.cross.unavailable": "宿主没有提供跨会话检索接口",
        "search.cross.disabled": "宿主没开启会话全文索引（session-query 的 openAt 被设成 never），跨会话检索暂时用不了",
        "search.cross.more": "宿主一次最多返回 20 条，可能还有更多",
        "search.cross.note": "跨会话检索走宿主的全文索引，只搜消息正文，模糊开关对它不生效",
        "search.cross.hidden": "另有 {n} 条命中属于已归档、子会话或当前不在列表里的会话，已略过（这些会话现在打不开）",
        "search.cross.goneHit": "这条命中所在的会话现在打不开（已归档或不在会话列表里），已跳过",
        "search.cross.switched": "已切换到该会话，同关键词已开始在本会话内查找",
        "search.cross.noSpot": "该会话已打开，但这处位置还没加载，没能跳过去；可用搜索框继续查找",
        "search.fuzzy": "模糊",
        "search.fuzzy.tipOn": "模糊匹配已开启：允许关键字中间夹少量其他文字，命中更多",
        "search.fuzzy.tipOff": "模糊匹配已关闭：只匹配连续的文字。点击开启",
        "search.empty": "没有匹配",
        "search.hintMore": "向上滚动可加载更早的消息",
        "search.hintOldest": "已经是最早的消息",
        "hint.autoOff": "上面还有更早的历史（自动加载已关闭，点「未加载」的条目才会加载）",
        "hint.bottom": "已经到底了",
        "outline.bottom": "回到底部",
        "outline.backToMine": "回到我滚到的位置",
        "turn.jumpReply": "跳转到该回合的模型回答开头",
        "row.end": "跳到本节末尾",
        "turn.jumpTurn": "跳转到该回合开头",
        "turn.unloaded": "未加载",
        "turn.loadTip": "点击加载这个回合并跳转过去",
        "turn.noMoreHistory": "宿主说这个会话没有更早的历史可翻了（它的翻页窗口已到开头），这一回合加载不出来",
        "turn.loadFailed": "这个回合没能加载出来（这段历史可能已经不在会话日志里）",
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
        "settings.sheetZoom": "幕布缩放",
        "settings.sheetZoom.tip": "幕布里的文字、图标与按钮按比例缩放，幕布本身的尺寸不变",
        "settings.handle": "把手位置",
        "settings.handle.tip": "收起面板后，边缘把手在对话区里的上下位置（0% 最下、100% 最上）",
        "settings.on": "开启",
        "settings.off": "关闭",
        "settings.fuzzy": "模糊搜索",
        "settings.hover": "悬停预览卡片",
        "settings.remember": "记住阅读位置",
        "settings.autoLoad": "自动加载历史",
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
        "a11y.list": "Outline list: arrow keys move, Enter jumps, Esc collapses the panel",
        "a11y.hits": "Match {n} of {total}",
        "a11y.results": "{n} result(s)",
        "a11y.loading": "Searching",
        "a11y.crossEmpty": "No results",
        "sheet.open": "Full-width outline (a sheet that drops from the top)",
        "sheet.openHandle": "Open the curtain: a full-width outline drops from the top",
        "sheet.close": "Close the sheet",
        "sheet.noDrag": "The sheet spans the conversation area, so it cannot be dragged or resized",
        "levels.tip": "Heading level filter",
        "levels.show": "Show H",
        "levels.hide": "Hide H",
        "levels.offInQuestions": "Questions-only view has no heading rows, so the level filter does not apply",
        "view.questions.tipOn": "Questions only: each turn shows just its time and your prompt. Click for the full outline",
        "view.questions.tipOff": "Full outline. Click to show each turn's time and your prompt only",
        "search.open": "Search headings",
        "search.word": "Search",
        "search.tail": ", Enter to jump…",
        "search.scope.title": "Title",
        "search.scope.full": "Full text",
        "search.scope.cross": "Session",
        "search.scope.tipTitle": "Titles only. Click for full-text search",
        "search.scope.tipFull": "Full text. Click for cross-session search",
        "search.scope.tipCross": "Cross-session search (the host's full-text index over every session's message text). Click to go back to titles only",
        "search.cross.loading": "Searching…",
        "search.cross.empty": "No matches in other sessions",
        "search.cross.error": "Search failed: ",
        "search.cross.unavailable": "The host does not expose cross-session search",
        "search.cross.disabled": "This deployment keeps the host's full-text session index off (session-query openAt: never), so cross-session search is unavailable",
        "search.cross.more": "The host returns at most 20 results; more may exist",
        "search.cross.note": "Cross-session search reads the host's full-text index over message text; the fuzzy switch does not apply",
        "search.cross.hidden": "Also skipped {n} hit(s) from archived, subagent or unlisted sessions — they cannot be opened",
        "search.cross.goneHit": "That hit's session cannot be opened right now (archived or not in the session list); skipped",
        "search.cross.switched": "Switched to that session and started the same keyword search here",
        "search.cross.noSpot": "The session is open, but that spot is not loaded yet — the jump was skipped; keep searching in the box",
        "search.fuzzy": "Fuzzy",
        "search.fuzzy.tipOn": "Fuzzy matching is on: a few other characters may sit between the keywords, so more matches hit",
        "search.fuzzy.tipOff": "Fuzzy matching is off: only contiguous text matches. Click to turn it on",
        "search.empty": "No matches",
        "search.hintMore": "Scroll up to load earlier messages",
        "search.hintOldest": "This is the earliest message",
        "hint.autoOff": "There is older history above (auto-loading is off — click an unloaded row to load it)",
        "hint.bottom": "You have reached the end",
        "outline.bottom": "Back to the newest entry",
        "outline.backToMine": "Back to where I scrolled to",
        "turn.jumpReply": "Jump to the start of this turn's model reply",
        "row.end": "Jump to the end of this section",
        "turn.jumpTurn": "Jump to the start of this turn",
        "turn.unloaded": "Not loaded",
        "turn.loadTip": "Click to load this turn and jump to it",
        "turn.noMoreHistory": "The host reports no earlier history left for this session (its page window is already at the start), so this turn cannot be paged in",
        "turn.loadFailed": "That turn could not be loaded (its history may no longer be in the session log)",
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
        "settings.sheetZoom": "Curtain scale",
        "settings.sheetZoom.tip": "Scales the curtain's text, icons and buttons; the curtain's own size is unchanged",
        "settings.handle": "Handle position",
        "settings.handle.tip": "Where the collapsed-panel handle sits vertically (0% bottom, 100% top of the conversation area)",
        "settings.on": "On",
        "settings.off": "Off",
        "settings.fuzzy": "Fuzzy search",
        "settings.hover": "Hover preview card",
        "settings.remember": "Remember the reading position",
        "settings.autoLoad": "Load history automatically",
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
    // Same lookup, with `{name}` placeholders filled in. Kept separate from T so the
    // host-locale path (which returns a plain string) still works: a translation that
    // drops a placeholder simply loses that number rather than printing the braces.
    function Tp(key, params) {
      var s = T(key);
      if (typeof s !== "string" || params === undefined || params === null) return s;
      return s.replace(/\{(\w+)\}/g, function (match, name) {
        return Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match;
      });
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
    var HOST_FIELDS = { dock: 1, lang: 1, levels: 1, zoom: 1, sheetZoom: 1, handle: 1, fuzzy: 1, hover: 1, debug: 1, remember: 1, autoLoad: 1 };
    // The schema defaults (mirrored here for the card's per-field reset and for the
    // one-time import of a 0.5.x install's stored values).
    var DEFAULTS = {
      dock: "left", y: 0, w: 0, h: 0,
      levels: [1, 2, 3, 4, 5, 6],
      zoom: 1, sheetZoom: 1, handle: 0.5,
      fuzzy: false, hover: true, lang: "auto", debug: false,
      remember: true, autoLoad: true
    };
    var PREF_KEYS = {
      dock: "dsh-quick-toc.dock.v2",
      y: "dsh-quick-toc.panelY.v1",
      w: "dsh-quick-toc.panelW.v1",
      h: "dsh-quick-toc.panelH.v1",
      levels: "dsh-quick-toc.levels.v1",
      zoom: "dsh-quick-toc.zoom.v1",
      sheetZoom: "dsh-quick-toc.sheetZoom.v1",
      handle: "dsh-quick-toc.handle.v1",
      fuzzy: "dsh-quick-toc.fuzzy.v1",
      hover: "dsh-quick-toc.hover.v1",
      lang: "dsh-quick-toc.lang.v1",
      remember: "dsh-quick-toc.remember.v1",
      autoLoad: "dsh-quick-toc.autoLoad.v1",
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
    // ---- per-session reading position (browser-local, like panelW/H) ----------
    // One small map in localStorage: sessionId -> { turn, seq, at }. Turn numbers are
    // the stable coordinate (a node key can disappear with a re-framed log; the turn is
    // what the host's turn index and the jump loader both speak), and `seq` is the
    // turn's own start seq — the jump loader needs it to page a turn back in, so a
    // remembered position outside the loaded window can actually be restored.
    var READ_POS_KEY = "dsh-quick-toc.readPos.v1";
    var READ_POS_MAX = 200;
    // How long a remembered position stays worth resuming. "Where was I" is a
    // convenience within a working session; coming back hours later to a stale anchor
    // is how the reader ends up somewhere they did not ask for (they expect the newest
    // messages). Past this window the position is dropped and the session opens at the
    // bottom, where the live content is.
    var READ_POS_TTL_MS = 30 * 60 * 1000;
    var readPosMap = function () {
      try {
        var raw = localStorage.getItem(READ_POS_KEY);
        var parsed = raw ? JSON.parse(raw) : null;
        return parsed && typeof parsed === "object" ? parsed : {};
      } catch (e) { return {}; }
    };
    var readPos = function (sessionId) {
      if (!sessionId) return null;
      var entry = readPosMap()[sessionId];
      return entry && typeof entry.turn === "number" ? entry : null;
    };
    var writeReadPos = function (sessionId, turn, seq) {
      if (!sessionId || typeof turn !== "number") return;
      try {
        var map = readPosMap();
        map[sessionId] = typeof seq === "number" ? { turn: turn, seq: seq, at: Date.now() } : { turn: turn, at: Date.now() };
        var ids = Object.keys(map);
        if (ids.length > READ_POS_MAX) {
          ids.sort(function (a, b) { return (map[a].at || 0) - (map[b].at || 0); });
          for (var i = 0; i < ids.length - READ_POS_MAX; i++) delete map[ids[i]];
        }
        localStorage.setItem(READ_POS_KEY, JSON.stringify(map));
      } catch (e) { /* storage full or blocked: a remembered position is a convenience */ }
    };
    var clearReadPos = function (sessionId) {
      if (!sessionId) return;
      try {
        var map = readPosMap();
        if (!Object.prototype.hasOwnProperty.call(map, sessionId)) return;
        delete map[sessionId];
        localStorage.setItem(READ_POS_KEY, JSON.stringify(map));
      } catch (e) {}
    };
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
        var sheetZoomRaw = read(PREF_KEYS.sheetZoom); // same trap
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
          sheetZoom: clampRatio(sheetZoomRaw, 1),
          handle: clampRatio(handleRaw, 0.5),
          fuzzy: read(PREF_KEYS.fuzzy) === "1",
          // absent means "on": the hover card predates this switch
          hover: read(PREF_KEYS.hover) !== "0",
          // absent means "on" too (the reader asked for this to default on)
          remember: read(PREF_KEYS.remember) !== "0",
          // and so does the history pull that follows the reader through the outline
          autoLoad: read(PREF_KEYS.autoLoad) !== "0",
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
          sheetZoom: function (v) { return String(v); },
          handle: function (v) { return String(v); },
          fuzzy: function (v) { return v ? "1" : "0"; },
          hover: function (v) { return v ? "1" : "0"; },
          remember: function (v) { return v ? "1" : "0"; },
          autoLoad: function (v) { return v ? "1" : "0"; },
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
        var sheetZoomNum = Number(v.sheetZoom);
        var handleNum = Number(v.handle);
        return {
          dock: v.dock === "right" ? "right" : "left",
          lang: v.lang === "zh" || v.lang === "en" ? v.lang : "auto",
          levels: levels || LEVELS_ALL.slice(),
          zoom: isFinite(zoomNum) ? Math.min(2, Math.max(0.5, Math.round(zoomNum * 100) / 100)) : 1,
          sheetZoom: isFinite(sheetZoomNum) ? Math.min(2, Math.max(0.5, Math.round(sheetZoomNum * 100) / 100)) : 1,
          handle: isFinite(handleNum) ? Math.min(1, Math.max(0, Math.round(handleNum * 100) / 100)) : 0.5,
          fuzzy: v.fuzzy === true,
          hover: v.hover !== false,
          remember: v.remember !== false,
          autoLoad: v.autoLoad !== false,
          debug: v.debug === true
        };
      };
      var compute = function () {
        var local = localValues || (localValues = loadLocal());
        var over = hostOverlay(hostSnap);
        if (!over) return local;
        return {
          dock: over.dock, y: local.y, w: local.w, h: local.h,
          levels: over.levels, zoom: over.zoom, sheetZoom: over.sheetZoom, handle: over.handle, fuzzy: over.fuzzy, hover: over.hover,
          lang: over.lang, remember: over.remember, debug: over.debug, autoLoad: over.autoLoad
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
              zIndex: Z_ERROR,
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
    // Cross-session hand-off. A host search hit is `{sessionId, snippet}` with no
    // seq, so the panel cannot scroll to it: it switches the session and leaves this
    // request here, and the panel that comes up for that session re-runs the keyword
    // and jumps to the first match it can actually reach. Module scope on purpose —
    // the panel for the new session may be a fresh mount.
    var pendingLocate = null;

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
      // { uiWorkspace() } bridge: the workspace-navigation service that switches sessions on
      // the alpha (`uiWorkspace.openSession(target)`); rc.2 has no such service and switches
      // through `sessions.open`. Same lookup discipline as the session bridge.
      var hostUiWorkspace = function () {
        if (!tocHost || typeof tocHost.uiWorkspace !== "function") return null;
        try {
          return tocHost.uiWorkspace();
        } catch (e) {
          return null;
        }
      };
      // Which stage of the bridge is actually ready — reported once at mount so a
      // missing jump loader can be diagnosed from the console instead of guessed.
      // Past "the loader exists" the PAGE STATE is what decides whether a jump can do
      // anything: a window the host considers complete (hasMore false) or one whose
      // base already covers the target makes loadThrough resolve without loading, and
      // from the outline that is indistinguishable from "loading stopped working".
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
        if (typeof face.loadThrough !== "function") return "no-loadThrough";
        return "ready(open=" + String(face.openState) + ",hasMore=" + String(face.hasMore)
          + ",baseSeq=" + String(face.baseSeq) + ")";
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
        // Self-healing, because the layout AROUND the conversation can change without
        // a resize: the host's own controls move that column about (measured in a real
        // browser: 40px of margin-left on the centre column shifted the scroller's
        // rect, no window resize was involved, and the plugin followed on this beat).
        // A stale rect parks the panel — and its collapse handle — on a line that no
        // longer exists, which reads as "the panel cannot be closed any more". The
        // observer is re-attached whenever the host swaps the scroller node out.
        var observed = null;
        var obs = null;
        var publish = function (next) {
          // the observer fires often; publishing an identical box would re-render
          // the whole list for nothing
          setViewport(function (prev) {
            if (prev &&
              Math.abs(prev.left - next.left) < 1 && Math.abs(prev.right - next.right) < 1 &&
              Math.abs(prev.top - next.top) < 1 && Math.abs(prev.height - next.height) < 1) {
              return prev;
            }
            return next;
          });
        };
        var compute = function () {
          var sp = document.querySelector("[data-conversation-scroll]");
          if (!sp) return;
          if (sp !== observed) { // a replaced scroller: the old observation is worthless
            observed = sp;
            if (obs) obs.disconnect();
            if (typeof ResizeObserver !== "undefined") {
              obs = new ResizeObserver(function () { compute(); });
              obs.observe(sp);
            }
          }
          var r = sp.getBoundingClientRect();
          publish({ left: r.left, right: window.innerWidth - r.right, top: r.top, height: r.height });
        };
        compute();
        window.addEventListener("resize", compute);
        var beat = setInterval(compute, 500);
        return function () {
          window.removeEventListener("resize", compute);
          clearInterval(beat);
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
      var sheetHandleRef = react.useRef(null); // curtain handle along the top edge

      // handle reveal: after the panel fully slides away, the handle fades+pops in
      var _s5 = react.useState(false);
      var handleShown = _s5[0];
      var setHandleShown = _s5[1];
      // ...and it is NOT unmounted the instant it is clicked: the collapse-side handle
      // used to disappear on the click's own frame, which read as a hard cut. It stays
      // mounted for the length of its fade-out and only then leaves the tree.
      var _s5b = react.useState(false);
      var edgeGone = _s5b[0];
      var setEdgeGone = _s5b[1];
      // ...and the panel itself waits for it: clicking the edge handle used to start the
      // panel's slide on the same frame, so the two crossed over and the panel looked
      // like it came out before the handle had gone in. While `edgeLeaving` is set the
      // panel's transition is delayed, so the handle slips home first and only then does
      // the panel slide out. (Its inline geometry is the open one from the first frame —
      // only the animation is held back — so nothing else has to move.)
      var _s5c = react.useState(false);
      var edgeLeaving = _s5c[0];
      var setEdgeLeaving = _s5c[1];
      var openFromEdge = function () {
        if (open) return;
        setEdgeLeaving(true);
        armRestore("dock");   // the position the reader closed the panel at, if any
        setOpen(true);
      };
      react.useEffect(function () {
        if (!edgeLeaving) return;
        var t = setTimeout(function () { setEdgeLeaving(false); }, EDGE_OUT_MS);
        return function () { clearTimeout(t); };
      }, [edgeLeaving]);
      react.useEffect(function () {
        if (!open) {
          setHandleShown(false);
          setEdgeGone(false);
          var t = setTimeout(function () { setHandleShown(true); }, 300); // right after the panel slides away
          return function () { clearTimeout(t); };
        }
        setHandleShown(false);
        var t2 = setTimeout(function () { setEdgeGone(true); }, EDGE_OUT_MS + 30); // the fade-out, then unmount
        return function () { clearTimeout(t2); };
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
      // Auto-load bookkeeping (see the paging block): at most one pull in flight, a beat
      // between pulls, and a per-gesture budget so a runaway loop can never swallow the
      // whole log. The switch itself is mirrored into a ref because a scheduled retry
      // fires from an older render's closure.
      var pullBusyRef = react.useRef(false);
      var autoTimerRef = react.useRef(null);
      var autoBurstRef = react.useRef(0);
      var autoBusyRef = react.useRef(0);
      var autoWatchRef = react.useRef(null);   // did the pull we started actually land? (fallback click)
      var autoProbeRef = react.useRef(0);      // throttle for the on-scroll approach probe
      var autoStampRef = react.useRef(0);
      var autoGestureRef = react.useRef(0);    // last REAL reader gesture on the outline list
      var autoLoadRef = react.useRef(true);
      var panelVisibleRef = react.useRef(true);
      // A collapse keeps the geometry it started with: the host re-measures the
      // conversation area while our panel is sliding away, and reading the new numbers
      // live moves the line the panel tucks into — it then settles somewhere other than
      // the line it slid out from. While a collapse runs, the edge it aims at is frozen.
      var geoOpenRef = react.useRef(null);
      var geoHoldRef = react.useRef(0);
      var geoSnapRef = react.useRef(null);
      // The reader's place in the outline: sampled by the scroll handler and right
      // before any change of our own, restored in a LAYOUT effect (see the paging
      // block). `anchorHintRef` remembers where the visible boundary was, so finding it
      // again stays cheap on a list with hundreds of groups.
      var anchorRef = react.useRef(null);
      var anchorHintRef = react.useRef(0);
      // one confirmation loop at a time, cancelled on unmount (see confirmPlace)
      var keepPlaceRafRef = react.useRef(null);

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

      // ---- "back to where I was when I closed this" ---------------------------
      // The outline re-centres itself on the turn being read (the follow), and opening a surface
      // lands on that turn — so a reader who had scrolled the outline somewhere of their own
      // accord finds it somewhere else afterwards, with no way back. The memory is taken AT
      // CLOSE TIME and kept PER SURFACE (the docked panel and the curtain are different shapes
      // and are left at different rows): closing the panel remembers the panel's row, closing
      // the curtain remembers the curtain's, and opening one of them arms a one-shot button in
      // the top-right corner FOR THAT SURFACE — the two memories are stored apart and can never
      // overwrite each other. Using the button — or simply scrolling back there yourself —
      // consumes that surface's memory and fades the button out, and nothing is remembered
      // again until the next close.
      //
      // What is remembered is the ROW that sat at the top AND where it sat, not a bare pixel
      // offset: the same list is re-laid out between close and open (widths, curtain handoff,
      // turns that finish loading), so an offset alone would drift off the row the reader was
      // actually looking at — but the row alone is not enough either. At the bottom of the list
      // the row on the top edge is usually CLIPPED (its own top sits above the list's), and
      // measuring "how far is that row from the top" against 0 made the button light up the
      // moment the reader reopened a list they had left at the bottom — and then walk them up by
      // that clipping distance. Comparing the row's offset NOW with the offset it had when they
      // left answers the real question ("is this a different place?"), and with zero drift
      // nothing is offered and nothing moves.
      var closedPosRef = react.useRef({ dock: null, sheet: null }); // recorded at close time
      var livePosRef = react.useRef({ dock: null, sheet: null });   // armed when that surface opens
      var _sRestore = react.useState(0);
      var setRestoreTick = _sRestore[1];
      // Which surface the reader is looking at right now: the button speaks for that one, and
      // only that one's memory is ever spent.
      var surfaceNow = function () { return sheetOpen ? "sheet" : "dock"; };
      var liveTgt = function () { return livePosRef.current[surfaceNow()]; };
      var spendRestore = function () {
        var s = surfaceNow();
        if (livePosRef.current[s] === null) return;
        livePosRef.current[s] = null;
        setRestoreTick(function (n) { return n + 1; });   // the button fades out
      };
      var noteClosed = function (which) {
        var el = listRef.current;
        if (!el) return;
        var a = anchorAt(el);                     // the row at the top of the list right now
        closedPosRef.current[which] = a
          ? { idx: a.idx, off: a.top - el.getBoundingClientRect().top }
          : null;
      };
      var armRestore = function (which) {
        var m = closedPosRef.current[which];
        closedPosRef.current[which] = null;        // one shot: this open consumes it
        livePosRef.current[which] = (m && m.idx !== undefined) ? m : null;
        if (m && m.idx !== undefined) {
          // let the restore win over the follow for a moment: otherwise the follow re-aligns
          // the READING row the instant the panel is back and eats the memory
          outlineTouchRef.current = Date.now();
        }
        setRestoreTick(function (n) { return n + 1; });
      };
      // How far that row has drifted from where the reader left it (0 = still the same place)
      var restoreDrift = function (el) {
        var tgt = liveTgt();
        if (!el || !tgt) return null;
        var node = el.querySelector('[data-group-idx="' + tgt.idx + '"]');
        if (!node) return null;                    // that row is gone: nothing to go back to
        return (node.getBoundingClientRect().top - el.getBoundingClientRect().top) - tgt.off;
      };
      var awayFromRestore = function (el) {
        var d = restoreDrift(el);
        return d !== null && Math.abs(d) > 40;
      };
      var syncBackBtn = function (el) {
        var d = restoreDrift(el);
        // the reader brought the row back to where it was by hand: that is the same as using it
        if (d !== null && Math.abs(d) <= 40) spendRestore();
      };
      var backToBrowse = function (e) {
        if (e && e.stopPropagation) e.stopPropagation();
        outlineTouchRef.current = Date.now();
        hoverEnd();
        var el = listRef.current;
        var tgt = liveTgt();
        if (!el || !tgt) return;
        var node = el.querySelector('[data-group-idx="' + tgt.idx + '"]');
        if (node) {
          // put that row back where it SAT (not necessarily at the top): a row the reader left
          // clipped by 120px goes home clipped by 120px, so the view lands exactly where it was
          var d = ((node.getBoundingClientRect().top - el.getBoundingClientRect().top) - tgt.off) / liveZoom();
          if (Math.abs(d) > 0.5) el.scrollTop = el.scrollTop + d;
        }
        syncAtBottom(el);
        spendRestore();
      };
      // The button floats over the LIST, so it has to clear whatever chrome sits above the
      // list — and that chrome differs between the docked panel (grip bar + header row, plus
      // the search row when open) and the curtain (its own toolbar). Measuring where the list
      // actually begins is exact for both, and stays right if the chrome changes height.
      var _sListTop = react.useState(0);
      var listTop = _sListTop[0];
      var setListTop = _sListTop[1];
      react.useLayoutEffect(function () {
        var root = panelRootRef.current;
        var el = listRef.current;
        if (!root || !el || !root.getBoundingClientRect || !el.getBoundingClientRect) return;
        var top = Math.round(el.getBoundingClientRect().top - root.getBoundingClientRect().top);
        if (top > 0 && top !== listTop) setListTop(top);
      });

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

      // ---- questions-only view ------------------------------------------------
      // A second way to read a long session: keep every turn's header (time + the
      // prompt) and drop the heading rows. The switch is a cross-fade, not a swap:
      // the list fades out, the mode changes while it is invisible, then it fades
      // back in — the two lists never blend into each other mid-swap. Session-local
      // on purpose (a reading mode, like the open search box, not a stored
      // preference).
      var _sQ = react.useState(false);
      var questionsOnly = _sQ[0];
      var setQuestionsOnly = _sQ[1];
      var _sQF = react.useState("idle"); // "idle" | "out" | "in"
      var listFade = _sQF[0];
      var setListFade = _sQF[1];
      var listFadeTimers = react.useRef({ out: null, in: null });
      var toggleQuestions = function () {
        if (listFadeTimers.current.out) clearTimeout(listFadeTimers.current.out);
        if (listFadeTimers.current.in) clearTimeout(listFadeTimers.current.in);
        // reduce motion is a real preference: swap without the two-phase fade
        var calm = false;
        try {
          calm = typeof window !== "undefined" && typeof window.matchMedia === "function"
            && window.matchMedia("(prefers-reduced-motion: reduce)").matches === true;
        } catch (e) { calm = false; }
        if (calm) {
          setQuestionsOnly(function (cur) { return !cur; });
          setListFade("idle");
          return;
        }
        setListFade("out");
        listFadeTimers.current.out = setTimeout(function () {
          listFadeTimers.current.out = null;
          setQuestionsOnly(function (cur) { return !cur; });
          // entering questions-only makes the level filter meaningless: close its
          // popup rather than leave a disabled control's menu open over the list
          if (!questionsOnly && typeof closeLevels === "function") closeLevels();
          setListFade("in");
          listFadeTimers.current.in = setTimeout(function () {
            listFadeTimers.current.in = null;
            setListFade("idle");
          }, 260);
        }, 150);
      };
      react.useEffect(function () {
        return function () {
          if (listFadeTimers.current.out) clearTimeout(listFadeTimers.current.out);
          if (listFadeTimers.current.in) clearTimeout(listFadeTimers.current.in);
        };
      }, []);

      // ---- keyboard navigation -------------------------------------------------
      // The list is a real widget: ↑/↓ walk its rows in visual order, Home/End jump
      // to the ends, Enter activates the row under the cursor (each row keeps its own
      // click semantics — jump / page-in / switch session), Esc collapses the panel.
      // The cursor is a keyboard artefact, NOT the reading position: the blue box
      // follows the conversation, this outline follows the keys, and they may sit on
      // different rows. -1 = no cursor (nothing is painted).
      var _sNav = react.useState(-1);
      var navIdx = _sNav[0];
      var setNavIdx = _sNav[1];
      // Polite live region: match stepping, result counts and cursor moves are
      // announced for screen readers (and read out by any a11y layer the host adds).
      var _sLive = react.useState("");
      var liveText = _sLive[0];
      var setLiveText = _sLive[1];

      // ---- full-width sheet ("幕布") -------------------------------------------
      // The same panel content, dropped from the top of the conversation area at full
      // width. It REPLACES the docked panel while open (the list keeps its ref, so
      // scrolling, page-in, the keyboard cursor and the hover card all keep working
      // against one element, not two).
      var _sSheet = react.useState(false);
      var sheetOpen = _sSheet[0];
      var setSheetOpen = _sSheet[1];
      var sheetRef = react.useRef(null);
      var sheetTimerRef = react.useRef(null);
      // Handing the docked panel over to the curtain. They are ONE list — while the
      // curtain is down the panel element IS the curtain's content — so switching
      // surfaces used to make the panel teleport: gone from the dock on the way
      // down, popping straight back in when the curtain retracted. The reader read
      // that as a flash. Now the panel always travels the way it always does:
      // while it is "aside" it renders at its collapsed spot and the existing
      // left/clip transition does the moving — it slides home just before the
      // curtain drops ("tuck"), and slides back in just after the curtain is gone
      // ("return") instead of popping into place.
      //   "tuck"   panel sliding home BEFORE the curtain opens (state must persist)
      //   "return" panel sliding back in AFTER the curtain closed (one painted frame)
      var _sAside = react.useState(null);
      var panelAside = _sAside[0];
      var setPanelAside = _sAside[1];
      // The curtain hangs from just BELOW the centre column's view tabs (对话 / 轨迹 /
      // 上下文), not from the top of the scroll container: when those tabs live inside
      // that container, viewport.top sits above them and the curtain would cover them.
      // Both edges of that strip are kept: the curtain hangs from its BOTTOM line, and
      // the curtain handle sits INSIDE the strip with its own bottom on that same line
      // (that band is host chrome, so no conversation text can ever run under it —
      // which is exactly what made the handle unreadable when it hung below the line).
      // Measured when the conversation is (re)measured, not on every render —
      // getBoundingClientRect is a layout read.
      var _sSheetTop = react.useState(null);
      var sheetStrip = _sSheetTop[0]; // { top, bottom } | null
      var setSheetTop = _sSheetTop[1];
      // The curtain handle is held in the tree for DROP_OUT_MS after the curtain starts
      // opening, so its press-flat is actually seen (the curtain opens and would
      // otherwise unmount it in the same commit).
      var _sDropGone = react.useState(false);
      var sheetHandleGone = _sDropGone[0];
      var setSheetHandleGone = _sDropGone[1];
      // the droplet's click may defer the curtain until its press has played (see the
      // handle's onClick): one timer, always cancelled before being re-armed
      var dropOpenRef = react.useRef(null);
      react.useEffect(function () { return function () { if (dropOpenRef.current) clearTimeout(dropOpenRef.current); }; }, []);
      react.useEffect(function () {
        if (!sheetOpen) { setSheetHandleGone(false); return; }
        var t = setTimeout(function () { setSheetHandleGone(true); }, DROP_OUT_MS);
        return function () { clearTimeout(t); };
      }, [sheetOpen]);
      react.useEffect(function () {
        if (!viewport) return;
        var tabs = typeof conversationTablist === "function" ? conversationTablist() : null;
        var next = null;
        if (tabs && typeof tabs.getBoundingClientRect === "function") {
          var r = tabs.getBoundingClientRect();
          if (r && r.height > 0 && r.bottom > 0) next = { top: r.top, bottom: r.bottom };
        }
        setSheetTop(next);
      }, [sheetOpen, viewport]);
      react.useEffect(function () {
        return function () {
          if (sheetTimerRef.current) clearTimeout(sheetTimerRef.current);
        };
      }, []);
      // The retract is driven by a CLASS on the DOM node rather than by state: a
      // state change re-renders the whole (possibly huge) list on the very frame the
      // animation starts, and that long task is what made the retract stutter. React
      // only rewrites `class` when the prop changes, so a class added here survives
      // re-renders until the curtain is actually gone.
      var closeSheet = function () {
        if (!sheetOpen || sheetTimerRef.current) return;
        noteClosed("sheet");   // where they were when they shut the curtain
        var el = sheetRef.current;
        if (el && el.classList) {
          el.classList.remove("dqt-sheet-open");
          el.classList.add("dqt-sheet-closing");
        }
        // the timer sits just past the exit animation (0.3s): there is no
        // animationend listener, so this is what actually closes the curtain
        sheetTimerRef.current = setTimeout(function () {
          sheetTimerRef.current = null;
          setSheetOpen(false);
          // the panel was open before the curtain: slide it back in instead of
          // letting it pop into place (the reader saw that pop as a flash)
          if (open) setPanelAside("return");
        }, 340);
      };
      var openSheet = function () {
        if (sheetOpen || panelAside) return;
        armRestore("sheet");   // the position the reader closed the curtain at, if any
        if (sheetTimerRef.current) { clearTimeout(sheetTimerRef.current); sheetTimerRef.current = null; }
        // reopening mid-retract: the node still carries the exit class and React
        // would not put the enter class back on its own (that prop never changed)
        var restoreEnterClass = function () {
          var node = sheetRef.current;
          if (node && node.classList) {
            node.classList.remove("dqt-sheet-closing");
            node.classList.add("dqt-sheet-open");
          }
        };
        if (open) {
          // The docked panel goes home FIRST — its own collapse motion, start to
          // finish — and only then does the curtain drop. Two reasons, both seen in
          // the browser: (1) the enter animation used to be armed at CLICK time, so
          // by the time the curtain became visible most of its 0.46s drop was
          // already spent and it looked like it snapped into place; (2) the panel
          // was pulled into the sheet mid-slide, which read as it flashing away.
          setPanelAside("tuck");
          sheetTimerRef.current = setTimeout(function () {
            sheetTimerRef.current = null;
            restoreEnterClass(); // the drop animation starts HERE, with the first paint
            setSheetOpen(true);
            setPanelAside(null);
          }, PANEL_TUCK_MS);
        } else {
          restoreEnterClass();
          setSheetOpen(true);
        }
      };
      // "return" only needs to exist for one painted frame: the panel renders at
      // its collapsed spot, and releasing it lets the left/clip transition carry
      // it back open. The tuck must NOT be released here — it is held until the
      // curtain actually opens.
      react.useEffect(function () {
        if (panelAside !== "return") return;
        var raf = requestAnimationFrame(function () {
          raf = requestAnimationFrame(function () { setPanelAside(null); });
        });
        return function () { cancelAnimationFrame(raf); };
      }, [panelAside]);

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
      // search scope: "title" (default) / "full" (user messages + AI replies in this
      // session) / "cross" (the HOST's full-text index across every visible session).
      // ONE pill cycles the three, so a third scope costs no extra button.
      var scopeLabel = function (scope) {
        if (scope === "full") return T("search.scope.full");
        if (scope === "cross") return T("search.scope.cross");
        return T("search.scope.title");
      };
      var toggleScope = function () {
        var next = searchScope === "title" ? "full" : (searchScope === "full" ? "cross" : "title");
        setPrevScope(searchScope);
        setSearchScope(next);
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

      // ---- cross-session search (the host's own full-text index) --------------
      // "cross" scope asks the HOST to search message text across every visible
      // session. Two host facts shape the code below: one search returns at most
      // `searchResultLimit` (20) items plus a `hasMore` flag, and an item carries
      // only `{sessionId, snippet}` — NO seq. So a hit cannot be jumped to directly:
      // clicking one switches to that session and re-runs the same keyword here (the
      // pendingLocate hand-off below).
      var _sCross = react.useState({ phase: "idle", rows: [], more: false, error: "" });
      var cross = _sCross[0];
      var setCross = _sCross[1];
      var crossAbortRef = react.useRef(null);
      var crossTimerRef = react.useRef(null);
      var crossTitle = function (id) {
        var sessions = hostSessions();
        try {
          var snap = sessions && sessions.list && typeof sessions.list.getSnapshot === "function"
            ? sessions.list.getSnapshot() : null;
          var rec = snap && snap.byId ? snap.byId[id] : null;
          if (rec && typeof rec.displayTitle === "string" && rec.displayTitle !== "") return rec.displayTitle;
        } catch (e) { /* title is decoration: the id is the fallback */ }
        return id;
      };
      // Which hits may be OFFERED. The host index covers every persisted session on
      // disk — including archived ones and sessions of workspaces this profile no
      // longer lists — so an unfiltered list offers rows that cannot be opened. The
      // rule below is the sidebar's own content-search rule (ui-workspace
      // `sessionVisible` + the registry archive set): listed, not a subagent child,
      // not archived, and never a blank session unless it is the current one.
      var crossHitAllowed = function (id) {
        if (typeof id !== "string" || id === "") return false;
        var sessions = hostSessions();
        var snap = null;
        try {
          snap = sessions && sessions.list && typeof sessions.list.getSnapshot === "function"
            ? sessions.list.getSnapshot() : null;
        } catch (e) { snap = null; }
        var rec = snap && snap.byId ? snap.byId[id] : null;
        if (rec === undefined || rec === null) return false; // not listed: cannot be opened
        if (rec.origin === "subagent") return false;
        if (snap.current === id) return true;                // the open session always works
        if (rec.blank === true) return false;                // nothing in it to have matched
        var archived = null;
        try {
          var ws = tocHost && typeof tocHost.workspaces === "function" ? tocHost.workspaces() : null;
          var wsnap = ws && ws.list && typeof ws.list.getSnapshot === "function" ? ws.list.getSnapshot() : null;
          archived = wsnap && Array.isArray(wsnap.archivedSessionIds) ? wsnap.archivedSessionIds : null;
        } catch (e) { archived = null; }
        // No workspace registry (older host): fall back to the session list's word,
        // which is still far better than offering every indexed session on disk.
        if (archived && archived.indexOf(id) >= 0) return false;
        return true;
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
        if (!searchOpen || !searchRef.current) return;
        // preventScroll: across the curtain the input arrives inside a column that is
        // still animating open, and focusing it must not scroll anything
        try { searchRef.current.focus({ preventScroll: true }); }
        catch (e) { searchRef.current.focus(); }
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

      // ---- history paging: what is loaded, what is not, and how to ask ------------
      // The loader does NOT touch the transcript. It used to nudge it 26px off DSH's
      // stick-to-bottom line before every pull, to stop DSH's `toBottom` re-pin from
      // undoing an outline-triggered page-in (0.5.1). That nudge is visible in the middle
      // column, and it fires from the background loader too, so the reader saw the
      // conversation move while they were only reading the outline ("I did not click
      // anything, why did the middle panel scroll up"). It is also no longer needed: the
      // outline's follow has its own quiet window after any outline gesture
      // (`outlineTouchRef`), so a re-pin cannot drag the rail to the newest turn any more,
      // and `glideTo` keeps its own guard for the jumps the reader actually asks for.
      // The session face carries the host's own bookkeeping — `openState`, `hasMore`
      // and `loadingOlder` — so the panel never has to infer "is there more?" from a
      // button it found in the DOM. That inference is exactly what used to stall the
      // outline: the host renders its "load earlier" button only while `hasMore` and
      // DISABLES it while a page is in flight, so a scroll-up arriving during a load was
      // read as "nothing older" — the reader was told they had reached the beginning
      // with hundreds of turns still above them.
      var sessionFace = function () {
        var sessions = hostSessions();
        var binding = sessions && typeof sessions.binding === "function" ? sessions.binding(sessionId) : null;
        return binding && binding.session ? binding.session : null;
      };
      var faceSettled = function (face) { return face.openState === undefined || face.openState === "open"; };
      var historyBusy = function (face) { return !!face && face.loadingOlder === true; };
      // The beginning is reached only when the window says so AND nothing is in flight:
      // `hasMore` is stale while a page is being pulled (it flips once that page lands),
      // and reading it during a pull is exactly how "still loading" became "no more
      // history" for the reader.
      var historyExhausted = function (face) {
        return !!face && face.hasMore === false && !historyBusy(face) && faceSettled(face);
      };
      // The host's own "load earlier" control. The API above is the normal path, but a
      // build can expose the session face and still ignore the pull; clicking this is
      // exactly what the reader would do by hand, so the auto-loader falls back to it.
      // (The reader asked for precisely this: "when it loads, click that for me".)
      var viaHostButtonRef = react.useRef(function () { return false; });
      viaHostButtonRef.current = function () {
        var btn = findLoadOlderButton();
        if (!btn || btn.disabled) return false;
          btn.click();
        return true;
      };
      var viaHostButton = function () { return viaHostButtonRef.current(); };
      // Extend the window backwards by one host page (~50 messages): cheap and bounded,
      // the way to walk into older history rather than swallow it.
      // `interactive` = the reader asked for this (their own gesture in the outline). Only
      // then do we nudge the TRANSCRIPT off DSH's stick-to-bottom line — that nudge is what
      // used to make the conversation move while the reader was only reading the outline
      // ("I did not click anything and the middle panel scrolled up"). A background prefetch
      // leaves the transcript alone: if the reader is at the newest message, DSH keeps them
      // there, and if they are mid-transcript the host compensates the prepend itself.
      var pullPage = function () {
        var face = sessionFace();
        if (!face || typeof face.loadOlder !== "function") return false;
        if (historyBusy(face) || historyExhausted(face)) return false;
          try {
          var p = face.loadOlder();
          if (p && typeof p.catch === "function") p.catch(function () {});
        } catch (e) { return false; }
        return true;
      };

      // ---- holding the reader's place while the list reflows ----------------------
      // Any load changes the list's height ABOVE the reader: the index reveals older
      // groups at the top, and a group that loads swaps two lines of preview for a whole
      // subtree. The list is a top-anchored flow, so a box can only grow downward — which
      // is exactly why the reader was pushed: everything under the grown box moves down.
      // The cure is not to grow the box upward (document flow cannot do that) but to take
      // that push back out of `scrollTop` in the SAME frame, which is indistinguishable
      // from growing upward: nothing the reader is looking at moves, the new rows simply
      // appear above the viewport. The anchor is the first group box in view, and
      // `data-group-idx` survives a ghost turning real (the group list does not change
      // length when a turn loads).
      // Scanning for it starts at the last known boundary: a full scan per scroll event
      // reads every rect in the list, which is what made long outlines stutter.
      var anchorAt = function (el) {
        var boxes = el.querySelectorAll("[data-group-idx]");
        if (!boxes || boxes.length === 0) return null;
        var lr = el.getBoundingClientRect();
        var limit = lr.top + 1;
        var i0 = anchorHintRef.current;
        if (i0 > boxes.length - 1) i0 = boxes.length - 1;
        if (i0 < 0) i0 = 0;
        // Walk from where the boundary was last seen — scrolling is gradual, so this reads
        // one or two rects per call. `i` ends up on the row that straddles the top edge.
        var i = i0;
        var r = boxes[i].getBoundingClientRect();
        while (r.bottom <= limit && i + 1 < boxes.length) { i++; r = boxes[i].getBoundingClientRect(); }
        while (r.bottom > limit && i > 0) {
          var prev = boxes[i - 1].getBoundingClientRect();
          if (prev.bottom <= limit) break;
          i--; r = prev;
        }
        // Choose the anchor. The FIRST REAL row in view wins: the placeholders ("未加载"
        // rows) are exactly what loads and grows, so anchoring below them keeps every row
        // the reader can see exactly where it is while the unloaded block grows upward out
        // of the viewport — which is the behaviour the reader asked for ("grow upward"). An
        // anchor ON a placeholder would sit still while everything under it slid down, and
        // an anchor on a row that straddles the top edge measures no growth at all (its own
        // top does not move). Falls back to the first fully visible row, then to whatever is
        // visible at the top. Bounded by what is on screen, so a few rects at most.
        var pick = i, pickTop = r.top, seenReal = false, seenFull = false;
        for (var k = i; k < boxes.length && k < i + 80; k++) {
          var rk = (k === i) ? r : boxes[k].getBoundingClientRect();
          if (rk.top >= lr.bottom) break;                     // past the bottom edge
          var ghostAttr = boxes[k].getAttribute ? boxes[k].getAttribute("data-ghost-turn") : null;
          var isGhost = ghostAttr !== null && ghostAttr !== undefined;
          if (!isGhost && !seenReal) { pick = k; pickTop = rk.top; seenReal = true; break; }
          if (isGhost && rk.top >= limit && !seenFull) { pick = k; pickTop = rk.top; seenFull = true; }
        }
        anchorHintRef.current = pick;
        return { idx: boxes[pick].getAttribute("data-group-idx"), top: pickTop };
      };
      // What the reader is looking at, and where it sits. Sampled by the scroll handler —
      // so a host-side change landing mid-scroll is still caught — and right before any
      // change we start ourselves.
      var sampleAnchor = function (el) {
        var a = el ? anchorAt(el) : null;
        anchorRef.current = a ? { idx: a.idx, top: a.top, scrollTop: el.scrollTop } : null;
        return anchorRef.current;
      };
      var restoreAnchor = function (el) {
        var a = anchorRef.current;
        if (!a || !el || !el.isConnected) return false;
        var node = el.querySelector('[data-group-idx="' + a.idx + '"]');
        if (!node) { sampleAnchor(el); return false; }
        var top = node.getBoundingClientRect().top;
        var moved = el.scrollTop - a.scrollTop;   // what the reader (or a jump) scrolled
        var zf = liveZoom();
        // Growth above the anchor moves it DOWN by exactly as much as the content grew; the
        // reader scrolling up moves it down by exactly as much as they scrolled. Both happen
        // at once when a page lands mid-gesture, so subtract the reader's part rather than
        // refusing to compensate — the old "scrollTop changed, so the reader moved, skip"
        // guard is exactly why a load landing during a scroll was still seen pushing the
        // list. (The list carries `overflow-anchor: none`, so the browser is not adjusting
        // `scrollTop` behind our back and this sum stays honest.) The measured growth is in
        // visual pixels while `moved` is already in the scroller's own units, so the growth
        // term is divided by the live factor.
        var grew = (top - a.top) / zf + moved;
        if (Math.abs(grew) < 0.5 || Math.abs(grew) > (el.clientHeight || 0) * 3) {
          // nothing grew — or something absurd happened (a repaged list, a session swap):
          // re-baseline instead of chasing it
          a.scrollTop = el.scrollTop; a.top = top;
          return false;
        }
        var before = el.scrollTop;
        el.scrollTop = before + grew;
        if (Math.abs(el.scrollTop - before) < 0.5) {
          // clamped (the reader is already at one end): nothing to hold on to
          sampleAnchor(el);
          return false;
        }
        a.scrollTop = el.scrollTop;
        a.top = top - grew * zf;    // the visual offset the anchor keeps from now on
        return true;
      };
      var holdPlace = function (el) { sampleAnchor(el); };
      // A host page lands over several ticks (window → snapshot → React render), so the
      // layout effect above is re-checked for a few frames — bounded, and it stops as soon
      // as the height settles, so an idle list costs nothing. Only ONE such loop may run:
      // a second one would correct the same content twice.
      var confirmPlace = function (el) {
        if (keepPlaceRafRef.current) cancelAnimationFrame(keepPlaceRafRef.current);
        var n = 0, lastH = -1;
        var step = function () {
          if (!el.isConnected || n > 8) { keepPlaceRafRef.current = null; return; }
          n++;
          restoreAnchor(el);
          var h = el.scrollHeight;
          if (h === lastH) { keepPlaceRafRef.current = null; return; }
          lastH = h;
          keepPlaceRafRef.current = requestAnimationFrame(step);
        };
        keepPlaceRafRef.current = requestAnimationFrame(step);
      };
      // ---- auto-load: follow the reader into the part that is not loaded ----------
      // The reader asked for this by name: "when I scroll into a gap, load it" — and,
      // just as firmly, "nothing at all when I turn it off". So the trigger is geometric
      // (an unloaded group that is actually in view) and the switch is consulted first.
      var AUTO_PACE_MS = 130;        // beat while merely PREFETCHING (nothing to catch up to)
      var AUTO_WAIT_MS = 40;         // beat while a page is in flight: the host is the limit
      var AUTO_BURST_MAX = 60;       // runaway guard only: a long gap must stay walkable
      var AUTO_BURST_IDLE_MS = 3000; // quiet this long and the budget is fresh again
      // Loading is something the READER asks for, so every automatic pull must be
      // answered by a real gesture (a wheel tick, a press, a key) within this window.
      // Purely geometric triggers — a freshly laid out list whose few rows all fit the
      // box, a panel/curtain opened, a window resized — look exactly like "an unloaded
      // turn is in view" without anyone having asked: opening the curtain once made this
      // loader call `loadThrough` on the first ghost it found, which materialised the
      // rest of the session (46k nodes, 300–900ms long tasks) before the curtain's own
      // 0.46s drop animation could paint. A gesture-gated loader cannot do that.
      var AUTO_GESTURE_MS = 1500;
      var ghostInView = function (el) {
        var ghosts = el.querySelectorAll("[data-ghost-turn]");
        if (ghosts.length === 0) return null;
        var box = el.getBoundingClientRect();
        for (var i = 0; i < ghosts.length; i++) {
          var r = ghosts[i].getBoundingClientRect();
          if (r.bottom > box.top && r.top < box.bottom) return Number(ghosts[i].getAttribute("data-ghost-turn"));
        }
        return null;
      };

      // How far AHEAD of the reader the gap is filled: while the bottom edge of the
      // nearest unloaded turn is still within this many viewports above the viewport's top
      // edge, the next page is fetched — so by the time the reader scrolls to where the
      // unloaded turns are, they are already real. The growth then happens ABOVE the view,
      // where nothing they are looking at can move; that is the trick that removes the seam
      // without animating anything.
      //
      // Measuring the GHOST (not the loaded/unloaded frontier) is what gives this its
      // hysteresis: the frontier group sits at the viewport's top edge by definition, so
      // "the frontier is within a viewport" was true no matter how much had just loaded,
      // and the loader pulled another page every beat until the whole log was in memory —
      // continuous host work, which is the stutter the reader hit while sitting still. A
      // ghost's distance, by contrast, grows by exactly the height of each page that lands,
      // so the chain stops once a page has put a viewport of real content above the reader.
      var PREFETCH_AHEAD = 1.2;
      var firstRealIndex = function () {
        var list = groupsRef.current || [];
        for (var i = 0; i < list.length; i++) if (!list[i].ghost) return i;
        return -1;
      };
      // The seq the host needs to page a turn in. The outline carries it for every turn
      // (loaded or not), because the host's projection and the jump loader both speak seq.
      var seqOfTurn = function (turn) {
        var list = groupsRef.current || [];
        for (var i = 0; i < list.length; i++) {
          if (list[i] && list[i].turn === turn) return typeof list[i].seq === "number" ? list[i].seq : null;
        }
        return null;
      };
      // Jump the window straight to a turn the reader has ARRIVED at. `loadThrough(seq)` lets
      // the host page its own history (200 messages a hop) until the window covers that seq,
      // so a deep gap closes in ONE call — the reader's complaint was exactly this ("I have
      // already scrolled into the unloaded part and it is still loading slowly"). Paging
      // 50 messages at a time stays the fallback, and stays the rule while merely
      // prefetching ahead of them, where there is nothing to catch up to.
      //
      // The target is a MARGIN further back than the row in view: jumping to exactly that one
      // turn left the next "未加载" row sitting immediately above it, so the reader saw the gap
      // again as soon as they kept scrolling. Covering `AUTO_JUMP_MARGIN` rows at a time makes
      // one jump serve the next stretch of scrolling too.
      var AUTO_JUMP_MARGIN = 8;
      var jumpSeqFor = function (turn) {
        var list = groupsRef.current || [];
        var at = -1;
        for (var i = 0; i < list.length; i++) if (list[i] && list[i].turn === turn) { at = i; break; }
        if (at < 0) return seqOfTurn(turn);
        for (var k = Math.max(0, at - AUTO_JUMP_MARGIN); k <= at; k++) {
          if (list[k] && typeof list[k].seq === "number") return list[k].seq;
        }
        return seqOfTurn(turn);
      };
      var loadThroughTurn = function (turn) {
        var face = sessionFace();
        if (!face || typeof face.loadThrough !== "function") return false;
        var seq = jumpSeqFor(turn);
        if (seq === null) return false;
        if (historyBusy(face) || historyExhausted(face)) return false;
          try {
          var p = face.loadThrough(seq);
          if (p && typeof p.catch === "function") p.catch(function () {});
        } catch (e) { return false; }
        return true;
      };
      var frontierApproaching = function (el) {
        // Read the UNLOADED rows by their own attribute. (They also carry
        // `data-group-idx`, but asking for the placeholder directly says what this is
        // about — and it is fewer boxes to measure.)
        var ghosts = el.querySelectorAll ? el.querySelectorAll("[data-ghost-turn]") : [];
        var box = el.getBoundingClientRect();
        var ahead = (box.height || 0) * PREFETCH_AHEAD;
        var above = null;   // distance from the nearest unloaded turn up to the viewport
        for (var i = 0; i < ghosts.length; i++) {
          var r = ghosts[i].getBoundingClientRect();
          if (r.bottom > box.top) return true;      // unloaded content is in view
          above = box.top - r.bottom;               // the last ghost is the nearest one
        }
        return above !== null && above < ahead;
      };
      var autoRetry = function (fast) {
        if (autoTimerRef.current) return;
        autoTimerRef.current = setTimeout(function () {
          autoTimerRef.current = null;
          pullBusyRef.current = false;
          var el = listRef.current;
          if (!el) return;
          // If our own pull changed nothing while the host still has older history, this
          // build is not honouring the API pull: fall back to the host's own control, once
          // per attempt. The reader asked for exactly this ("click that for me").
          var w = autoWatchRef.current;
          if (w) {
            var moved = firstRealIndex() !== w.frontier;
            if (moved) autoWatchRef.current = null;
            else {
              w.tries = (w.tries || 0) + 1;
              // three beats (≈0.4s) with nothing moving means this build is not landing our
              // pull: click the host's own control once instead of waiting forever
              if (!w.clicked && w.tries >= 3) {
                var face2 = sessionFace();
                if (!face2 || !historyBusy(face2)) w.clicked = viaHostButton() || true;
              }
            }
          }
          autoLoadStep(el);
        }, fast ? AUTO_WAIT_MS : AUTO_PACE_MS);
      };
      var autoLoadStep = function (el) {
        if (!autoLoadRef.current || !el || !el.isConnected) return false;
        if (pullBusyRef.current) return true;   // a pull is in flight: still progressing
        var now = Date.now();
        if (now - autoStampRef.current > AUTO_BURST_IDLE_MS) autoBurstRef.current = 0;
        if (autoBurstRef.current >= AUTO_BURST_MAX) return false;
        var face = sessionFace();
        var ghostTurn = ghostInView(el);
        if (!face) {
          // no session service (older host): the host's own control is all there is
          if (el.scrollTop <= 24 && findLoadOlderButton() && viaHostButton()) {
            autoBurstRef.current++; autoStampRef.current = now; return true;
          }
          return false;
        }
        if (historyBusy(face)) {
          // a page is in flight: WAIT for it, on a SHORT beat, so the next one starts as soon
          // as the host is done with this one (the host, not our pacing, should be the limit).
          // Reading "in flight" as "no more history" is the bug that stopped the loading.
          // These waits are not pages, so they do not spend the page budget — but they are
          // capped, so a genuinely stuck pull cannot spin here.
          autoBusyRef.current++;
          if (autoBusyRef.current <= 60) autoRetry(true);
          return true;
        }
        if (historyExhausted(face)) return false;
        // Nothing the reader did — no wheel, no press, no key — since the window above:
        // a geometric coincidence (a fresh list that happens to fit, a newly opened
        // curtain, a resized window) is not a request to load history.
        if (Date.now() - autoGestureRef.current > AUTO_GESTURE_MS) return false;
        // A ghost the reader can actually see, or the gap coming up on them.
        if (ghostTurn !== null || frontierApproaching(el)) {
          // ARRIVED at an unloaded turn: cover it in one host call (`loadThrough`), which is
          // what the reader expects ("it should load the moment I scroll to it"). A deep gap
          // walked 50 messages at a time is what made it feel like it never caught up.
          // MERELY APPROACHING (the prefetch band): one page at a time, so history is fetched
          // just ahead of the reader and nothing large lands while they sit still.
          holdPlace(el);                       // remember the place BEFORE the height changes
          autoBurstRef.current++; autoStampRef.current = now;
          pullBusyRef.current = true;
          var started = ghostTurn !== null
            ? (loadThroughTurn(ghostTurn) || pullPage())
            : pullPage();
          if (!started) { pullBusyRef.current = false; return false; }
          autoBusyRef.current = 0;   // a load started: the wait cap is per stuck load
          // One watch across the whole fruitless streak, not one per pull: re-arming it
          // every beat would reset the count and the fallback would never fire.
          if (!autoWatchRef.current) autoWatchRef.current = { frontier: firstRealIndex(), tries: 0, clicked: false };
          confirmPlace(el);                    // a load lands over several ticks
          autoRetry(true);
          return true;
        }
        // Nothing unloaded is near, so there is nothing to fetch. There used to be an
        // unconditional "we are at the very top, pull anyway" branch here; it was both
        // redundant (at the true top the unloaded turns ARE on screen, so the branch above
        // fires) and harmful: it kept pulling while the reader sat still, page after page,
        // which is host work they never asked for.
        return false;
      };
      var loadOlderOutline = function (el) {
        var grow = function () {
          if (visibleCount < groups.length) {
            // Revealing older rows prepends them, so the reader's content is pushed down.
            // Sample first and let the layout effect take the push out again in the same
            // frame: correcting two frames later (the old double-rAF) IS the bounce the
            // reader saw when they reached the unloaded part of the list.
            holdPlace(el);
            setVisibleCount(Math.min(groups.length, visibleCount + PAGE_SIZE));
            // the revealed rows are not in the DOM yet, so re-check once after the render:
            // if the reveal uncovered unloaded turns, they load within the same gesture
            autoRetry();
            return true;
          }
          return false;
        };
        var viaHostButton = function () { return viaHostButtonRef.current(); };
        // In SEARCH mode the list shows matches, not the outline: paging the outline's
        // own window would change nothing the reader can see, whereas loading the
        // conversation's older messages extends what the search can cover at all (the
        // whole-log index only carries bounded previews). So the host pull comes first
        // while a query is active.
        if (query.trim() !== "") {
          holdPlace(el);
          var pulled = pullPage() || viaHostButton();
          if (pulled) confirmPlace(el);
          return pulled || grow();
        }
        // Outline mode: reveal more of the index, and let the auto-loader fetch the
        // history behind the gap the reader has scrolled into (see autoLoadStep).
        var grew = grow();
        var fetched = autoLoadStep(el);
        return grew || fetched;
      };

      // older history still reachable? the outline can always page its own window
      // further, and beyond that the session face decides (see historyExhausted)
      var canLoadOlder = function () {
        var face = sessionFace();
        if (visibleCount < groups.length) return true;
        if (face) return !historyExhausted(face);
        return !!findLoadOlderButton();
      };
      // Positive evidence that the beginning really is reached — the ONLY state that may
      // claim it in the hint. A pull in flight, a spent burst budget or a switched-off
      // auto-loader are all "not now", never "nothing older".
      var atHistoryStart = function () {
        if (visibleCount < groups.length) return false;
        var face = sessionFace();
        if (face) return historyExhausted(face);
        return !findLoadOlderButton();
      };

      // wheel up (toward older) loads more when the list is at its top or has
      // nothing to scroll (content shorter than the panel) — so scrolling up
      // always refreshes older turns, even without a visible scrollbar
      var onListWheel = function (e) {
        outlineTouchRef.current = Date.now();
        autoGestureRef.current = Date.now();   // a wheel tick is a reader gesture
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
            } else if (atHistoryStart()) {
              showBanner(T("search.hintOldest"));
            } else if (!prefs.autoLoad) {
              // the honest message when the reader switched auto-loading off: there IS
              // more history, it simply is not being fetched behind their back
              showBanner(T("hint.autoOff"));
            }
            // otherwise a page is in flight (or this gesture's budget is spent): the
            // silence is deliberate — "已经是最早" here is what used to lie
          }
        }
      };

      // scroll to the top edge also loads older groups (keeps the visual position)
      var onListScroll = function (e) {
        outlineTouchRef.current = Date.now();
        // the scroll container itself: a real scroll event's `currentTarget` IS the list
        // element, which is also what the paging logic reads geometry from
        var el = e.currentTarget;
        syncAtBottom(el);
        var upward = el.scrollTop < lastScrollTopRef.current - 2;
        if (upward) {
          if (hint === "more") setHint("");
          if (hoverCard) hoverEnd();
        }
        lastScrollTopRef.current = el.scrollTop;
        syncBackBtn(el);   // reached the remembered place by hand? the button is done
        // Remember what the reader is looking at. Sampling on every scroll event is what
        // lets a change the reader did NOT start — the host extending the window by itself
        // — be compensated too: the layout effect knows where the anchored row was before
        // the height changed and puts it back before the push is ever painted.
        sampleAnchor(el);
        // The gap is filled AHEAD of the reader, so "reached the very top" is not the only
        // trigger any more: on any upward movement, ask the auto-loader whether the
        // unloaded stretch is coming into range (it decides, see frontierApproaching).
        // Throttled, because that probe reads geometry.
        if (upward && el.scrollTop > 24 && Date.now() - autoProbeRef.current > 120) {
          autoProbeRef.current = Date.now();
          autoLoadStep(el);
        }
        if (el.scrollTop <= 24) {
          // Reaching the top is the ONLY place the exhausted case can be told
          // apart from "keep scrolling": after a search the list is parked at the
          // bottom, so the first wheel-up merely scrolls and never gets here.
          var progressed = loadOlderOutline(el);
          if (!progressed && upward) {
            if (query.trim() !== "") {
              if (hint !== "oldest") setHint("oldest");
            } else if (atHistoryStart()) {
              showBanner(T("search.hintOldest"));
            } else if (!prefs.autoLoad) {
              showBanner(T("hint.autoOff"));
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
      // The curtain carries its OWN scale: the docked panel's factor does not apply to it,
      // and a reader who wants a dense outline in the dock and a larger one across the
      // curtain (or the other way round) gets two independent sliders.
      //
      // The slider's 100% is 0.9 of the size the curtain had before this setting existed: the
      // reader asked for that base once they could compare it with a scaled one, and 100% is
      // still what the card reads at the default — the mapping is re-based here instead of
      // shipping a slider whose default reads 90%, so a stored factor keeps meaning the same
      // fraction of this base.
      var SHEET_ZOOM_BASE = 0.9;
      var sheetZoom = (prefs.sheetZoom > 0 ? prefs.sheetZoom : 1) * SHEET_ZOOM_BASE;
      // Whichever surface is on screen owns the coordinate space the list lives in: the
      // scroller's scrollTop is in the zoomed space while getBoundingClientRect reports
      // visual pixels, so a measured delta has to be divided by THAT factor before it is
      // written back as a scroll offset (and a CSS length written inside the surface is
      // divided so it keeps its visual size).
      var liveZoom = function () { return sheetOpen ? sheetZoom : zoom; };
      var liveLen = function (v) {
        var f = liveZoom();
        if (f === 1) return typeof v === "number" ? v + "px" : v;
        return typeof v === "number" ? (v / f) + "px" : "calc(" + v + " / " + f + ")";
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
      // A live handle on the newest group list, for callbacks that outlive their
      // render (the "did that turn actually page in?" verdict below).
      var groupsLiveRef = react.useRef(groups);
      groupsLiveRef.current = groups;
      react.useEffect(function () {
        return function () {
          if (keepPlaceRafRef.current) cancelAnimationFrame(keepPlaceRafRef.current);
        };
      }, []);
      // One history-rebuild retry per session after a jump that never landed.
      // Hooks must sit ABOVE every early return (this panel returns null for an
      // empty conversation) or React aborts with #310.
      var jumpRetryRef = react.useRef(false);
      react.useEffect(function () { jumpRetryRef.current = false; }, [sessionId]);
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
        // cross-session scope lists HOST hits instead of local ones: the local list
        // (and the in-chat highlight it drives) stays out of the way.
        if (searchScope === "cross") return [];
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
        // A long session's conversation holds thousands of message anchors, and reading a
        // rect for every one of them ~16x/s (plus the 250ms poll) is main-thread work that
        // GROWS with the session length — that is frame loss the reader notices after
        // leaving the app open for a long time. So the node list is cached and the scan
        // starts at the boundary seen last time: a handful of rects per update instead of
        // thousands. The cache is dropped when the port changes or its two ends change
        // (the host mounts and unmounts messages while it repages the window).
        var cachedSp = null, cachedRows = null, cachedCount = -1, cachedFirst = null, cachedLast = null;
        var cursor = 0;
        var rowsOf = function (sp) {
          var list = sp.querySelectorAll("[data-chat-anchor-key]");
          var first = list.length > 0 ? list[0].dataset.chatAnchorKey : null;
          var last = list.length > 0 ? list[list.length - 1].dataset.chatAnchorKey : null;
          if (sp !== cachedSp || list.length !== cachedCount || first !== cachedFirst || last !== cachedLast) {
            cachedSp = sp; cachedRows = list; cachedCount = list.length;
            cachedFirst = first; cachedLast = last; cursor = 0;
          }
          return cachedRows;
        };
        var update = function (force) {
          // a jump glide carries the conversation past many turns; following each
          // transient position would make the rail sprint through the whole
          // outline (wild jumps on rapid consecutive clicks), so hold still while
          // one is in flight — the poll syncs the rail to the landing afterwards
          if (glide) return;
          // scroll frames are hot and a document-level capture listener sees every
          // scroll in the app; the rail only changes when a different turn crosses
          // the viewport, so cap the row measurement. While the panel is COLLAPSED
          // (or handed to the curtain) nothing on screen can change, so the cap goes
          // way up — but the scan still runs, because it is also what remembers the
          // reader's position.
          var now = Date.now();
          var gap = panelVisibleRef.current ? 60 : 800;
          if (!force && now - lastRun < gap) return;
          lastRun = now;
          if (!chatViewRef.current) return;
          var sp = document.querySelector("[data-conversation-scroll]");
          if (!sp) return;
          var lr = sp.getBoundingClientRect();
          var vTop = lr.top;
          var vBottom = lr.top + lr.height;
          var rows = rowsOf(sp);
          if (!rows || rows.length === 0) return;
          if (cursor > rows.length - 1) cursor = rows.length - 1;
          if (cursor < 0) cursor = 0;
          var cr = rows[cursor].getBoundingClientRect();
          while (cr.bottom <= vTop && cursor + 1 < rows.length) { cursor++; cr = rows[cursor].getBoundingClientRect(); }
          while (cr.bottom > vTop && cursor > 0) {
            var pr = rows[cursor - 1].getBoundingClientRect();
            if (pr.bottom <= vTop) break;
            cursor--; cr = pr;
          }
          var actives = [];
          var seen = {};
          for (var i = cursor; i < rows.length; i++) {
            var r = rows[i].getBoundingClientRect();
            if (r.top >= vBottom) break;   // document order: nothing below is visible either
            var k = rows[i].dataset.chatAnchorKey;
            var gi = keyToGroup[k];
            if (gi !== undefined && !seen[gi]) { seen[gi] = true; actives.push(gi); }
          }
          var sig = actives.slice().sort().join(",");
          if (sig === activeSigRef.current) return;
          activeSigRef.current = sig;
          setActiveGroup(actives);
          if (actives.length === 0) return;
          // remember where the reader is (debounced): the topmost visible turn, with
          // its start seq so a later restore can page it back in
          var giSave = actives[0];
          if (groups[giSave]) savePosition(groups[giSave]);
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
            // The turn being read goes to the TOP of the list. This used to CENTRE it, which is
            // why the follow stopped "a little short of the bottom": for the newest turn the
            // centre is above the end of the list, so the scroll landed half a viewport early.
            // Aligning to the top needs no clamp at all — the list's own end does the work.
            // (Rects are visual; the factor turns the delta back into the scroller's units.)
            var delta = (node.getBoundingClientRect().top - el.getBoundingClientRect().top) / liveZoom();
            if (Math.abs(delta) > 1) el.scrollTop = el.scrollTop + delta;
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
        // cross-session scope: the host owns the searching, so there are no local
        // matches — no n/N stepping and no keyword highlight in this conversation.
        if (searchScope === "cross") return [];
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

      // ---- cross-session query: debounce, abort the superseded one ------------
      // 320ms of quiet keeps a fast typist from spending the host's search budget
      // on prefixes; the previous request is aborted, and an aborted reply is
      // dropped (a late answer for an older query must not overwrite the new one).
      react.useEffect(function () {
        var q = query.trim();
        var clearPending = function () {
          if (crossTimerRef.current) { clearTimeout(crossTimerRef.current); crossTimerRef.current = null; }
        };
        if (searchScope !== "cross" || q === "") {
          if (crossAbortRef.current) { crossAbortRef.current.abort(); crossAbortRef.current = null; }
          clearPending();
          setCross(function (cur) {
            return (cur.phase === "idle" && cur.rows.length === 0) ? cur : { phase: "idle", rows: [], more: false, error: "" };
          });
          return;
        }
        var sessions = hostSessions();
        if (!sessions || typeof sessions.search !== "function") {
          setCross({ phase: "error", rows: [], more: false, error: T("search.cross.unavailable") });
          return;
        }
        clearPending();
        crossTimerRef.current = setTimeout(function () {
          crossTimerRef.current = null;
          if (crossAbortRef.current) crossAbortRef.current.abort();
          var ctl = (typeof AbortController !== "undefined") ? new AbortController() : null;
          crossAbortRef.current = ctl;
          setCross({ phase: "loading", rows: [], more: false, error: "" });
          var started;
          try {
            started = sessions.search(q, ctl ? ctl.signal : undefined);
          } catch (e) {
            setCross({ phase: "error", rows: [], more: false, error: String(e && e.message ? e.message : e) });
            return;
          }
          Promise.resolve(started).then(function (result) {
            if (ctl && ctl.signal.aborted) return;
            if (!result || result.ok !== true) {
              var msg = (result && result.error && result.error.message) ? String(result.error.message) : "unknown error";
              // The deployment default is an index that is never opened, and the host
              // says so in engineering terms. Say what it means for the reader instead,
              // and keep the host's own words available for the "any other error" case.
              if (/SESSION_QUERY_SEARCH_DISABLED|session search is disabled|openAt/i.test(msg)) {
                msg = T("search.cross.disabled");
              }
              setCross({ phase: "error", rows: [], more: false, error: msg });
              return;
            }
            var value = result.value || {};
            var items = Array.isArray(value.items) ? value.items : [];
            var rows = [];
            var hidden = 0;
            for (var i = 0; i < items.length; i++) {
              var it = items[i];
              if (!it || typeof it.sessionId !== "string") continue;
              // never offer a hit the panel could not open (archived, unlisted,
              // subagent child): the index covers every persisted session on disk
              if (!crossHitAllowed(it.sessionId)) { hidden += 1; continue; }
              rows.push({ sessionId: it.sessionId, snippet: typeof it.snippet === "string" ? it.snippet : "" });
            }
            setCross({ phase: "done", rows: rows, more: value.hasMore === true, error: "", hidden: hidden });
          }, function (e) {
            if (ctl && ctl.signal.aborted) return;
            setCross({ phase: "error", rows: [], more: false, error: String(e && e.message ? e.message : e) });
          });
        }, 320);
      }, [searchScope, query, langKey]);

      // leaving the panel unmounts it: abort an in-flight host search
      react.useEffect(function () {
        return function () {
          if (crossAbortRef.current) crossAbortRef.current.abort();
          if (crossTimerRef.current) clearTimeout(crossTimerRef.current);
        };
      }, []);

      // clicking a cross-session hit: switch the session, then leave the keyword for
      // the panel that comes up (see pendingLocate) — the host hit has no seq, so the
      // jump happens on the other side, after the same search runs there.
      //
      // Two dialects again: rc.2 switches sessions with `sessions.open(id)`, while the
      // alpha moved that decision to the workspace navigation service
      // (`uiWorkspace.openSession(target)`) and dropped `open` from the session service
      // altogether. Both are optional lookups, so whatever the host offers is used and a
      // host offering neither says so instead of doing nothing.
      var openSessionById = function (id) {
        var uiWorkspace = hostUiWorkspace();
        if (uiWorkspace && typeof uiWorkspace.openSession === "function") {
          uiWorkspace.openSession(id);
          return true;
        }
        var sessions = hostSessions();
        if (sessions && typeof sessions.open === "function") {
          sessions.open(id);
          return true;
        }
        return false;
      };
      var canOpenSession = function () {
        var uiWorkspace = hostUiWorkspace();
        if (uiWorkspace && typeof uiWorkspace.openSession === "function") return true;
        var sessions = hostSessions();
        return !!(sessions && typeof sessions.open === "function");
      };
      var openCrossHit = function (hitSessionId) {
        if (!canOpenSession()) {
          showBanner(T("search.cross.unavailable"));
          return;
        }
        // the list/archive set can change between the search and the click
        if (!crossHitAllowed(hitSessionId)) {
          showBanner(T("search.cross.goneHit"));
          return;
        }
        pendingLocate = { sessionId: hitSessionId, query: query.trim(), at: Date.now() };
        try {
          openSessionById(hitSessionId);
        } catch (e) {
          pendingLocate = null;
          showBanner(T("search.cross.error") + String(e && e.message ? e.message : e));
          return;
        }
        showBanner(T("search.cross.switched"));
      };

      // the arriving side of that hand-off: prefill the keyword in full-text scope,
      // then jump to the first row that really contains it. Best effort by design —
      // the spot may sit in history this window has not paged in, so a grace period
      // ends in an honest "not loaded yet" banner rather than a silent nothing.
      var locateTimerRef = react.useRef(null);
      react.useEffect(function () {
        var req = pendingLocate;
        if (!req) return;
        if (req.sessionId !== sessionId || !req.query) return;
        if (Date.now() - req.at > 15000) { pendingLocate = null; return; }
        if (query !== req.query) { setQuery(req.query); setSearchScope("full"); return; }
        if (searchScope !== "full") { setSearchScope("full"); return; }
        if (resultRows.length === 0) {
          if (!locateTimerRef.current) {
            locateTimerRef.current = setTimeout(function () {
              locateTimerRef.current = null;
              if (pendingLocate === req) {
                pendingLocate = null;
                showBanner(T("search.cross.noSpot"));
              }
            }, 2600);
          }
          return;
        }
        if (locateTimerRef.current) { clearTimeout(locateTimerRef.current); locateTimerRef.current = null; }
        pendingLocate = null;
        var pick = 0;
        for (var i = 0; i < resultRows.length; i++) {
          var r = resultRows[i];
          if (((r.title || "") + " " + (r.snippet || "")).indexOf(req.query) >= 0) { pick = i; break; }
        }
        goToRow(pick);
      }, [sessionId, query, searchScope, resultRows]);

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
        // cross-session scope: the list is host hits, so neither the n/N cursor nor
        // the "scroll up for older messages" hint applies
        if (searchScope === "cross") { setHint(""); return; }
        if (matches.length > 0) setMatchIdx(matches.length - 1);
        // arm the "scroll up for older messages" hint: the result list only covers
        // what the window holds, and older turns are one upward scroll away
        setHint(canLoadOlder() ? "more" : "");
      }, [query, matches.length, searchScope]);

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

      // ---- remember the reading position --------------------------------------
      // Saved: the turn the reader is actually looking at (the first group crossing
      // the conversation viewport, the same signal the rail follows), written 700ms
      // after the scrolling stops. Restored: once per session mount, quietly — a
      // position that can no longer be paged in is forgotten rather than announced.
      var restoreDoneRef = react.useRef(false);
      var restoreQuietRef = react.useRef(0);
      var posTimerRef = react.useRef(null);
      var rememberRef = react.useRef(true);
      rememberRef.current = !!prefs.remember;
      // the auto-loader's switch, mirrored for the same reason: its retry fires from an
      // older render's closure, and turning the setting off must stop it immediately
      autoLoadRef.current = !!prefs.autoLoad;
      // Is any of the outline actually on screen? The follow scan is cheap now, but while
      // the panel sits collapsed there is no point measuring at scroll-frame rate.
      panelVisibleRef.current = !!(open || sheetOpen);
      react.useEffect(function () { return function () { if (posTimerRef.current) clearTimeout(posTimerRef.current); }; }, []);
      react.useEffect(function () { return function () { if (autoTimerRef.current) clearTimeout(autoTimerRef.current); }; }, []);
      // `g` is the outline group the reader is looking at (its turn AND its start seq,
      // so the position can be paged back in later, not just jumped to while loaded)
      var savePosition = function (g) {
        if (!rememberRef.current) return;
        if (!g || typeof g.turn !== "number") return;
        if (Date.now() - restoreQuietRef.current < 2500) return;   // the restore's own scrolling
        if (posTimerRef.current) clearTimeout(posTimerRef.current);
        posTimerRef.current = setTimeout(function () {
          posTimerRef.current = null;
          writeReadPos(sessionId, g.turn, g.seq);
        }, 700);
      };

      // ---- keyboard cursor: paint + keep in view ------------------------------
      // Hooks MUST sit above the early return below (a conditional hook aborts the
      // whole panel with React #310); the helpers they call are defined later, which
      // is fine because the callbacks run after the render.
      react.useEffect(function () {
        var el = listRef.current;
        var rows = el && typeof el.querySelectorAll === "function"
          ? Array.prototype.slice.call(el.querySelectorAll("[data-nav-row]")) : [];
        if (navIdx >= rows.length) { setNavIdx(rows.length > 0 ? rows.length - 1 : -1); return; }
        for (var i = 0; i < rows.length; i++) {
          if (rows[i] && rows[i].classList && typeof rows[i].classList.toggle === "function") {
            rows[i].classList.toggle("dqt-nav", i === navIdx);
          }
        }
        if (navIdx >= 0 && navIdx < rows.length && el && typeof el.getBoundingClientRect === "function"
          && typeof rows[navIdx].getBoundingClientRect === "function") {
          var box = el.getBoundingClientRect();
          var rr = rows[navIdx].getBoundingClientRect();
          if (box && rr && typeof box.top === "number" && typeof rr.top === "number") {
            var factor = zoom > 0 ? zoom : 1;
            if (rr.top < box.top + 2) el.scrollTop -= (box.top + 2 - rr.top) / factor;
            else if (rr.bottom > box.bottom - 2) el.scrollTop += (rr.bottom - box.bottom + 2) / factor;
          }
        }
      }, [navIdx, groups, resultRows, cross, query, visibleCount, open, questionsOnly]);
      // live region: what the reader just did (search hits / results / cursor)
      react.useEffect(function () {
        if (!query.trim()) { setLiveText(""); return; }
        if (searchScope === "cross") {
          if (cross.phase === "loading") setLiveText(T("a11y.loading"));
          else if (cross.phase === "error") setLiveText(cross.error || T("a11y.crossEmpty"));
          else setLiveText(cross.rows.length > 0 ? Tp("a11y.results", { n: cross.rows.length }) : T("a11y.crossEmpty"));
          return;
        }
        if (matches.length > 0) setLiveText(Tp("a11y.hits", { n: (matchIdx % matches.length) + 1, total: matches.length }));
        else setLiveText(T("search.empty"));
      }, [query, searchScope, cross.phase, cross.rows.length, cross.error, matches.length, matchIdx, langKey]);

      // ---- restore the remembered position (once per session mount) -----------
      // Hooks must stay above the early return below. Runs after the first content
      // arrives; a stored turn that is already the newest (or within the newest two
      // groups) means there is nothing to restore, and a position older than
      // READ_POS_TTL_MS is dropped instead of resumed: coming back later, the reader
      // expects the newest messages, not an anchor from a previous sitting.
      react.useEffect(function () {
        if (restoreDoneRef.current) return;
        if (groups.length === 0) return;
        if (!chatViewActive) return;
        restoreDoneRef.current = true;
        if (!prefs.remember) return;
        var saved = readPos(sessionId);
        if (!saved) return;
        if (typeof saved.at === "number" && Date.now() - saved.at > READ_POS_TTL_MS) {
          clearReadPos(sessionId); // stale: open at the bottom, as if it were never saved
          return;
        }
        var newest = [];
        for (var i = Math.max(0, groups.length - 2); i < groups.length; i++) {
          if (typeof groups[i].turn === "number") newest.push(groups[i].turn);
        }
        if (newest.indexOf(saved.turn) >= 0) return;
        restoreQuietRef.current = Date.now();
        var gi = -1;
        for (var j = 0; j < groups.length; j++) {
          if (groups[j].turn === saved.turn) { gi = j; break; }
        }
        if (gi >= 0 && !groups[gi].ghost) {
          var g = groups[gi];
          var key = (g.msgs && g.msgs.length > 0) ? g.msgs[0].key
            : (g.userKey || (g.headings.length > 0 ? g.headings[0].key : ""));
          if (key) {
            jump(key, 0);
            revealGroupInOutline(gi);
            return;
          }
        }
        // Not in the loaded window (or nothing jumpable in it): page it in quietly.
        // The seq comes from the host outline — the stored entry may predate the seq
        // being written, and loadThrough(undefined) pages nowhere, so the restore used
        // to sit out its 8s deadline and then forget a position it could have resumed.
        var seq = typeof saved.seq === "number" ? saved.seq : null;
        if (seq === null) {
          for (var k = 0; k < groups.length; k++) {
            if (groups[k] && groups[k].turn === saved.turn && typeof groups[k].seq === "number") { seq = groups[k].seq; break; }
          }
        }
        openTurn(saved.turn, seq === null ? undefined : seq, true);
      }, [groups, prefs.remember, chatViewActive, sessionId]);

      // ---- holding the reader's place, before the browser paints ----------------
      // Every render can have changed the list's height: older rows revealed, a ghost
      // replaced by a whole real subtree, the host extending its window on its own. This
      // runs after React wrote the DOM and BEFORE the browser paints, which is the only
      // place the correction is invisible — the reader sees the new rows appear above the
      // viewport instead of seeing their own content pushed down and then snapped back.
      // It writes nothing when the anchor has not moved, so an idle list costs one
      // measurement per render and nothing else.
      // No dep array on purpose: the height can change for reasons this component does not
      // get told about (the host repaging its window changes the rows' heights without
      // necessarily changing the group list's identity), and the check is cheap — one
      // attribute query and one rect, and it writes nothing when the anchor has not moved.
      react.useLayoutEffect(function () {
        var el = listRef.current;
        if (el) restoreAnchor(el);
      });

      // ---- opening a surface: land on the turn being read ----------------------
      // ONE rule for both surfaces: what the reader is reading sits at the TOP of the list —
      // except when it is one of the newest turns, where the list cannot scroll any further and
      // the row therefore lands at the bottom. Nothing clamps it: the rule limits itself.
      // The docked panel used to just show wherever the list had last been left, which is
      // exactly why the two surfaces disagreed about where they open.
      //
      // Hooks stay above the early return; the helpers they call are assigned later
      // in the render body, which is fine because this runs after the render.
      var landOnReadingRow = function () {
        var el = listRef.current;
        if (!el) return undefined;
        // A reader who had not scrolled the outline is at its bottom, and opening the CURTAIN
        // must not move them: its container geometry changes wholesale, and the "hold the
        // anchor" correction would put a stale row back where it was — the list then sat a
        // little above the newest turn until the follow walked it down. Pin the bottom instead,
        // for this transition only, and skip the reveal (there is nothing to reveal to: they
        // are already reading the newest turn). The docked panel reshapes nothing — it opens
        // around a list that kept its geometry — so there it has nothing to pin.
        if (atBottomRef.current) {
          if (!sheetOpen) return undefined;
          anchorRef.current = null;          // no compensation against a stale anchor
          el.scrollTop = el.scrollHeight;
          syncAtBottom(el);
          var again = requestAnimationFrame(function () {   // ...and once more, after layout
            var el2 = listRef.current;
            if (!el2 || !atBottomRef.current) return;
            el2.scrollTop = el2.scrollHeight;
            syncAtBottom(el2);
            sampleAnchor(el2);
          });
          return function () { cancelAnimationFrame(again); };
        }
        var gi = activeGroup && activeGroup.length > 0 ? activeGroup[0] : -1;
        if (gi >= 0) revealGroupInOutline(gi);
        return undefined;
      };
      react.useEffect(function () {
        if (!sheetOpen) return undefined;
        var el = listRef.current;
        if (el && typeof el.focus === "function") el.focus();
        return landOnReadingRow();
      }, [sheetOpen]);
      // The docked panel obeys the same rule when the reader opens IT. Only its own open counts
      // (`open` false -> true): the curtain handing the panel back leaves `open` true, and there
      // the list keeps the place the reader was just looking at in the curtain.
      react.useEffect(function () {
        if (!open) return undefined;
        return landOnReadingRow();
      }, [open]);

      // ---- nothing to show without headings ----
      if (groups.length === 0) return null;

      // ---- geometry: ONE parked anchor; the dock side lives in the transform --------------
      // The box is parked at a single spot — off-area to the LEFT of the conversation — and
      // every position the panel takes (open, collapsed on either dock, handed to the
      // curtain) is a `transform` offset from there. Two reasons:
      //  * a dock switch then animates the TRANSFORM alone, so the panel travels across the
      //    screen on the compositor. Docking used to move `left` (which is not in the
      //    transition list): the box teleported to the other side while only the transform
      //    animated, so the panel vanished on one side and slid in from the other.
      //  * `left` must never be animated: it re-lays out the whole panel — header, toolbar
      //    and every rendered row — on every frame, and with a long session loaded that
      //    layout cannot keep up (the wipe ran while the slide stalled, and the panel
      //    flickered). Adding `left` to the transition for a dock switch was measured as
      //    "very laggy and flashing" for exactly this reason.
      // The COLLAPSED spot is per dock (left: the anchor itself; right: one panel width past
      // the open position), which is what makes the collapse fly out toward its own edge.
      // (The scale preference leaves all of this alone: it acts on the panel's inner box,
      // so the panel itself keeps the width and height the reader dragged.)
      var dockRight = dock === "right";
      // Keep the OPEN panel inside the window whatever the conversation area does.
      // The area is the host's to move: its transcript width grips rewrite the
      // column, a sidebar or another plugin's split view can shift or shrink it,
      // and the reader can also change the window itself. A panel pushed past the
      // edge takes its own header — and with it the only ✕ — out of reach, which
      // is the difference between "misplaced" and "cannot be closed any more".
      // (The collapsed panel is parked deliberately outside the area and is hidden
      // by its own clip, so only the open position is clamped.)
      var clampLeft = function (x) {
        return Math.max(8, Math.min(Math.max(8, window.innerWidth - panelW - 8), x));
      };
      // While the panel is being handed over to (or back from) the curtain it is
      // rendered at its COLLAPSED geometry, so the same transform/clip transition that
      // serves open/collapse also serves the handoff: no teleport, no flash.
      var geoOpen = open && !panelAside;
      var anchorLeft = viewport ? viewport.left - panelW - 8 : -(panelW + 48);
      var openLeft;
      if (dockRight) {
        // RIGHT dock: keep the panel's VISIBLE right edge pinned at the SAME
        // line when collapsed as when expanded (the expand edge is correct).
        var openRight = window.innerWidth - (viewport ? viewport.right + 48 : 60) - panelW;
        openLeft = clampLeft(openRight);
      } else {
        // LEFT dock open (left dock is the confirmed-correct reference — untouched)
        openLeft = clampLeft(viewport ? viewport.left + 8 : 8);
      }
      // A collapse finishes at the line it started from. The area we park against can be
      // re-measured while the panel is still sliding away — the host rewrites it when the
      // transcript lays out, and the window itself can change — and aiming at the new
      // numbers mid-flight lands the panel somewhere other than the edge it came out of
      // (measured: with the area re-measured during the collapse, the last visible strip
      // sat at 1396 instead of the 1526 line the panel had slid out from). So the
      // open -> closed step freezes the edge the collapse heads for, and the next open —
      // which reads the area afresh — picks up the new geometry. A dock switch cancels the
      // freeze: that is the reader asking for the other side, not a re-measure. The first
      // render arms nothing: a panel that was never open has no edge to hold, and pinning
      // the pre-measurement fallback would leave the closed box where no such panel goes.
      if (geoOpenRef.current === null) {
        geoOpenRef.current = geoOpen;
      } else if (geoOpenRef.current !== geoOpen) {
        geoOpenRef.current = geoOpen;
        geoHoldRef.current = geoOpen ? 0 : Date.now() + COLLAPSE_HOLD_MS;
        geoSnapRef.current = geoOpen ? null : { anchorLeft: anchorLeft, openLeft: openLeft, dock: dock };
      }
      var geoFrozen = geoSnapRef.current !== null && geoSnapRef.current.dock === dock
        && Date.now() < geoHoldRef.current;
      if (geoFrozen) {
        anchorLeft = geoSnapRef.current.anchorLeft;
        openLeft = geoSnapRef.current.openLeft;
      }
      var openOffset = openLeft - anchorLeft;
      var parkedOffset = dockRight ? (openLeft + panelW) - anchorLeft : 0;
      var panelLeft = anchorLeft;
      var panelOffset = geoOpen ? openOffset : parkedOffset;
      var panelTransform = panelOffset === 0 ? "none" : "translateX(" + zLen(panelOffset) + ")";
      var vMaxH = viewport ? Math.max(200, viewport.height - 28) : "72vh";
      // same reasoning vertically: the draggable offset is stored in localStorage
      // and can outlive the layout it was chosen for
      var baseTopPx = Math.max(8, Math.min(
        Math.max(8, window.innerHeight - 120),
        (viewport ? viewport.top + 14 : window.innerHeight * 0.12) + panelY
      ));
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
      // The glide machinery is target-agnostic on purpose: the target is a live
      // function of the scrollport, so the same stick-zone lift, drift re-aim,
      // stall watchdog and landing re-checks serve both "put this heading at the
      // top" (jump) and "put this section's end at the visible bottom" (end jump).
      var glideToTarget = function (sp, getTarget) {
        var t0 = getTarget(sp);
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
            var next = getTarget(sp);
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
            var live = getTarget(sp); // the target's offset RIGHT NOW
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
          var live = getTarget(sp);
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

      var glideTo = function (el) {
        var sp = el.closest ? el.closest("[data-conversation-scroll]") : null;
        if (!sp) return;
        glideToTarget(sp, function (s) { return scrollTargetOf(el, s); });
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

      // ---- jump to the END of a section ----------------------------------------
      // Every outline row and every group header also carries a small "to the
      // section's end" control at its far right. The landing is the boundary where
      // that content stops: for a heading the first subsequent heading of the same
      // or a higher level, never past the end of its own turn; for a group header
      // the end of the turn. The boundary is set down just above the sticky
      // composer seat (its height rides in --dsh-composer-height) so the section's
      // tail is actually on screen instead of hidden underneath the input box.
      // Everything shares the target-agnostic glide, so a long end jump gets the
      // same stick-zone lift, drift re-aim and landing re-checks as a normal jump.
      var endLimitOf = function (el, sp) {
        var spTop = sp.getBoundingClientRect().top;
        var elTop = el.getBoundingClientRect().top;
        // Everything returned here is SCROLLER-relative (viewport offset + scrollTop):
        // endTargetTop works in scroller coordinates, and mixing the two frames made
        // the landing miss by exactly one scrollTop — measured in the browser, the
        // section it was aiming at ended up thousands of pixels BELOW the viewport.
        var base = sp.scrollTop - spTop;
        var limit = null; // scroller-relative y where this entry's content stops
        if (el.tagName && /^H[1-6]$/.test(String(el.tagName))) {
          var lvl = Number(String(el.tagName).slice(1));
          var hs = sp.querySelectorAll("h1, h2, h3, h4, h5, h6");
          for (var i = 0; i < hs.length; i++) {
            var h = hs[i];
            if (h === el) continue;
            if (h.getBoundingClientRect().top <= elTop + 1) continue;
            if (Number(String(h.tagName).slice(1)) > lvl) continue; // a child, not a boundary
            limit = h.getBoundingClientRect().top + base;
            break;
          }
        }
        var turnEl = el.closest ? el.closest("[data-chat-turn]") : null;
        if (turnEl) {
          var tb = turnEl.getBoundingClientRect().bottom + base;
          if (limit === null || tb < limit) limit = tb;
        }
        return limit;
      };
      var endTargetTop = function (limit, sp) {
        var floor = Math.max(0, sp.scrollHeight - sp.clientHeight);
        if (limit === null) return floor; // nothing bounds it: the very end of the content
        var seat = parseInt(getComputedStyle(sp).getPropertyValue("--dsh-composer-height"), 10) || 0;
        var t = limit - (sp.clientHeight - seat) + 28;
        return Math.max(0, Math.min(t, floor));
      };
      var endJumpRow = function (key, idx) {
        var row = findRow(key);
        if (!row) return;
        var el = row;
        if (idx !== undefined && idx !== null) {
          var hs = row.querySelectorAll("h1, h2, h3, h4, h5, h6");
          if (hs.length > 0) el = hs[Math.min(idx, hs.length - 1)] || row;
        }
        var sp = el.closest ? el.closest("[data-conversation-scroll]") : null;
        if (!sp) return;
        glideToTarget(sp, function (s) { return endTargetTop(endLimitOf(el, s), s); });
      };
      // A group header's control lands on the end of the WHOLE turn: the bottom of
      // the turn's LAST message (the failure row for a failed turn), so the reader
      // ends up at the bottom of the model's reply.
      // It deliberately does NOT go through the [data-chat-turn] element. Measured in
      // the browser: that attribute matches a small marker (0-80px tall in the
      // sessions probed) whose bottom sits thousands of pixels away from the reply it
      // names — the last group's marker ran 637->717 in the viewport while that
      // group's message ran 3539->3984, so anchoring to it dropped the reader nowhere
      // near the group they clicked.
      var endJumpTurn = function (lastKey) {
        var row = lastKey ? findRow(lastKey) : null;
        if (!row) return;
        var sp = row.closest ? row.closest("[data-conversation-scroll]") : null;
        if (!sp) return;
        glideToTarget(sp, function (s) {
          // scroller-relative (+ scrollTop): re-evaluated on every tick
          var base = row.getBoundingClientRect().bottom + s.scrollTop - s.getBoundingClientRect().top;
          return endTargetTop(base, s);
        });
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
      var turnLanded = function (turn) {
        var list = groupsLiveRef.current || [];
        for (var i = 0; i < list.length; i++) {
          if (list[i].turn === turn && !list[i].ghost) return true;
        }
        return false;
      };
      var openTurn = function (turn, seq, quiet) {
        var sessions = hostSessions();
        if (!sessions) {
          console.warn("[dsh-quick-toc] ctx.get(\"sessions\") returned nothing: this host has no session service, cannot open turn " + turn);
          if (!quiet) showBanner(T("turn.loadFailed"));
          return false;
        }
        var binding = typeof sessions.binding === "function" ? sessions.binding(sessionId) : null;
        var face = binding && binding.session;
        if (!face || typeof face.loadThrough !== "function") {
          console.warn("[dsh-quick-toc] session " + String(sessionId) + " exposes no loadThrough jump loader, cannot open turn " + turn);
          if (!quiet) showBanner(T("turn.loadFailed"));
          return false;
        }
        // The loader silently no-ops when the host considers the window complete
        // (`hasMore === false`) — that is DEFINITIVE evidence this turn can never be
        // paged in, so it gets an honest banner. Every other state (session still
        // opening, a page pull in flight) is transient: the ladder below keeps asking.
        // A host that exposes no page state at all is asked as before.
        //
        // Measured in the browser: right after a session is (re)opened the face reports
        // `openState: "loading"` WITH `hasMore: false` — the history window has simply
        // not been read yet. Taking that as definitive dropped a perfectly good
        // remembered position (the restore forgot it and left the reader wherever the
        // app happened to be), so `hasMore === false` only counts once the face says the
        // session is actually open.
        var state = { open: face.openState, more: face.hasMore, base: face.baseSeq };
        var sessionSettled = face.openState === undefined || face.openState === "open";
        var cannotPage = face.hasMore === false && sessionSettled;
        if (cannotPage) {
          console.warn("[dsh-quick-toc] jump loader cannot page to turn " + turn + " (seq " + seq + "): openState="
            + String(state.open) + ", hasMore=" + String(state.more) + ", baseSeq=" + String(state.base)
            + " — the outline names more turns than this host will page in");
        }
        setHoverCard(null);
        // picking a row in the sheet hands the reader back to the conversation
        if (sheetOpen) closeSheet();
        // immediately while a plain page pull owns the busy flag (`loadingOlder`),
        // and the caller is expected to retry once it settles. That is exactly
        // "sometimes one click does nothing and a couple of clicks work" — the
        // clicks that land during an in-flight page are silently discarded. So ask
        // again on a short ladder: while the loader still says it can page, until
        // the turn actually lands or a deadline passes.
        var landed = false;
        var landingIssued = false;
        var finish = function () {
          if (landed) return;
          landed = true;
          landOnTurn(turn);
        };
        var giveUp = function () {
          // a restore is a convenience, not a promise: it never banners, it just
          // forgets the position so it cannot nag on every open
          if (quiet) { clearReadPos(sessionId); return; }
          // last resort, once per session: rebuild the history source and retry
          if (jumpRetryRef.current) { showBanner(T("turn.loadFailed")); return; }
          jumpRetryRef.current = true;
          console.warn("[dsh-quick-toc] turn " + turn + " did not page in; resyncing the history window and retrying once");
          var rebuilt;
          try {
            rebuilt = typeof face.resync === "function" ? face.resync() : null;
          } catch (e) {
            rebuilt = Promise.reject(e);
          }
          Promise.resolve(rebuilt).then(function () {
            return face.loadThrough(seq);
          }).then(function () {
            landOnTurn(turn);
            setTimeout(function () {
              if (!turnLanded(turn)) showBanner(T("turn.loadFailed"));
            }, 2500);
          }, function (err) {
            console.warn("[dsh-quick-toc] resync retry failed:", err);
            showBanner(T("turn.loadFailed"));
          });
        };
        if (cannotPage) {
          if (quiet) clearReadPos(sessionId);
          else showBanner(T("turn.noMoreHistory"));
          return true;
        }
        var deadline = Date.now() + 8000;
        var ask = function () {
          if (turnLanded(turn)) { finish(); return; }
          // same guard as above: a "not open yet" face is asked again rather than
          // written off (its hasMore is still the placeholder value)
          var settledNow = face.openState === undefined || face.openState === "open";
          if (face.hasMore === false && settledNow) {
            if (quiet) clearReadPos(sessionId);
            else showBanner(T("turn.noMoreHistory"));
            return;
          }
          if (Date.now() > deadline) { giveUp(); return; }
          try {
            Promise.resolve(face.loadThrough(seq)).then(function () {
              if (turnLanded(turn)) { finish(); return; }
              // the page is still arriving: let the landing helper start retrying for
              // the row (it gives up on its own), and keep the ask-ladder running
              if (!landingIssued) { landingIssued = true; landOnTurn(turn); }
            }, function (err) {
              console.warn("[dsh-quick-toc] loadThrough failed:", err);
            });
          } catch (e) {
            console.warn("[dsh-quick-toc] loadThrough threw:", e);
          }
          setTimeout(ask, 400);
        };
        // first ask immediately (a click must reach the loader in the same task it
        // happened); the retries ride the ladder
        ask();
        return true;
      };

      // reveal one group inside the outline list (shared by Enter-stepping and by
      // jumps into a turn that had to be loaded first)
      // Put a group's row at the TOP of the list, instantly. The previous way —
      // `scrollIntoView({ behavior: "smooth", block: "nearest" })` — only scrolled the minimum
      // distance (so the row could end up anywhere in the viewport, which reads as "the jump is
      // not accurate") and it ANIMATED there, which is the scroll the reader saw when opening
      // the panel or the curtain.
      //
      // Aligning to the top is also self-limiting, which is why it needs no special case: on the
      // newest turn the list simply cannot scroll further, so `scrollTop` clamps at the end and
      // that row lands exactly at the bottom.
      var alignGroupToTop = function (gi) {
        var el = listRef.current;
        if (!el) return false;
        var node = el.querySelector('[data-group-idx="' + gi + '"]');
        if (!node) return false;
        // the rects are visual: divide by the live factor before writing a scroll offset
        var delta = (node.getBoundingClientRect().top - el.getBoundingClientRect().top) / liveZoom();
        if (Math.abs(delta) > 0.5) el.scrollTop = el.scrollTop + delta;
        return true;
      };
      var revealGroupInOutline = function (gi) {
        setVisibleCount(function (prev) {
          return Math.max(prev, Math.min(groups.length, groups.length - gi));
        });
        // the row may only exist once the commit has happened, so retry across the next frames
        alignGroupToTop(gi);
        requestAnimationFrame(function () {
          alignGroupToTop(gi);
          requestAnimationFrame(function () { alignGroupToTop(gi); });
        });
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
      var iconBtn = function (onClick, tip, glyph, fontSize, offset, size) {
        var ox = offset ? (offset.x || 0) : 0;
        var oy = offset ? (offset.y || 0) : 0;
        var box = size || 24;
        return react_jsx_runtime.jsx("button", {
          onClick: onClick,
          style: {
            width: box,
            height: box,
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
        hoverEnd: hoverEnd,
        // the curtain is wide: rows switch to a one-line, multi-part layout that
        // puts the section's opening text out to the right instead of under the
        // title (see renderItem / renderResultRow)
        wide: sheetOpen
      };

      // ---- keyboard cursor plumbing -------------------------------------------
      // Rows are collected from the DOM in document order, so the cursor sequence is
      // exactly what the reader sees — one rule for the outline, the questions-only
      // list, the in-session results and the cross-session results alike.
      var navRows = function () {
        var el = listRef.current;
        if (!el || typeof el.querySelectorAll !== "function") return [];
        var found = el.querySelectorAll("[data-nav-row]");
        return Array.prototype.slice.call(found);
      };
      var markNav = function (el, on) {
        if (!el) return;
        if (el.classList && typeof el.classList.toggle === "function") {
          el.classList.toggle("dqt-nav", on);
          return;
        }
        var cls = String(el.className || "").split(/\s+/).filter(function (c) { return c && c !== "dqt-nav"; });
        if (on) cls.push("dqt-nav");
        el.className = cls.join(" ");
      };
      var rowText = function (el) {
        if (!el) return "";
        var text = String(el.textContent || "").replace(/\s+/g, " ").trim();
        return text.length > 60 ? text.slice(0, 60) + "…" : text;
      };
      var scrollRowIntoView = function (el, row) {
        if (!el || !row || typeof row.getBoundingClientRect !== "function") return;
        var box = el.getBoundingClientRect();
        var rr = row.getBoundingClientRect();
        if (!box || !rr || typeof box.top !== "number") return;
        // getBoundingClientRect reports VISUAL pixels while scrollTop is layout: the
        // panel's zoom factor divides the delta (same reasoning as zLen).
        var factor = zoom > 0 ? zoom : 1;
        if (rr.top < box.top + 2) el.scrollTop -= (box.top + 2 - rr.top) / factor;
        else if (rr.bottom > box.bottom - 2) el.scrollTop += (rr.bottom - box.bottom + 2) / factor;
      };
      // which row is the reader looking at? (used when the cursor engages, so ↓
      // continues from the current position instead of restarting at the top)
      var nearestRowIndex = function (rows) {
        var el = listRef.current;
        if (!el || rows.length === 0) return 0;
        var box = el.getBoundingClientRect();
        var mid = box && typeof box.top === "number" ? (box.top + box.bottom) / 2 : 0;
        var best = 0;
        var bestGap = Infinity;
        for (var i = 0; i < rows.length; i++) {
          var rr = rows[i].getBoundingClientRect ? rows[i].getBoundingClientRect() : null;
          if (!rr || typeof rr.top !== "number") continue;
          var gap = Math.abs((rr.top + rr.bottom) / 2 - mid);
          if (gap < bestGap) { bestGap = gap; best = i; }
        }
        return best;
      };
      var moveNav = function (delta) {
        var rows = navRows();
        if (rows.length === 0) return;
        var next;
        if (navIdx < 0) next = nearestRowIndex(rows);
        else next = navIdx + delta;
        if (next < 0) next = 0;
        if (next > rows.length - 1) next = rows.length - 1;
        setNavIdx(next);
        setLiveText(rowText(rows[next]));
      };
      var jumpNav = function () {
        var rows = navRows();
        if (rows.length === 0) return;
        var idx = navIdx < 0 ? nearestRowIndex(rows) : navIdx;
        if (idx < 0 || idx >= rows.length) return;
        var row = rows[idx];
        setNavIdx(idx);
        setLiveText(rowText(row));
        if (row && typeof row.click === "function") row.click();
      };
      // Consume a key without assuming the event object is a full DOM event (the host
      // and test harnesses can synthesize partial ones).
      var swallow = function (e) {
        if (!e) return;
        if (typeof e.preventDefault === "function") e.preventDefault();
        if (typeof e.stopPropagation === "function") e.stopPropagation();
      };
      var onPanelKeyDown = function (e) {
        var target = e.target;
        var tag = target && target.tagName ? String(target.tagName).toUpperCase() : "";
        // the search box owns its own keys (it stops propagation for the ones it uses)
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (target && target.isContentEditable)) return;
        if (e.altKey || e.ctrlKey || e.metaKey) return;
        // a key on the panel is a reader gesture: the auto-loader may act on it
        autoGestureRef.current = Date.now();
        var key = e.key;
        if (key === "ArrowDown" || key === "ArrowUp") {
          swallow(e);
          moveNav(key === "ArrowDown" ? 1 : -1);
          return;
        }
        if (key === "Home" || key === "End") {
          var rows = navRows();
          if (rows.length === 0) return;
          swallow(e);
          var idx = key === "Home" ? 0 : rows.length - 1;
          setNavIdx(idx);
          setLiveText(rowText(rows[idx]));
          return;
        }
        if (key === "Enter") {
          swallow(e);
          jumpNav();
          return;
        }
        if (key === "Escape") {
          if (sheetOpen) { swallow(e); closeSheet(); return; }
          if (!open) return;
          swallow(e);
          setNavIdx(-1);
          // Esc is a way of LEAVING the docked panel, so it records the same thing the ✕ does.
          // Without this the memory kept whatever the last ✕ close had stored, and reopening
          // would offer to go back to a row the reader had left two closes ago.
          noteClosed("dock");
          setOpen(false);
        }
      };
      // keep the painted cursor on the row the index points at, and keep that row in
      // view. Runs whenever the row set itself changes (page-in, new results, a mode
      // switch) so the cursor never survives onto a different row. (The effect itself
      // lives above the early return, with the other hooks.)

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
      // The tuck is a departure even though `open` is still true, so it has to move
      // at the CLOSING speed: with the opening 0.6s curve the panel was still
      // travelling when the curtain took over, which looked like it flashed away.
      var panelAway = !open || panelAside === "tuck";
      var slide = panelAway ? "0.28s " + EASE : "0.6s " + EASE;
      // The slide is a TRANSFORM, not `left`. Animating `left` re-lays out the whole panel —
      // header, toolbar and every rendered outline row — on every frame of the animation, and
      // once a long session has loaded thousands of rows that layout can no longer keep up
      // with the (compositable) `clip-path` wipe next to it: the wipe ran on while the slide
      // stalled, which is the "a line sweeps across and the panel never really slides" the
      // reader reported. A transform is handed to the compositor, so the animation no longer
      // depends on how big the list is.
      var panelTransition = (zoomJustChanged ? "" : "transform " + slide + ", ")
        + "clip-path " + slide + ", opacity " + (panelAway ? "0.14s ease 0.26s" : "0.45s ease");

      // clip the panel at the dock edge while collapsed, so sliding away looks
      // like being covered by the sidebar (the sidebar stays untouched):
      //  left dock  -> clipped from the left up to the sidebar line
      //  right dock -> clipped from the right at the screen/sidebar line
      // LEFT dock keeps its original clip (collapse left). RIGHT dock clips the
      // LEFT side so the panel closes toward its right (dock) edge in place.
      //
      // The inset is the distance the box actually TRAVELS, not the panel's width. The
      // visible edge of the panel is the clip edge, and that edge is `box.left + inset`
      // (left dock) / `box.right - inset` (right dock) while the box slides; matching the
      // inset to the travel makes the two move at the same rate, so the edge stays pinned
      // on the panel's OWN open edge line the whole way out. With a fixed `panelW + 8`
      // against a `panelW + 16` travel the edge drifted 8px past that line, which the
      // reader saw as the panel tucking in slightly left of where it comes back out.
      var travelPx = Math.abs(openOffset - parkedOffset);
      var panelClip = "inset(0 0 0 0px)";
      if (!geoOpen) {
        if (dockRight) {
          // mirror of LEFT: clip the RIGHT side (panel flies right, shrinking from its right)
          panelClip = "inset(0 " + zLen(travelPx) + " 0 0)";
        } else {
          panelClip = "inset(0 0 0 " + zLen(travelPx) + ")";
        }
      }
      // faded out entirely while another center-column view is active
      // Idle transparency used to be 0.45, which stacked with the outline's own
      // inactive-group dimming (0.6) into a wall of grey that left the panel barely
      // readable whenever the pointer was elsewhere. Readability now comes from
      // CONTRAST on the group being read (tinted row + accent bar, see
      // renderGroups) instead of from fading everything else away.
      var panelOpacity = open && chatViewActive ? (hovered ? 1 : 0.72) : 0;

      // ---- toolbar buttons -----------------------------------------------------
      // ONE instance of each, placed either in the docked header row or in the
      // curtain's own chrome. On the curtain they are larger (that surface has the
      // room), and the dock / curtain / collapse controls are not built at all —
      // they mean nothing on a panel that already spans the conversation.
      var tbSize = sheetOpen ? 32 : 24;
      var tbIcon = sheetOpen ? 18 : 14;
      var tbIconLg = sheetOpen ? 20 : 15;
      var toolBtn = function (tool, className, onClick, title, active, disabled, svg, extra) {
        var props = {
          className: className,
          onClick: onClick,
          title: title,
          "data-tool": tool,
          style: {
            width: tbSize,
            height: tbSize,
            padding: 0,
            border: "none",
            borderRadius: "50%",
            cornerShape: "round",
            flex: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: disabled ? "default" : "pointer",
            opacity: disabled ? 0.45 : 1,
            // open (or still animating shut) uses the SAME tint as every other
            // "on" control, so the toolbar reads consistently in both layouts
            background: active ? C.chip : "var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,0.16))",
            color: active ? C.accent : C.muted,
            transition: "background 0.15s ease, color 0.15s ease, opacity 0.2s ease"
          },
          onMouseEnter: function (e) {
            if (disabled) return;
            e.currentTarget.style.background = "var(--dsw-alias-interactive-bg-active, rgba(79,140,255,0.24))";
            e.currentTarget.style.color = "var(--dsw-alias-brand-primary, #4f8cff)";
          },
          onMouseLeave: function (e) {
            e.currentTarget.style.background = active ? C.chip : "var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,0.16))";
            e.currentTarget.style.color = active ? C.accent : C.muted;
          },
          children: svg
        };
        // always present (false, not undefined): the toolbar reads it to decide the
        // resting cursor/opacity, and the tests assert the false case explicitly
        props.disabled = !!disabled;
        if (extra) {
          for (var k in extra) {
            if (Object.prototype.hasOwnProperty.call(extra, k)) props[k] = extra[k];
          }
        }
        return react_jsx_runtime.jsx("button", props);
      };
      // heading-level filter: a round icon button that pops down the H1–H6 picker.
      // Icon: three lines of decreasing width = outline levels.
      var levelsBtnEl = toolBtn("levels", "dqt-levels-btn",
        function () { if (questionsOnly) return; levelsOpen ? closeLevels() : setLevelsOpen(true); },
        questionsOnly ? T("levels.offInQuestions") : T("levels.tip"),
        (levelsOpen || levelsClosing), questionsOnly,
        react_jsx_runtime.jsx("svg", {
          width: tbIcon,
          height: tbIcon,
          viewBox: "0 0 14 14",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 2.2,
          strokeLinecap: "round",
          style: { display: "block" },
          children: [
            react_jsx_runtime.jsx("line", { x1: 1.5, y1: 3, x2: 12.5, y2: 3 }),
            react_jsx_runtime.jsx("line", { x1: 1.5, y1: 7, x2: 9, y2: 7 }),
            react_jsx_runtime.jsx("line", { x1: 1.5, y1: 11, x2: 5.5, y2: 11 })
          ]
        })
      );
      // questions-only toggle: icon = a speech bubble (the prompt), which is exactly
      // what that view keeps
      var questionsBtnEl = toolBtn("questions", "dqt-questions-btn", toggleQuestions,
        questionsOnly ? T("view.questions.tipOn") : T("view.questions.tipOff"),
        questionsOnly, false,
        react_jsx_runtime.jsx("svg", {
          width: tbIcon,
          height: tbIcon,
          viewBox: "0 0 14 14",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 2.2,
          strokeLinecap: "round",
          strokeLinejoin: "round",
          style: { display: "block" },
          children: [
            // A slightly LARGER bubble (11.4 x 7.7), and the whole glyph sits a touch BELOW the
            // box centre on purpose: the bubble body is the visual mass while the tail hangs
            // off the bottom-left, so a geometrically centred bubble reads as top-heavy. The
            // stroke bbox is 1.4..13.8 (centre 7.6, i.e. 0.6 low) and the horizontal centre is
            // still exactly 7.
            react_jsx_runtime.jsx("rect", { x: 1.3, y: 2.5, width: 11.4, height: 7.7, rx: 1.7 }),
            react_jsx_runtime.jsx("path", { d: "M4.5 10.2v2.5l2.9-2.5" })
          ]
        }),
        { "data-questions": questionsOnly ? "on" : "off" }
      );
      // magnifier (SVG, matches the other buttons' style)
      var searchBtnEl = toolBtn("search", "dqt-search-btn",
        function () { searchOpen ? closeSearch() : openSearch(); },
        T("search.open"), searchOpen, false,
        react_jsx_runtime.jsx("svg", {
          width: tbIconLg,
          height: tbIconLg,
          viewBox: "0 0 24 24",
          // overflow visible: the stroke may extend past the
          // viewBox without being clipped at the svg boundary
          style: { display: "block", overflow: "visible" },
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 3.6,
          strokeLinecap: "round",
          children: [
            // centred by geometry (bbox 3.5..20.5, centre 12,12) rather than by a nudge:
            // a fractional translate leaves the glyph a half pixel off in a round button
            react_jsx_runtime.jsx("circle", { cx: 10.5, cy: 10.5, r: 7 }),
            react_jsx_runtime.jsx("line", { x1: 20.5, y1: 20.5, x2: 15.5, y2: 15.5 })
          ]
        })
      );
      // the curtain's way out: the SAME thick SVG cross as the docked header's
      // collapse button, scaled with the rest of the curtain's buttons
      var sheetCloseBtnEl = toolBtn("close", "dqt-sheet-close-btn", closeSheet, T("sheet.close"), false, false,
        react_jsx_runtime.jsx("svg", {
          width: tbIconLg,
          height: tbIconLg,
          viewBox: "0 0 24 24",
          style: { display: "block", overflow: "visible" },
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 3.4,
          strokeLinecap: "round",
          children: [
            // cross lines span 5..19, intersection (12,12) centered — no nudge: a translate
            // here is what left the reader's ✕ visibly right of the round button's centre
            react_jsx_runtime.jsx("line", { x1: 5, y1: 5, x2: 19, y2: 19 }),
            react_jsx_runtime.jsx("line", { x1: 19, y1: 5, x2: 5, y2: 19 })
          ]
        })
      );
      // heading-level picker: pops down from the round toolbar button. It is anchored
      // to the toolbar itself on the curtain (no overflow-clipped row there) and to
      // the panel box in the docked layout (the header row scrolls sideways, so a
      // child of it would be clipped). Open/close animate from the button's center;
      // the animation lives in the injected stylesheet (classes, not inline
      // animation) so React re-renders never restart or cancel it.
      var buildLevelsPop = function (inSheet) {
        // on the curtain the six levels are ONE spread-out row (there is room);
        // in the narrow docked panel they have to wrap, and they are capped by the
        // panel's own width rather than by the shrink-to-fit toolbar wrapper
        var popW = inSheet ? "min(336px, 74vw)" : undefined;
        return react_jsx_runtime.jsx("div", {
          className: "dqt-levels-pop" + (levelsClosing ? " dqt-levels-pop-closing" : ""),
          style: {
            position: "absolute",
            top: inSheet ? "calc(100% + 8px)" : 40,
            left: inSheet ? 0 : 10,
            zIndex: 30,
            display: "flex",
            alignItems: "center",
            flexWrap: inSheet ? "nowrap" : "wrap",
            gap: 4,
            padding: 8,
            background: C.panelBg,
            border: "1px solid " + C.panelBorder,
            borderRadius: 10,
            cornerShape: "round",
            boxShadow: "0 6px 20px rgba(0, 0, 0, 0.28), 0 2px 6px rgba(0, 0, 0, 0.18)",
            width: popW,
            maxWidth: inSheet ? popW : "calc(100% - 20px)",
            // the button's center sits 12px (dock) / 16px (curtain) inside the popup
            transformOrigin: (inSheet ? tbSize / 2 : 12) + "px top"
          },
          children: [1, 2, 3, 4, 5, 6].map(function (lv) {
            var active = !!levelSet[lv];
            return react_jsx_runtime.jsx("button", {
              onClick: function () { toggleLevel(lv); },
              title: active ? T("levels.hide") + lv : T("levels.show") + lv,
              style: {
                height: inSheet ? 32 : 22,
                flex: inSheet ? "1 1 0" : "0 0 auto",
                minWidth: 0,
                padding: inSheet ? 0 : "0 7px",
                border: "none",
                borderRadius: 6,
                cornerShape: "round",
                cursor: "pointer",
                fontSize: inSheet ? 14.5 : 11,
                lineHeight: (inSheet ? 32 : 22) + "px",
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
        });
      };
      var levelsPopDockEl = (!sheetOpen && (levelsOpen || levelsClosing)) ? buildLevelsPop(false) : null;
      var levelsPopSheetEl = (sheetOpen && (levelsOpen || levelsClosing)) ? buildLevelsPop(true) : null;
      // dock toggle: the triangle tips toward the side it will move TO
      var dockBtnEl = iconBtn(toggleDock, dockRight ? T("handle.dockLeft") : T("handle.dockRight"), dockRight ? "◀" : "▶", 12, dockRight ? { x: -1, y: -1 } : { x: 1, y: -1 });
      // the curtain button: a surface with the arrow dropping out of its TOP edge
      var sheetBtnEl = react_jsx_runtime.jsx("button", {
        className: "dqt-sheet-btn",
        onClick: openSheet,
        title: T("sheet.open"),
        style: {
          width: 24,
          height: 24,
          padding: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "50%",
          cornerShape: "round",
          border: "none",
          flex: "none",
          cursor: "pointer",
          background: "var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,0.16))",
          color: C.muted,
          transition: "background 0.15s ease, color 0.15s ease, opacity 0.2s ease"
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
          strokeLinejoin: "round",
          style: { display: "block", overflow: "visible" },
          children: [
            // A landscape surface 12.0 x 9.0 (centred in the 14 box: 1.0..13.0 / 2.5..11.5) —
            // neither the portrait slab nor the flat strip the earlier attempts were. The
            // rectangle itself carries the SAME border weight as the questions bubble (2.2,
            // via its own strokeWidth) while the arrow keeps the lighter inherited 1.8, so the
            // frame reads as the frame and the arrow stays a mark inside it. `overflow:
            // visible` because the 2.2 border on a 12-wide rect reaches x = -0.1.
            react_jsx_runtime.jsx("rect", { x: 1.0, y: 2.5, width: 12.0, height: 9.0, rx: 1.6, strokeWidth: 2.2 }),
            react_jsx_runtime.jsx("path", { d: "M7 2.5V9.1M5.2 7.3L7 9.1l1.8-1.8" })
          ]
        })
      });
      // collapse (docked panel only): thick SVG cross, nudged slightly down
      var headerCloseBtnEl = react_jsx_runtime.jsx("button", {
        onClick: function () { noteClosed("dock"); setOpen(false); },
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
          style: { display: "block", overflow: "visible" },
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 3.4,
          strokeLinecap: "round",
          children: [
            // cross lines span 5..19, intersection (12,12) centered (no nudge here either)
            react_jsx_runtime.jsx("line", { x1: 5, y1: 5, x2: 19, y2: 19 }),
            react_jsx_runtime.jsx("line", { x1: 19, y1: 5, x2: 5, y2: 19 })
          ]
        })
      });

      // ---- docked header: grip bar on top + the header row (whole block draggable)
      var dockHeaderEl = react_jsx_runtime.jsx("div", {
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
              // the controls keep their size and stay on ONE line; when the row
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
                children: [levelsBtnEl, questionsBtnEl, dockBtnEl]
              }),
              // spacer: nothing here, it just pins the two pairs to the two ends —
              // and it is the first thing to give way when the panel narrows
              react_jsx_runtime.jsx("div", { style: { flex: "1 1 auto", minWidth: 0 } }),
              // RIGHT pair: search + curtain + collapse
              react_jsx_runtime.jsx("div", {
                style: { display: "flex", alignItems: "center", gap: 6, flex: "none" },
                children: [searchBtnEl, sheetBtnEl, headerCloseBtnEl]
              })
            ]
          })
        ]
      });

      // ---- curtain chrome: the controls that still apply here (the level filter,
      // questions-only, search) plus the way out. There is no title — the surface is
      // self-evident — and no hint text: ✕ and Esc are the obvious exits. The dock /
      // curtain / collapse buttons are absent on purpose: there is no docked panel to
      // move and no second curtain to open.
      var sheetChromeEl = react_jsx_runtime.jsx("div", {
        className: "dqt-sheet-chrome",
        title: T("sheet.noDrag"),
        style: {
          flex: "none",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "7px 12px",
          borderBottom: "1px solid " + C.panelBorder
        },
        children: [
          react_jsx_runtime.jsx("div", {
            style: { position: "relative", display: "flex", alignItems: "center", gap: 8, flex: "none" },
            children: [levelsBtnEl, questionsBtnEl, levelsPopSheetEl]
          }),
          react_jsx_runtime.jsx("div", { style: { flex: "1 1 auto", minWidth: 0 } }),
          searchBtnEl,
          sheetCloseBtnEl
        ]
      });

      // ---- search row: the input plus the scope pill, the fuzzy switch and the
      // match counter. In the docked layout it is a row under the header; on the
      // curtain it is the head of the search column on the right.
      var searchRowEl = (searchOpen || searchAnim === "out") ? react_jsx_runtime.jsx("div", {
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
              gap: sheetOpen ? 6 : 4,
              padding: sheetOpen ? "4px 10px 8px" : "2px 8px 4px",
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
                  padding: sheetOpen ? "8px 14px" : "6px 12px"
                },
                children: [
                  react_jsx_runtime.jsx("input", {
                    ref: searchRef,
                    value: query,
                    onChange: function (e) { onQueryChange(e.target.value); },
                    onKeyDown: function (e) {
                      // ↑/↓ step the in-session matches, exactly like Enter does
                      // (arrows only mean something while a query is typed)
                      if (e.key === "ArrowDown") { goToMatch(matchIdx + 1); swallow(e); return; }
                      if (e.key === "ArrowUp") { goToMatch(matchIdx - 1); swallow(e); return; }
                      if (e.key === "Enter") { goToMatch(matchIdx + 1); swallow(e); return; }
                      if (e.key === "Escape") { closeSearch(); swallow(e); }
                    },
                    style: {
                      flex: 1,
                      minWidth: 0,
                      width: "100%",
                      background: "transparent",
                      border: "none",
                      outline: "none",
                      fontSize: sheetOpen ? 16 : 13,
                      color: C.text,
                      padding: 0
                    }
                  }),
                  (!query) ? react_jsx_runtime.jsx("span", {
                    style: {
                      position: "absolute",
                      left: sheetOpen ? 14 : 12,
                      pointerEvents: "none",
                      fontSize: sheetOpen ? 16 : 13,
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
                            children: scopeLabel(searchScope)
                          }),
                          (prevScope && prevScope !== searchScope) ? react_jsx_runtime.jsx("span", {
                            key: "old-" + prevScope,
                            style: { position: "absolute", left: 0, top: 0, opacity: 0, animation: "dqt-fade-out 0.25s linear forwards" },
                            children: scopeLabel(prevScope)
                          }) : null
                        ]
                      }),
                      T("search.tail")
                    ]
                  }) : null
                ]
              }),
              (searching || (searchScope === "cross" && cross.phase === "loading")) ? react_jsx_runtime.jsx("span", {
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
                children: searchScope === "cross"
                  ? (cross.phase === "done" && cross.rows.length > 0 ? String(cross.rows.length) + (cross.more ? "+" : "") : "")
                  : (matches.length > 0 ? ((matchIdx % matches.length) + 1) + "/" + matches.length : "")
              }),
              // scope toggle: 标题 -> 全文 -> 会话 (ONE round pill cycling the three
              // scopes; background fades, label text cross-fades old->new, so a third
              // scope costs no extra button)
              react_jsx_runtime.jsx("button", {
                onClick: toggleScope,
                "data-scope": searchScope,
                title: searchScope === "title" ? T("search.scope.tipTitle")
                  : (searchScope === "full" ? T("search.scope.tipFull") : T("search.scope.tipCross")),
                style: {
                  flex: "none",
                  width: sheetOpen ? 40 : 34,
                  height: sheetOpen ? 40 : 34,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "50%",
                  cornerShape: "round",
                  fontSize: sheetOpen ? 13 : 11,
                  color: searchScope !== "title" ? "var(--dsw-alias-brand-primary, #4f8cff)" : C.muted,
                  background: searchScope !== "title" ? C.chip : "var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,0.14))",
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
                      children: scopeLabel(searchScope)
                    }),
                    (prevScope && prevScope !== searchScope) ? react_jsx_runtime.jsx("span", {
                      key: "old-" + prevScope,
                      style: { position: "absolute", opacity: 0, animation: "dqt-fade-out 0.25s linear forwards", display: "block" },
                      children: scopeLabel(prevScope)
                    }) : null
                  ]
                })
              }),
              // fuzzy switch: an independent toggle beside the scope pill (its label
              // is the same either way, so only the colour carries the state). It means
              // nothing in cross-session scope — the HOST searches literal phrases —
              // so there it is disabled and its tip says exactly that.
              react_jsx_runtime.jsx("button", {
                onClick: toggleFuzzy,
                disabled: searchScope === "cross",
                title: searchScope === "cross" ? T("search.cross.note") : (fuzzy ? T("search.fuzzy.tipOn") : T("search.fuzzy.tipOff")),
                "data-fuzzy": fuzzy ? "on" : "off",
                style: {
                  flex: "none",
                  width: sheetOpen ? 40 : 34,
                  height: sheetOpen ? 40 : 34,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "50%",
                  cornerShape: "round",
                  fontSize: sheetOpen ? 13 : 11,
                  color: fuzzy ? "var(--dsw-alias-brand-primary, #4f8cff)" : C.muted,
                  background: fuzzy ? C.chip : "var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,0.14))",
                  border: "none",
                  cursor: searchScope === "cross" ? "default" : "pointer",
                  opacity: searchScope === "cross" ? 0.45 : 1,
                  whiteSpace: "nowrap",
                  transition: "background 0.25s ease, color 0.25s ease, opacity 0.25s ease"
                },
                children: T("search.fuzzy")
              })
            ]
          })
        })
      }) : null;

      // ---- list content: the outline, or the search results ---------------------
      // Built once and placed either inside the single docked list, or split across
      // the curtain's two columns (outline left, results right).
      var resultsEl = query.trim()
        ? (searchScope === "cross"
          ? react_jsx_runtime.jsx("div", {
            key: "cross",
            children: renderCrossResults(cross, query.trim(), C, crossTitle, openCrossHit)
          })
          : react_jsx_runtime.jsx("div", {
            key: "results",
            children: renderResults(resultRows, query.trim(), C, goToRow, activeResultRow, renderExtra)
          }))
        : null;
      // older history is one upward scroll away — say so until the reader actually
      // scrolls up (then the hint has done its job)
      var hintEl = hint ? react_jsx_runtime.jsx("div", {
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
      }) : null;
      var outlineEl = renderGroups(shownGroups, shownTrees, jump, C, Math.max(0, groups.length - visibleCount), activeGroup,
        questionsOnly ? Object.assign({}, renderExtra, { questionsOnly: true }) : renderExtra);
      // The curtain keeps the outline in the middle of the surface (its own column,
      // centred with room to spare at both sides) and pushes the search in from the
      // right; the docked panel keeps its original "results replace the list".
      var listChildren = sheetOpen
        ? [outlineEl, hintEl]
        : (resultsEl ? [resultsEl, hintEl] : outlineEl);
      var listEl = react_jsx_runtime.jsx("div", {
        ref: listRef,
        className: "dqt-list",
        // focusable so the arrow keys can drive the cursor; the panel root handles
        // the same keys, so either focus target works
        tabIndex: 0,
        role: "group",
        "aria-label": T("a11y.list"),
        style: {
          overflowY: "auto",
          // We are the only thing that holds the reader's place in this list (see the
          // paging block): the browser's own scroll anchoring would also adjust
          // `scrollTop` when a ghost turns into a real subtree, and two compensations for
          // one growth fight each other — the browser's is invisible to our measurement,
          // so our correction would then overshoot and the content would jump UP.
          overflowAnchor: "none",
          // NO top padding: a sticky child is confined to its containing
          // block, so a padded scroll container would hold the pinned group
          // header that many pixels below the toolbar (a visible gap). Spacing
          // between groups comes from the per-group divider instead.
          padding: sheetOpen ? "0 20px 8px" : "0 8px 6px",
          flex: "1 1 auto",
          minHeight: 0,
          // across the curtain the list does not touch the edges: it is a centred
          // column with room at both sides, which is also what makes it slide left
          // when the search column is pushed in
          width: sheetOpen ? "100%" : undefined,
          maxWidth: sheetOpen ? "90%" : undefined,
          margin: sheetOpen ? "0 auto" : undefined,
          // the 20px side padding sits INSIDE the 90% (content-box would make the
          // rendered column 90% + 40px, i.e. ~93% of the curtain)
          boxSizing: sheetOpen ? "border-box" : undefined,
          // the scrollbar follows the dock side in the narrow panel; across the
          // curtain it sits on the list's right edge
          direction: (sheetOpen || dockRight) ? "ltr" : "rtl"
        },
        onScroll: onListScroll,
        onWheel: onListWheel,
        // a press on a row (or on the list) is a reader gesture too: click-to-load an
        // unloaded row and drag-scrolling must both keep working
        onPointerDown: function () { autoGestureRef.current = Date.now(); },
        children: react_jsx_runtime.jsx("div", {
          // the two-phase cross-fade of the questions-only switch rides on this
          // wrapper (classes, never inline animation: React rewrites inline styles
          // every render and would restart or drop the animation)
          className: "dqt-list-body"
            + (listFade === "out" ? " dqt-mode-out" : (listFade === "in" ? " dqt-mode-in" : "")),
          style: { direction: "ltr" },
          children: listChildren
        })
      });
      // ---- curtain search column: pushed in from the right edge -----------------
      // The panel's own search box and its two buttons, then the hits below them.
      // Only the column's WIDTH animates (0 <-> 360) so the outline is pushed left
      // instead of jumped; an inner box keeps the full width so the content never
      // squashes while the column narrows, and the column is always mounted while the
      // curtain is up so both directions animate.
      var sheetColW = (searchOpen || searchAnim === "out") ? SHEET_SEARCH_W : 0;
      var sheetSearchColEl = sheetOpen ? react_jsx_runtime.jsx("div", {
        className: "dqt-sheet-search",
        "data-sheet-search": sheetColW > 0 ? "on" : undefined,
        style: {
          flex: "none",
          width: sheetColW,
          overflow: "hidden",
          minHeight: 0,
          borderLeft: sheetColW > 0 ? "1px solid " + C.panelBorder : "none",
          transition: "width 0.24s " + EASE + ", border-color 0.24s " + EASE
        },
        children: react_jsx_runtime.jsx("div", {
          style: { width: SHEET_SEARCH_W, height: "100%", display: "flex", flexDirection: "column", minHeight: 0 },
          children: [
            searchRowEl,
            // empty until something is typed — no placeholder note in the way
            react_jsx_runtime.jsx("div", {
              className: "dqt-sheet-results",
              style: { flex: "1 1 auto", minHeight: 0, overflowY: "auto", padding: "0 8px 8px", direction: "ltr" },
              children: resultsEl
            })
          ]
        })
      }) : null;
      // Whether the one-shot "back to where I left this surface" button is on: measured here,
      // after every piece of this pass's chrome geometry is known, and against the memory of
      // the surface that is actually on screen (see the restore block near the top).
      var showBack = awayFromRestore(listRef.current);
      // the outline and the search column share one row in BOTH layouts, so the list
      // is never moved between parents when the curtain opens or closes
      var bodyRowEl = react_jsx_runtime.jsx("div", {
        className: "dqt-body-row",
        style: { flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "row", alignItems: "stretch" },
        children: [listEl, sheetSearchColEl]
      });
      var panelEl = react_jsx_runtime.jsx("div", {
        ref: panelRootRef,
        // the panel takes focus on any click inside it (except into a text field), so
        // ↑/↓/Enter/Esc keep working right after a mouse interaction instead of only
        // when the user tabs into the widget first
        tabIndex: -1,
        onKeyDown: onPanelKeyDown,
        onMouseDown: function (e) {
          var t = e.target;
          var tag = t && t.tagName ? String(t.tagName).toUpperCase() : "";
          if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (t && t.isContentEditable)) return;
          var root = panelRootRef.current;
          if (root && typeof root.focus === "function") root.focus();
        },
        style: sheetOpen ? {
          // inside the sheet the panel IS the content: the wrapper owns position, size and
          // the drop-in animation, while the curtain's own scale (a separate preference)
          // zooms what is inside it — the box the wrapper gives it stays as it is
          position: "relative",
          width: "100%",
          flex: "1 1 auto",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          background: C.panelBg,
          border: "none",
          borderRadius: 0,
          zIndex: Z_PANEL,
          overflow: "hidden",
          color: C.text,
          opacity: 1,
          // the curtain's own scale (the docked panel's does not apply here)
          zoom: sheetZoom === 1 ? undefined : sheetZoom,
          pointerEvents: chatViewActive ? "auto" : "none"
        } : {
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
          zIndex: Z_PANEL,
          overflow: "hidden",
          color: C.text,
          opacity: panelOpacity,
          clipPath: panelClip,
          transform: panelTransform,
          // inner shadow only (no outer): theme-aware (white bevel in dark mode,
          // soft shade in light) — outer shadow would be clipped by the collapse
          // clip-path and the panel edges.
          boxShadow: innerShadow(),
          // A view switch swaps in a short, delay-free opacity fade; the dock and
          // collapse animations keep their own (slower) timings.
          transition: viewFading ? "opacity 0.3s ease" : panelTransition,
          // held back while the edge handle slips home (see edgeLeaving): the panel is
          // already at its open geometry here, only the animation waits
          transitionDelay: edgeLeaving ? EDGE_OUT_MS + "ms" : undefined,
          pointerEvents: chatViewActive ? "auto" : "none"
        },
        onMouseEnter: function () { setHovered(true); },
        onMouseLeave: function () { setHovered(false); },
        onClickCapture: function (e) {
          // jump handled in the capture phase (bubble-phase handlers are unreliable here)
          var t = e.target;
          // the "to the section's end" control sits INSIDE a jumpable row, and the
          // row's own jump would otherwise fire first (capture runs top-down), so
          // this branch is checked first and takes the event entirely
          var endBtn = (t && t.closest) ? t.closest("[data-dqt-end]") : null;
          if (endBtn && endBtn.dataset) {
            e.preventDefault();
            e.stopPropagation();
            if (endBtn.dataset.endTurn !== undefined) {
              endJumpTurn(endBtn.dataset.endKey);
            } else {
              endJumpRow(endBtn.dataset.endKey, endBtn.dataset.endIdx !== undefined ? Number(endBtn.dataset.endIdx) : 0);
            }
            // same hand-back rule as picking a row: the curtain closes
            if (sheetOpen) closeSheet();
            return;
          }
          var item = (t && t.closest) ? t.closest("[data-jump-key]") : null;
          if (item && item.dataset && item.dataset.jumpKey) {
            e.preventDefault();
            e.stopPropagation();
            var idx = item.dataset.jumpIdx !== undefined ? Number(item.dataset.jumpIdx) : 0;
            jump(item.dataset.jumpKey, idx);
            // a curtain hands you back to the conversation once you picked a row
            if (sheetOpen) closeSheet();
            return;
          }
          // ANY other row (group header, in-session result, cross-session hit)
          // carries its own click handler and keeps it — no stopPropagation here —
          // but picking a row still hands the reader back to the conversation
          if (sheetOpen && t && t.closest && t.closest("[data-nav-row]")) closeSheet();
        },
        children: [
          sheetOpen ? sheetChromeEl : dockHeaderEl,
          // the docked panel keeps its search band under the header; across the
          // curtain the same row lives at the top of the pushed-in search column
          sheetOpen ? null : searchRowEl,
          bodyRowEl,
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
              // clear of the resize handle in the very corner (16x16); across the
              // curtain it also clears the pushed-in search column
              right: (sheetOpen && sheetColW > 0 ? SHEET_SEARCH_W : 0) + 18,
              bottom: 12,
              // the curtain scales up every other control (24 -> 32); this floating button
              // was the one left behind at the docked size
              width: sheetOpen ? 34 : 26,
              height: sheetOpen ? 34 : 26,
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
              width: sheetOpen ? 18 : 14,
              height: sheetOpen ? 18 : 14,
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
          // "back to the place I scrolled to": the mirror of the button above, in the
          // list's upper-right corner, arrow pointing UP. It appears only while the list is
          // far from the position the reader last reached by wheel/key — the follow and the
          // curtain handoff both move the outline for the reader, and until now there was no
          // way back to where they had been browsing. Same surface vocabulary and same
          // curtain scaling as the bottom button.
          react_jsx_runtime.jsx("button", {
            onClick: backToBrowse,
            className: "dqt-top-btn",
            "data-at-mine": showBack ? "off" : "on",
            title: T("outline.backToMine"),
            tabIndex: showBack ? 0 : -1,
            "aria-hidden": showBack ? undefined : "true",
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
              right: (sheetOpen && sheetColW > 0 ? SHEET_SEARCH_W : 0) + 18,
              // below whatever chrome this surface has: `listTop` is measured in visual
              // pixels, so it is divided by the live factor to land where it was measured
              top: liveLen(listTop + 12),
              width: sheetOpen ? 34 : 26,
              height: sheetOpen ? 34 : 26,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
              background: "var(--dsw-specific-menu, rgba(44, 49, 60, 0.99))",
              border: "1px solid " + C.panelBorder,
              borderRadius: "50%",
              cornerShape: "round",
              color: C.text,
              cursor: "pointer",
              zIndex: 6,
              boxShadow: "0 3px 10px rgba(0, 0, 0, 0.30)",
              opacity: showBack ? 1 : 0,
              transform: showBack ? "translateY(0)" : "translateY(-6px)",
              pointerEvents: showBack ? "auto" : "none",
              transition: "opacity 0.22s ease, transform 0.22s ease, background 0.18s ease, color 0.18s ease, border-color 0.18s ease"
            },
            children: react_jsx_runtime.jsx("svg", {
              width: sheetOpen ? 18 : 14,
              height: sheetOpen ? 18 : 14,
              viewBox: "0 0 14 14",
              fill: "none",
              stroke: "currentColor",
              strokeWidth: 1.8,
              strokeLinecap: "round",
              strokeLinejoin: "round",
              style: { display: "block" },
              children: [
                react_jsx_runtime.jsx("polyline", { points: "3.5,9.5 7,6 10.5,9.5" }),
                react_jsx_runtime.jsx("line", { x1: 3.5, y1: 3, x2: 10.5, y2: 3 })
              ]
            })
          }),
          toastEl,
          // Polite live region: match stepping, result counts and cursor moves land
          // here. Visually hidden (`.dqt-sr`) — it exists for assistive tech only.
          react_jsx_runtime.jsx("span", {
            className: "dqt-sr",
            role: "status",
            "aria-live": "polite",
            "aria-atomic": "true",
            children: liveText
          }),
          // resize handles (right edge: width, bottom edge: height)
          // Their grab strips keep their SCREEN thickness under the scale factor:
          // they are part of the panel's box, not of its magnified content.
          sheetOpen ? null : react_jsx_runtime.jsx("div", {
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
          sheetOpen ? null : react_jsx_runtime.jsx("div", {
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
          // corner handle: resize width AND height at once (dock-only too)
          sheetOpen ? null : react_jsx_runtime.jsx("div", {
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
          levelsPopDockEl
        ]
      });

      // ---- edge collapse handle ------------------------------------------------
      // It emerges from BEHIND the conversation area's edge and slips back into it, the
      // same vocabulary the docked panel uses when it collapses: the box is parked
      // EDGE_W outside the line and clipped at it, so the 12px pill is progressively
      // revealed as it slides out. A plain fade-in-place made it read as appearing and
      // vanishing ON the divider line. `open` also drives it (fade + slide home) and
      // `edgeGone` keeps the element in the tree until that motion has played.
      var EDGE_W = 26;
      var edgeShown = !open && handleShown && chatViewActive;
      var edgeLineLeft = viewport ? viewport.left : 0;
      var edgeLineRight = viewport ? viewport.right + 52 : 60;   // clear of the milestone rail
      var edgeEl = (!open || !edgeGone) ? react_jsx_runtime.jsx("div", {
        style: {
          position: "fixed",
          width: EDGE_W,
          height: 92,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          zIndex: Z_HANDLE,
          // the ratio counts from the BOTTOM (0% = bottom, 100% = top) — at 0.5 this
          // is the same centred spot the handle always had. The 100% end still lands
          // exactly on the area's top edge; only the far end is floored, because the
          // handle is the ONLY way back to a collapsed panel and may never be pushed
          // off the bottom by a stored rect that is one layout generation behind.
          top: Math.max(0, Math.min(Math.max(0, window.innerHeight - 100),
            (viewport
              ? viewport.top + (viewport.height - 92) * handleFromTop
              : (window.innerHeight - 92) * handleFromTop))) + "px",
          // clipped at the line it hides behind: parked EDGE_W further out, the whole
          // box falls inside the clipped strip, so it is invisible without a fade
          clipPath: dockRight
            ? (edgeShown ? "inset(0 0 0 0)" : "inset(0 " + EDGE_W + "px 0 0)")
            : (edgeShown ? "inset(0 0 0 0)" : "inset(0 0 0 " + EDGE_W + "px)"),
          opacity: (chatViewActive && !open) ? 1 : 0,
          pointerEvents: edgeShown ? "auto" : "none",
          transition: "left 0.22s " + EASE + ", right 0.22s " + EASE + ", clip-path 0.22s " + EASE + ", opacity 0.18s ease",
          ...(dockRight
            ? { right: edgeShown ? edgeLineRight : edgeLineRight - EDGE_W }
            : { left: edgeShown ? edgeLineLeft : edgeLineLeft - EDGE_W })
        },
        title: T("handle.expand"),
        onClick: function () { openFromEdge(); },
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

      // where the curtain hangs from: just under the view tabs, with a floor so the
      // tabs can never eat the whole surface
      var convTopPx = viewport ? viewport.top : 0;
      var sheetTopPx = viewport
        ? Math.max(convTopPx, Math.min(sheetStrip ? sheetStrip.bottom : convTopPx, convTopPx + viewport.height - 160))
        : 0;
      // The handle sits INSIDE the tab strip, bottom edge on that same line, so no
      // conversation text can ever run under it. The strip measured 25px tall on this
      // build, so the hit box fits the band instead of the other way round (a fixed
      // 26px box poked 3px below the line, straight back into the text it was moved
      // away from); the 12px pill inside is bottom-aligned, so the visible control
      // rests ON the line. Falls back to hanging below the line if the strip was never
      // measured.
      var HANDLE_BOX_MAX = 26;
      var stripH = sheetStrip ? Math.max(0, sheetStrip.bottom - sheetStrip.top) : 0;
      var handleH = sheetStrip ? Math.max(16, Math.min(HANDLE_BOX_MAX, stripH)) : HANDLE_BOX_MAX;
      var handleTopPx = sheetStrip ? sheetStrip.bottom - handleH : sheetTopPx;

      // ---- curtain handle resting on the view tab strip's line -----------------
      // A droplet held to the line by surface tension rather than a floating pill: the
      // silhouette flares out into two concave fillets that meet the strip's lower line
      // tangentially, and the little triangle says "this drops down". Laid out so its
      // base sits exactly ON that line (the svg's own bottom edge), centred on the
      // conversation area — the band above the line is host chrome and never carries
      // transcript text, which is what made the old handle unreadable.
      // 140 wide and only 13.5 tall: the reader asked for a wider, flatter droplet
      // (it started at 92, then 120).
      var DROP_W = 140;
      var topHandleEl = (!sheetOpen || !sheetHandleGone) && chatViewActive ? react_jsx_runtime.jsx("div", {
        className: "dqt-sheet-handle",
        "data-sheet-handle": "on",
        style: {
          position: "fixed",
          width: DROP_W,
          height: handleH,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          boxSizing: "border-box",
          cursor: "pointer",
          zIndex: Z_HANDLE,
          top: handleTopPx,
          transformOrigin: "50% 100%",
          // The press is SLOW FIRST, THEN FAST, and it is the pop keyframe below read
          // backwards: `cubic-bezier(0.75, 0, 1, 0.45)` mirrors exactly onto the pop's
          // `cubic-bezier(0, 0.55, 0.25, 1)`, so the two directions are one motion and
          // its rewind rather than two lookalike eases. Over the 200ms: 86% of the clock
          // buys the first 40% of the squash, and the last 40% lands inside ~11ms. The
          // fade is held back past the press so the squash is never hidden behind it.
          opacity: sheetOpen ? 0 : 1,
          transition: "transform 0.2s cubic-bezier(0.75, 0, 1, 0.45), opacity 0.12s ease 0.2s",
          // centred on the conversation area, and clamped like the side handle: it is
          // the only entry point to the curtain, so it stays inside the window even
          // if the stored area rect is one layout generation behind
          left: Math.max(8, Math.min(Math.max(8, window.innerWidth - DROP_W - 8),
            viewport
              ? viewport.left + (Math.max(320, window.innerWidth - viewport.left - viewport.right) - DROP_W) / 2
              : (window.innerWidth - DROP_W) / 2)) + "px"
        },
        title: T("sheet.openHandle"),
        onClick: function () {
          var el = sheetHandleRef.current;
          // Pressed FLUSH into the line — `scaleY(0)`, not a small remainder. At 0.12 the
          // 17px droplet still had ~2px of dome sitting on the strip once the press had
          // landed, and because the element only leaves the tree a beat later, that
          // sliver hung there motionless and was then removed in a single frame: the
          // "it stops, then it is suddenly gone" the reader reported. Collapsed to zero
          // it sinks out of sight exactly when the press lands, and its hit area goes
          // with it.
          if (el && el.parentElement && el.parentElement.style) el.parentElement.style.transform = "scaleY(0)";
          setSheetHandleGone(false);
          // The press has to be SEEN before the curtain takes the stage. With the panel
          // open it already is: the panel's own 300ms tuck comes first. Collapsed, the
          // curtain used to drop on this very frame and cover the droplet (z 16 over
          // 12), which is why the press "had no animation" — so here the curtain waits
          // for the press to play out.
          if (open) openSheet();
          else {
            if (dropOpenRef.current) clearTimeout(dropOpenRef.current);
            dropOpenRef.current = setTimeout(function () {
              dropOpenRef.current = null;
              openSheet();
            }, DROP_OUT_MS);
          }
        },
        onMouseEnter: function () { if (sheetHandleRef.current) sheetHandleRef.current.style.opacity = "1"; },
        onMouseLeave: function () { if (sheetHandleRef.current) sheetHandleRef.current.style.opacity = "0.5"; },
        children: react_jsx_runtime.jsx("svg", {
          ref: sheetHandleRef,
          width: DROP_W,
          height: 17,
          viewBox: "0 0 140 17",
          // flush with the box's bottom edge, i.e. exactly on the strip's line
          style: { display: "block", opacity: 0.5, transition: "opacity 0.25s ease", cursor: "pointer" },
          children: [
            react_jsx_runtime.jsx("path", {
              // base from x=8 to x=132 (124px), dome up at y=3.5, both sides flaring
              // into concave fillets that become horizontal where they touch the line
              d: "M8 17 Q30 17 42 9 C50 4.5 58 3.5 70 3.5 C82 3.5 90 4.5 98 9 Q110 17 132 17 Z",
              fill: "var(--dsw-alias-border-l2, rgba(160,160,160,0.55))"
            }, "drop"),
            react_jsx_runtime.jsx("path", {
              // the side handle's own triangle, turned a quarter turn and taken down a
              // shade — 14 x 4.5 against its 5.5 x 16 — so it reads as the same
              // affordance without crowding the smaller droplet it sits in
              d: "M63 8.5 L77 8.5 L70 13 Z",
              fill: "var(--dsw-alias-label-secondary, #9aa0ab)"
            }, "tip")
          ]
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
            // above the panel and the curtain — it is a sibling of both in this
            // portal, and both sit below it in the layer band we claim
            zIndex: Z_HOVER,
            pointerEvents: "none"
          },
          children: cardChildren
        }, "hover-card");
      }

      // ---- the curtain shell ---------------------------------------------------
      // TWO boxes: an outer clip box that sits at the anchor line with the curtain's
      // own size, and the curtain inside it, which flies down from above that line
      // (translateY -100% -> 0) and back up on the way out. The clip is what makes it
      // emerge from under the view tabs — like the docked panel emerging from behind
      // the sidebar — so the surface is never seen above the line it hangs from.
      // The outer box never unmounts: while the curtain is down it is a zero-size,
      // non-clipping pass-through, so the panel (and the whole list DOM) is never
      // moved or rebuilt when the curtain opens or closes.
      var sheetUp = sheetOpen && chatViewActive;
      var sheetShellEl = react_jsx_runtime.jsx("div", {
        key: "sheet-shell",
        className: "dqt-sheet-clip",
        "data-sheet-shell": sheetUp ? "on" : undefined,
        style: sheetUp ? {
          position: "fixed",
          // hangs from just below the 对话/轨迹/上下文 strip
          top: sheetTopPx,
          left: viewport ? viewport.left : 0,
          width: viewport ? Math.max(320, window.innerWidth - viewport.left - viewport.right) : "100%",
          // a curtain over the conversation, not the whole screen: the composer and
          // the newest message stay reachable below it. The height is measured from
          // the conversation box (not from the curtain's own top) so hanging it below
          // the tabs does not push its bottom edge down over the composer.
          height: viewport
            ? Math.max(240, Math.min(760, (viewport.height - Math.max(0, sheetTopPx - viewport.top)) * 0.82))
            : "70vh",
          overflow: "hidden",
          zIndex: Z_SHEET
        } : {
          // Nothing while it is down — and in particular no border: a 1px border on a
          // zero-size box is still a 2px border box, and with the wrapper's overflow
          // visible that added 2px to the DOCUMENT's scrollable overflow. That raised a
          // page scrollbar while the curtain was down, so opening it dropped the
          // scrollbar and widened the whole app by ~8px — which is exactly the small
          // rightward shift of the conversation the reader saw. A fixed, zero-size,
          // borderless box contributes nothing, and the fixed-positioned docked panel
          // inside still resolves against the viewport and is not clipped by it.
          //
          // It DOES have to carry the panel's own layer though: a fixed-position
          // element creates a stacking context even at `z-index: auto`, so with the
          // shell at auto the docked panel inside it could never paint at its own
          // z-index — it sat below every positive-z-index element of the app. The
          // transcript width grips (z 8, a 40px full-height column just outside the
          // text column) won the hit test INSIDE the open panel: the cursor turned
          // into col-resize over the outline and a press there resized the
          // conversation instead of using the panel. Probed in a real browser with
          // elementFromPoint plus a temporary marker of the same z-index:
          //   shell auto -> at the grip's own column the hit was the grip
          //   shell 14   -> the hit is the outline row, and a 13 marker no longer
          //                 covers the panel while a 15 marker still does
          zIndex: Z_PANEL,
          position: "fixed",
          top: 0,
          left: 0,
          width: 0,
          height: 0,
          overflow: "visible"
        },
        children: react_jsx_runtime.jsx("div", {
          ref: sheetRef,
          className: sheetUp ? "dqt-sheet dqt-sheet-open" : "dqt-sheet-idle",
          "data-sheet": sheetUp ? "on" : undefined,
          style: {
            width: sheetUp ? "100%" : 0,
            height: sheetUp ? "100%" : 0,
            display: "flex",
            flexDirection: "column",
            background: C.panelBg,
            color: C.text,
            border: sheetUp ? "1px solid " + C.panelBorder : "none",
            // square where it meets the top edge, since the curtain hangs from there;
            // no dimming layer and no drop shadow either — the conversation below
            // stays legible and usable, and the curtain announces itself by flying
            borderRadius: "0 0 12px 12px",
            overflow: "hidden"
          },
          children: panelEl
        })
      });

      return react_dom.createPortal(
        react_jsx_runtime.jsx(ErrorBoundary, {
          children: [sheetShellEl, edgeEl, topHandleEl, hoverEl]
        }),
        document.body
      );
    }

    // the "to the section's end" control that every jumpable row (outline entries
    // and group headers, docked and curtain alike) carries at its far right. It
    // stays hidden until the row is hovered — the row's own mouseenter/leave
    // reveal it — and the click is handled once, in the panel's capture phase,
    // so the row's jump-to-start can never fire alongside it.
    function renderEndBtn(C, key, idx, turn) {
      // These markers are not decoration: the row's hover handler looks for
      // [data-dqt-end] to reveal the control, and the panel's capture phase looks
      // for it to route the click to the end jump instead of the row's own
      // jump-to-start. They are deliberately NOT data-jump-key: that attribute
      // belongs to the rows themselves, and two kinds of element claiming it made
      // every "find the row" query ambiguous.
      var attrs = { "data-dqt-end": "1" };
      if (key) attrs["data-end-key"] = key;
      if (idx !== undefined && idx !== null) attrs["data-end-idx"] = String(idx);
      if (turn !== undefined && turn !== null) attrs["data-end-turn"] = String(turn);
      return react_jsx_runtime.jsx("button", Object.assign({
        type: "button",
        tabIndex: -1,
        title: T("row.end"),
        onMouseEnter: function (e) {
          e.currentTarget.style.background = C.hover;
          e.currentTarget.style.color = C.text;
        },
        onMouseLeave: function (e) {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = C.muted;
        },
        style: {
          position: "absolute",
          right: 4,
          top: "50%",
          transform: "translateY(-50%)",
          width: 20,
          height: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          border: "none",
          borderRadius: 999,
          cornerShape: "round",
          background: "transparent",
          color: C.muted,
          // hover-only: the row raises this to 1 and the transition fades it in
          // and out, so the control never appears or vanishes with a snap
          opacity: 0,
          cursor: "pointer",
          transition: "opacity 0.22s ease, background 0.18s ease, color 0.18s ease"
        },
        children: react_jsx_runtime.jsx("svg", {
          width: 12,
          height: 12,
          viewBox: "0 0 12 12",
          style: { display: "block" },
          children: react_jsx_runtime.jsx("path", {
            // an arrow down onto a floor line: "go to where this section stops"
            d: "M6 1.5V8M2.8 5.2 6 8.4l3.2-3.2M2 11h8",
            fill: "none",
            stroke: "currentColor",
            strokeWidth: 1.5,
            strokeLinecap: "round",
            strokeLinejoin: "round"
          })
        })
      }, attrs), "end-" + (key || "") + "-" + (idx !== undefined && idx !== null ? idx : turn));
    }

    function renderItem(n, depth, jump, C, uid, extra) {
      var hasChildren = !!(n.children && n.children.length);
      var path = extra && extra.paths ? extra.paths[headingId(n)] : null;
      // Wide (curtain) rows put the same information on ONE line: an H-level chip,
      // the title, and the section's opening text out to the right — the space the
      // docked panel does not have. The narrow panel keeps title-over-subtitle.
      var wide = !!(extra && extra.wide);
      var hoverInfo = {
        title: n.title,
        sub: n.sub || "",
        preview: n.preview || "",
        meta: [n.time, path ? path.path : ""].filter(Boolean).join("  ·  "),
        ghost: false
      };
      var rows;
      if (wide) {
        var context = n.preview || n.sub || "";
        rows = [react_jsx_runtime.jsx("div", {
          style: { display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 },
          children: [
            react_jsx_runtime.jsx("span", {
              style: { flex: "none", width: 22, fontSize: 11.5, fontWeight: 600, letterSpacing: 0.2, color: C.muted, opacity: 0.65 },
              children: "H" + n.level
            }, uid + "-lv"),
            react_jsx_runtime.jsx("span", {
              style: { flex: "0 1 auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" },
              children: n.title
            }),
            // basis 0 + grow: the small text only ever takes the space the title
            // leaves over, so a long title is never squeezed by its own context
            context ? react_jsx_runtime.jsx("span", {
              style: {
                flex: "1 1 0",
                minWidth: 0,
                fontSize: 13,
                color: C.muted,
                opacity: 0.68,
                textAlign: "right",
                overflow: "hidden",
                textOverflow: "ellipsis"
              },
              children: context
            }) : null
          ]
        }, uid + "-l")];
      } else {
        rows = [
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
      }
      // the section's own "jump to its end" control, revealed while the row is
      // hovered; the reserved right padding keeps the title/subtitle/context
      // clear of it so nothing ever runs underneath the button
      rows.push(renderEndBtn(C, n.key, n.idx));
      // The hover highlight is its own layer rather than the row's own background:
      // the row box runs to its right edge, which is exactly where the end control's
      // round backdrop appears, so the two boxes used to sit flush against each other
      // (and on a long row the highlight ran underneath the button). This layer stops
      // END_ZONE short of that edge, leaving a clear gap.
      rows.unshift(react_jsx_runtime.jsx("div", {
        "data-dqt-hl": "1",
        style: {
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          right: END_ZONE,
          borderRadius: 6,
          background: "transparent",
          transition: "background 0.15s ease",
          pointerEvents: "none"
        }
      }, uid + "-hl"));
      return react_jsx_runtime.jsx(
        "div",
        {
          onClick: function () { jump(n.key, n.idx); },
          onMouseEnter: function (e) {
            var hl = e.currentTarget.querySelector("[data-dqt-hl]");
            if (hl) hl.style.background = C.hover;
            var b = e.currentTarget.querySelector("[data-dqt-end]");
            if (b) b.style.opacity = "1";
            if (extra && extra.hoverStart) extra.hoverStart(hoverInfo, e.currentTarget);
          },
          onMouseLeave: function (e) {
            var hl = e.currentTarget.querySelector("[data-dqt-hl]");
            if (hl) hl.style.background = "transparent";
            var b = e.currentTarget.querySelector("[data-dqt-end]");
            if (b) b.style.opacity = "0";
            if (extra && extra.hoverEnd) extra.hoverEnd();
          },
          "data-jump-key": n.key,
          "data-jump-idx": n.idx !== undefined ? String(n.idx) : "0",
          // keyboard navigation walks the ORDER of these rows inside the list
          "data-nav-row": "1",
          style: {
            // no fixed height: a row grows by one line when it has a subtitle
            // (narrow layout) — in wide mode it is one line by construction
            display: "block",
            position: "relative",
            padding: wide ? "4px 8px" : "2px 6px",
            paddingRight: END_ZONE,
            paddingLeft: (hasChildren ? (wide ? 4 : 2) : (wide ? 8 : 6)) + (n.level - 1) * (wide ? 16 : 12),
            margin: "1px 0",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: n.level <= 2 ? (wide ? 16.5 : 13) : (wide ? 15.5 : 12),
            color: n.level <= 2 ? C.text : C.muted,
            fontWeight: n.level <= 2 ? 600 : 400,
            lineHeight: wide ? "26px" : "18px",
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
      // the curtain's rows are wide: title, snippet and meta share ONE line (title
      // left, context middle-right, meta far right) instead of stacking three
      // half-empty lines. The docked panel keeps the stacked form.
      var wide = !!(extra && extra.wide);
      var meta = [];
      if (r.ghost) meta.push(T("turn.unloaded"));
      if (r.failed) meta.push(T("turn.failed"));
      if (r.time) meta.push(r.time);
      if (r.path) meta.push(r.path);
      if (r.count > 1) meta.push("×" + r.count);
      var children;
      if (wide) {
        children = [
          react_jsx_runtime.jsx("span", {
            style: {
              flex: "0 1 auto",
              minWidth: 0,
              fontSize: 15.5,
              fontWeight: r.level > 0 && r.level <= 2 ? 600 : 400,
              color: r.level > 0 ? C.text : C.muted,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            },
            children: hitSpans(r.title, q, fuzzy)
          }, "t" + i),
          r.snippet ? react_jsx_runtime.jsx("span", {
            style: {
              flex: "1 1 0",
              minWidth: 0,
              fontSize: 13,
              color: C.muted,
              opacity: 0.85,
              textAlign: "right",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            },
            children: hitSpans(r.snippet, q, fuzzy)
          }, "s" + i) : null,
          meta.length ? react_jsx_runtime.jsx("span", {
            style: { flex: "none", fontSize: 12, color: C.muted, opacity: 0.7, whiteSpace: "nowrap" },
            children: meta.join("  ·  ")
          }, "m" + i) : null
        ];
      } else {
        children = [
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
        "data-nav-row": "1",
        title: r.path || r.title,
        style: {
          padding: wide ? "6px 10px" : "4px 6px",
          margin: "1px 0",
          borderRadius: 6,
          cursor: "pointer",
          minWidth: 0,
          // wide: one line, three parts — level chip / title, context, meta
          display: wide ? "flex" : "block",
          alignItems: wide ? "baseline" : undefined,
          gap: wide ? 10 : undefined,
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

    // cross-session list: the HOST's index over the other sessions. One row per hit —
    // the hit session's title, the host's bounded snippet, and the scope note — and
    // clicking a row hands that session to openCrossHit. No hover card here: the
    // panel has no section text for a session it has not loaded.
    function renderCrossResults(cross, q, C, titleOf, onOpen) {
      var line = function (text, key, color, size) {
        return react_jsx_runtime.jsx("div", {
          style: {
            padding: "10px 8px",
            fontSize: size || 12,
            color: color || C.muted,
            textAlign: "center",
            lineHeight: 1.5,
            overflowWrap: "anywhere"
          },
          children: text
        }, key);
      };
      var out = [
        react_jsx_runtime.jsx("div", {
          key: "cross-note",
          style: { padding: "2px 8px 6px", fontSize: 10, color: C.muted, opacity: 0.8, lineHeight: 1.45 },
          children: T("search.cross.note")
        })
      ];
      if (cross.phase === "loading") {
        out.push(line(T("search.cross.loading"), "cross-loading"));
        return out;
      }
      if (cross.phase === "error") {
        out.push(line(T("search.cross.error") + cross.error, "cross-error", C.error || C.muted));
        return out;
      }
      if (!cross.rows || cross.rows.length === 0) {
        out.push(line(T("search.cross.empty"), "cross-empty"));
        if (cross.hidden > 0) {
          out.push(line(Tp("search.cross.hidden", { n: cross.hidden }), "cross-hidden", C.muted, 10));
        }
        return out;
      }
      var rows = cross.rows;
      var open = function (i) { onOpen(rows[i].sessionId); };
      for (var i = 0; i < rows.length; i++) {
        out.push(renderResultRow({
          title: titleOf(rows[i].sessionId),
          snippet: rows[i].snippet,
          level: 0,
          path: "",
          time: "",
          count: 1
        }, i, q, C, open, false, null));
      }
      if (cross.more) {
        out.push(react_jsx_runtime.jsx("div", {
          key: "cross-more",
          style: { padding: "8px 8px 2px", fontSize: 10, color: C.muted, opacity: 0.8, textAlign: "center" },
          children: T("search.cross.more")
        }));
      }
      // Hits the panel refuses to offer (archived / unlisted / subagent) are counted,
      // not silently dropped: "why is my hit missing" must have an answer on screen.
      if (cross.hidden > 0) {
        out.push(line(Tp("search.cross.hidden", { n: cross.hidden }), "cross-hidden", C.muted, 10));
      }
      return out;
    }

    // a group's header (the time row): clicking it jumps to the TOP OF THE
    // MODEL'S REPLY for that turn — the first assistant step — which also makes
    // heading-less turns jumpable, since they only have this row.
    // Implemented as a function (not an inline closure in a loop) so each
    // header captures its own (g, gi) — the var-in-loop closure bug would
    // otherwise make every header jump to the last group.
    function renderGroupHeader(g, gi, jump, C, isActive, extra) {
      // questions-only view and the wide curtain both give the header more room: it
      // grows (11px -> 14px, 18px -> 24px) and its prompt stops being a footnote
      // (0.75 -> 0.92 opacity on the body colour). The current-turn box is untouched
      // either way, and every header in a given view still shares ONE style.
      var big = !!(extra && (extra.questionsOnly || extra.wide));
      var wideBand = !!(extra && extra.wide && !extra.questionsOnly);
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
      // the group's own "jump to its end": the turn's last row (the failure row for
      // a failed turn, else the last reply). Revealed while the header is hovered.
      var lastKey = (g.msgs && g.msgs.length > 0) ? g.msgs[g.msgs.length - 1].key
        : (g.failure ? g.failure.key : "");
      return react_jsx_runtime.jsx("div", {
        onMouseEnter: function (e) {
          var b = e.currentTarget.querySelector("[data-dqt-end]");
          if (b) b.style.opacity = "1";
        },
        onMouseLeave: function (e) {
          var b = e.currentTarget.querySelector("[data-dqt-end]");
          if (b) b.style.opacity = "0";
        },
        style: {
          // ONE row geometry for every group header, whether or not the turn has
          // headings: same box, same 18px rhythm, same left inset, so the time
          // column of a heading-less turn lines up with all the others. Only the
          // type emphasis differs (weight + colour, see the label below).
          padding: big ? (wideBand ? "3px 4px 4px" : "2px 4px 3px") : "1px 4px 2px",
          // the label is capped by this, not by a maxWidth guess: the row reserves the
          // end control's zone, so a long prompt's hover box ends END_ZONE from the row
          // edge — a real gap before the button's round backdrop, which sits 24px in.
          // (With `max-width: calc(100% - 32px)` the percentage resolved somewhere else
          // and a forced-long header still came within 2px of the circle.)
          paddingRight: END_ZONE,
          height: big ? (wideBand ? 24 : 22) : 18,
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
          "data-nav-row": "1",
          onMouseEnter: function (e) { e.currentTarget.style.background = C.hover; },
          onMouseLeave: function (e) { e.currentTarget.style.background = "transparent"; },
          style: {
            // ONE style for every group header, heading-less turns included: a turn
            // whose reply has no markdown headings is not a different kind of entry,
            // it is simply a group with no rows under its header, and it must line up
            // with the rest of the list (same size, weight, colour, opacity). The only
            // thing that marks a group is the shared "current group" tint, which lives
            // on the group box — never on the label.
            fontSize: big ? (wideBand ? 14 : 12.5) : 11,
            fontWeight: 400,
            color: big ? C.text : C.muted,
            cursor: "pointer",
            padding: big ? "1px 5px" : "1px 5px",
            borderRadius: 4,
            background: "transparent",
            transition: "background 0.15s ease",
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            minWidth: 0,
            // the row's paddingRight already reserves the end control's zone, so the
            // label simply fills what is left: its hover box can never reach the circle
            maxWidth: "100%",
            overflow: "hidden"
          },
          children: [
            react_jsx_runtime.jsx("span", { style: { fontWeight: 600, flex: "none" }, children: g.time || " " }),
            g.userText ? react_jsx_runtime.jsx("span", {
              style: {
                fontWeight: 400,
                opacity: big ? 0.92 : 0.75,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                minWidth: 0
              },
              children: g.userText
            }) : null
          ]
        }),
          renderEndBtn(C, lastKey, undefined, g.turn)
        ]
      }, "g-h-" + gi);
    }

    // A turn the paged event window has not loaded yet: the host outline still
    // names it (number + bounded previews), so the outline covers the whole
    // session. Clicking pages that turn in through the session's jump loader.
    // What an unloaded group shows: the badge, the prompt, and the host's own response
    // preview. That preview is budgeted by the host at up to THREE rail-card lines, so it
    // is rendered at three lines and legibly — clamped to two at 0.65 opacity it read as
    // "there is nothing here but my own question", which is exactly what the reader
    // reported.
    function ghostBody(C, g) {
      var out = [
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
        out.push(react_jsx_runtime.jsx("div", {
          style: { fontSize: 10.5, lineHeight: "14px", color: C.muted, opacity: 0.8, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" },
          children: g.preview
        }));
      }
      return out;
    }
    function renderGhostGroup(g, gi, C, extra) {
      extra = extra || {};
      var children = ghostBody(C, g);
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
        "data-nav-row": "1",
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
          items.push(renderGroupHeader(g, gi, jump, C, isActive, extra));
          // questions-only reading: the header IS the content, so its rows are left out
          // entirely (the header itself grows and brightens for that job)
          if (!extra.questionsOnly) items.push(renderNodes(rows, 0, jump, C, "g" + gi, extra));
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
        commit(field === "zoom" ? { zoom: pct / 100 }
          : field === "sheetZoom" ? { sheetZoom: pct / 100 }
            : { handle: pct / 100 });
      };
      react.useEffect(function () {
        var a = sliderAwaiting.current;
        var settled = false;
        if (a.zoom !== undefined && Math.round(prefs.zoom * 100) === a.zoom) { delete a.zoom; settled = true; }
        if (a.sheetZoom !== undefined && Math.round(prefs.sheetZoom * 100) === a.sheetZoom) { delete a.sheetZoom; settled = true; }
        if (a.handle !== undefined && Math.round(prefs.handle * 100) === a.handle) { delete a.handle; settled = true; }
        if (settled) setSliderDrag(null);
      }, [prefs.zoom, prefs.sheetZoom, prefs.handle]);
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
      var sheetZoomControl = sliderCtl("sheetZoom", "settings.sheetZoom", 50, 200, 5, Math.round(prefs.sheetZoom * 100));
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
        field("sheetZoom", T("settings.sheetZoom"), T("settings.sheetZoom.tip"), sheetZoomControl, false),
        field("handle", T("settings.handle"), T("settings.handle.tip"), handleControl, false),
        field("fuzzy", T("settings.fuzzy"), "", onoff(prefs.fuzzy, function (v) { commit({ fuzzy: v }); }), true),
        field("hover", T("settings.hover"), "", onoff(prefs.hover, function (v) { commit({ hover: v }); }), true),
        field("remember", T("settings.remember"), "", onoff(prefs.remember, function (v) { commit({ remember: v }); }), true),
        field("autoLoad", T("settings.autoLoad"), "", onoff(prefs.autoLoad, function (v) { commit({ autoLoad: v }); }), true),
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

    // Declared client services only. `slots` and `locale` exist on every supported line;
    // the settings service is looked up with `ctx.get` instead (see `pickSettingsScope`),
    // because declaring a name a host does not provide parks the whole package.
    var inject = ["slots", "locale"];

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
        },
        // The workspace registry owns the archive set the sidebar filters with
        // (list.getSnapshot().archivedSessionIds). Cross-session hits are filtered
        // by the SAME rule, so a hit the sidebar would hide is never offered here.
        workspaces: function () {
          try {
            return typeof ctx.get === "function" ? (ctx.get("workspaces") || null) : null;
          } catch (e) {
            return null;
          }
        },
        // The alpha's session navigation (uiWorkspace.openSession); the older line has no
        // such service and switches sessions through `sessions.open` instead. Optional by
        // the same rule: whichever exists is used, and neither existing is reported.
        uiWorkspace: function () {
          try {
            return typeof ctx.get === "function" ? (ctx.get("uiWorkspace") || null) : null;
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

      // The client settings scope: the browser face of the settings namespace the host
      // half serves. The store adopts its snapshot as the authoritative layer for the
      // host-backed fields and routes writes to it; on a host without either dialect (or
      // on a non-loopback page, where DSH keeps settings read-only) the localStorage
      // mirror keeps every preference working, exactly as 0.5.x did.
      //
      // TWO DIALECTS, ONE SHAPE. Up to DSH 0.1.5-rc.2 the host serves a
      // `settingsScope` service whose `bind({namespace})` returns a namespace scope; from
      // 0.1.7-alpha.1 on, that service is gone and the same object is handed out by the
      // `configForms` service per PROFILE ENTRY ID (`get(id)`). Both expose
      // `getSnapshot()` / `mutate(ops)` / `unset(field)` over the same snapshot fields, so
      // one adapter covers them.
      //
      // Neither is declared in `inject`: a name the running host does not provide parks
      // the whole package until it appears, and on 0.1.7-alpha.1 that turned into a web
      // boot that never finished (`1 entry did not activate: dsh-quick-toc: pending
      // (waiting for service: settingsScope)`), taking the entire GUI with it. Both
      // declaration-free routes are tried — `ctx.get(name)` first, then the service
      // property the older line has always offered — and a missing service simply leaves
      // the localStorage layer in charge.
      var getService = function (name) {
        try {
          if (typeof ctx.get === "function") {
            var found = ctx.get(name);
            if (found) return found;
          }
        } catch (e) { /* fall through to the property read */ }
        try {
          return ctx[name] || null;
        } catch (e) {
          return null;
        }
      };
      // Which namespace the `configForms` dialect should be asked for. Its key is the
      // profile entry id, which the installing profile's patch decides (this package's own
      // cordis.patch.yml inserts the row as `quick-toc`), so the served schema is what
      // identifies us: a namespace carrying this plugin's own fields is ours whatever it
      // is called.
      var formsNamespace = function (forms) {
        var candidates = ["quick-toc", "dsh-quick-toc"];
        var served = [];
        try {
          var view = forms.describe ? forms.describe().getSnapshot().view : null;
          served = (view && view.namespaces) || [];
        } catch (e) {
          served = [];
        }
        for (var i = 0; i < served.length; i++) {
          var ns = served[i] || {};
          var json = "";
          try { json = JSON.stringify(ns.schema || {}); } catch (e) { json = ""; }
          if (json.indexOf("sheetZoom") >= 0 && json.indexOf("autoLoad") >= 0) return ns.ns;
        }
        for (var j = 0; j < candidates.length; j++) {
          try {
            var form = forms.get(candidates[j]);
            if (form && form.getSnapshot && form.getSnapshot().status === "ready") return candidates[j];
          } catch (e) { /* try the next candidate */ }
        }
        // The settings mirror can still be LOADING when a plugin applies, so the readiness
        // check above may not have matched yet (DSH 0.1.7-rc.1 answers `status: "loading"`
        // at this point, while 0.1.5-rc.x's `settingsScope` answered immediately). The
        // scope subscribes to the form and adopts its snapshot when the document arrives,
        // so any existing form is enough: take the first candidate that HAS one instead of
        // blindly naming the first candidate (which can be a name with no form at all).
        for (var k = 0; k < candidates.length; k++) {
          try {
            if (forms.get(candidates[k])) return candidates[k];
          } catch (e) { /* try the next candidate */ }
        }
        return candidates[0];
      };
      var pickSettingsScope = function () {
        var scope = getService("settingsScope");
        if (scope && typeof scope.bind === "function") {
          try {
            var bound = scope.bind({ namespace: NAMESPACE });
            if (bound) return bound;
          } catch (e) { /* fall through to the newer dialect */ }
        }
        var forms = getService("configForms");
        if (forms && typeof forms.get === "function") {
          try {
            return forms.get(formsNamespace(forms));
          } catch (e) { /* leave the localStorage layer in charge */ }
        }
        return null;
      };
      var boundScope = pickSettingsScope();
      if (boundScope) {
        try {
          prefsStore.attachHost(boundScope);
        } catch (e) {
          boundScope = null;
          console.warn("[dsh-quick-toc] settings scope unavailable, preferences stay in this browser:", e);
        }
      }

      // The plugin-configuration card, in whichever seat the running host offers:
      //  * up to rc.2 it is a keyed `settings.plugin.item` cell under
      //    Settings → Plugins → Plugin configuration, keyed by the settings namespace;
      //  * on the alpha the plugin's own page in the sidebar's Plugins list carries it,
      //    as the bundle's configuration keyed by the npm package name
      //    (`plugins.bundle.config`). A row-level cell (`plugins.row.config`, keyed
      //    `<package>#<row id>`) exists too, but a registration there did not reach that
      //    page in 0.1.7-alpha.1 while the bundle cell did — and these preferences are the
      //    plugin's, not one row's, so the bundle page is the right seat anyway.
      // Registering into a slot a given host never declares is inert (the registration
      // waits), so both are offered unconditionally, and only once a scope bound keeps a
      // half-configured host from rendering a card that could not read or write anything.
      if (boundScope) {
        ctx.slots.inject("plugins.bundle.config", function () {
          return ctx.slots.register({
            name: "plugins.bundle.config",
            key: "dsh-quick-toc",
            locale: "dsh-quick-toc"
          }, TocSettingsCard);
        });
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
        // questions-only switch: fade the list out, swap the mode while it is
        // invisible, fade it back in (the two lists never blend mid-swap)
        ".dqt-mode-out{animation:dqt-fade-out 0.15s linear both}" +
        ".dqt-mode-in{animation:dqt-fade-in 0.26s cubic-bezier(0.22, 0.9, 0.3, 1) both}" +
        // the curtain FLIES DOWN from above the line it hangs from and flies back up
        // on the way out — the same vocabulary as the docked panel sliding in from its
        // edge. The clip box it lives in (see the portal) is what keeps it from being
        // seen above that line, so it reads as emerging from under the view tabs.
        "@keyframes dqt-sheet-in{from{transform:translateY(-100%)}to{transform:translateY(0)}}" +
        "@keyframes dqt-sheet-out{from{transform:translateY(0)}to{transform:translateY(-100%)}}" +
        ".dqt-sheet-open{animation:dqt-sheet-in 0.46s cubic-bezier(0.22, 0.9, 0.3, 1) both;will-change:transform}" +
        ".dqt-sheet-closing{animation:dqt-sheet-out 0.3s cubic-bezier(0.4, 0, 1, 1) both;pointer-events:none;will-change:transform}" +
        "@media (prefers-reduced-motion: reduce){.dqt-sheet-open,.dqt-sheet-closing{animation:none}}" +
        // The curtain handle is a droplet resting on the view-tab strip's lower line:
        // its silhouette flares into two concave fillets at the line (surface tension,
        // not a detached pill). It grows out of the line when it appears — after a
        // retract as much as on first paint — and the click squeezes it flat against
        // the line before the curtain takes over (see the element's own transform).
        // Both ends of the pair are flush with the line — 0 -> 1 here, 1 -> 0 on the
        // press — so the two directions are one motion and its rewind in their
        // endpoints as well as in their curves.
        "@keyframes dqt-handle-pop{from{transform:scaleY(0)}to{transform:scaleY(1)}}" +
        ".dqt-sheet-handle{transform-origin:50% 100%}" +
        // coming back it is the press read backwards: FAST OUT OF THE LINE — 74% of the
        // easing is done 30ms in — and then the rest settles over the remaining 170ms.
        // `cubic-bezier(0, 0.55, 0.25, 1)` is exactly `cubic-bezier(0.75, 0, 1, 0.45)`
        // mirrored, which is the curve the press uses.
        ".dqt-sheet-handle>svg{animation:dqt-handle-pop 0.2s cubic-bezier(0, 0.55, 0.25, 1) both;transform-origin:50% 100%}" +
        "@media (prefers-reduced-motion: reduce){.dqt-sheet-handle>svg{animation:none}}" +
        // keyboard cursor: an INSET outline plus a whisper of fill, so it never
        // reflows the row and stays distinct from the reading position's blue box
        // (which keeps the 3px left accent bar and the pastel fill)
        ".dqt-nav{box-shadow:inset 0 0 0 1px var(--dsw-alias-brand-primary, #4f8cff);background:rgba(79,140,255,0.10);border-radius:6px}" +
        ".dqt-nav:focus{outline:none}" +
        // the list itself never draws a focus ring — the cursor row is the indicator
        ".dqt-list:focus-visible{outline:none}" +
        // screen-reader-only live region
        ".dqt-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0}" +
        // the fade is decoration: a reader who asked for less motion gets the swap
        "@media (prefers-reduced-motion: reduce){.dqt-mode-out,.dqt-mode-in{animation:none}}" +
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

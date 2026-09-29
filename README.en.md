# dsh-quick-toc

> **English** | [中文](README.md)

A conversation TOC plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH): it turns the Markdown headings (H1–H6) of AI replies into a navigable outline — the same list as a side panel or as a full-width curtain — grouped by conversation turn and covering the whole session (including turns that are not loaded yet), with title/full-text/cross-session search, hover previews, several ways to jump (a heading, a turn header, the end of a section), and a reading position that both follows and is remembered.

## Features

- **Turn-grouped outline** — each user message plus its following AI replies form one group; the group header shows the turn's time and a first-line preview, and clicking it jumps to the start of that turn's model reply
- **Whole-session coverage** — turns the conversation window has not loaded are listed too (tagged `未加载` / "Not loaded", with previews); clicking one loads that turn and jumps to it
- **Failures are reported** — a turn with no reply at all (request timeout, upstream error) shows `请求失败` / "Request failed" plus the host's error text, and clicking it jumps to that error in the conversation
- **A full-width curtain** — the droplet handle inside the tab strip along the top of the conversation (or the "curtain" round button in the panel's header) lays the outline out across the full width and drops it down: no scrim, nothing dimmed, larger type and looser rows, three parts per row (level badge / heading / the section's opening), and the search column sliding in from the right; click a row, press Esc or use the ✕ to close. It shares the one list with the docked panel, so the scroll position, the search and the keyboard cursor all carry over
- **Jump to the end of a section** — hover a heading row, a group header or a result row and a round button fades in at its right end; a group header's button jumps to the end of the whole turn
- **Cross-session search** — the third scope, "sessions", searches the message bodies of other sessions through the host's full-text index; clicking a hit switches to that session and keeps looking there, and archived / subagent / delisted sessions are skipped with a count
- **Questions only** — one click folds the outline down to each turn's time and the first line of your prompt
- **A remembered reading position** — reopening a session returns to the turn you were last reading (within half an hour; the card can switch it off)
- **Keyboard navigation** — ↑/↓ move the cursor, Enter jumps, Home / End go to either end, Esc collapses; the cursor's position is announced to screen readers
- **Bilingual** — the interface language can follow the host, or be forced to Chinese or English; Chinese stamps use `昨天` / `前天`, English reads yesterday as the word (`yesterday`) and carries the `YY-MM-DD HH:MM` date for anything older
- **A plugin-configuration card** — a "Conversation Outline" card under Settings → Plugins → Plugin configuration: the language, the default docked edge, the heading levels shown, where the collapsed handle sits, the remembered reading position, fuzzy search, hover previews and the diagnostic switch; changed fields are marked "customized" and can be reset individually (returning a field to its default drops the mark), and the card and the panel stay in sync
- **Turn stamps carry the day** — yesterday reads `昨天 15:04`, the day before `前天 15:04`, anything older `25-09-11 15:04`, so times never blur together in a session spanning days (with the interface in English every stamp older than today carries a `YY-MM-DD` date instead)
- **Row subtitles** — under each heading, the first sentence of that section, so identically-titled headings can be told apart
- **Hover previews** — hovering a heading row shows the section's opening, the turn time and the heading path
- **Search** — title / full-text scopes; click any result row to locate and highlight that hit, `n/N` Enter stepping, Esc to close
- **Search tolerance** — case, full-width/half-width and whitespace differences match automatically; the "fuzzy" switch also allows a little material wedged between keywords
- **In-chat highlighting** — matched keywords are highlighted in the conversation; the current match is highlighted distinctly
- **Sticky group headers** — while scrolling the outline, the current turn's header stays pinned at the top of the panel
- **Heading level filter** — the round levels button in the header pops down H1–H6 switches for any combination
- **Auto-follow** — the turn being read lights up in a closed blue box while you scroll the conversation; the outline follows on its own
- **Jumping** — click a heading to jump to its position in the conversation, with the scroll animation handed to the browser's own smooth scrolling (advanced on the wall clock, so it takes the same time on a 60 Hz and a 240 Hz panel); when the host re-pages and moves the target mid-flight the jump re-aims, and when the host's own scrolling cancels the animation it is issued again, so a cross-page jump never stops halfway; a browser that carries the call out at once gets a frame-by-frame glide drawn by the plugin instead
- **Back to the newest row** — after paging far up, a floating button in the list's lower-right corner returns to the newest entry in one click (it appears when the list is not at its bottom and disappears once it is)
- **Back to where I left** — closing the panel or the curtain remembers the row that was at the top (each surface keeps its own, and neither overwrites the other); the next time that surface opens, a floating button in the list's upper-right corner returns that row to **where it sat**. It fades out — and forgets the record — once it is used, or as soon as you scroll back there yourself, until the next close. Under the same rule, opening the panel or the curtain puts the **row being read** at the top of the list (when that turn is one of the newest few the list is already at its end, so the row lands at the bottom)
- **Dockable and resizable** — drag the top bar to move the panel, ◀ / ▶ to dock left or right, drag an edge to resize (no upper bound, down to 120px wide), and collapse it into an edge handle (its height is set by the card's "Handle position"); position and size are remembered per browser (top offset, width and height are adjusted by dragging only)
- **Panel scale** — a slider in the settings card scales the **content** (text, icons, buttons and their spacing) from 50% to 200% in 5% steps while the **panel's own size stays exactly as dragged**; dragging only moves the readout, and the settings document is written once you let go. A narrow panel keeps its four header buttons on one line: the empty middle gives way first, then the whole row scrolls sideways (wheel over the header), and the grey grab bar fades out
- **Curtain scale** — a second slider scales the **curtain's content** from 50% to 200% in 5% steps while the curtain's own size stays as it is; the panel scale and the curtain scale are independent of each other. The curtain's content starts one notch smaller than before (100% on the slider is 90% of the previous size), and only the outline inside the curtain is scaled — the conversation itself is untouched
- **Paging** — the most recent groups show first; scrolling up both expands the index and loads older conversation
- **Edge hints** — a brief hint at the bottom of the panel when you keep scrolling past the first or the last entry
- **Markdown-aware** — inline markup in headings is stripped; `#` lines inside fenced code blocks are not headings
- **Theme-aware** — adapts to dark and light themes; visible on the chat view only and fades out elsewhere
- The panel hides itself when the conversation has neither headings nor readable times

## Compatibility

| Plugin | Supported DSH |
| --- | --- |
| **0.8.x** (latest, 0.8.1) | 0.1.5-rc.3, 0.1.7-alpha.1, 0.1.7-alpha.2, 0.1.7-rc.1, 0.1.7-rc.2, 0.2.0-rc.1 |
| 0.7.x (0.7.14) | 0.1.5-rc.3, 0.1.7-alpha.1, 0.1.7-alpha.2, 0.1.7-rc.1, 0.1.7-rc.2, 0.2.0-rc.1 |
| 0.6.x (0.6.3) | 0.1.5-rc.1, 0.1.5-rc.2 |
| 0.5.x (0.5.1) | 0.1.5-rc.1, 0.1.5-rc.2 |
| 0.4.x (0.4.1) | 0.1.5-rc.1, 0.1.5-rc.2 |
| 0.3.x (0.3.3) | 0.1.5-rc.1 |
| 0.2.x (0.2.2) | = 0.1.2-rc.1 |

Each major line lists only its newest patch (the defects a new feature introduces are fixed in the patches that follow, so within one major line the newest patch is the one to use; older patches keep working — the plugin does not break existing interfaces).

## Install

With the DSH CLI:

```
dsh plugin --profile web add dsh-quick-toc
```

Or from GitHub:

```
dsh plugin --profile web add github:LyaxZ/dsh-quick-toc
```

Or from a local folder:

```
dsh plugin --profile web add <path-to-the-plugin-folder>
```

After installing, restart DSH and open the Web UI. The panel starts collapsed: click the edge handle next to the conversation to expand the panel, or click the droplet handle in the tab strip along the top to drop the outline down across the full width.

## Usage

- **Jumping**: click an outline heading or a group header to jump to it; entries tagged `未加载` / "Not loaded" load that turn first, and a failed turn's error row jumps to that error in the conversation
- **Search**: open the box with the magnifier, click a result to locate and highlight it, Enter to step through matches, Esc to close
- **Search tolerance**: full-width/half-width, case and whitespace differences match automatically; for looser matching turn on the "fuzzy" switch next to the search box
- **Level filter**: click the round levels button in the header to pop down the H1–H6 switches
- **Moving and docking**: drag the top bar to move, ◀ / ▶ to switch sides
- **Resizing**: drag the right edge, bottom edge or bottom-right corner (no upper bound, down to 120px wide; a very narrow panel scrolls its header sideways)
- **Loading older turns**: scroll up inside the outline (it both expands the index and loads older conversation)
- **The curtain**: click the droplet handle in the tab strip along the top of the conversation (or the "curtain" round button in the panel's header) for the full-width outline; click any row, press Esc or use the ✕ to close
- **Jump to the end of a section**: hover a heading row, a group header or a result row and click the round button at its right end
- **Cross-session search**: click the scope button beside the search box twice to reach "sessions" and search other sessions through the host's full-text index; clicking a hit switches to that session and keeps looking there
- **Keyboard**: with the panel open, ↑/↓ move the cursor, Enter jumps, Home / End go to either end and Esc collapses; inside the search box ↑/↓ step through the matches
- **Questions only**: the speech-bubble button in the header folds the outline down to each turn's time and the first line of your prompt
- **Back to the newest row**: after paging far up, click the floating button in the list's lower-right corner
- **Back to where I left**: closing the panel or the curtain remembers the row you were looking at; the floating button in the upper-right corner takes you back the next time you open it
- **Reading position**: scroll the conversation and the turn you are reading is boxed in blue; the outline follows
- **Settings**: expand the "Conversation Outline" card under **Settings → Plugins → Plugin configuration** for the language, the default docked edge, the panel scale (a 50%–200% slider in 5% steps), where the collapsed handle sits (a 0%–100% slider in 1% steps: 0% at the bottom, 100% at the top, 50% centred by default), the heading levels shown, the remembered reading position and the fuzzy / hover / diagnostic switches; changed fields can be reset individually (returning one to its default drops the mark). The card and the panel are live in both directions, with no reload needed, and the preferences follow the DSH settings document

## Diagnostics

Mounting the panel prints **nothing** by default. To check the host facilities, expand the "Conversation Outline" card under **Settings → Plugins → Plugin configuration** and tick "print the mount diagnostic to the console" — the line prints on the spot, no reload needed:

```
[dsh-quick-toc] panel mounted · turnOutline=… · jumpLoader=… · lang=… · prefs=…
```

A missing `turnOutline` means the host has no such projection, and the staged `jumpLoader` wording (`no-sessions-service` / `no-binding-api` / `no-binding-for-session` / `no-loadThrough` / `binding-threw`) pinpoints which link of the jump bridge is broken.

## Development

- `lib/client.js` — all UI logic (browser side)
- `lib/index.js` — the host half: registers the `dsh-quick-toc` settings namespace (a schemastery schema with range validation), which puts the preferences into DSH's settings document and provides the plugin-configuration entry
- `cordis.patch.yml` — loader patch (official DSH bundle format)
- The panel registers into the session-scoped `conversation.input.overlay` slot so it receives session-scoped hooks (`useChat`, `useSession`, `sessionId`, …), and renders itself through `createPortal` into `document.body` as a fixed floating dock; conversation data comes from `props.useChat` (`ChatSnapshot.order` and `nodes`; node shape: `kind: user/assistant-step`, `location.turn`, `data.blocks`)
- The "unloaded turn" capability needs two host facilities: the `turnOutline` projection (the whole-session turn index, each entry carrying its `turn/start` seq) and the turn-jump loader (the client `sessions` service's `binding(sessionId).session.loadThrough(seq)`, reached through the client ctx's declaration-free `ctx.get("sessions")` lookup). Each degrades on its own: without the projection the outline lists loaded turns only, without the loader unloaded entries are shown but not jumped to, and nothing else in the panel is affected.
- The failure row reads the host's `turn-error` conversation node (published when `turn/end` carries an `error` reason, with `message` and an optional `code`); on a host without that node the row is simply absent and nothing else changes.
- Interface text lives in one string table at the top of `lib/client.js` (`DICTS`, one Chinese and one English copy) and the language setting picks between them: on `follow the host` the host's translate function (`ctx.locale.bind("dsh-quick-toc")`, fed by the same `DICTS` tables) is asked first and the built-in table is only the fallback. The two tables must stay key-aligned; the only Chinese-only entry is `time.beforeYesterday` (English carries the date for anything older than yesterday), while `time.yesterday` exists in both (`yesterday`).
- Preferences sit in two layers behind one module-level store: the Host settings document (language, docked edge, levels, scale, handle position, remembered reading position, fuzzy, hover and diagnostic; authoritative on a loopback page) and `localStorage` (the mirror, plus the real storage for top offset / width / height, which describe this screen and are saved per browser). **The host layer itself is one of two dialects, whichever the running host offers**: on 0.1.5-rc.3 it is `ctx.settingsScope.bind({ namespace: "dsh-quick-toc" })` (addressed by namespace), while on either 0.1.7 line (alpha and rc) it is `ctx.configForms.get(<profile entry id>)` (addressed by profile entry id, the client recognising its own entry by the schema the host serves). Both expose the same methods over the same snapshot fields, so the store stays one. Writes are routed per field: host fields go through `scope.mutate` (folded in locally, reconciled when the host answers), everything else goes to `localStorage`; a value that IS the field's default is written by removing that entry from the user layer instead (the same thing as "not customized"). On a non-loopback page DSH marks settings read-only, so those nine preferences fall back to the mirror and behave exactly as in 0.5.x; values left by a 0.5.x install are imported into the host layer once, the first time it answers (and only while the user layer is empty). Once the host has answered, that layer is authoritative — which is why a local key such as `localStorage['dsh-quick-toc.debug']` no longer takes effect on a loopback page: use the switch in the card.
- The curtain and the docked panel **share one list DOM**: the curtain only moves the panel itself into a full-width container that drops from the lower edge of the tab strip (in curtain mode the panel swaps to a different geometry — relative positioning, 100% width and height, no panel scale), and that container stays mounted as a zero-size pass-through while the curtain is up, so opening or closing it never rebuilds the list or loses the scroll position. Cross-session search goes through the client `ctx.get("sessions")` service's `search(query, signal)` (the host's session full-text index, at most 20 hits per search); each session's reading position lives in this browser (`dsh-quick-toc.readPos.v1`, valid for half an hour).
- The configuration card is registered into all three seats at once, and which one it lands in is the running host's business: on 0.1.5-rc.3 it is `settings.plugin.item` (keyed on the plugin's namespace; the slot is dispatched only for namespaces the Host actually serves, so a deployment without the host half simply shows no card and the panel is unaffected); on either 0.1.7 line (alpha and rc) it is two places on the sidebar's Plugins page — the plugin's own entry in the Official group (`plugins.item`, `id` `quick-toc`, `label` from "Conversation Outline", `order` 50) and the configuration area of its bundle page (`plugins.bundle.config`, keyed on the npm package name). Both 0.1.7 seats hand the card a `view`, so it starts expanded there (opening the entry or the bundle page IS the expansion gesture); the rc line's configuration cell passes no props at all and keeps the collapsed list shape. Every registration happens only once a settings scope has bound, and the card and the panel share the store above, which is what makes the two live in both directions.
- Changes to `lib/client.js` show up after a page refresh (client modules are served under a content hash and DSH's client HMR pushes reloads); changes to `lib/index.js` (the host half) need a DSH restart
- Revisions to the release wording land only in the **repository** and on the **GitHub Release page**: the `CHANGELOG.md` bundled in an already-published npm version is the one from release time, and **npm version contents are immutable** (0.7.5/0.7.6 still carry the long-form text from before the 2026-09-19 rewrite, and 0.7.9 still carries one sentence that was corrected afterwards). Every release runs `relnotes.mjs`, which checks that the repo (zh/en), the npm tarball (zh/en) and the release body (zh/en) all read identically.

## License

MIT © 2026 LyaxZ

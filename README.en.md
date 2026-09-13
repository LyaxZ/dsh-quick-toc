# dsh-quick-toc

> **English** | [中文](README.md)

A conversation TOC plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH): it turns the Markdown headings (H1–H6) of AI replies into a navigable outline panel, grouped by conversation turn and covering the whole session (including turns that are not loaded yet), with title/full-text search, hover previews and reading-position auto-follow.

## Features

- **Turn-grouped outline** — each user message plus its following AI replies form one group; the group header shows the turn's time and a first-line preview, and clicking it jumps to the start of that turn's model reply
- **Whole-session coverage** — turns the conversation window has not loaded are listed too (tagged 未加载, with previews); clicking one loads that turn and jumps to it
- **Failures are reported** — a turn with no reply at all (request timeout, upstream error) shows `请求失败` plus the host's error text, and clicking it jumps to that error in the conversation
- **Turn stamps carry the day** — yesterday reads `昨天 15:04`, the day before `前天 15:04`, anything older `25-09-11 15:04`, so times never blur together in a session spanning days
- **Row subtitles** — under each heading, the first sentence of that section, so identically-titled headings can be told apart
- **Hover previews** — hovering a heading row shows the section's opening, the turn time and the heading path
- **Search** — title / full-text scopes; click any result row to locate and highlight that hit, `n/N` Enter stepping, Esc to close
- **Search tolerance** — case, full-width/half-width and whitespace differences match automatically; the "fuzzy" switch also allows a little material wedged between keywords
- **In-chat highlighting** — matched keywords are highlighted in the conversation; the current match is highlighted distinctly
- **Sticky group headers** — while scrolling the outline, the current turn's header stays pinned at the top of the panel
- **Heading level filter** — the round levels button in the header pops down H1–H6 switches for any combination
- **Auto-follow** — the turn being read lights up in a closed blue box while you scroll the conversation; the outline follows on its own
- **Jumping** — click a heading to jump to its position in the conversation
- **Back to the newest row** — after paging far up, a floating button in the list's lower-right corner returns to the newest entry in one click (it appears when the list is not at its bottom and disappears once it is)
- **Dockable and resizable** — drag the top bar to move the panel, ◀ / ▶ to dock left or right, drag an edge to resize, and collapse it into an edge handle; position and size are remembered
- **Paging** — the most recent groups show first; scrolling up both expands the index and loads older conversation
- **Edge hints** — a brief hint at the bottom of the panel when you keep scrolling past the first or the last entry
- **Markdown-aware** — inline markup in headings is stripped; `#` lines inside fenced code blocks are not headings
- **Theme-aware** — adapts to dark and light themes; visible on the chat view only and fades out elsewhere
- The panel hides itself when the conversation has neither headings nor readable times

## Compatibility

| Plugin | Supported DSH |
| --- | --- |
| **0.5.1** (latest) | 0.1.5-rc.1, 0.1.5-rc.2 |
| 0.5.0 | 0.1.5-rc.1, 0.1.5-rc.2 |
| 0.4.1 | 0.1.5-rc.1, 0.1.5-rc.2 |
| 0.4.0 | 0.1.5-rc.1, 0.1.5-rc.2 |
| 0.3.3 | 0.1.5-rc.1 |
| 0.3.0 – 0.3.2 | ≥ 0.1.2-rc.1 |

`engines.dsh` has a floor of **0.1.5-rc.1** (`>=`): from that release on, the plugin uses the host's session-scoped slot injection. 0.5.1 was tested on **0.1.5-rc.2**, and the host interfaces it relies on — the `turnOutline` projection, the session-scoped `useProjection`, the client `sessions` service and its `loadThrough` jump loader (since 0.5.0), and the `turn-error` node used for failed turns (since 0.5.1) — were checked one by one against the installed **0.1.5-rc.1** bundles, so both are declared. Older or newer DSH versions are unverified and therefore not claimed; on an older DSH the newest usable plugin version is **0.3.2**. On install or update, the DSH market pre-flights host compatibility from `engines.dsh`, `dsh.compatibility.dshReleases` and `peerDependencies` in `package.json`.

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

After installing, restart DSH and open the Web UI. The panel starts collapsed; click the edge handle next to the conversation to expand it.

## Usage

- **Jumping**: click an outline heading or a group header to jump to it; entries tagged 未加载 load that turn first, and a failed turn's error row jumps to that error in the conversation
- **Search**: open the box with the magnifier, click a result to locate and highlight it, Enter to step through matches, Esc to close
- **Search tolerance**: full-width/half-width, case and whitespace differences match automatically; for looser matching turn on the "fuzzy" switch next to the search box
- **Level filter**: click the round levels button in the header to pop down the H1–H6 switches
- **Moving and docking**: drag the top bar to move, ◀ / ▶ to switch sides
- **Resizing**: drag the right edge, bottom edge or bottom-right corner
- **Loading older turns**: scroll up inside the outline (it both expands the index and loads older conversation)
- **Back to the newest row**: after paging far up, click the floating button in the list's lower-right corner
- **Reading position**: scroll the conversation and the turn you are reading is boxed in blue; the outline follows

## Diagnostics

Mounting the panel prints **nothing** by default. To check the host facilities, run this once in the browser console:

```
localStorage.setItem("dsh-quick-toc.debug", "1")
```

then reload: the console shows one line, `[dsh-quick-toc] panel mounted · turnOutline=… · jumpLoader=…`. A missing `turnOutline` means the host has no such projection, and the staged `jumpLoader` wording (`no-sessions-service` / `no-binding-api` / `no-binding-for-session` / `no-loadThrough` / `binding-threw`) pinpoints which link of the jump bridge is broken. Turn it off again with `localStorage.removeItem("dsh-quick-toc.debug")`.

## Development

- `lib/client.js` — all UI logic (browser side)
- `lib/index.js` — host-side entry (empty; this plugin ships browser-side UI only)
- `cordis.patch.yml` — loader patch (official DSH bundle format)
- The panel registers into the session-scoped `conversation.input.overlay` slot so it receives session-scoped hooks (`useChat`, `useSession`, `sessionId`, …), and renders itself through `createPortal` into `document.body` as a fixed floating dock; conversation data comes from `props.useChat` (`ChatSnapshot.order` and `nodes`; node shape: `kind: user/assistant-step`, `location.turn`, `data.blocks`)
- The "unloaded turn" capability needs two host facilities: the `turnOutline` projection (the whole-session turn index, each entry carrying its `turn/start` seq) and the turn-jump loader (the client `sessions` service's `binding(sessionId).session.loadThrough(seq)`, reached through the client ctx's declaration-free `ctx.get("sessions")` lookup). Each degrades on its own: without the projection the outline lists loaded turns only, without the loader unloaded entries are shown but not jumped to, and nothing else in the panel is affected.
- The failure row reads the host's `turn-error` conversation node (published when `turn/end` carries an `error` reason, with `message` and an optional `code`); on a host without that node the row is simply absent and nothing else changes.
- Changes to `lib/client.js` show up after a page refresh (client modules are served under a content hash and DSH's client HMR pushes reloads); restart DSH only if that does not take

## License

MIT © 2026 LyaxZ

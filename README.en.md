# dsh-quick-toc

> **English** | [中文](README.md)

A conversation TOC plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH): it turns the Markdown headings (H1–H6) of AI replies into a navigable outline panel, grouped by conversation turn, with auto-follow highlighting, keyword search and in-chat match highlighting.

## Features

- **Turn-grouped outline** — each user message plus its following AI replies form one group; the group header shows the turn's end time and a first-line preview, and clicking it jumps to the start of the turn
- **Keyword search** — the magnifier in the panel header opens a search box; press **Enter** to jump to the next match (wrapping), **Esc** to close, with an `n/N` match counter
- **Search scope toggle** — the **title / full-text** button in the search box switches between searching heading titles only and also searching user messages plus AI reply text
- **In-chat highlighting** — matched keywords are highlighted in the conversation; the current match is highlighted distinctly and scrolled into the upper part of the viewport; every occurrence inside a message counts toward `n/N`
- **Auto-follow highlighting** — while scrolling the conversation, the turns visible in the viewport light up in the outline (several at once) and the rest dim; the outline loads and scrolls so the group being read stays visible
- **Jumping** — click a heading to jump to its position in the conversation, or click a group header's time/preview to jump to the start of that turn
- **Dockable and resizable** — drag the top bar to move the panel, use ◀ / ▶ to dock it left or right, drag an edge or corner to resize, and collapse it into an edge handle (click it to expand); the panel's position and size are remembered
- **Paging and loading older** — the most recent groups show first; scrolling up inside the outline loads older groups
- **Markdown-aware titles** — inline markup in headings (`**bold**`, `*italic*`, `` `code` ``, `[links](url)`, `~~strike~~`) is stripped before display
- **Chat view only** — when the center column switches to another view (trajectory, context, …), the panel and its edge handle fade out
- The panel hides itself when the conversation has no headings; it adapts to the dark and light themes (the inner-shadow card follows the theme)

## Compatibility

| Plugin | Supported DSH |
| --- | --- |
| **0.3.3** (latest) | 0.1.5-rc.1 |
| 0.3.2 | ≥ 0.1.2-rc.1 |

The latest version has only been verified against **DSH 0.1.5-rc.1**, so that is the only version it declares; older DSH versions are unverified and therefore not claimed. On an older DSH, the newest usable plugin version is **0.3.2**. On install or update, the DSH market pre-flights host compatibility from `engines.dsh`, `dsh.compatibility.dshReleases` and `peerDependencies` in `package.json`.

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

- **Jumping**: click a heading in the outline to jump to its position; click a group header's time or first-line preview to jump to the start of that turn
- **Search**: click the magnifier in the header to open the search box, type a keyword and press Enter to step through matches (`n/N` shows the current position and the total); press Esc or the magnifier again to close it; use the **title / full-text** button to change the search scope
- **Moving and docking**: drag the top bar to move the panel; use ◀ / ▶ to switch between left and right docking
- **Resizing**: drag the right edge for width, the bottom edge for height, or the bottom-right corner for both
- **Loading older turns**: scroll up inside the outline to load older groups; when the conversation itself offers a "load older messages" button, the outline also triggers it on reaching the top

## Development

- `lib/client.js` — all UI logic (browser side)
- `lib/index.js` — host-side entry (empty; this plugin ships browser-side UI only)
- `cordis.patch.yml` — loader patch (official DSH bundle format)
- The panel registers into the session-scoped `conversation.input.overlay` slot so it receives session-scoped hooks (`useChat`, `useSession`, `sessionId`, …), and renders itself through `createPortal` into `document.body` as a fixed floating dock; conversation data comes from `props.useChat` (`ChatSnapshot.order` and `nodes`; node shape: `kind: user/assistant-step`, `location.turn`, `data.blocks`)
- Changes to `lib/client.js` take effect after restarting DSH

## License

MIT © 2026 LyaxZ

# dsh-quick-toc

> **English** | [中文](README.md)

A conversation TOC plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH): it turns the Markdown headings (H1–H6) of AI replies into a navigable outline panel, grouped by conversation turn, with auto-follow highlighting, keyword search and in-chat match highlighting.

## Features

- **Turn-grouped outline** — each user message plus its following AI replies form one group; the group header shows the turn's time and a first-line preview, and clicking it jumps to the start of that turn's model reply
- **Search** — the magnifier in the panel header opens a search box: title / full-text scopes, click any result row to locate and highlight that hit, `n/N` Enter stepping, Esc to close
- **In-chat highlighting** — matched keywords are highlighted in the conversation; the current match is highlighted distinctly
- **Sticky group headers** — while scrolling the outline, the current turn's header stays pinned at the top of the panel
- **Heading level filter** — the round levels button in the header pops down H1–H6 switches for any combination
- **Auto-follow** — the turn being read lights up in the outline while you scroll the conversation; the outline loads and follows on its own
- **Jumping** — click a heading to jump to its position in the conversation
- **Dockable and resizable** — drag the top bar to move the panel, ◀ / ▶ to dock left or right, drag an edge to resize, and collapse it into an edge handle; position and size are remembered
- **Paging** — the most recent groups show first; scroll up to load older turns
- **Markdown-aware** — inline markup in headings is stripped; `#` lines inside fenced code blocks are not headings
- **Theme-aware** — adapts to dark and light themes; visible on the chat view only and fades out elsewhere
- The panel hides itself when the conversation has neither headings nor readable times

## Compatibility

| Plugin | Supported DSH |
| --- | --- |
| **0.4.1** (latest) | 0.1.5-rc.1, 0.1.5-rc.2 |
| 0.4.0 | 0.1.5-rc.1, 0.1.5-rc.2 |
| 0.3.3 | 0.1.5-rc.1 |
| 0.3.0 – 0.3.2 | ≥ 0.1.2-rc.1 |

`engines.dsh` has a floor of **0.1.5-rc.1** (`>=`): from that release on, the plugin uses the host's session-scoped slot injection. Since 0.4.0 the plugin has been verified against **0.1.5-rc.1 and 0.1.5-rc.2** and declares exactly those; older or newer DSH versions are unverified and therefore not claimed. On an older DSH, the newest usable plugin version is **0.3.2**. On install or update, the DSH market pre-flights host compatibility from `engines.dsh`, `dsh.compatibility.dshReleases` and `peerDependencies` in `package.json`.

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

- **Jumping**: click an outline heading or a group header to jump to it
- **Search**: open the box with the magnifier, click a result to locate and highlight it, Enter to step through matches, Esc to close
- **Level filter**: click the round levels button in the header to pop down the H1–H6 switches
- **Moving and docking**: drag the top bar to move, ◀ / ▶ to switch sides
- **Resizing**: drag the right edge, bottom edge or bottom-right corner
- **Loading older turns**: scroll up inside the outline

## Development

- `lib/client.js` — all UI logic (browser side)
- `lib/index.js` — host-side entry (empty; this plugin ships browser-side UI only)
- `cordis.patch.yml` — loader patch (official DSH bundle format)
- The panel registers into the session-scoped `conversation.input.overlay` slot so it receives session-scoped hooks (`useChat`, `useSession`, `sessionId`, …), and renders itself through `createPortal` into `document.body` as a fixed floating dock; conversation data comes from `props.useChat` (`ChatSnapshot.order` and `nodes`; node shape: `kind: user/assistant-step`, `location.turn`, `data.blocks`)
- Changes to `lib/client.js` take effect after restarting DSH

## License

MIT © 2026 LyaxZ

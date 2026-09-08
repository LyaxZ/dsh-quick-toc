# dsh-quick-toc

> **English** | [中文](README.md)

A quick conversation TOC plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH): extracts Markdown headings (H1–H6) from AI replies into a navigable outline panel, grouped by conversation turn, with auto-follow highlighting, keyword search and in-chat match highlighting.

## Features

- **Turn-grouped outline** — each user message + its AI replies form one group, with the group's end time as the header (plus the turn's first-line preview; click it to jump to the turn start)
- **Keyword search** — a magnifier in the header opens the search box; Enter cycles matches (n/N counter), Esc closes; toggle between **title / full-text** scope
- **In-chat highlighting** — matched keywords are highlighted in the conversation; the current match gets a distinct highlight and is scrolled to the upper-middle of the viewport; every occurrence counts toward n/N
- **Auto-follow highlight** — as you scroll the conversation, the turns visible in the viewport light up in the outline (multiple at once); the outline auto-loads and scrolls to keep them visible
- **Smooth jump** — click a heading to glide to the exact heading position in the conversation
- **Dockable & resizable** — dock left or right (drag the top bar), resize from the edges/corner, collapse to a draggable edge handle; panel size/position remembered
- **Paged rendering** — shows the latest groups first; scrolling to the top of the outline loads older ones
- **Markdown-aware titles** — inline `**bold**`, *italic*, `` `code` ``, `[links](url)`, `~~strike~~` are stripped from heading text
- Auto-hides when the conversation has no headings; works in light/dark themes; the inner-shadow card look adapts to the theme (white bevel in dark)

## Compatibility

| Plugin | DSH |
| --- | --- |
| **0.3.0** | **≥ 0.1.2-rc.1** (new slot architecture) |
| 0.2.2 | DSH versions before 0.1.2-rc.1 |

0.3.0 re-targeted the host integration (new slot architecture + `useChat` session data) and **only supports DSH 0.1.2-rc.1 and above**; for older DSH builds install 0.2.2. On install/update the DSH market pre-flights host compatibility from `dsh.compatibility.dshReleases` and `peerDependencies` in package.json and warns on a mismatch.

## Install

With the DSH CLI (published on npm — name only):

```
dsh plugin --profile web add dsh-quick-toc
```

or from GitHub:

```
dsh plugin --profile web add github:LyaxZ/dsh-quick-toc
```

or, for a local checkout:

```
dsh plugin --profile web add <path-to-this-folder>
```

Restart DSH (double-click `restart-dsh.bat` on Windows) and open the Web UI. The outline is collapsed by default — click the small edge handle on the left side of the conversation to expand it.

## Usage

- Click a heading in the outline to jump to that heading in the conversation
- Drag the top bar to move the panel; use the **◀ / ▶** button to dock left/right
- Drag the right edge (width), bottom edge (height) or the bottom-right corner (both) to resize
- Scroll the outline to the top to load older groups

## Development

- `lib/client.js` — all UI logic (browser side)
- `lib/index.js` — host-side no-op entry (extend with a version gate if needed)
- `cordis.patch.yml` — loader patch (official DSH bundle format)
- **Since 0.3.0 the plugin targets the new plugin model**: the panel registers into the session-scoped `conversation.input.overlay` slot (session hooks are contributed via `ctx.uiSession.provide`, `useChat` by ui-chat), and the panel body `createPortal`s to `document.body` as a fixed floating dock; data comes from `props.useChat` (`ChatSnapshot.order` + `nodes`; node shape: `kind: user/assistant-step`, `location.turn`, `data.blocks`)
- Client changes need a DSH restart (boot rev is content-based)

## License

MIT © 2026 LyaxZ

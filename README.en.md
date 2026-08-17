# dsh-quick-toc

> **English** | [中文](README.md)

A quick conversation TOC plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH): extracts Markdown headings (H1–H6) from AI replies into a navigable outline panel, grouped by conversation turn, with auto-follow highlighting.

## Features

- **Turn-grouped outline** — each user message + its AI replies form one group, with the group's end time as the header
- **Auto-follow highlight** — as you scroll the conversation, the turns visible in the viewport light up in the outline (multiple at once); the outline auto-loads and scrolls to keep them visible
- **Smooth jump** — click a heading to glide to the exact heading position in the conversation
- **Dockable & resizable** — dock left or right (drag the top bar), resize from the edges/corner, collapse to a draggable edge handle; panel size/position remembered
- **Scrollbar follows the dock** — scrollbar sits on the left when docked left, right when docked right
- **Paged rendering** — shows the latest groups first; scrolling to the top of the outline loads older ones
- **Markdown-aware titles** — inline `**bold**`, *italic*, `` `code` ``, `[links](url)`, `~~strike~~` are stripped from heading text
- Auto-hides when the conversation has no headings; works in light/dark themes

## Install

With the DSH CLI:

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
- `lib/index.js` — host-side no-op entry
- `cordis.patch.yml` — loader patch (official DSH bundle format)
- Client changes hot-load after a browser hard refresh; loader/patch changes need a DSH restart

## License

MIT © 2026 LyaxZ

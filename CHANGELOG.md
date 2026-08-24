# Changelog

All notable changes to **dsh-quick-toc** are documented here.

## [0.2.0] - 2026-08-19

### Added
- Keyword search: header magnifier button opens a search box; Enter cycles through matches (n/N counter); Escape or the magnifier toggles it closed
- Search scope toggle: 标题 (heading titles only) or 全文 (also user messages and AI reply texts)
- In-chat match highlighting: matched keywords are highlighted in the conversation; the current match gets a distinct highlight and is scrolled to the upper-middle of the viewport
- Every occurrence counts toward n/N (multiple hits in one message = multiple matches)
- Heading-less turns get a standalone time entry; all group headers show the turn's first-line preview next to the time (click to jump)

### Changed
- Panel collapse animation unified for both docks: clip-path hides the panel at the sidebar/screen edge (shadow removed to avoid clipping artifacts)
- Inactive outline groups dimmed to 0.6 opacity

## [0.1.1] - 2026-08-17

### Changed
- Release workflow also uploads a stable-named tarball (`dsh-quick-toc.tgz`) so `/releases/latest/download/` always resolves to the newest release

## [0.1.0] - 2026-08-17

### Added
- Turn-grouped outline: each user message + its AI replies form one group, with the group's end time as the header
- Auto-follow highlight: turns visible in the conversation viewport light up in the outline (multiple at once); the outline auto-loads and scrolls to keep them visible
- Smooth jump: clicking a heading glides to the exact heading position in the conversation (with a small top offset)
- Dock left/right with a draggable top bar, resizable from the edges/corner, collapsible into a draggable edge handle
- Scrollbar follows the dock side (left when docked left, right when docked right)
- Paged rendering: latest groups first; scrolling the outline to the top loads older groups
- Auto "load older": when the outline reaches the top with everything loaded, it clicks the conversation's own load-more button
- Header time jump: clicking a group's time label jumps to that turn's start
- Markdown-aware titles: `**bold**`, `*italic*`, `` `code` ``, `[links](url)`, `~~strike~~` stripped from heading text
- Persisted panel state (dock side, position, size) with automatic migration from older key names
- Auto-hides when the conversation has no headings; light/dark theme support

### Published
- npm: `dsh-quick-toc@0.1.0`
- GitHub: `LyaxZ/dsh-quick-toc` with auto-release workflow (tag push -> npm pack -> release asset)

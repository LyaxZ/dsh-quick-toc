# Changelog

All notable changes to **dsh-quick-toc** are documented here.

## [0.1.0] - 2026-08-17

### Added
- Turn-grouped outline: each user message + its AI replies form one group, with the group's end time as the header
- Auto-follow highlight: turns visible in the conversation viewport light up in the outline (multiple at once); the outline auto-loads and scrolls to keep them visible
- Smooth jump: clicking a heading glides to the exact heading position in the conversation (with a small top offset)
- Dock left/right with a draggable top bar, resizable from the edges/corner, collapsible into a draggable edge handle
- Scrollbar follows the dock side (left when docked left, right when docked right)
- Paged rendering: latest groups first; scrolling the outline to the top loads older groups
- Auto "load older": when the outline reaches the top with everything loaded, it clicks the conversation's own load-more button
- Collapsible groups: click a group header to fold/unfold its headings; clicking the header time jumps to that turn's start
- Markdown-aware titles: `**bold**`, `*italic*`, `` `code` ``, `[links](url)`, `~~strike~~` stripped from heading text
- Persisted panel state (dock side, position, size) with automatic migration from older key names
- Auto-hides when the conversation has no headings; light/dark theme support

### Published
- npm: `dsh-quick-toc@0.1.0`
- GitHub: `LyaxZ/dsh-quick-toc` with auto-release workflow (tag push -> npm pack -> release asset)

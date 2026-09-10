# Changelog

All notable changes to **dsh-quick-toc** are documented here.

## [0.3.1] - 2026-09-08

### Fixed
- Panel and collapsed edge handle no longer float above DSH modals: the base z-index is now 500 (above app popovers at z 100 and the transcript width handles at z 8, but below DSH's modal layer at z 1000), so opening Settings covers the outline instead of the outline sitting on top of it.
- Circular controls are true circles again on DSH 0.1.5-rc.1: the theme applies `corner-shape: superellipse(1.5)` to every element, which turned `border-radius: 50%` into a squircle. The icon buttons, search-scope toggle, top drag bar and edge handle now declare `corner-shape: round`.

### Changed
- Compatibility declaration also lists DSH `0.1.5-rc.1` (verified compatible; `engines.dsh` stays `>=0.1.2-rc.1`).

## [0.3.0] - 2026-08-24

### Fixed
- **DSH 0.1.2-rc.1 compatibility**: the removed `@deepseek-ai/dsh-client-runtime` package no longer breaks plugin loading (externals drift). Runtime hooks now arrive as session-scope slot props.
- Conversation data access moved from `useSession(s => s.chat.*)` to the session-scope `useChat` hook (`ChatSnapshot.order` + `nodes` map, contributed by `dsh-client-ui-chat`). Node shape unchanged (`kind: user/assistant-step`, `location.turn`, `data.blocks`), so grouping / search / highlight / jump logic is untouched.
- Panel mount moved into the session-scoped `conversation.input.overlay` slot. In 0.1.2-rc.1 session-scoped hooks only reach a declared *session* slot; a frame-floating `shell.overlay` occupant's `SessionProvider` binds to the root binding (no session id) and rendered the panel slot empty. The panel still draws its own fixed, frame-floating dock (position: fixed), so the overlay seat is only the hook source.

### Changed
- `dsh.client.inject` now lists `dsh-client-ui-chat` / `dsh-client-ui-conversation` / `dsh-client-ui-layout` instead of the removed runtime package.
- Dropped the unused `sessions` service from the client inject list.

### Added
- Version guard: `dsh.compatibility.dshReleases` declares `0.1.2-rc.1: compatible` and `engines.dsh: ">=0.1.2-rc.1"` (dshmarket install-time host-compat preflight); peerDependencies pin `dsh-client-ui-chat` / `dsh-client-ui-conversation` `>=0.1.2-rc.1`. The panel degrades gracefully with a console warning when the `chat` hook is unavailable (older hosts).

## [0.2.2] - 2026-08-24

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

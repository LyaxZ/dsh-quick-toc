# Changelog

All notable changes to **dsh-quick-toc** are documented here. Chinese version: [CHANGELOG.md](CHANGELOG.md).

## [0.7.3] - 2026-09-23

### Changed
- **Compatible with DSH 0.1.5-rc.3 and 0.1.7-alpha.2**: both new releases were exercised point by point (the panel and the curtain, row jumps and older-history loading, the title/full-text/cross-session searches, switching sessions from a cross-session hit, the configuration card, and the settings document's reads and writes) with no code change needed; the compatibility declaration and the README's compatibility table follow.
- The implementation notes now cover both host lines: the settings service and the configuration-card slot are each described for the rc line and for the alpha line (previously only the rc one was written down).

## [0.7.2] - 2026-09-22

### Added
- **Curtain scale**: the settings card gains a "Curtain scale" slider (50%-200%, 5% steps) that scales the text, icons and buttons inside the curtain while the curtain's own size stays as it is; it is independent of the panel scale. The curtain's content starts one notch smaller than before — 100% on the slider is 90% of the previous size.
- **DSH 0.1.7-alpha.1 support**: one installed package now works on both 0.1.5-rc.x and 0.1.7-alpha.x, using whichever settings interface, configuration-card slot and session-switch call the running host actually offers; tested on both 0.1.5-rc.2 and 0.1.7-alpha.1.

## [0.7.1] - 2026-09-19

### Added
- **A "back to where I scrolled to" floating button**: closing the panel or the curtain records the row at the top of the list, and opening that surface again shows an upward button in the upper-right corner that returns to it. The two surfaces record separately, and the button disappears after one use or once the list is scrolled back there.

### Changed
- **Opening the panel or the curtain puts the row being read at the top of the list** (previously only the curtain did this, and the panel showed the position last left in it).
- **The panel's collapse and expand animate a position offset** instead of reflowing the whole panel frame by frame, so the collapse animation no longer distorts in long sessions.
- **The top icons' geometry and line weight are adjusted**: the curtain button is a horizontal rectangle with a downward arrow, the level filter and "questions only" lines are heavier, and the ✕ and magnifier no longer shift their icon to compensate.
- The "remember reading position" and "auto-load history" rows in the settings card no longer show a description.

### Fixed
- **Loading older history is slow**: an unloaded placeholder row in view now loads that turn in one step, and pages are pulled one at a time only near the prefetch range; a loading state is no longer misreported as the earliest message.
- **The view is pulled back when older history loads while scrolling up**: height compensation completes in the same frame as the content change, anchors on the first loaded row in view, and also covers pages the host loads itself.
- **The panel becomes sluggish after a while**: auto-follow no longer measures every message in the session.
- **Loading older history moves the middle conversation upward**: the conversation area is no longer lifted before paging.
- **One upward scroll can load several pages in a row**: the prefetch test now starts from the nearest placeholder row in view and includes hysteresis.
- **The curtain opened with the list slightly above the end, upward jumps landed inaccurately, and opening scrolled down from the top**: these now follow one rule, with the row being read aligned to the top of the list instantly.
- **The top droplet kept a visible sliver when pressed fully down and then disappeared at once**: pressing it fully down now sinks it into the divider line.

## [0.7.0] - 2026-09-19

### Added
- **A full-width "curtain" outline**: a droplet handle in the tab strip at the top of the conversation expands the outline across the full width below the tab strip, at the remaining height of the conversation area, with rounded lower corners and without covering or dimming the conversation. Clicking any row, pressing Esc or using the ✕ at the upper right collapses it, and the "curtain" round button in the panel header is another entry point. It moves the panel itself into the container, so paging, search, hover previews, the keyboard cursor and the reading position are all the same set.
- **Wide typography in the curtain**: a row has three parts, a level badge, a larger heading and the opening of that section's body, and the level filter lays out on one line. Clicking the magnifier expands the search column from the right.
- **A "jump to the end of this section" button on each row**: with the pointer on a heading row, a group header or a search result, a round button appears at the right end and jumps to the end of that section (a heading row stops before the next heading of the same or higher level, a group header at the end of the turn).
- **Cross-session search**: a third search scope, "sessions", searches other sessions' bodies through the host's full-text index (bodies only, at most 20 hits at a time); clicking a result switches to that session and continues the search there. Sessions that cannot be opened are skipped and counted, and a host without the index says so.
- **A remembered reading position per session** (on by default): reopening a session returns to the turn read last, and the record carries a seq so the turn is loaded automatically when it is outside the conversation window. The position is stored on this machine only and is not restored after half an hour.
- **Keyboard navigation**: ↑/↓ move the cursor through the outline, Enter activates the current row, Home / End go to the first and last rows and Esc collapses the panel; it works right after clicking anywhere in the panel, with no Tab needed.
- **Questions only**: a speech-bubble button in the header folds the outline down to each turn's time and the first line of the prompt; the switch cross-fades, and the level filter is unavailable while it is on.

### Changed
- **The collapsed edge handle slides in along the edge**: expanding fades the handle out first and then slides the panel in, and collapsing slides the handle back clipped by the edge.

### Fixed
- **The panel no longer covers other plugins' overlays**: the layers sit in a gap in the application's stacking order (handle 12, panel 14, curtain 16, hover preview 18), above the conversation content but below host and plugin overlays.

## [0.6.3] - 2026-09-15

### Fixed
- **The configuration card's expand arrow does not match the host's**: the text character `⌄` used before is thinner than the host's 14×14 icon and shifts position when rotated; it is now the host's inline SVG arrow, flipping around its own centre.

## [0.6.2] - 2026-09-15

### Added
- **A vertical position for the collapsed handle**: the settings card gains a slider (0%–100%, 1% per step) that decides the handle's height in the conversation area once the panel is collapsed: 0% at the bottom, 100% at the top, 50% by default.

### Changed
- **Writing a default value counts as "not customized"**: a field returned to its default leaves the settings user layer, and its "customized" and reset marks disappear.

### Fixed
- **A panel size sometimes cannot be saved**: the size write is debounced by 0.4 seconds while the ledger was marked when the write started, so a second adjustment within 0.4 seconds cancelled the pending write and that size was never saved again. The ledger is now marked only when the write happens.
- **A small panel size cannot be saved**: the read-back floor (180×160) did not match the drag floor (120×60); both are now 120×60.
- **The first height drag jumps while the height is "auto"**: the drag starts from the panel's measured height.

## [0.6.1] - 2026-09-15

### Added
- **A panel scale slider**: the settings card gains "Panel scale" (50%–200%, 5% per step), scaling the panel's content while the panel's own size stays as dragged. Dragging updates the readout only, and the setting is written when the pointer is released.
- **A header for narrow panels**: the four buttons stay on one line, the empty middle gives way first, and once the row is full it scrolls sideways while the grey grab bar above fades out.

### Changed
- **The jump animation goes back to the browser's own smooth scrolling**, advanced on real time so its duration is the same on 60Hz and 240Hz screens; the target is re-aimed when it moves mid-flight or the animation is interrupted, and frame-by-frame drawing remains only for a browser that executes the call as an instant jump.
- **Panel size limits are removed**: only the floor of 120px wide / 60px high, still enough to drag the panel back, remains.

### Fixed
- **Long jumps are too fast on a 240Hz screen**: the old animation was timed in frames, only about 190ms at 240Hz; it is now timed on real time and independent of the refresh rate.
- **The panel returns to its original size after being dragged**: changes sent out and changes adopted from outside shared one ledger, so a settings write during a drag pulled the panel back with a not-yet-saved value. The two paths are now accounted separately.

## [0.6.0] - 2026-09-14

### Added
- **A bilingual interface**: the language setting offers "follow the host" (default), `中文` and `English`; Chinese timestamps keep the Chinese forms (昨天 / 前天), and English uses `yesterday` and a date form.
- **A plugin configuration card**: the "Conversation Outline" card under **Settings → Plugins → Plugin configuration** manages the language, default docked edge, heading levels shown, fuzzy search, hover preview and diagnostic switch in one place; changed fields are marked "customized" with an individual reset.
- **The panel and the card stay in sync in real time**: both read and write the same preferences, so a change on either side takes effect on the other without a reload.
- **Preferences are saved to DSH settings**: they are written to the host settings document, with a local mirror for pages that cannot write settings; local values from 0.5.x are imported once when the host layer first answers.

### Changed
- **Long jumps have their animation back**: drawn frame by frame by the plugin and timed by duration rather than frames, re-aiming at the target every frame and re-checking the landing briefly, so a cross-page jump no longer stops halfway.
- **The outline fills a taller panel**, leaving no blank space below the newest group.
- **The "currently reading" blue box fades in and out over 0.4 seconds.**
- **Top offset, width and height leave the settings** and can only be adjusted by dragging.
- **Preference writes are merged**: instead of writing on every pointer move, changes are merged and saved after a short delay; the diagnostic switch moves into the settings card and prints as soon as it is on.

### Fixed
- **The panel crashes in some conversations (React #310)**: the number of hooks differed between renders, taking the panel and its slot down; it is now split into a hook-free outer guard and an inner component.

## [0.5.1] - 2026-09-13

### Added
- **A "back to the bottom" floating button**: it appears while the list is not at the bottom, returns to the newest row when clicked and hides once the bottom is reached.
- **Turn times carry a date**: yesterday and the day before are labelled as such together with the time, and anything older shows `YY-MM-DD HH:MM`, decided by calendar day.
- **Errors from failed turns are shown**: turns such as request timeouts or upstream errors show a `Request failed` row with the host's error text under the group header; clicking it jumps there, and the error text is searchable.

### Changed
- **The header now has two buttons per side** (left: level filter and dock toggle; right: search and collapse), and the three-bar mark on the left is gone.
- **The level filter popup is left-aligned with its button.**
- **The mount diagnostic log is silent by default**; set `dsh-quick-toc.debug` to `1` and reload to print it.
- **Long jumps land instantly**, with a brief check after landing.

### Fixed
- **Failed or aborted turns are mislabelled as "Not loaded"**: these turns now count as loaded, and a failed turn also shows its error row.
- **Loading earlier messages from the outline brings the conversation back to the newest turn**: the conversation is moved out of the stick-to-bottom zone before paging.
- **A heading-less turn's group header is formatted unlike the other group headers**: all group headers now share one style.

## [0.5.0] - 2026-09-12

### Added
- **A whole-session turn index**: with the host projection the outline covers the entire session, unloaded turns carry a "Not loaded" mark and the host's preview, and clicking one loads that turn and scrolls to it.
- **Row subtitles**: the first sentence of each section's body is shown under the heading, so headings with the same title can be told apart.
- **Hover previews**: with the pointer on a heading row for about 0.26 seconds a card appears with the title, time, heading path and the section's opening, on the left when the panel is docked right.
- **Search normalization (always on)**: differences in letter case, full-width and half-width forms and whitespace count as the same match.
- **A "fuzzy" switch**: a query also matches keywords with a little other text in between, and the state is remembered.
- **Unloaded turns are searchable too**: full-text search also covers their preview text.
- **Edge hints**: the search results say that earlier messages can be loaded, and scrolling past the oldest or newest point flashes a hint at the bottom of the panel for about 2.6 seconds.

### Changed
- **Auto-follow tracks more promptly**: the artificial delay is gone, positioning is instant and the highlight transition is shorter; following no longer depends on the scroll container captured at mount, listening on the document in the capture phase and re-querying on every run.
- **The turn being read is marked with a closed blue box**, the other turns are dimmed less, and the panel's idle opacity is raised to 0.72.
- **A heading-less turn's time row is promoted to body-level font size and weight.**
- **Active-state colours are unified into a single colour source.**
- **The "load earlier" trigger on upward scrolling is throttled**, avoiding repeated paging.
- **Interface strings are unified into one string table**, preparing for the later bilingual interface.

### Fixed
- **After jumping with the turn rail beside the conversation, the outline no longer follows or lights up** (the scroll listener was bound to a container that had been replaced): it now listens on the document in the capture phase and re-queries the container.
- **A turn with no Markdown headings is not marked as "currently reading"** (the map only registered messages that carry headings): every node of the turn is now registered.

## [0.4.0] - 2026-09-11

### Added
- **A search result list**: with a query present the outline switches to a result list (highlighted heading, heading path, turn time, repeat count, plus a snippet in full-text scope) with the newest hit at the bottom, and clicking a row makes that hit current, highlighting and scrolling to it in the conversation; Enter stepping through `n/N` remains.
- **Sticky group headers**: the current turn's group header is pinned to the top of the panel.
- **A collapsible level-filter row**: the "levels" button in the header hides and shows the `1`–`6` row.
- **A position breadcrumb**: the top of the panel shows the path of the section being read, and clicking it jumps there.
- **A heading level filter**: the `1`–`6` chips are independent and can be combined freely; switching all of them off restores all six levels.

### Changed
- **Performance**: heading parsing and text extraction are cached per node, so a streaming update recomputes only the nodes that changed.
- The group header (time row) click now jumps to the start of that turn's model answer.
- Compatibility with DSH `0.1.5-rc.1` and `0.1.5-rc.2` is declared.
- `countOccurrences` gains an empty-query guard.

### Fixed
- **The first load does not locate the newest turn**: the effect's dependencies were written before its declaration, so it ran only once.
- **The position recorded after dragging the top bar is the one from before the drag**, and the panel returns to its old place after a reload.
- **A second hit inside the same text node is not highlighted**, and jumping to it scrolls without highlighting.
- **`#` lines inside fenced code blocks are treated as headings**, shifting the numbering of the real headings after them.

## [0.4.1] - 2026-09-12

### Changed
- **The level filter becomes a popup**: a round button in the header opens an H1–H6 picker from the button's centre that shrinks back and fades when closed, so it no longer occupies a row of its own.
- The position breadcrumb row at the top of the panel (added in 0.4.0) is removed.

## [0.3.3] - 2026-09-10

### Added
- When the middle column switches to another view, the outline panel and the edge handle fade out, and they fade back in on the conversation view.

### Changed
- Compatibility is declared for DSH `0.1.5-rc.1` only.
- The README adds notes on search and jumping, and the compatibility table lists the supported DSH version of the last two releases.
- The changelog is split into Chinese and English files, and release descriptions take the Chinese section by default with the English one folded below.

## [0.3.2] - 2026-09-08

### Changed
- Documentation pass: the README's compatibility table and feature list are updated, and the npm description mentions keyword search and in-chat highlighting.

## [0.3.1] - 2026-09-08

### Fixed
- The panel and the collapsed handle no longer float above DSH overlays (z-index set to 500).
- Circular controls are true circles again on DSH 0.1.5-rc.1, whose theme's `corner-shape` turns a 50% radius into a rounded square corner.

### Changed
- Compatibility declarations now include DSH `0.1.5-rc.1`.

## [0.3.0] - 2026-08-24

### Fixed
- Compatibility with DSH 0.1.2-rc.1: loading no longer fails because `dsh-client-runtime` was removed, and runtime hooks are injected through the props of the session-scope slot.
- Conversation data access moves from `useSession` to the session-scoped `useChat`.
- The panel mounts into the session-scoped `conversation.input.overlay` slot, fixing a child slot that always rendered empty.

### Changed
- `dsh.client.inject` now lists `dsh-client-ui-chat` / `-conversation` / `-layout` instead of the removed runtime package.
- The unused `sessions` service is removed from the client inject list.

### Added
- Version guard: `dsh.compatibility.dshReleases` and `engines.dsh` are declared for the market's install-time compatibility preflight, the related DSH packages are constrained with peerDependencies, and the panel degrades gracefully when the `chat` hook is unavailable.

## [0.2.2] - 2026-08-24

### Added
- Keyword search: the magnifier opens a search box, Enter steps through matches with an `n/N` counter, and Esc or a second click on the magnifier closes it.
- A search scope switch: headings only, or user messages and AI reply text as well.
- In-chat highlighting: matched keywords are highlighted in the conversation, and the current match is marked separately and scrolled to the upper middle of the viewport.
- Every occurrence within one message counts towards `n/N`.
- A heading-less turn also gets its own time entry, and all group headers show that turn's first-line preview.

### Changed
- The collapse animation is the same for both docks (clipped along the sidebar or screen edge, shadow removed).
- Inactive outline groups are dimmed to 0.6 opacity.

## [0.1.1] - 2026-08-17

### Changed
- The release process also uploads a stably named tarball (`dsh-quick-toc.tgz`), so that `/releases/latest/download/` always points to the newest version.

## [0.1.0] - 2026-08-17

### Added
- A turn-grouped outline: each user message and the AI replies that follow it form one group, and the group header shows the group's end time.
- Auto-follow highlighting: turns inside the conversation viewport light up in the outline, and the outline scrolls to keep them visible.
- Smooth jumps: clicking a heading scrolls smoothly to that heading's place in the conversation.
- Dock left or right, drag to resize, and collapse into an edge handle.
- The scrollbar follows the dock side, left when docked left and right when docked right.
- Paged rendering: the newest groups are shown by default, and scrolling up loads older groups.
- Automatic "load earlier": at the top with everything loaded, the outline clicks the conversation's own load button.
- Group header time jump: clicking the time label jumps to the start of that turn.
- Markdown-aware headings: `**bold**`, `*italic*`, `` `code` ``, `[links](url)` and `~~strikethrough~~` are stripped.
- Panel state (dock side, position, size) is persisted, with automatic migration from older key names.
- The panel hides itself when the conversation has no headings, and light and dark themes are supported.

### Published
- npm: `dsh-quick-toc@0.1.0`
- GitHub: `LyaxZ/dsh-quick-toc`, with an automatic release workflow (push a tag, npm pack, release asset).

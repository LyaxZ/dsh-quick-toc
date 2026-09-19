# Changelog

All notable changes to **dsh-quick-toc** are documented here. Chinese version: [CHANGELOG.md](CHANGELOG.md).

## [0.7.1] - 2026-09-19

### Added
- **A "back to where I scrolled to" button**: the outline already carried a "back to the newest row" button in the list's lower-right corner whenever it was not at the bottom; there is now a matching round button in the upper-right corner, arrow pointing up, that takes you back to **the row you were looking at when you left that surface**. The place is recorded **at close time**, and the docked panel and the curtain **keep their own** — neither overwrites the other. Reopening the surface is what lights the button up, and it returns that row to **where it sat** — if it was clipped by the viewport's top edge (which is what happens when the list is parked at the bottom), it goes home clipped by the same amount instead of being forced to the very top. Using the button once — or scrolling back there yourself — fades it out and forgets that record until the next close. It is placed from the list's measured start inside the surface, so neither the docked panel's grip bar and header row nor the curtain's own toolbar can sit on top of it, and it grows to 34px with the curtain.

### Changed
- **Opening the panel or the curtain now lands on the row being read**: only the curtain did this before, while the panel simply showed wherever the list had last been left, so the two surfaces disagreed. One rule now: the turn currently being read is aligned to the top of the list, instantly. When that turn is one of the newest few the list is already at its end, so the row lands at the bottom — no clamping is involved.
- **The panel's collapse and expand animation now uses `transform`**: it used to transition `left` (a layout property, so the whole panel — grip bar, header and every rendered outline row — was re-laid out on each frame) together with `clip-path`. On a long session the main thread could not keep up with the compositor, so collapsing turned into "a line sweeps across and the content it passes disappears" instead of the panel sliding away. The box now always sits parked at its collapsed spot and the open state is a transform on top of it: the visual geometry is unchanged, and the animation no longer slows down with the size of the list.
- **Toolbar icon geometry calibrated**: the curtain button is a 12×9 landscape rectangle (centred on both axes) instead of a portrait slab, with its arrow pointing down and its tail landing on the rectangle's top edge; the level filter's three lines are heavier (2.2); the questions-only bubble keeps the same 2.2 outline and is slightly larger and a touch lower (the bubble is the visual body and the tail hangs off its lower left, so geometric centring reads as top-heavy); the ✕ and the magnifier drop their old 1px translate nudge in favour of geometry drawn exactly on centre — a nudge is half a pixel off at any other size.
- The "remember reading position" and "auto-load history" rows in the settings card no longer carry a description.

### Fixed
- **Paging through history "never caught up"**: once the reader reached the unloaded region, the auto-loader kept crawling at 50 messages per page every 130ms, so in a deep gap they were already there while the rows were still being filled in. There are now two paths: when a "not loaded" placeholder is actually in view, that turn's seq is paged in one hop (carrying an extra 8 rows of margin towards older history); only while merely approaching the prefetch band does it pull one page at a time. The same area held a misreading — the host's "load earlier" button is disabled while a page is in flight, and the plugin read "loading" as "reached the beginning", announcing "this is the oldest message" hundreds of turns early.
- **The view being pushed away while loading, and "turning auto-load off still bounced"**: a placeholder row grows taller when it loads, pushing everything below it down. The compensation used to run inside `requestAnimationFrame` (one or two frames after the DOM change — the "jumps and springs back" the reader saw) and only covered loads the plugin itself started, so a page the host paged in had none at all. It now runs in a layout effect (same frame as the DOM change, before the browser paints), anchors on the **first real row** in view (the placeholders are exactly what grows, so anchoring below them is what lets new content grow upward out of the viewport), and the list carries `overflow-anchor: none` — the browser's own scroll anchoring also rewrites `scrollTop` for the same growth, and the two together push the content up.
- **"It janks every so often / the longer it runs the slower it gets"**: the auto-follow read `getBoundingClientRect` for **every** message in the session on each pass — thousands of them, a dozen times a second — so the work grew with the length of the session. The node list is now cached and only re-scanned when the container or its end keys change, and the scan interval widens while the panel is collapsed.
- **Auto-loading nudged the middle conversation upward**: before each page it lifted the conversation 26px out of the host's stick-to-bottom zone (0.5.1 added that so the host would not re-pin history paged in from the outline), but it did so on every page — the reader only touched the outline and saw the conversation move. The host side now relies on the outline's own quiet window, and the lift is gone entirely.
- **One upward scroll could pull several pages**: the prefetch test measured the "loaded / not loaded" boundary row, which by definition sits against the viewport's top edge, so the condition was always true. It now measures from the nearest placeholder in view, with hysteresis.
- **Opening the curtain left the list a little above the end and then walked it down; upward jumps landed inaccurately; opening scrolled down from above**: the follow **centred** the row being read, and for the newest turn the centred position lies past the end of the list, so it stopped half a viewport short; `revealGroupInOutline` used `scrollIntoView({ block: "nearest" })`, which scrolls the minimum distance (so the landing point was arbitrary) and animates. Both now share one rule — **that row goes to the top of the list, instantly**.
- **The droplet stayed a little thick when pressed flat and then vanished a beat later**: the press ended at `scaleY(0.12)`, leaving about 2px of a 17px dome sitting on the strip, while the handle was not removed for another 220ms and its fade-out was deliberately delayed by 0.2s — so those 2px sat motionless for a beat and then the whole thing disappeared. Both ends are `scaleY(0)` now: pressed flush into the strip, and growing from zero on the way back.

## [0.7.0] - 2026-09-19

### Added
- **A full-width "curtain" outline**: the view-tab strip along the top of the conversation now carries a droplet handle (half-transparent at rest, solid under the pointer, its base resting on the strip's lower line) — click it and the outline drops down across the full width of the conversation area. Its height is 82% of what is left of the conversation (at least 240px, at most 760px), its top edge meets the tab strip and its lower corners are rounded; there is no scrim and nothing underneath is dimmed, so the newest message and the composer stay reachable below it. Closing: click any row, press Esc, or use the ✕ in the upper-right corner; the "curtain" round button in the panel's header is the other way in. **It is not a second list** — the curtain is the panel itself moved into that container, so paging, search results, hover previews, the keyboard cursor and the reading position are all the same ones; switching from the panel to the curtain loses no state.
- **Wide typography inside the curtain**: each row becomes three parts — the `H1–H6` level badge on the left, a larger heading in the middle, and the opening of that section in small type on the right; the level filter lays itself out on one line. The magnifier pushes the search column in from the right (360px), the outline column gives way to the left, and results land in that right column.
- **A "jump to the end of this section" button on every row**: with the pointer on a heading row, a group header, a search result or a curtain row, a round button fades in at that row's right end (always mounted, only its opacity changes, so nothing is pushed around or reflowed) — clicking it jumps to the end of that section's content: a heading row lands just before the next heading of the same or a higher level, and a group header lands at the very bottom of the whole turn (the end of the model's last reply). Every hover highlight stops 32px short of the row's right edge, leaving a constant 8px to the round button, so a long heading never runs into it.
- **Cross-session search**: the search-scope button now has three steps: title → full text → sessions. The third uses the host's session full-text index to search the message bodies of **other sessions** (bodies only; the fuzzy switch does not apply to it, and the host returns at most 20 hits); clicking a result switches to that session and keeps looking for the same keyword there. Only sessions that can be opened right now are listed — archived ones, subagent sessions and sessions no longer in the list are skipped, with the number of skipped hits reported underneath, and a host without the full-text index enabled says so instead of failing silently.
- **A remembered reading position per session** (on by default in the settings card): reopening a session returns to the turn you were last reading. The position is stored in this browser only, and only resumes within half an hour (anything older opens at the newest turn). The record carries its seq, so that turn is paged back in even when it is no longer in the conversation window; when it genuinely cannot be reached (the host says there is no older history) the record is dropped silently, with no banner.
- **Keyboard navigation**: ↑/↓ move a visible keyboard cursor through the outline (an inset outline plus a light fill, deliberately distinct from the reading position's blue box), Enter activates the current row (jump / load an unloaded turn / switch session), Home / End go to either end, and Esc collapses the panel (Esc inside the search box closes the search first). After clicking anywhere in the panel (an input excepted) ↑/↓ work straight away — no need to Tab in first — and the cursor's position is announced to screen readers.
- **Questions only**: a speech-bubble button in the header folds the outline down to each turn's time and the first line of your own prompt, which makes "what did I actually ask" easy to find among long replies. The switch cross-fades, and while it is on the level filter is disabled (there are no heading rows); turning it off restores the previous level selection.

### Changed
- **The collapsed edge handle now slides into the edge**: expanding it fades the handle out first and slides the panel in afterwards (no longer both at once), and collapsing slides the handle back behind the edge line, clipped by it, instead of vanishing out of nowhere.

### Fixed
- **No longer covering other plugins' overlays**: the panel and the handles used to lift themselves above almost everything with a flat `z-index: 500`, which measurably covered community plugins' own popovers (the context plugin's cards sit at 200, for instance). They now move into the one gap in the application's stacking order — edge handle 12, docked panel 14, curtain 16, hover preview 18: above the conversation content (and it has to be above the transcript width grip at 8, or that 40px-wide transparent grab column steals the pointer along the panel's edge), but below everything that calls itself an overlay in the host or in a plugin (layout overlays at 20, better-sidebar at 25, cordis at 30, host popovers from 100 up).

## [0.6.3] - 2026-09-15

### Fixed
- **The configuration card's expand/collapse chevron did not match the host's arrows**: it was a text character (⌄), thinner than the host's 14×14 SVG chevron icon, and the glyph's ink is not centred inside its 20px line box — the rotation turned around the box centre, so the glyph swung aside instead of flipping in place. It is now the host's own 14×14 SVG chevron (an inline SVG whose path is byte-identical to the icon the host uses, with the class on the `<svg>` itself — the same structure as the host's plugin card), so expanding and collapsing flip it around the icon's own centre.

## [0.6.2] - 2026-09-15

### Added
- **A vertical position for the collapsed handle**: the card gains a "Handle position" row — a **0%–100% slider in 1% steps** that decides where the edge handle sits vertically once the panel is collapsed: `0%` at the bottom, `100%` at the top, and `50%` (the previously fixed centred spot) by default. The handle follows that height on whichever edge the panel is docked to.

### Changed
- **Writing a default value back means "not customized"**: as soon as a card field is back at its default (a slider returned to the default step, a switch returned to its default state, the level set back to the default selection), the entry leaves the document's user layer — the "customized" badge and that field's "Reset" go with it, exactly as if it had never been changed. 0.6.1 and earlier pinned the default into the settings document and kept the badge.

### Fixed
- **A panel size could fail to reach storage**: the size write is debounced by 0.4s, and the "already published" record was advanced the moment a write was scheduled — so a second adjustment inside that window (dragging the height, dragging the top bar, toggling a level or the fuzzy switch) cancelled the pending write while the record already counted it as published, and that size was never written again. Measured: drag the width 200 → 150 and then drag the height, and the stored width stayed 200 — the next load brought the panel back 200px wide. The record now advances only when the write really happens, and a cancelled write is issued again on the next pass.
- **A narrow or short panel's size was stored in vain**: the limits used when reading a size back disagreed with the drag limits — dragging allows 120px wide and 60px high, but anything under 180px wide / 160px high was discarded as invalid on the next load, dropping the panel back to the default width. Both sides now share the same floors (120px / 60px).
- **The first height drag jumped while the height was "auto"**: the drag started from a fixed 400px guess, so a panel that was in fact taller or shorter jumped to a wrong height on the very first move. It now starts from the panel's measured height (the visual height after the panel scale — the unit that gets stored), falling back to 400px only when nothing can be measured.

## [0.6.1] - 2026-09-15

### Added
- **A panel-scale slider**: the card gains a "Panel scale" row — a **50%–200% slider in 5% steps** (the same control shape as the font-tune plugin's slider) that scales the panel's **content** (text, icons, buttons and their spacing). The scale does **not** change the panel's own size: a width and height dragged to some size stay exactly that size at 50% and at 200%, so magnifying simply shows less on screen at once. Dragging only moves the readout and the settings document is written **once the pointer is released** (no rewrite per notch); the readout keeps the dragged value until the host confirms it, so it never flashes back to the old number.
- **A narrow panel's header**: the four buttons stay on one line — the empty middle gives way first, and once the buttons would touch, the row becomes sideways-scrollable (the wheel over the header reaches the buttons behind the edge) while the grey grab bar above fades out.

### Changed
- **The jump animation goes back to the browser's own smooth scrolling**: the motion is handed to the container's `scrollTo({behavior:"smooth"})` — advanced on the wall clock, so it takes the same time on a 60Hz and a 240Hz panel, and it coasts to a stop. Three guards remain: step out of DSH's stick-to-bottom zone before jumping; re-aim once when the target's live offset drifts by more than 40px (the host re-paging moves it); and re-issue the call when the animation was cut short by the host's own compensation scroll (more than 400ms with less than a pixel of movement). Only a browser that carries the call out as an instant jump falls back to the plugin's frame-by-frame glide (also timed in milliseconds, quick off the mark and coasting to a stop).
- **Panel size limits removed**: the width used to be clamped to 180–560px and the height had a 160px floor. Only a "still draggable back" floor of 120px wide / 60px high remains; how large or small it gets is the reader's call.
- **The panel scale acts on the content only** (see above): the factor applies inside the panel, so the panel's own width, height, position, collapse clip and collapse animation are untouched.

### Fixed
- **Long jumps were an instant jump on a 240Hz panel**: 0.6.0's frame-by-frame glide was timed in **frames** (22–46 of them), and 46 frames is only about 190ms on a 240Hz display (measured: 5078px in 188ms, roughly four times too fast), which reads as a teleport or a uniform blur; the same frame count is about 770ms at 60Hz, which is why neither the offline tests nor a headless browser could see it. The animation is now timed in real milliseconds, independent of the refresh rate.
- **A dragged panel size sprang back to its old size**: the panel kept "what I published" and "what I adopted from outside" in one ledger. Any settings write or host snapshot refresh during a drag then compared the **not-yet-persisted** old value against that ledger and pulled the panel back to its previous size, cancelling the pending write — the drag was silently undone. The two directions are now kept apart: a value is adopted only when it differs from both the panel's live state and the value the panel itself just sent, and size/position are never read back from the settings at all (this panel is their only writer, so a read could only ever return a stale copy).

## [0.6.0] - 2026-09-14

### Added
- **A bilingual interface**: a new language setting — `follow the host` (default; uses whatever language DSH currently runs in), `中文` or `English`. Every interface string comes from one table, falling back to Chinese when an English entry is missing. Chinese stamps keep the relative words `昨天` / `前天`; English reads yesterday as the word (`yesterday`) and carries the numeric `YY-MM-DD HH:MM` date for anything older (no "2 days ago").
- **A plugin-configuration card**: a "Conversation Outline" card under **Settings → Plugins → Plugin configuration** (the same place DSH's own configurable plugins live), holding the language, the default docked edge (left by default), the heading levels shown, fuzzy search, the hover preview card and the console diagnostic switch. A changed field is marked "customized" and gets its own reset control back to the default.
- **The panel and the card are live in both directions**: they read and write one shared store. Dragging or toggling in the panel shows up in the card, and a change made in the card takes effect on the panel's next render — no page reload either way.
- **Preferences move into DSH's settings**: the preferences above no longer live only in the browser; they are written to the Host settings document, for which the plugin now ships a host half (it registers the `dsh-quick-toc` settings namespace with range validation). A local mirror stays in the browser: on a page that may not write settings (DSH keeps them read-only off a loopback address) the panel keeps working off the mirror, exactly as 0.5.x did. Values left behind by a 0.5.x install are imported into the host layer once, the first time it answers — and only while the user layer is still empty, so nothing already configured gets stomped.

### Changed
- **Long jumps glide again**: 0.5.1 stopped animating long jumps to fix the "lands halfway" bug; 0.6.0 brings the animation back as a glide **drawn frame by frame by the plugin** (ease-in-out, ~0.37–0.77s by distance), not via the browser's smooth scrolling — some setups carry that call out as an instant jump, and drawing it guarantees a visible scroll on any setup. Every frame re-aims at the target's live offset (so a host re-page mid-flight is followed), and the landing is briefly re-checked afterwards (~0.6s), so a cross-page jump never stops halfway.
- **The outline fills a taller panel**: when the panel is opened or dragged taller and the latest page is shorter than the list viewport (blank space below the newest group), the window grows until the content fills the height or every turn is shown.
- **The "currently reading" highlight fades over 0.4s** (opacity, blue fill and border transition together, with the pinned header's blue layer in sync) — the colour change between groups is now clearly visible and calmer.
- **Top offset, width and height left the settings**: they describe this screen, so they are drag-only now and keep being saved per browser; the card no longer offers numeric inputs for them.
- **Preferences are read and written in one place**: the panel no longer writes `localStorage` on every pointer move; changes are merged and persisted after a short delay, while the live position during a drag stays in the panel's own state. The position/size keys are unchanged (`panelY.v1` / `panelW.v1` / `panelH.v1`); the other keys become the mirror of the host settings (same names, fallback layer).
- **The diagnostic switch moved into the card**: tick it there and the mount line prints on the spot — no more hand-editing `localStorage` and reloading.

### Fixed
- **The panel crashed on some conversations (React #310)**: the number of hooks it called could differ between two renders — both the bail-out when `useChat` is missing and the early return for "this conversation has no displayable turn yet" sat below part of the hook list, so those hooks reappeared on a later render and React threw `Rendered more hooks than during the previous render`, taking the panel and its slot down with it (present in 0.5.0 and 0.5.1). The panel is now split into a hook-free outer guard and an inner component, so every render calls exactly the same hooks.

## [0.5.1] - 2026-09-13

### Added
- **"Back to the newest row" button**: a round button in the outline list's lower-right corner. It fades in whenever the list is not at its bottom and fades out once it is; clicking scrolls the outline back to the newest entry (smooth for a short distance, instant when the list is far up).
- **Turn stamps carry the day**: the time shown in group headers, search result rows and hover cards is no longer a bare `HH:MM` — yesterday reads `昨天 15:04`, the day before `前天 15:04`, anything older `25-09-11 15:04` (two-digit year; decided by calendar day, not a 24-hour difference).
- **Failures are reported**: a turn that produced no reply at all (request timeout, upstream error) now shows a `请求失败` row under its group header with the host's own error text; clicking it jumps to that error in the conversation, and the error text is searchable in full-text scope (its result row is tagged 请求失败).

### Changed
- **The header now holds two buttons per side**: the heading-level filter and the dock toggle on the left, search and collapse on the right, with a spacer pinning the pairs to the two ends; the three-bar identity mark on the left is gone.
- **The level filter popup is left-aligned with its button** (it used to be right-aligned).
- **The mount diagnostic is silent by default**: the console no longer prints `[dsh-quick-toc] panel mounted …`. To diagnose, run `localStorage.setItem("dsh-quick-toc.debug", "1")` and reload — the line then reports `turnOutline` and the jump loader's stage-by-stage state, while normal use stays quiet.
- **Long jumps land instantly**: a jump across a long history no longer "stops halfway" (short jumps still glide smoothly); after landing it re-checks for ~0.6s, which corrects a target that moved while content was mounting.

### Fixed
- **Failed or aborted turns were mislabelled 未加载**: those turns have no model reply, so they carried neither a time nor headings and were re-listed as unloaded turns. A loaded user message now counts as "this turn is loaded", failures additionally show their error row, and a user-aborted turn simply shows as a heading-less turn.
- **Scrolling the outline up to load older messages bounced the transcript back to the newest turn**, so paging up never got anywhere: the host force-scrolls to the bottom whenever a scroll is not attributed to the reader while it still believes the reader sits at the bottom, and a page-in triggered from the outline matches exactly that condition. The plugin now lifts the transcript just off the bottom stick zone before clicking the host's "load earlier", so the page-in keeps its place.
- **A heading-less turn's group header was formatted unlike every other header**: it used to be enlarged (12px / 600 / primary colour), which made it read as a different kind of entry. All group headers now share one style (11px, secondary colour, one row box); a heading-less turn is simply a group with no rows under its header.

## [0.5.0] - 2026-09-12

### Added
- **Whole-session turn index**: with the host's `turnOutline` projection the outline now covers **every turn of the session**, including turns the paged event window has not loaded. Unloaded turns appear as entries tagged 未加载 with the host's prompt/response previews (host-side budgets: 50 / 120 characters); clicking one pages that turn in through the host's turn-jump loader and scrolls to it. On a host without the projection the panel degrades to loaded turns only.
- **Row subtitles**: under each heading the panel shows the first sentence of that section's body (skipping blank lines, fenced code, table rules and bare bullet markers), so identically-titled headings can be told apart at a glance.
- **Hover previews**: hovering a heading or result row opens a card after ~0.26s with the title, turn time, heading path and the section's opening (up to 260 characters); docked right, the card opens to the left; leaving the row fades it out.
- **Search normalization (always on)**: letter case, full-width/half-width forms and runs of whitespace count as the same match, and the highlight lands on the real characters of the original text.
- **"Fuzzy" switch**: an independent toggle next to the title/full-text pill. When on, a query also matches text with a little material wedged in between (subsequence matching with a bounded gap); the setting is remembered.
- **Unloaded turns are searchable too**: full-text scope also searches the previews of unloaded turns, and clicking such a hit loads the turn first, then locates and highlights.
- **Edge hints**: under the search results, "scroll up to load earlier messages" — dismissed by the first upward scroll. In the outline, reaching the first turn (or scrolling down while already at the last) flashes "已经是最早的消息" / "已经到底了" at the bottom of the panel: fade in, ~2.6s hold, fade out.

### Changed
- **Auto-follow tracks more tightly**: the artificial delay is gone, the outline positions itself instantly instead of animating after the conversation, and the highlight transition dropped from 0.3s to 0.15s. Following no longer depends on the one scroll container captured at mount — it listens on the document in the capture phase and re-queries the container on every run, with a slow poll as a backstop, so it also keeps working after programmatic jumps (the native turn rail).
- **The turn being read is marked by a closed blue box** (light fill + outline + left accent bar) that fades in and out; other turns are no longer dimmed into grey (0.6 → 0.85) and the panel's idle opacity went 0.45 → 0.72, which makes the whole list far more readable.
- **Heading-less turns** promote their time row to body-level size and weight (12px / 600 / primary colour) instead of a grey caption, and they now look the same as headed turns when they are the one being read.
- Active-state colour collapsed onto a single source: the search button, the level-filter button (including while it animates shut), the title/full-text pill, the fuzzy switch, the level chips and the current result row all use the same tint.
- The click on the host's "load earlier" is throttled to 900ms while scrolling the outline (one continuous scroll cannot hammer the pager); scrolling the outline still both expands the index and loads older conversation, as in 0.4.x.
- Every UI string now comes from one table, preparing the zh/en split (the 0.5.0 interface is still Chinese).

### Fixed
- After jumping with the native turn rail (the tick bar on the right of the conversation), the outline stopped following and no longer lit up the turn being read: the follow listener was bound to the scroll container captured **at mount**, and a jump that repages the window replaces that container, so the listener sat on a discarded node and never saw another scroll event. It now listens on the document in the capture phase and re-queries the current container on every run.
- A turn without Markdown headings could never become the turn being read (no highlight, no follow): the node→turn map used by the follow only registered messages that carry headings. Every node of the turn (the user message and each model reply) is registered now.

## [0.4.0] - 2026-09-11

### Added
- **Search result list**: while a query is present the outline becomes a result list — one row per match, showing the matched heading or message with the keyword highlighted, its heading path, the turn time and a repeat count (plus a context snippet in full-text scope). Rows are chronological with the **newest hit at the bottom**, a fresh search starts at the newest hit and you scroll up to reach earlier ones; **clicking a row** makes that hit current, i.e. the same path as Enter stepping — it highlights the keyword in the conversation and scrolls there. `n/N` Enter-stepping is kept.
- **Sticky group headers**: while scrolling the outline, the header of the turn you are inside stays pinned to the top of the panel, flush against the toolbar above it.
- **Collapsible level-filter row**: the **层级 (levels)** button at the left of the magnifier hides/shows the `1`–`6` row (the choice is remembered; the filter keeps applying while it is hidden).
- **Position breadcrumb**: the top of the panel shows the path of the section you are reading; click it to jump there. The rule is "the deepest heading above the viewport's middle line" — the section that fills most of the screen — and since a jump also lands above that line, the breadcrumb still shows the same heading after you click it.
- **Heading level filter**: the `1`–`6` chips at the top of the panel are independent switches, so any combination works (e.g. H1 and H3 with H2 hidden) and the choice is remembered; switching off the last remaining level restores all six.

### Changed
- **Performance**: heading parsing and text extraction are now cached per node, so a streaming update only re-processes the node that changed instead of the whole history; the cache drops nodes that left the conversation, keeping it bounded.
- The turn header (the time row) now jumps to the **start of that turn's model reply** (it used to jump to the user message).
- **Compatibility**: verified against and declared for DSH **0.1.5-rc.1 and 0.1.5-rc.2** (`engines.dsh` keeps its floor of `>=0.1.5-rc.1`). The host interface is identical in both — the session-scoped slot `conversation.input.overlay`, the `useChat` hook from `dsh-client-ui-chat` and the client-module seed table were all checked against the installed bundles.
- `countOccurrences` now guards an empty needle (an empty query made `indexOf` spin in place — an infinite loop; every current call site is guarded, so this is hardening).

### Fixed
- The outline did not jump to the newest turn when content first appeared: that effect's dependency array was written above the `groups` declaration, so it always evaluated to `0` during render and the effect only ever ran on mount. The effect now sits below `groups` and depends on `groups.length`.
- Dragging the top bar to move the panel persisted the position from **before** the drag (the closure kept the value captured at pointer-down), so the panel jumped back to its old spot after a reload. It now stores the position the drag ended at.
- When the same keyword occurred more than once inside one text node, the in-chat highlight wrapped only the FIRST occurrence there, so the later one was neither tinted nor eligible to be marked as the current hit — stepping to it found no current mark and degraded to a plain scroll with no distinct highlight. Every occurrence inside each text node is now wrapped in order, so the in-conversation hit order lines up with `n/N`.
- `# comment` / `## example` lines inside a ``` fenced code block were treated as headings and leaked into the outline: they have no element to jump to, and they shifted the index of the real headings after them so those jumped to the wrong place. Heading parsing now skips fenced blocks (``` and ~~~, info strings, longer closing fences, up to 3 spaces of indentation).

## [0.4.1] - 2026-09-12

### Changed
- **Heading levels are now a popup**: a round icon button in the header (three lines of decreasing width, hover feedback matching the magnifier) scales the H1–H6 picker out of the **button's center**, right-aligned with an outer shadow; closing shrinks it back into the button with a fade. The picker no longer occupies its own row, the chips are labelled H1–H6, and their selected tint matches the title / full-text toggle.
- Removed the "you are here" breadcrumb row introduced in 0.4.0 (it felt unnecessary in use).

## [0.3.3] - 2026-09-10

### Added
- The panel and its collapsed edge handle fade out while the center column shows another view (trajectory, context, plugin views) and fade back in on the chat view. The check polls lightly (120 ms) and falls back to visible whenever the active view cannot be determined.

### Changed
- Compatibility is declared for DSH `0.1.5-rc.1` only (`engines.dsh`, `dsh.compatibility.dshReleases` and `peerDependencies`), which is the version this plugin is verified against.
- READMEs updated: the feature list and the usage section now cover search, search-scope switching, in-chat highlighting and turn jumping, and the compatibility table lists the supported DSH version of the last two releases.
- GitHub release bodies now default to the Chinese CHANGELOG section with the English section folded below it, and the changelog is split into `CHANGELOG.md` (Chinese, default) and `CHANGELOG.en.md` (English).

## [0.3.2] - 2026-09-08

### Changed
- Documentation pass: the compatibility matrix and feature list in the READMEs are refreshed, and the npm package description now mentions keyword search and in-chat highlighting.

## [0.3.1] - 2026-09-08

### Fixed
- Panel and collapsed edge handle no longer float above DSH modals: the base z-index is now 500 (above app popovers at z 100 and the transcript width handles at z 8, but below DSH's modal layer at z 1000), so opening Settings covers the outline instead of the outline sitting on top of it.
- Circular controls are true circles again on DSH 0.1.5-rc.1: the theme applies `corner-shape: superellipse(1.5)` to every element, which turned `border-radius: 50%` into a squircle. The icon buttons, search-scope toggle, top drag bar and edge handle now declare `corner-shape: round`.

### Changed
- Compatibility declaration also lists DSH `0.1.5-rc.1` (verified compatible; `engines.dsh` stays `>=0.1.2-rc.1`).

## [0.3.0] - 2026-08-24

### Fixed
- Compatibility with the then-current DSH 0.1.2-rc.1: the removed `@deepseek-ai/dsh-client-runtime` package no longer breaks plugin loading (externals drift). Runtime hooks now arrive as session-scope slot props.
- Conversation data access moved from `useSession(s => s.chat.*)` to the session-scope `useChat` hook (`ChatSnapshot.order` + `nodes` map, contributed by `dsh-client-ui-chat`). Node shape unchanged (`kind: user/assistant-step`, `location.turn`, `data.blocks`), so grouping / search / highlight / jump logic is untouched.
- Panel mount moved into the session-scoped `conversation.input.overlay` slot. In that DSH version session-scoped hooks only reach a declared *session* slot; a frame-floating `shell.overlay` occupant's `SessionProvider` binds to the root binding (no session id) and rendered the panel slot empty. The panel still draws its own fixed, frame-floating dock (position: fixed), so the overlay seat is only the hook source.

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
- Dock left/right with a draggable top bar, resizable from the edges/corner, collapsible into an edge handle (click it to expand)
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

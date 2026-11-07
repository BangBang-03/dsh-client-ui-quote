# dsh-client-ui-quote — English

**English** · [简体中文](../README.md) · [Design](design.md) · [Testing](testing.md) · [Release](release.md) · [Contributing](../CONTRIBUTING.md)

[![npm](https://img.shields.io/npm/v/dsh-client-ui-quote.svg)](https://www.npmjs.com/package/dsh-client-ui-quote)
[![test](https://github.com/BangBang-03/dsh-client-ui-quote/actions/workflows/test.yml/badge.svg)](https://github.com/BangBang-03/dsh-client-ui-quote/actions/workflows/test.yml)

> **Select a sentence** in a DSH message, file preview, terminal or diff and a floating bar offers **Comment**,
> **Add to chat**, and **Side chat**. The quote enters the composer as DSH's native `reference-chip`; the comment
> lives in the same node. After sending, the quote becomes **one capsule** in the transcript and leaves a highlight
> plus an ordinal on the source sentence (retired when the reply completes) — hover to jump back, copy it as
> Markdown, review it in the right sidebar's **Quote list**, or carry a **side thread**'s conclusion back into the
> main draft. Every path **only writes a draft — the plugin never sends for you**. The UI ships in Simplified
> Chinese, English and Russian.

## 30-second start

1. Install: `dsh plugin --profile <profile> add dsh-client-ui-quote` (the desktop profile is usually `desktop`,
   the browser profile `web`), or search for the package in the in-app plugin market.
2. **Select text** in a message, file preview, terminal or diff, then choose **Comment**, **Add to chat** or
   **Side chat** in the bar.
3. After sending, hover the capsule to **jump back** or **copy as Markdown**; the **Quote list** in the right
   sidebar (desktop `Alt+L`) searches, exports and reviews every quote of the session.

**Side chat** does not need `dsh-better-sidebar`. The plugin's host half creates a hidden child session
(`origin: "subagent"`, absent from the session list) and seeds it with **one implicit context message** made from
the main session's own recent turns — not a copy of the whole transcript. The thread opens in the plugin's own
`quote-sidechat` tab (falling back to the built-in `subagentchat` page when that tab type is unavailable), and the
quote lands in its composer as a native chip (a blockquote when the host has no chip face). **Nothing is sent**;
when the host half is unavailable the plugin falls back to `sessions.fork` in the same tab, and setting
`sideChatBackend` to `"better"` prefers dsh-better-sidebar instead.

## Screenshots

| Floating bar | Comment: quote and comment are both editable |
| --- | --- |
| ![The bar under the selection: Comment / Add to chat / Side chat](screenshots/bar.png) | ![Comment box: the quoted text and the comment each have their own field](screenshots/comment.png) |

| Sent capsule + hover card | The Quote list page in the right sidebar |
| --- | --- |
| ![Hover card: quote, comment, jump back, revise, copy](screenshots/card.png) | ![Quote list: search, jump back, export, side-thread bring-back](screenshots/panel.png) |

Four-screen carousel (24 seconds, stills, not a screen recording):

![Tour: floating bar → comment → capsule card → quote list](screenshots/overview.gif)

Asset notes: [`screenshots/README.md`](screenshots/README.md).

## Features

| Action | What it does |
| --- | --- |
| **Comment** | The bar turns into a comment box in place (`Write a comment…` + `Cancel` / `Add to chat`). The quoted text sits in **its own editable field**, so an over-wide selection can be trimmed on the spot. While the box is open the original selection stays highlighted through Chromium's `CSS.highlights` (hosts without that API degrade silently and still show the text in the box). `Enter` submits, `Esc` closes, the confirm button is disabled while either half is empty, and IME composition never submits by accident. |
| **Add to chat** | Inserts the quote into the composer without opening a comment box. Text you had already typed stays in place: the quote goes to the **top of the draft**, your text continues on a new line, and the caret ends up ready for your question. |
| **Side chat** | Writes the quote into the composer of one **independent side thread** per main session. By default the host half builds a hidden `origin: "subagent"` child session with a single implicit context message inside a closed turn (an empty `system/message` head first, then the parent's own words; the chat UI folds it into one compact context row), and opens it in the plugin's `quote-sidechat` tab. Fallbacks: `sessions.fork` in the same tab, then dsh-better-sidebar when `sideChatBackend` is `"better"`. Every backend **sends nothing** and leaves the main session untouched. Further clicks append to the same thread's draft. Old per-quote thread records are still recognised and reused. The thread list at the bottom of the Quote list page opens any thread again. |
| **Keyboard** | Desktop defaults: `Alt+Q` quote, `Alt+C` comment, `Alt+B` side chat, `Alt+L` open the Quote list. They are registered through DSH's shortcut service, so they show up in Settings, can be rebound, and conflict with host bindings at registration time. With no selection the quote commands return `pass`, so the key falls through. Web builds get no default binding, but all commands are listed in Settings. |
| **Source highlight** | When a quote lands in the draft, the quoted sentence gets a soft yellow highlight and an **ordinal badge** in its source message (the ordinal is the same one in the coordinate, matching `Quote N`). Removing the chip from the draft before sending retracts both; once sent, the highlight and ordinal stay until that turn's reply finishes, then retire quietly (`keepHighlight: true` keeps them on). Coordinates stay alive either way, so jump-back and the Quote list keep working. `CSS.highlights`-capable hosts draw the highlight directly (it tracks scrolling, streaming and virtual lists); otherwise a fixed overlay rectangle draws just the ordinal badge. A row outside the viewport, changed text, or a host without `Range` degrades silently — the plugin never wraps a `mark` or moves host nodes. Block boundaries such as table cells/rows, paragraphs, list items and `<br>` line up with the browser's `\t` / `\n` selection, so quotes across them paint back correctly. |
| **Quotes ×N bar** | A `Quotes ×N` toolbar above the composer: one summary chip per quote, click to jump back (or focus the chip and delete it with one Backspace when jumping is impossible), hover for the full card, `✎` to edit and `×` to remove. Removal prefers the host's `consumeToken` CAS over the chip's exact detect range and `draftRev`, so it cannot delete the wrong text; without that face it falls back to focusing the chip and pressing Backspace, with a manual hint if neither works. Removing a never-sent chip also retracts its source highlight and ordinal; a quote already sent as a capsule keeps its mark. The chip index is local, so a reload restores the bar, the hover cards and Open file. One bar per composer (main session and each side thread). The bar is a `role=toolbar`; each chip's accessible name is the full quote plus comment. |
| **Readable source head** | The coordinate line is preceded by human-readable attribution: **`from turn 12 · assistant │q1:…`** (localized; when the host reports no role, only the turn). The model understands the provenance without decoding anything; the hover card shows the same line. |
| **Capsule** | The sent block is replaced in place by **one capsule** (`❝ quote excerpt │ comment excerpt`), while the model receives the full text. Hovering reveals the full quote and comment (and a `Copy` button); clicking expands it in place. One message with several quotes gets one capsule per run, with the rest of the message untouched. |
| **Code quotes** | Selections in the file preview, terminal, diff, per-turn change panel, or inside one rendered chat code block are sent as **fenced code blocks**; the model sees real code. The preview's fence info carries the detected path and line range (`src/app.ts#L12-L48`); chat code blocks carry the renderer's language (`ts`). Terminal quotes have no path. When a path exists, the hover card and Quote list show it as a clickable **`File preview · src/app.ts · L12-L48 ↗`** that opens the right sidebar's document preview at the start line. Nothing detected means the plain form, with nothing lost. |
| **Quote list** | A right-sidebar **page** listing every quote and comment this session has sent. Search by quote or comment, click a row to jump back, **copy one row as Markdown** (with comment and source head), **Export Markdown** for people, **Export JSON** for tools (versioned schema with coordinates, file, review state and tags), and **Load older messages** when history is paged. It registers as a sidebar page type and leaves a capsule on the guide page; `Alt+L` opens it too. Data comes from the session's own event log, so it does not depend on what is on screen, and a local index keeps older quotes visible after a context compaction. The footer has a **host check** (exact chip removal, side chat backend) and a quiet **Star on GitHub** link. |
| **Review workbench** | Every row has an **Open / Resolved** toggle (the row dims when resolved) and `#tags` (Enter to add, × to remove, click a tag to filter). The header can show `Open only (N)`, list all tags with counts, and bulk **Mark resolved** or **Insert selected** after ticking rows. State and tags are keyed by the quote's coordinate (falling back to the text for old quotes) and stored locally (`dsh-client-ui-quote:v1:quote-meta`, cap 800) — they survive reloads, never sync across devices, and never enter model context. The Markdown export marks resolved rows and tags; untouched rows export exactly as before. |
| **Multi-select insert** | Tick several rows and **Insert selected** writes them all into the composer as separate chips with their own coordinates (never merged); if the chip path is unavailable it falls back to one text block containing all the quotes. Changing the search clears the selection so invisible rows cannot be inserted. |
| **Side-thread bring-back** | The bottom of the same page lists the session's side threads with their last question and message count. **Bring back to the session** writes the thread's final question + answer into the main composer as a draft (**not sent**); **Export Markdown** saves the whole thread. Thread content is read from its own event log; with no thread the section just says so. |
| **Revise this quote** | The hover card's **Revise this quote** puts the original quote **and** comment back into the comment box (each editable). Confirming sends a **new** quote — DSH's transcript is append-only, so this is the honest form of editing. The old capsule is marked **Revised** and its card shows the revised comment (and revised quote text when the body changed too). The marker is keyed by `ref + quote text` locally, so the same sentence quoted from two places does not bleed; new capsules do not carry the marker. |
| **Per-quote replies** | An opt-in checkbox in the comment box (`Ask for per-quote replies`, default off). When checked, the quote's block carries a transport-only instruction asking the model to number the quote blocks `「Quote 1」`… and answer each by number. The instruction follows the UI language. In the reply, each `「Quote N」` / `「引用N」` becomes a small **badge** whose hover card is the quote's full card (jump + revise); out-of-range numbers stay plain text. The instruction line is wire-only: capsules, cards and exports never show it. |
| **Turn-level quotes** | Every turn gets two quiet buttons at its tail, **Quote the question** and **Quote the answer**, which take the whole turn's text through the same comment box and produce a coordinate-bearing quote anchored at the turn's first line. Without the `conversation.chat.turnTail` slot the buttons simply do not appear. |
| **Configuration & debug handle** | A local whitelist of switches plus `window.__dshQuote` (see below). Nothing here leaves the machine. |

The wire format is plain text on purpose: `> ❝ …` quote lines, `> ❞ …` comment lines in the same block, `> ※ 指令：…`
for the per-quote instruction, and `> ※ from turn N · role │q1:<base64url>` for the coordinate. Marker-shaped body
lines are escaped with a backslash and restored on read. Capsules, cards and exports strip all of it; old messages
without the new fields keep parsing. Chip insertion prefers the shell's `insertReference`, then the scoped
`slash/input-insert-reference` event, and only then falls back to writing the plain `> ❝ …` block.

## Install

Requires a **DSH ≥ 0.2.0-rc.2 web or desktop client** (`engines.dsh` is a lower bound only, no upper bound;
re-checked on 0.2.2-rc.1). The plugin runs in the renderer, so a headless profile has no UI.

### npm (recommended)

`dsh-client-ui-quote` is on npm (published since 0.10.0; current stable **0.14.1**). The repository has a single
long-lived branch, `main`: a `vX.Y.Z` tag makes CI publish to npm's `latest` and create a GitHub Release; ordinary
pushes to `main` only run tests.

```bash
dsh plugin --profile desktop add dsh-client-ui-quote
```

The in-app market also lists the package for Electron-managed profiles (`dsh plugin --profile desktop list` works
on 0.2.2-rc.1; older hosts that refuse it can use the market). npmmirror and npmjs usually sync within ten minutes.

Install the stable version directly with `pnpm install dsh-client-ui-quote@latest`. `@lab` is a retired preview
channel: it can still install `0.13.1-lab.61`, and is no longer updated.

### Manual profile bundle

1. `cd <DSH_HOME>/profiles/<profile> && pnpm add dsh-client-ui-quote`;
2. In that profile's `package.json`, keep `"dsh-client-ui-quote": "^0.14.1"` in `dependencies` and append
   `"dsh-client-ui-quote"` to `dsh.profile.bundles`;
3. Restart DSH (a profile with `patchReload` also reloads automatically).

No hand-written loader entry is needed: the package's `cordis.patch.yml` inserts

```yaml
- insert:
    - id: ui-quote
      name: dsh-client-ui-quote
```

### Link a local checkout (development only)

```bash
git clone https://github.com/BangBang-03/dsh-client-ui-quote.git
dsh plugin --profile desktop add link:<clone-path>
```

Edits apply after a refresh, but for daily use prefer the npm package — a long-lived link bypasses the market and
version checks.

### Development and release

`link` / `stable` modes, push channels and release operations are in [`release.md`](release.md). The test entry is
`npm test` (**740 assertions**: check 12 + capsule 518 + panel 163 + host 47); `.github/workflows/test.yml` runs it
on Node 18/20/22 for every push and PR.

## Using it

1. **Select** text in the transcript, **file preview**, **terminal** or **diff** (selections inside the composer are
   editing, not quoting).
2. The bar appears **below** the selection (above only when there is no room). Choose **Comment**, **Add to chat**
   or **Side chat**; desktop keys are `Alt+Q` / `Alt+C` / `Alt+B` and are rebindable.
3. The first two write the quote into the composer. In comment mode the quoted text and the comment are separate
   editable fields in one chip; the **Ask for per-quote replies** checkbox rides along. The page selection clears
   and the caret moves to the composer.
4. **Side chat** writes into another session's composer and opens its tab; nothing is sent. One main session keeps
   one side thread, and later quotes append to it.
5. The bar closes on an outside click, a cleared selection, `Esc`, scrolling the conversation, a resize, or after
   an action. Double-click word selection does not close it.
6. After sending, the block becomes a **capsule** (single line when collapsed; hover for the full card, click to
   expand, `Copy` on hover). Several quotes produce several capsules, with your own text untouched between them.
7. **Jump to source** lands the message 24 px from the top of the viewport, like the host's own turn jump, and
   flashes it. Search is scoped to the quote's own session panel; hidden rows yield to a visible row of the same
   turn, and unmounted rows are found by scrolling (upwards first, then from the newest). If it truly cannot find
   the text it says so (`The source has changed` / source not in view) instead of leaving a dead button.
8. The **Quote list** page lists every quote and comment of the session, with search, jump, per-row Markdown copy,
   Markdown/JSON export and **Load older messages**; the **host check** and **Star on GitHub** link sit at the
   bottom. Below that, the session's **side threads** can be reopened, brought back into the main draft, or
   exported.
9. **Quote the question / Quote the answer** at each turn's tail go through the same comment box and carry a
   coordinate.
10. The **Quotes ×N** bar edits or removes draft chips; a reload restores the bar, cards and Open file.
11. **Revise this quote** refills the comment box and writes a new quote to the draft; the old capsule is marked **Revised**.
12. The per-quote reply checkbox makes the model answer `「Quote N」` by number, and each label becomes a badge.

## Configuration

Switches live in `localStorage` under `dsh-client-ui-quote:v1:config`; unknown keys, wrong types and out-of-range
values are dropped.

| Key | Default | What it does |
| --- | --- | --- |
| `minChars` | `1` | Selections shorter than this never open the bar. |
| `maxQuoteChars` | `4000` | Quotes longer than this are truncated with a notice; `0` means no limit. |
| `replyByDefault` | `false` | Whether **Ask for per-quote replies** starts checked. |
| `attribution` | `true` | Whether the readable source head (`from turn N · role`) rides into the wire. Coordinates stay either way. |
| `highlight` | `true` | Whether to paint source-side highlights. |
| `keepHighlight` | `false` | Keep the highlight and ordinal after the quote's reply finishes. Off by default; coordinates are kept regardless. |
| `sideChatBackend` | `"native"` | Side-chat backend: `"native"` prefers the host half's hidden thread, then a fork; `"better"` prefers dsh-better-sidebar. Neither requires better-sidebar to be installed. |
| `language` | `"auto"` | UI language: `"auto"` follows the host (falling back to Chinese); `"zh"` / `"en"` / `"ru"` pin Chinese / English / Russian. |

In the browser console:

```js
__dshQuote.config()                    // current switches
__dshQuote.setConfig({ minChars: 3 })  // change and persist them
__dshQuote.state()                     // selection, mode, path, chip and bar counts
__dshQuote.probe()                     // visible host services, index sizes, native side chat, lastFailure
```

`probe().lastFailure` is for support: `stage` is one of `source` / `insert` / `remove` / `sidechat`, `detail` is a
one-line reason and `count` is how often this page has failed. It records no quote text and is safe to paste into
an issue.

## Why this one

Four verifiable differences, each backed by offline assertions:

1. **Semantics, not mechanism**: a quote and its comment are one node (matching Kimi's `quote` node
   `{text, comment}`) — one chip → one block → one capsule → one card → one copy. The mechanism is copyable; the
   chain is not.
2. **A quote is a live object with coordinates**: **Jump to source** finds the row inside the quote's own session
   panel and aligns it the way the host does; coordinates travel **inside the message** as a readable source head
   plus a base64 tail, so they survive reloads and other windows. The base64 tail costs a few prompt tokens; that
   is the price of not depending on a local table.
3. **A quote has an afterlife**: the review list (search / jump / Markdown + JSON export / status / tags /
   multi-select) and side-thread bring-back (draft in the main session / export the thread) are still uncommon
   among similar plugins.
4. **Engineering**: **740 offline assertions** (including real `sessions.retain`, `setDraft`, `agents.create`
   arguments and the download path), every host contract dated in this document, and a readable release for every
   version.

The full comparison with Kimi and with the rest of the DSH market, including what this plugin deliberately does
not do, is in [`design.md`](design.md).

## Known limitations

- **DSH compatibility statement (re-checked on 0.2.2-rc.1, 2026-11-07)**: `engines.dsh` is `>=0.2.0-rc.2` — a
  lower bound only. DSH's pre-load check reads that field (and ignores `@deepseek-ai/dsh*` peers when it exists),
  so a matching range is allowed in; 0.2.2-rc.1 and later are not disabled merely because of their version. The
  re-check confirmed the host route still mounts (a request without a browser Origin is fenced with
  `403 {"code":"forbidden"}`, while the same POST to an unknown path is a `405`, so it is not a catch-all), and
  `webServer.register` / `connection.requestRejection` / `agents.create` / `inheritedEventCount` /
  `subagent/descriptor` v3 plus the client slots and DOM attributes
  (`conversation.chat.turnTail`, `data-chat-turn`, `data-conversation-content`, `reference-chip`,
  `data-textpreview-path`) are still present. The open range has no early warning: a broken internal interface
  degrades silently, so run `npm test` and one side-chat probe after upgrading. **Do not add an upper bound** — a
  range like `<0.2.1-rc.4` gets the plugin disabled by the next rc.
- **The hidden side thread depends on host internals** (first measured on app.asar 0.2.1-rc.3; route and contracts
  re-checked on 0.2.1-rc.5 and 0.2.2-rc.1): the host half registers `POST /ui-quote/api/sidechat.start` through
  `ctx.inject(["webServer"])`, synthesizes one context message from the parent's `snapshotEvents()` (it does not
  copy the log), then calls
  `ctx.get("agents").create({ meta: { parentSession, isSeeded: true, origin: "subagent", delegationDepth, agentPreset }, seed, inheritedEventCount, agentOptions, setup })`.
  The descriptor is `{version: 3, mode: "continuable", provider: "ui-quote", label}` and the title is
  `Side: <first line of quote>`. Missing `webServer` / `connection.requestRejection` / `agents` makes the probe
  fail and the client fall back to a fork; a failed `agents.create` only loses that one thread.
- **The seed is a shape, not a log copy**: one `session/end-seed { inherited: true }` cut at index 0, a closed turn
  (`turn/start` → `step/start` → an empty `system/message` head → the context message → `step/end` → `turn/end`),
  then `subagent/descriptor` (plus an optional `model/selection`). The first surface node of the turn **must** be
  a system message: the session store treats it as the protected head, and any other node first makes the first
  real turn unreadable (`system/message requires a protected first surface head`, then `subagent/not-resumable`).
  The descriptor must sit after the cut (`identity.seq >= inheritedEventCount`), or the whole child history refuses
  to open (`subagent descriptor is unavailable`). The client stamps newly created threads with the current shape
  version (`dsh-client-ui-quote:v1:sidechat-target`, now `v: 6`) and only reuses threads it stamped itself;
  `sessions.retain` is **not** a validity test — it succeeds even for a broken thread.
- **Revising is an append**: the transcript has no edit API, so **Revise this quote** writes a new quote to the
  draft and the old capsule only gets a `Revised` marker. The marker lives locally
  (`dsh-client-ui-quote:v1:quote-revised`, keyed by `ref + quote text`, cap 60); it does not sync across tabs or
  devices and never enters model context. If the quote body changed, the marker still hangs on the old capsule and
  shows the revised text.
- **Code quotes are detected by the first fence line**: a block whose first line is `> ❝ ``` ` with a matching
  closing fence is parsed as code. A plain quote whose body *starts* with a backtick fence but has no matching
  closing fence stays plain text, so the first line is never eaten. Code quotes with backticks inside use `~~~`.
- **Marker-shaped body lines are escaped**: a line starting with `❝`, `❞`, `※` or a backslash gets a backslash on
  write and is restored on read. Messages sent by older builds have no escape layer and keep the old parsing.
- **Preview and diff paths/lines are probed**: the preview path comes from the header's path label
  (`[data-textpreview-path]`'s `title`), then from candidate attributes; line numbers exist only in per-line
  preview rendering (`data-textpreview-line`). A **Markdown preview has no source line anchor**. Diff paths and
  lines come from `data-diff-path` / `data-file-path` / `data-diff-file` and `data-line-number` / `data-diff-line`
  / `data-line` fallbacks. When the host changes that DOM, only the path/line is lost; the quote still goes as a
  code block.
- **Chat code blocks are detected from the host DOM**: both selection ends must sit inside one `pre`; the language
  comes from `language-*` / `lang-*` classes or `data-language`. A different renderer quietly degrades to a plain
  blockquote, and line-number gutters inside `pre` must be trimmed in the comment box.
- **Reply badges depend on the model following the format**: no `「Quote N」` means no badges (nothing is lost,
  only the link); an out-of-range number stays plain text. Badge numbering follows the nearest preceding message
  with capsules. A change in how DSH renders assistant text needs the same enhancer update as the capsule's
  `isQuoteRun`.
- **The Quote list needs both right-sidebar services** (`sidebarRightTabs` and `sidebarRight`). Without them the
  page does not register and `Alt+L` shows a toast instead of throwing. History is paged: only loaded messages are
  listed until **Load older messages**, and native context compaction can remove quotes from messages it trimmed
  (the local index covers quotes read before). Exports are browser downloads (`quotes-<sessionId>.md`/`.json`);
  rows without coordinates (quotes sent by older builds) are listed but cannot jump.
- **The capsule is an overlay over DSH's rendering**: it hides the original run and inserts its own node in front;
  it never moves React's nodes, but a change to the message DOM (`[data-conversation-content]`, the plain-text run
  shape) needs `isQuoteRun` / `capsuleFor` updated. A window without the plugin — another profile, a disabled
  plugin, or a page that has not loaded it yet — shows the raw `> ❝ … │q1:…` wire text; that is the designed
  fallback, not corruption. Loading the plugin, or focusing/showing the window again, re-scans the transcript
  (`rescanCapsules()`). Messages sent before the capsule existed are not retrofitted: re-quote them once.
- **Source highlights use the full quote text**: right after a reload, before the capsule renders, only the first
  120 characters of the coordinate's identity key are available, so a long quote lights up partially until the
  capsule reaches the viewport and the full text is repainted. The highlight and ordinal **retract when the
  reply finishes** (`keepHighlight: true` keeps them); coordinates remain for jump/card/list. Rows outside the
  viewport, virtual-list rows, and changed text are skipped, and the host DOM is never touched. `CSS.highlights`
  hosts get browser-drawn highlights; others get a fixed overlay. The comment box's selection highlight also
  needs `CSS.highlights` and degrades silently.
- **A draft chip removal retracts the mark**: coordinates written by the main session's Comment / Add to chat
  paths are stored with `chip`; when the `×` or a Backspace removes the chip and no capsule for it exists on the
  page, the coordinate becomes `draft` and the mark is withdrawn (also after a reload). A quote already sent as a
  capsule is not retracted by removing a draft chip; its mark is retired at the end of the turn. This is observed
  **per composer card**: switching sessions (the whole composer leaves the page) does not count as removal, and a
  chip removed in another window is noticed on the next reload. Two fallbacks: during the brief gap where the sent
  message is still plain text, the transcript's `│q1:` coordinate suppresses the retraction; and a late promotion
  is repaired on the next repaint if its capsule is on the page.
- **Cross-message selections carry no source head or coordinate**: when the selection starts and ends in different
  message rows, the quote is still produced (text, comment and code form intact) but cannot name one turn; quote it
  in two passes if you need provenance.
- **Side chat memory is a snapshot**: only the first few turns (up to 8000 characters) are seeded at creation.
  Later main-session messages do not flow in, and side-chat messages do not flow back; bring the conclusion back
  through the Quote list page. Before the first question, **Bring back to the session** may pick up the copied
  turn — ask one question first. All backends unavailable means the Side chat row is absent.
- **The local indexes are local**: the quote list index, review metadata, revision markers and chip index are
  `localStorage` only — no sync, no model context, no device transfer.

## Self-check

```bash
node --check lib/client.js
npm test          # check + capsule + panel + host: 740 assertions
```

**740 assertions** (check 12 + capsule 518 + panel 163 + host 47) must be green. What each suite covers, the
51-item real-browser page and the tricky parts are in [`testing.md`](testing.md).

## Contributing

PRs target `main`; titles follow `fix(quote): …` — the merge is a squash and the PR title becomes the commit
title. Run `node --check lib/client.js && npm test` before pushing. Full rules: [`CONTRIBUTING.md`](../CONTRIBUTING.md);
red lines: [`AGENTS.md`](../AGENTS.md).

## Changelog and licence

See [CHANGELOG.md](../CHANGELOG.md). [MIT](../LICENSE).

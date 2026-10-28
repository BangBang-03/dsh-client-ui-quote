# dsh-client-ui-quote — English

**English** · [简体中文](../README.md)

**dsh-client-ui-quote** — select any sentence in a DSH conversation and quote it into the composer, Kimi-Code style.
The floating bar opens **under** the selection (above it only when there is no room below) and offers **Comment**,
**Add to conversation**, and — the plugin's own addition — **Side chat**: the quote is written into the composer of one
independent side thread per main session. By default the plugin's own host half creates a **hidden** child session
(`origin: "subagent"`, seeded from the parent's log, absent from the session list) and opens it in DSH's built-in
`subagentchat` page; when the host half cannot create it, the plugin falls back to a fork in its own native page, and
dsh-better-sidebar stays opt-in via `sideChatBackend: "better"`. Either way it inherits the main session's context and
opens as a tab in DSH's native right sidebar, drawn in DeepSeek's whale blue. Nothing is sent — the question that
thread answers stays yours to write, and clicking again appends the next quote to the same thread's draft. The quoted
text itself is editable in the comment box (trim the selection, correct a revision's wording), and a selection from the
file preview or the terminal travels to the model as a fenced code block. The quote — and the comment, kept together in the same
chip the way Kimi keeps both halves in one composer node — becomes DSH's native inline `reference-chip`, is serialized
back into a `> ❝ …` / `> ❞ …` blockquote when you send, and is then drawn as a single rounded **capsule** in the
transcript (`quote │ comment`, hover for the full text, click to expand, copy button), so a quote never floods the message with `>` lines —
the model still receives the full text. The same hover card opens over the composer chip, whose label has to be clipped,
and it closes with the chip as soon as the message is sent. Each chip resolves its own quote at hover time — React
reuses a chip node for the next quote, so a card can never show the previous one's text.
Screenshots: [floating bar](docs/screenshots/bar.png) · [comment box](docs/screenshots/comment.png) · [capsule hover card](docs/screenshots/card.png) · [quote list page](docs/screenshots/panel.png).
Install with `dsh plugin --profile desktop add dsh-client-ui-quote` (published on npm; DSH >= 0.2.0-rc.2, web/desktop client).
Test with `npm test`. MIT licensed.

Kimi Code is where the interaction started, not the whole comparison. As of 2026-10 the DSH market has at least a dozen quote/annotation plugins — `dsh-annotation`, `dsh-sidenote`, `CiteCiter`, `dsh-quote-annotate-pro`, `dsh-select-quote`, `dsh-selection-toolbar`, and others. The floating bar is table stakes; the differentiator here is what happens after the quote is sent: a source highlight and ordinal, jump-back, a searchable review list, side-thread bring-back, revisions, and per-quote reply badges. The draft's `引用 ×N` bar removes a quote through the host's `consumeToken` span CAS (exact occurrence coordinates, draft-revision guarded), falling back to the editor's own Backspace path on hosts without that face, with a manual-backspace hint if neither applies. A preview/diff quote's file now appears as a clickable `path#Lx-Ly` line in the hover card and the quote list; clicking it opens the right sidebar's document preview at the range's first line through `sidebarRight.openResource`, focusing an already-open tab instead of duplicating it. A selection inside one rendered chat code block is quoted as a fenced block carrying the renderer's language, and degrades to a plain blockquote when the selection crosses the block boundary. A quote that is still in the draft can be edited or removed from the aggregate bar, and the chip index is kept locally so a reload does not lose the bar, the hover card or the file it points at. A code quote shows its source (`文件预览 · src/app.ts · L12-L48`) and opens the sidebar's document preview at that line. A main session keeps exactly one side thread: the floating bar offers a single 侧边对话 row (a second, identical-looking entry was dropped — threads created by older per-quote builds are still recognised and reused), later quotes append to the same thread's draft, and the quote list shows every thread of the session; by default the same flow creates a hidden seeded subagent thread through the plugin's host half and opens it in the host's built-in chat, with a fork in the plugin's own page as the fallback and better-sidebar as an opt-in backend. Built-in threads share better-sidebar's durable `Side: ` convention, so the two plugins can see each other's threads without sharing storage, routes or descriptors. The quote list exports Markdown and JSON, keeps a local index so a context compaction cannot empty it, and a small whitelisted set of switches plus a `window.__dshQuote` handle sits behind it all. The Chinese section above carries the current 2026-10 market comparison; this plugin is not a Kimi Code clone.

Two wire-only extras ride on the same pipeline: a per-quote reply toggle in the comment box (the block carries a
transport-only instruction, the model answers `「引用N」` by `「引用N」`, and each label becomes a badge that reopens
the quote's hover card), and a preview quote that puts its file into the fence's info string so the model can open
the file itself.

/**
 * dsh-client-ui-quote — select text in the conversation, then quote and/or
 * comment on it, the way Kimi Code does.
 *
 * Reproduced behaviour (traced from Kimi Code 1.0.4's `selection` namespace and
 * its `sab` selection-action bar):
 *
 *   select text ─▶ floating bar, Kimi's two rows plus one row of our own
 *                    评论        ─▶ the bar turns into an inline comment box
 *                                    (textarea + 取消 / 添加到对话, ⏎ confirms)
 *                    添加到对话  ─▶ the quote goes straight to the composer
 *                    侧边对话    ─▶ the quote is written into the composer of the
 *                                    session's side thread in the right sidebar
 *                                    (dsh-better-sidebar; our own extension, see
 *                                    the side-chat section below)
 *
 *   The first two paths insert the quote into the composer; the comment path
 *   appends the comment right after it. The UI selection is dropped on the way
 *   in, and the composer takes focus so the next keystroke continues the
 *   message. The third path writes the quote into ANOTHER session's composer:
 *   one side thread per main session, opened and then reused, and nothing is
 *   sent — the question that thread answers stays the reader's to write.
 *
 * DSH's composer is Lexical, so Kimi's inline `quote-pill` node travels as one
 * of DSH's own inline reference chips while the message is being written; the
 * chip's model form is a Markdown blockquote and its label is the quote preview.
 *
 * A sent message, however, is plain text to DSH, which is why the quote used to
 * land in the transcript as a wall of `>` lines. The client half therefore also
 * draws the capsule Kimi shows: every transcript run that opens with the
 * serialized quote mark is replaced on screen by a rounded pill holding the
 * quote, while the text the user actually typed stays as it is.
 *
 * Client half only: `react` is a baseline platform module, the host half is a
 * no-op, and the whole feature is installed from a single slotted component.
 */
window.__ModuleLoader__.load({
	id: "dsh-client-ui-quote",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		let react = require("react");

		/* ------------------------------------------------------------------ *
		 * Locale
		 * ------------------------------------------------------------------ */

		/** Locale namespace of this plugin. */
		const NS = "ui-quote";

		/** Chinese copy, verbatim from Kimi Code's `selection` namespace. */
		const zh = {
			comment: "评论",
			addToChat: "添加到对话",
			commentPlaceholder: "写一句评论…",
			cancel: "取消",
			quoteLabel: "引用",
			quoteMeta: "{lines} 行 · 点击展开",
			copy: "复制",
			copied: "已复制",
			failed: "插入失败，请重试",
			sideChat: "侧边对话",
			sideChatFailed: "侧边对话没有打开，请重试",
			sideChatDraftFailed: "侧边对话已打开，但引用没能写进它的输入框",
			jump: "跳回原文",
			jumpFailed: "原文不在当前视图里"
		};

		/** English copy, verbatim from Kimi Code's `selection` namespace. */
		const en = {
			comment: "Comment",
			addToChat: "Add to chat",
			commentPlaceholder: "Write a comment…",
			cancel: "Cancel",
			quoteLabel: "Quote",
			quoteMeta: "{lines} lines · click to expand",
			copy: "Copy",
			copied: "Copied",
			failed: "Could not insert, try again",
			sideChat: "Side chat",
			sideChatFailed: "The side chat did not open, try again",
			sideChatDraftFailed: "The side chat opened, but the quote could not be written into it",
			jump: "Jump to source",
			jumpFailed: "The source is not in view right now"
		};

		/* ------------------------------------------------------------------ *
		 * Constants
		 * ------------------------------------------------------------------ */

		const STYLE_ID = "dsh-quote-style";
		const CAPSULE_STYLE_ID = "dsh-quote-capsule-style";
		const POPOVER_ID = "dsh-quote-popover";
		const BAR_ID = "dsh-quote-bar";
		const TOAST_ID = "dsh-quote-toast";

		/**
		 * The mark that opens every serialized quote block. It is the one thing
		 * that survives a reload: DSH stores a sent message as plain text, so the
		 * capsule enhancer downstream has nothing but this character to recognise
		 * a quote by. It reads as a quotation mark in the model's prompt and in a
		 * raw copy, and it degrades to a harmless glyph when the capsule is off.
		 */
		const QUOTE_MARK = "\u275D";

		/**
		 * The mark that opens the comment half of the same block. Kimi keeps the
		 * quote and its comment in one composer node (`{ text, comment }`) and
		 * shows them as one pill; a text-only wire cannot carry attributes, so the
		 * two halves live in a single `> ❝ …` / `> ❞ …` block instead — one block,
		 * one capsule, and any wording typed afterwards stays outside both.
		 */
		const COMMENT_MARK = "\u275E";

		/** Transcript host: a selection outside it is none of our business. */
		const CONTENT_SELECTOR = "[data-conversation-content]";
		/** The composer card: a selection inside it is a draft edit, not a quote. */
		const CARD_SELECTOR = "[data-composer-card]";
		/** Composer text box, used to focus the draft after inserting. */
		const COMPOSER_SELECTOR = "[data-composer-input]";
		/**
		 * Quotable hosts outside the transcript. A file preview and the terminal
		 * carry text worth quoting too, and neither has a slot to mount into — the
		 * bar is a document-level singleton, so the only thing missing was letting
		 * those selections through. Neither host knows a session id, so the quote
		 * is routed to the conversation that is on screen.
		 */
		const PREVIEW_SELECTOR = "[data-textpreview-body],[data-document-preview]";
		const TERMINAL_SELECTOR = ".xterm";

		const GAP = 8;
		const EDGE = 8;
		const COMMENT_WIDTH = 280;
		const COMMENT_MAX_HEIGHT = 160;
		/** Grace period that lets the pointer travel from a pill to the hover card. */
		const POPOVER_HIDE_MS = 140;
		/** Kimi settles the selection for 250ms before showing the bar. */
		const SETTLE_MS = 180;
		const TOAST_MS = 1800;
		/** How long the message a quote came from stays flashed after a jump. */
		const FLASH_MS = 1400;
		/** Marks the flashed row; the rule lives in the capsule stylesheet. */
		const FLASH_ATTR = "data-dshq-flash";

		/**
		 * DSH mints every inline reference from an owner source; this one owns
		 * the quote chips. The trigger is deliberately one the input surface
		 * never detects — chips are inserted by the plugin, never picked from
		 * a menu, so the source only has to exist for the send-time codec.
		 */
		const SOURCE_NAME = "quote";
		const SOURCE_TRIGGER = "#";

		/**
		 * 侧边对话 — the third row, our own addition on top of Kimi's two. It
		 * hands the quote to dsh-better-sidebar's side chat: a child thread that
		 * inherits the main session's full context and runs independently. Three
		 * wire facts make it work: the plugin's `sidechat.start` route creates the
		 * thread and, when the question is EMPTY, sends nothing at all (a non-empty
		 * one is admitted as the thread's first message); the service's `openTab`
		 * carries `meta.threadId` through to the native tab, which binds the opened
		 * tab to THAT thread; and the child's own conversation input shell owns its
		 * draft, so the quote is written there as one more composer prefill. The
		 * thread is remembered per main session and reused, so the third row never
		 * spawns a new thread for every quote.
		 */
		const SIDECHAT_TAB = "sidechat";
		const SIDECHAT_API = "/sidebar/api/sidechat.start";
		/** Our own "side thread of this session" memory (better-sidebar keeps its own). */
		const SIDE_THREAD_KEY = "dsh-client-ui-quote:v1:sidechat-thread";
		/** better-sidebar's per-session thread memory — readable, never written here. */
		const HOST_THREAD_KEY = "dsh-sidebar:v1:sidechat-thread";
		/** DeepSeek's brand blue — the whale accent the third row is drawn in. */
		const SIDEBAR_ACCENT = "#4d6bfe";

		/**
		 * Where a quote was selected from. A sent message is plain text, so the
		 * coordinate cannot ride along inside the quote itself (it would land in
		 * the model's prompt) — it is kept beside it, keyed by the quote's own
		 * wording, and read back when the reader asks to jump. The anchor is the
		 * chat row (`data-chat-anchor-key`, with the row's `data-chat-turn` as a
		 * fallback): DSH exposes no message id to a plugin and no scroll API, so
		 * the jump is a `scrollIntoView` on the same row plus our own flash.
		 */
		const SOURCE_KEY = "dsh-client-ui-quote:v1:quote-source";
		const SOURCE_LIMIT = 60;

		const ICON_MESSAGE =
			'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H8l-4 3V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z"/></svg>';
		const ICON_PLUS =
			'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
		/** The third row's glyph: a right-sidebar panel, drawn in DeepSeek's whale blue. */
		const ICON_SIDEBAR =
			'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/></svg>';

		const STYLE_TEXT = `
#${BAR_ID}{position:fixed;z-index:2147483000;display:none;box-sizing:border-box;min-width:0;
max-width:calc(100vw - 2 * ${EDGE}px);max-height:calc(100vh - 2 * ${EDGE}px);overflow-y:auto;
padding:4px;background:var(--dshq-bg);color:var(--dshq-fg);border:1px solid var(--dshq-border);
border-radius:var(--dshq-radius);box-shadow:0 10px 30px rgba(0,0,0,.34);
font-family:var(--dshq-font);font-size:13px;line-height:1.45;-webkit-app-region:no-drag}
#${BAR_ID}[data-visible="true"]{display:block}
#${BAR_ID} .dshq-row{display:flex;align-items:center;gap:8px;width:100%;box-sizing:border-box;
padding:6px 10px;border:0;border-radius:calc(var(--dshq-radius) - 3px);background:transparent;
color:inherit;font:inherit;text-align:left;white-space:nowrap;overflow:hidden;cursor:default}
#${BAR_ID} .dshq-row:hover,#${BAR_ID} .dshq-row:focus-visible{background:var(--dshq-hover);outline:none}
#${BAR_ID} .dshq-row span.dshq-label{overflow:hidden;text-overflow:ellipsis}
#${BAR_ID} .dshq-icon{display:inline-flex;flex:none;opacity:.85}
/* 侧边对话 row: the whale-blue accent on a white/light bar (dark themes keep
the same hue — #4d6bfe reads on both), the plugin's one branded touch. */
#${BAR_ID} .dshq-row-sidechat .dshq-icon{color:${SIDEBAR_ACCENT};opacity:1}
#${BAR_ID} .dshq-row-sidechat:hover,#${BAR_ID} .dshq-row-sidechat:focus-visible{background:color-mix(in srgb,${SIDEBAR_ACCENT} 16%,transparent)}
#${BAR_ID} .dshq-comment{display:flex;flex-direction:column;gap:8px;width:${COMMENT_WIDTH}px;max-width:100%;padding:4px}
#${BAR_ID} .dshq-input{box-sizing:border-box;min-width:0;width:100%;resize:none;overflow-y:hidden;
padding:6px 8px;background:transparent;color:inherit;font:inherit;border:1px solid var(--dshq-border);
border-radius:6px;max-height:${COMMENT_MAX_HEIGHT}px}
#${BAR_ID} .dshq-input::placeholder{color:var(--dshq-faint)}
#${BAR_ID} .dshq-input:focus{outline:none;border-color:var(--dshq-accent)}
#${BAR_ID} .dshq-actions{display:flex;justify-content:flex-end;gap:8px}
#${BAR_ID} .dshq-btn{padding:4px 10px;border:1px solid var(--dshq-border);border-radius:6px;
background:transparent;color:inherit;font:inherit;cursor:default}
#${BAR_ID} .dshq-btn:hover{background:var(--dshq-hover)}
#${BAR_ID} .dshq-btn-primary{background:var(--dshq-accent);border-color:var(--dshq-accent);color:#fff}
#${BAR_ID} .dshq-btn-primary:hover{background:var(--dshq-accent);opacity:.9}
#${BAR_ID} .dshq-btn:disabled{opacity:.45}
#${BAR_ID} .dshq-enter{margin-left:4px;opacity:.65}
#${TOAST_ID}{position:fixed;z-index:2147483001;display:none;padding:4px 10px;border-radius:6px;
background:rgba(24,24,27,.92);color:#f4f4f5;font-size:12px;line-height:1.5;pointer-events:none;
-webkit-app-region:no-drag}
#${TOAST_ID}[data-visible="true"]{display:block}
`;

		/**
		 * Capsule styling for a *sent* quote. DSH renders a sent user message as
		 * plain text, so the quote block shows up as a wall of `>` lines; the
		 * enhancer swaps that block for this pill — one quiet line carrying the
		 * quote and, after a hairline, the comment, the way Kimi's pill does.
		 * Colour comes from the bubble's own `currentColor`, so it works in either
		 * theme without a palette.
		 */
		const CAPSULE_STYLE_TEXT = `
.dshq-cap{box-sizing:border-box;max-width:100%;margin:2px 0;padding:5px 10px;border-radius:10px;
display:inline-flex;align-items:baseline;gap:7px;overflow:hidden;vertical-align:top;text-align:left;
cursor:pointer;color:inherit;font-size:13px;line-height:1.55;font-weight:400;
background:rgba(127,127,127,.12);background:color-mix(in srgb,currentColor 9%,transparent)}
.dshq-cap-mark{flex:none;font-size:12px;opacity:.55}
.dshq-cap-quote{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dshq-cap-comment{flex:0 1 auto;min-width:0;max-width:46%;padding-left:8px;opacity:.9;
border-left:1px solid currentColor;border-left-color:color-mix(in srgb,currentColor 30%,transparent);
overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dshq-cap-copy{flex:none;margin-left:auto;padding:0 2px;border:0;background:transparent;color:inherit;
font:inherit;font-size:11px;line-height:1.6;cursor:pointer;opacity:0;transition:opacity .12s ease}
.dshq-cap:hover .dshq-cap-copy,.dshq-cap-copy:focus-visible{opacity:.7}
.dshq-cap-copy:hover{opacity:1}
.dshq-cap[data-expanded="true"]{display:flex;flex-wrap:wrap;align-items:baseline}
.dshq-cap[data-expanded="true"] .dshq-cap-quote{flex:1 1 0;white-space:pre-wrap;overflow:visible;
text-overflow:clip;overflow-wrap:anywhere}
.dshq-cap[data-expanded="true"] .dshq-cap-comment{flex:1 1 100%;max-width:none;margin-top:5px;
padding-left:9px;white-space:pre-wrap;overflow:visible;text-overflow:clip;overflow-wrap:anywhere}
.dshq-body{display:block;white-space:pre-wrap;overflow-wrap:anywhere}
/* Hover card: a collapsed pill keeps one clipped line per half and the chip in
the composer is clipped even harder, so hovering either one shows the quote and
the comment in full. It is parked on <body> with position:fixed because a chat
bubble's own overflow would cut an in-place card off. */
#dsh-quote-popover{position:fixed;left:8px;top:8px;z-index:2147483002;display:none;box-sizing:border-box;
width:min(420px,calc(100vw - 16px));max-height:min(340px,60vh);overflow:auto;padding:8px 10px;
border:1px solid var(--dshq-border,rgba(127,127,127,.34));border-radius:10px;
background:var(--dshq-bg,#27272a);color:var(--dshq-fg,#f4f4f5);
font-family:var(--dshq-font,inherit);font-size:12.5px;line-height:1.55;
box-shadow:0 14px 34px rgba(0,0,0,.3)}
#dsh-quote-popover[data-visible="true"]{display:block}
#dsh-quote-popover .dshq-pop-head{display:flex;align-items:baseline;gap:6px;margin:0 0 3px;
font-size:11px;line-height:1.5;opacity:.62}
#dsh-quote-popover .dshq-pop-mark,#dsh-quote-popover .dshq-pop-label{flex:none}
#dsh-quote-popover .dshq-pop-meta{margin-left:auto;white-space:nowrap}
#dsh-quote-popover .dshq-pop-text{white-space:pre-wrap;overflow-wrap:anywhere;margin:0 0 9px}
#dsh-quote-popover .dshq-pop-text:last-child{margin-bottom:0}
#dsh-quote-popover .dshq-pop-jump{margin:10px 0 0;padding:3px 9px;font:inherit;font-size:11px;line-height:1.6;
cursor:pointer;border:1px solid var(--dshq-border);border-radius:6px;background:transparent;color:inherit;
opacity:.72}
#dsh-quote-popover .dshq-pop-jump:hover{opacity:1}
[${FLASH_ATTR}="true"]{animation:dshq-flash ${FLASH_MS}ms ease-out}
@keyframes dshq-flash{0%,35%{background-color:color-mix(in srgb,currentColor 14%,transparent)}
100%{background-color:transparent}}
#dsh-quote-popover .dshq-pop-comment{padding-left:9px;
border-left:2px solid color-mix(in srgb,currentColor 28%,transparent)}
`;

		/* ------------------------------------------------------------------ *
		 * Small DOM helpers
		 * ------------------------------------------------------------------ */

		function isNode(value) {
			return value !== null && typeof value === "object" && typeof value.nodeType === "number";
		}

		function el(doc, tag, props, children) {
			const node = doc.createElement(tag);
			if (props !== undefined && props !== null) {
				for (const key of Object.keys(props)) {
					const value = props[key];
					if (value === undefined || value === null) continue;
					if (key === "class") node.className = value;
					else if (key === "text") node.textContent = value;
					else if (key === "html") node.innerHTML = value;
					else node.setAttribute(key, value === true ? "" : String(value));
				}
			}
			if (Array.isArray(children)) {
				for (const child of children) {
					if (child === null || child === undefined) continue;
					node.append(isNode(child) ? child : doc.createTextNode(String(child)));
				}
			}
			return node;
		}

		/** The element a node belongs to (the node itself when it is an element). */
		function elementOf(node) {
			if (node === null || node === undefined) return null;
			if (node.nodeType === 1) return node;
			return node.parentElement === undefined ? null : node.parentElement;
		}

		function closestFrom(node, selector) {
			const element = elementOf(node);
			if (element === null || typeof element.closest !== "function") return null;
			return element.closest(selector);
		}

		function insideBar(node) {
			const bar = state.bar;
			if (bar === null) return false;
			const element = elementOf(node);
			return element !== null && bar.contains(element);
		}

		function clamp(value, min, max) {
			if (!Number.isFinite(value)) return min;
			if (max < min) return min;
			return Math.min(Math.max(value, min), max);
		}

		/**
		 * Where the menu sits vertically. Under the selection by default — the
		 * space above a paragraph is what the reader is looking at — and only
		 * above it when the bar would not fit below. Either way it stays inside
		 * the visual viewport.
		 */
		function barTop(anchor, barHeight, height, offsetTop) {
			const lower = offsetTop + EDGE;
			const upper = Math.max(lower, offsetTop + height - barHeight - EDGE);
			const below = anchor.bottom + GAP;
			if (below + barHeight <= offsetTop + height - EDGE) return below;
			return clamp(anchor.y - GAP - barHeight, lower, upper);
		}

		/* ------------------------------------------------------------------ *
		 * Selection reading
		 * ------------------------------------------------------------------ */

		/**
		 * @returns {{ text: string, x: number, y: number, bottom: number, sessionId: string } | null}
		 *   the selected text plus its viewport anchor, or null when the current
		 *   selection is not a quotable transcript selection.
		 */
		function readSelection() {
			const selection = document.getSelection === undefined ? null : document.getSelection();
			if (selection === null || selection.rangeCount === 0 || selection.isCollapsed) return null;

			const range = selection.getRangeAt(0);
			if (closestFrom(range.startContainer, CARD_SELECTOR) !== null) return null;
			if (closestFrom(range.endContainer, CARD_SELECTOR) !== null) return null;

			// The transcript is a quote's native home; a file preview or the
			// terminal is a guest there, and borrows the session on screen.
			const chat = closestFrom(range.startContainer, CONTENT_SELECTOR);
			let host = chat;
			if (host === null) host = closestFrom(range.startContainer, PREVIEW_SELECTOR);
			if (host === null) host = closestFrom(range.startContainer, TERMINAL_SELECTOR);
			if (host === null) return null;

			const text = String(selection.toString()).replace(/^\n+|\n+$/g, "");
			if (text.trim().length === 0) return null;

			let sessionId = null;
			if (chat !== null) {
				sessionId = chat.getAttribute("data-conversation-session");
				if (typeof sessionId !== "string" || !sessions.has(sessionId)) return null;
			} else {
				const active = document.querySelector(CONTENT_SELECTOR + "[data-conversation-session]");
				sessionId = active === null ? null : active.getAttribute("data-conversation-session");
				if (typeof sessionId !== "string" || sessionId === "") return null;
			}

			const rect = range.getBoundingClientRect();
			if (rect.width === 0 && rect.height === 0) return null;

			return {
				text,
				x: rect.left + rect.width / 2,
				y: rect.top,
				bottom: rect.bottom,
				sessionId,
				// Only a transcript selection has a row to jump back to.
				source: chat === null ? null : chatRowOf(range.startContainer)
			};
		}

		/* ------------------------------------------------------------------ *
		 * Payload + insertion
		 * ------------------------------------------------------------------ */

		/** Trim one half of a capsule down to the lines that carry text. */
		function blockLines(text) {
			if (typeof text !== "string" || text.trim() === "") return [];
			const lines = text.split(/\r?\n/).map((line) => line.replace(/\s+$/, ""));
			while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();
			while (lines.length > 0 && lines[0].trim() === "") lines.shift();
			return lines;
		}

		/**
		 * Fold a selection — plus the comment typed on it, if any — into the model's
		 * blockquote form. Kimi keeps both halves in one composer node
		 * (`{ text, comment }`) and shows them as one pill; the wire here is plain
		 * text, so both halves travel inside the same `> ❝ …` / `> ❞ …` block. One
		 * block means one capsule downstream, and anything typed after the chip
		 * stays outside the block instead of being swallowed by the comment.
		 */
		function quoteBlock(text, comment) {
			const halves = [
				{ mark: QUOTE_MARK, lines: blockLines(text) },
				{ mark: COMMENT_MARK, lines: blockLines(comment) }
			];
			const block = [];
			for (const half of halves) {
				for (let index = 0; index < half.lines.length; index += 1) {
					const line = half.lines[index];
					if (index === 0) block.push(line.trim() === "" ? "> " + half.mark : "> " + half.mark + " " + line);
					else block.push(line.trim() === "" ? ">" : "> " + line);
				}
			}
			return block.join("\n");
		}

		/**
		 * Read every serialized quote back out of a transcript run. One message can
		 * carry several chips, so a run is a sequence of loose text and `> ❝ …`
		 * blocks: each block becomes its own capsule and the loose text between
		 * them is drawn back verbatim (the blank lines the serializer adds around a
		 * block are filler, so they go).
		 *
		 * @returns {({ type: "text", text: string } | { type: "quote", quote: string, comment: string })[] | null}
		 */
		function splitQuoteRuns(text) {
			const value = String(text);
			if (value.indexOf(QUOTE_MARK) === -1) return null;
			const lines = value.split("\n");
			const segments = [];
			let loose = "";
			let index = 0;
			while (index < lines.length) {
				const line = lines[index];
				const mark = line.indexOf(QUOTE_MARK);
				const head = mark === -1 ? "" : line.slice(0, mark);
				// A block starts at the mark when only the blockquote's `>` (and the
				// space after it) precedes it — either as the first thing on the line
				// or glued to text on the same line, which is how a chip spliced
				// behind typed text serializes.
				const opens = head !== "" && (head.replace(/^[>\s]*$/u, "") === "" || />[ \t]*$/u.test(head));
				if (mark === -1 || !opens) {
					loose += (loose === "" ? "" : "\n") + line;
					index += 1;
					continue;
				}
				const prefix = head.replace(/>[ \t]*$/u, "");
				if (prefix !== "") loose += (loose === "" ? "" : "\n") + prefix;
				const body = [line.slice(mark + QUOTE_MARK.length).replace(/^\s/u, "")];
				index += 1;
				while (index < lines.length && lines[index].startsWith(">")) {
					body.push(lines[index].replace(/^>\s?/u, ""));
					index += 1;
				}
				const before = loose.replace(/^\s+/u, "").replace(/\s+$/u, "");
				if (before !== "") segments.push({ type: "text", text: before });
				loose = "";
				// `> ❞ …` opens the comment half of the same block: everything from
				// there down is the comment, everything above it is the quote.
				const cut = body.findIndex((entry) => entry.replace(/^\s+/u, "").startsWith(COMMENT_MARK));
				const quoteLines = cut === -1 ? body : body.slice(0, cut);
				const commentLines = cut === -1 ? [] : body.slice(cut);
				if (commentLines.length > 0) {
					commentLines[0] = commentLines[0]
						.replace(/^\s+/u, "")
						.slice(COMMENT_MARK.length)
						.replace(/^\s/u, "");
				}
				const quote = quoteLines.join("\n").replace(/\s+$/u, "");
				const comment = commentLines.join("\n").replace(/\s+$/u, "");
				if (quote.trim() !== "" || comment.trim() !== "") segments.push({ type: "quote", quote, comment });
			}
			const tail = loose.replace(/^\s+/u, "").replace(/\s+$/u, "");
			if (tail !== "") segments.push({ type: "text", text: tail });
			return segments.length === 0 ? null : segments;
		}

		function composerText() {
			const composer = document.querySelector(COMPOSER_SELECTOR);
			if (composer === null) return "";
			return String(composer.innerText === undefined ? composer.textContent : composer.innerText);
		}

		/** Quote (+ optional comment) exactly as it should land in the draft. */
		function buildPayload(text, comment) {
			const prefix = composerText().trim() === "" ? "" : "\n";
			return prefix + quoteBlock(text, comment) + "\n\n";
		}

		/** Kimi inserts at the caret; the composer answers a collapsed span at the end. */
		function insertPayload(entry, payload) {
			for (let attempt = 0; attempt < 2; attempt += 1) {
				const actions = entry.actions();
				if (actions === null || typeof actions.captureInsertion !== "function") return false;
				if (typeof actions.insertText !== "function") return false;
				const span = actions.captureInsertion();
				if (actions.insertText(payload, span) === true) return true;
			}
			return false;
		}

		/* ------------------------------------------------------------------ *
		 * Reference chip — DSH's own inline atomic node (Kimi's pill)
		 * ------------------------------------------------------------------ */

		/**
		 * A chip carries three projections: the label it renders, the clipboard
		 * form, and the ref the owner gets back at send time. The ref is opaque
		 * to the host, so the quote's model form travels inside it and the codec
		 * stays stateless (it survives a composer that outlives the plugin). The
		 * comment rides in that same ref, which is what lets the transcript keep
		 * the pair in one capsule instead of two unrelated pieces of text.
		 */
		function chipRef(text, comment) {
			// The leading newline puts the block on its own paragraph when the chip
			// lands after typed text; the send path trims it when the quote is
			// the whole message.
			return "\n" + quoteBlock(text, comment) + "\n\n";
		}

		/** The chip label spells the pair out the way Kimi's `display_text` does. */
		function chipLabel(text, comment) {
			const flat = (value) => String(value ?? "").replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
			const clip = (value, max) => (value.length > max ? value.slice(0, max - 1) + "…" : value);
			const quote = flat(text);
			const reply = flat(comment);
			if (reply === "") return clip(quote, 48);
			return clip(quote, 30) + " · " + clip(reply, 22);
		}

		/**
		 * The send path routes every chip back to its owner for a model form and
		 * fails the whole send ("no serializer for reference source") when the
		 * owner is gone — so the source must be registered before the first chip.
		 */
		const quoteSource = {
			trigger: SOURCE_TRIGGER,
			name: SOURCE_NAME,
			showGroupTitle: false,
			candidates: () => [],
			codec: {
				clipboardText: (ref) => ref,
				serialize: (ref) => Promise.resolve(String(ref))
			}
		};

		let pluginCtx = null;
		let sourceDisposer = null;

		/** Register the chip owner, once the input-trigger service is reachable. */
		function ensureSource() {
			if (sourceDisposer !== null) return true;
			if (pluginCtx === null) return false;
			let service = null;
			try {
				service = pluginCtx.get("inputTriggers");
			} catch (error) {
				service = null;
			}
			if (service === null || service === undefined || typeof service.registerSource !== "function") return false;
			try {
				const disposer = service.registerSource(quoteSource);
				sourceDisposer = typeof disposer === "function" ? disposer : () => {};
				return true;
			} catch (error) {
				console.warn("[ui-quote] reference source registration failed:", error);
				return false;
			}
		}

		/**
		 * Mint a chip through the conversation input service face: the resident
		 * shell owns the editor that can place an atomic node. Every step is
		 * optional — a missing service just falls back to the Markdown form.
		 */
		function insertChip(entry, sessionId, text, comment) {
			if (!ensureSource() || pluginCtx === null) return false;
			let hub = null;
			try {
				const conversation = pluginCtx.get("conversation");
				hub = conversation === null || conversation === undefined ? null : conversation.input;
			} catch (error) {
				hub = null;
			}
			if (hub === null || hub === undefined || typeof hub.shell !== "function") return false;
			let shell = null;
			try {
				shell = hub.shell(sessionId);
			} catch (error) {
				shell = null;
			}
			if (shell === null || shell === undefined || typeof shell.insertReference !== "function") return false;
			const model = chipRef(text, comment);
			const attachment = {
				source: SOURCE_NAME,
				ref: model,
				label: chipLabel(text, comment),
				appearance: "session",
				clipboardText: model
			};
			for (let attempt = 0; attempt < 2; attempt += 1) {
				const actions = entry.actions();
				if (actions === null || typeof actions.captureInsertion !== "function") return false;
				const span = actions.captureInsertion();
				try {
					if (shell.insertReference(attachment, span) === true) {
						// The chip is in the draft now: index the pair so hovering the
						// chip can show what `chipLabel` had to clip away.
						rememberChip(text, comment, sessionId);
						return true;
					}
				} catch (error) {
					return false;
				}
			}
			return false;
		}

		function focusComposer() {
			const composer = document.querySelector(COMPOSER_SELECTOR);
			if (composer === null) return;
			const editable = composer.querySelector('[contenteditable="true"], [data-lexical-editor]');
			const target = editable === null ? composer : editable;
			if (typeof target.focus === "function") target.focus({ preventScroll: true });
		}

		/* ------------------------------------------------------------------ *
		 * Sent-message capsule
		 * ------------------------------------------------------------------ */

		/**
		 * A sent message is plain text to DSH (`white-space: pre-wrap` over a bare
		 * text run), so the serialized quote lands in the transcript as a stack of
		 * `> …` lines — the readability problem this section fixes. Kimi Code
		 * shows one rounded pill instead.
		 *
		 * There is no per-message slot to render into: `conversation.chat.node` is
		 * key-routed by node kind and the core owns the `user` key, and a native
		 * `@…` chip is neither a capsule nor safe (it opens a file, and its label
		 * is reduced to a basename). So the capsule is drawn over the transcript:
		 * the run holding the quote is hidden, and the pill plus the user's own
		 * text are inserted beside it — one pill per quote, so a message that
		 * quotes three places gets three pills and keeps its wording in between.
		 * React's nodes are never moved or removed — only hidden and re-read —
		 * which keeps re-renders safe and every capsule idempotent.
		 */
		/** run element -> { text, nodes } for every enhanced transcript run. */
		const capsules = new Map();
		const capsuleDirty = new Set();
		let capsuleObserver = null;
		let capsuleTimer = null;

		function translateFor(sessionId, key) {
			const entry = typeof sessionId === "string" ? sessions.get(sessionId) : undefined;
			if (entry !== undefined && entry !== null) {
				const value = entry.translate(key);
				if (typeof value === "string" && value !== "") return value;
			}
			return zh[key] === undefined ? key : zh[key];
		}

		/** The text run that carries a serialized quote, if this element is one. */
		function isQuoteRun(element) {
			if (element === null || element.nodeType !== 1 || element.childNodes.length !== 1) return false;
			const child = element.childNodes[0];
			if (child.nodeType !== 3 || typeof child.nodeValue !== "string") return false;
			if (child.nodeValue.indexOf(QUOTE_MARK) === -1) return false;
			if (typeof element.closest !== "function") return false;
			if (element.closest("[data-dshq]") !== null) return false;
			return element.closest(CONTENT_SELECTOR) !== null;
		}

		function sessionOf(element) {
			const host = closestFrom(element, CONTENT_SELECTOR);
			if (host === null) return null;
			const id = host.getAttribute("data-conversation-session");
			return typeof id === "string" && id !== "" ? id : null;
		}

		function writeClipboard(text) {
			try {
				if (typeof navigator === "undefined" || navigator.clipboard === undefined) return;
				if (typeof navigator.clipboard.writeText !== "function") return;
				navigator.clipboard.writeText(text);
			} catch (error) {
				// A denied clipboard is not worth a toast: the quote is still on screen.
			}
		}

		/**
		 * Kimi's pill, in DOM form: the quote and, after a hairline, its comment —
		 * one quiet line while collapsed, both halves in full once clicked. A
		 * collapsed line cannot be read on its own, so hovering (or focusing) the
		 * pill opens the hover card with both halves untruncated. `segment` is one
		 * `{ type: "quote", quote, comment }` run out of the message; the comment
		 * is empty for a plain 添加到对话 chip.
		 */
		function capsuleFor(doc, segment, sessionId) {
			const label = translateFor(sessionId, "quoteLabel");
			const comment = typeof segment.comment === "string" ? segment.comment : "";
			const pair = comment === "" ? segment.quote : segment.quote + " · " + comment;
			const copy = el(doc, "button", {
				type: "button",
				class: "dshq-cap-copy",
				text: translateFor(sessionId, "copy")
			});
			copy.addEventListener("click", (event) => {
				event.stopPropagation();
				// The same `quote · comment` spelling Kimi stores as display_text.
				writeClipboard(pair);
				copy.textContent = translateFor(sessionId, "copied");
				setTimeout(() => {
					copy.textContent = translateFor(sessionId, "copy");
				}, 1200);
			});

			const children = [
				el(doc, "span", { class: "dshq-cap-mark", text: QUOTE_MARK }),
				el(doc, "span", { class: "dshq-cap-quote", text: segment.quote })
			];
			if (comment !== "") children.push(el(doc, "span", { class: "dshq-cap-comment", text: comment }));
			children.push(copy);

			const cap = el(
				doc,
				"div",
				{
					class: "dshq-cap",
					"data-dshq": "capsule",
					role: "figure",
					tabindex: "0",
					"aria-label": label
				},
				children
			);
			const info = { quote: segment.quote, comment, sessionId };
			cap.addEventListener("mouseenter", () => showPopover(cap, info));
			cap.addEventListener("mouseleave", hidePopoverSoon);
			cap.addEventListener("focus", () => showPopover(cap, info));
			cap.addEventListener("blur", hidePopover);
			cap.addEventListener("click", (event) => {
				const target = event.target instanceof Element ? event.target : null;
				if (target !== null && target.closest(".dshq-cap-copy") !== null) return;
				// Dragging a selection inside the quote must not toggle the pill.
				const selection = doc.getSelection === undefined ? null : doc.getSelection();
				if (selection !== null && !selection.isCollapsed) return;
				cap.dataset.expanded = cap.dataset.expanded === "true" ? "false" : "true";
			});
			return cap;
		}

		/* ------------------------------------------------------------------ *
		 * Hover card — the quote and its comment in full
		 * ------------------------------------------------------------------ */

		/**
		 * A collapsed pill holds one clipped line per half and the chip in the
		 * composer is clipped even harder (`chipLabel` cuts the quote at 30
		 * characters), so both are unreadable on their own — the failure the user
		 * hit. Hovering either one opens this card: quote and comment in full,
		 * wrapped and never clipped, each under the same `❝`/`❞` mark the capsule
		 * uses, which is the reading position Kimi's pill gives on click.
		 *
		 * The card is parked on `<body>` and positioned `fixed`: a chat bubble and
		 * the composer both clip their overflow, so a card inserted next to its
		 * anchor would be cut off. It stays open while the pointer travels from
		 * the anchor to the card (hence the 140 ms grace), and it takes the
		 * pointer, so the text inside it can be selected and copied.
		 */
		let popover = null;
		let popoverHideTimer = null;
		let popoverWired = false;
		/** What the card is currently attached to, so it can die with it. */
		let popoverAnchor = null;
		/** normalised chip label -> { quote, comment, sessionId } for our chips. */
		const chipIndex = new Map();
		/** chip element -> its listeners, so uninstall can unhook them. */
		const wiredChips = new Map();
		/** Chips are few; a bounded index keeps a long session from growing. */
		const CHIP_LIMIT = 24;
		/** Transcript flushes to look for a chip that React has not rendered yet. */
		const CHIP_WIRE_BUDGET = 40;
		let chipWiresPending = 0;
		let chipWireBudget = 0;

		function cancelPopoverHide() {
			if (popoverHideTimer === null) return;
			clearTimeout(popoverHideTimer);
			popoverHideTimer = null;
		}

		function hidePopover() {
			cancelPopoverHide();
			popoverAnchor = null;
			if (popover !== null) popover.dataset.visible = "false";
		}

		/** Leaving an anchor is not instant: the pointer may be on its way here. */
		function hidePopoverSoon() {
			cancelPopoverHide();
			popoverHideTimer = setTimeout(() => {
				popoverHideTimer = null;
				hidePopover();
			}, POPOVER_HIDE_MS);
		}

		/** A moved page leaves a fixed card behind, so scrolling just closes it. */
		function onPopoverViewport() {
			hidePopover();
		}

		function ensurePopover(doc) {
			if (popover !== null && popover.isConnected) return popover;
			const node = el(doc, "div", {
				id: POPOVER_ID,
				class: "dshq-pop",
				"data-dshq": "popover",
				role: "tooltip"
			});
			// The theme lives in CSS variables, which are inherited: without this
			// the card would keep the hard-coded fallback colours.
			applyTheme(node);
			node.addEventListener("mouseenter", cancelPopoverHide);
			node.addEventListener("mouseleave", hidePopover);
			const host = doc.body === undefined || doc.body === null ? doc.documentElement : doc.body;
			if (host !== null && host !== undefined) host.append(node);
			popover = node;
			return node;
		}

		function popoverRow(doc, mark, label, meta) {
			const row = el(doc, "div", { class: "dshq-pop-head" }, [
				el(doc, "span", { class: "dshq-pop-mark", text: mark }),
				el(doc, "span", { class: "dshq-pop-label", text: label })
			]);
			if (meta !== "") row.append(el(doc, "span", { class: "dshq-pop-meta", text: meta }));
			return row;
		}

		function fillPopover(doc, info) {
			const node = ensurePopover(doc);
			node.textContent = "";
			const lines = String(info.quote).split("\n").length;
			// `quoteMeta` used to be the pill's tooltip; the card is where it can
			// actually be read, so it moved here.
			const meta = String(translateFor(info.sessionId, "quoteMeta")).replace("{lines}", String(lines));
			node.append(popoverRow(doc, QUOTE_MARK, translateFor(info.sessionId, "quoteLabel"), meta));
			node.append(el(doc, "div", { class: "dshq-pop-text dshq-pop-quote", text: info.quote }));
			if (info.comment !== "") {
				node.append(popoverRow(doc, COMMENT_MARK, translateFor(info.sessionId, "comment"), ""));
				node.append(el(doc, "div", { class: "dshq-pop-text dshq-pop-comment", text: info.comment }));
			}
			// Only quotes we watched being selected can be traced back: the row
			// they came from is remembered at insert time, not stored in the text.
			if (sourceFor(info.quote) !== null) {
				const jump = el(doc, "button", {
					type: "button",
					class: "dshq-pop-jump",
					text: translateFor(info.sessionId, "jump")
				});
				jump.addEventListener("click", (event) => {
					event.stopPropagation();
					jumpToSource(info.quote, info.sessionId);
				});
				node.append(jump);
			}
			return node;
		}

		/** Below the anchor, flipped above when it would not fit, clamped to view. */
		function placePopover(node, anchor) {
			if (typeof anchor.getBoundingClientRect !== "function") return;
			if (typeof node.getBoundingClientRect !== "function") return;
			const rect = anchor.getBoundingClientRect();
			const box = node.getBoundingClientRect();
			if (rect === null || rect === undefined || box === null || box === undefined) return;
			const view = typeof window === "undefined" ? null : window;
			const viewWidth = view === null || !Number.isFinite(view.innerWidth) ? 0 : view.innerWidth;
			const viewHeight = view === null || !Number.isFinite(view.innerHeight) ? 0 : view.innerHeight;
			let left = rect.left;
			if (viewWidth > 0) left = clamp(left, EDGE, Math.max(EDGE, viewWidth - box.width - EDGE));
			let top = rect.bottom + GAP;
			if (viewHeight > 0 && box.height > 0 && top + box.height > viewHeight - EDGE) {
				const above = rect.top - GAP - box.height;
				if (above > EDGE) top = above;
			}
			node.style.setProperty("left", Math.round(left) + "px");
			node.style.setProperty("top", Math.round(top) + "px");
		}

		function showPopover(anchor, info) {
			const doc = anchor.ownerDocument;
			if (doc === null || doc === undefined) return;
			cancelPopoverHide();
			const node = fillPopover(doc, info);
			// Measure after it is visible: a `display:none` card has no box.
			node.dataset.visible = "true";
			popoverAnchor = anchor;
			placePopover(node, anchor);
		}

		/**
		 * Sending the message throws the composer chip away, and a removed node
		 * never fires `mouseleave` — so a card that is still up would hang there
		 * with nothing under it. It closes as soon as its anchor is gone.
		 */
		function dropDetachedPopover() {
			if (popoverAnchor === null) return;
			if (popoverAnchor.isConnected) return;
			hidePopover();
		}

		/** `chipLabel(quote, comment)` is exactly what the composer chip renders. */
		function rememberChip(quote, comment, sessionId) {
			const label = normalizeLabel(chipLabel(quote, comment));
			if (label === "") return;
			if (chipIndex.has(label)) chipIndex.delete(label);
			chipIndex.set(label, { quote, comment: typeof comment === "string" ? comment : "", sessionId });
			while (chipIndex.size > CHIP_LIMIT) chipIndex.delete(chipIndex.keys().next().value);
			chipWiresPending += 1;
			chipWireBudget = CHIP_WIRE_BUDGET;
		}

		/* ------------------------------------------------------------------ *
		 * Jump back — the message a quote came from
		 * ------------------------------------------------------------------ */

		/**
		 * The key a quote is remembered under: its own wording, whitespace folded
		 * and capped, so a long paragraph does not become the key.
		 */
		function sourceKeyOf(quote) {
			return String(quote).replace(/\s+/gu, " ").trim().slice(0, 120);
		}

		/** quote key -> { sessionId, attr, key, turn }; loaded once, written on use. */
		const sourceIndex = (() => {
			const map = new Map();
			const stored = readThreadMap(SOURCE_KEY);
			if (stored !== null) {
				for (const [key, value] of Object.entries(stored)) {
					if (value !== null && typeof value === "object") map.set(key, value);
				}
			}
			return map;
		})();

		function persistSources() {
			try {
				if (typeof localStorage === "undefined") return;
				const plain = {};
				for (const [key, value] of sourceIndex) plain[key] = value;
				localStorage.setItem(SOURCE_KEY, JSON.stringify(plain));
			} catch (error) {
				// A denied or full store only costs the jump-back row.
			}
		}

		/** Remember where a quote was selected from, so it can be found again. */
		function saveSource(quote, sessionId, source) {
			const key = sourceKeyOf(quote);
			if (key.length < 4 || source === null || typeof source !== "object") return;
			if (sourceIndex.has(key)) sourceIndex.delete(key);
			sourceIndex.set(key, { sessionId, attr: source.attr, key: source.key, turn: source.turn });
			while (sourceIndex.size > SOURCE_LIMIT) sourceIndex.delete(sourceIndex.keys().next().value);
			persistSources();
		}

		function sourceFor(quote) {
			const found = sourceIndex.get(sourceKeyOf(quote));
			return found === undefined ? null : found;
		}

		/** The chat row a transcript node belongs to: anchor key first, node key next. */
		function chatRowOf(node) {
			for (const attr of ["data-chat-anchor-key", "data-chat-node-key"]) {
				const row = closestFrom(node, "[" + attr + "]");
				if (row === null) continue;
				const key = row.getAttribute(attr);
				if (typeof key !== "string" || key === "") continue;
				const turn = row.getAttribute("data-chat-turn");
				return { attr, key, turn: typeof turn === "string" ? turn : "" };
			}
			return null;
		}

		function escapeAttr(value) {
			if (typeof CSS !== "undefined" && CSS !== null && typeof CSS.escape === "function") return CSS.escape(String(value));
			return String(value).replace(/["\\]/gu, "\\$&");
		}

		/**
		 * 跳回原文 — scroll the quoted message back into view and flash it. The
		 * row's anchor key is the handle DSH gives a plugin (there is no message id
		 * and no scroll API); a row the virtualizer has unmounted is tried by turn
		 * instead, and when neither resolves the reader is told rather than left
		 * wondering.
		 *
		 * @returns {boolean} whether the source was found and revealed.
		 */
		function jumpToSource(quote, sessionId) {
			const source = sourceFor(quote);
			if (source === null) return false;
			let row = document.querySelector("[" + source.attr + '="' + escapeAttr(source.key) + '"]');
			if (row === null && typeof source.turn === "string" && source.turn !== "") {
				row = document.querySelector('[data-chat-turn="' + escapeAttr(source.turn) + '"]');
			}
			if (row === null || typeof row.scrollIntoView !== "function") {
				const id = sessionId === null || sessionId === undefined ? source.sessionId : sessionId;
				toast(translateFor(id, "jumpFailed"));
				return false;
			}
			row.scrollIntoView({ behavior: "smooth", block: "center" });
			row.setAttribute(FLASH_ATTR, "true");
			setTimeout(() => row.removeAttribute(FLASH_ATTR), FLASH_MS);
			return true;
		}

		function normalizeLabel(value) {
			return String(value === null || value === undefined ? "" : value)
				.replace(/\s+/gu, " ")
				.replace(/^ +| +$/gu, "");
		}

		function chipInfoFor(element) {
			const text = normalizeLabel(element.textContent);
			if (text === "") return null;
			const exact = chipIndex.get(text);
			if (exact !== undefined) return exact;
			// The chip may draw a leading mark of its own (`❝ `) next to the label.
			const bare = text.replace(/^[\u275d\u275e\u2022\u00b7]\s*/u, "");
			if (bare === text) return null;
			const info = chipIndex.get(bare);
			return info === undefined ? null : info;
		}

		/**
		 * Hook the hover card onto the chips this plugin put in the composer. The
		 * chip node belongs to React and is anonymous, so it is found by its text:
		 * the native chip renders `chipLabel` verbatim and the index is keyed by
		 * that same string. Scans stop as soon as every minted chip was seen — a
		 * mint re-arms them, and a re-created chip re-arms them too.
		 */
		function wireChips() {
			let pruned = 0;
			for (const element of Array.from(wiredChips.keys())) {
				if (element.isConnected) continue;
				// A chip React threw away keeps no listeners and no marker: if it
				// ever comes back, the text index hooks it again on the next scan.
				const hooks = wiredChips.get(element);
				if (hooks !== undefined && typeof element.removeEventListener === "function") {
					element.removeEventListener("mouseenter", hooks.enter);
					element.removeEventListener("mouseleave", hooks.leave);
				}
				if (typeof element.removeAttribute === "function") element.removeAttribute("data-dshq-chip");
				wiredChips.delete(element);
				pruned += 1;
			}
			if (pruned > 0) chipWireBudget = CHIP_WIRE_BUDGET;
			if (chipWiresPending <= 0 && pruned === 0) return;
			chipWireBudget -= 1;
			if (chipWireBudget < 0) return;
			if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") return;
			let wired = 0;
			for (const host of document.querySelectorAll(CARD_SELECTOR)) {
				if (typeof host.querySelectorAll !== "function") continue;
				for (const candidate of host.querySelectorAll("*")) {
					if (candidate.getAttribute("data-dshq-chip") !== null) continue;
					if (typeof candidate.closest === "function" && candidate.closest("[data-dshq-chip]") !== null) continue;
					const info = chipInfoFor(candidate);
					if (info === null) continue;
					// The label is resolved again on every hover: React reuses a chip
					// node for the next quote instead of adding a second one, so the
					// info captured here can go stale without any node changing.
					const enter = () => {
						const fresh = chipInfoFor(candidate);
						if (fresh === null) {
							hidePopover();
							return;
						}
						showPopover(candidate, fresh);
					};
					const leave = () => hidePopoverSoon();
					candidate.addEventListener("mouseenter", enter);
					candidate.addEventListener("mouseleave", leave);
					candidate.setAttribute("data-dshq-chip", "1");
					wiredChips.set(candidate, { enter, leave });
					wired += 1;
				}
			}
			if (wired > 0) chipWiresPending = 0;
		}

		function unhookChips() {
			for (const [element, hooks] of Array.from(wiredChips.entries())) {
				if (typeof element.removeEventListener === "function") {
					element.removeEventListener("mouseenter", hooks.enter);
					element.removeEventListener("mouseleave", hooks.leave);
				}
				element.removeAttribute("data-dshq-chip");
			}
			wiredChips.clear();
			chipIndex.clear();
			chipWiresPending = 0;
			chipWireBudget = 0;
		}

		/**
		 * Swap one transcript run for its capsules (and re-render its loose text).
		 * A run with several quotes gets one capsule per quote, in the order the
		 * chips were sent, with the user's own wording kept where it was.
		 */
		function enhance(run) {
			if (!run.isConnected) {
				dropCapsule(run);
				return;
			}
			const text = run.textContent === null ? "" : String(run.textContent);
			const segments = splitQuoteRuns(text);
			const known = capsules.get(run);
			if (segments === null) {
				if (known !== undefined) dropCapsule(run);
				return;
			}
			if (known !== undefined && known.text === text && known.nodes.every((node) => node.isConnected)) return;
			if (known !== undefined) dropCapsule(run);

			const doc = run.ownerDocument;
			const sessionId = sessionOf(run);
			const nodes = [];
			for (const segment of segments) {
				if (segment.type === "text") {
					nodes.push(el(doc, "span", { class: "dshq-body", "data-dshq": "body", text: segment.text }));
					continue;
				}
				nodes.push(capsuleFor(doc, segment, sessionId));
			}

			const parent = run.parentNode;
			if (parent === null) return;
			capsules.set(run, { text, nodes });
			run.style.display = "none";
			for (const node of nodes) parent.insertBefore(node, run);
		}

		function dropCapsule(run) {
			const known = capsules.get(run);
			capsules.delete(run);
			run.style.removeProperty("display");
			if (known === undefined) return;
			for (const node of known.nodes) {
				if (node.isConnected) node.remove();
			}
			// The card may be anchored to a pill that just went away.
			hidePopover();
		}

		function collectRuns(node, into) {
			const element = elementOf(node);
			if (element === null) return;
			if (isQuoteRun(element)) into.add(element);
			if (typeof element.querySelectorAll !== "function") return;
			for (const candidate of element.querySelectorAll("*")) {
				if (isQuoteRun(candidate)) into.add(candidate);
			}
		}

		function onCapsuleMutations(records) {
			for (const record of records) {
				if (record.type === "characterData") {
					collectRuns(record.target, capsuleDirty);
					continue;
				}
				for (const node of record.addedNodes) collectRuns(node, capsuleDirty);
				for (const node of record.removedNodes) {
					if (node.nodeType === 1 && capsules.has(node)) capsuleDirty.add(node);
				}
				const target = elementOf(record.target);
				if (target !== null && capsules.has(target)) capsuleDirty.add(target);
			}
			scheduleCapsules();
		}

		function scheduleCapsules() {
			if (capsuleTimer !== null) return;
			capsuleTimer = setTimeout(flushCapsules, 32);
		}

		function flushCapsules() {
			capsuleTimer = null;
			dropDetachedPopover();
			for (const run of Array.from(capsules.keys())) {
				if (!run.isConnected) dropCapsule(run);
			}
			const runs = Array.from(capsuleDirty);
			capsuleDirty.clear();
			for (const run of runs) {
				if (run.isConnected) enhance(run);
				else if (capsules.has(run)) dropCapsule(run);
			}
			wireChips();
		}

		function ensureCapsuleStyle(doc) {
			if (doc.getElementById(CAPSULE_STYLE_ID) !== null) return;
			const parent = doc.head === undefined || doc.head === null ? doc.documentElement : doc.head;
			if (parent === null || parent === undefined) return;
			const style = el(doc, "style", { id: CAPSULE_STYLE_ID, "data-plugin": "dsh-client-ui-quote" });
			style.textContent = CAPSULE_STYLE_TEXT;
			parent.append(style);
		}

		function installCapsules() {
			if (typeof document === "undefined" || typeof MutationObserver === "undefined") return () => {};
			try {
				ensureCapsuleStyle(document);
			} catch (error) {
				// A missing <head> must not take the plugin down.
			}
			const target = document.body === undefined || document.body === null ? document.documentElement : document.body;
			if (capsuleObserver === null && target !== null && target !== undefined) {
				capsuleObserver = new MutationObserver(onCapsuleMutations);
				capsuleObserver.observe(target, { childList: true, subtree: true, characterData: true });
			}
			if (typeof document.querySelectorAll === "function") {
				for (const host of document.querySelectorAll(CONTENT_SELECTOR)) collectRuns(host, capsuleDirty);
			}
			// A fixed card would otherwise hang in place after the page moved.
			if (!popoverWired && typeof window !== "undefined" && typeof window.addEventListener === "function") {
				window.addEventListener("scroll", onPopoverViewport, true);
				window.addEventListener("resize", onPopoverViewport);
				popoverWired = true;
			}
			scheduleCapsules();
			return uninstallCapsules;
		}

		function uninstallCapsules() {
			if (capsuleObserver !== null) {
				capsuleObserver.disconnect();
				capsuleObserver = null;
			}
			if (capsuleTimer !== null) {
				clearTimeout(capsuleTimer);
				capsuleTimer = null;
			}
			capsuleDirty.clear();
			for (const run of Array.from(capsules.keys())) dropCapsule(run);
			cancelPopoverHide();
			unhookChips();
			if (popover !== null) {
				if (popover.isConnected) popover.remove();
				popover = null;
			}
			if (popoverWired && typeof window !== "undefined") {
				if (typeof window.removeEventListener === "function") {
					window.removeEventListener("scroll", onPopoverViewport, true);
					window.removeEventListener("resize", onPopoverViewport);
				}
				popoverWired = false;
			}
			if (typeof document !== "undefined") {
				const style = document.getElementById(CAPSULE_STYLE_ID);
				if (style !== null) style.remove();
			}
		}

		/* ------------------------------------------------------------------ *
		 * Bar element
		 * ------------------------------------------------------------------ */

		const sessions = new Map();
		const state = {
			bar: null,
			style: null,
			toast: null,
			toastTimer: null,
			quote: null,
			anchor: null,
			mode: null,
			sessionId: null,
			comment: "",
			/** Where the current selection was picked up, for the jump-back row. */
			source: null,
			settle: null,
			listeners: 0,
			pointerOnTranscript: false,
			suppress: false
		};

		function pickColor(value, fallback) {
			if (typeof value !== "string" || value === "") return fallback;
			if (value === "transparent" || value === "rgba(0, 0, 0, 0)") return fallback;
			return value;
		}

		function surfaceStyles() {
			const candidates = [CARD_SELECTOR, CONTENT_SELECTOR, "body"];
			for (const selector of candidates) {
				const node = document.querySelector(selector);
				if (node === null) continue;
				const styles = getComputedStyle(node);
				if (styles === null) continue;
				if (pickColor(styles.backgroundColor, null) !== null) return styles;
			}
			return null;
		}

		/** Borrow the composer card's palette so the bar matches either theme. */
		function applyTheme(bar) {
			const styles = surfaceStyles();
			bar.style.setProperty("--dshq-bg", pickColor(styles === null ? null : styles.backgroundColor, "#27272a"));
			bar.style.setProperty("--dshq-fg", pickColor(styles === null ? null : styles.color, "#f4f4f5"));
			bar.style.setProperty("--dshq-border", pickColor(styles === null ? null : styles.borderTopColor, "rgba(127,127,127,.34)"));
			bar.style.setProperty("--dshq-hover", "rgba(127,127,127,.18)");
			bar.style.setProperty("--dshq-faint", "rgba(127,127,127,.95)");
			bar.style.setProperty("--dshq-accent", "#3b82f6");
			bar.style.setProperty("--dshq-radius", pickColor(styles === null ? null : styles.borderRadius, "10px"));
			bar.style.setProperty("--dshq-font", styles === null || !styles.fontFamily ? "inherit" : styles.fontFamily);
		}

		function ensureStyle(doc) {
			let style = doc.getElementById(STYLE_ID);
			if (style === null) {
				style = el(doc, "style", { id: STYLE_ID });
				style.textContent = STYLE_TEXT;
				doc.head.append(style);
			}
			return style;
		}

		function onBarMouseDown(event) {
			// Keep the transcript selection alive while the user clicks a row --
			// except in the textarea, which needs the default focus behaviour.
			if (event.target instanceof Element && event.target.closest(".dshq-input") !== null) return;
			event.preventDefault();
		}

		function onBarClick(event) {
			const target = event.target instanceof Element ? event.target.closest("[data-action]") : null;
			if (target === null) return;
			const action = target.getAttribute("data-action");
			if (action === "comment") openComment();
			else if (action === "add") commit("");
			else if (action === "sidechat") openSideChat();
			else if (action === "cancel") close();
			else if (action === "confirm") commit(state.comment);
		}

		function ensureBar(doc) {
			ensureStyle(doc);
			if (state.bar !== null && state.bar.isConnected) {
				applyTheme(state.bar);
				return state.bar;
			}
			const bar = el(doc, "div", { id: BAR_ID, "data-visible": "false" });
			bar.addEventListener("mousedown", onBarMouseDown);
			bar.addEventListener("click", onBarClick);
			doc.body.append(bar);
			state.bar = bar;
			applyTheme(bar);
			return bar;
		}

		function row(doc, action, icon, label, role, extra) {
			return el(doc, "button", {
				type: "button",
				class: extra === undefined || extra === "" ? "dshq-row" : "dshq-row " + extra,
				"data-action": action,
				role
			}, [
				el(doc, "span", { class: "dshq-icon", html: icon }),
				el(doc, "span", { class: "dshq-label", text: label })
			]);
		}

		function translate(key) {
			return translateFor(state.sessionId, key);
		}

		/** Menu mode: Kimi's 评论 / 添加到对话 rows, plus our 侧边对话 when available. */
		function renderMenu(bar) {
			const doc = bar.ownerDocument;
			bar.setAttribute("role", "menu");
			bar.removeAttribute("aria-label");
			const rows = [
				row(doc, "comment", ICON_MESSAGE, translate("comment"), "menuitem"),
				row(doc, "add", ICON_PLUS, translate("addToChat"), "menuitem")
			];
			// The third row is the plugin's own extension (Kimi ships two): it
			// drives dsh-better-sidebar's side chat, so it only renders while
			// that service — and its enabled sidechat tab — is actually there.
			if (sideChatService() !== null) {
				rows.push(row(doc, "sidechat", ICON_SIDEBAR, translate("sideChat"), "menuitem", "dshq-row-sidechat"));
			}
			bar.replaceChildren(...rows);
		}

		/** Comment mode: the inline comment box Kimi swaps in behind 评论. */
		function renderComment(bar) {
			const doc = bar.ownerDocument;
			bar.setAttribute("role", "dialog");
			bar.setAttribute("aria-label", translate("comment"));

			const input = el(doc, "textarea", {
				class: "dshq-input",
				rows: "1",
				placeholder: translate("commentPlaceholder")
			});
			input.value = state.comment;
			input.addEventListener("input", () => {
				state.comment = input.value;
				input.style.height = "auto";
				input.style.height = Math.min(input.scrollHeight, COMMENT_MAX_HEIGHT) + "px";
				const confirm = bar.querySelector('[data-action="confirm"]');
				if (confirm !== null) confirm.disabled = input.value.trim().length === 0;
			});
			input.addEventListener("keydown", (event) => {
				if (event.isComposing === true) return;
				if (event.key === "Escape") {
					event.stopPropagation();
					close();
					return;
				}
				if (event.key === "Enter" && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) {
					event.preventDefault();
					commit(state.comment);
				}
			});

			const confirm = el(doc, "button", {
				type: "button",
				class: "dshq-btn dshq-btn-primary",
				"data-action": "confirm",
				disabled: state.comment.trim().length === 0 ? true : null
			}, [el(doc, "span", { text: translate("addToChat") }), el(doc, "span", { class: "dshq-enter", text: "⏎" })]);
			if (state.comment.trim().length === 0) confirm.disabled = true;

			bar.replaceChildren(
				el(doc, "div", { class: "dshq-comment" }, [
					input,
					el(doc, "div", { class: "dshq-actions" }, [
						el(doc, "button", { type: "button", class: "dshq-btn", "data-action": "cancel" }, [translate("cancel")]),
						confirm
					])
				])
			);
			return input;
		}

		function position() {
			const bar = state.bar;
			const anchor = state.anchor;
			if (bar === null || anchor === null) return;

			bar.style.visibility = "hidden";
			bar.dataset.visible = "true";

			const viewport = window.visualViewport;
			const width = viewport === undefined || viewport === null ? window.innerWidth : viewport.width;
			const height = viewport === undefined || viewport === null ? window.innerHeight : viewport.height;
			const offsetLeft = viewport === undefined || viewport === null ? 0 : viewport.offsetLeft;
			const offsetTop = viewport === undefined || viewport === null ? 0 : viewport.offsetTop;

			const barWidth = bar.offsetWidth;
			const barHeight = bar.offsetHeight;
			bar.style.maxWidth = Math.max(0, width - 2 * EDGE) + "px";
			bar.style.maxHeight = Math.max(0, height - 2 * EDGE) + "px";

			const left = clamp(anchor.x - barWidth / 2, offsetLeft + EDGE, offsetLeft + width - barWidth - EDGE);
			const top = barTop(anchor, barHeight, height, offsetTop);

			bar.style.left = Math.round(left) + "px";
			bar.style.top = Math.round(top) + "px";
			bar.style.visibility = "";
		}

		function open(found) {
			const bar = ensureBar(document);
			state.quote = found.text;
			state.anchor = { x: found.x, y: found.y, bottom: found.bottom };
			state.sessionId = found.sessionId;
			state.comment = "";
			state.source = found.source === undefined ? null : found.source;
			state.mode = "menu";
			state.suppress = false;
			renderMenu(bar);
			position();
		}

		/** 评论: swap the bar into its comment box and put the caret in it. */
		function openComment() {
			const bar = ensureBar(document);
			state.mode = "comment";
			state.comment = "";
			const input = renderComment(bar);
			position();
			input.focus({ preventScroll: true });
		}

		function close() {
			if (state.settle !== null) {
				clearTimeout(state.settle);
				state.settle = null;
			}
			state.mode = null;
			state.quote = null;
			state.anchor = null;
			state.sessionId = null;
			state.comment = "";
			state.source = null;
			state.suppress = true;
			if (state.bar !== null) {
				state.bar.dataset.visible = "false";
				state.bar.replaceChildren();
			}
		}

		function toast(text) {
			const doc = document;
			ensureStyle(doc);
			let node = doc.getElementById(TOAST_ID);
			if (node === null) {
				node = el(doc, "div", { id: TOAST_ID });
				doc.body.append(node);
			}
			node.textContent = text;
			const anchor = state.anchor;
			const left = anchor === null ? window.innerWidth / 2 : clamp(anchor.x, EDGE + 40, window.innerWidth - 40);
			node.style.left = Math.round(left) + "px";
			node.style.top = Math.round((anchor === null ? window.innerHeight / 2 : anchor.bottom) + GAP) + "px";
			node.dataset.visible = "true";
			if (state.toastTimer !== null) clearTimeout(state.toastTimer);
			state.toastTimer = setTimeout(() => {
				state.toastTimer = null;
				node.dataset.visible = "false";
			}, TOAST_MS);
		}

		/** Fire a bar action: drop the selection, write the draft, take focus. */
		function commit(comment) {
			const sessionId = state.sessionId;
			const text = state.quote;
			const source = state.source;
			const entry = sessionId === null ? null : sessions.get(sessionId);
			const trimmed = typeof comment === "string" ? comment.trim() : "";
			close();
			if (text === null || entry === null || entry === undefined) return;

			// Remember the row this came from before anything can fail: the jump
			// row is keyed by the quote's own wording, so it survives the send.
			if (source !== null) saveSource(text, sessionId, source);

			// Kimi drops the transcript selection the moment an action is chosen.
			const selection = document.getSelection === undefined ? null : document.getSelection();
			if (selection !== null) selection.removeAllRanges();

			// DSH's own inline chip is the Kimi pill; the Markdown form below is
			// the fallback for every build where that service face is missing.
			// A comment rides inside that chip — one node, one capsule after the
			// send — so 评论 writes nothing else into the draft.
			if (insertChip(entry, sessionId, text, trimmed)) {
				focusComposer();
				return;
			}
			if (insertPayload(entry, buildPayload(text, trimmed))) focusComposer();
			else toast(translate("failed"));
		}

		/* ------------------------------------------------------------------ *
		 * 侧边对话 — quote into an independent side chat (dsh-better-sidebar)
		 *
		 * Borrowed from three agents: Kimi Code's `/btw` (one click opens the
		 * side chat AND delivers the quote as its first message), Qoder's side
		 * tasks (a second click while a thread is being created folds into the
		 * first, and a failed open only costs one toast), and WorkBuddy's
		 * quote-and-annotation flow (the thread keeps the quote as its durable
		 * first message instead of a transient composer attachment). The row is
		 * drawn in DeepSeek's whale blue, the plugin's one branded touch.
		 * ------------------------------------------------------------------ */

		/**
		 * The betterSidebar service face, but only while its sidechat tab type
		 * is registered AND enabled: without it the third row simply does not
		 * exist, the same way the chip path falls back to plain text.
		 * @returns {object | null} the service, or null when unavailable.
		 */
		function sideChatService() {
			if (pluginCtx === null) return null;
			let service = null;
			try {
				service = pluginCtx.get("betterSidebar");
			} catch (error) {
				service = null;
			}
			if (service === null || service === undefined) return null;
			if (typeof service.getTab !== "function" || typeof service.isTabEnabled !== "function" || typeof service.openTab !== "function") {
				return null;
			}
			let descriptor = null;
			try {
				descriptor = service.getTab(SIDECHAT_TAB);
			} catch (error) {
				descriptor = null;
			}
			if (descriptor === null || descriptor === undefined) return null;
			let enabled = false;
			try {
				enabled = service.isTabEnabled(SIDECHAT_TAB) === true;
			} catch (error) {
				enabled = false;
			}
			return enabled ? service : null;
		}

		/**
		 * The quote as the side thread's first message: a plain blockquote. The
		 * `❝` marks stay out on purpose — they exist for the MAIN transcript's
		 * capsule enhancer, and the side thread renders its own way.
		 */
		function sideQuestion(text) {
			return blockLines(text)
				.map((line) => (line.trim() === "" ? ">" : "> " + line))
				.join("\n");
		}

		/**
		 * The opened tab's title until the thread's first prompt renames it:
		 * the quote's first line, clipped like a chip label.
		 */
		function sideChatTitle(text) {
			const lines = blockLines(text);
			const line = lines.length === 0 ? "" : lines[0].trim();
			return line.length > 24 ? line.slice(0, 23) + "…" : line;
		}

		/** In-flight thread creations per session (a second click folds into the first). */
		const sideChatPending = new Map();

		/** One stored "session → side thread" map, best effort (a denied store is fine). */
		function readThreadMap(key) {
			try {
				const parsed = JSON.parse(localStorage.getItem(key));
				return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
			} catch (error) {
				return {};
			}
		}

		/**
		 * The side thread of a main session: better-sidebar's own memory first
		 * (it writes it whenever a tab binds a thread, so it is the truth about
		 * what the sidebar shows), then the one this plugin keeps.
		 */
		function storedSideThread(sessionId) {
			if (typeof sessionId !== "string" || sessionId === "") return null;
			for (const key of [HOST_THREAD_KEY, SIDE_THREAD_KEY]) {
				const stored = readThreadMap(key)[sessionId];
				if (typeof stored === "string" && stored !== "") return stored;
			}
			return null;
		}

		/** Remember the session's side thread (an empty id forgets it). */
		function rememberSideThread(sessionId, threadId) {
			if (typeof sessionId !== "string" || sessionId === "") return;
			const map = readThreadMap(SIDE_THREAD_KEY);
			if (typeof threadId === "string" && threadId !== "") map[sessionId] = threadId;
			else delete map[sessionId];
			try {
				localStorage.setItem(SIDE_THREAD_KEY, JSON.stringify(map));
			} catch (error) {
				console.warn("[ui-quote] side thread not remembered:", error);
			}
		}

		/**
		 * Create the side thread. The question stays EMPTY on purpose: a
		 * non-empty one is admitted as the thread's first message, while an empty
		 * one only parks the inherited context for the prompt the reader is about
		 * to write in the composer this plugin prefills.
		 * @param {string} sessionId - the main session the quote came from.
		 * @returns {Promise<string|null>} the child session id, or null.
		 */
		async function startSideThread(sessionId) {
			try {
				const response = await fetch(SIDECHAT_API, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ sessionId, question: "" })
				});
				const body = await response.json().catch(() => null);
				const value = body !== null && typeof body === "object" && body.ok === true ? body.value : null;
				const childId = value !== null && typeof value === "object" ? value.childId : null;
				if (response.ok && typeof childId === "string" && childId !== "") return childId;
				console.warn("[ui-quote] sidechat.start refused:", response.status, body);
				return null;
			} catch (error) {
				console.warn("[ui-quote] sidechat.start failed:", error);
				return null;
			}
		}

		/** Wait for the sidebar's own wiring to settle (tab mount, child scope). */
		function sleep(ms) {
			return new Promise((resolve) => {
				setTimeout(resolve, ms);
			});
		}

		/**
		 * The thread the opened tab actually shows. A native tab binds the id the
		 * seed carried and better-sidebar records it in its own map the moment its
		 * view binds; a tab that had to mint a thread of its own lands on an id
		 * this plugin never saw. So wait for the host to name the thread and fall
		 * back to the one we opened.
		 * @param {string} sessionId - the main session.
		 * @param {string} fallback - the thread id the tab was opened with.
		 * @returns {Promise<string>} the thread id to prefill.
		 */
		async function displayedThreadId(sessionId, fallback) {
			for (let attempt = 0; attempt < 10; attempt += 1) {
				const stored = readThreadMap(HOST_THREAD_KEY)[sessionId];
				if (typeof stored === "string" && stored !== "") return stored;
				await sleep(200);
			}
			return fallback;
		}

		/** The conversation input shell of one session (null until its view exists). */
		function inputShell(sessionId) {
			if (pluginCtx === null) return null;
			let hub = null;
			try {
				const conversation = pluginCtx.get("conversation");
				hub = conversation === null || conversation === undefined ? null : conversation.input;
			} catch (error) {
				return null;
			}
			if (hub === null || hub === undefined) return null;
			try {
				if (typeof hub.shell === "function") return hub.shell(sessionId);
			} catch (error) {
				// The session's scope is not retained yet — the caller retries.
			}
			try {
				if (typeof hub.for === "function" && typeof pluginCtx.sessions?.scope === "function") {
					const scope = pluginCtx.sessions.scope(sessionId);
					if (scope !== null && scope !== undefined) return hub.for(scope);
				}
			} catch (error) {
				// Same; fall through to "not there yet".
			}
			return null;
		}

		/** The shell's current draft, when this shell version exposes one. */
		function shellDraft(shell) {
			try {
				const snapshot = shell.state === undefined ? null : shell.state.getSnapshot();
				return snapshot === null || snapshot === undefined || typeof snapshot.draft !== "string" ? null : snapshot.draft;
			} catch (error) {
				return null;
			}
		}

		/** Write a whole draft through whichever face the shell exposes. */
		function writeDraft(shell, text) {
			try {
				if (typeof shell.setDraft === "function") {
					shell.setDraft(text);
					return true;
				}
				const actions = shell.actions;
				if (actions !== null && actions !== undefined && typeof actions.setDraft === "function") {
					actions.setDraft(text);
					return true;
				}
			} catch (error) {
				console.warn("[ui-quote] sidechat draft refused:", error);
			}
			return false;
		}

		/**
		 * Write the quote into a session's composer as a draft — the whole point
		 * of the third row, and nothing is ever sent. The child's input shell only
		 * appears once its view mounts (the tab was just opened), so poll for it;
		 * a draft the reader already wrote is kept and the quote follows below it.
		 * A shell that exists but exposes no draft face is a version mismatch, so
		 * that gives up at once instead of polling.
		 * @param {string} sessionId - the side thread's session id.
		 * @param {string} text - the quote block to place in the composer.
		 * @returns {Promise<boolean>} whether the draft was written.
		 */
		async function prefillDraft(sessionId, text) {
			for (let attempt = 0; attempt < 25; attempt += 1) {
				const shell = inputShell(sessionId);
				if (shell !== null && shell !== undefined) {
					const current = shellDraft(shell);
					const kept = current === null ? "" : current.replace(/\s+$/u, "");
					const next = kept === "" ? text : kept + "\n\n" + text;
					if (writeDraft(shell, next)) return true;
					console.warn("[ui-quote] sidechat shell has no draft face");
					return false;
				}
				await sleep(200);
			}
			return false;
		}

		/**
		 * Run one side-chat request for a session: open the session's side thread
		 * (created on the first quote, reused after that), then write the quote
		 * into that thread's composer. Nothing is sent. Split from
		 * {@link openSideChat} so the offline harness can drive the whole wire
		 * with a stub service.
		 * @param {object} service - the betterSidebar service face.
		 * @param {string} sessionId - the session the quote came from.
		 * @param {string} text - the quoted text.
		 * @returns {Promise<void>} resolves once the draft is written or refused.
		 */
		function sideChatRequest(service, sessionId, text) {
			if (typeof sessionId !== "string" || sessionId === "" || typeof text !== "string" || text.trim() === "") {
				return Promise.resolve();
			}
			const running = sideChatPending.get(sessionId);
			if (running !== undefined) return running;
			const title = sideChatTitle(text);
			const pending = (async () => {
				const known = storedSideThread(sessionId);
				const childId = known === null ? await startSideThread(sessionId) : known;
				if (typeof childId !== "string" || childId === "") {
					toast(translateFor(sessionId, "sideChatFailed"));
					return;
				}
				try {
					service.openTab(
						{
							type: SIDECHAT_TAB,
							id: SIDECHAT_TAB + ":" + childId,
							...(title === "" ? {} : { title }),
							meta: { threadId: childId }
						},
						{ sessionId }
					);
				} catch (error) {
					console.warn("[ui-quote] sidechat open failed:", error);
					toast(translateFor(sessionId, "sideChatFailed"));
					return;
				}
				rememberSideThread(sessionId, childId);
				const threadId = await displayedThreadId(sessionId, childId);
				rememberSideThread(sessionId, threadId);
				if (!(await prefillDraft(threadId, sideQuestion(text)))) {
					console.warn("[ui-quote] sidechat draft not written:", threadId);
					toast(translateFor(sessionId, "sideChatDraftFailed"));
				}
			})();
			sideChatPending.set(sessionId, pending);
			pending.then(
				() => {
					if (sideChatPending.get(sessionId) === pending) sideChatPending.delete(sessionId);
				},
				(error) => {
					console.warn("[ui-quote] sidechat request failed:", error);
					if (sideChatPending.get(sessionId) === pending) sideChatPending.delete(sessionId);
				}
			);
			return pending;
		}

		/** 侧边对话: drop the selection, open the session's side thread, prefill it. */
		function openSideChat() {
			const sessionId = state.sessionId;
			const text = state.quote;
			if (sessionId === null || text === null) return;
			const service = sideChatService();
			close();
			// Kimi drops the transcript selection the moment an action is chosen.
			const selection = document.getSelection === undefined ? null : document.getSelection();
			if (selection !== null) selection.removeAllRanges();
			if (service === null) {
				toast(translateFor(sessionId, "sideChatFailed"));
				return;
			}
			sideChatRequest(service, sessionId, text);
		}

		/* ------------------------------------------------------------------ *
		 * Document listeners
		 * ------------------------------------------------------------------ */

		function refresh() {
			const found = readSelection();
			if (found === null) close();
			else open(found);
		}

		function onSelectionChange() {
			// While the comment box owns focus the document selection is empty;
			// Kimi ignores those changes too.
			if (insideBar(document.activeElement)) return;
			if (state.settle !== null) clearTimeout(state.settle);
			state.settle = setTimeout(() => {
				state.settle = null;
				if (state.suppress) return;
				refresh();
			}, SETTLE_MS);
		}

		function onKeyUp(event) {
			if (event.key === "Escape") return;
			if (insideBar(event.target)) return;
			state.suppress = false;
			refresh();
		}

		function onPointerDown(event) {
			if (insideBar(event.target)) return;
			state.pointerOnTranscript = closestFrom(event.target, CONTENT_SELECTOR) !== null;
			state.suppress = false;
		}

		function onPointerUp(event) {
			if (!state.pointerOnTranscript) return;
			state.pointerOnTranscript = false;
			if (insideBar(event.target)) return;
			refresh();
		}

		function onMouseDown(event) {
			if (insideBar(event.target)) return;
			const selection = document.getSelection === undefined ? null : document.getSelection();
			// A double-click word selection inside the current range must not
			// dismiss the bar (Kimi guards the same way).
			if (event.button === 0 && event.detail > 1 && selection !== null && selection.rangeCount === 1 && !selection.isCollapsed) {
				const range = selection.getRangeAt(0);
				const element = elementOf(event.target);
				if (element !== null && range.intersectsNode(element)) return;
			}
			if (state.mode !== null || state.quote !== null) close();
		}

		function onKeyDown(event) {
			if (event.key !== "Escape" || event.isComposing === true) return;
			if (insideBar(event.target)) return;
			close();
		}

		function onScrollOrResize(event) {
			if (state.mode === null) return;
			if (event !== undefined && insideBar(event.target)) return;
			if (state.mode === "comment") position();
			else close();
		}

		function attach() {
			if (state.listeners > 0) {
				state.listeners += 1;
				return;
			}
			state.listeners = 1;
			document.addEventListener("selectionchange", onSelectionChange);
			document.addEventListener("keyup", onKeyUp, true);
			document.addEventListener("pointerdown", onPointerDown, true);
			document.addEventListener("pointerup", onPointerUp, true);
			document.addEventListener("pointercancel", onPointerUp, true);
			document.addEventListener("mousedown", onMouseDown, true);
			document.addEventListener("keydown", onKeyDown, true);
			document.addEventListener("scroll", onScrollOrResize, true);
			window.addEventListener("resize", onScrollOrResize);
		}

		function detach() {
			if (state.listeners === 0) return;
			state.listeners -= 1;
			if (state.listeners > 0) return;
			document.removeEventListener("selectionchange", onSelectionChange);
			document.removeEventListener("keyup", onKeyUp, true);
			document.removeEventListener("pointerdown", onPointerDown, true);
			document.removeEventListener("pointerup", onPointerUp, true);
			document.removeEventListener("pointercancel", onPointerUp, true);
			document.removeEventListener("mousedown", onMouseDown, true);
			document.removeEventListener("keydown", onKeyDown, true);
			document.removeEventListener("scroll", onScrollOrResize, true);
			window.removeEventListener("resize", onScrollOrResize);
			close();
			if (state.bar !== null) {
				state.bar.remove();
				state.bar = null;
			}
			const toastNode = document.getElementById(TOAST_ID);
			if (toastNode !== null) toastNode.remove();
			const styleNode = document.getElementById(STYLE_ID);
			if (styleNode !== null) styleNode.remove();
		}

		/* ------------------------------------------------------------------ *
		 * Slot component
		 * ------------------------------------------------------------------ */

		/**
		 * Invisible slot entry: it only publishes `inputActions` for its session
		 * so the (single) document-level bar can write into the right composer.
		 */
		function QuoteSelection(props) {
			const latest = react.useRef(props);
			latest.current = props;

			react.useEffect(() => {
				const sessionId = props.sessionId;
				if (typeof document === "undefined" || typeof sessionId !== "string") return undefined;
				const entry = {
					actions: () => {
						const actions = latest.current === null || latest.current === undefined ? null : latest.current.inputActions;
						return actions === null || actions === undefined ? null : actions;
					},
					translate: (key) => {
						const t = latest.current === null || latest.current === undefined ? null : latest.current.t;
						if (typeof t === "function") return t(key);
						return zh[key] === undefined ? key : zh[key];
					}
				};
				sessions.set(sessionId, entry);
				attach();
				return () => {
					if (sessions.get(sessionId) === entry) sessions.delete(sessionId);
					if (sessions.size === 0) detach();
				};
			}, [props.sessionId]);

			return null;
		}

		/* ------------------------------------------------------------------ *
		 * Plugin entry
		 * ------------------------------------------------------------------ */

		const inject = ["slots", "locale"];

		/**
		 * Alt+Q / Alt+C / Alt+B — the same three rows as keys. `alt` on every
		 * platform (the host already owns the primary-key space, and Escape is a
		 * fixed host command guarding the double-Escape stop, so neither is
		 * touched). With no live selection the command returns `pass`, so the key
		 * falls through to whoever else wanted it instead of being eaten.
		 */
		function registerShortcut(shortcuts, name, code, run) {
			const labels = { quote: "addToChat", comment: "comment", sidechat: "sideChat" };
			return shortcuts.register({
				id: "ui-quote." + name,
				label: () => translateFor(null, labels[name]),
				aliases: ["quote", name],
				defaults: {
					"desktop:macos": { code, modifiers: ["alt"] },
					"desktop:windows": { code, modifiers: ["alt"] },
					"desktop:linux": { code, modifiers: ["alt"] },
					"web:macos": { code, modifiers: ["alt"] },
					"web:windows": { code, modifiers: ["alt"] }
				},
				regions: ["page", "editable"],
				modals: [],
				resolve: () => {
					const found = readSelection();
					if (found === null) return { status: "pass" };
					return {
						status: "handled",
						run: () => {
							if (state.mode !== null) close();
							open(found);
							run();
						}
					};
				}
			});
		}

		function apply(ctx) {
			if (typeof document === "undefined") return;
			pluginCtx = ctx;
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "ui-quote: dictionaries");
			ctx.effect(() => {
				ensureSource();
				return () => {
					if (sourceDisposer !== null) sourceDisposer();
					sourceDisposer = null;
				};
			}, "ui-quote: reference source");
			// The sent-message capsule lives outside the composer, so it is
			// installed with the plugin and not with a session's slot entry.
			ctx.effect(installCapsules, "ui-quote: sent-message capsules");
			// The three rows are also three keys. Without the service the menu
			// stays the only way in — nothing here is required to work.
			ctx.effect(() => {
				let shortcuts = null;
				try {
					shortcuts = ctx.get("shortcuts");
				} catch (error) {
					shortcuts = null;
				}
				if (shortcuts === null || shortcuts === undefined || typeof shortcuts.register !== "function") return () => {};
				const disposers = [
					registerShortcut(shortcuts, "quote", "KeyQ", () => commit("")),
					registerShortcut(shortcuts, "comment", "KeyC", () => openComment()),
					registerShortcut(shortcuts, "sidechat", "KeyB", () => openSideChat())
				];
				return () => {
					for (const dispose of disposers) dispose();
				};
			}, "ui-quote: shortcuts");
			ctx.slots.inject("conversation.input.overlay", () =>
				ctx.slots.register(
					{
						name: "conversation.input.overlay",
						id: "quote-selection",
						order: 5,
						locale: NS,
						inject: () => ({})
					},
					QuoteSelection
				)
			);
		}


		exports.apply = apply;
		exports.inject = inject;
		/**
		 * The pure functions the offline harness drives: the model form of a
		 * quote, the reader that turns it back into a capsule in the transcript,
		 * and the side-chat helpers (availability probe, wire forms, the per
		 * session thread memory, the composer prefill). Nothing in DSH reads them.
		 */
		exports.__testing = {
			quoteBlock,
			splitQuoteRuns,
			chipRef,
			chipLabel,
			rememberChip,
			normalizeLabel,
			barTop,
			sideChatService,
			sideQuestion,
			sideChatTitle,
			sideChatRequest,
			storedSideThread,
			rememberSideThread,
			displayedThreadId,
			prefillDraft,
			sourceKeyOf,
			saveSource,
			sourceFor,
			jumpToSource,
			registerShortcut
		};
		return module.exports;
	}
});

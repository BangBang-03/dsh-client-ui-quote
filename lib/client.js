/**
 * dsh-client-ui-quote — select text in the conversation, then quote and/or
 * comment on it, the way Kimi Code does.
 *
 * Reproduced behaviour (traced from Kimi Code 1.0.4's `selection` namespace and
 * its `sab` selection-action bar):
 *
 *   select text ─▶ floating bar with two rows
 *                    评论        ─▶ the bar turns into an inline comment box
 *                                    (textarea + 取消 / 添加到对话, ⏎ confirms)
 *                    添加到对话  ─▶ the quote goes straight to the composer
 *
 *   Either path inserts the quote into the composer; the comment path appends
 *   the comment right after it. The UI selection is dropped on the way in, and
 *   the composer takes focus so the next keystroke continues the message.
 *
 * DSH's composer is Lexical and only accepts text, so Kimi's inline `quote-pill`
 * node is represented as a Markdown blockquote block instead of a chip.
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
			failed: "插入失败，请重试"
		};

		/** English copy, verbatim from Kimi Code's `selection` namespace. */
		const en = {
			comment: "Comment",
			addToChat: "Add to chat",
			commentPlaceholder: "Write a comment…",
			cancel: "Cancel",
			quoteLabel: "Quote",
			failed: "Could not insert, try again"
		};

		/* ------------------------------------------------------------------ *
		 * Constants
		 * ------------------------------------------------------------------ */

		const STYLE_ID = "dsh-quote-style";
		const BAR_ID = "dsh-quote-bar";
		const TOAST_ID = "dsh-quote-toast";

		/** Transcript host: a selection outside it is none of our business. */
		const CONTENT_SELECTOR = "[data-conversation-content]";
		/** The composer card: a selection inside it is a draft edit, not a quote. */
		const CARD_SELECTOR = "[data-composer-card]";
		/** Composer text box, used to focus the draft after inserting. */
		const COMPOSER_SELECTOR = "[data-composer-input]";

		const GAP = 8;
		const EDGE = 8;
		const COMMENT_WIDTH = 280;
		const COMMENT_MAX_HEIGHT = 160;
		/** Kimi settles the selection for 250ms before showing the bar. */
		const SETTLE_MS = 180;
		const TOAST_MS = 1800;

		/**
		 * DSH mints every inline reference from an owner source; this one owns
		 * the quote chips. The trigger is deliberately one the input surface
		 * never detects — chips are inserted by the plugin, never picked from
		 * a menu, so the source only has to exist for the send-time codec.
		 */
		const SOURCE_NAME = "quote";
		const SOURCE_TRIGGER = "#";

		const ICON_MESSAGE =
			'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H8l-4 3V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z"/></svg>';
		const ICON_PLUS =
			'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';

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
			const host = closestFrom(range.startContainer, CONTENT_SELECTOR);
			if (host === null) return null;
			if (closestFrom(range.startContainer, CARD_SELECTOR) !== null) return null;
			if (closestFrom(range.endContainer, CARD_SELECTOR) !== null) return null;

			const text = String(selection.toString()).replace(/^\n+|\n+$/g, "");
			if (text.trim().length === 0) return null;

			const sessionId = host.getAttribute("data-conversation-session");
			if (typeof sessionId !== "string" || !sessions.has(sessionId)) return null;

			const rect = range.getBoundingClientRect();
			if (rect.width === 0 && rect.height === 0) return null;

			return {
				text,
				x: rect.left + rect.width / 2,
				y: rect.top,
				bottom: rect.bottom,
				sessionId
			};
		}

		/* ------------------------------------------------------------------ *
		 * Payload + insertion
		 * ------------------------------------------------------------------ */

		/** Fold the selection into a Markdown blockquote (Kimi renders a pill here). */
		function quoteBlock(text) {
			return text
				.split(/\r?\n/)
				.map((line) => {
					const trimmed = line.replace(/\s+$/, "");
					return trimmed.trim() === "" ? ">" : "> " + trimmed;
				})
				.join("\n");
		}

		function composerText() {
			const composer = document.querySelector(COMPOSER_SELECTOR);
			if (composer === null) return "";
			return String(composer.innerText === undefined ? composer.textContent : composer.innerText);
		}

		/**
		 * Kimi's pill spells its two halves out in the hover card: a `引用` block
		 * holding the quote and a `评论` block holding the comment. A text-only
		 * composer cannot carry that card, so the same labels become block
		 * headers, with the colon the label's own script asks for.
		 */
		function labelLine(key) {
			const label = translate(key);
			if (typeof label !== "string" || label === "") return "";
			return /[\u3400-\u9fff]/.test(label) ? label + "：\n" : label + ":\n";
		}

		/** Quote (+ optional comment) exactly as it should land in the draft. */
		function buildPayload(text, comment) {
			const prefix = composerText().trim() === "" ? "" : "\n";
			const body = labelLine("quoteLabel") + quoteBlock(text) + "\n\n";
			const tail = comment === "" ? "" : labelLine("comment") + comment + "\n\n";
			return prefix + body + tail;
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
		 * stays stateless (it survives a composer that outlives the plugin).
		 */
		function chipRef(text) {
			return quoteBlock(text) + "\n\n";
		}

		function chipLabel(text) {
			const flat = text.replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
			return flat.length > 48 ? flat.slice(0, 47) + "…" : flat;
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
		function insertChip(entry, sessionId, text) {
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
			const model = chipRef(text);
			const attachment = {
				source: SOURCE_NAME,
				ref: model,
				label: chipLabel(text),
				appearance: "session",
				clipboardText: model
			};
			for (let attempt = 0; attempt < 2; attempt += 1) {
				const actions = entry.actions();
				if (actions === null || typeof actions.captureInsertion !== "function") return false;
				const span = actions.captureInsertion();
				try {
					if (shell.insertReference(attachment, span) === true) return true;
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

		function row(doc, action, icon, label, role) {
			return el(doc, "button", { type: "button", class: "dshq-row", "data-action": action, role }, [
				el(doc, "span", { class: "dshq-icon", html: icon }),
				el(doc, "span", { class: "dshq-label", text: label })
			]);
		}

		function translate(key) {
			const entry = state.sessionId === null ? null : sessions.get(state.sessionId);
			if (entry !== null && entry !== undefined) return entry.translate(key);
			return zh[key];
		}

		/** Menu mode: 评论 / 添加到对话, exactly Kimi's two-row menu. */
		function renderMenu(bar) {
			const doc = bar.ownerDocument;
			bar.setAttribute("role", "menu");
			bar.removeAttribute("aria-label");
			bar.replaceChildren(
				row(doc, "comment", ICON_MESSAGE, translate("comment"), "menuitem"),
				row(doc, "add", ICON_PLUS, translate("addToChat"), "menuitem")
			);
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
			const above = anchor.y - GAP - barHeight;
			const top =
				above >= offsetTop + EDGE ? above : clamp(anchor.bottom + GAP, offsetTop + EDGE, offsetTop + height - barHeight - EDGE);

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
			const entry = sessionId === null ? null : sessions.get(sessionId);
			const trimmed = typeof comment === "string" ? comment.trim() : "";
			close();
			if (text === null || entry === null || entry === undefined) return;

			// Kimi drops the transcript selection the moment an action is chosen.
			const selection = document.getSelection === undefined ? null : document.getSelection();
			if (selection !== null) selection.removeAllRanges();

			// DSH's own inline chip is the Kimi pill; the Markdown form below is
			// the fallback for every build where that service face is missing.
			if (insertChip(entry, sessionId, text)) {
				if (trimmed === "" || insertPayload(entry, trimmed) === true) focusComposer();
				else toast(translate("failed"));
				return;
			}
			if (insertPayload(entry, buildPayload(text, trimmed))) focusComposer();
			else toast(translate("failed"));
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
		return module.exports;
	}
});

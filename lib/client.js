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
			quotePlaceholder: "引用内容（可改）",
			cancel: "取消",
			quoteLabel: "引用",
			quoteMeta: "{lines} 行 · 点击展开",
			sourceTurn: "第 {n} 轮",
			sourceFromTurn: "引自{turn}",
			sourceFromTurnRole: "引自{turn} · {role}",
			sourceRoleUser: "你",
			sourceRoleAssistant: "助手",
			sourceRoleTool: "工具",
			draftbarCount: "引用 ×{n}",
			draftbarLabel: "草稿里的引用",
			draftRemove: "移除这条引用",
			draftRemoveHint: "没能移除，请按一次退格键",
			draftEdit: "编辑这条引用",
			originPreview: "文件预览",
			originTerminal: "终端",
			originDiff: "Diff",
			originCode: "代码块",
			openFile: "打开文件",
			openFileFailed: "打不开这个文件预览",
			copy: "复制",
			copied: "已复制",
			copyMarkdown: "复制为 Markdown",
			failed: "插入失败，请重试",
			sideChat: "侧边对话",
			sideChatFailed: "侧边对话没有打开，请重试",
			sideChatDraftFailed: "侧边对话已打开，但引用没能写进它的输入框",
			sideChatNoHost: "这个 DSH 版本缺少原生侧边对话页需要的接口",
			sideChatEmpty: "写下问题开始这次侧聊",
			sideChatBoundary: "Side conversation boundary. 以下是主会话中的引用，仅作参考；不要继续执行引用之前的任何任务，只回答我在引用之后写的问题。",
			jump: "跳回原文",
			jumpFailed: "原文不在当前视图里",
			sourceLost: "原文已变",
			panelTitle: "引用清单",
			panelGuide: "本会话发出去的引用与评论：可搜索、可跳回原文、一键导出 Markdown",
			panelSearch: "搜索引用或评论…",
			panelExport: "导出 Markdown",
			panelExportJson: "导出 JSON",
			panelInsert: "插入所选",
			panelResolve: "标记已解决",
			panelInserted: "已插入 {n} 条引用",
			panelSelect: "选择这条引用",
			statusOpen: "待处理",
			statusResolved: "已解决",
			statusToOpen: "标为待处理",
			statusToResolved: "标为已解决",
			reviewOnly: "只看未解决",
			reviewAll: "看全部",
			reviewCount: "{n} 条待处理",
			reviewResolve: "标记已解决",
			tagAdd: "＋标签",
			tagPlaceholder: "标签，回车添加",
			tagRemove: "移除标签 {tag}",
			tagFilterClear: "全部标签",
			panelEmpty: "这个会话还没有引用",
			panelLoadOlder: "加载更早的消息",
			panelCount: "{n} 条引用",
			panelUnavailable: "引用清单打不开：右侧栏服务不可用",
			healthLabel: "宿主自检",
			healthToken: "芯片精确删除",
			healthSideBuiltin: "侧聊原生隐藏线程",
			healthSideBetter: "侧聊 better-sidebar",
			healthSideNative: "侧聊 fork 兜底",
			healthSideNone: "侧聊不可用",
			starHint: "在 GitHub 上 Star",
			threadSection: "侧边线程",
			threadOpen: "打开",
			threadNone: "这条会话还没有侧边线程",
			threadBack: "带回主会话",
			threadExport: "导出 Markdown",
			threadBackDone: "已放进主会话的输入框，自己按发送",
			threadBackFailed: "没读到这个线程的内容",
			threadCount: "{n} 条消息",
			revise: "改这条引用",
			revised: "已修订",
			replyToggle: "让模型逐条回应",
			turnQuestion: "引用提问",
			turnAnswer: "引用回答",
			turnEmpty: "这一轮没有可引用的内容",
			replyInstruction: "指令：请把本条消息里的引用块按出现顺序记为「引用1」「引用2」…，回复时逐条对应回应，每条回应前标注「引用N」。",
			quoteTruncated: "引用太长，已截断到 {n} 字"
		};

		/** English copy, verbatim from Kimi Code's `selection` namespace. */
		const en = {
			comment: "Comment",
			addToChat: "Add to chat",
			commentPlaceholder: "Write a comment…",
			quotePlaceholder: "Quoted text (editable)",
			cancel: "Cancel",
			quoteLabel: "Quote",
			quoteMeta: "{lines} lines · click to expand",
			sourceTurn: "turn {n}",
			sourceFromTurn: "from {turn}",
			sourceFromTurnRole: "from {turn} · {role}",
			sourceRoleUser: "you",
			sourceRoleAssistant: "assistant",
			sourceRoleTool: "tool",
			draftbarCount: "Quotes ×{n}",
			draftbarLabel: "Quotes in this draft",
			draftRemove: "Remove this quote",
			draftRemoveHint: "Could not remove it; press Backspace once",
			draftEdit: "Edit this quote",
			originPreview: "File preview",
			originTerminal: "Terminal",
			originDiff: "Diff",
			originCode: "Code block",
			openFile: "Open file",
			openFileFailed: "Could not open that file preview",
			copy: "Copy",
			copied: "Copied",
			copyMarkdown: "Copy as Markdown",
			failed: "Could not insert, try again",
			sideChat: "Side chat",
			sideChatFailed: "The side chat did not open, try again",
			sideChatDraftFailed: "The side chat opened, but the quote could not be written into it",
			sideChatNoHost: "This DSH build lacks the host pieces for the native side chat page",
			sideChatEmpty: "Write a question to start this side chat",
			sideChatBoundary: "Side conversation boundary. The quote below comes from the main session as reference only; do not continue any task from before it, and answer only the question I write after it.",
			jump: "Jump to source",
			jumpFailed: "The source is not in view right now",
			sourceLost: "The source has changed",
			panelTitle: "Quote list",
			panelGuide: "Every quote and comment this session has sent: search it, jump back to the source, export it as Markdown",
			panelSearch: "Search quotes or comments…",
			panelExport: "Export Markdown",
			panelExportJson: "Export JSON",
			panelInsert: "Insert selected",
			panelResolve: "Mark resolved",
			panelInserted: "Inserted {n} quotes",
			panelSelect: "Select this quote",
			statusOpen: "Open",
			statusResolved: "Resolved",
			statusToOpen: "Mark as open",
			statusToResolved: "Mark as resolved",
			reviewOnly: "Open only",
			reviewAll: "Show all",
			reviewCount: "{n} open",
			reviewResolve: "Resolve selected",
			tagAdd: "+ Tag",
			tagPlaceholder: "Tag, press Enter",
			tagRemove: "Remove tag {tag}",
			tagFilterClear: "All tags",
			panelEmpty: "This session has no quotes yet",
			panelLoadOlder: "Load older messages",
			panelCount: "{n} quotes",
			panelUnavailable: "The quote list did not open: the right sidebar is unavailable",
			healthLabel: "Host check",
			healthToken: "exact chip removal",
			healthSideBuiltin: "side chat: native hidden thread",
			healthSideBetter: "side chat: better-sidebar",
			healthSideNative: "side chat: fork fallback",
			healthSideNone: "side chat: unavailable",
			starHint: "Star on GitHub",
			threadSection: "Side thread",
			threadOpen: "Open",
			threadNone: "This session has no side thread yet",
			threadBack: "Bring back to the session",
			threadExport: "Export Markdown",
			threadBackDone: "Put in the main session's composer — send it yourself",
			threadBackFailed: "Could not read that thread",
			threadCount: "{n} messages",
			revise: "Revise this quote",
			revised: "Revised",
			replyToggle: "Ask for per-quote replies",
			turnQuestion: "Quote the question",
			turnAnswer: "Quote the answer",
			turnEmpty: "This turn has nothing to quote",
			replyInstruction: "Instruction: number the quote blocks of this message in order as 「Quote 1」「Quote 2」…, answer each one separately, and prefix every answer with 「Quote N」.",
			quoteTruncated: "The quote was too long; cut to {n} characters"
		};

		/** Russian copy. */
		const ru = {
			"comment": "Комментарий",
			"addToChat": "В диалог",
			"commentPlaceholder": "Написать комментарий…",
			"quotePlaceholder": "Цитата (можно править)",
			"cancel": "Отмена",
			"quoteLabel": "Цитата",
			"quoteMeta": "{lines} строк · нажмите, чтобы раскрыть",
			"sourceTurn": "ход {n}",
			"sourceFromTurn": "из хода {turn}",
			"sourceFromTurnRole": "из хода {turn} · {role}",
			"sourceRoleUser": "вы",
			"sourceRoleAssistant": "ассистент",
			"sourceRoleTool": "инструмент",
			"draftbarCount": "Цитаты ×{n}",
			"draftbarLabel": "Цитаты в этом черновике",
			"draftRemove": "Убрать эту цитату",
			"draftRemoveHint": "Убрать не удалось; нажмите Backspace",
			"draftEdit": "Изменить эту цитату",
			"originPreview": "Предпросмотр файла",
			"originTerminal": "Терминал",
			"originDiff": "Дифф",
			"originCode": "Блок кода",
			"openFile": "Открыть файл",
			"openFileFailed": "Не удалось открыть предпросмотр файла",
			"copy": "Копировать",
			"copied": "Скопировано",
			"copyMarkdown": "Копировать как Markdown",
			"failed": "Не вставилось, попробуйте ещё раз",
			"sideChat": "Боковой чат",
			"sideChatFailed": "Боковой чат не открылся, попробуйте ещё раз",
			"sideChatDraftFailed": "Боковой чат открылся, но цитата в него не записалась",
			"sideChatNoHost": "В этой сборке DSH нет хостовой части для бокового чата",
			"sideChatEmpty": "Напишите вопрос, чтобы начать этот боковой чат",
			"sideChatBoundary": "Граница боковой беседы. Цитата ниже — только справка из основной сессии; не продолжайте прежнюю задачу и отвечайте только на вопрос, который я напишу после неё.",
			"jump": "К источнику",
			"jumpFailed": "Источника сейчас не видно",
			"sourceLost": "Источник изменился",
			"panelTitle": "Список цитат",
			"panelGuide": "Все цитаты и комментарии этой сессии: поиск, переход к источнику, экспорт в Markdown",
			"panelSearch": "Поиск по цитатам и комментариям…",
			"panelExport": "Экспорт Markdown",
			"panelExportJson": "Экспорт JSON",
			"panelInsert": "Вставить выбранные",
			"panelResolve": "Пометить решёнными",
			"panelInserted": "Вставлено цитат: {n}",
			"panelSelect": "Выбрать эту цитату",
			"statusOpen": "Открыта",
			"statusResolved": "Решена",
			"statusToOpen": "Пометить открытой",
			"statusToResolved": "Пометить решённой",
			"reviewOnly": "Только открытые",
			"reviewAll": "Показать все",
			"reviewCount": "открытых: {n}",
			"reviewResolve": "Решить выбранные",
			"tagAdd": "+ Тег",
			"tagPlaceholder": "Тег, затем Enter",
			"tagRemove": "Убрать тег {tag}",
			"tagFilterClear": "Все теги",
			"panelEmpty": "В этой сессии пока нет цитат",
			"panelLoadOlder": "Загрузить более ранние сообщения",
			"panelCount": "цитат: {n}",
			"panelUnavailable": "Список цитат не открылся: правая панель недоступна",
			"healthLabel": "Проверка хоста",
			"healthToken": "точное удаление чипсы",
			"healthSideBuiltin": "боковой чат: скрытый тред",
			"healthSideBetter": "боковой чат: better-sidebar",
			"healthSideNative": "боковой чат: fork-фолбэк",
			"healthSideNone": "боковой чат: недоступен",
			"starHint": "Звезда на GitHub",
			"threadSection": "Боковой тред",
			"threadOpen": "Открыть",
			"threadNone": "В этой сессии ещё нет бокового треда",
			"threadBack": "Вернуть в сессию",
			"threadExport": "Экспорт Markdown",
			"threadBackDone": "Положил в поле ввода основной сессии — отправьте сами",
			"threadBackFailed": "Не удалось прочитать этот тред",
			"threadCount": "сообщений: {n}",
			"revise": "Изменить эту цитату",
			"revised": "Изменена",
			"replyToggle": "Попросить ответить по пунктам",
			"turnQuestion": "Цитировать вопрос",
			"turnAnswer": "Цитировать ответ",
			"turnEmpty": "В этом ходе нечего цитировать",
			"replyInstruction": "Инструкция: пронумеруй блоки цитат этого сообщения по порядку как 「Quote 1」「Quote 2」…, ответь на каждую отдельно и перед каждым ответом ставь 「Quote N」.",
			"quoteTruncated": "Цитата слишком длинная; обрезана до {n} символов"
		};

		/* ------------------------------------------------------------------ *
		 * 配置 — a small, local, whitelisted set of switches
		 * ------------------------------------------------------------------ */

		/** Where the switches live. Nothing here ever leaves the machine. */
		const CONFIG_KEY = "dsh-client-ui-quote:v1:config";

		/** The defaults, and the only keys a patch may touch. */
		const CONFIG_DEFAULTS = {
			/** A selection shorter than this never opens the bar. */
			minChars: 1,
			/** A quote longer than this is cut, with a visible marker. 0 = no limit. */
			maxQuoteChars: 4000,
			/** Whether the per-quote reply instruction starts switched on. */
			replyByDefault: false,
			/** Whether the readable source head rides into the wire. */
			attribution: true,
			/** Whether the source-side highlight is painted. */
			highlight: true,
			/**
			 * Keep the source highlight after the quote's turn finishes. Off by
			 * default: once the capsule was sent and its reply is done, the mark
			 * has served its purpose and is retired (the coordinate stays for
			 * jump/card/list).
			 */
			keepHighlight: false,
			/**
			 * Which side chat the third row opens. `native` (the default) uses
			 * the plugin's own hidden thread when the host half can create one,
			 * then falls back to a plain fork, then to better-sidebar if it
			 * happens to be installed. `better` asks for better-sidebar's
			 * thread first; it is never required.
			 */
			sideChatBackend: "native",
			/**
			 * Interface language. `auto` follows the host locale (and falls back to
			 * Chinese when the host has no dictionary for it); `zh` / `en` / `ru`
			 * pin this plugin's copy regardless of the host setting.
			 */
			language: "auto"
		};

		/** Each numeric switch's accepted range; anything outside it is dropped. */
		const CONFIG_RANGES = {
			minChars: [1, 50],
			maxQuoteChars: [0, 20000]
		};

		/** Enum switches accept one of these strings; the first is the default. */
		const CONFIG_CHOICES = {
			sideChatBackend: ["native", "better"],
			language: ["auto", "zh", "en", "ru"]
		};

		/** A patch that is not an object is not a patch; unknown keys are dropped. */
		function sanitizeConfig(raw) {
			const next = { ...CONFIG_DEFAULTS };
			if (raw === null || raw === undefined || typeof raw !== "object") return next;
			for (const key of Object.keys(CONFIG_DEFAULTS)) {
				if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
				const value = raw[key];
				if (typeof value !== typeof CONFIG_DEFAULTS[key]) continue;
				if (CONFIG_RANGES[key] !== undefined) {
					const number = Math.round(Number(value));
					if (!Number.isFinite(number) || number < CONFIG_RANGES[key][0] || number > CONFIG_RANGES[key][1]) continue;
					next[key] = number;
					continue;
				}
				if (CONFIG_CHOICES[key] !== undefined && !CONFIG_CHOICES[key].includes(value)) continue;
				next[key] = value;
			}
			return next;
		}

		/**
		 * The switches in effect right now. The value is cached: the highlight
		 * painter asks for it on every scroll frame, and re-reading storage
		 * that often is not worth it. A patch replaces the cache at once.
		 */
		let configCache = null;
		function config() {
			if (configCache !== null) return configCache;
			let stored = null;
			try {
				const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(CONFIG_KEY);
				if (typeof raw === "string" && raw !== "") stored = JSON.parse(raw);
			} catch (error) {
				stored = null;
			}
			configCache = sanitizeConfig(stored);
			return configCache;
		}

		/** Apply a patch, keep the whitelist, and persist it locally. */
		function setConfig(patch) {
			const merged = patch !== null && patch !== undefined && typeof patch === "object" ? { ...config(), ...patch } : config();
			const next = sanitizeConfig(merged);
			configCache = next;
			try {
				if (typeof localStorage !== "undefined") localStorage.setItem(CONFIG_KEY, JSON.stringify(next));
			} catch (error) {
				// A full or blocked storage must not lose the change in effect.
			}
			return next;
		}

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

		/**
		 * The mark that opens the transport-only reply instruction line. When the
		 * comment box's 逐条回应 toggle is on, the block ends with one more
		 * blockquote line starting with this mark; the model reads it and answers
		 * per quote (`「引用1」…「引用N」`), while `splitQuoteRuns` strips the line
		 * on the way back out — a capsule, a card and the export never show it.
		 * The `指令：` phrase after the mark is part of the strip rule, so a line
		 * that happens to start with a bare `※` is left alone.
		 */
		const REPLY_MARK = "\u203B";
		const REPLY_INSTRUCTION =
			"指令：请把本条消息里的引用块按出现顺序记为「引用1」「引用2」…，回复时逐条对应回应，每条回应前标注「引用N」。";

		/**
		 * 自带坐标 — the transport line that carries a quote's source coordinate
		 * inside the sent text itself. A sent message is plain text to DSH, so a
		 * side table was the only place a coordinate could live; a reload in
		 * another window, a second write from a parallel window, or the same
		 * sentence quoted twice could each erase it. This line closes that hole:
		 * `> ※ │q1:<base64url(JSON)>`, wire-only exactly like the reply
		 * instruction. `│q1:` is part of the strip rule, so real content that
		 * merely starts with `※` is left alone. The payload is
		 * `{v:1,s:sessionId,a:anchorAttr,k:anchorKey,t:turn,n:ordinal}`; the
		 * base64url alphabet keeps it free of whitespace and `>`-breaking
		 * characters, and the encoder is UTF-8 so non-ASCII session ids survive.
		 */
		const REF_PREFIX = "\u2502q1:";
		/**
		 * Generated ref line, matched on the body after the blockquote prefix.
		 * The optional readable half in front of `│q1:` (`引自第 12 轮 · 助手`)
		 * is for the model and for a human reading the raw text; it is stripped
		 * together with the coordinate and never reaches a capsule or the export.
		 */
		const REF_LINE = /^\s*※\s*[^│\n]*?│q1:([A-Za-z0-9_-]+)\s*$/u;
		const REF_VERSION = 1;
		/** The only anchor attributes `chatRowOf` mints; a ref may name no other. */
		const REF_ATTRS = new Set(["data-chat-anchor-key", "data-chat-node-key"]);
		/**
		 * Role attributes a transcript row may carry. The host owns the row, so
		 * this is a probe, not a contract: a miss costs the role word and nothing
		 * else, and the turn half of the source label still reads.
		 */
		const ROLE_ATTRS = ["data-chat-flow-kind", "data-chat-role", "data-message-role", "data-role", "data-author-role"];
		/** One-letter role codes that ride in the ref; absent for older quotes. */
		const ROLE_CODES = new Set(["a", "u", "t"]);
		const BASE64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

		/**
		 * Attributes a file preview may carry its path in. The preview DOM is a
		 * host detail this plugin does not own, so the lookup walks a few ancestors
		 * and takes the first hit; when none matches, the quote travels without a
		 * path — exactly the shape it had before the probe existed.
		 */
		const PREVIEW_PATH_ATTRS = [
			"data-textpreview-path",
			"data-preview-path",
			"data-document-path",
			"data-file-path",
			"data-path",
			"data-file",
			"data-filename"
		];

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
		/**
		 * Diff and per-turn change surfaces. The host owns these shapes, so this
		 * is a probe list rather than a contract: the first ancestor that matches
		 * one of them wins over the transcript (a diff card lives inside a
		 * message), and a miss simply leaves the old three surfaces untouched.
		 */
		const DIFF_SELECTORS = [
			"[data-diff-view]",
			"[data-diff-panel]",
			"[data-file-diff]",
			"[data-review-diff]",
			"[data-turn-diff]",
			"[data-diff]",
			".monaco-diff-editor"
		];
		const DIFF_PATH_ATTRS = ["data-diff-path", "data-file-path", "data-diff-file", "data-path", "data-filename"];
		const DIFF_LINE_ATTRS = ["data-line-number", "data-diff-line", "data-line"];

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
		 * 跳回原文 geometry. The transcript is a virtualized scrollport owned by
		 * the host, so a jump has to write the same offset the host writes when
		 * it scrolls to a turn (24px under the top edge) and then hold it while
		 * the virtualizer mounts the row's neighbours.
		 */
		const JUMP_ALIGN = 24;
		const JUMP_FRAMES = 6;
		const JUMP_STEPS = 80;
		const JUMP_OVERLAP = 0.85;

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
		 * opens a child thread that inherits the main session's context and runs
		 * independently, then writes the quote into that thread's composer.
		 *
		 * The preferred child is created by our own host half (`lib/index.js`):
		 * a seeded Session marked `origin: "subagent"`, so DSH's session list
		 * hides it. That route is the same-origin `SIDECHAT_BUILTIN_API`. When
		 * the host cannot create one, the plugin forks the session and opens its
		 * own page; when even `sessions.fork` is missing it asks better-sidebar,
		 * whose thread convention (`Side: ` label) the built-in thread shares.
		 * Nothing is ever sent — the quote is a draft in every backend.
		 */
		const SIDECHAT_TAB = "sidechat";
		const SIDECHAT_API = "/sidebar/api/sidechat.start";
		/** The host half's hidden-thread route; absent on an old host. */
		const SIDECHAT_BUILTIN_API = "/ui-quote/api/sidechat.start";
		/** The durable label prefix better-sidebar's side-thread rows share. */
		const SIDECHAT_LABEL_PREFIX = "Side: ";
		/** Our own "side thread of this session" memory (better-sidebar keeps its own). */
		const SIDE_THREAD_KEY = "dsh-client-ui-quote:v1:sidechat-thread";
		/**
		 * Which threads are hidden children and who their parent is. Kept beside
		 * the id map so an old string-only entry still means "a plain fork".
		 */
		const SIDECHAT_TARGET_KEY = "dsh-client-ui-quote:v1:sidechat-target";
		const SIDECHAT_TARGET_LIMIT = 200;
		/**
		 * Shape version stamped on a hidden thread this build minted. Version 6
		 * opens the seed's closed turn with an empty `system/message`: the store
		 * protects the first surface node as the system head, so a turn whose
		 * first surface node is the context message (version 4 and 5) makes the
		 * first real turn's `system/message` corrupt on reload and every later
		 * send fail with `subagent/not-resumable`. Version 5 shipped the context
		 * alone (blank child); version 4 wrapped it in a turn without the head;
		 * version 3 shipped the context alone on the built-in page; version 2
		 * copied the whole parent log. Only the current version is ever reused —
		 * a thread from an older build is replaced on the next click.
		 */
		const HIDDEN_THREAD_VERSION = 6;
		const SIDECHAT_PROBE_MS = 1500;
		const SIDECHAT_START_MS = 15000;
		/**
		 * better-sidebar's per-session thread memory — read only for its explicit
		 * backend and for threads created by older builds; never written here.
		 */
		const HOST_THREAD_KEY = "dsh-sidebar:v1:sidechat-thread";
		/**
		 * Built-in subagent chat: a fork with inherited history and the host's own
		 * UI. It is the fallback when our own page type below cannot register; the
		 * built-in title reads a subagent label a plain fork never carries, so it
		 * degrades to the child id.
		 */
		const BUILTIN_THREAD_ADDRESS = "dsh-resource://subagentchat/session/";
		/**
		 * Our own native side-chat page. The address protocol is ours, so only
		 * quote threads are claimed; the tab body is the host's embedded
		 * conversation (the same one the built-in subagent tab renders), which
		 * makes the composer, streaming and tool calls native rather than a
		 * reimplementation. `title` reads the renamed session, so the tab names
		 * the quote instead of the child id.
		 */
		const QUOTE_SIDECHAT_PROTOCOL = "quote-sidechat";
		const QUOTE_SIDECHAT_ADDRESS = "dsh-resource://quote-sidechat/session/";
		const QUOTE_SIDECHAT_TAB_ID = "dsh-client-ui-quote/sidechat";
		const QUOTE_SIDECHAT_KIND = "quote-sidechat";
		const QUOTE_SIDECHAT_STYLE_ID = "dsh-quote-sidechat-style";
		/** DeepSeek's brand blue — the whale accent the third row is drawn in. */
		const SIDEBAR_ACCENT = "#4d6bfe";

		/**
		 * Where a quote was selected from. A sent message is plain text, so a
		 * coordinate used to live only beside it, keyed by the quote's own
		 * wording — which overwrote the older coordinate whenever the same
		 * sentence was quoted twice, and lost the table when another window wrote
		 * it. Two things fix that: a v2 table keyed by the source turn (each bin
		 * is a list, never an overwrite) and a transport line inside the sent
		 * text itself (see REF_PREFIX) so the coordinate survives a reload with
		 * no table at all. The anchor is the chat row (`data-chat-anchor-key`,
		 * with the row's `data-chat-turn` as a fallback): DSH exposes no message
		 * id to a plugin and no scroll API, so the jump is an anchor-key lookup
		 * inside the quote's own transcript, aligned the way the host aligns a
		 * turn, plus a flash.
		 */
		const SOURCE_KEY = "dsh-client-ui-quote:v2:quote-source";
		/** Pre-v2 table: wording -> one coordinate. Read for migration and drafts. */
		const SOURCE_KEY_V1 = "dsh-client-ui-quote:v1:quote-source";
		/** Set once the v1 table was imported, so it is read exactly once. */
		const SOURCE_MIGRATED_KEY = "dsh-client-ui-quote:v2:quote-source-migrated";
		/** Candidates kept per source turn; the newest win, the oldest go first. */
		const SOURCE_PER_KEY = 20;
		/** Source turns kept in the whole table. */
		const SOURCE_LIMIT = 200;
		/** Distinct failed jumps remembered for the page's lifetime. */
		const LOST_LIMIT = 200;

		/**
		 * 已修订 — which sent quotes have a corrected version after them. DSH's
		 * transcript is append-only (there is no edit API: `editMessage`,
		 * `updateMessage`, `rewriteMessage` have zero hits in the whole install),
		 * so a correction is a NEW message and this map is how the old capsule can
		 * say so. Keyed by the original quote's wording, same as the coordinate.
		 */
		const REVISED_KEY = "dsh-client-ui-quote:v1:quote-revised";
		const REVISED_LIMIT = 60;
		/** Per-quote review state: open/resolved plus tags, local to this machine. */
		const QUOTE_META_KEY = "dsh-client-ui-quote:v1:quote-meta";
		const QUOTE_META_LIMIT = 800;
		const QUOTE_TAG_LIMIT = 6;
		const QUOTE_TAG_MAX = 20;

		/**
		 * 引用清单 — the list page. It is a right-sidebar page type: the type is
		 * declared with `ctx.sidebarRightTabs.register` (a page names no resource
		 * patterns and is opened by kind) and its body registers into the keyed
		 * seat `sidebar.right.pane.tab` under the same id. The guide entry is what
		 * makes it discoverable: the sidebar's guide lists one capsule per entry,
		 * and picking ours opens the page.
		 */
		const QUOTE_TAB_ID = "dsh-client-ui-quote/list";
		const QUOTE_TAB_KIND = "quote-list";
		const QUOTE_COMMAND = "ui-quote.list";
		const PANEL_STYLE_ID = "dsh-quote-panel-style";
		/** The Markdown export is a browser download: the host exposes no disk write. */
		const MARKDOWN_MIME = "text/markdown;charset=utf-8";
		/** How much of a thread's conclusion is carried back into the composer. */
		const THREAD_LIMIT = 4000;

		const ICON_MESSAGE =
			'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H8l-4 3V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z"/></svg>';
		const ICON_PLUS =
			'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
		/** The third row's glyph: a right-sidebar panel, drawn in DeepSeek's whale blue. */
		const ICON_SIDEBAR =
			'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/></svg>';

		const STYLE_TEXT = `
::highlight(dshq-selection){background-color:rgba(77,107,254,.28)}
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
#${BAR_ID} .dshq-reply{display:flex;align-items:center;gap:6px;font-size:11.5px;line-height:1.5;
opacity:.78;cursor:pointer;user-select:none}
#${BAR_ID} .dshq-reply:hover{opacity:1}
#${BAR_ID} .dshq-reply-check{margin:0;accent-color:var(--dshq-accent,currentColor)}
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
.dshq-ref{display:inline;padding:0 4px;border-radius:6px;cursor:pointer;color:inherit;font-weight:600;
background:rgba(127,127,127,.12);background:color-mix(in srgb,currentColor 9%,transparent)}
.dshq-ref:hover{background:rgba(127,127,127,.2);background:color-mix(in srgb,currentColor 16%,transparent)}
/* Hover card: a collapsed pill keeps one clipped line per half and the chip in
the composer is clipped even harder, so hovering either one shows the quote and
the comment in full. It is parked on <body> with position:fixed because a chat
bubble's own overflow would cut an in-place card off. */
#dsh-quote-popover{position:fixed;left:8px;top:8px;z-index:2147483002;display:none;box-sizing:border-box;
width:min(420px,calc(100vw - 16px));max-height:min(340px,60vh);overflow:auto;padding:8px 10px;
border:1px solid var(--dshq-border,rgba(127,127,127,.34));border-radius:10px;
background:var(--dshq-bg,#27272a);color:var(--dshq-fg,#f4f4f5);
font-family:var(--dshq-font,inherit);font-size:12.5px;line-height:1.55;
box-shadow:0 14px 34px rgba(0,0,0,.3);-webkit-app-region:no-drag}
#dsh-quote-popover[data-visible="true"]{display:block}
#dsh-quote-popover .dshq-pop-head{display:flex;align-items:baseline;gap:6px;margin:0 0 3px;
font-size:11px;line-height:1.5;opacity:.62}
#dsh-quote-popover .dshq-pop-mark,#dsh-quote-popover .dshq-pop-label{flex:none}
#dsh-quote-popover .dshq-pop-meta{margin-left:auto;white-space:nowrap}
#dsh-quote-popover .dshq-pop-text{white-space:pre-wrap;overflow-wrap:anywhere;margin:0 0 9px}
#dsh-quote-popover .dshq-pop-text:last-child{margin-bottom:0}
#dsh-quote-popover .dshq-pop-origin{margin:-3px 0 9px;font-size:11px;line-height:1.5;opacity:.55}
#dsh-quote-popover .dshq-pop-source{display:block;width:100%;margin:-3px 0 9px;padding:0;border:0;
background:none;color:inherit;font:inherit;font-size:11px;line-height:1.5;opacity:.62;text-align:left;
overflow-wrap:anywhere;cursor:pointer}
#dsh-quote-popover .dshq-pop-source:hover,#dsh-quote-popover .dshq-pop-source:focus-visible{opacity:1;text-decoration:underline}
#dsh-quote-popover .dshq-pop-actions{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 0}
#dsh-quote-popover .dshq-pop-jump,#dsh-quote-popover .dshq-pop-copy{margin:0;padding:3px 9px;font:inherit;font-size:11px;line-height:1.6;
cursor:pointer;border:1px solid var(--dshq-border);border-radius:6px;background:transparent;color:inherit;
opacity:.72}
#dsh-quote-popover .dshq-pop-jump:hover,#dsh-quote-popover .dshq-pop-copy:hover{opacity:1}
#dsh-quote-popover .dshq-pop-jump[data-lost="true"]{opacity:.95;font-style:italic}
#dsh-quote-popover .dshq-pop-revised{padding-left:9px;opacity:.8;
border-left:2px solid color-mix(in srgb,currentColor 28%,transparent)}
.dshq-cap-revised{flex:none;margin-left:6px;padding:0 5px;border-radius:5px;font-size:10px;line-height:1.7;
background:color-mix(in srgb,currentColor 12%,transparent);opacity:.72}
/* 原文已变 — the jump was tried and the row is gone: a lasting badge on the
circle itself, because a toast has already disappeared by the time the reader
looks again. The quote and its comment stay right where they were. */
.dshq-cap-lost{flex:none;margin-left:6px;padding:0 5px;border-radius:5px;font-size:10px;line-height:1.7;
background:color-mix(in srgb,currentColor 12%,transparent);opacity:.82}
[${FLASH_ATTR}="true"]{animation:dshq-flash ${FLASH_MS}ms ease-out}
@keyframes dshq-flash{0%,35%{background-color:color-mix(in srgb,currentColor 14%,transparent)}
100%{background-color:transparent}}
#dsh-quote-popover .dshq-pop-comment{padding-left:9px;
border-left:2px solid color-mix(in srgb,currentColor 28%,transparent)}
/* Code quotes (from the file preview or the terminal): monospace, and the
code's own spacing — collapsed keeps one clipped line, expanded scrolls. */
.dshq-cap[data-code="true"]{font-family:ui-monospace,SFMono-Regular,Consolas,"Liberation Mono",Menlo,monospace;font-size:12px}
.dshq-cap[data-code="true"] .dshq-cap-quote{white-space:pre}
.dshq-cap[data-code="true"][data-expanded="true"] .dshq-cap-quote{overflow-x:auto;text-overflow:clip;overflow-wrap:normal}
#dsh-quote-popover .dshq-pop-code{font-family:ui-monospace,SFMono-Regular,Consolas,"Liberation Mono",Menlo,monospace;white-space:pre;overflow-x:auto}
/* 引用 ×N — one quiet bar above the composer, one pill per quote. It sits on
<body> with position:fixed because a composer card clips its own overflow. */
.dshq-draftbar{position:fixed;z-index:2147482999;display:flex;align-items:center;gap:6px;box-sizing:border-box;
padding:4px 7px;border:1px solid var(--dshq-border,rgba(127,127,127,.34));border-radius:999px;
background:var(--dshq-bg,#27272a);color:var(--dshq-fg,#f4f4f5);font-family:var(--dshq-font,inherit);
font-size:11.5px;line-height:1.5;box-shadow:0 6px 18px rgba(0,0,0,.18);overflow-x:auto;
scrollbar-width:none;-webkit-app-region:no-drag}
.dshq-draftbar::-webkit-scrollbar{display:none}
.dshq-db-count{flex:none;padding:0 2px;opacity:.62;white-space:nowrap}
.dshq-db-item{display:flex;align-items:center;gap:1px;flex:none;min-width:0}
.dshq-db-pill{flex:none;max-width:170px;padding:2px 9px;border:0;border-radius:999px;
background:color-mix(in srgb,currentColor 9%,transparent);color:inherit;font:inherit;
white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer}
.dshq-db-pill:hover{background:color-mix(in srgb,currentColor 16%,transparent)}
.dshq-db-remove{flex:none;width:18px;height:18px;padding:0;border:0;border-radius:50%;
background:transparent;color:inherit;font:inherit;line-height:16px;opacity:.5;cursor:pointer}
.dshq-db-remove:hover,.dshq-db-remove:focus-visible{opacity:1;background:color-mix(in srgb,currentColor 14%,transparent)}
.dshq-db-edit{flex:none;width:18px;height:18px;padding:0;border:0;border-radius:50%;
background:transparent;color:inherit;font:inherit;line-height:16px;opacity:.5;cursor:pointer}
.dshq-db-edit:hover,.dshq-db-edit:focus-visible{opacity:1;background:color-mix(in srgb,currentColor 14%,transparent)}
.dshq-db-more{flex:none;opacity:.55;white-space:nowrap}
/* 引用本轮 — two quiet buttons at the end of a finished turn. */
.dshq-turn-actions{display:inline-flex;align-items:center;gap:4px;margin-left:6px}
.dshq-turn-btn{padding:1px 7px;border:1px solid var(--dshq-border,rgba(127,127,127,.34));border-radius:99px;
background:transparent;color:inherit;font:inherit;font-size:10.5px;line-height:1.6;opacity:.7;cursor:pointer}
.dshq-turn-btn:hover,.dshq-turn-btn:focus-visible{opacity:1;background:color-mix(in srgb,currentColor 10%,transparent)}
/* 原文侧高亮 — the sentence is painted by the browser's Custom Highlight API
when it is there, so the mark follows scrolling and reflow on its own; the
overlay below is the fallback, plus the ordinal badge in both modes. */
::highlight(dshq-quote){background-color:rgba(242,193,78,.32);color:inherit}
.dshq-anchor-layer{position:fixed;inset:0;z-index:5;display:none;pointer-events:none}
.dshq-anchor-rect{position:absolute;border-radius:2px;background:rgba(242,193,78,.26);
box-shadow:0 0 0 1px rgba(242,193,78,.22) inset}
.dshq-anchor-rect[data-kind="file"]{background:rgba(59,130,246,.2);
box-shadow:0 0 0 1px rgba(59,130,246,.3) inset}
.dshq-anchor-badge{position:absolute;display:flex;align-items:center;justify-content:center;
min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:#c98a1b;color:#fff;
font:600 9.5px/1 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
box-shadow:0 1px 3px rgba(0,0,0,.25)}
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

		/** The first ancestor matching any one of several selectors, in order. */
		function closestAny(node, selectors) {
			for (const selector of selectors) {
				const found = closestFrom(node, selector);
				if (found !== null) return found;
			}
			return null;
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
		 * @returns {{ text: string, x: number, y: number, bottom: number, sessionId: string, hostKind: "chat" | "diff" | "preview" | "terminal", path: string | null } | null}
		 *   the selected text plus its viewport anchor, or null when the current
		 *   selection is not a quotable transcript selection. `hostKind` says where
		 *   the selection lives: a preview/terminal quote is code and travels in a
		 *   fenced block, a chat quote stays a plain blockquote. `path` is the file
		 *   a preview selection came from, when the host exposes one.
		 */
		/**
		 * A path is only worth sending when it reads as one: no whitespace (the
		 * fence info string cannot carry it), no fence characters, not absurdly
		 * long. Anything else degrades to no path at all.
		 */
		function sanitizePath(value) {
			const path = String(value === null || value === undefined ? "" : value).trim();
			if (path === "" || path.length > 200 || /\s|[`~]/u.test(path)) return null;
			return path;
		}

		/**
		 * Path + line range as one fence-friendly token. The range rides in
		 * GitHub's `#L12-L48` spelling — the one shape every developer (and every
		 * model) already reads. An unusable path costs the whole thing; a missing
		 * or one-sided range costs only the suffix.
		 */
		function withLineRange(path, start, end) {
			const clean = sanitizePath(path);
			if (clean === null) return null;
			const from = Number.isSafeInteger(start) && start >= 1 ? start : null;
			const to = Number.isSafeInteger(end) && end >= 1 ? end : null;
			if (from === null || to === null) return clean;
			if (from === to) return clean + "#L" + from;
			return clean + "#L" + Math.min(from, to) + "-L" + Math.max(from, to);
		}

		/**
		 * Split the fence's `path#L12-L48` token back into a file and a 1-based
		 * range. The line is what the sidebar document preview's navigation
		 * params consume; an unusable range leaves the file openable at its top.
		 */
		function parseCodeSource(value) {
			if (typeof value !== "string" || value === "") return null;
			const match = /^(.*?)(?:#L(\d+)(?:-L?(\d+))?)?$/u.exec(value);
			if (match === null || match[1] === "") return null;
			// A bare token with no path separator and no extension is a language
			// tag (a bare `ts` after the fence), not a file — nothing to open, so
			// no source line either.
			if (/[\\/.]/u.test(match[1]) === false) return null;
			const line = match[2] === undefined ? null : Number(match[2]);
			const end = match[3] === undefined ? line : Number(match[3]);
			if (line !== null && (!Number.isSafeInteger(line) || line < 1)) return null;
			if (end !== null && (!Number.isSafeInteger(end) || end < line)) return null;
			return { path: match[1], line, end };
		}

		/** `src/app.ts#L12-L48` -> `src/app.ts · L12-L48`. */
		function formatCodeSource(source) {
			if (source === null || source === undefined) return "";
			const range = source.line === null ? "" : " · L" + source.line + (source.end !== null && source.end !== source.line ? "-L" + source.end : "");
			return source.path + range;
		}

		/**
		 * The address the right sidebar's resource navigator accepts. Mirrors the
		 * host's `dsh-resource://file/session/<sessionId>/<path>` grammar; the
		 * colon in a Windows drive stays literal, every other segment is encoded.
		 */
		function fileAddressFor(sessionId, path) {
			if (typeof sessionId !== "string" || sessionId === "" || typeof path !== "string" || path === "") return null;
			const normalized = path.replace(/\\/g, "/").replace(/^(?:\.\/)+/, "");
			const encode = (segment) => encodeURIComponent(segment).replace(/%3A/gi, ":");
			return "dsh-resource://file/session/" + encode(sessionId) + "/" + normalized.split("/").map(encode).join("/");
		}

		/**
		 * A fence's info string can also be a language tag (a bare `ts` after the
		 * fence). It must be one token, short, and free of characters that would
		 * start a new Markdown construct; anything else degrades to a bare fence.
		 */
		function sanitizeLang(value) {
			const lang = String(value === null || value === undefined ? "" : value).trim();
			if (lang === "" || lang.length > 24 || /^[\w+#.-]+$/u.test(lang) === false) return null;
			return lang;
		}

		/** The language a rendered code block announces, on the `pre` or its `code`. */
		function codeLangOf(block) {
			if (block === null || block === undefined) return null;
			const nodes = [block, typeof block.querySelector === "function" ? block.querySelector("code") : null];
			for (const element of nodes) {
				if (element === null || element === undefined) continue;
				const attr = typeof element.getAttribute === "function" ? element.getAttribute("data-language") : null;
				if (typeof attr === "string" && attr !== "") {
					const clean = sanitizeLang(attr);
					if (clean !== null) return clean;
				}
				const tagged = /(?:^|\s)(?:language|lang)-([\w+#.-]+)/u.exec(String(element.className ?? ""));
				if (tagged !== null) {
					const clean = sanitizeLang(tagged[1]);
					if (clean !== null) return clean;
				}
			}
			return null;
		}

		/**
		 * Where a quote came from, in the reader's words: a file preview, the
		 * terminal, a diff card or a code block. Prose from the transcript
		 * needs no label — the turn it came from already says that much.
		 */
		function originLabel(sessionId, origin) {
			if (origin === "preview") return translateFor(sessionId, "originPreview");
			if (origin === "terminal") return translateFor(sessionId, "originTerminal");
			if (origin === "diff") return translateFor(sessionId, "originDiff");
			if (origin === "code") return translateFor(sessionId, "originCode");
			return "";
		}

		/**
		 * The selected text, with the inline structure the renderer had: a link
		 * keeps its target, an inline code span keeps its backticks, emphasis
		 * keeps its markers. Anything the walker cannot classify falls back to
		 * plain text — a rendering quirk must never lose the quote.
		 */
		function markdownOf(node) {
			if (node === null || node === undefined) return "";
			if (node.nodeType === 3) return String(node.nodeValue ?? "");
			// A range's `cloneContents()` hands back a fragment, not an element;
			// every container is walked the same way.
			if (node.nodeType !== 1 && node.nodeType !== 11) return "";
			const tag = String(node.tagName ?? "").toLowerCase();
			const inner = () => {
				let text = "";
				const children = node.childNodes ?? [];
				for (const child of children) text += markdownOf(child);
				return text;
			};
			if (tag === "br") return "\n";
			if (tag === "a") {
				const href = typeof node.getAttribute === "function" ? node.getAttribute("href") : null;
				const label = inner();
				return href === null || href === "" ? label : "[" + label + "](" + href + ")";
			}
			if (tag === "code" && insidePre(node) === false) return "`" + inner() + "`";
			if (tag === "strong" || tag === "b") return "**" + inner() + "**";
			if (tag === "em" || tag === "i") return "*" + inner() + "*";
			return inner();
		}

		/** Whether a node sits inside a `pre` — block code, not an inline span. */
		function insidePre(node) {
			let current = node;
			for (let depth = 0; depth < 8 && current !== null && current !== undefined; depth += 1) {
				const parent = current.parentNode ?? current.parentElement ?? null;
				if (parent === null || parent === undefined) return false;
				if (String(parent.tagName ?? "").toLowerCase() === "pre") return true;
				current = parent;
			}
			return false;
		}

		/**
		 * The quote without the Markdown marks this plugin added, so the
		 * sentence can still be found in the rendered transcript.
		 */
		function plainOf(text) {
			return String(text)
				.replace(/\[([^\]]*)\]\([^)]*\)/gu, "$1")
				.replace(/`+/gu, "")
				.replace(/\*\*([^*]+)\*\*/gu, "$1")
				.replace(/\*([^*]+)\*/gu, "$1");
		}

		/**
		 * The selection as text. The DOM walk wins only when it actually found
		 * structure the plain text lost (a link, an inline code span); otherwise
		 * the plain selection text is used, so selecting prose changes nothing.
		 */
		function selectedText(selection, range) {
			const plain = String(selection.toString()).replace(/^\n+|\n+$/g, "");
			if (range === null || range === undefined || typeof range.cloneContents !== "function") return plain;
			let markup = "";
			try {
				markup = markdownOf(range.cloneContents()).replace(/^\n+|\n+$/g, "");
			} catch (error) {
				return plain;
			}
			if (markup.trim() === "" || markup === plain) return plain;
			if (/(\[|\]|`|\*\*)/u.test(markup) === false) return plain;
			return markup;
		}

		/**
		 * The wording of one turn, read from the transcript DOM: the rows carry
		 * their turn number and their role, so the plugin never needs the host's
		 * chat snapshot shape. The first row of the wanted role also gives the
		 * coordinate the quote can be jumped back to.
		 */
		function turnTextAt(node, turn, role) {
			if (node === null || node === undefined || turn === null || turn === undefined) return { text: "", source: null };
			const root = closestFrom(node, CONTENT_SELECTOR);
			if (root === null) return { text: "", source: null };
			let wanted = String(turn);
			if (wanted === "[object Object]" || wanted === "") {
				// The host may hand the turn over as a record rather than a number;
				// the row the buttons hang in always carries the number itself.
				let hop = node;
				while (hop !== null && hop !== undefined) {
					if (typeof hop.getAttribute === "function" && hop.getAttribute("data-chat-turn") !== null) { wanted = hop.getAttribute("data-chat-turn"); break; }
					hop = hop.parentElement;
				}
			}
			const rows = root.querySelectorAll("[data-chat-turn]");
			let text = "";
			let source = null;
			for (const row of rows) {
				if (row.getAttribute("data-chat-turn") !== wanted) continue;
				// Reasoning and tool-call groups ride in the same turn and carry
				// data-step-process: they are the transcript's scaffolding, not
				// something the user wrote or the agent answered, so a quoted turn
				// must not drag them in.
				if (row.getAttribute("data-step-process") !== null) continue;
				const kind = rowRoleOf(row);
				if (role === "user" && kind !== "u") continue;
				if (role === "assistant" && kind !== "a") continue;
				let body = String(row.textContent ?? "").trim();
				if (body !== "") {
					for (const part of row.querySelectorAll("[data-step-process]")) {
						const inner = String(part.textContent ?? "").trim();
						if (inner !== "" && body.includes(inner)) body = body.replace(inner, "").trim();
					}
				}
				if (body === "") continue;
				if (source === null) source = chatRowOf(row);
				text += (text === "" ? "" : "\n\n") + body;
			}
			return { text, source };
		}

		/**
		 * Open the comment box on a quote that did not come from a selection —
		 * a whole turn, for instance. The quote and the comment are the same
		 * two halves as always; only the way in is different.
		 */
		function openCommentFor(text, sessionId, source, anchorNode) {
			if (typeof text !== "string" || text.trim() === "") return false;
			const bar = ensureBar(document);
			const rect = anchorNode !== null && anchorNode !== undefined && typeof anchorNode.getBoundingClientRect === "function" ? anchorNode.getBoundingClientRect() : null;
			state.quote = text;
			state.comment = "";
			state.code = false;
			state.path = null;
			state.lang = "";
			state.reply = config().replyByDefault === true;
			state.sessionId = sessionId === null || sessionId === undefined ? null : sessionId;
			state.source = source === null || source === undefined ? null : source;
			state.revising = null;
			state.editing = null;
			if (rect !== null && (rect.width !== 0 || rect.height !== 0)) {
				state.anchor = { x: rect.left + rect.width / 2, y: rect.top, bottom: rect.bottom };
			}
			state.mode = "comment";
			state.suppress = false;
			const input = renderComment(bar);
			position();
			input.focus({ preventScroll: true });
			return true;
		}

		/**
		 * 引用本轮 — the tail of a finished turn offers to quote the question
		 * or the answer of the whole turn. The wording comes from the transcript
		 * itself, and the coordinate of the first row of that role rides along
		 * so the quote can still be jumped back to.
		 */
		function TurnTailQuote(props) {
			const turn = props === null || props === undefined ? null : props.turn;
			const nodeRef = react.useRef(null);
			const take = (role) => {
				const node = nodeRef.current;
				const found = turnTextAt(node, turn, role);
				if (found.text === "") {
					toast(translateFor(null, "turnEmpty"));
					return;
				}
				openCommentFor(found.text, sessionOf(node), found.source, node);
			};
			return react.createElement(
				"span",
				{ class: "dshq-turn-actions", "data-dshq-turn": String(turn), ref: nodeRef },
				react.createElement("button", { type: "button", class: "dshq-turn-btn", onClick: () => take("user") }, translate("turnQuestion")),
				react.createElement("button", { type: "button", class: "dshq-turn-btn", onClick: () => take("assistant") }, translate("turnAnswer"))
			);
		}

		/**
		 * A selection that lives inside one rendered code block of the transcript
		 * is code too, even though its host is the chat: the quote travels as a
		 * fenced block with the renderer's language tag, not a plain blockquote.
		 * Both endpoints must sit in the same `pre` — a selection that merely
		 * crosses a block boundary degrades to a plain quote and never pretends.
		 */
		function chatCodeBlockOf(range) {
			if (range === null || range === undefined) return null;
			const start = closestFrom(range.startContainer, "pre");
			if (start === null) return null;
			if (closestFrom(range.endContainer, "pre") !== start) return null;
			return { node: start, lang: codeLangOf(start) ?? "" };
		}

		/**
		 * The file a preview selection came from, when the host exposes it. Two
		 * shapes are probed, in order:
		 *
		 * 1. The host's own preview root carries a `PathLabel` —
		 *    `[data-textpreview-path]`, a boolean flag whose element holds the
		 *    full path in its `title` (and in its text). This is the real shape
		 *    of the sidebar document preview; the label sits in the header, a
		 *    sibling of the body the selection lives in.
		 * 2. A path-shaped attribute on the host or its ancestors — for any other
		 *    preview host that marks the path as data.
		 *
		 * A miss is the normal case for an unknown host and costs nothing: the
		 * quote then travels exactly as before.
		 */
		function previewPathOf(host) {
			if (typeof host.closest === "function") {
				// Two plain `closest` calls rather than one comma list: the wire only
				// ever needs one root, and a comma is one selector-engine feature
				// the offline shim does not have to grow.
				const root = host.closest("[data-document-preview]") ?? (host.closest("[data-textpreview-state]") ?? null);
				if (root !== null && typeof root.querySelector === "function") {
					const label = root.querySelector("[data-textpreview-path]");
					if (label !== null) {
						const title = typeof label.getAttribute === "function" ? label.getAttribute("title") : null;
						const clean = sanitizePath(typeof title === "string" && title !== "" ? title : label.textContent);
						if (clean !== null) return clean;
					}
				}
			}
			let node = host;
			for (let hop = 0; node !== null && node !== undefined && hop < 6; hop += 1, node = node.parentElement) {
				if (typeof node.getAttribute !== "function") continue;
				for (const attr of PREVIEW_PATH_ATTRS) {
					const value = node.getAttribute(attr);
					if (typeof value !== "string") continue;
					const clean = sanitizePath(value);
					if (clean !== null) return clean;
				}
			}
			return null;
		}

		/**
		 * The file a diff selection came from. A diff card usually has a header
		 * that names the file, so the probe looks inside the host first (the
		 * header's `title` is the cleanest copy), then walks the ancestors for a
		 * path-shaped attribute. No hit means the quote travels without a path.
		 */
		function diffPathOf(host) {
			if (host === null || host === undefined) return null;
			// A caller may hand us the line (a test, or a selection's start), so
			// climb to the diff card first and read its header from there.
			const card = closestAny(host, DIFF_SELECTORS) ?? host;
			const cleanFrom = (node, attr) => {
				if (node === null || node === undefined || typeof node.getAttribute !== "function") return null;
				const title = node.getAttribute("title");
				const direct = sanitizePath(typeof title === "string" ? title : null);
				if (direct !== null) return direct;
				const value = sanitizePath(node.getAttribute(attr));
				if (value !== null) return value;
				return sanitizePath(node.textContent);
			};
			if (typeof card.getAttribute === "function") {
				for (const attr of DIFF_PATH_ATTRS) {
					const clean = cleanFrom(card, attr);
					if (clean !== null) return clean;
				}
			}
			if (typeof card.querySelector === "function") {
				for (const attr of DIFF_PATH_ATTRS) {
					const label = card.querySelector("[" + attr + "]");
					if (label === null) continue;
					const clean = cleanFrom(label, attr);
					if (clean !== null) return clean;
				}
			}
			let node = card;
			for (let hop = 0; node !== null && node !== undefined && hop < 8; hop += 1, node = node.parentElement) {
				if (typeof node.getAttribute !== "function") continue;
				for (const attr of DIFF_PATH_ATTRS) {
					const clean = sanitizePath(node.getAttribute(attr));
					if (clean !== null) return clean;
				}
			}
			return null;
		}

		/** The line number a diff node carries, 1-based, or null. */
		function diffLineOf(node) {
			for (const attr of DIFF_LINE_ATTRS) {
				const row = closestFrom(node, "[" + attr + "]");
				if (row === null) continue;
				const raw = row.getAttribute(attr);
				const direct = Number(raw);
				if (Number.isSafeInteger(direct) && direct >= 1) return direct;
				const text = Number(String(row.textContent === null ? "" : row.textContent).trim());
				if (Number.isSafeInteger(text) && text >= 1) return text;
			}
			// A diff line often keeps the number in a sibling cell; look inside the
			// line row before giving up.
			const scope = closestFrom(node, "[data-diff-line]") ?? closestFrom(node, "[data-line]");
			if (scope !== null && typeof scope.querySelector === "function") {
				const label = scope.querySelector("[data-line-number]");
				if (label !== null) {
					const raw = Number(label.getAttribute("data-line-number"));
					if (Number.isSafeInteger(raw) && raw >= 1) return raw;
					const text = Number(String(label.textContent === null ? "" : label.textContent).trim());
					if (Number.isSafeInteger(text) && text >= 1) return text;
				}
			}
			return null;
		}

		/** The live Range behind the current selection, kept out of the returned
		 * (and JSON-safe) selection fact. */
		let lastSelectionRange = null;

		function readSelection() {
			lastSelectionRange = null;
			const selection = document.getSelection === undefined ? null : document.getSelection();
			if (selection === null || selection.rangeCount === 0 || selection.isCollapsed) return null;

			const range = selection.getRangeAt(0);
			if (closestFrom(range.startContainer, CARD_SELECTOR) !== null) return null;
			if (closestFrom(range.endContainer, CARD_SELECTOR) !== null) return null;

			// The transcript is a quote's native home; a diff card, a file preview
			// or the terminal is a guest there, and borrows the session on screen.
			// A diff wins over the transcript because a diff card lives inside a
			// message: its selection is code, not prose.
			const chat = closestFrom(range.startContainer, CONTENT_SELECTOR);
			const diff = closestAny(range.startContainer, DIFF_SELECTORS);
			let host = null;
			let hostKind = "chat";
			if (diff !== null) {
				host = diff;
				hostKind = "diff";
			} else if (chat !== null) {
				host = chat;
			}
			if (host === null) {
				host = closestFrom(range.startContainer, PREVIEW_SELECTOR);
				hostKind = "preview";
			}
			if (host === null) {
				host = closestFrom(range.startContainer, TERMINAL_SELECTOR);
				hostKind = "terminal";
			}
			if (host === null) return null;

			const codeBlock = hostKind === "chat" ? chatCodeBlockOf(range) : null;
			const text = codeBlock === null ? selectedText(selection, range) : String(selection.toString()).replace(/^\n+|\n+$/g, "");
			if (text.trim().length === 0) return null;
			// A one-character slip should not open the bar when the reader asked
			// for a longer minimum.
			if (text.trim().length < config().minChars) return null;

			let sessionId = null;
			if (chat !== null) {
				sessionId = chat.getAttribute("data-conversation-session");
				if (typeof sessionId !== "string" || sessionId === "") {
					// A pane the host has not labelled yet: fall back to whichever
					// conversation view is mounted, the way the preview path does.
					// The bar used to demand a mounted slot entry here, which is why
					// a selection could go dead after a session switch.
					const active = document.querySelector(CONTENT_SELECTOR + "[data-conversation-session]");
					sessionId = active === null ? null : active.getAttribute("data-conversation-session");
				}
				if (typeof sessionId !== "string" || sessionId === "") return null;
			} else {
				const active = document.querySelector(CONTENT_SELECTOR + "[data-conversation-session]");
				sessionId = active === null ? null : active.getAttribute("data-conversation-session");
				if (typeof sessionId !== "string" || sessionId === "") return null;
			}

			const rect = range.getBoundingClientRect();
			if (rect.width === 0 && rect.height === 0) return null;

			// A preview selection may carry the file it came from — and, when the
			// host numbers its lines (`data-textpreview-line`), the exact range:
			// both ride in the fence's info string so the model can open the file
			// at the very lines it is looking at.
			let path = null;
			if (hostKind === "preview") {
				const lineOf = (node) => {
					const row = closestFrom(node, "[data-textpreview-line]");
					const value = row === null ? Number.NaN : Number(row.getAttribute("data-textpreview-line"));
					return Number.isSafeInteger(value) && value >= 1 ? value : null;
				};
				path = withLineRange(previewPathOf(host), lineOf(range.startContainer), lineOf(range.endContainer));
			} else if (hostKind === "diff") {
				path = withLineRange(diffPathOf(host), diffLineOf(range.startContainer), diffLineOf(range.endContainer));
			}

			lastSelectionRange = range;
			return {
				text,
				x: rect.left + rect.width / 2,
				y: rect.top,
				bottom: rect.bottom,
				sessionId,
				hostKind,
				// Where the selection lived: a file preview, the terminal, a diff
				// card or the transcript itself. The card says so in words.
				origin: codeBlock === null ? hostKind : "code",
				path: typeof path === "string" ? path : null,
				// A chat selection inside one rendered code block: "" when the block
				// announces no language, the tag otherwise. null for every other host.
				lang: codeBlock === null ? null : codeBlock.lang,
				// Only a transcript selection has a row to jump back to, and only
				// when both ends of the selection sit in the same row: a selection
				// that spans messages has no single turn, and claiming the first
				// one would put "引自第 3 轮" on a sentence half of which came from
				// turn 4. The quote still travels; only the provenance is dropped.
				source: (() => {
					if (chat === null) return null;
					const start = chatRowOf(range.startContainer);
					if (start === null) return null;
					const end = chatRowOf(range.endContainer);
					if (end === null || end.attr !== start.attr || end.key !== start.key) return null;
					return { ...start, origin: codeBlock === null ? hostKind : "code" };
				})()
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
		 * A line whose first non-space character is one of the wire marks would
		 * be read back as structure: `❞` would cut the quote in half, and a
		 * `※ │q1:…` or `※ 指令：…` shaped line would be dropped as transport.
		 * One backslash in front makes it content; `unescapeBodyLine` takes it
		 * off on the way out. Backslashes themselves are escaped so the rule is
		 * reversible.
		 */
		function escapeBodyLine(line) {
			const match = /^(\s*)([\\❞※])/u.exec(line);
			if (match === null) return line;
			const indent = match[1];
			return indent + "\\" + line.slice(indent.length);
		}

		function unescapeBodyLine(line) {
			const match = /^(\s*)\\([\\❞※])/u.exec(line);
			if (match === null) return line;
			const indent = match[1];
			return indent + line.slice(indent.length + 1);
		}

		/** UTF-8 bytes of a string, spelled out so the harness needs no TextEncoder. */
		function utf8Bytes(text) {
			const bytes = [];
			for (const char of String(text)) {
				const code = char.codePointAt(0);
				if (code < 0x80) bytes.push(code);
				else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
				else if (code < 0x10000) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
				else bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
			}
			return bytes;
		}

		/** UTF-8 bytes back to a string; null when the bytes are not valid UTF-8. */
		function utf8String(bytes) {
			let out = "";
			for (let index = 0; index < bytes.length; ) {
				const first = bytes[index];
				let code;
				let width;
				if (first < 0x80) {
					code = first;
					width = 1;
				} else if ((first & 0xe0) === 0xc0) {
					code = first & 0x1f;
					width = 2;
				} else if ((first & 0xf0) === 0xe0) {
					code = first & 0x0f;
					width = 3;
				} else if ((first & 0xf8) === 0xf0) {
					code = first & 0x07;
					width = 4;
				} else {
					return null;
				}
				if (index + width > bytes.length) return null;
				for (let step = 1; step < width; step += 1) {
					const next = bytes[index + step];
					if ((next & 0xc0) !== 0x80) return null;
					code = (code << 6) | (next & 0x3f);
				}
				if (width === 2 && code < 0x80) return null;
				if (width === 3 && code < 0x800) return null;
				if (width === 4 && code < 0x10000) return null;
				if (code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return null;
				out += String.fromCodePoint(code);
				index += width;
			}
			return out;
		}

		/** base64url without padding — URL-safe and whitespace-free. */
		function base64UrlEncode(value) {
			const bytes = utf8Bytes(value);
			let out = "";
			for (let index = 0; index < bytes.length; index += 3) {
				const a = bytes[index];
				const b = index + 1 < bytes.length ? bytes[index + 1] : null;
				const c = index + 2 < bytes.length ? bytes[index + 2] : null;
				out += BASE64URL.charAt(a >> 2);
				out += BASE64URL.charAt(((a & 0x03) << 4) | ((b === null ? 0 : b) >> 4));
				if (b === null) break;
				out += BASE64URL.charAt(((b & 0x0f) << 2) | ((c === null ? 0 : c) >> 6));
				if (c === null) break;
				out += BASE64URL.charAt(c & 0x3f);
			}
			return out;
		}

		/** base64url bytes, or null on any character that is not in the alphabet. */
		function base64UrlDecode(value) {
			const text = String(value);
			if (text.length === 0 || text.length % 4 === 1) return null;
			const bytes = [];
			let buffer = 0;
			let bits = 0;
			for (const char of text) {
				const digit = BASE64URL.indexOf(char);
				if (digit === -1) return null;
				buffer = (buffer << 6) | digit;
				bits += 6;
				if (bits >= 8) {
					bits -= 8;
					bytes.push((buffer >> bits) & 0xff);
				}
			}
			return bytes;
		}

		/**
		 * The readable half of a ref line — `引自第 12 轮 · 助手`. It is wire
		 * copy, not UI copy: the parser only has to strip the line, so the
		 * spelling stays stable across locales and releases. The capsule and the
		 * hover card render `uiSourceLabel` instead, which follows the host's
		 * locale.
		 */
		function wireSourceLabel(ref) {
			if (ref === null || typeof ref !== "object") return "";
			const turn = typeof ref.t === "string" ? ref.t.trim() : "";
			const role = ref.r === "a" ? "助手" : ref.r === "u" ? "我" : ref.r === "t" ? "工具" : "";
			if (turn === "" && role === "") return "";
			if (turn === "") return "引自" + role + "的消息";
			return "引自第 " + turn + " 轮" + (role === "" ? "" : " · " + role);
		}

		/** The role word a locale dictionary is asked for, or "" when unknown. */
		function roleKeyOf(ref) {
			if (ref === null || typeof ref !== "object") return "";
			if (ref.r === "a") return "sourceRoleAssistant";
			if (ref.r === "u") return "sourceRoleUser";
			if (ref.r === "t") return "sourceRoleTool";
			return "";
		}

		/** The same provenance in the reader's language, for the card and the bar. */
		function uiSourceLabel(ref, sessionId) {
			if (ref === null || typeof ref !== "object") return "";
			const turn = typeof ref.t === "string" ? ref.t.trim() : "";
			const roleKey = roleKeyOf(ref);
			const role = roleKey === "" ? "" : translateFor(sessionId, roleKey);
			if (turn === "" && role === "") return "";
			const turnText = turn === "" ? "" : String(translateFor(sessionId, "sourceTurn")).replace("{n}", turn);
			if (turnText !== "" && role !== "") {
				return String(translateFor(sessionId, "sourceFromTurnRole")).replace("{turn}", turnText).replace("{role}", role);
			}
			if (turnText !== "") return String(translateFor(sessionId, "sourceFromTurn")).replace("{turn}", turnText);
			return role;
		}

		/** A transcript row's role, when the host exposes one; "" when it does not. */
		function rowRoleOf(row) {
			let node = row;
			for (let hop = 0; node !== null && node !== undefined && hop < 4; hop += 1, node = node.parentElement) {
				if (typeof node.getAttribute !== "function") continue;
				for (const attr of ROLE_ATTRS) {
					const value = node.getAttribute(attr);
					if (typeof value !== "string" || value === "") continue;
					const low = value.trim().toLowerCase();
					if (/^(assistant|bot|model|ai)([-_].*)?$/u.test(low)) return "a";
					if (/^(user|human|me)([-_].*)?$/u.test(low)) return "u";
					if (/^(tool|system)$/u.test(low)) return "t";
				}
			}
			return "";
		}

		/**
		 * A coordinate as the body of a ref line, or "" when it is not one.
		 * Accepts both the wire spelling (`s`,`a`,`k`,`t`,`n`) and the stored
		 * coordinate spelling (`sessionId`,`attr`,`key`,`turn`), so a caller never
		 * has to reshape what it already has.
		 */
		function encodeQuoteRef(ref) {
			if (ref === null || typeof ref !== "object" || Array.isArray(ref)) return "";
			const sessionId = ref.s !== undefined ? ref.s : ref.sessionId;
			const attr = ref.a !== undefined ? ref.a : ref.attr;
			const key = ref.k !== undefined ? ref.k : ref.key;
			const rawTurn = ref.t !== undefined ? ref.t : ref.turn;
			if (typeof sessionId !== "string" || sessionId === "") return "";
			if (!REF_ATTRS.has(attr)) return "";
			if (typeof key !== "string" || key === "") return "";
			const turn = typeof rawTurn === "string" ? rawTurn : typeof rawTurn === "number" && Number.isFinite(rawTurn) ? String(rawTurn) : "";
			const ordinal = Number.isSafeInteger(ref.n) && ref.n >= 0 ? ref.n : 0;
			const role = ROLE_CODES.has(ref.r) ? ref.r : "";
			try {
				const data = { v: REF_VERSION, s: sessionId, a: attr, k: key, t: turn, n: ordinal };
				if (role !== "") data.r = role;
				return base64UrlEncode(JSON.stringify(data));
			} catch (error) {
				return "";
			}
		}

		/**
		 * A ref line's base64url back to a coordinate, or null. Every failure —
		 * bad alphabet, bad UTF-8, bad JSON, missing or out-of-range field — is
		 * one null, never a throw and never a half-parsed object.
		 */
		function decodeQuoteRef(value) {
			try {
				const bytes = base64UrlDecode(value);
				if (bytes === null || bytes.length === 0) return null;
				const json = utf8String(bytes);
				if (json === null) return null;
				const data = JSON.parse(json);
				if (data === null || typeof data !== "object" || Array.isArray(data)) return null;
				if (data.v !== REF_VERSION) return null;
				if (typeof data.s !== "string" || data.s === "") return null;
				if (!REF_ATTRS.has(data.a)) return null;
				if (typeof data.k !== "string" || data.k === "") return null;
				if (typeof data.t !== "string") return null;
				if (!Number.isSafeInteger(data.n) || data.n < 0) return null;
				const role = ROLE_CODES.has(data.r) ? data.r : "";
				const ref = { v: REF_VERSION, s: data.s, a: data.a, k: data.k, t: data.t, n: data.n };
				if (role !== "") ref.r = role;
				return ref;
			} catch (error) {
				return null;
			}
		}

		/** A ref line (or a stored coordinate) as a canonical ref; null when unusable. */
		function normalizeRef(ref) {
			if (ref === null || ref === undefined) return null;
			if (typeof ref === "string") return decodeQuoteRef(ref);
			return decodeQuoteRef(encodeQuoteRef(ref));
		}

		/**
		 * Fold a selection — plus the comment typed on it, if any — into the model's
		 * blockquote form. Kimi keeps both halves in one composer node
		 * (`{ text, comment }`) and shows them as one pill; the wire here is plain
		 * text, so both halves travel inside the same `> ❝ …` / `> ❞ …` block. One
		 * block means one capsule downstream, and anything typed after the chip
		 * stays outside the block instead of being swallowed by the comment.
		 *
		 * A selection that came from the file preview or the terminal is code
		 * (`code === true`): the quote half then opens with a fence line —
		 * `> ❝ ``` ` / `> …` / `> ``` ` — so the model sees a real code block
		 * while the block (and its capsule) still opens at the ❝ mark. The fence
		 * is transport only: `splitQuoteRuns` strips it again on the way out.
		 * A preview quote can carry its file the same way: `meta.path` rides in
		 * the fence's info string (`> ❝ ``` src/app.ts`), which is where Markdown
		 * keeps metadata the model reads but renderers never show as content.
		 *
		 * `meta.reply === true` appends one transport line at the block's tail —
		 * the 逐条回应 instruction the model answers quote by quote. Like the
		 * fence it is wire-only: `splitQuoteRuns` strips it before anything
		 * downstream (capsule, card, export) ever sees it.
		 *
		 * `meta.ref` appends a second transport line — the quote's own source
		 * coordinate, `> ※ 引自第 12 轮 · 助手 │q1:<base64url>` — so a sent quote
		 * can be traced back even after a reload and an empty table, and so the
		 * model can read where it came from without decoding anything. The whole
		 * line is stripped on the way out. `meta.label` is optional: a ref with no
		 * readable half keeps the older `> ※ │q1:…` spelling.
		 */
		function quoteBlock(text, comment, code, meta) {
			const options = meta === null || meta === undefined || typeof meta !== "object" ? {} : meta;
			const path = sanitizePath(options.path) ?? "";
			const lang = code === true ? sanitizeLang(options.lang) ?? "" : "";
			const label = typeof options.label === "string" ? options.label.trim() : "";
			const halves = [
				{ mark: QUOTE_MARK, lines: blockLines(text) },
				{ mark: COMMENT_MARK, lines: blockLines(comment) }
			];
			const block = [];
			for (const half of halves) {
				if (code === true && half.mark === QUOTE_MARK && half.lines.length > 0) {
					const fence = half.lines.some((line) => /^\s*```/u.test(line)) ? "~~~" : "```";
					// The info string carries a file when the quote has one; a chat
					// code block has no file, so the renderer's language rides there.
					const info = path !== "" ? path : lang;
					block.push("> " + half.mark + " " + fence + (info === "" ? "" : " " + info));
					for (const line of half.lines) block.push(line.trim() === "" ? ">" : "> " + escapeBodyLine(line));
					block.push("> " + fence);
					continue;
				}
				for (let index = 0; index < half.lines.length; index += 1) {
					const line = half.lines[index];
					if (index === 0) block.push(line.trim() === "" ? "> " + half.mark : "> " + half.mark + " " + escapeBodyLine(line));
					else block.push(line.trim() === "" ? ">" : "> " + escapeBodyLine(line));
				}
			}
			if (options.reply === true) {
				const instruction = typeof options.replyInstruction === "string" && options.replyInstruction !== "" ? options.replyInstruction : REPLY_INSTRUCTION;
				block.push("> " + REPLY_MARK + " " + instruction);
			}
			const wire = encodeQuoteRef(options.ref);
			if (wire !== "") block.push("> " + REPLY_MARK + " " + (label === "" ? "" : label + " ") + REF_PREFIX + wire);
			return block.join("\n");
		}

		/**
		 * Read every serialized quote back out of a transcript run. One message can
		 * carry several chips, so a run is a sequence of loose text and `> ❝ …`
		 * blocks: each block becomes its own capsule and the loose text between
		 * them is drawn back verbatim (the blank lines the serializer adds around a
		 * block are filler, so they go).
		 *
		 * @returns {({ type: "text", text: string } | { type: "quote", quote: string, comment: string, code: string | null, ref?: object })[] | null}
		 *   `code` is the fence's language tag (empty string when none) for a code
		 *   quote, and null for a plain one. `ref` is the decoded source ref when
		 *   the block carried one; a malformed ref is dropped, never thrown.
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
				// The 逐条回应 instruction and the 自带坐标 ref are transport for
				// the model: they ride at the block's tail and never reach a
				// capsule, a card or the export. Both strip rules are narrow — a
				// quote or comment that merely starts with a `※` is left alone.
				const carried = [];
				let wireRef = null;
				for (const entry of body) {
					if (/^\s*※\s*(?:指令|Instruction)(?:\s|[:：]|$)/u.test(entry)) continue;
					const wire = REF_LINE.exec(entry);
					if (wire !== null) {
						// A line shaped like a ref is transport even when its payload
						// is corrupt: strip it, ignore it, fall back to the table.
						if (wireRef === null) wireRef = decodeQuoteRef(wire[1]);
						continue;
					}
					carried.push(entry);
				}
				const before = loose.replace(/^\s+/u, "").replace(/\s+$/u, "");
				if (before !== "") segments.push({ type: "text", text: before });
				loose = "";
				// `> ❞ …` opens the comment half of the same block: everything from
				// there down is the comment, everything above it is the quote.
				const cut = carried.findIndex((entry) => entry.replace(/^\s+/u, "").startsWith(COMMENT_MARK));
				let quoteLines = cut === -1 ? carried : carried.slice(0, cut);
				const commentLines = cut === -1 ? [] : carried.slice(cut);
				if (commentLines.length > 0) {
					commentLines[0] = commentLines[0]
						.replace(/^\s+/u, "")
						.slice(COMMENT_MARK.length)
						.replace(/^\s/u, "");
				}
				// `> ❝ ``` ` opens the code form the preview/terminal path writes: the
				// fence (and its closing twin) are transport, the lines between come
				// back out as the code it was. `code` is the fence's language tag —
				// an empty string when the fence carried none, null for a plain quote.
				//
				// A fence only counts as transport when the block CLOSES it: the
				// writer always emits a matching closing fence (see `quoteBlock`),
				// so a lone leading fence is prose. Without this a plain quote
				// whose text happens to start with ``` — a quoted markdown snippet,
				// say — lost that first line on read-back, and a one-line quote
				// like that lost its whole body. Requiring the twin keeps every
				// already-sent message parsing exactly as before (its fences were
				// always paired) and gives the ambiguous case back to the prose.
				let code = null;
				const fence = quoteLines.length > 0 ? quoteLines[0].match(/^\s*(```+|~~~+)\s*(\S*)\s*$/u) : null;
				if (fence !== null) {
					const token = fence[1].charAt(0) === "`" ? "```" : "~~~";
					const rest = quoteLines.slice(1);
					// The closing fence is the LAST body line of a code block.
					const closed = rest.length > 0 && rest[rest.length - 1].trim() === token;
					if (closed) {
						code = fence[2] === undefined ? "" : fence[2];
						quoteLines = rest.slice(0, -1);
					}
				}
				const quote = quoteLines.map(unescapeBodyLine).join("\n").replace(/\s+$/u, "");
				const comment = commentLines.map(unescapeBodyLine).join("\n").replace(/\s+$/u, "");
				if (quote.trim() !== "" || comment.trim() !== "") {
					const segment = { type: "quote", quote, comment, code };
					// `ref` is only on segments that really carried one, so the
					// shape stays exactly what it was for every older message.
					if (wireRef !== null) segment.ref = wireRef;
					segments.push(segment);
				}
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

		/**
		 * Quote (+ optional comment) exactly as it should land in the draft. The
		 * block always ends with a blank line, so wording that follows starts on
		 * its own line; the caller decides whether it goes in front of the draft.
		 */
		function buildPayload(text, comment, code, meta) {
			return quoteBlock(text, comment, code, meta) + "\n\n";
		}

		/**
		 * Place a plain-text payload at the caret, or in front of the draft when
		 * the reader already wrote something — the same top-then-line-break rule
		 * as the chip path, for hosts that lost the native reference face.
		 */
		function insertPayload(entry, payload, atTop) {
			for (let attempt = 0; attempt < 2; attempt += 1) {
				const actions = entry.actions();
				if (actions === null || typeof actions.captureInsertion !== "function") return false;
				if (typeof actions.insertText !== "function") return false;
				const captured = actions.captureInsertion();
				const span = atTop === true && captured !== null && captured !== undefined && typeof captured === "object"
					? { ...captured, start: 0, end: 0 }
					: captured;
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
		function chipRef(text, comment, code, meta) {
			// The leading newline puts the block on its own paragraph when the chip
			// lands after typed text; the send path trims it when the quote is
			// the whole message.
			return "\n" + quoteBlock(text, comment, code, meta) + "\n\n";
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
		/** Someone (us) holds a live registration with the host service. */
		let sourceRegistered = false;
		/**
		 * Where the pipeline last gave up, for support. "The quote did not land"
		 * costs a screenshot and a guess; this says which step refused — the
		 * source registration, the shell, the event path, the exact delete, or
		 * the side thread's composer. It holds a stage and a short reason, never
		 * the quoted text, so it is safe to paste into an issue.
		 */
		const lastFailure = { stage: "", detail: "", at: 0, count: 0 };

		function noteFailure(stage, detail) {
			lastFailure.stage = String(stage);
			lastFailure.detail = detail === undefined || detail === null ? "" : String(detail).slice(0, 160);
			lastFailure.at = Date.now();
			lastFailure.count += 1;
		}

		function failureSnapshot() {
			return { stage: lastFailure.stage, detail: lastFailure.detail, at: lastFailure.at, count: lastFailure.count };
		}
		/**
		 * How many `apply()` instances share that one registration. The host
		 * mounts this plugin more than once per page and tears each mount down
		 * on its own; when every mount disposed the source in turn, the second
		 * mount's registration died under the first mount's teardown and every
		 * send from then on failed with `slash: no serializer for reference
		 * source "quote"` — the chip still inserted, so the failure only showed
		 * up as a raw host error at send time.
		 */
		let sourceHolders = 0;

		/**
		 * One host service by name, or null. Services are read through `get` on
		 * purpose: a plugin may name a dependency it never declared, in which
		 * case the property form is `undefined` on some hosts while `get` still
		 * answers — that difference is what left the quote list reporting
		 * `no-sessions` with the chip working perfectly.
		 */
		function serviceOf(name) {
			if (pluginCtx === null || pluginCtx === undefined) return null;
			try {
				if (typeof pluginCtx.get === "function") {
					const viaGet = pluginCtx.get(name);
					if (viaGet !== undefined && viaGet !== null) return viaGet;
				}
			} catch (error) {
				// Fall through to the property form.
			}
			try {
				const value = pluginCtx[name];
				return value === undefined ? null : value;
			} catch (error) {
				return null;
			}
		}

		/** Register the chip owner, once the input-trigger service is reachable. */
		function ensureSource() {
			if (sourceRegistered) return true;
			if (pluginCtx === null) {
				noteFailure("source", "no host context yet");
				return false;
			}
			let service = null;
			try {
				service = pluginCtx.get("inputTriggers");
			} catch (error) {
				service = null;
			}
			if (service === null || service === undefined || typeof service.registerSource !== "function") {
				noteFailure("source", "inputTriggers.registerSource is missing");
				return false;
			}
			try {
				const disposer = service.registerSource(quoteSource);
				sourceDisposer = typeof disposer === "function" ? disposer : () => {};
				sourceRegistered = true;
				return true;
			} catch (error) {
				// "#quote is already registered" is the common case (a second mount
				// of this plugin): the source object is ours and the codec is
				// stateless, so the resident registration is good enough — but this
				// mount did not create it, so it must not claim the disposer.
				console.warn("[ui-quote] reference source already registered; reusing it:", error);
				sourceRegistered = true;
				sourceDisposer = null;
				return true;
			}
		}

		/** One mount now needs the source; the first one to run registers it. */
		function holdSource() {
			sourceHolders += 1;
			ensureSource();
		}

		/** Drop one mount's hold; only the last one out disposes the source. */
		function releaseSource() {
			sourceHolders = Math.max(0, sourceHolders - 1);
			if (sourceHolders > 0) return;
			sourceRegistered = false;
			const disposer = sourceDisposer;
			sourceDisposer = null;
			if (disposer === null) return;
			try {
				disposer();
			} catch (error) {
				// A host that already forgot the registration is not our problem.
			}
		}

		/** The host's resident composer shell for a session, or null when absent. */
		function inputShellFor(sessionId) {
			if (pluginCtx === null || typeof sessionId !== "string" || sessionId === "") return null;
			let hub = null;
			try {
				const conversation = pluginCtx.get("conversation");
				hub = conversation === null || conversation === undefined ? null : conversation.input;
			} catch (error) {
				hub = null;
			}
			if (hub === null || hub === undefined || typeof hub.shell !== "function") return null;
			try {
				const shell = hub.shell(sessionId);
				return shell === null || shell === undefined ? null : shell;
			} catch (error) {
				return null;
			}
		}

		/**
		 * The face that can put text into a session's draft: the mounted slot
		 * entry when there is one, else the host shell's own actions. The bar is
		 * document-level, so an action must never depend on a slot entry still
		 * being there — the composer outlives the entry across a session switch.
		 */
		function insertionFace(sessionId, shell) {
			const entry = typeof sessionId === "string" ? sessions.get(sessionId) : undefined;
			if (entry !== undefined && entry !== null) return entry;
			const actions = shell === null || shell === undefined ? null : shell.actions;
			if (actions === null || actions === undefined || typeof actions.captureInsertion !== "function") return null;
			return { actions: () => actions };
		}

		/**
		 * The session-scoped context the composer registered its slash listeners
		 * on. Used only when the shell's direct insertReference method is gone but
		 * the host still routes the scoped `slash/input-*` events.
		 */
		function sessionActx(sessionId) {
			const services = serviceOf("sessions");
			if (services === null || services === undefined || typeof sessionId !== "string" || sessionId === "") return null;
			try {
				if (typeof services.binding === "function") {
					const binding = services.binding(sessionId);
					if (binding !== null && binding !== undefined && binding.ctx !== null && binding.ctx !== undefined) return binding.ctx;
				}
			} catch (error) {
				// Fall through to the plain scope accessor.
			}
			try {
				if (typeof services.scope === "function") return services.scope(sessionId) ?? null;
			} catch (error) {
				return null;
			}
			return null;
		}

		/** Emit one scoped input event; false when no listener applied it. */
		function dispatchInputEvent(actx, name, payload) {
			if (actx === null || actx === undefined || typeof actx.bail !== "function") return false;
			try {
				return actx.bail(actx, name, payload) === true;
			} catch (error) {
				return false;
			}
		}

		/**
		 * Mint a chip through the conversation input service face: the resident
		 * shell owns the editor that can place an atomic node. The direct method is
		 * the primary path; the scoped `slash/input-insert-reference` event is the
		 * compatibility path for hosts that keep the event but drop the method.
		 * Every step is optional — a missing service falls back to the Markdown form.
		 */
		function insertChip(entry, sessionId, text, comment, code, meta) {
			if (!ensureSource() || pluginCtx === null) {
				noteFailure("insert", "the reference source is not registered");
				return false;
			}
			const shell = inputShellFor(sessionId);
			const canShell = shell !== null && shell !== undefined && typeof shell.insertReference === "function";
			const actx = sessionActx(sessionId);
			if (!canShell && actx === null) {
				noteFailure("insert", "no composer shell and no session context");
				return false;
			}
			const model = chipRef(text, comment, code, meta);
			const attachment = {
				source: SOURCE_NAME,
				ref: model,
				label: chipLabel(text, comment),
				appearance: "session",
				clipboardText: model
			};
			// A chip is an inline node. The reader's wording already in the draft
			// must stay *after* the quote, on a line of its own: the quote goes to
			// the top, then one real line break, then whatever they had written.
			// The Markdown fallback writes the quote first for the same reason.
			const ownText = shell === null || shell === undefined ? composerText().trim() !== "" : (draftOwnText(shell) ?? composerText().trim() !== "");
			const toTop = ownText === true;
			let refusal = "";
			for (let attempt = 0; attempt < 2; attempt += 1) {
				const actions = entry.actions();
				if (actions === null || typeof actions.captureInsertion !== "function") {
					noteFailure("insert", "the composer face has no captureInsertion");
					return false;
				}
				const captured = actions.captureInsertion();
				const span = toTop && captured !== null && captured !== undefined && typeof captured === "object"
					? { ...captured, start: 0, end: 0 }
					: captured;
				if (canShell) {
					try {
						if (shell.insertReference(attachment, span) === true) {
							// The chip is in the draft now: index the pair so hovering the
							// chip can show what `chipLabel` had to clip away. The ref rides
							// along, so the chip's card already knows the coordinate it will
							// carry once the message is sent.
							rememberChip(text, comment, sessionId, code, meta);
							if (toTop) {
								separateTopChip(entry);
								focusComposerAtEnd();
							}
							return true;
						}
					} catch (error) {
						// The event path below may still be available.
						refusal = error instanceof Error ? error.message : String(error);
					}
				}
				if (dispatchInputEvent(actx, "slash/input-insert-reference", { reference: attachment, span })) {
					rememberChip(text, comment, sessionId, code, meta);
					if (toTop) {
						separateTopChip(entry);
						focusComposerAtEnd();
					}
					return true;
				}
			}
			noteFailure(
				"insert",
				canShell
					? "insertReference and the scoped event both refused the chip" + (refusal === "" ? "" : ": " + refusal)
					: "the scoped event refused the chip"
			);
			return false;
		}

		/** The Lexical contenteditable inside the composer card, when there is one. */
		function composerEditor() {
			const composer = document.querySelector(COMPOSER_SELECTOR);
			if (composer === null || composer === undefined) return null;
			const editable = composer.querySelector('[contenteditable="true"]') ?? composer.querySelector('[data-lexical-editor]');
			return editable ?? composer;
		}

		function focusComposer() {
			const target = composerEditor();
			if (target !== null && typeof target.focus === "function") target.focus({ preventScroll: true });
		}

		/**
		 * Put the caret at the end after a quote moved to the top: the reader's
		 * own wording now sits below the chip, and typing must continue after it
		 * instead of in front of it. A DOM without a usable selection just keeps
		 * whatever caret the browser left.
		 */
		function focusComposerAtEnd() {
			const target = composerEditor();
			if (target === null || typeof target.focus !== "function") return;
			try {
				target.focus({ preventScroll: true });
				if (typeof document.getSelection !== "function" || typeof document.createRange !== "function") return;
				const selection = document.getSelection();
				if (selection === null || typeof selection.addRange !== "function" || typeof selection.removeAllRanges !== "function") return;
				const range = document.createRange();
				if (typeof range.selectNodeContents !== "function" || typeof range.collapse !== "function") return;
				range.selectNodeContents(target);
				range.collapse(false);
				selection.removeAllRanges();
				selection.addRange(range);
			} catch (error) {
				// A caret left where the browser put it is not a failed insert.
			}
		}

		/**
		 * One real line break between a quote that just went to the top and the
		 * wording that was already in the draft. The chip is an inline node, so
		 * only an edit in the editor can move the wording to its own line; a host
		 * without `insertText` keeps the chip and loses only the break.
		 */
		function separateTopChip(entry) {
			const actions = typeof entry.actions === "function" ? entry.actions() : null;
			if (actions === null || actions === undefined) return false;
			if (typeof actions.captureInsertion !== "function" || typeof actions.insertText !== "function") return false;
			try {
				const span = actions.captureInsertion();
				if (span === null || span === undefined || typeof span !== "object") return false;
				return actions.insertText("\n", span) === true;
			} catch (error) {
				return false;
			}
		}

		/**
		 * 列出多选 — write several quotes into the draft in one action. Each row
		 * keeps its own chip and coordinate; nothing is merged. If the chip path
		 * is unavailable for every row, the whole set falls back to one text
		 * payload, so the action still does what it says instead of silently
		 * dropping half the list.
		 */
		function insertQuoteRows(sessionId, rows) {
			const list = Array.isArray(rows) ? rows.filter((row) => row !== null && row !== undefined && typeof row.quote === "string" && row.quote.trim() !== "") : [];
			if (list.length === 0) return 0;
			const shell = inputShellFor(sessionId);
			const entry = insertionFace(sessionId, shell);
			if (entry === null) {
				toast(translateFor(sessionId, "failed"));
				return 0;
			}
			let inserted = 0;
			const pending = [];
			// A quote goes to the top when the draft already holds wording, so
			// prepending walks the list backwards: the first row must end up on
			// top after every later row has pushed it down.
			const toTop = shell === null || shell === undefined ? composerText().trim() !== "" : (draftOwnText(shell) ?? composerText().trim() !== "");
			const ordered = toTop === true ? [...list].reverse() : list;
			for (const row of ordered) {
				const ref = row.ref === undefined ? null : row.ref;
				const meta = {
					path: typeof row.fence === "string" ? row.fence : null,
					reply: false,
					ref,
					label: wireSourceLabel(ref)
				};
				if (insertChip(entry, sessionId, row.quote, typeof row.comment === "string" ? row.comment : "", row.code === true, meta)) inserted += 1;
				else pending.push(row);
			}
			if (toTop === true) pending.reverse();
			// A partial chip path must not drop the rest: the rows that could not
			// become chips go in as text blocks, coordinates included.
			if (pending.length > 0) {
				const blocks = pending.map((row) =>
					quoteBlock(row.quote, typeof row.comment === "string" ? row.comment : "", row.code === true, {
						path: typeof row.fence === "string" ? row.fence : null,
						ref: row.ref === undefined ? null : row.ref,
						label: wireSourceLabel(row.ref)
					})
				);
				const prefix = composerText().trim() === "" ? "" : "\n";
				if (insertPayload(entry, prefix + blocks.join("\n\n") + "\n\n")) inserted += pending.length;
			}
			if (inserted === 0) {
				toast(translateFor(sessionId, "failed"));
				return 0;
			}
			focusComposer();
			toast(String(translateFor(sessionId, "panelInserted")).replace("{n}", String(inserted)));
			return inserted;
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
		/** Debounce for the visibility/focus rescan; see `onCapsuleWake`. */
		let capsuleWakeTimer = null;

		/** The dictionaries the `language` switch can pin; `auto` is not one. */
		const DICTS = { zh, en, ru };

		function translateFor(sessionId, key) {
			const chosen = config().language;
			if (chosen !== "auto") {
				const dict = DICTS[chosen];
				const pinned = dict === undefined ? undefined : dict[key];
				return typeof pinned === "string" && pinned !== "" ? pinned : key;
			}
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
			const isCode = segment.code !== null && segment.code !== undefined;
			const ref = segment.ref === undefined || segment.ref === null ? null : normalizeRef(segment.ref);
			if (ref !== null) rememberQuoteText(ref, segment.quote);
			// The quote is in a transcript with its ref: it was sent, so a mark
			// minted for its draft becomes permanent.
			if (ref !== null && promoteSource(ref, segment.quote)) scheduleAnchors();
			const jumpKey = capsuleJumpKey(segment.quote, sessionId, ref);
			const lost = lostJumps.has(jumpKey);
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
			// A quote that was corrected later says so on its own pill: the
			// transcript is append-only, so this badge is the only trace back.
			if (revisedFor(segment.quote, ref) !== null) {
				children.push(el(doc, "span", { class: "dshq-cap-revised", text: translateFor(sessionId, "revised") }));
			}
			// 原文已变 — a jump was tried and the row is gone. It stays on the pill
			// (the toast is only the instant feedback), while quote and comment
			// remain exactly where they were.
			if (lost) children.push(el(doc, "span", { class: "dshq-cap-lost", text: translateFor(sessionId, "sourceLost") }));
			children.push(copy);

			const cap = el(
				doc,
				"div",
				{
					class: "dshq-cap",
					"data-dshq": "capsule",
					"data-code": isCode ? "true" : null,
					"data-dshq-jump": jumpKey,
					"data-dshq-session": sessionId === null || sessionId === undefined ? null : sessionId,
					"data-dshq-lost": lost ? "true" : null,
					role: "group",
					tabindex: "0",
					"aria-label": label,
					"aria-expanded": "false"
				},
				children
			);
			const info = {
				quote: segment.quote,
				comment,
				sessionId,
				code: isCode,
				// The fence's info string is the file a preview/diff quote came
				// from (`src/app.ts#L12-L48`); the card turns it into an open action.
				path: isCode && typeof segment.code === "string" && segment.code !== "" ? segment.code : null,
				ref,
				jumpKey
			};
			const toggle = () => {
				const next = cap.dataset.expanded === "true" ? "false" : "true";
				cap.dataset.expanded = next;
				cap.setAttribute("aria-expanded", next);
			};
			cap.addEventListener("mouseenter", () => showPopover(cap, info));
			cap.addEventListener("mouseleave", hidePopoverSoon);
			cap.addEventListener("focus", () => showPopover(cap, info));
			cap.addEventListener("blur", hidePopover);
			cap.addEventListener("keydown", (event) => {
				if (event.key !== "Enter" && event.key !== " ") return;
				const target = event.target instanceof Element ? event.target : null;
				if (target !== null && target.closest(".dshq-cap-copy") !== null) return;
				event.preventDefault();
				toggle();
			});
			cap.addEventListener("click", (event) => {
				const target = event.target instanceof Element ? event.target : null;
				if (target !== null && target.closest(".dshq-cap-copy") !== null) return;
				// Dragging a selection inside the quote must not toggle the pill.
				const selection = doc.getSelection === undefined ? null : doc.getSelection();
				if (selection !== null && !selection.isCollapsed) return;
				toggle();
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
		/**
		 * The same index, kept across reloads. The host persists the draft's
		 * references (it writes `{draft: {text, references}}` per session into
		 * localStorage), so the composer chips come back after a reload — but our
		 * in-memory map does not. Without this the aggregate bar would come back
		 * as a bare count, the chip would lose its card, and the source it points
		 * at would be unreachable until the quote was made again.
		 */
		const persistedChips = new Map();
		const PERSISTED_CHIP_KEY = "dsh-client-ui-quote:v1:chip-index";
		const PERSISTED_CHIP_LIMIT = 200;
		/** chip element -> its listeners, so uninstall can unhook them. */
		const wiredChips = new Map();
		/** Chips are few; a bounded index keeps a long session from growing. */
		const CHIP_LIMIT = 24;
		/** Transcript flushes to look for a chip that React has not rendered yet. */
		const CHIP_WIRE_BUDGET = 40;
		let chipWiresPending = 0;
		let chipWireBudget = 0;
		/** Composer card -> its aggregate quote bar; at most one bar per composer. */
		const draftBars = new Map();
		/** Composer card -> the refs of the quote chips it held on the last pass. */
		const cardChips = new Map();
		let draftBarTimer = null;
		/** Below this many pills the bar shows them all; beyond it, a `+N`. */
		const DRAFTBAR_LIMIT = 5;
		/**
		 * The source table keys a quote by its first 120 characters (that is its
		 * identity, not its display text). A highlight needs the whole sentence,
		 * so the full wording is remembered here as chips and capsules appear.
		 */
		const fullQuoteByRef = new Map();
		const FULL_QUOTE_LIMIT = 400;
		/** The source-side highlight layer, and its repaint timer. */
		let anchorLayer = null;
		let anchorTimer = null;
		/**
		 * The line range of the file a code quote came from, once the reader has
		 * opened it. The preview scrolls to the first line itself; this is what
		 * says which lines were quoted.
		 */
		let openedRange = null;
		/** A transcript rarely needs more than this many marks on screen. */
		const ANCHOR_LIMIT = 80;

		function cancelPopoverHide() {
			if (popoverHideTimer === null) return;
			clearTimeout(popoverHideTimer);
			popoverHideTimer = null;
		}

		function hidePopover() {
			cancelPopoverHide();
			popoverAnchor = null;
			popoverInfo = null;
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
			node.append(el(doc, "div", { class: "dshq-pop-text dshq-pop-quote" + (info.code === true ? " dshq-pop-code" : ""), text: info.quote }));
			if (info.comment !== "") {
				node.append(popoverRow(doc, COMMENT_MARK, translateFor(info.sessionId, "comment"), ""));
				node.append(el(doc, "div", { class: "dshq-pop-text dshq-pop-comment", text: info.comment }));
			}
			// 出处 — the readable half of the ref line, so the card says where a
			// quote came from without opening the raw message text.
			const origin = uiSourceLabel(info.ref, info.sessionId);
			if (origin !== "") node.append(el(doc, "div", { class: "dshq-pop-origin", text: origin }));
			// 文件 — a preview/diff quote carries its file in the fence; the path
			// itself is the open action, and the preview scrolls to the first line.
			const source = parseCodeSource(info.path);
			const kind = originLabel(info.sessionId, info.origin ?? (sourceFor(plainOf(info.quote))?.origin ?? ""));
			if (source !== null) {
				const pathLabel = (kind === "" ? "" : kind + " · ") + formatCodeSource(source);
				const open = el(doc, "button", {
					type: "button",
					class: "dshq-pop-source",
					text: pathLabel + " \u2197",
					title: translateFor(info.sessionId, "openFile"),
					"aria-label": translateFor(info.sessionId, "openFile") + ": " + pathLabel
				});
				open.addEventListener("click", (event) => {
					event.stopPropagation();
					openCodeSource(info);
				});
				node.append(open);
			} else if (kind !== "") {
				// A quote from the terminal or a code block: no file to open, but
				// the reader still deserves to know where it came from.
				node.append(el(doc, "div", { class: "dshq-pop-origin", text: kind }));
			}
			// A quote that already has a correction says what the correction says.
			const revised = revisedFor(info.quote, info.ref);
			if (revised !== null) {
				node.append(popoverRow(doc, COMMENT_MARK, translateFor(info.sessionId, "revised"), ""));
				node.append(el(doc, "div", { class: "dshq-pop-text dshq-pop-revised", text: revised.comment }));
				// A revision that also corrected the wording shows that wording here,
				// so the superseded capsule tells the whole story of the correction.
				if (typeof revised.quote === "string" && revised.quote !== "" && revised.quote !== info.quote) {
					node.append(el(doc, "div", { class: "dshq-pop-text dshq-pop-revised dshq-pop-revised-quote", text: revised.quote }));
				}
			}
			const actions = el(doc, "div", { class: "dshq-pop-actions" }, []);
			// A coordinate can now ride in the sent text itself (a ref line), so
			// the card offers a jump even when a reload emptied the local table.
			// Only a coordinate that was actually watched being selected does.
			const candidates = sourceCandidatesFor(info.quote, info.sessionId, info.ref);
			const jumpKey = capsuleJumpKey(info.quote, info.sessionId, info.ref);
			if (candidates.length > 0) {
				const lost = lostJumps.has(jumpKey);
				const jump = el(doc, "button", {
					type: "button",
					class: "dshq-pop-jump" + (lost ? " dshq-pop-jump-lost" : ""),
					"data-lost": lost ? "true" : null,
					text: translateFor(info.sessionId, lost ? "sourceLost" : "jump")
				});
				jump.addEventListener("click", (event) => {
					event.stopPropagation();
					jumpToSource(info.quote, info.sessionId, info.ref);
				});
				actions.append(jump);
				// 改这条引用: the transcript cannot be edited, so this reopens the
				// comment box on the same quote and lets the new quote supersede it.
				const revise = el(doc, "button", {
					type: "button",
					class: "dshq-pop-jump dshq-pop-revise",
					text: translateFor(info.sessionId, "revise")
				});
				revise.addEventListener("click", (event) => {
					event.stopPropagation();
					// Take the anchor first: hiding the card clears it, and the bar
					// needs to know where on screen it was opened from.
					const anchor = popoverAnchor;
					hidePopover();
					startRevision(info.quote, info.comment, info.sessionId, anchor, info.code === true, info.ref, info.path, info.lang, info.origin);
				});
				actions.append(revise);
			}
			// Copy this one quote as Markdown — the unit someone pastes into a PR,
			// an issue or another chat. Offered whether or not it has coordinates.
			const copyMarkdown = el(doc, "button", {
				type: "button",
				class: "dshq-pop-copy",
				text: translateFor(info.sessionId, "copyMarkdown")
			});
			copyMarkdown.addEventListener("click", (event) => {
				event.stopPropagation();
				writeClipboard(
					quoteRowMarkdown({
						quote: info.quote,
						comment: info.comment,
						code: info.code === true,
						// The info string is the file when there is one, otherwise the
						// chat code block's language — the same slot the wire uses.
						fence: typeof info.path === "string" && info.path !== "" ? info.path : typeof info.lang === "string" ? info.lang : "",
						time: "",
						ref: info.ref
					})
				);
				copyMarkdown.textContent = translateFor(info.sessionId, "copied");
				setTimeout(() => {
					copyMarkdown.textContent = translateFor(info.sessionId, "copyMarkdown");
				}, 1200);
			});
			actions.append(copyMarkdown);
			if (actions.childNodes.length > 0) node.append(actions);
			// The ref a card was filled with lets a later failure update its jump
			// control in place instead of waiting for the next hover.
			popoverInfo = info;
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
		function rememberChip(quote, comment, sessionId, code, meta) {
			const label = normalizeLabel(chipLabel(quote, comment));
			if (label === "") return;
			if (chipIndex.has(label)) chipIndex.delete(label);
			const ref = meta === null || meta === undefined ? null : normalizeRef(meta.ref);
			if (ref !== null) rememberQuoteText(ref, plainOf(quote));
			const info = {
				quote,
				comment: typeof comment === "string" ? comment : "",
				sessionId,
				code: code === true,
				path: meta !== null && meta !== undefined && typeof meta.path === "string" && meta.path !== "" ? meta.path : null,
				lang: meta !== null && meta !== undefined && typeof meta.lang === "string" ? meta.lang : "",
				origin: meta !== null && meta !== undefined && typeof meta.origin === "string" ? meta.origin : "chat",
				ref
			};
			chipIndex.set(label, info);
			// The host restores the draft's chips after a reload; this index is what
			// makes them ours again (the bar, the card, the file it points at).
			persistChip(label, info);
			while (chipIndex.size > CHIP_LIMIT) chipIndex.delete(chipIndex.keys().next().value);
			chipWiresPending += 1;
			chipWireBudget = CHIP_WIRE_BUDGET;
		}

		/* ------------------------------------------------------------------ *
		 * Jump back — the message a quote came from
		 * ------------------------------------------------------------------ */

		/**
		 * The key a legacy quote is remembered under: its own wording, whitespace
		 * folded and capped, so a long paragraph does not become the key. v2 keys
		 * the table by source turn instead; this spelling is still the v1 table's
		 * key and the human-readable identity kept beside every candidate.
		 */
		function sourceKeyOf(quote) {
			return String(quote).replace(/\s+/gu, " ").trim().slice(0, 120);
		}

		/** `<sessionId>::<turn>` — one bin per source turn, an array inside. */
		function sourceBinKey(sessionId, turn) {
			return String(sessionId === null || sessionId === undefined ? "" : sessionId) + "::" + String(turn === null || turn === undefined ? "" : turn);
		}

		/** One stored candidate, or null when the shape is not ours. */
		function sourceCandidateOf(value) {
			if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
			if (typeof value.sessionId !== "string" || value.sessionId === "") return null;
			if (!REF_ATTRS.has(value.attr)) return null;
			if (typeof value.key !== "string" || value.key === "") return null;
			if (typeof value.quote !== "string") return null;
			const turn = value.turn === undefined || value.turn === null ? "" : String(value.turn);
			const at = Number(value.at);
			const ordinal = Number(value.n);
			const candidate = {
				sessionId: value.sessionId,
				attr: value.attr,
				key: value.key,
				turn,
				quote: value.quote,
				at: Number.isFinite(at) ? at : 0,
				n: Number.isSafeInteger(ordinal) && ordinal >= 0 ? ordinal : 0,
				role: ROLE_CODES.has(value.role) ? value.role : ""
			};
			// Absent, not `false`, when it is not a draft: the stored table stays
			// the shape older builds wrote.
			if (value.draft === true) candidate.draft = true;
			if (value.chip === true) candidate.chip = true;
			if (value.spent === true) candidate.spent = true;
			return candidate;
		}

		/** Storage identity of a candidate: one row can carry two quoted sentences. */
		function sourceCandidateId(candidate) {
			return [candidate.sessionId, candidate.attr, candidate.key, candidate.turn, candidate.quote].join("\u0000");
		}

		/** The same identity for a ref (wire spelling) or a stored candidate. */
		function refTextKeyOf(value) {
			if (value === null || typeof value !== "object") return "";
			const sessionId = value.s ?? value.sessionId;
			const attr = value.a ?? value.attr;
			const key = value.k ?? value.key;
			const rawTurn = value.t ?? value.turn;
			const ordinal = Number(value.n);
			if (typeof sessionId !== "string" || sessionId === "") return "";
			if (!REF_ATTRS.has(attr)) return "";
			if (typeof key !== "string" || key === "") return "";
			const turn = rawTurn === undefined || rawTurn === null ? "" : String(rawTurn);
			return [sessionId, attr, key, turn, Number.isSafeInteger(ordinal) && ordinal >= 0 ? ordinal : 0].join("\u0000");
		}

		/** Keep the full wording behind a ref, bounded like the chip index. */
		function rememberQuoteText(value, text) {
			if (typeof text !== "string" || text === "") return;
			const key = refTextKeyOf(value);
			if (key === "") return;
			if (fullQuoteByRef.has(key)) fullQuoteByRef.delete(key);
			fullQuoteByRef.set(key, text);
			while (fullQuoteByRef.size > FULL_QUOTE_LIMIT) fullQuoteByRef.delete(fullQuoteByRef.keys().next().value);
		}

		/** The full wording kept for a ref, or "" when only the capped key is known. */
		function quoteTextFor(value) {
			return fullQuoteByRef.get(refTextKeyOf(value)) ?? "";
		}

		/**
		 * Whitespace-folded text plus a map from every folded character back to
		 * its index in the original. Quoted text comes from `selection.toString()`
		 * (newlines between blocks) while a row's text nodes concatenate without
		 * them, so the second pass needs this map to place a highlight.
		 */
		function foldWhitespace(text) {
			const source = String(text);
			let folded = "";
			const map = [];
			let spaced = false;
			for (let index = 0; index < source.length; index += 1) {
				const char = source[index];
				if (/\s/u.test(char)) {
					if (!spaced && folded !== "") {
						folded += " ";
						map.push(index);
						spaced = true;
					}
					continue;
				}
				folded += char;
				map.push(index);
				spaced = false;
			}
			if (folded.endsWith(" ")) {
				folded = folded.slice(0, -1);
				map.pop();
			}
			return { text: folded, map };
		}

		/**
		 * Every occurrence of a quote inside a row's text, exact first and
		 * whitespace-folded second. More than one occurrence is normal (the same
		 * sentence twice in a message); the ref's ordinal picks which one.
		 */
		function findQuoteSpans(haystack, needle) {
			const text = String(haystack);
			const target = String(needle);
			if (target === "") return [];
			const spans = [];
			let at = text.indexOf(target);
			while (at !== -1) {
				spans.push({ start: at, end: at + target.length });
				at = text.indexOf(target, at + 1);
			}
			if (spans.length > 0) return spans;
			const foldedText = foldWhitespace(text);
			const foldedTarget = foldWhitespace(target);
			if (foldedTarget.text === "") return [];
			let foldedAt = foldedText.text.indexOf(foldedTarget.text);
			while (foldedAt !== -1) {
				const start = foldedText.map[foldedAt];
				const after = foldedAt + foldedTarget.text.length;
				const end = after < foldedText.map.length ? foldedText.map[after] : text.length;
				spans.push({ start, end });
				foldedAt = foldedText.text.indexOf(foldedTarget.text, foldedAt + 1);
			}
			return spans;
		}

		/** The text node and offset a character index points at. */
		function textPointAt(nodes, offset) {
			let remaining = offset;
			for (const node of nodes) {
				const length = node.nodeValue === null ? 0 : node.nodeValue.length;
				if (remaining <= length) return { node, offset: remaining };
				remaining -= length;
			}
			const last = nodes[nodes.length - 1];
			return last === undefined ? null : { node: last, offset: last.nodeValue === null ? 0 : last.nodeValue.length };
		}

		/** Defensive read of the v2 table; anything unreadable is simply absent. */
		function readSourceTable() {
			const table = new Map();
			try {
				if (typeof localStorage === "undefined") return table;
				const raw = localStorage.getItem(SOURCE_KEY);
				if (typeof raw !== "string" || raw === "") return table;
				const parsed = JSON.parse(raw);
				if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return table;
				for (const [bin, list] of Object.entries(parsed)) {
					if (!Array.isArray(list)) continue;
					const candidates = [];
					for (const value of list) {
						const candidate = sourceCandidateOf(value);
						if (candidate !== null) candidates.push(candidate);
					}
					if (candidates.length > 0) table.set(bin, candidates);
				}
			} catch (error) {
				// A denied or malformed store only costs the jump-back coordinate.
			}
			return table;
		}

		/** Keep every bin and the whole table inside its bounds, oldest first. */
		function trimSources(table) {
			for (const [bin, list] of table) {
				if (list.length <= SOURCE_PER_KEY) continue;
				list.sort((left, right) => (Number(left.at) || 0) - (Number(right.at) || 0));
				table.set(bin, list.slice(list.length - SOURCE_PER_KEY));
			}
			if (table.size <= SOURCE_LIMIT) return;
			const order = Array.from(table.entries())
				.map(([bin, list]) => {
					let newest = 0;
					for (const candidate of list) newest = Math.max(newest, Number(candidate.at) || 0);
					return { bin, newest };
				})
				.sort((left, right) => left.newest - right.newest);
			let extra = table.size - SOURCE_LIMIT;
			for (const entry of order) {
				if (extra <= 0) break;
				table.delete(entry.bin);
				extra -= 1;
			}
		}

		/** Write a table as-is, trimming it first; a denied store changes nothing. */
		function writeSourceTable(table) {
			try {
				if (typeof localStorage === "undefined") return;
				trimSources(table);
				const plain = {};
				for (const [bin, list] of table) plain[bin] = list;
				localStorage.setItem(SOURCE_KEY, JSON.stringify(plain));
			} catch (error) {
				// A denied or full store only costs the jump-back coordinate.
			}
		}

		/**
		 * v2 coordinate table: `<sessionId>::<turn>` -> candidate array. The key is
		 * the SOURCE turn (the row the quote was selected in), so two different
		 * rows never collide and repeated wording from one row is a list, not an
		 * overwrite. Loaded once, migrated from v1 once, written on use.
		 */
		const sourceIndex = (() => {
			const table = readSourceTable();
			migrateSources(table);
			trimSources(table);
			return table;
		})();

		/**
		 * Import the v1 wording-keyed table into v2 as single-candidate arrays.
		 * v1 is read, never rewritten — an older build can still roll back — and a
		 * marker makes the import happen once. Idempotent if called again.
		 * @returns {number} how many v1 entries were newly imported.
		 */
		function migrateSources(into) {
			const table = into === undefined ? sourceIndex : into;
			let imported = 0;
			try {
				if (typeof localStorage === "undefined") return 0;
				if (localStorage.getItem(SOURCE_MIGRATED_KEY) === "1") return 0;
				const legacy = readThreadMap(SOURCE_KEY_V1);
				for (const [key, value] of Object.entries(legacy)) {
					if (value === null || typeof value !== "object" || Array.isArray(value)) continue;
					const candidate = sourceCandidateOf({
						sessionId: value.sessionId,
						attr: value.attr,
						key: value.key,
						turn: value.turn,
						quote: typeof value.quote === "string" ? value.quote : key,
						at: 0,
						n: 0
					});
					if (candidate === null) continue;
					const bin = sourceBinKey(candidate.sessionId, candidate.turn);
					const list = table.get(bin) ?? [];
					if (list.some((entry) => sourceCandidateId(entry) === sourceCandidateId(candidate))) continue;
					list.push(candidate);
					table.set(bin, list);
					imported += 1;
				}
				if (imported > 0) writeSourceTable(table);
				localStorage.setItem(SOURCE_MIGRATED_KEY, "1");
			} catch (error) {
				// A denied store just means the next window tries the import again.
			}
			return imported;
		}

		/**
		 * Write the table back, merging what another window stored meanwhile: a
		 * blind `setItem` let the last writer erase the other window's jumps. The
		 * merged result is mirrored into memory, so a later save cannot resurrect
		 * an entry this write had to evict.
		 */
		function persistSources() {
			const stored = readSourceTable();
			for (const [bin, list] of sourceIndex) {
				const merged = stored.get(bin) ?? [];
				for (const candidate of list) {
					const index = merged.findIndex((entry) => sourceCandidateId(entry) === sourceCandidateId(candidate));
					if (index === -1) merged.push(candidate);
					else if ((Number(candidate.at) || 0) >= (Number(merged[index].at) || 0)) merged[index] = candidate;
				}
				stored.set(bin, merged);
			}
			trimSources(stored);
			sourceIndex.clear();
			for (const [bin, list] of stored) sourceIndex.set(bin, list);
			writeSourceTable(sourceIndex);
		}

		/**
		 * Remember where a quote was selected from. Returns the stored candidate
		 * (its `n` is the ordinal inside the bin) so the caller can put the same
		 * coordinate into the sent text as a self-carrying ref.
		 *
		 * `options.draft` marks a coordinate minted for a quote that has not been
		 * sent anywhere yet — the side thread's chip. The row still resolves (the
		 * card and the jump need its ordinal) but it is not painted on the source
		 * until the quote turns up in a transcript; see `promoteSource`.
		 *
		 * `options.chip` marks a coordinate minted by a chip in a composer. Unlike
		 * a draft it may paint right away (the quote is in a visible draft), but it
		 * remembers that a chip is what holds it: `syncDraftBars` retracts the mark
		 * when that chip leaves the draft without sending (see `retractChipSource`).
		 */
		function saveSource(quote, sessionId, source, options) {
			const key = sourceKeyOf(quote);
			if (key.length < 4 || source === null || typeof source !== "object") return null;
			const draft = options !== null && typeof options === "object" && options.draft === true;
			const chip = options !== null && typeof options === "object" && options.chip === true;
			const owner = typeof source.sessionId === "string" && source.sessionId !== "" ? source.sessionId : sessionId;
			if (typeof owner !== "string" || owner === "") return null;
			const attr = source.attr;
			const rowKey = source.key;
			if (!REF_ATTRS.has(attr) || typeof rowKey !== "string" || rowKey === "") return null;
			const turn = source.turn === undefined || source.turn === null ? "" : String(source.turn);
			const role = ROLE_CODES.has(source.role) ? source.role : "";
			const bin = sourceBinKey(owner, turn);
			const list = sourceIndex.get(bin) ?? [];
			const at = Date.now();
			const same = { sessionId: owner, attr, key: rowKey, turn, quote: key };
			const origin = typeof source.origin === "string" ? source.origin : "";
			const index = list.findIndex((entry) => sourceCandidateId(entry) === sourceCandidateId(same));
			let candidate;
			if (index === -1) {
				let ordinal = 1;
				for (const entry of list) ordinal = Math.max(ordinal, (Number(entry.n) || 0) + 1);
				candidate = { sessionId: owner, attr, key: rowKey, turn, quote: key, at, n: ordinal, role, origin };
				if (draft) candidate.draft = true;
				if (chip) candidate.chip = true;
				list.push(candidate);
			} else {
				const kept = role === "" && ROLE_CODES.has(list[index].role) ? list[index].role : role;
				const keptOrigin = origin === "" ? String(list[index].origin ?? "") : origin;
				candidate = { sessionId: owner, attr, key: rowKey, turn, quote: key, at, n: list[index].n, role: kept, origin: keptOrigin };
				// A draft mark is only ever inherited, never applied over a
				// permanent one: quoting a passage into a side chat must not take
				// the highlight away from the same passage that was already sent.
				// The other direction is the promotion — a plain save (a send)
				// simply drops the mark.
				if (draft === true && list[index].draft === true) candidate.draft = true;
				// The chip mark survives every later save while it is set: a save
				// means the quote is still in some draft, and only a capsule
				// (`promoteSource`) proves the chip that minted it is gone.
				if (list[index].chip === true) candidate.chip = true;
				list[index] = candidate;
			}
			// Re-insert so the Map's own order agrees with "this was just used".
			sourceIndex.delete(bin);
			sourceIndex.set(bin, list);
			trimSources(sourceIndex);
			persistSources();
			return candidate;
		}

		/** A v1 entry for a wording key, read live so old drafts still jump. */
		function legacySource(key) {
			try {
				const stored = readThreadMap(SOURCE_KEY_V1)[key];
				if (stored === null || typeof stored !== "object" || Array.isArray(stored)) return null;
				return sourceCandidateOf({
					sessionId: stored.sessionId,
					attr: stored.attr,
					key: stored.key,
					turn: stored.turn,
					quote: key,
					at: 0,
					n: 0
				});
			} catch (error) {
				return null;
			}
		}

		/** The newest coordinate for a quote's wording; the legacy read path. */
		function sourceFor(quote) {
			const key = sourceKeyOf(quote);
			let best = null;
			for (const list of sourceIndex.values()) {
				for (const entry of list) {
					if (entry.quote !== key) continue;
					if (best === null || (Number(entry.at) || 0) > (Number(best.at) || 0)) best = entry;
				}
			}
			if (best === null) best = legacySource(key);
			if (best === null) return null;
			return { sessionId: best.sessionId, attr: best.attr, key: best.key, turn: best.turn, origin: String(best.origin ?? "") };
		}

		/** A stored coordinate as the `{ sessionId, attr, key, turn }` a jump follows. */
		function coordinateOf(value) {
			if (value === null || typeof value !== "object") return null;
			const attr = value.attr;
			const key = value.key;
			if (!REF_ATTRS.has(attr) || typeof key !== "string" || key === "") return null;
			if (typeof value.sessionId !== "string" || value.sessionId === "") return null;
			const turn = value.turn === undefined || value.turn === null ? "" : String(value.turn);
			return { sessionId: value.sessionId, attr, key, turn };
		}

		/**
		 * Every coordinate that could belong to a capsule, in resolution order:
		 * (a) the ref carried in the text, (b) the v2 bin it names (or, with no
		 * usable ref, every v2 candidate with the same wording — the current
		 * session's pane first), and (c) the legacy v1 entry for drafts and
		 * capsules sent before the table existed.
		 *
		 * @returns {{ sessionId: string, attr: string, key: string, turn: string }[]}
		 */
		function sourceCandidatesFor(quote, sessionId, ref) {
			const out = [];
			const seen = new Set();
			const push = (coordinate) => {
				if (coordinate === null) return;
				const id = [coordinate.sessionId, coordinate.attr, coordinate.key, coordinate.turn].join("\u0000");
				if (seen.has(id)) return;
				seen.add(id);
				out.push(coordinate);
			};
			const quoteKey = sourceKeyOf(quote);
			const wire = normalizeRef(ref);
			if (wire !== null) {
				// (a) the coordinate the sent text carries itself.
				push({ sessionId: wire.s, attr: wire.a, key: wire.k, turn: wire.t });
				// (b) the v2 bin the ref names. The ref's key may have gone stale,
				// so candidates with the same wording are ranked first and a
				// sibling saved for the same source turn can lend a fresh key.
				const bin = sourceIndex.get(sourceBinKey(wire.s, wire.t)) ?? [];
				const scoreOf = (entry) => (entry.quote === quoteKey ? 2 : 0) + (entry.key === wire.k ? 1 : 0);
				const ranked = bin.slice().sort((left, right) => scoreOf(right) - scoreOf(left) || (Number(right.at) || 0) - (Number(left.at) || 0));
				for (const entry of ranked) push(coordinateOf(entry));
			} else {
				// (b) after a reload, in another window, or with a corrupt ref:
				// every coordinate saved for this wording, current pane first and
				// newest first — the same "latest wins" reading the v1 table had.
				const all = [];
				for (const list of sourceIndex.values()) {
					for (const entry of list) {
						if (entry.quote === quoteKey) all.push(entry);
					}
				}
				all.sort((left, right) => {
					const mine = (entry) => (entry.sessionId === sessionId ? 1 : 0);
					return mine(right) - mine(left) || (Number(right.at) || 0) - (Number(left.at) || 0);
				});
				for (const entry of all) push(coordinateOf(entry));
			}
			// (c) drafts and capsules sent before this version.
			push(coordinateOf(legacySource(quoteKey)));
			return out;
		}

		/**
		 * Drop the given bookkeeping marks from every stored coordinate with this
		 * ref. The identity is the ref alone (`session\0attr\0row\0turn\0ordinal`):
		 * the ordinal already tells one quoted sentence in a row from another,
		 * while the wording can be spelled differently on the way back (a code
		 * quote loses its marks on save) and must not stop the write.
		 *
		 * @returns {boolean} true when something changed (the caller repaints).
		 */
		function dropSourceMarks(ref, names) {
			const wire = normalizeRef(ref);
			if (wire === null) return false;
			const id = refTextKeyOf(wire);
			if (id === "") return false;
			let dropped = false;
			for (const list of sourceIndex.values()) {
				for (const entry of list) {
					if (refTextKeyOf(entry) !== id) continue;
					for (const name of names) {
						if (entry[name] !== true) continue;
						delete entry[name];
						dropped = true;
					}
				}
			}
			if (dropped) persistSources();
			return dropped;
		}

		/**
		 * A coordinate saved for a draft becomes permanent the moment the quote
		 * shows up in a transcript: a capsule carrying the ref is proof the reader
		 * actually sent it. Until then `saveSource(..., { draft: true })` keeps it
		 * out of `paintAnchors`, so a side chat the reader backs out of leaves no
		 * mark on the source. A `chip` mark rides along (a chip in a draft is
		 * visible, so it paints) and is dropped here too: a capsule means the chip
		 * is gone and no retraction may hide the sent quote.
		 *
		 * @returns {boolean} true when a draft or a chip mark was promoted (the
		 * caller repaints).
		 */
		function promoteSource(ref, quote) {
			return dropSourceMarks(ref, ["draft", "chip"]);
		}

		/**
		 * Whether a capsule for this coordinate is already drawn in a transcript.
		 */
		function capsuleOnSourcePage(ref) {
			const wire = normalizeRef(ref);
			if (wire === null) return false;
			const key = capsuleJumpKey("", null, wire);
			return capsuleJumpKeys().has(key);
		}

		/** The jump keys of every capsule currently drawn in a transcript. */
		function capsuleJumpKeys() {
			const keys = new Set();
			if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") return keys;
			for (const element of document.querySelectorAll("[data-dshq-jump]")) {
				const key = typeof element.getAttribute === "function" ? element.getAttribute("data-dshq-jump") : null;
				if (typeof key === "string" && key !== "") keys.add(key);
			}
			return keys;
		}

		/**
		 * Whether this coordinate already rides in the text of a rendered
		 * transcript — the wire-only `│q1:<encoded>` tail of a sent message. A
		 * capsule appears a beat later (the message is enhanced after it renders),
		 * so a chip that disappears in that gap was sent, not taken back.
		 */
		function refInTranscript(ref) {
			const wire = normalizeRef(ref);
			if (wire === null) return false;
			const encoded = encodeQuoteRef(wire);
			if (encoded === "") return false;
			if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") return false;
			const needle = REF_PREFIX + encoded;
			for (const root of document.querySelectorAll(CONTENT_SELECTOR)) {
				const text = typeof root.textContent === "string" ? root.textContent : "";
				if (text.includes(needle)) return true;
			}
			return false;
		}

		/**
		 * Mark (or unmark) the coordinate a composer chip minted as retracted.
		 * `paintAnchors` skips a draft coordinate, so marking is what makes the
		 * source mark disappear when the reader takes the chip back out; the
		 * chip's own ordinal and card stay usable throughout. Only a coordinate
		 * minted with `saveSource(..., { chip: true })` is touched, so a passage
		 * that was sent earlier keeps its highlight even when the same passage
		 * is quoted into the draft and deleted again.
		 *
		 * @returns {boolean} true when the state changed (the caller repaints).
		 */
		function setChipRetracted(info, retracted) {
			if (info === null || info === undefined) return false;
			if (info.ref === null || info.ref === undefined) return false;
			const id = refTextKeyOf(info.ref);
			if (id === "") return false;
			let changed = false;
			for (const list of sourceIndex.values()) {
				for (const entry of list) {
					if (entry.chip !== true) continue;
					if (refTextKeyOf(entry) !== id) continue;
					if (retracted === true) {
						if (entry.draft === true) continue;
						entry.draft = true;
					} else {
						if (entry.draft !== true) continue;
						delete entry.draft;
					}
					changed = true;
				}
			}
			if (changed) {
				persistSources();
				scheduleAnchors();
			}
			return changed;
		}

		/**
		 * A chip that was in a live draft is gone, and no capsule carries its
		 * coordinate: the reader took the quote back out instead of sending it.
		 * The mark the chip minted has to go with it, or the source keeps a
		 * highlight (and ordinal) for a quote nothing holds any more. Marking the
		 * coordinate as a draft is exactly the state `paintAnchors` already skips,
		 * and it stays reversible: a later send promotes it again through
		 * `promoteSource`, and a chip that comes back (a slow host render, the
		 * reader re-adding the same quote) lifts the mark through
		 * `restoreChipSource`.
		 *
		 * @returns {boolean} true when a mark was retracted.
		 */
		function retractChipSource(info) {
			if (info === null || info === undefined || info.ref === null || info.ref === undefined) return false;
			// A capsule with this coordinate, or the sent message's own ref line
			// still waiting to be enhanced, means the quote did leave the draft.
			if (capsuleOnSourcePage(info.ref) || refInTranscript(info.ref)) return false;
			return setChipRetracted(info, true);
		}

		/** The chip is back in the draft (or never really left): paint again. */
		function restoreChipSource(info) {
			return setChipRetracted(info, false);
		}

		/**
		 * Identity of one capsule's coordinate; the lost state is scoped to it.
		 * JSON keeps the parts unambiguous and the value printable as an attribute.
		 */
		function capsuleJumpKey(quote, sessionId, ref) {
			const wire = normalizeRef(ref);
			if (wire !== null) return JSON.stringify(["ref", wire.s, wire.a, wire.k, wire.t, wire.n]);
			return JSON.stringify(["quote", sessionId === null || sessionId === undefined ? "" : String(sessionId), sourceKeyOf(quote)]);
		}

		/**
		 * jump identity -> every resolution step failed. Not storage: the anchor
		 * can come back when the virtualizer re-mounts the row, so a retry is
		 * allowed to clear it. The state lasts as long as the page does, which is
		 * enough to keep the pill from looking like a dead button.
		 */
		const lostJumps = new Set();
		/** The card currently on screen and the info it was filled with. */
		let popoverInfo = null;

		/** quote key -> { comment, at }: the quotes that were corrected later on. */
		const revisedIndex = (() => {
			const map = new Map();
			const stored = readThreadMap(REVISED_KEY);
			if (stored !== null) {
				for (const [key, value] of Object.entries(stored)) {
					if (value !== null && typeof value === "object") map.set(key, value);
				}
			}
			return map;
		})();

		function persistRevised() {
			try {
				if (typeof localStorage === "undefined") return;
				const plain = {};
				for (const [key, value] of revisedIndex) plain[key] = value;
				localStorage.setItem(REVISED_KEY, JSON.stringify(plain));
			} catch (error) {
				// A denied store only costs the badge.
			}
		}

		/**
		 * Remember that a quote was corrected. `comment` is what the correction
		 * says; an empty one forgets the entry (a revision that came out empty is
		 * not a revision). `revisedText` is the corrected wording when the revision
		 * also edited the quote itself — the old card shows it, the key stays the
		 * original's so the superseded capsule is the one that says 已修订.
		 *
		 * `identity` is the quote's ref when it has one: two copies of the same
		 * sentence in different messages are two quotes, and revising one must
		 * not mark the other. Without a ref the old wording key is kept, and
		 * lookups fall back to it so revisions saved before refs existed still
		 * show.
		 */
		function revisionKeyOf(quote, identity) {
			const textKey = sourceKeyOf(quote);
			const refKey = refTextKeyOf(identity);
			return refKey === "" ? textKey : refKey + "\u0000" + textKey;
		}

		function rememberRevision(quote, comment, revisedText, identity) {
			const textKey = sourceKeyOf(quote);
			if (textKey.length < 4) return false;
			const text = typeof comment === "string" ? comment.trim() : "";
			if (text === "") return false;
			const key = revisionKeyOf(quote, identity);
			if (revisedIndex.has(key)) revisedIndex.delete(key);
			const entry = { comment: text, at: Date.now() };
			if (typeof revisedText === "string" && revisedText.trim() !== "" && revisedText !== quote) {
				entry.quote = revisedText;
			}
			revisedIndex.set(key, entry);
			while (revisedIndex.size > REVISED_LIMIT) revisedIndex.delete(revisedIndex.keys().next().value);
			persistRevised();
			return true;
		}

		function revisedFor(quote, identity) {
			const textKey = sourceKeyOf(quote);
			const key = revisionKeyOf(quote, identity);
			const found = revisedIndex.get(key);
			if (found !== undefined) return found;
			// A pre-ref revision was stored under the wording alone.
			return key === textKey ? null : (revisedIndex.get(textKey) ?? null);
		}

		/* ------------------------------------------------------------------ *
		 * Quote review state — open / resolved, plus tags
		 *
		 * The transcript is append-only, so a quote's "handled" state cannot
		 * live on the message. It lives here, keyed by the same coordinate the
		 * ref carries (falling back to the wording for pre-ref quotes), and is
		 * local to this machine. The list page renders it; nothing here touches
		 * the model context.
		 * ------------------------------------------------------------------ */

		/** key -> { status, tags, at }; lazy so a page without the list pays nothing. */
		let quoteMetaIndex = null;
		const REVIEW_STATUSES = new Set(["open", "resolved"]);

		function readQuoteMetaStore() {
			try {
				if (typeof localStorage === "undefined") return new Map();
				const parsed = JSON.parse(localStorage.getItem(QUOTE_META_KEY));
				if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return new Map();
				const table = new Map();
				for (const key of Object.keys(parsed)) {
					const value = parsed[key];
					if (value === null || typeof value !== "object") continue;
					const status = REVIEW_STATUSES.has(value.status) ? value.status : "open";
					const tags = Array.isArray(value.tags)
						? value.tags.filter((tag) => typeof tag === "string" && tag !== "").slice(0, QUOTE_TAG_LIMIT)
						: [];
					table.set(key, { status, tags, at: Number.isFinite(Number(value.at)) ? Number(value.at) : 0 });
				}
				return table;
			} catch (error) {
				return new Map();
			}
		}

		function quoteMetaStore() {
			if (quoteMetaIndex === null) quoteMetaIndex = readQuoteMetaStore();
			return quoteMetaIndex;
		}

		/** A ref-keyed quote is scoped to its coordinate; a pre-ref quote by wording. */
		function quoteMetaKeyOf(row) {
			if (row === null || row === undefined) return "";
			const refKey = refTextKeyOf(row.ref);
			return refKey === "" ? "text:" + sourceKeyOf(row.quote) : "ref:" + refKey;
		}

		function normalizeQuoteTag(value) {
			return String(value === null || value === undefined ? "" : value)
				.trim()
				.replace(/^#+/u, "")
				.replace(/\s+/gu, "-")
				.replace(/^-+$/u, "")
				.trim()
				.slice(0, QUOTE_TAG_MAX);
		}

		/** The row's state, defaulting to open with no tags. */
		function quoteMetaFor(row) {
			const found = quoteMetaStore().get(quoteMetaKeyOf(row));
			return found === undefined ? { status: "open", tags: [], at: 0 } : { status: found.status, tags: found.tags.slice(), at: found.at };
		}

		function persistQuoteMeta() {
			try {
				if (typeof localStorage === "undefined") return;
				const plain = {};
				for (const [key, value] of quoteMetaStore()) plain[key] = value;
				localStorage.setItem(QUOTE_META_KEY, JSON.stringify(plain));
			} catch (error) {
				// A denied store only costs the review marks.
			}
		}

		function writeQuoteMeta(key, entry) {
			if (key === "") return false;
			const store = quoteMetaStore();
			// Re-insert so eviction is least-recently-used, not insertion order.
			store.delete(key);
			store.set(key, entry);
			while (store.size > QUOTE_META_LIMIT) store.delete(store.keys().next().value);
			persistQuoteMeta();
			return true;
		}

		function setQuoteStatus(row, status) {
			if (!REVIEW_STATUSES.has(status)) return false;
			const key = quoteMetaKeyOf(row);
			if (key === "") return false;
			const current = quoteMetaStore().get(key);
			if (current !== undefined && current.status === status) return true;
			const tags = current === undefined ? [] : current.tags;
			return writeQuoteMeta(key, { status, tags, at: Date.now() });
		}

		function markRowsResolved(rows) {
			const list = Array.isArray(rows) ? rows : [];
			let changed = 0;
			for (const row of list) {
				const key = quoteMetaKeyOf(row);
				if (key === "") continue;
				const current = quoteMetaStore().get(key);
				const tags = current === undefined ? [] : current.tags;
				if (current !== undefined && current.status === "resolved") continue;
				quoteMetaStore().set(key, { status: "resolved", tags, at: Date.now() });
				changed += 1;
			}
			if (changed > 0) {
				while (quoteMetaStore().size > QUOTE_META_LIMIT) quoteMetaStore().delete(quoteMetaStore().keys().next().value);
				persistQuoteMeta();
			}
			return changed;
		}

		function addQuoteTag(row, tag) {
			const clean = normalizeQuoteTag(tag);
			if (clean === "") return false;
			const key = quoteMetaKeyOf(row);
			if (key === "") return false;
			const current = quoteMetaStore().get(key);
			const tags = current === undefined ? [] : current.tags.slice();
			if (tags.includes(clean) || tags.length >= QUOTE_TAG_LIMIT) return false;
			tags.push(clean);
			return writeQuoteMeta(key, { status: current === undefined ? "open" : current.status, tags, at: Date.now() });
		}

		function removeQuoteTag(row, tag) {
			const key = quoteMetaKeyOf(row);
			if (key === "") return false;
			const current = quoteMetaStore().get(key);
			if (current === undefined) return false;
			const tags = current.tags.filter((entry) => entry !== tag);
			if (tags.length === current.tags.length) return false;
			return writeQuoteMeta(key, { status: current.status, tags, at: Date.now() });
		}

		/** Every tag in the given rows, most used first. */
		function allQuoteTags(rows) {
			const counts = new Map();
			for (const row of Array.isArray(rows) ? rows : []) {
				for (const tag of quoteMetaFor(row).tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
			}
			return Array.from(counts.entries())
				.sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
				.map(([tag, count]) => ({ tag, count }));
		}

		function quoteMetaSnapshot() {
			return new Map(quoteMetaStore());
		}

		/** The chat row a transcript node belongs to: anchor key first, node key next. */
		function chatRowOf(node) {
			for (const attr of ["data-chat-anchor-key", "data-chat-node-key"]) {
				const row = closestFrom(node, "[" + attr + "]");
				if (row === null) continue;
				const key = row.getAttribute(attr);
				if (typeof key !== "string" || key === "") continue;
				const turn = row.getAttribute("data-chat-turn");
				return { attr, key, turn: typeof turn === "string" ? turn : "", role: rowRoleOf(row) };
			}
			return null;
		}

		function escapeAttr(value) {
			if (typeof CSS !== "undefined" && CSS !== null && typeof CSS.escape === "function") return CSS.escape(String(value));
			return String(value).replace(/["\\]/gu, "\\$&");
		}

		/* ------------------------------------------------------------------ *
		 * Jump back to the source
		 * ------------------------------------------------------------------ */

		/**
		 * The transcript a session renders into — the pane, not the document.
		 * Two panes can be open at once, so a document-wide search is how a jump
		 * ends up in the wrong one.
		 */
		function transcriptRoot(sessionId) {
			if (typeof sessionId !== "string" || sessionId === "") return null;
			const roots = Array.from(document.querySelectorAll(CONTENT_SELECTOR));
			for (const root of roots) {
				if (root.getAttribute("data-conversation-session") === sessionId) return root;
			}
			return null;
		}

		/** The element a transcript actually scrolls in: `[data-conversation-scroll]`. */
		function scrollportOf(root) {
			if (root === null) return null;
			if (root.getAttribute("data-conversation-scroll") !== null) return root;
			return root.querySelector("[data-conversation-scroll]");
		}

		/** The virtualizer hides rows it keeps in the tree; a hidden row is no target. */
		function rowShown(row) {
			for (let node = row; node !== null && node !== undefined; node = node.parentElement) {
				if (typeof node.hasAttribute === "function" && node.hasAttribute("hidden")) return false;
			}
			return true;
		}

		/**
		 * The row a coordinate points at, inside one transcript: the anchor key
		 * first, then the turn. The key is the only handle DSH gives a plugin and
		 * the turn survives paging, so a row the virtualizer has dropped is still
		 * reachable — a nearby one, the host's own rule when a turn is missing.
		 */
		function rowFor(root, source) {
			const byKey = root.querySelector("[" + source.attr + '="' + escapeAttr(source.key) + '"]');
			if (byKey !== null && rowShown(byKey)) return byKey;
			const turn = Number(source.turn);
			if (source.turn === "" || source.turn === undefined || !Number.isFinite(turn)) return null;
			let best = null;
			let bestTurn = Number.POSITIVE_INFINITY;
			for (const row of Array.from(root.querySelectorAll("[data-chat-turn]"))) {
				if (!rowShown(row)) continue;
				const value = Number(row.getAttribute("data-chat-turn"));
				if (!Number.isFinite(value) || value < turn || value >= bestTurn) continue;
				best = row;
				bestTurn = value;
			}
			return best;
		}

		/** Park a row the way the host parks a jumped-to turn: 24px under the top. */
		function alignRow(row, port) {
			if (port === null || typeof port.scrollTop !== "number") return false;
			const box = port.getBoundingClientRect();
			const rect = row.getBoundingClientRect();
			const next = port.scrollTop + (rect.top - box.top) - JUMP_ALIGN;
			port.scrollTop = next < 0 ? 0 : next;
			return true;
		}

		function flashRow(row) {
			row.setAttribute(FLASH_ATTR, "true");
			setTimeout(() => row.removeAttribute(FLASH_ATTR), FLASH_MS);
		}

		/** One frame later: the view's own scheduler, a timer in the harness. */
		function later(run) {
			if (typeof requestAnimationFrame === "function") requestAnimationFrame(run);
			else setTimeout(run, 16);
		}

		/**
		 * Land on a row: park it under the reader's eye, hold it there for a few
		 * frames (the virtualizer rewrites the offset while it mounts neighbours,
		 * which is why a one-shot scroll can land short), then flash it.
		 */
		function landRow(row, port) {
			flashRow(row);
			if (port === null) {
				if (typeof row.scrollIntoView === "function") row.scrollIntoView({ block: "center" });
				return;
			}
			let frames = 0;
			const settle = () => {
				alignRow(row, port);
				frames += 1;
				if (frames >= JUMP_FRAMES || row.isConnected === false) return;
				later(settle);
			};
			settle();
		}

		/** One step of the search: most of a screen, so no row slips between two. */
		function pageOf(port) {
			const height = Number(port === null ? 0 : port.clientHeight);
			const share = Number.isFinite(height) && height > 0 ? height * JUMP_OVERLAP : 0;
			return Math.max(64, Math.round(share));
		}

		/**
		 * Walk the scrollport up a screen at a time until the row appears: the row
		 * of an old turn may not be mounted at all, and a single query cannot
		 * conjure it. Each step gives the virtualizer a frame to react.
		 */
		function walkForRow(root, port, source, done, step) {
			const found = rowFor(root, source);
			if (found !== null) {
				done(found);
				return;
			}
			const top = port === null || typeof port.scrollTop !== "number" ? 0 : port.scrollTop;
			if (port === null || step >= JUMP_STEPS || top <= 0) {
				done(null);
				return;
			}
			port.scrollTop = Math.max(0, top - pageOf(port));
			later(() => walkForRow(root, port, source, done, step + 1));
		}

		/**
		 * The whole transcript, not just the stretch above the reader. A quote
		 * comes from a message older than the one showing it, so the row is
		 * normally above — but a capsule in a side thread reads text from the
		 * main transcript, which may be parked anywhere. If the walk up reaches
		 * the top without the row, it starts over from the bottom, so the search
		 * covers the history either way instead of giving up on a reader who
		 * happened to be parked above the source.
		 */
		function searchSourceRow(root, port, source, done) {
			walkForRow(root, port, source, (found) => {
				if (found !== null) {
					done(found);
					return;
				}
				const height = port === null ? 0 : Number(port.scrollHeight);
				if (port === null || !Number.isFinite(height) || height <= 0 || port.scrollTop >= height) {
					done(null);
					return;
				}
				port.scrollTop = height;
				later(() => walkForRow(root, port, source, done, 0));
			}, 0);
		}

		/** Put the 原文已变 badge on a live capsule, without re-rendering its run. */
		function markCapsuleLost(node, sessionId) {
			if (node === null || typeof node.setAttribute !== "function") return;
			node.setAttribute("data-dshq-lost", "true");
			if (typeof node.querySelector !== "function" || node.querySelector(".dshq-cap-lost") !== null) return;
			node.append(el(node.ownerDocument, "span", { class: "dshq-cap-lost", text: translateFor(sessionId, "sourceLost") }));
		}

		/** A retry found the row again: take the badge off. */
		function clearCapsuleLost(node) {
			if (node === null || typeof node.removeAttribute !== "function") return;
			node.removeAttribute("data-dshq-lost");
			const badge = typeof node.querySelector === "function" ? node.querySelector(".dshq-cap-lost") : null;
			if (badge !== null && typeof badge.remove === "function") badge.remove();
		}

		/**
		 * Apply a jump outcome to whatever is on screen right now: every live
		 * capsule of that coordinate and the card, when it is showing this one.
		 * Re-rendered capsules read `lostJumps` themselves, so this is immediate
		 * feedback rather than the only copy of the state.
		 */
		function applyJumpState(key, lost) {
			if (typeof document !== "undefined" && typeof document.querySelectorAll === "function") {
				for (const node of document.querySelectorAll(".dshq-cap")) {
					if (typeof node.getAttribute !== "function" || node.getAttribute("data-dshq-jump") !== key) continue;
					if (lost) markCapsuleLost(node, node.getAttribute("data-dshq-session"));
					else clearCapsuleLost(node);
				}
			}
			if (popoverInfo === null || popover === null) return;
			if (capsuleJumpKey(popoverInfo.quote, popoverInfo.sessionId, popoverInfo.ref) !== key) return;
			const button = popover.querySelector(".dshq-pop-jump");
			if (button === null) return;
			button.textContent = translateFor(popoverInfo.sessionId, lost ? "sourceLost" : "jump");
			if (lost) button.setAttribute("data-lost", "true");
			else button.removeAttribute("data-lost");
		}

		/** The jump failed at every step: keep the state, keep the toast. */
		function markJumpLost(key) {
			lostJumps.delete(key);
			lostJumps.add(key);
			while (lostJumps.size > LOST_LIMIT) lostJumps.delete(lostJumps.values().next().value);
			applyJumpState(key, true);
		}

		/** The row came back on a retry. */
		function clearJumpLost(key) {
			if (!lostJumps.delete(key)) return;
			applyJumpState(key, false);
		}

		/**
		 * 跳回原文 — park the quoted message under the reader's eye and flash it.
		 * The coordinate is resolved in three steps: the ref carried in the sent
		 * text, then the v2 table (by `session::turn`, or by the quote's wording
		 * when the ref is absent or corrupt), then the legacy v1 entry. Each
		 * candidate's session transcript is searched — never the whole document —
		 * by anchor key, then by turn, then by walking the scrollport for a row
		 * the virtualizer has not mounted. When every step fails the reader gets
		 * a toast *and* a lasting 原文已变 mark, never a dead-looking button.
		 *
		 * @returns {boolean} whether a row was already in the DOM. A row still
		 *   being searched for reports its failure through the toast.
		 */
		function jumpToSource(quote, sessionId, ref) {
			const wire = normalizeRef(ref);
			const candidates = sourceCandidatesFor(quote, sessionId, wire);
			if (candidates.length === 0) return false;
			const key = capsuleJumpKey(quote, sessionId, wire);
			const id = sessionId === null || sessionId === undefined ? candidates[0].sessionId : sessionId;
			let firstRoot = -1;
			for (let index = 0; index < candidates.length; index += 1) {
				const source = candidates[index];
				const root = transcriptRoot(source.sessionId);
				if (root === null) continue;
				if (firstRoot === -1) firstRoot = index;
				const port = scrollportOf(root);
				const row = rowFor(root, source);
				if (row !== null) {
					landRow(row, port);
					clearJumpLost(key);
					return true;
				}
			}
			if (firstRoot === -1) {
				markJumpLost(key);
				toast(translateFor(id, "jumpFailed"));
				return false;
			}
			const attempt = (index) => {
				if (index >= candidates.length) {
					markJumpLost(key);
					toast(translateFor(id, "jumpFailed"));
					return;
				}
				const source = candidates[index];
				const root = transcriptRoot(source.sessionId);
				if (root === null) {
					attempt(index + 1);
					return;
				}
				const port = scrollportOf(root);
				searchSourceRow(root, port, source, (found) => {
					if (found !== null) {
						clearJumpLost(key);
						landRow(found, port);
					} else {
						attempt(index + 1);
					}
				});
			};
			attempt(firstRoot);
			return false;
		}

		function normalizeLabel(value) {
			return String(value === null || value === undefined ? "" : value)
				.replace(/\s+/gu, " ")
				.replace(/^ +| +$/gu, "");
		}

		/**
		 * The chip index, kept across reloads. The host restores the draft's chips
		 * (it persists the draft's references), but our in-memory map is gone after
		 * a reload — without this the aggregate bar would show a bare count and the
		 * chip would lose its card.
		 */
		function loadPersistedChips() {
			try {
				const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(PERSISTED_CHIP_KEY);
				if (typeof raw !== "string" || raw === "") return;
				const parsed = JSON.parse(raw);
				if (parsed === null || typeof parsed !== "object") return;
				for (const label of Object.keys(parsed)) {
					const entry = parsed[label];
					if (entry === null || typeof entry !== "object" || typeof entry.quote !== "string") continue;
					persistedChips.set(label, {
						quote: entry.quote,
						comment: typeof entry.comment === "string" ? entry.comment : "",
						sessionId: typeof entry.sessionId === "string" ? entry.sessionId : null,
						code: entry.code === true,
						path: typeof entry.path === "string" && entry.path !== "" ? entry.path : null,
						lang: typeof entry.lang === "string" ? entry.lang : "",
						origin: typeof entry.origin === "string" ? entry.origin : "chat",
						ref: entry.ref === undefined || entry.ref === null ? null : entry.ref
					});
				}
			} catch (error) {
				// A broken store is not a reason to fail the plugin.
			}
		}

		function savePersistedChips() {
			const plain = {};
			for (const [label, entry] of persistedChips) plain[label] = entry;
			try {
				if (typeof localStorage !== "undefined") localStorage.setItem(PERSISTED_CHIP_KEY, JSON.stringify(plain));
			} catch (error) {
				// A full or blocked storage must not break the composer.
			}
		}

		/** Remember one chip so a later page load still knows what it holds. */
		function persistChip(label, info) {
			if (label === "") return;
			persistedChips.delete(label);
			persistedChips.set(label, info);
			while (persistedChips.size > PERSISTED_CHIP_LIMIT) {
				const oldest = persistedChips.keys().next().value;
				if (oldest === undefined) break;
				persistedChips.delete(oldest);
			}
			savePersistedChips();
		}

		/** Forget one chip — it was removed from the draft. */
		function forgetChip(label) {
			if (label === "") return;
			if (persistedChips.delete(label)) savePersistedChips();
		}

		function chipInfoFor(element) {
			const text = normalizeLabel(element.textContent);
			if (text === "") return null;
			const exact = chipIndex.get(text);
			if (exact !== undefined) return exact;
			// Not minted in this page: the host may have restored the draft's chip
			// after a reload, and the persisted index still knows what it holds.
			const exactRemembered = persistedChips.get(text);
			if (exactRemembered !== undefined) return exactRemembered;
			// The chip may draw a leading mark of its own (`❝ `) next to the label.
			const bare = text.replace(/^[\u275d\u275e\u2022\u00b7]\s*/u, "");
			if (bare === text) return null;
			const info = chipIndex.get(bare);
			if (info !== undefined) return info;
			// Not minted in this page: the host may have restored the draft's chip
			// after a reload, and the persisted index still knows what it holds.
			const remembered = persistedChips.get(bare);
			return remembered === undefined ? null : remembered;
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
					const marked = candidate.getAttribute("data-dshq-chip") !== null;
					if (!marked && typeof candidate.closest === "function" && candidate.closest("[data-dshq-chip]") !== null) continue;
					const info = chipInfoFor(candidate);
					if (info === null) {
						// React recycles the chip node for the placeholder after a
						// send. The marker survived the recycle, so this node used to
						// be a chip; it is not one now. Keeping the marker made the
						// aggregate bar count an unresolvable "quote" forever
						// (`引用 ×1` over an empty composer, with no pill to remove).
						if (marked && typeof candidate.removeAttribute === "function") candidate.removeAttribute("data-dshq-chip");
						continue;
					}
					if (marked) continue;
					if (wiredChips.has(candidate)) {
						// Already wired before a recycle; restore the marker without
						// adding a second pair of listeners.
						candidate.setAttribute("data-dshq-chip", "1");
						continue;
					}
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
			fullQuoteByRef.clear();
			chipWiresPending = 0;
			chipWireBudget = 0;
			uninstallDraftBars();
		}

		/**
		 * 引用 ×N — the aggregate bar above a composer. A draft can carry
		 * several quotes and the chips themselves are clipped to 30 characters,
		 * so the bar is the one place that says how many there are and what each
		 * one says. It is plain DOM, not a slot: a sidebar side thread has its
		 * own composer and therefore its own bar.
		 */
		function scheduleDraftBars() {
			if (draftBarTimer !== null) return;
			draftBarTimer = setTimeout(() => {
				draftBarTimer = null;
				syncDraftBars();
			}, 32);
		}

		function ensureDraftBar(card) {
			const known = draftBars.get(card);
			if (known !== undefined && known.isConnected) return known;
			const bar = el(document, "div", { class: "dshq-draftbar", "data-dshq": "draftbar" });
			applyTheme(bar);
			const host = document.body === undefined || document.body === null ? document.documentElement : document.body;
			if (host !== null && host !== undefined) host.append(bar);
			draftBars.set(card, bar);
			return bar;
		}

		function removeDraftBar(card) {
			const bar = draftBars.get(card);
			draftBars.delete(card);
			if (bar !== undefined && bar.isConnected) bar.remove();
		}

		/** Put the caret on one chip, so a single Backspace takes it out. */
		function focusChip(chip) {
			try {
				if (typeof document.createRange !== "function" || typeof document.getSelection !== "function") return;
				const range = document.createRange();
				range.selectNodeContents(chip);
				const selection = document.getSelection();
				if (selection === null) return;
				selection.removeAllRanges();
				selection.addRange(range);
			} catch (error) {
				return;
			}
			const composer = composerEditor();
			if (composer !== null && typeof composer.focus === "function") composer.focus({ preventScroll: true });
		}

		/**
		 * The detect-coordinate span of one of our chips, read from the host's
		 * live composer state. A chip is one character in the detect text; its
		 * clipboard occurrence is `occurrence.length` characters long, so every
		 * earlier chip shifts the coordinates left by `length - 1`.
		 */
		function chipSpanOf(shell, label) {
			if (shell === null || shell === undefined || typeof shell.compose !== "function") return null;
			let state = null;
			try {
				state = shell.compose();
			} catch (error) {
				return null;
			}
			if (state === null || state === undefined || !Array.isArray(state.occurrences)) return null;
			const draft = typeof state.draft === "string" ? state.draft : "";
			const draftRev = state.draftRev;
			if (!Number.isFinite(Number(draftRev))) return null;
			let shift = 0;
			let found = null;
			for (const occurrence of state.occurrences) {
				if (occurrence === null || occurrence === undefined) continue;
				const length = Number(occurrence.length);
				const offset = Number(occurrence.offset);
				if (!Number.isFinite(length) || !Number.isFinite(offset)) continue;
				const start = offset - shift;
				shift += length - 1;
				if (occurrence.source !== SOURCE_NAME) continue;
				if (normalizeLabel(occurrence.label) !== label) continue;
				// Two chips with the same visible label are ambiguous by text alone;
				// let the caret path target the one the reader actually clicked.
				if (found !== null) return null;
				const end = start + 1 + (draft.charAt(offset + length) === " " ? 1 : 0);
				found = { start, end, draftRev };
			}
			return found;
		}

		/**
		 * Remove one draft chip exactly, through the shell's own token consumer:
		 * the span is CAS'd against the live draft revision, so a keystroke that
		 * lands first wins and the caller falls back instead of deleting the
		 * wrong text. Returns false when the host does not expose the consumer or
		 * the chip is not in its occurrence list.
		 */
		function consumeDraftChip(chip, sessionId) {
			const info = chipInfoFor(chip);
			const label = info === null ? normalizeLabel(chip.textContent) : normalizeLabel(chipLabel(info.quote, info.comment));
			const shell = inputShellFor(sessionId);
			const span = chipSpanOf(shell, label);
			if (span === null || typeof shell.consumeToken !== "function") return false;
			try {
				return shell.consumeToken({ kind: "span", span }) === true;
			} catch (error) {
				return false;
			}
		}

		/**
		 * Remove one draft chip: exactly when the host's occurrence list knows it,
		 * otherwise through the editor's own Backspace path (older hosts). If the
		 * host does not act on the synthetic event either, the chip stays and the
		 * user gets told to press Backspace once — never a silent half-deletion.
		 */
		function removeDraftChip(chip, sessionId) {
			if (consumeDraftChip(chip, sessionId)) {
				scheduleDraftBars();
				return;
			}
			focusChip(chip);
			const target = composerEditor() ?? chip;
			const init = { key: "Backspace", code: "Backspace", keyCode: 8, which: 8, bubbles: true, cancelable: true, composed: true };
			for (const type of ["keydown", "keyup"]) {
				try {
					if (typeof KeyboardEvent === "function" && typeof target.dispatchEvent === "function") {
						target.dispatchEvent(new KeyboardEvent(type, init));
					}
				} catch (error) {
					// The hint below still gives the user a way out.
				}
			}
			scheduleDraftBars();
			setTimeout(() => {
				if (chip.isConnected) {
					noteFailure("remove", "the synthetic Backspace did not remove the chip");
					toast(translateFor(sessionId, "draftRemoveHint"));
				}
			}, 120);
		}

		function positionDraftBars() {
			for (const [card, bar] of Array.from(draftBars.entries())) {
				if (!card.isConnected) {
					removeDraftBar(card);
					continue;
				}
				if (typeof card.getBoundingClientRect !== "function") continue;
				const rect = card.getBoundingClientRect();
				if (rect.width === 0 && rect.height === 0) {
					bar.style.display = "none";
					continue;
				}
				bar.style.display = "flex";
				const height = Number(bar.offsetHeight) > 0 ? Number(bar.offsetHeight) : 28;
				bar.style.left = Math.round(Math.max(EDGE, rect.left)) + "px";
				bar.style.top = Math.round(Math.max(EDGE, rect.top - height - 6)) + "px";
				bar.style.maxWidth = Math.round(Math.min(Math.max(rect.width, 180), 560)) + "px";
			}
		}

		function syncDraftBars() {
			if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") return;
			const seen = new Set();
			const open = new Set();
			const present = new Map();
			for (const card of document.querySelectorAll(CARD_SELECTOR)) {
				open.add(card);
				const chips = Array.from(card.querySelectorAll("*")).filter((node) => node.getAttribute("data-dshq-chip") !== null);
				const pairs = [];
				const held = new Map();
				for (const chip of chips) {
					const info = chipInfoFor(chip);
					if (info === null) {
						// Same recycle as in `wireChips`: the host reused the chip
						// node for the empty-composer placeholder after the send. The
						// marker alone must not count as a quote.
						if (typeof chip.removeAttribute === "function") chip.removeAttribute("data-dshq-chip");
						continue;
					}
					pairs.push({ chip, info });
					const key = info.ref === null || info.ref === undefined ? "" : refTextKeyOf(info.ref);
					if (key !== "") held.set(key, info);
				}
				present.set(card, held);
				if (pairs.length === 0) {
					removeDraftBar(card);
					continue;
				}
				seen.add(card);
				const bar = ensureDraftBar(card);
				const signature = pairs.length + "|" + pairs.map(({ info }) => (info.ref === null ? "" : encodeQuoteRef(info.ref)) + ":" + info.quote + ":" + info.comment).join("\u0001");
				if (bar.dataset.signature === signature) continue;
				bar.dataset.signature = signature;
				bar.textContent = "";
				const barSession = pairs.length > 0 ? pairs[0].info.sessionId : null;
				bar.setAttribute("role", "toolbar");
				bar.setAttribute("aria-label", translateFor(barSession, "draftbarLabel"));
				bar.append(el(document, "span", { class: "dshq-db-count", text: String(translateFor(barSession, "draftbarCount")).replace("{n}", String(pairs.length)) }));
				pairs.slice(0, DRAFTBAR_LIMIT).forEach(({ chip, info }, index) => {
					const label = String(index + 1) + " " + QUOTE_MARK + " " + firstLineOf(info.quote, 28);
					const full = String(info.quote) + (info.comment === "" ? "" : " · " + String(info.comment));
					const aria = translateFor(info.sessionId, "quoteLabel") + " " + String(index + 1) + " · " + full;
					const item = el(document, "span", { class: "dshq-db-item" });
					const pill = el(document, "button", { type: "button", class: "dshq-db-pill", text: label, "aria-label": aria, title: aria });
					pill.addEventListener("click", (event) => {
						event.preventDefault();
						if (jumpToSource(info.quote, info.sessionId, info.ref) !== true) focusChip(chip);
					});
					pill.addEventListener("mouseenter", () => showPopover(pill, info));
					pill.addEventListener("mouseleave", () => hidePopoverSoon());
					const edit = el(document, "button", {
						type: "button",
						class: "dshq-db-edit",
						text: "\u270e",
						"aria-label": translateFor(info.sessionId, "draftEdit"),
						title: translateFor(info.sessionId, "draftEdit")
					});
					edit.addEventListener("click", (event) => {
						event.preventDefault();
						event.stopPropagation();
						// The chip itself is not editable in place: the box comes
						// back with the old quote and comment, and the corrected
						// chip takes the old one's place.
						startDraftEdit(info, chip, pill);
					});
					const remove = el(document, "button", {
						type: "button",
						class: "dshq-db-remove",
						text: "\u00d7",
						"aria-label": translateFor(info.sessionId, "draftRemove"),
						title: translateFor(info.sessionId, "draftRemove")
					});
					remove.addEventListener("click", (event) => {
						event.preventDefault();
						event.stopPropagation();
						// The chip is on its way out; the persisted index must not keep
						// claiming that this draft still holds it.
						forgetChip(normalizeLabel(chipLabel(info.quote, info.comment)));
						removeDraftChip(chip, info.sessionId);
					});
					item.append(pill, edit, remove);
					bar.append(item);
				});
				if (pairs.length > DRAFTBAR_LIMIT) {
					bar.append(el(document, "span", { class: "dshq-db-more", text: "+" + String(pairs.length - DRAFTBAR_LIMIT) }));
				}
			}
			// Reconcile after every card was scanned, so a coordinate that two
			// composers hold (the main draft and a side thread's, same ref) is only
			// retracted when the last chip that carries it is gone. A chip that a
			// card held on the last pass and does not hold now was taken out of the
			// draft; the card itself is still on screen, so this is a removal and
			// not a session switch (a card that left the page is dropped below). A
			// key that appears again — a slow host render, the reader re-adding the
			// same quote — lifts the retraction it caused.
			const heldNow = new Set();
			for (const held of present.values()) {
				for (const key of held.keys()) heldNow.add(key);
			}
			const heldBefore = new Set();
			for (const was of cardChips.values()) {
				for (const key of was.keys()) heldBefore.add(key);
			}
			for (const held of present.values()) {
				for (const [key, info] of held) {
					if (heldBefore.has(key)) continue;
					restoreChipSource(info);
				}
			}
			for (const [card, was] of cardChips) {
				if (!open.has(card)) continue;
				for (const [key, info] of was) {
					if (heldNow.has(key)) continue;
					retractChipSource(info);
				}
			}
			for (const [card, held] of present) {
				if (held.size === 0) cardChips.delete(card);
				else cardChips.set(card, held);
			}
			// A composer card that left the page took its chips with it, but that
			// is not the reader removing them: forget the ledger without retracting.
			for (const card of Array.from(cardChips.keys())) {
				if (!open.has(card)) cardChips.delete(card);
			}
			for (const card of Array.from(draftBars.keys())) {
				if (!seen.has(card)) removeDraftBar(card);
			}
			positionDraftBars();
		}

		function uninstallDraftBars() {
			if (draftBarTimer !== null) {
				clearTimeout(draftBarTimer);
				draftBarTimer = null;
			}
			cardChips.clear();
			for (const card of Array.from(draftBars.keys())) removeDraftBar(card);
		}

		/**
		 * 原文侧高亮 — the quoted sentence keeps a yellow mark in the message it
		 * came from, with the ref's ordinal in a small badge. It is drawn as an
		 * overlay (`Range.getClientRects`) rather than by wrapping text nodes:
		 * the transcript is React's, and moving its nodes is how a plugin breaks
		 * the next render. Every failure — no Range, a virtualised row, a quote
		 * that no longer matches — is a silent miss, never a broken transcript.
		 */
		function ensureAnchorLayer() {
			if (anchorLayer !== null && anchorLayer.isConnected) return anchorLayer;
			const node = el(document, "div", { class: "dshq-anchor-layer", "data-dshq": "anchors" });
			// The observer skips records whose target sits inside `[data-dshq]`, so
			// the layer can live in <body> (where the theme variables are) without
			// waking itself on every repaint.
			const host = document.body ?? document.documentElement ?? null;
			if (host !== null && host !== undefined) host.append(node);
			anchorLayer = node;
			return node;
		}

		/** `${sessionId}\0${attr}\0${key}` -> the row, for every mounted transcript. */
		function rowIndexForAnchors() {
			const index = new Map();
			for (const root of document.querySelectorAll(CONTENT_SELECTOR)) {
				const session = root.getAttribute("data-conversation-session") ?? "";
				for (const attr of REF_ATTRS) {
					for (const row of root.querySelectorAll("[" + attr + "]")) {
						const key = row.getAttribute(attr);
						if (typeof key !== "string" || key === "") continue;
						index.set(session + "\u0000" + attr + "\u0000" + key, row);
						// Only a pane the host has not labelled gets the session-less
						// fallback; otherwise a same-keyed row in another session could
						// be marked as if it were this quote's source.
						if (session === "") index.set("\u0000" + attr + "\u0000" + key, row);
					}
				}
			}
			return index;
		}

		/**
		 * Elements a selection reads as a line break at: paragraphs, list items,
		 * table cells and rows, `<br>`. A selection across a table cell boundary
		 * gives `a\tb` and across two rows `a\nb`, while the row's text nodes
		 * concatenate as `ab` — which is exactly why a quoted table never found
		 * its source range, and why a quote spanning two paragraphs missed too.
		 * Inline elements (`a`, `code`, `strong`, `span`) are deliberately absent:
		 * a selection inside them keeps the words glued together.
		 */
		const BLOCK_TAGS = new Set([
			"address", "article", "aside", "blockquote", "caption", "dd", "div", "dl", "dt",
			"fieldset", "figcaption", "figure", "footer", "form", "h1", "h2", "h3", "h4",
			"h5", "h6", "header", "hr", "li", "main", "nav", "ol", "p", "pre", "section",
			"table", "tbody", "td", "tfoot", "th", "thead", "tr", "ul"
		]);
		/** Subtrees a quote never reads: controls, code chrome, and our own marks. */
		const SKIP_TAGS = new Set(["button", "input", "select", "textarea", "script", "style", "svg"]);

		/**
		 * The row's text the way a reader's selection reports it: one space at
		 * every block boundary, real characters elsewhere. `points[i]` is where
		 * character `i` lives in the DOM, or null for a boundary the DOM has no
		 * character for; the highlight maps a whitespace-folded match back
		 * through those points.
		 */
		function quoteTextMap(row) {
			const chars = [];
			const points = [];
			// A boundary never adds a second space and never starts the text with
			// one, so `foo` + `bar` inside inline spans stays the glued `foobar`.
			let spaced = true;
			const space = () => {
				if (spaced) return;
				chars.push(" ");
				points.push(null);
				spaced = true;
			};
			const takeText = (node) => {
				const value = typeof node.nodeValue === "string" ? node.nodeValue : "";
				for (let offset = 0; offset < value.length; offset += 1) {
					chars.push(value[offset]);
					points.push({ node, offset });
					spaced = /\s/u.test(value[offset]);
				}
			};
			const visit = (node) => {
				if (node === null || node === undefined) return;
				if (node.nodeType === 3) {
					takeText(node);
					return;
				}
				if (node.nodeType !== 1) return;
				const tag = String(node.tagName ?? "").toLowerCase();
				if (tag === "br") {
					space();
					return;
				}
				if (SKIP_TAGS.has(tag)) return;
				if (typeof node.getAttribute === "function" && node.getAttribute("aria-hidden") === "true") return;
				if (typeof node.closest === "function" && node.closest("[data-dshq]") !== null) return;
				const block = BLOCK_TAGS.has(tag);
				if (block) space();
				for (const child of node.childNodes ?? []) visit(child);
				if (block) space();
			};
			visit(row);
			return { text: chars.join(""), points };
		}

		/**
		 * A Range over the quote's nth occurrence in one row, or null. The match
		 * runs on `quoteTextMap` (block boundaries as spaces) and the Markdown
		 * marks `selectedText` may add are stripped as a second pass, so a quote
		 * from a table, a list, or an inline code span can still be painted.
		 */
		function rangeForQuote(row, quote, ordinal) {
			if (typeof document.createRange !== "function") return null;
			const map = quoteTextMap(row);
			if (map.text === "") return null;
			let spans = findQuoteSpans(map.text, quote);
			if (spans.length === 0) {
				const plain = plainOf(quote);
				if (plain !== quote) spans = findQuoteSpans(map.text, plain);
			}
			if (spans.length === 0) return null;
			const wanted = Math.min(Math.max((Number(ordinal) || 1) - 1, 0), spans.length - 1);
			const span = spans[wanted];
			// A boundary character has no DOM position: the range starts at the
			// first real character and ends after the last one.
			let start = null;
			for (let at = Math.max(span.start, 0); at < span.end && at < map.points.length; at += 1) {
				const point = map.points[at];
				if (point !== null && point !== undefined) {
					start = point;
					break;
				}
			}
			let end = null;
			for (let at = Math.min(span.end, map.points.length) - 1; at >= 0; at -= 1) {
				const point = map.points[at];
				if (point !== null && point !== undefined) {
					end = { node: point.node, offset: point.offset + 1 };
					break;
				}
			}
			if (start === null || end === null) return null;
			const range = document.createRange();
			range.setStart(start.node, start.offset);
			range.setEnd(end.node, end.offset);
			return range;
		}

		/**
		 * Whether the browser can paint a text range itself. Chromium's Custom
		 * Highlight API does, and a browser-painted range follows scrolling and
		 * reflow without a repaint. The overlay path has to chase both, and a
		 * fast scroll leaves its rectangles a frame behind — the bug the
		 * annotation plugins are chasing right now.
		 */
		function quoteHighlightSupported() {
			return (
				typeof CSS !== "undefined" &&
				CSS !== null &&
				CSS.highlights !== undefined &&
				CSS.highlights !== null &&
				typeof CSS.highlights.set === "function" &&
				typeof Highlight === "function"
			);
		}

		/** The registry we painted into, kept so a clear still works if `CSS` moves. */
		let quoteRegistry = null;

		/** Drop the browser-painted quote marks; a no-op without the API. */
		function clearQuoteHighlight() {
			const registry = quoteRegistry ?? (typeof CSS !== "undefined" && CSS !== null ? CSS.highlights : null);
			quoteRegistry = null;
			try {
				if (registry !== null && registry !== undefined && typeof registry.delete === "function") registry.delete(QUOTE_HIGHLIGHT);
			} catch (error) {
				// A registry that refuses a delete has nothing left to clear.
			}
		}

		/**
		 * A quote whose capsule sits in a finished turn has done its job: the
		 * source keeps its coordinate (jump/card/list still work) but its
		 * highlight and ordinal are retired. The turn tail carries
		 * `data-dshq-turn`; capsules carry the turn of the message that sent
		 * them, so the match is purely local and needs no session subscription.
		 * @returns {boolean} whether any candidate became spent.
		 */
		function clearSpentSources() {
			if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") return false;
			if (sourceIndex.size === 0) return false;
			const finished = new Set();
			for (const tail of document.querySelectorAll("[data-dshq-turn]")) {
				const value = typeof tail.getAttribute === "function" ? tail.getAttribute("data-dshq-turn") : null;
				if (value === null || value === "") continue;
				const root = typeof tail.closest === "function" ? tail.closest("[data-conversation-session]") : null;
				const sessionId = root === null ? "" : String(root.getAttribute("data-conversation-session") ?? "");
				finished.add(sessionId + "\u0000" + String(value));
			}
			if (finished.size === 0) return false;
			const keys = new Set();
			for (const capsule of document.querySelectorAll("[data-dshq-jump]")) {
				const row = typeof capsule.closest === "function" ? capsule.closest("[data-chat-turn]") : null;
				const turn = row === null ? null : row.getAttribute("data-chat-turn");
				const root = typeof capsule.closest === "function" ? capsule.closest("[data-conversation-session]") : null;
				const sessionId = root === null ? "" : String(root.getAttribute("data-conversation-session") ?? "");
				if (turn === null || !finished.has(sessionId + "\u0000" + String(turn))) continue;
				const key = typeof capsule.getAttribute === "function" ? capsule.getAttribute("data-dshq-jump") : null;
				if (typeof key === "string" && key !== "") keys.add(key);
			}
			if (keys.size === 0) return false;
			let changed = false;
			for (const list of sourceIndex.values()) {
				for (const candidate of list) {
					if (candidate.spent === true) continue;
					if (!keys.has(capsuleJumpKey(candidate.quote, candidate.sessionId, candidate))) continue;
					candidate.spent = true;
					changed = true;
				}
			}
			if (changed) persistSources();
			return changed;
		}

		function paintAnchors() {
			if (typeof document === "undefined" || typeof document.createRange !== "function") return;
			// A finished turn's tail is our completion signal: the quote was sent
			// and its reply is done, so the source mark has served its purpose.
			// The candidate is kept (jump/card/list still use it) but no longer
			// painted. `keepHighlight` restores the old always-on behaviour.
			if (config().keepHighlight !== true) clearSpentSources();
			const highlight = config().highlight !== false;
			if ((sourceIndex.size === 0 || highlight === false) && openedRange === null) {
				clearQuoteHighlight();
				if (anchorLayer !== null) {
					anchorLayer.textContent = "";
					anchorLayer.style.display = "none";
				}
				return;
			}
			const layer = ensureAnchorLayer();
			if (layer === null) return;
			// The sentence itself is painted by the browser when it can be; the
			// overlay is then only the ordinal badge (and the file line marks,
			// which are row-level rectangles, not text ranges).
			const native = highlight === true && quoteHighlightSupported();
			const ranges = [];
			const viewportHeight = typeof window === "undefined" || !Number.isFinite(Number(window.innerHeight)) ? 800 : Number(window.innerHeight);
			const index = rowIndexForAnchors();
			const marks = [];
			let painted = 0;
			/** Capsule keys, read at most once per pass (only drafts need them). */
			let capsuleKeys = null;
			/** Drafts whose capsule proves they were sent; promoted after the loop. */
			const latePromotions = [];
			for (const list of sourceIndex.values()) {
				for (const candidate of list) {
					if (painted >= ANCHOR_LIMIT) break;
					// The quote was sent and its turn finished: keep the coordinate,
					// retire the visual mark and ordinal.
					if (candidate.spent === true) continue;
					// A coordinate minted for a draft (the side thread's chip) is not
					// on the page yet: painting it now would leave the reader with a
					// mark for a quote that was never sent. A capsule carrying the
					// coordinate is proof it was sent; the promotion can have been
					// missed (a retraction running after it), so a draft with its
					// capsule on the page is painted here and promoted after the pass
					// (persisting mid-iteration would rebuild the table under us).
					if (candidate.draft === true) {
						if (capsuleKeys === null) capsuleKeys = capsuleJumpKeys();
						if (!capsuleKeys.has(capsuleJumpKey(candidate.quote, candidate.sessionId, candidate))) continue;
						latePromotions.push(candidate);
					}
					const row = index.get(candidate.sessionId + "\u0000" + candidate.attr + "\u0000" + candidate.key) ?? index.get("\u0000" + candidate.attr + "\u0000" + candidate.key);
					if (row === undefined || row === null || !row.isConnected || !rowShown(row)) continue;
					const rowRect = typeof row.getBoundingClientRect === "function" ? row.getBoundingClientRect() : null;
					if (rowRect === null || (rowRect.bottom < 0 || rowRect.top > viewportHeight)) continue;
					// Clip to the transcript's own scrollport: a row can sit behind
					// the composer, and a highlight painted there would float on top
					// of the draft.
					const root = typeof row.closest === "function" ? row.closest(CONTENT_SELECTOR) : null;
					const port = root === null ? null : scrollportOf(root);
					const clip = port !== null && typeof port.getBoundingClientRect === "function" ? port.getBoundingClientRect() : null;
					const quote = fullQuoteByRef.get(refTextKeyOf(candidate)) ?? candidate.quote;
					const range = rangeForQuote(row, quote, candidate.n);
					if (range === null || typeof range.getClientRects !== "function") continue;
					const rects = range.getClientRects();
					if (rects === null || rects.length === 0) continue;
					let first = null;
					let lines = 0;
					for (let at = 0; at < rects.length && lines < 12; at += 1) {
						const rect = rects[at] ?? (typeof rects.item === "function" ? rects.item(at) : null);
						if (rect === null || rect === undefined || rect.width <= 0 || rect.height <= 0) continue;
						if (rect.bottom < 0 || rect.top > viewportHeight) continue;
						if (clip !== null && (rect.bottom <= clip.top || rect.top >= clip.bottom)) continue;
						if (first === null) first = rect;
						if (native === false) {
							const box = el(document, "div", { class: "dshq-anchor-rect" });
							box.style.left = Math.round(rect.left) + "px";
							box.style.top = Math.round(rect.top) + "px";
							box.style.width = Math.round(rect.width) + "px";
							box.style.height = Math.round(rect.height) + "px";
							marks.push(box);
						}
						lines += 1;
					}
					if (first === null) continue;
					if (native) ranges.push(range);
					const badge = el(document, "div", { class: "dshq-anchor-badge", text: String(Number(candidate.n) || 1) });
					badge.style.left = Math.round(Math.max(EDGE, first.left - 18)) + "px";
					badge.style.top = Math.round(Math.max(clip === null ? EDGE : Math.max(clip.top, 0) + 2, first.top + (first.height - 16) / 2)) + "px";
					marks.push(badge);
					painted += 1;
				}
				if (painted >= ANCHOR_LIMIT) break;
			}
			// A draft promoted by its own capsule is persisted once the pass is over.
			for (const candidate of latePromotions) promoteSource(candidate, candidate.quote);
			if (native && ranges.length > 0) {
				try {
					quoteRegistry = CSS.highlights;
					CSS.highlights.set(QUOTE_HIGHLIGHT, new Highlight(...ranges));
				} catch (error) {
					// A refused set is the same as an unsupported browser: the marks
					// simply do not appear, and the capsules still carry the quote.
					clearQuoteHighlight();
				}
			} else {
				clearQuoteHighlight();
			}
			layer.textContent = "";
			for (const mark of marks) layer.append(mark);
			if (highlight === true) {
				for (const mark of openedRangeMarks(viewportHeight)) layer.append(mark);
			}
			layer.style.display = layer.childNodes.length > 0 ? "block" : "none";
		}

		/**
		 * The marks for the line range of the file the reader just opened. The
		 * preview numbers its rows with `data-textpreview-line`; every row in
		 * the range is marked, so the reader sees which lines were quoted.
		 */
		function openedRangeMarks(viewportHeight) {
			if (openedRange === null || typeof document.querySelectorAll !== "function") return [];
			const from = Number(openedRange.line);
			const to = Number(openedRange.end);
			if (!Number.isSafeInteger(from) || from < 1) return [];
			const last = Number.isSafeInteger(to) && to >= from ? to : from;
			const marks = [];
			for (const row of document.querySelectorAll("[data-textpreview-line]")) {
				const value = Number(row.getAttribute("data-textpreview-line"));
				if (!Number.isSafeInteger(value) || value < from || value > last) continue;
				const rect = typeof row.getBoundingClientRect === "function" ? row.getBoundingClientRect() : null;
				if (rect === null || rect.width <= 0 || rect.height <= 0) continue;
				if (rect.bottom < 0 || rect.top > viewportHeight) continue;
				const box = el(document, "div", { class: "dshq-anchor-rect", "data-kind": "file" });
				box.style.left = Math.round(rect.left) + "px";
				box.style.top = Math.round(rect.top) + "px";
				box.style.width = Math.round(rect.width) + "px";
				box.style.height = Math.round(rect.height) + "px";
				marks.push(box);
			}
			return marks;
		}

		/** Remember (or forget) the line range of the file that was opened. */
		function setOpenedRange(range) {
			openedRange = range === null || range === undefined ? null : range;
			scheduleAnchors();
			return openedRange;
		}

		function scheduleAnchors() {
			if (anchorTimer !== null) return;
			// With a browser-painted highlight only the small ordinal badges are
			// rebuilt, so the repaint can follow a scroll sooner; the overlay path
			// rebuilds every rectangle and keeps its old, cheaper cadence.
			const delay = quoteHighlightSupported() && config().highlight !== false ? 32 : 64;
			anchorTimer = setTimeout(() => {
				anchorTimer = null;
				paintAnchors();
			}, delay);
		}

		function uninstallAnchors() {
			if (anchorTimer !== null) {
				clearTimeout(anchorTimer);
				anchorTimer = null;
			}
			clearQuoteHighlight();
			if (anchorLayer !== null && anchorLayer.isConnected) anchorLayer.remove();
			anchorLayer = null;
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
			// The segments ride along in the ledger: the reply badges need the
			// numbered quotes of the nearest preceding capsule-carrying message.
			capsules.set(run, { text, nodes, segments });
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
			try {
				for (const record of records) {
					const target = elementOf(record.target);
					// Our own UI (popover, quote bar, anchor layer) mutates constantly;
					// letting those records through would make a repaint wake the
					// observer that scheduled it.
					if (target !== null && typeof target.closest === "function" && target.closest("[data-dshq]") !== null) continue;
					if (record.type === "characterData") {
						collectRuns(record.target, capsuleDirty);
						collectRefRuns(record.target, refDirty);
						continue;
					}
					for (const node of record.addedNodes) {
						collectRuns(node, capsuleDirty);
						collectRefRuns(node, refDirty);
					}
					for (const node of record.removedNodes) {
						if (node.nodeType === 1 && capsules.has(node)) capsuleDirty.add(node);
					}
					if (target !== null && capsules.has(target)) capsuleDirty.add(target);
				}
			} catch (error) {
				console.warn("[ui-quote] capsule scan failed:", error);
			}
			// Always reschedule: a throw inside the scan used to leave the pass
			// unscheduled and the transcript raw until the next reload.
			scheduleCapsules();
		}

		function scheduleCapsules() {
			if (capsuleTimer !== null) return;
			capsuleTimer = setTimeout(flushCapsules, 32);
		}

		function flushCapsules() {
			capsuleTimer = null;
			const runs = Array.from(capsuleDirty);
			capsuleDirty.clear();
			// A throw anywhere in this pass used to abort it silently: the rest of
			// the transcript stayed raw (`> ❝ …` text, no pills, no hover cards)
			// with no error the reader could see. Each stage stands on its own now.
			try {
				dropDetachedPopover();
				for (const run of Array.from(capsules.keys())) {
					if (!run.isConnected) dropCapsule(run);
				}
			} catch (error) {
				console.warn("[ui-quote] capsule cleanup failed:", error);
			}
			for (const run of runs) {
				try {
					if (run.isConnected) enhance(run);
					else if (capsules.has(run)) dropCapsule(run);
				} catch (error) {
					console.warn("[ui-quote] capsule enhance failed:", error);
				}
			}
			try {
				// Badges come last: the quotes they link to must be in the ledger first.
				flushRefBadges();
				wireChips();
				scheduleDraftBars();
				scheduleAnchors();
			} catch (error) {
				console.warn("[ui-quote] capsule tail pass failed:", error);
			}
		}

		function ensureCapsuleStyle(doc) {
			if (doc.getElementById(CAPSULE_STYLE_ID) !== null) return;
			const parent = doc.head === undefined || doc.head === null ? doc.documentElement : doc.head;
			if (parent === null || parent === undefined) return;
			const style = el(doc, "style", { id: CAPSULE_STYLE_ID, "data-plugin": "dsh-client-ui-quote" });
			style.textContent = CAPSULE_STYLE_TEXT;
			parent.append(style);
		}

		/**
		 * Look at every mounted transcript again for quote and reply runs. A
		 * message rendered while the plugin was reloading — or before its
		 * observer was armed — can miss the mutation pass and stay as the raw
		 * `> ❝ … │q1:` text; this scan re-enhances it without a page refresh.
		 * Called on install, and again when the window becomes visible or gets
		 * focus, which is exactly when a reader comes back to a stale transcript.
		 *
		 * @returns {number} how many transcript roots were scanned.
		 */
		function rescanCapsules() {
			if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") return 0;
			// One-shot scans outlive their page only if the runtime was torn down;
			// an uninstalled plugin must never build capsules.
			if (capsuleObserver === null) return 0;
			let seen = 0;
			for (const host of document.querySelectorAll(CONTENT_SELECTOR)) {
				collectRuns(host, capsuleDirty);
				collectRefRuns(host, refDirty);
				seen += 1;
			}
			if (seen > 0) scheduleCapsules();
			return seen;
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
			rescanCapsules();
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
			uninstallRefBadges();
			cancelPopoverHide();
			unhookChips();
			uninstallAnchors();
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
		 * Reply badges — the model's per-quote answers, linked back
		 * ------------------------------------------------------------------ */

		/**
		 * The other half of 逐条回应: when the instruction rode along with the
		 * quotes, the model labels its answers `「引用1」…「引用N」`, and each
		 * label becomes a badge — hover it and the quote's card opens (jump and
		 * revise included, exactly as on a capsule), because the reply is only
		 * useful while it stays tied to the passage it answers.
		 *
		 * The label lives inside a markdown-rendered assistant run, so this pass
		 * splits the text node it sits in — one step more invasive than the
		 * capsule overlay, which only hides and re-reads whole runs. The rules
		 * that keep it safe: a text node is split only once (the ledger holds the
		 * original), a rewrite by React is detected by the value no longer being
		 * our head chunk (our nodes go, the node is re-read fresh), and uninstall
		 * puts the original text back. A label whose number outruns the quotes of
		 * the nearest preceding quoted message is left as plain text — the model
		 * may miscount, and a dead badge would be worse than no badge.
		 */

		/** text node -> { text, head, nodes } for every split reply run. */
		const refBadges = new Map();
		const refDirty = new Set();
		const REF_LABEL = /\u300c\s*(?:\u5f15\u7528|Quote)\s*\d+\s*\u300d/u;
		/** The same shape, captured, for splitting a reply into text and labels. */
		const REF_LABEL_CAPTURE = /(\u300c\s*(?:\u5f15\u7528|Quote)\s*\d+\s*\u300d)/u;
		/** The number a label carries \u2014 \u300c\u5f15\u75283\u300d and \u300cQuote 3\u300d both read as 3. */
		const REF_LABEL_NUMBER = /^\u300c\s*(?:\u5f15\u7528|Quote)\s*(\d+)\s*\u300d$/u;

		function isRefCandidate(node) {
			if (node === null || node.nodeType !== 3) return false;
			const value = typeof node.nodeValue === "string" ? node.nodeValue : "";
			if (REF_LABEL.test(value) !== true) return false;
			const parent = node.parentElement;
			if (parent === null || typeof parent.closest !== "function") return false;
			if (parent.closest("[data-dshq]") !== null) return false;
			return parent.closest(CONTENT_SELECTOR) !== null;
		}

		/** Gather candidate text nodes out of a mutation's added subtree. */
		function collectRefRuns(node, into) {
			if (node.nodeType === 3) {
				if (isRefCandidate(node) === true) into.add(node);
				return;
			}
			const element = elementOf(node);
			if (element === null) return;
			const stack = [element];
			while (stack.length > 0) {
				const current = stack.pop();
				for (const child of current.childNodes) {
					if (child.nodeType === 3) {
						if (isRefCandidate(child) === true) into.add(child);
					} else if (child.nodeType === 1 && child.childNodes.length > 0) {
						stack.push(child);
					}
				}
			}
		}

		/**
		 * The quotes of the nearest preceding capsule-carrying run, in message
		 * order. One walk over the session host settles both "nearest" and
		 * "before" — the run that was last seen when the walk reached the badge's
		 * text node is the one that precedes it.
		 */
		function precedingQuoteSegments(node, host) {
			let best = null;
			let seen = false;
			const walk = (current) => {
				if (seen === true) return;
				if (current === node) {
					seen = true;
					return;
				}
				if (capsules.has(current)) best = current;
				for (const child of current.childNodes) walk(child);
			};
			walk(host);
			if (best === null) return [];
			const known = capsules.get(best);
			const segments = known === undefined || known === null ? null : known.segments;
			if (!Array.isArray(segments)) return [];
			return segments.filter((segment) => segment !== null && segment !== undefined && segment.type === "quote");
		}

		function removeRefNodes(known) {
			if (known === undefined || known === null) return;
			for (const node of known.nodes) {
				if (node !== null && node !== undefined && node.isConnected) node.remove();
			}
		}

		function refBadgeFor(doc, sessionId, label, segment) {
			const info = {
				quote: segment.quote,
				comment: typeof segment.comment === "string" ? segment.comment : "",
				sessionId,
				code: segment.code !== null && segment.code !== undefined,
				// The fence's info string is the file this quote came from, so the
				// badge's card can open it just like the capsule's card does.
				path: typeof segment.code === "string" && segment.code !== "" ? segment.code : null,
				ref: segment.ref === undefined ? null : segment.ref
			};
			const badge = el(doc, "span", { class: "dshq-ref", "data-dshq": "ref", text: label });
			badge.addEventListener("mouseenter", () => showPopover(badge, info));
			badge.addEventListener("mouseleave", hidePopoverSoon);
			badge.addEventListener("click", (event) => {
				// A drag-select over the badge must not fire a jump.
				const selection = doc.getSelection === undefined ? null : doc.getSelection();
				if (selection !== null && selection.isCollapsed === false) return;
				jumpToSource(segment.quote, sessionId);
			});
			return badge;
		}

		/** Split one text node into plain text and badges, once. */
		function enhanceRefNode(node) {
			if (refBadges.has(node)) return;
			if (isRefCandidate(node) !== true) return;
			const value = node.nodeValue;
			const parts = value.split(REF_LABEL_CAPTURE);
			if (parts.length < 3) return;
			const parent = node.parentNode;
			const doc = node.ownerDocument === null || node.ownerDocument === undefined ? (parent === null ? null : parent.ownerDocument) : node.ownerDocument;
			if (parent === null || doc === null || doc === undefined) return;
			const host = parent.closest !== undefined ? parent.closest(CONTENT_SELECTOR) : null;
			if (host === null) return;
			const sessionId = (() => {
				const id = host.getAttribute("data-conversation-session");
				return typeof id === "string" ? id : null;
			})();
			const quotes = precedingQuoteSegments(node, host);
			if (quotes.length === 0) return;

			const nodes = [];
			// The original node keeps the first chunk; everything else is inserted
			// after it, in order, so React's node stays where reconciliation left it.
			node.nodeValue = parts[0];
			let previous = node;
			for (let index = 1; index < parts.length; index += 1) {
				const part = parts[index];
				let created = null;
				if (index % 2 === 1) {
					const label = REF_LABEL_NUMBER.exec(part);
					const number = label === null ? Number.NaN : Number(label[1]);
					const segment = number >= 1 && number <= quotes.length ? quotes[number - 1] : null;
					created = segment === null ? doc.createTextNode(part) : refBadgeFor(doc, sessionId, part, segment);
				} else {
					created = doc.createTextNode(part);
				}
				if (created === null) continue;
				parent.insertBefore(created, previous.nextSibling);
				previous = created;
				nodes.push(created);
			}
			refBadges.set(node, { text: value, head: parts[0], nodes });
		}

		/** Reconcile the ledger, then split whatever is still pending. */
		function flushRefBadges() {
			for (const [node, known] of Array.from(refBadges)) {
				if (node.isConnected === false) {
					removeRefNodes(known);
					refBadges.delete(node);
					continue;
				}
				// React rewrote the text: our chunks duplicate the tail now. Drop
				// everything we added and re-read the node's fresh value.
				if (node.nodeValue !== known.head) {
					removeRefNodes(known);
					refBadges.delete(node);
					refDirty.add(node);
				}
			}
			if (refDirty.size === 0) return;
			const candidates = Array.from(refDirty);
			refDirty.clear();
			for (const node of candidates) {
				if (node.isConnected === true) enhanceRefNode(node);
			}
		}

		function uninstallRefBadges() {
			for (const [node, known] of Array.from(refBadges)) {
				removeRefNodes(known);
				// Restoring is only honest while React never touched the value
				// after the split; otherwise the fresh value is the truth.
				if (node.isConnected && node.nodeValue === known.head) {
					try {
						node.nodeValue = known.text;
					} catch (error) {
						// A read-only node only costs its original wording.
					}
				}
			}
			refBadges.clear();
			refDirty.clear();
		}

		/* ------------------------------------------------------------------ *
		 * Bar element
		 * ------------------------------------------------------------------ */

		const sessions = new Map();
		/**
		 * The bar's listeners are document singletons and live exactly as long as
		 * the plugin. While they were reference-counted by the overlay slot they
		 * could be removed for good by an overlapping mount pair, and then the bar
		 * never appeared again until a page reload — the "quote plugin stopped
		 * working" report.
		 */
		let listenersAttached = false;
		/**
		 * How many `apply()` mounts share the document-level install (listeners,
		 * capsule observer, stylesheet). The host mounts this plugin several
		 * times per page and tears each mount down on its own; with one install
		 * per mount, the first teardown removed the stylesheet and detached the
		 * selection listeners under the mounts that were still alive. The bar
		 * then rendered unstyled and the next selection opened nothing.
		 */
		let runtimeHolders = 0;
		/** The capsule install's disposer, owned by that shared runtime. */
		let capsuleDisposer = null;
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
			/** True when the selection came from the preview or the terminal:
			 *  the quote travels as a fenced code block, not a plain quote. */
			code: false,
			/** The file a preview selection came from, when the host exposes it. */
			path: null,
			/** Where the selection came from: preview, terminal, diff or chat. */
			origin: "chat",
			/** The language a chat code block announces, when the selection is one. */
			lang: "",
			/** 逐条回应: the current quote asks the model to answer per quote. */
			reply: false,
			/** Where the current selection was picked up, for the jump-back row. */
			source: null,
			/** The quote key being corrected, when the box was opened by 改这条引用. */
			revising: null,
			/** The draft chip being edited, when the box was opened by 编辑这条引用. */
			editing: null,
			settle: null,
			pointerOnTranscript: false,
			/** True while the bar holds a transcript selection alive on purpose. */
			keptSelection: false,
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
			// The default is gone, so the browser will not collapse the selection
			// by itself. `close()` hands it back when the bar goes away unarmed.
			state.keptSelection = true;
		}

		function onBarClick(event) {
			const target = event.target instanceof Element ? event.target.closest("[data-action]") : null;
			if (target === null) return;
			const action = target.getAttribute("data-action");
			if (action === "comment") openComment();
			else if (action === "add") commit("");
			else if (action === "sidechat") startSideChat();
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
			// The third row is the plugin's own extension (Kimi ships two): one
			// side thread per main session, opened next to the quote. There is no
			// second "open another" row — a reader asking about a quote should not
			// have to choose between two identical-looking entries.
			if (sideChatAvailable()) {
				rows.push(row(doc, "sidechat", ICON_SIDEBAR, translate("sideChat"), "menuitem", "dshq-row-sidechat"));
			}
			bar.replaceChildren(...rows);
		}

		/**
		 * Comment mode: the inline box Kimi swaps in behind 评论, with one addition
		 * of our own — the quote itself is an editable field above the comment. A
		 * selection can be trimmed before it goes out, and a revision can correct
		 * its wording, not just its comment. Both halves map onto the wire form's
		 * two marks, top to bottom.
		 */
		/**
		 * Grow one field to its content. A textarea that is not laid out yet
		 * reports a scrollHeight of 0 — writing that back as `0px` collapsed the
		 * quote half of the box and clipped its first line, so an unmeasurable
		 * field is left on `auto` until the bar is on screen.
		 */
		function growField(node) {
			node.style.height = "auto";
			const next = node.scrollHeight;
			if (!Number.isFinite(next) || next <= 0) return;
			node.style.height = Math.min(next, COMMENT_MAX_HEIGHT) + "px";
		}

		/** Every field the bar is currently showing, re-measured. */
		function growInputs() {
			const bar = state.bar;
			if (bar === null || bar === undefined || typeof bar.querySelectorAll !== "function") return;
			for (const field of Array.from(bar.querySelectorAll(".dshq-input"))) {
				if (String(field.tagName).toLowerCase() !== "textarea") continue;
				growField(field);
			}
		}

		function renderComment(bar) {
			const doc = bar.ownerDocument;
			bar.setAttribute("role", "dialog");
			bar.setAttribute("aria-label", translate("comment"));

			const quoteInput = el(doc, "textarea", {
				class: "dshq-input dshq-quote-input",
				rows: "1",
				"aria-label": translate("quoteLabel"),
				placeholder: translate("quotePlaceholder")
			});
			quoteInput.value = state.quote === null || state.quote === undefined ? "" : state.quote;

			const input = el(doc, "textarea", {
				class: "dshq-input dshq-comment-input",
				rows: "1",
				placeholder: translate("commentPlaceholder")
			});
			input.value = state.comment;

			const confirm = el(doc, "button", {
				type: "button",
				class: "dshq-btn dshq-btn-primary",
				"data-action": "confirm"
			}, [el(doc, "span", { text: translate("addToChat") }), el(doc, "span", { class: "dshq-enter", text: "⏎" })]);

			// The quote half is mandatory now (an empty quote is nothing to send);
			// the comment keeps Kimi's rule of being required in this box.
			const syncConfirm = () => {
				confirm.disabled = quoteInput.value.trim() === "" || input.value.trim() === "";
			};
			quoteInput.addEventListener("input", () => {
				state.quote = quoteInput.value;
				growField(quoteInput);
				syncConfirm();
			});
			input.addEventListener("input", () => {
				state.comment = input.value;
				growField(input);
				syncConfirm();
			});
			const onKey = (event) => {
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
			};
			quoteInput.addEventListener("keydown", onKey);
			input.addEventListener("keydown", onKey);

			// 逐条回应: one opt-in checkbox. On, the block carries a transport
			// instruction asking the model to answer per quote, and the reply's
			// `「引用N」` labels become badges that link back to these quotes.
			// Off (the default), the wire stays exactly the shape it always was.
			const replyCheck = el(doc, "input", { type: "checkbox", class: "dshq-reply-check" });
			replyCheck.checked = state.reply === true;
			replyCheck.addEventListener("change", () => {
				state.reply = replyCheck.checked === true;
			});
			const replyToggle = el(doc, "label", { class: "dshq-reply" }, [
				replyCheck,
				el(doc, "span", { text: translate("replyToggle") })
			]);

			// No grow here: the fields are measured in `position()`, once the bar
			// takes part in layout. Reading them while detached returned 0.
			syncConfirm();

			bar.replaceChildren(
				el(doc, "div", { class: "dshq-comment" }, [
					quoteInput,
					input,
					replyToggle,
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
			// The bar is in layout now (merely invisible), which is the first
			// moment its fields can be measured — and it has to happen before the
			// height below is read, or the box would be placed at the wrong place.
			growInputs();

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

		/**
		 * The source selection, kept visible with Chromium's Custom Highlight
		 * API while the comment box owns focus. A no-op on hosts without it; the
		 * quote box still carries the wording either way.
		 */
		const SOURCE_HIGHLIGHT = "dshq-selection";
		/** The persistent marks left by quotes, painted by the browser when it can. */
		const QUOTE_HIGHLIGHT = "dshq-quote";
		let sourceHighlight = false;
		function clearSourceHighlight() {
			if (sourceHighlight !== true) return;
			sourceHighlight = false;
			try {
				if (typeof CSS !== "undefined" && CSS.highlights !== undefined && typeof CSS.highlights.delete === "function") {
					CSS.highlights.delete(SOURCE_HIGHLIGHT);
				}
			} catch (error) {
				// A missing registry is the same as an unsupported browser.
			}
		}
		function paintSourceHighlight(range) {
			clearSourceHighlight();
			if (range === null || range === undefined) return;
			if (typeof CSS === "undefined" || CSS.highlights === undefined || typeof Highlight !== "function") return;
			try {
				CSS.highlights.set(SOURCE_HIGHLIGHT, new Highlight(range));
				sourceHighlight = true;
			} catch (error) {
				sourceHighlight = false;
			}
		}

		/**
		 * Kimi drops the transcript selection the moment an action is chosen (or
		 * the bar is dismissed). The bar has to do it by hand: its own mousedown
		 * calls `preventDefault()` to keep the selection while the reader aims,
		 * so the browser never performs that default for us.
		 */
		function dropTranscriptSelection() {
			const selection = typeof document === "undefined" || typeof document.getSelection !== "function" ? null : document.getSelection();
			if (selection === null || selection === undefined) return false;
			if (typeof selection.removeAllRanges !== "function") return false;
			if (selection.rangeCount === 0 || selection.isCollapsed === true) return false;
			selection.removeAllRanges();
			return true;
		}

		function open(found, range = lastSelectionRange) {
			const bar = ensureBar(document);
			paintSourceHighlight(range);
			// A fresh selection owns the document selection; nothing to hand back.
			state.keptSelection = false;
			state.quote = found.text;
			state.anchor = { x: found.x, y: found.y, bottom: found.bottom };
			state.sessionId = found.sessionId;
			state.comment = "";
			// A chat selection that sits inside one rendered code block is code too:
			// `lang` is null when the host is not the chat, "" when the block announces
			// no language, and the tag itself otherwise.
			const chatLang = typeof found.lang === "string" ? found.lang : null;
			state.code = found.hostKind === "preview" || found.hostKind === "terminal" || found.hostKind === "diff" || chatLang !== null;
			state.lang = chatLang ?? "";
			state.path = typeof found.path === "string" ? found.path : null;
			state.origin = typeof found.origin === "string" && found.origin !== "" ? found.origin : "chat";
			state.reply = config().replyByDefault === true;
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

		/**
		 * 改这条引用 — reopen the comment box on a quote that is already sent, with
		 * its old comment inside. The transcript is append-only, so the correction
		 * is a new quote; the bookkeeping (`state.revising`) is what lets the old
		 * capsule say it was superseded once the new one is committed. `code` keeps
		 * a code quote a code quote when the card sat on one.
		 */
		function startRevision(quote, comment, sessionId, anchor, code, ref, path, lang, origin) {
			if (typeof quote !== "string" || quote.trim() === "") return false;
			const bar = ensureBar(document);
			const rect = anchor !== null && anchor !== undefined && typeof anchor.getBoundingClientRect === "function" ? anchor.getBoundingClientRect() : null;
			state.quote = quote;
			state.comment = typeof comment === "string" ? comment : "";
			state.code = code === true;
			state.path = typeof path === "string" && path !== "" ? path : null;
			state.lang = typeof lang === "string" ? lang : "";
			state.origin = typeof origin === "string" && origin !== "" ? origin : "chat";
			state.reply = false;
			state.sessionId = sessionId === null || sessionId === undefined ? null : sessionId;
			// The correction belongs to the capsule that was revised: prefer its
			// own ref, so two identical quotes keep their two coordinates.
			const wire = normalizeRef(ref);
			state.source = wire === null ? sourceFor(quote) : { sessionId: wire.s, attr: wire.a, key: wire.k, turn: wire.t, role: ROLE_CODES.has(wire.r) ? wire.r : "" };
			state.revising = { quote, ref: wire };
			state.editing = null;
			if (rect !== null && (rect.width !== 0 || rect.height !== 0)) {
				state.anchor = { x: rect.left + rect.width / 2, y: rect.top, bottom: rect.bottom };
			}
			state.mode = "comment";
			state.suppress = false;
			const input = renderComment(bar);
			position();
			input.focus({ preventScroll: true });
			return true;
		}

		/**
		 * 编辑这条引用 — reopen the comment box on a quote that is still in the
		 * draft. The chip is not editable in place (the host has no API for
		 * that), so the correction is a new chip that lands where the old one
		 * was: the old chip leaves first, then the new one takes its place.
		 */
		function startDraftEdit(info, chip, anchor) {
			if (info === null || info === undefined || typeof info.quote !== "string" || info.quote.trim() === "") return false;
			const bar = ensureBar(document);
			const rect = anchor !== null && anchor !== undefined && typeof anchor.getBoundingClientRect === "function" ? anchor.getBoundingClientRect() : null;
			state.quote = info.quote;
			state.comment = typeof info.comment === "string" ? info.comment : "";
			state.code = info.code === true;
			state.path = typeof info.path === "string" && info.path !== "" ? info.path : null;
			state.lang = typeof info.lang === "string" ? info.lang : "";
			state.reply = false;
			state.sessionId = info.sessionId === null || info.sessionId === undefined ? null : info.sessionId;
			const wire = normalizeRef(info.ref);
			state.source = wire === null ? sourceFor(info.quote) : { sessionId: wire.s, attr: wire.a, key: wire.k, turn: wire.t, role: ROLE_CODES.has(wire.r) ? wire.r : "" };
			state.revising = null;
			state.editing = {
				chip,
				label: normalizeLabel(chipLabel(info.quote, info.comment)),
				quote: info.quote,
				comment: info.comment,
				sessionId: info.sessionId === null || info.sessionId === undefined ? null : info.sessionId
			};
			if (rect !== null && (rect.width !== 0 || rect.height !== 0)) {
				state.anchor = { x: rect.left + rect.width / 2, y: rect.top, bottom: rect.bottom };
			}
			state.mode = "comment";
			state.suppress = false;
			const input = renderComment(bar);
			position();
			input.focus({ preventScroll: true });
			return true;
		}

		function close() {
			clearSourceHighlight();
			// The bar held the selection alive with `preventDefault()`; going away
			// without an action means handing it back, or the reader is left with a
			// selection they cannot get rid of by clicking anywhere.
			if (state.keptSelection === true) {
				state.keptSelection = false;
				dropTranscriptSelection();
			}
			lastSelectionRange = null;
			if (state.settle !== null) {
				clearTimeout(state.settle);
				state.settle = null;
			}
			state.mode = null;
			state.quote = null;
			state.anchor = null;
			state.sessionId = null;
			state.comment = "";
			state.code = false;
			state.path = null;
			state.lang = "";
			state.origin = "chat";
			state.reply = false;
			state.source = null;
			state.revising = null;
			state.editing = null;
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
				node = el(doc, "div", { id: TOAST_ID, role: "status", "aria-live": "polite" });
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
			const revising = state.revising;
			const editing = state.editing;
			const code = state.code;
			// Captured before close() clears the bar's state.
			const path = state.path;
			const lang = state.lang;
			const reply = state.reply === true;
			// Resolve the insertion face before the bar is torn down: the slot entry
			// may already be gone (a session switch) while the composer is still up.
			const shell = inputShellFor(sessionId);
			const entry = insertionFace(sessionId, shell);
			const trimmed = typeof comment === "string" ? comment.trim() : "";
			close();
			if (typeof text !== "string" || text.trim() === "") return;
			if (entry === null) {
				// Returning silently here is what made "clicked and nothing happened"
				// reports: the user gets told instead.
				noteFailure("insert", "no composer face for this session");
				toast(translate("failed"));
				return;
			}

			// A very long quote would eat the context window; the switch caps it and
			// says so, rather than silently sending half a paragraph.
			const limit = config().maxQuoteChars;
			let quoteText = text;
			if (limit > 0 && text.length > limit) {
				quoteText = text.slice(0, limit) + "\n…";
				toast(String(translateFor(sessionId, "quoteTruncated")).replace("{n}", String(limit)));
			}

			// Remember the row this came from before anything can fail, and put the
			// same coordinate into the sent text as a wire-only ref line: the table
			// survives this window, the ref survives a reload and an empty table.
			// The `chip` mark says a chip is what holds this quote in the draft, so
			// `syncDraftBars` can retract the source mark when the reader takes the
			// chip back out without sending it.
			let wireRef = null;
			if (source !== null) {
				// The source table keys on the sentence as it was rendered, so the
				// Markdown marks this plugin added must not be part of the key.
				const saved = saveSource(plainOf(quoteText), sessionId, source, { chip: true });
				if (saved !== null) {
					wireRef = { v: 1, s: saved.sessionId, a: saved.attr, k: saved.key, t: saved.turn, n: saved.n };
					if (ROLE_CODES.has(saved.role)) wireRef.r = saved.role;
				}
			}
			const meta = {
				path,
				lang,
				origin: state.origin,
				reply,
				// The instruction is written in the reader's language, so an English
				// session gets English markers — and the badge parser reads both.
				replyInstruction: reply === true ? translateFor(sessionId, "replyInstruction") : "",
				ref: wireRef,
				label: config().attribution === true ? wireSourceLabel(wireRef) : ""
			};
			// A correction is a new quote; the old capsule learns it was superseded.
			// The corrected wording rides along so the old card can show it.
			if (revising !== null && trimmed !== "") rememberRevision(revising.quote, trimmed, quoteText, revising.ref);

			// Kimi drops the transcript selection the moment an action is chosen.
			dropTranscriptSelection();

			// An edited draft quote: the old chip leaves first, so the corrected one
			// lands where the old one stood. If the host does not act on the
			// Backspace, the chip stays and the reader gets the same hint the × uses.
			if (editing !== null && editing !== undefined && editing.chip !== null && editing.chip !== undefined && editing.chip.isConnected) {
				forgetChip(editing.label);
				removeDraftChip(editing.chip, editing.sessionId);
			}

			// DSH's own inline chip is the Kimi pill; the Markdown form below is
			// the fallback for every build where that service face is missing.
			// A comment rides inside that chip — one node, one capsule after the
			// send — so 评论 writes nothing else into the draft.
			if (insertChip(entry, sessionId, quoteText, trimmed, code, meta)) {
				focusComposer();
				return;
			}
			// The plain-text form took the quote instead: no chip holds it any more,
			// so the retraction path must never mistake a later removal for this one.
			if (wireRef !== null) dropSourceMarks(wireRef, ["chip"]);
			if (insertPayload(entry, buildPayload(quoteText, trimmed, code, meta), composerText().trim() !== "")) focusComposer();
			else {
				noteFailure("insert", "the plain-text fallback failed too");
				toast(translate("failed"));
			}
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
		 * The native backend: a client-side fork (inherits the source history)
		 * opened in our own right-sidebar page type, which renders the host's
		 * embedded conversation. No host half and no third-party sidebar; the
		 * composer, streaming and tool calls are the host's own. The fork's id is
		 * the thread id, so the rest of the thread machinery (prefill, list,
		 * bring-back, export) works unchanged.
		 */
		function nativeSideChatAvailable() {
			const sessions = serviceOf("sessions");
			const right = serviceOf("sidebarRight");
			return (
				sessions !== null &&
				sessions !== undefined &&
				typeof sessions.fork === "function" &&
				right !== null &&
				right !== undefined &&
				typeof right.openResource === "function"
			);
		}

		/** Titles of children we just renamed, before the session list catches up. */
		const nativeThreadTitles = new Map();
		const NATIVE_TITLE_LIMIT = 120;
		/** true while our page type and resource provider are registered. */
		let nativeSideChatReady = false;
		/** Bumped per install, so a stale disposal never clears a live page. */
		let nativeSideChatEpoch = 0;
		/** unknown (not asked yet) | available | unavailable. */
		let builtinSideChatState = "unknown";
		/** The one probe in flight/complete for this page. */
		let builtinSideChatProbe = null;
		/** When the failed probe ran, so a late host route gets another chance. */
		let builtinSideChatProbeAt = 0;
		const SIDECHAT_RETRY_MS = 15000;

		function rememberNativeThreadTitle(threadId, title) {
			if (typeof threadId !== "string" || threadId === "" || typeof title !== "string" || title === "") return;
			nativeThreadTitles.delete(threadId);
			nativeThreadTitles.set(threadId, title);
			while (nativeThreadTitles.size > NATIVE_TITLE_LIMIT) {
				const oldest = nativeThreadTitles.keys().next();
				if (oldest.done === true) break;
				nativeThreadTitles.delete(oldest.value);
			}
		}

		/** Drop the shared `Side: ` convention from a title our own tab shows. */
		function cleanSideThreadTitle(title) {
			return typeof title === "string" && title.startsWith(SIDECHAT_LABEL_PREFIX) ? title.slice(SIDECHAT_LABEL_PREFIX.length) : title;
		}

		/** What the tab is called: our rename, the session title, or the child id. */
		function nativeThreadTitle(sessions, childId) {
			const local = nativeThreadTitles.get(childId);
			if (typeof local === "string" && local !== "") return local;
			const byId = sessions?.list?.getSnapshot?.()?.byId;
			const summary = byId === undefined || byId === null ? undefined : byId[childId];
			if (summary !== undefined && summary !== null) {
				if (typeof summary.title === "string" && summary.title !== "") return cleanSideThreadTitle(summary.title);
				const values = summary.projectionValues;
				if (values !== undefined && values !== null) {
					if (typeof values.title === "string" && values.title !== "") return cleanSideThreadTitle(values.title);
					if (typeof values.subagent?.label === "string" && values.subagent.label !== "") return cleanSideThreadTitle(values.subagent.label);
				}
			}
			return childId;
		}

		/** The built-in subagent chat address, used when our page cannot register. */
		function builtinThreadAddress(sessionId, threadId) {
			const query = new URLSearchParams({ parent: sessionId, mode: "continuable" });
			return BUILTIN_THREAD_ADDRESS + encodeURIComponent(threadId) + "?" + query.toString();
		}

		/** Our page's address: only these are claimed by QUOTE_SIDECHAT_KIND. */
		function nativeThreadAddress(sessionId, threadId) {
			const query = new URLSearchParams({ parent: sessionId, mode: "continuable" });
			return QUOTE_SIDECHAT_ADDRESS + encodeURIComponent(threadId) + "?" + query.toString();
		}

		/** The address's direct-parent facts, or null for another/malformed resource. */
		function parseNativeThreadAddress(value) {
			let url;
			try {
				url = new URL(value);
			} catch (error) {
				return null;
			}
			if (url.protocol !== "dsh-resource:" || url.hostname.toLowerCase() !== QUOTE_SIDECHAT_PROTOCOL) return null;
			const parts = url.pathname.split("/").filter(Boolean);
			if (parts.length !== 2 || parts[0] !== "session") return null;
			const parentSessionId = url.searchParams.get("parent");
			const mode = url.searchParams.get("mode");
			if (parentSessionId === null || parentSessionId === "" || (mode !== "one-shot" && mode !== "continuable" && mode !== "unknown")) return null;
			try {
				return { parentSessionId, childSessionId: decodeURIComponent(parts[1]), mode };
			} catch (error) {
				return null;
			}
		}

		/**
		 * Which backend the third row would use. `builtin` is the plugin's own
		 * hidden thread (host half + `Side:` convention); it is assumed until a
		 * probe says otherwise, because the host half ships with the plugin.
		 * `native` is the older fork page, `better` is the opt-in third-party
		 * backend. `sideChatBackend: "better"` puts better-sidebar first.
		 */
		function sideChatBackend() {
			const better = sideChatService();
			const native = nativeSideChatAvailable();
			if (config().sideChatBackend === "better" && better !== null) return "better";
			if (builtinSideChatState !== "unavailable") return "builtin";
			if (native) return "native";
			if (better !== null) return "better";
			return "none";
		}

		/** Open our page when it is registered; otherwise the built-in one. */
		function openNativeThreadTab(sessionId, threadId) {
			const right = serviceOf("sidebarRight");
			if (right === null || right === undefined || typeof right.openResource !== "function") return false;
			const first = nativeSideChatReady ? nativeThreadAddress(sessionId, threadId) : builtinThreadAddress(sessionId, threadId);
			try {
				right.openResource(first);
				return true;
			} catch (error) {
				console.warn("[ui-quote] native sidechat open failed:", error);
				if (nativeSideChatReady) {
					try {
						right.openResource(builtinThreadAddress(sessionId, threadId));
						return true;
					} catch (fallbackError) {
						console.warn("[ui-quote] built-in sidechat open failed:", fallbackError);
					}
				}
				return false;
			}
		}

		/**
		 * Open (or reuse) a side thread, then prefill it. A fork copies the source
		 * history, so the side thread keeps the main session's context without
		 * touching it. The fork is renamed after the quote; our page's title reads
		 * that rename, so the tab names the quote instead of the child id. Nothing
		 * is sent.
		 */
		function nativeSideChatRequest(sessionId, text, code, path, lang, mode, quoteKey, meta) {
			if (typeof sessionId !== "string" || sessionId === "" || typeof text !== "string" || text.trim() === "") {
				return Promise.resolve();
			}
			const running = sideChatPending.get(sessionId);
			if (running !== undefined) return running;
			const pending = (async () => {
				const bound = typeof quoteKey === "string" && quoteKey !== "" ? threadForQuote(sessionId, quoteKey) : null;
				let threadId = mode === "new" ? null : bound ?? storedSideThread(sessionId);
				if (threadId === null) {
					const sessions = serviceOf("sessions");
					if (sessions === null || sessions === undefined || typeof sessions.fork !== "function") {
						noteFailure("sidechat", "sessions.fork is unavailable");
						toast(translateFor(sessionId, "sideChatFailed"));
						return;
					}
					try {
						threadId = await sessions.fork({ sessionId, increaseTitle: true });
					} catch (error) {
						console.warn("[ui-quote] native sidechat fork failed:", error);
						noteFailure("sidechat", "sessions.fork failed: " + (error instanceof Error ? error.message : String(error)));
						toast(translateFor(sessionId, "sideChatFailed"));
						return;
					}
					if (typeof threadId !== "string" || threadId === "") {
						noteFailure("sidechat", "sessions.fork returned no id");
						toast(translateFor(sessionId, "sideChatFailed"));
						return;
					}
					// A fresh fork is a plain session, even if the id was once
					// remembered as a hidden child.
					rememberThreadTarget(threadId, null);
					if (typeof sessions.rename === "function") {
						const title = sideChatTitle(text);
						try {
							await sessions.rename(threadId, title);
							rememberNativeThreadTitle(threadId, title);
						} catch (error) {
							// The chat still opens; the title stays the child id.
						}
					}
				}
				if (!openThreadTarget(sessionId, threadId)) {
					noteFailure("sidechat", "the side thread tab did not open");
					toast(translateFor(sessionId, "sideChatFailed"));
					return;
				}
				rememberSideThread(sessionId, threadId);
				if (typeof quoteKey === "string" && quoteKey !== "") rememberQuoteThread(sessionId, quoteKey, threadId);
				const boundary = targetOfThread(threadId).kind === "hidden" ? translateFor(sessionId, "sideChatBoundary") : undefined;
				// A fork is an ordinary session: its composer takes the chip, so the
				// quote reads as a reference there too. The boundary line only rides
				// with the plain-text form.
				if (!(await prefillQuoteDraft(threadId, text, code === true, path, lang, meta ?? (boundary === undefined ? undefined : { boundary })))) {
					console.warn("[ui-quote] native sidechat draft not written:", threadId);
					toast(translateFor(sessionId, "sideChatDraftFailed"));
				}
			})();
			sideChatPending.set(sessionId, pending);
			pending.then(
				() => {
					if (sideChatPending.get(sessionId) === pending) sideChatPending.delete(sessionId);
				},
				(error) => {
					console.warn("[ui-quote] native sidechat request failed:", error);
					if (sideChatPending.get(sessionId) === pending) sideChatPending.delete(sessionId);
				}
			);
			return pending;
		}

		/** One JSON POST with a timeout; the status and the parsed envelope come back. */
		async function postJson(url, payload, timeoutMs) {
			const controller = typeof AbortController === "function" ? new AbortController() : null;
			const timer = controller === null ? null : setTimeout(() => controller.abort(), timeoutMs);
			try {
				const response = await fetch(url, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(payload),
					...(controller === null ? {} : { signal: controller.signal })
				});
				const body = await response.json().catch(() => null);
				return { response, body };
			} finally {
				if (timer !== null) clearTimeout(timer);
			}
		}

		/**
		 * Ask the host half whether it can create a hidden thread. The answer is
		 * cached for the page: the route is registered at plugin load, so a miss
		 * will not turn into a hit without a reload.
		 */
		function probeBuiltinSideChat() {
			if (builtinSideChatProbe !== null) {
				if (builtinSideChatState !== "unavailable" || Date.now() - builtinSideChatProbeAt < SIDECHAT_RETRY_MS) return builtinSideChatProbe;
				builtinSideChatProbe = null;
			}
			builtinSideChatProbeAt = Date.now();
			builtinSideChatProbe = (async () => {
				try {
					const result = await postJson(SIDECHAT_BUILTIN_API, { probe: true }, SIDECHAT_PROBE_MS);
					const available = result.response.ok && result.body !== null && typeof result.body === "object" && result.body.ok === true && result.body.value?.available === true;
					builtinSideChatState = available ? "available" : "unavailable";
					if (!available) noteFailure("sidechat", "the built-in side-chat route is unavailable");
					return available;
				} catch (error) {
					builtinSideChatState = "unavailable";
					noteFailure("sidechat", "the built-in side-chat route is unreachable");
					return false;
				}
			})();
			return builtinSideChatProbe;
		}

		/** Ask the host half for one hidden child; null means "fall back". */
		async function startBuiltinSideThread(sessionId, title) {
			const result = await postJson(SIDECHAT_BUILTIN_API, { sessionId, title }, SIDECHAT_START_MS);
			const value = result.body !== null && typeof result.body === "object" && result.body.ok === true ? result.body.value : null;
			const childId = value !== null && typeof value === "object" ? value.childId : null;
			if (result.response.ok && typeof childId === "string" && childId !== "") {
				builtinSideChatState = "available";
				return childId;
			}
			if (result.response.status === 404 || result.response.status === 405 || result.response.status === 503) builtinSideChatState = "unavailable";
			console.warn("[ui-quote] built-in sidechat refused:", result.response.status, result.body);
			return null;
		}

		/**
		 * Open a thread in the page its target deserves. A hidden child goes to
		 * our page whenever it is registered: our page sends through the standard
		 * session path, which opens the stored child directly, while the built-in
		 * page's sends go through the host's subagent manager. The child is
		 * released right after creation, so both resume a valid (seeded) log
		 * instead of colliding with a live handle. A host without our page type
		 * still lands on the built-in address, because `openNativeThreadTab`
		 * opens that one itself when the page is not registered.
		 */
		function openThreadTarget(sessionId, threadId) {
			const target = targetOfThread(threadId);
			return openNativeThreadTab(target.kind === "hidden" ? target.parentId : sessionId, threadId);
		}

		/**
		 * A stored hidden thread is only reused while the host can still open
		 * it. A child minted by an older build keeps its descriptor before the
		 * inherited cut, so the host refuses its history for good ("subagent
		 * descriptor is unavailable"); reopening it can never succeed, and
		 * forgetting it lets the next click mint a healthy thread instead. The
		 * answer is cached per page: a healthy thread costs one retain.
		 */
		function hiddenThreadReadable(threadId) {
			if (targetOfThread(threadId).kind !== "hidden") return Promise.resolve(true);
			const cached = hiddenThreadHealth.get(threadId);
			if (cached !== undefined) return Promise.resolve(cached);
			return withSession(threadRetainTarget(threadId), () => null).then((read) => {
				if (read.ok === true) {
					hiddenThreadHealth.set(threadId, true);
					return true;
				}
				// Only a host that refuses the address is evidence of a broken
				// child. A host with no session service, or a retain that resolves
				// nothing yet, is "unknown" and must not churn a healthy thread.
				if (read.reason !== "failed") return true;
				hiddenThreadHealth.set(threadId, false);
				return false;
			});
		}

		/** Drop every binding to one thread (a dead or unreadable child). */
		function forgetSideThread(sessionId, threadId) {
			if (typeof sessionId !== "string" || sessionId === "" || typeof threadId !== "string" || threadId === "") return;
			hiddenThreadHealth.delete(threadId);
			rememberThreadTarget(threadId, null);
			const known = sideThreadsOf(sessionId);
			const quotes = {};
			for (const [quoteKey, value] of Object.entries(known.quotes)) {
				if (value !== threadId) quotes[quoteKey] = value;
			}
			const remaining = Object.values(quotes);
			const fallback = known.default === threadId ? (remaining.length > 0 ? remaining[0] : null) : known.default;
			const map = readThreadMap(SIDE_THREAD_KEY);
			if (fallback === null && remaining.length === 0) delete map[sessionId];
			else map[sessionId] = { threadId: fallback ?? remaining[0], quotes };
			try {
				localStorage.setItem(SIDE_THREAD_KEY, JSON.stringify(map));
			} catch (error) {
				console.warn("[ui-quote] the stale side thread was not forgotten:", error);
			}
		}

		/**
		 * The preferred third-row action: one hidden child created by the host
		 * half, opened in the host's own subagent chat. `true` means the request
		 * was handled (open or failed after creating); `false` means nothing was
		 * created and the caller may fall back to a fork.
		 */
		function hiddenSideChatRequest(sessionId, text, code, path, lang, mode, quoteKey, meta) {
			if (typeof sessionId !== "string" || sessionId === "" || typeof text !== "string" || text.trim() === "") {
				return Promise.resolve(false);
			}
			const running = sideChatPending.get(sessionId);
			if (running !== undefined) return running;
			const pending = (async () => {
				if (!(await probeBuiltinSideChat())) return false;
				const bound = typeof quoteKey === "string" && quoteKey !== "" ? threadForQuote(sessionId, quoteKey) : null;
				let threadId = mode === "new" ? null : bound ?? storedSideThread(sessionId);
				// Reuse only a thread this build minted. Anything older — a plain
				// better-sidebar id, or a child whose descriptor sits before the
				// inherited cut (the host refuses its history forever) — is replaced
				// instead of reopened. `sessions.retain` cannot tell them apart: it
				// succeeds where the history RPC refuses, so the version stamp is
				// the only honest signal.
				if (threadId !== null && targetOfThread(threadId).kind === "hidden" && !mintedHiddenThread(threadId)) {
					forgetSideThread(sessionId, threadId);
					threadId = null;
				}
				if (threadId !== null && !(await hiddenThreadReadable(threadId))) {
					forgetSideThread(sessionId, threadId);
					threadId = null;
				}
				if (threadId === null) {
					try {
						threadId = await startBuiltinSideThread(sessionId, sideChatTitle(text));
					} catch (error) {
						console.warn("[ui-quote] built-in sidechat start failed:", error);
						threadId = null;
					}
					if (threadId === null) return false;
					const target = { kind: "hidden", parentId: sessionId, v: HIDDEN_THREAD_VERSION };
					rememberThreadTarget(threadId, target);
					rememberSideThread(sessionId, threadId, target);
					if (typeof quoteKey === "string" && quoteKey !== "") rememberQuoteThread(sessionId, quoteKey, threadId, target);
				}
				if (!openThreadTarget(sessionId, threadId)) {
					noteFailure("sidechat", "the hidden side thread tab did not open");
					toast(translateFor(sessionId, "sideChatFailed"));
					return true;
				}
				// The quote goes in as a reference chip, not as the reader's own
				// words; the thread's first message already carries the background
				// instruction, so no visible boundary line is written.
				if (!(await prefillQuoteDraft(threadId, text, code === true, path, lang, meta))) {
					console.warn("[ui-quote] hidden sidechat draft not written:", threadId);
					toast(translateFor(sessionId, "sideChatDraftFailed"));
				}
				return true;
			})();
			sideChatPending.set(sessionId, pending);
			pending.then(
				() => {
					if (sideChatPending.get(sessionId) === pending) sideChatPending.delete(sessionId);
				},
				(error) => {
					console.warn("[ui-quote] hidden sidechat request failed:", error);
					if (sideChatPending.get(sessionId) === pending) sideChatPending.delete(sessionId);
				}
			);
			return pending;
		}

		/** The third row exists while any backend can carry a side thread. */
		function sideChatAvailable() {
			return sideChatBackend() !== "none";
		}

		/**
		 * The resource provider our page type's addresses resolve through. It is
		 * a rewrite of the built-in subagent provider: retain the child session
		 * for as long as the tab is mounted, then release it.
		 */
		function sideChatResourceProvider(sessions) {
			return {
				protocol: QUOTE_SIDECHAT_PROTOCOL,
				async *open(resourceAddress, { signal } = {}) {
					const address = parseNativeThreadAddress(resourceAddress);
					if (address === null) throw new Error("[ui-quote] invalid side chat address: " + resourceAddress);
					if (signal !== undefined && signal.aborted === true) return;
					const reference = sessions.retain(address, { source: "sidebarChat", signal });
					try {
						yield { ok: true, value: { address, reference } };
						if (signal !== undefined) {
							await new Promise((resolve) => {
								if (signal.aborted === true) {
									resolve();
									return;
								}
								signal.addEventListener("abort", () => resolve(), { once: true });
							});
						}
					} finally {
						reference.release();
					}
				}
			};
		}

		const SIDECHAT_STYLE_TEXT =
			".dshq-sidechat{width:100%;min-width:0;height:100%;min-height:0;display:flex}" +
			".dshq-sidechat-empty{display:flex;flex:1 1 auto;min-height:0;align-items:center;justify-content:center;padding:24px;text-align:center;color:var(--dsw-alias-label-caption,#8a8f99);font-size:13px;line-height:20px}" +
			'.dshq-sidechat [data-slot="conversation.session"]:has(> *) + .dshq-sidechat-empty{display:none}' +
			".dshq-sidechat:has([data-conversation-scroll] [data-chat-anchor-key]) .dshq-sidechat-empty{display:none}" +
			'.dshq-sidechat:has([data-conversation-content][data-content-phase="settling"]) .dshq-sidechat-empty{visibility:hidden}';

		/** The page's own stylesheet; removed with the page registration. */
		function installSideChatStyle() {
			if (typeof document === "undefined") return () => {};
			const existing = document.getElementById(QUOTE_SIDECHAT_STYLE_ID);
			if (existing !== null) return () => {};
			const style = el(document, "style", { id: QUOTE_SIDECHAT_STYLE_ID, "data-plugin": "dsh-client-ui-quote" });
			style.textContent = SIDECHAT_STYLE_TEXT;
			const host = document.head === undefined || document.head === null ? document.documentElement : document.head;
			if (host !== null && host !== undefined) host.append(style);
			return () => {
				if (typeof style.remove === "function") style.remove();
				else if (style.parentNode !== null && style.parentNode !== undefined) style.parentNode.removeChild(style);
			};
		}

		/**
		 * The host's `conversation.session` slot fixed to the chat view, plus an
		 * empty state. The host's own session view returns null for a blank
		 * session (`ConversationSession`: `session.blank && phase === "blank"`),
		 * so the view area would hold no DOM at all — the composer then sits at
		 * the top of the pane and the draft bar covers the tab strip. The empty
		 * state gives the view area a growable child; the stylesheet hides it as
		 * soon as the host's view renders anything. A Fragment, not a wrapper:
		 * the host's stylesheet selects the session slot as a direct child of
		 * its scroll body, and an extra element would break that relationship.
		 */
		function SideChatFixedView(props) {
			return react.createElement(
				react.Fragment,
				null,
				props.renderSlot("conversation.session", { view: "chat" }),
				react.createElement("div", { className: "dshq-sidechat-empty" }, translateFor(null, "sideChatEmpty"))
			);
		}

		/**
		 * The phase our embedded conversation asks for. A side thread is a seeded
		 * child with no turns yet, so the host summary calls it `blank` — and
		 * `blank` is what makes the host draw the session home ("探索未至之境")
		 * instead of a chat, with a hero composer that is inert without a
		 * workspace, so the quote cannot land in it. Our page exists to host the
		 * thread's own composer, so it never asks for the hero: it settles while
		 * the child opens, then renders the chat.
		 * @param {object} session - the child's session snapshot.
		 * @returns {"settling" | "active"} the embedded phase.
		 */
		function sideChatPhase(session) {
			const parentAvailabilityPending = session?.subagent?.address?.mode === "continuable" && session?.subagent?.parentAvailable === undefined;
			return session?.openState === "loading" || parentAvailabilityPending ? "settling" : "active";
		}

		/**
		 * The host's full conversation content in its embedded variant, copied
		 * from the built-in subagent page — the only published example of the
		 * contract. All hooks come from the slot host. `hero` stays false: the
		 * host's `ConversationContent` draws the welcome hero (and disables the
		 * composer without a workspace) whenever it is true, which is exactly the
		 * page our quote draft cannot be written into.
		 */
		function SideChatConversationLoaded(props) {
			const session = props.useSession((value) => value);
			return props.renderFactorySlot(
				"conversation.content",
				{ variant: "embedded", phase: sideChatPhase(session), hero: false },
				{ slots: { views: SideChatFixedView } }
			);
		}

		function SideChatConversation(props) {
			const host = props === null || props === undefined ? {} : props;
			if (typeof host.useSession !== "function" || typeof host.renderFactorySlot !== "function") {
				return react.createElement("p", { className: "dshq-sidechat-missing" }, translateFor(null, "sideChatNoHost"));
			}
			return react.createElement(SideChatConversationLoaded, host);
		}

		function SideChatTabLoaded(props) {
			const info = props.useTabInfo();
			const tab = info === null || info === undefined ? null : info.tab;
			const resource = props.useResource(tab === null || tab === undefined ? undefined : tab.contentId);
			const value = resource === null || resource === undefined ? undefined : resource.value;
			return react.createElement(
				"div",
				{ className: "dshq-sidechat" },
				value === undefined || value === null
					? null
					: react.createElement(props.SessionProvider, { session: value.reference }, props.renderSlot("ui-quote.sidechat.body", {}))
			);
		}

		function SideChatTab(props) {
			const host = props === null || props === undefined ? {} : props;
			if (typeof host.useTabInfo !== "function" || typeof host.useResource !== "function" || typeof host.SessionProvider !== "function" || typeof host.renderSlot !== "function") {
				return react.createElement("p", { className: "dshq-sidechat-missing" }, translateFor(null, "sideChatNoHost"));
			}
			return react.createElement(SideChatTabLoaded, host);
		}

		/**
		 * Register our page type, resource provider and body. When a host piece is
		 * missing the function does nothing and `openNativeThreadTab` keeps the
		 * built-in subagent page — a degraded page, not a broken feature.
		 */
		function installNativeSideChatPage(hostCtx, providedSessions) {
			return hostCtx.effect(() => {
				const sessions = providedSessions === undefined ? serviceOf("sessions") : providedSessions;
				const resources = hostCtx.resources;
				const tabs = hostCtx.sidebarRightTabs;
				if (sessions === null || sessions === undefined || typeof sessions.retain !== "function") return () => {};
				if (resources === null || resources === undefined || typeof resources.register !== "function") return () => {};
				if (tabs === null || tabs === undefined || typeof tabs.register !== "function") return () => {};
				const epoch = (nativeSideChatEpoch += 1);
				const disposers = [];
				const cleanup = () => {
					for (const dispose of disposers.reverse()) {
						try {
							dispose();
						} catch (error) {
							// Unloading is best-effort; the host tears the rest down.
						}
					}
					if (nativeSideChatEpoch === epoch) nativeSideChatReady = false;
				};
				try {
					disposers.push(installSideChatStyle());
					disposers.push(resources.register(sideChatResourceProvider(sessions)));
					disposers.push(
						tabs.register({
							id: QUOTE_SIDECHAT_TAB_ID,
							kind: QUOTE_SIDECHAT_KIND,
							patterns: [QUOTE_SIDECHAT_ADDRESS + "**"],
							canOpen: (address) => parseNativeThreadAddress(address) !== null,
							title: (address) => {
								const parsed = parseNativeThreadAddress(address);
								return parsed === null ? translateFor(null, "sideChat") : nativeThreadTitle(sessions, parsed.childSessionId);
							}
						})
					);
					disposers.push(
						hostCtx.slots.inject("sidebar.right.pane.tab", () =>
							hostCtx.slots.register(
								{
									name: "sidebar.right.pane.tab",
									key: QUOTE_SIDECHAT_TAB_ID,
									children: { "ui-quote.sidechat.body": { kind: "single", scope: "session" } }
								},
								SideChatTab
							)
						)
					);
					disposers.push(
						hostCtx.slots.inject("ui-quote.sidechat.body", () => hostCtx.slots.register({ name: "ui-quote.sidechat.body" }, SideChatConversation))
					);
					nativeSideChatReady = true;
				} catch (error) {
					console.warn("[ui-quote] the native side chat page is unavailable:", error);
					cleanup();
					return () => {};
				}
				return cleanup;
			}, "ui-quote: native side chat page");
		}

		/**
		 * The quote as the side thread's first message: a plain blockquote. The
		 * `❝` marks stay out on purpose — they exist for the MAIN transcript's
		 * capsule enhancer, and the side thread renders its own way. A code quote
		 * keeps its fence instead: that composer talks to the model, and a fenced
		 * block is what the model reads as code. A preview quote puts its file
		 * into the fence's info string, the same slot the main wire uses.
		 */
		function sideQuestion(text, code, path, lang) {
			const lines = blockLines(text);
			if (code === true && lines.length > 0) {
				const fence = lines.some((line) => /^\s*```/u.test(line)) ? "~~~" : "```";
				const clean = sanitizePath(path) ?? "";
				const tag = sanitizeLang(lang) ?? "";
				const info = clean !== "" ? clean : tag;
				return [fence + (info === "" ? "" : " " + info)].concat(lines, [fence]).join("\n");
			}
			return lines
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

		/**
		 * Hidden threads already checked this page: thread id → the host can open
		 * it. Deliberately never invalidated: a thread that breaks *after* the
		 * first check still reads as healthy until the next reload, because
		 * probing on every click costs an RPC and can flap on a slow parent.
		 */
		const hiddenThreadHealth = new Map();

		/** One stored "session → side thread" map, best effort (a denied store is fine). */
		function readThreadMap(key) {
			try {
				const parsed = JSON.parse(localStorage.getItem(key));
				return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
			} catch (error) {
				return {};
			}
		}

		/** thread id → `{ parentId, kind: "hidden" }`, best effort. */
		function readThreadTargets() {
			try {
				const parsed = JSON.parse(localStorage.getItem(SIDECHAT_TARGET_KEY));
				return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
			} catch (error) {
				return {};
			}
		}

		function writeThreadTargets(map) {
			try {
				localStorage.setItem(SIDECHAT_TARGET_KEY, JSON.stringify(map));
			} catch (error) {
				console.warn("[ui-quote] side thread targets not stored:", error);
			}
		}

		/** Remember a hidden thread's parent (a null target forgets it). */
		function rememberThreadTarget(threadId, target) {
			if (typeof threadId !== "string" || threadId === "") return;
			const map = readThreadTargets();
			const previous = map[threadId];
			const parentId = target !== null && target !== undefined && typeof target.parentId === "string" ? target.parentId : "";
			if (parentId === "") {
				delete map[threadId];
				writeThreadTargets(map);
				return;
			}
			// An explicit version wins; a scan of someone else's thread must not
			// upgrade it, so an unknown entry stays unversioned.
			const explicit = target !== null && target !== undefined && typeof target.v === "number" ? target.v : undefined;
			const inherited = previous !== null && typeof previous === "object" && typeof previous.v === "number" ? previous.v : undefined;
			const version = explicit ?? inherited;
			map[threadId] = { parentId, kind: "hidden", ...(version === undefined ? {} : { v: version }) };
			const keys = Object.keys(map);
			for (const key of keys.slice(0, Math.max(0, keys.length - SIDECHAT_TARGET_LIMIT))) delete map[key];
			writeThreadTargets(map);
		}

		/** Whether this build minted the thread (its binding carries the shape version). */
		function mintedHiddenThread(threadId) {
			if (typeof threadId !== "string" || threadId === "") return false;
			const stored = readThreadTargets()[threadId];
			return stored !== null && typeof stored === "object" && stored.v === HIDDEN_THREAD_VERSION;
		}

		/** better-sidebar's map, read backwards, for threads our own map predates. */
		function hostParentOfThread(threadId) {
			if (typeof threadId !== "string" || threadId === "") return null;
			const map = readThreadMap(HOST_THREAD_KEY);
			for (const [mainId, value] of Object.entries(map)) {
				const stored = typeof value === "string" ? value : value === null || typeof value !== "object" ? "" : String(value.threadId === undefined ? "" : value.threadId);
				if (stored !== "" && stored === threadId) return mainId;
			}
			return null;
		}

		/**
		 * The shape one thread needs: a hidden child carries its parent (a
		 * subagent address), anything else is a plain session id. Old
		 * better-sidebar threads have no local target entry; their own map is
		 * the read-only fallback that still finds the parent.
		 */
		function targetOfThread(threadId) {
			if (typeof threadId !== "string" || threadId === "") return { kind: "fork", parentId: null };
			const stored = readThreadTargets()[threadId];
			if (stored !== null && typeof stored === "object" && stored.kind === "hidden" && typeof stored.parentId === "string" && stored.parentId !== "") {
				return { kind: "hidden", parentId: stored.parentId };
			}
			const parentId = hostParentOfThread(threadId);
			if (parentId !== null) return { kind: "hidden", parentId };
			return { kind: "fork", parentId: null };
		}

		/** What `sessions.retain` takes for this thread. */
		function threadRetainTarget(threadId) {
			const target = targetOfThread(threadId);
			return target.kind === "hidden"
				? { parentSessionId: target.parentId, childSessionId: threadId, mode: "continuable" }
				: threadId;
		}

		/**
		 * The side thread of a main session: ours first (it knows which threads
		 * are hidden and which were forks), then better-sidebar's memory as the
		 * fallback for threads created by an older build.
		 */
		function storedSideThread(sessionId) {
			if (typeof sessionId !== "string" || sessionId === "") return null;
			for (const key of [SIDE_THREAD_KEY, HOST_THREAD_KEY]) {
				const stored = readThreadMap(key)[sessionId];
				if (typeof stored === "string" && stored !== "") return stored;
				// This plugin's own map grew a shape: the default thread plus the
				// per-quote ones. The host's map still stores a plain id.
				if (stored !== null && typeof stored === "object") {
					const threadId = stored.threadId;
					if (typeof threadId === "string" && threadId !== "") return threadId;
				}
			}
			return null;
		}

		/** Remember the session's side thread (an empty id forgets it). */
		function rememberSideThread(sessionId, threadId, target) {
			if (typeof sessionId !== "string" || sessionId === "") return;
			const map = readThreadMap(SIDE_THREAD_KEY);
			const quotes = sideThreadsOf(sessionId).quotes;
			if (typeof threadId === "string" && threadId !== "") {
				map[sessionId] = { threadId, quotes };
				if (target !== undefined) rememberThreadTarget(threadId, target);
			} else {
				delete map[sessionId];
			}
			try {
				localStorage.setItem(SIDE_THREAD_KEY, JSON.stringify(map));
			} catch (error) {
				console.warn("[ui-quote] side thread not remembered:", error);
			}
		}

		/**
		 * The session's side threads: the default one plus the ones bound to
		 * individual quotes. A quote that opened its own thread reopens that
		 * thread; another quote of the same session keeps the default.
		 */
		function sideThreadsOf(sessionId) {
			const empty = { default: null, quotes: {} };
			if (typeof sessionId !== "string" || sessionId === "") return empty;
			for (const key of [SIDE_THREAD_KEY, HOST_THREAD_KEY]) {
				const stored = readThreadMap(key)[sessionId];
				if (typeof stored === "string" && stored !== "") {
					if (empty.default === null) empty.default = stored;
					continue;
				}
				if (stored === null || typeof stored !== "object") continue;
				const threadId = typeof stored.threadId === "string" && stored.threadId !== "" ? stored.threadId : null;
				if (empty.default === null && threadId !== null) empty.default = threadId;
				const quotes = stored.quotes;
				if (quotes === null || typeof quotes !== "object") continue;
				for (const quoteKey of Object.keys(quotes)) {
					const value = quotes[quoteKey];
					if (typeof value === "string" && value !== "" && empty.quotes[quoteKey] === undefined) empty.quotes[quoteKey] = value;
				}
			}
			return empty;
		}

		/** The thread bound to one quote, if it has one. */
		function threadForQuote(sessionId, quoteKey) {
			if (typeof quoteKey !== "string" || quoteKey === "") return null;
			const bound = sideThreadsOf(sessionId).quotes[quoteKey];
			return typeof bound === "string" && bound !== "" ? bound : null;
		}

		/** Bind a quote to the thread it opened. */
		function rememberQuoteThread(sessionId, quoteKey, threadId, target) {
			if (typeof sessionId !== "string" || sessionId === "" || typeof quoteKey !== "string" || quoteKey === "") return;
			if (typeof threadId !== "string" || threadId === "") return;
			const map = readThreadMap(SIDE_THREAD_KEY);
			const known = sideThreadsOf(sessionId);
			map[sessionId] = { threadId: known.default ?? threadId, quotes: { ...known.quotes, [quoteKey]: threadId } };
			if (target !== undefined) rememberThreadTarget(threadId, target);
			try {
				localStorage.setItem(SIDE_THREAD_KEY, JSON.stringify(map));
			} catch (error) {
				console.warn("[ui-quote] quote thread not remembered:", error);
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
				const sessions = serviceOf("sessions");
				if (typeof hub.for === "function" && typeof sessions?.scope === "function") {
					const scope = sessions.scope(sessionId);
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

		/**
		 * Whether the draft holds the reader's own wording, not just chips. A
		 * chip's clipboard projection is the whole quote block, so a draft with
		 * one chip is never "empty" textually; the occurrences have to be cut out
		 * before the answer means anything. Null when the shell exposes no draft.
		 */
		function draftOwnText(shell) {
			try {
				const snapshot = shell.state === undefined ? null : shell.state.getSnapshot();
				if (snapshot === null || snapshot === undefined || typeof snapshot.draft !== "string") return null;
				let text = snapshot.draft;
				const occurrences = Array.isArray(snapshot.occurrences) ? [...snapshot.occurrences] : [];
				// Cut from the end so the earlier offsets stay valid.
				occurrences.sort((a, b) => (Number(b?.offset) || 0) - (Number(a?.offset) || 0));
				for (const occurrence of occurrences) {
					const offset = occurrence?.offset;
					const length = occurrence?.length;
					if (typeof offset !== "number" || typeof length !== "number" || offset < 0 || length < 0 || offset + length > text.length) continue;
					text = text.slice(0, offset) + text.slice(offset + length);
				}
				return text.trim() !== "";
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
		 * @param {string} [boundary] - a model-facing preamble added once, ahead
		 *   of the first quote in a seeded thread.
		 * @returns {Promise<boolean>} whether the draft was written.
		 */
		/**
		 * Put the quote into a side thread's composer the way the main composer
		 * gets it: as an inline reference chip, not as the reader's own words. A
		 * plain blockquote draft reads like something *they* typed and would be
		 * sent as their message; a chip visibly belongs to the plugin's reference
		 * source, and the host's send path turns it back into the wire form.
		 * Falls back to the blockquote only when the shell has no chip face.
		 */
		async function prefillQuoteDraft(threadId, text, code, path, lang, meta) {
			const boundary = meta !== null && meta !== undefined && typeof meta.boundary === "string" ? meta.boundary : "";
			for (let attempt = 0; attempt < 25; attempt += 1) {
				const shell = inputShell(threadId);
				if (shell !== null && shell !== undefined) {
					const entry = insertionFace(threadId, shell);
					if (entry !== null && insertChip(entry, threadId, text, "", code === true, meta)) return true;
					// The text fallback appends: a second quote on the same thread must
					// not wipe the draft the first one left behind.
					const current = shellDraft(shell);
					const kept = current === null ? "" : current.replace(/\s+$/u, "");
					const prefix = boundary !== "" && kept.includes(boundary) === false ? boundary + "\n\n" : "";
					const plain = sideQuestion(text, code === true, path, lang);
					if (writeDraft(shell, kept === "" ? prefix + plain : kept + "\n\n" + prefix + plain)) return true;
					console.warn("[ui-quote] sidechat shell has no draft face");
					noteFailure("sidechat", "the side thread's shell has no draft face");
					return false;
				}
				await sleep(200);
			}
			noteFailure("sidechat", "the side thread's composer did not mount in 5s");
			return false;
		}

		async function prefillDraft(sessionId, text, boundary) {
			for (let attempt = 0; attempt < 25; attempt += 1) {
				const shell = inputShell(sessionId);
				if (shell !== null && shell !== undefined) {
					const current = shellDraft(shell);
					const kept = current === null ? "" : current.replace(/\s+$/u, "");
					const prefix = typeof boundary === "string" && boundary !== "" && kept.includes(boundary) === false ? boundary + "\n\n" : "";
					const next = kept === "" ? prefix + text : kept + "\n\n" + prefix + text;
					if (writeDraft(shell, next)) return true;
					console.warn("[ui-quote] sidechat shell has no draft face");
					noteFailure("sidechat", "the side thread's shell has no draft face");
					return false;
				}
				await sleep(200);
			}
			noteFailure("sidechat", "the side thread's composer did not mount in 5s");
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
		 * @param {boolean} [code] - true when the quote is code (preview/terminal).
		 * @param {string | null} [path] - the file a preview quote came from.
		 * @returns {Promise<void>} resolves once the draft is written or refused.
		 */
		function sideChatRequest(service, sessionId, text, code, path, lang, mode, quoteKey) {
			if (typeof sessionId !== "string" || sessionId === "" || typeof text !== "string" || text.trim() === "") {
				return Promise.resolve();
			}
			const running = sideChatPending.get(sessionId);
			if (running !== undefined) return running;
			const title = sideChatTitle(text);
			const pending = (async () => {
				// "new" always starts another thread; otherwise the quote's own
				// thread wins, and the session's default is the fallback.
				const bound = typeof quoteKey === "string" && quoteKey !== "" ? threadForQuote(sessionId, quoteKey) : null;
				const known = mode === "new" ? null : bound ?? storedSideThread(sessionId);
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
				if (typeof quoteKey === "string" && quoteKey !== "") rememberQuoteThread(sessionId, quoteKey, childId);
				const threadId = await displayedThreadId(sessionId, childId);
				rememberSideThread(sessionId, threadId);
				if (!(await prefillDraft(threadId, sideQuestion(text, code === true, path, lang)))) {
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

		/** Click/shortcut entry: the async chain must never reject into the void. */
		function startSideChat(mode) {
			void openSideChat(mode).catch((error) => {
				console.warn("[ui-quote] the side-chat action failed:", error);
				noteFailure("sidechat", "the side-chat action failed: " + (error instanceof Error ? error.message : String(error)));
				toast(translateFor(null, "sideChatFailed"));
			});
		}

		/**
		 * 侧边对话: drop the selection and open the session's side thread.
		 *
		 * The chain is deliberate: the plugin's own hidden thread first (no
		 * third-party plugin, no session-list row), a fork next, and
		 * better-sidebar only when the host has neither — or when the user asked
		 * for it explicitly. A hidden request that created a thread is `true`
		 * even if its composer failed; falling through would leave an orphan.
		 */
		async function openSideChat(mode) {
			const sessionId = state.sessionId;
			const text = state.quote;
			if (sessionId === null || text === null) return;
			const code = state.code;
			const path = state.path;
			const lang = state.lang;
			// The chip's own metadata: the file a preview/diff quote came from,
			// the reader's origin, and the wire coordinate (same shape `commit`
			// writes) so the side thread's chip still says where the quote came
			// from once it is sent there.
			const saved = state.source === null || state.source === undefined ? null : saveSource(plainOf(text), sessionId, state.source, { draft: true });
			const meta = {
				path,
				lang,
				origin: state.origin,
				...(saved === null
					? {}
					: {
							ref: {
								v: 1,
								s: saved.sessionId,
								a: saved.attr,
								k: saved.key,
								t: saved.turn,
								n: saved.n,
								...ROLE_CODES.has(saved.role) ? { r: saved.role } : {}
							}
						})
			};
			// `mode: "new"` stays a supported internal capability even though the
			// floating bar no longer offers a second entry for it; the service face
			// is still tested with it.
			const next = mode === "new" ? "new" : "reuse";
			const quoteKey = sourceKeyOf(text);
			close();
			// Kimi drops the transcript selection the moment an action is chosen.
			dropTranscriptSelection();
			if (config().sideChatBackend === "better") {
				const better = sideChatService();
				if (better !== null) {
					await sideChatRequest(better, sessionId, text, code, path, lang, next, quoteKey);
					return;
				}
			}
			if (builtinSideChatState !== "unavailable") {
				const handled = await hiddenSideChatRequest(sessionId, text, code, path, lang, next, quoteKey, meta);
				if (handled) return;
			}
			if (nativeSideChatAvailable()) {
				await nativeSideChatRequest(sessionId, text, code, path, lang, next, quoteKey, meta);
				return;
			}
			const better = sideChatService();
			if (better !== null) {
				await sideChatRequest(better, sessionId, text, code, path, lang, next, quoteKey);
				return;
			}
			toast(translateFor(sessionId, "sideChatFailed"));
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
			// Self-healing: `close()` suppresses the settle-timer refresh so the
			// gesture that dismissed the bar cannot reopen it. A fresh pointer
			// gesture is always a fresh intention.
			state.suppress = false;
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
			if (draftBars.size > 0) positionDraftBars();
			if (anchorLayer !== null) scheduleAnchors();
			if (state.mode === null) return;
			if (event !== undefined && insideBar(event.target)) return;
			if (state.mode === "comment") position();
			else close();
		}

		/**
		 * A window coming back is the moment to re-check a transcript it may have
		 * rendered while the plugin was reloading. Debounced: focus and
		 * visibilitychange usually arrive together.
		 */
		function onCapsuleWake() {
			if (typeof document !== "undefined" && document !== null && document.visibilityState !== undefined && document.visibilityState !== "visible") return;
			if (capsuleWakeTimer !== null) return;
			capsuleWakeTimer = setTimeout(() => {
				capsuleWakeTimer = null;
				rescanCapsules();
			}, 120);
		}

		/**
		 * Install the document listeners. Called once for the plugin's lifetime
		 * from `apply()`, never per slot: a counter kept them alive only while
		 * some overlay happened to be mounted, and one bad count removed them
		 * forever (the bar then stayed dead until a reload).
		 */
		function attachListeners() {
			if (listenersAttached) return;
			if (typeof document === "undefined" || typeof document.addEventListener !== "function") return;
			listenersAttached = true;
			document.addEventListener("selectionchange", onSelectionChange);
			document.addEventListener("keyup", onKeyUp, true);
			document.addEventListener("pointerdown", onPointerDown, true);
			document.addEventListener("pointerup", onPointerUp, true);
			document.addEventListener("pointercancel", onPointerUp, true);
			document.addEventListener("mousedown", onMouseDown, true);
			document.addEventListener("keydown", onKeyDown, true);
			document.addEventListener("scroll", onScrollOrResize, true);
			document.addEventListener("visibilitychange", onCapsuleWake);
			if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
				window.addEventListener("resize", onScrollOrResize);
				window.addEventListener("focus", onCapsuleWake);
			}
		}

		function detachListeners() {
			if (!listenersAttached) return;
			listenersAttached = false;
			document.removeEventListener("selectionchange", onSelectionChange);
			document.removeEventListener("keyup", onKeyUp, true);
			document.removeEventListener("pointerdown", onPointerDown, true);
			document.removeEventListener("pointerup", onPointerUp, true);
			document.removeEventListener("pointercancel", onPointerUp, true);
			document.removeEventListener("mousedown", onMouseDown, true);
			document.removeEventListener("keydown", onKeyDown, true);
			document.removeEventListener("scroll", onScrollOrResize, true);
			document.removeEventListener("visibilitychange", onCapsuleWake);
			if (capsuleWakeTimer !== null) {
				clearTimeout(capsuleWakeTimer);
				capsuleWakeTimer = null;
			}
			if (typeof window !== "undefined" && typeof window.removeEventListener === "function") {
				window.removeEventListener("resize", onScrollOrResize);
				window.removeEventListener("focus", onCapsuleWake);
			}
			close();
			state.pointerOnTranscript = false;
			state.suppress = false;
			if (state.bar !== null) {
				state.bar.remove();
				state.bar = null;
			}
			const toastNode = document.getElementById(TOAST_ID);
			if (toastNode !== null) toastNode.remove();
			const styleNode = document.getElementById(STYLE_ID);
			if (styleNode !== null) styleNode.remove();
		}

		/** One mount now needs the shared install; the first one builds it. */
		function holdRuntime() {
			runtimeHolders += 1;
			if (runtimeHolders > 1) return;
			capsuleDisposer = installCapsules();
			attachListeners();
		}

		/** The last mount to leave tears the shared install down. */
		function releaseRuntime() {
			runtimeHolders = Math.max(0, runtimeHolders - 1);
			if (runtimeHolders > 0) return;
			const dispose = capsuleDisposer;
			capsuleDisposer = null;
			if (typeof dispose === "function") {
				try {
					dispose();
				} catch (error) {
					// Unloading is best-effort; the page is going away.
				}
			}
			detachListeners();
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
				return () => {
					if (sessions.get(sessionId) === entry) sessions.delete(sessionId);
				};
			}, [props.sessionId]);

			return null;
		}

		/* ------------------------------------------------------------------ *
		 * 引用清单 — the list page
		 *
		 * The one place where a quote is an object rather than a gesture: every
		 * quote the session has sent, read back out of the session's own event
		 * log (a sent message is plain text, so its `> ❝ …` block is the record),
		 * filtered by a search box, jumped back to its source, exported as
		 * Markdown. The page is contributed to the right sidebar as a page type,
		 * so it lives where the other panels live.
		 * ------------------------------------------------------------------ */

		/** Where the quote list's one quiet Star link points. */
		const REPO_URL = "https://github.com/BangBang-03/dsh-client-ui-quote";

		const PANEL_STYLE_TEXT = `
.dshq-list{box-sizing:border-box;display:flex;flex-direction:column;gap:8px;height:100%;padding:10px 12px;
font-family:var(--dshq-font,inherit);font-size:12.5px;line-height:1.55;color:var(--dshq-fg,inherit);
-webkit-app-region:no-drag}
.dshq-list-head{display:flex;flex-direction:column;gap:6px}
.dshq-list-search{width:100%;box-sizing:border-box;padding:5px 8px;border-radius:7px;
border:1px solid var(--dshq-border,rgba(127,127,127,.34));background:transparent;color:inherit;font:inherit}
.dshq-list-bar{display:flex;align-items:center;gap:8px}
.dshq-list-count{opacity:.7;white-space:nowrap}
.dshq-list-btn{margin-left:auto;padding:3px 9px;border-radius:6px;font:inherit;font-size:11.5px;cursor:pointer;
border:1px solid var(--dshq-border,rgba(127,127,127,.34));background:transparent;color:inherit;opacity:.85}
.dshq-list-btn:hover{opacity:1}
.dshq-list-btn:disabled{opacity:.4;cursor:default}
.dshq-list-body{flex:1 1 auto;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:8px}
.dshq-list-note{opacity:.65;padding:10px 2px}
.dshq-list-health{font-size:10.5px;opacity:.5;padding:0 2px}
.dshq-list-star{font-size:10.5px;opacity:.5;padding:0 2px}
.dshq-list-star a{color:inherit;text-decoration:none}
.dshq-list-star a:hover{text-decoration:underline}
/* Scoped under the page root: .dshq-row is also the floating bar's row class,
and an unscoped column direction here turned the bar into a vertical stack the
moment this page was registered. */
.dshq-list .dshq-row{display:flex;flex-direction:column;gap:3px;padding:7px 9px;border-radius:8px;
border:1px solid transparent;background:color-mix(in srgb,currentColor 5%,transparent)}
.dshq-list .dshq-row[data-dshq-row="jumpable"]{cursor:pointer}
.dshq-list .dshq-row[data-dshq-selectable="true"]{position:relative;padding-left:28px}
.dshq-list .dshq-row-check{position:absolute;left:7px;top:8px;margin:0;width:13px;height:13px;accent-color:var(--dshq-accent,#3b82f6)}
.dshq-list .dshq-row[data-dshq-row="jumpable"]:hover{border-color:var(--dshq-border,rgba(127,127,127,.34))}
.dshq-list .dshq-row-quote{white-space:pre-wrap;overflow-wrap:anywhere}
.dshq-list .dshq-row-code{font-family:ui-monospace,SFMono-Regular,Consolas,"Liberation Mono",Menlo,monospace;white-space:pre;overflow-x:auto}
.dshq-list .dshq-row-comment{white-space:pre-wrap;overflow-wrap:anywhere;opacity:.82;
border-left:2px solid color-mix(in srgb,currentColor 30%,transparent);padding-left:7px}
.dshq-list .dshq-row-source{padding:0;border:0;background:none;color:inherit;font:inherit;font-size:11px;
line-height:1.5;text-align:left;opacity:.62;overflow-wrap:anywhere;cursor:pointer}
.dshq-list .dshq-row-source:hover,.dshq-list .dshq-row-source:focus-visible{opacity:1;text-decoration:underline}
.dshq-list .dshq-row-foot{display:flex;align-items:center;gap:8px;font-size:11px;opacity:.6}
.dshq-list .dshq-list-threads{display:flex;flex-direction:column;gap:3px;margin-top:2px}
.dshq-list .dshq-list-thread-row{padding:2px 6px;border:1px solid transparent;border-radius:6px;
background:none;color:inherit;font:inherit;font-size:11px;line-height:1.5;text-align:left;cursor:pointer;
opacity:.75;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dshq-list .dshq-list-thread-row:hover,.dshq-list .dshq-list-thread-row:focus-visible{opacity:1;border-color:var(--dshq-border,rgba(127,127,127,.34))}
/* Review workbench: filter chips, per-row status, tags. Every rule stays
scoped under .dshq-list — the row class is shared with the floating bar and
must not be restyled from here. */
.dshq-list-filters{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.dshq-list .dshq-filter{padding:2px 9px;border-radius:99px;font:inherit;font-size:11px;cursor:pointer;
border:1px solid var(--dshq-border,rgba(127,127,127,.34));background:transparent;color:inherit;opacity:.8}
.dshq-list .dshq-filter:hover{opacity:1}
.dshq-list .dshq-filter[data-active="true"]{opacity:1;border-color:var(--dshq-accent,#3b82f6);
color:var(--dshq-accent,#3b82f6)}
.dshq-list .dshq-row[data-status="resolved"]{opacity:.55}
.dshq-list .dshq-row-status{padding:0;border:0;font:inherit;font-size:11px;cursor:pointer;background:none;
color:inherit;text-decoration:underline dotted;opacity:1}
.dshq-list .dshq-row-status[data-status="resolved"]{color:var(--dshq-accent,#3b82f6)}
.dshq-list .dshq-row-copy{padding:0;border:0;font:inherit;font-size:11px;cursor:pointer;background:none;
color:inherit;text-decoration:underline dotted;opacity:1}
.dshq-list .dshq-row-tags{display:flex;flex-wrap:wrap;align-items:center;gap:5px}
.dshq-list .dshq-tag{display:inline-flex;align-items:center;gap:2px;border-radius:99px;
border:1px solid color-mix(in srgb,currentColor 30%,transparent);padding:0 2px 0 7px;font-size:10.5px}
.dshq-list .dshq-tag-label,.dshq-list .dshq-tag-x{padding:0;border:0;font:inherit;font-size:inherit;
cursor:pointer;background:none;color:inherit}
.dshq-list .dshq-tag-x{opacity:.55;padding:0 4px}
.dshq-list .dshq-tag-x:hover{opacity:1}
.dshq-list .dshq-tag-input{width:110px;padding:1px 6px;border-radius:99px;font:inherit;font-size:10.5px;
border:1px solid var(--dshq-border,rgba(127,127,127,.34));background:transparent;color:inherit}
.dshq-list .dshq-tag-add{padding:0 7px;border-radius:99px;font:inherit;font-size:10.5px;cursor:pointer;
border:1px dashed var(--dshq-border,rgba(127,127,127,.34));background:transparent;color:inherit;opacity:.7}
.dshq-list .dshq-tag-add:hover{opacity:1}
.dshq-list-thread{display:flex;flex-direction:column;gap:6px;padding-top:8px;
border-top:1px solid color-mix(in srgb,currentColor 18%,transparent)}
.dshq-list-thread .dshq-list-btn{margin-left:0}
.dshq-list-thread .dshq-list-btn:last-child{margin-left:auto}
`;

		/** The panel's own stylesheet, installed with the page (not with capsules). */
		function installPanelStyle() {
			if (typeof document === "undefined") return () => {};
			const existing = document.getElementById(PANEL_STYLE_ID);
			if (existing !== null) return () => {};
			// `id` goes on as an attribute: that is what `getElementById` reads,
			// and the same call shape the capsule stylesheet uses.
			const style = el(document, "style", { id: PANEL_STYLE_ID, "data-plugin": "dsh-client-ui-quote" });
			style.textContent = PANEL_STYLE_TEXT;
			const host = document.head === undefined || document.head === null ? document.documentElement : document.head;
			if (host !== null && host !== undefined) host.append(style);
			return () => {
				if (typeof style.remove === "function") style.remove();
				else if (style.parentNode !== null && style.parentNode !== undefined) style.parentNode.removeChild(style);
			};
		}

		/** The first line of a quote, clipped — what a list row and a heading show. */
		function firstLineOf(text, limit) {
			const line = String(text === null || text === undefined ? "" : text).split("\n")[0].trim();
			const cap = typeof limit === "number" && limit > 0 ? limit : 60;
			return line.length <= cap ? line : line.slice(0, cap - 1) + "…";
		}

		/** An event timestamp as a short local string; an unreadable one stays empty. */
		function formatQuoteTime(value) {
			if (typeof value !== "string" || value === "") return "";
			const parsed = new Date(value);
			if (Number.isNaN(parsed.getTime())) return "";
			const pad = (number) => String(number).padStart(2, "0");
			return parsed.getFullYear() + "-" + pad(parsed.getMonth() + 1) + "-" + pad(parsed.getDate()) + " " +
				pad(parsed.getHours()) + ":" + pad(parsed.getMinutes());
		}

		/**
		 * The list's only data source: the session's own event log. A user message
		 * carries its text blocks on `event.data` itself (not `data.message` — the
		 * host freezes the record for `user/message`), and a quote is a `> ❝ …`
		 * block inside that text, so the parser the transcript already uses is the
		 * right one here too. Newest first, because the newest quote is the one
		 * the reader is working on.
		 *
		 * @returns {{ id: string, seq: number, time: string, quote: string, comment: string, ref?: object }[]}
		 *   Newest first. `ref` is present only when the message itself carried one.
		 */
		function quoteRowsFromEntries(entries) {
			const rows = [];
			const list = Array.isArray(entries) ? entries : [];
			for (const entry of list) {
				if (entry === null || entry === undefined || entry.type !== "event") continue;
				const event = entry.event;
				if (event === null || event === undefined || event.type !== "user/message") continue;
				const data = event.data;
				if (data === null || typeof data !== "object" || !Array.isArray(data.content)) continue;
				const text = data.content
					.filter((block) => block !== null && block !== undefined && block.type === "text" && typeof block.text === "string")
					.map((block) => block.text)
					.join("");
				const segments = splitQuoteRuns(text);
				if (segments === null) continue;
				for (const segment of segments) {
					if (segment.type !== "quote") continue;
					const row = {
						id: typeof data.id === "string" ? data.id : "",
						seq: Number.isSafeInteger(Number(event.seq)) ? Number(event.seq) : 0,
						time: typeof event.time === "string" ? event.time : "",
						quote: segment.quote,
						comment: typeof segment.comment === "string" ? segment.comment : "",
						code: segment.code !== null && segment.code !== undefined,
						// The fence's info string (a preview quote carries its file
						// there) — the export puts it back on its own fence line.
						fence: typeof segment.code === "string" ? segment.code : ""
					};
					// The ref rides along when the message carried one; older
					// messages keep exactly the shape they had.
					if (segment.ref !== undefined) row.ref = segment.ref;
					rows.push(row);
				}
			}
			rows.reverse();
			return rows;
		}

		/** Case-insensitive free text over both halves of a quote. */
		function filterQuoteRows(rows, query) {
			const needle = String(query === null || query === undefined ? "" : query).trim().toLowerCase();
			const list = Array.isArray(rows) ? rows : [];
			if (needle === "") return list.slice();
			return list.filter((row) => (row.quote + "\n" + row.comment).toLowerCase().includes(needle));
		}

		/**
		 * One quote as Markdown you can paste somewhere else — a PR comment, an
		 * issue, another chat. The list export keeps its numbered layout; this is
		 * the single-row unit it is built from, and the copy button's payload.
		 * A code quote stays a real fenced block (a preview quote's file rides in
		 * the info string); everything else is a blockquote. The provenance line
		 * is the same human-readable `引自第 N 轮 · 助手` the wire carries.
		 *
		 * @param {object} row - one row from `quoteRowsFromEntries`.
		 * @returns {string} Markdown for that quote alone.
		 */
		function quoteRowMarkdown(row) {
			if (row === null || row === undefined) return "";
			const lines = [];
			if (row.code === true) {
				// The fence must not collide with the body: a quote that itself
				// contains ``` (written with ~~~ on the wire) would end the block
				// early. Pick the other one, exactly like the wire writer does.
				const fence = String(row.quote).split("\n").some((line) => /^\s*```/u.test(line)) ? "~~~" : "```";
				const info = typeof row.fence === "string" && row.fence !== "" ? " " + row.fence : "";
				lines.push(fence + info, String(row.quote), fence);
			} else {
				for (const line of String(row.quote).split("\n")) lines.push("> " + line);
			}
			if (typeof row.comment === "string" && row.comment !== "") lines.push("", "**评论**：" + row.comment);
			const label = row.ref === undefined || row.ref === null ? "" : wireSourceLabel(row.ref);
			const when = formatQuoteTime(row.time);
			const meta = [label, when].filter((part) => typeof part === "string" && part !== "");
			if (meta.length > 0) lines.push("", "_" + meta.join(" · ") + "_");
			return lines.join("\n");
		}

		/** The list as Markdown: numbered sections, the quote as a blockquote. */
		function quoteListMarkdown(rows, header) {
			const list = Array.isArray(rows) ? rows : [];
			const title = String(header === null || header === undefined || header === "" ? "引用清单" : header);
			const lines = ["# " + title, ""];
			if (list.length === 0) {
				lines.push("_（还没有引用）_", "");
				return lines.join("\n");
			}
			list.forEach((row, index) => {
				// Review marks ride on the heading: resolved + tags, only when the
				// row actually carries them, so a meta-less export reads as before.
				const meta = quoteMetaFor(row);
				const marks = [];
				if (meta.status === "resolved") marks.push("已解决");
				for (const tag of meta.tags) marks.push("#" + tag);
				lines.push("## " + (index + 1) + ". " + firstLineOf(row.quote, 80) + (marks.length === 0 ? "" : "　" + marks.join(" ")), "");
				// A code quote exports as a real fenced block, not a blockquote; a
				// preview quote's file rides in the info string, as it did on the wire.
				// The fence flips to ~~~ when the body itself contains ```.
				if (row.code === true) {
					const fence = String(row.quote).split("\n").some((line) => /^\s*```/u.test(line)) ? "~~~" : "```";
					const info = typeof row.fence === "string" && row.fence !== "" ? " " + row.fence : "";
					lines.push(fence + info, String(row.quote), fence, "");
				} else {
					for (const line of String(row.quote).split("\n")) lines.push("> " + line);
					lines.push("");
				}
				if (row.comment !== "") {
					lines.push("**评论**：" + row.comment, "");
				}
				const when = formatQuoteTime(row.time);
				lines.push("_第 " + (row.seq === 0 ? "?" : row.seq) + " 条事件" + (when === "" ? "" : " · " + when) + "_", "");
			});
			return lines.join("\n");
		}

		/**
		 * Every message of a session, oldest first. A user message keeps its text
		 * blocks on `event.data`; every other role keeps them on `event.data.message`
		 * (the host freezes the record itself for `user/message` only), and a
		 * message with no text at all — a tool call, an attachment-only turn — is
		 * not something a thread summary can use.
		 *
		 * @returns {{ seq: number, time: string, role: "user" | "assistant", text: string }[]}
		 */
		function sessionMessagesFromEntries(entries) {
			const messages = [];
			const list = Array.isArray(entries) ? entries : [];
			for (const entry of list) {
				if (entry === null || entry === undefined || entry.type !== "event") continue;
				const event = entry.event;
				if (event === null || event === undefined || typeof event !== "object") continue;
				const kind = event.type;
				if (kind !== "user/message" && kind !== "assistant/message") continue;
				const record = kind === "user/message" ? event.data : event.data === null || event.data === undefined ? null : event.data.message;
				if (record === null || typeof record !== "object" || !Array.isArray(record.content)) continue;
				const text = record.content
					.filter((block) => block !== null && block !== undefined && block.type === "text" && typeof block.text === "string")
					.map((block) => block.text)
					.join("");
				if (text.trim() === "") continue;
				messages.push({
					seq: Number.isSafeInteger(Number(event.seq)) ? Number(event.seq) : 0,
					time: typeof event.time === "string" ? event.time : "",
					role: kind === "user/message" ? "user" : "assistant",
					text
				});
			}
			return messages;
		}

		/**
		 * The exchange a thread ends on: the last question asked in it and the
		 * answer that followed. That pair is what "take it back to the session"
		 * means — the quote, the question and the conclusion — not the whole log.
		 */
		function threadConclusion(messages, limit) {
			const list = Array.isArray(messages) ? messages : [];
			let questionIndex = -1;
			for (let index = list.length - 1; index >= 0; index -= 1) {
				if (list[index].role === "user") {
					questionIndex = index;
					break;
				}
			}
			let answer = "";
			for (let index = list.length - 1; index > questionIndex; index -= 1) {
				if (list[index].role === "assistant") {
					answer = list[index].text;
					break;
				}
			}
			const question = questionIndex === -1 ? "" : list[questionIndex].text;
			const cap = typeof limit === "number" && limit > 0 ? limit : THREAD_LIMIT;
			let text = question === "" ? "" : "> " + question.split("\n").join("\n> ") + "\n\n";
			text += answer;
			text = text.trim();
			if (text.length > cap) text = text.slice(0, cap) + "\n…（截断）";
			return { question, answer, text };
		}

		/** The whole thread as Markdown: one section per message, in order. */
		function threadMarkdown(messages, header) {
			const list = Array.isArray(messages) ? messages : [];
			const title = String(header === null || header === undefined || header === "" ? "侧边线程" : header);
			const lines = ["# " + title, ""];
			if (list.length === 0) {
				lines.push("_（还没有内容）_", "");
				return lines.join("\n");
			}
			list.forEach((message, index) => {
				lines.push("## " + (index + 1) + ". " + (message.role === "user" ? "我" : "助手"), "");
				lines.push(message.text, "");
				const when = formatQuoteTime(message.time);
				if (when !== "") lines.push("_" + when + "_", "");
			});
			return lines.join("\n");
		}

		/** Stable identity of one list row, for the multi-select set. */
		function quoteRowKey(row) {
			return String(row.id === undefined || row.id === null ? "" : row.id) + "|" + String(row.seq === undefined || row.seq === null ? "" : row.seq) + "|" + String(row.quote).slice(0, 40);
		}

		/** One list row: the quote, its comment, and whether it can be traced back. */
		function quoteRowElement(react, row, index, sessionId, onJump, selection, review, copy) {
			const ref = row.ref === undefined ? null : row.ref;
			const jumpable = sourceCandidatesFor(row.quote, sessionId, ref).length > 0;
			const lost = jumpable && lostJumps.has(capsuleJumpKey(row.quote, sessionId, ref));
			const stop = (event) => {
				if (event !== null && event !== undefined && typeof event.stopPropagation === "function") event.stopPropagation();
			};
			const status = review !== null && review !== undefined && review.status === "resolved" ? "resolved" : "open";
			const children = [];
			if (selection !== null && selection !== undefined) {
				children.push(
					react.createElement("input", {
						key: "select",
						type: "checkbox",
						className: "dshq-row-check",
						checked: selection.checked === true,
						"aria-label": translateFor(sessionId, "panelSelect"),
						onClick: stop,
						onKeyDown: stop,
						onChange: () => {
							if (typeof selection.onToggle === "function") selection.onToggle(row);
						}
					})
				);
			}
			children.push(
				react.createElement("div", {
					className: "dshq-row-quote" + (row.code === true ? " dshq-row-code" : ""),
					key: "quote"
				}, QUOTE_MARK + " " + row.quote)
			);
			if (row.comment !== "") {
				children.push(react.createElement("div", { className: "dshq-row-comment", key: "comment" }, row.comment));
			}
			const source = row.code === true ? parseCodeSource(row.fence) : null;
			const kind = originLabel(sessionId, sourceFor(plainOf(row.quote))?.origin ?? "");
			if (source !== null) {
				const pathLabel = (kind === "" ? "" : kind + " · ") + formatCodeSource(source);
				children.push(
					react.createElement(
						"button",
						{
							key: "source",
							type: "button",
							className: "dshq-row-source",
							title: translateFor(sessionId, "openFile"),
							"aria-label": translateFor(sessionId, "openFile") + ": " + pathLabel,
							onClick: (event) => {
								stop(event);
								openCodeSource({ sessionId, path: row.fence });
							},
							onKeyDown: stop
						},
						pathLabel + " \u2197"
					)
				);
			}
			if (review !== null && review !== undefined) {
				const tagNodes = (Array.isArray(review.tags) ? review.tags : []).map((tag) =>
					react.createElement("span", { className: "dshq-tag", key: "tag-" + tag }, [
						react.createElement(
							"button",
							{
								key: "label",
								type: "button",
								className: "dshq-tag-label",
								onClick: (event) => {
									stop(event);
									if (typeof review.onFilterTag === "function") review.onFilterTag(tag);
								}
							},
							"#" + tag
						),
						react.createElement(
							"button",
							{
								key: "x",
								type: "button",
								className: "dshq-tag-x",
								"aria-label": String(translateFor(sessionId, "tagRemove")).replace("{tag}", tag),
								onClick: (event) => {
									stop(event);
									if (typeof review.onRemoveTag === "function") review.onRemoveTag(tag);
								}
							},
							"×"
						)
					])
				);
				if (review.editingTag === true) {
					tagNodes.push(
						react.createElement("input", {
							key: "tag-input",
							className: "dshq-tag-input",
							value: review.tagDraft === undefined ? "" : review.tagDraft,
							placeholder: translateFor(sessionId, "tagPlaceholder"),
							autoFocus: true,
							onClick: stop,
							onChange: (event) => {
								if (typeof review.onTagDraft === "function") review.onTagDraft(event === null || event === undefined || event.target === undefined ? "" : event.target.value);
							},
							onKeyDown: (event) => {
								stop(event);
								if (event.key === "Enter") {
									if (typeof event.preventDefault === "function") event.preventDefault();
									if (typeof review.onCommitTag === "function") review.onCommitTag();
								} else if (event.key === "Escape") {
									if (typeof event.preventDefault === "function") event.preventDefault();
									if (typeof review.onCancelTag === "function") review.onCancelTag();
								}
							}
						})
					);
				} else if ((Array.isArray(review.tags) ? review.tags : []).length < QUOTE_TAG_LIMIT) {
					tagNodes.push(
						react.createElement(
							"button",
							{
								key: "tag-add",
								type: "button",
								className: "dshq-tag-add",
								onClick: (event) => {
									stop(event);
									if (typeof review.onAddTag === "function") review.onAddTag();
								}
							},
							translateFor(sessionId, "tagAdd")
						)
					);
				}
				children.push(react.createElement("div", { className: "dshq-row-tags", key: "tags" }, tagNodes));
			}
			const when = formatQuoteTime(row.time);
			const footChildren = [react.createElement("span", { key: "when" }, when === "" ? "" : when)];
			if (review !== null && review !== undefined) {
				footChildren.push(
					react.createElement(
						"button",
						{
							key: "status",
							type: "button",
							className: "dshq-row-status",
							"data-status": status,
							title: translateFor(sessionId, status === "resolved" ? "statusToOpen" : "statusToResolved"),
							onClick: (event) => {
								stop(event);
								if (typeof review.onToggleStatus === "function") review.onToggleStatus();
							}
						},
						translateFor(sessionId, status === "resolved" ? "statusResolved" : "statusOpen")
					)
				);
			}
			footChildren.push(react.createElement("span", { key: "jump" }, jumpable ? translateFor(sessionId, lost ? "sourceLost" : "jump") : ""));
			// One quote in Markdown, ready to paste outside this plugin — the
			// capability every surveyed tool has and this list did not.
			if (copy !== null && copy !== undefined) {
				footChildren.push(
					react.createElement(
						"button",
						{
							key: "copy",
							type: "button",
							className: "dshq-row-copy",
							title: translateFor(sessionId, "copy"),
							onClick: (event) => {
								stop(event);
								if (typeof copy.onCopy === "function") copy.onCopy(row);
							},
							onKeyDown: stop
						},
						translateFor(sessionId, copy.copied === true ? "copied" : "copy")
					)
				);
			}
			children.push(react.createElement("div", { className: "dshq-row-foot", key: "foot" }, footChildren));
			return react.createElement(
				"div",
				{
					className: "dshq-row",
					key: String(row.seq) + "-" + String(index),
					role: "button",
					tabIndex: 0,
					"data-dshq-row": jumpable ? "jumpable" : "plain",
					"data-dshq-lost": lost ? "true" : null,
					"data-dshq-selectable": selection === null || selection === undefined ? null : "true",
					"data-status": review === null || review === undefined ? null : status,
					onClick: () => {
						if (jumpable && typeof onJump === "function") onJump(row);
					},
					onKeyDown: (event) => {
						if (event.key !== "Enter" && event.key !== " ") return;
						if (!jumpable) return;
						event.preventDefault();
						if (typeof onJump === "function") onJump(row);
					}
				},
				children
			);
		}

		/**
		 * The page body. The host injects `useTabInfo`, the session id and the
		 * three capabilities this panel needs (`load`, `loadOlder`, `save`); the
		 * panel itself stays thin because everything it decides is a pure
		 * function above it (parse, filter, Markdown, one row's markup).
		 */
		function QuoteListBody(props) {
			const injected = props === null || props === undefined ? {} : props;
			const sessionId = injected.sessionId === undefined ? null : injected.sessionId;
			const [rows, setRows] = react.useState([]);
			const [status, setStatus] = react.useState("loading");
			const [query, setQuery] = react.useState("");
			const [hasMore, setHasMore] = react.useState(false);
			const [busy, setBusy] = react.useState(false);
			/** Row keys ticked for 插入所选; cleared when the search changes. */
			const [selected, setSelected] = react.useState(new Set());
			/** Review state, mirrored from the local store so React re-renders. */
			const [quoteMeta, setQuoteMeta] = react.useState(quoteMetaSnapshot());
			const [reviewOnly, setReviewOnly] = react.useState(false);
			const [tagFilter, setTagFilter] = react.useState("");
			const [tagEditing, setTagEditing] = react.useState("");
			const [tagDraft, setTagDraft] = react.useState("");
			/** The row whose copy button just fired, for its short "已复制" label. */
			const [copiedKey, setCopiedKey] = react.useState("");
			/** The session's side thread, as the footer needs it: null until read. */
			const [thread, setThread] = react.useState(null);
			const [threads, setThreads] = react.useState([]);
			const health = typeof injected.health === "function" ? injected.health() : null;

			const toggleSelected = (row) => {
				const key = quoteRowKey(row);
				setSelected((previous) => {
					const next = new Set(previous);
					if (next.has(key)) next.delete(key);
					else next.add(key);
					return next;
				});
			};

			/** Copy one quote as Markdown, then flash its button for a moment. */
			const copyRow = (row) => {
				writeClipboard(quoteRowMarkdown(row));
				const key = quoteRowKey(row);
				setCopiedKey(key);
				setTimeout(() => {
					setCopiedKey((previous) => (previous === key ? "" : previous));
				}, 1200);
			};

			const metaOf = (row) => quoteMeta.get(quoteMetaKeyOf(row)) ?? { status: "open", tags: [], at: 0 };
			const refreshMeta = () => setQuoteMeta(quoteMetaSnapshot());

			const toggleStatus = (row) => {
				setQuoteStatus(row, metaOf(row).status === "resolved" ? "open" : "resolved");
				refreshMeta();
			};
			const startTag = (row) => {
				setTagEditing(quoteMetaKeyOf(row));
				setTagDraft("");
			};
			const commitTag = (row) => {
				if (tagEditing !== quoteMetaKeyOf(row)) return;
				if (addQuoteTag(row, tagDraft)) refreshMeta();
				setTagEditing("");
				setTagDraft("");
			};
			const removeTag = (row, tag) => {
				if (removeQuoteTag(row, tag)) refreshMeta();
			};
			const resolveSelected = () => {
				const picked = rows.filter((row) => selected.has(quoteRowKey(row)));
				if (picked.length === 0) return;
				markRowsResolved(picked);
				refreshMeta();
				setSelected(new Set());
			};

			const accept = (result) => {
				if (result === null || result === undefined || result.ok !== true) {
					setRows([]);
					setHasMore(false);
					setStatus(result !== null && result !== undefined && result.reason === "no-sessions" ? "unavailable" : "failed");
					return;
				}
				setRows(Array.isArray(result.rows) ? result.rows : []);
				setHasMore(result.hasMore === true);
				setStatus("ready");
			};

			react.useEffect(() => {
				let live = true;
				if (typeof injected.load !== "function") {
					setStatus("unavailable");
					return () => {
						live = false;
					};
				}
				injected
					.load()
					.then((result) => {
						if (live) accept(result);
					})
					.catch(() => {
						if (live) setStatus("failed");
					});
				// The side thread is a second, independent read: the page is useful
				// without one (a session that never opened a thread has none).
				if (typeof injected.loadThread === "function") {
					injected
						.loadThread()
						.then((result) => {
							if (live) setThread(result === undefined ? null : result);
						})
						.catch(() => {
							if (live) setThread(null);
						});
				}
				// A session can hold one side thread per quote, so the footer
				// lists them all — each one reopenable in the right sidebar.
				if (typeof injected.loadThreads === "function") {
					injected
						.loadThreads()
						.then((result) => {
							if (live) setThreads(Array.isArray(result?.threads) ? result.threads : []);
						})
						.catch(() => {
							if (live) setThreads([]);
						});
				}
				return () => {
					live = false;
				};
			}, [sessionId]);

			const matched = filterQuoteRows(rows, query);
			const openCount = rows.filter((row) => metaOf(row).status !== "resolved").length;
			const tags = allQuoteTags(rows);
			let shown = matched;
			if (reviewOnly) shown = shown.filter((row) => metaOf(row).status !== "resolved");
			if (tagFilter !== "") shown = shown.filter((row) => metaOf(row).tags.includes(tagFilter));
			const filters = react.createElement("div", { className: "dshq-list-filters", key: "filters" }, [
				react.createElement(
					"button",
					{
						key: "review",
						type: "button",
						className: "dshq-filter",
						"data-active": reviewOnly ? "true" : null,
						onClick: () => setReviewOnly(!reviewOnly)
					},
					reviewOnly ? translateFor(sessionId, "reviewAll") : String(translateFor(sessionId, "reviewOnly")) + " (" + openCount + ")"
				),
				tagFilter === ""
					? null
					: react.createElement(
							"button",
							{ key: "clear-tag", type: "button", className: "dshq-filter", "data-active": "true", onClick: () => setTagFilter("") },
							translateFor(sessionId, "tagFilterClear")
						),
				tags.slice(0, 8).map(({ tag, count }) =>
					react.createElement(
						"button",
						{
							key: "tag-" + tag,
							type: "button",
							className: "dshq-filter dshq-filter-tag",
							"data-active": tagFilter === tag ? "true" : null,
							onClick: () => setTagFilter(tagFilter === tag ? "" : tag)
						},
						"#" + tag + " " + count
					)
				)
			]);
			const head = react.createElement("div", { className: "dshq-list-head", key: "head" }, [
				react.createElement("input", {
					key: "search",
					className: "dshq-list-search",
					type: "search",
					value: query,
					placeholder: translateFor(sessionId, "panelSearch"),
					onChange: (event) => {
						setQuery(event === null || event === undefined || event.target === undefined ? "" : event.target.value);
						setSelected(new Set());
					}
				}),
				react.createElement("div", { className: "dshq-list-bar", key: "bar" }, [
					react.createElement("span", { className: "dshq-list-count", key: "count" }, String(translateFor(sessionId, "panelCount")).replace("{n}", String(shown.length))),
					hasMore
						? react.createElement(
								"button",
								{
									key: "older",
									type: "button",
									className: "dshq-list-btn",
									disabled: busy,
									onClick: () => {
										if (typeof injected.loadOlder !== "function" || busy) return;
										setBusy(true);
										injected
											.loadOlder()
											.then((result) => {
												setBusy(false);
												accept(result);
											})
											.catch(() => {
												setBusy(false);
												setStatus("failed");
											});
									}
								},
								translateFor(sessionId, "panelLoadOlder")
							)
						: null,
					react.createElement(
						"button",
						{
							key: "export",
							type: "button",
							className: "dshq-list-btn",
							disabled: shown.length === 0,
							onClick: () => {
								if (typeof injected.save !== "function") return;
								injected.save(quoteListMarkdown(shown, translateFor(sessionId, "panelTitle")), "quotes-" + String(sessionId === null ? "session" : sessionId).replace(/[^\w-]/gu, "_") + ".md");
							}
						},
						translateFor(sessionId, "panelExport")
					),
					react.createElement(
						"button",
						{
							key: "exportJson",
							type: "button",
							className: "dshq-list-btn",
							disabled: shown.length === 0,
							onClick: () => {
								if (typeof injected.save !== "function") return;
								injected.save(quoteListJson(shown, sessionId, translateFor(sessionId, "panelTitle")), "quotes-" + String(sessionId === null ? "session" : sessionId).replace(/[^\w-]/gu, "_") + ".json");
							}
						},
						translateFor(sessionId, "panelExportJson")
					),
					typeof injected.insert === "function"
						? react.createElement(
								"button",
								{
									key: "insert",
									type: "button",
									className: "dshq-list-btn",
									disabled: busy || selected.size === 0,
									onClick: () => {
										if (busy || selected.size === 0) return;
										setBusy(true);
										const picked = rows.filter((row) => selected.has(quoteRowKey(row)));
										Promise.resolve(injected.insert(picked))
											.then(() => {
												setBusy(false);
												setSelected(new Set());
											})
											.catch(() => setBusy(false));
									}
								},
								translateFor(sessionId, "panelInsert") + (selected.size === 0 ? "" : " (" + selected.size + ")")
							)
						: null,
					react.createElement(
						"button",
						{
							key: "resolve",
							type: "button",
							className: "dshq-list-btn",
							disabled: selected.size === 0,
							onClick: () => {
								if (selected.size === 0) return;
								resolveSelected();
							}
						},
						translateFor(sessionId, "panelResolve") + (selected.size === 0 ? "" : " (" + selected.size + ")")
					)
				])
			]);

			let body = null;
			if (status === "unavailable") body = react.createElement("div", { className: "dshq-list-note", key: "note" }, translateFor(sessionId, "panelUnavailable"));
			else if (status === "failed") body = react.createElement("div", { className: "dshq-list-note", key: "note" }, translateFor(sessionId, "panelUnavailable"));
			else if (status === "loading") body = react.createElement("div", { className: "dshq-list-note", key: "note" }, "…");
			else if (shown.length === 0) body = react.createElement("div", { className: "dshq-list-note", key: "note" }, translateFor(sessionId, "panelEmpty"));
			else {
				body = react.createElement(
					"div",
					{ className: "dshq-list-body", key: "body" },
					shown.map((row, index) => {
						const meta = metaOf(row);
						const review = {
							status: meta.status,
							tags: meta.tags,
							editingTag: tagEditing === quoteMetaKeyOf(row),
							tagDraft,
							onToggleStatus: () => toggleStatus(row),
							onFilterTag: (tag) => setTagFilter(tagFilter === tag ? "" : tag),
							onRemoveTag: (tag) => removeTag(row, tag),
							onAddTag: () => startTag(row),
							onTagDraft: (value) => setTagDraft(value),
							onCommitTag: () => commitTag(row),
							onCancelTag: () => {
								setTagEditing("");
								setTagDraft("");
							}
						};
						return quoteRowElement(
							react,
							row,
							index,
							sessionId,
							(target) => {
								if (typeof injected.jump === "function") injected.jump(target.quote, sessionId, target.ref);
							},
							{
								checked: selected.has(quoteRowKey(row)),
								onToggle: toggleSelected
							},
							review,
							{
								copied: copiedKey !== "" && copiedKey === quoteRowKey(row),
								onCopy: copyRow
							}
						);
					})
				);
			}

			// The side thread this session opened (if any) gets its own footer:
			// the page is where a quote comes from, so it is also where the answer
			// it produced can be taken back from.
			const hasThread = thread !== null && thread !== undefined && thread.threadId !== null && thread.threadId !== undefined;
			const footer = react.createElement("div", { className: "dshq-list-thread", key: "thread" }, [
				react.createElement("div", { className: "dshq-list-bar", key: "bar" }, [
					react.createElement("span", { className: "dshq-list-count", key: "label" }, translateFor(sessionId, "threadSection")),
					hasThread ? react.createElement("span", { className: "dshq-list-count", key: "count" }, String(translateFor(sessionId, "threadCount")).replace("{n}", String(thread.count))) : null,
					hasThread
						? react.createElement(
								"button",
								{
									key: "back",
									type: "button",
									className: "dshq-list-btn",
									disabled: busy,
									onClick: () => {
										if (typeof injected.back !== "function" || busy) return;
										setBusy(true);
										injected
											.back()
											.then(() => setBusy(false))
											.catch(() => setBusy(false));
									}
								},
								translateFor(sessionId, "threadBack")
							)
						: null,
					hasThread
						? react.createElement(
								"button",
								{
									key: "export",
									type: "button",
									className: "dshq-list-btn",
									disabled: busy,
									onClick: () => {
										if (typeof injected.exportThread !== "function" || busy) return;
										setBusy(true);
										injected
											.exportThread()
											.then(() => setBusy(false))
											.catch(() => setBusy(false));
									}
								},
								translateFor(sessionId, "threadExport")
							)
						: null
				]),
				react.createElement(
					"div",
					{ className: "dshq-list-note", key: "note" },
					hasThread ? (thread.question === "" ? "" : thread.question) : translateFor(sessionId, "threadNone")
				),
				threads.length > 1
					? react.createElement(
							"div",
							{ className: "dshq-list-threads", key: "threads" },
							threads.map((item) =>
								react.createElement(
									"button",
									{
										key: item.threadId,
										type: "button",
										className: "dshq-list-thread-row",
										title: item.question,
										onClick: () => {
											if (typeof injected.openThread === "function") injected.openThread(item.threadId);
										}
									},
									translateFor(sessionId, "threadOpen") + " · " + (item.question === "" ? item.threadId : item.question)
								)
							)
						)
					: null,
					health === null
						? null
						: react.createElement(
								"div",
								{ className: "dshq-list-health", key: "health" },
								translateFor(sessionId, "healthLabel") +
									" · " +
									translateFor(sessionId, "healthToken") +
									(health.token === true ? " ✓" : " —") +
									" · " +
									translateFor(
										sessionId,
										health.sideChat === "builtin"
											? "healthSideBuiltin"
											: health.sideChat === "better"
												? "healthSideBetter"
												: health.sideChat === "native"
													? "healthSideNative"
													: "healthSideNone"
									)
							),
				// One quiet line: the only place a user of the plugin ever sees the
				// repository. It is a plain link, so the plugin itself still makes no
				// request — the browser opens it only when it is clicked.
				react.createElement(
					"div",
					{ className: "dshq-list-star", key: "star" },
					react.createElement(
						"a",
						{ href: REPO_URL, target: "_blank", rel: "noreferrer noopener" },
						"★ " + translateFor(sessionId, "starHint")
					)
				)
			]);

			return react.createElement("div", { className: "dshq-list" }, [filters, head, body, footer]);
		}

		/**
		 * Read the session's quotes. The log belongs to a Session that is not
		 * necessarily on screen, so it is retained for the read and released in
		 * the same breath: `sessions.retain` is the documented way in, and a
		 * reference that is never released would pin the session forever.
		 */
		/**
		 * Run one read against a session's log. The log belongs to a Session that
		 * is not necessarily on screen, so the reference is retained for the read
		 * and released in the same breath — a reference that is never released
		 * pins that session forever.
		 *
		 * @param {string | { parentSessionId: string, childSessionId: string, mode: string }} target -
		 *   a Session id, or the subagent address a hidden side thread needs.
		 * @returns {Promise<{ ok: boolean, reason: string, value?: any }>} the
		 *   read's own value, or why it could not run: `no-sessions` when the host
		 *   has no session service, `no-session` when the id resolves no binding,
		 *   `failed` when the host threw.
		 */
		async function withSession(target, read) {
			const sessions = serviceOf("sessions");
			if (sessions === null || sessions === undefined || typeof sessions.retain !== "function") {
				return { ok: false, reason: "no-sessions" };
			}
			let reference = null;
			try {
				reference = sessions.retain(target, { source: "quoteList" });
				if (reference !== null && reference !== undefined && reference.ready !== undefined) await reference.ready;
				const binding = reference === null || reference === undefined ? undefined : reference.binding;
				const session = binding === undefined || binding === null ? null : binding.session;
				if (session === null || session === undefined) return { ok: false, reason: "no-session" };
				return { ok: true, reason: "", value: await read(session) };
			} catch (error) {
				return { ok: false, reason: "failed" };
			} finally {
				if (reference !== null && reference !== undefined && typeof reference.release === "function") {
					try {
						reference.release();
					} catch (error) {
						// A reference that cannot be released is the host's business.
					}
				}
			}
		}

		/** The entries a session's log currently holds. */
		function entriesOf(session) {
			if (session === null || session === undefined || session.eventSource === undefined) return [];
			const snapshot = session.eventSource.getSnapshot();
			return snapshot === null || snapshot === undefined || !Array.isArray(snapshot.entries) ? [] : snapshot.entries;
		}

		/** Whether the log is windowed and can be paged further. */
		function hasMoreOf(session) {
			const snapshot = session !== null && session !== undefined && typeof session.getSnapshot === "function" ? session.getSnapshot() : null;
			return snapshot !== null && snapshot !== undefined && snapshot.hasMore === true;
		}

		/** Every quote this session has sent, newest first. */
		async function readQuoteRows(sessionId) {
			const read = await withSession(sessionId, (session) => ({ rows: quoteRowsFromEntries(entriesOf(session)), hasMore: hasMoreOf(session) }));
			if (read.ok !== true) return { ok: false, reason: read.reason, rows: [], hasMore: false };
			// The event log is the truth, but a context compaction can cut the
			// messages out of it; the local copy keeps the list complete.
			rememberIndexedQuotes(sessionId, read.value.rows);
			return { ok: true, reason: "", rows: mergeIndexedQuotes(sessionId, read.value.rows), hasMore: read.value.hasMore };
		}

		/** Where the local copy of a session's quotes lives. */
		const QUOTE_INDEX_KEY = "dsh-client-ui-quote:v1:quote-index";
		/** How many quotes one session keeps locally, and how many sessions. */
		const QUOTE_INDEX_PER_SESSION = 200;
		const QUOTE_INDEX_SESSIONS = 12;

		function readQuoteIndex() {
			try {
				const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(QUOTE_INDEX_KEY);
				if (typeof raw !== "string" || raw === "") return {};
				const parsed = JSON.parse(raw);
				return parsed !== null && typeof parsed === "object" ? parsed : {};
			} catch (error) {
				return {};
			}
		}

		function writeQuoteIndex(index) {
			try {
				if (typeof localStorage !== "undefined") localStorage.setItem(QUOTE_INDEX_KEY, JSON.stringify(index));
			} catch (error) {
				// A full or blocked storage must not break the list.
			}
		}

		/** Remember the quotes of a session, so the list survives a compaction. */
		function rememberIndexedQuotes(sessionId, rows) {
			if (typeof sessionId !== "string" || sessionId === "") return;
			const index = readQuoteIndex();
			const known = Array.isArray(index[sessionId]) ? index[sessionId].slice() : [];
			const seen = new Set(known.map((row) => quoteRowKey(row)));
			for (const row of Array.isArray(rows) ? rows : []) {
				if (row === null || row === undefined || typeof row.quote !== "string") continue;
				const key = quoteRowKey(row);
				if (seen.has(key)) continue;
				seen.add(key);
				known.push({
					id: typeof row.id === "string" ? row.id : "",
					seq: Number.isSafeInteger(Number(row.seq)) ? Number(row.seq) : 0,
					time: typeof row.time === "string" ? row.time : "",
					quote: row.quote,
					comment: typeof row.comment === "string" ? row.comment : "",
					code: row.code === true,
					fence: typeof row.fence === "string" ? row.fence : "",
					ref: row.ref === undefined || row.ref === null ? null : row.ref
				});
			}
			while (known.length > QUOTE_INDEX_PER_SESSION) known.shift();
			index[sessionId] = known;
			const sessions = Object.keys(index);
			while (sessions.length > QUOTE_INDEX_SESSIONS) delete index[sessions.shift()];
			writeQuoteIndex(index);
		}

		/** The local copy of a session's quotes. */
		function indexedQuotes(sessionId) {
			const index = readQuoteIndex();
			const rows = index[sessionId];
			return Array.isArray(rows) ? rows.slice() : [];
		}

		/** The event log's rows plus the local copy, newest first. */
		function mergeIndexedQuotes(sessionId, rows) {
			const list = Array.isArray(rows) ? rows.slice() : [];
			const seen = new Set(list.map((row) => quoteRowKey(row)));
			for (const row of indexedQuotes(sessionId)) {
				const key = quoteRowKey(row);
				if (seen.has(key)) continue;
				seen.add(key);
				list.push(row);
			}
			list.sort((a, b) => (Number(b.seq) || 0) - (Number(a.seq) || 0));
			return list;
		}

		/**
		 * The list as JSON: a versioned, machine-readable shape. Where the
		 * Markdown export is for reading, this one is for tooling — every quote
		 * carries its source coordinate, its file and its review state.
		 */
		function quoteListJson(rows, sessionId, header) {
			const list = Array.isArray(rows) ? rows : [];
			const payload = {
				kind: "dsh-client-ui-quote",
				version: 1,
				sessionId: typeof sessionId === "string" ? sessionId : null,
				title: typeof header === "string" ? header : "",
				exportedAt: new Date().toISOString(),
				count: list.length,
				quotes: list.map((row, index) => {
					const meta = quoteMetaFor(row);
					const ref = row.ref === undefined || row.ref === null ? null : row.ref;
					return {
						index: index + 1,
						quote: row.quote,
						comment: typeof row.comment === "string" ? row.comment : "",
						code: row.code === true,
						path: typeof row.fence === "string" && row.fence !== "" ? row.fence : null,
						source:
							ref === null
								? null
								: {
										sessionId: typeof ref.s === "string" ? ref.s : null,
										anchorAttr: typeof ref.a === "string" ? ref.a : null,
										anchorKey: typeof ref.k === "string" ? ref.k : null,
										turn: ref.t === undefined || ref.t === null ? null : ref.t,
										role: typeof ref.r === "string" ? ref.r : null
									},
						status: meta.status,
						tags: meta.tags,
						time: typeof row.time === "string" ? row.time : ""
					};
				})
			};
			return JSON.stringify(payload, null, 2);
		}

		/** Every message of a session, oldest first — a thread's own record. */
		async function readSessionMessages(threadId) {
			const read = await withSession(threadRetainTarget(threadId), (session) => ({ messages: sessionMessagesFromEntries(entriesOf(session)), hasMore: hasMoreOf(session) }));
			if (read.ok !== true) return { ok: false, reason: read.reason, messages: [], hasMore: false };
			return { ok: true, reason: "", messages: read.value.messages, hasMore: read.value.hasMore };
		}

		/** Pull one more page of history into the session, then read the list again. */
		async function loadOlderQuotes(sessionId) {
			await withSession(sessionId, async (session) => {
				if (typeof session.loadOlder === "function") await session.loadOlder();
				return null;
			});
			return readQuoteRows(sessionId);
		}

		/**
		 * The main session a side thread belongs to, or null when the id is not a
		 * thread we know. Our own memory and better-sidebar's are both keyed
		 * main → thread, so this reads them backwards; better-sidebar's entry is
		 * the binding its view actually recorded, ours is the fallback.
		 */
		function mainSessionForThread(threadId) {
			if (typeof threadId !== "string" || threadId === "") return null;
			const target = readThreadTargets()[threadId];
			if (target !== null && typeof target === "object" && typeof target.parentId === "string" && target.parentId !== "") return target.parentId;
			for (const key of [SIDE_THREAD_KEY, HOST_THREAD_KEY]) {
				const map = readThreadMap(key);
				if (map === null || typeof map !== "object") continue;
				for (const [mainId, value] of Object.entries(map)) {
					const stored = typeof value === "string" ? value : value === null || typeof value !== "object" ? "" : String(value.threadId === undefined ? "" : value.threadId);
					if (stored !== "" && stored === threadId) return mainId;
				}
			}
			return null;
		}

		/** How many side threads the page lists at once. */
		const THREAD_LIST_LIMIT = 5;

		/**
		 * Every side thread this session knows about: our own memory first, then
		 * the host's session list — a direct `origin: "subagent"` child whose
		 * title carries the shared `Side: ` prefix. The scan is what makes
		 * threads created by better-sidebar (or by an older build) visible here,
		 * and vice versa.
		 */
		function knownSideThreadIds(sessionId) {
			const known = sideThreadsOf(sessionId);
			const ids = [];
			if (typeof known.default === "string" && known.default !== "") ids.push(known.default);
			for (const value of Object.values(known.quotes)) {
				if (typeof value === "string" && value !== "" && ids.includes(value) === false) ids.push(value);
			}
			const sessions = serviceOf("sessions");
			const byId = sessions?.list?.getSnapshot?.()?.byId;
			if (byId === null || byId === undefined || typeof byId !== "object") return ids;
			const found = [];
			for (const summary of Object.values(byId)) {
				if (summary === null || typeof summary !== "object") continue;
				if (summary.origin !== "subagent" || summary.parentId !== sessionId) continue;
				const title = typeof summary.title === "string" && summary.title !== "" ? summary.title : summary.projectionValues?.subagent?.label;
				if (typeof title !== "string" || !title.startsWith(SIDECHAT_LABEL_PREFIX)) continue;
				found.push(summary);
			}
			found.sort((left, right) => (Number(right.updatedAt) || 0) - (Number(left.updatedAt) || 0));
			// Threads we already bind to this session are ours: stamp the current
			// shape version so a scan never demotes one into "replace on next
			// click". A thread only the scan knows about keeps no stamp (it may be
			// better-sidebar's, whose shape this build cannot vouch for).
			const bound = sideThreadsOf(sessionId);
			const mine = new Set(Object.values(bound.quotes));
			if (typeof bound.default === "string" && bound.default !== "") mine.add(bound.default);
			for (const summary of found) {
				const id = summary.id;
				if (typeof id !== "string" || id === "") continue;
				if (ids.includes(id) === false) ids.push(id);
				rememberThreadTarget(id, { kind: "hidden", parentId: sessionId, ...(mine.has(id) ? { v: HIDDEN_THREAD_VERSION } : {}) });
			}
			return ids;
		}

		/** The thread the page's footer highlights: the remembered one, else the newest. */
		function defaultThreadForSession(sessionId) {
			const stored = storedSideThread(sessionId);
			if (stored !== null) return stored;
			const ids = knownSideThreadIds(sessionId);
			return ids.length > 0 ? ids[0] : null;
		}

		/**
		 * Every side thread this session opened, with the question it ends on.
		 * A session can now have one thread per quote, so the footer lists them
		 * instead of showing only the last one.
		 */
		async function loadThreadList(sessionId) {
			const ids = knownSideThreadIds(sessionId);
			const threads = [];
			for (const threadId of ids.slice(0, THREAD_LIST_LIMIT)) {
				const read = await readSessionMessages(threadId);
				if (read.ok !== true) continue;
				const conclusion = threadConclusion(read.messages, THREAD_LIMIT);
				threads.push({ threadId, question: firstLineOf(conclusion.question, 80), count: read.messages.length });
			}
			return { ok: true, threads };
		}

		/** Open one of the session's side threads in the right sidebar. */
		function openThreadTab(sessionId, threadId) {
			if (typeof threadId !== "string" || threadId === "") return false;
			if (config().sideChatBackend === "better") {
				const service = sideChatService();
				if (service !== null) {
					try {
						service.openTab({ type: SIDECHAT_TAB, id: SIDECHAT_TAB + ":" + threadId, meta: { threadId } }, { sessionId });
						return true;
					} catch (error) {
						toast(translateFor(sessionId, "sideChatFailed"));
						return false;
					}
				}
			}
			if (openThreadTarget(sessionId, threadId)) return true;
			toast(translateFor(sessionId, "sideChatFailed"));
			return false;
		}

		/** What the page's side-thread footer shows: the question it ends on. */
		async function loadThreadSummary(sessionId) {
			const threadId = defaultThreadForSession(sessionId);
			if (threadId === null) return { ok: true, reason: "", threadId: null, question: "", count: 0 };
			const read = await readSessionMessages(threadId);
			if (read.ok !== true) return { ok: false, reason: read.reason, threadId, question: "", count: 0 };
			const conclusion = threadConclusion(read.messages, THREAD_LIMIT);
			return { ok: true, reason: "", threadId, question: firstLineOf(conclusion.question, 80), count: read.messages.length };
		}

		/**
		 * 带回主会话 — put the thread's conclusion into the main session's composer
		 * as a draft and stop there. Nothing is sent: the same rule the third row
		 * follows for the quote, applied to the answer it produced.
		 */
		async function bringThreadBack(sessionId) {
			const threadId = defaultThreadForSession(sessionId);
			if (threadId === null) {
				toast(translateFor(sessionId, "threadBackFailed"));
				return false;
			}
			const read = await readSessionMessages(threadId);
			const conclusion = read.ok === true ? threadConclusion(read.messages, THREAD_LIMIT) : null;
			if (conclusion === null || conclusion.text === "") {
				toast(translateFor(sessionId, "threadBackFailed"));
				return false;
			}
			const written = await prefillDraft(sessionId, conclusion.text);
			if (written !== true) {
				toast(translateFor(sessionId, "threadBackFailed"));
				return false;
			}
			toast(translateFor(sessionId, "threadBackDone"));
			return true;
		}

		/** The whole thread as a Markdown file. */
		async function exportThread(sessionId) {
			const threadId = defaultThreadForSession(sessionId);
			if (threadId === null) {
				toast(translateFor(sessionId, "threadBackFailed"));
				return false;
			}
			const read = await readSessionMessages(threadId);
			if (read.ok !== true || read.messages.length === 0) {
				toast(translateFor(sessionId, "threadBackFailed"));
				return false;
			}
			const markdown = threadMarkdown(read.messages, translateFor(sessionId, "threadSection"));
			const name = "thread-" + String(threadId).replace(/[^\w-]/gu, "_") + ".md";
			return downloadText(document, name, markdown);
		}

		/**
		 * Save text through the browser — the host exposes no file write to a
		 * client plugin, and this is the shipped answer (an anchor with `download`
		 * over an object URL).
		 */
		function downloadText(doc, filename, text) {
			if (doc === null || doc === undefined || typeof doc.createElement !== "function") return false;
			const hasBlob = typeof Blob === "function";
			const hasUrl = typeof URL !== "undefined" && URL !== null && typeof URL.createObjectURL === "function";
			const anchor = doc.createElement("a");
			if (hasBlob && hasUrl) {
				const href = URL.createObjectURL(new Blob([text], { type: MARKDOWN_MIME }));
				anchor.href = href;
				setTimeout(() => {
					try {
						URL.revokeObjectURL(href);
					} catch (error) {
						// A revoked-early URL only costs a re-download.
					}
				}, 10000);
			} else {
				anchor.href = "data:" + MARKDOWN_MIME + "," + encodeURIComponent(text);
			}
			anchor.download = filename;
			if (typeof anchor.click === "function") anchor.click();
			return true;
		}

		/** The sidebar services this page needs, or null when the host has none. */
		/** The right sidebar's navigation controller, when it can open resources. */
		function sidebarRightService() {
			if (pluginCtx === null) return null;
			let service = null;
			try {
				service = pluginCtx.get("sidebarRight");
			} catch (error) {
				service = null;
			}
			if (service === null || service === undefined || typeof service.openResource !== "function") return null;
			return service;
		}

		/**
		 * Open the file a code quote came from. The preview consumes the 1-based
		 * `line` as navigation params; a file that is already open is focused and
		 * receives a new navigation revision instead of a second tab.
		 */
		function openCodeSource(info) {
			const source = parseCodeSource(info === null || info === undefined ? null : info.path);
			if (source === null) return false;
			const service = sidebarRightService();
			if (service === null) {
				toast(translateFor(info.sessionId, "openFileFailed"));
				return false;
			}
			const address = fileAddressFor(info.sessionId, source.path);
			if (address === null) {
				toast(translateFor(info.sessionId, "openFileFailed"));
				return false;
			}
			try {
				service.openResource(address, source.line === null ? {} : { params: { line: source.line } });
				// The preview scrolls to the line itself; remembering the range
				// is what marks the quoted lines once the preview is on screen.
				setOpenedRange({ path: source.path, line: source.line, end: source.end });
				// The preview opens asynchronously: look again a few times.
				for (const delay of [120, 400, 900]) setTimeout(() => scheduleAnchors(), delay);
				return true;
			} catch (error) {
				toast(translateFor(info.sessionId, "openFileFailed"));
				return false;
			}
		}

		function quoteTabService() {
			const ctx = pluginCtx;
			if (ctx === null || ctx === undefined) return null;
			const read = (name) => {
				try {
					const value = typeof ctx.get === "function" ? ctx.get(name) : null;
					return value === undefined ? null : value;
				} catch (error) {
					return null;
				}
			};
			const tabs = read("sidebarRightTabs");
			const right = read("sidebarRight");
			if (tabs === null || typeof tabs.register !== "function") return null;
			if (right === null || typeof right.openTab !== "function") return null;
			return { tabs, right };
		}

		/** Open (or focus) the quote list page. */
		function openQuoteList() {
			const found = quoteTabService();
			if (found === null) {
				toast(translateFor(null, "panelUnavailable"));
				return false;
			}
			try {
				found.right.openTab(QUOTE_TAB_KIND);
				return true;
			} catch (error) {
				toast(translateFor(null, "panelUnavailable"));
				return false;
			}
		}

		/* ------------------------------------------------------------------ *
		 * Plugin entry
		 * ------------------------------------------------------------------ */

		const inject = ["slots", "locale"];

		/**
		 * Alt+Q / Alt+C / Alt+B on desktop; Web commands have no default binding.
		 * The host validates all profiles and rejects bare Alt Web defaults.
		 * With no live selection the command returns `pass`, so the key
		 * falls through to whoever else wanted it instead of being eaten.
		 */
		function shortcutDefaults(code) {
			return {
				"desktop:macos": { code, modifiers: ["alt"] },
				"desktop:windows": { code, modifiers: ["alt"] },
				"desktop:linux": { code, modifiers: ["alt"] }
			};
		}

		function registerShortcut(shortcuts, name, code, run) {
			const labels = { quote: "addToChat", comment: "comment", sidechat: "sideChat" };
			return shortcuts.register({
				id: "ui-quote." + name,
				label: () => translateFor(null, labels[name]),
				aliases: ["quote", name],
				defaults: shortcutDefaults(code),
				regions: ["page", "editable"],
				modals: [],
				resolve: () => {
					const found = readSelection();
					if (found === null) return { status: "pass" };
					return {
						status: "handled",
						run: () => {
							const range = lastSelectionRange;
							if (state.mode !== null) close();
							open(found, range);
							run();
						}
					};
				}
			});
		}

		/**
		 * A command with no precondition. The quote list is a place, not something
		 * done to a selection, so the key runs whenever it is pressed.
		 */
		function registerPlaceShortcut(shortcuts, name, code, labelKey, run) {
			return shortcuts.register({
				id: "ui-quote." + name,
				label: () => translateFor(null, labelKey),
				aliases: ["quote", name],
				defaults: shortcutDefaults(code),
				regions: ["page", "editable"],
				modals: [],
				resolve: () => ({ status: "handled", run })
			});
		}

		/**
		 * A small window onto the plugin: what it is showing, which switches are
		 * on, and which host services it can see. Support and the offline
		 * harness both read it; nothing here changes the plugin's behaviour.
		 */
		function installProbe() {
			if (typeof window === "undefined") return;
			const present = (name) => {
				if (pluginCtx === null) return false;
				try {
					const value = pluginCtx.get(name);
					return value !== undefined && value !== null;
				} catch (error) {
					return false;
				}
			};
			window.__dshQuote = {
				config: () => config(),
				setConfig: (patch) => setConfig(patch),
				state: () => ({
					quote: state.quote,
					mode: state.mode,
					code: state.code,
					path: state.path,
					lang: state.lang,
					sessionId: state.sessionId,
					chips: chipIndex.size,
					bars: draftBars.size
				}),
				probe: () => ({
					services: {
						inputTriggers: present("inputTriggers"),
						conversation: present("conversation"),
						sidebarRight: present("sidebarRight"),
						sidebarRightTabs: present("sidebarRightTabs"),
						betterSidebar: present("betterSidebar")
					},
					chips: chipIndex.size,
					bars: draftBars.size,
					sources: sourceIndex.size,
					nativeSideChat: nativeSideChatAvailable(),
					nativeSideChatPage: nativeSideChatReady,
					sideChatBuiltin: builtinSideChatState,
					sideChatBackend: sideChatBackend(),
					// The last step that refused, and how many times this page has
					// seen a refusal. Stages: source / insert / remove / sidechat.
					lastFailure: failureSnapshot(),
					running: { source: sourceRegistered, runtime: runtimeHolders }
				})
			};
		}

		function apply(ctx) {
			if (typeof document === "undefined") return;
			pluginCtx = ctx;
			loadPersistedChips();
			ctx.effect(() => ctx.locale.register(NS, { zh, en, ru }), "ui-quote: dictionaries");
			ctx.effect(() => {
				installProbe();
				return () => {};
			}, "ui-quote: probe");
			const installSource = (hostCtx) => hostCtx.effect(() => {
				holdSource();
				return releaseSource;
			}, "ui-quote: reference source");
			if (typeof ctx.inject === "function") ctx.inject(["inputTriggers"], installSource);
			else installSource(ctx);
			// The sent-message capsule lives outside the composer, so it is
			// installed with the plugin and not with a session's slot entry. The
			// bar's listeners are document singletons too, and must not depend on
			// any composer staying mounted. Both are shared by every mount of
			// this plugin, so they are refcounted instead of torn down per mount.
			ctx.effect(() => {
				holdRuntime();
				return releaseRuntime;
			}, "ui-quote: transcript runtime");
			// The three rows are also three keys. Without the service the menu
			// stays the only way in — nothing here is required to work.
			const installShortcuts = (hostCtx) => hostCtx.effect(() => {
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
					registerShortcut(shortcuts, "sidechat", "KeyB", () => startSideChat()),
					registerPlaceShortcut(shortcuts, "list", "KeyL", "panelTitle", () => openQuoteList())
				];
				return () => {
					for (const dispose of disposers) dispose();
				};
			}, "ui-quote: shortcuts");
			if (typeof ctx.inject === "function") ctx.inject(["shortcuts"], installShortcuts);
			else installShortcuts(ctx);
			// 引用清单 is a right-sidebar page: the type is declared once, the body
			// and the title register under the same id, and the guide entry is what
			// puts the page one click away on the sidebar's default page.
			//
			// The sidebar's tab registry can arrive after this plugin (bundles load
			// in list order, and the sidebar's own activation waits on its host
			// services), so the page is registered from inside an `inject`: that
			// callback runs when the services exist, however late that is. Doing it
			// eagerly in `apply` only was what left 引用清单 missing for the whole
			// session — and then Alt+L could only report that the sidebar was gone.
			const installQuoteTabPage = (hostCtx) =>
				hostCtx.effect(() => {
					const found = quoteTabService();
					if (found === null) return () => {};
					const disposers = [installPanelStyle()];
					try {
						disposers.push(
							found.tabs.register({
								id: QUOTE_TAB_ID,
								kind: QUOTE_TAB_KIND,
								title: () => translateFor(null, "panelTitle"),
								guide: [
									{
										id: "quotes",
										commandId: QUOTE_COMMAND,
										order: 20,
										title: () => translateFor(null, "panelTitle"),
										description: () => translateFor(null, "panelGuide")
									}
								]
							})
						);
					} catch (error) {
						// A kind another type already claimed is its owner's business.
					}
					disposers.push(
						ctx.slots.inject("sidebar.right.pane.tab", () =>
							ctx.slots.register(
								{
									name: "sidebar.right.pane.tab",
									key: QUOTE_TAB_ID,
									locale: NS,
									inject: (sessionId) => ({
										sessionId,
										load: () => readQuoteRows(sessionId),
										loadOlder: () => loadOlderQuotes(sessionId),
										jump: (quote, id, ref) => jumpToSource(quote, id, ref),
										insert: (rows) => insertQuoteRows(sessionId, rows),
										save: (text, filename) => downloadText(document, filename, text),
										loadThread: () => loadThreadSummary(sessionId),
										loadThreads: () => loadThreadList(sessionId),
										openThread: (threadId) => openThreadTab(sessionId, threadId),
										back: () => bringThreadBack(sessionId),
										exportThread: () => exportThread(sessionId),
										health: () => {
											const shell = inputShellFor(sessionId);
											return {
												token: shell !== null && shell !== undefined && typeof shell.consumeToken === "function",
												sideChat: sideChatBackend()
											};
										}
									})
								},
								QuoteListBody
							)
						)
					);
					disposers.push(
						ctx.slots.inject("sidebar.right.pane.tab.title", () =>
							ctx.slots.register(
								{ name: "sidebar.right.pane.tab.title", key: QUOTE_TAB_ID },
								() => react.createElement("span", null, translateFor(null, "panelTitle"))
							)
						)
					);
					return () => {
						for (const dispose of disposers.reverse()) {
							try {
								dispose();
							} catch (error) {
								// Unloading is best-effort; the host tears the rest down.
							}
						}
					};
				}, "ui-quote: quote list page");
			// A host without `inject` (the offline harness) keeps the old eager path.
			if (typeof ctx.inject === "function") {
				ctx.inject(["sidebarRightTabs", "sidebarRight"], (tabCtx) => {
					installQuoteTabPage(tabCtx);
				});
				// The side-chat page needs the resource registry and the tab
				// registry; both can arrive late, so it waits for them.
				ctx.inject(["resources", "sidebarRightTabs"], (sideCtx) => {
					installNativeSideChatPage(sideCtx);
				});
			} else {
				installQuoteTabPage(ctx);
				installNativeSideChatPage(ctx);
			}
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
			// 引用本轮 — the host renders a tail under every finished turn. That
			// tail is a list slot (`kind: "list"`, session scope), so our entry is
			// added by id and order. On a host that does not declare the slot the
			// inject never fires and nothing shows — a missing feature, not a
			// broken plugin.
			ctx.slots.inject("conversation.chat.turnTail", () => {
				try {
					return ctx.slots.register(
						{
							name: "conversation.chat.turnTail",
							id: "ui-quote.turn",
							order: 20,
							locale: NS,
							inject: () => ({})
						},
						TurnTailQuote
					);
				} catch (error) {
					console.warn("[ui-quote] the turn tail slot is not available:", error);
					return () => {};
				}
			});
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
			sanitizePath,
			sanitizeLang,
			markdownOf,
			plainOf,
			selectedText,
			turnTextAt,
			openCommentFor,
			config,
			setConfig,
			translateFor,
			codeLangOf,
			chatCodeBlockOf,
			parseCodeSource,
			formatCodeSource,
			fileAddressFor,
			openCodeSource,
			openedRangeMarks,
			setOpenedRange,
			previewPathOf,
			diffPathOf,
			diffLineOf,
			readSelection,
			withLineRange,
			rememberChip,
			chipInfoFor,
			loadPersistedChips,
			normalizeLabel,
			barTop,
			sourceLabel: wireSourceLabel,
			uiSourceLabel,
			rowRoleOf,
			foldWhitespace,
			findQuoteSpans,
			textPointAt,
			rangeForQuote,
			paintAnchors,
			clearSpentSources,
			capsuleJumpKey,
			rescanCapsules,
			syncDraftBars,
			removeDraftChip,
			refTextKeyOf,
			rememberQuoteText,
			quoteTextFor,
			sideChatService,
			sideChatAvailable,
			sideChatBackend,
			nativeSideChatAvailable,
			nativeSideChatRequest,
			nativeSideChatReady: () => nativeSideChatReady,
			hiddenSideChatRequest,
			builtinSideChatState: () => builtinSideChatState,
			setBuiltinSideChatState: (state) => {
				builtinSideChatState = state;
				builtinSideChatProbe = null;
				builtinSideChatProbeAt = 0;
			},
			rememberThreadTarget,
			targetOfThread,
			mintedHiddenThread,
			HIDDEN_THREAD_VERSION,
			threadRetainTarget,
			readThreadTargets,
			defaultThreadForSession,
			nativeThreadAddress,
			parseNativeThreadAddress,
			installNativeSideChatPage,
			sideChatPhase,
			SideChatFixedView,
			failureSnapshot,
			openNativeThreadTab,
			openSideChat,
			insertChip,
			sideQuestion,
			sideChatTitle,
			sideChatRequest,
			storedSideThread,
			rememberSideThread,
			sideThreadsOf,
			threadForQuote,
			rememberQuoteThread,
			loadThreadList,
			openThreadTab,
			displayedThreadId,
			prefillDraft,
			prefillQuoteDraft,
			sourceKeyOf,
			saveSource,
			promoteSource,
			sourceFor,
			sourceCandidatesFor,
			sourceBinKey,
			encodeQuoteRef,
			decodeQuoteRef,
			migrateSources,
			/** Which sessions the host has mounted a composer for (test introspection). */
			activeSessions: () => Array.from(sessions.keys()),
			rememberRevision,
			revisedFor,
			startRevision,
			jumpToSource,
			registerShortcut,
			firstLineOf,
			formatQuoteTime,
			quoteRowsFromEntries,
			filterQuoteRows,
			quoteListMarkdown,
			quoteRowMarkdown,
			quoteListJson,
			rememberIndexedQuotes,
			indexedQuotes,
			mergeIndexedQuotes,
			readQuoteRows,
			loadOlderQuotes,
			downloadText,
			quoteTabService,
			openQuoteList,
			quoteRowElement,
			quoteRowKey,
			quoteMetaFor,
			quoteMetaKeyOf,
			quoteMetaSnapshot,
			setQuoteStatus,
			markRowsResolved,
			addQuoteTag,
			removeQuoteTag,
			allQuoteTags,
			insertQuoteRows,
			QuoteListBody,
			sessionMessagesFromEntries,
			threadConclusion,
			threadMarkdown,
			mainSessionForThread,
			withSession,
			readSessionMessages,
			loadThreadSummary,
			bringThreadBack,
			exportThread
		};
		return module.exports;
	}
});

/**
 * Quote-list page harness: the data layer, the export, and the registration.
 *
 * The list is the one place a quote is an object: it is read back out of the
 * session's own event log (a sent message is plain text, so its `> ❝ …` block
 * is the record), filtered, exported as Markdown, and jumped back to its
 * source. None of that needs a browser, so this file drives all of it against
 * a fake session service and the same tiny DOM the capsule harness uses — plus
 * the registration the host actually consumes (page type, body seat, title
 * seat, shortcut).
 *
 * Usage: node test/panel.mjs      (or: npm test)
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createDom } from "./dom.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const source = readFileSync(join(root, "lib", "client.js"), "utf8");

const failures = [];
let passed = 0;
function check(name, ok, detail) {
	if (ok === true) {
		passed += 1;
		console.log("ok   " + name + (detail === undefined ? "" : "  [" + detail + "]"));
		return true;
	}
	failures.push(name);
	console.log("FAIL " + name + (detail === undefined ? "" : "  [" + detail + "]"));
	return false;
}

// ---- the browser globals the bundle runs against --------------------------
const dom = createDom();
let spec = null;
globalThis.document = dom.document;
globalThis.Element = dom.Element;
globalThis.MutationObserver = dom.MutationObserver;
globalThis.getComputedStyle = dom.getComputedStyle;
globalThis.localStorage = dom.localStorage;
try {
	globalThis.navigator = dom.navigator;
} catch (error) {
	Object.defineProperty(globalThis, "navigator", { value: dom.navigator, configurable: true });
}
globalThis.window = {
	innerWidth: 1200,
	innerHeight: 800,
	__ModuleLoader__: {
		load(loaded) {
			spec = loaded;
		}
	},
	addEventListener() {},
	removeEventListener() {}
};

new Function(source)();
if (spec === null) throw new Error("bundle did not register a module");

// A React stub with just enough surface: elements become plain trees the test
// can walk, hooks report their initial value.
const tree = (type, props, children) => ({ type, props: { ...(props ?? {}), children } });
const reactStub = {
	useRef: (value) => ({ current: value }),
	useEffect() {},
	useState: (value) => [value, () => {}],
	createElement(type, props, ...children) {
		return tree(type, props, children.length <= 1 ? children[0] : children);
	}
};

// ---- the host stubs --------------------------------------------------------
const effects = [];
const shortcuts = [];
const pageTypes = [];
const seats = [];
const releases = [];
let openedKinds = [];
let openTabThrows = false;
let sessionFixture = null;
const sessions = {
	retain(sessionId, options) {
		if (sessionFixture !== null && sessionFixture.retainThrows === true) throw new Error("retain refused");
		const session = sessionFixture === null ? null : sessionFixture.session;
		return {
			ready: Promise.resolve(),
			binding: session === null ? undefined : { session },
			release() {
				releases.push({ sessionId, source: options === undefined ? "" : options.source });
			}
		};
	}
};
const exports_ = spec.factory((name) => {
	if (name === "react") return reactStub;
	throw new Error("unexpected require: " + name);
});
/** Composer shells by session id: `bringThreadBack` writes a draft into one. */
const shells = new Map();
const sidebarRight = {
	openTab(kind) {
		if (openTabThrows) throw new Error("sidebarRight: no tab type is registered as " + kind);
		openedKinds.push(kind);
	}
};
const sidebarRightTabs = {
	register(definition) {
		pageTypes.push(definition);
		return () => {};
	}
};
exports_.apply({
	effect(fn, label) {
		const dispose = fn();
		effects.push({ label, dispose });
		return () => {};
	},
	get(name) {
		if (name === "inputTriggers") return { registerSource: () => () => {} };
		if (name === "conversation") return { input: { shell: (sessionId) => shells.get(sessionId) ?? null } };
		if (name === "shortcuts") {
			return {
				register(command) {
					shortcuts.push(command);
					return () => {};
				}
			};
		}
		if (name === "sidebarRightTabs") return sidebarRightTabs;
		if (name === "sidebarRight") return sidebarRight;
		return undefined;
	},
	sessions,
	locale: { register: () => () => {} },
	slots: {
		inject(name, factory) {
			seats.push({ name, entry: factory() });
			return () => {};
		},
		register(spec, Component) {
			return { spec, Component };
		}
	}
});

const testing = exports_.__testing;
/** The plugin's toast lives in the document the shim hands out. */
const toastNode = () => dom.document.getElementById("dsh-quote-toast");
// Downloads are captured: every `<a>` the plugin mints records what it saved.
const clicks = [];
dom.document.createElement = ((original) => (tag) => {
	const node = original.call(dom.document, tag);
	if (String(tag).toLowerCase() === "a") {
		node.click = () => {
			clicks.push({ name: node.download, href: node.href });
		};
	}
	return node;
})(dom.document.createElement);

// ---- the event log a session hands out ------------------------------------
const quotes = [
	{ seq: 4, time: "2026-10-10T09:00:00.000Z", id: "m-1", text: "> ❝ 第一段引用\n> 第二段引用\n> ❞ 这是我的评论\n\n问题一" },
	{ seq: 9, time: "2026-10-10T10:30:00.000Z", id: "m-2", text: "> ❝ 后来引用的那一句\n\n问题二" },
	{ seq: 12, time: "2026-10-10T11:00:00.000Z", id: "m-3", text: "没有引用的普通消息" }
];
const entries = quotes.map((quote) => ({
	type: "event",
	event: {
		type: "user/message",
		seq: quote.seq,
		time: quote.time,
		data: { id: quote.id, role: "user", content: [{ type: "text", text: quote.text }] }
	}
}));
entries.push({ type: "event", event: { type: "assistant/message", seq: 5, time: "", data: { message: { id: "a-1" } } } });
entries.push({ type: "transient", event: { type: "user/message", seq: 6, time: "", data: { content: [{ type: "text", text: "> ❝ 瞬时的不算" }] } } });
entries.push({ type: "event", event: { type: "user/message", seq: 7, time: "", data: null } });

// ---- parsing ---------------------------------------------------------------
const rows = testing.quoteRowsFromEntries(entries);
check("only durable user messages are read", rows.length === 2, JSON.stringify(rows.map((row) => row.seq)));
check("newest quote comes first", rows[0].seq === 9 && rows[1].seq === 4, JSON.stringify(rows.map((row) => row.seq)));
check("a quote keeps its own wording, line by line", rows[1].quote === "第一段引用\n第二段引用", JSON.stringify(rows[1].quote));
check("its comment rides in the same record", rows[1].comment === "这是我的评论", JSON.stringify(rows[1].comment));
check("a quote without a comment has an empty one", rows[0].comment === "" && rows[0].quote === "后来引用的那一句");
check("the event's seq and time are kept", rows[0].seq === 9 && rows[0].time === "2026-10-10T10:30:00.000Z");
check("a message with no quote is not a row", rows.every((row) => row.quote !== "没有引用的普通消息"));
check("garbage entries never throw", testing.quoteRowsFromEntries([null, 7, { type: "event" }, { type: "event", event: {} }]).length === 0);

// ---- search ----------------------------------------------------------------
const all = testing.quoteRowsFromEntries(entries);
check("an empty query keeps every row", testing.filterQuoteRows(all, "  ").length === 2);
check("the quote text is searched", testing.filterQuoteRows(all, "第一段").length === 1);
check("the comment is searched too", testing.filterQuoteRows(all, "我的评论").length === 1);
check("the search ignores case", testing.filterQuoteRows([{ quote: "Mixed Case TEXT", comment: "" }], "mixed case").length === 1);
check("no match means an empty list", testing.filterQuoteRows(all, "找不到的词").length === 0);

// ---- Markdown export -------------------------------------------------------
const markdown = testing.quoteListMarkdown(all, "引用清单");
check("the export has the title it was given", markdown.startsWith("# 引用清单\n"), JSON.stringify(markdown.slice(0, 24)));
check("every quote becomes a numbered section", markdown.includes("## 1. ") && markdown.includes("## 2. "));
check("the quote is a blockquote, line by line", markdown.includes("> 第一段引用\n> 第二段引用"));
check("the comment is labelled", markdown.includes("**评论**：这是我的评论"));
check("the section carries a timestamp", /_第 9 条事件 · \d{4}-\d{2}-\d{2} \d{2}:\d{2}_/.test(markdown), JSON.stringify(markdown.split("\n").filter((line) => line.startsWith("_第"))));
check("an empty list still exports", testing.quoteListMarkdown([], "引用清单").includes("_（还没有引用）_"));
check("a long quote is clipped into the heading", testing.firstLineOf("甲".repeat(200), 10).length === 10);
check("an unreadable timestamp exports as nothing", testing.formatQuoteTime("not a date") === "" && testing.formatQuoteTime(undefined) === "");

// ---- reading a session that is not on screen -------------------------------
sessionFixture = {
	session: {
		eventSource: { getSnapshot: () => ({ entries }) },
		getSnapshot: () => ({ hasMore: true })
	}
};
const read = await testing.readQuoteRows("session-far");
check("the log is read through a retained reference", read.ok === true && read.rows.length === 2, JSON.stringify(read.rows.length));
check("the reference is released after the read", releases.length === 1 && releases[0].source === "quoteList", JSON.stringify(releases));
check("the list knows there is more history", read.hasMore === true);

sessionFixture = { session: { eventSource: { getSnapshot: () => ({ entries }) }, getSnapshot: () => ({ hasMore: false }), loadOlder: async () => { sessionFixture.loaded = true; } } };
const older = await testing.loadOlderQuotes("session-far");
check("loading older history asks the session for a page", sessionFixture.loaded === true);
check("and re-reads the list afterwards", older.ok === true && older.hasMore === false);

sessionFixture = { retainThrows: true };
const refused = await testing.readQuoteRows("session-far");
check("a refused reference is a failed read, not a throw", refused.ok === false && refused.reason === "failed", JSON.stringify(refused));

sessionFixture = null;
const noBinding = await testing.readQuoteRows("session-far");
check("a session that resolves no binding is reported", noBinding.ok === false && noBinding.reason === "no-session", JSON.stringify(noBinding.reason));

// ---- the side thread the session opened ------------------------------------
const threadEntries = [
	{ type: "event", event: { type: "user/message", seq: 1, time: "2026-10-10T12:00:00.000Z", data: { id: "t-1", content: [{ type: "text", text: "> 被引用的原文\n\n这个函数为什么这么写？" }] } } },
	{ type: "event", event: { type: "assistant/message", seq: 2, time: "2026-10-10T12:01:00.000Z", data: { message: { id: "t-2", content: [{ type: "text", text: "因为它要处理空输入。" }] } } } },
	{ type: "event", event: { type: "tool/result", seq: 3, time: "", data: {} } },
	{ type: "event", event: { type: "user/message", seq: 4, time: "2026-10-10T12:02:00.000Z", data: { id: "t-3", content: [{ type: "text", text: "那改成分支呢？" }] } } },
	{ type: "event", event: { type: "assistant/message", seq: 5, time: "2026-10-10T12:03:00.000Z", data: { message: { id: "t-4", content: [{ type: "text", text: "分支更清楚，但要多一层。" }] } } } }
];
const messages = testing.sessionMessagesFromEntries(threadEntries);
check("a thread reads both roles, oldest first", messages.length === 4 && messages.map((message) => message.role).join(",") === "user,assistant,user,assistant", JSON.stringify(messages.map((message) => message.role)));
check("a user message keeps its text on data", messages[0].text.includes("这个函数为什么这么写？"), JSON.stringify(messages[0].text.slice(0, 20)));
check("an assistant message keeps its text on data.message", messages[1].text === "因为它要处理空输入。", JSON.stringify(messages[1].text));
check("tool results are not messages", messages.every((message) => message.role === "user" || message.role === "assistant"));
check("seq and time ride along", messages[3].seq === 5 && messages[3].time === "2026-10-10T12:03:00.000Z");

const conclusion = testing.threadConclusion(messages, 4000);
check("the conclusion is the last question", conclusion.question === "那改成分支呢？", JSON.stringify(conclusion.question));
check("and the answer that followed it", conclusion.answer === "分支更清楚，但要多一层。", JSON.stringify(conclusion.answer));
check("the question is quoted into the draft", conclusion.text.startsWith("> 那改成分支呢？\n\n分支更清楚"), JSON.stringify(conclusion.text.slice(0, 30)));
check("an unanswered thread carries the question alone", testing.threadConclusion([{ role: "user", text: "只有问题", seq: 1, time: "" }], 4000).text === "> 只有问题");
check("a questionless thread carries the answer alone", testing.threadConclusion([{ role: "assistant", text: "只有答案", seq: 1, time: "" }], 4000).text === "只有答案");
check("an empty thread concludes nothing", testing.threadConclusion([], 4000).text === "");
const long = testing.threadConclusion([{ role: "assistant", text: "字".repeat(200), seq: 1, time: "" }], 40);
check("a long conclusion is cut, and says so", long.text.endsWith("…（截断）") && long.text.length < 60, String(long.text.length));

const threadMd = testing.threadMarkdown(messages, "侧边线程");
check("the thread export is titled", threadMd.startsWith("# 侧边线程\n"), JSON.stringify(threadMd.slice(0, 16)));
check("every message is a numbered section", threadMd.includes("## 1. 我") && threadMd.includes("## 2. 助手"));
check("the export keeps the assistant's wording", threadMd.includes("分支更清楚，但要多一层。"));
check("an empty thread still exports", testing.threadMarkdown([], "侧边线程").includes("_（还没有内容）_"));

// ---- which session a thread belongs to -------------------------------------
globalThis.localStorage.setItem("dsh-client-ui-quote:v1:sidechat-thread", JSON.stringify({ "session-q": "session-side-1" }));
globalThis.localStorage.setItem("dsh-sidebar:v1:sidechat-thread", JSON.stringify({ "session-h": { threadId: "session-side-9" } }));
check("a thread is traced back to its main session", testing.mainSessionForThread("session-side-1") === "session-q");
check("the host's own binding counts too, object-shaped", testing.mainSessionForThread("session-side-9") === "session-h");
check("an unknown session is not a thread", testing.mainSessionForThread("session-nope") === null);
check("a missing id is not a thread either", testing.mainSessionForThread(undefined) === null);

sessionFixture = { session: { eventSource: { getSnapshot: () => ({ entries: threadEntries }) }, getSnapshot: () => ({ hasMore: false }) } };
const threadRead = await testing.readSessionMessages("session-side-1");
check("a thread's messages are read the way quotes are", threadRead.ok === true && threadRead.messages.length === 4, JSON.stringify(threadRead.messages.length));
check("that read releases its reference too", releases[releases.length - 1]?.sessionId === "session-side-1");

const summary = await testing.loadThreadSummary("session-q");
check("the page footer learns the thread's question", summary.ok === true && summary.threadId === "session-side-1" && summary.question === "那改成分支呢？", JSON.stringify(summary));
check("and how many messages it holds", summary.count === 4, String(summary.count));
check("a session without a thread says so", (await testing.loadThreadSummary("session-none")).threadId === null);

const drafts = [];
shells.set("session-q", { state: { getSnapshot: () => ({ draft: "我自己的草稿" }) }, setDraft: (text) => drafts.push(text) });
const brought = await testing.bringThreadBack("session-q");
check("bringing the thread back writes a draft", brought === true && drafts.length === 1, JSON.stringify(drafts.length));
check("the draft is the conclusion, under the question", String(drafts[0]).startsWith("我自己的草稿\n\n> 那改成分支呢？"), JSON.stringify(String(drafts[0]).slice(0, 40)));
check("and nothing was sent", drafts.length === 1);
check("the reader is told it is theirs to send", toastNode()?.textContent === "已放进主会话的输入框，自己按发送", JSON.stringify(toastNode()?.textContent));

shells.set("session-q", { state: { getSnapshot: () => ({ draft: "" }) } });
check("a shell with no draft face fails honestly", (await testing.bringThreadBack("session-q")) === false);
check("and says so", toastNode()?.textContent === "没读到这个线程的内容", JSON.stringify(toastNode()?.textContent));
shells.delete("session-q");
check("a session with no thread cannot bring one back", (await testing.bringThreadBack("session-none")) === false);

const blobs = [];
const RealBlob = globalThis.Blob;
const realCreateObjectUrl = URL.createObjectURL;
globalThis.Blob = class {
	constructor(parts, options) {
		blobs.push({ parts, options });
	}
};
URL.createObjectURL = () => "blob:thread-test";
sessionFixture = { session: { eventSource: { getSnapshot: () => ({ entries: threadEntries }) }, getSnapshot: () => ({ hasMore: false }) } };
const exported = await testing.exportThread("session-q");
globalThis.Blob = RealBlob;
URL.createObjectURL = realCreateObjectUrl;
check("the thread exports as a Markdown file", exported === true && clicks[clicks.length - 1]?.name === "thread-session-side-1.md", JSON.stringify(clicks[clicks.length - 1]?.name));
check("with the whole thread inside", String(blobs[0]?.parts?.[0]).includes("分支更清楚，但要多一层。"), JSON.stringify(String(blobs[0]?.parts?.[0]).slice(0, 24)));
check("and the file is typed as Markdown", String(blobs[0]?.options?.type).startsWith("text/markdown"), JSON.stringify(blobs[0]?.options?.type));

// ---- export -----------------------------------------------------------------
const saved = testing.downloadText(dom.document, "quotes-x.md", "# 引用清单\n");
check("the export turns into a download", saved === true && clicks[clicks.length - 1]?.name === "quotes-x.md", JSON.stringify(clicks));
check("the download carries a blob url, not the file itself", String(clicks[clicks.length - 1]?.href).startsWith("blob:") || String(clicks[clicks.length - 1]?.href).startsWith("data:"), JSON.stringify(String(clicks[clicks.length - 1]?.href).slice(0, 24)));

// ---- the page type the host is handed ---------------------------------------
const page = pageTypes.find((definition) => definition.kind === "quote-list");
check("a quote-list page type is registered", page !== undefined, JSON.stringify(pageTypes.map((entry) => entry.kind)));
check("its id is the implementation's own", page?.id === "dsh-client-ui-quote/list", JSON.stringify(page?.id));
check("its chip text is the panel title", page?.title() === "引用清单", JSON.stringify(page?.title()));
check("a guide entry makes it reachable", page?.guide?.length === 1 && page.guide[0].title() === "引用清单");
check("the guide capsule shows the shortcut", page?.guide?.[0]?.commandId === "ui-quote.list", JSON.stringify(page?.guide?.[0]?.commandId));
check("the type is declared inside an effect", effects.some((entry) => String(entry.label).includes("quote list page")));

const bodySeat = seats.find((seat) => seat.name === "sidebar.right.pane.tab");
check("the body registers into the sidebar's keyed seat", bodySeat !== undefined && bodySeat.entry.spec.key === "dsh-client-ui-quote/list", JSON.stringify(bodySeat?.entry.spec?.key));
const injected = bodySeat?.entry.spec.inject === undefined ? null : bodySeat.entry.spec.inject("session-far");
check("the body is handed its session", injected?.sessionId === "session-far");
check("and the four things it needs", typeof injected?.load === "function" && typeof injected?.loadOlder === "function" && typeof injected?.jump === "function" && typeof injected?.save === "function");
check("the title seat is registered too", seats.some((seat) => seat.name === "sidebar.right.pane.tab.title" && seat.entry.spec.key === "dsh-client-ui-quote/list"));
check("the panel ships its own stylesheet", dom.document.getElementById("dsh-quote-panel-style") !== null);

// ---- opening it -------------------------------------------------------------
openedKinds = [];
check("the row opens the page by kind", testing.openQuoteList() === true && openedKinds[0] === "quote-list", JSON.stringify(openedKinds));
openTabThrows = true;
check("a host that refuses the kind does not throw", testing.openQuoteList() === false);
openTabThrows = false;

// ---- the shortcut -----------------------------------------------------------
const listCommand = shortcuts.find((command) => command.id === "ui-quote.list");
check("Alt+L is registered for the list", listCommand !== undefined && listCommand.defaults["web:windows"].code === "KeyL", JSON.stringify(listCommand?.defaults?.["web:windows"]));
check("every default is still alt", listCommand !== undefined && Object.values(listCommand.defaults).every((binding) => binding.modifiers.length === 1 && binding.modifiers[0] === "alt"));
check("the list command needs no selection", listCommand?.resolve().status === "handled", JSON.stringify(listCommand?.resolve()?.status));
const run = listCommand === undefined ? null : listCommand.resolve().run;
openedKinds = [];
if (typeof run === "function") run();
check("running it opens the page", openedKinds[0] === "quote-list", JSON.stringify(openedKinds));
check("the four quote commands are registered", shortcuts.map((command) => command.id).join(",") === "ui-quote.quote,ui-quote.comment,ui-quote.sidechat,ui-quote.list", shortcuts.map((command) => command.id).join(","));

// ---- one row's markup -------------------------------------------------------
testing.saveSource("后来引用的那一句", "session-far", { attr: "data-chat-anchor-key", key: "row-2", turn: "9" });
let jumpableJumped = null;
const jumpable = testing.quoteRowElement(reactStub, rows[0], 0, "session-far", (row) => {
	jumpableJumped = row.quote;
});
const plainRow = testing.quoteRowElement(reactStub, rows[1], 1, "session-far", () => {});
check("a traced quote is marked jumpable", jumpable.props["data-dshq-row"] === "jumpable", JSON.stringify(jumpable.props["data-dshq-row"]));
check("an untraced quote is not", plainRow.props["data-dshq-row"] === "plain", JSON.stringify(plainRow.props["data-dshq-row"]));
jumpable.props.onClick();
check("clicking it asks for the jump", jumpableJumped === "后来引用的那一句", JSON.stringify(jumpableJumped));
check("the row prints the quote behind the lamp", String(jumpable.props.children[0].props.children).startsWith("❝ "), JSON.stringify(jumpable.props.children[0].props.children));

// ---- the body component -----------------------------------------------------
const body = testing.QuoteListBody({ sessionId: "session-far", load: () => Promise.resolve({ ok: true, rows: [], hasMore: false }) });
check("the body renders the panel shell", body?.props?.className === "dshq-list", JSON.stringify(body?.props?.className));
const headElement = Array.isArray(body.props.children) ? body.props.children[0] : body.props.children;
const search = Array.isArray(headElement.props.children) ? headElement.props.children[0] : headElement.props.children;
check("with a search box in its own language", search?.props?.placeholder === "搜索引用或评论…", JSON.stringify(search?.props?.placeholder));
const rootChildren = Array.isArray(body.props.children) ? body.props.children : [body.props.children];
const footer = rootChildren[rootChildren.length - 1];
const footerBar = Array.isArray(footer?.props?.children) ? footer.props.children[0] : null;
const footerLabel = Array.isArray(footerBar?.props?.children) ? footerBar.props.children[0] : null;
const footerNote = Array.isArray(footer?.props?.children) ? footer.props.children[1] : null;
check("the page ends with the side-thread section", footer?.props?.className === "dshq-list-thread" && footerLabel?.props?.children === "侧边线程", JSON.stringify(footerLabel?.props?.children));
check("a session with no thread is told so, without buttons", footerNote?.props?.children === "这条会话还没有侧边线程" && footerBar.props.children.filter(Boolean).length === 1, JSON.stringify(footerNote?.props?.children));

console.log(
	failures.length === 0
		? "\ndsh-client-ui-quote panel: " + passed + " checks passed"
		: "\ndsh-client-ui-quote panel: " + failures.length + " FAILED -> " + failures.join(", ")
);
process.exit(failures.length === 0 ? 0 : 1);

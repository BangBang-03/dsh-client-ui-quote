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
		if (name === "conversation") return { input: { shell: () => null } };
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

// ---- export -----------------------------------------------------------------
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
const saved = testing.downloadText(dom.document, "quotes-x.md", "# 引用清单\n");
check("the export turns into a download", saved === true && clicks[0]?.name === "quotes-x.md", JSON.stringify(clicks));
check("the download carries a blob url, not the file itself", String(clicks[0]?.href).startsWith("blob:") || String(clicks[0]?.href).startsWith("data:"), JSON.stringify(String(clicks[0]?.href).slice(0, 24)));

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

console.log(
	failures.length === 0
		? "\ndsh-client-ui-quote panel: " + passed + " checks passed"
		: "\ndsh-client-ui-quote panel: " + failures.length + " FAILED -> " + failures.join(", ")
);
process.exit(failures.length === 0 ? 0 : 1);

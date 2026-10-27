/**
 * Transcript capsule harness: runs the real enhancer against a small DOM.
 *
 * The sent message is plain text in DSH (there is no per-message render slot and
 * native `@…` chips are neither capsule-shaped nor safe), so the plugin hides
 * the run that carries a serialized quote and draws Kimi's pill beside it — the
 * quote and its comment inside one pill, the way Kimi keeps them in a single
 * composer node. This file drives that machinery end to end: a quote run becomes
 * one capsule (a run with several quotes becomes several, with the wording
 * between them kept), a comment rides in the same pill, a re-render refreshes it
 * in place, deleting the message takes the capsule with it, and a plain message
 * is never touched. The same run drives the hover card: a collapsed pill and a
 * clipped composer chip both hide the text the user needs, so hovering either of
 * them shows the quote and its comment in full.
 *
 * Usage: node test/capsule.mjs      (or: npm test)
 */
import { readFileSync, readdirSync } from "node:fs";
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

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Chromium's Custom Highlight API: the plugin keeps the source selection visible
// while the comment box owns focus. A registry stub is enough to observe it.
const highlightRegistry = new Map();
globalThis.CSS = { highlights: highlightRegistry };
globalThis.Highlight = class Highlight {
	constructor(...ranges) {
		this.ranges = ranges;
	}
};

// ---- the browser globals the bundle runs against --------------------------
const dom = createDom();
let spec = null;
globalThis.document = dom.document;
globalThis.Element = dom.Element;
globalThis.MutationObserver = dom.MutationObserver;
globalThis.KeyboardEvent = dom.KeyboardEvent;
globalThis.getComputedStyle = dom.getComputedStyle;
globalThis.localStorage = dom.localStorage;
try {
	globalThis.navigator = dom.navigator;
} catch (error) {
	Object.defineProperty(globalThis, "navigator", { value: dom.navigator, configurable: true });
}
globalThis.window = {
	// A viewport, so the hover card can be clamped and flipped like in a browser.
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

const reactStub = {
	useRef: (value) => ({ current: value }),
	// Mount semantics: the plugin's slot component registers its session here,
	// which is exactly how the real host hands the plugin a composer.
	useEffect(fn) {
		if (typeof fn === "function") fn();
	}
};
const exports_ = spec.factory((name) => {
	if (name === "react") return reactStub;
	throw new Error("unexpected require: " + name);
});

const sources = [];
const openedResources = [];
const effects = [];
/** What the plugin registered into the host's slots, so a test can mount it. */
const registered = [];
/** The locale dictionaries the plugin registers (zh/en), for the lost-state test. */
const dictionaries = [];
// The composer of every session the plugin may prefill: a session's input shell
// exists only once its view mounts, so tests install (and remove) them here.
const shells = new Map();
// The native fallback's two host faces: session fork/rename and the right
// sidebar's resource navigation (the built-in subagent chat claims the address).
const forkCalls = [];
const renameCalls = [];
let nativeForkImpl = async (opts) => {
	forkCalls.push(opts);
	return "session-native-default";
};
let bindingImpl = () => null;
// Hidden side threads are read through a subagent address, so the harness
// records what `retain` was handed; the session-list scan reads byId.
const sessionReads = [];
let sessionReadImpl = () => null;
let sessionListById = {};
const sessionsStub = {
	fork: (opts) => nativeForkImpl(opts),
	rename: async (id, title) => {
		renameCalls.push({ id, title });
		return { ok: true, value: { title, seq: 1 } };
	},
	binding: (id) => bindingImpl(id),
	scope: (id) => bindingImpl(id)?.ctx ?? null,
	retain(address, options) {
		sessionReads.push({ address, options });
		return sessionReadImpl(address, options);
	},
	list: { getSnapshot: () => ({ byId: sessionListById }) }
};
exports_.apply({
	effect(fn, label) {
		const dispose = fn();
		// `fn` is kept so a later block can reinstall after the uninstall test.
		effects.push({ label, dispose, fn });
		return () => {};
	},
	get(name) {
		if (name === "inputTriggers") {
			return { registerSource(quoteSource) { sources.push(quoteSource); return () => {}; } };
		}
		if (name === "conversation") {
			return { input: { shell: (sessionId) => shells.get(sessionId) ?? null } };
		}
		if (name === "sessions") return sessionsStub;
		if (name === "sidebarRight") {
			return {
				openResource(address, options) {
					openedResources.push({ address, options });
				}
			};
		}
		return undefined;
	},
	locale: { register: (ns, dict) => { dictionaries.push(dict); return () => {}; } },
	slots: {
		inject: (name, factory) => {
			factory();
			return () => {};
		},
		register: (spec, Component) => {
			registered.push({ spec, Component });
			return () => {};
		}
	}
});

const testing = exports_.__testing;
const capsuleEffect = effects.find((entry) => String(entry.label).includes("transcript runtime"));
check("the transcript runtime is installed with the plugin", capsuleEffect !== undefined && typeof capsuleEffect.dispose === "function");
check("the capsule stylesheet is installed", dom.document.getElementById("dsh-quote-capsule-style") !== null);
const capsuleCss = String(dom.document.getElementById("dsh-quote-capsule-style")?.textContent);
check(
	"the stylesheet draws a borderless inline pill",
	/\.dshq-cap\{[^}]*border-radius:10px/.test(capsuleCss) && /\.dshq-cap\{[^}]*display:inline-flex/.test(capsuleCss)
);
check(
	"the collapsed quote and comment are ellipsised",
	/\.dshq-cap-quote\{[^}]*text-overflow:ellipsis/.test(capsuleCss) && /\.dshq-cap-comment\{[^}]*text-overflow:ellipsis/.test(capsuleCss)
);
check(
	"the code capsule keeps the code's own spacing",
	/\.dshq-cap\[data-code="true"\] \.dshq-cap-quote\{[^}]*white-space:pre/.test(capsuleCss) && /\.dshq-pop-code\{[^}]*white-space:pre/.test(capsuleCss)
);

// ---- code quotes: a preview/terminal selection travels as a fenced block ----
check(
	"a code quote serializes as a fence inside the block",
	testing.quoteBlock("const x = 1;\nconst y = 2;", "", true) === "> ❝ ```\n> const x = 1;\n> const y = 2;\n> ```",
	JSON.stringify(testing.quoteBlock("const x = 1;\nconst y = 2;", "", true))
);
check(
	"a code text that already holds a fence switches to ~~~",
	testing.quoteBlock("```\nx = 1\n```", "", true) === "> ❝ ~~~\n> ```\n> x = 1\n> ```\n> ~~~",
	JSON.stringify(testing.quoteBlock("```\nx = 1\n```", "", true))
);
check(
	"a code quote keeps its comment in the same block",
	testing.quoteBlock("x = 1", "跑一下", true) === "> ❝ ```\n> x = 1\n> ```\n> ❞ 跑一下",
	JSON.stringify(testing.quoteBlock("x = 1", "跑一下", true))
);
const codeSegments = testing.splitQuoteRuns("> ❝ ```\n> const x = 1;\n> ```\n> ❞ 修一下");
check(
	"a fenced block parses back as code with the fence stripped",
	codeSegments !== null && codeSegments.length === 1 && codeSegments[0].type === "quote" && codeSegments[0].code !== null && codeSegments[0].quote === "const x = 1;" && codeSegments[0].comment === "修一下",
	JSON.stringify(codeSegments)
);
const plainSegments = testing.splitQuoteRuns("> ❝ 正文");
check(
	"a plain quote parses with code null",
	plainSegments !== null && plainSegments.length === 1 && plainSegments[0].type === "quote" && plainSegments[0].code === null,
	JSON.stringify(plainSegments)
);
check(
	"a plain quote round-trips byte for byte",
	testing.splitQuoteRuns(testing.quoteBlock("第一行\n\n第二行", ""))?.[0]?.quote === "第一行\n\n第二行",
	JSON.stringify(testing.splitQuoteRuns(testing.quoteBlock("第一行\n\n第二行", "")))
);
// A plain quote whose text happens to START with a fence must not lose that
// line: the fence only counts as transport when the block CLOSES it, and the
// writer always closes a code block's fence. Before this rule the first line
// was swallowed (a one-line quote like "```js" lost its whole body) and the
// quote was read back as code.
check(
	"a plain quote that starts with a fence keeps the fence as text",
	testing.splitQuoteRuns(testing.quoteBlock("```js", ""))?.[0]?.quote === "```js" &&
		testing.splitQuoteRuns(testing.quoteBlock("```js", ""))?.[0]?.code === null,
	JSON.stringify(testing.splitQuoteRuns(testing.quoteBlock("```js", "")))
);
check(
	"a plain quote that starts with a tilde fence keeps it too",
	testing.splitQuoteRuns(testing.quoteBlock("~~~\nhello", ""))?.[0]?.quote === "~~~\nhello" &&
		testing.splitQuoteRuns(testing.quoteBlock("~~~\nhello", ""))?.[0]?.code === null,
	JSON.stringify(testing.splitQuoteRuns(testing.quoteBlock("~~~\nhello", "")))
);
check(
	"a plain quote whose fence carries an info string keeps it as text",
	testing.splitQuoteRuns(testing.quoteBlock("``` src/app.ts", ""))?.[0]?.quote === "``` src/app.ts",
	JSON.stringify(testing.splitQuoteRuns(testing.quoteBlock("``` src/app.ts", "")))
);
check(
	"a plain quote that starts with a fence keeps its comment too",
	testing.splitQuoteRuns(testing.quoteBlock("```js", "我的评论"))?.[0]?.quote === "```js" &&
		testing.splitQuoteRuns(testing.quoteBlock("```js", "我的评论"))?.[0]?.comment === "我的评论",
	JSON.stringify(testing.splitQuoteRuns(testing.quoteBlock("```js", "我的评论")))
);
check(
	"a code quote still reads back as code with the fence stripped",
	testing.splitQuoteRuns(testing.quoteBlock("const x = 1;", "", true))?.[0]?.quote === "const x = 1;" &&
		testing.splitQuoteRuns(testing.quoteBlock("const x = 1;", "", true))?.[0]?.code === "",
	JSON.stringify(testing.splitQuoteRuns(testing.quoteBlock("const x = 1;", "", true)))
);
// R7: the wire format only grows, so every message an older version wrote has
// to keep parsing exactly as it did. Every writer emitted the closing fence
// unconditionally, so a code quote's fences were always paired - which is
// what lets the reader require the twin.
check(
	"a code quote with a language still reads back as code",
	testing.splitQuoteRuns("> ❝ ``` ts\n> const x = 1;\n> ```")?.[0]?.quote === "const x = 1;" &&
		testing.splitQuoteRuns("> ❝ ``` ts\n> const x = 1;\n> ```")?.[0]?.code === "ts",
	JSON.stringify(testing.splitQuoteRuns("> ❝ ``` ts\n> const x = 1;\n> ```"))
);
check(
	"a code quote with a file in the fence info still reads back as code",
	testing.splitQuoteRuns("> ❝ ``` src/app.ts#L12-L48\n> const x = 1;\n> ```")?.[0]?.code === "src/app.ts#L12-L48",
	JSON.stringify(testing.splitQuoteRuns("> ❝ ``` src/app.ts#L12-L48\n> const x = 1;\n> ```"))
);
check(
	"an old code quote whose body holds a fence still reads back whole",
	testing.splitQuoteRuns("> ❝ ~~~\n> ```\n> x = 1\n> ```\n> ~~~")?.[0]?.quote === "```\nx = 1\n```",
	JSON.stringify(testing.splitQuoteRuns("> ❝ ~~~\n> ```\n> x = 1\n> ```\n> ~~~"))
);
check(
	"an old plain quote still reads back with its escaped marks",
	testing.splitQuoteRuns("> ❝ \\❞ 其实是正文")?.[0]?.quote === "❞ 其实是正文" &&
		testing.splitQuoteRuns("> ❝ \\※ 其实是正文")?.[0]?.quote === "※ 其实是正文",
	JSON.stringify(testing.splitQuoteRuns("> ❝ \\❞ 其实是正文"))
);
check(
	"the quote list keeps a fence-shaped quote whole too",
	testing.quoteRowsFromEntries([
		{
			type: "event",
			event: {
				type: "user/message",
				seq: 7,
				time: "",
				id: "m1",
				data: { content: [{ type: "text", text: "> ❝ ```js" }] }
			}
		}
	])?.[0]?.quote === "```js",
	JSON.stringify(
		testing.quoteRowsFromEntries([
			{
				type: "event",
				event: {
					type: "user/message",
					seq: 7,
					time: "",
					id: "m1",
					data: { content: [{ type: "text", text: "> ❝ ```js" }] }
				}
			}
		])
	)
);
check(
	"a code quote round-trips byte for byte",
	testing.splitQuoteRuns(testing.quoteBlock("SELECT 1;\nSELECT 2;", "跑一下", true))?.[0] instanceof Object &&
		JSON.stringify(testing.splitQuoteRuns(testing.quoteBlock("SELECT 1;\nSELECT 2;", "跑一下", true))?.[0]) === JSON.stringify({ type: "quote", quote: "SELECT 1;\nSELECT 2;", comment: "跑一下", code: "" }),
	JSON.stringify(testing.splitQuoteRuns(testing.quoteBlock("SELECT 1;\nSELECT 2;", "跑一下", true)))
);
check(
	"the side thread gets a real fence for a code quote",
	testing.sideQuestion("x = 1", true) === "```\nx = 1\n```",
	JSON.stringify(testing.sideQuestion("x = 1", true))
);
check(
	"the side thread keeps the plain blockquote for a plain quote",
	testing.sideQuestion("第一行\n\n第二行") === "> 第一行\n>\n> 第二行",
	JSON.stringify(testing.sideQuestion("第一行\n\n第二行"))
);

// ---- a transcript, built the way the client renders one -------------------
const host = dom.document.createElement("div");
host.setAttribute("data-conversation-content", "");
host.setAttribute("data-conversation-session", "session-1");
dom.document.body.append(host);

const quote = "做法（推荐这条）\n我已经编好启动器";
const model = testing.quoteBlock(quote) + "\n\n";

// The chip carries the model form, so the serializer is the identity over it.
const serialized = await sources[0].codec.serialize(model);
check("codec.serialize hands the model form to the send path", serialized === model);

const bubble = dom.document.createElement("div");
bubble.className = "bubble";
host.append(bubble);

const run = dom.document.createElement("span");
run.className = "plainRun";
run.textContent = "我的问题" + model;
bubble.append(run);

const plain = dom.document.createElement("span");
plain.className = "plainRun";
plain.textContent = "一条不含引用的普通消息";
bubble.append(plain);

dom.document.deliver();
await wait(120);

const caps = () => dom.document.querySelectorAll(".dshq-cap");
check("the quote run turns into one capsule", caps().length === 1, caps().length + " capsule(s)");
check("the original run is hidden, not removed", run.isConnected && run.style.display === "none", "display=" + JSON.stringify(run.style.display));
check("the user's own text is still visible beside the pill", dom.document.querySelectorAll(".dshq-body")[0]?.textContent === "我的问题");
check("the pill shows the quote", dom.document.querySelector(".dshq-cap-quote")?.textContent === quote, JSON.stringify(dom.document.querySelector(".dshq-cap-quote")?.textContent));
check("the pill is labelled for screen readers", caps()[0]?.getAttribute("aria-label") === "引用", JSON.stringify(caps()[0]?.getAttribute("aria-label")));
check("the pill no longer leans on a native tooltip", caps()[0]?.getAttribute("title") === null, JSON.stringify(caps()[0]?.getAttribute("title")));
check("a plain message is never touched", plain.style.display === "" && plain.textContent === "一条不含引用的普通消息");

// ---- the hover card: one clipped line cannot be read on its own ----------
const pop = () => dom.document.getElementById("dsh-quote-popover");
caps()[0].rect = { left: 120, top: 300, width: 200, height: 22 };
caps()[0].dispatch("mouseenter", {});
check("hovering a pill opens the hover card", pop() !== null && pop().dataset.visible === "true", JSON.stringify(pop()?.dataset.visible));
check("the hover card shows the quote in full", pop()?.querySelector(".dshq-pop-quote")?.textContent === quote, JSON.stringify(pop()?.querySelector(".dshq-pop-quote")?.textContent));
check(
	"the hover card keeps the pill's line count",
	String(pop()?.querySelector(".dshq-pop-meta")?.textContent).includes("2 行"),
	JSON.stringify(pop()?.querySelector(".dshq-pop-meta")?.textContent)
);
check(
	"the hover card is parked under its pill",
	pop().style.getPropertyValue("left") === "120px" && pop().style.getPropertyValue("top") === "330px",
	JSON.stringify([pop().style.getPropertyValue("left"), pop().style.getPropertyValue("top")])
);
check("the hover card takes the surface theme", String(pop().style.getPropertyValue("--dshq-bg")) !== "");
check(
	"a quote with no comment gets one labelled half",
	pop().querySelectorAll(".dshq-pop-comment").length === 0 && pop().querySelectorAll(".dshq-pop-label").length === 1,
	String(pop().querySelectorAll(".dshq-pop-label").length) + " label(s)"
);
caps()[0].dispatch("mouseleave", {});
await wait(200);
check("leaving the pill closes the hover card", pop().dataset.visible === "false", JSON.stringify(pop().dataset.visible));

// copy + expand
dom.document.querySelector(".dshq-cap-copy").dispatch("click", { target: null, stopPropagation() {} });
check("the copy button copies the quote", dom.clipboard.length === 1 && dom.clipboard[0] === quote, JSON.stringify(dom.clipboard[0]));

// One quote, out of the card, as Markdown (the unit pasted into a PR). The
// card is reopened because the pill's own copy button ran in between.
caps()[0].dispatch("mouseenter", {});
const popCopy = pop().querySelector(".dshq-pop-copy");
check(
	"the hover card offers copying the quote as Markdown",
	popCopy !== null && popCopy.textContent === "复制为 Markdown",
	JSON.stringify(popCopy?.textContent)
);
popCopy?.dispatch("click", { target: null, stopPropagation() {} });
check(
	"it copies a blockquote of that quote",
	dom.clipboard[dom.clipboard.length - 1] ===
		quote
			.split("\n")
			.map((line) => "> " + line)
			.join("\n"),
	JSON.stringify(dom.clipboard[dom.clipboard.length - 1])
);
check("the card's copy button says 已复制 after clicking", popCopy?.textContent === "已复制", JSON.stringify(popCopy?.textContent));
caps()[0].dispatch("mouseleave", {});

// ---- React re-renders ----------------------------------------------------
dom.document.body.append(dom.document.createElement("div")); // unrelated churn
dom.document.deliver();
await wait(120);
check("an unrelated re-render does not duplicate the pill", caps().length === 1, caps().length + " capsule(s)");

run.textContent = "改过的问题" + testing.quoteBlock("新的引用") + "\n\n";
dom.document.deliver();
await wait(120);
check("a changed quote refreshes in place", caps().length === 1 && dom.document.querySelector(".dshq-cap-quote")?.textContent === "新的引用", JSON.stringify(dom.document.querySelector(".dshq-cap-quote")?.textContent));
check("the refreshed pill still shows the new message text", dom.document.querySelectorAll(".dshq-body")[0]?.textContent === "改过的问题");

// ---- the message goes away ----------------------------------------------
bubble.remove();
dom.document.deliver();
await wait(120);
check("deleting the message removes its capsule", caps().length === 0 && run.style.display === "", caps().length + " capsule(s)");

// ---- a chip that sits after the user's text -----------------------------
const bubble2 = dom.document.createElement("div");
host.append(bubble2);
const run2 = dom.document.createElement("span");
run2.textContent = "\n" + testing.quoteBlock("先说的话") + "\n\n补充说明";
bubble2.append(run2);
dom.document.deliver();
await wait(120);
check(
	"a trailing comment stays outside the pill",
	caps().length === 1 && dom.document.querySelectorAll(".dshq-body").length === 1 && dom.document.querySelectorAll(".dshq-body")[0]?.textContent === "补充说明",
	dom.document.querySelectorAll(".dshq-body").length + " run(s) of loose text"
);

// ---- several quotes in one message (chip, wording, chip, wording) ---------
// The shape of a real send: each chip splices its `> ❝ …` block into the draft,
// so the transcript run is loose text and quote blocks alternating.
const chip = (text) => "\n" + testing.quoteBlock(text) + "\n\n";
const bubble3 = dom.document.createElement("div");
host.append(bubble3);
const run3 = dom.document.createElement("span");
run3.className = "plainRun";
run3.textContent =
	chip("但那是目标，现在 CNN 还没转正，实盘跑的是规则检测器独唱。") +
	"我记得现在已经让 cnn+规则检测器完全取代单独的规则检测器了" +
	chip('第二处：CNN 和规则检测器根本不是"对面"。它们不是同一个层级上的两半，而是两条线：') +
	"错了，有问题，我们的实验线上的 cnn+规则检测器是并行的，但是你现在是按照主线和实验线来划分了，所以有问题";
bubble3.append(run3);
dom.document.deliver();
await wait(120);

const capsIn = (scope) => scope.querySelectorAll(".dshq-cap");
const textIn = (scope, selector) => [...scope.querySelectorAll(selector)].map((node) => node.textContent);
check("two quotes in one message become two capsules", capsIn(bubble3).length === 2, capsIn(bubble3).length + " capsule(s)");
check("the run is hidden once", run3.style.display === "none" && run3.isConnected);
const capTexts = textIn(bubble3, ".dshq-cap-quote");
check(
	"each capsule keeps its own quote",
	JSON.stringify(capTexts) ===
		JSON.stringify([
			"但那是目标，现在 CNN 还没转正，实盘跑的是规则检测器独唱。",
			'第二处：CNN 和规则检测器根本不是"对面"。它们不是同一个层级上的两半，而是两条线：'
		]),
	JSON.stringify(capTexts)
);
const bodyTexts = textIn(bubble3, ".dshq-body");
check(
	"the wording between the quotes stays where it was",
	JSON.stringify(bodyTexts) ===
		JSON.stringify([
			"我记得现在已经让 cnn+规则检测器完全取代单独的规则检测器了",
			"错了，有问题，我们的实验线上的 cnn+规则检测器是并行的，但是你现在是按照主线和实验线来划分了，所以有问题"
		]),
	JSON.stringify(bodyTexts)
);
const order = bubble3.childNodes
	.filter((node) => node.nodeType === 1)
	.map((node) => node.getAttribute("data-dshq"))
	.filter((value) => value !== null);
check("capsules and loose text interleave in send order", JSON.stringify(order) === JSON.stringify(["capsule", "body", "capsule", "body"]), JSON.stringify(order));
const copies = [...bubble3.querySelectorAll(".dshq-cap-copy")];
copies[1].dispatch("click", { target: null, stopPropagation() {} });
check("the second pill copies its own quote", dom.clipboard[dom.clipboard.length - 1] === capTexts[1], JSON.stringify(dom.clipboard[dom.clipboard.length - 1]));
bubble3.querySelector(".dshq-cap")?.dispatch("mouseenter", {});
check(
	"the first pill keeps its own line count",
	String(pop()?.querySelector(".dshq-pop-meta")?.textContent).includes("1 行"),
	JSON.stringify(pop()?.querySelector(".dshq-pop-meta")?.textContent)
);
bubble3.querySelector(".dshq-cap")?.dispatch("mouseleave", {});

// ---- a comment rides in the same pill ------------------------------------
// Kimi keeps quote and comment in ONE composer node, so the transcript gets one
// pill carrying both halves (`quote · comment`) rather than two loose pieces.
const bubble5 = dom.document.createElement("div");
host.append(bubble5);
const run5 = dom.document.createElement("span");
run5.className = "plainRun";
run5.textContent = "\n" + testing.quoteBlock("被引用的原话", "我的评论") + "\n\n写在后面的话";
bubble5.append(run5);
dom.document.deliver();
await wait(120);
check("a comment does not become a second pill", capsIn(bubble5).length === 1, capsIn(bubble5).length + " capsule(s)");
check(
	"the pill carries the quote and the comment",
	textIn(bubble5, ".dshq-cap-quote")[0] === "被引用的原话" && textIn(bubble5, ".dshq-cap-comment")[0] === "我的评论",
	JSON.stringify([textIn(bubble5, ".dshq-cap-quote"), textIn(bubble5, ".dshq-cap-comment")])
);
check(
	"the wording typed after the chip stays outside the pill",
	textIn(bubble5, ".dshq-body")[0] === "写在后面的话",
	JSON.stringify(textIn(bubble5, ".dshq-body"))
);
bubble5.querySelector(".dshq-cap-copy").dispatch("click", { target: null, stopPropagation() {} });
check(
	"copy takes the pair the way Kimi spells it",
	dom.clipboard[dom.clipboard.length - 1] === "被引用的原话 · 我的评论",
	JSON.stringify(dom.clipboard[dom.clipboard.length - 1])
);

// A multi-line comment stays in the same block (and therefore the same pill).
const paired = testing.splitQuoteRuns(testing.quoteBlock("原话", "第一行评论\n第二行评论"));
check(
	"a multi-line comment stays in the quote block",
	paired !== null &&
		paired.length === 1 &&
		paired[0].quote === "原话" &&
		paired[0].comment === "第一行评论\n第二行评论",
	JSON.stringify(paired)
);
check(
	"the composer chip spells the pair out too",
	testing.chipLabel("被引用的原话", "我的评论") === "被引用的原话 · 我的评论" && testing.chipLabel("只有引用", "") === "只有引用",
	JSON.stringify([testing.chipLabel("被引用的原话", "我的评论"), testing.chipLabel("只有引用", "")])
);
check(
	"the chip's ref carries both halves",
	/^\n> ❝ 原话\n> ❞ 我的评论\n\n$/u.test(testing.chipRef("原话", "我的评论")),
	JSON.stringify(testing.chipRef("原话", "我的评论"))
);

// ---- where the selection menu sits ----------------------------------------
// The menu used to open above the selection, which hides the line the reader
// just picked; it goes under the selection now and only flips when it must.
check(
	"the menu opens under the selection",
	testing.barTop({ x: 200, y: 400, bottom: 420 }, 60, 800, 0) === 428,
	JSON.stringify(testing.barTop({ x: 200, y: 400, bottom: 420 }, 60, 800, 0))
);
check(
	"a selection near the bottom flips the menu above it",
	testing.barTop({ x: 200, y: 760, bottom: 780 }, 60, 800, 0) === 692,
	JSON.stringify(testing.barTop({ x: 200, y: 760, bottom: 780 }, 60, 800, 0))
);
check(
	"a menu taller than the viewport still stays inside it",
	testing.barTop({ x: 200, y: 10, bottom: 30 }, 900, 800, 0) === 8,
	JSON.stringify(testing.barTop({ x: 200, y: 10, bottom: 30 }, 900, 800, 0))
);

// ---- the hover card on a comment pill ------------------------------------
const card5 = pop();
const cap5 = bubble5.querySelector(".dshq-cap");
card5.rect = { width: 300, height: 120 };
cap5.rect = { left: 40, top: 700, width: 120, height: 20 };
cap5.dispatch("mouseenter", {});
check(
	"hovering a comment pill shows both halves in full",
	card5.dataset.visible === "true" &&
		card5.querySelector(".dshq-pop-quote")?.textContent === "被引用的原话" &&
		card5.querySelector(".dshq-pop-comment")?.textContent === "我的评论",
	JSON.stringify([card5.querySelector(".dshq-pop-quote")?.textContent, card5.querySelector(".dshq-pop-comment")?.textContent])
);
check(
	"the hover card labels both halves",
	JSON.stringify([...card5.querySelectorAll(".dshq-pop-label")].map((node) => node.textContent)) === JSON.stringify(["引用", "评论"]),
	JSON.stringify([...card5.querySelectorAll(".dshq-pop-label")].map((node) => node.textContent))
);
check("a pill near the bottom edge flips the card above it", card5.style.getPropertyValue("top") === "572px", JSON.stringify(card5.style.getPropertyValue("top")));
cap5.dispatch("mouseleave", {});

// ---- the composer chip: hover reveals what `chipLabel` had to clip --------
// `chipLabel` cuts the quote at 30 characters, which is what the user saw in the
// chip; the index is keyed by that same label, so the chip can be recognised.
const chipHost = dom.document.createElement("div");
chipHost.setAttribute("data-composer-card", "");
const chipElement = dom.document.createElement("span");
chipElement.className = "refChip";
chipElement.textContent = testing.chipLabel("芯片里的原话", "芯片里的评论");
chipHost.append(chipElement);
dom.document.body.append(chipHost);
testing.rememberChip("芯片里的原话", "芯片里的评论", "session-1");
dom.document.deliver();
await wait(120);
check("the chip in the composer is hooked for hover", chipElement.getAttribute("data-dshq-chip") === "1", JSON.stringify(chipElement.getAttribute("data-dshq-chip")));
chipElement.rect = { left: 40, top: 120, width: 160, height: 20 };
chipElement.dispatch("mouseenter", {});
check(
	"hovering the composer chip reveals the full pair",
	card5.dataset.visible === "true" &&
		card5.querySelector(".dshq-pop-quote")?.textContent === "芯片里的原话" &&
		card5.querySelector(".dshq-pop-comment")?.textContent === "芯片里的评论",
	JSON.stringify([card5.querySelector(".dshq-pop-quote")?.textContent, card5.querySelector(".dshq-pop-comment")?.textContent])
);
check(
	"the chip's card sits under the chip",
	card5.style.getPropertyValue("left") === "40px" && card5.style.getPropertyValue("top") === "148px",
	JSON.stringify([card5.style.getPropertyValue("left"), card5.style.getPropertyValue("top")])
);
chipElement.dispatch("mouseleave", {});
await wait(200);
check("leaving the chip closes the card", card5.dataset.visible === "false", JSON.stringify(card5.dataset.visible));

// Two chips in one composer, and React reusing a chip node for the next quote:
// the card must follow the label that is on screen now, not the one that was
// there when the node got hooked.
const chipTwo = dom.document.createElement("span");
chipTwo.className = "refChip";
chipTwo.textContent = testing.chipLabel("第二处引用", "第二处评论");
chipHost.append(chipTwo);
testing.rememberChip("第二处引用", "第二处评论", "session-1");
dom.document.deliver();
await wait(120);
check("the second chip is hooked as well", chipTwo.getAttribute("data-dshq-chip") === "1", JSON.stringify(chipTwo.getAttribute("data-dshq-chip")));
chipTwo.dispatch("mouseenter", {});
check("the second chip shows its own quote", textIn(card5, ".dshq-pop-quote")[0] === "第二处引用", JSON.stringify(textIn(card5, ".dshq-pop-quote")));
chipElement.dispatch("mouseenter", {});
check("the first chip still shows its own quote", textIn(card5, ".dshq-pop-quote")[0] === "芯片里的原话", JSON.stringify(textIn(card5, ".dshq-pop-quote")));

// Same node, new label: the hook was installed for the old text.
chipElement.textContent = testing.chipLabel("换了一处引用", "换了一条评论");
testing.rememberChip("换了一处引用", "换了一条评论", "session-1");
dom.document.deliver();
await wait(120);
chipElement.dispatch("mouseenter", {});
check("a reused chip node shows the quote it holds now", textIn(card5, ".dshq-pop-quote")[0] === "换了一处引用", JSON.stringify(textIn(card5, ".dshq-pop-quote")));
check("the reused chip's card carries its own comment", textIn(card5, ".dshq-pop-comment")[0] === "换了一条评论", JSON.stringify(textIn(card5, ".dshq-pop-comment")));

// A chip this plugin never minted (another reference source) inherits nothing.
chipTwo.textContent = "别的插件的芯片";
dom.document.deliver();
await wait(120);
chipTwo.dispatch("mouseenter", {});
check("an unknown chip label does not resurrect the old card", card5.dataset.visible === "false", JSON.stringify(card5.dataset.visible));

// Some chips draw their own mark in front of the label; that must not hide it.
const chipThree = dom.document.createElement("span");
chipThree.className = "refChip";
chipThree.textContent = "❝ " + testing.chipLabel("带标记的引用", "");
chipHost.append(chipThree);
testing.rememberChip("带标记的引用", "", "session-1");
dom.document.deliver();
await wait(120);
check("a chip that draws its own mark is still recognised", chipThree.getAttribute("data-dshq-chip") === "1", JSON.stringify(chipThree.getAttribute("data-dshq-chip")));
chipThree.dispatch("mouseenter", {});
check("that chip shows its own quote without inventing a comment", textIn(card5, ".dshq-pop-quote")[0] === "带标记的引用" && textIn(card5, ".dshq-pop-comment").length === 0, JSON.stringify(textIn(card5, ".dshq-pop-quote")));

// Sending the message throws the chip away, and a node that is simply gone
// never fires `mouseleave` — the card has to notice that its anchor left.
chipElement.dispatch("mouseenter", {});
check("the card is up before the chip is sent", card5.dataset.visible === "true", JSON.stringify(card5.dataset.visible));
chipElement.remove();
dom.document.deliver();
await wait(120);
check("sending the message closes the card with the chip", card5.dataset.visible === "false", JSON.stringify(card5.dataset.visible));

// The transcript side has the same rule: a re-render that drops the pill must
// not leave a card hanging over the bubble.
cap5.dispatch("mouseenter", {});
cap5.remove();
dom.document.deliver();
await wait(120);
check("a pill that a re-render dropped takes its card with it", card5.dataset.visible === "false", JSON.stringify(card5.dataset.visible));

// ---- two quotes with nothing typed in between ----------------------------
const bubble4 = dom.document.createElement("div");
host.append(bubble4);
const run4 = dom.document.createElement("span");
run4.className = "plainRun";
run4.textContent = chip("甲") + chip("乙");
bubble4.append(run4);
dom.document.deliver();
await wait(120);
check(
	"back-to-back quotes still get a pill each",
	capsIn(bubble4).length === 2 && bubble4.querySelectorAll(".dshq-body").length === 0,
	capsIn(bubble4).length + " capsule(s), " + bubble4.querySelectorAll(".dshq-body").length + " loose run(s)"
);
check("both back-to-back pills show their own text", JSON.stringify(textIn(bubble4, ".dshq-cap-quote")) === JSON.stringify(["甲", "乙"]), JSON.stringify(textIn(bubble4, ".dshq-cap-quote")));

// ---- uninstall -----------------------------------------------------------
capsuleEffect.dispose();
check("uninstall removes the pill and restores the run", caps().length === 0 && run2.style.display === "");
check("uninstall removes the stylesheet", dom.document.getElementById("dsh-quote-capsule-style") === null);
check("uninstall removes the hover card", dom.document.getElementById("dsh-quote-popover") === null);
check("uninstall unhooks the composer chip", chipElement.getAttribute("data-dshq-chip") === null, JSON.stringify(chipElement.getAttribute("data-dshq-chip")));
check("a hand-written blockquote stays plain text", testing.splitQuoteRuns("> 只是引用格式\n> 第二行") === null);

// ---- 侧边对话: the wire, driven end to end --------------------------------
// The built-in hidden-thread route is exercised in its own block below; the
// better-sidebar and fork paths start from a host that does not answer it.
testing.setBuiltinSideChatState("unavailable");
// The third row's action is sideChatRequest(service, sessionId, text): it opens
// the session's side thread through better-sidebar — created on the first
// quote, reused afterwards — and then writes the quote into that thread's own
// composer as a draft. Nothing is ever sent, so the route is asked for an empty
// question (a non-empty one would be admitted as the thread's first message).
// A second request for the same session folds into the one in flight, and every
// refusal lands in the toast.
const openTabs = [];
const sideService = {
	openTab(seed, scope) {
		openTabs.push({ seed, scope });
	}
};
const realFetch = globalThis.fetch;
const toastNode = () => dom.document.getElementById("dsh-quote-toast");
const hostThreads = () => {
	try {
		return JSON.parse(globalThis.localStorage.getItem("dsh-sidebar:v1:sidechat-thread") ?? "{}") ?? {};
	} catch (error) {
		return {};
	}
};
/** better-sidebar records the thread its view binds; that map is read here. */
const bindHostThread = (sessionId, threadId) => {
	const map = hostThreads();
	map[sessionId] = threadId;
	globalThis.localStorage.setItem("dsh-sidebar:v1:sidechat-thread", JSON.stringify(map));
};
/** Install one session's input shell (`draftFace: false` = a version mismatch). */
const installShell = (sessionId, options = {}) => {
	const state = { draft: options.draft ?? "", chips: [] };
	const shell = { state: { getSnapshot: () => ({ draft: state.draft }) } };
	if (options.draftFace === "actions") shell.actions = { setDraft: (text) => { state.draft = text; } };
	else if (options.draftFace !== false) shell.setDraft = (text) => { state.draft = text; };
	// A host composer that can hold an atomic reference node (the chip face).
	if (options.chipFace === true) {
		shell.actions = { ...(shell.actions ?? {}), captureInsertion: () => ({ start: 0, end: 0, draftRev: 1 }) };
		shell.insertReference = (attachment) => {
			state.chips.push(attachment);
			return true;
		};
	}
	shells.set(sessionId, shell);
	return state;
};
try {
	// Happy path: the route's envelope becomes an openTab, and the quote is
	// written into the opened thread's composer — not sent to it.
	const fetches = [];
	const sideState = installShell("session-side-1");
	globalThis.fetch = async (url, options) => {
		fetches.push({ url, options });
		bindHostThread("session-q", "session-side-1");
		return {
			ok: true,
			json: async () => ({ ok: true, value: { childId: "session-side-1" } })
		};
	};
	await testing.sideChatRequest(sideService, "session-q", "第一段引用\n第二段引用");
	check("the side thread is created on better-sidebar's route", fetches.length === 1 && fetches[0].url === "/sidebar/api/sidechat.start", JSON.stringify(fetches.map((f) => f.url)));
	check(
		"the request asks for an empty question, so nothing is sent",
		JSON.stringify(fetches[0]?.options?.body) === JSON.stringify(JSON.stringify({ sessionId: "session-q", question: "" })),
		JSON.stringify(fetches[0]?.options?.body)
	);
	check("the request is a JSON POST", fetches[0]?.options?.method === "POST" && fetches[0]?.options?.headers?.["content-type"] === "application/json");
	check("the created thread's tab opens once", openTabs.length === 1, openTabs.length + " open(s)");
	check(
		"the opened tab binds to the new thread",
		JSON.stringify(openTabs[0]?.seed) === JSON.stringify({ type: "sidechat", id: "sidechat:session-side-1", title: "第一段引用", meta: { threadId: "session-side-1" } }),
		JSON.stringify(openTabs[0]?.seed)
	);
	check("the tab opens in the quoting session", JSON.stringify(openTabs[0]?.scope) === JSON.stringify({ sessionId: "session-q" }));
	check("the quote lands in the side thread's composer as a draft", sideState.draft === "> 第一段引用\n> 第二段引用", JSON.stringify(sideState.draft));
	check("the plugin remembers the session's side thread", testing.storedSideThread("session-q") === "session-side-1");

	// The next quote for the same main session reuses that thread: no second
	// thread, no second POST, and the quote follows the draft already there.
	fetches.length = 0;
	await testing.sideChatRequest(sideService, "session-q", "第二段引用");
	check("a remembered thread is never created twice", fetches.length === 0, fetches.length + " fetch(es)");
	check("the reuse opens the same thread's tab again", openTabs.length === 2 && openTabs[1]?.seed?.id === "sidechat:session-side-1", JSON.stringify(openTabs[1]?.seed));
	check("the quote is appended below what the reader already wrote", sideState.draft === "> 第一段引用\n> 第二段引用\n\n> 第二段引用", JSON.stringify(sideState.draft));

	// A shell that exposes only the action face still takes the draft.
	const actionState = installShell("session-side-2", { draftFace: "actions" });
	bindHostThread("session-q2", "session-side-2");
	fetches.length = 0;
	await testing.sideChatRequest(sideService, "session-q2", "只走 actions 的引用");
	check("a shell with only an action face still receives the draft", actionState.draft === "> 只走 actions 的引用", JSON.stringify(actionState.draft));

	// A second click while the thread is being created folds into the first.
	const release = [];
	fetches.length = 0;
	globalThis.fetch = (url, options) => new Promise((resolve) => {
		fetches.push({ url, options, resolve });
		release.push(resolve);
	});
	const foldedState = installShell("session-side-3");
	const first = testing.sideChatRequest(sideService, "session-q3", "另一段引用");
	const second = testing.sideChatRequest(sideService, "session-q3", "另一段引用");
	check("a concurrent second request folds into the first", fetches.length === 1 && second === first, fetches.length + " fetch(es)");
	bindHostThread("session-q3", "session-side-3");
	release[0]({
		ok: true,
		json: async () => ({ ok: true, value: { childId: "session-side-3" } })
	});
	await first;
	check("the folded request still opens exactly one tab", fetches.length === 1 && openTabs.length === 4, openTabs.length + " open(s)");
	check("the folded request still prefills the one thread", foldedState.draft === "> 另一段引用", JSON.stringify(foldedState.draft));

	// The route refusing (better-sidebar absent, parent not running…) is a toast.
	fetches.length = 0;
	globalThis.fetch = async (url, options) => {
		fetches.push({ url, options });
		return {
			ok: false,
			status: 409,
			json: async () => ({ ok: false, error: { code: "sidechat-error", message: "parent session is not running" } })
		};
	};
	await testing.sideChatRequest(sideService, "session-q5", "会失败的引用");
	check("a refused thread creation never opens a tab", fetches.length === 1 && openTabs.length === 4, openTabs.length + " open(s)");
	check("the refusal lands in the toast", toastNode()?.dataset.visible === "true" && toastNode()?.textContent === "侧边对话没有打开，请重试", JSON.stringify(toastNode()?.textContent));

	// A service that throws while opening degrades to the same toast.
	bindHostThread("session-q6", "session-side-6");
	const throwingService = { openTab() { throw new Error("tab type disabled"); } };
	await testing.sideChatRequest(throwingService, "session-q6", "也会失败的引用");
	check("a throwing openTab never breaks the page", openTabs.length === 4);
	check("the failed open lands in the toast too", toastNode()?.dataset.visible === "true" && toastNode()?.textContent === "侧边对话没有打开，请重试", JSON.stringify(toastNode()?.textContent));

	// The tab is open but this shell version exposes no draft: say so.
	installShell("session-side-7", { draftFace: false });
	bindHostThread("session-q7", "session-side-7");
	fetches.length = 0;
	await testing.sideChatRequest(sideService, "session-q7", "写不进去的引用");
	check("a draft-less shell still opens the tab", openTabs.length === 5 && openTabs[4]?.seed?.id === "sidechat:session-side-7", JSON.stringify(openTabs[4]?.seed));
	check(
		"the unwritable draft gets its own toast",
		toastNode()?.dataset.visible === "true" && toastNode()?.textContent === "侧边对话已打开，但引用没能写进它的输入框",
		JSON.stringify(toastNode()?.textContent)
	);

	// The memory itself: ours is written and wins (it is the map that knows
	// hidden threads), the host's binding is the old-build fallback, and an
	// empty id only forgets ours.
	testing.rememberSideThread("session-q8", "session-side-8");
	const ownMap = JSON.parse(globalThis.localStorage.getItem("dsh-client-ui-quote:v1:sidechat-thread"));
	check("the plugin keeps its own thread map", ownMap?.["session-q8"]?.threadId === "session-side-8", JSON.stringify(ownMap));
	bindHostThread("session-q8", "session-side-8-host");
	check("our own binding wins over the host's", testing.storedSideThread("session-q8") === "session-side-8");
	testing.rememberSideThread("session-q8", "");
	check("forgetting ours falls back to the host's binding", testing.storedSideThread("session-q8") === "session-side-8-host");

	// Empty text is a no-op, not a request.
	fetches.length = 0;
	await testing.sideChatRequest(sideService, "session-q9", "   ");
	check("a blank quote never reaches the wire", fetches.length === 0);
} finally {
	globalThis.fetch = realFetch;
}

// ---- 侧边对话 without better-sidebar: fork + the built-in subagent chat ----
// The fallback must not rebuild a chat UI: `sessions.fork` gives a child that
// inherits the source history, and `sidebarRight.openResource` opens the
// built-in `subagentchat` tab for it. The quote still lands as a draft only.
{
	check("the native side-chat fallback is exported", typeof testing.nativeSideChatRequest === "function" && typeof testing.nativeSideChatAvailable === "function");
	check("the third row stays available through the native fallback", testing.sideChatAvailable() === true);
	const nativeState = installShell("session-native-1");
	forkCalls.length = 0;
	renameCalls.length = 0;
	openedResources.length = 0;
	nativeForkImpl = async (opts) => {
		forkCalls.push(opts);
		return "session-native-1";
	};
	await testing.nativeSideChatRequest("session-native-main", "原生侧栏引用", false, null, "");
	check("the native fallback forks the quoting session", forkCalls.length === 1 && forkCalls[0]?.sessionId === "session-native-main", JSON.stringify(forkCalls));
	check(
		"the native fallback opens the built-in subagent chat for the fork",
		openedResources.length === 1 && openedResources[0]?.address === "dsh-resource://subagentchat/session/session-native-1?parent=session-native-main&mode=continuable",
		JSON.stringify(openedResources)
	);
	check("the native fallback names the fork after the quote", renameCalls.length === 1 && renameCalls[0]?.title === "原生侧栏引用", JSON.stringify(renameCalls));
	check("the native fallback prefills the fork's composer", nativeState.draft === "> 原生侧栏引用", JSON.stringify(nativeState.draft));
	check("the native fallback remembers the fork as the thread", testing.storedSideThread("session-native-main") === "session-native-1");
	openedResources.length = 0;
	await testing.nativeSideChatRequest("session-native-main", "第二段引用", false, null, "");
	check(
		"the native fallback reuses the remembered fork",
		forkCalls.length === 1 && openedResources.length === 1 && String(openedResources[0]?.address).includes("session-native-1"),
		JSON.stringify(openedResources)
	);
	openedResources.length = 0;
	check(
		"the quote list opens a native fork thread in the built-in chat",
		testing.openThreadTab("session-native-main", "session-native-1") === true &&
			openedResources.length === 1 &&
			String(openedResources[0]?.address).includes("session-native-1"),
		JSON.stringify(openedResources)
	);
	forkCalls.length = 0;
	openedResources.length = 0;
	nativeForkImpl = async (opts) => {
		forkCalls.push(opts);
		return "session-native-2";
	};
	await testing.nativeSideChatRequest("session-native-main", "另开一条", false, null, "", "new", "");
	check(
		"the native 'new' mode forks another thread",
		forkCalls.length === 1 && openedResources.length === 1 && String(openedResources[0]?.address).includes("session-native-2"),
		JSON.stringify(openedResources)
	);
	nativeForkImpl = async () => {
		throw new Error("fork refused");
	};
	await testing.nativeSideChatRequest("session-native-fail", "会失败的引用", false, null, "");
	check("a refused native fork lands in the toast", toastNode()?.textContent === "侧边对话没有打开，请重试", JSON.stringify(toastNode()?.textContent));
	nativeForkImpl = async (opts) => {
		forkCalls.push(opts);
		return "session-native-default";
	};
	openedResources.length = 0;
}

// ---- 侧边对话 built in: the host half creates a hidden subagent thread ----
// The route is ours (`/ui-quote/api/sidechat.start`); it is asked once whether
// it is available, then creates a seeded child the session list hides. The
// quote is still a draft, and the draft opens with the boundary the seed needs.
{
	const realHiddenFetch = globalThis.fetch;
	testing.setBuiltinSideChatState("unknown");
	sessionListById = {};
	sessionReads.length = 0;
	openedResources.length = 0;
	const hiddenState = installShell("session-hidden-1");
	const fetches = [];
	globalThis.fetch = async (url, options) => {
		const payload = JSON.parse(options.body);
		fetches.push({ url, payload });
		if (payload.probe === true) {
			return { ok: true, status: 200, json: async () => ({ ok: true, value: { available: true, version: 1 } }) };
		}
		return { ok: true, status: 200, json: async () => ({ ok: true, value: { childId: "session-hidden-1", parentId: "session-hidden-main" } }) };
	};
	try {
		const handled = await testing.hiddenSideChatRequest("session-hidden-main", "隐藏引用", false, null, "", "reuse", "隐藏引用");
		check("the built-in backend creates a hidden thread", handled === true && fetches.length === 2, JSON.stringify(fetches));
		check(
			"the probe and the start both use our host route",
			fetches.every((entry) => entry.url === "/ui-quote/api/sidechat.start"),
			JSON.stringify(fetches.map((entry) => entry.url))
		);
		check(
			"the start carries the session and the clipped title",
			JSON.stringify(fetches[1]?.payload) === JSON.stringify({ sessionId: "session-hidden-main", title: "隐藏引用" }),
			JSON.stringify(fetches[1]?.payload)
		);
		check(
			"the hidden thread opens the host's built-in chat",
			openedResources.length === 1 &&
				openedResources[0]?.address === "dsh-resource://subagentchat/session/session-hidden-1?parent=session-hidden-main&mode=continuable",
			JSON.stringify(openedResources)
		);
		check(
			"the hidden draft holds only the quote, not a boundary preamble",
			hiddenState.draft.startsWith("> 隐藏引用") && hiddenState.draft.includes("Side conversation boundary.") === false,
			JSON.stringify(hiddenState.draft)
		);

		// A blockquote in the composer reads like something the reader typed — it
		// would be sent as their own words. The thread's composer takes the chip
		// face when the host has one, so the quote stays a reference.
		const chipThread = installShell("session-chip-side", { chipFace: true });
		const chipWritten = await testing.prefillQuoteDraft("session-chip-side", "被引用的原话", false, null, "", { path: null, lang: "", origin: "chat" });
		check(
			"the side thread's quote lands as a reference chip",
			chipWritten === true && chipThread.chips.length === 1 && chipThread.draft === "",
			JSON.stringify({ chips: chipThread.chips.length, draft: chipThread.draft })
		);
		check(
			"the chip carries the wire form and a readable label",
			String(chipThread.chips[0]?.ref).includes("❝ 被引用的原话") && chipThread.chips[0]?.label === "被引用的原话",
			JSON.stringify(chipThread.chips[0])
		);
		const plainThread = installShell("session-plain-side");
		const plainWritten = await testing.prefillQuoteDraft("session-plain-side", "被引用的原话", false, null, "", {});
		check(
			"a shell without the chip face still gets the blockquote draft",
			plainWritten === true && plainThread.chips.length === 0 && plainThread.draft === "> 被引用的原话",
			JSON.stringify({ ok: plainWritten, draft: plainThread.draft })
		);
		check(
			"the hidden thread is remembered with its parent",
			testing.storedSideThread("session-hidden-main") === "session-hidden-1" &&
				JSON.stringify(testing.targetOfThread("session-hidden-1")) === JSON.stringify({ kind: "hidden", parentId: "session-hidden-main" }),
			JSON.stringify(testing.targetOfThread("session-hidden-1"))
		);
		check(
			"a thread this build minted carries the shape version",
			testing.mintedHiddenThread("session-hidden-1") === true,
			JSON.stringify(testing.readThreadTargets()["session-hidden-1"])
		);
		check(
			"reading a hidden thread uses the subagent address",
			JSON.stringify(testing.threadRetainTarget("session-hidden-1")) ===
				JSON.stringify({ parentSessionId: "session-hidden-main", childSessionId: "session-hidden-1", mode: "continuable" }),
			JSON.stringify(testing.threadRetainTarget("session-hidden-1"))
		);

		// The probe is cached, and a remembered thread is never created twice.
		await testing.hiddenSideChatRequest("session-hidden-main", "第二段引用", false, null, "", "reuse", "第二段引用");
		check("a remembered hidden thread is not created twice", fetches.length === 2, fetches.length + " fetch(es)");
		check(
			"the second quote is appended to the same hidden draft",
			hiddenState.draft.includes("> 隐藏引用") && hiddenState.draft.endsWith("> 第二段引用"),
			JSON.stringify(hiddenState.draft)
		);
		check(
			"no boundary text is ever written into the thread's composer",
			hiddenState.draft.includes("Side conversation boundary.") === false,
			JSON.stringify(hiddenState.draft)
		);

		// A healthy thread costs exactly one retain before it is reused, so a
		// broken one can be told apart below without guessing.
		installShell("session-hidden-1");
		sessionReadImpl = () => ({
			ready: Promise.resolve(),
			binding: { session: { eventSource: { getSnapshot: () => ({ entries: [] }) }, getSnapshot: () => ({ hasMore: false }) } },
			release() {}
		});
		const readsBefore = sessionReads.length;
		const startsBefore = fetches.filter((entry) => entry.payload.probe !== true).length;
		await testing.hiddenSideChatRequest("session-hidden-main", "第三段引用", false, null, "", "reuse", "第三段引用");
		check(
			"a healthy hidden thread is reused after one retain",
			sessionReads.length === readsBefore + 1 &&
				fetches.filter((entry) => entry.payload.probe !== true).length === startsBefore &&
				JSON.stringify(sessionReads.at(-1)?.address) === JSON.stringify({ parentSessionId: "session-hidden-main", childSessionId: "session-hidden-1", mode: "continuable" }),
			JSON.stringify(sessionReads.at(-1))
		);

		// A thread with the current stamp whose address the host still refuses
		// (deleted child, or a host that changed the rule) is replaced too.
		const staleMain = "session-hidden-stale";
		const staleThread = "session-hidden-stale-child";
		const staleTarget = { kind: "hidden", parentId: staleMain, v: testing.HIDDEN_THREAD_VERSION };
		testing.rememberThreadTarget(staleThread, staleTarget);
		testing.rememberSideThread(staleMain, staleThread, staleTarget);
		installShell("session-hidden-fresh");
		sessionReadImpl = (address) => {
			if (address !== null && typeof address === "object" && address.childSessionId === staleThread) throw new Error("subagent descriptor is unavailable");
			return null;
		};
		globalThis.fetch = async (url, options) => {
			const payload = JSON.parse(options.body);
			fetches.push({ url, payload });
			if (payload.probe === true) {
				return { ok: true, status: 200, json: async () => ({ ok: true, value: { available: true, version: 1 } }) };
			}
			return { ok: true, status: 200, json: async () => ({ ok: true, value: { childId: "session-hidden-fresh", parentId: staleMain } }) };
		};
		openedResources.length = 0;
		const repaired = await testing.hiddenSideChatRequest(staleMain, "旧线程引用", false, null, "", "reuse", "旧线程引用");
		check(
			"a hidden thread the host refuses is replaced, not reopened",
			repaired === true &&
				testing.storedSideThread(staleMain) === "session-hidden-fresh" &&
				openedResources.length === 1 &&
				String(openedResources[0]?.address).includes("session-hidden-fresh"),
			JSON.stringify({ stored: testing.storedSideThread(staleMain), opened: openedResources })
		);
		check(
			"the unreadable thread's parent binding is dropped",
			testing.targetOfThread(staleThread).kind === "fork",
			JSON.stringify(testing.targetOfThread(staleThread))
		);

		// The pre-fix build stamped nothing. Such a child keeps a perfectly
		// valid parent binding — `sessions.retain` succeeds and only the history
		// RPC refuses it — so the shape version is the only honest signal left.
		const legacyMain = "session-hidden-legacy";
		const legacyThread = "session-hidden-legacy-child";
		testing.rememberThreadTarget(legacyThread, { kind: "hidden", parentId: legacyMain });
		testing.rememberSideThread(legacyMain, legacyThread, { kind: "hidden", parentId: legacyMain });
		installShell("session-hidden-legacy-new");
		sessionReadImpl = () => ({
			ready: Promise.resolve(),
			binding: { session: { eventSource: { getSnapshot: () => ({ entries: [] }) }, getSnapshot: () => ({ hasMore: false }) } },
			release() {}
		});
		globalThis.fetch = async (url, options) => {
			const payload = JSON.parse(options.body);
			fetches.push({ url, payload });
			if (payload.probe === true) {
				return { ok: true, status: 200, json: async () => ({ ok: true, value: { available: true, version: 1 } }) };
			}
			return { ok: true, status: 200, json: async () => ({ ok: true, value: { childId: "session-hidden-legacy-new", parentId: legacyMain } }) };
		};
		openedResources.length = 0;
		const migrated = await testing.hiddenSideChatRequest(legacyMain, "老线程引用", false, null, "", "reuse", "老线程引用");
		check(
			"a thread from before the fix is replaced even though the host retains it",
			migrated === true &&
				testing.storedSideThread(legacyMain) === "session-hidden-legacy-new" &&
				testing.mintedHiddenThread("session-hidden-legacy-new") === true &&
				openedResources.length === 1 &&
				String(openedResources[0]?.address).includes("session-hidden-legacy-new"),
			JSON.stringify({ stored: testing.storedSideThread(legacyMain), targets: testing.readThreadTargets() })
		);
		check(
			"the unversioned thread stops being a hidden target",
			testing.targetOfThread(legacyThread).kind === "fork" && testing.mintedHiddenThread(legacyThread) === false,
			JSON.stringify(testing.targetOfThread(legacyThread))
		);

		// Reading the thread goes through the subagent address.
		sessionReadImpl = () => {
			return {
				ready: Promise.resolve(),
				binding: {
					session: {
						eventSource: {
							getSnapshot: () => ({
								entries: [
									{ type: "event", event: { type: "user/message", seq: 1, time: "2026-10-10T12:00:00.000Z", data: { id: "h-1", content: [{ type: "text", text: "隐藏线程的问题" }] } } }
								]
							})
						},
						getSnapshot: () => ({ hasMore: false })
					}
				},
				release() {}
			};
		};
		sessionReads.length = 0;
		const hiddenRead = await testing.readSessionMessages("session-hidden-1");
		check(
			"a hidden thread read retains the subagent address",
			hiddenRead.ok === true &&
				sessionReads.length === 1 &&
				JSON.stringify(sessionReads[0]?.address) === JSON.stringify({ parentSessionId: "session-hidden-main", childSessionId: "session-hidden-1", mode: "continuable" }),
			JSON.stringify(sessionReads)
		);

		// The page's thread list also sees a Side: thread another plugin made.
		sessionListById = {
			"session-hidden-1": {
				id: "session-hidden-1",
				origin: "subagent",
				parentId: "session-hidden-main",
				title: "Side: 隐藏引用",
				updatedAt: 2,
				projectionValues: { subagent: { label: "Side: 隐藏引用", address: { mode: "continuable" } } }
			},
			"session-hidden-scan": {
				id: "session-hidden-scan",
				origin: "subagent",
				parentId: "session-hidden-main",
				title: "Side: 另一个线程",
				updatedAt: 1,
				projectionValues: { subagent: { label: "Side: 另一个线程", address: { mode: "continuable" } } }
			}
		};
		const list = await testing.loadThreadList("session-hidden-main");
		check(
			"the thread list scans shared Side: threads",
			list.ok === true && list.threads.some((entry) => entry.threadId === "session-hidden-scan"),
			JSON.stringify(list.threads.map((entry) => entry.threadId))
		);
		check(
			"the page's default thread is the remembered one",
			testing.defaultThreadForSession("session-hidden-main") === "session-hidden-1",
			JSON.stringify(testing.defaultThreadForSession("session-hidden-main"))
		);
		check(
			"a session with no stored thread has no default",
			testing.defaultThreadForSession("session-hidden-nothing") === null,
			JSON.stringify(testing.defaultThreadForSession("session-hidden-nothing"))
		);
		check(
			"a scanned thread remembers its parent",
			JSON.stringify(testing.targetOfThread("session-hidden-scan")) === JSON.stringify({ kind: "hidden", parentId: "session-hidden-main" }),
			JSON.stringify(testing.targetOfThread("session-hidden-scan"))
		);
		openedResources.length = 0;
		check(
			"the quote list opens a hidden thread in the built-in chat",
			testing.openThreadTab("session-hidden-main", "session-hidden-1") === true &&
				openedResources.length === 1 &&
				String(openedResources[0]?.address).startsWith("dsh-resource://subagentchat/session/session-hidden-1?"),
			JSON.stringify(openedResources)
		);

		// A host without the route answers 404; the caller must be able to fall
		// back instead of treating the request as handled.
		testing.setBuiltinSideChatState("unknown");
		globalThis.fetch = async () => ({ ok: false, status: 404, json: async () => ({ ok: false, error: { code: "not-found", message: "unknown API method" } }) });
		const fellBack = await testing.hiddenSideChatRequest("session-hidden-fallback", "回退引用", false, null, "", "reuse", "回退引用");
		check("a host without the built-in route falls back", fellBack === false && testing.builtinSideChatState() === "unavailable", testing.builtinSideChatState());
	} finally {
		globalThis.fetch = realHiddenFetch;
		testing.setBuiltinSideChatState("unavailable");
		sessionListById = {};
		sessionReadImpl = () => null;
	}
}

// A future host may keep the scoped input events but drop the shell's
// insertReference method. The chip must still land through the event, not
// degrade to a plain-text quote.
{
	const events = [];
	bindingImpl = (id) => id === "session-event"
		? {
			ctx: {
				bail(_ctx, name, payload) {
					events.push({ name, payload });
					return true;
				}
			}
		}
		: null;
	shells.set("session-event", {});
	const entry = { actions: () => ({ captureInsertion: () => ({ draftRev: 9 }) }) };
	const inserted = testing.insertChip(entry, "session-event", "事件插入的引用", "", false, {
		ref: { v: 1, s: "session-event", a: "data-chat-anchor-key", k: "row-event", t: "4", n: 1 }
	});
	check(
		"a host without the shell method dispatches the scoped insert event",
		inserted === true && events.length === 1 && events[0]?.name === "slash/input-insert-reference" && events[0]?.payload?.span?.draftRev === 9,
		JSON.stringify(events)
	);
	bindingImpl = () => null;
}

// The overlay's own third row must take the same fallback, not only the
// lower-level request helper: this drives startRevision → openSideChat.
{
	openedResources.length = 0;
	forkCalls.length = 0;
	renameCalls.length = 0;
	const menuState = installShell("session-native-menu-1");
	nativeForkImpl = async (opts) => {
		forkCalls.push(opts);
		return "session-native-menu-1";
	};
	testing.startRevision("端到端降级引用", "", "session-native-menu", null, false, { v: 1, s: "session-wire", a: "data-chat-anchor-key", k: "row-wire", t: "3", n: 1 });
	testing.openSideChat();
	await wait(120);
	check(
		"the overlay's side-chat action uses the native fallback",
		forkCalls.length === 1 &&
			openedResources.length === 1 &&
			String(openedResources[0]?.address).includes("session-native-menu-1") &&
			menuState.draft === "> 端到端降级引用",
		JSON.stringify({ forkCalls, openedResources, draft: menuState.draft })
	);
	// The quote only went into a draft: the source must stay unmarked until the
	// reader actually sends it there — the row below would paint, so the flag is
	// what is being measured, not a missing sentence.
	const wirePane = dom.document.createElement("div");
	wirePane.setAttribute("data-conversation-content", "");
	wirePane.setAttribute("data-conversation-session", "session-wire");
	const wireRow = dom.document.createElement("div");
	wireRow.setAttribute("data-chat-anchor-key", "row-wire");
	wireRow.setAttribute("data-chat-turn", "3");
	wireRow.setAttribute("data-chat-role", "assistant");
	wireRow.textContent = "前文 端到端降级引用 后文";
	wirePane.append(wireRow);
	dom.document.body.append(wirePane);
	testing.paintAnchors();
	const quotedButUnmarked = highlightRegistry.has("dshq-quote") === false;
	testing.promoteSource({ v: 1, s: "session-wire", a: "data-chat-anchor-key", k: "row-wire", t: "3", n: 1 }, "端到端降级引用");
	testing.paintAnchors();
	check(
		"a side chat leaves the source unmarked until its quote is sent",
		quotedButUnmarked && highlightRegistry.get("dshq-quote")?.ranges?.length === 1,
		JSON.stringify({ unmarked: quotedButUnmarked, ranges: highlightRegistry.get("dshq-quote")?.ranges?.length })
	);
	wirePane.remove();
	testing.paintAnchors();
	openedResources.length = 0;
	nativeForkImpl = async (opts) => {
		forkCalls.push(opts);
		return "session-native-default";
	};
}

/* ------------------------------------------------------------------ *
 * Jump back to the source, and the three shortcuts
 * ------------------------------------------------------------------ */

{
	// A transcript exactly as DSH renders one: one content pane per session, a
	// scrollport inside it, rows carrying an anchor key and a turn. The anchor
	// key is the only handle a plugin gets — there is no message id and no
	// scroll API — and the jump has to land inside the right pane, because a
	// document-wide search is how a quote ends up in someone else's session.
	const pane = (sessionId) => {
		const root = dom.document.createElement("div");
		root.setAttribute("data-conversation-content", "");
		root.setAttribute("data-conversation-session", sessionId);
		const port = dom.document.createElement("div");
		port.setAttribute("data-conversation-scroll", "");
		port.scrollTop = 0;
		port.clientHeight = 400;
		port.getBoundingClientRect = () => ({ left: 0, top: 0, right: 800, bottom: 400, width: 800, height: 400 });
		root.append(port);
		dom.document.body.append(root);
		// A row laid out at `top` in transcript coordinates: it moves with the
		// scrollport, the way a laid-out row does.
		const put = (key, turn, top) => {
			const node = dom.document.createElement("div");
			if (key !== null) node.setAttribute("data-chat-anchor-key", key);
			if (turn !== null) node.setAttribute("data-chat-turn", turn);
			node.getBoundingClientRect = () => {
				const y = top - port.scrollTop;
				return { left: 0, top: y, right: 800, bottom: y + 40, width: 800, height: 40 };
			};
			port.append(node);
			return node;
		};
		return { root, port, put };
	};

	// The pane that is open next to the one the quote came from, holding a row
	// under the very same anchor key: a document-wide lookup finds this one.
	const other = pane("session-other");
	const intruder = other.put("row-1", "3", 100);
	const home = pane("session-q");
	const realRow = home.put("row-1", "3", 1200);
	home.port.scrollTop = 500;

	// The key is the quote's own wording: folded, trimmed, capped — a paragraph
	// must not become the key, and a re-wrapped quote must still find its row.
	check("a quote is keyed by its own wording", testing.sourceKeyOf("  第一段\n  引用 ") === "第一段 引用", JSON.stringify(testing.sourceKeyOf("  第一段\n  引用 ")));
	check("an over-long quote is capped", testing.sourceKeyOf("字".repeat(400)).length === 120);
	check("an unknown quote has no source", testing.sourceFor("从没选过的句子") === null);

	testing.saveSource("被引用的那一段原文", "session-q", { attr: "data-chat-anchor-key", key: "row-1", turn: "3" });
	const stored = testing.sourceFor("被引用的那一段原文");
	check("the quote finds its row again", stored?.key === "row-1" && stored?.turn === "3", JSON.stringify(stored));
	const persisted = JSON.parse(globalThis.localStorage.getItem("dsh-client-ui-quote:v2:quote-source"));
	const persistedBin = persisted?.["session-q::3"];
	check("the coordinate is persisted as a v2 candidate array", Array.isArray(persistedBin) && persistedBin[0]?.key === "row-1", JSON.stringify(persistedBin));
	check("the legacy v1 table is no longer written", globalThis.localStorage.getItem("dsh-client-ui-quote:v1:quote-source") === null);

	check("the jump finds the row in the session's own pane", testing.jumpToSource("被引用的那一段原文", "session-q") === true);
	check("the row is parked under the top edge, the way the host parks a turn", Math.round(realRow.getBoundingClientRect().top) === 24, String(realRow.getBoundingClientRect().top));
	check("the scrollport took the row's own offset", home.port.scrollTop === 1176, String(home.port.scrollTop));
	check("a same-keyed row in the other pane is left alone", other.port.scrollTop === 0 && intruder.getAttribute("data-dshq-flash") === null);
	check("the landed row is flashed", realRow.getAttribute("data-dshq-flash") === "true");

	// A row the virtualizer hides is no target: the turn is what survives, and
	// like the host, the first shown row at or after that turn is the landing.
	const hiddenRow = home.put("row-hidden", "7", 1600);
	hiddenRow.setAttribute("hidden", "");
	const laterRow = home.put("row-later", "7", 1600);
	testing.saveSource("被隐藏起来的原文", "session-q", { attr: "data-chat-anchor-key", key: "row-hidden", turn: "7" });
	check("a hidden row gives way to a shown one at its turn", testing.jumpToSource("被隐藏起来的原文", "session-q") === true);
	check("the shown row is the one flashed", laterRow.getAttribute("data-dshq-flash") === "true" && hiddenRow.getAttribute("data-dshq-flash") === null, JSON.stringify([laterRow.getAttribute("data-dshq-flash"), hiddenRow.getAttribute("data-dshq-flash")]));

	// Nothing to find and nowhere left to walk: the reader is told why the
	// button did nothing instead of being left with a dead button.
	testing.saveSource("被虚拟化丢掉的原文", "session-other", { attr: "data-chat-anchor-key", key: "row-gone", turn: "" });
	check("a missing source row is reported", testing.jumpToSource("被虚拟化丢掉的原文", "session-other") === false);
	check("and the toast says why", toastNode()?.textContent === "原文不在当前视图里", JSON.stringify(toastNode()?.textContent));
	testing.saveSource("没有面板的原文", "session-ghost", { attr: "data-chat-anchor-key", key: "row-gone", turn: "" });
	check("a session that is not on screen is reported too", testing.jumpToSource("没有面板的原文", "session-ghost") === false);

	// A row of an old turn that the virtualizer only mounts once the port comes
	// near it: the search walks the transcript up a screen at a time until the
	// row appears, and lands on it rather than past it.
	const farRow = dom.document.createElement("div");
	farRow.setAttribute("data-chat-anchor-key", "row-far");
	farRow.setAttribute("data-chat-turn", "1");
	farRow.getBoundingClientRect = () => {
		const y = 300 - home.port.scrollTop;
		return { left: 0, top: y, right: 800, bottom: y + 40, width: 800, height: 40 };
	};
	let offset = 4000;
	Object.defineProperty(home.port, "scrollTop", {
		configurable: true,
		get: () => offset,
		set: (next) => {
			offset = next;
			if (next <= 2000 && farRow.parentNode === null) home.port.append(farRow);
		}
	});
	testing.saveSource("很久以前的原文", "session-q", { attr: "data-chat-anchor-key", key: "row-far", turn: "" });
	check("a row that is not mounted yet starts a search", testing.jumpToSource("很久以前的原文", "session-q") === false);
	await wait(240);
	check("the search walks the transcript until the row appears", farRow.getAttribute("data-dshq-flash") === "true");
	check("and lands on it, not past it", Math.round(farRow.getBoundingClientRect().top) === 24, String(farRow.getBoundingClientRect().top));
	Object.defineProperty(home.port, "scrollTop", { configurable: true, writable: true, value: 0 });

	// A reader parked above the source — a capsule in a side thread reads text
	// from the main transcript, which may sit anywhere: the walk up runs out at
	// the top, so the search starts over from the bottom of the history instead
	// of giving up on a row that is simply below.
	const lowPane = pane("session-low");
	lowPane.port.scrollHeight = 4000;
	let lowTop = 0;
	let lowRow = null;
	Object.defineProperty(lowPane.port, "scrollTop", {
		configurable: true,
		get: () => lowTop,
		set: (next) => {
			lowTop = Math.max(0, next);
			if (lowTop >= 2400 && lowRow === null) lowRow = lowPane.put("row-low", "9", 3000);
		}
	});
	testing.saveSource("在下面那段原文", "session-low", { attr: "data-chat-anchor-key", key: "row-low", turn: "9" });
	check("a source below the reader starts a search", testing.jumpToSource("在下面那段原文", "session-low") === false);
	await wait(240);
	check("the search reaches a row below the reader too", lowRow !== null && lowRow.getAttribute("data-dshq-flash") === "true", JSON.stringify([lowTop, lowRow === null ? null : lowRow.getAttribute("data-dshq-flash")]));
	check("and lands on it, not past it", lowRow !== null && Math.round(lowRow.getBoundingClientRect().top) === 24, lowRow === null ? "no row" : String(lowRow.getBoundingClientRect().top));

	// The hover card carries the jump: only for quotes we watched being selected.
	const firstCap = caps()[0];
	if (firstCap !== undefined) {
		firstCap.dispatch("mouseenter", {});
		check("an untraced quote offers no jump row", pop().querySelector(".dshq-pop-jump") === null);
		const capQuote = String(pop().querySelector(".dshq-cap-quote")?.textContent ?? "");
		testing.saveSource(capQuote, "session-q", { attr: "data-chat-anchor-key", key: "row-1", turn: "3" });
		firstCap.dispatch("mouseenter", {});
		const jumpRow = pop().querySelector(".dshq-pop-jump");
		check("a traced quote offers the jump row", jumpRow !== null && jumpRow.textContent === "跳回原文", JSON.stringify(jumpRow?.textContent));
		if (jumpRow !== null) jumpRow.dispatch("click", { target: null, stopPropagation() {} });
		check("the jump row lands in the source's own pane", home.port.scrollTop === 1176, String(home.port.scrollTop));
		firstCap.dispatch("mouseleave", {});
	}

	// Three commands, one per row, all on Alt — Escape belongs to the host.
	const commands = [];
	const shortcuts = {
		register(command) {
			commands.push(command);
			return () => {};
		}
	};
	const disposers = [
		testing.registerShortcut(shortcuts, "quote", "KeyQ", () => {}),
		testing.registerShortcut(shortcuts, "comment", "KeyC", () => {}),
		testing.registerShortcut(shortcuts, "sidechat", "KeyB", () => {})
	];
	check("three commands are registered", commands.length === 3, commands.map((entry) => entry.id).join(", "));
	check(
		"the ids name the three rows",
		commands.map((entry) => entry.id).join(",") === "ui-quote.quote,ui-quote.comment,ui-quote.sidechat",
		commands.map((entry) => entry.id).join(",")
	);
	check(
		"every default is alt on every platform",
		commands.every((entry) => Object.values(entry.defaults).every((binding) => binding.modifiers.length === 1 && binding.modifiers[0] === "alt"))
	);
	check("the quote row is Alt+Q", commands[0].defaults["web:windows"].code === "KeyQ", JSON.stringify(commands[0].defaults["web:windows"]));
	check("the comment row is Alt+C", commands[1].defaults["desktop:macos"].code === "KeyC", JSON.stringify(commands[1].defaults["desktop:macos"]));
	check("the side chat row is Alt+B", commands[2].defaults["desktop:linux"].code === "KeyB", JSON.stringify(commands[2].defaults["desktop:linux"]));
	check("Escape is never bound", commands.every((entry) => Object.values(entry.defaults).every((binding) => binding.code !== "Escape")));
	check(
		"they work on the page and in the composer",
		commands.every((entry) => entry.regions.includes("page") && entry.regions.includes("editable"))
	);
	check("with no selection the key falls through", commands[0].resolve().status === "pass", JSON.stringify(commands[0].resolve()));
	check("registering hands back a disposer each time", disposers.every((dispose) => typeof dispose === "function"));
}

/* ------------------------------------------------------------------ *
 * 改这条引用 — the honest revision path (the transcript is append-only)
 * ------------------------------------------------------------------ */

{
	const original = "被改的那段原文";
	const oldComment = "旧的评论";
	const newComment = "改后的评论";

	// The plugin only knows a composer once the host mounts its slot entry —
	// exactly what the real client does with `conversation.input.overlay`.
	const overlay = registered.find((entry) => entry.spec.name === "conversation.input.overlay");
	check("the overlay slot was registered", overlay !== undefined && typeof overlay.Component === "function");
	const insertions = [];
	const span = { draftRev: 7 };
	shells.set("session-rev", {
		insertReference(attachment, capturedSpan) {
			insertions.push({ attachment, capturedSpan });
			return true;
		}
	});
	if (overlay !== undefined) {
		// No `t` on purpose: without one the plugin falls back to its own
		// dictionary, which is what the label assertions below read.
		overlay.Component({ sessionId: "session-rev", inputActions: { captureInsertion: () => span } });
	}

	// The uninstall test disposed the capsule effect earlier, so put it back:
	// this block is about what a mounted enhancer does with a revision.
	capsuleEffect.fn();

	// A textarea measures itself from its own text — but only while it is in the
	// document, the way the real one reads 0 before the bar is laid out. That is
	// what made the auto-grow collapse the quote field.
	const makeTextarea = dom.document.createElement.bind(dom.document);
	dom.document.createElement = (tag) => {
		const node = makeTextarea(tag);
		if (String(tag).toLowerCase() === "textarea") {
			Object.defineProperty(node, "scrollHeight", {
				configurable: true,
				get: () => (node.isConnected ? 12 + 12 * String(node.value ?? "").split("\n").length : 0)
			});
		}
		return node;
	};

	// A transcript of its own, with a capsule that has a comment.
	const host2 = dom.document.createElement("div");
	host2.setAttribute("data-conversation-content", "");
	host2.setAttribute("data-conversation-session", "session-rev");
	const bubble2 = dom.document.createElement("div");
	bubble2.className = "bubble";
	const run2 = dom.document.createElement("span");
	run2.className = "plainRun";
	run2.textContent = testing.chipRef(original, oldComment);
	bubble2.append(run2);
	host2.append(bubble2);
	dom.document.body.append(host2);
	dom.document.deliver();
	await wait(120);
	const revCap = host2.querySelectorAll(".dshq-cap")[0];
	check("a quoted message with a comment becomes one capsule", revCap !== undefined, host2.querySelectorAll(".dshq-cap").length + " in this pane");
	revCap.rect = { left: 100, top: 200, width: 180, height: 22 };
	revCap.dispatch("mouseenter", {});
	check("its card shows the comment", pop()?.querySelector(".dshq-pop-comment")?.textContent === oldComment, JSON.stringify(pop()?.querySelector(".dshq-pop-comment")?.textContent));
	check("a quote we watched being selected offers both actions", pop()?.querySelector(".dshq-pop-jump") === null && pop()?.querySelector(".dshq-pop-revise") === null);
	testing.saveSource(original, "session-rev", { attr: "data-chat-anchor-key", key: "row-rev", turn: "4" });
	revCap.dispatch("mouseenter", {});
	const actions = pop()?.querySelector(".dshq-pop-actions");
	check("with a traced quote the card carries 跳回原文", actions?.querySelector(".dshq-pop-jump")?.textContent === "跳回原文", JSON.stringify(actions?.querySelector(".dshq-pop-jump")?.textContent));
	check("and 改这条引用", actions?.querySelector(".dshq-pop-revise")?.textContent === "改这条引用", JSON.stringify(actions?.querySelector(".dshq-pop-revise")?.textContent));

	// Clicking it reopens the comment box on the same quote, prefilled.
	actions.querySelector(".dshq-pop-revise").dispatch("click", { target: null, stopPropagation() {} });
	const bar = dom.document.getElementById("dsh-quote-bar");
	check("the card closes and the comment box takes over", pop()?.dataset.visible === "false" && bar?.dataset.visible === "true", JSON.stringify([pop()?.dataset.visible, bar?.dataset.visible]));
	const quoteBox = bar?.querySelector(".dshq-quote-input");
	const input = bar?.querySelector(".dshq-comment-input");
	check("the box is prefilled with the old quote for editing", quoteBox?.value === original, JSON.stringify(quoteBox?.value));
	check("the box is prefilled with the old comment", input?.value === oldComment, JSON.stringify(input?.value));
	// Regression: the quote half used to be measured before it was attached, so
	// it was written `height: 0px` and its first line showed up clipped.
	check("the quote field is grown to its text, not collapsed", quoteBox?.style?.height === "24px", JSON.stringify(quoteBox?.style?.height));
	check("the comment field is grown too", input?.style?.height === "24px", JSON.stringify(input?.style?.height));

	// Correcting it writes a NEW quote (nothing is edited in place) and the old
	// capsule learns it was superseded.
	input.value = newComment;
	input.dispatch("input", {});
	check("typing in a field re-measures it", input?.style?.height === "24px", JSON.stringify(input?.style?.height));
	// The bar handles clicks by delegation, so the click is dispatched on the bar
	// with the button as its target — the shim has no bubbling of its own.
	const confirm = bar.querySelector('[data-action="confirm"]');
	bar.dispatch("click", { target: confirm });
	check("committing sends the corrected quote as a new chip", insertions.length === 1 && insertions[0].attachment.ref.includes(newComment), JSON.stringify({ count: insertions.length, ref: String(insertions[0]?.attachment?.ref ?? "").slice(0, 32), sessions: testing.revisedFor(original) === null ? "no revision" : "revision" }));
	// The chip's model form now carries the coordinate too: the sent message can
	// be traced back from its own text, with no table and no same-session state.
	const chipRefLine = String(insertions[0]?.attachment?.ref ?? "").split("\n").find((line) => line.includes("│q1:"));
	const chipRefPayload = chipRefLine === undefined ? null : testing.decodeQuoteRef(chipRefLine.slice(chipRefLine.indexOf("│q1:") + "│q1:".length));
	check(
		"the committed chip carries its own coordinate",
		chipRefPayload !== null && chipRefPayload.k === "row-rev" && chipRefPayload.s === "session-rev" && chipRefPayload.t === "4",
		JSON.stringify(chipRefPayload)
	);
	check(
		"the committed chip names its source in readable words",
		chipRefLine !== undefined && chipRefLine.includes("引自第 4 轮"),
		JSON.stringify(chipRefLine)
	);
	check("the old quote is marked revised", testing.revisedFor(original)?.comment === newComment, JSON.stringify(testing.revisedFor(original)));
	check("the revision is persisted for the next page", JSON.stringify(globalThis.localStorage.getItem("dsh-client-ui-quote:v1:quote-revised")).includes(newComment));

	// The same wording from two different coordinates is two quotes: revising
	// one must not mark the other.
	const scopedQuote = "同一句在两个轮次里";
	const refA = { v: 1, s: "session-scope", a: "data-chat-anchor-key", k: "row-a", t: "1", n: 1 };
	const refB = { v: 1, s: "session-scope", a: "data-chat-anchor-key", k: "row-b", t: "2", n: 1 };
	testing.rememberRevision(scopedQuote, "只改第一条", "", refA);
	check(
		"a revision is scoped to its own coordinate",
		testing.revisedFor(scopedQuote, refA)?.comment === "只改第一条" && testing.revisedFor(scopedQuote, refB) === null,
		JSON.stringify({ a: testing.revisedFor(scopedQuote, refA), b: testing.revisedFor(scopedQuote, refB) })
	);
	testing.rememberRevision(scopedQuote, "老版本按文本记的修订", "");
	check(
		"a text-keyed revision still reads through a ref",
		testing.revisedFor(scopedQuote, refB)?.comment === "老版本按文本记的修订",
		JSON.stringify(testing.revisedFor(scopedQuote, refB))
	);

	// A fresh capsule of that quote now says so, and its card shows the correction.
	const host3 = dom.document.createElement("div");
	host3.setAttribute("data-conversation-content", "");
	host3.setAttribute("data-conversation-session", "session-rev");
	const bubble3 = dom.document.createElement("div");
	const run3 = dom.document.createElement("span");
	run3.textContent = testing.chipRef(original, oldComment);
	bubble3.append(run3);
	host3.append(bubble3);
	dom.document.body.append(host3);
	dom.document.deliver();
	await wait(120);
	const badgeCap = host3.querySelectorAll(".dshq-cap")[0];
	check("a superseded capsule wears a badge", badgeCap?.querySelector(".dshq-cap-revised")?.textContent === "已修订", JSON.stringify(badgeCap?.querySelector(".dshq-cap-revised")?.textContent));
	badgeCap.rect = { left: 100, top: 260, width: 180, height: 22 };
	badgeCap.dispatch("mouseenter", {});
	check("and its card prints the correction", pop()?.querySelector(".dshq-pop-revised")?.textContent === newComment, JSON.stringify(pop()?.querySelector(".dshq-pop-revised")?.textContent));

	// Storage rules: keyed by the quote's own wording, empty ones are not revisions.
	check("a revision is keyed by the quote's wording", testing.rememberRevision("  第一段\n  引用 ", "新的") === true && testing.revisedFor("第一段 引用")?.comment === "新的");
	check("an empty correction is not a revision", testing.rememberRevision("另一段原文", "   ") === false && testing.revisedFor("另一段原文") === null);
	check("a correction never rewrites the quote text itself", testing.revisedFor(original)?.comment === newComment);

	// 引用正文也可编辑：修订把旧正文回填进自己的输入框，改完随新引用发出，
	// 旧胶囊的卡片指得出改后的原文。
	{
		testing.startRevision(original, oldComment, "session-rev", null, false);
		const bar2 = dom.document.getElementById("dsh-quote-bar");
		const quoteBox2 = bar2?.querySelector(".dshq-quote-input");
		const commentBox2 = bar2?.querySelector(".dshq-comment-input");
		check("a second revision prefills both halves", quoteBox2?.value === original && commentBox2?.value === oldComment, JSON.stringify([quoteBox2?.value, commentBox2?.value]));
		const edited = original + "（正文也改了）";
		quoteBox2.value = edited;
		quoteBox2.dispatch("input", {});
		commentBox2.value = newComment;
		commentBox2.dispatch("input", {});
		const confirm2 = bar2.querySelector('[data-action="confirm"]');
		check("both halves filled arms the confirm button", confirm2?.disabled === false, String(confirm2?.disabled));
		bar2.dispatch("click", { target: confirm2 });
		check("the edited wording rides in the new chip", insertions.length === 2 && insertions[1].attachment.ref.includes(edited), JSON.stringify({ count: insertions.length, ref: String(insertions[1]?.attachment?.ref ?? "").slice(0, 32) }));
		check("the revision remembers the corrected wording", testing.revisedFor(original)?.quote === edited, JSON.stringify(testing.revisedFor(original)));

		// Clearing the quote disarms the confirm: an empty quote is nothing to send.
		testing.startRevision(original, oldComment, "session-rev", null, false);
		const bar3 = dom.document.getElementById("dsh-quote-bar");
		const quoteBox3 = bar3?.querySelector(".dshq-quote-input");
		const confirm3 = bar3.querySelector('[data-action="confirm"]');
		quoteBox3.value = "   ";
		quoteBox3.dispatch("input", {});
		check("an emptied quote disarms the confirm button", confirm3?.disabled === true, String(confirm3?.disabled));

		// The old capsule's card now tells the whole story of the correction.
		revCap.dispatch("mouseenter", {});
		check("the old card prints the corrected wording", pop()?.querySelector(".dshq-pop-revised-quote")?.textContent === edited, JSON.stringify(pop()?.querySelector(".dshq-pop-revised-quote")?.textContent));
		revCap.dispatch("mouseleave", {});
	}
	badgeCap.dispatch("mouseleave", {});
}

/* ------------------------------------------------------------------ *
 * 代码胶囊 — a code quote renders as a monospace pill whose card keeps
 * the code's own spacing (the fence never reaches the screen).
 * ------------------------------------------------------------------ */

{
	const codeHost = dom.document.createElement("div");
	codeHost.setAttribute("data-conversation-content", "");
	codeHost.setAttribute("data-conversation-session", "session-rev");
	const codeBubble = dom.document.createElement("div");
	const codeRun = dom.document.createElement("span");
	codeRun.className = "plainRun";
	codeRun.textContent = testing.chipRef("SELECT 1;\nSELECT 2;", "", true);
	codeBubble.append(codeRun);
	codeHost.append(codeBubble);
	dom.document.body.append(codeHost);
	dom.document.deliver();
	await wait(120);
	const codeCap = codeHost.querySelectorAll(".dshq-cap")[0];
	check("a code quote wears the code capsule", codeCap !== undefined && codeCap.getAttribute("data-code") === "true", JSON.stringify([codeCap !== undefined, codeCap?.getAttribute("data-code")]));
	check("the code capsule shows the fence-stripped text", codeCap?.querySelector(".dshq-cap-quote")?.textContent === "SELECT 1;\nSELECT 2;", JSON.stringify(codeCap?.querySelector(".dshq-cap-quote")?.textContent));
	codeCap.rect = { left: 100, top: 300, width: 180, height: 22 };
	codeCap.dispatch("mouseenter", {});
	check("its card keeps the code spacing", pop()?.querySelector(".dshq-pop-code")?.textContent === "SELECT 1;\nSELECT 2;", JSON.stringify(pop()?.querySelector(".dshq-pop-code")?.textContent));
	codeCap.dispatch("mouseleave", {});
}

/* ------------------------------------------------------------------ *
 * 打开文件 — the card's path line opens the source at its first line
 * ------------------------------------------------------------------ */

{
	const openHost = dom.document.createElement("div");
	openHost.setAttribute("data-conversation-content", "");
	openHost.setAttribute("data-conversation-session", "session-open");
	const openBubble = dom.document.createElement("div");
	const openRun = dom.document.createElement("span");
	openRun.className = "plainRun";
	openRun.textContent = testing.chipRef("const x = 1;", "", true, { path: "src/app.ts#L12-L48" });
	openBubble.append(openRun);
	openHost.append(openBubble);
	dom.document.body.append(openHost);
	dom.document.deliver();
	await wait(120);
	const openCap = openHost.querySelectorAll(".dshq-cap")[0];
	openCap.rect = { left: 100, top: 300, width: 180, height: 22 };
	openCap.dispatch("mouseenter", {});
	const sourceButton = pop()?.querySelector(".dshq-pop-source");
	check("the card shows the code quote's file and line", sourceButton?.textContent === "src/app.ts · L12-L48 ↗", JSON.stringify(sourceButton?.textContent));
	testing.saveSource("const x = 1;", "session-open", { attr: "data-chat-anchor-key", key: "row-open", turn: "1", role: "u", origin: "preview" });
	openCap.dispatch("mouseenter", {});
	check(
		"the card names where the quote came from",
		pop()?.querySelector(".dshq-pop-source")?.textContent === "文件预览 · src/app.ts · L12-L48 ↗",
		JSON.stringify(pop()?.querySelector(".dshq-pop-source")?.textContent)
	);
	sourceButton?.dispatch("click", { stopPropagation() {} });
	check(
		"opening the source asks the right sidebar for the session file at line 12",
		openedResources.length === 1 &&
			openedResources[0].address === "dsh-resource://file/session/session-open/src/app.ts" &&
			openedResources[0].options?.params?.line === 12,
		JSON.stringify(openedResources)
	);
	openCap.dispatch("mouseleave", {});
	await wait(200);
	openHost.remove();

	// A language-only code quote (a chat code block) has no file to open: the
	// card must not offer a dead source line for the language tag.
	const langHost = dom.document.createElement("div");
	langHost.setAttribute("data-conversation-content", "");
	langHost.setAttribute("data-conversation-session", "session-open-lang");
	const langBubble = dom.document.createElement("div");
	const langRun = dom.document.createElement("span");
	langRun.className = "plainRun";
	langRun.textContent = testing.chipRef("const x = 1;", "", true, { lang: "ts" });
	langBubble.append(langRun);
	langHost.append(langBubble);
	dom.document.body.append(langHost);
	dom.document.deliver();
	await wait(120);
	const langCap = langHost.querySelectorAll(".dshq-cap")[0];
	langCap.rect = { left: 100, top: 300, width: 180, height: 22 };
	langCap.dispatch("mouseenter", {});
	check(
		"a language-only code quote offers no file line",
		pop()?.querySelector(".dshq-pop-source") === null && pop()?.querySelector(".dshq-pop-code")?.textContent === "const x = 1;",
		JSON.stringify([pop()?.querySelector(".dshq-pop-source")?.textContent, pop()?.querySelector(".dshq-pop-code")?.textContent])
	);
	langCap.dispatch("mouseleave", {});
	await wait(200);
	langHost.remove();
}

/* ------------------------------------------------------------------ *
 * 文件路径 + 逐条回应 — the wire's two new transport-only forms
 * ------------------------------------------------------------------ */

{
	// 预览引用: the file rides in the fence's info string, where Markdown keeps
	// metadata the model reads but renderers never show as content.
	check(
		"a preview quote puts its file into the fence info string",
		testing.quoteBlock("const x = 1;", "", true, { path: "src/app.ts" }) === "> ❝ ``` src/app.ts\n> const x = 1;\n> ```",
		JSON.stringify(testing.quoteBlock("const x = 1;", "", true, { path: "src/app.ts" }))
	);
	const pathSegments = testing.splitQuoteRuns(testing.quoteBlock("const x = 1;", "看一下", true, { path: "src/app.ts" }));
	check(
		"the path parses back as the fence's info string",
		pathSegments?.length === 1 && pathSegments[0].code === "src/app.ts" && pathSegments[0].quote === "const x = 1;" && pathSegments[0].comment === "看一下",
		JSON.stringify(pathSegments)
	);
	check(
		"a path rides along when the content forces ~~~",
		testing.quoteBlock("```\nx = 1\n```", "", true, { path: "src/a.ts" }) === "> ❝ ~~~ src/a.ts\n> ```\n> x = 1\n> ```\n> ~~~",
		JSON.stringify(testing.quoteBlock("```\nx = 1\n```", "", true, { path: "src/a.ts" }))
	);
	check(
		"a path with whitespace is dropped, not smuggled",
		testing.quoteBlock("x", "", true, { path: "my file.ts" }) === "> ❝ ```\n> x\n> ```",
		JSON.stringify(testing.quoteBlock("x", "", true, { path: "my file.ts" }))
	);
	check(
		"sanitizePath takes the obvious rejects",
		testing.sanitizePath(" src/a.ts ") === "src/a.ts" &&
			testing.sanitizePath("a b") === null &&
			testing.sanitizePath("a`b") === null &&
			testing.sanitizePath("a~b") === null &&
			testing.sanitizePath("") === null,
		JSON.stringify([testing.sanitizePath(" src/a.ts "), testing.sanitizePath("a b"), testing.sanitizePath("a`b"), testing.sanitizePath("a~b"), testing.sanitizePath("")])
	);

	// 逐条回应: one instruction line at the block's tail, wire-only.
	const replyWire = testing.quoteBlock("正文", "看看这里", false, { reply: true });
	check(
		"逐条回应 appends one instruction line to the block",
		replyWire === "> ❝ 正文\n> ❞ 看看这里\n> ※ 指令：请把本条消息里的引用块按出现顺序记为「引用1」「引用2」…，回复时逐条对应回应，每条回应前标注「引用N」。",
		JSON.stringify(replyWire)
	);
	const replySegments = testing.splitQuoteRuns(replyWire);
	check(
		"the instruction never reaches the capsule",
		replySegments?.length === 1 && replySegments[0].comment === "看看这里" && JSON.stringify(replySegments).includes("指令") === false,
		JSON.stringify(replySegments)
	);
	const replyBare = testing.splitQuoteRuns(testing.quoteBlock("正文", "", false, { reply: true }));
	check(
		"a reply instruction without a comment leaves the comment half empty",
		replyBare?.length === 1 && replyBare[0].comment === "" && replyBare[0].quote === "正文",
		JSON.stringify(replyBare)
	);
	const replyCode = testing.splitQuoteRuns(testing.quoteBlock("x=1", "改这里", true, { path: "src/a.ts", reply: true }));
	check(
		"path and instruction travel in one code block",
		replyCode?.length === 1 && replyCode[0].code === "src/a.ts" && replyCode[0].comment === "改这里" && JSON.stringify(replyCode).includes("指令") === false,
		JSON.stringify(replyCode)
	);
	check(
		"the side thread's fence carries the file too",
		testing.sideQuestion("x=1", true, "src/app.ts") === "``` src/app.ts\nx=1\n```",
		JSON.stringify(testing.sideQuestion("x=1", true, "src/app.ts"))
	);
	check(
		"the side thread drops a whitespace path",
		testing.sideQuestion("x=1", true, "my file.ts") === "```\nx=1\n```",
		JSON.stringify(testing.sideQuestion("x=1", true, "my file.ts"))
	);
	check(
		"a chat code block's language rides in the fence info when there is no file",
		testing.quoteBlock("const x = 1;", "", true, { lang: "ts" }) === "> ❝ ``` ts\n> const x = 1;\n> ```",
		JSON.stringify(testing.quoteBlock("const x = 1;", "", true, { lang: "ts" }))
	);
	check(
		"the file wins the fence info over the language",
		testing.quoteBlock("const x = 1;", "", true, { path: "src/a.ts", lang: "ts" }) === "> ❝ ``` src/a.ts\n> const x = 1;\n> ```",
		JSON.stringify(testing.quoteBlock("const x = 1;", "", true, { path: "src/a.ts", lang: "ts" }))
	);
	check(
		"a language tag round-trips as the fence info string",
		testing.splitQuoteRuns(testing.quoteBlock("const x = 1;", "", true, { lang: "ts" }))?.[0]?.code === "ts",
		JSON.stringify(testing.splitQuoteRuns(testing.quoteBlock("const x = 1;", "", true, { lang: "ts" })))
	);
	check(
		"a junk language degrades to a bare fence",
		testing.quoteBlock("const x = 1;", "", true, { lang: "not a lang" }) === "> ❝ ```\n> const x = 1;\n> ```",
		JSON.stringify(testing.quoteBlock("const x = 1;", "", true, { lang: "not a lang" }))
	);
	check(
		"the side thread's fence carries the language too",
		testing.sideQuestion("x=1", true, null, "ts") === "``` ts\nx=1\n```",
		JSON.stringify(testing.sideQuestion("x=1", true, null, "ts"))
	);

	// previewPathOf: walk the ancestors, skip values that cannot be a path.
	const outer = dom.document.createElement("div");
	outer.setAttribute("data-file-path", "src/app.ts");
	const mid = dom.document.createElement("div");
	mid.setAttribute("data-textpreview-body", "");
	mid.setAttribute("data-path", "bad path");
	outer.append(mid);
	check(
		"previewPathOf finds the ancestor's path and skips a whitespace one",
		testing.previewPathOf(mid) === "src/app.ts",
		JSON.stringify(testing.previewPathOf(mid))
	);
	check("previewPathOf misses cleanly on a bare host", testing.previewPathOf(dom.document.createElement("div")) === null);

	// The real host shape: the path label lives in a header SIBLING of the body
	// the selection is in — the probe has to find it through the preview root,
	// reading the full path from the label's title.
	const previewRoot = dom.document.createElement("div");
	previewRoot.setAttribute("data-document-preview", "doc-1");
	const header = dom.document.createElement("div");
	const label = dom.document.createElement("span");
	label.setAttribute("data-textpreview-path", "");
	label.setAttribute("title", "src/app.ts");
	header.append(label);
	const previewBody = dom.document.createElement("div");
	previewBody.setAttribute("data-textpreview-body", "");
	previewRoot.append(header);
	previewRoot.append(previewBody);
	check(
		"previewPathOf reads the header's path label through the preview root",
		testing.previewPathOf(previewBody) === "src/app.ts",
		JSON.stringify(testing.previewPathOf(previewBody))
	);
	const clippedLabel = dom.document.createElement("span");
	clippedLabel.setAttribute("data-textpreview-path", "");
	clippedLabel.setAttribute("title", "my file.ts");
	const clippedRoot = dom.document.createElement("div");
	clippedRoot.setAttribute("data-document-preview", "doc-2");
	clippedRoot.append(clippedLabel, dom.document.createElement("div"));
	check(
		"a label whose path cannot be a token costs nothing",
		testing.previewPathOf(clippedRoot.lastChild) === null,
		JSON.stringify(testing.previewPathOf(clippedRoot.lastChild))
	);

	// ---- diff selection: a diff card inside a message is code, not prose ----
	const diffPane = dom.document.createElement("div");
	diffPane.setAttribute("data-conversation-content", "");
	diffPane.setAttribute("data-conversation-session", "session-diff");
	const diffRow = dom.document.createElement("div");
	diffRow.setAttribute("data-chat-anchor-key", "row-diff");
	diffRow.setAttribute("data-chat-turn", "7");
	const diffCard = dom.document.createElement("div");
	diffCard.setAttribute("data-diff-view", "");
	const diffHeader = dom.document.createElement("span");
	diffHeader.setAttribute("data-file-path", "");
	diffHeader.setAttribute("title", "src/app.ts");
	const diffLine = dom.document.createElement("div");
	diffLine.setAttribute("data-line-number", "12");
	diffLine.textContent = "const x = 1;";
	diffCard.append(diffHeader);
	diffCard.append(diffLine);
	diffRow.append(diffCard);
	diffPane.append(diffRow);
	dom.document.body.append(diffPane);
	check("diffPathOf reads the header's path", testing.diffPathOf(diffLine) === "src/app.ts", JSON.stringify(testing.diffPathOf(diffLine)));
	check("diffLineOf reads the numbered line", testing.diffLineOf(diffLine) === 12, String(testing.diffLineOf(diffLine)));
	dom.document.selection = {
		isCollapsed: false,
		rangeCount: 1,
		toString: () => "const x = 1;",
		removeAllRanges() {},
		getRangeAt: () => ({
			startContainer: diffLine.firstChild,
			endContainer: diffLine.firstChild,
			intersectsNode: () => false,
			getBoundingClientRect: () => ({ left: 100, top: 300, right: 220, bottom: 318, width: 120, height: 18 })
		})
	};
	const diffSelection = testing.readSelection();
	check(
		"a diff selection is quoted as code with its path and line",
		diffSelection?.hostKind === "diff" && diffSelection?.path === "src/app.ts#L12",
		JSON.stringify(diffSelection)
	);
	dom.document.selection = null;
	diffPane.remove();

	// A chat selection inside one rendered code block is code too: the fence
	// carries the renderer's language, and the quote still jumps to its row.
	const codePane = dom.document.createElement("div");
	codePane.setAttribute("data-conversation-content", "");
	codePane.setAttribute("data-conversation-session", "session-chatcode");
	const chatRow = dom.document.createElement("div");
	chatRow.setAttribute("data-chat-anchor-key", "row-chatcode");
	chatRow.setAttribute("data-chat-turn", "3");
	const chatPre = dom.document.createElement("pre");
	const chatCode = dom.document.createElement("code");
	chatCode.className = "language-ts";
	chatCode.textContent = "const x = 1;";
	chatPre.append(chatCode);
	chatRow.append(chatPre);
	codePane.append(chatRow);
	dom.document.body.append(codePane);
	dom.document.selection = {
		isCollapsed: false,
		rangeCount: 1,
		toString: () => "const x = 1;",
		removeAllRanges() {},
		getRangeAt: () => ({
			startContainer: chatCode.firstChild,
			endContainer: chatCode.firstChild,
			intersectsNode: () => false,
			getBoundingClientRect: () => ({ left: 100, top: 300, right: 220, bottom: 318, width: 120, height: 18 })
		})
	};
	const chatCodeSelection = testing.readSelection();
	check(
		"a chat code block selection is code with the renderer's language",
		chatCodeSelection?.hostKind === "chat" && chatCodeSelection?.lang === "ts" && chatCodeSelection?.source !== null,
		JSON.stringify(chatCodeSelection)
	);
	// A selection that crosses the block boundary degrades to a plain quote.
	const afterBlock = dom.document.createElement("p");
	afterBlock.textContent = "后面的正文";
	codePane.append(afterBlock);
	dom.document.selection = {
		isCollapsed: false,
		rangeCount: 1,
		toString: () => "const x = 1;",
		removeAllRanges() {},
		getRangeAt: () => ({
			startContainer: chatCode.firstChild,
			endContainer: afterBlock.firstChild,
			intersectsNode: () => false,
			getBoundingClientRect: () => ({ left: 100, top: 300, right: 220, bottom: 318, width: 120, height: 18 })
		})
	};
	const crossingSelection = testing.readSelection();
	check(
		"a selection crossing the code block boundary stays a plain quote",
		crossingSelection?.hostKind === "chat" && crossingSelection?.lang === null,
		JSON.stringify(crossingSelection)
	);
	// Two messages in one selection: the text still travels, but no single row
	// can claim it — a turn/role here would be a lie about half the sentence.
	const secondRow = dom.document.createElement("div");
	secondRow.setAttribute("data-chat-anchor-key", "row-chatcode-2");
	secondRow.setAttribute("data-chat-turn", "4");
	secondRow.setAttribute("data-chat-role", "assistant");
	secondRow.textContent = "第二条消息里的文字";
	codePane.append(secondRow);
	dom.document.selection = {
		isCollapsed: false,
		rangeCount: 1,
		toString: () => "const x = 1;第二条消息里的文字",
		removeAllRanges() {},
		getRangeAt: () => ({
			startContainer: chatCode.firstChild,
			endContainer: secondRow.firstChild,
			intersectsNode: () => false,
			getBoundingClientRect: () => ({ left: 100, top: 300, right: 220, bottom: 318, width: 120, height: 18 })
		})
	};
	const spanningSelection = testing.readSelection();
	check(
		"a selection spanning two messages carries no source",
		spanningSelection?.hostKind === "chat" && spanningSelection?.source === null && spanningSelection?.text.includes("第二条"),
		JSON.stringify({ source: spanningSelection?.source, text: spanningSelection?.text })
	);
	dom.document.selection = null;
	codePane.remove();

	// withLineRange: GitHub's #L spelling, normalized, or nothing.
	check(
		"withLineRange composes the GitHub line range",
		testing.withLineRange("src/app.ts", 12, 48) === "src/app.ts#L12-L48" &&
			testing.withLineRange("src/app.ts", 7, 7) === "src/app.ts#L7" &&
			testing.withLineRange("src/app.ts", 48, 12) === "src/app.ts#L12-L48",
		JSON.stringify([testing.withLineRange("src/app.ts", 12, 48), testing.withLineRange("src/app.ts", 7, 7), testing.withLineRange("src/app.ts", 48, 12)])
	);
	check(
		"withLineRange degrades honestly",
		testing.withLineRange("my file.ts", 1, 2) === null && testing.withLineRange("src/a.ts", null, 4) === "src/a.ts" && testing.withLineRange("src/a.ts", 0, 4) === "src/a.ts",
		JSON.stringify([testing.withLineRange("my file.ts", 1, 2), testing.withLineRange("src/a.ts", null, 4), testing.withLineRange("src/a.ts", 0, 4)])
	);
	check(
		"a path with a range still parses back as the fence info string",
		testing.splitQuoteRuns(testing.quoteBlock("const x = 1;", "", true, { path: "src/app.ts#L12-L48" }))?.[0]?.code === "src/app.ts#L12-L48",
		JSON.stringify(testing.splitQuoteRuns(testing.quoteBlock("const x = 1;", "", true, { path: "src/app.ts#L12-L48" }))
		)
	);
	check(
		"parseCodeSource splits the GitHub line range",
		JSON.stringify(testing.parseCodeSource("src/app.ts#L12-L48")) === JSON.stringify({ path: "src/app.ts", line: 12, end: 48 }),
		JSON.stringify(testing.parseCodeSource("src/app.ts#L12-L48"))
	);
	check(
		"parseCodeSource keeps a bare path openable",
		JSON.stringify(testing.parseCodeSource("src/app.ts")) === JSON.stringify({ path: "src/app.ts", line: null, end: null }),
		JSON.stringify(testing.parseCodeSource("src/app.ts"))
	);
	check(
		"parseCodeSource refuses an impossible range",
		testing.parseCodeSource("src/app.ts#L12-L3") === null && testing.parseCodeSource("") === null,
		JSON.stringify([testing.parseCodeSource("src/app.ts#L12-L3"), testing.parseCodeSource("")])
	);
	check(
		"a bare language tag is not a file to open",
		testing.parseCodeSource("ts") === null && testing.parseCodeSource("c++") === null,
		JSON.stringify([testing.parseCodeSource("ts"), testing.parseCodeSource("c++")])
	);
	const winPath = String.raw`C:\a b\app.ts`;
	check(
		"fileAddressFor builds the session resource address",
		testing.fileAddressFor("session-a", "src/app.ts") === "dsh-resource://file/session/session-a/src/app.ts" &&
			testing.fileAddressFor("会话 α", winPath) === "dsh-resource://file/session/%E4%BC%9A%E8%AF%9D%20%CE%B1/C:/a%20b/app.ts",
		JSON.stringify([testing.fileAddressFor("session-a", "src/app.ts"), testing.fileAddressFor("会话 α", winPath)])
	);
}

/* ------------------------------------------------------------------ *
 * 回复徽章 — the model's 「引用N」 labels link back to the quotes
 * ------------------------------------------------------------------ */

{
	const badgeHost = dom.document.createElement("div");
	badgeHost.setAttribute("data-conversation-content", "");
	badgeHost.setAttribute("data-conversation-session", "session-badge");
	const userBubble = dom.document.createElement("div");
	const quoteRun = dom.document.createElement("span");
	quoteRun.className = "plainRun";
	const replyValue = "回答一「引用1」；回答二「引用2」；越界「引用9」；结尾";
	quoteRun.textContent = "问题" + testing.quoteBlock("第一处引用", "注一") + "\n\n中间的话\n\n" + testing.quoteBlock("第二处引用", "注二") + "\n\n";
	userBubble.append(quoteRun);
	badgeHost.append(userBubble);
	const replyParagraph = dom.document.createElement("p");
	const replyText = dom.document.createTextNode(replyValue);
	replyParagraph.append(replyText);
	badgeHost.append(replyParagraph);
	dom.document.body.append(badgeHost);
	dom.document.deliver();
	await wait(120);

	const badges = () => replyParagraph.querySelectorAll(".dshq-ref");
	check("two quoted messages come back as two capsules", badgeHost.querySelectorAll(".dshq-cap").length === 2, badgeHost.querySelectorAll(".dshq-cap").length + " capsule(s)");
	check("a reply label becomes a badge", badges().length === 2, badges().length + " badge(s)");
	check(
		"the reply reads the same with badges in place",
		replyParagraph.textContent === replyValue,
		JSON.stringify(replyParagraph.textContent)
	);
	check(
		"only labels the quotes can answer are badged",
		JSON.stringify(Array.from(badges()).map((badge) => badge.textContent)) === JSON.stringify(["「引用1」", "「引用2」"]),
		JSON.stringify(Array.from(badges()).map((badge) => badge.textContent))
	);

	// An assistant reply in a conversation with no quoted message stays plain.
	const bareHost = dom.document.createElement("div");
	bareHost.setAttribute("data-conversation-content", "");
	bareHost.setAttribute("data-conversation-session", "session-bare");
	const bareParagraph = dom.document.createElement("p");
	bareParagraph.textContent = "回应「引用1」但没有先前的引用";
	bareHost.append(bareParagraph);
	dom.document.body.append(bareHost);
	dom.document.deliver();
	await wait(120);
	check("a reply without a preceding quote is not badged", bareParagraph.querySelectorAll(".dshq-ref").length === 0, bareParagraph.querySelectorAll(".dshq-ref").length + " badge(s)");

	// The badge reuses the hover card, quote and comment in full.
	const firstBadge = badges()[0];
	firstBadge.rect = { left: 80, top: 300, width: 64, height: 20 };
	firstBadge.dispatch("mouseenter", {});
	check(
		"hovering a badge opens the quote's card",
		pop()?.querySelector(".dshq-pop-quote")?.textContent === "第一处引用",
		JSON.stringify(pop()?.querySelector(".dshq-pop-quote")?.textContent)
	);
	check(
		"the badge's card shows the comment too",
		pop()?.querySelector(".dshq-pop-comment")?.textContent === "注一",
		JSON.stringify(pop()?.querySelector(".dshq-pop-comment")?.textContent)
	);
	firstBadge.dispatch("mouseleave", {});
	await wait(200);
	check("leaving a badge closes the card", pop()?.dataset.visible === "false", JSON.stringify(pop()?.dataset.visible));

	// A quote the plugin never watched has no coordinates: clicking the badge
	// must not pretend to jump — no throw, no toast. (An earlier section left a
	// jump-failure toast mid-display; hide it first so only this click counts.)
	const leftoverToast = dom.document.getElementById("dsh-quote-toast");
	if (leftoverToast !== null) leftoverToast.dataset.visible = "false";
	check("the badge's quote was never traced", testing.sourceFor("第一处引用") === null);
	firstBadge.dispatch("click", { stopPropagation() {} });
	check(
		"a badge without coordinates jumps nowhere quietly",
		dom.document.getElementById("dsh-quote-toast")?.dataset.visible !== "true",
		JSON.stringify(dom.document.getElementById("dsh-quote-toast")?.dataset.visible)
	);

	dom.document.deliver();
	await wait(120);
	check("an unrelated flush does not duplicate badges", badges().length === 2, badges().length + " badge(s)");

	// React rewrites the text node: the stale split goes and the fresh value
	// is re-read, so the badges always match what the reply says now.
	replyText.textContent = "改写后只提「引用2」一次";
	dom.document.deliver();
	await wait(120);
	check(
		"a rewritten reply re-badges from the fresh text",
		badges().length === 1 && badges()[0].textContent === "「引用2」" && replyParagraph.textContent === "改写后只提「引用2」一次",
		JSON.stringify([badges().length, replyParagraph.textContent])
	);

	// Uninstall puts the original text back and takes every badge with it.
	capsuleEffect.dispose();
	check(
		"uninstall restores the reply text and drops the badges",
		replyParagraph.querySelectorAll(".dshq-ref").length === 0 && replyParagraph.textContent === "改写后只提「引用2」一次",
		JSON.stringify(replyParagraph.textContent)
	);
}

/* ------------------------------------------------------------------ *
 * 逐条回应的开关 — the comment box checkbox drives the wire
 * ------------------------------------------------------------------ */

{
	const overlay = registered.find((entry) => entry.spec.name === "conversation.input.overlay");
	const toggleInsertions = [];
	shells.set("session-toggle", {
		insertReference(attachment) {
			toggleInsertions.push(attachment);
			return true;
		}
	});
	if (overlay !== undefined) overlay.Component({ sessionId: "session-toggle", inputActions: { captureInsertion: () => ({ draftRev: 1 }) } });

	testing.startRevision("一处引用", "", "session-toggle", null, false);
	const bar = dom.document.getElementById("dsh-quote-bar");
	const replyCheck = bar?.querySelector(".dshq-reply-check");
	check("the comment box carries the per-quote toggle", replyCheck !== null && replyCheck !== undefined);
	check("the toggle starts off", replyCheck?.checked === false, String(replyCheck?.checked));
	const quoteBox = bar.querySelector(".dshq-quote-input");
	const commentBox = bar.querySelector(".dshq-comment-input");
	const confirmBtn = bar.querySelector('[data-action="confirm"]');
	quoteBox.value = "一处引用";
	quoteBox.dispatch("input", {});
	commentBox.value = "请照着改";
	commentBox.dispatch("input", {});
	bar.dispatch("click", { target: confirmBtn });
	check(
		"toggle off: the wire carries no instruction",
		toggleInsertions.length === 1 && String(toggleInsertions[0]?.ref ?? "").includes("指令") === false,
		JSON.stringify(String(toggleInsertions[0]?.ref ?? "").trim())
	);

	testing.startRevision("一处引用", "", "session-toggle", null, false);
	const bar2 = dom.document.getElementById("dsh-quote-bar");
	const replyCheck2 = bar2.querySelector(".dshq-reply-check");
	replyCheck2.checked = true;
	replyCheck2.dispatch("change", {});
	const quoteBox2 = bar2.querySelector(".dshq-quote-input");
	const commentBox2 = bar2.querySelector(".dshq-comment-input");
	const confirmBtn2 = bar2.querySelector('[data-action="confirm"]');
	quoteBox2.value = "一处引用";
	quoteBox2.dispatch("input", {});
	commentBox2.value = "请照着改";
	commentBox2.dispatch("input", {});
	bar2.dispatch("click", { target: confirmBtn2 });
	check(
		"toggle on: the wire carries the per-quote instruction",
		toggleInsertions.length === 2 && String(toggleInsertions[1]?.ref ?? "").includes("※ 指令："),
		JSON.stringify(String(toggleInsertions[1]?.ref ?? "").trim().slice(-40))
	);
}

/* ------------------------------------------------------------------ *
 * 浮层不跟着座位生死 — the bar is document-level, so neither its
 * listeners nor the action behind one of its rows may depend on an
 * overlay slot entry still being mounted.
 *
 * The listeners used to be reference-counted by the slot component: an
 * overlapping mount pair (a side thread's composer over a running
 * parent, a re-registered slot) could drive the count to zero, the
 * document listeners were then removed for good, and the bar never came
 * back until a page reload — the "引用插件经常失效" report. A commit
 * whose slot entry had gone also returned silently.
 * ------------------------------------------------------------------ */

{
	// The reply-badge section uninstalled the whole transcript runtime on
	// purpose (uninstall takes the stylesheet and the listeners with it now);
	// this block is about the bar still working, so put it back.
	const capsuleBack = effects.find((entry) => String(entry.label).includes("transcript runtime"));
	capsuleBack.fn();
	const listenersEffect = effects.find((entry) => String(entry.label).includes("transcript runtime"));
	check("the bar's listeners are installed with the plugin, not with a slot", listenersEffect !== undefined);
	check(
		"and the runtime is refcounted, so one mount's teardown keeps them",
		typeof listenersEffect.fn === "function" && typeof listenersEffect.dispose === "function",
		JSON.stringify(Object.keys(listenersEffect ?? {}))
	);
	check(
		"and they are one document-level set, never a slot-scoped count",
		(dom.document.listeners.get("pointerup") ?? []).length === 1,
		JSON.stringify((dom.document.listeners.get("pointerup") ?? []).length)
	);

	const pane = (sessionId, text) => {
		const node = dom.document.createElement("div");
		node.setAttribute("data-conversation-content", "");
		node.setAttribute("data-conversation-session", sessionId);
		const bubble = dom.document.createElement("div");
		bubble.className = "bubble";
		const run = dom.document.createElement("span");
		run.className = "plainRun";
		run.textContent = text;
		bubble.append(run);
		node.append(bubble);
		dom.document.body.append(node);
		return { node, run };
	};
	const selectIn = (run, text) => {
		dom.document.selection = {
			isCollapsed: false,
			rangeCount: 1,
			toString: () => text,
			removeAllRanges() {
				dom.document.selection = null;
			},
			getRangeAt: () => ({
				startContainer: run.firstChild,
				endContainer: run.firstChild,
				intersectsNode: () => false,
				getBoundingClientRect: () => ({ left: 100, top: 300, right: 220, bottom: 318, width: 120, height: 18 })
			})
		};
		dom.document.dispatch("pointerdown", { target: run.firstChild });
		dom.document.dispatch("pointerup", { target: run.firstChild });
	};
	const barOf = () => dom.document.getElementById("dsh-quote-bar");

	// 1. The composer slot never mounted for this session at all.
	const firstPane = pane("session-bar", "浮层要跟着手走的原文");
	selectIn(firstPane.run, "浮层要跟着手走的原文");
	check(
		"a selection opens the bar even with no composer slot mounted for that session",
		barOf()?.dataset.visible === "true",
		JSON.stringify(barOf()?.dataset.visible)
	);
	check("the source selection stays highlighted while the bar is open", highlightRegistry.has("dshq-selection"));
	check(
		"the bar offers the actions",
		barOf()?.querySelector('[data-action="add"]') !== null && barOf()?.querySelector('[data-action="comment"]') !== null
	);
	check(
		"the side chat is one row, never two competing entries",
		barOf()?.querySelector('[data-action="sidechatNew"]') === null &&
			barOf()?.querySelector(".dshq-row-sidechat-new") === null &&
			(barOf()?.querySelectorAll('[data-action^="sidechat"]') ?? []).length <= 1,
		JSON.stringify((barOf()?.querySelectorAll('[data-action^="sidechat"]') ?? []).map((row) => row.getAttribute("data-action")))
	);

	// 2. A slot comes and goes — the listeners are not tied to it.
	const overlay = registered.find((entry) => entry.spec.name === "conversation.input.overlay");
	check("the overlay slot is registered for mounting", overlay !== undefined);
	dom.document.dispatch("keydown", { key: "Escape", isComposing: false, target: firstPane.run });
	check("Escape closes the bar", barOf()?.dataset.visible === "false", JSON.stringify(barOf()?.dataset.visible));
	check("closing the bar clears the source highlight", highlightRegistry.has("dshq-selection") === false);
	// The bar calls preventDefault() on its own mousedown so the transcript
	// selection survives while a row is aimed at — which is exactly why it has
	// to hand the selection back when it leaves without an action. Otherwise the
	// reader who picks a row and backs out is left with a selection nothing can
	// clear.
	selectIn(firstPane.run, "浮层要跟着手走的原文");
	check("the selection is live before a row is aimed at", dom.document.selection !== null);
	barOf().dispatch("mousedown", { target: barOf().querySelector('[data-action="add"]'), preventDefault() {} });
	dom.document.dispatch("keydown", { key: "Escape", isComposing: false, target: firstPane.run });
	check(
		"dismissing the bar hands back the selection it kept alive",
		dom.document.selection === null && barOf()?.dataset.visible === "false",
		JSON.stringify({ selection: dom.document.selection === null, visible: barOf()?.dataset.visible })
	);
	if (overlay !== undefined) {
		overlay.Component({ sessionId: "session-bar", inputActions: { captureInsertion: () => ({ draftRev: 1 }) } });
		overlay.Component({ sessionId: "session-bar-2", inputActions: { captureInsertion: () => ({ draftRev: 2 }) } });
	}
	check(
		"mounting two composers does not stack or drop the listeners",
		(dom.document.listeners.get("pointerup") ?? []).length === 1,
		JSON.stringify((dom.document.listeners.get("pointerup") ?? []).length)
	);
	selectIn(firstPane.run, "浮层要跟着手走的原文");
	check("the bar still opens after a slot mounted", barOf()?.dataset.visible === "true", JSON.stringify(barOf()?.dataset.visible));

	// 3. A session with no slot entry still lands its chip: the composer's own
	//    actions stand in for the entry that is not there.
	const landed = [];
	shells.set("session-noslot", {
		actions: { captureInsertion: () => ({ draftRev: 7 }) },
		insertReference(attachment) {
			landed.push(attachment);
			return true;
		}
	});
	const secondPane = pane("session-noslot", "没有座位的会话也要能引用");
	selectIn(secondPane.run, "没有座位的会话也要能引用");
	barOf().dispatch("click", { target: barOf().querySelector('[data-action="add"]') });
	check(
		"the chip lands through the composer's own actions",
		landed.length === 1 && String(landed[0]?.ref ?? "").includes("没有座位的会话也要能引用"),
		JSON.stringify([landed.length, String(landed[0]?.ref ?? "").slice(0, 24)])
	);

	// 3a. 这条坐标要和芯片绑定在一起：删除芯片（没有发送）时，聚合条的回执就是
	//     靠它把原文上的高亮收回去的（见后面的「原文侧高亮」段）。
	const chipMarked = [];
	shells.set("session-chip-mark", {
		actions: { captureInsertion: () => ({ start: 0, end: 0, draftRev: 3 }) },
		insertReference(attachment) {
			chipMarked.push(attachment);
			return true;
		}
	});
	const markPane = pane("session-chip-mark", "芯片会带走这条坐标");
	markPane.run.parentNode.setAttribute("data-chat-anchor-key", "row-chip-mark");
	markPane.run.parentNode.setAttribute("data-chat-turn", "12");
	selectIn(markPane.run, "芯片会带走这条坐标");
	barOf().dispatch("click", { target: barOf().querySelector('[data-action="add"]') });
	const markTable = JSON.parse(globalThis.localStorage.getItem("dsh-client-ui-quote:v2:quote-source") ?? "{}");
	const markSaved = Object.values(markTable).flat().find((entry) => entry?.key === "row-chip-mark");
	check(
		"a quote added to the chat ties its coordinate to the chip",
		chipMarked.length === 1 && markSaved?.chip === true,
		JSON.stringify({ inserted: chipMarked.length, saved: markSaved === undefined ? null : { key: markSaved.key, chip: markSaved.chip } })
	);

	// 3b. A draft that already holds the reader's wording: the quote goes to
	//     the top and the wording moves to a line of its own below it.
	const lineCalls = [];
	let lineDraft = "已经写好的问题";
	let lineCaret = lineDraft.length;
	let lineRev = 1;
	shells.set("session-line", {
		state: { getSnapshot: () => ({ draft: lineDraft, occurrences: [] }) },
		actions: {
			captureInsertion: () => ({ start: lineCaret, end: lineCaret, draftRev: lineRev }),
			insertText(text, span) {
				lineCalls.push({ kind: "text", text, span });
				lineDraft = lineDraft.slice(0, span.start) + text + lineDraft.slice(span.end);
				lineCaret = span.start + text.length;
				lineRev += 1;
				return true;
			}
		},
		insertReference(attachment, span) {
			lineCalls.push({ kind: "reference", span, attachment });
			const model = String(attachment?.ref ?? "");
			lineDraft = lineDraft.slice(0, span.start) + model + lineDraft.slice(span.end);
			lineCaret = span.start + model.length;
			lineRev += 1;
			return true;
		}
	});
	const linePane = pane("session-line", "引用要自己起一行的原文");
	selectIn(linePane.run, "引用要自己起一行的原文");
	barOf().dispatch("click", { target: barOf().querySelector('[data-action="add"]') });
	check(
		"a quote in a written draft goes to the top",
		lineCalls[0]?.kind === "reference" && lineCalls[0]?.span?.start === 0 && lineCalls[0]?.span?.end === 0 && lineCalls[0]?.span?.draftRev === 1,
		JSON.stringify(lineCalls.map((call) => [call.kind, call.span?.start, call.span?.end, call.span?.draftRev]))
	);
	check(
		"and the wording moves below it on a new line",
		lineCalls[1]?.kind === "text" && lineCalls[1]?.text === "\n" && lineCalls[1]?.span?.draftRev === 2 && lineDraft.endsWith("\n已经写好的问题"),
		JSON.stringify(lineCalls.map((call) => [call.kind, call.text, call.span?.draftRev]))
	);
	check(
		"the quote keeps its wire block in front",
		lineDraft.startsWith(String(lineCalls[0]?.attachment?.ref ?? "")) && String(lineCalls[0]?.attachment?.ref ?? "").includes("引用要自己起一行的原文"),
		JSON.stringify(lineDraft.slice(0, 24))
	);

	// 4. With nowhere to insert, the reader is told instead of left wondering.
	const thirdPane = pane("session-noshell", "没有输入框的会话");
	selectIn(thirdPane.run, "没有输入框的会话");
	const staleToast = dom.document.getElementById("dsh-quote-toast");
	if (staleToast !== null) staleToast.textContent = "";
	barOf().dispatch("click", { target: barOf().querySelector('[data-action="add"]') });
	const toastNode = dom.document.getElementById("dsh-quote-toast");
	check(
		"a dead end says so instead of doing nothing",
		String(toastNode?.textContent) === "插入失败，请重试",
		JSON.stringify(toastNode?.textContent)
	);

	// 5. Disposal is honest: the effect takes its listeners with it, and
	//    reinstalling puts exactly one set back.
	listenersEffect.dispose();
	check(
		"disposing the effect removes the listeners",
		(dom.document.listeners.get("pointerup") ?? []).length === 0,
		JSON.stringify((dom.document.listeners.get("pointerup") ?? []).length)
	);
	listenersEffect.fn();
	check(
		"reinstalling brings back exactly one set",
		(dom.document.listeners.get("pointerup") ?? []).length === 1,
		JSON.stringify((dom.document.listeners.get("pointerup") ?? []).length)
	);
	selectIn(firstPane.run, "浮层要跟着手走的原文");
	check("the bar works again after a reinstall", barOf()?.dataset.visible === "true", JSON.stringify(barOf()?.dataset.visible));

	dom.document.selection = null;
	dom.document.dispatch("keydown", { key: "Escape", isComposing: false, target: firstPane.run });
}

/* ------------------------------------------------------------------ *
 * 自带坐标 — the ref rides in the text, the v2 table keeps arrays
 * ------------------------------------------------------------------ */

{
	// The reply-badge section uninstalled the enhancer on purpose; this block
	// renders its own transcripts, so put it back.
	capsuleEffect.fn();
	const dict = dictionaries[0];
	const V2_KEY = "dsh-client-ui-quote:v2:quote-source";
	const V1_KEY = "dsh-client-ui-quote:v1:quote-source";
	const MIGRATED_KEY = "dsh-client-ui-quote:v2:quote-source-migrated";

	/** A session pane with a scrollport and rows laid out in transcript space. */
	const pane = (sessionId) => {
		const root = dom.document.createElement("div");
		root.setAttribute("data-conversation-content", "");
		root.setAttribute("data-conversation-session", sessionId);
		const port = dom.document.createElement("div");
		port.setAttribute("data-conversation-scroll", "");
		port.scrollTop = 0;
		port.clientHeight = 400;
		port.getBoundingClientRect = () => ({ left: 0, top: 0, right: 800, bottom: 400, width: 800, height: 400 });
		root.append(port);
		dom.document.body.append(root);
		const put = (key, turn, top) => {
			const node = dom.document.createElement("div");
			node.setAttribute("data-chat-anchor-key", key);
			node.setAttribute("data-chat-turn", turn);
			node.getBoundingClientRect = () => {
				const y = top - port.scrollTop;
				return { left: 0, top: y, right: 800, bottom: y + 40, width: 800, height: 40 };
			};
			port.append(node);
			return node;
		};
		return { root, port, put };
	};

	/** One transcript run, as a sent message would arrive after a reload. */
	const quoteRun = (host, text, block) => {
		const bubble = dom.document.createElement("div");
		const run = dom.document.createElement("span");
		run.className = "plainRun";
		run.textContent = text + block + "\n\n";
		bubble.append(run);
		host.append(bubble);
		return bubble;
	};

	const sourceOf = (sessionId, key, turn) => ({ attr: "data-chat-anchor-key", key, turn, sessionId });

	// ---- the codec: non-ASCII, JSON round-trip, no URL-unsafe characters ----
	const refSession = "会话 α/β + 空格";
	const ref = { v: 1, s: refSession, a: "data-chat-anchor-key", k: "row-字-1", t: "3", n: 2 };
	const encoded = testing.encodeQuoteRef(ref);
	const decoded = testing.decodeQuoteRef(encoded);
	check("a ref is base64url with no padding", /^[A-Za-z0-9_-]+$/.test(encoded) && encoded.includes("=") === false, encoded);
	check("a ref round-trips a non-ASCII session id", JSON.stringify(decoded) === JSON.stringify(ref), JSON.stringify(decoded));
	check("a ref survives a JSON round-trip", JSON.stringify(testing.decodeQuoteRef(JSON.parse(JSON.stringify(encoded)))) === JSON.stringify(ref));
	check(
		"a corrupt ref is null and never throws",
		testing.decodeQuoteRef("AAAA") === null && testing.decodeQuoteRef("") === null && testing.decodeQuoteRef(undefined) === null && testing.decodeQuoteRef("a+b/c") === null
	);

	// ---- role + readable source label ----
	const roleRef = { v: 1, s: refSession, a: "data-chat-anchor-key", k: "row-role", t: "6", n: 1, r: "a" };
	const roleEncoded = testing.encodeQuoteRef(roleRef);
	check("a ref carries an optional role", testing.decodeQuoteRef(roleEncoded)?.r === "a", JSON.stringify(testing.decodeQuoteRef(roleEncoded)));
	check("a ref without a role keeps its old shape", !("r" in testing.decodeQuoteRef(encoded)));
	check("the readable label is stable wire copy", testing.sourceLabel(roleRef) === "引自第 6 轮 · 助手", testing.sourceLabel(roleRef));
	check("a turn without a role still reads", testing.sourceLabel({ t: "6" }) === "引自第 6 轮", testing.sourceLabel({ t: "6" }));
	const labeledBlock = testing.quoteBlock("同一句话", "同一条评论", false, { ref: roleRef, label: testing.sourceLabel(roleRef) });
	check("the label rides in front of the coordinate", labeledBlock.endsWith("> ※ 引自第 6 轮 · 助手 │q1:" + roleEncoded), JSON.stringify(labeledBlock.slice(-48)));
	check(
		"the labeled ref line is stripped like the old one",
		testing.splitQuoteRuns(labeledBlock)?.[0]?.quote === "同一句话" && testing.splitQuoteRuns(labeledBlock)?.[0]?.ref?.r === "a",
		JSON.stringify(testing.splitQuoteRuns(labeledBlock)?.[0])
	);

	// ---- source-side highlight helpers ----
	const twice = testing.findQuoteSpans("甲乙丙甲乙", "甲乙");
	check("a repeated quote yields every occurrence", twice.length === 2 && twice[1].start === 3, JSON.stringify(twice));
	const foldedSpans = testing.findQuoteSpans("第一段\n第二段", "第一段 第二段");
	check("whitespace-folded text still anchors", foldedSpans.length === 1 && foldedSpans[0].start === 0 && foldedSpans[0].end === 7, JSON.stringify(foldedSpans));
	const folded = testing.foldWhitespace("a  b\nc");
	check("folded text maps back to original offsets", folded.text === "a b c" && folded.map.join(",") === "0,1,3,4,5", JSON.stringify(folded));
	const roleSource = testing.saveSource("带角色的引用", "session-role", { attr: "data-chat-anchor-key", key: "row-role", turn: "6", role: "a" });
	check("a saved source keeps the role", roleSource?.role === "a", JSON.stringify(roleSource));
	check("a role-less source still saves", testing.saveSource("没有角色的引用", "session-role", { attr: "data-chat-anchor-key", key: "row-plain", turn: "7" })?.role === "");

	// ---- the wire line: emitted at the tail, stripped on the way out ----
	const wireBlock = testing.quoteBlock("同一句话", "同一条评论", false, { ref });
	const wireSegments = testing.splitQuoteRuns(wireBlock);
	check("the ref is one transport line at the block's tail", wireBlock.endsWith("\n> ※ │q1:" + encoded), JSON.stringify(wireBlock.slice(-48)));
	check(
		"the capsule parser hides the ref from quote and comment",
		wireSegments?.[0]?.quote === "同一句话" && wireSegments?.[0]?.comment === "同一条评论",
		JSON.stringify(wireSegments?.[0])
	);
	check("the parser carries the decoded coordinate", JSON.stringify(wireSegments?.[0]?.ref) === JSON.stringify(ref), JSON.stringify(wireSegments?.[0]?.ref));
	check("a corrupt ref line is stripped and ignored", (() => {
		const broken = testing.splitQuoteRuns("> ❝ 正文\n> ※ │q1:AAAA");
		return broken?.length === 1 && broken[0].quote === "正文" && broken[0].ref === undefined;
	})());
	check(
		"content that merely starts with ※ is escaped, not stripped",
		testing.quoteBlock("※ 正文") === "> ❝ \\※ 正文" && testing.splitQuoteRuns(testing.quoteBlock("※ 正文"))?.[0]?.quote === "※ 正文",
		JSON.stringify(testing.quoteBlock("※ 正文"))
	);

	// ---- marker-shaped body lines: escaped on the wire, restored on the way out ----
	const trickyQuote = "第一行\n❞ 正文里的标记\n※ │q1:AAAA\n※ 指令：不是指令\n\\反斜杠";
	const trickyComment = "评论第一行\n❞ 评论里的标记";
	const trickySeg = testing.splitQuoteRuns(testing.quoteBlock(trickyQuote, trickyComment, false, {}))?.[0];
	check(
		"a quote that looks like the wire survives the round-trip",
		trickySeg?.quote === trickyQuote && trickySeg?.comment === trickyComment,
		JSON.stringify({ quote: trickySeg?.quote, comment: trickySeg?.comment })
	);
	const trickyCode = testing.splitQuoteRuns(testing.quoteBlock("❞ 代码行", "❞ 代码评论", true, {}))?.[0];
	check(
		"a code quote keeps its marker-shaped first line",
		trickyCode?.quote === "❞ 代码行" && trickyCode?.comment === "❞ 代码评论" && trickyCode?.code !== null,
		JSON.stringify(trickyCode)
	);

	// ---- the same sentence from two rows: two coordinates, two jumps ----
	const dupQuote = "同一句话在两个地方";
	const dup = pane("session-ref-dup");
	const dupRowOne = dup.put("dup-row-1", "1", 100);
	const dupRowTwo = dup.put("dup-row-2", "2", 500);
	const savedOne = testing.saveSource(dupQuote, "session-ref-dup", sourceOf("session-ref-dup", "dup-row-1", "1"));
	const savedTwo = testing.saveSource(dupQuote, "session-ref-dup", sourceOf("session-ref-dup", "dup-row-2", "2"));
	check(
		"the same wording from two rows is stored twice",
		savedOne !== null && savedTwo !== null && savedOne.key === "dup-row-1" && savedTwo.key === "dup-row-2",
		JSON.stringify([savedOne, savedTwo])
	);
	const dupTable = JSON.parse(globalThis.localStorage.getItem(V2_KEY) ?? "{}");
	check(
		"v2 keeps one bin per source turn",
		Array.isArray(dupTable["session-ref-dup::1"]) && Array.isArray(dupTable["session-ref-dup::2"]),
		JSON.stringify(Object.keys(dupTable).filter((key) => key.startsWith("session-ref-dup::")))
	);
	const dupRefOne = { v: 1, s: "session-ref-dup", a: "data-chat-anchor-key", k: "dup-row-1", t: "1", n: 1 };
	const dupRefTwo = { v: 1, s: "session-ref-dup", a: "data-chat-anchor-key", k: "dup-row-2", t: "2", n: 1 };
	quoteRun(dup.root, "问题一", testing.quoteBlock(dupQuote, "", false, { ref: dupRefOne }));
	quoteRun(dup.root, "问题二", testing.quoteBlock(dupQuote, "", false, { ref: dupRefTwo }));
	dom.document.deliver();
	await wait(120);
	const dupCaps = dup.root.querySelectorAll(".dshq-cap");
	check("both messages become their own capsule", dupCaps.length === 2, dupCaps.length + " capsule(s)");
	dupCaps[0].rect = { left: 100, top: 200, width: 200, height: 22 };
	dupCaps[0].dispatch("mouseenter", {});
	const jumpOne = pop().querySelector(".dshq-pop-jump");
	check("the first repeated quote offers its jump", jumpOne?.textContent === "跳回原文", JSON.stringify(jumpOne?.textContent));
	if (jumpOne !== null) jumpOne.dispatch("click", { target: null, stopPropagation() {} });
	check("the first capsule lands on its own row", Math.round(dupRowOne.getBoundingClientRect().top) === 24, String(dupRowOne.getBoundingClientRect().top));
	dupCaps[1].rect = { left: 100, top: 260, width: 200, height: 22 };
	dupCaps[1].dispatch("mouseenter", {});
	const jumpTwo = pop().querySelector(".dshq-pop-jump");
	if (jumpTwo !== null) jumpTwo.dispatch("click", { target: null, stopPropagation() {} });
	check(
		"the second capsule lands on its own row, not the first quote's",
		Math.round(dupRowTwo.getBoundingClientRect().top) === 24,
		JSON.stringify([dupRowOne.getBoundingClientRect().top, dupRowTwo.getBoundingClientRect().top])
	);

	// ---- ref-only: empty storage is a reload / another window ----
	globalThis.localStorage.clear();
	const only = pane("session-ref-only");
	const onlyRow = only.put("only-row", "5", 300);
	const onlyQuote = "只靠文本里的坐标找回";
	const onlyRef = { v: 1, s: "session-ref-only", a: "data-chat-anchor-key", k: "only-row", t: "5", n: 1 };
	quoteRun(only.root, "", testing.quoteBlock(onlyQuote, "", false, { ref: onlyRef }));
	dom.document.deliver();
	await wait(120);
	const onlyCap = only.root.querySelectorAll(".dshq-cap")[0];
	check("an empty table still has the capsule", onlyCap !== undefined);
	onlyCap.rect = { left: 100, top: 300, width: 200, height: 22 };
	onlyCap.dispatch("mouseenter", {});
	const onlyJump = pop().querySelector(".dshq-pop-jump");
	check("a ref alone still offers the jump with empty storage", onlyJump?.textContent === "跳回原文", JSON.stringify(onlyJump?.textContent));
	if (onlyJump !== null) onlyJump.dispatch("click", { target: null, stopPropagation() {} });
	check(
		"the ref alone lands on the row",
		only.port.scrollTop === 276 && Math.round(onlyRow.getBoundingClientRect().top) === 24,
		JSON.stringify([only.port.scrollTop, onlyRow.getBoundingClientRect().top])
	);

	// ---- a corrupt ref: ignored, then the table answers ----
	const brokenQuote = "坏坐标也要能回原文";
	const broken = pane("session-ref-broken");
	const brokenRow = broken.put("broken-row", "6", 220);
	testing.saveSource(brokenQuote, "session-ref-broken", sourceOf("session-ref-broken", "broken-row", "6"));
	quoteRun(broken.root, "", "> ❝ " + brokenQuote + "\n> ※ │q1:AAAA");
	dom.document.deliver();
	await wait(120);
	const brokenCap = broken.root.querySelectorAll(".dshq-cap")[0];
	check("a corrupt ref does not stop the capsule", brokenCap !== undefined);
	brokenCap.rect = { left: 100, top: 300, width: 200, height: 22 };
	brokenCap.dispatch("mouseenter", {});
	const brokenJump = pop().querySelector(".dshq-pop-jump");
	check("a corrupt ref falls back to the table's jump", brokenJump?.textContent === "跳回原文", JSON.stringify(brokenJump?.textContent));
	let brokenThrew = false;
	try {
		if (brokenJump !== null) brokenJump.dispatch("click", { target: null, stopPropagation() {} });
	} catch (error) {
		brokenThrew = true;
	}
	check("a corrupt ref never throws on the way to the table", brokenThrew === false);
	check(
		"the table's coordinate lands the jump",
		broken.port.scrollTop === 196 && Math.round(brokenRow.getBoundingClientRect().top) === 24,
		JSON.stringify([broken.port.scrollTop, brokenRow.getBoundingClientRect().top])
	);

	// ---- drafts and capsules sent before this version ----
	const legacyQuote = "旧版本发出去的引用";
	const legacy = pane("session-legacy");
	const legacyRow = legacy.put("legacy-row", "8", 180);
	const liveV1 = JSON.parse(globalThis.localStorage.getItem(V1_KEY) ?? "{}");
	liveV1[testing.sourceKeyOf(legacyQuote)] = { sessionId: "session-legacy", attr: "data-chat-anchor-key", key: "legacy-row", turn: "8" };
	globalThis.localStorage.setItem(V1_KEY, JSON.stringify(liveV1));
	check(
		"a v1-only coordinate is not in v2",
		testing.sourceCandidatesFor(legacyQuote, "session-legacy", null).length === 1,
		JSON.stringify(testing.sourceCandidatesFor(legacyQuote, "session-legacy", null))
	);
	quoteRun(legacy.root, "", testing.quoteBlock(legacyQuote));
	dom.document.deliver();
	await wait(120);
	const legacyCap = legacy.root.querySelectorAll(".dshq-cap")[0];
	legacyCap.rect = { left: 100, top: 250, width: 200, height: 22 };
	legacyCap.dispatch("mouseenter", {});
	const legacyJump = pop().querySelector(".dshq-pop-jump");
	check("an old draft still offers the jump", legacyJump?.textContent === "跳回原文", JSON.stringify(legacyJump?.textContent));
	if (legacyJump !== null) legacyJump.dispatch("click", { target: null, stopPropagation() {} });
	check(
		"an old draft still resolves through the v1 table",
		legacy.port.scrollTop === 156 && Math.round(legacyRow.getBoundingClientRect().top) === 24,
		JSON.stringify([legacy.port.scrollTop, legacyRow.getBoundingClientRect().top])
	);
	check("the v1 table was never rewritten", JSON.parse(globalThis.localStorage.getItem(V1_KEY))[testing.sourceKeyOf(legacyQuote)]?.key === "legacy-row");

	// ---- migration: imported once, marked, v1 untouched ----
	const migQuote = "迁移进 v2 的旧坐标";
	const migKey = testing.sourceKeyOf(migQuote);
	const migV1 = JSON.parse(globalThis.localStorage.getItem(V1_KEY) ?? "{}");
	migV1[migKey] = { sessionId: "session-migrate", attr: "data-chat-anchor-key", key: "mig-rate-row", turn: "11" };
	globalThis.localStorage.setItem(V1_KEY, JSON.stringify(migV1));
	globalThis.localStorage.removeItem(MIGRATED_KEY);
	const imported = testing.migrateSources();
	const migratedTable = JSON.parse(globalThis.localStorage.getItem(V2_KEY) ?? "{}");
	check("the v1 table is imported into v2 as candidate arrays", imported >= 2 && migratedTable["session-migrate::11"]?.[0]?.key === "mig-rate-row", JSON.stringify({ imported, bin: migratedTable["session-migrate::11"] }));
	check("the imported candidate keeps the wording key", migratedTable["session-migrate::11"]?.[0]?.quote === migKey, JSON.stringify(migratedTable["session-migrate::11"]?.[0]));
	check("v1 is left in place for rollback", JSON.parse(globalThis.localStorage.getItem(V1_KEY))[migKey]?.key === "mig-rate-row");
	check("the migration is marked", globalThis.localStorage.getItem(MIGRATED_KEY) === "1", JSON.stringify(globalThis.localStorage.getItem(MIGRATED_KEY)));
	check("a second migration run imports nothing", testing.migrateSources() === 0);

	// ---- two windows: a save merges what is already in storage ----
	const foreignQuote = "另一个窗口存的引用";
	const foreignBin = { sessionId: "session-window-b", attr: "data-chat-anchor-key", key: "foreign-row", turn: "12", quote: testing.sourceKeyOf(foreignQuote), at: Date.now(), n: 1 };
	const beforeMerge = JSON.parse(globalThis.localStorage.getItem(V2_KEY) ?? "{}");
	beforeMerge["session-window-b::12"] = [foreignBin];
	globalThis.localStorage.setItem(V2_KEY, JSON.stringify(beforeMerge));
	testing.saveSource("本窗口刚存的引用", "session-window-a", sourceOf("session-window-a", "local-row", "13"));
	const afterMerge = JSON.parse(globalThis.localStorage.getItem(V2_KEY) ?? "{}");
	check(
		"a save merges the other window's entries instead of overwriting",
		Array.isArray(afterMerge["session-window-b::12"]) && Array.isArray(afterMerge["session-window-a::13"]),
		JSON.stringify({ foreign: afterMerge["session-window-b::12"]?.length, local: afterMerge["session-window-a::13"]?.length })
	);

	// ---- 原文已变: a lasting, localized state on pill and card, every locale ----
	const languages = readdirSync(join(root, "locale"))
		.filter((name) => name.endsWith(".json"))
		.map((name) => name.slice(0, -5));
	check("the locale directory is what the strings are checked against", languages.includes("zh") && languages.includes("en"), JSON.stringify(languages));
	const overlay = registered.find((entry) => entry.spec.name === "conversation.input.overlay");
	for (const language of languages) {
		const languageDict = dict?.[language];
		const expected = languageDict?.sourceLost;
		check(language + " declares the lost-anchor string in the plugin dictionary", typeof expected === "string" && expected !== "", JSON.stringify(expected));
		const localeFile = JSON.parse(readFileSync(join(root, "locale", language + ".json"), "utf8"));
		check(language + " carries the same key in locale/" + language + ".json", localeFile.sourceLost === expected, JSON.stringify(localeFile.sourceLost));
		const sessionForLang = "session-lost-" + language;
		if (overlay !== undefined) {
			overlay.Component({
				sessionId: sessionForLang,
				t: (key) => (languageDict[key] === undefined ? key : languageDict[key])
			});
		}
		const lostPane = pane(sessionForLang);
		const lostQuote = language + " 的失去原文";
		const lostRef = { v: 1, s: sessionForLang, a: "data-chat-anchor-key", k: "lost-row", t: "1", n: 1 };
		check(language + " jump with no row fails", testing.jumpToSource(lostQuote, sessionForLang, lostRef) === false);
		quoteRun(lostPane.root, "", testing.quoteBlock(lostQuote, "还在的评论", false, { ref: lostRef }));
		dom.document.deliver();
		await wait(120);
		const lostCap = lostPane.root.querySelectorAll(".dshq-cap")[0];
		check(
			language + " renders 原文已变 on the capsule",
			lostCap?.querySelector(".dshq-cap-lost")?.textContent === expected,
			JSON.stringify(lostCap?.querySelector(".dshq-cap-lost")?.textContent)
		);
		check(language + " keeps the quote and comment visible", lostCap?.querySelector(".dshq-cap-quote")?.textContent === lostQuote && lostCap?.querySelector(".dshq-cap-comment")?.textContent === "还在的评论");
		lostCap.rect = { left: 100, top: 320, width: 200, height: 22 };
		lostCap.dispatch("mouseenter", {});
		const lostJump = pop().querySelector(".dshq-pop-jump");
		check(
			language + " renders 原文已变 on the jump control",
			lostJump?.textContent === expected && lostJump?.getAttribute("data-lost") === "true",
			JSON.stringify(lostJump?.textContent)
		);
		check(
			language + " card hides the ref line",
			String(pop()?.querySelector(".dshq-pop-quote")?.textContent).includes("│q1:") === false,
			JSON.stringify(pop()?.querySelector(".dshq-pop-quote")?.textContent)
		);
		lostCap.dispatch("mouseleave", {});
	}

	// ---- storage bounds: 20 per source turn, 200 turns overall ----
	for (let index = 1; index <= 25; index += 1) {
		testing.saveSource("逐出测试-" + index, "session-evict", sourceOf("session-evict", "evict-row", "77"));
	}
	const evictBin = JSON.parse(globalThis.localStorage.getItem(V2_KEY) ?? "{}")["session-evict::77"];
	check("one source turn keeps at most 20 candidates", Array.isArray(evictBin) && evictBin.length === 20, String(evictBin?.length));
	check("the newest candidate survives the eviction", evictBin?.some((entry) => entry.quote === "逐出测试-25"), JSON.stringify(evictBin?.map((entry) => entry.quote).slice(-2)));
	check("the oldest candidate is evicted first", evictBin?.every((entry) => entry.quote !== "逐出测试-1"), JSON.stringify(evictBin?.map((entry) => entry.quote).slice(0, 2)));
	for (let index = 1; index <= 205; index += 1) {
		testing.saveSource("总量测试-" + index, "session-total-" + index, sourceOf("session-total-" + index, "total-" + index, "1"));
	}
	const totalTable = JSON.parse(globalThis.localStorage.getItem(V2_KEY) ?? "{}");
	check("the whole table stays bounded at 200 source turns", Object.keys(totalTable).length <= 200, String(Object.keys(totalTable).length));
	check("the newest source turn is still in the table", Array.isArray(totalTable["session-total-205::1"]), JSON.stringify(Object.keys(totalTable).length));
}

/* ------------------------------------------------------------------ *
 * 引用 ×N — the aggregate bar above a composer
 * ------------------------------------------------------------------ */

{
	// Earlier hover-card cases leave composer cards behind; their bars would be
	// the first `.dshq-draftbar` in the document. Start this case from a clean
	// composer surface so the bar and its remove control belong to this card.
	for (const old of Array.from(dom.document.querySelectorAll("[data-composer-card]"))) old.remove();
	testing.syncDraftBars();
	const card = dom.document.createElement("div");
	card.setAttribute("data-composer-card", "");
	const chip = dom.document.createElement("span");
	const barQuote = "聚合成条的引用";
	testing.rememberChip(barQuote, "一条评论", "session-bar", false, {
		ref: { v: 1, s: "session-bar", a: "data-chat-anchor-key", k: "row-bar", t: "9", n: 1 }
	});
	chip.textContent = testing.chipLabel(barQuote, "一条评论");
	chip.setAttribute("data-dshq-chip", "1");
	card.append(chip);
	dom.document.body.append(card);
	const composer = dom.document.createElement("div");
	composer.setAttribute("data-composer-input", "");
	const editable = dom.document.createElement("div");
	editable.setAttribute("contenteditable", "true");
	composer.append(editable);
	dom.document.body.append(composer);
	testing.syncDraftBars();
	const bar = dom.document.querySelector(".dshq-draftbar");
	check("the aggregate bar appears above a composer with quotes", bar !== null && bar !== undefined, JSON.stringify(bar?.textContent));
	check("it says how many quotes the draft holds", String(bar?.textContent).includes("引用 ×1"), JSON.stringify(bar?.textContent));
	check("it offers one pill per quote", bar?.querySelectorAll(".dshq-db-pill").length === 1, String(bar?.querySelectorAll(".dshq-db-pill").length));
	check("the pill carries the full quote in its accessible name", String(bar?.querySelector(".dshq-db-pill")?.getAttribute("aria-label")).includes(barQuote) && String(bar?.querySelector(".dshq-db-pill")?.getAttribute("aria-label")).includes("一条评论"), JSON.stringify(bar?.querySelector(".dshq-db-pill")?.getAttribute("aria-label")));
	const remove = bar?.querySelector(".dshq-db-remove");
	check("it offers a remove control per quote", bar?.querySelectorAll(".dshq-db-remove").length === 1, String(bar?.querySelectorAll(".dshq-db-remove").length));
	check("the remove control is named", remove?.getAttribute("aria-label") === "移除这条引用", JSON.stringify(remove?.getAttribute("aria-label")));
	remove?.dispatch("click", { preventDefault() {}, stopPropagation() {} });
	check("a chip the host cannot locate falls back to the editor's Backspace path", (editable.dispatched ?? []).map((event) => event.type + ":" + event.key).join(",") === "keydown:Backspace,keyup:Backspace", JSON.stringify((editable.dispatched ?? []).map((event) => event.type + ":" + event.key)));
	card.remove();
	composer.remove();
	testing.syncDraftBars();
	check("the bar disappears with the last chip", dom.document.querySelector(".dshq-draftbar") === null);
}

{
	// The host's composer state lists every chip occurrence with its clipboard
	// offset and length. A chip is one character in detect coordinates, so a
	// preceding foreign chip shifts the target left by `length - 1`. The shell's
	// consumeToken applies the span only when its draftRev still matches.
	const consumeQuote = "精确删除的引用";
	const consumeLabel = testing.chipLabel(consumeQuote, "");
	const consumeRef = testing.chipRef(consumeQuote, "", false, {
		ref: { v: 1, s: "session-consume", a: "data-chat-anchor-key", k: "row-consume", t: "3", n: 1 }
	});
	const consumed = [];
	shells.set("session-consume", {
		compose() {
			return {
				draft: "XYZ" + consumeRef + " tail",
				draftRev: 7,
				occurrences: [
					{ source: "file", ref: "@a", label: "@a", offset: 0, length: 3 },
					{ source: "quote", ref: consumeRef, label: consumeLabel, offset: 3, length: consumeRef.length }
				]
			};
		},
		consumeToken(guard) {
			consumed.push(guard);
			return true;
		}
	});
	testing.rememberChip(consumeQuote, "", "session-consume", false, {
		ref: { v: 1, s: "session-consume", a: "data-chat-anchor-key", k: "row-consume", t: "3", n: 1 }
	});
	const consumeChip = dom.document.createElement("span");
	consumeChip.textContent = consumeLabel;
	testing.removeDraftChip(consumeChip, "session-consume");
	check(
		"a located draft quote is removed through the shell's token consumer",
		consumed.length === 1 && consumed[0]?.kind === "span" && consumed[0]?.span?.start === 1 && consumed[0]?.span?.end === 3 && consumed[0]?.span?.draftRev === 7,
		JSON.stringify(consumed)
	);
	const ambiguous = [];
	shells.set("session-consume-ambiguous", {
		compose() {
			return {
				draft: consumeRef + " " + consumeRef + " ",
				draftRev: 8,
				occurrences: [
					{ source: "quote", ref: consumeRef, label: consumeLabel, offset: 0, length: consumeRef.length },
					{ source: "quote", ref: consumeRef, label: consumeLabel, offset: consumeRef.length + 1, length: consumeRef.length }
				]
			};
		},
		consumeToken(guard) {
			ambiguous.push(guard);
			return true;
		}
	});
	testing.removeDraftChip(consumeChip, "session-consume-ambiguous");
	check("two chips with the same label are left to the caret path", ambiguous.length === 0, JSON.stringify(ambiguous));
}

/* ------------------------------------------------------------------ *
 * 原文侧高亮 — a Range over the quoted sentence, drawn as an overlay
 * ------------------------------------------------------------------ */

{
	const pane = dom.document.createElement("div");
	pane.setAttribute("data-conversation-content", "");
	pane.setAttribute("data-conversation-session", "session-anchor");
	const row = dom.document.createElement("div");
	row.setAttribute("data-chat-anchor-key", "row-anchor");
	row.setAttribute("data-chat-turn", "5");
	row.setAttribute("data-chat-role", "assistant");
	row.textContent = "前文 被引用的原句 后文";
	pane.append(row);
	dom.document.body.append(pane);
	const anchorQuote = "被引用的原句";
	testing.saveSource(anchorQuote, "session-anchor", { attr: "data-chat-anchor-key", key: "row-anchor", turn: "5", role: "a" });
	check("a row's role is read from its attributes", testing.rowRoleOf(row) === "a", testing.rowRoleOf(row));
	const range = testing.rangeForQuote(row, anchorQuote, 1);
	check(
		"a quote is measured inside its source row",
		range?.start?.offset === 3 && range?.end?.offset === 9,
		JSON.stringify({ start: range?.start?.offset, end: range?.end?.offset })
	);
	testing.paintAnchors();
	const layer = dom.document.querySelector(".dshq-anchor-layer");
	check("the highlight layer is shown", layer?.style?.display === "block", JSON.stringify(layer?.style?.display));
	const painted = highlightRegistry.get("dshq-quote");
	check(
		"the sentence is painted by the browser when the API is there",
		painted?.ranges?.length === 1 && layer?.querySelectorAll(".dshq-anchor-rect").length === 0,
		JSON.stringify({ ranges: painted?.ranges?.length, rects: layer?.querySelectorAll(".dshq-anchor-rect").length })
	);
	check("the ordinal sits in a badge", layer?.querySelector(".dshq-anchor-badge")?.textContent === "1", JSON.stringify(layer?.querySelector(".dshq-anchor-badge")?.textContent));
	check("the stylesheet paints the browser's mark", source.includes("::highlight(dshq-quote)"), "no ::highlight(dshq-quote) rule");
	// A browser without the API still gets the old overlay, rectangles and all.
	const savedCss = globalThis.CSS;
	globalThis.CSS = undefined;
	testing.paintAnchors();
	check(
		"a browser without the API falls back to a rectangle",
		layer?.querySelectorAll(".dshq-anchor-rect").length === 1 && highlightRegistry.has("dshq-quote") === false,
		JSON.stringify({ rects: layer?.querySelectorAll(".dshq-anchor-rect").length, registry: highlightRegistry.has("dshq-quote") })
	);
	globalThis.CSS = savedCss;
	testing.paintAnchors();
	check(
		"the switch back repaints with the browser API",
		highlightRegistry.get("dshq-quote")?.ranges?.length === 1 && layer?.querySelectorAll(".dshq-anchor-rect").length === 0,
		JSON.stringify({ ranges: highlightRegistry.get("dshq-quote")?.ranges?.length })
	);
	check("the source label follows the reader's language", testing.uiSourceLabel({ t: "5", r: "a" }, "session-anchor") === "引自第 5 轮 · 助手", testing.uiSourceLabel({ t: "5", r: "a" }, "session-anchor"));

	const dupRow = dom.document.createElement("div");
	dupRow.setAttribute("data-chat-anchor-key", "row-dup");
	dupRow.textContent = "同一句 同一句";
	pane.append(dupRow);
	const second = testing.rangeForQuote(dupRow, "同一句", 2);
	check(
		"the ref's ordinal picks the second occurrence",
		second?.start?.offset === 4 && second?.end?.offset === 7,
		JSON.stringify({ start: second?.start?.offset, end: second?.end?.offset })
	);

	// 表格划选：Chrome 的 selection.toString() 用 \t 分隔同一行的单元格、用
	// \n 分隔行，而行的文本节点是直接拼接的 ("alpha" + "第一行说明")。高亮要
	// 按这种边界对齐，否则表格里的引用永远找不到原文。
	const tableRow = dom.document.createElement("div");
	tableRow.setAttribute("data-chat-anchor-key", "row-table");
	tableRow.setAttribute("data-chat-turn", "6");
	tableRow.setAttribute("data-chat-role", "assistant");
	const table = dom.document.createElement("table");
	const tbody = dom.document.createElement("tbody");
	const tr1 = dom.document.createElement("tr");
	const cellA = dom.document.createElement("td");
	cellA.textContent = "alpha";
	const cellB = dom.document.createElement("td");
	cellB.textContent = "第一行说明";
	const tr2 = dom.document.createElement("tr");
	const cellC = dom.document.createElement("td");
	cellC.textContent = "beta";
	const cellD = dom.document.createElement("td");
	cellD.textContent = "第二行说明";
	tr1.append(cellA);
	tr1.append(cellB);
	tr2.append(cellC);
	tr2.append(cellD);
	tbody.append(tr1);
	tbody.append(tr2);
	table.append(tbody);
	tableRow.append(table);
	pane.append(tableRow);
	const cellRange = testing.rangeForQuote(tableRow, "alpha\t第一行说明", 1);
	check(
		"a quote across two table cells is measured as one range",
		cellRange?.start?.node === cellA.firstChild && cellRange?.start?.offset === 0 &&
			cellRange?.end?.node === cellB.firstChild && cellRange?.end?.offset === 5,
		JSON.stringify({ start: cellRange?.start?.node?.nodeValue, end: cellRange?.end?.node?.nodeValue })
	);
	const rowRange = testing.rangeForQuote(tableRow, "alpha\t第一行说明\nbeta", 1);
	check(
		"a quote across two table rows keeps both ends",
		rowRange?.start?.node === cellA.firstChild && rowRange?.start?.offset === 0 &&
			rowRange?.end?.node === cellC.firstChild && rowRange?.end?.offset === 4,
		JSON.stringify({ start: rowRange?.start?.node?.nodeValue, end: rowRange?.end?.node?.nodeValue })
	);
	const cellOnly = testing.rangeForQuote(tableRow, "第一行说明", 1);
	check(
		"one cell still matches exactly",
		cellOnly?.start?.node === cellB.firstChild && cellOnly?.start?.offset === 0 && cellOnly?.end?.offset === 5,
		JSON.stringify({ start: cellOnly?.start?.offset, end: cellOnly?.end?.offset })
	);
	// A table cell with inline code: selectedText keeps the backticks, the
	// rendered cell does not — the plain fallback is what makes it paintable.
	const codeCell = dom.document.createElement("td");
	const codeNode = dom.document.createElement("code");
	codeNode.textContent = "run";
	codeCell.append(codeNode);
	tr1.append(codeCell);
	const codeRange = testing.rangeForQuote(tableRow, "`run`", 1);
	check(
		"a code span inside a cell matches through its Markdown marks",
		codeRange?.start?.node === codeNode.firstChild && codeRange?.start?.offset === 0 && codeRange?.end?.offset === 3,
		JSON.stringify({ start: codeRange?.start?.node?.nodeValue, end: codeRange?.end?.node?.nodeValue })
	);
	// Inline neighbours must stay glued: two spans with no whitespace between
	// them still match one word, not a spaced-out phantom.
	const inlineRow = dom.document.createElement("div");
	inlineRow.setAttribute("data-chat-anchor-key", "row-inline");
	const spanA = dom.document.createElement("span");
	spanA.textContent = "foo";
	const spanB = dom.document.createElement("span");
	spanB.textContent = "bar";
	inlineRow.append(spanA);
	inlineRow.append(spanB);
	pane.append(inlineRow);
	const inlineRange = testing.rangeForQuote(inlineRow, "foobar", 1);
	check(
		"inline text nodes still match without an inserted space",
		inlineRange?.start?.node === spanA.firstChild && inlineRange?.end?.node === spanB.firstChild && inlineRange?.end?.offset === 3,
		JSON.stringify({ start: inlineRange?.start?.node?.nodeValue, end: inlineRange?.end?.node?.nodeValue })
	);

	// 侧边对话里那句引用还没发出去：坐标照样要存（卡片、跳回都要它），但原文上
	// 不许留下任何标记——读者可能把侧边对话关掉，那时高亮就成了无主的黄条。
	const draftRow = dom.document.createElement("div");
	draftRow.setAttribute("data-chat-anchor-key", "row-draft");
	draftRow.setAttribute("data-chat-turn", "7");
	draftRow.textContent = "前文 还没发出去的侧聊引用 后文";
	pane.append(draftRow);
	const draftQuote = "还没发出去的侧聊引用";
	const draftSaved = testing.saveSource(draftQuote, "session-anchor", { attr: "data-chat-anchor-key", key: "row-draft", turn: "7" }, { draft: true });
	check(
		"a coordinate saved for a draft still carries its ordinal",
		draftSaved !== null && draftSaved.n === 1 && draftSaved.draft === true,
		JSON.stringify(draftSaved)
	);
	check(
		"the draft flag is stored, so a reload cannot resurrect the mark",
		String(globalThis.localStorage.getItem("dsh-client-ui-quote:v2:quote-source") ?? "").includes(draftQuote) &&
			String(globalThis.localStorage.getItem("dsh-client-ui-quote:v2:quote-source") ?? "").includes('"draft":true'),
		String(globalThis.localStorage.getItem("dsh-client-ui-quote:v2:quote-source") ?? "").slice(0, 120)
	);
	testing.paintAnchors();
	check(
		"a draft coordinate is not painted on the source",
		highlightRegistry.get("dshq-quote")?.ranges?.length === 1 && layer?.querySelectorAll(".dshq-anchor-badge").length === 1,
		JSON.stringify({ ranges: highlightRegistry.get("dshq-quote")?.ranges?.length, badges: layer?.querySelectorAll(".dshq-anchor-badge").length })
	);
	const draftRef = { s: "session-anchor", a: "data-chat-anchor-key", k: "row-draft", t: "7", n: draftSaved?.n };
	const promoted = testing.promoteSource(draftRef, draftQuote);
	testing.paintAnchors();
	check(
		"the quote turning up in a transcript promotes its mark",
		promoted === true &&
			highlightRegistry.get("dshq-quote")?.ranges?.length === 2 &&
			layer?.querySelectorAll(".dshq-anchor-badge").length === 2,
		JSON.stringify({ promoted, ranges: highlightRegistry.get("dshq-quote")?.ranges?.length })
	);

	// 同一段文字先在主会话发过、又送进侧聊一次：侧聊那次保存带 draft，但已经
	// 转正的坐标不能被降级——否则刚亮起来的高亮会凭空消失。
	const reDraft = testing.saveSource(draftQuote, "session-anchor", { attr: "data-chat-anchor-key", key: "row-draft", turn: "7" }, { draft: true });
	testing.paintAnchors();
	check(
		"a sent coordinate is not demoted by quoting it into a side chat",
		reDraft !== null && reDraft.draft === undefined && highlightRegistry.get("dshq-quote")?.ranges?.length === 2,
		JSON.stringify({ draft: reDraft?.draft, ranges: highlightRegistry.get("dshq-quote")?.ranges?.length })
	);

	// 主会话「添加到对话」写进草稿的芯片：坐标以 `chip` 记在表里。芯片还在草稿
	// 里时照常落色；读者点聚合条的 × 或直接退格把它删掉（并没有发送）之后，
	// 原文上那块高亮必须跟着消失——否则就留下一条无主的黄条。
	const chipRow = dom.document.createElement("div");
	chipRow.setAttribute("data-chat-anchor-key", "row-chip");
	chipRow.setAttribute("data-chat-turn", "8");
	chipRow.textContent = "前文 加进草稿又后悔的引用 后文";
	pane.append(chipRow);
	const chipQuote = "加进草稿又后悔的引用";
	const chipRef = { v: 1, s: "session-anchor", a: "data-chat-anchor-key", k: "row-chip", t: "8", n: 1 };
	const chipSaved = testing.saveSource(chipQuote, "session-anchor", { attr: "data-chat-anchor-key", key: "row-chip", turn: "8" }, { chip: true });
	check(
		"a coordinate minted by a composer chip carries the chip mark",
		chipSaved !== null && chipSaved.chip === true,
		JSON.stringify(chipSaved)
	);
	const chipCard = dom.document.createElement("div");
	chipCard.setAttribute("data-composer-card", "");
	const chipNode = dom.document.createElement("span");
	testing.rememberChip(chipQuote, "", "session-anchor", false, { ref: chipRef });
	chipNode.textContent = testing.chipLabel(chipQuote, "");
	chipNode.setAttribute("data-dshq-chip", "1");
	chipCard.append(chipNode);
	dom.document.body.append(chipCard);
	const chipBaseline = highlightRegistry.get("dshq-quote")?.ranges?.length ?? 0;
	testing.syncDraftBars();
	testing.paintAnchors();
	check(
		"a quote held by a draft chip is painted on its source",
		(highlightRegistry.get("dshq-quote")?.ranges?.length ?? 0) === chipBaseline + 1,
		JSON.stringify({ baseline: chipBaseline, ranges: highlightRegistry.get("dshq-quote")?.ranges?.length })
	);
	chipNode.remove();
	testing.syncDraftBars();
	testing.paintAnchors();
	const chipTable = JSON.parse(globalThis.localStorage.getItem("dsh-client-ui-quote:v2:quote-source") ?? "{}");
	const chipStoredDraft = Object.values(chipTable).some((list) => Array.isArray(list) && list.some((entry) => entry?.key === "row-chip" && entry?.draft === true));
	check(
		"removing the chip without sending drops the source highlight",
		(highlightRegistry.get("dshq-quote")?.ranges?.length ?? 0) === chipBaseline,
		JSON.stringify({ baseline: chipBaseline, ranges: highlightRegistry.get("dshq-quote")?.ranges?.length })
	);
	check("the retraction is stored, so a reload cannot resurrect the mark", chipStoredDraft, JSON.stringify(chipStoredDraft));
	// 又把同一句加回草稿（或宿主慢一拍才把它画回来）：高亮应当自己回来。
	const chipAgain = dom.document.createElement("span");
	chipAgain.textContent = testing.chipLabel(chipQuote, "");
	chipAgain.setAttribute("data-dshq-chip", "1");
	chipCard.append(chipAgain);
	testing.syncDraftBars();
	testing.paintAnchors();
	check(
		"the chip coming back lifts the retraction",
		(highlightRegistry.get("dshq-quote")?.ranges?.length ?? 0) === chipBaseline + 1,
		JSON.stringify({ baseline: chipBaseline, ranges: highlightRegistry.get("dshq-quote")?.ranges?.length })
	);
	chipAgain.remove();
	testing.syncDraftBars();
	testing.paintAnchors();
	const chipPromoted = testing.promoteSource(chipRef, chipQuote);
	testing.paintAnchors();
	check(
		"the quote turning up as a capsule paints it again",
		chipPromoted === true && (highlightRegistry.get("dshq-quote")?.ranges?.length ?? 0) === chipBaseline + 1,
		JSON.stringify({ promoted: chipPromoted, ranges: highlightRegistry.get("dshq-quote")?.ranges?.length })
	);

	// 已经作为胶囊发出去过的坐标，再被加进草稿、又删掉：页面上有它的胶囊，
	// 所以这不是「读者反悔」，标记必须留着。
	const sentRow = dom.document.createElement("div");
	sentRow.setAttribute("data-chat-anchor-key", "row-sent-chip");
	sentRow.setAttribute("data-chat-turn", "9");
	sentRow.textContent = "前文 已经发出去又被加进草稿的引用 后文";
	pane.append(sentRow);
	const sentQuote = "已经发出去又被加进草稿的引用";
	const sentRef = { v: 1, s: "session-anchor", a: "data-chat-anchor-key", k: "row-sent-chip", t: "9", n: 1 };
	testing.saveSource(sentQuote, "session-anchor", { attr: "data-chat-anchor-key", key: "row-sent-chip", turn: "9" }, { chip: true });
	const sentCard = dom.document.createElement("div");
	sentCard.setAttribute("data-composer-card", "");
	const sentChip = dom.document.createElement("span");
	testing.rememberChip(sentQuote, "", "session-anchor", false, { ref: sentRef });
	sentChip.textContent = testing.chipLabel(sentQuote, "");
	sentChip.setAttribute("data-dshq-chip", "1");
	sentCard.append(sentChip);
	dom.document.body.append(sentCard);
	testing.syncDraftBars();
	testing.paintAnchors();
	const sentBaseline = highlightRegistry.get("dshq-quote")?.ranges?.length ?? 0;
	const sentCapsule = dom.document.createElement("div");
	sentCapsule.setAttribute("data-dshq-jump", JSON.stringify(["ref", "session-anchor", "data-chat-anchor-key", "row-sent-chip", "9", 1]));
	dom.document.body.append(sentCapsule);
	sentChip.remove();
	testing.syncDraftBars();
	testing.paintAnchors();
	check(
		"a sent capsule keeps the mark when its draft chip is removed",
		(highlightRegistry.get("dshq-quote")?.ranges?.length ?? 0) === sentBaseline,
		JSON.stringify({ baseline: sentBaseline, ranges: highlightRegistry.get("dshq-quote")?.ranges?.length })
	);
	sentCapsule.remove();
	sentCard.remove();
	testing.syncDraftBars();

	// 整个输入框离开页面（切会话）不是「读者删了芯片」：不收回、也不误删账本。
	const leaveRow = dom.document.createElement("div");
	leaveRow.setAttribute("data-chat-anchor-key", "row-leave-chip");
	leaveRow.setAttribute("data-chat-turn", "10");
	leaveRow.textContent = "前文 切走会话时还在草稿里的引用 后文";
	pane.append(leaveRow);
	const leaveQuote = "切走会话时还在草稿里的引用";
	const leaveRef = { v: 1, s: "session-anchor", a: "data-chat-anchor-key", k: "row-leave-chip", t: "10", n: 1 };
	testing.saveSource(leaveQuote, "session-anchor", { attr: "data-chat-anchor-key", key: "row-leave-chip", turn: "10" }, { chip: true });
	const leaveCard = dom.document.createElement("div");
	leaveCard.setAttribute("data-composer-card", "");
	const leaveChip = dom.document.createElement("span");
	testing.rememberChip(leaveQuote, "", "session-anchor", false, { ref: leaveRef });
	leaveChip.textContent = testing.chipLabel(leaveQuote, "");
	leaveChip.setAttribute("data-dshq-chip", "1");
	leaveCard.append(leaveChip);
	dom.document.body.append(leaveCard);
	testing.syncDraftBars();
	testing.paintAnchors();
	const leaveBaseline = highlightRegistry.get("dshq-quote")?.ranges?.length ?? 0;
	leaveCard.remove();
	testing.syncDraftBars();
	testing.paintAnchors();
	check(
		"a composer that leaves the page does not drop the draft's mark",
		(highlightRegistry.get("dshq-quote")?.ranges?.length ?? 0) === leaveBaseline,
		JSON.stringify({ baseline: leaveBaseline, ranges: highlightRegistry.get("dshq-quote")?.ranges?.length })
	);

	// 同一坐标同时挂在两个草稿里（主会话与侧边线程共用同一个 ref，侧聊草稿也是
	// 这一句）：删掉其中一颗芯片不代表引用离开了草稿，最后两颗都删掉才收回。
	const sharedRow = dom.document.createElement("div");
	sharedRow.setAttribute("data-chat-anchor-key", "row-shared-chip");
	sharedRow.setAttribute("data-chat-turn", "11");
	sharedRow.textContent = "前文 两个草稿共享同一个坐标的引用 后文";
	pane.append(sharedRow);
	const sharedQuote = "两个草稿共享同一个坐标的引用";
	const sharedRef = { v: 1, s: "session-anchor", a: "data-chat-anchor-key", k: "row-shared-chip", t: "11", n: 1 };
	testing.saveSource(sharedQuote, "session-anchor", { attr: "data-chat-anchor-key", key: "row-shared-chip", turn: "11" }, { chip: true });
	testing.rememberChip(sharedQuote, "", "session-anchor", false, { ref: sharedRef });
	const sharedLabel = testing.chipLabel(sharedQuote, "");
	const sharedCardA = dom.document.createElement("div");
	sharedCardA.setAttribute("data-composer-card", "");
	const sharedChipA = dom.document.createElement("span");
	sharedChipA.textContent = sharedLabel;
	sharedChipA.setAttribute("data-dshq-chip", "1");
	sharedCardA.append(sharedChipA);
	dom.document.body.append(sharedCardA);
	const sharedCardB = dom.document.createElement("div");
	sharedCardB.setAttribute("data-composer-card", "");
	const sharedChipB = dom.document.createElement("span");
	sharedChipB.textContent = sharedLabel;
	sharedChipB.setAttribute("data-dshq-chip", "1");
	sharedCardB.append(sharedChipB);
	dom.document.body.append(sharedCardB);
	testing.syncDraftBars();
	testing.paintAnchors();
	const sharedBaseline = highlightRegistry.get("dshq-quote")?.ranges?.length ?? 0;
	sharedChipA.remove();
	testing.syncDraftBars();
	testing.paintAnchors();
	check(
		"one of two chips for one coordinate going away keeps the mark",
		(highlightRegistry.get("dshq-quote")?.ranges?.length ?? 0) === sharedBaseline,
		JSON.stringify({ baseline: sharedBaseline, ranges: highlightRegistry.get("dshq-quote")?.ranges?.length })
	);
	sharedChipB.remove();
	testing.syncDraftBars();
	testing.paintAnchors();
	check(
		"the mark goes when the last chip for it is gone",
		(highlightRegistry.get("dshq-quote")?.ranges?.length ?? 0) === sharedBaseline - 1,
		JSON.stringify({ baseline: sharedBaseline, ranges: highlightRegistry.get("dshq-quote")?.ranges?.length })
	);
	sharedCardA.remove();
	sharedCardB.remove();
	testing.syncDraftBars();

	// 一次漏掉的「转正」：收回跑在胶囊出现之后，坐标会卡在 draft，原文上的高亮
	// 一直不出现——用户看到的就是「第二次引用没有高亮」。胶囊还挂在页面上就是
	// 已发出的证据：下一次重画把它转正并补画，而且写回本机表。
	const stuckQuote = "漏掉转正的引用";
	const stuckRow = dom.document.createElement("div");
	stuckRow.setAttribute("data-chat-anchor-key", "row-stuck");
	stuckRow.setAttribute("data-chat-turn", "11");
	stuckRow.textContent = "前文 " + stuckQuote + " 后文";
	pane.append(stuckRow);
	const stuckSaved = testing.saveSource(stuckQuote, "session-anchor", { attr: "data-chat-anchor-key", key: "row-stuck", turn: "11" }, { draft: true });
	const stuckRef = { v: 1, s: "session-anchor", a: "data-chat-anchor-key", k: "row-stuck", t: "11", n: stuckSaved?.n ?? 1 };
	const stuckCapsule = dom.document.createElement("div");
	stuckCapsule.setAttribute("data-dshq-jump", JSON.stringify(["ref", "session-anchor", "data-chat-anchor-key", "row-stuck", "11", stuckRef.n]));
	dom.document.body.append(stuckCapsule);
	const stuckBaseline = highlightRegistry.get("dshq-quote")?.ranges?.length ?? 0;
	testing.paintAnchors();
	check(
		"a draft whose capsule is already on the page is painted",
		(highlightRegistry.get("dshq-quote")?.ranges?.length ?? 0) === stuckBaseline + 1,
		JSON.stringify({ baseline: stuckBaseline, ranges: highlightRegistry.get("dshq-quote")?.ranges?.length })
	);
	const stuckTable = JSON.parse(globalThis.localStorage.getItem("dsh-client-ui-quote:v2:quote-source") ?? "{}");
	const stuckEntry = Object.values(stuckTable).flat().find((entry) => entry?.key === "row-stuck");
	check(
		"the late promotion is stored, not just painted",
		stuckEntry !== undefined && stuckEntry.draft !== true,
		JSON.stringify(stuckEntry)
	);
	stuckCapsule.remove();

	// 发送后、胶囊还没增强出来的一瞬：线格式里的坐标已经在 transcript 文本里，
	// 芯片这时消失不是「读者反悔」，不能把已经发出去的那句收回。
	const sendingQuote = "已经发出但还没增强的引用";
	const sendingRow = dom.document.createElement("div");
	sendingRow.setAttribute("data-chat-anchor-key", "row-sending");
	sendingRow.setAttribute("data-chat-turn", "12");
	sendingRow.textContent = "前文 " + sendingQuote + " 后文";
	pane.append(sendingRow);
	const sendingRef = { v: 1, s: "session-anchor", a: "data-chat-anchor-key", k: "row-sending", t: "12", n: 1 };
	testing.saveSource(sendingQuote, "session-anchor", { attr: "data-chat-anchor-key", key: "row-sending", turn: "12" }, { chip: true });
	testing.rememberChip(sendingQuote, "", "session-anchor", false, { ref: sendingRef });
	const sendingCard = dom.document.createElement("div");
	sendingCard.setAttribute("data-composer-card", "");
	const sendingChip = dom.document.createElement("span");
	sendingChip.textContent = testing.chipLabel(sendingQuote, "");
	sendingChip.setAttribute("data-dshq-chip", "1");
	sendingCard.append(sendingChip);
	dom.document.body.append(sendingCard);
	const sendingUserRow = dom.document.createElement("div");
	sendingUserRow.setAttribute("data-chat-anchor-key", "row-sent-raw");
	sendingUserRow.setAttribute("data-chat-turn", "13");
	const sendingRun = dom.document.createElement("span");
	sendingRun.className = "plainRun";
	sendingRun.textContent = testing.quoteBlock(sendingQuote, "", false, { ref: sendingRef });
	sendingUserRow.append(sendingRun);
	pane.append(sendingUserRow);
	testing.syncDraftBars();
	testing.paintAnchors();
	const sendingBaseline = highlightRegistry.get("dshq-quote")?.ranges?.length ?? 0;
	sendingChip.remove();
	testing.syncDraftBars();
	testing.paintAnchors();
	const sendingTable = JSON.parse(globalThis.localStorage.getItem("dsh-client-ui-quote:v2:quote-source") ?? "{}");
	const sendingEntry = Object.values(sendingTable).flat().find((entry) => entry?.key === "row-sending");
	check(
		"a chip that leaves after its ref line is already in a transcript is not retracted",
		sendingEntry !== undefined && sendingEntry.draft !== true,
		JSON.stringify(sendingEntry)
	);
	check(
		"and that sent quote keeps its highlight",
		(highlightRegistry.get("dshq-quote")?.ranges?.length ?? 0) === sendingBaseline,
		JSON.stringify({ baseline: sendingBaseline, ranges: highlightRegistry.get("dshq-quote")?.ranges?.length })
	);
	sendingCard.remove();
	sendingUserRow.remove();
	testing.syncDraftBars();

	// 插件重载/启动间隙里渲染出来的消息，MutationObserver 可能没看到：窗口回到
	// 前台时的 rescanCapsules() 要把它补成胶囊，而不是让原文一直停在 `> ❝ …`。
	const lateWire = testing.quoteBlock("晚到的一条已发引用", "", false, {
		ref: { v: 1, s: "session-anchor", a: "data-chat-anchor-key", k: "row-late", t: "14", n: 1 }
	});
	const lateRow = dom.document.createElement("div");
	lateRow.setAttribute("data-chat-anchor-key", "row-late-message");
	lateRow.setAttribute("data-chat-turn", "15");
	const lateRun = dom.document.createElement("span");
	lateRun.className = "plainRun";
	lateRun.textContent = lateWire;
	lateRow.append(lateRun);
	pane.append(lateRow);
	// No deliver(): the mutation pass never saw this insertion.
	check("a late-rendered quote stays raw until the rescan", lateRow.querySelectorAll(".dshq-cap").length === 0, String(lateRow.querySelectorAll(".dshq-cap").length));
	const lateScanned = testing.rescanCapsules();
	await wait(150);
	check(
		"the visibility rescan turns the raw quote into a capsule",
		lateScanned >= 1 && lateRow.querySelectorAll(".dshq-cap").length === 1 && lateRun.style.display === "none",
		JSON.stringify({ scanned: lateScanned, capsules: lateRow.querySelectorAll(".dshq-cap").length, hidden: lateRun.style.display })
	);
	lateRow.remove();

	const longQuote = "长".repeat(200);
	const longRef = { s: "session-anchor", a: "data-chat-anchor-key", k: "row-anchor", t: "5", n: 1 };
	testing.rememberQuoteText(longRef, longQuote);
	check("the identity key caps a long quote", testing.sourceKeyOf(longQuote).length === 120, String(testing.sourceKeyOf(longQuote).length));
	check("the full wording is kept for the highlight", testing.quoteTextFor(longRef) === longQuote, String(testing.quoteTextFor(longRef).length));

	pane.remove();
	testing.paintAnchors();
	check("the layer empties when the source row unmounts", dom.document.querySelector(".dshq-anchor-layer")?.style?.display === "none");
	check("the browser-painted mark goes with the row", highlightRegistry.has("dshq-quote") === false, JSON.stringify([...highlightRegistry.keys()]));
}

/* ------------------------------------------------------------------ *
 * 配置 + 调试句柄 — the switches and the window onto the plugin
 * ------------------------------------------------------------------ */

{
	const defaults = testing.config();
	check(
		"the switches start at their defaults",
		defaults.minChars === 1 && defaults.maxQuoteChars === 4000 && defaults.replyByDefault === false && defaults.attribution === true && defaults.highlight === true,
		JSON.stringify(defaults)
	);
	const patched = testing.setConfig({ minChars: 12, maxQuoteChars: "not a number", attribution: false, unknownKey: 1 });
	check(
		"a patch keeps the whitelist and the types",
		patched.minChars === 12 && patched.maxQuoteChars === 4000 && patched.attribution === false && patched.unknownKey === undefined,
		JSON.stringify(patched)
	);
	check("a patch is persisted", testing.config().minChars === 12, JSON.stringify(testing.config()));
	testing.setConfig({ minChars: 1, attribution: true });
	check("the switches go back", testing.config().minChars === 1 && testing.config().attribution === true, JSON.stringify(testing.config()));

	const probe = globalThis.window.__dshQuote;
	check(
		"the probe handle is installed",
		probe !== undefined && typeof probe.config === "function" && typeof probe.state === "function" && typeof probe.probe === "function",
		typeof probe
	);
	check(
		"the probe reads the host's services",
		probe.probe().services.inputTriggers === true && probe.probe().services.conversation === true,
		JSON.stringify(probe.probe().services)
	);
	check("the probe reads the live state", probe.state() !== undefined, JSON.stringify(probe.state()));
	check("the probe reads the native side-chat fallback", probe.probe().nativeSideChat === true, JSON.stringify(probe.probe()));

	// A refused insert says which step refused, not just "it did not work".
	const failuresBefore = testing.failureSnapshot().count;
	const refused = testing.insertChip({ actions: () => ({ captureInsertion: () => null }) }, "session-probe", "探针引用", "", false, {});
	const failed = testing.failureSnapshot();
	check(
		"a refused insert names the step that refused",
		refused === false && failed.stage === "insert" && failed.detail.includes("composer shell") && failed.count === failuresBefore + 1,
		JSON.stringify(failed)
	);
	check(
		"the probe exposes the last failure to support",
		probe.probe().lastFailure.stage === "insert" && probe.probe().lastFailure.count >= 1,
		JSON.stringify(probe.probe().lastFailure)
	);
	check("the failure record carries no quoted text", JSON.stringify(failed).includes("探针引用") === false, JSON.stringify(failed));
}

/* ------------------------------------------------------------------ *
 * 逐条回应的双语 — the instruction follows the reader, the badges read both
 * ------------------------------------------------------------------ */

{
	const englishInstruction = "Instruction: number the quote blocks of this message in order as 「Quote 1」「Quote 2」…, answer each one separately, and prefix every answer with 「Quote N」.";
	const englishWire = testing.quoteBlock("正文", "评论", false, { reply: true, replyInstruction: englishInstruction });
	check("the English instruction rides the wire", englishWire.includes(englishInstruction), JSON.stringify(englishWire));
	const englishSegments = testing.splitQuoteRuns(englishWire);
	check(
		"the English instruction never reaches the capsule",
		englishSegments?.length === 1 && englishSegments[0].quote === "正文" && JSON.stringify(englishSegments).includes("Instruction") === false,
		JSON.stringify(englishSegments)
	);

	// An English reply's 「Quote 1」 becomes a badge just like 「引用1」 does.
	const enHost = dom.document.createElement("div");
	enHost.setAttribute("data-conversation-content", "");
	enHost.setAttribute("data-conversation-session", "session-en-badge");
	const enBubble = dom.document.createElement("div");
	const enRun = dom.document.createElement("span");
	enRun.className = "plainRun";
	enRun.textContent = "问题" + testing.quoteBlock("第一处引用", "注一") + "\n\n";
	enBubble.append(enRun);
	enHost.append(enBubble);
	const enReply = dom.document.createElement("p");
	enReply.textContent = "Answer 「Quote 1」 and 「Quote 9」 out of range";
	enHost.append(enReply);
	dom.document.body.append(enHost);
	dom.document.deliver();
	await wait(120);
	const enBadges = enReply.querySelectorAll(".dshq-ref");
	check("an English label becomes a badge", enBadges.length === 1, enBadges.length + " badge(s)");
	check("the English badge keeps the label it was written with", enBadges[0]?.textContent === "「Quote 1」", JSON.stringify(enBadges[0]?.textContent));
	enHost.remove();
}

/* ------------------------------------------------------------------ *
 * 草稿芯片的跨刷新索引 — the host restores the draft's chips, we must too
 * ------------------------------------------------------------------ */

{
	const storeKey = "dsh-client-ui-quote:v1:chip-index";
	testing.rememberChip("写进持久索引的引用", "一条评论", "session-persist", false, { ref: null });
	const store = JSON.parse(globalThis.localStorage.getItem(storeKey) ?? "{}");
	check(
		"a minted chip is written to the persisted index",
		Object.values(store).some((entry) => entry.quote === "写进持久索引的引用"),
		JSON.stringify(Object.keys(store))
	);

	// A chip the host restored after a reload was never minted in this page:
	// the persisted index is what still knows what it holds.
	const restoredLabel = testing.chipLabel("跨刷新还在的引用", "一条评论");
	globalThis.localStorage.setItem(
		storeKey,
		JSON.stringify({
			[restoredLabel]: { quote: "跨刷新还在的引用", comment: "一条评论", sessionId: "session-reload", code: false, path: null, ref: null }
		})
	);
	testing.loadPersistedChips();
	const restoredChip = dom.document.createElement("span");
	restoredChip.textContent = restoredLabel;
	const restored = testing.chipInfoFor(restoredChip);
	check(
		"a chip restored by the host is still ours after a reload",
		restored?.quote === "跨刷新还在的引用" && restored?.comment === "一条评论" && restored?.sessionId === "session-reload",
		JSON.stringify(restored)
	);
	const markedChip = dom.document.createElement("span");
	markedChip.textContent = "❝ " + restoredLabel;
	check(
		"a restored chip is recognised even with the host's own mark",
		testing.chipInfoFor(markedChip)?.quote === "跨刷新还在的引用",
		JSON.stringify(testing.chipInfoFor(markedChip))
	);
}

/* ------------------------------------------------------------------ *
 * 待发引用的编辑 — the aggregate bar edits a quote that is still in the draft
 * ------------------------------------------------------------------ */

{
	const overlay = registered.find((entry) => entry.spec.name === "conversation.input.overlay");
	const draftInsertions = [];
	shells.set("session-draft-edit", {
		insertReference(attachment, capturedSpan) {
			draftInsertions.push({ attachment, capturedSpan });
			return true;
		}
	});
	if (overlay !== undefined) {
		overlay.Component({ sessionId: "session-draft-edit", inputActions: { captureInsertion: () => ({ draftRev: 3 }) } });
	}
	const card = dom.document.createElement("div");
	card.setAttribute("data-composer-card", "");
	const chip = dom.document.createElement("span");
	const draftQuote = "待发引用的原文";
	testing.rememberChip(draftQuote, "待发的评论", "session-draft-edit", false, {
		ref: { v: 1, s: "session-draft-edit", a: "data-chat-anchor-key", k: "row-draft", t: "2", n: 1 }
	});
	chip.textContent = testing.chipLabel(draftQuote, "待发的评论");
	chip.setAttribute("data-dshq-chip", "1");
	card.append(chip);
	dom.document.body.append(card);
	testing.syncDraftBars();
	const draftBar = dom.document.querySelector(".dshq-draftbar");
	const edit = draftBar?.querySelector(".dshq-db-edit");
	check("the aggregate bar offers an edit control per quote", draftBar?.querySelectorAll(".dshq-db-edit").length === 1, String(draftBar?.querySelectorAll(".dshq-db-edit").length));
	check("the edit control is named", edit?.getAttribute("aria-label") === "编辑这条引用", JSON.stringify(edit?.getAttribute("aria-label")));
	edit?.dispatch("click", { preventDefault() {}, stopPropagation() {} });
	const commentBar = dom.document.getElementById("dsh-quote-bar");
	const quoteBox = commentBar?.querySelector(".dshq-quote-input");
	const input = commentBar?.querySelector(".dshq-comment-input");
	check("the box comes back with the draft quote", quoteBox?.value === draftQuote, JSON.stringify(quoteBox?.value));
	check("and the draft comment", input?.value === "待发的评论", JSON.stringify(input?.value));
	input.value = "改过的评论";
	input.dispatch("input", {});
	const confirm = commentBar?.querySelector('[data-action="confirm"]');
	commentBar?.dispatch("click", { target: confirm });
	check(
		"the corrected quote is inserted",
		draftInsertions.length === 1 && String(draftInsertions[0]?.attachment?.ref ?? "").includes("改过的评论"),
		JSON.stringify({ count: draftInsertions.length, ref: String(draftInsertions[0]?.attachment?.ref ?? "").slice(0, 40) })
	);
	check(
		"the old chip was asked to leave",
		(chip.dispatched ?? []).some((event) => event.key === "Backspace"),
		JSON.stringify((chip.dispatched ?? []).map((event) => event.key))
	);
	card.remove();
	testing.syncDraftBars();
}

/* ------------------------------------------------------------------ *
 * 选区保结构 — a link keeps its target, an inline code span keeps its backticks
 * ------------------------------------------------------------------ */

{
	const pane = dom.document.createElement("div");
	pane.setAttribute("data-conversation-content", "");
	pane.setAttribute("data-conversation-session", "session-structure");
	const paragraph = dom.document.createElement("p");
	const before = dom.document.createTextNode("看 ");
	const link = dom.document.createElement("a");
	link.setAttribute("href", "https://example.com/docs");
	link.append(dom.document.createTextNode("文档"));
	const middle = dom.document.createTextNode(" 和 ");
	const code = dom.document.createElement("code");
	code.append(dom.document.createTextNode("npm test"));
	const after = dom.document.createTextNode(" 结束");
	paragraph.append(before, link, middle, code, after);
	pane.append(paragraph);
	dom.document.body.append(pane);

	// The fragment a range hands back: a fragment, not an element — the shape
	// the browser's `cloneContents()` really returns.
	const fragment = dom.document.createDocumentFragment();
	const fragLink = dom.document.createElement("a");
	fragLink.setAttribute("href", "https://example.com/docs");
	fragLink.append(dom.document.createTextNode("文档"));
	const fragCode = dom.document.createElement("code");
	fragCode.append(dom.document.createTextNode("npm test"));
	fragment.append(dom.document.createTextNode("看 "), fragLink, dom.document.createTextNode(" 和 "), fragCode, dom.document.createTextNode(" 结束"));

	const rangeOf = (fragmentNode) => ({
		startContainer: before,
		endContainer: after,
		cloneContents: () => fragmentNode,
		intersectsNode: () => false,
		getBoundingClientRect: () => ({ left: 100, top: 300, right: 320, bottom: 318, width: 220, height: 18 })
	});
	dom.document.selection = {
		isCollapsed: false,
		rangeCount: 1,
		toString: () => "看 文档 和 npm test 结束",
		removeAllRanges() {},
		getRangeAt: () => rangeOf(fragment)
	};
	const structured = testing.readSelection();
	check(
		"a link keeps its target and an inline code keeps its backticks",
		structured?.text === "看 [文档](https://example.com/docs) 和 `npm test` 结束",
		JSON.stringify(structured?.text)
	);
	check(
		"the plain wording can still be found in the transcript",
		testing.plainOf(structured?.text ?? "") === "看 文档 和 npm test 结束",
		JSON.stringify(testing.plainOf(structured?.text ?? ""))
	);

	// A selection with no structure is left exactly as it was.
	const plainFragment = dom.document.createDocumentFragment();
	plainFragment.append(dom.document.createTextNode("一段普通的正文"));
	dom.document.selection = {
		isCollapsed: false,
		rangeCount: 1,
		toString: () => "一段普通的正文",
		removeAllRanges() {},
		getRangeAt: () => rangeOf(plainFragment)
	};
	const plainSelection = testing.readSelection();
	check("a selection without structure stays plain", plainSelection?.text === "一段普通的正文", JSON.stringify(plainSelection?.text));
	dom.document.selection = null;
	pane.remove();
}

/* ------------------------------------------------------------------ *
 * 引用本轮 — the turn tail quotes a whole turn
 * ------------------------------------------------------------------ */

{
	const pane = dom.document.createElement("div");
	pane.setAttribute("data-conversation-content", "");
	pane.setAttribute("data-conversation-session", "session-turn");
	const question = dom.document.createElement("div");
	question.setAttribute("data-chat-turn", "3");
	question.setAttribute("data-chat-anchor-key", "row-turn-q");
	question.setAttribute("data-chat-role", "user");
	question.textContent = "这一轮的问题";
	const answer = dom.document.createElement("div");
	answer.setAttribute("data-chat-turn", "3");
	answer.setAttribute("data-chat-anchor-key", "row-turn-a");
	answer.setAttribute("data-chat-role", "assistant");
	answer.textContent = "这一轮的回答";
	pane.append(question, answer);
	dom.document.body.append(pane);

	const asked = testing.turnTextAt(question, 3, "user");
	check("a turn's question is read from the transcript", asked.text === "这一轮的问题", JSON.stringify(asked.text));
	check("and it keeps the row's coordinate", asked.source?.key === "row-turn-q" && asked.source?.turn === "3", JSON.stringify(asked.source));
	const answered = testing.turnTextAt(answer, 3, "assistant");
	check("a turn's answer is read too", answered.text === "这一轮的回答", JSON.stringify(answered.text));
	check("another turn is not mixed in", testing.turnTextAt(question, 4, "user").text === "", JSON.stringify(testing.turnTextAt(question, 4, "user").text));

	const opened = testing.openCommentFor(asked.text, "session-turn", asked.source, null);
	const turnBar = dom.document.getElementById("dsh-quote-bar");
	check("the box opens on the turn's wording", opened === true && turnBar?.querySelector(".dshq-quote-input")?.value === "这一轮的问题", JSON.stringify(turnBar?.querySelector(".dshq-quote-input")?.value));

	const turnSlot = registered.find((entry) => entry.spec.name === "conversation.chat.turnTail");
	check("the turn tail slot is registered", turnSlot !== undefined && turnSlot.spec.id === "ui-quote.turn", JSON.stringify(turnSlot?.spec));
	pane.remove();
}

/* ------------------------------------------------------------------ *
 * 一引用一线程 — the side thread is bound to the quote that opened it
 * ------------------------------------------------------------------ */

{
	testing.rememberQuoteThread("session-multi", "第一条引用", "thread-a");
	check("a quote keeps its own thread", testing.threadForQuote("session-multi", "第一条引用") === "thread-a", String(testing.threadForQuote("session-multi", "第一条引用")));
	check("another quote of the same session has none", testing.threadForQuote("session-multi", "第二条引用") === null, String(testing.threadForQuote("session-multi", "第二条引用")));
	testing.rememberSideThread("session-multi", "thread-default");
	const known = testing.sideThreadsOf("session-multi");
	check("the session keeps its default thread", known.default === "thread-default", String(known.default));
	check("and the quote's own thread beside it", known.quotes["第一条引用"] === "thread-a", JSON.stringify(known.quotes));
	check("the default thread is still the one the page shows", testing.storedSideThread("session-multi") === "thread-default", String(testing.storedSideThread("session-multi")));

	// 另开侧边对话 — a thread of its own, even when the session has one.
	const fetches = [];
	const openTabsBefore = openTabs.length;
	const realFetch = globalThis.fetch;
	globalThis.fetch = async (url, options) => {
		fetches.push({ url, options });
		return { ok: true, json: async () => ({ ok: true, value: { childId: "session-child-2" } }) };
	};
	const childState = installShell("session-child-2");
	await testing.sideChatRequest(sideService, "session-multi", "第三条引用", false, null, "", "new", "第三条引用");
	check("另开侧边对话 starts a thread of its own", fetches.length === 1 && openTabs.length === openTabsBefore + 1, JSON.stringify({ fetches: fetches.length, tabs: openTabs.length - openTabsBefore }));
	check("and the quote is bound to that thread", testing.threadForQuote("session-multi", "第三条引用") === "session-child-2", String(testing.threadForQuote("session-multi", "第三条引用")));
	check("the quote lands in that thread's composer", childState.draft === "> 第三条引用", JSON.stringify(childState.draft));
	globalThis.fetch = realFetch;
}

/* ------------------------------------------------------------------ *
 * 打开的行范围 — the quoted lines are marked once the preview is open
 * ------------------------------------------------------------------ */

{
	const preview = dom.document.createElement("div");
	const row12 = dom.document.createElement("div");
	row12.setAttribute("data-textpreview-line", "12");
	row12.rect = { left: 10, top: 100, width: 200, height: 18 };
	const row13 = dom.document.createElement("div");
	row13.setAttribute("data-textpreview-line", "13");
	row13.rect = { left: 10, top: 118, width: 200, height: 18 };
	const row20 = dom.document.createElement("div");
	row20.setAttribute("data-textpreview-line", "20");
	row20.rect = { left: 10, top: 160, width: 200, height: 18 };
	preview.append(row12, row13, row20);
	dom.document.body.append(preview);
	testing.setOpenedRange({ path: "src/app.ts", line: 12, end: 13 });
	const marks = testing.openedRangeMarks(800);
	check("the quoted lines of the opened file are marked", marks.length === 2, String(marks.length));
	check("and the marks know they are the file's", marks[0]?.getAttribute("data-kind") === "file", JSON.stringify(marks[0]?.getAttribute("data-kind")));
	testing.setOpenedRange({ path: "src/app.ts", line: 30, end: 30 });
	check("a line the preview never showed is not marked", testing.openedRangeMarks(800).length === 0, String(testing.openedRangeMarks(800).length));
	testing.setOpenedRange(null);
	preview.remove();
}

/* ------------------------------------------------------------------ *
 * 原生侧边对话页 — our own right-sidebar page type, embedded conversation
 * ------------------------------------------------------------------ */

{
	check("native is the default configured side-chat backend", testing.config().sideChatBackend === "native", testing.config().sideChatBackend);
	check("native is the fallback when the built-in route is unavailable", testing.sideChatBackend() === "native", testing.sideChatBackend());
	testing.setBuiltinSideChatState("available");
	check("the built-in hidden thread is preferred when the route answers", testing.sideChatBackend() === "builtin", testing.sideChatBackend());
	testing.setBuiltinSideChatState("unavailable");
	check("an unknown backend is dropped", testing.setConfig({ sideChatBackend: "bogus" }).sideChatBackend === "native");
	check("better-sidebar stays opt-in", testing.setConfig({ sideChatBackend: "better" }).sideChatBackend === "better");
	testing.setConfig({ sideChatBackend: "native" });

	const pageProviders = [];
	const pageTabs = [];
	const pageSlots = [];
	const retained = [];
	const released = [];
	const fakeSessions = {
		retain(address, options) {
			retained.push({ address, options });
			return { release: () => released.push(address.childSessionId) };
		},
		list: {
			getSnapshot: () => ({ byId: { "session-page-1": { projectionValues: { title: "原生页标题" } } } })
		}
	};
	const fakeHost = {
		effect: (fn) => fn(),
		resources: { register: (provider) => { pageProviders.push(provider); return () => {}; } },
		sidebarRightTabs: { register: (definition) => { pageTabs.push(definition); return () => {}; } },
		slots: {
			inject: (name, factory) => {
				const dispose = factory();
				return typeof dispose === "function" ? dispose : () => {};
			},
			register: (spec, Component) => {
				pageSlots.push({ spec, Component });
				return () => {};
			}
		}
	};
	const disposePage = testing.installNativeSideChatPage(fakeHost, fakeSessions);
	check("the native side chat page installs on a host with the slots", testing.nativeSideChatReady() === true);
	check("the page keeps its own stylesheet", dom.document.getElementById("dsh-quote-sidechat-style") !== null);
	const definition = pageTabs.find((entry) => entry.kind === "quote-sidechat");
	const address = testing.nativeThreadAddress("session-page-main", "session-page-1");
	check(
		"the page type claims only our own addresses",
		definition !== undefined &&
			definition.patterns[0] === "dsh-resource://quote-sidechat/session/**" &&
			definition.canOpen(address) === true &&
			definition.canOpen("dsh-resource://subagentchat/session/session-page-1?parent=session-page-main&mode=continuable") === false,
		JSON.stringify(definition?.patterns)
	);
	check("the title follows the renamed session", definition?.title(address) === "原生页标题", JSON.stringify(definition?.title(address)));
	const parsed = testing.parseNativeThreadAddress(address);
	check(
		"the address carries the parent and the mode",
		parsed?.parentSessionId === "session-page-main" && parsed?.childSessionId === "session-page-1" && parsed?.mode === "continuable",
		JSON.stringify(parsed)
	);
	check(
		"a malformed address is refused",
		testing.parseNativeThreadAddress("dsh-resource://quote-sidechat/session/x?parent=&mode=continuable") === null &&
			testing.parseNativeThreadAddress("dsh-resource://subagentchat/session/x?parent=p&mode=continuable") === null
	);
	const tabBody = pageSlots.find((entry) => entry.spec.name === "sidebar.right.pane.tab");
	const conversationBody = pageSlots.find((entry) => entry.spec.name === "ui-quote.sidechat.body");
	check(
		"the page body declares the embedded conversation child",
		tabBody?.spec.key === "dsh-client-ui-quote/sidechat" &&
			tabBody?.spec.children?.["ui-quote.sidechat.body"]?.kind === "single" &&
			tabBody?.spec.children?.["ui-quote.sidechat.body"]?.scope === "session" &&
			typeof conversationBody?.Component === "function",
		JSON.stringify(tabBody?.spec.children)
	);
	const provider = pageProviders.find((entry) => entry.protocol === "quote-sidechat");
	check("the resource provider is registered under our protocol", provider !== undefined);
	const controller = new AbortController();
	const iterator = provider.open(address, { signal: controller.signal });
	const first = await iterator.next();
	check("opening the resource retains the child session", first.value?.ok === true && retained[0]?.address?.childSessionId === "session-page-1", JSON.stringify(first.value?.ok));
	controller.abort();
	await iterator.return();
	check("closing the resource releases it", released.length === 1, JSON.stringify(released));
	openedResources.length = 0;
	check(
		"the tab opens our address",
		testing.openNativeThreadTab("session-page-main", "session-page-1") === true && openedResources[0]?.address === address,
		JSON.stringify(openedResources[0]?.address)
	);
	nativeForkImpl = async () => "session-page-2";
	await testing.nativeSideChatRequest("session-page-main-2", "页签标题", false, null, "");
	const opened = openedResources.find((entry) => String(entry.address).includes("session-page-2"));
	check(
		"a new thread opens our page",
		opened !== undefined && opened.address.startsWith("dsh-resource://quote-sidechat/session/session-page-2?"),
		JSON.stringify(opened?.address)
	);
	check("and the tab title is the quote itself", opened === undefined ? false : definition?.title(opened.address) === "页签标题", JSON.stringify(opened === undefined ? null : definition?.title(opened.address)));
	disposePage();
	check(
		"uninstalling the page takes its type and style with it",
		testing.nativeSideChatReady() === false && dom.document.getElementById("dsh-quote-sidechat-style") === null
	);
}

console.log(
	failures.length === 0
		? "\ndsh-client-ui-quote capsule: " + passed + " checks passed"
		: "\ndsh-client-ui-quote capsule: " + failures.length + " FAILED -> " + failures.join(", ")
);
process.exit(failures.length === 0 ? 0 : 1);

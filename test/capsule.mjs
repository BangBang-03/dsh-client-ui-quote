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
const effects = [];
/** What the plugin registered into the host's slots, so a test can mount it. */
const registered = [];
/** The locale dictionaries the plugin registers (zh/en), for the lost-state test. */
const dictionaries = [];
// The composer of every session the plugin may prefill: a session's input shell
// exists only once its view mounts, so tests install (and remove) them here.
const shells = new Map();
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
	const state = { draft: options.draft ?? "" };
	const shell = { state: { getSnapshot: () => ({ draft: state.draft }) } };
	if (options.draftFace === "actions") shell.actions = { setDraft: (text) => { state.draft = text; } };
	else if (options.draftFace !== false) shell.setDraft = (text) => { state.draft = text; };
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

	// The memory itself: ours is written, the host's binding wins, an empty id
	// only forgets ours.
	testing.rememberSideThread("session-q8", "session-side-8");
	const ownMap = JSON.parse(globalThis.localStorage.getItem("dsh-client-ui-quote:v1:sidechat-thread"));
	check("the plugin keeps its own thread map", ownMap?.["session-q8"] === "session-side-8", JSON.stringify(ownMap));
	bindHostThread("session-q8", "session-side-8-host");
	check("the host's binding wins over ours", testing.storedSideThread("session-q8") === "session-side-8-host");
	testing.rememberSideThread("session-q8", "");
	check("forgetting a session leaves the host's binding alone", testing.storedSideThread("session-q8") === "session-side-8-host");

	// Empty text is a no-op, not a request.
	fetches.length = 0;
	await testing.sideChatRequest(sideService, "session-q9", "   ");
	check("a blank quote never reaches the wire", fetches.length === 0);
} finally {
	globalThis.fetch = realFetch;
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
	const chipRefLine = String(insertions[0]?.attachment?.ref ?? "").split("\n").find((line) => line.startsWith("> ※ │q1:"));
	const chipRefPayload = chipRefLine === undefined ? null : testing.decodeQuoteRef(chipRefLine.slice("> ※ │q1:".length));
	check(
		"the committed chip carries its own coordinate",
		chipRefPayload !== null && chipRefPayload.k === "row-rev" && chipRefPayload.s === "session-rev" && chipRefPayload.t === "4",
		JSON.stringify(chipRefPayload)
	);
	check("the old quote is marked revised", testing.revisedFor(original)?.comment === newComment, JSON.stringify(testing.revisedFor(original)));
	check("the revision is persisted for the next page", JSON.stringify(globalThis.localStorage.getItem("dsh-client-ui-quote:v1:quote-revised")).includes(newComment));

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
	check(
		"the bar offers the actions",
		barOf()?.querySelector('[data-action="add"]') !== null && barOf()?.querySelector('[data-action="comment"]') !== null
	);

	// 2. A slot comes and goes — the listeners are not tied to it.
	const overlay = registered.find((entry) => entry.spec.name === "conversation.input.overlay");
	check("the overlay slot is registered for mounting", overlay !== undefined);
	dom.document.dispatch("keydown", { key: "Escape", isComposing: false, target: firstPane.run });
	check("Escape closes the bar", barOf()?.dataset.visible === "false", JSON.stringify(barOf()?.dataset.visible));
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
		"content that merely starts with ※ is left alone",
		testing.quoteBlock("※ 正文") === "> ❝ ※ 正文" && testing.splitQuoteRuns(testing.quoteBlock("※ 正文"))?.[0]?.quote === "※ 正文"
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

console.log(
	failures.length === 0
		? "\ndsh-client-ui-quote capsule: " + passed + " checks passed"
		: "\ndsh-client-ui-quote capsule: " + failures.length + " FAILED -> " + failures.join(", ")
);
process.exit(failures.length === 0 ? 0 : 1);

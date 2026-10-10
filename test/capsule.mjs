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

const reactStub = { useRef: (value) => ({ current: value }), useEffect() {} };
const exports_ = spec.factory((name) => {
	if (name === "react") return reactStub;
	throw new Error("unexpected require: " + name);
});

const sources = [];
const effects = [];
// The composer of every session the plugin may prefill: a session's input shell
// exists only once its view mounts, so tests install (and remove) them here.
const shells = new Map();
exports_.apply({
	effect(fn, label) {
		const dispose = fn();
		effects.push({ label, dispose });
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
	locale: { register: () => () => {} },
	slots: { inject: (name, factory) => { factory(); return () => {}; }, register: () => () => {} }
});

const testing = exports_.__testing;
const capsuleEffect = effects.find((entry) => String(entry.label).includes("capsules"));
check("the capsule effect is installed with the plugin", capsuleEffect !== undefined && typeof capsuleEffect.dispose === "function");
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

console.log(
	failures.length === 0
		? "\ndsh-client-ui-quote capsule: " + passed + " checks passed"
		: "\ndsh-client-ui-quote capsule: " + failures.length + " FAILED -> " + failures.join(", ")
);
process.exit(failures.length === 0 ? 0 : 1);

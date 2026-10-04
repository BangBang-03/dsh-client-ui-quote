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
 * is never touched.
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
try {
	globalThis.navigator = dom.navigator;
} catch (error) {
	Object.defineProperty(globalThis, "navigator", { value: dom.navigator, configurable: true });
}
globalThis.window = {
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
			return { input: { shell: () => ({ insertReference: () => true }) } };
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
check("the pill counts the lines in its tooltip", String(caps()[0]?.getAttribute("title")).includes("2 行"), JSON.stringify(caps()[0]?.getAttribute("title")));
check("a plain message is never touched", plain.style.display === "" && plain.textContent === "一条不含引用的普通消息");

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
check(
	"the first pill keeps its own line count",
	String(bubble3.querySelector(".dshq-cap")?.getAttribute("title")).includes("1 行"),
	JSON.stringify(bubble3.querySelector(".dshq-cap")?.getAttribute("title"))
);

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
check("a hand-written blockquote stays plain text", testing.splitQuoteRuns("> 只是引用格式\n> 第二行") === null);

console.log(
	failures.length === 0
		? "\ndsh-client-ui-quote capsule: " + passed + " checks passed"
		: "\ndsh-client-ui-quote capsule: " + failures.length + " FAILED -> " + failures.join(", ")
);
process.exit(failures.length === 0 ? 0 : 1);

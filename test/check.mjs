/**
 * Offline harness for dsh-client-ui-quote's client bundle.
 *
 * Loads lib/client.js the way the DSH client module loader does (a global
 * factory registry), applies it against a fake host context, and asserts the
 * registration contract: module id, service list, the slot entry, both locale
 * dictionaries, the component's null render, and the reference source + codec
 * that DSH's send path calls back into.
 *
 * Usage: node test/check.mjs      (or: npm test)
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "..", "lib", "client.js"), "utf8");

let spec = null;
globalThis.document = {}; // the bundle is web-only; its apply() bails without a document
globalThis.window = {
	__ModuleLoader__: {
		load(loaded) {
			spec = loaded;
		}
	}
};

// Parse + evaluate the bundle in a function scope, like the browser does.
new Function(source)();

if (spec === null) throw new Error("bundle did not register a module");
if (spec.id !== "dsh-client-ui-quote") throw new Error("unexpected module id: " + spec.id);

const reactStub = {
	useRef(value) {
		return { current: value };
	},
	useEffect() {}
};

const exports_ = spec.factory((name) => {
	if (name === "react") return reactStub;
	throw new Error("unexpected require: " + name);
});

if (typeof exports_.apply !== "function") throw new Error("no apply export");
if (JSON.stringify(exports_.inject) !== JSON.stringify(["slots", "locale"])) {
	throw new Error("unexpected inject: " + JSON.stringify(exports_.inject));
}

// Apply against a fake host context and capture what got registered.
const registered = [];
const dictionaries = [];
const sources = [];
let shellCalls = 0;
const ctx = {
	effect(fn, label) {
		fn();
		return () => {};
	},
	get(name) {
		if (name === "inputTriggers") {
			return {
				registerSource(source) {
					sources.push(source);
					return () => {};
				}
			};
		}
		if (name === "conversation") {
			return {
				input: {
					shell() {
						shellCalls += 1;
						return { insertReference: () => true };
					}
				}
			};
		}
		return undefined;
	},
	locale: {
		register(ns, dict) {
			dictionaries.push({ ns, dict });
			return () => {};
		}
	},
	slots: {
		inject(name, factory) {
			if (name !== "conversation.input.overlay") throw new Error("unexpected slot: " + name);
			factory();
			return () => {};
		},
		register(slotSpec, Component) {
			registered.push({ slotSpec, Component });
			return () => {};
		}
	}
};

exports_.apply(ctx);
exports_.apply(ctx); // idempotent re-apply must not throw

if (registered.length !== 2) throw new Error("expected 2 registrations, got " + registered.length);
const entry = registered[0];
if (entry.slotSpec.name !== "conversation.input.overlay") throw new Error("wrong slot");
if (entry.slotSpec.id !== "quote-selection") throw new Error("wrong entry id");
if (typeof entry.Component !== "function") throw new Error("component is not a function");
if (entry.Component({ sessionId: "s1", inputActions: {}, t: (k) => k }) !== null) {
	throw new Error("component must render nothing");
}
if (dictionaries.length !== 2) throw new Error("locale dictionary not registered per apply");
const dict = dictionaries[0].dict;
if (!dict.zh || !dict.en || !dict.zh.comment || !dict.en.comment) throw new Error("bad dictionaries");

// The chip owner: registered once (re-apply must reuse it), and its codec must
// hand the model form straight back — that is what the send path asks for.
if (sources.length !== 1) throw new Error("expected 1 reference source, got " + sources.length);
const quoteSource = sources[0];
if (quoteSource.name !== "quote") throw new Error("unexpected source name: " + quoteSource.name);
if (typeof quoteSource.codec?.serialize !== "function") throw new Error("source has no codec.serialize");
if (quoteSource.codec.serialize("> 引用正文\n\n") instanceof Promise === false) throw new Error("serialize must be async");
const model = await quoteSource.codec.serialize("> 引用正文\n\n");
if (model !== "> 引用正文\n\n") throw new Error("unexpected model form: " + model);
if (JSON.stringify(quoteSource.candidates()) !== "[]") throw new Error("menu candidates must stay empty");

console.log("OK  module id          :", spec.id);
console.log("OK  inject             :", JSON.stringify(exports_.inject));
console.log("OK  slot registration  :", entry.slotSpec.name, "/", entry.slotSpec.id, "/ locale", entry.slotSpec.locale);
console.log("OK  dictionaries       :", Object.keys(dict.zh).join(","), "|", Object.keys(dict.en).join(","));
console.log("OK  component renders  : null");
console.log("OK  reference source   :", quoteSource.name, "trigger", JSON.stringify(quoteSource.trigger), "serialize ->", JSON.stringify(model));

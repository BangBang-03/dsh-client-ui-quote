/**
 * Offline harness for dsh-client-ui-quote's client bundle.
 *
 * Loads lib/client.js the way the DSH client module loader does (a global
 * factory registry), applies it against a fake host context, and asserts the
 * registration contract: module id, service list, the slot entry, both locale
 * dictionaries, the component's null render, and the reference source + codec
 * that DSH's send path calls back into.
 *
 * It also checks the package manifest the way DSH's host reads it: the bundle
 * patch, the "./client" export, the icon file, the locale metadata dictionaries,
 * and the compatibility rule that only @deepseek-ai/dsh* peerDependencies can
 * disable a plugin row.
 *
 * Usage: node test/check.mjs      (or: npm test)
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, extname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const source = readFileSync(join(root, "lib", "client.js"), "utf8");

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

// ---- the package manifest DSH reads at compose time -------------------------
// The host resolves <pkg>/package.json, <pkg>/client, <pkg>/locale/<lang>.json and
// the icon through the exports map / the manifest directory, so every one of them
// has to exist and stay inside the package.
const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const dsh = manifest.dsh ?? {};
if (!manifest.name || !manifest.version) throw new Error("manifest needs name + version");
if (manifest.name !== spec.id) throw new Error("manifest name must match the bundle id");
if (dsh.manifestVersion !== 1) throw new Error("dsh.manifestVersion must be 1");
if (dsh.client?.platform !== "web") throw new Error("dsh.client.platform must be web");
if (dsh.engines !== undefined) throw new Error("engines.dsh belongs at the manifest root, not under dsh");
if (typeof manifest.engines?.dsh !== "string" || manifest.engines.dsh.trim() === "") {
	throw new Error("engines.dsh must declare the tested DSH range");
}
const patch = dsh.bundle?.patch;
if (typeof patch !== "string" || !existsSync(join(root, patch))) throw new Error("dsh.bundle.patch must point at a file");
const patchText = readFileSync(join(root, patch), "utf8");
if (!patchText.includes(manifest.name) || !patchText.includes("ui-quote")) {
	throw new Error("the bundle patch must insert the ui-quote row by package name");
}
for (const key of [".", "./client", "./package.json", "./locale/*.json"]) {
	if (typeof manifest.exports?.[key] !== "string") throw new Error("exports is missing " + key);
}
if (!existsSync(join(root, manifest.exports["./client"]))) throw new Error("exports ./client must exist");
// Only a @deepseek-ai/dsh* peerDependency is enforced (and would disable the row),
// so this plugin deliberately declares none.
for (const name of Object.keys(manifest.peerDependencies ?? {})) {
	if (name === "@deepseek-ai/dsh" || name.startsWith("@deepseek-ai/dsh-")) {
		throw new Error("a declarative peer range would let the compatibility preflight disable this plugin: " + name);
	}
}
// iconOf(): relative path, supported raster/vector type, at most 256 KiB, inside the package.
const ICON_MEDIA = new Map([
	[".svg", "image/svg+xml"],
	[".png", "image/png"],
	[".jpg", "image/jpeg"],
	[".jpeg", "image/jpeg"],
	[".webp", "image/webp"]
]);
const MAX_ICON_BYTES = 256 * 1024;
const icon = manifest.icon;
if (typeof icon !== "string" || /^[A-Za-z][A-Za-z\d+.-]*:/u.test(icon) || icon.startsWith("/") || icon.startsWith("\\")) {
	throw new Error("icon must be a relative file path");
}
const iconMedia = ICON_MEDIA.get(extname(icon).toLowerCase());
if (iconMedia === undefined) throw new Error("icon must be SVG, PNG, JPEG, or WebP");
const iconPath = join(root, icon);
if (!statSync(iconPath).isFile()) throw new Error("icon must be a regular file");
const iconBytes = statSync(iconPath).size;
if (iconBytes > MAX_ICON_BYTES) throw new Error("icon exceeds 256 KiB");
// dictionariesOf(): locale/en.json anchors the directory, every *.json carries meta.title/description.
const enPath = join(root, "locale", "en.json");
if (!existsSync(enPath)) throw new Error("locale/en.json is the anchor the host scans");
const locales = ["zh", "en"].map((id) => {
	const file = join(root, "locale", `${id}.json`);
	const meta = JSON.parse(readFileSync(file, "utf8")).meta;
	if (typeof meta?.title !== "string" || meta.title.trim() === "") throw new Error(`${id}: meta.title is required`);
	if (typeof meta?.description !== "string" || meta.description.trim() === "") throw new Error(`${id}: meta.description is required`);
	return `${id}: ${meta.title}`;
});
for (const entry of ["icon.svg", "locale", "lib", "test", patch.replace(/^\.\//u, "")]) {
	if (!(manifest.files ?? []).includes(entry)) throw new Error("files must ship " + entry);
}

console.log("OK  module id          :", spec.id);
console.log("OK  inject             :", JSON.stringify(exports_.inject));
console.log("OK  slot registration  :", entry.slotSpec.name, "/", entry.slotSpec.id, "/ locale", entry.slotSpec.locale);
console.log("OK  dictionaries       :", Object.keys(dict.zh).join(","), "|", Object.keys(dict.en).join(","));
console.log("OK  component renders  : null");
console.log("OK  reference source   :", quoteSource.name, "trigger", JSON.stringify(quoteSource.trigger), "serialize ->", JSON.stringify(model));
console.log("OK  manifest           :", manifest.name + "@" + manifest.version, "manifestVersion", dsh.manifestVersion, "| engines.dsh", manifest.engines.dsh, "| no enforced peers");
console.log("OK  bundle patch       :", patch, "inserts ui-quote");
console.log("OK  exports            :", Object.keys(manifest.exports).join(" "));
console.log("OK  icon               :", icon, `${iconBytes} B`, "-> data:" + iconMedia + ";base64,…");
console.log("OK  locale metadata    :", locales.join(" | "));

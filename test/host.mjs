/**
 * Host-half harness: the one capability lib/index.js contributes.
 *
 * The client bundle cannot create a hidden side thread — the public session
 * RPCs take neither a seed nor an origin. The host half builds the seed from
 * the parent's log and asks the AgentRegistry for a child marked
 * `origin: "subagent"`. Everything here is offline: the registry, the preset
 * service, the title service and the HTTP request/response are stubs, so the
 * exact options the host would receive are asserted byte for byte.
 *
 * Usage: node test/host.mjs      (or: npm test)
 */
import { Readable } from "node:stream";
import { apply, __testing } from "../lib/index.js";

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

const { buildThreadSeed, threadLabel, parentSelection, presetOf, startSideChat, handleSideChatRequest } = __testing;

// ---- labels and the parent's route ---------------------------------------
check("a label carries the shared side-thread prefix", threadLabel("  第一段\n引用  ") === "Side: 第一段 引用", threadLabel("  第一段\n引用  "));
check(
	"a label is clipped to the shared cap",
	threadLabel("字".repeat(80)).length === 48 && threadLabel("字".repeat(80)).endsWith("…"),
	String(threadLabel("字".repeat(80)).length)
);
check("an empty title still names the thread", threadLabel("") === "Side: New thread", threadLabel(""));
check(
	"the parent's newest log selection wins",
	JSON.stringify(parentSelection([
		{ type: "model/selection", data: { provider: "p1", model: "m1", reasoningEffort: "high" } },
		{ type: "request/header", data: { header: { config: { provider: "p1", model: "m1", reasoningEffort: "high" } } } },
		{ type: "model/selection", data: { provider: "p2", model: "m2" } }
	])) === JSON.stringify({ provider: "p2", model: "m2" }),
	JSON.stringify(parentSelection([{ type: "model/selection", data: { provider: "p2", model: "m2" } }]))
);
check(
	"the newest preset selection wins",
	presetOf({ agentPreset: "header" }, [
		{ type: "agent-preset/selected", data: { agentPreset: "old" } },
		{ type: "agent-preset/selected", data: { agentPreset: "new" } }
	]) === "new"
);
check("a header preset is the fallback", presetOf({ agentPreset: "header" }, []) === "header");

// ---- the seed ------------------------------------------------------------
const closedLog = [
	{ type: "turn/start", seq: 0, time: 1, data: { turn: 1 } },
	{ type: "step/start", seq: 1, time: 2, data: { turn: 1, step: 1 } },
	{ type: "user/message", seq: 2, time: 3, data: { content: [{ type: "text", text: "问题" }] } },
	{ type: "assistant/message", seq: 3, time: 4, data: { message: { content: [{ type: "text", text: "回答" }] } }, surfaceOp: "append" },
	{ type: "step/end", seq: 4, time: 5, data: { turn: 1, step: 1 } },
	{ type: "turn/end", seq: 5, time: 6, data: { turn: 1, reason: { kind: "done" } } }
];
const plainSeed = buildThreadSeed(closedLog, { cwd: "C:/work", label: "Side: 第一段", now: 100, agentProvider: "p", agentModel: "m", agentReasoningEffort: "high" });
check(
	"a closed parent log is copied verbatim",
	JSON.stringify(plainSeed.slice(0, closedLog.length)) === JSON.stringify(closedLog),
	JSON.stringify(plainSeed.slice(0, closedLog.length))
);
check(
	"the seed appends the working directory and our descriptor",
	plainSeed.length === closedLog.length + 2 &&
		plainSeed[closedLog.length].type === "working-directory/change" &&
		plainSeed[closedLog.length].data.cwd === "C:/work" &&
		plainSeed[closedLog.length + 1].type === "subagent/descriptor" &&
		plainSeed[closedLog.length + 1].data.version === 3 &&
		plainSeed[closedLog.length + 1].data.mode === "continuable" &&
		plainSeed[closedLog.length + 1].data.provider === "ui-quote" &&
		plainSeed[closedLog.length + 1].data.label === "Side: 第一段",
	JSON.stringify(plainSeed.slice(closedLog.length))
);
check(
	"the descriptor carries the parent's route",
	plainSeed[closedLog.length + 1].data.agentProvider === "p" &&
		plainSeed[closedLog.length + 1].data.agentModel === "m" &&
		plainSeed[closedLog.length + 1].data.agentReasoningEffort === "high",
	JSON.stringify(plainSeed[closedLog.length + 1].data)
);
check(
	"the seed's sequence stays contiguous from zero",
	plainSeed.every((event, index) => event.seq === index),
	plainSeed.map((event) => event.seq).join(",")
);

const openLog = closedLog.slice(0, 4);
const openSeed = buildThreadSeed(openLog, { label: "Side: 开着", now: 50 });
check(
	"an open step is closed before the inherited cut",
	openSeed.length === openLog.length + 3 &&
		openSeed[4].type === "step/end" &&
		openSeed[4].data.turn === 1 &&
		openSeed[4].data.step === 1 &&
		openSeed[5].type === "turn/end" &&
		openSeed[5].data.reason.kind === "interrupted" &&
		openSeed[6].type === "subagent/descriptor",
	JSON.stringify(openSeed.slice(openLog.length))
);

const danglingLog = closedLog.concat([
	{ type: "turn/start", seq: 6, time: 7, data: { turn: 2 } },
	{ type: "step/start", seq: 7, time: 8, data: { turn: 2, step: 1 } },
	{ type: "tool/call", seq: 8, time: 9, data: { callId: "call-1", name: "read" } },
	{ type: "agent/inbox/spliced", seq: 9, time: 10, data: { target: "next-turn", start: 0, inserted: [] } }
]);
const danglingSeed = buildThreadSeed(danglingLog, { label: "Side: 悬挂", now: 60 });
check(
	"a dangling tool call cuts the open turn, not the whole log",
	danglingSeed.length === closedLog.length + 1 &&
		danglingSeed[closedLog.length].type === "subagent/descriptor" &&
		danglingSeed.every((event, index) => event.seq === index),
	JSON.stringify(danglingSeed.slice(closedLog.length))
);
check(
	"the trailing inbox splice leaves with the cut turn",
	danglingSeed.every((event) => event.type !== "agent/inbox/spliced") && danglingSeed.some((event) => event.type === "turn/end"),
	danglingSeed.map((event) => event.type).join(",")
);

const nestedLog = closedLog.concat([
	{ type: "subagent/descriptor", seq: 6, time: 7, data: { version: 3, mode: "continuable", provider: "sidechat", label: "Side: parent" } }
]);
const nestedSeed = buildThreadSeed(nestedLog, { label: "Side: child", now: 70 });
check(
	"a parent descriptor is replaced in place, so ours is authoritative",
	nestedSeed.filter((event) => event.type === "subagent/descriptor").length === 1 &&
		nestedSeed[6].data.label === "Side: child" &&
		nestedSeed[6].data.provider === "ui-quote",
	JSON.stringify(nestedSeed[6])
);

let gapError = null;
try {
	buildThreadSeed([
		{ type: "turn/start", seq: 0, time: 1, data: { turn: 1 } },
		{ type: "turn/end", seq: 2, time: 2, data: { turn: 1 } }
	], { label: "Side: gap" });
} catch (error) {
	gapError = error;
}
check("a windowed log is refused instead of mis-seeded", gapError !== null && gapError.status === 400, gapError === null ? "no error" : String(gapError.status));

// ---- creating one hidden child ------------------------------------------
const parentEvents = closedLog.concat([
	{ type: "model/selection", seq: 6, time: 7, data: { provider: "route", model: "m-route", reasoningEffort: "low" } }
]);
const parentAgent = {
	options: { provider: "stale", model: "stale", reasoningEffort: "high" },
	session: {
		id: "session-parent",
		header: { cwd: "C:/work", agentPreset: "default" },
		snapshotEvents: () => parentEvents
	}
};
function makeCtx(overrides = {}) {
	const created = [];
	const titles = [];
	const disposed = [];
	const cleared = [];
	const services = {
		agents: {
			get: (id) => (id === "session-parent" ? parentAgent : undefined),
			create: async (options) => {
				created.push(options);
				return {
					agent: { session: { id: options.sessionId }, inbox: { clear: () => cleared.push(options.sessionId) } },
					dispose: async () => disposed.push(options.sessionId)
				};
			}
		},
		agentPresets: { resolve: async (id) => ({ id: id ?? "default" }), mount: async () => {} },
		workingDirectory: { get: () => "C:/work" },
		sessionTitle: { rename: (session, title) => titles.push({ id: session.id, title }) },
		connection: { requestRejection: () => undefined },
		...overrides
	};
	return {
		ctx: {
			get(name) {
				return services[name];
			}
		},
		created,
		titles,
		disposed,
		cleared
	};
}

const main = makeCtx();
const probed = await startSideChat(main.ctx, { probe: true });
check("the probe reports a usable host half", probed.available === true && probed.version === 1, JSON.stringify(probed));
const started = await startSideChat(main.ctx, { sessionId: "session-parent", title: "第一段引用" });
check(
	"the child id is minted and parented",
	typeof started.childId === "string" && started.childId.startsWith("session-") && started.parentId === "session-parent",
	JSON.stringify(started)
);
const options = main.created[0];
check(
	"the child is hidden from the session list",
	options.meta.origin === "subagent" && options.meta.parentSession === "session-parent" && options.meta.isSeeded === true,
	JSON.stringify(options.meta)
);
check(
	"the child inherits the parent's cwd, depth and preset",
	options.meta.cwd === "C:/work" && options.meta.delegationDepth === 1 && options.meta.agentPreset === "default",
	JSON.stringify(options.meta)
);
check(
	"the inherited count is the seed's own length",
	options.inheritedEventCount === options.seed.length && options.seed.every((event, index) => event.seq === index),
	String(options.inheritedEventCount)
);
check(
	"the child requests the parent's current route, not the stale creation default",
	options.agentOptions.provider === "route" && options.agentOptions.model === "m-route" && options.agentOptions.reasoningEffort === "low",
	JSON.stringify(options.agentOptions)
);
check(
	"the child gets a preset setup",
	typeof options.setup === "function" && options.meta.agentPreset === "default",
	typeof options.setup
);
check(
	"the descriptor names the quote and our provider",
	options.seed.at(-1).type === "subagent/descriptor" &&
		options.seed.at(-1).data.provider === "ui-quote" &&
		options.seed.at(-1).data.label === "Side: 第一段引用",
	JSON.stringify(options.seed.at(-1).data)
);
check("the inherited inbox is cleared", main.cleared.length === 1 && main.cleared[0] === started.childId, JSON.stringify(main.cleared));
check("the host session title is pinned to the quote", main.titles.length === 1 && main.titles[0].title === "Side: 第一段引用", JSON.stringify(main.titles));
check("the created child's disposer is kept", main.disposed.length === 0, JSON.stringify(main.disposed));

const missingParent = makeCtx({ agents: { get: () => undefined, create: async () => { throw new Error("must not create"); } } });
let notLive = null;
try {
	await startSideChat(missingParent.ctx, { sessionId: "session-parent", title: "x" });
} catch (error) {
	notLive = error;
}
check("an offline parent is a 409, not a broken thread", notLive !== null && notLive.status === 409, notLive === null ? "no error" : String(notLive.status));

const noAgents = makeCtx({ agents: undefined });
let unavailable = null;
try {
	await startSideChat(noAgents.ctx, { sessionId: "session-parent", title: "x" });
} catch (error) {
	unavailable = error;
}
check("a host without the agent registry is a 503", unavailable !== null && unavailable.status === 503, unavailable === null ? "no error" : String(unavailable.status));

// ---- the HTTP face -------------------------------------------------------
function response() {
	return {
		status: 0,
		body: "",
		writeHead(status) {
			this.status = status;
		},
		end(text) {
			this.body = text;
		}
	};
}
function request(method, url, payload) {
	const req = Readable.from(payload === undefined ? [] : [Buffer.from(JSON.stringify(payload), "utf8")]);
	req.method = method;
	req.url = url;
	return req;
}
const http = makeCtx();
const forbidden = response();
await handleSideChatRequest(makeCtx({ connection: { requestRejection: () => "blocked" } }).ctx, request("POST", "/ui-quote/api/sidechat.start", { probe: true }), forbidden, new Map());
check("a rejected browser request is forbidden", forbidden.status === 403, String(forbidden.status));
const wrongMethod = response();
await handleSideChatRequest(http.ctx, request("GET", "/ui-quote/api/sidechat.start"), wrongMethod, new Map());
check("the route only accepts POST", wrongMethod.status === 405, String(wrongMethod.status));
const unknown = response();
await handleSideChatRequest(http.ctx, request("POST", "/ui-quote/api/nope", { probe: true }), unknown, new Map());
check("an unknown method is a 404", unknown.status === 404, String(unknown.status));
const probeResponse = response();
await handleSideChatRequest(http.ctx, request("POST", "/ui-quote/api/sidechat.start", { probe: true }), probeResponse, new Map());
check(
	"a probe over HTTP answers the same envelope",
	probeResponse.status === 200 && JSON.parse(probeResponse.body).ok === true && JSON.parse(probeResponse.body).value.available === true,
	probeResponse.body
);
const createdResponse = response();
await handleSideChatRequest(http.ctx, request("POST", "/ui-quote/api/sidechat.start", { sessionId: "session-parent", title: "HTTP 引用" }), createdResponse, new Map());
check(
	"a start over HTTP returns the child",
	createdResponse.status === 200 && JSON.parse(createdResponse.body).ok === true && JSON.parse(createdResponse.body).value.parentId === "session-parent",
	createdResponse.body
);

// ---- registration and teardown ------------------------------------------
const routes = [];
const effects = [];
let routeDisposed = false;
const applyCtx = {
	effect(fn) {
		const dispose = fn();
		effects.push(dispose);
		return dispose;
	},
	get(name) {
		if (name === "webServer") {
			return {
				register(route) {
					routes.push(route);
					return () => {
						routeDisposed = true;
					};
				}
			};
		}
		if (name === "connection") return { requestRejection: () => undefined };
		return undefined;
	}
};
apply(applyCtx);
check("the host half registers one prefix route", routes.length === 1 && routes[0].kind === "prefix" && routes[0].path === "/ui-quote/api", JSON.stringify(routes.map((route) => route.path)));
check("the route is installed through an effect", effects.length === 1 && typeof effects[0] === "function");
if (effects.length === 1) effects[0]();
check("unloading the plugin removes the route", routeDisposed === true);
let threw = false;
try {
	apply({ effect() { throw new Error("must not be called"); } });
} catch (error) {
	threw = true;
}
check("a host without the web server is a no-op, not a throw", threw === false);

console.log(
	failures.length === 0
		? "\ndsh-client-ui-quote host: " + passed + " checks passed"
		: "\ndsh-client-ui-quote host: " + failures.length + " FAILED -> " + failures.join(", ")
);
process.exit(failures.length === 0 ? 0 : 1);

/**
 * Host-half harness: the one capability lib/index.js contributes.
 *
 * The client bundle cannot create a hidden side thread — the public session
 * RPCs take neither a seed nor an origin. The host half synthesizes one context
 * message from the parent's own words, asks the AgentRegistry for a child
 * marked `origin: "subagent"`, and marks the inherited cut before it. Everything here is offline: the registry, the preset
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

const { buildThreadSeed, transcriptOf, threadLabel, parentSelection, presetOf, startSideChat, handleSideChatRequest } = __testing;

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
// A side thread opens with ONE injected-context message, not a copy of the
// parent log: the chat UI folds that into a single context row, and the model
// still reads the parent's own words as background.
const closedLog = [
	{ type: "turn/start", seq: 0, time: 1, data: { turn: 1 } },
	{ type: "step/start", seq: 1, time: 2, data: { turn: 1, step: 1 } },
	{ type: "user/message", seq: 2, time: 3, data: { id: "m1", role: "user", source: { kind: "user" }, content: [{ type: "text", text: "第一个问题" }] }, surfaceOp: "append" },
	{ type: "assistant/message", seq: 3, time: 4, data: { message: { id: "m2", role: "assistant", source: { kind: "model", provider: "p", model: "m" }, content: [{ type: "text", text: "第一个回答" }] } }, surfaceOp: "append" },
	{ type: "step/end", seq: 4, time: 5, data: { turn: 1, step: 1 } },
	{ type: "turn/end", seq: 5, time: 6, data: { turn: 1, reason: { kind: "done" } } },
	{ type: "user/message", seq: 6, time: 7, data: { id: "m3", role: "user", source: { kind: "runtime-context", form: "snapshot" }, content: [{ type: "text", text: "Current runtime context. 不该出现在侧聊里" }] }, surfaceOp: "append" },
	{ type: "tool/call", seq: 7, time: 8, data: { callId: "c1", name: "read" } },
	{ type: "user/message", seq: 8, time: 9, data: { id: "m4", role: "user", source: { kind: "user" }, content: [{ type: "text", text: "最后一句问题" }] }, surfaceOp: "append" }
];
const { seed: plainSeed, inheritedEventCount: plainCut } = buildThreadSeed(closedLog, { label: "Side: 第一段", now: 100, agentProvider: "p", agentModel: "m", agentReasoningEffort: "high" });
check(
	"the seed carries no copied history",
	plainSeed.length === 7 &&
		plainSeed.map((event) => event.type).join(",") === "session/end-seed,turn/start,step/start,user/message,step/end,turn/end,subagent/descriptor",
	plainSeed.map((event) => event.type).join(",")
);
check(
	"the context rides inside one closed turn, so the session is not blank",
	plainSeed[1].type === "turn/start" &&
		plainSeed[1].data.turn === 1 &&
		plainSeed[2].type === "step/start" &&
		plainSeed[4].type === "step/end" &&
		plainSeed[5].type === "turn/end" &&
		plainSeed[5].data.reason.kind === "done",
	JSON.stringify(plainSeed.slice(1, 6).map((event) => event.type))
);
check(
	"the inherited cut is the empty prefix at zero",
	plainCut === 0 && plainSeed[0].type === "session/end-seed" && plainSeed[0].data.inherited === true,
	JSON.stringify({ cut: plainCut, marker: plainSeed[0] })
);
const contextEvent = plainSeed[3];
const contextText = contextEvent?.data?.content?.[0]?.text ?? "";
check(
	"the one message is injected context, not a user prompt",
	contextEvent?.type === "user/message" &&
		contextEvent.surfaceOp === "append" &&
		contextEvent.data.role === "user" &&
		contextEvent.data.source.kind === "session-context" &&
		typeof contextEvent.data.id === "string" &&
		contextEvent.data.id.startsWith("ctx-"),
	JSON.stringify(contextEvent?.data?.source)
);
check(
	"the context carries the parent's own words, newest last",
	contextText.includes("用户：第一个问题") &&
		contextText.includes("助手：第一个回答") &&
		contextText.indexOf("第一个问题") < contextText.indexOf("最后一句问题") &&
		contextText.trimEnd().endsWith("接下来只回答我在引用之后提出的问题；引用本身来自主会话。"),
	contextText.slice(0, 240)
);
check(
	"injected context and tool traffic stay out of the transcript",
	!contextText.includes("Current runtime context") && !contextText.includes("read"),
	contextText.slice(0, 240)
);
check(
	"the transcript is capped from the newest end",
	(() => {
		const long = Array.from({ length: 40 }, (_, index) => ({
			type: "user/message",
			seq: index,
			time: index,
			data: { id: "m" + index, role: "user", source: { kind: "user" }, content: [{ type: "text", text: "第" + index + "条" + "x".repeat(50) }] },
			surfaceOp: "append"
		}));
		const text = transcriptOf(long, 400);
		return text.length <= 400 && text.includes("第39条") && !text.includes("第0条");
	})(),
	"bounded"
);
check(
	"one message longer than the whole budget is truncated, not dropped",
	(() => {
		const huge = [
			{
				type: "user/message",
				seq: 0,
				time: 0,
				data: { id: "m-long", role: "user", source: { kind: "user" }, content: [{ type: "text", text: "长".repeat(500) }] },
				surfaceOp: "append"
			}
		];
		const text = transcriptOf(huge, 120);
		return text.startsWith("用户：") && text.length <= 120 && text.endsWith("…");
	})(),
	"truncated"
);
check(
	"a missing or nonsensical budget falls back to the default cap",
	(() => {
		const one = [
			{
				type: "user/message",
				seq: 0,
				time: 0,
				data: { id: "m-one", role: "user", source: { kind: "user" }, content: [{ type: "text", text: "一句话" }] },
				surfaceOp: "append"
			}
		];
		return transcriptOf(one, Number.NaN) === "用户：一句话" && transcriptOf(one, 0) === "用户：一句话" && transcriptOf(one, undefined) === "用户：一句话";
	})(),
	"guarded"
);
check(
	"an empty parent still yields a usable context",
	(() => {
		const { seed } = buildThreadSeed([], { label: "Side: 空" });
		const text = seed[3].data.content[0].text;
		return text.includes("还没有可引用的文字") && seed.length === 7;
	})(),
	"ok"
);
check(
	"the descriptor is last and names the quote and our provider",
	plainSeed[6].type === "subagent/descriptor" &&
		plainSeed[6].data.version === 3 &&
		plainSeed[6].data.mode === "continuable" &&
		plainSeed[6].data.provider === "ui-quote" &&
		plainSeed[6].data.label === "Side: 第一段",
	JSON.stringify(plainSeed[6].data)
);
check(
	"the descriptor sits after the inherited cut, which the host validates",
	plainSeed.findIndex((event) => event.type === "subagent/descriptor") > plainCut,
	JSON.stringify({ cut: plainCut, at: plainSeed.findIndex((event) => event.type === "subagent/descriptor") })
);
check(
	"the descriptor carries the parent's route",
	plainSeed[6].data.agentProvider === "p" &&
		plainSeed[6].data.agentModel === "m" &&
		plainSeed[6].data.agentReasoningEffort === "high",
	JSON.stringify(plainSeed[6].data)
);
check(
	"the seed's sequence stays contiguous from zero",
	plainSeed.every((event, index) => event.seq === index),
	plainSeed.map((event) => event.seq).join(",")
);

// The parent may itself be a side thread: no descriptor is copied either way,
// so a nested thread is the same seven events.
const nestedLog = closedLog.concat([
	{ type: "subagent/descriptor", seq: 9, time: 10, data: { version: 3, mode: "continuable", provider: "sidechat", label: "Side: parent" } }
]);
const { seed: nestedSeed, inheritedEventCount: nestedCut } = buildThreadSeed(nestedLog, { label: "Side: child", now: 70 });
check(
	"a nested parent yields the same seven-event seed",
	nestedCut === 0 &&
		nestedSeed.length === 7 &&
		nestedSeed.filter((event) => event.type === "subagent/descriptor").length === 1 &&
		nestedSeed[6].data.label === "Side: child" &&
		!nestedSeed[3].data.content[0].text.includes("Side: parent"),
	JSON.stringify(nestedSeed.map((event) => event.type))
);

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
			resume: async ({ resumeSessionId }) => {
				if (resumeSessionId === "session-broken") {
					throw Object.assign(new Error("agents.resume exploded"), { code: "NOT_RESUMABLE", cause: new Error("the underlying cause") });
				}
				return { agent: { session: { id: resumeSessionId } }, dispose: async () => disposed.push(resumeSessionId) };
			},
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
	"the inherited count is the marked cut, not the whole seed",
	options.inheritedEventCount === 0 &&
		options.seed[0].type === "session/end-seed" &&
		options.seed[0].data.inherited === true &&
		options.inheritedEventCount < options.seed.length &&
		options.seed.every((event, index) => event.seq === index),
	String(options.inheritedEventCount)
);
check(
	"the descriptor the host folds is the child's own",
	options.seed.findIndex((event) => event.type === "subagent/descriptor") > options.inheritedEventCount,
	JSON.stringify({ cut: options.inheritedEventCount, at: options.seed.findIndex((event) => event.type === "subagent/descriptor") })
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

const diagNoParent = response();
await handleSideChatRequest(http.ctx, request("POST", "/ui-quote/api/resume.diag", { parentSessionId: "session-other", childSessionId: "session-child" }), diagNoParent, new Map());
check(
	"the resume diagnostic reports an offline parent",
	diagNoParent.status === 200 &&
		JSON.parse(diagNoParent.body).value.parentLive === false &&
		JSON.parse(diagNoParent.body).value.reason === "the parent session is not live",
	diagNoParent.body
);
const diagFailed = response();
await handleSideChatRequest(http.ctx, request("POST", "/ui-quote/api/resume.diag", { parentSessionId: "session-parent", childSessionId: "session-broken" }), diagFailed, new Map());
const diagFailedBody = JSON.parse(diagFailed.body);
check(
	"the resume diagnostic hands back the host's own error",
	diagFailed.status === 200 &&
		diagFailedBody.value.error.message === "agents.resume exploded" &&
		diagFailedBody.value.error.code === "NOT_RESUMABLE" &&
		diagFailedBody.value.error.cause === "the underlying cause",
	diagFailed.body
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

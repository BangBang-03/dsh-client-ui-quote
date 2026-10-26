/**
 * Host half of dsh-client-ui-quote.
 *
 * The plugin's UI lives in lib/client.js. This half contributes exactly one
 * capability: a hidden side thread. A side thread has to be a child Session
 * seeded from the parent's log and marked `origin: "subagent"`, because that
 * is the only durable shape DSH's session list leaves out. The public session
 * RPCs accept neither a seed nor an origin, so the client cannot create one;
 * this route can, through the host's own AgentRegistry.
 *
 * Everything is guarded: a host without the web server, connection fence,
 * agents or session-title service registers no route (or answers 503), and
 * the client silently falls back to a plain fork. No package dependency is
 * added, no file is written, and no request leaves the machine.
 */

import { randomUUID } from "node:crypto";

/** Route prefix; the client posts to `${API_PREFIX}/${START_METHOD}`. */
const API_PREFIX = "/ui-quote/api";
const START_METHOD = "sidechat.start";
/** The durable label better-sidebar's side threads share (`sideThreadRows`). */
const THREAD_LABEL_PREFIX = "Side: ";
/** Same cap better-sidebar uses for its own side-thread labels. */
const LABEL_MAX_CHARS = 48;
/** The subagent descriptor version this DSH reads (app.asar 0.2.1-rc.2). */
const DESCRIPTOR_VERSION = 3;
/** Producer identity in the descriptor; distinct from better-sidebar's. */
const PROVIDER = "ui-quote";
const BODY_LIMIT = 64 * 1024;
const CREATE_TIMEOUT_MS = 15000;
const PROBE_VERSION = 1;

class SidechatError extends Error {
	constructor(code, message, status) {
		super(message);
		this.name = "SidechatError";
		this.code = code;
		this.status = status;
	}
}

/** Resolve a host service by name, tolerating either the getter or property face. */
function serviceOf(ctx, name) {
	try {
		if (ctx !== null && ctx !== undefined && typeof ctx.get === "function") {
			const value = ctx.get(name);
			if (value !== undefined && value !== null) return value;
		}
	} catch (error) {
		// Fall through to the property form.
	}
	try {
		const value = ctx === null || ctx === undefined ? undefined : ctx[name];
		return value === undefined ? null : value;
	} catch (error) {
		return null;
	}
}

/** A stable, clipped side-thread label (`Side: <quote first line>`). */
export function threadLabel(title) {
	const flat = typeof title === "string" ? title.replace(/\s+/gu, " ").trim() : "";
	const body = flat === "" ? "New thread" : flat;
	const max = LABEL_MAX_CHARS - THREAD_LABEL_PREFIX.length;
	const clipped = body.length > max ? body.slice(0, max - 1) + "…" : body;
	return THREAD_LABEL_PREFIX + clipped;
}

/** One event envelope copied without sharing the host's immutable object. */
export function copySeedEvent(event) {
	const copy = { type: event.type, seq: event.seq, time: event.time, data: event.data };
	if (event.surfaceOp !== undefined) copy.surfaceOp = event.surfaceOp;
	if (event.sourceEventSeqs !== undefined) copy.sourceEventSeqs = event.sourceEventSeqs;
	if (event.ignorable !== undefined) copy.ignorable = event.ignorable;
	return copy;
}

function numberAt(data, key) {
	const value = data === null || data === undefined ? undefined : data[key];
	return typeof value === "number" && Number.isSafeInteger(value) ? value : 0;
}

/** Index of the last turn boundary, or -1 when the log never opened a turn. */
function lastTurnBoundary(events) {
	for (let index = events.length - 1; index >= 0; index -= 1) {
		const type = events[index]?.type;
		if (type === "turn/start" || type === "turn/end") return index;
	}
	return -1;
}

/** The step number still open inside the turn starting at `turnStart`. */
function openStepOf(events, turnStart) {
	let open;
	for (let index = turnStart + 1; index < events.length; index += 1) {
		const event = events[index];
		if (event?.type === "step/start") open = numberAt(event.data, "step");
		else if (event?.type === "step/end") open = undefined;
	}
	return open;
}

/** Whether the open turn ends with a tool call that never got its result. */
function hasDanglingToolCall(events, turnStart) {
	const pending = new Set();
	for (let index = turnStart + 1; index < events.length; index += 1) {
		const event = events[index];
		if (event?.type === "step/end") {
			pending.clear();
			continue;
		}
		if (event?.type === "tool/call") {
			const callId = event.data?.callId;
			if (typeof callId === "string" && callId !== "") pending.add(callId);
			continue;
		}
		if (event?.type === "tool/result") {
			const callId = event.data?.message?.source?.callId;
			if (typeof callId === "string") pending.delete(callId);
		}
	}
	return pending.size > 0;
}

/** The model route the parent currently requests with, from its own log. */
export function parentSelection(events) {
	let pending;
	let lastUsed;
	const read = (data) => {
		const provider = data?.provider;
		const model = data?.model;
		if (typeof provider !== "string" || provider === "" || typeof model !== "string" || model === "") return undefined;
		const reasoningEffort = typeof data.reasoningEffort === "string" && data.reasoningEffort !== "" ? data.reasoningEffort : undefined;
		return reasoningEffort === undefined ? { provider, model } : { provider, model, reasoningEffort };
	};
	for (const event of Array.isArray(events) ? events : []) {
		if (event?.type === "model/selection") {
			const selection = read(event.data);
			if (selection !== undefined) pending = selection;
			continue;
		}
		if (event?.type !== "request/header") continue;
		const selection = read(event.data?.header?.config);
		if (selection === undefined) continue;
		lastUsed = selection;
		if (pending !== undefined && pending.provider === selection.provider && pending.model === selection.model && pending.reasoningEffort === selection.reasoningEffort) pending = undefined;
	}
	return pending ?? lastUsed ?? null;
}

/** The agent preset the parent actually runs (newest selection wins). */
export function presetOf(header, events) {
	for (let index = (Array.isArray(events) ? events : []).length - 1; index >= 0; index -= 1) {
		const event = events[index];
		if (event?.type !== "agent-preset/selected") continue;
		if (typeof event.data?.agentPreset === "string" && event.data.agentPreset !== "") return event.data.agentPreset;
	}
	return typeof header?.agentPreset === "string" && header.agentPreset !== "" ? header.agentPreset : undefined;
}

/** One descriptor payload; the host's subagent projection folds this shape. */
function descriptorOf(options) {
	return {
		version: DESCRIPTOR_VERSION,
		mode: "continuable",
		provider: PROVIDER,
		label: options.label,
		...(options.agentProvider === undefined ? {} : { agentProvider: options.agentProvider }),
		...(options.agentModel === undefined ? {} : { agentModel: options.agentModel }),
		...(options.agentReasoningEffort === undefined ? {} : { agentReasoningEffort: options.agentReasoningEffort })
	};
}

/**
 * Build the child's seed from the parent's log.
 *
 * The copy is verbatim so the model sees the same messages, tool results and
 * compactions it saw in the parent. A turn still open at the copy moment is
 * closed honestly (`turn/end` with `interrupted`); a dangling tool call
 * cannot be closed that way, so the open turn is cut instead.
 *
 * The copy then ends at an explicit inherited cut — a `session/end-seed`
 * marker with `inherited: true` — and everything the child owns (turn
 * closers, the working directory, our descriptor) is appended AFTER it. That
 * placement is load-bearing, not cosmetic: the host reads a child's identity
 * from its `subagent` projection and rejects any descriptor whose `seq` is
 * below the cut ("subagent descriptor is unavailable"). Marking the cut also
 * keeps a nested side thread honest — the parent's own descriptor stays in
 * the inherited prefix while ours is the last one the projection folds.
 *
 * @param {Array<object>} events - the parent session's event log.
 * @param {object} options - cwd, label, model route, and an optional clock.
 * @returns {{seed: Array<object>, inheritedEventCount: number}} the seed,
 *   seq-contiguous from 0, plus the index of its inherited cut.
 */
export function buildThreadSeed(events, options = {}) {
	const source = Array.isArray(events) ? events : [];
	for (let index = 0; index < source.length; index += 1) {
		if (source[index] === null || source[index] === undefined || source[index].seq !== index) {
			throw new SidechatError("bad-session", "the parent session log is not contiguous", 400);
		}
	}
	const now = options.now ?? Date.now();
	let seed = source.map(copySeedEvent);
	const closers = [];
	const boundary = lastTurnBoundary(seed);
	if (boundary >= 0 && seed[boundary]?.type === "turn/start") {
		const turn = numberAt(seed[boundary].data, "turn");
		if (hasDanglingToolCall(seed, boundary)) {
			seed = seed.slice(0, boundary);
			while (seed.length > 0 && seed[seed.length - 1]?.type === "agent/inbox/spliced") seed.pop();
		} else {
			const step = openStepOf(seed, boundary);
			if (step !== undefined) closers.push({ type: "step/end", time: now, data: { turn, step } });
			closers.push({ type: "turn/end", time: now, data: { turn, reason: { kind: "interrupted" } } });
		}
	}
	const inheritedEventCount = seed.length;
	seed.push({ type: "session/end-seed", seq: inheritedEventCount, time: now, data: { inherited: true } });
	for (const closer of closers) seed.push({ ...closer, seq: seed.length });
	if (typeof options.cwd === "string" && options.cwd !== "") {
		seed.push({ type: "working-directory/change", seq: seed.length, time: now, data: { cwd: options.cwd } });
	}
	seed.push({ type: "subagent/descriptor", seq: seed.length, time: now, data: descriptorOf(options) });
	return { seed, inheritedEventCount };
}

/** The host's preset composition for the child (a no-op without the service). */
async function composeSetup(ctx, presetId) {
	const presets = serviceOf(ctx, "agentPresets");
	if (presets === null || presets === undefined || typeof presets.resolve !== "function") return { setup: async () => {} };
	let resolved;
	try {
		resolved = await presets.resolve(presetId);
	} catch (error) {
		return { setup: async () => {} };
	}
	const id = resolved !== null && resolved !== undefined && typeof resolved.id === "string" && resolved.id !== "" ? resolved.id : presetId;
	if (typeof id !== "string" || id === "" || typeof presets.mount !== "function") return { setup: async () => {} };
	return {
		agentPreset: id,
		setup: async (agentCtx) => {
			await presets.mount(agentCtx, id);
		}
	};
}

/** The parent's authoritative working directory, when the host exposes one. */
function cwdOf(ctx, parent) {
	const working = serviceOf(ctx, "workingDirectory");
	try {
		if (working !== null && working !== undefined && typeof working.get === "function") {
			const cwd = working.get(parent.session);
			if (typeof cwd === "string" && cwd !== "") return cwd;
		}
	} catch (error) {
		// Fall back to the header.
	}
	const cwd = parent.session?.header?.cwd;
	return typeof cwd === "string" && cwd !== "" ? cwd : undefined;
}

function createSignal() {
	try {
		if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") return AbortSignal.timeout(CREATE_TIMEOUT_MS);
	} catch (error) {
		// No signal on this runtime.
	}
	return undefined;
}

/**
 * Create one hidden side thread. Exported for the offline host suite; the
 * route below is a thin HTTP wrapper around it.
 *
 * @param {object} ctx - the host context (only `get`/property lookups are used).
 * @param {object} payload - `{ sessionId, title }`, or `{ probe: true }`.
 * @param {Map<string, Function>} handles - live child disposers, keyed by id.
 * @returns {Promise<object>} `{ childId, parentId }` or `{ available, version }`.
 */
export async function startSideChat(ctx, payload, handles = new Map()) {
	const agents = serviceOf(ctx, "agents");
	if (agents === null || agents === undefined || typeof agents.create !== "function" || typeof agents.get !== "function") {
		throw new SidechatError("sidechat-error", "the agents service is unavailable", 503);
	}
	if (payload !== null && payload !== undefined && payload.probe === true) return { available: true, version: PROBE_VERSION };
	const sessionId = typeof payload?.sessionId === "string" ? payload.sessionId.trim() : "";
	if (sessionId === "") throw new SidechatError("bad-request", "sessionId is required", 400);
	const parent = agents.get(sessionId);
	if (parent === null || parent === undefined || parent.session === null || parent.session === undefined) {
		throw new SidechatError("parent-not-live", "the parent session is not running", 409);
	}
	const events = typeof parent.session.snapshotEvents === "function" ? parent.session.snapshotEvents() : null;
	if (!Array.isArray(events)) throw new SidechatError("bad-session", "the parent session log is unavailable", 409);
	const label = threadLabel(payload?.title);
	const cwd = cwdOf(ctx, parent);
	const selection = parentSelection(events);
	const routeProvider = selection?.provider ?? parent.options?.provider;
	const routeModel = selection?.model ?? parent.options?.model;
	const routeEffort = selection?.reasoningEffort ?? parent.options?.reasoningEffort;
	const { agentPreset, setup } = await composeSetup(ctx, presetOf(parent.session.header, events));
	const { seed, inheritedEventCount } = buildThreadSeed(events, {
		cwd,
		label,
		agentProvider: routeProvider,
		agentModel: routeModel,
		agentReasoningEffort: routeEffort
	});
	const childId = "session-" + randomUUID();
	const agentOptions = { ...(parent.options ?? {}) };
	if (typeof routeProvider === "string" && routeProvider !== "") agentOptions.provider = routeProvider;
	if (typeof routeModel === "string" && routeModel !== "") agentOptions.model = routeModel;
	if (typeof routeEffort === "string" && routeEffort !== "") agentOptions.reasoningEffort = routeEffort;
	else delete agentOptions.reasoningEffort;
	const signal = createSignal();
	let handle;
	try {
		handle = await agents.create({
			sessionId: childId,
			meta: {
				...(cwd === undefined ? {} : { cwd }),
				parentSession: parent.session.id,
				isSeeded: true,
				origin: "subagent",
				delegationDepth: (parent.session.header?.delegationDepth ?? 0) + 1,
				...(agentPreset === undefined ? {} : { agentPreset })
			},
			seed,
			inheritedEventCount,
			agentOptions,
			setup,
			...(signal === undefined ? {} : { signal })
		});
	} catch (error) {
		throw new SidechatError("sidechat-error", "thread creation failed: " + (error instanceof Error ? error.message : String(error)), 500);
	}
	if (handle !== null && handle !== undefined && typeof handle.dispose === "function") handles.set(childId, handle.dispose);
	try {
		handle?.agent?.inbox?.clear?.();
	} catch (error) {
		// A missing inbox face is not fatal.
	}
	try {
		const titles = serviceOf(ctx, "sessionTitle");
		if (titles !== null && titles !== undefined && typeof titles.rename === "function" && handle?.agent?.session !== undefined) {
			titles.rename(handle.agent.session, label);
		}
	} catch (error) {
		// The descriptor label still names the thread.
	}
	return { childId, parentId: parent.session.id };
}

/** Read one JSON body with a hard size cap. */
function readJsonBody(req) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		let size = 0;
		req.on("data", (chunk) => {
			size += chunk.length;
			if (size > BODY_LIMIT) {
				reject(new SidechatError("bad-request", "request body is too large", 413));
				if (typeof req.destroy === "function") req.destroy();
				return;
			}
			chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
		});
		req.on("end", () => {
			const text = Buffer.concat(chunks).toString("utf8");
			if (text.trim() === "") {
				resolve({});
				return;
			}
			try {
				const parsed = JSON.parse(text);
				resolve(parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {});
			} catch (error) {
				reject(new SidechatError("bad-request", "invalid JSON body", 400));
			}
		});
		req.on("error", (error) => {
			reject(new SidechatError("bad-request", "the request body could not be read", 400));
		});
	});
}

function writeJson(res, status, body) {
	try {
		const text = JSON.stringify(body);
		res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
		res.end(text);
	} catch (error) {
		// The connection left; nothing else to do.
	}
}

function failure(error) {
	const code = typeof error?.code === "string" ? error.code : "sidechat-error";
	const status = typeof error?.status === "number" ? error.status : 500;
	const message = error instanceof Error ? error.message : String(error);
	return { status, body: { ok: false, error: { code, message } } };
}

/**
 * The `/ui-quote/api` handler. Exported for the offline host suite.
 *
 * @param {object} ctx - host context.
 * @param {object} req - Node request.
 * @param {object} res - Node response.
 * @param {Map<string, Function>} handles - live child disposers.
 */
export async function handleSideChatRequest(ctx, req, res, handles) {
	const connection = serviceOf(ctx, "connection");
	if (connection === null || connection === undefined || typeof connection.requestRejection !== "function") {
		writeJson(res, 503, { ok: false, error: { code: "sidechat-error", message: "the connection fence is unavailable" } });
		return;
	}
	let rejection;
	try {
		rejection = connection.requestRejection(req);
	} catch (error) {
		rejection = true;
	}
	if (rejection !== undefined) {
		writeJson(res, 403, { ok: false, error: { code: "forbidden", message: "forbidden" } });
		return;
	}
	if (req.method !== "POST") {
		writeJson(res, 405, { ok: false, error: { code: "method-error", message: "POST only" } });
		return;
	}
	let method = "";
	try {
		method = new URL(req.url ?? "/", "http://dsh.internal").pathname.slice(API_PREFIX.length + 1);
	} catch (error) {
		method = "";
	}
	if (method !== START_METHOD) {
		writeJson(res, 404, { ok: false, error: { code: "not-found", message: "unknown API method" } });
		return;
	}
	try {
		const payload = await readJsonBody(req);
		const value = await startSideChat(ctx, payload, handles);
		writeJson(res, 200, { ok: true, value });
	} catch (error) {
		const failed = failure(error);
		writeJson(res, failed.status, failed.body);
	}
}

/**
 * The host half's only effect: one same-origin route, removed with the plugin.
 * The child agents are disposed with it; their sessions stay on disk and can
 * be reopened.
 *
 * @param {object} ctx - the plugin's host context.
 */
export function apply(ctx) {
	if (ctx === null || ctx === undefined || typeof ctx.effect !== "function") return;
	const handles = new Map();
	const install = (hostCtx) => {
		const webServer = serviceOf(hostCtx, "webServer");
		if (webServer === null || webServer === undefined || typeof webServer.register !== "function") return;
		hostCtx.effect(() => {
			let disposeRoute = () => {};
			try {
				disposeRoute = webServer.register({
					kind: "prefix",
					path: API_PREFIX,
					handler: (req, res) => {
						void handleSideChatRequest(hostCtx, req, res, handles);
					}
				});
			} catch (error) {
				console.warn("[ui-quote] the side-chat route could not be registered:", error);
				return () => {};
			}
			return () => {
				try {
					if (typeof disposeRoute === "function") disposeRoute();
				} catch (error) {
					// The host is already tearing the route down.
				}
				for (const dispose of handles.values()) {
					try {
						dispose();
					} catch (error) {
						// Best-effort teardown.
					}
				}
				handles.clear();
			};
		}, "ui-quote: hidden side-chat API");
	};
	// The web server mounts after this plugin's host half in the web profile,
	// exactly like the client's sidebar services. `inject` waits for it; a host
	// without it (headless) never calls back and simply has no route.
	if (typeof ctx.inject === "function" && typeof ctx.get === "function") {
		try {
			ctx.inject(["webServer"], install);
			return;
		} catch (error) {
			// Fall through to the direct lookup.
		}
	}
	install(ctx);
}

/** The offline host suite drives these directly; DSH only calls `apply`. */
export const __testing = {
	API_PREFIX,
	START_METHOD,
	SidechatError,
	threadLabel,
	copySeedEvent,
	buildThreadSeed,
	parentSelection,
	presetOf,
	startSideChat,
	handleSideChatRequest
};

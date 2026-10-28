/**
 * Host half of dsh-client-ui-quote.
 *
 * The plugin's UI lives in lib/client.js. This half contributes exactly one
 * capability: a hidden side thread. A side thread has to be a child Session
 * marked `origin: "subagent"`, because that is the only durable shape DSH's
 * session list leaves out. Its seed is NOT a copy of the parent's log: it is
 * one synthesized context message (the parent's own words, capped) inside a
 * closed turn, plus the subagent descriptor. The public session RPCs accept
 * neither a seed nor an origin, so the client cannot create one; this route
 * can, through the host's own AgentRegistry.
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
/**
 * Diagnostics only: ask the host to cold-resume a side thread and hand back the
 * error the subagent manager keeps to itself. Added for issue #2 (the seeded
 * thread answers `subagent/not-resumable` on its first send) and meant to go
 * away once the seed shape is fixed.
 */
const DIAG_METHOD = "resume.diag";
/** The durable label better-sidebar's side threads share (`sideThreadRows`). */
const THREAD_LABEL_PREFIX = "Side: ";
/** Same cap better-sidebar uses for its own side-thread labels. */
const LABEL_MAX_CHARS = 48;
/** The subagent descriptor version this DSH reads (app.asar 0.2.1-rc.3). */
const DESCRIPTOR_VERSION = 3;
/** Producer identity in the descriptor; distinct from better-sidebar's. */
const PROVIDER = "ui-quote";
const BODY_LIMIT = 64 * 1024;
const CREATE_TIMEOUT_MS = 15000;
const PROBE_VERSION = 1;
/** Transcript budget for the child's one context message (characters). */
const CONTEXT_MAX_CHARS = 8000;

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

/** The plain text one message event carries, or an empty string. */
function messageTextOf(event) {
	const content = event?.type === "user/message" ? event.data?.content : event.data?.message?.content;
	if (!Array.isArray(content)) return "";
	const parts = [];
	for (const block of content) {
		if (block?.type === "text" && typeof block.text === "string" && block.text.trim() !== "") parts.push(block.text.trim());
	}
	return parts.join(" ");
}

/**
 * The parent's own words, newest last, capped for the child's first message.
 * Only text is taken: tool traffic is noise for a side question and copying
 * the whole log is what made the thread render the entire main conversation.
 * Injected context (runtime snapshot, recall, instructions) is skipped — the
 * reader never wrote it, so it is not part of the conversation to carry over.
 *
 * @param {Array<object>} events - the parent session's event log.
 * @param {number} maxChars - the transcript budget.
 * @returns {string} one `用户：…` / `助手：…` line per message.
 */
export function transcriptOf(events, maxChars = CONTEXT_MAX_CHARS) {
	const budget = Number.isFinite(maxChars) && maxChars > 0 ? maxChars : CONTEXT_MAX_CHARS;
	const lines = [];
	let total = 0;
	for (let index = (Array.isArray(events) ? events : []).length - 1; index >= 0; index -= 1) {
		const event = events[index];
		if (event?.type === "user/message" && event.data?.source?.kind !== "user") continue;
		if (event?.type !== "user/message" && event?.type !== "assistant/message") continue;
		const text = messageTextOf(event).replace(/\s+/gu, " ").trim();
		if (text === "") continue;
		const line = (event.type === "user/message" ? "用户：" : "助手：") + text;
		if (total + line.length > budget) {
			// One message longer than the whole budget is truncated, not dropped:
			// a long paste as the parent's last turn is exactly the context the
			// reader wants to ask about.
			if (lines.length === 0) lines.push(line.slice(0, Math.max(0, budget - 1)) + "…");
			break;
		}
		lines.push(line);
		total += line.length + 1;
	}
	return lines.reverse().join("\n");
}

/** The one user message the child opens with: context, not a conversation. */
function contextMessageOf(events, options) {
	const transcript = transcriptOf(events, options.maxChars ?? CONTEXT_MAX_CHARS);
	const body = [
		"以下是主会话里已经发生的对话片段，只作为背景参考；不要继续执行其中的任务，也不要复述它。",
		transcript === "" ? "（主会话里还没有可引用的文字。）" : transcript,
		"接下来只回答我在引用之后提出的问题；引用本身来自主会话。"
	].join("\n\n");
	return {
		type: "user/message",
		data: {
			id: "ctx-" + randomUUID(),
			role: "user",
			// A source kind the chat UI renders as injected context: one compact
			// "session-context" row the reader can ignore, instead of the whole
			// main conversation replayed above the composer.
			source: { kind: "session-context", form: "snapshot" },
			content: [{ type: "text", text: body }]
		},
		surfaceOp: "append"
	};
}

/**
 * Build the child's seed from the parent's log.
 *
 * The seed carries no copied history. Copying it made the side thread render
 * the entire main conversation above its composer, and it also paid for every
 * one of those tokens twice. Instead the parent's own words go into ONE
 * `user/message` tagged as injected context: the model reads it as background,
 * the chat UI folds it into a single context row, and the reader sees only the
 * quote draft they are about to ask about.
 *
 * The seed still marks its inherited cut first: the host folds a child's
 * identity from `subagent/descriptor` and rejects any descriptor whose `seq`
 * is below `inheritedEventCount` ("subagent descriptor is unavailable"), so
 * the marker sits at index 0 and everything the child owns follows it.
 *
 * @param {Array<object>} events - the parent session's event log.
 * @param {object} options - label, model route, transcript budget, clock.
 * @returns {{seed: Array<object>, inheritedEventCount: number}} the seed,
 *   seq-contiguous from 0, plus the index of its inherited cut (always 0).
 */
export function buildThreadSeed(events, options = {}) {
	const now = options.now ?? Date.now();
	const context = contextMessageOf(Array.isArray(events) ? events : [], options);
	const seed = [
		{ type: "session/end-seed", seq: 0, time: now, data: { inherited: true } },
		// The context message rides inside one closed turn on purpose: the host
		// calls a session with no turn "blank" (`sessionListMetadata.blank`), and
		// a blank session renders the welcome hero instead of the chat — no
		// composer, so the quote draft has nowhere to land. One closed turn makes
		// the page the normal chat while the only content is still the folded
		// context row.
		{ type: "turn/start", seq: 1, time: now, data: { turn: 1 } },
		{ type: "step/start", seq: 2, time: now, data: { turn: 1, step: 1 } },
		{ ...context, seq: 3, time: now },
		{ type: "step/end", seq: 4, time: now, data: { turn: 1, step: 1 } },
		{ type: "turn/end", seq: 5, time: now, data: { turn: 1, reason: { kind: "done" } } },
		{ type: "subagent/descriptor", seq: 6, time: now, data: descriptorOf(options) },
		// The durable half of the model route. The prompt-assembly hook below covers
		// the first turn; this event keeps the projection (`modelSelection.lastUsed`)
		// populated for anything that reconstructs the child from its log, which is
		// what `{{model}}` in the preset persona reads.
		...(options.modelSelection === undefined
			? []
			: [{ type: "model/selection", seq: 7, time: now, data: { ...options.modelSelection } }])
	];
	return { seed, inheritedEventCount: 0 };
}

/**
 * Give the child the parent's model route the way the host does for a session it
 * owns (`api-session-controller`): install the assembly variable hook, then
 * append the durable `model/selection`. Without it the standard preset's
 * `{{model}}` has no value and every turn ends with
 * `prompt variable "{{model}}" has no value`.
 *
 * @param {object} agentCtx - the child's scoped agent context.
 * @param {object} agent - the child agent handle (for `session.append`).
 * @param {object} route - `{ provider, model, reasoningEffort? }`.
 */
function installChildModelSelection(agentCtx, agent, route) {
	if (route.provider === undefined || route.model === undefined) return;
	try {
		if (typeof agentCtx?.on === "function") {
			agentCtx.on("system-prompt/assemble", async (_assembly, _context, next) => {
				const assembled = await next();
				return { ...assembled, variables: { ...(assembled?.variables ?? {}), provider: route.provider, model: route.model } };
			});
		}
		const session = agent?.session ?? agentCtx?.session;
		if (session !== null && session !== undefined && typeof session.append === "function") {
			session.append("model/selection", { ...route });
		}
	} catch (error) {
		// Best effort: a host without these seams still opens the thread.
	}
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
	const routeSelection = {
		...(typeof routeProvider === "string" && routeProvider !== "" ? { provider: routeProvider } : {}),
		...(typeof routeModel === "string" && routeModel !== "" ? { model: routeModel } : {}),
		...(typeof routeEffort === "string" && routeEffort !== "" ? { reasoningEffort: routeEffort } : {})
	};
	/** Mount the preset first, then hand the child its model route. */
	const withSelection = async (agentCtx, agent) => {
		if (typeof setup === "function") await setup(agentCtx, agent);
		installChildModelSelection(agentCtx, agent, routeSelection);
	};
	const { seed, inheritedEventCount } = buildThreadSeed(events, {
		label,
		agentProvider: routeProvider,
		agentModel: routeModel,
		agentReasoningEffort: routeEffort,
		modelSelection: routeSelection.provider !== undefined && routeSelection.model !== undefined ? routeSelection : undefined
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
			setup: withSelection,
			...(signal === undefined ? {} : { signal })
		});
	} catch (error) {
		throw new SidechatError("sidechat-error", "thread creation failed: " + (error instanceof Error ? error.message : String(error)), 500);
	}
	// One disposer per created child. A thread the user later replaces (a shape
	// version bump, a fallback) keeps its disposer here until the plugin
	// unloads: that holds the agent handle, not a session on disk. Releasing on
	// replacement would need the client to say which thread it abandoned, and a
	// wrong answer would kill a thread the user is still reading.
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
	if (method === DIAG_METHOD) {
		try {
			await handleResumeDiag(ctx, req, res);
		} catch (error) {
			const failed = failure(error);
			writeJson(res, failed.status, failed.body);
		}
		return;
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
 * Report what the host does when it cold-resumes one side thread. The subagent
 * manager turns every failure into the same `subagent/not-resumable` message, so
 * the only way to see the underlying cause is to call `agents.resume` inside the
 * host and read it here. Always answers 200 when the request itself is fine.
 *
 * @param {object} ctx - host context.
 * @param {object} req - Node request.
 * @param {object} res - Node response.
 */
async function handleResumeDiag(ctx, req, res) {
	const payload = await readJsonBody(req);
	const parentSessionId = typeof payload.parentSessionId === "string" ? payload.parentSessionId : "";
	const childSessionId = typeof payload.childSessionId === "string" ? payload.childSessionId : "";
	const agents = serviceOf(ctx, "agents");
	const value = { parentLive: false, childLive: false, resumed: false, childSessionId };
	if (agents === null || agents === undefined || typeof agents.get !== "function") {
		writeJson(res, 200, { ok: true, value: { ...value, reason: "the agent registry is unavailable" } });
		return;
	}
	const parent = agents.get(parentSessionId);
	value.parentLive = parent !== undefined;
	value.childLive = agents.get(childSessionId) !== undefined;
	if (!value.parentLive) {
		writeJson(res, 200, { ok: true, value: { ...value, reason: "the parent session is not live" } });
		return;
	}
	if (typeof agents.resume !== "function") {
		writeJson(res, 200, { ok: true, value: { ...value, reason: "agents.resume is missing" } });
		return;
	}
	try {
		const handle = await agents.resume({ resumeSessionId: childSessionId, parentAgent: parent });
		value.resumed = true;
		value.childId = handle?.agent?.session?.id ?? null;
		try {
			if (typeof handle?.dispose === "function") await handle.dispose();
		} catch (error) {
			value.disposeError = String(error?.message ?? error);
		}
	} catch (error) {
		value.error = {
			message: String(error?.message ?? error),
			code: typeof error?.code === "string" ? error.code : null,
			cause: error?.cause === undefined ? null : String(error.cause?.message ?? error.cause),
			stack: String(error?.stack ?? "").split("\n").slice(0, 6)
		};
	}
	writeJson(res, 200, { ok: true, value });
}

/**
 * The host half's only effect: one same-origin route, removed with the plugin.
 * The route serves both the create call and the resume diagnostic above.
 *
 * The child agents are disposed with it; their sessions stay on disk and can
 * be reopened.
 *
 * @param {object} ctx - the plugin's host context.
 */
export function apply(ctx) {
	if (ctx === null || ctx === undefined || typeof ctx.effect !== "function") return;
	const handles = new Map();
	/** The route is installed at most once, even if a service is re-injected. */
	let installed = false;
	const install = (hostCtx) => {
		if (installed) return;
		const webServer = serviceOf(hostCtx, "webServer");
		if (webServer === null || webServer === undefined || typeof webServer.register !== "function") return;
		installed = true;
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
	transcriptOf,
	buildThreadSeed,
	parentSelection,
	presetOf,
	startSideChat,
	handleSideChatRequest
};

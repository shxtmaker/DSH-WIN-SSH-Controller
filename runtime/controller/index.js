import { dirname, isAbsolute, join, resolve } from "node:path";
import z from "@deepseek-ai/schemastery";
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { createServer, request } from "node:http";
import WebSocket from "ws";
import { connect, createConnection, createServer as createServer$1 } from "node:net";
import { spawn } from "node:child_process";
import { glob, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
//#region lib/types/errors.js
/**
* One error vocabulary for every layer of the remote connection.
*
* The management page decides what to offer from these codes and stages, never from a
* localized sentence. Codes are fixed, carry no address, credential or command text, and are
* also the value the proxy puts in the `X-DSH-Remote-Error` response header.
*/
const FACTS = {
	SSH_UNAVAILABLE: {
		stage: "ssh",
		retryable: true,
		authentication: false
	},
	SSH_AUTH_FAILED: {
		stage: "ssh",
		retryable: false,
		authentication: false
	},
	HOST_KEY_REJECTED: {
		stage: "ssh",
		retryable: false,
		authentication: false
	},
	SSH_TIMEOUT: {
		stage: "ssh",
		retryable: true,
		authentication: false
	},
	HELPER_NOT_FOUND: {
		stage: "helper",
		retryable: false,
		authentication: false
	},
	HELPER_UNSAFE: {
		stage: "helper",
		retryable: false,
		authentication: false
	},
	HELPER_BAD_CONFIG: {
		stage: "helper",
		retryable: false,
		authentication: false
	},
	CONTROL_UNSUPPORTED: {
		stage: "helper",
		retryable: false,
		authentication: false
	},
	SERVICE_UNREGISTERED: {
		stage: "service",
		retryable: false,
		authentication: false
	},
	SERVICE_STOPPED: {
		stage: "service",
		retryable: true,
		authentication: false
	},
	SERVICE_FAILED: {
		stage: "service",
		retryable: false,
		authentication: false
	},
	USER_MANAGER_UNAVAILABLE: {
		stage: "service",
		retryable: false,
		authentication: false
	},
	DESCRIPTOR_MISSING: {
		stage: "descriptor",
		retryable: true,
		authentication: false
	},
	DESCRIPTOR_INVALID: {
		stage: "descriptor",
		retryable: false,
		authentication: false
	},
	DESCRIPTOR_STALE: {
		stage: "descriptor",
		retryable: true,
		authentication: false
	},
	UNSUPPORTED_WEB_TRANSPORT: {
		stage: "descriptor",
		retryable: false,
		authentication: false
	},
	LOCAL_AUTH_REQUIRED: {
		stage: "auth",
		retryable: true,
		authentication: true
	},
	UPSTREAM_AUTH_REQUIRED: {
		stage: "auth",
		retryable: true,
		authentication: true
	},
	IDENTITY_MISMATCH: {
		stage: "auth",
		retryable: false,
		authentication: true
	},
	APPLICATION_NOT_READY: {
		stage: "application",
		retryable: true,
		authentication: false
	},
	UPSTREAM_UNREACHABLE: {
		stage: "application",
		retryable: true,
		authentication: false
	},
	REGISTRATION_STALE: {
		stage: "service",
		retryable: false,
		authentication: false
	},
	OPERATION_CONFLICT: {
		stage: "service",
		retryable: false,
		authentication: false
	},
	OPERATION_EXPIRED: {
		stage: "service",
		retryable: false,
		authentication: false
	},
	OUTCOME_UNKNOWN: {
		stage: "service",
		retryable: false,
		authentication: false
	},
	BAD_INPUT: {
		stage: "helper",
		retryable: false,
		authentication: false
	},
	CONFIG_REQUIRED: {
		stage: "helper",
		retryable: false,
		authentication: false
	},
	UNSAFE_PATH: {
		stage: "helper",
		retryable: false,
		authentication: false
	},
	UNSAFE_FILE: {
		stage: "helper",
		retryable: false,
		authentication: false
	},
	LINUX_REQUIRED: {
		stage: "helper",
		retryable: false,
		authentication: false
	},
	CONTROL_FAILED: {
		stage: "service",
		retryable: false,
		authentication: false
	},
	FORBIDDEN: {
		stage: "local",
		retryable: false,
		authentication: false
	},
	NOT_FOUND: {
		stage: "local",
		retryable: false,
		authentication: false
	},
	PROXY_PAUSED: {
		stage: "local",
		retryable: true,
		authentication: false
	}
};
const CODES = new Set(Object.keys(FACTS));
/** @returns whether an untrusted string is one of the fixed contract codes. */
function isRemoteErrorCode(value) {
	return CODES.has(value);
}
/** @returns the layer facts for a fixed code. */
function errorFacts(code) {
	return FACTS[code];
}
/**
* Redact a diagnostic string before it can reach a log, a snapshot or the management page.
* Remote paths, credentials in URLs and anything that looks like a token are removed.
*/
function redact(value) {
	return value.replace(/(?:[A-Za-z0-9._-]*(?:token|secret|password|passwd|cookie|key)[A-Za-z0-9._-]*)\s*[=:]\s*\S+/giu, "$1=<redacted>").replace(/\/\/([^@/\s]+)@/gu, "//<redacted>@").replace(/\s+/gu, " ").trim().slice(0, 300);
}
/** Local authorization is missing or does not match the live proxy instance. */
const LOCAL_AUTH_REQUIRED = "LOCAL_AUTH_REQUIRED";
/** Raised when the remote instance is not the one this target pinned. */
var IdentityMismatch = class extends Error {};
/** Raised when the remote Harness itself rejected our remote session Cookie (a real 401). */
var UpstreamAuthRequired = class extends Error {};
/** Raised when the remote service is not listening yet; this is not an authentication failure. */
var ServiceStopped = class extends Error {};
/** Raised when the upstream is reachable but not answering usefully. */
var UpstreamUnreachable = class extends Error {};
//#endregion
//#region lib/types/auth.js
/** Authenticate the one approved remote authority and verify its live identity. */
async function read(port, authority, path, cookie) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		let size = 0;
		const req = request({
			host: "127.0.0.1",
			port,
			method: "GET",
			path,
			headers: {
				host: authority,
				...cookie === void 0 ? {} : { cookie },
				accept: "application/json"
			},
			timeout: 1e4
		}, (res) => {
			res.on("data", (chunk) => {
				size += chunk.length;
				if (size > 65536) req.destroy(/* @__PURE__ */ new Error("remote-workspace: response too large"));
				else chunks.push(chunk);
			});
			res.once("end", () => {
				resolve({
					status: res.statusCode ?? 0,
					headers: res.headers,
					body: Buffer.concat(chunks)
				});
			});
			res.once("error", reject);
		});
		req.once("timeout", () => req.destroy(/* @__PURE__ */ new Error("remote-workspace: authentication timeout")));
		req.once("error", reject);
		req.end();
	});
}
/** Accept only the configured loopback Harness launch URL and extract its transient token. */
function launchToken(value, remotePort) {
	let url;
	try {
		url = new URL(value);
	} catch {
		throw new Error("remote-workspace: invalid launch URL");
	}
	if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || url.port !== String(remotePort) || url.pathname !== "/" || url.hash !== "" || url.username !== "" || url.password !== "" || [...url.searchParams.keys()].join(",") !== "token") throw new Error("remote-workspace: unexpected launch URL");
	const token = url.searchParams.get("token");
	if (token === null || token.length < 16 || token.length > 4096) throw new Error("remote-workspace: invalid launch token");
	return token;
}
/** Exchange a launch token for a Host-only browser Cookie, without redirects. */
async function authenticate(port, remotePort, descriptor) {
	const token = launchToken(descriptor.launchUrl, remotePort);
	const reply = await read(port, `127.0.0.1:${String(remotePort)}`, `/?token=${encodeURIComponent(token)}`);
	if (reply.status === 401 || reply.status === 403) throw new UpstreamAuthRequired("remote-workspace: remote authentication rejected");
	if (reply.status !== 303 || reply.headers.location !== "./") throw new UpstreamUnreachable("remote-workspace: remote authentication unavailable");
	const setCookie = reply.headers["set-cookie"];
	if (setCookie?.length !== 1) throw new Error("remote-workspace: remote session Cookie missing");
	const cookie = setCookie[0]?.split(";", 1)[0];
	if (cookie === void 0 || !/^[!#$%&'*+.^_`|~A-Za-z0-9-]+=[!#$%&'*+.^_`|~A-Za-z0-9-]+$/u.test(cookie)) throw new Error("remote-workspace: invalid remote session Cookie");
	return cookie;
}
function identity(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("remote-workspace: invalid identity");
	const row = value;
	if (row.protocolVersion !== 1 || typeof row.instanceId !== "string" || typeof row.bootId !== "string" || typeof row.instanceKey !== "string" || typeof row.profile !== "string" || typeof row.workspaceHint !== "string" || typeof row.version !== "string" || !Array.isArray(row.capabilities) || !row.capabilities.every((item) => typeof item === "string")) throw new Error("remote-workspace: invalid identity");
	return row;
}
/** Read Companion identity through Harness's authenticated /api transport. */
async function readIdentity(port, remotePort, cookie) {
	const reply = await read(port, `127.0.0.1:${String(remotePort)}`, "/api/remote-workspace/identity", cookie);
	if (reply.status === 401 || reply.status === 403) throw new UpstreamAuthRequired("remote-workspace: remote session Cookie rejected");
	if (reply.status !== 200) throw new UpstreamUnreachable("remote-workspace: authenticated identity unavailable");
	return identity(JSON.parse(reply.body.toString("utf8")));
}
/** Open the actual Typert event stream and wait for its first ready frame. */
async function probeEventStream(port, remotePort, cookie) {
	const authority = `127.0.0.1:${String(remotePort)}`;
	return new Promise((resolve, reject) => {
		const socket = new WebSocket(`ws://127.0.0.1:${String(port)}/api/remote.mux`, {
			headers: {
				host: authority,
				cookie,
				origin: `http://${authority}`
			},
			handshakeTimeout: 1e4
		});
		let done = false;
		const finish = (error) => {
			if (done) return;
			done = true;
			clearTimeout(timer);
			socket.close();
			if (error === void 0) resolve();
			else reject(error);
		};
		const timer = setTimeout(() => {
			finish(/* @__PURE__ */ new Error("remote-workspace: event stream not ready"));
		}, 1e4);
		socket.once("open", () => {
			socket.send(JSON.stringify({
				type: "open",
				streamId: "remote-workspace-readiness",
				endpoint: "$events",
				payload: { args: {} }
			}));
		});
		socket.on("message", (data) => {
			let frame;
			const bytes = Buffer.isBuffer(data) ? data : Array.isArray(data) ? Buffer.concat(data) : Buffer.from(data);
			try {
				frame = JSON.parse(bytes.toString("utf8"));
			} catch {
				finish(/* @__PURE__ */ new Error("remote-workspace: invalid event frame"));
				return;
			}
			if (typeof frame !== "object" || frame === null || !("type" in frame) || !("streamId" in frame)) return;
			if (frame.type === "error") {
				finish(/* @__PURE__ */ new Error("remote-workspace: event stream rejected"));
				return;
			}
			if (frame.type === "item" && frame.streamId === "remote-workspace-readiness" && "value" in frame && typeof frame.value === "object" && frame.value !== null && "type" in frame.value && frame.value.type === "ready") finish();
		});
		socket.once("error", () => {
			finish(/* @__PURE__ */ new Error("remote-workspace: event stream unavailable"));
		});
		socket.once("close", () => {
			finish(/* @__PURE__ */ new Error("remote-workspace: event stream closed before ready"));
		});
	});
}
//#endregion
//#region lib/types/proxy.js
/** One-connection loopback reverse proxy with a single-use page ticket. */
const BOOTSTRAP = "<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"referrer\" content=\"no-referrer\"></head><body><p>正在打开远程工作区…</p><script src=\"/__remote/open.js\"><\/script></body></html>";
const BOOTSTRAP_JS = `(() => {
  const ticket = location.hash.slice(1)
  history.replaceState(null, '', '/__remote/open')
  fetch('/__remote/exchange', { method: 'POST', credentials: 'same-origin',
    headers: { 'x-remote-ticket': ticket } })
    .then(response => { if (!response.ok) throw new Error('ticket'); location.replace('/') })
    .catch(() => { document.body.textContent = '打开票据已失效，请回到连接管理页重新打开。' })
})()
`;
/**
* Static page for an HTML navigation that arrives without a local session Cookie.
* It carries no credential, no ticket, and no fixed control port: it only tells the
* operator to reopen the workspace from the Controller, which mints a fresh ticket.
* The response keeps its 401 status.
*/
const RECOVERY = "<!doctype html><html lang=\"zh\"><head><meta charset=\"utf-8\"><meta name=\"referrer\" content=\"no-referrer\"><title>远程工作区需要重新打开</title></head><body><h1>此页面已不再持有本地授权</h1><p>远程工作区通过一次性票据换取仅在当前代理实例内有效的本地会话。当前请求没有可用的本地会话 Cookie，因此被拒绝。</p><p>请回到 Controller 的连接管理页，对同一目标选择“重新打开”。重新打开不会中断 SSH 连接，也不会重放此前的业务请求。</p><p>如果重新打开后仍然出现本页，请检查远端 Harness 服务与 SSH 转发是否正常。</p></body></html>";
const HOP_HEADERS = new Set([
	"connection",
	"keep-alive",
	"proxy-authenticate",
	"proxy-authorization",
	"te",
	"trailer",
	"transfer-encoding",
	"upgrade"
]);
const REQUEST_DROP = new Set([
	"host",
	"cookie",
	"authorization",
	"origin",
	"referer",
	"forwarded",
	"x-forwarded-for",
	"x-forwarded-host",
	"x-forwarded-proto",
	"sec-fetch-site",
	"x-dsh-remote-error"
]);
const RESPONSE_DROP = new Set([
	"set-cookie",
	"set-cookie2",
	"x-dsh-remote-error"
]);
/** Fixed diagnostic header the proxy adds only to errors it generated itself. */
const ERROR_HEADER = "x-dsh-remote-error";
function token() {
	return randomBytes(32).toString("base64url");
}
function sameSecret(first, second) {
	const a = Buffer.from(first), b = Buffer.from(second);
	return a.length === b.length && timingSafeEqual(a, b);
}
/** Live proxy-owned HTTP server, session Cookie, tickets, and sockets. */
var AuthProxy = class {
	upstreamPort;
	remotePort;
	upstreamCookie;
	onError;
	server;
	sockets = /* @__PURE__ */ new Set();
	ticketValues = /* @__PURE__ */ new Map();
	cookieName = `rw_${randomBytes(12).toString("hex")}`;
	cookieValue = token();
	portValue = 0;
	closed = false;
	paused = false;
	/** Codes already reported for this instance, so one scan cannot produce endless notices. */
	reported = /* @__PURE__ */ new Set();
	/**
	* @param upstreamPort - this plugin's SSH local-forward port.
	* @param remotePort - approved Harness authority port.
	* @param upstreamCookie - Host-only remote session Cookie.
	* @param onError - bounded notification for errors this proxy generated itself. Each fixed
	*   code is reported at most once per instance, so an unauthenticated loopback scan cannot
	*   produce an unbounded stream of events and cannot affect other authenticated pages.
	*/
	constructor(upstreamPort, remotePort, upstreamCookie, onError) {
		this.upstreamPort = upstreamPort;
		this.remotePort = remotePort;
		this.upstreamCookie = upstreamCookie;
		this.onError = onError;
		this.server = createServer((req, res) => {
			this.handle(req, res);
		});
		this.server.on("upgrade", (req, socket, head) => {
			this.upgrade(req, socket, head);
		});
		this.server.on("connection", (socket) => {
			this.sockets.add(socket);
			socket.once("close", () => {
				this.sockets.delete(socket);
			});
		});
	}
	/** @returns the bound local origin after start. */
	get origin() {
		return `http://127.0.0.1:${String(this.portValue)}`;
	}
	/** Bind only loopback on an OS-assigned port. */
	async start() {
		if (this.closed || this.portValue !== 0) throw new Error("remote-workspace: proxy already started");
		await new Promise((resolve, reject) => {
			this.server.once("error", reject);
			this.server.listen(0, "127.0.0.1", () => {
				this.server.off("error", reject);
				this.portValue = this.server.address().port;
				resolve();
			});
		});
	}
	/** @returns a 30-second, one-use fragment URL; the remote token is absent. */
	openTicket() {
		if (this.closed || this.paused || this.portValue === 0) throw new Error("remote-workspace: proxy unavailable");
		for (const [value, expiry] of this.ticketValues) if (expiry < Date.now()) this.ticketValues.delete(value);
		if (this.ticketValues.size >= 16) throw new Error("remote-workspace: too many pending open tickets");
		const value = token();
		this.ticketValues.set(value, Date.now() + 3e4);
		return `${this.origin}/__remote/open#${value}`;
	}
	/** Keep the Browser origin while severing the old, unauthenticated transport. */
	pause() {
		if (this.closed) return;
		this.paused = true;
		this.ticketValues.clear();
		this.upstreamPort = 0;
		this.upstreamCookie = "";
		for (const socket of this.sockets) socket.destroy();
	}
	/** Resume only after SSH discovery, token exchange, identity, and event checks pass. */
	resume(upstreamPort, upstreamCookie) {
		if (this.closed || !this.paused || upstreamPort < 1 || upstreamCookie.length === 0) throw new Error("remote-workspace: proxy cannot resume");
		this.upstreamPort = upstreamPort;
		this.upstreamCookie = upstreamCookie;
		this.paused = false;
	}
	/** Revoke sessions, tickets, and every owned transport without touching SSH or Harness. */
	async stop() {
		if (this.closed) return;
		this.closed = true;
		this.ticketValues.clear();
		const done = new Promise((resolve) => {
			this.server.close(() => {
				resolve();
			});
		});
		for (const socket of this.sockets) socket.destroy();
		await done;
	}
	trusted(req, requireOrigin = false) {
		if (this.closed || req.headers.host !== new URL(this.origin).host || req.headers["sec-fetch-site"] === "cross-site") return false;
		const origin = req.headers.origin;
		if (requireOrigin && origin !== this.origin) return false;
		return origin === void 0 || origin === this.origin;
	}
	authenticated(req) {
		const header = req.headers.cookie;
		if (header === void 0) return false;
		const matched = header.split(";").map((part) => part.trim()).filter((part) => part.startsWith(`${this.cookieName}=`));
		const entry = matched[0];
		return matched.length === 1 && entry !== void 0 && sameSecret(entry.slice(this.cookieName.length + 1), this.cookieValue);
	}
	/** @param code - fixed code to report once per proxy instance. */
	report(code) {
		if (this.reported.has(code)) return;
		this.reported.add(code);
		try {
			this.onError?.(code);
		} catch {}
	}
	reject(res, code, error) {
		const headers = {
			"cache-control": "no-store",
			"content-type": "text/plain; charset=utf-8"
		};
		if (error !== void 0) {
			headers[ERROR_HEADER] = error;
			this.report(error);
		}
		res.writeHead(code, headers);
		res.end("remote workspace access denied");
	}
	/**
	* Refuse a request that carries no usable local authorization.
	*
	* An HTML navigation gets the static recovery page, still under 401. Anything else keeps a
	* plain error: an API or write call must never be answered with a 200 or with login HTML.
	*/
	unauthorized(req, res) {
		if (!((req.method === "GET" || req.method === "HEAD") && (req.headers.accept ?? "").includes("text/html"))) {
			this.reject(res, 401, LOCAL_AUTH_REQUIRED);
			return;
		}
		this.report(LOCAL_AUTH_REQUIRED);
		res.writeHead(401, {
			"cache-control": "no-store",
			[ERROR_HEADER]: LOCAL_AUTH_REQUIRED,
			"content-security-policy": "default-src 'none'; style-src 'unsafe-inline'",
			"content-type": "text/html; charset=utf-8",
			"referrer-policy": "no-referrer"
		});
		res.end(RECOVERY);
	}
	handle(req, res) {
		if (!this.trusted(req) || req.url === void 0 || !req.url.startsWith("/") || req.url.startsWith("//") || req.method === "CONNECT") {
			this.reject(res, 403, "FORBIDDEN");
			return;
		}
		if (this.paused) {
			this.reject(res, 503, "PROXY_PAUSED");
			return;
		}
		if (req.method === "GET" && req.url === "/__remote/open") {
			res.writeHead(200, {
				"cache-control": "no-store",
				"content-security-policy": "default-src 'none'; script-src 'self'; connect-src 'self'",
				"content-type": "text/html; charset=utf-8",
				"referrer-policy": "no-referrer"
			});
			res.end(BOOTSTRAP);
			return;
		}
		if (req.method === "GET" && req.url === "/__remote/open.js") {
			res.writeHead(200, {
				"cache-control": "no-store",
				"content-type": "text/javascript; charset=utf-8"
			});
			res.end(BOOTSTRAP_JS);
			return;
		}
		if (req.method === "POST" && req.url === "/__remote/exchange") {
			if (!this.trusted(req, true) || req.headers["sec-fetch-site"] === "cross-site" || req.headers["content-length"] !== void 0 && req.headers["content-length"] !== "0") {
				this.reject(res, 403, "FORBIDDEN");
				return;
			}
			const value = req.headers["x-remote-ticket"];
			if (typeof value !== "string") {
				this.reject(res, 401, LOCAL_AUTH_REQUIRED);
				return;
			}
			const expiry = this.ticketValues.get(value);
			this.ticketValues.delete(value);
			if (expiry === void 0 || expiry < Date.now()) {
				this.reject(res, 401, LOCAL_AUTH_REQUIRED);
				return;
			}
			res.writeHead(204, {
				"cache-control": "no-store",
				"set-cookie": `${this.cookieName}=${this.cookieValue}; Path=/; HttpOnly; SameSite=Strict`
			});
			res.end();
			return;
		}
		if (req.url.startsWith("/__remote/")) {
			this.reject(res, 404, "NOT_FOUND");
			return;
		}
		if (!this.authenticated(req)) {
			this.unauthorized(req, res);
			return;
		}
		this.proxyHttp(req, res);
	}
	requestHeaders(req) {
		const headers = {};
		for (const [key, value] of Object.entries(req.headers)) if (value !== void 0 && !HOP_HEADERS.has(key) && !REQUEST_DROP.has(key) && !key.startsWith("proxy-") && !key.startsWith("x-forwarded-")) headers[key] = value;
		headers.host = `127.0.0.1:${String(this.remotePort)}`;
		headers.cookie = this.upstreamCookie;
		if (req.headers.origin !== void 0) headers.origin = `http://127.0.0.1:${String(this.remotePort)}`;
		if (req.headers["sec-fetch-site"] !== void 0) headers["sec-fetch-site"] = "same-origin";
		return headers;
	}
	proxyHttp(req, res) {
		const upstream = request({
			host: "127.0.0.1",
			port: this.upstreamPort,
			method: req.method,
			path: req.url,
			headers: this.requestHeaders(req),
			timeout: 6e4
		}, (incoming) => {
			const headers = {};
			for (const [key, value] of Object.entries(incoming.headers)) if (value !== void 0 && !HOP_HEADERS.has(key) && !RESPONSE_DROP.has(key)) headers[key] = value;
			const location = incoming.headers.location;
			Reflect.deleteProperty(headers, "location");
			if (location !== void 0) try {
				const remote = `http://127.0.0.1:${String(this.remotePort)}`;
				const url = new URL(location, remote);
				if (url.origin === remote) headers.location = `${url.pathname}${url.search}${url.hash}`;
			} catch {}
			res.writeHead(incoming.statusCode ?? 502, headers);
			incoming.pipe(res);
		});
		upstream.once("timeout", () => upstream.destroy(/* @__PURE__ */ new Error("remote-workspace: upstream timeout")));
		upstream.once("error", () => {
			if (!res.headersSent) this.reject(res, 502, "UPSTREAM_UNREACHABLE");
			else res.destroy();
		});
		req.once("aborted", () => upstream.destroy());
		res.once("close", () => upstream.destroy());
		req.pipe(upstream);
	}
	upgrade(req, socket, head) {
		const path = req.url;
		const missingAuth = !this.authenticated(req);
		if (this.paused || !this.trusted(req, true) || missingAuth || path !== "/api/remote.mux" || req.headers.upgrade?.toLowerCase() !== "websocket" || typeof req.headers["sec-websocket-key"] !== "string") {
			const code = missingAuth ? LOCAL_AUTH_REQUIRED : this.paused ? "PROXY_PAUSED" : "FORBIDDEN";
			this.report(code);
			socket.end(`HTTP/1.1 403 Forbidden\r\nConnection: close\r\n${ERROR_HEADER}: ${code}\r\n\r\n`);
			return;
		}
		const upstream = connect({
			host: "127.0.0.1",
			port: this.upstreamPort
		});
		const authority = `127.0.0.1:${String(this.remotePort)}`;
		upstream.once("connect", () => {
			const headers = this.requestHeaders(req);
			headers.origin = `http://${authority}`;
			headers.upgrade = "websocket";
			headers.connection = "Upgrade";
			const lines = [
				`GET ${path} HTTP/1.1`,
				...Object.entries(headers).map(([name, value]) => `${name}: ${Array.isArray(value) ? value.join(", ") : value}`),
				"",
				""
			];
			upstream.write(lines.join("\r\n"));
			if (head.length > 0) upstream.write(head);
			let response = Buffer.alloc(0);
			const handshake = (chunk) => {
				response = Buffer.concat([response, chunk]);
				if (response.length > 16384) {
					close();
					return;
				}
				const boundary = response.indexOf("\r\n\r\n");
				if (boundary < 0) return;
				upstream.off("data", handshake);
				const lines = response.subarray(0, boundary).toString("latin1").split("\r\n");
				if (!/^HTTP\/1\.[01] 101\b/u.test(lines[0] ?? "")) {
					close();
					return;
				}
				const safe = lines.filter((line) => !/^set-cookie2?:/iu.test(line));
				socket.write(safe.join("\r\n") + "\r\n\r\n");
				const remaining = response.subarray(boundary + 4);
				if (remaining.length > 0) socket.write(remaining);
				upstream.pipe(socket);
				socket.pipe(upstream);
			};
			upstream.on("data", handshake);
		});
		const close = () => {
			upstream.destroy();
			socket.destroy();
		};
		upstream.once("error", close);
		socket.once("error", close);
		upstream.once("close", () => socket.destroy());
		socket.once("close", () => upstream.destroy());
	}
};
//#endregion
//#region lib/types/ssh.js
/** Plugin-owned OpenSSH processes. Aliases and the fixed helper path are the only remote inputs. */
const SSH_OPTIONS = [
	"-T",
	"-o",
	"BatchMode=yes",
	"-o",
	"StrictHostKeyChecking=yes",
	"-o",
	"ForwardAgent=no",
	"-o",
	"ForwardX11=no",
	"-o",
	"PermitLocalCommand=no",
	"-o",
	"ControlMaster=no",
	"-o",
	"ControlPath=none",
	"-o",
	"ConnectTimeout=15",
	"-o",
	"ServerAliveInterval=10",
	"-o",
	"ServerAliveCountMax=3"
];
function validAlias(alias) {
	return /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/u.test(alias);
}
function validHelperPath(path) {
	return /^\/(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+$/u.test(path);
}
/**
* Run the fixed absolute helper over its own non-interactive SSH process.
*
* The caller supplies the already-validated alias, helper path and extra arguments; this
* function performs no allowlist decisions of its own beyond the argument count.
*
* @param alias - configured OpenSSH alias.
* @param helperPath - fixed executable, never derived from a request.
* @param args - literal helper arguments, only `--identity` or `--control`.
* @param request - one line of JSON written to the helper's stdin.
* @param signal - operation lifetime.
* @param timeoutMs - hard deadline for the whole invocation.
*/
async function runHelper(alias, helperPath, args, request, signal, timeoutMs = 2e4) {
	signal.throwIfAborted();
	if (!validAlias(alias) || !validHelperPath(helperPath)) throw new Error("remote-workspace: invalid SSH discovery configuration");
	const child = spawn("ssh", [
		...SSH_OPTIONS,
		alias,
		helperPath,
		...args
	], {
		shell: false,
		windowsHide: true,
		stdio: "pipe"
	});
	const stop = () => {
		child.kill();
	};
	signal.addEventListener("abort", stop, { once: true });
	let timedOut = false;
	const timeout = setTimeout(() => {
		timedOut = true;
		stop();
	}, timeoutMs);
	let stdout = "";
	let oversized = false;
	let stderr = "";
	child.stdout.setEncoding("utf8");
	child.stdout.on("data", (chunk) => {
		stdout += chunk;
		if (Buffer.byteLength(stdout, "utf8") > 65536) {
			oversized = true;
			child.kill();
		}
	});
	child.stderr.setEncoding("utf8");
	child.stderr.on("data", (chunk) => {
		stderr = (stderr + chunk).slice(-8192);
	});
	child.stdin.on("error", () => {});
	child.stdin.end(request);
	try {
		return {
			code: await childExit(child),
			stdout,
			stderr,
			timedOut,
			oversized
		};
	} finally {
		clearTimeout(timeout);
		signal.removeEventListener("abort", stop);
	}
}
function childExit(child) {
	return new Promise((resolve, reject) => {
		child.once("error", reject);
		child.once("close", (code) => {
			resolve(code);
		});
	});
}
function descriptor(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("remote-workspace: invalid helper response");
	const row = value;
	if (row.protocolVersion !== 1 || typeof row.instanceId !== "string" || row.instanceId.length < 1 || typeof row.bootId !== "string" || row.bootId.length < 1 || typeof row.instanceKey !== "string" || !/^[A-Za-z0-9_-]{1,64}$/u.test(row.instanceKey) || typeof row.profile !== "string" || row.profile.length < 1 || row.profile.length > 4096 || typeof row.workspaceHint !== "string" || row.workspaceHint.length > 4096 || typeof row.port !== "number" || !Number.isInteger(row.port) || row.port < 1 || row.port > 65535) throw new Error("remote-workspace: invalid helper response");
	return {
		protocolVersion: 1,
		instanceId: row.instanceId,
		bootId: row.bootId,
		instanceKey: row.instanceKey,
		profile: row.profile,
		workspaceHint: row.workspaceHint,
		port: row.port
	};
}
/** Run the fixed helper over a separate non-interactive SSH process. */
async function discover(alias, instanceKey, helperPath, signal) {
	const value = await helper(alias, instanceKey, helperPath, signal, false);
	const info = descriptor(value);
	if (typeof value !== "object" || value === null || !("launchUrl" in value) || typeof value.launchUrl !== "string") throw new Error("remote-workspace: invalid helper response");
	return {
		...info,
		launchUrl: value.launchUrl
	};
}
/** Read public instance facts over a host-key-verified SSH connection.
* @param alias - configured OpenSSH alias. @param instanceKey - Companion key.
* @param helperPath - fixed executable. @param signal - operation lifetime.
* @returns identity and port with no launch credential.
*/
async function discoverTarget(alias, instanceKey, helperPath, signal) {
	const info = descriptor(await helper(alias, instanceKey, helperPath, signal, true));
	return {
		protocolVersion: info.protocolVersion,
		instanceKey: info.instanceKey,
		instanceId: info.instanceId,
		bootId: info.bootId,
		profile: info.profile,
		workspaceHint: info.workspaceHint,
		port: info.port
	};
}
async function helper(alias, instanceKey, helperPath, signal, identityOnly) {
	signal.throwIfAborted();
	if (!validAlias(alias) || !/^[A-Za-z0-9_-]{1,64}$/u.test(instanceKey) || !validHelperPath(helperPath)) throw new Error("remote-workspace: invalid SSH discovery configuration");
	const child = spawn("ssh", [
		...SSH_OPTIONS,
		alias,
		helperPath,
		...identityOnly ? ["--identity"] : []
	], {
		shell: false,
		windowsHide: true,
		stdio: "pipe"
	});
	const stop = () => {
		child.kill();
	};
	signal.addEventListener("abort", stop, { once: true });
	let timedOut = false;
	const timeout = setTimeout(() => {
		timedOut = true;
		stop();
	}, 2e4);
	let stdout = "";
	let oversized = false;
	let stderr = "";
	child.stdout.setEncoding("utf8");
	child.stdout.on("data", (chunk) => {
		stdout += chunk;
		if (Buffer.byteLength(stdout, "utf8") > 65536) {
			oversized = true;
			child.kill();
		}
	});
	child.stderr.setEncoding("utf8");
	child.stderr.on("data", (chunk) => {
		stderr = (stderr + chunk).slice(-8192);
	});
	child.stdin.on("error", () => {});
	child.stdin.end(JSON.stringify({
		protocolVersion: 1,
		instanceKey
	}) + "\n");
	try {
		const code = await childExit(child);
		signal.throwIfAborted();
		if (timedOut) throw new Error("remote-workspace: SSH_UNREACHABLE");
		if (oversized || code !== 0) {
			if (code === 126 || code === 127) throw new Error("remote-workspace: SSH_HELPER");
			if (/Host key verification failed|REMOTE HOST IDENTIFICATION HAS CHANGED/u.test(stderr)) throw new Error("remote-workspace: SSH_HOST_KEY");
			if (/Permission denied/u.test(stderr)) throw new Error("remote-workspace: SSH_AUTH");
			if (/Could not resolve hostname/u.test(stderr)) throw new Error("remote-workspace: SSH_ALIAS");
			if (/Connection refused|Connection timed out|No route to host/u.test(stderr)) throw new Error("remote-workspace: SSH_UNREACHABLE");
			if (/not found|No such file|BAD_INPUT|INFO_FAILED|CONFIG_REQUIRED|UNSAFE_PATH|UNSAFE_FILE|BAD_DESCRIPTOR|LINUX_REQUIRED/u.test(stderr)) throw new Error("remote-workspace: SSH_HELPER");
			throw new Error("remote-workspace: SSH helper failed");
		}
		try {
			return JSON.parse(stdout);
		} catch {
			throw new Error("remote-workspace: invalid helper response");
		}
	} finally {
		clearTimeout(timeout);
		signal.removeEventListener("abort", stop);
	}
}
async function freePort() {
	const server = createServer$1();
	return new Promise((resolve, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			if (typeof address !== "object" || address === null) {
				server.close();
				reject(/* @__PURE__ */ new Error("remote-workspace: no local port"));
				return;
			}
			server.close((error) => {
				if (error === void 0) resolve(address.port);
				else reject(error);
			});
		});
	});
}
async function canConnect(port) {
	return new Promise((resolve) => {
		const socket = createConnection({
			host: "127.0.0.1",
			port
		});
		socket.once("connect", () => {
			socket.destroy();
			resolve(true);
		});
		socket.once("error", () => {
			socket.destroy();
			resolve(false);
		});
		socket.setTimeout(1e3, () => {
			socket.destroy();
			resolve(false);
		});
	});
}
/** Create the sole local forward to a known remote loopback port. */
async function forward(alias, remotePort, signal) {
	if (!validAlias(alias) || !Number.isInteger(remotePort) || remotePort < 1 || remotePort > 65535) throw new Error("remote-workspace: invalid forward configuration");
	for (let attempt = 0; attempt < 3; attempt++) {
		signal.throwIfAborted();
		const port = await freePort();
		const child = spawn("ssh", [
			...SSH_OPTIONS,
			"-o",
			"ExitOnForwardFailure=yes",
			"-N",
			"-L",
			`127.0.0.1:${String(port)}:127.0.0.1:${String(remotePort)}`,
			alias
		], {
			shell: false,
			windowsHide: true,
			stdio: "pipe"
		});
		child.stdout.resume();
		child.stderr.resume();
		child.stdin.end();
		const exited = childExit(child);
		let stopped = false;
		const stop = async () => {
			if (stopped) return;
			stopped = true;
			child.kill();
			await exited.catch(() => void 0);
		};
		const abort = () => {
			stop();
		};
		signal.addEventListener("abort", abort, { once: true });
		let ready = false;
		try {
			for (let poll = 0; poll < 30; poll++) {
				signal.throwIfAborted();
				if (await canConnect(port)) {
					ready = true;
					break;
				}
				if (child.exitCode !== null) break;
				await new Promise((resolve) => setTimeout(resolve, 100));
			}
			if (ready) return {
				port,
				exited,
				stop: async () => {
					signal.removeEventListener("abort", abort);
					await stop();
				}
			};
		} finally {
			if (!ready) {
				signal.removeEventListener("abort", abort);
				await stop();
			}
		}
	}
	throw new Error("remote-workspace: SSH forward unavailable");
}
const CONTROL_ACTIONS = [
	"capabilities",
	"status",
	"start",
	"stop",
	"restart",
	"operationStatus"
];
const CONTROL_WRITE_ACTIONS = [
	"start",
	"stop",
	"restart"
];
function failure(code, message) {
	const facts = errorFacts(code);
	return {
		code,
		message: redact(message),
		stage: facts.stage,
		retryable: facts.retryable
	};
}
function object(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
}
function boundedString(value, max) {
	return typeof value === "string" && value.length > 0 && value.length <= max ? value : void 0;
}
const INSTANCE_KEY = /^[A-Za-z0-9_-]{1,64}$/u;
const OPERATION_ID = /^[A-Za-z0-9_-]{8,64}$/u;
const REVISION = /^[A-Za-z0-9_-]{1,64}$/u;
const INSTANCE_ID = /^[A-Za-z0-9_-]{1,128}$/u;
function validOperationId(value) {
	return OPERATION_ID.test(value);
}
function validInstanceKey(value) {
	return INSTANCE_KEY.test(value);
}
function validRegistrationRevision(value) {
	return REVISION.test(value);
}
function validExpectedInstanceId(value) {
	return INSTANCE_ID.test(value);
}
function serviceState(value) {
	const row = object(value);
	if (row === void 0) return void 0;
	const unit = boundedString(row.unit, 256);
	const loadState = boundedString(row.loadState, 64);
	const activeState = boundedString(row.activeState, 64);
	const subState = boundedString(row.subState, 64);
	const state = boundedString(row.state, 32);
	if (unit === void 0 || loadState === void 0 || activeState === void 0 || subState === void 0 || state === void 0) return void 0;
	if (![
		"unknown",
		"inactive",
		"activating",
		"active",
		"deactivating",
		"failed"
	].includes(state)) return void 0;
	return {
		unit,
		loadState,
		activeState,
		subState,
		state,
		...typeof row.reason === "string" ? { reason: redact(row.reason) } : {}
	};
}
function descriptorState(value) {
	const row = object(value);
	if (row === void 0 || typeof row.present !== "boolean" || typeof row.parsable !== "boolean") return void 0;
	const bootId = typeof row.bootId === "string" ? boundedString(row.bootId, 256) : void 0;
	const instanceId = typeof row.instanceId === "string" ? boundedString(row.instanceId, 128) : void 0;
	return {
		present: row.present,
		parsable: row.parsable,
		...bootId !== void 0 ? { bootId } : {},
		...instanceId !== void 0 ? { instanceId } : {}
	};
}
function listenerState(value) {
	const row = object(value);
	if (row === void 0) return void 0;
	const host = boundedString(row.host, 128);
	const protocol = boundedString(row.protocol, 16);
	if (host === void 0 || protocol === void 0 || !Number.isInteger(row.port) || row.port < 1 || row.port > 65535 || typeof row.supported !== "boolean") return void 0;
	return {
		host,
		port: row.port,
		protocol,
		supported: row.supported
	};
}
/** @returns a validated capability payload, or undefined when the shape is not trusted. */
function parseCapabilities(value) {
	const row = object(value);
	if (row === void 0) return void 0;
	const helperVersion = boundedString(row.helperVersion, 64);
	const mode = boundedString(row.mode, 32);
	if (helperVersion === void 0 || mode === void 0 || ![
		"systemd-user",
		"unsupported",
		"unregistered"
	].includes(mode)) return void 0;
	if (!Array.isArray(row.discoveryVersions) || !row.discoveryVersions.every((entry) => Number.isInteger(entry))) return void 0;
	if (!Array.isArray(row.actions)) return void 0;
	const actions = row.actions.filter((entry) => typeof entry === "string" && CONTROL_ACTIONS.includes(entry));
	if (actions.length !== row.actions.length) return void 0;
	return {
		helperVersion,
		discoveryVersions: row.discoveryVersions,
		actions,
		mode
	};
}
/** @returns a validated status payload, or undefined when the shape is not trusted. */
function parseStatus(value) {
	const row = object(value);
	if (row === void 0) return void 0;
	const helperVersion = boundedString(row.helperVersion, 64);
	const instanceKey = boundedString(row.instanceKey, 64);
	const mode = boundedString(row.mode, 32);
	const checkedAt = boundedString(row.checkedAt, 64);
	const descriptor = descriptorState(row.descriptor);
	if (helperVersion === void 0 || instanceKey === void 0 || mode === void 0 || checkedAt === void 0 || descriptor === void 0 || typeof row.registered !== "boolean" || ![
		"systemd-user",
		"unsupported",
		"unregistered"
	].includes(mode)) return void 0;
	const registrationRevision = typeof row.registrationRevision === "string" ? boundedString(row.registrationRevision, 64) : void 0;
	const instanceId = typeof row.instanceId === "string" ? boundedString(row.instanceId, 128) : void 0;
	const service = row.service === void 0 ? void 0 : serviceState(row.service);
	if (row.service !== void 0 && service === void 0) return void 0;
	const listener = row.listener === void 0 ? void 0 : listenerState(row.listener);
	if (row.listener !== void 0 && listener === void 0) return void 0;
	const loopback = object(row.loopback);
	return {
		helperVersion,
		instanceKey,
		registered: row.registered,
		mode,
		...registrationRevision !== void 0 ? { registrationRevision } : {},
		...instanceId !== void 0 ? { instanceId } : {},
		...service !== void 0 ? { service } : {},
		descriptor,
		...listener !== void 0 ? { listener } : {},
		...loopback !== void 0 && typeof loopback.connectable === "boolean" && typeof loopback.checkedAt === "string" ? { loopback: {
			connectable: loopback.connectable,
			checkedAt: loopback.checkedAt
		} } : {},
		checkedAt
	};
}
/** @returns a validated operation receipt, or undefined when the shape is not trusted. */
function parseReceipt(value) {
	const row = object(value);
	if (row === void 0) return void 0;
	const operationId = boundedString(row.operationId, 64);
	const action = boundedString(row.action, 32);
	const instanceKey = boundedString(row.instanceKey, 64);
	const issuedAt = boundedString(row.issuedAt, 64);
	const recordedAt = boundedString(row.recordedAt, 64);
	const registrationRevision = boundedString(row.registrationRevision, 64);
	const outcome = boundedString(row.outcome, 32);
	if (operationId === void 0 || action === void 0 || instanceKey === void 0 || issuedAt === void 0 || recordedAt === void 0 || registrationRevision === void 0 || outcome === void 0 || ![
		"pending",
		"completed",
		"failed",
		"outcome-unknown"
	].includes(outcome) || !CONTROL_ACTIONS.includes(action)) return void 0;
	const code = typeof row.code === "string" ? row.code : void 0;
	if (code !== void 0 && !isRemoteErrorCode(code)) return void 0;
	return {
		operationId,
		action,
		instanceKey,
		issuedAt,
		recordedAt,
		registrationRevision,
		outcome,
		...code !== void 0 ? { code } : {},
		...typeof row.summary === "string" ? { summary: redact(row.summary) } : {}
	};
}
function envelope(text) {
	let value;
	try {
		value = JSON.parse(text);
	} catch {
		return "BAD_INPUT";
	}
	const row = object(value);
	if (row === void 0 || row.controlVersion !== 1) return "BAD_INPUT";
	if (typeof row.action !== "string" || !CONTROL_ACTIONS.includes(row.action)) return "BAD_INPUT";
	if (typeof row.ok !== "boolean") return "BAD_INPUT";
	if (row.ok) return {
		controlVersion: 1,
		action: row.action,
		ok: true,
		payload: row
	};
	const error = object(row.error);
	const code = error === void 0 ? void 0 : boundedString(error.code, 64);
	if (code === void 0 || !isRemoteErrorCode(code)) return "BAD_INPUT";
	return {
		controlVersion: 1,
		action: row.action,
		ok: false,
		error: {
			code,
			message: typeof error?.message === "string" ? redact(error.message) : ""
		}
	};
}
/** One control invocation over its own SSH process. */
var ControlClient = class {
	options;
	constructor(options) {
		this.options = options;
	}
	async invoke(body, signal) {
		if (!validAlias(this.options.alias) || !validHelperPath(this.options.helperPath) || !validInstanceKey(this.options.instanceKey)) return "HELPER_BAD_CONFIG";
		const request = `${JSON.stringify({
			controlVersion: 1,
			...body
		})}\n`;
		if (Buffer.byteLength(request, "utf8") > 4096) return "BAD_INPUT";
		const run = await runHelper(this.options.alias, this.options.helperPath, ["--control"], request, signal, this.options.timeoutMs ?? 1e4);
		if (run.timedOut) return "SSH_TIMEOUT";
		if (run.oversized) return "HELPER_BAD_CONFIG";
		if (run.code !== 0) {
			const structured = /\b([A-Z_]{4,})\b/u.exec(run.stderr)?.[1];
			if (structured === "BAD_INPUT") return "CONTROL_UNSUPPORTED";
			if (structured !== void 0 && isRemoteErrorCode(structured)) return structured;
			if (run.code === 126 || run.code === 127) return "HELPER_NOT_FOUND";
			return "CONTROL_FAILED";
		}
		if (Buffer.byteLength(run.stdout, "utf8") > 65536) return "HELPER_BAD_CONFIG";
		return envelope(run.stdout);
	}
	/** @returns whether this helper implements the management protocol at all. */
	async capabilities(signal) {
		return this.read("capabilities", {}, signal, parseCapabilities);
	}
	/** @returns the instance's registration, service, descriptor and listener facts. */
	async status(signal) {
		return this.read("status", {}, signal, parseStatus);
	}
	/** @returns one recorded receipt without submitting a new action. */
	async operationStatus(operationId, signal) {
		if (!validOperationId(operationId)) return {
			ok: false,
			error: failure("BAD_INPUT", "invalid operation id")
		};
		return this.read("operationStatus", { operationId }, signal, parseReceipt);
	}
	/**
	* Submit exactly one write action. The caller owns idempotence: the same operationId must be
	* reused when asking for the result and never replaced to force a retry.
	*/
	async submit(action, body, signal) {
		if (!CONTROL_WRITE_ACTIONS.includes(action)) return {
			ok: false,
			error: failure("BAD_INPUT", "not a write action")
		};
		if (!validOperationId(body.operationId) || !validRegistrationRevision(body.registrationRevision) || Number.isNaN(Date.parse(body.issuedAt))) return {
			ok: false,
			error: failure("BAD_INPUT", "invalid write action input")
		};
		if (body.expectedInstanceId !== void 0 && !validExpectedInstanceId(body.expectedInstanceId)) return {
			ok: false,
			error: failure("BAD_INPUT", "invalid expected instance id")
		};
		return this.read(action, { ...body }, signal, parseReceipt);
	}
	async read(action, body, signal, parse) {
		const result = await this.invoke({
			action,
			instanceKey: this.options.instanceKey,
			...body
		}, signal);
		if (typeof result === "string") return {
			ok: false,
			error: failure(result, `control ${action} failed`)
		};
		if (!result.ok) return {
			ok: false,
			error: failure(result.error?.code ?? "CONTROL_FAILED", result.error?.message ?? "")
		};
		if (result.action !== action) return {
			ok: false,
			error: failure("BAD_INPUT", "action mismatch in control response")
		};
		const parsed = parse(result.payload);
		if (parsed === void 0) return {
			ok: false,
			error: failure("BAD_INPUT", `invalid ${action} payload`)
		};
		return {
			ok: true,
			value: parsed
		};
	}
};
//#endregion
//#region lib/types/types.js
const CHECK_NAMES = [
	"ssh",
	"helper",
	"service",
	"descriptor",
	"listener",
	"identity",
	"authentication",
	"events",
	"application"
];
/** Build a diagnostics list with every named check present, defaulting to `unknown`. */
function diagnostics(entries, checkedAt) {
	return CHECK_NAMES.map((name) => {
		const entry = entries[name];
		if (entry === void 0) return {
			name,
			state: "unknown",
			checkedAt
		};
		return {
			name,
			state: entry.state,
			checkedAt,
			...entry.code === void 0 ? {} : { code: entry.code }
		};
	});
}
//#endregion
//#region lib/types/manager.js
/** One-target connection state, generation fencing, layered checks, and owned resource teardown. */
/** Named-check accumulator for one connection attempt. */
var Checks = class {
	entries = {};
	set(name, state, code) {
		this.entries[name] = {
			state,
			...code === void 0 ? {} : { code }
		};
	}
	list() {
		return diagnostics(this.entries, (/* @__PURE__ */ new Date()).toISOString());
	}
	/** @returns the first failed check, for phase selection. */
	firstFailure() {
		for (const name of [
			"ssh",
			"helper",
			"service",
			"descriptor",
			"listener",
			"identity",
			"authentication",
			"events",
			"application"
		]) {
			const entry = this.entries[name];
			if (entry?.state === "failed" && entry.code !== void 0) return entry.code;
		}
	}
};
/** Holds exactly one remote attachment and never owns the remote Harness process. */
var ConnectionManager = class {
	targets;
	helperPath;
	current;
	connecting = false;
	pending;
	disposed = false;
	settlement;
	state = {
		phase: "idle",
		generation: 0,
		diagnostics: diagnostics({}, (/* @__PURE__ */ new Date()).toISOString())
	};
	listeners = /* @__PURE__ */ new Set();
	/** @param targets - non-secret target store. @param helperPath - fixed Linux helper executable path. */
	constructor(targets, helperPath) {
		this.targets = targets;
		this.helperPath = helperPath;
	}
	/** @returns current non-sensitive snapshot. */
	getState() {
		return this.state;
	}
	/** @returns configured non-secret targets. */
	listTargets() {
		return this.targets.list();
	}
	/** @param target - full non-secret target. @returns saved records. */
	saveTarget(target) {
		return this.targets.save(target);
	}
	/**
	* Connect a reviewed SSH alias to one configured instance.
	* @param targetId - stable target id.
	* @param endpointId - selected LAN, frp TCP, or STCP alias.
	* @param operationId - caller operation id for duplicate connect suppression.
	* @returns authenticated connection snapshot.
	*/
	async connect(targetId, endpointId, operationId) {
		this.checkAvailable(operationId);
		if (this.current?.operationId === operationId) return this.state;
		this.connecting = true;
		const settled = Promise.withResolvers();
		this.settlement = settled.promise;
		try {
			const found = (await this.targets.list()).find((item) => item.id === targetId);
			const route = found?.endpoints.find((item) => item.id === endpointId);
			if (found === void 0 || route === void 0) throw new Error("remote-workspace: unknown target or endpoint");
			return await this.attach(found, route, operationId);
		} finally {
			this.connecting = false;
			settled.resolve();
		}
	}
	/** Read public identity, pin new targets, and attach using only an SSH alias.
	* @param sshAlias - reviewed OpenSSH alias. @param instanceKey - Companion key, normally default.
	* @param operationId - caller operation id.
	* @returns authenticated attachment state; existing identity pins are never replaced.
	*/
	async quickConnect(sshAlias, instanceKey, operationId) {
		this.checkAvailable(operationId);
		if (this.current?.operationId === operationId) return this.state;
		this.connecting = true;
		const settled = Promise.withResolvers();
		this.settlement = settled.promise;
		const lifetime = new AbortController();
		this.pending = lifetime;
		const checks = new Checks();
		checks.set("ssh", "checking");
		this.publish({
			phase: "discovering",
			hostName: sshAlias,
			generation: this.state.generation + 1,
			diagnostics: checks.list()
		});
		try {
			if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/u.test(sshAlias) || !/^[A-Za-z0-9_-]{1,64}$/u.test(instanceKey)) throw new Error("remote-workspace: invalid SSH discovery configuration");
			const targets = await this.targets.list();
			lifetime.signal.throwIfAborted();
			const existing = targets.find((item) => item.instanceKey === instanceKey && item.endpoints.some((route) => route.sshAlias === sshAlias));
			if (existing !== void 0) {
				const endpoint = existing.endpoints.find((route) => route.sshAlias === sshAlias);
				if (endpoint === void 0) throw new Error("remote-workspace: unknown endpoint");
				return await this.attach(existing, endpoint, operationId, lifetime);
			}
			const info = await this.identityOnly(sshAlias, instanceKey, lifetime.signal, checks);
			lifetime.signal.throwIfAborted();
			if (info.instanceKey !== instanceKey) throw new IdentityMismatch("remote-workspace: configured instance identity mismatch");
			const target = {
				id: randomUUID(),
				name: sshAlias,
				instanceKey,
				instanceId: info.instanceId,
				profile: info.profile,
				workspaceHint: info.workspaceHint,
				remotePort: info.port,
				endpoints: [{
					id: "ssh",
					kind: "lan",
					sshAlias
				}]
			};
			await this.targets.save(target);
			lifetime.signal.throwIfAborted();
			return await this.attach(target, target.endpoints[0], operationId, lifetime);
		} catch (error) {
			if (!this.disposed && !lifetime.signal.aborted) this.publish({
				...this.state,
				connectionId: void 0,
				phase: this.failurePhase(error),
				reason: redact(this.failureReason(error)),
				diagnostics: this.failureChecks(checks, error)
			});
			throw error;
		} finally {
			if (this.pending === lifetime) this.pending = void 0;
			this.connecting = false;
			settled.resolve();
		}
	}
	/**
	* Read-only preflight for one endpoint. It never saves a target and never starts a service,
	* so a first-time alias can be inspected before anything is pinned.
	* @param ref - saved target or first-time SSH alias.
	* @param operationId - caller operation id, validated but never persisted.
	* @returns capability, service and layered diagnostic summary.
	*/
	async inspectEndpoint(ref, operationId) {
		if (this.disposed) throw new Error("remote-workspace: controller disposed");
		if (!/^[A-Za-z0-9_-]{1,64}$/u.test(operationId)) throw new Error("remote-workspace: invalid operation id");
		const resolved = await this.resolve(ref);
		const lifetime = new AbortController();
		const checks = new Checks();
		checks.set("ssh", "checking");
		let capabilities;
		let service;
		try {
			await this.identityOnly(resolved.sshAlias, resolved.instanceKey, lifetime.signal, checks);
			const control = this.control(resolved.sshAlias, resolved.instanceKey);
			const caps = await control.capabilities(lifetime.signal);
			if (caps.ok) {
				capabilities = {
					controlVersion: 1,
					helperVersion: caps.value.helperVersion,
					mode: caps.value.mode,
					actions: caps.value.actions
				};
				checks.set("helper", "ok");
				const status = await control.status(lifetime.signal);
				if (status.ok) {
					service = this.serviceState(status.value, resolved.instanceKey);
					checks.set("service", service.registered ? "ok" : "unsupported", service.registered ? void 0 : "SERVICE_UNREGISTERED");
					checks.set("descriptor", status.value.descriptor.parsable ? "ok" : "failed", status.value.descriptor.parsable ? void 0 : "DESCRIPTOR_INVALID");
					if (status.value.listener === void 0) checks.set("listener", "unknown");
					else if (!status.value.listener.supported) checks.set("listener", "unsupported", "UNSUPPORTED_WEB_TRANSPORT");
					else checks.set("listener", "ok");
					if (service.state === "failed") checks.set("application", "failed", "SERVICE_FAILED");
					else if (service.state === "inactive") checks.set("application", "failed", "SERVICE_STOPPED");
					else if (service.state === "active") checks.set("application", "unknown");
				} else checks.set("service", "failed", status.error.code);
			} else if (caps.error.code === "CONTROL_UNSUPPORTED") {
				checks.set("helper", "unsupported", "CONTROL_UNSUPPORTED");
				checks.set("service", "unsupported", "CONTROL_UNSUPPORTED");
				checks.set("descriptor", "unknown");
			} else {
				checks.set("helper", "failed", caps.error.code);
				checks.set("service", "unknown", caps.error.code);
				checks.set("descriptor", "unknown");
			}
			return {
				sshAlias: resolved.sshAlias,
				instanceKey: resolved.instanceKey,
				known: resolved.known,
				...capabilities === void 0 ? {} : { capabilities },
				...service === void 0 ? {} : { service },
				diagnostics: checks.list(),
				checkedAt: (/* @__PURE__ */ new Date()).toISOString()
			};
		} catch (error) {
			return {
				sshAlias: resolved.sshAlias,
				instanceKey: resolved.instanceKey,
				known: resolved.known,
				diagnostics: this.failureChecks(checks, error),
				checkedAt: (/* @__PURE__ */ new Date()).toISOString()
			};
		}
	}
	/**
	* Submit one restricted service action against the active attachment.
	*
	* Writes are serialized per target. A `stop` pauses the local proxy before the command so no
	* page keeps talking to a service that is going away; a `start` or `restart` waits for the
	* new descriptor, the identity and the application to become ready again.
	*
	* @param ref - endpoint the action applies to; must match the active connection when present.
	* @param action - start, stop or restart.
	* @param operationId - idempotency key; reused when asking for the result.
	* @param issuedAt - ISO timestamp of the caller's intent.
	* @param registrationRevision - revision the caller saw.
	* @param expectedInstanceId - pinned instance id, when known.
	* @returns the receipt recorded by the helper, or a local failure.
	*/
	async serviceAction(ref, action, operationId, issuedAt, registrationRevision, expectedInstanceId) {
		if (this.disposed) throw new Error("remote-workspace: controller disposed");
		const active = this.current;
		if (active === void 0) throw new Error("remote-workspace: connect to the target before a service action");
		const resolved = await this.resolve(ref);
		if (resolved.sshAlias !== active.endpoint.sshAlias) throw new Error("remote-workspace: disconnect the active target first");
		if (active.operation.phase === "submitting" || active.operation.phase === "waiting") throw new Error("remote-workspace: a service action is already in progress");
		const startedAt = (/* @__PURE__ */ new Date()).toISOString();
		const update = (patch) => {
			active.operation = {
				...active.operation,
				...patch
			};
			this.publishFor(active, { serviceOperation: active.operation });
			return active.operation;
		};
		update({
			phase: "submitting",
			action,
			operationId,
			startedAt
		});
		if (action === "stop") active.proxy?.pause();
		const result = await this.control(resolved.sshAlias, resolved.instanceKey).submit(action, {
			operationId,
			issuedAt,
			registrationRevision,
			...expectedInstanceId === void 0 ? {} : { expectedInstanceId }
		}, active.lifetime.signal);
		if (!result.ok) {
			update({
				phase: result.error.code === "OUTCOME_UNKNOWN" ? "outcome-unknown" : "failed",
				code: result.error.code,
				finishedAt: (/* @__PURE__ */ new Date()).toISOString()
			});
			await this.reconcileAfterAction(active, action);
			return active.operation;
		}
		const receipt = result.value;
		if (receipt.outcome === "pending") update({ phase: "waiting" });
		if (receipt.outcome === "outcome-unknown") {
			update({
				phase: "outcome-unknown",
				code: "OUTCOME_UNKNOWN",
				finishedAt: (/* @__PURE__ */ new Date()).toISOString()
			});
			await this.reconcileAfterAction(active, action);
			return active.operation;
		}
		if (receipt.outcome === "failed") {
			update({
				phase: "failed",
				code: receipt.code ?? "SERVICE_FAILED",
				finishedAt: (/* @__PURE__ */ new Date()).toISOString()
			});
			await this.reconcileAfterAction(active, action);
			return active.operation;
		}
		update({
			phase: "completed",
			finishedAt: (/* @__PURE__ */ new Date()).toISOString()
		});
		if (action === "stop") {
			this.publishFor(active, {
				phase: "service-stopped",
				...active.service === void 0 ? {} : { service: {
					...active.service,
					state: "inactive"
				} }
			});
			return active.operation;
		}
		await this.waitForReady(active);
		return active.operation;
	}
	/**
	* Read one previously submitted action's receipt. This never submits a new action.
	* @param ref - endpoint the receipt belongs to.
	* @param operationId - the id used when the action was submitted.
	*/
	async getServiceOperation(ref, operationId) {
		const resolved = await this.resolve(ref);
		const control = this.control(resolved.sshAlias, resolved.instanceKey);
		const lifetime = new AbortController();
		const result = await control.operationStatus(operationId, lifetime.signal);
		if (!result.ok) return {
			phase: "failed",
			operationId,
			code: result.error.code,
			finishedAt: (/* @__PURE__ */ new Date()).toISOString()
		};
		return this.operationFromReceipt(result.value);
	}
	/**
	* Re-authenticate the active attachment without touching the remote service.
	*
	* It rebuilds the SSH forward, exchanges a fresh remote Cookie, re-verifies identity and the
	* event stream, then resumes the same local proxy. Concurrent calls for the same connection
	* are single-flight, and no previously submitted business request is replayed.
	*
	* @param connectionId - active attachment.
	* @param operationId - caller operation id.
	* @returns the new snapshot.
	*/
	async refreshAuthentication(connectionId, operationId) {
		const active = this.current;
		if (active === void 0 || active.id !== connectionId) throw new Error("remote-workspace: unknown connection");
		if (!/^[A-Za-z0-9_-]{1,64}$/u.test(operationId)) throw new Error("remote-workspace: invalid operation id");
		if (active.refreshing) return this.state;
		active.refreshing = true;
		try {
			active.checks.set("authentication", "checking");
			this.publishFor(active, { phase: "authenticating" });
			const descriptor = await discover(active.endpoint.sshAlias, active.target.instanceKey, this.helperPath, active.lifetime.signal);
			this.assertDescriptor(active.target, descriptor);
			active.forward = await forward(active.endpoint.sshAlias, active.target.remotePort, active.lifetime.signal);
			const cookie = await authenticate(active.forward.port, active.target.remotePort, descriptor);
			const live = await readIdentity(active.forward.port, active.target.remotePort, cookie);
			this.assertIdentity(descriptor, live);
			await probeEventStream(active.forward.port, active.target.remotePort, cookie);
			active.cookie = cookie;
			active.proxy?.resume(active.forward.port, cookie);
			active.checks.set("authentication", "ok");
			active.checks.set("events", "ok");
			this.publishFor(active, {
				phase: "app-ready",
				bootId: live.bootId,
				workspaceHint: live.workspaceHint
			});
			return this.state;
		} catch (error) {
			active.checks.set("authentication", "failed", this.codeFor(error));
			this.publishFor(active, {
				phase: this.failurePhase(error),
				reason: redact(this.failureReason(error))
			});
			throw error;
		} finally {
			active.refreshing = false;
		}
	}
	checkAvailable(operationId) {
		if (this.disposed) throw new Error("remote-workspace: controller disposed");
		if (!/^[A-Za-z0-9_-]{1,64}$/u.test(operationId)) throw new Error("remote-workspace: invalid operation id");
		if (this.current !== void 0) {
			if (this.current.operationId === operationId) return;
			throw new Error("remote-workspace: disconnect the active target first");
		}
		if (this.connecting) throw new Error("remote-workspace: a connection is already starting");
	}
	/** @returns the saved target and alias for an endpoint reference. */
	async resolve(ref) {
		if ("sshAlias" in ref) {
			if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/u.test(ref.sshAlias) || !/^[A-Za-z0-9_-]{1,64}$/u.test(ref.instanceKey)) throw new Error("remote-workspace: invalid SSH discovery configuration");
			const known = (await this.targets.list()).some((item) => item.instanceKey === ref.instanceKey && item.endpoints.some((route) => route.sshAlias === ref.sshAlias));
			return {
				sshAlias: ref.sshAlias,
				instanceKey: ref.instanceKey,
				known
			};
		}
		const found = (await this.targets.list()).find((item) => item.id === ref.targetId);
		const route = found?.endpoints.find((item) => item.id === ref.endpointId);
		if (found === void 0 || route === void 0) throw new Error("remote-workspace: unknown target or endpoint");
		return {
			sshAlias: route.sshAlias,
			instanceKey: found.instanceKey,
			known: true
		};
	}
	control(sshAlias, instanceKey) {
		return new ControlClient({
			alias: sshAlias,
			instanceKey,
			helperPath: this.helperPath
		});
	}
	serviceState(status, instanceKey) {
		return {
			unit: status.service?.unit ?? "",
			state: status.service?.state ?? "unknown",
			registered: status.registered && status.instanceKey === instanceKey,
			...status.registrationRevision === void 0 ? {} : { registrationRevision: status.registrationRevision }
		};
	}
	operationFromReceipt(receipt) {
		return {
			phase: receipt.outcome === "pending" ? "waiting" : receipt.outcome === "completed" ? "completed" : receipt.outcome === "outcome-unknown" ? "outcome-unknown" : "failed",
			action: receipt.action,
			operationId: receipt.operationId,
			...receipt.code === void 0 ? {} : { code: receipt.code },
			...receipt.issuedAt === void 0 ? {} : { startedAt: receipt.issuedAt },
			...receipt.recordedAt === void 0 ? {} : { finishedAt: receipt.recordedAt }
		};
	}
	/** Read the public instance identity over `--identity`; never fetches a launch credential. */
	async identityOnly(sshAlias, instanceKey, signal, checks) {
		try {
			const info = await discoverTarget(sshAlias, instanceKey, this.helperPath, signal);
			checks.set("ssh", "ok");
			checks.set("helper", "ok");
			checks.set("identity", "ok");
			checks.set("descriptor", "ok");
			return info;
		} catch (error) {
			const code = this.codeFor(error);
			checks.set(errorFacts(code).stage === "ssh" ? "ssh" : "helper", "failed", code);
			throw error;
		}
	}
	async attach(target, endpoint, operationId, lifetime = new AbortController()) {
		lifetime.signal.throwIfAborted();
		if (this.disposed) throw new Error("remote-workspace: controller disposed");
		const active = {
			id: randomUUID(),
			operationId,
			target,
			endpoint,
			lifetime,
			forward: void 0,
			proxy: void 0,
			retrying: false,
			cookie: void 0,
			capabilities: void 0,
			service: void 0,
			checks: new Checks(),
			operation: { phase: "idle" },
			refreshing: false,
			awaitingReady: false
		};
		this.current = active;
		active.checks.set("ssh", "checking");
		this.publishFor(active, {
			phase: "ssh-auth",
			connectionId: active.id,
			targetId: target.id,
			endpointId: endpoint.id,
			hostName: target.name,
			instanceId: target.instanceId,
			profile: target.profile,
			workspaceHint: target.workspaceHint,
			serviceOperation: active.operation
		});
		try {
			await this.attempt(active);
			return this.state;
		} catch (error) {
			if (this.current === active) {
				this.current = void 0;
				active.lifetime.abort();
				await this.release(active);
				this.publish({
					...this.state,
					connectionId: void 0,
					phase: this.failurePhase(error),
					reason: redact(this.failureReason(error)),
					diagnostics: active.checks.list()
				});
			}
			throw error;
		}
	}
	/** @param connectionId - attachment to release. @returns idle or unchanged state. */
	async disconnect(connectionId) {
		const active = this.current;
		if (active === void 0 || active.id !== connectionId) return this.state;
		this.current = void 0;
		active.lifetime.abort(/* @__PURE__ */ new Error("remote-workspace: disconnected"));
		await this.release(active);
		this.publish({
			phase: "idle",
			generation: this.state.generation + 1,
			diagnostics: diagnostics({}, (/* @__PURE__ */ new Date()).toISOString())
		});
		return this.state;
	}
	/** @param connectionId - active attachment. @returns one-use, short-lived local URL. */
	createOpenTicket(connectionId) {
		const active = this.current;
		if (active === void 0 || active.id !== connectionId || this.state.phase !== "app-ready" || active.proxy === void 0) throw new Error("remote-workspace: connection is not ready");
		return active.proxy.openTicket();
	}
	/**
	* Record that a browser page asked for access without a usable local Cookie.
	* A single unauthenticated scan never marks the remote service as stopped and never closes
	* another authenticated page's WebSocket.
	* @param code - fixed code reported by the proxy.
	*/
	noteAccessWarning(code) {
		if (this.state.accessWarning === code) return;
		this.publish({
			...this.state,
			accessWarning: code
		});
	}
	/** @param signal - stream cancellation. @returns latest state followed by changes. */
	async *watch(signal) {
		const queue = [this.state];
		let wake;
		const listener = (state) => {
			queue.push(state);
			wake?.();
		};
		const stop = () => {
			wake?.();
		};
		this.listeners.add(listener);
		signal.addEventListener("abort", stop, { once: true });
		try {
			while (!signal.aborted) {
				const next = queue.shift();
				if (next !== void 0) {
					yield next;
					continue;
				}
				await new Promise((resolve) => {
					wake = resolve;
				});
				wake = void 0;
			}
		} finally {
			this.listeners.delete(listener);
			signal.removeEventListener("abort", stop);
		}
	}
	/** Release local resources on Host plugin disposal. */
	async dispose() {
		this.disposed = true;
		this.pending?.abort(/* @__PURE__ */ new Error("remote-workspace: controller disposed"));
		const id = this.current?.id;
		if (id !== void 0) await this.disconnect(id);
		await this.settlement;
	}
	publish(state) {
		this.state = state;
		for (const listener of this.listeners) listener(state);
	}
	/**
	* Publish only while `active` is still the current attachment.
	* A late result from a replaced or disconnected connection is dropped instead of
	* overwriting the new target's state.
	*/
	publishFor(active, patch) {
		if (this.current !== active || this.disposed) return;
		this.publish({
			...this.state,
			...patch,
			generation: this.state.generation + 1,
			diagnostics: active.checks.list()
		});
	}
	assertDescriptor(target, descriptor) {
		if (descriptor.instanceId !== target.instanceId || descriptor.instanceKey !== target.instanceKey || descriptor.port !== target.remotePort || descriptor.profile !== target.profile) throw new IdentityMismatch("remote-workspace: configured instance identity mismatch");
	}
	assertIdentity(descriptor, live) {
		if (live.instanceId !== descriptor.instanceId || live.bootId !== descriptor.bootId || live.instanceKey !== descriptor.instanceKey || live.profile !== descriptor.profile) throw new IdentityMismatch("remote-workspace: authenticated instance identity mismatch");
	}
	async attempt(active) {
		const signal = active.lifetime.signal;
		const identity = {
			connectionId: active.id,
			targetId: active.target.id,
			endpointId: active.endpoint.id,
			hostName: active.target.name,
			instanceId: active.target.instanceId,
			profile: active.target.profile,
			workspaceHint: active.target.workspaceHint
		};
		this.publishFor(active, {
			...identity,
			phase: active.retrying ? "reconnecting" : "checking"
		});
		let ready = false;
		try {
			const control = this.control(active.endpoint.sshAlias, active.target.instanceKey);
			const caps = await control.capabilities(signal);
			if (caps.ok) {
				active.capabilities = {
					controlVersion: 1,
					helperVersion: caps.value.helperVersion,
					mode: caps.value.mode,
					actions: caps.value.actions
				};
				active.checks.set("helper", "ok");
				const status = await control.status(signal);
				if (status.ok) {
					active.service = this.serviceState(status.value, active.target.instanceKey);
					active.checks.set("service", active.service.registered ? "ok" : "unsupported", active.service.registered ? void 0 : "SERVICE_UNREGISTERED");
				} else active.checks.set("service", "failed", status.error.code);
			} else if (caps.error.code === "CONTROL_UNSUPPORTED") {
				active.checks.set("helper", "unsupported", "CONTROL_UNSUPPORTED");
				active.checks.set("service", "unsupported", "CONTROL_UNSUPPORTED");
			} else active.checks.set("helper", "failed", caps.error.code);
			signal.throwIfAborted();
			this.publishFor(active, {
				...active.capabilities === void 0 ? {} : { capabilities: active.capabilities },
				...active.service === void 0 ? {} : { service: active.service }
			});
			this.publishFor(active, { phase: "discovering" });
			let descriptor;
			try {
				descriptor = await discover(active.endpoint.sshAlias, active.target.instanceKey, this.helperPath, signal);
			} catch (error) {
				const code = this.codeFor(error);
				if (active.service !== void 0 && (active.service.state === "inactive" || active.service.state === "failed")) {
					active.checks.set("descriptor", "failed", "SERVICE_STOPPED");
					active.checks.set("application", "failed", "SERVICE_STOPPED");
					throw new ServiceStopped("remote-workspace: remote service is not running");
				}
				active.checks.set("descriptor", "failed", code);
				throw error;
			}
			signal.throwIfAborted();
			this.assertDescriptor(active.target, descriptor);
			active.checks.set("ssh", "ok");
			active.checks.set("descriptor", "ok");
			active.checks.set("identity", "ok");
			this.publishFor(active, {
				phase: "forwarding",
				bootId: descriptor.bootId
			});
			active.forward = await forward(active.endpoint.sshAlias, active.target.remotePort, signal);
			signal.throwIfAborted();
			this.publishFor(active, {
				phase: "authenticating",
				bootId: descriptor.bootId
			});
			active.checks.set("authentication", "checking");
			let cookie;
			try {
				cookie = await authenticate(active.forward.port, active.target.remotePort, descriptor);
			} catch (error) {
				active.checks.set("authentication", "failed", this.codeFor(error));
				throw error;
			}
			signal.throwIfAborted();
			const live = await readIdentity(active.forward.port, active.target.remotePort, cookie);
			this.assertIdentity(descriptor, live);
			active.checks.set("authentication", "ok");
			active.checks.set("identity", "ok");
			this.publishFor(active, {
				phase: "verifying",
				bootId: live.bootId
			});
			active.checks.set("events", "checking");
			await probeEventStream(active.forward.port, active.target.remotePort, cookie);
			active.checks.set("events", "ok");
			active.checks.set("application", "ok");
			signal.throwIfAborted();
			if (active.proxy === void 0) {
				active.proxy = new AuthProxy(active.forward.port, active.target.remotePort, cookie, (code) => {
					if (this.current !== active) return;
					this.noteAccessWarning(code);
				});
				await active.proxy.start();
			} else active.proxy.resume(active.forward.port, cookie);
			active.cookie = cookie;
			signal.throwIfAborted();
			this.publishFor(active, {
				phase: "app-ready",
				bootId: live.bootId,
				workspaceHint: live.workspaceHint,
				accessWarning: void 0
			});
			ready = true;
			const ownedForward = active.forward;
			ownedForward.exited.then(() => {
				if (this.current === active && active.forward === ownedForward && !signal.aborted) this.lost(active);
			}).catch(() => {
				if (this.current === active && active.forward === ownedForward && !signal.aborted) this.lost(active);
			});
		} finally {
			if (!ready) await this.release(active, active.retrying);
		}
	}
	/** Re-read the real service state after an action whose outcome is not certain. */
	async reconcileAfterAction(active, action) {
		if (this.current !== active) return;
		const status = await this.control(active.endpoint.sshAlias, active.target.instanceKey).status(active.lifetime.signal);
		if (!status.ok) return;
		active.service = this.serviceState(status.value, active.target.instanceKey);
		this.publishFor(active, { service: active.service });
		if (action === "stop") {
			active.checks.set("application", "failed", "SERVICE_STOPPED");
			this.publishFor(active, { phase: "service-stopped" });
		}
	}
	/** Wait for a started or restarted service to become really ready again. */
	async waitForReady(active) {
		const deadline = Date.now() + 6e4;
		active.awaitingReady = true;
		try {
			while (Date.now() < deadline && this.current === active && !active.lifetime.signal.aborted) {
				await new Promise((resolve) => setTimeout(resolve, 2e3));
				if (this.current !== active || active.lifetime.signal.aborted) return;
				try {
					active.forward = void 0;
					await this.attempt(active);
					active.checks.set("service", "ok");
					return;
				} catch (error) {
					this.publishFor(active, {
						phase: this.failurePhase(error),
						reason: redact(this.failureReason(error))
					});
				}
			}
			active.checks.set("application", "failed", "APPLICATION_NOT_READY");
			this.publishFor(active, {
				phase: "error",
				reason: "remote service did not become ready in time"
			});
		} finally {
			active.awaitingReady = false;
		}
	}
	async lost(active) {
		if (active.retrying || this.current !== active) return;
		active.retrying = true;
		await this.release(active, true);
		if (this.current !== active) return;
		active.checks.set("ssh", "failed", "SSH_UNAVAILABLE");
		this.publishFor(active, {
			phase: "disconnected",
			reason: "SSH transport closed"
		});
		const deadline = Date.now() + 5 * 6e4;
		for (let attempt = 0; Date.now() < deadline && this.current === active && !active.lifetime.signal.aborted; attempt++) {
			const seconds = [
				1,
				2,
				4,
				8,
				16,
				30
			][Math.min(attempt, 5)] ?? 30;
			await new Promise((resolve) => setTimeout(resolve, seconds * 1e3 + Math.floor(Math.random() * 500)));
			if (this.current !== active || active.lifetime.signal.aborted) break;
			try {
				await this.attempt(active);
				active.retrying = false;
				return;
			} catch (error) {
				const phase = this.failurePhase(error);
				this.publishFor(active, {
					phase,
					reason: redact(this.failureReason(error))
				});
				if (phase === "identity-mismatch" || phase === "auth-required") break;
			}
		}
		active.retrying = false;
		if (this.current === active) {
			this.current = void 0;
			await this.release(active);
			this.publish({
				...this.state,
				connectionId: void 0,
				phase: "disconnected"
			});
		}
	}
	async release(active, keepProxy = false) {
		const proxy = active.proxy, ssh = active.forward;
		if (keepProxy) proxy?.pause();
		else active.proxy = void 0;
		active.forward = void 0;
		active.cookie = void 0;
		await Promise.all([keepProxy ? void 0 : proxy?.stop(), ssh?.stop()]);
	}
	codeFor(error) {
		if (error instanceof IdentityMismatch) return "IDENTITY_MISMATCH";
		if (error instanceof UpstreamAuthRequired) return "UPSTREAM_AUTH_REQUIRED";
		if (error instanceof ServiceStopped) return "SERVICE_STOPPED";
		const message = error instanceof Error ? error.message : "";
		if (/SSH_HOST_KEY/u.test(message)) return "HOST_KEY_REJECTED";
		if (/SSH_AUTH\b/u.test(message)) return "SSH_AUTH_FAILED";
		if (/SSH_ALIAS|SSH_UNREACHABLE|SSH forward unavailable/u.test(message)) return "SSH_UNAVAILABLE";
		if (/SSH_HELPER/u.test(message)) return "HELPER_BAD_CONFIG";
		if (/identity|launch URL|launch token|session Cookie/u.test(message)) return "UPSTREAM_AUTH_REQUIRED";
		if (error instanceof UpstreamUnreachable) return "UPSTREAM_UNREACHABLE";
		if (/event stream/u.test(message)) return "APPLICATION_NOT_READY";
		return "SSH_UNAVAILABLE";
	}
	failureChecks(checks, error) {
		const code = this.codeFor(error);
		const stage = errorFacts(code).stage;
		const name = stage === "auth" ? "authentication" : stage === "descriptor" ? "descriptor" : stage === "service" ? "service" : stage === "application" ? "application" : "ssh";
		checks.set(name, "failed", code);
		return checks.list();
	}
	failurePhase(error) {
		if (error instanceof IdentityMismatch) return "identity-mismatch";
		if (error instanceof ServiceStopped) return "service-stopped";
		if (error instanceof UpstreamAuthRequired) return "auth-required";
		return "error";
	}
	failureReason(error) {
		if (error instanceof IdentityMismatch || error instanceof UpstreamAuthRequired || error instanceof ServiceStopped) return error.message;
		return error instanceof Error ? error.message.replace(/token=[^\s]+/gu, "token=[redacted]") : "connection failed";
	}
};
//#endregion
//#region lib/types/store.js
/** Non-secret local target storage. */
const KEY = /^[A-Za-z0-9_-]{1,64}$/u;
const ALIAS = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/u;
function record(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
/** Reject extra fields so callers cannot persist credentials in a target record. */
function parseTarget(value) {
	if (!record(value) || Object.keys(value).sort().join(",") !== "endpoints,id,instanceId,instanceKey,name,profile,remotePort,workspaceHint") throw new Error("remote-workspace: invalid target fields");
	for (const key of ["id", "instanceKey"]) if (typeof value[key] !== "string" || !KEY.test(value[key])) throw new Error(`remote-workspace: invalid ${key}`);
	for (const key of [
		"name",
		"instanceId",
		"profile",
		"workspaceHint"
	]) if (typeof value[key] !== "string" || value[key].length > 4096 || key !== "workspaceHint" && value[key].length === 0) throw new Error(`remote-workspace: invalid ${key}`);
	if (!Number.isInteger(value.remotePort) || value.remotePort < 1 || value.remotePort > 65535) throw new Error("remote-workspace: invalid remotePort");
	if (!Array.isArray(value.endpoints) || value.endpoints.length < 1 || value.endpoints.length > 3) throw new Error("remote-workspace: invalid endpoints");
	const ids = /* @__PURE__ */ new Set();
	const endpoints = value.endpoints.map((entry) => {
		if (!record(entry) || Object.keys(entry).sort().join(",") !== "id,kind,sshAlias" || typeof entry.id !== "string" || !KEY.test(entry.id) || ids.has(entry.id) || ![
			"lan",
			"frp-tcp",
			"stcp"
		].includes(String(entry.kind)) || typeof entry.sshAlias !== "string" || !ALIAS.test(entry.sshAlias)) throw new Error("remote-workspace: invalid endpoint");
		ids.add(entry.id);
		return {
			id: entry.id,
			kind: entry.kind,
			sshAlias: entry.sshAlias
		};
	});
	return {
		id: value.id,
		name: value.name,
		instanceKey: value.instanceKey,
		instanceId: value.instanceId,
		profile: value.profile,
		workspaceHint: value.workspaceHint,
		remotePort: value.remotePort,
		endpoints
	};
}
/** Owns only non-sensitive target JSON beneath the current DSH home. */
var TargetStore = class {
	file;
	constructor(file) {
		this.file = file;
	}
	/** @returns validated records from the current file. */
	async list() {
		let raw;
		try {
			raw = await readFile(this.file, "utf8");
		} catch (error) {
			if (record(error) && error.code === "ENOENT") return [];
			throw error;
		}
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed) || parsed.length > 100) throw new Error("remote-workspace: invalid target file");
		return parsed.map(parseTarget);
	}
	/** @param value - full validated replacement target. @returns saved records. */
	async save(value) {
		const target = parseTarget(value);
		const targets = await this.list();
		const existing = targets.findIndex((item) => item.id === target.id);
		if (existing < 0) targets.push(target);
		else targets[existing] = target;
		await mkdir(dirname(this.file), { recursive: true });
		const temporary = `${this.file}.${randomUUID()}.tmp`;
		await writeFile(temporary, JSON.stringify(targets, null, 2) + "\n", {
			flag: "wx",
			mode: 384
		});
		await rename(temporary, this.file);
		return targets;
	}
};
//#endregion
//#region lib/types/aliases.js
/** Read literal OpenSSH Host aliases without exposing configuration or executing commands. */
/** Enumerate selectable Host aliases from the user config and its Include files.
* @param home - user home containing .ssh/config.
* @returns unique literal aliases; patterns and negated hosts are omitted.
*/
async function listSshAliases(home = homedir()) {
	const base = join(home, ".ssh");
	const visited = /* @__PURE__ */ new Set();
	const aliases = /* @__PURE__ */ new Set();
	let bytes = 0;
	async function read(path) {
		if (visited.has(path)) return;
		if (visited.size >= 64) throw new Error("remote-workspace: SSH config include limit");
		visited.add(path);
		let content;
		try {
			content = await readFile(path, "utf8");
		} catch (error) {
			if (error instanceof Error && "code" in error && error.code === "ENOENT") return;
			throw error;
		}
		bytes += Buffer.byteLength(content);
		if (bytes > 1048576) throw new Error("remote-workspace: SSH config size limit");
		let inMatch = false;
		for (const line of content.split(/\r?\n/u)) {
			const parts = line.replace(/^\s*(Host|Include|Match)\s*=/iu, "$1 ").match(/"[^"\r\n]*"|'[^'\r\n]*'|#[^\r\n]*|[^\s#]+/gu)?.filter((part) => !part.startsWith("#")).map((part) => part.replace(/^["']|["']$/gu, "")) ?? [];
			const key = parts.shift()?.toLowerCase();
			if (key === "match") inMatch = true;
			if (key === "host") {
				inMatch = false;
				for (const alias of parts) if (/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/u.test(alias)) aliases.add(alias);
			}
			if (key === "include" && !inMatch) for (const part of parts) {
				const expanded = part.startsWith("~/") ? join(home, part.slice(2)) : isAbsolute(part) ? part : resolve(base, part);
				for await (const match of glob(expanded.replaceAll("\\", "/"))) await read(match);
			}
		}
	}
	await read(join(base, "config"));
	return [...aliases].sort((a, b) => a.localeCompare(b));
}
//#endregion
//#region lib/types/index.js
/** Local Desktop Host control plane for one attached remote Harness. */
var __runInitializers = function(thisArg, initializers, value) {
	var useValue = arguments.length > 2;
	for (var i = 0; i < initializers.length; i++) value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
	return useValue ? value : void 0;
};
var __esDecorate = function(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
	function accept(f) {
		if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected");
		return f;
	}
	var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
	var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
	var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
	var _, done = false;
	for (var i = decorators.length - 1; i >= 0; i--) {
		var context = {};
		for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
		for (var p in contextIn.access) context.access[p] = contextIn.access[p];
		context.addInitializer = function(f) {
			if (done) throw new TypeError("Cannot add initializers after decoration has completed");
			extraInitializers.push(accept(f || null));
		};
		var result = (0, decorators[i])(kind === "accessor" ? {
			get: descriptor.get,
			set: descriptor.set
		} : descriptor[key], context);
		if (kind === "accessor") {
			if (result === void 0) continue;
			if (result === null || typeof result !== "object") throw new TypeError("Object expected");
			if (_ = accept(result.get)) descriptor.get = _;
			if (_ = accept(result.set)) descriptor.set = _;
			if (_ = accept(result.init)) initializers.unshift(_);
		} else if (_ = accept(result)) if (kind === "field") initializers.unshift(_);
		else descriptor[key] = _;
	}
	if (target) Object.defineProperty(target, contextIn.name, descriptor);
	done = true;
};
let RemoteWorkspaceController = (() => {
	let _classSuper = TypertRemoteService;
	let _instanceExtraInitializers = [];
	let _listTargets_decorators;
	let _listAliases_decorators;
	let _quickConnect_decorators;
	let _saveTarget_decorators;
	let _connect_decorators;
	let _getState_decorators;
	let _disconnect_decorators;
	let _createOpenTicket_decorators;
	let _inspectEndpoint_decorators;
	let _serviceAction_decorators;
	let _getServiceOperation_decorators;
	let _refreshAuthentication_decorators;
	let _watch_decorators;
	return class RemoteWorkspaceController extends _classSuper {
		static {
			const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
			_listTargets_decorators = [Remote];
			_listAliases_decorators = [Remote];
			_quickConnect_decorators = [Remote];
			_saveTarget_decorators = [Remote];
			_connect_decorators = [Remote];
			_getState_decorators = [Remote];
			_disconnect_decorators = [Remote];
			_createOpenTicket_decorators = [Remote];
			_inspectEndpoint_decorators = [Remote];
			_serviceAction_decorators = [Remote];
			_getServiceOperation_decorators = [Remote];
			_refreshAuthentication_decorators = [Remote];
			_watch_decorators = [Remote({ mode: "stream" })];
			__esDecorate(this, null, _listTargets_decorators, {
				kind: "method",
				name: "listTargets",
				static: false,
				private: false,
				access: {
					has: (obj) => "listTargets" in obj,
					get: (obj) => obj.listTargets
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _listAliases_decorators, {
				kind: "method",
				name: "listAliases",
				static: false,
				private: false,
				access: {
					has: (obj) => "listAliases" in obj,
					get: (obj) => obj.listAliases
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _quickConnect_decorators, {
				kind: "method",
				name: "quickConnect",
				static: false,
				private: false,
				access: {
					has: (obj) => "quickConnect" in obj,
					get: (obj) => obj.quickConnect
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _saveTarget_decorators, {
				kind: "method",
				name: "saveTarget",
				static: false,
				private: false,
				access: {
					has: (obj) => "saveTarget" in obj,
					get: (obj) => obj.saveTarget
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _connect_decorators, {
				kind: "method",
				name: "connect",
				static: false,
				private: false,
				access: {
					has: (obj) => "connect" in obj,
					get: (obj) => obj.connect
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _getState_decorators, {
				kind: "method",
				name: "getState",
				static: false,
				private: false,
				access: {
					has: (obj) => "getState" in obj,
					get: (obj) => obj.getState
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _disconnect_decorators, {
				kind: "method",
				name: "disconnect",
				static: false,
				private: false,
				access: {
					has: (obj) => "disconnect" in obj,
					get: (obj) => obj.disconnect
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _createOpenTicket_decorators, {
				kind: "method",
				name: "createOpenTicket",
				static: false,
				private: false,
				access: {
					has: (obj) => "createOpenTicket" in obj,
					get: (obj) => obj.createOpenTicket
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _inspectEndpoint_decorators, {
				kind: "method",
				name: "inspectEndpoint",
				static: false,
				private: false,
				access: {
					has: (obj) => "inspectEndpoint" in obj,
					get: (obj) => obj.inspectEndpoint
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _serviceAction_decorators, {
				kind: "method",
				name: "serviceAction",
				static: false,
				private: false,
				access: {
					has: (obj) => "serviceAction" in obj,
					get: (obj) => obj.serviceAction
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _getServiceOperation_decorators, {
				kind: "method",
				name: "getServiceOperation",
				static: false,
				private: false,
				access: {
					has: (obj) => "getServiceOperation" in obj,
					get: (obj) => obj.getServiceOperation
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _refreshAuthentication_decorators, {
				kind: "method",
				name: "refreshAuthentication",
				static: false,
				private: false,
				access: {
					has: (obj) => "refreshAuthentication" in obj,
					get: (obj) => obj.refreshAuthentication
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _watch_decorators, {
				kind: "method",
				name: "watch",
				static: false,
				private: false,
				access: {
					has: (obj) => "watch" in obj,
					get: (obj) => obj.watch
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			if (_metadata) Object.defineProperty(this, Symbol.metadata, {
				enumerable: true,
				configurable: true,
				writable: true,
				value: _metadata
			});
		}
		static Config = z.object({ helperPath: z.string().required() });
		manager = __runInitializers(this, _instanceExtraInitializers);
		/** @param ctx - Desktop Host Context. @param config - reviewed helper path. */
		constructor(ctx, config) {
			super(ctx, "remoteWorkspace", { namespace: "remoteWorkspace" });
			this.manager = new ConnectionManager(new TargetStore(join(ctx.profileContext.home, "remote-workspace", "targets.json")), config.helperPath);
			ctx.effect(() => () => this.manager.dispose(), "remote-workspace: local resource cleanup");
		}
		/**
		* Read configured remote attachment targets.
		* @returns all non-secret target records.
		*/
		listTargets() {
			return this.manager.listTargets();
		}
		/** Read selectable aliases from the user's OpenSSH configuration.
		* @returns literal Host names without credentials or SSH configuration content.
		*/
		listAliases() {
			return listSshAliases();
		}
		/** Discover, save and connect a target through strict OpenSSH verification.
		* @param sshAlias - configured SSH alias. @param instanceKey - Companion key.
		* @param operationId - idempotency key for this connection intent.
		* @returns authenticated connection state.
		*/
		quickConnect(sshAlias, instanceKey, operationId) {
			return this.manager.quickConnect(sshAlias, instanceKey, operationId);
		}
		/**
		* Persist one complete target without credentials.
		* @param target - complete non-secret record.
		* @returns saved target records.
		*/
		saveTarget(target) {
			return this.manager.saveTarget(target);
		}
		/**
		* Attach one target over a reviewed SSH alias.
		* @param targetId - stable target id.
		* @param endpointId - chosen LAN, TCP, or STCP endpoint.
		* @param operationId - idempotency key for this connect intent.
		* @returns connection state after authentication and event readiness.
		*/
		connect(targetId, endpointId, operationId) {
			return this.manager.connect(targetId, endpointId, operationId);
		}
		/**
		* Read the local attachment state.
		* @returns current local connection state without credentials.
		*/
		getState() {
			return this.manager.getState();
		}
		/**
		* Release local resources owned by one attachment.
		* @param connectionId - active local attachment.
		* @returns new state.
		*/
		disconnect(connectionId) {
			return this.manager.disconnect(connectionId);
		}
		/**
		* Issue a Browser ticket for the authenticated attachment.
		* @param connectionId - ready local attachment.
		* @returns one-use, short-lived local Browser URL.
		*/
		createOpenTicket(connectionId) {
			return this.manager.createOpenTicket(connectionId);
		}
		/**
		* Read-only preflight for a saved target or a first-time SSH alias.
		* Never saves a target and never starts a remote service.
		* @param ref - mutually exclusive endpoint reference.
		* @param operationId - idempotency key for this inspection.
		* @returns capability, service and layered diagnostic summary.
		*/
		inspectEndpoint(ref, operationId) {
			return this.manager.inspectEndpoint(ref, operationId);
		}
		/**
		* Submit exactly one restricted service action against the active attachment.
		* @param ref - endpoint the action applies to.
		* @param action - start, stop or restart.
		* @param operationId - idempotency key, reused when asking for the result.
		* @param issuedAt - ISO timestamp of the intent.
		* @param registrationRevision - revision the caller observed.
		* @param expectedInstanceId - pinned instance id, when known.
		* @returns the operation state, including a possible outcome-unknown.
		*/
		serviceAction(ref, action, operationId, issuedAt, registrationRevision, expectedInstanceId) {
			return this.manager.serviceAction(ref, action, operationId, issuedAt, registrationRevision, expectedInstanceId);
		}
		/**
		* Read a previously submitted action's result. Never submits a new action.
		* @param ref - endpoint the receipt belongs to.
		* @param operationId - the id used when the action was submitted.
		* @returns the recorded operation state.
		*/
		getServiceOperation(ref, operationId) {
			return this.manager.getServiceOperation(ref, operationId);
		}
		/**
		* Re-authenticate the active attachment without touching the remote service.
		* @param connectionId - active attachment.
		* @param operationId - idempotency key for this refresh.
		* @returns the new snapshot.
		*/
		refreshAuthentication(connectionId, operationId) {
			return this.manager.refreshAuthentication(connectionId, operationId);
		}
		/**
		* Observe attachment state until the caller cancels its stream.
		* @param signal - Remote stream lifetime.
		* @returns current state and later changes.
		*/
		watch(signal) {
			return this.manager.watch(signal);
		}
	};
})();
//#endregion
export { RemoteWorkspaceController as default };

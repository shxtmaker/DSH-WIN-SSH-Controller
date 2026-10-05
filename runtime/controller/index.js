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
	if (reply.status !== 303 || reply.headers.location !== "./") throw new Error("remote-workspace: remote authentication rejected");
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
	if (reply.status !== 200) throw new Error("remote-workspace: authenticated identity unavailable");
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
	"sec-fetch-site"
]);
const RESPONSE_DROP = new Set(["set-cookie", "set-cookie2"]);
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
	server;
	sockets = /* @__PURE__ */ new Set();
	ticketValues = /* @__PURE__ */ new Map();
	cookieName = `rw_${randomBytes(12).toString("hex")}`;
	cookieValue = token();
	portValue = 0;
	closed = false;
	paused = false;
	/**
	* @param upstreamPort - this plugin's SSH local-forward port.
	* @param remotePort - approved Harness authority port.
	* @param upstreamCookie - Host-only remote session Cookie.
	*/
	constructor(upstreamPort, remotePort, upstreamCookie) {
		this.upstreamPort = upstreamPort;
		this.remotePort = remotePort;
		this.upstreamCookie = upstreamCookie;
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
	reject(res, code) {
		res.writeHead(code, {
			"cache-control": "no-store",
			"content-type": "text/plain; charset=utf-8"
		});
		res.end("remote workspace access denied");
	}
	handle(req, res) {
		if (!this.trusted(req) || req.url === void 0 || !req.url.startsWith("/") || req.url.startsWith("//") || req.method === "CONNECT") {
			this.reject(res, 403);
			return;
		}
		if (this.paused) {
			this.reject(res, 503);
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
				this.reject(res, 403);
				return;
			}
			const value = req.headers["x-remote-ticket"];
			if (typeof value !== "string") {
				this.reject(res, 401);
				return;
			}
			const expiry = this.ticketValues.get(value);
			this.ticketValues.delete(value);
			if (expiry === void 0 || expiry < Date.now()) {
				this.reject(res, 401);
				return;
			}
			res.writeHead(204, {
				"cache-control": "no-store",
				"set-cookie": `${this.cookieName}=${this.cookieValue}; Max-Age=3600; Path=/; HttpOnly; SameSite=Strict`
			});
			res.end();
			return;
		}
		if (req.url.startsWith("/__remote/")) {
			this.reject(res, 404);
			return;
		}
		if (!this.authenticated(req)) {
			this.reject(res, 401);
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
			if (!res.headersSent) this.reject(res, 502);
			else res.destroy();
		});
		req.once("aborted", () => upstream.destroy());
		res.once("close", () => upstream.destroy());
		req.pipe(upstream);
	}
	upgrade(req, socket, head) {
		const path = req.url;
		if (this.paused || !this.trusted(req, true) || !this.authenticated(req) || path !== "/api/remote.mux" || req.headers.upgrade?.toLowerCase() !== "websocket" || typeof req.headers["sec-websocket-key"] !== "string") {
			socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
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
			if (/Host key verification failed|REMOTE HOST IDENTIFICATION HAS CHANGED/u.test(stderr)) throw new Error("remote-workspace: SSH_HOST_KEY");
			if (/Permission denied/u.test(stderr)) throw new Error("remote-workspace: SSH_AUTH");
			if (/Could not resolve hostname/u.test(stderr)) throw new Error("remote-workspace: SSH_ALIAS");
			if (/Connection refused|Connection timed out|No route to host/u.test(stderr)) throw new Error("remote-workspace: SSH_UNREACHABLE");
			if (/not found|No such file|BAD_INPUT|INFO_FAILED/u.test(stderr)) throw new Error("remote-workspace: SSH_HELPER");
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
//#endregion
//#region lib/types/manager.js
/** One-target connection state, generation fencing, and owned resource teardown. */
var IdentityMismatch = class extends Error {};
var AuthenticationRequired = class extends Error {};
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
		generation: 0
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
		this.publish({
			phase: "discovering",
			hostName: sshAlias,
			generation: this.state.generation + 1
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
			const info = await discoverTarget(sshAlias, instanceKey, this.helperPath, lifetime.signal);
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
				reason: this.failureReason(error)
			});
			throw error;
		} finally {
			if (this.pending === lifetime) this.pending = void 0;
			this.connecting = false;
			settled.resolve();
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
			retrying: false
		};
		this.current = active;
		this.publish({
			phase: "ssh-auth",
			connectionId: active.id,
			targetId: target.id,
			endpointId: endpoint.id,
			hostName: target.name,
			instanceId: target.instanceId,
			profile: target.profile,
			workspaceHint: target.workspaceHint,
			generation: this.state.generation + 1
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
					reason: this.failureReason(error)
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
			generation: this.state.generation + 1
		});
		return this.state;
	}
	/** @param connectionId - active attachment. @returns one-use, short-lived local URL. */
	createOpenTicket(connectionId) {
		const active = this.current;
		if (active === void 0 || active.id !== connectionId || this.state.phase !== "app-ready" || active.proxy === void 0) throw new Error("remote-workspace: connection is not ready");
		return active.proxy.openTicket();
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
	async attempt(active) {
		const signal = active.lifetime.signal;
		const generation = this.state.generation + 1;
		const identity = {
			connectionId: active.id,
			targetId: active.target.id,
			endpointId: active.endpoint.id,
			hostName: active.target.name,
			instanceId: active.target.instanceId,
			profile: active.target.profile,
			workspaceHint: active.target.workspaceHint,
			generation
		};
		this.publish({
			...identity,
			phase: active.retrying ? "reconnecting" : "discovering"
		});
		let ready = false;
		try {
			const descriptor = await discover(active.endpoint.sshAlias, active.target.instanceKey, this.helperPath, signal);
			signal.throwIfAborted();
			if (descriptor.instanceId !== active.target.instanceId || descriptor.instanceKey !== active.target.instanceKey || descriptor.port !== active.target.remotePort || descriptor.profile !== active.target.profile) throw new IdentityMismatch("remote-workspace: configured instance identity mismatch");
			this.publish({
				...identity,
				phase: "forwarding",
				bootId: descriptor.bootId
			});
			active.forward = await forward(active.endpoint.sshAlias, active.target.remotePort, signal);
			signal.throwIfAborted();
			this.publish({
				...identity,
				phase: "authenticating",
				bootId: descriptor.bootId
			});
			let cookie;
			try {
				cookie = await authenticate(active.forward.port, active.target.remotePort, descriptor);
			} catch {
				throw new AuthenticationRequired("remote-workspace: remote authentication failed");
			}
			signal.throwIfAborted();
			const live = await readIdentity(active.forward.port, active.target.remotePort, cookie);
			if (live.instanceId !== descriptor.instanceId || live.bootId !== descriptor.bootId || live.instanceKey !== descriptor.instanceKey || live.profile !== descriptor.profile) throw new IdentityMismatch("remote-workspace: authenticated instance identity mismatch");
			await probeEventStream(active.forward.port, active.target.remotePort, cookie);
			signal.throwIfAborted();
			if (active.proxy === void 0) {
				active.proxy = new AuthProxy(active.forward.port, active.target.remotePort, cookie);
				await active.proxy.start();
			} else active.proxy.resume(active.forward.port, cookie);
			signal.throwIfAborted();
			this.publish({
				...identity,
				phase: "app-ready",
				bootId: live.bootId,
				workspaceHint: live.workspaceHint
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
	async lost(active) {
		if (active.retrying || this.current !== active) return;
		active.retrying = true;
		await this.release(active, true);
		if (this.current !== active) return;
		this.publish({
			...this.state,
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
				this.publish({
					...this.state,
					phase,
					reason: this.failureReason(error)
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
		await Promise.all([keepProxy ? void 0 : proxy?.stop(), ssh?.stop()]);
	}
	failurePhase(error) {
		if (error instanceof IdentityMismatch) return "identity-mismatch";
		if (error instanceof AuthenticationRequired) return "auth-required";
		return "error";
	}
	failureReason(error) {
		if (error instanceof IdentityMismatch || error instanceof AuthenticationRequired) return error.message;
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

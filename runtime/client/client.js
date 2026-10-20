window.__ModuleLoader__.load({
	id: "dsh-win-ssh-controller-source",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let zod = require("zod");
		let react = require("react");
		//#region ../../typert/protocol/lib/types/remote-info.js
		/** Lazy assembly of generated Remote definitions using caller-supplied Zod; no runtime imports. */
		/**
		* Retain one generated definition per endpoint without constructing parsers or projections.
		* The class instance builds its shared descriptor/method index on first access;
		* input schemas and JSON Schema projections are cached only when requested.
		* @param spec - compiler-produced method facts and Zod factories.
		* @param zod - the generated artifact's Zod runtime for named-input parsers.
		* @returns a lazy, mountable info instance with no registration or transport effects.
		*/
		function createTypertRemoteInfo(spec, zod) {
			return new RemoteInfo(spec, zod);
		}
		var RemoteInfo = class {
			spec;
			zod;
			index;
			constructor(spec, zod) {
				this.spec = spec;
				this.zod = zod;
			}
			get package() {
				return this.spec.package;
			}
			get descriptors() {
				return this.resolve().descriptors;
			}
			get methods() {
				return this.resolve().methods;
			}
			resolve() {
				if (this.index !== void 0) return this.index;
				const zod = this.zod;
				const descriptors = [];
				const methods = Object.create(null);
				for (const [endpoint, definition] of Object.entries(this.spec.methods)) {
					const separator = endpoint.indexOf("/");
					const namespace = endpoint.slice(0, separator);
					const method = endpoint.slice(separator + 1);
					const parameters = definition.parameters.map((parameter) => ({
						...parameter,
						wire: parameter.wire ?? parameter.name
					}));
					const descriptor = {
						...definition,
						id: `${this.spec.package}#${endpoint}`,
						namespace,
						method,
						parameters,
						result: definition.result.description === void 0 ? definition.result : new ResultValue(definition.result)
					};
					if (definition.invocation.kind === "direct") {
						const inputs = [];
						methods[endpoint] = Object.assign(descriptor, {
							input(options) {
								const strict = options?.strict === true;
								return inputs[strict ? 1 : 0] ??= new NamedInput(parameters, strict, zod);
							},
							invoke(remote, input, signal) {
								const named = input;
								const values = parameters.map((parameter) => named[parameter.wire]);
								if (definition.cancellation !== void 0) values.push(signal);
								const receiver = Reflect.get(remote, namespace);
								return Reflect.get(receiver, method).apply(receiver, values);
							}
						});
					}
					descriptors.push(descriptor);
				}
				return this.index = {
					descriptors,
					methods
				};
			}
		};
		function optional(parameter) {
			return parameter.source === "json" && parameter.acceptsUndefined === true;
		}
		var NamedInput = class {
			parameters;
			strict;
			zod;
			schema;
			projection;
			constructor(parameters, strict, zod) {
				this.parameters = parameters;
				this.strict = strict;
				this.zod = zod;
			}
			codec(parameter) {
				return this.strict ? parameter.strictCodec : parameter.codec;
			}
			create = () => this.schema ??= this.zod.strictObject(Object.fromEntries(this.parameters.map((parameter) => {
				const value = this.codec(parameter).create();
				return [parameter.wire, optional(parameter) ? value.optional() : value.nonoptional()];
			})));
			get jsonSchema() {
				return this.project().jsonSchema;
			}
			get jsonSchemaError() {
				return this.project().jsonSchemaError;
			}
			project() {
				if (this.projection !== void 0) return this.projection;
				const unavailable = this.parameters.find((parameter) => this.codec(parameter).jsonSchema === void 0);
				if (unavailable !== void 0) return this.projection = { jsonSchemaError: this.codec(unavailable).jsonSchemaError ?? `No JSON Schema for parameter ${unavailable.wire}` };
				return this.projection = { jsonSchema: {
					type: "object",
					properties: Object.fromEntries(this.parameters.map((parameter) => [parameter.wire, {
						...this.codec(parameter).jsonSchema,
						...parameter.description === void 0 ? {} : { description: parameter.description }
					}])),
					required: this.parameters.filter((parameter) => !optional(parameter)).map((parameter) => parameter.wire),
					additionalProperties: false
				} };
			}
		};
		var ResultValue = class {
			spec;
			projection;
			constructor(spec) {
				this.spec = spec;
			}
			get mode() {
				return this.spec.mode;
			}
			get typeSymbol() {
				return this.spec.typeSymbol;
			}
			get create() {
				return this.spec.create;
			}
			get decode() {
				return this.spec.decode;
			}
			get encode() {
				return this.spec.encode;
			}
			get description() {
				return this.spec.description;
			}
			get jsonSchemaError() {
				return this.spec.jsonSchemaError;
			}
			get jsonSchema() {
				if (this.projection === void 0) {
					const schema = this.spec.jsonSchema;
					this.projection = { value: schema === void 0 ? void 0 : {
						...schema,
						description: this.spec.description
					} };
				}
				return this.projection.value;
			}
		};
		//#endregion
		//#region ../controller/lib/typert.remote-client.js
		let _harness_remote_controller_remoteWorkspace_connect_parameter_0$schema$value;
		const _harness_remote_controller_remoteWorkspace_connect_parameter_0$schema = () => _harness_remote_controller_remoteWorkspace_connect_parameter_0$schema$value ??= zod.z.string();
		let _harness_remote_controller_remoteWorkspace_connect_parameter_1$schema$value;
		const _harness_remote_controller_remoteWorkspace_connect_parameter_1$schema = () => _harness_remote_controller_remoteWorkspace_connect_parameter_1$schema$value ??= zod.z.string();
		let _harness_remote_controller_remoteWorkspace_connect_parameter_2$schema$value;
		const _harness_remote_controller_remoteWorkspace_connect_parameter_2$schema = () => _harness_remote_controller_remoteWorkspace_connect_parameter_2$schema$value ??= zod.z.string();
		let _harness_remote_controller_remoteWorkspace_connect_result$schema$value;
		const _harness_remote_controller_remoteWorkspace_connect_result$schema = () => _harness_remote_controller_remoteWorkspace_connect_result$schema$value ??= zod.z.object({
			"phase": zod.z.union([
				zod.z.literal("error"),
				zod.z.literal("checking"),
				zod.z.literal("idle"),
				zod.z.literal("ssh-auth"),
				zod.z.literal("discovering"),
				zod.z.literal("forwarding"),
				zod.z.literal("authenticating"),
				zod.z.literal("verifying"),
				zod.z.literal("app-ready"),
				zod.z.literal("disconnected"),
				zod.z.literal("reconnecting"),
				zod.z.literal("identity-mismatch"),
				zod.z.literal("auth-required"),
				zod.z.literal("service-stopped")
			]).readonly(),
			"connectionId": zod.z.union([zod.z.undefined(), zod.z.string()]).readonly().optional(),
			"targetId": zod.z.string().readonly().optional(),
			"endpointId": zod.z.string().readonly().optional(),
			"hostName": zod.z.string().readonly().optional(),
			"instanceId": zod.z.string().readonly().optional(),
			"bootId": zod.z.string().readonly().optional(),
			"profile": zod.z.string().readonly().optional(),
			"workspaceHint": zod.z.string().readonly().optional(),
			"generation": zod.z.number().readonly(),
			"reason": zod.z.string().readonly().optional(),
			"diagnostics": zod.z.array(zod.z.object({
				"name": zod.z.union([
					zod.z.literal("ssh"),
					zod.z.literal("helper"),
					zod.z.literal("service"),
					zod.z.literal("descriptor"),
					zod.z.literal("listener"),
					zod.z.literal("identity"),
					zod.z.literal("authentication"),
					zod.z.literal("events"),
					zod.z.literal("application")
				]).readonly(),
				"state": zod.z.union([
					zod.z.literal("failed"),
					zod.z.literal("unknown"),
					zod.z.literal("checking"),
					zod.z.literal("ok"),
					zod.z.literal("unsupported")
				]).readonly(),
				"code": zod.z.union([
					zod.z.literal("SSH_UNAVAILABLE"),
					zod.z.literal("SSH_AUTH_FAILED"),
					zod.z.literal("HOST_KEY_REJECTED"),
					zod.z.literal("SSH_TIMEOUT"),
					zod.z.literal("HELPER_NOT_FOUND"),
					zod.z.literal("HELPER_UNSAFE"),
					zod.z.literal("HELPER_BAD_CONFIG"),
					zod.z.literal("CONTROL_UNSUPPORTED"),
					zod.z.literal("SERVICE_UNREGISTERED"),
					zod.z.literal("SERVICE_STOPPED"),
					zod.z.literal("SERVICE_FAILED"),
					zod.z.literal("USER_MANAGER_UNAVAILABLE"),
					zod.z.literal("DESCRIPTOR_MISSING"),
					zod.z.literal("DESCRIPTOR_INVALID"),
					zod.z.literal("DESCRIPTOR_STALE"),
					zod.z.literal("UNSUPPORTED_WEB_TRANSPORT"),
					zod.z.literal("LOCAL_AUTH_REQUIRED"),
					zod.z.literal("UPSTREAM_AUTH_REQUIRED"),
					zod.z.literal("IDENTITY_MISMATCH"),
					zod.z.literal("APPLICATION_NOT_READY"),
					zod.z.literal("UPSTREAM_UNREACHABLE"),
					zod.z.literal("REGISTRATION_STALE"),
					zod.z.literal("OPERATION_CONFLICT"),
					zod.z.literal("OPERATION_EXPIRED"),
					zod.z.literal("OUTCOME_UNKNOWN"),
					zod.z.literal("BAD_INPUT"),
					zod.z.literal("CONFIG_REQUIRED"),
					zod.z.literal("UNSAFE_PATH"),
					zod.z.literal("UNSAFE_FILE"),
					zod.z.literal("LINUX_REQUIRED"),
					zod.z.literal("CONTROL_FAILED"),
					zod.z.literal("FORBIDDEN"),
					zod.z.literal("NOT_FOUND"),
					zod.z.literal("PROXY_PAUSED")
				]).readonly().optional(),
				"checkedAt": zod.z.string().readonly()
			})).readonly().describe("One entry per named check; `unknown` is never rendered as healthy."),
			"capabilities": zod.z.union([zod.z.undefined(), zod.z.object({
				"controlVersion": zod.z.number().readonly(),
				"helperVersion": zod.z.string().readonly(),
				"mode": zod.z.union([
					zod.z.literal("unsupported"),
					zod.z.literal("systemd-user"),
					zod.z.literal("unregistered")
				]).readonly(),
				"actions": zod.z.array(zod.z.string()).readonly()
			})]).readonly().optional(),
			"service": zod.z.union([zod.z.undefined(), zod.z.object({
				"unit": zod.z.string().readonly(),
				"state": zod.z.union([
					zod.z.literal("failed"),
					zod.z.literal("unknown"),
					zod.z.literal("active"),
					zod.z.literal("inactive"),
					zod.z.literal("activating"),
					zod.z.literal("deactivating")
				]).readonly(),
				"registered": zod.z.boolean().readonly(),
				"registrationRevision": zod.z.union([zod.z.undefined(), zod.z.string()]).readonly().optional().describe("Registration revision observed from the remote helper's `status`. A write action must echo the revision the helper reported, otherwise the helper answers REGISTRATION_STALE. Absent when the helper never reported one, so the caller can tell \"unknown\" from a real value.")
			})]).readonly().optional(),
			"serviceOperation": zod.z.union([zod.z.undefined(), zod.z.object({
				"phase": zod.z.union([
					zod.z.literal("failed"),
					zod.z.literal("completed"),
					zod.z.literal("waiting"),
					zod.z.literal("idle"),
					zod.z.literal("submitting"),
					zod.z.literal("outcome-unknown")
				]).readonly(),
				"action": zod.z.union([
					zod.z.undefined(),
					zod.z.literal("start"),
					zod.z.literal("stop"),
					zod.z.literal("restart")
				]).readonly().optional(),
				"operationId": zod.z.union([zod.z.undefined(), zod.z.string()]).readonly().optional(),
				"code": zod.z.union([
					zod.z.undefined(),
					zod.z.literal("SSH_UNAVAILABLE"),
					zod.z.literal("SSH_AUTH_FAILED"),
					zod.z.literal("HOST_KEY_REJECTED"),
					zod.z.literal("SSH_TIMEOUT"),
					zod.z.literal("HELPER_NOT_FOUND"),
					zod.z.literal("HELPER_UNSAFE"),
					zod.z.literal("HELPER_BAD_CONFIG"),
					zod.z.literal("CONTROL_UNSUPPORTED"),
					zod.z.literal("SERVICE_UNREGISTERED"),
					zod.z.literal("SERVICE_STOPPED"),
					zod.z.literal("SERVICE_FAILED"),
					zod.z.literal("USER_MANAGER_UNAVAILABLE"),
					zod.z.literal("DESCRIPTOR_MISSING"),
					zod.z.literal("DESCRIPTOR_INVALID"),
					zod.z.literal("DESCRIPTOR_STALE"),
					zod.z.literal("UNSUPPORTED_WEB_TRANSPORT"),
					zod.z.literal("LOCAL_AUTH_REQUIRED"),
					zod.z.literal("UPSTREAM_AUTH_REQUIRED"),
					zod.z.literal("IDENTITY_MISMATCH"),
					zod.z.literal("APPLICATION_NOT_READY"),
					zod.z.literal("UPSTREAM_UNREACHABLE"),
					zod.z.literal("REGISTRATION_STALE"),
					zod.z.literal("OPERATION_CONFLICT"),
					zod.z.literal("OPERATION_EXPIRED"),
					zod.z.literal("OUTCOME_UNKNOWN"),
					zod.z.literal("BAD_INPUT"),
					zod.z.literal("CONFIG_REQUIRED"),
					zod.z.literal("UNSAFE_PATH"),
					zod.z.literal("UNSAFE_FILE"),
					zod.z.literal("LINUX_REQUIRED"),
					zod.z.literal("CONTROL_FAILED"),
					zod.z.literal("FORBIDDEN"),
					zod.z.literal("NOT_FOUND"),
					zod.z.literal("PROXY_PAUSED")
				]).readonly().optional(),
				"startedAt": zod.z.union([zod.z.undefined(), zod.z.string()]).readonly().optional(),
				"finishedAt": zod.z.union([zod.z.undefined(), zod.z.string()]).readonly().optional()
			})]).readonly().optional(),
			"accessWarning": zod.z.union([
				zod.z.undefined(),
				zod.z.literal("SSH_UNAVAILABLE"),
				zod.z.literal("SSH_AUTH_FAILED"),
				zod.z.literal("HOST_KEY_REJECTED"),
				zod.z.literal("SSH_TIMEOUT"),
				zod.z.literal("HELPER_NOT_FOUND"),
				zod.z.literal("HELPER_UNSAFE"),
				zod.z.literal("HELPER_BAD_CONFIG"),
				zod.z.literal("CONTROL_UNSUPPORTED"),
				zod.z.literal("SERVICE_UNREGISTERED"),
				zod.z.literal("SERVICE_STOPPED"),
				zod.z.literal("SERVICE_FAILED"),
				zod.z.literal("USER_MANAGER_UNAVAILABLE"),
				zod.z.literal("DESCRIPTOR_MISSING"),
				zod.z.literal("DESCRIPTOR_INVALID"),
				zod.z.literal("DESCRIPTOR_STALE"),
				zod.z.literal("UNSUPPORTED_WEB_TRANSPORT"),
				zod.z.literal("LOCAL_AUTH_REQUIRED"),
				zod.z.literal("UPSTREAM_AUTH_REQUIRED"),
				zod.z.literal("IDENTITY_MISMATCH"),
				zod.z.literal("APPLICATION_NOT_READY"),
				zod.z.literal("UPSTREAM_UNREACHABLE"),
				zod.z.literal("REGISTRATION_STALE"),
				zod.z.literal("OPERATION_CONFLICT"),
				zod.z.literal("OPERATION_EXPIRED"),
				zod.z.literal("OUTCOME_UNKNOWN"),
				zod.z.literal("BAD_INPUT"),
				zod.z.literal("CONFIG_REQUIRED"),
				zod.z.literal("UNSAFE_PATH"),
				zod.z.literal("UNSAFE_FILE"),
				zod.z.literal("LINUX_REQUIRED"),
				zod.z.literal("CONTROL_FAILED"),
				zod.z.literal("FORBIDDEN"),
				zod.z.literal("NOT_FOUND"),
				zod.z.literal("PROXY_PAUSED")
			]).readonly().optional().describe("Fixed code when a browser page lost its local authorization; never a credential.")
		});
		let _harness_remote_controller_remoteWorkspace_createOpenTicket_parameter_0$schema$value;
		const _harness_remote_controller_remoteWorkspace_createOpenTicket_parameter_0$schema = () => _harness_remote_controller_remoteWorkspace_createOpenTicket_parameter_0$schema$value ??= zod.z.string();
		let _harness_remote_controller_remoteWorkspace_createOpenTicket_result$schema$value;
		const _harness_remote_controller_remoteWorkspace_createOpenTicket_result$schema = () => _harness_remote_controller_remoteWorkspace_createOpenTicket_result$schema$value ??= zod.z.string();
		let _harness_remote_controller_remoteWorkspace_disconnect_parameter_0$schema$value;
		const _harness_remote_controller_remoteWorkspace_disconnect_parameter_0$schema = () => _harness_remote_controller_remoteWorkspace_disconnect_parameter_0$schema$value ??= zod.z.string();
		let _harness_remote_controller_remoteWorkspace_disconnect_result$schema$value;
		const _harness_remote_controller_remoteWorkspace_disconnect_result$schema = () => _harness_remote_controller_remoteWorkspace_disconnect_result$schema$value ??= zod.z.object({
			"phase": zod.z.union([
				zod.z.literal("error"),
				zod.z.literal("checking"),
				zod.z.literal("idle"),
				zod.z.literal("ssh-auth"),
				zod.z.literal("discovering"),
				zod.z.literal("forwarding"),
				zod.z.literal("authenticating"),
				zod.z.literal("verifying"),
				zod.z.literal("app-ready"),
				zod.z.literal("disconnected"),
				zod.z.literal("reconnecting"),
				zod.z.literal("identity-mismatch"),
				zod.z.literal("auth-required"),
				zod.z.literal("service-stopped")
			]).readonly(),
			"connectionId": zod.z.union([zod.z.undefined(), zod.z.string()]).readonly().optional(),
			"targetId": zod.z.string().readonly().optional(),
			"endpointId": zod.z.string().readonly().optional(),
			"hostName": zod.z.string().readonly().optional(),
			"instanceId": zod.z.string().readonly().optional(),
			"bootId": zod.z.string().readonly().optional(),
			"profile": zod.z.string().readonly().optional(),
			"workspaceHint": zod.z.string().readonly().optional(),
			"generation": zod.z.number().readonly(),
			"reason": zod.z.string().readonly().optional(),
			"diagnostics": zod.z.array(zod.z.object({
				"name": zod.z.union([
					zod.z.literal("ssh"),
					zod.z.literal("helper"),
					zod.z.literal("service"),
					zod.z.literal("descriptor"),
					zod.z.literal("listener"),
					zod.z.literal("identity"),
					zod.z.literal("authentication"),
					zod.z.literal("events"),
					zod.z.literal("application")
				]).readonly(),
				"state": zod.z.union([
					zod.z.literal("failed"),
					zod.z.literal("unknown"),
					zod.z.literal("checking"),
					zod.z.literal("ok"),
					zod.z.literal("unsupported")
				]).readonly(),
				"code": zod.z.union([
					zod.z.literal("SSH_UNAVAILABLE"),
					zod.z.literal("SSH_AUTH_FAILED"),
					zod.z.literal("HOST_KEY_REJECTED"),
					zod.z.literal("SSH_TIMEOUT"),
					zod.z.literal("HELPER_NOT_FOUND"),
					zod.z.literal("HELPER_UNSAFE"),
					zod.z.literal("HELPER_BAD_CONFIG"),
					zod.z.literal("CONTROL_UNSUPPORTED"),
					zod.z.literal("SERVICE_UNREGISTERED"),
					zod.z.literal("SERVICE_STOPPED"),
					zod.z.literal("SERVICE_FAILED"),
					zod.z.literal("USER_MANAGER_UNAVAILABLE"),
					zod.z.literal("DESCRIPTOR_MISSING"),
					zod.z.literal("DESCRIPTOR_INVALID"),
					zod.z.literal("DESCRIPTOR_STALE"),
					zod.z.literal("UNSUPPORTED_WEB_TRANSPORT"),
					zod.z.literal("LOCAL_AUTH_REQUIRED"),
					zod.z.literal("UPSTREAM_AUTH_REQUIRED"),
					zod.z.literal("IDENTITY_MISMATCH"),
					zod.z.literal("APPLICATION_NOT_READY"),
					zod.z.literal("UPSTREAM_UNREACHABLE"),
					zod.z.literal("REGISTRATION_STALE"),
					zod.z.literal("OPERATION_CONFLICT"),
					zod.z.literal("OPERATION_EXPIRED"),
					zod.z.literal("OUTCOME_UNKNOWN"),
					zod.z.literal("BAD_INPUT"),
					zod.z.literal("CONFIG_REQUIRED"),
					zod.z.literal("UNSAFE_PATH"),
					zod.z.literal("UNSAFE_FILE"),
					zod.z.literal("LINUX_REQUIRED"),
					zod.z.literal("CONTROL_FAILED"),
					zod.z.literal("FORBIDDEN"),
					zod.z.literal("NOT_FOUND"),
					zod.z.literal("PROXY_PAUSED")
				]).readonly().optional(),
				"checkedAt": zod.z.string().readonly()
			})).readonly().describe("One entry per named check; `unknown` is never rendered as healthy."),
			"capabilities": zod.z.union([zod.z.undefined(), zod.z.object({
				"controlVersion": zod.z.number().readonly(),
				"helperVersion": zod.z.string().readonly(),
				"mode": zod.z.union([
					zod.z.literal("unsupported"),
					zod.z.literal("systemd-user"),
					zod.z.literal("unregistered")
				]).readonly(),
				"actions": zod.z.array(zod.z.string()).readonly()
			})]).readonly().optional(),
			"service": zod.z.union([zod.z.undefined(), zod.z.object({
				"unit": zod.z.string().readonly(),
				"state": zod.z.union([
					zod.z.literal("failed"),
					zod.z.literal("unknown"),
					zod.z.literal("active"),
					zod.z.literal("inactive"),
					zod.z.literal("activating"),
					zod.z.literal("deactivating")
				]).readonly(),
				"registered": zod.z.boolean().readonly(),
				"registrationRevision": zod.z.union([zod.z.undefined(), zod.z.string()]).readonly().optional().describe("Registration revision observed from the remote helper's `status`. A write action must echo the revision the helper reported, otherwise the helper answers REGISTRATION_STALE. Absent when the helper never reported one, so the caller can tell \"unknown\" from a real value.")
			})]).readonly().optional(),
			"serviceOperation": zod.z.union([zod.z.undefined(), zod.z.object({
				"phase": zod.z.union([
					zod.z.literal("failed"),
					zod.z.literal("completed"),
					zod.z.literal("waiting"),
					zod.z.literal("idle"),
					zod.z.literal("submitting"),
					zod.z.literal("outcome-unknown")
				]).readonly(),
				"action": zod.z.union([
					zod.z.undefined(),
					zod.z.literal("start"),
					zod.z.literal("stop"),
					zod.z.literal("restart")
				]).readonly().optional(),
				"operationId": zod.z.union([zod.z.undefined(), zod.z.string()]).readonly().optional(),
				"code": zod.z.union([
					zod.z.undefined(),
					zod.z.literal("SSH_UNAVAILABLE"),
					zod.z.literal("SSH_AUTH_FAILED"),
					zod.z.literal("HOST_KEY_REJECTED"),
					zod.z.literal("SSH_TIMEOUT"),
					zod.z.literal("HELPER_NOT_FOUND"),
					zod.z.literal("HELPER_UNSAFE"),
					zod.z.literal("HELPER_BAD_CONFIG"),
					zod.z.literal("CONTROL_UNSUPPORTED"),
					zod.z.literal("SERVICE_UNREGISTERED"),
					zod.z.literal("SERVICE_STOPPED"),
					zod.z.literal("SERVICE_FAILED"),
					zod.z.literal("USER_MANAGER_UNAVAILABLE"),
					zod.z.literal("DESCRIPTOR_MISSING"),
					zod.z.literal("DESCRIPTOR_INVALID"),
					zod.z.literal("DESCRIPTOR_STALE"),
					zod.z.literal("UNSUPPORTED_WEB_TRANSPORT"),
					zod.z.literal("LOCAL_AUTH_REQUIRED"),
					zod.z.literal("UPSTREAM_AUTH_REQUIRED"),
					zod.z.literal("IDENTITY_MISMATCH"),
					zod.z.literal("APPLICATION_NOT_READY"),
					zod.z.literal("UPSTREAM_UNREACHABLE"),
					zod.z.literal("REGISTRATION_STALE"),
					zod.z.literal("OPERATION_CONFLICT"),
					zod.z.literal("OPERATION_EXPIRED"),
					zod.z.literal("OUTCOME_UNKNOWN"),
					zod.z.literal("BAD_INPUT"),
					zod.z.literal("CONFIG_REQUIRED"),
					zod.z.literal("UNSAFE_PATH"),
					zod.z.literal("UNSAFE_FILE"),
					zod.z.literal("LINUX_REQUIRED"),
					zod.z.literal("CONTROL_FAILED"),
					zod.z.literal("FORBIDDEN"),
					zod.z.literal("NOT_FOUND"),
					zod.z.literal("PROXY_PAUSED")
				]).readonly().optional(),
				"startedAt": zod.z.union([zod.z.undefined(), zod.z.string()]).readonly().optional(),
				"finishedAt": zod.z.union([zod.z.undefined(), zod.z.string()]).readonly().optional()
			})]).readonly().optional(),
			"accessWarning": zod.z.union([
				zod.z.undefined(),
				zod.z.literal("SSH_UNAVAILABLE"),
				zod.z.literal("SSH_AUTH_FAILED"),
				zod.z.literal("HOST_KEY_REJECTED"),
				zod.z.literal("SSH_TIMEOUT"),
				zod.z.literal("HELPER_NOT_FOUND"),
				zod.z.literal("HELPER_UNSAFE"),
				zod.z.literal("HELPER_BAD_CONFIG"),
				zod.z.literal("CONTROL_UNSUPPORTED"),
				zod.z.literal("SERVICE_UNREGISTERED"),
				zod.z.literal("SERVICE_STOPPED"),
				zod.z.literal("SERVICE_FAILED"),
				zod.z.literal("USER_MANAGER_UNAVAILABLE"),
				zod.z.literal("DESCRIPTOR_MISSING"),
				zod.z.literal("DESCRIPTOR_INVALID"),
				zod.z.literal("DESCRIPTOR_STALE"),
				zod.z.literal("UNSUPPORTED_WEB_TRANSPORT"),
				zod.z.literal("LOCAL_AUTH_REQUIRED"),
				zod.z.literal("UPSTREAM_AUTH_REQUIRED"),
				zod.z.literal("IDENTITY_MISMATCH"),
				zod.z.literal("APPLICATION_NOT_READY"),
				zod.z.literal("UPSTREAM_UNREACHABLE"),
				zod.z.literal("REGISTRATION_STALE"),
				zod.z.literal("OPERATION_CONFLICT"),
				zod.z.literal("OPERATION_EXPIRED"),
				zod.z.literal("OUTCOME_UNKNOWN"),
				zod.z.literal("BAD_INPUT"),
				zod.z.literal("CONFIG_REQUIRED"),
				zod.z.literal("UNSAFE_PATH"),
				zod.z.literal("UNSAFE_FILE"),
				zod.z.literal("LINUX_REQUIRED"),
				zod.z.literal("CONTROL_FAILED"),
				zod.z.literal("FORBIDDEN"),
				zod.z.literal("NOT_FOUND"),
				zod.z.literal("PROXY_PAUSED")
			]).readonly().optional().describe("Fixed code when a browser page lost its local authorization; never a credential.")
		});
		let _harness_remote_controller_remoteWorkspace_getServiceOperation_parameter_0$schema$value;
		const _harness_remote_controller_remoteWorkspace_getServiceOperation_parameter_0$schema = () => _harness_remote_controller_remoteWorkspace_getServiceOperation_parameter_0$schema$value ??= zod.z.union([zod.z.object({
			"targetId": zod.z.string().readonly(),
			"endpointId": zod.z.string().readonly()
		}), zod.z.object({
			"sshAlias": zod.z.string().readonly(),
			"instanceKey": zod.z.string().readonly()
		})]);
		let _harness_remote_controller_remoteWorkspace_getServiceOperation_parameter_1$schema$value;
		const _harness_remote_controller_remoteWorkspace_getServiceOperation_parameter_1$schema = () => _harness_remote_controller_remoteWorkspace_getServiceOperation_parameter_1$schema$value ??= zod.z.string();
		let _harness_remote_controller_remoteWorkspace_getServiceOperation_result$schema$value;
		const _harness_remote_controller_remoteWorkspace_getServiceOperation_result$schema = () => _harness_remote_controller_remoteWorkspace_getServiceOperation_result$schema$value ??= zod.z.object({
			"phase": zod.z.union([
				zod.z.literal("failed"),
				zod.z.literal("completed"),
				zod.z.literal("waiting"),
				zod.z.literal("idle"),
				zod.z.literal("submitting"),
				zod.z.literal("outcome-unknown")
			]).readonly(),
			"action": zod.z.union([
				zod.z.undefined(),
				zod.z.literal("start"),
				zod.z.literal("stop"),
				zod.z.literal("restart")
			]).readonly().optional(),
			"operationId": zod.z.union([zod.z.undefined(), zod.z.string()]).readonly().optional(),
			"code": zod.z.union([
				zod.z.undefined(),
				zod.z.literal("SSH_UNAVAILABLE"),
				zod.z.literal("SSH_AUTH_FAILED"),
				zod.z.literal("HOST_KEY_REJECTED"),
				zod.z.literal("SSH_TIMEOUT"),
				zod.z.literal("HELPER_NOT_FOUND"),
				zod.z.literal("HELPER_UNSAFE"),
				zod.z.literal("HELPER_BAD_CONFIG"),
				zod.z.literal("CONTROL_UNSUPPORTED"),
				zod.z.literal("SERVICE_UNREGISTERED"),
				zod.z.literal("SERVICE_STOPPED"),
				zod.z.literal("SERVICE_FAILED"),
				zod.z.literal("USER_MANAGER_UNAVAILABLE"),
				zod.z.literal("DESCRIPTOR_MISSING"),
				zod.z.literal("DESCRIPTOR_INVALID"),
				zod.z.literal("DESCRIPTOR_STALE"),
				zod.z.literal("UNSUPPORTED_WEB_TRANSPORT"),
				zod.z.literal("LOCAL_AUTH_REQUIRED"),
				zod.z.literal("UPSTREAM_AUTH_REQUIRED"),
				zod.z.literal("IDENTITY_MISMATCH"),
				zod.z.literal("APPLICATION_NOT_READY"),
				zod.z.literal("UPSTREAM_UNREACHABLE"),
				zod.z.literal("REGISTRATION_STALE"),
				zod.z.literal("OPERATION_CONFLICT"),
				zod.z.literal("OPERATION_EXPIRED"),
				zod.z.literal("OUTCOME_UNKNOWN"),
				zod.z.literal("BAD_INPUT"),
				zod.z.literal("CONFIG_REQUIRED"),
				zod.z.literal("UNSAFE_PATH"),
				zod.z.literal("UNSAFE_FILE"),
				zod.z.literal("LINUX_REQUIRED"),
				zod.z.literal("CONTROL_FAILED"),
				zod.z.literal("FORBIDDEN"),
				zod.z.literal("NOT_FOUND"),
				zod.z.literal("PROXY_PAUSED")
			]).readonly().optional(),
			"startedAt": zod.z.union([zod.z.undefined(), zod.z.string()]).readonly().optional(),
			"finishedAt": zod.z.union([zod.z.undefined(), zod.z.string()]).readonly().optional()
		});
		let _harness_remote_controller_remoteWorkspace_getState_result$schema$value;
		const _harness_remote_controller_remoteWorkspace_getState_result$schema = () => _harness_remote_controller_remoteWorkspace_getState_result$schema$value ??= zod.z.object({
			"phase": zod.z.union([
				zod.z.literal("error"),
				zod.z.literal("checking"),
				zod.z.literal("idle"),
				zod.z.literal("ssh-auth"),
				zod.z.literal("discovering"),
				zod.z.literal("forwarding"),
				zod.z.literal("authenticating"),
				zod.z.literal("verifying"),
				zod.z.literal("app-ready"),
				zod.z.literal("disconnected"),
				zod.z.literal("reconnecting"),
				zod.z.literal("identity-mismatch"),
				zod.z.literal("auth-required"),
				zod.z.literal("service-stopped")
			]).readonly(),
			"connectionId": zod.z.union([zod.z.undefined(), zod.z.string()]).readonly().optional(),
			"targetId": zod.z.string().readonly().optional(),
			"endpointId": zod.z.string().readonly().optional(),
			"hostName": zod.z.string().readonly().optional(),
			"instanceId": zod.z.string().readonly().optional(),
			"bootId": zod.z.string().readonly().optional(),
			"profile": zod.z.string().readonly().optional(),
			"workspaceHint": zod.z.string().readonly().optional(),
			"generation": zod.z.number().readonly(),
			"reason": zod.z.string().readonly().optional(),
			"diagnostics": zod.z.array(zod.z.object({
				"name": zod.z.union([
					zod.z.literal("ssh"),
					zod.z.literal("helper"),
					zod.z.literal("service"),
					zod.z.literal("descriptor"),
					zod.z.literal("listener"),
					zod.z.literal("identity"),
					zod.z.literal("authentication"),
					zod.z.literal("events"),
					zod.z.literal("application")
				]).readonly(),
				"state": zod.z.union([
					zod.z.literal("failed"),
					zod.z.literal("unknown"),
					zod.z.literal("checking"),
					zod.z.literal("ok"),
					zod.z.literal("unsupported")
				]).readonly(),
				"code": zod.z.union([
					zod.z.literal("SSH_UNAVAILABLE"),
					zod.z.literal("SSH_AUTH_FAILED"),
					zod.z.literal("HOST_KEY_REJECTED"),
					zod.z.literal("SSH_TIMEOUT"),
					zod.z.literal("HELPER_NOT_FOUND"),
					zod.z.literal("HELPER_UNSAFE"),
					zod.z.literal("HELPER_BAD_CONFIG"),
					zod.z.literal("CONTROL_UNSUPPORTED"),
					zod.z.literal("SERVICE_UNREGISTERED"),
					zod.z.literal("SERVICE_STOPPED"),
					zod.z.literal("SERVICE_FAILED"),
					zod.z.literal("USER_MANAGER_UNAVAILABLE"),
					zod.z.literal("DESCRIPTOR_MISSING"),
					zod.z.literal("DESCRIPTOR_INVALID"),
					zod.z.literal("DESCRIPTOR_STALE"),
					zod.z.literal("UNSUPPORTED_WEB_TRANSPORT"),
					zod.z.literal("LOCAL_AUTH_REQUIRED"),
					zod.z.literal("UPSTREAM_AUTH_REQUIRED"),
					zod.z.literal("IDENTITY_MISMATCH"),
					zod.z.literal("APPLICATION_NOT_READY"),
					zod.z.literal("UPSTREAM_UNREACHABLE"),
					zod.z.literal("REGISTRATION_STALE"),
					zod.z.literal("OPERATION_CONFLICT"),
					zod.z.literal("OPERATION_EXPIRED"),
					zod.z.literal("OUTCOME_UNKNOWN"),
					zod.z.literal("BAD_INPUT"),
					zod.z.literal("CONFIG_REQUIRED"),
					zod.z.literal("UNSAFE_PATH"),
					zod.z.literal("UNSAFE_FILE"),
					zod.z.literal("LINUX_REQUIRED"),
					zod.z.literal("CONTROL_FAILED"),
					zod.z.literal("FORBIDDEN"),
					zod.z.literal("NOT_FOUND"),
					zod.z.literal("PROXY_PAUSED")
				]).readonly().optional(),
				"checkedAt": zod.z.string().readonly()
			})).readonly().describe("One entry per named check; `unknown` is never rendered as healthy."),
			"capabilities": zod.z.union([zod.z.undefined(), zod.z.object({
				"controlVersion": zod.z.number().readonly(),
				"helperVersion": zod.z.string().readonly(),
				"mode": zod.z.union([
					zod.z.literal("unsupported"),
					zod.z.literal("systemd-user"),
					zod.z.literal("unregistered")
				]).readonly(),
				"actions": zod.z.array(zod.z.string()).readonly()
			})]).readonly().optional(),
			"service": zod.z.union([zod.z.undefined(), zod.z.object({
				"unit": zod.z.string().readonly(),
				"state": zod.z.union([
					zod.z.literal("failed"),
					zod.z.literal("unknown"),
					zod.z.literal("active"),
					zod.z.literal("inactive"),
					zod.z.literal("activating"),
					zod.z.literal("deactivating")
				]).readonly(),
				"registered": zod.z.boolean().readonly(),
				"registrationRevision": zod.z.union([zod.z.undefined(), zod.z.string()]).readonly().optional().describe("Registration revision observed from the remote helper's `status`. A write action must echo the revision the helper reported, otherwise the helper answers REGISTRATION_STALE. Absent when the helper never reported one, so the caller can tell \"unknown\" from a real value.")
			})]).readonly().optional(),
			"serviceOperation": zod.z.union([zod.z.undefined(), zod.z.object({
				"phase": zod.z.union([
					zod.z.literal("failed"),
					zod.z.literal("completed"),
					zod.z.literal("waiting"),
					zod.z.literal("idle"),
					zod.z.literal("submitting"),
					zod.z.literal("outcome-unknown")
				]).readonly(),
				"action": zod.z.union([
					zod.z.undefined(),
					zod.z.literal("start"),
					zod.z.literal("stop"),
					zod.z.literal("restart")
				]).readonly().optional(),
				"operationId": zod.z.union([zod.z.undefined(), zod.z.string()]).readonly().optional(),
				"code": zod.z.union([
					zod.z.undefined(),
					zod.z.literal("SSH_UNAVAILABLE"),
					zod.z.literal("SSH_AUTH_FAILED"),
					zod.z.literal("HOST_KEY_REJECTED"),
					zod.z.literal("SSH_TIMEOUT"),
					zod.z.literal("HELPER_NOT_FOUND"),
					zod.z.literal("HELPER_UNSAFE"),
					zod.z.literal("HELPER_BAD_CONFIG"),
					zod.z.literal("CONTROL_UNSUPPORTED"),
					zod.z.literal("SERVICE_UNREGISTERED"),
					zod.z.literal("SERVICE_STOPPED"),
					zod.z.literal("SERVICE_FAILED"),
					zod.z.literal("USER_MANAGER_UNAVAILABLE"),
					zod.z.literal("DESCRIPTOR_MISSING"),
					zod.z.literal("DESCRIPTOR_INVALID"),
					zod.z.literal("DESCRIPTOR_STALE"),
					zod.z.literal("UNSUPPORTED_WEB_TRANSPORT"),
					zod.z.literal("LOCAL_AUTH_REQUIRED"),
					zod.z.literal("UPSTREAM_AUTH_REQUIRED"),
					zod.z.literal("IDENTITY_MISMATCH"),
					zod.z.literal("APPLICATION_NOT_READY"),
					zod.z.literal("UPSTREAM_UNREACHABLE"),
					zod.z.literal("REGISTRATION_STALE"),
					zod.z.literal("OPERATION_CONFLICT"),
					zod.z.literal("OPERATION_EXPIRED"),
					zod.z.literal("OUTCOME_UNKNOWN"),
					zod.z.literal("BAD_INPUT"),
					zod.z.literal("CONFIG_REQUIRED"),
					zod.z.literal("UNSAFE_PATH"),
					zod.z.literal("UNSAFE_FILE"),
					zod.z.literal("LINUX_REQUIRED"),
					zod.z.literal("CONTROL_FAILED"),
					zod.z.literal("FORBIDDEN"),
					zod.z.literal("NOT_FOUND"),
					zod.z.literal("PROXY_PAUSED")
				]).readonly().optional(),
				"startedAt": zod.z.union([zod.z.undefined(), zod.z.string()]).readonly().optional(),
				"finishedAt": zod.z.union([zod.z.undefined(), zod.z.string()]).readonly().optional()
			})]).readonly().optional(),
			"accessWarning": zod.z.union([
				zod.z.undefined(),
				zod.z.literal("SSH_UNAVAILABLE"),
				zod.z.literal("SSH_AUTH_FAILED"),
				zod.z.literal("HOST_KEY_REJECTED"),
				zod.z.literal("SSH_TIMEOUT"),
				zod.z.literal("HELPER_NOT_FOUND"),
				zod.z.literal("HELPER_UNSAFE"),
				zod.z.literal("HELPER_BAD_CONFIG"),
				zod.z.literal("CONTROL_UNSUPPORTED"),
				zod.z.literal("SERVICE_UNREGISTERED"),
				zod.z.literal("SERVICE_STOPPED"),
				zod.z.literal("SERVICE_FAILED"),
				zod.z.literal("USER_MANAGER_UNAVAILABLE"),
				zod.z.literal("DESCRIPTOR_MISSING"),
				zod.z.literal("DESCRIPTOR_INVALID"),
				zod.z.literal("DESCRIPTOR_STALE"),
				zod.z.literal("UNSUPPORTED_WEB_TRANSPORT"),
				zod.z.literal("LOCAL_AUTH_REQUIRED"),
				zod.z.literal("UPSTREAM_AUTH_REQUIRED"),
				zod.z.literal("IDENTITY_MISMATCH"),
				zod.z.literal("APPLICATION_NOT_READY"),
				zod.z.literal("UPSTREAM_UNREACHABLE"),
				zod.z.literal("REGISTRATION_STALE"),
				zod.z.literal("OPERATION_CONFLICT"),
				zod.z.literal("OPERATION_EXPIRED"),
				zod.z.literal("OUTCOME_UNKNOWN"),
				zod.z.literal("BAD_INPUT"),
				zod.z.literal("CONFIG_REQUIRED"),
				zod.z.literal("UNSAFE_PATH"),
				zod.z.literal("UNSAFE_FILE"),
				zod.z.literal("LINUX_REQUIRED"),
				zod.z.literal("CONTROL_FAILED"),
				zod.z.literal("FORBIDDEN"),
				zod.z.literal("NOT_FOUND"),
				zod.z.literal("PROXY_PAUSED")
			]).readonly().optional().describe("Fixed code when a browser page lost its local authorization; never a credential.")
		});
		let _harness_remote_controller_remoteWorkspace_inspectEndpoint_parameter_0$schema$value;
		const _harness_remote_controller_remoteWorkspace_inspectEndpoint_parameter_0$schema = () => _harness_remote_controller_remoteWorkspace_inspectEndpoint_parameter_0$schema$value ??= zod.z.union([zod.z.object({
			"targetId": zod.z.string().readonly(),
			"endpointId": zod.z.string().readonly()
		}), zod.z.object({
			"sshAlias": zod.z.string().readonly(),
			"instanceKey": zod.z.string().readonly()
		})]);
		let _harness_remote_controller_remoteWorkspace_inspectEndpoint_parameter_1$schema$value;
		const _harness_remote_controller_remoteWorkspace_inspectEndpoint_parameter_1$schema = () => _harness_remote_controller_remoteWorkspace_inspectEndpoint_parameter_1$schema$value ??= zod.z.string();
		let _harness_remote_controller_remoteWorkspace_inspectEndpoint_result$schema$value;
		const _harness_remote_controller_remoteWorkspace_inspectEndpoint_result$schema = () => _harness_remote_controller_remoteWorkspace_inspectEndpoint_result$schema$value ??= zod.z.object({
			"sshAlias": zod.z.string().readonly(),
			"instanceKey": zod.z.string().readonly(),
			"known": zod.z.boolean().readonly(),
			"capabilities": zod.z.union([zod.z.undefined(), zod.z.object({
				"controlVersion": zod.z.number().readonly(),
				"helperVersion": zod.z.string().readonly(),
				"mode": zod.z.union([
					zod.z.literal("unsupported"),
					zod.z.literal("systemd-user"),
					zod.z.literal("unregistered")
				]).readonly(),
				"actions": zod.z.array(zod.z.string()).readonly()
			})]).readonly().optional(),
			"service": zod.z.union([zod.z.undefined(), zod.z.object({
				"unit": zod.z.string().readonly(),
				"state": zod.z.union([
					zod.z.literal("failed"),
					zod.z.literal("unknown"),
					zod.z.literal("active"),
					zod.z.literal("inactive"),
					zod.z.literal("activating"),
					zod.z.literal("deactivating")
				]).readonly(),
				"registered": zod.z.boolean().readonly(),
				"registrationRevision": zod.z.union([zod.z.undefined(), zod.z.string()]).readonly().optional().describe("Registration revision observed from the remote helper's `status`. A write action must echo the revision the helper reported, otherwise the helper answers REGISTRATION_STALE. Absent when the helper never reported one, so the caller can tell \"unknown\" from a real value.")
			})]).readonly().optional(),
			"diagnostics": zod.z.array(zod.z.object({
				"name": zod.z.union([
					zod.z.literal("ssh"),
					zod.z.literal("helper"),
					zod.z.literal("service"),
					zod.z.literal("descriptor"),
					zod.z.literal("listener"),
					zod.z.literal("identity"),
					zod.z.literal("authentication"),
					zod.z.literal("events"),
					zod.z.literal("application")
				]).readonly(),
				"state": zod.z.union([
					zod.z.literal("failed"),
					zod.z.literal("unknown"),
					zod.z.literal("checking"),
					zod.z.literal("ok"),
					zod.z.literal("unsupported")
				]).readonly(),
				"code": zod.z.union([
					zod.z.literal("SSH_UNAVAILABLE"),
					zod.z.literal("SSH_AUTH_FAILED"),
					zod.z.literal("HOST_KEY_REJECTED"),
					zod.z.literal("SSH_TIMEOUT"),
					zod.z.literal("HELPER_NOT_FOUND"),
					zod.z.literal("HELPER_UNSAFE"),
					zod.z.literal("HELPER_BAD_CONFIG"),
					zod.z.literal("CONTROL_UNSUPPORTED"),
					zod.z.literal("SERVICE_UNREGISTERED"),
					zod.z.literal("SERVICE_STOPPED"),
					zod.z.literal("SERVICE_FAILED"),
					zod.z.literal("USER_MANAGER_UNAVAILABLE"),
					zod.z.literal("DESCRIPTOR_MISSING"),
					zod.z.literal("DESCRIPTOR_INVALID"),
					zod.z.literal("DESCRIPTOR_STALE"),
					zod.z.literal("UNSUPPORTED_WEB_TRANSPORT"),
					zod.z.literal("LOCAL_AUTH_REQUIRED"),
					zod.z.literal("UPSTREAM_AUTH_REQUIRED"),
					zod.z.literal("IDENTITY_MISMATCH"),
					zod.z.literal("APPLICATION_NOT_READY"),
					zod.z.literal("UPSTREAM_UNREACHABLE"),
					zod.z.literal("REGISTRATION_STALE"),
					zod.z.literal("OPERATION_CONFLICT"),
					zod.z.literal("OPERATION_EXPIRED"),
					zod.z.literal("OUTCOME_UNKNOWN"),
					zod.z.literal("BAD_INPUT"),
					zod.z.literal("CONFIG_REQUIRED"),
					zod.z.literal("UNSAFE_PATH"),
					zod.z.literal("UNSAFE_FILE"),
					zod.z.literal("LINUX_REQUIRED"),
					zod.z.literal("CONTROL_FAILED"),
					zod.z.literal("FORBIDDEN"),
					zod.z.literal("NOT_FOUND"),
					zod.z.literal("PROXY_PAUSED")
				]).readonly().optional(),
				"checkedAt": zod.z.string().readonly()
			})).readonly(),
			"checkedAt": zod.z.string().readonly()
		});
		let _harness_remote_controller_remoteWorkspace_listAliases_result$schema$value;
		const _harness_remote_controller_remoteWorkspace_listAliases_result$schema = () => _harness_remote_controller_remoteWorkspace_listAliases_result$schema$value ??= zod.z.array(zod.z.string());
		let _harness_remote_controller_remoteWorkspace_listTargets_result$schema$value;
		const _harness_remote_controller_remoteWorkspace_listTargets_result$schema = () => _harness_remote_controller_remoteWorkspace_listTargets_result$schema$value ??= zod.z.array(zod.z.object({
			"id": zod.z.string().readonly(),
			"name": zod.z.string().readonly(),
			"instanceKey": zod.z.string().readonly(),
			"instanceId": zod.z.string().readonly(),
			"profile": zod.z.string().readonly(),
			"workspaceHint": zod.z.string().readonly(),
			"remotePort": zod.z.number().readonly(),
			"endpoints": zod.z.array(zod.z.object({
				"id": zod.z.string().readonly(),
				"kind": zod.z.union([
					zod.z.literal("lan"),
					zod.z.literal("frp-tcp"),
					zod.z.literal("stcp")
				]).readonly(),
				"sshAlias": zod.z.string().readonly()
			})).readonly()
		}));
		let _harness_remote_controller_remoteWorkspace_quickConnect_parameter_0$schema$value;
		const _harness_remote_controller_remoteWorkspace_quickConnect_parameter_0$schema = () => _harness_remote_controller_remoteWorkspace_quickConnect_parameter_0$schema$value ??= zod.z.string();
		let _harness_remote_controller_remoteWorkspace_quickConnect_parameter_1$schema$value;
		const _harness_remote_controller_remoteWorkspace_quickConnect_parameter_1$schema = () => _harness_remote_controller_remoteWorkspace_quickConnect_parameter_1$schema$value ??= zod.z.string();
		let _harness_remote_controller_remoteWorkspace_quickConnect_parameter_2$schema$value;
		const _harness_remote_controller_remoteWorkspace_quickConnect_parameter_2$schema = () => _harness_remote_controller_remoteWorkspace_quickConnect_parameter_2$schema$value ??= zod.z.string();
		let _harness_remote_controller_remoteWorkspace_quickConnect_result$schema$value;
		const _harness_remote_controller_remoteWorkspace_quickConnect_result$schema = () => _harness_remote_controller_remoteWorkspace_quickConnect_result$schema$value ??= zod.z.object({
			"phase": zod.z.union([
				zod.z.literal("error"),
				zod.z.literal("checking"),
				zod.z.literal("idle"),
				zod.z.literal("ssh-auth"),
				zod.z.literal("discovering"),
				zod.z.literal("forwarding"),
				zod.z.literal("authenticating"),
				zod.z.literal("verifying"),
				zod.z.literal("app-ready"),
				zod.z.literal("disconnected"),
				zod.z.literal("reconnecting"),
				zod.z.literal("identity-mismatch"),
				zod.z.literal("auth-required"),
				zod.z.literal("service-stopped")
			]).readonly(),
			"connectionId": zod.z.union([zod.z.undefined(), zod.z.string()]).readonly().optional(),
			"targetId": zod.z.string().readonly().optional(),
			"endpointId": zod.z.string().readonly().optional(),
			"hostName": zod.z.string().readonly().optional(),
			"instanceId": zod.z.string().readonly().optional(),
			"bootId": zod.z.string().readonly().optional(),
			"profile": zod.z.string().readonly().optional(),
			"workspaceHint": zod.z.string().readonly().optional(),
			"generation": zod.z.number().readonly(),
			"reason": zod.z.string().readonly().optional(),
			"diagnostics": zod.z.array(zod.z.object({
				"name": zod.z.union([
					zod.z.literal("ssh"),
					zod.z.literal("helper"),
					zod.z.literal("service"),
					zod.z.literal("descriptor"),
					zod.z.literal("listener"),
					zod.z.literal("identity"),
					zod.z.literal("authentication"),
					zod.z.literal("events"),
					zod.z.literal("application")
				]).readonly(),
				"state": zod.z.union([
					zod.z.literal("failed"),
					zod.z.literal("unknown"),
					zod.z.literal("checking"),
					zod.z.literal("ok"),
					zod.z.literal("unsupported")
				]).readonly(),
				"code": zod.z.union([
					zod.z.literal("SSH_UNAVAILABLE"),
					zod.z.literal("SSH_AUTH_FAILED"),
					zod.z.literal("HOST_KEY_REJECTED"),
					zod.z.literal("SSH_TIMEOUT"),
					zod.z.literal("HELPER_NOT_FOUND"),
					zod.z.literal("HELPER_UNSAFE"),
					zod.z.literal("HELPER_BAD_CONFIG"),
					zod.z.literal("CONTROL_UNSUPPORTED"),
					zod.z.literal("SERVICE_UNREGISTERED"),
					zod.z.literal("SERVICE_STOPPED"),
					zod.z.literal("SERVICE_FAILED"),
					zod.z.literal("USER_MANAGER_UNAVAILABLE"),
					zod.z.literal("DESCRIPTOR_MISSING"),
					zod.z.literal("DESCRIPTOR_INVALID"),
					zod.z.literal("DESCRIPTOR_STALE"),
					zod.z.literal("UNSUPPORTED_WEB_TRANSPORT"),
					zod.z.literal("LOCAL_AUTH_REQUIRED"),
					zod.z.literal("UPSTREAM_AUTH_REQUIRED"),
					zod.z.literal("IDENTITY_MISMATCH"),
					zod.z.literal("APPLICATION_NOT_READY"),
					zod.z.literal("UPSTREAM_UNREACHABLE"),
					zod.z.literal("REGISTRATION_STALE"),
					zod.z.literal("OPERATION_CONFLICT"),
					zod.z.literal("OPERATION_EXPIRED"),
					zod.z.literal("OUTCOME_UNKNOWN"),
					zod.z.literal("BAD_INPUT"),
					zod.z.literal("CONFIG_REQUIRED"),
					zod.z.literal("UNSAFE_PATH"),
					zod.z.literal("UNSAFE_FILE"),
					zod.z.literal("LINUX_REQUIRED"),
					zod.z.literal("CONTROL_FAILED"),
					zod.z.literal("FORBIDDEN"),
					zod.z.literal("NOT_FOUND"),
					zod.z.literal("PROXY_PAUSED")
				]).readonly().optional(),
				"checkedAt": zod.z.string().readonly()
			})).readonly().describe("One entry per named check; `unknown` is never rendered as healthy."),
			"capabilities": zod.z.union([zod.z.undefined(), zod.z.object({
				"controlVersion": zod.z.number().readonly(),
				"helperVersion": zod.z.string().readonly(),
				"mode": zod.z.union([
					zod.z.literal("unsupported"),
					zod.z.literal("systemd-user"),
					zod.z.literal("unregistered")
				]).readonly(),
				"actions": zod.z.array(zod.z.string()).readonly()
			})]).readonly().optional(),
			"service": zod.z.union([zod.z.undefined(), zod.z.object({
				"unit": zod.z.string().readonly(),
				"state": zod.z.union([
					zod.z.literal("failed"),
					zod.z.literal("unknown"),
					zod.z.literal("active"),
					zod.z.literal("inactive"),
					zod.z.literal("activating"),
					zod.z.literal("deactivating")
				]).readonly(),
				"registered": zod.z.boolean().readonly(),
				"registrationRevision": zod.z.union([zod.z.undefined(), zod.z.string()]).readonly().optional().describe("Registration revision observed from the remote helper's `status`. A write action must echo the revision the helper reported, otherwise the helper answers REGISTRATION_STALE. Absent when the helper never reported one, so the caller can tell \"unknown\" from a real value.")
			})]).readonly().optional(),
			"serviceOperation": zod.z.union([zod.z.undefined(), zod.z.object({
				"phase": zod.z.union([
					zod.z.literal("failed"),
					zod.z.literal("completed"),
					zod.z.literal("waiting"),
					zod.z.literal("idle"),
					zod.z.literal("submitting"),
					zod.z.literal("outcome-unknown")
				]).readonly(),
				"action": zod.z.union([
					zod.z.undefined(),
					zod.z.literal("start"),
					zod.z.literal("stop"),
					zod.z.literal("restart")
				]).readonly().optional(),
				"operationId": zod.z.union([zod.z.undefined(), zod.z.string()]).readonly().optional(),
				"code": zod.z.union([
					zod.z.undefined(),
					zod.z.literal("SSH_UNAVAILABLE"),
					zod.z.literal("SSH_AUTH_FAILED"),
					zod.z.literal("HOST_KEY_REJECTED"),
					zod.z.literal("SSH_TIMEOUT"),
					zod.z.literal("HELPER_NOT_FOUND"),
					zod.z.literal("HELPER_UNSAFE"),
					zod.z.literal("HELPER_BAD_CONFIG"),
					zod.z.literal("CONTROL_UNSUPPORTED"),
					zod.z.literal("SERVICE_UNREGISTERED"),
					zod.z.literal("SERVICE_STOPPED"),
					zod.z.literal("SERVICE_FAILED"),
					zod.z.literal("USER_MANAGER_UNAVAILABLE"),
					zod.z.literal("DESCRIPTOR_MISSING"),
					zod.z.literal("DESCRIPTOR_INVALID"),
					zod.z.literal("DESCRIPTOR_STALE"),
					zod.z.literal("UNSUPPORTED_WEB_TRANSPORT"),
					zod.z.literal("LOCAL_AUTH_REQUIRED"),
					zod.z.literal("UPSTREAM_AUTH_REQUIRED"),
					zod.z.literal("IDENTITY_MISMATCH"),
					zod.z.literal("APPLICATION_NOT_READY"),
					zod.z.literal("UPSTREAM_UNREACHABLE"),
					zod.z.literal("REGISTRATION_STALE"),
					zod.z.literal("OPERATION_CONFLICT"),
					zod.z.literal("OPERATION_EXPIRED"),
					zod.z.literal("OUTCOME_UNKNOWN"),
					zod.z.literal("BAD_INPUT"),
					zod.z.literal("CONFIG_REQUIRED"),
					zod.z.literal("UNSAFE_PATH"),
					zod.z.literal("UNSAFE_FILE"),
					zod.z.literal("LINUX_REQUIRED"),
					zod.z.literal("CONTROL_FAILED"),
					zod.z.literal("FORBIDDEN"),
					zod.z.literal("NOT_FOUND"),
					zod.z.literal("PROXY_PAUSED")
				]).readonly().optional(),
				"startedAt": zod.z.union([zod.z.undefined(), zod.z.string()]).readonly().optional(),
				"finishedAt": zod.z.union([zod.z.undefined(), zod.z.string()]).readonly().optional()
			})]).readonly().optional(),
			"accessWarning": zod.z.union([
				zod.z.undefined(),
				zod.z.literal("SSH_UNAVAILABLE"),
				zod.z.literal("SSH_AUTH_FAILED"),
				zod.z.literal("HOST_KEY_REJECTED"),
				zod.z.literal("SSH_TIMEOUT"),
				zod.z.literal("HELPER_NOT_FOUND"),
				zod.z.literal("HELPER_UNSAFE"),
				zod.z.literal("HELPER_BAD_CONFIG"),
				zod.z.literal("CONTROL_UNSUPPORTED"),
				zod.z.literal("SERVICE_UNREGISTERED"),
				zod.z.literal("SERVICE_STOPPED"),
				zod.z.literal("SERVICE_FAILED"),
				zod.z.literal("USER_MANAGER_UNAVAILABLE"),
				zod.z.literal("DESCRIPTOR_MISSING"),
				zod.z.literal("DESCRIPTOR_INVALID"),
				zod.z.literal("DESCRIPTOR_STALE"),
				zod.z.literal("UNSUPPORTED_WEB_TRANSPORT"),
				zod.z.literal("LOCAL_AUTH_REQUIRED"),
				zod.z.literal("UPSTREAM_AUTH_REQUIRED"),
				zod.z.literal("IDENTITY_MISMATCH"),
				zod.z.literal("APPLICATION_NOT_READY"),
				zod.z.literal("UPSTREAM_UNREACHABLE"),
				zod.z.literal("REGISTRATION_STALE"),
				zod.z.literal("OPERATION_CONFLICT"),
				zod.z.literal("OPERATION_EXPIRED"),
				zod.z.literal("OUTCOME_UNKNOWN"),
				zod.z.literal("BAD_INPUT"),
				zod.z.literal("CONFIG_REQUIRED"),
				zod.z.literal("UNSAFE_PATH"),
				zod.z.literal("UNSAFE_FILE"),
				zod.z.literal("LINUX_REQUIRED"),
				zod.z.literal("CONTROL_FAILED"),
				zod.z.literal("FORBIDDEN"),
				zod.z.literal("NOT_FOUND"),
				zod.z.literal("PROXY_PAUSED")
			]).readonly().optional().describe("Fixed code when a browser page lost its local authorization; never a credential.")
		});
		let _harness_remote_controller_remoteWorkspace_refreshAuthentication_parameter_0$schema$value;
		const _harness_remote_controller_remoteWorkspace_refreshAuthentication_parameter_0$schema = () => _harness_remote_controller_remoteWorkspace_refreshAuthentication_parameter_0$schema$value ??= zod.z.string();
		let _harness_remote_controller_remoteWorkspace_refreshAuthentication_parameter_1$schema$value;
		const _harness_remote_controller_remoteWorkspace_refreshAuthentication_parameter_1$schema = () => _harness_remote_controller_remoteWorkspace_refreshAuthentication_parameter_1$schema$value ??= zod.z.string();
		let _harness_remote_controller_remoteWorkspace_refreshAuthentication_result$schema$value;
		const _harness_remote_controller_remoteWorkspace_refreshAuthentication_result$schema = () => _harness_remote_controller_remoteWorkspace_refreshAuthentication_result$schema$value ??= zod.z.object({
			"phase": zod.z.union([
				zod.z.literal("error"),
				zod.z.literal("checking"),
				zod.z.literal("idle"),
				zod.z.literal("ssh-auth"),
				zod.z.literal("discovering"),
				zod.z.literal("forwarding"),
				zod.z.literal("authenticating"),
				zod.z.literal("verifying"),
				zod.z.literal("app-ready"),
				zod.z.literal("disconnected"),
				zod.z.literal("reconnecting"),
				zod.z.literal("identity-mismatch"),
				zod.z.literal("auth-required"),
				zod.z.literal("service-stopped")
			]).readonly(),
			"connectionId": zod.z.union([zod.z.undefined(), zod.z.string()]).readonly().optional(),
			"targetId": zod.z.string().readonly().optional(),
			"endpointId": zod.z.string().readonly().optional(),
			"hostName": zod.z.string().readonly().optional(),
			"instanceId": zod.z.string().readonly().optional(),
			"bootId": zod.z.string().readonly().optional(),
			"profile": zod.z.string().readonly().optional(),
			"workspaceHint": zod.z.string().readonly().optional(),
			"generation": zod.z.number().readonly(),
			"reason": zod.z.string().readonly().optional(),
			"diagnostics": zod.z.array(zod.z.object({
				"name": zod.z.union([
					zod.z.literal("ssh"),
					zod.z.literal("helper"),
					zod.z.literal("service"),
					zod.z.literal("descriptor"),
					zod.z.literal("listener"),
					zod.z.literal("identity"),
					zod.z.literal("authentication"),
					zod.z.literal("events"),
					zod.z.literal("application")
				]).readonly(),
				"state": zod.z.union([
					zod.z.literal("failed"),
					zod.z.literal("unknown"),
					zod.z.literal("checking"),
					zod.z.literal("ok"),
					zod.z.literal("unsupported")
				]).readonly(),
				"code": zod.z.union([
					zod.z.literal("SSH_UNAVAILABLE"),
					zod.z.literal("SSH_AUTH_FAILED"),
					zod.z.literal("HOST_KEY_REJECTED"),
					zod.z.literal("SSH_TIMEOUT"),
					zod.z.literal("HELPER_NOT_FOUND"),
					zod.z.literal("HELPER_UNSAFE"),
					zod.z.literal("HELPER_BAD_CONFIG"),
					zod.z.literal("CONTROL_UNSUPPORTED"),
					zod.z.literal("SERVICE_UNREGISTERED"),
					zod.z.literal("SERVICE_STOPPED"),
					zod.z.literal("SERVICE_FAILED"),
					zod.z.literal("USER_MANAGER_UNAVAILABLE"),
					zod.z.literal("DESCRIPTOR_MISSING"),
					zod.z.literal("DESCRIPTOR_INVALID"),
					zod.z.literal("DESCRIPTOR_STALE"),
					zod.z.literal("UNSUPPORTED_WEB_TRANSPORT"),
					zod.z.literal("LOCAL_AUTH_REQUIRED"),
					zod.z.literal("UPSTREAM_AUTH_REQUIRED"),
					zod.z.literal("IDENTITY_MISMATCH"),
					zod.z.literal("APPLICATION_NOT_READY"),
					zod.z.literal("UPSTREAM_UNREACHABLE"),
					zod.z.literal("REGISTRATION_STALE"),
					zod.z.literal("OPERATION_CONFLICT"),
					zod.z.literal("OPERATION_EXPIRED"),
					zod.z.literal("OUTCOME_UNKNOWN"),
					zod.z.literal("BAD_INPUT"),
					zod.z.literal("CONFIG_REQUIRED"),
					zod.z.literal("UNSAFE_PATH"),
					zod.z.literal("UNSAFE_FILE"),
					zod.z.literal("LINUX_REQUIRED"),
					zod.z.literal("CONTROL_FAILED"),
					zod.z.literal("FORBIDDEN"),
					zod.z.literal("NOT_FOUND"),
					zod.z.literal("PROXY_PAUSED")
				]).readonly().optional(),
				"checkedAt": zod.z.string().readonly()
			})).readonly().describe("One entry per named check; `unknown` is never rendered as healthy."),
			"capabilities": zod.z.union([zod.z.undefined(), zod.z.object({
				"controlVersion": zod.z.number().readonly(),
				"helperVersion": zod.z.string().readonly(),
				"mode": zod.z.union([
					zod.z.literal("unsupported"),
					zod.z.literal("systemd-user"),
					zod.z.literal("unregistered")
				]).readonly(),
				"actions": zod.z.array(zod.z.string()).readonly()
			})]).readonly().optional(),
			"service": zod.z.union([zod.z.undefined(), zod.z.object({
				"unit": zod.z.string().readonly(),
				"state": zod.z.union([
					zod.z.literal("failed"),
					zod.z.literal("unknown"),
					zod.z.literal("active"),
					zod.z.literal("inactive"),
					zod.z.literal("activating"),
					zod.z.literal("deactivating")
				]).readonly(),
				"registered": zod.z.boolean().readonly(),
				"registrationRevision": zod.z.union([zod.z.undefined(), zod.z.string()]).readonly().optional().describe("Registration revision observed from the remote helper's `status`. A write action must echo the revision the helper reported, otherwise the helper answers REGISTRATION_STALE. Absent when the helper never reported one, so the caller can tell \"unknown\" from a real value.")
			})]).readonly().optional(),
			"serviceOperation": zod.z.union([zod.z.undefined(), zod.z.object({
				"phase": zod.z.union([
					zod.z.literal("failed"),
					zod.z.literal("completed"),
					zod.z.literal("waiting"),
					zod.z.literal("idle"),
					zod.z.literal("submitting"),
					zod.z.literal("outcome-unknown")
				]).readonly(),
				"action": zod.z.union([
					zod.z.undefined(),
					zod.z.literal("start"),
					zod.z.literal("stop"),
					zod.z.literal("restart")
				]).readonly().optional(),
				"operationId": zod.z.union([zod.z.undefined(), zod.z.string()]).readonly().optional(),
				"code": zod.z.union([
					zod.z.undefined(),
					zod.z.literal("SSH_UNAVAILABLE"),
					zod.z.literal("SSH_AUTH_FAILED"),
					zod.z.literal("HOST_KEY_REJECTED"),
					zod.z.literal("SSH_TIMEOUT"),
					zod.z.literal("HELPER_NOT_FOUND"),
					zod.z.literal("HELPER_UNSAFE"),
					zod.z.literal("HELPER_BAD_CONFIG"),
					zod.z.literal("CONTROL_UNSUPPORTED"),
					zod.z.literal("SERVICE_UNREGISTERED"),
					zod.z.literal("SERVICE_STOPPED"),
					zod.z.literal("SERVICE_FAILED"),
					zod.z.literal("USER_MANAGER_UNAVAILABLE"),
					zod.z.literal("DESCRIPTOR_MISSING"),
					zod.z.literal("DESCRIPTOR_INVALID"),
					zod.z.literal("DESCRIPTOR_STALE"),
					zod.z.literal("UNSUPPORTED_WEB_TRANSPORT"),
					zod.z.literal("LOCAL_AUTH_REQUIRED"),
					zod.z.literal("UPSTREAM_AUTH_REQUIRED"),
					zod.z.literal("IDENTITY_MISMATCH"),
					zod.z.literal("APPLICATION_NOT_READY"),
					zod.z.literal("UPSTREAM_UNREACHABLE"),
					zod.z.literal("REGISTRATION_STALE"),
					zod.z.literal("OPERATION_CONFLICT"),
					zod.z.literal("OPERATION_EXPIRED"),
					zod.z.literal("OUTCOME_UNKNOWN"),
					zod.z.literal("BAD_INPUT"),
					zod.z.literal("CONFIG_REQUIRED"),
					zod.z.literal("UNSAFE_PATH"),
					zod.z.literal("UNSAFE_FILE"),
					zod.z.literal("LINUX_REQUIRED"),
					zod.z.literal("CONTROL_FAILED"),
					zod.z.literal("FORBIDDEN"),
					zod.z.literal("NOT_FOUND"),
					zod.z.literal("PROXY_PAUSED")
				]).readonly().optional(),
				"startedAt": zod.z.union([zod.z.undefined(), zod.z.string()]).readonly().optional(),
				"finishedAt": zod.z.union([zod.z.undefined(), zod.z.string()]).readonly().optional()
			})]).readonly().optional(),
			"accessWarning": zod.z.union([
				zod.z.undefined(),
				zod.z.literal("SSH_UNAVAILABLE"),
				zod.z.literal("SSH_AUTH_FAILED"),
				zod.z.literal("HOST_KEY_REJECTED"),
				zod.z.literal("SSH_TIMEOUT"),
				zod.z.literal("HELPER_NOT_FOUND"),
				zod.z.literal("HELPER_UNSAFE"),
				zod.z.literal("HELPER_BAD_CONFIG"),
				zod.z.literal("CONTROL_UNSUPPORTED"),
				zod.z.literal("SERVICE_UNREGISTERED"),
				zod.z.literal("SERVICE_STOPPED"),
				zod.z.literal("SERVICE_FAILED"),
				zod.z.literal("USER_MANAGER_UNAVAILABLE"),
				zod.z.literal("DESCRIPTOR_MISSING"),
				zod.z.literal("DESCRIPTOR_INVALID"),
				zod.z.literal("DESCRIPTOR_STALE"),
				zod.z.literal("UNSUPPORTED_WEB_TRANSPORT"),
				zod.z.literal("LOCAL_AUTH_REQUIRED"),
				zod.z.literal("UPSTREAM_AUTH_REQUIRED"),
				zod.z.literal("IDENTITY_MISMATCH"),
				zod.z.literal("APPLICATION_NOT_READY"),
				zod.z.literal("UPSTREAM_UNREACHABLE"),
				zod.z.literal("REGISTRATION_STALE"),
				zod.z.literal("OPERATION_CONFLICT"),
				zod.z.literal("OPERATION_EXPIRED"),
				zod.z.literal("OUTCOME_UNKNOWN"),
				zod.z.literal("BAD_INPUT"),
				zod.z.literal("CONFIG_REQUIRED"),
				zod.z.literal("UNSAFE_PATH"),
				zod.z.literal("UNSAFE_FILE"),
				zod.z.literal("LINUX_REQUIRED"),
				zod.z.literal("CONTROL_FAILED"),
				zod.z.literal("FORBIDDEN"),
				zod.z.literal("NOT_FOUND"),
				zod.z.literal("PROXY_PAUSED")
			]).readonly().optional().describe("Fixed code when a browser page lost its local authorization; never a credential.")
		});
		let _harness_remote_controller_remoteWorkspace_saveTarget_parameter_0$schema$value;
		const _harness_remote_controller_remoteWorkspace_saveTarget_parameter_0$schema = () => _harness_remote_controller_remoteWorkspace_saveTarget_parameter_0$schema$value ??= zod.z.object({
			"id": zod.z.string().readonly(),
			"name": zod.z.string().readonly(),
			"instanceKey": zod.z.string().readonly(),
			"instanceId": zod.z.string().readonly(),
			"profile": zod.z.string().readonly(),
			"workspaceHint": zod.z.string().readonly(),
			"remotePort": zod.z.number().readonly(),
			"endpoints": zod.z.array(zod.z.object({
				"id": zod.z.string().readonly(),
				"kind": zod.z.union([
					zod.z.literal("lan"),
					zod.z.literal("frp-tcp"),
					zod.z.literal("stcp")
				]).readonly(),
				"sshAlias": zod.z.string().readonly()
			})).readonly()
		});
		let _harness_remote_controller_remoteWorkspace_saveTarget_result$schema$value;
		const _harness_remote_controller_remoteWorkspace_saveTarget_result$schema = () => _harness_remote_controller_remoteWorkspace_saveTarget_result$schema$value ??= zod.z.array(zod.z.object({
			"id": zod.z.string().readonly(),
			"name": zod.z.string().readonly(),
			"instanceKey": zod.z.string().readonly(),
			"instanceId": zod.z.string().readonly(),
			"profile": zod.z.string().readonly(),
			"workspaceHint": zod.z.string().readonly(),
			"remotePort": zod.z.number().readonly(),
			"endpoints": zod.z.array(zod.z.object({
				"id": zod.z.string().readonly(),
				"kind": zod.z.union([
					zod.z.literal("lan"),
					zod.z.literal("frp-tcp"),
					zod.z.literal("stcp")
				]).readonly(),
				"sshAlias": zod.z.string().readonly()
			})).readonly()
		}));
		let _harness_remote_controller_remoteWorkspace_serviceAction_parameter_0$schema$value;
		const _harness_remote_controller_remoteWorkspace_serviceAction_parameter_0$schema = () => _harness_remote_controller_remoteWorkspace_serviceAction_parameter_0$schema$value ??= zod.z.union([zod.z.object({
			"targetId": zod.z.string().readonly(),
			"endpointId": zod.z.string().readonly()
		}), zod.z.object({
			"sshAlias": zod.z.string().readonly(),
			"instanceKey": zod.z.string().readonly()
		})]);
		let _harness_remote_controller_remoteWorkspace_serviceAction_parameter_1$schema$value;
		const _harness_remote_controller_remoteWorkspace_serviceAction_parameter_1$schema = () => _harness_remote_controller_remoteWorkspace_serviceAction_parameter_1$schema$value ??= zod.z.union([
			zod.z.literal("start"),
			zod.z.literal("stop"),
			zod.z.literal("restart")
		]);
		let _harness_remote_controller_remoteWorkspace_serviceAction_parameter_2$schema$value;
		const _harness_remote_controller_remoteWorkspace_serviceAction_parameter_2$schema = () => _harness_remote_controller_remoteWorkspace_serviceAction_parameter_2$schema$value ??= zod.z.string();
		let _harness_remote_controller_remoteWorkspace_serviceAction_parameter_3$schema$value;
		const _harness_remote_controller_remoteWorkspace_serviceAction_parameter_3$schema = () => _harness_remote_controller_remoteWorkspace_serviceAction_parameter_3$schema$value ??= zod.z.string();
		let _harness_remote_controller_remoteWorkspace_serviceAction_parameter_4$schema$value;
		const _harness_remote_controller_remoteWorkspace_serviceAction_parameter_4$schema = () => _harness_remote_controller_remoteWorkspace_serviceAction_parameter_4$schema$value ??= zod.z.string();
		let _harness_remote_controller_remoteWorkspace_serviceAction_parameter_5$schema$value;
		const _harness_remote_controller_remoteWorkspace_serviceAction_parameter_5$schema = () => _harness_remote_controller_remoteWorkspace_serviceAction_parameter_5$schema$value ??= zod.z.union([zod.z.undefined(), zod.z.string()]);
		let _harness_remote_controller_remoteWorkspace_serviceAction_result$schema$value;
		const _harness_remote_controller_remoteWorkspace_serviceAction_result$schema = () => _harness_remote_controller_remoteWorkspace_serviceAction_result$schema$value ??= zod.z.object({
			"phase": zod.z.union([
				zod.z.literal("failed"),
				zod.z.literal("completed"),
				zod.z.literal("waiting"),
				zod.z.literal("idle"),
				zod.z.literal("submitting"),
				zod.z.literal("outcome-unknown")
			]).readonly(),
			"action": zod.z.union([
				zod.z.undefined(),
				zod.z.literal("start"),
				zod.z.literal("stop"),
				zod.z.literal("restart")
			]).readonly().optional(),
			"operationId": zod.z.union([zod.z.undefined(), zod.z.string()]).readonly().optional(),
			"code": zod.z.union([
				zod.z.undefined(),
				zod.z.literal("SSH_UNAVAILABLE"),
				zod.z.literal("SSH_AUTH_FAILED"),
				zod.z.literal("HOST_KEY_REJECTED"),
				zod.z.literal("SSH_TIMEOUT"),
				zod.z.literal("HELPER_NOT_FOUND"),
				zod.z.literal("HELPER_UNSAFE"),
				zod.z.literal("HELPER_BAD_CONFIG"),
				zod.z.literal("CONTROL_UNSUPPORTED"),
				zod.z.literal("SERVICE_UNREGISTERED"),
				zod.z.literal("SERVICE_STOPPED"),
				zod.z.literal("SERVICE_FAILED"),
				zod.z.literal("USER_MANAGER_UNAVAILABLE"),
				zod.z.literal("DESCRIPTOR_MISSING"),
				zod.z.literal("DESCRIPTOR_INVALID"),
				zod.z.literal("DESCRIPTOR_STALE"),
				zod.z.literal("UNSUPPORTED_WEB_TRANSPORT"),
				zod.z.literal("LOCAL_AUTH_REQUIRED"),
				zod.z.literal("UPSTREAM_AUTH_REQUIRED"),
				zod.z.literal("IDENTITY_MISMATCH"),
				zod.z.literal("APPLICATION_NOT_READY"),
				zod.z.literal("UPSTREAM_UNREACHABLE"),
				zod.z.literal("REGISTRATION_STALE"),
				zod.z.literal("OPERATION_CONFLICT"),
				zod.z.literal("OPERATION_EXPIRED"),
				zod.z.literal("OUTCOME_UNKNOWN"),
				zod.z.literal("BAD_INPUT"),
				zod.z.literal("CONFIG_REQUIRED"),
				zod.z.literal("UNSAFE_PATH"),
				zod.z.literal("UNSAFE_FILE"),
				zod.z.literal("LINUX_REQUIRED"),
				zod.z.literal("CONTROL_FAILED"),
				zod.z.literal("FORBIDDEN"),
				zod.z.literal("NOT_FOUND"),
				zod.z.literal("PROXY_PAUSED")
			]).readonly().optional(),
			"startedAt": zod.z.union([zod.z.undefined(), zod.z.string()]).readonly().optional(),
			"finishedAt": zod.z.union([zod.z.undefined(), zod.z.string()]).readonly().optional()
		});
		let _harness_remote_controller_remoteWorkspace_watch_result$schema$value;
		const _harness_remote_controller_remoteWorkspace_watch_result$schema = () => _harness_remote_controller_remoteWorkspace_watch_result$schema$value ??= zod.z.object({
			"phase": zod.z.union([
				zod.z.literal("error"),
				zod.z.literal("checking"),
				zod.z.literal("idle"),
				zod.z.literal("ssh-auth"),
				zod.z.literal("discovering"),
				zod.z.literal("forwarding"),
				zod.z.literal("authenticating"),
				zod.z.literal("verifying"),
				zod.z.literal("app-ready"),
				zod.z.literal("disconnected"),
				zod.z.literal("reconnecting"),
				zod.z.literal("identity-mismatch"),
				zod.z.literal("auth-required"),
				zod.z.literal("service-stopped")
			]).readonly(),
			"connectionId": zod.z.union([zod.z.undefined(), zod.z.string()]).readonly().optional(),
			"targetId": zod.z.string().readonly().optional(),
			"endpointId": zod.z.string().readonly().optional(),
			"hostName": zod.z.string().readonly().optional(),
			"instanceId": zod.z.string().readonly().optional(),
			"bootId": zod.z.string().readonly().optional(),
			"profile": zod.z.string().readonly().optional(),
			"workspaceHint": zod.z.string().readonly().optional(),
			"generation": zod.z.number().readonly(),
			"reason": zod.z.string().readonly().optional(),
			"diagnostics": zod.z.array(zod.z.object({
				"name": zod.z.union([
					zod.z.literal("ssh"),
					zod.z.literal("helper"),
					zod.z.literal("service"),
					zod.z.literal("descriptor"),
					zod.z.literal("listener"),
					zod.z.literal("identity"),
					zod.z.literal("authentication"),
					zod.z.literal("events"),
					zod.z.literal("application")
				]).readonly(),
				"state": zod.z.union([
					zod.z.literal("failed"),
					zod.z.literal("unknown"),
					zod.z.literal("checking"),
					zod.z.literal("ok"),
					zod.z.literal("unsupported")
				]).readonly(),
				"code": zod.z.union([
					zod.z.literal("SSH_UNAVAILABLE"),
					zod.z.literal("SSH_AUTH_FAILED"),
					zod.z.literal("HOST_KEY_REJECTED"),
					zod.z.literal("SSH_TIMEOUT"),
					zod.z.literal("HELPER_NOT_FOUND"),
					zod.z.literal("HELPER_UNSAFE"),
					zod.z.literal("HELPER_BAD_CONFIG"),
					zod.z.literal("CONTROL_UNSUPPORTED"),
					zod.z.literal("SERVICE_UNREGISTERED"),
					zod.z.literal("SERVICE_STOPPED"),
					zod.z.literal("SERVICE_FAILED"),
					zod.z.literal("USER_MANAGER_UNAVAILABLE"),
					zod.z.literal("DESCRIPTOR_MISSING"),
					zod.z.literal("DESCRIPTOR_INVALID"),
					zod.z.literal("DESCRIPTOR_STALE"),
					zod.z.literal("UNSUPPORTED_WEB_TRANSPORT"),
					zod.z.literal("LOCAL_AUTH_REQUIRED"),
					zod.z.literal("UPSTREAM_AUTH_REQUIRED"),
					zod.z.literal("IDENTITY_MISMATCH"),
					zod.z.literal("APPLICATION_NOT_READY"),
					zod.z.literal("UPSTREAM_UNREACHABLE"),
					zod.z.literal("REGISTRATION_STALE"),
					zod.z.literal("OPERATION_CONFLICT"),
					zod.z.literal("OPERATION_EXPIRED"),
					zod.z.literal("OUTCOME_UNKNOWN"),
					zod.z.literal("BAD_INPUT"),
					zod.z.literal("CONFIG_REQUIRED"),
					zod.z.literal("UNSAFE_PATH"),
					zod.z.literal("UNSAFE_FILE"),
					zod.z.literal("LINUX_REQUIRED"),
					zod.z.literal("CONTROL_FAILED"),
					zod.z.literal("FORBIDDEN"),
					zod.z.literal("NOT_FOUND"),
					zod.z.literal("PROXY_PAUSED")
				]).readonly().optional(),
				"checkedAt": zod.z.string().readonly()
			})).readonly().describe("One entry per named check; `unknown` is never rendered as healthy."),
			"capabilities": zod.z.union([zod.z.undefined(), zod.z.object({
				"controlVersion": zod.z.number().readonly(),
				"helperVersion": zod.z.string().readonly(),
				"mode": zod.z.union([
					zod.z.literal("unsupported"),
					zod.z.literal("systemd-user"),
					zod.z.literal("unregistered")
				]).readonly(),
				"actions": zod.z.array(zod.z.string()).readonly()
			})]).readonly().optional(),
			"service": zod.z.union([zod.z.undefined(), zod.z.object({
				"unit": zod.z.string().readonly(),
				"state": zod.z.union([
					zod.z.literal("failed"),
					zod.z.literal("unknown"),
					zod.z.literal("active"),
					zod.z.literal("inactive"),
					zod.z.literal("activating"),
					zod.z.literal("deactivating")
				]).readonly(),
				"registered": zod.z.boolean().readonly(),
				"registrationRevision": zod.z.union([zod.z.undefined(), zod.z.string()]).readonly().optional().describe("Registration revision observed from the remote helper's `status`. A write action must echo the revision the helper reported, otherwise the helper answers REGISTRATION_STALE. Absent when the helper never reported one, so the caller can tell \"unknown\" from a real value.")
			})]).readonly().optional(),
			"serviceOperation": zod.z.union([zod.z.undefined(), zod.z.object({
				"phase": zod.z.union([
					zod.z.literal("failed"),
					zod.z.literal("completed"),
					zod.z.literal("waiting"),
					zod.z.literal("idle"),
					zod.z.literal("submitting"),
					zod.z.literal("outcome-unknown")
				]).readonly(),
				"action": zod.z.union([
					zod.z.undefined(),
					zod.z.literal("start"),
					zod.z.literal("stop"),
					zod.z.literal("restart")
				]).readonly().optional(),
				"operationId": zod.z.union([zod.z.undefined(), zod.z.string()]).readonly().optional(),
				"code": zod.z.union([
					zod.z.undefined(),
					zod.z.literal("SSH_UNAVAILABLE"),
					zod.z.literal("SSH_AUTH_FAILED"),
					zod.z.literal("HOST_KEY_REJECTED"),
					zod.z.literal("SSH_TIMEOUT"),
					zod.z.literal("HELPER_NOT_FOUND"),
					zod.z.literal("HELPER_UNSAFE"),
					zod.z.literal("HELPER_BAD_CONFIG"),
					zod.z.literal("CONTROL_UNSUPPORTED"),
					zod.z.literal("SERVICE_UNREGISTERED"),
					zod.z.literal("SERVICE_STOPPED"),
					zod.z.literal("SERVICE_FAILED"),
					zod.z.literal("USER_MANAGER_UNAVAILABLE"),
					zod.z.literal("DESCRIPTOR_MISSING"),
					zod.z.literal("DESCRIPTOR_INVALID"),
					zod.z.literal("DESCRIPTOR_STALE"),
					zod.z.literal("UNSUPPORTED_WEB_TRANSPORT"),
					zod.z.literal("LOCAL_AUTH_REQUIRED"),
					zod.z.literal("UPSTREAM_AUTH_REQUIRED"),
					zod.z.literal("IDENTITY_MISMATCH"),
					zod.z.literal("APPLICATION_NOT_READY"),
					zod.z.literal("UPSTREAM_UNREACHABLE"),
					zod.z.literal("REGISTRATION_STALE"),
					zod.z.literal("OPERATION_CONFLICT"),
					zod.z.literal("OPERATION_EXPIRED"),
					zod.z.literal("OUTCOME_UNKNOWN"),
					zod.z.literal("BAD_INPUT"),
					zod.z.literal("CONFIG_REQUIRED"),
					zod.z.literal("UNSAFE_PATH"),
					zod.z.literal("UNSAFE_FILE"),
					zod.z.literal("LINUX_REQUIRED"),
					zod.z.literal("CONTROL_FAILED"),
					zod.z.literal("FORBIDDEN"),
					zod.z.literal("NOT_FOUND"),
					zod.z.literal("PROXY_PAUSED")
				]).readonly().optional(),
				"startedAt": zod.z.union([zod.z.undefined(), zod.z.string()]).readonly().optional(),
				"finishedAt": zod.z.union([zod.z.undefined(), zod.z.string()]).readonly().optional()
			})]).readonly().optional(),
			"accessWarning": zod.z.union([
				zod.z.undefined(),
				zod.z.literal("SSH_UNAVAILABLE"),
				zod.z.literal("SSH_AUTH_FAILED"),
				zod.z.literal("HOST_KEY_REJECTED"),
				zod.z.literal("SSH_TIMEOUT"),
				zod.z.literal("HELPER_NOT_FOUND"),
				zod.z.literal("HELPER_UNSAFE"),
				zod.z.literal("HELPER_BAD_CONFIG"),
				zod.z.literal("CONTROL_UNSUPPORTED"),
				zod.z.literal("SERVICE_UNREGISTERED"),
				zod.z.literal("SERVICE_STOPPED"),
				zod.z.literal("SERVICE_FAILED"),
				zod.z.literal("USER_MANAGER_UNAVAILABLE"),
				zod.z.literal("DESCRIPTOR_MISSING"),
				zod.z.literal("DESCRIPTOR_INVALID"),
				zod.z.literal("DESCRIPTOR_STALE"),
				zod.z.literal("UNSUPPORTED_WEB_TRANSPORT"),
				zod.z.literal("LOCAL_AUTH_REQUIRED"),
				zod.z.literal("UPSTREAM_AUTH_REQUIRED"),
				zod.z.literal("IDENTITY_MISMATCH"),
				zod.z.literal("APPLICATION_NOT_READY"),
				zod.z.literal("UPSTREAM_UNREACHABLE"),
				zod.z.literal("REGISTRATION_STALE"),
				zod.z.literal("OPERATION_CONFLICT"),
				zod.z.literal("OPERATION_EXPIRED"),
				zod.z.literal("OUTCOME_UNKNOWN"),
				zod.z.literal("BAD_INPUT"),
				zod.z.literal("CONFIG_REQUIRED"),
				zod.z.literal("UNSAFE_PATH"),
				zod.z.literal("UNSAFE_FILE"),
				zod.z.literal("LINUX_REQUIRED"),
				zod.z.literal("CONTROL_FAILED"),
				zod.z.literal("FORBIDDEN"),
				zod.z.literal("NOT_FOUND"),
				zod.z.literal("PROXY_PAUSED")
			]).readonly().optional().describe("Fixed code when a browser page lost its local authorization; never a credential.")
		});
		let _harness_remote_controller_remoteWorkspace_connect_parameter_0_strict$schema$value;
		const _harness_remote_controller_remoteWorkspace_connect_parameter_0_strict$schema = () => _harness_remote_controller_remoteWorkspace_connect_parameter_0_strict$schema$value ??= zod.z.string();
		let _harness_remote_controller_remoteWorkspace_connect_parameter_1_strict$schema$value;
		const _harness_remote_controller_remoteWorkspace_connect_parameter_1_strict$schema = () => _harness_remote_controller_remoteWorkspace_connect_parameter_1_strict$schema$value ??= zod.z.string();
		let _harness_remote_controller_remoteWorkspace_connect_parameter_2_strict$schema$value;
		const _harness_remote_controller_remoteWorkspace_connect_parameter_2_strict$schema = () => _harness_remote_controller_remoteWorkspace_connect_parameter_2_strict$schema$value ??= zod.z.string();
		let _harness_remote_controller_remoteWorkspace_createOpenTicket_parameter_0_strict$schema$value;
		const _harness_remote_controller_remoteWorkspace_createOpenTicket_parameter_0_strict$schema = () => _harness_remote_controller_remoteWorkspace_createOpenTicket_parameter_0_strict$schema$value ??= zod.z.string();
		let _harness_remote_controller_remoteWorkspace_disconnect_parameter_0_strict$schema$value;
		const _harness_remote_controller_remoteWorkspace_disconnect_parameter_0_strict$schema = () => _harness_remote_controller_remoteWorkspace_disconnect_parameter_0_strict$schema$value ??= zod.z.string();
		let _harness_remote_controller_remoteWorkspace_getServiceOperation_parameter_0_strict$schema$value;
		const _harness_remote_controller_remoteWorkspace_getServiceOperation_parameter_0_strict$schema = () => _harness_remote_controller_remoteWorkspace_getServiceOperation_parameter_0_strict$schema$value ??= zod.z.union([zod.z.strictObject({
			"targetId": zod.z.string().readonly(),
			"endpointId": zod.z.string().readonly()
		}), zod.z.strictObject({
			"sshAlias": zod.z.string().readonly(),
			"instanceKey": zod.z.string().readonly()
		})]);
		let _harness_remote_controller_remoteWorkspace_getServiceOperation_parameter_1_strict$schema$value;
		const _harness_remote_controller_remoteWorkspace_getServiceOperation_parameter_1_strict$schema = () => _harness_remote_controller_remoteWorkspace_getServiceOperation_parameter_1_strict$schema$value ??= zod.z.string();
		let _harness_remote_controller_remoteWorkspace_inspectEndpoint_parameter_0_strict$schema$value;
		const _harness_remote_controller_remoteWorkspace_inspectEndpoint_parameter_0_strict$schema = () => _harness_remote_controller_remoteWorkspace_inspectEndpoint_parameter_0_strict$schema$value ??= zod.z.union([zod.z.strictObject({
			"targetId": zod.z.string().readonly(),
			"endpointId": zod.z.string().readonly()
		}), zod.z.strictObject({
			"sshAlias": zod.z.string().readonly(),
			"instanceKey": zod.z.string().readonly()
		})]);
		let _harness_remote_controller_remoteWorkspace_inspectEndpoint_parameter_1_strict$schema$value;
		const _harness_remote_controller_remoteWorkspace_inspectEndpoint_parameter_1_strict$schema = () => _harness_remote_controller_remoteWorkspace_inspectEndpoint_parameter_1_strict$schema$value ??= zod.z.string();
		let _harness_remote_controller_remoteWorkspace_quickConnect_parameter_0_strict$schema$value;
		const _harness_remote_controller_remoteWorkspace_quickConnect_parameter_0_strict$schema = () => _harness_remote_controller_remoteWorkspace_quickConnect_parameter_0_strict$schema$value ??= zod.z.string();
		let _harness_remote_controller_remoteWorkspace_quickConnect_parameter_1_strict$schema$value;
		const _harness_remote_controller_remoteWorkspace_quickConnect_parameter_1_strict$schema = () => _harness_remote_controller_remoteWorkspace_quickConnect_parameter_1_strict$schema$value ??= zod.z.string();
		let _harness_remote_controller_remoteWorkspace_quickConnect_parameter_2_strict$schema$value;
		const _harness_remote_controller_remoteWorkspace_quickConnect_parameter_2_strict$schema = () => _harness_remote_controller_remoteWorkspace_quickConnect_parameter_2_strict$schema$value ??= zod.z.string();
		let _harness_remote_controller_remoteWorkspace_refreshAuthentication_parameter_0_strict$schema$value;
		const _harness_remote_controller_remoteWorkspace_refreshAuthentication_parameter_0_strict$schema = () => _harness_remote_controller_remoteWorkspace_refreshAuthentication_parameter_0_strict$schema$value ??= zod.z.string();
		let _harness_remote_controller_remoteWorkspace_refreshAuthentication_parameter_1_strict$schema$value;
		const _harness_remote_controller_remoteWorkspace_refreshAuthentication_parameter_1_strict$schema = () => _harness_remote_controller_remoteWorkspace_refreshAuthentication_parameter_1_strict$schema$value ??= zod.z.string();
		let _harness_remote_controller_remoteWorkspace_saveTarget_parameter_0_strict$schema$value;
		const _harness_remote_controller_remoteWorkspace_saveTarget_parameter_0_strict$schema = () => _harness_remote_controller_remoteWorkspace_saveTarget_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"id": zod.z.string().readonly(),
			"name": zod.z.string().readonly(),
			"instanceKey": zod.z.string().readonly(),
			"instanceId": zod.z.string().readonly(),
			"profile": zod.z.string().readonly(),
			"workspaceHint": zod.z.string().readonly(),
			"remotePort": zod.z.number().readonly(),
			"endpoints": zod.z.array(zod.z.strictObject({
				"id": zod.z.string().readonly(),
				"kind": zod.z.union([
					zod.z.literal("lan"),
					zod.z.literal("frp-tcp"),
					zod.z.literal("stcp")
				]).readonly(),
				"sshAlias": zod.z.string().readonly()
			})).readonly()
		});
		let _harness_remote_controller_remoteWorkspace_serviceAction_parameter_0_strict$schema$value;
		const _harness_remote_controller_remoteWorkspace_serviceAction_parameter_0_strict$schema = () => _harness_remote_controller_remoteWorkspace_serviceAction_parameter_0_strict$schema$value ??= zod.z.union([zod.z.strictObject({
			"targetId": zod.z.string().readonly(),
			"endpointId": zod.z.string().readonly()
		}), zod.z.strictObject({
			"sshAlias": zod.z.string().readonly(),
			"instanceKey": zod.z.string().readonly()
		})]);
		let _harness_remote_controller_remoteWorkspace_serviceAction_parameter_1_strict$schema$value;
		const _harness_remote_controller_remoteWorkspace_serviceAction_parameter_1_strict$schema = () => _harness_remote_controller_remoteWorkspace_serviceAction_parameter_1_strict$schema$value ??= zod.z.union([
			zod.z.literal("start"),
			zod.z.literal("stop"),
			zod.z.literal("restart")
		]);
		let _harness_remote_controller_remoteWorkspace_serviceAction_parameter_2_strict$schema$value;
		const _harness_remote_controller_remoteWorkspace_serviceAction_parameter_2_strict$schema = () => _harness_remote_controller_remoteWorkspace_serviceAction_parameter_2_strict$schema$value ??= zod.z.string();
		let _harness_remote_controller_remoteWorkspace_serviceAction_parameter_3_strict$schema$value;
		const _harness_remote_controller_remoteWorkspace_serviceAction_parameter_3_strict$schema = () => _harness_remote_controller_remoteWorkspace_serviceAction_parameter_3_strict$schema$value ??= zod.z.string();
		let _harness_remote_controller_remoteWorkspace_serviceAction_parameter_4_strict$schema$value;
		const _harness_remote_controller_remoteWorkspace_serviceAction_parameter_4_strict$schema = () => _harness_remote_controller_remoteWorkspace_serviceAction_parameter_4_strict$schema$value ??= zod.z.string();
		let _harness_remote_controller_remoteWorkspace_serviceAction_parameter_5_strict$schema$value;
		const _harness_remote_controller_remoteWorkspace_serviceAction_parameter_5_strict$schema = () => _harness_remote_controller_remoteWorkspace_serviceAction_parameter_5_strict$schema$value ??= zod.z.union([zod.z.undefined(), zod.z.string()]);
		const TYPERT_REMOTE = createTypertRemoteInfo({
			package: "dsh-win-ssh-controller-source",
			methods: {
				"remoteWorkspace/connect": {
					service: "remoteWorkspace",
					description: "Attach one target over a reviewed SSH alias.",
					invocation: { kind: "direct" },
					parameters: [
						{
							name: "targetId",
							description: "stable target id.",
							source: "json",
							codec: {
								mode: "strict",
								typeSymbol: "dsh-win-ssh-controller-source#remoteWorkspace/connect:targetId",
								create: _harness_remote_controller_remoteWorkspace_connect_parameter_0$schema,
								jsonSchema: { "type": "string" }
							},
							strictCodec: {
								mode: "strict",
								typeSymbol: "dsh-win-ssh-controller-source#remoteWorkspace/connect:targetId",
								create: _harness_remote_controller_remoteWorkspace_connect_parameter_0_strict$schema,
								jsonSchema: { "type": "string" }
							}
						},
						{
							name: "endpointId",
							description: "chosen LAN, TCP, or STCP endpoint.",
							source: "json",
							codec: {
								mode: "strict",
								typeSymbol: "dsh-win-ssh-controller-source#remoteWorkspace/connect:endpointId",
								create: _harness_remote_controller_remoteWorkspace_connect_parameter_1$schema,
								jsonSchema: { "type": "string" }
							},
							strictCodec: {
								mode: "strict",
								typeSymbol: "dsh-win-ssh-controller-source#remoteWorkspace/connect:endpointId",
								create: _harness_remote_controller_remoteWorkspace_connect_parameter_1_strict$schema,
								jsonSchema: { "type": "string" }
							}
						},
						{
							name: "operationId",
							description: "idempotency key for this connect intent.",
							source: "json",
							codec: {
								mode: "strict",
								typeSymbol: "dsh-win-ssh-controller-source#remoteWorkspace/connect:operationId",
								create: _harness_remote_controller_remoteWorkspace_connect_parameter_2$schema,
								jsonSchema: { "type": "string" }
							},
							strictCodec: {
								mode: "strict",
								typeSymbol: "dsh-win-ssh-controller-source#remoteWorkspace/connect:operationId",
								create: _harness_remote_controller_remoteWorkspace_connect_parameter_2_strict$schema,
								jsonSchema: { "type": "string" }
							}
						}
					],
					result: {
						mode: "strict",
						typeSymbol: "dsh-win-ssh-controller-source/types#RemoteSnapshot",
						create: _harness_remote_controller_remoteWorkspace_connect_result$schema,
						description: "connection state after authentication and event readiness.",
						jsonSchema: {
							"type": "object",
							"properties": {
								"phase": {
									"type": "string",
									"enum": [
										"error",
										"checking",
										"idle",
										"ssh-auth",
										"discovering",
										"forwarding",
										"authenticating",
										"verifying",
										"app-ready",
										"disconnected",
										"reconnecting",
										"identity-mismatch",
										"auth-required",
										"service-stopped"
									]
								},
								"connectionId": { "type": "string" },
								"targetId": { "type": "string" },
								"endpointId": { "type": "string" },
								"hostName": { "type": "string" },
								"instanceId": { "type": "string" },
								"bootId": { "type": "string" },
								"profile": { "type": "string" },
								"workspaceHint": { "type": "string" },
								"generation": { "type": "number" },
								"reason": { "type": "string" },
								"diagnostics": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"name": {
												"type": "string",
												"enum": [
													"ssh",
													"helper",
													"service",
													"descriptor",
													"listener",
													"identity",
													"authentication",
													"events",
													"application"
												]
											},
											"state": {
												"type": "string",
												"enum": [
													"failed",
													"unknown",
													"checking",
													"ok",
													"unsupported"
												]
											},
											"code": {
												"type": "string",
												"enum": [
													"SSH_UNAVAILABLE",
													"SSH_AUTH_FAILED",
													"HOST_KEY_REJECTED",
													"SSH_TIMEOUT",
													"HELPER_NOT_FOUND",
													"HELPER_UNSAFE",
													"HELPER_BAD_CONFIG",
													"CONTROL_UNSUPPORTED",
													"SERVICE_UNREGISTERED",
													"SERVICE_STOPPED",
													"SERVICE_FAILED",
													"USER_MANAGER_UNAVAILABLE",
													"DESCRIPTOR_MISSING",
													"DESCRIPTOR_INVALID",
													"DESCRIPTOR_STALE",
													"UNSUPPORTED_WEB_TRANSPORT",
													"LOCAL_AUTH_REQUIRED",
													"UPSTREAM_AUTH_REQUIRED",
													"IDENTITY_MISMATCH",
													"APPLICATION_NOT_READY",
													"UPSTREAM_UNREACHABLE",
													"REGISTRATION_STALE",
													"OPERATION_CONFLICT",
													"OPERATION_EXPIRED",
													"OUTCOME_UNKNOWN",
													"BAD_INPUT",
													"CONFIG_REQUIRED",
													"UNSAFE_PATH",
													"UNSAFE_FILE",
													"LINUX_REQUIRED",
													"CONTROL_FAILED",
													"FORBIDDEN",
													"NOT_FOUND",
													"PROXY_PAUSED"
												]
											},
											"checkedAt": { "type": "string" }
										},
										"required": [
											"name",
											"state",
											"checkedAt"
										],
										"additionalProperties": true
									},
									"description": "One entry per named check; `unknown` is never rendered as healthy."
								},
								"capabilities": {
									"type": "object",
									"properties": {
										"controlVersion": { "type": "number" },
										"helperVersion": { "type": "string" },
										"mode": {
											"type": "string",
											"enum": [
												"unsupported",
												"systemd-user",
												"unregistered"
											]
										},
										"actions": {
											"type": "array",
											"items": { "type": "string" }
										}
									},
									"required": [
										"controlVersion",
										"helperVersion",
										"mode",
										"actions"
									],
									"additionalProperties": true
								},
								"service": {
									"type": "object",
									"properties": {
										"unit": { "type": "string" },
										"state": {
											"type": "string",
											"enum": [
												"failed",
												"unknown",
												"active",
												"inactive",
												"activating",
												"deactivating"
											]
										},
										"registered": { "type": "boolean" },
										"registrationRevision": {
											"type": "string",
											"description": "Registration revision observed from the remote helper's `status`. A write action must echo the revision the helper reported, otherwise the helper answers REGISTRATION_STALE. Absent when the helper never reported one, so the caller can tell \"unknown\" from a real value."
										}
									},
									"required": [
										"unit",
										"state",
										"registered"
									],
									"additionalProperties": true
								},
								"serviceOperation": {
									"type": "object",
									"properties": {
										"phase": {
											"type": "string",
											"enum": [
												"failed",
												"completed",
												"waiting",
												"idle",
												"submitting",
												"outcome-unknown"
											]
										},
										"action": {
											"type": "string",
											"enum": [
												"start",
												"stop",
												"restart"
											]
										},
										"operationId": { "type": "string" },
										"code": {
											"type": "string",
											"enum": [
												"SSH_UNAVAILABLE",
												"SSH_AUTH_FAILED",
												"HOST_KEY_REJECTED",
												"SSH_TIMEOUT",
												"HELPER_NOT_FOUND",
												"HELPER_UNSAFE",
												"HELPER_BAD_CONFIG",
												"CONTROL_UNSUPPORTED",
												"SERVICE_UNREGISTERED",
												"SERVICE_STOPPED",
												"SERVICE_FAILED",
												"USER_MANAGER_UNAVAILABLE",
												"DESCRIPTOR_MISSING",
												"DESCRIPTOR_INVALID",
												"DESCRIPTOR_STALE",
												"UNSUPPORTED_WEB_TRANSPORT",
												"LOCAL_AUTH_REQUIRED",
												"UPSTREAM_AUTH_REQUIRED",
												"IDENTITY_MISMATCH",
												"APPLICATION_NOT_READY",
												"UPSTREAM_UNREACHABLE",
												"REGISTRATION_STALE",
												"OPERATION_CONFLICT",
												"OPERATION_EXPIRED",
												"OUTCOME_UNKNOWN",
												"BAD_INPUT",
												"CONFIG_REQUIRED",
												"UNSAFE_PATH",
												"UNSAFE_FILE",
												"LINUX_REQUIRED",
												"CONTROL_FAILED",
												"FORBIDDEN",
												"NOT_FOUND",
												"PROXY_PAUSED"
											]
										},
										"startedAt": { "type": "string" },
										"finishedAt": { "type": "string" }
									},
									"required": ["phase"],
									"additionalProperties": true
								},
								"accessWarning": {
									"type": "string",
									"enum": [
										"SSH_UNAVAILABLE",
										"SSH_AUTH_FAILED",
										"HOST_KEY_REJECTED",
										"SSH_TIMEOUT",
										"HELPER_NOT_FOUND",
										"HELPER_UNSAFE",
										"HELPER_BAD_CONFIG",
										"CONTROL_UNSUPPORTED",
										"SERVICE_UNREGISTERED",
										"SERVICE_STOPPED",
										"SERVICE_FAILED",
										"USER_MANAGER_UNAVAILABLE",
										"DESCRIPTOR_MISSING",
										"DESCRIPTOR_INVALID",
										"DESCRIPTOR_STALE",
										"UNSUPPORTED_WEB_TRANSPORT",
										"LOCAL_AUTH_REQUIRED",
										"UPSTREAM_AUTH_REQUIRED",
										"IDENTITY_MISMATCH",
										"APPLICATION_NOT_READY",
										"UPSTREAM_UNREACHABLE",
										"REGISTRATION_STALE",
										"OPERATION_CONFLICT",
										"OPERATION_EXPIRED",
										"OUTCOME_UNKNOWN",
										"BAD_INPUT",
										"CONFIG_REQUIRED",
										"UNSAFE_PATH",
										"UNSAFE_FILE",
										"LINUX_REQUIRED",
										"CONTROL_FAILED",
										"FORBIDDEN",
										"NOT_FOUND",
										"PROXY_PAUSED"
									],
									"description": "Fixed code when a browser page lost its local authorization; never a credential."
								}
							},
							"required": [
								"phase",
								"generation",
								"diagnostics"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/remote/controller/src/index.ts",
						"line": 82,
						"column": 3
					}
				},
				"remoteWorkspace/createOpenTicket": {
					service: "remoteWorkspace",
					description: "Issue a Browser ticket for the authenticated attachment.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "connectionId",
						description: "ready local attachment.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "dsh-win-ssh-controller-source#remoteWorkspace/createOpenTicket:connectionId",
							create: _harness_remote_controller_remoteWorkspace_createOpenTicket_parameter_0$schema,
							jsonSchema: { "type": "string" }
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "dsh-win-ssh-controller-source#remoteWorkspace/createOpenTicket:connectionId",
							create: _harness_remote_controller_remoteWorkspace_createOpenTicket_parameter_0_strict$schema,
							jsonSchema: { "type": "string" }
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "dsh-win-ssh-controller-source#remoteWorkspace/createOpenTicket:result",
						create: _harness_remote_controller_remoteWorkspace_createOpenTicket_result$schema,
						description: "one-use, short-lived local Browser URL.",
						jsonSchema: { "type": "string" }
					},
					sourceLocation: {
						"file": "packages/remote/controller/src/index.ts",
						"line": 107,
						"column": 3
					}
				},
				"remoteWorkspace/disconnect": {
					service: "remoteWorkspace",
					description: "Release local resources owned by one attachment.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "connectionId",
						description: "active local attachment.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "dsh-win-ssh-controller-source#remoteWorkspace/disconnect:connectionId",
							create: _harness_remote_controller_remoteWorkspace_disconnect_parameter_0$schema,
							jsonSchema: { "type": "string" }
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "dsh-win-ssh-controller-source#remoteWorkspace/disconnect:connectionId",
							create: _harness_remote_controller_remoteWorkspace_disconnect_parameter_0_strict$schema,
							jsonSchema: { "type": "string" }
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "dsh-win-ssh-controller-source/types#RemoteSnapshot",
						create: _harness_remote_controller_remoteWorkspace_disconnect_result$schema,
						description: "new state.",
						jsonSchema: {
							"type": "object",
							"properties": {
								"phase": {
									"type": "string",
									"enum": [
										"error",
										"checking",
										"idle",
										"ssh-auth",
										"discovering",
										"forwarding",
										"authenticating",
										"verifying",
										"app-ready",
										"disconnected",
										"reconnecting",
										"identity-mismatch",
										"auth-required",
										"service-stopped"
									]
								},
								"connectionId": { "type": "string" },
								"targetId": { "type": "string" },
								"endpointId": { "type": "string" },
								"hostName": { "type": "string" },
								"instanceId": { "type": "string" },
								"bootId": { "type": "string" },
								"profile": { "type": "string" },
								"workspaceHint": { "type": "string" },
								"generation": { "type": "number" },
								"reason": { "type": "string" },
								"diagnostics": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"name": {
												"type": "string",
												"enum": [
													"ssh",
													"helper",
													"service",
													"descriptor",
													"listener",
													"identity",
													"authentication",
													"events",
													"application"
												]
											},
											"state": {
												"type": "string",
												"enum": [
													"failed",
													"unknown",
													"checking",
													"ok",
													"unsupported"
												]
											},
											"code": {
												"type": "string",
												"enum": [
													"SSH_UNAVAILABLE",
													"SSH_AUTH_FAILED",
													"HOST_KEY_REJECTED",
													"SSH_TIMEOUT",
													"HELPER_NOT_FOUND",
													"HELPER_UNSAFE",
													"HELPER_BAD_CONFIG",
													"CONTROL_UNSUPPORTED",
													"SERVICE_UNREGISTERED",
													"SERVICE_STOPPED",
													"SERVICE_FAILED",
													"USER_MANAGER_UNAVAILABLE",
													"DESCRIPTOR_MISSING",
													"DESCRIPTOR_INVALID",
													"DESCRIPTOR_STALE",
													"UNSUPPORTED_WEB_TRANSPORT",
													"LOCAL_AUTH_REQUIRED",
													"UPSTREAM_AUTH_REQUIRED",
													"IDENTITY_MISMATCH",
													"APPLICATION_NOT_READY",
													"UPSTREAM_UNREACHABLE",
													"REGISTRATION_STALE",
													"OPERATION_CONFLICT",
													"OPERATION_EXPIRED",
													"OUTCOME_UNKNOWN",
													"BAD_INPUT",
													"CONFIG_REQUIRED",
													"UNSAFE_PATH",
													"UNSAFE_FILE",
													"LINUX_REQUIRED",
													"CONTROL_FAILED",
													"FORBIDDEN",
													"NOT_FOUND",
													"PROXY_PAUSED"
												]
											},
											"checkedAt": { "type": "string" }
										},
										"required": [
											"name",
											"state",
											"checkedAt"
										],
										"additionalProperties": true
									},
									"description": "One entry per named check; `unknown` is never rendered as healthy."
								},
								"capabilities": {
									"type": "object",
									"properties": {
										"controlVersion": { "type": "number" },
										"helperVersion": { "type": "string" },
										"mode": {
											"type": "string",
											"enum": [
												"unsupported",
												"systemd-user",
												"unregistered"
											]
										},
										"actions": {
											"type": "array",
											"items": { "type": "string" }
										}
									},
									"required": [
										"controlVersion",
										"helperVersion",
										"mode",
										"actions"
									],
									"additionalProperties": true
								},
								"service": {
									"type": "object",
									"properties": {
										"unit": { "type": "string" },
										"state": {
											"type": "string",
											"enum": [
												"failed",
												"unknown",
												"active",
												"inactive",
												"activating",
												"deactivating"
											]
										},
										"registered": { "type": "boolean" },
										"registrationRevision": {
											"type": "string",
											"description": "Registration revision observed from the remote helper's `status`. A write action must echo the revision the helper reported, otherwise the helper answers REGISTRATION_STALE. Absent when the helper never reported one, so the caller can tell \"unknown\" from a real value."
										}
									},
									"required": [
										"unit",
										"state",
										"registered"
									],
									"additionalProperties": true
								},
								"serviceOperation": {
									"type": "object",
									"properties": {
										"phase": {
											"type": "string",
											"enum": [
												"failed",
												"completed",
												"waiting",
												"idle",
												"submitting",
												"outcome-unknown"
											]
										},
										"action": {
											"type": "string",
											"enum": [
												"start",
												"stop",
												"restart"
											]
										},
										"operationId": { "type": "string" },
										"code": {
											"type": "string",
											"enum": [
												"SSH_UNAVAILABLE",
												"SSH_AUTH_FAILED",
												"HOST_KEY_REJECTED",
												"SSH_TIMEOUT",
												"HELPER_NOT_FOUND",
												"HELPER_UNSAFE",
												"HELPER_BAD_CONFIG",
												"CONTROL_UNSUPPORTED",
												"SERVICE_UNREGISTERED",
												"SERVICE_STOPPED",
												"SERVICE_FAILED",
												"USER_MANAGER_UNAVAILABLE",
												"DESCRIPTOR_MISSING",
												"DESCRIPTOR_INVALID",
												"DESCRIPTOR_STALE",
												"UNSUPPORTED_WEB_TRANSPORT",
												"LOCAL_AUTH_REQUIRED",
												"UPSTREAM_AUTH_REQUIRED",
												"IDENTITY_MISMATCH",
												"APPLICATION_NOT_READY",
												"UPSTREAM_UNREACHABLE",
												"REGISTRATION_STALE",
												"OPERATION_CONFLICT",
												"OPERATION_EXPIRED",
												"OUTCOME_UNKNOWN",
												"BAD_INPUT",
												"CONFIG_REQUIRED",
												"UNSAFE_PATH",
												"UNSAFE_FILE",
												"LINUX_REQUIRED",
												"CONTROL_FAILED",
												"FORBIDDEN",
												"NOT_FOUND",
												"PROXY_PAUSED"
											]
										},
										"startedAt": { "type": "string" },
										"finishedAt": { "type": "string" }
									},
									"required": ["phase"],
									"additionalProperties": true
								},
								"accessWarning": {
									"type": "string",
									"enum": [
										"SSH_UNAVAILABLE",
										"SSH_AUTH_FAILED",
										"HOST_KEY_REJECTED",
										"SSH_TIMEOUT",
										"HELPER_NOT_FOUND",
										"HELPER_UNSAFE",
										"HELPER_BAD_CONFIG",
										"CONTROL_UNSUPPORTED",
										"SERVICE_UNREGISTERED",
										"SERVICE_STOPPED",
										"SERVICE_FAILED",
										"USER_MANAGER_UNAVAILABLE",
										"DESCRIPTOR_MISSING",
										"DESCRIPTOR_INVALID",
										"DESCRIPTOR_STALE",
										"UNSUPPORTED_WEB_TRANSPORT",
										"LOCAL_AUTH_REQUIRED",
										"UPSTREAM_AUTH_REQUIRED",
										"IDENTITY_MISMATCH",
										"APPLICATION_NOT_READY",
										"UPSTREAM_UNREACHABLE",
										"REGISTRATION_STALE",
										"OPERATION_CONFLICT",
										"OPERATION_EXPIRED",
										"OUTCOME_UNKNOWN",
										"BAD_INPUT",
										"CONFIG_REQUIRED",
										"UNSAFE_PATH",
										"UNSAFE_FILE",
										"LINUX_REQUIRED",
										"CONTROL_FAILED",
										"FORBIDDEN",
										"NOT_FOUND",
										"PROXY_PAUSED"
									],
									"description": "Fixed code when a browser page lost its local authorization; never a credential."
								}
							},
							"required": [
								"phase",
								"generation",
								"diagnostics"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/remote/controller/src/index.ts",
						"line": 99,
						"column": 3
					}
				},
				"remoteWorkspace/getServiceOperation": {
					service: "remoteWorkspace",
					description: "Read a previously submitted action's result. Never submits a new action.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "ref",
						description: "endpoint the receipt belongs to.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "dsh-win-ssh-controller-source/types#EndpointRef",
							create: _harness_remote_controller_remoteWorkspace_getServiceOperation_parameter_0$schema,
							jsonSchemaError: "typert tool schema: selected union branches overlap or have no required discriminator"
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "dsh-win-ssh-controller-source/types#EndpointRef",
							create: _harness_remote_controller_remoteWorkspace_getServiceOperation_parameter_0_strict$schema,
							jsonSchemaError: "typert tool schema: selected union branches overlap or have no required discriminator"
						}
					}, {
						name: "operationId",
						description: "the id used when the action was submitted.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "dsh-win-ssh-controller-source#remoteWorkspace/getServiceOperation:operationId",
							create: _harness_remote_controller_remoteWorkspace_getServiceOperation_parameter_1$schema,
							jsonSchema: { "type": "string" }
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "dsh-win-ssh-controller-source#remoteWorkspace/getServiceOperation:operationId",
							create: _harness_remote_controller_remoteWorkspace_getServiceOperation_parameter_1_strict$schema,
							jsonSchema: { "type": "string" }
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "dsh-win-ssh-controller-source/types#ServiceOperationState",
						create: _harness_remote_controller_remoteWorkspace_getServiceOperation_result$schema,
						description: "the recorded operation state.",
						jsonSchema: {
							"type": "object",
							"properties": {
								"phase": {
									"type": "string",
									"enum": [
										"failed",
										"completed",
										"waiting",
										"idle",
										"submitting",
										"outcome-unknown"
									]
								},
								"action": {
									"type": "string",
									"enum": [
										"start",
										"stop",
										"restart"
									]
								},
								"operationId": { "type": "string" },
								"code": {
									"type": "string",
									"enum": [
										"SSH_UNAVAILABLE",
										"SSH_AUTH_FAILED",
										"HOST_KEY_REJECTED",
										"SSH_TIMEOUT",
										"HELPER_NOT_FOUND",
										"HELPER_UNSAFE",
										"HELPER_BAD_CONFIG",
										"CONTROL_UNSUPPORTED",
										"SERVICE_UNREGISTERED",
										"SERVICE_STOPPED",
										"SERVICE_FAILED",
										"USER_MANAGER_UNAVAILABLE",
										"DESCRIPTOR_MISSING",
										"DESCRIPTOR_INVALID",
										"DESCRIPTOR_STALE",
										"UNSUPPORTED_WEB_TRANSPORT",
										"LOCAL_AUTH_REQUIRED",
										"UPSTREAM_AUTH_REQUIRED",
										"IDENTITY_MISMATCH",
										"APPLICATION_NOT_READY",
										"UPSTREAM_UNREACHABLE",
										"REGISTRATION_STALE",
										"OPERATION_CONFLICT",
										"OPERATION_EXPIRED",
										"OUTCOME_UNKNOWN",
										"BAD_INPUT",
										"CONFIG_REQUIRED",
										"UNSAFE_PATH",
										"UNSAFE_FILE",
										"LINUX_REQUIRED",
										"CONTROL_FAILED",
										"FORBIDDEN",
										"NOT_FOUND",
										"PROXY_PAUSED"
									]
								},
								"startedAt": { "type": "string" },
								"finishedAt": { "type": "string" }
							},
							"required": ["phase"],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/remote/controller/src/index.ts",
						"line": 144,
						"column": 3
					}
				},
				"remoteWorkspace/getState": {
					service: "remoteWorkspace",
					description: "Read the local attachment state.",
					invocation: { kind: "direct" },
					parameters: [],
					result: {
						mode: "strict",
						typeSymbol: "dsh-win-ssh-controller-source/types#RemoteSnapshot",
						create: _harness_remote_controller_remoteWorkspace_getState_result$schema,
						description: "current local connection state without credentials.",
						jsonSchema: {
							"type": "object",
							"properties": {
								"phase": {
									"type": "string",
									"enum": [
										"error",
										"checking",
										"idle",
										"ssh-auth",
										"discovering",
										"forwarding",
										"authenticating",
										"verifying",
										"app-ready",
										"disconnected",
										"reconnecting",
										"identity-mismatch",
										"auth-required",
										"service-stopped"
									]
								},
								"connectionId": { "type": "string" },
								"targetId": { "type": "string" },
								"endpointId": { "type": "string" },
								"hostName": { "type": "string" },
								"instanceId": { "type": "string" },
								"bootId": { "type": "string" },
								"profile": { "type": "string" },
								"workspaceHint": { "type": "string" },
								"generation": { "type": "number" },
								"reason": { "type": "string" },
								"diagnostics": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"name": {
												"type": "string",
												"enum": [
													"ssh",
													"helper",
													"service",
													"descriptor",
													"listener",
													"identity",
													"authentication",
													"events",
													"application"
												]
											},
											"state": {
												"type": "string",
												"enum": [
													"failed",
													"unknown",
													"checking",
													"ok",
													"unsupported"
												]
											},
											"code": {
												"type": "string",
												"enum": [
													"SSH_UNAVAILABLE",
													"SSH_AUTH_FAILED",
													"HOST_KEY_REJECTED",
													"SSH_TIMEOUT",
													"HELPER_NOT_FOUND",
													"HELPER_UNSAFE",
													"HELPER_BAD_CONFIG",
													"CONTROL_UNSUPPORTED",
													"SERVICE_UNREGISTERED",
													"SERVICE_STOPPED",
													"SERVICE_FAILED",
													"USER_MANAGER_UNAVAILABLE",
													"DESCRIPTOR_MISSING",
													"DESCRIPTOR_INVALID",
													"DESCRIPTOR_STALE",
													"UNSUPPORTED_WEB_TRANSPORT",
													"LOCAL_AUTH_REQUIRED",
													"UPSTREAM_AUTH_REQUIRED",
													"IDENTITY_MISMATCH",
													"APPLICATION_NOT_READY",
													"UPSTREAM_UNREACHABLE",
													"REGISTRATION_STALE",
													"OPERATION_CONFLICT",
													"OPERATION_EXPIRED",
													"OUTCOME_UNKNOWN",
													"BAD_INPUT",
													"CONFIG_REQUIRED",
													"UNSAFE_PATH",
													"UNSAFE_FILE",
													"LINUX_REQUIRED",
													"CONTROL_FAILED",
													"FORBIDDEN",
													"NOT_FOUND",
													"PROXY_PAUSED"
												]
											},
											"checkedAt": { "type": "string" }
										},
										"required": [
											"name",
											"state",
											"checkedAt"
										],
										"additionalProperties": true
									},
									"description": "One entry per named check; `unknown` is never rendered as healthy."
								},
								"capabilities": {
									"type": "object",
									"properties": {
										"controlVersion": { "type": "number" },
										"helperVersion": { "type": "string" },
										"mode": {
											"type": "string",
											"enum": [
												"unsupported",
												"systemd-user",
												"unregistered"
											]
										},
										"actions": {
											"type": "array",
											"items": { "type": "string" }
										}
									},
									"required": [
										"controlVersion",
										"helperVersion",
										"mode",
										"actions"
									],
									"additionalProperties": true
								},
								"service": {
									"type": "object",
									"properties": {
										"unit": { "type": "string" },
										"state": {
											"type": "string",
											"enum": [
												"failed",
												"unknown",
												"active",
												"inactive",
												"activating",
												"deactivating"
											]
										},
										"registered": { "type": "boolean" },
										"registrationRevision": {
											"type": "string",
											"description": "Registration revision observed from the remote helper's `status`. A write action must echo the revision the helper reported, otherwise the helper answers REGISTRATION_STALE. Absent when the helper never reported one, so the caller can tell \"unknown\" from a real value."
										}
									},
									"required": [
										"unit",
										"state",
										"registered"
									],
									"additionalProperties": true
								},
								"serviceOperation": {
									"type": "object",
									"properties": {
										"phase": {
											"type": "string",
											"enum": [
												"failed",
												"completed",
												"waiting",
												"idle",
												"submitting",
												"outcome-unknown"
											]
										},
										"action": {
											"type": "string",
											"enum": [
												"start",
												"stop",
												"restart"
											]
										},
										"operationId": { "type": "string" },
										"code": {
											"type": "string",
											"enum": [
												"SSH_UNAVAILABLE",
												"SSH_AUTH_FAILED",
												"HOST_KEY_REJECTED",
												"SSH_TIMEOUT",
												"HELPER_NOT_FOUND",
												"HELPER_UNSAFE",
												"HELPER_BAD_CONFIG",
												"CONTROL_UNSUPPORTED",
												"SERVICE_UNREGISTERED",
												"SERVICE_STOPPED",
												"SERVICE_FAILED",
												"USER_MANAGER_UNAVAILABLE",
												"DESCRIPTOR_MISSING",
												"DESCRIPTOR_INVALID",
												"DESCRIPTOR_STALE",
												"UNSUPPORTED_WEB_TRANSPORT",
												"LOCAL_AUTH_REQUIRED",
												"UPSTREAM_AUTH_REQUIRED",
												"IDENTITY_MISMATCH",
												"APPLICATION_NOT_READY",
												"UPSTREAM_UNREACHABLE",
												"REGISTRATION_STALE",
												"OPERATION_CONFLICT",
												"OPERATION_EXPIRED",
												"OUTCOME_UNKNOWN",
												"BAD_INPUT",
												"CONFIG_REQUIRED",
												"UNSAFE_PATH",
												"UNSAFE_FILE",
												"LINUX_REQUIRED",
												"CONTROL_FAILED",
												"FORBIDDEN",
												"NOT_FOUND",
												"PROXY_PAUSED"
											]
										},
										"startedAt": { "type": "string" },
										"finishedAt": { "type": "string" }
									},
									"required": ["phase"],
									"additionalProperties": true
								},
								"accessWarning": {
									"type": "string",
									"enum": [
										"SSH_UNAVAILABLE",
										"SSH_AUTH_FAILED",
										"HOST_KEY_REJECTED",
										"SSH_TIMEOUT",
										"HELPER_NOT_FOUND",
										"HELPER_UNSAFE",
										"HELPER_BAD_CONFIG",
										"CONTROL_UNSUPPORTED",
										"SERVICE_UNREGISTERED",
										"SERVICE_STOPPED",
										"SERVICE_FAILED",
										"USER_MANAGER_UNAVAILABLE",
										"DESCRIPTOR_MISSING",
										"DESCRIPTOR_INVALID",
										"DESCRIPTOR_STALE",
										"UNSUPPORTED_WEB_TRANSPORT",
										"LOCAL_AUTH_REQUIRED",
										"UPSTREAM_AUTH_REQUIRED",
										"IDENTITY_MISMATCH",
										"APPLICATION_NOT_READY",
										"UPSTREAM_UNREACHABLE",
										"REGISTRATION_STALE",
										"OPERATION_CONFLICT",
										"OPERATION_EXPIRED",
										"OUTCOME_UNKNOWN",
										"BAD_INPUT",
										"CONFIG_REQUIRED",
										"UNSAFE_PATH",
										"UNSAFE_FILE",
										"LINUX_REQUIRED",
										"CONTROL_FAILED",
										"FORBIDDEN",
										"NOT_FOUND",
										"PROXY_PAUSED"
									],
									"description": "Fixed code when a browser page lost its local authorization; never a credential."
								}
							},
							"required": [
								"phase",
								"generation",
								"diagnostics"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/remote/controller/src/index.ts",
						"line": 91,
						"column": 3
					}
				},
				"remoteWorkspace/inspectEndpoint": {
					service: "remoteWorkspace",
					description: "Read-only preflight for a saved target or a first-time SSH alias. Never saves a target and never starts a remote service.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "ref",
						description: "mutually exclusive endpoint reference.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "dsh-win-ssh-controller-source/types#EndpointRef",
							create: _harness_remote_controller_remoteWorkspace_inspectEndpoint_parameter_0$schema,
							jsonSchemaError: "typert tool schema: selected union branches overlap or have no required discriminator"
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "dsh-win-ssh-controller-source/types#EndpointRef",
							create: _harness_remote_controller_remoteWorkspace_inspectEndpoint_parameter_0_strict$schema,
							jsonSchemaError: "typert tool schema: selected union branches overlap or have no required discriminator"
						}
					}, {
						name: "operationId",
						description: "idempotency key for this inspection.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "dsh-win-ssh-controller-source#remoteWorkspace/inspectEndpoint:operationId",
							create: _harness_remote_controller_remoteWorkspace_inspectEndpoint_parameter_1$schema,
							jsonSchema: { "type": "string" }
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "dsh-win-ssh-controller-source#remoteWorkspace/inspectEndpoint:operationId",
							create: _harness_remote_controller_remoteWorkspace_inspectEndpoint_parameter_1_strict$schema,
							jsonSchema: { "type": "string" }
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "dsh-win-ssh-controller-source/types#RemoteInspection",
						create: _harness_remote_controller_remoteWorkspace_inspectEndpoint_result$schema,
						description: "capability, service and layered diagnostic summary.",
						jsonSchema: {
							"type": "object",
							"properties": {
								"sshAlias": { "type": "string" },
								"instanceKey": { "type": "string" },
								"known": { "type": "boolean" },
								"capabilities": {
									"type": "object",
									"properties": {
										"controlVersion": { "type": "number" },
										"helperVersion": { "type": "string" },
										"mode": {
											"type": "string",
											"enum": [
												"unsupported",
												"systemd-user",
												"unregistered"
											]
										},
										"actions": {
											"type": "array",
											"items": { "type": "string" }
										}
									},
									"required": [
										"controlVersion",
										"helperVersion",
										"mode",
										"actions"
									],
									"additionalProperties": true
								},
								"service": {
									"type": "object",
									"properties": {
										"unit": { "type": "string" },
										"state": {
											"type": "string",
											"enum": [
												"failed",
												"unknown",
												"active",
												"inactive",
												"activating",
												"deactivating"
											]
										},
										"registered": { "type": "boolean" },
										"registrationRevision": {
											"type": "string",
											"description": "Registration revision observed from the remote helper's `status`. A write action must echo the revision the helper reported, otherwise the helper answers REGISTRATION_STALE. Absent when the helper never reported one, so the caller can tell \"unknown\" from a real value."
										}
									},
									"required": [
										"unit",
										"state",
										"registered"
									],
									"additionalProperties": true
								},
								"diagnostics": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"name": {
												"type": "string",
												"enum": [
													"ssh",
													"helper",
													"service",
													"descriptor",
													"listener",
													"identity",
													"authentication",
													"events",
													"application"
												]
											},
											"state": {
												"type": "string",
												"enum": [
													"failed",
													"unknown",
													"checking",
													"ok",
													"unsupported"
												]
											},
											"code": {
												"type": "string",
												"enum": [
													"SSH_UNAVAILABLE",
													"SSH_AUTH_FAILED",
													"HOST_KEY_REJECTED",
													"SSH_TIMEOUT",
													"HELPER_NOT_FOUND",
													"HELPER_UNSAFE",
													"HELPER_BAD_CONFIG",
													"CONTROL_UNSUPPORTED",
													"SERVICE_UNREGISTERED",
													"SERVICE_STOPPED",
													"SERVICE_FAILED",
													"USER_MANAGER_UNAVAILABLE",
													"DESCRIPTOR_MISSING",
													"DESCRIPTOR_INVALID",
													"DESCRIPTOR_STALE",
													"UNSUPPORTED_WEB_TRANSPORT",
													"LOCAL_AUTH_REQUIRED",
													"UPSTREAM_AUTH_REQUIRED",
													"IDENTITY_MISMATCH",
													"APPLICATION_NOT_READY",
													"UPSTREAM_UNREACHABLE",
													"REGISTRATION_STALE",
													"OPERATION_CONFLICT",
													"OPERATION_EXPIRED",
													"OUTCOME_UNKNOWN",
													"BAD_INPUT",
													"CONFIG_REQUIRED",
													"UNSAFE_PATH",
													"UNSAFE_FILE",
													"LINUX_REQUIRED",
													"CONTROL_FAILED",
													"FORBIDDEN",
													"NOT_FOUND",
													"PROXY_PAUSED"
												]
											},
											"checkedAt": { "type": "string" }
										},
										"required": [
											"name",
											"state",
											"checkedAt"
										],
										"additionalProperties": true
									}
								},
								"checkedAt": { "type": "string" }
							},
							"required": [
								"sshAlias",
								"instanceKey",
								"known",
								"diagnostics",
								"checkedAt"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/remote/controller/src/index.ts",
						"line": 117,
						"column": 3
					}
				},
				"remoteWorkspace/listAliases": {
					service: "remoteWorkspace",
					description: "Read selectable aliases from the user's OpenSSH configuration.",
					invocation: { kind: "direct" },
					parameters: [],
					result: {
						mode: "strict",
						typeSymbol: "dsh-win-ssh-controller-source#remoteWorkspace/listAliases:result",
						create: _harness_remote_controller_remoteWorkspace_listAliases_result$schema,
						description: "literal Host names without credentials or SSH configuration content.",
						jsonSchema: {
							"type": "array",
							"items": { "type": "string" }
						}
					},
					sourceLocation: {
						"file": "packages/remote/controller/src/index.ts",
						"line": 54,
						"column": 3
					}
				},
				"remoteWorkspace/listTargets": {
					service: "remoteWorkspace",
					description: "Read configured remote attachment targets.",
					invocation: { kind: "direct" },
					parameters: [],
					result: {
						mode: "strict",
						typeSymbol: "dsh-win-ssh-controller-source#remoteWorkspace/listTargets:result",
						create: _harness_remote_controller_remoteWorkspace_listTargets_result$schema,
						description: "all non-secret target records.",
						jsonSchema: {
							"type": "array",
							"items": {
								"type": "object",
								"properties": {
									"id": { "type": "string" },
									"name": { "type": "string" },
									"instanceKey": { "type": "string" },
									"instanceId": { "type": "string" },
									"profile": { "type": "string" },
									"workspaceHint": { "type": "string" },
									"remotePort": { "type": "number" },
									"endpoints": {
										"type": "array",
										"items": {
											"type": "object",
											"properties": {
												"id": { "type": "string" },
												"kind": {
													"type": "string",
													"enum": [
														"lan",
														"frp-tcp",
														"stcp"
													]
												},
												"sshAlias": { "type": "string" }
											},
											"required": [
												"id",
												"kind",
												"sshAlias"
											],
											"additionalProperties": true
										}
									}
								},
								"required": [
									"id",
									"name",
									"instanceKey",
									"instanceId",
									"profile",
									"workspaceHint",
									"remotePort",
									"endpoints"
								],
								"additionalProperties": true
							}
						}
					},
					sourceLocation: {
						"file": "packages/remote/controller/src/index.ts",
						"line": 48,
						"column": 3
					}
				},
				"remoteWorkspace/quickConnect": {
					service: "remoteWorkspace",
					description: "Discover, save and connect a target through strict OpenSSH verification.",
					invocation: { kind: "direct" },
					parameters: [
						{
							name: "sshAlias",
							description: "configured SSH alias.",
							source: "json",
							codec: {
								mode: "strict",
								typeSymbol: "dsh-win-ssh-controller-source#remoteWorkspace/quickConnect:sshAlias",
								create: _harness_remote_controller_remoteWorkspace_quickConnect_parameter_0$schema,
								jsonSchema: { "type": "string" }
							},
							strictCodec: {
								mode: "strict",
								typeSymbol: "dsh-win-ssh-controller-source#remoteWorkspace/quickConnect:sshAlias",
								create: _harness_remote_controller_remoteWorkspace_quickConnect_parameter_0_strict$schema,
								jsonSchema: { "type": "string" }
							}
						},
						{
							name: "instanceKey",
							description: "Companion key.",
							source: "json",
							codec: {
								mode: "strict",
								typeSymbol: "dsh-win-ssh-controller-source#remoteWorkspace/quickConnect:instanceKey",
								create: _harness_remote_controller_remoteWorkspace_quickConnect_parameter_1$schema,
								jsonSchema: { "type": "string" }
							},
							strictCodec: {
								mode: "strict",
								typeSymbol: "dsh-win-ssh-controller-source#remoteWorkspace/quickConnect:instanceKey",
								create: _harness_remote_controller_remoteWorkspace_quickConnect_parameter_1_strict$schema,
								jsonSchema: { "type": "string" }
							}
						},
						{
							name: "operationId",
							description: "idempotency key for this connection intent.",
							source: "json",
							codec: {
								mode: "strict",
								typeSymbol: "dsh-win-ssh-controller-source#remoteWorkspace/quickConnect:operationId",
								create: _harness_remote_controller_remoteWorkspace_quickConnect_parameter_2$schema,
								jsonSchema: { "type": "string" }
							},
							strictCodec: {
								mode: "strict",
								typeSymbol: "dsh-win-ssh-controller-source#remoteWorkspace/quickConnect:operationId",
								create: _harness_remote_controller_remoteWorkspace_quickConnect_parameter_2_strict$schema,
								jsonSchema: { "type": "string" }
							}
						}
					],
					result: {
						mode: "strict",
						typeSymbol: "dsh-win-ssh-controller-source/types#RemoteSnapshot",
						create: _harness_remote_controller_remoteWorkspace_quickConnect_result$schema,
						description: "authenticated connection state.",
						jsonSchema: {
							"type": "object",
							"properties": {
								"phase": {
									"type": "string",
									"enum": [
										"error",
										"checking",
										"idle",
										"ssh-auth",
										"discovering",
										"forwarding",
										"authenticating",
										"verifying",
										"app-ready",
										"disconnected",
										"reconnecting",
										"identity-mismatch",
										"auth-required",
										"service-stopped"
									]
								},
								"connectionId": { "type": "string" },
								"targetId": { "type": "string" },
								"endpointId": { "type": "string" },
								"hostName": { "type": "string" },
								"instanceId": { "type": "string" },
								"bootId": { "type": "string" },
								"profile": { "type": "string" },
								"workspaceHint": { "type": "string" },
								"generation": { "type": "number" },
								"reason": { "type": "string" },
								"diagnostics": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"name": {
												"type": "string",
												"enum": [
													"ssh",
													"helper",
													"service",
													"descriptor",
													"listener",
													"identity",
													"authentication",
													"events",
													"application"
												]
											},
											"state": {
												"type": "string",
												"enum": [
													"failed",
													"unknown",
													"checking",
													"ok",
													"unsupported"
												]
											},
											"code": {
												"type": "string",
												"enum": [
													"SSH_UNAVAILABLE",
													"SSH_AUTH_FAILED",
													"HOST_KEY_REJECTED",
													"SSH_TIMEOUT",
													"HELPER_NOT_FOUND",
													"HELPER_UNSAFE",
													"HELPER_BAD_CONFIG",
													"CONTROL_UNSUPPORTED",
													"SERVICE_UNREGISTERED",
													"SERVICE_STOPPED",
													"SERVICE_FAILED",
													"USER_MANAGER_UNAVAILABLE",
													"DESCRIPTOR_MISSING",
													"DESCRIPTOR_INVALID",
													"DESCRIPTOR_STALE",
													"UNSUPPORTED_WEB_TRANSPORT",
													"LOCAL_AUTH_REQUIRED",
													"UPSTREAM_AUTH_REQUIRED",
													"IDENTITY_MISMATCH",
													"APPLICATION_NOT_READY",
													"UPSTREAM_UNREACHABLE",
													"REGISTRATION_STALE",
													"OPERATION_CONFLICT",
													"OPERATION_EXPIRED",
													"OUTCOME_UNKNOWN",
													"BAD_INPUT",
													"CONFIG_REQUIRED",
													"UNSAFE_PATH",
													"UNSAFE_FILE",
													"LINUX_REQUIRED",
													"CONTROL_FAILED",
													"FORBIDDEN",
													"NOT_FOUND",
													"PROXY_PAUSED"
												]
											},
											"checkedAt": { "type": "string" }
										},
										"required": [
											"name",
											"state",
											"checkedAt"
										],
										"additionalProperties": true
									},
									"description": "One entry per named check; `unknown` is never rendered as healthy."
								},
								"capabilities": {
									"type": "object",
									"properties": {
										"controlVersion": { "type": "number" },
										"helperVersion": { "type": "string" },
										"mode": {
											"type": "string",
											"enum": [
												"unsupported",
												"systemd-user",
												"unregistered"
											]
										},
										"actions": {
											"type": "array",
											"items": { "type": "string" }
										}
									},
									"required": [
										"controlVersion",
										"helperVersion",
										"mode",
										"actions"
									],
									"additionalProperties": true
								},
								"service": {
									"type": "object",
									"properties": {
										"unit": { "type": "string" },
										"state": {
											"type": "string",
											"enum": [
												"failed",
												"unknown",
												"active",
												"inactive",
												"activating",
												"deactivating"
											]
										},
										"registered": { "type": "boolean" },
										"registrationRevision": {
											"type": "string",
											"description": "Registration revision observed from the remote helper's `status`. A write action must echo the revision the helper reported, otherwise the helper answers REGISTRATION_STALE. Absent when the helper never reported one, so the caller can tell \"unknown\" from a real value."
										}
									},
									"required": [
										"unit",
										"state",
										"registered"
									],
									"additionalProperties": true
								},
								"serviceOperation": {
									"type": "object",
									"properties": {
										"phase": {
											"type": "string",
											"enum": [
												"failed",
												"completed",
												"waiting",
												"idle",
												"submitting",
												"outcome-unknown"
											]
										},
										"action": {
											"type": "string",
											"enum": [
												"start",
												"stop",
												"restart"
											]
										},
										"operationId": { "type": "string" },
										"code": {
											"type": "string",
											"enum": [
												"SSH_UNAVAILABLE",
												"SSH_AUTH_FAILED",
												"HOST_KEY_REJECTED",
												"SSH_TIMEOUT",
												"HELPER_NOT_FOUND",
												"HELPER_UNSAFE",
												"HELPER_BAD_CONFIG",
												"CONTROL_UNSUPPORTED",
												"SERVICE_UNREGISTERED",
												"SERVICE_STOPPED",
												"SERVICE_FAILED",
												"USER_MANAGER_UNAVAILABLE",
												"DESCRIPTOR_MISSING",
												"DESCRIPTOR_INVALID",
												"DESCRIPTOR_STALE",
												"UNSUPPORTED_WEB_TRANSPORT",
												"LOCAL_AUTH_REQUIRED",
												"UPSTREAM_AUTH_REQUIRED",
												"IDENTITY_MISMATCH",
												"APPLICATION_NOT_READY",
												"UPSTREAM_UNREACHABLE",
												"REGISTRATION_STALE",
												"OPERATION_CONFLICT",
												"OPERATION_EXPIRED",
												"OUTCOME_UNKNOWN",
												"BAD_INPUT",
												"CONFIG_REQUIRED",
												"UNSAFE_PATH",
												"UNSAFE_FILE",
												"LINUX_REQUIRED",
												"CONTROL_FAILED",
												"FORBIDDEN",
												"NOT_FOUND",
												"PROXY_PAUSED"
											]
										},
										"startedAt": { "type": "string" },
										"finishedAt": { "type": "string" }
									},
									"required": ["phase"],
									"additionalProperties": true
								},
								"accessWarning": {
									"type": "string",
									"enum": [
										"SSH_UNAVAILABLE",
										"SSH_AUTH_FAILED",
										"HOST_KEY_REJECTED",
										"SSH_TIMEOUT",
										"HELPER_NOT_FOUND",
										"HELPER_UNSAFE",
										"HELPER_BAD_CONFIG",
										"CONTROL_UNSUPPORTED",
										"SERVICE_UNREGISTERED",
										"SERVICE_STOPPED",
										"SERVICE_FAILED",
										"USER_MANAGER_UNAVAILABLE",
										"DESCRIPTOR_MISSING",
										"DESCRIPTOR_INVALID",
										"DESCRIPTOR_STALE",
										"UNSUPPORTED_WEB_TRANSPORT",
										"LOCAL_AUTH_REQUIRED",
										"UPSTREAM_AUTH_REQUIRED",
										"IDENTITY_MISMATCH",
										"APPLICATION_NOT_READY",
										"UPSTREAM_UNREACHABLE",
										"REGISTRATION_STALE",
										"OPERATION_CONFLICT",
										"OPERATION_EXPIRED",
										"OUTCOME_UNKNOWN",
										"BAD_INPUT",
										"CONFIG_REQUIRED",
										"UNSAFE_PATH",
										"UNSAFE_FILE",
										"LINUX_REQUIRED",
										"CONTROL_FAILED",
										"FORBIDDEN",
										"NOT_FOUND",
										"PROXY_PAUSED"
									],
									"description": "Fixed code when a browser page lost its local authorization; never a credential."
								}
							},
							"required": [
								"phase",
								"generation",
								"diagnostics"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/remote/controller/src/index.ts",
						"line": 62,
						"column": 3
					}
				},
				"remoteWorkspace/refreshAuthentication": {
					service: "remoteWorkspace",
					description: "Re-authenticate the active attachment without touching the remote service.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "connectionId",
						description: "active attachment.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "dsh-win-ssh-controller-source#remoteWorkspace/refreshAuthentication:connectionId",
							create: _harness_remote_controller_remoteWorkspace_refreshAuthentication_parameter_0$schema,
							jsonSchema: { "type": "string" }
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "dsh-win-ssh-controller-source#remoteWorkspace/refreshAuthentication:connectionId",
							create: _harness_remote_controller_remoteWorkspace_refreshAuthentication_parameter_0_strict$schema,
							jsonSchema: { "type": "string" }
						}
					}, {
						name: "operationId",
						description: "idempotency key for this refresh.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "dsh-win-ssh-controller-source#remoteWorkspace/refreshAuthentication:operationId",
							create: _harness_remote_controller_remoteWorkspace_refreshAuthentication_parameter_1$schema,
							jsonSchema: { "type": "string" }
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "dsh-win-ssh-controller-source#remoteWorkspace/refreshAuthentication:operationId",
							create: _harness_remote_controller_remoteWorkspace_refreshAuthentication_parameter_1_strict$schema,
							jsonSchema: { "type": "string" }
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "dsh-win-ssh-controller-source/types#RemoteSnapshot",
						create: _harness_remote_controller_remoteWorkspace_refreshAuthentication_result$schema,
						description: "the new snapshot.",
						jsonSchema: {
							"type": "object",
							"properties": {
								"phase": {
									"type": "string",
									"enum": [
										"error",
										"checking",
										"idle",
										"ssh-auth",
										"discovering",
										"forwarding",
										"authenticating",
										"verifying",
										"app-ready",
										"disconnected",
										"reconnecting",
										"identity-mismatch",
										"auth-required",
										"service-stopped"
									]
								},
								"connectionId": { "type": "string" },
								"targetId": { "type": "string" },
								"endpointId": { "type": "string" },
								"hostName": { "type": "string" },
								"instanceId": { "type": "string" },
								"bootId": { "type": "string" },
								"profile": { "type": "string" },
								"workspaceHint": { "type": "string" },
								"generation": { "type": "number" },
								"reason": { "type": "string" },
								"diagnostics": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"name": {
												"type": "string",
												"enum": [
													"ssh",
													"helper",
													"service",
													"descriptor",
													"listener",
													"identity",
													"authentication",
													"events",
													"application"
												]
											},
											"state": {
												"type": "string",
												"enum": [
													"failed",
													"unknown",
													"checking",
													"ok",
													"unsupported"
												]
											},
											"code": {
												"type": "string",
												"enum": [
													"SSH_UNAVAILABLE",
													"SSH_AUTH_FAILED",
													"HOST_KEY_REJECTED",
													"SSH_TIMEOUT",
													"HELPER_NOT_FOUND",
													"HELPER_UNSAFE",
													"HELPER_BAD_CONFIG",
													"CONTROL_UNSUPPORTED",
													"SERVICE_UNREGISTERED",
													"SERVICE_STOPPED",
													"SERVICE_FAILED",
													"USER_MANAGER_UNAVAILABLE",
													"DESCRIPTOR_MISSING",
													"DESCRIPTOR_INVALID",
													"DESCRIPTOR_STALE",
													"UNSUPPORTED_WEB_TRANSPORT",
													"LOCAL_AUTH_REQUIRED",
													"UPSTREAM_AUTH_REQUIRED",
													"IDENTITY_MISMATCH",
													"APPLICATION_NOT_READY",
													"UPSTREAM_UNREACHABLE",
													"REGISTRATION_STALE",
													"OPERATION_CONFLICT",
													"OPERATION_EXPIRED",
													"OUTCOME_UNKNOWN",
													"BAD_INPUT",
													"CONFIG_REQUIRED",
													"UNSAFE_PATH",
													"UNSAFE_FILE",
													"LINUX_REQUIRED",
													"CONTROL_FAILED",
													"FORBIDDEN",
													"NOT_FOUND",
													"PROXY_PAUSED"
												]
											},
											"checkedAt": { "type": "string" }
										},
										"required": [
											"name",
											"state",
											"checkedAt"
										],
										"additionalProperties": true
									},
									"description": "One entry per named check; `unknown` is never rendered as healthy."
								},
								"capabilities": {
									"type": "object",
									"properties": {
										"controlVersion": { "type": "number" },
										"helperVersion": { "type": "string" },
										"mode": {
											"type": "string",
											"enum": [
												"unsupported",
												"systemd-user",
												"unregistered"
											]
										},
										"actions": {
											"type": "array",
											"items": { "type": "string" }
										}
									},
									"required": [
										"controlVersion",
										"helperVersion",
										"mode",
										"actions"
									],
									"additionalProperties": true
								},
								"service": {
									"type": "object",
									"properties": {
										"unit": { "type": "string" },
										"state": {
											"type": "string",
											"enum": [
												"failed",
												"unknown",
												"active",
												"inactive",
												"activating",
												"deactivating"
											]
										},
										"registered": { "type": "boolean" },
										"registrationRevision": {
											"type": "string",
											"description": "Registration revision observed from the remote helper's `status`. A write action must echo the revision the helper reported, otherwise the helper answers REGISTRATION_STALE. Absent when the helper never reported one, so the caller can tell \"unknown\" from a real value."
										}
									},
									"required": [
										"unit",
										"state",
										"registered"
									],
									"additionalProperties": true
								},
								"serviceOperation": {
									"type": "object",
									"properties": {
										"phase": {
											"type": "string",
											"enum": [
												"failed",
												"completed",
												"waiting",
												"idle",
												"submitting",
												"outcome-unknown"
											]
										},
										"action": {
											"type": "string",
											"enum": [
												"start",
												"stop",
												"restart"
											]
										},
										"operationId": { "type": "string" },
										"code": {
											"type": "string",
											"enum": [
												"SSH_UNAVAILABLE",
												"SSH_AUTH_FAILED",
												"HOST_KEY_REJECTED",
												"SSH_TIMEOUT",
												"HELPER_NOT_FOUND",
												"HELPER_UNSAFE",
												"HELPER_BAD_CONFIG",
												"CONTROL_UNSUPPORTED",
												"SERVICE_UNREGISTERED",
												"SERVICE_STOPPED",
												"SERVICE_FAILED",
												"USER_MANAGER_UNAVAILABLE",
												"DESCRIPTOR_MISSING",
												"DESCRIPTOR_INVALID",
												"DESCRIPTOR_STALE",
												"UNSUPPORTED_WEB_TRANSPORT",
												"LOCAL_AUTH_REQUIRED",
												"UPSTREAM_AUTH_REQUIRED",
												"IDENTITY_MISMATCH",
												"APPLICATION_NOT_READY",
												"UPSTREAM_UNREACHABLE",
												"REGISTRATION_STALE",
												"OPERATION_CONFLICT",
												"OPERATION_EXPIRED",
												"OUTCOME_UNKNOWN",
												"BAD_INPUT",
												"CONFIG_REQUIRED",
												"UNSAFE_PATH",
												"UNSAFE_FILE",
												"LINUX_REQUIRED",
												"CONTROL_FAILED",
												"FORBIDDEN",
												"NOT_FOUND",
												"PROXY_PAUSED"
											]
										},
										"startedAt": { "type": "string" },
										"finishedAt": { "type": "string" }
									},
									"required": ["phase"],
									"additionalProperties": true
								},
								"accessWarning": {
									"type": "string",
									"enum": [
										"SSH_UNAVAILABLE",
										"SSH_AUTH_FAILED",
										"HOST_KEY_REJECTED",
										"SSH_TIMEOUT",
										"HELPER_NOT_FOUND",
										"HELPER_UNSAFE",
										"HELPER_BAD_CONFIG",
										"CONTROL_UNSUPPORTED",
										"SERVICE_UNREGISTERED",
										"SERVICE_STOPPED",
										"SERVICE_FAILED",
										"USER_MANAGER_UNAVAILABLE",
										"DESCRIPTOR_MISSING",
										"DESCRIPTOR_INVALID",
										"DESCRIPTOR_STALE",
										"UNSUPPORTED_WEB_TRANSPORT",
										"LOCAL_AUTH_REQUIRED",
										"UPSTREAM_AUTH_REQUIRED",
										"IDENTITY_MISMATCH",
										"APPLICATION_NOT_READY",
										"UPSTREAM_UNREACHABLE",
										"REGISTRATION_STALE",
										"OPERATION_CONFLICT",
										"OPERATION_EXPIRED",
										"OUTCOME_UNKNOWN",
										"BAD_INPUT",
										"CONFIG_REQUIRED",
										"UNSAFE_PATH",
										"UNSAFE_FILE",
										"LINUX_REQUIRED",
										"CONTROL_FAILED",
										"FORBIDDEN",
										"NOT_FOUND",
										"PROXY_PAUSED"
									],
									"description": "Fixed code when a browser page lost its local authorization; never a credential."
								}
							},
							"required": [
								"phase",
								"generation",
								"diagnostics"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/remote/controller/src/index.ts",
						"line": 155,
						"column": 3
					}
				},
				"remoteWorkspace/saveTarget": {
					service: "remoteWorkspace",
					description: "Persist one complete target without credentials.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "target",
						description: "complete non-secret record.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "dsh-win-ssh-controller-source/types#RemoteTarget",
							create: _harness_remote_controller_remoteWorkspace_saveTarget_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"id": { "type": "string" },
									"name": { "type": "string" },
									"instanceKey": { "type": "string" },
									"instanceId": { "type": "string" },
									"profile": { "type": "string" },
									"workspaceHint": { "type": "string" },
									"remotePort": { "type": "number" },
									"endpoints": {
										"type": "array",
										"items": {
											"type": "object",
											"properties": {
												"id": { "type": "string" },
												"kind": {
													"type": "string",
													"enum": [
														"lan",
														"frp-tcp",
														"stcp"
													]
												},
												"sshAlias": { "type": "string" }
											},
											"required": [
												"id",
												"kind",
												"sshAlias"
											],
											"additionalProperties": true
										}
									}
								},
								"required": [
									"id",
									"name",
									"instanceKey",
									"instanceId",
									"profile",
									"workspaceHint",
									"remotePort",
									"endpoints"
								],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "dsh-win-ssh-controller-source/types#RemoteTarget",
							create: _harness_remote_controller_remoteWorkspace_saveTarget_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"id": { "type": "string" },
									"name": { "type": "string" },
									"instanceKey": { "type": "string" },
									"instanceId": { "type": "string" },
									"profile": { "type": "string" },
									"workspaceHint": { "type": "string" },
									"remotePort": { "type": "number" },
									"endpoints": {
										"type": "array",
										"items": {
											"type": "object",
											"properties": {
												"id": { "type": "string" },
												"kind": {
													"type": "string",
													"enum": [
														"lan",
														"frp-tcp",
														"stcp"
													]
												},
												"sshAlias": { "type": "string" }
											},
											"required": [
												"id",
												"kind",
												"sshAlias"
											],
											"additionalProperties": false
										}
									}
								},
								"required": [
									"id",
									"name",
									"instanceKey",
									"instanceId",
									"profile",
									"workspaceHint",
									"remotePort",
									"endpoints"
								],
								"additionalProperties": false
							}
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "dsh-win-ssh-controller-source#remoteWorkspace/saveTarget:result",
						create: _harness_remote_controller_remoteWorkspace_saveTarget_result$schema,
						description: "saved target records.",
						jsonSchema: {
							"type": "array",
							"items": {
								"type": "object",
								"properties": {
									"id": { "type": "string" },
									"name": { "type": "string" },
									"instanceKey": { "type": "string" },
									"instanceId": { "type": "string" },
									"profile": { "type": "string" },
									"workspaceHint": { "type": "string" },
									"remotePort": { "type": "number" },
									"endpoints": {
										"type": "array",
										"items": {
											"type": "object",
											"properties": {
												"id": { "type": "string" },
												"kind": {
													"type": "string",
													"enum": [
														"lan",
														"frp-tcp",
														"stcp"
													]
												},
												"sshAlias": { "type": "string" }
											},
											"required": [
												"id",
												"kind",
												"sshAlias"
											],
											"additionalProperties": true
										}
									}
								},
								"required": [
									"id",
									"name",
									"instanceKey",
									"instanceId",
									"profile",
									"workspaceHint",
									"remotePort",
									"endpoints"
								],
								"additionalProperties": true
							}
						}
					},
					sourceLocation: {
						"file": "packages/remote/controller/src/index.ts",
						"line": 72,
						"column": 3
					}
				},
				"remoteWorkspace/serviceAction": {
					service: "remoteWorkspace",
					description: "Submit exactly one restricted service action against the active attachment.",
					invocation: { kind: "direct" },
					parameters: [
						{
							name: "ref",
							description: "endpoint the action applies to.",
							source: "json",
							codec: {
								mode: "strict",
								typeSymbol: "dsh-win-ssh-controller-source/types#EndpointRef",
								create: _harness_remote_controller_remoteWorkspace_serviceAction_parameter_0$schema,
								jsonSchemaError: "typert tool schema: selected union branches overlap or have no required discriminator"
							},
							strictCodec: {
								mode: "strict",
								typeSymbol: "dsh-win-ssh-controller-source/types#EndpointRef",
								create: _harness_remote_controller_remoteWorkspace_serviceAction_parameter_0_strict$schema,
								jsonSchemaError: "typert tool schema: selected union branches overlap or have no required discriminator"
							}
						},
						{
							name: "action",
							description: "start, stop or restart.",
							source: "json",
							codec: {
								mode: "strict",
								typeSymbol: "dsh-win-ssh-controller-source#remoteWorkspace/serviceAction:action",
								create: _harness_remote_controller_remoteWorkspace_serviceAction_parameter_1$schema,
								jsonSchema: {
									"type": "string",
									"enum": [
										"start",
										"stop",
										"restart"
									]
								}
							},
							strictCodec: {
								mode: "strict",
								typeSymbol: "dsh-win-ssh-controller-source#remoteWorkspace/serviceAction:action",
								create: _harness_remote_controller_remoteWorkspace_serviceAction_parameter_1_strict$schema,
								jsonSchema: {
									"type": "string",
									"enum": [
										"start",
										"stop",
										"restart"
									]
								}
							}
						},
						{
							name: "operationId",
							description: "idempotency key, reused when asking for the result.",
							source: "json",
							codec: {
								mode: "strict",
								typeSymbol: "dsh-win-ssh-controller-source#remoteWorkspace/serviceAction:operationId",
								create: _harness_remote_controller_remoteWorkspace_serviceAction_parameter_2$schema,
								jsonSchema: { "type": "string" }
							},
							strictCodec: {
								mode: "strict",
								typeSymbol: "dsh-win-ssh-controller-source#remoteWorkspace/serviceAction:operationId",
								create: _harness_remote_controller_remoteWorkspace_serviceAction_parameter_2_strict$schema,
								jsonSchema: { "type": "string" }
							}
						},
						{
							name: "issuedAt",
							description: "ISO timestamp of the intent.",
							source: "json",
							codec: {
								mode: "strict",
								typeSymbol: "dsh-win-ssh-controller-source#remoteWorkspace/serviceAction:issuedAt",
								create: _harness_remote_controller_remoteWorkspace_serviceAction_parameter_3$schema,
								jsonSchema: { "type": "string" }
							},
							strictCodec: {
								mode: "strict",
								typeSymbol: "dsh-win-ssh-controller-source#remoteWorkspace/serviceAction:issuedAt",
								create: _harness_remote_controller_remoteWorkspace_serviceAction_parameter_3_strict$schema,
								jsonSchema: { "type": "string" }
							}
						},
						{
							name: "registrationRevision",
							description: "revision the caller observed.",
							source: "json",
							codec: {
								mode: "strict",
								typeSymbol: "dsh-win-ssh-controller-source#remoteWorkspace/serviceAction:registrationRevision",
								create: _harness_remote_controller_remoteWorkspace_serviceAction_parameter_4$schema,
								jsonSchema: { "type": "string" }
							},
							strictCodec: {
								mode: "strict",
								typeSymbol: "dsh-win-ssh-controller-source#remoteWorkspace/serviceAction:registrationRevision",
								create: _harness_remote_controller_remoteWorkspace_serviceAction_parameter_4_strict$schema,
								jsonSchema: { "type": "string" }
							}
						},
						{
							name: "expectedInstanceId",
							description: "pinned instance id, when known.",
							source: "json",
							acceptsUndefined: true,
							codec: {
								mode: "strict",
								typeSymbol: "dsh-win-ssh-controller-source#remoteWorkspace/serviceAction:expectedInstanceId",
								create: _harness_remote_controller_remoteWorkspace_serviceAction_parameter_5$schema,
								jsonSchema: { "type": "string" }
							},
							strictCodec: {
								mode: "strict",
								typeSymbol: "dsh-win-ssh-controller-source#remoteWorkspace/serviceAction:expectedInstanceId",
								create: _harness_remote_controller_remoteWorkspace_serviceAction_parameter_5_strict$schema,
								jsonSchema: { "type": "string" }
							}
						}
					],
					result: {
						mode: "strict",
						typeSymbol: "dsh-win-ssh-controller-source/types#ServiceOperationState",
						create: _harness_remote_controller_remoteWorkspace_serviceAction_result$schema,
						description: "the operation state, including a possible outcome-unknown.",
						jsonSchema: {
							"type": "object",
							"properties": {
								"phase": {
									"type": "string",
									"enum": [
										"failed",
										"completed",
										"waiting",
										"idle",
										"submitting",
										"outcome-unknown"
									]
								},
								"action": {
									"type": "string",
									"enum": [
										"start",
										"stop",
										"restart"
									]
								},
								"operationId": { "type": "string" },
								"code": {
									"type": "string",
									"enum": [
										"SSH_UNAVAILABLE",
										"SSH_AUTH_FAILED",
										"HOST_KEY_REJECTED",
										"SSH_TIMEOUT",
										"HELPER_NOT_FOUND",
										"HELPER_UNSAFE",
										"HELPER_BAD_CONFIG",
										"CONTROL_UNSUPPORTED",
										"SERVICE_UNREGISTERED",
										"SERVICE_STOPPED",
										"SERVICE_FAILED",
										"USER_MANAGER_UNAVAILABLE",
										"DESCRIPTOR_MISSING",
										"DESCRIPTOR_INVALID",
										"DESCRIPTOR_STALE",
										"UNSUPPORTED_WEB_TRANSPORT",
										"LOCAL_AUTH_REQUIRED",
										"UPSTREAM_AUTH_REQUIRED",
										"IDENTITY_MISMATCH",
										"APPLICATION_NOT_READY",
										"UPSTREAM_UNREACHABLE",
										"REGISTRATION_STALE",
										"OPERATION_CONFLICT",
										"OPERATION_EXPIRED",
										"OUTCOME_UNKNOWN",
										"BAD_INPUT",
										"CONFIG_REQUIRED",
										"UNSAFE_PATH",
										"UNSAFE_FILE",
										"LINUX_REQUIRED",
										"CONTROL_FAILED",
										"FORBIDDEN",
										"NOT_FOUND",
										"PROXY_PAUSED"
									]
								},
								"startedAt": { "type": "string" },
								"finishedAt": { "type": "string" }
							},
							"required": ["phase"],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/remote/controller/src/index.ts",
						"line": 132,
						"column": 3
					}
				},
				"remoteWorkspace/watch": {
					service: "remoteWorkspace",
					description: "Observe attachment state until the caller cancels its stream.",
					mode: "stream",
					invocation: { kind: "direct" },
					parameters: [],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "dsh-win-ssh-controller-source/types#RemoteSnapshot",
						create: _harness_remote_controller_remoteWorkspace_watch_result$schema,
						description: "current state and later changes.",
						jsonSchema: {
							"type": "object",
							"properties": {
								"phase": {
									"type": "string",
									"enum": [
										"error",
										"checking",
										"idle",
										"ssh-auth",
										"discovering",
										"forwarding",
										"authenticating",
										"verifying",
										"app-ready",
										"disconnected",
										"reconnecting",
										"identity-mismatch",
										"auth-required",
										"service-stopped"
									]
								},
								"connectionId": { "type": "string" },
								"targetId": { "type": "string" },
								"endpointId": { "type": "string" },
								"hostName": { "type": "string" },
								"instanceId": { "type": "string" },
								"bootId": { "type": "string" },
								"profile": { "type": "string" },
								"workspaceHint": { "type": "string" },
								"generation": { "type": "number" },
								"reason": { "type": "string" },
								"diagnostics": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"name": {
												"type": "string",
												"enum": [
													"ssh",
													"helper",
													"service",
													"descriptor",
													"listener",
													"identity",
													"authentication",
													"events",
													"application"
												]
											},
											"state": {
												"type": "string",
												"enum": [
													"failed",
													"unknown",
													"checking",
													"ok",
													"unsupported"
												]
											},
											"code": {
												"type": "string",
												"enum": [
													"SSH_UNAVAILABLE",
													"SSH_AUTH_FAILED",
													"HOST_KEY_REJECTED",
													"SSH_TIMEOUT",
													"HELPER_NOT_FOUND",
													"HELPER_UNSAFE",
													"HELPER_BAD_CONFIG",
													"CONTROL_UNSUPPORTED",
													"SERVICE_UNREGISTERED",
													"SERVICE_STOPPED",
													"SERVICE_FAILED",
													"USER_MANAGER_UNAVAILABLE",
													"DESCRIPTOR_MISSING",
													"DESCRIPTOR_INVALID",
													"DESCRIPTOR_STALE",
													"UNSUPPORTED_WEB_TRANSPORT",
													"LOCAL_AUTH_REQUIRED",
													"UPSTREAM_AUTH_REQUIRED",
													"IDENTITY_MISMATCH",
													"APPLICATION_NOT_READY",
													"UPSTREAM_UNREACHABLE",
													"REGISTRATION_STALE",
													"OPERATION_CONFLICT",
													"OPERATION_EXPIRED",
													"OUTCOME_UNKNOWN",
													"BAD_INPUT",
													"CONFIG_REQUIRED",
													"UNSAFE_PATH",
													"UNSAFE_FILE",
													"LINUX_REQUIRED",
													"CONTROL_FAILED",
													"FORBIDDEN",
													"NOT_FOUND",
													"PROXY_PAUSED"
												]
											},
											"checkedAt": { "type": "string" }
										},
										"required": [
											"name",
											"state",
											"checkedAt"
										],
										"additionalProperties": true
									},
									"description": "One entry per named check; `unknown` is never rendered as healthy."
								},
								"capabilities": {
									"type": "object",
									"properties": {
										"controlVersion": { "type": "number" },
										"helperVersion": { "type": "string" },
										"mode": {
											"type": "string",
											"enum": [
												"unsupported",
												"systemd-user",
												"unregistered"
											]
										},
										"actions": {
											"type": "array",
											"items": { "type": "string" }
										}
									},
									"required": [
										"controlVersion",
										"helperVersion",
										"mode",
										"actions"
									],
									"additionalProperties": true
								},
								"service": {
									"type": "object",
									"properties": {
										"unit": { "type": "string" },
										"state": {
											"type": "string",
											"enum": [
												"failed",
												"unknown",
												"active",
												"inactive",
												"activating",
												"deactivating"
											]
										},
										"registered": { "type": "boolean" },
										"registrationRevision": {
											"type": "string",
											"description": "Registration revision observed from the remote helper's `status`. A write action must echo the revision the helper reported, otherwise the helper answers REGISTRATION_STALE. Absent when the helper never reported one, so the caller can tell \"unknown\" from a real value."
										}
									},
									"required": [
										"unit",
										"state",
										"registered"
									],
									"additionalProperties": true
								},
								"serviceOperation": {
									"type": "object",
									"properties": {
										"phase": {
											"type": "string",
											"enum": [
												"failed",
												"completed",
												"waiting",
												"idle",
												"submitting",
												"outcome-unknown"
											]
										},
										"action": {
											"type": "string",
											"enum": [
												"start",
												"stop",
												"restart"
											]
										},
										"operationId": { "type": "string" },
										"code": {
											"type": "string",
											"enum": [
												"SSH_UNAVAILABLE",
												"SSH_AUTH_FAILED",
												"HOST_KEY_REJECTED",
												"SSH_TIMEOUT",
												"HELPER_NOT_FOUND",
												"HELPER_UNSAFE",
												"HELPER_BAD_CONFIG",
												"CONTROL_UNSUPPORTED",
												"SERVICE_UNREGISTERED",
												"SERVICE_STOPPED",
												"SERVICE_FAILED",
												"USER_MANAGER_UNAVAILABLE",
												"DESCRIPTOR_MISSING",
												"DESCRIPTOR_INVALID",
												"DESCRIPTOR_STALE",
												"UNSUPPORTED_WEB_TRANSPORT",
												"LOCAL_AUTH_REQUIRED",
												"UPSTREAM_AUTH_REQUIRED",
												"IDENTITY_MISMATCH",
												"APPLICATION_NOT_READY",
												"UPSTREAM_UNREACHABLE",
												"REGISTRATION_STALE",
												"OPERATION_CONFLICT",
												"OPERATION_EXPIRED",
												"OUTCOME_UNKNOWN",
												"BAD_INPUT",
												"CONFIG_REQUIRED",
												"UNSAFE_PATH",
												"UNSAFE_FILE",
												"LINUX_REQUIRED",
												"CONTROL_FAILED",
												"FORBIDDEN",
												"NOT_FOUND",
												"PROXY_PAUSED"
											]
										},
										"startedAt": { "type": "string" },
										"finishedAt": { "type": "string" }
									},
									"required": ["phase"],
									"additionalProperties": true
								},
								"accessWarning": {
									"type": "string",
									"enum": [
										"SSH_UNAVAILABLE",
										"SSH_AUTH_FAILED",
										"HOST_KEY_REJECTED",
										"SSH_TIMEOUT",
										"HELPER_NOT_FOUND",
										"HELPER_UNSAFE",
										"HELPER_BAD_CONFIG",
										"CONTROL_UNSUPPORTED",
										"SERVICE_UNREGISTERED",
										"SERVICE_STOPPED",
										"SERVICE_FAILED",
										"USER_MANAGER_UNAVAILABLE",
										"DESCRIPTOR_MISSING",
										"DESCRIPTOR_INVALID",
										"DESCRIPTOR_STALE",
										"UNSUPPORTED_WEB_TRANSPORT",
										"LOCAL_AUTH_REQUIRED",
										"UPSTREAM_AUTH_REQUIRED",
										"IDENTITY_MISMATCH",
										"APPLICATION_NOT_READY",
										"UPSTREAM_UNREACHABLE",
										"REGISTRATION_STALE",
										"OPERATION_CONFLICT",
										"OPERATION_EXPIRED",
										"OUTCOME_UNKNOWN",
										"BAD_INPUT",
										"CONFIG_REQUIRED",
										"UNSAFE_PATH",
										"UNSAFE_FILE",
										"LINUX_REQUIRED",
										"CONTROL_FAILED",
										"FORBIDDEN",
										"NOT_FOUND",
										"PROXY_PAUSED"
									],
									"description": "Fixed code when a browser page lost its local authorization; never a credential."
								}
							},
							"required": [
								"phase",
								"generation",
								"diagnostics"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/remote/controller/src/index.ts",
						"line": 165,
						"column": 3
					}
				}
			}
		}, zod.z);
		//#endregion
		//#region ../../util/crypto/lib/index.js
		/**
		* Random v4 UUID, minted from `crypto.getRandomValues`.
		* @returns the UUID string.
		*/
		function randomUUID() {
			const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
			const hex = Array.from(bytes, (byte, index) => {
				return (index === 6 ? byte & 15 | 64 : index === 8 ? byte & 63 | 128 : byte).toString(16).padStart(2, "0");
			}).join("");
			return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
		}
		//#endregion
		//#region \0dsh-css:D:\AI\documents\codex\dsh-windows-launcher\work\harness-0.2.1-rc.2\controller\.build\validation\packages\remote\client\src\client\connections.module.css.mjs
		const css = ".nxHP9a_page{box-sizing:border-box;width:100%;min-width:0;height:100%;color:var(--dsw-alias-label-primary);font:var(--dsw-font-s-14);padding:28px clamp(24px,4vw,48px) 48px;overflow:auto}.nxHP9a_content{gap:24px;min-width:0;max-width:960px;margin:0 auto;display:grid}.nxHP9a_page h1{font:var(--dsw-font-l-20);margin:0}.nxHP9a_page h2{font:var(--dsw-font-s-strong-14);margin:0}.nxHP9a_intro{color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xs-13);margin:4px 0 0}.nxHP9a_card{border:.5px solid var(--dsw-alias-settings-card-stroke);border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-settings-card-fill);gap:16px;min-width:0;padding:20px;display:grid}.nxHP9a_form,.nxHP9a_choices{gap:12px;min-width:0;display:grid}.nxHP9a_field{gap:6px;min-width:0;display:grid}.nxHP9a_page input,.nxHP9a_page select{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-1);width:100%;min-width:0;height:34px;color:var(--dsw-alias-label-primary);font:var(--dsw-font-s-14);padding:0 10px}.nxHP9a_page input::placeholder{color:var(--dsw-alias-label-dimmed)}.nxHP9a_page select[size]{height:116px;padding:4px}.nxHP9a_page select[size] option{border-radius:var(--dsw-radius-sm);padding:4px 8px}.nxHP9a_page select[size] option:checked{background:var(--dsw-alias-interactive-bg-active);color:var(--dsw-alias-label-primary)}.nxHP9a_page button{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-md);height:36px;color:var(--dsw-alias-label-primary);font:var(--dsw-font-s-14);cursor:pointer;background:0 0;justify-content:center;align-items:center;gap:4px;padding:0 14px;display:inline-flex}.nxHP9a_page button:hover:not(:disabled),.nxHP9a_page summary:hover{background:var(--dsw-alias-interactive-bg-hover)}.nxHP9a_page button.nxHP9a_primary{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);border:none;justify-self:start}.nxHP9a_page button.nxHP9a_primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}.nxHP9a_page :is(button,input,select):disabled{cursor:not-allowed;opacity:.4}.nxHP9a_page :is(button,input,select,summary):focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px}.nxHP9a_helpLabel{align-items:center;gap:6px;display:inline-flex}.nxHP9a_page button.nxHP9a_helpButton{corner-shape:round;width:16px;height:16px;color:var(--dsw-alias-label-caption);font:var(--dsw-font-xxs-12);border:1px solid;border-radius:50%;flex:none;padding:0}.nxHP9a_helpText,.nxHP9a_hint{color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xs-13);overflow-wrap:anywhere;margin:0}.nxHP9a_helpText:not([hidden]){margin-top:8px;display:block}.nxHP9a_page summary{border-radius:var(--dsw-radius-xs);cursor:pointer;width:fit-content}.nxHP9a_advancedField{gap:6px;margin-top:12px;display:grid}.nxHP9a_fields{grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr));gap:16px;margin:16px 0;display:grid}.nxHP9a_actions{flex-wrap:wrap;align-items:end;gap:8px;display:flex}.nxHP9a_actions>label{flex:180px;max-width:100%}.nxHP9a_notice{color:var(--dsw-alias-state-error-primary);font:var(--dsw-font-xs-13);overflow-wrap:anywhere;margin:0}.nxHP9a_indicator{z-index:10000;border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-layer-2);max-width:50vw;color:var(--dsw-alias-label-primary);font:var(--dsw-font-xxs-12);pointer-events:none;text-overflow:ellipsis;white-space:nowrap;padding:5px 9px;position:fixed;top:8px;right:16px;overflow:hidden}[data-platform=darwin] .nxHP9a_page{padding-top:calc(28px + var(--dsh-frame-top-clearance,0px))}@media (width<=540px){.nxHP9a_page{padding:24px 16px 32px}.nxHP9a_card{padding:16px}}.nxHP9a_details{min-width:0}.nxHP9a_checks{flex-direction:column;gap:6px;min-width:0;margin:12px 0 0;padding:0;list-style:none;display:flex}.nxHP9a_check{border-top:.5px solid var(--dsw-alias-border-l4);min-width:0;font:var(--dsw-font-xs-13);flex-wrap:wrap;align-items:baseline;gap:8px;padding-top:6px;display:flex}.nxHP9a_checkName{min-width:0;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere;flex:0 auto}.nxHP9a_checkState{flex:none;font-weight:600}.nxHP9a_stateOk{color:var(--dsw-alias-state-success-primary)}.nxHP9a_stateFailed{color:var(--dsw-alias-state-error-primary)}.nxHP9a_stateUnknown{color:var(--dsw-alias-label-tertiary);font-style:italic}.nxHP9a_stateChecking{color:var(--dsw-alias-state-business-primary)}.nxHP9a_stateUnsupported{color:var(--dsw-alias-state-warn-primary)}.nxHP9a_checkCode{border-radius:var(--dsw-radius-xs);background:var(--dsw-alias-bg-layer-1);min-width:0;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere;flex:0 auto;padding:0 6px;font-size:11px}.nxHP9a_checkText{min-width:0;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere;flex:100%}.nxHP9a_service,.nxHP9a_block,.nxHP9a_ticket,.nxHP9a_confirm,.nxHP9a_operation{gap:8px;min-width:0;display:grid}.nxHP9a_service{gap:16px}.nxHP9a_blockTitle{font:var(--dsw-font-s-strong-14);margin:0}.nxHP9a_facts{gap:4px;min-width:0;margin:0;display:grid}.nxHP9a_fact{grid-template-columns:minmax(0,auto) minmax(0,1fr);gap:8px;min-width:0;display:grid}.nxHP9a_fact dt{color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xs-13)}.nxHP9a_fact dd{min-width:0;font:var(--dsw-font-xs-13);overflow-wrap:anywhere;margin:0}.nxHP9a_manual,.nxHP9a_ticket,.nxHP9a_confirm{border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-1);padding:12px}.nxHP9a_confirm{border-color:var(--dsw-alias-state-warn-primary)}.nxHP9a_operation{border-radius:var(--dsw-radius-md);border:.5px solid;padding:12px}.nxHP9a_opProgress{color:var(--dsw-alias-state-business-primary)}.nxHP9a_opCompleted{color:var(--dsw-alias-state-success-primary)}.nxHP9a_opFailed{color:var(--dsw-alias-state-error-primary)}.nxHP9a_opUnknown{color:var(--dsw-alias-state-warn-primary)}.nxHP9a_operation .nxHP9a_hint{color:inherit}.nxHP9a_ticketLink{color:var(--dsw-alias-state-business-primary);overflow-wrap:anywhere;margin-left:6px}@media (width<=420px){.nxHP9a_card{padding:12px}.nxHP9a_manual,.nxHP9a_ticket,.nxHP9a_confirm,.nxHP9a_operation{padding:10px}.nxHP9a_fact{grid-template-columns:minmax(0,1fr);gap:2px}}";
		const tagId = "dsh-win-ssh-controller-source/connections.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-win-ssh-controller-source";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var connections_module_css_default = {
			"actions": "nxHP9a_actions",
			"advancedField": "nxHP9a_advancedField",
			"block": "nxHP9a_block",
			"blockTitle": "nxHP9a_blockTitle",
			"card": "nxHP9a_card",
			"check": "nxHP9a_check",
			"checkCode": "nxHP9a_checkCode",
			"checkName": "nxHP9a_checkName",
			"checkState": "nxHP9a_checkState",
			"checkText": "nxHP9a_checkText",
			"checks": "nxHP9a_checks",
			"choices": "nxHP9a_choices",
			"confirm": "nxHP9a_confirm",
			"content": "nxHP9a_content",
			"details": "nxHP9a_details",
			"fact": "nxHP9a_fact",
			"facts": "nxHP9a_facts",
			"field": "nxHP9a_field",
			"fields": "nxHP9a_fields",
			"form": "nxHP9a_form",
			"helpButton": "nxHP9a_helpButton",
			"helpLabel": "nxHP9a_helpLabel",
			"helpText": "nxHP9a_helpText",
			"hint": "nxHP9a_hint",
			"indicator": "nxHP9a_indicator",
			"intro": "nxHP9a_intro",
			"manual": "nxHP9a_manual",
			"notice": "nxHP9a_notice",
			"opCompleted": "nxHP9a_opCompleted",
			"opFailed": "nxHP9a_opFailed",
			"opProgress": "nxHP9a_opProgress",
			"opUnknown": "nxHP9a_opUnknown",
			"operation": "nxHP9a_operation",
			"page": "nxHP9a_page",
			"primary": "nxHP9a_primary",
			"service": "nxHP9a_service",
			"stateChecking": "nxHP9a_stateChecking",
			"stateFailed": "nxHP9a_stateFailed",
			"stateOk": "nxHP9a_stateOk",
			"stateUnknown": "nxHP9a_stateUnknown",
			"stateUnsupported": "nxHP9a_stateUnsupported",
			"ticket": "nxHP9a_ticket",
			"ticketLink": "nxHP9a_ticketLink"
		};
		//#endregion
		//#region lib/types/client/connections.js
		/** Desktop connection management page and persistent remote-location indicator. */
		const EMPTY = {
			id: "",
			name: "",
			instanceKey: "default",
			instanceId: "",
			profile: "",
			workspaceHint: "",
			remotePort: "3080",
			lan: "",
			tcp: "",
			stcp: ""
		};
		/** How long a one-time ticket stays valid; after that the page asks for a new one. */
		const TICKET_LIFETIME_MS = 12e4;
		const PHASES = {
			idle: "phaseIdle",
			"ssh-auth": "phaseSsh",
			checking: "phaseChecking",
			discovering: "phaseDiscovering",
			forwarding: "phaseForwarding",
			authenticating: "phaseAuthenticating",
			verifying: "phaseVerifying",
			"app-ready": "phaseReady",
			disconnected: "phaseDisconnected",
			reconnecting: "phaseReconnecting",
			"identity-mismatch": "phaseMismatch",
			"auth-required": "phaseAuthRequired",
			"service-stopped": "phaseServiceStopped",
			error: "phaseError"
		};
		const ERRORS = {
			"remote-workspace: SSH_HOST_KEY": "errorHostKey",
			"remote-workspace: SSH_AUTH": "errorAuth",
			"remote-workspace: SSH_ALIAS": "errorAlias",
			"remote-workspace: SSH_UNREACHABLE": "errorUnreachable",
			"remote-workspace: SSH_HELPER": "errorHelper",
			"remote-workspace: NO_SESSION": "noSession",
			"remote-workspace: SESSION_CHANGED": "sessionChanged",
			"remote-workspace: SIDEBAR_NOT_READY": "sidebarNotReady",
			"remote-workspace: CONNECTION_CHANGED": "connectionChanged"
		};
		/** Every named check in report order, so the detail list is stable across snapshots. */
		const CHECKS = [
			{
				name: "ssh",
				label: "checkSsh"
			},
			{
				name: "helper",
				label: "checkHelper"
			},
			{
				name: "service",
				label: "checkService"
			},
			{
				name: "descriptor",
				label: "checkDescriptor"
			},
			{
				name: "listener",
				label: "checkListener"
			},
			{
				name: "identity",
				label: "checkIdentity"
			},
			{
				name: "authentication",
				label: "checkAuthentication"
			},
			{
				name: "events",
				label: "checkEvents"
			},
			{
				name: "application",
				label: "checkApplication"
			}
		];
		const CHECK_LABEL = {
			unknown: "stateUnknown",
			checking: "stateChecking",
			ok: "stateOk",
			failed: "stateFailed",
			unsupported: "stateUnsupported"
		};
		/** Distinct treatment per state; `unknown` is neutral and never shares the healthy class. */
		const CHECK_TONE = {
			unknown: connections_module_css_default.stateUnknown,
			checking: connections_module_css_default.stateChecking,
			ok: connections_module_css_default.stateOk,
			failed: connections_module_css_default.stateFailed,
			unsupported: connections_module_css_default.stateUnsupported
		};
		const CAPABILITY_MODE = {
			"systemd-user": "modeSystemd",
			unsupported: "modeUnsupported",
			unregistered: "modeUnregistered"
		};
		const SERVICE_STATE = {
			unknown: "serviceUnknown",
			inactive: "serviceInactive",
			activating: "serviceActivating",
			active: "serviceActive",
			deactivating: "serviceDeactivating",
			failed: "serviceFailed"
		};
		const OPERATION_LABEL = {
			idle: "opStateIdle",
			submitting: "opStateSubmitting",
			waiting: "opStateWaiting",
			completed: "opStateCompleted",
			failed: "opStateFailed",
			"outcome-unknown": "opStateUnknown"
		};
		const OPERATION_TEXT = {
			idle: "operationIdle",
			submitting: "operationSubmitting",
			waiting: "operationWaiting",
			completed: "operationCompleted",
			failed: "operationFailed",
			"outcome-unknown": "operationOutcomeUnknown"
		};
		/** Only `completed` is success; `failed` and `outcome-unknown` keep their own treatment. */
		const OPERATION_TONE = {
			idle: connections_module_css_default.opProgress,
			submitting: connections_module_css_default.opProgress,
			waiting: connections_module_css_default.opProgress,
			completed: connections_module_css_default.opCompleted,
			failed: connections_module_css_default.opFailed,
			"outcome-unknown": connections_module_css_default.opUnknown
		};
		/** Fixed code to explanation. Display only: the page never branches on localized text. */
		const CODE_TEXT = {
			SSH_UNAVAILABLE: "codeSshUnavailable",
			SSH_AUTH_FAILED: "codeSshAuthFailed",
			HOST_KEY_REJECTED: "codeHostKeyRejected",
			SSH_TIMEOUT: "codeSshTimeout",
			HELPER_NOT_FOUND: "codeHelperNotFound",
			HELPER_UNSAFE: "codeHelperUnsafe",
			HELPER_BAD_CONFIG: "codeHelperBadConfig",
			CONTROL_UNSUPPORTED: "codeControlUnsupported",
			SERVICE_UNREGISTERED: "codeServiceUnregistered",
			SERVICE_STOPPED: "codeServiceStopped",
			SERVICE_FAILED: "codeServiceFailed",
			USER_MANAGER_UNAVAILABLE: "codeUserManagerUnavailable",
			DESCRIPTOR_MISSING: "codeDescriptorMissing",
			DESCRIPTOR_INVALID: "codeDescriptorInvalid",
			DESCRIPTOR_STALE: "codeDescriptorStale",
			UNSUPPORTED_WEB_TRANSPORT: "codeUnsupportedWebTransport",
			LOCAL_AUTH_REQUIRED: "codeLocalAuthRequired",
			UPSTREAM_AUTH_REQUIRED: "codeUpstreamAuthRequired",
			IDENTITY_MISMATCH: "codeIdentityMismatch",
			APPLICATION_NOT_READY: "codeApplicationNotReady",
			UPSTREAM_UNREACHABLE: "codeUpstreamUnreachable",
			REGISTRATION_STALE: "codeRegistrationStale",
			OPERATION_CONFLICT: "codeOperationConflict",
			OPERATION_EXPIRED: "codeOperationExpired",
			OUTCOME_UNKNOWN: "codeOutcomeUnknown",
			BAD_INPUT: "codeBadInput",
			CONFIG_REQUIRED: "codeConfigRequired",
			UNSAFE_PATH: "codeUnsafePath",
			UNSAFE_FILE: "codeUnsafeFile",
			LINUX_REQUIRED: "codeLinuxRequired",
			CONTROL_FAILED: "codeControlFailed",
			FORBIDDEN: "codeForbidden",
			NOT_FOUND: "codeNotFound",
			PROXY_PAUSED: "codeProxyPaused"
		};
		/** Read one named check; a snapshot from an older Host may carry no diagnostics at all. */
		function checkOf(connection, name) {
			return (connection.diagnostics ?? []).find((check) => check.name === name);
		}
		function Help({ label, text, help }) {
			const [shown, setShown] = (0, react.useState)(false);
			const id = (0, react.useId)();
			return (0, react_jsx_runtime.jsxs)("span", {
				style: { display: "block" },
				children: [(0, react_jsx_runtime.jsxs)("span", {
					className: connections_module_css_default.helpLabel,
					children: [label, (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						"aria-label": `${help}: ${label}`,
						"aria-expanded": shown,
						"aria-controls": id,
						onClick: (event) => {
							event.preventDefault();
							setShown(!shown);
						},
						onKeyDown: (event) => {
							if (event.key === "Escape") {
								event.preventDefault();
								setShown(false);
							}
						},
						className: connections_module_css_default.helpButton,
						children: "?"
					})]
				}), (0, react_jsx_runtime.jsx)("span", {
					id,
					role: "note",
					hidden: !shown,
					className: connections_module_css_default.helpText,
					children: text
				})]
			});
		}
		function fromTarget(target) {
			return {
				id: target.id,
				name: target.name,
				instanceKey: target.instanceKey,
				instanceId: target.instanceId,
				profile: target.profile,
				workspaceHint: target.workspaceHint,
				remotePort: String(target.remotePort),
				lan: target.endpoints.find((item) => item.kind === "lan")?.sshAlias ?? "",
				tcp: target.endpoints.find((item) => item.kind === "frp-tcp")?.sshAlias ?? "",
				stcp: target.endpoints.find((item) => item.kind === "stcp")?.sshAlias ?? ""
			};
		}
		function toTarget(form) {
			const endpoints = [];
			if (form.lan.trim()) endpoints.push({
				id: "lan",
				kind: "lan",
				sshAlias: form.lan.trim()
			});
			if (form.tcp.trim()) endpoints.push({
				id: "frp-tcp",
				kind: "frp-tcp",
				sshAlias: form.tcp.trim()
			});
			if (form.stcp.trim()) endpoints.push({
				id: "stcp",
				kind: "stcp",
				sshAlias: form.stcp.trim()
			});
			return {
				id: form.id.trim(),
				name: form.name.trim(),
				instanceKey: form.instanceKey.trim(),
				instanceId: form.instanceId.trim(),
				profile: form.profile.trim(),
				workspaceHint: form.workspaceHint.trim(),
				remotePort: Number(form.remotePort),
				endpoints
			};
		}
		/** Filter visible choices without changing the selected connection or initiating a connection. */
		function SearchableConnectionList({ label, searchLabel, empty, noMatches, placeholder, allowEmpty = false, selectedLabel, choices, value, disabled, onSelect }) {
			const [query, setQuery] = (0, react.useState)("");
			const search = query.trim().toLowerCase();
			const visible = choices.filter((choice) => choice.searchText.toLowerCase().includes(search));
			const chosen = choices.find((choice) => choice.value === value);
			return (0, react_jsx_runtime.jsxs)("div", {
				className: connections_module_css_default.choices,
				children: [
					(0, react_jsx_runtime.jsx)("span", { children: label }),
					(0, react_jsx_runtime.jsx)("input", {
						type: "search",
						"aria-label": searchLabel,
						placeholder: searchLabel,
						value: query,
						disabled,
						onChange: (event) => {
							setQuery(event.target.value);
						},
						onKeyDown: (event) => {
							if (event.key === "Enter") event.preventDefault();
						}
					}),
					(0, react_jsx_runtime.jsxs)("select", {
						size: 4,
						"aria-label": label,
						value: visible.some((choice) => choice.value === value) ? value : "",
						disabled,
						onChange: (event) => {
							onSelect(event.target.value);
						},
						onKeyDown: (event) => {
							if (event.key === "Enter") event.preventDefault();
						},
						children: [(0, react_jsx_runtime.jsx)("option", {
							value: "",
							disabled: !allowEmpty,
							children: placeholder
						}), visible.map((choice) => (0, react_jsx_runtime.jsx)("option", {
							value: choice.value,
							children: choice.label
						}, choice.value))]
					}),
					selectedLabel && chosen && (0, react_jsx_runtime.jsxs)("p", {
						role: "status",
						className: connections_module_css_default.hint,
						children: [
							selectedLabel,
							": ",
							chosen.label
						]
					}),
					choices.length === 0 && (0, react_jsx_runtime.jsx)("p", {
						role: "status",
						className: connections_module_css_default.hint,
						children: empty
					}),
					choices.length > 0 && visible.length === 0 && (0, react_jsx_runtime.jsx)("p", {
						role: "status",
						className: connections_module_css_default.hint,
						children: noMatches
					})
				]
			});
		}
		/** One label and value pair inside the capability and service facts. */
		function Fact({ label, value }) {
			return (0, react_jsx_runtime.jsxs)("div", {
				className: connections_module_css_default.fact,
				children: [(0, react_jsx_runtime.jsx)("dt", { children: label }), (0, react_jsx_runtime.jsx)("dd", { children: value })]
			});
		}
		/** Expandable per-layer check detail; `unknown` keeps its own neutral treatment. */
		function Diagnostics({ t, connection }) {
			const checks = connection.diagnostics ?? [];
			return (0, react_jsx_runtime.jsxs)("details", {
				className: connections_module_css_default.details,
				"data-diagnostics": checks.length,
				children: [
					(0, react_jsx_runtime.jsx)("summary", { children: t("diagnostics") }),
					(0, react_jsx_runtime.jsx)("p", {
						className: connections_module_css_default.hint,
						children: t("diagnosticsHint")
					}),
					(0, react_jsx_runtime.jsx)("ul", {
						className: connections_module_css_default.checks,
						children: CHECKS.map(({ name, label }) => {
							const check = checkOf(connection, name);
							const state = check?.state ?? "unknown";
							const code = check?.code;
							return (0, react_jsx_runtime.jsxs)("li", {
								className: connections_module_css_default.check,
								"data-check": name,
								"data-state": state,
								children: [
									(0, react_jsx_runtime.jsx)("span", {
										className: connections_module_css_default.checkName,
										children: t(label)
									}),
									(0, react_jsx_runtime.jsx)("span", {
										className: `${connections_module_css_default.checkState} ${CHECK_TONE[state] ?? ""}`,
										"data-state": state,
										children: t(CHECK_LABEL[state])
									}),
									code !== void 0 && (0, react_jsx_runtime.jsx)("code", {
										className: connections_module_css_default.checkCode,
										children: code
									}),
									code !== void 0 && (0, react_jsx_runtime.jsx)("span", {
										className: connections_module_css_default.checkText,
										children: t(CODE_TEXT[code])
									}),
									state === "unknown" && (0, react_jsx_runtime.jsx)("span", {
										className: connections_module_css_default.checkText,
										children: t("stateUnknownNote")
									}),
									state === "unsupported" && (0, react_jsx_runtime.jsx)("span", {
										className: connections_module_css_default.checkText,
										children: t("stateUnsupportedNote")
									})
								]
							}, name);
						})
					})
				]
			});
		}
		/** Capability, service facts, restricted action buttons and the latest operation receipt. */
		function ServiceSection({ t, connection, operation, busy, pending, setPending, submit }) {
			const helper = checkOf(connection, "helper");
			const capabilities = connection.capabilities;
			const service = connection.service;
			const actions = capabilities?.actions ?? [];
			const manual = helper?.state === "unsupported" && helper.code === "CONTROL_UNSUPPORTED";
			const managed = capabilities?.mode === "systemd-user" && service?.registered === true;
			const state = service?.state ?? "unknown";
			const canStart = managed && actions.includes("start") && state !== "active" && state !== "activating" && state !== "deactivating";
			const canStop = managed && actions.includes("stop") && (state === "active" || state === "activating");
			const canRestart = managed && actions.includes("restart") && state === "active";
			const target = connection.hostName ?? connection.targetId ?? t("inactive");
			return (0, react_jsx_runtime.jsxs)("div", {
				className: connections_module_css_default.service,
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: connections_module_css_default.block,
						children: [(0, react_jsx_runtime.jsx)("h3", {
							className: connections_module_css_default.blockTitle,
							children: t("capability")
						}), capabilities === void 0 ? (0, react_jsx_runtime.jsx)("p", {
							className: connections_module_css_default.hint,
							children: t("stateUnknownNote")
						}) : (0, react_jsx_runtime.jsxs)("dl", {
							className: connections_module_css_default.facts,
							children: [
								(0, react_jsx_runtime.jsx)(Fact, {
									label: t("helperVersion"),
									value: capabilities.helperVersion
								}),
								(0, react_jsx_runtime.jsx)(Fact, {
									label: t("controlVersion"),
									value: String(capabilities.controlVersion)
								}),
								(0, react_jsx_runtime.jsx)(Fact, {
									label: t("controlMode"),
									value: t(CAPABILITY_MODE[capabilities.mode])
								}),
								(0, react_jsx_runtime.jsx)(Fact, {
									label: t("capabilityActions"),
									value: capabilities.actions.length === 0 ? t("noActions") : capabilities.actions.join(", ")
								})
							]
						})]
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: connections_module_css_default.block,
						children: [(0, react_jsx_runtime.jsx)("h3", {
							className: connections_module_css_default.blockTitle,
							children: t("service")
						}), service === void 0 ? (0, react_jsx_runtime.jsx)("p", {
							className: connections_module_css_default.hint,
							children: t("stateUnknownNote")
						}) : (0, react_jsx_runtime.jsxs)("dl", {
							className: connections_module_css_default.facts,
							children: [
								(0, react_jsx_runtime.jsx)(Fact, {
									label: t("serviceUnit"),
									value: service.unit
								}),
								(0, react_jsx_runtime.jsx)(Fact, {
									label: t("serviceStateLabel"),
									value: t(SERVICE_STATE[service.state])
								}),
								(0, react_jsx_runtime.jsx)(Fact, {
									label: t("serviceRegistered"),
									value: t(service.registered ? "registered" : "unregistered")
								})
							]
						})]
					}),
					manual ? (0, react_jsx_runtime.jsxs)("div", {
						className: connections_module_css_default.manual,
						"data-manual-start": "true",
						children: [(0, react_jsx_runtime.jsx)("p", {
							role: "status",
							className: connections_module_css_default.blockTitle,
							children: t("manualStartTitle")
						}), (0, react_jsx_runtime.jsx)("p", {
							className: connections_module_css_default.hint,
							children: t("manualStartText")
						})]
					}) : (0, react_jsx_runtime.jsxs)("div", {
						className: connections_module_css_default.actions,
						"data-service-actions": "true",
						children: [
							canStart && (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								disabled: busy,
								"data-action": "start",
								onClick: () => {
									submit("start");
								},
								children: t("serviceStart")
							}),
							canStop && (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								disabled: busy,
								"data-action": "stop",
								onClick: () => {
									setPending("stop");
								},
								children: t("serviceStop")
							}),
							canRestart && (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								disabled: busy,
								"data-action": "restart",
								onClick: () => {
									setPending("restart");
								},
								children: t("serviceRestart")
							}),
							!canStart && !canStop && !canRestart && (0, react_jsx_runtime.jsx)("p", {
								className: connections_module_css_default.hint,
								children: t("stateUnknownNote")
							})
						]
					}),
					(0, react_jsx_runtime.jsx)("p", {
						className: connections_module_css_default.hint,
						children: t("serviceActionHint")
					}),
					pending !== void 0 && (0, react_jsx_runtime.jsxs)("div", {
						className: connections_module_css_default.confirm,
						role: "alertdialog",
						"data-confirm": pending,
						"aria-label": t(pending === "stop" ? "confirmStopTitle" : "confirmRestartTitle"),
						children: [
							(0, react_jsx_runtime.jsx)("p", {
								className: connections_module_css_default.blockTitle,
								children: t(pending === "stop" ? "confirmStopTitle" : "confirmRestartTitle")
							}),
							(0, react_jsx_runtime.jsxs)("p", {
								className: connections_module_css_default.hint,
								children: [
									t("confirmTarget"),
									": ",
									target,
									" · ",
									t("serviceUnit"),
									": ",
									service?.unit ?? "—"
								]
							}),
							(0, react_jsx_runtime.jsx)("p", {
								className: connections_module_css_default.notice,
								children: t(pending === "stop" ? "confirmImpact" : "confirmRestartImpact")
							}),
							(0, react_jsx_runtime.jsxs)("div", {
								className: connections_module_css_default.actions,
								children: [(0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: connections_module_css_default.primary,
									disabled: busy,
									"data-confirm-accept": pending,
									onClick: () => {
										setPending(void 0);
										submit(pending);
									},
									children: t("confirmAccept")
								}), (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									disabled: busy,
									onClick: () => {
										setPending(void 0);
									},
									children: t("confirmCancel")
								})]
							})
						]
					}),
					operation !== void 0 && operation.phase !== "idle" && (0, react_jsx_runtime.jsxs)("div", {
						className: `${connections_module_css_default.operation} ${OPERATION_TONE[operation.phase] ?? ""}`,
						"data-phase": operation.phase,
						role: operation.phase === "failed" || operation.phase === "outcome-unknown" ? "alert" : "status",
						children: [
							(0, react_jsx_runtime.jsxs)("p", {
								className: connections_module_css_default.blockTitle,
								children: [
									t("operation"),
									": ",
									t(OPERATION_LABEL[operation.phase])
								]
							}),
							(0, react_jsx_runtime.jsx)("p", {
								className: connections_module_css_default.hint,
								children: t(OPERATION_TEXT[operation.phase])
							}),
							(0, react_jsx_runtime.jsxs)("p", {
								className: connections_module_css_default.hint,
								children: [
									t("operationAction"),
									": ",
									operation.action ?? "—",
									" · ",
									t("operationId"),
									": ",
									operation.operationId ?? "—"
								]
							}),
							operation.code !== void 0 && (0, react_jsx_runtime.jsxs)("p", {
								className: connections_module_css_default.hint,
								children: [
									t("codeLabel"),
									": ",
									operation.code,
									" · ",
									t(CODE_TEXT[operation.code])
								]
							})
						]
					})
				]
			});
		}
		/** Render target configuration and one-connection actions in the main pane. */
		function ConnectionsPage({ t, getSnapshot, subscribe, refresh, save, quickConnect, connect, disconnect, open, openInSystemBrowser, regenerateTicket, renewAuthentication, serviceAction, readServiceOperation }) {
			const state = (0, react.useSyncExternalStore)(subscribe, getSnapshot, getSnapshot);
			const [selected, setSelected] = (0, react.useState)(void 0);
			const [form, setForm] = (0, react.useState)(EMPTY);
			const [endpoint, setEndpoint] = (0, react.useState)("");
			const [alias, setAlias] = (0, react.useState)("");
			const [instanceKey, setInstanceKey] = (0, react.useState)("default");
			const [pending, setPending] = (0, react.useState)(void 0);
			(0, react.useEffect)(() => {
				refresh();
			}, [refresh]);
			(0, react.useEffect)(() => {
				readServiceOperation();
			}, [readServiceOperation]);
			(0, react.useEffect)(() => {
				if (state.aliases.length === 1) setAlias((current) => current || state.aliases[0] || "");
			}, [state.aliases]);
			(0, react.useEffect)(() => {
				const id = state.connection.targetId;
				const target = state.targets.find((item) => item.id === id);
				if (target !== void 0) {
					setSelected(target.id);
					setForm(fromTarget(target));
					setEndpoint(state.connection.endpointId ?? target.endpoints[0]?.id ?? "");
				}
			}, [state.connection.targetId, state.targets]);
			(0, react.useEffect)(() => {
				if (selected === void 0 && state.targets.length > 0) {
					const target = state.targets[0];
					if (target === void 0) return;
					setSelected(target.id);
					setForm(fromTarget(target));
					setEndpoint(target.endpoints[0]?.id ?? "");
				}
			}, [selected, state.targets]);
			const endpoints = state.targets.find((item) => item.id === selected)?.endpoints ?? toTarget(form).endpoints;
			const connection = state.connection;
			const authentication = checkOf(connection, "authentication");
			const authenticationCode = connection.accessWarning ?? (authentication?.state === "failed" ? authentication.code : void 0);
			const errorText = (message) => {
				const key = ERRORS[message];
				return key === void 0 ? message : t(key);
			};
			const field = (key, label, help) => (0, react_jsx_runtime.jsxs)("label", {
				className: connections_module_css_default.field,
				children: [(0, react_jsx_runtime.jsx)(Help, {
					label,
					text: t(help),
					help: t("help")
				}), (0, react_jsx_runtime.jsx)("input", {
					value: form[key],
					onChange: (event) => {
						setForm({
							...form,
							[key]: event.target.value
						});
					},
					disabled: state.busy || !!connection.connectionId
				})]
			}, key);
			const operation = state.serviceOperation ?? connection.serviceOperation;
			const ticket = state.openRequest;
			const ticketExpired = ticket?.url !== void 0 && Date.now() - ticket.issuedAt > TICKET_LIFETIME_MS;
			return (0, react_jsx_runtime.jsx)("section", {
				className: connections_module_css_default.page,
				children: (0, react_jsx_runtime.jsxs)("div", {
					className: connections_module_css_default.content,
					children: [
						(0, react_jsx_runtime.jsxs)("header", { children: [(0, react_jsx_runtime.jsx)("h1", { children: (0, react_jsx_runtime.jsx)(Help, {
							label: t("title"),
							text: t("helpTitle"),
							help: t("help")
						}) }), (0, react_jsx_runtime.jsx)("p", {
							className: connections_module_css_default.intro,
							children: t("intro")
						})] }),
						(0, react_jsx_runtime.jsxs)("section", {
							className: connections_module_css_default.card,
							children: [(0, react_jsx_runtime.jsx)("h2", { children: t("quick") }), (0, react_jsx_runtime.jsxs)("form", {
								onSubmit: (event) => {
									event.preventDefault();
									if (!state.busy && !state.hostRestartRequired && !connection.connectionId && alias.trim()) quickConnect(alias, instanceKey);
								},
								className: connections_module_css_default.form,
								children: [
									(0, react_jsx_runtime.jsx)(SearchableConnectionList, {
										label: t("aliasList"),
										searchLabel: t("searchAliases"),
										empty: t("noAliases"),
										noMatches: t("noConnectionMatches"),
										placeholder: t("chooseAlias"),
										value: alias,
										disabled: state.busy || !!connection.connectionId,
										choices: state.aliases.map((item) => ({
											value: item,
											label: item,
											searchText: item
										})),
										onSelect: setAlias
									}),
									(0, react_jsx_runtime.jsxs)("label", {
										className: connections_module_css_default.field,
										children: [(0, react_jsx_runtime.jsx)(Help, {
											label: t("alias"),
											text: t("helpAlias"),
											help: t("help")
										}), (0, react_jsx_runtime.jsx)("input", {
											value: alias,
											required: true,
											placeholder: t("aliasPlaceholder"),
											autoComplete: "off",
											disabled: state.busy || !!connection.connectionId,
											onChange: (event) => {
												setAlias(event.target.value);
											}
										})]
									}),
									(0, react_jsx_runtime.jsxs)("details", { children: [(0, react_jsx_runtime.jsx)("summary", { children: t("advanced") }), (0, react_jsx_runtime.jsxs)("label", {
										className: connections_module_css_default.advancedField,
										children: [(0, react_jsx_runtime.jsx)(Help, {
											label: t("instanceKey"),
											text: t("helpInstanceKey"),
											help: t("help")
										}), (0, react_jsx_runtime.jsx)("input", {
											value: instanceKey,
											required: true,
											disabled: state.busy || !!connection.connectionId,
											onChange: (event) => {
												setInstanceKey(event.target.value);
											}
										})]
									})] }),
									(0, react_jsx_runtime.jsx)("p", {
										className: connections_module_css_default.hint,
										children: t("quickHint")
									}),
									state.hostRestartRequired && (0, react_jsx_runtime.jsx)("p", {
										role: "alert",
										className: connections_module_css_default.notice,
										children: t("restartRequired")
									}),
									!state.hostRestartRequired && state.aliasWarning && (0, react_jsx_runtime.jsx)("p", {
										role: "status",
										className: connections_module_css_default.hint,
										children: t("aliasWarning")
									}),
									(0, react_jsx_runtime.jsx)("button", {
										type: "submit",
										disabled: state.busy || state.hostRestartRequired || !alias.trim() || !instanceKey.trim() || !!connection.connectionId,
										className: connections_module_css_default.primary,
										children: state.busy ? t("connecting") : t("quickConnect")
									})
								]
							})]
						}),
						(0, react_jsx_runtime.jsx)(SearchableConnectionList, {
							label: t("saved"),
							searchLabel: t("searchTargets"),
							empty: t("noTargets"),
							selectedLabel: t("currentTarget"),
							noMatches: t("noConnectionMatches"),
							placeholder: t("newTarget"),
							allowEmpty: true,
							value: selected ?? "",
							disabled: state.busy || !!connection.connectionId,
							choices: state.targets.map((target) => ({
								value: target.id,
								label: `${target.name} · ${target.endpoints.map((item) => item.sshAlias).join(", ")}`,
								searchText: [
									target.name,
									target.id,
									target.profile,
									target.workspaceHint,
									...target.endpoints.map((item) => item.sshAlias)
								].join(" ")
							})),
							onSelect: (value) => {
								setSelected(value);
								const found = state.targets.find((item) => item.id === value);
								setForm(found === void 0 ? EMPTY : fromTarget(found));
								setEndpoint(found?.endpoints[0]?.id ?? "");
							}
						}),
						(0, react_jsx_runtime.jsxs)("details", { children: [
							(0, react_jsx_runtime.jsx)("summary", { children: t("manual") }),
							(0, react_jsx_runtime.jsxs)("div", {
								className: connections_module_css_default.fields,
								children: [
									field("id", t("targetId"), "helpTargetId"),
									field("name", t("name"), "helpName"),
									field("instanceKey", t("instanceKey"), "helpInstanceKey"),
									field("instanceId", t("instanceId"), "helpIdentity"),
									field("profile", t("profile"), "helpProfile"),
									field("workspaceHint", t("workspace"), "helpWorkspace"),
									field("remotePort", t("port"), "helpPort"),
									field("lan", t("lan"), "helpRoutes"),
									field("tcp", t("tcp"), "helpRoutes"),
									field("stcp", t("stcp"), "helpRoutes")
								]
							}),
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								disabled: state.busy || !!connection.connectionId,
								onClick: () => {
									save(toTarget(form));
								},
								children: t("save")
							})
						] }),
						(0, react_jsx_runtime.jsxs)("section", {
							"aria-live": "polite",
							className: connections_module_css_default.card,
							children: [
								(0, react_jsx_runtime.jsxs)("h2", { children: [
									t("status"),
									": ",
									t(PHASES[connection.phase])
								] }),
								(0, react_jsx_runtime.jsxs)("p", {
									className: connections_module_css_default.hint,
									children: [
										connection.hostName ?? t("inactive"),
										" · ",
										connection.profile ?? "—",
										" · ",
										connection.workspaceHint ?? "—"
									]
								}),
								state.error && (0, react_jsx_runtime.jsxs)("p", {
									role: "alert",
									className: connections_module_css_default.notice,
									children: [
										t("error"),
										": ",
										errorText(state.error)
									]
								}),
								connection.reason && (0, react_jsx_runtime.jsx)("p", {
									className: connections_module_css_default.hint,
									children: errorText(connection.reason)
								}),
								(0, react_jsx_runtime.jsxs)("div", {
									className: connections_module_css_default.actions,
									children: [
										(0, react_jsx_runtime.jsxs)("label", {
											className: connections_module_css_default.field,
											children: [(0, react_jsx_runtime.jsx)(Help, {
												label: t("endpoint"),
												text: t("helpRoutes"),
												help: t("help")
											}), (0, react_jsx_runtime.jsxs)("select", {
												value: endpoint,
												disabled: state.busy || !!connection.connectionId,
												onChange: (event) => {
													setEndpoint(event.target.value);
												},
												children: [(0, react_jsx_runtime.jsx)("option", {
													value: "",
													children: "—"
												}), endpoints.map((item) => (0, react_jsx_runtime.jsxs)("option", {
													value: item.id,
													children: [
														item.kind,
														": ",
														item.sshAlias
													]
												}, item.id))]
											})]
										}),
										(0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: connections_module_css_default.primary,
											disabled: state.busy || !selected || !endpoint || !!connection.connectionId,
											onClick: () => {
												if (selected) connect(selected, endpoint);
											},
											children: t("connect")
										}),
										(0, react_jsx_runtime.jsx)("button", {
											type: "button",
											disabled: state.busy || !connection.connectionId,
											onClick: () => {
												disconnect();
											},
											children: t("disconnect")
										}),
										(0, react_jsx_runtime.jsx)("button", {
											type: "button",
											disabled: state.busy || connection.phase !== "app-ready",
											onClick: () => {
												open();
											},
											children: t("open")
										}),
										(0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: state.localSession ? void 0 : connections_module_css_default.primary,
											"data-entry": "system",
											disabled: state.busy || connection.connectionId === void 0,
											onClick: () => {
												openInSystemBrowser();
											},
											children: t("openSystem")
										}),
										(0, react_jsx_runtime.jsx)("button", {
											type: "button",
											disabled: state.busy,
											onClick: () => {
												refresh();
											},
											children: t("refresh")
										})
									]
								}),
								connection.phase === "app-ready" && (0, react_jsx_runtime.jsx)("p", {
									className: connections_module_css_default.hint,
									children: t("readyHint")
								}),
								!state.localSession && (0, react_jsx_runtime.jsx)("p", {
									className: connections_module_css_default.hint,
									children: t("openSystemPrimary")
								}),
								(0, react_jsx_runtime.jsx)("p", {
									className: connections_module_css_default.hint,
									children: t("openSystemHint")
								}),
								ticket !== void 0 && (0, react_jsx_runtime.jsxs)("div", {
									className: connections_module_css_default.ticket,
									"data-open-status": ticket.status,
									children: [
										(0, react_jsx_runtime.jsxs)("p", {
											role: "status",
											className: connections_module_css_default.hint,
											children: [
												t("openRequested"),
												" · ",
												t("openRequestedHint")
											]
										}),
										ticket.url !== void 0 && (0, react_jsx_runtime.jsxs)("p", {
											className: connections_module_css_default.hint,
											children: [t("openTicketLink"), (0, react_jsx_runtime.jsx)("a", {
												className: connections_module_css_default.ticketLink,
												href: ticket.url,
												target: "_blank",
												rel: "noopener noreferrer",
												children: ticket.url
											})]
										}),
										(0, react_jsx_runtime.jsx)("p", {
											className: connections_module_css_default.hint,
											children: ticketExpired ? t("openTicketExpired") : t("openTicketNote")
										}),
										(0, react_jsx_runtime.jsx)("button", {
											type: "button",
											disabled: state.busy,
											onClick: () => {
												regenerateTicket();
											},
											children: t("openRegenerate")
										})
									]
								}),
								authenticationCode === "UPSTREAM_AUTH_REQUIRED" && (0, react_jsx_runtime.jsxs)("div", {
									className: connections_module_css_default.block,
									"data-auth": "upstream",
									children: [
										(0, react_jsx_runtime.jsx)("p", {
											className: connections_module_css_default.blockTitle,
											children: t("authTitle")
										}),
										(0, react_jsx_runtime.jsx)("p", {
											className: connections_module_css_default.hint,
											children: t("authText")
										}),
										(0, react_jsx_runtime.jsx)("button", {
											type: "button",
											disabled: state.busy || connection.connectionId === void 0,
											onClick: () => {
												renewAuthentication();
											},
											children: t("authRefresh")
										})
									]
								}),
								authenticationCode === "LOCAL_AUTH_REQUIRED" && (0, react_jsx_runtime.jsxs)("div", {
									className: connections_module_css_default.block,
									"data-auth": "local",
									children: [(0, react_jsx_runtime.jsx)("p", {
										className: connections_module_css_default.blockTitle,
										children: t("authLocalTitle")
									}), (0, react_jsx_runtime.jsx)("p", {
										className: connections_module_css_default.hint,
										children: t("authLocalText")
									})]
								}),
								(0, react_jsx_runtime.jsx)(Diagnostics, {
									t,
									connection
								}),
								(0, react_jsx_runtime.jsx)(ServiceSection, {
									t,
									connection,
									operation,
									busy: state.busy,
									pending,
									setPending,
									submit: (action) => {
										serviceAction(action);
									}
								})
							]
						})
					]
				})
			});
		}
		/** Keep the actual execution host and remote workspace visible over the local shell. */
		function RemoteIndicator({ t, getSnapshot, subscribe }) {
			const { connection } = (0, react.useSyncExternalStore)(subscribe, getSnapshot, getSnapshot);
			if (connection.phase === "idle") return null;
			return (0, react_jsx_runtime.jsxs)("div", {
				"aria-live": "polite",
				className: connections_module_css_default.indicator,
				children: [
					t("location"),
					": ",
					connection.hostName,
					" / ",
					connection.profile,
					" / ",
					connection.workspaceHint,
					" (",
					t(PHASES[connection.phase]),
					")"
				]
			});
		}
		//#endregion
		//#region lib/types/client/locales.js
		/** Localized copy for the Desktop remote-workspace page. */
		const zh = {
			panel: "远程工作区",
			title: "远程工作区",
			intro: "选择 SSH 别名，一键连接你的 Linux Harness。",
			saved: "已保存目标",
			newTarget: "新建目标",
			targetId: "目标 ID",
			name: "主机名称",
			instanceKey: "实例键",
			instanceId: "预期实例 ID",
			profile: "远端 profile",
			workspace: "远端工作区",
			port: "远端 Web 端口",
			lan: "局域网 SSH alias",
			tcp: "frp TCP SSH alias",
			stcp: "STCP visitor SSH alias",
			save: "保存目标",
			connect: "连接",
			disconnect: "断开",
			open: "在应用内打开",
			endpoint: "连接入口",
			status: "连接状态",
			noTargets: "先保存一个目标。",
			noSession: "请先选择一个本机会话，以在侧栏中打开远端页面。",
			sessionChanged: "本机会话已切换，已取消打开。请在当前会话重新打开远程工作区。",
			sidebarNotReady: "本机会话侧栏尚未就绪，请稍后重新打开远程工作区。",
			connectionChanged: "远程连接已变化，请确认连接状态后重新打开。",
			reconnect: "重新连接",
			refresh: "刷新",
			error: "操作失败",
			location: "当前执行位置",
			inactive: "未连接",
			quick: "快速连接",
			alias: "SSH 别名",
			aliasPlaceholder: "选择或输入，如 harness-lan",
			aliasList: "已有 SSH 连接",
			searchAliases: "搜索 SSH 别名",
			chooseAlias: "请选择 SSH 别名",
			searchTargets: "搜索目标名称、SSH 别名或工作区",
			currentTarget: "当前目标",
			noAliases: "尚未找到已有 SSH 别名，可在下方直接输入。",
			noConnectionMatches: "没有匹配的连接，请修改或清空搜索条件。",
			quickConnect: "一键连接",
			connecting: "正在连接…",
			advanced: "高级选项",
			manual: "手动配置目标",
			help: "查看帮助",
			aliasWarning: "暂时无法读取 SSH 别名，可直接输入已配置的别名。",
			restartRequired: "本机尚未加载自动连接接口。请完全退出 DeepSeek Harness（包括托盘）后重新打开；仅刷新页面无法完成更新。",
			quickHint: "实例身份、profile、工作区和端口将自动读取。",
			readyHint: "连接已就绪。可直接在系统浏览器中打开；有本机会话时也可选择“在应用内打开”。",
			helpTitle: "本机需要配置可无交互登录的 SSH 别名；远端需要安装 Agent 并配置 dsh-remote-info。连接完成后，有本机会话时自动打开远端页面。",
			helpAlias: "这里填写本机 ~/.ssh/config 中 Host 后面的名称，如 harness-lan。用户名、地址、密钥和跳板机沿用 SSH 配置，无需重复填写。首次使用须通过可信渠道核对主机密钥并完成一次 SSH 登录。",
			helpInstanceKey: "远端 Agent 默认使用 default，通常无需修改。只有远端配置了其他实例键时才需要填写对应值。",
			helpIdentity: "一键连接会从已核对主机密钥的远端读取并保存实例身份。已有目标的身份变化时会停止连接；请确认远端重装或更换情况后再修改。",
			helpProfile: "远端 Harness 的运行 profile，可自动读取。手动配置时须与 Agent 返回的值完全一致。",
			helpWorkspace: "远端返回的工作区路径，仅用于显示执行位置，不会创建目录或修改远端工作区。",
			helpPort: "远端 Harness 监听的 Web 端口，可自动读取。此处不是 SSH 端口或 frp 端口。",
			helpRoutes: "仅填写实际使用的 SSH 别名。局域网、frp TCP 和 STCP 入口须指向同一个实例；连接入口默认选择第一个，可手动切换。",
			helpTargetId: "本机保存记录的唯一 ID。一键连接自动生成；手动配置使用字母、数字、下划线或连字符。",
			helpName: "用于区分已保存目标的名称。一键连接默认使用 SSH 别名。",
			phaseIdle: "未连接",
			phaseSsh: "正在验证 SSH",
			phaseDiscovering: "正在读取实例信息",
			phaseForwarding: "正在建立隧道",
			phaseAuthenticating: "正在验证远端身份",
			phaseReady: "已连接",
			phaseDisconnected: "连接已断开",
			phaseReconnecting: "正在重新连接",
			phaseMismatch: "实例身份不匹配",
			phaseAuthRequired: "需要重新认证",
			phaseError: "连接失败",
			errorHostKey: "SSH 主机密钥尚未确认或已变化。请通过可信渠道核对密钥，再在终端完成 SSH 登录。",
			errorAuth: "SSH 无交互认证失败。请配置 SSH 密钥或 ssh-agent，并确认该别名可无交互登录。",
			errorAlias: "无法解析 SSH 别名。请核对本机 SSH 配置中的 Host 名称。",
			errorUnreachable: "无法访问 SSH 入口。请检查远端 SSH 服务、网络和所用 frp 通道。",
			errorHelper: "远端 helper 缺失、不可执行或配置不正确。请确认已安装 Agent，并将 helperPath 指向配置了 DSH_HOME 和实例键的可执行 dsh-remote-info。",
			diagnostics: "分层检查明细",
			diagnosticsHint: "每一层单独显示结果；未知不等于正常，不支持是已记录的限制。",
			checkSsh: "SSH 传输",
			checkHelper: "远端 helper",
			checkService: "远端服务",
			checkDescriptor: "启动描述",
			checkListener: "本地监听",
			checkIdentity: "实例身份",
			checkAuthentication: "认证",
			checkEvents: "事件通道",
			checkApplication: "应用就绪",
			stateUnknown: "未知",
			stateChecking: "检查中",
			stateOk: "正常",
			stateFailed: "失败",
			stateUnsupported: "不支持",
			stateUnknownNote: "未知：本次检查没有取得结果，不能当作正常。",
			stateUnsupportedNote: "不支持是已记录的限制，不是故障。",
			capability: "服务能力",
			controlVersion: "控制协议",
			helperVersion: "helper 版本",
			controlMode: "管理模式",
			capabilityActions: "可用操作",
			noActions: "无",
			modeSystemd: "systemd 用户服务",
			modeUnsupported: "不支持服务管理",
			modeUnregistered: "未登记实例",
			service: "远端服务",
			serviceUnit: "unit",
			serviceStateLabel: "服务状态",
			serviceRegistered: "登记状态",
			registered: "已登记",
			unregistered: "未登记",
			serviceUnknown: "未知",
			serviceInactive: "未运行",
			serviceActivating: "启动中",
			serviceActive: "运行中",
			serviceDeactivating: "停止中",
			serviceFailed: "失败",
			serviceStart: "启动服务",
			serviceStop: "停止服务",
			serviceRestart: "重启服务",
			serviceActionHint: "按钮只按能力和服务状态提供；刷新页面只读取结果，不会重新提交动作。",
			manualStartTitle: "需在远端手动启动",
			manualStartText: "当前 helper 不支持自动服务管理（CONTROL_UNSUPPORTED）。请在远端主机上手动启动 Harness 用户服务，然后回到本页刷新。",
			confirmStopTitle: "确认停止远端服务",
			confirmRestartTitle: "确认重启远端服务",
			confirmTarget: "目标",
			confirmImpact: "该操作会立即中断远端正在执行的会话和页面访问，不会等待任务结束；本机无法确认当前是否有任务在运行。",
			confirmRestartImpact: "该操作会中断远端正在执行的会话和页面访问，并在服务重新就绪前无法访问；本机无法确认当前是否有任务在运行。",
			confirmAccept: "确认执行",
			confirmCancel: "取消",
			operation: "服务操作",
			operationAction: "动作",
			operationId: "操作 ID",
			opStateIdle: "未开始",
			opStateSubmitting: "提交中",
			opStateWaiting: "等待中",
			opStateCompleted: "已完成",
			opStateFailed: "失败",
			opStateUnknown: "结果未知",
			operationIdle: "没有正在进行的服务操作。",
			operationSubmitting: "正在提交…",
			operationWaiting: "已提交，正在等待服务就绪…",
			operationCompleted: "服务操作已完成。",
			operationFailed: "服务操作失败，未执行成功。",
			operationOutcomeUnknown: "结果未知：命令可能已被接受，也可能没有执行。请查看远端实际状态，不要重复提交。",
			openInApp: "在应用内打开",
			openSystem: "在系统浏览器中打开",
			openSystemHint: "无需本机会话，使用一次性票据在系统浏览器中打开。",
			openSystemPrimary: "当前未选择本机会话，系统浏览器是本页的主要打开入口。",
			openRequested: "已请求打开",
			openRequestedHint: "仅表示请求已发出，不代表远端页面已经加载成功。",
			openTicketLink: "如系统浏览器没有打开，请使用此链接：",
			openTicketNote: "票据短期有效，过期后请重新生成。",
			openTicketExpired: "此链接可能已过期，请重新生成。",
			openRegenerate: "重新生成链接",
			authTitle: "远端认证需要更新",
			authRefresh: "更新远端认证",
			authText: "远端拒绝了当前会话的认证。可在这里显式更新，不会重启远端服务，也不会重放已发出的写请求。",
			authLocalTitle: "本机页面授权已失效",
			authLocalText: "请在本页重新打开远端页面以取得新的本机授权；不会重启远端服务，也不会自动重试。",
			phaseChecking: "正在检查",
			phaseVerifying: "正在验证",
			phaseServiceStopped: "远端服务未运行",
			codeLabel: "错误码",
			codeSshUnavailable: "无法访问 SSH 入口：检查远端 SSH、网络和所用通道。",
			codeSshAuthFailed: "SSH 无交互认证失败：配置密钥或 ssh-agent 后重试。",
			codeHostKeyRejected: "SSH 主机密钥未确认或已变化：通过可信渠道核对后再登录。",
			codeSshTimeout: "SSH 调用超时：检查网络与远端负载后重试。",
			codeHelperNotFound: "远端 helper 缺失或不可执行：确认已安装 Agent 与 dsh-remote-info。",
			codeHelperUnsafe: "helper 路径或权限不安全：修正属主与执行权限。",
			codeHelperBadConfig: "helper 配置不正确：确认 DSH_HOME 与实例键。",
			codeControlUnsupported: "当前 helper 不支持自动服务管理：请在远端手动管理服务。",
			codeServiceUnregistered: "该实例未登记服务管理：远端未登记 unit，不会自动提权。",
			codeServiceStopped: "远端服务未运行：可显式启动后再连接。",
			codeServiceFailed: "远端服务执行失败：查看远端 systemd 状态。",
			codeUserManagerUnavailable: "远端没有可用的 systemd 用户管理器或 unit：请手动管理服务。",
			codeDescriptorMissing: "远端启动描述缺失：服务可能尚未启动或尚未写入描述。",
			codeDescriptorInvalid: "远端启动描述不可解析：确认版本与协议一致。",
			codeDescriptorStale: "远端启动描述已过期：等待服务重新写入后再试。",
			codeUnsupportedWebTransport: "远端 Web 传输方式不受支持：检查监听地址与协议配置。",
			codeLocalAuthRequired: "本机页面授权已失效：在本页重新打开远端页面。",
			codeUpstreamAuthRequired: "远端认证被拒绝：显式更新认证后重试。",
			codeIdentityMismatch: "实例身份与记录不一致：确认远端是否重装或更换后再连接。",
			codeApplicationNotReady: "远端应用尚未就绪：稍后重试。",
			codeUpstreamUnreachable: "远端应用不可达：检查远端监听与服务状态。",
			codeRegistrationStale: "登记版本已变化：刷新后按最新登记重新提交。",
			codeOperationConflict: "同一操作 ID 已用于不同参数：请重新发起新的操作。",
			codeOperationExpired: "操作回执已过期：只能查看远端实际状态。",
			codeOutcomeUnknown: "操作结果未知：命令可能已被接受，请查看实际状态，不要重复提交。",
			codeBadInput: "请求参数不合法：检查输入后重试。",
			codeConfigRequired: "远端配置缺失：先完成配置。",
			codeUnsafePath: "远端路径不安全：修正路径与权限。",
			codeUnsafeFile: "远端文件不安全：修正文件属主与权限。",
			codeLinuxRequired: "该功能仅在 Linux 远端可用。",
			codeControlFailed: "远端控制调用失败：查看远端状态后重试。",
			codeForbidden: "本机拒绝了该请求：确认当前连接与权限。",
			codeNotFound: "未找到对应记录：刷新后重试。",
			codeProxyPaused: "本地代理已暂停：恢复连接后重试。"
		};
		/** English fallback dictionary. */
		const en = {
			panel: "Remote Workspace",
			title: "Remote Workspace",
			intro: "Choose an SSH alias to connect your Linux Harness.",
			saved: "Saved target",
			newTarget: "New target",
			targetId: "Target ID",
			name: "Host name",
			instanceKey: "Instance key",
			instanceId: "Expected instance ID",
			profile: "Remote profile",
			workspace: "Remote workspace",
			port: "Remote Web port",
			lan: "LAN SSH alias",
			tcp: "frp TCP SSH alias",
			stcp: "STCP visitor SSH alias",
			save: "Save target",
			connect: "Connect",
			disconnect: "Disconnect",
			open: "Open in app",
			endpoint: "Connection endpoint",
			status: "Connection state",
			noTargets: "Save a target first.",
			noSession: "Select a local session first to open the remote page in the sidebar.",
			sessionChanged: "The local session changed, so opening was cancelled. Open the remote workspace again in the current session.",
			sidebarNotReady: "The local session sidebar is not ready. Try opening the remote workspace again shortly.",
			connectionChanged: "The remote connection changed. Check the connection state before opening again.",
			reconnect: "Reconnect",
			refresh: "Refresh",
			error: "Operation failed",
			location: "Execution location",
			inactive: "Disconnected",
			quick: "Quick connection",
			alias: "SSH alias",
			aliasPlaceholder: "Choose or enter, e.g. harness-lan",
			aliasList: "Existing SSH connections",
			searchAliases: "Search SSH aliases",
			chooseAlias: "Choose an SSH alias",
			searchTargets: "Search target name, SSH alias or workspace",
			currentTarget: "Current target",
			noAliases: "No SSH aliases were found. Enter an alias below.",
			noConnectionMatches: "No matching connections. Change or clear the search.",
			quickConnect: "Connect now",
			connecting: "Connecting…",
			advanced: "Advanced options",
			manual: "Manual target configuration",
			help: "Show help",
			aliasWarning: "SSH aliases could not be read. Enter an existing alias directly.",
			restartRequired: "The local connection service has not loaded the automatic connection methods. Fully quit DeepSeek Harness, including the tray, then reopen it. Reloading the page does not complete the update.",
			quickHint: "Instance identity, profile, workspace and port are discovered automatically.",
			readyHint: "Connected. Open it in the system browser, or use Open in app when a local session is selected.",
			helpTitle: "Configure a non-interactive SSH alias locally and install the Agent and dsh-remote-info remotely. A successful connection opens the remote page automatically when a local session is selected.",
			helpAlias: "Enter the Host name from your local ~/.ssh/config, e.g. harness-lan. SSH supplies the user, address, key and jump host. Verify the host key through a trusted channel and log in once before first use.",
			helpInstanceKey: "The Agent uses default unless configured otherwise. Change this only to match a custom remote instance key.",
			helpIdentity: "Quick connection reads and pins the identity through host-key-verified SSH. Changed identities on saved targets stop the connection. Verify any remote reinstall or replacement before editing the pin.",
			helpProfile: "Automatically read from the remote Harness. Manual configuration must exactly match the value returned by the Agent.",
			helpWorkspace: "The remote workspace path describes the execution location. This field does not create directories or change the remote workspace.",
			helpPort: "The remote Harness Web listening port is discovered automatically. This is not the SSH or frp port.",
			helpRoutes: "Enter only aliases you use. LAN, frp TCP and STCP must reach the same instance. The first route is selected by default; you can switch it.",
			helpTargetId: "A unique local record ID, generated by quick connection. Manual IDs accept letters, numbers, underscores and hyphens.",
			helpName: "The name shown for saved targets. Quick connection uses the SSH alias.",
			phaseIdle: "Disconnected",
			phaseSsh: "Verifying SSH",
			phaseDiscovering: "Reading instance information",
			phaseForwarding: "Starting tunnel",
			phaseAuthenticating: "Verifying remote identity",
			phaseReady: "Connected",
			phaseDisconnected: "Connection lost",
			phaseReconnecting: "Reconnecting",
			phaseMismatch: "Instance identity mismatch",
			phaseAuthRequired: "Authentication required",
			phaseError: "Connection failed",
			errorHostKey: "The SSH host key is unconfirmed or has changed. Verify it through a trusted channel, then log in from a terminal.",
			errorAuth: "Non-interactive SSH authentication failed. Configure an SSH key or ssh-agent and verify unattended login.",
			errorAlias: "The SSH alias could not be resolved. Check the Host name in your local SSH configuration.",
			errorUnreachable: "The SSH endpoint is unreachable. Check SSH, the network and any frp tunnel.",
			errorHelper: "The remote helper is missing, not executable or incorrectly configured. Install the Agent and point helperPath to an executable dsh-remote-info configured with DSH_HOME and the instance key.",
			diagnostics: "Layered check details",
			diagnosticsHint: "Each layer reports its own result; unknown is not healthy and unsupported is a recorded limitation.",
			checkSsh: "SSH transport",
			checkHelper: "Remote helper",
			checkService: "Remote service",
			checkDescriptor: "Launch descriptor",
			checkListener: "Local listener",
			checkIdentity: "Instance identity",
			checkAuthentication: "Authentication",
			checkEvents: "Event stream",
			checkApplication: "Application readiness",
			stateUnknown: "Unknown",
			stateChecking: "Checking",
			stateOk: "OK",
			stateFailed: "Failed",
			stateUnsupported: "Unsupported",
			stateUnknownNote: "Unknown: this check produced no result and must not be read as healthy.",
			stateUnsupportedNote: "Unsupported is a recorded limitation, not a failure.",
			capability: "Service capability",
			controlVersion: "Control protocol",
			helperVersion: "Helper version",
			controlMode: "Mode",
			capabilityActions: "Available actions",
			noActions: "None",
			modeSystemd: "systemd user service",
			modeUnsupported: "Service management unsupported",
			modeUnregistered: "Unregistered instance",
			service: "Remote service",
			serviceUnit: "Unit",
			serviceStateLabel: "Service state",
			serviceRegistered: "Registration",
			registered: "Registered",
			unregistered: "Not registered",
			serviceUnknown: "Unknown",
			serviceInactive: "Inactive",
			serviceActivating: "Activating",
			serviceActive: "Active",
			serviceDeactivating: "Deactivating",
			serviceFailed: "Failed",
			serviceStart: "Start service",
			serviceStop: "Stop service",
			serviceRestart: "Restart service",
			serviceActionHint: "Buttons follow the capability and service state; reloading the page only reads results and never resubmits an action.",
			manualStartTitle: "Start it manually on the remote host",
			manualStartText: "This helper does not support automatic service management (CONTROL_UNSUPPORTED). Start the Harness user service on the remote host, then reload this page.",
			confirmStopTitle: "Confirm stopping the remote service",
			confirmRestartTitle: "Confirm restarting the remote service",
			confirmTarget: "Target",
			confirmImpact: "This interrupts remote sessions and page access immediately and does not wait for running work to finish; this machine cannot confirm whether a task is active.",
			confirmRestartImpact: "This interrupts remote sessions and page access and makes the workspace unavailable until the service is ready again; this machine cannot confirm whether a task is active.",
			confirmAccept: "Confirm",
			confirmCancel: "Cancel",
			operation: "Service operation",
			operationAction: "Action",
			operationId: "Operation ID",
			opStateIdle: "Not started",
			opStateSubmitting: "Submitting",
			opStateWaiting: "Waiting",
			opStateCompleted: "Completed",
			opStateFailed: "Failed",
			opStateUnknown: "Outcome unknown",
			operationIdle: "No service operation is in progress.",
			operationSubmitting: "Submitting…",
			operationWaiting: "Submitted; waiting for the service to become ready…",
			operationCompleted: "The service operation completed.",
			operationFailed: "The service operation failed and did not succeed.",
			operationOutcomeUnknown: "Outcome unknown: the command may have been accepted, or it may not have run. Check the real remote state and do not resubmit.",
			openInApp: "Open in app",
			openSystem: "Open in system browser",
			openSystemHint: "No local session required; a one-time ticket opens it in the system browser.",
			openSystemPrimary: "No local session is selected, so the system browser is the primary entry point on this page.",
			openRequested: "Open requested",
			openRequestedHint: "This only means the request was issued; it does not prove the remote page loaded.",
			openTicketLink: "If the system browser did not open, use this link:",
			openTicketNote: "The ticket is short-lived; regenerate it after it expires.",
			openTicketExpired: "This link may have expired; regenerate it.",
			openRegenerate: "Regenerate link",
			authTitle: "Remote authentication needs renewal",
			authRefresh: "Renew remote authentication",
			authText: "The remote rejected this session. Renewing here never restarts the remote service and never replays a submitted write request.",
			authLocalTitle: "Local page authorization has expired",
			authLocalText: "Open the remote page again from this page to obtain fresh local authorization; the remote service is not restarted and nothing is retried automatically.",
			phaseChecking: "Checking",
			phaseVerifying: "Verifying",
			phaseServiceStopped: "Remote service is not running",
			codeLabel: "Code",
			codeSshUnavailable: "The SSH endpoint is unreachable: check SSH, the network and the tunnel in use.",
			codeSshAuthFailed: "Non-interactive SSH authentication failed: configure a key or ssh-agent.",
			codeHostKeyRejected: "The SSH host key is unconfirmed or changed: verify it through a trusted channel.",
			codeSshTimeout: "An SSH call timed out: check the network and remote load, then retry.",
			codeHelperNotFound: "The remote helper is missing or not executable: install the Agent and dsh-remote-info.",
			codeHelperUnsafe: "The helper path or permissions are unsafe: fix ownership and the execute bit.",
			codeHelperBadConfig: "The helper configuration is wrong: check DSH_HOME and the instance key.",
			codeControlUnsupported: "This helper does not support automatic service management: manage the service on the remote host.",
			codeServiceUnregistered: "This instance is not registered for service management; nothing is escalated automatically.",
			codeServiceStopped: "The remote service is not running: start it explicitly, then connect.",
			codeServiceFailed: "The remote service failed: inspect the remote systemd state.",
			codeUserManagerUnavailable: "No usable systemd user manager or unit on the remote: manage the service manually.",
			codeDescriptorMissing: "The launch descriptor is missing: the service may not have started or written it yet.",
			codeDescriptorInvalid: "The launch descriptor cannot be parsed: check the version and protocol.",
			codeDescriptorStale: "The launch descriptor is stale: wait for the service to rewrite it.",
			codeUnsupportedWebTransport: "The remote web transport is unsupported: check the listen address and protocol.",
			codeLocalAuthRequired: "Local page authorization expired: reopen the remote page from this page.",
			codeUpstreamAuthRequired: "The remote rejected authentication: renew it explicitly, then retry.",
			codeIdentityMismatch: "The instance identity differs from the saved record: verify the remote before connecting.",
			codeApplicationNotReady: "The remote application is not ready yet: retry shortly.",
			codeUpstreamUnreachable: "The remote application is unreachable: check the listener and service state.",
			codeRegistrationStale: "The registration revision changed: reload and submit against the current registration.",
			codeOperationConflict: "This operation id already described different parameters: start a new operation.",
			codeOperationExpired: "The operation receipt expired: only the real remote state can be checked.",
			codeOutcomeUnknown: "The outcome is unknown: the command may have been accepted; check the real state and do not resubmit.",
			codeBadInput: "The request input is invalid: correct it and retry.",
			codeConfigRequired: "Remote configuration is missing: complete it first.",
			codeUnsafePath: "The remote path is unsafe: fix the path and permissions.",
			codeUnsafeFile: "The remote file is unsafe: fix ownership and permissions.",
			codeLinuxRequired: "This capability is only available on a Linux remote.",
			codeControlFailed: "The remote control call failed: inspect the remote state and retry.",
			codeForbidden: "This machine refused the request: check the active connection and permissions.",
			codeNotFound: "No matching record was found: reload and retry.",
			codeProxyPaused: "The local proxy is paused: restore the connection and retry."
		};
		//#endregion
		//#region lib/types/client/assembly.js
		const PANEL = "remote-workspace";
		const INITIAL = {
			phase: "idle",
			generation: 0,
			diagnostics: []
		};
		/** Identify only missing automation methods on the local Host, without classifying remote HTTP failures. */
		function missingAutomationRoute(error) {
			const message = error instanceof Error ? error.message : String(error);
			return /^client api: remoteWorkspace\/(listAliases|quickConnect) failed: transport failure for \/api\/remoteWorkspace\/\1: HTTP 404$/u.test(message);
		}
		var ViewController = class {
			ctx;
			state = {
				targets: [],
				aliases: [],
				connection: INITIAL,
				busy: false,
				localSession: false
			};
			listeners = /* @__PURE__ */ new Set();
			constructor(ctx) {
				this.ctx = ctx;
			}
			getSnapshot = () => this.state;
			subscribe = (listener) => {
				this.listeners.add(listener);
				return () => {
					this.listeners.delete(listener);
				};
			};
			publish(state) {
				this.state = {
					...state,
					localSession: this.selectedSession() !== void 0
				};
				for (const listener of this.listeners) listener();
			}
			fail = (message) => {
				this.publish({
					...this.state,
					error: message
				});
			};
			async action(run) {
				if (this.state.busy) return;
				this.publish({
					...this.state,
					busy: true,
					error: void 0
				});
				try {
					await run();
				} catch (error) {
					if (missingAutomationRoute(error)) this.publish({
						...this.state,
						hostRestartRequired: true,
						error: void 0
					});
					else this.fail(error instanceof Error ? error.message : String(error));
				} finally {
					this.publish({
						...this.state,
						busy: false
					});
				}
			}
			refresh = async () => this.action(async () => {
				const targets = await this.ctx.remote.remoteWorkspace.listTargets();
				if (!targets.ok) throw targets.error;
				const connection = await this.ctx.remote.remoteWorkspace.getState();
				if (!connection.ok) throw connection.error;
				this.publish({
					...this.state,
					targets: targets.value,
					connection: connection.value,
					serviceOperation: connection.value.serviceOperation ?? this.state.serviceOperation
				});
				await this.readServiceOperation();
				const aliases = await this.ctx.remote.remoteWorkspace.listAliases();
				if (!aliases.ok && missingAutomationRoute(aliases.error)) throw aliases.error;
				this.publish({
					...this.state,
					aliases: aliases.ok ? aliases.value : [],
					aliasWarning: aliases.ok ? void 0 : true,
					hostRestartRequired: aliases.ok ? false : this.state.hostRestartRequired
				});
			});
			quickConnect = async (sshAlias, instanceKey) => this.action(async () => {
				if (this.state.hostRestartRequired) return;
				const result = await this.ctx.remote.remoteWorkspace.quickConnect(sshAlias.trim(), instanceKey.trim(), randomUUID());
				const targets = await this.ctx.remote.remoteWorkspace.listTargets();
				if (targets.ok) this.publish({
					...this.state,
					targets: targets.value
				});
				if (!result.ok) throw result.error;
				this.publish({
					...this.state,
					connection: result.value
				});
				if (this.selectedSession() !== void 0) await this.openReady();
			});
			save = async (target) => this.action(async () => {
				const result = await this.ctx.remote.remoteWorkspace.saveTarget(target);
				if (!result.ok) throw result.error;
				this.publish({
					...this.state,
					targets: result.value
				});
			});
			connect = async (targetId, endpointId) => this.action(async () => {
				const result = await this.ctx.remote.remoteWorkspace.connect(targetId, endpointId, randomUUID());
				if (!result.ok) throw result.error;
				this.publish({
					...this.state,
					connection: result.value
				});
				if (this.selectedSession() !== void 0) await this.openReady();
			});
			disconnect = async () => this.action(async () => {
				const id = this.state.connection.connectionId;
				if (id === void 0) return;
				const result = await this.ctx.remote.remoteWorkspace.disconnect(id);
				if (!result.ok) throw result.error;
				this.publish({
					...this.state,
					connection: result.value
				});
			});
			open = async () => this.action(() => this.openReady());
			/**
			* Open the authenticated workspace in the system browser.
			*
			* This never needs a local Session, because it does not touch the Sidebar, so it stays available
			* when no session is selected. It reuses the one-use ticket and the existing
			* `window.open(url, '_blank', 'noopener,noreferrer')` path that alpha.2 already routes to Desktop
			* `shell.openExternal`; no renderer capability and no shell command is added. The connection id
			* and generation are re-checked before and after the asynchronous ticket request, and a success
			* only ever means the open was requested.
			*/
			openInSystemBrowser = async () => this.action(async () => {
				const connection = this.state.connection;
				const id = connection.connectionId;
				if (id === void 0) throw new Error("remote-workspace: no active connection");
				const generation = connection.generation;
				const result = await this.ctx.remote.remoteWorkspace.createOpenTicket(id);
				if (!result.ok) throw result.error;
				if (this.state.connection.connectionId !== id || this.state.connection.generation !== generation) throw new Error("remote-workspace: CONNECTION_CHANGED");
				if (typeof result.value !== "string" || !/^https?:\/\//u.test(result.value)) throw new Error("remote-workspace: the local Host returned no usable open ticket");
				window.open(result.value, "_blank", "noopener,noreferrer");
				this.publish({
					...this.state,
					openRequest: {
						status: "requested",
						url: result.value,
						issuedAt: Date.now()
					}
				});
			});
			/** Replace an expired ticket with a fresh one through the same controlled path. */
			regenerateTicket = async () => {
				this.publish({
					...this.state,
					openRequest: void 0
				});
				await this.openInSystemBrowser();
			};
			/** Explicit re-authentication; it never restarts the remote service and never replays a request. */
			renewAuthentication = async () => this.action(async () => {
				const id = this.state.connection.connectionId;
				if (id === void 0) throw new Error("remote-workspace: no active connection");
				const result = await this.ctx.remote.remoteWorkspace.refreshAuthentication(id, randomUUID());
				if (!result.ok) throw result.error;
				this.publish({
					...this.state,
					connection: result.value
				});
			});
			/** Submit exactly one restricted service action; a page reload never re-submits it. */
			serviceAction = async (action) => this.action(async () => {
				const connection = this.state.connection;
				const id = connection.connectionId;
				if (id === void 0) throw new Error("remote-workspace: no active connection");
				const generation = connection.generation;
				const operationId = randomUUID();
				const result = await this.ctx.remote.remoteWorkspace.serviceAction(this.endpointRef(connection), action, operationId, (/* @__PURE__ */ new Date()).toISOString(), this.registrationRevision(connection), connection.instanceId);
				if (this.state.connection.connectionId !== id || this.state.connection.generation !== generation) throw new Error("remote-workspace: CONNECTION_CHANGED");
				if (!result.ok) throw result.error;
				this.publish({
					...this.state,
					serviceOperation: result.value
				});
			});
			/** Read a submitted operation's result. This never submits a new action. */
			readServiceOperation = async () => {
				const connection = this.state.connection;
				const operation = this.state.serviceOperation ?? connection.serviceOperation;
				if (operation?.operationId === void 0) return;
				if (operation.phase !== "submitting" && operation.phase !== "waiting") return;
				const result = await this.ctx.remote.remoteWorkspace.getServiceOperation(this.endpointRef(connection), operation.operationId);
				if (!result.ok) return;
				this.publish({
					...this.state,
					serviceOperation: result.value
				});
			};
			/** Endpoint reference of the active attachment; a saved target keeps its reviewed route. */
			endpointRef(connection) {
				if (connection.targetId !== void 0 && connection.endpointId !== void 0) return {
					targetId: connection.targetId,
					endpointId: connection.endpointId
				};
				return {
					sshAlias: connection.hostName ?? "",
					instanceKey: "default"
				};
			}
			/**
			* Registration revision the caller observed.
			*
			* The Host publishes the authoritative revision on the service state it read from the remote
			* helper's `status`; a write action must echo that exact value or the helper answers
			* `REGISTRATION_STALE`. When the helper never reported one, the page sends a bounded
			* placeholder instead of inventing a value, and the remote rejects the action rather than
			* executing anything.
			*/
			registrationRevision(connection) {
				const published = connection.service?.registrationRevision ?? connection.registrationRevision;
				return typeof published === "string" && /^[A-Za-z0-9_-]{1,64}$/u.test(published) ? published : "unobserved";
			}
			selectedSession() {
				return this.ctx.uiSession.adapter.current.getSnapshot().key;
			}
			async openReady() {
				const sessionId = this.selectedSession();
				if (sessionId === void 0) throw new Error("remote-workspace: NO_SESSION");
				const id = this.state.connection.connectionId;
				if (id === void 0) throw new Error("remote-workspace: no active connection");
				const generation = this.state.connection.generation;
				const previousPanel = this.ctx.layout.panelInfo.getSnapshot().activePanelId;
				this.ctx.layout.selectPanel(null);
				try {
					await new Promise((resolve) => setTimeout(resolve, 0));
					if (this.selectedSession() !== sessionId) throw new Error("remote-workspace: SESSION_CHANGED");
					if (this.ctx.sidebarRight.mounted.getSnapshot() !== sessionId) throw new Error("remote-workspace: SIDEBAR_NOT_READY");
					const result = await this.ctx.remote.remoteWorkspace.createOpenTicket(id);
					if (!result.ok) throw result.error;
					if (this.selectedSession() !== sessionId || this.ctx.sidebarRight.mounted.getSnapshot() !== sessionId) throw new Error("remote-workspace: SESSION_CHANGED");
					if (this.state.connection.connectionId !== id || this.state.connection.generation !== generation || this.state.connection.phase !== "app-ready") throw new Error("remote-workspace: CONNECTION_CHANGED");
					this.ctx.sidebarRight.openTab("browser", { params: { url: result.value } });
				} catch (error) {
					if (this.selectedSession() === sessionId && this.ctx.layout.panelInfo.getSnapshot().activePanelId === null) this.ctx.layout.selectPanel(previousPanel);
					throw error;
				}
			}
			observe(connection) {
				const same = this.state.connection.connectionId === connection.connectionId && this.state.connection.generation === connection.generation;
				this.publish({
					...this.state,
					connection,
					serviceOperation: connection.serviceOperation ?? this.state.serviceOperation,
					...same ? {} : { openRequest: void 0 }
				});
			}
		};
		/** Only the Remote base service is injected here; the namespace is mounted before UI activation. */
		const inject = ["remote"];
		/** @param ctx - Client module context. @returns contract disposer after the UI effects unwind. */
		async function apply(ctx) {
			const release = await ctx.remote.$mount(TYPERT_REMOTE);
			if (!("dshDesktop" in globalThis)) return release;
			ctx.inject([
				"remote.remoteWorkspace",
				"slots",
				"locale",
				"layout",
				"sidebarRight",
				"uiSession"
			], (scope) => {
				scope.effect(() => scope.locale.register("remoteWorkspace", {
					en,
					zh
				}), "remote-workspace: copy");
				const t = scope.locale.bind("remoteWorkspace");
				const view = new ViewController(scope);
				const stream = scope.remote.$stream({
					name: "remote workspace state",
					open: (signal) => scope.remote.remoteWorkspace.watch(signal),
					ended: () => /* @__PURE__ */ new Error("remote workspace state stream ended"),
					carrierFailed: () => {
						view.observe({
							...view.getSnapshot().connection,
							phase: "disconnected",
							reason: "local Host connection lost"
						});
					}
				});
				scope.effect(() => () => stream.dispose(), "remote-workspace: state stream");
				(async () => {
					for await (const frame of stream) {
						view.observe(frame.value);
						frame.accept();
					}
				})().catch((error) => {
					view.fail(error instanceof Error ? error.message : String(error));
				});
				scope.slots.inject("main", () => scope.slots.register({
					name: "main",
					key: PANEL,
					locale: "remoteWorkspace",
					inject: () => view
				}, ConnectionsPage));
				scope.slots.inject("sidebar.panellist", () => scope.slots.register({
					name: "sidebar.panellist",
					id: PANEL,
					order: 15,
					label: () => t("panel"),
					locale: "remoteWorkspace"
				}, ({ size }) => (0, react_jsx_runtime.jsx)("span", {
					style: { fontSize: size },
					children: "⇄"
				})));
				scope.slots.inject("shell.overlay", () => scope.slots.register({
					name: "shell.overlay",
					id: "remote-workspace.location",
					locale: "remoteWorkspace",
					inject: () => view
				}, RemoteIndicator));
			});
			return async () => {
				await release();
			};
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
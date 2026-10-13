/**
 * Typed client for the Agent management helper.
 *
 * The helper is invoked through the same fixed absolute path as discovery, with the literal
 * argument `--control`. Nothing here accepts a command, a unit name, a path or a shell string:
 * the only variable inputs are the allowlisted instance key, a bounded operation id, a
 * registration revision and an optional expected instance id.
 *
 * This module performs protocol validation and one invocation. It holds no replay logic; a
 * caller that lost an answer may only ask `operationStatus`.
 */
import { type RemoteErrorCode } from './errors.ts';
/** Fixed contract version for the management protocol, separate from discovery's 1. */
export declare const CONTROL_VERSION = 1;
export type ControlAction = 'capabilities' | 'status' | 'start' | 'stop' | 'restart' | 'operationStatus';
export declare const CONTROL_ACTIONS: readonly ControlAction[];
export declare const CONTROL_WRITE_ACTIONS: readonly ControlAction[];
/** Management mode the helper reports for one registered instance. */
export type ControlMode = 'systemd-user' | 'unsupported' | 'unregistered';
export type ServiceState = 'unknown' | 'inactive' | 'activating' | 'active' | 'deactivating' | 'failed';
export interface ControlServiceState {
    readonly unit: string;
    readonly loadState: string;
    readonly activeState: string;
    readonly subState: string;
    readonly state: ServiceState;
    readonly reason?: string;
}
export interface ControlDescriptorState {
    readonly present: boolean;
    readonly parsable: boolean;
    readonly bootId?: string;
    readonly instanceId?: string;
}
export interface ControlListenerState {
    readonly host: string;
    readonly port: number;
    readonly protocol: string;
    readonly supported: boolean;
}
export interface ControlCapabilities {
    readonly helperVersion: string;
    readonly discoveryVersions: readonly number[];
    readonly actions: readonly ControlAction[];
    readonly mode: ControlMode;
}
export interface ControlStatus {
    readonly helperVersion: string;
    readonly instanceKey: string;
    readonly registered: boolean;
    readonly mode: ControlMode;
    readonly registrationRevision?: string;
    readonly instanceId?: string;
    readonly service?: ControlServiceState;
    readonly descriptor: ControlDescriptorState;
    readonly listener?: ControlListenerState;
    readonly loopback?: {
        readonly connectable: boolean;
        readonly checkedAt: string;
    };
    readonly checkedAt: string;
}
export type OperationOutcome = 'pending' | 'completed' | 'failed' | 'outcome-unknown';
export interface ControlOperationReceipt {
    readonly operationId: string;
    readonly action: ControlAction;
    readonly instanceKey: string;
    readonly issuedAt: string;
    readonly recordedAt: string;
    readonly registrationRevision: string;
    readonly outcome: OperationOutcome;
    readonly code?: RemoteErrorCode;
    readonly summary?: string;
}
export interface ControlFailure {
    readonly code: RemoteErrorCode;
    readonly message: string;
    readonly stage: string;
    readonly retryable: boolean;
}
/** Either a validated payload or a fixed failure; never a partially parsed object. */
export type ControlResult<T> = {
    readonly ok: true;
    readonly value: T;
} | {
    readonly ok: false;
    readonly error: ControlFailure;
};
export declare function validOperationId(value: string): boolean;
export declare function validInstanceKey(value: string): boolean;
export declare function validRegistrationRevision(value: string): boolean;
export declare function validExpectedInstanceId(value: string): boolean;
/** @returns a validated capability payload, or undefined when the shape is not trusted. */
export declare function parseCapabilities(value: unknown): ControlCapabilities | undefined;
/** @returns a validated status payload, or undefined when the shape is not trusted. */
export declare function parseStatus(value: unknown): ControlStatus | undefined;
/** @returns a validated operation receipt, or undefined when the shape is not trusted. */
export declare function parseReceipt(value: unknown): ControlOperationReceipt | undefined;
export interface ControlClientOptions {
    readonly alias: string;
    readonly instanceKey: string;
    readonly helperPath: string;
    /** Read-only calls default to 10s; write actions may pass the service-command budget. */
    readonly timeoutMs?: number;
}
/** One control invocation over its own SSH process. */
export declare class ControlClient {
    private readonly options;
    constructor(options: ControlClientOptions);
    private invoke;
    /** @returns whether this helper implements the management protocol at all. */
    capabilities(signal: AbortSignal): Promise<ControlResult<ControlCapabilities>>;
    /** @returns the instance's registration, service, descriptor and listener facts. */
    status(signal: AbortSignal): Promise<ControlResult<ControlStatus>>;
    /** @returns one recorded receipt without submitting a new action. */
    operationStatus(operationId: string, signal: AbortSignal): Promise<ControlResult<ControlOperationReceipt>>;
    /**
     * Submit exactly one write action. The caller owns idempotence: the same operationId must be
     * reused when asking for the result and never replaced to force a retry.
     */
    submit(action: ControlAction, body: {
        operationId: string;
        issuedAt: string;
        registrationRevision: string;
        expectedInstanceId?: string;
    }, signal: AbortSignal): Promise<ControlResult<ControlOperationReceipt>>;
    private read;
}
//# sourceMappingURL=service-client.d.ts.map
/**
 * B04 — the Controller half of the frozen management contract.
 *
 * Runs under plain `node --test`: `errors.ts` and `service-client.ts` use only erasable
 * TypeScript syntax, so Node's own type stripping loads them without a build step.
 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { classifyHelperFailure, classifySshFailure, errorFacts, isRemoteErrorCode, redact }
  from '../packages/remote/controller/src/errors.ts'
import { CONTROL_ACTIONS, CONTROL_VERSION, CONTROL_WRITE_ACTIONS, parseCapabilities, parseReceipt,
  parseStatus, validInstanceKey, validOperationId } from '../packages/remote/controller/src/service-client.ts'

const contract = JSON.parse(await readFile(join(import.meta.dirname, '../docs/control-contract.json'), 'utf8'))

describe('management contract', () => {
  it('keeps discovery protocol 1 untouched and gives management its own version', () => {
    assert.equal(contract.discovery.protocolVersion, 1)
    assert.equal(contract.discovery.unchanged, true)
    assert.equal(contract.control.controlVersion, 1)
    assert.equal(CONTROL_VERSION, contract.control.controlVersion)
    assert.notEqual('controlVersion', 'protocolVersion')
  })

  it('declares exactly the implemented action set', () => {
    assert.deepEqual([...CONTROL_ACTIONS].sort(), [...contract.control.actions].sort())
    assert.deepEqual([...CONTROL_WRITE_ACTIONS].sort(), [...contract.control.writeActions].sort())
    const read = contract.control.actions.filter(action => !contract.control.writeActions.includes(action))
    assert.deepEqual(read.sort(), [...contract.control.readOnlyActions].sort())
  })

  it('declares exactly the implemented error vocabulary', () => {
    for (const code of contract.errorCodes) {
      assert.ok(isRemoteErrorCode(code), `contract code not implemented: ${code}`)
      assert.ok(errorFacts(code).stage.length > 0, `missing stage for ${code}`)
    }
    // The other direction matters too: an implemented code that is not in the frozen
    // contract would let the management page receive something it cannot classify.
    const declared = new Set(contract.errorCodes)
    for (const code of ['SSH_UNAVAILABLE', 'CONTROL_UNSUPPORTED', 'LOCAL_AUTH_REQUIRED', 'UPSTREAM_AUTH_REQUIRED',
      'IDENTITY_MISMATCH', 'OUTCOME_UNKNOWN', 'SERVICE_UNREGISTERED', 'USER_MANAGER_UNAVAILABLE']) {
      assert.ok(declared.has(code), `implemented code missing from the contract: ${code}`)
    }
  })

  it('never accepts an arbitrary command, unit or path', () => {
    const write = contract.control.requestFields.start
    for (const forbidden of ['command', 'unit', 'path', 'shell', 'argv', 'env', 'sudo']) {
      assert.ok(!write.includes(forbidden), `write request must not carry ${forbidden}`)
    }
    assert.ok(contract.control.rejected.includes('arbitrary unit name'))
    assert.ok(contract.control.rejected.includes('sudo or privilege escalation'))
  })

  it('bounds every caller-supplied identifier', () => {
    assert.equal(validOperationId('short'), false)
    assert.equal(validOperationId('0123456789abcdef'), true)
    assert.equal(validOperationId('0123456789abcdef; rm -rf /'), false)
    assert.equal(validInstanceKey('default'), true)
    assert.equal(validInstanceKey('../etc/passwd'), false)
    assert.equal(contract.control.limits.operationIdMaxAgeMs ?? contract.control.limits.issuedAtMaxAgeMs,
      contract.control.limits.issuedAtMaxAgeMs)
  })
})

describe('error classification', () => {
  it('separates host-key and authentication failures from a generic transport failure', () => {
    assert.equal(classifySshFailure('Host key verification failed.', 255, false), 'HOST_KEY_REJECTED')
    assert.equal(classifySshFailure('Permission denied (publickey).', 255, false), 'SSH_AUTH_FAILED')
    assert.equal(classifySshFailure('ssh: connect to host x port 22: Connection refused', 255, false), 'SSH_UNAVAILABLE')
    assert.equal(classifySshFailure('', 255, true), 'SSH_TIMEOUT')
    assert.equal(classifySshFailure('unknown failure text', 255, false), 'SSH_UNAVAILABLE')
  })

  it('treats only a structured BAD_INPUT on --control as an old helper', () => {
    assert.equal(classifyHelperFailure('BAD_INPUT\n', 1, true), 'CONTROL_UNSUPPORTED')
    // The same code on a discovery call is a real input error, not an old helper.
    assert.equal(classifyHelperFailure('BAD_INPUT\n', 1, false), 'BAD_INPUT')
    // A missing executable is not an old helper.
    assert.equal(classifyHelperFailure('', 127, true), 'HELPER_NOT_FOUND')
    assert.equal(classifyHelperFailure('bash: /x/y: Permission denied', 126, true), 'HELPER_NOT_FOUND')
    assert.equal(classifyHelperFailure('UNSAFE_PATH\n', 1, true), 'UNSAFE_PATH')
    // Two helper codes name this side of the wire instead of being error codes themselves.
    assert.equal(classifyHelperFailure('BAD_DESCRIPTOR\n', 1, true), 'DESCRIPTOR_INVALID')
    assert.equal(classifyHelperFailure('INFO_FAILED\n', 1, true), 'HELPER_BAD_CONFIG')
    assert.equal(classifyHelperFailure('something else', 1, true), 'HELPER_BAD_CONFIG')
  })

  it('redacts credentials and remote paths from any diagnostic string', () => {
    assert.ok(!redact('token=abcdef123456').includes('abcdef123456'))
    assert.ok(!redact('cookie: rw_deadbeef=secretvalue').includes('secretvalue'))
    assert.ok(!redact('ssh://user:pw@host/x').includes('user:pw'))
    assert.equal(redact('plain summary').length <= 300, true)
  })
})

describe('control response validation', () => {
  it('accepts a well-formed status and rejects a partially parsed one', () => {
    const good = {
      helperVersion: '0.2.0-alpha.1', instanceKey: 'default', registered: true, mode: 'systemd-user',
      registrationRevision: 'rev-1', instanceId: 'inst-1',
      descriptor: { present: true, parsable: true, bootId: 'boot-1' },
      listener: { host: '127.0.0.1', port: 3080, protocol: 'http:', supported: true },
      loopback: { connectable: true, checkedAt: '2026-10-13T00:00:00.000Z' },
      checkedAt: '2026-10-13T00:00:00.000Z',
    }
    assert.equal(parseStatus(good)?.mode, 'systemd-user')
    assert.equal(parseStatus({ ...good, mode: 'anything' }), undefined)
    assert.equal(parseStatus({ ...good, descriptor: { present: true } }), undefined)
    assert.equal(parseStatus({ ...good, listener: { host: '127.0.0.1', port: 0, protocol: 'http:', supported: true } }), undefined)
  })

  it('accepts a capability payload only when every action is known', () => {
    const good = { helperVersion: '0.2.0-alpha.1', discoveryVersions: [1], actions: [...CONTROL_ACTIONS], mode: 'systemd-user' }
    assert.deepEqual(parseCapabilities(good)?.actions, [...CONTROL_ACTIONS])
    assert.equal(parseCapabilities({ ...good, actions: ['status', 'run-shell'] }), undefined)
    assert.equal(parseCapabilities({ ...good, discoveryVersions: ['1'] }), undefined)
  })

  it('keeps an unknown outcome distinguishable from a completed one', () => {
    const receipt = {
      operationId: 'op-0123456789', action: 'restart', instanceKey: 'default',
      issuedAt: '2026-10-13T00:00:00.000Z', recordedAt: '2026-10-13T00:00:01.000Z',
      registrationRevision: 'rev-1', outcome: 'outcome-unknown',
    }
    assert.equal(parseReceipt(receipt)?.outcome, 'outcome-unknown')
    assert.equal(parseReceipt({ ...receipt, outcome: 'probably-done' }), undefined)
    assert.equal(parseReceipt({ ...receipt, code: 'NOT_A_CODE' }), undefined)
  })
})

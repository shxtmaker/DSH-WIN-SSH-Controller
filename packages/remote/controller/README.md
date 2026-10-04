---
description: "Attach one Linux Harness Web instance through OpenSSH and expose a local authenticated Browser proxy."
kind: "package-reference"
---

# @harness-remote/controller

English | [中文](README.zh.md)

## Summary

Attach one approved Linux Harness instance from Desktop without changing its Host. The controller discovers the instance through a fixed SSH helper, verifies its identity again after Harness authentication, and opens a loopback Browser proxy. It stores only non-secret target details. A disconnect closes only the processes and ports this plugin owns.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

The workspace bundle mounts this service in the Desktop Host.

### Minimal configuration

```yaml
- name: '@harness-remote/controller'
  config:
    helperPath: /usr/local/bin/dsh-remote-info
```

| Field | Default | Meaning |
|---|---|---|
| `helperPath` | Required | Fixed absolute Linux helper command reached through a reviewed SSH alias. |

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals</summary>

`ConnectionManager` owns one attachment generation. `ssh.ts` owns OpenSSH children, `auth.ts` verifies the authenticated remote identity, and `proxy.ts` owns local tickets, Cookies, HTTP, and WebSocket transport. `store.ts` rejects credential fields before persisting a target.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [Remote package group](../README.md) — the other parts of the attachment.
- [Implementation status](../../../docs/implementation-status.md) — build and live acceptance evidence.

-----

<a id="model-experience"></a>
## Model Experience

None, as this Host controller registers no prompt, tool, or model request content.

#### KV Cache effect

None; model requests run in the attached remote Harness and are not rewritten by this controller.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

These constraints apply to this attachment owner:

- Only one remote attachment is active at a time; the target must be configured with its stable instance identity.
- The controller requires a reachable Linux Companion and does not install, restart, or manage SSH, frp, or remote Harness.
- A Browser can open only after SSH discovery, Harness Cookie authentication, live identity confirmation, and event-stream readiness succeed.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers</summary>

None.

</details>

---
description: "Manage a Desktop remote Harness attachment and open its full Web page in the Browser sidebar."
kind: "package-reference"
---

# @harness-remote/client

English | [中文](README.zh.md)

## Summary

Manage the one remote attachment from the Desktop shell. The page saves non-secret targets, chooses a reviewed SSH alias, shows connection phases, and opens the remote Harness Web page in Browser. A persistent location indicator names the remote host and workspace while a connection is active. The local Desktop Host remains available.

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

The workspace bundle mounts its Host entry; Client modules supply the page when Desktop loads it.

### Minimal configuration

```yaml
- name: '@harness-remote/client'
```

No fields are accepted by this plugin. It requires the controller's generated `remoteWorkspace` contract and the local Browser and right Sidebar services.

The default page asks for one SSH alias and discovers instance details automatically. Custom instance keys and manual multi-route configuration are collapsed. Circular question-mark buttons beside titles open help on click and close on another click or Escape. Successful connection opens Browser automatically when a local Session is selected; otherwise it keeps the connection and shows the opening instructions.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals</summary>

`assembly.tsx` mounts the generated Remote contract before registering slots. `connections.tsx` renders the management page and location indicator. The Host entry is inert; it does not create a second Host runtime.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [Remote package group](../README.md) — the controller and bundle.
- [Sidebar Browser](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/client/ui-sidebar-browser/README.md) — tab ownership and native guest behavior.

-----

<a id="model-experience"></a>
## Model Experience

None, as this Client page registers no prompt, tool, or Session event.

#### KV Cache effect

None; opening the remote Web page does not itself submit a model request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

These limits affect the Desktop interface:

- Opening the remote page requires a selected local Session because Browser tabs belong to the right Sidebar's Session layout.
- This package supplies no separate Web management UI outside Desktop; the remote Harness page itself remains the existing full Web client.
- Browser guest loading in an installed Desktop has not completed live acceptance for this release.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers</summary>

None.

</details>

---
description: "Desktop profile layer that mounts the remote workspace controller and Client page together."
kind: "package-bundle"
---

# @harness-remote/workspace

English | [中文](README.zh.md)

## Summary

Add the remote workspace connection controls to a Desktop profile. This bundle inserts the controller and client rows as one opt-in layer; it does not replace the built-in Host or any Web business plugin. The controller and client packages must be available locally when the layer resolves. Use a Desktop runtime matching the package's `0.2.0-rc.2` peers.

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

The Desktop-owned `dsh plugin --profile desktop` command adds this bundle after Desktop has initialized the profile and fully exited. Supply the local controller and client tarballs in the same add operation; the source checkout's isolated tarball resolution passed, while installation in an actual Desktop has not been run.

### What you get

`cordis.patch.yml` inserts `remote-workspace-controller` and `remote-workspace-client`. The first owns SSH, authentication, and the local proxy; the second adds the Desktop page and Browser action.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals</summary>

The bundle's patch has two insert rows and no executable behavior. The controller row names a fixed helper path, which the operator must align with the remote Linux helper wrapper. The client row activates only where Desktop Client modules load.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [Remote package group](../README.md) — the inserted packages.
- [Desktop runtime](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/apps/desktop/README.md) — profile initialization and the bundled CLI.

-----

<a id="model-experience"></a>
## Model Experience

Indirectly, through the existing remote Harness plugins that own prompts, tools, and model requests.

#### KV Cache effect

This patch changes no model text or cache keys; remote plugin behavior determines any cache effect.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

These limits apply to profile composition:

- The bundle does not install or configure the remote Companion, SSH alias, or frp route.
- The default helper path must match an operator-installed, restricted Linux wrapper.
- An installed Desktop activation has not completed live acceptance for this release.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers</summary>

None.

</details>

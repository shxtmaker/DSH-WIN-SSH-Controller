# Verification status

The source and pinned Harness commits are recorded in source-baseline.json. Protocol version is 1 and plugin version is 0.1.0.

See [verification.json](verification.json) for measured split, build, and test results. Installed Desktop/Linux business acceptance, real frp recovery, and real-system cleanup remain notRun.

On 2026-10-05, direct Git installation was repaired by exposing the Controller runtime, Client module, and bundle configuration in the Git root. Host and Client package identities and Typert contracts are adapted consistently. Real Git installation passed on Windows and through the distributed CLI in WSL Ubuntu. The installed runtime passed real Loader composition, authenticated state HTTP, unauthenticated denial, and Client factory contract checks. Seven project regressions and four existing proxy/Loader regressions passed.

Evidence for that Git installation repair is recorded in `docs/evidence/git-install-*.txt`. That repair did not change business source or the three standalone artifacts. Installed Desktop visual/interaction acceptance and real SSH/frp business acceptance remain notRun.

The 2026-10-05 automatic connection iteration changes business source and regenerates all three standalone artifacts and Git runtime files. The default page asks only for an SSH alias, discovers instance details and retains existing identity pins. Circular question-mark buttons open help on click and close on Escape. See [automatic connection verification](automation-verification.json) for this iteration's results. Installed Desktop and real SSH/frp checks were not run for this iteration.

The 2026-10-05 connection-list iteration reuses the existing alias enumeration and target storage. Visible lists provide search and a current-target indicator. Filtering preserves the selection; search and keyboard selection do not initiate connections. See [connection-list verification](searchable-connections-verification.json) for implementation and measured checks. This iteration targets only the `codex/searchable-ssh-connections` branch on GitHub and Gitea, retaining version 0.1.0. Installed Desktop interaction, real SSH/frp, and macOS acceptance were not run for this iteration.

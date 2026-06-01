# VyOS Lab — Design

A standalone, fully-local VyOS router CLI simulator. Same look & feel as the
sibling `cisco-lab` (Vite + React + Tailwind + shadcn/ui terminal UI), but with
**no Base44 SDK and no auth wall** — it runs entirely in the browser.

Where `cisco-lab` simulates Cisco IOS's mode stack (`user` → `privileged` →
`config` → `interface`), VyOS Lab simulates VyOS's fundamentally different model:
a hierarchical **configuration tree** edited with `set`/`delete`, staged in a
**candidate** config, and applied with `commit` / persisted with `save`.

## Architecture

```
src/
  pages/Simulator.jsx          Layout: terminal (left) + training panel (right)
  components/
    terminal/                  Terminal shell, input (history/tab), output, status bar
    training/                  TrainingPanel, CommandGuide, ScenarioCard/Detail, ConfigTreePanel
    ui/button.jsx              shadcn button (only ui primitive used)
  lib/
    configTree.js              Pure config-tree data structure (THE core)
    vyosEngine.js              Operational/configuration mode state machine
    showCommands.js            Derives `show ...` operational output from running config
    pingSimulator.js           Reachability simulation from running config
    bootBanner.js              VyOS boot banner lines
    commandHelp.js             `help` / tab-completion vocabulary
    scenarios.js               4 build + 4 troubleshoot labs with validators
    guides.js                  Reference command cheat-sheets per topic
```

## The engine (the heart)

- **configTree.js** — a nested-object tree. `setPath`/`deletePath` mutate an
  immutable clone. Leaf multiplicity (single vs multi value, e.g. `description`
  vs `address`) and valueless flags (`disable`) are resolved via a small
  `LEAF_SPEC` heuristic. `renderCommands` emits `set ...` lines; `renderCurly`
  emits the familiar `{ }` config format (tag-node aware); `diff` powers
  `compare`.
- **vyosEngine.js** — holds `{ hostname, mode, running, candidate, modified,
  editLevel }`. `execute(line, state)` dispatches by mode:
  - **operational** (`vyos@host:~$`): `show ...`, `ping`, `configure`.
  - **configuration** (`vyos@host#`): `set`, `delete`, `commit`, `save`,
    `discard`, `compare`, `show`, `edit`/`top`/`up`, `exit`.
  - Edits apply to `candidate`; `commit` copies candidate → running.

State persists to `localStorage` on `save` (and a `reset` command wipes it).

## Content

Four topic areas, each with a build lab + a troubleshooting lab (broken config to
fix) plus reference guides: **Interfaces & basics**, **NAT & Firewall**,
**DHCP & DNS**, **Routing & VPN**. Scenario validators inspect the committed
running tree to mark objectives complete.

## Testing

Vitest unit tests cover the engine — set/commit/show flow, delete, multi-value
leaves, compare/diff, and every scenario validator against its solution.

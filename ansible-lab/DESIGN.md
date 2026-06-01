# Ansible Lab — Design

A standalone, fully-local Ansible **control-node simulator** for learning by doing.
Same look & feel as the sibling `vyos-lab` / `cisco-lab` (Vite + React + Tailwind +
shadcn/ui terminal UI), no auth, runs on **port 5174** so it never collides with
vyos-lab (5173).

Unlike a router CLI, Ansible drives a fleet of managed hosts from a control node.
So instead of a config-tree, the engine is a **mini-Ansible interpreter**: it parses
real playbook YAML and runs tasks through a module registry against stateful
managed hosts, producing genuine `PLAY RECAP` output and true idempotency.

## Architecture

```
src/
  pages/Simulator.jsx        Left: tabbed Terminal / Files editor.  Right: training + host state.
  components/
    terminal/                Terminal shell, input (history), output (ansible-colored), status bar
    editor/FileEditor.jsx    Virtual file tree + textarea editor (writes to the VFS)
    training/                TrainingPanel (Tutorials/Troubleshoot/Reference), TutorialDetail,
                             CommandGuide, HostStatePanel (live managed-host state)
    ui/button.jsx
  lib/
    vfs.js          Virtual filesystem (path -> content); backs the editor and cat/ls
    hostState.js    Managed-host model: { reachable, facts, packages, services, files, users }
    inventory.js    Parse INI/YAML inventory -> hosts + groups; resolve host patterns
    jinja.js        Jinja-lite: {{ var }} substitution, a few filters, simple `when` eval
    modules.js      Module registry (ping/package/service/copy/file/lineinfile/template/
                    user/set_fact/command/shell/debug/setup) -> { changed, failed, msg }
    playbook.js     YAML -> plays/tasks; runner: become, when, loop, register, notify/handlers,
                    tags, --check; emits PLAY/TASK/PLAY RECAP; idempotent on re-run
    adhoc.js        `ansible <pattern> -m <module> -a <args>` dispatch
    ansibleEngine.js  Command dispatcher (ansible, ansible-playbook, ansible-inventory,
                    ansible-doc, ansible-galaxy, ansible-vault, cat/ls/clear/reset/help)
    ansibleDoc.js   Short module docs
    seed.js         Default hosts (web1, web2, db1) + seed VFS files
    tutorials.js    4 guided multi-step tutorials with state validators
    troubleshoot.js 4 broken-setup labs with state validators
    reference.js    Command/module cheat-sheets
```

## The engine (the heart)

A task runs as `module(host, args, ctx) -> { changed, failed, unreachable, msg }`,
mutating the host's state. Idempotency falls out naturally: installing a package
that's already present returns `ok` (changed=false). Privileged modules
(package/service/user) fail with a permission error unless the task/play sets
`become: true` — which powers the "missing become" troubleshooting lab. Host
reachability depends on the inventory's `ansible_host` matching the host's real
address, so fixing the inventory file resolves the "unreachable host" lab.

State (hosts + VFS) persists to `localStorage`; `reset` restores defaults.

## Content (teaching-first)

Four topics, each a guided **Tutorial** (steps + commands + what to observe) and a
**Troubleshoot** lab (broken setup to fix), validated against real host/VFS state:
Inventory & ad-hoc · Playbooks/handlers · Variables/templates/loops · Roles/Galaxy/Vault.

## Testing

Vitest over the engine: inventory parsing, module idempotency (install→changed,
re-install→ok), playbook recap, ad-hoc dispatch, template rendering, become gating,
unreachable handling, and every tutorial/troubleshoot validator (fails before the
fix, passes once solved).

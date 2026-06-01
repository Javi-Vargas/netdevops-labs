# netdevops-labs

Interactive, **browser-based lab simulators** for learning network and DevOps
tooling by doing. Each lab is a self-contained web app that simulates a real CLI
or control plane — no VMs, no cloud, no backend, no login. Open it and start
typing.

| Lab | What you practice | Dev port |
|-----|-------------------|----------|
| [**vyos-lab**](./vyos-lab) | VyOS router configuration — the `set`/`commit`/`save` config-tree model, operational vs. configuration mode, NAT, firewall, DHCP/DNS, routing & VPN | `5173` |
| [**ansible-lab**](./ansible-lab) | Ansible automation — inventory & ad-hoc commands, playbooks/handlers, variables/templates/loops, roles, Galaxy & Vault, with real idempotency | `5174` |

Both run on **different ports**, so you can have them open side by side.

---

## Repository layout

```
netdevops-labs/
├── README.md            # you are here
├── vyos-lab/            # VyOS router CLI simulator  (self-contained app)
│   ├── README.md        #   full, standalone instructions for this lab
│   ├── package.json
│   └── src/
└── ansible-lab/         # Ansible control-node simulator  (self-contained app)
    ├── README.md        #   full, standalone instructions for this lab
    ├── package.json
    └── src/
```

This is a **monorepo of independent projects**, not a workspace. Each lab has its
own `package.json`, its own `node_modules`, its own build, and its own tests.
Nothing is shared at runtime. You can clone the repo and work on (or run) exactly
one lab without ever installing or touching the other.

## Requirements

- **Node.js 18+** (developed and tested on Node 20)
- npm (ships with Node)

## Quick start — pick one lab

You only need to `cd` into the lab you want. Each is identical to run:

### VyOS Lab
```bash
cd vyos-lab
npm install
npm run dev          # → http://localhost:5173
```

### Ansible Lab
```bash
cd ansible-lab
npm install
npm run dev          # → http://localhost:5174
```

### Run both at once
Open two terminals and run each lab's `npm run dev`. Because the ports differ
(5173 vs 5174), they won't collide.

### Test a lab
Each lab ships a Vitest suite covering its simulation engine:
```bash
cd vyos-lab && npm test
cd ansible-lab && npm test
```

### Build a lab (static output)
```bash
cd <lab> && npm run build      # outputs to <lab>/dist
```

---

## The labs in a bit more depth

### vyos-lab — VyOS Router Simulator
A faithful model of VyOS's CLI, which is fundamentally different from Cisco IOS:
a hierarchical **configuration tree** edited with `set`/`delete`, staged in a
**candidate** config, and applied with `commit` / persisted with `save`.

- **Operational mode** (`vyos@host:~$`): `show interfaces`, `show configuration`,
  `show ip route`, `show nat`, `show firewall`, `ping`, `configure`.
- **Configuration mode** (`vyos@host#`): `set`/`delete`, `commit`, `save`,
  `discard`, `compare`, `edit`/`top`/`up`, `exit`.
- Training panel with guided **Build** labs, **Troubleshoot** (fix-the-broken-config)
  labs, a **Reference** cheat-sheet, and a live view of the running config tree.

Try: `configure` → `set interfaces ethernet eth0 address 192.168.1.1/24` →
`compare` → `commit` → `show interfaces`.

### ansible-lab — Ansible Control-Node Simulator
A **mini Ansible interpreter** that parses real playbook YAML and runs tasks
through a module registry against stateful managed hosts — producing genuine
`PLAY RECAP` output and true **idempotency** on re-run.

- **Terminal**: `ansible`, `ansible-playbook`, `ansible-inventory`, `ansible-doc`,
  `ansible-galaxy`, `ansible-vault`, plus `cat`/`ls`/`reset`/`help`.
- **Files** tab: edit inventory and playbook YAML in-browser — the interpreter
  runs what you save.
- Training panel with guided **Tutorials**, **Troubleshoot** labs (unreachable
  host, missing `become`, non-idempotent task, vault errors), a **Reference**
  cheat-sheet, and a live **Managed Hosts** state panel.

Try: `ansible all -m ping` → `ansible-playbook playbooks/site.yml` → run it again
and watch `changed=0`.

---

## Working on a single lab in the monorepo

Because the labs are isolated, normal Git workflows scope cleanly to one folder:

```bash
# change only the VyOS lab and commit just that
git add vyos-lab/
git commit -m "vyos-lab: add OSPF scenario"

# see the history of one lab only
git log -- ansible-lab/
```

A change under one lab's directory never affects the other. The only way to
introduce coupling would be to deliberately extract a shared package that both
import — which this repo intentionally does **not** do, to keep each lab fully
independent.

## Adding a new lab

1. Create a new top-level directory (e.g. `tmux-lab/`).
2. Give it its own `package.json`, a unique dev port, and a standalone `README.md`.
3. Add a row to the table at the top of this file.

## Tech stack (shared by convention, not by code)

Vite + React 18 + Tailwind CSS + a minimal shadcn/ui `Button`. Each lab's core is
a pure, framework-agnostic simulation engine in `src/lib/`, covered by Vitest.

## License

The `vyos-lab` and `ansible-lab` apps in this repository are original work.
(Add your chosen license here, e.g. MIT.)

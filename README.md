# netdevops-labs

Interactive, **browser-based lab simulators** for learning network and DevOps
tooling by doing. Each lab is a self-contained web app that simulates a real CLI
or control plane — no VMs, no cloud, no backend, no login. Open it and start
typing.

| Lab | What you practice | Dev port |
|-----|-------------------|----------|
| [**vyos-lab**](./vyos-lab) | VyOS router configuration — the `set`/`commit`/`save` config-tree model, operational vs. configuration mode, source & destination NAT, stateful firewall, DHCP/DNS (incl. reservations), static & dynamic routing (OSPF & BGP), VPN (WireGuard + IPSec), plus a randomized **Drill** mode for reps | `5173` |
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

To run a lab **without Docker** you need:

- **Node.js 18+** (developed and tested on Node 20) — `npm` ships with it.

To run a lab **with Docker** you need instead:

- **Docker Engine** with the **Compose v2** plugin (`docker compose ...`).

### Verify what you have

```bash
node --version      # want v18.x or newer (e.g. v20.x)
npm --version       # any recent npm (10.x+)
docker --version    # only needed for the Docker path
docker compose version
```

### Install the requirements

**Node.js** — easiest cross-platform way is [nvm](https://github.com/nvm-sh/nvm):

```bash
# install nvm (Linux/macOS), then a current LTS Node:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# restart your shell, then:
nvm install --lts        # installs Node 20+ and npm
nvm use --lts
node --version && npm --version   # confirm
```

Or use your platform's package manager:

```bash
# macOS (Homebrew)
brew install node

# Debian / Ubuntu (NodeSource 20.x)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Windows (winget)
winget install OpenJS.NodeJS.LTS
```

**Docker** (only for the Docker path) — install [Docker Desktop](https://www.docker.com/products/docker-desktop/)
(macOS/Windows) or Docker Engine + the Compose plugin (Linux), then verify with
`docker --version` and `docker compose version`. Compose v2 is the `docker compose`
(space) subcommand — the legacy `docker-compose` (hyphen) is not required.

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

## Run with Docker (dev, hot-reload)

If you'd rather not install Node locally, run the labs in containers. Each lab
has a `Dockerfile.dev`, and the root `docker-compose.yml` runs the Vite dev
server with your source bind-mounted, so edits on the host hot-reload in the
browser. Requires Docker with Compose v2+.

```bash
docker compose up                 # run BOTH labs (build on first run)
docker compose up vyos-lab        # run just the VyOS lab    -> http://localhost:5173
docker compose up ansible-lab     # run just the Ansible lab -> http://localhost:5174
docker compose up -d              # run in the background
docker compose logs -f vyos-lab   # follow a lab's logs
docker compose down               # stop and remove the containers
```

Notes:
- The labs map to the same ports as local dev (5173 / 5174).
- Source is bind-mounted; each container keeps its own `node_modules` (via an
  anonymous volume) so platform-specific binaries are correct regardless of host OS.
- If hot-reload doesn't fire on your host, polling is already enabled through
  `VITE_USE_POLLING=true` in `docker-compose.yml`.
- After changing a lab's dependencies (`package.json`), rebuild:
  `docker compose build <lab>`.

---

## Run with Docker (pull-only, no clone)

To just *run* the labs — no clone, no Node, no build — use the pre-built images on
Docker Hub (`jvargas4/vyos-lab`, `jvargas4/ansible-lab`). Download only the
production compose file and start it. Requires Docker with Compose v2+.

```bash
curl -O https://raw.githubusercontent.com/Javi-Vargas/netdevops-labs/main/docker-compose.prod.yml
docker compose -f docker-compose.prod.yml pull    # download the images
docker compose -f docker-compose.prod.yml up -d   # start them
# vyos-lab -> http://localhost:5173 ,  ansible-lab -> http://localhost:5174
docker compose -f docker-compose.prod.yml down    # stop
```

Notes:
- These are production builds (static files served by nginx), so there's **no
  hot-reload** — use the dev workflow above when editing.
- The images are public, so no `docker login` is needed to pull them.
- Maintainers publish new images with `docker login && ./publish.sh` (builds both
  labs and pushes `:latest` + the `package.json` version to Docker Hub).

---

## The labs in a bit more depth

### vyos-lab — VyOS Router Simulator
A faithful model of VyOS's CLI, which is fundamentally different from Cisco IOS:
a hierarchical **configuration tree** edited with `set`/`delete`, staged in a
**candidate** config, and applied with `commit` / persisted with `save`.

- **Operational mode** (`vyos@host:~$`): `show interfaces`, `show configuration`,
  `show ip route`, `show ip ospf [neighbor]`, `show ip bgp [summary]`,
  `show nat source|destination rules`, `show vpn ipsec sa`, `show firewall`,
  `ping`, `configure`.
- **Configuration mode** (`vyos@host#`): `set`/`delete`, `commit`, `save`,
  `discard`, `compare`, `edit`/`top`/`up`, `exit`.
- Covers interfaces, source/destination NAT, stateful firewall, DHCP/DNS (incl.
  reservations), static routing, dynamic routing (OSPF & BGP), and VPN (WireGuard +
  IPSec site-to-site) — VyOS 1.4 syntax.
- Training panel with guided **Build** labs, a randomized **Drill** mode (rapid,
  auto-checked reps; topics: Interfaces, OSPF, BGP, Firewall, NAT, DHCP, IPSec),
  **Troubleshoot** (fix-the-broken-config) labs, a **Reference** cheat-sheet, and a
  live view of the running config tree.

Try: `configure` → `set interfaces ethernet eth0 address 192.168.1.1/24` →
`compare` → `commit` → `show interfaces`. Or OSPF: `set protocols ospf area 0
network 10.0.0.0/24` → `commit` → `run show ip ospf`.

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

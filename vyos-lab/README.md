# VyOS Lab

A browser-based **VyOS router CLI simulator** — practice VyOS configuration,
work through guided labs, and fix broken-config troubleshooting scenarios. Fully
local, no login, no backend.

It mirrors the sibling `cisco-lab` in look and feel, but models VyOS's
configuration-tree CLI (`set` / `delete` / `commit` / `save`) instead of Cisco
IOS's mode stack.

## Run it

```bash
npm install
npm run dev
```

Then open the printed URL (default http://localhost:5173).

## Try it

```
configure
set system host-name r1
set interfaces ethernet eth0 address 192.168.1.1/24
set interfaces ethernet eth0 description 'LAN'
compare
commit
save
exit
show interfaces
show configuration
```

- **Operational mode** (`vyos@r1:~$`): `show interfaces`, `show configuration`,
  `show ip route`, `show nat source rules`, `show firewall`, `ping <host>`,
  `configure`.
- **Configuration mode** (`vyos@r1#`): `set`/`delete <path> [value]`, `commit`,
  `save`, `discard`, `compare`, `show`, `edit`/`top`/`up`, `exit`.

The right-hand **Training** panel has guided **Build** labs, **Troubleshoot**
(fix-the-broken-config) labs, and a **Reference** cheat-sheet, plus a live view
of the running config tree. `reset` (operational mode) restores defaults.

## Test

```bash
npm test
```

## Topics covered

Interfaces & basics · NAT & Firewall · DHCP & DNS · Routing & VPN

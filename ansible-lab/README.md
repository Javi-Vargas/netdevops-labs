# Ansible Lab

A browser-based **Ansible control-node simulator** — learn Ansible by doing:
work through guided tutorials, run real `ansible` / `ansible-playbook` commands
against simulated managed hosts, edit inventory and playbook YAML in-browser, and
fix broken-setup troubleshooting labs. Fully local, no login, no backend.

It's a sibling of `vyos-lab` and `cisco-lab` and runs on **port 5174** so the two
can run side by side.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5174 (the port is fixed so it won't clash with vyos-lab on 5173).

## Try it

```
ansible all -m ping
ansible webservers -m setup
cat playbooks/site.yml
ansible-playbook playbooks/site.yml
ansible-playbook playbooks/site.yml        # run again — note changed=0 (idempotent)
ansible-inventory --graph
ansible-doc service
```

- **Terminal tab**: run `ansible`, `ansible-playbook`, `ansible-inventory`,
  `ansible-doc`, `ansible-galaxy`, `ansible-vault`, plus `cat`, `ls`, `clear`,
  `reset`, `help`.
- **Files tab**: open and edit the inventory, playbooks, group_vars, templates,
  and roles — your edits are what the interpreter runs.
- **Training panel**: guided **Tutorials**, **Troubleshoot** labs (a broken setup
  to fix), and a **Reference** cheat-sheet — plus a live **Managed Hosts** panel
  that shows packages/services/reachability changing as your plays run.

`reset` restores the default hosts and files.

## Test

```bash
npm test
```

## Topics covered

Inventory & ad-hoc commands · Playbooks, tasks & handlers ·
Variables, templates, loops & conditionals · Roles, Galaxy & Vault

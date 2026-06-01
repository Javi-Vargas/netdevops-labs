// Broken-setup troubleshooting labs. `solution` (edits + commands) is applied by
// tests; in the UI the learner edits files in the Files tab and re-runs.
import { baseState, installed, running, fileHas, vfsHas, ok } from './scenarioHelpers'
import { parseInventory } from './inventory'
import { readFile } from './vfs'
import { vaultEncrypt } from './vault'

const BROKEN_INVENTORY = `[webservers]
web1 ansible_host=192.168.56.11
web2 ansible_host=192.168.56.12

[dbservers]
db1 ansible_host=192.168.56.99

[webservers:vars]
http_port=80
`

const FIXED_INVENTORY = `[webservers]
web1 ansible_host=192.168.56.11
web2 ansible_host=192.168.56.12

[dbservers]
db1 ansible_host=192.168.56.21

[webservers:vars]
http_port=80
`

const BROKEN_BECOME = `---
- name: Install the web stack
  hosts: webservers
  tasks:
    - name: Install nginx
      package:
        name: nginx
        state: present

    - name: Start nginx
      service:
        name: nginx
        state: started
`

const MOTD_SHELL = `---
- name: Set the message of the day
  hosts: all
  become: true
  tasks:
    - name: Add the managed-by line
      shell: echo "Managed by Ansible" >> /etc/motd
`

const MOTD_LINEINFILE = `---
- name: Set the message of the day
  hosts: all
  become: true
  tasks:
    - name: Add the managed-by line
      lineinfile:
        path: /etc/motd
        line: "Managed by Ansible"
`

const SECURE_YML = `---
- name: Deploy the app secret
  hosts: dbservers
  become: true
  vars_files:
    - secrets.yml
  tasks:
    - name: Write the token file
      copy:
        content: "token={{ api_token }}"
        dest: /etc/app/token.conf
`

export const troubleshootLabs = [
  {
    id: 'ts-unreachable',
    title: 'A host is unreachable',
    category: 'troubleshoot',
    difficulty: 'beginner',
    duration: '5 min',
    description: 'ansible all -m ping shows db1 as UNREACHABLE. The inventory points it at the wrong address.',
    brief: "db1's ansible_host in the inventory is wrong (…99). Fix it to the real address (…21) in the Files tab, then re-ping.",
    objectives: [
      "db1's inventory address is corrected to 192.168.56.21",
      'db1 becomes reachable',
    ],
    commands: [
      { cmd: 'ansible all -m ping', why: 'Reproduce: db1 is UNREACHABLE.' },
      { cmd: 'cat inventory.ini', why: 'Inspect db1’s ansible_host — it points at .99, not .21.' },
      { cmd: '# Edit inventory.ini in the Files tab: set db1 ansible_host=192.168.56.21, Save', why: 'Correct the connection address.' },
      { cmd: 'ansible db1 -m ping', why: 'Confirm the fix.' },
    ],
    setup: () => baseState({ 'inventory.ini': BROKEN_INVENTORY }),
    solution: { edits: { 'inventory.ini': FIXED_INVENTORY } },
    validation: (s) => {
      const inv = parseInventory(readFile(s.vfs, 'inventory.ini'))
      const ah = inv.hosts.db1?.vars?.ansible_host
      return [
        ok(vfsHas(s, 'inventory.ini', 'db1 ansible_host=192.168.56.21'), 'address corrected'),
        ok(ah === s.hosts.db1.realAddress, 'db1 reachable'),
      ]
    },
  },

  {
    id: 'ts-become',
    title: 'Permission denied (missing become)',
    category: 'troubleshoot',
    difficulty: 'beginner',
    duration: '5 min',
    description: 'playbooks/broken-become.yml fails: installing packages and managing services needs root.',
    brief: "The play has no privilege escalation. Add 'become: true' to the play (or run with -b), then re-run.",
    objectives: [
      'nginx is installed on the webservers',
      'nginx service is started on the webservers',
    ],
    commands: [
      { cmd: 'ansible-playbook playbooks/broken-become.yml', why: 'Reproduce: tasks FAIL with permission denied.' },
      { cmd: '# Add "become: true" under the play in the Files tab — or pass -b', why: 'Privileged modules need sudo.' },
      { cmd: 'ansible-playbook playbooks/broken-become.yml -b', why: 'Re-run with become.' },
    ],
    setup: () => baseState({ 'playbooks/broken-become.yml': BROKEN_BECOME }),
    solution: { commands: ['ansible-playbook playbooks/broken-become.yml -b'] },
    validation: (s) => [
      ok(installed(s, 'web1', 'nginx') && installed(s, 'web2', 'nginx'), 'nginx installed'),
      ok(running(s, 'web1', 'nginx') && running(s, 'web2', 'nginx'), 'nginx started'),
    ],
  },

  {
    id: 'ts-idempotency',
    title: 'A task is not idempotent',
    category: 'troubleshoot',
    difficulty: 'intermediate',
    duration: '6 min',
    description: 'playbooks/motd.yml uses shell to append to /etc/motd, so it reports "changed" every run and duplicates the line.',
    brief: 'Replace the shell append with the lineinfile module so the task is idempotent and actually manages the file.',
    objectives: [
      '/etc/motd contains the managed line on all hosts',
      'The task uses lineinfile (idempotent), not shell',
    ],
    commands: [
      { cmd: 'cat playbooks/motd.yml', why: 'See the non-idempotent shell append.' },
      { cmd: 'ansible-playbook playbooks/motd.yml', why: 'Note: changed every run; nothing is really tracked.' },
      { cmd: '# In the Files tab, replace the shell task with:\n#   lineinfile:\n#     path: /etc/motd\n#     line: "Managed by Ansible"', why: 'Use a module that declares desired state.' },
      { cmd: 'ansible-playbook playbooks/motd.yml', why: 'Run twice — the second run is changed=0.' },
    ],
    setup: () => baseState({ 'playbooks/motd.yml': MOTD_SHELL }),
    solution: { edits: { 'playbooks/motd.yml': MOTD_LINEINFILE }, commands: ['ansible-playbook playbooks/motd.yml'] },
    validation: (s) => [
      ok(['web1', 'web2', 'db1'].every(h => fileHas(s, h, '/etc/motd', 'Managed by Ansible')), 'motd managed on all hosts'),
      ok(vfsHas(s, 'playbooks/motd.yml', 'lineinfile') && !vfsHas(s, 'playbooks/motd.yml', 'shell:'), 'uses lineinfile'),
    ],
  },

  {
    id: 'ts-vault',
    title: 'Vault: cannot decrypt secret',
    category: 'troubleshoot',
    difficulty: 'advanced',
    duration: '6 min',
    description: 'playbooks/secure.yml references a vaulted vars file and fails with "Attempting to decrypt but no vault secrets found".',
    brief: 'secrets.yml is Vault-encrypted. Provide the vault password at run time (--ask-vault-pass) or decrypt the file first, then re-run.',
    objectives: [
      'The token file /etc/app/token.conf is deployed on db1 with the secret value',
    ],
    commands: [
      { cmd: 'ansible-playbook playbooks/secure.yml', why: 'Reproduce: the vaulted vars_file cannot be read.' },
      { cmd: 'ansible-vault view secrets.yml', why: 'Confirm it is encrypted.' },
      { cmd: 'ansible-playbook playbooks/secure.yml --ask-vault-pass', why: 'Supply the vault password for this run.' },
      { cmd: '# Alternatively: ansible-vault decrypt secrets.yml, then run normally', why: 'Either approach unlocks the secret.' },
    ],
    setup: () => baseState({
      'playbooks/secure.yml': SECURE_YML,
      'secrets.yml': vaultEncrypt('---\napi_token: vault-token-123\n'),
    }),
    solution: { commands: ['ansible-playbook playbooks/secure.yml --ask-vault-pass'] },
    validation: (s) => [
      ok(fileHas(s, 'db1', '/etc/app/token.conf', 'vault-token-123'), 'secret deployed to db1'),
    ],
  },
]

// Command/module cheat-sheets shown in the Training panel's "Reference" tab.
export const referenceGuides = [
  {
    topic: 'Inventory & ad-hoc commands',
    intro: 'Inventory lists your managed hosts and groups. Ad-hoc commands run a single module against a pattern without a playbook.',
    commands: [
      { cmd: 'ansible all -m ping', why: 'Check connectivity to every host.' },
      { cmd: 'ansible webservers -m setup', why: 'Gather facts (ansible_distribution, ansible_os_family, ...).' },
      { cmd: 'ansible all -m command -a "uptime"', why: 'Run a command (the default module).' },
      { cmd: 'ansible web1 -m package -a "name=htop state=present" -b', why: 'Install a package (-b = become/sudo).' },
      { cmd: 'ansible-inventory --graph', why: 'Visualize groups and hosts.' },
      { cmd: 'ansible "webservers:!web2" -m ping', why: 'Patterns: union (:), exclusion (!group), intersection (&group).' },
    ],
  },
  {
    topic: 'Playbooks, tasks & handlers',
    intro: 'Playbooks are YAML files of plays; each play maps a host pattern to an ordered list of tasks. Handlers run once, only when notified by a changed task.',
    commands: [
      { cmd: 'ansible-playbook playbooks/site.yml', why: 'Run a playbook.' },
      { cmd: 'ansible-playbook playbooks/site.yml --check', why: 'Dry run — report changes without making them.' },
      { cmd: 'ansible-playbook playbooks/site.yml --limit web1', why: 'Restrict the run to a subset of hosts.' },
      { cmd: 'ansible-playbook playbooks/site.yml --tags deploy', why: 'Run only tasks with a given tag.' },
      { cmd: 'become: true', why: 'Privilege escalation — required for package/service/user modules.' },
      { cmd: 'notify: reload nginx', why: 'Trigger a handler; idempotent runs (changed=0) do not fire it.' },
    ],
  },
  {
    topic: 'Variables, templates, loops & conditionals',
    intro: 'Variables come from inventory, group_vars/host_vars, play vars, and set_fact. Jinja2 templates render them; loops and when add iteration and conditionals.',
    commands: [
      { cmd: 'debug: { var: ansible_os_family }', why: 'Print a variable to inspect it.' },
      { cmd: 'loop: "{{ packages }}"', why: 'Iterate a list; the current value is {{ item }}.' },
      { cmd: 'when: ansible_os_family == "Debian"', why: 'Run a task only when a condition is true.' },
      { cmd: 'template: { src: index.html.j2, dest: /etc/nginx/index.html }', why: 'Render a Jinja2 template to the host.' },
      { cmd: 'set_fact: { app_ready: true }', why: 'Define a variable at runtime for later tasks.' },
      { cmd: 'register: result', why: 'Capture a task’s result for use in later tasks.' },
    ],
  },
  {
    topic: 'Roles, Galaxy & Vault',
    intro: 'Roles package reusable tasks/handlers/vars/templates. ansible-galaxy scaffolds and installs them. Vault encrypts secrets at rest.',
    commands: [
      { cmd: 'ansible-galaxy init apache', why: 'Scaffold a role directory (tasks/, handlers/, defaults/, ...).' },
      { cmd: 'roles: [apache]', why: 'Apply a role from a play (its tasks run first).' },
      { cmd: 'ansible-galaxy list', why: 'List installed roles.' },
      { cmd: 'ansible-vault encrypt secrets.yml', why: 'Encrypt a secrets file at rest.' },
      { cmd: 'ansible-vault view secrets.yml', why: 'View an encrypted file’s contents.' },
      { cmd: 'ansible-playbook secure.yml --ask-vault-pass', why: 'Run a playbook that references vaulted vars.' },
    ],
  },
];
